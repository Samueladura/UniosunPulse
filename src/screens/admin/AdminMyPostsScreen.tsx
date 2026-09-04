import React, {useState, useEffect, useCallback} from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {colors, spacing, radius, typography} from '../../theme/colors';
import {supabase, type Post} from '../../services/supabase';

interface AdminPostRow {
  id: string;
  title: string;
  body: string | null;
  image: string | null;
  tag: string;
  like_count: number;
  comment_count: number;
  created_at: string;
}

export default function AdminMyPostsScreen({navigation}: any) {
  const [posts, setPosts] = useState<AdminPostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Edit modal state
  const [editPost, setEditPost] = useState<AdminPostRow | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editTag, setEditTag] = useState<
    'ANNOUNCEMENTS' | 'CAMPUS LIFE' | 'EVENTS' | 'EMERGENCY' | 'BROADCAST'
  >('ANNOUNCEMENTS');
  const [saving, setSaving] = useState(false);

  const TAGS = [
    'ANNOUNCEMENTS',
    'CAMPUS LIFE',
    'EVENTS',
    'EMERGENCY',
    'BROADCAST',
  ] as const;

  const loadPosts = useCallback(async () => {
    try {
      const {data, error} = await supabase
        .from('posts')
        .select('*')
        .eq('author_id', 'admin_official')
        .order('created_at', {ascending: false});

      if (!error && data) {
        setPosts(data as Post[]);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPosts();
    const channel = supabase
      .channel('admin:my_posts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posts',
          filter: 'author_id=eq.admin_official',
        },
        loadPosts,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadPosts]);

  const onRefresh = () => {
    setRefreshing(true);
    loadPosts();
  };

  const handleDelete = (post: AdminPostRow) => {
    Alert.alert('Delete Post', `Permanently remove "${post.title}"?`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('posts').delete().eq('id', post.id);
          setPosts(prev => prev.filter(p => p.id !== post.id));
        },
      },
    ]);
  };

  const handleEdit = (post: AdminPostRow) => {
    setEditPost(post);
    setEditTitle(post.title);
    setEditBody(post.body || '');
    const validTag = TAGS.includes(post.tag as any)
      ? (post.tag as any)
      : 'ANNOUNCEMENTS';
    setEditTag(validTag);
    setSaving(false);
  };

  const handleSaveEdit = async () => {
    if (!editPost || !editTitle.trim()) {
      return;
    }
    setSaving(true);
    const {error} = await supabase
      .from('posts')
      .update({
        title: editTitle.trim(),
        body: editBody.trim(),
        tag: editTag,
      })
      .eq('id', editPost.id);

    if (!error) {
      setPosts(prev =>
        prev.map(p =>
          p.id === editPost.id
            ? {
                ...p,
                title: editTitle.trim(),
                body: editBody.trim(),
                tag: editTag,
              }
            : p,
        ),
      );
      setEditPost(null);
    }
    setSaving(false);
  };

  const formatTime = (iso: string): string => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) {
      return 'Just now';
    }
    if (mins < 60) {
      return `${mins}m ago`;
    }
    const hours = Math.floor(mins / 60);
    if (hours < 24) {
      return `${hours}h ago`;
    }
    return new Date(iso).toLocaleDateString();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Posts</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
          <Icon name="refresh-cw" size={18} color={colors.white} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : posts.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Icon name="file-text" size={40} color={colors.textMuted} />
          <Text style={styles.emptyText}>No posts published yet.</Text>
          <Text style={styles.emptySub}>
            Use Content Moderation or Broadcast Alerts to publish.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }>
          {posts.map(post => (
            <View key={post.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.authorRow}>
                  <Image
                    source={require('../../assets/uniosun-logo.png')}
                    style={styles.authorAvatar}
                  />
                  <View>
                    <Text style={styles.authorName}>
                      Campus Admin (Official)
                    </Text>
                    <Text style={styles.authorMeta}>
                      {formatTime(post.created_at)}
                    </Text>
                  </View>
                </View>
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => handleEdit(post)}>
                    <Icon name="edit-2" size={16} color={colors.interestBlue} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => handleDelete(post)}>
                    <Icon name="trash-2" size={16} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.postTitle}>{post.title}</Text>
              {post.body ? (
                <Text style={styles.postBody} numberOfLines={3}>
                  {post.body}
                </Text>
              ) : null}
              {post.image && (
                <Image source={{uri: post.image}} style={styles.postImage} />
              )}

              <View style={styles.cardFooter}>
                <View style={styles.statRow}>
                  <View style={styles.statItem}>
                    <Icon name="heart" size={14} color={colors.textSecondary} />
                    <Text style={styles.statText}>{post.like_count}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Icon
                      name="message-circle"
                      size={14}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.statText}>{post.comment_count}</Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Edit Modal */}
      <Modal
        visible={!!editPost}
        animationType="slide"
        transparent
        onRequestClose={() => setEditPost(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Post</Text>
              <TouchableOpacity onPress={() => setEditPost(null)}>
                <Icon name="x" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Title</Text>
              <TextInput
                style={styles.input}
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="Post title"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Body</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={editBody}
                onChangeText={setEditBody}
                placeholder="Post content"
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Tag</Text>
              <View style={styles.tagRow}>
                {TAGS.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.tagChip,
                      editTag === t && styles.activeTagChip,
                    ]}
                    onPress={() => setEditTag(t)}>
                    <Text
                      style={[
                        styles.tagChipText,
                        editTag === t && styles.activeTagChipText,
                      ]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={styles.saveBtn}
              disabled={saving}
              onPress={handleSaveEdit}>
              {saving ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.saveBtnText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  refreshBtn: {
    padding: spacing.xs,
    marginLeft: 'auto',
  },
  headerTitle: {
    ...typography.h2,
    color: colors.white,
    fontSize: 20,
    flex: 1,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  scrollView: {flex: 1},
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  authorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  authorName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  authorMeta: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  postTitle: {
    ...typography.h3,
    fontSize: 16,
    color: colors.textPrimary,
  },
  postBody: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  postImage: {
    width: '100%',
    height: 160,
    borderRadius: radius.md,
    marginTop: 6,
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  statRow: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginLeft: 8,
  },
  iconBtn: {
    padding: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: spacing.md,
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    ...typography.h3,
    fontSize: 18,
    color: colors.textPrimary,
  },
  formGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
  },
  textArea: {
    height: 90,
    textAlignVertical: 'top',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
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
  saveBtn: {
    height: 46,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  saveBtnText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 15,
  },
});
