"use client";

import { useState } from "react";
import { Capacitor } from "@capacitor/core";

import { CardPreviewThumb } from "@/app/components/catalog/CardPreview";
import { useSiteLanguage } from "@/app/lib/site-language";
import { findCardFromDetectedText, findCardFromScan, parseCardScanText, type ResolvedCardScan } from "@/lib/card-scan";
import type { CollectionImpression } from "@/lib/collection";
import { getPrimaryVariantPrice } from "@/lib/pricing";
import { useCollection } from "@/hooks/use-collection";

type ScannerState =
  | { step: "idle" }
  | { step: "reading" }
  | { step: "result"; result: ResolvedCardScan }
  | { step: "error"; message: string };

const AHRI_EXAMPLE_IMAGE = "/hero/sfd-ahri-signed.webp";
const EURO = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

export function CardScanner({ impressions }: { impressions: CollectionImpression[] }) {
  const collection = useCollection();
  const { language } = useSiteLanguage();
  const en = language === "en";
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
      const cameraPermission = permissions.camera === "granted"
        ? permissions
        : await Camera.requestPermissions({ permissions: ["camera"] });
      if (cameraPermission.camera !== "granted") {
        setState({
          step: "error",
          message: en
            ? "Camera access is required to scan a card."
            : "L’accès à la caméra est nécessaire pour scanner une carte.",
        });
        return;
      }
      const photo = await Camera.getPhoto({
        source: CameraSource.Camera,
        resultType: CameraResultType.Base64,
        quality: 100,
        correctOrientation: true,
        saveToGallery: false,
      });
      if (!photo.base64String) throw new Error("image unavailable");
      const recognized = await CapacitorPluginMlKitTextRecognition.detectText({ base64Image: photo.base64String });
      const parsed = parseCardScanText(recognized.text);
      const resolved = parsed.ok
        ? findCardFromScan(parsed.value, impressions, recognized.text)
        : findCardFromDetectedText(recognized.text, impressions);
      if (resolved.kind !== "match") {
        setState({
          step: "error",
          message: (parsed.ok ? resolved.kind === "ambiguous" : parsed.reason === "ambiguous")
            ? (en
              ? "Several collector codes were detected. Take another picture with the entire card in frame."
              : "Plusieurs codes ont été détectés. Reprends la photo en cadrant la carte entière.")
            : (en
              ? "Card not recognised. Move closer and try again."
              : "Carte non reconnue. Rapproche la carte et essaie à nouveau."),
        });
        return;
      }
      setState({ step: "result", result: resolved });
    } catch (error) {
      const message = error instanceof Error && /cancel/i.test(error.message)
        ? (en ? "Scan cancelled." : "Scan annulé.")
        : (en
          ? "This card could not be read. Check the light and keep the entire card in frame."
          : "Impossible de lire cette carte. Vérifie la lumière et cadre la carte entière.");
      setState({ step: "error", message });
    }
  };

  const add = (impression: CollectionImpression) => collection.setOwned(impression.impressionId);

  return <section className="collection-scanner" aria-labelledby="collection-scanner-title">
    <div>
      <p className="eyebrow">{en ? "Quick collection" : "Collection rapide"}</p>
      <h2 id="collection-scanner-title">{en ? "Scan a card" : "Scanner une carte"}</h2>
      <p>{en ? "Use the camera to read a card. The picture is analysed only on this device and is never saved or sent." : "Utilise la caméra pour lire une carte. La photo est analysée localement et n’est ni enregistrée ni envoyée."}</p>
    </div>
    <button type="button" onClick={() => setOpen(true)}>{en ? "Scan a card" : "Scanner une carte"}</button>
    {open ? <div className="collection-confirm-backdrop scanner-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section className="collection-scanner-dialog" role="dialog" aria-modal="true" aria-labelledby="scanner-title">
        <button type="button" className="collection-scanner-close" aria-label={en ? "Close scanner" : "Fermer le scanner"} onClick={close}>×</button>
        <p className="eyebrow">{en ? "Scan a card" : "Scanner une carte"}</p>
        <h2 id="scanner-title">{en ? "Frame the card" : "Cadre la carte"}</h2>
        <p>{en ? <>Take a picture of the entire card. Keep the printed code legible, for example <strong>SFD · 227* / 221</strong>.</> : <>Prends la carte entière en photo. Le code imprimé doit rester lisible, par exemple <strong>SFD · 227* / 221</strong>.</>}</p>
        {state.step !== "result" ? <ScannerExample en={en} /> : null}
        {state.step === "idle" ? <button type="button" onClick={() => { void scan(); }}>{en ? "Open camera" : "Ouvrir la caméra"}</button> : null}
        {state.step === "reading" ? <p className="collection-scanner-status">{en ? "Reading on this device…" : "Lecture locale en cours…"}</p> : null}
        {state.step === "error" ? <div className="collection-scanner-feedback"><p>{state.message}</p><button type="button" onClick={() => { void scan(); }}>{en ? "Scan again" : "Scanner à nouveau"}</button></div> : null}
        {state.step === "result" ? <ScanResult result={state.result} owned={state.result.kind === "match" && collection.getStatus(state.result.impression.impressionId) === "owned"} onAdd={add} onRetry={scan} en={en} /> : null}
      </section>
    </div> : null}
  </section>;
}

