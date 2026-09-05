import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { HeadsUpHowToModal } from './games/HeadsUpGameScreen';
import { QuranHowToModal } from './games/QuranCompletionGameScreen';

const { width: W } = Dimensions.get('window');

const GAMES = {
  headsup: {
    emoji:     '🎭',
    eyebrow:   'FAMILY GAME',
    name:      'Islamic Heads Up',
    tagline:   'Put your phone on your forehead — your family gives clues, you guess!',
    bg:        '#1B3D2F',
    bgDeep:    '#142D22',
    accent:    '#D4A843',
    accentDim: 'rgba(212,168,67,0.18)',
    steps: [
      { icon: '📱', title: 'Phone on forehead',  desc: 'Hold the screen facing your family so only they can read it.' },
      { icon: '💬', title: 'Family gives clues', desc: 'No saying the word itself — describe, act, sing, anything goes.' },
      { icon: '✅', title: 'Tilt to answer',     desc: 'Tilt right for correct, left to pass. Keep going until time runs out!' },
    ],
    stats:  ['9 categories', '200+ cards', '2–6 players'],
    screen: 'HeadsUpSetup',
  },
  quran: {
    emoji:     '📖',
    eyebrow:   'QUR\'AN GAME',
    name:      'Next Ayah',
    tagline:   'Complete the verse — tilt to score, race the clock as a family.',
    bg:        '#1B2A20',
    bgDeep:    '#111D16',
    accent:    '#4ADE80',
    accentDim: 'rgba(74,222,128,0.15)',
    steps: [
      { icon: '📱', title: 'Phone on forehead',   desc: 'Hold the screen facing your family — you can\'t see the ayah.' },
      { icon: '🕌', title: 'Family recites',       desc: 'They recite the prompt ayah. You complete the next one from memory.' },
      { icon: '🎯', title: 'Tilt to score',        desc: 'Got it? Tilt right for correct. Can\'t remember? Tilt left to pass.' },
    ],
    stats:  ['30 ajzaa', 'Any combination', '2–6 players'],
    screen: 'QuranCompletionGame',
  },
};

export default function GameSplashScreen({ route, navigation }) {
  const { gameId } = route.params;
  const game = GAMES[gameId];
  const insets = useSafeAreaInsets();
  const [howToVisible, setHowToVisible] = useState(false);
  const HowToModal = gameId === 'headsup' ? HeadsUpHowToModal : QuranHowToModal;

  return (
    <View style={[styles.root, { backgroundColor: game.bg }]}>
      <StatusBar style="light" />

      {/* Back */}
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={[styles.backBtn, { top: insets.top + 8 }]}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.heroSection}>
          <View style={[styles.emojiRing, { backgroundColor: game.accentDim }]}>
            <View style={[styles.emojiRingInner, { backgroundColor: game.accentDim }]}>
              <Text style={styles.heroEmoji}>{game.emoji}</Text>
            </View>
          </View>
          <Text style={styles.eyebrow}>{game.eyebrow}</Text>
          <Text style={styles.gameName}>{game.name}</Text>
          <Text style={styles.tagline}>{game.tagline}</Text>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          {game.stats.map((s, i) => (
            <View key={i} style={[styles.statPill, { backgroundColor: game.accentDim }]}>
              <Text style={[styles.statText, { color: game.accent }]}>{s}</Text>
            </View>
          ))}
        </View>

        {/* How it works */}
        <View style={[styles.howCard, { backgroundColor: game.bgDeep }]}>
          <Text style={styles.howTitle}>HOW TO PLAY</Text>
          {game.steps.map((step, i) => (
            <View key={i} style={[styles.step, i < game.steps.length - 1 && styles.stepBorder]}>
              <View style={[styles.stepNumWrap, { backgroundColor: game.accentDim }]}>
                <Text style={styles.stepEmoji}>{step.icon}</Text>
              </View>
              <View style={styles.stepBody}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepDesc}>{step.desc}</Text>
              </View>
            </View>
          ))}
          <TouchableOpacity
            style={[styles.moreBtn, { borderTopColor: 'rgba(255,255,255,0.07)' }]}
            onPress={() => setHowToVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="images-outline" size={15} color={game.accent} />
            <Text style={[styles.moreBtnText, { color: game.accent }]}>More details on how to play</Text>
          </TouchableOpacity>
        </View>

        <HowToModal visible={howToVisible} onClose={() => setHowToVisible(false)} />

        {/* Play button */}
        <TouchableOpacity
          style={[styles.playBtn, { backgroundColor: game.accent }]}
          onPress={() => navigation.navigate(game.screen)}
          activeOpacity={0.88}
        >
          <Text style={[styles.playBtnText, { color: game.bg }]}>Play Now</Text>
          <Ionicons name="arrow-forward" size={20} color={game.bg} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1 },
  backBtn: { position: 'absolute', left: 20, zIndex: 10, padding: 4 },

  scroll: { paddingHorizontal: 24, alignItems: 'center' },

  // Hero
  heroSection: { alignItems: 'center', marginBottom: 24 },
  emojiRing: {
    width: 120, height: 120, borderRadius: 60,
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  emojiRingInner: {
    width: 90, height: 90, borderRadius: 45,
    alignItems: 'center', justifyContent: 'center',
  },
  heroEmoji: { fontSize: 48 },
  eyebrow: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.9,
    color: 'rgba(255,255,255,0.45)', marginBottom: 8,
  },
  gameName: {
    fontSize: 34, fontWeight: '900', color: '#FFFFFF',
    letterSpacing: -0.5, textAlign: 'center', marginBottom: 12,
  },
  tagline: {
    fontSize: 15, color: 'rgba(255,255,255,0.6)',
    textAlign: 'center', lineHeight: 22, paddingHorizontal: 16,
  },

  // Stats
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 28, flexWrap: 'wrap', justifyContent: 'center' },
  statPill: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  statText: { fontSize: 12, fontWeight: '700' },

  // How card
  howCard: {
    width: W - 48, borderRadius: 20, padding: 20, marginBottom: 28,
  },
  howTitle: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.35)', marginBottom: 16,
  },
  step: { flexDirection: 'row', gap: 14, paddingVertical: 14 },
  stepBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  stepNumWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepEmoji:   { fontSize: 22 },
  stepBody:    { flex: 1, justifyContent: 'center' },
  stepTitle:   { fontSize: 15, fontWeight: '700', color: '#FFFFFF', marginBottom: 3 },
  stepDesc:    { fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 19 },

  // More details button
  moreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingTop: 14, marginTop: 4, borderTopWidth: 1,
  },
  moreBtnText: { fontSize: 13, fontWeight: '600' },

  // Play button
  playBtn: {
    width: W - 48, borderRadius: 18, paddingVertical: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  playBtnText: { fontSize: 19, fontWeight: '900' },
});
