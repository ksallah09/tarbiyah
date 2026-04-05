import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { getMonthReadDays, getStreak } from '../utils/readInsights';
import { getRecentGoals } from '../utils/goalHistory';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function formatGoalDate(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  const diffDays = Math.round((today - d) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7)   return DAY_NAMES[d.getDay()];
  return dateStr;
}

function MonthGrid({ days, color, todayColor }) {
  return (
    <View style={gridStyles.grid}>
      {days.map(d => (
        <View
          key={d.day}
          style={[
            gridStyles.dot,
            d.completed && { backgroundColor: color },
            d.today && !d.completed && { backgroundColor: todayColor, borderColor: color, borderWidth: 1.5 },
            d.future && gridStyles.dotFuture,
          ]}
        >
          {d.today && !d.completed
            ? <Text style={[gridStyles.dotNum, { color, fontWeight: '700' }]}>{d.day}</Text>
            : !d.completed && !d.future
              ? <Text style={gridStyles.dotNum}>{d.day}</Text>
              : d.completed
                ? <Ionicons name="checkmark" size={10} color="#FFF" />
                : null
          }
        </View>
      ))}
    </View>
  );
}

const gridStyles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F0F1F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotFuture: { backgroundColor: '#F7F8F9' },
  dotNum: { fontSize: 10, fontWeight: '600', color: '#9CA3AF' },
});

