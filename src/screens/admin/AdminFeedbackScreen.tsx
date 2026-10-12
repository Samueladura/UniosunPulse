import React, {useEffect, useState, useCallback} from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  FlatList,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {colors, spacing, radius, typography} from '../../theme/colors';
import {adminService} from '../../services/adminService';
import {fetchFeedback, updateFeedbackStatus, Feedback} from '../../services/backend';

export default function AdminFeedbackScreen({navigation}: any) {
  const [loading, setLoading] = useState(true);
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);

  const loadFeedback = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchFeedback();
      setFeedbackList(data);
    } catch (error) {
      console.warn('Failed to load feedback', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  const handleStatusChange = async (
    feedbackId: string,
    newStatus: 'pending' | 'reviewed' | 'resolved',
  ) => {
    try {
      await updateFeedbackStatus(feedbackId, newStatus);
      setFeedbackList(prev =>
        prev.map(f => (f.id === feedbackId ? {...f, status: newStatus} : f)),
      );
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to update status',
      );
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return colors.interestBlue;
      case 'reviewed':
        return colors.interestBlue;
      case 'resolved':
        return colors.primary;
      default:
        return colors.textMuted;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pending Review';
      case 'reviewed':
        return 'Under Review';
      case 'resolved':
        return 'Resolved';
      default:
        return status;
    }
  };

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Feedback Management</Text>
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={colors.primary}
          style={styles.loadingWrap}
        />
      ) : (
        <FlatList
          data={feedbackList}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({item}) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>
                    {item.user_name || 'Anonymous User'}
                  </Text>
                  <Text style={styles.userEmail}>{item.user_email || 'No email'}</Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    {backgroundColor: getStatusColor(item.status)},
                  ]}>
                  <Text style={styles.statusText}>
                    {getStatusLabel(item.status)}
                  </Text>
                </View>
              </View>

              <Text style={styles.message}>{item.message}</Text>

              <View style={styles.cardFooter}>
                <Text style={styles.timestamp}>{formatDate(item.created_at)}</Text>
                <View style={styles.statusActions}>
                  {item.status !== 'pending' && (
                    <TouchableOpacity
                      style={styles.statusBtn}
                      onPress={() => handleStatusChange(item.id, 'pending')}>
                      <Text style={styles.statusBtnText}>Mark Pending</Text>
                    </TouchableOpacity>
                  )}
                  {item.status !== 'reviewed' && (
                    <TouchableOpacity
                      style={styles.statusBtn}
                      onPress={() => handleStatusChange(item.id, 'reviewed')}>
                      <Text style={styles.statusBtnText}>Mark Reviewed</Text>
                    </TouchableOpacity>
                  )}
                  {item.status !== 'resolved' && (
                    <TouchableOpacity
                      style={[styles.statusBtn, styles.statusBtnPrimary]}
                      onPress={() => handleStatusChange(item.id, 'resolved')}>
                      <Text style={styles.statusBtnTextPrimary}>Resolve</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Icon name="mail" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>No feedback submitted yet.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.white,
    fontSize: 19,
  },
  loadingWrap: {
    marginTop: 40,
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  userEmail: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
  },
  message: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  timestamp: {
    fontSize: 12,
    color: colors.textMuted,
  },
  statusActions: {
    flexDirection: 'row',
    gap: 8,
  },
  statusBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  statusBtnPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  statusBtnTextPrimary: {
    color: colors.white,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textMuted,
  },
});