import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Vibration, Animated, TextInput,
  Modal, Image, Dimensions, Platform,
} from 'react-native';
const SCREEN_WIDTH = Dimensions.get('window').width;
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { Audio } from 'expo-av';
import { Accelerometer } from 'expo-sensors';
import * as ScreenOrientation from 'expo-screen-orientation';

// ─── Juz' metadata ────────────────────────────────────────────────────────────
const JUZ_DATA = [
  { num: 30, name: "Juz' Amma",    surahs: [
    { num: 78, name: 'An-Naba', ayahs: 40 },    { num: 79, name: "An-Nazi'at", ayahs: 46 },
    { num: 80, name: 'Abasa', ayahs: 42 },      { num: 81, name: 'At-Takwir', ayahs: 29 },
    { num: 82, name: 'Al-Infitar', ayahs: 19 }, { num: 83, name: 'Al-Mutaffifin', ayahs: 36 },
    { num: 84, name: 'Al-Inshiqaq', ayahs: 25 },{ num: 85, name: 'Al-Buruj', ayahs: 22 },
    { num: 86, name: 'At-Tariq', ayahs: 17 },   { num: 87, name: 'Al-Ala', ayahs: 19 },
    { num: 88, name: 'Al-Ghashiyah', ayahs: 26 },{ num: 89, name: 'Al-Fajr', ayahs: 30 },
    { num: 90, name: 'Al-Balad', ayahs: 20 },   { num: 91, name: 'Ash-Shams', ayahs: 15 },
    { num: 92, name: 'Al-Layl', ayahs: 21 },    { num: 93, name: 'Ad-Duha', ayahs: 11 },
    { num: 94, name: 'Ash-Sharh', ayahs: 8 },   { num: 95, name: 'At-Tin', ayahs: 8 },
    { num: 96, name: 'Al-Alaq', ayahs: 19 },    { num: 97, name: 'Al-Qadr', ayahs: 5 },
    { num: 98, name: 'Al-Bayyinah', ayahs: 8 }, { num: 99, name: 'Az-Zalzalah', ayahs: 8 },
    { num: 100, name: 'Al-Adiyat', ayahs: 11 }, { num: 101, name: "Al-Qari'ah", ayahs: 11 },
    { num: 102, name: 'At-Takathur', ayahs: 8 },{ num: 103, name: 'Al-Asr', ayahs: 3 },
    { num: 104, name: 'Al-Humazah', ayahs: 9 }, { num: 105, name: 'Al-Fil', ayahs: 5 },
    { num: 106, name: 'Quraysh', ayahs: 4 },    { num: 107, name: "Al-Ma'un", ayahs: 7 },
    { num: 108, name: 'Al-Kawthar', ayahs: 3 }, { num: 109, name: 'Al-Kafirun', ayahs: 6 },
    { num: 110, name: 'An-Nasr', ayahs: 3 },    { num: 111, name: 'Al-Masad', ayahs: 5 },
    { num: 112, name: 'Al-Ikhlas', ayahs: 4 },  { num: 113, name: 'Al-Falaq', ayahs: 5 },
    { num: 114, name: 'An-Nas', ayahs: 6 },
  ]},
  { num: 29, name: "Juz' Tabarak", surahs: [
    { num: 67, name: 'Al-Mulk', ayahs: 30 },    { num: 68, name: 'Al-Qalam', ayahs: 52 },
    { num: 69, name: 'Al-Haqqah', ayahs: 52 },  { num: 70, name: "Al-Ma'arij", ayahs: 44 },
    { num: 71, name: 'Nuh', ayahs: 28 },         { num: 72, name: 'Al-Jinn', ayahs: 28 },
    { num: 73, name: 'Al-Muzzammil', ayahs: 20 },{ num: 74, name: 'Al-Muddaththir', ayahs: 56 },
    { num: 75, name: 'Al-Qiyamah', ayahs: 40 }, { num: 76, name: 'Al-Insan', ayahs: 31 },
    { num: 77, name: 'Al-Mursalat', ayahs: 50 },
  ]},
  { num: 28, name: "Juz' 28", surahs: [
    { num: 58, name: 'Al-Mujadila', ayahs: 22 }, { num: 59, name: 'Al-Hashr', ayahs: 24 },
    { num: 60, name: 'Al-Mumtahanah', ayahs: 13 },{ num: 61, name: 'As-Saf', ayahs: 14 },
    { num: 62, name: "Al-Jumu'ah", ayahs: 11 }, { num: 63, name: 'Al-Munafiqun', ayahs: 11 },
    { num: 64, name: 'At-Taghabun', ayahs: 18 }, { num: 65, name: 'At-Talaq', ayahs: 12 },
    { num: 66, name: 'At-Tahrim', ayahs: 12 },
  ]},
  { num: 27, name: "Juz' 27", surahs: [
    { num: 51, name: 'Adh-Dhariyat', ayahs: 60 }, { num: 52, name: 'At-Tur', ayahs: 49 },
    { num: 53, name: 'An-Najm', ayahs: 62 },      { num: 54, name: 'Al-Qamar', ayahs: 55 },
    { num: 55, name: 'Ar-Rahman', ayahs: 78 },    { num: 56, name: "Al-Waqi'ah", ayahs: 96 },
    { num: 57, name: 'Al-Hadid', ayahs: 29 },
  ]},
  { num: 26, name: "Juz' 26", surahs: [
    { num: 46, name: 'Al-Ahqaf', ayahs: 35 },    { num: 47, name: 'Muhammad', ayahs: 38 },
    { num: 48, name: 'Al-Fath', ayahs: 29 },      { num: 49, name: 'Al-Hujurat', ayahs: 18 },
    { num: 50, name: 'Qaf', ayahs: 45 },
  ]},
];

