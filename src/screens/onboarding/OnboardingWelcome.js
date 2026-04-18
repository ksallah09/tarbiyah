import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import TypewriterText from '../../components/TypewriterText';
import { rs, hp } from '../../utils/responsive';

const LINES = [
  'Bismillah.',
  'Welcome to Tarbiyah.',
  'Daily guidance for Islamic-based parenting.',
];

export default function OnboardingWelcome({ navigation }) {
  const insets = useSafeAreaInsets();
  const btnOpacity = React.useRef(new Animated.Value(0)).current;

  function handleComplete() {
    Animated.timing(btnOpacity, {
      toValue: 1, duration: 600, useNativeDriver: true,
    }).start();
  }

  return (
    <>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#1B3D2F', '#0D2419']}
        style={[styles.container, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }]}
      >
        {/* Arabic bismillah stamp */}
        <View style={styles.arabicWrap}>
          <Text style={styles.arabic}>بِسْمِ اللَّهِ</Text>
        </View>

        <View style={styles.textWrap}>
          <TypewriterText
            lines={LINES}
            charDelay={32}
            lineDelay={520}
            style={styles.line}
            lineStyle={{
              0: styles.lineSmall,
              1: styles.lineLarge,
              2: styles.lineMid,
            }}
            onComplete={handleComplete}
          />
        </View>

        <Animated.View style={[styles.btnWrap, { opacity: btnOpacity }]}>
          <TouchableOpacity
            style={styles.btn}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('OnboardingAbout')}
          >
            <Text style={styles.btnText}>Begin</Text>
          </TouchableOpacity>
        </Animated.View>
      </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: rs(28),
    justifyContent: 'space-between',
  },
  arabicWrap: {
    alignItems: 'flex-start',
  },
  arabic: {
    fontSize: 22,
    color: 'rgba(255,255,255,0.3)',
    fontWeight: '300',
  },
  textWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 40,
  },
  line: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 30,
    fontWeight: '300',
  },
  lineSmall: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '400',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  lineLarge: {
    fontSize: rs(34),
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: rs(42),
    marginTop: 6,
  },
  lineMid: {
    fontSize: 17,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 26,
    marginTop: 4,
  },
  btnWrap: {
    alignItems: 'center',
    gap: 12,
  },
  btn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 48,
    width: '100%',
    alignItems: 'center',
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1B3D2F',
    letterSpacing: 0.3,
  },
  hint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    fontWeight: '400',
  },
});
