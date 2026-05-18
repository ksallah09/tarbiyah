import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  AppState,
  RefreshControl,
  Dimensions,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { getMonthReadDays, getStreak, getPartnerMonthCounts } from '../utils/readInsights';

import { loadFamilyGoals, loadFamilyGoalsCached, deleteFamilyGoal, getGoalEmoji } from '../utils/familyGoals';
import { getAllChildProfiles, syncChildProfilesFromSupabase } from '../utils/childProfiles';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCachedSyncStatus, getFamilySyncStatus } from '../utils/familySync';
import { loadCompletions, countThisWeek, isCompletedToday, logCompletion } from '../utils/goalCompletions';
import { updateFamilyGoalReminder } from '../utils/notifications';
import { getWeekCompletions, getMonthlyHabitActivityTotals, getPartnerMonthCompletions } from '../utils/childCompletions';
import { rs, hp } from '../utils/responsive';
import { GOALS_MESSAGES, pickRandom } from '../utils/encouragement';
import EncouragementModal from '../components/EncouragementModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Module-level caches so state initialises instantly on re-mount
let _childrenCache = [];
let _spirCache       = [];
let _sciCache        = [];
let _quranCache      = [];
let _spirStreakCache  = 0;
let _sciStreakCache   = 0;
let _quranStreakCache = 0;
let _familyGoalsCache  = [];
let _completionsCache  = [];
let _syncStatusCache   = { linked: false, partner: null };

function getMotivationText(done, total) {
  if (done === 0 || total === 0) return null;
  if (done >= total) return 'Alhamdulillah! All done';
  if (done >= total - 1) return 'Allahu Akbar! Almost there';
  return 'Ma Shaa Allah! Keep it up';
}

