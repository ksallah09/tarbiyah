import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import TypewriterText from '../../components/TypewriterText';
import ProgressDots from './ProgressDots';

const ROLE_OPTIONS = [
  { value: 'mother', label: 'Mother', icon: 'female-outline' },
  { value: 'father', label: 'Father', icon: 'male-outline' },
];

const WORKING_OPTIONS = [
  { value: true,  label: 'Yes, I work',         sub: 'Full-time, part-time, or self-employed' },
  { value: false, label: "No, I don't work",     sub: 'Home, volunteering, or taking a break' },
];

export default function OnboardingParentRole({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const data   = route.params ?? {};
  const [role,       setRole]       = useState(null);
  const [isWorking,  setIsWorking]  = useState(null);
  const [ready,      setReady]      = useState(false);
  const contentOpacity = useRef(new Animated.Value(0)).current;

  function handleComplete() {
    setReady(true);
    Animated.timing(contentOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }

  const canContinue = role !== null && isWorking !== null;

  function handleNext() {
    const next = { ...data, parentRole: role, isWorkingParent: isWorking };
    if (isWorking) {
      navigation.navigate('OnboardingWorkHours', next);
    } else {
      navigation.navigate('OnboardingAvailability', { ...next, workHoursPerWeek: null });
    }
  }

  return (
    <>
      <StatusBar style="light" />
      <LinearGradient colors={['#1B3D2F', '#0D2419']} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.container, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          <ProgressDots current={3} total={9} />

          <View style={styles.textWrap}>
            <TypewriterText
              lines={['Tell us a bit\nabout yourself']}
              charDelay={30}
              style={styles.question}
              onComplete={handleComplete}
            />
          </View>

          <Animated.View style={[styles.body, { opacity: contentOpacity }]}>

            {/* Mother / Father */}
            <Text style={styles.sectionLabel}>I am a</Text>
            <View style={styles.roleRow}>
              {ROLE_OPTIONS.map(opt => {
                const active = role === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.roleBtn, active && styles.roleBtnActive]}
                    onPress={() => setRole(opt.value)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.roleIcon, active && styles.roleIconActive]}>
                      <Ionicons name={opt.icon} size={22} color={active ? '#1B3D2F' : 'rgba(255,255,255,0.6)'} />
                    </View>
                    <Text style={[styles.roleLabel, active && styles.roleLabelActive]}>{opt.label}</Text>
                    {active && (
                      <View style={styles.roleCheck}>
                        <Ionicons name="checkmark-circle" size={16} color="#6B7C45" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Working parent */}
            <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Am I a working parent?</Text>
            <View style={styles.workingOptions}>
              {WORKING_OPTIONS.map(opt => {
                const active = isWorking === opt.value;
                return (
                  <TouchableOpacity
                    key={String(opt.value)}
                    style={[styles.option, active && styles.optionActive]}
                    onPress={() => setIsWorking(opt.value)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.optionText}>
                      <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{opt.label}</Text>
                      <Text style={[styles.optionSub, active && styles.optionSubActive]}>{opt.sub}</Text>
                    </View>
                    {active && <Ionicons name="checkmark-circle" size={22} color="#6B7C45" />}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.btn, !canContinue && styles.btnDisabled]}
              onPress={handleNext}
              activeOpacity={0.85}
              disabled={!canContinue}
            >
              <Text style={styles.btnText}>Continue</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.skipBtn} onPress={() => navigation.navigate('OnboardingAvailability', { ...data, parentRole: role, isWorkingParent: null, workHoursPerWeek: null })} activeOpacity={0.7}>
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
  container:    { paddingHorizontal: 28, flexGrow: 1 },
  textWrap:     { marginBottom: 12 },
  question:     { fontSize: 36, fontWeight: '700', color: '#FFFFFF', lineHeight: 46 },
  body:         { gap: 0 },
  sectionLabel: { fontSize: 13, color: 'rgba(255,255,255,0.45)', fontWeight: '600', letterSpacing: 0.5, marginBottom: 12 },

  // Role tiles
  roleRow: { flexDirection: 'row', gap: 12 },
  roleBtn: {
    flex: 1,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 18, paddingVertical: 18, paddingHorizontal: 12,
    alignItems: 'center', gap: 10, position: 'relative',
  },
  roleBtnActive:   { backgroundColor: 'rgba(107,124,69,0.2)', borderColor: '#6B7C45' },
  roleIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  roleIconActive:  { backgroundColor: 'rgba(255,255,255,0.9)' },
  roleLabel:       { fontSize: 16, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  roleLabelActive: { color: '#FFFFFF' },
  roleCheck:       { position: 'absolute', top: 10, right: 10 },

  // Working parent options
  workingOptions: { gap: 10, marginBottom: 28 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 18, padding: 16,
  },
  optionActive:      { backgroundColor: 'rgba(107,124,69,0.2)', borderColor: '#6B7C45' },
  optionText:        { flex: 1 },
  optionLabel:       { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.75)', marginBottom: 3 },
  optionLabelActive: { color: '#FFFFFF' },
  optionSub:         { fontSize: 12, color: 'rgba(255,255,255,0.35)' },
  optionSubActive:   { color: 'rgba(255,255,255,0.55)' },

  btn:         { backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  btnDisabled: { opacity: 0.3 },
  btnText:     { fontSize: 16, fontWeight: '700', color: '#1B3D2F' },
  skipBtn:     { alignItems: 'center', paddingVertical: 12 },
  skipText:    { fontSize: 13, color: 'rgba(255,255,255,0.45)', fontWeight: '500' },
  backBtn:     { alignItems: 'center', paddingVertical: 8 },
  backText:    { fontSize: 13, color: 'rgba(255,255,255,0.25)', fontWeight: '500' },
});
