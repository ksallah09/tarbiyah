import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchAllPacks, addPack, removePack } from '../utils/headsupCategories';

export default function PackBrowserModal({ visible, onClose, onPacksChanged }) {
  const [packs, setPacks]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState({}); // packId → true while adding/removing

  useEffect(() => {
    if (visible) load();
  }, [visible]);

  async function load() {
    setLoading(true);
    try {
      setPacks(await fetchAllPacks());
    } catch {
      Alert.alert('Error', 'Could not load packs. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(pack) {
    setBusy(b => ({ ...b, [pack.id]: true }));
    try {
      await addPack(pack.id);
      setPacks(prev => prev.map(p => p.id === pack.id ? { ...p, added: true } : p));
      onPacksChanged?.();
    } catch (e) {
      Alert.alert('Error', e?.message ?? 'Could not add pack.');
    } finally {
      setBusy(b => ({ ...b, [pack.id]: false }));
    }
  }

  async function handleRemove(pack) {
    setBusy(b => ({ ...b, [pack.id]: true }));
    try {
      await removePack(pack.id);
      setPacks(prev => prev.map(p => p.id === pack.id ? { ...p, added: false } : p));
      onPacksChanged?.();
    } catch (e) {
      Alert.alert('Error', e?.message ?? 'Could not remove pack.');
    } finally {
      setBusy(b => ({ ...b, [pack.id]: false }));
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.container}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.title}>Content Packs</Text>
            <Text style={s.subtitle}>Add new categories to your game</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator size="large" color="#1B3D2F" />
            <Text style={s.loadingText}>Loading packs…</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            {packs.map(pack => (
              <View key={pack.id} style={[s.packCard, { borderLeftColor: pack.color }]}>
                <View style={s.packTop}>
                  <View style={[s.packIconWrap, { backgroundColor: pack.color + '18' }]}>
                    <Text style={s.packEmoji}>{pack.emoji}</Text>
                  </View>
                  <View style={s.packInfo}>
                    <Text style={s.packTitle}>{pack.title}</Text>
                    <Text style={s.packMeta}>{pack.card_count} cards · {pack.is_free ? 'Free' : 'Premium'}</Text>
                  </View>
                  {busy[pack.id] ? (
                    <ActivityIndicator size="small" color="#1B3D2F" />
                  ) : pack.added ? (
                    <TouchableOpacity style={s.addedBtn} onPress={() => handleRemove(pack)} activeOpacity={0.8}>
                      <Ionicons name="checkmark-circle" size={16} color="#2E7D62" />
                      <Text style={s.addedBtnText}>Added</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={s.addBtn} onPress={() => handleAdd(pack)} activeOpacity={0.85}>
                      <Ionicons name="add" size={16} color="#FFFFFF" />
                      <Text style={s.addBtnText}>Add</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={s.packDesc}>{pack.description}</Text>
              </View>
            ))}

            {packs.length === 0 && (
              <View style={s.emptyWrap}>
                <Text style={s.emptyText}>No packs available yet. Check back soon!</Text>
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#F9FAFB' },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 24, paddingBottom: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  title:       { fontSize: 20, fontWeight: '800', color: '#1A1A2E', marginBottom: 2 },
  subtitle:    { fontSize: 13, color: '#6B7280' },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  loadingText: { fontSize: 14, color: '#9CA3AF' },

  scroll: { padding: 16, gap: 12, paddingBottom: 40 },

  packCard:    { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderLeftWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  packTop:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  packIconWrap:{ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  packEmoji:   { fontSize: 22 },
  packInfo:    { flex: 1 },
  packTitle:   { fontSize: 15, fontWeight: '800', color: '#1A1A2E', marginBottom: 2 },
  packMeta:    { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  packDesc:    { fontSize: 13, color: '#6B7280', lineHeight: 19 },

  addBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1B3D2F', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText:  { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  addedBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EDF7F2', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#2E7D62' },
  addedBtnText:{ fontSize: 13, fontWeight: '700', color: '#2E7D62' },

  emptyWrap:   { alignItems: 'center', paddingTop: 60 },
  emptyText:   { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
});
