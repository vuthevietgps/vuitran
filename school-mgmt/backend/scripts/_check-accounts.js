require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/school-mgmt';
MongoClient.connect(uri).then(async c => {
  const db = c.db();
  const users = await db.collection('users').find(
    { email: { $in: ['sale.huong@school.local', 'director.demo@school.local', 'accounting.demo@school.local'] } },
    { projection: { email: 1, role: 1, isActive: 1 } }
  ).toArray();
  console.log(JSON.stringify(users, null, 2));
  await c.close();
}).catch(e => console.error(e.message));
