// Pure countdown timing (measured from the moment the gesture is accepted).
// No animations, device performance, or frame drops change the shutter deadline.
export const COUNTDOWN_MS = 5000;
export function countdownAt(start, now) {
    if (!Number.isFinite(start) || !Number.isFinite(now) || start > now) {
        return { remaining: 5, finished: false };
    }
    const ms = Math.max(0, COUNTDOWN_MS - (now - start));
    return { remaining: Math.ceil(ms / 1000), finished: ms === 0 };
}
