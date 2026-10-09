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
  CampusClub,
  fetchCampusClubs,
  fetchSavedItems,
  setClubMembership,
  setItemSaved,
} from '../services/campus';

type Props = NativeStackScreenProps<RootStackParamList, 'Clubs'>;

export default function ClubsScreen({navigation}: Props) {
  const [clubs, setClubs] = useState<CampusClub[]>([]);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadClubs = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const [clubRows, savedRows] = await Promise.all([
        fetchCampusClubs(),
        fetchSavedItems(),
      ]);
      setClubs(clubRows);
      setSaved(
        Object.fromEntries(
          savedRows
            .filter(item => item.item_type === 'club')
            .map(item => [item.item_id, true]),
        ),
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load clubs.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadClubs();
    }, [loadClubs]),
  );

  const handleMembership = async (club: CampusClub) => {
    setBusyId(club.id);
    setError(null);
    try {
      const result = await setClubMembership(club.id, club.is_member);
      setClubs(current =>
        current.map(item =>
          item.id === club.id
            ? {
                ...item,
                is_member: result.is_member,
                member_count: result.member_count,
              }
            : item,
        ),
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to update club membership.',
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleSave = async (club: CampusClub) => {
    setBusyId(club.id);
    setError(null);
    try {
      const result = await setItemSaved('club', club.id, !saved[club.id]);
      setSaved(current => ({...current, [club.id]: result.saved}));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to update saved clubs.',
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
        <Text style={styles.headerTitle}>Clubs</Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={clubs}
        contentContainerStyle={styles.listContent}
        keyExtractor={item => item.id}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadClubs} />
        }
        ListHeaderComponent={
          error ? <Text style={styles.errorText}>{error}</Text> : null
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.emptyText}>No clubs have been listed yet.</Text>
          )
        }
        renderItem={({item}) => (
          <View style={styles.card}>
            <View style={styles.topRow}>
              <View style={styles.iconWrap}>
                <Icon name={item.icon} size={20} color={colors.primary} />
              </View>
              <View style={styles.topActions}>
                <Text style={styles.members}>{item.member_count} members</Text>
                <TouchableOpacity
                  accessibilityLabel={
                    saved[item.id] ? 'Remove saved club' : 'Save club'
                  }
                  disabled={busyId === item.id}
                  onPress={() => handleSave(item)}>
                  <Icon
                    name="bookmark"
                    size={17}
                    color={
                      saved[item.id] ? colors.primary : colors.textSecondary
                    }
                  />
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.title}>{item.name}</Text>
            <Text style={styles.subtitle}>{item.description}</Text>

            <View style={styles.metaRow}>
              <Icon name="users" size={14} color={colors.textSecondary} />
              <Text style={styles.metaText}>{item.focus}</Text>
            </View>

            <TouchableOpacity
              style={[styles.joinButton, item.is_member && styles.joinedButton]}
              activeOpacity={0.85}
              disabled={busyId === item.id}
              onPress={() => handleMembership(item)}>
              <Text style={styles.joinText}>
                {busyId === item.id
                  ? 'Saving...'
                  : item.is_member
                  ? 'Joined • Leave'
                  : 'Join club'}
              </Text>
            </TouchableOpacity>
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
  errorText: {color: colors.danger, fontSize: 13, marginBottom: spacing.md},
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
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.tagAnnouncements,
    alignItems: 'center',
    justifyContent: 'center',
  },
  members: {fontSize: 12, color: colors.textSecondary, fontWeight: '700'},
  topActions: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  title: {...typography.h3, color: colors.textPrimary},
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.sm,
  },
  metaText: {fontSize: 13, color: colors.textSecondary},
  joinButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  joinedButton: {backgroundColor: colors.textSecondary},
  joinText: {fontSize: 12, fontWeight: '700', color: colors.white},
});
