import {
  getCurrentSession,
  getCurrentUser,
  updateAuthUser,
  signInWithPassword as apiSignInWithPassword,
  requestPasswordReset,
  completePasswordReset,
  completeMfaSignIn as apiCompleteMfaSignIn,
  signUpWithPassword as apiSignUpWithPassword,
  signInWithOtp as apiSignInWithOtp,
  verifyOtp as apiVerifyOtp,
  enrollMfaFactor,
  getMfaFactors,
  createMfaChallenge,
  verifyMfaFactor,
  removeMfaFactor,
  signOutUser,
  rpcCall,
  dbQuery,
} from './api';
import {apiFetch, apiGet} from './api';

type BackendRow = Record<string, any>;
type BackendQueryResponse = {
  data: any;
  error: {message: string} | null;
  count: number | null;
};
type BackendUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, any>;
};
type BackendChannel = {
  on: (
    event: string,
    filter: Record<string, any>,
    callback: (payload: {new: BackendRow}) => void,
  ) => BackendChannel;
  subscribe: () => BackendChannel;
  unsubscribe: () => void;
};

class QueryBuilder {
  constructor(
    private readonly table: string,
    private readonly payload: any = {},
  ) {
    this.payload.operation = this.payload.operation ?? 'select';
    this.payload.filters = this.payload.filters ?? [];
    this.payload.select = this.payload.select ?? '*';
    this.payload.single = this.payload.single ?? false;
    this.payload.order = this.payload.order ?? null;
    this.payload.limit = this.payload.limit ?? null;
  }

  private clone() {
    return new QueryBuilder(
      this.table,
      JSON.parse(JSON.stringify(this.payload)),
    );
  }

  private applyFilter(column: string, op: string, value: any) {
    this.payload.filters = [
      ...(this.payload.filters ?? []),
      {column, op, value},
    ];
    return this;
  }

  select(fields = '*', options?: {count?: 'exact'; head?: boolean}) {
    this.payload.select = fields;
    this.payload.count = options?.count;
    this.payload.head = options?.head;
    return this;
  }

  eq(column: string, value: any) {
    return this.applyFilter(column, 'eq', value);
  }

  neq(column: string, value: any) {
    return this.applyFilter(column, 'neq', value);
  }

  gt(column: string, value: any) {
    return this.applyFilter(column, 'gt', value);
  }

  lt(column: string, value: any) {
    return this.applyFilter(column, 'lt', value);
  }

  gte(column: string, value: any) {
    return this.applyFilter(column, 'gte', value);
  }

  lte(column: string, value: any) {
    return this.applyFilter(column, 'lte', value);
  }

  contains(column: string, value: any) {
    return this.applyFilter(column, 'contains', value);
  }

  or(expression: string) {
    this.payload.filters = [
      ...(this.payload.filters ?? []),
      {column: '__or__', op: 'or', value: expression},
    ];
    return this;
  }

  order(column: string, options?: {ascending?: boolean}) {
    this.payload.order = {column, ascending: options?.ascending ?? true};
    return this;
  }

  limit(value: number) {
    this.payload.limit = value;
    return this;
  }

  maybeSingle() {
    this.payload.single = true;
    return this;
  }

  single() {
    this.payload.single = true;
    return this;
  }

  insert(data: any) {
    this.payload.operation = 'insert';
    this.payload.data = data;
    return this;
  }

  upsert(data: any) {
    this.payload.operation = 'upsert';
    this.payload.data = data;
    return this;
  }

  update(data: any) {
    this.payload.operation = 'update';
    this.payload.data = data;
    return this;
  }

  delete() {
    this.payload.operation = 'delete';
    this.payload.data = this.payload.data ?? {};
    return this;
  }

