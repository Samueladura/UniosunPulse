import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ImageStyle,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import AppButton from '../components/AppButton';
import {colors, radius, spacing, typography} from '../theme/colors.ts';
import {useThemedStyles} from '../theme/PreferencesContext';
import {interests, suggestedFollows} from '../data/mockData';
import {followUser} from '../services/backend';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

const ONBOARDING_STEPS = [
  {id: 1, label: 'Create your account', done: true},
  {
    id: 2,
    label: 'Complete your profile',
    sub: 'Add a photo and your department',
    done: false,
    active: true,
  },
  {id: 3, label: 'Follow 5 topics', done: false},
  {id: 4, label: 'Make your first post', done: false},
];

export default function HomeScreen({navigation}: Props) {
  const styles = useThemedStyles(getStyles);
  const [_following, setFollowing] = useState<Record<string, boolean>>({});
  const [_suggestedFollowing, setSuggestedFollowing] = useState<
    Record<string, boolean>
  >({});

  const handleFollowInterest = async (id: string) => {
    await followUser(id);
    setFollowing(prev => ({...prev, [id]: true}));
  };

  const handleFollowSuggested = async (id: string) => {
    await followUser(id);
    setSuggestedFollowing(prev => ({...prev, [id]: true}));
  };
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Icon name="menu" size={22} color={colors.textPrimary} />
        <Text style={styles.topBarTitle}>UniOsun Pulse</Text>
        <Icon name="search" size={22} color={colors.textPrimary} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Welcome to your{'\n'}Pulse, Oladapo!</Text>
        <Text style={styles.subheading}>
          Your campus universe, synchronized. Let's get you connected to what
          matters.
        </Text>

        <View style={styles.pulseCard}>
          <View style={styles.pulseIcon}>
            <Icon name="radio" size={26} color={colors.primary} />
          </View>
          <Text style={styles.pulseTitle}>The Pulse is Quiet</Text>
          <Text style={styles.pulseText}>
            Your personalized feed is being tuned. Follow topics and accounts to
            see the latest campus activity.
          </Text>
          <AppButton
            label="Explore All Topics"
            onPress={() => navigation.replace('Home')}
            style={{marginTop: spacing.md}}
          />
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>Based on your interests</Text>
          <TouchableOpacity>
            <Text style={styles.editLink}>Edit Preferences</Text>
          </TouchableOpacity>
        </View>

        {interests.map(item => (
          <View key={item.id} style={styles.interestCard}>
            <View
              style={[
                styles.interestIcon,
                {backgroundColor: (item as any).iconBg},
              ]}>
              <Icon
                name={item.icon}
                size={20}
                color={(item as any).iconColor}
              />
            </View>
            <View style={styles.interestCenter}>
              <Text style={styles.interestTitle}>{item.title}</Text>
              <Text style={styles.interestDesc}>{item.description}</Text>
              <View style={styles.interestFooter}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.badge}</Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.followBtn}
                  onPress={() => handleFollowInterest(item.id)}>
                  <Text style={styles.followBtnText}>Follow</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}

        <Text style={styles.sectionHeader}>Suggested to Follow</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.suggestedRow}>
          {suggestedFollows.map(person => (
            <View key={person.id} style={styles.followCard}>
              {person.avatar ? (
                <Image
                  source={{uri: person.avatar}}
                  style={styles.followAvatar as ImageStyle}
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={[
                    styles.followAvatar as ImageStyle,
                    styles.followAvatarFallback,
                  ]}
                />
              )}
              <Text style={styles.followName}>{person.name}</Text>
              <Text style={styles.followHandle}>{person.handle}</Text>
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.followBtn}
                onPress={() => handleFollowSuggested(person.id)}>
                <Text style={styles.followBtnText}>Follow</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>

        <View style={styles.onboardingCard}>
          <Text style={styles.onboardingTitle}>Complete your Onboarding</Text>
          {ONBOARDING_STEPS.map(step => (
            <View key={step.id} style={styles.stepRow}>
              <View
                style={[
                  styles.stepCircle,
                  step.done && styles.stepCircleDone,
                  step.active && styles.stepCircleActive,
                ]}>
                {step.done && (
                  <Icon name="check" size={12} color={colors.white} />
                )}
              </View>
              <View style={styles.stepCenter}>
                <Text
                  style={[styles.stepLabel, step.done && styles.stepLabelDone]}>
                  {step.label}
                </Text>
                {step.sub && <Text style={styles.stepSub}>{step.sub}</Text>}
              </View>
              {step.active && (
                <Text
                  style={styles.goLink}
                  onPress={() => navigation.replace('Home')}>
                  Go
                </Text>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = () =>
  StyleSheet.create({
    safe: {flex: 1, backgroundColor: colors.background},
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    topBarTitle: {fontSize: 17, fontWeight: '800', color: colors.textPrimary},
    content: {padding: spacing.md, paddingBottom: 150},
    heading: {...typography.h1, color: colors.primary, lineHeight: 32},
    subheading: {
      ...typography.body,
      color: colors.textSecondary,
      marginTop: spacing.sm,
      marginBottom: spacing.lg,
    },
    pulseCard: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    pulseIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    pulseTitle: {...typography.h3, color: colors.textPrimary},
    pulseText: {
      ...typography.small,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: spacing.xs,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    sectionHeader: {...typography.h3, color: colors.textPrimary, fontSize: 17},
    editLink: {color: colors.primary, fontWeight: '700', fontSize: 13},
    interestCard: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
      gap: spacing.sm,
    },
    interestIcon: {
      width: 40,
      height: 40,
      borderRadius: radius.sm,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    interestCenter: {flex: 1},
    interestTitle: {fontSize: 15, fontWeight: '700', color: colors.textPrimary},
    interestDesc: {fontSize: 13, color: colors.textSecondary, marginTop: 2},
    interestFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.sm,
    },
    badge: {
      backgroundColor: colors.background,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.pill,
    },
    badgeText: {fontSize: 11, color: colors.textSecondary, fontWeight: '600'},
    followBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.pill,
    },
    followBtnText: {color: colors.white, fontSize: 12, fontWeight: '700'},
    suggestedRow: {marginTop: spacing.sm},
    followCard: {
      backgroundColor: colors.card,
      borderRadius: radius.md,
      padding: spacing.md,
      alignItems: 'center',
      marginRight: spacing.sm,
      width: 140,
    },
    followAvatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      marginBottom: spacing.sm,
    },
    followAvatarFallback: {backgroundColor: colors.border},
    followName: {fontSize: 14, fontWeight: '700', color: colors.textPrimary},
    followHandle: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: spacing.sm,
    },
    onboardingCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginTop: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    onboardingTitle: {
      ...typography.h3,
      fontSize: 16,
      color: colors.textPrimary,
      marginBottom: spacing.md,
    },
    stepRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md,
      gap: spacing.sm,
    },
    stepCenter: {flex: 1},
    stepCircle: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepCircleDone: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    stepCircleActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    stepLabel: {fontSize: 14, color: colors.textPrimary, fontWeight: '600'},
    stepLabelDone: {
      color: colors.textMuted,
      textDecorationLine: 'line-through',
      fontWeight: '400',
    },
    stepSub: {fontSize: 12, color: colors.textSecondary},
    goLink: {color: colors.primary, fontWeight: '700', fontSize: 13},
  });
