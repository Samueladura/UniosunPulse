import React, {useState, useEffect} from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  Platform,
  Alert,
} from 'react-native';
import {colors} from '../theme/colors.ts';
import {backend} from '../services/backend';
import Icon from 'react-native-vector-icons/Feather';
import PostMedia from '../components/PostMedia';
import {usePrefs, useThemedStyles} from '../theme/PreferencesContext';
import {
  fetchPostById,
  setPostLiked,
  fetchComments,
  createComment as apiCreateComment,
  deletePost as apiDeletePost,
  unfollowUser,
  followUser,
  reportPost,
  reportComment,
  type Post,
} from '../services/backend';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/AppNavigator';
import {fetchSavedStatus, setItemSaved} from '../services/campus';
import {usePosts} from '../context/PostsContext';

type Props = NativeStackScreenProps<RootStackParamList, 'PostDetail'>;

interface Comment {
  id: string;
  user_id: string;
  name: string;
  avatar: string;
  time: string;
  body: string;
  isAuthor?: boolean;
  replies?: Comment[];
}

const LIGHT_COLORS = {
  bg: '#F5F6F8',
  card: '#FFFFFF',
  green: '#1F6B4A',
  greenDark: '#17553A',
  text: '#161B22',
  subtext: '#8A929B',
  border: '#ECEDEF',
  replyBg: '#F0F2F4',
  tag: '#1F6B4A',
} as const;

const DARK_COLORS = {
  bg: '#0B1410',
  card: '#13211A',
  green: '#4ADE80',
  greenDark: '#16A34A',
  text: '#F3F6F4',
  subtext: '#A7B5AD',
  border: '#1F3329',
  replyBg: '#1A2B23',
  tag: '#4ADE80',
} as const;

const getStyles = (C: typeof LIGHT_COLORS | typeof DARK_COLORS) =>
  StyleSheet.create({
    safe: {flex: 1, backgroundColor: C.bg},
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: C.card,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
      gap: 10,
    },
    headerTitle: {fontSize: 17, fontWeight: '800', color: C.green},
    headerRight: {flexDirection: 'row', alignItems: 'center', gap: 18},

    deleteButton: {backgroundColor: colors.danger, marginLeft: 8},
    deleteButtonText: {color: colors.white},
    actionLabelLiked: {color: colors.likeActive, fontWeight: '700'},
    actionLabelSaved: {color: C.green, fontWeight: '700'},
    flexOne: {flex: 1},

    scrollContent: {paddingBottom: 24},

    authorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 10,
      gap: 10,
    },
    authorAvatar: {width: 42, height: 42, borderRadius: 21},
    authorName: {fontSize: 14, fontWeight: '700', color: C.text},
    authorMeta: {fontSize: 12, color: C.subtext, marginTop: 2},
    imageWrap: {marginHorizontal: 16, borderRadius: 14, overflow: 'hidden'},
    followButton: {
      backgroundColor: C.green,
      paddingHorizontal: 16,
      paddingVertical: 7,
      borderRadius: 18,
    },
    followingButton: {
      backgroundColor: C.replyBg,
    },
    followButtonText: {color: '#FFFFFF', fontSize: 12, fontWeight: '700'},
    followingButtonText: {color: C.text},

    tagBadge: {
      position: 'absolute',
      top: 10,
      right: 10,
      backgroundColor: C.tag,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
    },
    tagBadgeText: {color: '#FFFFFF', fontSize: 10, fontWeight: '700'},

    postTitle: {
      fontSize: 19,
      fontWeight: '800',
      color: C.text,
      marginTop: 16,
      marginHorizontal: 16,
      lineHeight: 26,
    },
    postBody: {
      fontSize: 13.5,
      color: C.subtext,
      marginTop: 12,
      marginHorizontal: 16,
      lineHeight: 21,
    },

    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 16,
      marginHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
      gap: 18,
    },
    statItem: {flexDirection: 'row', alignItems: 'center', gap: 5},
    statItemRight: {marginLeft: 'auto'},
    statText: {fontSize: 12.5, color: C.subtext, fontWeight: '600'},

    actionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    actionItem: {alignItems: 'center', gap: 4, flex: 1},
    actionLabel: {fontSize: 10.5, color: C.text, fontWeight: '600'},

    commentsTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: C.text,
      marginTop: 18,
      marginHorizontal: 16,
      marginBottom: 12,
    },

    commentWrap: {
      flexDirection: 'row',
      marginHorizontal: 16,
      marginBottom: 14,
      gap: 10,
    },
    replyWrap: {
      flexDirection: 'row',
      marginTop: 12,
      marginLeft: 8,
      paddingLeft: 10,
      borderLeftWidth: 2,
      borderLeftColor: C.border,
      gap: 10,
    },
    commentAvatar: {width: 34, height: 34, borderRadius: 17},
    commentAvatarFallback: {backgroundColor: C.border},
    commentBubbleWrap: {flex: 1},
    commentBubble: {
      backgroundColor: C.card,
      borderRadius: 12,
      padding: 12,
    },
    commentBubbleAuthor: {
      backgroundColor: C.replyBg,
    },
    commentHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    commentName: {fontSize: 13, fontWeight: '700', color: C.text},
    commentNameAuthor: {color: C.green},
    commentTime: {fontSize: 11, color: C.subtext},
    commentBody: {fontSize: 13, color: C.text, lineHeight: 19},
    replyLink: {
      fontSize: 12,
      color: C.subtext,
      fontWeight: '700',
      marginTop: 6,
      marginLeft: 4,
    },

    inputBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: C.card,
      borderTopWidth: 1,
      borderTopColor: C.border,
      gap: 10,
    },
    inputAvatarWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: C.greenDark,
      alignItems: 'center',
      justifyContent: 'center',
    },
    input: {
      flex: 1,
      backgroundColor: C.bg,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 8,
      fontSize: 13,
      color: C.text,
    },

    tabBar: {
      flexDirection: 'row',
      backgroundColor: C.card,
      borderTopWidth: 1,
      borderTopColor: C.border,
      paddingVertical: 8,
      paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    },
    tabItem: {flex: 1, alignItems: 'center', gap: 3},
    tabLabel: {fontSize: 10, color: C.subtext, fontWeight: '600'},
    tabLabelActive: {color: C.green, fontWeight: '700'},

    scrollView: {flex: 1},
    authorContentCol: {flex: 1},
  });

