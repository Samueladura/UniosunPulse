import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {colors, spacing, radius, typography} from '../../theme/colors';
import {
  adminService,
  AdminElection,
  ElectionCandidate,
} from '../../services/adminService';
import {backend} from '../../services/backend';

type ElectionStatus = 'active' | 'ended' | 'draft';

interface NavigationLike {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
  goBack: () => void;
  addListener: (event: 'focus', callback: () => void) => () => void;
}

const isElectionEnded = (election: AdminElection): boolean => {
  if (!election.endTime) {
    return false;
  }
  return new Date(election.endTime) < new Date();
};

const formatDateTime = (
  iso: string | null | undefined,
): {date: string; time: string} | null => {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  const day = date.getDate().toString().padStart(2, '0');
  const month = date.toLocaleString('en-US', {month: 'short'});
  const year = date.getFullYear();
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return {
    date: `${day} ${month} ${year}`,
    time: `${displayHours}:${minutes} ${period}`,
  };
};

export default function AdminElectionManagerScreen({
  navigation,
}: {
  navigation: NavigationLike;
}) {
  const [loading, setLoading] = useState(true);
  const [elections, setElections] = useState<AdminElection[]>([]);
  const [showCandidatesModal, setShowCandidatesModal] = useState(false);
  const [selectedElection, setSelectedElection] =
    useState<AdminElection | null>(null);
  const [candidates, setCandidates] = useState<ElectionCandidate[]>([]);
  const [_loadingCandidates, setLoadingCandidates] = useState(false);
  const [_deleting, setDeleting] = useState(false);

  // Candidate Form
  const [candidateName, setCandidateName] = useState('');
  const [candidatePosition, setCandidatePosition] = useState('');
  const [candidateManifesto, setCandidateManifesto] = useState('');
  const [candidateAvatar, setCandidateAvatar] = useState('');
  const [addingCandidate, setAddingCandidate] = useState(false);

  // Lets realtime callbacks read the current selection without resubscribing.
  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedIdRef.current = selectedElection?.id ?? null;
  }, [selectedElection]);

  const loadElections = useCallback(async (showSpinner = false) => {
    if (showSpinner) {
      setLoading(true);
    }
    try {
      // Sync election statuses based on time before loading
      await adminService.syncElectionStatuses();
      const data = await adminService.getAdminElections();
      setElections(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCandidates = useCallback(async (electionId: string) => {
    setLoadingCandidates(true);
    try {
      const data = await adminService.getCandidates(electionId);
      setCandidates(data);
    } finally {
      setLoadingCandidates(false);
    }
  }, []);

  // Initial load + realtime subscriptions
  useEffect(() => {
    loadElections(true);

    const refreshSelectedCandidates = () => {
      if (selectedIdRef.current) {
        loadCandidates(selectedIdRef.current);
      }
    };

    const channel = backend
      .channel('admin:elections')
      .on(
        'postgres_changes',
        {event: '*', schema: 'public', table: 'elections'},
        () => {
          loadElections();
        },
      )
      .on(
        'postgres_changes',
        {event: 'INSERT', schema: 'public', table: 'election_votes'},
        () => {
          loadElections();
          refreshSelectedCandidates();
        },
      )
      .on(
        'postgres_changes',
        {event: '*', schema: 'public', table: 'election_candidates'},
        refreshSelectedCandidates,
      )
      .subscribe();

    return () => {
      backend.removeChannel(channel);
    };
  }, [loadElections, loadCandidates]);

  // Reload on screen focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadElections();
    });
    return unsubscribe;
  }, [navigation, loadElections]);

  // Poll every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      loadElections();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadElections]);

  // Auto-close elections whose end time has passed
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      elections.forEach(e => {
        if (e.status === 'active' && e.endTime && now > new Date(e.endTime).getTime()) {
          adminService.updateElectionStatus(e.id, 'ended').catch(() => {});
          setElections(prev =>
            prev.map(x =>
              x.id === e.id ? {...x, status: 'ended' as const} : x,
            ),
          );
        }
      });
    }, 30000);
    return () => clearInterval(interval);
  }, [elections]);

  const openCandidates = async (election: AdminElection) => {
    setSelectedElection(election);
    setShowCandidatesModal(true);
    await loadCandidates(election.id);
  };

  const handleToggleStatus = async (
    election: AdminElection,
    newStatus: ElectionStatus,
  ) => {
    if (
      newStatus === 'active' &&
      election.maxCandidates &&
      election.maxCandidates > 0
    ) {
      if (election.candidatesCount > election.maxCandidates) {
        Alert.alert(
          'Cannot Launch',
          `Candidate limit exceeded. Max allowed: ${election.maxCandidates}, current: ${election.candidatesCount}.`,
        );
        return;
      }
    }

    try {
      await adminService.updateElectionStatus(election.id, newStatus);
      setElections(prev =>
        prev.map(e => (e.id === election.id ? {...e, status: newStatus} : e)),
      );
      Alert.alert(
        'Status Updated',
        `Election status changed to ${newStatus.toUpperCase()}`,
      );
    } catch (error) {
      Alert.alert(
        'Could Not Update Status',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  };

  const handleAddCandidate = async () => {
    if (!candidateName.trim() || !candidatePosition.trim()) {
      Alert.alert(
        'Required Fields',
        'Please enter candidate name and position.',
      );
      return;
    }
    if (!selectedElection) {
      return;
    }

    setAddingCandidate(true);
    try {
      await adminService.addCandidate(
        selectedElection.id,
        candidateName.trim(),
        candidatePosition.trim(),
        candidateManifesto.trim() || undefined,
        candidateAvatar.trim() || undefined,
      );
      setCandidateName('');
      setCandidatePosition('');
      setCandidateManifesto('');
      setCandidateAvatar('');
      await loadCandidates(selectedElection.id);
      Alert.alert(
        'Candidate Added',
        'Candidate has been added to this election.',
      );
    } catch (error) {
      Alert.alert(
        'Could Not Add Candidate',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setAddingCandidate(false);
    }
  };

  const handleDeleteCandidate = (candidate: ElectionCandidate) => {
    const electionId = selectedElection?.id;
    Alert.alert(
      'Remove Candidate',
      `Remove ${candidate.name} from this election?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await adminService.deleteCandidate(candidate.id);
              if (electionId) {
                await loadCandidates(electionId);
              }
            } catch (error) {
              Alert.alert(
                'Could Not Remove Candidate',
                error instanceof Error ? error.message : 'Please try again.',
              );
            }
          },
        },
      ],
    );
  };

  const handleDeleteElection = (election: AdminElection) => {
    Alert.alert(
      'Delete Election',
      `Permanently delete "${election.title}" and all its candidates?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await adminService.deleteElection(election.id);
              setElections(prev => prev.filter(e => e.id !== election.id));
              Alert.alert('Deleted', 'Election has been removed.');
            } catch (error) {
              Alert.alert(
                'Could Not Delete Election',
                error instanceof Error ? error.message : 'Please try again.',
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  const openLiveResults = (election: AdminElection) => {
    navigation.navigate('AdminLiveResults', {
      electionId: election.id,
      isAdmin: true,
    });
  };

  const renderElection = ({item}: {item: AdminElection}) => {
    const start = formatDateTime(item.startTime);
    const end = formatDateTime(item.endTime);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.catBadge}>
            <Text style={styles.catBadgeText}>{item.category}</Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              item.status === 'active'
                ? styles.badgeActive
                : item.status === 'ended'
                ? styles.badgeEnded
                : styles.badgeDraft,
            ]}>
            <Text
              style={[
                styles.statusText,
                item.status === 'active'
                  ? styles.textActive
                  : item.status === 'ended'
                  ? styles.textEnded
                  : styles.textDraft,
              ]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>

        <Text style={styles.electionTitle}>{item.title}</Text>
        {item.description ? (
          <Text style={styles.electionDesc}>{item.description}</Text>
        ) : null}

        {item.startTime || item.endTime ? (
          <View style={styles.timeRow}>
            <Icon name="clock" size={14} color={colors.textSecondary} />
            <View style={styles.timeTextWrap}>
              <Text style={styles.timeText}>
                {start?.date || 'TBD'}
                {' · '}
                {start?.time || ''}
              </Text>
              <Text style={styles.timeText}>{' → '}</Text>
              <Text style={styles.timeText}>
                {end?.date || 'TBD'}
                {' · '}
                {end?.time || ''}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Icon name="check-square" size={14} color={colors.primary} />
            <Text style={styles.statVal}>
              {item.totalVotes.toLocaleString()} Votes Cast
            </Text>
          </View>

          <View style={styles.statItem}>
            <Icon name="users" size={14} color={colors.textSecondary} />
            <Text style={styles.statVal}>{item.candidatesCount} Candidates</Text>
          </View>
        </View>

        {/* Status Action Buttons */}
        <View style={styles.btnRow}>
          {isElectionEnded(item) ? (
            <TouchableOpacity style={styles.endBtn} disabled>
              <Icon name="stop-circle" size={14} color={colors.white} />
              <Text style={styles.endText}>Vote Closed</Text>
            </TouchableOpacity>
          ) : item.status !== 'active' ? (
            <TouchableOpacity
              style={styles.activateBtn}
              onPress={() => handleToggleStatus(item, 'active')}>
              <Icon name="play" size={14} color={colors.white} />
              <Text style={styles.activateText}>Launch Election</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.endBtn}
              onPress={() => handleToggleStatus(item, 'ended')}>
              <Icon name="stop-circle" size={14} color={colors.white} />
              <Text style={styles.endText}>Close Voting</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.candidatesBtn}
            onPress={() => openCandidates(item)}>
            <Icon name="user" size={14} color={colors.primary} />
            <Text style={styles.candidatesText}>Candidates</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.resultsBtn}
            onPress={() => openLiveResults(item)}>
            <Icon name="bar-chart-2" size={14} color={colors.white} />
            <Text style={styles.resultsText}>Live Results</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => handleDeleteElection(item)}>
            <Icon name="trash-2" size={14} color={colors.white} />
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderCandidate = ({item}: {item: ElectionCandidate}) => (
    <View style={styles.candidateCard}>
      {item.avatarUrl ? (
        <Image source={{uri: item.avatarUrl}} style={styles.candidateAvatar} />
      ) : (
        <View style={[styles.candidateAvatar, styles.avatarFallback]}>
          <Icon name="user" size={18} color={colors.textMuted} />
        </View>
      )}
      <View style={styles.flexOne}>
        <Text style={styles.candidateName}>{item.name}</Text>
        <Text style={styles.candidateMeta}>{item.position}</Text>
        {item.manifesto ? (
          <Text style={styles.candidateManifesto} numberOfLines={2}>
            {item.manifesto}
          </Text>
        ) : null}
        <Text style={styles.candidateVotes}>{item.voteCount} votes</Text>
      </View>
      <TouchableOpacity
        style={styles.removeCandidateBtn}
        onPress={() => handleDeleteCandidate(item)}>
        <Icon name="trash-2" size={16} color={colors.danger} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Election & Voting Management</Text>
      </View>

      {/* Action Bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => navigation.navigate('AdminCreateElection')}>
          <Icon name="plus" size={18} color={colors.white} />
          <Text style={styles.createBtnText}>Create New Election</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={colors.primary}
          style={styles.loadingWrap}
        />
      ) : (
        <FlatList
          data={elections}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={renderElection}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              No election sessions currently scheduled.
            </Text>
          }
        />
      )}

      {/* Candidates Modal */}
      <Modal visible={showCandidatesModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.modalCardTall]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Candidates: {selectedElection?.title}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowCandidatesModal(false);
                  setSelectedElection(null);
                }}>
                <Icon name="x" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={candidates}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.candidatesList}
              renderItem={renderCandidate}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  No candidates registered yet.
                </Text>
              }
            />

            <View style={styles.addCandidateForm}>
              <Text style={styles.formHeading}>Add Candidate</Text>

              <View style={styles.rowGroup}>
                <View style={[styles.formGroup, styles.formGroupFlex12]}>
                  <Text style={styles.label}>Full Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Candidate full name"
                    placeholderTextColor={colors.textMuted}
                    value={candidateName}
                    onChangeText={setCandidateName}
                  />
                </View>
                <View style={[styles.formGroup, styles.formGroupFlex1]}>
                  <Text style={styles.label}>Position</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. President"
                    placeholderTextColor={colors.textMuted}
                    value={candidatePosition}
                    onChangeText={setCandidatePosition}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Avatar / Photo URL</Text>
                <TextInput
                  style={styles.input}
                  placeholder="https://..."
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  value={candidateAvatar}
                  onChangeText={setCandidateAvatar}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Manifesto (optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Key promises and vision..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={2}
                  value={candidateManifesto}
                  onChangeText={setCandidateManifesto}
                />
              </View>

              <TouchableOpacity
                style={styles.submitModalBtn}
                disabled={addingCandidate}
                onPress={handleAddCandidate}>
                {addingCandidate ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.submitModalText}>Add Candidate</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flexOne: {
    flex: 1,
  },
  loadingWrap: {
    marginTop: 40,
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
  actionBar: {
    padding: spacing.md,
    backgroundColor: colors.card,
    flexDirection: 'row',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  createBtn: {
    flex: 1,
    height: 42,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  createBtnText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13,
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
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  catBadge: {
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  catBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  badgeActive: {backgroundColor: '#DCFCE7'},
  badgeEnded: {backgroundColor: '#FEE2E2'},
  badgeDraft: {backgroundColor: '#FEF3C7'},
  statusText: {fontSize: 10, fontWeight: '800'},
  textActive: {color: colors.primary},
  textEnded: {color: colors.danger},
  textDraft: {color: '#D97706'},
  electionTitle: {
    ...typography.h3,
    fontSize: 17,
    color: colors.textPrimary,
  },
  electionDesc: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  timeTextWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  timeText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statVal: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  activateBtn: {
    height: 36,
    paddingHorizontal: 12,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  activateText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 12,
  },
  endBtn: {
    height: 36,
    paddingHorizontal: 12,
    backgroundColor: colors.danger,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  endText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 12,
  },
  candidatesBtn: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  candidatesText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  resultsBtn: {
    height: 36,
    paddingHorizontal: 12,
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  resultsText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 12,
  },
  deleteBtn: {
    height: 36,
    paddingHorizontal: 12,
    backgroundColor: colors.danger,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  deleteText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 12,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textMuted,
    marginVertical: 30,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: spacing.md,
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalCardTall: {
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    ...typography.h3,
    fontSize: 18,
    color: colors.textPrimary,
    flex: 1,
  },
  formGroup: {
    gap: 6,
  },
  formGroupFlex1: {
    flex: 1,
  },
  formGroupFlex12: {
    flex: 1.2,
  },
  rowGroup: {
    flexDirection: 'row',
    gap: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
  },
  textArea: {
    height: 70,
    textAlignVertical: 'top',
  },
  catSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  catChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  activeCatChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  catChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  activeCatChipText: {
    color: colors.white,
  },
  hintText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: -4,
  },
  submitModalBtn: {
    height: 46,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  submitModalText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 15,
  },
  candidatesList: {
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  candidateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  candidateAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarFallback: {
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  candidateName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  candidateMeta: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  candidateManifesto: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  candidateVotes: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
    marginTop: 2,
  },
  removeCandidateBtn: {
    padding: spacing.xs,
  },
  addCandidateForm: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  formHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
});
