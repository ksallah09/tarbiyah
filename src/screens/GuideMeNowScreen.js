import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const API_URL = 'https://tarbiyah-production.up.railway.app';

const SITUATIONS = [
  { id: 'lie',      label: 'My child lied to me',          icon: 'alert-circle-outline' },
  { id: 'salah',    label: 'Refuses to pray',              icon: 'moon-outline' },
  { id: 'siblings', label: 'Siblings fighting',            icon: 'people-outline' },
  { id: 'screen',   label: 'Screen time meltdown',         icon: 'phone-portrait-outline' },
  { id: 'teen',     label: 'My teen is disrespectful',     icon: 'person-outline' },
  { id: 'listen',   label: 'Child not listening',          icon: 'ear-outline' },
  { id: 'tantrum',  label: 'Angry tantrum',                icon: 'flame-outline' },
  { id: 'anxious',  label: 'My child is anxious or sad',   icon: 'heart-outline' },
  { id: 'language', label: 'Child used bad language',      icon: 'chatbubble-ellipses-outline' },
];

export default function GuideMeNowScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected]     = useState(null);
  const [customText, setCustomText] = useState('');
  const [loading, setLoading]       = useState(false);
  const [response, setResponse]     = useState(null);
  const [error, setError]           = useState(null);

  const situationText = selected?.id === 'custom'
    ? customText.trim()
    : selected?.label ?? '';
  const canSubmit = situationText.length > 0 || customText.trim().length > 0;
  const finalSituation = customText.trim() || situationText;

  async function handleGetGuidance() {
    if (!finalSituation) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/guide/now`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ situation: finalSituation }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong');
      setResponse(data);
    } catch {
      setError('Could not get guidance. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setResponse(null);
    setSelected(null);
    setCustomText('');
    setError(null);
  }

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <View style={styles.bgTop} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {response ? (
          // ── Response view ──
          <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
            {/* Green hero */}
            <View style={[styles.hero, { paddingTop: insets.top + 20 }]}>
              <TouchableOpacity
                style={styles.backBtn}
                onPress={handleReset}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
              <Text style={styles.heroLabel}>GUIDE ME · RIGHT NOW</Text>
              <Text style={styles.heroTitle}>Your Guidance</Text>
              <View style={styles.situationRecap}>
                <Ionicons name="alert-circle" size={13} color="rgba(255,255,255,0.45)" />
                <Text style={styles.situationRecapText}>{finalSituation}</Text>
              </View>
            </View>

            {/* White sheet with cards */}
            <View style={[styles.sheet, { padding: 20, paddingBottom: insets.bottom + 32 }]}>

            {/* ── Islamic Grounding ── */}
            <View style={styles.card}>
              <View style={styles.cardLabelRow}>
                <View style={[styles.cardDot, { backgroundColor: '#D4A843' }]} />
                <Text style={[styles.cardLabel, { color: '#92610A' }]}>ISLAMIC GROUNDING</Text>
              </View>
              <Text style={styles.cardBody}>{response.islamicGrounding?.text}</Text>
              {response.islamicGrounding?.source ? (
                <Text style={styles.cardSource}>— {response.islamicGrounding.source}</Text>
              ) : null}
            </View>

            {/* ── Research Grounding ── */}
            {response.researchGrounding ? (
              <View style={styles.card}>
                <View style={styles.cardLabelRow}>
                  <View style={[styles.cardDot, { backgroundColor: '#3B82F6' }]} />
                  <Text style={[styles.cardLabel, { color: '#1D4ED8' }]}>RESEARCH INSIGHT</Text>
                </View>
                <Text style={styles.cardBody}>{response.researchGrounding.text}</Text>
                {response.researchGrounding.source ? (
                  <Text style={styles.cardSource}>— {response.researchGrounding.source}</Text>
                ) : null}
              </View>
            ) : null}

            {/* ── What to Say ── */}
            <View style={[styles.card, styles.sayCard]}>
              <View style={styles.cardLabelRow}>
                <View style={[styles.cardDot, { backgroundColor: '#2E7D62' }]} />
                <Text style={[styles.cardLabel, { color: '#1B5E3F' }]}>WHAT TO SAY</Text>
              </View>
              {(response.whatToSay ?? []).map((line, i) => (
                <View key={i} style={styles.sayLine}>
                  <Text style={styles.sayQuoteMark}>"</Text>
                  <Text style={styles.sayText}>{line}</Text>
                  <Text style={styles.sayQuoteMark}>"</Text>
                </View>
              ))}
            </View>

            {/* ── What Not to Say ── */}
            {response.whatNotToSay ? (
              <View style={[styles.card, styles.avoidCard]}>
                <View style={styles.cardLabelRow}>
                  <View style={[styles.cardDot, { backgroundColor: '#F87171' }]} />
                  <Text style={[styles.cardLabel, { color: '#B91C1C' }]}>AVOID SAYING</Text>
                </View>
                <Text style={styles.avoidText}>{response.whatNotToSay}</Text>
              </View>
            ) : null}

            {/* ── Module nudge ── */}
            {response.moduleNudge ? (
              <TouchableOpacity
                style={styles.nudgeCard}
                activeOpacity={0.85}
                onPress={() => {
                  navigation.goBack();
                  setTimeout(() => navigation.navigate('ModuleDetail', { topic: finalSituation, isNew: true }), 300);
                }}
              >
                <View style={styles.nudgeIcon}>
                  <Ionicons name="layers-outline" size={20} color="#2E7D62" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nudgeTitle}>Want to go deeper?</Text>
                  <Text style={styles.nudgeBody}>{response.moduleNudge}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            ) : null}

            {/* ── Try again ── */}
            <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
              <Ionicons name="refresh-outline" size={15} color="#6B7280" />
              <Text style={styles.resetBtnText}>Try a different situation</Text>
            </TouchableOpacity>

            </View>{/* end white sheet */}
          </ScrollView>
        ) : (
          // ── Situation picker ──
          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
          >
            {/* Hero */}
            <View style={[styles.hero, { paddingTop: insets.top + 20 }]}>
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => navigation.goBack()}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
              <Text style={styles.heroLabel}>GUIDE ME · RIGHT NOW</Text>
              <Text style={styles.heroTitle}>What's happening?</Text>
              <Text style={styles.heroSub}>Select a situation or describe it in your own words.</Text>
            </View>

            {/* White sheet */}
            <View style={styles.sheet}>
              <View style={[styles.pickerPad, { paddingBottom: insets.bottom + 100 }]}>
            <View style={styles.pickerGrid}>
              {SITUATIONS.map(sit => (
                <TouchableOpacity
                  key={sit.id}
                  style={[styles.sitCard, selected?.id === sit.id && styles.sitCardActive]}
                  activeOpacity={0.8}
                  onPress={() => setSelected(selected?.id === sit.id ? null : sit)}
                >
                  <Ionicons
                    name={sit.icon}
                    size={18}
                    color={selected?.id === sit.id ? '#1B3D2F' : '#6B7280'}
                  />
                  <Text style={[styles.sitLabel, selected?.id === sit.id && styles.sitLabelActive]}>
                    {sit.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR DESCRIBE IT</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Custom input */}
            <TextInput
              style={[styles.customInput, customText.length > 0 && styles.customInputActive]}
              placeholder="Describe what's happening right now..."
              placeholderTextColor="#9CA3AF"
              value={customText}
              onChangeText={t => { setCustomText(t); if (t) setSelected(null); }}
              multiline
              maxLength={200}
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
              </View>
            </View>
          </ScrollView>
        )}

        {/* ── Footer CTA ── */}
        {!response ? (
          <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
            <TouchableOpacity
              style={[styles.guidanceBtn, (!finalSituation || loading) && styles.guidanceBtnDisabled]}
              disabled={!finalSituation || loading}
              activeOpacity={0.88}
              onPress={handleGetGuidance}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="sparkles" size={18} color={finalSituation ? '#D4871A' : 'rgba(255,255,255,0.3)'} />
                  <Text style={styles.guidanceBtnText}>Get Guidance</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: '#F5F6F8' },
  bgTop: { position: 'absolute', top: 0, left: 0, right: 0, height: '50%', backgroundColor: '#1B3D2F' },

  // ── Hero (picker view) ──
  hero: {
    backgroundColor: '#1B3D2F',
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  heroLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.4)', marginBottom: 8, marginTop: 12,
  },
  heroTitle: {
    fontSize: 30, fontWeight: '800', color: '#FFFFFF',
    letterSpacing: -0.5, lineHeight: 36, marginBottom: 10,
  },
  heroSub: {
    fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 21,
  },
  sheet: {
    flexGrow: 1, backgroundColor: '#F5F6F8',
  },

  // ── Header (response view) ──
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 24,
    backgroundColor: '#1B3D2F',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  headerLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.4)', marginBottom: 4,
  },
  headerTitle: {
    fontSize: 24, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.3,
  },

  situationRecap: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12,
    padding: 12, marginTop: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  situationRecapText: {
    flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 19, fontStyle: 'italic',
  },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  sayCard: { borderLeftWidth: 3, borderLeftColor: '#2E7D62' },
  avoidCard: { borderLeftWidth: 3, borderLeftColor: '#F87171' },
  cardLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  cardDot: { width: 6, height: 6, borderRadius: 3 },
  cardLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.4 },
  cardBody: { fontSize: 15, color: '#1C1C1E', lineHeight: 24 },
  cardSource: { fontSize: 12, color: '#9CA3AF', marginTop: 8, fontStyle: 'italic' },
  sayLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginBottom: 8 },
  sayQuoteMark: { fontSize: 22, color: '#2E7D62', lineHeight: 28, fontWeight: '700' },
  sayText: { flex: 1, fontSize: 15, color: '#1C1C1E', lineHeight: 24, paddingTop: 4 },
  avoidText: { fontSize: 14, color: '#374151', lineHeight: 22 },
  nudgeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#F0FDF4', borderRadius: 16, padding: 16,
    marginBottom: 20, borderWidth: 1, borderColor: '#BBF7D0',
  },
  nudgeIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center',
  },
  nudgeTitle: { fontSize: 13, fontWeight: '700', color: '#1B3D2F', marginBottom: 2 },
  nudgeBody:  { fontSize: 12, color: '#4B5563', lineHeight: 18 },
  resetBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'center', paddingVertical: 10,
  },
  resetBtnText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },

  // ── Picker ──
  pickerPad: { paddingHorizontal: 20, paddingTop: 24 },
  pickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  sitCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFFFF', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  sitCardActive: {
    backgroundColor: '#ECFDF5', borderColor: '#2E7D62',
  },
  sitLabel: { fontSize: 13, color: '#374151', fontWeight: '500' },
  sitLabelActive: { color: '#1B3D2F', fontWeight: '700' },
  divider: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  dividerText: { fontSize: 10, fontWeight: '700', letterSpacing: 1.4, color: '#9CA3AF' },
  customInput: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    fontSize: 14, color: '#1C1C1E', lineHeight: 22,
    minHeight: 90, textAlignVertical: 'top',
    borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  customInputActive: { borderColor: '#2E7D62' },
  errorText: { fontSize: 13, color: '#DC2626', marginTop: 12, textAlign: 'center' },

  // ── Footer ──
  footer: {
    paddingHorizontal: 20, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  guidanceBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#1B3D2F', borderRadius: 16, paddingVertical: 16,
  },
  guidanceBtnDisabled: { backgroundColor: '#D1D5DB' },
  guidanceBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.2 },
});
