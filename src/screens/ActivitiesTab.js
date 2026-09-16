import React, { useMemo, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
} from 'react-native';

const API_URL = 'https://tarbiyah-production.up.railway.app';
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

function getCompletedChildren(children) {
  return children.filter(child => {
    const areas = child.growthAreas ?? [];
    if (!areas.some(a => a?.plan?.length)) return false;
    return !areas.some(area => {
      if (!area?.plan?.length) return false;
      const daysSince = Math.floor((Date.now() - new Date(area.createdAt ?? Date.now()).getTime()) / 86400000);
      return daysSince < area.plan.length * 7;
    });
  });
}

function ChildCompletePlanCard({ fullChild, navigation }) {
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading]         = useState(false);

  const childName  = fullChild.name.split(' ')[0];
  const childColor = fullChild.color ?? '#2E7D62';
  const childPhoto = fullChild.photo ?? null;

  const lastCompleted = useMemo(() => {
    const completed = (fullChild.growthAreas ?? []).filter(area => {
      const daysSince = Math.floor((Date.now() - new Date(area.createdAt ?? Date.now()).getTime()) / 86400000);
      return area?.plan?.length && daysSince >= area.plan.length * 7;
    });
    return completed[completed.length - 1] ?? null;
  }, [fullChild]);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_URL}/suggest-growth-areas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        child: { name: fullChild.name, age: fullChild.age, gender: fullChild.gender, temperaments: fullChild.temperaments ?? [], interests: fullChild.interests ?? [], strengths: fullChild.strengths ?? [] },
        completedArea: lastCompleted ? { title: lastCompleted.title, issue: lastCompleted.issue, description: lastCompleted.description } : null,
        incidents: (fullChild.incidents ?? []).slice(-8).map(i => i.text).filter(Boolean),
      }),
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(({ suggestions: s }) => setSuggestions(s))
      .catch(() => {
        const taken = (fullChild.growthAreas ?? []).map(a => a.title?.toLowerCase());
        setSuggestions(
          ['Emotional regulation', 'Salah consistency', 'Quran memorisation', 'Gratitude practice', 'Kindness & empathy', 'Patience & self-control']
            .filter(s => !taken.some(t => t?.includes(s.toLowerCase().slice(0, 6)))).slice(0, 3)
        );
      })
      .finally(() => setLoading(false));
  }, [fullChild.id]);

  return (
    <View style={styles.habitCard}>
      <View style={styles.habitCardHeader}>
        <View style={[styles.habitChildPill, { backgroundColor: childColor + '18' }]}>
          <View style={[styles.habitAvatar, { backgroundColor: childColor }]}>
            {childPhoto
              ? <Image source={{ uri: childPhoto }} style={styles.habitAvatarImg} contentFit="cover" cachePolicy="memory-disk" />
              : <Text style={styles.habitAvatarInitial}>{childName[0]}</Text>
            }
          </View>
          <Text style={[styles.habitChildName, { color: childColor }]}>{childName}</Text>
        </View>
        <View style={styles.completeBadge}>
          <Text style={styles.completeBadgeText}>Plan complete</Text>
        </View>
      </View>

      <Text style={styles.completeTitle}>{childName} finished their growth plan</Text>

      {lastCompleted && (
        <TouchableOpacity
          style={styles.renewBtn}
          onPress={() => navigation.navigate('GrowthAreaWizard', { child: fullChild, isFirstTime: false, prefilledIssue: lastCompleted.issue ?? lastCompleted.title, replaceAreaId: lastCompleted.id })}
          activeOpacity={0.85}
        >
          <Ionicons name="refresh-outline" size={16} color="#2E7D62" />
          <View style={{ flex: 1 }}>
            <Text style={styles.renewBtnText}>Renew with a new approach</Text>
            <Text style={styles.renewBtnSub} numberOfLines={1} ellipsizeMode="tail">{lastCompleted.title}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#2E7D62" />
        </TouchableOpacity>
      )}

      {lastCompleted && <Text style={styles.suggestSeparatorLabel}>OR TRY SOMETHING NEW</Text>}

      <View style={styles.suggestListWrap}>
        {loading ? (
          <View style={styles.suggestLoading}>
            <ActivityIndicator size="small" color={childColor} />
            <Text style={styles.suggestLoadingText}>Personalising suggestions…</Text>
          </View>
        ) : (suggestions ?? []).map(s => (
          <TouchableOpacity
            key={s}
            style={styles.suggestChip}
            onPress={() => navigation.navigate('GrowthAreaWizard', { child: fullChild, isFirstTime: false, prefilledIssue: s })}
            activeOpacity={0.8}
          >
            <Ionicons name="leaf-outline" size={14} color="#2E7D62" />
            <Text style={styles.suggestChipText}>{s}</Text>
            <Ionicons name="chevron-forward" size={14} color="#9CA3AF" />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function ChildHabitCard({ child, fullChild, navigation, onOpenChildDashboard }) {
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
                <View style={styles.habitInfoBox}>
                  <View style={styles.habitInfoRow}>
                    <View style={[styles.habitInfoIcon, { backgroundColor: child.childColor + '25' }]}>
                      <Text style={{ fontSize: 20 }}>🎯</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.habitInfoEyebrow, { color: child.childColor }]}>GROWTH ACTIVITY</Text>
                      <Text style={styles.habitInfoText}>{habit.text}</Text>
                    </View>
                  </View>
                  {habit.wisdom ? (
                    <>
                      <View style={styles.habitInfoDivider} />
                      <View style={styles.habitInfoRow}>
                        <View style={[styles.habitInfoIcon, { backgroundColor: 'rgba(0,0,0,0.06)' }]}>
                          <Text style={{ fontSize: 20 }}>📖</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.habitInfoEyebrow}>THE WISDOM</Text>
                          <Text style={styles.habitInfoText}>{habit.wisdom}</Text>
                        </View>
                      </View>
                    </>
                  ) : null}
                </View>
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
        onPress={() => onOpenChildDashboard ? onOpenChildDashboard(child.childId) : fullChild && navigation.navigate('ChildDashboard', { child: fullChild })}
      >
        Log on their dashboard →
      </Text>
    </View>
  );
}