export default function ProgressScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [children,    setChildren]         = useState(_childrenCache);
  const [spirMonth,   setSpiritualMonth]   = useState(_spirCache);
  const [sciMonth,    setScientificMonth]  = useState(_sciCache);
  const [quranMonth,  setQuranMonth]       = useState(_quranCache);
  const [spirStreak,  setSpiritualStreak]  = useState(_spirStreakCache);
  const [sciStreak,   setScientificStreak] = useState(_sciStreakCache);
  const [quranStreak, setQuranStreak]      = useState(_quranStreakCache);
  const [familyGoals,  setFamilyGoals]  = useState(_familyGoalsCache);
  const [completions,  setCompletions]  = useState(_completionsCache);
  const [encouragement, setEncouragement] = useState(null);
  const [syncStatus,    setSyncStatus]    = useState(_syncStatusCache);
  const [partnerCounts, setPartnerCounts] = useState({ spiritual: 0, scientific: 0, quran: 0 });
  const [myHabAct,      setMyHabAct]      = useState({ habits: 0, activities: 0 });
  const [prtHabAct,     setPrtHabAct]     = useState({ habits: 0, activities: 0 });
  const [partnerSyncOn, setPartnerSyncOn] = useState(true);
  const [refreshing,  setRefreshing]       = useState(false);
  const hasMountedRef = useRef(false);

  const refreshAll = useCallback(() => {
    getAllChildProfiles().then(v => { _childrenCache = v; setChildren(v); });
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

    // My monthly habit/activity totals
    getWeekCompletions().then(counts => setMyHabAct(getMonthlyHabitActivityTotals(counts)));

    // Phase 2: sync status (AsyncStorage instant → Supabase background)
    getCachedSyncStatus().then(cached => {
      _syncStatusCache = cached; setSyncStatus(cached);
      if (cached.linked && cached.partner?.userId) {
        getPartnerMonthCounts(cached.partner.userId).then(setPartnerCounts);
        getPartnerMonthCompletions(cached.partner.userId).then(setPrtHabAct);
      }
      getFamilySyncStatus().then(live => {
        _syncStatusCache = live; setSyncStatus(live);
        loadFamilyGoals().then(v => { _familyGoalsCache = v; setFamilyGoals(v); });
        if (live.linked && live.partner?.userId) {
          getPartnerMonthCounts(live.partner.userId).then(setPartnerCounts);
          getPartnerMonthCompletions(live.partner.userId).then(setPrtHabAct);
        }
      });
    });
  }, []);

  // Initial load on mount
  useEffect(() => {
    refreshAll();
    syncChildProfilesFromSupabase().then(() => getAllChildProfiles().then(v => { _childrenCache = v; setChildren(v); }));
    AsyncStorage.getItem('tarbiyah_partner_sync_on').then(val => {
      if (val === 'false') setPartnerSyncOn(false);
    });
  }, []);

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

  // Schedule or cancel the Saturday family goal reminder based on current completion state
  useEffect(() => {
    if (familyGoals.length === 0) return;
    const hasIncomplete = familyGoals.some(g => countThisWeek(completions, g.id) < (g.frequency ?? 1));
    updateFamilyGoalReminder(hasIncomplete);
  }, [familyGoals, completions]);

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
    setEncouragement(pickRandom(GOALS_MESSAGES));
  }

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <StatusBar style="light" />
      <View style={styles.bgTop} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#4ADE80"
            colors={['#4ADE80']}
          />
        }
      >
        {/* ── Green header with hadith ── */}
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <Text style={styles.hadithArabic}>خَيْرُكُمْ خَيْرُكُمْ لِأَهْلِهِ</Text>
          <View style={styles.hadithDivider} />
          <Text style={styles.hadithEnglish}>"The best of you are the best to their families."</Text>
          <Text style={styles.hadithSource}>— Prophet Muhammad ﷺ</Text>
        </View>

        {/* ── Light sheet ── */}
        <View style={styles.sheet}>
        <View style={styles.content}>

        {/* ── Your Children ── */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>YOUR CHILDREN</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={childStyles.row}
          style={{ marginHorizontal: -hp, marginBottom: 28 }}
          nestedScrollEnabled
        >
          <View style={{ width: hp }} />
          {children.map(child => (
            <TouchableOpacity
              key={child.id}
              style={childStyles.card}
              onPress={() => navigation.navigate('ChildDashboard', { child })}
              activeOpacity={0.82}
            >
              <View style={[childStyles.avatar, { backgroundColor: child.color }]}>
                {child.photo
                  ? <Image source={{ uri: child.photo }} style={childStyles.avatarPhoto} />
                  : <Text style={childStyles.avatarInitial}>{child.name[0]}</Text>
                }
              </View>
              <Text style={childStyles.childName}>{child.name}</Text>
              <View style={childStyles.agePill}>
                <Text style={childStyles.ageText}>Age {child.age}</Text>
              </View>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[childStyles.card, childStyles.addCard]}
            activeOpacity={0.82}
            onPress={() => navigation.navigate('AddChildWizard')}
          >
            <View style={childStyles.addIcon}>
              <Ionicons name="add" size={22} color="#2E7D62" />
            </View>
            <Text style={childStyles.addLabel}>Add Child</Text>
          </TouchableOpacity>
          <View style={{ width: hp }} />
        </ScrollView>

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
                <View style={[styles.familyGoalIconWrap, { backgroundColor: (goal.iconColor ?? '#2E7D62') + '20', marginTop: 2 }]}>
                  <Text style={{ fontSize: 20 }}>{getGoalEmoji(goal)}</Text>
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

        {/* ── Partner Sync ── */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>PARTNER SYNC</Text>
          <Switch
            value={partnerSyncOn}
            onValueChange={val => {
              setPartnerSyncOn(val);
              AsyncStorage.setItem('tarbiyah_partner_sync_on', String(val));
            }}
            trackColor={{ false: '#D1D5DB', true: '#2E7D62' }}
            thumbColor="#FFFFFF"
            style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
          />
        </View>

        {partnerSyncOn && (syncStatus.linked ? (
          <View style={styles.syncLinkedCard}>
            <View style={styles.syncLinkedHeaderRow}>
              <Ionicons name="people" size={13} color="#4ADE80" />
              <Text style={styles.syncLinkedHeaderText}>PARTNER SYNC</Text>
              <View style={{ flex: 1 }} />
              <TouchableOpacity style={styles.syncEditBtn} onPress={() => navigation.navigate('FamilySync')} activeOpacity={0.8}>
                <Ionicons name="pencil-outline" size={12} color="#C9A84C" />
                <Text style={styles.syncEditText}>Edit</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.syncLinkedAvatarRow}>
              <View style={styles.syncAvatar}>
                <Ionicons name="person" size={18} color="#4ADE80" />
              </View>
              <View style={styles.syncLinkedLine} />
              <View style={styles.syncHeartWrap}>
                <Ionicons name="heart" size={12} color="#C9A84C" />
              </View>
              <View style={styles.syncLinkedLine} />
              <View style={styles.syncAvatar}>
                <Ionicons name="person" size={18} color="#4ADE80" />
              </View>
            </View>
            <Text style={styles.syncLinkedLabel}>Connected with</Text>
            <Text style={styles.syncLinkedName}>{syncStatus.partner?.name || 'Your partner'}</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.spouseSyncBanner}
            onPress={() => navigation.navigate('FamilySync')}
            activeOpacity={0.85}
          >
            <View style={styles.spouseSyncIconWrap}>
              <Ionicons name="people" size={20} color="#4ADE80" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.spouseSyncText}>Connect with your partner</Text>
              <Text style={styles.spouseSyncSub}>Share family goals and grow together</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.35)" />
          </TouchableOpacity>
        ))}

        {false && !syncStatus.linked && (
          <View style={styles.leaderboardPreview}>
            <View style={styles.leaderboardPreviewHeader}>
              <Ionicons name="trophy" size={13} color="#C9A84C" />
              <Text style={styles.leaderboardHeaderText}>MONTHLY LEADERBOARD</Text>
              <View style={styles.leaderboardLockPill}>
                <Ionicons name="lock-closed" size={9} color="#C9A84C" />
                <Text style={styles.leaderboardLockText}>Sync to unlock</Text>
              </View>
            </View>
            <View style={styles.leaderboardColRow}>
              <Text style={styles.leaderboardColLabel}>YOU</Text>
              <View style={{ flex: 1 }} />
              <Text style={[styles.leaderboardColLabel, { color: 'rgba(255,255,255,0.25)' }]}>PARTNER</Text>
            </View>
            {[
              { label: 'Spiritual', icon: 'moon',           color: '#4ADE80' },
              { label: 'Research',  icon: 'bulb-outline',   color: '#F59E0B' },
              { label: 'Quran',     icon: 'book-outline',   color: '#93C5FD' },
              { label: 'Habits',    icon: 'repeat-outline', color: '#86EFAC' },
              { label: 'Activities',icon: 'color-palette-outline', color: '#FCD34D' },
            ].map(({ label, icon, color }) => (
              <View key={label} style={styles.leaderboardRow}>
                <Text style={styles.leaderboardScore}>{(() => {
                  if (label === 'Habits') return myHabAct.habits;
                  if (label === 'Activities') return myHabAct.activities;
                  const idx = ['Spiritual','Research','Quran'].indexOf(label);
                  return idx >= 0 ? [spirMonth, sciMonth, quranMonth][idx].filter(d => d.completed).length : '—';
                })()}</Text>
                <View style={styles.leaderboardMid}>
                  <View style={styles.leaderboardBarWrap}>
                    <View style={[styles.leaderboardBarFill, styles.leaderboardBarLeft, { width: '60%', backgroundColor: color + '55' }]} />
                  </View>
                  <View style={[styles.leaderboardCatPill, { backgroundColor: color + '22' }]}>
                    <Ionicons name={icon} size={10} color={color} />
                    <Text style={[styles.leaderboardCatText, { color }]}>{label}</Text>
                  </View>
                  <View style={[styles.leaderboardBarWrap, { opacity: 0.25 }]}>
                    <View style={[styles.leaderboardBarFill, styles.leaderboardBarRight, { width: '40%', backgroundColor: '#FFFFFF' }]} />
                  </View>
                </View>
                <Text style={[styles.leaderboardScore, { color: 'rgba(255,255,255,0.15)' }]}>?</Text>
              </View>
            ))}
            <View style={styles.leaderboardDivider} />
            <TouchableOpacity
              style={styles.leaderboardUnlockBtn}
              onPress={() => navigation.navigate('FamilySync')}
              activeOpacity={0.85}
            >
              <Ionicons name="people-outline" size={14} color="#1B3D2F" />
              <Text style={styles.leaderboardUnlockText}>Sync with your partner to see the leaderboard</Text>
            </TouchableOpacity>
          </View>
        )}

        {false && syncStatus.linked && (() => {
          const partnerFirstName = syncStatus.partner?.name?.split(' ')[0] ?? 'Partner';
          const mySpir   = spirMonth.filter(d => d.completed).length;
          const mySci    = sciMonth.filter(d => d.completed).length;
          const myQuran  = quranMonth.filter(d => d.completed).length;
          const myTotal  = mySpir + mySci + myQuran + myHabAct.habits + myHabAct.activities;
          const prtTotal = partnerCounts.spiritual + partnerCounts.scientific + partnerCounts.quran + prtHabAct.habits + prtHabAct.activities;
          const ROWS = [
            { label: 'Spiritual',  icon: 'moon',                  color: '#4ADE80', my: mySpir,              partner: partnerCounts.spiritual },
            { label: 'Research',   icon: 'bulb-outline',          color: '#F59E0B', my: mySci,               partner: partnerCounts.scientific },
            { label: 'Quran',      icon: 'book-outline',          color: '#93C5FD', my: myQuran,             partner: partnerCounts.quran },
            { label: 'Habits',     icon: 'repeat-outline',        color: '#86EFAC', my: myHabAct.habits,     partner: prtHabAct.habits },
            { label: 'Activities', icon: 'color-palette-outline', color: '#FCD34D', my: myHabAct.activities, partner: prtHabAct.activities },
          ];
          const winnerData = myTotal > prtTotal
            ? { text: "You're leading — Ma Shaa Allah!", icon: 'trophy',         iconColor: '#C9A84C' }
            : prtTotal > myTotal
              ? { text: `${partnerFirstName} is leading — keep going!`, icon: 'barbell-outline', iconColor: '#86EFAC' }
              : { text: "You're tied — great effort, both of you!", icon: 'people-outline',  iconColor: '#93C5FD' };
          return (
            <View style={styles.leaderboardCard}>
              <View style={styles.leaderboardHeaderRow}>
                <Ionicons name="trophy" size={13} color="#C9A84C" />
                <Text style={styles.leaderboardHeaderText}>MONTHLY LEADERBOARD</Text>
              </View>
              <View style={styles.leaderboardColRow}>
                <Text style={styles.leaderboardColLabel}>YOU</Text>
                <View style={{ flex: 1 }} />
                <Text style={styles.leaderboardColLabel}>{partnerFirstName.toUpperCase()}</Text>
              </View>
              {ROWS.map(({ label, icon, color, my, partner }) => {
                const max = Math.max(my, partner, 1);
                return (
                  <View key={label} style={styles.leaderboardRow}>
                    <Text style={[styles.leaderboardScore, my > partner && styles.leaderboardScoreWin]}>{my}</Text>
                    <View style={styles.leaderboardMid}>
                      <View style={styles.leaderboardBarWrap}>
                        <View style={[styles.leaderboardBarFill, styles.leaderboardBarLeft, { width: `${(my / max) * 100}%`, backgroundColor: color + 'CC' }]} />
                      </View>
                      <View style={[styles.leaderboardCatPill, { backgroundColor: color + '22' }]}>
                        <Ionicons name={icon} size={10} color={color} />
                        <Text style={[styles.leaderboardCatText, { color }]}>{label}</Text>
                      </View>
                      <View style={styles.leaderboardBarWrap}>
                        <View style={[styles.leaderboardBarFill, styles.leaderboardBarRight, { width: `${(partner / max) * 100}%`, backgroundColor: color + 'CC' }]} />
                      </View>
                    </View>
                    <Text style={[styles.leaderboardScore, partner > my && styles.leaderboardScoreWin]}>{partner}</Text>
                  </View>
                );
              })}
              <View style={styles.leaderboardDivider} />
              <View style={styles.leaderboardTotalRow}>
                <Text style={[styles.leaderboardTotalNum, myTotal >= prtTotal && myTotal > 0 && styles.leaderboardScoreWin]}>{myTotal}</Text>
                <Text style={styles.leaderboardTotalLabel}>TOTAL</Text>
                <Text style={[styles.leaderboardTotalNum, prtTotal > myTotal && styles.leaderboardScoreWin]}>{prtTotal}</Text>
              </View>
              <View style={styles.leaderboardWinnerRow}>
                <Ionicons name={winnerData.icon} size={13} color={winnerData.iconColor} />
                <Text style={styles.leaderboardWinner}>{winnerData.text}</Text>
              </View>
            </View>
          );
        })()}

        <View style={{ height: 32 }} />
        </View>
        </View>
      </ScrollView>
      <EncouragementModal
        visible={!!encouragement}
        emoji={encouragement?.emoji}
        title={encouragement?.title}
        body={encouragement?.body}
        onClose={() => setEncouragement(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: '#1B3D2F' },
  bgTop:         { position: 'absolute', top: 0, left: 0, right: 0, height: '50%', backgroundColor: '#1B3D2F' },
  scroll:        { flex: 1 },
  scrollContent: { flexGrow: 1 },
  header: {
    backgroundColor: '#1B3D2F',
    paddingHorizontal: 24,
    paddingBottom: 18,
    alignItems: 'center',
  },
  sheet: {
    flexGrow: 1,
    backgroundColor: '#F5F6F8',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  content: { paddingHorizontal: hp, paddingTop: 24, paddingBottom: 40 },

  // ── Hadith ──
  hadithArabic: {
    fontSize: 22,
    color: '#D4A843',
    textAlign: 'center',
    lineHeight: 36,
    fontWeight: '600',
    marginBottom: 14,
  },
  hadithDivider: {
    width: 40,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 14,
  },
  hadithEnglish: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.88)',
    textAlign: 'center',
    lineHeight: 22,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  hadithSource: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    fontWeight: '500',
  },

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
    flex: 1,
    flexShrink: 1,
    marginRight: 8,
    letterSpacing: 0.3,
    marginBottom: 14,
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

  // ── Partner Sync leaderboard ──
  leaderboardPreview: {
    backgroundColor: '#1B3D2F', borderRadius: 18, padding: 18, marginBottom: 4,
    marginTop: 10, opacity: 0.88,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 14, elevation: 5,
  },
  leaderboardPreviewHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16,
  },
  leaderboardLockPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(201,168,76,0.15)', borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 3, marginLeft: 'auto',
  },
  leaderboardLockText: { fontSize: 10, fontWeight: '700', color: '#C9A84C' },
  leaderboardUnlockBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, backgroundColor: '#C9A84C', borderRadius: 12,
    paddingVertical: 11, marginTop: 4,
  },
  leaderboardUnlockText: {
    fontSize: 12, fontWeight: '700', color: '#1B3D2F',
  },
  leaderboardCard: {
    backgroundColor: '#1B3D2F', borderRadius: 18, padding: 18, marginBottom: 4,
    marginTop: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 14, elevation: 5,
  },
  leaderboardHeaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16,
  },
  leaderboardHeaderText: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.2, color: '#C9A84C',
  },
  leaderboardColRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 12,
  },
  leaderboardColLabel: {
    fontSize: 14, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5,
  },
  leaderboardRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10,
  },
  leaderboardScore: {
    width: 28, fontSize: 18, fontWeight: '800', color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
  },
  leaderboardScoreWin: { color: '#FFFFFF' },
  leaderboardMid: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  leaderboardBarWrap: { flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' },
  leaderboardBarFill: { height: '100%', borderRadius: 2 },
  leaderboardBarLeft:  { alignSelf: 'flex-end' },
  leaderboardBarRight: { alignSelf: 'flex-start' },
  leaderboardCatPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3,
  },
  leaderboardCatText: { fontSize: 10, fontWeight: '700' },
  leaderboardDivider: {
    height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 12,
  },
  leaderboardTotalRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 10,
  },
  leaderboardTotalNum: {
    width: 28, fontSize: 20, fontWeight: '800', color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
  },
  leaderboardTotalLabel: {
    flex: 1, fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.4)',
    textAlign: 'center', letterSpacing: 1,
  },
  leaderboardWinnerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  leaderboardWinner: {
    fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.65)',
  },

  // ── Spouse sync banner ──
  spouseSyncBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#1B3D2F', borderRadius: 20, padding: 18, marginBottom: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 4,
  },
  spouseSyncIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(74,222,128,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  spouseSyncText: {
    fontSize: 15, color: '#FFFFFF', fontWeight: '700', marginBottom: 2,
  },
  spouseSyncSub: {
    fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '400',
  },

  // ── Sync linked card ──
  syncLinkedCard: {
    backgroundColor: '#1B3D2F', borderRadius: 20, padding: 16, marginBottom: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 4,
  },
  syncLinkedHeaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16,
  },
  syncLinkedHeaderText: {
    fontSize: 11, fontWeight: '700', color: '#FFFFFF', letterSpacing: 1,
  },
  syncLinkedAvatarRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14,
  },
  syncAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(74,222,128,0.12)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(74,222,128,0.25)',
  },
  syncHeartWrap: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(201,168,76,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  syncLinkedLine: {
    flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)',
  },
  syncLinkedLabel: {
    fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: '500', marginBottom: 3,
  },
  syncLinkedName: {
    fontSize: 16, fontWeight: '800', color: '#FFFFFF',
  },
  syncEditBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(201,168,76,0.15)', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  syncEditText: {
    fontSize: 12, fontWeight: '600', color: '#C9A84C',
  },

});

const CHILD_CARD_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.07,
  shadowRadius: 8,
  elevation: 3,
};

const childStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, paddingBottom: 4 },
  card: {
    width: 110,
    backgroundColor: '#FFF',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    ...CHILD_CARD_SHADOW,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  avatarInitial: { fontSize: 20, fontWeight: '800', color: '#FFF' },
  avatarPhoto:   { width: 52, height: 52, borderRadius: 26 },
  childName:     { fontSize: 13, fontWeight: '700', color: '#1A1A2E', marginBottom: 6 },
  agePill: {
    backgroundColor: '#E8F5EF',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 20,
  },
  ageText: { fontSize: 11, fontWeight: '600', color: '#2E7D62' },

  addCard: {
    borderWidth: 1.5,
    borderColor: '#C3DDD6',
    borderStyle: 'dashed',
    backgroundColor: '#FAFAFA',
  },
  addIcon: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#E8F5EF',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  addLabel: { fontSize: 13, fontWeight: '600', color: '#2E7D62' },
});
