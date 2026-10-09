import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/AppNavigator';
import {colors, radius, spacing, typography} from '../theme/colors.ts';
import {
  CampusEvent,
  fetchCampusEvents,
  fetchSavedItems,
  setEventRsvp,
  setItemSaved,
} from '../services/campus';

type Props = NativeStackScreenProps<RootStackParamList, 'Events'>;

export default function EventsScreen({navigation}: Props) {
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const [eventRows, savedRows] = await Promise.all([
        fetchCampusEvents(),
        fetchSavedItems(),
      ]);
      setEvents(eventRows);
      setSaved(
        Object.fromEntries(
          savedRows
            .filter(item => item.item_type === 'event')
            .map(item => [item.item_id, true]),
        ),
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load events.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadEvents();
    }, [loadEvents]),
  );

  const handleRsvp = async (event: CampusEvent) => {
    if (busyId) return;
    setBusyId(event.id);
    setError(null);
    try {
      const result = await setEventRsvp(event.id, !event.is_going);
      setEvents(current =>
        current.map(item =>
          item.id === event.id
            ? {
                ...item,
                is_going: result.is_going,
                attendee_count: result.attendee_count,
              }
            : item,
        ),
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to update your RSVP.',
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleSave = async (event: CampusEvent) => {
    const isSaved = !!saved[event.id];
    setBusyId(event.id);
    setError(null);
    try {
      const result = await setItemSaved('event', event.id, !isSaved);
      setSaved(current => ({...current, [event.id]: result.saved}));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to update saved events.',
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Icon name="arrow-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Events</Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={events}
        contentContainerStyle={styles.listContent}
        keyExtractor={item => item.id}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadEvents} />
        }
        ListHeaderComponent={
          error ? <Text style={styles.errorText}>{error}</Text> : null
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.emptyText}>No upcoming events yet.</Text>
          )
        }
        renderItem={({item}) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.tagWrap}>
                <Text style={styles.tagText}>{item.category}</Text>
              </View>
              <Text style={styles.dateText}>
                {new Date(item.starts_at).toLocaleDateString()}
              </Text>
            </View>

            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.description}</Text>

            <View style={styles.metaRow}>
              <Icon name="map-pin" size={15} color={colors.primary} />
              <Text style={styles.metaText}>{item.venue}</Text>
            </View>

            <View style={styles.metaRow}>
              <Icon name="clock" size={15} color={colors.primary} />
              <Text style={styles.metaText}>
                {new Date(item.starts_at).toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
            </View>

            <View style={styles.footerRow}>
              <Text style={styles.spotsText}>
                {item.attendee_count}
                {item.capacity === null
                  ? ' attending'
                  : ` / ${item.capacity} attending`}
              </Text>
              <TouchableOpacity
                accessibilityLabel={
                  saved[item.id] ? 'Remove saved event' : 'Save event'
                }
                disabled={busyId === item.id}
                onPress={() => handleSave(item)}>
                <Icon
                  name="bookmark"
                  size={18}
                  color={saved[item.id] ? colors.primary : colors.textSecondary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={busyId === item.id}
                onPress={() => handleRsvp(item)}
                style={[
                  styles.rsvpButton,
                  item.is_going && styles.rsvpButtonActive,
                ]}>
                <Text
                  style={[
                    styles.rsvpText,
                    item.is_going && styles.rsvpTextActive,
                  ]}>
                  {busyId === item.id
                    ? 'Saving...'
                    : item.is_going
                    ? 'Going'
                    : 'RSVP'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.background},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {...typography.h3, color: colors.textPrimary},
  headerSpacer: {width: 22},
  listContent: {padding: spacing.md, paddingBottom: spacing.xl},
  errorText: {
    color: colors.danger,
    fontSize: 13,
    marginBottom: spacing.md,
  },
  emptyText: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  tagWrap: {
    backgroundColor: colors.tagAnnouncements,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
  },
  dateText: {fontSize: 12, color: colors.textSecondary, fontWeight: '600'},
  title: {...typography.h3, color: colors.textPrimary, marginBottom: 6},
  subtitle: {fontSize: 14, color: colors.textSecondary, lineHeight: 20},
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.sm,
  },
  metaText: {fontSize: 13, color: colors.textSecondary},
  footerRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  spotsText: {fontSize: 12, color: colors.primary, fontWeight: '700'},
  rsvpButton: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rsvpButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  rsvpText: {fontSize: 12, fontWeight: '700', color: colors.textPrimary},
  rsvpTextActive: {color: colors.white},
});
