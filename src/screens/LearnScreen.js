import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { loadModules, loadModulesCached, deleteModule } from '../utils/modules';

// Module-level cache so state initialises instantly on re-mount
let _modulesCache = null;

const SUGGESTED_PROMPTS = [
  'My child has a lot of anger and tantrums',
  'I want to build a stronger connection with my teen',
  'Should I raise my voice and shout to discipline?',
  'My child is struggling with screen time',
  'How do I raise a child with strong Islamic identity?',
  'My child is anxious and lacks confidence',
  'Navigating puberty with my child',
  'My child refuses to pray — how do I handle this gently?',
  'Building a healthy bedtime routine for my family',
  'My children fight with each other constantly',
];

export default function LearnScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const [input, setInput]           = useState('');
  const [modules, setModules]       = useState(_modulesCache ?? []);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    const topic = route?.params?.initialTopic;
    if (topic) {
      navigation.navigate('ModuleDetail', { topic, isNew: true });
      navigation.setParams({ initialTopic: undefined });
    }
  }, [route?.params?.initialTopic]);

  useEffect(() => {
    const prefill = route?.params?.prefillTopic;
    if (prefill) {
      setInput(prefill);
      openWizard();
      navigation.setParams({ prefillTopic: undefined });
    }
  }, [route?.params?.prefillTopic]);

  // Initial load on mount — two-phase: AsyncStorage instant, then network refresh
  useEffect(() => {
    // Phase 1: show locally-cached data immediately (no network)
    if (!_modulesCache) {
      loadModulesCached().then(cached => {
        if (cached.length > 0) { _modulesCache = cached; setModules(cached); }
      });
    }
    // Phase 2: background refresh from Railway/Supabase
    loadModules().then(ms => { _modulesCache = ms; setModules(ms); });
  }, []);

  // Re-sync on subsequent focuses (picks up newly saved modules from ModuleDetail)
  // Skip the very first focus since useEffect already handles initial load
  useFocusEffect(
    useCallback(() => {
      if (!hasMountedRef.current) { hasMountedRef.current = true; return; }
      loadModules().then(ms => { _modulesCache = ms; setModules(ms); });
    }, [])
  );

  function handleDelete(mod) {
    Alert.alert(
      'Delete Module',
      `Remove "${mod.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteModule(mod.id);
            setModules(prev => prev.filter(m => m.id !== mod.id));
          },
        },
      ]
    );
  }

  function handleGenerate(voice) {
    const topic = input.trim();
    if (!topic) return;
    setShowWizard(false);
    setWizardStep(1);
    setInput('');
    navigation.navigate('ModuleDetail', { topic, voice, isNew: true });
  }

  function openWizard() {
    setWizardStep(1);
    setShowWizard(true);
  }

  function closeWizard() {
    setShowWizard(false);
    setWizardStep(1);
    setInput('');
  }

  const hasModules = modules.length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
        <View style={styles.bgTop} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardDismissMode="interactive"
        >
          {/* ── Dark hero header ── */}
          <View style={[styles.hero, { paddingTop: insets.top + 20 }]}>
            <Text style={styles.heroLabel}>PERSONALIZED LEARNING</Text>
            <Text style={styles.heroTitle}>Your Learning{'\n'}Modules</Text>
            <Text style={styles.heroSub}>
              Describe a parenting challenge, goal, or struggle — we'll build a guided lesson plan just for you.
            </Text>
          </View>

          {/* ── Content sheet ── */}
          <View style={styles.sheet}>
            <View style={styles.contentPad}>

              {/* ── Generate CTA ── */}
              <TouchableOpacity
                style={styles.generateBtn}
                activeOpacity={0.88}
                onPress={openWizard}
              >
                <LinearGradient
                  colors={['#2E5E45', '#1B3D2F']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.generateBtnInner}
                >
                  <View style={styles.generateBtnIcon}>
                    <Ionicons name="sparkles" size={18} color="#D4871A" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.generateBtnTitle}>Generate Personalized Lesson</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
                </LinearGradient>
              </TouchableOpacity>


              {/* ── Saved modules ── */}
              {hasModules && (
                <>
                  <View style={[styles.sectionTitleWrap, { marginTop: 8 }]}>
                    <Text style={styles.sectionTitle}>YOUR MODULES</Text>
                    <Text style={styles.sectionCount}>{modules.length}</Text>
                  </View>
                  {modules.map((mod, i) => (
                    <TouchableOpacity
                      key={mod.id}
                      style={styles.moduleCard}
                      activeOpacity={0.85}
                      onPress={() => navigation.navigate('ModuleDetail', { module: mod, isNew: false })}
                    >
                      <View style={styles.moduleCardTop}>
                        <View style={[styles.moduleProgress, { width: `${(mod.completedLessons / mod.totalLessons) * 100}%` }]} />
                      </View>
                      <View style={styles.moduleCardBody}>
                        <View style={styles.moduleCardLeft}>
                          <Text style={styles.moduleCardTitle} numberOfLines={2}>{mod.title}</Text>
                          <Text style={styles.moduleCardTopic} numberOfLines={1}>{mod.topic}</Text>
                        </View>
                        <View style={styles.moduleCardRight}>
                          <View style={styles.moduleLessonsWrap}>
                            <Text style={styles.moduleLessonsNum}>{mod.completedLessons}</Text>
                            <Text style={styles.moduleLessonsOf}>/{mod.totalLessons}</Text>
                          </View>
                          <Text style={styles.moduleLessonsLabel}>lessons</Text>
                        </View>
                      </View>
                      <View style={styles.moduleCardFooter}>
                        <View style={styles.moduleStatusDot} />
                        <Text style={styles.moduleStatusText}>
                          {mod.completedLessons === mod.totalLessons ? 'Completed' : 'In progress'}
                        </Text>
                        <Text style={styles.moduleDate}>{mod.createdAt}</Text>
                        <TouchableOpacity
                          style={styles.moduleDeleteBtn}
                          onPress={() => handleDelete(mod)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="trash-outline" size={14} color="#9CA3AF" />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {/* ── Empty saved state ── */}
              {!hasModules && (
                <View style={styles.emptyModules}>
                  <View style={styles.emptyIcon}>
                    <Ionicons name="layers-outline" size={28} color="#2E7D62" />
                  </View>
                  <Text style={styles.emptyTitle}>No modules yet</Text>
                  <Text style={styles.emptyBody}>
                    Generate your first personalized lesson plan above — it'll be saved here for you to revisit anytime.
                  </Text>
                </View>
              )}

              <View style={{ height: 32 }} />
            </View>
          </View>
        </ScrollView>

      {/* ── Generate Wizard Modal ── */}
      <Modal visible={showWizard} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView style={styles.wizardSafe} edges={['top']}>

            {/* Header */}
            <View style={styles.wizardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.wizardHeaderLabel}>
                  {wizardStep === 1 ? 'PERSONALIZED LEARNING' : 'STEP 2 OF 2'}
                </Text>
                <Text style={styles.wizardHeaderTitle}>
                  {wizardStep === 1 ? "What's on your mind?" : 'Choose Your Narrator'}
                </Text>
              </View>
              <TouchableOpacity style={styles.wizardCloseBtn} onPress={closeWizard}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={20} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>

            {/* Step indicator */}
            <View style={styles.wizardStepRow}>
              <View style={[styles.wizardStepDot, styles.wizardStepDotActive]} />
              <View style={[styles.wizardStepLine, wizardStep === 2 && styles.wizardStepLineActive]} />
              <View style={[styles.wizardStepDot, wizardStep === 2 && styles.wizardStepDotActive]} />
            </View>

            {wizardStep === 1 ? (
              <>
                <ScrollView contentContainerStyle={styles.wizardScroll} keyboardDismissMode="interactive" showsVerticalScrollIndicator={false}>
                  <TextInput
                    style={styles.wizardInput}
                    placeholder="e.g. My child struggles with anger and I don't know how to respond..."
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    value={input}
                    onChangeText={setInput}
                    multiline
                    maxLength={300}
                  />
                  <Text style={styles.wizardTopicsLabel}>COMMON TOPICS</Text>
                  <View style={styles.wizardTopicsGrid}>
                    {SUGGESTED_PROMPTS.map((prompt, i) => (
                      <TouchableOpacity
                        key={i}
                        style={[styles.wizardTopicChip, input === prompt && styles.wizardTopicChipActive]}
                        onPress={() => setInput(prompt)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.wizardTopicText, input === prompt && styles.wizardTopicTextActive]} numberOfLines={2}>
                          {prompt}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
                <View style={[styles.wizardFooter, { paddingBottom: insets.bottom + 16 }]}>
                  <TouchableOpacity
                    style={[styles.wizardGenerateBtn, !input.trim() && styles.wizardGenerateBtnDisabled]}
                    onPress={() => setWizardStep(2)}
                    disabled={!input.trim()}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.wizardGenerateBtnText}>Continue</Text>
                    <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <ScrollView contentContainerStyle={styles.wizardScroll} showsVerticalScrollIndicator={false}>
                  {/* Topic recap */}
                  <View style={styles.wizardTopicRecap}>
                    <Ionicons name="chatbubble-outline" size={13} color="rgba(255,255,255,0.4)" />
                    <Text style={styles.wizardTopicRecapText} numberOfLines={2}>{input}</Text>
                  </View>

                  <Text style={styles.wizardNarratorSub}>
                    Your narrator will read each lesson aloud so you can listen hands-free. Choose the voice that feels most comfortable.
                  </Text>

                  <TouchableOpacity
                    style={styles.wizardVoiceOption}
                    activeOpacity={0.8}
                    onPress={() => handleGenerate('shimmer')}
                  >
                    <View style={[styles.wizardVoiceIcon, { backgroundColor: 'rgba(46,125,98,0.3)' }]}>
                      <Ionicons name="mic" size={24} color="#4ADE80" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.wizardVoiceName}>Female Voice</Text>
                      <Text style={styles.wizardVoiceDesc}>Warm and calming</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.wizardVoiceOption}
                    activeOpacity={0.8}
                    onPress={() => handleGenerate('onyx')}
                  >
                    <View style={[styles.wizardVoiceIcon, { backgroundColor: 'rgba(79,70,229,0.3)' }]}>
                      <Ionicons name="mic" size={24} color="#818CF8" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.wizardVoiceName}>Male Voice</Text>
                      <Text style={styles.wizardVoiceDesc}>Deep and steady</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
                  </TouchableOpacity>
                </ScrollView>

                <View style={[styles.wizardFooter, { paddingBottom: insets.bottom + 16 }]}>
                  <TouchableOpacity onPress={() => setWizardStep(1)} style={styles.wizardBackBtn}>
                    <Ionicons name="chevron-back" size={15} color="rgba(255,255,255,0.5)" />
                    <Text style={styles.wizardBackBtnText}>Back</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6F8' },
  bgTop: { position: 'absolute', top: 0, left: 0, right: 0, height: '50%', backgroundColor: '#1B3D2F' },

  // ── Hero ──
  hero: {
    backgroundColor: '#1B3D2F',
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  heroLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    lineHeight: 36,
    marginBottom: 10,
  },
  heroSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 21,
  },

  // ── Sheet ──
  sheet: {
    flexGrow: 1,
    backgroundColor: '#F5F6F8',
    overflow: 'hidden',
  },
  contentPad: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 36 },

  // ── Generate button ──
  generateBtn: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#1B3D2F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 6,
  },
  generateBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 14,
  },
  generateBtnIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateBtnTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  generateBtnSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },

  // ── Input card ──
  inputCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 4,
  },
  inputCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1B3D2F',
    marginBottom: 4,
  },
  inputCardSub: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 19,
    marginBottom: 16,
  },
  textInput: {
    backgroundColor: '#F5F6F8',
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    color: '#1C1C1E',
    lineHeight: 22,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  inputActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  cancelBtnText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#1B3D2F',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  submitBtnDisabled: { backgroundColor: '#D1D5DB' },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // ── Section titles ──
  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1B3D2F',
    letterSpacing: 0.3,
  },
  sectionCount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    backgroundColor: '#1B3D2F',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    overflow: 'hidden',
  },

  // ── Suggested prompts ──
  promptsWrap: { gap: 8, marginBottom: 24 },
  promptChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  promptText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    lineHeight: 19,
  },

  // ── Module cards ──
  moduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  moduleCardTop: {
    height: 4,
    backgroundColor: '#E8F5EF',
  },
  moduleProgress: {
    height: 4,
    backgroundColor: '#2E7D62',
    borderRadius: 2,
  },
  moduleCardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  moduleCardLeft: { flex: 1 },
  moduleCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
    lineHeight: 21,
    marginBottom: 4,
  },
  moduleCardTopic: {
    fontSize: 12,
    color: '#6B7280',
  },
  moduleCardRight: { alignItems: 'center' },
  moduleLessonsWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  moduleLessonsNum: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1B3D2F',
  },
  moduleLessonsOf: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  moduleLessonsLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  moduleCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  moduleStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2E7D62',
  },
  moduleStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2E7D62',
    flex: 1,
  },
  moduleDate: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  moduleDeleteBtn: {
    padding: 4,
    marginLeft: 4,
  },

  // ── Wizard modal ──
  wizardSafe: { flex: 1, backgroundColor: '#1B3D2F' },
  wizardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
  },
  wizardHeaderLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 6,
  },
  wizardHeaderTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  wizardCloseBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 4,
  },
  wizardScroll: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  wizardInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    color: '#FFFFFF',
    lineHeight: 24,
    minHeight: 110,
    textAlignVertical: 'top',
    marginBottom: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  wizardTopicsLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 14,
  },
  wizardTopicsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  wizardTopicChip: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    maxWidth: '100%',
  },
  wizardTopicChipActive: {
    backgroundColor: 'rgba(212,135,26,0.2)',
    borderColor: 'rgba(212,135,26,0.6)',
  },
  wizardTopicText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 19,
  },
  wizardTopicTextActive: {
    color: '#F5C842',
    fontWeight: '600',
  },
  wizardFooter: {
    paddingHorizontal: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#1B3D2F',
  },
  wizardGenerateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#D4871A',
    borderRadius: 16,
    paddingVertical: 16,
  },
  wizardGenerateBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.15)' },
  wizardGenerateBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  wizardStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 24,
    gap: 0,
  },
  wizardStepDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  wizardStepDotActive: { backgroundColor: '#D4871A' },
  wizardStepLine: {
    flex: 1, height: 2, marginHorizontal: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  wizardStepLineActive: { backgroundColor: '#D4871A' },
  wizardTopicRecap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  wizardTopicRecapText: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 19,
    fontStyle: 'italic',
  },
  wizardNarratorSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 22,
    marginBottom: 28,
  },
  wizardVoiceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  wizardVoiceIcon: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  wizardVoiceName: {
    fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginBottom: 3,
  },
  wizardVoiceDesc: {
    fontSize: 13, color: 'rgba(255,255,255,0.45)',
  },
  wizardBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'center',
    padding: 8,
  },
  wizardBackBtnText: {
    fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.5)',
  },

  // ── Empty state ──
  emptyModules: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E8F5EF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});
