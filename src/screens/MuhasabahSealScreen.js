import React, { useEffect, useRef, useState } from 'react';
import { CommonActions } from '@react-navigation/native';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, SafeAreaView, ScrollView, Image,
} from 'react-native';
import { supabase } from '../utils/supabase';
import { getFamilyId } from '../utils/familyGoals';

const BG      = '#0D1B3E';
const GOLD    = '#FFD166';
const GREEN   = '#4ADE80';
const PURPLE  = '#C084FC';
const TEXT    = '#F8FAFC';
const SUBTEXT = '#94A3B8';
const CARD    = 'rgba(255,255,255,0.07)';
const BORDER  = 'rgba(255,255,255,0.11)';

const CONGRATS = ["Masha'Allah! 🌟", "Subhan'Allah! ✨", "Alhamdulillah! 💫", "Keep it up! 🌙"];

function StarParticle({ delay, x, size, emoji }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 2000 + delay, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.Text style={{
      position: 'absolute', left: x, top: 40, fontSize: size,
      opacity: anim,
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -140] }) }],
    }}>
      {emoji}
    </Animated.Text>
  );
}

const PARTICLES = [
  { delay: 0,   x: '8%',  size: 20, emoji: '⭐' },
  { delay: 300, x: '28%', size: 16, emoji: '✨' },
  { delay: 600, x: '52%', size: 24, emoji: '🌟' },
  { delay: 200, x: '72%', size: 18, emoji: '💫' },
  { delay: 900, x: '88%', size: 14, emoji: '⭐' },
  { delay: 450, x: '18%', size: 14, emoji: '✨' },
  { delay: 750, x: '63%', size: 20, emoji: '💫' },
];

function ChildAvatar({ child, size = 56 }) {
  if (!child) return null;
  return (
    <View style={{ alignItems: 'center', marginBottom: 4 }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: child.color ?? '#1B4D3E', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: GOLD }}>
        {child.photo
          ? <Image source={{ uri: child.photo }} style={{ width: size - 8, height: size - 8, borderRadius: (size - 8) / 2 }} />
          : <Text style={{ fontSize: size * 0.38, fontWeight: '800', color: '#FFF' }}>{(child.name ?? '?')[0].toUpperCase()}</Text>
        }
      </View>
    </View>
  );
}

