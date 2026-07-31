import React, {useState} from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {usePrefs, useThemedStyles} from '../../theme/PreferencesContext';

const LIGHT_COLORS = {
  bg: '#F5F6F8',
  card: '#FFFFFF',
  cardMuted: '#F3F4F6',
  green: '#1F6B4A',
  gold: '#B8860B',
  goldLight: '#FBF3DE',
  text: '#161B22',
  subtext: '#8A929B',
  border: '#ECEDEF',
} as const;

const DARK_COLORS = {
  bg: '#0B1410',
  card: '#13211A',
  cardMuted: '#1A2B23',
  green: '#4ADE80',
  gold: '#D9A029',
  goldLight: '#3A2A12',
  text: '#F3F6F4',
  subtext: '#A7B5AD',
  border: '#1F3329',
} as const;

interface VoteSuccessScreenProps {
  navigation?: any;
  route?: {params?: {receiptId?: string | null; isDuplicate?: boolean}};
}

const getMainStyles = (C: typeof LIGHT_COLORS | typeof DARK_COLORS) =>
  StyleSheet.create({
    safe: {flex: 1, backgroundColor: C.bg},
    scrollContent: {
      paddingHorizontal: 24,
      paddingTop: 56,
      paddingBottom: 32,
      alignItems: 'center',
    },
    successIconWrap: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: C.green,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: 26,
      fontWeight: '900',
      color: C.green,
      textAlign: 'center',
      marginTop: 20,
    },
    subtitle: {
      fontSize: 14,
      color: C.subtext,
      textAlign: 'center',
      marginTop: 10,
      lineHeight: 21,
    },

    flexOne: {flex: 1},

    receiptCard: {
      width: '100%',
      backgroundColor: C.card,
      borderRadius: 16,
      padding: 18,
      marginTop: 28,
    },
    receiptHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    receiptLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: C.subtext,
      letterSpacing: 0.5,
    },
    receiptValueRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: C.cardMuted,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 14,
      marginTop: 10,
    },
    receiptValue: {
      fontSize: 18,
      fontWeight: '800',
      color: C.green,
      letterSpacing: 1,
    },
    receiptNote: {
      fontSize: 12,
      color: C.subtext,
      fontStyle: 'italic',
      marginTop: 10,
    },

    receiptNoteMarginTop: {marginTop: 8},
    noticeBox: {
      flexDirection: 'row',
      gap: 10,
      width: '100%',
      backgroundColor: C.goldLight,
      borderRadius: 14,
      padding: 16,
      marginTop: 18,
    },
    noticeTitle: {fontSize: 13.5, fontWeight: '800', color: C.gold},
    noticeBody: {
      fontSize: 12.5,
      color: C.text,
      marginTop: 4,
      lineHeight: 18,
    },

    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: C.green,
      borderRadius: 12,
      paddingVertical: 15,
      width: '100%',
      marginTop: 24,
    },
    primaryButtonText: {color: '#FFFFFF', fontSize: 15, fontWeight: '700'},

    secondaryButton: {
      borderWidth: 1.5,
      borderColor: C.green,
      borderRadius: 12,
      paddingVertical: 15,
      width: '100%',
      marginTop: 12,
      alignItems: 'center',
    },
    secondaryButtonText: {color: C.green, fontSize: 15, fontWeight: '700'},
  });

export default function VoteSuccessScreen({
  navigation,
  route,
}: VoteSuccessScreenProps) {
  const receiptId = route?.params?.receiptId;
  const isDuplicate = route?.params?.isDuplicate ?? false;
  const [copied, setCopied] = useState<boolean>(false);
  const C = usePrefs().isDark ? DARK_COLORS : LIGHT_COLORS;
  const styles = useThemedStyles(() => getMainStyles(C), []);

  const handleCopy = () => {
    if (receiptId) {
      Alert.alert('Receipt ID', receiptId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.successIconWrap}>
          <Icon
            name={isDuplicate ? 'alert-circle' : 'check-circle'}
            size={44}
            color="#FFFFFF"
          />
        </View>

        <Text style={styles.title}>
          {isDuplicate ? 'Vote Already Recorded' : 'Vote Successfully Cast'}
        </Text>
        <Text style={styles.subtitle}>
          {isDuplicate
            ? 'This ballot receipt code has already been used. For security and integrity, each ballot receipt may only be used once. Your previous vote remains recorded and this duplicate submission was not counted.'
            : 'Your vote has been recorded successfully. Your ballot receipt ID is your proof of participation — keep it safe for your personal verification records.'}
        </Text>

        {receiptId ? (
          <View style={styles.receiptCard}>
            <View style={styles.receiptHeaderRow}>
              <Text style={styles.receiptLabel}>
                {isDuplicate ? 'ORIGINAL BALLOT RECEIPT' : 'YOUR BALLOT RECEIPT'}
              </Text>
              <Icon name="shield" size={16} color={C.green} />
            </View>
            <View style={styles.receiptValueRow}>
              <Text style={styles.receiptValue}>{receiptId}</Text>
              <TouchableOpacity onPress={handleCopy}>
                <Icon
                  name={copied ? 'check' : 'copy'}
                  size={18}
                  color={copied ? C.green : C.text}
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.receiptNote}>
              {isDuplicate
                ? 'This is the receipt from your original vote. Duplicate submissions are rejected and do not affect the outcome.'
                : 'Save this receipt. You may need it to verify your vote in the future.'}
            </Text>
          </View>
        ) : (
          <View style={[styles.receiptCard, {borderColor: C.red}]}>
            <View style={styles.receiptHeaderRow}>
              <Text style={[styles.receiptLabel, {color: C.red}]}>
                UNABLE TO GENERATE RECEIPT
              </Text>
              <Icon name="shield-off" size={16} color={C.red} />
            </View>
            <Text style={[styles.receiptNote, styles.receiptNoteMarginTop]}>
              We could not generate a ballot receipt for this session. Please contact the electoral committee if you believe this is an error.
            </Text>
          </View>
        )}

        <View style={styles.noticeBox}>
          <Icon name="info" size={16} color={C.gold} />
          <View style={styles.flexOne}>
            <Text style={styles.noticeTitle}>Results Announcement</Text>
            <Text style={styles.noticeBody}>
              Official results will be published live at the Senate Building and
              via the app dashboard at 6:00 PM today.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation?.navigate('LiveResults', {electionId: route?.params?.electionId})}>
          <Text style={styles.primaryButtonText}>View Live Results</Text>
          <Icon name="bar-chart-2" size={16} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation?.navigate('ElectionHub')}>
          <Text style={styles.secondaryButtonText}>
            Back to Election Center
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
