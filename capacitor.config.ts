import type { CapacitorConfig } from '@capacitor/cli';

// Native shell config for the iOS + Android Capacitor builds.
// The web build itself is served from `dist/` (static) — no live server URL,
// so deeplinks open the bundled web app directly.
const config: CapacitorConfig = {
  appId: 'com.petpanic.app',
  appName: 'PetPanic',
  webDir: 'dist',

  // Server config: keep web bundle local (security + offline). When testing
  // against a live React dev server, override locally with `cap.config.local.ts`
  // (gitignored) — don't commit a server.url to prod.
  server: {
    androidScheme: 'https',
    // Allow loading the production app.petpanic.es over HTTPS if we ever want
    // to ship a live-update wrapper (right now we ship the bundle).
    allowNavigation: ['app.petpanic.es', '*.petpanic.es'],
  },

  plugins: {
    SplashScreen: {
      // Shown ~1.5 s on app launch with brand orange. Hidden manually from
      // main.tsx after React mounts so the user doesn't see the white flash.
      launchShowDuration: 1500,
      backgroundColor: '#ea580c',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },

    PushNotifications: {
      // FCM (Android) + APNs (iOS) deliver to the SAME `push_subscriptions`
      // table by registering the device's native token alongside the existing
      // Web Push endpoint. Implementation lives in `lib/native-push.ts`.
      // `presentationOptions` controls foreground display on iOS — alert/sound/badge.
      presentationOptions: ['alert', 'sound', 'badge'],
    },

    StatusBar: {
      // Match the brand orange for branded launch + onboarding screens.
      // We adjust dynamically via StatusBar.setStyle() based on the active page.
      style: 'DARK', // dark-content on light background (app is light-themed)
      backgroundColor: '#ffffff',
      overlaysWebView: true, // matches the apple-mobile-web-app-status-bar-style: black-translucent
    },

    Geolocation: {
      // Permission strings are also defined in Info.plist + AndroidManifest;
      // these don't override those, just document intent.
    },
  },
};

export default config;
