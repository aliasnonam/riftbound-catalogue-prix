"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";

import { CardPreviewThumb } from "@/app/components/catalog/CardPreview";
import { useSiteLanguage } from "@/app/lib/site-language";
import { findCardFromDetectedText, findCardFromScan, parseCardScanText, type ResolvedCardScan } from "@/lib/card-scan";
import type { CollectionImpression } from "@/lib/collection";
import { getPrimaryVariantPrice, type PriceMode } from "@/lib/pricing";
import {
  calculatePriceDifference,
  calculatePriceDifferencePercent,
  createPurchaseSession,
  createPurchaseSessionItem,
  getPurchasePriceTone,
  normaliseSellerPrice,
} from "@/lib/purchase-sessions";
import { useCollection } from "@/hooks/use-collection";
import { usePurchaseSessions } from "@/hooks/use-purchase-sessions";

const FRAME_INTERVAL_MS = 650;
const EURO = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });

type ReaderState = "starting" | "scanning" | "error";
type CachedPriceStatus = { updatedAt?: string };
type ZoomRange = { min: number; max: number; step: number };
type CameraTrack = MediaStreamTrack & { getCapabilities?: () => MediaTrackCapabilities & { zoom?: ZoomRange; focusMode?: string[] }; applyConstraints: (constraints: MediaTrackConstraints) => Promise<void> };

export function PurchaseMode({ impressions }: { impressions: CollectionImpression[] }) {
  const { language } = useSiteLanguage();
  const en = language === "en";
  const purchases = usePurchaseSessions();
  const [showCreate, setShowCreate] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  if (!Capacitor.isNativePlatform()) return null;

  const activeSession = purchases.sessions.find((session) => session.id === activeSessionId) ?? null;
  const begin = () => {
    const session = createPurchaseSession(sessionName);
    purchases.create(session);
    setSessionName("");
    setShowCreate(false);
    setActiveSessionId(session.id);
  };

  return <section className="purchase-mode-entry" aria-labelledby="purchase-mode-title">
    <div>
      <p className="eyebrow">{en ? "Purchase mode" : "Mode achat"}</p>
      <h2 id="purchase-mode-title">{en ? "Scan at a seller" : "Scanner chez un vendeur"}</h2>
      <p>{en ? "Browse a binder or a stand with the camera open and compare each card with your collection and its reference price." : "Parcours un classeur ou un stand avec la caméra ouverte et compare chaque carte avec ta collection et son prix de référence."}</p>
    </div>
    <button type="button" onClick={() => setShowCreate(true)}>{en ? "Start a potential purchase" : "Démarrer un achat potentiel"}</button>
    {showCreate ? <div className="collection-confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowCreate(false); }}>
      <section className="purchase-session-create" role="dialog" aria-modal="true" aria-labelledby="purchase-session-create-title">
        <p className="eyebrow">{en ? "Purchase mode" : "Mode achat"}</p>
        <h2 id="purchase-session-create-title">{en ? "Create a session" : "Créer une session"}</h2>
        <p>{en ? "Give this seller or event a name. You can leave it blank to use the date and time." : "Donne un nom à ce vendeur ou cet évènement. Tu peux le laisser vide pour utiliser la date et l’heure."}</p>
        <label>{en ? "Session name" : "Nom de la session"}<input autoFocus value={sessionName} onChange={(event) => setSessionName(event.target.value)} placeholder={en ? "For example: Lille card fair" : "Exemple : Braderie Lille"} /></label>
        <div><button type="button" className="secondary" onClick={() => setShowCreate(false)}>{en ? "Cancel" : "Annuler"}</button><button type="button" onClick={begin}>{en ? "Open camera" : "Ouvrir la caméra"}</button></div>
      </section>
    </div> : null}
    {activeSession ? <ContinuousPurchaseScanner sessionId={activeSession.id} sessionItems={activeSession.items.map((item) => item.impressionId)} impressions={impressions} onClose={() => setActiveSessionId(null)} /> : null}
  </section>;
}

