import React, {useState, useEffect, useCallback} from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Feather';
import {usePrefs, useThemedStyles} from '../../theme/PreferencesContext';
import {
  backend,
  fetchElectionResults,
  fetchBallotReceipts,
} from '../../services/backend';

interface ResultRow {
  id: string;
  candidateId: string;
  name: string;
  photo_url: string | null;
  votes: number;
  percent: number;
}

interface BallotRow {
  id: string;
  receipt_hash: string;
  candidate_name: string;
  position_id: string;
  created_at: string;
}

const LIGHT_COLORS = {
  bg: '#F5F6F8',
  card: '#FFFFFF',
  cardMuted: '#F3F4F6',
  green: '#1F6B4A',
  greenLight: '#E7EFEA',
  gold: '#B8860B',
  goldLight: '#FBF3DE',
  text: '#161B22',
  subtext: '#8A929B',
  border: '#ECEDEF',
  red: '#D14343',
  redLight: '#FBECEC',
} as const;

const DARK_COLORS = {
  bg: '#0B1410',
  card: '#13211A',
  cardMuted: '#1A2B23',
  green: '#4ADE80',
  greenLight: '#14532D',
  gold: '#D9A029',
  goldLight: '#3A2A12',
  text: '#F3F6F4',
  subtext: '#A7B5AD',
  border: '#1F3329',
  red: '#F87171',
  redLight: '#3A1A1A',
} as const;

function formatNumber(n: number): string {
  return n.toLocaleString('en-NG');
}

const getStyles = (C: typeof LIGHT_COLORS | typeof DARK_COLORS) =>
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

    scrollContent: {paddingHorizontal: 16, paddingTop: 24, paddingBottom: 24},
    title: {fontSize: 22, fontWeight: '800', color: C.text, marginTop: 4},
    subtitle: {fontSize: 13, color: C.subtext, marginTop: 6, lineHeight: 19},
    liveBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: C.redLight,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 14,
      alignSelf: 'flex-start',
      marginTop: 12,
    },
    liveDot: {width: 8, height: 8, borderRadius: 4, backgroundColor: C.red},
    liveText: {fontSize: 12, fontWeight: '800', color: C.red},
    winnerCard: {
      backgroundColor: C.card,
      borderRadius: 20,
      padding: 18,
      alignItems: 'center',
      marginTop: 22,
      borderWidth: 1.5,
      borderColor: C.border,
    },
    winnerPhoto: {width: 76, height: 76, borderRadius: 38},
    winnerCrown: {
      position: 'absolute',
      top: -10,
      alignSelf: 'center',
      backgroundColor: C.gold,
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    winnerCrownIcon: {color: '#FFFFFF'},
    winnerName: {fontSize: 18, fontWeight: '800', color: C.text, marginTop: 8},
    winnerMeta: {fontSize: 12, color: C.subtext, marginTop: 4},
    winnerPercent: {
      fontSize: 26,
      fontWeight: '900',
      color: C.green,
      marginTop: 8,
    },
    winnerVotes: {fontSize: 12, color: C.subtext, marginTop: 2},
    divider: {
      height: 1,
      backgroundColor: C.border,
      marginVertical: 14,
      width: '100%',
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '100%',
      marginTop: 6,
    },
    totalLabel: {fontSize: 13, color: C.subtext, fontWeight: '600'},
    totalValue: {fontSize: 13, color: C.text, fontWeight: '700'},

    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 24,
      marginBottom: 10,
    },
    sectionHeaderText: {
      fontSize: 15,
      fontWeight: '800',
      color: C.text,
      letterSpacing: 0.5,
    },

    resultCard: {
      backgroundColor: C.card,
      borderRadius: 14,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: C.border,
    },
    resultRow: {flexDirection: 'row', alignItems: 'center', gap: 12},
    photo: {width: 44, height: 44, borderRadius: 22},
    rankBadge: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rankText: {fontSize: 10, fontWeight: '800', color: C.subtext},
    resultInfo: {flex: 1},
    resultName: {fontSize: 14, fontWeight: '700', color: C.text},
    resultMeta: {fontSize: 12, color: C.subtext, marginTop: 2},
    resultPercentBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
      backgroundColor: C.greenLight,
    },
    resultPercentText: {fontSize: 12, fontWeight: '800', color: C.green},
    resultVotesText: {
      fontSize: 12,
      color: C.subtext,
      marginTop: 10,
      textAlign: 'right',
    },
    progressTrack: {
      height: 6,
      backgroundColor: C.border,
      borderRadius: 3,
      overflow: 'hidden',
      marginTop: 10,
    },
    progressFill: {height: '100%', backgroundColor: C.green, borderRadius: 3},

    ballotSectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 24,
      marginBottom: 10,
    },
    ballotSectionText: {
      fontSize: 15,
      fontWeight: '800',
      color: C.text,
      letterSpacing: 0.5,
    },
    ballotCard: {
      backgroundColor: C.card,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: C.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    ballotReceipt: {
      flex: 1,
    },
    ballotReceiptText: {
      fontSize: 13,
      fontWeight: '800',
      color: C.text,
      letterSpacing: 0.5,
    },
    ballotMetaText: {
      fontSize: 11,
      color: C.subtext,
      marginTop: 2,
    },
    shareButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: C.green,
      borderRadius: 12,
      paddingVertical: 14,
      marginTop: 16,
    },
    shareButtonText: {color: '#FFFFFF', fontSize: 15, fontWeight: '700'},
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: C.card,
      borderWidth: 1.5,
      borderColor: C.green,
      borderRadius: 12,
      paddingVertical: 14,
      marginTop: 12,
    },
    backButtonText: {color: C.green, fontSize: 15, fontWeight: '700'},

    footerText: {
      textAlign: 'center',
      fontSize: 11,
      color: C.subtext,
      marginTop: 16,
    },
  });

