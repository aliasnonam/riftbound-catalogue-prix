import { Capacitor } from "@capacitor/core";
import { FileTransfer } from "@capacitor/file-transfer";
import { Directory, Filesystem } from "@capacitor/filesystem";

// A new directory makes the app discard the incomplete files created by the
// first implementation. Each downloaded file is validated before it is used.
const IMAGE_DIRECTORY = "riftbound-card-images-v2";
const LEGACY_IMAGE_DIRECTORY = "riftbound-card-images";
const MINIMUM_IMAGE_SIZE = 1024;
const DOWNLOAD_ATTEMPTS = 3;

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
      await FileTransfer.downloadFile({ url, path: destination.uri, progress: false });
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

export async function downloadOfflineImages(urls: readonly string[], onProgress: (completed: number) => void) {
  if (!isNativeImageStorageAvailable()) {
    throw new Error("Le stockage hors ligne est uniquement disponible dans l'application Android.");
  }

  await ensureDirectory();
  let completed = 0;
  let downloaded = 0;
  let failed = 0;
  let nextIndex = 0;
  const downloadNext = async () => {
    while (nextIndex < urls.length) {
      const url = urls[nextIndex++];
      try {
        if (!(await hasOfflineImage(url))) await downloadImage(url);
        downloaded += 1;
      } catch {
        failed += 1;
      } finally {
        completed += 1;
        onProgress(completed);
      }
    }
  };

  await Promise.all(Array.from({ length: 3 }, downloadNext));
  return { downloaded, failed };
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
