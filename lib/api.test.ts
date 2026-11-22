import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchPlatformStats, fetchStreamsBySender } from "./api";
import { fixtureStreams } from "./testing/handlers";

const BASE = "https://api.test.local";

function jsonResponse(body: unknown, total?: number): Response {
  const headers = new Headers({ "content-type": "application/json" });
  if (total !== undefined) headers.set("x-total-count", String(total));
  return new Response(JSON.stringify(body), { status: 200, headers });
}

describe("fetchStreamsBySender pagination", () => {
  const originalEnv = process.env.NEXT_PUBLIC_API_BASE_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = BASE;
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = originalEnv;
    vi.restoreAllMocks();
  });

  it("fetches streams from MSW handler with correct pagination", async () => {
    const streams = await fetchStreamsBySender("GSENDER");

    expect(streams).toHaveLength(fixtureStreams.length);
    expect(streams.map((s) => s.id)).toEqual(fixtureStreams.map((v) => v.id));
  });

  it("maps fixture data to Stream objects with correct token info", async () => {
    const streams = await fetchStreamsBySender("GSENDER");

    const firstStream = streams[0];
    expect(firstStream.id).toBe("1");
    expect(firstStream.sender).toBe(fixtureStreams[0].sender);
    expect(firstStream.recipient).toBe(fixtureStreams[0].recipient);
    expect(firstStream.totalAmount).toBe(fixtureStreams[0].total_amount);
    expect(firstStream.withdrawnAmount).toBe(fixtureStreams[0].withdrawn);
    expect(firstStream.status).toMatch(/active|cliff|scheduled|completed|cancelled/);
  });
});

describe("transient failure retry with backoff", () => {
  const originalEnv = process.env.NEXT_PUBLIC_API_BASE_URL;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  const validStats = { total_streams: 1, active_streams: 1, total_streamed: "1", total_withdrawn: "0" };

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = BASE;
    vi.useFakeTimers();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = originalEnv;
    fetchSpy?.mockRestore();
    vi.useRealTimers();
  });

  it("retries a 503 up to twice, with backoff, and succeeds once the transient failure clears", async () => {
    let calls = 0;
    fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async () => {
      calls++;
      return calls < 3 ? new Response(null, { status: 503 }) : jsonResponse(validStats, 1);
    });

    const promise = fetchPlatformStats();
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(calls).toBe(3);
    expect(result).not.toBeNull();
  });

  it("gives up after exhausting retries on a persistent 502 and surfaces no data", async () => {
    let calls = 0;
    fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async () => {
      calls++;
      return new Response(null, { status: 502 });
    });

    const promise = fetchPlatformStats();
    await vi.runAllTimersAsync();
    const result = await promise;

    // 1 initial attempt + 2 retries, all exhausted.
    expect(calls).toBe(3);
    expect(result).toBeNull();
  });

  it("retries a network error the same way as a transient status", async () => {
    let calls = 0;
    fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async () => {
      calls++;
      if (calls < 2) throw new TypeError("network error");
      return jsonResponse(validStats, 1);
    });

    const promise = fetchPlatformStats();
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(calls).toBe(2);
    expect(result).not.toBeNull();
  });

  it("does not retry a 404 — it fails on the first attempt", async () => {
    let calls = 0;
    fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async () => {
      calls++;
      return new Response(null, { status: 404 });
    });

    const promise = fetchPlatformStats();
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(calls).toBe(1);
    expect(result).toBeNull();
  });

  it("does not retry a 400 — it fails on the first attempt", async () => {
    let calls = 0;
    fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async () => {
      calls++;
      return new Response(null, { status: 400 });
    });

    const promise = fetchPlatformStats();
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(calls).toBe(1);
    expect(result).toBeNull();
  });
});
