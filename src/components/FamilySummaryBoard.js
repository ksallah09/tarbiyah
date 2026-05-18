import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, Dimensions, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';
import { getFamilyId, loadFamilyGoals, loadFamilyGoalsCached, getGoalEmoji } from '../utils/familyGoals';
import { getCachedSyncStatus } from '../utils/familySync';
import { getAllChildProfiles } from '../utils/childProfiles';
import { loadCompletions, isCompletedToday, countThisWeek, logCompletion } from '../utils/goalCompletions';
import { MiniGardenCard } from './MannerGarden';
import ChallengeCard from './ChallengeCard';
import LeaderboardCard from './LeaderboardCard';
import { GOALS_MESSAGES, pickRandom } from '../utils/encouragement';
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
  const [partnerName,     setPartnerName]     = useState('Partner');
  const [myProfileName,   setMyProfileName]   = useState('');
  const [acknowledgedInc, setAcknowledgedInc] = useState(new Set());
  const [refreshing,      setRefreshing]      = useState(false);
  const [encouragement,   setEncouragement]   = useState(null);
  const [sharedPage,      setSharedPage]      = useState(0);
  const [expandedShared,  setExpandedShared]  = useState(new Set());
  const [overflowShared,  setOverflowShared]  = useState(new Set());

  const load = useCallback(async () => {
    try {
      const [syncStatus, familyId, allChildren, profileRaw, ackedRaw] = await Promise.all([
        getCachedSyncStatus(),
        getFamilyId(),
        getAllChildProfiles(),
        AsyncStorage.getItem('tarbiyah_profile'),
        AsyncStorage.getItem('tarbiyah_acknowledged_inc'),
      ]);

      setPartnerLinked(!!syncStatus?.linked);
      if (syncStatus?.partner?.name) setPartnerName(syncStatus.partner.name.split(' ')[0]);
      if (profileRaw) setMyProfileName(JSON.parse(profileRaw).name?.split(' ')[0] ?? '');
      if (ackedRaw) setAcknowledgedInc(new Set(JSON.parse(ackedRaw)));
      setChildren(allChildren);

      const [goalsRes, completionsRes, treesRes, actionsRes, momentsRes] = await Promise.all([
        loadFamilyGoalsCached(),
        loadCompletions(),
        supabase.from('family_trees').select('*').eq('family_id', familyId),
        supabase.from('child_garden_actions').select('child_id').eq('family_id', familyId),
        supabase.from('family_moments').select('*').eq('family_id', familyId).order('date', { ascending: false }).limit(30),
      ]);

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
      setFamilyMoments(momentsRes.data ?? []);

      // Background refresh with live goals
      loadFamilyGoals().then(setFamilyGoals);
    } catch {}
  }, []);

  useEffect(() => { load(); }, []);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
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
    try { await supabase.from('family_moments').update({ acknowledges: newAcks }).eq('id', incidentId); } catch {}
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
        {/* Partner banner */}
        {partnerLinked && (
          <View style={s.partnerBanner}>
            <Ionicons name="people" size={13} color="#2E7D62" />
            <Text style={s.partnerBannerText}>Shared with {partnerName} · both of you can manage this board</Text>
          </View>
        )}

        {/* ── Family Goals ── */}
        <View style={s.sectionHeader}>
          <View style={{ flex: 1 }}>
            <Text style={s.eyebrow}>FAMILY DASHBOARD</Text>
            <Text style={s.sectionTitle}>Family Goals</Text>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={() => navigation.navigate('FamilyGoalWizard')} activeOpacity={0.75}>
            <Ionicons name="add" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <View style={s.card}>
          {familyGoals.length === 0 ? (
            <View style={s.emptyInner}>
              <Ionicons name="flag-outline" size={28} color="#D1D5DB" style={{ marginBottom: 10 }} />
              <Text style={s.emptyTitle}>No family goals yet</Text>
              <Text style={s.emptySub}>Set a shared goal to start growing together.</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => navigation.navigate('FamilyGoalWizard')} activeOpacity={0.75}>
                <Ionicons name="add-circle-outline" size={14} color="#1B3D2F" />
                <Text style={s.emptyBtnText}>Add Family Goal</Text>
              </TouchableOpacity>
            </View>
          ) : familyGoals.map((goal, idx) => {
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
        </View>

        {/* ── Accomplishment Trees ── */}
        <View style={{ marginTop: 20 }}>
          <View style={[s.sectionHeader, { alignItems: 'flex-start' }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.eyebrow}>FAMILY GARDEN</Text>
              <Text style={s.sectionTitle}>Accomplishment Trees</Text>
              <Text style={s.sectionSub}>Track your children's accomplishments</Text>
            </View>
            <TouchableOpacity style={s.addTreeBtn} onPress={() => navigation.navigate('GardenTreeWizard')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="add" size={14} color="#2E7D62" />
              <Text style={s.addTreeText}>Add Tree</Text>
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
                  thresholds={tree.thresholds}
                  onPress={() => navigation.navigate('GardenDetail', { tree })}
                />
              ))}
            </ScrollView>
          )}
        </View>

        {/* ── Partner shared habits/activities ── */}
        {partnerLinked && sharedByPartner.length > 0 && (
          <View style={{ marginTop: 20 }}>
            <View style={s.momentHeader}>
              <Text style={s.eyebrow}>SHARED BY YOUR PARTNER</Text>
              <Text style={s.sectionTitle}>Recommended by Your Partner</Text>
              <Text style={s.sectionSub}>Shared from a child's dashboard</Text>
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
          </View>
        )}

        {/* ── Difficult Moments ── */}
        <View style={{ marginTop: 20 }}>
          <View style={s.momentHeader}>
            <Text style={s.eyebrow}>FAMILY LOG</Text>
            <Text style={s.sectionTitle}>Difficult Moments</Text>
            <Text style={s.sectionSub}>Logged from each child's dashboard</Text>
          </View>
          <View style={s.card}>
            {incidents.length === 0 ? (
              <View style={s.emptyInner}>
                <Ionicons name="journal-outline" size={28} color="#D1D5DB" style={{ marginBottom: 10 }} />
                <Text style={s.emptyTitle}>Nothing logged yet</Text>
                <Text style={s.emptySub}>Difficult moments logged on a child's dashboard will appear here.</Text>
              </View>
            ) : incidents.map((entry, idx) => {
              const ackNames = Array.isArray(entry.acknowledges) ? entry.acknowledges : [];
              const acked = acknowledgedInc.has(entry.id) || ackNames.includes(myProfileName);
              return (
                <View key={entry.id}>
                  {idx > 0 && <View style={s.divider} />}
                  <View style={s.momentRow}>
                    <View style={[s.momentIcon, { backgroundColor: '#FFF8F8' }]}>
                      <Text style={{ fontSize: 16 }}>⚠️</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={s.momentTopRow}>
                        <View style={[s.childBadge, { backgroundColor: (entry.child_color ?? '#2E7D62') + '22' }]}>
                          <Text style={[s.childBadgeText, { color: entry.child_color ?? '#2E7D62' }]}>{entry.child_name}</Text>
                        </View>
                        <Text style={s.typeLabel}>Difficult Moment</Text>
                        <Text style={s.dateLabel}>{new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                      </View>
                      <Text style={s.momentText}>{entry.text}</Text>
                      <View style={s.reactionRow}>
                        <TouchableOpacity style={[s.ackBtn, acked && s.ackBtnActive]} onPress={() => handleAcknowledgeIncident(entry.childId, entry.id)} activeOpacity={0.7}>
                          <Ionicons name={acked ? 'checkmark-circle' : 'checkmark-circle-outline'} size={14} color={acked ? '#2E7D62' : '#9CA3AF'} />
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
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <ChallengeCard navigation={navigation} onChallenge={() => navigation.navigate('ChallengeWizard')} />
        <LeaderboardCard navigation={navigation} />
      </ScrollView>

      <EncouragementModal visible={!!encouragement} emoji={encouragement?.emoji} title={encouragement?.title} body={encouragement?.body} onClose={() => setEncouragement(null)} />
    </>
  );
}

const s = StyleSheet.create({
  partnerBanner:  { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EDF7F2', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 16, alignSelf: 'flex-start' },
  partnerBannerText: { fontSize: 12, fontWeight: '600', color: '#2E7D62' },

  sectionHeader:  { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  momentHeader:   { marginBottom: 12 },
  eyebrow:        { fontSize: 10, fontWeight: '700', color: '#2E7D62', letterSpacing: 1, marginBottom: 2 },
  sectionTitle:   { fontSize: 16, fontWeight: '800', color: '#1A1A2E', marginBottom: 2 },
  sectionSub:     { fontSize: 12, color: '#9CA3AF' },
  addBtn:         { width: 32, height: 32, borderRadius: 10, backgroundColor: '#1B3D2F', alignItems: 'center', justifyContent: 'center' },
  addTreeBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: '#2E7D62' },
  addTreeText:    { fontSize: 12, fontWeight: '700', color: '#2E7D62' },

  card:           { backgroundColor: '#FFFFFF', borderRadius: 18, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.10, shadowRadius: 14, elevation: 5 },
  divider:        { height: 1, backgroundColor: '#F5F5F5', marginHorizontal: 16 },
  emptyInner:     { padding: 28, alignItems: 'center' },
  emptyGarden:    { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 28, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 },
  emptyTitle:     { fontSize: 14, fontWeight: '700', color: '#1A1A2E', marginBottom: 4 },
  emptySub:       { fontSize: 12, color: '#9CA3AF', textAlign: 'center', lineHeight: 18, marginBottom: 12 },
  emptyBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EDF7F2', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  emptyBtnText:   { fontSize: 13, fontWeight: '600', color: '#1B3D2F' },

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

  sharedCard:     { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 },
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
  ackBtn:         { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#F3F4F6' },
  ackBtnActive:   { backgroundColor: '#EDF7F2' },
  ackText:        { fontSize: 12, fontWeight: '600', color: '#9CA3AF' },
  ackTextActive:  { color: '#2E7D62' },
  ackNamePill:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ackNameText:    { fontSize: 11, color: '#2E7D62', fontWeight: '600' },
});
