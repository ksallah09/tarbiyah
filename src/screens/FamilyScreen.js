import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const GOAL_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const GOAL_DONE_DAYS = 4;

const SHARED_NOTES = [
  {
    id: 1,
    author: 'Fatima',
    initials: 'F',
    avatarColor: '#7B4FAD',
    time: '2h ago',
    type: 'win',
    note:
      'Had a really calm conversation with Ibrahim about sharing toys. The 3-second pause made a huge difference — he actually listened!',
  },
  {
    id: 2,
    author: 'Yusuf',
    initials: 'Y',
    avatarColor: '#1B4D3E',
    time: 'Yesterday',
    type: 'reflection',
    note:
      'Used the connection-first approach at bedtime instead of jumping to correction. He opened up about something that was bothering him at school.',
  },
];

export default function FamilyScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Family</Text>
          <Text style={styles.screenSubtitle}>Parenting together with intention</Text>
        </View>

        {/* Connected Banner */}
        <View style={styles.connectedBanner}>
          <View style={styles.avatarPairRow}>
            <View style={[styles.avatar, { backgroundColor: '#1B4D3E' }]}>
              <Text style={styles.avatarInitial}>Y</Text>
            </View>
            <View style={styles.linkWire}>
              <View style={styles.linkLine} />
              <View style={styles.linkDot} />
              <View style={styles.linkLine} />
            </View>
            <View style={[styles.avatar, { backgroundColor: '#7B4FAD' }]}>
              <Text style={styles.avatarInitial}>F</Text>
            </View>
          </View>
          <Text style={styles.connectedNames}>Yusuf & Fatima</Text>
          <View style={styles.connectedStatusRow}>
            <View style={styles.connectedDot} />
            <Text style={styles.connectedStatusText}>Connected · Syncing daily</Text>
          </View>
        </View>

        {/* Shared Focus */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Today's Shared Focus</Text>
        </View>
        <View style={styles.focusCard}>
          <View style={styles.focusDecorA} />
          <View style={styles.focusTagPill}>
            <Text style={styles.focusTagText}>PATIENCE</Text>
          </View>
          <Text style={styles.focusCardTitle}>Respond, don't react</Text>
          <Text style={styles.focusCardBody}>
            You're both working on the same reminder today. Check in with each
            other tonight — did the 3-second pause make a difference?
          </Text>
          <View style={styles.partnerStatusList}>
            <View style={styles.partnerStatusRow}>
              <View style={[styles.statusDot, { backgroundColor: '#4ADE80' }]} />
              <Text style={styles.partnerStatusText}>Fatima applied today ✓</Text>
            </View>
            <View style={styles.partnerStatusRow}>
              <View style={[styles.statusDot, { backgroundColor: 'rgba(255,255,255,0.4)' }]} />
              <Text style={styles.partnerStatusText}>Yusuf — pending</Text>
            </View>
          </View>
        </View>

        {/* Weekly Goal */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Weekly Goal</Text>
          <TouchableOpacity>
            <Text style={styles.actionLink}>Edit</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.goalCard}>
          <View style={styles.goalHeaderRow}>
            <View style={styles.goalIconWrap}>
              <Ionicons name="flag-outline" size={18} color="#1B4D3E" />
            </View>
            <View style={styles.goalHeaderText}>
              <Text style={styles.goalTitle}>Use positive reinforcement daily</Text>
              <Text style={styles.goalMeta}>Set by Fatima · Apr 1–7</Text>
            </View>
          </View>
          <View style={styles.goalProgressRow}>
            <View style={styles.goalTrack}>
              <View
                style={[
                  styles.goalFill,
                  { width: `${(GOAL_DONE_DAYS / 7) * 100}%` },
                ]}
              />
            </View>
            <Text style={styles.goalProgressLabel}>{GOAL_DONE_DAYS} of 7</Text>
          </View>
          <View style={styles.goalDayDots}>
            {GOAL_DAYS.map((d, i) => (
              <View
                key={i}
                style={[styles.goalDot, i < GOAL_DONE_DAYS && styles.goalDotDone]}
              >
                <Text
                  style={[
                    styles.goalDotText,
                    i < GOAL_DONE_DAYS && styles.goalDotTextDone,
                  ]}
                >
                  {d}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Shared Notes */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Shared Notes</Text>
          <TouchableOpacity>
            <Text style={styles.actionLink}>+ Add</Text>
          </TouchableOpacity>
        </View>
        {SHARED_NOTES.map(note => (
          <View key={note.id} style={styles.noteCard}>
            <View style={styles.noteTopRow}>
              <View style={[styles.noteAvatar, { backgroundColor: note.avatarColor }]}>
                <Text style={styles.noteAvatarText}>{note.initials}</Text>
              </View>
              <View style={styles.noteMeta}>
                <Text style={styles.noteAuthor}>{note.author}</Text>
                <Text style={styles.noteTime}>{note.time}</Text>
              </View>
              <View
                style={[
                  styles.noteTypePill,
                  note.type === 'win' ? styles.noteTypeWin : styles.noteTypeReflection,
                ]}
              >
                <Text
                  style={[
                    styles.noteTypeText,
                    note.type === 'win'
                      ? styles.noteTypeTextWin
                      : styles.noteTypeTextReflection,
                  ]}
                >
                  {note.type === 'win' ? '🌟 Win' : '💭 Reflection'}
                </Text>
              </View>
            </View>
            <Text style={styles.noteBody}>{note.note}</Text>
          </View>
        ))}

        {/* Invite Card */}
        <TouchableOpacity style={styles.inviteCard} activeOpacity={0.85}>
          <View style={styles.inviteIconWrap}>
            <Ionicons name="person-add-outline" size={20} color="#1B4D3E" />
          </View>
          <View style={styles.inviteTextBlock}>
            <Text style={styles.inviteTitle}>Invite Another Parent</Text>
            <Text style={styles.inviteSubtitle}>Share your parenting journey</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        </TouchableOpacity>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F6F1' },
  scroll: { flex: 1 },
  content: { paddingTop: 16, paddingBottom: 32, paddingHorizontal: 20 },

  header: { marginBottom: 20 },
  screenTitle: { fontSize: 28, fontWeight: '700', color: '#1A1A2E', marginBottom: 2 },
  screenSubtitle: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },

  // Connected Banner
  connectedBanner: {
    backgroundColor: '#FFF',
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#F0EDE6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarPairRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: 20, fontWeight: '700', color: '#FFF' },
  linkWire: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  linkLine: { width: 18, height: 2, backgroundColor: '#E8E4DC' },
  linkDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#C8860A',
    marginHorizontal: 2,
  },
  connectedNames: { fontSize: 18, fontWeight: '700', color: '#1A1A2E', marginBottom: 7 },
  connectedStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  connectedDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#059669' },
  connectedStatusText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },

  // Section Rows
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A2E' },
  actionLink: { fontSize: 13, fontWeight: '600', color: '#1B4D3E' },

  // Focus Card
  focusCard: {
    backgroundColor: '#1B4D3E',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    overflow: 'hidden',
    shadowColor: '#1B4D3E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 8,
  },
  focusDecorA: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  focusTagPill: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  focusTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.88)',
    letterSpacing: 1.2,
  },
  focusCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 8,
  },
  focusCardBody: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 20,
    marginBottom: 16,
  },
  partnerStatusList: { gap: 7 },
  partnerStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  partnerStatusText: { fontSize: 13, color: 'rgba(255,255,255,0.82)', fontWeight: '500' },

  // Goal Card
  goalCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#F0EDE6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  goalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  goalIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E8F4F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalHeaderText: { flex: 1 },
  goalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A2E',
    lineHeight: 22,
    marginBottom: 3,
  },
  goalMeta: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  goalProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  goalTrack: { flex: 1, height: 6, backgroundColor: '#F2EFE8', borderRadius: 3 },
  goalFill: { height: '100%', backgroundColor: '#1B4D3E', borderRadius: 3 },
  goalProgressLabel: { fontSize: 12, fontWeight: '700', color: '#1B4D3E', minWidth: 40 },
  goalDayDots: { flexDirection: 'row', gap: 7 },
  goalDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2EFE8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E8E4DC',
  },
  goalDotDone: { backgroundColor: '#1B4D3E', borderColor: '#1B4D3E' },
  goalDotText: { fontSize: 11, fontWeight: '600', color: '#9CA3AF' },
  goalDotTextDone: { color: '#FFF' },

  // Note Cards
  noteCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F0EDE6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  noteTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  noteAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteAvatarText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  noteMeta: { flex: 1 },
  noteAuthor: { fontSize: 13, fontWeight: '700', color: '#1A1A2E' },
  noteTime: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  noteTypePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  noteTypeWin: { backgroundColor: '#D1FAE5' },
  noteTypeReflection: { backgroundColor: '#F0EAF8' },
  noteTypeText: { fontSize: 11, fontWeight: '700' },
  noteTypeTextWin: { color: '#059669' },
  noteTypeTextReflection: { color: '#7B4FAD' },
  noteBody: { fontSize: 13, color: '#6B7280', lineHeight: 20 },

  // Invite Card
  inviteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    marginTop: 4,
    borderWidth: 1.5,
    borderColor: '#C3DDD6',
    borderStyle: 'dashed',
  },
  inviteIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F4F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteTextBlock: { flex: 1 },
  inviteTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A2E', marginBottom: 2 },
  inviteSubtitle: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
});
