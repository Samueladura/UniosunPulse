import React, {useMemo, useEffect, useState} from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import PostMedia from '../components/PostMedia';
import {colors, radius, spacing, typography} from '../theme/colors.ts';
import {
  fetchUserProfile,
  fetchUserProfileById,
  fetchPosts,
  getFollowerCount,
  getFollowingCount,
  isFollowing,
  followUser,
  unfollowUser,
  UserProfile,
  deletePost,
} from '../services/backend';
import {backend} from '../services/backend';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'UserProfile'>;

function formatCount(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return `${value}`;
}

interface ViewableUser {
  id: string;
  name: string;
  handle: string;
  avatar: string | number;
  bio: string;
  followers: number;
  following: number;
}

export default function UserProfileScreen({navigation, route}: Props) {
  const requestId = route.params?.userId || 'current';
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [followersCount, setFollowersCount] = useState<number>(0);
  const [followingCount, setFollowingCount] = useState<number>(0);
  const [isFollowingAuthor, setIsFollowingAuthor] = useState<boolean>(false);
  const [userPosts, setUserPosts] = useState<
    {
      id: string;
      title: string;
      body: string;
      image: string | null;
      video: string | null;
      likes: string;
      comments: number;
    }[]
  >([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (requestId === 'current') {
        const res = await fetchUserProfile();
        if (active) {
          setProfile(res);
        }
        if (res?.id) {
          const fCount = await getFollowerCount(res.id);
          const fgCount = await getFollowingCount(res.id);
          if (active) {
            setFollowersCount(fCount);
            setFollowingCount(fgCount);
          }
        }
      } else {
        const fetched = await fetchUserProfileById(requestId);
        if (active) {
          setProfile(fetched);
        }
        if (fetched?.id) {
          const fCount = await getFollowerCount(fetched.id);
          const fgCount = await getFollowingCount(fetched.id);
          if (active) {
            setFollowersCount(fCount);
            setFollowingCount(fgCount);
          }
          const posts = await fetchPosts();
          if (active) {
            setUserPosts(
              posts
                .filter(p => p.author_id === requestId)
                .map(p => ({
                  id: p.id,
                  title: p.title,
                  body: p.body || '',
                  image: p.image,
                  video: p.video || null,
                  likes: formatCount(p.like_count),
                  comments: p.comment_count,
                })),
            );
          }
        }
      }
      const {
        data: {user},
      } = await backend.auth.getUser();
      if (active && user) {
        setCurrentUserId(user.id);
      }
      if (active) {
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [requestId]);

  useEffect(() => {
    if (!profile || requestId === 'current') {
      return;
    }
    (async () => {
      const fetched = await isFollowing(requestId);
      setIsFollowingAuthor(fetched);
    })();
  }, [profile, requestId]);

  const resolvedUser = useMemo<ViewableUser | null>(() => {
    if (profile) {
      const isAdmin = profile.email === 'official.uniosun@edu.ng';
      const isBabayemi = profile.email === 'babayemiayomide87@gmail.com';
      const rawName = profile.full_name;
      const safeName = rawName
        ? rawName.trim()
        : isBabayemi
        ? 'Babayemi Ayomide'
        : isAdmin
        ? 'Campus Admin (Official)'
        : 'UniOsun Student';
      return {
        id: profile.id,
        name: safeName,
        handle: '@student',
        avatar: profile.avatar_url || '',
        bio: isAdmin ? 'Campus Admin' : 'UniOsun Student',
        followers: isBabayemi ? 300 : followersCount,
        following: followingCount,
      };
    }
    return {
      id: requestId,
      name: 'Unknown User',
      handle: '@unknown',
      avatar: '',
      bio: '',
      followers: followersCount,
      following: followingCount,
    };
  }, [profile, requestId, followersCount, followingCount]);

  const displayPosts = useMemo(() => {
    return userPosts;
  }, [userPosts]);

  const handleFollowToggle = async () => {
    if (requestId === 'current') {
      return;
    }
    try {
      if (isFollowingAuthor) {
        await unfollowUser(requestId);
        setIsFollowingAuthor(false);
        setFollowersCount(prev => prev - 1);
      } else {
        await followUser(requestId);
        setIsFollowingAuthor(true);
        setFollowersCount(prev => prev + 1);
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Unable to follow user');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Icon name="arrow-left" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.spacerWidth22} />
        </View>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!resolvedUser) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Icon name="arrow-left" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.spacerWidth22} />
        </View>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>User not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <Icon name="arrow-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{resolvedUser.name}</Text>
        <TouchableOpacity hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <Icon name="more-vertical" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.flexOne}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.profileSection}>
          {resolvedUser.avatar ? (
            <Image
              source={
                typeof resolvedUser.avatar === 'number'
                  ? resolvedUser.avatar
                  : {uri: resolvedUser.avatar}
              }
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]} />
          )}
          <View style={styles.nameRow}>
            <Text style={styles.name}>{resolvedUser.name}</Text>
            {(profile?.verified ||
              profile?.email === 'babayemiayomide87@gmail.com') && (
              <Icon
                name="check-circle"
                size={20}
                color={colors.verifiedBadge}
              />
            )}
          </View>
          <Text style={styles.handle}>{resolvedUser.handle}</Text>
          <Text style={styles.bio}>{resolvedUser.bio}</Text>

          <View style={styles.statsRow}>
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>
                {formatCount(displayPosts.length)}
              </Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>
                {formatCount(resolvedUser.followers)}
              </Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>
                {formatCount(resolvedUser.following)}
              </Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
          </View>

          {requestId !== 'current' && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  isFollowingAuthor
                    ? styles.actionBtnOutline
                    : styles.actionBtnPrimary,
                ]}
                onPress={handleFollowToggle}>
                <Text
                  style={[
                    isFollowingAuthor
                      ? styles.actionBtnTextOutline
                      : styles.actionBtnTextPrimary,
                  ]}>
                  {isFollowingAuthor ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.postsSection}>
          <Text style={styles.postsTitle}>Posts</Text>
          {displayPosts.length === 0 ? (
            <Text style={styles.emptyPostText}>No posts yet.</Text>
          ) : (
            displayPosts.map(post => (
              <TouchableOpacity
                key={post.id}
                style={styles.postCard}
                activeOpacity={0.9}
                onPress={() =>
                  navigation.navigate('PostDetail', {
                    post: {...post, authorId: resolvedUser.id},
                  })
                }>
                <Text style={styles.postCardBody} numberOfLines={2}>
                  {post.body}
                </Text>
                <PostMedia image={post.image} video={post.video} />
                <View style={styles.postCardFooter}>
                  <View style={styles.postCardFooterLeft}>
                    <Icon name="heart" size={16} color={colors.textSecondary} />
                    <Text style={styles.postCardFooterText}>{post.likes}</Text>
                  </View>
                  <View style={styles.postCardFooterLeft}>
                    <Icon
                      name="message-circle"
                      size={16}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.postCardFooterText}>
                      {post.comments}
                    </Text>
                  </View>
                  {currentUserId === resolvedUser.id && (
                    <TouchableOpacity
                      onPress={() => {
                        Alert.alert(
                          'Delete Post',
                          'Permanently remove this post?',
                          [
                            {text: 'Cancel', style: 'cancel'},
                            {
                              text: 'Delete',
                              style: 'destructive',
                              onPress: async () => {
                                await deletePost(post.id);
                                setUserPosts(prev =>
                                  prev.filter(p => p.id !== post.id),
                                );
                              },
                            },
                          ],
                        );
                      }}>
                      <Icon name="trash-2" size={16} color={colors.danger} />
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  spacerWidth22: {width: 22},
  flexOne: {flex: 1},

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
  headerTitle: {fontSize: 17, fontWeight: '800', color: colors.textPrimary},
  scrollContent: {paddingBottom: 160},
  profileSection: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: colors.border,
  },
  avatarFallback: {backgroundColor: colors.border},
  name: {fontSize: 20, fontWeight: '800', color: colors.textPrimary},
  nameRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  handle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  bio: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statBlock: {alignItems: 'center'},
  statValue: {fontSize: 18, fontWeight: '800', color: colors.textPrimary},
  statLabel: {fontSize: 12, color: colors.textSecondary, marginTop: 2},
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    width: '100%',
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.pill,
    alignItems: 'center',
    borderWidth: 1,
  },
  actionBtnPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  actionBtnTextPrimary: {color: colors.white, fontWeight: '700', fontSize: 14},
  actionBtnOutline: {
    backgroundColor: colors.card,
    borderColor: colors.border,
  },
  actionBtnTextOutline: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  postsSection: {
    padding: spacing.md,
    paddingBottom: 160,
  },
  postsTitle: {
    ...typography.h3,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  emptyPostText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  postCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: {width: 0, height: 2},
  },
  postCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  postCardBody: {
    fontSize: 13.5,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  postCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  postCardFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  postCardFooterText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {fontSize: 16, color: colors.textMuted},
});
