import {
  API_HEADERS,
  API_SERVER_URL,
} from "../constants.ts";

const toPath = (segments: string[]) => segments.join("/");

const fetchAPI = (segments: string[], init?: RequestInit) =>
  fetch(new URL(toPath(segments), API_SERVER_URL), {
    ...init,
    credentials: "include",
    headers: { ...API_HEADERS, ...init?.headers },
  });

export const getWalletAccount = async () => {
  const response = await fetchAPI(["wallet", "account"]);
  return response.json();
};

interface WalletStatement {
  id: string;
  timestamp: string;
  title: string;
  amount: string;
  description?: string;
  type: "credit" | "debit";
  icon?: string;
  metadata?: Record<string, string>;
}

export const getWalletStatements = async (cursor?: string) => {
  const response = await fetchAPI(["wallet", `statements${cursor ? `?cursor=${cursor}` : ""}`]);
  return response.json() as Promise<{
    items: WalletStatement[];
    nextCursor: string;
  }>;
};

export const createWalletCheckoutSession = async (amountInCents: number) => {
  const response = await fetchAPI(["wallet", "checkout"], {
    method: "POST",
    body: JSON.stringify({ amountInCents }),
  });
  return response.json() as Promise<{ checkoutUrl: string }>;
};