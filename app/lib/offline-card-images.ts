import { Capacitor } from "@capacitor/core";
import { FileTransfer } from "@capacitor/file-transfer";
import { Directory, Filesystem } from "@capacitor/filesystem";

// A new directory makes the app discard the incomplete files created by the
// first implementation. Each downloaded file is validated before it is used.
const IMAGE_DIRECTORY = "riftbound-card-images-v2";
const LEGACY_IMAGE_DIRECTORY = "riftbound-card-images";
const MINIMUM_IMAGE_SIZE = 1024;
const DOWNLOAD_ATTEMPTS = 2;
const DOWNLOAD_WORKERS = 1;
const DOWNLOAD_TIMEOUT_MS = 15_000;

export type OfflineImageDownloadState =
  | { kind: "idle" }
  | { kind: "downloading"; completed: number; total: number; downloaded: number; failed: number; available: number | null }
  | { kind: "success"; downloaded: number; failed: number; available: number; total: number }
  | { kind: "error"; message: string };

let imageDownloadState: OfflineImageDownloadState = { kind: "idle" };
let activeImageDownload: Promise<void> | null = null;
const imageDownloadListeners = new Set<() => void>();

function publishImageDownloadState(nextState: OfflineImageDownloadState) {
  imageDownloadState = nextState;
  imageDownloadListeners.forEach((listener) => listener());
}

export function getOfflineImageDownloadState() {
  return imageDownloadState;
}

export function subscribeToOfflineImageDownload(listener: () => void) {
  imageDownloadListeners.add(listener);
  return () => imageDownloadListeners.delete(listener);
}

export function resetOfflineImageDownloadState() {
  if (!activeImageDownload) publishImageDownloadState({ kind: "idle" });
}

function isRemoteImage(url: string) {
  return url.startsWith("https://") || url.startsWith("http://");
}

function hashUrl(url: string) {
  let first = 2166136261;
  let second = 5381;
  for (let index = 0; index < url.length; index += 1) {
    const code = url.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second, 33) ^ code;
  }
  return `${(first >>> 0).toString(36)}-${(second >>> 0).toString(36)}`;
}

function imageExtension(url: string) {
  try {
    const extension = /\.(avif|gif|jpe?g|png|webp)$/i.exec(new URL(url).pathname)?.[0];
    return extension?.toLowerCase() ?? ".img";
  } catch {
    return ".img";
  }
}

function imagePath(url: string) {
  return `${IMAGE_DIRECTORY}/${hashUrl(url)}${imageExtension(url)}`;
}

async function ensureDirectory() {
  await Filesystem.mkdir({ path: IMAGE_DIRECTORY, directory: Directory.Data, recursive: true });
}

async function hasOfflineImage(url: string) {
  try {
    const file = await Filesystem.stat({ path: imagePath(url), directory: Directory.Data });
    return file.size >= MINIMUM_IMAGE_SIZE;
  } catch {
    return false;
  }
}

async function removeFile(url: string) {
  try {
    await Filesystem.deleteFile({ path: imagePath(url), directory: Directory.Data });
  } catch {
    // No previous partial file is present.
  }
}

async function downloadImage(url: string) {
  for (let attempt = 1; attempt <= DOWNLOAD_ATTEMPTS; attempt += 1) {
    await removeFile(url);
    try {
      const destination = await Filesystem.getUri({ path: imagePath(url), directory: Directory.Data });
      await FileTransfer.downloadFile({
        url,
        path: destination.uri,
        progress: false,
        connectTimeout: DOWNLOAD_TIMEOUT_MS,
        readTimeout: DOWNLOAD_TIMEOUT_MS,
      });
      if (await hasOfflineImage(url)) return;
    } catch {
      // A transient network error is retried below.
    }
  }

  await removeFile(url);
  throw new Error("Image téléchargée incomplète.");
}

export function isNativeImageStorageAvailable() {
  return Capacitor.isNativePlatform();
}

export async function getOfflineImageSource(url: string) {
  if (!isNativeImageStorageAvailable() || !isRemoteImage(url) || !(await hasOfflineImage(url))) return null;
  const file = await Filesystem.getUri({ path: imagePath(url), directory: Directory.Data });
  return Capacitor.convertFileSrc(file.uri);
}

export async function countOfflineImages(urls: readonly string[]) {
  if (!isNativeImageStorageAvailable()) return 0;
  const results = await Promise.all(urls.map((url) => hasOfflineImage(url)));
  return results.filter(Boolean).length;
}

export async function downloadOfflineImages(
  urls: readonly string[],
  onProgress: (progress: { completed: number; downloaded: number; failed: number; newlySaved: number }) => void,
) {
  if (!isNativeImageStorageAvailable()) {
    throw new Error("Le stockage hors ligne est uniquement disponible dans l'application Android.");
  }

  await ensureDirectory();
  let completed = 0;
  let downloaded = 0;
  let failed = 0;
  let newlySaved = 0;
  let nextIndex = 0;
  const downloadNext = async () => {
    while (nextIndex < urls.length) {
      const url = urls[nextIndex++];
      try {
        if (!(await hasOfflineImage(url))) {
          await downloadImage(url);
          newlySaved += 1;
        }
        downloaded += 1;
      } catch {
        failed += 1;
      } finally {
        completed += 1;
        onProgress({ completed, downloaded, failed, newlySaved });
      }
    }
  };

  // The native Android transfer bridge is more reliable when requests are
  // serialized. A bad remote image can now only delay this queue by 15 seconds.
  await Promise.all(Array.from({ length: DOWNLOAD_WORKERS }, downloadNext));
  return { downloaded, failed, newlySaved };
}

export function startOfflineImagesDownload(urls: readonly string[]) {
  if (activeImageDownload) return activeImageDownload;

  publishImageDownloadState({ kind: "downloading", completed: 0, total: urls.length, downloaded: 0, failed: 0, available: null });
  const run = async () => {
    try {
      const initialAvailable = await countOfflineImages(urls);
      publishImageDownloadState({ kind: "downloading", completed: 0, total: urls.length, downloaded: 0, failed: 0, available: initialAvailable });
      const result = await downloadOfflineImages(urls, (progress) => {
        publishImageDownloadState({ kind: "downloading", ...progress, total: urls.length, available: initialAvailable + progress.newlySaved });
      });
      publishImageDownloadState({ kind: "success", downloaded: result.downloaded, failed: result.failed, available: initialAvailable + result.newlySaved, total: urls.length });
    } catch {
      publishImageDownloadState({ kind: "error", message: "Impossible de télécharger les images hors ligne." });
    }
  };

  activeImageDownload = run().finally(() => {
    activeImageDownload = null;
  });
  return activeImageDownload;
}

export async function clearOfflineImages() {
  if (!isNativeImageStorageAvailable()) return;
  try {
    await Filesystem.rmdir({ path: IMAGE_DIRECTORY, directory: Directory.Data, recursive: true });
  } catch {
    // The directory does not exist yet, so there is nothing to remove.
  }

  try {
    await Filesystem.rmdir({ path: LEGACY_IMAGE_DIRECTORY, directory: Directory.Data, recursive: true });
  } catch {
    // The cache from version 1.4 may already have been removed.
  }
}
