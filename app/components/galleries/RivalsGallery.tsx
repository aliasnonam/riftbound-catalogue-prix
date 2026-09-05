"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { HeroCardArtwork } from "@/app/components/hero/HeroCardArtwork";
import type { HeroPreviewCard, RivalDiptych } from "@/app/components/hero/types";
import { useGalleryNavigation } from "@/app/components/galleries/use-gallery-navigation";
import { useSiteLanguage } from "@/app/lib/site-language";

export function RivalsGallery({
  catalogCards,
  diptyches,
  onClose,
}: {
  catalogCards: Readonly<Record<number, HeroPreviewCard>>;
  diptyches: readonly RivalDiptych[];
  onClose: () => void;
}) {
  const { language } = useSiteLanguage();
  const en = language === "en";
  const [detailCard, setDetailCard] = useState<HeroPreviewCard | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const { activeIndex: index, progressRef, setActiveSlide, showPrevious: movePrevious, showNext: moveNext, stagePointerHandlers } = useGalleryNavigation(diptyches.length);
  const diptych = diptyches[index];

  const showPrevious = useCallback(() => {
    setDetailCard(null);
    movePrevious();
  }, [movePrevious]);
  const showNext = useCallback(() => {
    setDetailCard(null);
    moveNext();
  }, [moveNext]);
  const openCard = useCallback((side: 0 | 1) => {
    const definition = diptych.cards[side];
    setDetailCard(catalogCards[definition.number] ?? {
      number: String(definition.number), name: definition.name, imageUrl: diptych.imageUrl,
      crop: side === 0 ? "left" : "right",
    });
  }, [catalogCards, diptych]);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => closeRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { if (detailCard) setDetailCard(null); else onClose(); }
      else if (!detailCard && event.key === "ArrowLeft") showPrevious();
      else if (!detailCard && event.key === "ArrowRight") showNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [detailCard, onClose, showNext, showPrevious]);

  return createPortal(
    <div className="rivals-gallery-backdrop" role="presentation" onPointerDown={onClose}>
      <section className="rivals-gallery-dialog" role="dialog" aria-modal="true" aria-label={en ? "Vendetta gallery of 11 Rivals diptychs" : "Galerie des 11 diptyques Rivals de Vendetta"} onPointerDown={(event) => event.stopPropagation()}>
        <header className="rivals-gallery-header">
          <div><span>Vendetta · Rival Overnumbered</span><h2>{detailCard ? detailCard.name : (en ? "The 11 Rivals diptychs" : "Les 11 diptyques Rivals")}</h2></div>
          <button ref={closeRef} className="rivals-gallery-close" type="button" aria-label={en ? "Close gallery" : "Fermer la galerie"} onClick={onClose}>×</button>
        </header>
        {detailCard ? (
          <div className="rivals-card-detail">
            <button className="rivals-back-button" type="button" onClick={() => setDetailCard(null)}><span aria-hidden="true">←</span> {en ? "Back to diptychs" : "Retour aux diptyques"}</button>
            <div className="rivals-card-detail-artwork"><HeroCardArtwork card={detailCard} /></div>
            <p><strong>{detailCard.number}</strong><span>{detailCard.name}</span></p>
          </div>
        ) : (
          <>
            <div className="rivals-gallery-stage" {...stagePointerHandlers}>
              <button className="rivals-gallery-arrow rivals-gallery-arrow--previous" type="button" aria-label={en ? "Previous diptych" : "Diptyque précédent"} onClick={showPrevious}>‹</button>
              <div className="rivals-gallery-slide" key={diptych.imageUrl}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={diptych.imageUrl} alt={`${diptych.cards[0].name} face à ${diptych.cards[1].name}`} draggable="false" />
                {diptych.cards.map((card, side) => (
                  <button className={`rivals-gallery-card-hit rivals-gallery-card-hit--${side === 0 ? "left" : "right"}`} type="button" aria-label={(en ? "Open card details for " : "Ouvrir la fiche de ") + card.name} onClick={() => openCard(side as 0 | 1)} key={card.number}>
                    <span><strong>{card.number}</strong>{card.name}</span>
                  </button>
                ))}
              </div>
              <button className="rivals-gallery-arrow rivals-gallery-arrow--next" type="button" aria-label={en ? "Next diptych" : "Diptyque suivant"} onClick={showNext}>›</button>
            </div>
            <footer className="rivals-gallery-footer">
              <p><strong>{index + 1} / {diptyches.length}</strong><span>{diptych.cards[0].name} / {diptych.cards[1].name}</span></p>
              <div ref={progressRef} className="rivals-gallery-progress" aria-label={(en ? "Navigation between the " : "Navigation entre les ") + diptyches.length + (en ? " Rivals diptychs" : " diptyques Rivals")}>
                {diptyches.map((item, itemIndex) => (
                  <button className={itemIndex === index ? "is-active" : ""} type="button" tabIndex={itemIndex === index ? 0 : -1} data-gallery-slide={itemIndex} aria-label={(en ? "Show diptych " : "Afficher le diptyque ") + (itemIndex + 1) + " : " + item.cards[0].name + " / " + item.cards[1].name} aria-current={itemIndex === index ? "true" : undefined} onClick={() => setActiveSlide(itemIndex)} key={item.imageUrl} />
                ))}
              </div>
              <small>{en ? "Swipe horizontally to navigate" : "Balaye horizontalement pour naviguer"}</small>
            </footer>
          </>
        )}
      </section>
    </div>,
    document.body,
  );
}
