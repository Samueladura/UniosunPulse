import 'react-native-url-polyfill/auto';
import {createClient} from '@supabase/supabase-js';
import {SUPABASE_URL, SUPABASE_ANON_KEY} from '@env';

export const SECRET_PROJECT_ID = 'tdyfwzwtulnufkpfbwui';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export interface UserPreferences {
  public_visibility: boolean;
  campus_feed_alerts: boolean;
  election_reminders: boolean;
  admin_broadcasts: boolean;
  dark_mode: boolean;
  text_size: number;
  anonymous_posting: boolean;
  language: string;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  public_visibility: true,
  campus_feed_alerts: true,
  election_reminders: true,
  admin_broadcasts: true,
  dark_mode: false,
  text_size: 1,
  anonymous_posting: false,
  language: 'en-NG',
};

export interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  department: string | null;
  matric_number: string | null;
  verified: boolean;
  preferences: UserPreferences;
}

function preferencesFromMetadata(
  metadata: Record<string, any> | undefined,
): UserPreferences {
  if (!metadata) {
    return {...DEFAULT_PREFERENCES};
  }
  return {
    public_visibility:
      metadata.public_visibility ?? DEFAULT_PREFERENCES.public_visibility,
    campus_feed_alerts:
      metadata.campus_feed_alerts ?? DEFAULT_PREFERENCES.campus_feed_alerts,
    election_reminders:
      metadata.election_reminders ?? DEFAULT_PREFERENCES.election_reminders,
    admin_broadcasts:
      metadata.admin_broadcasts ?? DEFAULT_PREFERENCES.admin_broadcasts,
    dark_mode: metadata.dark_mode ?? DEFAULT_PREFERENCES.dark_mode,
    text_size: metadata.text_size ?? DEFAULT_PREFERENCES.text_size,
    anonymous_posting:
      metadata.anonymous_posting ?? DEFAULT_PREFERENCES.anonymous_posting,
    language: metadata.language ?? DEFAULT_PREFERENCES.language,
  };
}

export async function fetchUserProfile(): Promise<UserProfile | null> {
  const {
    data: {user},
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  const metadata = user.user_metadata ?? {};

  let preferences = preferencesFromMetadata(metadata);

  try {
    const {data: profile} = await supabase
      .from('profiles')
      .select(
        'full_name, avatar_url, department, matric_number, verified, preferences',
      )
      .eq('id', user.id)
      .maybeSingle();

    if (profile) {
      if (profile.preferences) {
        preferences = {...preferences, ...profile.preferences};
      }
      return {
        id: user.id,
        full_name: profile.full_name ?? metadata.full_name ?? null,
        email: user.email ?? null,
        avatar_url: profile.avatar_url ?? metadata.avatar_url ?? null,
        department: profile.department ?? metadata.department ?? null,
        matric_number: profile.matric_number ?? null,
        verified: profile.verified ?? false,
        preferences,
      };
    }
  } catch {
    // profiles table may not exist yet; fall back to user_metadata only.
  }

  return {
    id: user.id,
    full_name: metadata.full_name ?? null,
    email: user.email ?? null,
    avatar_url: metadata.avatar_url ?? null,
    department: metadata.department ?? null,
    matric_number: metadata.matric_number ?? null,
    verified: metadata.verified ?? false,
    preferences,
  };
}

export async function fetchUserProfileById(
  userId: string,
): Promise<UserProfile | null> {
  try {
    const {data, error} = await supabase
      .from('profiles')
      .select(
        'id, full_name, avatar_url, department, matric_number, verified, preferences',
      )
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      return null;
    }

    if (data) {
      return {
        id: data.id,
        full_name: data.full_name ?? null,
        email: null,
        avatar_url: data.avatar_url ?? null,
        department: data.department ?? null,
        matric_number: data.matric_number ?? null,
        verified: data.verified ?? false,
        preferences: data.preferences ?? DEFAULT_PREFERENCES,
      };
    }
  } catch {
    // profiles table may not exist
  }

  try {
    const {data: authUser} = await supabase.auth.getUser();
    if (authUser.user && authUser.user.id === userId) {
      const metadata = authUser.user.user_metadata ?? {};
      return {
        id: userId,
        full_name: metadata.full_name ?? null,
        email: authUser.user.email ?? null,
        avatar_url: metadata.avatar_url ?? null,
        department: metadata.department ?? null,
        matric_number: metadata.matric_number ?? null,
        verified: metadata.verified ?? false,
        preferences: preferencesFromMetadata(metadata),
      };
    }
  } catch {
    // ignore
  }

  return null;
}

