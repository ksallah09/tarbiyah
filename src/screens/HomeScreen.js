import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image as RNImage,
  ImageBackground,
  Dimensions,
  Share,
  Animated,
  Modal,
} from 'react-native';
let captureRef = null;
try { captureRef = require('react-native-view-shot').captureRef; } catch {}
let Sharing = null;
try { Sharing = require('expo-sharing'); } catch {}

const SCREEN_WIDTH = Dimensions.get('window').width;
const TIP_CARD_WIDTH = SCREEN_WIDTH - 80; // 20 left inset + 12 gap + 48 peek
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import fallbackData from '../data/insights.json';
import { getWeekReadDays, isReadToday, getStreak, getMonthTotal, getMonthReadDays, getPartnerMonthCounts } from '../utils/readInsights';
import { getCachedSyncStatus, getFamilySyncStatus } from '../utils/familySync';
import { saveGoalsForDate } from '../utils/goalHistory';
import TypewriterText from '../components/TypewriterText';
import { getDailyDua, getDailyAyah } from '../data/dailyIslamic';
import { refreshDailyNotification, scheduleChildHabitNotifications } from '../utils/notifications';
import { supabase } from '../utils/supabase';
import { rs, hp } from '../utils/responsive';
import { getLocalCounts, getChildWeeklyCounts, getMonthlyHabitActivityTotals, getPartnerMonthCompletions } from '../utils/childCompletions';
import { loadFamilyGoalsCached, loadFamilyGoals, getGoalEmoji } from '../utils/familyGoals';
import { loadCompletions, isCompletedToday, countThisWeek, logCompletion as logGoalCompletion } from '../utils/goalCompletions';
import ChallengeCard from '../components/ChallengeCard';
import { GOALS_MESSAGES, pickRandom } from '../utils/encouragement';
import EncouragementModal from '../components/EncouragementModal';
import YouthCultureModal from './YouthCultureModal';
import { useAuth } from '../../App';
import { Image } from 'expo-image';


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

function buildChildFocusMap(children, counts) {
  const map = {};
  const planCompleteIds = new Set();
  for (const child of children) {
    const habits = [];
    let hasAnyPlan = false;
    for (const area of (child.growthAreas ?? []).slice(0, 3)) {
      if (!area?.plan?.length) continue;
      hasAnyPlan = true;
      const daysSince = Math.floor((Date.now() - new Date(area.createdAt ?? Date.now()).getTime()) / 86400000);
      if (daysSince >= area.plan.length * 7) continue; // this area's plan is finished
      const weekIdx = Math.floor(daysSince / 7);
      const week = area.plan[weekIdx];
      (week?.habits ?? []).forEach((habit, i) => {
        habits.push({
          key: `hdone_${area.id}_${i}`,
          text: habit.text,
          wisdom: habit.wisdom ?? null,
          childName: child.name.split(' ')[0],
          childColor: child.color ?? '#2E7D62',
          childId: child.id,
          areaTitle: area.title,
        });
      });
    }
    if (!hasAnyPlan) continue;
    if (!habits.length) { planCompleteIds.add(child.id); continue; }
    habits.sort((a, b) => (counts[a.key] ?? 0) - (counts[b.key] ?? 0));
    const minCount = counts[habits[0].key] ?? 0;
    const lowestGroup = habits.filter(h => (counts[h.key] ?? 0) === minCount);
    map[child.id] = lowestGroup[DAY_INDEX % lowestGroup.length];
  }
  return { map, planCompleteIds };
}


const API_URL   = 'https://tarbiyah-production.up.railway.app';
const CACHE_KEY = 'tarbiyah_daily_cache';


function getMotivationText(done, total) {
  if (done === 0 || total === 0) return null;
  if (done >= total) return 'Alhamdulillah! All done';
  if (done >= total - 1) return 'Allahu Akbar! Almost there';
  return 'Ma Shaa Allah! Keep it up';
}

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

