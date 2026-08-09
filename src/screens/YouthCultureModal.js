import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, Modal, FlatList, ScrollView,
  TouchableOpacity, Dimensions, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ChildWorldCard } from '../components/ChildWorldCard';

const { width: SCREEN_W } = Dimensions.get('window');

export default function YouthCultureModal({ visible, onClose, children = [], initialChildId = null }) {
  const insets  = useSafeAreaInsets();
  const flatRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const initialIndex = initialChildId
    ? Math.max(0, children.findIndex(c => c.id === initialChildId))
    : 0;

  useEffect(() => {
    if (!visible) return;
    setActiveIndex(initialIndex);
    if (initialIndex > 0) {
      setTimeout(() => {
        flatRef.current?.scrollToIndex({ index: initialIndex, animated: false });
      }, 150);
    }
  }, [visible, initialChildId]);

  function goTo(index) {
    flatRef.current?.scrollToIndex({ index, animated: true });
    setActiveIndex(index);
  }

  if (!children.length) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.root}>

        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>

          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerEyebrow}>THIS WEEK</Text>
              <Text style={styles.headerTitle}>Youth Culture Trends</Text>
              <Text style={styles.headerSub}>Connection begins with understanding</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={18} color="#374151" />
            </TouchableOpacity>
          </View>

          {/* Child pill selector — replaces dots */}
          {children.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.pillScroll}
              contentContainerStyle={styles.pillRow}
            >
              {children.map((c, i) => {
                const active = activeIndex === i;
                return (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => goTo(i)}
                    style={[styles.childPill, active && { backgroundColor: c.color, borderColor: c.color }]}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.pillAvatar, { backgroundColor: active ? 'rgba(255,255,255,0.25)' : c.color }]}>
                      {c.photo ? (
                        <Image
                          source={{ uri: c.photo }}
                          style={styles.pillAvatarPhoto}
                          cachePolicy="memory-disk"
                          contentFit="cover"
                        />
                      ) : (
                        <Text style={styles.pillAvatarInitial}>{c.name[0]}</Text>
                      )}
                    </View>
                    <Text style={[styles.pillName, active && styles.pillNameActive]}>
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* ── Carousel ── */}
        <FlatList
          ref={flatRef}
          data={children}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={c => c.id}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
          onMomentumScrollEnd={e => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
            setActiveIndex(idx);
          }}
          renderItem={({ item: child, index }) => {
            const next = children[index + 1] ?? null;
            return (
              <ScrollView
                style={{ width: SCREEN_W, backgroundColor: '#FFFFFF' }}
                contentContainerStyle={styles.slide}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                {/* Child identity strip */}
                <View style={[styles.childStrip, { backgroundColor: child.color + '14' }]}>
                  <View style={[styles.childAvatar, { backgroundColor: child.color }]}>
                    {child.photo ? (
                      <Image
                        source={{ uri: child.photo }}
                        style={styles.childAvatarPhoto}
                        cachePolicy="memory-disk"
                        contentFit="cover"
                      />
                    ) : (
                      <Text style={styles.childAvatarInitial}>{child.name[0]}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.childName, { color: child.color }]}>{child.name}'s World</Text>
                    <Text style={styles.childAge}>Age {child.age}</Text>
                  </View>
                  {children.length > 1 && (
                    <Text style={styles.childPageCount}>{index + 1} / {children.length}</Text>
                  )}
                </View>

                {/* Full culture card */}
                <ChildWorldCard child={child} flush />

                {/* Up next — swipe hint */}
                {next && (
                  <TouchableOpacity
                    style={[styles.nextHint, { borderColor: next.color + '40' }]}
                    onPress={() => goTo(index + 1)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.nextHintAvatar, { backgroundColor: next.color }]}>
                      {next.photo ? (
                        <Image
                          source={{ uri: next.photo }}
                          style={styles.nextHintAvatarPhoto}
                          cachePolicy="memory-disk"
                          contentFit="cover"
                        />
                      ) : (
                        <Text style={styles.nextHintAvatarInitial}>{next.name[0]}</Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.nextHintLabel}>Up next</Text>
                      <Text style={[styles.nextHintName, { color: next.color }]}>{next.name}'s World</Text>
                    </View>
                    <View style={[styles.nextHintArrow, { backgroundColor: next.color + '18' }]}>
                      <Ionicons name="arrow-forward" size={14} color={next.color} />
                    </View>
                  </TouchableOpacity>
                )}

                <View style={{ height: 40 }} />
              </ScrollView>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // Header
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F1F3',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerEyebrow: {
    fontSize: 10, fontWeight: '700', color: '#9CA3AF',
    letterSpacing: 1.2, marginBottom: 2,
  },
  headerTitle: {
    fontSize: 20, fontWeight: '800', color: '#1A1A2E',
  },
  headerSub: {
    fontSize: 12, color: '#6B7280', marginTop: 3,
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },

  // Child pill selector
  pillScroll: { marginTop: 12, marginHorizontal: -20 },
  pillRow:   { gap: 8, paddingHorizontal: 20, paddingRight: 24 },
  childPill: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingVertical: 6, paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  pillAvatar: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  pillAvatarPhoto:   { width: 22, height: 22, borderRadius: 11 },
  pillAvatarInitial: { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },
  pillName: {
    fontSize: 13, fontWeight: '700', color: '#374151',
  },
  pillNameActive: { color: '#FFFFFF' },

  // Slide
  slide: { paddingTop: 0 },

  // Child identity strip
  childStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 14,
    marginBottom: 4,
  },
  childAvatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  childAvatarPhoto:   { width: 44, height: 44, borderRadius: 22 },
  childAvatarInitial: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  childName: { fontSize: 16, fontWeight: '800' },
  childAge:  { fontSize: 12, color: '#6B7280', marginTop: 1 },
  childPageCount: {
    fontSize: 11, fontWeight: '600', color: '#9CA3AF',
  },

  // "Up next" row
  nextHint: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginTop: 24,
    padding: 14, borderRadius: 14,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
  },
  nextHintAvatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  nextHintAvatarPhoto:   { width: 36, height: 36, borderRadius: 18 },
  nextHintAvatarInitial: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  nextHintLabel: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.8, marginBottom: 2 },
  nextHintName:  { fontSize: 14, fontWeight: '800' },
  nextHintArrow: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },
});
