// Capacitor native bridge.
//
// Single helper module so the rest of the React app can use these features
// without caring whether it's running in a browser, a Capacitor WebView on
// iOS, or one on Android. Each helper falls back gracefully on web.
//
// Pattern: detect via `Capacitor.isNativePlatform()` at runtime — never via
// build-time conditionals — because the same JS bundle is shipped to both
// web (Netlify) and native (cap sync into ios/android projects).

import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Geolocation } from '@capacitor/geolocation';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { App, type URLOpenListenerEvent } from '@capacitor/app';

export const isNative = (): boolean => Capacitor.isNativePlatform();
export const platform = (): 'web' | 'ios' | 'android' => {
  const p = Capacitor.getPlatform();
  return p === 'ios' || p === 'android' ? p : 'web';
};

// ── Haptics ────────────────────────────────────────────────────────────
// On web, Haptics is a no-op (the plugin throws). We swallow errors so
// callers can fire-and-forget without try/catch each time.

export const hapticImpact = async (style: 'light' | 'medium' | 'heavy' = 'medium'): Promise<void> => {
  if (!isNative()) return;
  try {
    const map = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy,
    };
    await Haptics.impact({ style: map[style] });
  } catch {
    /* silently ignore — haptics are nice-to-have */
  }
};

export const hapticSuccess = async (): Promise<void> => {
  if (!isNative()) return;
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch {
    /* ignore */
  }
};

export const hapticWarning = async (): Promise<void> => {
  if (!isNative()) return;
  try {
    await Haptics.notification({ type: NotificationType.Warning });
  } catch {
    /* ignore */
  }
};

// ── Geolocation ────────────────────────────────────────────────────────
// Returns the coords as { lat, lng } so callers don't have to deal with
// platform-specific objects. On web, falls back to navigator.geolocation —
// preserving the existing behavior so AppContext doesn't need to branch.

export interface NativeCoords {
  lat: number;
  lng: number;
  accuracy: number;
}

export const requestGeolocationPermission = async (): Promise<'granted' | 'denied'> => {
  if (!isNative()) {
    // On web, permission is handled implicitly by getCurrentPosition.
    // We return granted optimistically; the actual call will surface the prompt.
    return 'granted';
  }
  try {
    const result = await Geolocation.requestPermissions({ permissions: ['location'] });
    return result.location === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
};

export const getCurrentNativeLocation = async (): Promise<NativeCoords | null> => {
  if (!isNative()) {
    // Caller falls back to web navigator.geolocation
    return null;
  }
  try {
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000,
    });
    return {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    };
  } catch {
    return null;
  }
};

// ── Splash screen ──────────────────────────────────────────────────────
// Hide as soon as React is mounted. Without this, the splash either stays
// up for the configured launchShowDuration (1.5 s) or flashes off-on as
// the WebView loads.

export const hideSplash = async (): Promise<void> => {
  if (!isNative()) return;
  try {
    await SplashScreen.hide({ fadeOutDuration: 200 });
  } catch {
    /* ignore */
  }
};

// ── Status bar ─────────────────────────────────────────────────────────
// On iOS the Info.plist sets UIViewControllerBasedStatusBarAppearance=true
// which means each scene controls its own bar. We just set it once per
// platform on launch.

export const setStatusBarLight = async (): Promise<void> => {
  if (!isNative()) return;
  try {
    await StatusBar.setStyle({ style: Style.Dark }); // Dark = dark icons on light background
    if (platform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#ffffff' });
    }
  } catch {
    /* ignore */
  }
};

// ── Deep links ─────────────────────────────────────────────────────────
// Subscribes to App.appUrlOpen and forwards the path component to the
// caller (typically a React Router navigate). On Capacitor, native taps
// on https://app.petpanic.es/pet/<id> (via Universal Links / App Links)
// fire this event with the full URL.

export const onDeepLink = (
  handler: (path: string) => void
): (() => void) => {
  if (!isNative()) {
    return () => { /* noop */ };
  }
  let cancelled = false;
  const promise = App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
    if (cancelled) return;
    try {
      const url = new URL(event.url);
      // Strip protocol+host, leave only path+search+hash so React Router
      // can navigate to it directly.
      const path = url.pathname + url.search + url.hash;
      handler(path);
    } catch {
      /* malformed URL — ignore */
    }
  });
  return () => {
    cancelled = true;
    promise.then(handle => handle.remove()).catch(() => { /* ignore */ });
  };
};
