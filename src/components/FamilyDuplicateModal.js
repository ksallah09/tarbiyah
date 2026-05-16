import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { mergeDuplicateChildren } from '../utils/childMerge';

// children: [{ child_id, child_name, child_color, child_gender }]
// gardenTotals: { [child_id]: number }
export default function FamilyDuplicateModal({ visible, children, gardenTotals = {}, onDone }) {
  // pairs: { [duplicateChildId]: canonicalChild }
  const [pairs, setPairs]       = useState({});
  const [expanded, setExpanded] = useState(null); // which child's picker is open
  const [saving, setSaving]     = useState(false);

  const pairedAsCanonical = new Set(Object.values(pairs).map(c => c.child_id));
  const pairedAsDuplicate = new Set(Object.keys(pairs));

  function selectPair(duplicate, canonical) {
    setPairs(prev => ({ ...prev, [duplicate.child_id]: canonical }));
    setExpanded(null);
  }

  function clearPair(duplicateId) {
    setPairs(prev => { const next = { ...prev }; delete next[duplicateId]; return next; });
  }

  async function handleApply() {
    if (Object.keys(pairs).length === 0) { onDone(); return; }
    setSaving(true);
    try {
      for (const [duplicateId, canonical] of Object.entries(pairs)) {
        const duplicate = children.find(c => c.child_id === duplicateId);
        if (duplicate) await mergeDuplicateChildren(canonical, duplicate);
      }
      onDone();
    } catch {
      Alert.alert('Error', 'Could not apply merges. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const pendingCount = Object.keys(pairs).length;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onDone}>
      <View style={s.container}>
        <View style={s.header}>
          <View>
            <Text style={s.title}>Manage Children</Text>
            <Text style={s.subtitle}>Merge children added under different names by either parent.</Text>
          </View>
          <TouchableOpacity style={s.closeBtn} onPress={onDone} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={22} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {children.map(child => {
            const isPaired   = pairedAsDuplicate.has(child.child_id);
            const isCanonical = pairedAsCanonical.has(child.child_id);
            const matchedTo  = pairs[child.child_id];
            const isOpen     = expanded === child.child_id;
            const deeds      = gardenTotals[child.child_id] ?? 0;

            return (
              <View key={child.child_id}>
                <View style={[s.childRow, isPaired && s.childRowDuplicate]}>
                  {/* Child info */}
                  <View style={[s.childBadge, { backgroundColor: (child.child_color ?? '#2E7D62') + '18' }]}>
                    <Text style={[s.childName, { color: child.child_color ?? '#2E7D62' }]}>
                      {child.child_name}
                    </Text>
                    <Text style={s.childDeeds}>{deeds} deed{deeds !== 1 ? 's' : ''}</Text>
                  </View>

                  {/* Pair action */}
                  <View style={s.actionCol}>
                    {isPaired ? (
                      <View style={s.mergeTag}>
                        <Ionicons name="git-merge-outline" size={13} color="#2E7D62" />
                        <Text style={s.mergeTagText}>into {matchedTo.child_name}</Text>
                        <TouchableOpacity onPress={() => clearPair(child.child_id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                          <Ionicons name="close-circle" size={15} color="#9CA3AF" />
                        </TouchableOpacity>
                      </View>
                    ) : isCanonical ? (
                      <View style={s.keepTag}>
                        <Ionicons name="checkmark-circle-outline" size={13} color="#2E7D62" />
                        <Text style={s.keepTagText}>Keeping this one</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={s.mergeBtn}
                        onPress={() => setExpanded(isOpen ? null : child.child_id)}
                        activeOpacity={0.75}
                      >
                        <Text style={s.mergeBtnText}>Duplicate of…</Text>
                        <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={12} color="#6B7280" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Picker */}
                {isOpen && (
                  <View style={s.picker}>
                    {children
                      .filter(c => c.child_id !== child.child_id && !pairedAsDuplicate.has(c.child_id))
                      .map(option => (
                        <TouchableOpacity
                          key={option.child_id}
                          style={s.pickerOption}
                          onPress={() => selectPair(child, option)}
                          activeOpacity={0.75}
                        >
                          <View style={[s.pickerDot, { backgroundColor: option.child_color ?? '#2E7D62' }]} />
                          <Text style={s.pickerOptionText}>{option.child_name}</Text>
                          <Text style={s.pickerOptionDeeds}>{gardenTotals[option.child_id] ?? 0} deeds</Text>
                          <Ionicons name="chevron-forward" size={14} color="#9CA3AF" />
                        </TouchableOpacity>
                      ))}
                  </View>
                )}
              </View>
            );
          })}

          {pendingCount > 0 && (
            <View style={s.summaryCard}>
              <Ionicons name="information-circle-outline" size={15} color="#2E7D62" />
              <Text style={s.summaryText}>
                {pendingCount} merge{pendingCount !== 1 ? 's' : ''} queued. The merged child's deeds will be combined. Settings from the kept child take priority.
              </Text>
            </View>
          )}
        </ScrollView>

        <View style={s.footer}>
          <TouchableOpacity style={s.cancelBtn} onPress={onDone} activeOpacity={0.75}>
            <Text style={s.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.applyBtn, (saving || pendingCount === 0) && { opacity: 0.5 }]}
            onPress={handleApply}
            disabled={saving || pendingCount === 0}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#FFFFFF" size="small" />
              : <Text style={s.applyBtnText}>Apply {pendingCount > 0 ? `(${pendingCount})` : ''}</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#FFFFFF' },
  header:          { flexDirection: 'row', alignItems: 'flex-start', padding: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  title:           { fontSize: 20, fontWeight: '800', color: '#1A1A2E', marginBottom: 4, flex: 1 },
  subtitle:        { fontSize: 13, color: '#6B7280', lineHeight: 19, paddingRight: 32 },
  closeBtn:        { marginTop: 2, marginRight: 4, padding: 4 },
  scroll:          { padding: 20, gap: 8, paddingBottom: 8 },

  childRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F9FAFB', borderRadius: 14, padding: 12, borderWidth: 1.5, borderColor: '#F0F0F0' },
  childRowDuplicate:{ borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' },
  childBadge:      { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', minWidth: 80 },
  childName:       { fontSize: 14, fontWeight: '800', textAlign: 'center' },
  childDeeds:      { fontSize: 10, color: '#9CA3AF', fontWeight: '500', marginTop: 2 },

  actionCol:       { flex: 1, alignItems: 'flex-start' },
  mergeBtn:        { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB' },
  mergeBtnText:    { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  mergeTag:        { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#EDF7F2', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  mergeTagText:    { fontSize: 12, fontWeight: '600', color: '#2E7D62', flex: 1 },
  keepTag:         { flexDirection: 'row', alignItems: 'center', gap: 5 },
  keepTagText:     { fontSize: 12, fontWeight: '600', color: '#2E7D62' },

  picker:          { backgroundColor: '#FFFFFF', borderRadius: 12, marginTop: -4, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden', marginBottom: 4 },
  pickerOption:    { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  pickerDot:       { width: 10, height: 10, borderRadius: 5 },
  pickerOptionText:{ flex: 1, fontSize: 14, fontWeight: '600', color: '#1A1A2E' },
  pickerOptionDeeds:{ fontSize: 12, color: '#9CA3AF' },

  summaryCard:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#EDF7F2', borderRadius: 12, padding: 14, marginTop: 8 },
  summaryText:     { flex: 1, fontSize: 12, color: '#2E7D62', lineHeight: 18 },

  footer:          { flexDirection: 'row', gap: 10, padding: 20, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  cancelBtn:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB' },
  cancelBtnText:   { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  applyBtn:        { flex: 2, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: '#1B3D2F' },
  applyBtnText:    { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
