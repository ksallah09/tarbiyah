import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import TypewriterText from '../../components/TypewriterText';
import ProgressDots from './ProgressDots';

const HOURS   = ['6', '7', '8', '9', '10', '11', '12'];
const MINUTES = ['00', '15', '30', '45'];
const PERIODS = ['AM', 'PM'];

export default function OnboardingReminder({ navigation, route }) {
  const insets          = useSafeAreaInsets();
  const data            = route.params ?? {};
  const [hour, setHour]     = useState('7');
  const [minute, setMinute] = useState('00');
  const [period, setPeriod] = useState('AM');
  const [subtitleReady, setSubtitleReady] = useState(false);
  const [pickerReady, setPickerReady]     = useState(false);
  const contentOpacity                    = useRef(new Animated.Value(0)).current;

  function handleQuestionComplete() {
    setSubtitleReady(true);
  }

  function handleSubtitleComplete() {
    setPickerReady(true);
    Animated.timing(contentOpacity, {
      toValue: 1, duration: 500, useNativeDriver: true,
    }).start();
  }

  function handleNext() {
    navigation.navigate('OnboardingAccount', {
      ...data,
      reminderTime: `${hour}:${minute} ${period}`,
    });
  }

  return (
    <>
      <StatusBar style="light" />
      <LinearGradient colors={['#1B3D2F', '#0D2419']} style={{ flex: 1 }}>
        <View style={[styles.container, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}>
          <ProgressDots current={3} total={5} />

          <View style={styles.textWrap}>
            <TypewriterText
              lines={['When should we\ncheck in with you?']}
              charDelay={30}
              style={styles.question}
              onComplete={handleQuestionComplete}
            />
            {subtitleReady && (
              <TypewriterText
                lines={["Each day at this time, we'll send you a parenting insight drawn from Islamic wisdom and child development research — a moment to reflect and grow."]}
                charDelay={18}
                style={styles.subText}
                onComplete={handleSubtitleComplete}
              />
            )}
          </View>

          <Animated.View style={[styles.pickerWrap, { opacity: contentOpacity }]}>
            {/* Time display */}
            <View style={styles.timeDisplay}>
              <Text style={styles.timeText}>{hour}:{minute}</Text>
              <Text style={styles.timePeriod}>{period}</Text>
            </View>

            {/* Hour row */}
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Hour</Text>
              <View style={styles.chips}>
                {HOURS.map(h => (
                  <TouchableOpacity
                    key={h}
                    style={[styles.chip, hour === h && styles.chipActive]}
                    onPress={() => setHour(h)}
                  >
                    <Text style={[styles.chipText, hour === h && styles.chipTextActive]}>{h}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Minute row */}
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Minute</Text>
              <View style={styles.chips}>
                {MINUTES.map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.chip, minute === m && styles.chipActive]}
                    onPress={() => setMinute(m)}
                  >
                    <Text style={[styles.chipText, minute === m && styles.chipTextActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* AM / PM */}
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Period</Text>
              <View style={styles.chips}>
                {PERIODS.map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.chip, period === p && styles.chipActive]}
                    onPress={() => setPeriod(p)}
                  >
                    <Text style={[styles.chipText, period === p && styles.chipTextActive]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </Animated.View>

          <Animated.View style={{ opacity: contentOpacity, marginTop: 32 }}>
            <TouchableOpacity style={styles.btn} onPress={handleNext} activeOpacity={0.85}>
              <Text style={styles.btnText}>Continue</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.skipBtn}
              onPress={() => navigation.navigate('OnboardingAccount', { ...data, reminderTime: null })}
            >
              <Text style={styles.skipText}>Skip for now</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 28,
  },
  textWrap: {
    marginBottom: 28,
  },
  question: {
    fontSize: 34,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 44,
    marginBottom: 12,
  },
  subText: {
    fontSize: 15,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 24,
  },
  pickerWrap: {
    gap: 20,
  },
  timeDisplay: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    marginBottom: 8,
  },
  timeText: {
    fontSize: 52,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 60,
  },
  timePeriod: {
    fontSize: 22,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 8,
  },
  row: {
    gap: 10,
  },
  rowLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1.4,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  chipActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.55)',
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
  btnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1B3D2F',
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
    fontWeight: '500',
  },
  
  backBtn: { alignItems: 'center', paddingVertical: 12 },
  backText: { fontSize: 13, color: 'rgba(255,255,255,0.35)', fontWeight: '500' },
});
