"use client";

import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";

import { CardPreviewThumb } from "@/app/components/catalog/CardPreview";
import { ScanCardPrices, ScanFoilOwnership } from "@/app/components/scan-card-details";
import { useSiteLanguage } from "@/app/lib/site-language";
import { PurchaseCamera, type NativePurchaseCamera, type PurchaseCameraDiagnostics } from "@/app/lib/native-purchase-camera";
import type { ResolvedCardScan } from "@/lib/card-scan";
import { getPurchaseCodeCrop, resolvePurchaseCode } from "@/lib/purchase-scan";
import type { CollectionImpression } from "@/lib/collection";
import type { PriceMode } from "@/lib/pricing";
import {
  calculatePriceDifference,
  calculatePriceDifferencePercent,
  createPurchaseSession,
  createPurchaseSessionItem,
  getPurchasePriceTone,
  getPurchasePrice,
  normaliseSellerPrice,
} from "@/lib/purchase-sessions";
import { useCollection } from "@/hooks/use-collection";
import { usePurchaseSessions } from "@/hooks/use-purchase-sessions";

// Disabled by default in every release. Developers can opt in on a local URL
// with ?cameraDebug=1 when inspecting an Android/WebView session remotely.
const CAMERA_DEBUG = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("cameraDebug") === "1";
const EURO = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });

type ReaderState = "starting" | "ready" | "error";
type CachedPriceStatus = { updatedAt?: string };
type ZoomRange = { min: number; max: number; step: number };
type CameraCapabilities = MediaTrackCapabilities & { zoom?: ZoomRange; focusMode?: string[] };
type CameraSettings = MediaTrackSettings & { focusMode?: string; resizeMode?: string; zoom?: number };
type CameraTrack = Omit<MediaStreamTrack, "getCapabilities" | "getSettings" | "applyConstraints"> & { getCapabilities?: () => CameraCapabilities; getSettings?: () => CameraSettings; applyConstraints: (constraints: MediaTrackConstraints) => Promise<void> };
type CameraConstraintSet = MediaTrackConstraintSet & { focusMode?: string; resizeMode?: string; zoom?: number };

const REAR_CAMERA = /back|rear|environment/i;
const SECONDARY_CAMERA = /ultra|macro|tele/i;
const PRIMARY_CAMERA = /main|wide|standard/i;

// Reserve most of the control for the practical card-scanning range: 1x–3x.
const LOW_ZOOM_END = 3;
const LOW_ZOOM_SLIDER_SHARE = 0.78;
const ZOOM_SLIDER_MAX = 1000;

function clampZoom(value: number, range: ZoomRange) {
  return Math.max(range.min, Math.min(value, range.max));
}

function sliderPositionToZoom(position: number, range: ZoomRange) {
  const progress = Math.max(0, Math.min(1, position / ZOOM_SLIDER_MAX));
  const lowEnd = Math.max(range.min, Math.min(LOW_ZOOM_END, range.max));
  if (range.max <= lowEnd || lowEnd <= range.min) return range.min + (range.max - range.min) * progress;
  if (progress <= LOW_ZOOM_SLIDER_SHARE) return range.min + (lowEnd - range.min) * (progress / LOW_ZOOM_SLIDER_SHARE);
  const highProgress = (progress - LOW_ZOOM_SLIDER_SHARE) / (1 - LOW_ZOOM_SLIDER_SHARE);
  return lowEnd * Math.pow(range.max / lowEnd, highProgress);
}

function zoomToSliderPosition(value: number, range: ZoomRange) {
  const zoom = clampZoom(value, range);
  const lowEnd = Math.max(range.min, Math.min(LOW_ZOOM_END, range.max));
  if (range.max <= lowEnd || lowEnd <= range.min) return Math.round(((zoom - range.min) / Math.max(.0001, range.max - range.min)) * ZOOM_SLIDER_MAX);
  if (zoom <= lowEnd) return Math.round(((zoom - range.min) / Math.max(.0001, lowEnd - range.min)) * LOW_ZOOM_SLIDER_SHARE * ZOOM_SLIDER_MAX);
  const highProgress = Math.log(zoom / lowEnd) / Math.log(range.max / lowEnd);
  return Math.round((LOW_ZOOM_SLIDER_SHARE + highProgress * (1 - LOW_ZOOM_SLIDER_SHARE)) * ZOOM_SLIDER_MAX);
}

