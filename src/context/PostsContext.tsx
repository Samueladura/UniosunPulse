import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import {supabase} from '../services/supabase';
import {
  Post,
  fetchPosts,
  toggleLike as doToggleLike,
  createPost as apiCreatePost,
  createComment as apiCreateComment,
} from '../services/supabase';

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
  addComment: (postId: string, text: string) => Promise<void>;
  refreshFeed: () => Promise<void>;
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

export function PostsProvider({children}: {children: ReactNode}) {
  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshFeed = async () => {
    try {
      const rows = await fetchPosts();
      const mapped: PostWithMeta[] = rows.map(row => ({
        id: row.id,
        author_id: row.author_id,
        author_name: row.author_name,
        author: row.author_name,
        avatar: row.avatar || '',
        title: row.title,
        body: row.body || '',
        image: row.image || '',
        tag: row.tag,
        like_count: row.like_count,
        comment_count: row.comment_count,
        time: formatTimeAgo(row.created_at),
        likes: formatCount(row.like_count),
        comments: row.comment_count,
        liked: false,
        likeCount: row.like_count,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));
      setPosts(mapped);
    } catch (e) {
      // keep existing posts if refresh fails
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let active = true;

    (async () => {
      await refreshFeed();

      try {
        channel = supabase
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
        supabase.removeChannel(channel);
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

  const toggleLike = async (id: string) => {
    const liked = await doToggleLike(id);
    setPosts(prev =>
      prev.map(p => {
        const newCount = liked ? p.likeCount + 1 : Math.max(p.likeCount - 1, 0);
        return {
          ...p,
          liked,
          likeCount: newCount,
          likes: formatCount(newCount),
        };
      }),
    );
  };

  const addComment = async (postId: string, text: string) => {
    const result = await apiCreateComment(postId, text);
    if (result) {
      setPosts(prev =>
        prev.map(p =>
          p.id === postId
            ? {
                ...p,
                comments: p.comments + 1,
                comment_count: p.comment_count + 1,
              }
            : p,
        ),
      );
    }
  };

  return (
    <PostsContext.Provider
      value={{posts, loading, addPost, toggleLike, addComment, refreshFeed}}>
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
