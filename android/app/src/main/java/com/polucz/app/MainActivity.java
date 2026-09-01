package com.polucz.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Must run before super.onCreate: the library swaps the launch theme for
        // postSplashScreenTheme here, and after super it is too late to hook the
        // exit.
        androidx.core.splashscreen.SplashScreen splash =
                androidx.core.splashscreen.SplashScreen.installSplashScreen(this);
        SplashExit.install(this, splash);
        // Local plugin: saves the backup into the public Downloads folder, which
        // @capacitor/filesystem cannot reach under scoped storage.
        registerPlugin(DownloadsPlugin.class);
        // Local plugin: opens the system screen for installing a missing TTS
        // voice, which the TTS plugin's own openInstall() often cannot reach.
        registerPlugin(VoicePlugin.class);
        super.onCreate(savedInstanceState);
        // After super, because the bridge and its WebView do not exist before it.
        SplashExit.awaitFirstPaint(this, splash, getBridge().getWebView());
    }
}
