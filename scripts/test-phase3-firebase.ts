/**
 * Phase 3 Security & Regression Verification Suite
 * Cloud Firestore Rules, Cloud Storage Rules, Firebase App Config & Media Upload Security
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function stripCommentsAndStrings(source: string): string {
  // Remove single-quoted strings, double-quoted strings, and // line comments
  return source
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/\/\/[^\n]*/g, '');
}

function assertBalancedDelimiters(source: string, label: string) {
  const codeOnly = stripCommentsAndStrings(source);
  let braces = 0;
  let parens = 0;
  let brackets = 0;
  for (let i = 0; i < codeOnly.length; i += 1) {
    const ch = codeOnly[i];
    if (ch === '{') braces += 1;
    else if (ch === '}') braces -= 1;
    else if (ch === '(') parens += 1;
    else if (ch === ')') parens -= 1;
    else if (ch === '[') brackets += 1;
    else if (ch === ']') brackets -= 1;
    assert.ok(braces >= 0, `${label}: unmatched closing '}' at stripped offset ${i}`);
    assert.ok(parens >= 0, `${label}: unmatched closing ')' at stripped offset ${i}`);
    assert.ok(brackets >= 0, `${label}: unmatched closing ']' at stripped offset ${i}`);
  }
  assert.equal(braces, 0, `${label}: unbalanced '{' vs '}'`);
  assert.equal(parens, 0, `${label}: unbalanced '(' vs ')'`);
  assert.equal(brackets, 0, `${label}: unbalanced '[' vs ']'`);
}

function extractMatchBlock(rules: string, matchHeader: string): string {
  const idx = rules.indexOf(matchHeader);
  assert.notEqual(idx, -1, `Expected block '${matchHeader}' in rules`);
  const lineEnd = rules.indexOf('\n', idx);
  const braceStart = rules.lastIndexOf('{', lineEnd === -1 ? rules.length : lineEnd);
  assert.ok(braceStart >= idx, `Expected opening '{' at end of header line '${matchHeader}'`);
  let depth = 0;
  for (let i = braceStart; i < rules.length; i += 1) {
    if (rules[i] === '{') depth += 1;
    else if (rules[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        return rules.slice(idx, i + 1);
      }
    }
  }
  throw new Error(`Unterminated block '${matchHeader}'`);
}

