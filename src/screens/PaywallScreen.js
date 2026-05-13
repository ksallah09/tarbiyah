import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  ScrollView, Animated, Linking, Alert, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../App';
import { getOffering, purchasePackage, restorePurchases } from '../utils/purchases';

const FEATURES = [
  { icon: 'sunny-outline',          text: 'Daily spiritual insights, personalised to your family' },
  { icon: 'apps-outline',           text: 'Child dashboards with weekly growth plans' },
  { icon: 'globe-outline',          text: 'This Week in Youth Culture — live trend data, decoded' },
  { icon: 'layers-outline',         text: 'Learn On Demand — AI audio modules for any challenge' },
  { icon: 'people-outline',         text: 'Family goals and partner leaderboard' },
  { icon: 'chatbubbles-outline',    text: 'Community — parents helping parents' },
];

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const { setHasAccess } = useAuth();
  const [offering, setOffering]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    getOffering().then(o => {
      setOffering(o);
      setLoading(false);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
    });
  }, []);

  const monthlyPackage = offering?.availablePackages?.find(
    p => p.packageType === 'MONTHLY'
  ) ?? offering?.availablePackages?.[0] ?? null;

  const priceString = monthlyPackage?.product?.priceString ?? '$4.99';
  const trialDays   = monthlyPackage?.product?.introPrice?.periodNumberOfUnits ?? 7;

  async function handlePurchase() {
    if (!monthlyPackage) return;
    setPurchasing(true);
    try {
      const granted = await purchasePackage(monthlyPackage);
      if (granted) setHasAccess(true);
    } catch (e) {
      if (!e.userCancelled) {
        Alert.alert('Purchase failed', e.message ?? 'Something went wrong. Please try again.');
      }
    } finally {
      setPurchasing(false);
    }
  }

  async function handleRestore() {
    setRestoring(true);
    try {
      const granted = await restorePurchases();
      if (granted) {
        setHasAccess(true);
      } else {
        Alert.alert('No purchase found', 'We couldn\'t find an active subscription linked to your account.');
      }
    } catch {
      Alert.alert('Restore failed', 'Something went wrong. Please try again.');
    } finally {
      setRestoring(false);
    }
  }

  return (
    <>
      <StatusBar style="light" />
      <LinearGradient colors={['#1B3D2F', '#0D2419']} style={styles.root}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Decorative circle */}
          <View style={styles.decorCircle} />

          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.logoMark}>
                <Text style={styles.logoEmoji}>🌿</Text>
              </View>
              <Text style={styles.appName}>Tarbiyah</Text>
              <Text style={styles.headline}>Raise them with{'\n'}intention.</Text>
              <View style={styles.trialBadge}>
                <Ionicons name="gift-outline" size={13} color="#D4A843" />
                <Text style={styles.trialBadgeText}>{trialDays}-day free trial — no charge until day {trialDays + 1}</Text>
              </View>
            </View>

            {/* Feature list */}
            <View style={styles.featureList}>
              {FEATURES.map((f, i) => (
                <View key={i} style={styles.featureRow}>
                  <View style={styles.featureIconWrap}>
                    <Ionicons name={f.icon} size={17} color="#D4A843" />
                  </View>
                  <Text style={styles.featureText}>{f.text}</Text>
                </View>
              ))}
            </View>

            {/* CTA */}
            <View style={styles.ctaWrap}>
              {loading ? (
                <ActivityIndicator color="#D4A843" style={{ marginVertical: 24 }} />
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.ctaBtn, (purchasing || restoring) && { opacity: 0.7 }]}
                    onPress={handlePurchase}
                    disabled={purchasing || restoring || !monthlyPackage}
                    activeOpacity={0.88}
                  >
                    {purchasing ? (
                      <ActivityIndicator color="#1B3D2F" />
                    ) : (
                      <>
                        <Text style={styles.ctaBtnText}>Start Free Trial</Text>
                        <Text style={styles.ctaBtnSub}>Then {priceString}/month · Cancel anytime</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.restoreBtn}
                    onPress={handleRestore}
                    disabled={purchasing || restoring}
                    activeOpacity={0.7}
                  >
                    {restoring
                      ? <ActivityIndicator size="small" color="rgba(255,255,255,0.4)" />
                      : <Text style={styles.restoreText}>Restore purchase</Text>
                    }
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Legal */}
            <Text style={styles.legal}>
              Payment charged to your {Platform.OS === 'ios' ? 'Apple ID' : 'Google Play'} account at confirmation.
              Subscription automatically renews unless cancelled at least 24 hours before the end of the current period.
              Manage or cancel in your {Platform.OS === 'ios' ? 'App Store' : 'Play Store'} account settings.
            </Text>
            <View style={styles.legalLinks}>
              <TouchableOpacity onPress={() => Linking.openURL('https://tarbiyah.app/privacy')}>
                <Text style={styles.legalLink}>Privacy Policy</Text>
              </TouchableOpacity>
              <Text style={styles.legalDot}>·</Text>
              <TouchableOpacity onPress={() => Linking.openURL('https://tarbiyah.app/terms')}>
                <Text style={styles.legalLink}>Terms of Use</Text>
              </TouchableOpacity>
            </View>

          </Animated.View>
        </ScrollView>
      </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 28, flexGrow: 1 },
  decorCircle: {
    position: 'absolute', width: 300, height: 300, borderRadius: 150,
    borderWidth: 1, borderColor: 'rgba(212,168,67,0.12)', top: -60, right: -80,
  },

  header: { alignItems: 'center', marginBottom: 36 },
  logoMark: {
    width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(212,168,67,0.12)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  logoEmoji:  { fontSize: 26 },
  appName:    { fontSize: 13, fontWeight: '700', color: '#D4A843', letterSpacing: 2.5, marginBottom: 16 },
  headline:   { fontSize: 36, fontWeight: '800', color: '#FFFFFF', textAlign: 'center', lineHeight: 44, marginBottom: 20 },
  trialBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(212,168,67,0.12)', borderRadius: 100,
    paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1, borderColor: 'rgba(212,168,67,0.25)',
  },
  trialBadgeText: { fontSize: 13, color: '#D4A843', fontWeight: '600' },

  featureList: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 18,
    padding: 20, gap: 16, marginBottom: 32,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  featureRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  featureIconWrap: {
    width: 32, height: 32, borderRadius: 9, backgroundColor: 'rgba(212,168,67,0.1)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  featureText: { flex: 1, fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 21, paddingTop: 6 },

  ctaWrap:    { marginBottom: 20 },
  ctaBtn: {
    backgroundColor: '#D4A843', borderRadius: 18,
    paddingVertical: 18, alignItems: 'center', marginBottom: 16,
  },
  ctaBtnText: { fontSize: 17, fontWeight: '800', color: '#1B3D2F', marginBottom: 3 },
  ctaBtnSub:  { fontSize: 12, color: 'rgba(27,61,47,0.7)', fontWeight: '500' },

  restoreBtn:  { alignItems: 'center', paddingVertical: 10 },
  restoreText: { fontSize: 14, color: 'rgba(255,255,255,0.4)', fontWeight: '500' },

  legal: {
    fontSize: 11, color: 'rgba(255,255,255,0.25)', textAlign: 'center',
    lineHeight: 17, marginBottom: 12,
  },
  legalLinks: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  legalLink:  { fontSize: 11, color: 'rgba(255,255,255,0.35)', textDecorationLine: 'underline' },
  legalDot:   { fontSize: 11, color: 'rgba(255,255,255,0.2)' },
});