export default function ProgressScreen() {
  const [spirMonth,  setSpiritualMonth]   = useState([]);
  const [sciMonth,   setScientificMonth]  = useState([]);
  const [spirStreak, setSpiritualStreak]  = useState(0);
  const [sciStreak,  setScientificStreak] = useState(0);
  const [spirGoals,  setSpiritualGoals]   = useState([]);
  const [sciGoals,   setScientificGoals]  = useState([]);

  const now = new Date();
  const monthLabel = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;

  useFocusEffect(
    useCallback(() => {
      getMonthReadDays('spiritual').then(setSpiritualMonth);
      getMonthReadDays('scientific').then(setScientificMonth);
      getStreak('spiritual').then(setSpiritualStreak);
      getStreak('scientific').then(setScientificStreak);
      getRecentGoals('spiritual', 3).then(setSpiritualGoals);
      getRecentGoals('scientific', 3).then(setScientificGoals);
    }, [])
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <Text style={styles.title}>Progress</Text>
          <Text style={styles.subtitle}>Track your daily reading consistency</Text>
        </View>

        {/* ── Streaks ── */}
        <Text style={styles.sectionTitle}>STREAKS</Text>
        <View style={styles.streaksRow}>
          <View style={[styles.streakCard, { borderTopColor: '#2E7D62' }]}>
            <View style={styles.streakIconRow}>
              <Ionicons name="moon" size={13} color="#2E7D62" />
              <Text style={[styles.streakTypeLabel, { color: '#2E7D62' }]}>Spiritual</Text>
            </View>
            <Text style={[styles.streakBigNum, { color: '#1B3D2F' }]}>{spirStreak}</Text>
            <View style={styles.streakFooter}>
              <Ionicons name="flame" size={12} color="#2E7D62" />
              <Text style={styles.streakFooterText}>day streak</Text>
            </View>
          </View>

          <View style={[styles.streakCard, { borderTopColor: '#D4871A' }]}>
            <View style={styles.streakIconRow}>
              <Ionicons name="bulb-outline" size={13} color="#D4871A" />
              <Text style={[styles.streakTypeLabel, { color: '#D4871A' }]}>Scientific</Text>
            </View>
            <Text style={[styles.streakBigNum, { color: '#A0521A' }]}>{sciStreak}</Text>
            <View style={styles.streakFooter}>
              <Ionicons name="flame" size={12} color="#D4871A" />
              <Text style={styles.streakFooterText}>day streak</Text>
            </View>
          </View>
        </View>

        {/* ── This Month ── */}
        <Text style={styles.sectionTitle}>THIS MONTH</Text>

        {/* Spiritual month */}
        <View style={styles.trackCard}>
          <View style={styles.cardTopRow}>
            <View style={styles.labelRow}>
              <Ionicons name="moon" size={13} color="#2E7D62" />
              <Text style={[styles.cardLabel, { color: '#2E7D62' }]}>Spiritual</Text>
            </View>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
          </View>
          <Text style={styles.subLabel}>Days you read a spiritual insight</Text>
          <MonthGrid days={spirMonth} color="#1B3D2F" todayColor="#D6EFE3" />
        </View>

        {/* Scientific month */}
        <View style={[styles.trackCard, { marginTop: 12 }]}>
          <View style={styles.cardTopRow}>
            <View style={styles.labelRow}>
              <Ionicons name="bulb-outline" size={13} color="#D4871A" />
              <Text style={[styles.cardLabel, { color: '#D4871A' }]}>Scientific</Text>
            </View>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
          </View>
          <Text style={styles.subLabel}>Days you read a scientific insight</Text>
          <MonthGrid days={sciMonth} color="#D4871A" todayColor="#FDE8C0" />
        </View>

        {/* ── Recent Goals ── */}
        <Text style={[styles.sectionTitle, { marginTop: 28 }]}>RECENT GOALS</Text>

        {spirGoals.length > 0 && (
          <>
            <View style={styles.goalGroupHeader}>
              <Ionicons name="moon" size={12} color="#2E7D62" />
              <Text style={[styles.goalGroupLabel, { color: '#2E7D62' }]}>Spiritual</Text>
            </View>
            {spirGoals.map((g, i) => (
              <View key={g.id ?? i} style={[styles.goalCard, styles.goalCardGreen]}>
                <Text style={styles.goalDate}>{formatGoalDate(g.date)}</Text>
                <Text style={styles.goalText}>{g.text}</Text>
              </View>
            ))}
          </>
        )}

        {sciGoals.length > 0 && (
          <>
            <View style={[styles.goalGroupHeader, { marginTop: spirGoals.length > 0 ? 16 : 0 }]}>
              <Ionicons name="bulb-outline" size={12} color="#D4871A" />
              <Text style={[styles.goalGroupLabel, { color: '#D4871A' }]}>Scientific</Text>
            </View>
            {sciGoals.map((g, i) => (
              <View key={g.id ?? i} style={[styles.goalCard, styles.goalCardAmber]}>
                <Text style={styles.goalDate}>{formatGoalDate(g.date)}</Text>
                <Text style={styles.goalText}>{g.text}</Text>
              </View>
            ))}
          </>
        )}

        {spirGoals.length === 0 && sciGoals.length === 0 && (
          <View style={styles.emptyGoals}>
            <Text style={styles.emptyGoalsText}>No goals yet — open the app daily to build your history.</Text>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6F8' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8 },

  header: { marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '700', color: '#1B3D2F', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },

  // ── Streak cards ──
  streaksRow: { flexDirection: 'row', gap: 12, marginBottom: 28 },
  streakCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderTopWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  streakIconRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  streakTypeLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  streakBigNum: { fontSize: 38, fontWeight: '800', lineHeight: 42, marginBottom: 6 },
  streakFooter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  streakFooterText: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },

  // ── Section title ──
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1B3D2F',
    letterSpacing: 0.4,
    marginBottom: 14,
  },

  // ── Month tracker cards ──
  trackCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardLabel: { fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },
  monthLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  subLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '500', marginBottom: 14 },

  // ── Recent Goals ──
  goalGroupHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  goalGroupLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  goalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  goalCardGreen: { borderLeftWidth: 3, borderLeftColor: '#2E7D62' },
  goalCardAmber: { borderLeftWidth: 3, borderLeftColor: '#D4871A' },
  goalDate: { fontSize: 10, color: '#9CA3AF', fontWeight: '600', marginBottom: 4 },
  goalText: { fontSize: 13, color: '#374151', lineHeight: 20 },
  emptyGoals: { paddingVertical: 20, alignItems: 'center' },
  emptyGoalsText: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },
});