  async execute(): Promise<BackendQueryResponse> {
    const payload = {...this.payload};

    if (
      (payload.operation === 'update' || payload.operation === 'delete') &&
      payload.data &&
      !payload.data.id
    ) {
      const idFilter = (payload.filters || []).find(
        (filter: any) => filter.column === 'id' && filter.op === 'eq',
      );
      if (idFilter) {
        payload.data = {...payload.data, id: idFilter.value};
      }
    }

    const response = await dbQuery<BackendQueryResponse>(this.table, payload);
    return {
      data: response?.data ?? null,
      error: response?.error ?? null,
      count: response?.count ?? null,
    };
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?:
      | ((value: BackendQueryResponse) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }
}

async function authResult(
  request: Promise<any>,
): Promise<{data: any; error: {message: string} | null}> {
  try {
    const response = await request;
    return {data: response?.data ?? null, error: response?.error ?? null};
  } catch (error) {
    return {
      data: null,
      error: {
        message:
          error instanceof Error
            ? error.message
            : 'Authentication request failed.',
      },
    };
  }
}

function createAuthApi() {
  return {
    async getSession() {
      const result = await authResult(getCurrentSession());
      return {
        data: {session: result.data?.session ?? null},
        error: result.error,
      };
    },
    async getUser(): Promise<{
      data: {user: BackendUser | null};
      error: {message: string} | null;
    }> {
      const result = await authResult(getCurrentUser());
      return {data: {user: result.data?.user ?? null}, error: result.error};
    },
    async updateUser(payload: {data?: Record<string, any>; password?: string}) {
      return authResult(updateAuthUser(payload));
    },
    async signInWithPassword({
      email,
      password,
    }: {
      email: string;
      password: string;
    }) {
      return authResult(apiSignInWithPassword(email, password));
    },
    async requestPasswordReset({email}: {email: string}) {
      return authResult(requestPasswordReset(email));
    },
    async completePasswordReset({
      email,
      code,
      password,
    }: {
      email: string;
      code: string;
      password: string;
    }) {
      return authResult(completePasswordReset(email, code, password));
    },
    async completeMfaSignIn({
      challengeId,
      code,
    }: {
      challengeId: string;
      code: string;
    }) {
      return authResult(apiCompleteMfaSignIn(challengeId, code));
    },
    async signUp({
      email,
      password,
      options,
    }: {
      email: string;
      password: string;
      options?: {data?: Record<string, any>};
    }) {
      return authResult(apiSignUpWithPassword(email, password, options));
    },
    async signInWithOtp({
      email,
      options,
    }: {
      email: string;
      options?: {shouldCreateUser?: boolean};
    }) {
      return authResult(
        apiSignInWithOtp(email, options ?? {shouldCreateUser: false}),
      );
    },
    async verifyOtp({
      email,
      token,
      type,
    }: {
      email: string;
      token: string;
      type: string;
    }) {
      return authResult(apiVerifyOtp({email, token, type}));
    },
    async signOut() {
      return authResult(signOutUser());
    },
    onAuthStateChange(_callback: (event: string, session: any) => void) {
      return {
        data: {
          subscription: {
            unsubscribe: () => undefined,
          },
        },
      };
    },
    mfa: {
      async enroll(_params: {
        factorType: 'totp';
      }): Promise<{data: any; error: {message: string} | null}> {
        return authResult(enrollMfaFactor());
      },
      async challenge({
        factorId,
      }: {
        factorId: string;
      }): Promise<{data: any; error: {message: string} | null}> {
        return authResult(createMfaChallenge(factorId));
      },
      async verify({
        factorId,
        challengeId,
        code,
      }: {
        factorId: string;
        challengeId: string;
        code: string;
      }): Promise<{data: any; error: {message: string} | null}> {
        return authResult(verifyMfaFactor(factorId, challengeId, code));
      },
      async unenroll({
        factorId,
      }: {
        factorId: string;
      }): Promise<{data: any; error: {message: string} | null}> {
        return authResult(removeMfaFactor(factorId));
      },
      async listFactors(): Promise<{
        data: any;
        error: {message: string} | null;
      }> {
        return authResult(getMfaFactors());
      },
    },
  };
}

export const backend = {
  auth: createAuthApi(),
  from: (table: string) => new QueryBuilder(table),
  channel: (_name?: string): BackendChannel => {
    const listeners: Array<{
      event: string;
      table: string;
      filter?: string;
      callback: (payload: {new: BackendRow}) => void;
      snapshot: Map<string, string> | null;
    }> = [];
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let polling = false;
    const poll = async () => {
      if (polling) {
        return;
      }
      polling = true;
      try {
        for (const listener of listeners) {
          const filters = listener.filter?.match(
            /^([a-z_][a-z0-9_]*)=eq\.(true|false|[^,]+)$/i,
          );
          const response = await dbQuery<BackendQueryResponse>(listener.table, {
            operation: 'select',
            select: '*',
            filters: filters
              ? [
                  {
                    column: filters[1],
                    op: 'eq',
                    value:
                      filters[2] === 'true'
                        ? true
                        : filters[2] === 'false'
                        ? false
                        : filters[2],
                  },
                ]
              : [],
            order: {column: 'created_at', ascending: false},
            limit: 200,
          });
          const rows = Array.isArray(response.data)
            ? response.data
            : response.data
            ? [response.data]
            : [];
          const nextSnapshot = new Map(
            rows.map((row: BackendRow) => [
              String(row.id),
              JSON.stringify(row),
            ]),
          );
          if (listener.snapshot) {
            for (const row of rows) {
              const id = String(row.id);
              const exists = listener.snapshot.has(id);
              const changed = listener.snapshot.get(id) !== JSON.stringify(row);
              const shouldNotify =
                listener.event === '*' ||
                (listener.event === 'INSERT' && !exists) ||
                (listener.event === 'UPDATE' && exists && changed);
              if (shouldNotify) {
                listener.callback({new: row});
              }
            }
            if (listener.event === '*' || listener.event === 'DELETE') {
              for (const [id, oldRow] of listener.snapshot) {
                if (!nextSnapshot.has(id)) {
                  listener.callback({new: JSON.parse(oldRow)});
                }
              }
            }
          }
          listener.snapshot = nextSnapshot;
        }
      } catch (error) {
        console.error(
          'Backend polling failed:',
          error instanceof Error ? error.message : error,
        );
      } finally {
        polling = false;
      }
    };
    const channel: BackendChannel = {
      on: (event, filter, callback) => {
        listeners.push({
          event,
          table: String(filter.table || ''),
          filter: typeof filter.filter === 'string' ? filter.filter : undefined,
          callback,
          snapshot: null,
        });
        return channel;
      },
      subscribe: () => {
        poll();
        pollTimer = setInterval(() => poll(), 15000);
        return channel;
      },
      unsubscribe: () => {
        if (pollTimer) {
          clearInterval(pollTimer);
        }
        pollTimer = null;
      },
    };
    return channel;
  },
  removeChannel: (channel: BackendChannel) => channel.unsubscribe(),
  rpc: async (name: string, args: Record<string, any> = {}) => {
    const response = await rpcCall<{data?: any; error?: any}>(name, args);
    return {data: response?.data ?? null, error: response?.error ?? null};
  },
};

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
  } = await backend.auth.getUser();
  if (!user) {
    return null;
  }

  const metadata = user.user_metadata ?? {};

  let preferences = preferencesFromMetadata(metadata);

  try {
    const {data: profile} = await backend
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
    const {data, error} = await backend
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
    const {data: authUser} = await backend.auth.getUser();
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
  } = await backend.auth.getUser();
  if (!user) {
    return;
  }

  await backend.auth.updateUser({
    data: {
      ...user.user_metadata,
      ...preferences,
    },
  });

  try {
    await backend.from('profiles').upsert({
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
  } = await backend.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  const {error: authError} = await backend.auth.updateUser({
    data: {
      ...user.user_metadata,
      ...fields,
    },
  });
  if (authError) {
    return {error: authError.message};
  }

  try {
    const {error: dbError} = await backend.from('profiles').upsert({
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

export async function signInWithOtp(
  email: string,
  options?: {shouldCreateUser?: boolean},
): Promise<{error: string | null}> {
  try {
    const {error} = await backend.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: options?.shouldCreateUser ?? false,
      },
    });
    return {error: error ? error.message : null};
  } catch (e: any) {
    return {error: e?.message || 'An unexpected error occurred'};
  }
}

export async function changePassword(
  newPassword: string,
): Promise<{error: string | null}> {
  const {error} = await backend.auth.updateUser({password: newPassword});
  return {error: error ? error.message : null};
}

export async function signOut(): Promise<void> {
  await backend.auth.signOut();
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
  const {data, error} = await backend.auth.mfa.enroll({
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
  const {data, error} = await backend.auth.mfa.challenge({factorId});
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
  const {error} = await backend.auth.mfa.verify({
    factorId,
    challengeId,
    code,
  });
  return {error: error ? error.message : null};
}

export async function disableTwoFactor(
  factorId: string,
): Promise<{error: string | null}> {
  const {error} = await backend.auth.mfa.unenroll({factorId});
  return {error: error ? error.message : null};
}

export async function listTwoFactorFactors(): Promise<
  {id: string; friendly_name: string | null; status: string}[]
> {
  const {data, error} = await backend.auth.mfa.listFactors();
  if (error) {
    throw new Error(error.message);
  }
  return (data?.totp ?? []).map((factor: any) => ({
    id: factor.id,
    friendly_name: factor.friendly_name ?? null,
    status: factor.status,
  }));
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
  } = await backend.auth.getUser();
  if (!user) {
    return [];
  }
  try {
    const {data, error} = await backend
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
    await backend.from('blocked_users').delete().eq('id', recordId);
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
  } = await backend.auth.getUser();
  if (!user) {
    return;
  }
  try {
    await backend.from('login_history').insert({
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
  } = await backend.auth.getUser();
  if (!user) {
    return [];
  }
  try {
    const {data, error} = await backend
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
  } = await backend.auth.getUser();
  if (!user) {
    return;
  }
  await backend.auth.updateUser({
    data: {...user.user_metadata, language},
  });
  try {
    await backend
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
  video?: string | null;
  tag: string;
  like_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
  liked?: boolean;
}

export interface PostCreate {
  title: string;
  body?: string;
  image?: string;
  video?: string;
  tag?: string;
  author_id?: string;
  author_name?: string;
  avatar?: string | null;
  like_count?: number;
  comment_count?: number;
}

export async function fetchPosts(tag?: string): Promise<Post[]> {
  let query = backend
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

export type FeedPage = {
  posts: Post[];
  has_more: boolean;
  next_cursor: string | null;
};

export async function fetchFeedPage(
  tag?: string,
  cursor?: string | null,
): Promise<FeedPage> {
  const response = await apiGet<{
    data: FeedPage;
    error?: {message?: string} | null;
  }>('/feed', {tag: tag && tag !== 'ALL' ? tag : undefined, cursor});
  if (response.error) {
    throw new Error(
      response.error.message || 'Unable to load the campus feed.',
    );
  }
  return response.data;
}

export async function setPostLiked(
  postId: string,
  liked: boolean,
): Promise<{liked: boolean; like_count: number}> {
  const response = await apiFetch<{
    data: {liked: boolean; like_count: number};
    error?: {message?: string} | null;
  }>(`/posts/${encodeURIComponent(postId)}/like`, {
    method: 'PUT',
    body: JSON.stringify({liked}),
  });
  if (response.error) {
    throw new Error(response.error.message || 'Unable to update this like.');
  }
  return response.data;
}

export async function createFeedComment(
  postId: string,
  body: string,
): Promise<Comment> {
  const response = await apiFetch<{
    data: Comment;
    error?: {message?: string} | null;
  }>(`/posts/${encodeURIComponent(postId)}/comments`, {
    method: 'POST',
    body: JSON.stringify({body}),
  });
  if (response.error) {
    throw new Error(
      response.error.message || 'Unable to publish your comment.',
    );
  }
  return response.data;
}

export async function fetchPostById(id: string): Promise<Post | null> {
  const {data, error} = await backend
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
  } = await backend.auth.getUser();
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
    video: post.video || null,
    tag: (post.tag || 'ANNOUNCEMENTS').toUpperCase(),
    like_count: post.like_count ?? 0,
    comment_count: post.comment_count ?? 0,
  };

  const {data, error} = await backend
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
  const liked = await hasUserLiked(postId);
  return (await setPostLiked(postId, !liked)).liked;
}

export async function getLikeCount(postId: string): Promise<number> {
  const {count} = await backend
    .from('likes')
    .select('*', {count: 'exact', head: true})
    .eq('post_id', postId);
  return count || 0;
}

export async function hasUserLiked(postId: string): Promise<boolean> {
  const {
    data: {user},
  } = await backend.auth.getUser();
  if (!user) {
    return false;
  }

  const {data} = await backend
    .from('likes')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', user.id)
    .maybeSingle();

  return !!data;
}

export async function deletePost(postId: string): Promise<void> {
  try {
    await backend.from('posts').delete().eq('id', postId);
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
  const {data, error} = await backend
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
  return createFeedComment(postId, body);
}

export async function deleteComment(
  commentId: string,
): Promise<{post_id: string; comment_count: number}> {
  const response = await apiFetch<{
    data: {post_id: string; comment_count: number};
    error?: {message?: string} | null;
  }>(`/comments/${encodeURIComponent(commentId)}`, {method: 'DELETE'});
  if (response.error) {
    throw new Error(response.error.message || 'Unable to remove this comment.');
  }
  return response.data;
}

// ---------------------------------------------------------------------------
// Follows
// ---------------------------------------------------------------------------
export async function followUser(followingId: string): Promise<void> {
  const {
    data: {user},
  } = await backend.auth.getUser();
  if (!user) {
    return;
  }

  await backend
    .from('follows')
    .upsert({follower_id: user.id, following_id: followingId});
}

export async function unfollowUser(followingId: string): Promise<void> {
  const {
    data: {user},
  } = await backend.auth.getUser();
  if (!user) {
    return;
  }

  await backend
    .from('follows')
    .delete()
    .eq('follower_id', user.id)
    .eq('following_id', followingId);
}

export async function isFollowing(followingId: string): Promise<boolean> {
  const {
    data: {user},
  } = await backend.auth.getUser();
  if (!user) {
    return false;
  }

  const {data} = await backend
    .from('follows')
    .select('id')
    .eq('follower_id', user.id)
    .eq('following_id', followingId)
    .maybeSingle();

  return !!data;
}

export async function getFollowerCount(userId: string): Promise<number> {
  const {count} = await backend
    .from('follows')
    .select('*', {count: 'exact', head: true})
    .eq('following_id', userId);
  return count || 0;
}

export async function getFollowingCount(userId: string): Promise<number> {
  const {count} = await backend
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
  const {data} = await backend
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
  const {data} = await backend
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
  } = await backend.auth.getUser();
  if (!user) {
    return [];
  }

  const {data, error} = await backend
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
  } = await backend.auth.getUser();
  if (!user) {
    return;
  }

  await backend.from('alerts').insert({
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
  await backend.from('alerts').update({unread: false}).eq('id', id);
}

export async function markAllAlertsRead(): Promise<void> {
  const {
    data: {user},
  } = await backend.auth.getUser();
  if (!user) {
    return;
  }

  await backend
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
  position_id: string | null;
  department: string | null;
  manifesto: string | null;
  avatar_url: string | null;
  created_at: string;
}

export async function fetchElections(): Promise<Election[]> {
  const {data, error} = await backend
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
  const {data, error} = await backend
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
  const {data, error} = await backend
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
    position_id: row.position_id ?? null,
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
  } = await backend.auth.getUser();
  if (!user) {
    throw new Error('You must be signed in to vote.');
  }

  try {
    const {data, error} = await backend.rpc('cast_vote', {
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
    const isRpcMissing =
      message.includes('function') && message.includes('does not exist');

    if (!isRpcMissing) {
      throw new Error(message || 'Failed to cast vote.');
    }

    const {data: existing} = await backend
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

    const {error: insertError} = await backend.from('election_votes').insert({
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
      backend
        .from('election_candidates')
        .select('vote_count')
        .eq('id', candidateId)
        .single(),
      backend
        .from('elections')
        .select('total_votes')
        .eq('id', electionId)
        .single(),
    ]);

    await Promise.all([
      backend
        .from('election_candidates')
        .update({vote_count: (cand?.vote_count || 0) + 1})
        .eq('id', candidateId),
      backend
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
  const {data, error} = await backend
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
  const {data, error} = await backend
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
  } = await backend.auth.getUser();
  if (!user) {
    return [];
  }

  const {data, error} = await backend
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
  const {count, error} = await backend
    .from('election_votes')
    .select('*', {count: 'exact', head: true})
    .eq('election_id', electionId);

  if (error) {
    return 0;
  }
  return count || 0;
}
