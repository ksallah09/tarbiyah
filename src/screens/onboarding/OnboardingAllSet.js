import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import TypewriterText from '../../components/TypewriterText';
import { useAuth } from '../../../App';
import { markOnboardingComplete } from '../../utils/onboarding';

export default function OnboardingAllSet({ route }) {
  const insets      = useSafeAreaInsets();
  const name        = route.params?.name ?? 'friend';
  const [done, setDone]     = useState(false);
  const btnOpacity          = useRef(new Animated.Value(0)).current;
  const { completeOnboarding } = useAuth();

  function handleComplete() {
    setDone(true);
    Animated.timing(btnOpacity, {
      toValue: 1, duration: 700, useNativeDriver: true,
    }).start();
  }

  return (
    <>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#1B3D2F', '#0D2419']}
        style={[styles.container, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 48 }]}
      >
        {/* Decorative circle */}
        <View style={styles.decorCircle} />

        <View style={styles.textWrap}>
          <TypewriterText
            lines={[
              `JazakAllahu\nKhayran, ${name}.`,
              'Your first insight\nis ready.',
            ]}
            charDelay={28}
            lineDelay={700}
            style={styles.line}
            lineStyle={{
              0: styles.lineName,
              1: styles.lineSub,
            }}
            onComplete={handleComplete}
          />
        </View>

        <Animated.View style={[styles.btnWrap, { opacity: btnOpacity }]}>
          <TouchableOpacity
            style={styles.btn}
            activeOpacity={0.85}
            onPress={async () => { await markOnboardingComplete(); completeOnboarding(); }}
          >
            <Text style={styles.btnText}>Open Tarbiyah</Text>
          </TouchableOpacity>
        </Animated.View>
      </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  decorCircle: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    borderWidth: 1,
    borderColor: 'rgba(107,124,69,0.2)',
    top: -80,
    right: -80,
  },
  textWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  line: {
    color: '#FFFFFF',
  },
  lineName: {
    fontSize: 44,
    fontWeight: '700',
    lineHeight: 54,
    color: '#FFFFFF',
  },
  lineSub: {
    fontSize: 22,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 32,
    marginTop: 6,
  },
  btnWrap: {
    gap: 12,
  },
  btn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  btnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1B3D2F',
    letterSpacing: 0.2,
  },
});
