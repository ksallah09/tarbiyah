import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { saveModule } from '../utils/modules';

const API_URL = 'https://tarbiyah-production.up.railway.app';

const DHIKR = [
  { arabic: 'أَسْتَغْفِرُ اللّٰهَ', latin: 'Astaghfirullah', meaning: 'I seek forgiveness from Allah' },
];

const LESSON_COLORS = {
  spiritual: { bg: ['#1B3D2F', '#2E5E45'], icon: 'moon',        label: 'Spiritual' },
  science:   { bg: ['#7A3A0A', '#C47020'], icon: 'book-outline', label: 'Research'  },
  action:    { bg: ['#1A2744', '#2D4278'], icon: 'flash',        label: 'Action'    },
};


export default function ModuleDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { topic, isNew, module: savedModule } = route.params;

  const [generating, setGenerating] = useState(isNew);
  const [error, setError]           = useState(null);
  const [module, setModule]         = useState(savedModule ?? null);
  // lessonAudios: lessonId → URL (populated once background generation completes)
  const [lessonAudios, setLessonAudios] = useState(() => {
    const map = {};
    savedModule?.lessons?.forEach(l => { if (l.audioUrl) map[l.id] = l.audioUrl; });
    return map;
  });
  const audiosLoadingRef = useRef(false);

  // ── Tasbih ────────────────────────────────────────────────────────────────────
  const [tasbiCount, setTasbiCount]   = useState(0);
  const beadPulseScale   = useRef(new Animated.Value(1)).current;
  const beadPulseOpacity = useRef(new Animated.Value(0)).current;

  const dhikrIdx   = 0;
  const displayNum = tasbiCount;

  function handleTasbiTap() {
    const next = tasbiCount + 1;
    setTasbiCount(next);
    // Stronger haptic every 100 taps
    if (next % 100 === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    // Pulse ring
    beadPulseScale.setValue(1);
    beadPulseOpacity.setValue(0.55);
    Animated.parallel([
      Animated.timing(beadPulseScale,   { toValue: 1.9, duration: 500, useNativeDriver: true }),
      Animated.timing(beadPulseOpacity, { toValue: 0,   duration: 500, useNativeDriver: true }),
    ]).start();
  }

  const scrollRef = useRef(null);
  const abortRef  = useRef(null);

  useEffect(() => {
    if (!isNew) return;
    generateModule();
  }, []);

  async function generateModule() {
    setGenerating(true);
    setError(null);
    abortRef.current = new AbortController();
    try {
      const profileRaw = await AsyncStorage.getItem('tarbiyah_profile');
      const profile = profileRaw ? JSON.parse(profileRaw) : {};
      const focusRaw = await AsyncStorage.getItem('tarbiyah_focus_areas');
      const focusAreas = focusRaw ? JSON.parse(focusRaw) : [];

      const res = await fetch(`${API_URL}/learn/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          childrenAges: profile.childrenAges ?? null,
          focusAreas,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Server error ${res.status}`);
      }

      const mod = await res.json();
      setModule(mod);
      await saveModule(mod);

      // Mark loading so the useEffect below doesn't double-trigger
      audiosLoadingRef.current = true;

      // Wait for first lesson narration before dismissing tasbih screen
      const firstLesson = mod.lessons?.[0];
      if (firstLesson) {
        try {
          const audioRes = await fetch(`${API_URL}/learn/audio/lesson`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ moduleId: mod.id, lesson: firstLesson }),
          });
          if (audioRes.ok) {
            const { url } = await audioRes.json();
            if (url) setLessonAudios(prev => ({ ...prev, [firstLesson.id]: url }));
          }
        } catch { /* silent — lesson is still readable */ }
      }

      // Tasbih screen dismissed — generate remaining lessons in background
      setGenerating(false);
      prefetchLessonAudios(mod, 1);

    } catch (err) {
      if (err.name === 'AbortError') return;
      setError(err.message ?? 'Something went wrong. Please try again.');
      setGenerating(false);
    }
  }

  function cancelGeneration() {
    abortRef.current?.abort();
    navigation.goBack();
  }

  // For saved modules reopened from the list — kick off any missing audio
  useEffect(() => {
    if (!module || isNew) return;
    const allDone = module.lessons.every(l => lessonAudios[l.id]);
    if (allDone || audiosLoadingRef.current) return;
    audiosLoadingRef.current = true;
    prefetchLessonAudios(module, 0);
  }, [module?.id]);

  async function prefetchLessonAudios(mod, startIndex = 0) {
    const audioMap = {};
    for (let i = startIndex; i < mod.lessons.length; i++) {
      const lesson = mod.lessons[i];
      try {
        const res = await fetch(`${API_URL}/learn/audio/lesson`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ moduleId: mod.id, lesson }),
        });
        if (!res.ok) continue;
        const { url } = await res.json();
        if (!url) continue;
        audioMap[lesson.id] = url;
        setLessonAudios(prev => ({ ...prev, [lesson.id]: url }));
      } catch {
        // Silent fail — lesson remains readable without audio
      }
    }
    const updated = {
      ...mod,
      lessons: mod.lessons.map(l => ({ ...l, audioUrl: audioMap[l.id] ?? l.audioUrl })),
    };
    setModule(updated);
    await saveModule(updated);
    audiosLoadingRef.current = false;
  }

  const completedCount = module?.lessons?.filter(l => l.completed).length ?? 0;
  const moduleProgress = module ? completedCount / module.totalLessons : 0;

  function toggleLesson(id) {
    setModule(prev => {
      const updated = {
        ...prev,
        lessons: prev.lessons.map(l =>
          l.id === id ? { ...l, completed: !l.completed } : l
        ),
      };
      updated.completedLessons = updated.lessons.filter(l => l.completed).length;
      saveModule(updated);
      return updated;
    });
  }

  return (
    <>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe} edges={[]}>

        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {generating ? '' : 'Your Module'}
          </Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>

          {/* ── Generating state — Tasbih ── */}
          {generating && (
            <LinearGradient colors={['#0D2419', '#1B3D2F', '#2A5240']} style={styles.tasbiScreen}>

              {/* Top: preparing indicator */}
              <View style={styles.tasbiTop}>
                <View style={styles.tasbiIndicator}>
                  <ActivityIndicator size="small" color="rgba(255,255,255,0.45)" />
                  <Text style={styles.tasbiPreparingText}>Preparing your module…</Text>
                </View>
                <Text style={styles.tasbiMessage}>
                  Your module is being prepared. This usually takes a few minutes — a perfect time for dhikr.
                </Text>
                <Text style={styles.tasbiHint}>Tap the counter to begin</Text>
              </View>

              {/* Center: dhikr + bead */}
              <View style={styles.tasbiCenter}>
                <Text style={styles.tasbiArabic}>{DHIKR[dhikrIdx].arabic}</Text>
                <Text style={styles.tasbiLatin}>{DHIKR[dhikrIdx].latin}</Text>
                <Text style={styles.tasbiMeaning}>{DHIKR[dhikrIdx].meaning}</Text>

                {/* Bead */}
                <TouchableOpacity
                  style={styles.beadContainer}
                  onPress={handleTasbiTap}
                  activeOpacity={0.85}
                >
                  <Animated.View style={[
                    styles.beadRing,
                    { transform: [{ scale: beadPulseScale }], opacity: beadPulseOpacity },
                  ]} />
                  <View style={styles.bead}>
                    <Text style={styles.beadCount}>{displayNum}</Text>
                  </View>
                </TouchableOpacity>


                {tasbiCount > 0 && (
                  <Text style={styles.tasbiTotal}>{tasbiCount} total</Text>
                )}
              </View>

              {/* Bottom: cancel */}
              <View style={styles.tasbiBottom}>
                <TouchableOpacity style={styles.cancelGenerationBtn} onPress={cancelGeneration} activeOpacity={0.7}>
                  <Text style={styles.cancelGenerationText}>Cancel</Text>
                </TouchableOpacity>
              </View>

            </LinearGradient>
          )}

          {/* ── Error state ── */}
          {!generating && error && (
            <View style={styles.sheet}>
              <View style={styles.errorWrap}>
                <LinearGradient
                  colors={['#3D1B1B', '#5E2E2E']}
                  style={styles.errorIcon}
                >
                  <Ionicons name="alert-circle" size={28} color="#E87A7A" />
                </LinearGradient>
                <Text style={styles.errorTitle}>Couldn't Generate Module</Text>
                <Text style={styles.errorBody}>{error}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={generateModule}>
                  <Ionicons name="refresh" size={16} color="#FFFFFF" />
                  <Text style={styles.retryBtnText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Module loaded ── */}
          {!generating && module && (
            <>
              {/* ── Module hero ── */}
              <LinearGradient
                colors={['#1B3D2F', '#2A5240']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={[styles.moduleHero, { paddingBottom: 32 }]}
              >
                <View style={styles.moduleTopicChip}>
                  <Ionicons name="sparkles" size={11} color="#D4871A" />
                  <Text style={styles.moduleTopicText}>Personalized Module</Text>
                </View>
                <Text style={styles.moduleTitle}>{module.title}</Text>
                <Text style={styles.moduleTopic}>{module.moduleGoal}</Text>

                {/* Progress bar */}
                <View style={styles.progressWrap}>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${moduleProgress * 100}%` }]} />
                  </View>
                  <Text style={styles.progressLabel}>
                    {completedCount}/{module.totalLessons} lessons complete
                  </Text>
                </View>
              </LinearGradient>

              {/* ── Content sheet ── */}
              <View style={styles.sheet}>
                <View style={styles.contentPad}>

                  {/* ── About This Module ── */}
                  {(!!module.issueSummary || !!module.parentReframe) && (
                    <View style={[styles.summarySection, { marginTop: 4 }]}>
                      <Text style={styles.summarySectionTitle}>ABOUT THIS MODULE</Text>
                      {!!module.issueSummary && (
                        <Text style={styles.summarySectionBody}>{module.issueSummary}</Text>
                      )}
                      {!!module.parentReframe && (
                        <View style={[styles.summaryBlock, styles.summaryBlockGreen]}>
                          <View style={styles.summaryBlockHeader}>
                            <Ionicons name="heart" size={13} color="#1B3D2F" />
                            <Text style={styles.summaryBlockLabel}>Keep in Mind</Text>
                          </View>
                          <Text style={styles.summaryBlockBody}>{module.parentReframe}</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Lessons */}
                  <View style={[styles.sectionTitleWrap, { marginTop: 24 }]}>
                    <Text style={styles.sectionTitle}>LESSONS</Text>
                  </View>

                  {module.lessons.map((lesson, i) => {
                    const cfg = LESSON_COLORS[lesson.type];
                    const isLocked = i > 0 && !module.lessons[i - 1].completed;

                    return (
                      <TouchableOpacity
                        key={lesson.id}
                        style={[styles.lessonCard, lesson.completed && styles.lessonCardDone]}
                        activeOpacity={isLocked ? 1 : 0.85}
                        onPress={() => {
                          if (isLocked) return;
                          navigation.navigate('LessonReader', {
                            lesson,
                            lessonIndex: i,
                            totalLessons: module.lessons.length,
                            audioUrl: lessonAudios[lesson.id] ?? null,
                            gradientColors: cfg.bg,
                            icon: cfg.icon,
                            typeLabel: cfg.label,
                            onComplete: () => toggleLesson(lesson.id),
                          });
                        }}
                      >
                        {/* Lesson row */}
                        <View style={styles.lessonRow}>
                          <LinearGradient
                            colors={lesson.completed ? ['#D1D5DB', '#9CA3AF'] : cfg.bg}
                            style={styles.lessonNum}
                          >
                            {lesson.completed
                              ? <Ionicons name="checkmark" size={14} color="#FFF" />
                              : isLocked
                                ? <Ionicons name="lock-closed" size={12} color="rgba(255,255,255,0.7)" />
                                : <Text style={styles.lessonNumText}>{i + 1}</Text>
                            }
                          </LinearGradient>

                          <View style={styles.lessonContent}>
                            <View style={styles.lessonMeta}>
                              <View style={[styles.lessonTypeChip, { backgroundColor: lesson.completed ? '#F3F4F6' : `${cfg.bg[0]}18` }]}>
                                <Ionicons name={cfg.icon} size={10} color={lesson.completed ? '#9CA3AF' : cfg.bg[0]} />
                                <Text style={[styles.lessonTypeText, { color: lesson.completed ? '#9CA3AF' : cfg.bg[0] }]}>
                                  {cfg.label}
                                </Text>
                              </View>
                              <Text style={styles.lessonDuration}>
                                <Ionicons name="time-outline" size={10} color="#9CA3AF" /> {lesson.duration}
                              </Text>
                            </View>
                            <Text style={[styles.lessonTitle, isLocked && styles.lessonTitleLocked]}>
                              {lesson.title}
                            </Text>
                          </View>

                          {!isLocked && (
                            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                          )}
                        </View>

                      </TouchableOpacity>
                    );
                  })}

                  {/* Completed banner */}
                  {completedCount === module.totalLessons && (
                    <LinearGradient
                      colors={['#1B3D2F', '#2E5E45']}
                      style={styles.completedBanner}
                    >
                      <Ionicons name="checkmark-circle" size={36} color="#D4871A" style={{ marginBottom: 10 }} />
                      <Text style={styles.completedTitle}>Module Complete!</Text>
                      <Text style={styles.completedBody}>
                        Masha'Allah — you've completed all lessons in this module.
                      </Text>
                    </LinearGradient>
                  )}

                  {/* ── Weekly Action Plan ── */}
                  {(module.weeklyPriorities?.length > 0 || module.weeklyHabits?.length > 0 ||
                    !!module.behaviorToReduce || !!module.relationshipAction) && (
                    <View style={styles.summarySection}>
                      <Text style={styles.summarySectionTitle}>YOUR ACTION PLAN</Text>

                      {module.weeklyPriorities?.length > 0 && (
                        <View style={styles.summaryBlock}>
                          <View style={styles.summaryBlockHeader}>
                            <Ionicons name="flag-outline" size={13} color="#1B3D2F" />
                            <Text style={styles.summaryBlockLabel}>This Week's Priorities</Text>
                          </View>
                          {module.weeklyPriorities.map((p, i) => (
                            <View key={i} style={styles.bulletRow}>
                              <View style={styles.bulletDot} />
                              <Text style={styles.bulletText}>{p}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {module.weeklyHabits?.length > 0 && (
                        <View style={styles.summaryBlock}>
                          <View style={styles.summaryBlockHeader}>
                            <Ionicons name="repeat-outline" size={13} color="#1B3D2F" />
                            <Text style={styles.summaryBlockLabel}>Daily Habits to Build</Text>
                          </View>
                          {module.weeklyHabits.map((h, i) => (
                            <View key={i} style={styles.bulletRow}>
                              <View style={styles.bulletDot} />
                              <Text style={styles.bulletText}>{h}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {!!module.behaviorToReduce && (
                        <View style={[styles.summaryBlock, styles.summaryBlockAmber]}>
                          <View style={styles.summaryBlockHeader}>
                            <Ionicons name="trending-down-outline" size={13} color="#7A3A0A" />
                            <Text style={[styles.summaryBlockLabel, { color: '#7A3A0A' }]}>Behaviour to Reduce</Text>
                          </View>
                          <Text style={[styles.summaryBlockBody, { color: '#5C2D07' }]}>{module.behaviorToReduce}</Text>
                        </View>
                      )}

                      {!!module.relationshipAction && (
                        <View style={styles.summaryBlock}>
                          <View style={styles.summaryBlockHeader}>
                            <Ionicons name="people-outline" size={13} color="#1B3D2F" />
                            <Text style={styles.summaryBlockLabel}>Relationship Action</Text>
                          </View>
                          <Text style={styles.summaryBlockBody}>{module.relationshipAction}</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* ── Spiritual Practices ── */}
                  {!!module.spiritualPractices && (
                    <View style={styles.summarySection}>
                      <Text style={styles.summarySectionTitle}>SPIRITUAL PRACTICES</Text>
                      <View style={[styles.summaryBlock, styles.summaryBlockGreen]}>
                        <View style={styles.summaryBlockHeader}>
                          <Ionicons name="moon" size={13} color="#1B3D2F" />
                          <Text style={styles.summaryBlockLabel}>Duas & Practices</Text>
                        </View>
                        <Text style={styles.summaryBlockBody}>{module.spiritualPractices}</Text>
                      </View>
                    </View>
                  )}

                  {/* ── Signs of Progress ── */}
                  {module.progressSigns?.length > 0 && (
                    <View style={styles.summarySection}>
                      <Text style={styles.summarySectionTitle}>SIGNS OF PROGRESS</Text>
                      <View style={styles.summaryBlock}>
                        <Text style={styles.summarySubtitle}>Watch for these gradual changes:</Text>
                        {module.progressSigns.map((sign, i) => (
                          <View key={i} style={styles.bulletRow}>
                            <Ionicons name="checkmark-circle-outline" size={13} color="#2E7D62" style={{ marginTop: 2 }} />
                            <Text style={[styles.bulletText, { color: '#374151' }]}>{sign}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* ── When to Seek Help ── */}
                  {!!module.whenToSeekHelp && (
                    <View style={styles.summarySection}>
                      <View style={[styles.summaryBlock, styles.summaryBlockBlue]}>
                        <View style={styles.summaryBlockHeader}>
                          <Ionicons name="information-circle-outline" size={13} color="#1A2744" />
                          <Text style={[styles.summaryBlockLabel, { color: '#1A2744' }]}>When to Seek Help</Text>
                        </View>
                        <Text style={[styles.summaryBlockBody, { color: '#1A2744' }]}>{module.whenToSeekHelp}</Text>
                      </View>
                    </View>
                  )}

                  {/* ── Final Encouragement ── */}
                  {!!module.finalEncouragement && (
                    <LinearGradient
                      colors={['#1B3D2F', '#2E5E45']}
                      style={styles.encouragementCard}
                    >
                      <Ionicons name="sparkles" size={18} color="#D4871A" style={{ marginBottom: 10 }} />
                      <Text style={styles.encouragementText}>{module.finalEncouragement}</Text>
                    </LinearGradient>
                  )}

                  <View style={{ height: 32 }} />
                </View>
              </View>
            </>
          )}

        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1B3D2F' },

  // ── Header ──
  header: {
    backgroundColor: '#1B3D2F',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },

  // ── Sheet ──
  sheet: {
    flexGrow: 1,
    backgroundColor: '#F5F6F8',
  },
  contentPad: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 36 },

  // ── Tasbih generating screen ──
  tasbiScreen: {
    flex: 1,
  },
  tasbiTop: {
    alignItems: 'center',
    paddingTop: 28,
  },
  tasbiIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
  },
  tasbiPreparingText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '500',
  },
  tasbiMessage: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 20,
    paddingHorizontal: 28,
  },
  tasbiHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.28)',
    marginTop: 8,
    letterSpacing: 0.3,
  },
  tasbiCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tasbiArabic: {
    fontSize: 34,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 6,
  },
  tasbiLatin: {
    fontSize: 17,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  tasbiMeaning: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    marginBottom: 36,
    letterSpacing: 0.3,
  },
  beadContainer: {
    width: 160, height: 160,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 28,
  },
  beadRing: {
    position: 'absolute',
    width: 160, height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  bead: {
    width: 140, height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  beadCount: {
    fontSize: 56,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -2,
  },
  tasbiDots: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  tasbiDot: {
    width: 7, height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  tasbiDotActive: {
    width: 22,
    backgroundColor: '#FFFFFF',
  },
  tasbiTotal: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
    fontWeight: '500',
  },
  tasbiBottom: {
    alignItems: 'center',
    paddingBottom: 32,
  },
  cancelGenerationBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  cancelGenerationText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.45)',
  },

  // ── Module hero ──
  moduleHero: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  moduleTopicChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 12,
  },
  moduleTopicText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D4871A',
    letterSpacing: 0.5,
  },
  moduleTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  moduleTopic: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 19,
    marginBottom: 20,
  },
  progressWrap: { gap: 8 },
  progressTrack: {
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 3,
  },
  progressFill: {
    height: 5,
    backgroundColor: '#D4871A',
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
  },

  // ── Section title ──
  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1B3D2F',
    letterSpacing: 0.8,
  },

  // ── Lesson cards ──
  lessonCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  lessonCardDone: {
    opacity: 0.75,
  },
  lessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  lessonNum: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  lessonNumText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  lessonContent: { flex: 1 },
  lessonMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  lessonTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  lessonTypeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  lessonDuration: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  lessonTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    lineHeight: 20,
  },
  lessonTitleLocked: { color: '#9CA3AF' },

  // ── Expanded lesson ──
  lessonExpanded: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  lessonExpandedDivider: {
    height: 1,
    backgroundColor: '#F0F1F3',
    marginBottom: 14,
  },
  lessonPlaceholder: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#F5F6F8',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  lessonPlaceholderText: {
    flex: 1,
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 19,
  },
  markDoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#1B3D2F',
    borderRadius: 12,
    paddingVertical: 12,
  },
  markUndoneBtn: {
    backgroundColor: '#F3F4F6',
  },
  markDoneBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  markUndoneText: { color: '#6B7280' },

  // ── Error state ──
  errorWrap: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 48,
    paddingBottom: 40,
  },
  errorIcon: {
    width: 72, height: 72, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1B1B1B',
    marginBottom: 10,
    textAlign: 'center',
  },
  errorBody: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1B3D2F',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  retryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // ── Expanded lesson content ──
  lessonObjective: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 14,
    fontStyle: 'italic',
  },
  lessonSection: {
    backgroundColor: '#F5F6F8',
    borderRadius: 12,
    padding: 13,
    marginBottom: 10,
  },
  lessonSectionGreen: {
    backgroundColor: '#EDF7F2',
  },
  lessonSectionAmber: {
    backgroundColor: '#FEF3E2',
  },
  lessonSectionBlue: {
    backgroundColor: '#EEF2FF',
  },
  lessonSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  lessonSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1B3D2F',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  lessonSectionBody: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  bulletDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: '#1B3D2F',
    marginTop: 7,
    flexShrink: 0,
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
  },
  speechBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#1B3D2F',
    padding: 10,
    marginBottom: 7,
  },
  speechText: {
    fontSize: 13,
    color: '#1C1C1E',
    lineHeight: 19,
    fontStyle: 'italic',
  },
  miniTakeaway: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF3E2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  miniTakeawayText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
    lineHeight: 19,
  },

  // ── Completed banner ──
  completedBanner: {
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  completedTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  completedBody: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 21,
  },

  // ── Module summary sections ──
  summarySection: {
    marginTop: 24,
  },
  summarySectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1B3D2F',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  summarySectionBody: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
    marginBottom: 12,
  },
  summarySubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  summaryBlock: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  summaryBlockGreen: {
    backgroundColor: '#EDF7F2',
  },
  summaryBlockAmber: {
    backgroundColor: '#FEF3E2',
  },
  summaryBlockBlue: {
    backgroundColor: '#EEF2FF',
  },
  summaryBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  summaryBlockLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1B3D2F',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  summaryBlockBody: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
  },
  encouragementCard: {
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    marginTop: 24,
  },
  encouragementText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 22,
    fontStyle: 'italic',
  },

  // ── Lesson audio ──
  lessonListenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.04)',
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  lessonListenLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
  lessonAudioLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  lessonAudioLoadingText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },

  // ── Audio overview ──
  audioGenerateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#1B3D2F',
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  audioGenerateBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  audioHint: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 18,
    paddingBottom: 8,
  },
  audioErrorText: {
    fontSize: 12,
    color: '#EF4444',
    textAlign: 'center',
    marginTop: 8,
  },
});
