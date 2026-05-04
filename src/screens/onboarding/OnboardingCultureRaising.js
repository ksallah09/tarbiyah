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

export default function OnboardingCultureRaising({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const data   = route.params ?? {};

  const [raisingIn,  setRaisingIn]  = useState(null);
  const [query,      setQuery]      = useState('');
  const [otherText,  setOtherText]  = useState('');
  const [ready,      setReady]      = useState(false);
  const contentOpacity = useRef(new Animated.Value(0)).current;

  function handleComplete() {
    setReady(true);
    Animated.timing(contentOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }

  function handleNext() {
    const finalRaisingIn = raisingIn === 'Other' && otherText.trim()
      ? otherText.trim()
      : raisingIn;
    navigation.navigate('OnboardingCommunity', { ...data, raisingIn: finalRaisingIn });
  }

  function handleSkip() {
    navigation.navigate('OnboardingCommunity', { ...data, raisingIn: null });
  }

  const filtered = query.trim()
    ? COUNTRIES.filter(c => c.toLowerCase().includes(query.toLowerCase()))
    : COUNTRIES;

  return (
    <LinearGradient colors={['#1B3D2F', '#0D2419']} style={styles.flex}>
      <StatusBar style="light" />
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
        <ProgressDots current={8} total={11} />
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
          lines={['Where are you\nraising your children?']}
          charDelay={28}
          style={styles.title}
          onComplete={handleComplete}
        />

        <Animated.View style={{ opacity: contentOpacity }}>
          <Text style={styles.sub}>Select one.</Text>

          {raisingIn && (
            <View style={styles.chipRow}>
              <TouchableOpacity
                style={styles.selectedChip}
                onPress={() => { setRaisingIn(null); setOtherText(''); }}
                activeOpacity={0.75}
              >
                <Text style={styles.selectedChipText}>{raisingIn}</Text>
                <Ionicons name="close" size={12} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={16} color="rgba(255,255,255,0.4)" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search country…"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={query}
              onChangeText={setQuery}
              returnKeyType="done"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.chipRow}>
            {filtered.map(c => {
              const active = raisingIn === c;
              return (
                <TouchableOpacity
                  key={c}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => { setRaisingIn(c); setOtherText(''); }}
                  activeOpacity={0.75}
                >
                  {active && <Ionicons name="checkmark" size={11} color="#FFFFFF" />}
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{c}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {raisingIn === 'Other' && (
            <View style={styles.otherInputRow}>
              <Ionicons name="pencil-outline" size={15} color="rgba(255,255,255,0.5)" />
              <TextInput
                style={styles.otherInput}
                placeholder="Type your country…"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={otherText}
                onChangeText={setOtherText}
                returnKeyType="done"
                autoFocus
              />
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {ready && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity
            style={[styles.nextBtn, !raisingIn && styles.nextBtnMuted]}
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
  title: { fontSize: 34, fontWeight: '700', color: '#FFFFFF', lineHeight: 44, marginBottom: 14 },
  sub: { fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 22, marginBottom: 20 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  selectedChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#2E7D62', borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6,
  },
  selectedChipText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#FFFFFF' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 100, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  chipActive: { backgroundColor: '#2E7D62', borderColor: '#2E7D62' },
  chipText:       { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.7)' },
  chipTextActive: { color: '#FFFFFF', fontWeight: '700' },
  otherInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  otherInput: { flex: 1, fontSize: 14, color: '#FFFFFF' },
  footer: { paddingHorizontal: 24, paddingTop: 12 },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#D4A843', borderRadius: 100,
    paddingVertical: 16, paddingHorizontal: 32,
  },
  nextBtnMuted: { opacity: 0.7 },
  nextBtnText: { fontSize: 16, fontWeight: '700', color: '#1B3D2F' },
});
