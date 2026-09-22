import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Share,
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert, Keyboard,
} from 'react-native';

let captureRef = null;
try { captureRef = require('react-native-view-shot').captureRef; } catch {}
let Sharing = null;
try { Sharing = require('expo-sharing'); } catch {}
let ImagePicker = null;
try { ImagePicker = require('expo-image-picker'); } catch {}
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';
import { getFamilyId } from '../utils/familyGoals';
import { getCachedSyncStatus, getFamilySyncStatus } from '../utils/familySync';
import { notifyPartner } from '../utils/partnerNotify';
import { MANNERS } from '../components/MannerGarden';
import { getAllChildProfiles, updateChildProfile } from '../utils/childProfiles';
import { uploadPhoto, uploadVideo } from '../utils/uploadPhoto';
import { Video as VideoAV, ResizeMode } from 'expo-av';

const BG      = '#F4F6F9';
const WHITE   = '#FFFFFF';
const TEXT    = '#111827';
const SUB     = '#6B7280';
const BORDER  = '#E5E7EB';

const TYPE_META = {
  accomplishment:         { label: 'Accomplishment', color: '#1B3D2F', bg: '#EDF7F2', dot: '#22C55E' },
  general_accomplishment: { label: 'Accomplishment', color: '#1B3D2F', bg: '#EDF7F2', dot: '#22C55E' },
  reflection:     { label: 'Reflection',      color: '#0D1B3E', bg: '#EEF2FF', dot: '#818CF8' },
  incident:       { label: 'Difficult Moment', color: '#92400E', bg: '#FEF3C7', dot: '#F59E0B' },
  shukr:          { label: 'Shukr',           color: '#92400E', bg: '#FFFBEB', dot: '#F59E0B' },
};

const SHUKR_AYAHS = [
  { ref: 'Ibrahim 14:7',      text: '"If you are grateful, I will surely increase you in favor."' },
  { ref: 'Al-Baqarah 2:152',  text: '"So remember Me; I will remember you. And be grateful to Me and do not deny Me."' },
  { ref: 'An-Naml 27:40',     text: '"This is from the favor of my Lord to test me whether I will be grateful or ungrateful."' },
  { ref: 'Luqman 31:12',      text: '"Whoever is grateful, his gratitude is only for the benefit of himself."' },
  { ref: 'Ibrahim 14:34',     text: '"And if you should count the favors of Allah, you could not enumerate them."' },
];

const SHUKR_THEMES = [
  { key: 'rizq',      label: 'Rizq',      emoji: '🌾', color: '#D97706' },
  { key: 'health',    label: 'Health',    emoji: '💚', color: '#059669' },
  { key: 'family',    label: 'Family',    emoji: '🏡', color: '#7C3AED' },
  { key: 'growth',    label: 'Growth',    emoji: '🌱', color: '#2E7D62' },
  { key: 'character', label: 'Character', emoji: '⭐', color: '#B45309' },
  { key: 'ibadah',    label: 'Ibadah',    emoji: '🤲', color: '#1D4ED8' },
];

const EMOJI_SCALE  = ['😔', '😐', '🙂', '😊', '🌟'];
const EMOJI_LABELS = ['Needs work', 'A little', 'Pretty good', 'Really good', 'Amazing!'];
const CAT_MAP = {
  salah:    { label: 'Salah',    emoji: '🙏' },
  quran:    { label: 'Quran',    emoji: '📖' },
  kindness: { label: 'Kindness', emoji: '💝' },
  honesty:  { label: 'Honesty',  emoji: '✨' },
  helping:  { label: 'Helping',  emoji: '🤝' },
};

