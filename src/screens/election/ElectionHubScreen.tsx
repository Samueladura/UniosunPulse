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
  fetchElections,
  getTotalVotes,
  fetchElectionResults,
  type Election,
} from '../../services/backend';

const LIGHT_COLORS = {
  bg: '#F5F6F8',
  card: '#FFFFFF',
  green: '#1F6B4A',
  greenDark: '#164A34',
  gold: '#D9A029',
  red: '#D14343',
  redLight: '#FBE9E9',
  text: '#161B22',
  subtext: '#8A929B',
  border: '#ECEDEF',
  chip: '#EEF0F2',
} as const;

const DARK_COLORS = {
  bg: '#0B1410',
  card: '#13211A',
  green: '#4ADE80',
  greenDark: '#16A34A',
  gold: '#D9A029',
  red: '#F87171',
  redLight: '#3A1A1A',
  text: '#F3F6F4',
  subtext: '#A7B5AD',
  border: '#1F3329',
  chip: '#1F3329',
} as const;

interface UpcomingPoll {
  id: string;
  month: string;
  day: string;
  title: string;
  subtitle: string;
}

interface ResultCard {
  id: string;
  faculty: string;
  title: string;
  winner: string;
}

function CountdownTimer({
  targetISO,
  textStyle,
}: {
  targetISO: string | null | undefined;
  textStyle: any;
}) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!targetISO) {
      setRemaining(0);
      return;
    }
    const target = new Date(targetISO).getTime();
    const update = () => {
      const diff = Math.max(0, Math.floor((target - Date.now()) / 1000));
      setRemaining(diff);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetISO]);

  if (remaining <= 0) {
    return <Text style={textStyle}>Ended</Text>;
  }

  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');

  return (
    <Text style={textStyle}>{`${pad(h)}h : ${pad(m)}m : ${pad(s)}s`}</Text>
  );
}

const isElectionEnded = (election: {end_at?: string}) => {
  if (!election.end_at) {
    return false;
  }
  return new Date(election.end_at) < new Date();
};

const formatDateTime = (iso: string | undefined) => {
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
    textBold700: {fontWeight: '700'},
    scrollGap12: {gap: 12},

    scrollContent: {paddingHorizontal: 16, paddingBottom: 24},
    title: {fontSize: 24, fontWeight: '900', color: C.text, marginTop: 16},
    subtitle: {fontSize: 13.5, color: C.green, marginTop: 6, lineHeight: 19},
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 22,
      marginBottom: 10,
    },
    sectionHeaderText: {fontSize: 19, fontWeight: '800', color: C.text},
    sectionHeaderText2: {
      fontSize: 19,
      fontWeight: '800',
      color: C.text,
      marginTop: 22,
      marginBottom: 10,
    },
    liveBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: C.redLight,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    liveDot: {width: 6, height: 6, borderRadius: 3, backgroundColor: C.red},
    liveBadgeText: {fontSize: 11, fontWeight: '800', color: C.red},
    electionCard: {
      backgroundColor: C.card,
      borderRadius: 16,
      overflow: 'hidden',
    },
    electionImageWrap: {height: 180, justifyContent: 'flex-end'},
    electionImage: {
      ...StyleSheet.absoluteFillObject,
      width: '100%',
      height: '100%',
    },
    electionImageOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.28)',
    },
    facultyBadge: {
      position: 'absolute',
      top: 14,
      left: 14,
      backgroundColor: C.gold,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
    },
    facultyBadgeText: {fontSize: 11, fontWeight: '800', color: '#3A2A00'},
    electionImageTitle: {
      color: '#FFFFFF',
      fontSize: 17,
      fontWeight: '800',
      padding: 14,
      lineHeight: 22,
    },
    electionBody: {padding: 16},
    countdownRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    countdownLeft: {flexDirection: 'row', alignItems: 'center', gap: 6},
    countdownLabel: {fontSize: 13, color: C.text},
    countdownValue: {fontWeight: '800'},
    votedText: {fontSize: 13, fontWeight: '700', color: C.text},
    progressTrack: {
      height: 6,
      backgroundColor: C.border,
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressFill: {height: '100%', backgroundColor: C.green, borderRadius: 3},
    voteNowButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: C.green,
      borderRadius: 12,
      paddingVertical: 14,
    },
    voteNowButtonDisabled: {
      backgroundColor: C.chip,
    },
    voteNowText: {color: '#FFFFFF', fontSize: 15, fontWeight: '700'},
    voteNowTextDisabled: {color: C.subtext},
    electionActionsRow: {
      flexDirection: 'column',
      gap: 10,
      marginTop: 16,
    },
    liveResultsButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: C.gold,
      borderRadius: 12,
      paddingVertical: 14,
    },
    liveResultsButtonText: {color: '#FFFFFF', fontSize: 15, fontWeight: '700'},
    electionTimeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 12,
    },
    electionTimeWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 4,
      flex: 1,
    },
    electionTimeText: {
      fontSize: 11,
      color: C.subtext,
      flex: 1,
    },
    miniCard: {
      backgroundColor: C.card,
      borderRadius: 14,
      padding: 14,
      marginTop: 14,
    },
    miniKicker: {
      fontSize: 11,
      fontWeight: '800',
      color: C.subtext,
      letterSpacing: 0.5,
    },
    miniRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginTop: 6,
      gap: 10,
    },
    miniTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: C.text,
      flex: 1,
      lineHeight: 20,
    },
    miniVoteButton: {
      backgroundColor: C.chip,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 10,
    },
    miniVoteButtonText: {fontSize: 13, fontWeight: '700', color: C.text},
    miniTimeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: 8,
    },
    miniTimeText: {fontSize: 12, color: C.subtext},
    pollCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.card,
      borderRadius: 14,
      padding: 14,
      marginBottom: 12,
      gap: 12,
    },
    pollDateBox: {
      width: 48,
      height: 48,
      borderRadius: 10,
      backgroundColor: C.chip,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pollMonth: {fontSize: 10, fontWeight: '700', color: C.subtext},
    pollDay: {fontSize: 16, fontWeight: '800', color: C.text},
    pollTitle: {fontSize: 14.5, fontWeight: '700', color: C.text},
    pollSubtitle: {fontSize: 12.5, color: C.green, marginTop: 2},
    viewArchivesText: {fontSize: 13, fontWeight: '700', color: C.green},
    resultCard: {
      width: 220,
      backgroundColor: C.card,
      borderRadius: 14,
      padding: 14,
    },
    resultTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    certifiedBadge: {
      backgroundColor: C.chip,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    certifiedBadgeText: {fontSize: 10, fontWeight: '700', color: C.subtext},
    resultTitle: {
      fontSize: 14.5,
      fontWeight: '700',
      color: C.text,
      marginTop: 10,
      lineHeight: 19,
    },
    resultBottomRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 12,
    },
    resultWinner: {fontSize: 12, color: C.subtext},
    viewDataText: {fontSize: 12, fontWeight: '700', color: C.green},
  });

