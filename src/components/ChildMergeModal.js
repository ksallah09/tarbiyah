import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { mergeGardenData } from '../utils/childMerge';

const NONE_SENTINEL = { id: '__none__', name: 'None of these' };

export default function ChildMergeModal({ visible, localChildren, partnerChildren, partnerName, sharedFamilyId, onDone }) {
  const [matches, setMatches]       = useState({});
  const [saving, setSaving]         = useState(false);
  const [pickerFor, setPickerFor]   = useState(null); // localChildId being picked for

  const matchedCanonicalIds = new Set(
    Object.values(matches).filter(m => m && m.id !== '__none__').map(c => c.id)
  );

  function selectMatch(localId, canonicalChild) {
    setMatches(prev => ({ ...prev, [localId]: canonicalChild }));
    setPickerFor(null);
  }

  async function handleConfirm() {
    setSaving(true);
    try {
      const matchArray = localChildren.map(child => ({
        localChild:     child,
        canonicalChild: (matches[child.id]?.id === '__none__') ? null : matches[child.id] ?? null,
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
      "You can always do this later, but your accomplishment history won't be shared until children are matched.",
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
          <Text style={s.title}>Match Your Children</Text>
          <Text style={s.subtitle}>
            Link each of your children to {partnerFirst}'s so your Accomplishment Gardens are combined.
          </Text>
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {localChildren.map(local => {
            const matched = matches[local.id];
            return (
              <View key={local.id} style={s.pairCard}>
                {/* Labels */}
                <View style={s.pairLabelsRow}>
                  <Text style={s.pairLabel}>YOUR CHILD</Text>
                  <View style={{ flex: 1 }} />
                  <Text style={s.pairLabel}>{partnerFirst.toUpperCase()}'S CHILD</Text>
                </View>

                {/* Children row */}
                <View style={s.pairRow}>
                  {/* Your child */}
                  <View style={[s.yourChildChip, { backgroundColor: (local.color ?? '#2E7D62') + '18' }]}>
                    <Text style={[s.yourChildName, { color: local.color ?? '#2E7D62' }]}>{local.name}</Text>
                  </View>

                  {/* Arrow */}
                  <View style={s.arrowWrap}>
                    <Ionicons name="swap-horizontal" size={18} color={matched ? '#2E7D62' : '#D1D5DB'} />
                  </View>

                  {/* Partner child selector */}
                  <TouchableOpacity
                    style={[s.partnerSelector, matched && matched.id !== '__none__' && s.partnerSelectorMatched, matched?.id === '__none__' && s.partnerSelectorNone]}
                    onPress={() => setPickerFor(pickerFor === local.id ? null : local.id)}
                    activeOpacity={0.8}
                  >
                    {matched && matched.id !== '__none__' ? (
                      <>
                        <Ionicons name="checkmark-circle" size={14} color="#2E7D62" />
                        <Text style={s.partnerSelectorMatchedText} numberOfLines={1}>{matched.name}</Text>
                      </>
                    ) : matched?.id === '__none__' ? (
                      <>
                        <Ionicons name="close-circle" size={14} color="#9CA3AF" />
                        <Text style={[s.partnerSelectorMatchedText, { color: '#6B7280' }]} numberOfLines={1}>None of these</Text>
                      </>
                    ) : (
                      <>
                        <Text style={s.partnerSelectorPlaceholder}>Select…</Text>
                        <Ionicons name="chevron-down" size={14} color="#9CA3AF" />
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Inline picker */}
                {pickerFor === local.id && (
                  <View style={s.picker}>
                    {partnerChildren.map(partner => {
                      const takenByOther = matchedCanonicalIds.has(partner.id) && matches[local.id]?.id !== partner.id;
                      return (
                        <TouchableOpacity
                          key={partner.id}
                          style={[s.pickerOption, takenByOther && { opacity: 0.35 }]}
                          onPress={() => !takenByOther && selectMatch(local.id, partner)}
                          disabled={takenByOther}
                          activeOpacity={0.75}
                        >
                          <Text style={s.pickerOptionText}>{partner.name}</Text>
                          {takenByOther && <Text style={s.pickerOptionTaken}>already matched</Text>}
                        </TouchableOpacity>
                      );
                    })}
                    <TouchableOpacity
                      style={[s.pickerOption, s.pickerOptionSeparate]}
                      onPress={() => selectMatch(local.id, NONE_SENTINEL)}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="close-circle-outline" size={14} color="#9CA3AF" />
                      <Text style={[s.pickerOptionText, { color: '#9CA3AF' }]}>None of these</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}

          <View style={s.infoCard}>
            <Ionicons name="information-circle-outline" size={16} color="#6B7280" />
            <View style={{ flex: 1, gap: 8 }}>
              <Text style={s.infoText}>
                Matching children combines their Accomplishment Garden history. {partnerFirst}'s settings and rewards are kept if they've already been set.
              </Text>
              <Text style={s.infoText}>
                Only children already added to each parent's app will appear above.
              </Text>
            </View>
          </View>

        </ScrollView>

        {/* Footer */}
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
  container:                { flex: 1, backgroundColor: '#F9FAFB' },
  header:                   { padding: 24, paddingBottom: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  title:                    { fontSize: 20, fontWeight: '800', color: '#1A1A2E', marginBottom: 6 },
  subtitle:                 { fontSize: 14, color: '#6B7280', lineHeight: 20 },
  scroll:                   { padding: 16, paddingBottom: 8, gap: 12 },

  pairCard:                 { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F0F0F0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  pairLabelsRow:            { flexDirection: 'row', marginBottom: 10 },
  pairLabel:                { fontSize: 10, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1 },
  pairRow:                  { flexDirection: 'row', alignItems: 'center', gap: 10 },

  yourChildChip:            { flex: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center' },
  yourChildName:            { fontSize: 14, fontWeight: '800', textAlign: 'center' },

  arrowWrap:                { alignItems: 'center', justifyContent: 'center' },

  partnerSelector:          { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E5E7EB' },
  partnerSelectorMatched:   { backgroundColor: '#EDF7F2', borderColor: '#2E7D62' },
  partnerSelectorNone:      { backgroundColor: '#F9FAFB', borderColor: '#D1D5DB' },
  partnerSelectorPlaceholder: { flex: 1, fontSize: 14, color: '#9CA3AF', fontWeight: '500' },
  partnerSelectorMatchedText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#2E7D62' },

  picker:                   { marginTop: 12, borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: 10, gap: 2 },
  pickerOption:             { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 4 },
  pickerOptionSeparate:     { borderTopWidth: 1, borderTopColor: '#F5F5F5', marginTop: 4, paddingTop: 12 },
  pickerOptionText:         { fontSize: 14, fontWeight: '600', color: '#374151', flex: 1 },
  pickerOptionTaken:        { fontSize: 11, color: '#9CA3AF' },

  infoCard:                 { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#F0F0F0' },
  infoText:                 { flex: 1, fontSize: 12, color: '#6B7280', lineHeight: 18 },

  footer:                   { flexDirection: 'row', gap: 10, padding: 20, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  skipBtn:                  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB' },
  skipBtnText:              { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  confirmBtn:               { flex: 2, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: '#1B3D2F' },
  confirmBtnText:           { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
