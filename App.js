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
import { useFonts, Amiri_400Regular, Amiri_700Bold } from '@expo-google-fonts/amiri';

SplashScreen.preventAutoHideAsync();

import HomeScreen          from './src/screens/HomeScreen';
import LibraryScreen       from './src/screens/LibraryScreen';
import ProgressScreen      from './src/screens/ProgressScreen';
import LearnScreen         from './src/screens/LearnScreen';
import GuideMeNowScreen    from './src/screens/GuideMeNowScreen';
import MyLibraryScreen     from './src/screens/MyLibraryScreen';
import PIPWizardScreen        from './src/screens/PIPWizardScreen';
import PIPDetailScreen        from './src/screens/PIPDetailScreen';
import ChildPlanWizardScreen  from './src/screens/ChildPlanWizardScreen';
import ChildPlanDetailScreen  from './src/screens/ChildPlanDetailScreen';
import ModuleDetailScreen  from './src/screens/ModuleDetailScreen';
import LessonReaderScreen  from './src/screens/LessonReaderScreen';
import ProfileScreen       from './src/screens/ProfileScreen';
import InsightDetailScreen      from './src/screens/InsightDetailScreen';
import VerseDetailScreen         from './src/screens/VerseDetailScreen';
import FamilyGoalWizardScreen    from './src/screens/FamilyGoalWizardScreen';
import FamilySyncScreen          from './src/screens/FamilySyncScreen';
import AboutScreen               from './src/screens/AboutScreen';

import OnboardingWelcome         from './src/screens/onboarding/OnboardingWelcome';
import OnboardingAbout           from './src/screens/onboarding/OnboardingAbout';
import OnboardingName            from './src/screens/onboarding/OnboardingName';
import OnboardingChildren        from './src/screens/onboarding/OnboardingChildren';
import OnboardingFamilyStructure from './src/screens/onboarding/OnboardingFamilyStructure';
import OnboardingFocusAreas      from './src/screens/onboarding/OnboardingFocusAreas';
import OnboardingReminder        from './src/screens/onboarding/OnboardingReminder';
import OnboardingAccount         from './src/screens/onboarding/OnboardingAccount';
import OnboardingAllSet          from './src/screens/onboarding/OnboardingAllSet';

import FeatureTourScreen from './src/screens/FeatureTourScreen';
import { isOnboardingComplete, resetOnboarding } from './src/utils/onboarding';
import { getSession, signOut } from './src/utils/auth';
import { supabase } from './src/utils/supabase';
import { requestNotificationPermission, topUpPlanNotifications } from './src/utils/notifications';
import { getActivePlan } from './src/utils/pip';
import { getAllChildPlans } from './src/utils/childPlan';

// ─── App splash overlay ───────────────────────────────────────────────────────

const TYPEWRITER_WORD = 'Tarbiyah';
const TYPEWRITER_SPEED = 110; // ms per letter

