package com.aliasnonam.riftboundcatalogue;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/** Saves an export directly to the user's Downloads folder through Android MediaStore.
 * Android 10+ grants an app write access to its own created download without storage permission. */
@CapacitorPlugin(name = "CollectionBackup")
public class CollectionBackupPlugin extends Plugin {
  @PluginMethod
  public void saveDownload(PluginCall call) {
    String filename = call.getString("filename");
    String contents = call.getString("contents");
    if (filename == null || filename.trim().isEmpty() || contents == null) {
      call.reject("Nom ou contenu de sauvegarde manquant.");
      return;
    }
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      call.reject("L’enregistrement direct dans Téléchargements nécessite Android 10 ou une version plus récente.");
      return;
    }

    ContentResolver resolver = getContext().getContentResolver();
    ContentValues values = new ContentValues();
    values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
    values.put(MediaStore.MediaColumns.MIME_TYPE, "application/json");
    values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Riftbound");
    values.put(MediaStore.MediaColumns.IS_PENDING, 1);

    Uri uri = null;
    try {
      uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
      if (uri == null) throw new IllegalStateException("Impossible de créer le fichier de sauvegarde.");
      try (OutputStream output = resolver.openOutputStream(uri, "w")) {
        if (output == null) throw new IllegalStateException("Impossible d’ouvrir le fichier de sauvegarde.");
        output.write(contents.getBytes(StandardCharsets.UTF_8));
      }
      values.clear();
      values.put(MediaStore.MediaColumns.IS_PENDING, 0);
      resolver.update(uri, values, null, null);

      JSObject result = new JSObject();
      result.put("uri", uri.toString());
      call.resolve(result);
    } catch (Exception error) {
      if (uri != null) resolver.delete(uri, null, null);
      call.reject("Impossible d’enregistrer la sauvegarde dans Téléchargements.", error);
    }
  }
}
