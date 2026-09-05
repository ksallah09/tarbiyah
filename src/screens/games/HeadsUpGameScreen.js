import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, Vibration, StatusBar as RNStatusBar, TextInput,
  Modal, Dimensions, Image, Platform,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { Accelerometer } from 'expo-sensors';
import { Audio } from 'expo-av';
import * as ScreenOrientation from 'expo-screen-orientation';
import { CATEGORIES } from '../../data/headsup_categories';
import { fetchCategories } from '../../utils/headsupCategories';

const TIMER_SECONDS = 60;
const TILT_TRIGGER     = 0.75;  // sustained tilt threshold
const TILT_RELEASE     = 0.45;  // must drop below this before RETURNING
const NEUTRAL_ZONE     = 0.25;  // tight center zone to re-arm
const REQUIRED_SAMPLES = 3;     // consecutive ticks to confirm tilt (~90ms at 30ms interval)
const NEUTRAL_HOLD_MS  = 180;   // ms to stay in neutral before re-arming
const MEDALS = ['🥇', '🥈', '🥉', '🏅', '🏅', '🏅'];
const ROUND_OPTIONS = [1, 2, 3, 5];

const HOW_TO_STEPS = [
  { image: require('../../../assets/hu-1.png') },
  { image: require('../../../assets/hu-2.png') },
  { image: require('../../../assets/hu-3.png') },
  { image: require('../../../assets/hu-4.png') },
  { image: require('../../../assets/hu-5.png') },
];

