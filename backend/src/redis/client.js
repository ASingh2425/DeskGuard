import Redis from 'ioredis';
import { config } from '../config.js';

const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
});

redis.on('error', (err) => console.error('Redis error:', err));

export default redis;

/**
 * Redis Key Design for Timer Management
 *
 * session:{sessionId}:state          HASH  - cached session state (status, deskId, userId)
 * session:{sessionId}:away_expires   STRING with TTL - away countdown deadline (epoch ms)
 * session:{sessionId}:liveness_due   STRING with TTL - next liveness check deadline
 * session:{sessionId}:liveness_grace STRING with TTL - grace window after liveness prompt
 * desk:{deskId}:lock                 STRING with TTL - distributed lock for desk operations
 * sweep:lock                         STRING with TTL - idempotent sweep worker lock
 * user:{userId}:active_session       STRING - maps user to active session ID
 */

export const RedisKeys = {
  sessionState: (id) => `session:${id}:state`,
  awayExpires: (id) => `session:${id}:away_expires`,
  livenessDue: (id) => `session:${id}:liveness_due`,
  livenessGrace: (id) => `session:${id}:liveness_grace`,
  deskLock: (deskId) => `desk:${deskId}:lock`,
  sweepLock: () => 'sweep:lock',
  userActiveSession: (userId) => `user:${userId}:active_session`,
};

export async function acquireLock(key, ttlSeconds = 30) {
  const token = `${Date.now()}-${Math.random()}`;
  const result = await redis.set(key, token, 'EX', ttlSeconds, 'NX');
  return result === 'OK' ? token : null;
}

export async function releaseLock(key, token) {
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    end
    return 0
  `;
  await redis.eval(script, 1, key, token);
}

export async function setSessionState(sessionId, state) {
  const key = RedisKeys.sessionState(sessionId);
  await redis.hset(key, state);
  await redis.expire(key, 86400 * 7);
}

export async function getSessionState(sessionId) {
  return redis.hgetall(RedisKeys.sessionState(sessionId));
}

export async function setAwayTimer(sessionId, expiresAt) {
  const ttl = Math.ceil((expiresAt - Date.now()) / 1000);
  if (ttl <= 0) {
    await redis.del(RedisKeys.awayExpires(sessionId));
    return;
  }
  await redis.set(RedisKeys.awayExpires(sessionId), String(expiresAt), 'EX', ttl);
}

export async function clearAwayTimer(sessionId) {
  await redis.del(RedisKeys.awayExpires(sessionId));
}

export async function setLivenessDue(sessionId, dueAt) {
  const ttl = Math.ceil((dueAt - Date.now()) / 1000);
  if (ttl <= 0) {
    await redis.del(RedisKeys.livenessDue(sessionId));
    return;
  }
  await redis.set(RedisKeys.livenessDue(sessionId), String(dueAt), 'EX', ttl);
}

export async function setLivenessGrace(sessionId, expiresAt) {
  if (!expiresAt) {
    await redis.del(RedisKeys.livenessGrace(sessionId));
    return;
  }
  const ttl = Math.ceil((expiresAt - Date.now()) / 1000);
  if (ttl <= 0) {
    await redis.del(RedisKeys.livenessGrace(sessionId));
    return;
  }
  await redis.set(RedisKeys.livenessGrace(sessionId), String(expiresAt), 'EX', ttl);
}

export async function clearLivenessGrace(sessionId) {
  await redis.del(RedisKeys.livenessGrace(sessionId));
}

export async function clearSessionTimers(sessionId) {
  const keys = [
    RedisKeys.sessionState(sessionId),
    RedisKeys.awayExpires(sessionId),
    RedisKeys.livenessDue(sessionId),
    RedisKeys.livenessGrace(sessionId),
  ];
  await redis.del(...keys);
}

export async function setUserActiveSession(userId, sessionId) {
  if (sessionId) {
    await redis.set(RedisKeys.userActiveSession(userId), sessionId);
  } else {
    await redis.del(RedisKeys.userActiveSession(userId));
  }
}

export async function getUserActiveSession(userId) {
  return redis.get(RedisKeys.userActiveSession(userId));
}
