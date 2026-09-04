import React, {useState, ReactNode, useEffect, useCallback} from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Image,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  TextInput,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Slider from '@react-native-community/slider';
import {colors} from '../theme/colors.ts';
import {
  supabase,
  fetchUserProfile,
  signOut as supabaseSignOut,
  changePassword,
  updateProfile,
  enableTwoFactor,
  disableTwoFactor,
  listTwoFactorFactors,
  fetchBlockedUsers,
  unblockUser,
  fetchLoginHistory,
  saveLanguage,
  getLanguageLabel,
  getFollowerCount,
  SUPPORTED_LANGUAGES,
  UserProfile,
  UserPreferences,
} from '../services/supabase';
import {launchImageLibrary} from 'react-native-image-picker';
import {usePrefs, useThemedStyles} from '../theme/PreferencesContext';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/AppNavigator';

// -----------------------------------------------------------------------
// TYPES
// -----------------------------------------------------------------------
type SettingsScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'Settings'
>;

interface SectionHeaderProps {
  icon: ReactNode;
  title: string;
  right?: ReactNode;
}

interface NavRowProps {
  icon: ReactNode;
  label: string;
  sublabel?: string;
  onPress?: () => void;
  disabled?: boolean;
  external?: boolean;
  danger?: boolean;
}