export default function LiveResultsScreen({navigation, route}: any) {
  const [results, setResults] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [ballots, setBallots] = useState<BallotRow[]>([]);
  const isAdmin = route?.params?.isAdmin === true;
  const C = usePrefs().isDark ? DARK_COLORS : LIGHT_COLORS;
  const styles = useThemedStyles(() => getStyles(C), []);

  const electionId = route?.params?.electionId;

  const loadBallots = useCallback(async () => {
    if (!electionId) {
      return;
    }
    const receipts = await fetchBallotReceipts(electionId);
    setBallots(receipts);
  }, [electionId]);

  useEffect(() => {
    let active = true;

    (async () => {
      setLoading(true);
      const electionResults = await fetchElectionResults(electionId || '');

      if (active) {
        const totalV = electionResults.reduce((sum, r) => sum + r.votes, 0);
        const sorted = electionResults
          .sort((a, b) => b.votes - a.votes)
          .map((r, _index) => ({
            id: r.candidateId,
            candidateId: r.candidateId,
            name: r.name,
            photo_url: r.photo_url,
            votes: r.votes,
            percent: totalV > 0 ? Math.round((r.votes / totalV) * 100) : 0,
          }));

        setResults(sorted);
        setLoading(false);
      }
      await loadBallots();
    })();

    return () => {
      active = false;
    };
  }, [electionId, loadBallots]);

  const refreshResults = useCallback(async () => {
    const electionResults = await fetchElectionResults(electionId || '');
    const totalV = electionResults.reduce((sum, r) => sum + r.votes, 0);
    const sorted = electionResults
      .sort((a, b) => b.votes - a.votes)
      .map((r, _index) => ({
        id: r.candidateId,
        candidateId: r.candidateId,
        name: r.name,
        photo_url: r.photo_url,
        votes: r.votes,
        percent: totalV > 0 ? Math.round((r.votes / totalV) * 100) : 0,
      }));

    setResults(sorted);
    await loadBallots();
  }, [electionId, loadBallots]);

  useEffect(() => {
    if (!electionId) {
      return;
    }

    const channel = backend
      .channel('live-results')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'election_candidates',
        },
        async () => {
          await refreshResults();
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'election_votes',
        },
        async () => {
          await refreshResults();
        },
      )
      .subscribe();

    return () => {
      backend.removeChannel(channel);
    };
  }, [electionId, refreshResults]);

  useFocusEffect(
    useCallback(() => {
      if (electionId) {
        refreshResults();
      }
    }, [electionId, refreshResults]),
  );

  const totalVotes = results.reduce((sum, r) => sum + r.votes, 0);
  const winner = results[0];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack?.()}>
          <Icon name="arrow-left" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Live Results</Text>
        <TouchableOpacity>
          <Icon name="bar-chart-2" size={20} color={C.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.flexOne}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Student Union President</Text>
        <Text style={styles.subtitle}>
          Real-time vote counts for the 2024 SUG General Elections.
        </Text>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>

        {loading ? (
          <View style={styles.winnerCard}>
            <Text style={styles.winnerName}>Loading results...</Text>
          </View>
        ) : winner ? (
          <View style={styles.winnerCard}>
            <View style={styles.winnerCrown}>
              <Icon name="award" size={20} color="#FFFFFF" />
            </View>
            {winner.photo_url ? (
              <Image
                source={{uri: winner.photo_url}}
                style={styles.winnerPhoto}
              />
            ) : (
              <View style={styles.winnerPhoto} />
            )}
            <Text style={styles.winnerName}>{winner.name}</Text>
            <Text style={styles.winnerMeta}>Leading Candidate</Text>
            <Text style={styles.winnerPercent}>{winner.percent}%</Text>
            <Text style={styles.winnerVotes}>
              {formatNumber(winner.votes)} votes
            </Text>
            <View style={styles.divider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Votes</Text>
              <Text style={styles.totalValue}>{formatNumber(totalVotes)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Reporting</Text>
              <Text style={styles.totalValue}>72 out of 78 units</Text>
            </View>
          </View>
        ) : (
          <View style={styles.winnerCard}>
            <Text style={styles.winnerName}>No results yet.</Text>
          </View>
        )}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderText}>FULL RESULTS</Text>
        </View>

        {results.map((result, index) => (
          <View key={result.id} style={styles.resultCard}>
            <View style={styles.resultRow}>
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>{index + 1}</Text>
              </View>
              {result.photo_url ? (
                <Image source={{uri: result.photo_url}} style={styles.photo} />
              ) : (
                <View style={styles.photo} />
              )}
              <View style={styles.resultInfo}>
                <Text style={styles.resultName}>{result.name}</Text>
                <Text style={styles.resultMeta}>
                  {formatNumber(result.votes)} votes
                </Text>
              </View>
              <View style={styles.resultPercentBadge}>
                <Text style={styles.resultPercentText}>{result.percent}%</Text>
              </View>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${result.percent}%`,
                    backgroundColor: index === 0 ? C.green : C.subtext,
                  },
                ]}
              />
            </View>
          </View>
        ))}

        {isAdmin ? (
          <>
            <View style={styles.ballotSectionHeader}>
              <Text style={styles.ballotSectionText}>BALLOT RECEIPTS</Text>
              <Text style={styles.ballotMetaText}>{ballots.length} total</Text>
            </View>

            {ballots.length === 0 ? (
              <Text style={styles.ballotMetaText}>No ballots cast yet.</Text>
            ) : (
              ballots.slice(0, 50).map(ballot => (
                <View key={ballot.id} style={styles.ballotCard}>
                  <View style={styles.ballotReceipt}>
                    <Text style={styles.ballotReceiptText}>
                      {ballot.receipt_hash}
                    </Text>
                    <Text style={styles.ballotMetaText}>
                      {ballot.candidate_name} • {ballot.position_id}
                    </Text>
                  </View>
                  <Icon name="check-circle" size={16} color={C.green} />
                </View>
              ))
            )}
          </>
        ) : null}

        <TouchableOpacity style={styles.shareButton} activeOpacity={0.7}>
          <Icon name="share" size={16} color="#FFFFFF" />
          <Text style={styles.shareButtonText}>Share Results</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.7}
          onPress={() => navigation?.navigate('ElectionHub')}>
          <Icon name="arrow-left" size={16} color={C.green} />
          <Text style={styles.backButtonText}>Back to Election Center</Text>
        </TouchableOpacity>

        <Text style={styles.footerText}>Results update in real time</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
