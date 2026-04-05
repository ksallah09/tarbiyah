import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import HomeScreen          from './src/screens/HomeScreen';
import LibraryScreen       from './src/screens/LibraryScreen';
import ProgressScreen      from './src/screens/ProgressScreen';
import AskScreen           from './src/screens/AskScreen';
import ProfileScreen       from './src/screens/ProfileScreen';
import InsightDetailScreen from './src/screens/InsightDetailScreen';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TAB_CONFIG = {
  Home:     { filled: 'home',        outline: 'home-outline' },
  Library:  { filled: 'library',     outline: 'library-outline' },
  Progress: { filled: 'trending-up', outline: 'trending-up-outline' },
  Ask:      { filled: 'chatbubbles', outline: 'chatbubbles-outline' },
  Profile:  { filled: 'person',      outline: 'person-outline' },
};

function CustomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={['#6B7C45', '#1B3D2F']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[styles.tabBar, { paddingBottom: insets.bottom || 10 }]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const cfg = TAB_CONFIG[route.name];
        const color = focused ? '#FFFFFF' : 'rgba(255,255,255,0.4)';

        return (
          <TouchableOpacity
            key={route.key}
            style={styles.tabItem}
            onPress={() => navigation.navigate(route.name)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={focused ? cfg.filled : cfg.outline}
              size={23}
              color={color}
            />
            <Text style={[styles.tabLabel, { color }]}>{route.name}</Text>
          </TouchableOpacity>
        );
      })}
    </LinearGradient>
  );
}

function Tabs() {
  return (
    <Tab.Navigator
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home"     component={HomeScreen} />
      <Tab.Screen name="Library"  component={LibraryScreen} />
      <Tab.Screen name="Progress" component={ProgressScreen} />
      <Tab.Screen name="Ask"      component={AskScreen} />
      <Tab.Screen name="Profile"  component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <>
      <StatusBar style="dark" />
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Tabs"         component={Tabs} />
          <Stack.Screen
            name="InsightDetail"
            component={InsightDetailScreen}
            options={{ animation: 'slide_from_right' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    paddingTop: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
