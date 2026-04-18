import React, { useState, useEffect } from 'react';
import { Text, View } from 'react-native';

export default function TypewriterText({
  lines = [],
  charDelay = 28,
  lineDelay = 480,
  style,
  lineStyle = {},
  onComplete,
}) {
  const [displayed, setDisplayed] = useState([]);
  const [activeText, setActiveText] = useState('');
  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);

  useEffect(() => {
    if (lineIndex >= lines.length) {
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
    <View>
      {displayed.map((line, i) => (
        <Text key={i} style={[style, lineStyle[i]]}>
          {line}
        </Text>
      ))}
      {lineIndex < lines.length && (
        <Text style={[style, lineStyle[lineIndex]]}>
          {activeText}
        </Text>
      )}
    </View>
  );
}
