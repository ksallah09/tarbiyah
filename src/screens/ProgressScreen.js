import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  AppState,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DarkHeader from '../components/DarkHeader';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { getMonthReadDays, getStreak } from '../utils/readInsights';

import { loadFamilyGoals, loadFamilyGoalsCached, deleteFamilyGoal } from '../utils/familyGoals';
import { getCachedSyncStatus, getFamilySyncStatus } from '../utils/familySync';
import { loadCompletions, countThisWeek, isCompletedToday, logCompletion } from '../utils/goalCompletions';
import { rs, hp } from '../utils/responsive';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// Module-level caches so state initialises instantly on re-mount
let _spirCache       = [];
let _sciCache        = [];
let _quranCache      = [];
let _spirStreakCache  = 0;
let _sciStreakCache   = 0;
let _quranStreakCache = 0;
let _familyGoalsCache  = [];
let _completionsCache  = [];
let _syncStatusCache   = { linked: false, partner: null };

function MonthGrid({ days, color, todayColor }) {
  return (
    <View style={gridStyles.grid}>
      {days.map(d => (
        <View
          key={d.day}
          style={[
            gridStyles.dot,
            d.completed && { backgroundColor: color },
            d.today && !d.completed && { backgroundColor: todayColor, borderColor: color, borderWidth: 1.5 },
            d.future && gridStyles.dotFuture,
          ]}
        >
          {d.today && !d.completed
            ? <Text style={[gridStyles.dotNum, { color, fontWeight: '700' }]}>{d.day}</Text>
            : !d.completed && !d.future
              ? <Text style={gridStyles.dotNum}>{d.day}</Text>
              : d.completed
                ? <Ionicons name="checkmark" size={10} color="#FFF" />
                : null
          }
        </View>
      ))}
    </View>
  );
}

const gridStyles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F0F1F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotFuture: { backgroundColor: '#F7F8F9' },
  dotNum: { fontSize: 10, fontWeight: '600', color: '#9CA3AF' },
});

