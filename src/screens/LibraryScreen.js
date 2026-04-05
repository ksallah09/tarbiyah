import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { getSavedInsights, unsaveInsight } from '../utils/savedInsights';

const ASSET_MAP = {
  'Nouman Ali Khan.png':              require('../../assets/Nouman Ali Khan.png'),
  'YAsmin-MOgahed.png':               require('../../assets/YAsmin-MOgahed.png'),
  'belal-assaad.jpg':                 require('../../assets/belal-assaad.jpg'),
  'national-inst-child-health.jpeg':  require('../../assets/national-inst-child-health.jpeg'),
  'childmind.png':                    require('../../assets/childmind.png'),
  'spiritual-insights.png':           require('../../assets/spiritual-insights.png'),
  'science-insights.png':             require('../../assets/science-insights.png'),
};

export default function LibraryScreen({ navigation }) {
  const [insights, setInsights] = useState([]);
  const [query, setQuery]             = useState('');
  const [activeTopic, setActiveTopic] = useState('All');
  const [filterScroll, setFilterScroll] = useState(0);

  // Reload saved insights every time the tab is focused
  useFocusEffect(
    useCallback(() => {
      getSavedInsights().then(setInsights);
    }, [])
  );

  // Collect all unique topics across saved insights
  const allTopics = ['All', ...Array.from(
    new Set(insights.flatMap(i => i.tags ?? []))
  ).sort()];

  const filtered = insights.filter(i => {
    const matchTopic = activeTopic === 'All' || (i.tags ?? []).includes(activeTopic);
    const q = query.toLowerCase();
    const matchQuery = !q ||
      i.insightTitle?.toLowerCase().includes(q) ||
      i.body?.toLowerCase().includes(q);
    return matchTopic && matchQuery;
  });

  async function handleUnsave(id) {
    await unsaveInsight(id);
    setInsights(prev => prev.filter(i => i.id !== id));
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Unified sticky header ── */}
      <View style={styles.stickyHeader}>
        <Text style={styles.title}>Library</Text>
        <Text style={styles.subtitle}>
          {insights.length === 0 ? 'No saved insights yet' : `${insights.length} saved insight${insights.length !== 1 ? 's' : ''}`}
        </Text>

        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={17} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by title or content..."
            placeholderTextColor="#9CA3AF"
            value={query}
            onChangeText={setQuery}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={17} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        {allTopics.length > 1 && (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
              onScroll={e => setFilterScroll(e.nativeEvent.contentOffset.x)}
              scrollEventThrottle={16}
            >
              {allTopics.map(topic => (
                <TouchableOpacity
                  key={topic}
                  style={[styles.filterChip, activeTopic === topic && styles.filterChipActive]}
                  onPress={() => setActiveTopic(topic)}
                >
                  <Text style={[styles.filterChipText, activeTopic === topic && styles.filterChipTextActive]}>
                    {topic}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.scrollDots}>
              {Array.from({ length: Math.min(allTopics.length, 5) }).map((_, i) => {
                const segmentWidth = 80;
                const active = Math.round(filterScroll / segmentWidth) === i;
                return (
                  <View
                    key={i}
                    style={[styles.scrollDot, active && styles.scrollDotActive]}
                  />
                );
              })}
            </View>
          </>
        )}
      </View>

      {/* ── List ── */}
      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="bookmark-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>
            {insights.length === 0 ? 'Nothing saved yet' : 'No matches found'}
          </Text>
          <Text style={styles.emptyBody}>
            {insights.length === 0
              ? 'Tap the bookmark icon on any insight to save it here.'
              : 'Try a different search or filter.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isSpiritual = item.type === 'spiritual';
            const accentColor = isSpiritual ? '#2E7D62' : '#D4871A';
            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('InsightDetail', { insight: item })}
              >
                {/* Type accent bar */}
                <View style={[styles.cardAccent, { backgroundColor: accentColor }]} />

                <View style={styles.cardBody}>
                  {/* Top row: byline + unsave */}
                  <View style={styles.cardTopRow}>
                    <View style={styles.byline}>
                      <Image
                        source={ASSET_MAP[item.speakerImage] ?? ASSET_MAP['spiritual-insights.png']}
                        style={styles.bylineImage}
                      />
                      <Text style={[styles.bylineName, { color: accentColor }]}>{item.speakerName}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleUnsave(item.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="bookmark" size={18} color={accentColor} />
                    </TouchableOpacity>
                  </View>

                  {/* Title + preview */}
                  <Text style={styles.cardTitle}>{item.insightTitle}</Text>
                  <Text style={styles.cardPreview} numberOfLines={2}>{item.body}</Text>

                  {/* Tags */}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6F8' },

  // ── Sticky header ──
  stickyHeader: {
    backgroundColor: '#F5F6F8',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  title: { fontSize: 28, fontWeight: '700', color: '#1B3D2F' },
  subtitle: { fontSize: 13, color: '#9CA3AF', fontWeight: '500', marginTop: -8 },
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
  searchInput: { flex: 1, fontSize: 14, color: '#1A1A2E' },
  filterRow: { paddingHorizontal: 20, gap: 8, alignItems: 'center' },
  scrollDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
  },
  scrollDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
  },
  scrollDotActive: {
    width: 18,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1B3D2F',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 100,
    backgroundColor: '#E8EAED',
  },
  filterChipActive: { backgroundColor: '#1B3D2F' },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  filterChipTextActive: { color: '#FFFFFF' },

  // ── Empty state ──
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#374151', textAlign: 'center' },
  emptyBody: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 22 },

  // ── Cards ──
  listContent: { paddingHorizontal: 20, paddingBottom: 32 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 12,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardAccent: {
    width: 4,
  },
  cardBody: {
    flex: 1,
    padding: 14,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  byline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  bylineImage: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  bylineName: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
    lineHeight: 21,
  },
  cardPreview: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 19,
    marginBottom: 10,
  },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 11, fontWeight: '600' },
});
