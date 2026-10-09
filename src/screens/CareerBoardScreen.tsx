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
  applyToOpportunity,
  CareerOpportunity,
  fetchCareerOpportunities,
  fetchSavedItems,
  setItemSaved,
} from '../services/campus';

type Props = NativeStackScreenProps<RootStackParamList, 'CareerBoard'>;

export default function CareerBoardScreen({navigation}: Props) {
  const [opportunities, setOpportunities] = useState<CareerOpportunity[]>([]);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadOpportunities = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const [rows, savedRows] = await Promise.all([
        fetchCareerOpportunities(),
        fetchSavedItems(),
      ]);
      setOpportunities(rows);
      setSaved(
        Object.fromEntries(
          savedRows
            .filter(item => item.item_type === 'career')
            .map(item => [item.item_id, true]),
        ),
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load opportunities.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadOpportunities();
    }, [loadOpportunities]),
  );

  const handleApply = async (item: CareerOpportunity) => {
    setBusyId(item.id);
    setError(null);
    try {
      const result = await applyToOpportunity(item.id);
      setOpportunities(current =>
        current.map(opportunity =>
          opportunity.id === item.id
            ? {...opportunity, has_applied: result.has_applied}
            : opportunity,
        ),
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to submit your application.',
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleSave = async (item: CareerOpportunity) => {
    setBusyId(item.id);
    setError(null);
    try {
      const result = await setItemSaved('career', item.id, !saved[item.id]);
      setSaved(current => ({...current, [item.id]: result.saved}));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to update saved opportunities.',
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
        <Text style={styles.headerTitle}>Career Board</Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={opportunities}
        contentContainerStyle={styles.listContent}
        keyExtractor={item => item.id}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadOpportunities} />
        }
        ListHeaderComponent={
          error ? <Text style={styles.errorText}>{error}</Text> : null
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.emptyText}>
              No open opportunities right now.
            </Text>
          )
        }
        renderItem={({item}) => (
          <View style={styles.card}>
            <View style={styles.topRow}>
              <View style={styles.companyBadge}>
                <Text style={styles.companyText}>{item.company}</Text>
              </View>
              <Text style={styles.type}>{item.type}</Text>
            </View>

            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.summary}</Text>

            <View style={styles.metaRow}>
              <Icon name="briefcase" size={14} color={colors.primary} />
              <Text style={styles.metaText}>{item.mode}</Text>
            </View>

            <View style={styles.metaRow}>
              <Icon name="clock" size={14} color={colors.primary} />
              <Text style={styles.metaText}>
                {item.deadline
                  ? `Apply by ${new Date(item.deadline).toLocaleDateString()}`
                  : 'No listed deadline'}
              </Text>
            </View>

            <View style={styles.footerRow}>
              <Text style={styles.stipend}>
                {item.stipend === null
                  ? 'Stipend not listed'
                  : `₦${Number(item.stipend).toLocaleString()} / month`}
              </Text>
              <TouchableOpacity
                accessibilityLabel={
                  saved[item.id]
                    ? 'Remove saved opportunity'
                    : 'Save opportunity'
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
                style={[
                  styles.applyButton,
                  item.has_applied && styles.appliedButton,
                ]}
                activeOpacity={0.85}
                disabled={item.has_applied || busyId === item.id}
                onPress={() => handleApply(item)}>
                <Text style={styles.applyText}>
                  {busyId === item.id
                    ? 'Submitting...'
                    : item.has_applied
                    ? 'Applied'
                    : 'Apply'}
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
  companyBadge: {
    backgroundColor: colors.tagBroadcast,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  companyText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
  },
  type: {fontSize: 12, color: colors.textSecondary, fontWeight: '700'},
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
  footerRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stipend: {fontSize: 13, fontWeight: '700', color: colors.primary},
  applyButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  appliedButton: {backgroundColor: colors.textSecondary},
  applyText: {fontSize: 12, fontWeight: '700', color: colors.white},
});
