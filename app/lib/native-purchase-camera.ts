import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export type PurchaseCameraDiagnostics = {
  backend: "CameraX";
  debug?: boolean;
  cameraId?: string;
  lens?: string;
  previewWidth?: number;
  previewHeight?: number;
  analysisWidth?: number;
  analysisHeight?: number;
  width?: number;
  height?: number;
  frameRate?: number;
  afMode?: string;
  afState?: string;
  aeState?: string;
  minZoom?: number;
  maxZoom?: number;
  zoom?: number;
  focusSuccess?: boolean;
};

export type NativePurchaseCamera = {
  start(options: { x: number; y: number; width: number; height: number; devicePixelRatio: number }): Promise<PurchaseCameraDiagnostics>;
  updateBounds(options: { x: number; y: number; width: number; height: number; devicePixelRatio: number }): Promise<void>;
  setZoomRatio(options: { zoom: number }): Promise<{ zoom: number }>;
  focus(options: { x: number; y: number }): Promise<void>;
  stop(): Promise<void>;
  addListener(eventName: "textRecognized", listenerFunc: (event: { text: string }) => void): Promise<PluginListenerHandle>;
  addListener(eventName: "diagnostics", listenerFunc: (event: PurchaseCameraDiagnostics) => void): Promise<PluginListenerHandle>;
  addListener(eventName: "focusStatus", listenerFunc: (event: { success: boolean }) => void): Promise<PluginListenerHandle>;
};

export const PurchaseCamera = registerPlugin<NativePurchaseCamera>("PurchaseCamera");
