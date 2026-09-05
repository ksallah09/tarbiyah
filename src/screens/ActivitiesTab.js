import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getGoalEmoji } from '../utils/familyGoals';

const DISCUSSION_PROMPTS = [
  "If you could give sadaqah today, what would you give?",
  "What is one thing you're grateful to Allah for this week?",
  "What would the Prophet ﷺ do if he saw our family right now?",
  "What does tawakkul — trusting Allah — feel like in real life?",
  "Who outside our family can we make du'a for today?",
  "What's one good deed you did today that no one noticed?",
  "If you could visit any prophet's time, which would you choose and why?",
  "What does it mean to have a good heart?",
  "How can we show kindness to someone who hurt us?",
  "What's something hard you're patient about right now?",
  "What's one thing our family does well together?",
  "If Allah gave you one gift today, what would you ask for?",
  "What story from the Qur'an do you want to know more about?",
  "How do you feel after praying? Does it change your mood?",
];

const DUA_OF_WEEK = {
  arabic:          'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً',
  transliteration: 'Rabbana atina fid-dunya hasanah wa fil-akhirati hasanah',
  meaning:         'Our Lord, grant us good in this world and good in the Hereafter',
};

const SEERAH_STORIES = [
  "The Day Yunus Called from the Whale",
  "How Ibrahim Smashed the Idols",
  "Yusuf and the Test of Patience",
  "The Night of the Hijrah",
  "Bilal's Unbreakable Faith",
  "Maryam and the Miracle of the Date Palm",
  "The Year of Grief — and What Came After",
];

const DAY_INDEX = new Date().getDay();

function getChildHabits(children) {
  const results = [];
  for (const child of children) {
    const habits = [];
    for (const area of (child.growthAreas ?? []).slice(0, 3)) {
      if (!area?.plan?.length) continue;
      const daysSince = Math.floor((Date.now() - new Date(area.createdAt ?? Date.now()).getTime()) / 86400000);
      if (daysSince >= area.plan.length * 7) continue;
      const week = area.plan[Math.floor(daysSince / 7)];
      for (const activity of (week?.activities ?? [])) {
        habits.push({ text: activity.text, wisdom: activity.wisdom ?? null });
      }
    }
    if (!habits.length) continue;
    results.push({
      childId:    child.id,
      childName:  child.name.split(' ')[0],
      childColor: child.color ?? '#2E7D62',
      childPhoto: child.photo ?? null,
      habits,
    });
  }
  return results;
}

