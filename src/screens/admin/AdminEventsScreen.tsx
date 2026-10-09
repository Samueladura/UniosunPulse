import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../navigation/AppNavigator';
import {colors, radius, spacing, typography} from '../../theme/colors';
import {
  AdminCampusEvent,
  EventRsvp,
  fetchAdminEvents,
  fetchEventRsvps,
  removeAdminEvent,
  removeEventRsvp,
  saveAdminEvent,
} from '../../services/campus';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminEvents'>;
type EventForm = {
  title: string;
  description: string;
  category: string;
  venue: string;
  starts_at: string;
  ends_at: string;
  capacity: string;
};

const emptyForm: EventForm = {
  title: '',
  description: '',
  category: 'Campus',
  venue: '',
  starts_at: '',
  ends_at: '',
  capacity: '',
};

export default function AdminEventsScreen({navigation}: Props) {
  const [events, setEvents] = useState<AdminCampusEvent[]>([]);
  const [rsvps, setRsvps] = useState<EventRsvp[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<AdminCampusEvent | null>(
    null,
  );
  const [editing, setEditing] = useState<AdminCampusEvent | null>(null);
  const [form, setForm] = useState<EventForm>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [showRsvps, setShowRsvps] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      setEvents(await fetchAdminEvents());
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load campus events.',
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

  const openForm = (event?: AdminCampusEvent) => {
    setEditing(event ?? null);
    setForm(
      event
        ? {
            title: event.title,
            description: event.description,
            category: event.category,
            venue: event.venue,
            starts_at: event.starts_at,
            ends_at: event.ends_at ?? '',
            capacity: event.capacity === null ? '' : String(event.capacity),
          }
        : emptyForm,
    );
    setError(null);
    setShowForm(true);
  };

  const saveEvent = async () => {
    const startsAt = Date.parse(form.starts_at);
    const endsAt = form.ends_at.trim() ? Date.parse(form.ends_at) : null;
    const capacity =
      form.capacity.trim() === '' ? null : Number(form.capacity.trim());
    if (
      form.title.trim().length < 3 ||
      form.venue.trim().length < 2 ||
      Number.isNaN(startsAt) ||
      (endsAt !== null && (Number.isNaN(endsAt) || endsAt <= startsAt)) ||
      (capacity !== null && (!Number.isInteger(capacity) || capacity < 0))
    ) {
      setError(
        'Enter a title, venue, valid ISO start time, optional later end time, and positive whole-number capacity.',
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const savedEvent = await saveAdminEvent(
        {
          title: form.title.trim(),
          description: form.description.trim(),
          category: form.category.trim() || 'Campus',
          venue: form.venue.trim(),
          starts_at: new Date(startsAt).toISOString(),
          ends_at: endsAt === null ? null : new Date(endsAt).toISOString(),
          capacity,
        },
        editing?.id,
      );
      setEvents(current =>
        editing
          ? current.map(item => (item.id === savedEvent.id ? savedEvent : item))
          : [savedEvent, ...current],
      );
      setShowForm(false);
      setEditing(null);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to save this event.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (event: AdminCampusEvent) => {
    Alert.alert(
      'Remove this event?',
      'Removing it also deletes its RSVP records.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setBusyId(event.id);
            try {
              await removeAdminEvent(event.id);
              setEvents(current =>
                current.filter(item => item.id !== event.id),
              );
            } catch (requestError) {
              setError(
                requestError instanceof Error
                  ? requestError.message
                  : 'Unable to remove this event.',
              );
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  const toggleEventStatus = async (event: AdminCampusEvent) => {
    setBusyId(event.id);
    try {
      const updated = await saveAdminEvent(
        {
          title: event.title,
          venue: event.venue,
          starts_at: event.starts_at,
          status: event.status === 'published' ? 'cancelled' : 'published',
        },
        event.id,
      );
      setEvents(current =>
        current.map(item => (item.id === updated.id ? updated : item)),
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to update event status.',
      );
    } finally {
      setBusyId(null);
    }
  };

  const openRsvps = async (event: AdminCampusEvent) => {
    setSelectedEvent(event);
    setShowRsvps(true);
    try {
      setRsvps(await fetchEventRsvps(event.id));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load RSVPs.',
      );
    }
  };

  const handleRemoveRsvp = (rsvp: EventRsvp) => {
    if (!selectedEvent) return;
    Alert.alert('Remove RSVP?', `Remove ${rsvp.full_name} from this event?`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeEventRsvp(selectedEvent.id, rsvp.user_id);
            setRsvps(current =>
              current.filter(item => item.user_id !== rsvp.user_id),
            );
            setEvents(current =>
              current.map(item =>
                item.id === selectedEvent.id
                  ? {
                      ...item,
                      attendee_count: Math.max(0, item.attendee_count - 1),
                    }
                  : item,
              ),
            );
            setSelectedEvent(current =>
              current
                ? {
                    ...current,
                    attendee_count: Math.max(0, current.attendee_count - 1),
                  }
                : current,
            );
          } catch (requestError) {
            setError(
              requestError instanceof Error
                ? requestError.message
                : 'Unable to remove this RSVP.',
            );
          }
        },
      },
    ]);
  };

  const updateField = (key: keyof EventForm, value: string) =>
    setForm(current => ({...current, [key]: value}));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Icon name="arrow-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Campus Events</Text>
        <TouchableOpacity onPress={() => openForm()}>
          <Icon name="plus" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>
      <FlatList
        data={events}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadEvents} />
        }
        ListHeaderComponent={
          error ? <Text style={styles.error}>{error}</Text> : null
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.empty}>
              No campus events have been created.
            </Text>
          )
        }
        renderItem={({item}) => (
          <View style={styles.card}>
            <View style={styles.eventTop}>
              <Text style={styles.title}>{item.title}</Text>
              <Text
                style={[
                  styles.status,
                  item.status === 'cancelled' && styles.cancelled,
                ]}>
                {item.status}
              </Text>
            </View>
            <Text style={styles.description}>
              {item.category} · {item.venue}
            </Text>
            <Text style={styles.description}>
              {new Date(item.starts_at).toLocaleString()} ·{' '}
              {item.attendee_count}
              {item.capacity === null ? ' attending' : ` / ${item.capacity}`}
            </Text>
            <View style={styles.actions}>
              <Action
                label="Edit"
                icon="edit-2"
                onPress={() => openForm(item)}
              />
              <Action
                label="RSVPs"
                icon="users"
                onPress={() => void openRsvps(item)}
              />
              <Action
                label={item.status === 'published' ? 'Cancel' : 'Publish'}
                icon={item.status === 'published' ? 'slash' : 'check'}
                onPress={() => void toggleEventStatus(item)}
                disabled={busyId === item.id}
              />
              <Action
                label="Remove"
                icon="trash-2"
                onPress={() => handleDelete(item)}
                disabled={busyId === item.id}
                destructive
              />
            </View>
          </View>
        )}
      />
      <Modal
        visible={showForm}
        animationType="slide"
        onRequestClose={() => setShowForm(false)}>
        <SafeAreaView style={styles.safe}>
          <ScrollView contentContainerStyle={styles.formList}>
            <View style={styles.form}>
              <View style={styles.formHeader}>
                <Text style={styles.headerTitle}>
                  {editing ? 'Edit event' : 'Create event'}
                </Text>
                <TouchableOpacity onPress={() => setShowForm(false)}>
                  <Icon name="x" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Event title"
                value={form.title}
                onChangeText={value => updateField('title', value)}
                maxLength={120}
              />
              <TextInput
                style={[styles.input, styles.multiline]}
                placeholder="Description"
                value={form.description}
                onChangeText={value => updateField('description', value)}
                multiline
                maxLength={2000}
              />
              <TextInput
                style={styles.input}
                placeholder="Category"
                value={form.category}
                onChangeText={value => updateField('category', value)}
                maxLength={50}
              />
              <TextInput
                style={styles.input}
                placeholder="Venue"
                value={form.venue}
                onChangeText={value => updateField('venue', value)}
                maxLength={160}
              />
              <TextInput
                style={styles.input}
                placeholder="Starts at (ISO datetime)"
                value={form.starts_at}
                onChangeText={value => updateField('starts_at', value)}
                autoCapitalize="none"
              />
              <Text style={styles.hint}>
                Example: 2026-10-15T10:00:00+01:00
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Ends at (optional ISO datetime)"
                value={form.ends_at}
                onChangeText={value => updateField('ends_at', value)}
                autoCapitalize="none"
              />
              <TextInput
                style={styles.input}
                placeholder="Capacity (leave empty for unlimited)"
                value={form.capacity}
                onChangeText={value => updateField('capacity', value)}
                keyboardType="number-pad"
              />
              {error && <Text style={styles.error}>{error}</Text>}
              <TouchableOpacity
                style={[styles.primaryButton, saving && styles.disabled]}
                disabled={saving}
                onPress={() => void saveEvent()}>
                <Text style={styles.primaryText}>
                  {saving
                    ? 'Saving…'
                    : editing
                    ? 'Save changes'
                    : 'Create event'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
      <Modal
        visible={showRsvps}
        animationType="slide"
        onRequestClose={() => setShowRsvps(false)}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.modalHeader}>
            <Text style={styles.headerTitle}>
              RSVPs · {selectedEvent?.attendee_count ?? 0}
            </Text>
            <TouchableOpacity onPress={() => setShowRsvps(false)}>
              <Icon name="x" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={rsvps}
            keyExtractor={item => item.user_id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={<Text style={styles.empty}>No RSVPs yet.</Text>}
            renderItem={({item}) => (
              <View style={styles.rsvpRow}>
                <View style={styles.rsvpInfo}>
                  <Text style={styles.title}>{item.full_name}</Text>
                  <Text style={styles.description}>{item.email}</Text>
                </View>
                <TouchableOpacity onPress={() => handleRemoveRsvp(item)}>
                  <Icon name="user-x" size={20} color={colors.danger} />
                </TouchableOpacity>
              </View>
            )}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function Action({
  label,
  icon,
  onPress,
  disabled,
  destructive,
}: {
  label: string;
  icon: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <TouchableOpacity
      style={styles.action}
      onPress={onPress}
      disabled={disabled}>
      <Icon
        name={icon}
        size={15}
        color={destructive ? colors.danger : colors.primary}
      />
      <Text style={[styles.actionText, destructive && styles.error]}>
        {label}
      </Text>
    </TouchableOpacity>
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
  listContent: {padding: spacing.md, paddingBottom: spacing.xl},
  empty: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: spacing.xl,
  },
  error: {color: colors.danger, fontSize: 13, marginBottom: spacing.sm},
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  eventTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {...typography.h3, color: colors.textPrimary},
  description: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  status: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cancelled: {color: colors.danger},
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  action: {flexDirection: 'row', alignItems: 'center', gap: 5},
  actionText: {fontSize: 12, color: colors.primary, fontWeight: '700'},
  modalHeader: {
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  formList: {padding: spacing.md, flexGrow: 1, justifyContent: 'center'},
  form: {gap: spacing.sm},
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    backgroundColor: colors.card,
  },
  multiline: {minHeight: 80, textAlignVertical: 'top'},
  hint: {fontSize: 11, color: colors.textMuted},
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    padding: spacing.md,
  },
  primaryText: {color: colors.white, fontWeight: '700'},
  disabled: {opacity: 0.55},
  rsvpRow: {
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rsvpInfo: {flex: 1},
});
