import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  ScrollView, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import TypewriterText from '../../components/TypewriterText';
import ProgressDots from './ProgressDots';

const COUNTRIES = [
  'Afghanistan','Algeria','Australia','Bahrain','Bangladesh','Bosnia & Herzegovina',
  'Canada','Egypt','Ethiopia','France','Germany','Ghana','India','Indonesia',
  'Iran','Iraq','Jordan','Kazakhstan','Kenya','Kuwait','Lebanon','Libya',
  'Malaysia','Mali','Mauritania','Morocco','Netherlands','Niger','Nigeria',
  'Oman','Pakistan','Palestine','Philippines','Qatar','Saudi Arabia','Senegal',
  'Somalia','South Africa','Sudan','Sweden','Syria','Tanzania','Tunisia',
  'Turkey','UAE','Uganda','United Kingdom','United States','Uzbekistan','Yemen',
  'Other',
];

export default function OnboardingCulture({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const data   = route.params ?? {};

  const [raisedIn,    setRaisedIn]    = useState([]);
  const [raisingIn,   setRaisingIn]   = useState(null);
  const [raisedQuery, setRaisedQuery] = useState('');
  const [raisingQuery,setRaisingQuery]= useState('');
  const [ready, setReady] = useState(false);
  const contentOpacity = useRef(new Animated.Value(0)).current;

  function handleComplete() {
    setReady(true);
    Animated.timing(contentOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }

  function toggleRaisedIn(country) {
    setRaisedIn(prev =>
      prev.includes(country) ? prev.filter(c => c !== country) : [...prev, country]
    );
  }

  function handleNext() {
    navigation.navigate('OnboardingReminder', {
      ...data,
      raisedIn,
      raisingIn,
    });
  }

  function handleSkip() {
    navigation.navigate('OnboardingReminder', { ...data, raisedIn: [], raisingIn: null });
  }

  const filteredRaised  = raisedQuery.trim()
    ? COUNTRIES.filter(c => c.toLowerCase().includes(raisedQuery.toLowerCase()))
    : COUNTRIES;
  const filteredRaising = raisingQuery.trim()
    ? COUNTRIES.filter(c => c.toLowerCase().includes(raisingQuery.toLowerCase()))
    : COUNTRIES;

  return (
    <LinearGradient colors={['#0D2419', '#1B3D2F', '#2A5240']} style={styles.flex}>
      <StatusBar style="light" />
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
        <ProgressDots current={7} total={9} />
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
          lines={['Your cultural background']}
          charDelay={28}
          style={styles.title}
          onComplete={handleComplete}
        />

        <Animated.View style={{ opacity: contentOpacity }}>
          <Text style={styles.sub}>
            Understanding where you were raised and where you're raising your children helps us
            bridge cultural gaps and make guidance feel relevant to your family's unique context.
          </Text>

          {/* ── Where were you raised ── */}
          <Text style={styles.sectionLabel}>WHERE WERE YOU RAISED?</Text>
          <Text style={styles.sectionSub}>Select all that apply.</Text>

          {/* Selected chips */}
          {raisedIn.length > 0 && (
            <View style={styles.chipRow}>
              {raisedIn.map(c => (
                <TouchableOpacity key={c} style={styles.selectedChip} onPress={() => toggleRaisedIn(c)} activeOpacity={0.75}>
                  <Text style={styles.selectedChipText}>{c}</Text>
                  <Ionicons name="close" size={12} color="#FFFFFF" />
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={16} color="rgba(255,255,255,0.4)" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search country…"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={raisedQuery}
              onChangeText={setRaisedQuery}
              returnKeyType="done"
            />
            {raisedQuery.length > 0 && (
              <TouchableOpacity onPress={() => setRaisedQuery('')}>
                <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.chipRow}>
            {filteredRaised.map(c => {
              const active = raisedIn.includes(c);
              return (
                <TouchableOpacity
                  key={c}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => toggleRaisedIn(c)}
                  activeOpacity={0.75}
                >
                  {active && <Ionicons name="checkmark" size={11} color="#FFFFFF" />}
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{c}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Where are you raising your children ── */}
          <Text style={[styles.sectionLabel, { marginTop: 28 }]}>WHERE ARE YOU RAISING YOUR CHILDREN?</Text>
          <Text style={styles.sectionSub}>Select one.</Text>

          {raisingIn && (
            <View style={styles.chipRow}>
              <View style={styles.selectedChip}>
                <Text style={styles.selectedChipText}>{raisingIn}</Text>
                <TouchableOpacity onPress={() => setRaisingIn(null)}>
                  <Ionicons name="close" size={12} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={16} color="rgba(255,255,255,0.4)" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search country…"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={raisingQuery}
              onChangeText={setRaisingQuery}
              returnKeyType="done"
            />
            {raisingQuery.length > 0 && (
              <TouchableOpacity onPress={() => setRaisingQuery('')}>
                <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.chipRow}>
            {filteredRaising.map(c => {
              const active = raisingIn === c;
              return (
                <TouchableOpacity
                  key={c}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setRaisingIn(c)}
                  activeOpacity={0.75}
                >
                  {active && <Ionicons name="checkmark" size={11} color="#FFFFFF" />}
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{c}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </ScrollView>

      {/* Footer */}
      {ready && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity
            style={[styles.nextBtn, (!raisedIn.length && !raisingIn) && styles.nextBtnMuted]}
            onPress={handleNext}
            activeOpacity={0.85}
          >
            <Text style={styles.nextBtnText}>Continue</Text>
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
  sub: { fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 22, marginBottom: 28 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.45)', letterSpacing: 1.2, marginBottom: 4 },
  sectionSub:   { fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 12 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#FFFFFF' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 100, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  chipActive: { backgroundColor: '#2E7D62', borderColor: '#2E7D62' },
  chipText:       { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.7)' },
  chipTextActive: { color: '#FFFFFF', fontWeight: '700' },
  selectedChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#2E7D62', borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6,
  },
  selectedChipText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  footer: { paddingHorizontal: 24, paddingTop: 12 },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#D4A843', borderRadius: 100,
    paddingVertical: 16, paddingHorizontal: 32,
  },
  nextBtnMuted: { opacity: 0.7 },
  nextBtnText: { fontSize: 16, fontWeight: '700', color: '#1B3D2F' },
});
