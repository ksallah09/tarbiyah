import React, { useState, useEffect, useRef } from 'react';
import { Text, Animated } from 'react-native';

/**
 * TypewriterText
 *
 * Props:
 *   lines      — array of strings to type out sequentially
 *   charDelay  — ms per character (default 28)
 *   lineDelay  — ms pause between lines (default 480)
 *   style      — text style applied to all lines
 *   lineStyle  — optional per-line style override ({ index: style })
 *   onComplete — called when all lines are fully typed
 */
export default function TypewriterText({
  lines = [],
  charDelay = 28,
  lineDelay = 480,
  style,
  lineStyle = {},
  onComplete,
}) {
  const [displayed, setDisplayed]     = useState([]); // fully typed lines
  const [activeText, setActiveText]   = useState(''); // line currently typing
  const [lineIndex, setLineIndex]     = useState(0);
  const [charIndex, setCharIndex]     = useState(0);
  const [done, setDone]               = useState(false);
  const cursorOpacity                 = useRef(new Animated.Value(1)).current;

  // Blinking cursor
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(cursorOpacity, { toValue: 0, duration: 420, useNativeDriver: true }),
        Animated.timing(cursorOpacity, { toValue: 1, duration: 420, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [cursorOpacity]);

  // Typing engine
  useEffect(() => {
    if (lineIndex >= lines.length) {
      setDone(true);
      onComplete?.();
      return;
    }

    const line = lines[lineIndex];

    if (charIndex < line.length) {
      const t = setTimeout(() => {
        setActiveText(line.slice(0, charIndex + 1));
        setCharIndex(c => c + 1);
      }, charDelay);
      return () => clearTimeout(t);
    } else {
      // Line complete — push to displayed, start next
      const t = setTimeout(() => {
        setDisplayed(prev => [...prev, line]);
        setActiveText('');
        setLineIndex(l => l + 1);
        setCharIndex(0);
      }, lineDelay);
      return () => clearTimeout(t);
    }
  }, [lineIndex, charIndex, lines, charDelay, lineDelay]);

  return (
    <Text>
      {displayed.map((line, i) => (
        <Text key={i} style={[style, lineStyle[i]]}>
          {line}{'\n'}
        </Text>
      ))}
      {!done && lineIndex < lines.length && (
        <Text style={[style, lineStyle[lineIndex]]}>
          {activeText}
          <Animated.Text style={[style, lineStyle[lineIndex], { opacity: cursorOpacity }]}>
            {'|'}
          </Animated.Text>
        </Text>
      )}
    </Text>
  );
}
