import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {colors, spacing, radius, typography} from '../../theme/colors';
import {adminService, AdminMetrics} from '../../services/adminService';
import {backend} from '../../services/backend';

export default function AdminDashboardScreen({navigation}: any) {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<AdminMetrics>({
    totalStudents: 0,
    pendingVerifications: 0,
    flaggedPosts: 0,
    activeElections: 0,
    alertsSentToday: 0,
  });
  const [auditLogs, setAuditLogs] = useState<
    {
      id: string;
      action: string;
      adminName: string;
      createdAt: string;
    }[]
  >([]);

  const loadMetrics = async () => {
    setLoading(true);
    const data = await adminService.getDashboardMetrics();
    setMetrics(data);
    setLoading(false);
  };

  const loadAuditLogs = async () => {
    const logs = await adminService.getAuditLogs();
    setAuditLogs(
      logs.map(log => ({
        id: log.id,
        action: log.action,
        adminName: log.adminName,
        createdAt: log.createdAt,
      })),
    );
  };

  useEffect(() => {
    loadMetrics();
    loadAuditLogs();

    const channel = backend
      .channel('admin:full_dashboard')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'student_verifications',
        },
        () => {
          loadMetrics();
          loadAuditLogs();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reported_posts',
        },
        () => {
          loadMetrics();
          loadAuditLogs();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'elections',
        },
        loadMetrics,
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'profiles',
        },
        loadMetrics,
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'admin_audit_logs',
        },
        loadAuditLogs,
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'alerts',
        },
        () => {
          loadMetrics();
          loadAuditLogs();
        },
      )
      .subscribe();

    return () => {
      backend.removeChannel(channel);
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      {/* Header Banner */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() =>
            navigation.canGoBack()
              ? navigation.goBack()
              : navigation.replace('SignIn')
          }>
          <Icon name="arrow-left" size={22} color={colors.white} />
        </TouchableOpacity>
        <View style={styles.flexOne}>
          <Text style={styles.headerTitle}>UniOsun Admin Command</Text>
          <Text style={styles.headerSubtitle}>
            University & SUG Governance Hub
          </Text>
        </View>
        <TouchableOpacity onPress={loadMetrics} style={styles.refreshBtn}>
          <Icon name="refresh-cw" size={18} color={colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Stat Cards Grid */}
        <Text style={styles.sectionTitle}>Overview & Live Metrics</Text>
        {loading ? (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={styles.loadingWrap}
          />
        ) : (
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <View style={[styles.iconWrap, styles.iconWrapGreenLight]}>
                <Icon name="users" size={20} color={colors.primary} />
              </View>
              <Text style={styles.metricValue}>
                {metrics.totalStudents.toLocaleString()}
              </Text>
              <Text style={styles.metricLabel}>Total Students</Text>
            </View>

            <View style={styles.metricCard}>
              <View style={[styles.iconWrap, styles.iconWrapYellowLight]}>
                <Icon name="shield-check" size={20} color="#D97706" />
              </View>
              <Text style={[styles.metricValue, styles.metricValueYellow]}>
                {metrics.pendingVerifications}
              </Text>
              <Text style={styles.metricLabel}>Pending Verifications</Text>
            </View>

            <View style={styles.metricCard}>
              <View style={[styles.iconWrap, styles.iconWrapRedLight]}>
                <Icon name="flag" size={20} color={colors.danger} />
              </View>
              <Text style={[styles.metricValue, {color: colors.danger}]}>
                {metrics.flaggedPosts}
              </Text>
              <Text style={styles.metricLabel}>Flagged Posts</Text>
            </View>

            <View style={styles.metricCard}>
              <View style={[styles.iconWrap, styles.iconWrapBlueLight]}>
                <Icon
                  name="check-square"
                  size={20}
                  color={colors.interestBlue}
                />
              </View>
              <Text style={[styles.metricValue, {color: colors.interestBlue}]}>
                {metrics.activeElections}
              </Text>
              <Text style={styles.metricLabel}>Active Elections</Text>
            </View>
          </View>
        )}

        {/* Quick Action Navigation Grid */}
        <Text style={styles.sectionTitle}>Administrative Modules</Text>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('AdminUserVerification')}>
          <View style={[styles.actionIcon, styles.actionIconGreen]}>
            <Icon name="user-check" size={24} color={colors.primary} />
          </View>
          <View style={styles.flexOne}>
            <Text style={styles.actionTitle}>Student Verification Queue</Text>
            <Text style={styles.actionDesc}>
              Review matriculation details, student ID cards & approve badges.
            </Text>
          </View>
          <Icon name="chevron-right" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('AdminContentModeration')}>
          <View style={[styles.actionIcon, styles.actionIconRed]}>
            <Icon name="alert-triangle" size={24} color={colors.danger} />
          </View>
          <View style={styles.flexOne}>
            <Text style={styles.actionTitle}>Content Moderation & Feed</Text>
            <Text style={styles.actionDesc}>
              Manage reported posts, issue warnings, & post announcements.
            </Text>
          </View>
          <Icon name="chevron-right" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('AdminElectionManager')}>
          <View style={[styles.actionIcon, styles.actionIconBlue]}>
            <Icon name="award" size={24} color={colors.interestBlue} />
          </View>
          <View style={styles.flexOne}>
            <Text style={styles.actionTitle}>Election & Voting Center</Text>
            <Text style={styles.actionDesc}>
              Configure SUG elections, register candidates & view live tallies.
            </Text>
          </View>
          <Icon name="chevron-right" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('AdminEvents')}>
          <View style={[styles.actionIcon, styles.actionIconBlue]}>
            <Icon name="calendar" size={24} color={colors.interestBlue} />
          </View>
          <View style={styles.flexOne}>
            <Text style={styles.actionTitle}>Campus Event Management</Text>
            <Text style={styles.actionDesc}>
              Create and update events, control capacity, and manage RSVPs.
            </Text>
          </View>
          <Icon name="chevron-right" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('AdminMarketplaceReports')}>
          <View style={[styles.actionIcon, styles.actionIconRed]}>
            <Icon name="shopping-bag" size={24} color={colors.danger} />
          </View>
          <View style={styles.flexOne}>
            <Text style={styles.actionTitle}>Marketplace Safety Reports</Text>
            <Text style={styles.actionDesc}>
              Review reports and remove listings that violate marketplace rules.
            </Text>
          </View>
          <Icon name="chevron-right" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('AdminBroadcastAlert')}>
          <View style={[styles.actionIcon, styles.actionIconYellow]}>
            <Icon name="send" size={24} color="#D97706" />
          </View>
          <View style={styles.flexOne}>
            <Text style={styles.actionTitle}>Broadcast Campus Alerts</Text>
            <Text style={styles.actionDesc}>
              Send emergency push notices to student mobile devices.
            </Text>
          </View>
          <Icon name="chevron-right" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('AdminMyPosts')}>
          <View style={[styles.actionIcon, styles.actionIconPurple]}>
            <Icon name="file-text" size={24} color="#7C3AED" />
          </View>
          <View style={styles.flexOne}>
            <Text style={styles.actionTitle}>My Posts</Text>
            <Text style={styles.actionDesc}>
              View all posts and announcements you have published.
            </Text>
          </View>
          <Icon name="chevron-right" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('AdminFeedback')}>
          <View style={[styles.actionIcon, styles.actionIconPurple]}>
            <Icon name="message-square" size={24} color="#7C3AED" />
          </View>
          <View style={styles.flexOne}>
            <Text style={styles.actionTitle}>Feedback Management</Text>
            <Text style={styles.actionDesc}>
              Review and manage user feedback submissions.
            </Text>
          </View>
          <Icon name="chevron-right" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Audit Stream Preview */}
        <Text style={styles.sectionTitle}>Recent Audit Activity</Text>
        <View style={styles.auditBox}>
          {auditLogs.length === 0 ? (
            <Text style={styles.emptyAudit}>No audit activity yet.</Text>
          ) : (
            auditLogs.slice(0, 5).map(log => (
              <View style={styles.auditRow} key={log.id}>
                <Icon name="check-circle" size={16} color={colors.primary} />
                <Text style={styles.auditText}>
                  {log.adminName || 'Admin'} {log.action}
                </Text>
                <Text style={styles.auditTime}>
                  {new Date(log.createdAt).toLocaleString()}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
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
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    padding: spacing.xs,
  },
  refreshBtn: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.white,
  },
  headerSubtitle: {
    ...typography.small,
    color: 'rgba(255,255,255,0.8)',
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    width: '48%',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'flex-start',
    gap: 6,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
  },
  metricLabel: {
    ...typography.small,
    color: colors.textSecondary,
  },
  actionCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTitle: {
    ...typography.h3,
    fontSize: 16,
    color: colors.textPrimary,
  },
  actionDesc: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
  auditBox: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  auditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  auditText: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
  },
  auditTime: {
    fontSize: 11,
    color: colors.textMuted,
  },
  emptyAudit: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 10,
  },
  flexOne: {flex: 1},
  loadingWrap: {marginVertical: 20},
  iconWrapGreenLight: {backgroundColor: '#ECFDF5'},
  iconWrapYellowLight: {backgroundColor: '#FEF3C7'},
  metricValueYellow: {color: '#D97706'},
  iconWrapRedLight: {backgroundColor: '#FEE2E2'},
  iconWrapBlueLight: {backgroundColor: '#EFF6FF'},
  actionIconGreen: {backgroundColor: '#DCFCE7'},
  actionIconRed: {backgroundColor: '#FEE2E2'},
  actionIconBlue: {backgroundColor: '#EFF6FF'},
  actionIconYellow: {backgroundColor: '#FEF3C7'},
  actionIconPurple: {backgroundColor: '#EDE9FE'},
});
