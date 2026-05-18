import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';
import { getFamilyId } from '../utils/familyGoals';
import { getCachedSyncStatus } from '../utils/familySync';
import { loadFamilyGoals, getGoalEmoji } from '../utils/familyGoals';
import { notifyPartner } from '../utils/partnerNotify';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Challenge types ────────────────────────────────────────────────────────────

const CHALLENGE_TYPES = [
  {
    key:   'accomplishment_race',
    emoji: '🌱',
    label: 'Accomplishment Race',
    desc:  'First parent to log the most accomplishments for their child wins.',
    color: '#2E7D62',
  },
  {
    key:   'streak',
    emoji: '⚡',
    label: 'Streak Challenge',
    desc:  'Both keep a daily habit streak going — whoever breaks it first loses.',
    color: '#F59E0B',
  },
  {
    key:   'category_blitz',
    emoji: '🎯',
    label: 'Category Blitz',
    desc:  'Pick a category and compete for the most completions in a short window.',
    color: '#6366F1',
  },
  {
    key:   'goal_sprint',
    emoji: '🏃',
    label: 'Family Goal Sprint',
    desc:  'Race to complete a shared family goal the most times by the deadline.',
    color: '#EC4899',
  },
];

const BLITZ_CATEGORIES = [
  { key: 'habits',     label: 'Habits',          icon: 'repeat-outline' },
  { key: 'activities', label: 'Activities',       icon: 'color-palette-outline' },
  { key: 'quran',      label: 'Quran reads',      icon: 'book-outline' },
  { key: 'spiritual',  label: 'Spiritual reads',  icon: 'moon-outline' },
  { key: 'research',   label: 'Research reads',   icon: 'bulb-outline' },
];

const STREAK_CATEGORIES = [
  { key: 'habits',    label: 'Habits',          icon: 'repeat-outline' },
  { key: 'quran',     label: 'Quran',           icon: 'book-outline' },
  { key: 'spiritual', label: 'Spiritual reads', icon: 'moon-outline' },
  { key: 'research',  label: 'Research reads',  icon: 'bulb-outline' },
];

// ── Chip selector ──────────────────────────────────────────────────────────────

