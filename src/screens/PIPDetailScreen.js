import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getActivePlan, savePlan, getTodayLog, logHabit,
  getHabitLogs, getCheckIns, saveCheckIn, clearPlan,
  daysSinceStart, streakCount, todayStr,
} from '../utils/pip';
import { schedulePIPCheckIn } from '../utils/notifications';

const API_URL = 'https://tarbiyah-production.up.railway.app';

const JOURNEY_COLORS = { Reset: '#2563EB', Growth: '#2E7D62', Transformation: '#7C3AED' };

function Section({ icon, title, subtitle, color = '#1B3D2F', children }) {
  return (
    <View style={secStyles.wrap}>
      <View style={secStyles.titleRow}>
        <View style={[secStyles.iconWrap, { backgroundColor: color + '18' }]}>
          <Ionicons name={icon} size={16} color={color} />
        </View>
        <Text style={secStyles.title}>{title}</Text>
      </View>
      {subtitle ? <Text style={secStyles.subtitle}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

const secStyles = StyleSheet.create({
  wrap: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  iconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '700', color: '#1C1C1E', letterSpacing: 0.2 },
  subtitle: { fontSize: 12, color: '#9CA3AF', lineHeight: 18, marginTop: -8, marginBottom: 10 },
});

export default function PIPDetailScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const [plan, setPlan] = useState(route.params?.plan || null);
  const [todayLog, setTodayLog] = useState([false, false, false, false, false]);
  const [logs, setLogs] = useState({});
  const [checkIns, setCheckIns] = useState([]);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [checkInText, setCheckInText] = useState('');
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [activeSection, setActiveSection] = useState(route.params?.initialTab || 'habits');

  useFocusEffect(useCallback(() => {
    async function load() {
      const p = plan || await getActivePlan();
      setPlan(p);
      const tl = await getTodayLog();
      setTodayLog(tl);
      const l = await getHabitLogs();
      setLogs(l);
      const ci = await getCheckIns();
      setCheckIns(ci);
    }
    load();
  }, []));

  async function handleHabitToggle(index) {
    const newVal = !todayLog[index];
    const updated = [...todayLog];
    updated[index] = newVal;
    setTodayLog(updated);
    await logHabit(todayStr(), index, newVal);
    const l = await getHabitLogs();
    setLogs(l);
  }

  async function handleCheckInSubmit() {
    if (!checkInText.trim()) return;
    setCheckInLoading(true);
    try {
      const dayNumber = daysSinceStart(plan.startDate);
      const currentHabits = plan.dailyHabits;
      const res = await fetch(`${API_URL}/pip/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: checkInText, currentHabits, journeyType: plan.journeyType, dayNumber }),
      });
      const data = await res.json();

      const ci = {
        id: Date.now().toString(),
        dayNumber,
        feedback: checkInText,
        coachingResponse: data.coachingResponse,
        adjustedHabits: data.adjustedHabits,
        createdAt: new Date().toISOString(),
      };

      await saveCheckIn(ci);

      if (data.adjustedHabits && data.adjustedHabits.length === 5) {
        const updatedPlan = { ...plan, dailyHabits: data.adjustedHabits };
        await savePlan(updatedPlan);
        setPlan(updatedPlan);
        const nextCheckIn = new Date();
        nextCheckIn.setDate(nextCheckIn.getDate() + plan.checkInDays);
        await schedulePIPCheckIn(plan.checkInDays, nextCheckIn.toISOString());
      }

      setCheckIns(prev => [ci, ...prev]);
      setCheckInText('');
      setShowCheckIn(false);
    } catch {
      Alert.alert('Error', 'Could not submit check-in. Please try again.');
    } finally {
      setCheckInLoading(false);
    }
  }

  function handleClearPlan() {
    Alert.alert(
      'End Plan',
      'Are you sure you want to end your current plan? Your progress will be cleared.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'End Plan', style: 'destructive', onPress: async () => { await clearPlan(); navigation.goBack(); } },
      ]
    );
  }

  if (!plan) return null;

  const dayNumber    = daysSinceStart(plan.startDate);
  const progress     = Math.min(dayNumber / plan.durationDays, 1);
  const streak       = streakCount(logs);
  const journeyColor = JOURNEY_COLORS[plan.journeyType] || '#2E7D62';
  const todayDone    = todayLog.filter(Boolean).length;

  const TABS = [
    { key: 'habits', label: 'Habits' },
    { key: 'plan', label: 'Plan' },
    { key: 'checkins', label: `Check-ins${checkIns.length > 0 ? ` (${checkIns.length})` : ''}` },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <StatusBar style="light" />
      <View style={[styles.bgTop, { backgroundColor: '#1A2E4A' }]} />

      {/* Hero */}
      <LinearGradient colors={['#1A2E4A', '#0D1E33']} style={[styles.hero, { paddingTop: insets.top + 12 }]}>
        <View style={styles.heroTopRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={24} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
          <View style={[styles.journeyBadge, { backgroundColor: journeyColor + '30' }]}>
            <Text style={[styles.journeyBadgeText, { color: journeyColor === '#2E7D62' ? '#4ADE80' : '#C9A84C' }]}>
              {plan.journeyType} · {plan.durationDays} days
            </Text>
          </View>
          <TouchableOpacity onPress={handleClearPlan} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="ellipsis-horizontal" size={22} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        </View>

        <Text style={styles.heroTitle}>{plan.title}</Text>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statNum}>Day {dayNumber}</Text>
            <Text style={styles.statLabel}>of {plan.durationDays}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statNum}>{streak}</Text>
            <Text style={styles.statLabel}>Day streak</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statNum}>{todayDone}/5</Text>
            <Text style={styles.statLabel}>Today</Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: journeyColor === '#2E7D62' ? '#4ADE80' : '#C9A84C' }]} />
        </View>
      </LinearGradient>

      {/* Tabs */}
      <View style={styles.tabs}>
        {TABS.map(tab => (
          <TouchableOpacity key={tab.key} style={[styles.tab, activeSection === tab.key && styles.tabActive]} onPress={() => setActiveSection(tab.key)}>
            <Text style={[styles.tabText, activeSection === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Habits Tab ── */}
        {activeSection === 'habits' && (
          <>
            <Section icon="today-outline" title="Today's To-do's" subtitle="Check off each one as you complete it. Resets at midnight.">
              {plan.dailyHabits.map((habit, i) => (
                <TouchableOpacity key={i} style={styles.habitRow} onPress={() => handleHabitToggle(i)} activeOpacity={0.75}>
                  <View style={[styles.habitCheck, todayLog[i] && styles.habitCheckDone]}>
                    {todayLog[i] && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                  </View>
                  <Text style={[styles.habitText, todayLog[i] && styles.habitTextDone]}>{habit}</Text>
                </TouchableOpacity>
              ))}
            </Section>

            <TouchableOpacity style={styles.checkInBtn} onPress={() => setShowCheckIn(true)} activeOpacity={0.85}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color="#1B3D2F" />
              <Text style={styles.checkInBtnText}>Submit a Check-in</Text>
            </TouchableOpacity>

            {checkIns.length > 0 && (
              <Section icon="sparkles-outline" title="Latest Coaching" color="#C9A84C">
                <Text style={styles.coachingText}>{checkIns[0].coachingResponse}</Text>
                <Text style={styles.coachingDay}>Day {checkIns[0].dayNumber} check-in</Text>
              </Section>
            )}
          </>
        )}

        {/* ── Plan Tab ── */}
        {activeSection === 'plan' && (
          <>
            <Section icon="flag-outline" title="Big Picture Goal">
              <Text style={styles.bodyText}>{plan.bigPictureGoal}</Text>
            </Section>

            <Section icon="help-circle-outline" title="Why This May Be Happening">
              {plan.whyHappening.map((w, i) => (
                <View key={i} style={styles.bulletRow}>
                  <View style={styles.bulletDot} />
                  <Text style={styles.bodyText}>{w}</Text>
                </View>
              ))}
            </Section>

            <Section icon="moon-outline" title="Islamic Foundation" color="#C9A84C">
              <Text style={styles.bodyText}>{plan.islamicFoundation}</Text>
            </Section>

            <Section icon="flask-outline" title="Research Insight" color="#2563EB">
              <Text style={styles.bodyText}>{plan.researchInsight}</Text>
            </Section>

            <Section icon="map-outline" title="Your Roadmap">
              {plan.roadmap.map((phase, i) => (
                <View key={i} style={[styles.phaseRow, i < plan.roadmap.length - 1 && styles.phaseRowBorder]}>
                  <Text style={styles.phaseLabel}>{phase.phase}</Text>
                  <Text style={styles.phaseTitle}>{phase.title}</Text>
                  <Text style={styles.phaseDesc}>{phase.description}</Text>
                </View>
              ))}
            </Section>

            <Section icon="footsteps-outline" title="First Action Steps" color="#7C3AED">
              {['day1', 'day2', 'day3'].map((d, i) => (
                <View key={d} style={styles.actionRow}>
                  <View style={styles.actionDayBadge}><Text style={styles.actionDayText}>Day {i + 1}</Text></View>
                  <Text style={styles.actionStepText}>{plan.firstActionSteps[d]}</Text>
                </View>
              ))}
            </Section>

            <Section icon="chatbubble-outline" title="What to Say">
              {plan.whatToSayScripts.map((s, i) => (
                <View key={i} style={styles.scriptCard}>
                  <Text style={styles.scriptText}>"{s}"</Text>
                </View>
              ))}
            </Section>

            <Section icon="refresh-outline" title="When You Slip Up">
              <Text style={styles.bodyText}>{plan.whenYouSlipUp}</Text>
            </Section>

            <Section icon="bar-chart-outline" title="Signs of Progress">
              {plan.progressMetrics.map((m, i) => (
                <View key={i} style={styles.bulletRow}>
                  <Ionicons name="checkmark-circle-outline" size={16} color="#2E7D62" />
                  <Text style={styles.bodyText}>{m}</Text>
                </View>
              ))}
            </Section>

            <View style={[secStyles.wrap, { backgroundColor: '#1B3D2F' }]}>
              <Text style={styles.reminderText}>{plan.parentReminder}</Text>
            </View>

            <TouchableOpacity style={styles.endPlanBtn} onPress={handleClearPlan} activeOpacity={0.8}>
              <Text style={styles.endPlanText}>End This Plan</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── Check-ins Tab ── */}
        {activeSection === 'checkins' && (
          <>
            <TouchableOpacity style={styles.checkInBtn} onPress={() => setShowCheckIn(true)} activeOpacity={0.85}>
              <Ionicons name="add-circle-outline" size={18} color="#1B3D2F" />
              <Text style={styles.checkInBtnText}>New Check-in</Text>
            </TouchableOpacity>

            {checkIns.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="chatbubble-ellipses-outline" size={44} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>No check-ins yet</Text>
                <Text style={styles.emptyBody}>Your {plan.checkInDays}-day check-in notification will remind you, or tap above to check in now.</Text>
              </View>
            ) : checkIns.map(ci => (
              <View key={ci.id} style={styles.checkInCard}>
                <View style={styles.checkInCardHeader}>
                  <Text style={styles.checkInCardDay}>Day {ci.dayNumber} check-in</Text>
                  <Text style={styles.checkInCardDate}>{new Date(ci.createdAt).toLocaleDateString()}</Text>
                </View>
                <Text style={styles.checkInFeedback}>"{ci.feedback}"</Text>
                <View style={styles.checkInDivider} />
                <View style={styles.checkInCoachRow}>
                  <Ionicons name="sparkles" size={14} color="#C9A84C" />
                  <Text style={styles.coachingText}>{ci.coachingResponse}</Text>
                </View>
                {ci.adjustedHabits && (
                  <View style={styles.adjustedWrap}>
                    <Text style={styles.adjustedLabel}>Updated habits</Text>
                    {ci.adjustedHabits.map((h, i) => (
                      <Text key={i} style={styles.adjustedHabit}>· {h}</Text>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Check-in modal */}
      {showCheckIn && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.checkInOverlay}>
          <TouchableOpacity style={styles.checkInBackdrop} activeOpacity={1} onPress={() => setShowCheckIn(false)} />
          <View style={[styles.checkInSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.checkInHandle} />
            <Text style={styles.checkInSheetTitle}>How's it going?</Text>
            <Text style={styles.checkInSheetSubtitle}>Share honestly — your coach will adapt your plan if needed.</Text>
            <TextInput
              style={styles.checkInInput}
              placeholder="e.g. I've been consistent with 3 habits but struggling with the morning one. The kids are still resistant..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={5}
              value={checkInText}
              onChangeText={setCheckInText}
              textAlignVertical="top"
              autoFocus
            />
            <TouchableOpacity
              style={[styles.checkInSubmit, (!checkInText.trim() || checkInLoading) && { opacity: 0.5 }]}
              onPress={handleCheckInSubmit}
              disabled={!checkInText.trim() || checkInLoading}
              activeOpacity={0.85}
            >
              {checkInLoading
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={styles.checkInSubmitText}>Submit Check-in</Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6F8' },
  bgTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 220, backgroundColor: '#1B3D2F' },
  hero: { paddingHorizontal: 20, paddingBottom: 20, gap: 12 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  journeyBadge: { borderRadius: 100, paddingHorizontal: 12, paddingVertical: 5 },
  journeyBadgeText: { fontSize: 12, fontWeight: '700' },
  heroTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', lineHeight: 28 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statNum: { fontSize: 22, fontWeight: '700', color: '#FFFFFF' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: '500' },
  statDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.15)' },
  progressTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },
  tabs: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tab: { flex: 1, paddingVertical: 13, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#1B3D2F' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#9CA3AF' },
  tabTextActive: { color: '#1B3D2F' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },
  habitRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  habitCheck: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  habitCheckDone: { backgroundColor: '#2E7D62', borderColor: '#2E7D62' },
  habitText: { flex: 1, fontSize: 14, color: '#374151', lineHeight: 20 },
  habitTextDone: { color: '#9CA3AF', textDecorationLine: 'line-through' },
  bodyText: { fontSize: 14, color: '#374151', lineHeight: 22, flex: 1 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  bulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#1B3D2F', marginTop: 8 },
  phaseRow: { paddingVertical: 12, gap: 3 },
  phaseRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  phaseLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, color: '#9CA3AF' },
  phaseTitle: { fontSize: 15, fontWeight: '700', color: '#1C1C1E' },
  phaseDesc: { fontSize: 13, color: '#6B7280', lineHeight: 19 },
  actionRow: { gap: 6, marginBottom: 12 },
  actionStepText: { fontSize: 14, color: '#374151', lineHeight: 22 },
  actionDayBadge: { backgroundColor: '#7C3AED18', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  actionDayText: { fontSize: 11, fontWeight: '700', color: '#7C3AED' },
  scriptCard: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: '#1B3D2F' },
  scriptText: { fontSize: 14, color: '#374151', lineHeight: 22, fontStyle: 'italic' },
  checkInBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 14, marginBottom: 14,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  checkInBtnText: { fontSize: 14, fontWeight: '700', color: '#1B3D2F' },
  coachingText: { fontSize: 14, color: '#374151', lineHeight: 22, flex: 1 },
  coachingDay: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginTop: 8 },
  reminderText: { fontSize: 15, color: '#FFFFFF', lineHeight: 24, fontStyle: 'italic', textAlign: 'center' },
  endPlanBtn: { alignItems: 'center', paddingVertical: 14, marginBottom: 10 },
  endPlanText: { fontSize: 14, fontWeight: '600', color: '#9CA3AF' },
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#374151' },
  emptyBody: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 22 },
  checkInCard: {
    backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  checkInCardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  checkInCardDay: { fontSize: 12, fontWeight: '700', color: '#1B3D2F' },
  checkInCardDate: { fontSize: 12, color: '#9CA3AF' },
  checkInFeedback: { fontSize: 13, color: '#6B7280', lineHeight: 20, fontStyle: 'italic', marginBottom: 10 },
  checkInDivider: { height: 1, backgroundColor: '#F3F4F6', marginBottom: 10 },
  checkInCoachRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  adjustedWrap: { marginTop: 12, backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12, gap: 4 },
  adjustedLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.8, marginBottom: 4 },
  adjustedHabit: { fontSize: 13, color: '#374151', lineHeight: 20 },
  checkInOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  checkInBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  checkInSheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 16, gap: 14,
  },
  checkInHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 4 },
  checkInSheetTitle: { fontSize: 20, fontWeight: '700', color: '#1C1C1E' },
  checkInSheetSubtitle: { fontSize: 14, color: '#6B7280', lineHeight: 22, marginTop: -6 },
  checkInInput: {
    backgroundColor: '#F9FAFB', borderRadius: 14, padding: 14,
    fontSize: 15, color: '#1C1C1E', lineHeight: 23, minHeight: 120,
  },
  checkInSubmit: {
    backgroundColor: '#1B3D2F', borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  checkInSubmitText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
