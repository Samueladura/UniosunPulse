import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import {Appearance} from 'react-native';
import {
  UserPreferences,
  fetchUserProfile,
  savePreferences,
} from '../services/backend';
import {applyTheme, textSizeScale, spacing, radius, typography} from './colors';

interface PreferencesContextValue {
  prefs: UserPreferences;
  isDark: boolean;
  textScale: number;
  ready: boolean;
  // Bumped whenever the theme tokens change so the whole tree can re-render
  // and pick up new colors (module-level `colors` mutation alone does not
  // trigger re-renders of already-mounted screens).
  themeVersion: number;
  setPref: <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
  ) => void;
  updatePrefs: (next: UserPreferences) => void;
  resetPrefs: (next: UserPreferences) => void;
}

const DEFAULT_PREFS: UserPreferences = {
  public_visibility: true,
  campus_feed_alerts: true,
  election_reminders: true,
  admin_broadcasts: true,
  dark_mode: false,
  text_size: 1,
  anonymous_posting: false,
  language: 'en-NG',
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

// Apply a global text-size scale
function applyTextScale(_scale: number) {
  // Theme text scaling can be used via usePrefs().textScale
}

export function PreferencesProvider({children}: {children: ReactNode}) {
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFS);
  const [ready, setReady] = useState<boolean>(false);
  const [themeVersion, setThemeVersion] = useState<number>(0);
  const [_systemDark, setSystemDark] = useState<boolean>(
    Appearance.getColorScheme() === 'dark',
  );

  // Keep a ref so `setPref` always reads the latest prefs without re-creating.
  const prefsRef = React.useRef(prefs);
  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

  // Load persisted preferences once.
  useEffect(() => {
    let active = true;
    (async () => {
      const profile = await fetchUserProfile();
      if (active && profile) {
        setPrefs(profile.preferences);
      }
      if (active) {
        setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Track system color scheme changes.
  useEffect(() => {
    const sub = Appearance.addChangeListener(({colorScheme}) => {
      setSystemDark(colorScheme === 'dark');
    });
    return () => sub.remove();
  }, []);

  // Whenever prefs change, apply the theme + text scale.
  const isDark = prefs.dark_mode;
  useEffect(() => {
    Appearance.setColorScheme(isDark ? 'dark' : 'light');
    applyTheme(isDark);
    applyTextScale(textSizeScale(prefs.text_size));
    setThemeVersion(v => v + 1);
  }, [isDark, prefs.text_size]);

  const persist = useCallback(async (next: UserPreferences) => {
    setPrefs(next);
    await savePreferences(next);
  }, []);

  const setPref = useCallback(
    <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      const next = {...prefsRef.current, [key]: value};
      setPrefs(next);
      savePreferences(next);
    },
    [],
  );

  const updatePrefs = useCallback(
    (next: UserPreferences) => {
      persist(next);
    },
    [persist],
  );

  const resetPrefs = useCallback((next: UserPreferences) => {
    setPrefs(next);
  }, []);

  const value: PreferencesContextValue = {
    prefs,
    isDark,
    textScale: textSizeScale(prefs.text_size),
    ready,
    themeVersion,
    setPref,
    updatePrefs,
    resetPrefs,
  };

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePrefs(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error('usePrefs must be used within a PreferencesProvider');
  }
  return ctx;
}

export function useThemedStyles<T>(
  create: () => T,
  deps: React.DependencyList = [],
): T {
  const {themeVersion} = usePrefs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(create, [themeVersion, ...deps]);
}

export {spacing, radius, typography};
