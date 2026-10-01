package com.castlerole.game;

import android.view.View;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SafeArea")
public class SafeAreaPlugin extends Plugin {
    private View decorView;

    @Override
    public void load() {
        decorView = getActivity().getWindow().getDecorView();

        getActivity().runOnUiThread(() -> {
            ViewCompat.setOnApplyWindowInsetsListener(decorView, (view, windowInsets) -> {
                notifyListeners("insetsChanged", toPayload(windowInsets), true);
                return windowInsets;
            });
            ViewCompat.requestApplyInsets(decorView);
        });
    }

    @PluginMethod
    public void getInsets(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            WindowInsetsCompat windowInsets = decorView == null
                ? null
                : ViewCompat.getRootWindowInsets(decorView);

            call.resolve(windowInsets == null ? emptyPayload() : toPayload(windowInsets));
        });
    }

    private JSObject toPayload(WindowInsetsCompat windowInsets) {
        int insetTypes =
            WindowInsetsCompat.Type.systemBars()
            | WindowInsetsCompat.Type.displayCutout()
            | WindowInsetsCompat.Type.mandatorySystemGestures();

        Insets insets = windowInsets.getInsets(insetTypes);
        float density = getContext().getResources().getDisplayMetrics().density;
        if (density <= 0f) density = 1f;

        JSObject payload = new JSObject();
        payload.put("top", insets.top / density);
        payload.put("right", insets.right / density);
        payload.put("bottom", insets.bottom / density);
        payload.put("left", insets.left / density);
        return payload;
    }

    private JSObject emptyPayload() {
        JSObject payload = new JSObject();
        payload.put("top", 0);
        payload.put("right", 0);
        payload.put("bottom", 0);
        payload.put("left", 0);
        return payload;
    }
}
