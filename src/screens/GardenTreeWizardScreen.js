import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getAllChildProfiles } from '../utils/childProfiles';
import { getFamilyId } from '../utils/familyGoals';
import { getCachedSyncStatus } from '../utils/familySync';
import { supabase } from '../utils/supabase';

const DEFAULT_THRESHOLDS = { sprout: 10, sapling: 25, tree: 50, flowering: 100, fruit: 200 };

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
  const [existingTrees, setExistingTrees] = useState([]);
  const [linkedTreeId,  setLinkedTreeId]  = useState(null);
  const [saving,        setSaving]        = useState(false);
  const [myUserId,      setMyUserId]      = useState(null);
  const [partnerName,   setPartnerName]   = useState('Your partner');
  const [loadingTrees,  setLoadingTrees]  = useState(false);
  const [gardenTotals,  setGardenTotals]  = useState({});

  useEffect(() => {
    getAllChildProfiles().then(setChildren);
    supabase.auth.getSession().then(({ data }) => setMyUserId(data?.session?.user?.id));
    getCachedSyncStatus().then(s => {
      if (s?.partner?.name) setPartnerName(s.partner.name.split(' ')[0]);
    });
  }, []);

  async function advanceToStep2() {
    if (!selectedChild) return;
    try {
      const { data, error } = await supabase
        .from('family_trees')
        .select('child_id, linked_tree_id')
        .eq('child_id', selectedChild.id)
        .maybeSingle();

      console.log('[Wizard] existing row for', selectedChild.id, '→', JSON.stringify(data), 'err:', error?.message);

      if (data) {
        if (data.linked_tree_id) {
          // Linked row — check whether the canonical tree it points to still exists
          const { data: canonical, error: canonErr } = await supabase
            .from('family_trees')
            .select('child_id')
            .eq('child_id', data.linked_tree_id)
            .maybeSingle();

          console.log('[Wizard] canonical check for', data.linked_tree_id, '→', JSON.stringify(canonical), 'err:', canonErr?.message);

          if (!canonical) {
            const { error: delErr } = await supabase.from('family_trees').delete().eq('child_id', selectedChild.id);
            console.log('[Wizard] deleted stale linked row, err:', delErr?.message);
            setStep(2);
            return;
          }
        } else {
          // Canonical row (no linked_tree_id) — check if it's orphaned (no deeds, or user explicitly wants to recreate)
          const { count } = await supabase
            .from('child_garden_actions')
            .select('id', { count: 'exact', head: true })
            .eq('child_id', selectedChild.id);

          console.log('[Wizard] canonical row deed count:', count);

          if (!count) {
            // No deeds — treat as stale, delete and proceed
            const { error: delErr } = await supabase.from('family_trees').delete().eq('child_id', selectedChild.id);
            console.log('[Wizard] deleted stale canonical row, err:', delErr?.message);
            if (!delErr) { setStep(2); return; }
          }
        }

        console.log('[Wizard] blocking — existing row has linked_tree_id:', data.linked_tree_id);
        Alert.alert(
          'Tree already exists',
          `${selectedChild.name.split(' ')[0]} already has a Good Deeds Tree. You can update it from the Family Garden.`,
          [{ text: 'OK' }]
        );
        return;
      }
    } catch (err) {
      console.error('[Wizard] advanceToStep2 error:', err);
    }
    setStep(2);
  }

  async function advanceToStep3() {
    const t = thresholds;
    if (t.sprout >= t.sapling || t.sapling >= t.tree || t.tree >= t.flowering || t.flowering >= t.fruit) {
      Alert.alert('Invalid settings', 'Each stage must require more deeds than the previous one.');
      return;
    }
    setLoadingTrees(true);
    try {
      const familyId = await getFamilyId();
      const [treesRes, actionsRes] = await Promise.all([
        supabase.from('family_trees').select('*').eq('family_id', familyId),
        supabase.from('child_garden_actions').select('child_id').eq('family_id', familyId),
      ]);
      const trees = (treesRes.data ?? []).filter(t => t.child_id !== selectedChild?.id);
      setExistingTrees(trees);
      const totals = {};
      (actionsRes.data ?? []).forEach(r => { totals[r.child_id] = (totals[r.child_id] ?? 0) + 1; });
      setGardenTotals(totals);
      if (trees.length === 0) {
        // No existing trees — skip step 3 and create directly
        await handleCreate(null);
      } else {
        setStep(3);
      }
    } catch {
      Alert.alert('Error', 'Could not load existing trees.');
    } finally {
      setLoadingTrees(false);
    }
  }

  async function handleCreate(linkTo) {
    setSaving(true);
    try {
      const familyId = await getFamilyId();
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      await supabase.from('family_trees').upsert({
        family_id:      familyId,
        child_id:       selectedChild.id,
        child_name:     selectedChild.name,
        created_by:     userId,
        thresholds,
        rewards,
        linked_tree_id: linkTo ?? null,
        updated_at:     new Date().toISOString(),
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
            <Text style={s.headerTitle}>Add a Good Deeds Tree</Text>
            <View style={s.stepDots}>
              {[1, 2, 3].map(n => (
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
            <Text style={s.stepSub}>Select one of your children to start growing their Good Deeds Tree.</Text>
            {children.length === 0 && (
              <View style={s.emptyCard}>
                <Text style={s.emptyText}>No children added yet. Add a child from your dashboard first.</Text>
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
            <Text style={s.stepSub}>How many good deeds does it take to reach each growth stage?</Text>

            <Text style={s.sectionLabel}>DEEDS PER STAGE</Text>
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
                <Text style={s.numUnit}>deeds</Text>
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

        {/* ── Step 3: Existing trees / merge ── */}
        {step === 3 && (
          <ScrollView contentContainerStyle={s.scroll}>
            <Text style={s.stepTitle}>Does {displayName} already have a tree?</Text>
            <Text style={s.stepSub}>
              Your family garden has {existingTrees.length} other tree{existingTrees.length !== 1 ? 's' : ''}.
              If {displayName} is the same child as one of them, link them to share progress.
            </Text>

            {existingTrees.map(tree => {
              const isLinked    = linkedTreeId === tree.child_id;
              const isYours     = tree.created_by === myUserId;
              const deeds       = gardenTotals[tree.child_id] ?? 0;
              return (
                <TouchableOpacity
                  key={tree.child_id}
                  style={[s.treeCard, isLinked && s.treeCardLinked]}
                  onPress={() => setLinkedTreeId(isLinked ? null : tree.child_id)}
                  activeOpacity={0.8}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[s.treeName, isLinked && { color: '#2E7D62' }]}>{tree.child_name}</Text>
                    <Text style={s.treeMeta}>
                      {isYours ? 'Added by you' : `Added by ${partnerName}`} · {deeds} deed{deeds !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View style={[s.linkCheck, isLinked && s.linkCheckActive]}>
                    {isLinked
                      ? <Ionicons name="git-merge-outline" size={16} color="#FFFFFF" />
                      : <Text style={s.linkCheckText}>Link</Text>
                    }
                  </View>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={[s.treeCard, !linkedTreeId && s.treeCardLinked, { borderStyle: 'dashed' }]}
              onPress={() => setLinkedTreeId(null)}
              activeOpacity={0.8}
            >
              <View style={{ flex: 1 }}>
                <Text style={[s.treeName, !linkedTreeId && { color: '#2E7D62' }]}>Start fresh</Text>
                <Text style={s.treeMeta}>Keep {displayName}'s tree separate</Text>
              </View>
              {!linkedTreeId && <Ionicons name="checkmark-circle" size={20} color="#2E7D62" />}
            </TouchableOpacity>
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
            <TouchableOpacity style={[s.btn, loadingTrees && { opacity: 0.6 }]} onPress={advanceToStep3} disabled={loadingTrees} activeOpacity={0.85}>
              {loadingTrees
                ? <ActivityIndicator color="#FFFFFF" size="small" />
                : <><Text style={s.btnText}>Next</Text><Ionicons name="arrow-forward" size={16} color="#FFFFFF" /></>
              }
            </TouchableOpacity>
          )}
          {step === 3 && (
            <TouchableOpacity style={[s.btn, saving && { opacity: 0.6 }]} onPress={() => handleCreate(linkedTreeId)} disabled={saving} activeOpacity={0.85}>
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
