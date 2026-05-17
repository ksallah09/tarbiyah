import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  ScrollView, Modal, SafeAreaView,
} from 'react-native';
import Svg, { Path, Defs, LinearGradient as SvgGrad, Stop, Circle, Ellipse } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// ── Garden elements ────────────────────────────────────────────────────────────

export const GARDEN_ELEMENTS = [
  { key: 'rose',      label: 'Rose Bush',   liveEmoji: '🌹', deadEmoji: '🥀', size: 38 },
  { key: 'oak',       label: 'Oak Tree',    liveEmoji: '🌳', deadEmoji: '🪵', size: 44 },
  { key: 'butterfly', label: 'Butterfly',   liveEmoji: '🦋', deadEmoji: '🫙', size: 30 },
  { key: 'fountain',  label: 'Fountain',    liveEmoji: '⛲', deadEmoji: '🪨', size: 40 },
  { key: 'sunflower', label: 'Sunflower',   liveEmoji: '🌻', deadEmoji: '🌾', size: 36 },
  { key: 'bird',      label: 'Robin',       liveEmoji: '🐦', deadEmoji: '🪺', size: 28 },
  { key: 'rabbit',    label: 'Rabbit',      liveEmoji: '🐇', deadEmoji: '🦴', size: 30 },
  { key: 'pond',      label: 'Pond',        liveEmoji: '🌊', deadEmoji: '🏜️', size: 36 },
  { key: 'apple',     label: 'Apple Tree',  liveEmoji: '🍎', deadEmoji: '🪵', size: 42 },
  { key: 'bee',       label: 'Bee',         liveEmoji: '🐝', deadEmoji: '🕸️', size: 26 },
  { key: 'tulip',     label: 'Tulip',       liveEmoji: '🌷', deadEmoji: '🥀', size: 32 },
  { key: 'dove',      label: 'Dove',        liveEmoji: '🕊️', deadEmoji: '🪹', size: 28 },
];

// Pixel positions within the 340×260 garden canvas
const POSITIONS = [
  { x: 30,  y: 185 }, // rose
  { x: 262, y: 72  }, // oak
  { x: 148, y: 42  }, // butterfly
  { x: 148, y: 158 }, // fountain
  { x: 84,  y: 138 }, // sunflower
  { x: 290, y: 24  }, // bird
  { x: 36,  y: 218 }, // rabbit
  { x: 228, y: 185 }, // pond
  { x: 30,  y: 72  }, // apple
  { x: 110, y: 28  }, // bee
  { x: 208, y: 124 }, // tulip
  { x: 174, y: 14  }, // dove
];

const W = 340;
const H = 260;

// ── Garden SVG background ──────────────────────────────────────────────────────

function GardenBackground({ alive }) {
  const skyA = alive ? '#DBEAFE' : '#E5E7EB';
  const skyB = alive ? '#EFF6FF' : '#F3F4F6';
  const hillA = alive ? '#86EFAC' : '#9CA3AF';
  const hillB = alive ? '#4ADE80' : '#6B7280';
  const grassA = alive ? '#BBF7D0' : '#D1D5DB';
  const grassB = alive ? '#86EFAC' : '#9CA3AF';
  const pathCol = alive ? '#C4A882' : '#9CA3AF';

  return (
    <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
      <Defs>
        <SvgGrad id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={skyA} />
          <Stop offset="1" stopColor={skyB} />
        </SvgGrad>
        <SvgGrad id="hill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={hillA} />
          <Stop offset="1" stopColor={hillB} />
        </SvgGrad>
        <SvgGrad id="grass" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={grassA} />
          <Stop offset="1" stopColor={grassB} />
        </SvgGrad>
      </Defs>

      {/* Sky */}
      <Path d={`M0,0 H${W} V${H} H0 Z`} fill="url(#sky)" />

      {/* Rolling hills */}
      <Path d={`M0,${H * 0.5} Q${W * 0.25},${H * 0.32} ${W * 0.5},${H * 0.45} Q${W * 0.75},${H * 0.58} ${W},${H * 0.4} V${H} H0 Z`} fill="url(#hill)" />

      {/* Grass foreground */}
      <Path d={`M0,${H * 0.68} Q${W * 0.3},${H * 0.6} ${W * 0.6},${H * 0.7} Q${W * 0.8},${H * 0.76} ${W},${H * 0.65} V${H} H0 Z`} fill="url(#grass)" />

      {/* Dirt path */}
      <Ellipse cx={W * 0.48} cy={H * 0.82} rx={55} ry={18} fill={pathCol} opacity="0.4" />
    </Svg>
  );
}

// ── Single garden element ──────────────────────────────────────────────────────

