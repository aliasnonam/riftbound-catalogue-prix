"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { HeroCardArtwork } from "@/app/components/hero/HeroCardArtwork";
import type { HeroPreviewCard } from "@/app/components/hero/types";
import { useGalleryNavigation } from "@/app/components/galleries/use-gallery-navigation";
import { useSiteLanguage } from "@/app/lib/site-language";

export function OriginsGallery({
  cards,
  initialIndex,
  onClose,
}: {
  cards: readonly HeroPreviewCard[];
  initialIndex: number;
  onClose: () => void;
}) {
  const { language } = useSiteLanguage();
  const en = language === "en";
  const closeRef = useRef<HTMLButtonElement>(null);
  const { activeIndex: index, progressRef, setActiveSlide, showPrevious, showNext, stagePointerHandlers } = useGalleryNavigation(cards.length, initialIndex);
  const card = cards[index];

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => {
      closeRef.current?.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowLeft") showPrevious();
      else if (event.key === "ArrowRight") showNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [onClose, showNext, showPrevious]);

  return createPortal(
    <div className="origins-gallery-backdrop" role="presentation" onPointerDown={onClose}>
      <section
        className="origins-gallery-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={en ? "Origins gallery of 12 signed Outnumbered cards" : "Galerie des 12 cartes signées Outnumbered d’Origins"}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="origins-gallery-header">
          <div>
            <span>{en ? "Origins · Signed Outnumbered" : "Origins · Signées Outnumbered"}</span>
            <strong>{index + 1} / {cards.length}</strong>
          </div>
          <button ref={closeRef} className="origins-gallery-close" type="button" aria-label={en ? "Close gallery" : "Fermer la galerie"} onClick={onClose}>×</button>
        </header>
        <div
          className="origins-gallery-stage"
          {...stagePointerHandlers}
        >
          <button className="origins-gallery-arrow origins-gallery-arrow--previous" type="button" aria-label={en ? "Previous card" : "Carte précédente"} onClick={showPrevious}>‹</button>
          <div className="origins-gallery-artwork" key={card.number}><HeroCardArtwork card={card} /></div>
          <button className="origins-gallery-arrow origins-gallery-arrow--next" type="button" aria-label={en ? "Next card" : "Carte suivante"} onClick={showNext}>›</button>
        </div>
        <footer className="origins-gallery-footer">
          <p><strong>{card.number}</strong><span>{card.name}</span></p>
          <div ref={progressRef} className="origins-gallery-progress" aria-label={(en ? "Card " : "Carte ") + (index + 1) + (en ? " of " : " sur ") + cards.length}>
            {cards.map((galleryCard, cardIndex) => (
              <button className={cardIndex === index ? "is-active" : ""} type="button" tabIndex={cardIndex === index ? 0 : -1} data-gallery-slide={cardIndex} aria-label={(en ? "Show " : "Afficher ") + galleryCard.number + " " + galleryCard.name} aria-current={cardIndex === index ? "true" : undefined} onClick={() => setActiveSlide(cardIndex)} key={galleryCard.number} />
            ))}
          </div>
          <small>{en ? "Arrow keys on desktop · swipe horizontally on mobile" : "Flèches sur ordinateur · balayage horizontal sur mobile"}</small>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
