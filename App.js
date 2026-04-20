import React, { useEffect, useState, useRef, createContext, useContext } from 'react';
import {
  View, ActivityIndicator, StyleSheet, Text,
  Animated, TouchableOpacity,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts, Amiri_400Regular, Amiri_700Bold } from '@expo-google-fonts/amiri';

SplashScreen.preventAutoHideAsync();

import HomeScreen          from './src/screens/HomeScreen';
import LibraryScreen       from './src/screens/LibraryScreen';
import ProgressScreen      from './src/screens/ProgressScreen';
import LearnScreen         from './src/screens/LearnScreen';
import ModuleDetailScreen  from './src/screens/ModuleDetailScreen';
import LessonReaderScreen  from './src/screens/LessonReaderScreen';
import ProfileScreen       from './src/screens/ProfileScreen';
import InsightDetailScreen      from './src/screens/InsightDetailScreen';
import VerseDetailScreen         from './src/screens/VerseDetailScreen';
import FamilyGoalWizardScreen    from './src/screens/FamilyGoalWizardScreen';
import FamilySyncScreen          from './src/screens/FamilySyncScreen';
import AboutScreen               from './src/screens/AboutScreen';

import OnboardingWelcome    from './src/screens/onboarding/OnboardingWelcome';
import OnboardingAbout      from './src/screens/onboarding/OnboardingAbout';
import OnboardingName       from './src/screens/onboarding/OnboardingName';
import OnboardingChildren   from './src/screens/onboarding/OnboardingChildren';
import OnboardingFocusAreas from './src/screens/onboarding/OnboardingFocusAreas';
import OnboardingReminder   from './src/screens/onboarding/OnboardingReminder';
import OnboardingAccount    from './src/screens/onboarding/OnboardingAccount';
import OnboardingAllSet     from './src/screens/onboarding/OnboardingAllSet';

import { isOnboardingComplete, resetOnboarding } from './src/utils/onboarding';
import { getSession, signOut } from './src/utils/auth';
import { supabase } from './src/utils/supabase';
import { requestNotificationPermission } from './src/utils/notifications';

const SPLASH_QUOTE = { text: 'There has certainly been for you in the Messenger of Allah an excellent example.', source: 'Quran 33:21' };

// ─── App splash overlay ───────────────────────────────────────────────────────

function AppSplashOverlay({ onDismiss }) {
  const [visible, setVisible]   = useState(true);
  const screenOpacity           = useRef(new Animated.Value(1)).current;
  const titleOpacity            = useRef(new Animated.Value(0)).current;
  const quoteOpacity            = useRef(new Animated.Value(0)).current;
  const quote = SPLASH_QUOTE;

  useEffect(() => {
    Animated.sequence([
      // Title fades in
      Animated.timing(titleOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.delay(400),
      // Quote fades in
      Animated.timing(quoteOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.delay(3800),
      // Everything fades out
      Animated.timing(screenOpacity, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start(() => { setVisible(false); onDismiss(); });
  }, []);

  if (!visible) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: screenOpacity, zIndex: 999, backgroundColor: '#1B3D2F', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }]}>
      <Animated.View style={{ opacity: titleOpacity, alignItems: 'center', marginBottom: 40 }}>
        <Text style={splashStyles.titleLine1}>Your Guide to</Text>
        <Text style={splashStyles.titleLine2}>Prophetic Parenting</Text>
      </Animated.View>

      <Animated.View style={{ opacity: quoteOpacity, alignItems: 'center' }}>
        <Text style={splashStyles.quoteText}>{'\u201C'}{quote.text}{'\u201D'}</Text>
        <Text style={splashStyles.quoteSource}>{quote.source.toUpperCase()}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const splashStyles = StyleSheet.create({
  titleLine1: {
    fontSize: 30,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  titleLine2: {
    fontSize: 30,
    fontWeight: '700',
    color: '#C9A84C',
    textAlign: 'center',
  },
  quoteText: {
    fontSize: 16,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 26,
    textAlign: 'center',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  quoteSource: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
});

const Tab        = createBottomTabNavigator();
const Stack      = createNativeStackNavigator();
const RootStack  = createNativeStackNavigator();

// ─── Tab config ───────────────────────────────────────────────────────────────

const TAB_CONFIG = {
  Home:     { filled: 'home',        outline: 'home-outline' },
  Resources: { filled: 'compass',      outline: 'compass-outline' },
  Progress: { filled: 'trending-up', outline: 'trending-up-outline' },
  Learn:    { filled: 'layers',      outline: 'layers-outline' },
  Profile:  { filled: 'person',      outline: 'person-outline' },
};

function CustomTabBar({ state, descriptors, navigation }) {
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
      <Tab.Screen name="Home"     component={HomeScreen} />
      <Tab.Screen name="Progress" component={ProgressScreen} />
      <Tab.Screen name="Learn"    component={LearnScreen} />
      <Tab.Screen name="Resources" component={LibraryScreen} />
      <Tab.Screen name="Profile"  component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function MainApp() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs"         component={Tabs} />
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
        name="About"
        component={AboutScreen}
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
      <Stack.Screen name="OnboardingChildren"   component={OnboardingChildren} />
      <Stack.Screen name="OnboardingFocusAreas" component={OnboardingFocusAreas} />
      <Stack.Screen name="OnboardingReminder"   component={OnboardingReminder} />
      <Stack.Screen name="OnboardingAccount"    component={OnboardingAccount} />
      <Stack.Screen name="OnboardingAllSet"     component={OnboardingAllSet} />
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
  const [fontsLoaded]                 = useFonts({ Amiri_400Regular, Amiri_700Bold });

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
      const screen = response.notification.request.content.data?.screen;
      if (screen === 'Progress') {
        navigationRef.current?.navigate('Tabs', { screen: 'Progress' });
      } else if (screen === 'Resources') {
        navigationRef.current?.navigate('Tabs', { screen: 'Resources' });
      } else {
        navigationRef.current?.navigate('Tabs', { screen: 'Home' });
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
