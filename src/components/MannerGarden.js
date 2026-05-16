import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  TextInput, ScrollView, Animated, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../utils/supabase';
import { getFamilyId } from '../utils/familyGoals';
import { notifyPartner } from '../utils/partnerNotify';

// ── Manners ──────────────────────────────────────────────────────────────────

const MANNERS = [
  { key: 'truthfulness',       label: 'Truthfulness',          emoji: '❤️' },
  { key: 'respecting_parents', label: 'Respecting Parents',    emoji: '💚' },
  { key: 'kind_words',         label: 'Kind Words',            emoji: '💬' },
  { key: 'helping_siblings',   label: 'Helping Siblings',      emoji: '🤝' },
  { key: 'sharing',            label: 'Sharing',               emoji: '✨' },
  { key: 'patience',           label: 'Patience',              emoji: '🌿' },
  { key: 'salam',              label: 'Saying Salām',          emoji: '🌙' },
  { key: 'cleaning_up',        label: 'Cleaning Up',           emoji: '🧹' },
  { key: 'apologizing',        label: 'Apologizing',           emoji: '💛' },
  { key: 'forgiving',          label: 'Forgiving',             emoji: '🌸' },
  { key: 'gratitude',          label: 'Gratitude',             emoji: '🌺' },
  { key: 'quran',              label: 'Quran Accomplishment',  emoji: '📖' },
  { key: 'other',              label: 'Other',                 emoji: '⭐' },
];

// ── Stage config ──────────────────────────────────────────────────────────────

const STAGES = [
  { index: 0, name: 'Seed',              min: 0,   next: 10  },
  { index: 1, name: 'Sprout',            min: 10,  next: 25  },
  { index: 2, name: 'Sapling',           min: 25,  next: 50  },
  { index: 3, name: 'Growing Tree',      min: 50,  next: 100 },
  { index: 4, name: 'Flowering Tree',    min: 100, next: 200 },
  { index: 5, name: 'Fruit-bearing Tree',min: 200, next: null },
];

function getStage(total) {
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (total >= STAGES[i].min) return STAGES[i];
  }
  return STAGES[0];
}

// ── Tree illustration ─────────────────────────────────────────────────────────

const FLOWER_POSITIONS = [
  { top: '18%', left: '22%' }, { top: '12%', left: '55%' },
  { top: '40%', left: '68%' }, { top: '55%', left: '28%' },
  { top: '28%', left: '40%' }, { top: '62%', left: '58%' },
  { top: '48%', left: '12%' }, { top: '22%', left: '75%' },
];

const FRUIT_POSITIONS = [
  { top: '20%', left: '25%' }, { top: '15%', left: '58%' },
  { top: '42%', left: '70%' }, { top: '58%', left: '30%' },
  { top: '30%', left: '42%' }, { top: '65%', left: '60%' },
  { top: '50%', left: '10%' }, { top: '25%', left: '78%' },
];

function TreeIllustration({ stageIndex, swayAnim }) {
  const TRUNK_COLOR = '#92400E';

  return (
    <View style={tree.scene}>
      {/* Sky */}
      <LinearGradient colors={['#EFF6FF', '#DBEAFE']} style={tree.sky} />

      {/* Water drop (animated, shown via parent) */}

      {/* Tree */}
      <Animated.View style={[tree.treeWrap, { transform: [{ translateX: swayAnim }] }]}>
        {stageIndex === 0 && (
          // Seed
          <View style={tree.seedWrap}>
            <View style={tree.seed} />
            <View style={tree.seedCrack} />
          </View>
        )}

        {stageIndex === 1 && (
          // Sprout
          <View style={tree.sproutWrap}>
            <View style={tree.sproutStem} />
            <View style={tree.sproutLeftLeaf} />
            <View style={tree.sproutRightLeaf} />
          </View>
        )}

        {stageIndex >= 2 && (
          // Sapling → Tree → Flowering → Fruit
          <View style={tree.treeContainer}>
            {/* Canopy */}
            <View style={[
              tree.canopy,
              stageIndex === 2 && tree.canopySapling,
              stageIndex === 3 && tree.canopyTree,
              stageIndex === 4 && tree.canopyFlowering,
              stageIndex === 5 && tree.canopyFruit,
            ]}>
              {stageIndex === 4 && FLOWER_POSITIONS.map((pos, i) => (
                <View key={i} style={[tree.flowerDot, { top: pos.top, left: pos.left }]} />
              ))}
              {stageIndex === 5 && FRUIT_POSITIONS.map((pos, i) => (
                <View key={i} style={[tree.fruitDot, i % 3 === 0 && tree.fruitDotAlt, { top: pos.top, left: pos.left }]} />
              ))}
            </View>
            {/* Trunk */}
            <View style={[
              tree.trunk,
              { backgroundColor: TRUNK_COLOR },
              stageIndex === 2 && tree.trunkSapling,
              stageIndex >= 3 && tree.trunkFull,
            ]} />
          </View>
        )}
      </Animated.View>

      {/* Earth */}
      <LinearGradient colors={['#92400E', '#78350F']} style={tree.earth} />
    </View>
  );
}

