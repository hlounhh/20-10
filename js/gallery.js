import { fetchPhotos } from './photos.js';
import { gridSlot, gridColumnForIndex, firstIndexInColumn } from './galleryOrder.js';

const $ = id => document.getElementById(id);
const track = $('track');
const viewer = $('viewer');
const viewerRail = $('viewerRail');

const REFRESH_MS = 10000;
const SETTLE_MS = 220;
let images = [];
let tiles = new Map();
let placeholders = [];
let rows = 4;
let columns = 8;
let minSlots = 0;
let layoutWidth = 0;
let layoutHeight = 0;
let viewingId = null;
let viewerCards = new Map();
let viewerNodes = [];
let activeViewerIndex = -1;
let viewerScrollFrame = 0;
let viewerDrag = null;
let viewerPointerDown = false;
let viewerNeedsSync = false;
let viewerSyncTimer = 0;
let viewerIgnoreClickUntil = 0;
let gridMouseDrag = null;
let gridIgnoreClickUntil = 0;
let resizeFrame = 0;
let refreshInFlight = false;
let queuedList = null;
let pointerActive = false;
let scrolling = false;
let settleTimer = 0;

// The grid always has complete columns across the usable width and full-height
// rows. Avoid CSS calc() divisions: older iOS Safari can fall back to auto widths,
// causing very narrow, tall photo tiles with a blank right half of the screen.
function chooseGrid(usableWidth, usableHeight, gap, preferred) {
    let best = null;
    const minTile = 72;
    const maxRows = Math.min(18, Math.floor((usableHeight + gap) / (minTile + gap)));
    const maxColumns = Math.min(24, Math.floor((usableWidth + gap) / (minTile + gap)));

    for (let r = 1; r <= maxRows; r++) {
        const tileHeight = (usableHeight - (r - 1) * gap) / r;
        for (let c = 1; c <= maxColumns; c++) {
            const tileWidth = (usableWidth - (c - 1) * gap) / c;
            if (tileWidth < minTile || tileHeight < minTile) continue;
            const aspectError = Math.abs(Math.log(tileWidth / tileHeight));
            const sizeError = Math.abs(Math.log(Math.sqrt(tileWidth * tileHeight) / preferred));
            const score = 2.3 * aspectError + .75 * sizeError +
                (r === 1 && usableHeight > 310 ? .1 : 0);
            if (!best || score < best.score) {
                best = { rows: r, columns: c, tileWidth, score };
            }
        }
    }
    return best || { rows: 1, columns: 1, tileWidth: Math.max(1, usableWidth) };
}

function columnStep() {
    const css = getComputedStyle(track);
    const gap = parseFloat(css.columnGap) || 0;
    const width = parseFloat(track.style.getPropertyValue('--tile-width')) || 120;
    return width + gap;
}

function layout() {
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const css = getComputedStyle(track);
    const gap = parseFloat(css.columnGap) || 0;
    const padLeft = parseFloat(css.paddingLeft) || 0;
    const padRight = parseFloat(css.paddingRight) || 0;
    const padTop = parseFloat(css.paddingTop) || 0;
    const padBottom = parseFloat(css.paddingBottom) || 0;
    const usableWidth = Math.max(1, rect.width - padLeft - padRight);
    const usableHeight = Math.max(1, rect.height - padTop - padBottom);
    const preferred = rect.width <= 630 ? 118 : rect.width < 1000 ? 142 : 156;
    const grid = chooseGrid(usableWidth, usableHeight, gap, preferred);

    // Browser chrome can resize 100dvh without changing row/column counts.
    // The pixel track width must still update on *every* actual resize.
    if (grid.rows === rows && grid.columns === columns &&
        Math.abs(rect.width - layoutWidth) < .25 &&
        Math.abs(rect.height - layoutHeight) < .25 &&
        track.style.getPropertyValue('--tile-width')) return;

    const oldStep = columnStep();
    const oldLeft = track.scrollLeft;
    const firstColumn = oldStep > 0 ? Math.floor(oldLeft / oldStep) : 0;
    const anchorId = oldLeft > 2 ?
        images[firstIndexInColumn(firstColumn, rows, columns)]?.id : null;
    const anchorOffset = oldStep > 0 ? oldLeft - firstColumn * oldStep : 0;

    rows = grid.rows;
    columns = grid.columns;
    minSlots = rows * columns;
    layoutWidth = rect.width;
    layoutHeight = rect.height;
    track.style.setProperty('--rows', String(rows));
    track.style.setProperty('--columns', String(columns));
    track.style.setProperty('--tile-width', grid.tileWidth.toFixed(4) + 'px');
    images.forEach((entry, index) => {
        const tile = tiles.get(entry.id);
        if (tile) positionTile(tile, index);
    });
    syncPlaceholders();

    if (anchorId) {
        const index = images.findIndex(photo => photo.id === anchorId);
        if (index >= 0) {
            track.scrollLeft = gridColumnForIndex(index, rows, columns) * columnStep() + anchorOffset;
        }
    }
}

