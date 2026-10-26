import { getSavedHomepageFeed, saveHomepageFeed } from '../src/lib/serverHomepageFeed';

async function run() {
  console.log('Testing serverHomepageFeed persistence...');
  const feed = getSavedHomepageFeed();
  console.log('Read count:', feed.carouselItems.length, 'carousel items, isDefault:', (feed as any)._isDefault);

  const testId = `test-persist-${Date.now()}`;
  const testItem = {
    id: testId,
    imageUrl: '/images/hero-striker.jpg',
    heading: 'Database Persistence Test Title',
    caption: 'Database Persistence Test Caption',
    published: true,
    createdAt: new Date().toISOString(),
  };

  feed.carouselItems.push(testItem);
  saveHomepageFeed(feed);

  const reloaded = getSavedHomepageFeed();
  const found = reloaded.carouselItems.find((c) => c.id === testId);
  console.log('Found saved item after reload:', found ? found.heading : 'NOT FOUND');

  if (!found) {
    throw new Error('Test item was not found in persisted storage!');
  }

  // Clean up test item
  reloaded.carouselItems = reloaded.carouselItems.filter((c) => c.id !== testId);
  saveHomepageFeed(reloaded);
  console.log('Cleaned up test item. Final count:', getSavedHomepageFeed().carouselItems.length);
  console.log('ALL PERSISTENCE TESTS PASSED SUCCESSFULLY.');
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
