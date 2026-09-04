// Shared, mutable color tokens used across the whole app.
// Importing screens read `colors.*` directly. The PreferencesProvider
// mutates these tokens in place so that every existing style reacts to
// dark mode without each screen having to subscribe to a context.

export const colors = {
  primary: '#14532D', // deep green (buttons, headings)
  primaryDark: '#0F3D21',
  accent: '#22C55E', // light/mint green accents
  accentSoft: '#BBF7D0',
  background: '#F4F6F5',
  card: '#FFFFFF',
  border: '#E2E5E3',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  white: '#FFFFFF',
  black: '#000000',
  danger: '#DC2626',
  tagAnnouncements: '#DCFCE7',
  tagCampusLife: '#FFE8CC',
  tagEvents: '#FDE2E2',
  tagEmergency: '#FEE2E2',
  tagBroadcast: '#EFF6FF',
  tagEmergencyText: '#DC2626',
  tagBroadcastText: '#2563EB',
  overlay: 'rgba(20, 83, 45, 0.55)',
  surface: '#F3F4F6',
  likeActive: '#E0245E',
  tagCampusLifeText: '#C2410C',
  tagEventsText: '#DC2626',
  verifyText: '#CFE7DA',
  verifyBadgeBg: 'rgba(255,255,255,0.18)',
  verifyDivider: 'rgba(255,255,255,0.15)',
  switchTrackOff: '#DFE2E6',
  interestBlue: '#2563EB',
  interestBlueBg: '#EFF6FF',
  interestGreen: '#059669',
  interestGreenBg: '#ECFDF5',
  verifiedBadge: '#2563EB',
};

// Dark-mode overrides. Only the tokens that should change are listed here;
// everything else falls back to the light definition.
const darkColors: Partial<typeof colors> = {
  primary: '#22C55E',
  primaryDark: '#16A34A',
  accent: '#4ADE80',
  accentSoft: '#14532D',
  background: '#0B1410',
  card: '#13211A',
  border: '#3A5A4E',
  textPrimary: '#F3F6F4',
  textSecondary: '#A7B5AD',
  textMuted: '#7C8A82',
  tagAnnouncements: '#14331F',
  tagCampusLife: '#3A2A12',
  tagEvents: '#3A1A1A',
  overlay: 'rgba(0, 0, 0, 0.6)',
  surface: '#243831',
  likeActive: '#F472B6',
  tagCampusLifeText: '#FB923C',
  tagEventsText: '#F87171',
  verifyText: 'rgba(255,255,255,0.7)',
  verifyBadgeBg: 'rgba(0,0,0,0.2)',
  verifyDivider: 'rgba(255,255,255,0.2)',
  switchTrackOff: '#374151',
  interestBlue: '#60A5FA',
  interestBlueBg: '#1E3A5F',
  interestGreen: '#34D399',
  interestGreenBg: '#14532D',
};

const lightColors: typeof colors = {
  primary: '#14532D',
  primaryDark: '#0F3D21',
  accent: '#22C55E',
  accentSoft: '#BBF7D0',
  background: '#F4F6F5',
  card: '#FFFFFF',
  border: '#E2E5E3',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  white: '#FFFFFF',
  black: '#000000',
  danger: '#DC2626',
  tagAnnouncements: '#DCFCE7',
  tagCampusLife: '#FFE8CC',
  tagEvents: '#FDE2E2',
  tagEmergency: '#FEE2E2',
  tagBroadcast: '#EFF6FF',
  tagEmergencyText: '#DC2626',
  tagBroadcastText: '#2563EB',
  overlay: 'rgba(20, 83, 45, 0.55)',
  surface: '#F3F4F6',
  likeActive: '#E0245E',
  tagCampusLifeText: '#C2410C',
  tagEventsText: '#DC2626',
  verifyText: '#CFE7DA',
  verifyBadgeBg: 'rgba(255,255,255,0.18)',
  verifyDivider: 'rgba(255,255,255,0.15)',
  switchTrackOff: '#DFE2E6',
  interestBlue: '#2563EB',
  interestBlueBg: '#EFF6FF',
  interestGreen: '#059669',
  interestGreenBg: '#ECFDF5',
  verifiedBadge: '#2563EB',
};

export function applyTheme(isDark: boolean): void {
  const source = isDark ? darkColors : lightColors;
  (Object.keys(source) as (keyof typeof colors)[]).forEach(key => {
    (colors as Record<string, string>)[key] = source[key] as string;
  });
}

// Text-size scale derived from the 0/1/2 preference value.
export function textSizeScale(textSize: number): number {
  if (textSize <= 0) {
    return 0.9;
  }
  if (textSize >= 2) {
    return 1.2;
  }
  return 1;
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
};

export const typography = {
  h1: {fontSize: 28, fontWeight: '800' as const},
  h2: {fontSize: 22, fontWeight: '700' as const},
  h3: {fontSize: 18, fontWeight: '700' as const},
  body: {fontSize: 15, fontWeight: '400' as const},
  small: {fontSize: 13, fontWeight: '400' as const},
  label: {fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.5},
} as const;
