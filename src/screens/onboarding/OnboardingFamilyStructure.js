import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import TypewriterText from '../../components/TypewriterText';
import ProgressDots from './ProgressDots';

const OPTIONS = [
  {
    value: 'married',
    label: 'Married',
    sub: 'Parenting with a partner',
    icon: 'people-outline',
  },
  {
    value: 'single_parent',
    label: 'Single Parent',
    sub: 'Parenting on your own',
    icon: 'person-outline',
  },
  {
    value: 'prefer_not_to_say',
    label: 'Prefer not to say',
    sub: 'We\'ll keep guidance general',
    icon: 'ellipsis-horizontal-outline',
  },
];

export default function OnboardingFamilyStructure({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const data = route.params ?? {};
  const [selected, setSelected] = useState(null);
  const [ready, setReady] = useState(false);
  const contentOpacity = useRef(new Animated.Value(0)).current;

  function handleComplete() {
    setReady(true);
    Animated.timing(contentOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }

  function handleNext() {
    const value = selected ?? 'prefer_not_to_say';
    navigation.navigate('OnboardingFocusAreas', { ...data, familyStructure: value });
  }

  return (
    <>
      <StatusBar style="light" />
      <LinearGradient colors={['#1B3D2F', '#0D2419']} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.container, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          <ProgressDots current={2} total={6} />

          <View style={styles.textWrap}>
            <TypewriterText
              lines={['What best describes\nyour situation?']}
              charDelay={30}
              style={styles.question}
              onComplete={handleComplete}
            />
          </View>

          <Animated.View style={{ opacity: contentOpacity, gap: 12 }}>
            <Text style={styles.helper}>This helps us tailor advice to your reality.</Text>

            {OPTIONS.map(opt => {
              const active = selected === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.option, active && styles.optionActive]}
                  onPress={() => setSelected(opt.value)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.optionIcon, active && styles.optionIconActive]}>
                    <Ionicons name={opt.icon} size={20} color={active ? '#1B3D2F' : 'rgba(255,255,255,0.6)'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{opt.label}</Text>
                    <Text style={[styles.optionSub, active && styles.optionSubActive]}>{opt.sub}</Text>
                  </View>
                  {active && <Ionicons name="checkmark-circle" size={22} color="#6B7C45" />}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={[styles.btn, !selected && styles.btnMuted]}
              onPress={handleNext}
              activeOpacity={0.85}
            >
              <Text style={styles.btnText}>{selected ? 'Continue' : 'Skip for now'}</Text>
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
  textWrap: { marginBottom: 12 },
  question: { fontSize: 36, fontWeight: '700', color: '#FFFFFF', lineHeight: 46 },
  helper: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 16 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 18, padding: 16,
  },
  optionActive: { backgroundColor: 'rgba(107,124,69,0.25)', borderColor: '#6B7C45' },
  optionIcon: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  optionIconActive: { backgroundColor: 'rgba(255,255,255,0.9)' },
  optionLabel: { fontSize: 17, fontWeight: '600', color: 'rgba(255,255,255,0.75)', marginBottom: 2 },
  optionLabelActive: { color: '#FFFFFF' },
  optionSub: { fontSize: 12, color: 'rgba(255,255,255,0.35)' },
  optionSubActive: { color: 'rgba(255,255,255,0.6)' },
  btn: { backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
  btnMuted: { backgroundColor: 'rgba(255,255,255,0.15)' },
  btnText: { fontSize: 16, fontWeight: '700', color: '#1B3D2F' },
  backBtn: { alignItems: 'center', paddingVertical: 12 },
  backText: { fontSize: 13, color: 'rgba(255,255,255,0.35)', fontWeight: '500' },
});
