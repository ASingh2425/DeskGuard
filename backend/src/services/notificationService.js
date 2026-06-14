import { config } from '../config.js';

const subscribers = new Map();

export function subscribe(userId, callback) {
  if (!subscribers.has(userId)) subscribers.set(userId, new Set());
  subscribers.get(userId).add(callback);
  return () => subscribers.get(userId)?.delete(callback);
}

export function notifyUser(userId, notification) {
  const subs = subscribers.get(userId);
  if (subs) {
    for (const cb of subs) cb(notification);
  }
}

export function buildNotification(type, message, data = {}) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
}

export function notifyAwayReminder(userId, minutesLeft) {
  notifyUser(userId, buildNotification(
    'away_reminder',
    `Your away timer expires in ${minutesLeft} minutes. Return to your desk!`,
    { minutesLeft }
  ));
}

export function notifyLivenessPrompt(userId, sessionId, graceMinutes) {
  notifyUser(userId, buildNotification(
    'liveness_prompt',
    `Still here? Confirm within ${graceMinutes} minutes or your desk will be freed.`,
    { sessionId, graceMinutes }
  ));
}

export function notifySessionEnded(userId, reason) {
  notifyUser(userId, buildNotification(
    'session_ended',
    `Your session has ended: ${reason}`,
    { reason }
  ));
}

export function getTimerConfig() {
  return config.timers;
}

export function notifySessionExpiring(userId, minutesLeft) {
  notifyUser(userId, buildNotification(
    'session_expiring',
    `Your desk booking expires in ${minutesLeft} minute(s). Extend now?`,
    { minutesLeft }
  ));
}

export function notifyWaitlistAvailable(userId, deskCode) {
  notifyUser(userId, buildNotification(
    'waitlist_available',
    `Desk ${deskCode} is now free! You're next in the waitlist.`,
    { deskCode }
  ));
}