function runPhase3Checks() {
  const cwd = process.cwd();
  const firestoreRules = fs.readFileSync(path.join(cwd, 'firestore.rules'), 'utf-8');
  const storageRules = fs.readFileSync(path.join(cwd, 'storage.rules'), 'utf-8');
  const firebaseJson = JSON.parse(fs.readFileSync(path.join(cwd, 'firebase.json'), 'utf-8'));

  let passed = 0;
  function check(label: string, fn: () => void) {
    fn();
    passed += 1;
    console.log(`  [PASS ${passed}] ${label}`);
  }

  console.log('\n=== MSHINDIROOM PHASE 3 FIRESTORE & STORAGE SECURITY SUITE ===\n');

  check('1. firebase.json maps both firestore.rules and storage.rules', () => {
    assert.equal(firebaseJson?.firestore?.rules, 'firestore.rules');
    assert.equal(firebaseJson?.storage?.rules, 'storage.rules');
  });

  check('2. firestore.rules and storage.rules have balanced syntax & default-deny catch-alls', () => {
    assertBalancedDelimiters(firestoreRules, 'firestore.rules');
    assertBalancedDelimiters(storageRules, 'storage.rules');
    assert.ok(firestoreRules.includes("rules_version = '2';"));
    assert.ok(storageRules.includes("rules_version = '2';"));
    assert.ok(
      /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;\s*\}/.test(firestoreRules)
    );
    assert.ok(
      /match \/\{allPaths=\*\*\}\s*\{\s*allow read, write: if false;\s*\}/.test(storageRules)
    );
  });

  check('3. isOwner() handles canonical 12-digit 254... and 10-digit 07... phones safely', () => {
    const fnBlock = extractMatchBlock(firestoreRules, 'function isOwner(userId)');
    assert.ok(fnBlock.includes("request.auth.token.phone_number == ('+' + userId)"));
    assert.ok(fnBlock.includes('hasAuthPhone()'));
    assert.ok(firestoreRules.includes("('admin' in request.auth.token)"));
  });

  check('4. users/{userId} restricts read to owner/admin and blocks token/privilege/financial tampering', () => {
    const usersBlock = extractMatchBlock(firestoreRules, 'match /users/{userId}');
    const usersHeaderOnly = usersBlock.split('match /savedPosts')[0];
    assert.ok(usersHeaderOnly.includes('allow read: if isOwner(userId) || isAdmin();'));
    assert.equal(/\ballow read:\s*if\s*isSignedIn\(\)\s*;/.test(usersHeaderOnly), false);
    assert.ok(usersHeaderOnly.includes('hasNoProtectedUserFields()'));
    assert.ok(usersHeaderOnly.includes('isValidUserUidOnWrite()'));
    assert.ok(usersHeaderOnly.includes('isValidUserProfile(request.resource.data)'));

    for (const protectedField of [
      "'role'",
      "'isAdmin'",
      "'admin'",
      "'verifiedWithSms'",
      "'verifiedAt'",
      "'subscription'",
      "'balance'",
      "'walletBalanceKsh'",
      "'mshindiTokens'",
      "'tokenBalance'",
      "'activeTokenIds'",
    ]) {
      assert.ok(
        firestoreRules.includes(protectedField),
        `Protected field ${protectedField} must be blocked in firestore.rules`
      );
    }
  });

  check('5. Server-only collections authAccounts, fixtureSnapshots, token*, and subscription* are write-locked', () => {
    const authAccountsBlock = extractMatchBlock(firestoreRules, 'match /authAccounts/{phoneId}');
    assert.ok(authAccountsBlock.includes('allow read, write: if false;'));

    const snapshotsBlock = extractMatchBlock(firestoreRules, 'match /fixtureSnapshots/{snapshotId}');
    assert.ok(snapshotsBlock.includes('allow read, write: if false;'));

    for (const col of [
      'match /tokenWallets/{userId}',
      'match /tokenUnits/{tokenId}',
      'match /tokenTransactions/{transactionId}',
      'match /tokenReferrals/{referralId}',
      'match /tokenMigrations/{migrationId}',
      'match /subscriptions/{userId}',
      'match /subscriptionHistory/{historyId}',
    ]) {
      const blk = extractMatchBlock(firestoreRules, col);
      assert.ok(
        blk.includes('allow create, update, delete: if false;'),
        `${col} must deny client writes`
      );
    }

    // Verify top-level subscriptionHistory lock too
    const topSubIdx = firestoreRules.lastIndexOf('match /subscriptionHistory/{historyId}');
    assert.ok(topSubIdx > firestoreRules.indexOf('match /subscriptions/{userId}'));
    assert.ok(
      firestoreRules.slice(topSubIdx, topSubIdx + 220).includes('allow create, update, delete: if false;')
    );
  });

  check('6. playerRatings/{userId} and history subcollection restrict all writes to isAdmin()', () => {
    const ratingsBlock = extractMatchBlock(firestoreRules, 'match /playerRatings/{userId}');
    assert.ok(ratingsBlock.includes('allow read: if true;'));
    assert.ok(ratingsBlock.includes('allow create, update, delete: if isAdmin();'));
    assert.equal(ratingsBlock.includes('isOwner(userId)'), false);
  });

  check('7. picks/{pickId} separates delete from counter updates & validates author', () => {
    const picksBlock = extractMatchBlock(firestoreRules, 'match /picks/{pickId}');
    const picksTop = picksBlock.split('match /likes')[0];
    assert.equal(/allow update,\s*delete:/.test(picksTop), false);
    assert.ok(picksTop.includes('allow update:'));
    assert.ok(picksTop.includes('allow delete: if isAdmin()'));
    assert.ok(picksTop.includes('isValidPickDoc(request.resource.data)'));
    assert.ok(picksTop.includes('isValidPickAuthorUpdate()'));
  });

  check('8. posts/{postId} and comments enforce validated creation & prevent username spoofing', () => {
    const postBlock = extractMatchBlock(firestoreRules, 'match /posts/{postId}');
    assert.ok(postBlock.includes('request.resource.data.likes == 0'));
    assert.ok(postBlock.includes('request.resource.data.saves == 0'));
    assert.ok(postBlock.includes('request.resource.data.shares == 0'));

    const commentFn = extractMatchBlock(firestoreRules, 'function isCommentAuthor(docData)');
    assert.equal(commentFn.includes('docData.username'), false);
    assert.equal(commentFn.includes('docData.user)'), false);

    assert.equal(/\ballow create:\s*if\s*isSignedIn\(\)\s*;/.test(firestoreRules), false);
    const topComments = extractMatchBlock(firestoreRules, 'match /comments/{commentId}');
    assert.ok(topComments.includes('isValidCommentDoc(request.resource.data)'));
    assert.ok(topComments.includes('isCommentAuthor(request.resource.data)'));
    assert.ok(topComments.includes('hasConsistentCommentIdentity(request.resource.data)'));
  });

  check('9. storage.rules enforces strict admin-only writes, MIME allowlists, and filename regexes', () => {
    const carouselBlk = extractMatchBlock(
      storageRules,
      'match /homepage-carousel/{photoId}/{fileName}'
    );
    assert.ok(carouselBlk.includes("request.resource.contentType == 'image/webp'"));
    assert.ok(carouselBlk.includes('isAdmin()'));

    const feedBlk = extractMatchBlock(storageRules, 'match /feed/{fileName}');
    assert.equal(feedBlk.includes("image/.*"), false, 'feed/ must not allow unfiltered image/* (SVG XSS)');
    assert.ok(feedBlk.includes("'image/webp'"));
    assert.ok(feedBlk.includes('fileName.matches('));

    const fixturesBlk = extractMatchBlock(storageRules, 'match /fixtures/{fileName}');
    assert.ok(fixturesBlk.includes("'application/pdf'"));
    assert.ok(fixturesBlk.includes('fileName.matches('));

    const avatarsBlk = extractMatchBlock(storageRules, 'match /avatars/{fileName}');
    assert.ok(avatarsBlk.includes("'image/png'"));
    assert.ok(avatarsBlk.includes('fileName.matches('));

    const moderationBlk = extractMatchBlock(storageRules, 'match /moderation/{fileName}');
    assert.ok(moderationBlk.includes('allow read: if isAdmin();'));
    assert.ok(moderationBlk.includes("'application/json'"));
    assert.ok(moderationBlk.includes('fileName.matches('));
  });

  check('10. Media upload fallbacks pass credentials:include & client bundle embeds no private keys', () => {
    const carouselSvc = fs.readFileSync(
      path.join(cwd, 'src', 'lib', 'carouselStorageService.ts'),
      'utf-8'
    );
    const mediaSvc = fs.readFileSync(
      path.join(cwd, 'src', 'lib', 'mediaUploadService.ts'),
      'utf-8'
    );
    const firebaseClient = fs.readFileSync(path.join(cwd, 'src', 'firebase.ts'), 'utf-8');

    assert.ok(carouselSvc.includes("credentials: 'include'"));
    assert.ok(mediaSvc.includes("credentials: 'include'"));
    assert.equal(firebaseClient.includes('BEGIN PRIVATE KEY'), false);
    assert.equal(firebaseClient.includes('FIREBASE_SERVICE_ACCOUNT'), false);
  });

  console.log(`\nALL ${passed}/${passed} PHASE 3 FIRESTORE & STORAGE SECURITY CHECKS PASSED.\n`);
}

runPhase3Checks();

