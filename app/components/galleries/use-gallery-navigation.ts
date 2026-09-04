"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";

const SWIPE_THRESHOLD_PX = 44;
const SUPPRESS_CLICK_FOR_MS = 450;

function normalizeIndex(index: number, length: number) {
  return ((index % length) + length) % length;
}

/**
 * Single source of truth for gallery navigation. Every way of navigating
 * (progress indicator, arrows, keyboard or swipe) updates the same index.
 */
export function useGalleryNavigation(length: number, initialIndex = 0) {
  const [activeIndex, setActiveIndex] = useState(() => normalizeIndex(initialIndex, length));
  const pointerStartRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const suppressClickUntilRef = useRef(0);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const progress = progressRef.current;
    const focusedElement = document.activeElement;
    if (!(focusedElement instanceof HTMLElement) || !progress?.contains(focusedElement)) return;

    // A progress button keeps browser focus after a tap. When the slide then
    // changes by swipe or keyboard, move that focus to the current slide so
    // an old button cannot retain the same visual state as the active one.
    progress.querySelector<HTMLButtonElement>(`button[data-gallery-slide="${activeIndex}"]`)?.focus({ preventScroll: true });
  }, [activeIndex]);

  const setActiveSlide = useCallback((nextIndex: number) => {
    setActiveIndex(normalizeIndex(nextIndex, length));
  }, [length]);

  const showPrevious = useCallback(() => {
    setActiveIndex((current) => normalizeIndex(current - 1, length));
  }, [length]);

  const showNext = useCallback(() => {
    setActiveIndex((current) => normalizeIndex(current + 1, length));
  }, [length]);

  const onPointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    pointerStartRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }, []);

  const onPointerUp = useCallback((event: PointerEvent<HTMLElement>) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start || start.id !== event.pointerId) return;

    const distanceX = event.clientX - start.x;
    const distanceY = event.clientY - start.y;
    const isHorizontalSwipe = Math.abs(distanceX) >= SWIPE_THRESHOLD_PX && Math.abs(distanceX) > Math.abs(distanceY);
    if (!isHorizontalSwipe) return;

    // Mobile browsers can dispatch a click after pointerup. Do not let that
    // second event open a card or change the gallery after a swipe.
    suppressClickUntilRef.current = performance.now() + SUPPRESS_CLICK_FOR_MS;
    if (distanceX > 0) showPrevious(); else showNext();
  }, [showNext, showPrevious]);

  const onPointerCancel = useCallback(() => {
    pointerStartRef.current = null;
  }, []);

  const onClickCapture = useCallback((event: MouseEvent<HTMLElement>) => {
    if (performance.now() >= suppressClickUntilRef.current) return;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  return {
    activeIndex,
    progressRef,
    setActiveSlide,
    showPrevious,
    showNext,
    stagePointerHandlers: { onPointerDown, onPointerUp, onPointerCancel, onClickCapture },
  };
}
