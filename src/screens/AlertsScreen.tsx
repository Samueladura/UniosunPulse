import React, {useState, useMemo, useEffect} from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {colors} from '../theme/colors.ts';
import {usePrefs, useThemedStyles} from '../theme/PreferencesContext';
import {
  fetchAlerts,
  markAllAlertsRead,
  supabase,
  type Alert,
} from '../services/supabase';
import {useAlerts} from '../context/AlertsContext';

const LIGHT_COLORS = {
  bg: '#F5F6F8',
  card: '#FFFFFF',
  green: '#1F6B4A',
  greenLight: '#E7EFEA',
  blue: '#2F6FE4',
  blueLight: '#E9F0FE',
  orange: '#D9622B',
  orangeLight: '#FBEAE0',
  gray: '#6B7280',
  grayLight: '#EEF0F2',
  pink: '#E0578B',
  pinkLight: '#FBE7EF',
  text: '#161B22',
  subtext: '#8A929B',
  border: '#ECEDEF',
  chipBg: '#E7E9EC',
  red: '#D14343',
} as const;

const DARK_COLORS = {
  bg: '#0B1410',
  card: '#13211A',
  green: '#4ADE80',
  greenLight: '#14532D',
  blue: '#60A5FA',
  blueLight: '#1E3A5F',
  orange: '#FB923C',
  orangeLight: '#3A2A12',
  gray: '#A7B5AD',
  grayLight: '#1F3329',
  pink: '#F472B6',
  pinkLight: '#3A1A2A',
  text: '#F3F6F4',
  subtext: '#A7B5AD',
  border: '#1F3329',
  chipBg: '#1F3329',
  red: '#F87171',
} as const;

type FilterKey = 'All' | 'Academic' | 'Entertainment' | 'Elections';

interface AlertItem {
  id: string;
  category: string;
  categoryColor: string;
  iconBg: string;
  icon: string;
  iconColor: string;
  time: string;
  title: string;
  body: string;
  unread?: boolean;
  accentColor?: string;
  cta?: string;
}

interface FilterChipProps {
  label: FilterKey;
  active: boolean;
  onPress: () => void;
}

interface AlertCardProps {
  item: AlertItem;
}

const FILTERS: FilterKey[] = ['All', 'Academic', 'Entertainment', 'Elections'];

const getFilterChipStyles = (C: typeof LIGHT_COLORS | typeof DARK_COLORS) =>
  StyleSheet.create({
    chip: {
      backgroundColor: C.chipBg,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 18,
    },
    chipActive: {backgroundColor: C.green},
    chipText: {fontSize: 13, fontWeight: '700', color: C.subtext},
    chipTextActive: {color: '#FFFFFF'},
  });

const getAlertCardStyles = (C: typeof LIGHT_COLORS | typeof DARK_COLORS) =>
  StyleSheet.create({
    alertCardAccent: {borderLeftWidth: 3},
    accentElectionsBorder: {borderLeftColor: '#D9622B'},
    iconBgAcademic: {backgroundColor: '#E9F0FE'},
    iconBgEntertainment: {backgroundColor: '#EEF0F2'},
    iconBgElections: {backgroundColor: '#FBEAE0'},
    iconBgLibrary: {backgroundColor: '#EEF0F2'},
    iconBgInteractions: {backgroundColor: '#FBE7EF'},
    flexOne: {flex: 1},
    contentScroll: {paddingHorizontal: 16, gap: 10},

    alertCard: {
      backgroundColor: C.card,
      borderRadius: 12,
      padding: 14,
      marginBottom: 12,
    },
    alertBorderLeft: {borderLeftWidth: 3},
    alertRow: {flexDirection: 'row', gap: 12},
    alertIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mentionAvatar: {width: 38, height: 38, borderRadius: 19},
    alertContentCol: {flex: 1},
    alertHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    alertCategory: {fontSize: 12.5, fontWeight: '700'},
    alertTimeRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
    alertTime: {fontSize: 11.5, color: C.subtext},
    unreadDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
      backgroundColor: C.green,
    },
    alertTitle: {
      fontSize: 14.5,
      fontWeight: '800',
      color: C.text,
      marginTop: 4,
    },
    alertBody: {
      fontSize: 13,
      color: C.subtext,
      marginTop: 4,
      lineHeight: 19,
    },
    ctaButton: {
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderColor: C.orange,
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 8,
      marginTop: 12,
    },
    ctaButtonText: {color: C.orange, fontSize: 13, fontWeight: '700'},
  });

