"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  PURCHASE_SESSIONS_CHANGE_EVENT,
  PURCHASE_SESSIONS_STORAGE_KEY,
  PURCHASE_SESSIONS_VERSION,
  addPurchaseSessionItem,
  readPurchaseSessions,
  withPurchaseFinish,
  type PurchaseFinish,
  type PurchaseSession,
  type PurchaseSessionItem,
} from "@/lib/purchase-sessions";
import type { CollectionImpression } from "@/lib/collection";

export function usePurchaseSessions() {
  const [sessions, setSessions] = useState<PurchaseSession[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = (next?: PurchaseSession[]) => setSessions(next ?? readPurchaseSessions(window.localStorage.getItem(PURCHASE_SESSIONS_STORAGE_KEY)).sessions);
    const frame = window.requestAnimationFrame(() => { sync(); setReady(true); });
    const onStorage = (event: StorageEvent) => { if (event.key === PURCHASE_SESSIONS_STORAGE_KEY) sync(); };
    const onChange = (event: Event) => sync((event as CustomEvent<PurchaseSession[]>).detail);
    window.addEventListener("storage", onStorage);
    window.addEventListener(PURCHASE_SESSIONS_CHANGE_EVENT, onChange);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(PURCHASE_SESSIONS_CHANGE_EVENT, onChange);
    };
  }, []);

  const persist = useCallback((next: PurchaseSession[]) => {
    window.localStorage.setItem(PURCHASE_SESSIONS_STORAGE_KEY, JSON.stringify({ version: PURCHASE_SESSIONS_VERSION, sessions: next }));
    window.dispatchEvent(new CustomEvent<PurchaseSession[]>(PURCHASE_SESSIONS_CHANGE_EVENT, { detail: next }));
    setSessions(next);
  }, []);

  const mutate = useCallback((update: (current: PurchaseSession[]) => PurchaseSession[]) => {
    // Several mounted views share this storage. Read the latest state at the
    // action itself, even before this hook's first animation-frame hydration.
    const current = readPurchaseSessions(window.localStorage.getItem(PURCHASE_SESSIONS_STORAGE_KEY)).sessions;
    persist(update(current));
  }, [persist]);

  return useMemo(() => ({
    ready,
    sessions,
    create: (session: PurchaseSession) => mutate((current) => [session, ...current]),
    addItem: (sessionId: string, item: PurchaseSessionItem) => mutate((current) => current.map((session) => session.id === sessionId ? addPurchaseSessionItem(session, item) : session)),
    updateSellerPrice: (sessionId: string, itemId: string, sellerPrice: number | null) => mutate((current) => current.map((session) => session.id === sessionId ? { ...session, items: session.items.map((item) => item.id === itemId ? { ...item, sellerPrice } : item) } : session)),
    updateFinish: (sessionId: string, itemId: string, finish: PurchaseFinish, impression?: CollectionImpression) => mutate((current) => current.map((session) => session.id === sessionId ? { ...session, items: session.items.map((item) => item.id === itemId ? withPurchaseFinish(item, finish, impression) : item) } : session)),
    deleteItem: (sessionId: string, itemId: string) => mutate((current) => current.map((session) => session.id === sessionId ? { ...session, items: session.items.filter((item) => item.id !== itemId) } : session)),
    deleteSession: (sessionId: string) => mutate((current) => current.filter((session) => session.id !== sessionId)),
  }), [mutate, ready, sessions]);
}
