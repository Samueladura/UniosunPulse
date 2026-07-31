import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import {colors, radius, spacing, typography} from '../theme/colors.ts';
import {postCategories} from '../data/mockData';
import {fetchUserProfile, UserProfile} from '../services/supabase';
import {usePosts} from '../context/PostsContext';
import {useNavigation} from '@react-navigation/native';
import {type NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/AppNavigator';
import {launchImageLibrary} from 'react-native-image-picker';

type Props = NativeStackScreenProps<RootStackParamList, 'NewPost'>;

export default function NewPostScreen({}: Props) {
  const [text, setText] = useState('');
  const [category, setCategory] = useState('Announcements');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const {addPost} = usePosts();
  const navigation = useNavigation();

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await fetchUserProfile();
      if (active && res) {
        setProfile(res);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const displayName = profile?.full_name || 'Ayo Balogun';
  const avatarUrl = profile?.avatar_url || 'https://i.pravatar.cc/100?img=14';
  const verifiedBadgeVisible =
    profile?.verified || profile?.email === 'babayemiayomide87@gmail.com';

  const handlePost = async () => {
    if (!text.trim() || !profile) {
      return;
    }

    const trimmed = text.trim();
    setSaving(true);
    setError(null);

    try {
      await addPost({
        title: trimmed,
        body: trimmed,
        image: imageUri || undefined,
        tag: category.toUpperCase(),
        author: displayName,
        avatar: avatarUrl,
        author_id: profile.id,
        author_name: profile.full_name ?? 'Anonymous',
        likeCount: 0,
        comments: 0,
      });

      setText('');
      setCategory('Announcements');
      setImageUri(null);
      navigation.goBack();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create post. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handlePickImage = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      quality: 0.8,
    });
    const asset = result.assets?.[0];
    if (asset?.uri) {
      setImageUri(asset.uri);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerLeft}
          onPress={() => navigation.goBack()}>
          <Icon name="x" size={18} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Post</Text>
        <TouchableOpacity
          style={[
            styles.postBtn,
            (!text.trim() || saving) && styles.postBtnDisabled,
          ]}
          disabled={!text.trim() || saving}
          onPress={handlePost}>
          <Text style={styles.postBtnText}>
            {saving ? 'Posting...' : 'Post'}
          </Text>
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.content}>
        <View style={styles.userRow}>
          <View>
            <Image source={{uri: avatarUrl}} style={styles.avatar} />
            {verifiedBadgeVisible && (
              <View style={styles.verifiedBadge}>
                <Icon
                  name="check-circle"
                  size={14}
                  color={colors.verifiedBadge}
                />
              </View>
            )}
          </View>
          <View>
            <Text style={styles.userName}>{displayName}</Text>
          </View>
        </View>

        <TextInput
          style={styles.textArea}
          placeholder="What's happening on campus?"
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={500}
          value={text}
          onChangeText={setText}
        />

        {imageUri ? (
          <View style={styles.imagePreviewWrap}>
            <Image source={{uri: imageUri}} style={styles.imagePreview} />
            <TouchableOpacity
              style={styles.removeImageBtn}
              onPress={() => setImageUri(null)}>
              <Icon name="x" size={16} color={colors.white} />
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.spacer} />

        <Text style={styles.sectionLabel}>SELECT CATEGORY</Text>
        <View style={styles.categoryRow}>
          {postCategories.map(cat => {
            const active = cat === category;
            return (
              <TouchableOpacity
                key={cat}
                onPress={() => setCategory(cat)}
                style={[
                  styles.categoryChip,
                  active && styles.categoryChipActive,
                ]}>
                <Text
                  style={[
                    styles.categoryChipText,
                    active && styles.categoryChipTextActive,
                  ]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.toolbar}>
        <View style={styles.toolbarLeft}>
          <TouchableOpacity style={styles.toolIcon} onPress={handlePickImage}>
            <Icon name="image" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolIcon}>
            <Icon name="bar-chart-2" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolIcon}>
            <Icon name="link" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <Text style={styles.charCount}>{text.length} / 500</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.background},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {flexDirection: 'row', alignItems: 'center', gap: 4},
  cancelText: {fontSize: 15, fontWeight: '600', color: colors.textPrimary},
  headerTitle: {fontSize: 17, fontWeight: '800', color: colors.primary},
  postBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  postBtnDisabled: {backgroundColor: colors.accent, opacity: 0.6},
  postBtnText: {color: colors.white, fontWeight: '700', fontSize: 14},
  errorBanner: {
    backgroundColor: colors.danger,
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  errorText: {color: colors.white, fontSize: 13, fontWeight: '600'},
  content: {flex: 1, padding: spacing.md},
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  avatar: {width: 48, height: 48, borderRadius: 24},
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: colors.white,
    borderRadius: 10,
  },
  userName: {fontSize: 16, fontWeight: '700', color: colors.textPrimary},
  userMeta: {fontSize: 13, color: colors.textSecondary},
  textArea: {
    fontSize: 17,
    color: colors.textPrimary,
    minHeight: 160,
    textAlignVertical: 'top',
  },
  spacer: {flex: 1},
  sectionLabel: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  imagePreviewWrap: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: radius.md,
  },
  removeImageBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.danger,
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  categoryChipTextActive: {color: colors.white},
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  toolbarLeft: {flexDirection: 'row', gap: spacing.lg},
  toolIcon: {padding: 4},
  charCount: {fontSize: 13, color: colors.textMuted},
});