function ContinuousPurchaseScanner({ sessionId, sessionItems, impressions, onClose }: { sessionId: string; sessionItems: string[]; impressions: CollectionImpression[]; onClose: () => void }) {
  const collection = useCollection();
  const purchases = usePurchaseSessions();
  const { language } = useSiteLanguage();
  const en = language === "en";
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  const workingRef = useRef(false);
  const lastDetectedIdRef = useRef<string | null>(null);
  const [readerState, setReaderState] = useState<ReaderState>("starting");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<ResolvedCardScan | null>(null);
  const [priceMode, setPriceMode] = useState<PriceMode>("low");
  const [sellerInput, setSellerInput] = useState("");
  const [added, setAdded] = useState(false);
  const [priceUpdatedAt, setPriceUpdatedAt] = useState<string | null>(null);
  const [zoomRange, setZoomRange] = useState<ZoomRange | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const readStatus = () => {
      try {
        const value = JSON.parse(window.sessionStorage.getItem("riftbound-price-sync-status") ?? "null") as CachedPriceStatus | null;
        setPriceUpdatedAt(value?.updatedAt && Number.isFinite(Date.parse(value.updatedAt)) ? value.updatedAt : null);
      } catch { setPriceUpdatedAt(null); }
    };
    readStatus();
    window.addEventListener("riftbound:price-sync-status", readStatus);
    return () => window.removeEventListener("riftbound:price-sync-status", readStatus);
  }, []);

  const stopCamera = () => {
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    intervalRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      try {
        const { Camera } = await import("@capacitor/camera");
        const current = await Camera.checkPermissions();
        const permission = current.camera === "granted" ? current : await Camera.requestPermissions({ permissions: ["camera"] });
        if (permission.camera !== "granted") throw new Error("permission");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 3840 },
            height: { ideal: 2160 },
            aspectRatio: { ideal: 9 / 16 },
          },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((track) => track.stop()); return; }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0] as CameraTrack | undefined;
        const capabilities = track?.getCapabilities?.();
        if (capabilities?.zoom) {
          setZoomRange(capabilities.zoom);
          setZoom(Math.max(capabilities.zoom.min, Math.min(1, capabilities.zoom.max)));
        }
        // These are best-effort settings: Android applies them only when the
        // camera exposes the capability, without degrading compatible devices.
        void track?.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] }).catch(() => undefined);
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        if (cancelled) return;
        setReaderState("scanning");
        const analyseFrame = async () => {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (!video || !canvas || workingRef.current || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
          workingRef.current = true;
          try {
            const width = video.videoWidth;
            const height = video.videoHeight;
            if (!width || !height) return;
            // The OCR crop has the physical 63:88 card ratio and includes the
            // entire bottom line instead of using the wide camera frame.
            const cardRatio = 63 / 88;
            let sourceHeight = Math.round(height * 0.86);
            let sourceWidth = Math.round(sourceHeight * cardRatio);
            if (sourceWidth > width * 0.86) {
              sourceWidth = Math.round(width * 0.86);
              sourceHeight = Math.round(sourceWidth / cardRatio);
            }
            const sourceX = Math.round((width - sourceWidth) / 2);
            const sourceY = Math.round((height - sourceHeight) / 2);
            canvas.width = Math.min(1600, sourceWidth);
            canvas.height = Math.round(canvas.width / cardRatio);
            canvas.getContext("2d")?.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
            const base64Image = canvas.toDataURL("image/jpeg", 0.84).split(",")[1];
            if (!base64Image) return;
            const { CapacitorPluginMlKitTextRecognition } = await import("@pantrist/capacitor-plugin-ml-kit-text-recognition");
            const recognized = await CapacitorPluginMlKitTextRecognition.detectText({ base64Image });
            const parsed = parseCardScanText(recognized.text);
            const resolved = parsed.ok
              ? findCardFromScan(parsed.value, impressions, recognized.text)
              : findCardFromDetectedText(recognized.text, impressions);
            if (resolved.kind !== "match" || resolved.impression.impressionId === lastDetectedIdRef.current) return;
            lastDetectedIdRef.current = resolved.impression.impressionId;
            setResult(resolved);
            setSellerInput("");
            setAdded(sessionItems.includes(resolved.impression.impressionId));
          } catch {
            // OCR misses are expected during movement; keep the live camera usable.
          } finally {
            workingRef.current = false;
          }
        };
        intervalRef.current = window.setInterval(() => { void analyseFrame(); }, FRAME_INTERVAL_MS);
      } catch (error) {
        if (!cancelled) {
          setReaderState("error");
          setMessage(error instanceof Error && error.message === "permission" ? (en ? "Camera access is required for purchase mode." : "L’accès à la caméra est nécessaire pour le mode achat.") : (en ? "The continuous camera could not be started on this device." : "La caméra continue n’a pas pu démarrer sur cet appareil."));
        }
      }
    };
    void start();
    return () => { cancelled = true; stopCamera(); };
  // The scanner owns its stream for its full lifetime. Recreating it only when
  // the session changes keeps the preview fluid while price input changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const match = result?.kind === "match" ? result.impression : null;
  const sellerPrice = normaliseSellerPrice(sellerInput);
  const cardmarketPrice = match ? getPrimaryVariantPrice(match.variant, priceMode) : null;
  const difference = calculatePriceDifference(sellerPrice, cardmarketPrice);
  const differencePercent = calculatePriceDifferencePercent(sellerPrice, cardmarketPrice);
  const owned = match ? collection.isOwned(match.impressionId) : false;
  const tone = getPurchasePriceTone(differencePercent);
  const add = () => {
    if (!match || added) return;
    purchases.addItem(sessionId, createPurchaseSessionItem(match, owned ? "owned" : "missing", priceMode, sellerPrice));
    setAdded(true);
  };
  const updateZoom = (next: number) => {
    const track = streamRef.current?.getVideoTracks()[0] as CameraTrack | undefined;
    setZoom(next);
    void track?.applyConstraints({ advanced: [{ zoom: next } as MediaTrackConstraintSet] }).catch(() => undefined);
  };

  return <div className="purchase-scanner-backdrop" role="presentation">
    <section className="purchase-scanner-dialog" role="dialog" aria-modal="true" aria-labelledby="purchase-scanner-title">
      <button className="collection-scanner-close" type="button" aria-label={en ? "Close purchase mode" : "Fermer le mode achat"} onClick={() => { stopCamera(); onClose(); }}>×</button>
      <p className="eyebrow">{en ? "Purchase mode" : "Mode achat"}</p>
      <h2 id="purchase-scanner-title">{en ? "Scan one card at a time" : "Scanne une carte à la fois"}</h2>
      <div className="purchase-camera-stage">
        <video ref={videoRef} autoPlay muted playsInline />
        <div className="purchase-scan-guide" aria-hidden="true"><span>{en ? "CARD" : "CARTE"}</span></div>
        <p>{readerState === "starting" ? (en ? "Starting camera…" : "Démarrage de la caméra…") : readerState === "error" ? message : (en ? "Move to the next card when it is detected." : "Passe à la carte suivante une fois détectée.")}</p>
      </div>
      {zoomRange ? <label className="purchase-zoom-control">{en ? "Camera zoom" : "Zoom caméra"}<input type="range" min={zoomRange.min} max={zoomRange.max} step={zoomRange.step || 0.1} value={zoom} onChange={(event) => updateZoom(Number(event.target.value))} /><span>×{zoom.toFixed(1)}</span></label> : null}
      <canvas ref={canvasRef} hidden />
      <p className="purchase-privacy">{en ? "Analysis is performed locally. No photo or video is saved." : "Analyse effectuée localement. Aucune photo ni vidéo n’est enregistrée."}</p>
      {match ? <div className="purchase-scan-result">
        <CardPreviewThumb className="purchase-scan-art" imageUrl={match.variant.imageUrl} name={match.row.name} />
        <div className="purchase-scan-result-copy">
          <p className={`purchase-ownership ${owned ? "is-owned" : "is-missing"}`}>{owned ? (en ? "✓ Owned" : "✓ Possédée") : (en ? "✕ Missing" : "✕ Manquante")}</p>
          <h3>{match.row.name}</h3><p>{match.setName} · #{match.variant.number} · {match.variant.rarity}</p>
          <label>{en ? "Reference price" : "Prix Cardmarket"}<select value={priceMode} onChange={(event) => setPriceMode(event.target.value as PriceMode)}><option value="low">{en ? "Lowest price" : "Prix minimum"}</option><option value="trend">{en ? "Cardmarket trend" : "Tendance Cardmarket"}</option><option value="avg30">{en ? "30-day average" : "Moyenne 30 jours"}</option></select><strong>{cardmarketPrice === null ? (en ? "Unavailable" : "Indisponible") : EURO.format(cardmarketPrice)}</strong></label>
          <small className="purchase-price-date">{priceUpdatedAt ? `${en ? "Last price update: " : "Dernière mise à jour du prix : "}${new Intl.DateTimeFormat(language === "en" ? "en-GB" : "fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(priceUpdatedAt))}` : (en ? "Latest price available in the catalogue" : "Dernier prix disponible dans le catalogue")}</small>
          <label>{en ? "Seller price" : "Prix vendeur"}<input inputMode="decimal" type="text" value={sellerInput} onChange={(event) => setSellerInput(event.target.value)} placeholder="30,00 €" /></label>
          {difference !== null && differencePercent !== null ? <p className={`purchase-difference is-${tone}`}><strong>{difference > 0 ? "+" : ""}{EURO.format(difference)}</strong><span>{differencePercent > 0 ? "+" : ""}{differencePercent.toLocaleString(language === "en" ? "en-GB" : "fr-FR", { maximumFractionDigits: 1 })} %</span></p> : null}
          <button type="button" disabled={added} onClick={add}>{added ? (en ? "Already in this purchase" : "Déjà dans cet achat") : (en ? "Add to potential purchase" : "Ajouter à l’achat potentiel")}</button>
        </div>
      </div> : null}
    </section>
  </div>;
}
