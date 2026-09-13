import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Animated, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { supabase } from '../utils/supabase';

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
  const pct    = target > 0 ? Math.min(total / target, 1) : 0;
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
      {pct >= 1 && (
        <Text style={styles.unlocked}>🎉 Goal reached! Tell a parent!</Text>
      )}
    </View>
  );
}

export default function MuhasabahRewardsScreen({ navigation, route }) {
  const { child } = route.params ?? {};

  const [totalPoints,  setTotalPoints]  = useState(0);
  const [sessions,     setSessions]     = useState(0);
  const [streak,       setStreak]       = useState(0);
  const [rewardGoal,   setRewardGoal]   = useState('');
  const [rewardTarget, setRewardTarget] = useState('100');
  const [editing,      setEditing]      = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [loading,      setLoading]      = useState(true);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadData();
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  async function loadData() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !child?.id) { setLoading(false); return; }

      const today     = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

      const [sessRes, cfgRes] = await Promise.all([
        supabase
          .from('muhasabah_sessions')
          .select('points_earned, streak_day, session_date')
          .eq('user_id', session.user.id)
          .eq('child_id', child.id)
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
    } catch (e) {
      console.warn('[rewards] loadData:', e);
    } finally {
      setLoading(false);
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
    } catch (e) {
      Alert.alert('Error', 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const target = parseInt(rewardTarget, 10) || 100;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, left: 10, bottom: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={24} color={TEXT} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>🌙 {child?.name?.split(' ')[0]}'s Rewards</Text>
          <View style={{ width: 32 }} />
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

            {editing ? (
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 20 }}>⚙️</Text>
              <View>
                <Text style={styles.cardTitle}>Session Settings</Text>
                <Text style={{ fontSize: 12, color: SUBTEXT, marginTop: 2 }}>Edit reflection areas & questions</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={SUBTEXT} />
          </TouchableOpacity>

          {/* How points work */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>⭐ How points work</Text>
            <View style={{ gap: 10, marginTop: 12 }}>
              {[
                ['Base points', '10 pts per session'],
                ['Slider ratings', 'Up to 32 pts based on scores'],
                ['Repair plan', '+10 pts for setting a repair plan'],
                ['Streak bonus', 'Up to +30 pts for daily streaks'],
              ].map(([label, desc]) => (
                <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: SUBTEXT, flex: 1 }}>{label}</Text>
                  <Text style={{ fontSize: 13, color: GOLD, fontWeight: '700' }}>{desc}</Text>
                </View>
              ))}
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
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

  goalName:      { fontSize: 16, color: TEXT, fontWeight: '700', fontStyle: 'italic' },

  track:         { height: 12, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 6, overflow: 'hidden' },
  fill:          { height: 12, backgroundColor: GOLD, borderRadius: 6 },
  unlocked:      { fontSize: 14, color: GREEN, fontWeight: '800', textAlign: 'center', marginTop: 10 },

  inputLabel:    { fontSize: 12, color: SUBTEXT, fontWeight: '600', marginBottom: 6 },
  input:         { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 14, paddingVertical: 12, color: TEXT, fontSize: 15 },

  cancelBtn:     { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: BORDER },
  cancelBtnText: { color: SUBTEXT, fontWeight: '700', fontSize: 14 },
  saveBtn:       { flex: 2, borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: GOLD },
  saveBtnText:   { color: '#0D1B3E', fontWeight: '800', fontSize: 14 },

  noGoalBtn:     { backgroundColor: 'rgba(255,209,102,0.07)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,209,102,0.2)', padding: 16, alignItems: 'center' },
  noGoalText:    { fontSize: 14, color: GOLD, fontWeight: '600', textAlign: 'center', lineHeight: 22 },
});
