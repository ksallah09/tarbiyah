/**
 * DARK THEME PREVIEW — full dark green HomeScreen
 * To preview: in App.js replace:
 *   import HomeScreen from './src/screens/HomeScreen';
 * with:
 *   import HomeScreen from './src/screens/HomeScreenDark';
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
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
import { getWeekReadDays } from '../utils/readInsights';
import { saveGoalsForDate } from '../utils/goalHistory';
import TypewriterText from '../components/TypewriterText';

const API_URL = 'https://tarbiyah-production.up.railway.app';

const ASSET_MAP = {
  'YAsmin-MOgahed.png':               require('../../assets/YAsmin-MOgahed.png'),
  'belal-assaad.jpg':                 require('../../assets/belal-assaad.jpg'),
  'Omar-Suleiman.jpg':                require('../../assets/Omar-Suleiman.jpg'),
  'yasir-qadhi.jpeg':                 require('../../assets/yasir-qadhi.jpeg'),
  'mufti-menk.jpeg':                  require('../../assets/mufti-menk.jpeg'),
  'haifaa-younis.jpeg':               require('../../assets/haifaa-younis.jpeg'),
  'ibrahim-hindy.jpeg':               require('../../assets/ibrahim-hindy.jpeg'),
  'national-inst-child-health.jpeg':  require('../../assets/national-inst-child-health.jpeg'),
  'childmind.png':                    require('../../assets/childmind.png'),
  'american-academy-of-ped.jpg':      require('../../assets/american-academy-of-ped.jpg'),
  'ucdavishealth.jpg':                require('../../assets/ucdavishealth.jpg'),
  'NIH_2013_logo_vertical.svg.png':   require('../../assets/NIH_2013_logo_vertical.svg.png'),
  'CDC_logo_2024.png':                require('../../assets/CDC_logo_2024.png'),
  'hamza-yusuf.png':                  require('../../assets/hamza-yusuf.png'),
  'AAFP_LogoMark_Color.jpg':          require('../../assets/AAFP_LogoMark_Color.jpg'),
  'UNICEF-logo.png':                  require('../../assets/UNICEF-logo.png'),
  'spiritual-insights.png':           require('../../assets/spiritual-insights.png'),
  'science-insights.png':             require('../../assets/science-insights.png'),
};

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
              : <Text style={[weekRowStyles.letter, d.today && { color: '#FFFFFF', fontWeight: '700' }]}>{d.short}</Text>
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  letter: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.3)' },
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

  const [dailyData, setDailyData]            = useState(fallbackData);
  const [loading, setLoading]                = useState(true);
  const [spirReadWeek, setSpiritualReadWeek] = useState([]);
  const [sciReadWeek,  setScientificReadWeek]= useState([]);
  const [name, setName]                      = useState('');
  const [animate, setAnimate]                = useState(false);

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

      Promise.all([getProfileName(), checkShouldAnimateGreeting()])
        .then(([profileName, shouldAnimate]) => {
          setName(profileName || '');
          setAnimate(shouldAnimate);
          if (!shouldAnimate) revealContent();
        });

      fetch(`${API_URL}/daily/preview`)
        .then(r => r.json())
        .then(data => {
          if (data.insights) {
            setDailyData(data);
            saveGoalsForDate(data.date, data.actionGoals ?? []);
          }
        })
        .catch(() => {
          saveGoalsForDate(fallbackData.date, fallbackData.actionGoals ?? []);
        })
        .finally(() => setLoading(false));
    }, [])
  );

  const spiritualInsight = dailyData.insights.find(i => i.type === 'spiritual');
  const scienceInsight   = dailyData.insights.find(i => i.type === 'scientific');
  const actionGoals      = dailyData.actionGoals ?? [];

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
          {/* ── Greeting ── */}
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
              <TouchableOpacity style={styles.notifBtn}>
                <Ionicons name="notifications-outline" size={20} color="rgba(255,255,255,0.7)" />
                <View style={styles.notifBadge} />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Content — full dark ── */}
          <Animated.View style={[styles.contentPad, { opacity: animate ? contentOpacity : 1 }]}>

            {/* TODAY'S INSIGHTS */}
            <View style={styles.sectionTitleWrap}>
              <Text style={styles.sectionTitle}>TODAY'S INSIGHTS</Text>
              {loading && <ActivityIndicator size="small" color="rgba(255,255,255,0.4)" style={{ marginLeft: 8 }} />}
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
                    <View style={styles.tipByline}>
                      <Image
                        source={ASSET_MAP[spiritualInsight.speakerImage] ?? ASSET_MAP['spiritual-insights.png']}
                        style={styles.bylineImage}
                      />
                      <Text style={styles.bylineName}>{spiritualInsight.speakerName}</Text>
                    </View>
                    <View style={styles.tipBody}>
                      <View>
                        <Text style={styles.tipInsightTitle}>{spiritualInsight.insightTitle}</Text>
                        <Text style={styles.tipQuote} numberOfLines={4}>{spiritualInsight.body}</Text>
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
                    <View style={styles.tipByline}>
                      <Image
                        source={ASSET_MAP[scienceInsight.speakerImage] ?? ASSET_MAP['science-insights.png']}
                        style={styles.bylineImage}
                      />
                      <Text style={styles.bylineName}>{scienceInsight.speakerName}</Text>
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

            {/* TODAY'S ACTION GOALS */}
            <View style={styles.sectionTitleWrap}>
              <Text style={styles.sectionTitle}>TODAY'S ACTION GOALS</Text>
            </View>

            {actionGoals.map(goal => {
              const isSpiritual = goal.type === 'spiritual';
              const accentColor = isSpiritual ? '#4CAF85' : '#E8A84A';
              return (
                <View
                  key={goal.id}
                  style={[styles.goalCard, { borderLeftColor: accentColor }]}
                >
                  <View style={styles.checklistRow}>
                    <View style={styles.checklistContent}>
                      <View style={styles.checklistMeta}>
                        <Ionicons
                          name={isSpiritual ? 'moon' : 'bulb-outline'}
                          size={12} color={accentColor}
                        />
                        <Text style={[styles.checklistType, { color: accentColor }]}>
                          {goal.label}
                        </Text>
                      </View>
                      <Text style={styles.checklistText}>{goal.text}</Text>
                    </View>
                  </View>
                </View>
              );
            })}

            {/* THIS WEEK */}
            <View style={[styles.sectionTitleWrap, { marginTop: 8 }]}>
              <Text style={styles.sectionTitle}>THIS WEEK</Text>
            </View>

            <View style={styles.streakCard}>
              <View style={styles.streakHeaderRow}>
                <Ionicons name="moon" size={13} color="#4CAF85" />
                <Text style={[styles.streakLabel, { color: '#4CAF85' }]}>Spiritual</Text>
              </View>
              <Text style={styles.streakSubLabel}>Days you read a spiritual insight</Text>
              <WeekRow days={spirReadWeek} color="#4CAF85" todayColor="rgba(76,175,133,0.2)" />
            </View>

            <View style={[styles.streakCard, { marginTop: 10 }]}>
              <View style={styles.streakHeaderRow}>
                <Ionicons name="bulb-outline" size={13} color="#E8A84A" />
                <Text style={[styles.streakLabel, { color: '#E8A84A' }]}>Scientific</Text>
              </View>
              <Text style={styles.streakSubLabel}>Days you read a scientific insight</Text>
              <WeekRow days={sciReadWeek} color="#E8A84A" todayColor="rgba(232,168,74,0.2)" />
            </View>

            <View style={{ height: 32 }} />
          </Animated.View>

        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1B3D2F' },
  scrollContent: { flexGrow: 1 },

  // ── Greeting ──
  hero: {
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
  notifBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 4,
  },
  notifBadge: {
    position: 'absolute', top: 8, right: 8,
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: '#D4871A',
    borderWidth: 1.5, borderColor: '#1B3D2F',
  },

  // ── Content ──
  contentPad: { paddingHorizontal: 20, paddingBottom: 36 },

  // ── Section titles ──
  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1.0,
  },

  // ── Insight cards (unchanged — already dark) ──
  tipsRow: {
    flexDirection: 'row', gap: 12, marginBottom: 8, alignItems: 'stretch',
  },
  tipCard: {
    flex: 1, borderRadius: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 14, elevation: 6,
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

  // ── Action Goals — dark cards ──
  goalCard: {
    borderRadius: 14,
    marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderLeftWidth: 3,
  },
  checklistRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, gap: 14 },
  checklistContent: { flex: 1 },
  checklistMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  checklistType: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  checklistText: { fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 20 },

  // ── Week cards — dark ──
  streakCard: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    padding: 18,
  },
  streakHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  streakLabel: { fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },
  streakSubLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    fontWeight: '500',
    marginBottom: 10,
    marginTop: -10,
  },
});