function roundDisplayedZoom(value: number) {
  return Math.round(value * 10) / 10;
}

function cameraConstraints(deviceId?: string, exactEnvironment = true): MediaTrackConstraints {
  return {
    ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { [exactEnvironment ? "exact" : "ideal"]: "environment" } }),
    // FHD at 30 fps is usually the sharpest/stablest WebView mode on Android.
    // An "ideal" 4K request can select a soft, heavily processed stream.
    width: { min: 1280, ideal: 1920 },
    height: { min: 720, ideal: 1080 },
    frameRate: { ideal: 30, max: 30 },
    resizeMode: "none",
  } as MediaTrackConstraints & CameraConstraintSet;
}

async function waitForVideoDimensions(video: HTMLVideoElement) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (video.videoWidth && video.videoHeight) return;
    await new Promise<void>((resolve) => window.setTimeout(resolve, 50));
  }
}

function logCameraDiagnostics(track: CameraTrack | undefined, video: HTMLVideoElement, devices: MediaDeviceInfo[]) {
  if (!CAMERA_DEBUG) return;
  const settings = track?.getSettings?.();
  const device = devices.find((item) => item.deviceId === settings?.deviceId);
  console.group("[Riftbound purchase scanner] camera diagnostics");
  console.log("device label", device?.label || "unknown");
  console.log("deviceId", settings?.deviceId || "unknown");
  console.log("video dimensions", `${video.videoWidth} × ${video.videoHeight}`);
  console.log("track settings", settings);
  console.log("track capabilities", track?.getCapabilities?.());
  console.log("focusMode", settings?.focusMode || "not reported");
  console.log("frameRate", settings?.frameRate || "not reported");
  console.log("aspectRatio", settings?.aspectRatio || "not reported");
  console.log("resizeMode", settings?.resizeMode || "not reported");
  console.log("zoom", settings?.zoom || "not reported");
  console.groupEnd();
}

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

  return <section className="purchase-mode-entry collection-tools-action-card" aria-labelledby="purchase-mode-title">
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
  const cameraStageRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nativeCameraRef = useRef<NativePurchaseCamera | null>(null);
  const nativeListenerCleanupRef = useRef<(() => void) | null>(null);
  const updateNativeBoundsRef = useRef<(() => void) | null>(null);
  const zoomFrameRef = useRef<number | null>(null);
  const pendingZoomRef = useRef<number | null>(null);
  const workingRef = useRef(false);
  const scanGenerationRef = useRef(0);
  const scanRequestRef = useRef<() => void>(() => {});
  const [scanBusy, setScanBusy] = useState(false);
  const [readerState, setReaderState] = useState<ReaderState>("starting");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<ResolvedCardScan | null>(null);
  const [priceMode, setPriceMode] = useState<PriceMode>("low");
  const [sellerInput, setSellerInput] = useState("");
  const [added, setAdded] = useState(false);
  const [priceUpdatedAt, setPriceUpdatedAt] = useState<string | null>(null);
  const [zoomRange, setZoomRange] = useState<ZoomRange | null>(null);
  const [zoom, setZoom] = useState(1);
  const [previewResolution, setPreviewResolution] = useState<string | null>(null);
  const [cameraBackend, setCameraBackend] = useState<"CameraX" | "Web" | null>(null);
  const [cameraDiagnostics, setCameraDiagnostics] = useState<PurchaseCameraDiagnostics | null>(null);

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
    scanGenerationRef.current += 1;
    workingRef.current = false;
    nativeListenerCleanupRef.current?.();
    nativeListenerCleanupRef.current = null;
    updateNativeBoundsRef.current = null;
    if (zoomFrameRef.current !== null) window.cancelAnimationFrame(zoomFrameRef.current);
    zoomFrameRef.current = null;
    pendingZoomRef.current = null;
    if (nativeCameraRef.current) {
      void nativeCameraRef.current.stop().catch(() => undefined);
      nativeCameraRef.current = null;
      setCameraBackend(null);
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const startNativeCamera = async () => {
    if (Capacitor.getPlatform() !== "android" || !cameraStageRef.current) return false;
    const stage = cameraStageRef.current;
    const options = () => {
      const bounds = stage.getBoundingClientRect();
      return {
        x: bounds.left,
        y: bounds.top,
        width: bounds.width,
        height: bounds.height,
        devicePixelRatio: window.devicePixelRatio || 1,
        viewportScale: window.visualViewport?.scale || 1,
      };
    };
    try {
      const scanListener = await PurchaseCamera.addListener("scanRequested", () => scanRequestRef.current());
      const diagnosticsListener = await PurchaseCamera.addListener("diagnostics", (diagnostics: PurchaseCameraDiagnostics) => {
        setCameraDiagnostics((current) => ({ ...current, ...diagnostics }));
        if (diagnostics.previewWidth && diagnostics.previewHeight) {
          const analysis = diagnostics.analysisWidth && diagnostics.analysisHeight ? ` · OCR ${diagnostics.analysisWidth} × ${diagnostics.analysisHeight}` : "";
          setPreviewResolution(`${diagnostics.previewWidth} × ${diagnostics.previewHeight}${analysis}`);
        }
        if (typeof diagnostics.minZoom === "number" && typeof diagnostics.maxZoom === "number") {
          setZoomRange({ min: diagnostics.minZoom, max: diagnostics.maxZoom, step: 0.1 });
          if (typeof diagnostics.zoom === "number") setZoom(roundDisplayedZoom(diagnostics.zoom));
        }
      });
      const focusListener = await PurchaseCamera.addListener("focusStatus", ({ success }) => {
        setCameraDiagnostics((current) => current ? { ...current, focusSuccess: success } : current);
      });
      nativeListenerCleanupRef.current = () => {
        void scanListener.remove();
        void diagnosticsListener.remove();
        void focusListener.remove();
      };
      nativeCameraRef.current = PurchaseCamera;
      const diagnostics = await PurchaseCamera.start(options());
      setCameraDiagnostics(diagnostics);
      if (diagnostics.previewWidth && diagnostics.previewHeight) {
        const analysis = diagnostics.analysisWidth && diagnostics.analysisHeight ? ` · OCR ${diagnostics.analysisWidth} × ${diagnostics.analysisHeight}` : "";
        setPreviewResolution(`${diagnostics.previewWidth} × ${diagnostics.previewHeight}${analysis}`);
      }
      if (typeof diagnostics.minZoom === "number" && typeof diagnostics.maxZoom === "number") {
        setZoomRange({ min: diagnostics.minZoom, max: diagnostics.maxZoom, step: 0.1 });
        if (typeof diagnostics.zoom === "number") setZoom(roundDisplayedZoom(diagnostics.zoom));
      }
      const updateBounds = () => { void PurchaseCamera.updateBounds(options()).catch(() => undefined); };
      updateNativeBoundsRef.current = updateBounds;
      const scrollContainer = stage.closest(".purchase-scanner-backdrop");
      window.addEventListener("resize", updateBounds);
      window.addEventListener("scroll", updateBounds, { passive: true });
      window.visualViewport?.addEventListener("resize", updateBounds);
      window.visualViewport?.addEventListener("scroll", updateBounds);
      scrollContainer?.addEventListener("scroll", updateBounds, { passive: true });
      window.requestAnimationFrame(updateBounds);
      nativeListenerCleanupRef.current = () => {
        window.removeEventListener("resize", updateBounds);
        window.removeEventListener("scroll", updateBounds);
        window.visualViewport?.removeEventListener("resize", updateBounds);
        window.visualViewport?.removeEventListener("scroll", updateBounds);
        scrollContainer?.removeEventListener("scroll", updateBounds);
        void scanListener.remove();
        void diagnosticsListener.remove();
        void focusListener.remove();
      };
      setCameraBackend("CameraX");
      setReaderState("ready");
      return true;
    } catch {
      nativeListenerCleanupRef.current?.();
      nativeListenerCleanupRef.current = null;
      void PurchaseCamera.stop().catch(() => undefined);
      nativeCameraRef.current = null;
      setCameraDiagnostics(null);
      return false;
    }
  };

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      try {
        const { Camera } = await import("@capacitor/camera");
        const current = await Camera.checkPermissions();
        const permission = current.camera === "granted" ? current : await Camera.requestPermissions({ permissions: ["camera"] });
        if (permission.camera !== "granted") throw new Error("permission");
        // Android uses the native CameraX bridge for preview, continuous AF,
        // tap-to-focus and native zoom. Keep getUserMedia below as the Web
        // fallback only if the bridge is unavailable.
        if (await startNativeCamera()) {
          if (cancelled) stopCamera();
          return;
        }
        // Do not force a portrait aspect ratio: the preview can crop it itself.
        // Start with the standard rear camera at FHD/30, a more reliable
        // autofocus mode in Android WebView than a requested pseudo-4K stream.
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: cameraConstraints(),
            audio: false,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: cameraConstraints(undefined, false),
            audio: false,
          });
        }
        if (cancelled) { stream.getTracks().forEach((track) => track.stop()); return; }
        streamRef.current = stream;
        let track = stream.getVideoTracks()[0] as CameraTrack | undefined;
        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => [] as MediaDeviceInfo[]);
        const selectedSettings = track?.getSettings?.();
        const selectedDevice = devices.find((device) => device.deviceId === selectedSettings?.deviceId);
        const primaryRearDevice = devices
          .filter((device) => device.kind === "videoinput" && REAR_CAMERA.test(device.label) && !SECONDARY_CAMERA.test(device.label))
          .sort((left, right) => Number(PRIMARY_CAMERA.test(right.label)) - Number(PRIMARY_CAMERA.test(left.label)))[0];
        // Switch only when Android explicitly reports a secondary lens and a
        // separate, explicitly named main/wide lens is available. Generic
        // labels are deliberately left alone instead of guessing a deviceId.
        if (selectedDevice && primaryRearDevice && selectedDevice.deviceId !== primaryRearDevice.deviceId && SECONDARY_CAMERA.test(selectedDevice.label) && PRIMARY_CAMERA.test(primaryRearDevice.label)) {
          stream.getTracks().forEach((cameraTrack) => cameraTrack.stop());
          stream = await navigator.mediaDevices.getUserMedia({ video: cameraConstraints(primaryRearDevice.deviceId), audio: false });
          if (cancelled) { stream.getTracks().forEach((cameraTrack) => cameraTrack.stop()); return; }
          streamRef.current = stream;
          track = stream.getVideoTracks()[0] as CameraTrack | undefined;
        }
        const capabilities = track?.getCapabilities?.();
        if (capabilities?.zoom) {
          setZoomRange(capabilities.zoom);
          setZoom(roundDisplayedZoom(Math.max(capabilities.zoom.min, Math.min(1, capabilities.zoom.max))));
        } else {
          setZoomRange(null);
        }
        const settings = track?.getSettings?.();
        setPreviewResolution(settings?.width && settings.height ? `${settings.width} × ${settings.height}` : null);
        // Applying focus mode conditionally avoids restarting tracks on phones
        // that do not expose manual autofocus controls to WebView.
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        if (capabilities?.focusMode?.includes("continuous")) {
          await track?.applyConstraints({ advanced: [{ focusMode: "continuous" } as CameraConstraintSet] }).catch(() => undefined);
        }
        await waitForVideoDimensions(videoRef.current);
        const actualSettings = track?.getSettings?.();
        setPreviewResolution(videoRef.current.videoWidth && videoRef.current.videoHeight ? `${videoRef.current.videoWidth} × ${videoRef.current.videoHeight}` : (actualSettings?.width && actualSettings.height ? `${actualSettings.width} × ${actualSettings.height}` : null));
        logCameraDiagnostics(track, videoRef.current, devices);
        if (cancelled) return;
        setCameraBackend("Web");
        setCameraDiagnostics(null);
        setReaderState("ready");

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
  const cardmarketPrice = match ? getPurchasePrice(match, priceMode, "normal") : null;
  const difference = calculatePriceDifference(sellerPrice, cardmarketPrice);
  const differencePercent = calculatePriceDifferencePercent(sellerPrice, cardmarketPrice);
  const owned = match ? collection.isOwned(match.impressionId) : false;
  const ownedQuantity = match ? collection.getQuantity(match.impressionId) : 0;
  const foilOwned = match ? collection.isFoil(match) : false;
  const tone = getPurchasePriceTone(differencePercent);
  const add = () => {
    if (!match || added) return;
    purchases.addItem(sessionId, createPurchaseSessionItem(match, owned ? "owned" : "missing", ownedQuantity, priceMode, sellerPrice));
    setAdded(true);
  };
  const updateZoom = (next: number) => {
    if (!zoomRange) return;
    const normalized = roundDisplayedZoom(clampZoom(next, zoomRange));
    setZoom(normalized);
    pendingZoomRef.current = normalized;
    if (zoomFrameRef.current !== null) return;
    zoomFrameRef.current = window.requestAnimationFrame(() => {
      zoomFrameRef.current = null;
      const pending = pendingZoomRef.current;
      pendingZoomRef.current = null;
      if (pending === null) return;
      if (nativeCameraRef.current) {
        void nativeCameraRef.current.setZoomRatio({ zoom: pending }).catch(() => undefined);
        return;
      }
      const track = streamRef.current?.getVideoTracks()[0] as CameraTrack | undefined;
      if (track) void track.applyConstraints({ advanced: [{ zoom: pending } as CameraConstraintSet] }).catch(() => undefined);
    });
  };
  const scanCode = async () => {
    if (workingRef.current || readerState !== "ready") return;
    workingRef.current = true;
    const generation = ++scanGenerationRef.current;
    setScanBusy(true);
    setResult(null);
    setSellerInput("");
    setAdded(false);
    setMessage("");
    try {
      let text: string;
      if (nativeCameraRef.current) {
        ({ text } = await nativeCameraRef.current.scan());
      } else {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const stage = cameraStageRef.current;
        if (!video || !canvas || !stage || !video.videoWidth || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) throw new Error("preview");
        const crop = getPurchaseCodeCrop(video.videoWidth, video.videoHeight, stage.clientWidth / stage.clientHeight);
        canvas.width = Math.round(crop.width * 2);
        canvas.height = Math.round(crop.height * 2);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("canvas");
        context.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
        const base64Image = canvas.toDataURL("image/jpeg", 1).split(",")[1];
        const { CapacitorPluginMlKitTextRecognition } = await import("@pantrist/capacitor-plugin-ml-kit-text-recognition");
        ({ text } = await CapacitorPluginMlKitTextRecognition.detectText({ base64Image }));
      }
      if (generation !== scanGenerationRef.current) return;
      const resolved = resolvePurchaseCode(text, impressions);
      if (resolved.kind === "match") {
        setResult(resolved);
        setAdded(sessionItems.includes(resolved.impression.impressionId));
        setMessage(en ? "Card ready. You can add it before scanning another." : "Carte trouvée. Tu peux l’ajouter avant de lancer un autre scan.");
      } else {
        setMessage(en ? "Code unreadable or ambiguous. Place the bottom-left code in the small frame, hold still and try again." : "Code illisible ou ambigu. Place le code en bas à gauche dans le petit cadre, reste immobile et réessaie.");
      }
    } catch {
      if (generation === scanGenerationRef.current) setMessage(en ? "Could not read the code. Hold still, avoid glare and tap Scan again." : "Impossible de lire le code. Reste immobile, évite les reflets et appuie à nouveau sur Scanner.");
    } finally {
      if (generation === scanGenerationRef.current) {
        workingRef.current = false;
        setScanBusy(false);
      }
    }
  };
  useEffect(() => { scanRequestRef.current = () => { void scanCode(); }; });
  useEffect(() => {
    // A detected card inserts the quick-add panel above the native preview.
    // Keep its physical bounds aligned even when the user has not scrolled.
    const frame = window.requestAnimationFrame(() => updateNativeBoundsRef.current?.());
    return () => window.cancelAnimationFrame(frame);
  });

  return <div className="purchase-scanner-backdrop" role="presentation">
    <section className="purchase-scanner-dialog" role="dialog" aria-modal="true" aria-labelledby="purchase-scanner-title">
      <button className="collection-scanner-close" type="button" aria-label={en ? "Close purchase mode" : "Fermer le mode achat"} onClick={() => { stopCamera(); onClose(); }}>×</button>
      <p className="eyebrow">{en ? "Purchase mode" : "Mode achat"}</p>
      <h2 id="purchase-scanner-title">{en ? "Scan one card at a time" : "Scanne une carte à la fois"}</h2>
      <p className="purchase-scan-instructions">{en ? <>Place the <strong>code at the bottom left of the card</strong> (e.g. OGN · 010/298) inside the small highlighted frame. Hold still, then tap <strong>Scan the code</strong> or the camera preview. The result stays until your next scan.</> : <>Place le <strong>code en bas à gauche de la carte</strong> (ex. OGN · 010/298) dans le petit cadre coloré. Reste immobile, puis touche <strong>Scanner le code</strong> ou l’aperçu caméra. Le résultat reste affiché jusqu’au prochain scan.</>}</p>
      {match ? <div className="purchase-quick-add" aria-live="polite">
        <div>
          <p className={`purchase-ownership ${owned ? "is-owned" : "is-missing"}`}>{owned ? (en ? `✓ Owned · ×${ownedQuantity}` : `✓ Possédée · ×${ownedQuantity}`) : (en ? "✕ Missing" : "✕ Manquante")}</p>
          <ScanFoilOwnership variant={match.variant} foilOwned={foilOwned} en={en} />
          <strong>{match.row.name}</strong>
        </div>
        <button type="button" disabled={added} onClick={add}>{added ? (en ? "Added" : "Ajoutée") : (en ? "Quick add" : "Ajout rapide")}</button>
      </div> : null}
      <div ref={cameraStageRef} onClick={() => { if (cameraBackend === "Web") void scanCode(); }} className={`purchase-camera-stage${cameraBackend === "CameraX" ? " is-native-camera" : ""}`}>
        <video ref={videoRef} autoPlay muted playsInline />
        <div className="purchase-scan-guide" aria-hidden="true" /><div className="purchase-code-guide" aria-hidden="true"><span>{en ? "BOTTOM-LEFT CODE" : "CODE EN BAS À GAUCHE"}</span></div>
        <p>{readerState === "starting" ? (en ? "Starting camera…" : "Démarrage de la caméra…") : readerState === "error" ? message : (en ? "Tap to read the code" : "Touche pour lire le code")}</p>
      </div>
      <button type="button" className="purchase-read-code" disabled={scanBusy || readerState !== "ready"} onClick={() => { void scanCode(); }}>{scanBusy ? (en ? "Focusing and reading…" : "Mise au point et lecture…") : (en ? "Scan the code" : "Scanner le code")}</button>
      <p className="purchase-scan-feedback" role="status">{message}</p>
      {CAMERA_DEBUG && previewResolution ? <p className="purchase-camera-quality">{en ? `${cameraBackend === "CameraX" ? "CameraX" : "Live preview"}: ${previewResolution}` : `${cameraBackend === "CameraX" ? "CameraX" : "Aperçu direct"} : ${previewResolution}`}</p> : null}
      {cameraDiagnostics?.debug ? <dl className="purchase-camera-debug">
        <div><dt>{en ? "Backend" : "Backend"}</dt><dd>{cameraDiagnostics.backend}</dd></div>
        <div><dt>{en ? "Camera" : "Caméra"}</dt><dd>{cameraDiagnostics.cameraId || "?"} · {cameraDiagnostics.lens || "?"}</dd></div>
        <div><dt>{en ? "Streams" : "Flux"}</dt><dd>{cameraDiagnostics.previewWidth && cameraDiagnostics.previewHeight ? `${cameraDiagnostics.previewWidth}×${cameraDiagnostics.previewHeight}` : "?"} / OCR {cameraDiagnostics.analysisWidth && cameraDiagnostics.analysisHeight ? `${cameraDiagnostics.analysisWidth}×${cameraDiagnostics.analysisHeight}` : "?"} @{cameraDiagnostics.frameRate ?? "?"} fps</dd></div>
        <div><dt>AF</dt><dd>{cameraDiagnostics.afMode || "?"} · {cameraDiagnostics.afState || "?"}</dd></div>
        <div><dt>AE</dt><dd>{cameraDiagnostics.aeState || "?"}</dd></div>
        <div><dt>{en ? "Zoom" : "Zoom"}</dt><dd>×{cameraDiagnostics.zoom?.toFixed(1) ?? "?"} ({cameraDiagnostics.minZoom?.toFixed(1) ?? "?"}–{cameraDiagnostics.maxZoom?.toFixed(1) ?? "?"})</dd></div>
        <div><dt>{en ? "Manual focus" : "Focus manuel"}</dt><dd>{cameraDiagnostics.focusSuccess === undefined ? "—" : cameraDiagnostics.focusSuccess ? (en ? "success" : "réussi") : (en ? "failed" : "échoué")}</dd></div>
      </dl> : null}
      {zoomRange ? <label className="purchase-zoom-control">{en ? "Native camera zoom" : "Zoom caméra natif"}<input type="range" disabled={scanBusy} min="0" max={ZOOM_SLIDER_MAX} step="1" value={zoomToSliderPosition(zoom, zoomRange)} onChange={(event) => updateZoom(sliderPositionToZoom(Number(event.target.value), zoomRange))} /><span>×{zoom.toFixed(1)}</span></label> : <p className="purchase-camera-quality">{en ? "Move the phone closer until the code is legible inside the small frame." : "Rapproche le téléphone pour que le code soit lisible dans le petit cadre."}</p>}
      <canvas ref={canvasRef} hidden />
      <p className="purchase-privacy">{en ? "Analysis is performed locally. No photo or video is saved." : "Analyse effectuée localement. Aucune photo ni vidéo n’est enregistrée."}</p>
      {match ? <div className="purchase-scan-result">
        <CardPreviewThumb className="purchase-scan-art" imageUrl={match.variant.imageUrl} name={match.row.name} />
        <div className="purchase-scan-result-copy">
          <p className={`purchase-ownership ${owned ? "is-owned" : "is-missing"}`}>{owned ? (en ? `✓ Owned · ×${ownedQuantity}` : `✓ Possédée · ×${ownedQuantity}`) : (en ? "✕ Missing" : "✕ Manquante")}</p>
          <ScanFoilOwnership variant={match.variant} foilOwned={foilOwned} en={en} />
          <h3>{match.row.name}</h3><p>{match.setName} · #{match.variant.number} · {match.variant.rarity}</p>
          <label>{en ? "Reference price" : "Prix Cardmarket"}<select value={priceMode} onChange={(event) => setPriceMode(event.target.value as PriceMode)}><option value="low">{en ? "Lowest price" : "Prix minimum"}</option><option value="trend">{en ? "Cardmarket trend" : "Tendance Cardmarket"}</option><option value="avg30">{en ? "30-day average" : "Moyenne 30 jours"}</option></select></label>
          <ScanCardPrices variant={match.variant} priceMode={priceMode} en={en} />
          <small className="purchase-price-date">{priceUpdatedAt ? `${en ? "Last price update: " : "Dernière mise à jour du prix : "}${new Intl.DateTimeFormat(language === "en" ? "en-GB" : "fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(priceUpdatedAt))}` : (en ? "Latest price available in the catalogue" : "Dernier prix disponible dans le catalogue")}</small>
          <label>{en ? "Seller price" : "Prix vendeur"}<input inputMode="decimal" type="text" value={sellerInput} onChange={(event) => setSellerInput(event.target.value)} placeholder="30,00 €" /></label>
          {match.variant.pricing === "dual" && difference !== null ? <small className="purchase-price-date">{en ? "Compared with: " : "Comparé au prix : "}Normal</small> : null}
          {difference !== null && differencePercent !== null ? <p className={`purchase-difference is-${tone}`}><strong>{difference > 0 ? "+" : ""}{EURO.format(difference)}</strong><span>{differencePercent > 0 ? "+" : ""}{differencePercent.toLocaleString(language === "en" ? "en-GB" : "fr-FR", { maximumFractionDigits: 1 })} %</span></p> : null}
          <button type="button" disabled={added} onClick={add}>{added ? (en ? "Already in this purchase" : "Déjà dans cet achat") : owned ? (en ? "Add anyway" : "Ajouter quand même") : (en ? "Add to potential purchase" : "Ajouter à l’achat potentiel")}</button>
        </div>
      </div> : null}
    </section>
  </div>;
}
