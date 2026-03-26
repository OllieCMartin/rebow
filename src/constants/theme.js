// Rebow brand colours — derived from the logo's soft blue palette
export const COLORS = {
  primary: '#7EAEC4',       // logo blue
  primaryDark: '#5A8FA8',
  primaryLight: '#A8CBE0',
  accent: '#4ECDC4',        // teal from device handle
  background: '#F5F7FA',
  card: '#FFFFFF',
  text: '#2D3436',
  textLight: '#636E72',
  textMuted: '#B2BEC3',
  danger: '#E74C3C',
  warning: '#F39C12',
  success: '#27AE60',
  white: '#FFFFFF',
  black: '#1A1A2E',
  border: '#DFE6E9',
  gaugeTrack: '#E8EDF2',
  ghostPacer: '#7EAEC4',
  liveIndicator: '#E74C3C',
  painLow: '#27AE60',
  painMid: '#F39C12',
  painHigh: '#E74C3C',
};

export const FONTS = {
  regular: { fontSize: 16, color: COLORS.text },
  heading: { fontSize: 24, fontWeight: '700', color: COLORS.text },
  subheading: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  caption: { fontSize: 13, color: COLORS.textLight },
  big: { fontSize: 48, fontWeight: '800', color: COLORS.text },
};

export const SHADOWS = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
};

// Exercise defaults
export const DEFAULTS = {
  pacerDuration: 10,  // seconds for one rep
  repRangeMin: 0,     // degrees
  repRangeMax: 90,    // degrees
  sets: 3,
  reps: 10,
};

// Mass options in kg
export const MASS_OPTIONS = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5];

// Bar length options in cm
export const LENGTH_OPTIONS = [20, 25, 30, 35, 40, 45, 50];
