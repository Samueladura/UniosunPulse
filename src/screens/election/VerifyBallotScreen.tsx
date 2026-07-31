import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {usePrefs, useThemedStyles} from '../../theme/PreferencesContext';
import {castVote} from '../../services/supabase';

const LIGHT_COLORS = {
  bg: '#F5F6F8',
  card: '#FFFFFF',
  cardMuted: '#F3F4F6',
  green: '#1F6B4A',
  greenLight: '#E7EFEA',
  red: '#D14343',
  redLight: '#FBECEC',
  text: '#161B22',
  subtext: '#8A929B',
  border: '#ECEDEF',
} as const;

const DARK_COLORS = {
  bg: '#0B1410',
  card: '#13211A',
  cardMuted: '#1A2B23',
  green: '#4ADE80',
  greenLight: '#14532D',
  red: '#F87171',
  redLight: '#3A1A1A',
  text: '#F3F6F4',
  subtext: '#A7B5AD',
  border: '#1F3329',
} as const;

interface VerifyBallotScreenProps {
  navigation?: any;
  route?: {params?: {candidate?: any; electionId?: string}};
}

const DEFAULT_CANDIDATE = {
  id: '2',
  name: 'Adebayo Oluwaseun',
  photo_url: 'https://i.pravatar.cc/200?img=45',
  faculty: 'Engineering',
  level: '400 Level',
};

const getMainStyles = (C: typeof LIGHT_COLORS | typeof DARK_COLORS) =>
  StyleSheet.create({
    safe: {flex: 1, backgroundColor: C.bg},
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: C.card,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
      gap: 10,
    },
    headerLogo: {width: 28, height: 28, borderRadius: 14},
    headerTitle: {fontSize: 17, fontWeight: '800', color: C.green, flex: 1},

    flexOne: {flex: 1},
    textBold800: {fontWeight: '800'},

    scrollContent: {paddingHorizontal: 16, paddingTop: 24, paddingBottom: 24},
    card: {
      backgroundColor: C.card,
      borderRadius: 20,
      padding: 24,
      alignItems: 'center',
    },
    iconCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: C.green,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: 22,
      fontWeight: '800',
      color: C.text,
      marginTop: 16,
    },
    subtitle: {fontSize: 13.5, color: C.subtext, marginTop: 4},
    selectionBox: {
      width: '100%',
      backgroundColor: C.cardMuted,
      borderRadius: 14,
      padding: 16,
      marginTop: 22,
    },
    selectionTopRow: {flexDirection: 'row', gap: 12},
    selectionAvatar: {width: 56, height: 56, borderRadius: 12},
    currentSelectionBadge: {
      alignSelf: 'flex-start',
      backgroundColor: C.green,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    currentSelectionText: {fontSize: 9.5, fontWeight: '800', color: '#FFFFFF'},
    candidateName: {
      fontSize: 17,
      fontWeight: '800',
      color: C.green,
      marginTop: 6,
    },
    candidateRole: {
      fontSize: 10.5,
      fontWeight: '700',
      color: C.subtext,
      marginTop: 2,
      letterSpacing: 0.5,
    },
    divider: {height: 1, backgroundColor: C.border, marginVertical: 14},
    detailRow: {flexDirection: 'row', justifyContent: 'space-between'},
    detailLabel: {
      fontSize: 10.5,
      fontWeight: '700',
      color: C.subtext,
      letterSpacing: 0.5,
    },
    detailValue: {
      fontSize: 14.5,
      fontWeight: '700',
      color: C.text,
      marginTop: 4,
    },

    noticeBox: {
      flexDirection: 'row',
      gap: 10,
      backgroundColor: C.redLight,
      borderRadius: 12,
      padding: 14,
      marginTop: 20,
      width: '100%',
    },
    noticeText: {flex: 1, fontSize: 12.5, color: C.text, lineHeight: 18},

    confirmButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: C.green,
      borderRadius: 12,
      paddingVertical: 15,
      width: '100%',
      marginTop: 20,
    },
    confirmButtonText: {color: '#FFFFFF', fontSize: 15, fontWeight: '700'},

    cancelButton: {marginTop: 14, paddingVertical: 6},
    cancelButtonText: {fontSize: 14, fontWeight: '700', color: C.subtext},

    encryptedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 16,
    },
    encryptedText: {
      fontSize: 10.5,
      fontWeight: '700',
      color: C.subtext,
      letterSpacing: 0.5,
    },
  });

export default function VerifyBallotScreen({
  navigation,
  route,
}: VerifyBallotScreenProps) {
  const candidate = (route?.params?.candidate ??
    DEFAULT_CANDIDATE) as typeof DEFAULT_CANDIDATE;
  const electionId = route?.params?.electionId;
  const C = usePrefs().isDark ? DARK_COLORS : LIGHT_COLORS;
  const styles = useThemedStyles(() => getMainStyles(C), []);

  const handleConfirm = async () => {
    try {
      const {receiptId, isDuplicate} = await castVote(
        electionId || '',
        candidate.position || '',
        candidate.id,
      );
      navigation?.navigate('VoteSuccess', {receiptId, isDuplicate, electionId});
    } catch (err: any) {
      Alert.alert(
        'Vote Failed',
        err?.message || 'Something went wrong while casting your vote. Please try again.',
      );
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Image
          source={require('../../assets/uniosun-logo.png')}
          style={styles.headerLogo}
        />
        <Text style={styles.headerTitle}>UniOsun Pulse</Text>
        <TouchableOpacity>
          <Icon name="settings" size={20} color={C.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.flexOne}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Icon name="upload" size={28} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>Verify Your Ballot</Text>
          <Text style={styles.subtitle}>
            Please review your selection carefully.
          </Text>

          <View style={styles.selectionBox}>
            <View style={styles.selectionTopRow}>
              <Image
                source={{
                  uri: candidate.photo_url || 'https://i.pravatar.cc/200?img=1',
                }}
                style={styles.selectionAvatar}
              />
              <View style={styles.flexOne}>
                <View style={styles.currentSelectionBadge}>
                  <Text style={styles.currentSelectionText}>
                    CURRENT SELECTION
                  </Text>
                </View>
                <Text style={styles.candidateName}>{candidate.name}</Text>
                <Text style={styles.candidateRole}>PRESIDENTIAL CANDIDATE</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <View>
                <Text style={styles.detailLabel}>FACULTY</Text>
                <Text style={styles.detailValue}>{candidate.faculty}</Text>
              </View>
              <View>
                <Text style={styles.detailLabel}>LEVEL</Text>
                <Text style={styles.detailValue}>{candidate.level}</Text>
              </View>
            </View>
          </View>

          <View style={styles.noticeBox}>
            <Icon name="alert-circle" size={16} color={C.red} />
            <Text style={styles.noticeText}>
              <Text style={styles.textBold800}>Important Notice:</Text> Your
              vote is anonymous and final. This action cannot be undone once
              submitted.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handleConfirm}>
            <Icon name="lock" size={16} color="#FFFFFF" />
            <Text style={styles.confirmButtonText}>Confirm & Submit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation?.goBack?.()}>
            <Text style={styles.cancelButtonText}>Cancel Selection</Text>
          </TouchableOpacity>

          <View style={styles.encryptedRow}>
            <Icon name="shield" size={12} color={C.subtext} />
            <Text style={styles.encryptedText}>
              END-TO-END ENCRYPTED SELECTION
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