function ChipRow({ options, selected, onSelect }) {
  return (
    <View style={cs.chipRow}>
      {options.map(o => (
        <TouchableOpacity
          key={o.value ?? o}
          style={[cs.chip, selected === (o.value ?? o) && cs.chipActive]}
          onPress={() => onSelect(o.value ?? o)}
          activeOpacity={0.75}
        >
          <Text style={[cs.chipText, selected === (o.value ?? o) && cs.chipTextActive]}>
            {o.label ?? o}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Main wizard ────────────────────────────────────────────────────────────────

export default function ChallengeWizardScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [step,     setStep]    = useState(1);
  const [type,     setType]    = useState(null);
  const [config,   setConfig]  = useState({});
  const [goals,    setGoals]   = useState([]);
  const [saving,   setSaving]  = useState(false);
  const [myName,   setMyName]  = useState('');
  const [partner,  setPartner] = useState(null);

  useEffect(() => {
    loadFamilyGoals().then(setGoals);
    AsyncStorage.getItem('tarbiyah_profile').then(raw => {
      if (raw) setMyName(JSON.parse(raw).name?.split(' ')[0] ?? '');
    });
    getCachedSyncStatus().then(s => {
      if (s?.partner) setPartner(s.partner);
    });
  }, []);

  const challengeType = CHALLENGE_TYPES.find(t => t.key === type);

  function setConfigKey(key, val) {
    setConfig(prev => ({ ...prev, [key]: val }));
  }

  function configIsValid() {
    if (!type) return false;
    if (type === 'accomplishment_race') return !!config.target && !!config.duration_days;
    if (type === 'streak')              return !!config.category && !!config.duration_days;
    if (type === 'category_blitz')      return !!config.category && !!config.duration_hours;
    if (type === 'goal_sprint')         return !!config.goal_id && !!config.target && !!config.duration_days;
    return false;
  }

  async function sendChallenge() {
    if (!configIsValid()) return;
    setSaving(true);
    try {
      const familyId = await getFamilyId();
      const { data: sessionData } = await supabase.auth.getSession();
      const myId = sessionData?.session?.user?.id;

      const challenge = {
        id:               `ch_${Date.now()}`,
        family_id:        familyId,
        challenger_id:    myId,
        challenger_name:  myName,
        partner_id:       partner?.userId ?? null,
        type,
        config,
        status:           'pending',
        challenger_progress: 0,
        partner_progress:    0,
        created_at:       new Date().toISOString(),
        updated_at:       new Date().toISOString(),
      };

      const { error } = await supabase.from('family_challenges').insert(challenge);
      if (error) throw error;

      // Notify partner
      const desc = challengeDescription(type, config, goals);
      await notifyPartner(
        `${myName || 'Your partner'} has challenged you! 🏆`,
        desc,
        { screen: 'Dashboards', tab: 'family' }
      );

      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', 'Could not send challenge. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={cs.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Header */}
        <View style={cs.header}>
          <TouchableOpacity
            onPress={() => step > 1 ? setStep(step - 1) : navigation.goBack()}
            style={cs.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={22} color="#1A1A2E" />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={cs.headerTitle}>Challenge Your Partner</Text>
            <View style={cs.stepDots}>
              {[1, 2, 3].map(n => (
                <View key={n} style={[cs.dot, step >= n && cs.dotActive]} />
              ))}
            </View>
          </View>
          <View style={{ width: 32 }} />
        </View>

        {/* ── Step 1: Choose type ── */}
        {step === 1 && (
          <ScrollView contentContainerStyle={cs.scroll}>
            <Text style={cs.stepTitle}>Pick a challenge</Text>
            <Text style={cs.stepSub}>
              {partner?.name?.split(' ')[0] ?? 'Your partner'} will get a notification to accept.
            </Text>
            {CHALLENGE_TYPES.map(t => {
              const selected = type === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  style={[cs.typeCard, selected && { borderColor: t.color, backgroundColor: t.color + '10' }]}
                  onPress={() => setType(t.key)}
                  activeOpacity={0.8}
                >
                  <Text style={cs.typeEmoji}>{t.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[cs.typeLabel, selected && { color: t.color }]}>{t.label}</Text>
                    <Text style={cs.typeDesc}>{t.desc}</Text>
                  </View>
                  {selected && <Ionicons name="checkmark-circle" size={22} color={t.color} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* ── Step 2: Configure ── */}
        {step === 2 && type && (
          <ScrollView contentContainerStyle={cs.scroll}>
            <View style={[cs.typeBadge, { backgroundColor: challengeType.color + '15' }]}>
              <Text style={cs.typeBadgeEmoji}>{challengeType.emoji}</Text>
              <Text style={[cs.typeBadgeLabel, { color: challengeType.color }]}>{challengeType.label}</Text>
            </View>
            <Text style={cs.stepTitle}>Set it up</Text>

            {/* Accomplishment Race */}
            {type === 'accomplishment_race' && (
              <>
                <Text style={cs.configLabel}>TARGET ACCOMPLISHMENTS</Text>
                <Text style={cs.configSub}>First parent to log this many accomplishments for their child wins</Text>
                <ChipRow
                  options={[
                    { label: '5',  value: 5  },
                    { label: '10', value: 10 },
                    { label: '15', value: 15 },
                    { label: '20', value: 20 },
                  ]}
                  selected={config.target}
                  onSelect={v => setConfigKey('target', v)}
                />
                <Text style={[cs.configLabel, { marginTop: 24 }]}>DURATION</Text>
                <ChipRow
                  options={[
                    { label: '3 days', value: 3 },
                    { label: '7 days', value: 7 },
                  ]}
                  selected={config.duration_days}
                  onSelect={v => setConfigKey('duration_days', v)}
                />
              </>
            )}

            {/* Streak Challenge */}
            {type === 'streak' && (
              <>
                <Text style={cs.configLabel}>STREAK CATEGORY</Text>
                <Text style={cs.configSub}>Both must complete this daily — first to miss a day loses</Text>
                {STREAK_CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat.key}
                    style={[cs.catCard, config.category === cat.key && cs.catCardActive]}
                    onPress={() => setConfigKey('category', cat.key)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={cat.icon} size={18} color={config.category === cat.key ? '#2E7D62' : '#9CA3AF'} />
                    <Text style={[cs.catLabel, config.category === cat.key && { color: '#2E7D62' }]}>{cat.label}</Text>
                    {config.category === cat.key && <Ionicons name="checkmark-circle" size={18} color="#2E7D62" />}
                  </TouchableOpacity>
                ))}
                <Text style={[cs.configLabel, { marginTop: 24 }]}>STREAK LENGTH</Text>
                <ChipRow
                  options={[
                    { label: '3 days', value: 3 },
                    { label: '5 days', value: 5 },
                    { label: '7 days', value: 7 },
                  ]}
                  selected={config.duration_days}
                  onSelect={v => setConfigKey('duration_days', v)}
                />
              </>
            )}

            {/* Category Blitz */}
            {type === 'category_blitz' && (
              <>
                <Text style={cs.configLabel}>CATEGORY</Text>
                <Text style={cs.configSub}>Most completions in this category wins</Text>
                {BLITZ_CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat.key}
                    style={[cs.catCard, config.category === cat.key && cs.catCardActive]}
                    onPress={() => setConfigKey('category', cat.key)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={cat.icon} size={18} color={config.category === cat.key ? '#6366F1' : '#9CA3AF'} />
                    <Text style={[cs.catLabel, config.category === cat.key && { color: '#6366F1' }]}>{cat.label}</Text>
                    {config.category === cat.key && <Ionicons name="checkmark-circle" size={18} color="#6366F1" />}
                  </TouchableOpacity>
                ))}
                <Text style={[cs.configLabel, { marginTop: 24 }]}>TIME WINDOW</Text>
                <ChipRow
                  options={[
                    { label: '24 hours', value: 24 },
                    { label: '48 hours', value: 48 },
                    { label: '72 hours', value: 72 },
                  ]}
                  selected={config.duration_hours}
                  onSelect={v => setConfigKey('duration_hours', v)}
                />
              </>
            )}

            {/* Family Goal Sprint */}
            {type === 'goal_sprint' && (
              <>
                <Text style={cs.configLabel}>PICK A FAMILY GOAL</Text>
                <Text style={cs.configSub}>Race to complete this goal the most times</Text>
                {goals.length === 0 ? (
                  <View style={cs.emptyGoals}>
                    <Text style={cs.emptyGoalsText}>No family goals yet. Add one from the Family dashboard first.</Text>
                  </View>
                ) : goals.map(g => (
                  <TouchableOpacity
                    key={g.id}
                    style={[cs.catCard, config.goal_id === g.id && cs.catCardActive]}
                    onPress={() => { setConfigKey('goal_id', g.id); setConfigKey('goal_label', g.title); }}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontSize: 20 }}>{getGoalEmoji(g)}</Text>
                    <Text style={[cs.catLabel, config.goal_id === g.id && { color: '#EC4899' }]}>{g.title}</Text>
                    {config.goal_id === g.id && <Ionicons name="checkmark-circle" size={18} color="#EC4899" />}
                  </TouchableOpacity>
                ))}
                <Text style={[cs.configLabel, { marginTop: 24 }]}>TARGET COMPLETIONS</Text>
                <ChipRow
                  options={[
                    { label: '3×',  value: 3  },
                    { label: '5×',  value: 5  },
                    { label: '7×',  value: 7  },
                    { label: '10×', value: 10 },
                  ]}
                  selected={config.target}
                  onSelect={v => setConfigKey('target', v)}
                />
                <Text style={[cs.configLabel, { marginTop: 24 }]}>DURATION</Text>
                <ChipRow
                  options={[
                    { label: '3 days', value: 3 },
                    { label: '7 days', value: 7 },
                  ]}
                  selected={config.duration_days}
                  onSelect={v => setConfigKey('duration_days', v)}
                />
              </>
            )}
          </ScrollView>
        )}

        {/* ── Step 3: Review & Send ── */}
        {step === 3 && (
          <ScrollView contentContainerStyle={cs.scroll}>
            <Text style={cs.stepTitle}>Ready to send?</Text>
            <Text style={cs.stepSub}>
              {partner?.name?.split(' ')[0] ?? 'Your partner'} will get a notification to accept the challenge.
            </Text>
            <View style={cs.reviewCard}>
              <Text style={cs.reviewEmoji}>{challengeType?.emoji}</Text>
              <Text style={cs.reviewType}>{challengeType?.label}</Text>
              <Text style={cs.reviewDesc}>{challengeDescription(type, config, goals)}</Text>
            </View>
            {!partner && (
              <View style={cs.noPartnerCard}>
                <Ionicons name="warning-outline" size={18} color="#F59E0B" />
                <Text style={cs.noPartnerText}>No partner linked yet. Sync first to challenge someone.</Text>
              </View>
            )}
          </ScrollView>
        )}

        {/* Footer */}
        <View style={[cs.footer, { paddingBottom: insets.bottom + 12 }]}>
          {step === 1 && (
            <TouchableOpacity
              style={[cs.btn, !type && { opacity: 0.4 }]}
              onPress={() => setStep(2)}
              disabled={!type}
              activeOpacity={0.85}
            >
              <Text style={cs.btnText}>Next</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          )}
          {step === 2 && (
            <TouchableOpacity
              style={[cs.btn, !configIsValid() && { opacity: 0.4 }]}
              onPress={() => setStep(3)}
              disabled={!configIsValid()}
              activeOpacity={0.85}
            >
              <Text style={cs.btnText}>Review</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          )}
          {step === 3 && (
            <TouchableOpacity
              style={[cs.btn, (saving || !partner) && { opacity: 0.5 }]}
              onPress={sendChallenge}
              disabled={saving || !partner}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color="#FFFFFF" size="small" />
                : <><Text style={cs.btnText}>Send Challenge 🏆</Text></>
              }
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Helper ─────────────────────────────────────────────────────────────────────

function challengeDescription(type, config, goals) {
  if (type === 'accomplishment_race') {
    return `First to log ${config.target} accomplishments for your child in ${config.duration_days} days wins.`;
  }
  if (type === 'streak') {
    const cat = STREAK_CATEGORIES.find(c => c.key === config.category)?.label ?? config.category;
    return `Both keep up ${cat} every day for ${config.duration_days} days. First to miss a day loses.`;
  }
  if (type === 'category_blitz') {
    const cat = BLITZ_CATEGORIES.find(c => c.key === config.category)?.label ?? config.category;
    return `Most ${cat} completions in ${config.duration_hours} hours wins.`;
  }
  if (type === 'goal_sprint') {
    const goal = goals.find(g => g.id === config.goal_id);
    const label = goal?.title ?? config.goal_label ?? 'the family goal';
    return `Race to complete "${label}" ${config.target} times in ${config.duration_days} days.`;
  }
  return '';
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const cs = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: '#FFFFFF' },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  backBtn:     { width: 32, height: 32, justifyContent: 'center' },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A2E', marginBottom: 6 },
  stepDots:    { flexDirection: 'row', gap: 6 },
  dot:         { width: 6, height: 6, borderRadius: 3, backgroundColor: '#E5E7EB' },
  dotActive:   { backgroundColor: '#1B3D2F' },

  scroll:      { padding: 24, paddingBottom: 32, gap: 12 },
  stepTitle:   { fontSize: 22, fontWeight: '800', color: '#1A1A2E', marginBottom: 4 },
  stepSub:     { fontSize: 14, color: '#6B7280', lineHeight: 21, marginBottom: 8 },

  typeCard:    { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#F9FAFB', borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: '#F0F0F0' },
  typeEmoji:   { fontSize: 28, width: 40, textAlign: 'center' },
  typeLabel:   { fontSize: 15, fontWeight: '700', color: '#1A1A2E', marginBottom: 3 },
  typeDesc:    { fontSize: 12, color: '#6B7280', lineHeight: 17 },

  typeBadge:      { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', borderRadius: 100, paddingHorizontal: 14, paddingVertical: 7, marginBottom: 8 },
  typeBadgeEmoji: { fontSize: 16 },
  typeBadgeLabel: { fontSize: 13, fontWeight: '700' },

  configLabel: { fontSize: 11, fontWeight: '800', color: '#9CA3AF', letterSpacing: 1, marginBottom: 6, marginTop: 4 },
  configSub:   { fontSize: 13, color: '#6B7280', marginBottom: 12, lineHeight: 19 },

  chipRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip:        { borderRadius: 100, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: '#E5E7EB' },
  chipActive:  { backgroundColor: '#EDF7F2', borderColor: '#2E7D62' },
  chipText:    { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  chipTextActive: { color: '#1B3D2F' },

  catCard:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F9FAFB', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#F0F0F0' },
  catCardActive: { backgroundColor: '#F0FDF4', borderColor: '#2E7D62' },
  catLabel:    { flex: 1, fontSize: 14, fontWeight: '600', color: '#1A1A2E' },

  emptyGoals:     { backgroundColor: '#FEF9EE', borderRadius: 12, padding: 16 },
  emptyGoalsText: { fontSize: 13, color: '#9CA3AF', textAlign: 'center' },

  reviewCard:  { backgroundColor: '#1B3D2F', borderRadius: 20, padding: 24, alignItems: 'center', gap: 8 },
  reviewEmoji: { fontSize: 48, marginBottom: 4 },
  reviewType:  { fontSize: 20, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },
  reviewDesc:  { fontSize: 14, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 22 },

  noPartnerCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FEF9EE', borderRadius: 12, padding: 14, marginTop: 8 },
  noPartnerText: { flex: 1, fontSize: 13, color: '#9CA3AF', lineHeight: 18 },

  footer:      { padding: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  btn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1B3D2F', borderRadius: 14, paddingVertical: 16 },
  btnText:     { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
