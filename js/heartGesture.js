// Pure two-hand heart geometry + hold timer. No browser dependencies.
// MediaPipe returns 21 landmarks per hand, normalized to the camera frame.
const point = (lm, idx, aspect) => ({ x: lm[idx].x * aspect, y: lm[idx].y });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const validPoint = p => p && Number.isFinite(p.x) && Number.isFinite(p.y) &&
    p.x >= -.18 && p.x <= 1.18 && p.y >= -.18 && p.y <= 1.18;

export function evaluateHeartPose(landmarks, aspect = 1) {
    if (!Array.isArray(landmarks) || landmarks.length !== 2 ||
        !Number.isFinite(aspect) || aspect < .5 || aspect > 3.5 ||
        landmarks.some(hand => !Array.isArray(hand) || hand.length < 21 ||
            [0, 2, 4, 5, 8, 9, 13, 17].some(i => !validPoint(hand[i])))) {
        return { matched: false, hint: 'Đưa đủ hai bàn tay vào khung hình' };
    }
    const hands = landmarks.map(lm => {
        const p = i => point(lm, i, aspect);
        const wrist = p(0), thumbBase = p(2), thumbTip = p(4);
        const indexBase = p(5), indexTip = p(8);
        const palm = midpoint(midpoint(wrist, p(9)), midpoint(indexBase, p(17)));
        const scale = Math.max(distance(indexBase, p(17)), distance(wrist, p(9)));
        return { wrist, thumbBase, thumbTip, indexBase, indexTip, palm, scale };
    }).sort((a, b) => a.palm.x - b.palm.x);
    const [left, right] = hands;
    const scale = (left.scale + right.scale) / 2;
    if (scale < .022 || scale > 1.25 ||
        Math.max(left.scale, right.scale) / Math.max(.001, Math.min(left.scale, right.scale)) > 2.2) {
        return { matched: false, hint: 'Đưa hai tay vào cùng khoảng cách với camera' };
    }
    const palmGap = right.palm.x - left.palm.x;
    if (palmGap < 1.10 * scale) {
        return { matched: false, hint: 'Mở rộng hai bàn tay ra hai bên' };
    }
    const indexCenter = midpoint(left.indexTip, right.indexTip);
    const thumbCenter = midpoint(left.thumbTip, right.thumbTip);
    const heartHeight = thumbCenter.y - indexCenter.y;
    const heartWidth = right.indexBase.x - left.indexBase.x;
    if (heartHeight < Math.max(.032, .70 * scale) ||
        heartWidth < .9 * scale || heartHeight / heartWidth < .25 || heartHeight / heartWidth > 2.1) {
        return { matched: false, hint: 'Đặt ngón trỏ ở trên, hai ngón cái ở dưới' };
    }
    // Index tips form the upper notch; thumb tips form the lower tip.
    const indexGap = distance(left.indexTip, right.indexTip);
    const thumbGap = distance(left.thumbTip, right.thumbTip);
    if (indexGap > Math.max(1.10 * scale, .28 * heartHeight) ||
        thumbGap > Math.max(1.10 * scale, .28 * heartHeight) ||
        Math.abs(indexCenter.x - thumbCenter.x) > Math.max(.72 * scale, .24 * heartHeight) ||
        Math.abs(left.indexTip.y - right.indexTip.y) > .90 * scale ||
        Math.abs(left.thumbTip.y - right.thumbTip.y) > .90 * scale) {
        return { matched: false, hint: 'Ghép hai ngón trỏ phía trên và hai ngón cái phía dưới' };
    }
    // Each hand must draw its own inward upper arc and inward/downward thumb.
    const leftIndexIn = left.indexTip.x - left.indexBase.x;
    const rightIndexIn = right.indexBase.x - right.indexTip.x;
    const leftThumbIn = left.thumbTip.x - left.thumbBase.x;
    const rightThumbIn = right.thumbBase.x - right.thumbTip.x;
    const thumbSlopeLeft = left.thumbTip.y - left.thumbBase.y;
    const thumbSlopeRight = right.thumbTip.y - right.thumbBase.y;
    if (Math.min(leftIndexIn, rightIndexIn) < .15 * scale ||
        Math.min(leftThumbIn, rightThumbIn) < .26 * scale ||
        Math.min(thumbSlopeLeft, thumbSlopeRight) < .14 * scale ||
        Math.min(left.thumbTip.y - left.indexTip.y,
                 right.thumbTip.y - right.indexTip.y) < .54 * scale) {
        return { matched: false, hint: 'Cong ngón trỏ tạo hai nửa trái tim, hướng ngón cái xuống' };
    }
    // Midpoints must sit between two separated palms, not beside a face/one hand.
    const margin = .13 * scale;
    if (indexCenter.x <= left.palm.x + margin || indexCenter.x >= right.palm.x - margin ||
        thumbCenter.x <= left.palm.x + margin || thumbCenter.x >= right.palm.x - margin ||
        distance(left.thumbTip, left.indexTip) < .48 * heartHeight ||
        distance(right.thumbTip, right.indexTip) < .48 * heartHeight) {
        return { matched: false, hint: 'Tạo khoảng trống ở giữa hình trái tim' };
    }
    return { matched: true, hint: 'Giữ yên hình trái tim ♡' };
}

// Only accrue time between positive inference frames. One missing hand resets
// immediately; brief landmark jitter (<90ms) pauses progress rather than
// treating lost time as a valid heart.
export function createHoldState() {
    return { elapsed: 0, frames: 0, lastGood: 0, lostAt: 0 };
}
export function resetHold(state) {
    state.elapsed = 0;
    state.frames = 0;
    state.lastGood = 0;
    state.lostAt = 0;
}
export function stepHold(state, detected, hasTwoHands, now, requiredMs = 600) {
    if (!hasTwoHands) {
        resetHold(state);
        return { progress: 0, ready: false };
    }
    if (!detected) {
        if (state.lostAt === 0) state.lostAt = now;
        if (now - state.lostAt > 90 || now - state.lastGood > 150) resetHold(state);
        return { progress: state.elapsed / requiredMs, ready: false };
    }
    if ((state.lostAt && now - state.lostAt > 90) ||
        (state.lastGood && now - state.lastGood > 150)) {
        resetHold(state);
    }
    if (state.lastGood) state.elapsed += Math.min(100, Math.max(0, now - state.lastGood));
    state.lastGood = now;
    state.lostAt = 0;
    state.frames += 1;
    return {
        progress: Math.min(1, state.elapsed / requiredMs),
        ready: state.elapsed >= requiredMs && state.frames >= 6
    };
}
