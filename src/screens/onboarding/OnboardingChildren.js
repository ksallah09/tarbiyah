import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import TypewriterText from '../../components/TypewriterText';
import ProgressDots from './ProgressDots';

const COUNTS  = ['1', '2', '3', '4', '5+'];
const AGE_GROUPS = [
  { id: 'under-5',  label: 'Under 5',  sub: 'Toddler & Preschool' },
  { id: '5-10',     label: '5 – 10',   sub: 'Early Childhood'     },
  { id: '11-15',    label: '11 – 15',  sub: 'Pre-Teen'            },
  { id: '16-plus',  label: '16+',      sub: 'Young Adult'         },
];

export default function OnboardingChildren({ navigation, route }) {
  const insets            = useSafeAreaInsets();
  const data              = route.params ?? {};
  const [count, setCount]       = useState(null);
  const [ages, setAges]         = useState([]);
  const [ready, setReady]       = useState(false);
  const contentOpacity          = useRef(new Animated.Value(0)).current;

  function handleComplete() {
    setReady(true);
    Animated.timing(contentOpacity, {
      toValue: 1, duration: 500, useNativeDriver: true,
    }).start();
  }

  function toggleAge(id) {
    setAges(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  }

  const canContinue = count !== null && ages.length > 0;

  function handleNext() {
    if (!canContinue) return;
    navigation.navigate('OnboardingFamilyStructure', {
      ...data,
      childrenCount: count,
      childrenAges: ages,
    });
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
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <ProgressDots current={1} total={6} />

          <View style={styles.textWrap}>
            <TypewriterText
              lines={['Tell us about\nyour children.']}
              charDelay={30}
              style={styles.question}
              onComplete={handleComplete}
            />
          </View>

          <Animated.View style={{ opacity: contentOpacity, gap: 32 }}>
            {/* ── Count ── */}
            <View>
              <Text style={styles.sectionLabel}>HOW MANY CHILDREN?</Text>
              <View style={styles.countRow}>
                {COUNTS.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.countBtn, count === c && styles.countBtnActive]}
                    onPress={() => setCount(c)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.countText, count === c && styles.countTextActive]}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* ── Age Groups ── */}
            <View>
              <Text style={styles.sectionLabel}>WHICH AGE GROUPS?</Text>
              <Text style={styles.sectionSub}>Select all that apply — required</Text>
              <View style={styles.ageGrid}>
                {AGE_GROUPS.map(ag => {
                  const selected = ages.includes(ag.id);
                  return (
                    <TouchableOpacity
                      key={ag.id}
                      style={[styles.ageCard, selected && styles.ageCardActive]}
                      onPress={() => toggleAge(ag.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.ageLabel, selected && styles.ageLabelActive]}>
                        {ag.label}
                      </Text>
                      <Text style={[styles.ageSub, selected && styles.ageSubActive]}>
                        {ag.sub}
                      </Text>
                      {selected && (
                        <View style={styles.ageCheck}>
                          <Text style={styles.ageCheckText}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* ── Continue ── */}
            <TouchableOpacity
              style={[styles.btn, !canContinue && styles.btnDisabled]}
              onPress={handleNext}
              activeOpacity={0.85}
              disabled={!canContinue}
            >
              <Text style={styles.btnText}>Continue</Text>
            </TouchableOpacity>

            {!canContinue && ages.length === 0 && count !== null && (
              <Text style={styles.validation}>Please select at least one age group</Text>
            )}
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
    marginBottom: 36,
  },
  question: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 46,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1.5,
    marginBottom: 14,
  },
  sectionSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    marginTop: -10,
    marginBottom: 14,
  },
  countRow: {
    flexDirection: 'row',
    gap: 10,
  },
  countBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBtnActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  countText: {
    fontSize: 17,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  countTextActive: {
    color: '#1B3D2F',
  },
  ageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  ageCard: {
    width: '47.5%',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
    padding: 16,
    position: 'relative',
  },
  ageCardActive: {
    backgroundColor: 'rgba(107,124,69,0.35)',
    borderColor: '#6B7C45',
  },
  ageLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  ageLabelActive: {
    color: '#FFFFFF',
  },
  ageSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    fontWeight: '500',
  },
  ageSubActive: {
    color: 'rgba(255,255,255,0.65)',
  },
  ageCheck: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#6B7C45',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ageCheckText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  btn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: {
    opacity: 0.3,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1B3D2F',
  },
  validation: {
    textAlign: 'center',
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: -20,
  },
  
  backBtn: { alignItems: 'center', paddingVertical: 12 },
  backText: { fontSize: 13, color: 'rgba(255,255,255,0.35)', fontWeight: '500' },
});
