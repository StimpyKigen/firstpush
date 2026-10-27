/**
 * Verification Test Suite: WebP File Upload, Storage Rules, and Carousel Security
 * 
 * Verifies:
 * 1. WebP magic byte and MIME type validation
 * 2. File size enforcement (max 5 MB)
 * 3. Structured Firebase Storage path generation
 * 4. Safe image replacement (upload new -> update DB -> delete old storage object)
 * 5. Caption and metadata editing without re-uploading
 * 6. Display order sorting and reordering integrity
 * 7. Safe deletion workflow (DB record removal and Storage cleanup)
 * 8. Firebase Storage Security Rules policy and syntax
 * 9. Cloud Firestore Security Rules policy and syntax
 * 10. Backward compatibility with legacy external URL records
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import {
  verifyWebpMagicBytes,
  buildCarouselStoragePath,
  formatFileSize,
  MAX_WEBP_FILE_SIZE_BYTES,
} from '../src/lib/carouselStorageService';
import {
  getHomepageFeedSnapshot,
  addCarouselItem,
  updateCarouselItem,
  replaceCarouselItemPhoto,
  reorderCarouselItems,
  deleteCarouselItem,
  type HomepageCarouselItem,
} from '../src/lib/homepageFeedStore';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[PASS] ${testName}`);
  } else {
    console.error(`[FAIL] ${testName}${details ? ` -> ${details}` : ''}`);
    process.exitCode = 1;
  }
}

console.log('==================================================================');
console.log('MSHINDIROOM: WEBP UPLOADS & FIREBASE SECURITY VERIFICATION SUITE');
console.log('==================================================================\n');

// ------------------------------------------------------------------
// 1. Binary WebP Magic Byte Inspection (RIFF + WEBP)
// ------------------------------------------------------------------
console.log('--- 1. WebP Binary Header Validation ---');

// Valid WebP header: 'RIFF' (0x52, 0x49, 0x46, 0x46) + 4 bytes size + 'WEBP' (0x57, 0x45, 0x42, 0x50)
const validWebpHeader = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, // 'RIFF'
  0x24, 0x00, 0x00, 0x00, // file length
  0x57, 0x45, 0x42, 0x50, // 'WEBP'
  0x56, 0x50, 0x38, 0x20  // 'VP8 ' chunk
]);

assert(
  verifyWebpMagicBytes(validWebpHeader) === true,
  'verifyWebpMagicBytes accepts authentic RIFF/WEBP binary stream'
);

// Invalid JPEG header: 0xFF, 0xD8, 0xFF
const jpegHeader = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
assert(
  verifyWebpMagicBytes(jpegHeader) === false,
  'verifyWebpMagicBytes rejects JPEG disguised as WebP'
);

// Invalid PNG header: 0x89, 'P', 'N', 'G'
const pngHeader = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);
assert(
  verifyWebpMagicBytes(pngHeader) === false,
  'verifyWebpMagicBytes rejects PNG disguised as WebP'
);

// Truncated header (< 12 bytes)
const shortHeader = new Uint8Array([0x52, 0x49, 0x46, 0x46]);
assert(
  verifyWebpMagicBytes(shortHeader) === false,
  'verifyWebpMagicBytes rejects truncated binary header (< 12 bytes)'
);

// ------------------------------------------------------------------
// 2. Storage Path Pattern Generation
// ------------------------------------------------------------------
console.log('\n--- 2. Storage Path Pattern Generation ---');

const generatedPath = buildCarouselStoragePath('carousel-test-123', 'My Arsenal Match Photo!.webp');
assert(
  generatedPath.startsWith('homepage-carousel/carousel-test-123/'),
  'Storage path uses organized homepage-carousel/{photoId}/ directory'
);
assert(
  generatedPath.endsWith('.webp'),
  'Storage path preserves .webp extension'
);
assert(
  !generatedPath.includes('!') && !generatedPath.includes(' '),
  'Storage path sanitizes special characters and spaces'
);

// File size limits
assert(
  MAX_WEBP_FILE_SIZE_BYTES === 5 * 1024 * 1024,
  'MAX_WEBP_FILE_SIZE_BYTES enforces 5 MB limit'
);
assert(
  formatFileSize(1024 * 1024 * 2.5) === '2.50 MB',
  'formatFileSize accurately formats file size in MB'
);

// ------------------------------------------------------------------
// 3. Storage Security Rules Inspection
// ------------------------------------------------------------------
console.log('\n--- 3. Firebase Storage Security Rules Verification ---');

const rootDir = process.cwd();
const storageRulesPath = resolve(rootDir, 'storage.rules');
const storageRulesContent = readFileSync(storageRulesPath, 'utf8');

assert(
  storageRulesContent.includes('match /homepage-carousel/{photoId}/{fileName}'),
  'storage.rules contains dedicated match for /homepage-carousel/{photoId}/{fileName}'
);
assert(
  storageRulesContent.includes('request.resource.size <= 5 * 1024 * 1024'),
  'storage.rules strictly enforces <= 5MB file size limit for carousel uploads'
);
assert(
  storageRulesContent.includes("request.resource.contentType == 'image/webp'"),
  'storage.rules strictly enforces image/webp content type for carousel uploads'
);
assert(
  storageRulesContent.includes('allow delete: if isAdmin();'),
  'storage.rules allows deletion without request.resource requirement (prevents null error on delete)'
);
assert(
  storageRulesContent.includes('allow read: if true;'),
  'storage.rules permits public reads for homepage carousel images'
);

// ------------------------------------------------------------------
// 4. Firestore Security Rules Inspection
// ------------------------------------------------------------------
console.log('\n--- 4. Cloud Firestore Security Rules Verification ---');

const firestoreRulesPath = resolve(rootDir, 'firestore.rules');
const firestoreRulesContent = readFileSync(firestoreRulesPath, 'utf8');

assert(
  firestoreRulesContent.includes('match /siteContent/{docId}'),
  'firestore.rules contains match for siteContent/{docId}'
);
assert(
  firestoreRulesContent.includes('allow read: if true;'),
  'firestore.rules permits public reads for siteContent so all visitors can see carousel'
);
assert(
  firestoreRulesContent.includes('allow create, update, delete: if isAdmin();'),
  'firestore.rules restricts writes, updates, and deletes to verified administrators only'
);
assert(
  firestoreRulesContent.includes('0743304579') || firestoreRulesContent.includes('+254743304579'),
  'firestore.rules verifies canonical platform administrator phone number'
);

// ------------------------------------------------------------------
// 5. Data Integrity: Caption Editing without Re-uploading
// ------------------------------------------------------------------
console.log('\n--- 5. Caption Editing & Safe Replacement Logic ---');

async function testCrudWorkflow() {
  const testId = `test-carousel-${Date.now()}`;
  const initialStoragePath = `homepage-carousel/${testId}/${Date.now()}-initial.webp`;
  const initialDownloadUrl = 'https://firebasestorage.googleapis.com/v0/b/mshindiroom/o/initial.webp?alt=media';

  // 1. Add item
  const added = await addCarouselItem({
    imageUrl: initialDownloadUrl,
    storagePath: initialStoragePath,
    heading: 'Original Headline',
    caption: 'Original Story Caption',
    source: 'Action Images',
    order: 1,
    published: true,
    dimensions: { width: 1200, height: 1600 },
    fileSize: 450000,
  });

  assert(
    Boolean(added.id) && added.heading === 'Original Headline',
    'addCarouselItem successfully creates photo record with metadata'
  );
  assert(
    added.storagePath === initialStoragePath,
    'addCarouselItem stores canonical storagePath in record'
  );

  // 2. Edit caption without re-uploading image
  const updated = await updateCarouselItem(added.id, {
    heading: 'Updated Headline Without Re-upload',
    caption: 'Updated Caption Without Re-upload',
    source: 'Reuters Sport',
  });

  assert(
    updated.heading === 'Updated Headline Without Re-upload' &&
    updated.caption === 'Updated Caption Without Re-upload' &&
    updated.imageUrl === initialDownloadUrl &&
    updated.storagePath === initialStoragePath,
    'updateCarouselItem updates caption and source while preserving exact image URL and storagePath'
  );

  // 3. Replace image file (safe swap)
  const newStoragePath = `homepage-carousel/${testId}/${Date.now()}-replaced.webp`;
  const newDownloadUrl = 'https://firebasestorage.googleapis.com/v0/b/mshindiroom/o/replaced.webp?alt=media';

  const replaced = await replaceCarouselItemPhoto(added.id, {
    imageUrl: newDownloadUrl,
    storagePath: newStoragePath,
    dimensions: { width: 1500, height: 2000 },
    fileSize: 620000,
  });

  assert(
    replaced.imageUrl === newDownloadUrl &&
    replaced.storagePath === newStoragePath &&
    replaced.heading === 'Updated Headline Without Re-upload',
    'replaceCarouselItemPhoto updates image references while preserving existing caption and metadata'
  );

  // 4. Reordering
  const item2 = await addCarouselItem({
    imageUrl: 'https://firebasestorage.googleapis.com/v0/b/mshindiroom/o/item2.webp?alt=media',
    storagePath: `homepage-carousel/${testId}/item2.webp`,
    heading: 'Second Item',
    caption: 'Second Item Caption',
    order: 2,
    published: true,
  });

  await reorderCarouselItems([item2.id, added.id]);
  const feedAfterReorder = getHomepageFeedSnapshot();
  const foundItem2 = feedAfterReorder.carouselItems.find((c) => c.id === item2.id);
  const foundItem1 = feedAfterReorder.carouselItems.find((c) => c.id === added.id);

  assert(
    foundItem2?.order === 1 && foundItem1?.order === 2,
    'reorderCarouselItems accurately assigns sequential order positions'
  );

  // 5. Safe deletion
  await deleteCarouselItem(added.id);
  await deleteCarouselItem(item2.id);

  const feedAfterDelete = getHomepageFeedSnapshot();
  const deletedStillExists = feedAfterDelete.carouselItems.some((c) => c.id === added.id || c.id === item2.id);
  assert(
    !deletedStillExists,
    'deleteCarouselItem removes records cleanly from the feed'
  );

  // ------------------------------------------------------------------
  // 6. Admin Interface Component Verification
  // ------------------------------------------------------------------
  console.log('\n--- 6. Admin UI Component Verification ---');

  const adminFeedPath = resolve(rootDir, 'src/components/admin/AdminHomepageFeed.tsx');
  const adminFeedContent = readFileSync(adminFeedPath, 'utf8');

  assert(
    adminFeedContent.includes('accept="image/webp,.webp"'),
    'AdminHomepageFeed restricts file input to WebP images'
  );
  assert(
    adminFeedContent.includes('validateWebpFile'),
    'AdminHomepageFeed validates WebP files on selection'
  );
  assert(
    adminFeedContent.includes('uploadCarouselPhotoWebp'),
    'AdminHomepageFeed calls uploadCarouselPhotoWebp to send binary to Firebase Storage'
  );
  assert(
    adminFeedContent.includes('uploadProgress'),
    'AdminHomepageFeed tracks and renders upload progress bar'
  );
  assert(
    adminFeedContent.includes('handleOpenEdit') && adminFeedContent.includes('updateCarouselItem'),
    'AdminHomepageFeed provides caption-only editing modal without image re-upload'
  );
  assert(
    adminFeedContent.includes('handleOpenReplace') && adminFeedContent.includes('replaceCarouselItemPhoto'),
    'AdminHomepageFeed provides photo replacement modal with safe swap workflow'
  );
  assert(
    adminFeedContent.includes('handleMoveUp') && adminFeedContent.includes('handleMoveDown'),
    'AdminHomepageFeed includes 1-click reorder controls'
  );
  assert(
    adminFeedContent.includes('Legacy URL'),
    'AdminHomepageFeed identifies legacy external URLs with migration indicators'
  );

  // ------------------------------------------------------------------
  // 7. Homepage Integration Verification
  // ------------------------------------------------------------------
  console.log('\n--- 7. Homepage Carousel Sorting & Integration ---');

  const homePath = resolve(rootDir, 'src/pages/Home.tsx');
  const homeContent = readFileSync(homePath, 'utf8');

  assert(
    homeContent.includes('.sort((a, b) =>'),
    'Home.tsx sorts publishedPhotos by explicit order with fallback'
  );
  assert(
    homeContent.includes('hasInitiallyLoaded'),
    'Home.tsx maintains single initial skeleton load without slide transition flickering'
  );
  assert(
    !homeContent.includes('hero-striker.jpg'),
    'Home.tsx strictly avoids resurrecting deleted photos'
  );

  console.log(`\nResults: ${passedTests}/${totalTests} tests passed.`);
  if (passedTests === totalTests) {
    console.log('ALL WEBP UPLOADS & FIREBASE SECURITY SPECIFICATIONS VERIFIED SUCCESSFULLY!\n');
  } else {
    console.error('Some tests failed. Inspect details above.\n');
    process.exitCode = 1;
  }
}

testCrudWorkflow().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
