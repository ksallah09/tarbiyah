import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Animated, Alert, KeyboardAvoidingView, Platform, Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { supabase } from '../utils/supabase';
import { getFamilyId } from '../utils/familyGoals';

let captureRef = null;
try { captureRef = require('react-native-view-shot').captureRef; } catch {}
let Sharing = null;
try { Sharing = require('expo-sharing'); } catch {}

const BG     = '#0D1B3E';
const GOLD   = '#FFD166';
const TEXT   = '#F8FAFC';
const SUBTEXT= '#94A3B8';
const CARD   = 'rgba(255,255,255,0.07)';
const BORDER = 'rgba(255,255,255,0.11)';
const GREEN  = '#4ADE80';

function ChildAvatar({ child, size = 64 }) {
  if (!child) return null;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: child.color ?? '#1B4D3E', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: GOLD }}>
      {child.photo
        ? <Image source={{ uri: child.photo }} style={{ width: size - 8, height: size - 8, borderRadius: (size - 8) / 2 }} />
        : <Text style={{ fontSize: size * 0.38, fontWeight: '800', color: '#FFF' }}>{(child.name ?? '?')[0].toUpperCase()}</Text>
      }
    </View>
  );
}

function RewardBar({ total, target }) {
  const pct     = target > 0 ? Math.min(total / target, 1) : 0;
  const barAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(barAnim, { toValue: pct, duration: 1000, delay: 300, useNativeDriver: false }).start();
  }, [pct]);
  return (
    <View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, {
          width: barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }]} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Text style={{ fontSize: 12, color: GOLD, fontWeight: '700' }}>⭐ {total} points</Text>
        <Text style={{ fontSize: 12, color: SUBTEXT }}>{target} to unlock</Text>
      </View>
    </View>
  );
}

