import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, TextInput, Animated, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';

const BG     = '#0D1B3E';
const GOLD   = '#FFD166';
const TEXT   = '#F8FAFC';
const SUBTEXT= '#94A3B8';
const CARD   = 'rgba(255,255,255,0.07)';
const BORDER = 'rgba(255,255,255,0.11)';
const PURPLE = '#C084FC';

const ALL_CATS = [
  { key: 'salah',    label: 'Salah',          emoji: '🙏' },
  { key: 'quran',    label: 'Quran',           emoji: '📖' },
  { key: 'kindness', label: 'Kindness',        emoji: '💝' },
  { key: 'honesty',  label: 'Honesty',         emoji: '✨' },
  { key: 'helping',  label: 'Helping others',  emoji: '🤝' },
  { key: 'behaviour',label: 'Behaviour',       emoji: '😊' },
  { key: 'learning', label: 'Learning',        emoji: '📚' },
  { key: 'health',   label: 'Health & Exercise',emoji: '💪' },
  { key: 'focus',    label: 'Focus',           emoji: '🎯' },
  { key: 'family',   label: 'Family',          emoji: '🫂' },
  { key: 'gratitude',label: 'Gratitude',       emoji: '🌸' },
  { key: 'patience', label: 'Patience',        emoji: '🌿' },
];

const DEFAULT_QUESTIONS = {
  challenge:  "What didn't I do well today?",
  repair:     "How can I repair it?",
  doBetter:   "How will I do better tomorrow?",
  tomorrow:   "What's my mission for tomorrow?",
};

const STEPS = ['welcome', 'categories', 'questions', 'reward'];

