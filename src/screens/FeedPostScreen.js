import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Video as VideoAV, ResizeMode } from 'expo-av';
import { supabase } from '../utils/supabase';
import { getFamilyId } from '../utils/familyGoals';
import { notifyPartner } from '../utils/partnerNotify';

const BG    = '#F4F6F9';
const WHITE = '#FFFFFF';
const TEXT  = '#111827';
const SUB   = '#6B7280';
const GREEN = '#1B3D2F';

const AVATAR_COLORS = ['#1B3D2F','#1A3A6B','#7C3AED','#B45309','#0E7490','#9D174D','#065F46','#92400E'];
function avatarColor(userId) {
  let h = 0;
  for (let i = 0; i < (userId ?? '').length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

const TYPE_META = {
  accomplishment:         { label: 'Accomplishment', color: '#1B3D2F', bg: '#EDF7F2', dot: '#22C55E' },
  general_accomplishment: { label: 'Accomplishment', color: '#1B3D2F', bg: '#EDF7F2', dot: '#22C55E' },
  reflection:  { label: 'Reflection',      color: '#0D1B3E', bg: '#EEF2FF', dot: '#818CF8' },
  incident:    { label: 'Difficult Moment', color: '#92400E', bg: '#FEF3C7', dot: '#F59E0B' },
  shukr:       { label: 'Shukr Moment',    color: '#92400E', bg: '#FFFBEB', dot: '#F59E0B' },
};

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

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const itemDay = new Date(d); itemDay.setHours(0, 0, 0, 0);
  const diff = Math.round((today - itemDay) / 86400000);
  const t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (diff <= 0) return `Today ${t}`;
  if (diff === 1) return `Yesterday ${t}`;
  if (diff < 7)  return `${d.toLocaleDateString('en-GB', { weekday: 'short' })} ${t}`;
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${t}`;
}

function VideoCard({ uri, style }) {
  const [playing, setPlaying] = useState(false);
  if (playing) {
    return <VideoAV source={{ uri }} style={style} useNativeControls resizeMode={ResizeMode.CONTAIN} shouldPlay />;
  }
  return (
    <TouchableOpacity style={[style, { backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', borderRadius: 12 }]} onPress={() => setPlaying(true)} activeOpacity={0.85}>
      <Ionicons name="play-circle" size={56} color="rgba(255,255,255,0.88)" />
    </TouchableOpacity>
  );
}

function PostContent({ item }) {
  if (item._type === 'shukr') {
    const theme = SHUKR_THEMES.find(t => t.key === item.theme);
    return (
      <View style={s.postContent}>
        <View style={s.shukrTopRow}>
          <Text style={s.shukrMoon}>🌙</Text>
          <Text style={s.shukrLabel}>Shukr Moment</Text>
          {theme && (
            <View style={[s.themePill, { backgroundColor: theme.color + '18' }]}>
              <Text style={[s.themePillText, { color: theme.color }]}>{theme.emoji} {theme.label}</Text>
            </View>
          )}
        </View>
        {!!item.text && <Text style={s.shukrText}>{item.text}</Text>}
        {item.video_url && <VideoCard uri={item.video_url} style={s.media} />}
        {item.photo_url && !item.video_url && (
          <Image source={{ uri: item.photo_url }} style={s.media} contentFit="cover" />
        )}
        {item.ayah_text && (
          <View style={s.ayahWrap}>
            <Text style={s.ayahText}>{item.ayah_text}</Text>
            <Text style={s.ayahRef}>— {item.ayah_ref}</Text>
          </View>
        )}
      </View>
    );
  }

  if (item._type === 'reflection') {
    const ratings = item.slider_ratings ?? {};
    const ratingKeys = Object.keys(ratings);
    return (
      <View style={s.postContent}>
        <View style={s.reflectionStats}>
          <View style={s.stat}>
            <Text style={s.statNum}>{item.points_earned ?? 0}</Text>
            <Text style={s.statLabel}>points</Text>
          </View>
          {(item.streak_day ?? 0) > 0 && (
            <View style={[s.stat, { borderLeftWidth: 1, borderLeftColor: '#E5E7EB', paddingLeft: 14 }]}>
              <Text style={[s.statNum, { color: '#FB923C' }]}>{item.streak_day}🔥</Text>
              <Text style={s.statLabel}>streak</Text>
            </View>
          )}
        </View>
        {ratingKeys.length > 0 && (
          <View style={s.ratingsWrap}>
            {ratingKeys.map(key => {
              const cat = CAT_MAP[key] ?? { emoji: '📌', label: key };
              const idx = ratings[key];
              return (
                <View key={key} style={s.ratingPill}>
                  <Text style={s.ratingEmoji}>{cat.emoji}</Text>
                  <Text style={s.ratingLabel}>{cat.label}</Text>
                  <Text style={s.ratingEmoji}>{EMOJI_SCALE[idx] ?? '?'}</Text>
                  <Text style={[s.ratingValue, { color: idx >= 3 ? '#16A34A' : idx >= 2 ? '#D97706' : '#DC2626' }]}>
                    {EMOJI_LABELS[idx] ?? ''}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
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
      </View>
    );
  }

  if (item._type === 'accomplishment' || item._type === 'general_accomplishment') {
    return (
      <View style={s.postContent}>
        {!!item.manner && (
          <Text style={s.accomplishmentManner}>⭐ {item.manner}</Text>
        )}
        {!!item.note && (
          <Text style={s.quoteText}>"{item.note}"</Text>
        )}
      </View>
    );
  }

  if (item._type === 'incident') {
    return (
      <View style={s.postContent}>
        {!!item.note && <Text style={s.incidentNote}>{item.note}</Text>}
      </View>
    );
  }

  return null;
}

export default function FeedPostScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { item, authorName, authorColor, authorPhoto } = route.params;
  const meta = TYPE_META[item._type] ?? TYPE_META.shukr;

  const [comments, setComments]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [text, setText]           = useState('');
  const [sending, setSending]     = useState(false);
  const [myName, setMyName]       = useState('');
  const [myUserId, setMyUserId]   = useState('');
  const flatRef = useRef(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setMyUserId(session.user.id);
        const { data: p } = await supabase.from('profiles').select('name').eq('user_id', session.user.id).single();
        if (p?.name) setMyName(p.name);
      }
    })();
    loadComments();
  }, []);

  async function loadComments() {
    setLoading(true);
    const { data } = await supabase
      .from('feed_comments')
      .select('*')
      .eq('post_id', item.id)
      .eq('post_type', item._type)
      .order('created_at', { ascending: true });
    setComments(data ?? []);
    setLoading(false);
  }

  async function sendComment() {
    const t = text.trim();
    if (!t || !myName || sending) return;
    setSending(true);
    try {
      const familyId = await getFamilyId();
      const { data: inserted, error } = await supabase
        .from('feed_comments')
        .insert({ family_id: familyId, post_id: item.id, post_type: item._type, user_id: myUserId, author_name: myName, text: t })
        .select()
        .single();
      if (error) throw error;
      setComments(prev => [...prev, inserted]);
      setText('');
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
      if (item.user_id && item.user_id !== myUserId) {
        notifyPartner(
          `💬 ${myName.split(' ')[0]} commented`,
          t.length > 80 ? t.slice(0, 77) + '…' : t,
          { screen: 'FamilyFeed' }
        );
      }
    } catch {
      Alert.alert('Error', 'Could not post comment.');
    }
    setSending(false);
  }

  async function deleteComment(comment) {
    if (comment.user_id !== myUserId) return;
    Alert.alert('Delete comment', 'Remove this comment?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        setComments(prev => prev.filter(c => c.id !== comment.id));
        await supabase.from('feed_comments').delete().eq('id', comment.id);
      }},
    ]);
  }

  const displayDate = item._ts ?? item._date ?? item.created_at;

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color={GREEN} />
        </TouchableOpacity>
        <View style={[s.typeBadge, { backgroundColor: meta.bg }]}>
          <View style={[s.typeDot, { backgroundColor: meta.dot }]} />
          <Text style={[s.typeBadgeText, { color: meta.color }]}>{meta.label}</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <View style={{ flex: 1 }}>
        <FlatList
          ref={flatRef}
          data={comments}
          keyExtractor={c => c.id}
          ListHeaderComponent={() => (
            <View>
              {/* Post card */}
              <View style={s.postCard}>
                <View style={s.postCardHeader}>
                  <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: authorColor ?? '#2E7D62', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {authorPhoto
                      ? <Image source={{ uri: authorPhoto }} style={{ width: 38, height: 38 }} contentFit="cover" />
                      : <Text style={{ fontSize: 15, fontWeight: '800', color: '#FFF' }}>{(authorName ?? '?')[0].toUpperCase()}</Text>
                    }
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={s.authorName}>{authorName ?? 'Family'}</Text>
                    {item.child_name && <Text style={s.childName}>{item.child_name}</Text>}
                    <Text style={s.postDate}>{formatTime(displayDate)}</Text>
                  </View>
                </View>
                <PostContent item={item} />
              </View>

              {/* Comments divider */}
              <View style={s.dividerRow}>
                <View style={s.dividerLine} />
                <Text style={s.dividerLabel}>
                  {loading ? 'Loading…' : comments.length === 0 ? 'No comments yet' : `${comments.length} comment${comments.length !== 1 ? 's' : ''}`}
                </Text>
                <View style={s.dividerLine} />
              </View>
              {loading && <ActivityIndicator color={GREEN} style={{ marginTop: 16 }} />}
            </View>
          )}
          renderItem={({ item: c }) => (
            <TouchableOpacity
              style={s.commentRow}
              onLongPress={() => deleteComment(c)}
              activeOpacity={0.85}
            >
              <View style={[s.commentAvatar, { backgroundColor: avatarColor(c.user_id) }]}>
                <Text style={s.commentAvatarText}>{(c.author_name ?? '?')[0].toUpperCase()}</Text>
              </View>
              <View style={s.commentBubble}>
                <Text style={s.commentAuthor}>{c.author_name}</Text>
                <Text style={s.commentText}>{c.text}</Text>
                <Text style={s.commentTime}>{formatTime(c.created_at)}</Text>
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingBottom: 16 }}
        />

        {/* Reply input */}
        <View style={[s.inputRow, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <TextInput
            style={s.input}
            placeholder="Add a comment…"
            placeholderTextColor="#9CA3AF"
            value={text}
            onChangeText={setText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[s.sendBtn, (!text.trim() || sending) && { opacity: 0.4 }]}
            onPress={sendComment}
            disabled={!text.trim() || sending}
            activeOpacity={0.8}
          >
            {sending
              ? <ActivityIndicator color={WHITE} size="small" />
              : <Ionicons name="send" size={18} color={WHITE} />
            }
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:           { flex: 1, backgroundColor: BG },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, backgroundColor: WHITE, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  typeBadge:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  typeDot:        { width: 6, height: 6, borderRadius: 3 },
  typeBadgeText:  { fontSize: 12, fontWeight: '600' },

  postCard:       { margin: 16, backgroundColor: WHITE, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  postCardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  authorName:     { fontSize: 15, fontWeight: '700', color: TEXT },
  childName:      { fontSize: 13, color: GREEN, fontWeight: '600', marginTop: 1 },
  postDate:       { fontSize: 12, color: SUB, marginTop: 2 },

  postContent:    { gap: 10 },
  shukrTopRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  shukrMoon:      { fontSize: 18 },
  shukrLabel:     { fontSize: 14, fontWeight: '700', color: '#92400E' },
  themePill:      { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  themePillText:  { fontSize: 12, fontWeight: '600' },
  shukrText:      { fontSize: 16, color: TEXT, lineHeight: 24 },
  media:          { width: '100%', aspectRatio: 4 / 3, borderRadius: 12 },
  ayahWrap:       { backgroundColor: '#FFFBEB', borderLeftWidth: 3, borderLeftColor: '#F59E0B', padding: 12, borderRadius: 8 },
  ayahText:       { fontSize: 14, color: '#78350F', fontStyle: 'italic', lineHeight: 20 },
  ayahRef:        { fontSize: 12, color: '#B45309', marginTop: 4 },

  reflectionStats: { flexDirection: 'row', gap: 16, marginBottom: 4 },
  stat:            { alignItems: 'center' },
  statNum:         { fontSize: 24, fontWeight: '800', color: GREEN },
  statLabel:       { fontSize: 11, color: SUB, marginTop: 2 },
  ratingsWrap:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  ratingPill:      { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  ratingEmoji:     { fontSize: 13 },
  ratingLabel:     { fontSize: 12, color: TEXT, fontWeight: '500' },
  ratingValue:     { fontSize: 11, fontWeight: '600' },
  answerBlock:     { backgroundColor: '#F9FAFB', borderLeftWidth: 3, borderLeftColor: '#1B3D2F', padding: 10, borderRadius: 6 },
  answerLabel:     { fontSize: 11, fontWeight: '700', color: SUB, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  answerText:      { fontSize: 14, color: TEXT, lineHeight: 20, fontStyle: 'italic' },

  accomplishmentManner: { fontSize: 16, fontWeight: '700', color: TEXT },
  quoteText:       { fontSize: 14, color: SUB, fontStyle: 'italic', lineHeight: 20 },
  incidentNote:    { fontSize: 15, color: TEXT, lineHeight: 22 },

  dividerRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10, marginBottom: 8 },
  dividerLine:     { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  dividerLabel:    { fontSize: 12, color: SUB, fontWeight: '600' },

  commentRow:      { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 10 },
  commentAvatar:   { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  commentAvatarText: { fontSize: 12, fontWeight: '800', color: WHITE },
  commentBubble:   { flex: 1, backgroundColor: WHITE, borderRadius: 12, padding: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  commentAuthor:   { fontSize: 13, fontWeight: '700', color: TEXT, marginBottom: 2 },
  commentText:     { fontSize: 14, color: TEXT, lineHeight: 20 },
  commentTime:     { fontSize: 11, color: SUB, marginTop: 4 },

  inputRow:        { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingTop: 10, gap: 8, backgroundColor: WHITE, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  input:           { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 10 : 8, fontSize: 15, color: TEXT, maxHeight: 100 },
  sendBtn:         { width: 40, height: 40, borderRadius: 20, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
});
