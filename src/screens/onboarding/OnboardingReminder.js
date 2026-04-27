import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import TypewriterText from '../../components/TypewriterText';
import ProgressDots from './ProgressDots';

function formatTime(date) {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

const DEFAULT_TIME = (() => { const d = new Date(); d.setHours(7, 0, 0, 0); return d; })();

export default function OnboardingReminder({ navigation, route }) {
  const insets                            = useSafeAreaInsets();
  const data                              = route.params ?? {};
  const [time, setTime]                   = useState(DEFAULT_TIME);
  const [subtitleReady, setSubtitleReady] = useState(false);
  const [pickerReady, setPickerReady]     = useState(false);
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  const contentOpacity                    = useRef(new Animated.Value(0)).current;

  function handleSubtitleComplete() {
    setPickerReady(true);
    Animated.timing(contentOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }

  function handleNext() {
    navigation.navigate('OnboardingAccount', {
      ...data,
      reminderTime: formatTime(time),
    });
  }

  return (
    <>
      <StatusBar style="light" />
      <LinearGradient colors={['#1B3D2F', '#0D2419']} style={{ flex: 1 }}>
        <View style={[styles.container, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}>
          <ProgressDots current={4} total={6} />

          <View style={styles.textWrap}>
            <TypewriterText
              lines={['When should we\ncheck in with you?']}
              charDelay={30}
              style={styles.question}
              onComplete={() => setSubtitleReady(true)}
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
            {Platform.OS === 'ios' ? (
              <DateTimePicker
                value={time}
                mode="time"
                display="spinner"
                onChange={(_, selected) => { if (selected) setTime(selected); }}
                themeVariant="dark"
                style={styles.picker}
              />
            ) : (
              <TouchableOpacity style={styles.androidTimeBtn} onPress={() => setShowAndroidPicker(true)} activeOpacity={0.75}>
                <Text style={styles.androidTimeText}>{formatTime(time)}</Text>
                <Text style={styles.androidTimeTap}>Tap to change</Text>
              </TouchableOpacity>
            )}
            {Platform.OS === 'android' && showAndroidPicker && (
              <DateTimePicker
                value={time}
                mode="time"
                display="default"
                onChange={(_, selected) => {
                  setShowAndroidPicker(false);
                  if (selected) setTime(selected);
                }}
              />
            )}
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
    alignItems: 'center',
  },
  picker: {
    width: '100%',
    height: 180,
  },
  androidTimeBtn: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 32,
    alignItems: 'center',
    width: '100%',
  },
  androidTimeText: {
    fontSize: 40,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  androidTimeTap: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 6,
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
