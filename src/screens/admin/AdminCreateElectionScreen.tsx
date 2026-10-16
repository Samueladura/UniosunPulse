import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {launchImageLibrary} from 'react-native-image-picker';
import {colors, spacing, radius, typography} from '../../theme/colors';
import {adminService} from '../../services/adminService';
import {uploadPostMedia} from '../../services/media';

type PendingCandidate = {
  name: string;
  position: string;
  avatar: string;
  manifesto: string;
};

type Props = {
  navigation: any;
  route: any;
};

export default function AdminCreateElectionScreen({navigation, route}: Props) {
  const existingElection = route?.params?.election;

  // New Election Form
  const [title, setTitle] = useState(existingElection?.title || '');
  const [category, setCategory] = useState<'SUG' | 'FACULTY' | 'DEPARTMENTAL'>(
    existingElection?.category || 'SUG',
  );
  const [description, setDescription] = useState(
    existingElection?.description || '',
  );

  const [startDate, setStartDate] = useState('');
  const [startTimeOnly, setStartTimeOnly] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTimeOnly, setEndTimeOnly] = useState('');
  const [maxCandidates, setMaxCandidates] = useState(
    existingElection?.maxCandidates?.toString() || '',
  );
  const [imageUrl, setImageUrl] = useState(existingElection?.imageUrl || '');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [creating, setCreating] = useState(false);

  const toISODateTime = (date: string, time: string): string => {
    if (!date) {
      return '';
    }
    const parts = date.split('/');
    if (parts.length !== 3) {
      return '';
    }
    const [dd, mm, yyyy] = parts;
    const cleaned = time.replace(/[^0-9:APMapm]/g, '').trim();
    if (!cleaned) {
      return `${yyyy}-${mm}-${dd}T00:00:00+01:00`;
    }
    const [timePart, period] = cleaned.split(/(?=[APMapm])/i);
    const [hStr, mStr] = timePart.split(':');
    let hours = parseInt(hStr || '0', 10);
    const minutes = parseInt(mStr || '0', 10);
    const upper = (period || '').toUpperCase();
    if (upper === 'PM' && hours < 12) {
      hours += 12;
    }
    if (upper === 'AM' && hours === 12) {
      hours = 0;
    }
    const pad = (n: number) => n.toString().padStart(2, '0');
    // Add +01:00 timezone offset for West Africa Time (WAT)
    return `${yyyy}-${mm}-${dd}T${pad(hours)}:${pad(minutes)}:00+01:00`;
  };

  const parseISODateTime = (iso: string): {date: string; time: string} => {
    if (!iso) {
      return {date: '', time: ''};
    }
    // Remove timezone offset if present
    const cleanIso = iso.replace(/[+-]\d{2}:?\d{2}$/, '').replace(/Z$/, '');
    const [datePart, timePart] = cleanIso.split('T');
    const [y, m, d] = (datePart || '').split('-');
    const [hStr, mStr] = (timePart || '').split(':');
    const hours = parseInt(hStr || '0', 10);
    const minutes = parseInt(mStr || '0', 10);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return {
      date: d && m && y ? `${d}/${m}/${y}` : '',
      time: `${displayHours}:${pad(minutes)} ${period}`,
    };
  };

  React.useEffect(() => {
    if (existingElection) {
      const start = parseISODateTime(existingElection.startTime || '');
      const end = parseISODateTime(existingElection.endTime || '');
      setStartDate(start.date);
      setStartTimeOnly(start.time);
      setEndDate(end.date);
      setEndTimeOnly(end.time);
    }
  }, [existingElection]);

  const combinedStartTime = toISODateTime(startDate, startTimeOnly);
  const combinedEndTime = toISODateTime(endDate, endTimeOnly);

  // Pending candidates for new election
  const [pendingCandidates, setPendingCandidates] = useState<
    PendingCandidate[]
  >([]);
  const [candidateName, setCandidateName] = useState('');
  const [candidatePosition, setCandidatePosition] = useState('');
  const [candidateManifesto, setCandidateManifesto] = useState('');
  const [candidateAvatar, setCandidateAvatar] = useState('');
  const [addingCandidate, setAddingCandidate] = useState(false);

  const addPendingCandidate = async () => {
    if (!candidateName.trim() || !candidatePosition.trim()) {
      Alert.alert(
        'Required Fields',
        'Please enter candidate name and position.',
      );
      return;
    }

    setAddingCandidate(true);
    setPendingCandidates(prev => [
      ...prev,
      {
        name: candidateName.trim(),
        position: candidatePosition.trim(),
        avatar: candidateAvatar.trim(),
        manifesto: candidateManifesto.trim(),
      },
    ]);
    setCandidateName('');
    setCandidatePosition('');
    setCandidateManifesto('');
    setCandidateAvatar('');
    setAddingCandidate(false);
  };

  const removePendingCandidate = (index: number) => {
    setPendingCandidates(prev => prev.filter((_, i) => i !== index));
  };

  const pickElectionImage = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      quality: 0.8,
    });
    if (result.didCancel || !result.assets?.[0]?.uri) {
      return;
    }
    setUploadingImage(true);
    try {
      const uploaded = await uploadPostMedia(result.assets[0], 'elections');
      if (uploaded.image) {
        setImageUrl(uploaded.image);
      }
    } catch {
      Alert.alert('Image upload failed. You can still save without an image.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleCreateElection = async () => {
    if (!title.trim()) {
      Alert.alert('Required Field', 'Please enter an election title.');
      return;
    }

    setCreating(true);
    try {
      const isEdit = !!existingElection;
      const electionId = existingElection?.id;
      const electionPayload = {
        title: title.trim(),
        category,
        description: description.trim(),
        startTime: combinedStartTime || undefined,
        endTime: combinedEndTime || undefined,
        maxCandidates: maxCandidates ? parseInt(maxCandidates, 10) : undefined,
        imageUrl: imageUrl.trim() || undefined,
      };

      if (isEdit && electionId) {
        await adminService.updateElection(electionId, electionPayload);
        Alert.alert(
          'Election Updated',
          'The election details have been saved.',
        );
      } else {
        const newElec = await adminService.createElection(
          electionPayload.title,
          electionPayload.category,
          electionPayload.description,
          electionPayload.startTime,
          electionPayload.endTime,
          electionPayload.maxCandidates,
          electionPayload.imageUrl,
        );

        for (const candidate of pendingCandidates) {
          await adminService.addCandidate(
            newElec.id,
            candidate.name,
            candidate.position,
            candidate.manifesto || undefined,
            candidate.avatar || undefined,
          );
        }
        Alert.alert(
          'Election Created',
          'The election session and candidates have been saved.',
        );
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert(
        'Election Save Failed',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Launch New Election</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Election Title</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 2026 SUG Executive General Election"
              placeholderTextColor={colors.textMuted}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Category</Text>
            <View style={styles.catSelector}>
              {(['SUG', 'FACULTY', 'DEPARTMENTAL'] as const).map(c => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.catChip,
                    category === c && styles.activeCatChip,
                  ]}
                  onPress={() => setCategory(c)}>
                  <Text
                    style={[
                      styles.catChipText,
                      category === c && styles.activeCatChipText,
                    ]}>
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Brief description and voter eligibility criteria..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
              value={description}
              onChangeText={setDescription}
            />
          </View>

          <View style={styles.rowGroup}>
            <View style={[styles.formGroup, styles.formGroupFlex1]}>
              <Text style={styles.label}>Start Date</Text>
              <TextInput
                style={styles.input}
                placeholder="DD/MM/YYYY"
                placeholderTextColor={colors.textMuted}
                value={startDate}
                onChangeText={setStartDate}
              />
            </View>
            <View style={[styles.formGroup, styles.formGroupFlex1]}>
              <Text style={styles.label}>Start Time</Text>
              <TextInput
                style={styles.input}
                placeholder="09:00 AM"
                placeholderTextColor={colors.textMuted}
                value={startTimeOnly}
                onChangeText={setStartTimeOnly}
              />
            </View>
          </View>

          <View style={styles.rowGroup}>
            <View style={[styles.formGroup, styles.formGroupFlex1]}>
              <Text style={styles.label}>End Date</Text>
              <TextInput
                style={styles.input}
                placeholder="DD/MM/YYYY"
                placeholderTextColor={colors.textMuted}
                value={endDate}
                onChangeText={setEndDate}
              />
            </View>
            <View style={[styles.formGroup, styles.formGroupFlex1]}>
              <Text style={styles.label}>End Time</Text>
              <TextInput
                style={styles.input}
                placeholder="05:00 PM"
                placeholderTextColor={colors.textMuted}
                value={endTimeOnly}
                onChangeText={setEndTimeOnly}
              />
            </View>
          </View>

          <Text style={styles.hintText}>
            Enter date as DD/MM/YYYY and time as HH:MM AM/PM.
          </Text>

          <View style={styles.rowGroup}>
            <View style={[styles.formGroup, styles.formGroupFlex1]}>
              <Text style={styles.label}>Max Candidates (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 8"
                placeholderTextColor={colors.textMuted}
                value={maxCandidates}
                onChangeText={setMaxCandidates}
                keyboardType="number-pad"
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <TouchableOpacity
              style={styles.imagePickerWrap}
              onPress={pickElectionImage}
              disabled={uploadingImage}>
              {imageUrl ? (
                <Image
                  source={{uri: imageUrl}}
                  style={styles.imagePreview}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Icon name="image" size={28} color={colors.textMuted} />
                  <Text style={styles.imagePlaceholderText}>
                    {uploadingImage
                      ? 'Uploading...'
                      : 'Tap to add election image'}
                  </Text>
                </View>
              )}
              {imageUrl && (
                <TouchableOpacity
                  style={styles.removeImageBtn}
                  onPress={() => {
                    setImageUrl('');
                  }}>
                  <Icon name="x" size={16} color={colors.danger} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.candidatesSection}>
            <Text style={styles.candidatesSectionTitle}>Candidates</Text>

            {pendingCandidates.map((c, index) => (
              <View key={index} style={styles.pendingCandidateCard}>
                <View style={styles.flexOne}>
                  <Text style={styles.pendingCandidateName}>{c.name}</Text>
                  <Text style={styles.pendingCandidateMeta}>{c.position}</Text>
                  {c.manifesto ? (
                    <Text
                      style={styles.pendingCandidateManifesto}
                      numberOfLines={1}>
                      {c.manifesto}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  style={styles.removeCandidateBtn}
                  onPress={() => removePendingCandidate(index)}>
                  <Icon name="x" size={16} color={colors.danger} />
                </TouchableOpacity>
              </View>
            ))}

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
              style={[styles.submitModalBtn, styles.addCandidateBtn]}
              disabled={addingCandidate}
              onPress={addPendingCandidate}>
              {addingCandidate ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.submitModalText}>Add Candidate</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.submitModalBtn}
            disabled={creating}
            onPress={handleCreateElection}>
            {creating ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.submitModalText}>Save Election Draft</Text>
            )}
          </TouchableOpacity>
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
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  formGroup: {
    gap: 6,
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
  imagePickerWrap: {
    width: '100%',
    height: 200,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: 200,
  },
  imagePlaceholder: {
    gap: 6,
    alignItems: 'center',
  },
  imagePlaceholderText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.danger,
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
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
  actionRow: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  candidatesSection: {
    gap: spacing.sm,
  },
  candidatesSectionTitle: {
    ...typography.h3,
    fontSize: 16,
    color: colors.textPrimary,
  },
  pendingCandidateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pendingCandidateName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  pendingCandidateMeta: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  pendingCandidateManifesto: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  addCandidateBtn: {
    marginTop: spacing.xs,
  },
  removeCandidateBtn: {
    padding: spacing.xs,
  },
  formGroupFlex1: {flex: 1},
  formGroupFlex12: {flex: 1.2},
  flexOne: {flex: 1},
});
