import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import fallbackData from '../data/insights.json';
import { getWeekReadDays } from '../utils/readInsights';
import { saveGoalsForDate } from '../utils/goalHistory';

const API_URL = 'https://tarbiyah-production.up.railway.app';

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

// Static require map — Metro bundler requires all image paths to be literals
const ASSET_MAP = {
  'Nouman Ali Khan.png':              require('../../assets/Nouman Ali Khan.png'),
  'YAsmin-MOgahed.png':               require('../../assets/YAsmin-MOgahed.png'),
  'belal-assaad.jpg':                 require('../../assets/belal-assaad.jpg'),
  'national-inst-child-health.jpeg':  require('../../assets/national-inst-child-health.jpeg'),
  'childmind.png':                    require('../../assets/childmind.png'),
  'spiritual-insights.png':           require('../../assets/spiritual-insights.png'),
  'science-insights.png':             require('../../assets/science-insights.png'),
};

export default function HomeScreen({ navigation }) {
  const [dailyData, setDailyData]             = useState(fallbackData);
  const [loading, setLoading]                 = useState(true);
  const [spirReadWeek, setSpiritualReadWeek]  = useState([]);
  const [sciReadWeek,  setScientificReadWeek] = useState([]);
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      getWeekReadDays('spiritual').then(setSpiritualReadWeek);
      getWeekReadDays('scientific').then(setScientificReadWeek);

      // Fetch from API, fall back to local JSON on failure
      fetch(`${API_URL}/daily/preview`)
        .then(r => r.json())
        .then(data => {
          if (data.insights) {
            setDailyData(data);
            saveGoalsForDate(data.date, data.actionGoals ?? []);
          }
        })
        .catch(() => {
          // Network unavailable — keep using fallback data
          saveGoalsForDate(fallbackData.date, fallbackData.actionGoals ?? []);
        })
        .finally(() => setLoading(false));
    }, [])
  );

  const spiritualInsight = dailyData.insights.find(i => i.type === 'spiritual');
  const scienceInsight   = dailyData.insights.find(i => i.type === 'scientific');
  const actionGoals      = dailyData.actionGoals ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header Band ── */}
        <LinearGradient colors={['#F5F6F8', '#F5F6F8']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={[styles.headerBand, { paddingTop: insets.top + 16 }]}>
          <View style={styles.header}>
            <View>
              <Text style={styles.greetingSmall}>As-Salāmu ʿAlaykum</Text>
              <Text style={styles.greetingName}>Yusuf</Text>
            </View>
            <TouchableOpacity style={styles.notifBtn}>
              <Ionicons name="notifications-outline" size={20} color="#6B7280" />
              <View style={styles.notifBadge} />
            </TouchableOpacity>
          </View>
        </LinearGradient>


        <View style={styles.contentPad}>
        {/* ── Guidance for Today ── */}

        <View style={styles.sectionTitleWrap}>
          <Text style={styles.sectionTitle}>TODAY'S INSIGHTS</Text>
        </View>
        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#1B3D2F" />
          </View>
        )}

        <View style={styles.tipsRow}>
          {/* Spiritual Insight */}
          {spiritualInsight && (
            <TouchableOpacity
              style={styles.tipCard}
              activeOpacity={0.88}
              onPress={() => navigation.navigate('InsightDetail', { insight: spiritualInsight })}
            >
              <LinearGradient
                colors={['#6B7C45', '#1B3D2F']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.tipCardInner}
              >
                <View style={[styles.tipLabelWrap, styles.tipLabelWrapBlue]}>
                  <Text style={[styles.tipLabel, styles.tipLabelBlue]}>Spiritual Insight</Text>
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
                      <Text style={[styles.tipReadMoreText, styles.tipReadMoreBlue]}>Read more</Text>
                      <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.6)" />
                    </View>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Scientific Insight */}
          {scienceInsight && (
            <TouchableOpacity
              style={styles.tipCard}
              activeOpacity={0.88}
              onPress={() => navigation.navigate('InsightDetail', { insight: scienceInsight })}
            >
              <LinearGradient
                colors={['#D4A55A', '#A0521A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.tipCardInner}
              >
                <View style={[styles.tipLabelWrap, styles.tipLabelWrapAmber]}>
                  <Text style={[styles.tipLabel, styles.tipLabelAmber]}>Scientific Insight</Text>
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
                      <Text style={[styles.tipReadMoreText, styles.tipReadMoreAmber]}>Read more</Text>
                      <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.6)" />
                    </View>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Today's Action Goals ── */}

        <View style={styles.sectionTitleWrap}>
          <View style={styles.sectionUnderline} />
          <Text style={styles.sectionTitle}>TODAY'S ACTION GOALS</Text>
        </View>

        {actionGoals.map(goal => {
          const isSpiritual = goal.type === 'spiritual';
          const accentColor = isSpiritual ? '#2E7D62' : '#D4871A';
          return (
            <View
              key={goal.id}
              style={[
                styles.goalStandaloneCard,
                isSpiritual ? styles.goalStandaloneGreen : styles.goalStandaloneAmber,
              ]}
            >
              <View style={styles.checklistRow}>
                <View style={styles.checklistContent}>
                  <View style={styles.checklistMeta}>
                    <Ionicons
                      name={isSpiritual ? 'moon' : 'bulb-outline'}
                      size={12}
                      color={accentColor}
                    />
                    <Text style={[styles.checklistType, !isSpiritual && styles.checklistTypeAmber]}>
                      {goal.label}
                    </Text>
                  </View>
                  <Text style={styles.checklistText}>{goal.text}</Text>
                </View>
              </View>
            </View>
          );
        })}

        {/* ── This Week ── */}
        <View style={styles.sectionTitleWrap}>
          <Text style={styles.sectionTitle}>THIS WEEK</Text>
        </View>

        {/* Spiritual Card */}
        <View style={styles.streakCard}>
          <View style={styles.streakHeaderRow}>
            <Ionicons name="moon" size={13} color="#2E7D62" />
            <Text style={[styles.streakLabel, { color: '#2E7D62' }]}>Spiritual</Text>
          </View>
          <Text style={styles.streakSubLabel}>Days you read a spiritual insight</Text>
          <WeekRow days={spirReadWeek} color="#1B3D2F" todayColor="#D6EFE3" />
        </View>

        {/* Scientific Card */}
        <View style={[styles.streakCard, { marginTop: 10 }]}>
          <View style={styles.streakHeaderRow}>
            <Ionicons name="bulb-outline" size={13} color="#D4871A" />
            <Text style={[styles.streakLabel, { color: '#D4871A' }]}>Scientific</Text>
          </View>
          <Text style={styles.streakSubLabel}>Days you read a scientific insight</Text>
          <WeekRow days={sciReadWeek} color="#D4871A" todayColor="#FDE8C0" />
        </View>

        <View style={{ height: 24 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6F8' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 36 },
  contentPad: { paddingHorizontal: 20 },

  // ── Header ──
  headerBand: {
    paddingHorizontal: 22,
    paddingBottom: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  greetingSmall: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  greetingName: { fontSize: 26, fontWeight: '700', color: '#1B3D2F' },
  notifBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#D4871A',
    borderWidth: 1.5,
    borderColor: '#F5F6F8',
  },
  dateText: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '400' },

  // ── Section titles ──
  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1B3D2F',
    letterSpacing: 0.4,
  },

  loadingRow: { alignItems: 'center', marginBottom: 10 },

  // ── Insight cards ──
  tipsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
    alignItems: 'stretch',
  },
  tipCard: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  tipCardInner: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  tipLabelWrap: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  tipLabelWrapBlue:  {},
  tipLabelWrapAmber: {},
  tipLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.75)',
  },
  tipLabelBlue:  {},
  tipLabelAmber: {},
  tipByline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  bylineImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  bylineName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },
  tipBody: {
    flex: 1,
    padding: 14,
    justifyContent: 'space-between',
  },
  tipInsightTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 19,
    marginBottom: 8,
  },
  tipQuote: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 18,
  },
  tipFooterWrap: {
    marginTop: 12,
  },
  tipRule: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginBottom: 10,
  },
  tipReadMore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  tipReadMoreText: { fontSize: 11, fontWeight: '700' },
  tipReadMoreBlue:  { color: 'rgba(255,255,255,0.7)' },
  tipReadMoreAmber: { color: 'rgba(255,255,255,0.7)' },

  // ── Action Goals ──
  goalStandaloneCard: {
    borderRadius: 16,
    marginBottom: 10,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  goalStandaloneGreen: {
    borderLeftWidth: 4,
    borderLeftColor: '#2E7D62',
  },
  goalStandaloneAmber: {
    borderLeftWidth: 4,
    borderLeftColor: '#D4871A',
  },
  goalStandaloneGreenDone: { backgroundColor: '#F5FAF7' },
  goalStandaloneAmberDone: { backgroundColor: '#FDF8F2' },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    gap: 14,
  },
  checklistRowDone: {},
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#2E7D62',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  checkboxDone: { backgroundColor: '#2E7D62', borderColor: '#2E7D62' },
  checkboxAmber: { borderColor: '#D4871A' },
  checkboxAmberDone: { backgroundColor: '#D4871A', borderColor: '#D4871A' },
  checklistContent: { flex: 1 },
  checklistMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  checklistType: { fontSize: 11, fontWeight: '700', color: '#2E7D62', letterSpacing: 0.3 },
  checklistTypeAmber: { color: '#D4871A' },
  checklistText: { fontSize: 13, color: '#374151', lineHeight: 20 },
  checklistTextDone: { color: '#A0ADB8', textDecorationLine: 'line-through' },

  // ── Streak Card ──
  streakCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  streakHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  streakLabel: { fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },
  streakSubLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '500', marginBottom: 10, marginTop: -10 },
  trackRow: {
    marginBottom: 12,
  },
  trackRowLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
});
