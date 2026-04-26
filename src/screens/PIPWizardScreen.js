import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { savePlan } from '../utils/pip';
import { schedulePIPReminder, schedulePIPCheckIn } from '../utils/notifications';

const API_URL = 'https://tarbiyah-production.up.railway.app';

const PLAN_TYPES = [
  { key: 'Parenting', label: 'Parenting', icon: 'people-outline' },
  { key: 'Personal Growth', label: 'Personal Growth', icon: 'leaf-outline' },
  { key: 'Spiritual', label: 'Spiritual', icon: 'moon-outline' },
  { key: 'Relationship', label: 'Relationship', icon: 'heart-outline' },
];

const JOURNEYS = [
  {
    key: 'Reset',
    label: 'Reset',
    days: '14 Days',
    desc: 'Quick relief and momentum. For stressful weeks, specific issues, or getting unstuck.',
    icon: 'flash-outline',
    color: '#2563EB',
  },
  {
    key: 'Growth',
    label: 'Growth',
    days: '30 Days',
    desc: 'Lasting habit change and steady progress. Recommended for most parents.',
    icon: 'trending-up-outline',
    color: '#2E7D62',
    recommended: true,
  },
  {
    key: 'Transformation',
    label: 'Transformation',
    days: '90 Days',
    desc: 'Deep family culture change and long-term breakthroughs.',
    icon: 'sparkles-outline',
    color: '#7C3AED',
  },
];

const STRESS_LEVELS = ['Low', 'Moderate', 'High', 'Very High'];

