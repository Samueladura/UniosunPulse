# How to Grant a Verified Badge

The `verified` column lives on the `public.profiles` table. Any of the
steps below will mark a user as verified.

## 1. Via Supabase Dashboard SQL Editor
```sql
-- Replace the UUID with the target user's ID
UPDATE public.profiles
SET verified = true
WHERE id = '00000000-0000-0000-0000-000000000000';
```

## 2. Via Supabase Table Editor
1. Open your project → Database → Tables.
2. Select `profiles`.
3. Find the user row and toggle the `verified` column to `true`.

## 3. Via App (admin only)
From `AdminUserVerificationScreen`, approving a student verification
request runs the SQL equivalent automatically.

After running either SQL statement, the blue check-circle badge appears
next to the user's name in:
- `UserProfileScreen`
- `NewPostScreen`