function formatCount(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return `${value}`;
}

export default function PostDetailScreen({navigation, route}: Props) {
  const C = usePrefs().isDark ? DARK_COLORS : LIGHT_COLORS;
  const styles = useThemedStyles(() => getStyles(C), []);
  const {removeComment} = usePosts();

  const postParam = route.params?.post as
    | (Omit<Post, 'liked'> & {
        authorId?: string;
        author?: string;
        avatar?: string;
        time?: string;
      })
    | undefined;

  const [liked, setLiked] = useState<boolean>(false);
  const [saved, setSaved] = useState<boolean>(false);
  const [savingBookmark, setSavingBookmark] = useState(false);
  const [isFollowingAuthor, setIsFollowingAuthor] = useState<boolean>(false);
  const [likeCountValue, setLikeCountValue] = useState<number>(
    typeof postParam?.like_count === 'number' ? postParam.like_count : 0,
  );
  const [commentText, setCommentText] = useState<string>('');
  const [commentsList, setCommentsList] = useState<Comment[]>([]);
  const [_loadingComments, _setLoadingComments] = useState(false);
  const [_postDetail, setPostDetail] = useState<Post | null>(null);
  const [_isLoadingPost, setIsLoadingPost] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  const authorName = postParam?.author || postParam?.author_name || 'Unknown author';
  const authorAvatar =
    postParam?.author_id === 'admin_official'
      ? require('../assets/uniosun-logo.png')
      : postParam?.avatar || '';
  const postTime = postParam?.time || new Date().toLocaleString();
  const postTag = postParam?.tag || 'ACADEMIC';
  const postBody =
    postParam?.body ||
    "Hello everyone! I've just uploaded the consolidated study materials for the upcoming PSC 401 Mid-semester exams. These include comprehensive lecture notes from the past six weeks, curated research papers on modern political theories, and a set of practice questions to help you prepare.";
  const postImage = _postDetail?.image || postParam?.image || null;
  const postVideo = _postDetail?.video || postParam?.video || null;

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!postParam?.id) {
        return;
      }
      try {
        const savedStatus = await fetchSavedStatus('post', postParam.id);
        if (active) {
          setSaved(savedStatus.saved);
        }
      } catch (error) {
        if (active) {
          Alert.alert(
            'Unable to load saved status',
            error instanceof Error ? error.message : 'Please try again.',
          );
        }
      }
      setIsLoadingPost(true);
      const row = await fetchPostById(postParam.id);
      if (active && row) {
        setPostDetail(row);
        setLikeCountValue(row.like_count);
        const likedState = await hasUserLiked(row.id);
        if (active) {
          setLiked(likedState);
        }
      }
      setIsLoadingPost(false);
      const commentsRows = await fetchComments(postParam.id);
      if (active) {
        setCommentsList(
          commentsRows.map(r => ({
            id: r.id,
            user_id: r.user_id,
            name: r.author_name || 'Anonymous',
            avatar: r.avatar || '',
            time: new Date(r.created_at).toLocaleString(),
            body: r.body,
          })),
        );
      }
    };
    (async () => {
      const {
        data: {user},
      } = await backend.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        setCurrentUserEmail(user.email || null);
      }
    })();
    load();
    return () => {
      active = false;
    };
  }, [postParam?.id]);

  const handleLike = async () => {
    if (!postParam?.id) {
      return;
    }
    const previousLiked = liked;
    const previousCount = likeCountValue;
    setLiked(prev => !prev);
    setLikeCountValue(prev => Math.max(0, prev + (liked ? -1 : 1)));
    try {
      const result = await setPostLiked(postParam.id, !previousLiked);
      setLiked(result.liked);
      setLikeCountValue(result.like_count);
    } catch (error) {
      setLiked(previousLiked);
      setLikeCountValue(previousCount);
      Alert.alert(
        'Like could not be updated',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  };

  const handleSaveToggle = async () => {
    if (!postParam?.id || savingBookmark) {
      return;
    }
    setSavingBookmark(true);
    try {
      const result = await setItemSaved('post', postParam.id, !saved);
      setSaved(result.saved);
    } catch (error) {
      Alert.alert(
        'Unable to update saved posts',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setSavingBookmark(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!postParam?.authorId) {
      return;
    }
    if (isFollowingAuthor) {
      await unfollowUser(postParam.authorId);
    } else {
      await followUser(postParam.authorId);
    }
    setIsFollowingAuthor(prev => !prev);
  };

  const handleReportPost = () => {
    if (!postParam?.id) {
      return;
    }
    Alert.alert('Report Post', 'Why are you reporting this post?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Inappropriate Content',
        onPress: () => submitReport(postParam.id, 'Inappropriate Content'),
      },
      {
        text: 'Spam or Misleading',
        onPress: () => submitReport(postParam.id, 'Spam or Misleading'),
      },
      {
        text: 'Harassment or Hate Speech',
        onPress: () => submitReport(postParam.id, 'Harassment or Hate Speech'),
      },
      {
        text: 'Other',
        onPress: () =>
          Alert.prompt(
            'Report Post',
            'Please provide details:',
            [
              {text: 'Cancel', style: 'cancel'},
              {
                text: 'Submit',
                onPress: (details?: string) =>
                  submitReport(postParam.id, 'Other', details ?? ''),
              },
            ],
            'plain-text',
            '',
          ),
      },
    ]);
  };

  const submitReport = async (
    postId: string,
    reason: string,
    details?: string,
  ) => {
    try {
      await reportPost(postId, reason, details);
      Alert.alert(
        'Report Submitted',
        'Thank you for reporting. Our team will review it.',
      );
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to submit report',
      );
    }
  };

  const handleReportComment = (commentId: string) => {
    Alert.alert('Report Comment', 'Why are you reporting this comment?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Inappropriate Content',
        onPress: () => submitCommentReport(commentId, 'Inappropriate Content'),
      },
      {
        text: 'Spam',
        onPress: () => submitCommentReport(commentId, 'Spam'),
      },
      {
        text: 'Harassment',
        onPress: () => submitCommentReport(commentId, 'Harassment'),
      },
      {
        text: 'Other',
        onPress: () =>
          Alert.prompt(
            'Report Comment',
            'Please provide details:',
            [
              {text: 'Cancel', style: 'cancel'},
              {
                text: 'Submit',
                onPress: (details?: string) =>
                  submitCommentReport(commentId, 'Other', details ?? ''),
              },
            ],
            'plain-text',
            '',
          ),
      },
    ]);
  };

  const submitCommentReport = async (
    commentId: string,
    reason: string,
    details?: string,
  ) => {
    try {
      await reportComment(commentId, reason, details);
      Alert.alert(
        'Report Submitted',
        'Thank you for reporting. Our team will review it.',
      );
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to submit report',
      );
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !postParam?.id) {
      return;
    }
    const newComment: Comment = {
      id: `${Date.now()}`,
      user_id: currentUserId || '',
      name: 'You',
      avatar: '',
      time: 'Just now',
      body: commentText.trim(),
      isAuthor: true,
    };
    try {
      const commentRes = await apiCreateComment(
        postParam.id,
        commentText.trim(),
      );
      if (commentRes) {
        setCommentsList(prev => [...prev, newComment]);
        setCommentText('');
      }
    } catch (error) {
      Alert.alert(
        'Comment could not be sent',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await removeComment(commentId);
      setCommentsList(prev => prev.filter(c => c.id !== commentId));
    } catch (error) {
      Alert.alert(
        'Comment could not be deleted',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  };

  const openProfile = () => {
    navigation.navigate('UserProfile', {userId: postParam?.authorId || 'u1'});
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <Icon name="arrow-left" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={openProfile}>
            <Icon name="search" size={20} color={C.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={openProfile}>
            <Icon name="more-vertical" size={20} color={C.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.flexOne}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.authorRow}>
          <TouchableOpacity onPress={openProfile} activeOpacity={0.8}>
            <Image
              source={
                typeof authorAvatar === 'number'
                  ? authorAvatar
                  : {uri: authorAvatar}
              }
              style={styles.authorAvatar}
            />
          </TouchableOpacity>
          <View style={styles.flexOne}>
            <Text style={styles.authorName}>{authorName}</Text>
            <Text style={styles.authorMeta}>{postTime}</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.followButton,
              isFollowingAuthor && styles.followingButton,
            ]}
            onPress={handleFollowToggle}>
            <Text
              style={[
                styles.followButtonText,
                isFollowingAuthor && styles.followingButtonText,
              ]}>
              {isFollowingAuthor ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
          {(currentUserId === postParam?.author_id ||
            (currentUserEmail === 'official.uniosun@edu.ng' &&
              postParam?.author_id === 'admin_official')) && (
            <TouchableOpacity
              style={[styles.followButton, styles.deleteButton]}
              onPress={() =>
                Alert.alert('Delete Post', 'Permanently remove this post?', [
                  {text: 'Cancel', style: 'cancel'},
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      if (postParam?.id) {
                        await apiDeletePost(postParam.id);
                        navigation.goBack();
                      }
                    },
                  },
                ])
              }>
              <Text style={[styles.followButtonText, styles.deleteButtonText]}>
                Delete
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {postImage || postVideo ? (
          <View style={styles.imageWrap}>
            <PostMedia image={postImage} video={postVideo} />
            <View style={styles.tagBadge}>
              <Text style={styles.tagBadgeText}>{postTag}</Text>
            </View>
          </View>
        ) : null}

        <Text style={styles.postBody}>{postBody}</Text>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Icon
              name="heart"
              size={14}
              color={liked ? colors.likeActive : C.subtext}
            />
            <Text style={styles.statText}>{formatCount(likeCountValue)}</Text>
          </View>
          <View style={styles.statItem}>
            <Icon name="message-circle" size={14} color={C.subtext} />
            <Text style={styles.statText}>{commentsList.length}</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionItem} onPress={handleLike}>
            <Icon
              name="heart"
              size={18}
              color={liked ? colors.likeActive : C.text}
              {...(liked ? {fill: colors.likeActive} : {})}
            />
            <Text
              style={
                liked
                  ? [styles.actionLabel, styles.actionLabelLiked]
                  : styles.actionLabel
              }>
              LIKE
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem}>
            <Icon name="message-circle" size={18} color={C.text} />
            <Text style={styles.actionLabel}>COMMENT</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem}>
            <Icon name="share-2" size={18} color={C.text} />
            <Text style={styles.actionLabel}>SHARE</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionItem}
            disabled={savingBookmark}
            onPress={handleSaveToggle}>
            <Icon name="bookmark" size={18} color={saved ? C.green : C.text} />
            <Text
              style={
                saved
                  ? [styles.actionLabel, styles.actionLabelSaved]
                  : styles.actionLabel
              }>
              SAVE
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionItem}
            onPress={handleReportPost}>
            <Icon name="flag" size={18} color={C.text} />
            <Text style={styles.actionLabel}>REPORT</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.commentsTitle}>
          Comments ({commentsList.length})
        </Text>
        {commentsList.map(comment => (
          <CommentItem
            key={comment.id}
            comment={comment}
            currentUserId={currentUserId}
            onDelete={handleDeleteComment}
            onReport={handleReportComment}
          />
        ))}
      </ScrollView>

      <View style={styles.inputBar}>
        <View style={styles.inputAvatarWrap}>
          <Icon name="user" size={16} color={C.green} />
        </View>
        <TextInput
          style={styles.input}
          placeholder="Add a comment..."
          placeholderTextColor={C.subtext}
          value={commentText}
          onChangeText={setCommentText}
          onSubmitEditing={handleAddComment}
        />
        <TouchableOpacity onPress={handleAddComment}>
          <Icon name="send" size={20} color={C.green} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        <TabItem
          icon="home"
          label="Feed"
          active
          onPress={() => navigation.navigate('Home')}
        />
        <TabItem
          icon="check-square"
          label="Election"
          onPress={() => navigation.navigate('Home')}
        />
        <TabItem
          icon="bell"
          label="Alerts"
          onPress={() => navigation.navigate('Home')}
        />
        <TabItem
          icon="user"
          label="Profile"
          onPress={() => navigation.navigate('Settings')}
        />
      </View>
    </SafeAreaView>
  );
}

