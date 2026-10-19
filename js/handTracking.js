import { v, c, ctx, badge, loader, ldtxt } from './elements.js';
import { capture } from './capture.js';

// MediaPipe globals (Hands, Camera, drawConnectors, etc.) are loaded by index.html.
let t0 = performance.now(), firstFrame = true, cooldown = false;
let holdStart = 0, holdNeeded = 500, hands, cam;

function resize() { c.width = window.innerWidth; c.height = window.innerHeight }
resize(); window.addEventListener('resize', resize);
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y) }

function onResults(r) {
    if (firstFrame) {
        firstFrame = false;
        let ms = ((performance.now() - t0) / 1000).toFixed(1);
        loader.classList.add('hide');
        setTimeout(() => loader.style.display = 'none', 900);
        ldtxt.textContent = 'Sẵn sàng sau ' + ms + 's 🌸';
    }
    ctx.clearRect(0, 0, c.width, c.height);
    let ml = r.multiHandLandmarks;
    if (!ml || ml.length < 2) { badge.textContent = 'giơ cả hai tay lên'; badge.classList.remove('on'); return }
    ml.forEach(lm => {
        drawConnectors(ctx, lm, HAND_CONNECTIONS, { color: 'rgba(255,179,193,.5)', lineWidth: 1.5 });
        drawLandmarks(ctx, lm, { color: 'rgba(255,77,109,.85)', lineWidth: 1, radius: 3 });
    });
    let a = ml[0], b = ml[1];
    let dT = dist(a[4], b[4]), dI = dist(a[8], b[8]);
    let dC1 = dist(a[4], b[8]), dC2 = dist(a[8], b[4]);
    let det = dT < 0.10 && dI < 0.10 && dC1 > 0.05 && dC2 > 0.05;
    let now = performance.now();
    if (det) {
        if (!holdStart) holdStart = now;
        let pct = Math.min((now - holdStart) / holdNeeded, 1);
        badge.textContent = pct < 1 ? `♡ ${Math.round(pct * 100)}%` : '♡ chụp!';
        badge.classList.add('on');
        if (pct >= 1 && !cooldown) { cooldown = true; holdStart = 0; capture(); setTimeout(() => cooldown = false, 3000) }
    } else {
        holdStart = 0;
        badge.textContent = dT < 0.10 ? 'khép ngón trỏ lại' : dI < 0.10 ? 'khép ngón cái lại' : 'ghép 2 tay thành hình ♡';
        badge.classList.remove('on');
    }
}

export function startCamera() {
    resize();
    window.addEventListener('resize', resize);
    hands = new Hands({ locateFile: f => `https://unpkg.com/@mediapipe/hands@0.4.1646424915/${f}` });
    hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.7, minTrackingConfidence: 0.5 });
    hands.onResults(onResults);
    cam = new Camera(v, { onFrame: async () => await hands.send({ image: v }), width: 1280, height: 720, facingMode: 'user' });
    cam.start().catch(e => { ldtxt.textContent = 'Lỗi camera: ' + e.message });
}
