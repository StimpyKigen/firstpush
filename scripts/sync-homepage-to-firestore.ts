import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

async function run() {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  const dataPath = path.join(process.cwd(), 'data', 'homepage_feed.json');

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const feed = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  console.log(`Connecting to Firebase project: ${config.projectId}...`);
  const app = initializeApp(config);
  const db = getFirestore(app);

  const docRef = doc(db, 'siteContent', 'homepageFeed');
  console.log(`Syncing ${feed.carouselItems.length} carousel items and ${feed.videoItems.length} video items to Firestore doc siteContent/homepageFeed...`);

  try {
    await setDoc(docRef, feed, { merge: true });
    console.log('SUCCESS: Homepage feed successfully synchronized and written to Cloud Firestore!');
    
    // Read back to confirm
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      console.log(`CONFIRMED: Firestore document read back successfully with ${data.carouselItems?.length} items.`);
    }
  } catch (err: any) {
    console.error('Firestore sync error:', err?.message || err);
    if (err?.message?.includes('permission') || err?.code === 'permission-denied') {
      console.error('\nNOTE: The Firestore database is created, but rules currently deny write access.');
      console.error('Please publish the rules in firestore.rules in the Firebase Console:');
      console.error('Rules tab -> paste firestore.rules content -> Publish.');
    }
    process.exit(1);
  }
}

run();
