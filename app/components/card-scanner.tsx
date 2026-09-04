"use client";

import { useState } from "react";
import { Capacitor } from "@capacitor/core";

import { findCardFromScan, parseCardScanText, type ResolvedCardScan } from "@/lib/card-scan";
import type { CollectionImpression } from "@/lib/collection";
import { useCollection } from "@/hooks/use-collection";

type ScannerState =
  | { step: "idle" }
  | { step: "reading" }
  | { step: "result"; result: ResolvedCardScan; rawText: string }
  | { step: "error"; message: string };

export function CardScanner({ impressions }: { impressions: CollectionImpression[] }) {
  const collection = useCollection();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ScannerState>({ step: "idle" });

  if (!Capacitor.isNativePlatform()) return null;

  const close = () => {
    setOpen(false);
    setState({ step: "idle" });
  };

  const scan = async () => {
    setState({ step: "reading" });
    try {
      const [{ Camera, CameraResultType, CameraSource }, { CapacitorPluginMlKitTextRecognition }] = await Promise.all([
        import("@capacitor/camera"),
        import("@pantrist/capacitor-plugin-ml-kit-text-recognition"),
      ]);
      const permissions = await Camera.checkPermissions();
      const cameraPermission = permissions.camera === "granted" ? permissions : await Camera.requestPermissions({ permissions: ["camera"] });
      if (cameraPermission.camera !== "granted") {
        setState({ step: "error", message: "L’accès à la caméra est nécessaire pour scanner une carte." });
        return;
      }
      const photo = await Camera.getPhoto({
        source: CameraSource.Camera,
        resultType: CameraResultType.Base64,
        quality: 90,
        width: 1800,
        correctOrientation: true,
        saveToGallery: false,
      });
      if (!photo.base64String) throw new Error("image unavailable");
      const recognized = await CapacitorPluginMlKitTextRecognition.detectText({ base64Image: photo.base64String });
      const parsed = parseCardScanText(recognized.text);
      if (!parsed.ok) {
        setState({ step: "error", message: parsed.reason === "ambiguous" ? "Plusieurs codes ont été détectés. Reprends la photo en cadrant le bas gauche de la carte." : "Carte non reconnue. Rapproche le bas gauche de la carte et essaie à nouveau." });
        return;
      }
      setState({ step: "result", result: findCardFromScan(parsed.value, impressions, recognized.text), rawText: recognized.text });
    } catch (error) {
      // Le plugin caméra rejette aussi lorsque l'utilisateur annule : ce n'est pas une erreur du catalogue.
      const message = error instanceof Error && /cancel/i.test(error.message)
        ? "Scan annulé."
        : "Impossible de lire cette carte. Vérifie la lumière et cadre le bas gauche.";
      setState({ step: "error", message });
    }
  };

  const add = (impression: CollectionImpression) => {
    collection.setOwned(impression.impressionId);
    setState({ step: "error", message: `« ${impression.row.name} » est maintenant dans ta collection.` });
  };

  return <section className="collection-scanner" aria-labelledby="collection-scanner-title">
    <div><p className="eyebrow">Collection rapide</p><h2 id="collection-scanner-title">Scanner une carte</h2><p>Utilise la caméra pour lire le code imprimé en bas à gauche. La photo est analysée localement et n’est ni enregistrée ni envoyée.</p></div>
    <button type="button" onClick={() => setOpen(true)}>Scanner une carte</button>
    {open ? <div className="collection-confirm-backdrop scanner-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><section className="collection-scanner-dialog" role="dialog" aria-modal="true" aria-labelledby="scanner-title"><button type="button" className="collection-scanner-close" aria-label="Fermer le scanner" onClick={close}>×</button><p className="eyebrow">Scanner une carte</p><h2 id="scanner-title">Cadre le bas gauche</h2><p>La ligne doit être nette, par exemple <strong>SFD · 227* / 221</strong>.</p><div className="collection-scanner-frame" aria-hidden="true"><span>SFD · 227* / 221</span></div>{state.step === "idle" ? <button type="button" onClick={() => { void scan(); }}>Ouvrir la caméra</button> : null}{state.step === "reading" ? <p className="collection-scanner-status">Lecture locale en cours…</p> : null}{state.step === "error" ? <div className="collection-scanner-feedback"><p>{state.message}</p><button type="button" onClick={() => { void scan(); }}>Scanner à nouveau</button></div> : null}{state.step === "result" ? <ScanResult result={state.result} onAdd={add} onRetry={scan} /> : null}</section></div> : null}
  </section>;
}

function ScanResult({ result, onAdd, onRetry }: { result: ResolvedCardScan; onAdd: (impression: CollectionImpression) => void; onRetry: () => Promise<void> }) {
  if (result.kind === "not-found") return <div className="collection-scanner-feedback"><p>Carte hors catalogue ou numéro illisible.</p><button type="button" onClick={() => { void onRetry(); }}>Scanner à nouveau</button></div>;
  if (result.kind === "ambiguous") return <div className="collection-scanner-feedback"><p>Plusieurs cartes correspondent à ce numéro. Reprends une photo plus nette du code.</p><button type="button" onClick={() => { void onRetry(); }}>Scanner à nouveau</button></div>;
  const { impression, confidence } = result;
  return <div className="collection-scanner-result"><p className="eyebrow">Carte détectée · confiance {confidence === "high" ? "élevée" : "moyenne"}</p><h3>{impression.row.name}</h3><p>{impression.setName} · #{impression.variant.number}</p><div><button type="button" onClick={() => onAdd(impression)}>Ajouter à ma collection</button><button type="button" className="secondary" onClick={() => { void onRetry(); }}>Scanner à nouveau</button></div></div>;
}
