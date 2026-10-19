import { fetchPhotos } from './photos.js';

const $ = id => document.getElementById(id);
const track = $('track');
const viewer = $('viewer');
const stage = $('viewerStage');
const fullImage = $('fullImage');

const REFRESH_MS = 10000;
const SETTLE_MS = 220;
let images = [];
let tiles = new Map();
let placeholders = [];
let rows = 4;
let minSlots = 0;
let viewingId = null;
let touchStart = null;
let resizeFrame = 0;
let refreshInFlight = false;
let queuedList = null;
let pointerActive = false;
let scrolling = false;
let settleTimer = 0;

// Keep tiles square and fill the viewport; calculate only on resize.
function layout() {
    const mobile = window.innerWidth <= 630;
    const gap = mobile ? 8 : 10;
    const inset = mobile ? 8 : 11;
    const ideal = mobile ? 118 : 148;
    const h = track.clientHeight;
    const w = track.clientWidth;
    rows = Math.max(1, Math.floor((h - 2 * inset + gap) / (ideal + gap)));
    const size = (h - 2 * inset - (rows - 1) * gap) / rows;
    const columns = Math.max(1, Math.ceil((w - 2 + gap) / (size + gap)));
    minSlots = rows * columns;
    track.style.setProperty('--rows', String(rows));
    syncPlaceholders();
}

function makeTile(entry, index) {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'tile photo';
    cell.dataset.photoId = entry.id;

    const img = document.createElement('img');
    img.decoding = 'async';
    cell.append(img);
    cell.addEventListener('click', () => {
        const index = images.findIndex(item => item.id === entry.id);
        if (index !== -1) openViewer(index);
    });
    updateTile(cell, entry, index);
    return cell;
}

function updateTile(cell, entry, index) {
    const img = cell.firstElementChild;
    if (img.dataset.url !== entry.url) {
        img.classList.remove('loaded');
        img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
        img.src = entry.url;
        img.dataset.url = entry.url;
    }
    img.alt = 'Khoảnh khắc ' + (index + 1);
    img.loading = index < 12 ? 'eager' : 'lazy';
    cell.setAttribute('aria-label', 'Xem ảnh ' + (index + 1));
}

function syncPlaceholders() {
    const required = Math.max(0, minSlots - images.length);
    while (placeholders.length > required) placeholders.pop().remove();
    while (placeholders.length < required) {
        const node = document.createElement('div');
        node.className = 'tile placeholder';
        node.setAttribute('aria-hidden', 'true');
        placeholders.push(node);
        track.append(node);
    }
}

function showImage(index) {
    if (!images.length) return;
    const item = images[(index + images.length) % images.length];
    viewingId = item.id;
    if (fullImage.getAttribute('src') !== item.url) fullImage.src = item.url;
    $('originalLink').href = item.url;
    $('viewerIndex').textContent = (images.indexOf(item) + 1) + ' / ' + images.length;
    for (const neighbor of [images.indexOf(item) - 1, images.indexOf(item) + 1]) {
        if (images[neighbor]) {
            const preload = new Image();
            preload.src = images[neighbor].url;
        }
    }
}

function openViewer(index) {
    showImage(index);
    if (!viewer.open) viewer.showModal();
}

function sameList(next) {
    return images.length === next.length &&
        images.every((entry, index) => entry.id === next[index].id && entry.url === next[index].url);
}

