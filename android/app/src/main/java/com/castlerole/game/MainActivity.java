package com.castlerole.game;

import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;

import androidx.core.view.WindowCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final long IMMERSIVE_REAPPLY_DELAY_MS = 120L;
    private final Runnable immersiveRunnable = this::applyImmersiveMode;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GameUpdaterPlugin.class);
        registerPlugin(GameScreenshotPlugin.class);
        registerPlugin(SafeAreaPlugin.class);
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        scheduleImmersiveMode(0L);
    }

    @Override
    public void onResume() {
        super.onResume();
        scheduleImmersiveMode(IMMERSIVE_REAPPLY_DELAY_MS);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            scheduleImmersiveMode(IMMERSIVE_REAPPLY_DELAY_MS);
        }
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        scheduleImmersiveMode(0L);
    }

    @Override
    public void onDestroy() {
        getWindow().getDecorView().removeCallbacks(immersiveRunnable);
        super.onDestroy();
    }

    private void scheduleImmersiveMode(long delayMs) {
        View decorView = getWindow().getDecorView();
        decorView.removeCallbacks(immersiveRunnable);
        decorView.postDelayed(immersiveRunnable, delayMs);
    }

    private void applyImmersiveMode() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller == null) return;

            controller.setSystemBarsBehavior(
                WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            );
            controller.hide(WindowInsets.Type.systemBars());
            return;
        }

        // Android 7-10: immersive-sticky still lets the user reveal transient
        // system bars with the platform gesture and automatically restores the
        // fullscreen state afterwards.
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
        );
    }
}
