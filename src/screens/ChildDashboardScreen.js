import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, Alert, TextInput, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
let ImagePicker = null;
try { ImagePicker = require('expo-image-picker'); } catch {}
import { getChildProfile, updateChildProfile, deleteChildProfile } from '../utils/childProfiles';
import { uploadPhoto } from '../utils/uploadPhoto';

// ── Option lists (same as wizard) ─────────────────────────────────────────────

const STRENGTHS_OPTIONS = [
  'Empathetic', 'Creative', 'Curious', 'Kind', 'Confident',
  'Patient', 'Helpful', 'Brave', 'Honest', 'Joyful',
  'Gentle', 'Persistent', 'Loving', 'Imaginative', 'Thoughtful',
];

const TEMPERAMENT_OPTIONS = [
  'Sensitive', 'High Energy', 'Easy-going', 'Slow-to-warm',
  'Analytical', 'Impulsive', 'Independent', 'Social',
  'Shy', 'Adaptable', 'Strong-willed', 'Cautious',
];

const INTEREST_OPTIONS = [
  'Lego', 'Football', 'Drawing', 'Animals', 'Space',
  'Cooking', 'Reading', 'Music', 'Gaming', 'Sports',
  'Nature', 'Art', 'Science', 'Dinosaurs', 'Cars',
  'Superheroes', 'Dance', 'Swimming', 'Cycling', 'Building',
];

const SPECIAL_NEEDS_OPTIONS = [
  'ADHD', 'Autism / ASD', 'Down Syndrome', 'Dyslexia',
  'Anxiety', 'Sensory Differences', 'Speech / Language Delay',
  'Learning Differences', 'Physical Disability', 'Gifted / Advanced Learner',
];

const FIELD_CONFIG = {
  strengths:    { title: "Strengths",           options: STRENGTHS_OPTIONS,     color: '#B45309', bg: '#FEF3E7', allowCustom: false },
  temperaments: { title: "Temperament",         options: TEMPERAMENT_OPTIONS,   color: '#1B4D3E', bg: '#E6F4ED', allowCustom: false },
  interests:    { title: "Interests",           options: INTEREST_OPTIONS,      color: '#1B4D3E', bg: '#E6F4ED', allowCustom: true  },
  specialNeeds: { title: "Additional Context",  options: SPECIAL_NEEDS_OPTIONS, color: '#1B4D3E', bg: '#E6F4ED', allowCustom: true  },
};

const GRADE_OPTIONS = [
  'No school yet', 'Nursery', 'Pre-K', 'Kindergarten',
  '1st Grade', '2nd Grade', '3rd Grade', '4th Grade',
  '5th Grade', '6th Grade', '7th Grade', '8th Grade',
  '9th Grade', '10th Grade', '11th Grade', '12th Grade',
  'College',
];

// ── Quick edit modal (name, age, grade) ──────────────────────────────────────

