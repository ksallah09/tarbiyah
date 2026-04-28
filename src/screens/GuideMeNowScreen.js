import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { saveAdvice } from '../utils/savedAdvice';

const API_URL = 'https://tarbiyah-production.up.railway.app';

const SITUATIONS = [
  { id: 'lie',      label: 'My child lied to me',          icon: 'alert-circle-outline' },
  { id: 'salah',    label: 'Refuses to pray',              icon: 'moon-outline' },
  { id: 'siblings', label: 'Siblings fighting',            icon: 'people-outline' },
  { id: 'screen',   label: 'Screen time meltdown',         icon: 'phone-portrait-outline' },
  { id: 'teen',     label: 'My teen is disrespectful',     icon: 'person-outline' },
  { id: 'listen',   label: 'Child not listening',          icon: 'ear-outline' },
  { id: 'tantrum',  label: 'Angry tantrum',                icon: 'flame-outline' },
  { id: 'anxious',  label: 'My child is anxious or sad',   icon: 'heart-outline' },
  { id: 'language', label: 'Child used bad language',      icon: 'chatbubble-ellipses-outline' },
];

const AGE_RANGES = ['Under 4', '4–7', '8–11', '12–15', '16+'];
const GENDERS    = [
  { id: 'son',      label: 'Son',      icon: 'male-outline' },
  { id: 'daughter', label: 'Daughter', icon: 'female-outline' },
];

