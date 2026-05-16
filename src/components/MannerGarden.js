import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  TextInput, ScrollView, Animated, KeyboardAvoidingView, Platform, Alert, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { supabase } from '../utils/supabase';
import { getFamilyId } from '../utils/familyGoals';
import { notifyPartner } from '../utils/partnerNotify';

// ── Helpers ───────────────────────────────────────────────────────────────────

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function pronoun(gender) {
  if (gender === 'female') return 'her';
  if (gender === 'male')   return 'his';
  return 'their';
}

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
  { key: 'school',             label: 'School Achievement',    emoji: '🎒' },
  { key: 'other',              label: 'Other',                 emoji: '⭐' },
];

// ── Stage config ──────────────────────────────────────────────────────────────

const STAGE_KEYS = ['sprout', 'sapling', 'tree', 'flowering', 'fruit'];

const DEFAULT_THRESHOLDS = { sprout: 10, sapling: 25, tree: 50, flowering: 100, fruit: 200 };

const STAGE_META = [
  { index: 0, name: 'Seed',               key: 'seed'      },
  { index: 1, name: 'Sprout',             key: 'sprout'    },
  { index: 2, name: 'Young Tree',         key: 'sapling'   },
  { index: 3, name: 'Growing Tree',       key: 'tree'      },
  { index: 4, name: 'Flowering Tree',     key: 'flowering' },
  { index: 5, name: 'Fruit-bearing Tree', key: 'fruit'     },
];

function buildStages(thresholds) {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds };
  return [
    { ...STAGE_META[0], min: 0,           next: t.sprout    },
    { ...STAGE_META[1], min: t.sprout,    next: t.sapling   },
    { ...STAGE_META[2], min: t.sapling,   next: t.tree      },
    { ...STAGE_META[3], min: t.tree,      next: t.flowering },
    { ...STAGE_META[4], min: t.flowering, next: t.fruit     },
    { ...STAGE_META[5], min: t.fruit,     next: null        },
  ];
}

function getStageFromList(stages, total) {
  for (let i = stages.length - 1; i >= 0; i--) {
    if (total >= stages[i].min) return stages[i];
  }
  return stages[0];
}

// ── Multi-tree progression ────────────────────────────────────────────────────

