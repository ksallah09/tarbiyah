import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

const GAMES = [
  {
    id: 'headsup',
    name: 'Islamic Heads Up',
    tagline: 'Phone on forehead. Family gives clues.',
    icon: 'phone-portrait-outline',
    emoji: '🎭',
    accent: '#D4A843',
    splash: 'HeadsUpSplash',
  },
  {
    id: 'quran',
    name: 'Next Ayah',
    tagline: 'Hear the verse. Recite what comes next.',
    icon: 'book-outline',
    emoji: '📖',
    accent: '#4ADE80',
    splash: 'QuranSplash',
  },
];

export default function GamesHubScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* ── Green hero header ── */}
      <View style={[styles.hero, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => navigation.popToTop()}
          style={styles.closeBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>

        <View style={styles.heroIconWrap}>
          <Text style={styles.heroIcon}>🎲</Text>
        </View>
        <Text style={styles.heroEyebrow}>FAMILY GAMES</Text>
        <Text style={styles.heroTitle}>Play Together</Text>
        <Text style={styles.heroSub}>Laugh together, learn together — games made for Muslim families.</Text>
      </View>

      {/* ── Cards ── */}
      <ScrollView
        style={styles.sheet}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>CHOOSE A GAME</Text>

        {GAMES.map(game => (
          <TouchableOpacity
            key={game.id}
            style={styles.card}
            onPress={() => navigation.navigate(game.splash, { gameId: game.id })}
            activeOpacity={0.82}
          >
            <View style={[styles.cardIconWrap, { backgroundColor: game.accent + '20' }]}>
              <Text style={styles.cardEmoji}>{game.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardName}>{game.name}</Text>
              <Text style={styles.cardTagline}>{game.tagline}</Text>
            </View>
            <View style={[styles.cardArrow, { backgroundColor: game.accent + '20' }]}>
              <Ionicons name="arrow-forward" size={16} color={game.accent} />
            </View>
          </TouchableOpacity>
        ))}

        <View style={styles.moreComingSoon}>
          <Ionicons name="sparkles-outline" size={16} color="#9CA3AF" />
          <Text style={styles.moreText}>More games coming soon</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: '#F5F6F8' },

  // Hero
  hero: {
    backgroundColor: '#1B3D2F',
    paddingHorizontal: 24,
    paddingBottom: 36,
    alignItems: 'center',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    marginBottom: 16,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  heroIcon:    { fontSize: 40 },
  heroEyebrow: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.45)', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 6 },
  heroTitle:   { fontSize: 32, fontWeight: '900', color: '#FFFFFF', marginBottom: 10 },
  heroSub:     { fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 21, textAlign: 'center' },

  // Sheet
  sheet:        { flex: 1 },
  scroll:       { paddingHorizontal: 20, paddingTop: 28 },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#9CA3AF', letterSpacing: 1.2, marginBottom: 14 },

  // Cards
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, marginBottom: 14,
    shadowColor: '#1B3D2F', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },
  cardIconWrap: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  cardEmoji:    { fontSize: 28 },
  cardName:     { fontSize: 16, fontWeight: '800', color: '#1A1A2E', marginBottom: 3 },
  cardTagline:  { fontSize: 13, color: '#6B7280', lineHeight: 19 },
  cardArrow:    { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  moreComingSoon: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8 },
  moreText:       { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },
});
