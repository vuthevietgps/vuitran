const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function updateDemoPasswords() {
  try {
    console.log('🔗 Đang kết nối MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Kết nối thành công!');

    const demoPassword = process.env.DEMO_PASSWORD || 'Demo1234567890';
    console.log(`🔑 Sử dụng mật khẩu: ${demoPassword}`);

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(demoPassword, salt);

    const demoEmails = [
      'director.demo@school.local',
      'accounting.demo@school.local',
      'ops.demo@school.local',
      'adsmanager.demo@school.local',
      'shareholder.demo@school.local',
      'teacher.demo@school.local',
      'parent.demo@school.local',
      'care.demo@school.local',
      'hcns.demo@school.local',
      'manager.demo@school.local',
      'partime.demo@school.local',
      'sale.demo@school.local'
    ];

    for (const email of demoEmails) {
      const result = await mongoose.connection.db.collection('users').updateOne(
        { email },
        { $set: { password: hashedPassword } }
      );
      
      if (result.modifiedCount > 0) {
        console.log(`✅ Đã cập nhật mật khẩu cho: ${email}`);
      } else if (result.matchedCount > 0) {
        console.log(`ℹ️  Mật khẩu đã đúng cho: ${email}`);
      } else {
        console.log(`⚠️  Không tìm thấy: ${email}`);
      }
    }

    console.log('\n🎉 Hoàn thành! Tất cả tài khoản demo đã được cập nhật.');
    console.log(`🔑 Mật khẩu cho tất cả tài khoản: ${demoPassword}`);

  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Đã ngắt kết nối MongoDB');
    process.exit(0);
  }
}

updateDemoPasswords();