function GardenElement({ element, position, isAlive, isPending, onPress, justRestored }) {
  const scaleAnim  = useRef(new Animated.Value(isAlive ? 1 : 0.85)).current;
  const pulseAnim  = useRef(new Animated.Value(1)).current;
  const glowAnim   = useRef(new Animated.Value(0)).current;

  // Pulse dead elements when parent is waiting for child to restore
  useEffect(() => {
    if (!isPending || isAlive) { pulseAnim.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isPending, isAlive]);

  // Pop animation when just restored
  useEffect(() => {
    if (!justRestored) return;
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.6, duration: 220, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1,   friction: 4, tension: 60, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, [justRestored]);

  const tappable = isPending && !isAlive;
  const emoji = isAlive ? element.liveEmoji : element.deadEmoji;

  return (
    <Animated.View
      style={[
        gs.elementWrap,
        {
          left:      position.x,
          top:       position.y,
          transform: [{ scale: Animated.multiply(scaleAnim, tappable ? pulseAnim : new Animated.Value(1)) }],
          opacity:   isAlive ? 1 : (isPending ? 1 : 0.45),
        },
      ]}
    >
      <TouchableOpacity onPress={tappable ? onPress : undefined} disabled={!tappable} activeOpacity={0.7}>
        <View style={[gs.elementBubble, tappable && gs.elementBubblePending, isAlive && gs.elementBubbleAlive]}>
          <Text style={{ fontSize: element.size * 0.7 }}>{emoji}</Text>
        </View>
        {tappable && (
          <View style={gs.tapHint}>
            <Text style={gs.tapHintText}>tap</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export default function GardenProject({
  projectState,
  childName,
  childColor,
  onRestore,
  cycleCount,
}) {
  const restored = projectState?.restoredItems ?? [];
  const total    = GARDEN_ELEMENTS.length;
  const done     = restored.length;
  const progress = done / total;
  const cycle    = projectState?.cycleNumber ?? 1;
  const allDone  = done >= total;

  return (
    <View style={gs.wrap}>
      {/* Garden canvas */}
      <View style={gs.canvas}>
        <GardenBackground alive={done > total * 0.5} />
        {GARDEN_ELEMENTS.map((el, i) => (
          <GardenElement
            key={el.key}
            element={el}
            position={POSITIONS[i]}
            isAlive={restored.includes(el.key)}
            isPending={false}
            justRestored={false}
          />
        ))}
      </View>

      {/* Stats */}
      <View style={gs.statsRow}>
        <View style={gs.stat}>
          <Text style={gs.statNum}>{done}</Text>
          <Text style={gs.statLabel}>restored</Text>
        </View>
        <View style={gs.statDivider} />
        <View style={gs.stat}>
          <Text style={gs.statNum}>{total - done}</Text>
          <Text style={gs.statLabel}>still sleeping</Text>
        </View>
        <View style={gs.statDivider} />
        <View style={gs.stat}>
          <Text style={gs.statNum}>#{cycle}</Text>
          <Text style={gs.statLabel}>garden</Text>
        </View>
      </View>

      {/* Progress */}
      <View style={gs.progressCard}>
        {allDone ? (
          <Text style={gs.allDoneText}>🌺 Garden fully restored! A new one is ready.</Text>
        ) : (
          <>
            <Text style={gs.progressLabel}>
              {done === 0
                ? 'Log a deed to start restoring the garden'
                : `${total - done} element${total - done !== 1 ? 's' : ''} still need restoring`}
            </Text>
            <View style={gs.track}>
              <View style={[gs.fill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
          </>
        )}
      </View>
    </View>
  );
}

// ── Restoration modal (shown to child after deed) ─────────────────────────────

export function GardenRestorationModal({ visible, projectState, childName, childColor, onRestore, onClose }) {
  const [phase,        setPhase]        = useState('handoff'); // 'handoff' | 'pick' | 'done'
  const [restoredKey,  setRestoredKey]  = useState(null);
  const overlayAnim = useRef(new Animated.Value(0)).current;

  const restored = projectState?.restoredItems ?? [];
  const cycle    = projectState?.cycleNumber ?? 1;
  const dead     = GARDEN_ELEMENTS.filter(e => !restored.includes(e.key));

  useEffect(() => {
    if (visible) {
      setPhase('handoff');
      setRestoredKey(null);
    }
  }, [visible]);

  function handleElementPress(key) {
    if (restoredKey) return;
    setRestoredKey(key);
    // Brief delay to let animation play, then finish
    setTimeout(() => {
      setPhase('done');
      onRestore(key);
    }, 900);
  }

  const element   = GARDEN_ELEMENTS.find(e => e.key === restoredKey);
  const pronoun   = childName ? `${childName}'s` : 'the';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <LinearGradient
        colors={phase === 'done' ? ['#ECFDF5', '#D1FAE5', '#A7F3D0'] : ['#1B3D2F', '#2E7D62', '#34895C']}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={{ flex: 1 }}>

          {/* ── Handoff screen ── */}
          {phase === 'handoff' && (
            <View style={gs.handoffWrap}>
              <TouchableOpacity style={gs.handoffClose} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
              <Text style={gs.handoffEmoji}>🌺</Text>
              <Text style={gs.handoffTitle}>A piece of the garden is waiting!</Text>
              <Text style={gs.handoffSub}>Hand the phone to {childName} — they get to bring something back to life.</Text>
              <TouchableOpacity style={gs.handoffBtn} onPress={() => setPhase('pick')} activeOpacity={0.85}>
                <Text style={gs.handoffBtnText}>Show {childName} the garden →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Pick screen ── */}
          {phase === 'pick' && (
            <View style={{ flex: 1 }}>
              <View style={gs.pickHeader}>
                <Text style={gs.pickTitle}>Tap something to bring it back to life ✨</Text>
              </View>
              <View style={gs.canvas}>
                <GardenBackground alive={restored.length > GARDEN_ELEMENTS.length * 0.5} />
                {GARDEN_ELEMENTS.map((el, i) => (
                  <GardenElement
                    key={el.key}
                    element={el}
                    position={POSITIONS[i]}
                    isAlive={restored.includes(el.key)}
                    isPending={!restored.includes(el.key) && !restoredKey}
                    onPress={() => handleElementPress(el.key)}
                    justRestored={restoredKey === el.key}
                  />
                ))}
              </View>
              <Text style={gs.pickSub}>
                {restored.length} of {GARDEN_ELEMENTS.length} restored · Garden #{cycle}
              </Text>
            </View>
          )}

          {/* ── Done screen ── */}
          {phase === 'done' && element && (
            <View style={gs.doneWrap}>
              <Text style={gs.doneEmoji}>{element.liveEmoji}</Text>
              <Text style={gs.doneTitle}>The {element.label} is alive! 🌿</Text>
              <Text style={gs.doneSub}>
                MashaAllah {childName}! {restored.length + 1} of {GARDEN_ELEMENTS.length} restored.
                {restored.length + 1 >= GARDEN_ELEMENTS.length
                  ? '\n\n🌺 The whole garden is restored! A new one is ready.'
                  : `\n\n${GARDEN_ELEMENTS.length - restored.length - 1} more to go.`}
              </Text>
              <TouchableOpacity style={gs.doneBtn} onPress={onClose} activeOpacity={0.85}>
                <Text style={gs.doneBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          )}

        </SafeAreaView>
      </LinearGradient>
    </Modal>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const gs = StyleSheet.create({
  wrap:        { width: '100%' },

  canvas:      { width: W, height: H, position: 'relative', overflow: 'hidden', borderRadius: 18, alignSelf: 'center', marginBottom: 12 },

  elementWrap: { position: 'absolute', alignItems: 'center' },
  elementBubble: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)' },
  elementBubblePending: { borderColor: '#F59E0B', borderWidth: 2, backgroundColor: 'rgba(245,158,11,0.1)' },
  elementBubbleAlive:   { backgroundColor: 'rgba(255,255,255,0.55)', borderColor: 'rgba(255,255,255,0.5)' },
  tapHint:     { alignItems: 'center', marginTop: 2 },
  tapHintText: { fontSize: 9, fontWeight: '700', color: '#F59E0B', textTransform: 'uppercase', letterSpacing: 0.5 },

  statsRow:    { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, alignItems: 'center', justifyContent: 'space-around', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 },
  stat:        { alignItems: 'center', flex: 1 },
  statNum:     { fontSize: 22, fontWeight: '900', color: '#1A1A2E', marginBottom: 2 },
  statLabel:   { fontSize: 11, color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  statDivider: { width: 1, height: 32, backgroundColor: '#F0F0F0' },

  progressCard:  { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 },
  progressLabel: { fontSize: 14, fontWeight: '600', color: '#1A1A2E' },
  track:         { height: 10, backgroundColor: '#F0F0F0', borderRadius: 100, overflow: 'hidden' },
  fill:          { height: 10, backgroundColor: '#2E7D62', borderRadius: 100 },
  allDoneText:   { fontSize: 15, fontWeight: '700', color: '#2E7D62', textAlign: 'center' },

  // Handoff screen
  handoffWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  handoffClose: { position: 'absolute', top: 16, right: 16 },
  handoffEmoji: { fontSize: 72, marginBottom: 24 },
  handoffTitle: { fontSize: 26, fontWeight: '900', color: '#FFFFFF', textAlign: 'center', marginBottom: 12 },
  handoffSub:   { fontSize: 16, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 24, marginBottom: 40 },
  handoffBtn:   { backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 40 },
  handoffBtnText:{ fontSize: 16, fontWeight: '800', color: '#1B3D2F' },

  // Pick screen
  pickHeader:   { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, alignItems: 'center' },
  pickTitle:    { fontSize: 18, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },
  pickSub:      { fontSize: 13, color: 'rgba(255,255,255,0.7)', textAlign: 'center', paddingVertical: 12 },

  // Done screen
  doneWrap:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  doneEmoji:  { fontSize: 80, marginBottom: 20 },
  doneTitle:  { fontSize: 26, fontWeight: '900', color: '#1B3D2F', textAlign: 'center', marginBottom: 12 },
  doneSub:    { fontSize: 15, color: '#374151', textAlign: 'center', lineHeight: 24, marginBottom: 40 },
  doneBtn:    { backgroundColor: '#1B3D2F', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 48 },
  doneBtnText:{ fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
});
