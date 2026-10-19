import { v, c, ctx, badge, loader, ldtxt, scene, mShare } from './elements.js';
import { capture } from './capture.js';
import { evaluateHeartPose, createHoldState, resetHold, stepHold } from './heartGesture.js';

const hold = createHoldState();
let startedAt = performance.now();
let firstFrame = true, hands, cam;
let disarmed = false, releaseSince = 0;
const RELEASE_MS = 300, HOLD_MS = 600;

function overlayOpen() {
    return scene.classList.contains('show') || mShare.classList.contains('show');
}
function resize() { c.width = window.innerWidth; c.height = window.innerHeight; }
function resetBadge(message) {
    badge.textContent = message;
    badge.classList.remove('on');
}
function captureOnce() {
    if (disarmed || overlayOpen()) return false;
    disarmed = true;
    releaseSince = 0;
    resetHold(hold);
    resetBadge('♡ Đã chụp!');
    capture();
    return true;
}

// Manual and automatic capture share a latch, so the image cannot be
// overwritten while the card or the sharing prompt is visible.
export function captureManually() { captureOnce(); }

function onResults(results) {
    if (firstFrame) {
        firstFrame = false;
        const seconds = ((performance.now() - startedAt) / 1000).toFixed(1);
        loader.classList.add('hide');
        setTimeout(() => { loader.style.display = 'none'; }, 900);
        ldtxt.textContent = 'Sẵn sàng sau ' + seconds + 's 🌸';
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

    // A new photo requires physically releasing the previous heart.
    if (disarmed) {
        if (!result.matched) {
            if (!releaseSince) releaseSince = now;
            if (now - releaseSince >= RELEASE_MS) disarmed = false;
        } else {
            releaseSince = 0;
        }
    }
    if (overlayOpen() || disarmed) {
        resetHold(hold);
        resetBadge('♡ Đã chụp!');
        return;
    }

    const progress = stepHold(hold, result.matched, twoHands, now, HOLD_MS);
    if (!twoHands) {
        resetBadge('Giơ hai tay để tạo trái tim ♡');
        return;
    }
    if (result.matched) {
        badge.textContent = '♡ ' + Math.round(progress.progress * 100) + '%';
        badge.classList.add('on');
        if (progress.ready) captureOnce();
    } else {
        resetBadge(result.hint);
    }
}

export function startCamera() {
    resize();
    window.addEventListener('resize', resize);
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
            if (document.hidden || v.readyState < 2) return;
            await hands.send({ image: v });
        },
        width: 1280, height: 720, facingMode: 'user'
    });
    cam.start().catch(error => {
        ldtxt.textContent = 'Lỗi camera: ' + error.message;
    });
}
