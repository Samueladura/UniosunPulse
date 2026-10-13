import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {colors, spacing, radius, typography} from '../../theme/colors';
import {adminService, ReportedPost} from '../../services/adminService';
import {usePosts} from '../../context/PostsContext';
import {backend, fetchUserProfile, reportComment as apiReportComment} from '../../services/backend';
import {launchImageLibrary} from 'react-native-image-picker';
import type {Asset} from 'react-native-image-picker';
import {isVideoUrl, uploadPostMedia} from '../../services/media';

interface ReportedComment {
  id: string;
  comment_id: string;
  reporter_id: string;
  reporter_name: string;
  reason: string;
  details: string | null;
  status: 'pending' | 'actioned' | 'dismissed';
  created_at: string;
  comment_body?: string;
  post_title?: string;
}

export default function AdminContentModerationScreen({navigation}: any) {
  const [activeTab, setActiveTab] = useState<
    'reports' | 'comments' | 'announce'
  >('reports');
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ReportedPost[]>([]);
  const [reportedComments, setReportedComments] = useState<ReportedComment[]>([]);

  // Announcement Form state
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaAsset, setMediaAsset] = useState<Asset | null>(null);
  const [tag, setTag] = useState<'ANNOUNCEMENTS' | 'CAMPUS LIFE' | 'EVENTS'>(
    'ANNOUNCEMENTS',
  );
  const [profile, setProfile] = useState<{
    full_name: string | null;
    avatar_url: string | null;
  } | null>(null);
  const [publishing, setPublishing] = useState(false);

  const {addPost} = usePosts();

  useEffect(() => {
    loadReports();
    loadReportedComments();
    (async () => {
      const p = await fetchUserProfile();
      if (p) {
        setProfile({full_name: p.full_name, avatar_url: p.avatar_url});
      }
    })();
    const channel = backend
      .channel('admin:reported_posts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'reported_posts',
        },
        () => {
          loadReports();
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'reported_comments',
        },
        () => {
          loadReportedComments();
        },
      )
      .subscribe();
    return () => {
      backend.removeChannel(channel);
    };
  }, []);

  const loadReports = async () => {
    setLoading(true);
    const data = await adminService.getReportedPosts();
    setReports(data);
    setLoading(false);
  };

  const loadReportedComments = async () => {
    try {
      const {data} = await backend
        .from('reported_comments')
        .select(
          `id, comment_id, reporter_id, reporter_name, reason, details, status, created_at, comment:comments(body, post_id)`,
        )
        .order('created_at', {ascending: false})
        .limit(50);
      if (data) {
        setReportedComments(
          data.map((item: any) => ({
            id: item.id,
            comment_id: item.comment_id,
            reporter_id: item.reporter_id,
            reporter_name: item.reporter_name,
            reason: item.reason,
            details: item.details,
            status: item.status,
            created_at: item.created_at,
            comment_body: item.comment?.body,
            post_title: item.comment?.post_id,
          })),
        );
      }
    } catch {
      // ignore
    }
  };

  const handleDismiss = async (report: ReportedPost) => {
    await adminService.resolveReportedPost(report.id, 'dismissed');
    setReports(prev => prev.filter(r => r.id !== report.id));
    Alert.alert('Report Dismissed', 'No moderation action taken.');
  };

  const handleDeletePost = async (report: ReportedPost) => {
    Alert.alert(
      'Delete Post',
      `Delete violating post "${report.postTitle}" permanently?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete Post',
          style: 'destructive',
          onPress: async () => {
            await adminService.resolveReportedPost(report.id, 'actioned');
            setReports(prev => prev.filter(r => r.id !== report.id));
            Alert.alert(
              'Post Deleted',
              'The reported post has been removed from the campus feed.',
            );
          },
        },
      ],
    );
  };

  const handleDismissComment = async (report: ReportedComment) => {
    try {
      await backend
        .from('reported_comments')
        .update({status: 'dismissed', resolved_at: new Date().toISOString()})
        .eq('id', report.id);
      setReportedComments(prev => prev.filter(r => r.id !== report.id));
      Alert.alert('Report Dismissed', 'No moderation action taken.');
    } catch {
      Alert.alert('Error', 'Failed to dismiss comment report');
    }
  };

  const handleDeleteComment = async (report: ReportedComment) => {
    Alert.alert(
      'Delete Comment',
      `Delete reported comment?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete Comment',
          style: 'destructive',
          onPress: async () => {
            try {
              await backend
                .from('reported_comments')
                .update({status: 'actioned', resolved_at: new Date().toISOString()})
                .eq('id', report.id);
              // Also delete the actual comment
              await backend.from('comments').delete().eq('id', report.comment_id);
              setReportedComments(prev => prev.filter(r => r.id !== report.id));
              Alert.alert('Comment Deleted', 'The reported comment has been removed.');
            } catch {
              Alert.alert('Error', 'Failed to delete comment');
            }
          },
        },
      ],
    );
  };

  const handlePublishAnnouncement = async () => {
    if (!title.trim() || !body.trim()) {
      Alert.alert(
        'Missing Fields',
        'Please enter both an announcement title and body content.',
      );
      return;
    }

    setPublishing(true);
    try {
      const AUTHOR_NAME = 'Campus Admin(Official)';
      const media = mediaAsset
        ? await uploadPostMedia(mediaAsset)
        : mediaUrl.trim()
        ? isVideoUrl(mediaUrl.trim())
          ? {video: mediaUrl.trim()}
          : {image: mediaUrl.trim()}
        : {};
      await addPost({
        author_id: 'admin_official',
        author_name: AUTHOR_NAME,
        author: AUTHOR_NAME,
        avatar: profile?.avatar_url || '',
        title: title.trim(),
        body: body.trim(),
        image: media.image ?? null,
        video: media.video ?? null,
        tag: tag,
        like_count: 0,
        comment_count: 0,
      });

      setPublishing(false);
      setTitle('');
      setBody('');
      setMediaUrl('');
      setMediaAsset(null);
      Alert.alert(
        'Announcement Published!',
        'Official announcement is now live at the top of the campus feed.',
      );
    } catch (error) {
      setPublishing(false);
      Alert.alert(
        'Error',
        error instanceof Error
          ? error.message
          : 'Failed to publish announcement.',
      );
    }
  };

  const handlePickMedia = async (mediaType: 'photo' | 'video') => {
    const result = await launchImageLibrary({
      mediaType,
      selectionLimit: 1,
      quality: 0.8,
    });
    const asset = result.assets?.[0];
    if (result.errorMessage) {
      Alert.alert('Media selection failed', result.errorMessage);
    } else if (asset?.uri) {
      setMediaAsset(asset);
      setMediaUrl('');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Content Moderation & Feed</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'reports' && styles.activeTab]}
          onPress={() => setActiveTab('reports')}>
          <Icon
            name="flag"
            size={16}
            color={activeTab === 'reports' ? colors.primary : colors.textMuted}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'reports' && styles.activeTabText,
            ]}>
            Reported Posts ({reports.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'comments' && styles.activeTab]}
          onPress={() => setActiveTab('comments')}>
          <Icon
            name="message-square"
            size={16}
            color={activeTab === 'comments' ? colors.primary : colors.textMuted}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'comments' && styles.activeTabText,
            ]}>
            Reported Comments ({reportedComments.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'announce' && styles.activeTab]}
          onPress={() => setActiveTab('announce')}>
          <Icon
            name="plus-circle"
            size={16}
            color={activeTab === 'announce' ? colors.primary : colors.textMuted}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'announce' && styles.activeTabText,
            ]}>
            Publish Announcement
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'reports' ? (
        loading ? (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={styles.loadingWrap}
          />
        ) : (
          <FlatList
            data={reports}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({item}) => (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.flagWrap}>
                    <Icon name="alert-circle" size={16} color={colors.danger} />
                    <Text style={styles.reasonText}>{item.reason}</Text>
                  </View>
                  <Text style={styles.statusTag}>{item.status}</Text>
                </View>

                <View style={styles.postBox}>
                  <Text style={styles.postTitle}>
                    {item.postTitle || 'Sample Student Post'}
                  </Text>
                  <Text style={styles.postAuthor}>
                    By {item.postAuthor || 'Unknown Student'}
                  </Text>
                  {item.details && (
                    <Text style={styles.reportDetails}>
                      Reporter Note: "{item.details}"
                    </Text>
                  )}
                </View>

                <View style={styles.btnRow}>
                  <TouchableOpacity
                    style={styles.dismissBtn}
                    onPress={() => handleDismiss(item)}>
                    <Text style={styles.dismissText}>Dismiss Report</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDeletePost(item)}>
                    <Icon name="trash-2" size={14} color={colors.white} />
                    <Text style={styles.deleteText}>Delete Post</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                No pending content reports to review.
              </Text>
            }
          />
        )
      ) : activeTab === 'comments' ? (
        loading ? (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={styles.loadingWrap}
          />
        ) : (
          <FlatList
            data={reportedComments}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({item}) => (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.flagWrap}>
                    <Icon name="alert-circle" size={16} color={colors.danger} />
                    <Text style={styles.reasonText}>{item.reason}</Text>
                  </View>
                  <Text style={styles.statusTag}>{item.status}</Text>
                </View>

                <View style={styles.postBox}>
                  <Text style={styles.postTitle}>
                    Comment on: {item.post_title || 'Post'}
                  </Text>
                  <Text style={styles.postAuthor}>
                    Reported by: {item.reporter_name}
                  </Text>
                  <Text style={styles.reportDetails}>
                    "{item.comment_body || 'Comment body unavailable'}"
                  </Text>
                  {item.details && (
                    <Text style={styles.reportDetails}>
                      Reporter Note: "{item.details}"
                    </Text>
                  )}
                </View>

                <View style={styles.btnRow}>
                  <TouchableOpacity
                    style={styles.dismissBtn}
                    onPress={() => handleDismissComment(item)}>
                    <Text style={styles.dismissText}>Dismiss Report</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDeleteComment(item)}>
                    <Icon name="trash-2" size={14} color={colors.white} />
                    <Text style={styles.deleteText}>Delete Comment</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                No pending comment reports to review.
              </Text>
            }
          />
        )
      ) : (
        <ScrollView contentContainerStyle={styles.formContent}>
          <Text style={styles.formHeading}>New Official Announcement</Text>
          <Text style={styles.formSub}>
            Published directly to the campus main feed with official Registrar
            badge.
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Announcement Title</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. 2026 Resumption Date & Registration Notice"
              placeholderTextColor={colors.textMuted}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Category Tag</Text>
            <View style={styles.tagOptions}>
              {(['ANNOUNCEMENTS', 'CAMPUS LIFE', 'EVENTS'] as const).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.tagChip, tag === t && styles.activeTagChip]}
                  onPress={() => setTag(t)}>
                  <Text
                    style={[
                      styles.tagChipText,
                      tag === t && styles.activeTagChipText,
                    ]}>
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Announcement Content</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Enter full details of the announcement for all UniOsun students..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={6}
              value={body}
              onChangeText={setBody}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Optional Image or Video URL</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Paste an image or video URL"
              placeholderTextColor={colors.textMuted}
              value={mediaUrl}
              onChangeText={value => {
                setMediaUrl(value);
                setMediaAsset(null);
              }}
            />
          </View>

          <View style={styles.mediaPickers}>
            <TouchableOpacity
              style={styles.pickImageBtnImage}
              onPress={() => handlePickMedia('photo')}>
              <Icon name="image" size={18} color={colors.white} />
              <Text style={styles.pickImageText}>Pick Image</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.pickImageBtnVideo}
              onPress={() => handlePickMedia('video')}>
              <Icon name="video" size={18} color={colors.white} />
              <Text style={styles.pickImageText}>Pick Video</Text>
            </TouchableOpacity>
          </View>

          {mediaAsset?.uri ? (
            <View style={styles.mediaPreview}>
              {mediaAsset.type?.startsWith('video/') ? (
                <View style={styles.videoPreview}>
                  <Icon name="video" size={36} color={colors.white} />
                  <Text style={styles.videoPreviewText}>
                    {mediaAsset.fileName || 'Video selected'}
                  </Text>
                </View>
              ) : (
                <Image
                  source={{uri: mediaAsset.uri}}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
              )}
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.publishBtn}
            disabled={publishing}
            onPress={handlePublishAnnouncement}>
            {publishing ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Icon name="send" size={18} color={colors.white} />
                <Text style={styles.publishBtnText}>Publish Announcement</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.white,
    fontSize: 20,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  activeTabText: {
    color: colors.primary,
    fontWeight: '700',
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  loadingWrap: {marginVertical: 40},

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  flagWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reasonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.danger,
  },
  statusTag: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  postBox: {
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: radius.sm,
    gap: 4,
  },
  postTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  postAuthor: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  reportDetails: {
    fontSize: 12,
    fontStyle: 'italic',
    color: colors.danger,
    marginTop: 4,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dismissBtn: {
    flex: 1,
    height: 38,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  deleteBtn: {
    flex: 1,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.danger,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  deleteText: {
    fontSize: 13,
    color: colors.white,
    fontWeight: '700',
  },
  formContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  formHeading: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  formSub: {
    ...typography.small,
    color: colors.textSecondary,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  textInput: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  tagOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  activeTagChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tagChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  activeTagChipText: {
    color: colors.white,
  },
  publishBtn: {
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  publishBtnText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 15,
  },
  pickImageBtn: {
    height: 44,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
  },
  pickImageBtnImage: {
    backgroundColor: colors.primary,
  },
  pickImageBtnVideo: {
    backgroundColor: colors.interestBlue,
  },
  mediaPickers: {flexDirection: 'row', gap: spacing.sm},
  mediaPreview: {marginTop: spacing.sm},
  videoPreview: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.textPrimary,
    borderRadius: radius.md,
  },
  videoPreviewText: {color: colors.white, fontSize: 13},
  pickImageText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  previewImage: {
    width: '100%',
    height: 160,
    borderRadius: radius.md,
    marginTop: 10,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textMuted,
    marginVertical: 30,
  },
});
