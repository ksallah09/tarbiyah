import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, Share,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import {
  getFamilySyncStatus,
  generateInviteCode,
  joinFamilyWithCode,
  leaveFamily,
  getCachedSyncStatus,
} from '../utils/familySync';

export default function FamilySyncScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [loading, setLoading]       = useState(true);
  const [linked, setLinked]         = useState(false);
  const [partner, setPartner]       = useState(null);

  // Invite flow
  const [inviteCode, setInviteCode] = useState(null);
  const [inviteExpiry, setInviteExpiry] = useState(null);
  const [generating, setGenerating] = useState(false);

  // Join flow
  const [joinMode, setJoinMode]     = useState(false);
  const [codeInput, setCodeInput]   = useState('');
  const [joining, setJoining]       = useState(false);
  const [joinError, setJoinError]   = useState('');

  useEffect(() => {
    getFamilySyncStatus().then(status => {
      setLinked(status.linked);
      setPartner(status.partner);
      setLoading(false);
    });
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const { code, expiresAt } = await generateInviteCode();
      setInviteCode(code);
      setInviteExpiry(expiresAt);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleShare() {
    if (!inviteCode) return;
    await Share.share({
      message: `Join my family on Tarbiyah! Enter this code in the app:\n\n${inviteCode}\n\nCode expires in 48 hours.`,
    });
  }

  async function handleJoin() {
    if (codeInput.trim().length < 6) return;
    setJoining(true);
    setJoinError('');
    const result = await joinFamilyWithCode(codeInput);
    if (result.success) {
      setLinked(true);
      setPartner(result.syncResult?.partner ?? { name: result.ownerName });
      setJoinMode(false);
      // Background refresh to pick up partner name from profiles if not yet set
      getFamilySyncStatus().then(status => {
        if (status.linked && status.partner?.name) setPartner(status.partner);
      });
    } else {
      setJoinError(result.error);
    }
    setJoining(false);
  }

  async function handleLeave() {
    Alert.alert(
      'Unlink Family',
      'You will no longer share family goals with your partner. Your existing goals will stay on your account.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlink',
          style: 'destructive',
          onPress: async () => {
            await leaveFamily();
            setLinked(false);
            setPartner(null);
            setInviteCode(null);
          },
        },
      ]
    );
  }

  function formatExpiry(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return `Expires ${d.toLocaleDateString()} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  return (
    <>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe} edges={[]}>

        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>FAMILY SYNC</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        <View style={[styles.content, { paddingBottom: insets.bottom + 32 }]}>

          {loading ? (
            <ActivityIndicator color="#FFFFFF" style={{ marginTop: 60 }} />

          ) : linked ? (
            /* ── LINKED STATE ── */
            <View style={styles.section}>
              <View style={styles.linkedCard}>
                <View style={styles.linkedIconRow}>
                  <View style={styles.avatarBubble}>
                    <Ionicons name="person" size={22} color="#2E7D62" />
                  </View>
                  <View style={styles.linkedLine} />
                  <Ionicons name="heart" size={18} color="#D4871A" />
                  <View style={styles.linkedLine} />
                  <View style={styles.avatarBubble}>
                    <Ionicons name="person" size={22} color="#2E7D62" />
                  </View>
                </View>
                <Text style={styles.linkedTitle}>Connected with</Text>
                <Text style={styles.linkedName}>{partner?.name || 'Your partner'}</Text>
                <Text style={styles.linkedSub}>
                  Family goals and reminders are shared between you
                </Text>
              </View>

              <View style={styles.featureList}>
                {[
                  { icon: 'trophy',              text: 'Shared family goals' },
                  { icon: 'notifications-outline', text: 'Reminders on both devices' },
                  { icon: 'sync-outline',         text: 'Goals sync in real time' },
                ].map((f, i) => (
                  <View key={i} style={styles.featureRow}>
                    <View style={styles.featureIconWrap}>
                      <Ionicons name={f.icon} size={16} color="#2E7D62" />
                    </View>
                    <Text style={styles.featureText}>{f.text}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.unlinkBtn} onPress={handleLeave} activeOpacity={0.8}>
                <Ionicons name="unlink-outline" size={15} color="#EF4444" />
                <Text style={styles.unlinkBtnText}>Unlink partner</Text>
              </TouchableOpacity>
            </View>

          ) : joinMode ? (
            /* ── JOIN MODE ── */
            <View style={styles.section}>
              <TouchableOpacity style={styles.backRowBtn} onPress={() => { setJoinMode(false); setJoinError(''); setCodeInput(''); }}>
                <Ionicons name="arrow-back" size={16} color="rgba(255,255,255,0.5)" />
                <Text style={styles.backRowText}>Back</Text>
              </TouchableOpacity>

              <Text style={styles.sectionTitle}>Enter invite code</Text>
              <Text style={styles.sectionSub}>
                Ask your partner to open Family Sync and generate a code, then enter it below.
              </Text>

              <TextInput
                style={styles.codeInput}
                value={codeInput}
                onChangeText={t => { setCodeInput(t.toUpperCase()); setJoinError(''); }}
                placeholder="e.g. AX4K9Z"
                placeholderTextColor="rgba(255,255,255,0.25)"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={6}
              />

              {!!joinError && (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle-outline" size={14} color="#EF4444" />
                  <Text style={styles.errorText}>{joinError}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.primaryBtn, (codeInput.length < 6 || joining) && styles.primaryBtnDisabled]}
                onPress={handleJoin}
                disabled={codeInput.length < 6 || joining}
                activeOpacity={0.85}
              >
                {joining
                  ? <ActivityIndicator color="#FFFFFF" size="small" />
                  : <>
                      <Ionicons name="link" size={18} color="#FFFFFF" />
                      <Text style={styles.primaryBtnText}>Connect</Text>
                    </>
                }
              </TouchableOpacity>
            </View>

          ) : (
            /* ── UNLINKED STATE ── */
            <View style={styles.section}>
              <View style={styles.heroIconWrap}>
                <Ionicons name="people" size={40} color="#2E7D62" />
              </View>
              <Text style={styles.sectionTitle}>Sync with your partner</Text>
              <Text style={styles.sectionSub}>
                Connect your accounts so both parents share the same family goals and reminders — set by either of you.
              </Text>

              {/* Generate code */}
              <Text style={styles.stepLabel}>OPTION 1 — INVITE YOUR PARTNER</Text>
              {inviteCode ? (
                <View style={styles.codeCard}>
                  <Text style={styles.codeCardLabel}>Share this code</Text>
                  <Text style={styles.codeDisplay}>{inviteCode}</Text>
                  <Text style={styles.codeExpiry}>{formatExpiry(inviteExpiry)}</Text>
                  <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.8}>
                    <Ionicons name="share-outline" size={16} color="#1B3D2F" />
                    <Text style={styles.shareBtnText}>Share code</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleGenerate} style={styles.refreshCodeBtn}>
                    <Ionicons name="refresh-outline" size={13} color="rgba(255,255,255,0.4)" />
                    <Text style={styles.refreshCodeText}>Generate new code</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.primaryBtn} onPress={handleGenerate} disabled={generating} activeOpacity={0.85}>
                  {generating
                    ? <ActivityIndicator color="#FFFFFF" size="small" />
                    : <>
                        <Ionicons name="qr-code-outline" size={18} color="#FFFFFF" />
                        <Text style={styles.primaryBtnText}>Generate invite code</Text>
                      </>
                  }
                </TouchableOpacity>
              )}

              <View style={styles.orDivider}>
                <View style={styles.orLine} />
                <Text style={styles.orText}>OR</Text>
                <View style={styles.orLine} />
              </View>

              {/* Join with code */}
              <Text style={styles.stepLabel}>OPTION 2 — JOIN YOUR PARTNER'S FAMILY</Text>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setJoinMode(true)} activeOpacity={0.8}>
                <Ionicons name="link-outline" size={18} color="#FFFFFF" />
                <Text style={styles.secondaryBtnText}>Enter a code</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1B3D2F' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 16,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: {
    fontSize: 10, fontWeight: '700', letterSpacing: 2,
    color: 'rgba(255,255,255,0.4)',
  },

  content: { flex: 1, paddingHorizontal: 24, paddingTop: 8 },

  section: { flex: 1 },

  heroIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(46,125,98,0.15)',
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: 24, marginTop: 16,
  },

  sectionTitle: {
    fontSize: 24, fontWeight: '700', color: '#FFFFFF',
    marginBottom: 10, textAlign: 'center',
  },
  sectionSub: {
    fontSize: 14, color: 'rgba(255,255,255,0.5)',
    lineHeight: 22, textAlign: 'center', marginBottom: 32,
  },

  stepLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.3)', marginBottom: 12,
  },

  primaryBtn: {
    backgroundColor: '#2E7D62',
    borderRadius: 16, paddingVertical: 18,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 10,
    marginBottom: 8,
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

  secondaryBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16, paddingVertical: 18,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  secondaryBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

  orDivider: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, marginVertical: 24,
  },
  orLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  orText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.25)', letterSpacing: 1 },

  // Code card
  codeCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20, padding: 24, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 8,
  },
  codeCardLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1,
    color: 'rgba(255,255,255,0.35)', marginBottom: 12,
  },
  codeDisplay: {
    fontSize: 40, fontWeight: '700', color: '#FFFFFF',
    letterSpacing: 10, marginBottom: 8,
  },
  codeExpiry: {
    fontSize: 11, color: 'rgba(255,255,255,0.3)',
    marginBottom: 20,
  },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: '#A7D7C5', borderRadius: 14,
    paddingHorizontal: 20, paddingVertical: 12,
    marginBottom: 12,
  },
  shareBtnText: { fontSize: 14, fontWeight: '700', color: '#1B3D2F' },
  refreshCodeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
  },
  refreshCodeText: {
    fontSize: 12, color: 'rgba(255,255,255,0.3)',
  },

  // Join mode
  backRowBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 28,
  },
  backRowText: { fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: '600' },

  codeInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16, paddingVertical: 20,
    textAlign: 'center', fontSize: 32, fontWeight: '700',
    color: '#FFFFFF', letterSpacing: 8,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: 16,
  },
  errorRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 7,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 10, padding: 12, marginBottom: 16,
  },
  errorText: { flex: 1, fontSize: 13, color: '#FCA5A5', lineHeight: 18 },

  // Linked state
  linkedCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20, padding: 28, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(46,125,98,0.3)',
    marginTop: 16, marginBottom: 24,
  },
  linkedIconRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20,
  },
  avatarBubble: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(46,125,98,0.15)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(46,125,98,0.3)',
  },
  linkedLine: {
    flex: 1, height: 1.5,
    backgroundColor: 'rgba(46,125,98,0.3)',
  },
  linkedTitle: {
    fontSize: 12, fontWeight: '600', letterSpacing: 0.5,
    color: 'rgba(255,255,255,0.4)', marginBottom: 6,
  },
  linkedName: {
    fontSize: 22, fontWeight: '700', color: '#FFFFFF', marginBottom: 10,
  },
  linkedSub: {
    fontSize: 13, color: 'rgba(255,255,255,0.45)',
    textAlign: 'center', lineHeight: 19,
  },

  featureList: {
    gap: 10, marginBottom: 32,
  },
  featureRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12, padding: 14,
  },
  featureIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: 'rgba(46,125,98,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  featureText: { fontSize: 14, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },

  doneBtn: {
    backgroundColor: '#2E7D62',
    borderRadius: 16, paddingVertical: 18,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  doneBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

  unlinkBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    backgroundColor: 'rgba(239,68,68,0.07)',
  },
  unlinkBtnText: { fontSize: 14, fontWeight: '600', color: '#EF4444' },
});
