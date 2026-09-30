# Secure Android upload signing from a browser (Issue #183)

**Goal:** produce a signed Google Play upload AAB without local Android Studio, without putting upload private key material in Git or GitHub Actions artifacts. **The real upload key must be generated and backed up by the repository owner, not by CI.**

## 1. Privately generate the dedicated upload key in GitHub Codespaces

1. From the repository's **Code → Codespaces**, open a **private Codespace that you personally control**, using the browser-based Visual Studio Code interface. Confirm that only trusted individuals can access it. A Codespace is a separate environment from the public repository.
2. Open a private terminal and create an out-of-repository directory:

   ```bash
   umask 077
   mkdir -p -m 700 "$HOME/.castle-role-private-signing"
   ```

3. Create a brand-new dedicated JKS upload key, with an alias that is not reused elsewhere:

   ```bash
   keytool -genkeypair \
     -keystore "$HOME/.castle-role-private-signing/castle-role-upload.jks" \
     -storetype JKS \
     -alias castle-role-upload \
     -keyalg RSA -keysize 3072 -validity 10000 \
     -dname "CN=Castle Role Upload, OU=Release, O=Castle Role"
   chmod 600 "$HOME/.castle-role-private-signing/castle-role-upload.jks"
   ```

   Enter unique high-entropy keystore and key passwords at the **interactive prompts**. Never put passwords on command lines or in shell history. Record both passwords and the alias in an encrypted password manager. If you choose the same password for the key and the store, both corresponding GitHub secret values must contain that password.

4. Read the *public* upload certificate's SHA-256 fingerprint (the command prompts securely for the store password):

   ```bash
   keytool -list -v \
     -keystore "$HOME/.castle-role-private-signing/castle-role-upload.jks" \
     -alias castle-role-upload
   ```

   Record the `SHA256:` fingerprint, not the private key. If Google Play needs the upload certificate, use `keytool -exportcert -rfc` to export **only the public certificate**.

## 2. Make a verified encrypted offline backup *before* removing Codespaces copies

In the private Codespaces browser editor, use **File → Open Folder** with `$HOME/.castle-role-private-signing` expanded to its absolute home path, then use the Explorer's **Download** command to download the original `castle-role-upload.jks`. Put a copy in **encrypted storage outside GitHub**, with the alias and passwords recoverable in an encrypted password manager.

Verify the downloaded copy is intact: temporarily upload the downloaded JKS back to the same private Codespace folder using the browser editor (under a different filename) and compare it against the original using `cmp -s` or `sha256sum`. Delete that temporary verification copy. Keep at least one encrypted offline backup that does **not** depend on GitHub or the Codespace.

For GitHub Secrets transport, create a sensitive Base64 text file **outside** the repository:

```bash
base64 -w 0 "$HOME/.castle-role-private-signing/castle-role-upload.jks" \
  > "$HOME/.castle-role-private-signing/castle-role-upload.jks.base64"
chmod 600 "$HOME/.castle-role-private-signing/castle-role-upload.jks.base64"
```

Open the encoded text file only in your **private Codespaces editor**, then copy directly into GitHub's protected environment secret field. Do **not** print the encoded keystore, passwords, or private key bytes to a terminal, chat, Actions log, issue, PR, screenshot, or other public location. **Base64 is not encryption.** Its encoded output is sensitive key material.

After confirming both the encrypted offline backup **and** all GitHub secrets are configured, delete the temporary `.jks` and `.base64` files from the Codespace, plus any temporary reuploads. Do not rely on file/Codespace deletion as secure erasure or retroactive access revocation.

## 3. Set up the protected GitHub Actions environment

As repository owner, go to **Settings → Environments → New environment** and create the environment named **`android-release`**. Under deployment branches and tags, select **Selected branches and tags** and allow only the **`main` branch**. Enable **Required reviewers** where supported, ideally a separate trusted reviewer. Avoid enabling **Prevent self-review** unless another trusted reviewer can approve. Restrict write access and protect `main` from unreviewed changes. Referencing an environment in YAML is **not** sufficient to configure its protection; do this before triggering any real signed build.

Create these four **environment secrets** (not repository-wide secrets):

| Name | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | The complete Base64-encoded dedicated JKS contents |
| `ANDROID_KEYSTORE_PASSWORD` | Password to open that JKS |
| `ANDROID_KEY_ALIAS` | Upload key alias (for example `castle-role-upload`) |
| `ANDROID_KEY_PASSWORD` | Password of the key inside the JKS |

