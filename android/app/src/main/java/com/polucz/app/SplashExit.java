package com.polucz.app;

import android.animation.AnimatorSet;
import android.animation.ObjectAnimator;
import android.app.Activity;
import android.view.View;
import android.view.animation.PathInterpolator;

import androidx.core.splashscreen.SplashScreen;

/**
 * Hands the splash back to the app with a short movement instead of a cut.
 *
 * The system splash otherwise disappears on a single frame, which reads as a
 * flicker between two dark screens. Fading the icon while it lifts and grows
 * very slightly makes the launch feel like one continuous motion into the
 * first screen.
 *
 * Only opacity and scale are animated -- both are composited on the GPU, so
 * this costs nothing on the frame where the WebView is still settling.
 */
final class SplashExit {
    // Exits run shorter than entrances; this is at the quick end because it is
    // delaying the app by exactly its own duration.
    private static final long DURATION_MS = 260L;

    private SplashExit() {}

    static void install(Activity activity, SplashScreen splashScreen) {
        splashScreen.setOnExitAnimationListener(provider -> {
            View view = provider.getView();
            // Ease-out: quick to leave, settling at the end, so the app appears
            // to arrive rather than the splash to be snatched away.
            PathInterpolator easeOut = new PathInterpolator(0.23f, 1f, 0.32f, 1f);

            ObjectAnimator fade = ObjectAnimator.ofFloat(view, View.ALPHA, 1f, 0f);
            ObjectAnimator scaleX = ObjectAnimator.ofFloat(view, View.SCALE_X, 1f, 1.06f);
            ObjectAnimator scaleY = ObjectAnimator.ofFloat(view, View.SCALE_Y, 1f, 1.06f);

            AnimatorSet set = new AnimatorSet();
            set.playTogether(fade, scaleX, scaleY);
            set.setDuration(DURATION_MS);
            set.setInterpolator(easeOut);
            // remove() is what actually tears the splash down; without it in
            // every terminal case the app is left behind a frozen overlay.
            set.addListener(new android.animation.AnimatorListenerAdapter() {
                @Override public void onAnimationEnd(android.animation.Animator a) {
                    provider.remove();
                }
                @Override public void onAnimationCancel(android.animation.Animator a) {
                    provider.remove();
                }
            });
            set.start();
        });
    }
}
