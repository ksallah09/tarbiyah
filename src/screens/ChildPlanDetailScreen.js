import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getActiveChildPlan, getTodayActionLog, logAction,
  getActionLogs, clearChildPlan, daysSinceStart, streakCount, todayStr,
} from '../utils/childPlan';

const JOURNEY_COLORS = { Reset: '#2563EB', Growth: '#2E7D62', Transformation: '#7C3AED' };

function Section({ icon, title, color = '#1B3D2F', children }) {
  return (
    <View style={secStyles.wrap}>
      <View style={secStyles.titleRow}>
        <View style={[secStyles.iconWrap, { backgroundColor: color + '18' }]}>
          <Ionicons name={icon} size={16} color={color} />
        </View>
        <Text style={secStyles.title}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const secStyles = StyleSheet.create({
  wrap: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  iconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '700', color: '#1C1C1E', letterSpacing: 0.2 },
});

export default function ChildPlanDetailScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const [plan, setPlan] = useState(route.params?.plan || null);
  const [todayLog, setTodayLog] = useState([false, false, false, false, false]);
  const [logs, setLogs] = useState({});
  const [activeSection, setActiveSection] = useState(route.params?.initialTab || 'actions');

  useFocusEffect(useCallback(() => {
    async function load() {
      const p = plan || await getActiveChildPlan();
      setPlan(p);
      const tl = await getTodayActionLog();
      setTodayLog(tl);
      const l = await getActionLogs();
      setLogs(l);
    }
    load();
  }, []));

  async function handleActionToggle(index) {
    const newVal = !todayLog[index];
    const updated = [...todayLog];
    updated[index] = newVal;
    setTodayLog(updated);
    await logAction(todayStr(), index, newVal);
    const l = await getActionLogs();
    setLogs(l);
  }

  function handleClearPlan() {
    Alert.alert(
      'End Plan',
      'Are you sure you want to end this plan? Your progress will be cleared.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'End Plan', style: 'destructive', onPress: async () => { await clearChildPlan(); navigation.goBack(); } },
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
    { key: 'actions', label: 'Actions' },
    { key: 'plan', label: 'Plan' },
    { key: 'growth', label: 'Growth Tips' },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <StatusBar style="light" />
      <View style={styles.bgTop} />

      {/* Hero */}
      <LinearGradient colors={['#1B3D2F', '#0D2419']} style={[styles.hero, { paddingTop: insets.top + 12 }]}>
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

        <View style={styles.childBadge}>
          <Ionicons name="leaf-outline" size={12} color="#4ADE80" />
          <Text style={styles.childBadgeText}>Help My Child Grow · Age {plan.childAge}</Text>
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

        {/* ── Actions Tab ── */}
        {activeSection === 'actions' && (
          <>
            <Section icon="today-outline" title="Today's Parent Actions">
              {(plan.parentDailyActions || []).map((action, i) => (
                <TouchableOpacity key={i} style={styles.habitRow} onPress={() => handleActionToggle(i)} activeOpacity={0.75}>
                  <View style={[styles.habitCheck, todayLog[i] && styles.habitCheckDone]}>
                    {todayLog[i] && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                  </View>
                  <Text style={[styles.habitText, todayLog[i] && styles.habitTextDone]}>{action}</Text>
                </TouchableOpacity>
              ))}
            </Section>

            <Section icon="bulb-outline" title="If There Is Resistance" color="#C9A84C">
              <Text style={styles.bodyText}>{plan.ifResistance}</Text>
            </Section>

            <Section icon="bar-chart-outline" title="Signs of Healthy Progress" color="#2E7D62">
              {(plan.signsOfProgress || []).map((s, i) => (
                <View key={i} style={styles.bulletRow}>
                  <Ionicons name="checkmark-circle-outline" size={16} color="#2E7D62" />
                  <Text style={styles.bodyText}>{s}</Text>
                </View>
              ))}
            </Section>
          </>
        )}

        {/* ── Plan Tab ── */}
        {activeSection === 'plan' && (
          <>
            <Section icon="flag-outline" title="Growth Goal">
              <Text style={styles.bodyText}>{plan.growthGoal}</Text>
            </Section>

            <Section icon="help-circle-outline" title="What May Be Affecting This">
              {(plan.whatAffecting || []).map((w, i) => (
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
              {(plan.roadmap || []).map((phase, i) => (
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
                  <Text style={styles.actionStepText}>{plan.firstActionSteps?.[d]}</Text>
                </View>
              ))}
            </Section>

            <TouchableOpacity style={styles.endPlanBtn} onPress={handleClearPlan} activeOpacity={0.8}>
              <Text style={styles.endPlanText}>End This Plan</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── Growth Tips Tab ── */}
        {activeSection === 'growth' && (
          <>
            <Section icon="leaf-outline" title="Child Growth Opportunities" color="#2E7D62">
              <Text style={styles.sectionNote}>Age-appropriate ways your child can practice this naturally</Text>
              {(plan.childGrowthOpportunities || []).map((opp, i) => (
                <View key={i} style={styles.bulletRow}>
                  <View style={styles.bulletDot} />
                  <Text style={styles.bodyText}>{opp}</Text>
                </View>
              ))}
            </Section>

            <Section icon="chatbubble-outline" title="What to Say">
              {(plan.whatToSayScripts || []).map((s, i) => (
                <View key={i} style={styles.scriptCard}>
                  <Text style={styles.scriptText}>"{s}"</Text>
                </View>
              ))}
            </Section>

            <View style={[secStyles.wrap, { backgroundColor: '#1B3D2F' }]}>
              <Text style={styles.reminderText}>{plan.parentReminder}</Text>
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6F8' },
  bgTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 240, backgroundColor: '#1B3D2F' },
  hero: { paddingHorizontal: 20, paddingBottom: 20, gap: 10 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  journeyBadge: { borderRadius: 100, paddingHorizontal: 12, paddingVertical: 5 },
  journeyBadgeText: { fontSize: 12, fontWeight: '700' },
  childBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
  childBadgeText: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },
  heroTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', lineHeight: 28 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
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
  sectionNote: { fontSize: 12, color: '#9CA3AF', marginBottom: 10, lineHeight: 18 },
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
  reminderText: { fontSize: 15, color: '#FFFFFF', lineHeight: 24, fontStyle: 'italic', textAlign: 'center' },
  endPlanBtn: { alignItems: 'center', paddingVertical: 14, marginBottom: 10 },
  endPlanText: { fontSize: 14, fontWeight: '600', color: '#9CA3AF' },
});