function formatDate(dateStr, tsStr) {
  if (!dateStr) return '';
  // Use full timestamp if available, otherwise date-only
  const d = new Date(tsStr ?? (dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00'));
  if (isNaN(d.getTime())) return '';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const itemDay = new Date(d); itemDay.setHours(0, 0, 0, 0);
  const diff = Math.round((today - itemDay) / 86400000);
  const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (diff <= 0) return `Today at ${timeStr}`;
  if (diff === 1) return `Yesterday at ${timeStr}`;
  if (diff < 7)  return `${d.toLocaleDateString('en-GB', { weekday: 'short' })} at ${timeStr}`;
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} at ${timeStr}`;
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

function VideoCard({ uri, style }) {
  const [playing, setPlaying] = useState(false);
  if (playing) {
    return (
      <VideoAV
        source={{ uri }}
        style={style}
        useNativeControls
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay
      />
    );
  }
  return (
    <TouchableOpacity style={[style, { backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', borderRadius: 10 }]} onPress={() => setPlaying(true)} activeOpacity={0.85}>
      <Ionicons name="play-circle" size={56} color="rgba(255,255,255,0.88)" />
    </TouchableOpacity>
  );
}

function ShukrCard({ item, myName, onLove, onPhotoPress }) {
  const loved  = (item.loved_by ?? []).includes(myName);
  const theme  = SHUKR_THEMES.find(t => t.key === item.theme);

  function handleShare() {
    const parts = [];
    if (item.text) parts.push(item.text);
    if (item.ayah_text) parts.push(`"${item.ayah_text}" — ${item.ayah_ref}`);
    Share.share({ message: parts.join('\n\n') || 'A moment of gratitude 🌙' });
  }

  return (
    <View style={s.shukrCardInner}>
      <View style={s.shukrTopRow}>
        <Text style={s.shukrMoon}>🌙</Text>
        <Text style={s.shukrLabel}>Shukr Moment</Text>
        {theme && (
          <View style={[s.shukrThemePill, { backgroundColor: theme.color + '18' }]}>
            <Text style={[s.shukrThemePillText, { color: theme.color }]}>{theme.emoji} {theme.label}</Text>
          </View>
        )}
      </View>

      {!!item.text && <Text style={s.shukrText}>{item.text}</Text>}

      {item.video_url && (
        <VideoCard uri={item.video_url} style={s.shukrCardPhoto} />
      )}
      {item.photo_url && !item.video_url && (
        <TouchableOpacity activeOpacity={0.9} onPress={() => onPhotoPress?.(item.photo_url)}>
          <Image source={{ uri: item.photo_url }} style={s.shukrCardPhoto} contentFit="cover" />
        </TouchableOpacity>
      )}

      {item.ayah_text && (
        <View style={s.shukrAyahWrap}>
          <Text style={s.shukrAyahText}>{item.ayah_text}</Text>
          <Text style={s.shukrAyahRef}>— {item.ayah_ref}</Text>
        </View>
      )}

      <View style={s.reactionRow}>
        <TouchableOpacity style={[s.reactionBtn, loved && s.reactionBtnActive]} onPress={() => onLove(item)} activeOpacity={0.75}>
          <Ionicons name={loved ? 'heart' : 'heart-outline'} size={16} color={loved ? '#EF4444' : SUB} />
          <Text style={[s.reactionText, loved && { color: '#EF4444' }]}>Love{(item.loved_by ?? []).length > 0 ? ` · ${item.loved_by.length}` : ''}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.reactionBtn} onPress={handleShare} activeOpacity={0.75}>
          <Ionicons name="share-outline" size={16} color={SUB} />
          <Text style={s.reactionText}>Share</Text>
        </TouchableOpacity>
        {(item.loved_by ?? []).length > 0 && (
          <Text style={s.reactionNames} numberOfLines={1}>{item.loved_by.join(' & ')} loved this</Text>
        )}
      </View>
    </View>
  );
}

function AccomplishmentCard({ item, myName, onLove, isTree, onViewTree }) {
  const manner    = MANNERS?.find?.(m => m.key === item.manner) ?? { emoji: '⭐', label: item.manner };
  const loved     = (item.loved_by ?? []).includes(myName);
  const loveCount = (item.loved_by ?? []).length;

  return (
    <View style={s.cardBody}>
      <View style={s.deedRow}>
        <Text style={s.deedEmoji}>{manner.emoji}</Text>
        <Text style={s.deedLabel}>{manner.label}</Text>
        {isTree && (
          <TouchableOpacity style={s.treeBadge} onPress={onViewTree} activeOpacity={0.75}>
            <Text style={s.treeBadgeText}>🌳 View Tree</Text>
          </TouchableOpacity>
        )}
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
              <Text style={s.shareCardDate}>Nightly Muhasabah · {formatDate(item._date, item._ts)}</Text>
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
  const [fullscreenPhoto, setFullscreenPhoto] = useState(null);
  const scrollRef = useRef(null);
  const scrollY   = useRef(0);
  const [childMap,      setChildMap]      = useState({});
  const [children,      setChildren]      = useState([]);
  const [familyTrees,   setFamilyTrees]   = useState([]);
  const [partnerLinked, setPartnerLinked] = useState(false);
  const [myUserId,      setMyUserId]      = useState(null);
  const [partnerName,   setPartnerName]   = useState('');
  // compose
  const [composeOpen,   setComposeOpen]   = useState(false);
  // accomplishment compose
  const [accomOpen,     setAccomOpen]     = useState(false);
  const [accomStep,     setAccomStep]     = useState('child'); // 'child' | 'manner' | 'tree' | 'tree_select'
  const [accomChild,    setAccomChild]    = useState(null);
  const [accomManner,   setAccomManner]   = useState(null);
  const [accomNote,     setAccomNote]     = useState('');
  const [accomTree,     setAccomTree]     = useState(null);
  const [accomSaving,   setAccomSaving]   = useState(false);
  const [logModalStep,  setLogModalStep]  = useState(null);
  const [logChild,      setLogChild]      = useState(null);
  const [logText,       setLogText]       = useState('');
  const [logConsequence,setLogConsequence]= useState('');
  const [logSaving,     setLogSaving]     = useState(false);
  // shukr compose
  const [shukrOpen,     setShukrOpen]     = useState(false);
  const [shukrStep,     setShukrStep]     = useState('text');
  const [shukrText,     setShukrText]     = useState('');
  const [shukrChildren, setShukrChildren] = useState([]);
  const [shukrTheme,    setShukrTheme]    = useState(null);
  const [shukrAyah,     setShukrAyah]     = useState(null);
  const [shukrPhoto,    setShukrPhoto]    = useState(null);
  const [shukrVideo,    setShukrVideo]    = useState(null);
  const [shukrSaving,   setShukrSaving]   = useState(false);
  const [commentCounts, setCommentCounts] = useState({});
  const channelRef    = useRef(null);
  const shukrInputRef = useRef(null);

  useFocusEffect(useCallback(() => {
    AsyncStorage.setItem('tarbiyah_feed_last_viewed', new Date().toISOString()).catch(() => {});
    loadAll();
    return () => {
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
    };
  }, []));

  // Restore scroll position after feed loads (prevents reset when returning from tree view)
  useEffect(() => {
    if (!loading && scrollY.current > 0) {
      const y = scrollY.current;
      setTimeout(() => scrollRef.current?.scrollTo({ y, animated: false }), 0);
    }
  }, [loading]);

  async function loadAll(isRefresh = false) {
    if (!isRefresh && feed.length === 0) setLoading(true);
    try {
      const [{ data: { session } }, profileRaw, syncStatus] = await Promise.all([
        supabase.auth.getSession(),
        AsyncStorage.getItem('tarbiyah_profile'),
        getCachedSyncStatus(),
      ]);
      if (!session) return;

      const name = profileRaw ? (JSON.parse(profileRaw).name ?? '') : '';
      setMyName(name);

      // Apply cached status immediately for fast paint, then verify with live status
      setPartnerLinked(!!syncStatus?.linked);
      setMyUserId(session.user.id);
      setPartnerName(syncStatus?.partner?.name?.split(' ')[0] ?? 'Partner');

      // Fetch live sync status in background — corrects stale cache after unlink/link
      getFamilySyncStatus().then(live => {
        setPartnerLinked(!!live?.linked);
        if (live?.partner?.name) setPartnerName(live.partner.name.split(' ')[0]);
      }).catch(() => {});

      const familyId  = await getFamilyId();
      const partnerId = syncStatus?.partner?.userId ?? null;

      // Get all family member user IDs from DB (more reliable than cache for muhasabah query)
      const { data: familyMembers } = await supabase
        .from('family_members')
        .select('user_id')
        .eq('family_id', familyId);
      const familyUserIds = (familyMembers ?? []).map(m => m.user_id).filter(Boolean);
      // Fallback to cached partner if family_members query fails or returns only self
      const userIds = familyUserIds.length > 0
        ? familyUserIds
        : [session.user.id, partnerId].filter(Boolean);

      const [actRes, sessRes, momRes, childProfiles, treesRes] = await Promise.all([
        supabase
          .from('child_garden_actions')
          .select('id, child_id, child_name, manner, note, date, loved_by, user_id, created_at')
          .eq('family_id', familyId)
          .order('date', { ascending: false })
          .limit(60),
        supabase
          .from('muhasabah_sessions')
          .select('id, child_id, child_name, session_date, points_earned, streak_day, slider_ratings, didnt_do_well, repair_plan, do_better, custom_answers, loved_by, user_id, created_at')
          .in('user_id', userIds)
          .order('session_date', { ascending: false })
          .limit(60),
        supabase
          .from('family_moments')
          .select('id, child_id, child_name, child_color, date, text, consequence, acknowledges, user_id, created_at')
          .eq('family_id', familyId)
          .eq('type', 'incident')
          .order('date', { ascending: false })
          .limit(40),
        getAllChildProfiles(),
        supabase.from('family_trees').select('*').eq('family_id', familyId),
      ]);

      // shukr_posts queried separately — table may not exist yet if migration hasn't run
      const shukrRes = await supabase
        .from('shukr_posts')
        .select('id, child_id, child_name, text, theme, ayah_ref, ayah_text, photo_url, video_url, loved_by, user_id, created_at')
        .eq('family_id', familyId)
        .order('created_at', { ascending: false })
        .limit(40)
        .then(r => r)
        .catch(() => ({ data: [] }));

      // family_accomplishments queried separately — table may not exist yet
      const genAccomRes = await supabase
        .from('family_accomplishments')
        .select('id, child_id, child_name, manner, note, date, loved_by, user_id, created_at')
        .eq('family_id', familyId)
        .order('created_at', { ascending: false })
        .limit(60)
        .then(r => r)
        .catch(() => ({ data: [] }));

      setChildren(childProfiles ?? []);
      // Canonical trees have no linked_tree_id. Linked (partner) trees do.
      // Inject the partner's child_id onto each canonical tree so MannerGarden
      // can query both child_ids when the partner owns some of the actions.
      const allTrees = treesRes.data ?? [];
      const linkedMap = {};
      allTrees.forEach(t => { if (t.linked_tree_id) linkedMap[t.linked_tree_id] = t.child_id; });
      const canonicalTrees = allTrees
        .filter(t => !t.linked_tree_id)
        .map(t => ({ ...t, linked_tree_id: linkedMap[t.child_id] ?? null }));
      setFamilyTrees(canonicalTrees);

      // Build child color map from local profiles
      const map = {};
      (childProfiles ?? []).forEach(c => { if (c.id) map[c.id] = c.color; });
      // Also pick up colors written on family_moments rows
      (momRes.data ?? []).forEach(r => { if (r.child_id && r.child_color) map[r.child_id] = r.child_color; });
      setChildMap(map);

      const merged = [
        ...(actRes.data        ?? []).map(a => ({ ...a, _type: 'accomplishment',         _date: a.date,         _ts: a.created_at ?? a.date })),
        ...(genAccomRes.data   ?? []).map(a => ({ ...a, _type: 'general_accomplishment', _date: a.date,         _ts: a.created_at ?? a.date })),
        ...(sessRes.data       ?? []).map(s => ({ ...s, _type: 'reflection',             _date: s.session_date, _ts: s.created_at ?? s.session_date })),
        ...(momRes.data        ?? []).map(m => ({ ...m, _type: 'incident',               _date: m.date,         _ts: m.created_at ?? m.date })),
        ...(shukrRes.data      ?? []).map(p => ({ ...p, _type: 'shukr',                  _date: p.created_at,   _ts: p.created_at })),
      ].sort((a, b) => (b._ts ?? '').localeCompare(a._ts ?? ''));

      setFeed(merged);

      // Load comment counts for all visible posts
      if (merged.length > 0) {
        const ids = merged.map(m => m.id);
        const { data: counts } = await supabase
          .from('feed_comments')
          .select('post_id, post_type')
          .in('post_id', ids);
        if (counts) {
          const map = {};
          counts.forEach(c => { const k = c.post_id; map[k] = (map[k] ?? 0) + 1; });
          setCommentCounts(map);
        }
      }

      // Realtime — refresh on any change to actions table (covers partner reactions)
      if (!channelRef.current && familyId) {
        channelRef.current = supabase
          .channel(`family-feed-${familyId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'child_garden_actions',    filter: `family_id=eq.${familyId}` }, () => loadAll())
          .on('postgres_changes', { event: '*', schema: 'public', table: 'family_accomplishments', filter: `family_id=eq.${familyId}` }, () => loadAll())
          .on('postgres_changes', { event: '*', schema: 'public', table: 'family_moments',          filter: `family_id=eq.${familyId}` }, () => loadAll())
          .on('postgres_changes', { event: '*', schema: 'public', table: 'shukr_posts',             filter: `family_id=eq.${familyId}` }, () => loadAll())
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'muhasabah_sessions' }, () => loadAll())
          .subscribe();
      }
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleLove(item) {
    if (!myName) return;
    const table     = item._type === 'accomplishment' ? 'child_garden_actions' : item._type === 'general_accomplishment' ? 'family_accomplishments' : 'muhasabah_sessions';
    const currentLoved = (item.loved_by ?? []).includes(myName);
    const newLoves  = currentLoved
      ? (item.loved_by ?? []).filter(n => n !== myName)
      : [...(item.loved_by ?? []), myName];

    setFeed(prev => prev.map(f =>
      f.id === item.id && f._type === item._type ? { ...f, loved_by: newLoves } : f
    ));

    await supabase.from(table).update({ loved_by: newLoves }).eq('id', item.id);

    if (!currentLoved) {
      const label   = item._type === 'accomplishment' ? 'accomplishment' : 'reflection';
      const subject = item.child_name?.split(' ')[0];
      const body    = subject ? `${subject}'s ${label} got some love` : `Your ${label} got some love`;
      notifyPartner(`❤️ ${myName.split(' ')[0]} loved a moment`, body, { screen: 'FamilyFeed' });
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

  async function handleLoveShukr(item) {
    if (!myName) return;
    const current  = (item.loved_by ?? []).includes(myName);
    const newLoves = current
      ? (item.loved_by ?? []).filter(n => n !== myName)
      : [...(item.loved_by ?? []), myName];
    setFeed(prev => prev.map(f => f.id === item.id && f._type === 'shukr' ? { ...f, loved_by: newLoves } : f));
    await supabase.from('shukr_posts').update({ loved_by: newLoves }).eq('id', item.id);
    if (!current) {
      notifyPartner(
        `❤️ ${myName.split(' ')[0]} loved your Shukr moment`,
        item.text?.length > 60 ? item.text.slice(0, 57) + '…' : (item.text || 'A gratitude moment'),
        { screen: 'FamilyFeed' }
      );
    }
  }

  async function handleDelete(item) {
    Alert.alert('Delete post', 'Remove this from the family feed?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          setFeed(prev => prev.filter(f => !(f.id === item.id && f._type === item._type)));
          const tableMap = {
            accomplishment:         'family_accomplishments',
            general_accomplishment: 'family_accomplishments',
            reflection:             'muhasabah_sessions',
            incident:               'family_moments',
            shukr:                  'shukr_posts',
          };
          const table = tableMap[item._type];
          if (table) await supabase.from(table).delete().eq('id', item.id);
        },
      },
    ]);
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
          `${myName.split(' ')[0] || 'Your partner'} posted a difficult moment`,
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

  function resetShukr() {
    setShukrText(''); setShukrChildren([]); setShukrTheme(null); setShukrAyah(null);
    setShukrPhoto(null); setShukrVideo(null); setShukrStep('text'); setShukrOpen(false);
  }

  async function pickShukrPhoto(fromCamera = false) {
    if (!ImagePicker) return;
    const permFn = fromCamera
      ? ImagePicker.requestCameraPermissionsAsync
      : ImagePicker.requestMediaLibraryPermissionsAsync;
    const { status } = await permFn();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Please allow photo access in Settings.'); return; }
    const launchFn = fromCamera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    const result = await launchFn({ mediaTypes: ImagePicker.MediaTypeOptions?.Images ?? 'images', quality: 0.8, allowsEditing: true, aspect: [4, 3] });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setShukrPhoto(result.assets[0].uri);
      setTimeout(() => shukrInputRef.current?.focus(), 400);
    }
  }

  async function pickShukrVideo() {
    if (!ImagePicker) return;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission needed', 'Please allow photo/video access in Settings.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        videoQuality: ImagePicker.VideoQuality?.Low ?? 2,
        videoMaxDuration: 120,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setShukrVideo(result.assets[0].uri);
        setShukrPhoto(null);
        setTimeout(() => shukrInputRef.current?.focus(), 400);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not open video picker.');
    }
  }

  async function saveShukr() {
    const text = shukrText.trim();
    if (!text && !shukrPhoto && !shukrVideo) return;
    setShukrSaving(true);
    try {
      const [familyId, { data: { session } }] = await Promise.all([getFamilyId(), supabase.auth.getSession()]);
      let photo_url = null;
      let video_url = null;
      if (shukrPhoto) {
        const path = `shukr/${session.user.id}_${Date.now()}.jpg`;
        photo_url = await uploadPhoto(shukrPhoto, path);
      }
      if (shukrVideo) {
        const ext  = shukrVideo.split('.').pop()?.toLowerCase() ?? 'mp4';
        const path = `shukr/${session.user.id}_${Date.now()}.${ext}`;
        video_url = await uploadVideo(shukrVideo, path);
      }
      const { error: insertErr } = await supabase.from('shukr_posts').insert({
        family_id:  familyId,
        user_id:    session?.user?.id,
        child_id:   shukrChildren.length > 0 ? shukrChildren.map(c => c.id).join(',') : null,
        child_name: shukrChildren.length > 0 ? shukrChildren.map(c => c.name).join(', ') : null,
        text:       text || '',
        theme:      shukrTheme ?? null,
        ayah_ref:   shukrAyah?.ref  ?? null,
        ayah_text:  shukrAyah?.text ?? null,
        photo_url,
        video_url,
      });
      if (insertErr) throw insertErr;
      if (partnerLinked) {
        notifyPartner(
          `${myName.split(' ')[0] || 'Your partner'} posted a Shukr moment 🌙`,
          text.length > 100 ? text.slice(0, 97) + '…' : text,
          { screen: 'FamilyFeed' }
        );
      }
      resetShukr();
      loadAll(true);
    } catch (e) {
      Alert.alert('Error', 'Could not save. Please try again.');
    } finally {
      setShukrSaving(false);
    }
  }

  function resetAccom() {
    setAccomOpen(false); setAccomStep('child');
    setAccomChild(null); setAccomManner(null); setAccomNote(''); setAccomTree(null);
  }

  async function saveAccomplishment(selectedTree) {
    // selectedTree = tree object if saving to tree, null for feed-only
    if (!accomChild || !accomManner) return;
    setAccomSaving(true);
    try {
      const [familyId, { data: { session } }] = await Promise.all([getFamilyId(), supabase.auth.getSession()]);
      const toTree = !!selectedTree;
      // When saving to a tree, use the tree's child_id/name so it shows up in that garden view
      const childId   = toTree ? (selectedTree.child_id   ?? accomChild.id)   : accomChild.id;
      const childName = toTree ? (selectedTree.child_name ?? accomChild.name)  : accomChild.name;
      const base = {
        family_id:  familyId,
        user_id:    session.user.id,
        child_id:   childId,
        child_name: childName,
        manner:     accomManner,
        note:       accomNote.trim() || null,
        date:       new Date().toISOString(),
      };
      const table = toTree ? 'child_garden_actions' : 'family_accomplishments';
      const payload = toTree ? { ...base, id: `ga_${Date.now()}` } : base;
      const { error } = await supabase.from(table).insert(payload);
      if (error) throw error;
      if (partnerLinked) {
        const m = MANNERS.find(m => m.key === accomManner);
        notifyPartner(
          `${myName.split(' ')[0] || 'Your partner'} posted an accomplishment ${m?.emoji ?? '⭐'}`,
          accomNote.trim() ? `"${accomNote.trim()}"` : m?.label ?? '',
          { screen: 'FamilyFeed' }
        );
      }
      resetAccom();
      loadAll(true);
    } catch (e) {
      Alert.alert('Error', 'Could not save. Please try again.');
    } finally {
      setAccomSaving(false);
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
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Family Feed</Text>
          <View style={s.headerMeta}>
            {partnerLinked && (
              <>
                <View style={s.headerOnlineDot} />
                <Text style={s.headerMetaText}>You & {partnerName}</Text>
                <Text style={s.headerMetaDivider}>·</Text>
              </>
            )}
            {feed.length > 0 && (
              <Text style={s.headerMetaText}>{(() => {
                const today = new Date().toISOString().slice(0, 10);
                const yest  = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
                const d     = feed[0]._date?.slice(0, 10);
                if (d === today)  return 'Last post today';
                if (d === yest)   return 'Last post yesterday';
                const days = Math.round((Date.now() - new Date(d + 'T00:00:00').getTime()) / 86400000);
                return `Last post ${days}d ago`;
              })()}</Text>
            )}
          </View>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('FamilySync')}
          hitSlop={{ top: 10, left: 10, bottom: 10, right: 10 }}
        >
          <Ionicons name="link-outline" size={22} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>
      </View>

      {children.length > 0 && (
        <View style={s.childAvatarRow}>
          {children.map((child, i) => (
            <TouchableOpacity
              key={child.id ?? i}
              style={[s.childAvatarWrap, i > 0 && { marginLeft: 8 }]}
              activeOpacity={0.75}
              onPress={() => navigation.navigate('Tabs', { screen: 'Family', params: { tab: 'dashboard', childId: child.id } })}
            >
              <Avatar name={child.name} color={child.color ?? '#2E7D62'} size={34} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      <TouchableOpacity style={s.postBar} onPress={() => setComposeOpen(true)} activeOpacity={0.85}>
        <View style={s.postBarAvatar}>
          <Text style={s.postBarAvatarText}>{myName ? myName[0].toUpperCase() : '+'}</Text>
        </View>
        <Text style={s.postBarPlaceholder}>Post a win, reflection or shukr moment…</Text>
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
          ref={scrollRef}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          onScroll={e => { scrollY.current = e.nativeEvent.contentOffset.y; }}
          scrollEventThrottle={16}
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
              <Text style={s.emptySub}>Post accomplishments, muhasabah sessions, and difficult moments — they'll all show up here.</Text>
            </View>
          )}

          {feed.map((item, i) => {
            const color = item.child_color ?? childMap[item.child_id] ?? '#2E7D62';
            const poster = item.user_id === myUserId ? 'You' : (partnerName || 'Partner');
            return (
              <TouchableOpacity
                key={`${item._type}-${item.id}-${i}`}
                style={[s.card, item._type === 'shukr' && { backgroundColor: '#FFFBF0' }]}
                activeOpacity={0.97}
                onPress={() => {
                  const authorName = item.user_id === myUserId ? myName : partnerName;
                  navigation.navigate('FeedPost', { item, authorName, authorColor: item.child_color ?? childMap[item.child_id] ?? '#2E7D62' });
                }}
              >
                {/* Card header */}
                <View style={s.cardHeader}>
                  {item._type === 'shukr' && !item.child_name
                    ? <View style={[s.shukrHeaderIcon, { backgroundColor: '#FEF3C7' }]}><Text style={{ fontSize: 18 }}>🌙</Text></View>
                    : <Avatar name={item.child_name ?? poster} color={item._type === 'shukr' ? '#F59E0B' : color} size={38} />
                  }
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={s.childNameText} numberOfLines={1}>
                      {item._type === 'shukr' ? (item.child_name ? `${item.child_name} · ${poster}` : poster) : item.child_name}
                    </Text>
                    <Text style={s.dateText}>{formatDate(item._date, item._ts)} · {poster}</Text>
                  </View>
                  <TypeBadge type={item._type} />
                  {item.user_id === myUserId && (
                    <TouchableOpacity
                      onPress={() => handleDelete(item)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{ marginLeft: 8 }}
                    >
                      <Ionicons name="trash-outline" size={16} color="#D1D5DB" />
                    </TouchableOpacity>
                  )}
                </View>


                {(item._type === 'accomplishment' || item._type === 'general_accomplishment') && (
                  <AccomplishmentCard
                    item={item} myName={myName} onLove={handleLove}
                    isTree={item._type === 'accomplishment'}
                    onViewTree={() => {
                      const tree = familyTrees.find(t => t.child_id === item.child_id);
                      if (tree) navigation.navigate('GardenDetail', { tree });
                    }}
                  />
                )}
                {item._type === 'reflection' && (
                  <ReflectionCard item={item} myName={myName} onLove={handleLove} childColor={color} />
                )}
                {item._type === 'incident' && (
                  <IncidentCard item={item} myName={myName} onAcknowledge={handleAcknowledge} />
                )}
                {item._type === 'shukr' && (
                  <ShukrCard item={item} myName={myName} onLove={handleLoveShukr} onPhotoPress={setFullscreenPhoto} />
                )}

                {/* Comment count strip — whole card is tappable */}
                {(() => {
                  const count = commentCounts[item.id] ?? 0;
                  const hasComments = count > 0;
                  return (
                    <View style={[s.commentBtn, hasComments && s.commentBtnActive]}>
                      <Ionicons name={hasComments ? 'chatbubble' : 'chatbubble-outline'} size={14} color={hasComments ? '#1B3D2F' : SUB} />
                      <Text style={[s.commentBtnText, hasComments && s.commentBtnTextActive]}>
                        {hasComments ? `${count} comment${count !== 1 ? 's' : ''}` : 'Comment'}
                      </Text>
                    </View>
                  );
                })()}
              </TouchableOpacity>
            );
          })}

          <View style={{ height: Math.max(32, insets.bottom) }} />
        </ScrollView>
      )}

      {/* Fullscreen photo viewer */}
      <Modal visible={!!fullscreenPhoto} transparent animationType="fade" onRequestClose={() => setFullscreenPhoto(null)}>
        <TouchableOpacity style={s.fullscreenOverlay} activeOpacity={1} onPress={() => setFullscreenPhoto(null)}>
          {fullscreenPhoto && (
            <Image source={{ uri: fullscreenPhoto }} style={s.fullscreenImg} contentFit="contain" />
          )}
          <TouchableOpacity style={s.fullscreenClose} onPress={() => setFullscreenPhoto(null)}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

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
            <Text style={s.wizardTitle}>Post a moment</Text>
            <Text style={s.wizardSub}>Choose the type of moment you'd like to add to your family's shared feed.</Text>

            <TouchableOpacity
              style={s.wizardOption}
              activeOpacity={0.75}
              onPress={() => { setComposeOpen(false); setAccomStep('child'); setAccomChild(null); setAccomManner(null); setAccomNote(''); setAccomOpen(true); }}
            >
              <View style={[s.wizardOptionIcon, { backgroundColor: '#DCFCE7' }]}>
                <Ionicons name="star" size={28} color="#16A34A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.wizardOptionTitle}>Post an Accomplishment</Text>
                <Text style={s.wizardOptionSub}>Celebrate a win and add it to your child's garden</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
            </TouchableOpacity>

            <TouchableOpacity
              style={s.wizardOption}
              activeOpacity={0.75}
              onPress={() => { setComposeOpen(false); setLogModalStep('child'); }}
            >
              <View style={[s.wizardOptionIcon, { backgroundColor: '#EEF2FF' }]}>
                <Ionicons name="journal" size={28} color="#6366F1" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.wizardOptionTitle}>Post a Difficult Moment</Text>
                <Text style={s.wizardOptionSub}>Track a challenge, consequence, and share with your partner</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
            </TouchableOpacity>

            <TouchableOpacity
              style={s.wizardOption}
              activeOpacity={0.75}
              onPress={() => { setComposeOpen(false); setShukrStep('text'); setShukrOpen(true); }}
            >
              <View style={[s.wizardOptionIcon, { backgroundColor: '#FEF3C7' }]}>
                <Text style={{ fontSize: 26 }}>🌙</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.wizardOptionTitle}>Post a Shukr Moment</Text>
                <Text style={s.wizardOptionSub}>Pause, name a blessing, and share it with your family — a small act of gratitude that stays</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Shukr compose modal ── */}
      <Modal visible={shukrOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={resetShukr}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.wizardSafe}>
            <View style={s.wizardHeader}>
              <TouchableOpacity onPress={shukrStep === 'text' ? resetShukr : () => setShukrStep(shukrStep === 'ayah' ? 'tag' : 'text')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name={shukrStep === 'text' ? 'close' : 'chevron-back'} size={24} color="#6B7280" />
              </TouchableOpacity>
              <Text style={s.wizardHeaderTitle}>
                {shukrStep === 'text' ? 'Shukr Moment' : shukrStep === 'tag' ? 'Add details' : 'Attach an Ayah'}
              </Text>
              <View style={{ width: 24 }} />
            </View>

            {/* Step 1: Photo + Gratitude text */}
            {shukrStep === 'text' && (
              <ScrollView contentContainerStyle={s.wizardBody} keyboardShouldPersistTaps="handled">
                <Text style={s.shukrComposeEmoji}>🌙</Text>
                <Text style={s.wizardTitle}>What are you grateful for?</Text>
                <Text style={s.wizardSub}>Capture a photo, video, or write a note. The act of naming it is the ibadah.</Text>

                {/* Photo / video picker */}
                {shukrPhoto ? (
                  <View style={s.shukrPhotoPreview}>
                    <Image source={{ uri: shukrPhoto }} style={s.shukrPhotoImg} contentFit="cover" />
                    <TouchableOpacity style={s.shukrPhotoRemove} onPress={() => setShukrPhoto(null)}>
                      <Ionicons name="close-circle" size={24} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ) : shukrVideo ? (
                  <View style={s.shukrPhotoPreview}>
                    <VideoCard uri={shukrVideo} style={s.shukrPhotoImg} />
                    <TouchableOpacity style={s.shukrPhotoRemove} onPress={() => setShukrVideo(null)}>
                      <Ionicons name="close-circle" size={24} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={s.shukrPhotoRow}>
                    <TouchableOpacity style={s.shukrPhotoBtn} onPress={() => pickShukrPhoto(true)} activeOpacity={0.8}>
                      <Ionicons name="camera" size={22} color="#1B3D2F" />
                      <Text style={s.shukrPhotoBtnText}>Photo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.shukrPhotoBtn} onPress={() => pickShukrPhoto(false)} activeOpacity={0.8}>
                      <Ionicons name="images" size={22} color="#1B3D2F" />
                      <Text style={s.shukrPhotoBtnText}>Gallery</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.shukrPhotoBtn} onPress={pickShukrVideo} activeOpacity={0.8}>
                      <Ionicons name="videocam" size={22} color="#1B3D2F" />
                      <Text style={s.shukrPhotoBtnText}>Video</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <TextInput
                  ref={shukrInputRef}
                  style={s.shukrInput}
                  placeholder="I am grateful for…"
                  placeholderTextColor="#D1FAE5"
                  multiline
                  value={shukrText}
                  onChangeText={setShukrText}
                />
                <TouchableOpacity
                  style={[s.shukrNextBtn, (!shukrText.trim() && !shukrPhoto && !shukrVideo) && { opacity: 0.4 }]}
                  disabled={!shukrText.trim() && !shukrPhoto && !shukrVideo}
                  onPress={() => setShukrStep('tag')}
                  activeOpacity={0.85}
                >
                  <Text style={s.shukrNextBtnText}>Continue →</Text>
                </TouchableOpacity>
              </ScrollView>
            )}

            {/* Step 2: Child tag + theme */}
            {shukrStep === 'tag' && (
              <ScrollView contentContainerStyle={s.wizardBody} keyboardShouldPersistTaps="handled">
                <Text style={s.wizardTitle}>Add details</Text>
                <Text style={s.wizardSub}>Tag a child and a theme — both optional.</Text>

                {children.length > 0 && (
                  <>
                    <Text style={s.shukrSectionLabel}>TAG A CHILD (optional)</Text>
                    <View style={s.shukrChildRow}>
                      {children.map(child => (
                        <TouchableOpacity
                          key={child.id}
                          style={[s.shukrChildChip, shukrChildren.some(c => c.id === child.id) && s.shukrChildChipActive]}
                          onPress={() => setShukrChildren(prev =>
                            prev.some(c => c.id === child.id)
                              ? prev.filter(c => c.id !== child.id)
                              : [...prev, child]
                          )}
                          activeOpacity={0.75}
                        >
                          <View style={[s.shukrChildDot, { backgroundColor: child.color ?? '#2E7D62' }]} />
                          <Text style={[s.shukrChildChipText, shukrChildren.some(c => c.id === child.id) && { color: '#1B3D2F', fontWeight: '700' }]}>
                            {child.name.split(' ')[0]}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

                <Text style={s.shukrSectionLabel}>THEME (optional)</Text>
                <View style={s.shukrThemeGrid}>
                  {SHUKR_THEMES.map(t => (
                    <TouchableOpacity
                      key={t.key}
                      style={[s.shukrThemeChip, shukrTheme === t.key && { backgroundColor: t.color + '20', borderColor: t.color }]}
                      onPress={() => setShukrTheme(shukrTheme === t.key ? null : t.key)}
                      activeOpacity={0.75}
                    >
                      <Text style={s.shukrThemeChipEmoji}>{t.emoji}</Text>
                      <Text style={[s.shukrThemeChipLabel, shukrTheme === t.key && { color: t.color, fontWeight: '700' }]}>{t.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity style={s.shukrNextBtn} onPress={() => setShukrStep('ayah')} activeOpacity={0.85}>
                  <Text style={s.shukrNextBtnText}>Continue →</Text>
                </TouchableOpacity>
              </ScrollView>
            )}

            {/* Step 3: Ayah selection */}
            {shukrStep === 'ayah' && (
              <ScrollView contentContainerStyle={s.wizardBody} keyboardShouldPersistTaps="handled">
                <Text style={s.wizardTitle}>Attach an Ayah</Text>
                <Text style={s.wizardSub}>Choose a verse about gratitude to accompany this moment, or skip.</Text>

                {SHUKR_AYAHS.map(ayah => (
                  <TouchableOpacity
                    key={ayah.ref}
                    style={[s.shukrAyahOption, shukrAyah?.ref === ayah.ref && s.shukrAyahOptionActive]}
                    onPress={() => setShukrAyah(shukrAyah?.ref === ayah.ref ? null : ayah)}
                    activeOpacity={0.75}
                  >
                    <Text style={s.shukrAyahOptionText}>{ayah.text}</Text>
                    <Text style={s.shukrAyahOptionRef}>— {ayah.ref}</Text>
                    {shukrAyah?.ref === ayah.ref && (
                      <Ionicons name="checkmark-circle" size={18} color="#D97706" style={{ position: 'absolute', top: 12, right: 12 }} />
                    )}
                  </TouchableOpacity>
                ))}

                <TouchableOpacity
                  style={[s.shukrNextBtn, shukrSaving && { opacity: 0.5 }]}
                  onPress={saveShukr}
                  disabled={shukrSaving}
                  activeOpacity={0.85}
                >
                  {shukrSaving ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <ActivityIndicator color="#1B3D2F" size="small" />
                      <Text style={s.shukrNextBtnText}>Posting…</Text>
                    </View>
                  ) : (
                    <Text style={s.shukrNextBtnText}>Post Shukr Moment 🌙</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={{ alignItems: 'center', marginTop: 8 }} onPress={saveShukr} disabled={shukrSaving}>
                  <Text style={{ fontSize: 13, color: '#9CA3AF' }}>Skip and post without ayah</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Accomplishment compose modal ── */}
      <Modal visible={accomOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={resetAccom}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.wizardSafe}>
            <View style={s.wizardHeader}>
              <TouchableOpacity
                onPress={() => {
                  if (accomStep === 'child') resetAccom();
                  else if (accomStep === 'manner') setAccomStep('child');
                  else if (accomStep === 'tree') setAccomStep('manner');
                  else if (accomStep === 'tree_select') setAccomStep('tree');
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name={accomStep === 'child' ? 'close' : 'chevron-back'} size={24} color="#6B7280" />
              </TouchableOpacity>
              <Text style={s.wizardHeaderTitle}>
                {accomStep === 'child' ? 'Who did something great?'
                  : accomStep === 'manner' ? `What did ${accomChild?.name?.split(' ')[0]} do?`
                  : accomStep === 'tree_select' ? 'Choose a tree'
                  : 'Add to a tree?'}
              </Text>
              <View style={{ width: 24 }} />
            </View>

            {/* Step 1: Pick child */}
            {accomStep === 'child' && (
              <ScrollView contentContainerStyle={s.wizardBody}>
                <Text style={s.wizardEyebrow}>POST AN ACCOMPLISHMENT</Text>
                <Text style={s.wizardTitle}>Select a child</Text>
                <Text style={s.wizardSub}>Choose which child showed great character today.</Text>
                {children.map(child => (
                  <TouchableOpacity
                    key={child.id}
                    style={s.wizardOption}
                    activeOpacity={0.75}
                    onPress={() => { setAccomChild(child); setAccomStep('manner'); }}
                  >
                    <View style={[s.sheetAvatarCircle, { backgroundColor: child.color ?? '#2E7D62' }]}>
                      <Text style={s.sheetAvatarText}>{child.name[0].toUpperCase()}</Text>
                    </View>
                    <Text style={[s.wizardOptionTitle, { flex: 1 }]}>{child.name.split(' ')[0]}</Text>
                    <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
                  </TouchableOpacity>
                ))}
                {children.length === 0 && (
                  <Text style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 14, paddingVertical: 20 }}>
                    Add a child profile first.
                  </Text>
                )}
              </ScrollView>
            )}

            {/* Step 2: Pick manner + note */}
            {accomStep === 'manner' && (
              <ScrollView contentContainerStyle={s.wizardBody} keyboardShouldPersistTaps="handled">
                <Text style={s.wizardEyebrow}>POST AN ACCOMPLISHMENT</Text>
                <Text style={s.wizardTitle}>What character did they show?</Text>
                <Text style={s.wizardSub}>Pick the quality they demonstrated, and add a note if you'd like.</Text>
                <View style={s.shukrThemeGrid}>
                  {MANNERS.map(m => (
                    <TouchableOpacity
                      key={m.key}
                      style={[s.shukrThemeChip, accomManner === m.key && { backgroundColor: '#EDF7F2', borderColor: '#1B3D2F' }]}
                      onPress={() => setAccomManner(m.key)}
                      activeOpacity={0.75}
                    >
                      <Text style={{ fontSize: 16 }}>{m.emoji}</Text>
                      <Text style={[s.shukrThemeText, accomManner === m.key && { color: '#1B3D2F', fontWeight: '700' }]}>{m.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={[s.logInput, { marginTop: 16 }]}
                  placeholder={`Add a note about what ${accomChild?.name?.split(' ')[0]} did… (optional)`}
                  placeholderTextColor="#9CA3AF"
                  multiline
                  value={accomNote}
                  onChangeText={setAccomNote}
                />
                <TouchableOpacity
                  style={[s.shukrNextBtn, !accomManner && { opacity: 0.4 }]}
                  disabled={!accomManner}
                  onPress={() => setAccomStep('tree')}
                  activeOpacity={0.85}
                >
                  <Text style={s.shukrNextBtnText}>Continue →</Text>
                </TouchableOpacity>
              </ScrollView>
            )}

            {/* Step 3: Tree prompt — always shown */}
            {accomStep === 'tree' && (
              <ScrollView contentContainerStyle={s.wizardBody}>
                <Text style={s.wizardEyebrow}>ONE MORE THING</Text>
                <Text style={s.wizardTitle}>Add to a tree?</Text>
                <Text style={s.wizardSub}>This accomplishment will appear in the family feed either way. Adding it to a tree also grows their garden and counts toward rewards.</Text>
                <TouchableOpacity
                  style={[s.wizardOption, { marginTop: 8 }]}
                  activeOpacity={0.75}
                  onPress={() => setAccomStep('tree_select')}
                >
                  <View style={[s.wizardOptionIcon, { backgroundColor: '#DCFCE7' }]}>
                    <Text style={{ fontSize: 26 }}>🌳</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.wizardOptionTitle}>Yes, add to a tree</Text>
                    <Text style={s.wizardOptionSub}>Grows the garden and counts toward their reward goal</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.wizardOption}
                  activeOpacity={0.75}
                  onPress={() => saveAccomplishment(null)}
                  disabled={accomSaving}
                >
                  <View style={[s.wizardOptionIcon, { backgroundColor: '#F9FAFB' }]}>
                    <Text style={{ fontSize: 26 }}>⭐</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.wizardOptionTitle}>No, just post to feed</Text>
                    <Text style={s.wizardOptionSub}>Shows in the family feed but doesn't affect any tree</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
                </TouchableOpacity>
                {accomSaving && <Text style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 16 }}>Saving…</Text>}
              </ScrollView>
            )}

            {/* Step 4: Tree selection */}
            {accomStep === 'tree_select' && (
              <ScrollView contentContainerStyle={s.wizardBody}>
                <Text style={s.wizardEyebrow}>SELECT A TREE</Text>
                <Text style={s.wizardTitle}>Which tree?</Text>
                <Text style={s.wizardSub}>Choose the tree to add this accomplishment to.</Text>
                {familyTrees.map(tree => {
                  const child = children.find(c => c.id === tree.child_id);
                  const color = child?.color ?? tree.child_color ?? '#2E7D62';
                  const firstName = tree.child_name?.split(' ')[0] ?? '?';
                  return (
                    <TouchableOpacity
                      key={tree.child_id}
                      style={s.wizardOption}
                      activeOpacity={0.75}
                      onPress={() => saveAccomplishment(tree)}
                      disabled={accomSaving}
                    >
                      <View style={[s.sheetAvatarCircle, { backgroundColor: color }]}>
                        <Text style={s.sheetAvatarText}>{firstName[0].toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.wizardOptionTitle}>{firstName}'s Tree</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
                    </TouchableOpacity>
                  );
                })}
                {familyTrees.length === 0 && (
                  <View style={s.accomNoTreeNote}>
                    <Text style={s.accomNoTreeText}>No trees found in your family yet.</Text>
                  </View>
                )}
                <View style={s.accomNoTreeNote}>
                  <Ionicons name="information-circle-outline" size={16} color="#6B7280" />
                  <Text style={s.accomNoTreeHint}>Don't see your child's tree? It may not have been created yet. You can create one in the Family tab.</Text>
                </View>
                <TouchableOpacity
                  style={[s.wizardOption, { marginTop: 4 }]}
                  activeOpacity={0.75}
                  onPress={() => saveAccomplishment(null)}
                  disabled={accomSaving}
                >
                  <View style={[s.wizardOptionIcon, { backgroundColor: '#F9FAFB' }]}>
                    <Text style={{ fontSize: 26 }}>⭐</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.wizardOptionTitle}>Post to feed only for now</Text>
                    <Text style={s.wizardOptionSub}>No tree — just add it to the family feed</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
                </TouchableOpacity>
                {accomSaving && <Text style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 16 }}>Saving…</Text>}
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
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
  headerCenter:    { alignItems: 'center', flex: 1 },
  headerTitle:     { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  headerMeta:      { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  headerOnlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ADE80' },
  headerMetaText:  { fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.55)' },
  headerMetaDivider: { fontSize: 11, color: 'rgba(255,255,255,0.3)' },
  childAvatarRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1B3D2F', paddingHorizontal: 16, paddingBottom: 12, gap: 0 },
  childAvatarWrap: { borderRadius: 20, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
  childAvatarLabel:{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.6)', marginLeft: 10 },
  headerLink:      { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.85)', textDecorationLine: 'underline' },
  postBar:         { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  postBarAvatar:   { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1B3D2F', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  postBarAvatarText:{ fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  postBarPlaceholder:{ flex: 1, fontSize: 14, color: '#9CA3AF' },
  postBarBtn:      { backgroundColor: '#1B3D2F', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 7 },
  postBarBtnText:  { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  scroll:          { paddingHorizontal: 16, paddingTop: 12 },

  card:       { backgroundColor: WHITE, borderRadius: 16, marginBottom: 12, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 12, elevation: 5 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12 },
  cardDivider:{ height: 1, backgroundColor: '#F3F4F6' },
  cardBody:   { padding: 14, gap: 10 },

  childNameText: { fontSize: 14, fontWeight: '700', color: TEXT },
  dateText:      { fontSize: 12, color: SUB, marginTop: 1 },

  typeBadge:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  typeDot:       { width: 6, height: 6, borderRadius: 3 },
  typeBadgeText: { fontSize: 11, fontWeight: '700' },

  // Accomplishment
  deedRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deedEmoji:    { fontSize: 22 },
  deedLabel:    { fontSize: 15, fontWeight: '700', color: TEXT },
  treeBadge:        { marginLeft: 'auto', backgroundColor: '#F0FDF4', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#BBF7D0' },
  treeBadgeText:    { fontSize: 11, fontWeight: '600', color: '#166534' },
  accomNoTreeNote:  { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  accomNoTreeText:  { fontSize: 14, color: '#6B7280', fontWeight: '600' },
  accomNoTreeHint:  { flex: 1, fontSize: 13, color: '#6B7280', lineHeight: 20 },
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
  commentBtn:           { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 1, borderTopColor: BORDER, marginTop: 4 },
  commentBtnActive:     { backgroundColor: '#EAF2EE' },
  commentBtnText:       { fontSize: 13, color: SUB, fontWeight: '500' },
  commentBtnTextActive: { color: '#1B3D2F', fontWeight: '700' },
  reactionRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 4, marginTop: 4 },
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

  // ── Shukr card ───────────────────────────────────────────
  shukrHeaderIcon:    { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  shukrCardInner:     { flexDirection: 'column', paddingHorizontal: 14, paddingBottom: 14 },
  shukrTopRow:        { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' },
  shukrMoon:          { fontSize: 16 },
  shukrLabel:         { fontSize: 11, fontWeight: '700', color: '#B45309', letterSpacing: 0.5 },
  shukrThemePill:     { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  shukrThemePillText: { fontSize: 11, fontWeight: '600' },
  shukrText:          { fontSize: 15, color: '#1A1A2E', lineHeight: 23, fontStyle: 'italic', marginBottom: 12 },
  shukrAyahWrap:      { backgroundColor: '#FFFBEB', borderRadius: 12, padding: 14, borderLeftWidth: 3, borderLeftColor: '#F59E0B', marginBottom: 12 },
  shukrAyahText:      { fontSize: 13, color: '#78350F', lineHeight: 21, fontStyle: 'italic', marginBottom: 4 },
  shukrAyahRef:       { fontSize: 11, fontWeight: '600', color: '#B45309' },

  // ── Shukr compose ────────────────────────────────────────
  shukrComposeEmoji:  { fontSize: 48, textAlign: 'center', marginBottom: 8 },
  shukrInput:         { backgroundColor: '#1B3D2F', borderRadius: 16, padding: 18, fontSize: 16, color: '#FFFFFF', lineHeight: 26, minHeight: 120, textAlignVertical: 'top', marginTop: 12, marginBottom: 20 },
  shukrNextBtn:       { backgroundColor: '#1B3D2F', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  shukrNextBtnText:   { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

  shukrPhotoRow:      { flexDirection: 'row', gap: 12, marginTop: 16 },
  shukrPhotoBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#F0FDF4', borderRadius: 14, paddingVertical: 14, borderWidth: 1, borderColor: '#BBF7D0' },
  shukrPhotoBtnText:  { fontSize: 14, fontWeight: '600', color: '#1B3D2F' },
  shukrPhotoPreview:  { marginTop: 16, borderRadius: 14, overflow: 'hidden', position: 'relative' },
  shukrPhotoImg:      { width: '100%', aspectRatio: 4 / 3, borderRadius: 14, backgroundColor: '#F3F4F6' },
  shukrPhotoRemove:   { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 12 },
  shukrCardPhoto:     { width: '100%', aspectRatio: 4 / 3, borderRadius: 10, marginTop: 10, marginBottom: 4, backgroundColor: '#F3F4F6' },
  fullscreenOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' },
  fullscreenImg:      { width: '100%', height: '100%' },
  fullscreenClose:    { position: 'absolute', top: 56, right: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  shukrSectionLabel:  { fontSize: 11, fontWeight: '800', color: '#9CA3AF', letterSpacing: 1, marginTop: 20, marginBottom: 10 },
  shukrChildRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  shukrChildChip:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F9FAFB', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5, borderColor: '#E5E7EB' },
  shukrChildChipActive: { backgroundColor: '#EDF7F2', borderColor: '#1B3D2F' },
  shukrChildDot:      { width: 8, height: 8, borderRadius: 4 },
  shukrChildChipText: { fontSize: 13, color: '#6B7280' },
  shukrThemeGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  shukrThemeChip:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F9FAFB', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1.5, borderColor: '#E5E7EB' },
  shukrThemeChipEmoji:{ fontSize: 16 },
  shukrThemeChipLabel:{ fontSize: 13, color: '#6B7280' },
  shukrAyahOption:    { backgroundColor: '#FAFAF9', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1.5, borderColor: '#E5E7EB' },
  shukrAyahOptionActive: { backgroundColor: '#FFFBEB', borderColor: '#F59E0B' },
  shukrAyahOptionText:{ fontSize: 14, color: '#1A1A2E', lineHeight: 22, fontStyle: 'italic', marginBottom: 6 },
  shukrAyahOptionRef: { fontSize: 11, fontWeight: '600', color: '#B45309' },
});
