import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOUR_KEY = 'tarbiyah_media_tour_seen';

const STEPS = [
  {
    title: 'Media Check',
    body: 'Search any movie, show, book, or game and we\'ll tell you if it\'s compatible with Islamic values — personalised for your child.',
    cta: 'Next →',
    mockup: 'categories',
  },
  {
    title: 'Instant Verdict',
    body: 'Every check returns a clear verdict with specific flags — so you know exactly what to watch for before they watch, read, or play.',
    cta: 'Next →',
    mockup: 'verdict',
  },
  {
    title: 'Who\'s Watching?',
    body: 'Select which child you\'re checking for and the result is tailored to their age and stage — not a one-size-fits-all answer.',
    cta: 'Got it!',
    mockup: 'who',
  },
];

const CATEGORIES = ['Movie', 'Show', 'Book', 'Game'];

const VERDICTS = [
  { label: 'Muslim Friendly', dot: '#22C55E', bg: '#F0FDF4', border: '#BBF7D0', text: '#166534' },
  { label: 'Watch with Caution', dot: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A', text: '#92400E' },
  { label: 'Not Recommended', dot: '#EF4444', bg: '#FEF2F2', border: '#FECACA', text: '#991B1B' },
];

export default function MediaTourOverlay() {
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
          {current.mockup === 'categories' && (
            <View style={s.mockRow}>
              {CATEGORIES.map((cat, i) => (
                <View key={cat} style={[s.mockPill, i === 0 && s.mockPillActive]}>
                  <Text style={[s.mockPillText, i === 0 && s.mockPillTextActive]}>{cat}</Text>
                </View>
              ))}
            </View>
          )}

          {current.mockup === 'verdict' && (
            <View style={s.verdictList}>
              {VERDICTS.map(v => (
                <View key={v.label} style={[s.verdictRow, { backgroundColor: v.bg, borderColor: v.border }]}>
                  <View style={[s.verdictDot, { backgroundColor: v.dot }]} />
                  <Text style={[s.verdictLabel, { color: v.text }]}>{v.label}</Text>
                </View>
              ))}
            </View>
          )}

          {current.mockup === 'who' && (
            <View style={s.whoRow}>
              {['Adam (8)', 'Aisha (11)', 'Someone else'].map((name, i) => (
                <View key={name} style={[s.whoChip, i === 0 && s.whoChipActive]}>
                  <Text style={[s.whoChipText, i === 0 && s.whoChipTextActive]}>{name}</Text>
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

  // Category pills mockup
  mockRow:            { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  mockPill:           { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100, backgroundColor: '#F3F4F6' },
  mockPillActive:     { backgroundColor: '#1B3D2F' },
  mockPillText:       { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  mockPillTextActive: { color: '#FFFFFF' },

  // Verdict mockup
  verdictList:  { gap: 8, marginBottom: 20 },
  verdictRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  verdictDot:   { width: 8, height: 8, borderRadius: 4 },
  verdictLabel: { fontSize: 13, fontWeight: '700' },

  // Who's watching mockup
  whoRow:           { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  whoChip:          { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  whoChipActive:    { backgroundColor: '#1B3D2F', borderColor: '#1B3D2F' },
  whoChipText:      { fontSize: 13, fontWeight: '600', color: '#374151' },
  whoChipTextActive:{ color: '#FFFFFF' },

  title:    { fontSize: 19, fontWeight: '800', color: '#1A1A2E', marginBottom: 8 },
  body:     { fontSize: 14, color: '#6B7280', lineHeight: 22, marginBottom: 22 },
  actions:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  skipText: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },
  nextBtn:  { backgroundColor: '#1B3D2F', borderRadius: 14, paddingHorizontal: 22, paddingVertical: 12 },
  nextText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
