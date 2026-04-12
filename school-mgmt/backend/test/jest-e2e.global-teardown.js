const mongoose = require('mongoose');

module.exports = async function globalTeardown() {
  try {
    await Promise.allSettled(
      mongoose.connections.map(async (connection) => {
        if (connection && connection.readyState !== 0) {
          await connection.close(false);
        }
      }),
    );
    await mongoose.disconnect();
  } catch (error) {
    // Best-effort cleanup only. The real test failure should remain visible.
    console.warn('[jest-e2e.global-teardown] mongoose cleanup failed:', error?.message || error);
  }
};