export default function MuhasabahRewardsScreen({ navigation, route }) {
  const { child } = route.params ?? {};

  const [totalPoints,    setTotalPoints]    = useState(0);
  const [sessions,       setSessions]       = useState(0);
  const [streak,         setStreak]         = useState(0);
  const [rewardGoal,     setRewardGoal]     = useState('');
  const [rewardTarget,   setRewardTarget]   = useState('100');
  const [editing,        setEditing]        = useState(false);
  const [saving,         setSaving]         = useState(false);
  const [claiming,       setClaiming]       = useState(false);
  const [loading,        setLoading]        = useState(true);
  const [sharing,        setSharing]        = useState(false);
  const [showPointsInfo, setShowPointsInfo] = useState(false);

  const fadeAnim      = useRef(new Animated.Value(0)).current;
  const pointsHeight  = useRef(new Animated.Value(0)).current;
  const shareCardRef  = useRef(null);

  useEffect(() => {
    loadData();
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  function togglePointsInfo() {
    const toValue = showPointsInfo ? 0 : 1;
    setShowPointsInfo(v => !v);
    Animated.timing(pointsHeight, { toValue, duration: 220, useNativeDriver: false }).start();
  }

  async function loadData() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !child?.id) { setLoading(false); return; }

      const today     = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

      // Get all family user IDs + all child_ids that map to this canonical child
      // so both partners' sessions are counted (partner may have a different local child_id)
      const familyId = await getFamilyId();
      const [{ data: members }, { data: fcData }] = await Promise.all([
        supabase.from('family_members').select('user_id').eq('family_id', familyId),
        supabase.from('family_children').select('linked_child_id').eq('child_id', child.id),
      ]);
      const userIds  = (members ?? []).map(m => m.user_id).filter(Boolean);
      if (userIds.length === 0) userIds.push(session.user.id);
      const childIds = [child.id, ...(fcData ?? []).map(r => r.linked_child_id).filter(Boolean)];

      const [sessRes, cfgRes] = await Promise.all([
        supabase
          .from('muhasabah_sessions')
          .select('points_earned, streak_day, session_date')
          .in('user_id', userIds)
          .in('child_id', childIds)
          .order('session_date', { ascending: false }),
        supabase
          .from('muhasabah_config')
          .select('reward_goal, reward_points_target')
          .eq('user_id', session.user.id)
          .eq('child_id', child.id)
          .maybeSingle(),
      ]);

      const rows   = sessRes.data ?? [];
      const total  = rows.reduce((s, r) => s + (r.points_earned ?? 0), 0);
      const latest = rows[0];
      const sk     = latest && (latest.session_date === today || latest.session_date === yesterday)
        ? latest.streak_day : 0;

      setTotalPoints(total);
      setSessions(rows.length);
      setStreak(sk);
      if (cfgRes.data?.reward_goal)          setRewardGoal(cfgRes.data.reward_goal);
      if (cfgRes.data?.reward_points_target) setRewardTarget(String(cfgRes.data.reward_points_target));
    } catch {
    } finally {
      setLoading(false);
    }
  }

  async function claimReward() {
    setClaiming(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await supabase.from('muhasabah_config').upsert({
        user_id:              session.user.id,
        child_id:             child.id,
        child_name:           child.name,
        reward_goal:          null,
        reward_points_target: null,
      }, { onConflict: 'user_id,child_id' });
      setRewardGoal('');
      setRewardTarget('100');
    } catch {
      Alert.alert('Error', 'Could not mark as claimed. Please try again.');
    } finally {
      setClaiming(false);
    }
  }

  async function saveConfig() {
    const target = parseInt(rewardTarget, 10);
    if (!rewardGoal.trim()) { Alert.alert('Add a reward', 'Enter a reward name first.'); return; }
    if (!target || target < 1) { Alert.alert('Invalid target', 'Enter a points target of at least 1.'); return; }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await supabase.from('muhasabah_config').upsert({
        user_id:               session.user.id,
        child_id:              child.id,
        reward_goal:           rewardGoal.trim(),
        reward_points_target:  target,
      }, { onConflict: 'user_id,child_id' });
      setEditing(false);
    } catch {
      Alert.alert('Error', 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleShare() {
    if (sharing || !shareCardRef.current) return;
    setSharing(true);
    try {
      if (!captureRef) throw new Error('no captureRef');
      const uri = await captureRef(shareCardRef, { format: 'png', quality: 0.95 });
      const canShare = Sharing && await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share Progress' });
      } else {
        await Share.share({ message: `🌙 ${child?.name}'s Muhasabah Progress\n⭐ ${totalPoints} points · 📅 ${sessions} sessions${streak > 0 ? ` · 🔥 ${streak}-day streak` : ''}${rewardGoal ? `\n🎯 Working towards: "${rewardGoal}"` : ''}` });
      }
    } catch {
      await Share.share({ message: `🌙 ${child?.name}'s Muhasabah Progress\n⭐ ${totalPoints} points · 📅 ${sessions} sessions${streak > 0 ? ` · 🔥 ${streak}-day streak` : ''}${rewardGoal ? `\n🎯 Working towards: "${rewardGoal}"` : ''}` });
    } finally {
      setSharing(false);
    }
  }

  const target = parseInt(rewardTarget, 10) || 100;
  const pct    = target > 0 ? Math.min(totalPoints / target, 1) : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, left: 10, bottom: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={24} color={TEXT} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>🌙 {child?.name?.split(' ')[0]}'s Progress</Text>
          <TouchableOpacity onPress={handleShare} hitSlop={{ top: 10, left: 10, bottom: 10, right: 10 }} disabled={sharing}>
            <Ionicons name={sharing ? 'hourglass-outline' : 'share-outline'} size={22} color={GOLD} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Child avatar */}
          <Animated.View style={{ alignItems: 'center', marginBottom: 24, opacity: fadeAnim }}>
            <ChildAvatar child={child} size={80} />
            <Text style={styles.childName}>{child?.name}</Text>
          </Animated.View>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{totalPoints}</Text>
              <Text style={styles.statLabel}>total points</Text>
            </View>
            <View style={[styles.statBox, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: BORDER }]}>
              <Text style={styles.statNum}>{sessions}</Text>
              <Text style={styles.statLabel}>sessions</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statNum, streak > 0 && { color: '#FB923C' }]}>{streak > 0 ? `${streak}🔥` : '–'}</Text>
              <Text style={styles.statLabel}>day streak</Text>
            </View>
          </View>

          {/* Past sessions link */}
          <TouchableOpacity
            style={styles.feedLinkBtn}
            onPress={() => navigation.navigate('FamilyFeed')}
            activeOpacity={0.75}
          >
            <Ionicons name="time-outline" size={15} color={GOLD} />
            <Text style={styles.feedLinkText}>See past sessions on family feed</Text>
            <Ionicons name="chevron-forward" size={14} color={GOLD} />
          </TouchableOpacity>

          {/* Reward progress */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>🎁 Reward Goal</Text>
              {!editing && (
                <TouchableOpacity onPress={() => setEditing(true)} style={styles.editBtn}>
                  <Ionicons name="pencil-outline" size={14} color={GOLD} />
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
              )}
            </View>

            {!editing && rewardGoal && totalPoints >= target ? (
              <View style={styles.unlockWrap}>
                <Text style={styles.unlockEmoji}>🎁</Text>
                <Text style={styles.unlockTitle}>Reward Unlocked!</Text>
                <Text style={styles.unlockGoal}>"{rewardGoal}"</Text>
                <Text style={styles.unlockPts}>⭐ {totalPoints} / {target} points earned</Text>
                <TouchableOpacity
                  style={[styles.claimBtn, claiming && { opacity: 0.6 }]}
                  onPress={() => Alert.alert(
                    'Mark as claimed?',
                    `This confirms you've given ${child?.name?.split(' ')[0]} the reward. You can then set a new goal.`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Yes, claimed!', onPress: claimReward },
                    ]
                  )}
                  disabled={claiming}
                  activeOpacity={0.85}
                >
                  <Text style={styles.claimBtnText}>{claiming ? 'Saving…' : '✓ Mark as claimed'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setEditing(true)} style={{ marginTop: 6 }}>
                  <Text style={{ fontSize: 12, color: SUBTEXT, textAlign: 'center' }}>Edit goal instead</Text>
                </TouchableOpacity>
              </View>
            ) : editing ? (
              <View style={{ gap: 12 }}>
                <View>
                  <Text style={styles.inputLabel}>What's the reward?</Text>
                  <TextInput
                    style={styles.input}
                    value={rewardGoal}
                    onChangeText={setRewardGoal}
                    placeholder="e.g. Trip to the park, New book..."
                    placeholderTextColor={SUBTEXT}
                    maxLength={60}
                  />
                </View>
                <View>
                  <Text style={styles.inputLabel}>Points needed to unlock</Text>
                  <TextInput
                    style={styles.input}
                    value={rewardTarget}
                    onChangeText={setRewardTarget}
                    keyboardType="number-pad"
                    placeholder="e.g. 100"
                    placeholderTextColor={SUBTEXT}
                    maxLength={5}
                  />
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={saveConfig} disabled={saving}>
                    <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : rewardGoal ? (
              <View style={{ gap: 14 }}>
                <Text style={styles.goalName}>"{rewardGoal}"</Text>
                <RewardBar total={totalPoints} target={target} />
              </View>
            ) : (
              <TouchableOpacity style={styles.noGoalBtn} onPress={() => setEditing(true)} activeOpacity={0.8}>
                <Text style={styles.noGoalText}>Tap to set a reward goal for {child?.name?.split(' ')[0]} ✨</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Session settings */}
          <TouchableOpacity
            style={[styles.card, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
            onPress={() => navigation.navigate('MuhasabahSetup', { child, editMode: true })}
            activeOpacity={0.8}
          >
            <View>
              <Text style={styles.cardTitle}>Session Settings</Text>
              <Text style={{ fontSize: 12, color: SUBTEXT, marginTop: 2 }}>Edit reflection areas & questions</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={SUBTEXT} />
          </TouchableOpacity>

          {/* How points work — expandable */}
          <TouchableOpacity
            style={styles.card}
            onPress={togglePointsInfo}
            activeOpacity={0.85}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.cardTitle}>⭐ How points work</Text>
              <Ionicons name={showPointsInfo ? 'chevron-up' : 'chevron-down'} size={18} color={SUBTEXT} />
            </View>
            {showPointsInfo && (
              <View style={{ gap: 10, marginTop: 14 }}>
                {[
                  ['Base points',   '10 pts per session'],
                  ['Slider ratings','Up to 32 pts based on scores'],
                  ['Repair plan',   '+10 pts for setting a repair plan'],
                  ['Streak bonus',  'Up to +30 pts for daily streaks'],
                ].map(([label, desc]) => (
                  <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, color: SUBTEXT, flex: 1 }}>{label}</Text>
                    <Text style={{ fontSize: 13, color: GOLD, fontWeight: '700' }}>{desc}</Text>
                  </View>
                ))}
              </View>
            )}
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Off-screen share card — captured by handleShare */}
      <View
        ref={shareCardRef}
        collapsable={false}
        style={styles.shareCard}
      >
        <Text style={styles.shareCardMoon}>🌙</Text>
        <Text style={styles.shareCardName}>{child?.name}'s Muhasabah Progress</Text>
        <View style={styles.shareCardStats}>
          <View style={styles.shareCardStat}>
            <Text style={styles.shareCardStatNum}>{totalPoints}</Text>
            <Text style={styles.shareCardStatLabel}>points</Text>
          </View>
          <View style={[styles.shareCardStat, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }]}>
            <Text style={styles.shareCardStatNum}>{sessions}</Text>
            <Text style={styles.shareCardStatLabel}>sessions</Text>
          </View>
          <View style={styles.shareCardStat}>
            <Text style={[styles.shareCardStatNum, streak > 0 && { color: '#FB923C' }]}>{streak > 0 ? `${streak}🔥` : '–'}</Text>
            <Text style={styles.shareCardStatLabel}>day streak</Text>
          </View>
        </View>
        {rewardGoal ? (
          <View style={styles.shareCardReward}>
            <Text style={styles.shareCardRewardLabel}>Working towards</Text>
            <Text style={styles.shareCardRewardGoal}>"{rewardGoal}"</Text>
            <View style={styles.shareCardTrack}>
              <View style={[styles.shareCardFill, { width: `${Math.round(pct * 100)}%` }]} />
            </View>
            <Text style={styles.shareCardRewardPts}>{totalPoints} / {target} points</Text>
          </View>
        ) : null}
        <Text style={styles.shareCardBrand}>Tarbiyah · Nightly Muhasabah</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: BG },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  headerTitle:   { fontSize: 17, fontWeight: '800', color: TEXT },
  content:       { paddingHorizontal: 20, paddingBottom: 48, paddingTop: 8 },

  childName:     { fontSize: 20, fontWeight: '800', color: GOLD, marginTop: 10 },

  statsRow:      { flexDirection: 'row', backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER, marginBottom: 16, overflow: 'hidden' },
  statBox:       { flex: 1, alignItems: 'center', paddingVertical: 16 },
  statNum:       { fontSize: 22, fontWeight: '900', color: GOLD },
  statLabel:     { fontSize: 11, color: SUBTEXT, marginTop: 2 },

  card:          { backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 18, marginBottom: 14 },
  cardHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  cardTitle:     { fontSize: 14, fontWeight: '800', color: TEXT },
  editBtn:       { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,209,102,0.1)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  editBtnText:   { fontSize: 12, color: GOLD, fontWeight: '700' },
  feedLinkBtn:   { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,209,102,0.08)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,209,102,0.2)', paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16 },
  feedLinkText:  { flex: 1, fontSize: 14, color: GOLD, fontWeight: '600' },

  goalName:      { fontSize: 16, color: TEXT, fontWeight: '700', fontStyle: 'italic' },

  track:         { height: 12, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 6, overflow: 'hidden' },
  fill:          { height: 12, backgroundColor: GOLD, borderRadius: 6 },

  unlockWrap:    { alignItems: 'center', gap: 8, paddingVertical: 8 },
  unlockEmoji:   { fontSize: 48 },
  unlockTitle:   { fontSize: 20, fontWeight: '900', color: GOLD },
  unlockGoal:    { fontSize: 15, color: TEXT, fontWeight: '700', fontStyle: 'italic', textAlign: 'center' },
  unlockPts:     { fontSize: 12, color: SUBTEXT },
  claimBtn:      { backgroundColor: GREEN, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 32, marginTop: 8 },
  claimBtnText:  { fontSize: 15, fontWeight: '800', color: '#0D2818' },

  inputLabel:    { fontSize: 12, color: SUBTEXT, fontWeight: '600', marginBottom: 6 },
  input:         { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 14, paddingVertical: 12, color: TEXT, fontSize: 15 },

  cancelBtn:     { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: BORDER },
  cancelBtnText: { color: SUBTEXT, fontWeight: '700', fontSize: 14 },
  saveBtn:       { flex: 2, borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: GOLD },
  saveBtnText:   { color: '#0D1B3E', fontWeight: '800', fontSize: 14 },

  noGoalBtn:     { backgroundColor: 'rgba(255,209,102,0.07)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,209,102,0.2)', padding: 16, alignItems: 'center' },
  noGoalText:    { fontSize: 14, color: GOLD, fontWeight: '600', textAlign: 'center', lineHeight: 22 },

  // Share card (rendered off-screen for capture)
  shareCard:          { position: 'absolute', left: -2000, top: 0, width: 360, backgroundColor: '#0D1B3E', borderRadius: 24, padding: 28, alignItems: 'center', gap: 6 },
  shareCardMoon:      { fontSize: 40, marginBottom: 4 },
  shareCardName:      { fontSize: 20, fontWeight: '900', color: GOLD, textAlign: 'center', marginBottom: 8 },
  shareCardStats:     { flexDirection: 'row', width: '100%', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden', marginBottom: 16 },
  shareCardStat:      { flex: 1, alignItems: 'center', paddingVertical: 14 },
  shareCardStatNum:   { fontSize: 24, fontWeight: '900', color: GOLD },
  shareCardStatLabel: { fontSize: 11, color: SUBTEXT, marginTop: 2 },
  shareCardReward:    { width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 16, gap: 6, marginBottom: 8 },
  shareCardRewardLabel: { fontSize: 11, color: SUBTEXT, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  shareCardRewardGoal:  { fontSize: 15, color: TEXT, fontWeight: '700', fontStyle: 'italic' },
  shareCardTrack:     { height: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden', marginTop: 4 },
  shareCardFill:      { height: 8, backgroundColor: GOLD, borderRadius: 4 },
  shareCardRewardPts: { fontSize: 11, color: SUBTEXT },
  shareCardBrand:     { fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 10, letterSpacing: 0.5 },
});
