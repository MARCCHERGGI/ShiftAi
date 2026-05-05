import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Shift AI — Capacitor configuration.
 *
 * Production strategy: ship the iOS shell pointing at the live web URL
 * (`server.url`). This means every web update reaches users instantly
 * without an App Store re-review, while still giving you a real native
 * app installed from the App Store.
 *
 * Toggle to bundled mode for offline support: comment out `server.url`
 * and run `npm run build && npx next export` (or use `output: "export"`
 * in next.config.ts) to produce a static `out/` directory consumed by
 * Capacitor as `webDir`.
 */
const config: CapacitorConfig = {
  appId: "app.shiftai.client",
  appName: "Shift AI",
  webDir: "out",
  server: {
    url: "https://shiftai-six.vercel.app",
    cleartext: false,
    allowNavigation: ["shiftai-six.vercel.app", "*.vercel.app"],
  },
  ios: {
    contentInset: "always",
    scheme: "Shift AI",
    backgroundColor: "#F2F2F7",
    limitsNavigationsToAppBoundDomains: false,
    preferredContentMode: "mobile",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#F2F2F7",
      iosSpinnerStyle: "small",
      spinnerColor: "#007AFF",
      androidSpinnerStyle: "small",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      overlaysWebView: false,
      style: "DEFAULT",
      backgroundColor: "#F2F2F7",
    },
  },
};

export default config;
