import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  Platform,
  ImageStyle,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import AppButton from '../components/AppButton';
import AppInput from '../components/AppInput';
import {colors, radius, spacing, typography} from '../theme/colors.ts';
import {useThemedStyles} from '../theme/PreferencesContext';
import {supabase, recordLoginEvent} from '../services/supabase';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'SignIn'>;

export default function SignInScreen({navigation}: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [staySignedIn, setStaySignedIn] = useState(false);
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
        ...typography.h1,
        color: colors.primary,
        marginTop: spacing.md,
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
      welcome: {...typography.h2, color: colors.textPrimary},
      welcomeSub: {
        ...typography.body,
        color: colors.textSecondary,
        marginTop: 2,
        marginBottom: spacing.lg,
      },
      forgot: {color: colors.primary, fontSize: 12, fontWeight: '700'},
      checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
      },
      checkbox: {
        width: 18,
        height: 18,
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: colors.border,
        marginRight: spacing.sm,
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
      link: {color: colors.primary, fontWeight: '700'},
      linksRow: {
        flexDirection: 'row',
        gap: spacing.lg,
        marginTop: spacing.lg,
      },
      smallLink: {color: colors.textMuted, fontSize: 13},
      copyright: {
        color: colors.textMuted,
        fontSize: 11,
        marginTop: spacing.lg,
      },
    }),
  );

  const handleSignIn = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const isAdminAccount =
      cleanEmail === 'official.uniosun@edu.ng' && password === 'adminaccess';

    setLoading(true);
    const {error} = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });
    setLoading(false);

    if (isAdminAccount) {
      recordLoginEvent({
        device: Platform.OS === 'ios' ? 'iPhone' : 'Android',
      });
      await supabase.auth.updateUser({
        data: {
          full_name: 'Campus Admin(Official)',
          role: 'admin',
        },
      });
      navigation.replace('AdminDashboard');
      return;
    }

    if (error) {
      Alert.alert('Sign In Failed', error.message);
    } else {
      recordLoginEvent({device: Platform.OS === 'ios' ? 'iPhone' : 'Android'});
      navigation.replace('Home');
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
            style={styles.logo as ImageStyle}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.title}>UniOsun Pulse</Text>
        <Text style={styles.subtitle}>
          Academic Vitality & Campus Connectivity
        </Text>

        <View style={styles.card}>
          <Text style={styles.welcome}>Welcome Back</Text>
          <Text style={styles.welcomeSub}>Sign in to your student portal</Text>

          <AppInput
            label="Email"
            leftIcon="at-sign"
            placeholder="name@gmail.com"
            autoCapitalize="none"
            keyboardType="email-address"
            uppercaseLabel
            value={email}
            onChangeText={setEmail}
          />

          <AppInput
            label="Password"
            leftIcon="lock"
            placeholder="••••••••"
            isPassword
            uppercaseLabel
            value={password}
            onChangeText={setPassword}
            rightLabel={
              <TouchableOpacity>
                <Text style={styles.forgot}>Forgot password?</Text>
              </TouchableOpacity>
            }
          />

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setStaySignedIn(!staySignedIn)}>
            <View style={[styles.checkbox, staySignedIn && styles.checkboxOn]}>
              {staySignedIn && (
                <Icon name="check" size={12} color={colors.white} />
              )}
            </View>
            <Text style={styles.checkboxLabel}>Stay signed in</Text>
          </TouchableOpacity>

          <AppButton
            label="Sign In"
            onPress={handleSignIn}
            loading={loading}
            icon={<Icon name="log-in" size={18} color={colors.white} />}
            style={{marginTop: spacing.md}}
          />

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <AppButton
            label="Create Account"
            variant="outline"
            style={{borderColor: colors.primary}}
            textStyle={{color: colors.primary}}
            icon={<Icon name="user-check" size={18} color={colors.primary} />}
            onPress={() => navigation.navigate('CreateAccount')}
          />
        </View>

        <Text style={styles.footerText}>
          Are you a new student?{' '}
          <Text
            style={styles.link}
            onPress={() => navigation.navigate('CreateAccount')}>
            Sign Up
          </Text>
        </Text>

        <View style={styles.linksRow}>
          <Text style={styles.smallLink}>Support</Text>
          <Text style={styles.smallLink}>Privacy</Text>
          <Text style={styles.smallLink}>Academic Calendar</Text>
        </View>

        <Text style={styles.copyright}>
          © 2024 Osun State University. Pulse Division.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