function ChildHabitCard({ child, navigation }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [slideWidth, setSlideWidth] = useState(0);
  const single = child.habits.length === 1;

  return (
    <View style={styles.habitCard}>
      <View style={styles.habitCardHeader}>
        <View style={[styles.habitChildPill, { backgroundColor: child.childColor + '18' }]}>
          <View style={[styles.habitAvatar, { backgroundColor: child.childColor }]}>
            {child.childPhoto
              ? <Image source={{ uri: child.childPhoto }} style={styles.habitAvatarImg} contentFit="cover" cachePolicy="memory-disk" />
              : <Text style={styles.habitAvatarInitial}>{child.childName[0]}</Text>
            }
          </View>
          <Text style={[styles.habitChildName, { color: child.childColor }]}>{child.childName}</Text>
        </View>
        {!single && (
          <Text style={styles.habitPageCount}>{activeIdx + 1} / {child.habits.length}</Text>
        )}
      </View>

      <View
        onLayout={e => setSlideWidth(e.nativeEvent.layout.width)}
        style={styles.habitCarousel}
      >
        {slideWidth > 0 && (
          <ScrollView
            horizontal
            pagingEnabled
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={e =>
              setActiveIdx(Math.round(e.nativeEvent.contentOffset.x / slideWidth))
            }
          >
            {child.habits.map((habit, i) => (
              <View key={i} style={{ width: slideWidth }}>
                <View style={styles.habitRow}>
                  <View style={[styles.habitIconCircle, { backgroundColor: child.childColor + '18' }]}>
                    <Text style={{ fontSize: 20 }}>🎯</Text>
                  </View>
                  <Text style={styles.habitText}>{habit.text}</Text>
                </View>
                {habit.wisdom ? (
                  <View style={styles.habitWisdom}>
                    <Ionicons name="chatbubble-ellipses-outline" size={14} color="#2E7D62" style={{ flexShrink: 0, marginTop: 1 }} />
                    <Text style={styles.habitWisdomText}>{habit.wisdom}</Text>
                  </View>
                ) : null}
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      {!single && (
        <View style={styles.habitDots}>
          {child.habits.map((_, i) => (
            <View key={i} style={[styles.habitDot, i === activeIdx && styles.habitDotActive, { backgroundColor: i === activeIdx ? child.childColor : '#E5E7EB' }]} />
          ))}
        </View>
      )}

      <Text
        style={styles.habitLogLink}
        onPress={() => navigation.navigate('Tabs', { screen: 'Dashboards', params: { childId: child.childId } })}
      >
        Log on their dashboard →
      </Text>
    </View>
  );
}

export default function ActivitiesTab({ navigation, familyGoals = [], children = [] }) {
  const insets = useSafeAreaInsets();

  const dayIdx = new Date().getDay(); // 0–6
  const growthHabits = useMemo(() => getChildHabits(children), [children]);

  const todayPrompt = DISCUSSION_PROMPTS[dayIdx % DISCUSSION_PROMPTS.length];
  const todayStory  = SEERAH_STORIES[dayIdx % SEERAH_STORIES.length];

  // Featured: pick a family goal to highlight today, cycling by day
  const featuredGoal = useMemo(() => {
    if (!familyGoals.length) return null;
    return familyGoals[dayIdx % familyGoals.length];
  }, [familyGoals, dayIdx]);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      showsVerticalScrollIndicator={false}
    >

      {/* ── Games ────────────────────────────────────────────────────── */}
      <View style={styles.sectionRow}>
        <View style={styles.sectionTitleWrap}>
          <Text style={styles.sectionEyebrow}>PLAY TOGETHER</Text>
          <Text style={styles.sectionTitle}>Family Games</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('GamesHub')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.sectionLink}>See all</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gamesScroll} contentContainerStyle={styles.gamesRow}>
        <TouchableOpacity style={[styles.gameCard, { backgroundColor: '#1B3D2F' }]} activeOpacity={0.85} onPress={() => navigation.navigate('HeadsUpSplash', { gameId: 'headsup' })}>
          <Text style={styles.gameEmoji}>🎭</Text>
          <Text style={[styles.gameName, { color: '#FFFFFF' }]}>Islamic Heads Up</Text>
          <Text style={[styles.gamePlayers, { color: 'rgba(255,255,255,0.45)', marginBottom: 10 }]}>Multiplayer · Teams</Text>
          <View style={[styles.gameBtn, { backgroundColor: '#D4A843' }]}><Text style={[styles.gameBtnText, { color: '#1B3D2F' }]}>Play</Text></View>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.gameCard, { backgroundColor: '#1B2A20' }]} activeOpacity={0.85} onPress={() => navigation.navigate('QuranSplash', { gameId: 'quran' })}>
          <Text style={styles.gameEmoji}>📖</Text>
          <Text style={[styles.gameName, { color: '#FFFFFF' }]}>Next Ayah</Text>
          <Text style={[styles.gamePlayers, { color: 'rgba(255,255,255,0.45)', marginBottom: 10 }]}>Multiplayer · Teams</Text>
          <View style={[styles.gameBtn, { backgroundColor: '#4ADE80' }]}><Text style={[styles.gameBtnText, { color: '#1B2A20' }]}>Play</Text></View>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Conversation Cards ───────────────────────────────────────── */}
      <View style={[styles.sectionTitleWrap, { marginTop: 8 }]}>
        <Text style={styles.sectionEyebrow}>DISCUSS & CONNECT</Text>
        <Text style={styles.sectionTitle}>Conversation Cards</Text>
      </View>
      <TouchableOpacity style={styles.convoCard} activeOpacity={0.85} onPress={() => navigation.navigate('ConversationCards')}>
        <View style={styles.convoLeft}>
          <Text style={styles.convoEmoji}>💬</Text>
          <View>
            <Text style={styles.convoTitle}>Start a conversation</Text>
            <Text style={styles.convoSub}>After prayer · At dinner · In the car · Before bed</Text>
          </View>
        </View>
        <View style={styles.convoArrow}>
          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
        </View>
      </TouchableOpacity>

      {/* ── Growth Activities ────────────────────────────────────────── */}
      <View style={[styles.sectionTitleWrap, { marginTop: 8 }]}>
        <Text style={styles.sectionEyebrow}>FROM THEIR PLAN</Text>
        <Text style={styles.sectionTitle}>Growth Activities</Text>
      </View>
      {growthHabits.length > 0
        ? growthHabits.map(child => (
            <ChildHabitCard key={child.childId} child={child} navigation={navigation} />
          ))
        : (
          <View style={styles.growthPlaceholder}>
            <Text style={styles.growthPlaceholderEmoji}>🎯</Text>
            <Text style={styles.growthPlaceholderTitle}>
              {children.length === 0
                ? "Start your family's growth journey"
                : 'No activities this week yet'}
            </Text>
            <Text style={styles.growthPlaceholderBody}>
              {children.length === 0
                ? "Add a child and create their personalised growth plan — Tarbiyah will surface their weekly activities right here."
                : "Open a child's dashboard and create their growth plan to see personalised activities here each week."}
            </Text>
            <TouchableOpacity
              style={styles.growthPlaceholderBtn}
              onPress={() => navigation.navigate('AddChildWizard')}
              activeOpacity={0.85}
            >
              <Ionicons name="person-add-outline" size={15} color="#FFFFFF" />
              <Text style={styles.growthPlaceholderBtnText}>Add a Child & Growth Plan</Text>
            </TouchableOpacity>
          </View>
        )
      }

      {/* ── Family Goals ─────────────────────────────────────────────── */}
      {familyGoals.length > 0 && (
        <>
          <View style={[styles.sectionTitleWrap, { marginTop: 8 }]}>
            <Text style={styles.sectionEyebrow}>THIS WEEK</Text>
            <Text style={styles.sectionTitle}>From Your Goals</Text>
          </View>
          {familyGoals.map(goal => (
            <View key={goal.id} style={styles.goalCard}>
              <View style={[styles.goalIconWrap, { backgroundColor: (goal.iconColor ?? '#2E7D62') + '22' }]}>
                <Text style={styles.goalIcon}>{getGoalEmoji(goal)}</Text>
              </View>
              <View style={styles.goalBody}>
                <Text style={styles.goalTitle}>{goal.title}</Text>
                <Text style={styles.goalFreq}>{goal.frequencyLabel ?? ''}</Text>
              </View>
            </View>
          ))}
        </>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#F7F8FA' },
  content: { paddingHorizontal: 20, paddingTop: 8 },

  sectionRow:      { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitleWrap:{ paddingTop: 16, marginBottom: 14 },
  sectionEyebrow:  { fontSize: 10, fontWeight: '700', color: '#2E7D62', letterSpacing: 1, marginBottom: 2 },
  sectionTitle:    { fontSize: 20, fontWeight: '800', color: '#1B3D2F' },
  sectionLink:     { fontSize: 13, fontWeight: '600', color: '#2E7D62', paddingBottom: 2 },

  // Featured
  featuredCard: {
    backgroundColor: '#1B3D2F', borderRadius: 20, padding: 20, marginBottom: 24,
  },
  featuredPillRow: { marginBottom: 12 },
  featuredPill: {
    alignSelf: 'flex-start', backgroundColor: '#D4A843',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3,
  },
  featuredPillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.06, color: '#1B3D2F' },
  featuredEmoji:    { fontSize: 32, marginBottom: 8 },
  featuredTitle:    { fontSize: 18, fontWeight: '700', color: '#FFFFFF', lineHeight: 26, marginBottom: 6 },
  featuredSub:      { fontSize: 13, color: 'rgba(255,255,255,0.5)' },

  // Games
  gamesScroll: { marginHorizontal: -20, marginBottom: 0 },
  gamesRow:    { paddingHorizontal: 20, gap: 12, flexDirection: 'row' },
  gameCard: {
    width: 180, borderRadius: 16, padding: 16,
    flexDirection: 'column', justifyContent: 'space-between',
  },
  gameEmoji:   { fontSize: 26, marginBottom: 8 },
  gameName:    { fontSize: 14, fontWeight: '700', color: '#1A1A2E', marginBottom: 2 },
  gamePlayers: { fontSize: 11, color: '#9CA3AF' },
  gameBtn:     { backgroundColor: '#EDF7F2', borderRadius: 8, paddingVertical: 7, alignItems: 'center' },
  gameBtnText: { fontSize: 12, fontWeight: '700', color: '#1B3D2F' },

  // Goals
  goalCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#EAECEE', marginBottom: 10,
  },
  goalIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  goalIcon:     { fontSize: 20 },
  goalBody:     { flex: 1 },
  goalTitle:    { fontSize: 14, fontWeight: '600', color: '#1A1A2E', marginBottom: 2 },
  goalFreq:     { fontSize: 12, color: '#9CA3AF' },
  goalDo:       {},
  goalDoText:   { fontSize: 13, fontWeight: '600', color: '#2E7D62' },

  // Conversation Cards
  convoCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#1B3D2F', borderRadius: 16, padding: 16,
  },
  convoLeft:  { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  convoEmoji: { fontSize: 28 },
  convoTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', marginBottom: 2 },
  convoSub:   { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  convoArrow: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },

  // Growth habit cards
  habitCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#EAECEE', marginBottom: 10,
  },
  habitCardHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  habitChildPill:     { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  habitAvatar:        { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  habitAvatarImg:     { width: 22, height: 22, borderRadius: 11 },
  habitAvatarInitial: { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },
  habitChildName:     { fontSize: 12, fontWeight: '700' },
  habitPageCount:     { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  habitCarousel:      { overflow: 'hidden' },
  habitRow:           { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  habitIconCircle:    { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  habitText:          { flex: 1, fontSize: 14, fontWeight: '500', color: '#1B3D2F', lineHeight: 21 },
  habitWisdom:        { flexDirection: 'row', gap: 8, backgroundColor: '#F0FAF5', borderRadius: 10, padding: 10, marginBottom: 12 },
  habitWisdomText:    { flex: 1, fontSize: 13, color: '#374151', lineHeight: 20 },
  habitDots:          { flexDirection: 'row', gap: 5, justifyContent: 'center', marginTop: 10, marginBottom: 12 },
  habitDot:           { width: 6, height: 6, borderRadius: 3 },
  habitDotActive:     { width: 16, borderRadius: 3 },
  habitLogLink:       { fontSize: 12, fontWeight: '600', color: '#2E7D62', textAlign: 'right' },

  // Growth placeholder
  growthPlaceholder: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: '#EAECEE', alignItems: 'center', marginBottom: 10,
  },
  growthPlaceholderEmoji: { fontSize: 36, marginBottom: 12 },
  growthPlaceholderTitle: {
    fontSize: 15, fontWeight: '700', color: '#1B3D2F',
    textAlign: 'center', marginBottom: 8,
  },
  growthPlaceholderBody: {
    fontSize: 13, color: '#6B7280', lineHeight: 20,
    textAlign: 'center', marginBottom: 20, paddingHorizontal: 8,
  },
  growthPlaceholderBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#1B3D2F', borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 12,
  },
  growthPlaceholderBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  // Quick grid
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickCard: {
    width: '47.5%', backgroundColor: '#FFFFFF', borderRadius: 16,
    padding: 14, borderWidth: 1, borderColor: '#EAECEE',
  },
  quickGold: { backgroundColor: '#FBF4DE', borderColor: 'rgba(212,168,67,0.25)' },
  quickIcon:   { fontSize: 22, marginBottom: 8 },
  quickLabel:  { fontSize: 9, fontWeight: '700', letterSpacing: 0.08, color: '#9CA3AF', marginBottom: 4, textTransform: 'uppercase' },
  quickTitle:  { fontSize: 13, fontWeight: '600', color: '#1A1A2E', lineHeight: 18 },
  quickArabic: { fontSize: 12, color: '#8A6010', marginTop: 4, textAlign: 'right', fontStyle: 'italic' },
});
