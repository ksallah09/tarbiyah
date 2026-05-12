import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Image, Platform, KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
let ImagePicker = null;
try { ImagePicker = require('expo-image-picker'); } catch {}
import { saveChildProfile } from '../utils/childProfiles';
import { uploadPhoto } from '../utils/uploadPhoto';
import { supabase } from '../utils/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://tarbiyah-production.up.railway.app';

const TOTAL_STEPS = 9;

const SPECIAL_NEEDS_OPTIONS = [
  'ADHD', 'Autism / ASD', 'Down Syndrome', 'Dyslexia',
  'Anxiety', 'Sensory Differences', 'Speech / Language Delay',
  'Learning Differences', 'Physical Disability', 'Gifted / Advanced Learner',
];

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

const GRADE_OPTIONS = [
  'No school yet', 'Nursery', 'Pre-K', 'Kindergarten',
  '1st Grade', '2nd Grade', '3rd Grade', '4th Grade',
  '5th Grade', '6th Grade', '7th Grade', '8th Grade',
  '9th Grade', '10th Grade', '11th Grade', '12th Grade',
  'College',
];

const SCHOOLING_OPTIONS = [
  { key: 'islamic', label: 'Islamic School', icon: 'moon',           color: '#1B4D3E', bg: '#E6F4ED' },
  { key: 'public',  label: 'Public School',  icon: 'school-outline', color: '#1D4ED8', bg: '#EFF6FF' },
  { key: 'home',    label: 'Home School',    icon: 'home-outline',   color: '#7C3AED', bg: '#F3EEFF' },
  { key: 'none',    label: 'No School Yet',  icon: 'happy-outline',  color: '#B45309', bg: '#FEF3E7' },
];

function ProgressDots({ total, current }) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[styles.dot, i <= current && styles.dotActive]} />
      ))}
    </View>
  );
}

