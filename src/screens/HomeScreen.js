import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  ImageBackground,
  Dimensions,
  Share,
} from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
const TIP_CARD_WIDTH = SCREEN_WIDTH - 80; // 20 left inset + 12 gap + 48 peek
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import fallbackData from '../data/insights.json';
import { getWeekReadDays, isReadToday, getStreak } from '../utils/readInsights';
import { saveGoalsForDate } from '../utils/goalHistory';
import { loadFamilyGoalsCached, loadFamilyGoals } from '../utils/familyGoals';
import { loadCompletions, countThisWeek, isCompletedToday, logCompletion } from '../utils/goalCompletions';
import TypewriterText from '../components/TypewriterText';
import { getDailyDua, getDailyAyah } from '../data/dailyIslamic';
import { refreshDailyNotification } from '../utils/notifications';
import { supabase } from '../utils/supabase';
import { rs, hp } from '../utils/responsive';


const SCIENCE_IMAGES = [
  require('../../assets/science-1.jpg'),
  require('../../assets/science-2.jpg'),
  require('../../assets/science-3.jpg'),
  require('../../assets/science-4.jpg'),
  require('../../assets/science-5.jpg'),
  require('../../assets/science-6.jpg'),
  require('../../assets/science-7.jpg'),
];

const DAY_INDEX = Math.floor(Date.now() / 86_400_000);


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
  const [tipIndex, setTipIndex]              = useState(0);
  const [imgIndex, setImgIndex]              = useState(DAY_INDEX);
  const [spiritReadToday, setSpiritReadToday] = useState(false);
  const [sciReadToday,    setSciReadToday]    = useState(false);
  const [streak,      setStreak]      = useState(0);
  const [sciStreak,   setSciStreak]   = useState(0);
  const [quranStreak, setQuranStreak] = useState(0);
  const [familyGoals,  setFamilyGoals]  = useState([]);
  const [completions,  setCompletions]  = useState([]);
  // Ref to always-current insight IDs so useFocusEffect (empty deps) can re-check on return
  const insightIdsRef = useRef({ spiritual: null, scientific: null });


  const SPIRITUAL_CARD_IMAGES = [
    require('../../assets/spiritual-1.jpg'),
    require('../../assets/spiritual-2.jpg'),
    require('../../assets/spiritual-5.jpg'),
    require('../../assets/spiritual-7.jpg'),
  ];
  const dailySpiritualImage = SPIRITUAL_CARD_IMAGES[imgIndex % SPIRITUAL_CARD_IMAGES.length];
  const dailyScienceImage   = SCIENCE_IMAGES[(imgIndex + 1) % SCIENCE_IMAGES.length];


  async function loadDaily() {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
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
        const dataWithLocalDate = { ...data, date: today };
        setDailyData(dataWithLocalDate);
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(dataWithLocalDate));
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

  useFocusEffect(
    useCallback(() => {
      getWeekReadDays('spiritual').then(setSpiritualReadWeek);
      getWeekReadDays('scientific').then(setScientificReadWeek);
      getWeekReadDays('quran').then(setQuranReadWeek);
      getStreak('spiritual').then(setStreak);
      getStreak('scientific').then(setSciStreak);
      getStreak('quran').then(setQuranStreak);
      isReadToday('quran', dailyAyah.reference).then(setAyahRead);

      // Re-check insight read badges on every focus (e.g. returning from InsightDetail)
      const { spiritual: spirId, scientific: sciId } = insightIdsRef.current;
      if (spirId) isReadToday('spiritual', spirId).then(setSpiritReadToday);
      if (sciId)  isReadToday('scientific', sciId).then(setSciReadToday);

      // Load name + decide whether to animate greeting
      Promise.all([getProfileName(), checkShouldAnimateGreeting()])
        .then(([profileName, shouldAnimate]) => {
          setName(profileName || '');
          setAnimate(shouldAnimate);
        });

      loadDaily();

      // Load family goals + completions (cached for instant paint, live in background)
      loadFamilyGoalsCached().then(setFamilyGoals);
      loadFamilyGoals().then(setFamilyGoals);
      loadCompletions().then(setCompletions);
    }, [])
  );

  async function handleLogCompletion(goalId) {
    const updated = await logCompletion(goalId);
    setCompletions(updated);
  }

  const spiritualInsight = dailyData?.insights?.find(i => i.type === 'spiritual') ?? null;
  const scienceInsight   = dailyData?.insights?.find(i => i.type === 'scientific') ?? null;

  // Keep ref current so useFocusEffect can always access the latest IDs
  insightIdsRef.current = {
    spiritual: spiritualInsight?.id ?? null,
    scientific: scienceInsight?.id ?? null,
  };

  // On initial data load: check read status by specific insight ID so we don't
  // pick up a stale type-level flag from a previous session synced via Supabase.
  useEffect(() => {
    if (spiritualInsight?.id) isReadToday('spiritual', spiritualInsight.id).then(setSpiritReadToday);
    else setSpiritReadToday(false);
  }, [spiritualInsight?.id]);

  useEffect(() => {
    if (scienceInsight?.id) isReadToday('scientific', scienceInsight.id).then(setSciReadToday);
    else setSciReadToday(false);
  }, [scienceInsight?.id]);
  const actionGoals      = dailyData?.actionGoals ?? [];
  const dailyDua         = getDailyDua();
  const dailyAyah        = getDailyAyah();

  const greetingLines = name
    ? ['As-Salāmu ʿAlaykum,', name]
    : ['As-Salāmu ʿAlaykum.'];

  return (
    <>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe} edges={[]}>
        {/* Top half green so pull-down overscroll shows correct color */}
        <View style={styles.bgTop} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* ── Dark hero header ── */}
          <View style={[styles.hero, { paddingTop: insets.top + 20, backgroundColor: '#1B3D2F' }]}>
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
                  />
                ) : (
                  <Text>
                    <Text style={styles.greetingSmall}>
                      {'As-Salāmu ʿAlaykum' + (name ? ',' : '.') + '\n'}
                    </Text>
                    {name ? <Text style={styles.greetingName}>{name}</Text> : null}
                  </Text>
                )}
              </View>

              {/* Today's progress */}
              <View style={styles.heroProgress}>
                <Text style={styles.heroProgressLabel}>TODAY'S LEARNING</Text>
                <View style={styles.heroProgressDots}>
                  <View style={styles.heroProgressItem}>
                    {spiritReadToday
                      ? <Ionicons name="checkmark-circle" size={14} color="#4ADE80" />
                      : <View style={styles.heroProgressDot} />
                    }
                    <Text style={styles.heroProgressItemLabel}>Spiritual</Text>
                  </View>
                  <View style={styles.heroProgressItem}>
                    {sciReadToday
                      ? <Ionicons name="checkmark-circle" size={14} color="#4ADE80" />
                      : <View style={styles.heroProgressDot} />
                    }
                    <Text style={styles.heroProgressItemLabel}>Research</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* ── Content ── */}
          <View style={styles.sheet}>
            <View style={styles.contentPad}>

              {/* TODAY'S PARENTING INSIGHTS */}
              <View style={styles.sectionTitleWrap}>
                <Text style={styles.sectionTitle}>TODAY'S PARENTING INSIGHTS</Text>
                {loading && <ActivityIndicator size="small" color="#1B3D2F" style={{ marginLeft: 8 }} />}
              </View>

              {spiritualInsight && (
                <TouchableOpacity
                  style={styles.insightCard}
                  activeOpacity={0.9}
                  onPress={() => navigation.navigate('InsightDetail', { insight: spiritualInsight, imgIndex })}
                >
                  <ImageBackground
                    source={dailySpiritualImage}
                    style={styles.insightCardBg}
                    imageStyle={styles.insightCardImg}
                    resizeMode="cover"
                  >
                    <LinearGradient
                      colors={['rgba(10,30,20,0.25)', 'rgba(10,30,20,0.82)']}
                      start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                      style={styles.insightCardOverlay}
                    >
                      <View style={styles.insightCardTop}>
                        <View style={styles.insightTypePill}>
                          <Ionicons name="moon" size={10} color="rgba(255,255,255,0.9)" />
                          <Text style={styles.insightTypeText}>Spiritual Insight</Text>
                        </View>
                        {spiritReadToday && (
                          <View style={styles.insightReadBadge}>
                            <Ionicons name="checkmark-circle" size={13} color="#4ADE80" />
                            <Text style={styles.insightReadBadgeText}>Read Today</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.insightCardBottom}>
                        <Text style={styles.insightCardTitle}>{spiritualInsight.insightTitle}</Text>
                        <Text style={styles.insightCardBody} numberOfLines={3}>{spiritualInsight.body}</Text>
                        <View style={styles.insightCardFooter}>
                          <View style={styles.insightReadMore}>
                            <Text style={styles.insightReadMoreText}>Read more</Text>
                            <Ionicons name="arrow-forward" size={12} color="rgba(255,255,255,0.8)" />
                          </View>
                        </View>
                      </View>
                    </LinearGradient>
                  </ImageBackground>
                </TouchableOpacity>
              )}

              {scienceInsight && (
                <TouchableOpacity
                  style={styles.insightCard}
                  activeOpacity={0.9}
                  onPress={() => navigation.navigate('InsightDetail', { insight: scienceInsight, imgIndex })}
                >
                  <ImageBackground
                    source={dailyScienceImage}
                    style={styles.insightCardBg}
                    imageStyle={styles.insightCardImg}
                    resizeMode="cover"
                  >
                    <LinearGradient
                      colors={['rgba(30,15,5,0.25)', 'rgba(30,15,5,0.82)']}
                      start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                      style={styles.insightCardOverlay}
                    >
                      <View style={styles.insightCardTop}>
                        <View style={[styles.insightTypePill, styles.insightTypePillAmber]}>
                          <Ionicons name="bulb-outline" size={10} color="rgba(255,255,255,0.9)" />
                          <Text style={styles.insightTypeText}>Research Insight</Text>
                        </View>
                        {sciReadToday && (
                          <View style={styles.insightReadBadge}>
                            <Ionicons name="checkmark-circle" size={13} color="#4ADE80" />
                            <Text style={styles.insightReadBadgeText}>Read Today</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.insightCardBottom}>
                        <Text style={styles.insightCardTitle}>{scienceInsight.insightTitle}</Text>
                        <Text style={styles.insightCardBody} numberOfLines={3}>{scienceInsight.body}</Text>
                        <View style={styles.insightCardFooter}>
                          <View style={styles.insightReadMore}>
                            <Text style={styles.insightReadMoreText}>Read more</Text>
                            <Ionicons name="arrow-forward" size={12} color="rgba(255,255,255,0.8)" />
                          </View>
                        </View>
                      </View>
                    </LinearGradient>
                  </ImageBackground>
                </TouchableOpacity>
              )}

              {/* ── DEV: Refresh insights ── */}
              {__DEV__ && (
                <TouchableOpacity
                  style={styles.devRefreshBtn}
                  onPress={async () => {
                    await AsyncStorage.removeItem(CACHE_KEY);
                    setImgIndex(i => i + 1);
                    loadDaily();
                  }}
                >
                  <Ionicons name="refresh-outline" size={13} color="#6B7280" />
                  <Text style={styles.devRefreshText}>Refresh Insights (dev only)</Text>
                </TouchableOpacity>
              )}

              {/* TODAY'S TIPS */}
              <View style={styles.sectionTitleWrap}>
                <Text style={styles.sectionTitle}>TODAY'S TIPS</Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                snapToInterval={TIP_CARD_WIDTH + 12}
                snapToAlignment="start"
                style={{ marginHorizontal: -20 }}
                contentContainerStyle={styles.tipsScroll}
                onScroll={e => {
                  const x = e.nativeEvent.contentOffset.x;
                  setTipIndex(Math.round(x / (TIP_CARD_WIDTH + 12)));
                }}
                scrollEventThrottle={16}
              >
                {actionGoals.map((goal, index) => {
                  const isSpiritual = goal.type === 'spiritual';
                  return (
                    <View
                      key={goal.id}
                      style={[styles.goalCard, isSpiritual ? styles.goalGreen : styles.goalAmber, index < actionGoals.length - 1 && { marginRight: 12 }]}
                    >
                      <View style={styles.goalCardInner}>
                        <View style={[styles.goalTypePill, { backgroundColor: isSpiritual ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.15)' }]}>
                          <Ionicons name={isSpiritual ? 'moon' : 'bulb-outline'} size={10} color="rgba(255,255,255,0.9)" />
                          <Text style={styles.goalTypePillText}>{goal.label}</Text>
                        </View>
                        <Text style={styles.goalText}>{goal.text}</Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>

              {/* Swipe dots + counter */}
              {actionGoals.length > 1 && (
                <View style={styles.tipDotsRow}>
                  <View style={styles.tipDots}>
                    {actionGoals.map((_, i) => (
                      <View
                        key={i}
                        style={[styles.tipDot, i === tipIndex && styles.tipDotActive]}
                      />
                    ))}
                  </View>
                  <Text style={styles.tipCounter}>
                    {tipIndex + 1} / {actionGoals.length}
                  </Text>
                </View>
              )}

              {/* FAMILY GOALS */}
              {familyGoals.length === 0 && (
                <>
                  <View style={[styles.sectionTitleWrap, { marginTop: 8 }]}>
                    <Text style={styles.sectionTitle}>FAMILY GOALS</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.homeGoalEmptyCard}
                    onPress={() => navigation.navigate('Progress')}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="people-outline" size={18} color="#2E7D62" />
                    <Text style={styles.homeGoalEmptyText}>No family goals yet</Text>
                    <Text style={styles.homeGoalEmptyLink}>Set goals on the Progress tab →</Text>
                  </TouchableOpacity>
                </>
              )}
              {familyGoals.length > 0 && (
                <>
                  <View style={[styles.sectionTitleWrap, { marginTop: 8 }]}>
                    <Text style={styles.sectionTitle}>FAMILY GOALS</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('Progress')}>
                      <Text style={styles.sectionSeeAll}>See all</Text>
                    </TouchableOpacity>
                  </View>
                  {familyGoals.map(goal => {
                    const target    = goal.frequency ?? 1;
                    const count     = countThisWeek(completions, goal.id);
                    const doneToday = isCompletedToday(completions, goal.id);
                    const goalMet   = count >= target;
                    const dotCount  = Math.min(target, 7);
                    return (
                      <View key={goal.id} style={styles.homeGoalCard}>
                        <View style={[styles.homeGoalIconWrap, { backgroundColor: (goal.iconColor ?? '#2E7D62') + '20' }]}>
                          <Ionicons name={goal.icon ?? 'trophy'} size={16} color={goal.iconColor ?? '#2E7D62'} />
                        </View>
                        <View style={styles.homeGoalBody}>
                          <Text style={styles.homeGoalTitle} numberOfLines={1}>{goal.title}</Text>
                          <View style={styles.homeGoalTrackerRow}>
                            <View style={styles.homeGoalDots}>
                              {Array.from({ length: dotCount }).map((_, i) => (
                                <View key={i} style={[styles.homeGoalDot, i < count && { backgroundColor: goal.iconColor ?? '#2E7D62' }]} />
                              ))}
                            </View>
                            <Text style={styles.homeGoalCount}>{count}/{target}</Text>
                          </View>
                        </View>
                        {goalMet ? (
                          <View style={styles.homeGoalMetPill}>
                            <Ionicons name="checkmark-circle" size={13} color="#2E7D62" />
                            <Text style={styles.homeGoalMetText}>Done</Text>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={[styles.homeGoalLogBtn, doneToday && styles.homeGoalLogBtnDone]}
                            onPress={() => handleLogCompletion(goal.id)}
                            disabled={doneToday}
                            activeOpacity={0.75}
                          >
                            <Ionicons name={doneToday ? 'checkmark' : 'add'} size={14} color={doneToday ? '#2E7D62' : '#FFFFFF'} />
                            {!doneToday && <Text style={styles.homeGoalLogBtnText}>Log it</Text>}
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </>
              )}

              {/* VERSES OF THE DAY */}
              <View style={[styles.sectionTitleWrap, { marginTop: 8 }]}>
                <Text style={styles.sectionTitle}>VERSES OF THE DAY</Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={() => navigation.navigate('VerseDetail', { verse: dailyAyah })}
              >
                <ImageBackground
                  source={require('../../assets/spiritual-8.jpg')}
                  style={styles.verseCard}
                  imageStyle={{ borderRadius: 20 }}
                  resizeMode="cover"
                >
                <LinearGradient
                  colors={['rgba(5,14,10,0.78)', 'rgba(5,14,10,0.92)']}
                  style={StyleSheet.absoluteFill}
                />
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
                </ImageBackground>
              </TouchableOpacity>

              {/* DUA OF THE DAY */}
              <View style={[styles.sectionTitleWrap, { marginTop: 8 }]}>
                <Text style={styles.sectionTitle}>DUA OF THE DAY</Text>
              </View>
              <ImageBackground
                source={require('../../assets/spiritual-5.jpg')}
                style={styles.islamicCard}
                imageStyle={{ borderRadius: 20 }}
                resizeMode="cover"
              >
                <LinearGradient
                  colors={['rgba(15,50,35,0.55)', 'rgba(10,35,25,0.80)']}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.islamicCardTopRow}>
                  <View style={{ flexDirection: 'row' }}>
                    <Ionicons name="hand-left-outline" size={13} color="rgba(255,255,255,0.5)" />
                    <Ionicons name="hand-right-outline" size={13} color="rgba(255,255,255,0.5)" />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={styles.islamicCardLabel}>DUA</Text>
                    <TouchableOpacity
                      onPress={() => Share.share({
                        message: `${dailyDua.title ? dailyDua.title + '\n\n' : ''}${dailyDua.arabic}\n\n${dailyDua.transliteration}\n\n"${dailyDua.translation}"\n\n— ${dailyDua.reference}\n\nShared from Tarbiyah`,
                      })}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="share-outline" size={16} color="rgba(255,255,255,0.55)" />
                    </TouchableOpacity>
                  </View>
                </View>
                {dailyDua.title ? (
                  <Text style={styles.islamicDuaTitle}>{dailyDua.title}</Text>
                ) : null}
                <Text style={styles.islamicArabic}>{dailyDua.arabic}</Text>
                <View style={styles.islamicDivider} />
                <Text style={styles.islamicTranslit}>{dailyDua.transliteration}</Text>
                <Text style={styles.islamicTranslation}>{dailyDua.translation}</Text>
                <Text style={styles.islamicRef}>{dailyDua.reference}</Text>
              </ImageBackground>

              {/* THIS WEEK */}
              <View style={[styles.sectionTitleWrap, { marginTop: 8 }]}>
                <Text style={styles.sectionTitle}>THIS WEEK</Text>
              </View>

              <View style={styles.streakCard}>
                <View style={styles.streakHeaderRow}>
                  <Ionicons name="moon" size={13} color="#2E7D62" />
                  <Text style={[styles.streakLabel, { color: '#2E7D62' }]}>Spiritual</Text>
                  <View style={styles.streakBadge}>
                    <Ionicons name="flame" size={11} color="#2E7D62" />
                    <Text style={[styles.streakBadgeNum, { color: '#2E7D62' }]}>{streak} day streak</Text>
                  </View>
                </View>
                <Text style={styles.streakSubLabel}>Days you read a spiritual insight</Text>
                <WeekRow days={spirReadWeek} color="#1B3D2F" todayColor="#D6EFE3" />
              </View>

              <View style={[styles.streakCard, { marginTop: 10 }]}>
                <View style={styles.streakHeaderRow}>
                  <Ionicons name="bulb-outline" size={13} color="#D4871A" />
                  <Text style={[styles.streakLabel, { color: '#D4871A' }]}>Research</Text>
                  <View style={styles.streakBadge}>
                    <Ionicons name="flame" size={11} color="#D4871A" />
                    <Text style={[styles.streakBadgeNum, { color: '#D4871A' }]}>{sciStreak} day streak</Text>
                  </View>
                </View>
                <Text style={styles.streakSubLabel}>Days you read a scientific insight</Text>
                <WeekRow days={sciReadWeek} color="#D4871A" todayColor="#FDE8C0" />
              </View>

              <View style={[styles.streakCard, { marginTop: 10 }]}>
                <View style={styles.streakHeaderRow}>
                  <Ionicons name="book-outline" size={13} color="#6B9FD4" />
                  <Text style={[styles.streakLabel, { color: '#6B9FD4' }]}>Quran</Text>
                  <View style={styles.streakBadge}>
                    <Ionicons name="flame" size={11} color="#6B9FD4" />
                    <Text style={[styles.streakBadgeNum, { color: '#6B9FD4' }]}>{quranStreak} day streak</Text>
                  </View>
                </View>
                <Text style={styles.streakSubLabel}>Days you read the verses of the day</Text>
                <WeekRow days={quranReadWeek} color="#1A3A6B" todayColor="#D0E4F7" />
              </View>

              <View style={{ height: 32 }} />
            </View>
          </View>

        </ScrollView>

      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6F8' },
  bgTop: { position: 'absolute', top: 0, left: 0, right: 0, height: '50%', backgroundColor: '#1B3D2F' },

  // ── Hero header ──
  hero: {
    paddingHorizontal: hp,
    paddingBottom: 14,
    overflow: 'hidden',
  },
  heroBgImage: {
    resizeMode: 'cover',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  heroText: { flex: 1 },
  heroProgress: {
    gap: 6,
    justifyContent: 'flex-start',
  },
  heroProgressLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 22,
  },
  heroStreakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  heroStreakEmoji: {
    fontSize: 13,
  },
  heroStreakText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroProgressDots: {
    flexDirection: 'row', gap: 16,
  },
  heroProgressItem: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
  },
  heroProgressDot: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroProgressDotDone: {
    backgroundColor: '#4ADE80',
    borderColor: '#4ADE80',
  },
  heroProgressItemLabel: {
    fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.65)',
  },
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
    overflow: 'hidden',
  },
  scrollContent: { flexGrow: 1 },
  contentPad: { paddingHorizontal: hp, paddingTop: 8, paddingBottom: 36 },

  // ── Section titles ──
  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 11, fontWeight: '700',
    color: '#1B3D2F', letterSpacing: 0.8,
  },
  sectionUnderline: {
    width: 3, height: 13, borderRadius: 2,
    backgroundColor: '#1B3D2F', opacity: 0.3,
  },
  sectionSeeAll: {
    fontSize: 11, fontWeight: '700', color: '#2E7D62', marginLeft: 'auto',
  },

  // ── Home family goal empty state ──
  homeGoalEmptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#1B3D2F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    borderLeftWidth: 3,
    borderLeftColor: '#2E7D62',
  },
  homeGoalEmptyText: {
    fontSize: 13, fontWeight: '600', color: '#6B7280', flex: 1,
  },
  homeGoalEmptyLink: {
    fontSize: 12, fontWeight: '700', color: '#2E7D62',
  },

  // ── Home family goal cards ──
  homeGoalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#1B3D2F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    borderLeftWidth: 3,
    borderLeftColor: '#2E7D62',
  },
  homeGoalIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  homeGoalBody: { flex: 1 },
  homeGoalTitle: {
    fontSize: 13, fontWeight: '700', color: '#111827', marginBottom: 6,
  },
  homeGoalTrackerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  homeGoalDots: { flexDirection: 'row', gap: 3 },
  homeGoalDot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: '#E5E7EB',
  },
  homeGoalCount: {
    fontSize: 10, color: '#9CA3AF', fontWeight: '600',
  },
  homeGoalMetPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#E8F5EF', borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 5,
  },
  homeGoalMetText: {
    fontSize: 11, color: '#2E7D62', fontWeight: '700',
  },
  homeGoalLogBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#2E7D62', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  homeGoalLogBtnDone: { backgroundColor: '#E8F5EF' },
  homeGoalLogBtnText: {
    fontSize: 11, color: '#FFFFFF', fontWeight: '700',
  },

  // ── Insight cards ──
  devRefreshBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 8, marginBottom: 16,
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    backgroundColor: '#F9FAFB',
  },
  devRefreshText: {
    fontSize: 12, color: '#9CA3AF', fontWeight: '500',
  },
  insightCard: {
    borderRadius: 22, overflow: 'hidden', marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18, shadowRadius: 16, elevation: 7,
  },
  insightCardBg: { width: '100%', height: 220 },
  insightCardImg: { borderRadius: 22 },
  insightCardOverlay: {
    flex: 1, borderRadius: 22, padding: 18,
    justifyContent: 'space-between',
  },
  insightCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  insightReadBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 9, paddingVertical: 5,
    borderRadius: 100,
    borderWidth: 1, borderColor: 'rgba(74,222,128,0.4)',
  },
  insightReadBadgeText: {
    fontSize: 10, fontWeight: '700', color: '#4ADE80', letterSpacing: 0.8,
  },
  insightTypePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(46,125,98,0.55)',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 100,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  insightTypePillAmber: { backgroundColor: 'rgba(160,82,26,0.55)' },
  insightTypeText: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.1,
    textTransform: 'uppercase', color: 'rgba(255,255,255,0.92)',
  },
  insightCardBottom: { gap: 8 },
  insightCardTitle: {
    fontSize: rs(20), fontWeight: '800', color: '#FFFFFF',
    lineHeight: 26, letterSpacing: -0.3,
  },
  insightCardBody: {
    fontSize: 13, color: 'rgba(255,255,255,0.78)', lineHeight: 20,
  },
  insightCardFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    marginTop: 4,
  },
  insightCardSpeaker: {
    fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.2,
  },
  insightReadMore: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  insightReadMoreText: {
    fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.85)',
  },

  // ── Action Goals ──
  tipsScroll: { paddingLeft: 20, paddingBottom: 6 },
  tipDotsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, marginTop: 10, marginBottom: 4,
  },
  tipDots: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  tipDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: '#D1D5DB',
  },
  tipDotActive: {
    width: 18, height: 6, borderRadius: 3,
    backgroundColor: '#1B3D2F',
  },
  tipCounter: {
    fontSize: 11, fontWeight: '600',
    color: '#9CA3AF', letterSpacing: 0.5,
  },
  goalCard: {
    width: TIP_CARD_WIDTH, borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 5,
  },
  goalGreen: { backgroundColor: '#1B3D2F' },
  goalAmber: { backgroundColor: '#7C3A10' },
  goalCardInner: {
    padding: 16, gap: 12,
  },
  goalTypePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 100,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  goalTypePillText: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.1,
    textTransform: 'uppercase', color: 'rgba(255,255,255,0.92)',
  },
  goalText: {
    fontSize: 14, fontWeight: '500',
    color: 'rgba(255,255,255,0.9)', lineHeight: 21,
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
    fontSize: rs(22),
    color: '#FFFFFF',
    textAlign: 'right',
    lineHeight: 42,
    fontFamily: 'Amiri_700Bold',
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
    fontSize: rs(20),
    color: '#FFFFFF',
    textAlign: 'right',
    lineHeight: 40,
    fontFamily: 'Amiri_400Regular',
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
  streakBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    marginLeft: 'auto',
  },
  streakBadgeNum: { fontSize: 11, fontWeight: '700' },
  streakLabel: { fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },
  streakSubLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '500', marginBottom: 10, marginTop: -10 },
});