interface ToggleRowProps {
  icon: ReactNode;
  label: string;
  sublabel?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

// -----------------------------------------------------------------------
// REUSABLE ROW COMPONENTS
// -----------------------------------------------------------------------
function SectionHeader({icon, title, right}: SectionHeaderProps) {
  const styles = useThemedStyles(getStyles);
  return (
    <View style={styles.sectionHeaderRow}>
      <View style={styles.sectionHeaderLeft}>
        {icon}
        <Text style={styles.sectionHeaderText}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

function NavRow({
  icon,
  label,
  sublabel,
  onPress,
  disabled,
  external,
  danger,
}: NavRowProps) {
  const styles = useThemedStyles(getStyles);
  return (
    <TouchableOpacity
      style={styles.navRow}
      activeOpacity={disabled ? 1 : 0.6}
      onPress={disabled ? undefined : onPress}>
      <View style={styles.navRowLeft}>
        <View style={styles.navIconWrap}>{icon}</View>
        <View>
          <Text
            style={[
              styles.navLabel,
              disabled && styles.disabledText,
              danger && styles.dangerText,
            ]}>
            {label}
          </Text>
          {sublabel ? (
            <Text style={[styles.navSublabel, disabled && styles.disabledText]}>
              {sublabel}
            </Text>
          ) : null}
        </View>
      </View>
      {external ? (
        <Feather name="external-link" size={18} color={colors.textMuted} />
      ) : (
        <Feather name="chevron-right" size={20} color={colors.textMuted} />
      )}
    </TouchableOpacity>
  );
}

function ToggleRow({
  icon,
  label,
  sublabel,
  value,
  onValueChange,
  disabled,
}: ToggleRowProps) {
  const styles = useThemedStyles(getStyles);
  return (
    <View style={styles.navRow}>
      <View style={styles.navRowLeft}>
        <View style={styles.navIconWrap}>{icon}</View>
        <View>
          <Text style={[styles.navLabel, disabled && styles.disabledText]}>
            {label}
          </Text>
          {sublabel ? (
            <Text style={[styles.navSublabel, disabled && styles.disabledText]}>
              {sublabel}
            </Text>
          ) : null}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{false: colors.switchTrackOff, true: colors.primary}}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

// -----------------------------------------------------------------------
// MAIN SCREEN
// -----------------------------------------------------------------------
export default function SettingsScreen({navigation}: SettingsScreenProps) {
  const styles = useThemedStyles(getStyles);
  const {prefs, updatePrefs} = usePrefs();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  // Two-Factor Authentication
  const [twoFactorOn, setTwoFactorOn] = useState<boolean>(false);
  const [showTwoFactorModal, setShowTwoFactorModal] = useState<boolean>(false);
  const [twoFactorSecret, setTwoFactorSecret] = useState<string | null>(null);
  const [twoFactorQr, setTwoFactorQr] = useState<string | null>(null);
  const [twoFactorFactorId, setTwoFactorFactorId] = useState<string | null>(
    null,
  );
  const [twoFactorCode, setTwoFactorCode] = useState<string>('');
  const [twoFactorBusy, setTwoFactorBusy] = useState<boolean>(false);

  // Blocked users
  const [showBlockedModal, setShowBlockedModal] = useState<boolean>(false);
  const [blockedUsers, setBlockedUsers] = useState<
    {
      id: string;
      full_name: string | null;
      handle: string | null;
      avatar_url: string | null;
    }[]
  >([]);
  const [blockedLoading, setBlockedLoading] = useState<boolean>(false);

  // Login history
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [loginEvents, setLoginEvents] = useState<
    {
      id: string;
      created_at: string;
      device: string | null;
      location: string | null;
    }[]
  >([]);
  const [loginLoading, setLoginLoading] = useState<boolean>(false);

  // Language
  const [showLanguageModal, setShowLanguageModal] = useState<boolean>(false);

  // Edit profile / change password modals
  const [showEditProfileModal, setShowEditProfileModal] =
    useState<boolean>(false);
  const [editName, setEditName] = useState<string>('');
  const [showChangePasswordModal, setShowChangePasswordModal] =
    useState<boolean>(false);
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');

  const loadProfile = useCallback(async () => {
    const data = await fetchUserProfile();
    if (data) {
      setProfile(data);
    }
    const factors = await listTwoFactorFactors();
    setTwoFactorOn(factors.some(f => f.status === 'verified'));
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProfile();

    const {data: authListener} = supabase.auth.onAuthStateChange(() => {
      loadProfile();
    });
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const persistPrefs = useCallback(
    async (next: UserPreferences) => {
      setSaving(true);
      await updatePrefs(next);
      setSaving(false);
    },
    [updatePrefs],
  );

  const [followers, setFollowers] = useState(0);
  const goal = 150;
  const progress = Math.min(followers / goal, 1);
  const hasEnoughFollowers = followers >= goal;

  useEffect(() => {
    (async () => {
      const user = await supabase.auth.getUser().then(r => r.data.user);
      if (user?.id) {
        const count = await getFollowerCount(user.id);
        setFollowers(count);
      }
    })();
  }, []);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await supabaseSignOut();
          navigation.replace('SignIn');
        },
      },
    ]);
  };

  const handleChangePassword = () => {
    setNewPassword('');
    setConfirmPassword('');
    setShowChangePasswordModal(true);
  };

  const submitChangePassword = async () => {
    if (newPassword.length < 6) {
      Alert.alert('Invalid', 'Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Invalid', 'Passwords do not match.');
      return;
    }
    setSaving(true);
    const {error} = await changePassword(newPassword);
    setSaving(false);
    setShowChangePasswordModal(false);
    if (error) {
      Alert.alert('Error', error);
    } else {
      Alert.alert('Success', 'Your password has been updated.');
    }
  };

  const handleEditProfile = () => {
    if (!profile) {
      return;
    }
    setEditName(profile.full_name ?? '');
    setShowEditProfileModal(true);
  };

  const submitEditProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Invalid', 'Name cannot be empty.');
      return;
    }
    setSaving(true);
    const {error} = await updateProfile({full_name: editName.trim()});
    setSaving(false);
    setShowEditProfileModal(false);
    if (error) {
      Alert.alert('Error', error);
    } else {
      setProfile(prev => (prev ? {...prev, full_name: editName.trim()} : prev));
      Alert.alert('Saved', 'Your profile has been updated.');
    }
  };

  const handleChangeAvatar = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      quality: 0.8,
    });
    const uri = result.assets?.[0]?.uri;
    if (!uri) {
      return;
    }
    setSaving(true);
    const {error} = await updateProfile({avatar_url: uri});
    setSaving(false);
    if (error) {
      Alert.alert('Error', error);
    } else if (profile) {
      setProfile(prev => (prev ? {...prev, avatar_url: uri} : prev));
    }
  };

  const handleTwoFactorToggle = async (value: boolean) => {
    if (value) {
      setTwoFactorBusy(true);
      const {error, qrCodeDataUrl, secret, factorId} = await enableTwoFactor();
      setTwoFactorBusy(false);
      if (error) {
        Alert.alert('2FA Unavailable', error);
        return;
      }
      setTwoFactorQr(qrCodeDataUrl ?? null);
      setTwoFactorSecret(secret ?? null);
      setTwoFactorFactorId(factorId ?? null);
      setTwoFactorCode('');
      setShowTwoFactorModal(true);
    } else {
      const factors = await listTwoFactorFactors();
      const active = factors.find(f => f.status === 'verified');
      if (active) {
        const {error} = await disableTwoFactor(active.id);
        if (error) {
          Alert.alert('Error', error);
          return;
        }
      }
      setTwoFactorOn(false);
      Alert.alert('Disabled', 'Two-factor authentication has been turned off.');
    }
  };

  const handleConfirmTwoFactor = async () => {
    if (!twoFactorFactorId || !twoFactorCode) {
      Alert.alert(
        'Code required',
        'Enter the 6-digit code from your authenticator app.',
      );
      return;
    }
    setTwoFactorBusy(true);
    const challenge = await supabase.auth.mfa.challenge({
      factorId: twoFactorFactorId,
    });
    if (challenge.error || !challenge.data) {
      setTwoFactorBusy(false);
      Alert.alert(
        'Error',
        challenge.error?.message ?? 'Could not start challenge.',
      );
      return;
    }
    const {error} = await supabase.auth.mfa.verify({
      factorId: twoFactorFactorId,
      challengeId: challenge.data.id,
      code: twoFactorCode,
    });
    setTwoFactorBusy(false);
    if (error) {
      Alert.alert('Invalid code', error.message);
      return;
    }
    setTwoFactorOn(true);
    setShowTwoFactorModal(false);
    Alert.alert('Enabled', 'Two-factor authentication is now active.');
  };

  const openBlockedUsers = async () => {
    setShowBlockedModal(true);
    setBlockedLoading(true);
    const list = await fetchBlockedUsers();
    setBlockedUsers(list);
    setBlockedLoading(false);
  };

  const handleUnblock = async (recordId: string) => {
    await unblockUser(recordId);
    setBlockedUsers(prev => prev.filter(b => b.id !== recordId));
  };

  const openLoginHistory = async () => {
    setShowLoginModal(true);
    setLoginLoading(true);
    const list = await fetchLoginHistory();
    setLoginEvents(list);
    setLoginLoading(false);
  };

  const handlePickLanguage = async (code: string) => {
    setShowLanguageModal(false);
    setSaving(true);
    await saveLanguage(code);
    await updatePrefs({...prefs, language: code});
    setSaving(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  const displayEmail = profile?.email || 'student@uniosun.edu.ng';
  const isAdmin = displayEmail === 'official.uniosun@edu.ng';
  const displayName =
    profile?.full_name ||
    (isAdmin ? 'Campus Admin (Official)' : 'UniOsun Student');
  const avatarSource = profile?.avatar_url ? {uri: profile.avatar_url} : null;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        {avatarSource ? (
          <Image source={avatarSource} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]} />
        )}
        <View style={styles.flexOne}>
          <Text style={styles.headerName}>{displayName}</Text>
          <Text style={styles.headerEmail}>{displayEmail}</Text>
        </View>
        {saving ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <TouchableOpacity onPress={loadProfile}>
            <Feather name="refresh-cw" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>App Settings</Text>
        <Text style={styles.subtitle}>
          Manage your account and customize your Pulse experience.
        </Text>

        {/* Verification & Milestone */}
        <SectionHeader
          icon={<Feather name="shield" size={16} color={colors.textPrimary} />}
          title="Verification & Milestone"
        />
        <View style={styles.verifyCard}>
          <View style={styles.verifyTopRow}>
            <Text style={styles.verifyKicker}>INSTITUTIONAL STATUS</Text>
            <View style={styles.verifyBadge}>
              <Text style={styles.verifyBadgeText}>
                {profile?.verified ? 'VERIFIED' : 'IN PROGRESS'}
              </Text>
            </View>
          </View>
          <Text style={styles.verifyMain}>
            {profile?.verified ? 'Verified Student' : 'Verification Pending'}
          </Text>
          <Text style={styles.verifySub}>
            {profile?.department
              ? `${profile.department}${
                  profile.matric_number ? ` • ${profile.matric_number}` : ''
                }`
              : 'Complete your profile to verify'}
          </Text>

          <View style={styles.verifyDivider} />

          <View style={styles.goalRow}>
            <Text style={styles.goalLabel}>Influencer Goal</Text>
            <Text style={styles.goalValue}>
              {followers} / {goal}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, {width: `${progress * 100}%`}]}
            />
          </View>
          <Text style={styles.goalHint}>
            Reach 150 followers to unlock the 'Official Influencer' badge.
          </Text>
        </View>

        <SectionHeader
          icon={<Feather name="shield" size={16} color={colors.textPrimary} />}
          title="Security"
        />
        <View style={styles.card}>
          <NavRow
            icon={
              <Feather name="camera" size={18} color={colors.textPrimary} />
            }
            label="Change Avatar"
            onPress={handleChangeAvatar}
          />
          <Divider />
          <NavRow
            icon={<Feather name="user" size={18} color={colors.textPrimary} />}
            label="Edit Profile"
            onPress={handleEditProfile}
          />
          <Divider />
          <NavRow
            icon={<Feather name="lock" size={18} color={colors.textPrimary} />}
            label="Change Password"
            onPress={handleChangePassword}
          />
          <Divider />
          <ToggleRow
            icon={
              <MaterialCommunityIcons
                name="cellphone-key"
                size={18}
                color={colors.textPrimary}
              />
            }
            label="Two-Factor Authentication"
            value={twoFactorOn}
            onValueChange={handleTwoFactorToggle}
            disabled={twoFactorBusy}
          />
          <Divider />
          <NavRow
            icon={<Feather name="clock" size={18} color={colors.textPrimary} />}
            label="Login History"
            onPress={openLoginHistory}
          />
        </View>

        {/* Privacy */}
        <SectionHeader
          icon={<Feather name="shield" size={16} color={colors.textPrimary} />}
          title="Privacy"
          right={
            <View style={styles.sectionHeaderRight}>
              <MaterialCommunityIcons
                name="cancel"
                size={14}
                color={colors.textMuted}
              />
              <Text style={styles.sectionHeaderRightText}>Blocked Users</Text>
              <Feather
                name="chevron-right"
                size={16}
                color={colors.textMuted}
              />
            </View>
          }
        />
        <View style={styles.card}>
          <ToggleRow
            icon={
              <MaterialCommunityIcons
                name="incognito"
                size={18}
                color={colors.textMuted}
              />
            }
            label="Anonymous Posting"
            sublabel={
              hasEnoughFollowers
                ? 'Post without showing your name'
                : 'Locked until you reach 150 followers'
            }
            value={hasEnoughFollowers ? prefs.anonymous_posting : false}
            disabled={!hasEnoughFollowers}
            onValueChange={v => persistPrefs({...prefs, anonymous_posting: v})}
          />
          <Divider />
          <ToggleRow
            icon={<Feather name="eye" size={18} color={colors.textPrimary} />}
            label="Public Profile Visibility"
            value={prefs.public_visibility}
            onValueChange={v => persistPrefs({...prefs, public_visibility: v})}
          />
          <Divider />
          <NavRow
            icon={
              <MaterialCommunityIcons
                name="cancel"
                size={18}
                color={colors.textPrimary}
              />
            }
            label="Blocked Users"
            onPress={openBlockedUsers}
          />
        </View>

        {/* Notifications */}
        <SectionHeader
          icon={<Feather name="bell" size={16} color={colors.textPrimary} />}
          title="Notifications"
        />
        <View style={styles.card}>
          <ToggleRow
            icon={<Feather name="rss" size={18} color={colors.primary} />}
            label="Campus Feed Alerts"
            value={prefs.campus_feed_alerts}
            onValueChange={v => persistPrefs({...prefs, campus_feed_alerts: v})}
          />
          <Divider />
          <ToggleRow
            icon={
              <MaterialCommunityIcons
                name="ballot-outline"
                size={18}
                color={colors.danger}
              />
            }
            label="Election Reminders"
            value={prefs.election_reminders}
            onValueChange={v => persistPrefs({...prefs, election_reminders: v})}
          />
          <Divider />
          <ToggleRow
            icon={<Feather name="volume-2" size={18} color={colors.primary} />}
            label="Administrative Broadcasts"
            value={prefs.admin_broadcasts}
            onValueChange={v => persistPrefs({...prefs, admin_broadcasts: v})}
          />
        </View>

        {/* App Preferences */}
        <SectionHeader
          icon={
            <Feather name="settings" size={16} color={colors.textPrimary} />
          }
          title="App Preferences"
          right={
            <View style={styles.sectionHeaderRight}>
              <Feather name="refresh-cw" size={14} color={colors.textMuted} />
              <Text style={styles.sectionHeaderRightText}>Data Usage</Text>
              <Feather
                name="chevron-right"
                size={16}
                color={colors.textMuted}
              />
            </View>
          }
        />
        <View style={styles.card}>
          <ToggleRow
            icon={<Feather name="moon" size={18} color={colors.textPrimary} />}
            label="Dark Mode"
            value={prefs.dark_mode}
            onValueChange={v => persistPrefs({...prefs, dark_mode: v})}
          />
          <Divider />
          <NavRow
            icon={<Feather name="globe" size={18} color={colors.textPrimary} />}
            label="Language"
            sublabel={getLanguageLabel(prefs.language)}
            onPress={() => setShowLanguageModal(true)}
          />
          <Divider />

          {/* Text size */}
          <View style={styles.navRow}>
            <View style={styles.navRowLeft}>
              <View style={styles.navIconWrap}>
                <MaterialCommunityIcons
                  name="format-size"
                  size={18}
                  color={colors.textPrimary}
                />
              </View>
              <Text style={styles.navLabel}>Text Size</Text>
            </View>
          </View>
          <View style={styles.textSizeRow}>
            <Text style={styles.textSizeGlyphSmall}>A</Text>
            <Slider
              style={styles.sliderStyle}
              minimumValue={0}
              maximumValue={2}
              step={1}
              value={prefs.text_size}
              onValueChange={v => persistPrefs({...prefs, text_size: v})}
              minimumTrackTintColor={colors.primary}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.primary}
            />
            <Text style={styles.textSizeGlyphLarge}>AAA</Text>
          </View>

          <Divider />
          <NavRow
            icon={
              <Feather name="refresh-cw" size={18} color={colors.textPrimary} />
            }
            label="Data Usage"
            sublabel="Images cached • Tap to clear"
            onPress={() =>
              Alert.alert(
                'Data Usage',
                'Cached media helps Pulse load faster. Clear the cache to free up storage?',
                [
                  {text: 'Cancel', style: 'cancel'},
                  {
                    text: 'Clear Cache',
                    onPress: () =>
                      Alert.alert('Cleared', 'Cache cleared successfully.'),
                  },
                ],
              )
            }
          />
        </View>

        {/* Help / About */}
        <View style={styles.card}>
          <NavRow
            icon={
              <Feather
                name="help-circle"
                size={18}
                color={colors.textPrimary}
              />
            }
            label="Help Center"
            onPress={() => {}}
            external
          />
          <Divider />
          <NavRow
            icon={
              <Feather
                name="alert-circle"
                size={18}
                color={colors.textPrimary}
              />
            }
            label="Report a Problem"
            onPress={() => {}}
          />
          <Divider />
          <NavRow
            icon={
              <MaterialCommunityIcons
                name="file-document-outline"
                size={18}
                color={colors.textPrimary}
              />
            }
            label="Terms of Service"
            onPress={() => {}}
          />
          <Divider />
          <NavRow
            icon={<Feather name="info" size={18} color={colors.textPrimary} />}
            label="About UniOsun Pulse"
            sublabel="v2.4.1 (Academy Edition)"
            onPress={() => {}}
          />
        </View>

        {/* Sign Out */}
        <TouchableOpacity
          style={styles.signOutButton}
          activeOpacity={0.7}
          onPress={handleSignOut}>
          <Feather name="log-out" size={18} color={colors.danger} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.footerText}>UniOsun Pulse v2.4.1 (Stable)</Text>
        <Text style={styles.footerSub}>
          MADE FOR OSOGBO • IKIRE • IPETU-IJESA • EJIGBO • IFETEDO • OKUKU
        </Text>
      </ScrollView>

      {/* Two-Factor Authentication setup modal */}
      <Modal
        visible={showTwoFactorModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTwoFactorModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Set up Two-Factor</Text>
            <Text style={styles.modalText}>
              Scan this QR code with an authenticator app (Google Authenticator,
              Authy, etc.), then enter the 6-digit code.
            </Text>
            {twoFactorQr ? (
              <Image
                source={{uri: twoFactorQr}}
                style={styles.qrImage}
                resizeMode="contain"
              />
            ) : null}
            {twoFactorSecret ? (
              <Text style={styles.modalSecret}>
                Manual key: {twoFactorSecret}
              </Text>
            ) : null}
            <TextInput
              style={styles.modalInput}
              placeholder="123456"
              keyboardType="number-pad"
              maxLength={6}
              value={twoFactorCode}
              onChangeText={setTwoFactorCode}
            />
            <AppButtonWide
              label="Confirm & Enable"
              loading={twoFactorBusy}
              onPress={handleConfirmTwoFactor}
            />
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setShowTwoFactorModal(false)}>
              <Text style={styles.modalCloseBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Blocked users modal */}
      <Modal
        visible={showBlockedModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBlockedModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Blocked Users</Text>
            {blockedLoading ? (
              <ActivityIndicator
                style={styles.loadingWrap}
                color={colors.primary}
              />
            ) : blockedUsers.length === 0 ? (
              <Text style={styles.modalText}>
                You haven't blocked anyone yet.
              </Text>
            ) : (
              <FlatList
                data={blockedUsers}
                keyExtractor={item => item.id}
                style={styles.flatListTall}
                renderItem={({item}) => (
                  <View style={styles.blockedRow}>
                    <Image
                      source={{
                        uri: item.avatar_url || '',
                      }}
                      style={styles.blockedAvatar}
                    />
                    <View style={{flex: 1}}>
                      <Text style={styles.blockedName}>
                        {item.full_name || 'Unknown user'}
                      </Text>
                      {item.handle ? (
                        <Text style={styles.blockedHandle}>{item.handle}</Text>
                      ) : null}
                    </View>
                    <TouchableOpacity onPress={() => handleUnblock(item.id)}>
                      <Text style={styles.unblockText}>Unblock</Text>
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setShowBlockedModal(false)}>
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Login history modal */}
      <Modal
        visible={showLoginModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLoginModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Login History</Text>
            {loginLoading ? (
              <ActivityIndicator
                style={styles.loadingWrap}
                color={colors.primary}
              />
            ) : loginEvents.length === 0 ? (
              <Text style={styles.modalText}>
                No login activity recorded yet.
              </Text>
            ) : (
              <FlatList
                data={loginEvents}
                keyExtractor={item => item.id}
                style={styles.flatListTall}
                renderItem={({item}) => (
                  <View style={styles.loginRow}>
                    <View
                      style={[
                        styles.loginDot,
                        {
                          backgroundColor: item.device
                            ? colors.primary
                            : colors.textMuted,
                        },
                      ]}
                    />
                    <View style={styles.flexOne}>
                      <Text style={styles.loginDevice}>
                        {item.device || 'This device'}
                      </Text>
                      <Text style={styles.loginMeta}>
                        {item.location || 'Unknown location'} •{' '}
                        {new Date(item.created_at).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                )}
              />
            )}
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setShowLoginModal(false)}>
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit Profile modal */}
      <Modal
        visible={showEditProfileModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditProfileModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <Text style={styles.modalText}>Update your display name.</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Display name"
              value={editName}
              onChangeText={setEditName}
              autoFocus
            />
            <AppButtonWide
              label="Save"
              loading={saving}
              onPress={submitEditProfile}
            />
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setShowEditProfileModal(false)}>
              <Text style={styles.modalCloseBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Change Password modal */}
      <Modal
        visible={showChangePasswordModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowChangePasswordModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Change Password</Text>
            <Text style={styles.modalText}>
              Enter a new password (min 6 characters).
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="New password"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <TextInput
              style={[styles.modalInput, styles.confirmPasswordMargin]}
              placeholder="Confirm password"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            <AppButtonWide
              label="Update Password"
              loading={saving}
              onPress={submitChangePassword}
            />
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setShowChangePasswordModal(false)}>
              <Text style={styles.modalCloseBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Language picker modal */}
      <Modal
        visible={showLanguageModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLanguageModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Language</Text>
            <FlatList
              data={[...SUPPORTED_LANGUAGES]}
              keyExtractor={item => item.code}
              renderItem={({item}) => (
                <TouchableOpacity
                  style={styles.langItem}
                  onPress={() => handlePickLanguage(item.code)}>
                  <Text style={styles.langItemText}>{item.label}</Text>
                  {prefs.language === item.code && (
                    <Feather name="check" size={18} color={colors.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setShowLanguageModal(false)}>
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function AppButtonWide({
  label,
  loading,
  onPress,
}: {
  label: string;
  loading?: boolean;
  onPress: () => void;
}) {
  const styles = useThemedStyles(getStyles);
  return (
    <TouchableOpacity
      style={[styles.wideButton, loading && styles.wideButtonDisabled]}
      activeOpacity={0.7}
      disabled={loading}
      onPress={onPress}>
      {loading ? (
        <ActivityIndicator color={colors.white} />
      ) : (
        <Text style={styles.wideButtonText}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

function Divider() {
  const styles = useThemedStyles(getStyles);
  return <View style={styles.divider} />;
}

// -----------------------------------------------------------------------
// STYLES
// -----------------------------------------------------------------------
const getStyles = () =>
  StyleSheet.create({
    safe: {flex: 1, backgroundColor: colors.background},
    center: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.background,
      gap: 12,
    },
    avatar: {width: 36, height: 36, borderRadius: 18},
    avatarFallback: {backgroundColor: colors.border},
    headerName: {fontSize: 15, fontWeight: '700', color: colors.textPrimary},
    headerEmail: {fontSize: 12, color: colors.textSecondary},

    scrollContent: {paddingHorizontal: 16, paddingBottom: 24},
    title: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.textPrimary,
      marginTop: 4,
    },
    subtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 4,
      marginBottom: 16,
    },

    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
      marginTop: 18,
    },
    sectionHeaderLeft: {flexDirection: 'row', alignItems: 'center', gap: 6},
    sectionHeaderText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    sectionHeaderRight: {flexDirection: 'row', alignItems: 'center', gap: 4},
    sectionHeaderRightText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary,
    },

    verifyCard: {
      backgroundColor: colors.primary,
      borderRadius: 16,
      padding: 16,
    },
    verifyTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    verifyKicker: {
      color: colors.verifyText,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    verifyBadge: {
      backgroundColor: colors.verifyBadgeBg,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 12,
    },
    verifyBadgeText: {color: colors.white, fontSize: 10, fontWeight: '700'},
    verifyMain: {
      color: colors.white,
      fontSize: 20,
      fontWeight: '800',
      marginTop: 8,
    },
    verifySub: {color: colors.verifyText, fontSize: 12, marginTop: 2},
    verifyDivider: {
      height: 1,
      backgroundColor: colors.verifyDivider,
      marginVertical: 14,
    },
    goalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    goalLabel: {color: colors.white, fontSize: 13, fontWeight: '600'},
    goalValue: {color: colors.white, fontSize: 13, fontWeight: '700'},
    progressTrack: {
      height: 6,
      backgroundColor: colors.verifyDivider,
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.white,
      borderRadius: 3,
    },
    goalHint: {
      color: colors.verifyText,
      fontSize: 11,
      marginTop: 10,
      lineHeight: 15,
    },

    card: {
      backgroundColor: colors.card,
      borderRadius: 14,
      overflow: 'hidden',
    },
    navRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 14,
    },
    navRowLeft: {flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1},
    navIconWrap: {width: 20, alignItems: 'center'},
    navLabel: {fontSize: 14, fontWeight: '600', color: colors.textPrimary},
    navSublabel: {fontSize: 11, color: colors.textSecondary, marginTop: 2},
    disabledText: {color: colors.textMuted},
    divider: {height: 1, backgroundColor: colors.border, marginLeft: 46},

    dangerText: {color: colors.danger},
    flexOne: {flex: 1},
    sliderStyle: {flex: 1, marginHorizontal: 10},
    loadingWrap: {marginVertical: 20},
    flatListTall: {maxHeight: 320},
    confirmPasswordMargin: {marginTop: 10},

    textSizeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingBottom: 14,
    },
    textSizeGlyphSmall: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '600',
    },
    textSizeGlyphLarge: {
      fontSize: 16,
      color: colors.textPrimary,
      fontWeight: '700',
    },

    signOutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.danger,
      borderRadius: 12,
      paddingVertical: 14,
      marginTop: 20,
      backgroundColor: colors.card,
    },
    signOutText: {color: colors.danger, fontSize: 15, fontWeight: '700'},

    footerText: {
      textAlign: 'center',
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 18,
    },
    footerSub: {
      textAlign: 'center',
      fontSize: 9,
      color: colors.textMuted,
      marginTop: 4,
      letterSpacing: 0.3,
    },

    modalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
      maxHeight: '85%',
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 12,
    },
    modalText: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 19,
      marginBottom: 12,
    },
    modalSecret: {
      fontSize: 12,
      color: colors.textSecondary,
      fontFamily: Platform.select({ios: 'Courier', android: 'monospace'}),
      marginBottom: 12,
    },
    qrImage: {width: 200, height: 200, alignSelf: 'center', marginVertical: 8},
    modalInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.textPrimary,
      marginBottom: 14,
      textAlign: 'center',
    },
    wideButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },
    wideButtonDisabled: {opacity: 0.6},
    wideButtonText: {color: colors.white, fontSize: 15, fontWeight: '700'},
    modalCloseBtn: {
      marginTop: 12,
      paddingVertical: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
    },
    modalCloseBtnText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    blockedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    blockedAvatar: {width: 36, height: 36, borderRadius: 18},
    blockedName: {fontSize: 14, fontWeight: '600', color: colors.textPrimary},
    blockedHandle: {fontSize: 12, color: colors.textSecondary},
    unblockText: {color: colors.danger, fontWeight: '700', fontSize: 13},
    loginRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    loginDot: {width: 10, height: 10, borderRadius: 5},
    loginDevice: {fontSize: 14, fontWeight: '600', color: colors.textPrimary},
    loginMeta: {fontSize: 12, color: colors.textSecondary, marginTop: 2},
    langItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    langItemText: {fontSize: 15, color: colors.textPrimary},
  });
