import React, {useState, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  Platform,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import AppButton from '../components/AppButton';
import {colors, radius, spacing, typography} from '../theme/colors.ts';
import {useThemedStyles} from '../theme/PreferencesContext';
import {backend, updateProfile} from '../services/backend';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'VerifyEmail'>;

export default function VerifyEmailScreen({navigation, route}: Props) {
  const email = route.params?.email ?? '';
  const fullName = route.params?.fullName ?? '';
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const inputsRef = useRef<(TextInput | null)[]>([]);

  const styles = useThemedStyles(() =>
    StyleSheet.create({
      safe: {flex: 1, backgroundColor: colors.background},
      content: {padding: spacing.lg, alignItems: 'center'},
      logoWrap: {
        width: 84,
        height: 84,
        borderRadius: radius.lg,
        backgroundColor: colors.white,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: spacing.md,
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
      logo: {width: 56, height: 56},
      title: {
        ...typography.h2,
        color: colors.primary,
        marginTop: spacing.md,
        textAlign: 'center',
      },
      subtitle: {
        ...typography.body,
        color: colors.textSecondary,
        marginTop: 4,
        marginBottom: spacing.lg,
        textAlign: 'center',
      },
      card: {
        width: '100%',
        backgroundColor: colors.card,
        borderRadius: radius.lg,
        padding: spacing.lg,
        alignItems: 'center',
      },
      otpRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: spacing.lg,
      },
      otpBox: {
        width: 48,
        height: 56,
        borderRadius: radius.md,
        borderWidth: 1.5,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        textAlign: 'center',
        fontSize: 22,
        fontWeight: '700',
        color: colors.textPrimary,
        paddingVertical: 12,
      },
      otpBoxFocused: {
        borderColor: colors.primary,
        backgroundColor: colors.white,
      },
      helperText: {
        ...typography.small,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.md,
      },
      emailText: {
        ...typography.body,
        color: colors.textPrimary,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: spacing.sm,
      },
      resendText: {
        ...typography.small,
        color: colors.textMuted,
        textAlign: 'center',
        marginBottom: spacing.lg,
      },
      resendLink: {color: colors.primary, fontWeight: '700'},
      footerText: {
        ...typography.small,
        color: colors.textSecondary,
        textAlign: 'center',
        marginTop: spacing.md,
      },
      backLink: {color: colors.primary, fontWeight: '700'},
    }),
  );

  const handleVerify = async () => {
    const otp = code.join('');
    if (otp.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter the full 6-digit code.');
      return;
    }
    setLoading(true);

    // Try type 'signup' first (for signUp verification code), fallback to 'email' (for OTP magic link code)
    let {data, error} = await backend.auth.verifyOtp({
      email,
      token: otp,
      type: 'signup',
    });

    if (error) {
      const res = await backend.auth.verifyOtp({
        email,
        token: otp,
        type: 'email',
      });
      data = res.data;
      error = res.error;
    }

    setLoading(false);
    if (error) {
      Alert.alert('Verification Failed', error.message);
    } else if (data?.mfa_required) {
      Alert.alert(
        'Additional verification required',
        'Continue signing in with your password and authenticator code.',
      );
      navigation.replace('SignIn');
    } else {
      if (fullName && data?.user) {
        await updateProfile({full_name: fullName});
      }
      navigation.replace('Home');
    }
  };

  const handleResend = async () => {
    setResending(true);
    const {error} = await backend.auth.signInWithOtp({
      email,
      options: {shouldCreateUser: false},
    });
    setResending(false);
    if (error) {
      Alert.alert('Resend Failed', error.message);
    } else {
      Alert.alert(
        'Code Sent',
        'A new 6-digit code has been sent to your email.',
      );
    }
  };

  const handleChange = (text: string, index: number) => {
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);
    if (digit && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={[styles.logoWrap, {backgroundColor: colors.primary}]}>
          <Image
            source={require('../assets/uniosun-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.title}>Verify Your Email</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit code we sent to your inbox
        </Text>

        <View style={styles.card}>
          <Text style={styles.emailText}>{email}</Text>
          <Text style={styles.helperText}>
            Check your Gmail and enter the code below
          </Text>

          <View style={styles.otpRow}>
            {code.map((digit, index) => (
              <TextInput
                key={index}
                ref={ref => {
                  inputsRef.current[index] = ref;
                }}
                style={[styles.otpBox]}
                maxLength={1}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                value={digit}
                onChangeText={text => handleChange(text, index)}
                onKeyPress={e => handleKeyPress(e, index)}
                selectionColor={colors.primary}
              />
            ))}
          </View>

          <AppButton
            label="Continue"
            onPress={handleVerify}
            loading={loading}
            icon={<Icon name="arrow-right" size={18} color={colors.white} />}
            style={{width: '100%'}}
          />

          <TouchableOpacity onPress={handleResend} disabled={resending}>
            <Text style={styles.resendText}>
              Didn't receive it?{' '}
              <Text style={styles.resendLink}>
                {resending ? 'Sending...' : 'Resend code'}
              </Text>
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.footerText}>
            <Text style={styles.backLink}>Back</Text> to create account
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