function FilterChip({label, active, onPress}: FilterChipProps) {
  const C = usePrefs().isDark ? DARK_COLORS : LIGHT_COLORS;
  const styles = useThemedStyles(() => getFilterChipStyles(C), []);
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      activeOpacity={0.8}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function AlertCard({item}: AlertCardProps) {
  const C = usePrefs().isDark ? DARK_COLORS : LIGHT_COLORS;
  const styles = useThemedStyles(() => getAlertCardStyles(C), []);
  const isMentionCard = item.category === 'Entertainment';
  const hasAccent = !!item.accentColor;

  return (
    <View
      style={[
        styles.alertCard,
        hasAccent && styles.alertBorderLeft,
        hasAccent && styles.accentElectionsBorder,
      ]}>
      <View style={styles.alertRow}>
        {isMentionCard ? (
          <View style={styles.mentionAvatar}>
            <Icon name="at-sign" size={18} color={C.gray} />
          </View>
        ) : (
          <View
            style={[
              styles.alertIconWrap,
              {backgroundColor: item.iconBg || C.grayLight},
            ]}>
            <Icon
              name={item.icon || 'bell'}
              size={18}
              color={item.iconColor || C.gray}
            />
          </View>
        )}

        <View style={styles.alertContentCol}>
          <View style={styles.alertHeaderRow}>
            <Text style={[styles.alertCategory, {color: item.categoryColor}]}>
              {item.category}
            </Text>
            <View style={styles.alertTimeRow}>
              <Text style={styles.alertTime}>{item.time}</Text>
              {item.unread && <View style={styles.unreadDot} />}
            </View>
          </View>
          <Text style={styles.alertTitle}>{item.title}</Text>
          <Text style={styles.alertBody}>{item.body}</Text>

          {item.cta && (
            <TouchableOpacity style={styles.ctaButton} activeOpacity={0.8}>
              <Text style={styles.ctaButtonText}>{item.cta}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const getMainStyles = (C: typeof LIGHT_COLORS | typeof DARK_COLORS) =>
  StyleSheet.create({
    safe: {flex: 1, backgroundColor: C.bg},
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: C.card,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
      gap: 10,
    },
    headerAvatar: {width: 30, height: 30, borderRadius: 15},
    headerTitle: {
      fontSize: 19,
      fontWeight: '800',
      color: C.green,
      flex: 1,
    },
    chipRowWrap: {
      backgroundColor: C.card,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    chipRow: {
      paddingVertical: 12,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 18,
      marginBottom: 10,
    },
    sectionHeaderText: {
      fontSize: 12,
      fontWeight: '700',
      color: C.subtext,
      letterSpacing: 0.5,
    },
    yesterdayHeader: {marginTop: 20, marginBottom: 10},
    markReadText: {fontSize: 12.5, fontWeight: '700', color: C.green},
    scrollContent: {paddingHorizontal: 16, paddingBottom: 24},
    caughtUpWrap: {alignItems: 'center', marginTop: 40, gap: 10},
    caughtUpCircle: {
      width: 42,
      height: 42,
      borderRadius: 21,
      borderWidth: 1.5,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    caughtUpText: {fontSize: 14, color: C.subtext, fontWeight: '600'},
    loadingWrap: {
      paddingVertical: 24,
      alignItems: 'center',
    },
    scrollView: {flex: 1},
    chipRowContent: {paddingHorizontal: 16, gap: 10},
  });

const CATEGORY_META: Record<
  string,
  {
    categoryColor: string;
    iconBg: string;
    icon: string;
    iconColor: string;
    cta?: string;
  }
> = {
  'Academic Affairs': {
    categoryColor: '#2F6FE4',
    iconBg: '#E9F0FE',
    icon: 'award',
    iconColor: '#2F6FE4',
  },
  Academic: {
    categoryColor: '#2F6FE4',
    iconBg: '#E9F0FE',
    icon: 'award',
    iconColor: '#2F6FE4',
  },
  Entertainment: {
    categoryColor: '#161B22',
    iconBg: '#EEF0F2',
    icon: '',
    iconColor: '#6B7280',
  },
  Elections: {
    categoryColor: '#D9622B',
    iconBg: '#FBEAE0',
    icon: 'flag',
    iconColor: '#D9622B',
    cta: 'Watch Live',
  },
  Library: {
    categoryColor: '#8A929B',
    iconBg: '#EEF0F2',
    icon: 'file-text',
    iconColor: '#6B7280',
  },
  Interactions: {
    categoryColor: '#8A929B',
    iconBg: '#FBE7EF',
    icon: 'heart',
    iconColor: '#E0578B',
  },
  'Campus Alert': {
    categoryColor: '#2563EB',
    iconBg: '#EFF6FF',
    icon: 'bell',
    iconColor: '#2563EB',
  },
  'SUG Event': {
    categoryColor: '#D97706',
    iconBg: '#FEF3C7',
    icon: 'calendar',
    iconColor: '#D97706',
  },
  'Security Warning': {
    categoryColor: '#DC2626',
    iconBg: '#FEE2E2',
    icon: 'shield-off',
    iconColor: '#DC2626',
  },
  'General Notice': {
    categoryColor: '#059669',
    iconBg: '#ECFDF5',
    icon: 'info',
    iconColor: '#059669',
  },
  EMERGENCY: {
    categoryColor: '#DC2626',
    iconBg: '#FEE2E2',
    icon: 'shield-off',
    iconColor: '#DC2626',
  },
  BROADCAST: {
    categoryColor: '#2563EB',
    iconBg: '#EFF6FF',
    icon: 'bell',
    iconColor: '#2563EB',
  },
};

function toAlertBackendItem(alert: Alert, _uid: string): AlertItem {
  const meta = CATEGORY_META[alert.category] || {
    categoryColor: '#8A929B',
    iconBg: '#EEF0F2',
    icon: 'bell',
    iconColor: '#6B7280',
  };
  const diff = Date.now() - new Date(alert.created_at).getTime();
  const mins = Math.floor(diff / 60000);
  const timeLabel =
    mins < 1
      ? 'Just now'
      : mins < 60
      ? `${mins}m ago`
      : mins < 1440
      ? `${Math.floor(mins / 60)}h ago`
      : `${Math.floor(mins / 1440)}d ago`;

  return {
    id: alert.id,
    category: alert.category,
    categoryColor: meta.categoryColor,
    iconBg: meta.iconBg,
    icon: meta.icon,
    iconColor: meta.iconColor,
    time: timeLabel,
    title: alert.title,
    body: alert.body || '',
    unread: alert.unread,
    accentColor: meta.categoryColor === '#D9622B' ? '#D9622B' : undefined,
    cta: meta.cta,
  };
}

export default function AlertsScreen() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('All');
  const [allAlerts, setAllAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const C = usePrefs().isDark ? DARK_COLORS : LIGHT_COLORS;
  const styles = useThemedStyles(() => getMainStyles(C), []);

  useEffect(() => {
    (async () => {
      const rows = await fetchAlerts();
      setAllAlerts(rows);
      setLoading(false);
    })();
  }, []);

  const backendAlerts = useMemo(
    () => allAlerts.map(a => toAlertBackendItem(a, 'current')),
    [allAlerts],
  );

  const filteredRecent = useMemo(() => {
    if (activeFilter === 'All') {
      return backendAlerts;
    }
    if (activeFilter === 'Academic') {
      return backendAlerts.filter(
        a => a.category.includes('Academic') || a.category.includes('Library'),
      );
    }
    if (activeFilter === 'Entertainment') {
      return backendAlerts.filter(
        a => a.category === 'Entertainment' || a.category === 'Interactions',
      );
    }
    if (activeFilter === 'Elections') {
      return backendAlerts.filter(a => a.category === 'Elections');
    }
    return backendAlerts;
  }, [activeFilter, backendAlerts]);

  const handleMarkAllRead = async () => {
    await markAllAlertsRead();
    setAllAlerts(prev => prev.map(item => ({...item, unread: false})));
  };

  const unreadCount = backendAlerts.filter(a => a.unread).length;
  const {setUnreadCount: setGlobalUnreadCount} = useAlerts();

  useEffect(() => {
    setGlobalUnreadCount(unreadCount);
  }, [unreadCount, setGlobalUnreadCount]);

  useEffect(() => {
    const channel = supabase
      .channel('alerts:realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'alerts',
          filter: 'is_broadcast=eq.true',
        },
        payload => {
          const newAlert = payload.new as Alert;
          setAllAlerts(prev => [newAlert, ...prev]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Image
          source={require('../assets/uniosun-logo.png')}
          style={styles.headerAvatar}
          resizeMode="contain"
        />
        <Text style={styles.headerTitle}>
          Alerts {unreadCount > 0 ? `(${unreadCount})` : ''}
        </Text>
        <TouchableOpacity>
          <Icon name="search" size={20} color={C.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.chipRowWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipRow}
          contentContainerStyle={styles.chipRowContent}>
          {FILTERS.map(filter => (
            <FilterChip
              key={filter}
              label={filter}
              active={activeFilter === filter}
              onPress={() => setActiveFilter(filter)}
            />
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <>
            {filteredRecent.length > 0 ? (
              <>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionHeaderText}>RECENT</Text>
                  <TouchableOpacity onPress={handleMarkAllRead}>
                    <Text style={styles.markReadText}>Mark all as read</Text>
                  </TouchableOpacity>
                </View>

                {filteredRecent.map(item => (
                  <AlertCard key={item.id} item={item} />
                ))}
              </>
            ) : (
              <View style={styles.caughtUpWrap}>
                <View style={styles.caughtUpCircle}>
                  <Icon name="check" size={20} color={C.subtext} />
                </View>
                <Text style={styles.caughtUpText}>You're all caught up!</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
