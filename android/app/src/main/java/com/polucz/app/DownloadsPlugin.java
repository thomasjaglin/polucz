package com.polucz.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.database.Cursor;
import android.provider.MediaStore;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Saves a text file into the device's public Downloads folder.
 *
 * Why this exists: @capacitor/filesystem cannot do it. Its Directory.Documents
 * maps to Environment.getExternalStoragePublicDirectory(), which scoped storage
 * blocks from Android 10 on, and it supports neither MediaStore nor SAF — it
 * rejects content:// URIs outright. Its only reachable target is app-private
 * storage, which the user cannot see.
 *
 * On API 29+ MediaStore lets an app add its own files to Downloads with NO
 * permission at all, which is what we want: the export lands where a browser
 * download would, visible to every file manager.
 *
 * Below API 29 (this app's minSdk is 24) MediaStore.Downloads does not exist, so
 * we write the legacy way. That needs WRITE_EXTERNAL_STORAGE, which we do not
 * request — so the call reports failure there and the web layer falls back to
 * the share sheet, which needs no permission on any version.
 */
@CapacitorPlugin(name = "Downloads")
public class DownloadsPlugin extends Plugin {

    @PluginMethod
    public void saveText(PluginCall call) {
        String filename = call.getString("filename");
        String data = call.getString("data");
        String mimeType = call.getString("mimeType", "application/json");

        if (filename == null || data == null) {
            call.reject("filename and data are required");
            return;
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentResolver resolver = getContext().getContentResolver();
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
                values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
                // IS_PENDING hides the row until the bytes are written, so no
                // other app can observe a half-written backup.
                values.put(MediaStore.Downloads.IS_PENDING, 1);

                Uri collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI;
                Uri item = resolver.insert(collection, values);
                if (item == null) {
                    call.reject("Could not create the file in Downloads");
                    return;
                }
                try (OutputStream out = resolver.openOutputStream(item)) {
                    if (out == null) {
                        call.reject("Could not open the file for writing");
                        return;
                    }
                    out.write(data.getBytes(StandardCharsets.UTF_8));
                }
                values.clear();
                values.put(MediaStore.Downloads.IS_PENDING, 0);
                resolver.update(item, values, null, null);

                // MediaStore de-duplicates a clashing name ("foo (1).json"), so
                // read back what it actually created rather than reporting what
                // we asked for — otherwise a second export names the wrong file.
                String actual = filename;
                try (Cursor c = resolver.query(item, new String[] { MediaStore.Downloads.DISPLAY_NAME }, null, null, null)) {
                    if (c != null && c.moveToFirst()) {
                        String name = c.getString(0);
                        if (name != null && !name.isEmpty()) actual = name;
                    }
                }

                JSObject ret = new JSObject();
                ret.put("uri", item.toString());
                ret.put("path", "Downloads/" + actual);
                call.resolve(ret);
                return;
            }

            // Legacy path, API 24-28. Only succeeds if the permission happens to
            // be granted; we deliberately do not ask for it.
            File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            if (dir != null && !dir.exists() && !dir.mkdirs()) {
                call.reject("Downloads folder unavailable");
                return;
            }
            File out = new File(dir, filename);
            try (FileOutputStream fos = new FileOutputStream(out)) {
                fos.write(data.getBytes(StandardCharsets.UTF_8));
            }
            JSObject ret = new JSObject();
            ret.put("uri", Uri.fromFile(out).toString());
            ret.put("path", "Downloads/" + filename);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage() == null ? "Save failed" : e.getMessage(), e);
        }
    }
}
