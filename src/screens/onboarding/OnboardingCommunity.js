import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  ScrollView, TextInput, ActivityIndicator, FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import TypewriterText from '../../components/TypewriterText';
import ProgressDots from './ProgressDots';

const PLACES_KEY = 'AIzaSyAAzZUrCRvsauWBVNUnIf9HgH-CR8ub4Ig';

const SEARCH_TYPES = 'mosque|islamic_center';

async function fetchNearby(lat, lng) {
  const url =
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
    `?location=${lat},${lng}&radius=15000&keyword=mosque+islamic+center&key=${PLACES_KEY}`;
  const res  = await fetch(url);
  const json = await res.json();
  return (json.results ?? []).map(normPlace);
}

async function fetchSearch(query) {
  const url =
    `https://maps.googleapis.com/maps/api/place/textsearch/json` +
    `?query=${encodeURIComponent(query + ' mosque islamic center')}&key=${PLACES_KEY}`;
  const res  = await fetch(url);
  const json = await res.json();
  return (json.results ?? []).map(normPlace);
}

function normPlace(p) {
  return {
    placeId: p.place_id,
    name:    p.name,
    address: p.vicinity ?? p.formatted_address ?? '',
  };
}

export default function OnboardingCommunity({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const data   = route.params ?? {};

  const [ready,        setReady]        = useState(false);
  const [selected,     setSelected]     = useState([]);
  const [query,        setQuery]        = useState('');
  const [results,      setResults]      = useState([]);
  const [nearby,       setNearby]       = useState([]);
  const [searching,    setSearching]    = useState(false);
  const [locLoading,   setLocLoading]   = useState(true);
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const searchTimer    = useRef(null);

  function handleComplete() {
    setReady(true);
    Animated.timing(contentOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const places = await fetchNearby(loc.coords.latitude, loc.coords.longitude);
          setNearby(places);
        }
      } catch {}
      setLocLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const places = await fetchSearch(query.trim());
        setResults(places);
      } catch {}
      setSearching(false);
    }, 500);
    return () => clearTimeout(searchTimer.current);
  }, [query]);

  function toggle(place) {
    setSelected(prev =>
      prev.find(p => p.placeId === place.placeId)
        ? prev.filter(p => p.placeId !== place.placeId)
        : [...prev, place]
    );
  }

  function isSelected(placeId) {
    return selected.some(p => p.placeId === placeId);
  }

  function handleNext() {
    navigation.navigate('OnboardingReminder', { ...data, communities: selected });
  }

  function handleSkip() {
    navigation.navigate('OnboardingReminder', { ...data, communities: [] });
  }

  const displayResults = query.trim() ? results : nearby;

  return (
    <LinearGradient colors={['#0D2419', '#1B3D2F', '#2A5240']} style={styles.flex}>
      <StatusBar style="light" />
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
        <ProgressDots current={9} total={11} />
        <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TypewriterText
          lines={['Your community']}
          charDelay={28}
          style={styles.title}
          onComplete={handleComplete}
        />

        <Animated.View style={{ opacity: contentOpacity }}>
          <Text style={styles.sub}>
            Select the mosques and Islamic organisations your family is part of.
            We'll use this to surface relevant local events and programmes.
          </Text>

          {/* Selected chips */}
          {selected.length > 0 && (
            <View style={styles.chipRow}>
              {selected.map(p => (
                <TouchableOpacity
                  key={p.placeId}
                  style={styles.selectedChip}
                  onPress={() => toggle(p)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.selectedChipText} numberOfLines={1}>{p.name}</Text>
                  <Ionicons name="close" size={12} color="#FFFFFF" />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Search */}
          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={16} color="rgba(255,255,255,0.4)" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or city…"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            )}
          </View>

          {/* Section label */}
          <Text style={styles.sectionLabel}>
            {query.trim() ? 'SEARCH RESULTS' : 'NEAR YOU'}
          </Text>

          {/* Loading state */}
          {(locLoading || searching) && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="rgba(255,255,255,0.4)" />
              <Text style={styles.loadingText}>
                {searching ? 'Searching…' : 'Finding nearby mosques…'}
              </Text>
            </View>
          )}

          {/* Results list */}
          {!locLoading && !searching && displayResults.length === 0 && (
            <Text style={styles.emptyText}>
              {query.trim()
                ? 'No results found. Try a different search.'
                : 'No mosques found nearby. Try searching by name.'}
            </Text>
          )}

          {displayResults.map(place => {
            const active = isSelected(place.placeId);
            return (
              <TouchableOpacity
                key={place.placeId}
                style={[styles.placeRow, active && styles.placeRowActive]}
                onPress={() => toggle(place)}
                activeOpacity={0.75}
              >
                <View style={[styles.placeIconWrap, active && styles.placeIconWrapActive]}>
                  <Ionicons
                    name={active ? 'checkmark' : 'business-outline'}
                    size={16}
                    color={active ? '#FFFFFF' : 'rgba(255,255,255,0.5)'}
                  />
                </View>
                <View style={styles.placeText}>
                  <Text style={[styles.placeName, active && styles.placeNameActive]} numberOfLines={1}>
                    {place.name}
                  </Text>
                  {place.address ? (
                    <Text style={styles.placeAddress} numberOfLines={1}>{place.address}</Text>
                  ) : null}
                </View>
                {active && (
                  <Ionicons name="checkmark-circle" size={18} color="#4ADE80" />
                )}
              </TouchableOpacity>
            );
          })}
        </Animated.View>
      </ScrollView>

      {/* Footer */}
      {ready && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity
            style={[styles.nextBtn, selected.length === 0 && styles.nextBtnMuted]}
            onPress={handleNext}
            activeOpacity={0.85}
          >
            <Text style={styles.nextBtnText}>
              {selected.length > 0 ? `Continue with ${selected.length} selected` : 'Continue'}
            </Text>
            <Ionicons name="chevron-forward" size={18} color="#1B3D2F" />
          </TouchableOpacity>
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 8,
  },
  backBtn: { padding: 4 },
  skipBtn: { padding: 4 },
  skipText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.45)' },
  content: { paddingHorizontal: 24, paddingTop: 20 },
  title: { fontSize: 30, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5, marginBottom: 14, lineHeight: 38 },
  sub: { fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 22, marginBottom: 24 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 1.2, marginBottom: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  selectedChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#2E7D62', borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6,
    maxWidth: 200,
  },
  selectedChipText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF', flexShrink: 1 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 20,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#FFFFFF' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  loadingText: { fontSize: 13, color: 'rgba(255,255,255,0.4)' },
  emptyText: { fontSize: 13, color: 'rgba(255,255,255,0.35)', lineHeight: 20, paddingVertical: 8 },
  placeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  placeRowActive: {
    backgroundColor: 'rgba(46,125,98,0.25)',
    borderColor: '#2E7D62',
  },
  placeIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  placeIconWrapActive: { backgroundColor: '#2E7D62' },
  placeText: { flex: 1 },
  placeName: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.85)', marginBottom: 2 },
  placeNameActive: { color: '#FFFFFF', fontWeight: '700' },
  placeAddress: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  footer: { paddingHorizontal: 24, paddingTop: 12 },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#D4A843', borderRadius: 100,
    paddingVertical: 16, paddingHorizontal: 32,
  },
  nextBtnMuted: { opacity: 0.7 },
  nextBtnText: { fontSize: 16, fontWeight: '700', color: '#1B3D2F' },
});
