import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BASE_WIDTH = 390; // iPhone 14/15 design base

/**
 * Scale a size proportionally to screen width.
 * Clamped to ±15% so extreme devices don't look weird.
 */
export function rs(size) {
  const scale = Math.max(0.85, Math.min(1.15, SCREEN_WIDTH / BASE_WIDTH));
  return Math.round(PixelRatio.roundToNearestPixel(size * scale));
}

export const isSmallScreen = SCREEN_WIDTH < 375;
export const isLargeScreen = SCREEN_WIDTH > 428;

// Standard horizontal page padding — use instead of hardcoded 20/24
export const hp = rs(20);
