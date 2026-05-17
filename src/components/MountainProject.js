import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient as SvgGrad, Stop, G, Polygon } from 'react-native-svg';
import { Animated } from 'react-native';

// ── Mountain SVG illustration ─────────────────────────────────────────────────

function MountainIllustration({ progress = 0, swayAnim, growthScale }) {
  const W = 260;
  const H = 200;

  // Path up the right slope of the mountain from base-right to summit
  // Summit at (130, 28), base-left (20, 175), base-right (240, 175)
  const pathPoints = [
    { x: 210, y: 162 },
    { x: 185, y: 138 },
    { x: 165, y: 115 },
    { x: 150, y:  92 },
    { x: 138, y:  68 },
    { x: 130, y:  42 },
  ];

  // Interpolate hiker position along the path
  const idx     = Math.min(progress * (pathPoints.length - 1), pathPoints.length - 1);
  const lower   = Math.floor(idx);
  const upper   = Math.min(lower + 1, pathPoints.length - 1);
  const frac    = idx - lower;
  const hikerX  = pathPoints[lower].x + (pathPoints[upper].x - pathPoints[lower].x) * frac;
  const hikerY  = pathPoints[lower].y + (pathPoints[upper].y - pathPoints[lower].y) * frac;

  const summitReached = progress >= 1;

  return (
    <Animated.View style={{ transform: [{ translateX: swayAnim }, { scale: growthScale }] }}>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <Defs>
          <SvgGrad id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0"   stopColor="#DBEAFE" stopOpacity="1" />
            <Stop offset="1"   stopColor="#EFF6FF" stopOpacity="1" />
          </SvgGrad>
          <SvgGrad id="mountain" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0"   stopColor="#94A3B8" stopOpacity="1" />
            <Stop offset="0.4" stopColor="#64748B" stopOpacity="1" />
            <Stop offset="1"   stopColor="#4B5563" stopOpacity="1" />
          </SvgGrad>
          <SvgGrad id="snow" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="1" />
            <Stop offset="1" stopColor="#E2E8F0" stopOpacity="1" />
          </SvgGrad>
          <SvgGrad id="grass" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#86EFAC" stopOpacity="1" />
            <Stop offset="1" stopColor="#4ADE80" stopOpacity="1" />
          </SvgGrad>
        </Defs>

        {/* Sky background */}
        <Path d={`M0,0 H${W} V${H} H0 Z`} fill="url(#sky)" />

        {/* Clouds */}
        <G opacity="0.7">
          <Circle cx="45"  cy="45" r="12" fill="#FFFFFF" />
          <Circle cx="58"  cy="40" r="16" fill="#FFFFFF" />
          <Circle cx="72"  cy="45" r="11" fill="#FFFFFF" />
          <Circle cx="195" cy="35" r="10" fill="#FFFFFF" />
          <Circle cx="207" cy="30" r="13" fill="#FFFFFF" />
          <Circle cx="220" cy="35" r="9"  fill="#FFFFFF" />
        </G>

        {/* Mountain body */}
        <Path d="M20,175 L130,28 L240,175 Z" fill="url(#mountain)" />

        {/* Snow cap */}
        <Path d="M130,28 L112,75 L148,75 Z" fill="url(#snow)" />

        {/* Green grass at base */}
        <Path d="M20,175 L130,115 L240,175 Z" fill="url(#grass)" opacity="0.5" />

        {/* Winding path up the slope (dashed effect via circles) */}
        {pathPoints.map((pt, i) => (
          <Circle
            key={i}
            cx={pt.x}
            cy={pt.y}
            r={3}
            fill={i / (pathPoints.length - 1) <= progress ? '#F59E0B' : 'rgba(255,255,255,0.4)'}
          />
        ))}

        {/* Hiker marker */}
        {!summitReached && (
          <G>
            <Circle cx={hikerX} cy={hikerY} r={9} fill="#1B3D2F" opacity="0.9" />
            <Text
              x={hikerX}
              y={hikerY + 5}
              textAnchor="middle"
              fontSize="10"
              fill="#FFFFFF"
            >🧍</Text>
          </G>
        )}

        {/* Flag at summit */}
        {summitReached && (
          <G>
            <Path d={`M130,28 L130,14`} stroke="#1B3D2F" strokeWidth="1.5" />
            <Polygon points="130,14 142,19 130,24" fill="#2E7D62" />
          </G>
        )}

        {/* Stars at summit if reached */}
        {summitReached && (
          <G>
            <Circle cx="100" cy="22" r="3" fill="#F59E0B" opacity="0.9" />
            <Circle cx="160" cy="18" r="2.5" fill="#F59E0B" opacity="0.8" />
            <Circle cx="145" cy="28" r="2" fill="#F59E0B" opacity="0.7" />
          </G>
        )}
      </Svg>
    </Animated.View>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function MountainProject({ prog, stage, total, progress, swayAnim, growthScale, nextReward }) {
  const climbNum    = prog.completedTrees + 1;
  const toSummit    = Math.max(0, (stage.threshold ?? 0) - (prog.currentTreeDeeds ?? total));
  const summitReached = progress >= 1;

  return (
    <View style={s.wrap}>
      {/* Mountain scene */}
      <View style={s.scene}>
        <MountainIllustration progress={progress} swayAnim={swayAnim} growthScale={growthScale} />
      </View>

      {/* Stats */}
      <View style={s.statsRow}>
        <View style={s.stat}>
          <Text style={s.statNum}>{prog.currentTreeDeeds}</Text>
          <Text style={s.statLabel}>steps taken</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.stat}>
          <Text style={s.statNum}>{prog.completedTrees}</Text>
          <Text style={s.statLabel}>summits</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.stat}>
          <Text style={s.statNum}>#{climbNum}</Text>
          <Text style={s.statLabel}>climb</Text>
        </View>
      </View>

      {/* Progress card */}
      <View style={s.progressCard}>
        {summitReached ? (
          <Text style={s.summitText}>🏔️ Summit reached! A new mountain awaits.</Text>
        ) : (
          <>
            <Text style={s.progressLabel}>⛰️  {toSummit} more deed{toSummit !== 1 ? 's' : ''} to the summit</Text>
            <View style={s.track}>
              <View style={[s.fill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
          </>
        )}
        {!!nextReward && (
          <View style={s.rewardRow}>
            <Text style={s.rewardEmoji}>🎁</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.rewardPre}>Summit reward</Text>
              <Text style={s.rewardText}>{nextReward}</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:        { width: '100%' },
  scene:       { alignItems: 'center', marginBottom: 8 },
  statsRow:    { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, alignItems: 'center', justifyContent: 'space-around', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 },
  stat:        { alignItems: 'center', flex: 1 },
  statNum:     { fontSize: 22, fontWeight: '900', color: '#1A1A2E', marginBottom: 2 },
  statLabel:   { fontSize: 11, color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  statDivider: { width: 1, height: 32, backgroundColor: '#F0F0F0' },
  progressCard:{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 },
  progressLabel:{ fontSize: 14, fontWeight: '700', color: '#1A1A2E' },
  track:       { height: 10, backgroundColor: '#F0F0F0', borderRadius: 100, overflow: 'hidden' },
  fill:        { height: 10, backgroundColor: '#2E7D62', borderRadius: 100 },
  summitText:  { fontSize: 15, fontWeight: '700', color: '#2E7D62', textAlign: 'center' },
  rewardRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FEF9EE', borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: '#F5D97A' },
  rewardEmoji: { fontSize: 24 },
  rewardPre:   { fontSize: 10, fontWeight: '700', color: '#B99A3A', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 },
  rewardText:  { fontSize: 14, fontWeight: '800', color: '#7C5900' },
});
