/**
 * Initialize MongoDB replica set (single-node)
 * Run ONCE after converting standalone MongoDB to replica set mode
 */
const { MongoClient } = require('mongodb');

async function initReplicaSet() {
  // Must use directConnection=true when MongoDB is not yet initialized as replica set
  const client = new MongoClient('mongodb://127.0.0.1:27017/?directConnection=true', {
    serverSelectionTimeoutMS: 5000,
  });

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const admin = client.db('admin');

    // Check current replica set status first
    try {
      const status = await admin.command({ replSetGetStatus: 1 });
      console.log('Replica set already initialized. Status:', status.set, '- myState:', status.myState);
      if (status.myState === 1) {
        console.log('Node is PRIMARY - replica set ready!');
      }
      return;
    } catch (err) {
      if (err.codeName === 'NotYetInitialized' || err.message?.includes('no replset config')) {
        console.log('Replica set not yet initialized. Running rs.initiate()...');
      } else {
        throw err;
      }
    }

    // Initialize replica set
    const result = await admin.command({
      replSetInitiate: {
        _id: 'rs0',
        members: [{ _id: 0, host: '127.0.0.1:27017' }],
      },
    });

    console.log('rs.initiate() result:', JSON.stringify(result));

    if (result.ok === 1) {
      console.log('Replica set initialization sent. Waiting for PRIMARY...');
      // Wait for node to become PRIMARY
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        try {
          const status = await admin.command({ replSetGetStatus: 1 });
          console.log(`  Attempt ${i + 1}: myState=${status.myState} (1=PRIMARY, 2=SECONDARY)`);
          if (status.myState === 1) {
            console.log('SUCCESS: Node is now PRIMARY. Replica set ready!');
            return;
          }
        } catch {
          console.log(`  Attempt ${i + 1}: waiting...`);
        }
      }
      console.log('Timeout waiting for PRIMARY state - may need more time');
    } else {
      console.error('rs.initiate() FAILED:', result);
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

initReplicaSet().catch(console.error);
