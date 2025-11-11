import { DECO_CMS_API_URL, User } from "@deco/sdk";
import { useCallback, useEffect, useRef } from "react";
import { useLocalStorage } from "./use-local-storage";

export interface StoredAccount {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  lastActive: number; // timestamp
}

const MULTI_ACCOUNT_KEY = "deco:multi-accounts";

export function useMultiAccount(currentUser?: User) {
  const [accounts, setAccounts] = useLocalStorage<StoredAccount[]>(
    MULTI_ACCOUNT_KEY,
    [],
  );
  const lastSavedUserIdRef = useRef<string | null>(null);

  // Auto-add/update current user in accounts when they log in
  useEffect(() => {
    if (!currentUser) return;

    // Only save once per user per session
    if (lastSavedUserIdRef.current === currentUser.id) return;

    lastSavedUserIdRef.current = currentUser.id;

    setAccounts((prev) => {
      const existing = prev.find((acc) => acc.id === currentUser.id);

      const updated: StoredAccount = {
        id: currentUser.id,
        email: currentUser.email,
        full_name: currentUser.metadata?.full_name,
        avatar_url: currentUser.metadata?.avatar_url,
        lastActive: Date.now(),
      };

      if (existing) {
        return prev.map((acc) => (acc.id === currentUser.id ? updated : acc));
      }

      return [...prev, updated];
    });
  }, [currentUser?.id, setAccounts]);

  const removeAccount = useCallback(
    (userId: string) => {
      setAccounts((prev) => prev.filter((acc) => acc.id !== userId));
    },
    [setAccounts],
  );

  const switchAccount = useCallback(
    (account: StoredAccount) => {
      // To switch accounts, we need to log out and redirect to login
      // Browser can only have one session at a time due to cookie-based auth
      const logoutUrl = new URL(DECO_CMS_API_URL);
      logoutUrl.pathname = "/auth/logout";

      const loginUrl = new URL(DECO_CMS_API_URL);
      loginUrl.pathname = "/login/oauth";
      loginUrl.searchParams.set("provider", "google"); // or detect from account
      loginUrl.searchParams.set("login_hint", account.email);
      loginUrl.searchParams.set("prompt", "select_account"); // Force account selector
      loginUrl.searchParams.set("next", window.location.href);

      // Redirect to logout, which will then redirect to login
      logoutUrl.searchParams.set("next", loginUrl.href);

      window.location.href = logoutUrl.href;
    },
    [],
  );

  // Sort by last active, most recent first
  const sortedAccounts = [...accounts].sort(
    (a, b) => b.lastActive - a.lastActive,
  );

  return {
    accounts: sortedAccounts,
    removeAccount,
    switchAccount,
  };
}

