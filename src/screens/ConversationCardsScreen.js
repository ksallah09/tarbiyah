import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { DECKS as BUNDLED_DECKS, CARDS as BUNDLED_CARDS } from '../data/conversationCards';
import { fetchConversationCards } from '../utils/conversationCards';

const { width: W, height: H } = Dimensions.get('window');

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function ConversationCardsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [activeDeckId, setActiveDeckId] = useState('faith');
  const [cardIdx, setCardIdx] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [decks, setDecks] = useState(BUNDLED_DECKS);
  const [allCards, setAllCards] = useState(BUNDLED_CARDS);

  useEffect(() => {
    fetchConversationCards(({ decks: d, cards: c }) => {
      setDecks(d);
      setAllCards(c);
    }).then(({ decks: d, cards: c }) => {
      setDecks(d);
      setAllCards(c);
    });
  }, []);

  const deck = decks.find(d => d.id === activeDeckId) ?? decks[0];

  const deckCards = useMemo(() => {
    return shuffle(allCards.filter(c => c.deck === activeDeckId));
  }, [activeDeckId, allCards]);

  const card = deckCards[cardIdx] ?? deckCards[0];

  function switchDeck(id) {
    setActiveDeckId(id);
    setCardIdx(0);
  }

  function animateTo(nextIdx) {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setTimeout(() => setCardIdx(nextIdx), 120);
  }

  function next() {
    animateTo((cardIdx + 1) % deckCards.length);
  }

  function prev() {
    animateTo((cardIdx - 1 + deckCards.length) % deckCards.length);
  }

  return (
    <View style={[styles.root, { backgroundColor: deck.bg }]}>
      <StatusBar style="light" />

      {/* Back */}
      <TouchableOpacity
        style={[styles.backBtn, { top: insets.top + 8 }]}
        onPress={() => navigation.goBack()}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>

      {/* Title */}
      <View style={[styles.headerWrap, { paddingTop: insets.top + 52 }]}>
        <Text style={styles.eyebrow}>FAMILY ACTIVITY</Text>
        <Text style={styles.title}>Conversation Cards</Text>
      </View>

      {/* Deck selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.deckRow}
        style={styles.deckScroll}
      >
        {decks.map(d => {
          const active = d.id === activeDeckId;
          return (
            <TouchableOpacity
              key={d.id}
              style={[styles.deckPill, active && { backgroundColor: deck.accent }]}
              onPress={() => switchDeck(d.id)}
              activeOpacity={0.75}
            >
              <Text style={styles.deckPillEmoji}>{d.emoji}</Text>
              <Text style={[styles.deckPillText, active && { color: deck.bg }]}>{d.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Card */}
      <View style={styles.cardWrap}>
        <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
          <View style={[styles.cardDeckBadge, { backgroundColor: deck.accent + '22' }]}>
            <Text style={styles.cardDeckEmoji}>{deck.emoji}</Text>
            <Text style={[styles.cardDeckLabel, { color: deck.accent }]}>{deck.label.toUpperCase()}</Text>
          </View>
          <Text style={styles.cardQuestion}>{card?.q}</Text>
          <Text style={[styles.cardHint, { color: deck.accent + 'AA' }]}>
            Let everyone answer — no wrong answers.
          </Text>
        </Animated.View>
      </View>

      {/* Navigation */}
      <View style={[styles.nav, { paddingBottom: insets.bottom + 24 }]}>
        <TouchableOpacity style={styles.navArrow} onPress={prev} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>

        <Text style={styles.counter}>{cardIdx + 1} / {deckCards.length}</Text>

        <TouchableOpacity style={[styles.navNext, { backgroundColor: deck.accent }]} onPress={next} activeOpacity={0.82}>
          <Text style={[styles.navNextText, { color: deck.bg }]}>Next Card</Text>
          <Ionicons name="arrow-forward" size={16} color={deck.bg} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  backBtn: { position: 'absolute', left: 20, zIndex: 10, padding: 4 },

  headerWrap:  { paddingHorizontal: 24, marginBottom: 20 },
  eyebrow:     { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: 'rgba(255,255,255,0.4)', marginBottom: 6 },
  title:       { fontSize: 28, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5 },

  deckScroll: { flexGrow: 0, marginBottom: 24 },
  deckRow:    { paddingHorizontal: 20, gap: 8 },
  deckPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
  },
  deckPillEmoji: { fontSize: 14 },
  deckPillText:  { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.75)' },

  cardWrap: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 28,
    minHeight: H * 0.36,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  cardDeckBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5, marginBottom: 20,
  },
  cardDeckEmoji: { fontSize: 13 },
  cardDeckLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  cardQuestion:  { fontSize: 22, fontWeight: '700', color: '#1A1A2E', lineHeight: 32, marginBottom: 20 },
  cardHint:      { fontSize: 12, fontWeight: '500', fontStyle: 'italic' },

  nav: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 24, paddingTop: 16, gap: 16,
  },
  navArrow: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  counter: { flex: 1, textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: '600' },
  navNext: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 16, paddingHorizontal: 22, paddingVertical: 14,
  },
  navNextText: { fontSize: 15, fontWeight: '800' },
});
