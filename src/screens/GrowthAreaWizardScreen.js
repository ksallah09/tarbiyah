import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Animated,
  ActivityIndicator, Keyboard, Alert, AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addGrowthArea } from '../utils/childProfiles';
import { supabase } from '../utils/supabase';
import { notifyGrowthPlanReady, scheduleChildHabitNotifications } from '../utils/notifications';

const PENDING_JOB_KEY = 'tarbiyah_pending_growth_plan_job';

const API_URL = 'https://tarbiyah-production.up.railway.app';

const STEP_INTRO    = 0;
const STEP_ISSUE    = 1;
const STEP_SAFETY   = 2;
const STEP_ANALYSIS = 3;
const STEP_LOADING  = 4;
const STEP_DONE     = 5;
const STEP_BRIDGE   = 6;

// ── Safety detection ──────────────────────────────────────────────────────────

const SAFETY_PATTERNS = [
  /\bsuicid/i, /\bself.?harm/i, /\bcutting (themselves|himself|herself|themself)\b/i,
  /\bkill(ing)? (them|him|her)self\b/i, /\bwants? to die\b/i, /\bend (their|his|her) life\b/i,
  /\bhurt(ing)? (them|him|her)self\b/i, /\bnot worth living\b/i, /\bno (reason|will) to live\b/i,
  /\b(sexual|physical|emotional) abuse\b/i, /\bbeing (abused|molested|assaulted)\b/i,
  /\banorexia\b/i, /\bbulimia\b/i, /\beating disorder\b/i, /\bstarving (them|him|her)self\b/i,
  /\brefuses? to eat\b/i,
  /\bhearing voices\b/i, /\bseeing things\b/i, /\bpsychosis\b/i, /\bhallucinating\b/i,
  /\bdrug(s)? addict\b/i, /\bsubstance abuse\b/i, /\boverdos(e|ing)\b/i,
  /\bhurting (other|another) (child|kid|person|student)\b/i,
  /\bthreaten(ing)? to (kill|hurt|harm)\b/i,
];

function containsSafetyIssue(text) {
  return SAFETY_PATTERNS.some(p => p.test(text));
}