const BISMILLAH    = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
const NO_BISMILLAH = new Set([9]);
const Q_COUNT_OPTIONS = [5, 10, 15, 20];
const ROUND_OPTIONS    = [1, 2, 3, 5];
const MEDALS           = ['🥇', '🥈', '🥉', '🏅', '🏅', '🏅'];
const TILT_TRIGGER     = 0.75;
const TILT_RELEASE     = 0.45;
const NEUTRAL_ZONE     = 0.25;
const REQUIRED_SAMPLES = 3;
const NEUTRAL_HOLD_MS  = 180;

async function fetchJuzAyahs(juzNum, excludedSurahs = new Set()) {
  const res  = await fetch(`https://api.alquran.cloud/v1/juz/${juzNum}/quran-uthmani`);
  const json = await res.json();
  return (json?.data?.ayahs ?? []).filter(a => !excludedSurahs.has(a.surah?.number));
}

function buildGamePairs(ayahs) {
  const sorted = [...ayahs].sort((a, b) => a.number - b.number);
  const pairs  = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next    = sorted[i + 1];
    if (next.number !== current.number + 1) continue;
    if (current.numberInSurah === 1) continue;
    const isCrossSurah = current.surah.number !== next.surah.number;
    pairs.push({ prompt: current, answer: next, isCrossSurah });
  }
  return pairs;
}

function ayahAudioUrl(n) {
  return `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${n}.mp3`;
}

// ─── How To Play Modal ────────────────────────────────────────────────────────
const NA_HOW_TO_STEPS = [
  { image: require('../../../assets/na-1.png') },
  { image: require('../../../assets/na-2.png') },
  { image: require('../../../assets/na-3.png') },
  { image: require('../../../assets/na-4.png') },
  { image: require('../../../assets/na-5.png') },
  { image: require('../../../assets/na-6.png') },
];

