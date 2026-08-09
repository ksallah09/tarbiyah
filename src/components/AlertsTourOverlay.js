import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOUR_KEY = 'tarbiyah_alerts_tour_seen';

const STEPS = [
  {
    title: 'Safety Alerts',
    body: 'We connect to Google Trends, Reddit, and social media providers weekly — surfacing the threats most relevant to Muslim families, decoded and age-appropriate.',
    cta: 'Next →',
    mockup: 'intro',
  },
  {
    title: 'Priority Levels',
    body: "Every alert is rated based on it's level of harm.",
    cta: 'Next →',
    mockup: 'severity',
  },
  {
    title: 'Filter by Age',
    body: 'Narrow alerts to what matters for your child\'s age group — so you only see what\'s relevant to your family right now.',
    cta: 'Got it!',
    mockup: 'age',
  },
];

const SEVERITY_BADGES = [
  { label: 'HIGH',      bg: '#EF4444', text: '#FFFFFF' },
  { label: 'IMPORTANT', bg: '#F59E0B', text: '#FFFFFF' },
  { label: 'WATCH',     bg: '#3B82F6', text: '#FFFFFF' },
];

const AGE_LABELS = ['All', '5–8', '9–12', '13–15', '16+'];

export default function AlertsTourOverlay() {
  const [step, setStep] = useState(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    AsyncStorage.getItem(TOUR_KEY).then(val => {
      if (!val) setStep(0);
    });
  }, []);

  async function dismiss() {
    await AsyncStorage.setItem(TOUR_KEY, 'true');
    setStep(null);
  }

  function advance() {
    if (step < STEPS.length - 1) {
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
      setStep(step + 1);
    } else {
      dismiss();
    }
  }

  if (step === null) return null;

  const current = STEPS[step];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={s.backdrop} pointerEvents="none" />

      <View style={s.callout}>
        {/* Step dots */}
        <View style={s.stepRow}>
          {STEPS.map((_, i) => (
            <View key={i} style={[s.dot, i === step && s.dotActive]} />
          ))}
        </View>

        {/* Mockup */}
        <Animated.View style={{ opacity: fadeAnim }}>
          {current.mockup === 'intro' && (
            <View style={s.mockRow}>
              <View style={[s.mockPill, s.mockPillActive]}>
                <Text style={[s.mockPillText, s.mockPillTextActive]}>All</Text>
              </View>
              {['High', 'Important', 'Watch'].map(f => (
                <View key={f} style={s.mockPill}>
                  <Text style={s.mockPillText}>{f}</Text>
                </View>
              ))}
            </View>
          )}

          {current.mockup === 'severity' && (
            <View style={s.severityList}>
              {SEVERITY_BADGES.map(b => (
                <View key={b.label} style={s.severityRow}>
                  <View style={[s.badge, { backgroundColor: b.bg }]}>
                    <Text style={[s.badgeText, { color: b.text }]}>{b.label}</Text>
                  </View>
                  <Text style={s.severityDesc}>
                    {b.label === 'HIGH'      && 'Direct harm risk — act now'}
                    {b.label === 'IMPORTANT' && 'Moderate harm potential'}
                    {b.label === 'WATCH'     && 'Low risk — stay informed'}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {current.mockup === 'age' && (
            <View style={s.mockRow}>
              {AGE_LABELS.map((label, i) => (
                <View key={label} style={[s.mockPill, i === 0 && s.mockPillActive]}>
                  <Text style={[s.mockPillText, i === 0 && s.mockPillTextActive]}>{label}</Text>
                </View>
              ))}
            </View>
          )}
        </Animated.View>

        {/* Content */}
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={s.title}>{current.title}</Text>
          <Text style={s.body}>{current.body}</Text>
        </Animated.View>

        <View style={s.actions}>
          <TouchableOpacity onPress={dismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={s.skipText}>Skip tour</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.nextBtn} onPress={advance} activeOpacity={0.85}>
            <Text style={s.nextText}>{current.cta}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  callout: {
    position: 'absolute',
    bottom: 36, left: 20, right: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 22, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3, shadowRadius: 24, elevation: 14,
  },
  stepRow:   { flexDirection: 'row', gap: 6, marginBottom: 20 },
  dot:       { height: 6, width: 6, borderRadius: 3, backgroundColor: '#E5E7EB' },
  dotActive: { width: 20, backgroundColor: '#2E7D62' },

  // Pill filter mockup (intro + age)
  mockRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  mockPill:         { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100, backgroundColor: '#F3F4F6' },
  mockPillActive:   { backgroundColor: '#1B3D2F' },
  mockPillText:     { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  mockPillTextActive: { color: '#FFFFFF' },

  // Severity legend mockup
  severityList: { gap: 10, marginBottom: 20 },
  severityRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge:        { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  badgeText:    { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  severityDesc: { fontSize: 13, color: '#6B7280', fontWeight: '500' },

  title:    { fontSize: 19, fontWeight: '800', color: '#1A1A2E', marginBottom: 8 },
  body:     { fontSize: 14, color: '#6B7280', lineHeight: 22, marginBottom: 22 },
  actions:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  skipText: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },
  nextBtn:  { backgroundColor: '#1B3D2F', borderRadius: 14, paddingHorizontal: 22, paddingVertical: 12 },
  nextText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
