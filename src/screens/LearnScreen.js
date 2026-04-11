import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MODULES_KEY = 'tarbiyah_modules';

const SUGGESTED_PROMPTS = [
  'My child has a lot of anger and tantrums',
  'I want to build a stronger connection with my teen',
  'My child is struggling with screen time',
  'How do I raise a child with strong Islamic identity?',
  'My child is anxious and lacks confidence',
];

export default function LearnScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [input, setInput]     = useState('');
  const [modules, setModules] = useState([]);
  const [showInput, setShowInput] = useState(false);

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(MODULES_KEY).then(raw => {
        if (raw) {
          try { setModules(JSON.parse(raw)); } catch {}
        }
      });
    }, [])
  );

  function handleGenerate(text) {
    const topic = (text ?? input).trim();
    if (!topic) return;
    navigation.navigate('ModuleDetail', { topic, isNew: true });
    setInput('');
    setShowInput(false);
  }

  const hasModules = modules.length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.bottom + 10}
      >
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
              {!showInput ? (
                <TouchableOpacity
                  style={styles.generateBtn}
                  activeOpacity={0.88}
                  onPress={() => setShowInput(true)}
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
                      <Text style={styles.generateBtnSub}>Describe your challenge or goal</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <View style={styles.inputCard}>
                  <Text style={styles.inputCardTitle}>What's on your mind?</Text>
                  <Text style={styles.inputCardSub}>
                    Describe a struggle, goal, or situation you'd like guidance on.
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. My child struggles with anger and I don't know how to respond..."
                    placeholderTextColor="#9CA3AF"
                    value={input}
                    onChangeText={setInput}
                    multiline
                    maxLength={300}
                    autoFocus
                  />
                  <View style={styles.inputActions}>
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => { setShowInput(false); setInput(''); }}
                    >
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.submitBtn, !input.trim() && styles.submitBtnDisabled]}
                      onPress={() => handleGenerate()}
                      disabled={!input.trim()}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="sparkles" size={14} color="#FFFFFF" />
                      <Text style={styles.submitBtnText}>Generate Module</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* ── Suggested prompts ── */}
              {!showInput && (
                <>
                  <View style={styles.sectionTitleWrap}>
                    <Text style={styles.sectionTitle}>SUGGESTED TOPICS</Text>
                  </View>
                  <View style={styles.promptsWrap}>
                    {SUGGESTED_PROMPTS.map((p, i) => (
                      <TouchableOpacity
                        key={i}
                        style={styles.promptChip}
                        onPress={() => handleGenerate(p)}
                        activeOpacity={0.75}
                      >
                        <Ionicons name="bulb-outline" size={14} color="#2E7D62" />
                        <Text style={styles.promptText}>{p}</Text>
                        <Ionicons name="arrow-forward" size={12} color="#2E7D62" />
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* ── Saved modules ── */}
              {hasModules && !showInput && (
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
                      </View>
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {/* ── Empty saved state ── */}
              {!hasModules && !showInput && (
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1B3D2F' },

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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
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
    fontSize: 11,
    fontWeight: '700',
    color: '#1B3D2F',
    letterSpacing: 0.8,
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
