import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, Dimensions, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../../App';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const IS_SMALL = SCREEN_HEIGHT < 700;
const GLOW_SIZE   = IS_SMALL ? 140 : 200;
const GLOW_MID    = IS_SMALL ? 105 : 150;
const GLOW_INNER  = IS_SMALL ?  70 : 100;
const GLOW_ICON   = IS_SMALL ?  36 :  52;
const GLOW_MB     = IS_SMALL ?  20 :  40;
const SLIDE_EXTRA = IS_SMALL ?  60 : 120;
const TAB_WIDTH = SCREEN_WIDTH / 5;
const MOCK_TAB_HEIGHT = 60;

const MOCK_TABS = [
  { name: 'Home',       icon: 'home-outline',    filled: 'home'    },
  { name: 'Family',     icon: 'people-outline',  filled: 'people'  },
  { name: 'Dashboards', icon: 'apps-outline',    filled: 'apps'    },
  { name: 'Learn',      icon: 'layers-outline',  filled: 'layers'  },
  { name: 'Community',  icon: 'globe-outline',   filled: 'globe'   },
];

// Which tab index each slide highlights (null = none)
const SLIDE_TAB = [null, 0, 1, 2, 2, 3, 4];

const SLIDES = [
  {
    key: 'welcome',
    icon: 'sparkles',
    iconColor: '#D4A843',
    title: 'Welcome to Tarbiyah',
    body: 'Your guide to Prophetic parenting — built for Muslim parents striving to raise children with faith, character, and confidence.',
  },
  {
    key: 'insights',
    icon: 'sunny-outline',
    iconColor: '#D4A843',
    title: 'Daily Insights',
    body: 'Every day brings a fresh spiritual insight and a research-backed parenting tip — automatically personalised to the context of your family.',
  },
  {
    key: 'family',
    icon: 'people-outline',
    iconColor: '#4ADE80',
    title: 'Family Goals & Connection',
    body: 'Strengthen family connection. Set shared goals for your whole family and log progress. Small moments of growth, captured and remembered.',
  },
  {
    key: 'dashboard',
    icon: 'apps-outline',
    iconColor: '#4ADE80',
    title: 'Child Dashboards',
    body: "Each child gets their own dashboard — a personalised weekly plan of habits and activities built around their specific growth area.",
  },
  {
    key: 'culture',
    icon: 'globe-outline',
    iconColor: '#4ADE80',
    title: 'This Week in Youth Culture',
    body: "Stay fluent in your child's world. Live trend data from Google, YouTube, Reddit and more — decoded through an Islamic parenting lens every week.",
  },
  {
    key: 'learn',
    icon: 'layers-outline',
    iconColor: '#D4A843',
    title: 'Learn On Demand',
    body: "Describe any parenting challenge and get a full AI-generated audio learning module — tailored to your situation and ready to listen to hands-free.",
  },
  {
    key: 'community',
    icon: 'people-outline',
    iconColor: '#D4A843',
    title: 'Parents Helping Parents',
    body: 'Browse curated Islamic parenting resources, request what you need, and share what has worked for your family.',
  },
];

function tabCenter(tabIndex) {
  return tabIndex * TAB_WIDTH + TAB_WIDTH / 2;
}

