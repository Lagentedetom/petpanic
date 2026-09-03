import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from './supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export async function requestNotificationPermission(userId: string): Promise<boolean> {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return false;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  if (!VAPID_PUBLIC_KEY) {
    console.warn('VAPID key not configured. Set VITE_VAPID_PUBLIC_KEY in .env.local');
    return true;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    const sub = subscription.toJSON();
    await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      endpoint: sub.endpoint!,
      p256dh: sub.keys!.p256dh,
      auth: sub.keys!.auth,
    }, { onConflict: 'endpoint' });

    // LO-01 fix: success path silent. Errors still log.
    return true;
  } catch (err) {
    console.error('Error subscribing to push:', err);
    return false;
  }
}

export function getNotificationPermissionState(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

// ── Native push (iOS/Android via @capacitor/push-notifications) ──
// The web Notification/Push APIs don't exist in the iOS WKWebView, so native
// builds register with APNs directly. The device token lands in the same
// push_subscriptions table tagged with `platform`, so the send-alert-push edge
// function routes it to APNs instead of Web Push.

let nativePushRegistered = false;

export async function registerNativePush(
  userId: string,
  onTap?: (path: string) => void,
): Promise<void> {
  if (!Capacitor.isNativePlatform() || nativePushRegistered) return;
  nativePushRegistered = true;

  try {
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== 'granted') {
      nativePushRegistered = false; // leave the door open for a later retry
      return;
    }

    await PushNotifications.addListener('registration', (token) => {
      void supabase.from('push_subscriptions').upsert(
        {
          user_id: userId,
          platform: Capacitor.getPlatform(),
          device_token: token.value,
        },
        { onConflict: 'device_token' },
      );
    });

    await PushNotifications.addListener('registrationError', (err) => {
      console.error('Native push registration error:', err);
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const alertId = action.notification.data?.alertId;
      if (alertId && onTap) onTap(`/alerts/${alertId}`);
    });

    await PushNotifications.register();
  } catch (err) {
    console.error('Native push setup failed:', err);
    nativePushRegistered = false;
  }
}
