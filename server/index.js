require('dotenv').config();

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const express = require('express');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');
const {Pool} = require('pg');
const {z} = require('zod');
const {
  decryptSecret,
  encryptSecret,
  generateTotpSecret,
  hashChallenge,
  verifyTotp,
} = require('./mfa');

const app = express();
const port = Number(process.env.PORT || 4000);
const connectionString =
  process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
const jwtSecret = process.env.JWT_SECRET;

if (!connectionString) {
  throw new Error('DATABASE_URL or NEON_DATABASE_URL is required.');
}
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error(
    'JWT_SECRET must be set to a random value of at least 32 characters.',
  );
}

const pool = new Pool({
  connectionString,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

const allowedTables = new Set([
  'profiles',
  'posts',
  'likes',
  'comments',
  'follows',
  'alerts',
  'blocked_users',
  'login_history',
  'student_verifications',
  'reported_posts',
  'campus_events',
  'event_rsvps',
  'marketplace_listings',
  'reported_marketplace_listings',
  'saved_items',
  'career_opportunities',
  'opportunity_applications',
  'clubs',
  'club_memberships',
  'elections',
  'positions',
  'election_candidates',
  'election_votes',
  'admin_audit_logs',
]);
const columnCache = new Map();
const emailSchema = z.string().trim().toLowerCase().email();

function parseEmail(value) {
  const parsed = emailSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({origin: process.env.CORS_ORIGIN?.split(',') || true}));
app.use(express.json({limit: '2mb'}));
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) =>
    sendError(
      res,
      429,
      'Too many authentication requests. Please wait before trying again.',
    ),
});
const signInRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) =>
    sendError(
      res,
      429,
      'Too many sign-in attempts. Please wait 15 minutes before trying again.',
    ),
});
app.use('/api/auth', authRateLimit);

function asyncRoute(handler) {
  return (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);
}

function sendError(res, status, message) {
  return res.status(status).json({message});
}

function requireAdmin(req, res) {
  if (req.user.role === 'admin') {
    return true;
  }
  sendError(res, 403, 'Administrator access is required.');
  return false;
}

function getEmailTransport() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) {
    return null;
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? {user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD}
      : undefined,
  });
}

async function createMfaChallenge(client, userId, factorId, purpose) {
  const challenge = crypto.randomBytes(32).toString('base64url');
  await client.query(
    `DELETE FROM two_factor_challenges
     WHERE user_id = $1 AND (expires_at <= now() OR consumed_at IS NOT NULL)`,
    [userId],
  );
  await client.query(
    `INSERT INTO two_factor_challenges
       (challenge_hash, user_id, factor_id, purpose, expires_at)
     VALUES ($1, $2, $3, $4, now() + interval '5 minutes')`,
    [hashChallenge(challenge), userId, factorId, purpose],
  );
  return challenge;
}

async function verifyMfaChallenge(
  client,
  {challenge, userId, factorId, purpose, code},
) {
  const {rows} = await client.query(
    `SELECT challenge_hash, factor_id
     FROM two_factor_challenges
     WHERE challenge_hash = $1 AND user_id = $2 AND purpose = $3
       AND ($4::uuid IS NULL OR factor_id = $4)
       AND consumed_at IS NULL AND expires_at > now() AND attempts < 5
     FOR UPDATE`,
    [hashChallenge(challenge), userId, purpose, factorId || null],
  );
  const row = rows[0];
  if (!row) {
    throw Object.assign(
      new Error('The verification challenge is invalid or expired.'),
      {
        status: 400,
      },
    );
  }

  const {rows: factors} = await client.query(
    `SELECT id, secret_encrypted
     FROM two_factor_factors
     WHERE id = $1 AND user_id = $2`,
    [row.factor_id, userId],
  );
  const factor = factors[0];
  if (!factor) {
    throw Object.assign(new Error('The authenticator factor was not found.'), {
      status: 400,
    });
  }

  if (!verifyTotp(decryptSecret(factor.secret_encrypted), code)) {
    await client.query(
      `UPDATE two_factor_challenges
       SET attempts = attempts + 1
       WHERE challenge_hash = $1`,
      [hashChallenge(challenge)],
    );
    throw Object.assign(new Error('The authenticator code is incorrect.'), {
      status: 400,
      commitTransaction: true,
    });
  }

  await client.query(
    `UPDATE two_factor_challenges
     SET consumed_at = now()
     WHERE challenge_hash = $1`,
    [hashChallenge(challenge)],
  );
  return factor;
}

async function issueSession(client, user) {
  const tokenId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const token = jwt.sign(
    {sub: user.id, email: user.email, role: user.role, jti: tokenId},
    jwtSecret,
    {expiresIn: '7d'},
  );
  await client.query(
    `INSERT INTO auth_sessions (user_id, token_id, expires_at)
     VALUES ($1, $2, $3)`,
    [user.id, tokenId, expiresAt],
  );
  return {
    access_token: token,
    token_type: 'Bearer',
    expires_at: expiresAt.toISOString(),
  };
}

const authenticate = asyncRoute(async (req, res, next) => {
  const authorization = req.get('authorization') || '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice(7)
    : '';
  if (!token) {
    return sendError(res, 401, 'Authentication is required.');
  }

  let claims;
  try {
    claims = jwt.verify(token, jwtSecret);
  } catch {
    return sendError(
      res,
      401,
      'Your session is invalid or expired. Sign in again.',
    );
  }

  const {rows} = await pool.query(
    `SELECT u.id, u.email, u.full_name, u.department, u.avatar_url, u.role,
            u.email_verified, s.token_id
     FROM auth_sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_id = $1 AND s.user_id = $2
       AND s.revoked_at IS NULL AND s.expires_at > now()`,
    [claims.jti, claims.sub],
  );
  if (rows.length === 0) {
    return sendError(
      res,
      401,
      'Your session is no longer active. Sign in again.',
    );
  }
  req.user = rows[0];
  req.tokenId = rows[0].token_id;
  return next();
});

app.post(
  '/api/media/upload-signature',
  authenticate,
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    keyGenerator: req => req.user.id,
  }),
  asyncRoute(async (req, res) => {
    const {resourceType, target = 'posts'} = req.body || {};
    if (resourceType !== 'image' && resourceType !== 'video') {
      return sendError(res, 400, 'Media type must be image or video.');
    }
    if (!['posts', 'marketplace'].includes(target)) {
      return sendError(res, 400, 'Unsupported media destination.');
    }
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      return sendError(res, 503, 'Cloudinary media storage is not configured.');
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `uniosunpulse/${target}`;
    const publicId = crypto.randomUUID();
    const signature = crypto
      .createHash('sha1')
      .update(
        `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`,
      )
      .digest('hex');
    return res.json({
      data: {cloudName, apiKey, timestamp, folder, publicId, signature},
      error: null,
    });
  }),
);

