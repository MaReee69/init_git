import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { palette, radii, spacing, blur, glow, duration, typography, type Palette, type ThemeMode } from './tokens';

interface Theme {
  mode: ThemeMode;
  colors: Palette;
  spacing: typeof spacing;
  radii: typeof radii;
  blur: typeof blur;
  glow: typeof glow;
  duration: typeof duration;
  typography: typeof typography;
}

const ThemeContext = createContext<Theme | null>(null);

function buildTheme(mode: ThemeMode): Theme {
  return {
    mode,
    colors: palette[mode],
    spacing,
    radii,
    blur,
    glow,
    duration,
    typography,
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const mode: ThemeMode = scheme === 'light' ? 'light' : 'dark';
  const theme = useMemo(() => buildTheme(mode), [mode]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
