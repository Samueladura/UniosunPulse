require('dotenv').config();

const bcrypt = require('bcryptjs');
const {Pool} = require('pg');

const connectionString =
  process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Set DATABASE_URL in the root .env file before seeding.');
  process.exit(1);
}

const pool = new Pool({connectionString});

async function seed() {
  const adminHash = await bcrypt.hash('adminaccess', 12);
  const userHash = await bcrypt.hash('@aduragbemi1', 12);

  await pool.query(
    `INSERT INTO users (email, password_hash, email_verified, full_name, role)
     VALUES ($1, $2, true, $3, 'admin')
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           email_verified = true,
           role = 'admin'`,
    ['uniosunpulse@gmail.com', adminHash, 'Admin'],
  );

  const {
    rows: [targetUser],
  } = await pool.query(
    `INSERT INTO users (email, password_hash, email_verified, full_name, role)
     VALUES ($1, $2, true, $3, 'student')
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           email_verified = true,
           full_name = EXCLUDED.full_name
     RETURNING id`,
    ['babayemiayomide87@gmail.com', userHash, 'Samuel'],
  );

  await pool.query(
    `INSERT INTO profiles (id, full_name, email, verified)
     VALUES ($1, $2, $3, true)
     ON CONFLICT (id) DO UPDATE
       SET full_name = EXCLUDED.full_name,
           verified = true`,
    [targetUser.id, 'Samuel', 'babayemiayomide87@gmail.com'],
  );

  const followerIds = [];
  for (let i = 0; i < 160; i++) {
    const followerEmail = `follower${i}@example.com`;
    const {
      rows: [follower],
    } = await pool.query(
      `INSERT INTO users (email, password_hash, email_verified, full_name, role)
       VALUES ($1, $2, true, $3, 'student')
       ON CONFLICT (email) DO UPDATE
         SET email_verified = true
       RETURNING id`,
      [followerEmail, await bcrypt.hash(`password${i}`, 12), `Follower ${i}`],
    );
    followerIds.push(follower.id);
  }

  await pool.query(
    `INSERT INTO follows (follower_id, following_id)
     SELECT UNNEST($1::text[]), $2
     ON CONFLICT DO NOTHING`,
    [followerIds, targetUser.id],
  );

  console.log('Seed data inserted successfully.');
}

seed()
  .catch(error => {
    console.error('Seeding failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
