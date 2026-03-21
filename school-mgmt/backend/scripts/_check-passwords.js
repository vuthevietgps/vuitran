require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcrypt');
const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/school-mgmt';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo1234567890';

MongoClient.connect(uri).then(async c => {
  const db = c.db();
  const users = await db.collection('users').find(
    { email: { $in: ['sale.huong@school.local', 'sale.tuan@school.local', 'sale.mai@school.local'] } },
    { projection: { email: 1, password: 1, status: 1, failedLoginAttempts: 1 } }
  ).toArray();
  for (const u of users) {
    const match = await bcrypt.compare(DEMO_PASSWORD, u.password);
    console.log(`${u.email}: passwordMatch=${match} status=${u.status||'(not set)'} failed=${u.failedLoginAttempts||0}`);
  }
  await c.close();
}).catch(e => console.error(e.message));
