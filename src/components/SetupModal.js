import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  Animated, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Resets on every app restart — modal shows each session until all steps done
let sessionShown = false;
export function resetSetupSession() { sessionShown = false; }

const STEPS = [
  {
    icon: 'person-add-outline',
    color: '#2E7D62',
    title: 'Add a child',
    desc: 'Your dashboards, daily habits, and youth trends are all built around your children.',
    tabIcon: 'people-outline',
    tabLabel: 'Family tab → Configure',
  },
  {
    icon: 'bar-chart-outline',
    color: '#6366F1',
    title: 'Start a growth plan',
    desc: 'Set a weekly growth focus for your child to unlock a personalised Habit of the Day.',
    tabIcon: 'apps-outline',
    tabLabel: 'Dashboards tab',
  },
  {
    icon: 'flag-outline',
    color: '#D4A843',
    title: 'Set family goals',
    desc: 'Give your whole family something to work toward together — faith, character, or connection.',
    tabIcon: 'people-outline',
    tabLabel: 'Family tab → Child Growth',
  },
];

const SetupModal = forwardRef(function SetupModal(
  { navigation, hasChildren, hasGrowthPlan, hasFamilyGoals, children = [] },
  ref,
) {
  const [visible, setVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  const done = [hasChildren, hasGrowthPlan, hasFamilyGoals];
  const completedCount = done.filter(Boolean).length;
  const allDone = completedCount === 3;

  function openModal() {
    setVisible(true);
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }

  function showOnce() {
    if (allDone || sessionShown) return;
    sessionShown = true;
    openModal();
  }

  useImperativeHandle(ref, () => ({ show: openModal, showOnce }));

  function dismiss() {
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setVisible(false);
    });
  }

  function handleStepCta(index) {
    dismiss();
    if (index === 0) {
      navigation.navigate('AddChildWizard');
    } else if (index === 1) {
      if (!hasChildren || !children.length) {
        navigation.navigate('AddChildWizard');
      } else {
        navigation.navigate('GrowthAreaWizard', { child: children[0], isFirstTime: true });
      }
    } else {
      navigation.navigate('Family', { tab: 'configure', scrollTo: 'familyGoals' });
    }
  }

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[s.overlay, { opacity: fadeAnim }]}>
        <View style={s.sheet}>
          <View style={s.handle} />
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={s.heading}>Set Up Your Tarbiyah Experience</Text>
            <Text style={s.sub}>Complete these steps to bring the app to life for your family.</Text>

            {/* Progress bar */}
            <View style={s.progressWrap}>
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${(completedCount / 3) * 100}%` }]} />
              </View>
              <Text style={s.progressLabel}>{completedCount} of 3 complete</Text>
            </View>

            <View style={s.stepList}>
              {STEPS.map((step, i) => {
                const isDone = done[i];
                return (
                  <TouchableOpacity
                    key={i}
                    style={[s.stepRow, isDone && s.stepRowDone]}
                    onPress={() => !isDone && handleStepCta(i)}
                    activeOpacity={isDone ? 1 : 0.75}
                  >
                    <View style={[s.checkbox, isDone && s.checkboxDone]}>
                      {isDone
                        ? <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                        : <Text style={s.checkboxNum}>{i + 1}</Text>
                      }
                    </View>

                    <View style={s.stepBody}>
                      {!isDone && (
                        <View style={s.stepTitleRow}>
                          <View style={[s.stepTag, { backgroundColor: step.color + '18' }]}>
                            <Text style={[s.stepTagText, { color: step.color }]}>Step {i + 1}</Text>
                          </View>
                        </View>
                      )}
                      <Text style={[s.stepTitle, isDone && s.stepTitleDone]}>{step.title}</Text>
                      {!isDone && <Text style={s.stepDesc}>{step.desc}</Text>}
                    </View>

                    {isDone ? (
                      <View style={s.doneTag}>
                        <Text style={s.doneTagText}>Done</Text>
                      </View>
                    ) : (
                      <View style={[s.stepBtn, { borderColor: step.color }]}>
                        <Text style={[s.stepBtnText, { color: step.color }]}>Go →</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Optional partner row */}
            <TouchableOpacity
              style={s.partnerRow}
              onPress={() => { dismiss(); navigation.navigate('FamilySync'); }}
              activeOpacity={0.75}
            >
              <View style={s.partnerOptionalBadge}>
                <Text style={s.partnerOptionalText}>Optional</Text>
              </View>
              <View style={s.partnerRowBody}>
                <Text style={s.partnerRowTitle}>Parenting with a partner?</Text>
                <Text style={s.partnerRowDesc}>Connect them to share goals and celebrate wins together.</Text>
              </View>
              <View style={s.partnerBtn}>
                <Text style={s.partnerBtnText}>Go →</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={s.laterBtn} onPress={dismiss} activeOpacity={0.7}>
              <Text style={s.laterText}>I'll set up later</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Animated.View>
    </Modal>
  );
});

export default SetupModal;

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
    maxHeight: '92%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 20,
  },
  heading: {
    fontSize: 22, fontWeight: '800', color: '#1A1A2E',
    marginBottom: 6, textAlign: 'center',
  },
  sub: {
    fontSize: 14, color: '#6B7280', textAlign: 'center',
    lineHeight: 21, marginBottom: 20,
  },

  // Progress bar
  progressWrap: { marginBottom: 24 },
  progressTrack: {
    height: 6, borderRadius: 3, backgroundColor: '#F3F4F6',
    overflow: 'hidden', marginBottom: 6,
  },
  progressFill: {
    height: '100%', borderRadius: 3, backgroundColor: '#2E7D62',
  },
  progressLabel: {
    fontSize: 11, fontWeight: '600', color: '#9CA3AF', textAlign: 'right',
  },

  // Step rows
  stepList: { gap: 16, marginBottom: 20 },
  stepRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FAFAFA', borderRadius: 16,
    padding: 14,
    borderWidth: 1, borderColor: '#F0F0F0',
  },
  stepRowDone: {
    backgroundColor: '#F6FBF8', borderColor: '#C6E8DA',
  },

  // Checkbox
  checkbox: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 2, borderColor: '#D1D5DB',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  checkboxDone: {
    backgroundColor: '#2E7D62', borderColor: '#2E7D62',
  },
  checkboxNum: { fontSize: 13, fontWeight: '700', color: '#9CA3AF' },

  stepBody:     { flex: 1 },
  stepTitleRow: { marginBottom: 3 },
  stepTag: {
    alignSelf: 'flex-start', borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  stepTagText:  { fontSize: 10, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  stepTitle:    { fontSize: 14, fontWeight: '700', color: '#1A1A2E', marginBottom: 2 },
  stepTitleDone:{ color: '#6B7280' },
  stepDesc:     { fontSize: 12, color: '#6B7280', lineHeight: 18 },

  stepBtn: {
    borderWidth: 1.5, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7, flexShrink: 0,
  },
  stepBtnText: { fontSize: 13, fontWeight: '700' },

  doneTag: {
    backgroundColor: '#EDF7F2', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5, flexShrink: 0,
  },
  doneTagText: { fontSize: 11, fontWeight: '700', color: '#2E7D62' },

  // Optional partner row
  partnerRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#F9FAFB', borderRadius: 16,
    padding: 14, marginBottom: 20,
    borderWidth: 1, borderColor: '#F0F0F0',
  },
  partnerOptionalBadge: {
    backgroundColor: '#E5E7EB', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0, marginTop: 2,
  },
  partnerOptionalText: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.5, textTransform: 'uppercase' },
  partnerRowBody:  { flex: 1 },
  partnerRowTitle: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 3 },
  partnerRowDesc:  { fontSize: 12, color: '#9CA3AF', lineHeight: 18 },
  partnerBtn: {
    borderWidth: 1.5, borderColor: '#9CA3AF', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7, flexShrink: 0,
  },
  partnerBtnText: { fontSize: 13, fontWeight: '700', color: '#6B7280' },

  laterBtn: { alignItems: 'center', paddingVertical: 4 },
  laterText: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },

});
