import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { mergeGardenData } from '../utils/childMerge';

export default function ChildMergeModal({ visible, localChildren, partnerChildren, partnerName, sharedFamilyId, onDone }) {
  // matches: { [localChildId]: canonicalChild | null }
  const [matches, setMatches] = useState({});
  const [saving, setSaving] = useState(false);

  const matchedCanonicalIds = new Set(
    Object.values(matches).filter(Boolean).map(c => c.id)
  );

  function setMatch(localId, canonicalChild) {
    setMatches(prev => ({
      ...prev,
      [localId]: prev[localId]?.id === canonicalChild?.id ? null : canonicalChild,
    }));
  }

  async function handleConfirm() {
    setSaving(true);
    try {
      const matchArray = localChildren.map(child => ({
        localChild:    child,
        canonicalChild: matches[child.id] ?? null,
      }));
      await mergeGardenData(matchArray, sharedFamilyId);
      onDone();
    } catch {
      Alert.alert('Error', 'Could not complete the merge. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleSkip() {
    Alert.alert(
      'Skip for now?',
      "You can always do this later, but your good deeds history won't be shared until children are matched.",
      [
        { text: 'Go back', style: 'cancel' },
        { text: 'Skip', onPress: onDone },
      ]
    );
  }

  const partnerFirst = partnerName?.split(' ')[0] ?? 'Your partner';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleSkip}>
      <View style={s.container}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.title}>Match Your Children</Text>
            <Text style={s.subtitle}>
              Match your children to {partnerFirst}'s so your Good Deeds Gardens are shared.
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {localChildren.map(local => {
            const matched = matches[local.id];
            return (
              <View key={local.id} style={s.row}>
                {/* Your child */}
                <View style={[s.childBadge, { backgroundColor: (local.color ?? '#2E7D62') + '18' }]}>
                  <Text style={[s.childBadgeName, { color: local.color ?? '#2E7D62' }]}>
                    {local.name}
                  </Text>
                  <Text style={s.childBadgeYou}>you</Text>
                </View>

                <Ionicons name="arrow-forward" size={16} color="#9CA3AF" style={{ marginHorizontal: 4 }} />

                {/* Partner children options */}
                <View style={s.optionsCol}>
                  {partnerChildren.map(partner => {
                    const isSelected = matched?.id === partner.id;
                    const takenByOther = !isSelected && matchedCanonicalIds.has(partner.id);
                    return (
                      <TouchableOpacity
                        key={partner.id}
                        style={[
                          s.optionBtn,
                          isSelected && s.optionBtnSelected,
                          takenByOther && s.optionBtnDisabled,
                        ]}
                        onPress={() => !takenByOther && setMatch(local.id, partner)}
                        disabled={takenByOther}
                        activeOpacity={0.75}
                      >
                        <Text style={[
                          s.optionBtnText,
                          isSelected && s.optionBtnTextSelected,
                          takenByOther && { opacity: 0.4 },
                        ]}>
                          {partner.name}
                        </Text>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={14} color="#2E7D62" style={{ marginLeft: 4 }} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity
                    style={[s.optionBtn, s.optionBtnSeparate, !matched && s.optionBtnSeparateActive]}
                    onPress={() => setMatch(local.id, null)}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.optionBtnText, !matched && s.optionBtnTextSeparate]}>
                      Keep separate
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          <View style={s.infoCard}>
            <Ionicons name="information-circle-outline" size={16} color="#6B7280" />
            <Text style={s.infoText}>
              Matching children merges their Good Deeds Garden history. {partnerFirst}'s settings and rewards are kept if they've already been set.
            </Text>
          </View>
        </ScrollView>

        {/* Actions */}
        <View style={s.footer}>
          <TouchableOpacity style={s.skipBtn} onPress={handleSkip} activeOpacity={0.75}>
            <Text style={s.skipBtnText}>Skip for now</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.confirmBtn, saving && { opacity: 0.6 }]}
            onPress={handleConfirm}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#FFFFFF" size="small" />
              : <Text style={s.confirmBtnText}>Confirm & Merge</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container:              { flex: 1, backgroundColor: '#FFFFFF' },
  header:                 { padding: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  title:                  { fontSize: 20, fontWeight: '800', color: '#1A1A2E', marginBottom: 6 },
  subtitle:               { fontSize: 14, color: '#6B7280', lineHeight: 20 },
  scroll:                 { padding: 20, paddingBottom: 8, gap: 16 },

  row:                    { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  childBadge:             { borderRadius: 12, padding: 10, alignItems: 'center', minWidth: 76, justifyContent: 'center' },
  childBadgeName:         { fontSize: 13, fontWeight: '800', textAlign: 'center' },
  childBadgeYou:          { fontSize: 10, color: '#9CA3AF', fontWeight: '500', marginTop: 2 },

  optionsCol:             { flex: 1, gap: 6 },
  optionBtn:              { flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E5E7EB' },
  optionBtnSelected:      { backgroundColor: '#EDF7F2', borderColor: '#2E7D62' },
  optionBtnDisabled:      { backgroundColor: '#F9FAFB' },
  optionBtnSeparate:      { borderStyle: 'dashed' },
  optionBtnSeparateActive:{ backgroundColor: '#F9FAFB', borderColor: '#D1D5DB' },
  optionBtnText:          { fontSize: 13, fontWeight: '600', color: '#374151', flex: 1 },
  optionBtnTextSelected:  { color: '#2E7D62' },
  optionBtnTextSeparate:  { color: '#9CA3AF' },

  infoCard:               { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginTop: 4 },
  infoText:               { flex: 1, fontSize: 12, color: '#6B7280', lineHeight: 18 },

  footer:                 { flexDirection: 'row', gap: 10, padding: 20, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  skipBtn:                { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB' },
  skipBtnText:            { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  confirmBtn:             { flex: 2, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: '#1B3D2F' },
  confirmBtnText:         { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
