import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { markAsRead, isReadToday } from '../utils/readInsights';

export default function VerseDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { verse } = route.params;
  const [read, setRead] = useState(false);

  useEffect(() => {
    isReadToday('quran', verse.reference).then(setRead);
  }, []);

  async function handleMarkRead() {
    if (read) return;
    await markAsRead('quran', verse.reference);
    setRead(true);
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
            <Text style={styles.headerLabel}>VERSES OF THE DAY</Text>
          </View>
          {read ? (
            <View style={styles.readBadge}>
              <Ionicons name="checkmark" size={13} color="#4ADE80" />
            </View>
          ) : (
            <View style={{ width: 36 }} />
          )}
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          {/* Reference chip */}
          <View style={styles.refRow}>
            <Ionicons name="book-outline" size={13} color="rgba(255,255,255,0.45)" />
            <Text style={styles.refText}>{verse.reference}</Text>
          </View>

          {/* Ornamental divider top */}
          <View style={styles.ornamentRow}>
            <View style={styles.ornamentLine} />
            <Ionicons name="star-outline" size={12} color="rgba(255,255,255,0.2)" />
            <View style={styles.ornamentLine} />
          </View>

          {/* Verses: arabic → translation, interleaved */}
          {(verse.verses || [{ number: null, arabic: verse.arabic, translation: verse.translation }]).map((v, i, arr) => (
            <View key={i} style={styles.verseBlock}>
              {/* Ayah number + arabic */}
              {v.number != null && (
                <View style={styles.ayahNumRow}>
                  <View style={styles.ayahNumLine} />
                  <View style={styles.ayahNumBadge}>
                    <Text style={styles.ayahNumText}>{v.number}</Text>
                  </View>
                  <View style={styles.ayahNumLine} />
                </View>
              )}
              <Text style={styles.arabic}>{v.arabic}</Text>
              {/* Translation directly below */}
              <Text style={styles.translation}>{v.translation}</Text>
              {/* Spacing between verses */}
              {i < arr.length - 1 && <View style={{ height: 28 }} />}
            </View>
          ))}

          {/* Read with your heart */}
          <View style={[styles.heartReminder, { marginTop: 20 }]}>
            <Ionicons name="heart-outline" size={14} color="rgba(255,255,255,0.3)" />
            <Text style={styles.heartReminderText}>
              Read with your heart. Let these words settle.
            </Text>
          </View>

          {/* Mark as read */}
          <TouchableOpacity
            onPress={handleMarkRead}
            activeOpacity={read ? 1 : 0.8}
            style={{ marginTop: 'auto' }}
          >
            <LinearGradient
              colors={read ? ['#166534', '#14532D'] : ['#D4871A', '#A0521A']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.markReadBtn}
            >
              <Ionicons
                name={read ? 'checkmark-circle' : 'book'}
                size={18}
                color="#FFFFFF"
              />
              <Text style={styles.markReadBtnText}>
                {read ? 'Read today — Alhamdulillah' : 'Mark as Read'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ height: insets.bottom + 24 }} />
        </ScrollView>

      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0C1829' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.35)',
  },
  readBadge: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(74,222,128,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingBottom: 20,
  },

  refRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginBottom: 20,
  },
  refText: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.8,
  },

  ornamentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 32,
  },
  ornamentLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  arabic: {
    fontSize: 28,
    color: '#FFFFFF',
    textAlign: 'right',
    lineHeight: 56,
    fontFamily: 'Amiri_400Regular',
    marginBottom: 14,
  },

  verseBlock: {
    marginBottom: 8,
  },
  // Ayah number row
  ayahNumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
    marginTop: 4,
  },
  ayahNumLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  ayahNumBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212,135,26,0.4)',
    backgroundColor: 'rgba(212,135,26,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ayahNumText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(212,135,26,0.8)',
    letterSpacing: 0.3,
  },

  translation: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 27,
    textAlign: 'left',
    fontStyle: 'italic',
  },

  heartReminder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  heartReminderText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.28)',
    fontStyle: 'italic',
    letterSpacing: 0.3,
  },

  markReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 28,
  },
  markReadBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
