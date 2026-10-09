import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {colors, spacing, radius, typography} from '../../theme/colors';
import {adminService, VerificationRequest} from '../../services/adminService';
import {backend} from '../../services/backend';

export default function AdminUserVerificationScreen({navigation}: any) {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadVerifications();
    const channel = backend
      .channel('admin:student_verifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'student_verifications',
        },
        () => {
          loadVerifications();
        },
      )
      .subscribe();
    return () => {
      backend.removeChannel(channel);
    };
  }, []);

  const loadVerifications = async () => {
    setLoading(true);
    const data = await adminService.getVerifications();
    setRequests(data);
    setLoading(false);
  };

  const handleApprove = async (item: VerificationRequest) => {
    Alert.alert(
      'Approve Verification',
      `Are you sure you want to verify student status for ${item.fullName} (${item.matricNumber})?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Approve & Verify',
          onPress: async () => {
            await adminService.updateVerificationStatus(item.id, 'approved');
            setRequests(prev =>
              prev.map(r =>
                r.id === item.id ? {...r, status: 'approved'} : r,
              ),
            );
            Alert.alert('Verified', `${item.fullName} is now verified!`);
          },
        },
      ],
    );
  };

  const handleReject = async (item: VerificationRequest) => {
    Alert.alert(
      'Reject Verification',
      `Reject verification for ${item.fullName}?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            await adminService.updateVerificationStatus(
              item.id,
              'rejected',
              'Invalid matric number credentials',
            );
            setRequests(prev =>
              prev.map(r =>
                r.id === item.id ? {...r, status: 'rejected'} : r,
              ),
            );
          },
        },
      ],
    );
  };

  const filteredRequests = requests.filter(r => {
    const matchesSearch =
      r.fullName.toLowerCase().includes(search.toLowerCase()) ||
      r.matricNumber.toLowerCase().includes(search.toLowerCase());

    return matchesSearch;
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Student Verification Queue</Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Icon name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, matric no, or dept..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={colors.primary}
          style={styles.loadingWrap}
        />
      ) : (
        <FlatList
          data={filteredRequests}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({item}) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.flexOne}>
                  <Text style={styles.studentName}>{item.fullName}</Text>
                  <Text style={styles.matricText}>{item.matricNumber}</Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    item.status === 'approved'
                      ? styles.badgeApproved
                      : item.status === 'rejected'
                      ? styles.badgeRejected
                      : styles.badgePending,
                  ]}>
                  <Text
                    style={[
                      styles.statusText,
                      item.status === 'approved'
                        ? styles.textApproved
                        : item.status === 'rejected'
                        ? styles.textRejected
                        : styles.textPending,
                    ]}>
                    {item.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              {item.idCardUrl && (
                <View style={styles.idPreviewWrap}>
                  <Image
                    source={{uri: item.idCardUrl}}
                    style={styles.idCardImage}
                  />
                  <Text style={styles.idLabel}>
                    Submitted Student ID Preview
                  </Text>
                </View>
              )}

              {item.status === 'pending' && (
                <View style={styles.btnRow}>
                  <TouchableOpacity
                    style={styles.rejectBtn}
                    onPress={() => handleReject(item)}>
                    <Icon name="x" size={16} color={colors.danger} />
                    <Text style={styles.rejectText}>Reject</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.approveBtn}
                    onPress={() => handleApprove(item)}>
                    <Icon name="check" size={16} color={colors.white} />
                    <Text style={styles.approveText}>Approve & Verify</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              No verification requests found matching criteria.
            </Text>
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
    fontSize: 20,
  },
  searchContainer: {
    padding: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    gap: 8,
    height: 44,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
  },
  campusPills: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activePill: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  activePillText: {
    color: colors.white,
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  loadingWrap: {marginVertical: 40},
  flexOne: {flex: 1},

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  studentName: {
    ...typography.h3,
    fontSize: 17,
    color: colors.textPrimary,
  },
  matricText: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '700',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  badgePending: {backgroundColor: '#FEF3C7'},
  badgeApproved: {backgroundColor: '#DCFCE7'},
  badgeRejected: {backgroundColor: '#FEE2E2'},
  statusText: {fontSize: 10, fontWeight: '800'},
  textPending: {color: '#D97706'},
  textApproved: {color: colors.primary},
  textRejected: {color: colors.danger},
  detailsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  detailTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailVal: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  idPreviewWrap: {
    borderRadius: radius.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  idCardImage: {
    width: '100%',
    height: 120,
    resizeMode: 'cover',
  },
  idLabel: {
    fontSize: 11,
    color: colors.textMuted,
    padding: 6,
    textAlign: 'center',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  rejectBtn: {
    flex: 1,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.danger,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  rejectText: {
    color: colors.danger,
    fontWeight: '700',
    fontSize: 13,
  },
  approveBtn: {
    flex: 2,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  approveText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textMuted,
    marginVertical: 30,
  },
});
