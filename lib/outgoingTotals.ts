/**
 * Groups a list of streams by token contract id and sums the outstanding
 * commitment (`totalAmount − withdrawnAmount`) for each token as a BigInt.
 *
 * Used on the Sending page to show the total locked value per token for all
 * live (active / cliff / scheduled) streams.
 */
import type { Stream } from "@/types";

export interface OutgoingTokenTotal {
  contractId: string;
  symbol: string;
  decimals: number;
  /** Sum of `totalAmount - withdrawnAmount` over the supplied streams. */
  amount: bigint;
}

/**
 * Returns one entry per distinct token, in first-seen order.
 * Streams whose `totalAmount` or `withdrawnAmount` cannot be parsed as a
 * BigInt are skipped rather than crashing.
 */
export function groupOutgoingByToken(streams: Stream[]): OutgoingTokenTotal[] {
  const byToken = new Map<string, OutgoingTokenTotal>();

  for (const stream of streams) {
    let outstanding: bigint;
    try {
      outstanding = BigInt(stream.totalAmount) - BigInt(stream.withdrawnAmount);
    } catch {
      continue;
    }

    const existing = byToken.get(stream.token.contractId);
    if (existing) {
      existing.amount += outstanding;
    } else {
      byToken.set(stream.token.contractId, {
        contractId: stream.token.contractId,
        symbol: stream.token.symbol,
        decimals: stream.token.decimals,
        amount: outstanding,
      });
    }
  }

  return [...byToken.values()];
}