const tree = StyleSheet.create({
  scene:       { width: 200, height: 170, overflow: 'hidden', borderRadius: 20 },
  sky:         { ...StyleSheet.absoluteFillObject },
  earth:       { position: 'absolute', bottom: 0, left: 0, right: 0, height: 28, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  treeWrap:    { position: 'absolute', bottom: 28, left: 0, right: 0, alignItems: 'center' },

  // Seed
  seedWrap:    { alignItems: 'center', marginBottom: -10 },
  seed:        { width: 22, height: 14, borderRadius: 11, backgroundColor: '#92400E' },
  seedCrack:   { width: 2, height: 8, backgroundColor: '#4ADE80', borderRadius: 1, marginTop: -4 },

  // Sprout
  sproutWrap:       { alignItems: 'center', width: 60 },
  sproutStem:       { width: 4, height: 38, backgroundColor: '#4ADE80', borderRadius: 2 },
  sproutLeftLeaf:   { position: 'absolute', bottom: 16, left: 6, width: 20, height: 12, backgroundColor: '#86EFAC', borderRadius: 10, transform: [{ rotate: '-35deg' }] },
  sproutRightLeaf:  { position: 'absolute', bottom: 16, right: 6, width: 20, height: 12, backgroundColor: '#86EFAC', borderRadius: 10, transform: [{ rotate: '35deg' }] },

  // Sapling / Tree
  treeContainer: { alignItems: 'center' },
  canopy:        { overflow: 'hidden', position: 'relative' },
  canopySapling: { width: 62, height: 55, borderRadius: 31, backgroundColor: '#BBF7D0', marginBottom: -4 },
  canopyTree:    { width: 95, height: 82, borderRadius: 48, backgroundColor: '#4ADE80', marginBottom: -6 },
  canopyFlowering:{ width: 98, height: 85, borderRadius: 49, backgroundColor: '#22C55E', marginBottom: -6 },
  canopyFruit:   { width: 102, height: 90, borderRadius: 51, backgroundColor: '#16A34A', marginBottom: -6 },

  trunk:         { borderRadius: 4 },
  trunkSapling:  { width: 10, height: 44 },
  trunkFull:     { width: 14, height: 62 },

  flowerDot: { position: 'absolute', width: 9, height: 9, borderRadius: 5, backgroundColor: '#FEC0D3' },
  fruitDot:  { position: 'absolute', width: 11, height: 11, borderRadius: 6, backgroundColor: '#FCD34D' },
  fruitDotAlt: { backgroundColor: '#FB923C' },
});

// ── Main component ────────────────────────────────────────────────────────────

export default function MannerGarden({ child, myProfileName, partnerLinked, style }) {
  const [actions,         setActions]         = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [showModal,       setShowModal]       = useState(false);
  const [selectedManner,  setSelectedManner]  = useState(null);
  const [note,            setNote]            = useState('');
  const [saving,          setSaving]          = useState(false);

  const swayAnim    = useRef(new Animated.Value(0)).current;
  const dropY       = useRef(new Animated.Value(0)).current;
  const dropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => { loadActions(); }, [child?.id]);

  async function loadActions() {
    if (!child?.id) return;
    setLoading(true);
    try {
      const familyId = await getFamilyId();
      const { data } = await supabase
        .from('child_garden_actions')
        .select('*')
        .eq('child_id', child.id)
        .eq('family_id', familyId)
        .order('date', { ascending: false });
      if (data) setActions(data);
    } catch {}
    setLoading(false);
  }

  function animateTree() {
    // Water drop
    dropY.setValue(0);
    dropOpacity.setValue(1);
    Animated.parallel([
      Animated.timing(dropY, { toValue: 90, duration: 700, useNativeDriver: true }),
      Animated.timing(dropOpacity, { toValue: 0, duration: 700, delay: 200, useNativeDriver: true }),
    ]).start();
    // Sway
    Animated.sequence([
      Animated.timing(swayAnim, { toValue: 7,  duration: 130, useNativeDriver: true }),
      Animated.timing(swayAnim, { toValue: -5, duration: 130, useNativeDriver: true }),
      Animated.timing(swayAnim, { toValue: 3,  duration: 120, useNativeDriver: true }),
      Animated.timing(swayAnim, { toValue: 0,  duration: 120, useNativeDriver: true }),
    ]).start();
  }

  async function logDeed() {
    if (!selectedManner || !child?.id) return;
    setSaving(true);
    try {
      const [familyId, sessionRes] = await Promise.all([getFamilyId(), supabase.auth.getSession()]);
      const userId = sessionRes?.data?.session?.user?.id ?? null;
      const manner = MANNERS.find(m => m.key === selectedManner);
      const { error } = await supabase.from('child_garden_actions').insert({
        id:              `ga_${Date.now()}`,
        family_id:       familyId,
        child_id:        child.id,
        child_name:      child.name,
        manner:          selectedManner,
        note:            note.trim() || null,
        date:            new Date().toISOString(),
        user_id:         userId,
        logged_by_name:  myProfileName || null,
      });
      if (error) { Alert.alert('Error', 'Could not save. Please try again.'); return; }
      await loadActions();
      animateTree();
      setShowModal(false);
      setSelectedManner(null);
      setNote('');
      if (partnerLinked) {
        notifyPartner(
          `${myProfileName || 'Your partner'} logged a good deed for ${child.name}`,
          `${manner?.emoji ?? ''} ${manner?.label ?? selectedManner}${note.trim() ? ` · "${note.trim()}"` : ''}`,
          { screen: 'Dashboards', childId: child.id }
        );
      }
    } catch { Alert.alert('Error', 'Something went wrong.'); }
    finally { setSaving(false); }
  }

  const total        = actions.length;
  const stage        = getStage(total);
  const progress     = stage.next ? (total - stage.min) / (stage.next - stage.min) : 1;
  const toNext       = stage.next ? stage.next - total : 0;
  const displayName  = child?.name?.split(' ')[0] ?? 'Your Child';
  const recentThree  = actions.slice(0, 3);

  return (
    <View style={[gs.card, style]}>
      {/* Header */}
      <View style={gs.cardHeader}>
        <View style={gs.emojiWrap}>
          <Text style={{ fontSize: 20 }}>🌱</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={gs.eyebrow}>MANNERS GARDEN</Text>
          <Text style={gs.title}>{displayName}'s Tree</Text>
        </View>
        <View style={gs.stagePill}>
          <Text style={gs.stageText}>{stage.name}</Text>
        </View>
      </View>

      {/* Tree scene */}
      <View style={gs.sceneWrap}>
        <TreeIllustration stageIndex={stage.index} swayAnim={swayAnim} />
        {/* Water drop overlay */}
        <Animated.View style={[gs.waterDrop, { transform: [{ translateY: dropY }], opacity: dropOpacity }]}>
          <Text style={{ fontSize: 18 }}>💧</Text>
        </Animated.View>
        {/* Good deeds count */}
        <View style={gs.deedsCountWrap}>
          <Text style={gs.deedsCount}>{total}</Text>
          <Text style={gs.deedsLabel}>good deeds planted</Text>
        </View>
      </View>

      {/* Progress to next stage */}
      {stage.next && (
        <View style={gs.progressWrap}>
          <View style={gs.progressTrack}>
            <View style={[gs.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Text style={gs.progressLabel}>{toNext} to {STAGES[stage.index + 1]?.name}</Text>
        </View>
      )}

      {/* Recent deeds — full width list */}
      {recentThree.length > 0 && (
        <View style={gs.recentList}>
          <Text style={gs.recentLabel}>Recent deeds</Text>
          {recentThree.map((a, idx) => {
            const m = MANNERS.find(m => m.key === a.manner);
            return (
              <View key={a.id} style={[gs.recentItem, idx < recentThree.length - 1 && gs.recentItemBorder]}>
                <Text style={gs.recentItemEmoji}>{m?.emoji ?? '✨'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={gs.recentItemLabel}>{m?.label ?? a.manner}</Text>
                  {!!a.note && <Text style={gs.recentItemNote}>"{a.note}"</Text>}
                </View>
                <Text style={gs.recentItemDate}>
                  {new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Log button */}
      <TouchableOpacity style={gs.logBtn} onPress={() => setShowModal(true)} activeOpacity={0.85}>
        <Ionicons name="add-circle-outline" size={16} color="#1B3D2F" />
        <Text style={gs.logBtnText}>Log a good deed</Text>
      </TouchableOpacity>

      {/* Logger modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={gs.modalContainer}>
            <View style={gs.modalHeader}>
              <Text style={gs.modalTitle}>Log a good deed</Text>
              <Text style={gs.modalSub}>What did {displayName} do today?</Text>
              <TouchableOpacity style={gs.modalClose} onPress={() => { setShowModal(false); setSelectedManner(null); setNote(''); }}>
                <Ionicons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={gs.modalScroll} showsVerticalScrollIndicator={false}>
              {/* Manner grid */}
              <View style={gs.mannerGrid}>
                {MANNERS.map(m => {
                  const active = selectedManner === m.key;
                  return (
                    <TouchableOpacity
                      key={m.key}
                      style={[gs.mannerBtn, active && gs.mannerBtnActive]}
                      onPress={() => setSelectedManner(m.key)}
                      activeOpacity={0.75}
                    >
                      <Text style={gs.mannerEmoji}>{m.emoji}</Text>
                      <Text style={[gs.mannerLabel, active && gs.mannerLabelActive]}>{m.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Optional note */}
              <Text style={gs.noteLabel}>Add a note (optional)</Text>
              <TextInput
                style={gs.noteInput}
                placeholder={`What happened? e.g. "${displayName} shared their snack without being asked"`}
                placeholderTextColor="#9CA3AF"
                value={note}
                onChangeText={setNote}
                multiline
                maxLength={200}
              />
            </ScrollView>

            <TouchableOpacity
              style={[gs.saveBtn, (!selectedManner || saving) && { opacity: 0.5 }]}
              onPress={logDeed}
              disabled={!selectedManner || saving}
              activeOpacity={0.85}
            >
              <Text style={gs.saveBtnText}>{saving ? 'Saving…' : 'Plant this deed 🌱'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ── Mini version for family garden view ───────────────────────────────────────

export function MiniGardenCard({ childName, total, color }) {
  const stage = getStage(total);
  const EMOJIS = ['🌱', '🌿', '🪴', '🌳', '🌸', '🍃'];
  return (
    <View style={gs.miniCard}>
      <Text style={gs.miniEmoji}>{EMOJIS[stage.index]}</Text>
      <View style={[gs.miniNameBadge, { backgroundColor: (color ?? '#2E7D62') + '22' }]}>
        <Text style={[gs.miniName, { color: color ?? '#2E7D62' }]}>{childName?.split(' ')[0]}</Text>
      </View>
      <Text style={gs.miniStage}>{stage.name}</Text>
      <Text style={gs.miniCount}>{total} deeds</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.09,
  shadowRadius: 12,
  elevation: 4,
};

const gs = StyleSheet.create({
  card:          { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, marginBottom: 12, ...CARD_SHADOW },

  cardHeader:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  emojiWrap:     { width: 42, height: 42, borderRadius: 12, backgroundColor: '#EDF7F2', alignItems: 'center', justifyContent: 'center' },
  eyebrow:       { fontSize: 10, fontWeight: '700', color: '#2E7D62', letterSpacing: 1, marginBottom: 2 },
  title:         { fontSize: 15, fontWeight: '800', color: '#1A1A2E' },
  stagePill:     { backgroundColor: '#EDF7F2', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  stageText:     { fontSize: 11, fontWeight: '700', color: '#2E7D62' },

  sceneWrap:     { alignItems: 'center', marginBottom: 14, position: 'relative' },
  waterDrop:     { position: 'absolute', top: 0, zIndex: 10 },
  deedsCountWrap:{ marginTop: 8, alignItems: 'center' },
  deedsCount:    { fontSize: 28, fontWeight: '800', color: '#1A1A2E' },
  deedsLabel:    { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },

  progressWrap:  { marginBottom: 14 },
  progressTrack: { height: 6, backgroundColor: '#EDF7F2', borderRadius: 100, overflow: 'hidden', marginBottom: 5 },
  progressFill:  { height: 6, backgroundColor: '#2E7D62', borderRadius: 100 },
  progressLabel: { fontSize: 11, color: '#9CA3AF', textAlign: 'right' },

  recentList:       { marginBottom: 14, backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12 },
  recentLabel:      { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.5, marginBottom: 10 },
  recentItem:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8 },
  recentItemBorder: { borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  recentItemEmoji:  { fontSize: 17, width: 24, textAlign: 'center', marginTop: 1 },
  recentItemLabel:  { fontSize: 13, fontWeight: '600', color: '#1A1A2E', marginBottom: 2 },
  recentItemNote:   { fontSize: 12, color: '#6B7280', lineHeight: 18, fontStyle: 'italic' },
  recentItemDate:   { fontSize: 11, color: '#9CA3AF', marginTop: 2 },

  logBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#EDF7F2', borderRadius: 12, paddingVertical: 13, borderWidth: 1, borderColor: '#BBF7D0' },
  logBtnText:    { fontSize: 14, fontWeight: '700', color: '#1B3D2F' },

  // Modal
  modalContainer:{ flex: 1, backgroundColor: '#FFFFFF' },
  modalHeader:   { padding: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', position: 'relative' },
  modalTitle:    { fontSize: 18, fontWeight: '800', color: '#1A1A2E', marginBottom: 2 },
  modalSub:      { fontSize: 13, color: '#9CA3AF' },
  modalClose:    { position: 'absolute', right: 20, top: 20 },
  modalScroll:   { padding: 20, paddingBottom: 8 },

  mannerGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  mannerBtn:     { width: '30%', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4, backgroundColor: '#F9FAFB', borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB', gap: 4 },
  mannerBtnActive:{ backgroundColor: '#EDF7F2', borderColor: '#2E7D62' },
  mannerEmoji:   { fontSize: 22 },
  mannerLabel:   { fontSize: 10, fontWeight: '600', color: '#6B7280', textAlign: 'center' },
  mannerLabelActive: { color: '#2E7D62' },

  noteLabel:     { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  noteInput:     { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, fontSize: 13, color: '#1A1A2E', minHeight: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 20 },

  saveBtn:       { margin: 20, marginTop: 12, backgroundColor: '#1B3D2F', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  saveBtnText:   { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

  // Mini card
  miniCard:      { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, alignItems: 'center', width: 100, ...CARD_SHADOW },
  miniEmoji:     { fontSize: 32, marginBottom: 8 },
  miniNameBadge: { borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 4 },
  miniName:      { fontSize: 11, fontWeight: '700' },
  miniStage:     { fontSize: 10, color: '#9CA3AF', textAlign: 'center', marginBottom: 2 },
  miniCount:     { fontSize: 10, fontWeight: '600', color: '#2E7D62' },
});
