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

const STAGE_KEYS = ['sprout', 'sapling', 'tree', 'flowering', 'fruit'];

const DEFAULT_THRESHOLDS = { sprout: 10, sapling: 25, tree: 50, flowering: 100, fruit: 200 };

const STAGE_META = [
  { index: 0, name: 'Seed',               key: 'seed'      },
  { index: 1, name: 'Sprout',             key: 'sprout'    },
  { index: 2, name: 'Sapling',            key: 'sapling'   },
  { index: 3, name: 'Growing Tree',       key: 'tree'      },
  { index: 4, name: 'Flowering Tree',     key: 'flowering' },
  { index: 5, name: 'Fruit-bearing Tree', key: 'fruit'     },
];

function buildStages(thresholds) {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds };
  return [
    { ...STAGE_META[0], min: 0,          next: t.sprout    },
    { ...STAGE_META[1], min: t.sprout,   next: t.sapling   },
    { ...STAGE_META[2], min: t.sapling,  next: t.tree      },
    { ...STAGE_META[3], min: t.tree,     next: t.flowering },
    { ...STAGE_META[4], min: t.flowering,next: t.fruit     },
    { ...STAGE_META[5], min: t.fruit,    next: null        },
  ];
}

function getStageFromList(stages, total) {
  for (let i = stages.length - 1; i >= 0; i--) {
    if (total >= stages[i].min) return stages[i];
  }
  return stages[0];
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
  return (
    <View style={tree.scene}>
      <LinearGradient colors={['#EFF6FF', '#DBEAFE']} style={tree.sky} />
      <Animated.View style={[tree.treeWrap, { transform: [{ translateX: swayAnim }] }]}>
        {stageIndex === 0 && (
          <View style={tree.seedWrap}>
            <View style={tree.seed} />
            <View style={tree.seedCrack} />
          </View>
        )}
        {stageIndex === 1 && (
          <View style={tree.sproutWrap}>
            <View style={tree.sproutStem} />
            <View style={tree.sproutLeftLeaf} />
            <View style={tree.sproutRightLeaf} />
          </View>
        )}
        {stageIndex >= 2 && (
          <View style={tree.treeContainer}>
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
            <View style={[
              tree.trunk,
              { backgroundColor: '#92400E' },
              stageIndex === 2 && tree.trunkSapling,
              stageIndex >= 3 && tree.trunkFull,
            ]} />
          </View>
        )}
      </Animated.View>
      <LinearGradient colors={['#92400E', '#78350F']} style={tree.earth} />
    </View>
  );
}