function CommentItem({
  comment,
  isReply,
  currentUserId,
  onDelete,
  onReport,
}: {
  comment: Comment;
  isReply?: boolean;
  currentUserId?: string | null;
  onDelete?: (id: string) => void;
  onReport?: (id: string) => void;
}) {
  const C = usePrefs().isDark ? DARK_COLORS : LIGHT_COLORS;
  const styles = useThemedStyles(() => getStyles(C), []);
  return (
    <View style={isReply ? styles.replyWrap : styles.commentWrap}>
      {comment.avatar ? (
        <Image source={{uri: comment.avatar}} style={styles.commentAvatar} />
      ) : (
        <View style={[styles.commentAvatar, styles.commentAvatarFallback]} />
      )}
      <View style={styles.commentBubbleWrap}>
        <View
          style={[
            styles.commentBubble,
            comment.isAuthor && styles.commentBubbleAuthor,
          ]}>
          <View style={styles.commentHeaderRow}>
            <Text
              style={[
                styles.commentName,
                comment.isAuthor && styles.commentNameAuthor,
              ]}>
              {comment.name}
            </Text>
            {currentUserId === comment.user_id && onDelete ? (
              <TouchableOpacity onPress={() => onDelete(comment.id)}>
                <Icon name="trash-2" size={14} color={colors.danger} />
              </TouchableOpacity>
            ) : onReport ? (
              <>
                <TouchableOpacity onPress={() => onReport(comment.id)}>
                  <Icon name="flag" size={14} color={C.subtext} />
                </TouchableOpacity>
                <Text style={styles.commentTime}>{comment.time}</Text>
              </>
            ) : (
              <Text style={styles.commentTime}>{comment.time}</Text>
            )}
          </View>
          <Text style={styles.commentBody}>{comment.body}</Text>
        </View>
        {!comment.isAuthor && (
          <TouchableOpacity>
            <Text style={styles.replyLink}>Reply</Text>
          </TouchableOpacity>
        )}
        {comment.replies?.map(_reply => (
          <CommentItem
            key={comment.id}
            comment={comment}
            isReply
            currentUserId={currentUserId}
            onDelete={onDelete}
            onReport={onReport}
          />
        ))}
      </View>
    </View>
  );
}

async function hasUserLiked(postId: string): Promise<boolean> {
  const {data} = await backend
    .from('likes')
    .select('id')
    .eq('post_id', postId)
    .limit(1);

  return !!data && data.length > 0;
}

function TabItem({
  icon,
  label,
  active,
  onPress,
}: {
  icon: string;
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  const C = usePrefs().isDark ? DARK_COLORS : LIGHT_COLORS;
  const styles = useThemedStyles(() => getStyles(C), []);
  return (
    <TouchableOpacity
      style={styles.tabItem}
      onPress={onPress}
      activeOpacity={0.7}>
      <Icon name={icon} size={20} color={active ? C.green : C.subtext} />
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}
