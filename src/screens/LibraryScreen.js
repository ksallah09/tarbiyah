import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  ActivityIndicator,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import DarkHeader from '../components/DarkHeader';
import { useFocusEffect } from '@react-navigation/native';
import { getSavedInsights, unsaveInsight } from '../utils/savedInsights';
import { getSavedResources, saveResource, unsaveResource } from '../utils/savedResources';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';

const API_URL = 'https://tarbiyah-production.up.railway.app';

const CATEGORIES = ['All', 'Lecture/Video', 'Article/Book', 'Activity/Printable', 'Duas & Adhkar', 'Podcast', 'Other'];
const AGE_RANGES = ['All Ages', 'Toddler (0–3)', 'Young Child (4–7)', 'Pre-teen (8–11)', 'Teen (12+)'];

const REFLECTION_TAGS = [
  'Worked for us',
  'Takes consistency',
  'Better for older kids',
  'Great for toddlers',
  'Quick read/watch',
  'Watch together',
];

export default function LibraryScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('community');

  // ── My Library ──
  const [insights, setInsights]           = useState([]);
  const [savedResources, setSavedResources] = useState([]);
  const [query, setQuery]                 = useState('');
  const [activeTopic, setActiveTopic]     = useState('All');

  // ── Community ──
  const [resources, setResources]             = useState([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [activeCategory, setActiveCategory]   = useState('All');
  const [activeAge, setActiveAge]             = useState('All Ages');
  const [myRecommendations, setMyRecommendations] = useState(new Set());
  const [mySavedIds, setMySavedIds]           = useState(new Set());

  // ── Submit modal ──
  const [showSubmit, setShowSubmit]     = useState(false);
  const [submitUrl, setSubmitUrl]       = useState('');
  const [submitTitle, setSubmitTitle]   = useState('');
  const [submitDesc, setSubmitDesc]     = useState('');
  const [submitCategory, setSubmitCategory] = useState('Lecture/Video');
  const [submitAge, setSubmitAge]       = useState('All Ages');
  const [submitWhy, setSubmitWhy]       = useState('');
  const [submitTags, setSubmitTags]     = useState([]);
  const [submitting, setSubmitting]       = useState(false);
  const [submitError, setSubmitError]     = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [fetchingMeta, setFetchingMeta]   = useState(false);
  const metaDebounceRef = useRef(null);

  useFocusEffect(
    useCallback(() => {
      getSavedInsights().then(setInsights);
      getSavedResources().then(list => {
        setSavedResources(list);
        setMySavedIds(new Set(list.map(r => r.id)));
      });
    }, [])
  );

  useEffect(() => {
    if (activeTab === 'community') fetchResources();
  }, [activeTab, activeCategory, activeAge]);

  useEffect(() => {
    const url = submitUrl.trim();
    if (!url.startsWith('http')) return;
    clearTimeout(metaDebounceRef.current);
    metaDebounceRef.current = setTimeout(async () => {
      setFetchingMeta(true);
      try {
        const res = await fetch(`${API_URL}/community/metadata?url=${encodeURIComponent(url)}`);
        const { title, description } = await res.json();
        if (title) setSubmitTitle(prev => prev || title);
        if (description) setSubmitDesc(prev => prev || description);
      } catch {}
      finally { setFetchingMeta(false); }
    }, 600);
    return () => clearTimeout(metaDebounceRef.current);
  }, [submitUrl]);

  async function fetchResources() {
    setResourcesLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeCategory !== 'All') params.set('category', activeCategory);
      if (activeAge !== 'All Ages') params.set('age', activeAge);
      const res = await fetch(`${API_URL}/community/resources?${params}`);
      const data = await res.json();
      setResources(Array.isArray(data) ? data : []);

      // Fetch user's recommendations
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (token) {
        const recRes = await fetch(`${API_URL}/community/resources/my-recommendations`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const recData = await recRes.json();
        setMyRecommendations(new Set(Array.isArray(recData) ? recData : []));
      }
    } catch {
      setResources([]);
    } finally {
      setResourcesLoading(false);
    }
  }

  async function handleRecommend(resource) {
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;
    if (!token) return;

    const isRec = myRecommendations.has(resource.id);
    // Optimistic update
    setMyRecommendations(prev => {
      const next = new Set(prev);
      isRec ? next.delete(resource.id) : next.add(resource.id);
      return next;
    });
    setResources(prev => prev.map(r =>
      r.id === resource.id
        ? { ...r, recommend_count: r.recommend_count + (isRec ? -1 : 1) }
        : r
    ));

    try {
      await fetch(`${API_URL}/community/resources/${resource.id}/recommend`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // Revert on failure
      setMyRecommendations(prev => {
        const next = new Set(prev);
        isRec ? next.add(resource.id) : next.delete(resource.id);
        return next;
      });
    }
  }

  async function handleSaveResource(resource) {
    const isSaved = mySavedIds.has(resource.id);
    if (isSaved) {
      await unsaveResource(resource.id);
      setMySavedIds(prev => { const next = new Set(prev); next.delete(resource.id); return next; });
      setSavedResources(prev => prev.filter(r => r.id !== resource.id));
    } else {
      await saveResource(resource);
      setMySavedIds(prev => new Set([...prev, resource.id]));
      setSavedResources(prev => [...prev, { ...resource, kind: 'resource' }]);
    }
  }

  async function handleSubmit() {
    if (!submitUrl.trim() || !submitTitle.trim()) {
      setSubmitError('Please add a URL and title.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      const res = await fetch(`${API_URL}/community/resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          url: submitUrl.trim(),
          title: submitTitle.trim(),
          description: submitDesc.trim() || undefined,
          category: submitCategory,
          age_range: submitAge,
          why_helped: submitWhy.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setSubmitError(err.error ?? 'Could not submit. Please try again.');
        return;
      }
      setSubmitSuccess(true);
      resetSubmitForm();
      if (activeTab === 'community') fetchResources();
    } catch {
      setSubmitError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function resetSubmitForm() {
    setSubmitUrl('');
    setSubmitTitle('');
    setSubmitDesc('');
    setSubmitCategory('Lecture/Video');
    setSubmitAge('All Ages');
    setSubmitWhy('');
    setSubmitTags([]);
    setSubmitError('');
  }

  function closeSubmit() {
    setShowSubmit(false);
    setSubmitSuccess(false);
    resetSubmitForm();
  }

  // ── Library tab helpers ──
  const allTopics = ['All', ...Array.from(new Set(insights.flatMap(i => i.tags ?? []))).sort()];
  const filtered = insights.filter(i => {
    const matchTopic = activeTopic === 'All' || (i.tags ?? []).includes(activeTopic);
    const q = query.toLowerCase();
    return matchTopic && (!q || i.insightTitle?.toLowerCase().includes(q) || i.body?.toLowerCase().includes(q));
  });

  const totalLibraryCount = insights.length + savedResources.length;
  const subtitleText = activeTab === 'library'
    ? (totalLibraryCount === 0 ? 'Nothing saved yet' : `${totalLibraryCount} saved item${totalLibraryCount !== 1 ? 's' : ''}`)
    : 'Parent-curated resources';

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <View style={styles.bgTop} />
      <StatusBar style="light" />

      <DarkHeader title="Resources" subtitle={subtitleText} />

      {/* ── Tab toggle ── */}
      <View style={styles.tabToggleWrap}>
        <View style={styles.tabToggle}>
          <TouchableOpacity
            style={[styles.tabToggleBtn, activeTab === 'community' && styles.tabToggleBtnActive]}
            onPress={() => setActiveTab('community')}
          >
            <Text style={[styles.tabToggleText, activeTab === 'community' && styles.tabToggleTextActive]}>Community</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabToggleBtn, activeTab === 'library' && styles.tabToggleBtnActive]}
            onPress={() => setActiveTab('library')}
          >
            <Text style={[styles.tabToggleText, activeTab === 'library' && styles.tabToggleTextActive]}>My Library</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.sheet}>
        {activeTab === 'library' ? (
          // ─── MY LIBRARY ───────────────────────────────────────────────────
          <>
            <View style={styles.controls}>
              <View style={styles.searchBar}>
                <Ionicons name="search-outline" size={17} color="#9CA3AF" />
                <View style={{ flex: 1 }}>
                  {!query && <Text style={styles.searchPlaceholder} pointerEvents="none">Search saved insights...</Text>}
                  <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} />
                </View>
                {query.length > 0 && (
                  <TouchableOpacity onPress={() => setQuery('')}>
                    <Ionicons name="close-circle" size={17} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </View>
              {allTopics.length > 1 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                  {allTopics.map(topic => (
                    <TouchableOpacity
                      key={topic}
                      style={[styles.filterChip, activeTopic === topic && styles.filterChipActive]}
                      onPress={() => setActiveTopic(topic)}
                    >
                      <Text style={[styles.filterChipText, activeTopic === topic && styles.filterChipTextActive]}>{topic}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            {totalLibraryCount === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="bookmark-outline" size={48} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>Nothing saved yet</Text>
                <Text style={styles.emptyBody}>Bookmark insights or save community resources to find them here.</Text>
              </View>
            ) : (
              <FlatList
                data={[
                  ...filtered.map(i => ({ ...i, _listKind: 'insight' })),
                  ...savedResources.map(r => ({ ...r, _listKind: 'resource' })),
                ]}
                keyExtractor={item => item._listKind + item.id}
                contentContainerStyle={[styles.listContent, { paddingBottom: 32 }]}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={styles.empty}>
                    <Text style={styles.emptyTitle}>No matches found</Text>
                    <Text style={styles.emptyBody}>Try a different search or filter.</Text>
                  </View>
                }
                renderItem={({ item }) => {
                  if (item._listKind === 'resource') {
                    return (
                      <View style={styles.resourceCard}>
                        <View style={styles.resourceCardTop}>
                          <View style={styles.resourceCatPill}>
                            <Text style={styles.resourceCatText}>{item.category}</Text>
                          </View>
                          <Text style={styles.resourceAge}>{item.age_range}</Text>
                        </View>
                        <Text style={styles.resourceTitle}>{item.title}</Text>
                        {item.submitter_name ? (
                          <Text style={styles.resourcePostedBy}>Shared by {item.submitter_name}</Text>
                        ) : null}
                        {item.why_helped ? (
                          <Text style={styles.resourceWhy}>"{item.why_helped}"</Text>
                        ) : null}
                        <View style={styles.resourceActions}>
                          <TouchableOpacity
                            style={[styles.saveBtn, styles.saveBtnActive]}
                            onPress={async () => {
                              await unsaveResource(item.id);
                              setMySavedIds(prev => { const next = new Set(prev); next.delete(item.id); return next; });
                              setSavedResources(prev => prev.filter(r => r.id !== item.id));
                            }}
                            activeOpacity={0.75}
                          >
                            <Ionicons name="bookmark" size={15} color="#FFFFFF" />
                            <Text style={[styles.saveBtnText, { color: '#FFFFFF' }]}>Saved</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.openBtn}
                            onPress={() => { if (item.url) Linking.openURL(item.url); }}
                            activeOpacity={0.75}
                          >
                            <Ionicons name="open-outline" size={15} color="#1B3D2F" />
                            <Text style={styles.openBtnText}>Open</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  }
                  const isSpiritual = item.type === 'spiritual';
                  const accentColor = isSpiritual ? '#2E7D62' : '#D4871A';
                  return (
                    <TouchableOpacity
                      style={styles.card}
                      activeOpacity={0.85}
                      onPress={() => navigation.navigate('InsightDetail', { insight: item })}
                    >
                      <View style={[styles.cardAccent, { backgroundColor: accentColor }]} />
                      <View style={styles.cardBody}>
                        <View style={styles.cardTopRow}>
                          <Text style={[styles.cardType, { color: accentColor }]}>
                            {isSpiritual ? 'Spiritual Insight' : 'Research Insight'}
                          </Text>
                          <TouchableOpacity onPress={async () => {
                            await unsaveInsight(item.id);
                            setInsights(prev => prev.filter(i => i.id !== item.id));
                          }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="bookmark" size={18} color={accentColor} />
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.cardTitle}>{item.insightTitle}</Text>
                        <Text style={styles.cardPreview} numberOfLines={2}>{item.body}</Text>
                        {item.tags?.length > 0 && (
                          <View style={styles.tagsRow}>
                            {item.tags.slice(0, 3).map(tag => (
                              <View key={tag} style={[styles.tag, { backgroundColor: accentColor + '15' }]}>
                                <Text style={[styles.tagText, { color: accentColor }]}>{tag}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </>
        ) : (
          // ─── COMMUNITY ────────────────────────────────────────────────────
          <>
            <View style={styles.controls}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.filterChip, activeCategory === cat && styles.filterChipActive]}
                    onPress={() => setActiveCategory(cat)}
                  >
                    <Text style={[styles.filterChipText, activeCategory === cat && styles.filterChipTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                {AGE_RANGES.map(age => (
                  <TouchableOpacity
                    key={age}
                    style={[styles.filterChip, activeAge === age && styles.filterChipActive]}
                    onPress={() => setActiveAge(age)}
                  >
                    <Text style={[styles.filterChipText, activeAge === age && styles.filterChipTextActive]}>{age}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {resourcesLoading ? (
              <View style={styles.empty}>
                <ActivityIndicator size="large" color="#1B3D2F" />
              </View>
            ) : resources.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="people-outline" size={48} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>No resources yet</Text>
                <Text style={styles.emptyBody}>Be the first to share a resource with the community.</Text>
              </View>
            ) : (
              <FlatList
                data={resources}
                keyExtractor={item => item.id}
                contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const recommended = myRecommendations.has(item.id);
                  const saved = mySavedIds.has(item.id);
                  return (
                    <View style={styles.resourceCard}>
                      <View style={styles.resourceCardTop}>
                        <View style={styles.resourceCatPill}>
                          <Text style={styles.resourceCatText}>{item.category}</Text>
                        </View>
                        <Text style={styles.resourceAge}>{item.age_range}</Text>
                      </View>
                      <Text style={styles.resourceTitle}>{item.title}</Text>
                      {item.submitter_name ? (
                        <Text style={styles.resourcePostedBy}>Shared by {item.submitter_name}</Text>
                      ) : null}
                      {item.why_helped ? (
                        <Text style={styles.resourceWhy}>"{item.why_helped}"</Text>
                      ) : null}
                      <View style={styles.resourceActions}>
                        <TouchableOpacity
                          style={[styles.recommendBtn, recommended && styles.recommendBtnActive]}
                          onPress={() => handleRecommend(item)}
                          activeOpacity={0.75}
                        >
                          <Ionicons name={recommended ? 'heart' : 'heart-outline'} size={15} color={recommended ? '#FFFFFF' : '#1B3D2F'} />
                          <Text style={[styles.recommendBtnText, recommended && { color: '#FFFFFF' }]}>
                            {item.recommend_count > 0 ? `${item.recommend_count} recommend` : 'Recommend'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.saveBtn, saved && styles.saveBtnActive]}
                          onPress={() => handleSaveResource(item)}
                          activeOpacity={0.75}
                        >
                          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={15} color={saved ? '#FFFFFF' : '#1B3D2F'} />
                          <Text style={[styles.saveBtnText, saved && { color: '#FFFFFF' }]}>
                            {saved ? 'Saved' : 'Save'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.openBtn}
                          onPress={() => { if (item.url) Linking.openURL(item.url); }}
                          activeOpacity={0.75}
                        >
                          <Ionicons name="open-outline" size={15} color="#1B3D2F" />
                          <Text style={styles.openBtnText}>Open</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                }}
              />
            )}

            {/* Share a Resource FAB */}
            <TouchableOpacity
              style={[styles.fab, { bottom: insets.bottom + 20 }]}
              onPress={() => setShowSubmit(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={22} color="#FFFFFF" />
              <Text style={styles.fabText}>Share a Resource</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* ── Submit Modal ── */}
      <Modal visible={showSubmit} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView style={styles.modalSafe} edges={['top']}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Share a Resource</Text>
              <TouchableOpacity onPress={closeSubmit} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color="#374151" />
              </TouchableOpacity>
            </View>

            {submitSuccess ? (
              <View style={styles.successState}>
                <View style={styles.successIcon}>
                  <Ionicons name="checkmark-circle" size={56} color="#2E7D62" />
                </View>
                <Text style={styles.successTitle}>JazakAllah Khayran!</Text>
                <Text style={styles.successBody}>Your resource has been shared with the community.</Text>
                <TouchableOpacity style={styles.successBtn} onPress={closeSubmit}>
                  <Text style={styles.successBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.fieldLabel}>Resource Link *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="https://..."
                  value={submitUrl}
                  onChangeText={setSubmitUrl}
                  autoCapitalize="none"
                  keyboardType="url"
                />

                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                  <Text style={[styles.fieldLabel, { marginBottom: 0 }]}>Title *</Text>
                  {fetchingMeta && <ActivityIndicator size="small" color="#1B3D2F" />}
                </View>
                <TextInput
                  style={styles.textInput}
                  placeholder="What is this resource called?"
                  value={submitTitle}
                  onChangeText={setSubmitTitle}
                />

                <Text style={styles.fieldLabel}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow} style={{ marginBottom: 16 }}>
                  {CATEGORIES.filter(c => c !== 'All').map(cat => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.filterChip, submitCategory === cat && styles.filterChipActive]}
                      onPress={() => setSubmitCategory(cat)}
                    >
                      <Text style={[styles.filterChipText, submitCategory === cat && styles.filterChipTextActive]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.fieldLabel}>Best for age</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow} style={{ marginBottom: 16 }}>
                  {AGE_RANGES.map(age => (
                    <TouchableOpacity
                      key={age}
                      style={[styles.filterChip, submitAge === age && styles.filterChipActive]}
                      onPress={() => setSubmitAge(age)}
                    >
                      <Text style={[styles.filterChipText, submitAge === age && styles.filterChipTextActive]}>{age}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.fieldLabel}>Why did this help your family? <Text style={styles.fieldLabelOptional}>(optional)</Text></Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="Share a brief reflection..."
                  value={submitWhy}
                  onChangeText={setSubmitWhy}
                  multiline
                  numberOfLines={3}
                />

                <Text style={styles.fieldLabel}>Quick tags <Text style={styles.fieldLabelOptional}>(optional)</Text></Text>
                <View style={styles.tagsRow}>
                  {REFLECTION_TAGS.map(tag => {
                    const selected = submitTags.includes(tag);
                    return (
                      <TouchableOpacity
                        key={tag}
                        style={[styles.reflectionTag, selected && styles.reflectionTagActive]}
                        onPress={() => setSubmitTags(prev =>
                          selected ? prev.filter(t => t !== tag) : [...prev, tag]
                        )}
                      >
                        {selected && <Ionicons name="checkmark" size={11} color="#2E7D62" style={{ marginRight: 3 }} />}
                        <Text style={[styles.reflectionTagText, selected && styles.reflectionTagTextActive]}>{tag}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {submitError ? <Text style={styles.submitError}>{submitError}</Text> : null}

                <TouchableOpacity
                  style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                  onPress={handleSubmit}
                  disabled={submitting}
                  activeOpacity={0.85}
                >
                  {submitting
                    ? <ActivityIndicator color="#FFFFFF" size="small" />
                    : <Text style={styles.submitBtnText}>Submit Resource</Text>
                  }
                </TouchableOpacity>
                <Text style={styles.submitNote}>All submissions are reviewed before going live.</Text>
                <View style={{ height: 32 }} />
              </ScrollView>
            )}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6F8' },
  bgTop: { position: 'absolute', top: 0, left: 0, right: 0, height: '40%', backgroundColor: '#1B3D2F' },
  sheet: { flex: 1, backgroundColor: '#F5F6F8', overflow: 'hidden' },

  // ── Tab toggle ──
  tabToggleWrap: {
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  tabToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 3,
  },
  tabToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabToggleBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  tabToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.65)',
  },
  tabToggleTextActive: {
    color: '#1B3D2F',
  },

  // ── Controls ──
  controls: {
    backgroundColor: '#F5F6F8',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInput: { fontSize: 14, color: '#1A1A2E', flex: 1 },
  searchPlaceholder: {
    position: 'absolute', top: 0, left: 0, right: 0,
    fontSize: 14, color: '#9CA3AF',
  },
  filterRow: { paddingHorizontal: 4, gap: 8, alignItems: 'center' },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100, backgroundColor: '#E8EAED' },
  filterChipActive: { backgroundColor: '#1B3D2F' },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  filterChipTextActive: { color: '#FFFFFF' },

  // ── Empty ──
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#374151', textAlign: 'center' },
  emptyBody: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 22 },

  // ── Saved insight cards ──
  listContent: { paddingHorizontal: 20, paddingBottom: 32 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 12,
    flexDirection: 'row', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: 14 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardType: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1C1C1E', marginBottom: 4, lineHeight: 21 },
  cardPreview: { fontSize: 13, color: '#6B7280', lineHeight: 19, marginBottom: 10 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 11, fontWeight: '600' },

  // ── Community resource cards ──
  resourceCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 12,
    padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  resourceCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  resourceCatPill: {
    backgroundColor: 'rgba(27,61,47,0.08)',
    borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4,
  },
  resourceCatText: { fontSize: 11, fontWeight: '700', color: '#1B3D2F' },
  resourceAge: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },
  resourceTitle: { fontSize: 15, fontWeight: '700', color: '#1C1C1E', lineHeight: 21, marginBottom: 4 },
  resourcePostedBy: { fontSize: 12, color: '#9CA3AF', fontWeight: '500', marginBottom: 8 },
  resourceWhy: { fontSize: 13, color: '#6B7280', lineHeight: 20, fontStyle: 'italic', marginBottom: 12 },
  resourceActions: { flexDirection: 'row', gap: 8 },
  recommendBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100,
    backgroundColor: 'rgba(27,61,47,0.07)',
  },
  recommendBtnActive: { backgroundColor: '#1B3D2F' },
  recommendBtnText: { fontSize: 13, fontWeight: '600', color: '#1B3D2F' },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100,
    backgroundColor: 'rgba(27,61,47,0.07)',
  },
  saveBtnActive: { backgroundColor: '#1B3D2F' },
  saveBtnText: { fontSize: 13, fontWeight: '600', color: '#1B3D2F' },
  openBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100,
    borderWidth: 1, borderColor: 'rgba(27,61,47,0.2)',
  },
  openBtnText: { fontSize: 13, fontWeight: '600', color: '#1B3D2F' },

  // ── FAB ──
  fab: {
    position: 'absolute', right: 20,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#1B3D2F', borderRadius: 100,
    paddingVertical: 13, paddingHorizontal: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 6,
  },
  fabText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  // ── Submit modal ──
  modalSafe: { flex: 1, backgroundColor: '#FFFFFF' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#F0F1F3',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#1C1C1E' },
  modalScroll: { paddingHorizontal: 20, paddingTop: 20 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
  fieldLabelOptional: { fontWeight: '400', color: '#9CA3AF' },
  textInput: {
    backgroundColor: '#F5F6F8', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: '#1C1C1E', marginBottom: 20,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  reflectionTag: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 100, borderWidth: 1, borderColor: '#E5E7EB',
    backgroundColor: '#F5F6F8', marginBottom: 8,
  },
  reflectionTagActive: { borderColor: '#2E7D62', backgroundColor: '#E8F5EF' },
  reflectionTagText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  reflectionTagTextActive: { color: '#2E7D62' },
  submitError: { fontSize: 13, color: '#DC2626', marginBottom: 12, lineHeight: 19 },
  submitBtn: {
    backgroundColor: '#1B3D2F', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  submitNote: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginTop: 10 },

  // ── Success state ──
  successState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 16 },
  successIcon: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: '#E8F5EF', alignItems: 'center', justifyContent: 'center',
  },
  successTitle: { fontSize: 22, fontWeight: '800', color: '#1C1C1E' },
  successBody: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 23 },
  successBtn: {
    backgroundColor: '#1B3D2F', borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 40, marginTop: 8,
  },
  successBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
