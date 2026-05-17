import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, Alert, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MannerGarden from '../components/MannerGarden';
import { getCachedSyncStatus } from '../utils/familySync';
import { getAllChildProfiles } from '../utils/childProfiles';
import { getFamilyId } from '../utils/familyGoals';
import { supabase } from '../utils/supabase';

const DEFAULT_THRESHOLDS = { sprout: 10, sapling: 25, tree: 50, flowering: 100, fruit: 200 };

const STAGE_KEYS = [
  { key: 'sprout',     label: 'Sprout'             },
  { key: 'sapling',   label: 'Young Tree'          },
  { key: 'tree',      label: 'Growing Tree'        },
  { key: 'flowering', label: 'Flowering Tree'      },
  { key: 'fruit',     label: 'Fruit-bearing Tree'  },
];

export default function GardenDetailScreen({ route, navigation }) {
  const { tree } = route.params;

  const [myProfileName,    setMyProfileName]    = useState('');
  const [partnerLinked,    setPartnerLinked]     = useState(false);
  const [childColor,       setChildColor]        = useState(tree.child_color ?? null);
  const [showSettings,     setShowSettings]      = useState(false);
  const [draftThresholds,  setDraftThresholds]   = useState({ ...DEFAULT_THRESHOLDS, ...(tree.thresholds ?? {}) });
  const [draftRewards,     setDraftRewards]      = useState(tree.rewards ?? {});
  const [saving,           setSaving]            = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('tarbiyah_profile').then(raw => {
      if (raw) setMyProfileName(JSON.parse(raw).name?.split(' ')[0] ?? '');
    });
    getCachedSyncStatus().then(s => setPartnerLinked(!!s?.linked));
    getAllChildProfiles().then(profiles => {
      const match = profiles.find(p => p.id === tree.child_id);
      if (match?.color) setChildColor(match.color);
    });
  }, []);

  async function saveSettings() {
    const t = draftThresholds;
    if (t.sprout >= t.sapling || t.sapling >= t.tree || t.tree >= t.flowering || t.flowering >= t.fruit) {
      Alert.alert('Invalid settings', 'Each stage must require more deeds than the previous one.');
      return;
    }
    setSaving(true);
    try {
      await supabase
        .from('family_trees')
        .update({ thresholds: draftThresholds, rewards: draftRewards, updated_at: new Date().toISOString() })
        .eq('child_id', tree.child_id);
      setShowSettings(false);
    } catch {
      Alert.alert('Error', 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  }

  const child = {
    id:     tree.child_id,
    name:   tree.child_name,
    gender: tree.child_gender ?? null,
    color:  childColor,
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={22} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{tree.child_name}'s Garden</Text>
        <TouchableOpacity onPress={() => setShowSettings(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="settings-outline" size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <MannerGarden
          child={child}
          myProfileName={myProfileName}
          partnerLinked={partnerLinked}
          linkedChildId={tree.linked_tree_id ?? null}
        />
      </ScrollView>

      {/* ── Settings modal ── */}
      <Modal visible={showSettings} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowSettings(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalContainer}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>Tree Settings</Text>
                <Text style={s.modalSub}>{tree.child_name}'s Good Deeds Tree</Text>
              </View>
              <TouchableOpacity onPress={() => setShowSettings(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={s.modalScroll} showsVerticalScrollIndicator={false}>
              <Text style={s.sectionLabel}>DEEDS PER STAGE</Text>
              {STAGE_KEYS.map((sk, i) => (
                <View key={sk.key} style={s.settingsRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.settingsRowLabel}>{sk.label}</Text>
                    {i > 0 && (
                      <Text style={s.settingsRowSub}>More than {draftThresholds[STAGE_KEYS[i - 1].key] || '—'}</Text>
                    )}
                  </View>
                  <TextInput
                    style={s.numInput}
                    keyboardType="number-pad"
                    value={String(draftThresholds[sk.key] ?? '')}
                    onChangeText={v => setDraftThresholds(prev => ({ ...prev, [sk.key]: parseInt(v) || 0 }))}
                    maxLength={4}
                  />
                  <Text style={s.numUnit}>deeds</Text>
                </View>
              ))}

              <Text style={[s.sectionLabel, { marginTop: 28 }]}>MILESTONE REWARDS</Text>
              {STAGE_KEYS.map(sk => (
                <View key={sk.key} style={s.rewardRow}>
                  <Text style={s.settingsRowLabel}>{sk.label}</Text>
                  <TextInput
                    style={s.rewardInput}
                    placeholder={`e.g. "Trip to the park"`}
                    placeholderTextColor="#9CA3AF"
                    value={draftRewards[sk.key] ?? ''}
                    onChangeText={v => setDraftRewards(prev => ({ ...prev, [sk.key]: v }))}
                    maxLength={80}
                  />
                </View>
              ))}

              <Text style={[s.sectionLabel, { marginTop: 28 }]}>ORCHARD & JANNAH REWARDS</Text>
              {[
                { key: 'orchard', label: 'Orchard complete 🌿', placeholder: 'e.g. "Family dinner out"' },
                { key: 'jannah',  label: 'Jannah Garden 🌴',    placeholder: 'e.g. "Special family trip"' },
              ].map(({ key, label, placeholder }) => (
                <View key={key} style={s.rewardRow}>
                  <Text style={s.settingsRowLabel}>{label}</Text>
                  <TextInput
                    style={s.rewardInput}
                    placeholder={placeholder}
                    placeholderTextColor="#9CA3AF"
                    value={draftRewards[key] ?? ''}
                    onChangeText={v => setDraftRewards(prev => ({ ...prev, [key]: v }))}
                    maxLength={80}
                  />
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.5 }]} onPress={saveSettings} disabled={saving} activeOpacity={0.85}>
              {saving
                ? <ActivityIndicator color="#FFFFFF" size="small" />
                : <Text style={s.saveBtnText}>Save Settings</Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: '#F5F5F5' },
  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  headerTitle:      { fontSize: 16, fontWeight: '800', color: '#1A1A2E' },
  scroll:           { padding: 16, paddingBottom: 48 },

  modalContainer:   { flex: 1, backgroundColor: '#FFFFFF' },
  modalHeader:      { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  modalTitle:       { fontSize: 18, fontWeight: '800', color: '#1A1A2E', marginBottom: 2 },
  modalSub:         { fontSize: 13, color: '#9CA3AF' },
  modalScroll:      { padding: 20, paddingBottom: 8, gap: 0 },

  sectionLabel:     { fontSize: 11, fontWeight: '800', color: '#9CA3AF', letterSpacing: 1, marginBottom: 8 },
  settingsRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  settingsRowLabel: { fontSize: 14, fontWeight: '600', color: '#1A1A2E' },
  settingsRowSub:   { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  numInput:         { backgroundColor: '#F9FAFB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, fontWeight: '700', color: '#1A1A2E', borderWidth: 1, borderColor: '#E5E7EB', width: 64, textAlign: 'center' },
  numUnit:          { fontSize: 12, color: '#9CA3AF' },
  rewardRow:        { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  rewardInput:      { marginTop: 6, backgroundColor: '#F9FAFB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#1A1A2E', borderWidth: 1, borderColor: '#E5E7EB' },

  saveBtn:          { margin: 20, marginTop: 12, backgroundColor: '#1B3D2F', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  saveBtnText:      { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
