package com.polucz.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Local plugin: saves the backup into the public Downloads folder, which
        // @capacitor/filesystem cannot reach under scoped storage.
        registerPlugin(DownloadsPlugin.class);
        // Local plugin: opens the system screen for installing a missing TTS
        // voice, which the TTS plugin's own openInstall() often cannot reach.
        registerPlugin(VoicePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
