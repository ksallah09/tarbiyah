import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

const SPEEDS = [1.0, 1.5, 2.0];

export default function AudioPlayer({ audioUrl, accentColor = '#1B3D2F' }) {
  const soundRef      = useRef(null);
  const [status, setStatus]       = useState(null); // expo-av playback status
  const [speedIndex, setSpeedIndex] = useState(0);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  const isPlaying  = status?.isPlaying ?? false;
  const duration   = status?.durationMillis ?? 0;
  const position   = status?.positionMillis ?? 0;
  const progress   = duration > 0 ? position / duration : 0;

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay: false, progressUpdateIntervalMillis: 500 },
          (s) => { if (mounted) setStatus(s); }
        );
        soundRef.current = sound;
        if (mounted) setLoading(false);
      } catch (e) {
        if (mounted) {
          setError('Could not load audio.');
          setLoading(false);
        }
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
      // Replay from start if finished
      if (status?.didJustFinish || (duration > 0 && position >= duration - 100)) {
        await soundRef.current.setPositionAsync(0);
      }
      await soundRef.current.playAsync();
    }
  }

  async function cycleSpeed() {
    const next = (speedIndex + 1) % SPEEDS.length;
    setSpeedIndex(next);
    await soundRef.current?.setRateAsync(SPEEDS[next], true);
  }

  async function seek(pct) {
    if (!soundRef.current || !duration) return;
    await soundRef.current.setPositionAsync(Math.floor(pct * duration));
  }

  function formatTime(ms) {
    if (!ms) return '0:00';
    const s   = Math.floor(ms / 1000);
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { borderColor: accentColor + '25' }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.podcastBadge, { backgroundColor: accentColor + '15' }]}>
          <Ionicons name="headset" size={12} color={accentColor} />
          <Text style={[styles.podcastLabel, { color: accentColor }]}>AUDIO OVERVIEW</Text>
        </View>
        <TouchableOpacity onPress={cycleSpeed} style={styles.speedBtn} activeOpacity={0.7}>
          <Text style={[styles.speedText, { color: accentColor }]}>{SPEEDS[speedIndex]}×</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.description}>Listen to a conversation about this module</Text>

      {/* Progress bar */}
      <TouchableOpacity
        style={styles.progressTrack}
        onPress={(e) => {
          const { locationX, target } = e.nativeEvent;
          // Measure width via layout ref instead
        }}
        activeOpacity={1}
      >
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: accentColor }]} />
        </View>
      </TouchableOpacity>

      {/* Times */}
      <View style={styles.times}>
        <Text style={styles.timeText}>{formatTime(position)}</Text>
        <Text style={styles.timeText}>{formatTime(duration)}</Text>
      </View>

      {/* Play button */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.playBtn, { backgroundColor: accentColor }]}
          onPress={togglePlay}
          activeOpacity={0.85}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={24}
              color="#fff"
              style={!isPlaying && { marginLeft: 3 }}
            />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  podcastBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
  },
  podcastLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  speedBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  speedText: {
    fontSize: 12,
    fontWeight: '700',
  },
  description: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 16,
  },
  progressTrack: {
    paddingVertical: 8,
  },
  progressBg: {
    height: 4,
    backgroundColor: '#F0F1F3',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  times: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 16,
  },
  timeText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  controls: {
    alignItems: 'center',
  },
  playBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 5,
  },
  errorText: {
    fontSize: 13,
    color: '#EF4444',
    textAlign: 'center',
  },
});
