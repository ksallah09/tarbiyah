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
import { saveChildPlan } from '../utils/childPlan';
import { scheduleChildPlanReminder, scheduleChildPlanCheckIn, scheduleChildPlanCompletion } from '../utils/notifications';

const API_URL = 'https://tarbiyah-production.up.railway.app';

const JOURNEYS = [
  {
    key: 'Reset',
    label: 'Reset',
    days: '14 Days',
    desc: 'Immediate support around one growth area. Quick wins and momentum.',
    icon: 'flash-outline',
    color: '#2563EB',
  },
  {
    key: 'Growth',
    label: 'Growth',
    days: '30 Days',
    desc: 'Steady development and habit-building. Recommended for most goals.',
    icon: 'trending-up-outline',
    color: '#2E7D62',
    recommended: true,
  },
  {
    key: 'Transformation',
    label: 'Transformation',
    days: '90 Days',
    desc: 'Deep long-term developmental progress and family culture change.',
    icon: 'sparkles-outline',
    color: '#7C3AED',
  },
];

const TEMPERAMENTS = ['Sensitive', 'Strong-willed', 'Shy', 'Energetic', 'Easily distracted', 'Withdrawn'];

export default function ChildPlanWizardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);

  // Step 1
  const [growthGoal, setGrowthGoal] = useState('');
  const [childAge, setChildAge] = useState('');
  const [childGender, setChildGender] = useState('');
  // Step 2
  const [journeyType, setJourneyType] = useState('Growth');
  // Step 3
  const [temperament, setTemperament] = useState([]);
  const [parentChallenge, setParentChallenge] = useState('');
  const [checkInDays, setCheckInDays] = useState(3);
  const [reminderTime, setReminderTime] = useState('08:00');
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const totalSteps = 3;

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

  async function handleGenerate() {
    if (!growthGoal.trim()) { setError('Please describe the growth issue.'); return; }
    if (!childAge.trim()) { setError("Please enter your child's age."); return; }
    setError('');
    setLoading(true);
    try {
      const profileRaw = await AsyncStorage.getItem('tarbiyah_profile');
      const profile = profileRaw ? JSON.parse(profileRaw) : {};
      const res = await fetch(`${API_URL}/child-plan/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ growthGoal, childAge, childGender, temperament: temperament.join(', '), parentChallenge, journeyType, familyStructure: profile.familyStructure ?? 'prefer_not_to_say' }),
      });
      if (!res.ok) throw new Error('Server error');
      const data = await res.json();

      const plan = {
        ...data,
        id: Date.now().toString(),
        growthGoal,
        childAge,
        childGender,
        temperament: temperament.join(', '),
        parentChallenge,
        journeyType,
        checkInDays,
        reminderTime,
        startDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      await saveChildPlan(plan);
      scheduleChildPlanReminder(reminderTime, plan).catch(() => {});
      scheduleChildPlanCheckIn(checkInDays, plan.startDate).catch(() => {});
      scheduleChildPlanCompletion(plan).catch(() => {});

      navigation.replace('ChildPlanDetail', { plan, initialTab: 'plan' });
    } catch (err) {
      console.error('Child plan generate error:', err);
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
          {['Islamic Foundation', 'Growth Roadmap', 'Parent Actions', 'Growth Opportunities'].map(l => (
            <View key={l} style={styles.loadingPill}><Text style={styles.loadingPillText}>{l}</Text></View>
          ))}
        </View>
        <View style={styles.keepOpenBanner}>
          <Ionicons name="warning" size={15} color="#F59E0B" />
          <Text style={styles.loadingKeepOpen}>Please keep the app open until your plan is ready</Text>
        </View>
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
          <Text style={styles.headerTitle}>Child Development Plan</Text>
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

          {/* ── Step 1: Goal + Age ── */}
          {step === 1 && (
            <View style={styles.stepWrap}>
              <Text style={styles.stepLabel}>STEP 1 OF {totalSteps}</Text>
              <Text style={styles.stepTitle}>What growth issue would you like to address?</Text>
              <Text style={styles.stepSubtitle}>e.g. confidence, responsibility, salah, emotional regulation, kindness</Text>
              <TextInput
                style={styles.textArea}
                placeholder={`e.g. "My 8-year-old struggles with responsibility. He forgets his tasks and needs constant reminders."`}
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={4}
                value={growthGoal}
                onChangeText={setGrowthGoal}
                textAlignVertical="top"
              />
              <Text style={styles.fieldLabel}>Child's age</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. 5, 10, 14"
                placeholderTextColor="#9CA3AF"
                value={childAge}
                onChangeText={setChildAge}
                keyboardType="default"
              />
              <Text style={styles.fieldLabel}>Child's gender (optional)</Text>
              <View style={styles.pillRow}>
                {['Boy', 'Girl'].map(g => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.pill, childGender === g && styles.pillActive]}
                    onPress={() => setChildGender(prev => prev === g ? '' : g)}
                  >
                    <Text style={[styles.pillText, childGender === g && styles.pillTextActive]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
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
              <Text style={styles.stepSubtitle}>Optional — helps personalise the plan further.</Text>

              <Text style={styles.fieldLabel}>Child's temperament (optional, select all that apply)</Text>
              <View style={styles.pillRow}>
                {TEMPERAMENTS.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.pill, temperament.includes(t) && styles.pillActive]}
                    onPress={() => setTemperament(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}
                  >
                    <Text style={[styles.pillText, temperament.includes(t) && styles.pillTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Your main challenge with this (optional)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. I get frustrated and raise my voice"
                placeholderTextColor="#9CA3AF"
                value={parentChallenge}
                onChangeText={setParentChallenge}
              />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <View style={styles.divider} />
              <Text style={styles.settingsTitle}>Daily Reminder</Text>
              <Text style={styles.stepSubtitle}>Set a daily reminder to complete your parent actions for the day.</Text>

              <Text style={styles.fieldLabel}>Reminder time</Text>
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
              <Text style={styles.settingSubtitle}>You'll receive a prompt to reflect on your child's progress and get personalised coaching to adjust your plan.</Text>
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
              style={[styles.ctaBtn, step === 1 && (!growthGoal.trim() || !childAge.trim()) && styles.ctaBtnDisabled]}
              onPress={() => {
                if (step === 1 && !growthGoal.trim()) { setError('Please describe the growth issue.'); return; }
                if (step === 1 && !childAge.trim()) { setError("Please enter your child's age."); return; }
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
  textArea: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    fontSize: 15, color: '#1C1C1E', lineHeight: 24, minHeight: 120,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  textInput: {
    backgroundColor: '#FFFFFF', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 15, color: '#1C1C1E',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  fieldLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, color: '#6B7280', marginBottom: -8 },
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
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 100, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E5E7EB' },
  pillActive: { backgroundColor: '#1B3D2F', borderColor: '#1B3D2F' },
  pillText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  pillTextActive: { color: '#FFFFFF' },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 4 },
  settingsTitle: { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },
  settingSubtitle: { fontSize: 13, color: '#6B7280', lineHeight: 19, marginTop: -4, marginBottom: 4 },
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
  keepOpenBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(245,158,11,0.12)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, marginTop: 32, borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)' },
  loadingKeepOpen: { fontSize: 12, color: '#F59E0B', fontWeight: '600', flex: 1 },
});