async function getColumns(table) {
  if (!allowedTables.has(table)) {
    throw Object.assign(new Error('Unsupported table.'), {status: 404});
  }
  if (!columnCache.has(table)) {
    const {rows} = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1`,
      [table],
    );
    if (rows.length === 0) {
      throw Object.assign(
        new Error(`Database table "${table}" is not installed.`),
        {status: 500},
      );
    }
    columnCache.set(table, new Set(rows.map(row => row.column_name)));
  }
  return columnCache.get(table);
}

function quoteColumn(column, columns) {
  if (!columns.has(column) || !/^[a-z_][a-z0-9_]*$/i.test(column)) {
    throw Object.assign(new Error(`Unsupported column "${column}".`), {
      status: 400,
    });
  }
  return `"${column}"`;
}

function addFilter(column, operator, value, columns, values, offset = 0) {
  const name = quoteColumn(column, columns);
  const operators = {
    eq: '=',
    neq: '<>',
    gt: '>',
    lt: '<',
    gte: '>=',
    lte: '<=',
  };
  if (operator === 'is') {
    if (value !== null) {
      throw Object.assign(new Error('Only IS NULL is supported.'), {
        status: 400,
      });
    }
    return `${name} IS NULL`;
  }
  if (value === null && operator === 'eq') {
    return `${name} IS NULL`;
  }
  if (value === null && operator === 'neq') {
    return `${name} IS NOT NULL`;
  }
  if (operator === 'contains') {
    values.push(`%${String(value)}%`);
    return `${name}::text ILIKE $${offset + values.length}`;
  }
  if (!operators[operator]) {
    throw Object.assign(
      new Error(`Unsupported filter operator "${operator}".`),
      {status: 400},
    );
  }
  values.push(value);
  return `${name} ${operators[operator]} $${offset + values.length}`;
}

function buildWhere(filters, columns, values, offset = 0) {
  if (!Array.isArray(filters)) {
    throw Object.assign(new Error('filters must be an array.'), {status: 400});
  }
  const conditions = [];
  for (const filter of filters) {
    if (filter.column === '__or__' && filter.op === 'or') {
      const terms = String(filter.value)
        .split(',')
        .map(term =>
          term.match(
            /^([a-z_][a-z0-9_]*)\.(eq|is)\.(?:'([^']*)'|(true|false|null))$/i,
          ),
        )
        .filter(Boolean);
      if (terms.length === 0) {
        throw Object.assign(new Error('Unsupported OR filter.'), {status: 400});
      }
      conditions.push(
        `(${terms
          .map(match => {
            const value =
              match[3] ??
              (match[4] === 'null'
                ? null
                : match[4] === 'true'
                ? true
                : match[4] === 'false'
                ? false
                : match[4]);
            return addFilter(
              match[1],
              match[2],
              value,
              columns,
              values,
              offset,
            );
          })
          .join(' OR ')})`,
      );
    } else {
      conditions.push(
        addFilter(
          filter.column,
          filter.op,
          filter.value,
          columns,
          values,
          offset,
        ),
      );
    }
  }
  return conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
}

function normalizeRecords(data) {
  const records = Array.isArray(data) ? data : [data];
  if (
    records.length === 0 ||
    records.some(
      item => !item || typeof item !== 'object' || Array.isArray(item),
    )
  ) {
    throw Object.assign(new Error('Expected one or more row objects.'), {
      status: 400,
    });
  }
  return records;
}

async function queryTable(table, payload, user) {
  const columns = await getColumns(table);
  const operation = payload.operation || 'select';
  const filters = [...(payload.filters || [])];
  const adminOnly = new Set([
    'student_verifications',
    'reported_posts',
    'reported_marketplace_listings',
    'admin_audit_logs',
  ]);
  const managedContentTables = new Set([
    'campus_events',
    'career_opportunities',
    'clubs',
  ]);
  const userOwnedTables = new Set([
    'event_rsvps',
    'saved_items',
    'opportunity_applications',
    'club_memberships',
  ]);
  if (
    (managedContentTables.has(table) ||
      userOwnedTables.has(table) ||
      table === 'marketplace_listings') &&
    operation !== 'select' &&
    user.role !== 'admin'
  ) {
    throw Object.assign(
      new Error('Use the supported campus feature API to change this data.'),
      {status: 403},
    );
  }
  if (adminOnly.has(table) && user.role !== 'admin') {
    throw Object.assign(new Error('Administrator access is required.'), {
      status: 403,
    });
  }
  if (['likes', 'comments'].includes(table) && operation !== 'select') {
    throw Object.assign(
      new Error(
        'Use the supported post interaction API to change likes or comments.',
      ),
      {status: 403},
    );
  }
  if (
    ['elections', 'positions', 'election_candidates'].includes(table) &&
    operation !== 'select' &&
    user.role !== 'admin'
  ) {
    throw Object.assign(new Error('Administrator access is required.'), {
      status: 403,
    });
  }
  if (table === 'election_votes' && operation !== 'select') {
    throw Object.assign(
      new Error('Votes must be submitted through the ballot API.'),
      {status: 403},
    );
  }
  if (table === 'profiles' && user.role !== 'admin') {
    filters.push({column: 'id', op: 'eq', value: user.id});
  }
  if (table === 'alerts' && user.role !== 'admin') {
    filters.push({
      column: '__or__',
      op: 'or',
      value: `user_id.eq.'${user.id}',is_broadcast.eq.true`,
    });
  }
  if (table === 'alerts' && operation !== 'select' && user.role !== 'admin') {
    if (payload.data?.is_broadcast) {
      throw Object.assign(
        new Error('Administrator access is required to send broadcast alerts.'),
        {status: 403},
      );
    }
    if (user.role !== 'admin') {
      if (table === 'campus_events') {
        filters.push({column: 'status', op: 'eq', value: 'published'});
      }
      if (table === 'career_opportunities') {
        filters.push({column: 'status', op: 'eq', value: 'published'});
      }
      if (table === 'clubs') {
        filters.push({column: 'status', op: 'eq', value: 'active'});
      }
      if (table === 'marketplace_listings') {
        filters.push({
          column: '__or__',
          op: 'or',
          value: `status.eq.'active',seller_id.eq.'${user.id}'`,
        });
      }
      if (userOwnedTables.has(table)) {
        filters.push({column: 'user_id', op: 'eq', value: user.id});
      }
    }
  }
  if (table === 'login_history' || table === 'blocked_users') {
    if (operation === 'select' && user.role !== 'admin') {
      filters.push({column: 'user_id', op: 'eq', value: user.id});
    }
  }
  if (operation === 'update' || operation === 'delete') {
    if (table === 'posts' && user.role !== 'admin') {
      filters.push({column: 'author_id', op: 'eq', value: user.id});
    }
    if (table === 'likes' || table === 'comments') {
      filters.push({column: 'user_id', op: 'eq', value: user.id});
    }
    if (table === 'follows') {
      filters.push({column: 'follower_id', op: 'eq', value: user.id});
    }
  }
  const values = [];
  const where = ['select', 'delete'].includes(operation)
    ? buildWhere(filters, columns, values)
    : '';

  if (operation === 'select') {
    const requested =
      payload.select === '*' || !payload.select
        ? '*'
        : String(payload.select)
            .split(',')
            .map(field => quoteColumn(field.trim(), columns))
            .join(', ');
    let sql = `SELECT ${requested} FROM "${table}"${where}`;
    if (payload.order?.column) {
      sql += ` ORDER BY ${quoteColumn(payload.order.column, columns)} ${
        payload.order.ascending === false ? 'DESC' : 'ASC'
      }`;
    }
    if (Number.isInteger(Number(payload.limit)) && Number(payload.limit) > 0) {
      values.push(Math.min(Number(payload.limit), 500));
      sql += ` LIMIT $${values.length}`;
    }
    if (payload.head && payload.count === 'exact') {
      const countResult = await pool.query(
        `SELECT count(*)::int AS count FROM "${table}"${where}`,
        values,
      );
      return {data: null, count: countResult.rows[0].count};
    }
    const result = await pool.query(sql, values);
    return {
      data: payload.single ? result.rows[0] ?? null : result.rows,
      count: payload.count === 'exact' ? result.rowCount : null,
    };
  }

  if (!['insert', 'upsert', 'update', 'delete'].includes(operation)) {
    throw Object.assign(new Error(`Unsupported operation "${operation}".`), {
      status: 400,
    });
  }
  if (operation !== 'select' && !user) {
    throw Object.assign(new Error('Authentication is required.'), {
      status: 401,
    });
  }

  if (operation === 'delete') {
    const result = await pool.query(
      `DELETE FROM "${table}"${where} RETURNING *`,
      values,
    );
    return {
      data: payload.single ? result.rows[0] ?? null : result.rows,
      count: result.rowCount,
    };
  }

  const records = normalizeRecords(payload.data);
  const output = [];
  for (const original of records) {
    const record = {...original};
    if (
      table === 'election_candidates' &&
      ['insert', 'upsert'].includes(operation)
    ) {
      const electionId = String(record.election_id || '');
      let position;
      if (record.position_id) {
        const result = await pool.query(
          `SELECT id, title FROM positions
           WHERE id = $1 AND election_id = $2`,
          [record.position_id, electionId],
        );
        position = result.rows[0];
      } else {
        const title = String(record.position || '').trim();
        if (title) {
          const result = await pool.query(
            `INSERT INTO positions (election_id, title)
             VALUES ($1, $2)
             ON CONFLICT (election_id, title) DO UPDATE
               SET title = EXCLUDED.title
             RETURNING id, title`,
            [electionId, title],
          );
          position = result.rows[0];
        }
      }
      if (!position) {
        throw Object.assign(
          new Error('A valid candidate position is required.'),
          {status: 400},
        );
      }
      record.position_id = position.id;
      record.position = position.title;
    }
    if (table === 'profiles') {
      record.id = user.id;
    }
    if (table === 'posts' && ['insert', 'upsert'].includes(operation)) {
      record.like_count = 0;
      record.comment_count = 0;
    }
    if (table === 'login_history') {
      record.user_id = user.id;
    }
    if (table === 'likes' || table === 'comments' || table === 'follows') {
      if (table === 'likes' || table === 'comments') {
        record.user_id = user.id;
      }
      if (table === 'follows') {
        record.follower_id = user.id;
      }
    }
    if (table === 'posts' && user.role !== 'admin') {
      record.author_id = user.id;
    }
    if (table === 'reported_posts') {
      record.reporter_id = user.id;
    }
    if (table === 'student_verifications' && user.role !== 'admin') {
      record.user_id = user.id;
    }
    if (table === 'alerts' && !record.is_broadcast) {
      record.user_id = user.id;
    }
    const keys = Object.keys(record);
    if (keys.length === 0) {
      throw Object.assign(new Error('Cannot write an empty row.'), {
        status: 400,
      });
    }
    const names = keys.map(key => quoteColumn(key, columns));
    const params = keys.map(key => record[key]);
    const placeholders = params.map((_, index) => `$${index + 1}`);

    if (operation === 'update') {
      const assignments = keys.map(
        (key, index) => `${names[index]} = $${index + 1}`,
      );
      const filterValues = [];
      const filterSql = buildWhere(
        filters,
        columns,
        filterValues,
        params.length,
      );
      const updateResult = await pool.query(
        `UPDATE "${table}" SET ${assignments.join(
          ', ',
        )}${filterSql} RETURNING *`,
        [...params, ...filterValues],
      );
      output.push(...updateResult.rows);
      continue;
    }

    let conflict = '';
    if (operation === 'upsert') {
      const uniqueKeys = {
        profiles: ['id'],
        follows: ['follower_id', 'following_id'],
      }[table] || ['id'];
      if (!uniqueKeys.every(key => keys.includes(key))) {
        throw Object.assign(
          new Error(
            `Upsert for "${table}" must include ${uniqueKeys.join(', ')}.`,
          ),
          {status: 400},
        );
      }
      const conflictCols = uniqueKeys
        .map(key => quoteColumn(key, columns))
        .join(', ');
      const updateKeys = keys.filter(key => !uniqueKeys.includes(key));
      conflict = updateKeys.length
        ? ` ON CONFLICT (${conflictCols}) DO UPDATE SET ${updateKeys
            .map(
              key =>
                `${quoteColumn(key, columns)} = EXCLUDED.${quoteColumn(
                  key,
                  columns,
                )}`,
            )
            .join(', ')}`
        : ` ON CONFLICT (${conflictCols}) DO NOTHING`;
    }
    const result = await pool.query(
      `INSERT INTO "${table}" (${names.join(', ')}) VALUES (${placeholders.join(
        ', ',
      )})${conflict} RETURNING *`,
      params,
    );
    output.push(...result.rows);
  }
  return {
    data: payload.single
      ? output[0] ?? null
      : Array.isArray(payload.data)
      ? output
      : output[0],
    count: output.length,
  };
}

app.get(
  '/api/feed',
  authenticate,
  asyncRoute(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    let cursorCreatedAt = null;
    let cursorId = null;
    if (req.query.cursor) {
      try {
        const decoded = JSON.parse(
          Buffer.from(String(req.query.cursor), 'base64url').toString('utf8'),
        );
        if (
          typeof decoded.created_at !== 'string' ||
          Number.isNaN(Date.parse(decoded.created_at)) ||
          typeof decoded.id !== 'string' ||
          !decoded.id
        ) {
          return sendError(res, 400, 'The feed cursor is invalid.');
        }
        cursorCreatedAt = decoded.created_at;
        cursorId = decoded.id;
      } catch {
        return sendError(res, 400, 'The feed cursor is invalid.');
      }
    }

    const tag = String(req.query.tag || '').toUpperCase();
    const allowedTags = new Set([
      '',
      'ANNOUNCEMENTS',
      'ACADEMICS',
      'CAMPUS LIFE',
      'EVENTS',
      'EMERGENCY',
      'BROADCAST',
    ]);
    if (!allowedTags.has(tag)) {
      return sendError(res, 400, 'Unsupported feed category.');
    }

    const {rows} = await pool.query(
      `SELECT post.*,
              EXISTS (
                SELECT 1 FROM likes
                WHERE likes.post_id = post.id AND likes.user_id = $1
              ) AS liked
       FROM posts AS post
       WHERE ($2 = '' OR upper(post.tag) = $2)
         AND ($3::timestamptz IS NULL OR
              (post.created_at, post.id) < ($3::timestamptz, $4::text))
       ORDER BY post.created_at DESC, post.id DESC
       LIMIT $5`,
      [req.user.id, tag, cursorCreatedAt, cursorId, limit + 1],
    );
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return res.json({
      data: {
        posts: page,
        has_more: hasMore,
        next_cursor:
          hasMore && last
            ? Buffer.from(
                JSON.stringify({
                  created_at: last.created_at,
                  id: last.id,
                }),
              ).toString('base64url')
            : null,
      },
      error: null,
    });
  }),
);

app.put(
  '/api/posts/:postId/like',
  authenticate,
  asyncRoute(async (req, res) => {
    const input = z.object({liked: z.boolean()}).safeParse(req.body);
    if (!input.success) {
      return sendError(res, 400, 'A like status is required.');
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const {rowCount} = await client.query(
        'SELECT id FROM posts WHERE id = $1 FOR UPDATE',
        [req.params.postId],
      );
      if (!rowCount) {
        await client.query('ROLLBACK');
        return sendError(res, 404, 'This post is no longer available.');
      }
      if (input.data.liked) {
        await client.query(
          `INSERT INTO likes (post_id, user_id) VALUES ($1, $2)
           ON CONFLICT (post_id, user_id) DO NOTHING`,
          [req.params.postId, req.user.id],
        );
      } else {
        await client.query(
          'DELETE FROM likes WHERE post_id = $1 AND user_id = $2',
          [req.params.postId, req.user.id],
        );
      }
      const {rows} = await client.query(
        `SELECT count(*)::int AS like_count,
                EXISTS (
                  SELECT 1 FROM likes WHERE post_id = $1 AND user_id = $2
                ) AS liked
         FROM likes WHERE post_id = $1`,
        [req.params.postId, req.user.id],
      );
      await client.query(
        'UPDATE posts SET like_count = $1, updated_at = now() WHERE id = $2',
        [rows[0].like_count, req.params.postId],
      );
      await client.query('COMMIT');
      return res.json({data: rows[0], error: null});
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }),
);

app.post(
  '/api/posts/:postId/comments',
  authenticate,
  asyncRoute(async (req, res) => {
    const input = z
      .object({body: z.string().trim().min(1).max(2000)})
      .safeParse(req.body);
    if (!input.success) {
      return sendError(res, 400, 'Enter a comment of up to 2,000 characters.');
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const {rowCount} = await client.query(
        'SELECT id FROM posts WHERE id = $1 FOR UPDATE',
        [req.params.postId],
      );
      if (!rowCount) {
        await client.query('ROLLBACK');
        return sendError(res, 404, 'This post is no longer available.');
      }
      const {rows} = await client.query(
        `INSERT INTO comments (post_id, user_id, author_name, avatar, body)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          req.params.postId,
          req.user.id,
          req.user.full_name || 'Student',
          req.user.avatar_url,
          input.data.body,
        ],
      );
      await client.query(
        `UPDATE posts
         SET comment_count = (
           SELECT count(*)::int FROM comments WHERE post_id = $1
         ), updated_at = now()
         WHERE id = $1`,
        [req.params.postId],
      );
      await client.query('COMMIT');
      return res.status(201).json({data: rows[0], error: null});
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }),
);