Create one **environment variable** (not a secret):

| Name | Value |
| --- | --- |
| `ANDROID_EXPECTED_UPLOAD_SHA256` | Public 64-digit SHA-256 upload certificate fingerprint from `keytool -list -v`, optionally colon-separated |

The variable is **mandatory**. After enrolling the app, independently compare it with the **Upload key certificate** shown in **Play Console → App integrity**. The Play *app-signing* certificate may intentionally differ.

GitHub environment approvals and secret redaction lower risk but do not eliminate it. Collaborators who can modify trusted release code/workflows may be able to exfiltrate secrets. Never run production signing against PR heads, forks, or unreviewed commits.

## 4. Produce the signed AAB from your browser

After merging the signed workflow into `main` and finishing Steps 1–3, open [Actions → Build signed Android AAB (protected, manual)](https://github.com/abolfazl2600/Castlegame/actions/workflows/android-signed-aab.yml). Click **Run workflow**, select `main`, and approve the `android-release` environment if required.

The job uses Node.js 22, JDK 21 and Android SDK 36, runs `npm ci` and `npm run android:sync`, then reads the four environment secrets **only in the signing-related steps**. It decodes the JKS in an ephemeral runner directory with directory permissions `0700` and file permissions `0600`. Gradle gets credentials as environment variables, with no credentials in CLI arguments, checked-in Gradle properties, or uploaded artifacts. Signing uses `--no-build-cache --no-configuration-cache`. The temporary JKS is removed best-effort with an `always()` cleanup step.

The verification script `scripts/android/verify-signed-aab.sh` refuses to upload unless it verifies: (a) valid ZIP format, (b) valid JAR signature, (c) the certificate embedded in the AAB matches the JKS upload certificate, and (d) both match `ANDROID_EXPECTED_UPLOAD_SHA256`. Only `app-release.aab` is uploaded as an artifact, not signing keys. Its public upload-certificate fingerprint is printed to the log; a public certificate is **not** the private signing key.

Check the public fingerprint against Google Play Console's upload certificate during the first submission and after upload. The workflow verifies signing authenticity; it cannot independently guarantee Play's policy/metadata acceptance. Nothing is automatically uploaded to Google Play.

## 5. Google Play App Signing and incident recovery

Enroll in **Google Play App Signing**. Google maintains the final **app-signing key** used to sign distributed APKs; your private JKS is a separate **upload key** used to authenticate bundle uploads.

If GitHub Secrets or the Codespace are lost, restore the original JKS and passwords from the encrypted offline backup; verify its public certificate fingerprint; re-create the Base64 transport file in a private Codespace; and reenter the environment secrets. Do not generate a new upload key merely because GitHub Secrets were erased.

If the upload key might be exposed: suspend releases; review Actions logs/runs and workflow edits, permission grants, collaborators and tokens; revoke affected access and credentials; replace affected secrets; and request an **upload key reset** through Play Console once the app is enrolled. Generate and back up the replacement key privately, and confirm Google accepted the changed upload certificate before resuming releases. Merely replacing a GitHub Secret does **not** revoke a compromised upload certificate.

## 6. Review checklist and boundaries

- Only `workflow_dispatch` starts the signing workflow, and only the repository owner on `main` may enter the `android-release` job.
- Repository token permissions are `contents: read`. Actions are pinned to full commit SHAs.
- The existing [unsigned build workflow](./android-aab.md) and debug builds continue without signing secrets.
- The JKS and its Base64 copy must never appear in Git history, CI artifacts/caches, issues, PRs, screenshots, or logs.
- The **real** production upload key is only owner-created and backed up outside GitHub. Any disposable CI signing test key is **not** a substitute for the real key and must not be registered with Google Play.
- Review changes to the release workflow, Git history, upload fingerprint, and protected environment rules before each release.

This issue does not cover automatic store publishing, store listing, privacy/content declarations or production rollout.

## 7. Bazaar/Myket signed APK

To build a directly installed signed APK for Cafe Bazaar or Myket, use the separate [manual protected marketplace APK workflow](./android-marketplace-apk.md). It reuses the same protected environment and JKS but produces an `app-release.apk`, checks it with Android `apksigner`, and **does not change** the Google Play AAB pipeline. Before the first public store release, evaluate cross-store update compatibility if Google Play uses a different distribution signing certificate.