// ─── How To Play Modal ────────────────────────────────────────────────────────
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
    if (page < HOW_TO_STEPS.length - 1) {
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
      <View style={ms.overlay}>
        <View style={ms.sheet}>
          {/* Close */}
          <TouchableOpacity onPress={onClose} style={ms.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color="#9CA3AF" />
          </TouchableOpacity>

          {/* Carousel */}
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleScroll}
            style={ms.carousel}
            scrollEventThrottle={16}
          >
            {HOW_TO_STEPS.map((s, i) => (
              <View key={i} style={ms.slidePage}>
                <Image source={s.image} style={ms.stepImage} resizeMode="contain" />
              </View>
            ))}
          </ScrollView>

          {/* Dots */}
          <View style={ms.dotsRow}>
            {HOW_TO_STEPS.map((_, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => {
                  scrollRef.current?.scrollTo({ x: i * SCREEN_WIDTH, animated: true });
                  setPage(i);
                }}
              >
                <View style={[ms.dot, i === page && ms.dotActive]} />
              </TouchableOpacity>
            ))}
          </View>

          {/* Actions */}
          <View style={ms.actions}>
            {page > 0 ? (
              <TouchableOpacity
                onPress={() => {
                  const prev = page - 1;
                  scrollRef.current?.scrollTo({ x: prev * SCREEN_WIDTH, animated: true });
                  setPage(prev);
                }}
                style={ms.backBtn}
              >
                <Ionicons name="arrow-back" size={16} color="#6B7280" />
                <Text style={ms.backText}>Back</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={onClose} style={ms.skipBtn}>
                <Text style={ms.skipText}>Skip</Text>
              </TouchableOpacity>
            )}
            {page < HOW_TO_STEPS.length - 1 ? (
              <TouchableOpacity onPress={goNext} style={ms.nextBtn}>
                <Text style={ms.nextText}>Next</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={onClose} style={ms.nextBtn}>
                <Text style={ms.nextText}>Let's Play!</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Setup Screen ─────────────────────────────────────────────────────────────
function HeadsUpSetup({ navigation }) {
  const insets = useSafeAreaInsets();
  const [players, setPlayers] = useState([
    { id: '1', name: '' },
    { id: '2', name: '' },
  ]);
  const [totalRounds, setTotalRounds] = useState(3);
  const [howToVisible, setHowToVisible] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  function addPlayer() {
    if (players.length >= 6) return;
    const id = Date.now().toString();
    setPlayers(prev => [...prev, { id, name: '' }]);
  }

  function removePlayer(id) {
    if (players.length <= 1) return;
    setPlayers(prev => prev.filter(p => p.id !== id));
  }

  function updateName(id, text) {
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, name: text } : p));
    if (showErrors) setShowErrors(false);
  }

  function startGame() {
    const anyEmpty = players.some(p => !p.name.trim());
    if (anyEmpty) { setShowErrors(true); return; }
    const gameState = {
      players: players.map(p => ({ ...p, name: p.name.trim(), score: 0 })),
      totalRounds,
      currentRound: 1,
      currentPlayerIdx: 0,
    };
    navigation.navigate('HeadsUpGame', { gameState });
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color="#1A1A2E" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerEyebrow}>HEADS UP</Text>
          <Text style={styles.headerTitle}>Who's Playing?</Text>
        </View>
        <TouchableOpacity onPress={() => setHowToVisible(true)} style={styles.howToTrigger} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="help-circle-outline" size={22} color="#1B3D2F" />
          <Text style={styles.howToTriggerText}>How to play</Text>
        </TouchableOpacity>
      </View>

      <HowToPlayModal visible={howToVisible} onClose={() => setHowToVisible(false)} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
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
                <TouchableOpacity
                  onPress={() => removePlayer(p.id)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
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
            <TouchableOpacity
              key={r}
              style={[styles.roundPill, totalRounds === r && styles.roundPillActive]}
              onPress={() => setTotalRounds(r)}
              activeOpacity={0.8}
            >
              <Text style={[styles.roundPillText, totalRounds === r && styles.roundPillTextActive]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.setupHint}>Each player picks a category and plays once per round</Text>

        <TouchableOpacity style={styles.startBtn} onPress={startGame} activeOpacity={0.85}>
          <Ionicons name="play" size={18} color="#FFFFFF" />
          <Text style={styles.startBtnText}>Start Game</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ─── Category Picker ──────────────────────────────────────────────────────────
function CategoryPicker({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { gameState } = route.params ?? {};
  const currentPlayer = gameState?.players[gameState.currentPlayerIdx];
  const [categories, setCategories] = useState(CATEGORIES);

  useEffect(() => {
    fetchCategories(setCategories).then(setCategories).catch(() => {});
  }, []);

  function startGame(category) {
    const shuffled = [...category.cards].sort(() => Math.random() - 0.5);
    // Fire lock immediately — phone rotates behind the opaque green screen, no await needed
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    navigation.navigate('HeadsUpPlaying', { category, cards: shuffled, gameState });
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={24} color="#6B7280" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          {gameState ? (
            <>
              <Text style={styles.headerEyebrow}>
                ROUND {gameState.currentRound} OF {gameState.totalRounds}
              </Text>
              <Text style={styles.headerTitle}>{currentPlayer?.name}'s Turn</Text>
            </>
          ) : (
            <>
              <Text style={styles.headerEyebrow}>HEADS UP</Text>
              <Text style={styles.headerTitle}>Choose a Category</Text>
            </>
          )}
        </View>
        {gameState && (
          <View style={styles.scoreChip}>
            <Text style={styles.scoreChipText}>{currentPlayer?.score ?? 0} pts</Text>
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {categories.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.catCard, { borderLeftColor: cat.color }]}
              onPress={() => startGame(cat)}
              activeOpacity={0.8}
            >
              <Text style={styles.catEmoji}>{cat.emoji}</Text>
              <Text style={styles.catLabel}>{cat.label}</Text>
              <Text style={styles.catCount}>{cat.cards.length} cards</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── In-Game Screen ───────────────────────────────────────────────────────────
function HeadsUpPlaying({ route, navigation }) {
  const { category, cards, gameState } = route.params;
  const insets = useSafeAreaInsets();

  const [index,     setIndex]     = useState(0);
  const [timeLeft,  setTimeLeft]  = useState(TIMER_SECONDS);
  const [results,   setResults]   = useState([]);
  const [phase,     setPhase]     = useState('instructions');
  const [countdown, setCountdown] = useState(5);
  const [flash,     setFlash]     = useState(null);
  const [ready,     setReady]     = useState(false);

  const tiltStateRef      = useRef('NEUTRAL'); // NEUTRAL | TILTED | RETURNING
  const consecutiveRef    = useRef({ pass: 0, correct: 0 });
  const neutralTimerRef   = useRef(null);
  const handleOutcomeRef  = useRef(null);
  const flashAnim       = useRef(new Animated.Value(0)).current;
  const timerRef        = useRef(null);
  const correctSoundRef = useRef(null);
  const passSoundRef    = useRef(null);

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE)
      .then(() => setReady(true))
      .catch(() => setReady(true));
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (phase === 'done') {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    }
  }, [phase]);

  useEffect(() => {
    async function loadSounds() {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          allowsRecordingIOS: false,
          shouldDuckAndroid: false,
        });
        const { sound: c } = await Audio.Sound.createAsync(
          require('../../../assets/correct.wav'), { shouldPlay: false, volume: 1.0 }
        );
        const { sound: p } = await Audio.Sound.createAsync(
          require('../../../assets/pass.wav'), { shouldPlay: false, volume: 1.0 }
        );
        correctSoundRef.current = c;
        passSoundRef.current    = p;
      } catch (_) {}
    }
    loadSounds();
    return () => {
      correctSoundRef.current?.stopAsync().catch(() => {});
      correctSoundRef.current?.unloadAsync().catch(() => {});
      passSoundRef.current?.stopAsync().catch(() => {});
      passSoundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdown === 0) { setPhase('playing'); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, phase]);

  useEffect(() => {
    if (phase !== 'playing') return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); setPhase('done'); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

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

  async function playOutcomeSound(type) {
    try {
      const sound = type === 'correct' ? correctSoundRef.current : passSoundRef.current;
      if (sound) { await sound.setPositionAsync(0); await sound.playAsync(); }
    } catch (_) {}
  }

  function triggerFlash(type) {
    setFlash(type);
    flashAnim.setValue(1);
    Animated.sequence([
      Animated.delay(320),
      Animated.timing(flashAnim, { toValue: 0, duration: 380, useNativeDriver: true }),
    ]).start(() => setFlash(null));
  }

  const handleOutcome = useCallback((outcome) => {
    const word = cards[index];
    if (!word) return;
    setResults(prev => [...prev, { word, outcome }]);
    Vibration.vibrate(outcome === 'correct' ? [0, 80] : [0, 40, 40, 40]);
    playOutcomeSound(outcome);
    triggerFlash(outcome);
    const next = index + 1;
    if (next >= cards.length) { clearInterval(timerRef.current); setPhase('done'); return; }
    setIndex(next);
  }, [index, cards]);
  useEffect(() => { handleOutcomeRef.current = handleOutcome; }, [handleOutcome]);

  // Compute updated game state when a turn ends
  const { updatedGameState, isGameOver } = useMemo(() => {
    if (phase !== 'done' || !gameState) return {};
    const correctCount = results.filter(r => r.outcome === 'correct').length;
    const updatedPlayers = gameState.players.map((p, i) =>
      i === gameState.currentPlayerIdx ? { ...p, score: p.score + correctCount } : p
    );
    const nextIdx    = gameState.currentPlayerIdx + 1;
    const roundDone  = nextIdx >= gameState.players.length;
    const nextRound  = roundDone ? gameState.currentRound + 1 : gameState.currentRound;
    const nextPlayer = roundDone ? 0 : nextIdx;
    const gameOver   = roundDone && nextRound > gameState.totalRounds;
    return {
      updatedGameState: { ...gameState, players: updatedPlayers, currentRound: nextRound, currentPlayerIdx: nextPlayer },
      isGameOver: gameOver,
    };
  }, [phase, gameState, results]);

  const currentWord = cards[index] ?? '';
  const timerPct    = timeLeft / TIMER_SECONDS;
  const timerColor  = timerPct > 0.4 ? '#2E7D62' : timerPct > 0.2 ? '#D4A843' : '#EF4444';
  const currentPlayer = gameState?.players[gameState.currentPlayerIdx];

  function handleClose() {
    clearInterval(timerRef.current);
    correctSoundRef.current?.stopAsync().catch(() => {});
    correctSoundRef.current?.unloadAsync().catch(() => {});
    passSoundRef.current?.stopAsync().catch(() => {});
    passSoundRef.current?.unloadAsync().catch(() => {});
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    navigation.navigate('GamesHub');
  }

  if (!ready) return <View style={styles.gameRoot} />;

  // ── Instructions ──────────────────────────────────────────────────────────
  if (phase === 'instructions') {
    return (
      <View style={[styles.gameRoot, { justifyContent: 'center', gap: 28, paddingTop: Math.max(insets.top, 24), paddingBottom: Math.max(insets.bottom, 24), paddingLeft: insets.left + 28, paddingRight: insets.right + 28 }]}>
        <StatusBar style="light" hidden />
        <TouchableOpacity
          onPress={handleClose}
          style={{ position: 'absolute', top: Math.max(insets.top, 24), right: insets.right + 28 }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="close" size={20} color="rgba(255,255,255,0.4)" />
        </TouchableOpacity>
        {currentPlayer && (
          <Text style={styles.countdownPlayer}>{currentPlayer.name}'s Turn — {category.label}</Text>
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

  // ── Countdown ─────────────────────────────────────────────────────────────
  if (phase === 'countdown') {
    return (
      <View style={[styles.gameRoot, { backgroundColor: '#1B3D2F', paddingTop: Math.max(insets.top, 24), paddingBottom: Math.max(insets.bottom, 24), paddingLeft: insets.left + 28, paddingRight: insets.right + 28 }]}>
        <StatusBar style="light" />
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
        <Text style={styles.countdownLabel}>{currentPlayer ? 'Get ready!' : 'Get ready!'}</Text>
        <Text style={styles.countdownNum}>{countdown || 'GO!'}</Text>
        <Text style={styles.countdownSub}>Hold phone flat on your forehead</Text>
      </View>
    );
  }

  // ── Score screen ──────────────────────────────────────────────────────────
  if (phase === 'done') {
    const correct = results.filter(r => r.outcome === 'correct');
    const passed  = results.filter(r => r.outcome === 'pass');

    // ── Final score (game over) ───────────────────────────────────────────
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

            <TouchableOpacity style={styles.playAgainBtn} onPress={() => navigation.navigate('HeadsUpSetup')} activeOpacity={0.85}>
              <Text style={styles.playAgainText}>Play Again</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('GamesHub')} style={styles.backToGamesBtn}>
              <Text style={styles.backToGamesText}>Back to Games</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      );
    }

    // ── Turn result (mid-game) ────────────────────────────────────────────
    if (gameState && updatedGameState) {
      const sortedPlayers = [...updatedGameState.players].sort((a, b) => b.score - a.score);
      const nextPlayer    = updatedGameState.players[updatedGameState.currentPlayerIdx];
      const isNewRound    = updatedGameState.currentRound !== gameState.currentRound;
      return (
        <View style={[styles.root, { paddingTop: insets.top }]}>
          <StatusBar style="dark" />
          <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}>
            <View style={styles.scoreHeader}>
              <Text style={styles.scoreTrophy}>🎯</Text>
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

            {correct.length > 0 && (
              <View style={styles.resultSection}>
                <Text style={styles.resultSectionLabel}>✓ Correct</Text>
                {correct.map((r, i) => (
                  <View key={i} style={[styles.resultRow, styles.resultCorrect]}>
                    <Text style={styles.resultWord}>{r.word}</Text>
                  </View>
                ))}
              </View>
            )}
            {passed.length > 0 && (
              <View style={styles.resultSection}>
                <Text style={styles.resultSectionLabel}>→ Passed</Text>
                {passed.map((r, i) => (
                  <View key={i} style={[styles.resultRow, styles.resultPass]}>
                    <Text style={styles.resultWord}>{r.word}</Text>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={styles.nextTurnBtn}
              onPress={() => navigation.navigate('HeadsUpGame', { gameState: updatedGameState })}
              activeOpacity={0.85}
            >
              <Text style={styles.nextTurnText}>
                {isNewRound
                  ? `Start Round ${updatedGameState.currentRound}`
                  : `${nextPlayer?.name}'s Turn`}
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

    // ── Single-player fallback ────────────────────────────────────────────
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}>
          <View style={styles.scoreHeader}>
            <Text style={styles.scoreTrophy}>🎉</Text>
            <Text style={styles.scoreTitle}>Time's up!</Text>
            <Text style={styles.scoreCount}>{correct.length} correct</Text>
          </View>
          {correct.length > 0 && (
            <View style={styles.resultSection}>
              <Text style={styles.resultSectionLabel}>✓ Correct</Text>
              {correct.map((r, i) => (
                <View key={i} style={[styles.resultRow, styles.resultCorrect]}>
                  <Text style={styles.resultWord}>{r.word}</Text>
                </View>
              ))}
            </View>
          )}
          {passed.length > 0 && (
            <View style={styles.resultSection}>
              <Text style={styles.resultSectionLabel}>→ Passed</Text>
              {passed.map((r, i) => (
                <View key={i} style={[styles.resultRow, styles.resultPass]}>
                  <Text style={styles.resultWord}>{r.word}</Text>
                </View>
              ))}
            </View>
          )}
          <TouchableOpacity style={styles.playAgainBtn} onPress={() => navigation.navigate('HeadsUpGame')} activeOpacity={0.85}>
            <Text style={styles.playAgainText}>Play Again</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('GamesHub')} style={styles.backToGamesBtn}>
            <Text style={styles.backToGamesText}>Back to Games</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── Playing ───────────────────────────────────────────────────────────────
  return (
    <View style={[styles.gameRoot, {
      paddingTop:    Math.max(insets.top, 24),
      paddingBottom: Math.max(insets.bottom, 24),
      paddingLeft:   insets.left + 28,
      paddingRight:  insets.right + 28,
    }]}>
      <StatusBar style="light" hidden />
      <RNStatusBar hidden />

      {flash && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: flash === 'correct' ? '#16A34A' : '#EA580C', opacity: flashAnim, zIndex: 10, alignItems: 'center', justifyContent: 'center' },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.flashIcon}>{flash === 'correct' ? '✓' : '→'}</Text>
          <Text style={styles.flashLabel}>{flash === 'correct' ? 'CORRECT!' : 'PASS'}</Text>
        </Animated.View>
      )}

      {/* Top row: close | progress bar | counter */}
      <View style={styles.topRow}>
        <TouchableOpacity onPress={handleClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="close" size={20} color="rgba(255,255,255,0.35)" />
        </TouchableOpacity>
        <View style={[styles.timerBar, { backgroundColor: '#FFFFFF18', flex: 1 }]}>
          <View style={[styles.timerFill, { width: `${timerPct * 100}%`, backgroundColor: timerColor }]} />
        </View>
        <Text style={styles.cardCounter}>{index + 1}/{cards.length}</Text>
      </View>

      {/* Digital clock timer */}
      <Text style={[styles.digitalTimer, { color: '#FFFFFF' }]}>
        {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
      </Text>

      {/* Word */}
      <View style={styles.wordWrap}>
        <Text style={styles.categoryLabel}>{category.label}</Text>
        <Text style={styles.wordText} adjustsFontSizeToFit minimumFontScale={0.45} numberOfLines={2}>
          {currentWord}
        </Text>
      </View>

      <View style={styles.btnRow}>
        <View style={[styles.gameBtn, styles.correctBtn]}>
          <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.7)" />
          <View>
            <Text style={styles.gameBtnText}>Got it!</Text>
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

// ─── Exports ──────────────────────────────────────────────────────────────────
export { HeadsUpSetup, CategoryPicker as HeadsUpGameScreen, HeadsUpPlaying, HowToPlayModal as HeadsUpHowToModal };

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#F7F8FA' },
  header:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
  headerEyebrow: { fontSize: 10, fontWeight: '800', color: '#9CA3AF', letterSpacing: 1.2, textTransform: 'uppercase' },
  headerTitle:   { fontSize: 22, fontWeight: '800', color: '#1A1A2E', marginTop: 1 },
  scroll:        { paddingHorizontal: 20, paddingTop: 8 },
  howToTrigger:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  howToTriggerText: { fontSize: 13, fontWeight: '600', color: '#1B3D2F' },

  // Category grid
  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  catCard: {
    width: '47%', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    borderLeftWidth: 4, gap: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  catEmoji: { fontSize: 28, marginBottom: 4 },
  catLabel: { fontSize: 14, fontWeight: '700', color: '#1A1A2E' },
  catCount: { fontSize: 12, color: '#9CA3AF' },

  // Score chip in header
  scoreChip:     { backgroundColor: '#E8F5EF', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  scoreChipText: { fontSize: 13, fontWeight: '700', color: '#1B3D2F' },

  // Setup
  setupLabel:   { fontSize: 11, fontWeight: '800', color: '#9CA3AF', letterSpacing: 1.2, marginBottom: 12 },
  playerList:   { backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden', marginBottom: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  playerRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  playerRowError: { backgroundColor: '#FEF2F2' },
  playerNumBadge:  { width: 28, height: 28, borderRadius: 14, backgroundColor: '#1B3D2F', alignItems: 'center', justifyContent: 'center' },
  playerNumText:   { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  playerInput:     { flex: 1, fontSize: 16, fontWeight: '600', color: '#1A1A2E', paddingVertical: 0 },
  addPlayerRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 14 },
  addPlayerText:   { fontSize: 14, fontWeight: '600', color: '#2E7D62' },

  roundsRow: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  roundPill: {
    flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  roundPillActive:    { backgroundColor: '#1B3D2F' },
  roundPillText:      { fontSize: 20, fontWeight: '800', color: '#6B7280' },
  roundPillTextActive:{ color: '#FFFFFF' },
  setupHint:          { fontSize: 12, color: '#9CA3AF', marginBottom: 32, textAlign: 'center' },
  startBtn:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#1B3D2F', borderRadius: 16, paddingVertical: 18 },
  startBtnText:       { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },

  // Game
  gameRoot:      { flex: 1, backgroundColor: '#1B3D2F', alignItems: 'center', justifyContent: 'space-between' },
  topRow:        { flexDirection: 'row', alignItems: 'center', gap: 14, width: '100%' },
  timerBar:      { flex: 1, height: 5, borderRadius: 3, overflow: 'hidden' },
  timerFill:     { height: '100%', borderRadius: 3 },
  digitalTimer:  { fontSize: 52, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: 3 },
  wordWrap:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  categoryLabel: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.4)', letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' },
  wordText:      { fontSize: 64, fontWeight: '900', color: '#FFFFFF', textAlign: 'center', width: '100%' },
  cardCounter:   { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.35)', minWidth: 36, textAlign: 'right' },
  btnRow:        { flexDirection: 'row', gap: 12, width: '100%' },
  gameBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  passBtn:       { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' },
  correctBtn:    { backgroundColor: 'rgba(46,125,98,0.35)', borderColor: 'rgba(46,125,98,0.5)' },
  gameBtnText:   { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  gameBtnSub:    { fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 1 },

  // Flash
  flashIcon:  { fontSize: 80, color: '#FFFFFF', marginBottom: 12 },
  flashLabel: { fontSize: 36, fontWeight: '900', color: '#FFFFFF', letterSpacing: 2 },

  // Countdown
  countdownClose:  { position: 'absolute', top: 16, right: 16 },
  countdownPlayer: { fontSize: 18, fontWeight: '800', color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
  countdownLabel:  { fontSize: 18, fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginBottom: 16 },
  countdownNum:    { fontSize: 96, fontWeight: '900', color: '#FFFFFF' },
  countdownSub:    { fontSize: 14, color: 'rgba(255,255,255,0.45)', marginTop: 24, textAlign: 'center', paddingHorizontal: 40 },
  instructionsHeading: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', textAlign: 'center', lineHeight: 36, paddingHorizontal: 20 },
  startGameBtn:    { backgroundColor: '#D4A843', borderRadius: 16, paddingVertical: 18, paddingHorizontal: 48, alignItems: 'center', alignSelf: 'center' },
  startGameBtnText:{ fontSize: 20, fontWeight: '900', color: '#1B3D2F' },

  // Score
  scoreHeader:  { alignItems: 'center', paddingVertical: 28 },
  scoreTrophy:  { fontSize: 52, marginBottom: 10 },
  scoreTitle:   { fontSize: 28, fontWeight: '900', color: '#1A1A2E', marginBottom: 4 },
  scoreCount:   { fontSize: 18, fontWeight: '600', color: '#2E7D62', marginBottom: 8 },

  roundBadge:     { backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, marginTop: 4 },
  roundBadgeText: { fontSize: 12, fontWeight: '700', color: '#6B7280' },

  // Leaderboard
  boardLabel: { fontSize: 11, fontWeight: '800', color: '#9CA3AF', letterSpacing: 1.2, marginBottom: 10 },
  leaderboard:  { backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden', marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  boardRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  boardRowWinner: { backgroundColor: '#FEFCE8' },
  boardMedal:   { fontSize: 22, width: 32 },
  boardName:    { flex: 1, fontSize: 16, fontWeight: '600', color: '#1A1A2E' },
  boardNameWinner: { fontWeight: '800', color: '#1B3D2F' },
  boardScore:   { fontSize: 22, fontWeight: '800', color: '#9CA3AF' },
  boardScoreWinner: { color: '#1B3D2F' },

  resultSection:      { marginBottom: 20 },
  resultSectionLabel: { fontSize: 13, fontWeight: '700', color: '#6B7280', letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' },
  resultRow:          { padding: 12, borderRadius: 10, marginBottom: 6 },
  resultCorrect:      { backgroundColor: '#F0FBF4' },
  resultPass:         { backgroundColor: '#F9FAFB' },
  resultWord:         { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },

  nextTurnBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#1B3D2F', borderRadius: 16, paddingVertical: 16, marginTop: 8 },
  nextTurnText:   { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  playAgainBtn:   { backgroundColor: '#1B3D2F', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  playAgainText:  { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  backToGamesBtn: { alignItems: 'center', paddingVertical: 14 },
  backToGamesText:{ fontSize: 14, color: '#6B7280', fontWeight: '500' },
});

// ─── Modal styles ─────────────────────────────────────────────────────────────
const ms = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 20, paddingBottom: 36,
    minHeight: '78%',
  },
  closeBtn: {
    alignSelf: 'flex-end', marginRight: 20, marginBottom: 4,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  carousel: { flexGrow: 0 },
  slidePage: {
    width: SCREEN_WIDTH, paddingHorizontal: 20,
    alignItems: 'center', paddingTop: 8, paddingBottom: 4,
  },
  stepImage: {
    width: SCREEN_WIDTH - 40,
    height: (SCREEN_WIDTH - 40) * 1.1,
  },

  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 20, marginBottom: 20 },
  dot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E5E7EB' },
  dotActive: { width: 22, height: 8, borderRadius: 4, backgroundColor: '#1B3D2F' },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 24 },
  skipBtn:  { paddingHorizontal: 16, paddingVertical: 14 },
  skipText: { fontSize: 15, fontWeight: '600', color: '#9CA3AF' },
  backBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, paddingVertical: 14 },
  backText: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  nextBtn:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, paddingVertical: 15, backgroundColor: '#1B3D2F' },
  nextText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
});