export default function ElectionHubScreen({navigation}: any) {
  const [elections, setElections] = useState<Election[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [totalVoters, setTotalVoters] = useState(0);
  const [upcomingPolls, _setUpcomingPolls] = useState<UpcomingPoll[]>([]);
  const [recentResults, setRecentResults] = useState<ResultCard[]>([]);
  const C = usePrefs().isDark ? DARK_COLORS : LIGHT_COLORS;
  const styles = useThemedStyles(() => getMainStyles(C), []);

  useEffect(() => {
    let active = true;

    (async () => {
      const electionsData = await fetchElections();

      if (active && electionsData.length) {
        setElections(electionsData);
        const votedCount = await getTotalVotes(electionsData[0].id);
        const {count: voterCount} = await backend
          .from('profiles')
          .select('*', {count: 'exact', head: true});
        setTotalVotes(votedCount);
        setTotalVoters(voterCount || 0);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!elections.length) {
      return;
    }

    const channel = backend
      .channel('election-hub')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'election_votes',
        },
        async () => {
          const activeElection = elections[0];
          const voted = await getTotalVotes(activeElection.id);
          const {count: voters} = await backend
            .from('profiles')
            .select('*', {count: 'exact', head: true});
          setTotalVotes(voted);
          setTotalVoters(voters || 0);
        },
      )
      .subscribe();

    return () => {
      backend.removeChannel(channel);
    };
  }, [elections]);

  const votedPercent =
    totalVoters > 0 ? Math.round((totalVotes / totalVoters) * 100) : 0;

  const loadRecentResults = async () => {
    const {data: endedElections} = await backend
      .from('elections')
      .select('id, title, faculty, end_at')
      .eq('status', 'ended')
      .order('end_at', {ascending: false})
      .limit(5);

    if (!endedElections) {
      return;
    }

    const results: ResultCard[] = [];
    for (const election of endedElections) {
      const electionResults = await fetchElectionResults(election.id);
      if (electionResults.length > 0) {
        const top = electionResults[0];
        results.push({
          id: election.id,
          faculty: election.faculty || 'CERTIFIED',
          title: election.title,
          winner: top.name,
        });
      }
    }
    setRecentResults(results);
  };

  useEffect(() => {
    loadRecentResults();

    const channel = backend
      .channel('election-recent-results')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'election_votes',
        },
        loadRecentResults,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'elections',
        },
        loadRecentResults,
      )
      .subscribe();

    return () => {
      backend.removeChannel(channel);
    };
  }, []);

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
        <Text style={styles.title}>Election Hub</Text>
        <Text style={styles.subtitle}>
          Exercise your democratic right within the UNIOSUN community.
        </Text>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderText}>Elections</Text>
        </View>

        {elections.length === 0 && (
          <View style={styles.miniCard}>
            <Text style={styles.votedText}>Loading elections...</Text>
          </View>
        )}

        {elections.map(election => {
          const ended = isElectionEnded(election);
          return (
            <View key={election.id} style={styles.electionCard}>
              <View style={styles.electionImageWrap}>
                <Image
                  source={
                    election.image_url
                      ? {uri: election.image_url}
                      : require('../../assets/uniosun-logo.png')
                  }
                  style={styles.electionImage}
                />
                <View style={styles.electionImageOverlay} />
                <View style={styles.facultyBadge}>
                  <Text style={styles.facultyBadgeText}>
                    {election.faculty || 'Central'}
                  </Text>
                </View>
                <Text style={styles.electionImageTitle}>{election.title}</Text>
              </View>

              <View style={styles.electionBody}>
                <View style={styles.countdownRow}>
                  <View style={styles.countdownLeft}>
                    <Icon name="clock" size={14} color={C.green} />
                    <Text style={styles.countdownLabel}>
                      {ended ? 'Ended' : 'Ends in:'}{' '}
                      <CountdownTimer
                        targetISO={election.end_at}
                        textStyle={styles.countdownValue}
                      />
                    </Text>
                  </View>
                  <Text style={styles.votedText}>{votedPercent}% Voted</Text>
                </View>

                <View style={styles.progressTrack}>
                  <View
                    style={[styles.progressFill, {width: `${votedPercent}%`}]}
                  />
                </View>

                <View style={styles.electionActionsRow}>
                  <TouchableOpacity
                    style={[
                      styles.voteNowButton,
                      ended && styles.voteNowButtonDisabled,
                    ]}
                    disabled={ended}
                    onPress={() =>
                      ended
                        ? undefined
                        : navigation?.navigate('ElectionBallot', {
                            electionId: election.id,
                          })
                    }>
                    <Text
                      style={[
                        styles.voteNowText,
                        ended && styles.voteNowTextDisabled,
                      ]}>
                      {ended ? 'Vote Closed' : 'Vote Now'}
                    </Text>
                    {!ended && <Icon name="upload" size={16} color="#FFFFFF" />}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.liveResultsButton}
                    onPress={() =>
                      navigation?.navigate('LiveResults', {
                        electionId: election.id,
                      })
                    }>
                    <Icon name="bar-chart-2" size={16} color="#FFFFFF" />
                    <Text style={styles.liveResultsButtonText}>
                      View Live Results
                    </Text>
                  </TouchableOpacity>
                </View>

                {election.start_at || election.end_at ? (
                  <View style={styles.electionTimeRow}>
                    <Icon name="calendar" size={12} color={C.subtext} />
                    <View style={styles.electionTimeWrap}>
                      <Text style={styles.electionTimeText}>
                        {formatDateTime(election.start_at)?.date || 'TBD'}
                        {' · '}
                        {formatDateTime(election.start_at)?.time || ''}
                      </Text>
                      <Text style={styles.electionTimeText}>{' → '}</Text>
                      <Text style={styles.electionTimeText}>
                        {formatDateTime(election.end_at)?.date || 'TBD'}
                        {' · '}
                        {formatDateTime(election.end_at)?.time || ''}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}

        <Text style={styles.sectionHeaderText2}>Upcoming Polls</Text>
        {upcomingPolls.length === 0 && (
          <View style={styles.miniCard}>
            <Text style={styles.votedText}>No upcoming polls.</Text>
          </View>
        )}
        {upcomingPolls.map(poll => (
          <View key={poll.id} style={styles.pollCard}>
            <View style={styles.pollDateBox}>
              <Text style={styles.pollMonth}>{poll.month}</Text>
              <Text style={styles.pollDay}>{poll.day}</Text>
            </View>
            <View style={styles.flexOne}>
              <Text style={styles.pollTitle}>{poll.title}</Text>
              <Text style={styles.pollSubtitle}>{poll.subtitle}</Text>
            </View>
            <Icon name="calendar" size={18} color={C.subtext} />
          </View>
        ))}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderText2}>Recent Results</Text>
          <TouchableOpacity>
            <Text style={styles.viewArchivesText}>View Archives</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollGap12}>
          {recentResults.length === 0 ? (
            <View style={styles.miniCard}>
              <Text style={styles.votedText}>
                No completed election results yet.
              </Text>
            </View>
          ) : (
            recentResults.map(result => (
              <View key={result.id} style={styles.resultCard}>
                <View style={styles.resultTopRow}>
                  <View style={styles.certifiedBadge}>
                    <Text style={styles.certifiedBadgeText}>
                      {result.faculty}
                    </Text>
                  </View>
                  <Icon name="check-circle" size={16} color={C.green} />
                </View>
                <Text style={styles.resultTitle}>{result.title}</Text>
                <View style={styles.resultBottomRow}>
                  <Text style={styles.resultWinner}>
                    Winner:{' '}
                    <Text style={styles.textBold700}>{result.winner}</Text>
                  </Text>
                  <TouchableOpacity>
                    <Text style={styles.viewDataText}>View Data</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </ScrollView>
    </SafeAreaView>
  );
}
