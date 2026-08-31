package com.polucz.app;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.speech.tts.TextToSpeech;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Opens the screen where a user can add a missing text-to-speech voice.
 *
 * The TTS plugin ships an openInstall(), but it fires ACTION_CHECK_TTS_DATA —
 * a check, not an installer — and it resolves to nothing on a good number of
 * devices, in which case the call succeeds and no screen appears. A button that
 * silently does nothing is worse than no button, so this tries the real install
 * intent first and falls back to the system's text-to-speech settings, which
 * always exists and is where the voice data lives.
 *
 * Reports which one it managed to open so the UI can tell the user what to
 * expect, or say plainly that neither would open.
 */
@CapacitorPlugin(name = "Voice")
public class VoicePlugin extends Plugin {

    private boolean canResolve(Intent intent) {
        PackageManager pm = getContext().getPackageManager();
        ResolveInfo info = pm.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY);
        return info != null;
    }

    private boolean launch(Intent intent) {
        if (!canResolve(intent)) return false;
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    @PluginMethod
    public void openVoiceSettings(PluginCall call) {
        JSObject ret = new JSObject();

        // The engine's own "download voice data" flow, where one exists.
        if (launch(new Intent(TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA))) {
            ret.put("opened", "install");
            call.resolve(ret);
            return;
        }

        // Otherwise the system screen listing engines and their languages.
        if (launch(new Intent("com.android.settings.TTS_SETTINGS"))) {
            ret.put("opened", "settings");
            call.resolve(ret);
            return;
        }

        ret.put("opened", "none");
        call.resolve(ret);
    }
}
