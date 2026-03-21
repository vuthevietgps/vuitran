require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/school-mgmt';
MongoClient.connect(uri).then(async c => {
  const db = c.db();
  // Try to start a session and transaction
  const session = c.startSession();
  try {
    await session.withTransaction(async () => {
      const test = await db.collection('_txtest').insertOne({ test: 1 }, { session });
      await db.collection('_txtest').deleteOne({ _id: test.insertedId }, { session });
    });
    console.log('RESULT: MongoDB transactions WORK (replica set mode)');
  } catch (e) {
    console.log('RESULT: MongoDB transactions FAIL:', e.message);
    console.log('=> MongoDB is running in standalone mode (no replica set)');
    console.log('=> This is why create-lead returns 500');
  } finally {
    session.endSession();
    await c.close();
  }
}).catch(e => console.error(e.message));
