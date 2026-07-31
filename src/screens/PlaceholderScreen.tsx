import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import {colors, spacing, typography} from '../theme/colors.ts';

interface Props {
  title: string;
  icon: string;
}

export default function PlaceholderScreen({title, icon}: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <Icon name={icon} size={40} color={colors.primary} />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>Coming soon</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.background},
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  title: {...typography.h3, color: colors.textPrimary},
  subtitle: {color: colors.textSecondary},
});
