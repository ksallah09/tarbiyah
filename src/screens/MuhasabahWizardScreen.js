import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet,
  Animated, KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView, SafeAreaView, Dimensions, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';
import { getAllChildProfiles } from '../utils/childProfiles';
import { useFocusEffect } from '@react-navigation/native';

const { width: SCREEN_W } = Dimensions.get('window');
const API_URL = 'https://tarbiyah-production.up.railway.app';

// ── Constants ──────────────────────────────────────────────────────────────────

const EMOJI_SCALE  = ['😔', '😐', '🙂', '😊', '🌟'];
const EMOJI_LABELS = ['Needs work', 'A little', 'Pretty good', 'Really good', 'Amazing!'];
const PTS_PER_LVL  = [2, 4, 6, 8, 12];

const DEFAULT_CATS = [
  { key: 'salah',    label: 'Salah',    emoji: '🙏' },
  { key: 'quran',    label: 'Quran',    emoji: '📖' },
  { key: 'kindness', label: 'Kindness', emoji: '💝' },
  { key: 'honesty',  label: 'Honesty',  emoji: '✨' },
  { key: 'helping',  label: 'Helping',  emoji: '🤝' },
];

const BG      = '#0D1B3E';
const CARD    = 'rgba(255,255,255,0.07)';
const BORDER  = 'rgba(255,255,255,0.11)';
const GOLD    = '#FFD166';
const GREEN   = '#4ADE80';
const PURPLE  = '#C084FC';
const TEXT    = '#F8FAFC';
const SUBTEXT = '#94A3B8';

const STEPS = ['intro', 'honesty', 'sliders', 'challenge', 'repair_yn', 'repair', 'tomorrow', 'generating', 'reminder'];
const VISIBLE_STEPS = 6;

function calcPoints(ratings, hasRepair, repairPlan, streakDay) {
  let pts = 10;
  Object.values(ratings).forEach(r => { pts += (PTS_PER_LVL[r] ?? 0); });
  if (hasRepair && repairPlan?.trim()) pts += 10;
  pts += Math.min((streakDay ?? 1) * 3, 30);
  return pts;
}

// ── Decorative background stars ────────────────────────────────────────────────

function StarsBg() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {['⭐','✨','💫','⭐','✨','💫','⭐','✨'].map((s, i) => (
        <Text key={i} style={[styles.bgStar, {
          top: `${10 + i * 11}%`,
          left:  i % 2 === 0 ? `${5 + i * 9}%`  : undefined,
          right: i % 2 !== 0 ? `${3 + i * 8}%`  : undefined,
          opacity: 0.12 + (i % 3) * 0.06,
          fontSize: 16 + (i % 3) * 8,
        }]}>{s}</Text>
      ))}
    </View>
  );
}

// ── Progress dots ──────────────────────────────────────────────────────────────

function ProgressDots({ step }) {
  const dotStep = Math.min(step, VISIBLE_STEPS - 1);
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: VISIBLE_STEPS }).map((_, i) => (
        <View key={i} style={[
          styles.dot,
          i === dotStep && styles.dotActive,
          i < dotStep  && styles.dotDone,
        ]} />
      ))}
    </View>
  );
}

// ── Reusable card + button ─────────────────────────────────────────────────────

