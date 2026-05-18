import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';
import { getFamilyId } from '../utils/familyGoals';
import { getCachedSyncStatus } from '../utils/familySync';
import { notifyPartner } from '../utils/partnerNotify';

const TYPE_META = {
  accomplishment_race: { emoji: '🌱', color: '#2E7D62', label: 'Accomplishment Race' },
  streak:              { emoji: '⚡', color: '#F59E0B', label: 'Streak Challenge'     },
  category_blitz:      { emoji: '🎯', color: '#6366F1', label: 'Category Blitz'       },
  goal_sprint:         { emoji: '🏃', color: '#EC4899', label: 'Family Goal Sprint'   },
};

function timeLeft(endsAt) {
  if (!endsAt) return null;
  const diff = new Date(endsAt) - Date.now();
  if (diff <= 0) return 'Ended';
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h left`;
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

function challengeSummary(type, config) {
  if (type === 'accomplishment_race') return `First to ${config.target} accomplishments · ${config.duration_days} days`;
  if (type === 'streak')              return `Daily ${config.category} streak · ${config.duration_days} days`;
  if (type === 'category_blitz')      return `Most ${config.category} · ${config.duration_hours}h window`;
  if (type === 'goal_sprint')         return `"${config.goal_label ?? 'Goal'}" × ${config.target} · ${config.duration_days} days`;
  return '';
}

export default function ChallengeCard({ navigation, onChallenge }) {
  const [challenge,  setChallenge]  = useState(null);
  const [myId,       setMyId]       = useState(null);
  const [myName,     setMyName]     = useState('You');
  const [partnerName, setPartnerName] = useState('Partner');
  const [loading,    setLoading]    = useState(true);
  const [acting,     setActing]     = useState(false);

  const load = useCallback(async () => {
    try {
      const [{ data: session }, syncStatus, familyId] = await Promise.all([
        supabase.auth.getSession(),
        getCachedSyncStatus(),
        getFamilyId(),
      ]);
      const uid = session?.session?.user?.id;
      setMyId(uid);
      if (syncStatus?.partner?.name) setPartnerName(syncStatus.partner.name.split(' ')[0]);

      const { data } = await supabase
        .from('family_challenges')
        .select('*')
        .eq('family_id', familyId)
        .in('status', ['pending', 'active'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setChallenge(data ?? null);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, []);

  async function accept() {
    if (!challenge) return;
    setActing(true);
    try {
      const endsAt = challenge.config.duration_hours
        ? new Date(Date.now() + challenge.config.duration_hours * 3600000).toISOString()
        : new Date(Date.now() + (challenge.config.duration_days ?? 7) * 86400000).toISOString();

      await supabase.from('family_challenges')
        .update({ status: 'active', ends_at: endsAt, updated_at: new Date().toISOString() })
        .eq('id', challenge.id);

      await notifyPartner(
        `${myName} accepted your challenge! 🏆`,
        `${TYPE_META[challenge.type]?.label} is now live — let's go!`,
        { screen: 'Dashboards' }
      );
      setChallenge(prev => ({ ...prev, status: 'active', ends_at: endsAt }));
    } catch {}
    setActing(false);
  }

  async function decline() {
    if (!challenge) return;
    setActing(true);
    try {
      await supabase.from('family_challenges')
        .update({ status: 'declined', updated_at: new Date().toISOString() })
        .eq('id', challenge.id);
      setChallenge(null);
    } catch {}
    setActing(false);
  }

  async function abandon() {
    if (!challenge) return;
    setActing(true);
    try {
      await supabase.from('family_challenges')
        .update({ status: 'declined', updated_at: new Date().toISOString() })
        .eq('id', challenge.id);
      setChallenge(null);
    } catch {}
    setActing(false);
  }

  const meta = challenge ? TYPE_META[challenge.type] : null;
  const isChallenger = challenge?.challenger_id === myId;
  const myProgress  = isChallenger ? (challenge?.challenger_progress ?? 0) : (challenge?.partner_progress ?? 0);
  const prtProgress = isChallenger ? (challenge?.partner_progress ?? 0) : (challenge?.challenger_progress ?? 0);
  const target = challenge?.config?.target ?? 1;
  const ended  = challenge?.ends_at && new Date(challenge.ends_at) < new Date();

  if (loading) return null;

  return (
    <View style={cc.wrap}>
      <View style={cc.sectionHeader}>
        <Text style={cc.eyebrow}>PARTNER CHALLENGE</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={cc.sectionTitle}>Challenge</Text>
          {!challenge && (
            <TouchableOpacity
              style={cc.newBtn}
              onPress={onChallenge}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={14} color="#FFFFFF" />
              <Text style={cc.newBtnText}>New Challenge</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* No active challenge */}
      {!challenge && (
        <TouchableOpacity style={cc.emptyCard} onPress={onChallenge} activeOpacity={0.8}>
          <Text style={cc.emptyEmoji}>🏆</Text>
          <Text style={cc.emptyTitle}>No active challenge</Text>
          <Text style={cc.emptySub}>Challenge your partner to a friendly competition</Text>
          <View style={cc.emptyBtn}>
            <Text style={cc.emptyBtnText}>Start a challenge →</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Pending — waiting for partner to accept */}
      {challenge?.status === 'pending' && (
        <View style={[cc.card, { borderColor: meta?.color + '40' }]}>
          <View style={cc.cardTop}>
            <Text style={cc.cardEmoji}>{meta?.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[cc.cardType, { color: meta?.color }]}>{meta?.label}</Text>
              <Text style={cc.cardSummary}>{challengeSummary(challenge.type, challenge.config)}</Text>
            </View>
            <View style={[cc.statusPill, { backgroundColor: '#FEF9EE' }]}>
              <Text style={[cc.statusText, { color: '#B99A3A' }]}>⏳ Pending</Text>
            </View>
          </View>

          {isChallenger ? (
            <View style={cc.pendingRow}>
              <Ionicons name="time-outline" size={15} color="#9CA3AF" />
              <Text style={cc.pendingText}>Waiting for {partnerName} to accept…</Text>
              <TouchableOpacity onPress={abandon} disabled={acting} style={{ marginLeft: 'auto' }}>
                <Text style={cc.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={cc.actionRow}>
              <TouchableOpacity style={cc.acceptBtn} onPress={accept} disabled={acting} activeOpacity={0.85}>
                {acting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={cc.acceptBtnText}>Accept 🏆</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={cc.declineBtn} onPress={decline} disabled={acting} activeOpacity={0.8}>
                <Text style={cc.declineBtnText}>Decline</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Active — in progress */}
      {challenge?.status === 'active' && (
        <View style={[cc.card, { borderColor: meta?.color + '40' }]}>
          <View style={cc.cardTop}>
            <Text style={cc.cardEmoji}>{meta?.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[cc.cardType, { color: meta?.color }]}>{meta?.label}</Text>
              <Text style={cc.cardSummary}>{challengeSummary(challenge.type, challenge.config)}</Text>
            </View>
            <View style={[cc.statusPill, { backgroundColor: meta?.color + '15' }]}>
              <Text style={[cc.statusText, { color: meta?.color }]}>
                {ended ? '🏁 Ended' : timeLeft(challenge.ends_at)}
              </Text>
            </View>
          </View>

          {/* Progress */}
          <View style={cc.progressSection}>
            <View style={cc.progressRow}>
              <Text style={cc.progressName}>You</Text>
              <View style={cc.progressBarWrap}>
                <View style={[cc.progressBarFill, { width: `${Math.min((myProgress / target) * 100, 100)}%`, backgroundColor: meta?.color }]} />
              </View>
              <Text style={[cc.progressNum, { color: meta?.color }]}>{myProgress}</Text>
            </View>
            <View style={cc.progressRow}>
              <Text style={cc.progressName}>{partnerName}</Text>
              <View style={cc.progressBarWrap}>
                <View style={[cc.progressBarFill, { width: `${Math.min((prtProgress / target) * 100, 100)}%`, backgroundColor: '#9CA3AF' }]} />
              </View>
              <Text style={cc.progressNum}>{prtProgress}</Text>
            </View>
            <Text style={cc.targetLabel}>Target: {target}</Text>
          </View>

          <TouchableOpacity onPress={abandon} disabled={acting} style={cc.abandonRow}>
            <Text style={cc.cancelText}>Abandon challenge</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const cc = StyleSheet.create({
  wrap:          { marginTop: 20 },
  sectionHeader: { marginBottom: 12 },
  eyebrow:       { fontSize: 10, fontWeight: '700', color: '#2E7D62', letterSpacing: 1, marginBottom: 2 },
  sectionTitle:  { fontSize: 16, fontWeight: '800', color: '#1A1A2E' },
  newBtn:        { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1B3D2F', borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6 },
  newBtnText:    { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },

  emptyCard:   { backgroundColor: '#F9FAFB', borderRadius: 18, padding: 24, alignItems: 'center', borderWidth: 1.5, borderColor: '#F0F0F0', borderStyle: 'dashed', gap: 6 },
  emptyEmoji:  { fontSize: 36, marginBottom: 4 },
  emptyTitle:  { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  emptySub:    { fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 19 },
  emptyBtn:    { marginTop: 4 },
  emptyBtnText:{ fontSize: 13, fontWeight: '700', color: '#2E7D62' },

  card:        { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, borderWidth: 1.5, borderColor: '#F0F0F0', gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 },
  cardTop:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardEmoji:   { fontSize: 28 },
  cardType:    { fontSize: 14, fontWeight: '800', marginBottom: 3 },
  cardSummary: { fontSize: 12, color: '#6B7280', lineHeight: 17 },
  statusPill:  { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  statusText:  { fontSize: 11, fontWeight: '700' },

  pendingRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pendingText: { fontSize: 13, color: '#9CA3AF', flex: 1 },
  cancelText:  { fontSize: 12, color: '#9CA3AF', textDecorationLine: 'underline' },

  actionRow:   { flexDirection: 'row', gap: 10 },
  acceptBtn:   { flex: 1, backgroundColor: '#1B3D2F', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  acceptBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  declineBtn:  { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  declineBtnText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },

  progressSection: { gap: 10 },
  progressRow:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressName:    { width: 56, fontSize: 12, fontWeight: '600', color: '#6B7280' },
  progressBarWrap: { flex: 1, height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: 8, borderRadius: 4 },
  progressNum:     { width: 28, fontSize: 15, fontWeight: '800', color: '#9CA3AF', textAlign: 'right' },
  targetLabel:     { fontSize: 11, color: '#9CA3AF', textAlign: 'right' },

  abandonRow:  { alignItems: 'center' },
});
