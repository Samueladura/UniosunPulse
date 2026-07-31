import React, {useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Image,
  ImageBackground,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Video from 'react-native-video';
import Icon from 'react-native-vector-icons/Feather';
import AppButton from '../components/AppButton.tsx';
import {colors, radius, spacing} from '../theme/colors.ts';
import {useThemedStyles} from '../theme/PreferencesContext';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/AppNavigator';
import type {ImageStyle} from 'react-native';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

const AVATARS = [
  'https://i.pravatar.cc/100?img=1',
  'https://i.pravatar.cc/100?img=2',
  'https://i.pravatar.cc/100?img=3',
];

export default function OnboardingScreen({navigation}: Props) {
  const [isVideoReady, setIsVideoReady] = useState(false);
  const videoRef = useRef<any>(null);

  const stopVideo = () => {
    videoRef.current?.pause();
  };

  const styles = useThemedStyles(() =>
    StyleSheet.create({
      background: {flex: 1},
      overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.45)',
      },
      video: {
        ...StyleSheet.absoluteFillObject,
      },
      safe: {
        flex: 1,
        paddingHorizontal: spacing.md,
        justifyContent: 'space-between',
      },
      topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: spacing.md,
      },
      brandRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
      logoBadge: {
        width: 44,
        height: 44,
        borderRadius: radius.md,
        backgroundColor: colors.white,
        alignItems: 'center',
        justifyContent: 'center',
      },
      logoBadgeImage: {
        width: 26,
        height: 26,
      },
      brandTitle: {color: colors.white, fontSize: 18, fontWeight: '800'},
      brandSubtitle: {
        color: colors.accent,
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1.2,
      },
      helpBadge: {
        width: 38,
        height: 38,
        borderRadius: radius.pill,
        backgroundColor: colors.white,
        alignItems: 'center',
        justifyContent: 'center',
      },
      card: {
        backgroundColor: colors.surface,
        borderRadius: radius.xl,
        padding: spacing.lg,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
      },
      kickerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.xs,
      },
      dash: {
        width: 24,
        height: 3,
        backgroundColor: colors.primary,
        borderRadius: 2,
      },
      kicker: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.textPrimary,
        letterSpacing: 1.5,
      },
      headline: {
        fontSize: 28,
        fontWeight: '900',
        color: colors.primary,
        marginTop: spacing.xs,
        lineHeight: 34,
      },
      description: {
        fontSize: 14.5,
        color: colors.textSecondary,
        marginTop: spacing.md,
        lineHeight: 22,
      },
      joinedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.xl,
        paddingLeft: spacing.xs,
        gap: spacing.sm,
      },
      avatarStack: {flexDirection: 'row', alignItems: 'center'},
      avatar: {
        width: 34,
        height: 34,
        borderRadius: 17,
        borderWidth: 2,
        borderColor: colors.white,
      },
      avatarStackItem: {
        marginLeft: -10,
      },
      countBadge: {
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        width: 34,
        height: 34,
        borderRadius: 17,
        borderWidth: 2,
        borderColor: colors.white,
      },
      countText: {color: colors.white, fontSize: 10, fontWeight: '700'},
      joinedText: {color: colors.white, fontWeight: '600', fontSize: 14},
    }),
  );

  return (
    <View style={styles.background}>
      <Video
        ref={videoRef}
        source={require('../assets/uniosun.mp4')}
        style={styles.video}
        resizeMode="cover"
        repeat
        poster="https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1000"
        onReadyForDisplay={() => setIsVideoReady(true)}
      />
      <View style={styles.overlay} pointerEvents="none" />
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safe}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <View style={styles.logoBadge}>
              <Image
                source={require('../assets/uniosun-logo.png')}
                style={styles.logoBadgeImage}
                resizeMode="contain"
              />
            </View>
            <View>
              <Text style={styles.brandTitle}>UniOsun Pulse</Text>
              <Text style={styles.brandSubtitle}>OFFICIAL STUDENT APP</Text>
            </View>
          </View>
          <View style={styles.helpBadge}>
            <Icon name="help-circle" size={20} color={colors.primary} />
          </View>
        </View>

        {/* Bottom card */}
        <View style={styles.card}>
          <View style={styles.kickerRow}>
            <View style={styles.dash} />
            <Text style={styles.kicker}>CONNECT • VOTE • DISCOVER</Text>
          </View>

          <Text style={styles.headline}>
            Your Campus,{'\n'}Your Pulse,{'\n'}Your Voice.
          </Text>

          <Text style={styles.description}>
            Stay updated with campus news, participate in student elections, and
            connect with the UniOsun community all in one place.
          </Text>

          <AppButton
            label="Get Started"
            onPress={() => {
              stopVideo();
              navigation.navigate('CreateAccount');
            }}
            icon={<Icon name="arrow-right" size={18} color={colors.white} />}
            style={{marginTop: spacing.lg}}
          />
          <AppButton
            label="Sign In to Account"
            variant="secondary"
            onPress={() => {
              stopVideo();
              navigation.navigate('SignIn');
            }}
            style={{marginTop: spacing.sm}}
          />
        </View>

        <View style={styles.joinedRow}>
          <View style={styles.avatarStack}>
            {AVATARS.map((uri, i) => (
              <Image
                key={uri}
                source={{uri}}
                style={[
                  styles.avatar as ImageStyle,
                  i !== 0 && styles.avatarStackItem,
                ]}
              />
            ))}
            <View
              style={[
                styles.avatar,
                styles.countBadge,
                styles.avatarStackItem,
              ]}>
              <Text style={styles.countText}>10k+</Text>
            </View>
          </View>
          <Text style={styles.joinedText}>Joined by 10,000+ Students</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}
