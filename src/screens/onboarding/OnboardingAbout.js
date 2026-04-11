import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

const PILLARS = [
  {
    icon:  'moon-outline',
    color: '#A8D5C2',
    label: 'Spiritual Tradition',
    body:  "Rooted in Qur'an, Sunnah, and the wisdom of Islamic scholars.",
  },
  {
    icon:  'flask-outline',
    color: '#F5C97A',
    label: 'Research-Based',
    body:  'Informed by child development science and peer-reviewed research.',
  },
  {
    icon:  'heart-outline',
    color: '#F4A4A4',
    label: 'Daily Practice',
    body:  'Small, consistent actions that build faithful, compassionate children.',
  },
];

export default function OnboardingAbout({ navigation }) {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  Animated.timing(fadeAnim, {
    toValue: 1, duration: 700, useNativeDriver: true,
    delay: 200,
  }).start();

  return (
    <>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#1B3D2F', '#0D2419']}
        style={[styles.container, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 40 }]}
      >
        <Animated.View style={[styles.inner, { opacity: fadeAnim }]}>

          {/* Heading */}
          <View style={styles.headingWrap}>
            <Text style={styles.heading}>Our Approach</Text>
            <Text style={styles.body}>
              Tarbiyah combines spiritual guidance from the Islamic tradition with scientific
              and research-based insights to help Muslim parents nurture children who are
              faith-centered, compassionate, and productive.
            </Text>
          </View>

          {/* Pillars */}
          <View style={styles.pillars}>
            {PILLARS.map((p, i) => (
              <View key={i} style={styles.pillar}>
                <View style={[styles.iconCircle, { backgroundColor: p.color + '22' }]}>
                  <Ionicons name={p.icon} size={20} color={p.color} />
                </View>
                <View style={styles.pillarText}>
                  <Text style={styles.pillarLabel}>{p.label}</Text>
                  <Text style={styles.pillarBody}>{p.body}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* CTA */}
          <View style={styles.btnWrap}>
            <TouchableOpacity
              style={styles.btn}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('OnboardingName')}
            >
              <Text style={styles.btnText}>Get Started</Text>
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
  headingWrap: {
    gap: 16,
  },
  heading: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  body: {
    fontSize: 16,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 26,
  },
  pillars: {
    gap: 20,
  },
  pillar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pillarText: {
    flex: 1,
    gap: 4,
  },
  pillarLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  pillarBody: {
    fontSize: 13,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 20,
  },
  backBtn: { padding: 4 },
  btnWrap: {
    gap: 12,
  },
  btn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1B3D2F',
    letterSpacing: 0.3,
  },
});