function AppSplashOverlay({ onDismiss }) {
  const [visible, setVisible]       = useState(true);
  const [typewriterText, setTypewriterText] = useState('');
  const [typewriterDone, setTypewriterDone] = useState(false);
  const screenOpacity   = useRef(new Animated.Value(1)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const quoteOpacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let startTimer;
    let interval;

    startTimer = setTimeout(() => {
      let i = 0;
      interval = setInterval(() => {
        i++;
        setTypewriterText(TYPEWRITER_WORD.slice(0, i));
        if (i >= TYPEWRITER_WORD.length) {
          clearInterval(interval);
          setTypewriterDone(true);
        }
      }, TYPEWRITER_SPEED);
    }, 700);

    return () => { clearTimeout(startTimer); clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (!typewriterDone) return;

    Animated.sequence([
      Animated.delay(350),
      Animated.timing(subtitleOpacity, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.delay(400),
      Animated.timing(quoteOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.delay(2800),
      Animated.timing(screenOpacity, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start(() => { setVisible(false); onDismiss(); });
  }, [typewriterDone]);

  if (!visible) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: screenOpacity, zIndex: 999, backgroundColor: '#1B3D2F', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }]}>
      <Text style={splashStyles.appName}>{typewriterText}</Text>

      <Animated.View style={{ opacity: subtitleOpacity, marginTop: 8, flexDirection: 'row' }}>
        <Text style={splashStyles.subtitle}>Your Guide to </Text>
        <Text style={[splashStyles.subtitle, { color: '#C9A84C', marginLeft: 4 }]}>Prophetic Parenting</Text>
      </Animated.View>

      <Animated.View style={[splashStyles.quoteWrap, { opacity: quoteOpacity }]}>
        <Text style={splashStyles.quoteText}>{'\u201C'}There has certainly been for you in the Messenger of Allah an excellent example.{'\u201D'}</Text>
        <Text style={splashStyles.quoteSource}>QURAN 33:21</Text>
      </Animated.View>
    </Animated.View>
  );
}

const splashStyles = StyleSheet.create({
  appName: {
    fontSize: 44,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 52,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  quoteWrap: {
    position: 'absolute',
    bottom: 100,
    left: 32,
    right: 32,
    alignItems: 'center',
    gap: 10,
  },
  quoteText: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 22,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  quoteSource: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
});

const Tab        = createBottomTabNavigator();
const Stack      = createNativeStackNavigator();
const RootStack  = createNativeStackNavigator();

// ─── Tab config ───────────────────────────────────────────────────────────────

const TAB_CONFIG = {
  Home:        { filled: 'home',        outline: 'home-outline' },
  Growth:      { filled: 'trending-up', outline: 'trending-up-outline' },
  Learn:       { filled: 'layers',      outline: 'layers-outline' },
  Community:   { filled: 'globe',       outline: 'globe-outline' },
  'My Library': { filled: 'bookmark',   outline: 'bookmark-outline' },
};

function CustomTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.tabBar, { paddingBottom: insets.bottom || 14 }]}>
      {/* Subtle top separator */}
      <View style={styles.tabSeparator} />
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const cfg     = TAB_CONFIG[route.name];
        return (
          <TouchableOpacity
            key={route.key}
            style={styles.tabItem}
            onPress={() => navigation.navigate(route.name)}
            activeOpacity={0.7}
          >
            <>
              {focused && <View style={styles.tabPill} />}
              <Ionicons
                name={focused ? cfg.filled : cfg.outline}
                size={22}
                color={focused ? '#FFFFFF' : 'rgba(255,255,255,0.35)'}
              />
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
      <Tab.Screen name="Growth"     component={ProgressScreen} />
      <Tab.Screen name="Learn"      component={LearnScreen} />
      <Tab.Screen name="Community"  component={LibraryScreen} />
      <Tab.Screen name="My Library" component={MyLibraryScreen} />
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
        name="FamilySync"
        component={FamilySyncScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="PIPWizard"
        component={PIPWizardScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="PIPDetail"
        component={PIPDetailScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="ChildPlanWizard"
        component={ChildPlanWizardScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="ChildPlanDetail"
        component={ChildPlanDetailScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="About"
        component={AboutScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="GuideMeNow"
        component={GuideMeNowScreen}
        options={{ animation: 'slide_from_bottom' }}
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
      <Stack.Screen name="OnboardingFocusAreas"      component={OnboardingFocusAreas} />
      <Stack.Screen name="OnboardingReminder"   component={OnboardingReminder} />
      <Stack.Screen name="OnboardingAccount"    component={OnboardingAccount} />
      <Stack.Screen name="OnboardingAllSet"     component={OnboardingAllSet} />
      <Stack.Screen name="FeatureTour"          component={FeatureTourScreen} options={{ animation: 'fade' }} />
    </Stack.Navigator>
  );
}

// ─── Root — decides onboarding vs main app ────────────────────────────────────

export const AuthContext = createContext({ signOut: () => {}, completeOnboarding: () => {} });
export function useAuth() { return useContext(AuthContext); }

export default function App() {
  const [loading, setLoading]         = useState(true);
  const [onboarded, setOnboarded]     = useState(false);
  const [showAppSplash, setShowAppSplash] = useState(false);
  const navigationRef                 = useRef(null);
  const notifResponseListener         = useRef(null);
  useFonts({ Amiri_400Regular, Amiri_700Bold });

  useEffect(() => {
    Promise.all([isOnboardingComplete(), getSession()])
      .then(async ([complete]) => {
        setOnboarded(complete);
        if (complete) {
          setShowAppSplash(true);
          setLoading(false);
          await new Promise(r => setTimeout(r, 600));
        } else {
          // New user — dismiss native splash immediately, go straight to onboarding
          setLoading(false);
        }
        await SplashScreen.hideAsync();
      })
      .catch(async () => {
        setLoading(false);
        await SplashScreen.hideAsync();
      });

    // Request notification permission on first open
    requestNotificationPermission();

    // Navigate to correct screen when user taps a notification
    notifResponseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const { screen, planId } = response.notification.request.content.data ?? {};
      if (screen === 'PIPDetail') {
        getActivePlan().then(plan => {
          if (plan) navigationRef.current?.navigate('PIPDetail', { plan });
          else navigationRef.current?.navigate('Tabs', { screen: 'Growth' });
        });
      } else if (screen === 'ChildPlanDetail') {
        getAllChildPlans().then(plans => {
          const plan = planId ? plans.find(p => p.id === planId) : plans[0];
          if (plan) navigationRef.current?.navigate('ChildPlanDetail', { plan });
          else navigationRef.current?.navigate('Tabs', { screen: 'Growth' });
        });
      } else if (screen === 'Growth') {
        navigationRef.current?.navigate('Tabs', { screen: 'Growth' });
      } else if (screen === 'Community') {
        navigationRef.current?.navigate('Tabs', { screen: 'Community' });
      } else {
        navigationRef.current?.navigate('Tabs', { screen: 'Home' });
      }
    });

    // Top up plan notifications when app foregrounds so habits stay fresh
    const appStateSub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        Promise.all([getActivePlan(), getAllChildPlans()]).then(([pipPlan, childPlans]) => {
          topUpPlanNotifications(pipPlan, childPlans).catch(() => {});
        });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') setOnboarded(false);
      // Invalid/expired refresh token — clear stale session and send to sign-in
      if (event === 'TOKEN_REFRESHED' && !session) {
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
  }

  if (loading) return <View style={styles.splash} />;

  return (
    <SafeAreaProvider>
    <AuthContext.Provider value={{ handleSignOut, completeOnboarding: handleCompleteOnboarding }}>
      <NavigationContainer ref={navigationRef}>
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          {onboarded ? (
            <RootStack.Screen name="MainApp" component={MainApp} />
          ) : (
            <RootStack.Screen name="Onboarding" component={OnboardingStack} />
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
    backgroundColor: '#1B3D2F',
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
});