function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function BigBtn({ label, onPress, color = GOLD, textColor = '#0D1B3E', disabled }) {
  return (
    <TouchableOpacity
      style={[styles.bigBtn, { backgroundColor: color }, disabled && { opacity: 0.4 }]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.82}
    >
      <Text style={[styles.bigBtnText, { color: textColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Child avatar ───────────────────────────────────────────────────────────────

function ChildAvatar({ child, size = 64, selected, onPress }) {
  const ring = selected ? { borderWidth: 3, borderColor: GOLD } : { borderWidth: 2, borderColor: 'transparent' };
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.avatarWrap}>
      <View style={[styles.avatarCircle, { width: size, height: size, borderRadius: size / 2, backgroundColor: child.color ?? '#1B4D3E' }, ring]}>
        {child.photo
          ? <Image source={{ uri: child.photo }} style={{ width: size - 8, height: size - 8, borderRadius: (size - 8) / 2 }} />
          : <Text style={[styles.avatarInitial, { fontSize: size * 0.38 }]}>{(child.name ?? '?')[0].toUpperCase()}</Text>
        }
      </View>
      {selected && <View style={styles.avatarCheck}><Text style={{ fontSize: 11 }}>✓</Text></View>}
      <Text style={styles.avatarName} numberOfLines={1}>{child.name}</Text>
    </TouchableOpacity>
  );
}

// ── Step: Intro / Child selector ───────────────────────────────────────────────

function IntroStep({ children, selectedChild, onSelect, streakDay, onBegin }) {
  return (
    <ScrollView contentContainerStyle={styles.stepWrap} showsVerticalScrollIndicator={false}>
      <Text style={styles.moonEmoji}>🌙</Text>
      <Text style={styles.introTitle}>Muhasabah Time!</Text>
      <Text style={styles.introQuote}>"Reflect on yourselves before you are held accountable"</Text>
      <Text style={styles.introQuoteSrc}>— Umar ibn al-Khattab رضي الله عنه</Text>

      <Text style={[styles.inputLabel, { marginTop: 28, marginBottom: 14 }]}>
        👦 Who's reflecting tonight?
      </Text>

      {children.length === 0 ? (
        <Card>
          <Text style={[styles.stepSub, { textAlign: 'left' }]}>
            No children added yet. Add a child in the Family tab first.
          </Text>
        </Card>
      ) : (
        <View style={styles.childGrid}>
          {children.map(child => (
            <ChildAvatar
              key={child.id}
              child={child}
              selected={selectedChild?.id === child.id}
              onPress={() => onSelect(child)}
            />
          ))}
        </View>
      )}

      {streakDay > 1 && selectedChild && (
        <View style={styles.streakBadge}>
          <Text style={styles.streakFlame}>🔥</Text>
          <Text style={styles.streakText}>{streakDay} day streak!</Text>
        </View>
      )}

      <BigBtn
        label="Let's Begin ✨"
        onPress={onBegin}
        disabled={!selectedChild}
        style={{ marginTop: 24 }}
      />
    </ScrollView>
  );
}

// ── Step: Honesty pledge ───────────────────────────────────────────────────────

function HonestyStep() {
  return (
    <ScrollView contentContainerStyle={styles.stepWrap} showsVerticalScrollIndicator={false}>
      <Text style={[styles.stepEmoji, { marginTop: 4 }]}>💚</Text>
      <Text style={styles.stepTitle}>I promise to be honest</Text>

      <Card style={{ marginTop: 12 }}>
        <Text style={styles.honestyBody}>
          Allah already knows how today went — so the only person we can truly fool is ourselves.
          {'\n\n'}
          If you rate yourself low tonight, that's not failure. That's{' '}
          <Text style={{ color: GOLD, fontWeight: '700' }}>courage</Text>. It means you see yourself clearly — and only someone who sees clearly can grow.
          {'\n\n'}
          A 😔 answered honestly is worth far more than a 🌟 that isn't true.
        </Text>
      </Card>

      <View style={styles.honestyNote}>
        <Text style={styles.honestyNoteEmoji}>💡</Text>
        <Text style={styles.honestyNoteText}>
          You cannot fix what you won't acknowledge. Honesty tonight is the first step to a better tomorrow.
        </Text>
      </View>
    </ScrollView>
  );
}

// ── Step: Sliders ──────────────────────────────────────────────────────────────

function SlidersStep({ categories, ratings, setRatings }) {
  return (
    <ScrollView contentContainerStyle={styles.stepWrap} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepEmoji}>🌟</Text>
      <Text style={styles.stepTitle}>How did today go?</Text>
      <Text style={styles.stepSub}>Tap to rate each area of your day</Text>

      {categories.map(cat => (
        <Card key={cat.key} style={{ marginBottom: 12 }}>
          <View style={styles.catHeader}>
            <Text style={styles.catEmoji}>{cat.emoji}</Text>
            <Text style={styles.catLabel}>{cat.label}</Text>
            {ratings[cat.key] !== undefined && (
              <Text style={styles.catRatingLabel}>{EMOJI_LABELS[ratings[cat.key]]}</Text>
            )}
          </View>
          <View style={styles.emojiRow}>
            {EMOJI_SCALE.map((e, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.emojiBtn, ratings[cat.key] === i && styles.emojiBtnActive]}
                onPress={() => setRatings(r => ({ ...r, [cat.key]: i }))}
                activeOpacity={0.7}
              >
                <Text style={styles.emojiChar}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

// ── Step: Challenge ────────────────────────────────────────────────────────────

function ChallengeStep({ value, onChange }) {
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.stepWrap} showsVerticalScrollIndicator={false}>
        <Text style={styles.stepEmoji}>😔</Text>
        <Text style={styles.stepTitle}>What didn't I do well?</Text>
        <Text style={styles.stepSub}>Be honest — Allah loves those who hold themselves accountable</Text>
        <Card style={{ marginTop: 20 }}>
          <TextInput
            style={[styles.textInput, styles.multiInput]}
            placeholder="I didn't do well at..."
            placeholderTextColor={SUBTEXT}
            value={value}
            onChangeText={onChange}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </Card>
        <Text style={styles.skipHint}>Tap Next to skip if everything went well 🌟</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Step: Repair Y/N ───────────────────────────────────────────────────────────

function RepairYNStep({ value, onChange }) {
  return (
    <View style={styles.stepWrap}>
      <Text style={styles.stepEmoji}>🤝</Text>
      <Text style={styles.stepTitle}>Something to repair?</Text>
      <Text style={styles.stepSub}>Did something happen that needs to be made right?</Text>

      <TouchableOpacity
        style={[styles.ynBtn, value === true  && styles.ynBtnYes]}
        onPress={() => onChange(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.ynBtnEmoji}>✅</Text>
        <View>
          <Text style={styles.ynBtnLabel}>Yes, there was</Text>
          <Text style={styles.ynBtnSub}>I want to make it right</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.ynBtn, value === false && styles.ynBtnNo]}
        onPress={() => onChange(false)}
        activeOpacity={0.8}
      >
        <Text style={styles.ynBtnEmoji}>🙏</Text>
        <View>
          <Text style={styles.ynBtnLabel}>No, alhamdulillah</Text>
          <Text style={styles.ynBtnSub}>Nothing to repair today</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

// ── Step: Repair plan ──────────────────────────────────────────────────────────

function RepairStep({ value, onChange }) {
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.stepWrap} showsVerticalScrollIndicator={false}>
        <Text style={styles.stepEmoji}>💝</Text>
        <Text style={styles.stepTitle}>How can I repair it?</Text>
        <Text style={styles.stepSub}>Making things right is a sign of great character</Text>
        <Card style={{ marginTop: 20 }}>
          <TextInput
            style={[styles.textInput, styles.multiInput]}
            placeholder="I will repair it by..."
            placeholderTextColor={SUBTEXT}
            value={value}
            onChangeText={onChange}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </Card>
        <View style={styles.bonusBadge}>
          <Text style={styles.bonusText}>+10 bonus hasanat for repairing 💝</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Step: Tomorrow ─────────────────────────────────────────────────────────────

function TomorrowStep({ value, onChange }) {
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.stepWrap} showsVerticalScrollIndicator={false}>
        <Text style={styles.stepEmoji}>🎯</Text>
        <Text style={styles.stepTitle}>How will I do better tomorrow?</Text>
        <Text style={styles.stepSub}>Set one clear intention for tomorrow</Text>
        <Card style={{ marginTop: 20 }}>
          <TextInput
            style={[styles.textInput, styles.multiInput]}
            placeholder="Tomorrow I will..."
            placeholderTextColor={SUBTEXT}
            value={value}
            onChangeText={onChange}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Step: Generating ──────────────────────────────────────────────────────────

function GeneratingStep() {
  return (
    <View style={[styles.stepWrap, { alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ fontSize: 56, marginBottom: 24 }}>🌙</Text>
      <Text style={[styles.stepTitle, { textAlign: 'center' }]}>Getting your reminder...</Text>
      <Text style={[styles.stepSub, { textAlign: 'center', marginBottom: 32 }]}>
        Finding the perfect ayah or hadith for you
      </Text>
      <ActivityIndicator size="large" color={GOLD} />
      <Text style={[styles.stepSub, { textAlign: 'center', marginTop: 32, fontStyle: 'italic' }]}>
        ✨ "And He is with you wherever you are" (57:4)
      </Text>
    </View>
  );
}

// ── Step: Reminder display ────────────────────────────────────────────────────

function ReminderStep({ reminder }) {
  return (
    <ScrollView contentContainerStyle={styles.stepWrap} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepEmoji}>🌙</Text>
      <Text style={styles.stepTitle}>Your Reminder</Text>

      <Card style={styles.reminderCard}>
        <Text style={styles.reminderQuoteIcon}>"</Text>
        <Text style={styles.reminderText}>{reminder?.ayah_or_hadith}</Text>
        <View style={styles.reminderSource}>
          <Text style={styles.reminderSourceText}>📖 {reminder?.source}</Text>
        </View>
      </Card>

      {reminder?.dua && (
        <Card style={styles.duaCard}>
          <Text style={styles.duaLabel}>🤲 Dua</Text>
          <Text style={styles.duaText}>{reminder.dua}</Text>
        </Card>
      )}

      {reminder?.encouragement && (
        <Card style={styles.encourageCard}>
          <Text style={styles.encourageEmoji}>💫</Text>
          <Text style={styles.encourageText}>{reminder.encouragement}</Text>
        </Card>
      )}
    </ScrollView>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function MuhasabahWizardScreen({ navigation }) {
  const [stepIdx, setStepIdx]         = useState(0);
  const [childList, setChildList]     = useState([]);
  const [selectedChild, setSelected]  = useState(null);
  const [categories, setCategories]   = useState(DEFAULT_CATS);
  const [honestyAgreed, setHonesty]   = useState(false);
  const [ratings, setRatings]         = useState({});
  const [didntDoWell, setDidnt]       = useState('');
  const [hasRepair, setHasRepair]     = useState(null);
  const [repairPlan, setRepairPlan]   = useState('');
  const [doBetter, setDoBetter]       = useState('');
  const [reminder, setReminder]       = useState(null);
  const [streakDay, setStreakDay]     = useState(1);

  const fadeAnim = useRef(new Animated.Value(1)).current;

  useFocusEffect(useCallback(() => {
    loadChildren();
  }, []));

  async function loadChildren() {
    const kids = await getAllChildProfiles();
    setChildList(kids);
    if (kids.length === 1) {
      setSelected(kids[0]);
      loadStreakFor(kids[0].id);
    }
  }

  async function loadStreakFor(childId) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const { data } = await supabase
      .from('muhasabah_sessions')
      .select('session_date, streak_day')
      .eq('user_id', session.user.id)
      .eq('child_id', childId)
      .order('session_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) { setStreakDay(1); return; }
    const today = new Date().toISOString().slice(0, 10);
    if (data.session_date === today)      { setStreakDay(data.streak_day); return; }
    if (data.session_date === yesterday)  { setStreakDay((data.streak_day ?? 1) + 1); return; }
    setStreakDay(1);
  }

  async function loadCategories(childId) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from('muhasabah_config')
      .select('categories')
      .eq('user_id', session.user.id)
      .eq('child_id', childId)
      .maybeSingle();
    if (data?.categories?.length) setCategories(data.categories);
    else setCategories(DEFAULT_CATS);
  }

  function transitionTo(nextIdx) {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setTimeout(() => setStepIdx(nextIdx), 150);
  }

  function goBack() {
    if (stepIdx === 0) { navigation.goBack(); return; }
    let prev = stepIdx - 1;
    if (stepIdx === STEPS.indexOf('tomorrow') && hasRepair === false) {
      prev = STEPS.indexOf('repair_yn');
    }
    transitionTo(prev);
  }

  async function goNext() {
    const current = STEPS[stepIdx];

    if (current === 'intro') {
      await loadCategories(selectedChild.id);
      transitionTo(STEPS.indexOf('honesty'));
      return;
    }
    if (current === 'honesty')    { transitionTo(STEPS.indexOf('sliders')); return; }
    if (current === 'sliders')    { transitionTo(STEPS.indexOf('challenge')); return; }
    if (current === 'challenge')  { transitionTo(STEPS.indexOf('repair_yn')); return; }
    if (current === 'repair_yn') {
      if (hasRepair === null) return;
      transitionTo(hasRepair ? STEPS.indexOf('repair') : STEPS.indexOf('tomorrow'));
      return;
    }
    if (current === 'repair')    { transitionTo(STEPS.indexOf('tomorrow')); return; }
    if (current === 'tomorrow')  {
      transitionTo(STEPS.indexOf('generating'));
      await generateAndSave();
      return;
    }
    if (current === 'reminder') {
      const points = calcPoints(ratings, hasRepair, repairPlan, streakDay);
      navigation.replace('MuhasabahSeal', { child: selectedChild, points, streakDay, reminder });
    }
  }

  async function generateAndSave() {
    const sliderSummary = categories
      .map(c => ratings[c.key] !== undefined ? `${c.label}: ${EMOJI_SCALE[ratings[c.key]]}` : null)
      .filter(Boolean).join(', ');

    let generated = null;
    try {
      const resp = await fetch(`${API_URL}/muhasabah/reminder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childName: selectedChild.name,
          didntDoWell, repairPlan, doBetter, sliderSummary,
        }),
      });
      if (resp.ok) generated = await resp.json();
    } catch (e) {
      console.warn('[muhasabah] reminder fetch failed:', e);
    }

    const points = calcPoints(ratings, hasRepair, repairPlan, streakDay);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.from('muhasabah_sessions').insert({
          user_id:       session.user.id,
          child_id:      selectedChild.id,
          child_name:    selectedChild.name,
          session_date:  new Date().toISOString().slice(0, 10),
          slider_ratings: ratings,
          didnt_do_well: didntDoWell || null,
          needs_repair:  hasRepair ?? false,
          repair_plan:   repairPlan || null,
          do_better:     doBetter || null,
          reminder:      generated,
          points_earned: points,
          streak_day:    streakDay,
        });
      }
    } catch (e) {
      console.warn('[muhasabah] session save failed:', e);
    }

    setReminder(generated);
    transitionTo(STEPS.indexOf('reminder'));
  }

  function canGoNext() {
    const current = STEPS[stepIdx];
    if (current === 'intro')      return !!selectedChild;
    if (current === 'honesty')    return true;
    if (current === 'repair_yn')  return hasRepair !== null;
    return true;
  }

  const step        = STEPS[stepIdx];
  const showNav     = step !== 'generating';
  const isLast      = step === 'reminder';
  const showProgress = stepIdx < VISIBLE_STEPS;

  return (
    <SafeAreaView style={styles.safe}>
      <StarsBg />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn} hitSlop={{ top: 10, left: 10, bottom: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color={TEXT} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🌙 Muhasabah</Text>
        {showProgress
          ? <ProgressDots step={stepIdx} />
          : <View style={{ width: 40 }} />
        }
      </View>

      {/* Step content */}
      <Animated.View style={[styles.stepContainer, { opacity: fadeAnim }]}>
        {step === 'intro' && (
          <IntroStep
            children={childList}
            selectedChild={selectedChild}
            onSelect={c => { setSelected(c); loadStreakFor(c.id); }}
            streakDay={streakDay}
            onBegin={goNext}
          />
        )}
        {step === 'honesty'    && <HonestyStep />}
        {step === 'sliders'    && <SlidersStep categories={categories} ratings={ratings} setRatings={setRatings} />}
        {step === 'challenge'  && <ChallengeStep value={didntDoWell} onChange={setDidnt} />}
        {step === 'repair_yn'  && <RepairYNStep value={hasRepair} onChange={setHasRepair} />}
        {step === 'repair'     && <RepairStep value={repairPlan} onChange={setRepairPlan} />}
        {step === 'tomorrow'   && <TomorrowStep value={doBetter} onChange={setDoBetter} />}
        {step === 'generating' && <GeneratingStep />}
        {step === 'reminder'   && <ReminderStep reminder={reminder} />}
      </Animated.View>

      {/* Nav */}
      {showNav && step !== 'intro' && (
        <View style={styles.navRow}>
          {isLast ? (
            <BigBtn label="Alhamdulillah! 🌟" onPress={goNext} />
          ) : (
            <BigBtn
              label={step === 'honesty' ? 'I agree 💚' : step === 'tomorrow' ? 'Final Step →' : 'Next →'}
              onPress={goNext}
              disabled={!canGoNext()}
            />
          )}
          {step === 'repair_yn' && hasRepair === null && (
            <Text style={styles.tapHint}>Tap an option above to continue</Text>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: BG },
  bgStar:           { position: 'absolute' },

  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  headerTitle:      { fontSize: 17, fontWeight: '700', color: TEXT },
  backBtn:          { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  dotsRow:          { flexDirection: 'row', gap: 5, alignItems: 'center' },
  dot:              { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)' },
  dotActive:        { width: 10, height: 10, borderRadius: 5, backgroundColor: GOLD },
  dotDone:          { backgroundColor: 'rgba(255,209,102,0.4)' },

  stepContainer:    { flex: 1 },
  stepWrap:         { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 },

  card:             { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 16, padding: 16, marginTop: 8 },

  moonEmoji:        { fontSize: 72, textAlign: 'center', marginBottom: 8 },
  introTitle:       { fontSize: 28, fontWeight: '900', color: TEXT, textAlign: 'center', marginBottom: 10 },
  introQuote:       { fontSize: 14, color: SUBTEXT, textAlign: 'center', fontStyle: 'italic', lineHeight: 22, paddingHorizontal: 16 },
  introQuoteSrc:    { fontSize: 12, color: PURPLE, textAlign: 'center', marginTop: 6 },

  childGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center', marginBottom: 8 },
  avatarWrap:       { alignItems: 'center', width: 76 },
  avatarCircle:     { alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  avatarInitial:    { color: '#FFF', fontWeight: '800' },
  avatarCheck:      { position: 'absolute', top: -4, right: 4, backgroundColor: GOLD, borderRadius: 10, width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  avatarName:       { fontSize: 12, color: TEXT, fontWeight: '600', maxWidth: 72, textAlign: 'center' },

  streakBadge:      { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', backgroundColor: 'rgba(255,100,30,0.15)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 16 },
  streakFlame:      { fontSize: 22 },
  streakText:       { fontSize: 15, fontWeight: '700', color: '#FB923C' },

  inputLabel:       { fontSize: 14, color: SUBTEXT, fontWeight: '600' },
  stepEmoji:        { fontSize: 56, textAlign: 'center', marginBottom: 8, marginTop: 8 },
  stepTitle:        { fontSize: 22, fontWeight: '800', color: TEXT, textAlign: 'center', marginBottom: 8, lineHeight: 30 },
  stepSub:          { fontSize: 14, color: SUBTEXT, textAlign: 'center', lineHeight: 22, paddingHorizontal: 12 },
  skipHint:         { fontSize: 12, color: SUBTEXT, textAlign: 'center', marginTop: 16, fontStyle: 'italic' },

  textInput:        { color: TEXT, fontSize: 16, paddingVertical: 4 },
  multiInput:       { minHeight: 100, lineHeight: 24 },

  catHeader:        { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  catEmoji:         { fontSize: 22, marginRight: 8 },
  catLabel:         { fontSize: 15, fontWeight: '700', color: TEXT, flex: 1 },
  catRatingLabel:   { fontSize: 12, color: GOLD, fontWeight: '600' },
  emojiRow:         { flexDirection: 'row', justifyContent: 'space-between' },
  emojiBtn:         { width: (SCREEN_W - 80) / 5, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)' },
  emojiBtnActive:   { backgroundColor: 'rgba(255,209,102,0.2)', borderWidth: 2, borderColor: GOLD },
  emojiChar:        { fontSize: 26 },

  ynBtn:            { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 16, padding: 20, marginTop: 16 },
  ynBtnYes:         { borderColor: GREEN, backgroundColor: 'rgba(74,222,128,0.1)' },
  ynBtnNo:          { borderColor: PURPLE, backgroundColor: 'rgba(192,132,252,0.1)' },
  ynBtnEmoji:       { fontSize: 32 },
  ynBtnLabel:       { fontSize: 16, fontWeight: '700', color: TEXT },
  ynBtnSub:         { fontSize: 12, color: SUBTEXT, marginTop: 2 },

  bonusBadge:       { alignSelf: 'center', backgroundColor: 'rgba(255,209,102,0.12)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 16 },
  bonusText:        { fontSize: 13, color: GOLD, fontWeight: '600' },

  reminderCard:     { marginTop: 16, borderColor: 'rgba(255,209,102,0.25)', borderWidth: 1 },
  reminderQuoteIcon:{ fontSize: 40, color: GOLD, opacity: 0.4, lineHeight: 44, marginBottom: -8 },
  reminderText:     { fontSize: 16, color: TEXT, lineHeight: 26, fontStyle: 'italic' },
  reminderSource:   { marginTop: 12, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 10 },
  reminderSourceText: { fontSize: 13, color: GOLD, fontWeight: '600' },

  duaCard:          { marginTop: 12, borderColor: 'rgba(192,132,252,0.25)' },
  duaLabel:         { fontSize: 13, color: PURPLE, fontWeight: '700', marginBottom: 8 },
  duaText:          { fontSize: 14, color: TEXT, lineHeight: 22 },

  encourageCard:    { marginTop: 12, borderColor: 'rgba(74,222,128,0.2)' },
  encourageEmoji:   { fontSize: 28, marginBottom: 8 },
  encourageText:    { fontSize: 15, color: TEXT, lineHeight: 24 },

  navRow:           { paddingHorizontal: 20, paddingBottom: 24, paddingTop: 12 },
  tapHint:          { fontSize: 12, color: SUBTEXT, textAlign: 'center', marginTop: 10 },

  bigBtn:           { borderRadius: 16, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  bigBtnText:       { fontSize: 17, fontWeight: '800' },

  honestyCard:      { borderColor: 'rgba(255,209,102,0.3)', marginTop: 16 },
  honestyQuote:     { fontSize: 17, fontStyle: 'italic', color: TEXT, lineHeight: 26, marginBottom: 8 },
  honestySource:    { fontSize: 13, color: GOLD, fontWeight: '700' },
  honestyBody:      { fontSize: 17, color: TEXT, lineHeight: 28 },
  honestyNote:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: 'rgba(192,132,252,0.08)', borderRadius: 14, padding: 14, marginTop: 14, borderWidth: 1, borderColor: 'rgba(192,132,252,0.2)' },
  honestyNoteEmoji: { fontSize: 18, marginTop: 1 },
  honestyNoteText:  { fontSize: 16, color: SUBTEXT, lineHeight: 24, flex: 1 },

  pledgeBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 20, borderRadius: 16, paddingVertical: 18, backgroundColor: CARD, borderWidth: 2, borderColor: BORDER },
  pledgeBtnDone:    { backgroundColor: 'rgba(255,209,102,0.15)', borderColor: GOLD },
  pledgeBtnEmoji:   { fontSize: 22 },
  pledgeBtnText:    { fontSize: 16, fontWeight: '800', color: TEXT },
});
