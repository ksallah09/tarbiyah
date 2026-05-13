import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { Platform } from 'react-native';

// Replace these with your RevenueCat API keys from the RevenueCat dashboard
const API_KEYS = {
  ios:     'YOUR_REVENUECAT_IOS_API_KEY',
  android: 'YOUR_REVENUECAT_ANDROID_API_KEY',
};

export const ENTITLEMENT_ID = 'premium';

export async function initializePurchases(userId = null) {
  try {
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    const apiKey = Platform.OS === 'ios' ? API_KEYS.ios : API_KEYS.android;
    Purchases.configure({ apiKey });
    if (userId) await Purchases.logIn(userId);
  } catch (e) {
    console.warn('[Purchases] init error:', e);
  }
}

export async function checkEntitlement() {
  try {
    const info = await Purchases.getCustomerInfo();
    return !!info.entitlements.active[ENTITLEMENT_ID];
  } catch {
    // Fail open — don't lock user out on network error
    return true;
  }
}

export async function getOffering() {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current;
  } catch {
    return null;
  }
}

export async function purchasePackage(pkg) {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return !!customerInfo.entitlements.active[ENTITLEMENT_ID];
}

export async function restorePurchases() {
  try {
    const info = await Purchases.restorePurchases();
    return !!info.entitlements.active[ENTITLEMENT_ID];
  } catch {
    return false;
  }
}

export async function loginRevenueCat(userId) {
  try { await Purchases.logIn(userId); } catch {}
}

export async function logoutRevenueCat() {
  try { await Purchases.logOut(); } catch {}
}
