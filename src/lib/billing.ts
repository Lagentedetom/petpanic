// Cobro dentro de las apps nativas (App Store y Google Play) con RevenueCat.
//
// En la web no se usa: allí se sigue cobrando con Stripe (PlanPage). En iOS y
// Android, Apple y Google obligan a vender la suscripción con su propio sistema.
// RevenueCat hace de puente y avisa a Supabase por el webhook
// `revenuecat-webhook`, que es quien activa Social en `profiles`. Por eso aquí
// no se decide nada sobre el acceso: solo se compra, se restaura y se abre la
// gestión de la tienda.
//
// Las claves son las PÚBLICAS del SDK de RevenueCat (appl_… y goog_…), que
// pueden ir en el paquete. Se leen de .env.local:
//   VITE_REVENUECAT_IOS_KEY=appl_…
//   VITE_REVENUECAT_ANDROID_KEY=goog_…
import { Purchases, PURCHASES_ERROR_CODE, type PurchasesPackage } from '@revenuecat/purchases-capacitor';
import { Capacitor } from '@capacitor/core';

const KEYS: Record<string, string | undefined> = {
  ios: import.meta.env.VITE_REVENUECAT_IOS_KEY,
  android: import.meta.env.VITE_REVENUECAT_ANDROID_KEY,
};

export interface StorePlan {
  interval: 'month' | 'year';
  price: string;
  pkg: PurchasesPackage;
}

let configuredFor: string | null = null;

/** True en iOS/Android cuando hay clave de RevenueCat para la plataforma. */
export function storeBillingAvailable(): boolean {
  return Capacitor.isNativePlatform() && !!KEYS[Capacitor.getPlatform()];
}

/** Configura RevenueCat con el id de Supabase, o cambia de usuario si ya estaba configurado. */
export async function initBilling(userId: string): Promise<boolean> {
  if (!storeBillingAvailable()) return false;
  if (configuredFor === userId) return true;
  if (configuredFor === null) {
    await Purchases.configure({ apiKey: KEYS[Capacitor.getPlatform()]!, appUserID: userId });
  } else {
    await Purchases.logIn({ appUserID: userId });
  }
  configuredFor = userId;
  return true;
}

/** Al cerrar sesión: que la siguiente cuenta no herede las compras de esta. */
export async function endBilling(): Promise<void> {
  if (configuredFor === null) return;
  try { await Purchases.logOut(); } catch { /* ya era anónimo */ }
  configuredFor = null;
}

/** Los planes de la tienda con su precio ya formateado en la moneda del usuario. */
export async function getStorePlans(): Promise<StorePlan[]> {
  const offerings = await Purchases.getOfferings();
  const current = offerings.current;
  if (!current) return [];
  const plans: StorePlan[] = [];
  if (current.monthly) plans.push({ interval: 'month', price: current.monthly.product.priceString, pkg: current.monthly });
  if (current.annual) plans.push({ interval: 'year', price: current.annual.product.priceString, pkg: current.annual });
  return plans;
}

export type PurchaseOutcome = 'ok' | 'cancelled' | 'error';

export async function buy(plan: StorePlan): Promise<PurchaseOutcome> {
  try {
    await Purchases.purchasePackage({ aPackage: plan.pkg });
    return 'ok';
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return 'cancelled';
    console.error('[billing] compra fallida:', err);
    return 'error';
  }
}

/** «Restaurar compras»: Apple exige ofrecerlo. Devuelve si hay alguna suscripción activa. */
export async function restore(): Promise<boolean> {
  const { customerInfo } = await Purchases.restorePurchases();
  return Object.keys(customerInfo.entitlements.active).length > 0;
}

/** URL de gestión de la suscripción en la propia tienda (Ajustes del iPhone / Google Play). */
export async function storeManagementUrl(): Promise<string | null> {
  const { customerInfo } = await Purchases.getCustomerInfo();
  return customerInfo.managementURL;
}
