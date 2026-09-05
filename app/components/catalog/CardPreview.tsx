"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";

import { CachedCardImage } from "@/app/components/offline-image";
import { useSiteLanguage } from "@/app/lib/site-language";

type PreviewPlacement = { left: number; top: number; width: number };
type PreviewState = { mode: "hover"; placement: PreviewPlacement } | { mode: "dialog" };

const CARD_ASPECT_RATIO = 63 / 88;

function previewPlacement(rect: DOMRect): PreviewPlacement {
  const margin = 14;
  const gap = 18;
  const maximumWidth = Math.min(430, window.innerWidth - margin * 2);
  const maximumHeight = Math.min(660, window.innerHeight - margin * 2);
  const width = Math.min(maximumWidth, maximumHeight * CARD_ASPECT_RATIO);
  const height = width / CARD_ASPECT_RATIO;
  const left = rect.right + gap + width <= window.innerWidth - margin
    ? rect.right + gap
    : rect.left - gap - width >= margin
      ? rect.left - gap - width
      : Math.min(Math.max(margin, rect.left + rect.width / 2 - width / 2), window.innerWidth - margin - width);
  const top = Math.min(Math.max(margin, rect.top + rect.height / 2 - height / 2), window.innerHeight - margin - height);
  return { left, top, width };
}

export function CardPreviewThumb({ className, imageUrl, name }: { className: string; imageUrl: string | null; name: string }) {
  const { language } = useSiteLanguage();
  const en = language === "en";
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const suppressFocusPreviewRef = useRef(false);

  const failed = failedImageUrl === imageUrl;

  function openHoverPreview() {
    if (!imageUrl || failed || !triggerRef.current) return;
    setPreview({ mode: "hover", placement: previewPlacement(triggerRef.current.getBoundingClientRect()) });
  }
  function closePreview(restoreFocus = false) {
    setPreview(null);
    if (restoreFocus) {
      suppressFocusPreviewRef.current = true;
      window.requestAnimationFrame(() => { triggerRef.current?.focus(); suppressFocusPreviewRef.current = false; });
    }
  }

  useEffect(() => {
    if (!preview) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Tab" && preview.mode === "dialog") { event.preventDefault(); closeRef.current?.focus(); return; }
      if (event.key !== "Escape") return;
      closePreview(preview.mode === "dialog");
    };
    const handleViewportChange = () => { if (preview.mode === "hover") setPreview(null); };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    const previousBodyOverflow = document.body.style.overflow;
    const focusFrame = preview.mode === "dialog" ? window.requestAnimationFrame(() => closeRef.current?.focus()) : 0;
    if (preview.mode === "dialog") document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
      if (focusFrame) window.cancelAnimationFrame(focusFrame);
      if (preview.mode === "dialog") document.body.style.overflow = previousBodyOverflow;
    };
  }, [preview]);

  if (!imageUrl || failed) return <div className={`${className} card-preview-unavailable`}><span aria-hidden="true">◇</span></div>;
  const previewLayer = preview ? createPortal(
    preview.mode === "hover" ? <div className="card-preview-popover" style={preview.placement} role="img" aria-label={(en ? "Enlarged preview of " : "Aperçu agrandi de la carte ") + name}><CachedCardImage src={imageUrl} alt="" /></div> :
      <div className="card-preview-backdrop" role="presentation" onPointerDown={() => closePreview(true)}><div className="card-preview-dialog" role="dialog" aria-modal="true" aria-label={(en ? "Enlarged preview of " : "Aperçu agrandi de la carte ") + name} onPointerDown={(event) => event.stopPropagation()}><button ref={closeRef} className="card-preview-close" type="button" aria-label={en ? "Close preview" : "Fermer l’aperçu"} onClick={() => closePreview(true)}>×</button><CachedCardImage src={imageUrl} alt={(en ? "Card " : "Carte ") + name} /><p>{name}</p></div></div>,
    document.body,
  ) : null;

  return <><button ref={triggerRef} className={`${className} card-preview-trigger`} type="button" aria-label={(en ? "Enlarge card " : "Agrandir la carte ") + name} title={en ? "Hover to enlarge · click to open" : "Survoler pour agrandir · cliquer pour ouvrir"} onPointerEnter={() => { if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) openHoverPreview(); }} onPointerLeave={() => setPreview((current) => current?.mode === "hover" ? null : current)} onFocus={() => { if (!suppressFocusPreviewRef.current && window.matchMedia("(hover: hover) and (pointer: fine)").matches) openHoverPreview(); }} onBlur={() => setPreview((current) => current?.mode === "hover" ? null : current)} onClick={() => setPreview({ mode: "dialog" })}><CachedCardImage src={imageUrl} alt="" loading="lazy" onError={() => { setFailedImageUrl(imageUrl); setPreview(null); }} /><span className="card-preview-icon" aria-hidden="true">⌕</span></button>{previewLayer}</>;
}
