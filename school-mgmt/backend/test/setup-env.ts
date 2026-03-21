process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-local-ci-only';
process.env.THROTTLE_LIMIT = process.env.THROTTLE_LIMIT || '100000';
process.env.THROTTLE_TTL_MS = process.env.THROTTLE_TTL_MS || '60000';
process.env.REDIS_ENABLED = process.env.REDIS_ENABLED || 'false';