export default function ActivitiesTab({ navigation, familyGoals = [], children = [], onOpenChildDashboard }) {
  const insets = useSafeAreaInsets();

  const dayIdx = new Date().getDay(); // 0–6
  const growthHabits       = useMemo(() => getChildHabits(children), [children]);
  const completedChildren  = useMemo(() => getCompletedChildren(children), [children]);

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
            <ChildHabitCard
              key={child.childId}
              child={child}
              fullChild={children.find(c => c.id === child.childId)}
              navigation={navigation}
              onOpenChildDashboard={onOpenChildDashboard}
            />
          ))
        : completedChildren.length === 0 && (
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
              onPress={() => children.length > 0
                ? navigation.navigate('GrowthAreaWizard', { child: children[0], isFirstTime: true })
                : navigation.navigate('AddChildWizard')}
              activeOpacity={0.85}
            >
              <Ionicons name={children.length > 0 ? 'leaf-outline' : 'person-add-outline'} size={15} color="#FFFFFF" />
              <Text style={styles.growthPlaceholderBtnText}>{children.length > 0 ? 'Start a Growth Plan' : 'Add a Child & Growth Plan'}</Text>
            </TouchableOpacity>
          </View>
        )
      }
      {completedChildren.map(child => (
        <ChildCompletePlanCard
          key={child.id}
          fullChild={child}
          navigation={navigation}
        />
      ))}

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
  habitInfoBox:       { marginBottom: 4 },
  habitInfoRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  habitInfoIcon:      { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  habitInfoEyebrow:   { fontSize: 10, fontWeight: '700', color: '#2E7D62', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 },
  habitInfoText:      { fontSize: 14, color: '#1B3D2F', lineHeight: 21 },
  habitInfoDivider:   { height: 1, backgroundColor: 'rgba(0,0,0,0.07)', marginVertical: 14 },
  habitDots:          { flexDirection: 'row', gap: 5, justifyContent: 'center', marginTop: 10, marginBottom: 12 },
  habitDot:           { width: 6, height: 6, borderRadius: 3 },
  habitDotActive:     { width: 16, borderRadius: 3 },
  habitLogLink:       { fontSize: 12, fontWeight: '600', color: '#2E7D62', textAlign: 'right' },

  // Complete-plan card
  completeBadge:      { backgroundColor: '#EDF7F2', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  completeBadgeText:  { fontSize: 10, fontWeight: '700', color: '#2E7D62', letterSpacing: 0.5, textTransform: 'uppercase' },
  completeTitle:      { fontSize: 14, fontWeight: '700', color: '#1B3D2F', marginBottom: 4, marginTop: 12 },
  completeSub:        { fontSize: 13, color: '#6B7280', lineHeight: 19, marginBottom: 14 },
  renewBtn:            { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#EDF7F2', borderRadius: 12, padding: 12, marginBottom: 10 },
  renewBtnText:        { fontSize: 13, fontWeight: '700', color: '#2E7D62' },
  renewBtnSub:         { fontSize: 11, color: '#6B7280', marginTop: 1 },
  suggestSeparatorLabel: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', textAlign: 'center', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 },
  suggestListWrap:     { gap: 8 },
  suggestLoading:      { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingVertical: 8 },
  suggestLoadingText:  { fontSize: 12, color: '#9CA3AF' },
  suggestChip:         { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F0F9F5', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  suggestChipText:     { flex: 1, fontSize: 13, fontWeight: '600', color: '#1A1A2E' },

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
