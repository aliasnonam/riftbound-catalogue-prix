"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";

import { CardPreviewThumb } from "@/app/components/catalog/CardPreview";
import { useSiteLanguage } from "@/app/lib/site-language";
import { PurchaseCamera, type NativePurchaseCamera, type PurchaseCameraDiagnostics } from "@/app/lib/native-purchase-camera";
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

// The preview stays the native MediaStream. These values apply only to the
// separate OCR work so it cannot starve the Android WebView's video renderer.
const FRAME_INTERVAL_MS = 850;
const AUTOFOCUS_SETTLE_MS = 850;
const ANALYSIS_MAX_WIDTH = 1280;
// Disabled by default in every release. Developers can opt in on a local URL
// with ?cameraDebug=1 when inspecting an Android/WebView session remotely.
const CAMERA_DEBUG = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("cameraDebug") === "1";
const EURO = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });

type ReaderState = "starting" | "scanning" | "error";
type CachedPriceStatus = { updatedAt?: string };
type ZoomRange = { min: number; max: number; step: number };
type CameraCapabilities = MediaTrackCapabilities & { zoom?: ZoomRange; focusMode?: string[] };
type CameraSettings = MediaTrackSettings & { focusMode?: string; resizeMode?: string; zoom?: number };
type CameraTrack = Omit<MediaStreamTrack, "getCapabilities" | "getSettings" | "applyConstraints"> & { getCapabilities?: () => CameraCapabilities; getSettings?: () => CameraSettings; applyConstraints: (constraints: MediaTrackConstraints) => Promise<void> };
type CameraConstraintSet = MediaTrackConstraintSet & { focusMode?: string; resizeMode?: string; zoom?: number };