export async function savePreferences(
  preferences: UserPreferences,
): Promise<void> {
  const {
    data: {user},
  } = await supabase.auth.getUser();
  if (!user) {
    return;
  }

  await supabase.auth.updateUser({
    data: {
      ...user.user_metadata,
      ...preferences,
    },
  });

  try {
    await supabase.from('profiles').upsert({
      id: user.id,
      preferences,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // profiles table not required for the feature to work.
  }
}

export async function updateProfile(fields: {
  full_name?: string;
  avatar_url?: string;
  department?: string;
  matric_number?: string;
}): Promise<{error: string | null}> {
  const {
    data: {user},
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  const {error: authError} = await supabase.auth.updateUser({
    data: {
      ...user.user_metadata,
      ...fields,
    },
  });
  if (authError) {
    return {error: authError.message};
  }

  try {
    const {error: dbError} = await supabase.from('profiles').upsert({
      id: user.id,
      ...fields,
      updated_at: new Date().toISOString(),
    });
    if (dbError) {
      return {error: dbError.message};
    }
  } catch {
    // profiles table not required.
  }

  return {error: null};
}

export async function changePassword(
  newPassword: string,
): Promise<{error: string | null}> {
  const {error} = await supabase.auth.updateUser({password: newPassword});
  return {error: error ? error.message : null};
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

// ---------------------------------------------------------------------------
// Two-Factor Authentication (TOTP)
// ---------------------------------------------------------------------------
export async function enableTwoFactor(): Promise<{
  error: string | null;
  qrCodeDataUrl?: string;
  secret?: string;
  factorId?: string;
}> {
  const {data, error} = await supabase.auth.mfa.enroll({
    factorType: 'totp',
  });
  if (error) {
    return {error: error.message};
  }
  return {
    error: null,
    qrCodeDataUrl: data?.totp?.qr_code,
    secret: data?.totp?.secret,
    factorId: data?.id,
  };
}

export async function challengeTwoFactor(factorId: string): Promise<{
  error: string | null;
  challengeId?: string;
}> {
  const {data, error} = await supabase.auth.mfa.challenge({factorId});
  if (error) {
    return {error: error.message};
  }
  return {error: null, challengeId: data?.id};
}

export async function verifyTwoFactor(
  factorId: string,
  challengeId: string,
  code: string,
): Promise<{error: string | null}> {
  const {error} = await supabase.auth.mfa.verify({
    factorId,
    challengeId,
    code,
  });
  return {error: error ? error.message : null};
}

export async function disableTwoFactor(
  factorId: string,
): Promise<{error: string | null}> {
  const {error} = await supabase.auth.mfa.unenroll({factorId});
  return {error: error ? error.message : null};
}

export async function listTwoFactorFactors(): Promise<
  {id: string; friendly_name: string | null; status: string}[]
> {
  try {
    const {data, error} = await supabase.auth.mfa.listFactors();
    if (error || !data) {
      return [];
    }
    return (data.totp ?? []).map((f: any) => ({
      id: f.id,
      friendly_name: f.friendly_name ?? null,
      status: f.status,
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Blocked Users
// ---------------------------------------------------------------------------
export interface BlockedUser {
  id: string;
  blocked_id: string;
  full_name: string | null;
  handle: string | null;
  avatar_url: string | null;
  created_at: string;
}

export async function fetchBlockedUsers(): Promise<BlockedUser[]> {
  const {
    data: {user},
  } = await supabase.auth.getUser();
  if (!user) {
    return [];
  }
  try {
    const {data, error} = await supabase
      .from('blocked_users')
      .select('id, blocked_id, full_name, handle, avatar_url, created_at')
      .eq('user_id', user.id)
      .order('created_at', {ascending: false});
    if (error) {
      return [];
    }
    return (data ?? []) as BlockedUser[];
  } catch {
    return [];
  }
}

export async function unblockUser(recordId: string): Promise<void> {
  try {
    await supabase.from('blocked_users').delete().eq('id', recordId);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Login History
// ---------------------------------------------------------------------------
export interface LoginEvent {
  id: string;
  created_at: string;
  ip_address: string | null;
  device: string | null;
  location: string | null;
}

export async function recordLoginEvent(meta?: {
  device?: string;
  location?: string;
}): Promise<void> {
  const {
    data: {user},
  } = await supabase.auth.getUser();
  if (!user) {
    return;
  }
  try {
    await supabase.from('login_history').insert({
      user_id: user.id,
      device: meta?.device ?? null,
      location: meta?.location ?? null,
      created_at: new Date().toISOString(),
    });
  } catch {
    // table not required
  }
}

export async function fetchLoginHistory(): Promise<LoginEvent[]> {
  const {
    data: {user},
  } = await supabase.auth.getUser();
  if (!user) {
    return [];
  }
  try {
    const {data, error} = await supabase
      .from('login_history')
      .select('id, created_at, ip_address, device, location')
      .eq('user_id', user.id)
      .order('created_at', {ascending: false})
      .limit(20);
    if (error) {
      return [];
    }
    return (data ?? []) as LoginEvent[];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Languages
// ---------------------------------------------------------------------------
export const SUPPORTED_LANGUAGES = [
  {code: 'en-NG', label: 'English (Nigeria)'},
  {code: 'yo', label: 'Yoruba'},
  {code: 'en-GB', label: 'English (UK)'},
  {code: 'fr', label: 'French'},
] as const;

export async function saveLanguage(language: string): Promise<void> {
  const {
    data: {user},
  } = await supabase.auth.getUser();
  if (!user) {
    return;
  }
  await supabase.auth.updateUser({
    data: {...user.user_metadata, language},
  });
  try {
    await supabase
      .from('profiles')
      .upsert({id: user.id, language, updated_at: new Date().toISOString()});
  } catch {
    // ignore
  }
}

export function getLanguageLabel(code: string | null | undefined): string {
  if (!code) {
    return 'English (Nigeria)';
  }
  return SUPPORTED_LANGUAGES.find(l => l.code === code)?.label ?? code;
}

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------
export interface Post {
  id: string;
  author_id: string;
  author_name: string;
  avatar: string | null;
  title: string;
  body: string | null;
  image: string | null;
  tag: string;
  like_count: number;
  comment_count: number;
  liked?: boolean;
  created_at: string;
  updated_at: string;
}

export interface PostCreate {
  title: string;
  body?: string;
  image?: string;
  tag?: string;
  author_id?: string;
  author_name?: string;
  avatar?: string | null;
  like_count?: number;
  comment_count?: number;
}

export async function fetchPosts(tag?: string): Promise<Post[]> {
  let query = supabase
    .from('posts')
    .select('*')
    .order('created_at', {ascending: false});

  if (tag && tag !== 'ALL') {
    query = query.eq('tag', tag);
  }

  const {data, error} = await query;
  if (error || !data) {
    return [];
  }
  return data as Post[];
}

export async function fetchPostById(id: string): Promise<Post | null> {
  const {data, error} = await supabase
    .from('posts')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return data as Post;
}

export async function createPost(post: PostCreate): Promise<Post> {
  const {
    data: {user},
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  const profile = await fetchUserProfile();
  const authorName = post.author_name || profile?.full_name || 'Anonymous';
  const avatar = post.avatar ?? profile?.avatar_url ?? null;

  const newPost: any = {
    id:
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    author_id: post.author_id || user.id,
    author_name: authorName,
    avatar,
    title: post.title,
    body: post.body || null,
    image: post.image || null,
    tag: (post.tag || 'ANNOUNCEMENTS').toUpperCase(),
    like_count: post.like_count ?? 0,
    comment_count: post.comment_count ?? 0,
  };

  const {data, error} = await supabase
    .from('posts')
    .insert(newPost)
    .select()
    .single();

  if (error) {
    throw new Error(error.message || 'Failed to create post');
  }
  return data as Post;
}

// ---------------------------------------------------------------------------
// Likes / Votes
// ---------------------------------------------------------------------------
export async function toggleLike(postId: string): Promise<boolean> {
  const {
    data: {user},
  } = await supabase.auth.getUser();
  if (!user) {
    return false;
  }

  const {data: existing} = await supabase
    .from('likes')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    await supabase.from('likes').delete().eq('id', existing.id);
    await supabase.rpc('decrement_like', {post_id: postId});
    return false;
  }

  await supabase.from('likes').insert({post_id: postId, user_id: user.id});
  await supabase.rpc('increment_like', {post_id: postId});
  return true;
}

export async function getLikeCount(postId: string): Promise<number> {
  const {count} = await supabase
    .from('likes')
    .select('*', {count: 'exact', head: true})
    .eq('post_id', postId);
  return count || 0;
}

export async function hasUserLiked(postId: string): Promise<boolean> {
  const {
    data: {user},
  } = await supabase.auth.getUser();
  if (!user) {
    return false;
  }

  const {data} = await supabase
    .from('likes')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', user.id)
    .maybeSingle();

  return !!data;
}

export async function deletePost(postId: string): Promise<void> {
  try {
    await supabase.from('posts').delete().eq('id', postId);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Comments (delete already exists above)
// ---------------------------------------------------------------------------
export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  author_name: string;
  avatar: string | null;
  body: string;
  created_at: string;
}

export async function fetchComments(postId: string): Promise<Comment[]> {
  const {data, error} = await supabase
    .from('comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', {ascending: true});
  if (error || !data) {
    return [];
  }
  return data as Comment[];
}

export async function createComment(
  postId: string,
  body: string,
): Promise<Comment | null> {
  const {
    data: {user},
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  const profile = await fetchUserProfile();

  const comment: any = {
    id:
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    post_id: postId,
    user_id: user.id,
    author_name: profile?.full_name || 'Anonymous',
    avatar: profile?.avatar_url || null,
    body,
  };

  const {data, error} = await supabase
    .from('comments')
    .insert(comment)
    .select()
    .single();

  if (error) {
    return null;
  }

  await supabase.rpc('increment_comment', {post_id: postId});
  return data as Comment;
}

export async function deleteComment(commentId: string): Promise<void> {
  const {
    data: {user},
  } = await supabase.auth.getUser();
  if (!user) {
    return;
  }

  const {data: comment} = await supabase
    .from('comments')
    .select('post_id')
    .eq('id', commentId)
    .eq('user_id', user.id)
    .maybeSingle();

  await supabase.from('comments').delete().eq('id', commentId);

  if (comment?.post_id) {
    await supabase.rpc('decrement_comment', {post_id: comment.post_id});
  }
}

// ---------------------------------------------------------------------------
// Follows
// ---------------------------------------------------------------------------
export async function followUser(followingId: string): Promise<void> {
  const {
    data: {user},
  } = await supabase.auth.getUser();
  if (!user) {
    return;
  }

  await supabase
    .from('follows')
    .upsert({follower_id: user.id, following_id: followingId});
}

export async function unfollowUser(followingId: string): Promise<void> {
  const {
    data: {user},
  } = await supabase.auth.getUser();
  if (!user) {
    return;
  }

  await supabase
    .from('follows')
    .delete()
    .eq('follower_id', user.id)
    .eq('following_id', followingId);
}

export async function isFollowing(followingId: string): Promise<boolean> {
  const {
    data: {user},
  } = await supabase.auth.getUser();
  if (!user) {
    return false;
  }

  const {data} = await supabase
    .from('follows')
    .select('id')
    .eq('follower_id', user.id)
    .eq('following_id', followingId)
    .maybeSingle();

  return !!data;
}

export async function getFollowerCount(userId: string): Promise<number> {
  const {count} = await supabase
    .from('follows')
    .select('*', {count: 'exact', head: true})
    .eq('following_id', userId);
  return count || 0;
}

export async function getFollowingCount(userId: string): Promise<number> {
  const {count} = await supabase
    .from('follows')
    .select('*', {count: 'exact', head: true})
    .eq('follower_id', userId);
  return count || 0;
}

export async function getFollowers(
  userId: string,
): Promise<
  {id: string; full_name: string | null; avatar_url: string | null}[]
> {
  const {data} = await supabase
    .from('follows')
    .select(
      'follower_id, follower:profiles!follower_id(id, full_name, avatar_url)',
    )
    .eq('following_id', userId);

  if (!data) {
    return [];
  }

  return data.map((r: any) => ({
    id: r.follower_id,
    full_name: r.follower?.full_name ?? null,
    avatar_url: r.follower?.avatar_url ?? null,
  }));
}

export async function getFollowing(
  userId: string,
): Promise<
  {id: string; full_name: string | null; avatar_url: string | null}[]
> {
  const {data} = await supabase
    .from('follows')
    .select(
      'following_id, following:profiles!following_id(id, full_name, avatar_url)',
    )
    .eq('follower_id', userId);

  if (!data) {
    return [];
  }

  return data.map((r: any) => ({
    id: r.following_id,
    full_name: r.following?.full_name ?? null,
    avatar_url: r.following?.avatar_url ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------
export interface Alert {
  id: string;
  user_id: string;
  category: string;
  title: string;
  body: string | null;
  unread: boolean;
  is_broadcast: boolean;
  created_at: string;
}

export async function fetchAlerts(): Promise<Alert[]> {
  const {
    data: {user},
  } = await supabase.auth.getUser();
  if (!user) {
    return [];
  }

  const {data, error} = await supabase
    .from('alerts')
    .select('*')
    .or(`user_id.eq.'${user.id}',is_broadcast.eq.true`)
    .order('created_at', {ascending: false})
    .limit(50);

  if (error || !data) {
    return [];
  }
  return data as Alert[];
}

export async function createAlert(alert: {
  category: string;
  title: string;
  body?: string;
  is_broadcast?: boolean;
}): Promise<void> {
  const {
    data: {user},
  } = await supabase.auth.getUser();
  if (!user) {
    return;
  }

  await supabase.from('alerts').insert({
    id:
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    user_id: user.id,
    category: alert.category,
    title: alert.title,
    body: alert.body || null,
    unread: true,
    is_broadcast: alert.is_broadcast ?? false,
  });
}

export async function markAlertRead(id: string): Promise<void> {
  await supabase.from('alerts').update({unread: false}).eq('id', id);
}

export async function markAllAlertsRead(): Promise<void> {
  const {
    data: {user},
  } = await supabase.auth.getUser();
  if (!user) {
    return;
  }

  await supabase
    .from('alerts')
    .update({unread: false})
    .or(`user_id.eq.'${user.id}',is_broadcast.eq.true`);
}

export interface Election {
  id: string;
  title: string;
  description: string | null;
  faculty: string | null;
  image_url: string | null;
  status: 'draft' | 'active' | 'closed';
  start_at: string;
  end_at: string;
  created_at: string;
}

export interface Position {
  id: string;
  election_id: string;
  title: string;
  description: string | null;
  sort_order: number;
}

export interface Candidate {
  id: string;
  election_id: string;
  name: string;
  position: string;
  department: string | null;
  manifesto: string | null;
  avatar_url: string | null;
  created_at: string;
}

export async function fetchElections(): Promise<Election[]> {
  const {data, error} = await supabase
    .from('elections')
    .select('*')
    .eq('status', 'active')
    .order('start_at', {ascending: true});

  if (error || !data) {
    return [];
  }
  return data as Election[];
}

export async function fetchPositions(electionId: string): Promise<Position[]> {
  const {data, error} = await supabase
    .from('positions')
    .select('*')
    .eq('election_id', electionId)
    .order('sort_order', {ascending: true});

  if (error || !data) {
    return [];
  }
  return data as Position[];
}

export async function fetchCandidates(
  electionId: string,
): Promise<Candidate[]> {
  const {data, error} = await supabase
    .from('election_candidates')
    .select('*')
    .eq('election_id', electionId)
    .order('created_at', {ascending: true});

  if (error || !data) {
    return [];
  }

  return data.map((row: any) => ({
    id: row.id,
    election_id: row.election_id,
    name: row.name,
    position: row.position,
    department: row.department ?? null,
    manifesto: row.manifesto ?? null,
    avatar_url: row.avatar_url ?? null,
    created_at: row.created_at,
  })) as Candidate[];
}

export async function castVote(
  electionId: string,
  positionId: string,
  candidateId: string,
): Promise<{receiptId: string | null; isDuplicate: boolean}> {
  const {
    data: {user},
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('You must be signed in to vote.');
  }

  try {
    const {data, error} = await supabase.rpc('cast_vote', {
      p_election_id: electionId,
      p_position_id: positionId,
      p_candidate_id: candidateId,
      p_user_id: user.id,
    });

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error('Vote failed. No response from server.');
    }

    const result = data as {receipt_hash: string; is_duplicate: boolean};
    return {receiptId: result.receipt_hash, isDuplicate: result.is_duplicate};
  } catch (rpcError: any) {
    const message = rpcError?.message || '';
    const isRpcMissing = message.includes('function') && message.includes('does not exist');

    if (!isRpcMissing) {
      throw new Error(message || 'Failed to cast vote.');
    }

    const {data: existing} = await supabase
      .from('election_votes')
      .select('receipt_hash')
      .eq('election_id', electionId)
      .eq('voter_id', user.id)
      .eq('position_id', positionId)
      .maybeSingle();

    if (existing) {
      return {receiptId: existing.receipt_hash, isDuplicate: true};
    }

    const receiptHash =
      'BAL-' +
      Array.from(new Uint8Array(3))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('') +
      '-' +
      Array.from(new Uint8Array(4))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    const {error: insertError} = await supabase
      .from('election_votes')
      .insert({
        election_id: electionId,
        voter_id: user.id,
        candidate_id: candidateId,
        position_id: positionId,
        receipt_hash: receiptHash,
      });

    if (insertError) {
      throw new Error(insertError.message || 'Failed to record vote.');
    }

    const [{data: cand}, {data: election}] = await Promise.all([
      supabase
        .from('election_candidates')
        .select('vote_count')
        .eq('id', candidateId)
        .single(),
      supabase
        .from('elections')
        .select('total_votes')
        .eq('id', electionId)
        .single(),
    ]);

    await Promise.all([
      supabase
        .from('election_candidates')
        .update({vote_count: (cand?.vote_count || 0) + 1})
        .eq('id', candidateId),
      supabase
        .from('elections')
        .update({total_votes: (election?.total_votes || 0) + 1})
        .eq('id', electionId),
    ]);

    return {receiptId: receiptHash, isDuplicate: false};
  }
}

export async function fetchElectionResults(
  electionId: string,
): Promise<
  {candidateId: string; name: string; photo_url: string | null; votes: number}[]
> {
  const {data, error} = await supabase
    .from('election_candidates')
    .select('id, name, avatar_url, vote_count')
    .eq('election_id', electionId)
    .order('vote_count', {ascending: false});

  if (error || !data) {
    return [];
  }
  return data.map((c: any) => ({
    candidateId: c.id,
    name: c.name,
    photo_url: c.avatar_url,
    votes: c.vote_count || 0,
  }));
}

export interface BallotReceipt {
  id: string;
  election_id: string;
  position_id: string;
  candidate_id: string;
  candidate_name: string;
  receipt_hash: string;
  created_at: string;
}

export async function fetchBallotReceipts(
  electionId: string,
): Promise<BallotReceipt[]> {
  const {data, error} = await supabase
    .from('election_votes')
    .select(
      'id, election_id, position_id, candidate_id, receipt_hash, created_at, candidate:election_candidates(name)',
    )
    .eq('election_id', electionId)
    .order('created_at', {ascending: false});

  if (error || !data) {
    return [];
  }

  return data.map((row: any) => ({
    id: row.id,
    election_id: row.election_id,
    position_id: row.position_id,
    candidate_id: row.candidate_id,
    candidate_name: row.candidate?.name || 'Unknown',
    receipt_hash: row.receipt_hash,
    created_at: row.created_at,
  }));
}

export async function fetchUserVotedPositions(
  electionId: string,
): Promise<string[]> {
  const {
    data: {user},
  } = await supabase.auth.getUser();
  if (!user) {
    return [];
  }

  const {data, error} = await supabase
    .from('election_votes')
    .select('position_id')
    .eq('election_id', electionId)
    .eq('user_id', user.id);

  if (error || !data) {
    return [];
  }
  return data.map((row: any) => row.position_id);
}

export async function getTotalVotes(electionId: string): Promise<number> {
  const {count, error} = await supabase
    .from('election_votes')
    .select('*', {count: 'exact', head: true})
    .eq('election_id', electionId);

  if (error) {
    return 0;
  }
  return count || 0;
}
