import React, {useState} from 'react';
import {
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import AppButton from '../components/AppButton';
import {backend} from '../services/backend';
import {colors, radius, spacing, typography} from '../theme/colors';
import {useThemedStyles} from '../theme/PreferencesContext';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'PasswordReset'>;

export default function PasswordResetScreen({navigation}: Props) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const styles = useThemedStyles(() =>
    StyleSheet.create({
      safe: {flex: 1, backgroundColor: colors.background},
      content: {flexGrow: 1, padding: spacing.lg, justifyContent: 'center'},
      back: {alignSelf: 'flex-start', marginBottom: spacing.lg},
      logoWrap: {
        width: 78,
        height: 78,
        borderRadius: radius.lg,
        backgroundColor: colors.white,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        ...Platform.select({
          ios: {
            shadowColor: '#000',
            shadowOpacity: 0.08,
            shadowRadius: 8,
            shadowOffset: {width: 0, height: 4},
          },
          android: {elevation: 3},
        }),
      },
      logo: {width: 54, height: 54},
      title: {
        ...typography.h2,
        color: colors.primary,
        textAlign: 'center',
        marginTop: spacing.lg,
      },
      subtitle: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: 'center',
        marginTop: spacing.xs,
        marginBottom: spacing.lg,
      },
      form: {
        backgroundColor: colors.card,
        borderRadius: radius.lg,
        padding: spacing.lg,
        gap: spacing.md,
      },
      input: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        color: colors.textPrimary,
        backgroundColor: colors.background,
      },
      error: {color: colors.danger, fontSize: 13},
      success: {color: colors.primary, fontSize: 13, lineHeight: 19},
      link: {
        color: colors.primary,
        fontWeight: '700',
        textAlign: 'center',
        marginTop: spacing.lg,
      },
    }),
  );

  const requestCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await backend.auth.requestPasswordReset({
        email: normalizedEmail,
      });
      if (result.error) {
        setError(result.error.message);
        return;
      }
      setEmail(normalizedEmail);
      setSent(true);
    } catch (requestError) {
      const errorMessage = requestError instanceof Error ? requestError.message : 'Unable to request a reset code.';
      // Provide more helpful error messages
      if (errorMessage.includes('503') || errorMessage.includes('email delivery is not configured')) {
        setError('Password reset is currently unavailable. Please contact support.');
      } else if (errorMessage.includes('404') || errorMessage.includes('endpoint was not found')) {
        setError('Server configuration error. Please try again later.');
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        setError('Network error. Please check your connection and try again.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const updatePassword = async () => {
    const normalizedCode = code.replace(/\D/g, '');
    if (!/^\d{6}$/.test(normalizedCode)) {
      setError('Enter the 6-digit code sent to your email.');
      return;
    }
    if (password.length < 8) {
      setError('Your new password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await backend.auth.completePasswordReset({
        email,
        code: normalizedCode,
        password,
      });
      if (result.error) {
        setError(result.error.message);
        return;
      }
      Alert.alert('Password updated', 'Sign in with your new password.', [
        {text: 'Continue', onPress: () => navigation.replace('SignIn')},
      ]);
    } catch (requestError) {
      const errorMessage = requestError instanceof Error ? requestError.message : 'Unable to update your password.';
      if (errorMessage.includes('400') || errorMessage.includes('invalid or expired')) {
        setError('The reset code is invalid or expired. Please request a new code.');
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        setError('Network error. Please check your connection and try again.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <TouchableOpacity
          style={styles.back}
          onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.logoWrap}>
          <Image
            source={require('../assets/uniosun-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.title}>Reset your password</Text>
        <Text style={styles.subtitle}>
          {sent
            ? 'Enter the reset code from your email and choose a new password.'
            : 'We will email a one-time code to your account.'}
        </Text>
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!sent}
          />
          {sent ? (
            <>
              <TextInput
                style={styles.input}
                placeholder="6-digit reset code"
                placeholderTextColor={colors.textMuted}
                value={code}
                onChangeText={value =>
                  setCode(value.replace(/\D/g, '').slice(0, 6))
                }
                keyboardType="number-pad"
                maxLength={6}
              />
              <TextInput
                style={styles.input}
                placeholder="New password (at least 8 characters)"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
              <TextInput
                style={styles.input}
                placeholder="Confirm new password"
                placeholderTextColor={colors.textMuted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </>
          ) : null}
          {sent ? (
            <Text style={styles.success}>
              If a verified account exists for that email, a reset code has been
              sent. Check your inbox; the code expires in 10 minutes.
            </Text>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <AppButton
            label={sent ? 'Update password' : 'Send reset code'}
            onPress={sent ? updatePassword : requestCode}
            loading={loading}
            icon={
              <Icon
                name={sent ? 'lock' : 'mail'}
                size={17}
                color={colors.white}
              />
            }
          />
        </View>
        {sent ? (
          <TouchableOpacity
            onPress={() => void requestCode()}
            disabled={loading}>
            <Text style={styles.link}>Send a new code</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
