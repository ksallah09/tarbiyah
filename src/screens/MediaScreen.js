import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, FlatList, Animated, Keyboard, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { getAllChildProfiles } from '../utils/childProfiles';
import { supabase } from '../utils/supabase';
import MediaTourOverlay from '../components/MediaTourOverlay';
import { searchMedia } from '../utils/mediaSearch';
import { Image } from 'expo-image';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://tarbiyah-production.up.railway.app';

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'movie',   label: 'Movie',   icon: 'film-outline' },
  { key: 'show',    label: 'Show',    icon: 'tv-outline' },
  { key: 'book',    label: 'Book',    icon: 'book-outline' },
  { key: 'game',    label: 'Game',    icon: 'game-controller-outline' },
  { key: 'channel', label: 'Channel', icon: 'people-outline' },
  { key: 'video',   label: 'Video',   icon: 'play-circle-outline' },
];

const VERDICT_COLORS = {
  friendly:  { bg: '#F0FDF4', border: '#BBF7D0', text: '#166534', dot: '#22C55E' },
  caution:   { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E', dot: '#F59E0B' },
  avoid:     { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', dot: '#EF4444' },
};

const VERDICT_LABELS = {
  friendly: 'Muslim Friendly',
  caution:  'Watch with Caution',
  avoid:    'Not Recommended',
};

const CONTENT_AREA_LABELS = [
  { key: 'sex_nudity',   label: 'Sex & Nudity' },
  { key: 'violence',     label: 'Violence & Gore' },
  { key: 'profanity',    label: 'Language' },
  { key: 'substances',   label: 'Alcohol, Drugs & Smoking' },
  { key: 'frightening',  label: 'Frightening Scenes' },
  { key: 'faith_values', label: 'Faith & Values' },
];

const SEVERITY_COLOR = {
  none:     '#22C55E',
  mild:     '#F59E0B',
  moderate: '#F97316',
  severe:   '#EF4444',
};

const SEVERITY_LABEL = {
  none:     'None',
  mild:     'Mild',
  moderate: 'Moderate',
  severe:   'Severe',
};

// ── Mock data (replace with real API results) ─────────────────────────────────

const MOCK_RESULTS = [
  { id: '1', title: 'Moana', year: '2016', type: 'movie', verdict: 'friendly' },
  { id: '2', title: 'Inside Out 2', year: '2024', type: 'movie', verdict: 'caution' },
  { id: '3', title: 'Soul', year: '2020', type: 'movie', verdict: 'caution' },
];

const MOCK_TRENDING = [
  { title: 'Inside Out 2',    type: 'movie', verdict: 'caution',  check_count: 47 },
  { title: 'The Wild Robot',  type: 'movie', verdict: 'friendly', check_count: 38 },
  { title: 'Bluey',           type: 'show',  verdict: 'friendly', check_count: 31 },
  { title: 'Dog Man',         type: 'book',  verdict: 'caution',  check_count: 24 },
  { title: 'Minecraft',       type: 'game',  verdict: 'caution',  check_count: 19 },
  { title: 'Encanto',         type: 'movie', verdict: 'caution',  check_count: 17 },
];

const MOCK_VERDICT = {
  title:   'Moana',
  year:    '2016',
  type:    'movie',
  verdict: 'friendly',
  flags: [
    'Mild animated violence',
    'Demigod / mythological themes',
    'Strong themes of self-determination',
  ],
  summary: 'Good fit for Adam. Themes of identity and purpose align well with values you can discuss together. The mythology is clearly fictional — a great opportunity to talk about tawheed in an age-appropriate way.',
  ageNote: 'Suitable for ages 6 and up.',
};

// ── Who's Watching Modal ───────────────────────────────────────────────────────

function WhoIsWatchingModal({ visible, children, onConfirm, onDismiss }) {
  const slideAnim = useRef(new Animated.Value(300)).current;
  const [selected, setSelected] = useState(new Set());
  const [genericAge, setGenericAge] = useState('');
  const [genericGender, setGenericGender] = useState(null);
  const [showGeneric, setShowGeneric] = useState(false);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : 300,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
    if (!visible) {
      setSelected(new Set());
      setGenericAge('');
      setGenericGender(null);
      setShowGeneric(false);
    }
  }, [visible]);

  function toggleChild(id) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }

  function handleConfirm() {
    const selectedChildren = children.filter(c => selected.has(c.id));
    const generic = showGeneric && (genericAge || genericGender)
      ? { age: genericAge, gender: genericGender }
      : null;
    onConfirm({ children: selectedChildren, generic });
  }

  const canConfirm = selected.size > 0 || (showGeneric && (genericAge || genericGender));

  if (!visible) return null;

  return (
    <View style={modal.overlay}>
      <TouchableOpacity style={modal.backdrop} onPress={onDismiss} activeOpacity={1} />
      <Animated.View style={[modal.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={modal.handle} />
        <Text style={modal.title}>Who's watching?</Text>
        <Text style={modal.sub}>We'll tailor the check to their age and stage. Select all that apply.</Text>

        {/* Children */}
        {children.length > 0 && (
          <View style={modal.childRow}>
            {children.map(c => {
              const active = selected.has(c.id);
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[modal.childChip, active && { backgroundColor: c.color ?? '#1B3D2F', borderColor: c.color ?? '#1B3D2F' }]}
                  onPress={() => toggleChild(c.id)}
                  activeOpacity={0.8}
                >
                  <Text style={[modal.childChipText, active && { color: '#FFFFFF' }]}>
                    {c.name}{c.age ? ` (${c.age})` : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Someone else toggle */}
        <TouchableOpacity style={modal.otherBtn} onPress={() => setShowGeneric(v => !v)} activeOpacity={0.8}>
          <Ionicons name={showGeneric ? 'chevron-up' : 'add'} size={16} color="#6B7280" />
          <Text style={modal.otherBtnText}>Someone else</Text>
        </TouchableOpacity>

        {showGeneric && (
          <View style={modal.genericRow}>
            <TextInput
              style={modal.ageInput}
              placeholder="Age"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              value={genericAge}
              onChangeText={setGenericAge}
              maxLength={2}
            />
            {['Boy', 'Girl'].map(g => (
              <TouchableOpacity
                key={g}
                style={[modal.genderChip, genericGender === g && modal.genderChipActive]}
                onPress={() => setGenericGender(prev => prev === g ? null : g)}
                activeOpacity={0.8}
              >
                <Text style={[modal.genderChipText, genericGender === g && modal.genderChipTextActive]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={modal.actions}>
          <TouchableOpacity style={modal.skipBtn} onPress={() => onConfirm({ children: [], generic: null })} activeOpacity={0.8}>
            <Text style={modal.skipText}>Skip</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[modal.confirmBtn, !canConfirm && { opacity: 0.35 }]}
            onPress={handleConfirm}
            disabled={!canConfirm}
            activeOpacity={0.85}
          >
            <Text style={modal.confirmText}>Check it</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

// ── How It Works Card ─────────────────────────────────────────────────────────

const HOW_IT_WORKS = [
  { icon: 'search-outline',        text: 'We look up the title in a real content database (movies, shows, books) to pull its plot, age rating, and content details.' },
  { icon: 'shield-checkmark-outline', text: 'An AI reviews that content against Islamic values — checking for violence, sexual content, language, occult themes, and family values.' },
  { icon: 'person-outline',        text: 'Results are personalised to your child\'s age and stage so the guidance is relevant to them specifically.' },
  { icon: 'information-circle-outline', text: 'Results are a guide, not a fatwa. Use your own judgement — we flag what to look for so you can decide.' },
];

function HowItWorksModal({ visible, onDismiss }) {
  const slideAnim = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : 400,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={how.overlay}>
      <TouchableOpacity style={how.backdrop} onPress={onDismiss} activeOpacity={1} />
      <Animated.View style={[how.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={how.handle} />
        <View style={how.modalHeader}>
          <Ionicons name="information-circle-outline" size={20} color="#1B3D2F" />
          <Text style={how.modalTitle}>How this works</Text>
        </View>
        {HOW_IT_WORKS.map((item, i) => (
          <View key={i} style={how.row}>
            <View style={how.iconWrap}>
              <Ionicons name={item.icon} size={15} color="#1B3D2F" />
            </View>
            <Text style={how.rowText}>{item.text}</Text>
          </View>
        ))}
        <TouchableOpacity style={how.doneBtn} onPress={onDismiss} activeOpacity={0.85}>
          <Text style={how.doneBtnText}>Got it</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ── Verdict Card ──────────────────────────────────────────────────────────────

function parseFlag(f) {
  if (typeof f === 'object' && f !== null && f.title) return f;
  if (typeof f !== 'string') return { title: String(f), description: '' };
  const idx = f.indexOf(': ');
  if (idx !== -1 && idx < 60) return { title: f.slice(0, idx), description: f.slice(idx + 2) };
  // Plain sentence with no colon — show as description with no separate title
  return { title: '', description: f };
}

function VerdictCard({ result, watchersLabel, onClose, onApprove, approveStatus }) {
  const catIcon = CATEGORIES.find(c => c.key === result.type)?.icon ?? 'film-outline';

  return (
    <View style={verdict.card}>
      {/* Header */}
      <View style={verdict.header}>
        {result.poster ? (
          <Image source={{ uri: result.poster }} style={verdict.poster} contentFit="cover" />
        ) : (
          <View style={verdict.posterPlaceholder}>
            <Ionicons name={catIcon} size={26} color="#9CA3AF" />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={verdict.title} numberOfLines={2}>{result.title}</Text>
          <Text style={verdict.meta}>
            {[result.year, result.type?.charAt(0).toUpperCase() + result.type?.slice(1)].filter(Boolean).join(' · ')}
          </Text>
          {watchersLabel ? (
            <View style={verdict.forRow}>
              <Ionicons name="person-outline" size={12} color="#9CA3AF" />
              <Text style={verdict.forLabel}>{watchersLabel}</Text>
            </View>
          ) : null}
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={{ marginLeft: 8 }}>
          <Ionicons name="close" size={20} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      {/* Content areas */}
      {result.content_areas && (
        <>
          <Text style={verdict.sectionLabel}>CONTENT RATING</Text>
          <View style={verdict.contentCard}>
            {CONTENT_AREA_LABELS.map(({ key, label }, i) => {
              const severity = result.content_areas[key];
              if (!severity) return null;
              const color = SEVERITY_COLOR[severity] ?? '#9CA3AF';
              return (
                <React.Fragment key={key}>
                  {i > 0 && <View style={verdict.flagDivider} />}
                  <View style={verdict.contentRow}>
                    <View style={[verdict.severityBar, { backgroundColor: color }]} />
                    <Text style={verdict.contentLabel}>{label}</Text>
                    <Text style={[verdict.severityText, { color }]}>{SEVERITY_LABEL[severity] ?? severity}</Text>
                  </View>
                </React.Fragment>
              );
            })}
          </View>
        </>
      )}

      {/* What to know */}
      {result.flags?.length > 0 && (
        <>
          <Text style={verdict.sectionLabel}>WHAT TO KNOW</Text>
          <View style={verdict.flagsCard}>
            {result.flags.map((f, i) => {
              const { title, description } = parseFlag(f);
              return (
                <React.Fragment key={i}>
                  {i > 0 && <View style={verdict.flagDivider} />}
                  <View style={verdict.flagRow}>
                    <View style={verdict.flagCircle}>
                      <Text style={verdict.flagI}>i</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      {title ? <Text style={verdict.flagTitle}>{title}</Text> : null}
                      {description ? <Text style={verdict.flagDesc}>{description}</Text> : null}
                    </View>
                  </View>
                </React.Fragment>
              );
            })}
          </View>
        </>
      )}

      {/* Overview */}
      {result.summary ? (
        <>
          <Text style={[verdict.sectionLabel, { marginTop: 12 }]}>PARENT SUMMARY</Text>
          <Text style={verdict.summary}>{result.summary}</Text>
        </>
      ) : null}

      {/* Actions */}
      <View style={verdict.btnRow}>
        <TouchableOpacity
          style={[verdict.approveBtn, approveStatus === 'done' && verdict.approveBtnDone]}
          onPress={approveStatus === 'done' ? null : onApprove}
          activeOpacity={approveStatus === 'done' ? 1 : 0.85}
        >
          {approveStatus === 'loading' ? (
            <ActivityIndicator size="small" color="#1B3D2F" />
          ) : approveStatus === 'done' ? (
            <>
              <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
              <Text style={verdict.approveBtnTextDone}>Approved</Text>
            </>
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={16} color="#1B3D2F" />
              <Text style={verdict.approveBtnText}>Add to Approved</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={verdict.newCheckBtn} onPress={onClose} activeOpacity={0.85}>
          <Text style={verdict.newCheckText}>New check</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function MediaScreen({ navigation }) {
  const [query, setQuery]             = useState('');
  const [category, setCategory]       = useState('movie');
  const [children, setChildren]       = useState([]);
  const [searching, setSearching]     = useState(false);
  const [results, setResults]         = useState([]);
  const [showWho, setShowWho]         = useState(false);
  const [pendingResult, setPendingResult] = useState(null);
  const [activeVerdict, setActiveVerdict] = useState(null);
  const [watchersLabel, setWatchersLabel] = useState('');
  const [loading, setLoading]           = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [trending, setTrending]         = useState(MOCK_TRENDING);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [approveStatus, setApproveStatus]   = useState(null); // null | 'loading' | 'done' | 'error'
  const [approved, setApproved]             = useState([]);
  const [approvedFilter, setApprovedFilter] = useState('all');
  const inputRef    = useRef(null);
  const searchTimer = useRef(null);
  const headerAnim      = useRef(new Animated.Value(1)).current;
  const titleAnim       = useRef(new Animated.Value(1)).current;
  const lastScrollY     = useRef(0);
  const headerCollapsed = useRef(false);
  const titleCollapsed  = useRef(false);

  // Verdict/search pages: direction-based full header collapse
  function handleScroll(e) {
    const y    = e.nativeEvent.contentOffset.y;
    const diff = y - lastScrollY.current;
    lastScrollY.current = y;
    if (diff > 6 && y > 10 && !headerCollapsed.current) {
      headerCollapsed.current = true;
      Animated.spring(headerAnim, { toValue: 0, useNativeDriver: false, tension: 200, friction: 20 }).start();
    } else if (diff < -6 && headerCollapsed.current) {
      headerCollapsed.current = false;
      Animated.spring(headerAnim, { toValue: 1, useNativeDriver: false, tension: 200, friction: 20 }).start();
    }
  }

  // Idle page: position-based title-only collapse, restores only at y=0
  function handleIdleScroll(e) {
    const y = e.nativeEvent.contentOffset.y;
    if (y > 10 && !titleCollapsed.current) {
      titleCollapsed.current = true;
      Animated.spring(titleAnim, { toValue: 0, useNativeDriver: false, tension: 200, friction: 20 }).start();
    } else if (y <= 2 && titleCollapsed.current) {
      titleCollapsed.current = false;
      Animated.spring(titleAnim, { toValue: 1, useNativeDriver: false, tension: 200, friction: 20 }).start();
    }
  }

  useFocusEffect(useCallback(() => {
    getAllChildProfiles().then(setChildren);
    fetchTrending();
    fetchApproved();
  }, []));

  async function fetchTrending() {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase.rpc('trending_media_checks', { since: sevenDaysAgo });
      if (error) { console.warn('trending RPC error:', error.message); return; }
      console.log('trending data:', JSON.stringify(data));
      if (data?.length) setTrending(data);
    } catch (e) {
      console.warn('trending fetch error:', e?.message);
    }
  }

  async function fetchApproved() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from('media_approved')
        .select('id, title, year, type, poster, flags, content_areas, summary')
        .eq('user_id', session.user.id)
        .order('approved_at', { ascending: false });
      if (data) setApproved(data);
    } catch {}
  }

  function handleRemoveApproved(item) {
    Alert.alert(
      'Remove from Approved',
      `Remove "${item.title}" from your family approved list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            setApproved(prev => prev.filter(a => a.id !== item.id));
            await supabase.from('media_approved').delete().eq('id', item.id);
          },
        },
      ]
    );
  }


  async function logCheck(title, year, type) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { error } = await supabase.from('media_checks').insert({
        title, year, type,
        user_id: session?.user?.id ?? null,
      });
      if (error) console.warn('logCheck error:', error.message);
    } catch (e) {
      console.warn('logCheck exception:', e?.message);
    }
  }

  async function handleApprove() {
    if (!activeVerdict || approveStatus === 'loading' || approveStatus === 'done') return;
    setApproveStatus('loading');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { error } = await supabase.from('media_approved').upsert({
        user_id:       session?.user?.id ?? null,
        title:         activeVerdict.title,
        year:          activeVerdict.year ?? null,
        type:          activeVerdict.type,
        poster:        activeVerdict.poster ?? null,
        flags:         activeVerdict.flags ?? [],
        content_areas: activeVerdict.content_areas ?? null,
        summary:       activeVerdict.summary ?? null,
      }, { onConflict: 'user_id,title,type' });
      if (error) {
        setApproveStatus(null);
        Alert.alert('Could not save', error.message);
        return;
      }
      await fetchApproved();
      handleClose();
    } catch (err) {
      setApproveStatus(null);
      Alert.alert('Could not save', err?.message ?? String(err));
    }
  }

  function handleSearch(text) {
    setQuery(text);
    if (!text.trim()) { setResults([]); setSearching(false); setSearchLoading(false); return; }
    setSearching(true);
    setSearchLoading(true);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try {
        const data = await searchMedia(text, category);
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 400);
  }

  function handleResultTap(item) {
    Keyboard.dismiss();
    setPendingResult(item);
    setShowWho(true);
  }

  async function handleWhoConfirm({ children: selectedChildren, generic }) {
    setShowWho(false);
    const names = selectedChildren.map(c => c.name);
    if (generic?.age || generic?.gender) names.push([generic.gender, generic.age].filter(Boolean).join(' '));
    setWatchersLabel(names.join(', '));

    // Make watcher info available to the async check below
    const _selectedChildren = selectedChildren;
    const _generic = generic;

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/media/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:      pendingResult.title,
          year:       pendingResult.year,
          type:       pendingResult.type,
          overview:   pendingResult.overview,
          tmdb_id:    pendingResult.tmdb_id,
          childAge:    _selectedChildren[0]?.age ?? _generic?.age ?? null,
          childGender: _selectedChildren[0]?.gender ?? _generic?.gender ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Check failed');
      const result = {
        title:         pendingResult.title,
        year:          pendingResult.year,
        type:          pendingResult.type,
        poster:        pendingResult.poster ?? null,
        verdict:       data.verdict,
        content_areas: data.content_areas ?? null,
        flags:         data.flags ?? [],
        summary:       data.summary,
        ageNote:       data.age_note,
      };
      setActiveVerdict(result);
      setResults([]);
      setQuery('');
      setSearching(false);
      logCheck(result.title, result.year, result.type);
    } catch (err) {
      Alert.alert('Check failed', 'Could not evaluate this title. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleTrendingTap(item) {
    setCategory(item.type);
    setPendingResult(item);
    setShowWho(true);
  }

  function handleClose() {
    setActiveVerdict(null);
    setWatchersLabel('');
    setPendingResult(null);
    setApproveStatus(null);
    lastScrollY.current = 0;
    headerCollapsed.current = false;
    titleCollapsed.current = false;
    fetchTrending();
    fetchApproved();
    Animated.spring(headerAnim, { toValue: 1, useNativeDriver: false, tension: 200, friction: 20 }).start();
    Animated.spring(titleAnim, { toValue: 1, useNativeDriver: false, tension: 200, friction: 20 }).start();
  }

  const catLabel = CATEGORIES.find(c => c.key === category)?.label ?? 'title';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* ── Header ── */}
        <Animated.View style={[styles.header, {
          maxHeight: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 260] }),
          opacity:   headerAnim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0, 1] }),
          overflow:  'hidden',
        }]}>
          {/* Title block — idle only; hidden entirely on search/verdict screens */}
          {!searching && !activeVerdict && !loading && (
            <Animated.View style={{
              maxHeight: titleAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 80] }),
              opacity:   titleAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0, 1] }),
              overflow:  'hidden',
            }}>
              <Text style={styles.headerTitle}>Media Check</Text>
              <Text style={styles.headerSubtitle}>Check if a movie, show, book, or game is compatible with Islamic values.</Text>
            </Animated.View>
          )}

          {/* Category pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
            {CATEGORIES.map(cat => {
              const active = cat.key === category;
              return (
                <TouchableOpacity
                  key={cat.key}
                  style={[styles.catPill, active && styles.catPillActive]}
                  onPress={() => { setCategory(cat.key); setResults([]); setQuery(''); }}
                  activeOpacity={0.8}
                >
                  <Ionicons name={cat.icon} size={14} color={active ? '#FFFFFF' : '#6B7280'} />
                  <Text style={[styles.catPillText, active && styles.catPillTextActive]}>{cat.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Search bar */}
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              placeholder={`Search a ${catLabel.toLowerCase()}...`}
              placeholderTextColor="#9CA3AF"
              value={query}
              onChangeText={handleSearch}
              returnKeyType="search"
              autoCorrect={false}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setSearching(false); }}>
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={styles.howBtn} onPress={() => setShowHowItWorks(true)} activeOpacity={0.7}>
            <Text style={styles.howBtnText}>How this works</Text>
            <Ionicons name="chevron-down-outline" size={13} color="#9CA3AF" />
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.separator} />

        {/* ── Loading spinner ── */}
        {loading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#1B3D2F" />
            <Text style={styles.loadingText}>Checking through an Islamic lens…</Text>
          </View>
        )}

        {/* ── Verdict ── */}
        {!loading && activeVerdict && (
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false} onScroll={handleScroll} scrollEventThrottle={16}>
            <VerdictCard
              result={activeVerdict}
              watchersLabel={watchersLabel}
              onClose={handleClose}
              onApprove={handleApprove}
              approveStatus={approveStatus}
            />
          </ScrollView>
        )}

        {/* ── Search results ── */}
        {!loading && !activeVerdict && searching && (
          <FlatList
            data={results}
            keyExtractor={item => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 24 }}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            ListHeaderComponent={searchLoading ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <ActivityIndicator color="#1B3D2F" />
              </View>
            ) : null}
            ListEmptyComponent={!searchLoading ? (
              <View style={styles.emptyResults}>
                <Text style={styles.emptyResultsText}>No results for "{query}"</Text>
                <Text style={styles.emptyResultsSub}>Try a different spelling or category.</Text>
              </View>
            ) : null}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.resultRow} onPress={() => handleResultTap(item)} activeOpacity={0.8}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultTitle}>{item.title}</Text>
                  <Text style={styles.resultMeta}>{[item.authors ?? item.channelTitle ?? item.year, item.type].filter(Boolean).join(' · ')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#D1D5DB" style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            )}
          />
        )}

        {/* ── Idle state ── */}
        {!loading && !activeVerdict && !searching && (
          <ScrollView
            contentContainerStyle={styles.idleContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onScroll={handleIdleScroll}
            scrollEventThrottle={16}
          >
            {/* Trending in the community */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>TRENDING SEARCHES</Text>
              <View style={styles.trendingList}>
                {trending.map((item, i) => {
                  const icon = CATEGORIES.find(c => c.key === item.type)?.icon ?? 'film-outline';
                  return (
                    <TouchableOpacity
                      key={`${item.title}-${i}`}
                      style={styles.trendingRow}
                      onPress={() => handleTrendingTap(item)}
                      activeOpacity={0.75}
                    >
                      <View style={styles.trendingRank}>
                        <Text style={styles.trendingRankText}>{i + 1}</Text>
                      </View>
                      <Ionicons name={icon} size={15} color="#9CA3AF" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.trendingTitle} numberOfLines={1}>{item.title}</Text>
                        <Text style={styles.trendingType}>{item.type?.charAt(0).toUpperCase() + item.type?.slice(1)}</Text>
                      </View>
                      <View style={styles.trendingRight}>
                        <Text style={styles.trendingCount}>{item.check_count} checks</Text>
                        <Ionicons name="chevron-forward" size={14} color="#D1D5DB" />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Approved list */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>FAMILY APPROVED</Text>
              {approved.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.approvedFilterRow}>
                  {[{ key: 'all', label: 'All' }, ...CATEGORIES].map(cat => {
                    const active = approvedFilter === cat.key;
                    return (
                      <TouchableOpacity
                        key={cat.key}
                        style={[styles.approvedFilterPill, active && styles.approvedFilterPillActive]}
                        onPress={() => setApprovedFilter(cat.key)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.approvedFilterText, active && styles.approvedFilterTextActive]}>{cat.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
              {(() => {
                const filtered = approvedFilter === 'all' ? approved : approved.filter(a => a.type === approvedFilter);
                if (approved.length === 0) return (
                  <View style={styles.emptyCard}>
                    <Ionicons name="checkmark-circle-outline" size={28} color="#D1D5DB" />
                    <Text style={styles.emptyCardText}>Your approved list is empty</Text>
                    <Text style={styles.emptyCardSub}>Titles you approve will appear here for easy reference.</Text>
                  </View>
                );
                if (filtered.length === 0) return (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyCardText}>No approved {approvedFilter}s yet</Text>
                  </View>
                );
                return (
                  <View style={styles.trendingList}>
                    {filtered.map(item => {
                      const icon = CATEGORIES.find(c => c.key === item.type)?.icon ?? 'film-outline';
                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={styles.trendingRow}
                          onPress={() => {
                            setActiveVerdict({
                              title:         item.title,
                              year:          item.year,
                              type:          item.type,
                              poster:        item.poster ?? null,
                              flags:         item.flags ?? [],
                              content_areas: item.content_areas ?? null,
                              summary:       item.summary ?? null,
                            });
                            setWatchersLabel('');
                            setApproveStatus('done');
                          }}
                          activeOpacity={0.75}
                        >
                          {item.poster ? (
                            <Image source={{ uri: item.poster }} style={styles.approvedPoster} contentFit="cover" />
                          ) : (
                            <View style={styles.approvedPosterPlaceholder}>
                              <Ionicons name={icon} size={13} color="#9CA3AF" />
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            <Text style={styles.trendingTitle} numberOfLines={1}>{item.title}</Text>
                            <Text style={styles.trendingType}>{item.year ? `${item.year} · ` : ''}{item.type?.charAt(0).toUpperCase() + item.type?.slice(1)}</Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => handleRemoveApproved(item)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <Ionicons name="trash-outline" size={16} color="#D1D5DB" />
                          </TouchableOpacity>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })()}
            </View>
          </ScrollView>
        )}

        {/* ── Who's watching modal ── */}
        <WhoIsWatchingModal
          visible={showWho}
          children={children}
          onConfirm={handleWhoConfirm}
          onDismiss={() => setShowWho(false)}
        />

        <HowItWorksModal
          visible={showHowItWorks}
          onDismiss={() => setShowHowItWorks(false)}
        />

        <MediaTourOverlay />

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: '#FFFFFF' },
  header:        { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, backgroundColor: '#FFFFFF' },
  headerTitle:   { fontSize: 28, fontWeight: '800', color: '#111827', marginBottom: 4 },
  headerSubtitle:{ fontSize: 13, color: '#6B7280', lineHeight: 19, marginBottom: 14 },

  catRow:        { flexDirection: 'row', gap: 8, paddingRight: 4, marginBottom: 14 },
  catPill:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F3F4F6' },
  catPillActive: { backgroundColor: '#1B3D2F' },
  catPillText:   { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  catPillTextActive: { color: '#FFFFFF' },

  searchBar:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11 },
  searchInput:   { flex: 1, fontSize: 15, color: '#111827', fontWeight: '500' },
  howBtn:        { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, alignSelf: 'flex-start' },
  howBtnText:    { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },

  separator:     { height: 1, backgroundColor: '#F3F4F6' },

  loadingWrap:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText:   { fontSize: 14, color: '#6B7280', fontWeight: '500' },

  resultRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  resultTitle:   { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 2 },
  resultMeta:    { fontSize: 12, color: '#9CA3AF' },
  resultBadge:   { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  resultDot:     { width: 6, height: 6, borderRadius: 3 },
  resultBadgeText: { fontSize: 11, fontWeight: '600' },

  emptyResults:  { padding: 40, alignItems: 'center' },
  emptyResultsText: { fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 4 },
  emptyResultsSub:  { fontSize: 13, color: '#9CA3AF', textAlign: 'center' },

  idleContent:   { padding: 20, paddingBottom: 40, gap: 28 },
  section:       { gap: 12 },
  sectionTitle:  { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1.4 },
  emptyCard:     { alignItems: 'center', padding: 28, backgroundColor: '#F9FAFB', borderRadius: 16, gap: 8 },
  emptyCardText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  emptyCardSub:  { fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 19 },

  trendingList:      { borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#F3F4F6' },
  trendingRow:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F9FAFB', gap: 10 },
  approvedPoster:            { width: 32, height: 48, borderRadius: 4 },
  approvedPosterPlaceholder: { width: 32, height: 48, borderRadius: 4, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  approvedFilterRow:         { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  approvedFilterPill:        { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: '#F3F4F6' },
  approvedFilterPillActive:  { backgroundColor: '#1B3D2F' },
  approvedFilterText:        { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  approvedFilterTextActive:  { color: '#FFFFFF' },
  trendingRank:      { width: 20, alignItems: 'center' },
  trendingRankText:  { fontSize: 12, fontWeight: '700', color: '#D1D5DB' },
  trendingTitle:     { fontSize: 14, fontWeight: '600', color: '#111827' },
  trendingType:      { fontSize: 11, color: '#9CA3AF', fontWeight: '500', marginTop: 1 },
  trendingRight:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trendingDot:       { width: 7, height: 7, borderRadius: 3.5 },
  trendingCount:     { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
});

const how = StyleSheet.create({
  overlay:     { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', zIndex: 200 },
  backdrop:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:       { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 44, gap: 16 },
  handle:      { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 4 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalTitle:  { fontSize: 18, fontWeight: '800', color: '#111827' },
  row:         { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  iconWrap:    { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F0FDF4', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  rowText:     { flex: 1, fontSize: 14, color: '#374151', lineHeight: 21 },
  doneBtn:     { backgroundColor: '#1B3D2F', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  doneBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});

const modal = StyleSheet.create({
  overlay:      { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', zIndex: 100 },
  backdrop:     { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:        { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, gap: 16 },
  handle:       { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 4 },
  title:        { fontSize: 20, fontWeight: '800', color: '#111827' },
  sub:          { fontSize: 14, color: '#6B7280', marginTop: -8 },
  childRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  childChip:    { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  childChipText:{ fontSize: 14, fontWeight: '600', color: '#374151' },
  otherBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  otherBtnText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  genericRow:   { flexDirection: 'row', gap: 10, alignItems: 'center' },
  ageInput:     { width: 72, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, color: '#111827', fontWeight: '600' },
  genderChip:   { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  genderChipActive: { backgroundColor: '#1B3D2F', borderColor: '#1B3D2F' },
  genderChipText:   { fontSize: 14, fontWeight: '600', color: '#374151' },
  genderChipTextActive: { color: '#FFFFFF' },
  actions:      { flexDirection: 'row', gap: 12, marginTop: 4 },
  skipBtn:      { flex: 1, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB', alignItems: 'center' },
  skipText:     { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  confirmBtn:   { flex: 2, paddingVertical: 14, borderRadius: 14, backgroundColor: '#1B3D2F', alignItems: 'center' },
  confirmText:  { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});

const verdict = StyleSheet.create({
  card:              { backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#F0F0F0', padding: 20, gap: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 4 },
  header:            { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  poster:            { width: 56, height: 84, borderRadius: 8 },
  posterPlaceholder: { width: 56, height: 84, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  title:             { fontSize: 22, fontWeight: '800', color: '#111827', lineHeight: 28 },
  meta:              { fontSize: 13, color: '#9CA3AF', marginTop: 3 },
  forRow:            { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  forLabel:          { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  sectionLabel:      { fontSize: 11, fontWeight: '700', color: '#6B7280', letterSpacing: 0.8 },
  contentCard:       { borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
  contentRow:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13 },
  severityBar:       { width: 4, height: 22, borderRadius: 2, marginRight: 12 },
  contentLabel:      { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827' },
  severityText:      { fontSize: 13, fontWeight: '700' },
  flagsCard:         { borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
  flagRow:           { flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: 14 },
  flagDivider:       { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 14 },
  flagCircle:        { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: '#A7C4B5', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  flagI:             { fontSize: 13, fontWeight: '700', fontStyle: 'italic', color: '#2D6A4F' },
  flagTitle:         { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 3 },
  flagDesc:          { fontSize: 13, color: '#6B7280', lineHeight: 19 },
  summary:           { fontSize: 14, color: '#374151', lineHeight: 22 },
  btnRow:            { flexDirection: 'row', gap: 10 },
  approveBtn:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderRadius: 12, borderWidth: 1.5, borderColor: '#1B3D2F' },
  approveBtnDone:    { backgroundColor: '#1B3D2F', borderColor: '#1B3D2F' },
  approveBtnText:    { fontSize: 14, fontWeight: '700', color: '#1B3D2F' },
  approveBtnTextDone:{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  newCheckBtn:       { paddingHorizontal: 18, paddingVertical: 13, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center' },
  newCheckText:      { fontSize: 14, fontWeight: '600', color: '#374151' },
});