function ProgressBar({ step }) {
  const total = 2; // only 2 visible steps before loading
  const progress = Math.min(step / total, 1);
  const widthAnim = useRef(new Animated.Value(step === 0 ? 0.1 : progress)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: progress,
      duration: 350,
      useNativeDriver: false,
    }).start();
  }, [step]);

  if (step <= STEP_INTRO || step === STEP_SAFETY || step === STEP_BRIDGE || step >= STEP_LOADING) return null;

  return (
    <View style={pb.track}>
      <Animated.View
        style={[pb.fill, { width: widthAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}
      />
    </View>
  );
}

const pb = StyleSheet.create({
  track: { height: 3, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, marginHorizontal: 24, marginTop: 8, marginBottom: 0 },
  fill:  { height: 3, backgroundColor: '#4ADE80', borderRadius: 2 },
});

export default function GrowthAreaWizardScreen({ navigation, route }) {
  const { child, isFirstTime = false, fromDashboard = false } = route?.params ?? {};

  const [step, setStep]             = useState(STEP_INTRO);
  const [issue, setIssue]           = useState('');
  const [analysis, setAnalysis]     = useState('');
  const [savedArea, setSavedArea]   = useState(null);
  const [error, setError]           = useState('');
  const [areasSaved, setAreasSaved] = useState(0);
  const fadeAnim      = useRef(new Animated.Value(1)).current;
  const slideAnim     = useRef(new Animated.Value(800)).current;
  const pollRef       = useRef(null);
  const jobIdRef      = useRef(null);
  const appStateRef   = useRef(AppState.currentState);

  const stage1Opacity = useRef(new Animated.Value(0)).current;
  const stage2Opacity = useRef(new Animated.Value(0)).current;
  const stage3Opacity = useRef(new Animated.Value(0)).current;
  const keepOpenOpacity = useRef(new Animated.Value(0)).current;

  const childName = child?.name ?? 'your child';
  const displayName = childName.length > 12 ? childName.slice(0, 12).trimEnd() + '…' : childName;

  // Cleanup polling on unmount
  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      appStateRef.current = next;
    });
    // Check if there's a pending job from a previous session
    AsyncStorage.getItem(PENDING_JOB_KEY).then(stored => {
      if (!stored) return;
      try {
        const { jobId, childId } = JSON.parse(stored);
        if (jobId && childId === child?.id) {
          fadeTo(STEP_LOADING);
          startPolling(jobId);
        }
      } catch {}
    });
    return () => {
      sub.remove();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Sequential stage reveal on loading
  useEffect(() => {
    if (step !== STEP_LOADING) return;
    [stage1Opacity, stage2Opacity, stage3Opacity, keepOpenOpacity].forEach(a => a.setValue(0));
    Animated.sequence([
      Animated.timing(stage1Opacity,    { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.delay(900),
      Animated.timing(stage2Opacity,    { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.delay(900),
      Animated.timing(stage3Opacity,    { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.delay(600),
      Animated.timing(keepOpenOpacity,  { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();
  }, [step]);

  function fadeTo(next) {
    Animated.timing(fadeAnim, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => {
      setStep(next);
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    });
  }

  async function handleGenerate() {
    Keyboard.dismiss();
    fadeTo(STEP_LOADING);
    setError('');
    try {
      const profileRaw = await AsyncStorage.getItem('tarbiyah_profile');
      const profile = profileRaw ? JSON.parse(profileRaw) : {};
      const familyStructure = profile.familyStructure ?? 'prefer_not_to_say';

      const res = await fetch(`${API_URL}/child-growth-plan/async`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          child: {
            name:         child?.name,
            age:          child?.age,
            gender:       child?.gender,
            grade:        child?.grade,
            schooling:    child?.schooling,
            strengths:    child?.strengths     ?? [],
            temperaments: child?.temperaments  ?? [],
            interests:    child?.interests     ?? [],
            specialNeeds: child?.specialNeeds  ?? [],
          },
          issue,
          parentAnalysis: analysis,
          familyStructure,
        }),
      });

      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const { jobId } = await res.json();

      jobIdRef.current = jobId;
      await AsyncStorage.setItem(PENDING_JOB_KEY, JSON.stringify({ jobId, childId: child?.id }));
      startPolling(jobId);
    } catch (e) {
      setError('Something went wrong. Please try again.');
      fadeTo(STEP_ANALYSIS);
    }
  }

  function startPolling(jobId) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await supabase
          .from('growth_plan_jobs')
          .select('status, plan, error')
          .eq('id', jobId)
          .single();

        if (!data) return;

        if (data.status === 'complete') {
          clearInterval(pollRef.current);
          AsyncStorage.removeItem(PENDING_JOB_KEY);
          const json = data.plan;

          if (json?.safetyFlag) { fadeTo(STEP_SAFETY); return; }

          const growthArea = {
            id:                `ga_${Date.now()}`,
            title:             json.title             ?? 'Growth Area',
            description:       json.description       ?? '',
            islamicFoundation: json.islamicFoundation ?? '',
            issue,
            parentAnalysis:    analysis,
            plan:              json.weeks             ?? json.plan ?? [],
            dailyTips:         json.dailyTips         ?? [],
            daysActive:        0,
            createdAt:         new Date().toISOString(),
          };

          await addGrowthArea(child.id, growthArea);
          setSavedArea(growthArea);
          setAreasSaved(n => n + 1);
          notifyGrowthPlanReady(childName);
          scheduleChildHabitNotifications().catch(() => {});
          fadeTo(STEP_DONE);
        } else if (data.status === 'failed') {
          clearInterval(pollRef.current);
          AsyncStorage.removeItem(PENDING_JOB_KEY);
          setError('Generation failed. Please try again.');
          fadeTo(STEP_ANALYSIS);
        }
      } catch {}
    }, 4000);
  }

  function handleAddAnother() {
    setIssue('');
    setAnalysis('');
    setSavedArea(null);
    setError('');
    fadeTo(STEP_ISSUE);
  }

  function handleDone() {
    slideAnim.setValue(800);
    setStep(STEP_BRIDGE);
    Animated.spring(slideAnim, {
      toValue: 0, useNativeDriver: true,
      tension: 68, friction: 12,
    }).start();
  }

  function handleBridgeContinue() {
    navigation.replace('GrowthAreaPlan', { area: savedArea, child });
  }

  function handleSkip() {
    navigation.goBack();
  }

  // ── Step renders ──────────────────────────────────────────────────────────────

  function renderIntro() {
    const features = [
      { icon: 'chatbubble-ellipses-outline', text: 'You describe the issue in your own words' },
      { icon: 'bulb-outline',                text: "Share your insight into what's behind it" },
      { icon: 'sparkles-outline',            text: 'Tarbiyah builds a personalised 4-week plan with weekly habits and activities' },
    ];

    return (
      <View style={styles.introWrap}>
        <View style={styles.introIconRing}>
          <Ionicons name="leaf-outline" size={36} color="#4ADE80" />
        </View>

        {isFirstTime ? (
          <Text style={styles.introTitle}>Add a Growth Area for {displayName}?</Text>
        ) : (
          <>
            <Text style={styles.introTitle}>How Growth Areas work</Text>
            <Text style={styles.introChip}>for {displayName}</Text>
          </>
        )}

        <Text style={styles.introBody}>
          A growth area is a specific challenge, struggle, or habit you'd like to work on together.
        </Text>

        <View style={styles.introFeatures}>
          {features.map(({ icon, text }) => (
            <View key={icon} style={styles.introFeatureRow}>
              <View style={styles.introFeatureIcon}>
                <Ionicons name={icon} size={16} color="#4ADE80" />
              </View>
              <Text style={styles.introFeatureText}>{text}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.introPrimaryBtn} onPress={() => fadeTo(STEP_ISSUE)} activeOpacity={0.85}>
          <Text style={styles.introPrimaryBtnText}>{isFirstTime ? 'Yes, add a growth area' : 'Continue'}</Text>
          <Ionicons name="arrow-forward" size={16} color="#1B3D2F" />
        </TouchableOpacity>

        {isFirstTime ? (
          <TouchableOpacity style={styles.introSkipBtn} onPress={handleSkip} activeOpacity={0.7}>
            <Text style={styles.introSkipText}>Not right now</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.introCancelBtn} onPress={handleSkip} activeOpacity={0.7}>
            <Text style={styles.introCancelText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  function renderBridge() {
    return (
      <Animated.View style={[styles.bridgeWrap, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.bridgeIconRing}>
          <Ionicons name="apps" size={32} color="#4ADE80" />
        </View>
        <Text style={styles.bridgeTitle}>Your plan is ready</Text>
        <Text style={styles.bridgeBody}>
          What you're about to see is an overview of the full 4-week plan.
        </Text>
        <Text style={styles.bridgeBody}>
          {displayName}'s Child Dashboard — found in the <Text style={{ color: '#4ADE80', fontWeight: '700' }}>Dashboards</Text> tab — will guide you through it week by week, surfacing the right habits, activities, and a daily coaching tip to keep you on track.
        </Text>
        <TouchableOpacity style={styles.bridgeBtn} onPress={handleBridgeContinue} activeOpacity={0.85}>
          <Text style={styles.bridgeBtnText}>Got it!</Text>
          <Ionicons name="arrow-forward" size={16} color="#1B3D2F" />
        </TouchableOpacity>
      </Animated.View>
    );
  }

  function renderSafety() {
    return (
      <View style={styles.safetyWrap}>
        <View style={styles.safetyIconRing}>
          <Ionicons name="heart" size={32} color="#F87171" />
        </View>

        <Text style={styles.safetyTitle}>This needs professional support</Text>
        <Text style={styles.safetyBody}>
          What you've described goes beyond what a parenting app can safely address. Your child deserves — and needs — the care of a trained professional.
        </Text>
        <Text style={styles.safetySub}>
          Please reach out to one of the following as soon as possible:
        </Text>

        <View style={styles.safetyResources}>
          <Text style={styles.safetyGroupHeader}>WHEREVER YOU ARE</Text>
          {[
            {
              icon: 'call-outline',
              label: 'Local Emergency Services',
              detail: 'Call your local emergency number immediately if there is any risk of harm right now.',
            },
            {
              icon: 'medical-outline',
              label: 'Your Family Doctor or Paediatrician',
              detail: 'Your first call for a referral to a child psychologist or mental health specialist.',
            },
            {
              icon: 'globe-outline',
              label: 'Find a Helpline — findahelpline.com',
              detail: 'A global directory of crisis helplines searchable by country — find the right line wherever you are.',
            },
            {
              icon: 'people-outline',
              label: 'Befrienders Worldwide — befrienders.org',
              detail: 'Emotional support and crisis listening services available in countries around the world.',
            },
            {
              icon: 'earth-outline',
              label: 'IASP Crisis Centre Directory — iasp.info',
              detail: 'The International Association for Suicide Prevention maintains a directory of crisis centres by country.',
            },
          ].map(({ icon, label, detail }) => (
            <View key={label} style={styles.safetyResourceRow}>
              <View style={styles.safetyResourceIcon}>
                <Ionicons name={icon} size={16} color="#F87171" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.safetyResourceLabel}>{label}</Text>
                <Text style={styles.safetyResourceDetail}>{detail}</Text>
              </View>
            </View>
          ))}

          <Text style={[styles.safetyGroupHeader, { marginTop: 16 }]}>COUNTRY-SPECIFIC</Text>
          {[
            {
              icon: 'chatbubble-outline',
              label: 'Childline — UK',
              detail: '0800 1111 · Free, confidential support for children and families.',
            },
            {
              icon: 'chatbubble-ellipses-outline',
              label: 'Crisis Text Line — US & Canada',
              detail: 'Text HOME to 741741 for free, 24/7 crisis counselling.',
            },
            {
              icon: 'people-outline',
              label: 'Child Mind Institute — childmind.org',
              detail: 'Expert guidance on child mental health — useful globally for understanding symptoms and next steps.',
            },
          ].map(({ icon, label, detail }) => (
            <View key={label} style={styles.safetyResourceRow}>
              <View style={styles.safetyResourceIcon}>
                <Ionicons name={icon} size={16} color="#F87171" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.safetyResourceLabel}>{label}</Text>
                <Text style={styles.safetyResourceDetail}>{detail}</Text>
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.safetyBackBtn}
          onPress={() => fadeTo(STEP_ISSUE)}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={15} color="rgba(255,255,255,0.7)" />
          <Text style={styles.safetyBackText}>Go back and describe a different concern</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderIssue() {
    return (
      <View style={styles.stepWrap}>
        <Text style={styles.stepTitle}>What's the challenge?</Text>
        <Text style={styles.stepSub}>
          Describe an issue, struggle, or habit you'd like to work on with {displayName}.
        </Text>
        <TextInput
          style={styles.textArea}
          value={issue}
          onChangeText={setIssue}
          placeholder={`e.g. "${displayName} gets very upset when screen time ends and often has a meltdown..."`}
          placeholderTextColor="rgba(255,255,255,0.3)"
          multiline
          textAlignVertical="top"
        />
        <Text style={styles.charHint}>{issue.length} characters</Text>
      </View>
    );
  }

  function renderAnalysis() {
    return (
      <View style={styles.stepWrap}>
        <Text style={styles.stepTitle}>Your insight</Text>
        <Text style={styles.stepSub}>
          What do you think is behind this? Share your understanding — it helps us tailor the plan to {displayName}. <Text style={{ color: 'rgba(255,255,255,0.35)' }}>Optional.</Text>
        </Text>
        {!!issue && (
          <View style={styles.reflectCard}>
            <Text style={styles.reflectLabel}>THE CHALLENGE YOU DESCRIBED</Text>
            <Text style={styles.reflectText}>{issue}</Text>
          </View>
        )}
        <TextInput
          style={styles.textArea}
          value={analysis}
          onChangeText={setAnalysis}
          placeholder={`e.g. "I think it's partly about transitions being difficult and partly about not having enough outdoor time during the day..."`}
          placeholderTextColor="rgba(255,255,255,0.3)"
          multiline
          textAlignVertical="top"
        />
        <Text style={styles.charHint}>{analysis.length} characters</Text>
        {!!error && <Text style={styles.errorText}>{error}</Text>}
      </View>
    );
  }

  function renderLoading() {
    const stages = [
      { opacity: stage1Opacity, icon: 'moon-outline',       label: 'Drawing from Islamic scholarship' },
      { opacity: stage2Opacity, icon: 'flask-outline',      label: 'Consulting child development research' },
      { opacity: stage3Opacity, icon: 'person-outline',     label: `Personalising for ${displayName}` },
    ];

    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.loadingTitle}>Building {displayName}'s plan</Text>

        <View style={styles.loadingStages}>
          {stages.map(({ opacity, icon, label }, i) => (
            <Animated.View key={i} style={[styles.loadingStageRow, { opacity }]}>
              <View style={styles.loadingStageIcon}>
                <Ionicons name={icon} size={16} color="#4ADE80" />
              </View>
              <Text style={styles.loadingStageText}>{label}</Text>
              <Ionicons name="checkmark-circle" size={16} color="#4ADE80" />
            </Animated.View>
          ))}
        </View>

        <ActivityIndicator color="rgba(74,222,128,0.5)" style={{ marginTop: 32 }} />

        <Animated.Text style={[styles.loadingKeepOpen, { opacity: keepOpenOpacity }]}>
          Feel free to do something else while your plan is being built
        </Animated.Text>
        <Animated.Text style={[styles.loadingKeepOpen, { opacity: keepOpenOpacity, marginTop: 6 }]}>
          This usually takes 1–2 minutes
        </Animated.Text>
      </View>
    );
  }

  function renderDone() {
    const existingAreas = child?.growthAreas ?? [];
    const totalAreas    = existingAreas.length + areasSaved;
    const canAddMore    = totalAreas < 2;

    return (
      <View style={styles.doneWrap}>
        <View style={styles.doneCheckRing}>
          <Ionicons name="checkmark" size={36} color="#FFFFFF" />
        </View>
        <Text style={styles.doneTitle}>Growth area added!</Text>
        {savedArea && (
          <View style={styles.donePlanCard}>
            <Text style={styles.donePlanTitle}>{savedArea.title}</Text>
            {!!savedArea.description && (
              <Text style={styles.donePlanDesc}>{savedArea.description}</Text>
            )}
          </View>
        )}

        {fromDashboard ? (
          <View style={styles.doneInfoCard}>
            <Ionicons name="information-circle-outline" size={18} color="#4ADE80" />
            <View style={{ flex: 1 }}>
              <Text style={styles.doneInfoText}>
                Your dashboard will now show {displayName}'s personalised weekly plan.
              </Text>
              <Text style={[styles.doneInfoText, { marginTop: 6, color: 'rgba(255,255,255,0.45)' }]}>
                To manage growth areas or add a second one (limit is 2 for focus), visit {displayName}'s profile in the <Text style={{ color: '#4ADE80', fontWeight: '700' }}>Family</Text> tab.
              </Text>
            </View>
          </View>
        ) : (
          <Text style={styles.doneSub}>
            {isFirstTime
              ? `Welcome to ${displayName}'s dashboard. You can update this plan any time.`
              : `Added to ${displayName}'s growth areas. The plan is ready to view.`}
          </Text>
        )}

        {canAddMore && !fromDashboard && (
          <TouchableOpacity style={styles.doneAddBtn} onPress={handleAddAnother} activeOpacity={0.8}>
            <Ionicons name="add-circle-outline" size={16} color="#4ADE80" />
            <Text style={styles.doneAddBtnText}>Add another growth area</Text>
            <Text style={styles.doneAddBtnHint}>{totalAreas}/2 used</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.donePrimaryBtn} onPress={handleDone} activeOpacity={0.85}>
          <Text style={styles.donePrimaryBtnText}>View Plan</Text>
          <Ionicons name="arrow-forward" size={16} color="#1B3D2F" />
        </TouchableOpacity>
      </View>
    );
  }

  // ── Layout ────────────────────────────────────────────────────────────────────

  const canAdvance = step === STEP_ISSUE ? issue.trim().length >= 10 : true;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Header */}
        {step > STEP_INTRO && step !== STEP_SAFETY && step !== STEP_BRIDGE && step < STEP_LOADING && (
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={step === STEP_ISSUE ? () => fadeTo(STEP_INTRO) : () => fadeTo(step - 1)}
            >
              <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
            <View style={styles.headerMid}>
              <Text style={styles.headerLabel}>GROWTH AREA</Text>
              <Text style={styles.headerName}>{displayName}</Text>
            </View>
            <View style={{ width: 60 }} />
          </View>
        )}

        <ProgressBar step={step} />

        {/* Step content */}
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
            {step === STEP_INTRO    && renderIntro()}
            {step === STEP_ISSUE    && renderIssue()}
            {step === STEP_SAFETY   && renderSafety()}
            {step === STEP_BRIDGE   && renderBridge()}
            {step === STEP_ANALYSIS && renderAnalysis()}
            {step === STEP_LOADING  && renderLoading()}
            {step === STEP_DONE     && renderDone()}
          </Animated.View>
        </ScrollView>

        {/* Footer */}
        {(step === STEP_ISSUE || step === STEP_ANALYSIS) && step !== STEP_INTRO && step !== STEP_SAFETY && step !== STEP_BRIDGE && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.continueBtn, !canAdvance && styles.continueBtnDisabled]}
              onPress={step === STEP_ISSUE
                ? () => containsSafetyIssue(issue) ? fadeTo(STEP_SAFETY) : fadeTo(STEP_ANALYSIS)
                : handleGenerate}
              disabled={!canAdvance}
              activeOpacity={0.85}
            >
              <Text style={styles.continueBtnText}>
                {step === STEP_ISSUE ? 'Continue' : 'Generate Plan'}
              </Text>
              <Ionicons name={step === STEP_ISSUE ? 'arrow-forward' : 'sparkles'} size={16} color={canAdvance ? '#1B3D2F' : 'rgba(255,255,255,0.3)'} />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1B3D2F' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14, gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerMid: { flex: 1, alignItems: 'center' },
  headerLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 1.5 },
  headerName:  { fontSize: 15, fontWeight: '800', color: '#FFFFFF', marginTop: 1 },
  skipBtn: { width: 60, alignItems: 'flex-end' },
  skipText: { fontSize: 14, color: 'rgba(255,255,255,0.45)', fontWeight: '500' },

  // Scroll area
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 24 },

  // Step content
  stepWrap: { flex: 1 },
  stepIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  stepTitle: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', lineHeight: 32, marginBottom: 10 },
  stepSub:   { fontSize: 15, color: 'rgba(255,255,255,0.6)', lineHeight: 22, marginBottom: 24 },
  textArea: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    padding: 16,
    fontSize: 15, color: '#FFFFFF', lineHeight: 22,
    minHeight: 150,
  },
  charHint:  { fontSize: 11, color: 'rgba(255,255,255,0.25)', textAlign: 'right', marginTop: 6 },
  reflectCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderLeftWidth: 3, borderLeftColor: '#4ADE80',
    borderRadius: 12, padding: 14, marginBottom: 20,
  },
  reflectLabel: {
    fontSize: 9, fontWeight: '700', color: 'rgba(74,222,128,0.6)',
    letterSpacing: 1.2, marginBottom: 8,
  },
  reflectText: { fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 20 },
  errorText: { fontSize: 13, color: '#F87171', marginTop: 12, textAlign: 'center' },

  // Loading
  loadingWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 24, paddingTop: 20,
  },
  loadingTitle: {
    fontSize: 24, fontWeight: '800', color: '#FFFFFF',
    textAlign: 'center', marginBottom: 40,
  },
  loadingStages: { width: '100%', gap: 16 },
  loadingStageRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(74,222,128,0.07)',
    borderRadius: 14, paddingHorizontal: 18, paddingVertical: 14,
    borderWidth: 1, borderColor: 'rgba(74,222,128,0.15)',
  },
  loadingStageIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(74,222,128,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  loadingStageText: { flex: 1, fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  loadingKeepOpen: {
    fontSize: 12, color: 'rgba(255,255,255,0.35)',
    textAlign: 'center', marginTop: 20, fontStyle: 'italic',
  },

  // Done
  doneWrap: { flex: 1, alignItems: 'center', paddingTop: 20 },
  doneCheckRing: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#2E7D62',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  doneTitle: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', marginBottom: 20 },
  donePlanCard: {
    width: '100%', backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16, padding: 18, marginBottom: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  donePlanTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', marginBottom: 6 },
  donePlanDesc:  { fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 19, marginBottom: 14 },
  donePlanWeekRow: { flexDirection: 'row', gap: 8 },
  donePlanWeekPill: {
    backgroundColor: 'rgba(74,222,128,0.15)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  donePlanWeekText: { fontSize: 11, fontWeight: '700', color: '#4ADE80' },
  doneSub: { fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 21, marginBottom: 28, paddingHorizontal: 8 },

  doneInfoCard: {
    width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: 'rgba(74,222,128,0.08)',
    borderWidth: 1, borderColor: 'rgba(74,222,128,0.2)',
    borderRadius: 14, padding: 16, marginBottom: 24,
  },
  doneInfoText: { fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 20 },

  doneAddBtn: {
    width: '100%', flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(74,222,128,0.1)',
    borderWidth: 1, borderColor: 'rgba(74,222,128,0.3)',
    borderRadius: 14, paddingHorizontal: 18, paddingVertical: 14,
    marginBottom: 12,
  },
  doneAddBtnText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#4ADE80' },
  doneAddBtnHint: { fontSize: 11, color: 'rgba(74,222,128,0.6)', fontWeight: '600' },

  donePrimaryBtn: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#4ADE80', borderRadius: 14,
    paddingVertical: 16, marginTop: 4,
  },
  donePrimaryBtnText: { fontSize: 15, fontWeight: '800', color: '#1B3D2F' },

  // Bridge screen
  bridgeWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 8, paddingTop: 20,
  },
  bridgeIconRing: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(74,222,128,0.12)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 28,
  },
  bridgeTitle: {
    fontSize: 26, fontWeight: '800', color: '#FFFFFF',
    textAlign: 'center', marginBottom: 20,
  },
  bridgeBody: {
    fontSize: 15, color: 'rgba(255,255,255,0.65)',
    textAlign: 'center', lineHeight: 24, marginBottom: 14,
  },
  bridgeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#4ADE80', borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 40, marginTop: 16,
  },
  bridgeBtnText: { fontSize: 16, fontWeight: '800', color: '#1B3D2F' },

  // Safety screen
  safetyWrap: { flex: 1, paddingTop: 32 },
  safetyIconRing: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(248,113,113,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  safetyTitle: {
    fontSize: 22, fontWeight: '800', color: '#FFFFFF',
    lineHeight: 30, marginBottom: 14,
  },
  safetyBody: {
    fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 22, marginBottom: 10,
  },
  safetySub: {
    fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.3, marginBottom: 18,
  },
  safetyResources: { gap: 10, marginBottom: 32 },
  safetyGroupHeader: {
    fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.3)',
    letterSpacing: 1.4, marginTop: 4, marginBottom: 2,
  },
  safetyResourceRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: 'rgba(248,113,113,0.08)',
    borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.2)',
  },
  safetyResourceIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(248,113,113,0.12)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  safetyResourceLabel:  { fontSize: 13, fontWeight: '700', color: '#FFFFFF', marginBottom: 3 },
  safetyResourceDetail: { fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 18 },
  safetyBackBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12,
  },
  safetyBackText: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },

  // Intro
  introWrap: { flex: 1, alignItems: 'center', paddingTop: 60 },
  introIconRing: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(74,222,128,0.1)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  introTitle: {
    fontSize: 24, fontWeight: '800', color: '#FFFFFF',
    textAlign: 'center', lineHeight: 32, marginBottom: 14,
  },
  introBody: {
    fontSize: 15, color: 'rgba(255,255,255,0.55)', textAlign: 'center',
    lineHeight: 23, marginBottom: 32, paddingHorizontal: 8,
  },
  introFeatures: { width: '100%', gap: 14, marginBottom: 40 },
  introFeatureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  introFeatureIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(74,222,128,0.12)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  introFeatureText: {
    flex: 1, fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 21,
  },
  introPrimaryBtn: {
    width: '100%', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
    backgroundColor: '#4ADE80', borderRadius: 14, paddingVertical: 16,
    marginBottom: 14,
  },
  introPrimaryBtnText: { fontSize: 15, fontWeight: '800', color: '#1B3D2F' },
  introChip: {
    fontSize: 12, fontWeight: '700', color: 'rgba(74,222,128,0.7)',
    letterSpacing: 0.5, marginTop: -14, marginBottom: 6,
  },
  introSkipBtn: { paddingVertical: 8 },
  introSkipText: { fontSize: 14, color: 'rgba(255,255,255,0.4)', fontWeight: '500' },
  introCancelBtn: { paddingVertical: 6 },
  introCancelText: { fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: '500' },

  // Footer
  footer: { paddingHorizontal: 24, paddingBottom: 12, paddingTop: 8 },
  continueBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#4ADE80', borderRadius: 14, paddingVertical: 16,
  },
  continueBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.1)' },
  continueBtnText: { fontSize: 15, fontWeight: '800', color: '#1B3D2F' },
});
