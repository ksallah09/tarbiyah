import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  ScrollView, useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import TypewriterText from '../../components/TypewriterText';
import ProgressDots from './ProgressDots';

const DAYS = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
];

const SLOTS = [
  { key: 'morning',   label: 'Morning',   icon: 'sunny-outline',  short: 'Morn' },
  { key: 'afternoon', label: 'Afternoon', icon: 'partly-sunny-outline', short: 'Aft' },
  { key: 'evening',   label: 'Evening',   icon: 'moon-outline',   short: 'Eve' },
];

// selected shape: { mon: ['morning', 'evening'], tue: [], ... }

export default function OnboardingAvailability({ navigation, route }) {
  const insets    = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const data      = route.params ?? {};

  const [selected, setSelected] = useState({});
  const [ready, setReady]       = useState(false);
  const contentOpacity          = useRef(new Animated.Value(0)).current;

  function handleComplete() {
    setReady(true);
    Animated.timing(contentOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }

  function toggle(dayKey, slotKey) {
    setSelected(prev => {
      const dayCurrent = prev[dayKey] ?? [];
      const next = dayCurrent.includes(slotKey)
        ? dayCurrent.filter(s => s !== slotKey)
        : [...dayCurrent, slotKey];
      return { ...prev, [dayKey]: next };
    });
  }

  function isSelected(dayKey, slotKey) {
    return (selected[dayKey] ?? []).includes(slotKey);
  }

  const totalSelected = Object.values(selected).flat().length;
  const canContinue   = totalSelected > 0;

  function handleNext() {
    navigation.navigate('OnboardingCulture', { ...data, availability: selected });
  }

  // Layout math: screen width minus outer padding, card inner padding, label col, and 6 gaps
  const HORIZ_PAD  = 28;
  const CARD_PAD   = 12;
  const LABEL_COL  = 64;
  const GAP        = 5;
  const cellWidth  = Math.floor((width - HORIZ_PAD * 2 - CARD_PAD * 2 - LABEL_COL - GAP * 6) / 7);

  return (
    <>
      <StatusBar style="light" />
      <LinearGradient colors={['#1B3D2F', '#0D2419']} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.container, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
        >
          <ProgressDots current={5} total={9} />

          <View style={styles.textWrap}>
            <TypewriterText
              lines={['When do you get\ntime with your kids?']}
              charDelay={30}
              style={styles.question}
              onComplete={handleComplete}
            />
          </View>

          <Animated.View style={[styles.body, { opacity: contentOpacity }]}>
            <Text style={styles.helper}>Tap the times you're typically with the kids.</Text>

            {/* Calendar grid */}
            <View style={styles.calendarWrap}>

              {/* Day headers */}
              <View style={styles.headerRow}>
                <View style={{ width: LABEL_COL }} />
                {DAYS.map(d => (
                  <View key={d.key} style={[styles.dayHeader, { width: cellWidth }]}>
                    <Text style={styles.dayHeaderText}>{d.label}</Text>
                  </View>
                ))}
              </View>

              {/* Slot rows */}
              {SLOTS.map(slot => (
                <View key={slot.key} style={styles.slotRow}>
                  {/* Row label */}
                  <View style={[styles.slotLabelWrap, { width: LABEL_COL }]}>
                    <Ionicons name={slot.icon} size={13} color="rgba(255,255,255,0.5)" />
                    <Text style={styles.slotLabel}>{slot.label}</Text>
                  </View>

                  {/* Day cells */}
                  {DAYS.map(d => {
                    const active = isSelected(d.key, slot.key);
                    return (
                      <TouchableOpacity
                        key={d.key}
                        style={[
                          styles.cell,
                          { width: cellWidth, height: cellWidth },
                          active && styles.cellActive,
                        ]}
                        onPress={() => toggle(d.key, slot.key)}
                        activeOpacity={0.7}
                      >
                        {active && (
                          <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}

            </View>

            {/* Selection summary */}
            {totalSelected > 0 && (
              <View style={styles.summaryRow}>
                <Ionicons name="time-outline" size={14} color="#A8D5C2" />
                <Text style={styles.summaryText}>
                  {totalSelected} slot{totalSelected !== 1 ? 's' : ''} selected
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.btn, !canContinue && styles.btnDisabled]}
              onPress={handleNext}
              activeOpacity={0.85}
              disabled={!canContinue}
            >
              <Text style={styles.btnText}>Continue</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.skipBtn}
              onPress={() => navigation.navigate('OnboardingCulture', { ...data, availability: {} })}
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
  question:  { fontSize: 34, fontWeight: '700', color: '#FFFFFF', lineHeight: 44 },
  body:      { gap: 0 },
  helper:    { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 24, lineHeight: 20 },

  // Calendar
  calendarWrap: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 5,
  },
  dayHeader: { alignItems: 'center' },
  dayHeaderText: {
    fontSize: 11, fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.3,
  },

  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 5,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  slotLabelWrap: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 3,
  },
  slotLabel: {
    fontSize: 11, fontWeight: '600',
    color: 'rgba(255,255,255,0.45)',
  },

  cell: {
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cellActive: {
    backgroundColor: '#2E7D62',
    borderColor: '#4ADE80',
  },

  // Summary
  summaryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 20,
  },
  summaryText: { fontSize: 13, color: '#A8D5C2', fontWeight: '600' },

  btn:         { backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  btnDisabled: { opacity: 0.3 },
  btnText:     { fontSize: 16, fontWeight: '700', color: '#1B3D2F' },
  skipBtn:     { alignItems: 'center', paddingVertical: 12 },
  skipText:    { fontSize: 13, color: 'rgba(255,255,255,0.45)', fontWeight: '500' },
  backBtn:     { alignItems: 'center', paddingVertical: 8 },
  backText:    { fontSize: 13, color: 'rgba(255,255,255,0.25)', fontWeight: '500' },
});
