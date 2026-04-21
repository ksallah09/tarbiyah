import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, Dimensions, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../../App';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SLIDES = [
  {
    key: 'welcome',
    icon: 'sparkles',
    iconColor: '#D4A843',
    title: 'Welcome to Tarbiyah',
    body: 'Built for Muslim parents striving to nurture faith, character, and confidence in their children.',
  },
  {
    key: 'insights',
    icon: 'sunny-outline',
    iconColor: '#D4A843',
    title: 'Daily Wisdom',
    body: "Every day brings a new spiritual and research-backed parenting insight, personalized to your family's ages and focus areas.",
  },
  {
    key: 'learn',
    icon: 'layers-outline',
    iconColor: '#D4A843',
    title: 'Learn Together',
    body: "Generate personalized learning modules on any parenting topic - with audio narration for when you're too busy to read.",
  },
  {
    key: 'community',
    icon: 'people-outline',
    iconColor: '#D4A843',
    title: 'Parents Helping Parents',
    body: "Discover resources shared by Muslim parents around the world. Save your favorites and share what's helped your family.",
  },
  {
    key: 'goals',
    icon: 'trending-up-outline',
    iconColor: '#D4A843',
    title: 'Track Your Goals',
    body: 'Set Islamic parenting goals, track your progress, and build consistent habits that strengthen your home.',
  },
];

export default function FeatureTourScreen() {
  const insets = useSafeAreaInsets();
  const { completeOnboarding } = useAuth();
  const flatListRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;

  function goNext() {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      completeOnboarding();
    }
  }

  const isLast = currentIndex === SLIDES.length - 1;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
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
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onMomentumScrollEnd={e => {
          const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setCurrentIndex(index);
        }}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            {/* Glow rings */}
            <View style={styles.glowOuter} />
            <View style={styles.glowMid} />
            <View style={styles.glowInner}>
              <Ionicons name={item.icon} size={52} color={item.iconColor} />
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
          </View>
        )}
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
          return (
            <Animated.View key={i} style={[styles.dot, { opacity, width }]} />
          );
        })}
      </View>

      {/* Next / Get Started */}
      <TouchableOpacity
        style={styles.nextBtn}
        onPress={goNext}
        activeOpacity={0.85}
      >
        <Text style={styles.nextBtnText}>
          {isLast ? 'Get Started' : 'Next'}
        </Text>
        {!isLast && <Ionicons name="arrow-forward" size={16} color="#1B3D2F" style={{ marginLeft: 6 }} />}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1B3D2F',
    zIndex: 200,
    alignItems: 'center',
    justifyContent: 'center',
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
  glowOuter: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(212,168,67,0.06)',
    position: 'absolute',
    alignSelf: 'center',
  },
  glowMid: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(212,168,67,0.1)',
    position: 'absolute',
    alignSelf: 'center',
  },
  glowInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(212,168,67,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 26,
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
    marginTop: 48,
    marginBottom: 24,
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
    marginBottom: 8,
  },
  nextBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1B3D2F',
  },
});
