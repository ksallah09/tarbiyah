import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOUR_KEY = 'tarbiyah_family_tour_seen_v4';
const TAB_LABELS = ['Child Growth', 'Activities', 'Dashboards', 'Parenting'];

const STEPS = [
  {
    tab: 0,
    title: 'Child Growth',
    body: "Track each child's accomplishments and watch their tree grow as they earn points. Everything you log here builds your shared family story.",
    cta: 'Next →',
  },
  {
    showFeedMock: true,
    title: 'Family Feed',
    body: "Every accomplishment, shukr moment, and reflection is posted to your Family Feed — a living record of your children's growth you can both look back on.",
    cta: 'Next →',
  },
  {
    showMuhasabahMock: true,
    title: 'Nightly Muhasabah',
    body: "Each night, sit with your child and walk through a short reflection together — what went well, what to improve, and a positive intention for tomorrow. They earn points and you get a personalised Islamic reminder.",
    cta: 'Next →',
  },
  {
    tab: 1,
    title: 'Family Activities',
    body: "Play Islamic Heads Up or Next Ayah together, explore Conversation Cards to spark meaningful conversations, and follow each child's personalised Growth Activities.",
    cta: 'Next →',
  },
  {
    tab: 2,
    title: 'Dashboards',
    body: "Your family's progress at a glance — habit streaks, activity logs, and partner stats all in one view.",
    cta: 'Next →',
  },
  {
    tab: 3,
    title: 'Your Parenting',
    body: "See your weekly wins, your partner's recommendations, and your shared family goals. Your consistency here is what shapes your children's character.",
    cta: 'Next →',
  },
  {
    showConfigureMock: true,
    title: 'Configure Family',
    body: "Tap 'Configure Family' above to add children, set family goals, and connect with your co-parent.",
    cta: 'Got it!',
  },
];

function FeedMock() {
  return (
    <View style={s.mockCard}>
      <View style={s.feedRow}>
        <View style={s.feedDot} />
        <Text style={s.feedType}>ACCOMPLISHMENT</Text>
      </View>
      <Text style={s.feedChild}>Yusuf · today</Text>
      <Text style={s.feedText}>Helped his little sister with her homework without being asked 🌟</Text>
      <View style={s.feedActions}>
        <View style={s.feedLoveBtn}>
          <Ionicons name="heart" size={13} color="#E53E3E" />
          <Text style={s.feedLoveCount}>2</Text>
        </View>
        <Text style={s.feedSeeAll}>View Family Feed →</Text>
      </View>
    </View>
  );
}

function MuhasabahMock() {
  return (
    <View style={s.mockCard}>
      <View style={s.muhasabahHeader}>
        <Text style={s.muhasabahEmoji}>🌙</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.muhasabahTitle}>Nightly Muhasabah</Text>
          <Text style={s.muhasabahSub}>Reflection · 5 min</Text>
        </View>
        <View style={s.muhasabahBeginBtn}>
          <Text style={s.muhasabahBeginText}>Begin</Text>
        </View>
      </View>
      <View style={s.muhasabahStats}>
        <View style={s.muhasabahStat}>
          <Text style={s.muhasabahStatNum}>🔥 4</Text>
          <Text style={s.muhasabahStatLabel}>day streak</Text>
        </View>
        <View style={s.muhasabahStat}>
          <Text style={s.muhasabahStatNum}>⭐ 120</Text>
          <Text style={s.muhasabahStatLabel}>total pts</Text>
        </View>
        <View style={s.muhasabahStat}>
          <Text style={s.muhasabahStatNum}>12</Text>
          <Text style={s.muhasabahStatLabel}>sessions</Text>
        </View>
      </View>
    </View>
  );
}

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

        {/* Mock visual */}
        <Animated.View style={{ opacity: fadeAnim }}>
          {current.showFeedMock ? (
            <FeedMock />
          ) : current.showMuhasabahMock ? (
            <MuhasabahMock />
          ) : current.showConfigureMock ? (
            <View style={s.mockHeader}>
              <Text style={s.mockHeaderTitle}>Family</Text>
              <View style={s.mockConfigureBtn}>
                <Text style={s.mockConfigureBtnLabel}>Configure Family</Text>
                <Text style={s.mockConfigureBtnSub}>Children & goals</Text>
              </View>
            </View>
          ) : (
            <View style={s.mockSegment}>
              {TAB_LABELS.map((label, i) => (
                <View key={label} style={[s.mockTab, current.tab === i && s.mockTabActive]}>
                  <Text style={[s.mockTabText, current.tab === i && s.mockTabTextActive]}>
                    {label}
                  </Text>
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
  stepRow:   { flexDirection: 'row', gap: 5, marginBottom: 20 },
  dot:       { height: 5, width: 5, borderRadius: 3, backgroundColor: '#E5E7EB' },
  dotActive: { width: 16, backgroundColor: '#2E7D62' },

  // Tab segment mock
  mockSegment: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  mockTab:         { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100, backgroundColor: '#F3F4F6' },
  mockTabActive:   { backgroundColor: '#1B3D2F' },
  mockTabText:     { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  mockTabTextActive: { color: '#FFFFFF' },

  // Configure header mock
  mockHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F9FAFB', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 20,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  mockHeaderTitle:       { fontSize: 18, fontWeight: '800', color: '#1A1A2E' },
  mockConfigureBtn:      { backgroundColor: '#EDF7F2', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'flex-end', borderWidth: 2, borderColor: '#2E7D62' },
  mockConfigureBtnLabel: { fontSize: 13, fontWeight: '700', color: '#1B3D2F' },
  mockConfigureBtnSub:   { fontSize: 11, color: '#2E7D62', marginTop: 1 },

  // Shared mock card
  mockCard: {
    backgroundColor: '#F9FAFB', borderRadius: 14, padding: 14,
    marginBottom: 20, borderWidth: 1, borderColor: '#E5E7EB',
  },

  // Feed mock
  feedRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  feedDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  feedType:     { fontSize: 10, fontWeight: '800', color: '#1B3D2F', letterSpacing: 0.5 },
  feedChild:    { fontSize: 12, color: '#9CA3AF', fontWeight: '500', marginBottom: 6 },
  feedText:     { fontSize: 13, color: '#1A1A2E', fontWeight: '600', lineHeight: 19, marginBottom: 10 },
  feedActions:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  feedLoveBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEE2E2', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  feedLoveCount:{ fontSize: 12, fontWeight: '700', color: '#E53E3E' },
  feedSeeAll:   { fontSize: 11, fontWeight: '600', color: '#2E7D62' },

  // Muhasabah mock
  muhasabahHeader:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  muhasabahEmoji:     { fontSize: 26 },
  muhasabahTitle:     { fontSize: 14, fontWeight: '800', color: '#1A1A2E' },
  muhasabahSub:       { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  muhasabahBeginBtn:  { backgroundColor: '#1B3D2F', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
  muhasabahBeginText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  muhasabahStats:     { flexDirection: 'row', gap: 0 },
  muhasabahStat:      { flex: 1, alignItems: 'center' },
  muhasabahStatNum:   { fontSize: 13, fontWeight: '800', color: '#1A1A2E' },
  muhasabahStatLabel: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },

  title:    { fontSize: 19, fontWeight: '800', color: '#1A1A2E', marginBottom: 8 },
  body:     { fontSize: 14, color: '#6B7280', lineHeight: 22, marginBottom: 22 },
  actions:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  skipText: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },
  nextBtn:  { backgroundColor: '#1B3D2F', borderRadius: 14, paddingHorizontal: 22, paddingVertical: 12 },
  nextText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
