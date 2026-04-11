import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import TypewriterText from '../../components/TypewriterText';
import ProgressDots from './ProgressDots';
import { ALL_FOCUS_AREAS } from '../../utils/focusAreas';

export default function OnboardingFocusAreas({ navigation, route }) {
  const insets              = useSafeAreaInsets();
  const data                = route.params ?? {};
  const [selected, setSelected] = useState([]);
  const [ready, setReady]       = useState(false);
  const contentOpacity          = useRef(new Animated.Value(0)).current;

  function handleComplete() {
    setReady(true);
    Animated.timing(contentOpacity, {
      toValue: 1, duration: 500, useNativeDriver: true,
    }).start();
  }

  function toggle(id) {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  }

  function handleNext() {
    if (selected.length === 0) return;
    navigation.navigate('OnboardingReminder', { ...data, focusAreas: selected });
  }

  return (
    <>
      <StatusBar style="light" />
      <LinearGradient colors={['#1B3D2F', '#0D2419']} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[
            styles.container,
            { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <ProgressDots current={2} total={5} />

          <View style={styles.textWrap}>
            <TypewriterText
              lines={["What parenting challenges\nare you facing right now?"]}
              charDelay={28}
              style={styles.question}
              onComplete={handleComplete}
            />
          </View>

          <Animated.View style={{ opacity: contentOpacity }}>
            <Text style={styles.subLabel}>Select all that apply</Text>

            <View style={styles.grid}>
              {ALL_FOCUS_AREAS.map(area => {
                const sel = selected.includes(area.id);
                return (
                  <TouchableOpacity
                    key={area.id}
                    style={[styles.chip, sel && styles.chipActive]}
                    onPress={() => toggle(area.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={area.icon}
                      size={14}
                      color={sel ? '#1B3D2F' : 'rgba(255,255,255,0.55)'}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.chipText, sel && styles.chipTextActive]}>
                      {area.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.btn, selected.length === 0 && styles.btnDisabled]}
              onPress={handleNext}
              activeOpacity={0.85}
              disabled={selected.length === 0}
            >
              <Text style={styles.btnText}>Continue</Text>
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
  container: {
    paddingHorizontal: 28,
    flexGrow: 1,
  },
  textWrap: {
    marginBottom: 28,
  },
  question: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 42,
  },
  subLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1.4,
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 32,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  chipActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.65)',
  },
  chipTextActive: {
    color: '#1B3D2F',
  },
  btn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.3 },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1B3D2F',
  },
  
  backBtn: { alignItems: 'center', paddingVertical: 12 },
  backText: { fontSize: 13, color: 'rgba(255,255,255,0.35)', fontWeight: '500' },
});
