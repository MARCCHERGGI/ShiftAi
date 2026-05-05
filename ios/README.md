# Shift AI — iOS / App Store build

This folder contains everything needed to ship Shift AI to the App Store **except** the steps that require a Mac.

## What's prepped here (Windows-side)

| Asset | Path | Purpose |
|---|---|---|
| Capacitor config | `../capacitor.config.ts` | Bundle ID, app name, plugin config, points iOS shell at the live web URL |
| App icon source | `../public/icon-source.svg` | 1024×1024 master |
| Generated icons | `../public/icons/` + `../resources/icon-only.png` | All iOS sizes (20–1024) including 1024×1024 opaque source for Capacitor Assets |
| Splash master | `../resources/splash.png` | 2732×2732 splash for `@capacitor/assets` |
| Privacy manifest | `PrivacyInfo.xcprivacy` | Required by App Store since iOS 17 |
| Info.plist additions | `Info.plist.template` | Display name, version, orientations, NSPhotoLibrary/NSCamera usage strings, ATS lock, encryption declaration |
| Privacy policy | `https://shiftai-six.vercel.app/privacy` | Required URL for App Store Connect |
| Terms of service | `https://shiftai-six.vercel.app/terms` | Required URL for App Store Connect |
| Support page | `https://shiftai-six.vercel.app/support` | Required URL for App Store Connect |

## What you do on the Mac

```bash
# 1. Clone this repo on the Mac
git clone <this-repo>
cd shiftai_apple
npm ci

# 2. Build the web app (or skip if using server.url)
npm run build

# 3. Add the iOS native project
npx cap add ios

# 4. Generate iOS icons + splashes from /resources
npm install -g @capacitor/assets
npx capacitor-assets generate --ios

# 5. Copy the privacy manifest into the iOS project
cp ios/PrivacyInfo.xcprivacy ios/App/App/PrivacyInfo.xcprivacy

# 6. Merge Info.plist.template into ios/App/App/Info.plist
#    (most editors can do this; or hand-merge the keys)

# 7. Open Xcode
npx cap open ios

# 8. In Xcode:
#    - Select the App target
#    - Signing & Capabilities → set Team to your Apple Developer account
#    - Set Bundle Identifier (must match capacitor.config.ts: app.shiftai.client)
#    - Product → Archive
#    - Distribute App → App Store Connect → Upload

# 9. In App Store Connect:
#    - Create the app (Bundle ID: app.shiftai.client)
#    - Fill in metadata, screenshots (5 device sizes minimum)
#    - Privacy Policy URL: https://shiftai-six.vercel.app/privacy
#    - Support URL:        https://shiftai-six.vercel.app/support
#    - Terms URL:          https://shiftai-six.vercel.app/terms
#    - Submit for review
```

## Hard prerequisites

1. **Apple Developer account** — $99/year at developer.apple.com
2. **Mac with Xcode 16+** — required for `xcodebuild archive` and signing
   - No Mac? Options: MacStadium ($59/mo cloud Mac), MacInCloud ($30/mo), or a GitHub Actions macOS runner ($0.08/min)
3. **App Store Connect access** — created automatically with your Apple Developer account

## Estimated review timeline

- First submission: 1–3 days for typical review
- Common rejection reasons we've already addressed: missing privacy policy, missing privacy manifest, encryption declaration, ATS allowing arbitrary loads, missing usage strings for camera/photos

## Mode toggle: hosted vs bundled

Currently `capacitor.config.ts` ships the iOS app pointing at the **live Vercel URL** (`server.url`). Pros:
- Web changes reach users instantly, no resubmission
- Tiny app bundle (just the shell)
- One source of truth (the deployed Next app)

Cons:
- Requires internet on first launch
- Apple may push back during review on apps that are "just a website"

If review pushes back, switch to bundled mode:
1. Comment out the `server` block in `capacitor.config.ts`
2. Add `output: "export"` to `next.config.ts`
3. `npm run build` produces `/out`
4. `npx cap copy ios`
5. App now ships fully offline-capable; subsequent web updates require a new App Store build
