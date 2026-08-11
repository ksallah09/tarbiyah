import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getAllChildProfiles } from '../utils/childProfiles';
import { getFamilyId } from '../utils/familyGoals';
import { supabase } from '../utils/supabase';

const DEFAULT_THRESHOLDS = { sprout: 5, sapling: 10, tree: 20, flowering: 35, fruit: 50 };

const STAGE_KEYS = [
  { key: 'sprout',     label: 'Sprout'             },
  { key: 'sapling',   label: 'Young Tree'          },
  { key: 'tree',      label: 'Growing Tree'        },
  { key: 'flowering', label: 'Flowering Tree'      },
  { key: 'fruit',     label: 'Fruit-bearing Tree'  },
];

export default function GardenTreeWizardScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [step,          setStep]          = useState(1);
  const [children,      setChildren]      = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [thresholds,    setThresholds]    = useState({ ...DEFAULT_THRESHOLDS });
  const [rewards,       setRewards]       = useState({});
  const [saving,        setSaving]        = useState(false);

  useEffect(() => {
    getAllChildProfiles().then(setChildren);
  }, []);

  async function advanceToStep2() {
    if (!selectedChild) return;
    setStep(2);
  }

  async function handleCreate() {
    const t = thresholds;
    if (t.sprout >= t.sapling || t.sapling >= t.tree || t.tree >= t.flowering || t.flowering >= t.fruit) {
      Alert.alert('Invalid settings', 'Each stage must require more accomplishments than the previous one.');
      return;
    }
    setSaving(true);
    try {
      const familyId = await getFamilyId();
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      await supabase.from('family_trees').upsert({
        family_id:  familyId,
        child_id:   selectedChild.id,
        child_name: selectedChild.name,
        created_by: userId,
        thresholds,
        rewards,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'child_id' });
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Could not create tree. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const displayName = selectedChild?.name?.split(' ')[0] ?? '';

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => step > 1 ? setStep(step - 1) : navigation.goBack()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={22} color="#1A1A2E" />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={s.headerTitle}>Add an Accomplishment Tree</Text>
            <View style={s.stepDots}>
              {[1, 2].map(n => (
                <View key={n} style={[s.dot, step >= n && s.dotActive]} />
              ))}
            </View>
          </View>
          <View style={{ width: 32 }} />
        </View>

        {/* ── Step 1: Choose child ── */}
        {step === 1 && (
          <ScrollView contentContainerStyle={s.scroll}>
            <Text style={s.stepTitle}>Which child is this tree for?</Text>
            <Text style={s.stepSub}>Select one of your children to start growing their Accomplishment Tree.</Text>
            {children.length === 0 && (
              <View style={s.emptyCard}>
                <Text style={s.emptyText}>No children added yet. Add a child from the Configure tab in Family first.</Text>
              </View>
            )}
            {children.map(child => {
              const selected = selectedChild?.id === child.id;
              return (
                <TouchableOpacity
                  key={child.id}
                  style={[s.childCard, selected && s.childCardSelected]}
                  onPress={() => setSelectedChild(child)}
                  activeOpacity={0.8}
                >
                  <View style={[s.childColorDot, { backgroundColor: child.color ?? '#2E7D62' }]} />
                  <Text style={[s.childCardName, selected && { color: '#2E7D62' }]}>{child.name}</Text>
                  {selected && <Ionicons name="checkmark-circle" size={20} color="#2E7D62" />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* ── Step 2: Configure ── */}
        {step === 2 && (
          <ScrollView contentContainerStyle={s.scroll}>
            <Text style={s.stepTitle}>Set up {displayName}'s tree</Text>
            <Text style={s.stepSub}>How many accomplishments does it take to reach each growth stage?</Text>

            <Text style={s.sectionLabel}>ACCOMPLISHMENTS PER STAGE</Text>
            {STAGE_KEYS.map((sk, i) => (
              <View key={sk.key} style={s.settingsRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.settingsRowLabel}>{sk.label}</Text>
                  {i > 0 && (
                    <Text style={s.settingsRowSub}>More than {thresholds[STAGE_KEYS[i - 1].key] || '—'}</Text>
                  )}
                </View>
                <TextInput
                  style={s.numInput}
                  keyboardType="number-pad"
                  value={String(thresholds[sk.key] ?? '')}
                  onChangeText={v => setThresholds(prev => ({ ...prev, [sk.key]: parseInt(v) || 0 }))}
                  maxLength={4}
                />
                <Text style={s.numUnit}>accomplishments</Text>
              </View>
            ))}

            <Text style={[s.sectionLabel, { marginTop: 28 }]}>MILESTONE REWARDS (OPTIONAL)</Text>
            <Text style={s.stepSub}>What will you celebrate when {displayName} reaches each stage?</Text>
            {STAGE_KEYS.map(sk => (
              <View key={sk.key} style={s.rewardRow}>
                <Text style={s.settingsRowLabel}>{sk.label}</Text>
                <TextInput
                  style={s.rewardInput}
                  placeholder={`e.g. "Trip to the park"`}
                  placeholderTextColor="#9CA3AF"
                  value={rewards[sk.key] ?? ''}
                  onChangeText={v => setRewards(prev => ({ ...prev, [sk.key]: v }))}
                  maxLength={80}
                />
              </View>
            ))}
          </ScrollView>
        )}

        {/* Footer CTA */}
        <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
          {step === 1 && (
            <TouchableOpacity style={[s.btn, !selectedChild && { opacity: 0.4 }]} onPress={advanceToStep2} disabled={!selectedChild} activeOpacity={0.85}>
              <Text style={s.btnText}>Next</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          )}
          {step === 2 && (
            <TouchableOpacity style={[s.btn, saving && { opacity: 0.6 }]} onPress={handleCreate} disabled={saving} activeOpacity={0.85}>
              {saving
                ? <ActivityIndicator color="#FFFFFF" size="small" />
                : <><Text style={s.btnText}>Add Tree 🌱</Text></>
              }
            </TouchableOpacity>
          )}
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: '#FFFFFF' },
  header:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  backBtn:          { width: 32, height: 32, justifyContent: 'center' },
  headerTitle:      { fontSize: 15, fontWeight: '700', color: '#1A1A2E', marginBottom: 6 },
  stepDots:         { flexDirection: 'row', gap: 6 },
  dot:              { width: 6, height: 6, borderRadius: 3, backgroundColor: '#E5E7EB' },
  dotActive:        { backgroundColor: '#2E7D62' },

  scroll:           { padding: 24, paddingBottom: 32, gap: 12 },
  stepTitle:        { fontSize: 22, fontWeight: '800', color: '#1A1A2E', marginBottom: 4 },
  stepSub:          { fontSize: 14, color: '#6B7280', lineHeight: 21, marginBottom: 8 },
  emptyCard:        { backgroundColor: '#F9FAFB', borderRadius: 14, padding: 20, alignItems: 'center' },
  emptyText:        { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },

  childCard:        { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#F9FAFB', borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: '#F0F0F0' },
  childCardSelected:{ backgroundColor: '#EDF7F2', borderColor: '#2E7D62' },
  childColorDot:    { width: 12, height: 12, borderRadius: 6 },
  childCardName:    { flex: 1, fontSize: 16, fontWeight: '700', color: '#1A1A2E' },

  sectionLabel:     { fontSize: 11, fontWeight: '800', color: '#9CA3AF', letterSpacing: 1, marginTop: 4 },
  settingsRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  settingsRowLabel: { fontSize: 14, fontWeight: '600', color: '#1A1A2E' },
  settingsRowSub:   { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  numInput:         { backgroundColor: '#F9FAFB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, fontWeight: '700', color: '#1A1A2E', borderWidth: 1, borderColor: '#E5E7EB', width: 64, textAlign: 'center' },
  numUnit:          { fontSize: 12, color: '#9CA3AF' },
  rewardRow:        { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  rewardInput:      { marginTop: 6, backgroundColor: '#F9FAFB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#1A1A2E', borderWidth: 1, borderColor: '#E5E7EB' },

  treeCard:         { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#F9FAFB', borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: '#E5E7EB' },
  treeCardLinked:   { backgroundColor: '#EDF7F2', borderColor: '#2E7D62' },
  treeName:         { fontSize: 15, fontWeight: '700', color: '#1A1A2E', marginBottom: 3 },
  treeMeta:         { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  linkCheck:        { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#F0F0F0' },
  linkCheckActive:  { backgroundColor: '#2E7D62' },
  linkCheckText:    { fontSize: 12, fontWeight: '600', color: '#6B7280' },

  footer:           { padding: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  btn:              { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1B3D2F', borderRadius: 14, paddingVertical: 16 },
  btnText:          { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
