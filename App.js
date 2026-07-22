import React, { useEffect, useState, useRef, createContext, useContext } from 'react';
import {
  View, StyleSheet, Text,
  Animated, TouchableOpacity, AppState,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Amiri_400Regular, Amiri_700Bold } from '@expo-google-fonts/amiri';
import AsyncStorage from '@react-native-async-storage/async-storage';

SplashScreen.preventAutoHideAsync();

import HomeScreen          from './src/screens/HomeScreen';
import LibraryScreen       from './src/screens/LibraryScreen';
import ProgressScreen      from './src/screens/ProgressScreen';
import LearnScreen         from './src/screens/LearnScreen';
import GuideMeNowScreen    from './src/screens/GuideMeNowScreen';
import MyLibraryScreen     from './src/screens/MyLibraryScreen';
import ModuleDetailScreen  from './src/screens/ModuleDetailScreen';
import LessonReaderScreen  from './src/screens/LessonReaderScreen';
import ProfileScreen       from './src/screens/ProfileScreen';
import InsightDetailScreen      from './src/screens/InsightDetailScreen';
import VerseDetailScreen         from './src/screens/VerseDetailScreen';
import FamilyGoalWizardScreen    from './src/screens/FamilyGoalWizardScreen';
import GardenTreeWizardScreen    from './src/screens/GardenTreeWizardScreen';
import ChallengeWizardScreen     from './src/screens/ChallengeWizardScreen';
import GardenDetailScreen        from './src/screens/GardenDetailScreen';
import FamilySyncScreen          from './src/screens/FamilySyncScreen';
import AboutScreen               from './src/screens/AboutScreen';
import ChildDashboardScreen      from './src/screens/ChildDashboardScreen';
import DashboardsScreen          from './src/screens/DashboardsScreen';
import AddChildWizardScreen      from './src/screens/AddChildWizardScreen';
import GrowthAreaWizardScreen    from './src/screens/GrowthAreaWizardScreen';
import GrowthAreaPlanScreen      from './src/screens/GrowthAreaPlanScreen';

import OnboardingWelcome         from './src/screens/onboarding/OnboardingWelcome';
import OnboardingAbout           from './src/screens/onboarding/OnboardingAbout';
import OnboardingName            from './src/screens/onboarding/OnboardingName';
import OnboardingChildren        from './src/screens/onboarding/OnboardingChildren';
import OnboardingFamilyStructure from './src/screens/onboarding/OnboardingFamilyStructure';
import OnboardingParentRole      from './src/screens/onboarding/OnboardingParentRole';
import OnboardingWorkHours       from './src/screens/onboarding/OnboardingWorkHours';
import OnboardingAvailability    from './src/screens/onboarding/OnboardingAvailability';
import OnboardingCulture         from './src/screens/onboarding/OnboardingCulture';
import OnboardingCultureRaising from './src/screens/onboarding/OnboardingCultureRaising';
import OnboardingCommunity      from './src/screens/onboarding/OnboardingCommunity';
import OnboardingFocusAreas      from './src/screens/onboarding/OnboardingFocusAreas';
import OnboardingReminder        from './src/screens/onboarding/OnboardingReminder';
import OnboardingAccount         from './src/screens/onboarding/OnboardingAccount';
import OnboardingAllSet          from './src/screens/onboarding/OnboardingAllSet';

import FeatureTourScreen from './src/screens/FeatureTourScreen';
import { isOnboardingComplete, resetOnboarding } from './src/utils/onboarding';
import { getSession, signOut } from './src/utils/auth';
import { supabase } from './src/utils/supabase';
import { requestNotificationPermission, savePushTokenToSupabase } from './src/utils/notifications';
import { syncChildProfilesFromSupabase, getAllChildProfiles } from './src/utils/childProfiles';
import { getFamilySyncStatus } from './src/utils/familySync';
import { loadFamilyGoals } from './src/utils/familyGoals';
import { initializePurchases, checkEntitlement, loginRevenueCat, logoutRevenueCat } from './src/utils/purchases';
import PaywallScreen from './src/screens/PaywallScreen';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://tarbiyah-production.up.railway.app';
const WORLD_CACHE_TTL          = 7    * 24 * 60 * 60 * 1000;
const SAFETY_REFRESH_TTL       = 2.5  * 24 * 60 * 60 * 1000;