app.delete(
  '/api/comments/:commentId',
  authenticate,
  asyncRoute(async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const {rows} = await client.query(
        `SELECT id, post_id, user_id FROM comments
         WHERE id = $1 FOR UPDATE`,
        [req.params.commentId],
      );
      const comment = rows[0];
      if (!comment) {
        await client.query('ROLLBACK');
        return sendError(res, 404, 'Comment not found.');
      }
      if (comment.user_id !== req.user.id && req.user.role !== 'admin') {
        await client.query('ROLLBACK');
        return sendError(res, 403, 'You can only remove your own comment.');
      }
      await client.query('SELECT id FROM posts WHERE id = $1 FOR UPDATE', [
        comment.post_id,
      ]);
      await client.query('DELETE FROM comments WHERE id = $1', [comment.id]);
      const {rows: countRows} = await client.query(
        `SELECT count(*)::int AS comment_count
         FROM comments WHERE post_id = $1`,
        [comment.post_id],
      );
      await client.query(
        'UPDATE posts SET comment_count = $1, updated_at = now() WHERE id = $2',
        [countRows[0].comment_count, comment.post_id],
      );
      await client.query('COMMIT');
      return res.json({
        data: {
          post_id: comment.post_id,
          comment_count: countRows[0].comment_count,
        },
        error: null,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }),
);

app.get(
  '/api/admin/events',
  authenticate,
  asyncRoute(async (req, res) => {
    if (!requireAdmin(req, res)) {
      return;
    }
    const {rows} = await pool.query(
      `SELECT event.*,
              count(rsvp.user_id)::int AS attendee_count
       FROM campus_events AS event
       LEFT JOIN event_rsvps AS rsvp ON rsvp.event_id = event.id
       GROUP BY event.id
       ORDER BY event.starts_at DESC`,
    );
    return res.json({data: rows, error: null});
  }),
);

app.post(
  '/api/admin/events',
  authenticate,
  asyncRoute(async (req, res) => {
    if (!requireAdmin(req, res)) {
      return;
    }
    const input = z
      .object({
        title: z.string().trim().min(3).max(120),
        description: z.string().trim().max(2000).default(''),
        category: z.string().trim().min(1).max(50).default('Campus'),
        venue: z.string().trim().min(2).max(160),
        starts_at: z.string().datetime(),
        ends_at: z.string().datetime().nullable().optional(),
        capacity: z.number().int().nonnegative().nullable().default(null),
        status: z.enum(['published', 'cancelled']).default('published'),
      })
      .safeParse(req.body);
    if (!input.success) {
      return sendError(
        res,
        400,
        input.error.issues[0]?.message || 'Invalid event.',
      );
    }
    const event = input.data;
    if (
      event.ends_at &&
      Date.parse(event.ends_at) <= Date.parse(event.starts_at)
    ) {
      return sendError(res, 400, 'The end time must be after the start time.');
    }
    const {rows} = await pool.query(
      `INSERT INTO campus_events
         (title, description, category, venue, starts_at, ends_at,
          capacity, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        event.title,
        event.description,
        event.category,
        event.venue,
        event.starts_at,
        event.ends_at || null,
        event.capacity,
        event.status,
        req.user.id,
      ],
    );
    return res
      .status(201)
      .json({data: {...rows[0], attendee_count: 0}, error: null});
  }),
);

app.patch(
  '/api/admin/events/:eventId',
  authenticate,
  asyncRoute(async (req, res) => {
    if (!requireAdmin(req, res)) {
      return;
    }
    const input = z
      .object({
        title: z.string().trim().min(3).max(120).optional(),
        description: z.string().trim().max(2000).optional(),
        category: z.string().trim().min(1).max(50).optional(),
        venue: z.string().trim().min(2).max(160).optional(),
        starts_at: z.string().datetime().optional(),
        ends_at: z.string().datetime().nullable().optional(),
        capacity: z.number().int().nonnegative().nullable().optional(),
        status: z.enum(['published', 'cancelled']).optional(),
      })
      .strict()
      .safeParse(req.body);
    if (!input.success || Object.keys(input.data || {}).length === 0) {
      return sendError(res, 400, 'Provide valid event fields to update.');
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const {rows: existingRows} = await client.query(
        `SELECT starts_at, ends_at FROM campus_events
         WHERE id = $1 FOR UPDATE`,
        [req.params.eventId],
      );
      if (!existingRows[0]) {
        await client.query('ROLLBACK');
        return sendError(res, 404, 'Event not found.');
      }
      const startsAt = input.data.starts_at || existingRows[0].starts_at;
      const endsAt =
        input.data.ends_at === undefined
          ? existingRows[0].ends_at
          : input.data.ends_at;
      if (endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) {
        await client.query('ROLLBACK');
        return sendError(
          res,
          400,
          'The end time must be after the start time.',
        );
      }
      if (input.data.capacity !== undefined && input.data.capacity !== null) {
        const {rows: countRows} = await client.query(
          'SELECT count(*)::int AS count FROM event_rsvps WHERE event_id = $1',
          [req.params.eventId],
        );
        if (countRows[0].count > input.data.capacity) {
          await client.query('ROLLBACK');
          return sendError(
            res,
            409,
            'Capacity cannot be lower than the number of existing RSVPs.',
          );
        }
      }
      const fields = Object.keys(input.data);
      const values = fields.map(field => input.data[field]);
      const assignments = fields.map(
        (field, index) => `${field} = $${index + 1}`,
      );
      values.push(req.params.eventId);
      const {rows} = await client.query(
        `UPDATE campus_events
         SET ${assignments.join(', ')}, updated_at = now()
         WHERE id = $${values.length}
         RETURNING *`,
        values,
      );
      const {rows: countRows} = await client.query(
        'SELECT count(*)::int AS count FROM event_rsvps WHERE event_id = $1',
        [req.params.eventId],
      );
      await client.query('COMMIT');
      return res.json({
        data: {...rows[0], attendee_count: countRows[0].count},
        error: null,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }),
);

app.get(
  '/api/admin/events/:eventId/rsvps',
  authenticate,
  asyncRoute(async (req, res) => {
    if (!requireAdmin(req, res)) {
      return;
    }
    const {rows} = await pool.query(
      `SELECT rsvp.user_id, rsvp.created_at,
              COALESCE(NULLIF(users.full_name, ''), 'Student') AS full_name,
              users.email
       FROM event_rsvps AS rsvp
       JOIN users ON users.id = rsvp.user_id
       WHERE rsvp.event_id = $1
       ORDER BY rsvp.created_at DESC`,
      [req.params.eventId],
    );
    return res.json({data: rows, error: null});
  }),
);

app.delete(
  '/api/admin/events/:eventId/rsvps/:userId',
  authenticate,
  asyncRoute(async (req, res) => {
    if (!requireAdmin(req, res)) {
      return;
    }
    const {rowCount} = await pool.query(
      'DELETE FROM event_rsvps WHERE event_id = $1 AND user_id = $2',
      [req.params.eventId, req.params.userId],
    );
    if (!rowCount) {
      return sendError(res, 404, 'RSVP not found.');
    }
    return res.json({data: {removed: true}, error: null});
  }),
);

app.delete(
  '/api/admin/events/:eventId',
  authenticate,
  asyncRoute(async (req, res) => {
    if (!requireAdmin(req, res)) {
      return;
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const {rowCount} = await client.query(
        'DELETE FROM campus_events WHERE id = $1',
        [req.params.eventId],
      );
      if (!rowCount) {
        await client.query('ROLLBACK');
        return sendError(res, 404, 'Event not found.');
      }
      await client.query(
        "DELETE FROM saved_items WHERE item_type = 'event' AND item_id = $1",
        [req.params.eventId],
      );
      await client.query('COMMIT');
      return res.json({data: {removed: true}, error: null});
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }),
);

app.get(
  '/health',
  asyncRoute(async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ok: true, mode: 'postgres'});
  }),
);

app.patch(
  '/api/marketplace/:listingId',
  authenticate,
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        title: z.string().trim().min(3).max(100).optional(),
        description: z.string().trim().max(1000).optional(),
        category: z.string().trim().min(1).max(40).optional(),
        price: z.number().finite().nonnegative().max(100000000).optional(),
        location: z.string().trim().min(2).max(120).optional(),
        image_urls: z
          .array(z.string().url().startsWith('https://'))
          .max(5)
          .optional(),
        status: z.enum(['sold', 'removed']).optional(),
      })
      .strict()
      .safeParse(req.body);
    if (!input.success || Object.keys(input.data || {}).length === 0) {
      return sendError(res, 400, 'Provide valid listing fields to update.');
    }
    const fields = Object.keys(input.data);
    const values = fields.map(field => input.data[field]);
    const assignments = fields.map(
      (field, index) => `${field} = $${index + 1}`,
    );
    assignments.push('updated_at = now()');
    values.push(req.params.listingId, req.user.id);
    const {rows} = await pool.query(
      `UPDATE marketplace_listings
       SET ${assignments.join(', ')}
       WHERE id = $${values.length - 1}
         AND seller_id = $${values.length}
         AND status = 'active'
       RETURNING id, seller_id, title, description, category,
                 price::float8 AS price, location, image_urls, status,
                 created_at`,
      values,
    );
    if (rows.length === 0) {
      return sendError(
        res,
        404,
        'This listing is no longer available to update.',
      );
    }
    return res.json({
      data: {
        ...rows[0],
        seller: req.user.full_name || 'Student',
        is_owner: true,
      },
      error: null,
    });
  }),
);

app.post(
  '/api/marketplace/:listingId/report',
  authenticate,
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        reason: z.enum([
          'Prohibited item',
          'Fraud or scam',
          'Misleading listing',
          'Inappropriate content',
          'Other',
        ]),
        details: z.string().trim().max(1000).default(''),
      })
      .safeParse(req.body);
    if (!input.success) {
      return sendError(res, 400, 'Choose a valid report reason.');
    }
    const {rows: listings} = await pool.query(
      `SELECT id, seller_id FROM marketplace_listings
       WHERE id = $1 AND status = 'active'`,
      [req.params.listingId],
    );
    if (!listings[0]) {
      return sendError(res, 404, 'This listing is no longer available.');
    }
    if (listings[0].seller_id === req.user.id) {
      return sendError(res, 400, 'You cannot report your own listing.');
    }
    const {rows} = await pool.query(
      `INSERT INTO reported_marketplace_listings
         (listing_id, reporter_id, reason, details)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (listing_id, reporter_id) DO NOTHING
       RETURNING id`,
      [
        req.params.listingId,
        req.user.id,
        input.data.reason,
        input.data.details,
      ],
    );
    if (!rows[0]) {
      return sendError(res, 409, 'You have already reported this listing.');
    }
    return res.status(201).json({
      data: {id: rows[0].id, reported: true},
      error: null,
    });
  }),
);

app.get(
  '/api/admin/marketplace-reports',
  authenticate,
  asyncRoute(async (req, res) => {
    if (!requireAdmin(req, res)) {
      return;
    }
    const {rows} = await pool.query(
      `SELECT report.id, report.listing_id, report.reason, report.details,
              report.status, report.created_at,
              listing.title AS listing_title, listing.status AS listing_status,
              reporter.full_name AS reporter_name, reporter.email AS reporter_email
       FROM reported_marketplace_listings AS report
       JOIN marketplace_listings AS listing ON listing.id = report.listing_id
       JOIN users AS reporter ON reporter.id = report.reporter_id
       ORDER BY CASE report.status WHEN 'pending' THEN 0 ELSE 1 END,
                report.created_at DESC
       LIMIT 200`,
    );
    return res.json({data: rows, error: null});
  }),
);

app.patch(
  '/api/admin/marketplace-reports/:reportId',
  authenticate,
  asyncRoute(async (req, res) => {
    if (!requireAdmin(req, res)) {
      return;
    }
    const input = z
      .object({
        status: z.enum(['actioned', 'dismissed']),
        removeListing: z.boolean().default(false),
      })
      .safeParse(req.body);
    if (!input.success) {
      return sendError(res, 400, 'Choose a valid report action.');
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const {rows} = await client.query(
        `UPDATE reported_marketplace_listings
         SET status = $1, resolved_by = $2, resolved_at = now()
         WHERE id = $3
         RETURNING listing_id`,
        [input.data.status, req.user.id, req.params.reportId],
      );
      if (!rows[0]) {
        await client.query('ROLLBACK');
        return sendError(res, 404, 'Marketplace report not found.');
      }
      if (input.data.removeListing) {
        await client.query(
          `UPDATE marketplace_listings SET status = 'removed', updated_at = now()
           WHERE id = $1`,
          [rows[0].listing_id],
        );
      }
      await client.query('COMMIT');
      return res.json({
        data: {
          status: input.data.status,
          listing_removed: input.data.removeListing,
        },
        error: null,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }),
);

app.get(
  '/api/auth/session',
  asyncRoute(async (req, res) => {
    const token = (req.get('authorization') || '').replace(/^Bearer /, '');
    if (!token) {
      return res.json({data: {session: null}});
    }
    try {
      const claims = jwt.verify(token, jwtSecret);
      const {rows} = await pool.query(
        `SELECT 1 FROM auth_sessions
       WHERE token_id = $1 AND user_id = $2 AND revoked_at IS NULL AND expires_at > now()`,
        [claims.jti, claims.sub],
      );
      if (rows.length === 0) {
        return res.json({data: {session: null}});
      }
      return res.json({
        data: {
          session: {
            access_token: token,
            user: {id: claims.sub, email: claims.email},
          },
        },
      });
    } catch {
      return res.json({data: {session: null}});
    }
  }),
);

app.get('/api/auth/user', authenticate, (req, res) => {
  const {id, email, full_name, department, avatar_url, role, email_verified} =
    req.user;
  res.json({
    data: {
      user: {
        id,
        email,
        user_metadata: {
          full_name,
          department,
          avatar_url,
          verified: email_verified,
          role,
        },
      },
    },
  });
});

app.post(
  '/api/auth/mfa/enroll',
  authenticate,
  asyncRoute(async (req, res) => {
    const secret = generateTotpSecret();
    const label = encodeURIComponent(`UniOsunPulse:${req.user.email}`);
    const issuer = encodeURIComponent('UniOsunPulse');
    const uri = `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
    const qrCode = await QRCode.toDataURL(uri, {errorCorrectionLevel: 'M'});
    const client = await pool.connect();
    let factorId;
    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [
        req.user.id,
      ]);
      const {rowCount} = await client.query(
        `SELECT id FROM two_factor_factors
         WHERE user_id = $1 AND status = 'verified'
         FOR UPDATE`,
        [req.user.id],
      );
      if (rowCount > 0) {
        await client.query('ROLLBACK');
        return sendError(
          res,
          409,
          'Two-factor authentication is already enabled.',
        );
      }
      await client.query(
        `DELETE FROM two_factor_factors
         WHERE user_id = $1 AND status = 'unverified'`,
        [req.user.id],
      );
      const {rows} = await client.query(
        `INSERT INTO two_factor_factors (user_id, secret_encrypted, friendly_name)
         VALUES ($1, $2, 'Authenticator app')
         RETURNING id`,
        [req.user.id, encryptSecret(secret)],
      );
      factorId = rows[0].id;
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return res.json({
      data: {
        id: factorId,
        totp: {secret, qr_code: qrCode},
      },
      error: null,
    });
  }),
);

app.get(
  '/api/auth/mfa/factors',
  authenticate,
  asyncRoute(async (req, res) => {
    const {rows} = await pool.query(
      `SELECT id, friendly_name, status
       FROM two_factor_factors
       WHERE user_id = $1
       ORDER BY created_at`,
      [req.user.id],
    );
    return res.json({data: {totp: rows}, error: null});
  }),
);

app.post(
  '/api/auth/mfa/challenge',
  authenticate,
  asyncRoute(async (req, res) => {
    const factorId = String(req.body?.factorId || '');
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        factorId,
      )
    ) {
      return sendError(res, 400, 'A valid authenticator factor is required.');
    }
    const {rows} = await pool.query(
      `SELECT id, status FROM two_factor_factors
       WHERE id = $1 AND user_id = $2`,
      [factorId, req.user.id],
    );
    if (!rows[0] || rows[0].status !== 'unverified') {
      return sendError(res, 404, 'Pending authenticator setup was not found.');
    }
    const challengeId = await createMfaChallenge(
      pool,
      req.user.id,
      factorId,
      'enroll',
    );
    return res.json({data: {id: challengeId}, error: null});
  }),
);