// Place sequential photos horizontally, then continue with the next row.
// Once all rows in a page are filled, extend grid to the right.
function positionTile(node, index) {
    const slot = gridSlot(index, rows, columns);
    node.style.gridColumn = String(slot.column + 1);
    node.style.gridRow = String(slot.row + 1);
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
    positionTile(cell, index);
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
    placeholders.forEach((node, i) => positionTile(node, images.length + i));
}

// One real DOM card per photo: neighbouring pictures remain visible.
// Images are lazy-loaded, card nodes are reused while GitHub sync runs.
function makeViewerCard(item, index) {
    const card = document.createElement('article');
    card.className = 'viewer-card';
    card.dataset.photoId = item.id;
    card.setAttribute('role', 'group');
    const img = document.createElement('img');
    img.decoding = 'async';
    img.draggable = false;
    card.append(img);
    updateViewerCard(card, item, index);
    card.addEventListener('click', () => {
        if (performance.now() < viewerIgnoreClickUntil) return;
        viewingId = card.dataset.photoId;
        centerViewerCard(viewingId, 'smooth');
    });
    return card;
}

function updateViewerCard(card, item, index) {
    const img = card.firstElementChild;
    if (img.dataset.url !== item.url) {
        img.src = item.url;
        img.dataset.url = item.url;
    }
    img.alt = 'Ảnh ' + (index + 1);
    img.loading = item.id === viewingId || index < 3 ? 'eager' : 'lazy';
    card.setAttribute('aria-label', 'Ảnh ' + (index + 1) + ' trong ' + images.length);
}

function setViewerActive(index) {
    if (!viewerNodes.length) return;
    index = Math.max(0, Math.min(index, viewerNodes.length - 1));
    if (activeViewerIndex !== index) {
        if (viewerNodes[activeViewerIndex]) viewerNodes[activeViewerIndex].classList.remove('active');
        viewerNodes[index].classList.add('active');
        activeViewerIndex = index;
    }
    viewingId = viewerNodes[index].dataset.photoId;
}

function closestViewerIndex() {
    if (!viewerNodes.length) return -1;
    const first = viewerNodes[0];
    const step = viewerNodes.length > 1
        ? viewerNodes[1].offsetLeft - first.offsetLeft : first.offsetWidth;
    const center = viewerRail.scrollLeft + viewerRail.clientWidth / 2;
    const firstCenter = first.offsetLeft + first.offsetWidth / 2;
    if (step <= 0) return 0;
    return Math.max(0, Math.min(viewerNodes.length - 1,
        Math.round((center - firstCenter) / step)));
}

function updateViewerSelection() {
    if (viewer.open && viewerNodes.length) setViewerActive(closestViewerIndex());
}

function setViewerEdgePadding() {
    const first = viewerNodes[0];
    if (!first) return;
    // Explicit px padding avoids unsupported calc(var()/2) in older Safari.
    const pad = Math.max(12, (viewerRail.clientWidth - first.offsetWidth) / 2);
    viewerRail.style.paddingLeft = pad + 'px';
    viewerRail.style.paddingRight = pad + 'px';
}

function centerViewerCard(id, behavior = 'auto') {
    const card = viewerCards.get(id);
    if (!card || !viewer.open) return;
    if (card.firstElementChild) card.firstElementChild.loading = 'eager';
    const left = Math.max(0, card.offsetLeft -
        (viewerRail.clientWidth - card.offsetWidth) / 2);
    viewerRail.scrollTo({ left, behavior });
    if (behavior === 'auto') updateViewerSelection();
}

