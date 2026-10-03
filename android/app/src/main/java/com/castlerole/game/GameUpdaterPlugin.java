package com.castlerole.game;

import android.app.Activity;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

@CapacitorPlugin(name = "GameUpdater")
public class GameUpdaterPlugin extends Plugin {
    private static final String MANIFEST_URL =
        "https://abolfazl2600.github.io/Castlegame/android-updates/android-update.json";
    private static final String USER_AGENT = "Castlegame-Android-Updater";
    private static final long MAX_MANIFEST_BYTES = 64L * 1024L;
    private static final long MAX_ARTIFACT_BYTES = 100L * 1024L * 1024L;
    private static final long MAX_EXTRACTED_BYTES = 250L * 1024L * 1024L;
    private static final int MAX_ZIP_ENTRIES = 5000;

    private static final String ERROR_NETWORK = "NETWORK";
    private static final String ERROR_MANIFEST = "MANIFEST";
    private static final String ERROR_INTEGRITY = "INTEGRITY";
    private static final String ERROR_PACKAGE = "PACKAGE";
    private static final String ERROR_ACTIVATION = "ACTIVATION";

    @PluginMethod
    public void update(PluginCall call) {
        File zipFile = null;
        File stagingDir = null;
        try {
            UpdateManifest manifest = fetchManifest();
            SharedPreferences prefs = getContext().getSharedPreferences("CastlegameUpdates", Activity.MODE_PRIVATE);
            String installedBuild = prefs.getString("installedBuild", "");

            if (manifest.buildId.equals(installedBuild)) {
                JSObject result = new JSObject();
                result.put("updated", false);
                result.put("buildId", manifest.buildId);
                call.resolve(result);
                return;
            }

            File updatesRoot = new File(getContext().getFilesDir(), "castlegame-updates");
            if (!updatesRoot.exists() && !updatesRoot.mkdirs()) {
                throw new UpdateException(ERROR_PACKAGE, "Unable to create the update directory.");
            }

            zipFile = new File(updatesRoot, manifest.buildId + ".download.zip");
            if (zipFile.exists() && !zipFile.delete()) {
                throw new UpdateException(ERROR_PACKAGE, "Unable to replace a stale update download.");
            }
            download(manifest.url, zipFile);

            String actualDigest = sha256(zipFile);
            if (!manifest.sha256.equalsIgnoreCase(actualDigest)) {
                throw new UpdateException(ERROR_INTEGRITY, "Downloaded update failed SHA-256 verification.");
            }

            stagingDir = new File(updatesRoot, ".staging-" + manifest.buildId + "-" + System.currentTimeMillis());
            deleteRecursively(stagingDir);
            if (!stagingDir.mkdirs()) {
                throw new UpdateException(ERROR_PACKAGE, "Unable to prepare the update staging directory.");
            }

            extract(zipFile, stagingDir);
            validateBundle(stagingDir);

            File targetDir = new File(updatesRoot, "bundle-" + manifest.buildId);
            if (targetDir.exists()) {
                deleteRecursively(targetDir);
            }
            if (!stagingDir.renameTo(targetDir)) {
                throw new UpdateException(ERROR_PACKAGE, "Unable to atomically finalize the verified update bundle.");
            }
            stagingDir = null;

            String previousBuild = installedBuild;
            activateBundle(targetDir, manifest.buildId, previousBuild, prefs);
            cleanupOldUpdates(updatesRoot, manifest.buildId, previousBuild);

            JSObject result = new JSObject();
            result.put("updated", true);
            result.put("buildId", manifest.buildId);
            call.resolve(result);
        } catch (UpdateException error) {
            call.reject(error.getMessage(), error.code);
        } catch (Exception error) {
            call.reject("Game update failed: " + safeMessage(error), ERROR_PACKAGE);
        } finally {
            if (zipFile != null && zipFile.exists()) zipFile.delete();
            if (stagingDir != null && stagingDir.exists()) deleteRecursively(stagingDir);
        }
    }

