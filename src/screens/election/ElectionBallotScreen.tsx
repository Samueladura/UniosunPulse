import React, {useState, useEffect} from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {usePrefs, useThemedStyles} from '../../theme/PreferencesContext';
import {backend} from '../../services/backend';
import {
  fetchCandidates,
  fetchPositions,
  type Candidate as CandidateBase,
} from '../../services/backend';

const LIGHT_COLORS = {
  bg: '#F5F6F8',
  card: '#FFFFFF',
  green: '#1F6B4A',
  greenLight: '#E7EFEA',
  orange: '#D9622B',
  orangeLight: '#FBEAE0',
  text: '#161B22',
  subtext: '#8A929B',
  border: '#ECEDEF',
  disabled: '#C7CBD1',
} as const;

const DARK_COLORS = {
  bg: '#0B1410',
  card: '#13211A',
  green: '#4ADE80',
  greenLight: '#14532D',
  orange: '#FB923C',
  orangeLight: '#3A2A12',
  text: '#F3F6F4',
  subtext: '#A7B5AD',
  border: '#1F3329',
  disabled: '#374151',
} as const;

interface CandidateCardProps {
  candidate: CandidateBase;
  selected: boolean;
  onSelect: () => void;
}

const getCandidateCardStyles = (C: typeof LIGHT_COLORS | typeof DARK_COLORS) =>
  StyleSheet.create({
    candidateCard: {
      backgroundColor: C.card,
      borderRadius: 16,
      padding: 16,
      marginTop: 16,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    candidateCardSelected: {borderColor: C.green},
    candidatePhoto: {
      width: '100%',
      height: 140,
      borderRadius: 12,
      marginBottom: 12,
    },
    candidateHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    candidateName: {fontSize: 17, fontWeight: '800', color: C.green},
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: C.disabled,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioSelected: {borderColor: C.green},
    radioInner: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: C.green,
    },
    levelBadge: {
      alignSelf: 'flex-start',
      backgroundColor: C.greenLight,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
      marginTop: 8,
    },
    levelBadgeText: {fontSize: 11.5, fontWeight: '700', color: C.green},
    manifestoText: {
      fontSize: 13,
      color: C.subtext,
      fontStyle: 'italic',
      marginTop: 10,
      lineHeight: 19,
    },
    readMoreRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 10,
    },
    readMoreText: {fontSize: 13, fontWeight: '700', color: C.green},
  });

function CandidateCard({candidate, selected, onSelect}: CandidateCardProps) {
  const C = usePrefs().isDark ? DARK_COLORS : LIGHT_COLORS;
  const styles = useThemedStyles(() => getCandidateCardStyles(C), []);
  return (
    <TouchableOpacity
      style={[styles.candidateCard, selected && styles.candidateCardSelected]}
      activeOpacity={0.85}
      onPress={onSelect}>
      {candidate.avatar_url ? (
        <Image
          source={{uri: candidate.avatar_url}}
          style={styles.candidatePhoto}
        />
      ) : (
        <View style={styles.candidatePhoto} />
      )}
      <View style={styles.candidateHeaderRow}>
        <Text style={styles.candidateName}>{candidate.name}</Text>
        <View style={[styles.radio, selected && styles.radioSelected]}>
          {selected && <View style={styles.radioInner} />}
        </View>
      </View>
      <View style={styles.levelBadge}>
        <Text style={styles.levelBadgeText}>
          {candidate.position || ''} • {candidate.department || ''}
        </Text>
      </View>
      <Text style={styles.manifestoText}>"{candidate.manifesto || ''}"</Text>
      <TouchableOpacity style={styles.readMoreRow}>
        <Text style={styles.readMoreText}>Read full manifesto</Text>
        <Icon name="external-link" size={12} color={C.green} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

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
    },
    headerTitle: {fontSize: 17, fontWeight: '800', color: C.green},

    flexOne: {flex: 1},
    textBold800: {fontWeight: '800'},
    loadingWrap: {marginTop: 24, alignItems: 'center'},

    scrollContent: {paddingHorizontal: 16, paddingBottom: 24},
    introWrap: {alignItems: 'center', marginTop: 24},
    introIconCircle: {
      width: 68,
      height: 68,
      borderRadius: 34,
      backgroundColor: C.greenLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    introTitle: {
      fontSize: 21,
      fontWeight: '800',
      color: C.green,
      marginTop: 14,
      textAlign: 'center',
    },
    introSubtitle: {
      fontSize: 13,
      color: C.subtext,
      marginTop: 4,
      textAlign: 'center',
    },
    votingLiveBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 6,
      marginTop: 14,
    },
    votingLiveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: C.orange,
    },
    votingLiveText: {fontSize: 11, fontWeight: '800', color: C.orange},

    infoBanner: {
      flexDirection: 'row',
      gap: 10,
      backgroundColor: C.card,
      borderLeftWidth: 3,
      borderLeftColor: C.green,
      borderRadius: 10,
      padding: 14,
      marginTop: 24,
    },
    infoBannerText: {
      flex: 1,
      fontSize: 13,
      color: C.text,
      lineHeight: 19,
    },

    encryptedRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
      marginTop: 20,
    },
    encryptedText: {
      fontSize: 11,
      fontWeight: '700',
      color: C.subtext,
      letterSpacing: 0.5,
    },

    footer: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 20,
      backgroundColor: C.card,
      borderTopWidth: 1,
      borderTopColor: C.border,
    },
    castVoteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: C.green,
      borderRadius: 12,
      paddingVertical: 14,
    },
    castVoteButtonDisabled: {backgroundColor: C.disabled},
    castVoteText: {color: '#FFFFFF', fontSize: 15, fontWeight: '700'},
    footerNote: {
      fontSize: 11.5,
      color: C.subtext,
      textAlign: 'center',
      marginTop: 10,
    },
  });