export default function HomeScreen({ navigation, route }) {
  const { hasChildren, hasFamilyGoals, children = [], worldSnaps = {}, refreshChildrenAndSnaps, isSubscribed, trialDaysLeft, alertUnreadCount } = useAuth();
  const insets = useSafeAreaInsets();

  const [dailyData, setDailyData]            = useState(null);
  const [loading, setLoading]                = useState(true);
  const [spirReadWeek,  setSpiritualReadWeek] = useState([]);
  const [sciReadWeek,   setScientificReadWeek]= useState([]);
  const [quranReadWeek, setQuranReadWeek]     = useState([]);
  const [name, setName]                      = useState('');
  const [photoUrl, setPhotoUrl]              = useState(null);
  const [devRefreshing, setDevRefreshing]    = useState(false);
  const [animate, setAnimate]                = useState(false);
  const [ayahRead, setAyahRead]              = useState(false);
  const [tipIndex, setTipIndex]              = useState(0);
  const [imgIndex, setImgIndex]              = useState(DAY_INDEX);
  const [spiritReadToday, setSpiritReadToday] = useState(false);
  const [sciReadToday,    setSciReadToday]    = useState(false);
  // const [trendingChallenges, setTrendingChallenges] = useState([]); // TODO: re-enable in future release
  const [streak,      setStreak]      = useState(0);
  const [sciStreak,   setSciStreak]   = useState(0);
  const [quranStreak, setQuranStreak] = useState(0);
  const [syncStatus,        setSyncStatus]        = useState({ linked: false, partner: null });
  const [partnerSyncOn,     setPartnerSyncOn]     = useState(false);
  const [myMonthTotal,      setMyMonthTotal]      = useState(0);
  const [partnerMonthTotal, setPartnerMonthTotal] = useState(0);
  const [cultureModalOpen, setCultureModalOpen] = useState(false);
  const [familyGoals,      setFamilyGoals]      = useState([]);
  const [goalCompletions,  setGoalCompletions]  = useState([]);
  const [weekCompletions, setWeekCompletions] = useState({});
  const [encouragement, setEncouragement] = useState(null);
  const [focusChildId, setFocusChildId]           = useState(null);
  const [focusDropdownOpen, setFocusDropdownOpen] = useState(false);
  const [spirMonth,       setSpiritualMonth]  = useState([]);
  const [sciMonth,        setScientificMonth] = useState([]);
  const [quranMonth,      setQuranMonth]      = useState([]);
  const [partnerCounts,   setPartnerCounts]   = useState({ spiritual: 0, scientific: 0, quran: 0 });
  const [myHabAct,        setMyHabAct]        = useState({ habits: 0, activities: 0 });
  const [prtHabAct,       setPrtHabAct]       = useState({ habits: 0, activities: 0 });
  const [duaSharing, setDuaSharing] = useState(false);
  const [challengeFocus, setChallengeF] = useState(0);
  const duaShareCardRef = useRef(null);
  const insightIdsRef     = useRef({ spiritual: null, scientific: null });
  const partnerChannelRef = useRef(null);
  const focusInitialisedRef = useRef(false);
  const sheetSlide   = useRef(new Animated.Value(40)).current;
  const sheetOpacity = useRef(new Animated.Value(0)).current;

  const [cultureModalChildId, setCultureModalChildId] = useState(null);

  // Round-robin default child: rotate which child shows first on each app open
  useEffect(() => {
    if (focusInitialisedRef.current || !children.length) return;
    const { map: focusMap, planCompleteIds } = buildChildFocusMap(children, weekCompletions);
    const eligible = children.filter(c => focusMap[c.id] || planCompleteIds.has(c.id));
    if (!eligible.length) return;
    focusInitialisedRef.current = true;
    AsyncStorage.getItem('tarbiyah_focus_default_index').then(val => {
      const counter = parseInt(val ?? '0', 10) || 0;
      setFocusChildId(eligible[counter % eligible.length].id);
      AsyncStorage.setItem('tarbiyah_focus_default_index', String(counter + 1));
    });
  }, [children, weekCompletions]);

  useEffect(() => {
    if (route?.params?.openYouthCulture) {
      setCultureModalChildId(route.params.childId ?? null);
      setCultureModalOpen(true);
      navigation.setParams({ openYouthCulture: false, childId: undefined });
    }
  }, [route?.params?.openYouthCulture]);


  async function handleShareDua() {
    if (duaSharing || !dailyDua) return;
    setDuaSharing(true);
    try {
      if (!captureRef) { Alert.alert('Sharing unavailable', 'Please rebuild the app to enable image sharing.'); setDuaSharing(false); return; }
      const uri = await captureRef(duaShareCardRef, { format: 'jpg', quality: 0.95 });
      const canShare = Sharing && await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', dialogTitle: 'Share Dua' });
      } else {
        await Share.share({ message: `${dailyDua.arabic}\n\n${dailyDua.transliteration}\n\n"${dailyDua.translation}"\n\n— ${dailyDua.reference}\n\nShared from Tarbiyah` });
      }
    } catch {
      await Share.share({ message: `${dailyDua.arabic}\n\n${dailyDua.transliteration}\n\n"${dailyDua.translation}"\n\n— ${dailyDua.reference}\n\nShared from Tarbiyah` });
    } finally {
      setDuaSharing(false);
    }
  }


  const SPIRITUAL_CARD_IMAGES = [
    require('../../assets/spiritual-1.jpg'),
    require('../../assets/spiritual-2.jpg'),
    require('../../assets/spiritual-5.jpg'),
    require('../../assets/spiritual-7.jpg'),
    require('../../assets/spiritual-10.jpg'),
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
        const familyStructure = profile.familyStructure ?? 'prefer_not_to_say';

        // Derive age groups from actual child profiles (more accurate than onboarding buckets)
        const childrenRaw = await AsyncStorage.getItem('tarbiyah_child_profiles');
        const childProfiles = childrenRaw ? JSON.parse(childrenRaw) : [];
        const ageToGroup = (age) => {
          if (age < 5)  return 'under-5';
          if (age < 11) return '5-10';
          if (age < 16) return '11-15';
          return '16-plus';
        };
        const childrenAges = childProfiles.length > 0
          ? [...new Set(childProfiles.map(c => ageToGroup(c.age ?? 0)))]
          : (profile.childrenAges ?? []);

        const query = new URLSearchParams();
        if (focusAreas.length) query.set('focusAreas', focusAreas.join(','));
        if (childrenAges.length) query.set('childrenAges', childrenAges.join(','));
        if (familyStructure) query.set('familyStructure', familyStructure);
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
        setImgIndex(Math.floor(Date.now() / 86_400_000));
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(dataWithLocalDate));
        await refreshDailyNotification();
        scheduleChildHabitNotifications().catch(() => {});
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

  async function devForceRefresh() {
    setDevRefreshing(true);
    await AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
    await loadDaily();
    setDevRefreshing(false);
  }

  // TODO: re-enable trending challenges fetch in future release
  // useEffect(() => {
  //   fetch(`${API_URL}/trending/challenges`)
  //     .then(r => r.json())
  //     .then(data => { if (Array.isArray(data) && data.length) setTrendingChallenges(data); })
  //     .catch(() => {});
  // }, []);

  useFocusEffect(
    useCallback(() => {
      setChallengeF(n => n + 1);
      getWeekReadDays('spiritual').then(setSpiritualReadWeek);
      getWeekReadDays('scientific').then(setScientificReadWeek);
      getWeekReadDays('quran').then(setQuranReadWeek);
      getStreak('spiritual').then(setStreak);
      getStreak('scientific').then(setSciStreak);
      getStreak('quran').then(setQuranStreak);
      isReadToday('quran', dailyAyah.reference).then(setAyahRead);
      refreshChildrenAndSnaps();
      loadFamilyGoalsCached().then(setFamilyGoals);
      loadFamilyGoals().then(setFamilyGoals);
      loadCompletions().then(setGoalCompletions);
      getLocalCounts().then(counts => {
        setWeekCompletions(counts);
        setMyHabAct(getMonthlyHabitActivityTotals(counts));
      });
      getMonthReadDays('spiritual').then(setSpiritualMonth);
      getMonthReadDays('scientific').then(setScientificMonth);
      getMonthReadDays('quran').then(setQuranMonth);

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

      // Load photo: use locally cached file so there's no network delay on tab switch
      AsyncStorage.getItem('tarbiyah_profile_photo').then(async remoteUrl => {
        const url = remoteUrl || await supabase.auth.getSession().then(
          ({ data: { session } }) => {
            const meta = session?.user?.user_metadata ?? {};
            return meta.avatar_url || meta.picture || null;
          }
        ).catch(() => null);
        if (url) setPhotoUrl(url);
      });

      loadDaily();

      // Load partner sync status + monthly scores for hero score strip
      getMonthTotal().then(setMyMonthTotal);
      AsyncStorage.getItem('tarbiyah_partner_sync_on').then(val => {
        if (val === 'false') { setPartnerSyncOn(false); return; }
        getCachedSyncStatus().then(status => setPartnerSyncOn(!!status?.linked));
        function applyPartnerStatus(status) {
          setSyncStatus(status);
          if (status.linked && status.partner?.userId) {
            const uid = status.partner.userId;
            getPartnerMonthCounts(uid).then(counts => {
              setPartnerMonthTotal(counts.spiritual + counts.scientific + counts.quran);
              setPartnerCounts(counts);
            });
            getPartnerMonthCompletions(uid).then(setPrtHabAct);

            // Real-time: re-fetch partner leaderboard whenever their data changes
            if (partnerChannelRef.current) supabase.removeChannel(partnerChannelRef.current);
            partnerChannelRef.current = supabase
              .channel(`partner-lb-${uid}`)
              .on('postgres_changes', { event: '*', schema: 'public', table: 'user_read_history', filter: `user_id=eq.${uid}` }, () => {
                getPartnerMonthCounts(uid).then(counts => {
                  setPartnerMonthTotal(counts.spiritual + counts.scientific + counts.quran);
                  setPartnerCounts(counts);
                });
              })
              .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `user_id=eq.${uid}` }, () => {
                getPartnerMonthCompletions(uid).then(setPrtHabAct);
              })
              .subscribe();
          }
        }

        // Phase 1: instant from cache
        getCachedSyncStatus().then(applyPartnerStatus);
        // Phase 2: live from Supabase (catches first-login with no cache)
        getFamilySyncStatus().then(applyPartnerStatus);
      });

      return () => {
        if (partnerChannelRef.current) {
          supabase.removeChannel(partnerChannelRef.current);
          partnerChannelRef.current = null;
        }
      };
    }, [])
  );

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
  useEffect(() => {
    if (loading) return;
    Animated.parallel([
      Animated.timing(sheetOpacity, { toValue: 1, duration: 480, useNativeDriver: true }),
      Animated.timing(sheetSlide,   { toValue: 0, duration: 480, useNativeDriver: true }),
    ]).start();
  }, [loading]);

  const actionGoals      = dailyData?.actionGoals ?? [];
  const dailyDua         = getDailyDua();
  const dailyAyah        = getDailyAyah();

  const firstName     = name ? name.split(' ')[0] : '';
  const greetingLines = firstName
    ? ['As-Salāmu ʿAlaykum,', firstName]
    : ['As-Salāmu ʿAlaykum.'];

  return (
    <>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe} edges={[]}>
        {/* Top half green so pull-down overscroll shows correct color */}
        <View style={styles.bgTop} />
        {/* Bottom cap — fades in with sheet to cover green on downward overscroll */}
        <Animated.View style={[styles.bgBottom, { opacity: sheetOpacity }]} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* ── Dark hero header ── */}
          <View style={[styles.hero, { paddingTop: insets.top + 8, backgroundColor: '#1B3D2F' }]}>
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
                      {'As-Salāmu ʿAlaykum' + (firstName ? ',' : '.') + '\n'}
                    </Text>
                    {firstName ? <Text style={styles.greetingName}>{firstName}</Text> : null}
                  </Text>
                )}
              </View>

              {/* Header right: shield + profile */}
              <View style={styles.heroRightRow}>
                <TouchableOpacity
                  style={styles.heroShieldBtn}
                  onPress={() => navigation.navigate('Alerts')}
                  activeOpacity={0.75}
                >
                  <Ionicons name="shield-outline" size={22} color="rgba(255,255,255,0.85)" />
                  {alertUnreadCount > 0 && (
                    <View style={styles.heroShieldBadge}>
                      <Text style={styles.heroShieldBadgeText}>
                        {alertUnreadCount > 9 ? '9+' : alertUnreadCount}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.heroProfileBtn}
                  onPress={() => navigation.navigate('Profile')}
                  activeOpacity={0.75}
                >
                  <View style={styles.heroProfileAvatar}>
                    {photoUrl ? (
                      <Image source={{ uri: photoUrl }} style={styles.heroProfilePhoto} cachePolicy="memory-disk" contentFit="cover" transition={150} />
                    ) : (
                      <Text style={styles.heroProfileInitial}>
                        {name ? name.charAt(0).toUpperCase() : '?'}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            </View>

          </View>

          {/* ── Content ── */}
          <Animated.View style={[styles.sheet, { opacity: sheetOpacity, transform: [{ translateY: sheetSlide }] }]}>
            <View style={styles.contentPad}>

              {/* Trial countdown banner */}
              {!isSubscribed && trialDaysLeft > 0 && (
                <View style={styles.trialBanner}>
                  <View style={styles.trialBannerLeft}>
                    <Text style={styles.trialBannerEmoji}>⏳</Text>
                    <View>
                      <Text style={styles.trialBannerTitle}>
                        {trialDaysLeft === 1 ? 'Last day of your free trial' : `${trialDaysLeft} days left in your free trial`}
                      </Text>
                      <Text style={styles.trialBannerSub}>Subscribe anytime to keep full access</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.trialBannerBtn}
                    onPress={() => navigation.navigate('Paywall')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.trialBannerBtnText}>Subscribe</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Setup banner — shown until children are added */}
              {(!hasChildren || !hasFamilyGoals) && (
                <TouchableOpacity
                  style={styles.setupBanner}
                  onPress={() => navigation.navigate('Tabs', { screen: 'Family', params: { tab: 'configure' } })}
                  activeOpacity={0.85}
                >
                  <View style={styles.setupBannerIcon}>
                    <Text style={{ fontSize: 20 }}>🌱</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.setupBannerTitle}>Finish setting up your family</Text>
                    <Text style={styles.setupBannerSub}>
                      {!hasChildren && !hasFamilyGoals
                        ? 'Add your children and set family goals to complete setup.'
                        : !hasChildren
                          ? 'Add your children to unlock personalised dashboards and growth plans.'
                          : 'Set family goals to complete setup.'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#2E7D62" />
                </TouchableOpacity>
              )}


              {/* TODAY'S PARENTING INSIGHTS */}
              <View style={styles.sectionTitleWrap}>
                <Text style={styles.sectionEyebrow}>DAILY</Text>
                <Text style={styles.sectionTitle}>Today's Insights</Text>
              </View>


              {spiritualInsight && (
                <TouchableOpacity
                  style={styles.insightCard}
                  activeOpacity={0.9}
                  onPress={() => navigation.navigate('InsightDetail', { insight: spiritualInsight, headerImage: dailySpiritualImage })}
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
                      </View>
                      <View style={styles.insightCardBottom}>
                        <Text style={styles.insightCardTitle}>{spiritualInsight.insightTitle}</Text>
                        <Text style={styles.insightCardBody} numberOfLines={3}>{spiritualInsight.body}</Text>
                        <View style={styles.insightCardFooter}>
                          {spiritReadToday && (
                            <View style={styles.insightReadTodayPill}>
                              <Ionicons name="checkmark-circle" size={13} color="#4ADE80" />
                              <Text style={styles.insightReadTodayText}>Read today</Text>
                            </View>
                          )}
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
                  onPress={() => navigation.navigate('InsightDetail', { insight: scienceInsight, headerImage: dailyScienceImage })}
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
                      </View>
                      <View style={styles.insightCardBottom}>
                        <Text style={styles.insightCardTitle}>{scienceInsight.insightTitle}</Text>
                        <Text style={styles.insightCardBody} numberOfLines={3}>{scienceInsight.body}</Text>
                        <View style={styles.insightCardFooter}>
                          {sciReadToday && (
                            <View style={styles.insightReadTodayPill}>
                              <Ionicons name="checkmark-circle" size={13} color="#4ADE80" />
                              <Text style={styles.insightReadTodayText}>Read today</Text>
                            </View>
                          )}
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

              {/* ── Habit of the Day ── */}
              {hasChildren && (() => {
                const { map: focusMap, planCompleteIds } = buildChildFocusMap(children, weekCompletions);
                const eligible = children.filter(c => focusMap[c.id] || planCompleteIds.has(c.id));
                if (!eligible.length) return null;
                const activeId = (focusChildId && (focusMap[focusChildId] || planCompleteIds.has(focusChildId)))
                  ? focusChildId
                  : (eligible.find(c => focusMap[c.id])?.id ?? eligible[0].id);
                const isPlanComplete = planCompleteIds.has(activeId);
                const focus = focusMap[activeId];
                const activeChild = children.find(c => c.id === activeId);
                const childColor = isPlanComplete ? (activeChild?.color ?? '#2E7D62') : focus.childColor;
                const childName  = isPlanComplete ? (activeChild?.name?.split(' ')[0] ?? '') : focus.childName;
                return (
                  <>
                    <View style={styles.sectionTitleWrap}>
                      <Text style={styles.sectionEyebrow}>DAILY</Text>
                      <Text style={styles.sectionTitle}>Practical Steps</Text>
                    </View>

                    <View style={styles.focusCard}>

                      {/* ── Header band ── */}
                      <View style={[styles.focusCardHeader, { backgroundColor: childColor }]}>
                        <Text style={styles.focusEyebrow}>{isPlanComplete ? '✅ PLAN COMPLETE' : '🌱 HABIT OF THE DAY'}</Text>
                        <View style={{ alignItems: 'flex-end' }}>
                          {eligible.length > 1 ? (
                            <TouchableOpacity
                              style={styles.focusChildSelector}
                              onPress={() => setFocusDropdownOpen(o => !o)}
                              activeOpacity={0.7}
                            >
                              <View style={styles.focusSelectorAvatar}>
                                {activeChild?.photo
                                  ? <Image source={{ uri: activeChild.photo }} style={styles.focusSelectorAvatarImg} contentFit="cover" cachePolicy="memory-disk" />
                                  : <Text style={styles.focusSelectorAvatarInitial}>{childName[0]}</Text>
                                }
                              </View>
                              <Text style={styles.focusChildSelectorText}>{childName}</Text>
                              <Ionicons name={focusDropdownOpen ? 'chevron-up' : 'chevron-down'} size={11} color="rgba(255,255,255,0.8)" />
                            </TouchableOpacity>
                          ) : (
                            <View style={styles.focusChildSelector}>
                              <View style={styles.focusSelectorAvatar}>
                                {activeChild?.photo
                                  ? <Image source={{ uri: activeChild.photo }} style={styles.focusSelectorAvatarImg} contentFit="cover" cachePolicy="memory-disk" />
                                  : <Text style={styles.focusSelectorAvatarInitial}>{childName[0]}</Text>
                                }
                              </View>
                              <Text style={styles.focusChildSelectorText}>{childName}</Text>
                            </View>
                          )}
                          {eligible.length > 1 && (
                            <Text style={styles.focusSwitchHint}>Tap to switch child</Text>
                          )}
                        </View>
                      </View>

                      {/* ── Dropdown ── */}
                      {focusDropdownOpen && eligible.length > 1 && (
                        <View style={styles.focusDropdown}>
                          {eligible.map(c => {
                            const isActive = c.id === activeId;
                            return (
                              <TouchableOpacity
                                key={c.id}
                                style={styles.focusDropdownItem}
                                onPress={() => { setFocusChildId(c.id); setFocusDropdownOpen(false); }}
                                activeOpacity={0.7}
                              >
                                <View style={[styles.focusDropdownAvatar, { backgroundColor: c.color ?? '#2E7D62' }]}>
                                  {c.photo
                                    ? <Image source={{ uri: c.photo }} style={styles.focusDropdownAvatarImg} contentFit="cover" cachePolicy="memory-disk" />
                                    : <Text style={styles.focusDropdownAvatarInitial}>{c.name[0]}</Text>
                                  }
                                </View>
                                <Text style={[styles.focusDropdownItemText, isActive && styles.focusDropdownItemActive]}>
                                  {c.name.split(' ')[0]}
                                </Text>
                                {isActive && <Ionicons name="checkmark" size={13} color="#2E7D62" style={{ marginLeft: 'auto' }} />}
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}

                      {/* ── Body ── */}
                      {isPlanComplete ? (
                        <View style={styles.focusCardBody}>
                          <View style={styles.planCompleteWrap}>
                            <Text style={styles.planCompleteEmoji}>🎉</Text>
                            <Text style={styles.planCompleteTitle}>Plan Complete</Text>
                            <Text style={styles.planCompleteBody}>
                              {childName} has finished all their current growth plans. Start a new one to keep the momentum going.
                            </Text>
                            <TouchableOpacity
                              style={[styles.planCompleteBtn, { backgroundColor: childColor }]}
                              onPress={() => navigation.navigate('Tabs', { screen: 'Dashboards', params: { childId: activeId } })}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.planCompleteBtnText}>Start a new plan →</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <View style={styles.focusCardBody}>
                          <Text style={styles.focusHabitText}>{focus.text}</Text>

                          {focus.wisdom && (
                            <View style={styles.focusWisdom}>
                              <Ionicons name="leaf-outline" size={12} color="#7C9E8B" />
                              <Text style={styles.focusWisdomText}>{focus.wisdom}</Text>
                            </View>
                          )}

                          <TouchableOpacity
                            onPress={() => navigation.navigate('Tabs', { screen: 'Dashboards', params: { childId: activeId } })}
                            activeOpacity={0.6}
                          >
                            <Text style={styles.focusLogLink}>Log it on their dashboard →</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </>
                );
              })()}




              {/* SAFETY WATCH DIGEST */}
              {/* Safety Watch — teaser when no children, digest when children exist */}
              {(() => {
                const rank = { high: 0, medium: 1, low: 2 };
                const totalCount = children.reduce((sum, c) => {
                  const snap = worldSnaps[c.id];
                  return sum + (snap?.safetyWatch ?? []).length;
                }, 0);
                const preview = children.flatMap(c => {
                  const snap = worldSnaps[c.id];
                  return (snap?.safetyWatch ?? [])
                    .map(a => ({ ...a, childName: c.name, childColor: c.color }))
                    .sort((a, b) => (rank[a.severity] ?? 1) - (rank[b.severity] ?? 1))
                    .slice(0, 2);
                });
                const hasAlerts = totalCount > 0;
                const remaining = totalCount - preview.length;

                return (
                  <>
                    <View style={[styles.sectionTitleWrap, { marginTop: 24 }]}>
                      <Text style={styles.sectionEyebrow}>THIS WEEK</Text>
                      <Text style={styles.sectionTitle}>Safety Watch</Text>
                    </View>

                    {!hasChildren ? (
                      /* Feature teaser — no children added yet */
                      <TouchableOpacity
                        style={styles.safetyTeaser}
                        activeOpacity={0.88}
                        onPress={() => navigation.navigate('AddChildWizard')}
                      >
                        <View style={styles.safetyTeaserHeader}>
                          <View style={styles.safetyTeaserIconWrap}>
                            <Ionicons name="shield-outline" size={20} color="#FFFFFF" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.safetyTeaserTitle}>Guidance begins with Understanding</Text>
                            <Text style={styles.safetyTeaserSub}>Weekly Youth Culture Updates</Text>
                          </View>
                        </View>
                        {[
                          { emoji: '🛡️', text: 'Real-time safety alerts by age group' },
                          { emoji: '📈', text: 'Youth culture & online trends this week' },
                          { emoji: '🔍', text: 'Islamic lens on what kids are exposed to' },
                        ].map((item, i) => (
                          <View key={i} style={styles.safetyTeaserRow}>
                            <Text style={{ fontSize: 13 }}>{item.emoji}</Text>
                            <Text style={styles.safetyTeaserRowText}>{item.text}</Text>
                          </View>
                        ))}
                        <Text style={styles.safetyTeaserPowered}>Powered by Google Trends, YouTube, Reddit, and more</Text>
                        <View style={styles.safetyTeaserCTA}>
                          <Text style={styles.safetyTeaserCTAText}>Add a child to unlock</Text>
                          <Ionicons name="arrow-forward" size={14} color="#1B3D2F" />
                        </View>
                      </TouchableOpacity>
                    ) : (
                      /* Safety digest — children exist */
                      <TouchableOpacity
                        style={[styles.safetyDigestCard, hasAlerts && styles.safetyDigestCardAlert]}
                        activeOpacity={0.88}
                        onPress={() => setCultureModalOpen(true)}
                      >
                        <View style={styles.safetyDigestHeader}>
                          <View style={[styles.safetyDigestIconWrap, !hasAlerts && { backgroundColor: '#EDF7F2' }]}>
                            <Text style={{ fontSize: 18 }}>{hasAlerts ? '🛡️' : '✅'}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.safetyDigestTitle, !hasAlerts && { color: '#1B4D3E' }]}>
                              {hasAlerts
                                ? `${totalCount} safety alert${totalCount > 1 ? 's' : ''}`
                                : 'No safety alerts this week'}
                            </Text>
                            <Text style={[styles.safetyDigestSub, !hasAlerts && { color: '#2E7D62' }]}>
                              {hasAlerts ? 'Tap to view full youth culture digest' : 'Tap to view youth culture digest'}
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={16} color={hasAlerts ? '#DC2626' : '#2E7D62'} />
                        </View>

                        {hasAlerts && preview.map((alert, i) => (
                          <View key={i} style={styles.safetyDigestRow}>
                            <View style={[styles.safetyDigestSeverityDot, {
                              backgroundColor: alert.severity === 'high' ? '#DC2626' : alert.severity === 'medium' ? '#D4871A' : '#9CA3AF',
                            }]} />
                            <Text style={styles.safetyDigestThreat} numberOfLines={1}>{alert.threat}</Text>
                            {children.length > 1 && (
                              <View style={[styles.safetyDigestChildPill, { backgroundColor: alert.childColor + '22' }]}>
                                <Text style={[styles.safetyDigestChildName, { color: alert.childColor }]}>{alert.childName}</Text>
                              </View>
                            )}
                          </View>
                        ))}

                        {remaining > 0 && (
                          <Text style={styles.safetyDigestMore}>+{remaining} more</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </>
                );
              })()}

              {/* Family Goals */}
              {(() => {
                const preview = familyGoals.slice(0, 4);
                const overflow = familyGoals.length - preview.length;
                return (
                  <>
                    <View style={[styles.sectionTitleWrap, { marginTop: 24 }]}>
                      <Text style={styles.sectionEyebrow}>THIS WEEK</Text>
                      <Text style={styles.sectionTitle}>Family Goals</Text>
                    </View>

                    {familyGoals.length === 0 ? (
                      <TouchableOpacity
                        style={styles.goalsTeaser}
                        activeOpacity={0.88}
                        onPress={() => navigation.navigate('FamilyGoalWizard')}
                      >
                        <View style={styles.goalsTeaserRow}>
                          <View style={styles.goalsTeaserIconWrap}>
                            <Text style={{ fontSize: 20 }}>🎯</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.goalsTeaserTitle}>Set your family goals</Text>
                            <Text style={styles.goalsTeaserSub}>Pray together, read Quran, eat as a family — track what matters most</Text>
                          </View>
                        </View>
                        <View style={styles.goalsTeaserCTA}>
                          <Text style={styles.goalsTeaserCTAText}>Add your first goal</Text>
                          <Ionicons name="arrow-forward" size={14} color="#1B3D2F" />
                        </View>
                      </TouchableOpacity>
                    ) : (
                    <View style={styles.goalsCard}>
                      {preview.map((goal, idx) => {
                        const target    = goal.frequency ?? 1;
                        const count     = countThisWeek(goalCompletions, goal.id);
                        const doneToday = isCompletedToday(goalCompletions, goal.id);
                        const goalMet   = count >= target;
                        const pct       = Math.min(Math.round((count / target) * 100), 100);
                        const fillColor = goalMet ? '#2E7D62' : (count > 0 ? '#4A90D9' : '#D1D5DB');
                        return (
                          <View key={goal.id}>
                            {idx > 0 && <View style={styles.goalDivider} />}
                            <View style={styles.goalRow}>
                              <View style={[styles.goalIconWrap, { backgroundColor: (goal.iconColor ?? '#2E7D62') + '18' }]}>
                                <Text style={{ fontSize: 20 }}>{getGoalEmoji(goal)}</Text>
                              </View>
                              <View style={styles.goalBody}>
                                <View style={styles.goalTitleRow}>
                                  <Text style={styles.goalCardTitle} numberOfLines={1}>{goal.title}</Text>
                                  {goalMet ? (
                                    <View style={styles.goalMetPill}>
                                      <Ionicons name="checkmark-circle" size={12} color="#2E7D62" />
                                      <Text style={styles.goalMetText}>Done</Text>
                                    </View>
                                  ) : (
                                    <TouchableOpacity
                                      style={[styles.goalLogBtn, doneToday && styles.goalLogBtnDone]}
                                      disabled={doneToday}
                                      onPress={async () => {
                                        const updated = await logGoalCompletion(goal.id);
                                        setGoalCompletions([...updated]);
                                      }}
                                      activeOpacity={0.75}
                                    >
                                      <Ionicons name={doneToday ? 'checkmark' : 'add'} size={12} color={doneToday ? '#2E7D62' : '#fff'} />
                                      <Text style={[styles.goalLogBtnText, doneToday && { color: '#2E7D62' }]}>{doneToday ? 'Logged' : 'Log it'}</Text>
                                    </TouchableOpacity>
                                  )}
                                </View>
                                <View style={styles.goalBarRow}>
                                  <View style={styles.goalBarTrack}>
                                    <View style={[styles.goalBarFill, { width: `${pct}%`, backgroundColor: fillColor }]} />
                                  </View>
                                  <Text style={styles.goalBarLabel}>{count}/{target}</Text>
                                </View>
                                <Text style={styles.goalStatusText}>
                                  {goalMet ? '🎯 Goal met this week' : `${goal.frequencyLabel} · ${target - count} to go`}
                                </Text>
                              </View>
                            </View>
                          </View>
                        );
                      })}
                      {overflow > 0 && (
                        <TouchableOpacity
                          style={styles.goalsSeeAll}
                          onPress={() => navigation.navigate('Tabs', { screen: 'Family', params: { tab: 'goals' } })}
                          activeOpacity={0.75}
                        >
                          <Text style={styles.goalsSeeAllText}>See {overflow} more goal{overflow > 1 ? 's' : ''}</Text>
                          <Ionicons name="chevron-forward" size={13} color="#2E7D62" />
                        </TouchableOpacity>
                      )}
                    </View>
                    )}
                  </>
                );
              })()}

              {/* MONTHLY LEADERBOARD — only when partner sync is on */}
              {partnerSyncOn && (() => {
                const mySpir  = spirMonth.filter(d => d.completed).length;
                const mySci   = sciMonth.filter(d => d.completed).length;
                const myQuran = quranMonth.filter(d => d.completed).length;
                const myTotal = mySpir + mySci + myQuran + myHabAct.habits + myHabAct.activities;
                const ROWS = [
                  { label: 'Spiritual',  icon: 'moon',                  color: '#4ADE80' },
                  { label: 'Research',   icon: 'bulb-outline',          color: '#F59E0B' },
                  { label: 'Quran',      icon: 'book-outline',          color: '#93C5FD' },
                  { label: 'Habits',     icon: 'repeat-outline',        color: '#86EFAC' },
                  { label: 'Activities', icon: 'color-palette-outline', color: '#FCD34D' },
                ];
                const myScore = r => r.label === 'Habits' ? myHabAct.habits : r.label === 'Activities' ? myHabAct.activities : r.label === 'Spiritual' ? mySpir : r.label === 'Research' ? mySci : myQuran;

                if (!syncStatus.linked) {
                  return (
                    <>
                      <View style={[styles.sectionTitleWrap, { marginTop: 24 }]}>
                        <Text style={styles.sectionEyebrow}>THIS MONTH</Text>
                        <Text style={styles.sectionTitle}>Monthly Leaderboard</Text>
                      </View>
                      <View style={styles.homeLeaderCard}>
                        <View style={styles.homeLbColRow}>
                          <Text style={styles.homeLbColLabel}>YOU</Text>
                          <View style={{ flex: 1 }} />
                          <Text style={[styles.homeLbColLabel, { color: 'rgba(255,255,255,0.25)' }]}>PARTNER</Text>
                        </View>
                        {ROWS.map(r => (
                          <View key={r.label} style={styles.homeLbRow}>
                            <Text style={styles.homeLbScore}>{myScore(r)}</Text>
                            <View style={styles.homeLbMid}>
                              <View style={styles.homeLbBarWrap}>
                                <View style={[styles.homeLbBarFillL, { width: '60%', backgroundColor: r.color + '55' }]} />
                              </View>
                              <View style={[styles.homeLbCatPill, { backgroundColor: r.color + '22' }]}>
                                <Ionicons name={r.icon} size={10} color={r.color} />
                                <Text style={[styles.homeLbCatText, { color: r.color }]}>{r.label}</Text>
                              </View>
                              <View style={[styles.homeLbBarWrap, { opacity: 0.25 }]}>
                                <View style={[styles.homeLbBarFillR, { width: '40%', backgroundColor: '#FFFFFF' }]} />
                              </View>
                            </View>
                            <Text style={[styles.homeLbScore, { color: 'rgba(255,255,255,0.15)' }]}>?</Text>
                          </View>
                        ))}
                        <View style={styles.homeLbDivider} />
                        <TouchableOpacity style={styles.homeLbUnlockBtn} onPress={() => navigation.navigate('FamilySync')} activeOpacity={0.85}>
                          <Ionicons name="people-outline" size={14} color="#1B3D2F" />
                          <Text style={styles.homeLbUnlockText}>Sync with your partner to see the leaderboard</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  );
                }

                const partnerFirstName = syncStatus.partner?.name?.split(' ')[0] ?? 'Partner';
                const prtTotal = partnerCounts.spiritual + partnerCounts.scientific + partnerCounts.quran + prtHabAct.habits + prtHabAct.activities;
                const prtScore = r => r.label === 'Habits' ? prtHabAct.habits : r.label === 'Activities' ? prtHabAct.activities : r.label === 'Spiritual' ? partnerCounts.spiritual : r.label === 'Research' ? partnerCounts.scientific : partnerCounts.quran;
                const winnerData = myTotal > prtTotal
                  ? { text: "You're leading — Ma Shaa Allah!", icon: 'trophy',         iconColor: '#C9A84C' }
                  : prtTotal > myTotal
                    ? { text: `${partnerFirstName} is leading — keep going!`, icon: 'barbell-outline', iconColor: '#86EFAC' }
                    : { text: "You're tied — great effort, both of you!", icon: 'people-outline', iconColor: '#93C5FD' };
                return (
                  <>
                    <View style={[styles.sectionTitleWrap, { marginTop: 24 }]}>
                      <Text style={styles.sectionEyebrow}>THIS MONTH</Text>
                      <Text style={styles.sectionTitle}>Monthly Leaderboard</Text>
                    </View>
                    <View style={styles.homeLeaderCard}>
                      <View style={styles.homeLbColRow}>
                        <Text style={styles.homeLbColLabel}>YOU</Text>
                        <View style={{ flex: 1 }} />
                        <Text style={styles.homeLbColLabel}>{partnerFirstName.toUpperCase()}</Text>
                      </View>
                      {ROWS.map(r => {
                        const my = myScore(r), partner = prtScore(r);
                        const max = Math.max(my, partner, 1);
                        return (
                          <View key={r.label} style={styles.homeLbRow}>
                            <Text style={[styles.homeLbScore, my > partner && styles.homeLbScoreWin]}>{my}</Text>
                            <View style={styles.homeLbMid}>
                              <View style={styles.homeLbBarWrap}>
                                <View style={[styles.homeLbBarFillL, { width: `${(my / max) * 100}%`, backgroundColor: r.color + 'CC' }]} />
                              </View>
                              <View style={[styles.homeLbCatPill, { backgroundColor: r.color + '22' }]}>
                                <Ionicons name={r.icon} size={10} color={r.color} />
                                <Text style={[styles.homeLbCatText, { color: r.color }]}>{r.label}</Text>
                              </View>
                              <View style={styles.homeLbBarWrap}>
                                <View style={[styles.homeLbBarFillR, { width: `${(partner / max) * 100}%`, backgroundColor: r.color + 'CC' }]} />
                              </View>
                            </View>
                            <Text style={[styles.homeLbScore, partner > my && styles.homeLbScoreWin]}>{partner}</Text>
                          </View>
                        );
                      })}
                      <View style={styles.homeLbDivider} />
                      <View style={styles.homeLbTotalRow}>
                        <Text style={[styles.homeLbTotalNum, myTotal >= prtTotal && myTotal > 0 && styles.homeLbScoreWin]}>{myTotal}</Text>
                        <Text style={styles.homeLbTotalLabel}>TOTAL</Text>
                        <Text style={[styles.homeLbTotalNum, prtTotal > myTotal && styles.homeLbScoreWin]}>{prtTotal}</Text>
                      </View>
                      <View style={styles.homeLbWinnerRow}>
                        <Ionicons name={winnerData.icon} size={13} color={winnerData.iconColor} />
                        <Text style={styles.homeLbWinner}>{winnerData.text}</Text>
                      </View>
                    </View>
                  </>
                );
              })()}

              <ChallengeCard navigation={navigation} onChallenge={() => navigation.navigate('ChallengeWizard')} focusCount={challengeFocus} />

              {/* YOU'RE NOT ALONE — hidden, re-enable in future release */}

              {/* VERSES OF THE DAY */}
              <View style={[styles.sectionTitleWrap, { marginTop: 24 }]}>
                <Text style={styles.sectionEyebrow}>QURAN</Text>
                <Text style={styles.sectionTitle}>Verses of the Day</Text>
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
                <Text style={styles.sectionEyebrow}>DAILY</Text>
                <Text style={styles.sectionTitle}>Dua of the Day</Text>
              </View>
              <ImageBackground
                source={require('../../assets/spiritual-5.jpg')}
                style={styles.islamicCard}
                imageStyle={{ borderRadius: 20 }}
                resizeMode="cover"
              >
                <LinearGradient
                  colors={['rgba(15,50,35,0.55)', 'rgba(10,35,25,0.80)']}
                  style={[StyleSheet.absoluteFill, { borderRadius: 20 }]}
                />
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
                <View style={{ paddingTop: 14, paddingHorizontal: 4 }}>
                  <Text style={styles.islamicArabic}>{dailyDua.arabic?.replace(/[ۖ-ۭ]/g, '').trim()}</Text>
                </View>
                <View style={styles.islamicDivider} />
                <Text style={styles.islamicTranslit}>{dailyDua.transliteration}</Text>
                <Text style={styles.islamicTranslation}>{dailyDua.translation}</Text>
                <Text style={styles.islamicRef}>{dailyDua.reference}</Text>

                <TouchableOpacity style={styles.duaShareBtn} onPress={handleShareDua} activeOpacity={0.8} disabled={duaSharing}>
                  {duaSharing
                    ? <ActivityIndicator size="small" color="#1B3D2F" />
                    : <Ionicons name="share-outline" size={15} color="#1B3D2F" />
                  }
                  <Text style={styles.duaShareBtnText}>Share Dua</Text>
                </TouchableOpacity>
              </ImageBackground>

{__DEV__ && (
                <TouchableOpacity style={styles.devRefreshBtn} onPress={devForceRefresh} activeOpacity={0.7}>
                  <Ionicons name={devRefreshing ? 'sync' : 'refresh-outline'} size={13} color="#9CA3AF" />
                  <Text style={styles.devRefreshText}>{devRefreshing ? 'Refreshing…' : 'DEV — Force refresh insights'}</Text>
                </TouchableOpacity>
              )}

              <View style={{ height: 32 }} />
            </View>
          </Animated.View>

        </ScrollView>

      <EncouragementModal
        visible={!!encouragement}
        emoji={encouragement?.emoji}
        title={encouragement?.title}
        body={encouragement?.body}
        onClose={() => setEncouragement(null)}
      />

      <YouthCultureModal
        visible={cultureModalOpen}
        onClose={() => { setCultureModalOpen(false); refreshChildrenAndSnaps(); }}
        children={children}
        initialChildId={cultureModalChildId}
      />

      </SafeAreaView>

      {/* ── Off-screen dua share card ── */}
      <View style={styles.duaShareCardWrap}>
        <View ref={duaShareCardRef} style={styles.duaShareCard} collapsable={false}>
          <RNImage source={require('../../assets/spiritual-5.jpg')} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <LinearGradient colors={['rgba(15,50,35,0.4)', 'rgba(5,20,12,0.95)']} style={styles.duaShareCardOverlay}>
            <View style={styles.duaShareCardPill}>
              <Text style={styles.duaShareCardPillText}>DUA OF THE DAY</Text>
            </View>
            <View style={styles.duaShareCardBody}>
              {dailyDua?.title ? <Text style={styles.duaShareCardTitle}>{dailyDua.title}</Text> : null}
              <Text style={styles.duaShareCardArabic}>{dailyDua?.arabic}</Text>
              <Text style={styles.duaShareCardTranslit}>{dailyDua?.transliteration}</Text>
              <Text style={styles.duaShareCardTranslation}>{'\u201C'}{dailyDua?.translation}{'\u201D'}</Text>
              <Text style={styles.duaShareCardRef}>{dailyDua?.reference}</Text>
            </View>
            <View style={styles.duaShareCardBrand}>
              <View style={styles.duaShareCardBrandRow}>
                <RNImage source={require('../../assets/app-icons-1/logo-Picsart-BackgroundRemover.png')} style={styles.duaShareCardLogo} resizeMode="contain" />
                <Text style={styles.duaShareCardBrandName}>Tarbiyah: Islamic Parenting</Text>
              </View>
              <Text style={styles.duaShareCardBrandTag}>Download the app and get daily insights!</Text>
              <View style={styles.duaShareCardStorePills}>
                <View style={styles.duaShareCardPillStore}>
                  <Ionicons name="logo-apple" size={11} color="rgba(255,255,255,0.6)" />
                  <Text style={styles.duaShareCardPillStoreText}>App Store</Text>
                </View>
                <View style={styles.duaShareCardPillStore}>
                  <Ionicons name="logo-google-playstore" size={11} color="rgba(255,255,255,0.6)" />
                  <Text style={styles.duaShareCardPillStoreText}>Google Play</Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1B3D2F' },

  // ── Family Goals ──
  goalsContainer:  { overflow: 'hidden' },
  goalsCard:          { backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden', marginBottom: 4 },
  goalsSeeAll:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F0F4F2' },
  goalsSeeAllText:    { fontSize: 13, fontWeight: '600', color: '#2E7D62' },
  goalsTeaser:        { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 4 },
  goalsTeaserRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  goalsTeaserIconWrap:{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#EDF7F2', alignItems: 'center', justifyContent: 'center' },
  goalsTeaserTitle:   { fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 3 },
  goalsTeaserSub:     { fontSize: 12, color: '#6B7280', lineHeight: 17 },
  goalsTeaserCTA:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#EDF7F2', borderRadius: 12, paddingVertical: 11 },
  goalsTeaserCTAText: { fontSize: 14, fontWeight: '700', color: '#1B3D2F' },
  goalDivider:     { height: 1, backgroundColor: '#F0F4F2', marginHorizontal: 16 },
  goalRow:         { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16 },
  goalIconWrap:    { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  goalBody:        { flex: 1 },
  goalTitleRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  goalCardTitle:   { fontSize: 14, fontWeight: '700', color: '#111827', flex: 1 },
  goalBarRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  goalBarTrack:    { flex: 1, height: 6, backgroundColor: '#F0F4F2', borderRadius: 100, overflow: 'hidden' },
  goalBarFill:     { height: 6, borderRadius: 100 },
  goalBarLabel:    { fontSize: 11, fontWeight: '700', color: '#6B7280', minWidth: 26, textAlign: 'right' },
  goalStatusText:  { fontSize: 11, color: '#9CA3AF' },
  goalMetPill:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EDF7F2', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5 },
  goalMetText:     { fontSize: 11, fontWeight: '700', color: '#2E7D62' },
  goalLogBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1B3D2F', borderRadius: 100, paddingHorizontal: 11, paddingVertical: 6 },
  goalLogBtnDone:  { backgroundColor: '#EDF7F2' },
  goalLogBtnText:  { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },

  // ── Celebration modal ──
  celebOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  celebCard:     { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 28, alignItems: 'center', width: '100%' },
  celebEmoji:    { fontSize: 52, marginBottom: 12 },
  celebTitle:    { fontSize: 26, fontWeight: '800', color: '#1B3D2F', marginBottom: 12 },
  celebBody:     { fontSize: 15, color: '#4B5563', textAlign: 'center', lineHeight: 23, marginBottom: 24 },
  celebBtn:      { backgroundColor: '#1B3D2F', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32 },
  celebBtnText:  { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  bgTop: { position: 'absolute', top: 0, left: 0, right: 0, height: '50%', backgroundColor: '#1B3D2F' },
  bgBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 300, backgroundColor: '#F5F6F8' },

  // ── Hero header ──
  hero: {
    paddingHorizontal: hp,
    paddingBottom: 0,
    overflow: 'hidden',
  },
  heroBgImage: {
    resizeMode: 'cover',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  heroText: { flex: 1 },
  heroRightRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroShieldBtn: { position: 'relative', padding: 4 },
  heroShieldBadge: {
    position: 'absolute', top: 0, right: 0,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: '#1B3D2F',
  },
  heroShieldBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFFFFF' },
  heroProfileBtn: {
    padding: 4,
    alignItems: 'center',
    gap: 5,
  },
  heroProfileAvatar: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroProfilePhoto: {
    width: 26, height: 26, borderRadius: 13,
  },
  heroProfileInitial: {
    fontSize: 12, fontWeight: '700', color: '#FFFFFF',
  },
  heroProfileDate: {
    fontSize: 10, fontWeight: '500', color: 'rgba(255,255,255,0.5)', letterSpacing: 0.3,
  },
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
  // ── Partner score strip ──
  scoreStrip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14,
    marginTop: 14, marginBottom: 4,
  },
  scoreSide: {
    flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1,
  },
  scoreSideRight: { justifyContent: 'flex-end' },
  scoreSideWin: {},
  scoreNum: {
    fontSize: 22, fontWeight: '800', color: 'rgba(255,255,255,0.4)',
  },
  scoreNumWin: { color: '#FFFFFF' },
  scoreLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.35)',
  },
  scoreLabelWin: { color: 'rgba(255,255,255,0.7)' },
  scoreVs: {
    fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 10,
  },

  greetingLine:  { color: '#FFFFFF' },
  greetingSmall: { fontSize: 11, fontWeight: '300', color: 'rgba(255,255,255,0.65)', letterSpacing: 0.3, lineHeight: 18 },
  greetingName:  { fontSize: 20, fontWeight: '600', color: '#FFFFFF', lineHeight: 26, marginTop: 1 },
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  scrollContent: { flexGrow: 1 },
  contentPad: { paddingHorizontal: hp, paddingTop: 8, paddingBottom: 36 },

  // ── Section titles ──
  // Safety Watch digest card
  safetyDigestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#1B3D2F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  safetyDigestCardAlert: {
    borderColor: '#FECACA',
    backgroundColor: '#FFFAFA',
  },
  safetyDigestHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12,
  },
  safetyDigestIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#FEF2F2',
    alignItems: 'center', justifyContent: 'center',
  },
  safetyDigestTitle: {
    fontSize: 15, fontWeight: '800', color: '#991B1B', marginBottom: 1,
  },
  safetyDigestSub: {
    fontSize: 11, color: '#DC2626',
  },
  safetyDigestRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 6,
    borderTopWidth: 1, borderTopColor: '#FEE2E2',
  },
  safetyDigestSeverityDot: {
    width: 7, height: 7, borderRadius: 4, flexShrink: 0,
  },
  safetyDigestThreat: {
    flex: 1, fontSize: 13, color: '#374151', fontWeight: '600',
  },
  safetyDigestChildPill: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
  },
  safetyDigestChildName: {
    fontSize: 11, fontWeight: '700',
  },
  safetyDigestMore: {
    fontSize: 11, color: '#DC2626', fontWeight: '600',
    marginTop: 8, textAlign: 'right',
  },

  // Feature teaser — shown when no children added
  safetyTeaser: {
    backgroundColor: '#1B3D2F',
    borderRadius: 16,
    padding: 16,
    marginBottom: 4,
  },
  safetyTeaserHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginBottom: 14,
  },
  safetyTeaserIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  safetyTeaserTitle: {
    fontSize: 15, fontWeight: '800', color: '#FFFFFF', marginBottom: 2,
  },
  safetyTeaserSub: {
    fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '500',
  },
  safetyTeaserRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
  },
  safetyTeaserRowText: {
    fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500',
  },
  safetyTeaserPowered: { fontSize: 10, color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: 10, marginBottom: 2 },
  safetyTeaserCTA: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12, paddingVertical: 11,
    marginTop: 14,
  },
  safetyTeaserCTAText: {
    fontSize: 14, fontWeight: '700', color: '#1B3D2F',
  },

  trialBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFF8EC', borderRadius: 14, padding: 12,
    marginBottom: 6, borderWidth: 1, borderColor: '#F5D78E',
  },
  trialBannerLeft:    { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  trialBannerEmoji:   { fontSize: 20 },
  trialBannerTitle:   { fontSize: 13, fontWeight: '700', color: '#92400E', marginBottom: 1 },
  trialBannerSub:     { fontSize: 11, color: '#B45309' },
  trialBannerBtn:     { backgroundColor: '#1B3D2F', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, marginLeft: 10 },
  trialBannerBtnText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },

  setupBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#EDF7F2', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#C6E8DA', marginBottom: 4,
  },
  setupBannerIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
  },
  setupBannerTitle: { fontSize: 14, fontWeight: '800', color: '#1B3D2F', marginBottom: 2 },
  setupBannerSub:   { fontSize: 12, color: '#4B7A60', lineHeight: 17 },

  focusCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 4,
    overflow: 'hidden',
    shadowColor: '#1B3D2F', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 4,
  },
  planCompleteWrap:  { alignItems: 'center', paddingVertical: 8 },
  planCompleteEmoji: { fontSize: 32, marginBottom: 8 },
  planCompleteTitle: { fontSize: 17, fontWeight: '800', color: '#1A1A2E', marginBottom: 6 },
  planCompleteBody:  { fontSize: 13, color: '#6B7280', lineHeight: 20, textAlign: 'center', marginBottom: 18 },
  planCompleteBtn:   { borderRadius: 12, paddingHorizontal: 22, paddingVertical: 12 },
  planCompleteBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  focusCardHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  focusCardBody: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 },
  focusEyebrow: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.9)', letterSpacing: 0.5 },
  focusChildSelector: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 100,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  focusChildSelectorText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  focusSelectorAvatar: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  focusSelectorAvatarImg:     { width: 24, height: 24, borderRadius: 12 },
  focusSelectorAvatarInitial: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },
  focusSwitchHint: { fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 5, textAlign: 'right' },
  focusDropdown: {
    backgroundColor: '#F8FAF9', borderBottomLeftRadius: 16, borderBottomRightRadius: 16,
    borderTopWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden',
  },
  focusDropdownItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 11, paddingHorizontal: 16,
  },
  focusDropdownAvatar: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  focusDropdownAvatarImg:     { width: 28, height: 28, borderRadius: 14 },
  focusDropdownAvatarInitial: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  focusDropdownItemText:   { fontSize: 13, fontWeight: '500', color: '#6B7280' },
  focusDropdownItemActive: { color: '#1A1A2E', fontWeight: '700' },
  focusHabitText: { fontSize: 15, fontWeight: '400', color: '#1A1A2E', lineHeight: 23, marginBottom: 12 },
  focusWisdom: {
    flexDirection: 'row', gap: 7, alignItems: 'flex-start',
    backgroundColor: '#EDF7F2', borderRadius: 8, padding: 10, marginBottom: 12,
  },
  focusWisdomText: { flex: 1, fontSize: 12, color: '#1B4D3E', lineHeight: 18, fontWeight: '500' },
  focusLogLink: { fontSize: 12, fontWeight: '600', color: '#2E7D62', textAlign: 'right' },
  sectionTitleWrap: {
    marginTop: 10,
    marginBottom: 14,
  },
  sectionEyebrow: {
    fontSize: 10, fontWeight: '700',
    color: '#2E7D62', letterSpacing: 1, marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 16, fontWeight: '800', color: '#1B3D2F',
  },
  sectionUnderline: {
    width: 3, height: 13, borderRadius: 2,
    backgroundColor: '#1B3D2F', opacity: 0.3,
  },
  sectionSeeAll: {
    fontSize: 11, fontWeight: '700', color: '#2E7D62', marginLeft: 'auto',
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 4,
  },
  insightCardSpeaker: {
    fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.2,
  },
  insightReadTodayPill: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  insightReadTodayText: { fontSize: 12, fontWeight: '600', color: '#4ADE80' },
  insightReadMore: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
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
    lineHeight: 60,
    fontFamily: 'KFGQPCHafs',
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
    lineHeight: 52,
    fontFamily: 'KFGQPCHafs',
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

  // ── Streak count badges ──
  streakRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  streakCountCard: {
    flex: 1, borderRadius: 16, padding: 14,
    alignItems: 'center', gap: 2,
  },
  streakCountNum: {
    fontSize: 28, fontWeight: '800', letterSpacing: -1, marginTop: 6,
  },
  streakCountLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.3, marginTop: 4,
  },
  streakCountSub: { fontSize: 10, color: '#9CA3AF', fontWeight: '500' },

  // ── Children progress unified card ──
  cpCard: {
    backgroundColor: '#FFFFFF', borderRadius: 18,
    borderWidth: 1, borderColor: '#E2EDE9',
    shadowColor: '#1B3D2F', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
    overflow: 'hidden',
  },
  cpCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: '#F0F4F2',
    backgroundColor: '#F8FCFA',
  },
  cpCardHeaderText: { fontSize: 13, fontWeight: '700', color: '#1B3D2F' },
  cpCardHeaderSub:  { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  cpCardEmpty: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20, gap: 6 },
  cpRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  cpRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  cpAvatar: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  cpAvatarPhoto:   { width: 46, height: 46, borderRadius: 23 },
  cpAvatarInitial: { fontSize: 19, fontWeight: '800', color: '#FFF' },
  cpInfo:    { flex: 1 },
  cpName:    { fontSize: 15, fontWeight: '700', color: '#1A1A2E', marginBottom: 4 },
  cpAgePill: { alignSelf: 'flex-start', backgroundColor: '#EDF7F2', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2 },
  cpAgeText: { fontSize: 11, fontWeight: '600', color: '#2E7D62' },
  cpStats:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cpStatItem:    { alignItems: 'center' },
  cpStatNum:     { fontSize: 20, fontWeight: '800', lineHeight: 24 },
  cpStatLabel:   { fontSize: 9, color: '#9CA3AF', fontWeight: '600', letterSpacing: 0.3, marginTop: 1 },
  cpStatDivider: { width: 1, height: 28, backgroundColor: '#E5E7EB' },
  cpNoAreas:     { fontSize: 11, color: '#C3DDD6', fontWeight: '500', flex: 1, textAlign: 'right' },

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

  // ── Share Dua button ──
  duaShareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, marginTop: 14, backgroundColor: '#FFFFFF',
    borderRadius: 12, paddingVertical: 11,
  },
  duaShareBtnText: { fontSize: 13, fontWeight: '700', color: '#1B3D2F' },

  // ── You're Not Alone ──
  trendingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  trendingCardSubtitle: {
    fontSize: 12,
    color: 'rgba(27,61,47,0.45)',
    marginBottom: 8,
    marginTop: 10,
    letterSpacing: 0.2,
  },
  trendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
  },
  trendingRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(27,61,47,0.07)',
  },
  trendingLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1B3D2F',
    letterSpacing: 0.1,
  },
  trendingCountBadge: {
    backgroundColor: 'rgba(27,61,47,0.07)',
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  trendingCount: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(27,61,47,0.55)',
  },

  // ── Off-screen dua share card ──
  duaShareCardWrap: { position: 'absolute', top: -9999, left: 0, width: 375 },
  duaShareCard: { width: 375, overflow: 'hidden' },
  duaShareCardOverlay: { padding: 32, paddingBottom: 28, gap: 24 },
  duaShareCardPill: {
    alignSelf: 'flex-start', borderRadius: 100,
    paddingHorizontal: 14, paddingVertical: 6,
    backgroundColor: 'rgba(27,61,47,0.8)',
  },
  duaShareCardPillText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF', letterSpacing: 1.4 },
  duaShareCardBody: { gap: 12 },
  duaShareCardTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  duaShareCardArabic: { fontSize: 26, fontFamily: 'KFGQPCHafs', color: '#FFFFFF', textAlign: 'right', lineHeight: 56 },
  duaShareCardTranslit: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontStyle: 'italic' },
  duaShareCardTranslation: { fontSize: 15, color: 'rgba(255,255,255,0.85)', lineHeight: 24, fontStyle: 'italic' },
  duaShareCardRef: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.4)', letterSpacing: 0.5 },
  duaShareCardBrand: {
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)', paddingTop: 16, gap: 4,
  },
  duaShareCardBrandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  duaShareCardLogo: { width: 22, height: 22 },
  duaShareCardBrandName: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  duaShareCardBrandTag: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  duaShareCardStorePills: { flexDirection: 'row', gap: 8, marginTop: 6 },
  duaShareCardPillStore: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  duaShareCardPillStoreText: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },

  childEmptyCard: {
    backgroundColor: '#FFFFFF', borderRadius: 18, overflow: 'hidden', marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  childEmptyTop: { alignItems: 'center', paddingTop: 24, paddingBottom: 16, paddingHorizontal: 20, gap: 8 },
  childEmptyIconWrap: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#E8F5EF', alignItems: 'center', justifyContent: 'center' },
  childEmptyLabel: { fontSize: 15, fontWeight: '700', color: '#1C1C1E' },
  childEmptySub: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 19 },
  childEmptyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingVertical: 14,
  },
  childEmptyBtnText: { fontSize: 14, fontWeight: '700', color: '#1B3D2F' },

  // ── Home leaderboard card ──
  homeLeaderCard: {
    backgroundColor: '#1B3D2F', borderRadius: 20, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 4,
  },
  homeLbLockPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(201,168,76,0.15)', borderRadius: 100,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  homeLbLockText: { fontSize: 10, fontWeight: '600', color: '#C9A84C' },
  homeLbColRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  homeLbColLabel: { fontSize: 14, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
  homeLbRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 },
  homeLbScore: { width: 28, fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.55)', textAlign: 'center' },
  homeLbScoreWin: { color: '#FFFFFF' },
  homeLbMid: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  homeLbBarWrap: { flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' },
  homeLbBarFillL: { height: 4, borderRadius: 2, alignSelf: 'flex-end' },
  homeLbBarFillR: { height: 4, borderRadius: 2 },
  homeLbCatPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 },
  homeLbCatText: { fontSize: 10, fontWeight: '600' },
  homeLbDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 10 },
  homeLbTotalRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  homeLbTotalNum: { width: 28, fontSize: 15, fontWeight: '800', color: 'rgba(255,255,255,0.55)', textAlign: 'center' },
  homeLbTotalLabel: { flex: 1, fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.35)', textAlign: 'center', letterSpacing: 1 },
  homeLbWinnerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  homeLbWinner: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.65)' },
  homeLbUnlockBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#D4A843', borderRadius: 12, paddingVertical: 11,
  },
  homeLbUnlockText: { fontSize: 13, fontWeight: '700', color: '#1B3D2F' },
});