function syncViewerCards() {
    if (!viewer.open) return;
    if (!images.length) { viewer.close(); return; }
    const selected = viewerCards.has(viewingId) || images.some(p => p.id === viewingId)
        ? viewingId : images[0].id;
    const keep = new Set(images.map(p => p.id));
    for (const [id, card] of viewerCards) {
        if (!keep.has(id)) viewerCards.delete(id);
    }
    const fragment = document.createDocumentFragment();
    viewerNodes = images.map((item, index) => {
        let card = viewerCards.get(item.id);
        if (!card) {
            card = makeViewerCard(item, index);
            viewerCards.set(item.id, card);
        } else {
            updateViewerCard(card, item, index);
        }
        card.classList.remove('active');
        fragment.append(card);
        return card;
    });
    viewerRail.replaceChildren(fragment);
    activeViewerIndex = -1;
    const index = images.findIndex(item => item.id === selected);
    setViewerActive(Math.max(0, index));
    // Calculate padding after the viewer has its actual measured viewport.
    requestAnimationFrame(() => {
        if (!viewer.open) return;
        setViewerEdgePadding();
        centerViewerCard(viewingId);
    });
}

function openViewer(index) {
    if (!images[index]) return;
    viewingId = images[index].id;
    viewer.showModal();
    syncViewerCards();
}

function flushViewerSync() {
    if (!viewerNeedsSync || viewerPointerDown || viewerDrag) return;
    viewerNeedsSync = false;
    syncViewerCards();
}
function queueViewerSync() {
    if (!viewer.open) return;
    viewerNeedsSync = true;
    clearTimeout(viewerSyncTimer);
    viewerSyncTimer = setTimeout(flushViewerSync, 280);
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
    const anchorId = oldLeft > 2 ?
        images[firstIndexInColumn(firstColumn, rows, columns)]?.id : null;
    const offset = anchorId ? oldLeft - firstColumn * step : 0;

    const old = images;
    const added = next.length - old.length;
    const appendOnly = added > 0 && old.every((item, i) =>
        next[i].id === item.id && next[i].url === item.url);
    images = next;

    if (appendOnly) {
        // Only append new images, retaining old decoded image nodes.
        const newNodes = next.slice(old.length).map((item, index) => {
            const node = makeTile(item, old.length + index);
            tiles.set(item.id, node);
            return node;
        });
        track.append(...newNodes);
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
            track.scrollLeft = gridColumnForIndex(newIndex, rows, columns) * step + offset;
        } else {
            track.scrollLeft = oldLeft;
        }
    }

    // Keep the selected card during incremental sync, but don't interrupt a swipe.
    if (viewer.open) queueViewerSync();
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
viewer.addEventListener('click', event => {
    if (event.target === viewer) viewer.close();
});
viewer.addEventListener('close', () => {
    viewerNeedsSync = false;
    viewerPointerDown = false;
    viewerDrag = null;
    clearTimeout(viewerSyncTimer);
    viewerRail.classList.remove('is-dragging');
    viewerRail.style.removeProperty('scroll-snap-type');
    viewerRail.replaceChildren();
    viewerCards.clear();
    viewerNodes = [];
    activeViewerIndex = -1;
});

