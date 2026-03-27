import { connect, connection } from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

async function syncPurchasedSessions(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/school-mgmt';

  console.log('Connecting to MongoDB...');
  await connect(mongoUri);
  console.log('Connected to MongoDB');

  const students = connection.collection('students');
  const invoices = connection.collection('invoices');

  console.log('Resetting totalPurchasedSessions for all students...');
  const resetResult = await students.updateMany({}, { $set: { totalPurchasedSessions: 0 } });
  console.log(`Reset ${resetResult.modifiedCount} student records`);

  console.log('Aggregating purchased sessions from APPROVED/PAID tuition invoices...');
  const aggregates = await invoices.aggregate<{
    _id: unknown;
    totalPurchasedSessions: number;
    invoiceCount: number;
  }>([
    {
      $match: {
        invoiceType: 'TUITION',
        status: { $in: ['APPROVED', 'PAID'] },
      },
    },
    {
      $project: {
        studentId: 1,
        purchasedSessions: {
          $add: [
            { $ifNull: ['$sessions', 0] },
            { $ifNull: ['$bonusSessions', 0] },
          ],
        },
      },
    },
    {
      $group: {
        _id: '$studentId',
        totalPurchasedSessions: { $sum: '$purchasedSessions' },
        invoiceCount: { $sum: 1 },
      },
    },
  ]).toArray();

  if (!aggregates.length) {
    console.log('No APPROVED/PAID tuition invoices found. Migration completed.');
    return;
  }

  const operations = aggregates.map((item) => ({
    updateOne: {
      filter: { _id: item._id },
      update: {
        $set: {
          totalPurchasedSessions: Math.max(0, Number(item.totalPurchasedSessions || 0)),
        },
      },
    },
  }));

  const bulkResult = await students.bulkWrite(operations, { ordered: false });

  console.log(`Updated ${bulkResult.modifiedCount} students from ${aggregates.length} aggregated invoice groups`);
  console.log('Purchased sessions sync completed successfully');
}

syncPurchasedSessions()
  .catch((error) => {
    console.error('Purchased sessions sync failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await connection.close();
  });