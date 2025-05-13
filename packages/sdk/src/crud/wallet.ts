// deno-lint-ignore-file no-explicit-any
import { fetchAPI } from "../fetcher.ts";

export const getWalletAccount = async () => {
  const response = await fetchAPI({
    segments: ["wallet", "account"],
  });
  return response.json<any>();
};

interface WalletStatement {
  id: string;
  timestamp: string;
  title: string;
  amount: string;
  amountExact: string;
  description?: string;
  type: "credit" | "debit";
  icon?: string;
  metadata?: Record<string, string>;
}

export const getWalletStatements = async (cursor?: string) => {
  const response = await fetchAPI({
    path: `/wallet/statements${cursor ? `?cursor=${cursor}` : ""}`,
  });
  return response.json() as Promise<{
    items: WalletStatement[];
    nextCursor: string;
  }>;
};

export const createWalletCheckoutSession = async (amountInCents: number) => {
  const response = await fetchAPI({
    segments: ["wallet", "checkout"],
    method: "POST",
    body: JSON.stringify({ amountInCents }),
  });
  return response.json() as Promise<{ checkoutUrl: string }>;
};