export default function ElectionBallotScreen({navigation, route}: any) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<CandidateBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [positionTitle, setPositionTitle] = useState(
    'President, Student Union',
  );
  const electionId = route?.params?.electionId;
  const C = usePrefs().isDark ? DARK_COLORS : LIGHT_COLORS;
  const styles = useThemedStyles(() => getMainStyles(C), []);

  useEffect(() => {
    let active = true;

    (async () => {
      setLoading(true);
      const [positionsData, candidatesData] = await Promise.all([
        fetchPositions(electionId || ''),
        fetchCandidates(electionId || ''),
      ]);

      if (active) {
        if (positionsData.length > 0) {
          setPositionTitle(positionsData[0].title);
        }
        setCandidates(candidatesData);
        setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [electionId]);

  useEffect(() => {
    if (!electionId) {
      return;
    }

    const channel = backend
      .channel('election-ballot')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'election_candidates',
          filter: `election_id=eq.${electionId}`,
        },
        async () => {
          const refreshed = await fetchCandidates(electionId);
          setCandidates(refreshed);
        },
      )
      .subscribe();

    return () => {
      backend.removeChannel(channel);
    };
  }, [electionId]);

  const hasSelection = selectedId !== null;

  const handleCastVote = () => {
    if (!hasSelection) {
      return;
    }
    const candidate = candidates.find(c => c.id === selectedId);
    navigation?.navigate('VerifyBallot', {
      candidate,
      electionId: electionId,
      positionId: candidate?.position_id || '',
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack?.()}>
          <Icon name="arrow-left" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Election Ballot</Text>
        <TouchableOpacity>
          <Icon name="settings" size={20} color={C.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.flexOne}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.introWrap}>
          <View style={styles.introIconCircle}>
            <Icon name="upload" size={26} color="#FFFFFF" />
          </View>
          <Text style={styles.introTitle}>{positionTitle}</Text>
          <Text style={styles.introSubtitle}>
            Academic Session 2023/2024 General Elections
          </Text>
          <View style={styles.votingLiveBadge}>
            <View style={styles.votingLiveDot} />
            <Text style={styles.votingLiveText}>VOTING LIVE</Text>
          </View>
        </View>

        <View style={styles.infoBanner}>
          <Icon name="info" size={16} color={C.green} />
          <Text style={styles.infoBannerText}>
            Please review each candidate's manifesto carefully. You can only
            select <Text style={styles.textBold800}>one</Text> candidate for
            this position. Your vote is anonymous and secure.
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <Text style={{color: C.subtext}}>Loading candidates...</Text>
          </View>
        ) : candidates.length === 0 ? (
          <View style={styles.loadingWrap}>
            <Text style={styles.textBold800}>No candidates available yet.</Text>
          </View>
        ) : (
          candidates.map(candidate => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              selected={selectedId === candidate.id}
              onSelect={() => setSelectedId(candidate.id)}
            />
          ))
        )}

        <View style={styles.encryptedRow}>
          <Icon name="lock" size={12} color={C.subtext} />
          <Text style={styles.encryptedText}>END-TO-END ENCRYPTED</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.castVoteButton,
            !hasSelection && styles.castVoteButtonDisabled,
          ]}
          disabled={!hasSelection}
          onPress={handleCastVote}>
          <Icon name="upload" size={16} color="#FFFFFF" />
          <Text style={styles.castVoteText}>Cast Your Vote</Text>
        </TouchableOpacity>
        <Text style={styles.footerNote}>
          By voting, you agree to the University Election Guidelines.
        </Text>
      </View>
    </SafeAreaView>
  );
}
