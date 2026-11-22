import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { WalletProvider, useWalletContext } from "./WalletProvider";

const TestComponent = () => {
  const wallet = useWalletContext();
  return (
    <div>
      <div data-testid="address">{wallet.publicKey || "not connected"}</div>
      <div data-testid="network">{wallet.network || "unknown"}</div>
    </div>
  );
};

describe("WalletProvider - Freighter watching", () => {
  let mockFreighter: any;

  beforeEach(() => {
    mockFreighter = {
      isConnected: vi.fn().mockResolvedValue(false),
      getPublicKey: vi.fn(),
      getNetwork: vi.fn(),
      watchAccount: vi.fn(),
      watchNetwork: vi.fn(),
    };

    Object.defineProperty(window, "freighter", {
      value: mockFreighter,
      configurable: true,
    });
  });

  afterEach(() => {
    delete (window as any).freighter;
    vi.clearAllMocks();
  });

  it("responds to account changes via watchAccount", async () => {
    const initialAddress = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGSC";
    const newAddress = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBS5H";

    let watchCallback: ((address: string) => void) | null = null;

    mockFreighter.getPublicKey.mockResolvedValue(initialAddress);
    mockFreighter.getNetwork.mockResolvedValue("TESTNET");
    mockFreighter.watchAccount.mockImplementation((cb) => {
      watchCallback = cb;
      return vi.fn();
    });

    const { rerender } = render(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("address")).toHaveTextContent(initialAddress);
    });

    // Simulate account change
    if (watchCallback) {
      watchCallback(newAddress);
    }

    await waitFor(() => {
      expect(screen.getByTestId("address")).toHaveTextContent(newAddress);
    });
  });

  it("responds to network changes via watchNetwork", async () => {
    const address = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGSC";

    let watchCallback: ((network: string) => void) | null = null;

    mockFreighter.getPublicKey.mockResolvedValue(address);
    mockFreighter.getNetwork.mockResolvedValue("TESTNET");
    mockFreighter.watchNetwork.mockImplementation((cb) => {
      watchCallback = cb;
      return vi.fn();
    });

    render(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("network")).toHaveTextContent("TESTNET");
    });

    // Simulate network change
    if (watchCallback) {
      watchCallback("PUBLIC");
    }

    await waitFor(() => {
      expect(screen.getByTestId("network")).toHaveTextContent("PUBLIC");
    });
  });

  it("cleans up listeners on unmount", async () => {
    const unsubscribeAccount = vi.fn();
    const unsubscribeNetwork = vi.fn();

    mockFreighter.getPublicKey.mockResolvedValue("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGSC");
    mockFreighter.getNetwork.mockResolvedValue("TESTNET");
    mockFreighter.watchAccount.mockReturnValue(unsubscribeAccount);
    mockFreighter.watchNetwork.mockReturnValue(unsubscribeNetwork);

    const { unmount } = render(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>
    );

    await waitFor(() => {
      expect(mockFreighter.watchAccount).toHaveBeenCalled();
      expect(mockFreighter.watchNetwork).toHaveBeenCalled();
    });

    unmount();

    await waitFor(() => {
      expect(unsubscribeAccount).toHaveBeenCalled();
      expect(unsubscribeNetwork).toHaveBeenCalled();
    });
  });

  it("falls back to visibilitychange polling when watch API unavailable", async () => {
    const address = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGSC";

    mockFreighter.getPublicKey.mockResolvedValue(address);
    mockFreighter.getNetwork.mockResolvedValue("TESTNET");
    mockFreighter.watchAccount = undefined;
    mockFreighter.watchNetwork = undefined;

    const addEventListenerSpy = vi.spyOn(document, "addEventListener");

    render(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>
    );

    await waitFor(() => {
      expect(addEventListenerSpy).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
    });

    addEventListenerSpy.mockRestore();
  });
});
