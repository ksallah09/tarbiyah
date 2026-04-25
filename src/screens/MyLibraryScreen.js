import React, { useState, useRef } from 'react';
import {
  View, Text, ScrollView, FlatList, TouchableOpacity,
  StyleSheet, TextInput, Image, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import DarkHeader from '../components/DarkHeader';
import { getSavedInsights, unsaveInsight } from '../utils/savedInsights';
import { getSavedResources, unsaveResource } from '../utils/savedResources';

const CATEGORY_CONFIG = {
  'Lecture/Video':      { color: '#2E7D62', icon: 'play-circle-outline' },
  'Article/Book':       { color: '#D4871A', icon: 'book-outline' },
  'Activity/Printable': { color: '#7C3AED', icon: 'color-palette-outline' },
  'Duas & Adhkar':      { color: '#0D9488', icon: 'sparkles' },
  'Podcast':            { color: '#2563EB', icon: 'mic-outline' },
  'Other':              { color: '#6B7280', icon: 'grid-outline' },
};
function catConfig(cat) { return CATEGORY_CONFIG[cat] ?? { color: '#6B7280', icon: 'grid-outline' }; }

function ResourceThumb({ uri, accentColor, cardStyle, accentStyle, onHide }) {
  return (
    <>
      <Image source={{ uri }} style={cardStyle} resizeMode="cover" onError={onHide}
        onLoad={e => { const { width, height } = e.nativeEvent.source; if (width < 100 || height < 100) onHide(); }}
      />
      <View style={[accentStyle, { backgroundColor: accentColor }]} />
    </>
  );
}

export default function MyLibraryScreen({ navigation }) {
  const [insights, setInsights]               = useState([]);
  const [savedResources, setSavedResources]   = useState([]);
  const [query, setQuery]                     = useState('');
  const [activeTopic, setActiveTopic]         = useState('All');
  const [hiddenThumbs, setHiddenThumbs]       = useState(new Set());

  useFocusEffect(
    React.useCallback(() => {
      getSavedInsights().then(setInsights);
      getSavedResources().then(setSavedResources);
    }, [])
  );

  const allTopics = ['All', ...Array.from(new Set(insights.flatMap(i => i.tags ?? []))).sort()];
  const filtered = insights.filter(i => {
    const matchTopic = activeTopic === 'All' || (i.tags ?? []).includes(activeTopic);
    const q = query.toLowerCase();
    return matchTopic && (!q || i.insightTitle?.toLowerCase().includes(q) || i.body?.toLowerCase().includes(q));
  });
  const totalCount = insights.length + savedResources.length;
  const subtitle = totalCount === 0 ? 'Nothing saved yet' : `${totalCount} saved item${totalCount !== 1 ? 's' : ''}`;

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <View style={styles.bgTop} />
      <StatusBar style="light" />

      <DarkHeader title="My Library" subtitle={subtitle} />

      <View style={styles.sheet}>
        {/* Search + topic filters */}
        <View style={styles.controls}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={17} color="#9CA3AF" />
            <View style={{ flex: 1 }}>
              {!query && <Text style={styles.searchPlaceholder} pointerEvents="none">Search saved items...</Text>}
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

        {totalCount === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="bookmark-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>Nothing saved yet</Text>
            <Text style={styles.emptyBody}>Bookmark insights or save community resources to find them here.</Text>
          </View>
        ) : (
          <FlatList
            data={[
              ...filtered.map(i => ({ ...i, _kind: 'insight' })),
              ...savedResources.map(r => ({ ...r, _kind: 'resource' })),
            ]}
            keyExtractor={item => item._kind + item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>No matches found</Text>
                <Text style={styles.emptyBody}>Try a different search or filter.</Text>
              </View>
            }
            renderItem={({ item }) => {
              if (item._kind === 'resource') {
                const cfg = catConfig(item.category);
                return (
                  <View style={[styles.resourceCard, item.thumbnail_url && !hiddenThumbs.has(item.id) ? styles.resourceCardColumn : null]}>
                    {item.thumbnail_url && !hiddenThumbs.has(item.id) ? (
                      <ResourceThumb
                        uri={item.thumbnail_url} accentColor={cfg.color}
                        cardStyle={styles.resourceThumb} accentStyle={styles.resourceThumbAccent}
                        onHide={() => setHiddenThumbs(prev => new Set(prev).add(item.id))}
                      />
                    ) : (
                      <View style={[styles.resourceAccent, { backgroundColor: cfg.color }]} />
                    )}
                    <View style={styles.resourceBody}>
                      <View style={styles.resourceCardTop}>
                        <View style={[styles.resourceCatPill, { backgroundColor: cfg.color + '18' }]}>
                          <Ionicons name={cfg.icon} size={11} color={cfg.color} />
                          <Text style={[styles.resourceCatText, { color: cfg.color }]}>{item.category}</Text>
                        </View>
                        <Text style={styles.resourceAge}>{item.age_range}</Text>
                      </View>
                      <Text style={styles.resourceTitle}>{item.title}</Text>
                      {item.why_helped ? <Text style={styles.resourceWhy}>"{item.why_helped}"</Text> : null}
                      <View style={styles.resourceActions}>
                        <TouchableOpacity
                          style={[styles.saveBtn, styles.saveBtnActive]}
                          onPress={async () => {
                            await unsaveResource(item.id);
                            setSavedResources(prev => prev.filter(r => r.id !== item.id));
                          }}
                          activeOpacity={0.75}
                        >
                          <Ionicons name="bookmark" size={15} color="#FFFFFF" />
                          <Text style={[styles.saveBtnText, { color: '#FFFFFF' }]}>Saved</Text>
                        </TouchableOpacity>
                        {item.url ? (
                          <TouchableOpacity style={styles.openBtn} onPress={() => Linking.openURL(item.url)} activeOpacity={0.75}>
                            <Ionicons name="open-outline" size={15} color="#FFFFFF" />
                            <Text style={styles.openBtnText}>Open</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
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
                      <TouchableOpacity
                        onPress={async () => { await unsaveInsight(item.id); setInsights(prev => prev.filter(i => i.id !== item.id)); }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6F8' },
  bgTop: { position: 'absolute', top: 0, left: 0, right: 0, height: '40%', backgroundColor: '#1B3D2F' },
  sheet: { flex: 1, backgroundColor: '#F5F6F8', overflow: 'hidden' },
  controls: { backgroundColor: '#F5F6F8', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, gap: 12 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFFFFF', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1,
  },
  searchInput: { fontSize: 14, color: '#1A1A2E', flex: 1 },
  searchPlaceholder: { position: 'absolute', top: 0, left: 0, right: 0, fontSize: 14, color: '#9CA3AF' },
  filterRow: { paddingHorizontal: 4, gap: 8, alignItems: 'center' },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100, backgroundColor: '#E8EAED' },
  filterChipActive: { backgroundColor: '#1B3D2F' },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  filterChipTextActive: { color: '#FFFFFF' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#374151', textAlign: 'center' },
  emptyBody: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 22 },
  listContent: { paddingHorizontal: 20, paddingBottom: 32 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 12,
    flexDirection: 'row', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
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
  resourceCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 12,
    flexDirection: 'row', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  resourceCardColumn: { flexDirection: 'column' },
  resourceAccent: { width: 4 },
  resourceThumb: { width: '100%', height: 160, borderTopLeftRadius: 16, borderTopRightRadius: 16, backgroundColor: '#F3F4F6' },
  resourceThumbAccent: { height: 3, width: '100%' },
  resourceBody: { flex: 1, padding: 14 },
  resourceCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  resourceCatPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  resourceCatText: { fontSize: 11, fontWeight: '700' },
  resourceAge: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },
  resourceTitle: { fontSize: 15, fontWeight: '700', color: '#1C1C1E', lineHeight: 21, marginBottom: 4 },
  resourceWhy: { fontSize: 13, color: '#6B7280', lineHeight: 20, fontStyle: 'italic', marginBottom: 12 },
  resourceActions: { flexDirection: 'row', gap: 8 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, backgroundColor: 'rgba(27,61,47,0.07)' },
  saveBtnActive: { backgroundColor: '#1B3D2F' },
  saveBtnText: { fontSize: 13, fontWeight: '600', color: '#1B3D2F' },
  openBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 100, backgroundColor: '#1B3D2F' },
  openBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
});