const tree = StyleSheet.create({
  scene:          { width: 200, height: 170, overflow: 'hidden', borderRadius: 20 },
  sky:            { ...StyleSheet.absoluteFillObject },
  earth:          { position: 'absolute', bottom: 0, left: 0, right: 0, height: 28, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  treeWrap:       { position: 'absolute', bottom: 28, left: 0, right: 0, alignItems: 'center' },
  seedWrap:       { alignItems: 'center', marginBottom: -10 },
  seed:           { width: 22, height: 14, borderRadius: 11, backgroundColor: '#92400E' },
  seedCrack:      { width: 2, height: 8, backgroundColor: '#4ADE80', borderRadius: 1, marginTop: -4 },
  sproutWrap:     { alignItems: 'center', width: 60 },
  sproutStem:     { width: 4, height: 38, backgroundColor: '#4ADE80', borderRadius: 2 },
  sproutLeftLeaf: { position: 'absolute', bottom: 16, left: 6, width: 20, height: 12, backgroundColor: '#86EFAC', borderRadius: 10, transform: [{ rotate: '-35deg' }] },
  sproutRightLeaf:{ position: 'absolute', bottom: 16, right: 6, width: 20, height: 12, backgroundColor: '#86EFAC', borderRadius: 10, transform: [{ rotate: '35deg' }] },
  treeContainer:  { alignItems: 'center' },
  canopy:         { overflow: 'hidden', position: 'relative' },
  canopySapling:  { width: 62, height: 55, borderRadius: 31, backgroundColor: '#BBF7D0', marginBottom: -4 },
  canopyTree:     { width: 95, height: 82, borderRadius: 48, backgroundColor: '#4ADE80', marginBottom: -6 },
  canopyFlowering:{ width: 98, height: 85, borderRadius: 49, backgroundColor: '#22C55E', marginBottom: -6 },
  canopyFruit:    { width: 102, height: 90, borderRadius: 51, backgroundColor: '#16A34A', marginBottom: -6 },
  trunk:          { borderRadius: 4 },
  trunkSapling:   { width: 10, height: 44 },
  trunkFull:      { width: 14, height: 62 },
  flowerDot:      { position: 'absolute', width: 9, height: 9, borderRadius: 5, backgroundColor: '#FEC0D3' },
  fruitDot:       { position: 'absolute', width: 11, height: 11, borderRadius: 6, backgroundColor: '#FCD34D' },
  fruitDotAlt:    { backgroundColor: '#FB923C' },
});

// ── Main component ────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = { thresholds: DEFAULT_THRESHOLDS, rewards: {} };

export default function MannerGarden({ child, myProfileName, partnerLinked, style }) {
  const [actions,        setActions]        = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [settings,       setSettings]       = useState(DEFAULT_SETTINGS);
  const [showModal,      setShowModal]      = useState(false);
  const [showSettings,   setShowSettings]   = useState(false);
  const [selectedManner, setSelectedManner] = useState(null);
  const [note,           setNote]           = useState('');
  const [saving,         setSaving]         = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  // Settings edit state
  const [draftThresholds, setDraftThresholds] = useState({ ...DEFAULT_THRESHOLDS });
  const [draftRewards,    setDraftRewards]    = useState({});
  // Milestone celebration
  const [celebStage,     setCelebStage]     = useState(null);

  const swayAnim    = useRef(new Animated.Value(0)).current;
  const dropY       = useRef(new Animated.Value(0)).current;
  const dropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadActions();
    loadSettings();
  }, [child?.id]);

  const stages = buildStages(settings.thresholds);

  async function loadSettings() {
    if (!child?.id) return;
    try {
      const { data } = await supabase
        .from('child_garden_settings')
        .select('thresholds, rewards')
        .eq('child_id', child.id)
        .single();
      if (data) {
        const s = {
          thresholds: { ...DEFAULT_THRESHOLDS, ...(data.thresholds ?? {}) },
          rewards:    data.rewards ?? {},
        };
        setSettings(s);
        setDraftThresholds({ ...s.thresholds });
        setDraftRewards({ ...s.rewards });
      }
    } catch {}
  }

  async function saveSettings() {
    if (!child?.id) return;
    // Validate thresholds are ascending
    const t = draftThresholds;
    if (t.sprout >= t.sapling || t.sapling >= t.tree || t.tree >= t.flowering || t.flowering >= t.fruit) {
      Alert.alert('Invalid thresholds', 'Each stage must require more deeds than the previous one.');
      return;
    }
    setSavingSettings(true);
    try {
      const familyId = await getFamilyId();
      const { data: sessionRes } = await supabase.auth.getSession();
      const userId = sessionRes?.session?.user?.id ?? null;
      await supabase.from('child_garden_settings').upsert({
        child_id:   child.id,
        family_id:  familyId,
        thresholds: draftThresholds,
        rewards:    draftRewards,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'child_id' });
      setSettings({ thresholds: { ...draftThresholds }, rewards: { ...draftRewards } });
      setShowSettings(false);
    } catch { Alert.alert('Error', 'Could not save settings.'); }
    finally { setSavingSettings(false); }
  }

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
    dropY.setValue(0);
    dropOpacity.setValue(1);
    Animated.parallel([
      Animated.timing(dropY, { toValue: 90, duration: 700, useNativeDriver: true }),
      Animated.timing(dropOpacity, { toValue: 0, duration: 700, delay: 200, useNativeDriver: true }),
    ]).start();
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
      const stageBefore = getStageFromList(stages, actions.length);
      const [familyId, sessionRes] = await Promise.all([getFamilyId(), supabase.auth.getSession()]);
      const userId = sessionRes?.data?.session?.user?.id ?? null;
      const manner = MANNERS.find(m => m.key === selectedManner);
      const { error } = await supabase.from('child_garden_actions').insert({
        id:             `ga_${Date.now()}`,
        family_id:      familyId,
        child_id:       child.id,
        child_name:     child.name,
        manner:         selectedManner,
        note:           note.trim() || null,
        date:           new Date().toISOString(),
        user_id:        userId,
        logged_by_name: myProfileName || null,
      });
      if (error) { Alert.alert('Error', 'Could not save. Please try again.'); return; }
      await loadActions();
      animateTree();
      setShowModal(false);
      setSelectedManner(null);
      setNote('');
      // Check for stage transition
      const newTotal = actions.length + 1;
      const stageAfter = getStageFromList(stages, newTotal);
      if (stageAfter.index > stageBefore.index) {
        setCelebStage(stageAfter);
      }
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

  const total       = actions.length;
  const stage       = getStageFromList(stages, total);
  const progress    = stage.next ? (total - stage.min) / (stage.next - stage.min) : 1;
  const toNext      = stage.next ? stage.next - total : 0;
  const nextStage   = stage.next ? stages[stage.index + 1] : null;
  const nextReward  = nextStage ? settings.rewards?.[nextStage.key] : null;
  const displayName = child?.name?.split(' ')[0] ?? 'Your Child';
  const recentThree = actions.slice(0, 3);

  return (
    <View style={[gs.card, style]}>
      {/* Header */}
      <View style={gs.cardHeader}>
        <View style={gs.emojiWrap}>
          <Text style={{ fontSize: 20 }}>🌱</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={gs.eyebrow}>GOOD DEEDS GARDEN</Text>
          <Text style={gs.title}>{displayName}'s Tree</Text>
        </View>
        <View style={gs.stagePill}>
          <Text style={gs.stageText}>{stage.name}</Text>
        </View>
        <TouchableOpacity onPress={() => { setDraftThresholds({ ...settings.thresholds }); setDraftRewards({ ...settings.rewards }); setShowSettings(true); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginLeft: 8 }}>
          <Ionicons name="settings-outline" size={18} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      {/* Tree scene */}
      <View style={gs.sceneWrap}>
        <TreeIllustration stageIndex={stage.index} swayAnim={swayAnim} />
        <Animated.View style={[gs.waterDrop, { transform: [{ translateY: dropY }], opacity: dropOpacity }]}>
          <Text style={{ fontSize: 18 }}>💧</Text>
        </Animated.View>
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
          <Text style={gs.progressLabel}>{toNext} deed{toNext !== 1 ? 's' : ''} to {nextStage?.name}</Text>
          {!!nextReward && (
            <View style={gs.rewardRow}>
              <Ionicons name="gift-outline" size={12} color="#D4A843" />
              <Text style={gs.rewardText}>Reward: {nextReward}</Text>
            </View>
          )}
        </View>
      )}

      {/* Recent deeds */}
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

      {/* ── Log deed modal ── */}
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
              <View style={gs.mannerGrid}>
                {MANNERS.map(m => {
                  const active = selectedManner === m.key;
                  return (
                    <TouchableOpacity key={m.key} style={[gs.mannerBtn, active && gs.mannerBtnActive]} onPress={() => setSelectedManner(m.key)} activeOpacity={0.75}>
                      <Text style={gs.mannerEmoji}>{m.emoji}</Text>
                      <Text style={[gs.mannerLabel, active && gs.mannerLabelActive]}>{m.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
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
            <TouchableOpacity style={[gs.saveBtn, (!selectedManner || saving) && { opacity: 0.5 }]} onPress={logDeed} disabled={!selectedManner || saving} activeOpacity={0.85}>
              <Text style={gs.saveBtnText}>{saving ? 'Saving…' : 'Plant this deed 🌱'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Settings modal ── */}
      <Modal visible={showSettings} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowSettings(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={gs.modalContainer}>
            <View style={gs.modalHeader}>
              <Text style={gs.modalTitle}>Garden Settings</Text>
              <Text style={gs.modalSub}>Customise growth stages and milestone rewards</Text>
              <TouchableOpacity style={gs.modalClose} onPress={() => setShowSettings(false)}>
                <Ionicons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={[gs.modalScroll, { paddingBottom: 32 }]} showsVerticalScrollIndicator={false}>

              {/* Thresholds */}
              <Text style={gs.settingsSectionTitle}>Deeds needed per stage</Text>
              <Text style={gs.settingsSectionSub}>How many good deeds to reach each growth stage.</Text>
              {STAGE_KEYS.map((key, i) => {
                const stageName = STAGE_META[i + 1].name;
                return (
                  <View key={key} style={gs.settingsRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={gs.settingsRowLabel}>{stageName}</Text>
                      {i > 0 && <Text style={gs.settingsRowSub}>Must be more than {draftThresholds[STAGE_KEYS[i - 1]] || '—'}</Text>}
                    </View>
                    <TextInput
                      style={gs.settingsNumInput}
                      keyboardType="number-pad"
                      value={String(draftThresholds[key] ?? '')}
                      onChangeText={v => setDraftThresholds(prev => ({ ...prev, [key]: parseInt(v) || 0 }))}
                      maxLength={4}
                    />
                    <Text style={gs.settingsUnit}>deeds</Text>
                  </View>
                );
              })}

              {/* Rewards */}
              <Text style={[gs.settingsSectionTitle, { marginTop: 28 }]}>Milestone rewards</Text>
              <Text style={gs.settingsSectionSub}>What will you celebrate when your child reaches each stage?</Text>
              {STAGE_KEYS.map((key, i) => {
                const stageName = STAGE_META[i + 1].name;
                return (
                  <View key={key} style={gs.settingsRewardRow}>
                    <Text style={gs.settingsRowLabel}>{stageName}</Text>
                    <TextInput
                      style={gs.settingsRewardInput}
                      placeholder={`e.g. "Trip to the park"`}
                      placeholderTextColor="#9CA3AF"
                      value={draftRewards[key] ?? ''}
                      onChangeText={v => setDraftRewards(prev => ({ ...prev, [key]: v }))}
                      maxLength={80}
                    />
                  </View>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={[gs.saveBtn, savingSettings && { opacity: 0.5 }]} onPress={saveSettings} disabled={savingSettings} activeOpacity={0.85}>
              <Text style={gs.saveBtnText}>{savingSettings ? 'Saving…' : 'Save Settings'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Stage reached celebration ── */}
      <Modal visible={!!celebStage} transparent animationType="fade" onRequestClose={() => setCelebStage(null)}>
        <View style={gs.celebOverlay}>
          <View style={gs.celebCard}>
            <Text style={gs.celebEmoji}>🎉</Text>
            <Text style={gs.celebTitle}>Ma Shaa Allah!</Text>
            <Text style={gs.celebSub}>{displayName}'s tree is now a</Text>
            <Text style={gs.celebStage}>{celebStage?.name}</Text>
            {!!settings.rewards?.[celebStage?.key] && (
              <View style={gs.celebRewardWrap}>
                <Ionicons name="gift-outline" size={16} color="#D4A843" />
                <Text style={gs.celebReward}>{settings.rewards[celebStage.key]}</Text>
              </View>
            )}
            <TouchableOpacity style={gs.celebBtn} onPress={() => setCelebStage(null)} activeOpacity={0.85}>
              <Text style={gs.celebBtnText}>Wonderful! 🌱</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Mini version for family garden view ───────────────────────────────────────

export function MiniGardenCard({ childName, total, color }) {
  const stage = getStageFromList(buildStages(DEFAULT_THRESHOLDS), total);
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

const gs = StyleSheet.create({
  card:              { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, marginBottom: 12 },
  cardHeader:        { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  emojiWrap:         { width: 42, height: 42, borderRadius: 12, backgroundColor: '#EDF7F2', alignItems: 'center', justifyContent: 'center' },
  eyebrow:           { fontSize: 10, fontWeight: '700', color: '#2E7D62', letterSpacing: 1, marginBottom: 2 },
  title:             { fontSize: 15, fontWeight: '800', color: '#1A1A2E' },
  stagePill:         { backgroundColor: '#EDF7F2', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  stageText:         { fontSize: 11, fontWeight: '700', color: '#2E7D62' },

  sceneWrap:         { alignItems: 'center', marginBottom: 14, position: 'relative' },
  waterDrop:         { position: 'absolute', top: 0, zIndex: 10 },
  deedsCountWrap:    { marginTop: 8, alignItems: 'center' },
  deedsCount:        { fontSize: 28, fontWeight: '800', color: '#1A1A2E' },
  deedsLabel:        { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },

  progressWrap:      { marginBottom: 14 },
  progressTrack:     { height: 6, backgroundColor: '#EDF7F2', borderRadius: 100, overflow: 'hidden', marginBottom: 5 },
  progressFill:      { height: 6, backgroundColor: '#2E7D62', borderRadius: 100 },
  progressLabel:     { fontSize: 11, color: '#9CA3AF', textAlign: 'right', marginBottom: 4 },
  rewardRow:         { flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'flex-end' },
  rewardText:        { fontSize: 11, color: '#D4A843', fontWeight: '600' },

  recentList:        { marginBottom: 14, backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12 },
  recentLabel:       { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.5, marginBottom: 10 },
  recentItem:        { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8 },
  recentItemBorder:  { borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  recentItemEmoji:   { fontSize: 17, width: 24, textAlign: 'center', marginTop: 1 },
  recentItemLabel:   { fontSize: 13, fontWeight: '600', color: '#1A1A2E', marginBottom: 2 },
  recentItemNote:    { fontSize: 12, color: '#6B7280', lineHeight: 18, fontStyle: 'italic' },
  recentItemDate:    { fontSize: 11, color: '#9CA3AF', marginTop: 2 },

  logBtn:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#EDF7F2', borderRadius: 12, paddingVertical: 13, borderWidth: 1, borderColor: '#BBF7D0' },
  logBtnText:        { fontSize: 14, fontWeight: '700', color: '#1B3D2F' },

  modalContainer:    { flex: 1, backgroundColor: '#FFFFFF' },
  modalHeader:       { padding: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', position: 'relative' },
  modalTitle:        { fontSize: 18, fontWeight: '800', color: '#1A1A2E', marginBottom: 2 },
  modalSub:          { fontSize: 13, color: '#9CA3AF' },
  modalClose:        { position: 'absolute', right: 20, top: 20 },
  modalScroll:       { padding: 20, paddingBottom: 8 },

  mannerGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  mannerBtn:         { width: '30%', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4, backgroundColor: '#F9FAFB', borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB', gap: 4 },
  mannerBtnActive:   { backgroundColor: '#EDF7F2', borderColor: '#2E7D62' },
  mannerEmoji:       { fontSize: 22 },
  mannerLabel:       { fontSize: 10, fontWeight: '600', color: '#6B7280', textAlign: 'center' },
  mannerLabelActive: { color: '#2E7D62' },

  noteLabel:         { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  noteInput:         { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, fontSize: 13, color: '#1A1A2E', minHeight: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 20 },

  saveBtn:           { margin: 20, marginTop: 12, backgroundColor: '#1B3D2F', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  saveBtnText:       { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

  // Settings
  settingsSectionTitle: { fontSize: 15, fontWeight: '800', color: '#1A1A2E', marginBottom: 4 },
  settingsSectionSub:   { fontSize: 12, color: '#9CA3AF', marginBottom: 16 },
  settingsRow:          { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  settingsRowLabel:     { fontSize: 14, fontWeight: '600', color: '#1A1A2E' },
  settingsRowSub:       { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  settingsNumInput:     { backgroundColor: '#F9FAFB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, fontWeight: '700', color: '#1A1A2E', borderWidth: 1, borderColor: '#E5E7EB', width: 64, textAlign: 'center' },
  settingsUnit:         { fontSize: 12, color: '#9CA3AF' },
  settingsRewardRow:    { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  settingsRewardInput:  { marginTop: 8, backgroundColor: '#F9FAFB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#1A1A2E', borderWidth: 1, borderColor: '#E5E7EB' },

  // Celebration modal
  celebOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  celebCard:         { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 28, alignItems: 'center', width: '100%' },
  celebEmoji:        { fontSize: 48, marginBottom: 12 },
  celebTitle:        { fontSize: 22, fontWeight: '800', color: '#1A1A2E', marginBottom: 6 },
  celebSub:          { fontSize: 14, color: '#6B7280', marginBottom: 4 },
  celebStage:        { fontSize: 20, fontWeight: '700', color: '#2E7D62', marginBottom: 16 },
  celebRewardWrap:   { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF9EE', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 20, borderWidth: 1, borderColor: '#F5D97A' },
  celebReward:       { fontSize: 14, fontWeight: '600', color: '#7C5900', flex: 1 },
  celebBtn:          { backgroundColor: '#1B3D2F', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40 },
  celebBtnText:      { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  // Mini card
  miniCard:          { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, alignItems: 'center', width: 100, borderWidth: 1, borderColor: '#F0F0F0' },
  miniEmoji:         { fontSize: 32, marginBottom: 8 },
  miniNameBadge:     { borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 4 },
  miniName:          { fontSize: 11, fontWeight: '700' },
  miniStage:         { fontSize: 10, color: '#9CA3AF', textAlign: 'center', marginBottom: 2 },
  miniCount:         { fontSize: 10, fontWeight: '600', color: '#2E7D62' },
});