function HowToPlayModal({ visible, onClose }) {
  const [page, setPage] = useState(0);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setPage(0);
      scrollRef.current?.scrollTo({ x: 0, animated: false });
    }
  }, [visible]);

  function goNext() {
    if (page < NA_HOW_TO_STEPS.length - 1) {
      const next = page + 1;
      scrollRef.current?.scrollTo({ x: next * SCREEN_WIDTH, animated: true });
      setPage(next);
    } else {
      onClose();
    }
  }

  function handleScroll(e) {
    const p = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setPage(p);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={nams.overlay}>
        <View style={nams.sheet}>
          <TouchableOpacity onPress={onClose} style={nams.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color="#9CA3AF" />
          </TouchableOpacity>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleScroll}
            style={nams.carousel}
            scrollEventThrottle={16}
          >
            {NA_HOW_TO_STEPS.map((s, i) => (
              <View key={i} style={nams.slidePage}>
                <Image source={s.image} style={nams.stepImage} resizeMode="contain" />
              </View>
            ))}
          </ScrollView>
          <View style={nams.dotsRow}>
            {NA_HOW_TO_STEPS.map((_, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => {
                  scrollRef.current?.scrollTo({ x: i * SCREEN_WIDTH, animated: true });
                  setPage(i);
                }}
              >
                <View style={[nams.dot, i === page && nams.dotActive]} />
              </TouchableOpacity>
            ))}
          </View>
          <View style={nams.actions}>
            {page > 0 ? (
              <TouchableOpacity
                onPress={() => {
                  const prev = page - 1;
                  scrollRef.current?.scrollTo({ x: prev * SCREEN_WIDTH, animated: true });
                  setPage(prev);
                }}
                style={nams.backBtn}
              >
                <Ionicons name="arrow-back" size={16} color="#6B7280" />
                <Text style={nams.backText}>Back</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={onClose} style={nams.skipBtn}>
                <Text style={nams.skipText}>Skip</Text>
              </TouchableOpacity>
            )}
            {page < NA_HOW_TO_STEPS.length - 1 ? (
              <TouchableOpacity onPress={goNext} style={nams.nextBtn}>
                <Text style={nams.nextText}>Next</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={onClose} style={nams.nextBtn}>
                <Text style={nams.nextText}>Let's Play!</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Juz' Selector ────────────────────────────────────────────────────────────
function JuzSelector({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const [selectedJuz,    setSelectedJuz]    = useState(new Set([30]));
  const [expandedJuz,    setExpandedJuz]    = useState(null);
  const [excludedSurahs, setExcludedSurahs] = useState(new Set());
  const [questionCount,  setQuestionCount]  = useState(10);
  const [loading,        setLoading]        = useState(false);
  const [players,        setPlayers]        = useState([{ id: '1', name: '' }, { id: '2', name: '' }]);
  const [totalRounds,    setTotalRounds]    = useState(3);
  const [showErrors,     setShowErrors]     = useState(false);
  const [howToVisible,   setHowToVisible]   = useState(false);

  // Auto-start for subsequent turns (same config, next player)
  useEffect(() => {
    const { autoStart, gameState: gs, gameConfig: gc } = route.params ?? {};
    if (!autoStart || !gs || !gc) return;
    setLoading(true);
    (async () => {
      try {
        const allAyahs = [];
        for (const juzNum of gc.selectedJuz) {
          allAyahs.push(...await fetchJuzAyahs(juzNum, new Set(gc.excludedSurahs)));
        }
        const pairs = buildGamePairs(allAyahs);
        if (!pairs.length) { alert('No consecutive ayahs found.'); setLoading(false); return; }
        const shuffled = pairs.sort(() => Math.random() - 0.5).slice(0, gc.questionCount);
        navigation.replace('QuranPlaying', { pairs: shuffled, gameState: gs, gameConfig: gc });
      } catch {
        alert("Could not load Qur'an data. Please check your connection.");
        setLoading(false);
      }
    })();
  }, []);

  function addPlayer() {
    if (players.length >= 6) return;
    setPlayers(prev => [...prev, { id: Date.now().toString(), name: '' }]);
  }
  function removePlayer(id) {
    if (players.length <= 1) return;
    setPlayers(prev => prev.filter(p => p.id !== id));
  }
  function updateName(id, text) {
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, name: text } : p));
    if (showErrors) setShowErrors(false);
  }

  function toggleJuz(num) {
    setSelectedJuz(prev => { const s = new Set(prev); s.has(num) ? s.delete(num) : s.add(num); return s; });
  }
  function toggleSurah(num) {
    setExcludedSurahs(prev => { const s = new Set(prev); s.has(num) ? s.delete(num) : s.add(num); return s; });
  }

  async function startGame() {
    const anyEmpty = players.some(p => !p.name.trim());
    if (anyEmpty) { setShowErrors(true); return; }
    if (!selectedJuz.size) return;
    setLoading(true);
    let navigated = false;
    try {
      const allAyahs = [];
      for (const juzNum of selectedJuz) {
        allAyahs.push(...await fetchJuzAyahs(juzNum, excludedSurahs));
      }
      const pairs = buildGamePairs(allAyahs);
      if (!pairs.length) { alert('No consecutive ayahs found. Try including more surahs.'); setLoading(false); return; }
      const shuffled = pairs.sort(() => Math.random() - 0.5).slice(0, questionCount);
      const gameConfig = { selectedJuz: [...selectedJuz], excludedSurahs: [...excludedSurahs], questionCount };
      const gameState = {
        players: players.map(p => ({ ...p, name: p.name.trim(), score: 0 })),
        totalRounds,
        currentRound: 1,
        currentPlayerIdx: 0,
      };
      navigated = true;
      navigation.navigate('QuranPlaying', { pairs: shuffled, gameState, gameConfig });
    } catch {
      alert("Could not load Qur'an data. Please check your connection.");
    } finally {
      // Don't clear loading if we navigated — keeps setup screen stable during fade transition
      if (!navigated) setLoading(false);
    }
  }

  // Auto-start loading screen shown while fetching next turn's pairs
  if (route.params?.autoStart) {
    const gs = route.params.gameState;
    const player = gs?.players[gs?.currentPlayerIdx];
    return (
      <View style={[styles.root, { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: insets.top }]}>
        <StatusBar style="dark" />
        {player && <Text style={styles.headerTitle}>{player.name}'s Turn</Text>}
        <Text style={[styles.setupHint, { marginTop: 8, textAlign: 'center' }]}>Loading questions...</Text>
        <ActivityIndicator color="#1B3D2F" size="large" style={{ marginTop: 24 }} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color="#1A1A2E" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerEyebrow}>NEXT AYAH</Text>
          <Text style={styles.headerTitle}>Game Setup</Text>
        </View>
        <TouchableOpacity onPress={() => setHowToVisible(true)} style={styles.howToTrigger} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="help-circle-outline" size={18} color="#1B3D2F" />
          <Text style={styles.howToTriggerText}>How to play</Text>
        </TouchableOpacity>
      </View>
      <HowToPlayModal visible={howToVisible} onClose={() => setHowToVisible(false)} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Players */}
        <Text style={styles.setupLabel}>PLAYERS</Text>
        <View style={styles.playerList}>
          {players.map((p, i) => (
            <View key={p.id} style={[styles.playerRow, showErrors && !p.name.trim() && styles.playerRowError]}>
              <View style={styles.playerNumBadge}>
                <Text style={styles.playerNumText}>{i + 1}</Text>
              </View>
              <TextInput
                style={styles.playerInput}
                value={p.name}
                onChangeText={text => updateName(p.id, text)}
                placeholder="Tap to enter name..."
                placeholderTextColor="#9CA3AF"
                maxLength={20}
                returnKeyType="done"
              />
              {players.length > 1 && (
                <TouchableOpacity onPress={() => removePlayer(p.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close-circle" size={22} color="#D1D5DB" />
                </TouchableOpacity>
              )}
            </View>
          ))}
          {players.length < 6 && (
            <TouchableOpacity style={styles.addPlayerRow} onPress={addPlayer} activeOpacity={0.7}>
              <Ionicons name="add-circle-outline" size={20} color="#2E7D62" />
              <Text style={styles.addPlayerText}>Add Player</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Rounds */}
        <Text style={[styles.setupLabel, { marginTop: 28 }]}>ROUNDS</Text>
        <View style={styles.roundsRow}>
          {ROUND_OPTIONS.map(r => (
            <TouchableOpacity key={r} style={[styles.roundPill, totalRounds === r && styles.roundPillActive]} onPress={() => setTotalRounds(r)} activeOpacity={0.8}>
              <Text style={[styles.roundPillText, totalRounds === r && styles.roundPillTextActive]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[styles.setupHint, { marginBottom: 24 }]}>Each player answers the same questions per round</Text>

        {/* Question count */}
        <Text style={styles.setupLabel}>QUESTIONS</Text>
        <View style={styles.qCountRow}>
          {Q_COUNT_OPTIONS.map(n => (
            <TouchableOpacity
              key={n}
              style={[styles.qCountPill, questionCount === n && styles.qCountPillActive]}
              onPress={() => setQuestionCount(n)}
              activeOpacity={0.8}
            >
              <Text style={[styles.qCountText, questionCount === n && styles.qCountTextActive]}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.setupHint}>Each question plays the verse — recite what comes next</Text>

        {/* Juz selection */}
        <View style={[styles.labelRow, { marginTop: 24 }]}>
          <Text style={styles.setupLabel}>SELECT AJZAA</Text>
          <View style={styles.multiChip}>
            <Ionicons name="checkmark-done-outline" size={11} color="#2E7D62" />
            <Text style={styles.multiChipText}>
              {selectedJuz.size > 0 ? `${selectedJuz.size} selected` : 'Select multiple'}
            </Text>
          </View>
        </View>
        <Text style={styles.instructions}>Tap to select the ajzaa your family has memorised — you can pick more than one.</Text>

        {JUZ_DATA.map(juz => {
          const selected = selectedJuz.has(juz.num);
          const expanded = expandedJuz === juz.num;
          return (
            <View key={juz.num} style={styles.juzBlock}>
              <TouchableOpacity
                style={[styles.juzRow, selected && styles.juzRowSelected]}
                onPress={() => toggleJuz(juz.num)}
                activeOpacity={0.8}
              >
                <View style={[styles.juzCheck, selected && styles.juzCheckSelected]}>
                  {selected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.juzName, selected && styles.juzNameSelected]}>{juz.name}</Text>
                  <Text style={styles.juzMeta}>{juz.surahs.length} surahs</Text>
                </View>
                {selected && (
                  <TouchableOpacity onPress={() => setExpandedJuz(expanded ? null : juz.num)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="#6B7280" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
              {selected && expanded && (
                <View style={styles.surahList}>
                  <Text style={styles.surahListHint}>Tap a surah to exclude it</Text>
                  {juz.surahs.map(s => {
                    const excluded = excludedSurahs.has(s.num);
                    return (
                      <TouchableOpacity key={s.num} style={[styles.surahRow, excluded && styles.surahRowExcluded]} onPress={() => toggleSurah(s.num)} activeOpacity={0.75}>
                        <Text style={[styles.surahName, excluded && styles.surahNameExcluded]}>{s.name}</Text>
                        <Text style={[styles.surahAyahs, excluded && styles.surahNameExcluded]}>{s.ayahs} ayahs</Text>
                        {excluded && <Ionicons name="close-circle" size={16} color="#EF4444" />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <View style={[styles.startBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[styles.startBtn, (!selectedJuz.size || loading) && styles.startBtnDisabled]}
          onPress={startGame}
          disabled={!selectedJuz.size || loading}
          activeOpacity={0.85}
        >
          {loading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.startBtnText}>Start Game</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── In-Game Screen ───────────────────────────────────────────────────────────
function QuranPlaying({ route, navigation }) {
  const { pairs, gameState, gameConfig } = route.params;
  const insets = useSafeAreaInsets();

  const [index,     setIndex]     = useState(0);
  const [results,   setResults]   = useState([]);
  const [phase,     setPhase]     = useState('instructions'); // instructions | countdown | playing | done
  const [countdown, setCountdown] = useState(5);
  const [flash,     setFlash]     = useState(null); // 'correct' | 'pass' | null
  const [ready,     setReady]     = useState(false);

  const soundRef      = useRef(null);
  const mountedRef    = useRef(true);
  const tiltStateRef     = useRef('NEUTRAL');
  const consecutiveRef   = useRef({ pass: 0, correct: 0 });
  const neutralTimerRef  = useRef(null);
  const handleOutcomeRef = useRef(null);
  const flashAnim     = useRef(new Animated.Value(0)).current;

  const pair = pairs[index];

  // ── Orientation lock ──────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE)
      .then(() => setReady(true))
      .catch(() => setReady(true));
    return () => {
      mountedRef.current = false;
      // Stop and release audio immediately on unmount
      soundRef.current?.stopAsync().catch(() => {});
      soundRef.current?.unloadAsync().catch(() => {});
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (phase === 'done') ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
  }, [phase]);

  // ── Countdown before playing ──────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdown === 0) { setPhase('playing'); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, phase]);

  // ── Auto-play question audio when index changes ───────────────────────────
  useEffect(() => {
    if (phase !== 'playing' || !pair) return;
    playQuestionAudio();
  }, [index, phase]);

  async function playQuestionAudio() {
    if (!pair) return;
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      await soundRef.current?.stopAsync().catch(() => {});
      await soundRef.current?.unloadAsync().catch(() => {});
      if (!mountedRef.current) return;
      const { sound } = await Audio.Sound.createAsync({ uri: ayahAudioUrl(pair.prompt.number) });
      if (!mountedRef.current) { sound.unloadAsync().catch(() => {}); return; }
      soundRef.current = sound;
      await sound.playAsync();
    } catch {}
  }

  // ── Accelerometer tilt detection ──────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing') return;
    tiltStateRef.current = 'NEUTRAL';
    consecutiveRef.current = { pass: 0, correct: 0 };
    clearTimeout(neutralTimerRef.current);
    neutralTimerRef.current = null;
    Accelerometer.setUpdateInterval(30);

    function fireOutcome(outcome) {
      tiltStateRef.current = 'TILTED';
      consecutiveRef.current = { pass: 0, correct: 0 };
      clearTimeout(neutralTimerRef.current);
      neutralTimerRef.current = null;
      handleOutcomeRef.current(outcome);
    }

    const sub = Accelerometer.addListener(({ y: rawY }) => {
      // Android reports the y-axis inverted relative to iOS
      const y = Platform.OS === 'android' ? -rawY : rawY;

      if (tiltStateRef.current === 'NEUTRAL') {
        if (y >= TILT_TRIGGER) {
          consecutiveRef.current.correct += 1;
          consecutiveRef.current.pass = 0;
        } else if (y <= -TILT_TRIGGER) {
          consecutiveRef.current.pass += 1;
          consecutiveRef.current.correct = 0;
        } else {
          consecutiveRef.current.correct = 0;
          consecutiveRef.current.pass = 0;
        }
        if (consecutiveRef.current.correct >= REQUIRED_SAMPLES) fireOutcome('correct');
        else if (consecutiveRef.current.pass >= REQUIRED_SAMPLES) fireOutcome('pass');
        return;
      }

      if (tiltStateRef.current === 'TILTED') {
        if (Math.abs(y) < TILT_RELEASE) tiltStateRef.current = 'RETURNING';
        return;
      }

      if (tiltStateRef.current === 'RETURNING') {
        if (Math.abs(y) <= NEUTRAL_ZONE) {
          if (!neutralTimerRef.current) {
            neutralTimerRef.current = setTimeout(() => {
              tiltStateRef.current = 'NEUTRAL';
              consecutiveRef.current = { pass: 0, correct: 0 };
              neutralTimerRef.current = null;
            }, NEUTRAL_HOLD_MS);
          }
        } else {
          clearTimeout(neutralTimerRef.current);
          neutralTimerRef.current = null;
        }
      }
    });

    return () => { sub.remove(); clearTimeout(neutralTimerRef.current); neutralTimerRef.current = null; };
  }, [phase]);

  function triggerFlash(type) {
    setFlash(type);
    flashAnim.setValue(1);
    Animated.sequence([
      Animated.delay(320),
      Animated.timing(flashAnim, { toValue: 0, duration: 380, useNativeDriver: true }),
    ]).start(() => setFlash(null));
  }

  const handleOutcome = useCallback((outcome) => {
    if (!pair) return;
    soundRef.current?.stopAsync().catch(() => {});
    Vibration.vibrate(outcome === 'correct' ? [0, 80] : [0, 40, 40, 40]);
    triggerFlash(outcome);
    setResults(prev => [...prev, { pair, outcome }]);
    const next = index + 1;
    if (next >= pairs.length) { setPhase('done'); return; }
    setIndex(next);
  }, [index, pairs, pair]);
  useEffect(() => { handleOutcomeRef.current = handleOutcome; }, [handleOutcome]);

  const { updatedGameState, isGameOver } = useMemo(() => {
    if (phase !== 'done' || !gameState) return {};
    const correctCount = results.filter(r => r.outcome === 'correct').length;
    const updatedPlayers = gameState.players.map((p, i) =>
      i === gameState.currentPlayerIdx ? { ...p, score: p.score + correctCount } : p
    );
    const nextIdx   = gameState.currentPlayerIdx + 1;
    const roundDone = nextIdx >= gameState.players.length;
    const nextRound = roundDone ? gameState.currentRound + 1 : gameState.currentRound;
    const nextPlayer = roundDone ? 0 : nextIdx;
    const gameOver  = roundDone && nextRound > gameState.totalRounds;
    return {
      updatedGameState: { ...gameState, players: updatedPlayers, currentRound: nextRound, currentPlayerIdx: nextPlayer },
      isGameOver: gameOver,
    };
  }, [phase, gameState, results]);

  const currentPlayer = gameState?.players[gameState.currentPlayerIdx];

  function handleClose() {
    mountedRef.current = false;
    soundRef.current?.stopAsync().catch(() => {});
    soundRef.current?.unloadAsync().catch(() => {});
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    navigation.navigate('GamesHub');
  }

  if (!ready) return <View style={styles.gameRoot} />;

  // ── Instructions screen ──────────────────────────────────────────────────
  if (phase === 'instructions') {
    return (
      <View style={[styles.gameRoot, { justifyContent: 'center', gap: 28,
        paddingTop: Math.max(insets.top, 24), paddingBottom: Math.max(insets.bottom, 24),
        paddingLeft: insets.left + 28, paddingRight: insets.right + 28 }]}>
        <StatusBar style="light" hidden />
        <TouchableOpacity
          onPress={handleClose}
          style={{ position: 'absolute', top: Math.max(insets.top, 24), right: insets.right + 28 }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="close" size={20} color="rgba(255,255,255,0.4)" />
        </TouchableOpacity>
        {currentPlayer && (
          <Text style={styles.countdownPlayer}>{currentPlayer.name}'s Turn</Text>
        )}
        <Text style={styles.instructionsHeading}>📱 Place your phone on your forehead, screen facing your family.</Text>
        <TouchableOpacity
          style={styles.startGameBtn}
          onPress={() => setPhase('countdown')}
          activeOpacity={0.85}
        >
          <Text style={styles.startGameBtnText}>Tap to Start</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Countdown screen ─────────────────────────────────────────────────────
  if (phase === 'countdown') {
    return (
      <View style={[styles.gameRoot, { alignItems: 'center', justifyContent: 'center',
        paddingTop: Math.max(insets.top, 24), paddingBottom: Math.max(insets.bottom, 24),
        paddingLeft: insets.left + 28, paddingRight: insets.right + 28 }]}>
        <StatusBar style="light" hidden />
        <TouchableOpacity
          onPress={handleClose}
          style={{ position: 'absolute', top: Math.max(insets.top, 24), right: insets.right + 28 }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="close" size={20} color="rgba(255,255,255,0.4)" />
        </TouchableOpacity>
        {currentPlayer && <Text style={styles.countdownPlayer}>{currentPlayer.name}'s Turn</Text>}
        <Text style={styles.countdownLabel}>Get ready!</Text>
        <Text style={styles.countdownNum}>{countdown || 'GO!'}</Text>
        <Text style={styles.countdownSub}>Hold phone flat on your forehead</Text>
      </View>
    );
  }

  // ── Score screen ──────────────────────────────────────────────────────────
  if (phase === 'done') {
    const correct = results.filter(r => r.outcome === 'correct');
    const passed  = results.filter(r => r.outcome === 'pass');

    const resultLists = (
      <>
        {correct.length > 0 && (
          <View style={styles.resultSection}>
            <Text style={styles.resultSectionLabel}>✓ Correct</Text>
            {correct.map((r, i) => (
              <View key={i} style={[styles.resultRow, styles.resultCorrect]}>
                <Text style={styles.resultRef}>{r.pair.prompt.surah.englishName} · Ayah {r.pair.prompt.numberInSurah}</Text>
                <Text style={styles.resultArabic} numberOfLines={1}>{r.pair.answer.text}</Text>
              </View>
            ))}
          </View>
        )}
        {passed.length > 0 && (
          <View style={styles.resultSection}>
            <Text style={styles.resultSectionLabel}>→ Passed</Text>
            {passed.map((r, i) => (
              <View key={i} style={[styles.resultRow, styles.resultPass]}>
                <Text style={styles.resultRef}>{r.pair.prompt.surah.englishName} · Ayah {r.pair.prompt.numberInSurah}</Text>
                <Text style={styles.resultArabic} numberOfLines={1}>{r.pair.answer.text}</Text>
              </View>
            ))}
          </View>
        )}
      </>
    );

    // ── Final scores (game over) ───────────────────────────────────────────
    if (isGameOver && updatedGameState) {
      const sorted = [...updatedGameState.players].sort((a, b) => b.score - a.score);
      return (
        <View style={[styles.root, { paddingTop: insets.top }]}>
          <StatusBar style="dark" />
          <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}>
            <View style={styles.scoreHeader}>
              <Text style={styles.scoreTrophy}>🏆</Text>
              <Text style={styles.scoreTitle}>Game Over!</Text>
              <Text style={styles.scoreCount}>{sorted[0].name} wins!</Text>
            </View>
            <Text style={styles.boardLabel}>FINAL SCORES</Text>
            <View style={styles.leaderboard}>
              {sorted.map((p, i) => (
                <View key={p.id} style={[styles.boardRow, i === 0 && styles.boardRowWinner]}>
                  <Text style={styles.boardMedal}>{MEDALS[i]}</Text>
                  <Text style={[styles.boardName, i === 0 && styles.boardNameWinner]}>{p.name}</Text>
                  <Text style={[styles.boardScore, i === 0 && styles.boardScoreWinner]}>{p.score}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity style={styles.playAgainBtn} onPress={() => navigation.navigate('QuranCompletionGame')} activeOpacity={0.85}>
              <Text style={styles.playAgainText}>Play Again</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('GamesHub')} style={styles.backToGamesBtn}>
              <Text style={styles.backToGamesText}>Back to Games</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      );
    }

    // ── Turn result (mid-game) ─────────────────────────────────────────────
    if (gameState && updatedGameState) {
      const sortedPlayers = [...updatedGameState.players].sort((a, b) => b.score - a.score);
      const nextPlayer    = updatedGameState.players[updatedGameState.currentPlayerIdx];
      const isNewRound    = updatedGameState.currentRound !== gameState.currentRound;
      return (
        <View style={[styles.root, { paddingTop: insets.top }]}>
          <StatusBar style="dark" />
          <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}>
            <View style={styles.scoreHeader}>
              <Text style={styles.scoreTrophy}>📖</Text>
              <Text style={styles.scoreTitle}>{currentPlayer?.name}</Text>
              <Text style={styles.scoreCount}>+{correct.length} this turn</Text>
              <View style={styles.roundBadge}>
                <Text style={styles.roundBadgeText}>Round {gameState.currentRound} of {gameState.totalRounds}</Text>
              </View>
            </View>
            <Text style={styles.boardLabel}>SCOREBOARD</Text>
            <View style={styles.leaderboard}>
              {sortedPlayers.map((p, i) => (
                <View key={p.id} style={[styles.boardRow, i === 0 && styles.boardRowWinner]}>
                  <Text style={styles.boardMedal}>{MEDALS[i]}</Text>
                  <Text style={[styles.boardName, i === 0 && styles.boardNameWinner]}>{p.name}</Text>
                  <Text style={[styles.boardScore, i === 0 && styles.boardScoreWinner]}>{p.score}</Text>
                </View>
              ))}
            </View>
            {resultLists}
            <TouchableOpacity
              style={styles.nextTurnBtn}
              onPress={() => navigation.navigate('QuranCompletionGame', { autoStart: true, gameState: updatedGameState, gameConfig })}
              activeOpacity={0.85}
            >
              <Text style={styles.nextTurnText}>
                {isNewRound ? `Start Round ${updatedGameState.currentRound}` : `${nextPlayer?.name}'s Turn`}
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('GamesHub')} style={styles.backToGamesBtn}>
              <Text style={styles.backToGamesText}>End Game</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      );
    }

    // ── Single-player fallback ─────────────────────────────────────────────
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}>
          <View style={styles.scoreHeader}>
            <Text style={styles.scoreTrophy}>📖</Text>
            <Text style={styles.scoreTitle}>Masha'Allah!</Text>
            <Text style={styles.scoreCount}>{correct.length} correct · {passed.length} passed</Text>
          </View>
          {resultLists}
          <TouchableOpacity style={styles.playAgainBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
            <Text style={styles.playAgainText}>Play Again</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('GamesHub')} style={styles.backToGamesBtn}>
            <Text style={styles.backToGamesText}>Back to Games</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  if (!pair) return null;
  const { prompt, answer, isCrossSurah } = pair;
  const showBismillah = isCrossSurah && !NO_BISMILLAH.has(answer.surah.number);
  const chipLabel = isCrossSurah
    ? `${prompt.surah.englishName} → ${answer.surah.englishName}`
    : `${prompt.surah.englishName} · Ayah ${prompt.numberInSurah}`;

  // ── Playing screen (landscape) ────────────────────────────────────────────
  return (
    <View style={[styles.gameRoot, {
      paddingTop:    Math.max(insets.top, 24),
      paddingBottom: Math.max(insets.bottom, 24),
      paddingLeft:   insets.left + 28,
      paddingRight:  insets.right + 28,
    }]}>
      <StatusBar style="light" hidden />

      {/* Full-screen flash overlay */}
      {flash && (
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: flash === 'correct' ? '#16A34A' : '#EA580C', opacity: flashAnim, zIndex: 10, alignItems: 'center', justifyContent: 'center' }]}
          pointerEvents="none"
        >
          <Text style={styles.flashIcon}>{flash === 'correct' ? '✓' : '→'}</Text>
          <Text style={styles.flashLabel}>{flash === 'correct' ? 'CORRECT!' : 'PASS'}</Text>
        </Animated.View>
      )}

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={20} color="rgba(255,255,255,0.45)" />
        </TouchableOpacity>
        <View style={styles.surahChip}>
          <Text style={styles.surahChipText}>{chipLabel}</Text>
        </View>
        <View style={styles.progressPill}>
          <Text style={styles.progressText}>{index + 1} / {pairs.length}</Text>
        </View>
        <TouchableOpacity onPress={playQuestionAudio} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="volume-medium-outline" size={20} color="rgba(255,255,255,0.45)" />
        </TouchableOpacity>
      </View>

      {/* Ayah content */}
      <View style={styles.ayahContent}>
        {/* Answer — visible to family */}
        <View style={styles.answerBlock}>
          <Text style={styles.blockLabel}>ANSWER</Text>
          {showBismillah && <Text style={styles.arabicBismillah}>{BISMILLAH}</Text>}
          <Text style={styles.arabicAnswer} numberOfLines={3}>
            {answer.text}
          </Text>
          <Text style={styles.answerRef}>{answer.surah.englishName} · {answer.numberInSurah}</Text>
        </View>

        <View style={styles.divider} />

        {/* Question */}
        <View style={styles.questionBlock}>
          <Text style={styles.blockLabel}>HEAR & RECITE NEXT ↓</Text>
          <Text style={styles.arabicPrompt} numberOfLines={3}>
            {prompt.text}
          </Text>
        </View>
      </View>

      {/* Tilt instruction boxes */}
      <View style={styles.btnRow}>
        <View style={[styles.gameBtn, styles.correctBtn]}>
          <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.7)" />
          <View>
            <Text style={styles.gameBtnText}>Correct</Text>
            <Text style={styles.gameBtnSub}>tilt right</Text>
          </View>
        </View>
        <View style={[styles.gameBtn, styles.passBtn]}>
          <View>
            <Text style={styles.gameBtnText}>Pass</Text>
            <Text style={styles.gameBtnSub}>tilt left</Text>
          </View>
          <Ionicons name="arrow-forward" size={20} color="rgba(255,255,255,0.5)" />
        </View>
      </View>
    </View>
  );
}

export { JuzSelector as QuranCompletionGameScreen, QuranPlaying, HowToPlayModal as QuranHowToModal };

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#F7F8FA' },
  header:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
  headerEyebrow: { fontSize: 10, fontWeight: '800', color: '#9CA3AF', letterSpacing: 1.2, textTransform: 'uppercase' },
  headerTitle:   { fontSize: 22, fontWeight: '800', color: '#1A1A2E', marginTop: 1 },
  scroll:        { paddingHorizontal: 20, paddingTop: 8 },
  instructions:  { fontSize: 13, color: '#6B7280', lineHeight: 20, marginBottom: 16 },

  // Setup
  setupLabel: { fontSize: 11, fontWeight: '800', color: '#9CA3AF', letterSpacing: 1.2, marginBottom: 12 },
  setupHint:  { fontSize: 12, color: '#9CA3AF', marginTop: 6, marginBottom: 4 },
  labelRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 0 },
  multiChip:  { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EDF7F2', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 },
  multiChipText: { fontSize: 11, fontWeight: '600', color: '#2E7D62' },
  qCountRow:  { flexDirection: 'row', gap: 12 },
  qCountPill: {
    flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  qCountPillActive:  { backgroundColor: '#1B3D2F' },
  qCountText:        { fontSize: 20, fontWeight: '800', color: '#6B7280' },
  qCountTextActive:  { color: '#FFFFFF' },

  juzBlock:        { marginBottom: 10 },
  juzRow:          { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#F0F0F0' },
  juzRowSelected:  { borderColor: '#1B3D2F', backgroundColor: '#F0F9F4' },
  juzCheck:        { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  juzCheckSelected:{ backgroundColor: '#1B3D2F', borderColor: '#1B3D2F' },
  juzName:         { fontSize: 15, fontWeight: '700', color: '#374151' },
  juzNameSelected: { color: '#1B3D2F' },
  juzMeta:         { fontSize: 12, color: '#9CA3AF', marginTop: 1 },

  surahList:        { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, marginTop: 4 },
  surahListHint:    { fontSize: 11, color: '#9CA3AF', marginBottom: 8 },
  surahRow:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  surahRowExcluded: { opacity: 0.5 },
  surahName:        { flex: 1, fontSize: 14, fontWeight: '600', color: '#374151' },
  surahNameExcluded:{ color: '#9CA3AF' },
  surahAyahs:       { fontSize: 12, color: '#9CA3AF' },

  startBar:         { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 12, backgroundColor: '#F7F8FA', borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  startBtn:         { backgroundColor: '#1B3D2F', borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  startBtnDisabled: { backgroundColor: '#D1D5DB' },
  startBtnText:     { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

  // Game (landscape)
  gameRoot:    { flex: 1, backgroundColor: '#1B2A20' },
  topBar:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  surahChip:   { flex: 1, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 100, paddingHorizontal: 12, paddingVertical: 4, alignItems: 'center' },
  surahChipText: { fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: '600' },
  progressPill:{ backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 100, paddingHorizontal: 12, paddingVertical: 4 },
  progressText:{ fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },
  replayBtn:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  replayBtnText:{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: '500' },

  ayahContent: { flex: 1, flexDirection: 'row', gap: 16, alignItems: 'stretch' },
  questionBlock: { flex: 1, justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 10 },
  answerBlock:   { flex: 1, justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 10 },
  blockLabel:    { fontSize: 9, fontWeight: '800', color: 'rgba(255,255,255,0.3)', letterSpacing: 1.2, marginBottom: 12 },
  divider:       { width: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 4 },

  arabicPrompt: {
    fontSize: 32, lineHeight: 78, color: '#FFFFFF', textAlign: 'right',
    fontFamily: 'Amiri_400Regular',
  },
  arabicAnswer: {
    fontSize: 30, lineHeight: 74, color: '#D4A843', textAlign: 'right',
    fontFamily: 'Amiri_400Regular',
  },
  arabicBismillah: {
    fontSize: 19, lineHeight: 46, color: 'rgba(212,168,67,0.6)', textAlign: 'right',
    fontFamily: 'Amiri_400Regular', marginBottom: 4,
  },
  answerRef: { fontSize: 11, color: 'rgba(212,168,67,0.45)', textAlign: 'right', marginTop: 8 },

  btnRow:     { flexDirection: 'row', gap: 12, marginTop: 10 },
  gameBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  passBtn:    { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' },
  correctBtn: { backgroundColor: 'rgba(46,125,98,0.35)', borderColor: 'rgba(46,125,98,0.5)' },
  gameBtnText:{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  gameBtnSub: { fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 1 },
  flashIcon:    { fontSize: 72, color: '#FFFFFF', fontWeight: '900' },
  flashLabel:   { fontSize: 28, fontWeight: '900', color: '#FFFFFF', letterSpacing: 2, marginTop: 8 },
  countdownClose:  { position: 'absolute', top: 16, right: 16 },
  countdownPlayer: { fontSize: 18, fontWeight: '800', color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
  countdownLabel:  { fontSize: 18, fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginBottom: 16 },
  countdownNum:   { fontSize: 96, fontWeight: '900', color: '#FFFFFF' },
  countdownSub:   { fontSize: 14, color: 'rgba(255,255,255,0.45)', marginTop: 24, textAlign: 'center', paddingHorizontal: 40 },
  instructionsHeading: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', textAlign: 'center', lineHeight: 36, paddingHorizontal: 20 },
  startGameBtn:    { backgroundColor: '#D4A843', borderRadius: 16, paddingVertical: 18, paddingHorizontal: 48, alignItems: 'center', alignSelf: 'center' },
  startGameBtnText:{ fontSize: 20, fontWeight: '900', color: '#1B3D2F' },

  // Score
  scoreHeader:        { alignItems: 'center', paddingVertical: 28 },
  scoreTrophy:        { fontSize: 52, marginBottom: 10 },
  scoreTitle:         { fontSize: 28, fontWeight: '900', color: '#1A1A2E', marginBottom: 4 },
  scoreCount:         { fontSize: 16, fontWeight: '600', color: '#2E7D62' },
  resultSection:      { marginBottom: 20 },
  resultSectionLabel: { fontSize: 11, fontWeight: '800', color: '#9CA3AF', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' },
  resultRow:          { padding: 12, borderRadius: 12, marginBottom: 6 },
  resultCorrect:      { backgroundColor: '#F0FBF4' },
  resultPass:         { backgroundColor: '#F9FAFB' },
  resultRef:          { fontSize: 11, fontWeight: '600', color: '#6B7280', marginBottom: 4 },
  resultArabic:       { fontSize: 18, color: '#1A1A2E', textAlign: 'right', fontFamily: 'Amiri_400Regular' },
  playAgainBtn:       { backgroundColor: '#1B3D2F', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  playAgainText:      { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  backToGamesBtn:     { alignItems: 'center', paddingVertical: 14 },
  backToGamesText:    { fontSize: 14, color: '#6B7280', fontWeight: '500' },

  // Players & rounds (setup)
  playerList:      { gap: 10, marginBottom: 8 },
  playerRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, borderWidth: 1.5, borderColor: '#F0F0F0' },
  playerRowError:  { borderColor: '#EF4444' },
  playerNumBadge:  { width: 28, height: 28, borderRadius: 14, backgroundColor: '#1B3D2F', alignItems: 'center', justifyContent: 'center' },
  playerNumText:   { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  playerInput:     { flex: 1, fontSize: 15, color: '#1A1A2E', fontWeight: '600' },
  addPlayerRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 4 },
  addPlayerText:   { fontSize: 14, fontWeight: '600', color: '#2E7D62' },
  roundsRow:       { flexDirection: 'row', gap: 12, marginBottom: 4 },
  roundPill:       { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  roundPillActive: { backgroundColor: '#1B3D2F' },
  roundPillText:   { fontSize: 20, fontWeight: '800', color: '#6B7280' },
  roundPillTextActive: { color: '#FFFFFF' },

  // Leaderboard
  boardLabel:       { fontSize: 11, fontWeight: '800', color: '#9CA3AF', letterSpacing: 1.2, marginBottom: 12, textTransform: 'uppercase' },
  leaderboard:      { gap: 8, marginBottom: 24 },
  boardRow:         { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#F0F0F0' },
  boardRowWinner:   { borderColor: '#D4A843', backgroundColor: '#FFFBEB' },
  boardMedal:       { fontSize: 22 },
  boardName:        { flex: 1, fontSize: 15, fontWeight: '700', color: '#374151' },
  boardNameWinner:  { color: '#92400E' },
  boardScore:       { fontSize: 24, fontWeight: '900', color: '#6B7280' },
  boardScoreWinner: { color: '#D4A843' },
  nextTurnBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#1B3D2F', borderRadius: 16, paddingVertical: 16, marginTop: 8 },
  nextTurnText:     { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  roundBadge:       { marginTop: 8, backgroundColor: '#EDF7F2', borderRadius: 100, paddingHorizontal: 12, paddingVertical: 4 },
  roundBadgeText:   { fontSize: 13, fontWeight: '700', color: '#1B3D2F' },
  howToTrigger:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  howToTriggerText: { fontSize: 13, fontWeight: '600', color: '#1B3D2F' },
});

// ─── How To Play Modal styles ─────────────────────────────────────────────────
const nams = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet:     { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 20, paddingBottom: 36, minHeight: '78%' },
  closeBtn:  { alignSelf: 'flex-end', marginRight: 20, marginBottom: 4, width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  carousel:  { flexGrow: 0 },
  slidePage: { width: SCREEN_WIDTH, paddingHorizontal: 20, alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  stepImage: { width: SCREEN_WIDTH - 40, height: (SCREEN_WIDTH - 40) * 1.1 },
  dotsRow:   { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 20, marginBottom: 20 },
  dot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E5E7EB' },
  dotActive: { width: 22, height: 8, borderRadius: 4, backgroundColor: '#1B3D2F' },
  actions:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 24 },
  skipBtn:   { paddingHorizontal: 16, paddingVertical: 14 },
  skipText:  { fontSize: 15, fontWeight: '600', color: '#9CA3AF' },
  backBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, paddingVertical: 14 },
  backText:  { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  nextBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, paddingVertical: 15, backgroundColor: '#1B3D2F' },
  nextText:  { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
});
