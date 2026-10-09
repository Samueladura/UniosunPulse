import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useRef,
  useCallback,
} from 'react';
import {backend} from '../services/backend';
import {
  Post,
  Comment,
  fetchFeedPage,
  createPost as apiCreatePost,
  setPostLiked,
  createFeedComment,
  deleteComment as apiDeleteComment,
} from '../services/backend';

export interface PostWithMeta extends Post {
  author: string;
  avatar: string;
  time: string;
  likes: string;
  comments: number;
  liked: boolean;
  likeCount: number;
}

interface PostsContextValue {
  posts: PostWithMeta[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  feedError: string | null;
  addPost: (
    post: Omit<
      PostWithMeta,
      | 'id'
      | 'time'
      | 'likes'
      | 'comments'
      | 'liked'
      | 'likeCount'
      | 'created_at'
      | 'updated_at'
    >,
  ) => Promise<void>;
  toggleLike: (id: string) => Promise<void>;
  addComment: (postId: string, text: string) => Promise<Comment>;
  removeComment: (commentId: string) => Promise<void>;
  refreshFeed: (tag?: string) => Promise<void>;
  loadMorePosts: () => Promise<void>;
}

const PostsContext = createContext<PostsContextValue | null>(null);

function formatCount(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return `${value}`;
}

function mapFeedPost(row: Post): PostWithMeta {
  return {
    ...row,
    author: row.author_name,
    avatar: row.avatar || '',
    time: formatTimeAgo(row.created_at),
    likes: formatCount(row.like_count),
    comments: row.comment_count,
    liked: Boolean(row.liked),
    likeCount: row.like_count,
  };
}

export function PostsProvider({children}: {children: ReactNode}) {
  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const cursorRef = useRef<string | null>(null);
  const tagRef = useRef<string | undefined>(undefined);
  const requestIdRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const likingRef = useRef(new Set<string>());

  const refreshFeed = useCallback(async (tag?: string) => {
    tagRef.current = tag;
    const requestId = ++requestIdRef.current;
    cursorRef.current = null;
    setHasMore(true);
    setLoading(true);
    setFeedError(null);
    try {
      const page = await fetchFeedPage(tag);
      if (requestId !== requestIdRef.current) return;
      setPosts(page.posts.map(mapFeedPost));
      cursorRef.current = page.next_cursor;
      setHasMore(page.has_more);
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      setFeedError(
        error instanceof Error ? error.message : 'Unable to load the feed.',
      );
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const loadMorePosts = useCallback(async () => {
    if (!hasMore || loadingMoreRef.current || !cursorRef.current) return;
    const requestId = requestIdRef.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const page = await fetchFeedPage(tagRef.current, cursorRef.current);
      if (requestId !== requestIdRef.current) return;
      setPosts(current => {
        const existingIds = new Set(current.map(post => post.id));
        return [
          ...current,
          ...page.posts
            .filter(post => !existingIds.has(post.id))
            .map(mapFeedPost),
        ];
      });
      cursorRef.current = page.next_cursor;
      setHasMore(page.has_more);
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      setFeedError(
        error instanceof Error
          ? error.message
          : 'Unable to load more feed posts.',
      );
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMore]);

  useEffect(() => {
    let channel: ReturnType<typeof backend.channel> | null = null;
    let active = true;

    (async () => {
      await refreshFeed();

      try {
        channel = backend
          .channel('public:posts')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'posts',
            },
            () => {
              if (active) {
                refreshFeed();
              }
            },
          )
          .subscribe();
      } catch {
        // Realtime may not be configured yet; app still works with polling via refreshFeed
      }
    })();

    return () => {
      active = false;
      if (channel) {
        backend.removeChannel(channel);
      }
    };
  }, []);

  const addPost = async (
    post: Omit<
      PostWithMeta,
      | 'id'
      | 'time'
      | 'likes'
      | 'comments'
      | 'liked'
      | 'likeCount'
      | 'created_at'
      | 'updated_at'
    >,
  ) => {
    const created = await apiCreatePost({
      title: post.title,
      body: post.body ?? '',
      image: post.image ?? undefined,
      video: post.video ?? undefined,
      tag: post.tag,
      author_id: post.author_id,
      author_name: post.author_name,
      avatar: post.avatar,
      like_count: post.like_count,
      comment_count: post.comment_count,
    });

    if (created) {
      const optimistic: PostWithMeta = {
        ...created,
        author: created.author_name,
        avatar: created.avatar ?? '',
        time: 'Just now',
        likes: '0',
        comments: created.comment_count,
        liked: false,
        likeCount: created.like_count ?? 0,
      };
      setPosts(prev => [optimistic, ...prev]);
    }
  };

  const toggleLike = useCallback(
    async (id: string) => {
      if (likingRef.current.has(id)) return;
      const current = posts.find(post => post.id === id);
      if (!current) return;
      const previousLiked = current.liked;
      const previousCount = current.likeCount;
      const nextLiked = !previousLiked;
      likingRef.current.add(id);
      setPosts(prev =>
        prev.map(post =>
          post.id === id
            ? {
                ...post,
                liked: nextLiked,
                likeCount: Math.max(0, previousCount + (nextLiked ? 1 : -1)),
                likes: formatCount(
                  Math.max(0, previousCount + (nextLiked ? 1 : -1)),
                ),
              }
            : post,
        ),
      );
      try {
        const result = await setPostLiked(id, nextLiked);
        setPosts(prev =>
          prev.map(post =>
            post.id === id
              ? {
                  ...post,
                  liked: result.liked,
                  likeCount: result.like_count,
                  like_count: result.like_count,
                  likes: formatCount(result.like_count),
                }
              : post,
          ),
        );
      } catch (error) {
        setPosts(prev =>
          prev.map(post =>
            post.id === id
              ? {
                  ...post,
                  liked: previousLiked,
                  likeCount: previousCount,
                  likes: formatCount(previousCount),
                }
              : post,
          ),
        );
        throw error;
      } finally {
        likingRef.current.delete(id);
      }
    },
    [posts],
  );

  const addComment = useCallback(async (postId: string, text: string) => {
    const result = await createFeedComment(postId, text);
    setPosts(prev =>
      prev.map(post =>
        post.id === postId
          ? {
              ...post,
              comments: post.comments + 1,
              comment_count: post.comment_count + 1,
            }
          : post,
      ),
    );
    return result;
  }, []);

  const removeComment = useCallback(async (commentId: string) => {
    const result = await apiDeleteComment(commentId);
    setPosts(prev =>
      prev.map(post =>
        post.id === result.post_id
          ? {
              ...post,
              comments: result.comment_count,
              comment_count: result.comment_count,
            }
          : post,
      ),
    );
  }, []);

  return (
    <PostsContext.Provider
      value={{
        posts,
        loading,
        loadingMore,
        hasMore,
        feedError,
        addPost,
        toggleLike,
        addComment,
        removeComment,
        refreshFeed,
        loadMorePosts,
      }}>
      {children}
    </PostsContext.Provider>
  );
}

export function usePosts(): PostsContextValue {
  const ctx = useContext(PostsContext);
  if (!ctx) {
    throw new Error('usePosts must be used within a PostsProvider');
  }
  return ctx;
}

function formatTimeAgo(iso: string): string {
  const now = new Date();
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) {
    return 'Just now';
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) {
    return `${diffHour}h ago`;
  }
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) {
    return `${diffDay}d ago`;
  }
  return new Date(iso).toLocaleDateString();
}