export default function FeatureTourScreen() {
  const insets = useSafeAreaInsets();
  const { completeOnboarding } = useAuth();
  const flatListRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;

  // Animated arrow position (horizontal center)
  const arrowCenter = useRef(new Animated.Value(tabCenter(0))).current;
  const arrowOpacity = useRef(new Animated.Value(0)).current;
  const bounceY = useRef(new Animated.Value(0)).current;
  const bounceLoop = useRef(null);

  useEffect(() => {
    // Start bounce loop
    bounceLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceY, { toValue: -8, duration: 400, useNativeDriver: true }),
        Animated.timing(bounceY, { toValue: 0, duration: 400, useNativeDriver: true }),
      ])
    );
    bounceLoop.current.start();
    return () => bounceLoop.current?.stop();
  }, []);

  useEffect(() => {
    const tabIdx = SLIDE_TAB[currentIndex];
    if (tabIdx === null) {
      Animated.timing(arrowOpacity, { toValue: 0, duration: 200, useNativeDriver: false }).start();
    } else {
      Animated.parallel([
        Animated.spring(arrowCenter, {
          toValue: tabCenter(tabIdx),
          tension: 80,
          friction: 10,
          useNativeDriver: false,
        }),
        Animated.timing(arrowOpacity, { toValue: 1, duration: 200, useNativeDriver: false }),
      ]).start();
    }
  }, [currentIndex]);

  function goNext() {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      completeOnboarding();
    }
  }

  const isLast = currentIndex === SLIDES.length - 1;
  const mockTabBarHeight = MOCK_TAB_HEIGHT + insets.bottom;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Skip */}
      {!isLast && (
        <TouchableOpacity style={styles.skipBtn} onPress={completeOnboarding} activeOpacity={0.7}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Slides */}
      <Animated.FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={item => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onMomentumScrollEnd={e => {
          const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setCurrentIndex(index);
        }}
        renderItem={({ item }) => {
          const glowRgb = item.iconColor === '#4ADE80' ? '74,222,128' : '212,168,67';
          return (
            <View style={[styles.slide, { paddingBottom: mockTabBarHeight + SLIDE_EXTRA }]}>
              <View style={[styles.glowStack, { width: GLOW_SIZE, height: GLOW_SIZE, marginBottom: GLOW_MB }]}>
                <View style={[styles.glowOuter, { borderRadius: GLOW_SIZE / 2, backgroundColor: `rgba(${glowRgb},0.06)` }]} />
                <View style={[styles.glowMid, { width: GLOW_MID, height: GLOW_MID, borderRadius: GLOW_MID / 2, backgroundColor: `rgba(${glowRgb},0.1)` }]} />
                <View style={[styles.glowInner, { width: GLOW_INNER, height: GLOW_INNER, borderRadius: GLOW_INNER / 2, backgroundColor: `rgba(${glowRgb},0.15)` }]}>
                  <Ionicons name={item.icon} size={GLOW_ICON} color={item.iconColor} />
                </View>
              </View>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
            </View>
          );
        }}
      />

      {/* Dots */}
      <View style={styles.dotsRow}>
        {SLIDES.map((_, i) => {
          const opacity = scrollX.interpolate({
            inputRange: [(i - 1) * SCREEN_WIDTH, i * SCREEN_WIDTH, (i + 1) * SCREEN_WIDTH],
            outputRange: [0.3, 1, 0.3],
            extrapolate: 'clamp',
          });
          const width = scrollX.interpolate({
            inputRange: [(i - 1) * SCREEN_WIDTH, i * SCREEN_WIDTH, (i + 1) * SCREEN_WIDTH],
            outputRange: [6, 20, 6],
            extrapolate: 'clamp',
          });
          return <Animated.View key={i} style={[styles.dot, { opacity, width }]} />;
        })}
      </View>

      {/* Next / Get Started */}
      <TouchableOpacity style={styles.nextBtn} onPress={goNext} activeOpacity={0.85}>
        <Text style={styles.nextBtnText}>{isLast ? 'Get Started' : 'Next'}</Text>
        {!isLast && <Ionicons name="arrow-forward" size={16} color="#1B3D2F" style={{ marginLeft: 6 }} />}
      </TouchableOpacity>

      {/* Animated arrow + mock tab bar */}
      <View style={[styles.mockTabWrapper, { height: mockTabBarHeight }]}>
        {/* Bouncing arrow */}
        {/* Outer: horizontal slide (non-native) */}
        <Animated.View
          style={[
            styles.arrowContainer,
            {
              opacity: arrowOpacity,
              transform: [
                { translateX: arrowCenter.interpolate({ inputRange: [0, SCREEN_WIDTH], outputRange: [-12, SCREEN_WIDTH - 12] }) },
              ],
            },
          ]}
        >
          {/* Inner: vertical bounce (native) */}
          <Animated.View style={{ transform: [{ translateY: bounceY }] }}>
            <Ionicons name="chevron-down" size={20} color="#D4A843" />
          </Animated.View>
        </Animated.View>

        {/* Separator */}
        <View style={styles.tabSeparator} />

        {/* Tabs */}
        <View style={styles.mockTabBar}>
          {MOCK_TABS.map((tab, i) => {
            const highlighted = SLIDE_TAB[currentIndex] === i;
            return (
              <View key={tab.name} style={styles.mockTabItem}>
                {highlighted && <View style={styles.tabPill} />}
                <Ionicons
                  name={highlighted ? tab.filled : tab.icon}
                  size={22}
                  color={highlighted ? '#FFFFFF' : 'rgba(255,255,255,0.3)'}
                />
                <Text style={[styles.tabLabel, { color: highlighted ? '#FFFFFF' : 'rgba(255,255,255,0.3)' }]}>
                  {tab.name}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1B3D2F',
    zIndex: 200,
  },
  skipBtn: {
    position: 'absolute',
    top: 56,
    right: 24,
    zIndex: 10,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.45)',
  },
  slide: {
    width: SCREEN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  glowStack: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowOuter: {
    ...StyleSheet.absoluteFillObject,
  },
  glowMid: {
    position: 'absolute',
  },
  glowInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: IS_SMALL ? 22 : 26,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  body: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 26,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 24,
    marginBottom: 20,
    alignSelf: 'center',
  },
  dot: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D4A843',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D4A843',
    borderRadius: 100,
    paddingVertical: 16,
    paddingHorizontal: 40,
    marginBottom: 48,
    alignSelf: 'center',
  },
  nextBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1B3D2F',
  },
  mockTabWrapper: {
    width: SCREEN_WIDTH,
    position: 'relative',
  },
  arrowContainer: {
    position: 'absolute',
    top: -28,
    left: 0,
    width: 24,
    alignItems: 'center',
  },
  tabSeparator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  mockTabBar: {
    flexDirection: 'row',
    backgroundColor: '#1B3D2F',
    paddingTop: 10,
    flex: 1,
  },
  mockTabItem: {
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
    fontSize: 10,
    fontWeight: '600',
  },
});
