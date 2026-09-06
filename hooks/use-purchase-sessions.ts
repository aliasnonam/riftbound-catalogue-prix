"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  PURCHASE_SESSIONS_CHANGE_EVENT,
  PURCHASE_SESSIONS_STORAGE_KEY,
  PURCHASE_SESSIONS_VERSION,
  addPurchaseSessionItem,
  readPurchaseSessions,
  type PurchaseSession,
  type PurchaseSessionItem,
} from "@/lib/purchase-sessions";

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

  return useMemo(() => ({
    ready,
    sessions,
    create: (session: PurchaseSession) => persist([session, ...sessions]),
    addItem: (sessionId: string, item: PurchaseSessionItem) => persist(sessions.map((session) => session.id === sessionId ? addPurchaseSessionItem(session, item) : session)),
    updateSellerPrice: (sessionId: string, itemId: string, sellerPrice: number | null) => persist(sessions.map((session) => session.id === sessionId ? { ...session, items: session.items.map((item) => item.id === itemId ? { ...item, sellerPrice } : item) } : session)),
    deleteItem: (sessionId: string, itemId: string) => persist(sessions.map((session) => session.id === sessionId ? { ...session, items: session.items.filter((item) => item.id !== itemId) } : session)),
    deleteSession: (sessionId: string) => persist(sessions.filter((session) => session.id !== sessionId)),
  }), [persist, ready, sessions]);
}
