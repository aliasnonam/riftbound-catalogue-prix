"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  COLLECTION_CHANGE_EVENT,
  COLLECTION_STORAGE_KEY,
  getCollectionStatus,
  getCollectionQuantity,
  incrementCollectionQuantity,
  isCollectionOwned,
  readCollectionState,
  withCollectionFoil,
  withCollectionStatus,
  type CollectionState,
  type CollectionStatus,
  type CollectionImpression,
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

  const persist = useCallback((next: CollectionState) => {
    window.localStorage.setItem(COLLECTION_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(COLLECTION_CHANGE_EVENT, { detail: next }));
  }, []);

  const setStatus = useCallback((impressionId: string, status: CollectionStatus) => {
    setState((current) => {
      const next = withCollectionStatus(current, impressionId, status);
      persist(next);
      return next;
    });
  }, [persist]);

  const setFoil = useCallback((impression: CollectionImpression, foil: boolean) => {
    setState((current) => {
      const next = withCollectionFoil(current, impression, foil);
      if (next === current) return current;
      persist(next);
      return next;
    });
  }, [persist]);

  const restore = useCallback((next: CollectionState) => {
    persist(next);
    setState(next);
  }, [persist]);

  const addCopy = useCallback((impressionId: string) => {
    setState((current) => {
      const next = incrementCollectionQuantity(current, impressionId);
      persist(next);
      return next;
    });
  }, [persist]);

  const clear = useCallback(() => {
    persist({});
    setState({});
  }, [persist]);

  return useMemo(() => ({
    ready,
    state,
    getStatus: (impressionId: string) => getCollectionStatus(state, impressionId),
    isOwned: (impressionId: string) => isCollectionOwned(state, impressionId),
    getQuantity: (impressionId: string) => getCollectionQuantity(state, impressionId),
    isFoil: (impression: CollectionImpression) => impression.variant.pricing === "dual"
      && isCollectionOwned(state, impression.impressionId)
      && state[impression.impressionId]?.foil === true,
    setOwned: (impressionId: string) => setStatus(impressionId, "owned"),
    setMissing: (impressionId: string) => setStatus(impressionId, "missing"),
    setFoil,
    addCopy,
    restore,
    clear,
  }), [addCopy, clear, ready, restore, setFoil, setStatus, state]);
}
