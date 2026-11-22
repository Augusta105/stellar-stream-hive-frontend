/**
 * Helpers for computing totals across the sender's active/scheduled streams,
 * grouped by token so the Sending page can show a per-token commitment summary.
 */
import type { Stream } from "@/types";

export interface OutgoingTokenGroup {
  /** Stellar contract address of the token. */
  contractId: string;
  /** Ticker symbol, e.g. "XLM". */
  symbol: string;
  /** Number of decimals the token uses. */
  decimals: number;
  /** Sum of `totalAmount` (base units) across all streams in this group. */
  amount: bigint;
}

/**
 * Groups a list of streams by their token contract and sums the remaining
 * commitment (`totalAmount − withdrawnAmount`) for each token.
 *
 * Only call this with streams that are active / cliff / scheduled — completed
 * and cancelled streams no longer represent locked outgoing value.
 */
export function groupOutgoingByToken(streams: Stream[]): OutgoingTokenGroup[] {
  const map = new Map<string, OutgoingTokenGroup>();

  for (const stream of streams) {
    const { contractId, symbol, decimals } = stream.token;
    const remaining = BigInt(stream.totalAmount) - BigInt(stream.withdrawnAmount);
    const existing = map.get(contractId);
    if (existing) {
      existing.amount += remaining;
    } else {
      map.set(contractId, { contractId, symbol, decimals, amount: remaining });
    }
  }

  return Array.from(map.values());
}
