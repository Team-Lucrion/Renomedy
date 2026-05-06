export const colors = {
  primary: '#006D77', // Deep teal
  secondary: '#83C5BE', // Mint accent
  background: '#F4F9F8', // Very soft mint/white background
  surface: '#FFFFFF', // Card background
  text: '#2D3748',
  textMuted: '#718096',
  border: '#E2E8F0',
  success: '#38A169',
  warning: '#D69E2E',
  danger: '#E53E3E',
  inputBackground: '#EDF2F7',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  pill: 9999,
};

export const typography = {
  h1: { fontSize: 28, fontWeight: '700' as const, color: colors.text },
  h2: { fontSize: 24, fontWeight: '700' as const, color: colors.text },
  h3: { fontSize: 18, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 16, fontWeight: '400' as const, color: colors.text },
  bodySmall: { fontSize: 14, fontWeight: '400' as const, color: colors.textMuted },
  label: { fontSize: 14, fontWeight: '600' as const, color: colors.text },
};

export const shadows = {
  sm: {
    shadowColor: '#006D77',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#006D77',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
};
