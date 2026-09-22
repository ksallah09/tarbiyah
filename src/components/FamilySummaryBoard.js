import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, Dimensions, Alert, Image,
  Modal, TextInput, KeyboardAvoidingView, Platform, Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';
import { getFamilyId, loadFamilyGoals, loadFamilyGoalsCached, getGoalEmoji } from '../utils/familyGoals';
import { getCachedSyncStatus } from '../utils/familySync';
import { getAllChildProfiles, updateChildProfile } from '../utils/childProfiles';
import { loadCompletions, isCompletedToday, countThisWeek, logCompletion } from '../utils/goalCompletions';
import { getLocalCounts, getChildWeeklyCounts } from '../utils/childCompletions';
import { MiniGardenCard, MANNERS } from './MannerGarden';
import { GOALS_MESSAGES, pickRandom } from '../utils/encouragement';
import { notifyPartner } from '../utils/partnerNotify';
import EncouragementModal from './EncouragementModal';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PADDING = 20;

export default function FamilySummaryBoard({ navigation, section = 'childWins', onScroll, onOpenChildDashboard }) {
  const [familyGoals,     setFamilyGoals]     = useState([]);
  const [goalCompletions, setGoalCompletions] = useState([]);
  const [familyTrees,     setFamilyTrees]     = useState([]);
  const [gardenTotals,    setGardenTotals]    = useState({});
  const [familyMoments,   setFamilyMoments]   = useState([]);
  const [children,        setChildren]        = useState([]);
  const [partnerLinked,   setPartnerLinked]   = useState(false);
  const [partnerSyncOn,   setPartnerSyncOn]   = useState(true);
  const [partnerName,     setPartnerName]     = useState('Partner');
  const [myProfileName,   setMyProfileName]   = useState('');

  const [refreshing,      setRefreshing]      = useState(false);
  const [encouragement,   setEncouragement]   = useState(null);
  const [sharedPage,      setSharedPage]      = useState(0);
  const [expandedShared,  setExpandedShared]  = useState(new Set());
  const [overflowShared,  setOverflowShared]  = useState(new Set());
  const [acknowledgedInc, setAcknowledgedInc] = useState(new Set());
  const [expandedInc,     setExpandedInc]     = useState(new Set());
  const [overflowInc,     setOverflowInc]     = useState(new Set());
  const [showAllInc,      setShowAllInc]      = useState(false);
  const [logModalStep,    setLogModalStep]    = useState(null); // null | 'child' | 'form'
  const [logChild,        setLogChild]        = useState(null);
  const [logText,         setLogText]         = useState('');
  const [logConsequence,  setLogConsequence]  = useState('');
  const [logSaving,       setLogSaving]       = useState(false);
  const [myUserId,        setMyUserId]        = useState(null);
  const [weekCompletions, setWeekCompletions] = useState({});
  const [showAllGoals,    setShowAllGoals]    = useState(false);
  const [accomplishments, setAccomplishments] = useState([]);
  const [lovedActions,    setLovedActions]    = useState(new Set());
  const [showAllAccomp,   setShowAllAccomp]   = useState(false);
  const [deedPickerOpen,  setDeedPickerOpen]  = useState(false);
  const [muhasabahStats,  setMuhasabahStats]  = useState([]);
  const [gardenPage,      setGardenPage]      = useState(0);

  const loadMuhasabah = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const today     = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

      // Get all family member IDs so points are pooled across both parents
      const familyId = await getFamilyId();
      const { data: familyMembers } = await supabase
        .from('family_members').select('user_id').eq('family_id', familyId);
      const familyUserIds = (familyMembers ?? []).map(m => m.user_id).filter(Boolean);
      const userIds = familyUserIds.length > 0 ? familyUserIds : [session.user.id];

      const [{ data }, { data: cfgData }] = await Promise.all([
        supabase
          .from('muhasabah_sessions')
          .select('points_earned, streak_day, session_date, child_id, child_name')
          .in('user_id', userIds)
          .order('session_date', { ascending: false }),
        supabase
          .from('muhasabah_config')
          .select('child_id, reward_goal, reward_points_target, user_id')
          .in('user_id', userIds),
      ]);
      if (!data) return;

      // Build linked_child_id → canonical child_id map so sessions from partners
      // who used a different name/spelling are folded into the same child bucket.
      // family_children rows: { child_id: canonicalId, linked_child_id: partnerId }
      const sessionChildIds = [...new Set(data.map(r => r.child_id).filter(Boolean))];
      let linkedToCanonical = {};
      if (sessionChildIds.length > 0) {
        const { data: fcData } = await supabase
          .from('family_children')
          .select('child_id, linked_child_id')
          .in('linked_child_id', sessionChildIds);
        for (const row of (fcData ?? [])) {
          if (row.linked_child_id) linkedToCanonical[row.linked_child_id] = row.child_id;
        }
      }

      // Build config map — resolve linked child_ids to canonical, prefer current user's config
      const cfgByChild = {};
      for (const cfg of (cfgData ?? [])) {
        const canonicalId = linkedToCanonical[cfg.child_id] ?? cfg.child_id;
        if (!cfgByChild[canonicalId] || cfg.user_id === session.user.id) {
          cfgByChild[canonicalId] = cfg;
        }
      }

      const byChild = {};
      for (const row of data) {
        const canonicalId = linkedToCanonical[row.child_id] ?? row.child_id;
        const isLinked = !!linkedToCanonical[row.child_id];
        const key = canonicalId || row.child_name;
        if (!byChild[key]) {
          byChild[key] = { id: canonicalId, name: row.child_name, rows: [] };
        } else if (!isLinked) {
          // Canonical child's own sessions → use their name (overrides partner's nickname)
          byChild[key].name = row.child_name;
        }
        byChild[key].rows.push(row);
      }
      const stats = Object.values(byChild).map(c => {
        const total   = c.rows.reduce((s, r) => s + (r.points_earned ?? 0), 0);
        const latest  = c.rows[0];
        const streak  = latest && (latest.session_date === today || latest.session_date === yesterday)
          ? latest.streak_day : 0;
        const cfg     = cfgByChild[c.id];
        const rewardUnlocked = cfg?.reward_goal && cfg?.reward_points_target
          && total >= cfg.reward_points_target;
        return { id: c.id, name: c.name, total, streak, sessions: c.rows.length, rewardUnlocked };
      });
      setMuhasabahStats(stats);
    } catch {}
  }, []);

  const load = useCallback(async () => {
    try {
      const [syncStatus, familyId, allChildren, profileRaw, ackedRaw, syncVal] = await Promise.all([
        getCachedSyncStatus(),
        getFamilyId(),
        getAllChildProfiles(),
        AsyncStorage.getItem('tarbiyah_profile'),
        AsyncStorage.getItem('tarbiyah_acknowledged_inc'),
        AsyncStorage.getItem('tarbiyah_partner_sync_on'),
      ]);

      setPartnerSyncOn(syncVal !== 'false');
      setPartnerLinked(!!syncStatus?.linked);
      if (syncStatus?.partner?.name) setPartnerName(syncStatus.partner.name.split(' ')[0]);
      if (profileRaw) setMyProfileName(JSON.parse(profileRaw).name?.split(' ')[0] ?? '');
      if (ackedRaw) setAcknowledgedInc(new Set(JSON.parse(ackedRaw)));
      setChildren(allChildren);
      supabase.auth.getSession().then(({ data }) => setMyUserId(data?.session?.user?.id ?? null));

      const [goalsRes, completionsRes, treesRes, momentsRes, lovedRaw] = await Promise.all([
        loadFamilyGoalsCached(),
        loadCompletions(),
        supabase.from('family_trees').select('*').eq('family_id', familyId),
        supabase.from('family_moments').select('*').eq('family_id', familyId).order('date', { ascending: false }).limit(30),
        AsyncStorage.getItem('tarbiyah_loved_actions'),
      ]);
      if (lovedRaw) setLovedActions(new Set(JSON.parse(lovedRaw)));

      setFamilyGoals(goalsRes);
      setGoalCompletions(completionsRes);

      const trees = treesRes.data ?? [];

      // Query actions by child_id across all families (same approach as MannerGarden)
      // so that partner actions stored under their family_id are included in totals.
      const allChildIds = trees.map(t => t.child_id).filter(Boolean);
      const actionsRes = allChildIds.length > 0
        ? await supabase.from('child_garden_actions').select('id, child_id, child_name, manner, note, date, loved_by').in('child_id', allChildIds).order('date', { ascending: false })
        : { data: [] };
      const linkedMap = {};
      trees.forEach(t => { if (t.linked_tree_id) linkedMap[t.linked_tree_id] = t.child_id; });
      const canonicalTrees = trees
        .filter(t => !t.linked_tree_id)
        .map(t => ({ ...t, linked_tree_id: linkedMap[t.child_id] ?? null }));
      setFamilyTrees(canonicalTrees);
      const rawTotals = {};
      (actionsRes.data ?? []).forEach(r => { rawTotals[r.child_id] = (rawTotals[r.child_id] ?? 0) + 1; });
      const combined = { ...rawTotals };
      trees.forEach(t => {
        if (t.linked_tree_id) combined[t.linked_tree_id] = (combined[t.linked_tree_id] ?? 0) + (rawTotals[t.child_id] ?? 0);
      });
      setGardenTotals(combined);
      setAccomplishments(actionsRes.data ?? []);
      setFamilyMoments(momentsRes.data ?? []);

      getLocalCounts().then(setWeekCompletions);

      // Background refresh with live goals
      loadFamilyGoals().then(setFamilyGoals);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    loadMuhasabah();

    // Real-time: refresh accomplishments when any child_garden_actions row changes
    // (catches partner loves immediately without needing manual pull-to-refresh)
    const channelName = `accomp_feed_${Date.now()}`;
    const sub = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'child_garden_actions' }, () => { load(); })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [load]));

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([load(), loadMuhasabah()]);
    setRefreshing(false);
  }

  function openLogModal() {
    setLogChild(null);
    setLogText('');
    setLogConsequence('');
    setLogModalStep('child');
  }

  function closeLogModal() {
    setLogModalStep(null);
    setLogChild(null);
    setLogText('');
    setLogConsequence('');
  }

  async function saveLoggedMoment() {
    const text = logText.trim();
    if (!text || !logChild) return;
    setLogSaving(true);
    try {
      const consequence = logConsequence.trim() || null;
      const entry = { id: `i_${Date.now()}`, text, date: new Date().toISOString(), ...(consequence ? { consequence } : {}) };
      const child = children.find(c => c.id === logChild.id);
      const existingIncidents = child?.incidents ?? [];
      await updateChildProfile(logChild.id, { incidents: [...existingIncidents, entry] });
      const [familyId, { data: { session } }] = await Promise.all([getFamilyId(), supabase.auth.getSession()]);
      await supabase.from('family_moments').insert({
        id: entry.id, family_id: familyId,
        child_id: logChild.id, child_name: logChild.name, child_color: logChild.color,
        type: 'incident', text: entry.text, date: entry.date,
        consequence: consequence ?? null,
        user_id: session?.user?.id ?? null,
      });
      if (partnerLinked) {
        notifyPartner(
          `${myProfileName || 'Your partner'} logged a difficult moment for ${logChild.name}`,
          entry.text.length > 100 ? entry.text.slice(0, 97) + '…' : entry.text,
          { screen: 'Family' }
        );
      }
      await load();
      closeLogModal();
    } catch {
      Alert.alert('Error', 'Could not save. Please try again.');
    } finally {
      setLogSaving(false);
    }
  }

  async function deleteIncidentEntry(entry) {
    Alert.alert('Delete moment', 'Remove this from the family log?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await supabase.from('family_moments').delete().eq('id', entry.id);
          const child = children.find(c => c.id === entry.child_id);
          if (child?.incidents) {
            const updated = child.incidents.filter(i => i.id !== entry.id);
            await updateChildProfile(entry.child_id, { incidents: updated });
          }
          await load();
        } catch { Alert.alert('Error', 'Could not delete. Please try again.'); }
      }},
    ]);
  }

  async function handleAcknowledgeIncident(childId, incidentId) {
    const name = myProfileName || 'Partner';
    const alreadyAcked = acknowledgedInc.has(incidentId);
    const next = new Set(acknowledgedInc);
    alreadyAcked ? next.delete(incidentId) : next.add(incidentId);
    setAcknowledgedInc(next);
    await AsyncStorage.setItem('tarbiyah_acknowledged_inc', JSON.stringify([...next]));
    const moment = familyMoments.find(m => m.id === incidentId);
    const currentAcks = Array.isArray(moment?.acknowledges) ? moment.acknowledges : [];
    const newAcks = alreadyAcked ? currentAcks.filter(n => n !== name) : [...currentAcks, name];
    setFamilyMoments(prev => prev.map(m => m.id === incidentId ? { ...m, acknowledges: newAcks } : m));
    try {
      await supabase.from('family_moments').update({ acknowledges: newAcks }).eq('id', incidentId);
      if (!alreadyAcked && partnerLinked) {
        const childName = moment?.child_name ?? 'your child';
        notifyPartner(
          `${name} acknowledged a difficult moment`,
          `${name} has seen and acknowledged the moment logged for ${childName}.`,
          { screen: 'Family' }
        );
      }
    } catch {}
  }

  async function handleLoveAccomplishment(actionId, childName, mannerLabel) {
    const name = myProfileName || 'Partner';
    const alreadyLoved = lovedActions.has(actionId);
    const next = new Set(lovedActions);
    alreadyLoved ? next.delete(actionId) : next.add(actionId);
    setLovedActions(next);
    await AsyncStorage.setItem('tarbiyah_loved_actions', JSON.stringify([...next]));
    const action = accomplishments.find(a => a.id === actionId);
    const currentLoves = Array.isArray(action?.loved_by) ? action.loved_by : [];
    const newLoves = alreadyLoved ? currentLoves.filter(n => n !== name) : [...currentLoves, name];
    setAccomplishments(prev => prev.map(a => a.id === actionId ? { ...a, loved_by: newLoves } : a));
    try {
      const { error } = await supabase.from('child_garden_actions').update({ loved_by: newLoves }).eq('id', actionId);
      if (error) { console.error('[handleLoveAccomplishment] Supabase error:', error.message); return; }
      if (!alreadyLoved && partnerLinked) {
        notifyPartner(
          `${name} loved an accomplishment ❤️`,
          `${name} loved "${mannerLabel}" logged for ${childName}.`,
          { screen: 'Family' }
        );
      }
    } catch (e) { console.error('[handleLoveAccomplishment]', e); }
  }

  const sharedByPartner = familyMoments.filter(m => m.type === 'shared_habit' || m.type === 'shared_activity');
  const incidents       = familyMoments.filter(m => m.type === 'incident');
  const CARD_W          = SCREEN_WIDTH - PADDING * 2;

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: '#FFFFFF' }}
        contentContainerStyle={{ padding: PADDING, paddingTop: 12, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#2E7D62" />}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >

        {/* ── Your Wins ── (Parenting tab) */}
        {section === 'parenting' && (
          <>
            <View style={s.sectionHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.eyebrow}>THIS WEEK</Text>
                <Text style={s.sectionTitle}>Your Wins</Text>
              </View>
            </View>
            <View style={s.winsCard}>
              <View style={s.winsCardHeader}>
                <View style={s.powerDotOuter}><View style={s.powerDotInner} /></View>
                <Text style={s.winsCardHeaderSub}>Habits & activities logged from each child's dashboard</Text>
              </View>
              {children.length === 0 ? (
                <View style={s.winsEmpty}>
                  <Ionicons name="people-outline" size={28} color="#D1D5DB" />
                  <Text style={s.emptyTitle}>No children added yet</Text>
                  <Text style={s.emptySub}>Tap <Text style={s.emptyHighlight}>Configure Family</Text> at the top of this screen to add your children and start tracking their progress.</Text>
                </View>
              ) : children.map((child, idx) => {
                const hasAreas = (child.growthAreas ?? []).length > 0;
                const { habits, activities } = getChildWeeklyCounts(weekCompletions, child.growthAreas);
                const isLast = idx === children.length - 1;
                return (
                  <TouchableOpacity
                    key={child.id}
                    style={[s.winsRow, !isLast && s.winsRowBorder]}
                    onPress={() => onOpenChildDashboard?.(child.id)}
                    activeOpacity={0.75}
                  >
                    <View style={[s.winsAvatar, { backgroundColor: child.color }]}>
                      {child.photo
                        ? <Image source={{ uri: child.photo }} style={s.winsAvatarPhoto} />
                        : <Text style={s.winsAvatarInitial}>{child.name[0]}</Text>
                      }
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.winsChildName}>{child.name}</Text>
                      <View style={s.winsAgePill}><Text style={s.winsAgeText}>Age {child.age}</Text></View>
                    </View>
                    {hasAreas ? (
                      <View style={s.winsStats}>
                        <View style={s.winsStatItem}>
                          <Text style={s.winsStatNum}>{habits}</Text>
                          <Text style={s.winsStatLabel}>Habits</Text>
                        </View>
                        <View style={s.winsStatDivider} />
                        <View style={s.winsStatItem}>
                          <Text style={s.winsStatNum}>{activities}</Text>
                          <Text style={s.winsStatLabel}>Activities</Text>
                        </View>
                      </View>
                    ) : (
                      <Text style={{ fontSize: 11, color: '#C3DDD6', fontWeight: '500' }}>No growth area yet</Text>
                    )}
                    <Ionicons name="chevron-forward" size={13} color="#C3DDD6" style={{ marginLeft: 6 }} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* ── Family Goals ── (Goals tab) */}
        {section === 'goals' && (
          <>
            <View style={[s.sectionHeader, { marginTop: 20 }]}>
              <View style={{ flex: 1 }}>
                <Text style={s.eyebrow}>THIS WEEK</Text>
                <Text style={s.sectionTitle}>Family Goals</Text>
              </View>
              <TouchableOpacity style={s.sectionActionBtn} onPress={() => navigation.navigate('FamilyGoalWizard')} activeOpacity={0.75}>
                <Ionicons name="add" size={14} color="#FFFFFF" />
                <Text style={s.sectionActionBtnText}>Add Goal</Text>
              </TouchableOpacity>
            </View>
            <View style={s.card}>
              {familyGoals.length === 0 ? (
                <View style={s.emptyInner}>
                  <Ionicons name="flag-outline" size={28} color="#D1D5DB" style={{ marginBottom: 10 }} />
                  <Text style={s.emptyTitle}>No family goals yet</Text>
                  <Text style={s.emptySub}>Tap <Text style={s.emptyHighlight}>Add Goal</Text> above to set your first shared family goal.</Text>
                </View>
              ) : (showAllGoals ? familyGoals : familyGoals.slice(0, 5)).map((goal, idx) => {
                const target    = goal.frequency ?? 1;
                const count     = countThisWeek(goalCompletions, goal.id);
                const doneToday = isCompletedToday(goalCompletions, goal.id);
                const goalMet   = count >= target;
                const pct       = Math.min(Math.round((count / target) * 100), 100);
                const fillColor = goalMet ? '#2E7D62' : (count > 0 ? '#4A90D9' : '#D1D5DB');
                return (
                  <View key={goal.id}>
                    {idx > 0 && <View style={s.divider} />}
                    <View style={s.goalRow}>
                      <View style={[s.goalIcon, { backgroundColor: (goal.iconColor ?? '#2E7D62') + '18' }]}>
                        <Text style={{ fontSize: 20 }}>{getGoalEmoji(goal)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={s.goalTitleRow}>
                          <Text style={s.goalTitle} numberOfLines={1}>{goal.title}</Text>
                          {goalMet ? (
                            <View style={s.metPill}>
                              <Ionicons name="checkmark-circle" size={12} color="#2E7D62" />
                              <Text style={s.metText}>Done</Text>
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={[s.logBtn, doneToday && s.logBtnDone]}
                              disabled={doneToday}
                              onPress={async () => {
                                const updated = await logCompletion(goal.id);
                                setGoalCompletions([...updated]);
                                setEncouragement(pickRandom(GOALS_MESSAGES));
                              }}
                              activeOpacity={0.75}
                            >
                              <Ionicons name={doneToday ? 'checkmark' : 'add'} size={12} color={doneToday ? '#2E7D62' : '#fff'} />
                              <Text style={[s.logBtnText, doneToday && { color: '#2E7D62' }]}>{doneToday ? 'Logged' : 'Log it'}</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                        <View style={s.barRow}>
                          <View style={s.barTrack}>
                            <View style={[s.barFill, { width: `${pct}%`, backgroundColor: fillColor }]} />
                          </View>
                          <Text style={[s.barLabel, goalMet && { color: '#2E7D62' }]}>{count}/{target}</Text>
                        </View>
                        <Text style={s.goalStatus}>
                          {goalMet ? '🎯 Goal met this week' : `${goal.frequencyLabel} · ${target - count} to go`}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
              {familyGoals.length > 5 && (
                <TouchableOpacity style={s.seeMoreBtn} onPress={() => setShowAllGoals(v => !v)} activeOpacity={0.75}>
                  <Text style={s.seeMoreText}>{showAllGoals ? 'Show less' : `See ${familyGoals.length - 5} more`}</Text>
                  <Ionicons name={showAllGoals ? 'chevron-up' : 'chevron-down'} size={13} color="#2E7D62" />
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        {/* ── Quick Actions ── (Child Growth tab) */}
        {section === 'childWins' && (
          <TouchableOpacity
            style={s.quickActionFeedBtn}
            activeOpacity={0.85}
            onPress={() => navigation.getParent()?.navigate('FamilyFeed')}
          >
            <View style={s.quickActionFeedHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.quickActionFeedEyebrow}>SHARED FAMILY VIEW</Text>
                <Text style={s.quickActionFeedTitle}>
                  <Ionicons name="people" size={17} color="#FFFFFF" /> Family Feed
                </Text>
                <Text style={s.quickActionFeedSub}>Wins, reflections, shukr moments & more — your family's shared story</Text>
              </View>
              <TouchableOpacity
                style={s.quickActionFeedViewBtn}
                onPress={() => navigation.getParent()?.navigate('FamilyFeed')}
                activeOpacity={0.8}
              >
                <Text style={s.quickActionFeedViewBtnText}>View →</Text>
              </TouchableOpacity>
            </View>
            <View style={s.quickActionFeedFooter}>
              <View style={s.quickActionFeedPill}>
                <View style={[s.quickActionFeedDot, { backgroundColor: '#4ADE80' }]} />
                <Text style={s.quickActionFeedPillText}>Wins</Text>
              </View>
              <View style={s.quickActionFeedPill}>
                <View style={[s.quickActionFeedDot, { backgroundColor: '#A78BFA' }]} />
                <Text style={s.quickActionFeedPillText}>Reflections</Text>
              </View>
              <View style={s.quickActionFeedPill}>
                <View style={[s.quickActionFeedDot, { backgroundColor: '#FCD34D' }]} />
                <Text style={s.quickActionFeedPillText}>Moments</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* ── Nightly Muhasabah ── (Child Growth tab) */}
        {section === 'childWins' && (
          <View style={s.muhasabahSection}>
            {/* Header row — entire row is tappable */}
            <TouchableOpacity
              style={s.muhasabahHeader}
              onPress={() => navigation.getParent()?.navigate('MuhasabahWizard')}
              activeOpacity={0.85}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.muhasabahEyebrow}>NIGHTLY REFLECTION</Text>
                <Text style={s.muhasabahTitle}>🌙 Nightly Muhasabah</Text>
                <Text style={s.muhasabahSub}>Self-accountability · Points · Progress</Text>
              </View>
              <View style={s.muhasabahBeginBtn}>
                <Text style={s.muhasabahBeginText}>Begin →</Text>
              </View>
            </TouchableOpacity>

            {/* Per-child stats */}
            {muhasabahStats.length > 0 ? (
              <View style={s.muhasabahChildren}>
                {muhasabahStats.map((c, i) => (
                  <View key={c.id ?? i}>
                    {i > 0 && <View style={s.muhasabahDivider} />}
                    <View style={s.muhasabahChildRow}>
                      <View style={s.muhasabahChildLeft}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <Text style={s.muhasabahChildName}>{c.name}</Text>
                          {c.rewardUnlocked && (
                            <View style={s.muhasabahUnlockBadge}>
                              <Text style={s.muhasabahUnlockBadgeText}>🎁 Reward ready!</Text>
                            </View>
                          )}
                        </View>
                        <View style={s.muhasabahChildStats}>
                          <Text style={s.muhasabahStat}>⭐ {c.total} pts</Text>
                          {c.streak > 0 && <Text style={s.muhasabahStatStreak}>🔥 {c.streak}-day streak</Text>}
                          <Text style={s.muhasabahStatSessions}>📅 {c.sessions} {c.sessions === 1 ? 'session' : 'sessions'}</Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={() => navigation.getParent()?.navigate('MuhasabahRewards', { child: { id: c.id, name: c.name } })}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={s.muhasabahRewardsLink}>Progress →</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={s.muhasabahEmpty}>
                <Text style={s.muhasabahEmptyText}>No sessions yet — start the first one tonight</Text>
              </View>
            )}
          </View>
        )}

        {section === 'childWins' && <View style={s.sectionDivider} />}

        {/* ── Accomplishment Trees + Feed ── (Child Wins tab) */}
        {section === 'childWins' && (
          <>
            <View style={{ marginTop: 0 }}>
              <View style={[s.sectionHeader, { alignItems: 'flex-start' }]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.eyebrow}>FAMILY GARDEN</Text>
                  <Text style={s.sectionTitle}>Accomplishment Trees</Text>
                  <Text style={s.sectionSub}>Track your children's accomplishments</Text>
                </View>
                <TouchableOpacity style={s.sectionActionBtn} onPress={() => navigation.navigate('GardenTreeWizard')} activeOpacity={0.75}>
                  <Ionicons name="add" size={14} color="#FFFFFF" />
                  <Text style={s.sectionActionBtnText}>Add Tree</Text>
                </TouchableOpacity>
              </View>
              {familyTrees.length === 0 ? (
                <TouchableOpacity style={s.emptyGarden} onPress={() => navigation.navigate('GardenTreeWizard')} activeOpacity={0.8}>
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>🌱</Text>
                  <Text style={s.emptyTitle}>No trees yet</Text>
                  <Text style={s.emptySub}>Tap "Add Tree" to start your child's Accomplishment Tree</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 10 }}
                    onMomentumScrollEnd={e => setGardenPage(Math.round(e.nativeEvent.contentOffset.x / 210))}
                    scrollEventThrottle={16}
                  >
                    {familyTrees.map(tree => (
                      <MiniGardenCard
                        key={tree.child_id}
                        childName={tree.child_name}
                        total={gardenTotals[tree.child_id] ?? 0}
                        color={children.find(c => c.id === tree.child_id)?.color ?? tree.child_color}
                        photo={children.find(c => c.id === tree.child_id)?.photo ?? null}
                        thresholds={tree.thresholds}
                        onPress={() => navigation.navigate('GardenDetail', { tree })}
                      />
                    ))}
                  </ScrollView>
                  {familyTrees.length > 1 && (
                    <View style={s.gardenDots}>
                      {familyTrees.map((_, i) => (
                        <View key={i} style={[s.gardenDot, i === gardenPage && s.gardenDotActive]} />
                      ))}
                    </View>
                  )}
                </>
              )}
            </View>

          </>
        )}

        {/* ── Partner Recs ── (Parenting tab) */}
        {section === 'parenting' && (
          <>
            {partnerSyncOn && partnerLinked && sharedByPartner.length > 0 && (
              <View style={{ marginTop: 20 }}>
                <View style={s.momentHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.eyebrow}>SHARED BY YOUR PARTNER</Text>
                    <Text style={s.sectionTitle}>Recommended by Your Partner</Text>
                    <Text style={s.sectionSub}>Shared from a child's dashboard</Text>
                  </View>
                </View>
                <ScrollView
                  horizontal pagingEnabled showsHorizontalScrollIndicator={false} decelerationRate="fast"
                  onMomentumScrollEnd={e => setSharedPage(Math.round(e.nativeEvent.contentOffset.x / CARD_W))}
                >
                  {sharedByPartner.map(entry => {
                    const isExpanded = expandedShared.has(entry.id);
                    const isOverflow = overflowShared.has(entry.id);
                    const isHabit = entry.type === 'shared_habit';
                    return (
                      <View key={entry.id} style={[s.sharedCard, { width: CARD_W }]}>
                        <View style={s.momentTopRow}>
                          <View style={[s.momentIcon, { backgroundColor: isHabit ? '#EDF7F2' : '#FEF9EE' }]}>
                            <Text style={{ fontSize: 13 }}>{isHabit ? '🔄' : '🎯'}</Text>
                          </View>
                          <View style={[s.childBadge, { backgroundColor: (entry.child_color ?? '#2E7D62') + '22', marginLeft: 6 }]}>
                            <Text style={[s.childBadgeText, { color: entry.child_color ?? '#2E7D62' }]}>{entry.child_name}</Text>
                          </View>
                          <Text style={s.typeLabel}>{isHabit ? 'Habit' : 'Activity'}</Text>
                          <Text style={s.dateLabel}>{new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                        </View>
                        <Text style={{ position: 'absolute', opacity: 0 }} onTextLayout={e => { if (e.nativeEvent.lines.length > 3) setOverflowShared(prev => new Set([...prev, entry.id])); }}>{entry.text}</Text>
                        <Text style={[s.sharedText, { marginTop: 10 }]} numberOfLines={isExpanded ? undefined : 3}>{entry.text}</Text>
                        {isOverflow && (
                          <TouchableOpacity onPress={() => setExpandedShared(prev => { const n = new Set(prev); isExpanded ? n.delete(entry.id) : n.add(entry.id); return n; })} activeOpacity={0.7} style={{ marginTop: 6 }}>
                            <Text style={s.readMore}>{isExpanded ? 'Show less' : 'Read more'}</Text>
                          </TouchableOpacity>
                        )}
                        <Text style={[s.sharedBy, { marginTop: 8 }]}>Shared by {entry.shared_by_name ?? 'Partner'}</Text>
                      </View>
                    );
                  })}
                </ScrollView>
                <View style={s.carouselFooter}>
                  <View style={s.dotsRow}>
                    {sharedByPartner.map((_, i) => (
                      <View key={i} style={[s.dotBase, i === sharedPage && s.dotActive]} />
                    ))}
                  </View>
                  {sharedByPartner.length > 1 && <Text style={s.swipeHint}>swipe for more</Text>}
                </View>
              </View>
            )}

          </>
        )}

      </ScrollView>

      <EncouragementModal visible={!!encouragement} emoji={encouragement?.emoji} title={encouragement?.title} body={encouragement?.body} onClose={() => setEncouragement(null)} />

      {/* ── Log Good Deed — child picker ── */}
      <Modal visible={deedPickerOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDeedPickerOpen(false)}>
        <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
          <View style={s.logModalHeader}>
            <Text style={s.logModalTitle}>Which child?</Text>
            <TouchableOpacity onPress={() => setDeedPickerOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color="#374151" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
            {familyTrees.map(tree => {
              const child = children.find(c => c.id === tree.child_id);
              const color = child?.color ?? tree.child_color ?? '#2E7D62';
              const firstName = tree.child_name?.split(' ')[0] ?? '?';
              return (
                <TouchableOpacity
                  key={tree.child_id}
                  style={[s.childPickerRow, { borderColor: color + '40' }]}
                  onPress={() => {
                    setDeedPickerOpen(false);
                    navigation.navigate('GardenDetail', { tree, autoOpenLog: true });
                  }}
                  activeOpacity={0.75}
                >
                  <View style={[s.childPickerAvatar, { backgroundColor: color }]}>
                    {child?.photo
                      ? <Image source={{ uri: child.photo }} style={s.childPickerAvatarPhoto} />
                      : <Text style={s.childPickerAvatarInitial}>{firstName[0].toUpperCase()}</Text>
                    }
                  </View>
                  <Text style={s.childPickerName}>{firstName}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

      {/* ── Log Moment Modal ── */}
      <Modal visible={!!logModalStep} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeLogModal}>
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#FFFFFF' }} behavior={Platform.OS === 'ios' ? 'height' : 'padding'}>

          {/* Header */}
          <View style={s.logModalHeader}>
            <Text style={s.logModalTitle}>
              {logModalStep === 'child' ? 'Which child?' : `Log a moment for ${logChild?.name?.split(' ')[0]}`}
            </Text>
            <TouchableOpacity onPress={closeLogModal} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Step 1 — Pick child */}
          {logModalStep === 'child' && (
            <ScrollView contentContainerStyle={s.logModalScroll}>
              <Text style={s.logModalSub}>Select the child this moment is for.</Text>
              {children.map(child => (
                <TouchableOpacity
                  key={child.id}
                  style={s.logChildRow}
                  onPress={() => { setLogChild(child); setLogModalStep('form'); }}
                  activeOpacity={0.8}
                >
                  {child.photo
                    ? <Image source={{ uri: child.photo }} style={s.logChildAvatar} />
                    : <View style={[s.logChildAvatarFallback, { backgroundColor: child.color ?? '#2E7D62' }]}>
                        <Text style={s.logChildAvatarInitial}>{child.name[0].toUpperCase()}</Text>
                      </View>
                  }
                  <Text style={s.logChildName}>{child.name}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Step 2 — Log the moment */}
          {logModalStep === 'form' && (
            <ScrollView
              contentContainerStyle={s.logModalScroll}
              keyboardShouldPersistTaps="handled"
              onScrollBeginDrag={() => Keyboard.dismiss()}
            >
              <Text style={s.logModalLabel}>What happened?</Text>
              <TextInput
                style={s.logModalInput}
                placeholder={`Describe the difficult moment with ${logChild?.name?.split(' ')[0]}…`}
                placeholderTextColor="#9CA3AF"
                value={logText}
                onChangeText={setLogText}
                multiline
                autoFocus
              />
              <Text style={s.logModalLabel}>Consequence implemented (optional)</Text>
              <TextInput
                style={[s.logModalInput, { minHeight: 60 }]}
                placeholder={`e.g. "Screen time removed for the evening"`}
                placeholderTextColor="#9CA3AF"
                value={logConsequence}
                onChangeText={setLogConsequence}
                multiline
              />
              <TouchableOpacity
                style={[s.logModalSaveBtn, (!logText.trim() || logSaving) && { opacity: 0.5 }]}
                onPress={saveLoggedMoment}
                disabled={!logText.trim() || logSaving}
                activeOpacity={0.85}
              >
                <Text style={s.logModalSaveBtnText}>{logSaving ? 'Saving…' : 'Save Moment'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setLogModalStep('child')} style={{ alignItems: 'center', paddingVertical: 12 }} activeOpacity={0.7}>
                <Text style={{ fontSize: 13, color: '#9CA3AF' }}>← Change child</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  quickActionFeedBtn:        { backgroundColor: '#1B3D2F', borderRadius: 18, padding: 18, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 6 },
  quickActionFeedHeader:     { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  quickActionFeedEyebrow:    { fontSize: 10, fontWeight: '700', color: 'rgba(74,222,128,0.8)', letterSpacing: 1.2, marginBottom: 3 },
  quickActionFeedTitle:      { fontSize: 18, fontWeight: '800', color: '#FFFFFF', marginBottom: 4 },
  quickActionFeedSub:        { fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 18 },
  quickActionFeedViewBtn:    { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, alignSelf: 'flex-start', marginLeft: 12 },
  quickActionFeedViewBtnText:{ fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  quickActionFeedFooter:     { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 12 },
  quickActionFeedPill:       { flexDirection: 'row', alignItems: 'center', gap: 5 },
  quickActionFeedDot:        { width: 7, height: 7, borderRadius: 4 },
  quickActionFeedPillText:   { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },
  quickActionFeedCta:        { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  quickActionIcon:         { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  gardenDots:     { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  gardenDot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D1D5DB' },
  gardenDotActive:{ backgroundColor: '#1B3D2F', width: 18 },

  winsCard:          { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#E2EDE9', overflow: 'hidden', shadowColor: '#1B3D2F', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  winsCardHeader:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F4F2', backgroundColor: '#F8FCFA' },
  winsCardHeaderSub: { fontSize: 11, color: '#9CA3AF', flex: 1 },
  powerDotOuter:     { width: 10, height: 10, borderRadius: 5, backgroundColor: '#C6E8DA', alignItems: 'center', justifyContent: 'center' },
  powerDotInner:     { width: 5, height: 5, borderRadius: 3, backgroundColor: '#2E7D62' },
  winsEmpty:         { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20, gap: 6 },
  winsRow:           { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  winsRowBorder:     { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  winsAvatar:        { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  winsAvatarPhoto:   { width: 44, height: 44, borderRadius: 22 },
  winsAvatarInitial: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  winsChildName:     { fontSize: 15, fontWeight: '700', color: '#1A1A2E', marginBottom: 3 },
  winsAgePill:       { alignSelf: 'flex-start', backgroundColor: '#EDF7F2', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2 },
  winsAgeText:       { fontSize: 11, fontWeight: '600', color: '#2E7D62' },
  winsStats:         { flexDirection: 'row', alignItems: 'center', gap: 10 },
  winsStatItem:      { alignItems: 'center' },
  winsStatNum:       { fontSize: 20, fontWeight: '800', color: '#1B3D2F', lineHeight: 24 },
  winsStatLabel:     { fontSize: 9, color: '#9CA3AF', fontWeight: '600', letterSpacing: 0.3, marginTop: 1 },
  winsStatDivider:   { width: 1, height: 28, backgroundColor: '#E5E7EB' },

  partnerBanner:  { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EDF7F2', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 16, alignSelf: 'flex-start' },
  partnerBannerText: { fontSize: 12, fontWeight: '600', color: '#2E7D62' },

  // Nightly Muhasabah section
  muhasabahSection:       { backgroundColor: '#0D1B3E', borderRadius: 18, padding: 18, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 6 },
  muhasabahHeader:        { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  muhasabahEyebrow:       { fontSize: 10, fontWeight: '700', color: 'rgba(255,209,102,0.7)', letterSpacing: 1.2, marginBottom: 3 },
  muhasabahTitle:         { fontSize: 18, fontWeight: '800', color: '#FFFFFF', marginBottom: 3 },
  muhasabahSub:           { fontSize: 11, color: 'rgba(255,255,255,0.45)', letterSpacing: 0.2 },
  muhasabahBeginBtn:      { backgroundColor: '#FFD166', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, alignSelf: 'flex-start' },
  muhasabahBeginText:     { fontSize: 13, fontWeight: '800', color: '#0D1B3E' },
  muhasabahChildren:      { gap: 0 },
  muhasabahDivider:       { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 10 },
  sectionDivider:         { height: 1, backgroundColor: '#E5E7EB', marginTop: 8, marginBottom: 20 },
  muhasabahChildRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  muhasabahChildLeft:     { flex: 1 },
  muhasabahChildName:     { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  muhasabahChildStats:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  muhasabahStat:          { fontSize: 12, color: 'rgba(255,255,255,0.65)' },
  muhasabahStatStreak:    { fontSize: 12, color: '#FFD166' },
  muhasabahStatSessions:  { fontSize: 12, color: 'rgba(255,255,255,0.45)' },
  muhasabahRewardsLink:   { fontSize: 12, fontWeight: '700', color: '#FFD166' },
  muhasabahEmpty:         { paddingVertical: 10 },
  muhasabahEmptyText:     { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' },
  muhasabahUnlockBadge:     { backgroundColor: 'rgba(255,209,102,0.18)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  muhasabahUnlockBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFD166' },

  sectionHeader:  { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  momentHeader:   { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  eyebrow:        { fontSize: 10, fontWeight: '700', color: '#2E7D62', letterSpacing: 1, marginBottom: 2 },
  sectionTitle:   { fontSize: 16, fontWeight: '800', color: '#1B3D2F', marginBottom: 2 },
  sectionSub:     { fontSize: 12, color: '#9CA3AF' },
  sectionActionBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#1B3D2F', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  sectionActionBtnText:  { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  card:           { backgroundColor: '#FFFFFF', borderRadius: 18, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.10, shadowRadius: 14, elevation: 5 },
  divider:        { height: 1, backgroundColor: '#F5F5F5', marginHorizontal: 16 },
  emptyInner:     { padding: 28, alignItems: 'center' },
  emptyGarden:    { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 28, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 },
  emptyTitle:     { fontSize: 14, fontWeight: '700', color: '#1A1A2E', marginBottom: 4 },
  emptySub:       { fontSize: 12, color: '#9CA3AF', textAlign: 'center', lineHeight: 18, marginBottom: 12 },
  emptyBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EDF7F2', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  emptyBtnText:     { fontSize: 13, fontWeight: '600', color: '#1B3D2F' },
  emptyHighlight:   { fontWeight: '700', color: '#1B3D2F' },

  goalRow:        { flexDirection: 'row', alignItems: 'flex-start', padding: 16, gap: 14 },
  goalIcon:       { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  goalTitleRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  goalTitle:      { flex: 1, fontSize: 14, fontWeight: '700', color: '#1A1A2E' },
  metPill:        { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EDF7F2', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  metText:        { fontSize: 11, fontWeight: '700', color: '#2E7D62' },
  logBtn:         { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1B3D2F', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  logBtnDone:     { backgroundColor: '#EDF7F2' },
  logBtnText:     { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  barRow:         { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  barTrack:       { flex: 1, height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden' },
  barFill:        { height: 6, borderRadius: 3 },
  barLabel:       { fontSize: 11, fontWeight: '600', color: '#9CA3AF' },
  goalStatus:     { fontSize: 11, color: '#9CA3AF' },
  seeMoreBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  seeMoreText:    { fontSize: 13, fontWeight: '600', color: '#2E7D62' },

  sharedCard:     { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16 },
  sharedText:     { fontSize: 14, color: '#374151', lineHeight: 21 },
  sharedBy:       { fontSize: 11, color: '#9CA3AF', fontStyle: 'italic' },
  readMore:       { fontSize: 12, fontWeight: '600', color: '#2E7D62' },

  momentRow:      { flexDirection: 'row', alignItems: 'flex-start', padding: 16, gap: 12 },
  momentIcon:     { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  momentTopRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' },
  momentText:     { fontSize: 14, color: '#374151', lineHeight: 21, marginBottom: 8 },
  childBadge:     { borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 },
  childBadgeText: { fontSize: 11, fontWeight: '700' },
  typeLabel:      { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  dateLabel:      { fontSize: 11, color: '#9CA3AF', marginLeft: 'auto' },
  reactionRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ackBtn:         { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#1B3D2F' },
  ackBtnActive:   { backgroundColor: '#EDF7F2' },
  ackText:        { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  ackTextActive:  { color: '#2E7D62' },
  ackNamePill:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ackNameText:    { fontSize: 11, color: '#2E7D62', fontWeight: '600' },

  // Accomplishment feed
  accompFeed:        { marginHorizontal: -PADDING },
  accompDivider:     { height: 8, backgroundColor: '#F3F4F6' },
  accompItem:        { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14, backgroundColor: '#FFFFFF', paddingHorizontal: PADDING },
  accompAvatar:      { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  accompAvatarPhoto: { width: 36, height: 36, borderRadius: 18 },
  accompAvatarInitial: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  accompEmoji:       { fontSize: 15 },
  accompLabel:       { fontSize: 13, fontWeight: '700', color: '#1A1A2E', flex: 1 },
  accompChildPill:   { borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2 },
  accompChildName:   { fontSize: 10, fontWeight: '700' },
  accompNote:        { fontSize: 12, color: '#6B7280', fontStyle: 'italic', lineHeight: 17, marginBottom: 2 },
  accompDate:        { fontSize: 11, color: '#9CA3AF' },
  accompLoveNames:   { fontSize: 11, color: '#E11D48', marginTop: 3, fontWeight: '500' },
  lovePill:          { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  lovePillText:      { fontSize: 12, fontWeight: '600', color: '#E11D48' },
  loveBtn:           { paddingTop: 2 },
  showMoreBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 16, paddingHorizontal: PADDING, backgroundColor: '#FFFFFF' },
  showMoreText:      { fontSize: 13, fontWeight: '600', color: '#2E7D62' },

  incCard:        { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16 },
  incList:        { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#F0F0F0', overflow: 'hidden' },
  incListItem:    { padding: 16 },
  incListItemBorder: { borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  incListTopRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  seeMoreBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 14, borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  seeMoreText:     { fontSize: 13, fontWeight: '600', color: '#2E7D62' },
  logModalHeader:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  logModalTitle:         { fontSize: 17, fontWeight: '800', color: '#1A1A2E' },
  childPickerRow:        { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 14, borderWidth: 1, backgroundColor: '#FAFAFA' },
  childPickerAvatar:     { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  childPickerAvatarPhoto:{ width: 42, height: 42, borderRadius: 21 },
  childPickerAvatarInitial: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  childPickerName:       { flex: 1, fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  logModalScroll:        { padding: 20, gap: 12 },
  logModalSub:           { fontSize: 14, color: '#6B7280', marginBottom: 4 },
  logChildRow:           { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#F9FAFB', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#F0F0F0' },
  logChildAvatar:        { width: 40, height: 40, borderRadius: 20 },
  logChildAvatarFallback:{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  logChildAvatarInitial: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  logChildName:          { flex: 1, fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  logModalLabel:         { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 6 },
  logModalInput:         { backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', padding: 14, fontSize: 14, color: '#1A1A2E', lineHeight: 21, minHeight: 90, textAlignVertical: 'top' },
  logModalSaveBtn:       { backgroundColor: '#1B3D2F', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  logModalSaveBtnText:   { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  consequenceLabel: { fontSize: 10, fontWeight: '700', color: '#B45309', letterSpacing: 1, marginBottom: 4 },
  consequencePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  consequenceText: { fontSize: 11, color: '#92400E', fontWeight: '500', flexShrink: 1 },
  carouselFooter: { alignItems: 'center', paddingVertical: 8, gap: 4 },
  dotsRow:        { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dotBase:        { width: 6, height: 6, borderRadius: 3, backgroundColor: '#E5E7EB' },
  dotActive:      { width: 16, backgroundColor: '#2E7D62' },
  swipeHint:      { fontSize: 10, color: '#2E7D62', fontWeight: '500', letterSpacing: 0.3 },
});
