import React, {useEffect, useState, useRef} from 'react';
import {View, Text, StyleSheet, Image, Dimensions, Animated} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {colors, radius, spacing} from '../theme/colors.ts';
import {useThemedStyles} from '../theme/PreferencesContext';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

const PHRASES = ['Latest Update', 'Admission', 'Campus Life'];

export default function SplashScreen({navigation}: Props) {
  const [currentIndex, setIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Cycle through the phrases every 2.5 seconds
  useEffect(() => {
    const id = setInterval(() => {
      setIndex(prev => (i + 1) % PHRASES.length);
    }, 2600);
    return () => clearInterval(id);
  }, [fadeAnim]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../assets/uniosun-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        
        <View style={styles.content}>
          <Text style={styles.title}>UniOsun Pulse</Text>
          <Text style={styles.subtitle}>OFFICIAL STUDENT APP</Text>
        </View>
        
        <View style={styles.bottomContainer}>
          <View style={styles.dotsRow}>
            {PHRASES.map((label, index) => (
              <View key={i} style={[
                styles.dot,
                i === index && styles.dotActive
              ]} />
            ))}
          </View>
          <Text style={styles.transitionText}>
            {PHRASES[index]}
          </View>
        </View>
      </View>
    </View>
  );
}

const useThemedStyles = () => {
  const {colors} = require('../theme/colors.ts');
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    safe: {
      flex: 1,
      padding: spacing.md,
    },
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    logo: {
      width: 120,
      height: 120,
      marginBottom: spacing.sm,
    },
    logo: {
      width: 80,
      height: 26,
      alignItems: 'center',
      justifyContent: 'center',
    },
    topBar: {
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.white,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    subtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    bottom: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.xl,
    },
    bottom: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.sm,
      paddingBottom: spacing.md,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.textSecondary,
      marginHorizontal: 4,
    },
    dotActive: {
      backgroundColor: colors.primary,
    },
    transitionText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
      textAlign: 'center',
      marginBottom: spacing.xs,
    },
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    safeArea: {
      flex: 1,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
    },
    safeAreaContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    top: {
      flexDirection: 'column',
      alignItems: 'center',
      marginTop: spacing.xxl,
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    brandRow: {
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
    },
    logo: {
      width: 120,
      height: 120,
      borderRadius: radius.pill,
      backgroundColor: colors.white,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logo: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    brandRow: {
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.md,
    },
    brandTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.white,
      textAlign: 'center',
    },
    brandSubtitle: {
      fontSize: 12,
      color: colors.accent,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
    safe: {
      flex: 1,
    },
    safeArea: {
      flex: 1,
      padding: spacing.sm,
    },
    safeAreaContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    top: {
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: spacing.xxl,
    },
    safe: {
      flex: 1,
      padding: spacing.md,
    },
    safeArea: {
      flex: 1,
      padding: spacing.sm,
    },
    safeAreaContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    safe: {
      flex: 1,
      padding: spacing.sm,
    },
    safeAreaContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    safe: {
      flex: 1,
      padding: spacing.sm,
    },
    safeArea: {
      flex: 1,
      padding: spacing.sm,
    },
    safeAreaContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    topBarTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    topBarSubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    quickActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    quickAction: {
      width: '48%',
      minHeight: 52,
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.md,
    },
  });