    private UpdateManifest fetchManifest() throws UpdateException {
        HttpURLConnection connection = null;
        try {
            URL url = new URL(MANIFEST_URL + "?ts=" + System.currentTimeMillis());
            if (!"https".equalsIgnoreCase(url.getProtocol())) {
                throw new UpdateException(ERROR_MANIFEST, "Update manifest must use HTTPS.");
            }

            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("GET");
            connection.setInstanceFollowRedirects(true);
            connection.setUseCaches(false);
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(30000);
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("Cache-Control", "no-cache");
            connection.setRequestProperty("Pragma", "no-cache");
            connection.setRequestProperty("User-Agent", USER_AGENT);

            int code = connection.getResponseCode();
            if (code != HttpURLConnection.HTTP_OK) {
                throw new UpdateException(ERROR_MANIFEST, "Update manifest returned HTTP " + code + ".");
            }
            if (!"https".equalsIgnoreCase(connection.getURL().getProtocol())) {
                throw new UpdateException(ERROR_MANIFEST, "Update manifest redirected to a non-HTTPS endpoint.");
            }

            long contentLength = connection.getContentLengthLong();
            if (contentLength > MAX_MANIFEST_BYTES) {
                throw new UpdateException(ERROR_MANIFEST, "Update manifest is unexpectedly large.");
            }

            String raw;
            try (InputStream input = new BufferedInputStream(connection.getInputStream())) {
                raw = readUtf8Limited(input, MAX_MANIFEST_BYTES);
            }
            return validateManifest(new JSONObject(raw));
        } catch (UpdateException error) {
            throw error;
        } catch (SocketTimeoutException error) {
            throw new UpdateException(ERROR_NETWORK, "Timed out while retrieving update information.", error);
        } catch (java.io.IOException error) {
            throw new UpdateException(ERROR_NETWORK, "Unable to retrieve update information.", error);
        } catch (Exception error) {
            throw new UpdateException(ERROR_MANIFEST, "Update manifest is malformed.", error);
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private UpdateManifest validateManifest(JSONObject manifest) throws UpdateException {
        int version = manifest.optInt("version", 1);
        String buildId = manifest.optString("buildId", "").trim();
        String url = manifest.optString("url", "").trim();
        String sha256 = manifest.optString("sha256", "").trim().toLowerCase(Locale.US);

        if (version != 1) {
            throw new UpdateException(ERROR_MANIFEST, "Unsupported update manifest version.");
        }
        if (!buildId.matches("[A-Za-z0-9_-]{7,128}")) {
            throw new UpdateException(ERROR_MANIFEST, "Update manifest contains an invalid buildId.");
        }
        if (!sha256.matches("[0-9a-f]{64}")) {
            throw new UpdateException(ERROR_MANIFEST, "Update manifest contains an invalid SHA-256.");
        }

        try {
            URL packageUrl = new URL(url);
            if (!"https".equalsIgnoreCase(packageUrl.getProtocol())) {
                throw new UpdateException(ERROR_MANIFEST, "Update package URL must use HTTPS.");
            }
        } catch (UpdateException error) {
            throw error;
        } catch (Exception error) {
            throw new UpdateException(ERROR_MANIFEST, "Update manifest contains an invalid package URL.", error);
        }

        return new UpdateManifest(buildId, url, sha256);
    }

    private void download(String urlString, File destination) throws UpdateException {
        HttpURLConnection connection = null;
        try {
            URL url = new URL(urlString);
            if (!"https".equalsIgnoreCase(url.getProtocol())) {
                throw new UpdateException(ERROR_MANIFEST, "Update package URL must use HTTPS.");
            }

            connection = (HttpURLConnection) url.openConnection();
            connection.setInstanceFollowRedirects(true);
            connection.setUseCaches(false);
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(120000);
            connection.setRequestProperty("Accept", "application/zip");
            connection.setRequestProperty("Cache-Control", "no-cache");
            connection.setRequestProperty("User-Agent", USER_AGENT);

            int code = connection.getResponseCode();
            if (code != HttpURLConnection.HTTP_OK) {
                throw new UpdateException(ERROR_MANIFEST, "Update package returned HTTP " + code + ".");
            }
            if (!"https".equalsIgnoreCase(connection.getURL().getProtocol())) {
                throw new UpdateException(ERROR_MANIFEST, "Update package redirected to a non-HTTPS endpoint.");
            }

            long contentLength = connection.getContentLengthLong();
            if (contentLength > MAX_ARTIFACT_BYTES) {
                throw new UpdateException(ERROR_PACKAGE, "The update package is unexpectedly large.");
            }

            try (InputStream input = new BufferedInputStream(connection.getInputStream());
                 OutputStream output = new BufferedOutputStream(new FileOutputStream(destination))) {
                byte[] buffer = new byte[8192];
                long total = 0;
                int read;
                while ((read = input.read(buffer)) != -1) {
                    total += read;
                    if (total > MAX_ARTIFACT_BYTES) {
                        throw new UpdateException(ERROR_PACKAGE, "The update package is unexpectedly large.");
                    }
                    output.write(buffer, 0, read);
                }
                output.flush();
            }

            if (!destination.isFile() || destination.length() == 0) {
                throw new UpdateException(ERROR_PACKAGE, "The update package download is empty.");
            }
        } catch (UpdateException error) {
            throw error;
        } catch (SocketTimeoutException error) {
            throw new UpdateException(ERROR_NETWORK, "Timed out while downloading the update package.", error);
        } catch (java.io.IOException error) {
            throw new UpdateException(ERROR_NETWORK, "Unable to download the update package.", error);
        } catch (Exception error) {
            throw new UpdateException(ERROR_PACKAGE, "Unable to prepare the update package.", error);
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private void extract(File zipFile, File targetDir) throws UpdateException {
        long extractedBytes = 0;
        int entries = 0;
        try (ZipInputStream zip = new ZipInputStream(new BufferedInputStream(new FileInputStream(zipFile)))) {
            ZipEntry entry;
            byte[] buffer = new byte[8192];
            while ((entry = zip.getNextEntry()) != null) {
                entries += 1;
                if (entries > MAX_ZIP_ENTRIES) {
                    throw new UpdateException(ERROR_PACKAGE, "The update package contains too many files.");
                }

                File output = safeResolve(targetDir, entry.getName());
                if (entry.isDirectory()) {
                    if (!output.exists() && !output.mkdirs()) {
                        throw new UpdateException(ERROR_PACKAGE, "Unable to create an update directory.");
                    }
                    continue;
                }

                File parent = output.getParentFile();
                if (parent != null && !parent.exists() && !parent.mkdirs()) {
                    throw new UpdateException(ERROR_PACKAGE, "Unable to create an update directory.");
                }

                try (OutputStream file = new BufferedOutputStream(new FileOutputStream(output))) {
                    int read;
                    while ((read = zip.read(buffer)) != -1) {
                        extractedBytes += read;
                        if (extractedBytes > MAX_EXTRACTED_BYTES) {
                            throw new UpdateException(ERROR_PACKAGE, "The update package expands beyond the allowed size.");
                        }
                        file.write(buffer, 0, read);
                    }
                }
            }
        } catch (UpdateException error) {
            throw error;
        } catch (SecurityException error) {
            throw new UpdateException(ERROR_PACKAGE, "The update package contains an unsafe archive path.", error);
        } catch (Exception error) {
            throw new UpdateException(ERROR_PACKAGE, "Unable to extract the update package.", error);
        }

        if (entries == 0) {
            throw new UpdateException(ERROR_PACKAGE, "The update package is empty.");
        }
    }

    private File safeResolve(File root, String name) throws Exception {
        if (name == null || name.isEmpty()) {
            throw new SecurityException("Empty update archive entry.");
        }
        File output = new File(root, name);
        String rootPath = root.getCanonicalPath() + File.separator;
        String outputPath = output.getCanonicalPath();
        if (!outputPath.startsWith(rootPath)) {
            throw new SecurityException("Unsafe update archive entry.");
        }
        return output;
    }

    private void validateBundle(File root) throws UpdateException {
        File index = new File(root, "index.html");
        if (!index.isFile() || index.length() == 0) {
            throw new UpdateException(ERROR_PACKAGE, "The update package does not contain index.html at its root.");
        }

        try {
            String html;
            try (InputStream input = new BufferedInputStream(new FileInputStream(index))) {
                html = readUtf8Limited(input, 5L * 1024L * 1024L);
            }

            if (html.contains("/Castlegame/assets/")) {
                throw new UpdateException(ERROR_PACKAGE, "The update package contains GitHub Pages asset paths.");
            }
            if (!html.contains("./assets/")) {
                throw new UpdateException(ERROR_PACKAGE, "The update package does not contain Android-compatible relative asset paths.");
            }

            File assets = new File(root, "assets");
            if (!assets.isDirectory()) {
                throw new UpdateException(ERROR_PACKAGE, "The update package references assets but has no assets directory.");
            }
        } catch (UpdateException error) {
            throw error;
        } catch (Exception error) {
            throw new UpdateException(ERROR_PACKAGE, "Unable to validate the extracted game bundle.", error);
        }
    }

    private void activateBundle(
        File bundleRoot,
        String buildId,
        String previousBuild,
        SharedPreferences prefs
    ) throws UpdateException {
        SharedPreferences webPrefs = getContext().getSharedPreferences("CapWebViewSettings", Activity.MODE_PRIVATE);
        String previousBasePath = webPrefs.getString("serverBasePath", "");

        if (!webPrefs.edit().putString("serverBasePath", bundleRoot.getAbsolutePath()).commit()) {
            throw new UpdateException(ERROR_ACTIVATION, "Unable to persist the verified game bundle path.");
        }

        try {
            getBridge().setServerBasePath(bundleRoot.getAbsolutePath());
        } catch (Exception error) {
            restoreServerBasePath(webPrefs, previousBasePath);
            throw new UpdateException(ERROR_ACTIVATION, "Unable to activate the verified game bundle.", error);
        }

        boolean stored = prefs.edit()
            .putString("installedBuild", buildId)
            .putString("previousBuild", previousBuild == null ? "" : previousBuild)
            .commit();
        if (!stored) {
            throw new UpdateException(ERROR_ACTIVATION, "Unable to persist the installed update build ID.");
        }
    }

    private void restoreServerBasePath(SharedPreferences webPrefs, String previousBasePath) {
        if (previousBasePath == null || previousBasePath.isEmpty()) {
            webPrefs.edit().remove("serverBasePath").commit();
        } else {
            webPrefs.edit().putString("serverBasePath", previousBasePath).commit();
            try {
                getBridge().setServerBasePath(previousBasePath);
            } catch (Exception ignored) {
                // The verified update is still app-private and the APK assets remain untouched.
            }
        }
    }

    private void cleanupOldUpdates(File root, String activeBuild, String previousBuild) {
        Set<String> keep = new HashSet<>();
        keep.add("bundle-" + activeBuild);
        keep.add(activeBuild); // Preserve bundles created by the previous updater format.
        if (previousBuild != null && !previousBuild.isEmpty()) {
            keep.add("bundle-" + previousBuild);
            keep.add(previousBuild);
        }

        File[] children = root.listFiles();
        if (children == null) return;
        for (File child : children) {
            if (keep.contains(child.getName())) continue;
            if (child.isFile() && child.getName().endsWith(".zip")) {
                child.delete();
                continue;
            }
            if (child.isDirectory()) deleteRecursively(child);
        }
    }

    private String sha256(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream input = new BufferedInputStream(new FileInputStream(file))) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = input.read(buffer)) != -1) digest.update(buffer, 0, read);
        }
        StringBuilder result = new StringBuilder();
        for (byte value : digest.digest()) {
            result.append(String.format(Locale.US, "%02x", value & 0xff));
        }
        return result.toString();
    }

    private String readUtf8Limited(InputStream input, long maxBytes) throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[4096];
        long total = 0;
        int read;
        while ((read = input.read(buffer)) != -1) {
            total += read;
            if (total > maxBytes) throw new IllegalStateException("Response exceeded the allowed size.");
            output.write(buffer, 0, read);
        }
        return output.toString(StandardCharsets.UTF_8.name());
    }

    private String safeMessage(Exception error) {
        String message = error.getMessage();
        return message == null || message.trim().isEmpty() ? error.getClass().getSimpleName() : message;
    }

    private void deleteRecursively(File file) {
        if (file == null || !file.exists()) return;
        File[] children = file.listFiles();
        if (children != null) {
            for (File child : children) deleteRecursively(child);
        }
        file.delete();
    }

    private static final class UpdateManifest {
        final String buildId;
        final String url;
        final String sha256;

        UpdateManifest(String buildId, String url, String sha256) {
            this.buildId = buildId;
            this.url = url;
            this.sha256 = sha256;
        }
    }

    private static final class UpdateException extends Exception {
        final String code;

        UpdateException(String code, String message) {
            super(message);
            this.code = code;
        }

        UpdateException(String code, String message, Throwable cause) {
            super(message, cause);
            this.code = code;
        }
    }
}
