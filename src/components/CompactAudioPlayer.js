import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

const SPEEDS = [1.0, 1.5, 2.0];

export default function CompactAudioPlayer({ audioUrl, accentColor = '#1B3D2F', onComplete }) {
  const soundRef  = useRef(null);
  const [status, setStatus]         = useState(null);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);

  const isPlaying = status?.isPlaying ?? false;
  const duration  = status?.durationMillis ?? 0;
  const position  = status?.positionMillis ?? 0;
  const progress  = duration > 0 ? position / duration : 0;
  const finished  = duration > 0 && position >= duration - 100;

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay: false, progressUpdateIntervalMillis: 500 },
          (s) => {
            if (!mounted) return;
            setStatus(s);
            if (s.didJustFinish && onComplete) onComplete();
          }
        );
        soundRef.current = sound;
        if (mounted) setLoading(false);
      } catch {
        if (mounted) { setError(true); setLoading(false); }
      }
    }

    load();
    return () => {
      mounted = false;
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, [audioUrl]);

  async function togglePlay() {
    if (!soundRef.current) return;
    if (isPlaying) {
      await soundRef.current.pauseAsync();
    } else {
      if (finished) await soundRef.current.setPositionAsync(0);
      await soundRef.current.playAsync();
    }
  }

  async function cycleSpeed() {
    const next = (speedIndex + 1) % SPEEDS.length;
    setSpeedIndex(next);
    await soundRef.current?.setRateAsync(SPEEDS[next], true);
  }

  function fmt(ms) {
    if (!ms) return '0:00';
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  }

  if (error) return null;

  return (
    <View style={[styles.container, { borderColor: accentColor + '30' }]}>
      {/* Play button + progress bar */}
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.playBtn, { backgroundColor: accentColor }]}
          onPress={togglePlay}
          disabled={loading}
          activeOpacity={0.82}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={16}
              color="#fff"
              style={!isPlaying && { marginLeft: 2 }}
            />
          )}
        </TouchableOpacity>

        <View style={styles.progressWrap}>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: accentColor }]} />
          </View>
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{fmt(position)}</Text>
            <Text style={styles.timeText}>{fmt(duration)}</Text>
          </View>
        </View>

        <TouchableOpacity onPress={cycleSpeed} style={styles.speedBtn} activeOpacity={0.7}>
          <Text style={[styles.speedText, { color: accentColor }]}>{SPEEDS[speedIndex]}×</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#FAFAFA',
    marginTop: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  progressWrap: {
    flex: 1,
    gap: 4,
  },
  progressBg: {
    height: 3,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  speedBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    flexShrink: 0,
  },
  speedText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
