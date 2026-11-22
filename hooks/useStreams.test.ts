import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useStreams } from "./useStreams";

const fetchStreamsMock = vi.fn();

vi.mock("../lib/streams", () => ({
  fetchStreams: (...args: unknown[]) => fetchStreamsMock(...args),
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useStreams", () => {
  beforeEach(() => {
    fetchStreamsMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("ignores stale responses that resolve after a newer request", async () => {
    const first = createDeferred<unknown[]>();
    const second = createDeferred<unknown[]>();

    fetchStreamsMock
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);

    const { result, rerender } = renderHook(
      ({ address }: { address: string }) => useStreams(address),
      { initialProps: { address: "GADDRESS_ONE" } },
    );

    // Trigger a second request by changing the address while the first is in flight.
    rerender({ address: "GADDRESS_TWO" });

    await waitFor(() => {
      expect(fetchStreamsMock).toHaveBeenCalledTimes(2);
    });

    const newerData = [{ id: "newer" }];
    const staleData = [{ id: "stale" }];

    // Resolve the newer request first, then the stale one out of order.
    second.resolve(newerData);
    await waitFor(() => {
      expect(result.current.streams).toEqual(newerData);
    });

    first.resolve(staleData);

    // Give the stale promise a chance to settle and attempt to set state.
    await Promise.resolve();
    await Promise.resolve();

    expect(result.current.streams).toEqual(newerData);
  });
});

describe("useStreams pagination and visibility refetch", () => {
  const fetchStreamsBySenderPageMock = vi.fn();
  const fetchStreamsByRecipientPageMock = vi.fn();

  vi.mock("../lib/api", () => ({
    fetchStreamsBySenderPage: (...args: unknown[]) => fetchStreamsBySenderPageMock(...args),
    fetchStreamsByRecipientPage: (...args: unknown[]) => fetchStreamsByRecipientPageMock(...args),
    isApiConfigured: () => true,
  }));

  beforeEach(() => {
    fetchStreamsBySenderPageMock.mockReset();
    fetchStreamsByRecipientPageMock.mockReset();
  });

  it("loads the first page, then fetches the next page via loadMore", async () => {
    const page1 = { streams: [{ id: "a" }, { id: "b" }], total: 3, hasMore: true };
    const page2 = { streams: [{ id: "c" }], total: 3, hasMore: false };
    fetchStreamsBySenderPageMock.mockResolvedValueOnce(page1).mockResolvedValueOnce(page2);

    const { useStreams } = await import("./useStreams");
    const { result } = renderHook(() => useStreams("GADDRESS", "sender"));

    await waitFor(() => expect(result.current.streams).toEqual(page1.streams));
    expect(result.current.hasMore).toBe(true);
    expect(result.current.total).toBe(3);

    await result.current.loadMore();

    await waitFor(() => expect(result.current.streams).toEqual([...page1.streams, ...page2.streams]));
    expect(result.current.hasMore).toBe(false);
    expect(fetchStreamsBySenderPageMock).toHaveBeenNthCalledWith(2, "GADDRESS", 2);
  });

  it("refetches on visibilitychange once visible again after being stale", async () => {
    const firstPage = { streams: [{ id: "a" }], total: 1, hasMore: false };
    const refetchedPage = { streams: [{ id: "a" }, { id: "b" }], total: 2, hasMore: false };
    fetchStreamsByRecipientPageMock.mockResolvedValueOnce(firstPage).mockResolvedValueOnce(refetchedPage);

    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(0);
    const { useStreams } = await import("./useStreams");
    const { result } = renderHook(() => useStreams("GADDRESS", "recipient"));

    await waitFor(() => expect(result.current.streams).toEqual(firstPage.streams));

    // 31s later (> the 30s staleness threshold) and visible again: should refetch.
    nowSpy.mockReturnValue(31_000);
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    document.dispatchEvent(new Event("visibilitychange"));

    await waitFor(() => expect(result.current.streams).toEqual(refetchedPage.streams));
    expect(fetchStreamsByRecipientPageMock).toHaveBeenCalledTimes(2);
    nowSpy.mockRestore();
  });

  it("does not refetch on visibilitychange when the tab is hidden, or when not yet stale", async () => {
    const firstPage = { streams: [{ id: "a" }], total: 1, hasMore: false };
    fetchStreamsByRecipientPageMock.mockResolvedValueOnce(firstPage);

    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(0);
    const { useStreams } = await import("./useStreams");
    const { result } = renderHook(() => useStreams("GADDRESS", "recipient"));

    await waitFor(() => expect(result.current.streams).toEqual(firstPage.streams));

    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchStreamsByRecipientPageMock).toHaveBeenCalledTimes(1);

    // Visible again, but well under the staleness threshold: still no refetch.
    nowSpy.mockReturnValue(5_000);
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchStreamsByRecipientPageMock).toHaveBeenCalledTimes(1);

    nowSpy.mockRestore();
  });
});