function ScannerExample({ en }: { en: boolean }) {
  return <div className="collection-scanner-frame">
    <img src={AHRI_EXAMPLE_IMAGE} alt={en ? "Example: Ahri Inquisitive card" : "Exemple de carte Ahri Inquisitive"} />
    <span>SFD · 227* / 221</span>
  </div>;
}

function ScanResult({ result, owned, onAdd, onRetry, en }: { result: ResolvedCardScan; owned: boolean; onAdd: (impression: CollectionImpression) => void; onRetry: () => Promise<void>; en: boolean }) {
  if (result.kind === "not-found") return <div className="collection-scanner-feedback"><p>{en ? "This card is not in the catalogue or its number could not be read." : "Carte hors catalogue ou numéro illisible."}</p><button type="button" onClick={() => { void onRetry(); }}>{en ? "Scan again" : "Scanner à nouveau"}</button></div>;
  if (result.kind === "ambiguous") return <div className="collection-scanner-feedback"><p>{en ? "Several cards match this number. Take another, sharper picture of the entire card." : "Plusieurs cartes correspondent à ce numéro. Reprends une photo plus nette de la carte entière."}</p><button type="button" onClick={() => { void onRetry(); }}>{en ? "Scan again" : "Scanner à nouveau"}</button></div>;
  const { impression, confidence } = result;
  const price = getPrimaryVariantPrice(impression.variant, "low");
  return <div className="collection-scanner-result">
    <p className="eyebrow">{en ? "Card detected · " + (confidence === "high" ? "high" : "medium") + " confidence" : "Carte détectée · confiance " + (confidence === "high" ? "élevée" : "moyenne")}</p>
    <div className="collection-scanner-card">
      <CardPreviewThumb className="collection-scanner-art" imageUrl={impression.variant.imageUrl} name={impression.row.name} />
      <div>
        <h3>{impression.row.name}</h3>
        <p>{impression.setName} · #{impression.variant.number}</p>
        <p className="collection-scanner-price">{en ? "Cardmarket price" : "Prix Cardmarket"} <strong>{price === null ? "—" : EURO.format(price)}</strong></p>
        <p className={"collection-scanner-ownership " + (owned ? "is-owned" : "is-missing")}>{owned ? (en ? "✓ Already in your collection" : "✓ Déjà dans ta collection") : (en ? "○ Missing from your collection" : "○ Carte manquante de ta collection")}</p>
        <a className="collection-cardmarket-link" href={impression.row.cardmarketUrl} target="_blank" rel="noopener noreferrer">{en ? "View on Cardmarket ↗" : "Voir sur Cardmarket ↗"}</a>
        <small>{en ? "Tap the card to enlarge it." : "Touche la carte pour l’agrandir."}</small>
      </div>
    </div>
    <div>{!owned ? <button type="button" onClick={() => onAdd(impression)}>{en ? "Add to my collection" : "Ajouter à ma collection"}</button> : null}<button type="button" className="secondary" onClick={() => { void onRetry(); }}>{en ? "Scan again" : "Scanner à nouveau"}</button></div>
  </div>;
}