app.post(
  '/api/auth/mfa/verify',
  authenticate,
  asyncRoute(async (req, res) => {
    const factorId = String(req.body?.factorId || '');
    const challengeId = String(req.body?.challengeId || '');
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        factorId,
      ) ||
      !challengeId
    ) {
      return sendError(
        res,
        400,
        'A valid authenticator factor and challenge are required.',
      );
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const factor = await verifyMfaChallenge(client, {
        challenge: challengeId,
        userId: req.user.id,
        factorId,
        purpose: 'enroll',
        code: String(req.body?.code || ''),
      });
      await client.query(
        `UPDATE two_factor_factors SET status = 'verified'
         WHERE id = $1 AND user_id = $2`,
        [factor.id, req.user.id],
      );
      await client.query('COMMIT');
      return res.json({data: {verified: true}, error: null});
    } catch (error) {
      await client.query(error.commitTransaction ? 'COMMIT' : 'ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }),
);

app.post(
  '/api/auth/mfa/unenroll',
  authenticate,
  asyncRoute(async (req, res) => {
    const {rowCount} = await pool.query(
      `DELETE FROM two_factor_factors
       WHERE id = $1 AND user_id = $2`,
      [String(req.body?.factorId || ''), req.user.id],
    );
    if (!rowCount) {
      return sendError(res, 404, 'Authenticator factor was not found.');
    }
    return res.json({data: {removed: true}, error: null});
  }),
);

app.post(
  '/api/auth/password-reset/request',
  asyncRoute(async (req, res) => {
    const email = parseEmail(req.body?.email);
    if (!email) {
      return sendError(res, 400, 'Enter a valid email address.');
    }
    const {rows} = await pool.query(
      'SELECT id, email FROM users WHERE email = $1 AND email_verified = true',
      [email],
    );
    const user = rows[0];
    if (user) {
      const transport = getEmailTransport();
      if (!transport) {
        return sendError(
          res,
          503,
          'Password recovery is unavailable because email delivery is not configured.',
        );
      }
      const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
      const codeHash = await bcrypt.hash(code, 10);
      await pool.query(
        `UPDATE password_reset_codes
         SET consumed_at = now()
         WHERE user_id = $1 AND consumed_at IS NULL`,
        [user.id],
      );
      await pool.query(
        `INSERT INTO password_reset_codes (user_id, code_hash, expires_at)
         VALUES ($1, $2, now() + interval '10 minutes')`,
        [user.id, codeHash],
      );
      await transport.sendMail({
        from: process.env.SMTP_FROM,
        to: user.email,
        subject: 'Reset your UniOsun Pulse password',
        text: `Your password reset code is ${code}. It expires in 10 minutes.`,
      });
    }
    return res.json({
      data: {
        message:
          'If a verified account exists for that email, a reset code has been sent.',
      },
      error: null,
    });
  }),
);

app.post(
  '/api/auth/password-reset/complete',
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        email: z.string().trim().toLowerCase().email(),
        code: z.string().regex(/^\d{6}$/),
        password: z.string().min(8).max(128),
      })
      .safeParse(req.body);
    if (!input.success) {
      return sendError(
        res,
        400,
        input.error.issues[0]?.message ||
          'Enter a valid reset code and password.',
      );
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const {rows} = await client.query(
        `SELECT reset.id, reset.code_hash, reset.user_id
         FROM password_reset_codes AS reset
         JOIN users ON users.id = reset.user_id
         WHERE users.email = $1 AND reset.consumed_at IS NULL
           AND reset.expires_at > now()
         ORDER BY reset.created_at DESC
         LIMIT 1 FOR UPDATE OF reset`,
        [input.data.email],
      );
      const reset = rows[0];
      if (!reset || !(await bcrypt.compare(input.data.code, reset.code_hash))) {
        await client.query('ROLLBACK');
        return sendError(res, 400, 'The reset code is invalid or expired.');
      }
      const passwordHash = await bcrypt.hash(input.data.password, 12);
      await client.query(
        'UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2',
        [passwordHash, reset.user_id],
      );
      await client.query(
        `UPDATE password_reset_codes SET consumed_at = now()
         WHERE user_id = $1 AND consumed_at IS NULL`,
        [reset.user_id],
      );
      await client.query(
        `UPDATE auth_sessions SET revoked_at = now()
         WHERE user_id = $1 AND revoked_at IS NULL`,
        [reset.user_id],
      );
      await client.query('COMMIT');
      return res.json({
        data: {message: 'Password updated. Sign in with your new password.'},
        error: null,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }),
);

app.post(
  '/api/auth/sign-in',
  signInRateLimit,
  asyncRoute(async (req, res) => {
    const email = parseEmail(req.body?.email);
    const password = String(req.body?.password || '');
    if (!email || !password) {
      return sendError(res, 400, 'A valid email and password are required.');
    }
    const {rows} = await pool.query(
      'SELECT id, email, password_hash, role, full_name FROM users WHERE email = $1',
      [email],
    );
    const user = rows[0];
    if (
      !user?.password_hash ||
      !(await bcrypt.compare(password, user.password_hash))
    ) {
      return sendError(res, 401, 'Email or password is incorrect.');
    }
    const {rows: factors} = await pool.query(
      `SELECT id FROM two_factor_factors
       WHERE user_id = $1 AND status = 'verified'
       ORDER BY created_at LIMIT 1`,
      [user.id],
    );
    if (factors[0]) {
      const challengeId = await createMfaChallenge(
        pool,
        user.id,
        factors[0].id,
        'sign_in',
      );
      return res.json({
        data: {mfa_required: true, mfa_challenge: challengeId},
        error: null,
      });
    }
    const session = await issueSession(pool, user);
    return res.json({
      data: {
        session,
        user: {
          id: user.id,
          email: user.email,
          user_metadata: {full_name: user.full_name, role: user.role},
        },
      },
    });
  }),
);

app.post(
  '/api/auth/mfa/complete-sign-in',
  asyncRoute(async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const challenge = String(req.body?.challengeId || '');
      const challengeHash = hashChallenge(challenge);
      const {rows: challenges} = await client.query(
        `SELECT user_id, factor_id
         FROM two_factor_challenges
         WHERE challenge_hash = $1 AND purpose = 'sign_in'
           AND consumed_at IS NULL AND expires_at > now() AND attempts < 5
         FOR UPDATE`,
        [challengeHash],
      );
      const pending = challenges[0];
      if (!pending) {
        throw Object.assign(
          new Error('The sign-in challenge is invalid or expired.'),
          {
            status: 400,
          },
        );
      }
      await verifyMfaChallenge(client, {
        challenge,
        userId: pending.user_id,
        factorId: pending.factor_id,
        purpose: 'sign_in',
        code: String(req.body?.code || ''),
      });
      const {rows: users} = await client.query(
        'SELECT id, email, role, full_name FROM users WHERE id = $1',
        [pending.user_id],
      );
      if (!users[0]) {
        throw Object.assign(
          new Error('The account for this challenge no longer exists.'),
          {
            status: 401,
          },
        );
      }
      const session = await issueSession(client, users[0]);
      await client.query('COMMIT');
      return res.json({
        data: {
          session,
          user: {
            id: users[0].id,
            email: users[0].email,
            user_metadata: {full_name: users[0].full_name, role: users[0].role},
          },
        },
        error: null,
      });
    } catch (error) {
      await client.query(error.commitTransaction ? 'COMMIT' : 'ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }),
);

app.post(
  '/api/auth/sign-up',
  asyncRoute(async (req, res) => {
    const email = parseEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const fullName = String(req.body?.options?.data?.full_name || '').trim();
    if (!email || !password || !fullName) {
      return sendError(
        res,
        400,
        'A valid email, password, and full name are required.',
      );
    }
    if (password.length < 8) {
      return sendError(
        res,
        400,
        'Password must be at least 8 characters long.',
      );
    }
    const transport = getEmailTransport();
    if (!transport) {
      return sendError(
        res,
        503,
        'Email verification is unavailable: configure SMTP_HOST and SMTP_FROM.',
      );
    }
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [
      email,
    ]);
    if (existing.rowCount > 0) {
      return sendError(res, 409, 'An account already exists for this email.');
    }

    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    const [codeHash, passwordHash] = await Promise.all([
      bcrypt.hash(code, 10),
      bcrypt.hash(password, 12),
    ]);
    await pool.query(
      `INSERT INTO email_verification_codes
       (email, code_hash, should_create_user, password_hash, full_name, expires_at)
     VALUES ($1, $2, true, $3, $4, now() + interval '10 minutes')`,
      [email, codeHash, passwordHash, fullName],
    );
    await transport.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: 'Verify your UniOsun Pulse account',
      text: `Your verification code is ${code}. It expires in 10 minutes.`,
    });
    return res.json({data: {user: {email}}, error: null});
  }),
);