export default function PIPWizardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);

  const planType = 'Parenting';
  // Step 1
  const [userGoal, setUserGoal] = useState('');
  // Step 2
  const [journeyType, setJourneyType] = useState('Growth');
  // Step 3
  const [childAges, setChildAges] = useState('');
  const [familyContext, setFamilyContext] = useState('');
  const [stressLevel, setStressLevel] = useState('Moderate');
  const [checkInDays, setCheckInDays] = useState(3);
  const [reminderTime, setReminderTime] = useState('12:00');
  const [showTimePicker, setShowTimePicker] = useState(false);

  function reminderTimeAsDate() {
    const [h, m] = reminderTime.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  }

  function formatDisplayTime(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, '0')} ${period}`;
  }

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const totalSteps = 3;

  async function handleGenerate() {
    if (!userGoal.trim()) { setError('Please describe your goal or struggle.'); return; }
    setError('');
    setLoading(true);
    try {
      const profileRaw = await AsyncStorage.getItem('tarbiyah_profile');
      const profile = profileRaw ? JSON.parse(profileRaw) : {};
      const res = await fetch(`${API_URL}/pip/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planType, userGoal, journeyType, childAges, familyContext, stressLevel, familyStructure: profile.familyStructure ?? 'prefer_not_to_say' }),
      });
      if (!res.ok) throw new Error('Server error');
      const data = await res.json();

      const plan = {
        ...data,
        id: Date.now().toString(),
        planType,
        userGoal,
        journeyType,
        childAges,
        familyContext,
        stressLevel,
        checkInDays,
        reminderTime,
        startDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      await savePlan(plan);
      schedulePIPReminder(reminderTime).catch(() => {});
      schedulePIPCheckIn(checkInDays, plan.startDate).catch(() => {});

      navigation.replace('PIPDetail', { plan, initialTab: 'plan' });
    } catch (err) {
      console.error('PIP generate error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#C9A84C" />
        <Text style={styles.loadingTitle}>Building your plan...</Text>
        <Text style={styles.loadingSubtitle}>Usually ready in 20–35 seconds</Text>
        <View style={styles.loadingPills}>
          {['Islamic Foundation', 'Daily Habits', 'Roadmap', 'Action Steps'].map(l => (
            <View key={l} style={styles.loadingPill}><Text style={styles.loadingPillText}>{l}</Text></View>
          ))}
        </View>
        <Text style={styles.loadingKeepOpen}>Please keep the app open until your plan is ready</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <StatusBar style="light" />
      <View style={styles.bgTop} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => step > 1 ? setStep(s => s - 1) : navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Improvement Plan</Text>
          <View style={styles.progressBar}>
            {Array.from({ length: totalSteps }).map((_, i) => (
              <View key={i} style={[styles.progressSegment, i < step && styles.progressSegmentActive]} />
            ))}
          </View>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* ── Step 1: Goal ── */}
          {step === 1 && (
            <View style={styles.stepWrap}>
              <Text style={styles.stepLabel}>STEP 1 OF {totalSteps}</Text>
              <Text style={styles.stepTitle}>What's your main struggle or goal?</Text>
              <Text style={styles.stepSubtitle}>Be specific — the more detail you give, the more personalised your plan.</Text>
              <TextInput
                style={styles.textArea}
                placeholder={`e.g. "I lose patience with my kids too quickly and raise my voice. I want to respond calmly even when things are chaotic."`}
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={5}
                value={userGoal}
                onChangeText={setUserGoal}
                textAlignVertical="top"
              />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </View>
          )}

          {/* ── Step 2: Journey ── */}
          {step === 2 && (
            <View style={styles.stepWrap}>
              <Text style={styles.stepLabel}>STEP 2 OF {totalSteps}</Text>
              <Text style={styles.stepTitle}>Choose your journey</Text>
              {JOURNEYS.map(j => (
                <TouchableOpacity
                  key={j.key}
                  style={[styles.journeyCard, journeyType === j.key && styles.journeyCardActive]}
                  onPress={() => setJourneyType(j.key)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.journeyIcon, { backgroundColor: j.color + '18' }]}>
                    <Ionicons name={j.icon} size={20} color={j.color} />
                  </View>
                  <View style={styles.journeyBody}>
                    <View style={styles.journeyTitleRow}>
                      <Text style={styles.journeyLabel}>{j.label}</Text>
                      <Text style={[styles.journeyDays, { color: j.color }]}>{j.days}</Text>
                      {j.recommended && <View style={styles.recommendedPill}><Text style={styles.recommendedText}>Recommended</Text></View>}
                    </View>
                    <Text style={styles.journeyDesc}>{j.desc}</Text>
                  </View>
                  {journeyType === j.key && <Ionicons name="checkmark-circle" size={20} color="#2E7D62" style={{ marginLeft: 4 }} />}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ── Step 3: Context + Settings ── */}
          {step === 3 && (
            <View style={styles.stepWrap}>
              <Text style={styles.stepLabel}>STEP 3 OF {totalSteps}</Text>
              <Text style={styles.stepTitle}>A little more context</Text>
              <Text style={styles.stepSubtitle}>Optional — helps personalise your plan further.</Text>

              <Text style={styles.fieldLabel}>Child ages (optional)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. 4, 8, 13"
                placeholderTextColor="#9CA3AF"
                value={childAges}
                onChangeText={setChildAges}
              />

              <Text style={styles.fieldLabel}>Family context (optional)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. single parent, working full time, blended family"
                placeholderTextColor="#9CA3AF"
                value={familyContext}
                onChangeText={setFamilyContext}
              />

              <Text style={styles.fieldLabel}>Current stress level</Text>
              <View style={styles.pillRow}>
                {STRESS_LEVELS.map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.pill, stressLevel === s && styles.pillActive]}
                    onPress={() => setStressLevel(s)}
                  >
                    <Text style={[styles.pillText, stressLevel === s && styles.pillTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <View style={styles.divider} />
              <Text style={styles.settingsTitle}>Reminders & Check-ins</Text>

              <Text style={styles.fieldLabel}>Daily habit reminder time</Text>
              <TouchableOpacity style={styles.timePickerBtn} onPress={() => setShowTimePicker(true)} activeOpacity={0.75}>
                <Ionicons name="alarm-outline" size={18} color="#1B3D2F" />
                <Text style={styles.timePickerBtnText}>{formatDisplayTime(reminderTime)}</Text>
                <Ionicons name="chevron-down" size={16} color="#9CA3AF" style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>

              {Platform.OS === 'android' && showTimePicker && (
                <DateTimePicker
                  mode="time"
                  value={reminderTimeAsDate()}
                  is24Hour={false}
                  onChange={(_, date) => {
                    setShowTimePicker(false);
                    if (date) {
                      const h = String(date.getHours()).padStart(2, '0');
                      const m = String(date.getMinutes()).padStart(2, '0');
                      setReminderTime(`${h}:${m}`);
                    }
                  }}
                />
              )}

              {Platform.OS === 'ios' && (
                <Modal visible={showTimePicker} transparent animationType="slide">
                  <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowTimePicker(false)} />
                  <View style={styles.pickerSheet}>
                    <View style={styles.pickerSheetHeader}>
                      <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                        <Text style={styles.pickerDoneBtn}>Done</Text>
                      </TouchableOpacity>
                    </View>
                    <DateTimePicker
                      mode="time"
                      display="spinner"
                      value={reminderTimeAsDate()}
                      onChange={(_, date) => {
                        if (date) {
                          const h = String(date.getHours()).padStart(2, '0');
                          const m = String(date.getMinutes()).padStart(2, '0');
                          setReminderTime(`${h}:${m}`);
                        }
                      }}
                      style={{ width: '100%' }}
                    />
                  </View>
                </Modal>
              )}

              <Text style={styles.fieldLabel}>Check-in every</Text>
              <Text style={styles.settingSubtitle}>You'll receive a prompt to reflect on your progress and receive personalised coaching to adjust your plan.</Text>
              <View style={styles.pillRow}>
                {[3, 5, 7, 14].map(d => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.pill, checkInDays === d && styles.pillActive]}
                    onPress={() => setCheckInDays(d)}
                  >
                    <Text style={[styles.pillText, checkInDays === d && styles.pillTextActive]}>{d} days</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

        </ScrollView>

        {/* Footer CTA */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          {step < totalSteps ? (
            <TouchableOpacity
              style={[styles.ctaBtn, step === 1 && !userGoal.trim() && styles.ctaBtnDisabled]}
              onPress={() => {
                if (step === 1 && !userGoal.trim()) { setError('Please describe your goal or struggle.'); return; }
                setError('');
                setStep(s => s + 1);
              }}
              activeOpacity={0.85}
            >
              <LinearGradient colors={['#2E5E45', '#1B3D2F']} style={styles.ctaGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.ctaText}>Continue</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.ctaBtn} onPress={handleGenerate} activeOpacity={0.85}>
              <LinearGradient colors={['#2E5E45', '#1B3D2F']} style={styles.ctaGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.ctaText}>Generate My Plan</Text>
                <Ionicons name="sparkles" size={18} color="#C9A84C" />
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6F8' },
  bgTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 160, backgroundColor: '#1B3D2F' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20,
    backgroundColor: 'transparent',
  },
  headerCenter: { flex: 1, alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  progressBar: { flexDirection: 'row', gap: 5 },
  progressSegment: { height: 3, width: 40, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' },
  progressSegmentActive: { backgroundColor: '#C9A84C' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  stepWrap: { gap: 16 },
  stepLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, color: '#C9A84C' },
  stepTitle: { fontSize: 22, fontWeight: '700', color: '#1C1C1E', lineHeight: 30 },
  stepSubtitle: { fontSize: 14, color: '#6B7280', lineHeight: 22, marginTop: -8 },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  optionCard: {
    flex: 1, minWidth: '44%', backgroundColor: '#FFFFFF', borderRadius: 16,
    padding: 18, alignItems: 'center', gap: 10,
    borderWidth: 2, borderColor: 'transparent',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  optionCardActive: { borderColor: '#2E7D62', backgroundColor: '#F0FBF5' },
  optionCardText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  optionCardTextActive: { color: '#1B3D2F' },
  textArea: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    fontSize: 15, color: '#1C1C1E', lineHeight: 24, minHeight: 140,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  textInput: {
    backgroundColor: '#FFFFFF', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 15, color: '#1C1C1E',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  journeyCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16,
    padding: 16, gap: 14, borderWidth: 2, borderColor: 'transparent',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  journeyCardActive: { borderColor: '#2E7D62' },
  journeyIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  journeyBody: { flex: 1, gap: 4 },
  journeyTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  journeyLabel: { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },
  journeyDays: { fontSize: 12, fontWeight: '700' },
  journeyDesc: { fontSize: 13, color: '#6B7280', lineHeight: 19 },
  recommendedPill: { backgroundColor: '#E8F5EF', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 },
  recommendedText: { fontSize: 10, fontWeight: '700', color: '#2E7D62' },
  fieldLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, color: '#6B7280', marginBottom: -8 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 100, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E5E7EB' },
  pillActive: { backgroundColor: '#1B3D2F', borderColor: '#1B3D2F' },
  timePickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFFFFF', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  timePickerBtnText: { fontSize: 15, fontWeight: '600', color: '#1B3D2F' },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  pickerSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32 },
  pickerSheetHeader: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  pickerDoneBtn: { fontSize: 16, fontWeight: '700', color: '#1B3D2F' },
  pillText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  pillTextActive: { color: '#FFFFFF' },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 4 },
  settingsTitle: { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },
  settingSubtitle: { fontSize: 13, color: '#6B7280', lineHeight: 19, marginTop: -4, marginBottom: 4 },
  errorText: { fontSize: 13, color: '#DC2626', fontWeight: '500' },
  footer: { paddingHorizontal: 20, paddingTop: 12, backgroundColor: '#F5F6F8' },
  ctaBtn: { borderRadius: 16, overflow: 'hidden' },
  ctaBtnDisabled: { opacity: 0.5 },
  ctaGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 17, gap: 8 },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  loadingScreen: {
    flex: 1, backgroundColor: '#1B3D2F', alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 32,
  },
  loadingTitle: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
  loadingSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
  loadingPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 8 },
  loadingPill: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 100, paddingHorizontal: 14, paddingVertical: 7 },
  loadingPillText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  loadingKeepOpen: { fontSize: 12, color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: 32 },
});
