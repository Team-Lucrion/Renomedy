export const colors = {
  primary: '#006D77', // Deep teal
  secondary: '#83C5BE', // Mint accent
  background: '#F4F9F8', // Very soft mint/white background
  surface: '#FFFFFF', // Card background
  text: '#2D3748',
  textMuted: '#4A5568',
  border: '#E2E8F0',
  success: '#2F855A',
  warning: '#975A16',
  danger: '#C53030',
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
  label: { fontSize: 16, fontWeight: '600' as const, color: colors.text },
};

export const shadows = {
  sm: {
    boxShadow: '0px 2px 4px rgba(0, 109, 119, 0.05)',
    elevation: 2,
  },
  md: {
    boxShadow: '0px 6px 12px rgba(0, 109, 119, 0.08)',
    elevation: 4,
  },
};
