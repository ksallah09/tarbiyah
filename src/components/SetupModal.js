import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  Animated, Dimensions, ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MODAL_KEY = 'tarbiyah_setup_modal_seen';
const { width: SW } = Dimensions.get('window');

const STEPS = [
  {
    icon: 'person-add-outline',
    color: '#2E7D62',
    title: 'Add a child',
    desc: 'Your dashboards, daily habits, and youth trends are all built around your children.',
    cta: 'Add a Child',
    tab: 'Family',
    tabIcon: 'people-outline',
    tabLabel: 'Family tab → Configure',
  },
  {
    icon: 'bar-chart-outline',
    color: '#6366F1',
    title: 'Start a growth plan',
    desc: 'Set a weekly growth focus for your child to unlock a personalised Habit of the Day.',
    cta: 'Go to Dashboards',
    tab: 'Dashboards',
    tabIcon: 'apps-outline',
    tabLabel: 'Dashboards tab',
  },
  {
    icon: 'flag-outline',
    color: '#D4A843',
    title: 'Set family goals',
    desc: 'Give your whole family something to work toward together — faith, character, or connection.',
    cta: 'Set Goals',
    tab: 'Family',
    tabIcon: 'people-outline',
    tabLabel: 'Family tab → Child Growth',
  },
];

export default function SetupModal({ navigation }) {
  const [visible, setVisible]   = useState(false);
  const [page, setPage]         = useState(0); // 0 = steps, 1 = wrap-up
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    AsyncStorage.getItem(MODAL_KEY).then(val => {
      if (!val) {
        setVisible(true);
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      }
    });
  }, []);

  async function dismiss() {
    await AsyncStorage.setItem(MODAL_KEY, 'true');
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setVisible(false);
    });
  }

  function handleStepCta(step) {
    dismiss();
    if (step.tab === 'Dashboards') {
      navigation.navigate('Dashboards');
    } else if (step.title === 'Set family goals') {
      navigation.navigate('Family', { tab: 'childWins' });
    } else {
      navigation.navigate('Family', { tab: 'configure' });
    }
  }

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[s.overlay, { opacity: fadeAnim }]}>
        <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>

          {page === 0 ? (
            <>
              <View style={s.handle} />
              <Text style={s.heading}>Set Up Your Tarbiyah Experience</Text>
              <Text style={s.sub}>Complete these steps to bring the app to life for your family.</Text>

              <View style={s.stepList}>
                {STEPS.map((step, i) => (
                  <View key={i} style={s.stepRow}>
                    <View style={[s.stepIcon, { backgroundColor: step.color + '18' }]}>
                      <Ionicons name={step.icon} size={20} color={step.color} />
                    </View>
                    <View style={s.stepBody}>
                      <Text style={s.stepTitle}>{step.title}</Text>
                      <Text style={s.stepDesc}>{step.desc}</Text>
                    </View>
                    <TouchableOpacity
                      style={[s.stepBtn, { borderColor: step.color }]}
                      onPress={() => handleStepCta(step)}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.stepBtnText, { color: step.color }]}>Go →</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              <TouchableOpacity style={s.laterBtn} onPress={() => setPage(1)} activeOpacity={0.7}>
                <Text style={s.laterText}>I'll set up later</Text>
              </TouchableOpacity>
            </>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              <View style={s.handle} />

              {/* Partner invite — soft prompt */}
              <View style={s.partnerCard}>
                <Text style={s.partnerEmoji}>💑</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.partnerTitle}>Parenting with a partner?</Text>
                  <Text style={s.partnerDesc}>Connect them anytime from your Profile — you'll share goals and celebrate wins together.</Text>
                </View>
              </View>

              {/* Where to find everything */}
              <Text style={s.findHeading}>Here's where to find everything when you're ready:</Text>

              {STEPS.map((step, i) => (
                <View key={i} style={s.findRow}>
                  <View style={[s.findDot, { backgroundColor: step.color }]} />
                  <Text style={s.findLabel}>{step.title}</Text>
                  <View style={s.findPill}>
                    <Ionicons name={step.tabIcon} size={12} color="#1B3D2F" />
                    <Text style={s.findPillText}>{step.tabLabel}</Text>
                  </View>
                </View>
              ))}

              <TouchableOpacity style={s.doneBtn} onPress={dismiss} activeOpacity={0.85}>
                <Text style={s.doneBtnText}>Take Me to the App</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 12,
    maxHeight: '90%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 24,
  },
  heading: {
    fontSize: 22, fontWeight: '800', color: '#1A1A2E',
    marginBottom: 6, textAlign: 'center',
  },
  sub: {
    fontSize: 14, color: '#6B7280', textAlign: 'center',
    lineHeight: 21, marginBottom: 28,
  },

  // Step rows
  stepList: { gap: 20, marginBottom: 28 },
  stepRow:  { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepIcon: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  stepBody:    { flex: 1 },
  stepTitle:   { fontSize: 15, fontWeight: '700', color: '#1A1A2E', marginBottom: 2 },
  stepDesc:    { fontSize: 12, color: '#6B7280', lineHeight: 18 },
  stepBtn: {
    borderWidth: 1.5, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7, flexShrink: 0,
  },
  stepBtnText: { fontSize: 13, fontWeight: '700' },

  laterBtn: { alignItems: 'center', paddingVertical: 4 },
  laterText: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },

  // Wrap-up page
  partnerCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    backgroundColor: '#F9FAFB', borderRadius: 16,
    padding: 16, marginBottom: 28,
  },
  partnerEmoji: { fontSize: 26, marginTop: 2 },
  partnerTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A2E', marginBottom: 4 },
  partnerDesc:  { fontSize: 13, color: '#6B7280', lineHeight: 19 },

  findHeading: {
    fontSize: 13, fontWeight: '700', color: '#9CA3AF',
    letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 16,
  },
  findRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginBottom: 14,
  },
  findDot:  { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  findLabel: { fontSize: 14, fontWeight: '600', color: '#1A1A2E', flex: 1 },
  findPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#F0F7F4', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  findPillText: { fontSize: 11, fontWeight: '600', color: '#1B3D2F' },

  doneBtn: {
    backgroundColor: '#1B3D2F', borderRadius: 16,
    paddingVertical: 16, alignItems: 'center',
    marginTop: 24, marginBottom: 8,
  },
  doneBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
