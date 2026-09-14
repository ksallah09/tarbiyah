import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Share,
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert, Keyboard,
} from 'react-native';

let captureRef = null;
try { captureRef = require('react-native-view-shot').captureRef; } catch {}
let Sharing = null;
try { Sharing = require('expo-sharing'); } catch {}
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';
import { getFamilyId } from '../utils/familyGoals';
import { getCachedSyncStatus } from '../utils/familySync';
import { notifyPartner } from '../utils/partnerNotify';
import { MANNERS } from '../components/MannerGarden';
import { getAllChildProfiles, updateChildProfile } from '../utils/childProfiles';

const BG      = '#F4F6F9';
const WHITE   = '#FFFFFF';
const TEXT    = '#111827';
const SUB     = '#6B7280';
const BORDER  = '#E5E7EB';

const TYPE_META = {
  accomplishment: { label: 'Accomplishment', color: '#1B3D2F', bg: '#EDF7F2', dot: '#22C55E' },
  reflection:     { label: 'Reflection',     color: '#0D1B3E', bg: '#EEF2FF', dot: '#818CF8' },
  incident:       { label: 'Difficult Moment', color: '#92400E', bg: '#FEF3C7', dot: '#F59E0B' },
};

const EMOJI_SCALE  = ['😔', '😐', '🙂', '😊', '🌟'];
const EMOJI_LABELS = ['Needs work', 'A little', 'Pretty good', 'Really good', 'Amazing!'];
const CAT_MAP = {
  salah:    { label: 'Salah',    emoji: '🙏' },
  quran:    { label: 'Quran',    emoji: '📖' },
  kindness: { label: 'Kindness', emoji: '💝' },
  honesty:  { label: 'Honesty',  emoji: '✨' },
  helping:  { label: 'Helping',  emoji: '🤝' },
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  // If already a full ISO timestamp don't append time, otherwise treat as date-only
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  const today = new Date(); today.setHours(0,0,0,0);
  const itemDay = new Date(d); itemDay.setHours(0,0,0,0);
  const diff = Math.floor((today - itemDay) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7)  return `${diff} days ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function Avatar({ name, color, photo, size = 38 }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color ?? '#2E7D62', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {photo
        ? <Image source={{ uri: photo }} style={{ width: size, height: size }} contentFit="cover" cachePolicy="memory-disk" />
        : <Text style={{ fontSize: size * 0.4, fontWeight: '800', color: '#FFF' }}>{(name ?? '?')[0].toUpperCase()}</Text>
      }
    </View>
  );
}

function TypeBadge({ type }) {
  const m = TYPE_META[type];
  if (!m) return null;
  return (
    <View style={[s.typeBadge, { backgroundColor: m.bg }]}>
      <View style={[s.typeDot, { backgroundColor: m.dot }]} />
      <Text style={[s.typeBadgeText, { color: m.color }]}>{m.label}</Text>
    </View>
  );
}

function AccomplishmentCard({ item, myName, onLove }) {
  const manner   = MANNERS?.find?.(m => m.key === item.manner) ?? { emoji: '⭐', label: item.manner };
  const loved    = (item.loved_by ?? []).includes(myName);
  const loveCount = (item.loved_by ?? []).length;

  return (
    <View style={s.cardBody}>
      <View style={s.deedRow}>
        <Text style={s.deedEmoji}>{manner.emoji}</Text>
        <Text style={s.deedLabel}>{manner.label}</Text>
      </View>
      {!!item.note && (
        <Text style={s.quoteText}>"{item.note}"</Text>
      )}
      <View style={s.reactionRow}>
        <TouchableOpacity style={[s.reactionBtn, loved && s.reactionBtnActive]} onPress={() => onLove(item)} activeOpacity={0.75}>
          <Ionicons name={loved ? 'heart' : 'heart-outline'} size={16} color={loved ? '#EF4444' : SUB} />
          <Text style={[s.reactionText, loved && { color: '#EF4444' }]}>Love{loveCount > 0 ? ` · ${loveCount}` : ''}</Text>
        </TouchableOpacity>
        {loveCount > 0 && (
          <Text style={s.reactionNames} numberOfLines={1}>{(item.loved_by ?? []).join(' & ')} loved this</Text>
        )}
      </View>
    </View>
  );
}

function ReflectionCard({ item, myName, onLove, childColor }) {
  const loved      = (item.loved_by ?? []).includes(myName);
  const loveCount  = (item.loved_by ?? []).length;
  const ratings    = item.slider_ratings ?? {};
  const ratingKeys = Object.keys(ratings);
  const shareCardRef = useRef(null);
  const [sharing, setSharing] = useState(false);

  async function handleShare() {
    if (sharing) return;
    setSharing(true);
    try {
      if (captureRef) {
        const uri = await captureRef(shareCardRef, { format: 'jpg', quality: 0.95 });
        const canShare = Sharing && await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', dialogTitle: 'Share Reflection' });
        } else {
          await Share.share({ message: `${item.child_name}'s Nightly Muhasabah · ${item.points_earned ?? 0} pts · Day ${item.streak_day ?? 1} streak\n\nShared from Tarbiyah` });
        }
      } else {
        await Share.share({ message: `${item.child_name}'s Nightly Muhasabah · ${item.points_earned ?? 0} pts · Day ${item.streak_day ?? 1} streak\n\nShared from Tarbiyah` });
      }
    } catch {}
    setSharing(false);
  }

  return (
    <View style={s.cardBody}>
      {/* Points + streak */}
      <View style={s.reflectionStats}>
        <View style={s.reflectionStat}>
          <Text style={s.reflectionStatNum}>{item.points_earned ?? 0}</Text>
          <Text style={s.reflectionStatLabel}>points</Text>
        </View>
        {(item.streak_day ?? 0) > 0 && (
          <View style={[s.reflectionStat, { borderLeftWidth: 1, borderLeftColor: '#E5E7EB', paddingLeft: 14 }]}>
            <Text style={[s.reflectionStatNum, { color: '#FB923C' }]}>{item.streak_day}🔥</Text>
            <Text style={s.reflectionStatLabel}>streak</Text>
          </View>
        )}
      </View>

      {/* Slider ratings */}
      {ratingKeys.length > 0 && (
        <View style={s.ratingsWrap}>
          {ratingKeys.map(key => {
            const cat = CAT_MAP[key] ?? { emoji: '📌', label: key };
            const idx = ratings[key];
            return (
              <View key={key} style={s.ratingPill}>
                <Text style={s.ratingPillEmoji}>{cat.emoji}</Text>
                <Text style={s.ratingPillLabel}>{cat.label}</Text>
                <Text style={s.ratingPillEmoji}>{EMOJI_SCALE[idx] ?? '?'}</Text>
                <Text style={[s.ratingPillValue, { color: idx >= 3 ? '#16A34A' : idx >= 2 ? '#D97706' : '#DC2626' }]}>
                  {EMOJI_LABELS[idx] ?? ''}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Written answers */}
      {!!item.didnt_do_well && (
        <View style={s.answerBlock}>
          <Text style={s.answerLabel}>What they found hard</Text>
          <Text style={s.answerText}>"{item.didnt_do_well}"</Text>
        </View>
      )}
      {!!item.repair_plan && (
        <View style={[s.answerBlock, { borderLeftColor: '#F59E0B' }]}>
          <Text style={s.answerLabel}>How they'll repair it</Text>
          <Text style={s.answerText}>"{item.repair_plan}"</Text>
        </View>
      )}
      {!!item.do_better && (
        <View style={[s.answerBlock, { borderLeftColor: '#818CF8' }]}>
          <Text style={s.answerLabel}>Tomorrow's goal</Text>
          <Text style={s.answerText}>"{item.do_better}"</Text>
        </View>
      )}
      {(item.custom_answers ?? []).filter(a => a.answer).map((a, i) => (
        <View key={i} style={[s.answerBlock, { borderLeftColor: '#06B6D4' }]}>
          <Text style={s.answerLabel}>{a.question}</Text>
          <Text style={s.answerText}>"{a.answer}"</Text>
        </View>
      ))}

      <View style={s.reactionRow}>
        <TouchableOpacity style={[s.reactionBtn, loved && s.reactionBtnActive]} onPress={() => onLove(item)} activeOpacity={0.75}>
          <Ionicons name={loved ? 'heart' : 'heart-outline'} size={16} color={loved ? '#EF4444' : SUB} />
          <Text style={[s.reactionText, loved && { color: '#EF4444' }]}>Love{loveCount > 0 ? ` · ${loveCount}` : ''}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.reactionBtn} onPress={handleShare} activeOpacity={0.75} disabled={sharing}>
          <Ionicons name="share-outline" size={16} color={SUB} />
          <Text style={s.reactionText}>Share</Text>
        </TouchableOpacity>
        {loveCount > 0 && (
          <Text style={s.reactionNames} numberOfLines={1}>{(item.loved_by ?? []).join(' & ')} loved this</Text>
        )}
      </View>

      {/* Off-screen share card */}
      <View style={s.shareCardWrap} pointerEvents="none">
        <View ref={shareCardRef} style={s.shareCard} collapsable={false}>
          <View style={s.shareCardHeader}>
            <View style={[s.shareCardAvatar, { backgroundColor: childColor ?? '#2E7D62' }]}>
              <Text style={s.shareCardAvatarText}>{(item.child_name ?? '?')[0].toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={s.shareCardName}>{item.child_name}</Text>
              <Text style={s.shareCardDate}>Nightly Muhasabah · {formatDate(item._date)}</Text>
            </View>
            <Text style={{ fontSize: 22 }}>🌙</Text>
          </View>

          <View style={s.shareCardStats}>
            <View style={s.shareCardStat}>
              <Text style={s.shareCardStatNum}>{item.points_earned ?? 0}</Text>
              <Text style={s.shareCardStatLabel}>pts</Text>
            </View>
            {(item.streak_day ?? 0) > 0 && (
              <View style={[s.shareCardStat, { borderLeftWidth: 1, borderLeftColor: '#E5E7EB', paddingLeft: 14 }]}>
                <Text style={[s.shareCardStatNum, { color: '#FB923C' }]}>{item.streak_day}🔥</Text>
                <Text style={s.shareCardStatLabel}>streak</Text>
              </View>
            )}
          </View>

          {ratingKeys.length > 0 && (
            <View style={s.shareCardRatings}>
              {ratingKeys.map(key => {
                const cat = CAT_MAP[key] ?? { emoji: '📌', label: key };
                const idx = ratings[key];
                return (
                  <View key={key} style={s.shareCardPill}>
                    <Text style={{ fontSize: 12 }}>{cat.emoji}</Text>
                    <Text style={s.shareCardPillLabel}>{cat.label}</Text>
                    <Text style={{ fontSize: 12 }}>{EMOJI_SCALE[idx] ?? ''}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {!!item.didnt_do_well && (
            <View style={[s.shareCardAnswer, { borderLeftColor: '#22C55E' }]}>
              <Text style={s.shareCardAnswerLabel}>What I found hard</Text>
              <Text style={s.shareCardAnswerText}>"{item.didnt_do_well}"</Text>
            </View>
          )}
          {!!item.repair_plan && (
            <View style={[s.shareCardAnswer, { borderLeftColor: '#F59E0B' }]}>
              <Text style={s.shareCardAnswerLabel}>How they'll repair it</Text>
              <Text style={s.shareCardAnswerText}>"{item.repair_plan}"</Text>
            </View>
          )}
          {!!item.do_better && (
            <View style={[s.shareCardAnswer, { borderLeftColor: '#818CF8' }]}>
              <Text style={s.shareCardAnswerLabel}>Tomorrow's goal</Text>
              <Text style={s.shareCardAnswerText}>"{item.do_better}"</Text>
            </View>
          )}
          {(item.custom_answers ?? []).filter(a => a.answer).map((a, i) => (
            <View key={i} style={[s.shareCardAnswer, { borderLeftColor: '#06B6D4' }]}>
              <Text style={s.shareCardAnswerLabel}>{a.question}</Text>
              <Text style={s.shareCardAnswerText}>"{a.answer}"</Text>
            </View>
          ))}

          <View style={s.shareCardBrand}>
            <Text style={s.shareCardBrandText}>Tarbiyah · Nightly Muhasabah</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function IncidentCard({ item, myName, onAcknowledge }) {
  const acked    = (item.acknowledges ?? []).includes(myName);
  const ackCount = (item.acknowledges ?? []).length;

  return (
    <View style={s.cardBody}>
      <Text style={s.incidentText}>{item.text}</Text>
      {!!item.consequence && (
        <View style={s.consequenceRow}>
          <Ionicons name="arrow-forward-circle-outline" size={14} color={SUB} />
          <Text style={s.consequenceText}>{item.consequence}</Text>
        </View>
      )}
      <View style={s.reactionRow}>
        <TouchableOpacity style={[s.reactionBtn, acked && s.reactionBtnAck]} onPress={() => onAcknowledge(item)} activeOpacity={0.75}>
          <Text style={{ fontSize: 15 }}>🤲</Text>
          <Text style={[s.reactionText, acked && { color: '#92400E' }]}>
            Acknowledge{ackCount > 0 ? ` · ${ackCount}` : ''}
          </Text>
        </TouchableOpacity>
        {ackCount > 0 && (
          <Text style={s.reactionNames} numberOfLines={1}>{(item.acknowledges ?? []).join(' & ')} acknowledged</Text>
        )}
      </View>
    </View>
  );
}

export default function FamilyFeedScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [feed,          setFeed]          = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [myName,        setMyName]        = useState('');
  const [childMap,      setChildMap]      = useState({});
  const [children,      setChildren]      = useState([]);
  const [familyTrees,   setFamilyTrees]   = useState([]);
  const [partnerLinked, setPartnerLinked] = useState(false);
  const [myUserId,      setMyUserId]      = useState(null);
  const [partnerName,   setPartnerName]   = useState('');
  // compose
  const [composeOpen,   setComposeOpen]   = useState(false);
  const [winPickerOpen, setWinPickerOpen] = useState(false);
  const [logModalStep,  setLogModalStep]  = useState(null);
  const [logChild,      setLogChild]      = useState(null);
  const [logText,       setLogText]       = useState('');
  const [logConsequence,setLogConsequence]= useState('');
  const [logSaving,     setLogSaving]     = useState(false);
  const channelRef = useRef(null);

  useFocusEffect(useCallback(() => {
    // Mark the feed as seen so HomeScreen can clear its unread badge
    AsyncStorage.setItem('tarbiyah_feed_last_viewed', new Date().toISOString()).catch(() => {});
    loadAll();
    return () => {
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
    };
  }, []));

  async function loadAll(isRefresh = false) {
    if (!isRefresh) setLoading(true);
    try {
      const [{ data: { session } }, profileRaw, syncStatus] = await Promise.all([
        supabase.auth.getSession(),
        AsyncStorage.getItem('tarbiyah_profile'),
        getCachedSyncStatus(),
      ]);
      if (!session) return;

      const name = profileRaw ? (JSON.parse(profileRaw).name ?? '') : '';
      setMyName(name);

      const familyId  = await getFamilyId();
      const partnerId = syncStatus?.partner?.userId ?? null;
      const userIds   = [session.user.id, partnerId].filter(Boolean);

      setPartnerLinked(!!syncStatus?.linked);
      setMyUserId(session.user.id);
      setPartnerName(syncStatus?.partner?.name?.split(' ')[0] ?? 'Partner');

      const [actRes, sessRes, momRes, childProfiles, treesRes] = await Promise.all([
        supabase
          .from('child_garden_actions')
          .select('id, child_id, child_name, manner, note, date, loved_by, user_id')
          .eq('family_id', familyId)
          .order('date', { ascending: false })
          .limit(60),
        supabase
          .from('muhasabah_sessions')
          .select('id, child_id, child_name, session_date, points_earned, streak_day, slider_ratings, didnt_do_well, repair_plan, do_better, custom_answers, loved_by, user_id')
          .in('user_id', userIds)
          .order('session_date', { ascending: false })
          .limit(60),
        supabase
          .from('family_moments')
          .select('id, child_id, child_name, child_color, date, text, consequence, acknowledges, user_id')
          .eq('family_id', familyId)
          .eq('type', 'incident')
          .order('date', { ascending: false })
          .limit(40),
        getAllChildProfiles(),
        supabase.from('family_trees').select('*').eq('family_id', familyId),
      ]);

      setChildren(childProfiles ?? []);
      setFamilyTrees((treesRes.data ?? []).filter(t => !t.linked_tree_id));

      // Build child color map from local profiles
      const map = {};
      (childProfiles ?? []).forEach(c => { if (c.id) map[c.id] = c.color; });
      // Also pick up colors written on family_moments rows
      (momRes.data ?? []).forEach(r => { if (r.child_id && r.child_color) map[r.child_id] = r.child_color; });
      setChildMap(map);

      const merged = [
        ...(actRes.data ?? []).map(a => ({ ...a, _type: 'accomplishment', _date: a.date })),
        ...(sessRes.data ?? []).map(s => ({ ...s, _type: 'reflection',     _date: s.session_date })),
        ...(momRes.data  ?? []).map(m => ({ ...m, _type: 'incident',       _date: m.date })),
      ].sort((a, b) => (b._date ?? '').localeCompare(a._date ?? ''));

      setFeed(merged);

      // Realtime — refresh on any change to actions table (covers partner reactions)
      if (!channelRef.current && familyId) {
        channelRef.current = supabase
          .channel(`family-feed-${familyId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'child_garden_actions', filter: `family_id=eq.${familyId}` }, () => loadAll())
          .on('postgres_changes', { event: '*', schema: 'public', table: 'family_moments',       filter: `family_id=eq.${familyId}` }, () => loadAll())
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'muhasabah_sessions' }, () => loadAll())
          .subscribe();
      }
    } catch (e) {
      console.warn('[FamilyFeed] loadAll:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleLove(item) {
    if (!myName) return;
    const table     = item._type === 'accomplishment' ? 'child_garden_actions' : 'muhasabah_sessions';
    const currentLoved = (item.loved_by ?? []).includes(myName);
    const newLoves  = currentLoved
      ? (item.loved_by ?? []).filter(n => n !== myName)
      : [...(item.loved_by ?? []), myName];

    setFeed(prev => prev.map(f =>
      f.id === item.id && f._type === item._type ? { ...f, loved_by: newLoves } : f
    ));

    await supabase.from(table).update({ loved_by: newLoves }).eq('id', item.id);

    if (!currentLoved) {
      const label = item._type === 'accomplishment' ? 'accomplishment' : 'reflection';
      notifyPartner(
        `❤️ ${myName.split(' ')[0]} loved a moment`,
        `${item.child_name?.split(' ')[0]}'s ${label} got some love`,
        { screen: 'FamilyFeed' }
      );
    }
  }

  async function handleAcknowledge(item) {
    if (!myName) return;
    const currentAcked = (item.acknowledges ?? []).includes(myName);
    const newAcks = currentAcked
      ? (item.acknowledges ?? []).filter(n => n !== myName)
      : [...(item.acknowledges ?? []), myName];

    setFeed(prev => prev.map(f =>
      f.id === item.id && f._type === 'incident' ? { ...f, acknowledges: newAcks } : f
    ));

    await supabase.from('family_moments').update({ acknowledges: newAcks }).eq('id', item.id);

    if (!currentAcked) {
      notifyPartner(
        `🤲 ${myName.split(' ')[0]} acknowledged`,
        `A difficult moment for ${item.child_name?.split(' ')[0]}`,
        { screen: 'FamilyFeed' }
      );
    }
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
          `${myName.split(' ')[0] || 'Your partner'} logged a difficult moment for ${logChild.name}`,
          text.length > 100 ? text.slice(0, 97) + '…' : text,
          { screen: 'FamilyFeed' }
        );
      }
      setLogText(''); setLogConsequence(''); setLogChild(null); setLogModalStep(null);
      loadAll(true);
    } catch {
      Alert.alert('Error', 'Could not save. Please try again.');
    } finally {
      setLogSaving(false);
    }
  }

  return (
    <View style={s.safe}>
      <StatusBar style="light" />
      <View style={{ height: insets.top, backgroundColor: '#1B3D2F' }} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, left: 10, bottom: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Family Feed</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('FamilySync')}
          hitSlop={{ top: 10, left: 10, bottom: 10, right: 10 }}
        >
          <Ionicons name="link-outline" size={22} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={s.postBar} onPress={() => setComposeOpen(true)} activeOpacity={0.85}>
        <View style={s.postBarAvatar}>
          <Text style={s.postBarAvatarText}>{myName ? myName[0].toUpperCase() : '+'}</Text>
        </View>
        <Text style={s.postBarPlaceholder}>Log a win, reflection or moment…</Text>
        <View style={s.postBarBtn}>
          <Text style={s.postBarBtnText}>Post</Text>
        </View>
      </TouchableOpacity>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#1B3D2F" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadAll(true); }}
              tintColor="#1B3D2F"
            />
          }
        >
          {feed.length === 0 && (
            <View style={s.empty}>
              <Text style={s.emptyEmoji}>🌱</Text>
              <Text style={s.emptyTitle}>Nothing here yet</Text>
              <Text style={s.emptySub}>Log accomplishments, muhasabah sessions, and difficult moments — they'll all show up here.</Text>
            </View>
          )}

          {feed.map((item, i) => {
            const color = item.child_color ?? childMap[item.child_id] ?? '#2E7D62';
            const poster = item.user_id === myUserId ? 'You' : (partnerName || 'Partner');
            return (
              <View key={`${item._type}-${item.id}-${i}`} style={s.card}>
                {/* Card header */}
                <View style={s.cardHeader}>
                  <Avatar name={item.child_name} color={color} size={38} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={s.childNameText} numberOfLines={1}>{item.child_name}</Text>
                    <Text style={s.dateText}>{formatDate(item._date)} · {poster}</Text>
                  </View>
                  <TypeBadge type={item._type} />
                </View>

                <View style={s.cardDivider} />

                {item._type === 'accomplishment' && (
                  <AccomplishmentCard item={item} myName={myName} onLove={handleLove} />
                )}
                {item._type === 'reflection' && (
                  <ReflectionCard item={item} myName={myName} onLove={handleLove} childColor={color} />
                )}
                {item._type === 'incident' && (
                  <IncidentCard item={item} myName={myName} onAcknowledge={handleAcknowledge} />
                )}
              </View>
            );
          })}

          <View style={{ height: Math.max(32, insets.bottom) }} />
        </ScrollView>
      )}

      {/* FAB */}
      <TouchableOpacity style={[s.fab, { bottom: insets.bottom + 24 }]} onPress={() => setComposeOpen(true)} activeOpacity={0.85}>
        <Ionicons name="add" size={30} color="#FFFFFF" />
      </TouchableOpacity>

      {/* ── Compose wizard (full screen) ── */}
      <Modal visible={composeOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setComposeOpen(false)}>
        <View style={s.wizardSafe}>
          <View style={s.wizardHeader}>
            <TouchableOpacity onPress={() => setComposeOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
            <Text style={s.wizardHeaderTitle}>What would you like to share?</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView contentContainerStyle={s.wizardBody}>
            <Text style={s.wizardEyebrow}>FAMILY FEED</Text>
            <Text style={s.wizardTitle}>Log a moment</Text>
            <Text style={s.wizardSub}>Choose the type of moment you'd like to add to your family's shared feed.</Text>

            <TouchableOpacity
              style={s.wizardOption}
              activeOpacity={0.75}
              onPress={() => { setComposeOpen(false); setWinPickerOpen(true); }}
            >
              <View style={[s.wizardOptionIcon, { backgroundColor: '#FEF9C3' }]}>
                <Ionicons name="star" size={28} color="#A16207" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.wizardOptionTitle}>Log an Accomplishment</Text>
                <Text style={s.wizardOptionSub}>Celebrate a win and add it to your child's garden</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
            </TouchableOpacity>

            <TouchableOpacity
              style={s.wizardOption}
              activeOpacity={0.75}
              onPress={() => { setComposeOpen(false); setLogModalStep('child'); }}
            >
              <View style={[s.wizardOptionIcon, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="journal" size={28} color="#B45309" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.wizardOptionTitle}>Log a Difficult Moment</Text>
                <Text style={s.wizardOptionSub}>Track a challenge, consequence, and share with your partner</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Win child picker (full screen) ── */}
      <Modal visible={winPickerOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setWinPickerOpen(false)}>
        <View style={s.wizardSafe}>
          <View style={s.wizardHeader}>
            <TouchableOpacity onPress={() => setWinPickerOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
            <Text style={s.wizardHeaderTitle}>Which child?</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView contentContainerStyle={s.wizardBody}>
            <Text style={s.wizardEyebrow}>LOG AN ACCOMPLISHMENT</Text>
            <Text style={s.wizardTitle}>Select a child</Text>
            <Text style={s.wizardSub}>Choose the child whose accomplishment you'd like to log.</Text>

            {familyTrees.map(tree => {
              const child = children.find(c => c.id === tree.child_id);
              const color = child?.color ?? tree.child_color ?? '#2E7D62';
              const firstName = tree.child_name?.split(' ')[0] ?? '?';
              return (
                <TouchableOpacity
                  key={tree.child_id}
                  style={s.wizardOption}
                  activeOpacity={0.75}
                  onPress={() => { setWinPickerOpen(false); navigation.navigate('GardenDetail', { tree, autoOpenLog: true }); }}
                >
                  <View style={[s.sheetAvatarCircle, { backgroundColor: color }]}>
                    <Text style={s.sheetAvatarText}>{firstName[0].toUpperCase()}</Text>
                  </View>
                  <Text style={[s.wizardOptionTitle, { flex: 1 }]}>{firstName}</Text>
                  <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
                </TouchableOpacity>
              );
            })}
            {familyTrees.length === 0 && (
              <Text style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 14, paddingVertical: 20 }}>
                Add a child tree first to log accomplishments.
              </Text>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* ── Log Difficult Moment modal ── */}
      <Modal visible={!!logModalStep} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setLogModalStep(null)}>
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#FFFFFF' }} behavior={Platform.OS === 'ios' ? 'height' : 'padding'}>
          <View style={s.logHeader}>
            <Text style={s.logHeaderTitle}>
              {logModalStep === 'child' ? 'Which child?' : `Log a moment for ${logChild?.name?.split(' ')[0]}`}
            </Text>
            <TouchableOpacity onPress={() => { setLogModalStep(null); setLogChild(null); setLogText(''); setLogConsequence(''); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {logModalStep === 'child' && (
            <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
              <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 4 }}>Select the child this moment is for.</Text>
              {children.map(child => (
                <TouchableOpacity
                  key={child.id}
                  style={s.logChildRow}
                  onPress={() => { setLogChild(child); setLogModalStep('form'); }}
                  activeOpacity={0.8}
                >
                  <View style={[s.sheetAvatarCircle, { backgroundColor: child.color ?? '#2E7D62' }]}>
                    <Text style={s.sheetAvatarText}>{child.name[0].toUpperCase()}</Text>
                  </View>
                  <Text style={s.logChildName}>{child.name}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {logModalStep === 'form' && (
            <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled" onScrollBeginDrag={() => Keyboard.dismiss()}>
              <Text style={s.logLabel}>What happened?</Text>
              <TextInput
                style={s.logInput}
                placeholder={`Describe the difficult moment with ${logChild?.name?.split(' ')[0]}…`}
                placeholderTextColor="#9CA3AF"
                value={logText}
                onChangeText={setLogText}
                multiline
                autoFocus
              />
              <Text style={s.logLabel}>Consequence (optional)</Text>
              <TextInput
                style={[s.logInput, { minHeight: 60 }]}
                placeholder={`e.g. "Screen time removed for the evening"`}
                placeholderTextColor="#9CA3AF"
                value={logConsequence}
                onChangeText={setLogConsequence}
                multiline
              />
              <TouchableOpacity
                style={[s.logSaveBtn, (!logText.trim() || logSaving) && { opacity: 0.5 }]}
                onPress={saveLoggedMoment}
                disabled={!logText.trim() || logSaving}
                activeOpacity={0.85}
              >
                <Text style={s.logSaveBtnText}>{logSaving ? 'Saving…' : 'Save Moment'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setLogModalStep('child')} style={{ alignItems: 'center', paddingVertical: 8 }} activeOpacity={0.7}>
                <Text style={{ fontSize: 13, color: '#9CA3AF' }}>← Change child</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: BG, position: 'relative' },

  // FAB
  fab:        { position: 'absolute', right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#1B3D2F', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6, zIndex: 10 },

  // Compose wizard
  wizardSafe:       { flex: 1, backgroundColor: '#FFFFFF' },
  wizardHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  wizardHeaderTitle:{ fontSize: 16, fontWeight: '700', color: '#111827' },
  wizardBody:       { padding: 24, gap: 12 },
  wizardEyebrow:    { fontSize: 11, fontWeight: '700', color: '#1B3D2F', letterSpacing: 1.2, marginBottom: 2 },
  wizardTitle:      { fontSize: 26, fontWeight: '900', color: '#111827', marginBottom: 4 },
  wizardSub:        { fontSize: 14, color: '#6B7280', lineHeight: 21, marginBottom: 12 },
  wizardOption:     { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 18, borderRadius: 16, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB' },
  wizardOptionIcon: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  wizardOptionTitle:{ fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 3 },
  wizardOptionSub:  { fontSize: 13, color: '#6B7280', lineHeight: 18 },
  sheetAvatarCircle:{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sheetAvatarText:  { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },

  // Log moment modal
  logHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  logHeaderTitle:{ fontSize: 17, fontWeight: '800', color: '#111827' },
  logChildRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  logChildName:  { flex: 1, fontSize: 15, fontWeight: '600', color: '#111827' },
  logLabel:      { fontSize: 13, fontWeight: '700', color: '#374151' },
  logInput:      { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, fontSize: 15, color: '#111827', minHeight: 100, textAlignVertical: 'top', borderWidth: 1, borderColor: '#E5E7EB' },
  logSaveBtn:    { backgroundColor: '#1B3D2F', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  logSaveBtnText:{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#1B3D2F' },
  headerTitle:     { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  headerLink:      { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.85)', textDecorationLine: 'underline' },
  postBar:         { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  postBarAvatar:   { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1B3D2F', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  postBarAvatarText:{ fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  postBarPlaceholder:{ flex: 1, fontSize: 14, color: '#9CA3AF' },
  postBarBtn:      { backgroundColor: '#1B3D2F', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 7 },
  postBarBtnText:  { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  scroll:          { paddingHorizontal: 16, paddingTop: 12 },

  card:       { backgroundColor: WHITE, borderRadius: 16, marginBottom: 12, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12 },
  cardDivider:{ height: 1, backgroundColor: '#F3F4F6' },
  cardBody:   { padding: 14, gap: 10 },

  childNameText: { fontSize: 14, fontWeight: '700', color: TEXT },
  dateText:      { fontSize: 12, color: SUB, marginTop: 1 },

  typeBadge:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  typeDot:       { width: 6, height: 6, borderRadius: 3 },
  typeBadgeText: { fontSize: 11, fontWeight: '700' },

  // Accomplishment
  deedRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deedEmoji:  { fontSize: 22 },
  deedLabel:  { fontSize: 15, fontWeight: '700', color: TEXT },
  quoteText:  { fontSize: 14, color: '#374151', fontStyle: 'italic', lineHeight: 21 },

  // Reflection
  reflectionStats:   { flexDirection: 'row', alignItems: 'center', gap: 14 },
  reflectionStat:    { alignItems: 'flex-start' },
  reflectionStatNum: { fontSize: 20, fontWeight: '900', color: '#1B3D2F' },
  reflectionStatLabel: { fontSize: 11, color: SUB },
  ratingsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  ratingPill:  { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F9FAFB', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: BORDER },
  ratingPillEmoji: { fontSize: 13 },
  ratingPillLabel: { fontSize: 12, color: SUB, fontWeight: '500' },
  ratingPillValue: { fontSize: 12, fontWeight: '700' },
  answerBlock: { borderLeftWidth: 3, borderLeftColor: '#22C55E', paddingLeft: 10, gap: 3 },
  answerLabel: { fontSize: 11, fontWeight: '700', color: SUB, textTransform: 'uppercase', letterSpacing: 0.5 },
  answerText:  { fontSize: 13, color: '#374151', fontStyle: 'italic', lineHeight: 20 },

  // Share card (off-screen)
  shareCardWrap:       { position: 'absolute', top: -9999, left: 0, width: 340 },
  shareCard:           { width: 340, backgroundColor: '#0D1B2A', padding: 20, gap: 14 },
  shareCardHeader:     { flexDirection: 'row', alignItems: 'center' },
  shareCardAvatar:     { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  shareCardAvatarText: { fontSize: 16, fontWeight: '800', color: '#FFF' },
  shareCardName:       { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  shareCardDate:       { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 1 },
  shareCardStats:      { flexDirection: 'row', alignItems: 'center', gap: 14 },
  shareCardStat:       { alignItems: 'flex-start' },
  shareCardStatNum:    { fontSize: 22, fontWeight: '900', color: '#FFFFFF' },
  shareCardStatLabel:  { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  shareCardRatings:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  shareCardPill:       { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  shareCardPillLabel:  { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  shareCardAnswer:     { borderLeftWidth: 3, paddingLeft: 10, gap: 3 },
  shareCardAnswerLabel:{ fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.5 },
  shareCardAnswerText: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontStyle: 'italic', lineHeight: 18 },
  shareCardBrand:      { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 12 },
  shareCardBrandText:  { fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: '600', letterSpacing: 0.5 },

  // Incident
  incidentText:    { fontSize: 14, color: TEXT, lineHeight: 21 },
  consequenceRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  consequenceText: { fontSize: 13, color: SUB, flex: 1, lineHeight: 19 },

  // Reactions
  reactionRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#F3F4F6', marginTop: 4 },
  reactionBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: BORDER },
  reactionBtnActive:{ backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  reactionBtnAck:   { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  reactionText:     { fontSize: 13, color: SUB, fontWeight: '600' },
  reactionNames:    { fontSize: 12, color: SUB, flex: 1 },

  // Empty
  empty:      { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32, gap: 10 },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: TEXT },
  emptySub:   { fontSize: 14, color: SUB, textAlign: 'center', lineHeight: 21 },
});
