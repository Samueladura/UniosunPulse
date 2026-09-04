import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import AppButton from '../components/AppButton';
import AppInput from '../components/AppInput';
import {colors, radius, spacing, typography} from '../theme/colors.ts';
import {useThemedStyles} from '../theme/PreferencesContext';
import {supabase, signInWithOtp} from '../services/supabase';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateAccount'>;

export default function CreateAccountScreen({navigation}: Props) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

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
      },
      checkboxRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: spacing.sm,
      },
      checkbox: {
        width: 18,
        height: 18,
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: colors.border,
        marginRight: spacing.sm,
        marginTop: 2,
        alignItems: 'center',
        justifyContent: 'center',
      },
      checkboxOn: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
      },
      checkboxLabel: {
        flex: 1,
        color: colors.textSecondary,
        fontSize: 13,
        lineHeight: 18,
      },
      link: {color: colors.primary, fontWeight: '700'},
      dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: spacing.md,
      },
      dividerLine: {flex: 1, height: 1, backgroundColor: colors.border},
      dividerText: {
        marginHorizontal: spacing.sm,
        color: colors.textMuted,
        fontSize: 12,
      },
      footerText: {textAlign: 'center', color: colors.textSecondary},
      secureText: {
        textAlign: 'center',
        color: colors.textMuted,
        fontSize: 11,
        marginTop: spacing.lg,
        lineHeight: 16,
      },
    }),
  );

  const handleCreateAccount = async () => {
    if (!fullName.trim()) {
      Alert.alert('Name Required', 'Please enter your full name.');
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    if (!password || password.length < 6) {
      Alert.alert(
        'Weak Password',
        'Password must be at least 6 characters long.',
      );
      return;
    }

    if (!agreed) {
      Alert.alert(
        'Terms Required',
        'Please agree to the Terms of Service and Privacy Policy.',
      );
      return;
    }

    setLoading(true);
    try {
      const {data: signUpData, error: signUpError} = await supabase.auth.signUp(
        {
          email: trimmedEmail,
          password,
          options: {
            data: {
              full_name: fullName.trim(),
            },
          },
        },
      );

      if (signUpError) {
        const rawMsg =
          typeof signUpError.message === 'string'
            ? signUpError.message
            : JSON.stringify(signUpError);
        const errorMsg = rawMsg.toLowerCase();

        if (
          errorMsg.includes('already registered') ||
          errorMsg.includes('already exists')
        ) {
          Alert.alert(
            'Account Exists',
            'An account with this email address already exists.',
            [
              {
                text: 'Sign In',
                onPress: () => navigation.navigate('SignIn'),
              },
              {
                text: 'Verify Email',
                onPress: async () => {
                  const {error: otpErr} = await signInWithOtp(trimmedEmail, {
                    shouldCreateUser: false,
                  });
                  if (
                    otpErr &&
                    !otpErr.toLowerCase().includes('rate limit') &&
                    !otpErr.toLowerCase().includes('60 seconds')
                  ) {
                    Alert.alert('OTP Notice', otpErr);
                  }
                  navigation.navigate('VerifyEmail', {
                    email: trimmedEmail,
                    fullName: fullName.trim(),
                  });
                },
              },
              {text: 'Cancel', style: 'cancel'},
            ],
          );
          return;
        }

        if (
          errorMsg.includes('500') ||
          errorMsg.includes('unexpected_failure')
        ) {
          Alert.alert(
            'Supabase Server Error (500)',
            'Account creation failed on Supabase backend.\n\nThis is caused by either:\n1. Resend Sender Email/Domain not being verified in Resend Dashboard.\n2. Resend API key or SMTP configuration mismatch in Supabase.\n3. Missing database tables in Supabase SQL Editor.',
          );
          return;
        }

        Alert.alert('Account Creation Failed', rawMsg);
        return;
      }

      // If user session is established automatically (e.g. Email Confirmation disabled in Supabase)
      if (signUpData?.session) {
        navigation.replace('Home');
        return;
      }

      navigation.replace('VerifyEmail', {
        email: trimmedEmail,
        fullName: fullName.trim(),
      });
    } catch (e: any) {
      Alert.alert(
        'Error',
        e?.message || 'An unexpected error occurred. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <View style={styles.logoWrap}>
          <Image
            source={require('../assets/uniosun-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.title}>Create Your Account</Text>
        <Text style={styles.subtitle}>
          Join the UniOsun student community pulse
        </Text>

        <View style={styles.card}>
          <AppInput
            label="Full Name"
            leftIcon="user"
            placeholder="John Doe"
            value={fullName}
            onChangeText={setFullName}
          />

          <AppInput
            label="Email"
            leftIcon="at-sign"
            placeholder="name@gmail.com"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <AppInput
            label="Password"
            leftIcon="lock"
            placeholder="••••••••"
            isPassword
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setAgreed(!agreed)}>
            <View style={[styles.checkbox, agreed && styles.checkboxOn]}>
              {agreed && <Icon name="check" size={12} color={colors.white} />}
            </View>
            <Text style={styles.checkboxLabel}>
              I agree to the <Text style={styles.link}>Terms of Service</Text>{' '}
              and <Text style={styles.link}>Privacy Policy</Text>.
            </Text>
          </TouchableOpacity>

          <AppButton
            label="Create Account"
            onPress={handleCreateAccount}
            loading={loading}
            icon={<Icon name="arrow-right" size={18} color={colors.white} />}
            style={{marginTop: spacing.sm}}
          />

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
            <Text style={styles.footerText}>
              Already have an account? <Text style={styles.link}>Log In</Text>
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.secureText}>
          Secure 256-bit SSL encrypted institutional access{'\n'}for Osun State
          University staff and students only.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
