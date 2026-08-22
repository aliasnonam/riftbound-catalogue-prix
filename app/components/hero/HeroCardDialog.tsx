"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef } from "react";

import { HeroCardArtwork } from "./HeroCardArtwork";
import type { HeroPreviewCard } from "./types";

export function HeroCardDialog({
  card,
  onClose,
}: {
  card: HeroPreviewCard;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => {
      closeRef.current?.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        event.preventDefault();
        closeRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="card-preview-backdrop hero-card-backdrop"
      role="presentation"
      onPointerDown={onClose}
    >
      <div
        className="card-preview-dialog hero-card-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`Fiche de la carte ${card.name}`}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button
          ref={closeRef}
          className="card-preview-close"
          type="button"
          aria-label="Fermer la fiche"
          onClick={onClose}
        >
          ×
        </button>
        <div className="hero-card-dialog-artwork">
          <HeroCardArtwork card={card} />
        </div>
        <p>
          {card.number ? <strong>{card.number}</strong> : null}
          <span>{card.name}</span>
        </p>
      </div>
    </div>,
    document.body,
  );
}
