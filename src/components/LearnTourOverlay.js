import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const TOUR_KEY = 'tarbiyah_learn_tour_seen';

const STEPS = [
  {
    title: 'Learn On Demand',
    body: 'Describe any parenting challenge and get a full learning module — tailored to your situation and ready to listen to hands-free.',
    cta: 'Next →',
    mockup: 'intro',
  },
  {
    title: 'Start With a Topic',
    body: 'Pick a suggested challenge or type your own in your own words — no perfect phrasing needed.',
    cta: 'Next →',
    mockup: 'prompts',
  },
  {
    title: 'Your Learning Library',
    body: 'Every module you generate is saved here. Pick up where you left off or explore a new topic whenever you need it.',
    cta: 'Got it!',
    mockup: 'library',
  },
];

const SAMPLE_PROMPTS = [
  'My child has a lot of anger and tantrums',
  'I want to build a stronger connection with my teen',
  'My child is struggling with screen time',
];

export default function LearnTourOverlay() {
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
            <View style={s.introBtnWrap}>
              <View style={s.introBtn}>
                <Ionicons name="add" size={16} color="#FFFFFF" />
                <Text style={s.introBtnText}>New Topic</Text>
              </View>
              <Text style={s.introHint}>Tap to generate a module on any topic</Text>
            </View>
          )}

          {current.mockup === 'prompts' && (
            <View style={s.promptList}>
              {SAMPLE_PROMPTS.map((p, i) => (
                <View key={i} style={s.promptChip}>
                  <Ionicons name="chatbubble-ellipses-outline" size={13} color="#2E7D62" />
                  <Text style={s.promptText} numberOfLines={1}>{p}</Text>
                </View>
              ))}
            </View>
          )}

          {current.mockup === 'library' && (
            <View style={s.mockModule}>
              <View style={s.mockModuleBar} />
              <View style={s.mockModuleBody}>
                <View style={s.mockStatusPill}>
                  <View style={s.mockStatusDot} />
                  <Text style={s.mockStatusText}>In progress</Text>
                </View>
                <Text style={s.mockModuleTitle}>My child has a lot of anger and tantrums</Text>
                <Text style={s.mockModuleMeta}>4 lessons · 18 min</Text>
              </View>
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

  // Step 1 — intro
  introBtnWrap: { alignItems: 'flex-start', gap: 8, marginBottom: 20 },
  introBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#1B3D2F', borderRadius: 100,
    paddingHorizontal: 18, paddingVertical: 10,
  },
  introBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  introHint:    { fontSize: 12, color: '#9CA3AF' },

  // Step 2 — prompts
  promptList: { gap: 8, marginBottom: 20 },
  promptChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F0F7F4', borderRadius: 100,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  promptText: { fontSize: 13, color: '#1B3D2F', fontWeight: '500', flex: 1 },

  // Step 3 — library mock card
  mockModule: {
    borderRadius: 14, backgroundColor: '#F9FAFB',
    overflow: 'hidden', marginBottom: 20,
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  mockModuleBar:   { height: 3, backgroundColor: '#2E7D62', width: '45%' },
  mockModuleBody:  { padding: 14, gap: 6 },
  mockStatusPill:  { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
  mockStatusDot:   { width: 6, height: 6, borderRadius: 3, backgroundColor: '#2E7D62' },
  mockStatusText:  { fontSize: 11, fontWeight: '600', color: '#2E7D62' },
  mockModuleTitle: { fontSize: 14, fontWeight: '700', color: '#111827', lineHeight: 20 },
  mockModuleMeta:  { fontSize: 12, color: '#9CA3AF' },

  title:    { fontSize: 19, fontWeight: '800', color: '#1A1A2E', marginBottom: 8 },
  body:     { fontSize: 14, color: '#6B7280', lineHeight: 22, marginBottom: 22 },
  actions:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  skipText: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },
  nextBtn:  { backgroundColor: '#1B3D2F', borderRadius: 14, paddingHorizontal: 22, paddingVertical: 12 },
  nextText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
