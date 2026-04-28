import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Audio } from 'expo-av';

const SPEEDS = [1.0, 1.5, 2.0];
const API_URL = 'https://tarbiyah-production.up.railway.app';

export default function LessonReaderScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const {
    lesson, lessonIndex, totalLessons,
    audioUrl: initialAudioUrl, moduleId, voice,
    gradientColors, icon, typeLabel,
    onComplete,
  } = route.params;

  const [audioUrl, setAudioUrl] = useState(initialAudioUrl ?? null);

  const accentColor = gradientColors[0];

  // ── Audio ────────────────────────────────────────────────────────────────────
  const soundRef      = useRef(null);
  const seekBarWidth  = useRef(1);
  const [audioStatus, setAudioStatus]   = useState(null);
  const [audioLoading, setAudioLoading] = useState(!!audioUrl);
  const [audioError,   setAudioError]   = useState(false);
  const [speedIndex,   setSpeedIndex]   = useState(0);
  const pollRef = useRef(null);

  // Poll for audio URL if it wasn't ready when the screen opened
  useEffect(() => {
    if (audioUrl || !moduleId) return;
    let attempts = 0;
    const MAX_ATTEMPTS = 10;

    async function tryFetch() {
      try {
        const res = await fetch(`${API_URL}/learn/audio/lesson`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ moduleId, lesson, voice }),
        });
        if (res.ok) {
          const { url } = await res.json();
          if (url) { setAudioUrl(url); return; }
        }
      } catch {}
      attempts++;
      if (attempts < MAX_ATTEMPTS) {
        pollRef.current = setTimeout(tryFetch, 5000);
      }
    }

    pollRef.current = setTimeout(tryFetch, 3000);
    return () => clearTimeout(pollRef.current);
  }, []);

  // ── Compact hero on scroll ────────────────────────────────────────────────────
  const compactAnim = useRef(new Animated.Value(0)).current;
  const isCompactRef = useRef(false);

  function handleScroll(e) {
    const y = e.nativeEvent.contentOffset.y;
    const shouldCompact = y > 20;
    if (shouldCompact !== isCompactRef.current) {
      isCompactRef.current = shouldCompact;
      Animated.timing(compactAnim, {
        toValue: shouldCompact ? 1 : 0,
        duration: 250,
        useNativeDriver: false,
      }).start();
    }
  }

  const navMarginBottom   = compactAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 8] });
  const metaOpacity       = compactAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const metaMaxHeight     = compactAnim.interpolate({ inputRange: [0, 1], outputRange: [80, 0] });
  const titleOpacity      = compactAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const titleMaxHeight    = compactAnim.interpolate({ inputRange: [0, 1], outputRange: [120, 0] });
  const seekMarginBottom  = compactAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 10] });
  const heroPaddingBottom = compactAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 14] });

  const isPlaying = audioStatus?.isPlaying ?? false;
  const duration  = audioStatus?.durationMillis ?? 0;
  const position  = audioStatus?.positionMillis ?? 0;
  const progress  = duration > 0 ? position / duration : 0;
  const finished  = duration > 0 && position >= duration - 100;

  useEffect(() => {
    if (!audioUrl) return;
    let mounted = true;

    async function load() {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
        });
        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay: false, progressUpdateIntervalMillis: 250 },
          s => { if (mounted) setAudioStatus(s); }
        );
        soundRef.current = sound;
        if (mounted) setAudioLoading(false);
      } catch {
        if (mounted) { setAudioError(true); setAudioLoading(false); }
      }
    }

    load();
    return () => {
      mounted = false;
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, [audioUrl]);

  async function togglePlay() {
    if (!soundRef.current) return;
    if (isPlaying) {
      await soundRef.current.pauseAsync();
    } else {
      if (finished) await soundRef.current.setPositionAsync(0);
      await soundRef.current.playAsync();
    }
  }

  async function skipSeconds(sec) {
    if (!soundRef.current || !duration) return;
    await soundRef.current.setPositionAsync(
      Math.max(0, Math.min(duration, position + sec * 1000))
    );
  }

  async function cycleSpeed() {
    const next = (speedIndex + 1) % SPEEDS.length;
    setSpeedIndex(next);
    await soundRef.current?.setRateAsync(SPEEDS[next], true);
  }

  function handleSeek(e) {
    if (!duration || seekBarWidth.current <= 1) return;
    const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / seekBarWidth.current));
    soundRef.current?.setPositionAsync(ratio * duration);
  }

  function fmt(ms) {
    if (!ms) return '0:00';
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  }


  // ── Complete ──────────────────────────────────────────────────────────────────
  function handleMarkComplete() {
    if (!lesson.completed) onComplete?.();
    navigation.goBack();
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <>
      <StatusBar style="light" />
      <View style={styles.root}>

        {/* ── Gradient hero ── */}
        <LinearGradient colors={gradientColors} style={[styles.hero, { paddingTop: insets.top }]}>
          <Animated.View style={{ paddingBottom: heroPaddingBottom }}>

          {/* Nav row */}
          <Animated.View style={[styles.navRow, { marginBottom: navMarginBottom }]}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
              <Ionicons name="chevron-down" size={24} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>

            {lesson.completed ? (
              <View style={styles.completedBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#4ADE80" />
                <Text style={styles.completedBadgeText}>Completed</Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.doneBtn} onPress={handleMarkComplete} activeOpacity={0.85}>
                <Ionicons name="checkmark" size={13} color={accentColor} />
                <Text style={[styles.doneBtnText, { color: accentColor }]}>Mark Done</Text>
              </TouchableOpacity>
            )}
          </Animated.View>

          {/* Lesson identity */}
          <Animated.View style={{ opacity: metaOpacity, maxHeight: metaMaxHeight, overflow: 'hidden' }}>
            <Text style={styles.lessonNum}>LESSON {lessonIndex + 1} OF {totalLessons}</Text>
            <View style={styles.typePill}>
              <Ionicons name={icon} size={11} color="rgba(255,255,255,0.9)" />
              <Text style={styles.typePillText}>{typeLabel}</Text>
            </View>
          </Animated.View>
          <Animated.View style={{ opacity: titleOpacity, maxHeight: titleMaxHeight, overflow: 'hidden' }}>
            <Text style={styles.lessonTitle} numberOfLines={0}>{lesson.title}</Text>
          </Animated.View>

          {/* Seek bar */}
          <Animated.View
            style={[styles.seekOuter, { marginBottom: seekMarginBottom }]}
            onLayout={e => { seekBarWidth.current = e.nativeEvent.layout.width; }}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={styles.seekTouchArea}
              onPress={handleSeek}
            >
              <View style={styles.seekTrack}>
                <View style={[styles.seekFill, { width: `${progress * 100}%` }]} />
              </View>
              {duration > 0 && (
                <View style={[styles.seekThumb, { left: `${Math.min(97, progress * 100)}%` }]} />
              )}
            </TouchableOpacity>
            <View style={styles.timeRow}>
              <Text style={styles.timeText}>{fmt(position)}</Text>
              <Text style={styles.timeText}>{fmt(duration)}</Text>
            </View>
          </Animated.View>

          {/* Playback controls */}
          <View style={styles.controls}>
            <TouchableOpacity onPress={() => skipSeconds(-15)} style={styles.skipBtn} activeOpacity={0.7}>
              <Ionicons name="play-back-outline" size={22} color="rgba(255,255,255,0.75)" />
              <Text style={styles.skipLabel}>15</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.playBtn}
              onPress={togglePlay}
              activeOpacity={0.88}
              disabled={audioLoading || audioError || !audioUrl}
            >
              {audioLoading ? (
                <ActivityIndicator color={accentColor} size="large" />
              ) : audioError || !audioUrl ? (
                <Ionicons name="musical-notes-outline" size={26} color="rgba(0,0,0,0.25)" />
              ) : (
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={30}
                  color={accentColor}
                  style={!isPlaying && { marginLeft: 4 }}
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => skipSeconds(15)} style={styles.skipBtn} activeOpacity={0.7}>
              <Ionicons name="play-forward-outline" size={22} color="rgba(255,255,255,0.75)" />
              <Text style={styles.skipLabel}>15</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.speedRow}>
            <TouchableOpacity onPress={cycleSpeed} style={styles.speedChip} activeOpacity={0.7}>
              <Text style={styles.speedText}>{SPEEDS[speedIndex]}×</Text>
            </TouchableOpacity>
          </View>

          </Animated.View>
        </LinearGradient>

        {/* ── White bottom ── */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {!audioUrl && !audioError && (
            <View style={styles.audioNotReady}>
              <ActivityIndicator size="small" color="#9CA3AF" />
              <Text style={styles.audioNotReadyText}>Preparing narration…</Text>
            </View>
          )}

          {/* ── Read Along section title ── */}
          <View style={styles.readAlongHeader}>
            <Ionicons name="book-outline" size={14} color="#6B7280" />
            <Text style={styles.readAlongTitle}>Read Along</Text>
          </View>

          <View style={styles.readContent}>

              {!!lesson.objective && (
                <Text style={styles.objective}>
                  {(() => {
                    const o = lesson.objective.replace(/^To\s+/i, '');
                    return 'Your goal is to ' + o.charAt(0).toLowerCase() + o.slice(1);
                  })()}
                </Text>
              )}

              {!!lesson.whyItMatters && (
                <View style={styles.section}>
                  <View style={styles.sectionHead}>
                    <Ionicons name="heart-outline" size={13} color="#1B3D2F" />
                    <Text style={styles.sectionLabel}>Why It Matters</Text>
                  </View>
                  <Text style={styles.sectionBody}>{lesson.whyItMatters}</Text>
                </View>
              )}

              {!!lesson.islamicGuidance && (
                <View style={[styles.section, styles.sectionGreen]}>
                  <View style={styles.sectionHead}>
                    <Ionicons name="moon" size={13} color="#1B3D2F" />
                    <Text style={styles.sectionLabel}>Islamic Guidance</Text>
                  </View>
                  <Text style={styles.sectionBody}>{lesson.islamicGuidance}</Text>
                </View>
              )}

              {!!lesson.researchInsight && (
                <View style={[styles.section, styles.sectionAmber]}>
                  <View style={styles.sectionHead}>
                    <Ionicons name="flask-outline" size={13} color="#7A3A0A" />
                    <Text style={[styles.sectionLabel, { color: '#7A3A0A' }]}>Research Insight</Text>
                  </View>
                  <Text style={[styles.sectionBody, { color: '#5C2D07' }]}>{lesson.researchInsight}</Text>
                </View>
              )}

              {lesson.actionSteps?.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHead}>
                    <Ionicons name="list-outline" size={13} color="#1B3D2F" />
                    <Text style={styles.sectionLabel}>Action Steps</Text>
                  </View>
                  {lesson.actionSteps.map((step, i) => (
                    <View key={i} style={styles.bullet}>
                      <View style={styles.bulletDot} />
                      <Text style={styles.bulletText}>{step}</Text>
                    </View>
                  ))}
                </View>
              )}

              {lesson.whatToSay?.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHead}>
                    <Ionicons name="chatbubble-ellipses-outline" size={13} color="#1B3D2F" />
                    <Text style={styles.sectionLabel}>What to Say</Text>
                  </View>
                  {lesson.whatToSay.map((phrase, i) => (
                    <View key={i} style={styles.speechBubble}>
                      <Text style={styles.speechText}>{phrase}</Text>
                    </View>
                  ))}
                </View>
              )}

              {lesson.mistakesToAvoid?.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHead}>
                    <Ionicons name="close-circle-outline" size={13} color="#B45309" />
                    <Text style={[styles.sectionLabel, { color: '#B45309' }]}>Mistakes to Avoid</Text>
                  </View>
                  {lesson.mistakesToAvoid.map((m, i) => (
                    <View key={i} style={styles.bullet}>
                      <View style={[styles.bulletDot, { backgroundColor: '#B45309' }]} />
                      <Text style={[styles.bulletText, { color: '#78350F' }]}>{m}</Text>
                    </View>
                  ))}
                </View>
              )}

              {!!lesson.reflectionQuestion && (
                <View style={[styles.section, styles.sectionBlue]}>
                  <View style={styles.sectionHead}>
                    <Ionicons name="help-circle-outline" size={13} color="#1A2744" />
                    <Text style={[styles.sectionLabel, { color: '#1A2744' }]}>Reflect</Text>
                  </View>
                  <Text style={[styles.sectionBody, { color: '#1A2744', fontStyle: 'italic' }]}>
                    {lesson.reflectionQuestion}
                  </Text>
                </View>
              )}

              {!!lesson.miniTakeaway && (
                <View style={styles.takeaway}>
                  <Ionicons name="sparkles" size={13} color="#D4871A" />
                  <Text style={styles.takeawayText}>{lesson.miniTakeaway}</Text>
                </View>
              )}

            </View>
        </ScrollView>

      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F5F6F8',
  },

  // ── Hero ──────────────────────────────────────────────────────────────────────
  hero: {
    paddingHorizontal: 24,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  backBtn: {
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  doneBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20,
  },
  doneBtnText: {
    fontSize: 13, fontWeight: '600',
  },
  completedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20,
  },
  completedBadgeText: {
    fontSize: 12, fontWeight: '600', color: '#4ADE80',
  },

  lessonNum: {
    fontSize: 11, fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1.5, marginBottom: 10,
  },
  typePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, marginBottom: 12,
  },
  typePillText: {
    fontSize: 11, fontWeight: '600',
    color: 'rgba(255,255,255,0.9)', letterSpacing: 0.5,
  },
  lessonTitle: {
    fontSize: 26, fontWeight: '700',
    color: '#FFFFFF', lineHeight: 34,
    marginBottom: 28,
  },

  // ── Seek bar ──────────────────────────────────────────────────────────────────
  seekOuter: {
    gap: 8,
  },
  seekTouchArea: {
    height: 24,
    justifyContent: 'center',
    position: 'relative',
  },
  seekTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  seekFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  seekThumb: {
    position: 'absolute',
    top: '50%',
    marginTop: -5,
    marginLeft: -5,
    width: 11, height: 11,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },

  // ── Playback controls ─────────────────────────────────────────────────────────
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlsSide: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 36,
  },
  skipBtn: {
    alignItems: 'center',
    gap: 2,
  },
  skipLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
  },
  playBtn: {
    width: 68, height: 68,
    borderRadius: 34,
    backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },

  // ── Bottom section ────────────────────────────────────────────────────────────
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },

  speedRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  speedChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  speedText: {
    fontSize: 13, fontWeight: '700', color: '#FFFFFF',
  },
  readAlongHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 20,
    paddingTop: 20, paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EAECEF',
  },
  readAlongTitle: {
    fontSize: 11, fontWeight: '700',
    color: '#9CA3AF', letterSpacing: 1.4,
  },
  audioNotReady: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 4,
  },
  audioNotReadyText: {
    fontSize: 13, color: '#9CA3AF',
  },

  // ── Read Along content ────────────────────────────────────────────────────────
  readContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
  },
  objective: {
    fontSize: 15, fontWeight: '500', fontStyle: 'italic',
    color: '#374151', lineHeight: 24,
    marginBottom: 4,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14, padding: 16, gap: 8,
  },
  sectionGreen:  { backgroundColor: '#F0FAF4' },
  sectionAmber:  { backgroundColor: '#FEF3E7' },
  sectionBlue:   { backgroundColor: '#EEF2FB' },
  sectionHead: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  sectionLabel: {
    fontSize: 12, fontWeight: '700',
    color: '#1B3D2F', letterSpacing: 0.4,
  },
  sectionBody: {
    fontSize: 14, color: '#4B5563', lineHeight: 22,
  },
  bullet: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
  },
  bulletDot: {
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: '#9CA3AF',
    marginTop: 9, flexShrink: 0,
  },
  bulletText: {
    flex: 1, fontSize: 14, color: '#4B5563', lineHeight: 22,
  },
  speechBubble: {
    backgroundColor: 'rgba(27,61,47,0.06)',
    borderRadius: 10, padding: 12,
    borderLeftWidth: 3, borderLeftColor: '#1B3D2F',
  },
  speechText: {
    fontSize: 14, color: '#1B3D2F',
    fontStyle: 'italic', lineHeight: 21,
  },
  takeaway: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#FEF9EC',
    borderRadius: 12, padding: 14,
  },
  takeawayText: {
    flex: 1, fontSize: 13, color: '#92400E', lineHeight: 20, fontWeight: '500',
  },
});