const REAR_CAMERA = /back|rear|environment/i;
const SECONDARY_CAMERA = /ultra|macro|tele/i;
const PRIMARY_CAMERA = /main|wide|standard/i;

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
  const intervalRef = useRef<number | null>(null);
  const workingRef = useRef(false);
  const lastDetectedIdRef = useRef<string | null>(null);
  const autofocusReadyAtRef = useRef(0);
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
  const [highDefinitionCapture, setHighDefinitionCapture] = useState(false);
  const [cameraRestart, setCameraRestart] = useState(0);

  const resolveRecognizedText = (detectedText: string, force = false) => {
    const parsed = parseCardScanText(detectedText);
    const resolved = parsed.ok
      ? findCardFromScan(parsed.value, impressions, detectedText)
      : findCardFromDetectedText(detectedText, impressions);
    if (resolved.kind !== "match" || (!force && resolved.impression.impressionId === lastDetectedIdRef.current)) return resolved;
    lastDetectedIdRef.current = resolved.impression.impressionId;
    setResult(resolved);
    setSellerInput("");
    setAdded(sessionItems.includes(resolved.impression.impressionId));
    return resolved;
  };

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
    autofocusReadyAtRef.current = 0;
    nativeListenerCleanupRef.current?.();
    nativeListenerCleanupRef.current = null;
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
      return { x: bounds.left, y: bounds.top, width: bounds.width, height: bounds.height, devicePixelRatio: window.devicePixelRatio || 1 };
    };
    try {
      const textListener = await PurchaseCamera.addListener("textRecognized", ({ text }) => resolveRecognizedText(text));
      const diagnosticsListener = await PurchaseCamera.addListener("diagnostics", (diagnostics: PurchaseCameraDiagnostics) => {
        setCameraDiagnostics((current) => ({ ...current, ...diagnostics }));
        if (diagnostics.previewWidth && diagnostics.previewHeight) {
          const analysis = diagnostics.analysisWidth && diagnostics.analysisHeight ? ` · OCR ${diagnostics.analysisWidth} × ${diagnostics.analysisHeight}` : "";
          setPreviewResolution(`${diagnostics.previewWidth} × ${diagnostics.previewHeight}${analysis}`);
        }
        if (typeof diagnostics.minZoom === "number" && typeof diagnostics.maxZoom === "number") {
          setZoomRange({ min: diagnostics.minZoom, max: diagnostics.maxZoom, step: 0.1 });
          if (typeof diagnostics.zoom === "number") setZoom(diagnostics.zoom);
        }
      });
      const focusListener = await PurchaseCamera.addListener("focusStatus", ({ success }) => {
        setCameraDiagnostics((current) => current ? { ...current, focusSuccess: success } : current);
      });
      nativeListenerCleanupRef.current = () => {
        void textListener.remove();
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
        if (typeof diagnostics.zoom === "number") setZoom(diagnostics.zoom);
      }
      const updateBounds = () => { void PurchaseCamera.updateBounds(options()).catch(() => undefined); };
      const scrollContainer = stage.closest(".purchase-scanner-backdrop");
      window.addEventListener("resize", updateBounds);
      scrollContainer?.addEventListener("scroll", updateBounds, { passive: true });
      nativeListenerCleanupRef.current = () => {
        window.removeEventListener("resize", updateBounds);
        scrollContainer?.removeEventListener("scroll", updateBounds);
        void textListener.remove();
        void diagnosticsListener.remove();
        void focusListener.remove();
      };
      setCameraBackend("CameraX");
      setReaderState("scanning");
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
          setZoom(Math.max(capabilities.zoom.min, Math.min(1, capabilities.zoom.max)));
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
        autofocusReadyAtRef.current = performance.now() + AUTOFOCUS_SETTLE_MS;
        setCameraBackend("Web");
        setCameraDiagnostics(null);
        setReaderState("scanning");
        const analyseFrame = async () => {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (!video || !canvas || workingRef.current || performance.now() < autofocusReadyAtRef.current || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
          workingRef.current = true;
          try {
            const width = video.videoWidth;
            const height = video.videoHeight;
            if (!width || !height) return;
            // The canvas is OCR-only; it does not paint the preview. Keeping
            // it independent avoids lowering the user's live video quality.
            const cardRatio = 63 / 88;
            let sourceHeight = Math.round(height * 0.92);
            let sourceWidth = Math.round(sourceHeight * cardRatio);
            if (sourceWidth > width * 0.92) {
              sourceWidth = Math.round(width * 0.92);
              sourceHeight = Math.round(sourceWidth / cardRatio);
            }
            const sourceX = Math.round((width - sourceWidth) / 2);
            const sourceY = Math.round((height - sourceHeight) / 2);
            // This smaller canvas is OCR-only. It is never assigned to the
            // video element, so reducing its work preserves preview FPS.
            canvas.width = Math.min(ANALYSIS_MAX_WIDTH, sourceWidth);
            canvas.height = Math.round(canvas.width / cardRatio);
            const context = canvas.getContext("2d");
            if (!context) return;
            context.imageSmoothingEnabled = true;
            context.imageSmoothingQuality = "high";
            context.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
            const base64Image = canvas.toDataURL("image/jpeg", 0.88).split(",")[1];
            if (!base64Image) return;
            const { CapacitorPluginMlKitTextRecognition } = await import("@pantrist/capacitor-plugin-ml-kit-text-recognition");
            const recognized = await CapacitorPluginMlKitTextRecognition.detectText({ base64Image });
            resolveRecognizedText(recognized.text);
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
  }, [sessionId, cameraRestart]);

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
    if (!zoomRange) return;
    const min = zoomRange.min;
    const max = zoomRange.max;
    const normalized = Math.max(min, Math.min(next, max));
    setZoom(normalized);
    if (nativeCameraRef.current) {
      void nativeCameraRef.current.setZoomRatio({ zoom: normalized }).catch(() => undefined);
      return;
    }
    const track = streamRef.current?.getVideoTracks()[0] as CameraTrack | undefined;
    if (!track) return;
    void track.applyConstraints({ advanced: [{ zoom: normalized } as CameraConstraintSet] }).catch(() => undefined);
  };
  const scanHighDefinitionPhoto = async () => {
    setHighDefinitionCapture(true);
    setReaderState("starting");
    stopCamera();
    try {
      const [{ Camera, CameraResultType, CameraSource }, { CapacitorPluginMlKitTextRecognition }] = await Promise.all([
        import("@capacitor/camera"),
        import("@pantrist/capacitor-plugin-ml-kit-text-recognition"),
      ]);
      const photo = await Camera.getPhoto({
        source: CameraSource.Camera,
        resultType: CameraResultType.Base64,
        quality: 100,
        correctOrientation: true,
        saveToGallery: false,
      });
      if (!photo.base64String) throw new Error("image unavailable");
      const recognized = await CapacitorPluginMlKitTextRecognition.detectText({ base64Image: photo.base64String });
      const resolved = resolveRecognizedText(recognized.text, true);
      if (resolved.kind !== "match") {
        setMessage(en ? "This photo did not identify one card. Try again with the name or collector line sharp." : "Cette photo n’a pas identifié une seule carte. Réessaie avec le nom ou le code net.");
      }
    } catch (error) {
      if (!(error instanceof Error && /cancel/i.test(error.message))) {
        setMessage(en ? "The HD photo could not be read. Try again in even light without reflections." : "La photo HD n’a pas pu être lue. Réessaie avec une lumière uniforme, sans reflet.");
      }
    } finally {
      setHighDefinitionCapture(false);
      setCameraRestart((value) => value + 1);
    }
  };

  return <div className="purchase-scanner-backdrop" role="presentation">
    <section className="purchase-scanner-dialog" role="dialog" aria-modal="true" aria-labelledby="purchase-scanner-title">
      <button className="collection-scanner-close" type="button" aria-label={en ? "Close purchase mode" : "Fermer le mode achat"} onClick={() => { stopCamera(); onClose(); }}>×</button>
      <p className="eyebrow">{en ? "Purchase mode" : "Mode achat"}</p>
      <h2 id="purchase-scanner-title">{en ? "Scan one card at a time" : "Scanne une carte à la fois"}</h2>
      <div ref={cameraStageRef} className={`purchase-camera-stage${cameraBackend === "CameraX" ? " is-native-camera" : ""}`}>
        <video ref={videoRef} autoPlay muted playsInline />
        <div className="purchase-scan-guide" aria-hidden="true"><span>{en ? "CARD" : "CARTE"}</span></div>
        <p>{readerState === "starting" ? (en ? "Starting camera…" : "Démarrage de la caméra…") : readerState === "error" ? message : (en ? "Move to the next card when it is detected." : "Passe à la carte suivante une fois détectée.")}</p>
      </div>
      {previewResolution ? <p className="purchase-camera-quality">{en ? `${cameraBackend === "CameraX" ? "CameraX" : "Live preview"}: ${previewResolution}` : `${cameraBackend === "CameraX" ? "CameraX" : "Aperçu direct"} : ${previewResolution}`}</p> : null}
      {cameraDiagnostics?.debug ? <dl className="purchase-camera-debug">
        <div><dt>{en ? "Backend" : "Backend"}</dt><dd>{cameraDiagnostics.backend}</dd></div>
        <div><dt>{en ? "Camera" : "Caméra"}</dt><dd>{cameraDiagnostics.cameraId || "?"} · {cameraDiagnostics.lens || "?"}</dd></div>
        <div><dt>{en ? "Streams" : "Flux"}</dt><dd>{cameraDiagnostics.previewWidth && cameraDiagnostics.previewHeight ? `${cameraDiagnostics.previewWidth}×${cameraDiagnostics.previewHeight}` : "?"} / OCR {cameraDiagnostics.analysisWidth && cameraDiagnostics.analysisHeight ? `${cameraDiagnostics.analysisWidth}×${cameraDiagnostics.analysisHeight}` : "?"} @{cameraDiagnostics.frameRate ?? "?"} fps</dd></div>
        <div><dt>AF</dt><dd>{cameraDiagnostics.afMode || "?"} · {cameraDiagnostics.afState || "?"}</dd></div>
        <div><dt>AE</dt><dd>{cameraDiagnostics.aeState || "?"}</dd></div>
        <div><dt>{en ? "Zoom" : "Zoom"}</dt><dd>×{cameraDiagnostics.zoom?.toFixed(1) ?? "?"} ({cameraDiagnostics.minZoom?.toFixed(1) ?? "?"}–{cameraDiagnostics.maxZoom?.toFixed(1) ?? "?"})</dd></div>
        <div><dt>{en ? "Manual focus" : "Focus manuel"}</dt><dd>{cameraDiagnostics.focusSuccess === undefined ? "—" : cameraDiagnostics.focusSuccess ? (en ? "success" : "réussi") : (en ? "failed" : "échoué")}</dd></div>
      </dl> : null}
      {zoomRange ? <label className="purchase-zoom-control">{en ? "Native camera zoom" : "Zoom caméra natif"}<input type="range" min={zoomRange.min} max={zoomRange.max} step={zoomRange.step || 0.1} value={zoom} onChange={(event) => updateZoom(Number(event.target.value))} /><span>×{zoom.toFixed(1)}</span></label> : <p className="purchase-camera-quality">{en ? "This phone does not expose live native zoom. Use the HD photo for the phone camera’s pinch zoom." : "Ce téléphone ne propose pas son zoom natif en direct. Utilise la photo HD pour le zoom pincé de l’appareil photo."}</p>}
      <button type="button" className="purchase-hd-capture" disabled={highDefinitionCapture} onClick={() => { void scanHighDefinitionPhoto(); }}>{highDefinitionCapture ? (en ? "Opening HD camera…" : "Ouverture de la caméra HD…") : (en ? "Take an HD photo (native zoom)" : "Prendre une photo HD (zoom natif)")}</button>
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
