import React from 'react';

import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import {colors, radius, spacing} from '../theme/colors.ts';
import {useThemedStyles} from '../theme/PreferencesContext';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost';

interface Props {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: React.ReactNode;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
}

export default function AppButton({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading,
  style,
  textStyle,
  disabled,
}: Props) {
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  const isOutline = variant === 'outline';
  const styles = useThemedStyles(() =>
    StyleSheet.create({
      base: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: radius.md,
        gap: spacing.sm,
        width: '100%',
      },
      primary: {
        backgroundColor: colors.primary,
      },
      secondary: {
        backgroundColor: colors.surface,
        opacity: 0.85,
      },
      outline: {
        backgroundColor: colors.card,
        borderWidth: 1.5,
        borderColor: colors.border,
      },
      ghost: {
        backgroundColor: 'transparent',
        paddingVertical: 8,
      },
      disabled: {
        opacity: 0.6,
      },
      label: {
        fontSize: 15,
        fontWeight: '600',
      },
      labelPrimary: {
        color: colors.white,
      },
      labelSecondary: {
        color: colors.textPrimary,
      },
      labelOutline: {
        color: colors.textPrimary,
      },
      labelGhost: {
        color: colors.primary,
      },
    }),
  );

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.base,
        isPrimary && styles.primary,
        isSecondary && styles.secondary,
        isOutline && styles.outline,
        variant === 'ghost' && styles.ghost,
        disabled && styles.disabled,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.white : colors.primary} />
      ) : (
        <>
          <Text
            style={[
              styles.label,
              isPrimary && styles.labelPrimary,
              isSecondary && styles.labelSecondary,
              isOutline && styles.labelOutline,
              variant === 'ghost' && styles.labelGhost,
              textStyle,
            ]}>
            {label}
          </Text>
          {icon}
        </>
      )}
    </TouchableOpacity>
  );
}
