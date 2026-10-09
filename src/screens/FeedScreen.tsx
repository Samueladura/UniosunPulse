import React, {useState, useEffect, useCallback} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {Alert, Modal, TextInput} from 'react-native';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  RefreshControl,
  Image,
  TouchableOpacity,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import PostMedia from '../components/PostMedia';
import {colors, radius, spacing, typography} from '../theme/colors.ts';
import {useThemedStyles} from '../theme/PreferencesContext';
import {usePosts, PostWithMeta} from '../context/PostsContext';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
  backend,
  fetchComments,
} from '../services/backend';
import type {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
import type {
  MainTabParamList,
  RootStackParamList,
} from '../navigation/AppNavigator';

type Props = BottomTabScreenProps<MainTabParamList, 'Feed'>;

const FILTERS = ['All', 'Announcements', 'Academics', 'Campus Life'];

const TAG_COLORS: Record<string, string> = {
  ANNOUNCEMENTS: colors.tagAnnouncements,
  ACADEMICS: colors.tagAnnouncements,
  'CAMPUS LIFE': colors.tagCampusLife,
  EVENTS: colors.tagEvents,
  EMERGENCY: colors.tagEmergency,
  BROADCAST: colors.tagBroadcast,
};

const FILTER_TAG_MAP: Record<string, string> = {
  All: 'ALL',
  Announcements: 'ANNOUNCEMENTS',
  Academics: 'ACADEMICS',
  'Campus Life': 'CAMPUS LIFE',
};

function formatCount(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return `${value}`;
}

interface LocalComment {
  id: string;
  user_id: string;
  name: string;
  body: string;
  time: string;
}

export default function FeedScreen({navigation}: Props) {
  const styles = useThemedStyles(getStyles);
  const {
    posts,
    loading,
    loadingMore,
    feedError,
    toggleLike,
    addComment,
    removeComment,
    refreshFeed,
    loadMorePosts,
  } = usePosts();
  const rootNav =
    navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  const [activeFilter, setActiveFilter] = useState('All');
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<Record<string, LocalComment[]>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const filterTag = FILTER_TAG_MAP[activeFilter] ?? 'ALL';

  useEffect(() => {
    (async () => {
      const {
        data: {user},
      } = await backend.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshFeed(filterTag);
    }, [filterTag, refreshFeed]),
  );

  const loadComments = useCallback(async (postId: string) => {
    try {
      const rows = await fetchComments(postId);
      const mapped: LocalComment[] = rows.map(r => ({
        id: r.id,
        user_id: r.user_id,
        name: r.author_name || 'Anonymous',
        body: r.body,
        time: new Date(r.created_at).toLocaleString(),
      }));
      setComments(prev => ({...prev, [postId]: mapped}));
    } catch {
      setComments(prev => ({...prev, [postId]: []}));
    }
  }, []);

  const handleOpenComments = (id: string) => {
    setCommentPostId(id);
    if (!comments[id]) {
      loadComments(id);
    }
  };

  const submitComment = async () => {
    const text = commentText.trim();
    if (!text || !commentPostId) {
      return;
    }
    try {
      const saved = await addComment(commentPostId, text);
      const localComment: LocalComment = {
        id: saved.id,
        user_id: saved.user_id,
        name: saved.author_name || 'You',
        body: saved.body,
        time: new Date(saved.created_at).toLocaleString(),
      };
      setComments(current => ({
        ...current,
        [commentPostId]: [...(current[commentPostId] ?? []), localComment],
      }));
      setCommentText('');
    } catch (error) {
      Alert.alert(
        'Comment could not be sent',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  };

  const sharePost = (post: PostWithMeta) => {
    Alert.alert('Share', `Share "${post.title}" with your network.`);
  };

  const activePost = posts.find(post => post.id === commentPostId) ?? null;
  const postComments = commentPostId ? comments[commentPostId] ?? [] : [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <View style={styles.logoBadgeCircle}>
            <Image
              source={require('../assets/uniosun-logo.png')}
              style={styles.logoBadgeImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.topBarTitle}>UniOsun Pulse</Text>
        </View>
        <View style={styles.topBarActions}>
          <TouchableOpacity onPress={() => rootNav?.navigate('Search')}>
            <Icon name="search" size={22} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => rootNav?.navigate('Saved')}>
            <Icon name="bookmark" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.quickLinks}>
        {[
          {label: 'Events', icon: 'calendar', route: 'Events' as const},
          {
            label: 'Marketplace',
            icon: 'shopping-bag',
            route: 'Marketplace' as const,
          },
          {label: 'Career', icon: 'briefcase', route: 'CareerBoard' as const},
          {label: 'Clubs', icon: 'users', route: 'Clubs' as const},
        ].map(link => (
          <TouchableOpacity
            key={link.route}
            style={styles.quickLink}
            onPress={() => rootNav?.navigate(link.route)}>
            <Icon name={link.icon} size={14} color={colors.primary} />
            <Text style={styles.quickLinkText}>{link.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.filterWrapper}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTERS}
          keyExtractor={item => item}
          contentContainerStyle={styles.filterScroll}
          renderItem={({item}) => {
            const active = item === activeFilter;
            return (
              <TouchableOpacity
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setActiveFilter(item)}
                activeOpacity={0.8}>
                <Text
                  style={[
                    styles.filterChipText,
                    active && styles.filterChipTextActive,
                  ]}>
                  {item}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <FlatList
        data={posts}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void refreshFeed(filterTag)}
          />
        }
        onEndReached={() => void loadMorePosts()}
        onEndReachedThreshold={0.45}
        ListHeaderComponent={
          feedError ? <Text style={styles.feedError}>{feedError}</Text> : null
        }
        ListEmptyComponent={
          loading ? (
            <Text style={styles.feedEmpty}>Loading posts…</Text>
          ) : (
            <Text style={styles.feedEmpty}>
              {feedError
                ? 'Pull down to retry.'
                : 'No posts in this category yet.'}
            </Text>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <Text style={styles.feedEmpty}>Loading more posts…</Text>
          ) : null
        }
        renderItem={({item}) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.9}
            onPress={() =>
              navigation.getParent()?.navigate('PostDetail', {post: item})
            }>
            <View style={styles.cardHeader}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() =>
                  navigation
                    .getParent()
                    ?.navigate('UserProfile', {userId: item.author_id})
                }>
                {item.author_id === 'admin_official' ? (
                  <Image
                    source={require('../assets/uniosun-logo.png')}
                    style={styles.avatar}
                  />
                ) : item.avatar ? (
                  <Image source={{uri: item.avatar}} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]} />
                )}
              </TouchableOpacity>
              <View style={styles.cardHeaderCenter}>
                <Text style={styles.author}>{item.author}</Text>
                <Text style={styles.time}>{item.time}</Text>
              </View>
              <View
                style={[
                  styles.tag,
                  {backgroundColor: TAG_COLORS[item.tag] ?? colors.background},
                ]}>
                <Text
                  style={[
                    styles.tagText,
                    {
                      color:
                        item.tag === 'ANNOUNCEMENTS' || item.tag === 'ACADEMICS'
                          ? colors.primary
                          : item.tag === 'CAMPUS LIFE'
                          ? colors.tagCampusLifeText
                          : item.tag === 'EVENTS'
                          ? colors.tagEventsText
                          : item.tag === 'EMERGENCY'
                          ? colors.tagEmergencyText
                          : item.tag === 'BROADCAST'
                          ? colors.tagBroadcastText
                          : colors.primary,
                    },
                  ]}>
                  {item.tag}
                </Text>
              </View>
            </View>

            <Text style={styles.postTitle}>{item.title}</Text>
            <Text style={styles.postBody}>{item.body}</Text>

            <PostMedia image={item.image} video={item.video} />

            <View style={styles.cardFooter}>
              <View style={styles.footerLeft}>
                <TouchableOpacity
                  style={styles.footerAction}
                  onPress={() =>
                    void toggleLike(item.id).catch(error =>
                      Alert.alert(
                        'Like could not be updated',
                        error instanceof Error
                          ? error.message
                          : 'Please try again.',
                      ),
                    )
                  }
                  activeOpacity={0.7}>
                  <Icon
                    name="heart"
                    size={16}
                    color={
                      item.liked ? colors.likeActive : colors.textSecondary
                    }
                  />
                  <Text
                    style={[
                      styles.footerText,
                      item.liked && styles.footerTextActive,
                    ]}>
                    {formatCount(item.likeCount)}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.footerAction}
                  onPress={() => handleOpenComments(item.id)}
                  activeOpacity={0.7}>
                  <Icon
                    name="message-circle"
                    size={16}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.footerText}>{item.comments}</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={() => sharePost(item)}
                activeOpacity={0.7}>
                <Icon name="share-2" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
      />

      <Modal
        visible={!!activePost}
        animationType="slide"
        transparent
        onRequestClose={() => setCommentPostId(null)}>
        <View style={styles.commentOverlay}>
          <View style={styles.commentSheet}>
            <View style={styles.commentHeader}>
              <Text style={styles.commentTitle}>Comments</Text>
              <TouchableOpacity
                onPress={() => setCommentPostId(null)}
                hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}>
                <Icon name="x" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.commentList}>
              {postComments.length === 0 ? (
                <Text style={styles.commentEmpty}>
                  No comments yet. Be the first to comment.
                </Text>
              ) : (
                postComments.map((comment: LocalComment) => (
                  <View key={comment.id} style={styles.commentItem}>
                    <View style={styles.commentAvatar} />
                    <View style={styles.commentBody}>
                      <View style={styles.commentHeaderRow}>
                        <Text style={styles.commentAuthor}>{comment.name}</Text>
                        {currentUserId === comment.user_id && (
                          <TouchableOpacity
                            onPress={() =>
                              Alert.alert(
                                'Delete Comment',
                                'Remove this comment?',
                                [
                                  {text: 'Cancel', style: 'cancel'},
                                  {
                                    text: 'Delete',
                                    style: 'destructive',
                                    onPress: async () => {
                                      const postId = commentPostId;
                                      if (!postId) {
                                        return;
                                      }
                                      try {
                                        await removeComment(comment.id);
                                        await loadComments(postId);
                                      } catch (error) {
                                        Alert.alert(
                                          'Comment could not be deleted',
                                          error instanceof Error
                                            ? error.message
                                            : 'Please try again.',
                                        );
                                      }
                                    },
                                  },
                                ],
                              )
                            }>
                            <Icon
                              name="trash-2"
                              size={14}
                              color={colors.danger}
                            />
                          </TouchableOpacity>
                        )}
                      </View>
                      <Text style={styles.commentText}>{comment.body}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>

            <View style={styles.commentInputRow}>
              <TextInput
                style={styles.commentInput}
                placeholder="Add a comment..."
                placeholderTextColor={colors.textMuted}
                value={commentText}
                onChangeText={setCommentText}
                multiline
              />
              <TouchableOpacity
                style={[
                  styles.commentSend,
                  !commentText.trim() && styles.commentSendDisabled,
                ]}
                disabled={!commentText.trim()}
                onPress={submitComment}>
                <Icon name="send" size={18} color={colors.white} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* FAB floated above tab bar */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.getParent()?.navigate('NewPost')}>
        <Icon name="plus" size={26} color={colors.white} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const getStyles = () =>
  StyleSheet.create({
    safe: {flex: 1, backgroundColor: colors.background},
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    brandRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
    logoBadgeCircle: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.white,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.2,
      borderColor: colors.border,
    },
    logoBadgeImage: {
      width: 24,
      height: 24,
    },
    topBarTitle: {fontSize: 17, fontWeight: '800', color: colors.textPrimary},
    topBarActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    quickLinks: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: spacing.sm,
      backgroundColor: colors.card,
    },
    quickLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    quickLinkText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    filterWrapper: {
      backgroundColor: colors.card,
      paddingVertical: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    filterScroll: {
      paddingHorizontal: spacing.md,
      gap: spacing.sm,
      paddingVertical: 4,
    },
    filterChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
      borderRadius: radius.pill,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterChipText: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    filterChipTextActive: {color: colors.white},
    listContent: {padding: spacing.md, paddingBottom: 160},
    feedError: {
      color: colors.danger,
      fontSize: 13,
      marginBottom: spacing.md,
    },
    feedEmpty: {
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: spacing.lg,
      marginBottom: spacing.lg,
    },
    card: {
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
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    avatar: {width: 36, height: 36, borderRadius: 18, marginRight: spacing.sm},
    avatarFallback: {backgroundColor: colors.border},
    cardHeaderCenter: {flex: 1},
    author: {fontSize: 14, fontWeight: '700', color: colors.textPrimary},
    time: {fontSize: 12, color: colors.textMuted},
    tag: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.pill,
    },
    tagText: {fontSize: 10, fontWeight: '700', color: colors.primary},
    postTitle: {
      ...typography.h3,
      fontSize: 16,
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    postBody: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: spacing.sm,
      lineHeight: 20,
    },
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: spacing.xs,
    },
    footerLeft: {flexDirection: 'row', gap: spacing.lg},
    footerAction: {flexDirection: 'row', alignItems: 'center', gap: 6},
    footerText: {fontSize: 13, color: colors.textSecondary},
    footerTextActive: {color: colors.likeActive, fontWeight: '700'},
    commentOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    commentSheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      maxHeight: '75%',
      paddingBottom: spacing.md,
    },
    commentHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    commentTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    commentList: {padding: spacing.md, gap: spacing.md},
    commentEmpty: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      paddingVertical: spacing.lg,
    },
    commentItem: {flexDirection: 'row', gap: spacing.sm},
    commentAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.border,
    },
    commentBody: {flex: 1},
    commentHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    commentAuthor: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 2,
    },
    commentText: {fontSize: 14, color: colors.textSecondary, lineHeight: 19},
    commentInputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    commentInput: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.textPrimary,
      maxHeight: 100,
    },
    commentSend: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    commentSendDisabled: {backgroundColor: colors.accent, opacity: 0.6},
    fab: {
      position: 'absolute',
      right: spacing.lg,
      bottom: 80,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 4,
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 6,
      shadowOffset: {width: 0, height: 3},
    },
  });
