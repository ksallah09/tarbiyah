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
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { loadModules, loadModulesCached, deleteModule } from '../utils/modules';
import LearnTourOverlay from '../components/LearnTourOverlay';

let _modulesCache = null;

const SUGGESTED_PROMPTS = [
  'My child has a lot of anger and tantrums',
  'I want to build a stronger connection with my teen',
  'My child is struggling with screen time',
  'I lose patience with my kids too quickly',
  'How do I raise a child with strong Islamic identity?',
  'My child is anxious and lacks confidence',
  'Navigating puberty with my child',
  'My child refuses to pray — how do I handle this gently?',
  'Building a healthy bedtime routine for my family',
  'My children fight with each other constantly',
  'Should I raise my voice to discipline?',
];


export default function LearnScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const [input, setInput]           = useState('');
  const [modules, setModules]       = useState(_modulesCache ?? []);
  const [showWizard, setShowWizard] = useState(false);
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

  useEffect(() => {
    if (!_modulesCache) {
      loadModulesCached().then(cached => {
        if (cached.length > 0) { _modulesCache = cached; setModules(cached); }
      });
    }
    loadModules().then(ms => { _modulesCache = ms; setModules(ms); });
  }, []);

  useFocusEffect(useCallback(() => {
    if (!hasMountedRef.current) { hasMountedRef.current = true; return; }
    loadModules().then(ms => { _modulesCache = ms; setModules(ms); });
  }, []));

  function handleDelete(mod) {
    Alert.alert('Delete Module', `Remove "${mod.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteModule(mod.id);
        setModules(prev => prev.filter(m => m.id !== mod.id));
      }},
    ]);
  }

  function handleGenerate(voice) {
    const topic = input.trim();
    if (!topic) return;
    setShowWizard(false);

    setInput('');
    navigation.navigate('ModuleDetail', { topic, voice, isNew: true });
  }

  function openWizard() { setShowWizard(true); }
  function closeWizard() { setShowWizard(false); setInput(''); }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />

      {/* ── White header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Learn</Text>
        <Text style={styles.headerSub}>
          Understand the science and wisdom behind parenting challenges — on the topics you choose.
        </Text>
      </View>
      <View style={styles.separator} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>

        {/* ── Content ── */}
        <View style={styles.sheet}>
          <View style={styles.content}>

            {/* Section header */}
            <View style={styles.sectionRow}>
              <View style={styles.sectionLeft}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionEyebrow}>LEARN ON DEMAND</Text>
                  <Text style={styles.sectionTitle}>Your Modules</Text>
                </View>
                {modules.length > 0 && (
                  <View style={styles.sectionBadge}>
                    <Text style={styles.sectionBadgeText}>{modules.length}</Text>
                  </View>
                )}
              </View>
              {modules.length > 0 && (
                <TouchableOpacity style={styles.newTopicBtn} onPress={openWizard} activeOpacity={0.85}>
                  <Ionicons name="add" size={14} color="#FFFFFF" />
                  <Text style={styles.newTopicBtnText}>New Topic</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Module list */}
            {modules.length > 0 ? modules.map(mod => {
              const pct  = mod.totalLessons > 0 ? mod.completedLessons / mod.totalLessons : 0;
              const done = mod.completedLessons === mod.totalLessons && mod.totalLessons > 0;
              return (
                <TouchableOpacity
                  key={mod.id}
                  style={styles.moduleCard}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('ModuleDetail', { module: mod, isNew: false })}
                >
                  {/* Accent bar + progress */}
                  <View style={styles.moduleBarBg}>
                    <View style={[styles.moduleBarFill, { width: `${pct * 100}%`, backgroundColor: done ? '#9CA3AF' : '#2E7D62' }]} />
                  </View>

                  <View style={styles.moduleCardBody}>
                    <View style={styles.moduleCardLeft}>
                      <View style={[styles.statusPill, done && styles.statusPillDone]}>
                        <View style={[styles.statusDot, done && styles.statusDotDone]} />
                        <Text style={[styles.statusText, done && styles.statusTextDone]}>
                          {done ? 'Completed' : 'In progress'}
                        </Text>
                      </View>
                      <Text style={styles.moduleTitle} numberOfLines={2}>{mod.title}</Text>
                      <Text style={styles.moduleTopic} numberOfLines={1}>{mod.topic}</Text>
                    </View>

                    <View style={styles.moduleCardRight}>
                      <View style={styles.lessonCountWrap}>
                        <Text style={[styles.lessonNum, done && { color: '#9CA3AF' }]}>{mod.completedLessons}</Text>
                        <Text style={styles.lessonDen}>/{mod.totalLessons}</Text>
                      </View>
                      <Text style={styles.lessonLabel}>lessons</Text>
                      <TouchableOpacity
                        onPress={() => handleDelete(mod)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        style={styles.deleteBtn}
                      >
                        <Ionicons name="trash-outline" size={13} color="#D1D5DB" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }) : (
              /* ── Empty state ── */
              <>
                <TouchableOpacity style={styles.startCard} onPress={openWizard} activeOpacity={0.88}>
                  <View style={styles.startCardIcon}>
                    <Ionicons name="layers" size={24} color="#2E7D62" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.startCardTitle}>Start your first module</Text>
                    <Text style={styles.startCardSub}>Write your own topic and get a personalised lesson plan built around it</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#2E7D62" />
                </TouchableOpacity>

                <Text style={styles.suggestedLabel}>COMMON TOPICS</Text>
                <View style={styles.suggestedGrid}>
                  {SUGGESTED_PROMPTS.map((p, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.suggestedChip}
                      activeOpacity={0.75}
                      onPress={() => { setInput(p); openWizard(); }}
                    >
                      <Ionicons name="bulb-outline" size={12} color="#6B7280" style={{ marginRight: 6, flexShrink: 0 }} />
                      <Text style={styles.suggestedChipText}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <View style={{ height: 40 }} />
          </View>
        </View>
      </ScrollView>

      {/* ── Wizard Modal ── */}
      <Modal visible={showWizard} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={styles.wizardSafe} edges={['top']}>

            <View style={styles.wizardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.wizardHeaderLabel}>PERSONALISED LEARNING</Text>
                <Text style={styles.wizardHeaderTitle}>What's on your mind?</Text>
              </View>
              <TouchableOpacity style={styles.wizardCloseBtn} onPress={closeWizard} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={20} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>

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
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={[styles.wizardFooter, { paddingBottom: insets.bottom + 16 }]}>
                  <TouchableOpacity
                    style={[styles.wizardContinueBtn, !input.trim() && styles.wizardContinueBtnDisabled]}
                    onPress={() => handleGenerate('onyx')}
                    disabled={!input.trim()}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.wizardContinueBtnText}>Generate</Text>
                    <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            </>

          </SafeAreaView>
      </Modal>

      <LearnTourOverlay />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#FFFFFF' },
  separator: { height: 1, backgroundColor: '#F3F4F6' },

  // ── Header ──
  header:     { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, backgroundColor: '#FFFFFF' },
  headerTitle:{ fontSize: 28, fontWeight: '800', color: '#111827', marginBottom: 6 },
  headerSub:  { fontSize: 14, color: '#9CA3AF', lineHeight: 21 },

  // ── Sheet ──
  sheet:   { flexGrow: 1, backgroundColor: '#FFFFFF' },
  content: { paddingHorizontal: 20, paddingTop: 20 },

  // ── Section header ──
  sectionRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 16,
  },
  sectionLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  sectionEyebrow: { fontSize: 10, fontWeight: '700', color: '#2E7D62', letterSpacing: 1, marginBottom: 2 },
  sectionTitle: {
    fontSize: 16, fontWeight: '800', color: '#1B3D2F',
  },
  sectionBadge: {
    backgroundColor: '#1B3D2F', borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  sectionBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
  newTopicBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#2E7D62', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    marginLeft: 12,
  },
  newTopicBtnText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },

  // ── Module cards ──
  moduleCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  moduleBarBg: { height: 4, backgroundColor: '#EEF0F2' },
  moduleBarFill: { height: 4, borderRadius: 2 },
  moduleCardBody: {
    flexDirection: 'row', alignItems: 'flex-start',
    padding: 16, gap: 12,
  },
  moduleCardLeft: { flex: 1 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start', marginBottom: 8,
    backgroundColor: '#E8F5EF', borderRadius: 20,
    paddingHorizontal: 9, paddingVertical: 4,
  },
  statusPillDone: { backgroundColor: '#F3F4F6' },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#2E7D62' },
  statusDotDone: { backgroundColor: '#9CA3AF' },
  statusText: { fontSize: 10, fontWeight: '700', color: '#2E7D62' },
  statusTextDone: { color: '#9CA3AF' },
  moduleTitle: {
    fontSize: 15, fontWeight: '700', color: '#1C1C1E',
    lineHeight: 21, marginBottom: 4,
  },
  moduleTopic: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  moduleCardRight: { alignItems: 'center', gap: 2, paddingTop: 4 },
  lessonCountWrap: { flexDirection: 'row', alignItems: 'baseline' },
  lessonNum: { fontSize: 24, fontWeight: '800', color: '#1B3D2F' },
  lessonDen: { fontSize: 13, fontWeight: '600', color: '#9CA3AF' },
  lessonLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '500', marginBottom: 8 },
  deleteBtn: { padding: 4 },

  // ── Empty / start state ──
  startCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18,
    marginBottom: 24,
    borderWidth: 1, borderColor: '#F3F4F6',
    borderLeftWidth: 4, borderLeftColor: '#2E7D62',
  },
  startCardIcon: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: '#E8F5EF',
    alignItems: 'center', justifyContent: 'center',
  },
  startCardTitle: { fontSize: 15, fontWeight: '700', color: '#1C1C1E', marginBottom: 3 },
  startCardSub: { fontSize: 12, color: '#6B7280', lineHeight: 18 },

  suggestedLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1.2,
    color: '#9CA3AF', marginBottom: 12,
  },
  suggestedGrid: { gap: 8 },
  suggestedChip: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#FFFFFF', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 13,
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  suggestedChipText: {
    flex: 1, fontSize: 13, color: '#374151', lineHeight: 19,
  },

  // ── Wizard modal ──
  wizardSafe: { flex: 1, backgroundColor: '#1B3D2F' },
  wizardHeader: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24,
  },
  wizardHeaderLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.4)', marginBottom: 6,
  },
  wizardHeaderTitle: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.3 },
  wizardCloseBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  wizardStepRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 24, marginBottom: 24,
  },
  wizardStepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.2)' },
  wizardStepDotActive: { backgroundColor: '#D4871A' },
  wizardStepLine: { flex: 1, height: 2, marginHorizontal: 6, backgroundColor: 'rgba(255,255,255,0.12)' },
  wizardStepLineActive: { backgroundColor: '#D4871A' },
  wizardScroll: { paddingHorizontal: 24, paddingBottom: 24 },
  wizardInput: {
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16,
    padding: 16, fontSize: 15, color: '#FFFFFF', lineHeight: 24,
    minHeight: 110, textAlignVertical: 'top', marginBottom: 28,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  wizardTopicsLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1.4,
    color: 'rgba(255,255,255,0.4)', marginBottom: 14,
  },
  wizardTopicsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  wizardTopicChip: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', maxWidth: '100%',
  },
  wizardTopicChipActive: {
    backgroundColor: 'rgba(212,135,26,0.2)', borderColor: 'rgba(212,135,26,0.6)',
  },
  wizardTopicText: { fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 19 },
  wizardTopicTextActive: { color: '#F5C842', fontWeight: '600' },
  wizardFooter: {
    paddingHorizontal: 24, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#1B3D2F',
  },
  wizardContinueBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#D4871A', borderRadius: 16, paddingVertical: 16,
  },
  wizardContinueBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.15)' },
  wizardContinueBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.2 },
  wizardTopicRecap: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    padding: 14, marginBottom: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  wizardTopicRecapText: {
    flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 19, fontStyle: 'italic',
  },
  wizardNarratorSub: {
    fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 22, marginBottom: 28,
  },
  wizardVoiceOption: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 18,
    padding: 18, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  wizardVoiceIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  wizardVoiceName: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginBottom: 3 },
  wizardVoiceDesc: { fontSize: 13, color: 'rgba(255,255,255,0.45)' },
  wizardBackBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'center', padding: 8,
  },
  wizardBackBtnText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
});
