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
let columns = 8;
let minSlots = 0;
let viewingId = null;
let touchStart = null;
let resizeFrame = 0;
let refreshInFlight = false;
let queuedList = null;
let pointerActive = false;
let scrolling = false;
let settleTimer = 0;

// Fit BOTH axes. CSS distributes the viewport between complete columns/rows;
// a small aspect-ratio adjustment keeps tiles as close to square as practical.
function chooseGrid(width, height, gap, inset, preferred) {
    let best = null;
    const maxRows = Math.min(18, Math.floor((height - 2 * inset + gap) / (72 + gap)));
    const maxColumns = Math.min(24, Math.floor((width - 2 * inset + gap) / (72 + gap)));

    for (let r = 1; r <= maxRows; r++) {
        const tileHeight = (height - 2 * inset - (r - 1) * gap) / r;
        for (let c = 1; c <= maxColumns; c++) {
            const tileWidth = (width - 2 * inset - (c - 1) * gap) / c;
            if (tileWidth < 72 || tileHeight < 72) continue;
            const aspectError = Math.abs(Math.log(tileWidth / tileHeight));
            const sizeError = Math.abs(Math.log(Math.sqrt(tileWidth * tileHeight) / preferred));
            const score = 2.3 * aspectError + .75 * sizeError +
                (r === 1 && height > 330 ? .1 : 0);
            if (!best || score < best.score) best = { rows: r, columns: c, score };
        }
    }
    return best || { rows: 1, columns: 1 };
}

// CSS grid-auto-columns may return an unresolved calc(...) in some browsers.
// Measuring an actual tile avoids NaN and preserves scroll when photos are added.
function columnStep() {
    const first = track.querySelector('.tile');
    const style = getComputedStyle(track);
    const gap = parseFloat(style.columnGap) || 0;
    if (first) return first.getBoundingClientRect().width + gap;
    const inset = parseFloat(style.paddingLeft) || 0;
    return (track.clientWidth - 2 * inset - (columns - 1) * gap) / columns + gap;
}

function layout() {
    const bounds = track.getBoundingClientRect();
    const width = bounds.width;
    const height = bounds.height;
    if (width <= 0 || height <= 0) return;

    const style = getComputedStyle(track);
    const gap = parseFloat(style.columnGap) || 0;
    const inset = parseFloat(style.paddingLeft) || 0;
    const preferred = width <= 630 ? 118 : width < 1000 ? 142 : 156;
    const grid = chooseGrid(width, height, gap, inset, preferred);

    if (grid.rows === rows && grid.columns === columns &&
        track.style.getPropertyValue('--rows')) return;

    // Anchor the first visible image on rotation and mobile browser-bar resize.
    const previousStep = columnStep();
    const previousLeft = track.scrollLeft;
    const firstIndex = previousStep > 0
        ? Math.floor(previousLeft / previousStep) * rows : 0;
    const anchorId = previousLeft > 2 ? images[firstIndex]?.id : null;
    const anchorOffset = previousStep > 0 ? previousLeft % previousStep : 0;

    rows = grid.rows;
    columns = grid.columns;
    minSlots = rows * columns;
    track.style.setProperty('--rows', String(rows));
    track.style.setProperty('--columns', String(columns));
    syncPlaceholders();

    if (anchorId) {
        const index = images.findIndex(photo => photo.id === anchorId);
        if (index >= 0) {
            track.scrollLeft = Math.floor(index / rows) * columnStep() + anchorOffset;
        }
    }
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
    const step = columnStep();
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

function requestLayout() {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => { resizeFrame = 0; layout(); });
}
window.addEventListener('resize', requestLayout, { passive: true });
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', requestLayout, { passive: true });
}
if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(requestLayout);
    observer.observe(track);
}

document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh();
});

layout();
refresh();
// One small GET every 10 seconds while the tab is visible; no full-page reload.
setInterval(refresh, REFRESH_MS);