function QuickEditModal({ visible, child, onClose }) {
  const insets = useSafeAreaInsets();
  const [name, setName]   = useState(child?.name ?? '');
  const [age,  setAge]    = useState(child?.age?.toString() ?? '');
  const [grade, setGrade] = useState(child?.stage ?? null);

  useEffect(() => {
    if (visible && child) {
      setName(child.name ?? '');
      setAge(child.age?.toString() ?? '');
      setGrade(child.stage ?? null);
    }
  }, [visible]);

  const canSave = name.trim().length > 0 && age.length > 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => onClose(null)}>
      <SafeAreaView style={modal.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={modal.header}>
            <TouchableOpacity onPress={() => onClose(null)} style={modal.cancelBtn}>
              <Text style={modal.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={modal.title}>Edit Profile</Text>
            <TouchableOpacity
              onPress={() => canSave && onClose({ name: name.trim(), age: parseInt(age) || 0, stage: grade })}
              style={modal.doneBtn}
            >
              <Text style={[modal.doneText, !canSave && { opacity: 0.35 }]}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={modal.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Name */}
            <Text style={modal.fieldLabel}>NAME</Text>
            <TextInput
              style={modal.textInput}
              value={name}
              onChangeText={setName}
              placeholder="Child's name"
              placeholderTextColor="#9CA3AF"
              autoCorrect={false}
            />

            {/* Age */}
            <Text style={[modal.fieldLabel, { marginTop: 24 }]}>AGE</Text>
            <View style={modal.ageRow}>
              <TouchableOpacity
                style={modal.ageStepBtn}
                onPress={() => setAge(a => String(Math.max(1, (parseInt(a) || 0) - 1)))}
                activeOpacity={0.7}
              >
                <Ionicons name="remove" size={20} color="#374151" />
              </TouchableOpacity>
              <TextInput
                style={modal.ageInput}
                value={age}
                onChangeText={v => {
                  const n = v.replace(/[^0-9]/g, '');
                  if (n === '' || (parseInt(n) >= 1 && parseInt(n) <= 99)) setAge(n);
                }}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="—"
                placeholderTextColor="#9CA3AF"
                textAlign="center"
              />
              <TouchableOpacity
                style={modal.ageStepBtn}
                onPress={() => setAge(a => String(Math.min(99, (parseInt(a) || 0) + 1)))}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={20} color="#374151" />
              </TouchableOpacity>
            </View>

            {/* Grade */}
            <Text style={[modal.fieldLabel, { marginTop: 24 }]}>GRADE / STAGE</Text>
            <View style={modal.gradeList}>
              {GRADE_OPTIONS.map(g => (
                <TouchableOpacity
                  key={g}
                  style={[modal.gradeRow, grade === g && modal.gradeRowActive]}
                  onPress={() => setGrade(g)}
                  activeOpacity={0.75}
                >
                  <Text style={[modal.gradeText, grade === g && modal.gradeTextActive]}>{g}</Text>
                  {grade === g && <Ionicons name="checkmark-circle" size={18} color="#2E7D62" />}
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Chip edit modal ───────────────────────────────────────────────────────────

function ChipEditModal({ visible, field, current, onClose }) {
  const insets = useSafeAreaInsets();
  const cfg = field ? FIELD_CONFIG[field] : null;
  const [selected, setSelected] = useState(current ?? []);
  const [custom, setCustom]     = useState('');

  useEffect(() => {
    if (visible) setSelected(current ?? []);
  }, [visible]);

  function toggle(item) {
    setSelected(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
  }

  function addCustom() {
    const t = custom.trim();
    if (!t || selected.includes(t)) { setCustom(''); return; }
    setSelected(prev => [...prev, t]);
    setCustom('');
  }

  function handleDone() {
    onClose(selected);
  }

  if (!cfg) return null;

  const preset  = cfg.options;
  const customs = selected.filter(s => !preset.includes(s));

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => onClose(null)}>
      <SafeAreaView style={modal.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

          {/* Header */}
          <View style={modal.header}>
            <TouchableOpacity onPress={() => onClose(null)} style={modal.cancelBtn}>
              <Text style={modal.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={modal.title}>{cfg.title}</Text>
            <TouchableOpacity onPress={handleDone} style={modal.doneBtn}>
              <Text style={modal.doneText}>Done</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={modal.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={modal.chipWrap}>
              {preset.map(opt => {
                const active = selected.includes(opt);
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[modal.chip, active && { backgroundColor: cfg.bg, borderColor: cfg.color, borderWidth: 1.5 }]}
                    onPress={() => toggle(opt)}
                    activeOpacity={0.75}
                  >
                    {active && <Ionicons name="checkmark" size={12} color={cfg.color} />}
                    <Text style={[modal.chipText, active && { color: cfg.color, fontWeight: '700' }]}>{opt}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Custom entries */}
            {customs.length > 0 && (
              <View style={modal.customList}>
                {customs.map(c => (
                  <View key={c} style={modal.customChip}>
                    <Text style={modal.customChipText}>{c}</Text>
                    <TouchableOpacity onPress={() => setSelected(prev => prev.filter(i => i !== c))}>
                      <Ionicons name="close-circle" size={16} color="#9CA3AF" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Custom input for interests */}
            {cfg.allowCustom && (
              <View style={modal.customRow}>
                <TextInput
                  style={modal.customInput}
                  placeholder="Add your own…"
                  placeholderTextColor="#9CA3AF"
                  value={custom}
                  onChangeText={setCustom}
                  onSubmitEditing={addCustom}
                  returnKeyType="done"
                />
                <TouchableOpacity style={modal.customAddBtn} onPress={addCustom}>
                  <Ionicons name="add" size={20} color="#1B3D2F" />
                </TouchableOpacity>
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CARD_SHADOW = {
  shadowColor: '#1B3D2F',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 10,
  elevation: 4,
};

// ── Screen ────────────────────────────────────────────────────────────────────

const SCHOOLING_OPTIONS = [
  { key: 'islamic', label: 'Islamic School', icon: 'moon',           color: '#1B4D3E', bg: '#E6F4ED' },
  { key: 'public',  label: 'Public School',  icon: 'school-outline', color: '#1D4ED8', bg: '#EFF6FF' },
  { key: 'home',    label: 'Home School',    icon: 'home-outline',   color: '#7C3AED', bg: '#F3EEFF' },
  { key: 'none',    label: 'No School Yet',  icon: 'happy-outline',  color: '#B45309', bg: '#FEF3E7' },
];

export default function ChildDashboardScreen({ navigation, route }) {
  const initialChild = route?.params?.child;
  const [childData, setChildData] = useState(initialChild ?? null);
  const [schooling, setSchooling] = useState(initialChild?.schooling ?? null);
  const [editField, setEditField]         = useState(null);
  const [quickEditVisible, setQuickEdit]  = useState(false);

  useFocusEffect(useCallback(() => {
    if (!initialChild?.id) return;
    getChildProfile(initialChild.id).then(profile => {
      if (profile) {
        setChildData(profile);
        setSchooling(profile.schooling ?? null);
      }
    });
  }, [initialChild?.id]));

  const child = childData ?? initialChild;
  const displayName = child
    ? (child.name.length > 12 ? child.name.slice(0, 12).trimEnd() + '…' : child.name)
    : '';

  if (!child) return null;

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleChipSave(newValue) {
    setEditField(null);
    if (newValue === null || !editField) return;
    const profile = await updateChildProfile(child.id, { [editField]: newValue });
    if (profile) setChildData(profile);
  }

  async function handleDeleteGrowthArea(areaId) {
    const updated = (child.growthAreas ?? []).filter(a => a.id !== areaId);
    const profile = await updateChildProfile(child.id, { growthAreas: updated });
    if (profile) setChildData(profile);
  }

  async function handleQuickEditSave(updates) {
    setQuickEdit(false);
    if (!updates) return;
    const profile = await updateChildProfile(child.id, updates);
    if (profile) setChildData(profile);
  }

  async function handleEditPhoto() {
    if (!ImagePicker) { Alert.alert('Unavailable', 'Please rebuild the app to enable photo selection.'); return; }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled) {
      const localUri = result.assets[0].uri;
      const photoUrl = await uploadPhoto(localUri, `children/${child.id}.jpg`).catch(() => localUri);
      const profile = await updateChildProfile(child.id, { photo: photoUrl });
      if (profile) setChildData(profile);
    }
  }

  function handleDeleteChild() {
    Alert.alert(
      `Remove ${child.name}?`,
      'This will permanently delete their profile, growth areas, and all associated data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteChildProfile(child.id);
            navigation.goBack();
          },
        },
      ]
    );
  }

  function openGrowthAreaMenu(area) {
    Alert.alert(area.title, 'What would you like to do?', [
      {
        text: 'Delete growth area',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Delete growth area?', 'This will remove the area and its 4-week plan.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => handleDeleteGrowthArea(area.id) },
          ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function handleAddGrowthArea() {
    if ((child.growthAreas ?? []).length >= 2) {
      Alert.alert(
        'Growth areas are limited to 2',
        'We keep it to 2 at a time so you can stay focused and see real progress. Research shows consistent attention on fewer areas leads to deeper, lasting change — rather than spreading effort too thin.\n\nComplete or remove a current growth area before adding a new one.',
        [{ text: 'Got it', style: 'default' }]
      );
      return;
    }
    navigation.navigate('GrowthAreaWizard', { child, isFirstTime: false });
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Ionicons name="chevron-back" size={22} color="#1A1A2E" />
          </TouchableOpacity>
          <View style={styles.headerMid}>
            <Text style={styles.headerTitle}>{child.name}'s Profile</Text>
            <Text style={styles.headerSub}>Age {child.age} · {child.stage ?? '—'}</Text>
          </View>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setQuickEdit(true)}>
            <Ionicons name="pencil-outline" size={18} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* ── Photo avatar ── */}
        <View style={styles.avatarWrap}>
          <TouchableOpacity onPress={handleEditPhoto} activeOpacity={0.85} style={styles.avatarOuter}>
            <View style={[styles.avatarCircle, { backgroundColor: child.color }]}>
              {child.photo
                ? <Image source={{ uri: child.photo }} style={styles.avatarPhoto} />
                : <Text style={styles.avatarInitial}>{child.name[0]}</Text>
              }
            </View>
            <View style={[styles.avatarCameraBadge, { backgroundColor: child.color }]}>
              <Ionicons name="camera" size={13} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Growth Areas ── */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>{displayName.toUpperCase()}'S GROWTH AREAS</Text>
          <TouchableOpacity onPress={handleAddGrowthArea}>
            <Text style={styles.sectionLink}>+ Add</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.sectionSub}>
          Up to 2 areas of focus at a time. Fewer areas means deeper focus and better results.
        </Text>
        {(child.growthAreas ?? []).length === 0 && (
          <TouchableOpacity style={styles.emptyCard} onPress={handleAddGrowthArea} activeOpacity={0.8}>
            <Ionicons name="add-circle-outline" size={22} color="#2E7D62" />
            <Text style={styles.emptyCardText}>Add {child.name}'s first growth area</Text>
            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        )}
        {(child.growthAreas ?? []).map((m, i) => (
          <TouchableOpacity
            key={m.id}
            style={styles.milestoneRow}
            onPress={() => navigation.navigate('GrowthAreaPlan', { area: m, child })}
            activeOpacity={0.8}
          >
            <View style={[styles.milestoneNumBadge, { backgroundColor: child.color + '18' }]}>
              <Text style={[styles.milestoneNum, { color: child.color }]}>{i + 1}</Text>
            </View>
            <View style={styles.milestoneRowText}>
              <Text style={styles.milestoneName}>{m.title}</Text>
              <Text style={styles.milestoneDesc} numberOfLines={1}>{m.description}</Text>
            </View>
            <TouchableOpacity
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => openGrowthAreaMenu(m)}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}

        {/* ── Strengths ── */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>{displayName.toUpperCase()}'S STRENGTHS</Text>
          <TouchableOpacity onPress={() => setEditField('strengths')}>
            <Text style={styles.sectionLink}>Edit</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.sectionSub}>
          Character traits and qualities you've observed in {child.name}. Used to personalise insights.
        </Text>
        <View style={styles.chipCard}>
          {(child.strengths ?? []).map(s => (
            <View key={s} style={styles.strengthChip}>
              <Ionicons name="star" size={11} color="#B45309" />
              <Text style={styles.strengthChipText}>{s}</Text>
            </View>
          ))}
          {(child.strengths ?? []).length === 0 && (
            <Text style={styles.noneText}>None added yet</Text>
          )}
          <TouchableOpacity style={styles.addChip} onPress={() => setEditField('strengths')}>
            <Ionicons name="add" size={13} color="#9CA3AF" />
            <Text style={styles.addChipText}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* ── Temperament ── */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>{displayName.toUpperCase()}'S TEMPERAMENT</Text>
          <TouchableOpacity onPress={() => setEditField('temperaments')}>
            <Text style={styles.sectionLink}>Edit</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.sectionSub}>
          How {child.name} is wired — helps tailor the tone and approach of coaching suggestions.
        </Text>
        <View style={styles.chipCard}>
          {(child.temperaments ?? []).map(t => (
            <View key={t} style={styles.temperamentChip}>
              <Text style={styles.temperamentChipText}>{t}</Text>
            </View>
          ))}
          {(child.temperaments ?? []).length === 0 && (
            <Text style={styles.noneText}>None added yet</Text>
          )}
          <TouchableOpacity style={styles.addChip} onPress={() => setEditField('temperaments')}>
            <Ionicons name="add" size={13} color="#9CA3AF" />
            <Text style={styles.addChipText}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* ── Interests ── */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>{displayName.toUpperCase()}'S INTERESTS</Text>
          <TouchableOpacity onPress={() => setEditField('interests')}>
            <Text style={styles.sectionLink}>Edit</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.sectionSub}>
          What {child.name} loves doing. Used to suggest activities and make examples more relatable.
        </Text>
        <View style={styles.chipCard}>
          {(child.interests ?? []).map(interest => (
            <View key={interest} style={styles.interestChip}>
              <Ionicons name="heart" size={11} color="#BE185D" />
              <Text style={styles.interestChipText}>{interest}</Text>
            </View>
          ))}
          {(child.interests ?? []).length === 0 && (
            <Text style={styles.noneText}>None added yet</Text>
          )}
          <TouchableOpacity style={styles.addChip} onPress={() => setEditField('interests')}>
            <Ionicons name="add" size={13} color="#9CA3AF" />
            <Text style={styles.addChipText}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* ── Additional Context ── */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>ADDITIONAL CONTEXT</Text>
          <TouchableOpacity onPress={() => setEditField('specialNeeds')}>
            <Text style={styles.sectionLink}>Edit</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.sectionSub}>
          Any additional needs or considerations. Stays private and helps personalise advice for {child.name}.
        </Text>
        <View style={styles.chipCard}>
          {(child.specialNeeds ?? []).map(item => (
            <View key={item} style={styles.interestChip}>
              <Text style={styles.interestChipText}>{item}</Text>
            </View>
          ))}
          {(child.specialNeeds ?? []).length === 0 && (
            <Text style={styles.noneText}>None added</Text>
          )}
          <TouchableOpacity style={styles.addChip} onPress={() => setEditField('specialNeeds')}>
            <Ionicons name="add" size={13} color="#9CA3AF" />
            <Text style={styles.addChipText}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* ── Schooling Context ── */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>SCHOOLING CONTEXT</Text>
        </View>
        <Text style={styles.sectionSub}>
          Helps us understand what {child.name} is exposed to and tailor guidance accordingly.
        </Text>
        <View style={styles.schoolingGrid}>
          {SCHOOLING_OPTIONS.map(opt => {
            const active = schooling === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.schoolingCard, active && { borderColor: opt.color, borderWidth: 2 }]}
                onPress={() => {
                  const next = active ? null : opt.key;
                  setSchooling(next);
                  if (child?.id) updateChildProfile(child.id, { schooling: next });
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.schoolingIcon, { backgroundColor: active ? opt.color : opt.bg }]}>
                  <Ionicons name={opt.icon} size={20} color={active ? '#FFFFFF' : opt.color} />
                </View>
                <Text style={[styles.schoolingLabel, active && { color: opt.color, fontWeight: '700' }]}>
                  {opt.label}
                </Text>
                {active && (
                  <View style={[styles.schoolingCheck, { backgroundColor: opt.color }]}>
                    <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: 40 }} />

        <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteChild} activeOpacity={0.7}>
          <Text style={styles.deleteBtnText}>Remove {child.name}'s profile</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Chip edit modal ── */}
      <ChipEditModal
        visible={!!editField}
        field={editField}
        current={editField ? (child[editField] ?? []) : []}
        onClose={handleChipSave}
      />

      {/* ── Quick edit modal ── */}
      <QuickEditModal
        visible={quickEditVisible}
        child={child}
        onClose={handleQuickEditSave}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: '#F5F6F8' },
  scroll:  { flex: 1 },
  content: { paddingTop: 12, paddingBottom: 40, paddingHorizontal: 20 },

  // Header
  header:    { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 10 },
  headerBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center',
    ...CARD_SHADOW, borderWidth: 1, borderColor: '#EEF0F2',
  },
  headerMid:   { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1A1A2E' },
  headerSub:   { fontSize: 13, color: '#6B7280', fontWeight: '500', marginTop: 2 },

  // Section rows
  sectionRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 4, marginTop: 20,
  },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#6B7280', letterSpacing: 1 },
  sectionLink:  { fontSize: 13, fontWeight: '600', color: '#2E7D62' },
  sectionSub:   { fontSize: 12, color: '#9CA3AF', lineHeight: 18, marginBottom: 10 },
  noneText:     { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' },

  // Empty card
  emptyCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFF', borderRadius: 14, padding: 16, marginBottom: 6,
    borderWidth: 1.5, borderColor: '#C3DDD6', borderStyle: 'dashed',
  },
  emptyCardText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#2E7D62' },

  // Growth areas
  milestoneRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 6,
    ...CARD_SHADOW, borderWidth: 1, borderColor: '#EEF0F2',
  },
  milestoneNumBadge: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  milestoneNum:     { fontSize: 13, fontWeight: '800' },
  milestoneRowText: { flex: 1 },
  milestoneName:    { fontSize: 14, fontWeight: '700', color: '#1A1A2E', marginBottom: 2 },
  milestoneDesc:    { fontSize: 12, color: '#9CA3AF', lineHeight: 17 },

  // Chip cards
  chipCard: {
    backgroundColor: '#FFF', borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 16,
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    marginBottom: 4, ...CARD_SHADOW, borderWidth: 1, borderColor: '#EEF0F2',
  },
  strengthChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#FEF3E7', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 100,
  },
  strengthChipText:  { fontSize: 13, fontWeight: '600', color: '#B45309' },
  temperamentChip: {
    backgroundColor: '#E6F4ED', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 100,
  },
  temperamentChipText: { fontSize: 13, fontWeight: '600', color: '#1B4D3E' },
  interestChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#FCE7F3', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 100,
  },
  interestChipText: { fontSize: 13, fontWeight: '600', color: '#BE185D' },
  addChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 100,
  },
  addChipText: { fontSize: 13, fontWeight: '600', color: '#9CA3AF' },

  // Photo avatar
  avatarWrap:   { alignItems: 'center', marginBottom: 20, marginTop: -4 },
  avatarOuter:  { width: 88, height: 88, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  avatarCircle: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarPhoto:   { width: 80, height: 80, borderRadius: 40 },
  avatarInitial: { fontSize: 30, fontWeight: '800', color: '#FFF' },
  avatarCameraBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#F5F6F8',
  },

  // Delete
  deleteBtn: { alignItems: 'center', paddingVertical: 10 },
  deleteBtnText: { fontSize: 13, color: '#DC2626', fontWeight: '500' },

  // Schooling context
  schoolingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  schoolingCard: {
    width: '47%', backgroundColor: '#FFF', borderRadius: 16,
    padding: 16, alignItems: 'center', gap: 10,
    ...CARD_SHADOW, borderWidth: 1, borderColor: '#EEF0F2', position: 'relative',
  },
  schoolingIcon: {
    width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
  },
  schoolingLabel: { fontSize: 13, fontWeight: '600', color: '#374151', textAlign: 'center' },
  schoolingCheck: {
    position: 'absolute', top: 8, right: 8,
    width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
  },
});

// ── Modal styles ──────────────────────────────────────────────────────────────

const modal = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#F0F1F3',
  },
  title:      { fontSize: 16, fontWeight: '800', color: '#1A1A2E' },
  cancelBtn:  { minWidth: 60 },
  cancelText: { fontSize: 15, color: '#9CA3AF', fontWeight: '500' },
  doneBtn:    { minWidth: 60, alignItems: 'flex-end' },
  doneText:   { fontSize: 15, color: '#2E7D62', fontWeight: '700' },

  scroll:   { paddingHorizontal: 20, paddingTop: 20 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#F3F4F6', borderRadius: 100,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  chipText: { fontSize: 14, fontWeight: '500', color: '#374151' },

  customList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  customChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F3F4F6', borderRadius: 100,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  customChipText: { fontSize: 13, color: '#374151', fontWeight: '600' },

  // Quick edit fields
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#6B7280', letterSpacing: 1, marginBottom: 8 },
  textInput: {
    backgroundColor: '#F9FAFB', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, fontWeight: '600', color: '#1A1A2E',
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  ageRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F9FAFB', borderRadius: 12,
    borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden',
  },
  ageStepBtn: {
    width: 52, height: 60, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  ageInput: {
    flex: 1, height: 60,
    fontSize: 32, fontWeight: '800', color: '#1A1A2E', textAlign: 'center',
  },
  gradeList: { gap: 6 },
  gradeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F9FAFB', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 13,
    borderWidth: 1, borderColor: '#F0F1F3',
  },
  gradeRowActive: { backgroundColor: '#E6F4ED', borderColor: '#A7D7C5' },
  gradeText:      { fontSize: 14, fontWeight: '500', color: '#6B7280' },
  gradeTextActive: { color: '#1B3D2F', fontWeight: '700' },

  customRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  customInput: {
    flex: 1, backgroundColor: '#F9FAFB', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: '#1A1A2E',
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  customAddBtn: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#E6F4ED', alignItems: 'center', justifyContent: 'center',
  },
});
