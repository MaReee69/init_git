/**
 * Warm Futurism / Human AI デザイントークン。
 * 画面ごとの直書きを避け、色・角丸・余白・ぼかし・発光・アニメーション時間はここに集約する。
 */

export type ThemeMode = 'light' | 'dark';

export interface Palette {
  bgBase: string;
  bgElevated: string;
  bgSurface: string;
  bgSurfaceStrong: string;
  border: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  aurora: string;
  violet: string;
  coral: string;
  success: string;
  warning: string;
  danger: string;
}

export const palette: Record<ThemeMode, Palette> = {
  dark: {
    bgBase: '#05050A',
    bgElevated: '#0B0B14',
    bgSurface: 'rgba(255,255,255,0.06)',
    bgSurfaceStrong: 'rgba(255,255,255,0.10)',
    border: 'rgba(255,255,255,0.12)',
    borderStrong: 'rgba(255,255,255,0.20)',
    textPrimary: '#F5F3F7',
    textSecondary: 'rgba(245,243,247,0.68)',
    textTertiary: 'rgba(245,243,247,0.44)',
    aurora: '#67E8F9',
    violet: '#A78BFA',
    coral: '#FB7185',
    success: '#4ADE80',
    warning: '#FBBF24',
    danger: '#F87171',
  },
  light: {
    bgBase: '#FAF9F6',
    bgElevated: '#FFFFFF',
    bgSurface: 'rgba(11,11,20,0.04)',
    bgSurfaceStrong: 'rgba(11,11,20,0.07)',
    border: 'rgba(11,11,20,0.10)',
    borderStrong: 'rgba(11,11,20,0.18)',
    textPrimary: '#1B1A22',
    textSecondary: 'rgba(27,26,34,0.66)',
    textTertiary: 'rgba(27,26,34,0.44)',
    aurora: '#0EA5B7',
    violet: '#7C5CE0',
    coral: '#E24E70',
    success: '#16A34A',
    warning: '#B45309',
    danger: '#DC2626',
  },
};

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 48,
} as const;

export const radii = {
  sm: 12,
  md: 20,
  lg: 28,
  pill: 999,
} as const;

export const blur = {
  soft: 24,
  strong: 40,
} as const;

export const glow = {
  aurora: {
    shadowColor: '#67E8F9',
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
  violet: {
    shadowColor: '#A78BFA',
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
  coral: {
    shadowColor: '#FB7185',
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
} as const;

/** ms単位。アニメーションは150〜350msを目標にする */
export const duration = {
  fast: 150,
  base: 250,
  slow: 350,
} as const;

export const typography = {
  display: { fontSize: 28, lineHeight: 36, fontWeight: '600' as const },
  title: { fontSize: 22, lineHeight: 30, fontWeight: '600' as const },
  subtitle: { fontSize: 17, lineHeight: 24, fontWeight: '500' as const },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  label: { fontSize: 13, lineHeight: 16, fontWeight: '600' as const },
};

