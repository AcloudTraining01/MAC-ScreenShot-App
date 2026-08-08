# Code Signing & Notarization Setup

One-time setup. Once done, every release is signed with your Developer ID and notarized
by Apple, and the build pipeline needs no further attention.

## Why this matters here

Beyond removing the "unidentified developer" warning, signing fixes a bug this app has
been fighting since the beginning.

macOS keys Screen Recording permission to an app's **code hash**. Ad-hoc signing
(`identity: null`) produces a different hash on every build, so every rebuild silently
revoked the grant — which is what the stale-TCC repair dialog in `platform.mac.ts` exists
to work around. A stable Developer ID signature makes the grant persist permanently.

This matters most during **study Phase 1**, when the ScreenCaptureKit recorder is under
active development and you're rebuilding constantly against a permission you need.

---

## What you need

| Purpose | Credential | Cost |
|---|---|---|
| Signing | Developer ID Application certificate (`.p12`) | Apple Developer Program, $99/yr |
| Notarizing | App Store Connect API key (`.p8`) | Free, included |

Enrol at <https://developer.apple.com/programs/>. Approval usually takes 24–48 hours; an
individual enrolment can be quicker than an organisation one.

---

## Step 1 — Developer ID Application certificate

Easiest path is through Xcode:

1. **Xcode → Settings → Accounts**, sign in with your Apple ID
2. Select your team → **Manage Certificates…**
3. Click **+** → **Developer ID Application**

> Pick **Developer ID Application**, not "Mac Development" or "Apple Distribution".
> Only Developer ID works for apps distributed outside the Mac App Store.

Then export it:

1. Open **Keychain Access** → **login** keychain → **My Certificates**
2. Find `Developer ID Application: <your name> (<TEAMID>)`
3. Right-click → **Export…** → save as `.p12`, set a strong password

Confirm it landed:

```bash
security find-identity -v -p codesigning
# should list: "Developer ID Application: Your Name (ABCDE12345)"
```

That 10-character code in parentheses is your **Team ID**.

Base64-encode the certificate for CI:

```bash
base64 -i /path/to/cert.p12 | pbcopy   # now on your clipboard
```

---

## Step 2 — App Store Connect API key (notarization)

This is electron-builder's [recommended method](https://github.com/electron-userland/electron-builder/issues/7859)
— it's revocable, scoped to this one purpose, and never involves your account password.

1. Go to <https://appstoreconnect.apple.com/access/integrations/api>
2. **Team Keys** tab → **+**
3. Name it something like `SnapForge Notarization`, give it the **Developer** role
4. **Generate**, then **Download** the `.p8`

> ⚠️ **The `.p8` downloads exactly once.** Apple will not let you download it again.
> Store it somewhere safe before leaving the page.

Record three values:

| Value | Where |
|---|---|
| **Key ID** | 10 characters, shown in the keys table |
| **Issuer ID** | UUID at the top of the Keys page |
| **The `.p8` contents** | `cat AuthKey_XXXXXXXXXX.p8` |

---

## Step 3 — Add the repository secrets

GitHub → repo → **Settings → Secrets and variables → Actions → New repository secret**.

| Secret | Value |
|---|---|
| `CSC_LINK` | base64 of the `.p12` from Step 1 |
| `CSC_KEY_PASSWORD` | the password you set when exporting the `.p12` |
| `APPLE_API_KEY_P8` | full contents of the `.p8`, including the BEGIN/END lines |
| `APPLE_API_KEY_ID` | the Key ID |
| `APPLE_API_ISSUER` | the Issuer ID |

The workflow degrades gracefully: with no secrets it still produces a working ad-hoc
build, and reports that it did. Nothing breaks while you're waiting on Apple.

---

## Step 4 — Verify

Trigger **Actions → Build macOS Installer → Run workflow**. The *Verify signature and
notarization* step should print:

```
Authority=Developer ID Application: Your Name (ABCDE12345)
✓ Gatekeeper accepted — notarized release build.
```

If it says `⚠ Gatekeeper rejected — this is an ad-hoc build`, a secret is missing or
misnamed.

Check a downloaded artifact yourself:

```bash
spctl -a -vvv /Applications/SnapForge.app     # expect: accepted, source=Notarized Developer ID
codesign -dvvv /Applications/SnapForge.app 2>&1 | grep Authority
```

---

## Local signed builds (optional)

With the certificate in your keychain, `npm run build:mac` finds it automatically — no
configuration needed. To notarize locally too, export the API key vars first:

```bash
export APPLE_API_KEY=~/private_keys/AuthKey_XXXXXXXXXX.p8
export APPLE_API_KEY_ID=XXXXXXXXXX
export APPLE_API_ISSUER=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
npm run build:mac
```

Notarization adds a few minutes — Apple's service has to accept the upload and return a
ticket. For day-to-day development just skip it; the ad-hoc path is fine locally.

To force an unsigned build while a certificate *is* installed:

```bash
CSC_IDENTITY_AUTO_DISCOVERY=false npm run build:mac
```

---

## How the pieces fit

- **`electron-builder.config.js`** — `identity` is deliberately unset so a certificate is
  auto-discovered. `notarize` is a boolean; credentials come from the environment, and
  the config enables it only when a complete credential set is present.
- **`scripts/afterSign.cjs`** — detects a Developer ID signature and *leaves it alone*
  (re-signing would break notarization). It only ad-hoc signs when there's no certificate,
  and fails the build if a required entitlement is missing.
- **`.github/workflows/build-macos.yml`** — writes the `.p8` to `RUNNER_TEMP` (outside the
  workspace, so it can't be packaged into the app) and exports `APPLE_API_KEY` as the path
  to it.

---

## After the first notarized release

Once a build comes back Gatekeeper-accepted, the workarounds in the user docs are obsolete
and should be removed:

- `README.md` — the "If you see SnapForge is damaged" section and the right-click → Open note
- `INSTALL.md` — the Gatekeeper warning section and the `xattr -cr` instructions

The stale-TCC repair flow in `src/main/platform/platform.mac.ts` can also be simplified,
though it's worth keeping for unsigned local development builds.

---

## Troubleshooting

**`No identity found`** — the certificate isn't in the keychain, or it's the wrong type.
Re-check `security find-identity -v -p codesigning` for a *Developer ID Application* entry.

**Notarization rejected** — download the log for the specific reason:
```bash
xcrun notarytool log <submission-id> \
  --key ~/private_keys/AuthKey_XXXXXXXXXX.p8 \
  --key-id XXXXXXXXXX --issuer <issuer-uuid>
```
Most common causes here: an unsigned nested binary (the bundled recorder / whisper /
ffmpeg helpers must each be signed — `scripts/afterSign.cjs` covers this), or hardened
runtime disabled.

**Signed and notarized but Gatekeeper still rejects** — the ticket may not be stapled.
`xcrun stapler staple /Applications/SnapForge.app`, then re-run `spctl`.

**Certificate expired** — Developer ID certificates last 5 years. Already-notarized builds
keep working; you just can't sign new ones until you renew.