app.post(
  '/api/auth/sign-in-otp',
  asyncRoute(async (req, res) => {
    const email = parseEmail(req.body?.email);
    const shouldCreateUser = Boolean(req.body?.options?.shouldCreateUser);
    if (!email) {
      return sendError(res, 400, 'A valid email is required.');
    }
    const transport = getEmailTransport();
    if (!transport) {
      return sendError(
        res,
        503,
        'Email verification is unavailable: configure SMTP_HOST and SMTP_FROM.',
      );
    }
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [
      email,
    ]);
    if (!shouldCreateUser && existing.rowCount === 0) {
      return sendError(res, 404, 'No account exists for this email.');
    }
    if (shouldCreateUser && existing.rowCount > 0) {
      return sendError(res, 409, 'An account already exists for this email.');
    }
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = await bcrypt.hash(code, 10);
    await pool.query(
      `INSERT INTO email_verification_codes (email, code_hash, expires_at, should_create_user)
     VALUES ($1, $2, now() + interval '10 minutes', $3)`,
      [email, codeHash, shouldCreateUser],
    );
    await transport.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: 'Your UniOsun Pulse verification code',
      text: `Your verification code is ${code}. It expires in 10 minutes.`,
    });
    return res.json({data: {user: {email}}, error: null});
  }),
);

