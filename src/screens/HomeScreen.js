import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import fallbackData from '../data/insights.json';
import { getWeekReadDays, isReadToday } from '../utils/readInsights';
import { saveGoalsForDate } from '../utils/goalHistory';
import TypewriterText from '../components/TypewriterText';
import { getDailyDua, getDailyAyah } from '../data/dailyIslamic';
import { refreshDailyNotification } from '../utils/notifications';
import { supabase } from '../utils/supabase';

const API_URL   = 'https://tarbiyah-production.up.railway.app';
const CACHE_KEY = 'tarbiyah_daily_cache';


function WeekRow({ days, color, todayColor }) {
  return (
    <View style={weekRowStyles.row}>
      {days.map((d, i) => (
        <View key={i} style={weekRowStyles.col}>
          <View style={[
            weekRowStyles.cir,
            d.completed && { backgroundColor: color },
            d.today && !d.completed && { backgroundColor: todayColor },
          ]}>
            {d.completed
              ? <Ionicons name="checkmark" size={14} color="#FFF" />
              : <Text style={[weekRowStyles.letter, d.today && { color, fontWeight: '700' }]}>{d.short}</Text>
            }
          </View>
        </View>
      ))}
    </View>
  );
}

const weekRowStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  col: { alignItems: 'center' },
  cir: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#F0F1F3',
    alignItems: 'center', justifyContent: 'center',
  },
  letter: { fontSize: 13, fontWeight: '600', color: '#9CA3AF' },
});

async function checkShouldAnimateGreeting() {
  const today = new Date().toDateString();
  const stored = await AsyncStorage.getItem('tarbiyah_greeting_date');
  if (stored !== today) {
    await AsyncStorage.setItem('tarbiyah_greeting_date', today);
    return true;
  }
  return false;
}

