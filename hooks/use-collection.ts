"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  COLLECTION_CHANGE_EVENT,
  COLLECTION_STORAGE_KEY,
  readCollectionState,
  type CollectionState,
  type CollectionStatus,
} from "@/lib/collection";

export function useCollection() {
  const [state, setState] = useState<CollectionState>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = (next?: CollectionState) => {
      setState(next ?? readCollectionState(window.localStorage.getItem(COLLECTION_STORAGE_KEY)));
    };
    const frame = window.requestAnimationFrame(() => {
      sync();
      setReady(true);
    });
    const onStorage = (event: StorageEvent) => {
      if (event.key === COLLECTION_STORAGE_KEY) sync();
    };
    const onChange = (event: Event) => sync((event as CustomEvent<CollectionState>).detail);
    window.addEventListener("storage", onStorage);
    window.addEventListener(COLLECTION_CHANGE_EVENT, onChange);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(COLLECTION_CHANGE_EVENT, onChange);
    };
  }, []);

  const setStatus = useCallback((impressionId: string, status: CollectionStatus | null) => {
    setState((current) => {
      const next = { ...current };
      if (status) next[impressionId] = status;
      else delete next[impressionId];
      window.localStorage.setItem(COLLECTION_STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent(COLLECTION_CHANGE_EVENT, { detail: next }));
      return next;
    });
  }, []);

  return useMemo(() => ({
    ready,
    state,
    getStatus: (impressionId: string) => state[impressionId] ?? "unknown",
    setOwned: (impressionId: string) => setStatus(impressionId, "owned"),
    setMissing: (impressionId: string) => setStatus(impressionId, "missing"),
    clearStatus: (impressionId: string) => setStatus(impressionId, null),
  }), [ready, setStatus, state]);
}
