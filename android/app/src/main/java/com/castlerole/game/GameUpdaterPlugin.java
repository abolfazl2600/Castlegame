package com.castlerole.game;

import android.app.Activity;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

@CapacitorPlugin(name = "GameUpdater")
public class GameUpdaterPlugin extends Plugin {
    private static final String ARTIFACTS_URL =
        "https://api.github.com/repos/abolfazl2600/Castlegame/actions/artifacts?name=castlegame-web-update&per_page=20";
    private static final String USER_AGENT = "Castlegame-Android-Updater";
    private static final long MAX_ARTIFACT_BYTES = 100L * 1024L * 1024L;
    private static final long MAX_EXTRACTED_BYTES = 250L * 1024L * 1024L;

    @PluginMethod
    public void update(PluginCall call) {
        try {
            JSONObject artifact = findLatestArtifact();
            if (artifact == null) {
                call.reject("No verified Castlegame web update is available yet.");
                return;
            }

            String buildId = artifact.getJSONObject("workflow_run").getString("head_sha");
            SharedPreferences prefs = getContext().getSharedPreferences("CastlegameUpdates", Activity.MODE_PRIVATE);
            String installedBuild = prefs.getString("installedBuild", "");

            if (buildId.equals(installedBuild)) {
                JSObject result = new JSObject();
                result.put("updated", false);
                result.put("buildId", buildId);
                call.resolve(result);
                return;
            }

            long artifactSize = artifact.optLong("size_in_bytes", 0L);
            if (artifactSize > MAX_ARTIFACT_BYTES) {
                call.reject("The update package is unexpectedly large.");
                return;
            }

            File updatesRoot = new File(getContext().getFilesDir(), "castlegame-updates");
            if (!updatesRoot.exists() && !updatesRoot.mkdirs()) {
                call.reject("Unable to create the update directory.");
                return;
            }

            File zipFile = new File(updatesRoot, buildId + ".zip");
            download(artifact.getString("archive_download_url"), zipFile, artifactSize);

            String expectedDigest = artifact.optString("digest", "");
            if (!expectedDigest.isEmpty()) {
                String actualDigest = "sha256:" + sha256(zipFile);
                if (!expectedDigest.equalsIgnoreCase(actualDigest)) {
                    zipFile.delete();
                    call.reject("The downloaded update failed integrity verification.");
                    return;
                }
            }

            File targetDir = new File(updatesRoot, buildId);
            deleteRecursively(targetDir);
            if (!targetDir.mkdirs()) {
                zipFile.delete();
                call.reject("Unable to prepare the new game bundle.");
                return;
            }

            extract(zipFile, targetDir);
            zipFile.delete();

            File index = findIndex(targetDir);
            if (index == null) {
                deleteRecursively(targetDir);
                call.reject("The downloaded update does not contain a valid game bundle.");
                return;
            }

            File bundleRoot = index.getParentFile();
            SharedPreferences webPrefs = getContext().getSharedPreferences("CapWebViewSettings", Activity.MODE_PRIVATE);
            webPrefs.edit().putString("serverBasePath", bundleRoot.getAbsolutePath()).apply();
            prefs.edit().putString("installedBuild", buildId).apply();

            getBridge().setServerBasePath(bundleRoot.getAbsolutePath());

            JSObject result = new JSObject();
            result.put("updated", true);
            result.put("buildId", buildId);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Game update failed: " + error.getMessage());
        }
    }

    private JSONObject findLatestArtifact() throws Exception {
        JSONObject response = getJson(ARTIFACTS_URL);
        JSONArray artifacts = response.optJSONArray("artifacts");
        if (artifacts == null) return null;

        for (int i = 0; i < artifacts.length(); i++) {
            JSONObject artifact = artifacts.getJSONObject(i);
            if (artifact.optBoolean("expired", true)) continue;
            JSONObject run = artifact.optJSONObject("workflow_run");
            if (run == null || !"main".equals(run.optString("head_branch"))) continue;
            if (!artifact.has("archive_download_url")) continue;
            return artifact;
        }
        return null;
    }