app.post(
  '/api/auth/verify-otp',
  asyncRoute(async (req, res) => {
    const email = parseEmail(req.body?.email);
    const code = String(req.body?.token || '');
    if (!email || !code) {
      return sendError(
        res,
        400,
        'A valid email and verification code are required.',
      );
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const {rows} = await client.query(
        `SELECT id, code_hash, should_create_user, password_hash, full_name FROM email_verification_codes
       WHERE email = $1 AND consumed_at IS NULL AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
        [email],
      );
      const verification = rows[0];
      if (
        !verification ||
        !(await bcrypt.compare(code, verification.code_hash))
      ) {
        await client.query('ROLLBACK');
        return sendError(
          res,
          400,
          'The verification code is invalid or expired.',
        );
      }
      let {rows: users} = await client.query(
        'UPDATE email_verification_codes SET consumed_at = now() WHERE id = $1 RETURNING email',
        [verification.id],
      );
      let userResult = await client.query(
        `UPDATE users SET email_verified = true, updated_at = now()
       WHERE email = $1 RETURNING id, email, role, full_name`,
        [users[0].email],
      );
      if (userResult.rowCount === 0 && verification.should_create_user) {
        userResult = await client.query(
          `INSERT INTO users (email, email_verified, password_hash, full_name)
         VALUES ($1, true, $2, $3)
         RETURNING id, email, role, full_name`,
          [email, verification.password_hash, verification.full_name],
        );
        await client.query(
          'INSERT INTO profiles (id, email) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
          [userResult.rows[0].id, email],
        );
      }
      if (userResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return sendError(res, 404, 'No account exists for this email.');
      }
      if (!verification.should_create_user) {
        const {rows: factors} = await client.query(
          `SELECT id FROM two_factor_factors
           WHERE user_id = $1 AND status = 'verified'
           ORDER BY created_at LIMIT 1`,
          [userResult.rows[0].id],
        );
        if (factors[0]) {
          const challengeId = await createMfaChallenge(
            client,
            userResult.rows[0].id,
            factors[0].id,
            'sign_in',
          );
          await client.query('COMMIT');
          return res.json({
            data: {mfa_required: true, mfa_challenge: challengeId},
            error: null,
          });
        }
      }
      const session = await issueSession(client, userResult.rows[0]);
      await client.query('COMMIT');
      return res.json({
        data: {session, user: {id: userResult.rows[0].id, email}},
        error: null,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }),
);

app.post(
  '/api/auth/update',
  authenticate,
  asyncRoute(async (req, res) => {
    const data = req.body?.data || {};
    const allowed = ['full_name', 'department', 'avatar_url'];
    const values = [];
    const sets = [];
    for (const key of allowed) {
      if (Object.hasOwn(data, key)) {
        values.push(data[key]);
        sets.push(`${key} = $${values.length}`);
      }
    }
    if (req.body?.password) {
      values.push(await bcrypt.hash(String(req.body.password), 12));
      sets.push(`password_hash = $${values.length}`);
    }
    if (sets.length) {
      values.push(req.user.id);
      await pool.query(
        `UPDATE users SET ${sets.join(', ')}, updated_at = now() WHERE id = $${
          values.length
        }`,
        values,
      );
    }
    const preferences = Object.fromEntries(
      Object.entries(data).filter(([key]) =>
        [
          'public_visibility',
          'campus_feed_alerts',
          'election_reminders',
          'admin_broadcasts',
          'dark_mode',
          'text_size',
          'anonymous_posting',
          'language',
        ].includes(key),
      ),
    );
    if (Object.keys(preferences).length) {
      await pool.query(
        `INSERT INTO profiles (id, email, preferences, language)
       VALUES ($1, $2, $3, COALESCE($4, 'en-NG'))
       ON CONFLICT (id) DO UPDATE SET
         preferences = profiles.preferences || EXCLUDED.preferences,
         language = COALESCE($4, profiles.language),
         updated_at = now()`,
        [
          req.user.id,
          req.user.email,
          preferences,
          preferences.language || null,
        ],
      );
    }
    return res.json({
      data: {user: {id: req.user.id, email: req.user.email}},
      error: null,
    });
  }),
);

app.post(
  '/api/auth/sign-out',
  authenticate,
  asyncRoute(async (req, res) => {
    await pool.query(
      'UPDATE auth_sessions SET revoked_at = now() WHERE token_id = $1',
      [req.tokenId],
    );
    return res.json({data: {session: null}, error: null});
  }),
);

const campusSearchTypes = {
  feed: 'post',
  events: 'event',
  marketplace: 'marketplace',
  jobs: 'career',
  clubs: 'club',
};

app.get(
  '/api/campus/search',
  authenticate,
  asyncRoute(async (req, res) => {
    const query = String(req.query.q || '')
      .trim()
      .slice(0, 100);
    const requestedType = String(req.query.type || 'all').toLowerCase();
    const itemType =
      requestedType === 'all'
        ? null
        : Object.hasOwn(campusSearchTypes, requestedType)
        ? campusSearchTypes[requestedType]
        : null;
    if (requestedType !== 'all' && !itemType) {
      return sendError(res, 400, 'Unsupported search category.');
    }

    const pattern = `%${query}%`;
    const {rows} = await pool.query(
      `SELECT id, item_type, title, summary, meta, created_at
       FROM (
         SELECT id, 'post'::text AS item_type, title,
                COALESCE(body, '') AS summary, tag AS meta, created_at
         FROM posts
         WHERE ($1 = '' OR title ILIKE $2 OR COALESCE(body, '') ILIKE $2 OR tag ILIKE $2)
         UNION ALL
         SELECT id, 'event'::text, title, description, category, starts_at
         FROM campus_events
         WHERE status = 'published'
           AND starts_at >= now()
           AND ($1 = '' OR title ILIKE $2 OR description ILIKE $2 OR category ILIKE $2 OR venue ILIKE $2)
         UNION ALL
         SELECT id, 'marketplace'::text, title, description, category, created_at
         FROM marketplace_listings
         WHERE status = 'active'
           AND ($1 = '' OR title ILIKE $2 OR description ILIKE $2 OR category ILIKE $2 OR location ILIKE $2)
         UNION ALL
         SELECT id, 'career'::text, title, summary, company, created_at
         FROM career_opportunities
         WHERE status = 'published'
           AND (deadline IS NULL OR deadline > now())
           AND ($1 = '' OR title ILIKE $2 OR summary ILIKE $2 OR company ILIKE $2 OR type ILIKE $2)
         UNION ALL
         SELECT id, 'club'::text, name, description, focus, created_at
         FROM clubs
         WHERE status = 'active'
           AND ($1 = '' OR name ILIKE $2 OR description ILIKE $2 OR focus ILIKE $2)
       ) AS campus_search
       WHERE ($3::text IS NULL OR item_type = $3)
       ORDER BY created_at DESC
       LIMIT 50`,
      [query, pattern, itemType],
    );
    return res.json({data: rows, error: null});
  }),
);

app.get(
  '/api/events',
  authenticate,
  asyncRoute(async (req, res) => {
    const {rows} = await pool.query(
      `SELECT event.id, event.title, event.description, event.category,
              event.venue, event.starts_at, event.ends_at, event.capacity,
              count(rsvp.user_id)::int AS attendee_count,
              COALESCE(bool_or(rsvp.user_id = $1), false) AS is_going
       FROM campus_events AS event
       LEFT JOIN event_rsvps AS rsvp ON rsvp.event_id = event.id
       WHERE event.status = 'published' AND event.starts_at >= now()
       GROUP BY event.id
       ORDER BY event.starts_at ASC`,
      [req.user.id],
    );
    return res.json({data: rows, error: null});
  }),
);

app.post(
  '/api/events/:eventId/rsvp',
  authenticate,
  asyncRoute(async (req, res) => {
    const client = await pool.connect();
    let inTransaction = false;
    try {
      await client.query('BEGIN');
      inTransaction = true;
      const {rows: events} = await client.query(
        `SELECT id, capacity FROM campus_events
         WHERE id = $1 AND status = 'published' AND starts_at >= now()
         FOR UPDATE`,
        [req.params.eventId],
      );
      const event = events[0];
      if (!event) {
        await client.query('ROLLBACK');
        inTransaction = false;
        return sendError(res, 404, 'This event is no longer available.');
      }

      const {rows: existing} = await client.query(
        'SELECT 1 FROM event_rsvps WHERE event_id = $1 AND user_id = $2',
        [event.id, req.user.id],
      );
      if (existing.length > 0) {
        const {rows: counts} = await client.query(
          `SELECT count(*)::int AS attendee_count
           FROM event_rsvps WHERE event_id = $1`,
          [event.id],
        );
        await client.query('COMMIT');
        inTransaction = false;
        return res.json({
          data: {is_going: true, attendee_count: counts[0].attendee_count},
          error: null,
        });
      }

      if (event.capacity !== null) {
        const {rows: counts} = await client.query(
          `SELECT count(*)::int AS attendee_count
           FROM event_rsvps WHERE event_id = $1`,
          [event.id],
        );
        if (counts[0].attendee_count >= event.capacity) {
          await client.query('ROLLBACK');
          inTransaction = false;
          return sendError(res, 409, 'This event has reached capacity.');
        }
      }

      await client.query(
        'INSERT INTO event_rsvps (event_id, user_id) VALUES ($1, $2)',
        [event.id, req.user.id],
      );
      const {rows: counts} = await client.query(
        `SELECT count(*)::int AS attendee_count
         FROM event_rsvps WHERE event_id = $1`,
        [event.id],
      );
      await client.query('COMMIT');
      inTransaction = false;
      return res.json({
        data: {is_going: true, attendee_count: counts[0].attendee_count},
        error: null,
      });
    } finally {
      if (inTransaction) {
        await client.query('ROLLBACK');
      }
      client.release();
    }
  }),
);

app.delete(
  '/api/events/:eventId/rsvp',
  authenticate,
  asyncRoute(async (req, res) => {
    await pool.query(
      'DELETE FROM event_rsvps WHERE event_id = $1 AND user_id = $2',
      [req.params.eventId, req.user.id],
    );
    const {rows} = await pool.query(
      `SELECT count(*)::int AS attendee_count
       FROM event_rsvps WHERE event_id = $1`,
      [req.params.eventId],
    );
    return res.json({
      data: {is_going: false, attendee_count: rows[0].attendee_count},
      error: null,
    });
  }),
);

app.get(
  '/api/marketplace',
  authenticate,
  asyncRoute(async (req, res) => {
    const {rows} = await pool.query(
      `SELECT listing.id, listing.seller_id, listing.title,
              listing.description, listing.category,
              listing.price::float8 AS price,
              listing.location, listing.image_urls, listing.created_at,
              COALESCE(NULLIF(profile.full_name, ''), 'Student') AS seller,
              listing.seller_id = $1 AS is_owner
       FROM marketplace_listings AS listing
       LEFT JOIN profiles AS profile ON profile.id = listing.seller_id
       WHERE listing.status = 'active'
       ORDER BY listing.created_at DESC
       LIMIT 100`,
      [req.user.id],
    );
    return res.json({data: rows, error: null});
  }),
);

app.post(
  '/api/marketplace',
  authenticate,
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        title: z.string().trim().min(3).max(100),
        description: z.string().trim().max(1000).default(''),
        category: z.string().trim().min(1).max(40),
        price: z.number().finite().nonnegative().max(100000000),
        location: z.string().trim().min(2).max(120),
        image_urls: z
          .array(z.string().url().startsWith('https://'))
          .max(5)
          .default([]),
      })
      .safeParse(req.body);
    if (!input.success) {
      return sendError(
        res,
        400,
        input.error.issues[0]?.message || 'Invalid listing details.',
      );
    }
    const {title, description, category, price, location, image_urls} =
      input.data;
    const {rows} = await pool.query(
      `INSERT INTO marketplace_listings
         (seller_id, title, description, category, price, location, image_urls)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, seller_id, title, description, category,
                 price::float8 AS price, location, image_urls, created_at`,
      [req.user.id, title, description, category, price, location, image_urls],
    );
    return res.status(201).json({
      data: {
        ...rows[0],
        seller: req.user.full_name || 'Student',
        is_owner: true,
      },
      error: null,
    });
  }),
);

app.get(
  '/api/saved',
  authenticate,
  asyncRoute(async (req, res) => {
    const {rows} = await pool.query(
      `SELECT saved.item_type, saved.item_id, saved.created_at,
              COALESCE(post.title, event.title, listing.title,
                       opportunity.title, club.name) AS title,
              COALESCE(post.body, event.description, listing.description,
                       opportunity.summary, club.description, '') AS summary,
              CASE saved.item_type
                WHEN 'post' THEN post.tag
                WHEN 'event' THEN event.category
                WHEN 'marketplace' THEN listing.category
                WHEN 'career' THEN opportunity.company
                WHEN 'club' THEN club.focus
              END AS meta
       FROM saved_items AS saved
       LEFT JOIN posts AS post
         ON saved.item_type = 'post' AND post.id = saved.item_id
       LEFT JOIN campus_events AS event
         ON saved.item_type = 'event' AND event.id = saved.item_id
       LEFT JOIN marketplace_listings AS listing
         ON saved.item_type = 'marketplace' AND listing.id = saved.item_id
       LEFT JOIN career_opportunities AS opportunity
         ON saved.item_type = 'career' AND opportunity.id = saved.item_id
       LEFT JOIN clubs AS club
         ON saved.item_type = 'club' AND club.id = saved.item_id
       WHERE saved.user_id = $1
         AND COALESCE(post.id, event.id, listing.id, opportunity.id, club.id) IS NOT NULL
       ORDER BY saved.created_at DESC`,
      [req.user.id],
    );
    return res.json({data: rows, error: null});
  }),
);

app.get(
  '/api/saved/:itemType/:itemId',
  authenticate,
  asyncRoute(async (req, res) => {
    const itemTypes = new Set([
      'post',
      'event',
      'marketplace',
      'career',
      'club',
    ]);
    if (!itemTypes.has(req.params.itemType)) {
      return sendError(res, 400, 'Unsupported saved item type.');
    }
    const {rows} = await pool.query(
      `SELECT 1 FROM saved_items
       WHERE user_id = $1 AND item_type = $2 AND item_id = $3`,
      [req.user.id, req.params.itemType, req.params.itemId],
    );
    return res.json({data: {saved: rows.length > 0}, error: null});
  }),
);

app.post(
  '/api/saved',
  authenticate,
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        item_type: z.enum(['post', 'event', 'marketplace', 'career', 'club']),
        item_id: z.string().trim().min(1).max(100),
      })
      .safeParse(req.body);
    if (!input.success) {
      return sendError(
        res,
        400,
        'A valid saved item type and ID are required.',
      );
    }
    const itemTables = {
      post: ['posts', 'id', null],
      event: ['campus_events', 'id', "status = 'published'"],
      marketplace: ['marketplace_listings', 'id', "status = 'active'"],
      career: ['career_opportunities', 'id', "status = 'published'"],
      club: ['clubs', 'id', "status = 'active'"],
    };
    const [table, idColumn, statusFilter] = itemTables[input.data.item_type];
    const {rows: available} = await pool.query(
      `SELECT 1 FROM "${table}" WHERE "${idColumn}" = $1${
        statusFilter ? ` AND ${statusFilter}` : ''
      }`,
      [input.data.item_id],
    );
    if (available.length === 0) {
      return sendError(res, 404, 'This item is no longer available to save.');
    }
    await pool.query(
      `INSERT INTO saved_items (user_id, item_type, item_id)
       VALUES ($1, $2, $3) ON CONFLICT (user_id, item_type, item_id) DO NOTHING`,
      [req.user.id, input.data.item_type, input.data.item_id],
    );
    return res.json({data: {saved: true}, error: null});
  }),
);

app.delete(
  '/api/saved/:itemType/:itemId',
  authenticate,
  asyncRoute(async (req, res) => {
    const itemTypes = new Set([
      'post',
      'event',
      'marketplace',
      'career',
      'club',
    ]);
    if (!itemTypes.has(req.params.itemType)) {
      return sendError(res, 400, 'Unsupported saved item type.');
    }
    await pool.query(
      `DELETE FROM saved_items
       WHERE user_id = $1 AND item_type = $2 AND item_id = $3`,
      [req.user.id, req.params.itemType, req.params.itemId],
    );
    return res.json({data: {saved: false}, error: null});
  }),
);

app.get(
  '/api/career',
  authenticate,
  asyncRoute(async (req, res) => {
    const {rows} = await pool.query(
      `SELECT opportunity.id, opportunity.company, opportunity.title,
              opportunity.summary, opportunity.type, opportunity.mode,
              opportunity.deadline, opportunity.stipend::float8 AS stipend,
              opportunity.application_url,
              EXISTS (
                SELECT 1 FROM opportunity_applications AS application
                WHERE application.opportunity_id = opportunity.id
                  AND application.user_id = $1
              ) AS has_applied
       FROM career_opportunities AS opportunity
       WHERE opportunity.status = 'published'
         AND (opportunity.deadline IS NULL OR opportunity.deadline > now())
       ORDER BY opportunity.deadline ASC NULLS LAST, opportunity.created_at DESC`,
      [req.user.id],
    );
    return res.json({data: rows, error: null});
  }),
);

app.post(
  '/api/career/:opportunityId/apply',
  authenticate,
  asyncRoute(async (req, res) => {
    const {rows: opportunities} = await pool.query(
      `SELECT id FROM career_opportunities
       WHERE id = $1 AND status = 'published'
         AND (deadline IS NULL OR deadline > now())`,
      [req.params.opportunityId],
    );
    if (opportunities.length === 0) {
      return sendError(
        res,
        404,
        'This opportunity is no longer accepting applications.',
      );
    }
    await pool.query(
      `INSERT INTO opportunity_applications (opportunity_id, user_id)
       VALUES ($1, $2) ON CONFLICT (opportunity_id, user_id) DO NOTHING`,
      [req.params.opportunityId, req.user.id],
    );
    return res.json({data: {has_applied: true}, error: null});
  }),
);

app.get(
  '/api/clubs',
  authenticate,
  asyncRoute(async (req, res) => {
    const {rows} = await pool.query(
      `SELECT club.id, club.name, club.description, club.focus, club.icon,
              count(membership.user_id)::int AS member_count,
              COALESCE(bool_or(membership.user_id = $1), false) AS is_member
       FROM clubs AS club
       LEFT JOIN club_memberships AS membership ON membership.club_id = club.id
       WHERE club.status = 'active'
       GROUP BY club.id
       ORDER BY club.name ASC`,
      [req.user.id],
    );
    return res.json({data: rows, error: null});
  }),
);

app.post(
  '/api/clubs/:clubId/join',
  authenticate,
  asyncRoute(async (req, res) => {
    const {rowCount} = await pool.query(
      `INSERT INTO club_memberships (club_id, user_id)
       SELECT id, $2 FROM clubs WHERE id = $1 AND status = 'active'
       ON CONFLICT (club_id, user_id) DO NOTHING`,
      [req.params.clubId, req.user.id],
    );
    if (!rowCount) {
      const {rows} = await pool.query(
        "SELECT 1 FROM clubs WHERE id = $1 AND status = 'active'",
        [req.params.clubId],
      );
      if (rows.length === 0) {
        return sendError(res, 404, 'This club is no longer available.');
      }
    }
    const {rows} = await pool.query(
      `SELECT count(*)::int AS member_count
       FROM club_memberships WHERE club_id = $1`,
      [req.params.clubId],
    );
    return res.json({
      data: {is_member: true, member_count: rows[0].member_count},
      error: null,
    });
  }),
);

app.delete(
  '/api/clubs/:clubId/join',
  authenticate,
  asyncRoute(async (req, res) => {
    await pool.query(
      'DELETE FROM club_memberships WHERE club_id = $1 AND user_id = $2',
      [req.params.clubId, req.user.id],
    );
    const {rows} = await pool.query(
      `SELECT count(*)::int AS member_count
       FROM club_memberships WHERE club_id = $1`,
      [req.params.clubId],
    );
    return res.json({
      data: {is_member: false, member_count: rows[0].member_count},
      error: null,
    });
  }),
);

app.post(
  '/api/db/:table',
  authenticate,
  asyncRoute(async (req, res) => {
    const result = await queryTable(req.params.table, req.body || {}, req.user);
    return res.json({...result, error: null});
  }),
);

app.post(
  '/api/rpc/:name',
  authenticate,
  asyncRoute(async (req, res) => {
    const args = req.body || {};
    const {name} = req.params;
    if (
      [
        'increment_like',
        'decrement_like',
        'increment_comment',
        'decrement_comment',
      ].includes(name)
    ) {
      return sendError(res, 403, 'Post counters are managed by the server.');
    }
    if (name === 'cast_vote') {
      const {rows} = await pool.query(
        'SELECT cast_vote($1, $2, $3, $4) AS result',
        [
          args.p_election_id,
          args.p_position_id,
          args.p_candidate_id,
          req.user.id,
        ],
      );
      return res.json({data: rows[0].result, error: null});
    }
    return sendError(res, 404, `Unknown API operation "${name}".`);
  }),
);

app.use((error, _req, res, _next) => {
  console.error('API error:', error.message);
  if (res.headersSent) {
    return;
  }
  const status = Number(error.status) || 500;
  return sendError(
    res,
    status,
    status >= 500 ? 'The API request failed.' : error.message,
  );
});

async function start() {
  await pool.query('SELECT 1');
  const schemaPath = path.join(__dirname, 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    throw new Error('Database schema file is missing.');
  }
  app.listen(port, () => {
    console.log(`UniOsunPulse API listening on port ${port}.`);
  });
}

start().catch(error => {
  console.error('Unable to start API:', error.message);
  process.exitCode = 1;
  pool.end();
});