function applyPhotos(next) {
    if (sameList(next)) return;

    // Preserve the first visible column when already scrolled away from the start.
    const oldLeft = track.scrollLeft;
    const step = parseFloat(getComputedStyle(track).gridAutoColumns) +
        parseFloat(getComputedStyle(track).columnGap);
    const firstColumn = step > 0 ? Math.floor(oldLeft / step) : 0;
    const anchorId = oldLeft > 2 ? images[firstColumn * rows]?.id : null;
    const offset = anchorId ? oldLeft - firstColumn * step : 0;

    const old = images;
    const added = next.length - old.length;
    const prependOnly = added > 0 && old.every((item, i) => next[added + i].id === item.id);
    images = next;

    if (prependOnly) {
        // Only insert new nodes, leaving decoded existing images in place.
        const newNodes = next.slice(0, added).map((item, index) => {
            const node = makeTile(item, index);
            tiles.set(item.id, node);
            return node;
        });
        track.prepend(...newNodes);
        next.slice(added).forEach((item, index) => updateTile(tiles.get(item.id), item, index + added));
    } else {
        // Reuse existing DOM/image elements also for removals and reordering.
        const fragment = document.createDocumentFragment();
        const keep = new Set(next.map(item => item.id));
        for (const [id, node] of tiles) {
            if (!keep.has(id)) {
                node.remove();
                tiles.delete(id);
            }
        }
        for (const [index, item] of next.entries()) {
            let node = tiles.get(item.id);
            if (!node) {
                node = makeTile(item, index);
                tiles.set(item.id, node);
            } else {
                updateTile(node, item, index);
            }
            fragment.append(node);
        }
        // Remove placeholders before reordering; regenerate only when necessary.
        for (const node of placeholders) node.remove();
        placeholders = [];
        track.append(fragment);
    }

    syncPlaceholders();
    if (anchorId && step > 0) {
        const newIndex = images.findIndex(item => item.id === anchorId);
        if (newIndex >= 0) {
            track.scrollLeft = Math.floor(newIndex / rows) * step + offset;
        } else {
            track.scrollLeft = oldLeft;
        }
    }

    // Keep fullscreen viewer attached to its original image, not a shifting index.
    if (viewer.open && viewingId) {
        const index = images.findIndex(item => item.id === viewingId);
        if (index >= 0) showImage(index);
        else viewer.close();
    }
    $('message').textContent = images.length + ' ảnh trong thư viện, đã đồng bộ.';
}

function flushQueue() {
    if (!queuedList || scrolling || pointerActive) return;
    const next = queuedList;
    queuedList = null;
    applyPhotos(next);
}

function scheduleSettled() {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
        scrolling = false;
        flushQueue();
    }, SETTLE_MS);
}

// Passive handlers do no layout work while fingers or momentum scrolling are active.
track.addEventListener('scroll', () => {
    scrolling = true;
    scheduleSettled();
}, { passive: true });
track.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse') pointerActive = true;
}, { passive: true });
function endPointer() {
    pointerActive = false;
    scheduleSettled();
}
track.addEventListener('pointerup', endPointer, { passive: true });
track.addEventListener('pointercancel', endPointer, { passive: true });
window.addEventListener('pointerup', endPointer, { passive: true });

async function refresh() {
    if (document.hidden || refreshInFlight) return;
    refreshInFlight = true;
    try {
        const next = await fetchPhotos();
        if (!Array.isArray(next)) throw new Error('Danh sách ảnh không hợp lệ.');
        if (scrolling || pointerActive) queuedList = next;
        else {
            queuedList = null;
            applyPhotos(next);
        }
    } catch (error) {
        $('message').textContent = 'Không tải được ảnh: ' + error.message;
    } finally {
        refreshInFlight = false;
    }
}

$('closeViewer').addEventListener('click', () => viewer.close());
$('viewerPrev').addEventListener('click', () => {
    const current = images.findIndex(item => item.id === viewingId);
    if (current !== -1) showImage(current - 1);
});
$('viewerNext').addEventListener('click', () => {
    const current = images.findIndex(item => item.id === viewingId);
    if (current !== -1) showImage(current + 1);
});
viewer.addEventListener('click', e => { if (e.target === viewer) viewer.close(); });
viewer.addEventListener('keydown', e => {
    const current = images.findIndex(item => item.id === viewingId);
    if (current === -1) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); showImage(current - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); showImage(current + 1); }
});
stage.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') touchStart = { x: e.clientX, y: e.clientY };
}, { passive: true });
stage.addEventListener('pointerup', e => {
    if (!touchStart) return;
    const dx = e.clientX - touchStart.x;
    const dy = e.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)) {
        const current = images.findIndex(item => item.id === viewingId);
        if (current !== -1) showImage(current + (dx < 0 ? 1 : -1));
    }
}, { passive: true });
stage.addEventListener('pointercancel', () => { touchStart = null; });

window.addEventListener('resize', () => {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => { resizeFrame = 0; layout(); });
}, { passive: true });

document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh();
});

layout();
refresh();
// One small GET every 10 seconds while the tab is visible; no full-page reload.
setInterval(refresh, REFRESH_MS);
