/**
 * Shared helpers for the admin-configurable live video window.
 * A stream may only stay live for `maxLiveHours` from its `startedAt`.
 */
export const liveDeadline = (startedAt, maxLiveHours) => {
  if (!startedAt) return null;
  const start = new Date(startedAt).getTime();
  const hours = Number(maxLiveHours);
  if (!Number.isFinite(start) || !Number.isFinite(hours) || hours <= 0) return null;
  return new Date(start + hours * 3_600_000);
};

export const liveRemainingSeconds = (startedAt, maxLiveHours) => {
  const deadline = liveDeadline(startedAt, maxLiveHours);
  if (!deadline) return null;
  return Math.max(0, Math.floor((deadline.getTime() - Date.now()) / 1000));
};

export const liveWindow = (stream, limits) => {
  const maxLiveHours = Number(limits?.maxLiveHours) || 4;
  const endsAt = liveDeadline(stream?.startedAt, maxLiveHours);
  const remainingSeconds = liveRemainingSeconds(stream?.startedAt, maxLiveHours);
  return {
    maxLiveHours,
    startedAt: stream?.startedAt || null,
    endsAt,
    remainingSeconds,
    expired: remainingSeconds !== null && remainingSeconds <= 0,
  };
};

export default { liveDeadline, liveRemainingSeconds, liveWindow };
