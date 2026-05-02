import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import TypewriterText from '../../components/TypewriterText';
import ProgressDots from './ProgressDots';

const HOUR_RANGES = [
  { value: 'under-20', label: 'Under 20', sub: 'Part-time' },
  { value: '20-30',    label: '20 – 30',  sub: 'Part-time'  },
  { value: '30-40',    label: '30 – 40',  sub: 'Full-time'  },
  { value: '40-50',    label: '40 – 50',  sub: 'Full-time'  },
  { value: '50-plus',  label: '50+',      sub: 'Long hours' },
];

export default function OnboardingWorkHours({ navigation, route }) {
  const insets   = useSafeAreaInsets();
  const data     = route.params ?? {};
  const [selected, setSelected] = useState(null);
  const [ready,    setReady]    = useState(false);
  const contentOpacity = useRef(new Animated.Value(0)).current;

  function handleComplete() {
    setReady(true);
    Animated.timing(contentOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }

  function handleNext() {
    navigation.navigate('OnboardingAvailability', { ...data, workHoursPerWeek: selected });
  }

  return (
    <>
      <StatusBar style="light" />
      <LinearGradient colors={['#1B3D2F', '#0D2419']} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.container, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          <ProgressDots current={4} total={9} />

          <View style={styles.textWrap}>
            <TypewriterText
              lines={['How many hours\na week do you work?']}
              charDelay={30}
              style={styles.question}
              onComplete={handleComplete}
            />
          </View>

          <Animated.View style={[styles.body, { opacity: contentOpacity }]}>
            <Text style={styles.helper}>This helps us suggest habits that fit your schedule.</Text>

            <View style={styles.grid}>
              {HOUR_RANGES.map(opt => {
                const active = selected === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.tile, active && styles.tileActive]}
                    onPress={() => setSelected(opt.value)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.tileNum, active && styles.tileNumActive]}>{opt.label}</Text>
                    <Text style={styles.tileLabel}>hrs / week</Text>
                    <Text style={[styles.tileSub, active && styles.tileSubActive]}>{opt.sub}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.btn, !selected && styles.btnDisabled]}
              onPress={handleNext}
              activeOpacity={0.85}
              disabled={!selected}
            >
              <Text style={styles.btnText}>Continue</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.skipBtn}
              onPress={() => navigation.navigate('OnboardingAvailability', { ...data, workHoursPerWeek: null })}
              activeOpacity={0.7}
            >
              <Text style={styles.skipText}>Skip for now</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 28, flexGrow: 1 },
  textWrap:  { marginBottom: 8 },
  question:  { fontSize: 36, fontWeight: '700', color: '#FFFFFF', lineHeight: 46 },
  body:      { gap: 0 },
  helper:    { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 24 },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 28,
  },
  tile: {
    width: '30%',
    flexGrow: 1,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 4,
  },
  tileActive:    { backgroundColor: 'rgba(107,124,69,0.25)', borderColor: '#6B7C45' },
  tileNum:       { fontSize: 20, fontWeight: '800', color: 'rgba(255,255,255,0.7)', letterSpacing: -0.5 },
  tileNumActive: { color: '#FFFFFF' },
  tileLabel:     { fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: '500' },
  tileSub:       { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: '500', marginTop: 4 },
  tileSubActive: { color: 'rgba(255,255,255,0.6)' },

  btn:         { backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  btnDisabled: { opacity: 0.3 },
  btnText:     { fontSize: 16, fontWeight: '700', color: '#1B3D2F' },
  skipBtn:     { alignItems: 'center', paddingVertical: 12 },
  skipText:    { fontSize: 13, color: 'rgba(255,255,255,0.45)', fontWeight: '500' },
  backBtn:     { alignItems: 'center', paddingVertical: 8 },
  backText:    { fontSize: 13, color: 'rgba(255,255,255,0.25)', fontWeight: '500' },
});
