/* eslint-env node */
const assert = require('node:assert/strict');
const test = require('node:test');
const {
  decryptSecret,
  encryptSecret,
  generateTotp,
  generateTotpSecret,
  hashChallenge,
  verifyTotp,
} = require('../server/mfa');

const previousKey = process.env.MFA_ENCRYPTION_KEY;
process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');

test.after(() => {
  if (previousKey === undefined) {
    delete process.env.MFA_ENCRYPTION_KEY;
  } else {
    process.env.MFA_ENCRYPTION_KEY = previousKey;
  }
});

test('matches the RFC 6238 SHA-1 test vector', () => {
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  assert.equal(generateTotp(secret, 59000), '287082');
});

test('round-trips encrypted authenticator secrets', () => {
  const secret = generateTotpSecret();
  assert.equal(decryptSecret(encryptSecret(secret)), secret);
});

test('verifies current TOTP codes and rejects invalid input', () => {
  const secret = generateTotpSecret();
  const now = 1_800_000_000_000;
  const code = generateTotp(secret, now);
  const incorrectCode = String((Number(code) + 1) % 1_000_000).padStart(
    6,
    '0',
  );
  assert.equal(verifyTotp(secret, code, now), true);
  assert.equal(verifyTotp(secret, 'not-a-code', now), false);
  assert.equal(verifyTotp(secret, incorrectCode, now), false);
});

test('hashes challenges deterministically', () => {
  assert.equal(hashChallenge('challenge'), hashChallenge('challenge'));
  assert.notEqual(hashChallenge('challenge'), hashChallenge('another'));
});
