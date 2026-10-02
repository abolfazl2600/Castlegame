package com.castlerole.game;

import android.content.Intent;
import android.net.Uri;
import android.util.Base64;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.Locale;

@CapacitorPlugin(name = "GameScreenshot")
public class GameScreenshotPlugin extends Plugin {
    private static final long MAX_PNG_BYTES = 32L * 1024L * 1024L;

    @PluginMethod
    public void shareImage(PluginCall call) {
        String data = call.getString("data");
        String requestedFilename = call.getString("filename");
        if (requestedFilename == null || requestedFilename.trim().isEmpty()) {
            requestedFilename = "castle-role.png";
        }

        if (data == null || data.isEmpty()) {
            call.reject("Screenshot image data is missing.");
            return;
        }

        // Base64 expands binary data by roughly 4/3. Reject obviously oversized
        // inputs before decoding so capture memory stays bounded on mobile.
        if (data.length() > (MAX_PNG_BYTES * 4L / 3L) + 4096L) {
            call.reject("Screenshot image is too large.");
            return;
        }

        final byte[] png;
        try {
            png = Base64.decode(data, Base64.DEFAULT);
        } catch (IllegalArgumentException error) {
            call.reject("Screenshot image data is invalid: " + error.getMessage());
            return;
        }

        if (png.length == 0 || png.length > MAX_PNG_BYTES || !isPng(png)) {
            call.reject("Screenshot image is not a valid PNG.");
            return;
        }

        String filename = sanitizeFilename(requestedFilename);
        File directory = new File(getContext().getCacheDir(), "screenshots");
        if (!directory.exists() && !directory.mkdirs()) {
            call.reject("Unable to create screenshot cache directory.");
            return;
        }

        File output = new File(directory, filename);
        try (OutputStream stream = new BufferedOutputStream(new FileOutputStream(output))) {
            stream.write(png);
            stream.flush();
        } catch (Exception error) {
            call.reject("Unable to prepare screenshot for sharing: " + error.getMessage());
            return;
        }

        Uri contentUri;
        try {
            contentUri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                output
            );
        } catch (Exception error) {
            output.delete();
            call.reject("Unable to expose screenshot to Android sharing: " + error.getMessage());
            return;
        }

        Intent share = new Intent(Intent.ACTION_SEND);
        share.setType("image/png");
        share.putExtra(Intent.EXTRA_STREAM, contentUri);
        share.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

        getActivity().runOnUiThread(() -> {
            try {
                Intent chooser = Intent.createChooser(share, "Share screenshot");
                getActivity().startActivity(chooser);
                JSObject result = new JSObject();
                result.put("shared", true);
                call.resolve(result);
            } catch (Exception error) {
                output.delete();
                call.reject("Unable to open Android share sheet: " + error.getMessage());
            }
        });
    }

    private boolean isPng(byte[] bytes) {
        if (bytes.length < 8) return false;
        int[] signature = { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A };
        for (int i = 0; i < signature.length; i++) {
            if ((bytes[i] & 0xff) != signature[i]) return false;
        }
        return true;
    }

    private String sanitizeFilename(String value) {
        String normalized = value == null ? "" : value.trim().toLowerCase(Locale.US);
        normalized = normalized.replaceAll("[^a-z0-9._-]", "-");
        if (!normalized.endsWith(".png")) normalized += ".png";
        if (normalized.length() > 96) {
            normalized = normalized.substring(0, 92) + ".png";
        }
        return normalized.isEmpty() ? "castle-role.png" : normalized;
    }
}