export default function ProgressScreen({ navigation }) {
  const [spirMonth,   setSpiritualMonth]   = useState(_spirCache);
  const [sciMonth,    setScientificMonth]  = useState(_sciCache);
  const [quranMonth,  setQuranMonth]       = useState(_quranCache);
  const [spirStreak,  setSpiritualStreak]  = useState(_spirStreakCache);
  const [sciStreak,   setScientificStreak] = useState(_sciStreakCache);
  const [quranStreak, setQuranStreak]      = useState(_quranStreakCache);
  const [familyGoals,  setFamilyGoals]  = useState(_familyGoalsCache);
  const [completions,  setCompletions]  = useState(_completionsCache);
  const [syncStatus,   setSyncStatus]   = useState(_syncStatusCache);
  const [refreshing,  setRefreshing]       = useState(false);
  const hasMountedRef = useRef(false);

  const now = new Date();
  const monthLabel = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;

  const refreshAll = useCallback(() => {
    getMonthReadDays('spiritual').then(v  => { _spirCache       = v;  setSpiritualMonth(v); });
    getMonthReadDays('scientific').then(v => { _sciCache        = v;  setScientificMonth(v); });
    getMonthReadDays('quran').then(v      => { _quranCache      = v;  setQuranMonth(v); });
    getStreak('spiritual').then(v         => { _spirStreakCache  = v;  setSpiritualStreak(v); });
    getStreak('scientific').then(v        => { _sciStreakCache   = v;  setScientificStreak(v); });
    getStreak('quran').then(v             => { _quranStreakCache = v;  setQuranStreak(v); });

    // Phase 1: show cached goals + completions instantly (no network wait)
    if (_familyGoalsCache.length === 0) {
      loadFamilyGoalsCached().then(cached => {
        if (cached.length > 0) { _familyGoalsCache = cached; setFamilyGoals(cached); }
      });
    }
    loadCompletions().then(v => { _completionsCache = v; setCompletions(v); });

    // Phase 2: sync status (AsyncStorage instant → Supabase background)
    getCachedSyncStatus().then(cached => {
      _syncStatusCache = cached; setSyncStatus(cached);
      getFamilySyncStatus().then(live => {
        _syncStatusCache = live; setSyncStatus(live);
        // Reload goals after sync resolves in case family_id changed
        loadFamilyGoals().then(v => { _familyGoalsCache = v; setFamilyGoals(v); });
      });
    });
  }, []);

  // Initial load on mount
  useEffect(() => { refreshAll(); }, []);

  // Re-sync on subsequent focuses to pick up reads/updates from other tabs
  // Skip the very first focus since useEffect already handles initial load
  useFocusEffect(useCallback(() => {
    if (!hasMountedRef.current) { hasMountedRef.current = true; return; }
    refreshAll();
  }, [refreshAll]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      getMonthReadDays('spiritual').then(setSpiritualMonth),
      getMonthReadDays('scientific').then(setScientificMonth),
      getMonthReadDays('quran').then(setQuranMonth),
      getStreak('spiritual').then(setSpiritualStreak),
      getStreak('scientific').then(setScientificStreak),
      getStreak('quran').then(setQuranStreak),
      loadCompletions().then(v => { _completionsCache = v; setCompletions(v); }),
      getFamilySyncStatus().then(live => {
        setSyncStatus(live);
        return loadFamilyGoals().then(setFamilyGoals);
      }),
    ]);
    setRefreshing(false);
  }, []);

  // Re-sync when the app comes back to the foreground (cross-device updates)
  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        refreshAll();
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [refreshAll]);

  async function handleLogCompletion(goalId) {
    const updated = await logCompletion(goalId);
    _completionsCache = updated;
    setCompletions(updated);
  }

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <View style={styles.bgTop} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#2E7D62"
            colors={['#2E7D62']}
          />
        }
      >
        <DarkHeader title="Progress" subtitle="Track your daily reading consistency" />
        <View style={styles.sheet}>
        <View style={styles.content}>

        {/* ── Family Goals ── */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>FAMILY GOALS</Text>
          <TouchableOpacity
            style={styles.addGoalBtn}
            onPress={() => navigation.navigate('FamilyGoalWizard')}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={14} color="#FFFFFF" />
            <Text style={styles.addGoalBtnText}>Add Goal</Text>
          </TouchableOpacity>
        </View>

        {familyGoals.length === 0 ? (
          <TouchableOpacity
            style={styles.familyEmptyCard}
            onPress={() => navigation.navigate('FamilyGoalWizard')}
            activeOpacity={0.8}
          >
            <View style={styles.familyEmptyIcon}>
              <Ionicons name="people" size={28} color="#2E7D62" />
            </View>
            <Text style={styles.familyEmptyTitle}>Set your first family goal</Text>
            <Text style={styles.familyEmptySubtitle}>
              Pray together, eat together, read Quran — build habits that matter
            </Text>
            <View style={styles.familyEmptyBtn}>
              <Text style={styles.familyEmptyBtnText}>Get started</Text>
              <Ionicons name="arrow-forward" size={13} color="#1B3D2F" />
            </View>
          </TouchableOpacity>
        ) : (
          familyGoals.map(goal => {
            const target    = goal.frequency ?? 1;
            const count     = countThisWeek(completions, goal.id);
            const doneToday = isCompletedToday(completions, goal.id);
            const goalMet   = count >= target;
            const dotCount  = Math.min(target, 7);
            return (
              <View key={goal.id} style={[styles.familyGoalCard, { alignItems: 'flex-start' }]}>
                <View style={[styles.familyGoalIconWrap, { backgroundColor: '#2E7D62', marginTop: 2 }]}>
                  <Ionicons name={goal.icon ?? 'trophy'} size={18} color="#F5C242" />
                </View>
                <View style={styles.familyGoalBody}>
                  <Text style={styles.familyGoalTitle}>{goal.title}</Text>
                  <View style={styles.familyGoalMeta}>
                    <Ionicons name="repeat-outline" size={11} color="#9CA3AF" />
                    <Text style={styles.familyGoalMetaText}>{goal.frequencyLabel}</Text>
                    {goal.reminderEnabled && (
                      <>
                        <View style={styles.familyGoalMetaDot} />
                        <Ionicons name="notifications-outline" size={11} color="#9CA3AF" />
                        <Text style={styles.familyGoalMetaText}>Reminder on</Text>
                      </>
                    )}
                  </View>

                  {/* ── Completion tracker ── */}
                  <View style={styles.trackerStrip}>
                    <View style={styles.trackerDots}>
                      {Array.from({ length: dotCount }).map((_, i) => (
                        <View key={i} style={[styles.trackerDot, i < count && styles.trackerDotFilled]} />
                      ))}
                    </View>
                    <Text style={styles.trackerCount}>{count}/{target} this week</Text>
                    <View style={styles.trackerSpacer} />
                    {goalMet ? (
                      <View style={styles.trackerMetPill}>
                        <Ionicons name="checkmark-circle" size={12} color="#2E7D62" />
                        <Text style={styles.trackerMetText}>Goal met</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[styles.trackerLogBtn, doneToday && styles.trackerLogBtnDone]}
                        onPress={() => handleLogCompletion(goal.id)}
                        disabled={doneToday}
                        activeOpacity={0.75}
                      >
                        <Ionicons name={doneToday ? 'checkmark' : 'add'} size={12} color={doneToday ? '#2E7D62' : '#FFFFFF'} />
                        <Text style={[styles.trackerLogBtnText, doneToday && { color: '#2E7D62' }]}>
                          {doneToday ? 'Done today' : 'Log it'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                <View style={[styles.familyGoalActions, { marginTop: 2 }]}>
                  <TouchableOpacity
                    style={styles.familyGoalEditBtn}
                    onPress={() => navigation.navigate('FamilyGoalWizard', { goal })}
                  >
                    <Ionicons name="pencil-outline" size={14} color="#6B7C45" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.familyGoalDeleteBtn}
                    onPress={async () => {
                      await deleteFamilyGoal(goal.id);
                      setFamilyGoals(prev => prev.filter(g => g.id !== goal.id));
                    }}
                  >
                    <Ionicons name="trash-outline" size={14} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}

        {/* Family sync status */}
        {syncStatus.linked ? (
          <View style={styles.syncLinkedCard}>
            <View style={styles.syncLinkedAvatarRow}>
              <View style={styles.syncAvatar}>
                <Ionicons name="person" size={18} color="#2E7D62" />
              </View>
              <View style={styles.syncLinkedLine} />
              <Ionicons name="heart" size={14} color="#D4871A" />
              <View style={styles.syncLinkedLine} />
              <View style={styles.syncAvatar}>
                <Ionicons name="person" size={18} color="#2E7D62" />
              </View>
            </View>
            <Text style={styles.syncLinkedLabel}>Connected with</Text>
            <Text style={styles.syncLinkedName}>{syncStatus.partner?.name || 'Your partner'}</Text>
            <TouchableOpacity
              style={styles.syncEditBtn}
              onPress={() => navigation.navigate('FamilySync')}
              activeOpacity={0.8}
            >
              <Ionicons name="pencil-outline" size={13} color="#2E7D62" />
              <Text style={styles.syncEditText}>Edit</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.spouseSyncBanner}
            onPress={() => navigation.navigate('FamilySync')}
            activeOpacity={0.8}
          >
            <Ionicons name="people-outline" size={15} color="#2E7D62" />
            <Text style={styles.spouseSyncText}>Connect with your partner to share goals</Text>
            <Ionicons name="chevron-forward" size={13} color="#2E7D62" />
          </TouchableOpacity>
        )}

        {/* ── Streak counters ── */}
        <Text style={[styles.sectionTitle, { marginTop: 28 }]}>CURRENT LEARNING STREAKS</Text>
        <View style={styles.streakRow}>
          {[
            { label: 'Spiritual',  streak: spirStreak,  icon: 'moon',        color: '#2E7D62', bg: '#E8F5EF' },
            { label: 'Research',   streak: sciStreak,   icon: 'bulb-outline', color: '#D4871A', bg: '#FEF3E7' },
            { label: 'Quran',      streak: quranStreak, icon: 'book-outline', color: '#1A3A6B', bg: '#EEF4FB' },
          ].map(({ label, streak, icon, color, bg }) => (
            <View key={label} style={[styles.streakCountCard, { backgroundColor: bg }]}>
              <Ionicons name={icon} size={16} color={color} />
              <Text style={[styles.streakCountNum, { color }]}>{streak}</Text>
              <Text style={[styles.streakCountLabel, { color }]}>{label}</Text>
              <Text style={styles.streakCountSub}>day streak</Text>
            </View>
          ))}
        </View>

        {/* ── This Month ── */}
        <Text style={[styles.sectionTitle, { marginTop: 28 }]}>THIS MONTH</Text>

        {/* Spiritual month */}
        <View style={[styles.trackCard, styles.trackCardSpiritual]}>
          <View style={styles.cardTopRow}>
            <View style={styles.labelRow}>
              <Ionicons name="moon" size={13} color="#2E7D62" />
              <Text style={[styles.cardLabel, { color: '#2E7D62' }]}>Spiritual</Text>
            </View>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
          </View>
          <Text style={styles.subLabel}>Days you read a spiritual insight</Text>
          <MonthGrid days={spirMonth} color="#1B3D2F" todayColor="#D6EFE3" />
          <View style={styles.streakInline}>
            <Ionicons name="flame" size={12} color="#2E7D62" />
            <Text style={[styles.streakInlineText, { color: '#2E7D62' }]}>{spirStreak} day streak</Text>
          </View>
        </View>

        {/* Scientific month */}
        <View style={[styles.trackCard, styles.trackCardResearch, { marginTop: 12 }]}>
          <View style={styles.cardTopRow}>
            <View style={styles.labelRow}>
              <Ionicons name="bulb-outline" size={13} color="#D4871A" />
              <Text style={[styles.cardLabel, { color: '#D4871A' }]}>Research</Text>
            </View>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
          </View>
          <Text style={styles.subLabel}>Days you read a scientific insight</Text>
          <MonthGrid days={sciMonth} color="#D4871A" todayColor="#FDE8C0" />
          <View style={styles.streakInline}>
            <Ionicons name="flame" size={12} color="#D4871A" />
            <Text style={[styles.streakInlineText, { color: '#D4871A' }]}>{sciStreak} day streak</Text>
          </View>
        </View>

        {/* Quran month */}
        <View style={[styles.trackCard, styles.trackCardQuran, { marginTop: 12 }]}>
          <View style={styles.cardTopRow}>
            <View style={styles.labelRow}>
              <Ionicons name="book-outline" size={13} color="#6B9FD4" />
              <Text style={[styles.cardLabel, { color: '#6B9FD4' }]}>Quran</Text>
            </View>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
          </View>
          <Text style={styles.subLabel}>Days you read the verses of the day</Text>
          <MonthGrid days={quranMonth} color="#1A3A6B" todayColor="#D0E4F7" />
          <View style={styles.streakInline}>
            <Ionicons name="flame" size={12} color="#6B9FD4" />
            <Text style={[styles.streakInlineText, { color: '#6B9FD4' }]}>{quranStreak} day streak</Text>
          </View>
        </View>

        <View style={{ height: 32 }} />
        </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6F8' },
  bgTop: { position: 'absolute', top: 0, left: 0, right: 0, height: '50%', backgroundColor: '#1B3D2F' },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  sheet: {
    flexGrow: 1,
    backgroundColor: '#F5F6F8',
    overflow: 'hidden',
  },
  content: { paddingHorizontal: hp, paddingTop: 20 },

  // ── Streak inline ──
  trackCardSpiritual: { borderTopWidth: 2, borderTopColor: '#1B3D2F' },
  trackCardResearch:  { borderTopWidth: 2, borderTopColor: '#D4871A' },
  trackCardQuran:     { borderTopWidth: 2, borderTopColor: '#1A3A6B' },
  streakInline: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 14 },
  streakInlineText: { fontSize: 11, fontWeight: '700' },

  // ── Section title ──
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1B3D2F',
    letterSpacing: 0.3,
    marginBottom: 14,
  },
  streakRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  streakCountCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    gap: 2,
  },
  streakCountNum: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -1,
    marginTop: 6,
  },
  streakCountEmoji: {
    fontSize: 14, // kept for layout spacing — rendered as Ionicons
  },
  streakCountLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginTop: 4,
  },
  streakCountSub: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  addGoalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2E7D62',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addGoalBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // ── Family Goal empty state ──
  familyEmptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#1B3D2F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
    borderTopWidth: 3,
    borderTopColor: '#2E7D62',
  },
  familyEmptyIcon: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#E6F4EE',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  familyEmptyTitle: {
    fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 6,
  },
  familyEmptySubtitle: {
    fontSize: 13, color: '#6B7280', textAlign: 'center',
    lineHeight: 20, marginBottom: 20,
  },
  familyEmptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#2E7D62', borderRadius: 20,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  familyEmptyBtnText: {
    fontSize: 13, fontWeight: '700', color: '#FFFFFF',
  },

  // ── Family Goal cards ──
  familyGoalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#1B3D2F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    borderLeftWidth: 3,
    borderLeftColor: '#2E7D62',
  },
  familyGoalIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  familyGoalBody: { flex: 1, minWidth: 0 },
  familyGoalTitle: {
    fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 5,
  },
  familyGoalMeta: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  familyGoalMetaText: {
    fontSize: 11, color: '#6B7280', fontWeight: '500', flexShrink: 1,
  },
  familyGoalMetaDot: {
    width: 3, height: 3, borderRadius: 2,
    backgroundColor: '#D1D5DB', marginHorizontal: 2,
  },
  // ── Completion tracker ──
  trackerStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F1F3',
  },
  trackerDots: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  trackerDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#E5E7EB',
  },
  trackerDotFilled: {
    backgroundColor: '#2E7D62',
  },
  trackerCount: {
    fontSize: 11, color: '#6B7280', fontWeight: '600', flexShrink: 0,
  },
  trackerSpacer: { flex: 1 },
  trackerMetPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#E8F5EF', borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  trackerMetText: {
    fontSize: 11, color: '#2E7D62', fontWeight: '700',
  },
  trackerLogBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#2E7D62', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  trackerLogBtnDone: { backgroundColor: '#E8F5EF' },
  trackerLogBtnText: {
    fontSize: 11, color: '#FFFFFF', fontWeight: '700',
  },

  familyGoalActions: {
    flexDirection: 'row', gap: 8,
  },
  familyGoalEditBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#E6F4EE',
    alignItems: 'center', justifyContent: 'center',
  },
  familyGoalDeleteBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Spouse sync banner ──
  spouseSyncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E6F4EE',
    borderRadius: 12,
    padding: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#A7D7C5',
  },
  spouseSyncText: {
    flex: 1, fontSize: 12, color: '#2E7D62',
    lineHeight: 17, fontWeight: '600',
  },

  // ── Sync linked card ──
  syncLinkedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#A7D7C5',
    shadowColor: '#1B3D2F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  syncLinkedAvatarRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, marginBottom: 12,
  },
  syncAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#E6F4EE',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#A7D7C5',
  },
  syncLinkedLine: {
    flex: 1, height: 1.5,
    backgroundColor: '#A7D7C5',
  },
  syncLinkedLabel: {
    fontSize: 11, color: '#9CA3AF', fontWeight: '500', marginBottom: 2,
  },
  syncLinkedName: {
    fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 14,
  },
  syncEditBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: '#A7D7C5',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: '#E6F4EE',
  },
  syncEditText: {
    fontSize: 12, fontWeight: '600', color: '#2E7D62',
  },

  // ── Month tracker cards ──
  trackCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardLabel: { fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },
  monthLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  subLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '500', marginBottom: 14 },

});
