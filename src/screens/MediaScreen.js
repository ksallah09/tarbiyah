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

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://tarbiyah-production.up.railway.app';

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'movie', label: 'Movie',  icon: 'film-outline' },
  { key: 'show',  label: 'Show',   icon: 'tv-outline' },
  { key: 'book',  label: 'Book',   icon: 'book-outline' },
  { key: 'game',  label: 'Game',   icon: 'game-controller-outline' },
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
        <Text style={modal.sub}>We'll tailor the check to their age and stage.</Text>

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
  { icon: 'person-outline',        text: 'The verdict is personalised to your child\'s age and stage so the guidance is relevant to them specifically.' },
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

function VerdictCard({ result, watchersLabel, onClose, onApprove }) {
  const colors = VERDICT_COLORS[result.verdict];
  return (
    <View style={verdict.card}>
      {/* Header */}
      <View style={verdict.header}>
        <View style={{ flex: 1 }}>
          <Text style={verdict.title}>{result.title}</Text>
          <Text style={verdict.meta}>{result.year} · {result.type}</Text>
          {watchersLabel ? <Text style={verdict.forLabel}>For {watchersLabel}</Text> : null}
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="close" size={22} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      {/* Verdict badge */}
      <View style={[verdict.badge, { backgroundColor: colors.bg, borderColor: colors.border }]}>
        <View style={[verdict.dot, { backgroundColor: colors.dot }]} />
        <Text style={[verdict.badgeText, { color: colors.text }]}>{VERDICT_LABELS[result.verdict]}</Text>
        {result.ageNote && <Text style={[verdict.ageNote, { color: colors.text }]}> · {result.ageNote}</Text>}
      </View>

      {/* Flags */}
      {result.flags?.length > 0 && (
        <View style={verdict.flagsWrap}>
          {result.flags.map((f, i) => (
            <View key={i} style={verdict.flagChip}>
              <Text style={verdict.flagText}>{f}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Summary */}
      <Text style={verdict.summary}>{result.summary}</Text>

      {/* Actions */}
      <View style={verdict.btnRow}>
        <TouchableOpacity style={verdict.approveBtn} onPress={onApprove} activeOpacity={0.85}>
          <Ionicons name="checkmark-circle-outline" size={17} color="#1B3D2F" />
          <Text style={verdict.approveBtnText}>Add to Approved</Text>
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
  const inputRef   = useRef(null);
  const searchTimer = useRef(null);

  useFocusEffect(useCallback(() => {
    getAllChildProfiles().then(setChildren);
    fetchTrending();
  }, []));

  async function fetchTrending() {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase.rpc('trending_media_checks', { since: sevenDaysAgo });
      if (data?.length) setTrending(data);
    } catch {
      // keep mock data as fallback until table exists
    }
  }

  async function logCheck(title, year, type, verdict) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.from('media_checks').insert({
        title, year, type, verdict,
        user_id: session?.user?.id ?? null,
      });
    } catch {}
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

  function handleWhoConfirm({ children: selectedChildren, generic }) {
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
        title:   pendingResult.title,
        year:    pendingResult.year,
        type:    pendingResult.type,
        verdict: data.verdict,
        flags:   data.flags ?? [],
        summary: data.summary,
        ageNote: data.age_note,
      };
      setActiveVerdict(result);
      setResults([]);
      setQuery('');
      setSearching(false);
      logCheck(result.title, result.year, result.type, result.verdict);
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
  }

  const catLabel = CATEGORIES.find(c => c.key === category)?.label ?? 'title';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Media Check</Text>
          <Text style={styles.headerSubtitle}>Check if a movie, show, book, or game is compatible with Islamic values.</Text>

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
            <Ionicons name="information-circle-outline" size={13} color="#9CA3AF" />
            <Text style={styles.howBtnText}>How this works</Text>
          </TouchableOpacity>
        </View>

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
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            <VerdictCard
              result={activeVerdict}
              watchersLabel={watchersLabel}
              onClose={handleClose}
              onApprove={() => {}}
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
            renderItem={({ item }) => {
              const colors = VERDICT_COLORS[item.verdict];
              return (
                <TouchableOpacity style={styles.resultRow} onPress={() => handleResultTap(item)} activeOpacity={0.8}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultTitle}>{item.title}</Text>
                    <Text style={styles.resultMeta}>{item.year} · {item.type}</Text>
                  </View>
                  {item.verdict && (
                    <View style={[styles.resultBadge, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                      <View style={[styles.resultDot, { backgroundColor: colors.dot }]} />
                      <Text style={[styles.resultBadgeText, { color: colors.text }]}>{VERDICT_LABELS[item.verdict]}</Text>
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={16} color="#D1D5DB" style={{ marginLeft: 8 }} />
                </TouchableOpacity>
              );
            }}
          />
        )}

        {/* ── Idle state ── */}
        {!loading && !activeVerdict && !searching && (
          <ScrollView
            contentContainerStyle={styles.idleContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Approved list */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>FAMILY APPROVED</Text>
              <View style={styles.emptyCard}>
                <Ionicons name="checkmark-circle-outline" size={28} color="#D1D5DB" />
                <Text style={styles.emptyCardText}>Your approved list is empty</Text>
                <Text style={styles.emptyCardSub}>Titles you approve will appear here for easy reference.</Text>
              </View>
            </View>

            {/* Trending in the community */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>TRENDING SEARCHES</Text>
              <View style={styles.trendingList}>
                {trending.map((item, i) => {
                  const colors = VERDICT_COLORS[item.verdict] ?? VERDICT_COLORS.caution;
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
                        <View style={[styles.trendingDot, { backgroundColor: colors.dot }]} />
                        <Text style={styles.trendingCount}>{item.check_count} checks</Text>
                        <Ionicons name="chevron-forward" size={14} color="#D1D5DB" />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Recently checked */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>RECENTLY CHECKED</Text>
              <View style={styles.emptyCard}>
                <Ionicons name="film-outline" size={28} color="#D1D5DB" />
                <Text style={styles.emptyCardText}>No checks yet</Text>
                <Text style={styles.emptyCardSub}>Search a movie, show, book, or game above to get started.</Text>
              </View>
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
  card:       { backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#F3F4F6', padding: 20, gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
  header:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title:      { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 2 },
  meta:       { fontSize: 13, color: '#9CA3AF', textTransform: 'capitalize' },
  forLabel:   { fontSize: 12, color: '#6B7280', marginTop: 4, fontWeight: '500' },
  badge:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, alignSelf: 'flex-start' },
  dot:        { width: 8, height: 8, borderRadius: 4 },
  badgeText:  { fontSize: 14, fontWeight: '700' },
  ageNote:    { fontSize: 13, fontWeight: '500' },
  flagsWrap:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  flagChip:   { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F3F4F6' },
  flagText:   { fontSize: 12, fontWeight: '500', color: '#374151' },
  summary:    { fontSize: 14, color: '#374151', lineHeight: 22 },
  btnRow:     { flexDirection: 'row', gap: 10, marginTop: 4 },
  approveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderRadius: 12, borderWidth: 1.5, borderColor: '#1B3D2F' },
  approveBtnText: { fontSize: 14, fontWeight: '700', color: '#1B3D2F' },
  newCheckBtn:{ paddingHorizontal: 18, paddingVertical: 13, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center' },
  newCheckText: { fontSize: 14, fontWeight: '600', color: '#374151' },
});
