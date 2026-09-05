import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOUR_KEY = 'tarbiyah_family_tour_seen_v2';
const TAB_LABELS = ['Activities', 'Child Growth', 'Dashboard', 'Parenting'];

const STEPS = [
  {
    tab: 0,
    title: 'Family Activities',
    body: "Play Islamic Heads Up or Next Ayah together, explore Conversation Cards to spark meaningful conversations, and follow each child's personalised Growth Activities — all in one place.",
    cta: 'Next →',
  },
  {
    tab: 1,
    title: 'Child Growth',
    body: "Track each child's wins and accomplishments. Tap any child to open their dashboard and see their personalised weekly growth plan.",
    cta: 'Next →',
  },
  {
    tab: 2,
    title: 'Family Dashboard',
    body: "Your family's progress at a glance — habit streaks, parenting accomplishments, and partner stats all in one view.",
    cta: 'Next →',
  },
  {
    tab: 3,
    title: 'Your Parenting',
    body: "Track your own daily parenting habits and steps. Your consistency here is what shapes your children's character.",
    cta: 'Next →',
  },
  {
    tab: null,
    showConfigureMock: true,
    title: 'Configure Family',
    body: 'Tap the Configure Family button at the top of the Family tab to add children, set family goals, and connect with your partner.',
    cta: 'Got it!',
  },
];

export default function FamilyTourOverlay() {
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

        {/* Segment mockup / Configure header mockup */}
        {current.showConfigureMock ? (
          <Animated.View style={[s.mockHeader, { opacity: fadeAnim }]}>
            <Text style={s.mockHeaderTitle}>Family</Text>
            <View style={s.mockConfigureBtn}>
              <Text style={s.mockConfigureBtnLabel}>Configure Family</Text>
              <Text style={s.mockConfigureBtnSub}>Children & goals</Text>
            </View>
          </Animated.View>
        ) : (
          <Animated.View style={[s.mockSegment, { opacity: fadeAnim }]}>
            {TAB_LABELS.map((label, i) => (
              <View key={label} style={[s.mockTab, current.tab === i && s.mockTabActive]}>
                <Text style={[s.mockTabText, current.tab === i && s.mockTabTextActive]}>
                  {label}
                </Text>
              </View>
            ))}
          </Animated.View>
        )}

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

  mockSegment: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  mockTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 100,
    backgroundColor: '#F3F4F6',
  },
  mockTabActive: {
    backgroundColor: '#1B3D2F',
  },
  mockTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  mockTabTextActive: {
    color: '#FFFFFF',
  },

  // Configure header mockup
  mockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  mockHeaderTitle: {
    fontSize: 18, fontWeight: '800', color: '#1A1A2E',
  },
  mockConfigureBtn: {
    backgroundColor: '#EDF7F2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'flex-end',
    borderWidth: 2,
    borderColor: '#2E7D62',
  },
  mockConfigureBtnLabel: { fontSize: 13, fontWeight: '700', color: '#1B3D2F' },
  mockConfigureBtnSub:   { fontSize: 11, color: '#2E7D62', marginTop: 1 },

  title:    { fontSize: 19, fontWeight: '800', color: '#1A1A2E', marginBottom: 8 },
  body:     { fontSize: 14, color: '#6B7280', lineHeight: 22, marginBottom: 22 },
  actions:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  skipText: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },
  nextBtn:  { backgroundColor: '#1B3D2F', borderRadius: 14, paddingHorizontal: 22, paddingVertical: 12 },
  nextText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
