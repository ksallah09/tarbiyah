import React, { useEffect, useState, createContext, useContext } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import HomeScreen          from './src/screens/HomeScreen';
import LibraryScreen       from './src/screens/LibraryScreen';
import ProgressScreen      from './src/screens/ProgressScreen';
import LearnScreen         from './src/screens/LearnScreen';
import ModuleDetailScreen  from './src/screens/ModuleDetailScreen';
import ProfileScreen       from './src/screens/ProfileScreen';
import InsightDetailScreen      from './src/screens/InsightDetailScreen';
import VerseDetailScreen         from './src/screens/VerseDetailScreen';
import FamilyGoalWizardScreen    from './src/screens/FamilyGoalWizardScreen';
import FamilySyncScreen          from './src/screens/FamilySyncScreen';

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
    <Tab.Navigator tabBar={props => <CustomTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home"     component={HomeScreen} />
      <Tab.Screen name="Library"  component={LibraryScreen} />
      <Tab.Screen name="Progress" component={ProgressScreen} />
      <Tab.Screen name="Learn"    component={LearnScreen} />
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
      {/* AllSet can navigate to MainApp via replace */}
      <Stack.Screen name="MainApp" component={MainApp} options={{ animation: 'fade' }} />
    </Stack.Navigator>
  );
}

// ─── Root — decides onboarding vs main app ────────────────────────────────────

export const AuthContext = createContext({ signOut: () => {} });
export function useAuth() { return useContext(AuthContext); }

export default function App() {
  const [loading, setLoading]         = useState(true);
  const [onboarded, setOnboarded]     = useState(false);

  useEffect(() => {
    Promise.all([isOnboardingComplete(), getSession()])
      .then(([complete]) => setOnboarded(complete))
      .finally(() => setLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setOnboarded(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color="#1B3D2F" size="large" />
      </View>
    );
  }

  async function handleSignOut() {
    await signOut();
    await resetOnboarding();
    setOnboarded(false);
  }

  return (
    <AuthContext.Provider value={{ handleSignOut }}>
      <NavigationContainer>
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          {onboarded ? (
            <RootStack.Screen name="MainApp" component={MainApp} />
          ) : (
            <RootStack.Screen name="Onboarding" component={OnboardingStack} />
          )}
        </RootStack.Navigator>
      </NavigationContainer>
    </AuthContext.Provider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F6F8',
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