function RewardBar({ total, target, goal }) {
  const pct      = Math.min(total / target, 1);
  const unlocked = pct >= 1;
  const barAnim    = useRef(new Animated.Value(0)).current;
  const unlockAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (unlocked) {
      Animated.spring(unlockAnim, { toValue: 1, tension: 45, friction: 5, delay: 500, useNativeDriver: true }).start();
    } else {
      Animated.timing(barAnim, { toValue: pct, duration: 1000, delay: 600, useNativeDriver: false }).start();
    }
  }, [pct]);

  if (unlocked) {
    return (
      <Animated.View style={[styles.unlockCard, {
        opacity: unlockAnim,
        transform: [{ scale: unlockAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
      }]}>
        <Text style={styles.unlockEmoji}>🎁</Text>
        <Text style={styles.unlockTitle}>Reward Unlocked!</Text>
        <Text style={styles.unlockGoal}>"{goal}"</Text>
        <Text style={styles.unlockSub}>You've earned it — go tell a parent! 🌟</Text>
      </Animated.View>
    );
  }

  return (
    <View style={styles.rewardCard}>
      <View style={styles.rewardHeader}>
        <Text style={styles.rewardLabel}>🎁 Reward goal</Text>
        <Text style={styles.rewardGoalText}>{goal}</Text>
      </View>
      <View style={styles.rewardTrack}>
        <Animated.View style={[styles.rewardFill, { width: barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
      </View>
      <View style={styles.rewardFooter}>
        <Text style={styles.rewardPts}>⭐ {total} points</Text>
        <Text style={styles.rewardTarget}>{target} to unlock</Text>
      </View>
    </View>
  );
}

export default function MuhasabahSealScreen({ navigation, route }) {
  const { child, points = 0, streakDay = 1, reminder, trialMode = false } = route.params ?? {};

  const [totalPoints,  setTotalPoints]  = useState(0);
  const [rewardGoal,   setRewardGoal]   = useState(null);
  const [rewardTarget, setRewardTarget] = useState(100);
  const [loading,      setLoading]      = useState(!trialMode);

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const glowAnim  = useRef(new Animated.Value(0)).current;
  const ptAnim    = useRef(new Animated.Value(0)).current;
  const congrats  = useRef(CONGRATS[Math.floor(Math.random() * CONGRATS.length)]).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 6, useNativeDriver: true }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 1400, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0, duration: 1400, useNativeDriver: true }),
        ])
      ),
    ]).start();
    Animated.timing(ptAnim, { toValue: 1, duration: 800, delay: 400, useNativeDriver: true }).start();
    if (!trialMode) loadStats();
  }, []);

  async function loadStats() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !child?.id) { setLoading(false); return; }

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
          .select('points_earned')
          .in('user_id', userIds)
          .in('child_id', childIds),
        supabase
          .from('muhasabah_config')
          .select('reward_goal, reward_points_target')
          .eq('user_id', session.user.id)
          .eq('child_id', child.id)
          .maybeSingle(),
      ]);

      const total = (sessRes.data ?? []).reduce((s, r) => s + (r.points_earned ?? 0), 0);
      setTotalPoints(total);
      if (cfgRes.data?.reward_goal)           setRewardGoal(cfgRes.data.reward_goal);
      if (cfgRes.data?.reward_points_target)  setRewardTarget(cfgRes.data.reward_points_target);
    } catch (e) {
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {PARTICLES.map((p, i) => <StarParticle key={i} {...p} />)}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Big star */}
        <Animated.Text style={[styles.bigStar, {
          transform: [
            { scale: scaleAnim },
            { rotate: glowAnim.interpolate({ inputRange: [0, 1], outputRange: ['-5deg', '5deg'] }) },
          ],
        }]}>
          🌟
        </Animated.Text>

        <Text style={styles.congrats}>{trialMode ? 'Practice complete! 🧪' : congrats}</Text>

        {/* Child avatar + name */}
        {child && (
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <ChildAvatar child={child} size={68} />
            <Text style={styles.childName}>{child.name}</Text>
          </View>
        )}

        {/* Trial notice */}
        {trialMode && (
          <View style={styles.trialNotice}>
            <Text style={styles.trialNoticeText}>This was a practice run — nothing was saved.</Text>
          </View>
        )}

        {/* Points */}
        <Animated.View style={[styles.pointsCard, {
          opacity: ptAnim,
          transform: [{ translateY: ptAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
        }]}>
          <Text style={styles.pointsLabel}>{trialMode ? 'You would have earned' : 'Tonight you earned'}</Text>
          <Text style={styles.pointsNum}>+{points}</Text>
          <Text style={styles.pointsUnit}>points ✨</Text>
        </Animated.View>

        {/* Cumulative total (real sessions only) */}
        {!trialMode && !loading && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>⭐ Total points:</Text>
            <Text style={styles.totalNum}>{totalPoints}</Text>
          </View>
        )}

        {/* Streak (real sessions only) */}
        {!trialMode && streakDay > 0 && (
          <View style={styles.streakRow}>
            <Text style={styles.streakFlame}>🔥</Text>
            <Text style={styles.streakText}>{streakDay} {streakDay === 1 ? 'day' : 'days'} in a row!</Text>
            {streakDay >= 7 && <Text style={styles.streakBadge}> 🏆 Week streak!</Text>}
          </View>
        )}

        {/* Reward progress (real sessions only) */}
        {!trialMode && rewardGoal && (
          <RewardBar total={totalPoints} target={rewardTarget} goal={rewardGoal} />
        )}

        {/* Done */}
        <TouchableOpacity
          style={styles.doneBtn}
          onPress={() => trialMode
            ? navigation.navigate('MuhasabahWizard')
            : navigation.dispatch(CommonActions.reset({
                index: 0,
                routes: [{ name: 'Tabs', params: { screen: 'Family', params: { tab: 'childWins' } } }],
              }))
          }
          activeOpacity={0.85}
        >
          <Text style={styles.doneBtnText}>{trialMode ? 'Practice Complete 🌙' : 'Alhamdulillah! 🌙'}</Text>
        </TouchableOpacity>
        <Text style={styles.seeYou}>{trialMode ? 'Start a real session anytime from the Child Growth tab.' : 'See you tomorrow for muhasabah 🤲'}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: BG },
  content:        { alignItems: 'center', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 48 },

  bigStar:        { fontSize: 88, marginBottom: 8 },
  congrats:       { fontSize: 26, fontWeight: '900', color: TEXT, textAlign: 'center', marginBottom: 16 },
  childName:      { fontSize: 18, fontWeight: '700', color: GOLD, marginTop: 8 },

  pointsCard:     { backgroundColor: 'rgba(255,209,102,0.1)', borderWidth: 2, borderColor: 'rgba(255,209,102,0.35)', borderRadius: 20, paddingVertical: 22, paddingHorizontal: 48, alignItems: 'center', marginBottom: 14, width: '100%' },
  pointsLabel:    { fontSize: 13, color: SUBTEXT, fontWeight: '600', marginBottom: 4 },
  pointsNum:      { fontSize: 52, fontWeight: '900', color: GOLD, lineHeight: 60 },
  pointsUnit:     { fontSize: 14, color: GOLD, fontWeight: '700' },

  totalRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: CARD, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12, marginBottom: 12, width: '100%', borderWidth: 1, borderColor: BORDER },
  totalLabel:     { fontSize: 14, color: SUBTEXT, flex: 1 },
  totalNum:       { fontSize: 20, fontWeight: '900', color: GOLD },

  streakRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,100,30,0.12)', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10, marginBottom: 16 },
  streakFlame:    { fontSize: 20 },
  streakText:     { fontSize: 14, fontWeight: '700', color: '#FB923C' },
  streakBadge:    { fontSize: 12, fontWeight: '700', color: GOLD },

  rewardCard:     { backgroundColor: CARD, borderWidth: 1, borderColor: 'rgba(255,209,102,0.2)', borderRadius: 16, padding: 16, width: '100%', marginBottom: 14 },
  rewardHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  rewardLabel:    { fontSize: 13, color: SUBTEXT, fontWeight: '600' },
  rewardGoalText: { fontSize: 13, color: GOLD, fontWeight: '700' },
  rewardTrack:    { height: 10, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 5, overflow: 'hidden', marginBottom: 8 },
  rewardFill:     { height: 10, backgroundColor: GOLD, borderRadius: 5 },
  rewardFooter:   { flexDirection: 'row', justifyContent: 'space-between' },
  rewardPts:      { fontSize: 12, color: TEXT, fontWeight: '600' },
  rewardTarget:   { fontSize: 12, color: SUBTEXT },

  unlockCard:  { backgroundColor: 'rgba(255,209,102,0.12)', borderWidth: 2, borderColor: GOLD, borderRadius: 24, paddingVertical: 28, paddingHorizontal: 24, width: '100%', alignItems: 'center', marginBottom: 14, gap: 8 },
  unlockEmoji: { fontSize: 56 },
  unlockTitle: { fontSize: 24, fontWeight: '900', color: GOLD },
  unlockGoal:  { fontSize: 16, color: TEXT, fontWeight: '700', fontStyle: 'italic', textAlign: 'center', lineHeight: 24 },
  unlockSub:   { fontSize: 13, color: GREEN, fontWeight: '600', textAlign: 'center', marginTop: 4 },

  reminderTeaser: { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 16, padding: 16, width: '100%', marginBottom: 12 },
  reminderLabel:  { fontSize: 12, color: PURPLE, fontWeight: '700', marginBottom: 8 },
  reminderText:   { fontSize: 14, color: TEXT, lineHeight: 22, fontStyle: 'italic' },
  reminderSource: { fontSize: 12, color: GOLD, marginTop: 8, fontWeight: '600' },

  encourageRow:   { backgroundColor: 'rgba(74,222,128,0.07)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.2)', borderRadius: 16, padding: 16, width: '100%', marginBottom: 24 },
  encourageText:  { fontSize: 14, color: TEXT, lineHeight: 22 },

  doneBtn:        { backgroundColor: GOLD, borderRadius: 16, paddingVertical: 18, paddingHorizontal: 48, width: '100%', alignItems: 'center', marginBottom: 16 },
  doneBtnText:    { fontSize: 18, fontWeight: '900', color: '#0D1B3E' },
  seeYou:         { fontSize: 16, color: SUBTEXT, fontStyle: 'italic', textAlign: 'center', marginTop: 4 },

  trialNotice:    { backgroundColor: 'rgba(192,132,252,0.1)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(192,132,252,0.25)', paddingVertical: 10, paddingHorizontal: 18, marginBottom: 14 },
  trialNoticeText: { fontSize: 13, color: PURPLE, fontWeight: '600', textAlign: 'center' },
});
