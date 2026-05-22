import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';
import { getFamilyId } from '../utils/familyGoals';
import { getCachedSyncStatus } from '../utils/familySync';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notifyPartner } from '../utils/partnerNotify';

const TYPE_META = {
  accomplishment_race: { emoji: '🔄', color: '#2E7D62', label: 'Habits Race' },
  category_blitz:      { emoji: '🎯', color: '#6366F1', label: 'Category Blitz'       },
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
  if (type === 'accomplishment_race') return `First to ${config.target} habits · ${config.duration_days} days`;
  if (type === 'category_blitz') {
    const dur = config.duration_hours < 1 ? `${Math.round(config.duration_hours * 60)}m` : `${config.duration_hours}h`;
    return `Most ${config.category} · ${dur} window`;
  }
  return '';
}

export default function ChallengeCard({ navigation, onChallenge, focusCount = 0 }) {
  const [challenge,     setChallenge]     = useState(null);
  const [myId,          setMyId]          = useState(null);
  const [myName,        setMyName]        = useState('You');
  const [partnerName,   setPartnerName]   = useState('Partner');
  const [partnerLinked, setPartnerLinked] = useState(false);
  const [partnerSyncOn, setPartnerSyncOn] = useState(true);
  const [myWins,        setMyWins]        = useState(0);
  const [partnerWins,   setPartnerWins]   = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [acting,        setActing]        = useState(false);

  const load = useCallback(async () => {
    try {
      const [{ data: session }, syncStatus, syncVal] = await Promise.all([
        supabase.auth.getSession(),
        getCachedSyncStatus(),
        AsyncStorage.getItem('tarbiyah_partner_sync_on'),
      ]);
      const uid = session?.session?.user?.id;
      setMyId(uid);
      setPartnerSyncOn(syncVal !== 'false');
      setPartnerLinked(!!syncStatus?.linked);
      if (syncStatus?.partner?.name) setPartnerName(syncStatus.partner.name.split(' ')[0]);

      if (!uid) { setLoading(false); return; }

      // Load all-time wins
      const { data: completed } = await supabase
        .from('family_challenges')
        .select('winner_id')
        .or(`challenger_id.eq.${uid},partner_id.eq.${uid}`)
        .in('status', ['completed', 'archived']);

      if (completed) {
        setMyWins(completed.filter(c => c.winner_id === uid).length);
        setPartnerWins(completed.filter(c => c.winner_id && c.winner_id !== uid).length);
      }

      const { data } = await supabase
        .from('family_challenges')
        .select('*')
        .or(`challenger_id.eq.${uid},partner_id.eq.${uid}`)
        .in('status', ['pending', 'active', 'completed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Resolve category blitz winner when time has expired
      if (data?.status === 'active' && data?.type === 'category_blitz' && data?.ends_at && new Date(data.ends_at) < new Date()) {
        const cp = data.challenger_progress ?? 0;
        const pp = data.partner_progress ?? 0;
        if (cp !== pp) {
          const winnerId = cp > pp ? data.challenger_id : data.partner_id;
          await supabase.from('family_challenges')
            .update({ status: 'completed', winner_id: winnerId, updated_at: new Date().toISOString() })
            .eq('id', data.id);
          data.status    = 'completed';
          data.winner_id = winnerId;
        }
      }

      setChallenge(data ?? null);
    } catch {}
    setLoading(false);
  }, []);

  const pollRef    = useRef(null);
  const channelRef = useRef(`challenge_card_${Date.now()}`);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(() => { load(); }, 5000);
  }, [load, stopPolling]);

  useEffect(() => {
    load();

    const sub = supabase
      .channel(channelRef.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'family_challenges' }, () => { load(); })
      .subscribe();

    const appSub = AppState.addEventListener('change', state => {
      if (state === 'active') load();
    });

    return () => {
      supabase.removeChannel(sub);
      appSub.remove();
      stopPolling();
    };
  }, []);

  // Poll every 5s while pending, stop otherwise
  useEffect(() => {
    if (challenge?.status === 'pending') {
      startPolling();
    } else {
      stopPolling();
    }
  }, [challenge?.status]);

  useEffect(() => {
    if (focusCount > 0) load();
  }, [focusCount]);

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
        { screen: 'Home' }
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

  const meta         = challenge ? TYPE_META[challenge.type] : null;
  const isChallenger = challenge?.challenger_id === myId;
  const myProgress   = isChallenger ? (challenge?.challenger_progress ?? 0) : (challenge?.partner_progress ?? 0);
  const prtProgress  = isChallenger ? (challenge?.partner_progress ?? 0) : (challenge?.challenger_progress ?? 0);
  const target       = challenge?.config?.target ?? 1;
  const ended        = challenge?.ends_at && new Date(challenge.ends_at) < new Date();
  const iWon         = challenge?.status === 'completed' && challenge?.winner_id === myId;
  const partnerWon   = challenge?.status === 'completed' && challenge?.winner_id && challenge?.winner_id !== myId;

  if (loading) return null;
  if (!partnerSyncOn || !partnerLinked) return null;

  return (
    <View style={cc.wrap}>
      <View style={cc.sectionHeader}>
        <View style={{ flex: 1 }}>
          <Text style={cc.sectionEyebrow}>FAMILY</Text>
          <Text style={cc.sectionTitle}>Partner Competitions</Text>
        </View>
        {!challenge && (
          <TouchableOpacity style={cc.newBtn} onPress={onChallenge} activeOpacity={0.85}>
            <Ionicons name="add" size={14} color="#FFFFFF" />
            <Text style={cc.newBtnText}>New Challenge</Text>
          </TouchableOpacity>
        )}
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

      {/* Completed */}
      {challenge?.status === 'completed' && (
        <View style={[cc.card, { borderColor: iWon ? '#C9A84C40' : '#9CA3AF40' }]}>
          <View style={cc.cardTop}>
            <Text style={cc.cardEmoji}>{iWon ? '🏆' : '💪'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[cc.cardType, { color: iWon ? '#C9A84C' : '#6B7280' }]}>
                {iWon ? 'Challenge Won!' : `${partnerName} Won`}
              </Text>
              <Text style={cc.cardSummary}>{challengeSummary(challenge.type, challenge.config)}</Text>
            </View>
            <View style={[cc.statusPill, { backgroundColor: iWon ? '#FEF9EE' : '#F3F4F6' }]}>
              <Text style={[cc.statusText, { color: iWon ? '#C9A84C' : '#9CA3AF' }]}>
                {iWon ? '🥇 Winner' : '🥈 Runner-up'}
              </Text>
            </View>
          </View>

          <View style={cc.completedMsg}>
            <Text style={cc.completedText}>
              {iWon
                ? `Ma Shaa Allah! You reached the target first. Well done! 🎉`
                : `${partnerName} reached the target first — great effort, keep it up!`}
            </Text>
          </View>

          <View style={cc.progressSection}>
            <View style={cc.progressRow}>
              <Text style={cc.progressName}>You</Text>
              <View style={cc.progressBarWrap}>
                <View style={[cc.progressBarFill, { width: `${Math.min((myProgress / target) * 100, 100)}%`, backgroundColor: iWon ? '#C9A84C' : '#9CA3AF' }]} />
              </View>
              <Text style={[cc.progressNum, { color: iWon ? '#C9A84C' : '#9CA3AF' }]}>{myProgress}</Text>
            </View>
            <View style={cc.progressRow}>
              <Text style={cc.progressName}>{partnerName}</Text>
              <View style={cc.progressBarWrap}>
                <View style={[cc.progressBarFill, { width: `${Math.min((prtProgress / target) * 100, 100)}%`, backgroundColor: partnerWon ? '#C9A84C' : '#9CA3AF' }]} />
              </View>
              <Text style={cc.progressNum}>{prtProgress}</Text>
            </View>
          </View>

          <TouchableOpacity style={cc.newChallengeBtn} onPress={() => {
            setChallenge(null);
            onChallenge?.();
          }} activeOpacity={0.85}>
            <Text style={cc.newChallengeBtnText}>Start New Challenge 🏆</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* All-time wins card */}
      {partnerLinked && (
        <View style={cc.winsCard}>
          <View style={cc.winsCardHeader}>
            <Ionicons name="trophy" size={13} color="#C9A84C" />
            <Text style={cc.winsCardTitle}>ALL-TIME CHALLENGE WINS</Text>
          </View>
          <View style={cc.winsRow}>
            <View style={cc.winsSide}>
              <Text style={[cc.winsCount, myWins >= partnerWins && cc.winsCountWinner]}>{myWins}</Text>
              <Text style={cc.winsLabel}>You</Text>
            </View>
            <View style={cc.winsDivider} />
            <View style={cc.winsSide}>
              <Text style={[cc.winsCount, partnerWins > myWins && cc.winsCountWinner]}>{partnerWins}</Text>
              <Text style={cc.winsLabel}>{partnerName}</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const cc = StyleSheet.create({
  wrap:          { marginTop: 20 },
  sectionHeader:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  sectionEyebrow: { fontSize: 10, fontWeight: '700', color: '#2E7D62', letterSpacing: 1, marginBottom: 2 },
  sectionTitle:   { fontSize: 16, fontWeight: '800', color: '#1B3D2F' },
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

  winsCard:         { backgroundColor: '#FFFFFF', borderRadius: 16, marginTop: 12, overflow: 'hidden', borderWidth: 1.5, borderColor: '#F5E9C4' },
  winsCardHeader:   { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFBF0', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5E9C4' },
  winsCardTitle:    { fontSize: 10, fontWeight: '700', color: '#B45309', letterSpacing: 1 },
  winsRow:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
  winsSide:         { flex: 1, alignItems: 'center' },
  winsCount:        { fontSize: 32, fontWeight: '800', color: '#D1D5DB', lineHeight: 36 },
  winsCountWinner:  { color: '#C9A84C' },
  winsLabel:        { fontSize: 12, fontWeight: '600', color: '#9CA3AF', marginTop: 4 },
  winsDivider:      { width: 1, height: 40, backgroundColor: '#F0F0F0' },

  completedMsg:      { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12 },
  completedText:     { fontSize: 13, color: '#374151', lineHeight: 20 },
  newChallengeBtn:   { backgroundColor: '#1B3D2F', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  newChallengeBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
