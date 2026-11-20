export const colors = {
  bg: '#F4F6FB',
  bgAccent: '#EEF1FF',
  surface: '#FFFFFF',
  surfaceMuted: '#F8FAFC',
  border: '#E2E8F0',
  borderLight: '#EEF2F7',
  primary: '#4F46E5',
  primaryDark: '#3730A3',
  primarySoft: '#EEF2FF',
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',
  success: '#059669',
  successSoft: '#ECFDF5',
  amber: '#D97706',
  amberSoft: '#FFFBEB',
  danger: '#DC2626',
  dangerSoft: '#FEF2F2',
  theory: '#4F46E5',
  theoryBg: '#EEF2FF',
  practice: '#0284C7',
  practiceBg: '#F0F9FF',
  project: '#7C3AED',
  projectBg: '#F5F3FF',
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 36,
} as const;

export const radii = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  full: 999,
} as const;

export const shadows = {
  soft: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
} as const;