    private JSONObject getJson(String urlString) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(urlString).openConnection();
        connection.setRequestMethod("GET");
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(30000);
        connection.setRequestProperty("Accept", "application/vnd.github+json");
        connection.setRequestProperty("User-Agent", USER_AGENT);
        try {
            int code = connection.getResponseCode();
            if (code != HttpURLConnection.HTTP_OK) {
                throw new IllegalStateException("GitHub returned HTTP " + code);
            }
            try (InputStream input = connection.getInputStream()) {
                return new JSONObject(readUtf8(input));
            }
        } finally {
            connection.disconnect();
        }
    }

    private void download(String urlString, File destination, long expectedSize) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(urlString).openConnection();
        connection.setInstanceFollowRedirects(true);
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(120000);
        connection.setRequestProperty("Accept", "application/zip");
        connection.setRequestProperty("User-Agent", USER_AGENT);
        try {
            int code = connection.getResponseCode();
            if (code != HttpURLConnection.HTTP_OK) {
                throw new IllegalStateException("GitHub update download returned HTTP " + code);
            }
            long contentLength = connection.getContentLengthLong();
            if (contentLength > MAX_ARTIFACT_BYTES) {
                throw new IllegalStateException("The update package is unexpectedly large.");
            }
            if (expectedSize > 0 && contentLength > 0 && contentLength != expectedSize) {
                throw new IllegalStateException("The update package size changed while downloading.");
            }

            try (InputStream input = new BufferedInputStream(connection.getInputStream());
                 OutputStream output = new BufferedOutputStream(new FileOutputStream(destination))) {
                byte[] buffer = new byte[8192];
                long total = 0;
                int read;
                while ((read = input.read(buffer)) != -1) {
                    total += read;
                    if (total > MAX_ARTIFACT_BYTES) {
                        throw new IllegalStateException("The update package is unexpectedly large.");
                    }
                    output.write(buffer, 0, read);
                }
            }
        } finally {
            connection.disconnect();
        }
    }

    private void extract(File zipFile, File targetDir) throws Exception {
        long extractedBytes = 0;
        try (ZipInputStream zip = new ZipInputStream(new BufferedInputStream(new FileInputStream(zipFile)))) {
            ZipEntry entry;
            byte[] buffer = new byte[8192];
            while ((entry = zip.getNextEntry()) != null) {
                File output = safeResolve(targetDir, entry.getName());
                if (entry.isDirectory()) {
                    if (!output.exists() && !output.mkdirs()) throw new IllegalStateException("Unable to create update directory.");
                    continue;
                }
                File parent = output.getParentFile();
                if (parent != null && !parent.exists() && !parent.mkdirs()) throw new IllegalStateException("Unable to create update directory.");
                try (OutputStream file = new BufferedOutputStream(new FileOutputStream(output))) {
                    int read;
                    while ((read = zip.read(buffer)) != -1) {
                        extractedBytes += read;
                        if (extractedBytes > MAX_EXTRACTED_BYTES) {
                            throw new IllegalStateException("The update package expands beyond the allowed size.");
                        }
                        file.write(buffer, 0, read);
                    }
                }
            }
        }
    }

    private File safeResolve(File root, String name) throws Exception {
        File output = new File(root, name);
        String rootPath = root.getCanonicalPath() + File.separator;
        String outputPath = output.getCanonicalPath();
        if (!outputPath.startsWith(rootPath)) throw new SecurityException("Unsafe update archive entry.");
        return output;
    }

    private File findIndex(File root) {
        File direct = new File(root, "index.html");
        if (direct.isFile()) return direct;
        File[] children = root.listFiles();
        if (children == null) return null;
        for (File child : children) {
            if (child.isDirectory()) {
                File found = findIndex(child);
                if (found != null) return found;
            }
        }
        return null;
    }

    private String sha256(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream input = new BufferedInputStream(new FileInputStream(file))) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = input.read(buffer)) != -1) digest.update(buffer, 0, read);
        }
        StringBuilder result = new StringBuilder();
        for (byte value : digest.digest()) result.append(String.format("%02x", value));
        return result.toString();
    }

    private String readUtf8(InputStream input) throws Exception {
        StringBuilder result = new StringBuilder();
        byte[] buffer = new byte[8192];
        int read;
        while ((read = input.read(buffer)) != -1) result.append(new String(buffer, 0, read, java.nio.charset.StandardCharsets.UTF_8));
        return result.toString();
    }

    private void deleteRecursively(File file) {
        if (!file.exists()) return;
        File[] children = file.listFiles();
        if (children != null) for (File child : children) deleteRecursively(child);
        file.delete();
    }
}
