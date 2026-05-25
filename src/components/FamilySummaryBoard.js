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

export default function FamilySummaryBoard({ navigation }) {
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
  const [acknowledgedInc, setAcknowledgedInc] = useState(new Set());
  const [refreshing,      setRefreshing]      = useState(false);
  const [encouragement,   setEncouragement]   = useState(null);
  const [sharedPage,      setSharedPage]      = useState(0);
  const [expandedShared,  setExpandedShared]  = useState(new Set());
  const [overflowShared,  setOverflowShared]  = useState(new Set());
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

      const [goalsRes, completionsRes, treesRes, actionsRes, momentsRes, lovedRaw] = await Promise.all([
        loadFamilyGoalsCached(),
        loadCompletions(),
        supabase.from('family_trees').select('*').eq('family_id', familyId),
        supabase.from('child_garden_actions').select('id, child_id, child_name, manner, note, date, loved_by').eq('family_id', familyId).order('date', { ascending: false }),
        supabase.from('family_moments').select('*').eq('family_id', familyId).order('date', { ascending: false }).limit(30),
        AsyncStorage.getItem('tarbiyah_loved_actions'),
      ]);
      if (lovedRaw) setLovedActions(new Set(JSON.parse(lovedRaw)));

      setFamilyGoals(goalsRes);
      setGoalCompletions(completionsRes);

      const trees = treesRes.data ?? [];
      const linkedIds = new Set(trees.map(t => t.linked_tree_id).filter(Boolean));
      setFamilyTrees(trees.filter(t => !t.linked_tree_id));
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
    await load();
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
        style={{ flex: 1, backgroundColor: '#F5F5F5' }}
        contentContainerStyle={{ padding: PADDING, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#2E7D62" />}
      >

        {/* ── Your Wins ── */}
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
              <Text style={s.emptySub}>Head to the <Text style={s.emptyHighlight}>Configure tab</Text> to add your children and start tracking their progress.</Text>
            </View>
          ) : children.map((child, idx) => {
            const hasAreas = (child.growthAreas ?? []).length > 0;
            const { habits, activities } = getChildWeeklyCounts(weekCompletions, child.growthAreas);
            const isLast = idx === children.length - 1;
            return (
              <TouchableOpacity
                key={child.id}
                style={[s.winsRow, !isLast && s.winsRowBorder]}
                onPress={() => navigation.navigate('Tabs', { screen: 'Dashboards', params: { childId: child.id } })}
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

        {/* ── Family Goals ── */}
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
              <Text style={s.emptySub}>Head to the <Text style={s.emptyHighlight}>Configure tab</Text> to set your first shared family goal.</Text>
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
            <TouchableOpacity
              style={s.seeMoreBtn}
              onPress={() => setShowAllGoals(v => !v)}
              activeOpacity={0.75}
            >
              <Text style={s.seeMoreText}>
                {showAllGoals ? 'Show less' : `See ${familyGoals.length - 5} more`}
              </Text>
              <Ionicons name={showAllGoals ? 'chevron-up' : 'chevron-down'} size={13} color="#2E7D62" />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Accomplishment Trees ── */}
        <View style={{ marginTop: 20 }}>
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
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
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
          )}
        </View>

        {/* ── Accomplishment feed ── */}
        {accomplishments.length > 0 && (
          <View style={{ marginTop: 20 }}>
            <View style={{ marginBottom: 12 }}>
              <Text style={s.eyebrow}>ALL CHILDREN</Text>
              <Text style={s.sectionTitle}>Accomplishment Feed</Text>
              <Text style={s.sectionSub}>Recent wins across your family</Text>
            </View>
            <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#F0F0F0' }}>
            {(showAllAccomp ? accomplishments : accomplishments.slice(0, 5)).map((action, idx) => {
              const manner    = MANNERS.find(m => m.key === action.manner);
              const child     = children.find(c => c.id === action.child_id);
              const childName = action.child_name?.split(' ')[0] ?? child?.name?.split(' ')[0] ?? '?';
              const color     = child?.color ?? '#2E7D62';
              const loveNames = Array.isArray(action.loved_by) ? action.loved_by : [];
              const loved     = lovedActions.has(action.id) || loveNames.includes(myProfileName);
              return (
                <View key={action.id} style={[s.accompItem, idx > 0 && s.accompItemBorder]}>
                  {/* Avatar */}
                  <View style={[s.accompAvatar, { backgroundColor: color }]}>
                    {child?.photo
                      ? <Image source={{ uri: child.photo }} style={s.accompAvatarPhoto} />
                      : <Text style={s.accompAvatarInitial}>{childName[0].toUpperCase()}</Text>
                    }
                  </View>

                  {/* Content */}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={s.accompEmoji}>{manner?.emoji ?? '⭐'}</Text>
                      <Text style={s.accompLabel} numberOfLines={1}>{manner?.label ?? action.manner}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                      <View style={[s.accompChildPill, { backgroundColor: color + '22' }]}>
                        <Text style={[s.accompChildName, { color }]}>{childName}</Text>
                      </View>
                      <Text style={s.accompDate}>{new Date(action.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                    </View>
                    {!!action.note && <Text style={s.accompNote}>"{action.note}"</Text>}
                    {loveNames.length > 0 && (
                      <View style={s.lovePill}>
                        <Ionicons name="heart" size={12} color="#E11D48" />
                        <Text style={s.lovePillText}>{loveNames.join(' & ')} loved this</Text>
                      </View>
                    )}
                  </View>

                  {/* Love button */}
                  <TouchableOpacity
                    onPress={() => handleLoveAccomplishment(action.id, childName, manner?.label ?? action.manner)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name={loved ? 'heart' : 'heart-outline'} size={22} color={loved ? '#E11D48' : '#D1D5DB'} />
                  </TouchableOpacity>
                </View>
              );
            })}
            {accomplishments.length > 5 && (
              <TouchableOpacity onPress={() => setShowAllAccomp(v => !v)} style={s.showMoreBtn}>
                <Text style={s.showMoreText}>
                  {showAllAccomp ? 'Show less' : `See all ${accomplishments.length} accomplishments`}
                </Text>
                <Ionicons name={showAllAccomp ? 'chevron-up' : 'chevron-down'} size={14} color="#2E7D62" />
              </TouchableOpacity>
            )}
            </View>
          </View>
        )}

        {/* ── Partner shared habits/activities ── */}
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
              {sharedByPartner.length > 1 && (
                <Text style={s.swipeHint}>swipe for more</Text>
              )}
            </View>
          </View>
        )}

        {/* ── Difficult Moments ── */}
        <View style={{ marginTop: 20 }}>
          <View style={s.momentHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.eyebrow}>FAMILY LOG</Text>
              <Text style={s.sectionTitle}>Difficult Moments</Text>
            </View>
            {children.length > 0 && (
              <TouchableOpacity style={s.sectionActionBtn} onPress={openLogModal} activeOpacity={0.8}>
                <Ionicons name="add" size={14} color="#FFFFFF" />
                <Text style={s.sectionActionBtnText}>Log</Text>
              </TouchableOpacity>
            )}
          </View>

          {incidents.length === 0 ? (
            <View style={s.card}>
              <View style={s.emptyInner}>
                <Ionicons name="journal-outline" size={28} color="#D1D5DB" style={{ marginBottom: 10 }} />
                <Text style={s.emptyTitle}>Nothing logged yet</Text>
                <Text style={s.emptySub}>Difficult moments logged on a child's dashboard will appear here.</Text>
              </View>
            </View>
          ) : (
            <View style={s.incList}>
              {(showAllInc ? incidents : incidents.slice(0, 3)).map((entry, idx, arr) => {
                const ackNames   = Array.isArray(entry.acknowledges) ? entry.acknowledges : [];
                const acked      = acknowledgedInc.has(entry.id) || ackNames.includes(myProfileName);
                const isExpanded = expandedInc.has(entry.id);
                const isOverflow = overflowInc.has(entry.id);
                return (
                  <View key={entry.id} style={[s.incListItem, idx < arr.length - 1 && s.incListItemBorder]}>
                    <View style={s.incListTopRow}>
                      <View style={[s.childBadge, { backgroundColor: (entry.child_color ?? '#2E7D62') + '22' }]}>
                        <Text style={[s.childBadgeText, { color: entry.child_color ?? '#2E7D62' }]}>{entry.child_name}</Text>
                      </View>
                      <View style={{ flex: 1 }} />
                      <Text style={s.dateLabel}>{new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                      {entry.user_id === myUserId && (
                        <TouchableOpacity onPress={() => deleteIncidentEntry(entry)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginLeft: 8 }}>
                          <Ionicons name="trash-outline" size={14} color="#D1D5DB" />
                        </TouchableOpacity>
                      )}
                    </View>
                    <Text style={{ position: 'absolute', opacity: 0 }} onTextLayout={e => { if (e.nativeEvent.lines.length > 3) setOverflowInc(prev => new Set([...prev, entry.id])); }}>{entry.text}</Text>
                    <Text style={s.momentText} numberOfLines={isExpanded ? undefined : 3}>{entry.text}</Text>
                    {!!entry.consequence && (
                      <View style={{ marginTop: 8 }}>
                        <Text style={s.consequenceLabel}>CONSEQUENCE GIVEN</Text>
                        <View style={s.consequencePill}>
                          <Ionicons name="shield-checkmark-outline" size={11} color="#B45309" />
                          <Text style={s.consequenceText}>{entry.consequence}</Text>
                        </View>
                      </View>
                    )}
                    {isOverflow && (
                      <TouchableOpacity onPress={() => setExpandedInc(prev => { const n = new Set(prev); isExpanded ? n.delete(entry.id) : n.add(entry.id); return n; })} activeOpacity={0.7} style={{ marginTop: 4 }}>
                        <Text style={s.readMore}>{isExpanded ? 'Show less' : 'Read more'}</Text>
                      </TouchableOpacity>
                    )}
                    <View style={[s.reactionRow, { marginTop: 10 }]}>
                      <TouchableOpacity style={[s.ackBtn, acked && s.ackBtnActive]} onPress={() => handleAcknowledgeIncident(entry.childId, entry.id)} activeOpacity={0.7}>
                        <Ionicons name={acked ? 'checkmark-circle' : 'checkmark-circle-outline'} size={14} color={acked ? '#2E7D62' : '#FFFFFF'} />
                        <Text style={[s.ackText, acked && s.ackTextActive]}>{acked ? 'Acknowledged' : 'Acknowledge'}</Text>
                      </TouchableOpacity>
                      {ackNames.length > 0 && (
                        <View style={s.ackNamePill}>
                          <Ionicons name="checkmark-circle" size={13} color="#2E7D62" />
                          <Text style={s.ackNameText}>{ackNames.join(' & ')}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
              {incidents.length > 3 && (
                <TouchableOpacity style={s.seeMoreBtn} onPress={() => setShowAllInc(v => !v)} activeOpacity={0.7}>
                  <Text style={s.seeMoreText}>{showAllInc ? 'Show less' : `See all ${incidents.length} moments`}</Text>
                  <Ionicons name={showAllInc ? 'chevron-up' : 'chevron-down'} size={13} color="#2E7D62" />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

      </ScrollView>

      <EncouragementModal visible={!!encouragement} emoji={encouragement?.emoji} title={encouragement?.title} body={encouragement?.body} onClose={() => setEncouragement(null)} />

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
  accompItem:        { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 14 },
  accompItemBorder:  { borderTopWidth: 1, borderTopColor: '#F5F5F5' },
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
  showMoreBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 14, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F5F5F5' },
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
