import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const SCREEN_W = Dimensions.get('window').width;
const TOUR_KEY = 'tarbiyah_family_tour_seen';

const STEPS = [
  {
    arrowSide: 'left',
    title: 'Progress Board',
    body: 'Your family\'s live snapshot — children\'s wins, shared family goals, and partner activity all in one place.',
    cta: 'Next →',
  },
  {
    arrowSide: 'right',
    title: 'Configure',
    body: 'This is where you manage your family — add children, set family goals, and connect with your partner.',
    cta: 'Got it!',
  },
];

export default function FamilyTourOverlay({ segmentY, segmentH }) {
  const [step, setStep] = useState(null);
  const bounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AsyncStorage.getItem(TOUR_KEY).then(val => {
      if (!val) setStep(0);
    });
  }, []);

  useEffect(() => {
    if (step === null) return;
    bounceAnim.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: -10, duration: 450, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0,   duration: 450, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [step]);

  async function dismiss() {
    await AsyncStorage.setItem(TOUR_KEY, 'true');
    setStep(null);
  }

  function advance() {
    if (step === 0) setStep(1);
    else dismiss();
  }

  if (step === null || segmentY == null) return null;

  const current = STEPS[step];
  const arrowX = current.arrowSide === 'left' ? SCREEN_W * 0.25 : SCREEN_W * 0.75;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={{ height: segmentY, backgroundColor: 'rgba(0,0,0,0.7)' }} pointerEvents="none" />
      <View style={{ height: segmentH, backgroundColor: 'rgba(0,0,0,0.15)' }} pointerEvents="none" />
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' }} pointerEvents="box-none">
        <Animated.View
          style={[s.arrowWrap, { left: arrowX - 13, transform: [{ translateY: bounceAnim }] }]}
          pointerEvents="none"
        >
          <Ionicons name="arrow-up" size={28} color="#4ADE80" />
        </Animated.View>

        <View style={s.callout}>
          <View style={s.stepRow}>
            {STEPS.map((_, i) => (
              <View key={i} style={[s.dot, i === step && s.dotActive]} />
            ))}
          </View>

          <Text style={s.title}>{current.title}</Text>
          <Text style={s.body}>{current.body}</Text>

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
    </View>
  );
}

const s = StyleSheet.create({
  arrowWrap: { position: 'absolute', top: 10 },
  callout: {
    position: 'absolute',
    bottom: 36, left: 20, right: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 22, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3, shadowRadius: 24, elevation: 14,
  },
  stepRow:   { flexDirection: 'row', gap: 6, marginBottom: 16 },
  dot:       { height: 6, width: 6, borderRadius: 3, backgroundColor: '#E5E7EB' },
  dotActive: { width: 20, backgroundColor: '#2E7D62' },
  title:     { fontSize: 19, fontWeight: '800', color: '#1A1A2E', marginBottom: 8 },
  body:      { fontSize: 14, color: '#6B7280', lineHeight: 22, marginBottom: 22 },
  actions:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  skipText:  { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },
  nextBtn:   { backgroundColor: '#1B3D2F', borderRadius: 14, paddingHorizontal: 22, paddingVertical: 12 },
  nextText:  { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
