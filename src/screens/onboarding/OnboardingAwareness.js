import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

const FEATURES = [
  {
    emoji:  '🚨',
    color:  '#F4A4A4',
    label:  'Safety Watch',
    body:   'Real-time alerts on viral risks, dangerous challenges, and predatory patterns — before they reach your child.',
  },
  {
    emoji:  '📈',
    color:  '#F5C97A',
    label:  'Weekly Culture Digest',
    body:   "Slang, trends, and what kids your child's age are into — refreshed weekly with live data.",
  },
  {
    emoji:  '🔍',
    color:  '#A8D5C2',
    label:  'Islamic Lens',
    body:   'Every alert includes what to say, how to respond, and what to watch for — as a Muslim parent.',
  },
];

export default function OnboardingAwareness({ navigation }) {
  const insets  = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  Animated.timing(fadeAnim, {
    toValue: 1, duration: 700, useNativeDriver: true, delay: 200,
  }).start();

  return (
    <>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#1B3D2F', '#0D2419']}
        style={[styles.container, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 40 }]}
      >
        <Animated.View style={[styles.inner, { opacity: fadeAnim }]}>

          <View style={styles.topGroup}>
            <View style={styles.headingWrap}>
              <Text style={styles.eyebrow}>KNOW THEIR WORLD</Text>
              <Text style={styles.heading}>Nurturing begins with Understanding</Text>
              <Text style={styles.body}>
                The apps they scroll, the trends they follow, the language they use — youth culture moves fast, and the risks are real. You shouldn't have to navigate it alone.
              </Text>
            </View>

            <View style={styles.features}>
              {FEATURES.map((f, i) => (
                <View key={i} style={styles.feature}>
                  <View style={[styles.emojiWrap, { backgroundColor: f.color + '22' }]}>
                    <Text style={styles.emoji}>{f.emoji}</Text>
                  </View>
                  <View style={styles.featureText}>
                    <Text style={styles.featureLabel}>{f.label}</Text>
                    <Text style={styles.featureBody}>{f.body}</Text>
                  </View>
                </View>
              ))}
            </View>

            <Text style={styles.powered}>Powered by Google Trends, YouTube, Reddit, and more</Text>
          </View>

          <View style={styles.btnWrap}>
            <TouchableOpacity
              style={styles.btn}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('OnboardingName')}
            >
              <Text style={styles.btnText}>Continue</Text>
              <Ionicons name="arrow-forward" size={16} color="#1B3D2F" />
            </TouchableOpacity>
          </View>

        </Animated.View>
      </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 32,
  },
  inner: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topGroup: {
    gap: 28,
  },
  headingWrap: {
    gap: 12,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 2,
  },
  heading: {
    fontSize: 30,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
    lineHeight: 38,
  },
  body: {
    fontSize: 15,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 24,
  },
  features: {
    gap: 20,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  emojiWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  emoji: {
    fontSize: 20,
  },
  featureText: {
    flex: 1,
    gap: 4,
  },
  featureLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  featureBody: {
    fontSize: 13,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 20,
  },
  powered: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  btnWrap: {
    gap: 12,
  },
  btn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1B3D2F',
    letterSpacing: 0.3,
  },
});
