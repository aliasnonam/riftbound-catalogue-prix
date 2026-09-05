"use client";

import { useState } from "react";
import { Capacitor } from "@capacitor/core";

import { CardPreviewThumb } from "@/app/components/catalog/CardPreview";
import { findCardFromScan, parseCardScanText, type ResolvedCardScan } from "@/lib/card-scan";
import type { CollectionImpression } from "@/lib/collection";
import { useCollection } from "@/hooks/use-collection";

type ScannerState =
  | { step: "idle" }
  | { step: "reading" }
  | { step: "result"; result: ResolvedCardScan }
  | { step: "error"; message: string };

const AHRI_EXAMPLE_IMAGE = "/hero/sfd-ahri-signed.webp";

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
        setState({ step: "error", message: parsed.reason === "ambiguous" ? "Plusieurs codes ont été détectés. Reprends la photo en cadrant la carte entière." : "Carte non reconnue. Rapproche la carte et essaie à nouveau." });
        return;
      }
      setState({ step: "result", result: findCardFromScan(parsed.value, impressions, recognized.text) });
    } catch (error) {
      // Le plugin caméra rejette aussi lorsque l'utilisateur annule : ce n'est pas une erreur du catalogue.
      const message = error instanceof Error && /cancel/i.test(error.message)
        ? "Scan annulé."
        : "Impossible de lire cette carte. Vérifie la lumière et cadre la carte entière.";
      setState({ step: "error", message });
    }
  };

  const add = (impression: CollectionImpression) => collection.setOwned(impression.impressionId);

  return <section className="collection-scanner" aria-labelledby="collection-scanner-title">
    <div>
      <p className="eyebrow">Collection rapide</p>
      <h2 id="collection-scanner-title">Scanner une carte</h2>
      <p>Utilise la caméra pour lire une carte. La photo est analysée localement et n’est ni enregistrée ni envoyée.</p>
    </div>
    <button type="button" onClick={() => setOpen(true)}>Scanner une carte</button>
    {open ? <div className="collection-confirm-backdrop scanner-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section className="collection-scanner-dialog" role="dialog" aria-modal="true" aria-labelledby="scanner-title">
        <button type="button" className="collection-scanner-close" aria-label="Fermer le scanner" onClick={close}>×</button>
        <p className="eyebrow">Scanner une carte</p>
        <h2 id="scanner-title">Cadre la carte</h2>
        <p>Prends la carte entière en photo. Le code imprimé en bas à gauche doit rester lisible, par exemple <strong>SFD · 227* / 221</strong>.</p>
        {state.step !== "result" ? <ScannerExample /> : null}
        {state.step === "idle" ? <button type="button" onClick={() => { void scan(); }}>Ouvrir la caméra</button> : null}
        {state.step === "reading" ? <p className="collection-scanner-status">Lecture locale en cours…</p> : null}
        {state.step === "error" ? <div className="collection-scanner-feedback"><p>{state.message}</p><button type="button" onClick={() => { void scan(); }}>Scanner à nouveau</button></div> : null}
        {state.step === "result" ? <ScanResult result={state.result} owned={state.result.kind === "match" && collection.getStatus(state.result.impression.impressionId) === "owned"} onAdd={add} onRetry={scan} /> : null}
      </section>
    </div> : null}
  </section>;
}

function ScannerExample() {
  return <div className="collection-scanner-frame">
    <img src={AHRI_EXAMPLE_IMAGE} alt="Exemple de carte Ahri Inquisitive" />
    <span>SFD · 227* / 221</span>
  </div>;
}

function ScanResult({ result, owned, onAdd, onRetry }: { result: ResolvedCardScan; owned: boolean; onAdd: (impression: CollectionImpression) => void; onRetry: () => Promise<void> }) {
  if (result.kind === "not-found") return <div className="collection-scanner-feedback"><p>Carte hors catalogue ou numéro illisible.</p><button type="button" onClick={() => { void onRetry(); }}>Scanner à nouveau</button></div>;
  if (result.kind === "ambiguous") return <div className="collection-scanner-feedback"><p>Plusieurs cartes correspondent à ce numéro. Reprends une photo plus nette de la carte entière.</p><button type="button" onClick={() => { void onRetry(); }}>Scanner à nouveau</button></div>;
  const { impression, confidence } = result;
  return <div className="collection-scanner-result">
    <p className="eyebrow">Carte détectée · confiance {confidence === "high" ? "élevée" : "moyenne"}</p>
    <div className="collection-scanner-card">
      <CardPreviewThumb className="collection-scanner-art" imageUrl={impression.variant.imageUrl} name={impression.row.name} />
      <div>
        <h3>{impression.row.name}</h3>
        <p>{impression.setName} · #{impression.variant.number}</p>
        <p className={`collection-scanner-ownership ${owned ? "is-owned" : "is-missing"}`}>{owned ? "✓ Déjà dans ta collection" : "○ Carte manquante de ta collection"}</p>
        <small>Touche la carte pour l’agrandir.</small>
      </div>
    </div>
    <div>{!owned ? <button type="button" onClick={() => onAdd(impression)}>Ajouter à ma collection</button> : null}<button type="button" className="secondary" onClick={() => { void onRetry(); }}>Scanner à nouveau</button></div>
  </div>;
}
