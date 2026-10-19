import { v, c, ctx, badge, loader, ldtxt, scene, mShare } from './elements.js';
import { capture } from './capture.js';
import { evaluateHeartPose, createHoldState, resetHold, stepHold } from './heartGesture.js';
import { countdownAt } from './photoCountdown.js';

const hold = createHoldState();
const countdown = document.getElementById('pose-countdown');
const countNumber = document.getElementById('pose-countdown-number');
const countMessage = document.getElementById('pose-countdown-message');
const manualButton = document.getElementById('btn');
const messages = {
    5: 'Tạo dáng xinh lên nàooo! 💗',
    4: 'Bỏ tay xuống, pose nào! ✨',
    3: 'Cười thật tươi nha! 🌸',
    2: 'Nhìn vào camera nhé! 💕',
    1: 'Cheeseeee! 📸'
};

let startedAt = performance.now();
let firstFrame = true, hands, cam;
let disarmed = false, releaseSince = 0;
let countdownTimer = null;
let countdownStart = 0;
let shownSecond = null;
const RELEASE_MS = 300, HOLD_MS = 600;

function overlayOpen() {
    return scene.classList.contains('show') || mShare.classList.contains('show');
}
function cameraReady() {
    return v.readyState >= 2 && v.videoWidth > 0 && v.videoHeight > 0 &&
        !v.paused && !(v.srcObject && [...v.srcObject.getVideoTracks()].every(t => t.readyState === 'ended'));
}
function resize() { c.width = window.innerWidth; c.height = window.innerHeight; }
function resetBadge(message) {
    badge.textContent = message;
    badge.classList.remove('on');
}
function hideCountdown() {
    countdown.hidden = true;
    countdown.classList.remove('active');
    manualButton.disabled = false;
    shownSecond = null;
}
function stopTimer() {
    if (countdownTimer !== null) clearInterval(countdownTimer);
    countdownTimer = null;
    hideCountdown();
}
function cancelCountdown(message = 'Tạo trái tim để thử lại ♡') {
    if (countdownTimer === null) return;
    stopTimer();
    resetHold(hold);
    disarmed = true; // require gesture to be released before accepting a new one
    releaseSince = 0;
    resetBadge(message);
}
function renderCountdown(second) {
    if (shownSecond === second) return;
    shownSecond = second;
    countNumber.textContent = String(second);
    countMessage.textContent = messages[second];
    countNumber.classList.remove('tick');
    // Restart the light number-pulse only when the displayed second changes.
    void countNumber.offsetWidth;
    countNumber.classList.add('tick');
}
function updateCountdown() {
    if (countdownTimer === null) return;
    if (document.hidden || overlayOpen() || !cameraReady()) {
        cancelCountdown('Đã hủy chụp — thử lại nhé ♡');
        return;
    }
    const state = countdownAt(countdownStart, performance.now());
    if (!state.finished) {
        renderCountdown(state.remaining);
        return;
    }

    // Mark the countdown over BEFORE calling capture, preventing a second shot.
    stopTimer();
    resetHold(hold);
    try {
        capture(); // frame taken NOW, not when the heart was detected
        resetBadge('♡ Đã chụp!');
    } catch (error) {
        console.error('Photo capture failed', error);
        resetBadge('Chụp ảnh bị lỗi, thử lại nhé');
    }
}
function beginCountdown() {
    if (disarmed || countdownTimer !== null || overlayOpen() ||
        document.hidden || !cameraReady()) return false;
    disarmed = true; // latch immediately: only one timer may ever be scheduled
    releaseSince = 0;
    resetHold(hold);
    ctx.clearRect(0, 0, c.width, c.height);
    resetBadge('♡ Đã nhận diện!');
    manualButton.disabled = true;
    countdownStart = performance.now();
    countdown.hidden = false;
    countdown.classList.add('active');
    renderCountdown(5);
    countdownTimer = setInterval(updateCountdown, 80);
    return true;
}

// Both gesture detection and manual shutter get a 5-second pose countdown.
export function captureManually() { beginCountdown(); }

function onResults(results) {
    if (firstFrame) {
        firstFrame = false;
        const seconds = ((performance.now() - startedAt) / 1000).toFixed(1);
        loader.classList.add('hide');
        setTimeout(() => { loader.style.display = 'none'; }, 900);
        ldtxt.textContent = 'Sẵn sàng sau ' + seconds + 's 🌸';
    }
    if (countdownTimer !== null || overlayOpen()) {
        ctx.clearRect(0, 0, c.width, c.height);
        resetHold(hold);
        return;
    }
    ctx.clearRect(0, 0, c.width, c.height);
    const landmarks = results.multiHandLandmarks || [];
    for (const hand of landmarks) {
        drawConnectors(ctx, hand, HAND_CONNECTIONS, {
            color: 'rgba(255,179,193,.5)', lineWidth: 1.5
        });
        drawLandmarks(ctx, hand, {
            color: 'rgba(255,77,109,.85)', lineWidth: 1, radius: 3
        });
    }

    const now = performance.now();
    const twoHands = landmarks.length === 2;
    const aspect = v.videoWidth && v.videoHeight ?
        v.videoWidth / v.videoHeight : 16 / 9;
    const result = evaluateHeartPose(landmarks, aspect);

    if (disarmed) {
        if (!result.matched) {
            if (!releaseSince) releaseSince = now;
            if (now - releaseSince >= RELEASE_MS) disarmed = false;
        } else {
            releaseSince = 0;
        }
        if (disarmed) {
            resetHold(hold);
            resetBadge('♡ Thả tay để chụp lần nữa');
            return;
        }
    }

    const progress = stepHold(hold, result.matched, twoHands, now, HOLD_MS);
    if (!twoHands) {
        resetBadge('Giơ hai tay để tạo trái tim ♡');
    } else if (result.matched) {
        badge.textContent = '♡ ' + Math.round(progress.progress * 100) + '%';
        badge.classList.add('on');
        if (progress.ready) beginCountdown();
    } else {
        resetBadge(result.hint);
    }
}

export function startCamera() {
    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) cancelCountdown('Đã hủy chụp — thử lại nhé ♡');
    });
    v.addEventListener('pause', () => cancelCountdown('Camera đã tạm dừng'));
    v.addEventListener('ended', () => cancelCountdown('Camera đã ngắt'));
    hands = new Hands({
        locateFile: file => 'https://unpkg.com/@mediapipe/hands@0.4.1646424915/' + file
    });
    hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.5
    });
    hands.onResults(onResults);
    cam = new Camera(v, {
        onFrame: async () => {
            if (document.hidden || countdownTimer !== null ||
                overlayOpen() || v.readyState < 2) return;
            await hands.send({ image: v });
        },
        width: 1280, height: 720, facingMode: 'user'
    });
    cam.start().then(() => {
        for (const track of v.srcObject?.getVideoTracks?.() || []) {
            track.addEventListener('ended', () => cancelCountdown('Camera đã ngắt'));
        }
    }).catch(error => {
        cancelCountdown('Không thể mở camera');
        ldtxt.textContent = 'Lỗi camera: ' + error.message;
    });
}