function ChipSelector({ options, selected, onToggle, color = '#1B3D2F', bg = '#E6F4ED' }) {
  return (
    <View style={styles.chipWrap}>
      {options.map(opt => {
        const active = selected.includes(opt);
        return (
          <TouchableOpacity
            key={opt}
            style={[styles.chip, active && { backgroundColor: bg, borderColor: color, borderWidth: 1.5 }]}
            onPress={() => onToggle(opt)}
            activeOpacity={0.75}
          >
            {active && <Ionicons name="checkmark" size={12} color={color} />}
            <Text style={[styles.chipText, active && { color, fontWeight: '700' }]}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function AddChildWizardScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const isEdit = !!route?.params?.child;
  const existingChild = route?.params?.child;

  const [step, setStep]               = useState(0);
  const [saving, setSaving]           = useState(false);
  const [name, setName]               = useState(existingChild?.name ?? '');
  const [age, setAge]                 = useState(existingChild?.age?.toString() ?? '');
  const [gender, setGender]           = useState(existingChild?.gender ?? null);
  const [stage, setStage]             = useState(existingChild?.stage ?? null);
  const [schooling, setSchooling]     = useState(existingChild?.schooling ?? null);
  const [photo, setPhoto]             = useState(existingChild?.photo ?? null);
  const [strengths, setStrengths]     = useState(existingChild?.strengths ?? []);
  const [temperaments, setTemperaments] = useState(existingChild?.temperaments ?? []);
  const [interests, setInterests]         = useState(existingChild?.interests ?? []);
  const [specialNeeds, setSpecialNeeds]   = useState(existingChild?.specialNeeds ?? []);
  const [customInterest, setCustomInterest] = useState('');
  const [customNeed, setCustomNeed]         = useState('');

  const scrollRef = useRef(null);

  const noSchool = stage === 'No school yet';

  function goNext() {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    if (step === 2 && noSchool) {
      setSchooling('none');
      setStep(4);
    } else {
      setStep(s => s + 1);
    }
  }
  function goBack() {
    if (step === 0) { navigation.goBack(); return; }
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    if (step === 4 && noSchool) {
      setStep(2);
    } else {
      setStep(s => s - 1);
    }
  }

  function toggleItem(list, setList, item) {
    setList(prev =>
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    );
  }

  async function pickPhoto() {
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
    if (!result.canceled) setPhoto(result.assets[0].uri);
  }

  async function takePhoto() {
    if (!ImagePicker) { Alert.alert('Unavailable', 'Please rebuild the app to enable camera access.'); return; }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });
    if (!result.canceled) setPhoto(result.assets[0].uri);
  }

  function addCustomInterest() {
    const trimmed = customInterest.trim();
    if (!trimmed || interests.includes(trimmed)) { setCustomInterest(''); return; }
    setInterests(prev => [...prev, trimmed]);
    setCustomInterest('');
  }

  async function handleFinish() {
    setSaving(true);
    try {
      let photoUrl = photo;
      if (photo && photo.startsWith('file://')) {
        const childId = existingChild?.id ?? `child_${Date.now()}`;
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id ?? 'anonymous';
        try {
          photoUrl = await uploadPhoto(photo, `profiles/${userId}_child_${childId}.jpg`);
        } catch {
          // Upload failed — clear the photo rather than storing a local URI that won't survive a rebuild
          photoUrl = null;
        }
      }
      const profile = {
        ...(isEdit ? existingChild : {}),
        name: name.trim(),
        age: parseInt(age) || 0,
        gender,
        stage,
        schooling,
        photo: photoUrl,
        strengths,
        temperaments,
        interests,
        specialNeeds,
      };
      const saved = isEdit
        ? await import('../utils/childProfiles').then(m => m.updateChildProfile(existingChild.id, profile))
        : await saveChildProfile(profile);

      // Fire background youth culture generation for new children
      if (!isEdit && saved?.id) {
        (async () => {
          try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;
            if (!token) return;
            const res = await fetch(`${API_URL}/child-world/async`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                childId:   saved.id,
                age:       saved.age,
                gender:    saved.gender ?? undefined,
                name:      saved.name?.split(' ')[0] ?? undefined,
                interests: saved.interests?.join(',') ?? undefined,
              }),
            });
            if (res.ok) {
              const { jobId } = await res.json();
              await AsyncStorage.setItem(`tarbiyah_world_job_${saved.id}`, jobId);
            }
          } catch {}
        })();
      }

      if (route?.params?.afterOnboarding) {
        navigation.replace('GrowthAreaWizard', { child: saved, isFirstTime: true, afterOnboarding: true });
      } else {
        navigation.replace('GrowthAreaWizard', { child: saved, isFirstTime: !isEdit });
      }
    } catch (e) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const canAdvance = [
    name.trim().length > 0,         // 0: name
    age.length > 0 && gender,       // 1: age + gender
    !!stage,                         // 2: stage
    !!schooling,                     // 3: schooling
    true,                            // 4: photo (optional)
    true,                            // 5: strengths (optional)
    true,                            // 6: temperament (optional)
    true,                            // 7: interests (optional)
    true,                            // 8: additional context (optional)
  ][step];

  const stepTitles = [
    "What's your child's name?",
    `How old is ${name || 'your child'}?`,
    `What grade is ${name || 'your child'} in?`,
    `Where does ${name || 'your child'} go to school?`,
    `Add a photo of ${name || 'your child'}`,
    `What are ${name || 'your child'}'s strengths?`,
    `How would you describe ${name || 'your child'}?`,
    `What are ${name || 'your child'}'s interests?`,
    `Any additional context about ${name || 'your child'}?`,
  ];

  const stepSubs = [
    '',
    'Select age and gender.',
    'Choose the current grade or stage.',
    'This helps us tailor activities and suggestions.',
    'Optional — you can always add one later.',
    'Choose any that apply. These help personalise coaching.',
    'Select traits that describe how they are wired.',
    'Interests help us suggest relatable activities.',
    `Every child is unique. Sharing this helps us tailor advice and activities more specifically for ${name || 'your child'}. Completely optional — this stays private.`,
  ];

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <ProgressDots total={TOTAL_STEPS} current={step} />
        </View>
        <TouchableOpacity onPress={goNext} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} disabled={step !== 4 && step !== 8}>
          <Text style={styles.skipText}>{step === 4 || step === 8 ? 'Skip' : ''}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'height' : undefined}>
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.stepTitle}>{stepTitles[step]}</Text>
          {stepSubs[step] ? <Text style={styles.stepSub}>{stepSubs[step]}</Text> : null}

          {/* ── Step 0: Name ── */}
          {step === 0 && (
            <TextInput
              style={styles.nameInput}
              placeholder="e.g. Yusuf"
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={name}
              onChangeText={setName}
              autoFocus
              returnKeyType="next"
              onSubmitEditing={() => name.trim() && goNext()}
            />
          )}

          {/* ── Step 1: Age + Gender ── */}
          {step === 1 && (
            <>
              <Text style={styles.fieldLabel}>Age</Text>
              <View style={styles.ageInputRow}>
                <TouchableOpacity
                  style={styles.ageStepBtn}
                  onPress={() => setAge(a => String(Math.max(1, (parseInt(a) || 0) - 1)))}
                  activeOpacity={0.7}
                >
                  <Ionicons name="remove" size={20} color="rgba(255,255,255,0.8)" />
                </TouchableOpacity>
                <TextInput
                  style={styles.ageInput}
                  value={age}
                  onChangeText={v => {
                    const n = v.replace(/[^0-9]/g, '');
                    if (n === '' || (parseInt(n) >= 1 && parseInt(n) <= 99)) setAge(n);
                  }}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="—"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  textAlign="center"
                />
                <TouchableOpacity
                  style={styles.ageStepBtn}
                  onPress={() => setAge(a => String(Math.min(99, (parseInt(a) || 0) + 1)))}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={20} color="rgba(255,255,255,0.8)" />
                </TouchableOpacity>
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 28 }]}>Gender</Text>
              <View style={styles.genderRow}>
                {[{ key: 'male', label: 'Boy' }, { key: 'female', label: 'Girl' }].map(g => (
                  <TouchableOpacity
                    key={g.key}
                    style={[styles.genderCard, gender === g.key && styles.genderCardActive]}
                    onPress={() => setGender(g.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.genderLabel, gender === g.key && { color: '#FFFFFF', fontWeight: '700' }]}>{g.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* ── Step 2: Grade/Stage ── */}
          {step === 2 && (
            <View style={styles.optionList}>
              {GRADE_OPTIONS.map(g => (
                <TouchableOpacity
                  key={g}
                  style={[styles.optionRow, stage === g && styles.optionRowActive]}
                  onPress={() => setStage(g)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.optionText, stage === g && styles.optionTextActive]}>{g}</Text>
                  {stage === g && <Ionicons name="checkmark-circle" size={20} color="#4ADE80" />}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ── Step 3: Schooling ── */}
          {step === 3 && (
            <View style={styles.schoolingGrid}>
              {SCHOOLING_OPTIONS.map(opt => {
                const active = schooling === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.schoolingCard, active && styles.schoolingCardActive]}
                    onPress={() => setSchooling(opt.key)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.schoolingIcon, { backgroundColor: active ? opt.color : 'rgba(255,255,255,0.12)' }]}>
                      <Ionicons name={opt.icon} size={24} color={active ? '#FFFFFF' : 'rgba(255,255,255,0.6)'} />
                    </View>
                    <Text style={[styles.schoolingLabel, active && { color: '#FFFFFF', fontWeight: '700' }]}>{opt.label}</Text>
                    {active && (
                      <View style={[styles.schoolingCheck, { backgroundColor: opt.color }]}>
                        <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* ── Step 4: Photo ── */}
          {step === 4 && (
            <View style={styles.photoSection}>
              <TouchableOpacity style={styles.photoCircle} onPress={pickPhoto} activeOpacity={0.8}>
                {photo ? (
                  <Image source={{ uri: photo }} style={styles.photoImage} />
                ) : (
                  <>
                    <Ionicons name="person" size={52} color="rgba(255,255,255,0.3)" />
                    <View style={styles.photoAddBadge}>
                      <Ionicons name="add" size={16} color="#FFFFFF" />
                    </View>
                  </>
                )}
              </TouchableOpacity>

              {photo && (
                <TouchableOpacity style={styles.photoRemove} onPress={() => setPhoto(null)}>
                  <Text style={styles.photoRemoveText}>Remove photo</Text>
                </TouchableOpacity>
              )}

              <View style={styles.photoActions}>
                <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto} activeOpacity={0.8}>
                  <Ionicons name="images-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.photoBtnText}>Choose from Library</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.photoBtn} onPress={takePhoto} activeOpacity={0.8}>
                  <Ionicons name="camera-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.photoBtnText}>Take a Photo</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Step 5: Strengths ── */}
          {step === 5 && (
            <ChipSelector
              options={STRENGTHS_OPTIONS}
              selected={strengths}
              onToggle={item => toggleItem(strengths, setStrengths, item)}
              color="#1B4D3E"
              bg="#E6F4ED"
            />
          )}

          {/* ── Step 6: Temperament ── */}
          {step === 6 && (
            <ChipSelector
              options={TEMPERAMENT_OPTIONS}
              selected={temperaments}
              onToggle={item => toggleItem(temperaments, setTemperaments, item)}
              color="#1B4D3E"
              bg="#E6F4ED"
            />
          )}

          {/* ── Step 7: Interests ── */}
          {step === 7 && (
            <>
              <ChipSelector
                options={INTEREST_OPTIONS}
                selected={interests}
                onToggle={item => toggleItem(interests, setInterests, item)}
                color="#1B4D3E"
                bg="#E6F4ED"
              />
              <View style={styles.customRow}>
                <TextInput
                  style={styles.customInput}
                  placeholder="Add your own…"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={customInterest}
                  onChangeText={setCustomInterest}
                  onSubmitEditing={addCustomInterest}
                  returnKeyType="done"
                />
                <TouchableOpacity style={styles.customAddBtn} onPress={addCustomInterest}>
                  <Ionicons name="add" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              {interests.filter(i => !INTEREST_OPTIONS.includes(i)).map(custom => (
                <View key={custom} style={styles.customChip}>
                  <Text style={styles.customChipText}>{custom}</Text>
                  <TouchableOpacity onPress={() => setInterests(prev => prev.filter(i => i !== custom))}>
                    <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.5)" />
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}

          {/* ── Step 8: Additional Context / Special Needs ── */}
          {step === 8 && (
            <>
              <ChipSelector
                options={SPECIAL_NEEDS_OPTIONS}
                selected={specialNeeds}
                onToggle={item => toggleItem(specialNeeds, setSpecialNeeds, item)}
                color="#1B4D3E"
                bg="#E6F4ED"
              />
              <View style={styles.customRow}>
                <TextInput
                  style={styles.customInput}
                  placeholder="Add your own…"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={customNeed}
                  onChangeText={setCustomNeed}
                  onSubmitEditing={() => {
                    const t = customNeed.trim();
                    if (t && !specialNeeds.includes(t)) setSpecialNeeds(prev => [...prev, t]);
                    setCustomNeed('');
                  }}
                  returnKeyType="done"
                />
                <TouchableOpacity style={styles.customAddBtn} onPress={() => {
                  const t = customNeed.trim();
                  if (t && !specialNeeds.includes(t)) setSpecialNeeds(prev => [...prev, t]);
                  setCustomNeed('');
                }}>
                  <Ionicons name="add" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              {specialNeeds.filter(n => !SPECIAL_NEEDS_OPTIONS.includes(n)).map(custom => (
                <View key={custom} style={styles.customChip}>
                  <Text style={styles.customChipText}>{custom}</Text>
                  <TouchableOpacity onPress={() => setSpecialNeeds(prev => prev.filter(n => n !== custom))}>
                    <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.5)" />
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}

          <View style={{ height: 120 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        {step < TOTAL_STEPS - 1 ? (
          <TouchableOpacity
            style={[styles.nextBtn, !canAdvance && styles.nextBtnDisabled]}
            onPress={goNext}
            disabled={!canAdvance}
            activeOpacity={0.85}
          >
            <Text style={styles.nextBtnText}>Continue</Text>
            <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.nextBtn, saving && { opacity: 0.7 }]}
            onPress={handleFinish}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#FFFFFF" size="small" />
              : <><Text style={styles.nextBtnText}>Save & Continue</Text><Ionicons name="checkmark" size={18} color="#FFFFFF" /></>
            }
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1B3D2F' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 8,
  },
  backBtn: { padding: 4 },
  skipText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.5)', minWidth: 36, textAlign: 'right' },

  dotsRow: { flexDirection: 'row', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)' },
  dotActive: { backgroundColor: '#FFFFFF', width: 18 },

  scrollContent: { paddingHorizontal: 24, paddingTop: 24 },

  stepTitle: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.3, marginBottom: 8, lineHeight: 34 },
  stepSub:   { fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 21, marginBottom: 28 },

  // Name
  nameInput: {
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16,
    paddingHorizontal: 20, paddingVertical: 18,
    fontSize: 22, fontWeight: '700', color: '#FFFFFF',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },

  // Age
  fieldLabel: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.5)', letterSpacing: 0.8, marginBottom: 12 },
  ageInputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  ageStepBtn: {
    width: 56, height: 72,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  ageInput: {
    flex: 1, height: 72,
    fontSize: 40, fontWeight: '800', color: '#FFFFFF',
    textAlign: 'center',
  },

  // Gender
  genderRow: { flexDirection: 'row', gap: 12 },
  genderCard: {
    flex: 1, alignItems: 'center', gap: 10, paddingVertical: 24,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  genderCardActive: { backgroundColor: 'rgba(255,255,255,0.2)', borderColor: '#FFFFFF' },
  genderLabel: { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },

  // Grade options
  optionList: { gap: 8 },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14,
    paddingHorizontal: 18, paddingVertical: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  optionRowActive: { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: '#4ADE80' },
  optionText: { fontSize: 15, fontWeight: '500', color: 'rgba(255,255,255,0.6)' },
  optionTextActive: { color: '#FFFFFF', fontWeight: '700' },

  // Schooling
  schoolingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  schoolingCard: {
    width: '47%', backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18, padding: 20, alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)',
    position: 'relative',
  },
  schoolingCardActive: { borderColor: '#FFFFFF' },
  schoolingIcon: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  schoolingLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
  schoolingCheck: {
    position: 'absolute', top: 8, right: 8,
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },

  // Photo
  photoSection: { alignItems: 'center', gap: 24 },
  photoCircle: {
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  photoImage: { width: 140, height: 140, borderRadius: 70 },
  photoAddBadge: {
    position: 'absolute', bottom: 6, right: 6,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#2E7D62',
    alignItems: 'center', justifyContent: 'center',
  },
  photoRemove: { marginTop: -12 },
  photoRemoveText: { fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: '500' },
  photoActions: { width: '100%', gap: 10 },
  photoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  photoBtnText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },

  // Chips
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 100, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  chipText: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.7)' },

  // Custom interest
  customRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 16,
  },
  customInput: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, lineHeight: 20, color: '#FFFFFF',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  customAddBtn: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  customChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 100,
    paddingHorizontal: 14, paddingVertical: 8,
    marginTop: 8, alignSelf: 'flex-start',
  },
  customChipText: { fontSize: 13, color: '#FFFFFF', fontWeight: '600' },

  // Footer
  footer: {
    paddingHorizontal: 24, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#1B3D2F',
  },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 16,
  },
  nextBtnDisabled: { opacity: 0.35 },
  nextBtnText: { fontSize: 16, fontWeight: '700', color: '#1B3D2F' },
});
