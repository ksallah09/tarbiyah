import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Animated, Image, ImageBackground, ActivityIndicator,
  Dimensions, Modal, TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
const ACTIVITY_CARD_WIDTH = SCREEN_WIDTH - 40; // content area width (20px padding each side)
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import { getAllChildProfiles, syncChildProfilesFromSupabase, updateChildProfile } from '../utils/childProfiles';
import { logCompletion } from '../utils/childCompletions';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Developmental phase data ──────────────────────────────────────────────────

const DEV_PHASES = [
  {
    range: [3, 5],
    emoji: '🧩',
    phase: 'Foundation & Co-Regulation',
    shift: 'From control → guiding & modeling',
    keyInsight: 'My child cannot regulate themselves yet — they borrow my calm.',
    developing: ['Language explosion', 'Emotional expression (but low control)', 'Imagination & pretend play', 'Early social skills'],
    brainReality: 'Very limited self-regulation. Heavily dependent on the parent for co-regulation — your calm is their calm.',
  },
  {
    range: [6, 8],
    emoji: '🧱',
    phase: 'Structure & Skill-Building',
    shift: 'From constant supervision → consistent structure',
    keyInsight: 'They understand rules — but still need help applying them consistently.',
    developing: ['Rule-following', 'Basic impulse control', 'Forming friendships', 'Early sense of responsibility'],
    brainReality: 'Executive function is emerging but still fragile. Repetition and predictable structure are what build new habits at this stage.',
  },
  {
    range: [9, 11],
    emoji: '🌱',
    phase: 'Self-Management & Identity Seeds',
    shift: 'From instruction → coaching & connection',
    keyInsight: "This is the last window where your influence is high before the teenage shift begins.",
    developing: ['Growing independence', 'Peer awareness & social comparison', 'Moral reasoning', 'Self-esteem formation'],
    brainReality: 'Better emotional control — but still inconsistent. Increasingly sensitive to how they compare to peers. Connection matters more than correction here.',
  },
  {
    range: [12, 14],
    emoji: '⚡',
    phase: 'Emotional Surge & Identity Formation',
    shift: 'From authority → relationship & guidance',
    keyInsight: 'Big reactions are normal — this is a brain transition phase, not a character flaw.',
    developing: ['Strong, fast-moving emotions', 'Identity questions', 'Peer influence peak', 'Abstract thinking beginning'],
    brainReality: "The emotional centre (amygdala) is highly active while the logical control system is still developing. They feel before they think — that's biology, not defiance.",
  },
  {
    range: [15, 17],
    emoji: '🧭',
    phase: 'Autonomy & Decision-Making',
    shift: 'From managing → mentoring',
    keyInsight: 'They need trust, responsibility, and your guidance — not control.',
    developing: ['Long-term thinking', 'Values and identity solidifying', 'Drive for independence', 'Risk evaluation (still maturing)'],
    brainReality: 'Executive function is improving but still vulnerable to impulsive decisions under pressure. Relationship quality now determines how much influence you keep.',
  },
  {
    range: [18, 25],
    emoji: '🧩',
    phase: 'Identity Consolidation & Life Direction',
    shift: 'From guidance → consultation',
    keyInsight: 'My child is now building their identity — and needs room, but also support.',
    developing: ['Identity (Who am I really?)', 'Beliefs and values (often re-evaluated)', 'Career direction & purpose', 'Relationships and marriage readiness', 'Financial and emotional independence'],
    brainReality: 'The prefrontal cortex is still developing — impulse control and long-term planning are improving but not yet fully stable. Risk-taking can still occur, especially in social contexts. You are no longer a manager or enforcer — you are an advisor, safe space, and anchor.',
  },
];

