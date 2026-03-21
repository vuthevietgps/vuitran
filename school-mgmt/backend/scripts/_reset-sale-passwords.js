require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcrypt');
const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/school-mgmt';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo1234567890';

MongoClient.connect(uri).then(async c => {
  const db = c.db();
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const result = await db.collection('users').updateMany(
    { email: { $in: ['sale.huong@school.local', 'sale.tuan@school.local', 'sale.mai@school.local'] } },
    { $set: { password: hash, failedLoginAttempts: 0, status: 'ACTIVE' }, $unset: { lastFailedLoginAt: 1 } }
  );
  console.log(`Updated ${result.modifiedCount} sale accounts to password="${DEMO_PASSWORD}"`);
  await c.close();
}).catch(e => console.error(e.message));