async function getProfileName() {
  try {
    const raw = await AsyncStorage.getItem('tarbiyah_profile');
    if (raw) {
      const profile = JSON.parse(raw);
      return profile.name || null;
    }
    const onboarding = await AsyncStorage.getItem('tarbiyah_onboarding_v1');
    if (onboarding) {
      const data = JSON.parse(onboarding);
      return data.name || null;
    }
  } catch {}
  return null;
}

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [dailyData, setDailyData]            = useState(null);
  const [loading, setLoading]                = useState(true);
  const [spirReadWeek,  setSpiritualReadWeek] = useState([]);
  const [sciReadWeek,   setScientificReadWeek]= useState([]);
  const [quranReadWeek, setQuranReadWeek]     = useState([]);
  const [name, setName]                      = useState('');
  const [animate, setAnimate]                = useState(false);
  const [ayahRead, setAyahRead]              = useState(false);

  const contentOpacity = useRef(new Animated.Value(0)).current;

  function revealContent() {
    Animated.timing(contentOpacity, {
      toValue: 1, duration: 500, useNativeDriver: true,
    }).start();
  }

  useFocusEffect(
    useCallback(() => {
      getWeekReadDays('spiritual').then(setSpiritualReadWeek);
      getWeekReadDays('scientific').then(setScientificReadWeek);
      getWeekReadDays('quran').then(setQuranReadWeek);
      isReadToday('quran', dailyAyah.reference).then(setAyahRead);

      // Load name + decide whether to animate greeting
      Promise.all([getProfileName(), checkShouldAnimateGreeting()])
        .then(([profileName, shouldAnimate]) => {
          setName(profileName || '');
          setAnimate(shouldAnimate);
          if (!shouldAnimate) revealContent();
        });

      // Load cache and only fetch from network if the cache is not from today.
      async function loadDaily() {
        const today = new Date().toISOString().split('T')[0];
        const raw = await AsyncStorage.getItem(CACHE_KEY).catch(() => null);

        if (raw) {
          try {
            const cached = JSON.parse(raw);
            setDailyData(cached);
            // Cache is from today — no need to hit the network again.
            if (cached?.date === today) {
              setLoading(false);
              return;
            }
          } catch {}
        }

        // Build the daily fetch URL — use authenticated /daily when logged in
        // so focus areas and delivery history are applied to insight selection.
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData?.session?.access_token ?? null;

          let res;
          if (token) {
            const focusRaw = await AsyncStorage.getItem('tarbiyah_focus_areas');
            const focusAreas = focusRaw ? JSON.parse(focusRaw) : [];
            const profileRaw = await AsyncStorage.getItem('tarbiyah_profile');
            const profile = profileRaw ? JSON.parse(profileRaw) : {};
            const childrenAges = profile.childrenAges ?? [];

            const query = new URLSearchParams();
            if (focusAreas.length) query.set('focusAreas', focusAreas.join(','));
            if (childrenAges.length) query.set('childrenAges', childrenAges.join(','));
            const params = query.toString() ? '?' + query.toString() : '';
            res = await fetch(`${API_URL}/daily${params}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
          } else {
            res = await fetch(`${API_URL}/daily/preview`);
          }

          const data = await res.json();
          if (data.insights) {
            setDailyData(data);
            await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
            await refreshDailyNotification();
            saveGoalsForDate(data.date, data.actionGoals ?? []);
          }
        } catch {
          // Fall back to bundled data if we have nothing else to show
          setDailyData(prev => prev ?? fallbackData);
          saveGoalsForDate(fallbackData.date, fallbackData.actionGoals ?? []);
        } finally {
          setLoading(false);
        }
      }

      loadDaily();
    }, [])
  );

  const spiritualInsight = dailyData?.insights?.find(i => i.type === 'spiritual') ?? null;
  const scienceInsight   = dailyData?.insights?.find(i => i.type === 'scientific') ?? null;
  const actionGoals      = dailyData?.actionGoals ?? [];
  const dailyDua         = getDailyDua();
  const dailyAyah        = getDailyAyah();

  const greetingLines = name
    ? ['As-Salāmu ʿAlaykum,', name + '.']
    : ['As-Salāmu ʿAlaykum.'];

  return (
    <>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe} edges={[]}>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* ── Dark hero header ── */}
          <View style={[styles.hero, { paddingTop: insets.top + 20 }]}>
            <View style={styles.heroRow}>
              <View style={styles.heroText}>
                {animate ? (
                  <TypewriterText
                    lines={greetingLines}
                    charDelay={38}
                    lineDelay={300}
                    style={styles.greetingLine}
                    lineStyle={{
                      0: styles.greetingSmall,
                      1: styles.greetingName,
                    }}
                    onComplete={revealContent}
                  />
                ) : (
                  <Text>
                    <Text style={styles.greetingSmall}>
                      {'As-Salāmu ʿAlaykum' + (name ? ',' : '.') + '\n'}
                    </Text>
                    {name ? <Text style={styles.greetingName}>{name}.</Text> : null}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* ── Light content sheet ── */}
          <Animated.View style={[styles.sheet, { opacity: animate ? contentOpacity : 1 }]}>
            <View style={styles.contentPad}>

              {/* TODAY'S PARENTING INSIGHTS */}
              <View style={styles.sectionTitleWrap}>
                <Text style={styles.sectionTitle}>TODAY'S PARENTING INSIGHTS</Text>
                {loading && <ActivityIndicator size="small" color="#1B3D2F" style={{ marginLeft: 8 }} />}
              </View>

              <View style={styles.tipsRow}>
                {spiritualInsight && (
                  <TouchableOpacity
                    style={styles.tipCard}
                    activeOpacity={0.88}
                    onPress={() => navigation.navigate('InsightDetail', { insight: spiritualInsight })}
                  >
                    <LinearGradient
                      colors={['#6B7C45', '#1B3D2F']}
                      start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                      style={styles.tipCardInner}
                    >
                      <View style={styles.tipLabelWrap}>
                        <Text style={styles.tipLabel}>Spiritual Insight</Text>
                      </View>
                      <View style={styles.tipBody}>
                        <View>
                          <Text style={styles.tipInsightTitle}>{spiritualInsight.insightTitle}</Text>
                          <Text style={styles.tipQuote} numberOfLines={5}>{spiritualInsight.body}</Text>
                        </View>
                        <View style={styles.tipFooterWrap}>
                          <View style={styles.tipRule} />
                          <View style={styles.tipReadMore}>
                            <Text style={styles.tipReadMoreText}>Read more</Text>
                            <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.6)" />
                          </View>
                        </View>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                )}

                {scienceInsight && (
                  <TouchableOpacity
                    style={styles.tipCard}
                    activeOpacity={0.88}
                    onPress={() => navigation.navigate('InsightDetail', { insight: scienceInsight })}
                  >
                    <LinearGradient
                      colors={['#D4A55A', '#A0521A']}
                      start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                      style={styles.tipCardInner}
                    >
                      <View style={styles.tipLabelWrap}>
                        <Text style={styles.tipLabel}>Research Insight</Text>
                      </View>
                      <View style={styles.tipBody}>
                        <View>
                          <Text style={styles.tipInsightTitle}>{scienceInsight.insightTitle}</Text>
                          <Text style={styles.tipQuote} numberOfLines={4}>{scienceInsight.body}</Text>
                        </View>
                        <View style={styles.tipFooterWrap}>
                          <View style={styles.tipRule} />
                          <View style={styles.tipReadMore}>
                            <Text style={styles.tipReadMoreText}>Read more</Text>
                            <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.6)" />
                          </View>
                        </View>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>

              {/* TODAY'S TIPS */}
              <View style={styles.sectionTitleWrap}>
                <Text style={styles.sectionTitle}>TODAY'S TIPS</Text>
              </View>

              {actionGoals.map(goal => {
                const isSpiritual = goal.type === 'spiritual';
                const accentColor = isSpiritual ? '#2E7D62' : '#D4871A';
                const iconBg      = isSpiritual ? '#E8F5EF' : '#FEF3E2';
                return (
                  <View
                    key={goal.id}
                    style={[styles.goalCard, isSpiritual ? styles.goalGreen : styles.goalAmber]}
                  >
                    <View style={styles.goalCardInner}>
                      <View style={[styles.goalIconBox, { backgroundColor: iconBg }]}>
                        <Ionicons
                          name={isSpiritual ? 'moon' : 'bulb-outline'}
                          size={16} color={accentColor}
                        />
                      </View>
                      <View style={styles.goalCardContent}>
                        <Text style={[styles.goalTypeLabel, { color: accentColor }]}>
                          {goal.label}
                        </Text>
                        <Text style={styles.goalText}>{goal.text}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}

              {/* VERSES OF THE DAY */}
              <View style={[styles.sectionTitleWrap, { marginTop: 8 }]}>
                <Text style={styles.sectionTitle}>VERSES OF THE DAY</Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={() => navigation.navigate('VerseDetail', { verse: dailyAyah })}
              >
                <LinearGradient
                  colors={['#0C1829', '#1A2F5A']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.verseCard}
                >
                  {/* Top row */}
                  <View style={styles.verseCardTopRow}>
                    <View style={styles.verseRefChip}>
                      <Ionicons name="book-outline" size={11} color="rgba(255,255,255,0.5)" />
                      <Text style={styles.verseRefChipText}>{dailyAyah.reference}</Text>
                    </View>
                  </View>

                  {/* Arabic preview */}
                  <Text style={styles.verseArabicPreview} numberOfLines={2}>
                    {dailyAyah.arabic}
                  </Text>

                  <View style={styles.verseDivider} />

                  {/* Translation preview */}
                  <Text style={styles.verseTranslationPreview} numberOfLines={2}>
                    {dailyAyah.translation}
                  </Text>

                  {/* CTA button */}
                  <View style={ayahRead ? styles.verseReadBtn : styles.verseReadBtnProminent}>
                    {ayahRead ? (
                      <>
                        <Ionicons name="checkmark-circle" size={14} color="#4ADE80" />
                        <Text style={styles.verseReadBtnDoneText}>Read today</Text>
                        <Text style={styles.verseReadBtnAgain}>Read again</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="book-outline" size={14} color="#0C1829" />
                        <Text style={styles.verseReadBtnText}>Read Verses</Text>
                      </>
                    )}
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              {/* DUA OF THE DAY */}
              <View style={[styles.sectionTitleWrap, { marginTop: 8 }]}>
                <Text style={styles.sectionTitle}>DUA OF THE DAY</Text>
              </View>
              <LinearGradient
                colors={['#1B3D2F', '#2E5E45']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.islamicCard}
              >
                <View style={styles.islamicCardTopRow}>
                  <View style={{ flexDirection: 'row' }}>
                    <Ionicons name="hand-left-outline" size={13} color="rgba(255,255,255,0.5)" />
                    <Ionicons name="hand-right-outline" size={13} color="rgba(255,255,255,0.5)" />
                  </View>
                  <Text style={styles.islamicCardLabel}>DUA</Text>
                </View>
                {dailyDua.title ? (
                  <Text style={styles.islamicDuaTitle}>{dailyDua.title}</Text>
                ) : null}
                <Text style={styles.islamicArabic}>{dailyDua.arabic}</Text>
                <View style={styles.islamicDivider} />
                <Text style={styles.islamicTranslit}>{dailyDua.transliteration}</Text>
                <Text style={styles.islamicTranslation}>{dailyDua.translation}</Text>
                <Text style={styles.islamicRef}>{dailyDua.reference}</Text>
              </LinearGradient>

              {/* THIS WEEK */}
              <View style={[styles.sectionTitleWrap, { marginTop: 8 }]}>
                <Text style={styles.sectionTitle}>THIS WEEK</Text>
              </View>

              <View style={styles.streakCard}>
                <View style={styles.streakHeaderRow}>
                  <Ionicons name="moon" size={13} color="#2E7D62" />
                  <Text style={[styles.streakLabel, { color: '#2E7D62' }]}>Spiritual</Text>
                </View>
                <Text style={styles.streakSubLabel}>Days you read a spiritual insight</Text>
                <WeekRow days={spirReadWeek} color="#1B3D2F" todayColor="#D6EFE3" />
              </View>

              <View style={[styles.streakCard, { marginTop: 10 }]}>
                <View style={styles.streakHeaderRow}>
                  <Ionicons name="bulb-outline" size={13} color="#D4871A" />
                  <Text style={[styles.streakLabel, { color: '#D4871A' }]}>Research</Text>
                </View>
                <Text style={styles.streakSubLabel}>Days you read a scientific insight</Text>
                <WeekRow days={sciReadWeek} color="#D4871A" todayColor="#FDE8C0" />
              </View>

              <View style={[styles.streakCard, { marginTop: 10 }]}>
                <View style={styles.streakHeaderRow}>
                  <Ionicons name="book-outline" size={13} color="#6B9FD4" />
                  <Text style={[styles.streakLabel, { color: '#6B9FD4' }]}>Quran</Text>
                </View>
                <Text style={styles.streakSubLabel}>Days you read the verses of the day</Text>
                <WeekRow days={quranReadWeek} color="#1A3A6B" todayColor="#D0E4F7" />
              </View>

              <View style={{ height: 32 }} />
            </View>
          </Animated.View>

        </ScrollView>

      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1B3D2F' },

  // ── Hero header ──
  hero: {
    backgroundColor: '#1B3D2F',
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heroText: { flex: 1 },
  greetingLine: { color: '#FFFFFF' },
  greetingSmall: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '400',
    letterSpacing: 0.2,
    lineHeight: 22,
  },
  greetingName: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 40,
    marginTop: 2,
  },
  datePill: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  dateGregorian: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 0.2,
  },
  dateHijri: {
    fontSize: 11,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.55)',
    marginTop: 2,
  },

  // ── Content sheet ──
  sheet: {
    flexGrow: 1,
    backgroundColor: '#F5F6F8',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  scrollContent: { flexGrow: 1 },
  contentPad: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 36 },

  // ── Section titles ──
  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 13, fontWeight: '700',
    color: '#1B3D2F', letterSpacing: 0.4,
  },
  sectionUnderline: {
    width: 3, height: 13, borderRadius: 2,
    backgroundColor: '#1B3D2F', opacity: 0.3,
  },

  // ── Insight cards ──
  tipsRow: {
    flexDirection: 'row', gap: 12, marginBottom: 8, alignItems: 'stretch',
  },
  tipCard: {
    flex: 1, borderRadius: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 5,
  },
  tipCardInner: { flex: 1, borderRadius: 20, overflow: 'hidden' },
  tipLabelWrap: {
    paddingVertical: 10, paddingHorizontal: 14,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  tipLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.2,
    textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)',
  },
  tipByline: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  bylineImage: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.45)',
  },
  bylineName: {
    flex: 1, fontSize: 12, fontWeight: '700',
    color: '#FFFFFF', letterSpacing: 0.1,
  },
  tipBody: { flex: 1, padding: 14, justifyContent: 'space-between' },
  tipInsightTitle: {
    fontSize: 13, fontWeight: '700', color: '#FFFFFF',
    lineHeight: 19, marginBottom: 8,
  },
  tipQuote: { fontSize: 12, color: 'rgba(255,255,255,0.78)', lineHeight: 18 },
  tipFooterWrap: { marginTop: 12 },
  tipRule: { height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginBottom: 10 },
  tipReadMore: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  tipReadMoreText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },

  // ── Action Goals ──
  goalCard: {
    borderRadius: 16, marginBottom: 10, overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  goalGreen: { borderLeftWidth: 4, borderLeftColor: '#2E7D62' },
  goalAmber: { borderLeftWidth: 4, borderLeftColor: '#D4871A' },
  goalCardInner: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, gap: 14,
  },
  goalIconBox: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  goalCardContent: { flex: 1, justifyContent: 'center' },
  goalTypeLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 0.8,
    textTransform: 'uppercase', marginBottom: 5,
  },
  goalText: {
    fontSize: 14, fontWeight: '500',
    color: '#1C1C1E', lineHeight: 21,
  },

  // ── Dua / Ayah cards ──
  islamicCard: {
    borderRadius: 20,
    marginBottom: 10,
    padding: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
  islamicCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 14,
  },
  islamicCardLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.5)',
  },
  islamicDuaTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.3,
    marginBottom: 10,
  },
  islamicArabic: {
    fontSize: 20,
    color: '#FFFFFF',
    textAlign: 'right',
    lineHeight: 36,
    fontWeight: '600',
    marginBottom: 2,
  },
  islamicDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: 12,
  },
  islamicTranslit: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    fontStyle: 'italic',
    lineHeight: 18,
    marginBottom: 6,
  },
  islamicTranslation: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 20,
  },
  islamicRef: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.5,
    marginTop: 10,
  },
  // ── Verse of the Day card ──
  verseCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#0C1829',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
  verseCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  verseRefChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  verseRefChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.8,
  },
  verseReadBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(74,222,128,0.12)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  verseReadBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4ADE80',
  },
  verseArabicPreview: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'right',
    lineHeight: 34,
    fontWeight: '500',
    marginBottom: 14,
  },
  verseDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 12,
  },
  verseTranslationPreview: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 20,
    marginBottom: 14,
  },
  verseReadBtnProminent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 11,
    paddingHorizontal: 20,
    marginTop: 16,
    alignSelf: 'stretch',
  },
  verseReadBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0C1829',
  },
  verseReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
  },
  verseReadBtnDoneText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4ADE80',
    flex: 1,
  },
  verseReadBtnAgain: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.35)',
  },
  verseCardCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verseCardCTAText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.3,
  },

  // ── Streak card ──
  streakCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  streakHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  streakLabel: { fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },
  streakSubLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '500', marginBottom: 10, marginTop: -10 },
});
