import { useSDK } from "@deco/sdk";
import { useCallback } from "react";
import type { VersionEntry, VersionHistoryStore } from "./types.ts";
import {
  createResourceVersionHistoryStore,
  useVersionHistoryActions,
  useVersions,
} from "./store.ts";

export function useAddVersion() {
  const actions = useVersionHistoryActions();
  return actions.addVersion;
}

export function useGetVersions(uri: string): VersionEntry[] {
  return useVersions(uri);
}

export function useRevertToVersion() {
  const actions = useVersionHistoryActions();
  const { locator } = useSDK();
  return useCallback(
    (hash: string) => actions.revertToVersion(hash, locator),
    [actions, locator],
  );
}

export * from "./types.ts";
export * from "./utils.ts";
