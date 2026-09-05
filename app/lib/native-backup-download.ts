import { registerPlugin } from "@capacitor/core";

type CollectionBackupDownloadPlugin = {
  saveDownload(options: { filename: string; contents: string }): Promise<{ uri: string }>;
};

/** Android MediaStore download: no broad storage permission is required on Android 10+. */
export const CollectionBackupDownload = registerPlugin<CollectionBackupDownloadPlugin>("CollectionBackup");
