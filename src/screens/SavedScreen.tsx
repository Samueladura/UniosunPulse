import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import {fetchPostById} from '../services/backend';
import {fetchSavedItems, SavedItem, setItemSaved} from '../services/campus';

type Props = NativeStackScreenProps<RootStackParamList, 'Saved'>;

export default function SavedScreen({navigation}: Props) {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      setItems(await fetchSavedItems());
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load saved items.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadItems();
    }, [loadItems]),
  );

  const removeSavedItem = async (item: SavedItem) => {
    setBusyId(item.item_id);
    setError(null);
    try {
      await setItemSaved(item.item_type, item.item_id, false);
      setItems(current =>
        current.filter(
          saved =>
            saved.item_type !== item.item_type ||
            saved.item_id !== item.item_id,
        ),
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to remove this saved item.',
      );
    } finally {
      setBusyId(null);
    }
  };

  const openSavedItem = async (item: SavedItem) => {
    if (item.item_type === 'post') {
      try {
        const post = await fetchPostById(item.item_id);
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

    const destination = {
      event: 'Events',
      marketplace: 'Marketplace',
      career: 'CareerBoard',
      club: 'Clubs',
    }[item.item_type] as 'Events' | 'Marketplace' | 'CareerBoard' | 'Clubs';
    navigation.navigate(destination);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Icon name="arrow-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Saved</Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={items}
        contentContainerStyle={styles.listContent}
        keyExtractor={item => `${item.item_type}-${item.item_id}`}
        refreshing={loading}
        onRefresh={loadItems}
        ListHeaderComponent={
          error ? <Text style={styles.errorText}>{error}</Text> : null
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.emptyText}>
              Items you save will appear here.
            </Text>
          )
        }
        renderItem={({item}) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.85}
            onPress={() => void openSavedItem(item)}>
            <View style={styles.badgeWrap}>
              <Text style={styles.badgeText}>{item.item_type}</Text>
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.summary}</Text>
            <View style={styles.footerRow}>
              <Text style={styles.meta}>{item.meta || 'Saved'}</Text>
              <TouchableOpacity
                accessibilityLabel="Remove saved item"
                disabled={busyId === item.item_id}
                onPress={() => void removeSavedItem(item)}>
                <Icon name="bookmark" size={16} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
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
  badgeWrap: {
    alignSelf: 'flex-start',
    backgroundColor: colors.tagAnnouncements,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
  },
  title: {...typography.h3, color: colors.textPrimary, marginTop: spacing.sm},
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  meta: {fontSize: 12, color: colors.primary, fontWeight: '700'},
});
