import React, {useEffect, useState} from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {usePrefs, useThemedStyles} from '../../theme/PreferencesContext';
import {backend} from '../../services/backend';
import {fetchElectionResults, type Election} from '../../services/backend';

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

interface PastElection {
  id: string;
  title: string;
  faculty: string;
  end_at: string;
  winner?: string;
}

function formatDateTime(iso: string | undefined) {
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
      gap: 10,
    },
    headerTitle: {fontSize: 17, fontWeight: '800', color: C.green, flex: 1},
    backBtn: {padding: 8},
    scrollContent: {paddingHorizontal: 16, paddingBottom: 24},
    title: {fontSize: 24, fontWeight: '900', color: C.text, marginTop: 16},
    subtitle: {fontSize: 13.5, color: C.green, marginTop: 6, lineHeight: 19},
    sectionHeaderText: {fontSize: 19, fontWeight: '800', color: C.text, marginTop: 22, marginBottom: 10},
    electionCard: {
      backgroundColor: C.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: C.border,
    },
    electionTitle: {fontSize: 17, fontWeight: '800', color: C.text, marginBottom: 8},
    electionMeta: {flexDirection: 'row', gap: 16, marginBottom: 8},
    metaItem: {flexDirection: 'row', alignItems: 'center', gap: 6},
    metaText: {fontSize: 13, color: C.subtext},
    winnerRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border},
    winnerLabel: {fontSize: 13, color: C.subtext},
    winnerName: {fontSize: 15, fontWeight: '700', color: C.green},
    viewResultsBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: C.gold,
      borderRadius: 12,
      paddingVertical: 12,
      marginTop: 12,
    },
    viewResultsBtnText: {color: '#FFFFFF', fontSize: 14, fontWeight: '700'},
    emptyState: {alignItems: 'center', paddingVertical: 40},
    emptyIcon: {marginBottom: 12},
    emptyText: {fontSize: 15, color: C.subtext, textAlign: 'center'},
    loadingWrap: {alignItems: 'center', paddingVertical: 40},
  });

export default function ElectionArchivesScreen({navigation}: any) {
  const [pastElections, setPastElections] = useState<PastElection[]>([]);
  const [loading, setLoading] = useState(true);
  const C = usePrefs().isDark ? DARK_COLORS : LIGHT_COLORS;
  const styles = useThemedStyles(() => getMainStyles(C), []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const {data: elections} = await backend
          .from('elections')
          .select('id, title, faculty, end_at, status')
          .eq('status', 'ended')
          .order('end_at', {ascending: false})
          .limit(20);

        if (active && elections) {
          const results: PastElection[] = [];
          for (const election of elections) {
            const electionResults = await fetchElectionResults(election.id);
            results.push({
              id: election.id,
              title: election.title,
              faculty: election.faculty || 'Central',
              end_at: election.end_at,
              winner: electionResults.length > 0 ? electionResults[0].name : undefined,
            });
          }
          setPastElections(results);
        }
      } catch (error) {
        console.warn('Failed to load election archives', error);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleViewResults = (electionId: string) => {
    navigation.navigate('LiveResults', {electionId});
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Election Archives</Text>
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={C.green} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Election Archives</Text>
      </View>

      <ScrollView
        style={{flex: 1}}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Election Archives</Text>
        <Text style={styles.subtitle}>
          View past election results and certified winners.
        </Text>

        {pastElections.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="archive" size={48} color={C.subtext} style={styles.emptyIcon} />
            <Text style={styles.emptyText}>
              No completed elections yet. Results will appear here after elections end.
            </Text>
          </View>
        ) : (
          pastElections.map(election => {
            const fmt = formatDateTime(election.end_at);
            return (
              <View key={election.id} style={styles.electionCard}>
                <Text style={styles.electionTitle}>{election.title}</Text>
                <View style={styles.electionMeta}>
                  <View style={styles.metaItem}>
                    <Icon name="award" size={14} color={C.subtext} />
                    <Text style={styles.metaText}>{election.faculty}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Icon name="calendar" size={14} color={C.subtext} />
                    <Text style={styles.metaText}>
                      {fmt?.date || 'TBD'} · {fmt?.time || ''}
                    </Text>
                  </View>
                </View>
                {election.winner && (
                  <View style={styles.winnerRow}>
                    <Icon name="check-circle" size={16} color={C.green} />
                    <Text style={styles.winnerLabel}>Winner:</Text>
                    <Text style={styles.winnerName}>{election.winner}</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.viewResultsBtn}
                  onPress={() => handleViewResults(election.id)}>
                  <Icon name="bar-chart-2" size={16} color="#FFFFFF" />
                  <Text style={styles.viewResultsBtnText}>View Full Results</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}