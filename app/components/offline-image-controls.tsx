"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import {
  clearOfflineImages,
  countOfflineImages,
  getOfflineImageDownloadState,
  resetOfflineImageDownloadState,
  startOfflineImagesDownload,
  subscribeToOfflineImageDownload,
} from "@/app/lib/offline-card-images";
import { useSiteLanguage } from "@/app/lib/site-language";

function imageCountLabel(count: number, language: "fr" | "en") {
  return `${count.toLocaleString(language === "en" ? "en-GB" : "fr-FR")} ${language === "en" ? `image${count === 1 ? "" : "s"}` : `image${count > 1 ? "s" : ""}`}`;
}

export function OfflineImageControls({ imageUrls }: { imageUrls: readonly (string | null | undefined)[] }) {
  const { language } = useSiteLanguage();
  const en = language === "en";
  const urls = useMemo(() => [...new Set(imageUrls.filter((url): url is string => Boolean(url?.startsWith("http"))))], [imageUrls]);
  const [cachedCount, setCachedCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const state = useSyncExternalStore(subscribeToOfflineImageDownload, getOfflineImageDownloadState, getOfflineImageDownloadState);

  useEffect(() => {
    let active = true;
    void Promise.resolve()
      .then(() => countOfflineImages(urls))
      .then((count) => {
        if (active) setCachedCount(count);
      })
      .catch(() => {
        if (active) setCachedCount(0);
      });
    return () => {
      active = false;
    };
  }, [urls]);

  const downloadImages = () => {
    setShowWarning(false);
    if (!navigator.onLine) return;
    void startOfflineImagesDownload(urls);
  };

  const clearImages = async () => {
    try {
      await clearOfflineImages();
      setCachedCount(0);
      resetOfflineImageDownloadState();
    } catch {
      // The visible count remains unchanged if the local cache cannot be removed.
    }
  };

  const isDownloading = state.kind === "downloading";
  const progress = isDownloading && state.total > 0 ? Math.round((state.completed / state.total) * 100) : 0;
  const displayedCachedCount = state.kind === "downloading" || state.kind === "success" ? state.available ?? cachedCount : cachedCount;
  const downloadLabel = isDownloading
    ? state.available === null
      ? (en ? "Preparing download…" : "Préparation du téléchargement…")
      : (en ? `Download in progress… ${state.completed} / ${state.total}` : `Téléchargement en cours… ${state.completed} / ${state.total}`)
    : (en ? "Download images" : "Télécharger les images");

  return <section className="collection-offline-images" aria-labelledby="offline-images-title">
    <div>
      <p className="eyebrow">{en ? "Offline mode" : "Mode hors ligne"}</p>
      <h2 id="offline-images-title">{en ? "Card images" : "Images des cartes"}</h2>
      <p>{en ? "Keep card images on this device to view them without a connection." : "Conserve les visuels sur cet appareil pour les consulter sans connexion."}</p>
      <small>{en ? `Currently, ${imageCountLabel(displayedCachedCount, language)} of ${imageCountLabel(urls.length, language)} are saved for offline use.` : `Actuellement, ${imageCountLabel(displayedCachedCount, language)} sur ${imageCountLabel(urls.length, language)} sont enregistrées pour le mode hors ligne.`}</small>
    </div>
    <div className="collection-offline-images-actions">
      <button type="button" onClick={() => setShowWarning(true)} disabled={isDownloading || !urls.length}>{downloadLabel}</button>
      <button type="button" className="secondary" onClick={() => void clearImages()} disabled={isDownloading || !displayedCachedCount}>{en ? "Clear image cache" : "Vider le cache des images"}</button>
    </div>
    {isDownloading ? <div className="collection-offline-progress" aria-label={en ? `Download: ${progress} %` : `Téléchargement : ${progress} %`}><span><b style={{ width: `${progress}%` }} /></span><small>{en ? `${imageCountLabel(state.completed, language)} of ${imageCountLabel(state.total, language)}` : `${imageCountLabel(state.completed, language)} sur ${imageCountLabel(state.total, language)}`}</small></div> : null}
    {state.kind === "success" ? <p className="collection-offline-message is-success">{en ? `${imageCountLabel(state.downloaded, language)} downloaded${state.failed ? ` · ${imageCountLabel(state.failed, language)} unavailable` : ""}.` : `${imageCountLabel(state.downloaded, language)} téléchargées${state.failed ? ` · ${imageCountLabel(state.failed, language)} indisponibles` : ""}.`}</p> : null}
    {state.kind === "error" ? <p className="collection-offline-message is-error">{en ? "The offline images could not be downloaded. Please try again." : state.message}</p> : null}
    {showWarning ? createPortal(<div className="collection-confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowWarning(false); }}><section className="collection-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="offline-images-warning-title"><p className="eyebrow">{en ? "Offline mode" : "Mode hors ligne"}</p><h2 id="offline-images-warning-title">{en ? "Download images?" : "Télécharger les images ?"}</h2><p>{en ? "The download may use a large amount of mobile data and phone storage. To avoid charges, enable Wi‑Fi before continuing." : "Le téléchargement peut utiliser beaucoup de données mobiles et occuper de l’espace sur ton téléphone. Pour éviter des frais, active le Wi‑Fi avant de continuer."}</p><div><button type="button" className="secondary" onClick={() => setShowWarning(false)}>{en ? "Cancel" : "Annuler"}</button><button type="button" onClick={downloadImages}>{en ? "Download anyway" : "Télécharger quand même"}</button></div></section></div>, document.body) : null}
  </section>;
}