export default function GuideMeNowScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const savedItem = route?.params?.savedItem;

  const [step, setStep]                 = useState(savedItem ? 3 : 1);
  const [selected, setSelected]         = useState(null);
  const [customText, setCustomText]     = useState(savedItem?.situation ?? '');
  const [childAges, setChildAges]       = useState(savedItem?.childAges ?? []);
  const [childGenders, setChildGenders] = useState(savedItem?.childGenders ?? []);
  const [loading, setLoading]           = useState(false);
  const [response, setResponse]         = useState(savedItem?.response ?? null);
  const [error, setError]               = useState(null);
  const [saved, setSaved]               = useState(!!savedItem);

  const finalSituation = customText.trim() || selected?.label || '';
  const canProceed     = finalSituation.length > 0;
  const canSubmit      = childAges.length > 0 && childGenders.length > 0;

  async function handleGetGuidance() {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/guide/now`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          situation: finalSituation,
          childAge: childAges.join(', '),
          childGender: childGenders.join(' and '),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong');
      setResponse(data);
      setStep(3);
    } catch {
      setError('Could not get guidance. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (saved) return;
    const item = {
      id: `advice_${Date.now()}`,
      situation: finalSituation,
      childAges,
      childGenders,
      response,
      savedAt: new Date().toISOString(),
    };
    await saveAdvice(item);
    setSaved(true);
  }

  function handleReset() {
    setStep(1);
    setSelected(null);
    setCustomText('');
    setChildAges([]);
    setChildGenders([]);
    setResponse(null);
    setError(null);
    setSaved(false);
  }

  function toggleAge(age) {
    setChildAges(prev => prev.includes(age) ? prev.filter(a => a !== age) : [...prev, age]);
  }

  function toggleGender(id) {
    setChildGenders(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);
  }

  function handleBack() {
    if (step === 2) setStep(1);
    else if (step === 3) handleReset();
    else navigation.goBack();
  }

  // ── Shared hero ──────────────────────────────────────────────────────────────
  function Hero({ title, sub, extra, showClose }) {
    return (
      <View style={[styles.hero, { paddingTop: insets.top + 20 }]}>
        <View style={styles.heroTopRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={handleBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          {showClose && (
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.heroLabel}>GUIDE ME · RIGHT NOW</Text>
        <Text style={styles.heroTitle}>{title}</Text>
        {sub ? <Text style={styles.heroSub}>{sub}</Text> : null}
        {extra ?? null}
      </View>
    );
  }

  // ── Step 1: Situation picker ─────────────────────────────────────────────────
  if (step === 1) {
    return (
      <SafeAreaView style={styles.safe} edges={[]}>
        <View style={styles.bgTop} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardDismissMode="interactive" showsVerticalScrollIndicator={false}>
            <Hero title="What's happening?" sub="Select a situation or describe it in your own words." />
            <View style={styles.sheet}>
              <View style={[styles.sheetPad, { paddingBottom: insets.bottom + 100 }]}>
                <View style={styles.pickerGrid}>
                  {SITUATIONS.map(sit => (
                    <TouchableOpacity
                      key={sit.id}
                      style={[styles.sitCard, selected?.id === sit.id && styles.sitCardActive]}
                      activeOpacity={0.8}
                      onPress={() => { setSelected(selected?.id === sit.id ? null : sit); setCustomText(''); }}
                    >
                      <Ionicons name={sit.icon} size={18} color={selected?.id === sit.id ? '#1B3D2F' : '#6B7280'} />
                      <Text style={[styles.sitLabel, selected?.id === sit.id && styles.sitLabelActive]}>{sit.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>OR DESCRIBE IT</Text>
                  <View style={styles.dividerLine} />
                </View>

                <TextInput
                  style={[styles.customInput, customText.length > 0 && styles.customInputActive]}
                  placeholder="Describe what's happening right now..."
                  placeholderTextColor="#9CA3AF"
                  value={customText}
                  onChangeText={t => { setCustomText(t); if (t) setSelected(null); }}
                  multiline
                  maxLength={200}
                />
              </View>
            </View>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
            <TouchableOpacity
              style={[styles.guidanceBtn, !canProceed && styles.guidanceBtnDisabled]}
              disabled={!canProceed}
              activeOpacity={0.88}
              onPress={() => setStep(2)}
            >
              <Text style={styles.guidanceBtnText}>Continue</Text>
              <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Loading screen ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={[]}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1B3D2F' }]} />
        <View style={styles.loadingContainer}>
          <View style={styles.loadingIconWrap}>
            <ActivityIndicator size="large" color="#D4A843" />
          </View>
          <Text style={styles.loadingTitle}>Preparing your guidance</Text>
          <Text style={styles.loadingSub}>
            Drawing from Islamic scholarship and{'\n'}child development research…
          </Text>
          <Text style={styles.loadingTime}>Usually ready in 30–45 seconds</Text>
          <View style={styles.loadingPills}>
            {['Islamic Grounding', 'Research Insight', 'What To Say', 'Going Forward'].map((label, i) => (
              <View key={i} style={styles.loadingPill}>
                <Text style={styles.loadingPillText}>{label}</Text>
              </View>
            ))}
          </View>
          <View style={styles.keepOpenBanner}>
            <Ionicons name="warning" size={15} color="#F59E0B" />
            <Text style={styles.keepOpenText}>Please keep the app open until your guidance is ready</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Step 2: Child details ────────────────────────────────────────────────────
  if (step === 2) {
    return (
      <SafeAreaView style={styles.safe} edges={[]}>
        <View style={styles.bgTop} />
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
          <Hero
            title="About your child"
            sub="This helps us give more tailored guidance."
            extra={
              <View style={styles.situationRecap}>
                <Ionicons name="alert-circle" size={13} color="rgba(255,255,255,0.45)" />
                <Text style={styles.situationRecapText}>{finalSituation}</Text>
              </View>
            }
          />
          <View style={styles.sheet}>
            <View style={[styles.sheetPad, { paddingBottom: insets.bottom + 100 }]}>

              <Text style={styles.detailSectionLabel}>SPECIFY THE AGE?</Text>
              <View style={styles.ageRow}>
                {AGE_RANGES.map(age => (
                  <TouchableOpacity
                    key={age}
                    style={[styles.agePill, childAges.includes(age) && styles.agePillActive]}
                    onPress={() => toggleAge(age)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.agePillText, childAges.includes(age) && styles.agePillTextActive]}>{age}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.detailSectionLabel, { marginTop: 28 }]}>SON OR DAUGHTER?</Text>
              <Text style={styles.detailSectionHint}>Select both if it involves multiple children</Text>
              <View style={styles.genderRow}>
                {GENDERS.map(g => (
                  <TouchableOpacity
                    key={g.id}
                    style={[styles.genderCard, childGenders.includes(g.id) && styles.genderCardActive]}
                    onPress={() => toggleGender(g.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.genderLabel, childGenders.includes(g.id) && styles.genderLabelActive]}>{g.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </View>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity
            style={[styles.guidanceBtn, (!canSubmit || loading) && styles.guidanceBtnDisabled]}
            disabled={!canSubmit || loading}
            activeOpacity={0.88}
            onPress={handleGetGuidance}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="sparkles" size={18} color={canSubmit ? '#D4871A' : 'rgba(255,255,255,0.3)'} />
                <Text style={styles.guidanceBtnText}>Get Guidance</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Step 3: Response ─────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <View style={styles.bgTop} />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <Hero
          title="Your Guidance"
          showClose
          extra={
            <View style={styles.situationRecap}>
              <Ionicons name="alert-circle" size={13} color="rgba(255,255,255,0.45)" />
              <Text style={styles.situationRecapText}>
                {finalSituation} · {childGenders.map(g => g === 'son' ? 'Son' : 'Daughter').join(' & ')}{childAges.length > 0 ? `, ${childAges.join(' & ')}` : ''}
              </Text>
            </View>
          }
        />

        <View style={[styles.sheet, { padding: 20, paddingBottom: insets.bottom + 32 }]}>

          {/* 1. Immediate Reframe */}
          {response.immediateReframe ? (
            <View style={styles.reframeCard}>
              <Text style={styles.reframeText}>{response.immediateReframe}</Text>
            </View>
          ) : null}

          {/* 2. Islamic Guidance */}
          {response.islamicGuidance ? (
            <View style={[styles.card, styles.islamicCard]}>
              <View style={styles.cardLabelRow}>
                <View style={[styles.cardDot, { backgroundColor: '#D4A843' }]} />
                <Text style={[styles.cardLabel, { color: '#92610A' }]}>ISLAMIC GROUNDING</Text>
              </View>
              <Text style={styles.cardBody}>{response.islamicGuidance.text}</Text>
            </View>
          ) : null}

          {/* 3. Research Insight */}
          {response.researchInsight ? (
            <View style={styles.card}>
              <View style={styles.cardLabelRow}>
                <View style={[styles.cardDot, { backgroundColor: '#3B82F6' }]} />
                <Text style={[styles.cardLabel, { color: '#1D4ED8' }]}>RESEARCH INSIGHT</Text>
              </View>
              <Text style={styles.cardBody}>{response.researchInsight.text}</Text>
            </View>
          ) : null}

          {/* 4. What To Do */}
          {(response.whatToDo ?? []).length > 0 ? (
            <View style={styles.card}>
              <View style={styles.cardLabelRow}>
                <View style={[styles.cardDot, { backgroundColor: '#8B5CF6' }]} />
                <Text style={[styles.cardLabel, { color: '#6D28D9' }]}>WHAT TO DO</Text>
              </View>
              {(response.whatToDo ?? []).map((step, i) => (
                <View key={i} style={styles.doStep}>
                  <View style={styles.doStepNum}>
                    <Text style={styles.doStepNumText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.doStepText}>{step}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* 5. What To Say */}
          <View style={[styles.card, styles.sayCard]}>
            <View style={styles.cardLabelRow}>
              <View style={[styles.cardDot, { backgroundColor: '#2E7D62' }]} />
              <Text style={[styles.cardLabel, { color: '#1B5E3F' }]}>WHAT TO SAY</Text>
            </View>
            {(response.whatToSay ?? []).map((line, i) => (
              <View key={i} style={styles.sayLine}>
                <Text style={styles.sayText}>{line}</Text>
              </View>
            ))}
          </View>

          {/* 6. Going Forward */}
          {(response.longTermFix ?? []).length > 0 ? (
            <View style={styles.card}>
              <View style={styles.cardLabelRow}>
                <View style={[styles.cardDot, { backgroundColor: '#10B981' }]} />
                <Text style={[styles.cardLabel, { color: '#065F46' }]}>GOING FORWARD</Text>
              </View>
              {(response.longTermFix ?? []).map((habit, i) => (
                <View key={i} style={styles.habitRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <Text style={styles.habitText}>{habit}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* 7. When to Seek Help */}
          {response.whenToSeekHelp ? (
            <View style={styles.seekHelpCard}>
              <View style={styles.cardLabelRow}>
                <Ionicons name="information-circle-outline" size={14} color="#1A2744" />
                <Text style={[styles.cardLabel, { color: '#1A2744' }]}>WHEN TO SEEK HELP</Text>
              </View>
              <Text style={styles.seekHelpText}>{response.whenToSeekHelp}</Text>
            </View>
          ) : null}

          {/* 8. Parent Reminder */}
          {response.parentReminder ? (
            <View style={styles.reminderCard}>
              <Ionicons name="heart" size={16} color="#D4A843" />
              <Text style={styles.reminderText}>{response.parentReminder}</Text>
            </View>
          ) : null}

          {/* Module nudge */}
          {response.moduleNudge ? (
            <TouchableOpacity
              style={styles.nudgeCard}
              activeOpacity={0.85}
              onPress={() => {
                navigation.goBack();
                setTimeout(() => navigation.navigate('ModuleDetail', { topic: finalSituation, isNew: true }), 300);
              }}
            >
              <View style={styles.nudgeIcon}>
                <Ionicons name="layers-outline" size={20} color="#2E7D62" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.nudgeTitle}>Want to go deeper?</Text>
                <Text style={styles.nudgeBody}>{response.moduleNudge}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          ) : null}

          {/* Save button */}
          <TouchableOpacity
            style={[styles.saveBtn, saved && styles.saveBtnSaved]}
            activeOpacity={saved ? 1 : 0.88}
            onPress={handleSave}
          >
            <Ionicons name={saved ? 'checkmark-circle' : 'bookmark-outline'} size={20} color={saved ? '#2E7D62' : '#FFFFFF'} />
            <Text style={[styles.saveBtnText, saved && styles.saveBtnTextSaved]}>
              {saved ? 'Saved to Saved Advice' : 'Save This Guidance'}
            </Text>
          </TouchableOpacity>


        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: '#F5F6F8' },
  bgTop: { position: 'absolute', top: 0, left: 0, right: 0, height: '50%', backgroundColor: '#1B3D2F' },

  // ── Hero ──
  hero: {
    backgroundColor: '#1B3D2F',
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  heroTopRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.4)', marginBottom: 8,
  },
  heroTitle: {
    fontSize: 30, fontWeight: '800', color: '#FFFFFF',
    letterSpacing: -0.5, lineHeight: 36, marginBottom: 8,
  },
  heroSub: {
    fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 21,
  },
  situationRecap: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12,
    padding: 12, marginTop: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  situationRecapText: {
    flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 19, fontStyle: 'italic',
  },

  // ── Sheet ──
  sheet: { flexGrow: 1, backgroundColor: '#F5F6F8' },
  sheetPad: { paddingHorizontal: 20, paddingTop: 24 },

  // ── Situation cards ──
  pickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  sitCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFFFF', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  sitCardActive: { backgroundColor: '#ECFDF5', borderColor: '#2E7D62' },
  sitLabel: { fontSize: 13, color: '#374151', fontWeight: '500' },
  sitLabelActive: { color: '#1B3D2F', fontWeight: '700' },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  dividerText: { fontSize: 10, fontWeight: '700', letterSpacing: 1.4, color: '#9CA3AF' },
  customInput: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    fontSize: 14, color: '#1C1C1E', lineHeight: 22,
    minHeight: 90, textAlignVertical: 'top',
    borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  customInputActive: { borderColor: '#2E7D62' },

  // ── Child details ──
  detailSectionLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1.4, color: '#9CA3AF', marginBottom: 6,
  },
  detailSectionHint: {
    fontSize: 12, color: '#9CA3AF', marginBottom: 14,
  },
  ageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  agePill: {
    paddingHorizontal: 18, paddingVertical: 12,
    backgroundColor: '#FFFFFF', borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  agePillActive: { backgroundColor: '#ECFDF5', borderColor: '#2E7D62' },
  agePillText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  agePillTextActive: { color: '#1B3D2F' },
  genderRow: { flexDirection: 'row', gap: 12 },
  genderCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 18,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  genderCardActive: { backgroundColor: '#ECFDF5', borderColor: '#2E7D62' },
  genderLabel: { fontSize: 15, fontWeight: '700', color: '#374151' },
  genderLabelActive: { color: '#1B3D2F' },

  // ── Response cards ──
  reframeCard: {
    backgroundColor: '#1B3D2F', borderRadius: 16, padding: 18, marginBottom: 12,
  },
  reframeText: {
    fontSize: 15, color: 'rgba(255,255,255,0.9)', lineHeight: 24, fontStyle: 'italic',
  },
  islamicCard: { borderLeftWidth: 3, borderLeftColor: '#D4A843' },
  doStep: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  doStepNum: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  doStepNumText: { fontSize: 12, fontWeight: '700', color: '#6D28D9' },
  doStepText: { flex: 1, fontSize: 14, color: '#374151', lineHeight: 22 },
  habitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  habitText: { flex: 1, fontSize: 14, color: '#374151', lineHeight: 22 },
  seekHelpCard: {
    backgroundColor: '#EEF2FF', borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#C7D2FE',
  },
  seekHelpText: { fontSize: 14, color: '#1A2744', lineHeight: 22 },
  reminderCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFFBEB', borderRadius: 14, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#FDE68A',
  },
  reminderText: { flex: 1, fontSize: 14, color: '#92400E', lineHeight: 22, fontWeight: '500' },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  sayCard:   { borderLeftWidth: 3, borderLeftColor: '#2E7D62' },
  avoidCard: { borderLeftWidth: 3, borderLeftColor: '#F87171' },
  cardLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  cardDot: { width: 6, height: 6, borderRadius: 3 },
  cardLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.4 },
  cardBody: { fontSize: 15, color: '#1C1C1E', lineHeight: 24 },
  cardSource: { fontSize: 12, color: '#9CA3AF', marginTop: 8, fontStyle: 'italic' },
  sayLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginBottom: 8 },
  sayQuoteMark: { fontSize: 22, color: '#2E7D62', lineHeight: 28, fontWeight: '700' },
  sayText: { flex: 1, fontSize: 15, color: '#1C1C1E', lineHeight: 24, paddingTop: 4 },
  avoidText: { fontSize: 14, color: '#374151', lineHeight: 22 },

  nudgeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#F0FDF4', borderRadius: 16, padding: 16,
    marginBottom: 20, borderWidth: 1, borderColor: '#BBF7D0',
  },
  nudgeIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center',
  },
  nudgeTitle: { fontSize: 13, fontWeight: '700', color: '#1B3D2F', marginBottom: 2 },
  nudgeBody:  { fontSize: 12, color: '#4B5563', lineHeight: 18 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#1B3D2F', borderRadius: 16, paddingVertical: 16,
    marginBottom: 12,
  },
  saveBtnSaved: {
    backgroundColor: '#F0FDF4', borderWidth: 1.5, borderColor: '#BBF7D0',
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  saveBtnTextSaved: { color: '#2E7D62' },
  resetBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'center', paddingVertical: 10,
  },
  resetBtnText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },

  errorText: { fontSize: 13, color: '#DC2626', marginTop: 12, textAlign: 'center' },

  // ── Loading ──
  loadingContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32,
  },
  loadingIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 28,
  },
  loadingTitle: {
    fontSize: 22, fontWeight: '800', color: '#FFFFFF',
    letterSpacing: -0.3, marginBottom: 12, textAlign: 'center',
  },
  loadingSub: {
    fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 22,
    textAlign: 'center', marginBottom: 32,
  },
  loadingPills: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center',
  },
  loadingPill: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  loadingPillText: {
    fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.5)',
  },
  loadingTime: {
    fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 24, textAlign: 'center',
  },
  keepOpenBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(245,158,11,0.12)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, marginTop: 24, borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)', alignSelf: 'stretch' },
  keepOpenText: { fontSize: 12, color: '#F59E0B', fontWeight: '600', flex: 1 },

  // ── Footer ──
  footer: {
    paddingHorizontal: 20, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  guidanceBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#1B3D2F', borderRadius: 16, paddingVertical: 16,
  },
  guidanceBtnDisabled: { backgroundColor: '#D1D5DB' },
  guidanceBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.2 },
});
