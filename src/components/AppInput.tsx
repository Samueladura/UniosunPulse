import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  TextInputProps,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {colors, radius, spacing} from '../theme/colors.ts';
import {useThemedStyles} from '../theme/PreferencesContext';

interface Props extends TextInputProps {
  label?: string;
  leftIcon?: string;
  isPassword?: boolean;
  rightLabel?: React.ReactNode;
  uppercaseLabel?: boolean;
}

export default function AppInput({
  label,
  leftIcon,
  isPassword,
  rightLabel,
  uppercaseLabel = false,
  onFocus,
  onBlur,
  ...rest
}: Props) {
  const [secure, setSecure] = useState(!!isPassword);
  const [isFocused, setIsFocused] = useState(false);
  const styles = useThemedStyles(() =>
    StyleSheet.create({
      wrapper: {
        marginBottom: spacing.md,
        width: '100%',
      },
      labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xs + 2,
      },
      label: {
        fontSize: 12.5,
        fontWeight: '600',
        color: colors.textPrimary,
        letterSpacing: 0.3,
      },
      uppercase: {
        textTransform: 'uppercase',
        fontSize: 11.5,
        fontWeight: '700',
        letterSpacing: 0.8,
        color: colors.textSecondary,
      },
      inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.2,
        borderColor: colors.border,
        borderRadius: radius.md,
        paddingHorizontal: spacing.md,
        backgroundColor: colors.surface,
      },
      inputRowFocused: {
        borderColor: colors.primary,
        backgroundColor: colors.surface,
      },
      leftIcon: {
        marginRight: spacing.sm,
      },
      input: {
        flex: 1,
        paddingVertical: 12,
        fontSize: 15,
        color: colors.textPrimary,
      },
    }),
  );

  return (
    <View style={styles.wrapper}>
      {(label || rightLabel) && (
        <View style={styles.labelRow}>
          {label ? (
            <Text style={[styles.label, uppercaseLabel && styles.uppercase]}>
              {label}
            </Text>
          ) : (
            <View />
          )}
          {rightLabel}
        </View>
      )}

      <View style={[styles.inputRow, isFocused && styles.inputRowFocused]}>
        {leftIcon && (
          <Icon
            name={leftIcon}
            size={18}
            color={isFocused ? colors.primary : colors.textMuted}
            style={styles.leftIcon}
          />
        )}

        <TextInput
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          secureTextEntry={secure}
          onFocus={e => {
            setIsFocused(true);
            if (onFocus) {
              onFocus(e);
            }
          }}
          onBlur={e => {
            setIsFocused(false);
            if (onBlur) {
              onBlur(e);
            }
          }}
          {...rest}
        />

        {isPassword && (
          <TouchableOpacity onPress={() => setSecure(!secure)}>
            <Icon
              name={secure ? 'eye' : 'eye-off'}
              size={18}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