function computeProgress(total, thresholds) {
  const fruit = thresholds?.fruit ?? DEFAULT_THRESHOLDS.fruit;
  const currentTreeDeeds       = total % fruit;
  const completedTrees         = Math.floor(total / fruit);
  const completedOrchards      = Math.floor(completedTrees / 3);
  const jannahGardensCompleted = Math.floor(completedOrchards / 3);
  return {
    currentTreeDeeds,
    completedTrees,
    completedOrchards,
    jannahGardensCompleted,
    treeNumber:   completedTrees + 1,
    orchardNumber: completedOrchards + 1,
    jannahNumber:  jannahGardensCompleted + 1,
  };
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
              stageIndex >= 5 && tree.canopyFruit,
            ]}>
              {stageIndex === 4 && FLOWER_POSITIONS.map((pos, i) => (
                <View key={i} style={[tree.flowerDot, { top: pos.top, left: pos.left }]} />
              ))}
              {stageIndex >= 5 && FRUIT_POSITIONS.map((pos, i) => (
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
  scene:           { width: 200, height: 170, overflow: 'hidden', borderRadius: 20 },
  sky:             { ...StyleSheet.absoluteFillObject },
  earth:           { position: 'absolute', bottom: 0, left: 0, right: 0, height: 28, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  treeWrap:        { position: 'absolute', bottom: 28, left: 0, right: 0, alignItems: 'center' },
  seedWrap:        { alignItems: 'center', marginBottom: -10 },
  seed:            { width: 22, height: 14, borderRadius: 11, backgroundColor: '#92400E' },
  seedCrack:       { width: 2, height: 8, backgroundColor: '#4ADE80', borderRadius: 1, marginTop: -4 },
  sproutWrap:      { alignItems: 'center', width: 60 },
  sproutStem:      { width: 4, height: 38, backgroundColor: '#4ADE80', borderRadius: 2 },
  sproutLeftLeaf:  { position: 'absolute', bottom: 16, left: 6, width: 20, height: 12, backgroundColor: '#86EFAC', borderRadius: 10, transform: [{ rotate: '-35deg' }] },
  sproutRightLeaf: { position: 'absolute', bottom: 16, right: 6, width: 20, height: 12, backgroundColor: '#86EFAC', borderRadius: 10, transform: [{ rotate: '35deg' }] },
  treeContainer:   { alignItems: 'center' },
  canopy:          { overflow: 'hidden', position: 'relative' },
  canopySapling:   { width: 62,  height: 55, borderRadius: 31, backgroundColor: '#BBF7D0', marginBottom: -4 },
  canopyTree:      { width: 95,  height: 82, borderRadius: 48, backgroundColor: '#4ADE80', marginBottom: -6 },
  canopyFlowering: { width: 98,  height: 85, borderRadius: 49, backgroundColor: '#22C55E', marginBottom: -6 },
  canopyFruit:     { width: 102, height: 90, borderRadius: 51, backgroundColor: '#16A34A', marginBottom: -6 },
  trunk:           { borderRadius: 4 },
  trunkSapling:    { width: 10, height: 44 },
  trunkFull:       { width: 14, height: 62 },
  flowerDot:       { position: 'absolute', width: 9,  height: 9,  borderRadius: 5, backgroundColor: '#FEC0D3' },
  fruitDot:        { position: 'absolute', width: 11, height: 11, borderRadius: 6, backgroundColor: '#FCD34D' },
  fruitDotAlt:     { backgroundColor: '#FB923C' },
});

// ── Main component ────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = { thresholds: DEFAULT_THRESHOLDS, rewards: {} };

export default function MannerGarden({ child, myProfileName, partnerLinked, style }) {
  const [actions,         setActions]         = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [settings,        setSettings]        = useState(DEFAULT_SETTINGS);
  const [showModal,       setShowModal]       = useState(false);
  const [showSettings,    setShowSettings]    = useState(false);
  const [selectedManner,  setSelectedManner]  = useState(null);
  const [note,            setNote]            = useState('');
  const [saving,          setSaving]          = useState(false);
  const [savingSettings,  setSavingSettings]  = useState(false);
  const [draftThresholds, setDraftThresholds] = useState({ ...DEFAULT_THRESHOLDS });
  const [draftRewards,    setDraftRewards]    = useState({});
  const [celebEvent,      setCelebEvent]      = useState(null);
  const [showChildView,   setShowChildView]   = useState(false);
  const [sharing,         setSharing]         = useState(false);

  const swayAnim      = useRef(new Animated.Value(0)).current;
  const dropY         = useRef(new Animated.Value(0)).current;
  const dropOpacity   = useRef(new Animated.Value(0)).current;
  const childSwayAnim = useRef(new Animated.Value(0)).current;
  const shareCardRef  = useRef();

  useEffect(() => { loadActions(); loadSettings(); }, [child?.id]);

  useEffect(() => {
    if (!showChildView) { childSwayAnim.setValue(0); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(childSwayAnim, { toValue: 5,  duration: 2200, useNativeDriver: true }),
        Animated.timing(childSwayAnim, { toValue: -4, duration: 2200, useNativeDriver: true }),
        Animated.timing(childSwayAnim, { toValue: 2,  duration: 1600, useNativeDriver: true }),
        Animated.timing(childSwayAnim, { toValue: 0,  duration: 1200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [showChildView]);

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
    const t = draftThresholds;
    if (t.sprout >= t.sapling || t.sapling >= t.tree || t.tree >= t.flowering || t.flowering >= t.fruit) {
      Alert.alert('Invalid thresholds', 'Each stage must require more deeds than the previous one.');
      return;
    }
    setSavingSettings(true);
    try {
      const familyId = await getFamilyId();
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
      Animated.timing(dropY,       { toValue: 90, duration: 700, useNativeDriver: true }),
      Animated.timing(dropOpacity, { toValue: 0,  duration: 700, delay: 200, useNativeDriver: true }),
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
      const fruitThreshold = settings.thresholds?.fruit ?? DEFAULT_THRESHOLDS.fruit;
      const oldTotal = actions.length;
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

      const newTotal          = oldTotal + 1;
      const oldCompletedTrees = Math.floor(oldTotal / fruitThreshold);
      const newCompletedTrees = Math.floor(newTotal / fruitThreshold);

      if (newCompletedTrees > oldCompletedTrees) {
        const oldOrchards = Math.floor(oldCompletedTrees / 3);
        const newOrchards = Math.floor(newCompletedTrees / 3);
        if (newOrchards > oldOrchards) {
          const oldJannah = Math.floor(oldOrchards / 3);
          const newJannah = Math.floor(newOrchards / 3);
          if (newJannah > oldJannah) {
            setCelebEvent({ type: 'jannah', number: newJannah, orchards: newOrchards });
          } else {
            setCelebEvent({ type: 'orchard', number: newOrchards, trees: newCompletedTrees });
          }
        } else {
          const treesLeftInOrchard = 3 - (newCompletedTrees % 3);
          setCelebEvent({ type: 'tree', number: newCompletedTrees, treesLeft: treesLeftInOrchard });
        }
      } else {
        const oldStage = getStageFromList(stages, oldTotal % fruitThreshold);
        const newStage = getStageFromList(stages, newTotal % fruitThreshold);
        if (newStage.index > oldStage.index) {
          setCelebEvent({ type: 'stage', stage: newStage });
        }
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

  async function shareGarden() {
    try {
      setSharing(true);
      const uri = await captureRef(shareCardRef, { format: 'png', quality: 1 });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: `${displayName}'s Good Deeds Garden` });
    } catch { Alert.alert('Could not share', 'Please try again.'); }
    finally { setSharing(false); }
  }

  const total       = actions.length;
  const prog        = computeProgress(total, settings.thresholds);
  const stage       = getStageFromList(stages, prog.currentTreeDeeds);
  const progress    = stage.next ? (prog.currentTreeDeeds - stage.min) / (stage.next - stage.min) : 1;
  const toNext      = stage.next ? stage.next - prog.currentTreeDeeds : 0;
  const nextStage   = stage.next ? stages[stage.index + 1] : null;
  const nextReward  = nextStage ? settings.rewards?.[nextStage.key] : null;
  const displayName = child?.name?.split(' ')[0] ?? 'Your Child';
  const childPronoun = pronoun(child?.gender);
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
        <TouchableOpacity
          onPress={() => { setDraftThresholds({ ...settings.thresholds }); setDraftRewards({ ...settings.rewards }); setShowSettings(true); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ marginLeft: 8 }}
        >
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
          <Text style={gs.deedsCount}>{prog.currentTreeDeeds}</Text>
          <Text style={gs.deedsLabel}>deeds on this tree</Text>
        </View>
      </View>

      {/* Progress to next stage */}
      {stage.next ? (
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
      ) : (
        <Text style={gs.nextTreeHint}>🌱 Next deed starts Tree #{prog.treeNumber + 1}</Text>
      )}

      {/* Achievements summary — only shown once trees have been completed */}
      {prog.completedTrees > 0 && (
        <View style={gs.achieveRow}>
          <View style={gs.achieveItem}>
            <Text style={gs.achieveEmoji}>🌳</Text>
            <Text style={gs.achieveCount}>{prog.completedTrees}</Text>
            <Text style={gs.achieveLabel}>tree{prog.completedTrees !== 1 ? 's' : ''}</Text>
          </View>
          <View style={gs.achieveDivider} />
          <View style={gs.achieveItem}>
            <Text style={gs.achieveEmoji}>🌿</Text>
            <Text style={gs.achieveCount}>{prog.completedOrchards}</Text>
            <Text style={gs.achieveLabel}>orchard{prog.completedOrchards !== 1 ? 's' : ''}</Text>
          </View>
          <View style={gs.achieveDivider} />
          <View style={gs.achieveItem}>
            <Text style={gs.achieveEmoji}>🌴</Text>
            <Text style={gs.achieveCount}>{prog.jannahGardensCompleted}</Text>
            <Text style={gs.achieveLabel}>jannah</Text>
          </View>
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

      <TouchableOpacity style={gs.showChildBtn} onPress={() => setShowChildView(true)} activeOpacity={0.8}>
        <Ionicons name="eye-outline" size={15} color="#2E7D62" />
        <Text style={gs.showChildBtnText}>Show {displayName} {childPronoun} garden</Text>
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

              <Text style={[gs.settingsSectionTitle, { marginTop: 28 }]}>Orchard & Jannah rewards</Text>
              <Text style={gs.settingsSectionSub}>Special celebrations for bigger milestones.</Text>
              {[
                { key: 'orchard', label: 'Orchard complete 🌿', placeholder: 'e.g. "Family dinner out"' },
                { key: 'jannah',  label: 'Jannah Garden 🌴',    placeholder: 'e.g. "Special family trip"' },
              ].map(({ key, label, placeholder }) => (
                <View key={key} style={gs.settingsRewardRow}>
                  <Text style={gs.settingsRowLabel}>{label}</Text>
                  <TextInput
                    style={gs.settingsRewardInput}
                    placeholder={placeholder}
                    placeholderTextColor="#9CA3AF"
                    value={draftRewards[key] ?? ''}
                    onChangeText={v => setDraftRewards(prev => ({ ...prev, [key]: v }))}
                    maxLength={80}
                  />
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={[gs.saveBtn, savingSettings && { opacity: 0.5 }]} onPress={saveSettings} disabled={savingSettings} activeOpacity={0.85}>
              <Text style={gs.saveBtnText}>{savingSettings ? 'Saving…' : 'Save Settings'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Celebration modal ── */}
      <Modal visible={!!celebEvent} transparent animationType="fade" onRequestClose={() => setCelebEvent(null)}>
        <View style={gs.celebOverlay}>
          <View style={gs.celebCard}>
            {celebEvent?.type === 'jannah' && (
              <>
                <Text style={gs.celebEmoji}>🌴</Text>
                <Text style={gs.celebTitle}>SubhanAllah!</Text>
                <Text style={gs.celebSub}>{celebEvent.orchards} orchards grown —</Text>
                <Text style={gs.celebStage}>Jannah Garden #{celebEvent.number}!</Text>
                <Text style={gs.celebNote}>A new garden begins. May it be accepted 🤲</Text>
                {!!settings.rewards?.jannah && (
                  <View style={gs.celebRewardWrap}>
                    <Ionicons name="gift-outline" size={16} color="#D4A843" />
                    <Text style={gs.celebReward}>{settings.rewards.jannah}</Text>
                  </View>
                )}
              </>
            )}
            {celebEvent?.type === 'orchard' && (
              <>
                <Text style={gs.celebEmoji}>🌳🌳🌳</Text>
                <Text style={gs.celebTitle}>Ma Shaa Allah!</Text>
                <Text style={gs.celebSub}>{celebEvent.trees} trees grown —</Text>
                <Text style={gs.celebStage}>{ordinal(celebEvent.number)} Orchard complete! 🌿</Text>
                <Text style={gs.celebNote}>
                  {3 - (celebEvent.number % 3 || 3) === 0
                    ? 'Keep going — a Jannah Garden awaits!'
                    : `${3 - (celebEvent.number % 3 || 3)} more orchard${3 - (celebEvent.number % 3 || 3) !== 1 ? 's' : ''} to a Jannah Garden`}
                </Text>
                {!!settings.rewards?.orchard && (
                  <View style={gs.celebRewardWrap}>
                    <Ionicons name="gift-outline" size={16} color="#D4A843" />
                    <Text style={gs.celebReward}>{settings.rewards.orchard}</Text>
                  </View>
                )}
              </>
            )}
            {celebEvent?.type === 'tree' && (
              <>
                <Text style={gs.celebEmoji}>🎉</Text>
                <Text style={gs.celebTitle}>Ma Shaa Allah!</Text>
                <Text style={gs.celebSub}>{displayName}'s {ordinal(celebEvent.number)} tree is fruit-bearing!</Text>
                <Text style={gs.celebNote}>
                  {celebEvent.treesLeft === 1
                    ? '1 more tree to complete the orchard'
                    : `${celebEvent.treesLeft} more trees to complete the orchard`}
                </Text>
              </>
            )}
            {celebEvent?.type === 'stage' && (
              <>
                <Text style={gs.celebEmoji}>🎉</Text>
                <Text style={gs.celebTitle}>Ma Shaa Allah!</Text>
                <Text style={gs.celebSub}>{displayName}'s tree is now a</Text>
                <Text style={gs.celebStage}>{celebEvent.stage?.name}</Text>
                {!!settings.rewards?.[celebEvent.stage?.key] && (
                  <View style={gs.celebRewardWrap}>
                    <Ionicons name="gift-outline" size={16} color="#D4A843" />
                    <Text style={gs.celebReward}>{settings.rewards[celebEvent.stage.key]}</Text>
                  </View>
                )}
              </>
            )}
            <TouchableOpacity style={[gs.celebBtn, { marginTop: 16 }]} onPress={() => setCelebEvent(null)} activeOpacity={0.85}>
              <Text style={gs.celebBtnText}>Wonderful! 🌱</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setCelebEvent(null); setShowChildView(true); }} activeOpacity={0.75} style={{ marginTop: 12 }}>
              <Text style={gs.celebShowLink}>Show {displayName} {childPronoun} garden →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Child view ── */}
      <Modal visible={showChildView} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => setShowChildView(false)}>
        <LinearGradient colors={['#ECFDF5', '#D1FAE5', '#EFF6FF', '#DBEAFE']} style={{ flex: 1 }}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={cv.header}>
              <TouchableOpacity
                style={cv.closeBtn}
                onPress={() => setShowChildView(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={22} color="rgba(0,0,0,0.35)" />
              </TouchableOpacity>
              <View style={{ flex: 1 }} />
              <TouchableOpacity
                style={[cv.shareBtn, sharing && { opacity: 0.5 }]}
                onPress={shareGarden}
                disabled={sharing}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="share-outline" size={20} color="#2E7D62" />
                <Text style={cv.shareBtnText}>{sharing ? 'Sharing…' : 'Share'}</Text>
              </TouchableOpacity>
            </View>

            {/* Hidden share card — captured by react-native-view-shot */}
            <View ref={shareCardRef} style={sc.card} collapsable={false}>
              <LinearGradient colors={['#ECFDF5', '#D1FAE5', '#EFF6FF', '#DBEAFE']} style={StyleSheet.absoluteFill} />
              <Text style={sc.eyebrow}>GOOD DEEDS GARDEN · TARBIYAH</Text>
              <Text style={sc.name}>{displayName}</Text>
              <Text style={sc.stageName}>{stage.name}</Text>
              <View style={sc.treeWrap}>
                <View style={{ transform: [{ scale: 1.7 }] }}>
                  <TreeIllustration stageIndex={stage.index} swayAnim={swayAnim} />
                </View>
              </View>
              <Text style={sc.deedsNumber}>{total}</Text>
              <Text style={sc.deedsLabel}>good deeds planted 🌱</Text>
              {stage.next && (
                <View style={sc.progressWrap}>
                  <View style={sc.progressTrack}>
                    <View style={[sc.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
                  </View>
                  <Text style={sc.progressLabel}>{toNext} more deed{toNext !== 1 ? 's' : ''} to {nextStage?.name}</Text>
                </View>
              )}
              {!!nextReward && (
                <View style={sc.rewardCard}>
                  <Text style={sc.rewardEmoji}>🎁</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={sc.rewardPre}>Next reward</Text>
                    <Text style={sc.rewardText}>{nextReward}</Text>
                  </View>
                </View>
              )}
              {prog.completedTrees > 0 && (
                <View style={sc.achieveRow}>
                  <Text style={sc.achieveItem}>🌳 {prog.completedTrees} tree{prog.completedTrees !== 1 ? 's' : ''}</Text>
                  <Text style={sc.achieveSep}>·</Text>
                  <Text style={sc.achieveItem}>🌿 {prog.completedOrchards} orchard{prog.completedOrchards !== 1 ? 's' : ''}</Text>
                  <Text style={sc.achieveSep}>·</Text>
                  <Text style={sc.achieveItem}>🌴 {prog.jannahGardensCompleted} jannah</Text>
                </View>
              )}
            </View>

            <ScrollView contentContainerStyle={cv.scroll} showsVerticalScrollIndicator={false}>
              <Text style={cv.childName}>{displayName}</Text>
              <Text style={cv.stageName}>{stage.name}</Text>

              <View style={cv.treeWrap}>
                <View style={{ transform: [{ scale: 1.65 }] }}>
                  <TreeIllustration stageIndex={stage.index} swayAnim={childSwayAnim} />
                </View>
              </View>

              <View style={cv.deedsWrap}>
                <Text style={cv.deedsNumber}>{total}</Text>
                <Text style={cv.deedsLabel}>total good deeds 🌱</Text>
              </View>

              {/* Next stage card */}
              {stage.next ? (
                <View style={cv.nextCard}>
                  <Text style={cv.nextStageName}>🌿 Next stage is {nextStage?.name}</Text>
                  <View style={cv.nextDeedsRow}>
                    <Text style={cv.nextDeedsNumber}>{toNext}</Text>
                    <Text style={cv.nextDeedsUnit}>more deed{toNext !== 1 ? 's' : ''} to go</Text>
                  </View>
                  <View style={cv.progressTrack}>
                    <View style={[cv.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
                  </View>
                  {!!nextReward && (
                    <View style={cv.rewardRow}>
                      <Text style={cv.rewardEmoji}>🎁</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={cv.rewardPre}>Reward when you get there</Text>
                        <Text style={cv.rewardText}>{nextReward}</Text>
                      </View>
                    </View>
                  )}
                </View>
              ) : (
                <View style={cv.nextCard}>
                  <Text style={cv.nextStageName}>🌳 This tree is fruit-bearing!</Text>
                  <Text style={cv.nextDeedsUnit}>One more deed starts Tree #{prog.treeNumber + 1}</Text>
                </View>
              )}

              {/* Achievements — shown once at least 1 tree is complete */}
              {prog.completedTrees > 0 && (
                <View style={cv.achieveCard}>
                  <Text style={cv.achieveTitle}>Achievements</Text>
                  <View style={cv.achieveRow}>
                    <Text style={cv.achieveEmoji}>🌳</Text>
                    <Text style={cv.achieveLabel}>Trees completed</Text>
                    <Text style={cv.achieveCount}>{prog.completedTrees}</Text>
                  </View>
                  <View style={[cv.achieveRow, cv.achieveRowBorder]}>
                    <Text style={cv.achieveEmoji}>🌿</Text>
                    <Text style={cv.achieveLabel}>Orchards</Text>
                    <Text style={cv.achieveCount}>{prog.completedOrchards}</Text>
                  </View>
                  <View style={cv.achieveRow}>
                    <Text style={cv.achieveEmoji}>🌴</Text>
                    <Text style={cv.achieveLabel}>Jannah Gardens</Text>
                    <Text style={cv.achieveCount}>{prog.jannahGardensCompleted}</Text>
                  </View>
                </View>
              )}

              {actions.length > 0 && (
                <View style={cv.recentWrap}>
                  <Text style={cv.recentTitle}>Recent good deeds</Text>
                  {actions.slice(0, 5).map((a, idx) => {
                    const m = MANNERS.find(m => m.key === a.manner);
                    return (
                      <View key={a.id} style={[cv.recentRow, idx < Math.min(actions.length, 5) - 1 && cv.recentRowBorder]}>
                        <Text style={cv.recentEmoji}>{m?.emoji ?? '✨'}</Text>
                        <Text style={cv.recentLabel}>{m?.label ?? a.manner}</Text>
                      </View>
                    );
                  })}
                </View>
              )}

              <Text style={cv.motivation}>Ma Shaa Allah! Keep growing! 🤲</Text>
            </ScrollView>
          </SafeAreaView>
        </LinearGradient>
      </Modal>

    </View>
  );
}

// ── Mini version for family garden view ───────────────────────────────────────

export function MiniGardenCard({ childName, total, color }) {
  const stage = getStageFromList(buildStages(DEFAULT_THRESHOLDS), total % DEFAULT_THRESHOLDS.fruit);
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

  sceneWrap:         { alignItems: 'center', marginBottom: 12, position: 'relative' },
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
  nextTreeHint:      { fontSize: 11, color: '#2E7D62', fontWeight: '600', textAlign: 'center', marginBottom: 14 },

  achieveRow:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, marginBottom: 14, gap: 0 },
  achieveItem:       { flex: 1, alignItems: 'center', gap: 2 },
  achieveDivider:    { width: 1, height: 32, backgroundColor: '#E5E7EB' },
  achieveEmoji:      { fontSize: 18 },
  achieveCount:      { fontSize: 17, fontWeight: '800', color: '#1A1A2E' },
  achieveLabel:      { fontSize: 10, color: '#9CA3AF', fontWeight: '600' },

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
  showChildBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10 },
  showChildBtnText:  { fontSize: 13, fontWeight: '600', color: '#2E7D62' },

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

  settingsSectionTitle: { fontSize: 15, fontWeight: '800', color: '#1A1A2E', marginBottom: 4 },
  settingsSectionSub:   { fontSize: 12, color: '#9CA3AF', marginBottom: 16 },
  settingsRow:          { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  settingsRowLabel:     { fontSize: 14, fontWeight: '600', color: '#1A1A2E' },
  settingsRowSub:       { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  settingsNumInput:     { backgroundColor: '#F9FAFB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, fontWeight: '700', color: '#1A1A2E', borderWidth: 1, borderColor: '#E5E7EB', width: 64, textAlign: 'center' },
  settingsUnit:         { fontSize: 12, color: '#9CA3AF' },
  settingsRewardRow:    { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  settingsRewardInput:  { marginTop: 8, backgroundColor: '#F9FAFB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#1A1A2E', borderWidth: 1, borderColor: '#E5E7EB' },

  celebOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  celebCard:         { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 28, alignItems: 'center', width: '100%' },
  celebEmoji:        { fontSize: 48, marginBottom: 12 },
  celebTitle:        { fontSize: 22, fontWeight: '800', color: '#1A1A2E', marginBottom: 6 },
  celebSub:          { fontSize: 14, color: '#6B7280', marginBottom: 4 },
  celebStage:        { fontSize: 20, fontWeight: '700', color: '#2E7D62', marginBottom: 8 },
  celebNote:         { fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginBottom: 4 },
  celebRewardWrap:   { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF9EE', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 4, borderWidth: 1, borderColor: '#F5D97A' },
  celebReward:       { fontSize: 14, fontWeight: '600', color: '#7C5900', flex: 1 },
  celebBtn:          { backgroundColor: '#1B3D2F', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40 },
  celebBtnText:      { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  celebShowLink:     { fontSize: 13, fontWeight: '600', color: '#2E7D62' },

  miniCard:          { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, alignItems: 'center', width: 100, borderWidth: 1, borderColor: '#F0F0F0' },
  miniEmoji:         { fontSize: 32, marginBottom: 8 },
  miniNameBadge:     { borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 4 },
  miniName:          { fontSize: 11, fontWeight: '700' },
  miniStage:         { fontSize: 10, color: '#9CA3AF', textAlign: 'center', marginBottom: 2 },
  miniCount:         { fontSize: 10, fontWeight: '600', color: '#2E7D62' },
});

// ── Child view styles ─────────────────────────────────────────────────────────

const cv = StyleSheet.create({
  header:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  closeBtn:        { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.08)', alignItems: 'center', justifyContent: 'center' },
  scroll:          { alignItems: 'center', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 48 },
  childName:       { fontSize: 40, fontWeight: '900', color: '#1A1A2E', textAlign: 'center', marginTop: 24, marginBottom: 4 },
  stageName:       { fontSize: 16, fontWeight: '700', color: '#2E7D62', marginBottom: 28 },
  treeWrap:        { height: 290, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  deedsWrap:       { alignItems: 'center', marginBottom: 20 },
  deedsNumber:     { fontSize: 60, fontWeight: '900', color: '#1B3D2F', lineHeight: 68 },
  deedsLabel:      { fontSize: 15, color: '#6B7280', fontWeight: '500' },

  nextCard:        { width: '100%', backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 20, padding: 20, marginBottom: 20, gap: 14 },
  nextStageName:   { fontSize: 15, fontWeight: '800', color: '#2E7D62' },
  nextDeedsRow:    { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  nextDeedsNumber: { fontSize: 52, fontWeight: '900', color: '#1B3D2F', lineHeight: 56 },
  nextDeedsUnit:   { fontSize: 15, fontWeight: '600', color: '#6B7280', paddingBottom: 8 },
  progressTrack:   { height: 10, backgroundColor: 'rgba(46,125,98,0.15)', borderRadius: 100, overflow: 'hidden' },
  progressFill:    { height: 10, backgroundColor: '#2E7D62', borderRadius: 100 },
  rewardRow:       { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#FEF9EE', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#F5D97A' },
  rewardEmoji:     { fontSize: 28 },
  rewardPre:       { fontSize: 11, fontWeight: '700', color: '#B99A3A', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 3 },
  rewardText:      { fontSize: 16, fontWeight: '800', color: '#7C5900' },

  achieveCard:     { width: '100%', backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 18, padding: 16, marginBottom: 20 },
  achieveTitle:    { fontSize: 11, fontWeight: '800', color: '#9CA3AF', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 },
  achieveRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  achieveRowBorder:{ borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(0,0,0,0.06)' },
  achieveEmoji:    { fontSize: 20, width: 28, textAlign: 'center' },
  achieveLabel:    { flex: 1, fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  achieveCount:    { fontSize: 20, fontWeight: '900', color: '#2E7D62' },

  recentWrap:      { width: '100%', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 16, padding: 16, marginBottom: 20 },
  recentTitle:     { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.5, marginBottom: 12, textTransform: 'uppercase' },
  recentRow:       { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8 },
  recentRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' },
  recentEmoji:     { fontSize: 22, width: 30, textAlign: 'center' },
  recentLabel:     { fontSize: 16, fontWeight: '600', color: '#1A1A2E' },
  motivation:      { fontSize: 15, fontWeight: '600', color: '#2E7D62', textAlign: 'center', opacity: 0.8 },
  shareBtn:        { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(46,125,98,0.1)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  shareBtnText:    { fontSize: 13, fontWeight: '700', color: '#2E7D62' },
});

// ── Share card styles (fixed 360×580 for image capture) ───────────────────────

const sc = StyleSheet.create({
  card:          { width: 360, height: 580, padding: 28, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'absolute', top: -9999, left: 0 },
  eyebrow:       { fontSize: 9, fontWeight: '800', color: '#2E7D62', letterSpacing: 1.5, marginBottom: 12, textTransform: 'uppercase' },
  name:          { fontSize: 38, fontWeight: '900', color: '#1A1A2E', textAlign: 'center', marginBottom: 4 },
  stageName:     { fontSize: 14, fontWeight: '700', color: '#2E7D62', marginBottom: 20 },
  treeWrap:      { height: 200, alignItems: 'center', justifyContent: 'center', marginBottom: 64 },
  deedsNumber:   { fontSize: 52, fontWeight: '900', color: '#1B3D2F', lineHeight: 56 },
  deedsLabel:    { fontSize: 13, color: '#6B7280', fontWeight: '500', marginBottom: 16 },
  progressWrap:  { width: '100%', marginBottom: 16 },
  progressTrack: { height: 8, backgroundColor: 'rgba(46,125,98,0.15)', borderRadius: 100, overflow: 'hidden', marginBottom: 6 },
  progressFill:  { height: 8, backgroundColor: '#2E7D62', borderRadius: 100 },
  progressLabel: { fontSize: 11, color: '#6B7280', textAlign: 'center' },
  rewardCard:    { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FEF9EE', borderRadius: 14, padding: 14, width: '100%', marginBottom: 16, borderWidth: 1.5, borderColor: '#F5D97A' },
  rewardEmoji:   { fontSize: 24 },
  rewardPre:     { fontSize: 9, fontWeight: '700', color: '#B99A3A', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 },
  rewardText:    { fontSize: 14, fontWeight: '800', color: '#7C5900' },
  achieveRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
  achieveItem:   { fontSize: 12, fontWeight: '600', color: '#374151' },
  achieveSep:    { fontSize: 12, color: '#D1D5DB' },
});
