import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
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
import type {RootStackParamList} from '../../navigation/AppNavigator';
import {colors, radius, spacing, typography} from '../../theme/colors';
import {
  fetchMarketplaceReports,
  MarketplaceReport,
  reviewMarketplaceReport,
} from '../../services/campus';

type Props = NativeStackScreenProps<
  RootStackParamList,
  'AdminMarketplaceReports'
>;

export default function AdminMarketplaceReportsScreen({navigation}: Props) {
  const [reports, setReports] = useState<MarketplaceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      setReports(await fetchMarketplaceReports());
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load marketplace reports.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadReports();
    }, [loadReports]),
  );

  const review = async (
    report: MarketplaceReport,
    status: 'actioned' | 'dismissed',
    removeListing: boolean,
  ) => {
    setBusyId(report.id);
    try {
      await reviewMarketplaceReport(report.id, status, removeListing);
      setReports(current =>
        current.map(item =>
          item.id === report.id
            ? {
                ...item,
                status,
                listing_status: removeListing ? 'removed' : item.listing_status,
              }
            : item,
        ),
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to review this report.',
      );
    } finally {
      setBusyId(null);
    }
  };

  const promptReview = (report: MarketplaceReport) => {
    Alert.alert(
      'Review marketplace report',
      `Reported listing: ${report.listing_title}`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Dismiss',
          onPress: () => void review(report, 'dismissed', false),
        },
        {
          text: 'Remove listing',
          style: 'destructive',
          onPress: () => void review(report, 'actioned', true),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Icon name="arrow-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Marketplace Reports</Text>
        <View style={styles.headerSpacer} />
      </View>
      <FlatList
        data={reports}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadReports} />
        }
        ListHeaderComponent={
          error ? <Text style={styles.error}>{error}</Text> : null
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.empty}>No marketplace reports.</Text>
          )
        }
        renderItem={({item}) => (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.title}>{item.listing_title}</Text>
              <Text
                style={[
                  styles.status,
                  item.status !== 'pending' && styles.closed,
                ]}>
                {item.status}
              </Text>
            </View>
            <Text style={styles.body}>Reason: {item.reason}</Text>
            {!!item.details && <Text style={styles.body}>{item.details}</Text>}
            <Text style={styles.meta}>
              Reported by {item.reporter_name || item.reporter_email} ·{' '}
              {new Date(item.created_at).toLocaleDateString()}
            </Text>
            {item.status === 'pending' ? (
              <TouchableOpacity
                style={styles.button}
                disabled={busyId === item.id}
                onPress={() => promptReview(item)}>
                <Text style={styles.buttonText}>
                  {busyId === item.id ? 'Saving…' : 'Review report'}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.meta}>
                Listing status: {item.listing_status}
              </Text>
            )}
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
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {...typography.h3, color: colors.textPrimary, flex: 1},
  status: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.danger,
    textTransform: 'uppercase',
  },
  closed: {color: colors.textSecondary},
  body: {fontSize: 13, color: colors.textPrimary, marginTop: spacing.sm},
  meta: {fontSize: 11, color: colors.textSecondary, marginTop: spacing.sm},
  button: {
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  buttonText: {fontSize: 12, color: colors.white, fontWeight: '700'},
  error: {color: colors.danger, fontSize: 13, marginBottom: spacing.md},
  empty: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: spacing.xl,
  },
});
