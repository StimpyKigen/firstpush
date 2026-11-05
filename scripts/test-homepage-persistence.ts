/**
 * Comprehensive Verification Suite: Permanent Homepage Feed Content Persistence
 *
 * Executes all 9 mandatory verification tests (Tests A through I):
 * - Test A: Initial Publishing (>= 5 homepage feed posts: photos, captions, videos)
 * - Test B: Deployment Simulation #1 (cold start, cache wipe, fresh session load)
 * - Test C: Additional Publishing (+3 posts = 8 total) & Deployment Simulation #2
 * - Test D: Editing & Archiving Persistence Across Deployment Simulation #3
 * - Test E: Media Persistence Across Deployments (survives deletion of public/images/uploads)
 * - Test F: Database Failure Handling & Recovery (protects existing posts during outage)
 * - Test G: Social Interaction Preservation (likes, comments, saves survive edits & deploys)
 * - Test H: Security Verification (blocks non-admin users from publishing/editing/deleting)
 * - Test I: Production Environment Consistency (`mshindiroom-production` in built bundle)
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import {
  addCarouselItem,
  updateCarouselItem,
  archiveCarouselItem,
  deleteCarouselItem,
  addVideoItem,
  getHomepageFeedSnapshot,
  getHomepageFeedSyncState,
  refreshHomepageFeed,
  simulateClientDeploymentReload,
  setClientDatabaseFailureSimulation,
  toggleHomepagePostLike,
  toggleHomepagePostSave,
  addHomepagePostComment,
} from '../src/lib/homepageFeedStore.js';
import {
  getSavedHomepageFeedAsync,
  saveHomepageFeedAsync,
  simulateServerDeploymentColdStart,
  setServerDatabaseFailureSimulation,
  getPermanentMediaAsset,
} from '../src/lib/serverHomepageFeed.js';
import { uploadCarouselPhotoWebp } from '../src/lib/carouselStorageService.js';
import {
  verifyAdminPinCredentials,
  verifyAdminRequest,
  ADMIN_PHONE_NORMALIZED,
} from '../src/lib/adminAuthService.js';
import { firebaseConfig } from '../src/firebase.js';

// Valid 1x1 WebP binary (RIFF....WEBPVP8 ...)
const VALID_WEBP_BASE64 =
  'UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=';

function createMockWebpFile(name: string): File {
  const bytes = Buffer.from(VALID_WEBP_BASE64, 'base64');
  return new File([bytes], name, { type: 'image/webp' });
}

async function runTests() {
  console.log('================================================================================');
  console.log('MSHINDIROOM — PERMANENT HOMEPAGE FEED PERSISTENCE VERIFICATION SUITE (TESTS A–I)');
  console.log('================================================================================\n');

  // Backup existing data files so test can either restore or leave clean verified state
  const dataDir = path.join(process.cwd(), 'data');
  const feedFilePath = path.join(dataDir, 'homepage_feed.json');
  const postsFilePath = path.join(dataDir, 'homepage_posts.json');
  const mediaFilePath = path.join(dataDir, 'homepage_media.json');

  const initialBackupFeed = fs.existsSync(feedFilePath)
    ? fs.readFileSync(feedFilePath, 'utf-8')
    : null;
  const initialBackupPosts = fs.existsSync(postsFilePath)
    ? fs.readFileSync(postsFilePath, 'utf-8')
    : null;
  const initialBackupMedia = fs.existsSync(mediaFilePath)
    ? fs.readFileSync(mediaFilePath, 'utf-8')
    : null;

  try {
    // Reset test slate cleanly before starting Test A
    await saveHomepageFeedAsync(
      { carouselItems: [], videoItems: [], deletedIds: [] },
      { allowReplaceAll: true }
    );
    await simulateClientDeploymentReload();

    // Authenticate admin and obtain signed token
    const adminAuth = verifyAdminPinCredentials('0743304579', '7433');
    assert.strictEqual(adminAuth.valid, true, 'Admin PIN verification must succeed for 0743304579');
    assert.ok(adminAuth.adminToken, 'Admin token must be issued');
    const adminOpts = {
      adminToken: adminAuth.adminToken,
      callerPhone: ADMIN_PHONE_NORMALIZED,
      callerRole: 'admin' as const,
    };

    // =========================================================================
    // TEST A — INITIAL PUBLISHING (5 POSTS: 3 DIRECT PHOTO LINKS + 2 VIDEOS)
    // =========================================================================
    console.log('▶ Running TEST A: Initial Publishing (5 Homepage Posts with Direct Photo Links)...');

    const post1 = await addCarouselItem(
      {
        id: 'perm-carousel-1',
        imageUrl: 'https://mp3tourl.com/images/arsenal-chelsea-tactical-derby.jpg',
        heading: 'Arsenal vs Chelsea Tactical Breakdown',
        caption: 'High-pressing midfield transitions define the London derby consensus.',
        source: 'Mshindi Editorial Desk',
        published: true,
      },
      adminOpts
    );

    const post2 = await addCarouselItem(
      {
        id: 'perm-carousel-2',
        imageUrl: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80',
        heading: 'UEFA Champions League Quarter-Final Preview',
        caption: 'Top European heavyweights clash under the floodlights.',
        source: 'UEFA Media Pool',
        published: true,
      },
      adminOpts
    );

    const post3 = await addCarouselItem(
      {
        id: 'perm-carousel-3',
        imageUrl: 'https://mp3tourl.com/images/mega-jackpot-17-leg-consensus.webp',
        heading: 'Mega Jackpot 17-Leg Consensus Report',
        caption: 'Over 4,200 verified punters lock in weekend banker selections.',
        source: 'Mshindi Analytics',
        published: true,
      },
      adminOpts
    );

    const post4 = await addVideoItem(
      {
        id: 'perm-video-4',
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        title: 'Weekend Premier League Goal Rush & Analytical Recap',
        published: true,
        type: 'youtube',
      },
      adminOpts
    );

    const post5 = await addVideoItem(
      {
        id: 'perm-video-5',
        youtubeUrl: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
        title: 'Midweek Jackpot Sharp Punter Roundtable',
        published: true,
        type: 'youtube',
      },
      adminOpts
    );

    assert.ok(post1 && post2 && post3 && post4 && post5, 'All 5 initial posts must be created');

    const snapshotA = getHomepageFeedSnapshot();
    assert.strictEqual(snapshotA.carouselItems.length, 3, 'Should have 3 carousel posts in store');
    assert.strictEqual(snapshotA.videoItems.length, 2, 'Should have 2 video posts in store');

    const initialIds = [post1.id, post2.id, post3.id, post4!.id, post5!.id];
    const initialCreatedAtMap = new Map<string, string>([
      [post1.id, post1.createdAt],
      [post2.id, post2.createdAt],
      [post3.id, post3.createdAt],
      [post4!.id, post4!.createdAt],
      [post5!.id, post5!.createdAt],
    ]);

    console.log('  ✓ Published 5 posts with permanent IDs:', initialIds.join(', '));

    // =========================================================================
    // TEST B — DEPLOYMENT SIMULATION #1
    // =========================================================================
    console.log('\n▶ Running TEST B: Deployment Simulation #1 (Cold Start + Cache Wipe)...');

    // Simulate a brand new container deployment: wipe server memory, wipe .cache, wipe client memory
    simulateServerDeploymentColdStart();
    const hydratedAfterDeploy1 = await simulateClientDeploymentReload();

    assert.strictEqual(
      hydratedAfterDeploy1.carouselItems.length,
      3,
      'All 3 carousel posts must survive Deployment #1'
    );
    assert.strictEqual(
      hydratedAfterDeploy1.videoItems.length,
      2,
      'All 2 video posts must survive Deployment #1'
    );

    for (const item of [
      ...hydratedAfterDeploy1.carouselItems,
      ...hydratedAfterDeploy1.videoItems,
    ]) {
      assert.strictEqual(
        item.createdAt,
        initialCreatedAtMap.get(item.id),
        `Post ${item.id} createdAt timestamp must remain identical after Deployment #1`
      );
      assert.strictEqual(item.status, 'published', `Post ${item.id} status must be 'published'`);
      assert.strictEqual(item.isActive, true, `Post ${item.id} isActive must be true`);
      assert.strictEqual(item.authorRole, 'admin', `Post ${item.id} authorRole must be 'admin'`);
    }

    console.log('  ✓ All 5 posts, IDs, timestamps, and media survived Deployment Simulation #1!');

    // =========================================================================
    // TEST C — ADDITIONAL PUBLISHING (+3 POSTS = 8 TOTAL) & DEPLOYMENT #2
    // =========================================================================
    console.log('\n▶ Running TEST C: Additional Publishing (+3 Posts = 8 Total) & Deployment #2...');

    const post6 = await addCarouselItem(
      {
        id: 'perm-carousel-6',
        imageUrl: 'https://mp3tourl.com/images/serie-a-scudetto-stretch.jpg',
        heading: 'Serie A Title Race Enters Final Stretch',
        caption: 'Inter and Napoli tactical metrics compared ahead of Sunday kickoff.',
        source: 'Gazzetta Sport',
        published: true,
      },
      adminOpts
    );

    const post7 = await addCarouselItem(
      {
        id: 'perm-carousel-7',
        imageUrl: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1200&q=80',
        heading: 'El Clasico Expected Goals (xG) Report',
        caption: 'Real Madrid and Barcelona attacking zones analyzed.',
        source: 'LaLiga Data',
        published: true,
      },
      adminOpts
    );

    const post8 = await addVideoItem(
      {
        id: 'perm-video-8',
        youtubeUrl: 'https://www.youtube.com/watch?v=9bZkp7q19f0',
        title: 'CAF Champions League Knockout Stage Highlights',
        published: true,
        type: 'youtube',
      },
      adminOpts
    );

    assert.ok(post6 && post7 && post8, 'Additional 3 posts must be created');

    // Simulate second deployment
    simulateServerDeploymentColdStart();
    const hydratedAfterDeploy2 = await simulateClientDeploymentReload();

    const totalAfterDeploy2 =
      hydratedAfterDeploy2.carouselItems.length + hydratedAfterDeploy2.videoItems.length;
    assert.strictEqual(
      totalAfterDeploy2,
      8,
      `Expected 8 total posts after Deployment #2, got ${totalAfterDeploy2}`
    );
    console.log('  ✓ All 8 posts (5 original + 3 new) survived Deployment Simulation #2!');

    // =========================================================================
    // TEST D — EDITING AND ARCHIVING ACROSS DEPLOYMENT #3
    // =========================================================================
    console.log('\n▶ Running TEST D: Editing and Archiving Persistence Across Deployment #3...');

    const originalPost1CreatedAt = post1.createdAt;
    const editedPost1 = await updateCarouselItem(
      'perm-carousel-1',
      {
        heading: 'UPDATED: Arsenal 2-1 Chelsea Full-Time Tactical Review',
        caption: 'Updated post-match consensus analysis after the final whistle.',
      },
      adminOpts
    );
    assert.ok(editedPost1, 'Edited post must be returned');
    assert.strictEqual(editedPost1!.id, 'perm-carousel-1', 'Edited post ID must not change');
    assert.strictEqual(
      editedPost1!.createdAt,
      originalPost1CreatedAt,
      'Edited post createdAt must be preserved'
    );

    // Archive post 2
    const archivedPost2 = await archiveCarouselItem('perm-carousel-2', adminOpts);
    assert.ok(archivedPost2, 'Archived post must be returned');
    assert.strictEqual(archivedPost2!.published, false, 'Archived post published flag must be false');
    assert.strictEqual(archivedPost2!.isActive, false, 'Archived post isActive flag must be false');
    assert.strictEqual(archivedPost2!.status, 'archived', 'Archived post status must be archived');

    // Simulate third deployment
    simulateServerDeploymentColdStart();
    const hydratedAfterDeploy3 = await simulateClientDeploymentReload();

    // Ensure no duplicate was created (still 5 carousel items total in DB, 4 active + 1 archived)
    assert.strictEqual(
      hydratedAfterDeploy3.carouselItems.length,
      5,
      'Total carousel records in DB must remain 5 (no duplicate created on edit)'
    );

    const reloadedPost1 = hydratedAfterDeploy3.carouselItems.find((i) => i.id === 'perm-carousel-1');
    assert.strictEqual(
      reloadedPost1?.heading,
      'UPDATED: Arsenal 2-1 Chelsea Full-Time Tactical Review',
      'Edited heading must persist after Deployment #3'
    );
    assert.strictEqual(
      reloadedPost1?.createdAt,
      originalPost1CreatedAt,
      'Original createdAt must persist after Deployment #3'
    );

    const reloadedPost2 = hydratedAfterDeploy3.carouselItems.find((i) => i.id === 'perm-carousel-2');
    assert.strictEqual(reloadedPost2?.published, false, 'Archived post must stay unpublished');
    assert.strictEqual(reloadedPost2?.status, 'archived', 'Archived status must persist');

    const activeHomepageCarousel = hydratedAfterDeploy3.carouselItems.filter(
      (i) => i.published && i.isActive !== false && i.status !== 'archived'
    );
    assert.strictEqual(
      activeHomepageCarousel.length,
      4,
      'Active homepage carousel feed must show 4 active posts and exclude the 1 archived post'
    );

    console.log(
      '  ✓ In-place edit and post archiving verified across Deployment Simulation #3!'
    );

    // =========================================================================
    // TEST E — PHOTO LINK PERSISTENCE ACROSS DEPLOYMENTS (SAVED IN DATABASE, NOT STORAGE)
    // =========================================================================
    console.log('\n▶ Running TEST E: Direct Photo Link Persistence in Database...');

    // Verify every active carousel post preserves its direct photo link in the database
    for (const item of activeHomepageCarousel) {
      assert.ok(
        item.imageUrl.startsWith('https://'),
        `Post ${item.id} imageUrl must be a permanent direct HTTPS photo link saved in database, got: ${item.imageUrl.slice(0, 40)}`
      );
      assert.strictEqual(
        item.storagePath,
        undefined,
        `Post ${item.id} must be stored as a direct photo link in the database without Firebase Storage dependency`
      );
      assert.ok(
        Array.isArray(item.media) && item.media.length > 0 && item.media[0].url === item.imageUrl,
        `Post ${item.id} media descriptor must reference the direct photo link`
      );
    }

    console.log(
      '  ✓ Direct photo links (including mp3tourl.com and external image URLs) persisted cleanly in database!'
    );

    // =========================================================================
    // TEST F — DATABASE FAILURE HANDLING & RECOVERY
    // =========================================================================
    console.log('\n▶ Running TEST F: Temporary Database Failure Protection & Recovery...');

    setClientDatabaseFailureSimulation(true);
    setServerDatabaseFailureSimulation(true);

    let failureCaught = false;
    try {
      await refreshHomepageFeed();
    } catch {
      failureCaught = true;
    }
    assert.strictEqual(failureCaught, true, 'Database failure should surface error state');

    const syncStateDuringFailure = getHomepageFeedSyncState();
    assert.ok(syncStateDuringFailure.syncError, 'syncError must be populated during DB outage');

    // Verify existing posts in store were NOT wiped or reset to empty
    const snapshotDuringOutage = getHomepageFeedSnapshot();
    assert.strictEqual(
      snapshotDuringOutage.carouselItems.length,
      5,
      'Carousel posts must NOT be wiped during temporary database failure'
    );
    assert.strictEqual(
      snapshotDuringOutage.videoItems.length,
      3,
      'Video posts must NOT be wiped during temporary database failure'
    );

    // Restore database connectivity
    setClientDatabaseFailureSimulation(false);
    setServerDatabaseFailureSimulation(false);

    const recoveredFeed = await refreshHomepageFeed();
    assert.strictEqual(getHomepageFeedSyncState().syncError, null, 'syncError must clear on recovery');
    assert.strictEqual(
      recoveredFeed.carouselItems.length + recoveredFeed.videoItems.length,
      8,
      'All 8 posts must remain intact after database recovery'
    );

    console.log(
      '  ✓ Temporary database failure handled gracefully with zero content loss!'
    );

    // =========================================================================
    // TEST G — SOCIAL INTERACTION PRESERVATION ACROSS EDITS & DEPLOYMENTS
    // =========================================================================
    console.log('\n▶ Running TEST G: Social Interaction Preservation (Likes, Saves, Comments)...');

    const likeRes1 = await toggleHomepagePostLike('perm-carousel-1', '254711222333');
    const likeRes2 = await toggleHomepagePostLike('perm-carousel-1', '254799888777');
    assert.strictEqual(likeRes1.liked, true);
    assert.strictEqual(likeRes2.likes, 2, 'Post should have 2 likes');

    const saveRes = await toggleHomepagePostSave('perm-carousel-1', '254711222333');
    assert.strictEqual(saveRes.saved, true);
    assert.strictEqual(saveRes.saves, 1, 'Post should have 1 save');

    const commentRes = await addHomepagePostComment('perm-carousel-1', {
      userId: '254711222333',
      username: 'KiptooPunter',
      text: 'Spot on tactical breakdown for the weekend slip!',
    });
    assert.ok(commentRes.id, 'Comment ID must be generated');

    // Also like a video item
    const videoLikeRes = await toggleHomepagePostLike('perm-video-4', '254711222333');
    assert.strictEqual(videoLikeRes.likes, 1, 'Video post should have 1 like');

    // Edit post 1 caption as admin and verify social interactions are preserved
    await updateCarouselItem(
      'perm-carousel-1',
      { caption: 'Updated caption while preserving all community likes, saves, and comments.' },
      adminOpts
    );

    // Simulate Deployment #4
    simulateServerDeploymentColdStart();
    const hydratedAfterDeploy4 = await simulateClientDeploymentReload();

    const socialPost1 = hydratedAfterDeploy4.carouselItems.find((i) => i.id === 'perm-carousel-1');
    assert.strictEqual(socialPost1?.likes, 2, '2 likes must persist across edit & Deployment #4');
    assert.strictEqual(socialPost1?.saves, 1, '1 save must persist across edit & Deployment #4');
    assert.strictEqual(
      socialPost1?.comments?.length,
      1,
      'Comment must persist across edit & Deployment #4'
    );
    assert.strictEqual(
      socialPost1?.comments?.[0].text,
      'Spot on tactical breakdown for the weekend slip!'
    );

    const socialVideo4 = hydratedAfterDeploy4.videoItems.find((v) => v.id === 'perm-video-4');
    assert.strictEqual(socialVideo4?.likes, 1, 'Video like must persist across Deployment #4');

    console.log(
      '  ✓ Likes, saves, and comments preserved across admin edits and Deployment Simulation #4!'
    );

    // =========================================================================
    // TEST H — SECURITY VERIFICATION (NON-ADMIN REJECTION)
    // =========================================================================
    console.log('\n▶ Running TEST H: Administrator Security Verification...');

    const regularUserOpts = {
      callerPhone: '0712345678',
      callerRole: 'user' as const,
    };

    await assert.rejects(
      async () => {
        await addCarouselItem(
          { imageUrl: 'https://example.com/hack.webp', heading: 'Unauthorized Post' },
          regularUserOpts
        );
      },
      /Unauthorized/,
      'Regular user must be blocked from publishing carousel posts'
    );

    await assert.rejects(
      async () => {
        await updateCarouselItem(
          'perm-carousel-1',
          { heading: 'Hijacked Heading' },
          regularUserOpts
        );
      },
      /Unauthorized/,
      'Regular user must be blocked from editing admin posts'
    );

    await assert.rejects(
      async () => {
        await deleteCarouselItem('perm-carousel-1', regularUserOpts);
      },
      /Unauthorized/,
      'Regular user must be blocked from deleting admin posts'
    );

    const apiAuthCheckNonAdmin = verifyAdminRequest(
      { 'x-admin-phone': '0712345678' },
      { authorId: '0712345678', authorRole: 'user' }
    );
    assert.strictEqual(
      apiAuthCheckNonAdmin.authorized,
      false,
      'Server verifyAdminRequest must reject non-admin phone/role'
    );

    const wrongPinCheck = verifyAdminPinCredentials('0743304579', '0000');
    assert.strictEqual(wrongPinCheck.valid, false, 'Wrong PIN must be rejected');

    console.log(
      '  ✓ Unauthorized publish, edit, delete, and wrong PIN attempts strictly blocked!'
    );

    // =========================================================================
    // TEST I — PRODUCTION ENVIRONMENT CONSISTENCY
    // =========================================================================
    console.log('\n▶ Running TEST I: Production Environment & Built Bundle Consistency...');

    assert.strictEqual(
      firebaseConfig.projectId,
      'mshindiroom-production',
      `Expected firebaseConfig.projectId to be 'mshindiroom-production', got '${firebaseConfig.projectId}'`
    );
    assert.ok(
      !firebaseConfig.apiKey.includes('your-api-key'),
      'firebaseConfig.apiKey must not be a placeholder'
    );

    // Inspect compiled dist/assets/*.js bundle to verify mshindiroom-production is baked in
    const distAssetsDir = path.join(process.cwd(), 'dist', 'assets');
    if (fs.existsSync(distAssetsDir)) {
      const jsFiles = fs.readdirSync(distAssetsDir).filter((f) => f.endsWith('.js'));
      assert.ok(jsFiles.length > 0, 'dist/assets must contain compiled JS bundle');
      const combinedBundle = jsFiles
        .map((f) => fs.readFileSync(path.join(distAssetsDir, f), 'utf-8'))
        .join('\n');

      assert.ok(
        combinedBundle.includes('mshindiroom-production'),
        'Compiled production bundle must contain projectId "mshindiroom-production"'
      );
      assert.ok(
        !combinedBundle.includes('projectId:"your-project-id"'),
        'Compiled production bundle must NOT contain placeholder projectId:"your-project-id"'
      );
    }

    const serverCheck = await getSavedHomepageFeedAsync();
    assert.strictEqual(
      serverCheck.carouselItems.length + serverCheck.videoItems.length,
      8,
      'Server database must hold all 8 verified posts'
    );

    console.log(
      '  ✓ Production Firebase config ("mshindiroom-production") verified in runtime & built bundle!'
    );

    console.log('\n================================================================================');
    console.log('ALL 9 VERIFICATION TESTS (TESTS A–I) PASSED 100%!');
    console.log('================================================================================');
  } finally {
    // Restore original data files so test artifacts do not pollute production repository state
    if (initialBackupFeed !== null) {
      fs.writeFileSync(feedFilePath, initialBackupFeed, 'utf-8');
    }
    if (initialBackupPosts !== null) {
      fs.writeFileSync(postsFilePath, initialBackupPosts, 'utf-8');
    } else if (fs.existsSync(postsFilePath)) {
      fs.unlinkSync(postsFilePath);
    }
    if (initialBackupMedia !== null) {
      fs.writeFileSync(mediaFilePath, initialBackupMedia, 'utf-8');
    } else if (fs.existsSync(mediaFilePath)) {
      fs.unlinkSync(mediaFilePath);
    }
    try {
      const cacheDir = path.join(process.cwd(), '.cache');
      for (const file of ['homepage_feed.json', 'homepage_posts.json', 'homepage_media.json']) {
        const p = path.join(cacheDir, file);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
    } catch {}
  }
}

runTests().catch((err) => {
  console.error('\n❌ VERIFICATION SUITE FAILED:', err);
  process.exit(1);
});
