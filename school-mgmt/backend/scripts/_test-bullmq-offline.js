/**
 * Test: Does BullMQ Queue.add() throw when Redis is unavailable + enableOfflineQueue:false?
 * Run: node scripts/_test-bullmq-offline.js
 */
const { Queue } = require('bullmq');

async function test() {
  console.log('Testing BullMQ with enableOfflineQueue:false + Redis offline...');
  
  const q = new Queue('test-offline', {
    connection: {
      host: 'localhost',
      port: 6379,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
      connectTimeout: 2000,
      lazyConnect: true,
    },
  });

  try {
    await q.add('job', { data: 'test' });
    console.log('RESULT: add() succeeded (job was BUFFERED - no throw!)');
  } catch (err) {
    console.log(`RESULT: add() threw: ${err.message}`);
    console.log('=> Fallback would trigger correctly');
  } finally {
    await q.close().catch(() => {});
    process.exit(0);
  }
}

// Timeout safety
setTimeout(() => {
  console.log('RESULT: add() timed out (probably still connecting...)');
  process.exit(1);
}, 5000);

test().catch(e => {
  console.error('Unexpected error:', e.message);
  process.exit(1);
});
