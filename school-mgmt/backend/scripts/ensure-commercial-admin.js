require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/school-mgmt';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@tungtran.online').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_FULLNAME = (process.env.ADMIN_FULLNAME || 'Director Admin').trim();
const ADMIN_SYNC_EXISTING = String(process.env.ADMIN_SYNC_EXISTING || 'false').toLowerCase() === 'true';
const ADMIN_USER_CODE = (process.env.ADMIN_USER_CODE || 'GD_ADMIN').trim().toUpperCase();

async function main() {
  if (!ADMIN_EMAIL) {
    throw new Error('ADMIN_EMAIL is required');
  }

  if (!ADMIN_PASSWORD) {
    throw new Error('ADMIN_PASSWORD is required');
  }

  await mongoose.connect(MONGO_URI);
  const users = mongoose.connection.db.collection('users');
  const now = new Date();
  const existing = await users.findOne({ email: ADMIN_EMAIL });

  if (!existing) {
    const password = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await users.insertOne({
      email: ADMIN_EMAIL,
      password,
      fullName: ADMIN_FULLNAME,
      role: 'DIRECTOR',
      status: 'ACTIVE',
      userCode: ADMIN_USER_CODE,
      failedLoginAttempts: 0,
      createdAt: now,
      updatedAt: now,
    });
    console.log(`Created commercial admin: ${ADMIN_EMAIL}`);
    return;
  }

  const update = {
    $set: {
      fullName: ADMIN_FULLNAME,
      role: 'DIRECTOR',
      status: 'ACTIVE',
      failedLoginAttempts: 0,
      updatedAt: now,
    },
    $unset: {
      lastFailedLoginAt: 1,
    },
  };

  if (!existing.userCode && ADMIN_USER_CODE) {
    update.$set.userCode = ADMIN_USER_CODE;
  }

  if (ADMIN_SYNC_EXISTING) {
    update.$set.password = await bcrypt.hash(ADMIN_PASSWORD, 10);
  }

  await users.updateOne({ _id: existing._id }, update);
  console.log(
    `Commercial admin already exists: ${ADMIN_EMAIL}${ADMIN_SYNC_EXISTING ? ' (password synced)' : ''}`,
  );
}

main()
  .catch(async (error) => {
    console.error('ensure-commercial-admin failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch (_) {
      // ignore disconnect failures on exit
    }
  });