const TRIAL_DAYS = 7;
const TRIAL_KEY  = 'tarbiyah_trial_start';

function computeTrialDaysLeft(startIso) {
  if (!startIso) return TRIAL_DAYS;
  const daysElapsed = Math.floor((Date.now() - new Date(startIso).getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(0, TRIAL_DAYS - daysElapsed);
}

async function prewarmYouthCulture() {
  try {
    const [children, { data: sessionData }] = await Promise.all([
      getAllChildProfiles(),
      supabase.auth.getSession(),
    ]);
    const token = sessionData?.session?.access_token;
    if (!token || !children?.length) return;

    for (const child of children) {
      if (!child?.id) continue;
      const cacheKey  = `tarbiyah_world_${child.id}`;
      const jobKey    = `tarbiyah_world_job_${child.id}`;

      // Check cache age to decide full generation vs safety-only refresh
      let needsFullGeneration  = true;
      let needsSafetyRefresh   = false;
      try {
        const raw = await AsyncStorage.getItem(cacheKey);
        if (raw) {
          const { generatedAt, safetyRefreshedAt } = JSON.parse(raw);
          const fullAge   = Date.now() - new Date(generatedAt).getTime();
          if (fullAge < WORLD_CACHE_TTL) {
            needsFullGeneration = false;
            const safetyAge = Date.now() - new Date(safetyRefreshedAt ?? generatedAt).getTime();
            needsSafetyRefresh  = safetyAge >= SAFETY_REFRESH_TTL;
          }
        }
      } catch {}

      // Skip if a full generation job is already pending
      const pending = await AsyncStorage.getItem(jobKey);
      if (pending) continue;

      const childPayload = {
        childId:   child.id,
        age:       child.age,
        gender:    child.gender ?? undefined,
        name:      child.name?.split(' ')[0] ?? undefined,
        interests: child.interests?.join(',') ?? undefined,
      };

      if (needsFullGeneration) {
        try {
          const res = await fetch(`${API_URL}/child-world/async`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(childPayload),
          });
          if (res.ok) {
            const { jobId } = await res.json();
            await AsyncStorage.setItem(jobKey, jobId);
          }
        } catch {}
      } else if (needsSafetyRefresh) {
        try {
          fetch(`${API_URL}/child-world/safety-refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(childPayload),
          });
        } catch {}
      }
    }
  } catch {}
}

// ─── App splash overlay ───────────────────────────────────────────────────────

function AppSplashOverlay({ onDismiss }) {
  const [visible, setVisible]   = useState(true);
  const screenOpacity   = useRef(new Animated.Value(1)).current;
  const logoOpacity     = useRef(new Animated.Value(0)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(logoOpacity,     { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.delay(300),
      Animated.timing(subtitleOpacity, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(screenOpacity,   { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start(() => { setVisible(false); onDismiss(); });
  }, []);

  if (!visible) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, splashStyles.container, { opacity: screenOpacity }]}>
      <Animated.Image
        source={require('./assets/app-icons-1/logo-horizontal-bigger-Picsart-BackgroundRemover.png')}
        style={[splashStyles.logo, { opacity: logoOpacity }]}
        resizeMode="contain"
      />
      <Animated.View style={{ opacity: subtitleOpacity, alignItems: 'center', marginTop: 10 }}>
        <View style={splashStyles.divider} />
        <Text style={splashStyles.subtitleLine1}>Parenting Support</Text>
        <Text style={splashStyles.subtitleLine1}>for Muslim Families</Text>
      </Animated.View>
    </Animated.View>
  );
}

const splashStyles = StyleSheet.create({
  container: {
    zIndex: 999,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 60,
  },
  logo: {
    width: 340,
    height: 130,
  },
  divider: {
    width: 36,
    height: 1.5,
    backgroundColor: '#D1D5DB',
    borderRadius: 1,
    marginBottom: 8,
  },
  subtitleLine1: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3D3D3D',
    textAlign: 'center',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    lineHeight: 22,
  },
});

const Tab        = createBottomTabNavigator();
const Stack      = createNativeStackNavigator();
const RootStack  = createNativeStackNavigator();

// ─── Tab config ───────────────────────────────────────────────────────────────

const TAB_CONFIG = {
  Home:       { filled: 'home',    outline: 'home-outline' },
  Family:     { filled: 'people',  outline: 'people-outline' },
  Dashboards: { filled: 'apps',    outline: 'apps-outline' },
  Learn:      { filled: 'layers',  outline: 'layers-outline' },
  Community:  { filled: 'globe',   outline: 'globe-outline' },
};

function CustomTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();
  const { hasChildren, hasFamilyGoals } = useAuth();
  const showFamilyDot = !hasChildren || !hasFamilyGoals;
  return (
    <View style={[styles.tabBar, { paddingBottom: insets.bottom || 14 }]}>
      <View style={styles.tabSeparator} />
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const cfg     = TAB_CONFIG[route.name];
        const showDot = route.name === 'Family' && showFamilyDot && !focused;
        return (
          <TouchableOpacity
            key={route.key}
            style={styles.tabItem}
            onPress={() => navigation.navigate(route.name)}
            activeOpacity={0.7}
          >
            <>
              {focused && <View style={styles.tabPill} />}
              <View>
                <Ionicons
                  name={focused ? cfg.filled : cfg.outline}
                  size={22}
                  color={focused ? '#FFFFFF' : 'rgba(255,255,255,0.35)'}
                />
                {showDot && <View style={styles.tabDot} />}
              </View>
              <Text style={[styles.tabLabel, { color: focused ? '#FFFFFF' : 'rgba(255,255,255,0.35)' }]}>
                {route.name}
              </Text>
            </>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Main app (tabs + detail) ─────────────────────────────────────────────────

function Tabs() {
  return (
    <Tab.Navigator tabBar={props => <CustomTabBar {...props} />} screenOptions={{ headerShown: false }} lazy={false}>
      <Tab.Screen name="Home"       component={HomeScreen} />
      <Tab.Screen name="Family"     component={ProgressScreen} />
      <Tab.Screen name="Dashboards" component={DashboardsScreen} />
      <Tab.Screen name="Learn"      component={LearnScreen} />
      <Tab.Screen name="Community"  component={LibraryScreen} />
    </Tab.Navigator>
  );
}

function MainApp() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs"         component={Tabs} />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="InsightDetail"
        component={InsightDetailScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="ModuleDetail"
        component={ModuleDetailScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="LessonReader"
        component={LessonReaderScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="VerseDetail"
        component={VerseDetailScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="FamilyGoalWizard"
        component={FamilyGoalWizardScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="ChallengeWizard"
        component={ChallengeWizardScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="GardenTreeWizard"
        component={GardenTreeWizardScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="GardenDetail"
        component={GardenDetailScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="FamilySync"
        component={FamilySyncScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="About"
        component={AboutScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="ChildDashboard"
        component={ChildDashboardScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="GuideMeNow"
        component={GuideMeNowScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="MyLibrary"
        component={MyLibraryScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="AddChildWizard"
        component={AddChildWizardScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="GrowthAreaWizard"
        component={GrowthAreaWizardScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="GrowthAreaPlan"
        component={GrowthAreaPlanScreen}
        options={{ animation: 'slide_from_right' }}
      />
    </Stack.Navigator>
  );
}

// ─── Onboarding stack ─────────────────────────────────────────────────────────

function OnboardingStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="OnboardingWelcome"    component={OnboardingWelcome} />
      <Stack.Screen name="OnboardingAbout"      component={OnboardingAbout} />
      <Stack.Screen name="OnboardingName"       component={OnboardingName} />
      <Stack.Screen name="OnboardingChildren"        component={OnboardingChildren} />
      <Stack.Screen name="OnboardingFamilyStructure" component={OnboardingFamilyStructure} />
      <Stack.Screen name="OnboardingParentRole"       component={OnboardingParentRole} />
      <Stack.Screen name="OnboardingWorkHours"        component={OnboardingWorkHours} />
      <Stack.Screen name="OnboardingAvailability"     component={OnboardingAvailability} />
      <Stack.Screen name="OnboardingCulture"           component={OnboardingCulture} />
      <Stack.Screen name="OnboardingCultureRaising"   component={OnboardingCultureRaising} />
      <Stack.Screen name="OnboardingCommunity"         component={OnboardingCommunity} />
      <Stack.Screen name="OnboardingFocusAreas"       component={OnboardingFocusAreas} />
      <Stack.Screen name="OnboardingReminder"   component={OnboardingReminder} />
      <Stack.Screen name="OnboardingAccount"    component={OnboardingAccount} />
      <Stack.Screen name="OnboardingAllSet"     component={OnboardingAllSet} />
      <Stack.Screen name="FeatureTour"          component={FeatureTourScreen} options={{ animation: 'fade' }} />
    </Stack.Navigator>
  );
}

// ─── Root — decides onboarding vs main app ────────────────────────────────────

export const AuthContext = createContext({ signOut: () => {}, completeOnboarding: () => {}, setHasAccess: () => {}, hasChildren: false, hasFamilyGoals: false, refreshHasChildren: () => {}, refreshHasFamilyGoals: () => {}, children: [], worldSnaps: {}, refreshChildrenAndSnaps: async () => {}, refreshWorldData: async () => {}, isSubscribed: false, trialDaysLeft: TRIAL_DAYS });
export function useAuth() { return useContext(AuthContext); }

export default function App() {
  const [loading, setLoading]         = useState(true);
  const [onboarded, setOnboarded]     = useState(false);
  const [hasAccess,     setHasAccess]     = useState(__DEV__);
  const [isSubscribed,  setIsSubscribed]  = useState(false);
  const [trialDaysLeft, setTrialDaysLeft] = useState(TRIAL_DAYS);
  const [showAppSplash, setShowAppSplash] = useState(false);
  const [hasChildren,     setHasChildren]     = useState(false);
  const [hasFamilyGoals,  setHasFamilyGoals]  = useState(false);
  const [children,        setChildren]        = useState([]);
  const [worldSnaps,      setWorldSnaps]      = useState({});

  async function refreshChildrenAndSnaps() {
    try {
      const profiles = (await getAllChildProfiles()) ?? [];
      setChildren(profiles);
      setHasChildren(profiles.length > 0);
      const entries = await Promise.all(
        profiles.map(async c => {
          try {
            const raw = await AsyncStorage.getItem(`tarbiyah_world_${c.id}`);
            return [c.id, raw ? JSON.parse(raw) : null];
          } catch { return [c.id, null]; }
        })
      );
      setWorldSnaps(Object.fromEntries(entries.filter(([, v]) => v)));
    } catch {}
  }

  async function refreshWorldData() {
    await refreshChildrenAndSnaps();
    prewarmYouthCulture();
  }

  async function applyAccess(subscribed) {
    setIsSubscribed(subscribed);
    try {
      const raw      = await AsyncStorage.getItem(TRIAL_KEY);
      const daysLeft = computeTrialDaysLeft(raw);
      setTrialDaysLeft(daysLeft);
      setHasAccess(__DEV__ || subscribed || daysLeft > 0);
    } catch {
      setHasAccess(__DEV__ || subscribed);
    }
  }

  async function startTrial(userId) {
    try {
      const existing = await AsyncStorage.getItem(TRIAL_KEY);
      if (existing) return;
      const now = new Date().toISOString();
      await AsyncStorage.setItem(TRIAL_KEY, now);
      setTrialDaysLeft(TRIAL_DAYS);
      if (userId) {
        supabase.from('profiles').update({ trial_started_at: now }).eq('user_id', userId).then();
      }
    } catch {}
  }

  async function restoreTrialFromSupabase(userId) {
    try {
      const existing = await AsyncStorage.getItem(TRIAL_KEY);
      if (existing) return;
      const { data } = await supabase
        .from('profiles')
        .select('trial_started_at')
        .eq('user_id', userId)
        .single();
      if (data?.trial_started_at) {
        await AsyncStorage.setItem(TRIAL_KEY, data.trial_started_at);
      }
    } catch {}
  }

  async function refreshHasChildren() {
    const { getAllChildProfiles } = await import('./src/utils/childProfiles');
    const profiles = await getAllChildProfiles();
    setHasChildren(profiles.length > 0);
  }

  async function refreshHasFamilyGoals() {
    const { loadFamilyGoalsCached } = await import('./src/utils/familyGoals');
    const goals = await loadFamilyGoalsCached();
    setHasFamilyGoals(goals.length > 0);
  }
  const navigationRef                 = useRef(null);
  const notifResponseListener         = useRef(null);
  useFonts({
    Amiri_400Regular,
    Amiri_700Bold,
    KFGQPCHafs: require('./assets/fonts/KFGQPCHafs.ttf'),
  });

  async function handleNotifNavigation({ screen, childId, openYouthCulture, safetyRefresh } = {}) {
    if (screen === 'GardenDetail' && childId) {
      try {
        const { data: tree } = await supabase
          .from('family_trees')
          .select('*')
          .eq('child_id', childId)
          .maybeSingle();
        if (tree) {
          navigationRef.current?.navigate('GardenDetail', { tree });
          return;
        }
      } catch {}
      navigationRef.current?.navigate('Tabs', { screen: 'Family' });
    } else if (screen === 'Family') {
      navigationRef.current?.navigate('Tabs', { screen: 'Family' });
    } else if (screen === 'Community') {
      navigationRef.current?.navigate('Tabs', { screen: 'Community' });
    } else if (screen === 'Home' && openYouthCulture) {
      if (safetyRefresh && childId) {
        try {
          const { data: job } = await supabase
            .from('child_world_jobs')
            .select('result')
            .eq('child_id', childId)
            .eq('status', 'complete')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (job?.result) {
            await AsyncStorage.setItem(`tarbiyah_world_${childId}`, JSON.stringify(job.result));
            await refreshChildrenAndSnaps();
          }
        } catch {}
      }
      navigationRef.current?.navigate('Tabs', {
        screen: 'Home',
        params: { openYouthCulture: true, childId },
      });
    } else if (screen === 'Dashboards') {
      navigationRef.current?.navigate('Tabs', {
        screen: 'Dashboards',
        params: childId ? { childId } : undefined,
      });
    } else if (screen === 'Learn') {
      navigationRef.current?.navigate('Tabs', { screen: 'Learn' });
    } else {
      navigationRef.current?.navigate('Tabs', { screen: 'Home' });
    }
  }

  useEffect(() => {
    Promise.all([isOnboardingComplete(), getSession()])
      .then(async ([complete, session]) => {
        // Initialize RevenueCat with the current user id if available
        const userId = session?.user?.id ?? null;
        await initializePurchases(userId);

        setOnboarded(complete);
        refreshChildrenAndSnaps();
        refreshHasFamilyGoals();
        prewarmYouthCulture();
        if (complete) {
          if (!__DEV__) {
            const active = await checkEntitlement();
            await applyAccess(active);
          }
          setShowAppSplash(true);
          setLoading(false);
          await new Promise(r => setTimeout(r, 600));
        } else {
          setLoading(false);
        }
        await SplashScreen.hideAsync();
      })
      .catch(async () => {
        setLoading(false);
        await SplashScreen.hideAsync();
      });

    // Request notification permission on first open, then save push token to Supabase
    requestNotificationPermission().then(granted => {
      if (granted) savePushTokenToSupabase();
    });

    // Navigate to correct screen when user taps a notification
    notifResponseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      handleNotifNavigation(response.notification.request.content.data ?? {});
    });

    // Top up plan notifications when app foregrounds so habits stay fresh
    const appStateSub = AppState.addEventListener('change', state => {
      if (state === 'active') {
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        // Clear per-device caches so a new account gets fresh content
        AsyncStorage.multiRemove([
          'tarbiyah_daily_cache',
          'tarbiyah_partner_cache',
          'tarbiyah_profile_photo',
          'tarbiyah_child_profiles',
        ]).catch(() => {});
        logoutRevenueCat().catch(() => {});
        setHasAccess(__DEV__);
        setIsSubscribed(false);
        setOnboarded(false);
      }
      if (event === 'SIGNED_IN') {
        // Clear stale cache from any previous account session
        AsyncStorage.multiRemove([
          'tarbiyah_daily_cache',
          'tarbiyah_family_goals',
          'tarbiyah_loved_actions',
          'tarbiyah_acknowledged_inc',
        ]).catch(() => {});
        // Restore children saved to this account's profile in Supabase,
        // then refresh hasChildren/Goals so setup banner + dots update correctly
        syncChildProfilesFromSupabase().then(() => {
          refreshChildrenAndSnaps();
          refreshHasFamilyGoals();
        }).catch(() => {});
        // Pre-warm partner sync status cache so Home leaderboard loads on first focus
        getFamilySyncStatus().catch(() => {});
        // Pre-generate youth culture content for all children
        prewarmYouthCulture();
        // Log in to RevenueCat and recheck entitlement
        if (session?.user?.id) {
          loginRevenueCat(session.user.id).catch(() => {});
          restoreTrialFromSupabase(session.user.id).catch(() => {});
          if (!__DEV__) checkEntitlement().then(active => applyAccess(active)).catch(() => {});
        }
      }
      if (event === 'INITIAL_SESSION' && session?.user?.id) {
        restoreTrialFromSupabase(session.user.id).catch(() => {});
        syncChildProfilesFromSupabase()
          .then(() => refreshChildrenAndSnaps())
          .catch(() => {});
        loadFamilyGoals()
          .then(() => refreshHasFamilyGoals())
          .catch(() => {});
      }
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        // Save push token on every sign-in and session restore
        if (session?.user?.id) savePushTokenToSupabase().catch(() => {});
      }
      // Background token refresh failed — clear stale session and send to sign-in
      if (event === 'TOKEN_REFRESH_FAILED' || (event === 'TOKEN_REFRESHED' && !session)) {
        signOut().then(() => setOnboarded(false));
      }
    });

    // Catch invalid refresh token errors globally (e.g. deleted user, revoked session)
    supabase.auth.getSession().then(({ error }) => {
      if (error?.message?.includes('Refresh Token Not Found') ||
          error?.message?.includes('Invalid Refresh Token')) {
        signOut().then(() => setOnboarded(false));
      }
    });
    return () => {
      subscription.unsubscribe();
      notifResponseListener.current?.remove();
      appStateSub.remove();
    };
  }, []);

  async function handleSignOut() {
    await signOut();
    await resetOnboarding();
    setOnboarded(false);
  }

  async function handleCompleteOnboarding() {
    setOnboarded(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id ?? null;
    await startTrial(userId);
    if (!__DEV__) {
      const active = await checkEntitlement();
      await applyAccess(active);
    }
  }

  if (loading) return <View style={styles.splash} />;

  return (
    <SafeAreaProvider>
    <AuthContext.Provider value={{ handleSignOut, completeOnboarding: handleCompleteOnboarding, setHasAccess, hasChildren, hasFamilyGoals, refreshHasChildren, refreshHasFamilyGoals, children, worldSnaps, refreshChildrenAndSnaps, refreshWorldData, isSubscribed, trialDaysLeft }}>
      <NavigationContainer
        ref={navigationRef}
        onReady={() => {
          const response = Notifications.getLastNotificationResponse();
          if (response) handleNotifNavigation(response.notification.request.content.data ?? {});
        }}
      >
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          {!onboarded ? (
            <RootStack.Screen name="Onboarding" component={OnboardingStack} />
          ) : !hasAccess ? (
            <RootStack.Screen name="Paywall" component={PaywallScreen} options={{ animation: 'fade' }} />
          ) : (
            <RootStack.Screen name="MainApp" component={MainApp} />
          )}
        </RootStack.Navigator>

        {showAppSplash && (
          <AppSplashOverlay onDismiss={() => setShowAppSplash(false)} />
        )}
      </NavigationContainer>
    </AuthContext.Provider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1B3D2F',
    paddingTop: 10,
    position: 'relative',
  },
  tabSeparator: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    position: 'relative',
    paddingTop: 4,
  },
  tabPill: {
    position: 'absolute',
    top: 0,
    width: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#6B7C45',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  tabDot: {
    position: 'absolute', top: -1, right: -3,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#4ADE80',
  },
});