// Touch: native momentum scroll; desktop: mouse grabs the whole horizontal stack.
viewerRail.addEventListener('pointerdown', event => {
    viewerPointerDown = true;
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    viewerDrag = {
        id: event.pointerId,
        x: event.clientX,
        left: viewerRail.scrollLeft,
        moved: false
    };
    // Don't capture the pointer on mousedown: a normal click must still reach
    // the card beneath it. Capture only once a real drag has started.
});
viewerRail.addEventListener('pointermove', event => {
    if (!viewerDrag || viewerDrag.id !== event.pointerId) return;
    const dx = event.clientX - viewerDrag.x;
    if (!viewerDrag.moved && Math.abs(dx) > 5) {
        viewerDrag.moved = true;
        viewerRail.classList.add('is-dragging');
        viewerRail.style.scrollSnapType = 'none';
        viewerRail.setPointerCapture(event.pointerId);
    }
    if (viewerDrag.moved) {
        viewerRail.scrollLeft = viewerDrag.left - dx;
        event.preventDefault();
    }
});
function endViewerPointer(event) {
    viewerPointerDown = false;
    if (viewerDrag && viewerDrag.id === event.pointerId) {
        if (viewerDrag.moved) viewerIgnoreClickUntil = performance.now() + 300;
        viewerDrag = null;
        if (viewerRail.hasPointerCapture(event.pointerId)) {
            viewerRail.releasePointerCapture(event.pointerId);
        }
        viewerRail.classList.remove('is-dragging');
        viewerRail.style.removeProperty('scroll-snap-type');
        updateViewerSelection();
        if (viewingId) centerViewerCard(viewingId, 'smooth');
    }
    if (viewerNeedsSync) queueViewerSync();
}
viewerRail.addEventListener('pointerup', endViewerPointer);
viewerRail.addEventListener('pointercancel', endViewerPointer);
viewerRail.addEventListener('lostpointercapture', () => {
    if (!viewerDrag) return;
    viewerDrag = null;
    viewerPointerDown = false;
    viewerRail.classList.remove('is-dragging');
    viewerRail.style.removeProperty('scroll-snap-type');
    if (viewerNeedsSync) queueViewerSync();
});
viewerRail.addEventListener('click', event => {
    if (performance.now() < viewerIgnoreClickUntil) {
        event.preventDefault();
        event.stopPropagation();
    }
}, true);
viewerRail.addEventListener('scroll', () => {
    if (!viewerScrollFrame) {
        viewerScrollFrame = requestAnimationFrame(() => {
            viewerScrollFrame = 0;
            updateViewerSelection();
        });
    }
    if (viewerNeedsSync) queueViewerSync();
}, { passive: true });
// A mouse wheel scrolls the cards as well as a trackpad's horizontal gesture.
viewerRail.addEventListener('wheel', event => {
    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        event.preventDefault();
        viewerRail.scrollLeft += event.deltaY;
    }
}, { passive: false });
viewerRail.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = Math.max(0, closestViewerIndex());
    const next = event.key === 'Home' ? 0 :
        event.key === 'End' ? images.length - 1 :
        Math.max(0, Math.min(images.length - 1,
            index + (event.key === 'ArrowRight' ? 1 : -1)));
    setViewerActive(next);
    centerViewerCard(viewingId, 'smooth');
});
// On desktop the grid itself can also be grabbed and dragged with a mouse.
// Capture the resulting click to prevent accidentally opening a photo.
track.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    gridMouseDrag = { id: event.pointerId, x: event.clientX, left: track.scrollLeft, moved: false };
    // Delay pointer capture until the user actually drags across the grid.
});
track.addEventListener('pointermove', event => {
    if (!gridMouseDrag || gridMouseDrag.id !== event.pointerId) return;
    const dx = event.clientX - gridMouseDrag.x;
    if (!gridMouseDrag.moved && Math.abs(dx) > 6) {
        gridMouseDrag.moved = true;
        track.style.scrollSnapType = 'none';
        track.setPointerCapture(event.pointerId);
    }
    if (gridMouseDrag.moved) {
        track.scrollLeft = gridMouseDrag.left - dx;
        event.preventDefault();
    }
});
function endGridDrag(event) {
    if (!gridMouseDrag || gridMouseDrag.id !== event.pointerId) return;
    if (gridMouseDrag.moved) gridIgnoreClickUntil = performance.now() + 350;
    gridMouseDrag = null;
    if (track.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
    track.style.removeProperty('scroll-snap-type');
}
track.addEventListener('pointerup', endGridDrag);
track.addEventListener('pointercancel', endGridDrag);
track.addEventListener('lostpointercapture', () => {
    gridMouseDrag = null;
    track.style.removeProperty('scroll-snap-type');
});
track.addEventListener('click', event => {
    if (performance.now() < gridIgnoreClickUntil) {
        event.preventDefault();
        event.stopPropagation();
    }
}, true);

function requestLayout() {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
        resizeFrame = 0;
        layout();
        if (viewer.open && viewerNodes.length && !viewerPointerDown) {
            setViewerEdgePadding();
            centerViewerCard(viewingId);
        }
    });
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
