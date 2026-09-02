"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";

import { clearOfflineImages, countOfflineImages, downloadOfflineImages } from "@/app/lib/offline-card-images";

type DownloadState =
  | { kind: "idle" }
  | { kind: "downloading"; completed: number; total: number }
  | { kind: "success"; downloaded: number; failed: number }
  | { kind: "error"; message: string };

function imageCountLabel(count: number) {
  return `${count.toLocaleString("fr-FR")} image${count > 1 ? "s" : ""}`;
}

export function OfflineImageControls({ imageUrls }: { imageUrls: readonly (string | null | undefined)[] }) {
  const urls = useMemo(() => [...new Set(imageUrls.filter((url): url is string => Boolean(url?.startsWith("http"))))], [imageUrls]);
  const [cachedCount, setCachedCount] = useState(0);
  const [state, setState] = useState<DownloadState>({ kind: "idle" });
  const [showWarning, setShowWarning] = useState(false);

  const refreshCachedCount = async () => {
    setCachedCount(await countOfflineImages(urls));
  };

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

  const downloadImages = async () => {
    setShowWarning(false);
    if (!navigator.onLine) {
      setState({ kind: "error", message: "Connexion Internet requise pour télécharger les images." });
      return;
    }

    setState({ kind: "downloading", completed: 0, total: urls.length });
    const { downloaded, failed } = await downloadOfflineImages(urls, (completed) => {
      setState({ kind: "downloading", completed, total: urls.length });
    });
    await refreshCachedCount();
    setState({ kind: "success", downloaded, failed });
  };

  const clearImages = async () => {
    try {
      await clearOfflineImages();
      setCachedCount(0);
      setState({ kind: "idle" });
    } catch {
      setState({ kind: "error", message: "Impossible de vider les images hors ligne." });
    }
  };

  const isDownloading = state.kind === "downloading";
  const progress = isDownloading && state.total > 0 ? Math.round((state.completed / state.total) * 100) : 0;

  return <section className="collection-offline-images" aria-labelledby="offline-images-title">
    <div>
      <p className="eyebrow">Mode hors ligne</p>
      <h2 id="offline-images-title">Images des cartes</h2>
      <p>Conserve les visuels sur cet appareil pour les consulter sans connexion.</p>
      <small>Actuellement, {imageCountLabel(cachedCount)} sur {imageCountLabel(urls.length)} sont enregistrées pour le mode hors ligne.</small>
    </div>
    <div className="collection-offline-images-actions">
      <button type="button" onClick={() => setShowWarning(true)} disabled={isDownloading || !urls.length}>{isDownloading ? `Téléchargement… ${progress} %` : "Télécharger les images"}</button>
      <button type="button" className="secondary" onClick={() => void clearImages()} disabled={isDownloading || !cachedCount}>Vider le cache des images</button>
    </div>
    {isDownloading ? <div className="collection-offline-progress" aria-label={`Téléchargement : ${progress} %`}><span><b style={{ width: `${progress}%` }} /></span><small>{imageCountLabel(state.completed)} sur {imageCountLabel(state.total)}</small></div> : null}
    {state.kind === "success" ? <p className="collection-offline-message is-success">{imageCountLabel(state.downloaded)} téléchargées{state.failed ? ` · ${imageCountLabel(state.failed)} indisponibles` : ""}.</p> : null}
    {state.kind === "error" ? <p className="collection-offline-message is-error">{state.message}</p> : null}
    {showWarning ? createPortal(<div className="collection-confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowWarning(false); }}><section className="collection-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="offline-images-warning-title"><p className="eyebrow">Mode hors ligne</p><h2 id="offline-images-warning-title">Télécharger les images ?</h2><p>Le téléchargement peut utiliser beaucoup de données mobiles et occuper de l’espace sur ton téléphone. Pour éviter des frais, active le Wi‑Fi avant de continuer.</p><div><button type="button" className="secondary" onClick={() => setShowWarning(false)}>Annuler</button><button type="button" onClick={() => void downloadImages()}>Télécharger quand même</button></div></section></div>, document.body) : null}
  </section>;
}