export default function MuhasabahSetupScreen({ navigation, route }) {
  const { child } = route.params ?? {};
  const firstName = child?.name?.split(' ')[0] ?? 'your child';

  const [stepIdx, setStepIdx] = useState(0);
  const [saving,  setSaving]  = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Categories
  const [selected, setSelected] = useState(
    new Set(['salah', 'quran', 'kindness', 'honesty', 'helping'])
  );

  // Questions
  const [questions, setQuestions] = useState({ ...DEFAULT_QUESTIONS });

  // Reward
  const [rewardGoal,   setRewardGoal]   = useState('');
  const [rewardTarget, setRewardTarget] = useState('100');

  const step = STEPS[stepIdx];

  function transition(next) {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
    setTimeout(() => setStepIdx(next), 120);
  }

  function goNext() {
    if (step === 'categories') {
      if (selected.size < 3) { Alert.alert('Pick at least 3', 'Choose at least 3 areas to reflect on.'); return; }
    }
    if (stepIdx < STEPS.length - 1) { transition(stepIdx + 1); return; }
    saveAndFinish();
  }

  function goBack() {
    if (stepIdx === 0) { navigation.goBack(); return; }
    transition(stepIdx - 1);
  }

  async function saveAndFinish() {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { Alert.alert('Not signed in'); return; }

      const cats = ALL_CATS.filter(c => selected.has(c.key));
      const target = parseInt(rewardTarget, 10) || 100;

      await supabase.from('muhasabah_config').upsert({
        user_id:               session.user.id,
        child_id:              child.id,
        categories:            cats,
        questions,
        reward_goal:           rewardGoal.trim() || null,
        reward_points_target:  target,
      }, { onConflict: 'user_id,child_id' });

      navigation.goBack();
    } catch (e) {
      console.warn('[setup] save failed:', e);
      Alert.alert('Error', 'Could not save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function toggleCat(key) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size <= 3) { Alert.alert('Minimum 3', 'Keep at least 3 areas selected.'); return prev; }
        next.delete(key);
      } else {
        if (next.size >= 6) { Alert.alert('Maximum 6', 'Choose up to 6 areas to keep sessions focused.'); return prev; }
        next.add(key);
      }
      return next;
    });
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} hitSlop={{ top: 10, left: 10, bottom: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color={TEXT} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🌙 Muhasabah Setup</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Progress dots */}
      <View style={styles.dotsRow}>
        {STEPS.map((_, i) => (
          <View key={i} style={[styles.dot, i === stepIdx && styles.dotActive, i < stepIdx && styles.dotDone]} />
        ))}
      </View>

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* ── Step: Welcome ── */}
            {step === 'welcome' && (
              <View style={styles.stepWrap}>
                <Text style={styles.emoji}>🌟</Text>
                <Text style={styles.title}>Welcome to Muhasabah!</Text>
                <Text style={styles.sub}>
                  This is {firstName}'s first time — let's take 2 minutes to set things up.
                </Text>

                <View style={styles.infoCard}>
                  <Text style={styles.infoTitle}>What you'll configure</Text>
                  {[
                    ['📊', 'Reflection areas', 'Which parts of the day your child rates with emoji sliders'],
                    ['💬', 'Questions',         'The open-ended questions asked at the end of each session'],
                    ['🎁', 'Reward goal',       'A milestone reward your child works toward with their points'],
                  ].map(([icon, label, desc]) => (
                    <View key={label} style={styles.infoRow}>
                      <Text style={styles.infoIcon}>{icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.infoLabel}>{label}</Text>
                        <Text style={styles.infoDesc}>{desc}</Text>
                      </View>
                    </View>
                  ))}
                </View>

                <View style={styles.noteRow}>
                  <Ionicons name="information-circle-outline" size={16} color={PURPLE} />
                  <Text style={styles.noteText}>You can change any of these later from {firstName}'s Rewards screen.</Text>
                </View>
              </View>
            )}

            {/* ── Step: Categories ── */}
            {step === 'categories' && (
              <View style={styles.stepWrap}>
                <Text style={styles.emoji}>📊</Text>
                <Text style={styles.title}>Reflection areas</Text>
                <Text style={styles.sub}>
                  Choose 3–6 areas for {firstName} to rate each night. Pick what matters most right now.
                </Text>
                <View style={styles.catGrid}>
                  {ALL_CATS.map(cat => {
                    const on = selected.has(cat.key);
                    return (
                      <TouchableOpacity
                        key={cat.key}
                        style={[styles.catChip, on && styles.catChipOn]}
                        onPress={() => toggleCat(cat.key)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.catEmoji}>{cat.emoji}</Text>
                        <Text style={[styles.catLabel, on && styles.catLabelOn]}>{cat.label}</Text>
                        {on && <Ionicons name="checkmark-circle" size={14} color={GOLD} style={{ marginLeft: 'auto' }} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.hint}>{selected.size} of 6 max selected</Text>
              </View>
            )}

            {/* ── Step: Questions ── */}
            {step === 'questions' && (
              <View style={styles.stepWrap}>
                <Text style={styles.emoji}>💬</Text>
                <Text style={styles.title}>Open-ended questions</Text>
                <Text style={styles.sub}>
                  These are asked at the end of each session. Edit the wording to suit {firstName}'s age and style.
                </Text>
                {[
                  { key: 'challenge', label: "What didn't go well?", placeholder: "What didn't I do well today?" },
                  { key: 'repair',    label: 'How to repair it?',    placeholder: 'How can I repair it?' },
                  { key: 'doBetter',  label: 'Do better tomorrow',   placeholder: 'How will I do better tomorrow?' },
                  { key: 'tomorrow',  label: "Tomorrow's mission",   placeholder: "What's my mission for tomorrow?" },
                ].map(q => (
                  <View key={q.key} style={styles.questionWrap}>
                    <Text style={styles.questionLabel}>{q.label}</Text>
                    <TextInput
                      style={styles.questionInput}
                      value={questions[q.key]}
                      onChangeText={v => setQuestions(prev => ({ ...prev, [q.key]: v }))}
                      placeholder={q.placeholder}
                      placeholderTextColor={SUBTEXT}
                      maxLength={80}
                    />
                    <TouchableOpacity onPress={() => setQuestions(prev => ({ ...prev, [q.key]: DEFAULT_QUESTIONS[q.key] }))}>
                      <Text style={styles.resetText}>Reset to default</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* ── Step: Reward ── */}
            {step === 'reward' && (
              <View style={styles.stepWrap}>
                <Text style={styles.emoji}>🎁</Text>
                <Text style={styles.title}>Set a reward goal</Text>
                <Text style={styles.sub}>
                  Give {firstName} something to work toward. When they hit the points target, they unlock it!
                </Text>

                <View style={styles.rewardCard}>
                  <Text style={styles.inputLabel}>What's the reward?</Text>
                  <TextInput
                    style={styles.input}
                    value={rewardGoal}
                    onChangeText={setRewardGoal}
                    placeholder="e.g. Trip to the park, new book, movie night..."
                    placeholderTextColor={SUBTEXT}
                    maxLength={60}
                  />

                  <Text style={[styles.inputLabel, { marginTop: 16 }]}>Points needed to unlock</Text>
                  <TextInput
                    style={styles.input}
                    value={rewardTarget}
                    onChangeText={setRewardTarget}
                    keyboardType="number-pad"
                    placeholder="100"
                    placeholderTextColor={SUBTEXT}
                    maxLength={5}
                  />
                  <Text style={styles.hint}>A typical session earns 20–50 points</Text>
                </View>

                <TouchableOpacity onPress={() => { setRewardGoal(''); saveAndFinish(); }} style={styles.skipBtn}>
                  <Text style={styles.skipText}>Set this later →</Text>
                </TouchableOpacity>
              </View>
            )}

          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>

      {/* Bottom button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextBtn, saving && { opacity: 0.6 }]}
          onPress={goNext}
          disabled={saving}
          activeOpacity={0.85}
        >
          <Text style={styles.nextBtnText}>
            {step === 'reward' ? (saving ? 'Saving…' : 'Save & Begin ✨') : 'Next →'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: BG },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  headerTitle:   { fontSize: 16, fontWeight: '800', color: TEXT },

  dotsRow:       { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  dot:           { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.15)' },
  dotActive:     { backgroundColor: GOLD, width: 20, borderRadius: 4 },
  dotDone:       { backgroundColor: 'rgba(255,209,102,0.4)' },

  content:       { paddingHorizontal: 22, paddingBottom: 24 },
  stepWrap:      { paddingTop: 8, gap: 0 },

  emoji:         { fontSize: 52, textAlign: 'center', marginBottom: 12 },
  title:         { fontSize: 24, fontWeight: '900', color: TEXT, textAlign: 'center', marginBottom: 10, lineHeight: 30 },
  sub:           { fontSize: 15, color: SUBTEXT, textAlign: 'center', lineHeight: 24, marginBottom: 24 },

  infoCard:      { backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 18, gap: 14, marginBottom: 16 },
  infoTitle:     { fontSize: 13, color: SUBTEXT, fontWeight: '700', marginBottom: 4 },
  infoRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  infoIcon:      { fontSize: 20, marginTop: 2 },
  infoLabel:     { fontSize: 14, fontWeight: '700', color: TEXT, marginBottom: 2 },
  infoDesc:      { fontSize: 13, color: SUBTEXT, lineHeight: 20 },

  noteRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: 'rgba(192,132,252,0.08)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(192,132,252,0.2)' },
  noteText:      { fontSize: 13, color: SUBTEXT, lineHeight: 20, flex: 1 },

  catGrid:       { gap: 10, marginBottom: 8 },
  catChip:       { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 16, paddingVertical: 14 },
  catChipOn:     { backgroundColor: 'rgba(255,209,102,0.1)', borderColor: 'rgba(255,209,102,0.4)' },
  catEmoji:      { fontSize: 20 },
  catLabel:      { fontSize: 14, color: SUBTEXT, fontWeight: '600', flex: 1 },
  catLabelOn:    { color: TEXT },

  hint:          { fontSize: 12, color: SUBTEXT, textAlign: 'center', marginTop: 4 },

  questionWrap:  { marginBottom: 18 },
  questionLabel: { fontSize: 12, color: SUBTEXT, fontWeight: '700', marginBottom: 6 },
  questionInput: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 14, paddingVertical: 12, color: TEXT, fontSize: 14, marginBottom: 4 },
  resetText:     { fontSize: 11, color: PURPLE, fontWeight: '600' },

  rewardCard:    { backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 18, marginBottom: 16 },
  inputLabel:    { fontSize: 12, color: SUBTEXT, fontWeight: '700', marginBottom: 8 },
  input:         { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 14, paddingVertical: 12, color: TEXT, fontSize: 15 },
  skipBtn:       { alignItems: 'center', paddingVertical: 12 },
  skipText:      { fontSize: 14, color: SUBTEXT, fontWeight: '600' },

  footer:        { paddingHorizontal: 22, paddingBottom: 28, paddingTop: 12 },
  nextBtn:       { backgroundColor: GOLD, borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  nextBtnText:   { fontSize: 17, fontWeight: '900', color: '#0D1B3E' },
});
