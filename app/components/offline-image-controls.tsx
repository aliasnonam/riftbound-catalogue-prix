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

function imageCountLabel(count: number) {
  return `${count.toLocaleString("fr-FR")} image${count > 1 ? "s" : ""}`;
}

export function OfflineImageControls({ imageUrls }: { imageUrls: readonly (string | null | undefined)[] }) {
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
      ? "Préparation du téléchargement…"
      : `Téléchargement en cours… ${state.completed} / ${state.total}`
    : "Télécharger les images";

  return <section className="collection-offline-images" aria-labelledby="offline-images-title">
    <div>
      <p className="eyebrow">Mode hors ligne</p>
      <h2 id="offline-images-title">Images des cartes</h2>
      <p>Conserve les visuels sur cet appareil pour les consulter sans connexion.</p>
      <small>Actuellement, {imageCountLabel(displayedCachedCount)} sur {imageCountLabel(urls.length)} sont enregistrées pour le mode hors ligne.</small>
    </div>
    <div className="collection-offline-images-actions">
      <button type="button" onClick={() => setShowWarning(true)} disabled={isDownloading || !urls.length}>{downloadLabel}</button>
      <button type="button" className="secondary" onClick={() => void clearImages()} disabled={isDownloading || !displayedCachedCount}>Vider le cache des images</button>
    </div>
    {isDownloading ? <div className="collection-offline-progress" aria-label={`Téléchargement : ${progress} %`}><span><b style={{ width: `${progress}%` }} /></span><small>{imageCountLabel(state.completed)} sur {imageCountLabel(state.total)}</small></div> : null}
    {state.kind === "success" ? <p className="collection-offline-message is-success">{imageCountLabel(state.downloaded)} téléchargées{state.failed ? ` · ${imageCountLabel(state.failed)} indisponibles` : ""}.</p> : null}
    {state.kind === "error" ? <p className="collection-offline-message is-error">{state.message}</p> : null}
    {showWarning ? createPortal(<div className="collection-confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowWarning(false); }}><section className="collection-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="offline-images-warning-title"><p className="eyebrow">Mode hors ligne</p><h2 id="offline-images-warning-title">Télécharger les images ?</h2><p>Le téléchargement peut utiliser beaucoup de données mobiles et occuper de l’espace sur ton téléphone. Pour éviter des frais, active le Wi‑Fi avant de continuer.</p><div><button type="button" className="secondary" onClick={() => setShowWarning(false)}>Annuler</button><button type="button" onClick={downloadImages}>Télécharger quand même</button></div></section></div>, document.body) : null}
  </section>;
}
