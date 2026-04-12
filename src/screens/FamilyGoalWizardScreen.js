import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet, Switch,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  SUGGESTED_GOALS, FREQUENCY_OPTIONS, REMINDER_TIMES,
  saveFamilyGoal, requestNotificationPermission,
} from '../utils/familyGoals';

const STEPS = ['goal', 'frequency', 'reminder', 'confirm'];

function StepDots({ current }) {
  return (
    <View style={dots.row}>
      {STEPS.map((s, i) => (
        <View key={s} style={[dots.dot, i === current && dots.dotActive]} />
      ))}
    </View>
  );
}

const dots = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)' },
  dotActive: { width: 18, backgroundColor: '#6B7C45' },
});

export default function FamilyGoalWizardScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const editGoal = route.params?.goal ?? null;

  const [step, setStep] = useState(0);

  // Step 0 — goal selection
  const [selectedSuggestion, setSelectedSuggestion] = useState(
    editGoal ? null : null
  );
  const [customTitle, setCustomTitle] = useState(editGoal?.title ?? '');
  const [customEmoji, setCustomEmoji] = useState(editGoal?.emoji ?? '');
  const [isCustom, setIsCustom] = useState(
    editGoal ? !SUGGESTED_GOALS.find(g => g.title === editGoal.title) : false
  );

  // Step 1 — frequency
  const [frequency, setFrequency] = useState(
    editGoal
      ? FREQUENCY_OPTIONS.find(f => f.type === editGoal.frequencyType && JSON.stringify(f.days) === JSON.stringify(editGoal.reminderDays)) ?? FREQUENCY_OPTIONS[0]
      : null
  );

  // Step 2 — reminder
  const [reminderEnabled, setReminderEnabled] = useState(editGoal?.reminderEnabled ?? true);
  const [reminderTime, setReminderTime] = useState(editGoal?.reminderTime ?? '20:30');

  function activeGoal() {
    if (isCustom) return { emoji: customEmoji || '🌟', title: customTitle };
    return selectedSuggestion;
  }

  function canAdvance() {
    if (step === 0) return isCustom ? customTitle.trim().length > 0 : !!selectedSuggestion;
    if (step === 1) return !!frequency;
    return true;
  }

  function advance() {
    if (step < STEPS.length - 1) setStep(s => s + 1);
  }

  function back() {
    if (step > 0) setStep(s => s - 1);
    else navigation.goBack();
  }

  async function handleSave() {
    const goal = activeGoal();
    const id = editGoal?.id ?? `fg_${Date.now()}`;

    const record = {
      id,
      icon:          goal.icon,
      iconColor:     goal.iconColor,
      title:         goal.title,
      frequencyType: frequency.type,
      frequencyLabel: frequency.label,
      reminderDays:  frequency.days,
      reminderEnabled,
      reminderTime,
      active: true,
      createdAt: editGoal?.createdAt ?? new Date().toISOString(),
    };

    try {
      await saveFamilyGoal(record);
    } catch (err) {
      console.warn('Save goal error:', err.message);
    }
    navigation.goBack();
  }

  // Pre-fill frequency when a suggestion is picked
  function pickSuggestion(s) {
    setSelectedSuggestion(s);
    setIsCustom(false);
    const match = FREQUENCY_OPTIONS.find(f =>
      f.type === s.defaultFrequency &&
      JSON.stringify(f.days) === JSON.stringify(s.defaultDays)
    );
    if (match) setFrequency(match);
  }

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={back}>
          <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Family Goal</Text>
          <StepDots current={step} />
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── STEP 0: Choose goal ── */}
        {step === 0 && (
          <View>
            <Text style={styles.stepTitle}>What goal would you like{'\n'}to set for your family?</Text>
            <Text style={styles.stepSubtitle}>Choose a suggestion or write your own</Text>

            {SUGGESTED_GOALS.map((s, i) => {
              const active = !isCustom && selectedSuggestion?.title === s.title;
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.suggestionCard, active && styles.suggestionCardActive]}
                  onPress={() => pickSuggestion(s)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.suggestionIconWrap, { backgroundColor: s.iconColor + '22' }]}>
                    <Ionicons name={s.icon} size={20} color={s.iconColor} />
                  </View>
                  <View style={styles.suggestionText}>
                    <Text style={[styles.suggestionTitle, active && styles.suggestionTitleActive]}>
                      {s.title}
                    </Text>
                    <Text style={styles.suggestionSubtitle}>{s.subtitle}</Text>
                  </View>
                  {active && <Ionicons name="checkmark-circle" size={20} color="#6B7C45" />}
                </TouchableOpacity>
              );
            })}

            {/* Custom goal */}
            <TouchableOpacity
              style={[styles.suggestionCard, isCustom && styles.suggestionCardActive]}
              onPress={() => { setIsCustom(true); setSelectedSuggestion(null); }}
              activeOpacity={0.8}
            >
              <View style={[styles.suggestionIconWrap, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                <Ionicons name="pencil-outline" size={20} color="rgba(255,255,255,0.6)" />
              </View>
              <View style={styles.suggestionText}>
                <Text style={[styles.suggestionTitle, isCustom && styles.suggestionTitleActive]}>
                  Write my own goal
                </Text>
                <Text style={styles.suggestionSubtitle}>Set a custom family goal</Text>
              </View>
              {isCustom && <Ionicons name="checkmark-circle" size={20} color="#6B7C45" />}
            </TouchableOpacity>

            {isCustom && (
              <View style={styles.customInputWrap}>
                <View style={styles.emojiInputRow}>
                  <TextInput
                    style={styles.emojiInput}
                    value={customEmoji}
                    onChangeText={setCustomEmoji}
                    placeholder="🌟"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    maxLength={2}
                  />
                  <TextInput
                    style={[styles.customInput, { flex: 1 }]}
                    value={customTitle}
                    onChangeText={setCustomTitle}
                    placeholder="e.g. We will volunteer together monthly"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    multiline
                  />
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── STEP 1: Frequency ── */}
        {step === 1 && (
          <View>
            <Text style={styles.stepTitle}>How often should{'\n'}this happen?</Text>
            <Text style={styles.stepSubtitle}>{activeGoal()?.title}</Text>

            {FREQUENCY_OPTIONS.map((f, i) => {
              const active = frequency?.label === f.label;
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.optionRow, active && styles.optionRowActive]}
                  onPress={() => setFrequency(f)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.optionRadio, active && styles.optionRadioActive]}>
                    {active && <View style={styles.optionRadioDot} />}
                  </View>
                  <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
                    {f.label}
                  </Text>
                  <Text style={styles.optionDays}>
                    {f.daysPerWeek}×/wk
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── STEP 2: Reminder ── */}
        {step === 2 && (
          <View>
            <Text style={styles.stepTitle}>Set a reminder?</Text>
            <Text style={styles.stepSubtitle}>We'll nudge you so this goal stays a habit</Text>

            <View style={styles.toggleRow}>
              <View>
                <Text style={styles.toggleLabel}>Enable reminders</Text>
                <Text style={styles.toggleSub}>You can turn this off anytime</Text>
              </View>
              <Switch
                value={reminderEnabled}
                onValueChange={setReminderEnabled}
                trackColor={{ false: 'rgba(255,255,255,0.15)', true: '#6B7C45' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {reminderEnabled && (
              <>
                <Text style={styles.timeSectionLabel}>REMINDER TIME</Text>
                {REMINDER_TIMES.map((t, i) => {
                  const active = reminderTime === t.value;
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[styles.optionRow, active && styles.optionRowActive]}
                      onPress={() => setReminderTime(t.value)}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.optionRadio, active && styles.optionRadioActive]}>
                        {active && <View style={styles.optionRadioDot} />}
                      </View>
                      <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                <View style={styles.spouseSyncNote}>
                  <Ionicons name="people-outline" size={14} color="rgba(255,255,255,0.4)" />
                  <Text style={styles.spouseSyncText}>
                    Reminders will also apply to your spouse once family sync is set up
                  </Text>
                </View>
              </>
            )}
          </View>
        )}

        {/* ── STEP 3: Confirm ── */}
        {step === 3 && (
          <View>
            <Text style={styles.stepTitle}>Review your{'\n'}family goal</Text>

            <View style={styles.confirmCard}>
              <View style={styles.confirmIconWrap}>
                {activeGoal()?.icon
                  ? <Ionicons name={activeGoal().icon} size={32} color={activeGoal().iconColor ?? '#6B7C45'} />
                  : <Text style={{ fontSize: 32 }}>{activeGoal()?.emoji ?? '🌟'}</Text>
                }
              </View>
              <Text style={styles.confirmTitle}>{activeGoal()?.title}</Text>

              <View style={styles.confirmDivider} />

              <View style={styles.confirmRow}>
                <Ionicons name="repeat-outline" size={15} color="rgba(255,255,255,0.5)" />
                <Text style={styles.confirmDetail}>{frequency?.label}</Text>
              </View>
              <View style={styles.confirmRow}>
                <Ionicons
                  name={reminderEnabled ? 'notifications-outline' : 'notifications-off-outline'}
                  size={15}
                  color="rgba(255,255,255,0.5)"
                />
                <Text style={styles.confirmDetail}>
                  {reminderEnabled
                    ? `Reminder at ${REMINDER_TIMES.find(t => t.value === reminderTime)?.label ?? reminderTime}`
                    : 'No reminder'}
                </Text>
              </View>

              <View style={styles.confirmDivider} />

              <View style={styles.spouseSyncNote}>
                <Ionicons name="people" size={14} color="rgba(107,124,69,0.8)" />
                <Text style={[styles.spouseSyncText, { color: 'rgba(107,124,69,0.9)' }]}>
                  This goal will sync across your family when spouse linking is enabled
                </Text>
              </View>
            </View>
          </View>
        )}

      </ScrollView>

      {/* Bottom CTA */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.nextBtn, !canAdvance() && styles.nextBtnDisabled]}
          onPress={step === STEPS.length - 1 ? handleSave : advance}
          disabled={!canAdvance()}
          activeOpacity={0.85}
        >
          <Text style={styles.nextBtnText}>
            {step === STEPS.length - 1 ? 'Save Goal' : 'Continue'}
          </Text>
          <Ionicons
            name={step === STEPS.length - 1 ? 'checkmark' : 'arrow-forward'}
            size={18}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1B3D2F' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center', gap: 8 },
  headerTitle: {
    fontSize: 12, fontWeight: '700', letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase',
  },

  scroll: { paddingHorizontal: 24, paddingTop: 8 },

  stepTitle: {
    fontSize: 26, fontWeight: '700', color: '#FFFFFF',
    lineHeight: 34, marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 14, color: 'rgba(255,255,255,0.5)',
    lineHeight: 20, marginBottom: 28,
  },

  // Suggestion cards
  suggestionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14, padding: 16, marginBottom: 10,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  suggestionCardActive: {
    backgroundColor: 'rgba(107,124,69,0.15)',
    borderColor: '#6B7C45',
  },
  suggestionIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  suggestionText: { flex: 1 },
  suggestionTitle: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.8)', marginBottom: 2 },
  suggestionTitleActive: { color: '#FFFFFF' },
  suggestionSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 17 },

  // Custom input
  customInputWrap: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14, padding: 16, marginTop: 4, marginBottom: 10,
    borderWidth: 1.5, borderColor: '#6B7C45',
  },
  emojiInputRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  emojiInput: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    textAlign: 'center', fontSize: 22,
    color: '#FFFFFF',
  },
  customInput: {
    color: '#FFFFFF', fontSize: 15, lineHeight: 22,
    paddingTop: 10,
  },

  // Option rows (frequency + reminder time)
  optionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14, padding: 16, marginBottom: 10,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  optionRowActive: {
    backgroundColor: 'rgba(107,124,69,0.15)',
    borderColor: '#6B7C45',
  },
  optionRadio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  optionRadioActive: { borderColor: '#6B7C45' },
  optionRadioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#6B7C45' },
  optionLabel: { flex: 1, fontSize: 15, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  optionLabelActive: { color: '#FFFFFF', fontWeight: '600' },
  optionDays: { fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: '600' },

  // Reminder toggle
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14, padding: 18, marginBottom: 24,
  },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: '#FFFFFF', marginBottom: 3 },
  toggleSub: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },

  timeSectionLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.35)', marginBottom: 12,
  },

  spouseSyncNote: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: 'rgba(107,124,69,0.08)',
    borderRadius: 10, padding: 12, marginTop: 20,
  },
  spouseSyncText: {
    flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.4)',
    lineHeight: 17,
  },

  // Confirm card
  confirmCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20, padding: 24,
    borderWidth: 1.5, borderColor: 'rgba(107,124,69,0.4)',
    marginTop: 8,
  },
  confirmIconWrap: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: 'rgba(107,124,69,0.15)',
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 20, fontWeight: '700', color: '#FFFFFF',
    textAlign: 'center', lineHeight: 27, marginBottom: 20,
  },
  confirmDivider: {
    height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 16,
  },
  confirmRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  confirmDetail: { fontSize: 14, color: 'rgba(255,255,255,0.65)', fontWeight: '500' },

  // Footer
  footer: {
    paddingHorizontal: 24, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#1B3D2F',
  },
  nextBtn: {
    backgroundColor: '#6B7C45',
    borderRadius: 16, paddingVertical: 18,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 10,
  },
  nextBtnDisabled: { opacity: 0.35 },
  nextBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
