import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/AppNavigator';
import {colors, radius, spacing, typography} from '../theme/colors.ts';
import {fetchPostById} from '../services/backend';
import {
  CampusSearchResult,
  CampusSearchType,
  fetchSavedItems,
  searchCampus,
  setItemSaved,
} from '../services/campus';

type Props = NativeStackScreenProps<RootStackParamList, 'Search'>;

type SearchType = 'All' | 'Feed' | 'Marketplace';

const FILTERS: SearchType[] = ['All', 'Feed', 'Marketplace'];
const SEARCH_TYPE: Record<SearchType, CampusSearchType | 'all'> = {
  All: 'all',
  Feed: 'feed',
  Marketplace: 'marketplace',
};

export default function SearchScreen({navigation, route}: Props) {
  const [query, setQuery] = useState(route.params?.initialQuery ?? '');
  const [activeFilter, setActiveFilter] = useState<SearchType>('All');
  const [results, setResults] = useState<CampusSearchResult[]>([]);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    let active = true;
    const timeout = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await searchCampus(query, SEARCH_TYPE[activeFilter]);
        if (active) {
          setResults(rows);
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : 'Unable to search campus content.',
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [activeFilter, query, refreshVersion]);

  useEffect(() => {
    let active = true;
    fetchSavedItems()
      .then(items => {
        if (active) {
          setSaved(
            Object.fromEntries(
              items.map(item => [`${item.item_type}:${item.item_id}`, true]),
            ),
          );
        }
      })
      .catch(requestError => {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : 'Unable to load saved items.',
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const openResult = async (item: CampusSearchResult) => {
    if (item.item_type === 'post') {
      try {
        const post = await fetchPostById(item.id);
        if (!post) {
          setError('This post is no longer available.');
          return;
        }
        navigation.navigate('PostDetail', {post});
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to open this post.',
        );
      }
      return;
    }
    if (item.item_type === 'marketplace') {
      navigation.navigate('Marketplace');
    }
    // Other item types (event, career, club) have been removed
  };

  const toggleSave = async (item: CampusSearchResult) => {
    const key = `${item.item_type}:${item.id}`;
    setBusyId(key);
    setError(null);
    try {
      const result = await setItemSaved(item.item_type, item.id, !saved[key]);
      setSaved(current => ({...current, [key]: result.saved}));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to update saved items.',
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
        <Text style={styles.headerTitle}>Search</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.searchWrap}>
        <Icon name="search" size={18} color={colors.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search campus topics, events, items, clubs..."
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
        />
      </View>

      <FlatList
        horizontal
        contentContainerStyle={styles.filterRow}
        showsHorizontalScrollIndicator={false}
        data={FILTERS}
        keyExtractor={item => item}
        renderItem={({item}) => {
          const isActive = item === activeFilter;
          return (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setActiveFilter(item)}
              style={[styles.filterChip, isActive && styles.filterChipActive]}>
              <Text
                style={[
                  styles.filterChipText,
                  isActive && styles.filterChipTextActive,
                ]}>
                {item}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      <FlatList
        data={results}
        keyExtractor={item => `${item.item_type}-${item.id}`}
        contentContainerStyle={styles.listContent}
        refreshing={loading}
        onRefresh={() => setRefreshVersion(version => version + 1)}
        ListHeaderComponent={
          error ? <Text style={styles.errorText}>{error}</Text> : null
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <View style={styles.emptyState}>
              <Icon name="search" size={32} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No matches found</Text>
              <Text style={styles.emptyBody}>
                Try a broader search for events, campus updates, or student
                life.
              </Text>
            </View>
          )
        }
        renderItem={({item}) => (
          <View style={styles.resultCard}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => void openResult(item)}>
              <View
                style={[
                  styles.badge,
                  {backgroundColor: getTypeColor(item.item_type)},
                ]}>
                <Text style={styles.badgeText}>
                  {getTypeLabel(item.item_type)}
                </Text>
              </View>
              <Text style={styles.resultTitle}>{item.title}</Text>
              <Text style={styles.resultSubtitle}>{item.summary}</Text>
              <Text style={styles.resultMeta}>{item.meta}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel={
                saved[`${item.item_type}:${item.id}`]
                  ? 'Remove saved item'
                  : 'Save item'
              }
              disabled={busyId === `${item.item_type}:${item.id}`}
              onPress={() => void toggleSave(item)}
              style={styles.saveButton}>
              <Icon
                name="bookmark"
                size={17}
                color={
                  saved[`${item.item_type}:${item.id}`]
                    ? colors.primary
                    : colors.textSecondary
                }
              />
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function getTypeLabel(type: CampusSearchResult['item_type']): string {
  return type === 'career'
    ? 'Jobs'
    : type === 'event'
    ? 'Events'
    : type === 'post'
    ? 'Feed'
    : type === 'club'
    ? 'Clubs'
    : 'Marketplace';
}

function getTypeColor(type: CampusSearchResult['item_type']): string {
  switch (type) {
    case 'post':
      return '#DCFCE7';
    case 'event':
      return '#FDE2E2';
    case 'marketplace':
      return '#E0F2FE';
    case 'career':
      return '#F3E8FF';
    case 'club':
      return '#FEF3C7';
  }
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
  searchWrap: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    paddingVertical: 2,
  },
  filterRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  filterChipTextActive: {color: colors.white},
  listContent: {paddingHorizontal: spacing.md, paddingBottom: spacing.xl},
  errorText: {color: colors.danger, fontSize: 13, marginBottom: spacing.md},
  resultCard: {
    position: 'relative',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    marginBottom: spacing.sm,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textPrimary,
    textTransform: 'uppercase',
  },
  resultTitle: {...typography.h3, color: colors.textPrimary},
  resultSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  resultMeta: {
    marginTop: spacing.sm,
    fontSize: 12,
    color: colors.primary,
    fontWeight: '700',
  },
  saveButton: {position: 'absolute', right: 0, top: 0, padding: 2},
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  emptyBody: {
    marginTop: spacing.sm,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
});