function getDevPhase(age) {
  if (!age || isNaN(age)) return null;
  return DEV_PHASES.find(p => age >= p.range[0] && age <= p.range[1]) ?? null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CARD_SHADOW = {
  shadowColor: '#1B3D2F',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 10,
  elevation: 4,
};

const MOTIVATIONAL = [
  "MashaAllah! Keep it up.",
  "Barakallahu feek — wonderful effort.",
  "MashaAllah, you're showing up for your child.",
  "Alhamdulillah — consistency is the key.",
  "MashaAllah! Every small step counts.",
];

function ordinal(n) {
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function formatDate(date) {
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const year  = date.getFullYear();
  return `${month} ${ordinal(date.getDate())}, ${year}`;
}

function motivationalMsg(key) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return MOTIVATIONAL[Math.abs(hash) % MOTIVATIONAL.length];
}

function getCurrentWeekContent(area) {
  if (!area?.plan?.length) return null;
  const daysSince = Math.floor((Date.now() - new Date(area.createdAt ?? Date.now()).getTime()) / 86400000);
  const weekIdx = Math.min(Math.floor(daysSince / 7), area.plan.length - 1);
  return area.plan[Math.max(0, weekIdx)];
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function DashboardsScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const [children, setChildren] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [activeChildId, setActiveChildId] = useState(null);
  const [activeAreaIndex, setActiveAreaIndex]       = useState(0);
  const [expandedAreas, setExpandedAreas]           = useState(new Set());
  const [expandedWisdom, setExpandedWisdom]         = useState(new Set());
  const [markedDone, setMarkedDone]                 = useState(new Set());
  const [expandedTimeHabits, setExpandedTimeHabits] = useState(new Set());
  const [activityPages, setActivityPages]           = useState({});
  const [completionCounts, setCompletionCounts]     = useState({});
  const [phaseExpanded,        setPhaseExpanded]        = useState(false);
  const [winModalVisible,      setWinModalVisible]      = useState(false);
  const [incidentModalVisible, setIncidentModalVisible] = useState(false);
  const [winText,      setWinText]      = useState('');
  const [incidentText, setIncidentText] = useState('');
  const [coachingResponses, setCoachingResponses] = useState({});
  const [coachingLoading,   setCoachingLoading]   = useState(new Set());
  const fadeAnim  = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef(null);

  useFocusEffect(useCallback(() => {
    const requestedId = route?.params?.childId ?? null;
    getAllChildProfiles().then(profiles => {
      setChildren(profiles);
      setLoaded(true);
      setActiveChildId(prev => {
        if (requestedId && profiles.find(c => c.id === requestedId)) return requestedId;
        if (prev && profiles.find(c => c.id === prev)) return prev;
        return profiles[0]?.id ?? null;
      });
    });
    syncChildProfilesFromSupabase().then(() =>
      getAllChildProfiles().then(profiles => {
        setChildren(profiles);
        setActiveChildId(prev => {
          if (requestedId && profiles.find(c => c.id === requestedId)) return requestedId;
          if (prev && profiles.find(c => c.id === prev)) return prev;
          return profiles[0]?.id ?? null;
        });
      })
    );
  }, [route?.params?.childId]));

  const child = children.find(c => c.id === activeChildId) ?? children[0];
  const displayName = child ? (child.name.length > 12 ? child.name.slice(0, 12).trimEnd() + '…' : child.name) : '';

  const rawGrowthAreas = child?.growthAreas ?? [];
  const focusAreas = rawGrowthAreas.slice(0, 3).map(area => {
    const week = getCurrentWeekContent(area);
    return {
      ...area,
      aiOverview: area.description ?? '',
      weekHabits: week?.habits ?? [],
      weekActivities: week?.activities ?? [],
    };
  });
  const primaryArea = focusAreas.find(a => a.weekHabits.length > 0) ?? focusAreas[0] ?? null;
  const activeArea  = focusAreas[Math.min(activeAreaIndex, Math.max(focusAreas.length - 1, 0))] ?? primaryArea;
  const todayTip = (() => {
    const tips = activeArea?.dailyTips;
    if (!tips?.length) return null;
    const daysSince = Math.floor((Date.now() - new Date(activeArea.createdAt ?? Date.now()).getTime()) / 86400000);
    return tips[daysSince % tips.length] ?? null;
  })();

  const wins     = child?.wins      ?? [];
  const incidents = child?.incidents ?? [];

  async function addWin() {
    const text = winText.trim();
    if (!text || !child) return;
    const entry = { id: `w_${Date.now()}`, text, date: new Date().toISOString() };
    const updated = [...wins, entry];
    await updateChildProfile(child.id, { wins: updated });
    setWinText('');
    setWinModalVisible(false);
    getAllChildProfiles().then(setChildren);
  }

  async function deleteWin(id) {
    if (!child) return;
    const updated = wins.filter(w => w.id !== id);
    await updateChildProfile(child.id, { wins: updated });
    getAllChildProfiles().then(setChildren);
  }

  async function fetchCoaching(entryId, text, currentChild) {
    setCoachingLoading(prev => new Set([...prev, entryId]));
    try {
      const profileRaw = await AsyncStorage.getItem('tarbiyah_profile');
      const profile = profileRaw ? JSON.parse(profileRaw) : {};
      const familyStructure = profile.familyStructure ?? 'prefer_not_to_say';

      const growthAreas = (currentChild?.growthAreas ?? []).slice(0, 3).map(a => ({
        title: a.title,
        description: a.description ?? a.aiOverview ?? '',
      })).filter(a => a.title);

      const pastIncidents = (currentChild?.incidents ?? [])
        .filter(i => i.id !== entryId)
        .slice(-5)
        .map(i => i.text);

      const recentWins = (currentChild?.wins ?? [])
        .slice(-3)
        .map(w => w.text);

      const res = await fetch('https://tarbiyah-production.up.railway.app/incident/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incidentText: text,
          childName:    currentChild?.name,
          childAge:     currentChild?.age,
          childGender:  currentChild?.gender,
          childStage:   currentChild?.stage,
          strengths:    currentChild?.strengths   ?? [],
          temperaments: currentChild?.temperaments ?? [],
          specialNeeds: currentChild?.specialNeeds ?? [],
          growthAreas,
          pastIncidents,
          recentWins,
          familyStructure,
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setCoachingResponses(prev => ({ ...prev, [entryId]: data }));
    } catch {
      // silently skip — coaching is supplemental
    } finally {
      setCoachingLoading(prev => { const next = new Set(prev); next.delete(entryId); return next; });
    }
  }

  async function addIncident() {
    const text = incidentText.trim();
    if (!text || !child) return;
    const entry = { id: `i_${Date.now()}`, text, date: new Date().toISOString() };
    const updated = [...incidents, entry];
    await updateChildProfile(child.id, { incidents: updated });
    setIncidentText('');
    setIncidentModalVisible(false);
    getAllChildProfiles().then(setChildren);
    fetchCoaching(entry.id, text, child);
  }

  async function deleteIncident(id) {
    if (!child) return;
    const updated = incidents.filter(i => i.id !== id);
    await updateChildProfile(child.id, { incidents: updated });
    getAllChildProfiles().then(setChildren);
  }

  const toggleExpand = (id) => {
    setExpandedAreas(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleWisdom = (key) => {
    setExpandedWisdom(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleDone = (key) => {
    setMarkedDone(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const logOccurrence = (key) => {
    setCompletionCounts(prev => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));
    logCompletion(key);
  };

  const switchChild = (id) => {
    if (id === activeChildId) return;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setActiveChildId(id);
    setActiveAreaIndex(0);
    setPhaseExpanded(false);
    setExpandedAreas(new Set());
    setExpandedWisdom(new Set());
    setMarkedDone(new Set());
    setExpandedTimeHabits(new Set());
    setActivityPages({});
    setCompletionCounts({});
  };

  if (loaded && children.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={[]}>
        <StatusBar style="light" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Ionicons name="people-outline" size={52} color="rgba(255,255,255,0.2)" />
          <Text style={{ fontSize: 20, fontWeight: '800', color: '#FFFFFF', marginTop: 20, marginBottom: 10, textAlign: 'center' }}>No children added yet</Text>
          <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 21, marginBottom: 32 }}>Add your first child in the Family tab to see personalised dashboards here.</Text>
          <TouchableOpacity
            style={{ backgroundColor: '#4ADE80', borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 }}
            onPress={() => navigation.navigate('Family')}
            activeOpacity={0.85}
          >
            <Text style={{ fontSize: 15, fontWeight: '800', color: '#1B3D2F' }}>Go to Family</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!child) return (
    <SafeAreaView style={styles.safe} edges={[]}><StatusBar style="light" /><View style={{ flex:1, alignItems:'center', justifyContent:'center' }}><ActivityIndicator color="#4ADE80" /></View></SafeAreaView>
  );

  const renderWeekItem = ({ item, index, keyPrefix, total, isActivity }) => {
    const key       = `${keyPrefix}_${index}`;
    const done      = markedDone.has(key);
    const wisdomOpen = expandedWisdom.has(key);
    const isLast    = index === total - 1;

    return (
      <View
        key={key}
        style={[
          styles.weekItemRow,
          done && (isActivity ? styles.weekItemRowDoneActivity : styles.weekItemRowDone),
          !isLast && styles.weekItemRowBorder,
        ]}
      >
        <View style={[
          styles.weekNumBadge,
          isActivity
            ? (done ? styles.weekNumBadgeDoneActivity : styles.weekNumBadgeActivityDefault)
            : (done ? styles.weekNumBadgeDoneHabit    : styles.weekNumBadgeDefault),
        ]}>
          {done
            ? <Ionicons name="checkmark" size={11} color="#FFF" />
            : isActivity
              ? <Ionicons name="star-outline" size={11} color="#B45309" />
              : <Text style={[styles.weekNumText, { color: '#2E7D62' }]}>{index + 1}</Text>
          }
        </View>

        <View style={styles.weekItemContent}>
          <Text style={[styles.weekItemText, done && styles.weekItemTextDone]}>{item.text}</Text>

          {done && (
            <View style={isActivity ? styles.weekMotivationRowActivity : styles.weekMotivationRow}>
              <Ionicons name="sparkles" size={11} color={isActivity ? '#B45309' : '#2E7D62'} />
              <Text style={[styles.weekMotivationText, isActivity && { color: '#B45309' }]}>
                {motivationalMsg(key)}
              </Text>
            </View>
          )}

          {/* Wisdom + Did this today on same row */}
          <View style={styles.weekActionRow}>
            <TouchableOpacity
              style={styles.wisdomBtn}
              onPress={() => toggleWisdom(key)}
              activeOpacity={0.7}
            >
              <Ionicons name="book-outline" size={12} color={isActivity ? '#B45309' : '#2E7D62'} />
              <Text style={[styles.wisdomBtnText, isActivity && { color: '#B45309' }]}>
                Wisdom behind this
              </Text>
              <Ionicons
                name={wisdomOpen ? 'chevron-up' : 'chevron-down'}
                size={12}
                color={isActivity ? '#B45309' : '#2E7D62'}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.weekDidBtn,
                done && (isActivity ? styles.weekDidBtnDoneActivity : styles.weekDidBtnDoneHabit),
              ]}
              onPress={() => toggleDone(key)}
              activeOpacity={0.75}
            >
              {done
                ? <><Ionicons name="checkmark-circle" size={13} color="#FFF" /><Text style={styles.weekDidLabelDone}>Done today</Text></>
                : <Text style={styles.weekDidLabel}>Did this today</Text>
              }
            </TouchableOpacity>
          </View>

          {wisdomOpen && (
            <View style={[styles.wisdomPanel, isActivity && styles.wisdomPanelActivity]}>
              <Text style={[styles.wisdomText, isActivity && { color: '#92400E' }]}>{item.wisdom}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <StatusBar style="light" />
      {/* ── Fixed tab pills — always visible ── */}
      <View style={[styles.tabBar, { paddingTop: insets.top + 12 }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabRow}
        >
          {children.map(c => {
            const active = c.id === activeChildId;
            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.childPill, active && { backgroundColor: c.color, borderColor: '#FFFFFF', borderWidth: 2 }]}
                onPress={() => switchChild(c.id)}
                activeOpacity={0.75}
              >
                <View style={[styles.childPillDot, { backgroundColor: active ? '#FFFFFF' : c.color }]} />
                <Text style={[styles.childPillText, active && styles.childPillTextActive]}>
                  {c.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Scrollable content ── */}
      <Animated.ScrollView
        ref={scrollRef}
        style={{ flex: 1, opacity: fadeAnim }}
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero — scrolls away naturally */}
        <View style={styles.hero}>
          <View style={styles.heroRow}>
            <View style={styles.headerDate}>
              <Text style={styles.headerDayLabel}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()} · {new Date().toLocaleDateString('en-US', { month: 'long' }).toUpperCase()} {ordinal(new Date().getDate())}
              </Text>
              <Text style={styles.headerChildName}>{child.name}</Text>
              <Text style={styles.headerChildMeta}>Age {child.age} · {child.stage}</Text>
            </View>
            <View style={[styles.activeAvatarRing, { borderColor: child.color }]}>
              <View style={[styles.activeAvatarCircle, { backgroundColor: child.color }]}>
                {child.photo
                  ? <Image source={{ uri: child.photo }} style={styles.activeAvatarPhoto} />
                  : <Text style={styles.activeAvatarInitial}>{child.name[0]}</Text>
                }
              </View>
            </View>
          </View>
        </View>

        {/* White rounded sheet */}
        <View style={styles.sheet}><View style={styles.content}>

        {/* ── Developmental phase card ── */}
        {(() => {
          const phase = getDevPhase(child.age);
          if (!phase) return null;
          return (
            <TouchableOpacity
              style={styles.phaseCard}
              onPress={() => setPhaseExpanded(p => !p)}
              activeOpacity={0.88}
            >
              <View style={styles.phaseTopRow}>
                <View style={styles.phaseEmojiWrap}>
                  <Text style={styles.phaseEmoji}>{phase.emoji}</Text>
                </View>
                <View style={styles.phaseTitleBlock}>
                  <Text style={styles.phaseEyebrow}>DEVELOPMENTAL PHASE · AGE {child.age}</Text>
                  <Text style={styles.phaseTitle}>{phase.phase}</Text>
                </View>
                <Ionicons
                  name={phaseExpanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color="#2E7D62"
                />
              </View>

              <View style={styles.phaseShiftRow}>
                <Text style={styles.phaseShift}>{phase.shift}</Text>
              </View>

              <View style={styles.phaseInsightBox}>
                <Text style={styles.phaseInsightText}>"{phase.keyInsight}"</Text>
              </View>

              {phaseExpanded && (
                <View style={styles.phaseDetail}>
                  <View style={styles.phaseDetailDivider} />

                  <Text style={styles.phaseDetailLabel}>WHAT'S DEVELOPING</Text>
                  <View style={styles.phaseDetailBullets}>
                    {phase.developing.map((item, i) => (
                      <View key={i} style={styles.phaseBulletRow}>
                        <View style={styles.phaseBulletDot} />
                        <Text style={styles.phaseBulletText}>{item}</Text>
                      </View>
                    ))}
                  </View>

                  <Text style={styles.phaseDetailLabel}>BRAIN REALITY</Text>
                  <Text style={styles.phaseBrainText}>{phase.brainReality}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })()}

        {/* ── Empty state — no growth areas ── */}
        {focusAreas.length === 0 && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconRing}>
              <Ionicons name="leaf-outline" size={34} color="#2E7D62" />
            </View>
            <Text style={styles.emptyTitle}>No growth areas yet</Text>
            <Text style={styles.emptySub}>
              Add a growth area for {child.name} to unlock their personalised weekly coaching plan, habits, and activities.
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => navigation.navigate('GrowthAreaWizard', { child, isFirstTime: false, fromDashboard: true })}
              activeOpacity={0.85}
            >
              <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
              <Text style={styles.emptyBtnText}>Add a Growth Area</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('ChildDashboard', { child })}
              activeOpacity={0.7}
              style={{ marginTop: 14 }}
            >
              <Text style={styles.emptyProfileLink}>Manage {child.name}'s profile</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Current Focus */}
        {focusAreas.length > 0 && (<>
        <View style={[styles.focusCard, { borderColor: child.color + '55', backgroundColor: child.colorLight }]}>
          <View style={styles.focusTopRow}>
            <Ionicons name="radio-button-on" size={13} color={child.color} />
            <Text style={[styles.focusEyebrow, { color: child.color }]}>CURRENT GROWTH AREAS</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('ChildDashboard', { child })}
              activeOpacity={0.7}
            >
              <Text style={[styles.focusEditLink, { color: child.color }]}>Edit</Text>
            </TouchableOpacity>
          </View>
          {focusAreas.map((area, index) => {
            const expanded = expandedAreas.has(area.id);
            return (
              <View
                key={area.id}
                style={[styles.focusAreaRow, index < focusAreas.length - 1 && { borderBottomWidth: 1, borderBottomColor: child.color + '20' }]}
              >
                <View style={[styles.focusAreaNumBadge, { backgroundColor: child.color + '20' }]}>
                  <Text style={[styles.focusAreaNum, { color: child.color }]}>{index + 1}</Text>
                </View>
                <View style={styles.focusAreaText}>
                  <Text style={styles.focusAreaName}>{area.title}</Text>
                  {expanded && (
                    <Text style={styles.focusAreaOverview}>{area.aiOverview}</Text>
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => toggleExpand(area.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={[styles.expandBtn, { backgroundColor: child.color + '18' }]}
                >
                  <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={13} color={child.color} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {/* Coaching Tip */}
        {todayTip && (
          <>
            <Text style={styles.sectionLabel}>COACHING TIP OF THE DAY</Text>
            <ImageBackground
              source={require('../../assets/spiritual-5.jpg')}
              style={styles.tipCard}
              imageStyle={styles.tipCardImg}
              resizeMode="cover"
            >
              <LinearGradient
                colors={['rgba(10,28,20,0.55)', 'rgba(10,28,20,0.88)']}
                style={styles.tipCardOverlay}
              >
                <View style={styles.tipHeader}>
                  <Ionicons name="bulb-outline" size={15} color="#F5C842" />
                  <Text style={styles.tipTitle}>{todayTip.title}</Text>
                </View>
                <Text style={styles.tipText}>"{todayTip.body}"</Text>
              </LinearGradient>
            </ImageBackground>
          </>
        )}

        {/* This Week */}
        {focusAreas.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>THIS WEEK</Text>

            {/* ── Habits — 1 primary per area, expandable ── */}
            <View style={[styles.weekBlock, { backgroundColor: '#EDF7F2' }]}>
              <View style={styles.weekBlockHeaderHabit}>
                <View style={styles.weekBlockIconHabit}>
                  <Ionicons name="repeat-outline" size={15} color="#1B4D3E" />
                </View>
                <View style={styles.weekBlockTitleWrap}>
                  <Text style={[styles.weekBlockTitle, { color: '#1B4D3E' }]}>Habits to Build This Week</Text>
                  <Text style={[styles.weekBlockSub, { color: '#2E7D62' }]}>Swipe · do as many as you can</Text>
                </View>
              </View>

              {focusAreas.map((area, areaIdx) => {
                const habits     = area.weekHabits ?? [];
                const isLastArea = areaIdx === focusAreas.length - 1;
                if (!habits.length) return null;
                const currentPage = activityPages[`h_${area.id}`] ?? 0;
                return (
                  <View key={area.id} style={[!isLastArea && { borderBottomWidth: 1, borderBottomColor: '#C6E8D4', paddingBottom: 4, marginBottom: 4 }]}>
                    {focusAreas.length > 1 && (
                      <View style={styles.habitAreaLabel}>
                        <View style={[styles.habitAreaDot, { backgroundColor: child.color }]} />
                        <Text style={[styles.habitAreaTitle, { color: child.color }]} numberOfLines={1}>{area.title}</Text>
                      </View>
                    )}
                    <ScrollView
                      horizontal
                      pagingEnabled
                      showsHorizontalScrollIndicator={false}
                      decelerationRate="fast"
                      onMomentumScrollEnd={e => {
                        const page = Math.round(e.nativeEvent.contentOffset.x / ACTIVITY_CARD_WIDTH);
                        setActivityPages(prev => ({ ...prev, [`h_${area.id}`]: page }));
                      }}
                    >
                      {habits.map((habit, i) => {
                        const key      = `hswipe_${area.id}_${i}`;
                        const doneKey  = `hdone_${area.id}_${i}`;
                        const wisdomOpen = expandedWisdom.has(key);
                        const count    = completionCounts[doneKey] ?? 0;
                        return (
                          <View key={i} style={[styles.activitySwipeCard, { width: ACTIVITY_CARD_WIDTH, backgroundColor: '#EDF7F2', borderTopColor: '#C6E8D4' }]}>
                            <View style={styles.activityCardTop}>
                              <View style={[styles.weekNumBadgeDefault, styles.weekNumBadge]}>
                                <Text style={[styles.weekNumText, { color: '#2E7D62' }]}>{i + 1}</Text>
                              </View>
                              <Text style={styles.activityCardText}>{habit.text}</Text>
                            </View>
                            <View style={styles.cardActionRow}>
                              {habit.wisdom ? (
                                <TouchableOpacity style={styles.wisdomBtn} onPress={() => toggleWisdom(key)} activeOpacity={0.7}>
                                  <Ionicons name="book-outline" size={12} color="#2E7D62" />
                                  <Text style={styles.wisdomBtnText}>Wisdom behind this</Text>
                                  <Ionicons name={wisdomOpen ? 'chevron-up' : 'chevron-down'} size={12} color="#2E7D62" />
                                </TouchableOpacity>
                              ) : <View />}
                              <View style={styles.didItWrap}>
                                <TouchableOpacity
                                  style={[styles.didItBtn, count > 0 && styles.didItBtnDoneHabit]}
                                  onPress={() => logOccurrence(doneKey)}
                                  activeOpacity={0.75}
                                >
                                  <Ionicons name="add" size={13} color="#FFF" />
                                  <Text style={styles.didItText}>{count > 0 ? 'Did it again' : 'Did it today'}</Text>
                                </TouchableOpacity>
                                {count > 0 && (
                                  <Text style={styles.didItCounter}>{count} today</Text>
                                )}
                              </View>
                            </View>
                            {wisdomOpen && habit.wisdom && (
                              <View style={styles.wisdomPanel}>
                                <Text style={styles.wisdomText}>{habit.wisdom}</Text>
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </ScrollView>
                    <View style={styles.activityDots}>
                      {habits.map((_, i) => (
                        <View key={i} style={[styles.activityDot, i === currentPage && { ...styles.activityDotActive, backgroundColor: '#2E7D62' }]} />
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* ── Activities — swipeable cards per area ── */}
            <View style={[styles.weekBlock, { marginBottom: 4, backgroundColor: '#FEF8EE' }]}>
              <View style={styles.weekBlockHeaderActivity}>
                <View style={styles.weekBlockIconActivity}>
                  <Ionicons name="color-palette-outline" size={15} color="#92400E" />
                </View>
                <View style={styles.weekBlockTitleWrap}>
                  <Text style={[styles.weekBlockTitle, { color: '#92400E' }]}>Activities to Try This Week</Text>
                  <Text style={[styles.weekBlockSub, { color: '#B45309' }]}>Swipe to explore · pick one or try them all</Text>
                </View>
              </View>

              {focusAreas.map((area, areaIdx) => {
                const activities = area.weekActivities ?? [];
                if (!activities.length) return null;
                const currentPage = activityPages[area.id] ?? 0;
                const isLastArea  = areaIdx === focusAreas.length - 1;
                return (
                  <View key={area.id} style={[!isLastArea && { borderBottomWidth: 1, borderBottomColor: '#F5DFB8', paddingBottom: 12, marginBottom: 4 }]}>
                    {focusAreas.length > 1 && (
                      <View style={styles.habitAreaLabel}>
                        <View style={[styles.habitAreaDot, { backgroundColor: '#B45309' }]} />
                        <Text style={[styles.habitAreaTitle, { color: '#92400E' }]} numberOfLines={1}>{area.title}</Text>
                      </View>
                    )}
                    <ScrollView
                      horizontal
                      pagingEnabled
                      showsHorizontalScrollIndicator={false}
                      decelerationRate="fast"
                      onMomentumScrollEnd={e => {
                        const page = Math.round(e.nativeEvent.contentOffset.x / ACTIVITY_CARD_WIDTH);
                        setActivityPages(prev => ({ ...prev, [area.id]: page }));
                      }}
                    >
                      {activities.map((activity, i) => {
                        const key      = `swipe_${area.id}_${i}`;
                        const doneKey  = `adone_${area.id}_${i}`;
                        const wisdomOpen = expandedWisdom.has(key);
                        const count    = completionCounts[doneKey] ?? 0;
                        return (
                          <View key={i} style={[styles.activitySwipeCard, { width: ACTIVITY_CARD_WIDTH }]}>
                            <View style={styles.activityCardTop}>
                              <View style={styles.weekNumBadgeActivityDefault}>
                                <Ionicons name="star-outline" size={13} color="#B45309" />
                              </View>
                              <Text style={styles.activityCardText}>{activity.text}</Text>
                            </View>
                            <View style={styles.cardActionRow}>
                              {activity.wisdom ? (
                                <TouchableOpacity style={styles.wisdomBtn} onPress={() => toggleWisdom(key)} activeOpacity={0.7}>
                                  <Ionicons name="book-outline" size={12} color="#B45309" />
                                  <Text style={[styles.wisdomBtnText, { color: '#B45309' }]}>Wisdom behind this</Text>
                                  <Ionicons name={wisdomOpen ? 'chevron-up' : 'chevron-down'} size={12} color="#B45309" />
                                </TouchableOpacity>
                              ) : <View />}
                              <View style={styles.didItWrap}>
                                <TouchableOpacity
                                  style={[styles.didItBtn, styles.didItBtnDoneActivity]}
                                  onPress={() => logOccurrence(doneKey)}
                                  activeOpacity={0.75}
                                >
                                  <Ionicons name="add" size={13} color="#FFF" />
                                  <Text style={styles.didItText}>{count > 0 ? 'Did it again' : 'Did it today'}</Text>
                                </TouchableOpacity>
                                {count > 0 && (
                                  <Text style={[styles.didItCounter, { color: '#B45309' }]}>{count} today</Text>
                                )}
                              </View>
                            </View>
                            {wisdomOpen && activity.wisdom && (
                              <View style={[styles.wisdomPanel, styles.wisdomPanelActivity]}>
                                <Text style={[styles.wisdomText, { color: '#92400E' }]}>{activity.wisdom}</Text>
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </ScrollView>
                    {/* Pagination dots */}
                    <View style={styles.activityDots}>
                      {activities.map((_, i) => (
                        <View key={i} style={[styles.activityDot, i === currentPage && styles.activityDotActive]} />
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Wins */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>WINS THIS WEEK</Text>
          <TouchableOpacity onPress={() => setWinModalVisible(true)}><Text style={styles.sectionLink}>+ Add</Text></TouchableOpacity>
        </View>
        {wins.length === 0 ? (
          <View style={styles.emptyPrompt}>
            <Ionicons name="star-outline" size={22} color="#F59E0B" />
            <View style={styles.emptyPromptText}>
              <Text style={styles.emptyPromptTitle}>Log a win</Text>
              <Text style={styles.emptyPromptBody}>Noting moments of growth — however small — helps build a more accurate picture of {child.name}.</Text>
            </View>
          </View>
        ) : wins.map(w => (
          <View key={w.id} style={styles.entryCard}>
            <Ionicons name="star" size={14} color="#F59E0B" style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.entryText}>{w.text}</Text>
              <Text style={styles.entryDate}>{new Date(w.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
            </View>
            <TouchableOpacity onPress={() => Alert.alert('Delete win', 'Remove this entry?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => deleteWin(w.id) }])}>
              <Ionicons name="trash-outline" size={15} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        ))}

        {/* Incidents */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>INCIDENT REPORTS</Text>
          <TouchableOpacity onPress={() => setIncidentModalVisible(true)}><Text style={styles.sectionLink}>+ Log</Text></TouchableOpacity>
        </View>
        {incidents.length === 0 ? (
          <View style={styles.emptyPrompt}>
            <Ionicons name="alert-circle-outline" size={22} color="#9CA3AF" />
            <View style={styles.emptyPromptText}>
              <Text style={styles.emptyPromptTitle}>Log a difficult moment</Text>
              <Text style={styles.emptyPromptBody}>Incidents give the app context about recurring patterns. The more you log, the more personalised the coaching becomes for {child.name}.</Text>
            </View>
          </View>
        ) : incidents.map(inc => {
          const coaching = coachingResponses[inc.id];
          const loading  = coachingLoading.has(inc.id);
          return (
            <View key={inc.id}>
              <View style={styles.entryCard}>
                <Ionicons name="alert-circle" size={14} color="#9CA3AF" style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.entryText}>{inc.text}</Text>
                  <Text style={styles.entryDate}>{new Date(inc.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                </View>
                <TouchableOpacity onPress={() => Alert.alert('Delete report', 'Remove this entry?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => deleteIncident(inc.id) }])}>
                  <Ionicons name="trash-outline" size={15} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
              {loading && (
                <View style={[styles.coachingCard, { alignItems: 'center' }]}>
                  <ActivityIndicator size="small" color="#2E7D62" />
                  <Text style={styles.coachingLoadingText}>Getting coaching response…</Text>
                </View>
              )}
              {!loading && coaching && (
                <View style={[styles.coachingCard, { flexDirection: 'column' }]}>
                  <View style={styles.coachingHeader}>
                    <Ionicons name="sparkles" size={13} color="#2E7D62" />
                    <Text style={styles.coachingHeaderText}>TARBIYAH COACHING</Text>
                  </View>
                  <Text style={styles.coachingAck}>{coaching.acknowledgment}</Text>
                  <View style={styles.coachingDivider} />
                  <View style={styles.coachingRow}>
                    <Ionicons name="moon-outline" size={13} color="#2E7D62" style={{ marginTop: 2 }} />
                    <Text style={styles.coachingBody}>{coaching.islamicAngle}</Text>
                  </View>
                  <View style={[styles.coachingRow, { marginBottom: 0 }]}>
                    <Ionicons name="arrow-forward-circle-outline" size={13} color="#2E7D62" style={{ marginTop: 2 }} />
                    <Text style={styles.coachingBody}>{coaching.action}</Text>
                  </View>
                </View>
              )}
            </View>
          );
        })}

        {/* Wins modal */}
        <Modal visible={winModalVisible} transparent animationType="fade" onRequestClose={() => setWinModalVisible(false)}>
          <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Log a win</Text>
              <TextInput style={styles.modalInput} placeholder={`What went well with ${child?.name}?`} placeholderTextColor="#9CA3AF" value={winText} onChangeText={setWinText} multiline autoFocus />
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.modalCancel} onPress={() => { setWinModalVisible(false); setWinText(''); }}><Text style={styles.modalCancelText}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={styles.modalSave} onPress={addWin}><Text style={styles.modalSaveText}>Save</Text></TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Incident modal */}
        <Modal visible={incidentModalVisible} transparent animationType="fade" onRequestClose={() => setIncidentModalVisible(false)}>
          <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Log a difficult moment</Text>
              <TextInput style={styles.modalInput} placeholder={`What happened with ${child?.name}?`} placeholderTextColor="#9CA3AF" value={incidentText} onChangeText={setIncidentText} multiline autoFocus />
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.modalCancel} onPress={() => { setIncidentModalVisible(false); setIncidentText(''); }}><Text style={styles.modalCancelText}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={styles.modalSave} onPress={addIncident}><Text style={styles.modalSaveText}>Save</Text></TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <View style={{ height: 40 }} />
        </>)}
        </View>
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1B3D2F' },

  // Fixed tab bar
  tabBar: { backgroundColor: '#1B3D2F', paddingBottom: 14 },
  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20 },
  childPill: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 100, paddingHorizontal: 14, paddingVertical: 8,
  },
  childPillDot: { width: 7, height: 7, borderRadius: 4 },
  childPillText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },
  childPillTextActive: { color: '#FFFFFF', fontWeight: '700' },

  // Hero (scrolls away)
  hero: { backgroundColor: '#1B3D2F', paddingHorizontal: 20, paddingBottom: 28 },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },

  // Date + child info row
  headerDate: { flex: 1 },
  headerDayLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.45)', marginBottom: 6,
  },
  headerChildName: {
    fontSize: 34, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5, lineHeight: 38,
  },
  headerChildMeta: {
    fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '500', marginTop: 4,
  },

  // Active child avatar
  activeAvatarRing: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 3, padding: 3,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'flex-end', marginBottom: 2,
  },
  activeAvatarCircle: {
    width: 70, height: 70, borderRadius: 35,
    alignItems: 'center', justifyContent: 'center',
  },
  activeAvatarPhoto: { width: 70, height: 70, borderRadius: 35 },
  activeAvatarInitial: { fontSize: 28, fontWeight: '800', color: '#FFFFFF' },

  // Sheet
  sheet: { flexGrow: 1, backgroundColor: '#F5F6F8', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },

  // Sections
  sectionRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 8, marginTop: 16,
  },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#6B7280', letterSpacing: 1, marginBottom: 8, marginTop: 16 },
  sectionLink:  { fontSize: 13, fontWeight: '600', color: '#2E7D62' },


  // Developmental phase card
  phaseCard: {
    backgroundColor: '#F0F7F4',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#C6E8D4',
    ...CARD_SHADOW,
  },
  phaseTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  phaseEmojiWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#C6E8D4',
  },
  phaseEmoji: { fontSize: 20 },
  phaseTitleBlock: { flex: 1 },
  phaseEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2E7D62',
    letterSpacing: 1,
    marginBottom: 2,
  },
  phaseTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1A1A2E',
  },
  phaseShiftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#DDF0E6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  phaseShift: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1B4D3E',
    flex: 1,
  },
  phaseInsightBox: {
    borderLeftWidth: 3,
    borderLeftColor: '#2E7D62',
    paddingLeft: 12,
    paddingVertical: 2,
  },
  phaseInsightText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  phaseDetail: { marginTop: 4 },
  phaseDetailDivider: {
    height: 1,
    backgroundColor: '#C6E8D4',
    marginVertical: 14,
  },
  phaseDetailLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2E7D62',
    letterSpacing: 1,
    marginBottom: 8,
  },
  phaseDetailBullets: { gap: 6, marginBottom: 14 },
  phaseBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  phaseBulletDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#2E7D62',
    marginTop: 7,
    flexShrink: 0,
  },
  phaseBulletText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
    flex: 1,
  },
  phaseBrainText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
  },

  // Focus card
  focusCard: {
    borderRadius: 20, padding: 16, marginBottom: 4,
    ...CARD_SHADOW, borderWidth: 1,
  },
  focusTopRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  focusEyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, flex: 1 },
  focusSubRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  focusSubText: { fontSize: 12, fontWeight: '400', flex: 1, lineHeight: 17 },
  focusEditLink: { fontSize: 12, fontWeight: '700' },
  focusAreaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  focusAreaNumBadge: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  focusAreaNum:      { fontSize: 12, fontWeight: '800' },
  focusAreaText:     { flex: 1 },
  focusAreaName:     { fontSize: 14, fontWeight: '700', color: '#1A1A2E', marginBottom: 3 },
  focusAreaOverview: { fontSize: 12, color: '#4B5563', lineHeight: 18 },
  expandBtn: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },

  // Tip card
  tipCard: {
    borderRadius: 16, overflow: 'hidden', marginBottom: 4,
    ...CARD_SHADOW,
  },
  tipCardImg:     { borderRadius: 16 },
  tipCardOverlay: { padding: 16, borderRadius: 16 },
  tipHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  tipTitle:  { fontSize: 13, fontWeight: '700', color: '#F5C842' },
  tipText:   { fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 21, fontStyle: 'italic' },

  focusSelectedDot: { width: 7, height: 7, borderRadius: 4 },

  // Habit area grouping
  habitAreaBlock: {
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6', marginBottom: 4,
  },
  habitAreaLabel: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4,
  },
  habitAreaDot:  { width: 7, height: 7, borderRadius: 4 },
  habitAreaTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, flex: 1 },

  // "If you have time" expander
  ifTimeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1, borderTopColor: '#F0F1F3',
  },
  ifTimeBtnText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },

  // Swipeable activity cards
  activitySwipeCard: {
    backgroundColor: '#FEF8EE',
    borderRadius: 0, padding: 16,
    borderTopWidth: 1, borderTopColor: '#F5DFB8',
  },
  activityCardTop: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10,
  },
  activityCardText: { flex: 1, fontSize: 13, color: '#1A1A2E', lineHeight: 20 },
  cardActionRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 8,
  },
  didItBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#2E7D62', borderRadius: 100,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  didItBtnDoneHabit:    { backgroundColor: '#2E7D62' },
  didItBtnDoneActivity: { backgroundColor: '#B45309' },
  didItText:     { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  didItDoneText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  didItWrap:     { alignItems: 'flex-end', gap: 3 },
  didItCounter:  { fontSize: 10, fontWeight: '700', color: '#2E7D62' },

  activityDots: {
    flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 10,
  },
  activityDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: '#E5E7EB',
  },
  activityDotActive: { backgroundColor: '#B45309', width: 16 },

  // This Week cards
  weekBlock: {
    backgroundColor: '#FFF', borderRadius: 18, overflow: 'hidden',
    marginBottom: 10,
    shadowColor: '#1B3D2F', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.13, shadowRadius: 14, elevation: 6,
    borderWidth: 1, borderColor: '#D8E8DF',
  },
  weekBlockHeaderHabit: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#EDF7F2', paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: '#D4EDE2',
  },
  weekBlockHeaderActivity: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FEF6EC', paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: '#F5DFB8',
  },
  weekBlockIconHabit: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#C6E8D4', alignItems: 'center', justifyContent: 'center',
  },
  weekBlockIconActivity: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#FDE8C8', alignItems: 'center', justifyContent: 'center',
  },
  weekBlockTitleWrap: { flex: 1 },
  weekBlockTitle:     { fontSize: 14, fontWeight: '800', marginBottom: 1 },
  weekBlockSub:       { fontSize: 11, fontWeight: '500' },
  weekItemRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14,
  },
  weekItemRowDone:         { backgroundColor: '#F6FBF8' },
  weekItemRowDoneActivity: { backgroundColor: '#FFFBF4' },
  weekItemRowBorder:       { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  weekNumBadge: {
    width: 26, height: 26, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  weekNumBadgeDefault:         { backgroundColor: '#E8F5EE' },
  weekNumBadgeActivityDefault: { backgroundColor: '#FEF3E7' },
  weekNumBadgeDoneHabit:       { backgroundColor: '#2E7D62' },
  weekNumBadgeDoneActivity:    { backgroundColor: '#B45309' },
  weekNumText:      { fontSize: 11, fontWeight: '800' },
  weekItemContent:  { flex: 1 },
  weekItemText:     { fontSize: 13, color: '#1A1A2E', lineHeight: 20, marginBottom: 8 },
  weekItemTextDone: { color: '#9CA3AF' },
  weekMotivationRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8,
  },
  weekMotivationRowActivity: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8,
  },
  weekMotivationText: { fontSize: 11, fontWeight: '700', color: '#2E7D62' },

  // Wisdom expand
  weekActionRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 8,
  },
  wisdomBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 4, paddingHorizontal: 2,
  },
  wisdomBtnText: { fontSize: 12, fontWeight: '600', color: '#2E7D62' },
  wisdomPanel: {
    backgroundColor: '#EDF7F2', borderRadius: 10, padding: 12, marginBottom: 10,
    borderLeftWidth: 3, borderLeftColor: '#2E7D62',
  },
  wisdomPanelActivity: {
    backgroundColor: '#FEF6EC', borderLeftColor: '#B45309',
  },
  wisdomText: { fontSize: 12, color: '#1B4D3E', lineHeight: 19 },

  weekDidBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#F3F4F6', borderRadius: 100,
    paddingHorizontal: 13, paddingVertical: 7,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  weekDidBtnDoneHabit:    { backgroundColor: '#2E7D62', borderColor: '#2E7D62' },
  weekDidBtnDoneActivity: { backgroundColor: '#B45309', borderColor: '#B45309' },
  weekDidLabel:     { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  weekDidLabelDone: { fontSize: 12, fontWeight: '700', color: '#FFF' },

  // Growth areas
  milestoneRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFF', borderRadius: 14, padding: 12, marginBottom: 6,
    ...CARD_SHADOW, borderWidth: 1, borderColor: '#EEF0F2',
  },
  milestoneNumBadge: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  milestoneNum:     { fontSize: 13, fontWeight: '700' },
  milestoneRowText: { flex: 1 },
  milestoneName:    { fontSize: 14, fontWeight: '700', color: '#1A1A2E' },

  // Chip cards (strengths + temperament)
  chipCard: {
    backgroundColor: '#FFF', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 16,
    flexDirection: 'row', flexWrap: 'wrap',
    marginBottom: 4, ...CARD_SHADOW, borderWidth: 1, borderColor: '#EEF0F2',
  },
  strengthChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#FEF3E7', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 100,
  },
  strengthChipText: { fontSize: 13, fontWeight: '600', color: '#B45309' },
  temperamentChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#EEF2FF', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 100,
  },
  temperamentChipText: { fontSize: 13, fontWeight: '600', color: '#4338CA' },
  addChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 100,
  },
  addChipText: { fontSize: 13, fontWeight: '600', color: '#9CA3AF' },

  // Wins
  winRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#FFF', borderRadius: 12, padding: 12, marginBottom: 6,
    ...CARD_SHADOW, borderWidth: 1, borderColor: '#EEF0F2',
  },
  winText: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 19 },
  winWhen: { fontSize: 11, color: '#9CA3AF', fontWeight: '500', marginTop: 2 },

  // Incidents
  incidentCard: {
    backgroundColor: '#FFF', borderRadius: 14, padding: 12, marginBottom: 6,
    borderLeftWidth: 3, borderLeftColor: '#DC2626', ...CARD_SHADOW,
  },
  incidentTop:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  incidentIconWrap: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center',
  },
  incidentMeta:    { flex: 1 },
  incidentSummary: { fontSize: 13, fontWeight: '700', color: '#1A1A2E', lineHeight: 19, marginBottom: 3 },
  incidentDate:    { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  unresolvedPill:  { backgroundColor: '#FEE2E2', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20 },
  unresolvedText:  { fontSize: 11, fontWeight: '700', color: '#DC2626' },
  coachingNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#FEF3E7', borderRadius: 10, padding: 10,
  },
  coachingNoteText: { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 18 },

  // No growth areas empty state
  emptyState: {
    alignItems: 'center', paddingTop: 48, paddingBottom: 32, paddingHorizontal: 12,
  },
  emptyIconRing: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#E6F4ED',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22, fontWeight: '800', color: '#1A1A2E',
    textAlign: 'center', marginBottom: 12,
  },
  emptySub: {
    fontSize: 14, color: '#6B7280', textAlign: 'center',
    lineHeight: 22, marginBottom: 32, paddingHorizontal: 8,
  },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#2E7D62', borderRadius: 14,
    paddingHorizontal: 24, paddingVertical: 14,
  },
  emptyBtnText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  emptyProfileLink: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },

  // Empty states
  emptyPrompt: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    backgroundColor: '#FAFAFA', borderRadius: 14, padding: 16, marginBottom: 6,
    borderWidth: 1, borderColor: '#EBEBEB', borderStyle: 'dashed',
  },
  emptyPromptText:  { flex: 1 },
  emptyPromptTitle: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 4 },
  emptyPromptBody:  { fontSize: 12, color: '#9CA3AF', lineHeight: 18 },

  entryCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  entryText: { fontSize: 13, color: '#1A1A2E', lineHeight: 19, marginBottom: 3 },
  entryDate: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },

  coachingCard: {
    backgroundColor: '#EDF7F2',
    borderRadius: 12,
    padding: 14,
    marginTop: -4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#C6E8D4',
    flexDirection: 'row',
    alignItems: 'center',
  },
  coachingLoadingText: { fontSize: 12, color: '#2E7D62', fontWeight: '500', marginLeft: 10 },
  coachingHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  coachingHeaderText: { fontSize: 10, fontWeight: '800', color: '#2E7D62', letterSpacing: 1 },
  coachingAck: { fontSize: 13, color: '#1B4D3E', lineHeight: 20, marginBottom: 10 },
  coachingDivider: { height: 1, backgroundColor: '#C6E8D4', marginBottom: 10 },
  coachingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  coachingBody: { flex: 1, fontSize: 12, color: '#1B4D3E', lineHeight: 19 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A2E', marginBottom: 16 },
  modalInput: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
    padding: 14, fontSize: 14, color: '#1A1A2E', minHeight: 100,
    textAlignVertical: 'top', marginBottom: 16,
  },
  modalBtns: { flexDirection: 'row', gap: 10 },
  modalCancel: { flex: 1, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  modalSave: { flex: 1, backgroundColor: '#1B3D2F', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  modalSaveText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
