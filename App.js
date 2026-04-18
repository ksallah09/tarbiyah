import React, { useEffect, useState, useRef, createContext, useContext } from 'react';
import {
  View, ActivityIndicator, StyleSheet, Text, TouchableOpacity,
  Animated, ImageBackground, Image, Modal,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

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

const DAY_INDEX = Math.floor(Date.now() / 86_400_000);

const SPLASH_IMAGES = [
  require('./assets/spiritual-3.jpg-old.jpg'),
  require('./assets/spiritual-4.jpg-old.jpg'),
  require('./assets/spiritual-5.jpg'),
  require('./assets/spiritual-8.jpg'),
  require('./assets/Spiritual-6.jpg-old.jpg'),
  require('./assets/spiritual-7.jpg'),
];
const SPLASH_IMAGE = SPLASH_IMAGES[Math.floor(Math.random() * SPLASH_IMAGES.length)];

const SPLASH_QUOTES = [
  { text: 'Each of you is a shepherd, and each of you is responsible for his flock.', source: 'Prophet Muhammad ﷺ' },
  { text: 'The best of you are the best to their families.', source: 'Prophet Muhammad ﷺ' },
  { text: 'He is not one of us who does not show mercy to our young and respect to our elders.', source: 'Prophet Muhammad ﷺ' },
  { text: 'The believer with the most complete faith is the one with the best character, and the one most kind to their family.', source: 'Prophet Muhammad ﷺ' },
  { text: 'When a human being dies, his deeds come to an end except for three: ongoing charity, beneficial knowledge, and a righteous child who prays for him.', source: 'Prophet Muhammad ﷺ' },
  { text: 'There has certainly been for you in the Messenger of Allah an excellent example for anyone whose hope is in Allah and the Last Day.', source: 'Quran 33:21' },
];

// ─── App splash overlay ───────────────────────────────────────────────────────

function AppSplashOverlay({ onContinue }) {
  const insets       = useSafeAreaInsets();
  const opacity      = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(true);
  const [quoteIdx, setQuoteIdx] = useState(DAY_INDEX % SPLASH_QUOTES.length);
  const quote        = SPLASH_QUOTES[quoteIdx];

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  function handleContinue() {
    Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true })
      .start(() => { setVisible(false); onContinue(); });
  }

  if (!visible) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity, zIndex: 999 }]}>
      <ImageBackground source={SPLASH_IMAGE} style={{ flex: 1 }} resizeMode="cover">
        <LinearGradient
          colors={['rgba(10,28,20,0.35)', 'rgba(8,22,16,0.92)']}
          style={[splashStyles.overlay, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 40 }]}
        >
          <View style={splashStyles.brand}>
            <Image
              source={require('./assets/app-icons-1/logo-Picsart-BackgroundRemover.png')}
              style={splashStyles.logo}
              resizeMode="contain"
            />
            <Text style={splashStyles.brandName}>Tarbiyah</Text>
          </View>

          <View style={splashStyles.quoteWrap}>
            <Text style={splashStyles.quoteText}>{'\u201C'}{quote.text}{'\u201D'}</Text>
            <View style={splashStyles.quoteDivider} />
            <Text style={splashStyles.quoteSource}>— {quote.source}</Text>
          </View>

          <View style={splashStyles.footer}>
            {__DEV__ && (
              <TouchableOpacity
                style={splashStyles.devBtn}
                onPress={() => setQuoteIdx(i => (i + 1) % SPLASH_QUOTES.length)}
              >
                <Ionicons name="refresh-outline" size={13} color="rgba(255,255,255,0.35)" />
                <Text style={splashStyles.devBtnText}>Rotate quote (dev)</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={splashStyles.continueBtn} onPress={handleContinue} activeOpacity={0.7}>
              <Text style={splashStyles.continueBtnText}>Continue</Text>
              <Ionicons name="arrow-forward" size={14} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </ImageBackground>
    </Animated.View>
  );
}

const splashStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'space-between',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: { width: 42, height: 42 },
  brandName: {
    fontSize: 18,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 1,
  },
  quoteWrap: { gap: 0 },
  quoteText: {
    fontSize: 20,
    fontWeight: '500',
    color: '#FFFFFF',
    lineHeight: 30,
    letterSpacing: 0.1,
    textAlign: 'center',
    marginBottom: 20,
  },
  quoteDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginBottom: 16,
  },
  quoteSource: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  footer: { gap: 4 },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  continueBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.3,
  },
  devBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  devBtnText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    fontWeight: '500',
  },
});

const Tab        = createBottomTabNavigator();
const Stack      = createNativeStackNavigator();
const RootStack  = createNativeStackNavigator();

// ─── Tab config ───────────────────────────────────────────────────────────────

const TAB_CONFIG = {
  Home:     { filled: 'home',        outline: 'home-outline' },
  Library:  { filled: 'library',     outline: 'library-outline' },
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
            {/* Active pill highlight */}
            {focused && <View style={styles.tabPill} />}
            <Ionicons
              name={focused ? cfg.filled : cfg.outline}
              size={22}
              color={focused ? '#FFFFFF' : 'rgba(255,255,255,0.35)'}
            />
            <Text style={[styles.tabLabel, { color: focused ? '#FFFFFF' : 'rgba(255,255,255,0.35)' }]}>
              {route.name}
            </Text>
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
      <Tab.Screen name="Learn"    component={LearnScreen} />
      <Tab.Screen name="Progress" component={ProgressScreen} />
      <Tab.Screen name="Library"  component={LibraryScreen} />
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

  useEffect(() => {
    Promise.all([isOnboardingComplete(), getSession()])
      .then(([complete]) => {
        setOnboarded(complete);
        if (complete) setShowAppSplash(true);
      })
      .finally(async () => {
        setLoading(false);
        // Hold briefly so assets settle before native splash disappears
        await new Promise(r => setTimeout(r, 600));
        await SplashScreen.hideAsync();
      });

    // Request notification permission on first open
    requestNotificationPermission();

    // Navigate to correct screen when user taps a notification
    notifResponseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const screen = response.notification.request.content.data?.screen;
      if (screen === 'Progress') {
        navigationRef.current?.navigate('Tabs', { screen: 'Progress' });
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
          <AppSplashOverlay onContinue={() => setShowAppSplash(false)} />
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
});
