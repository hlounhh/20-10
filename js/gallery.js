import { fetchPhotos } from './photos.js';

const $ = id => document.getElementById(id);
const track = $('track');
const viewer = $('viewer');
const stage = $('viewerStage');
const fullImage = $('fullImage');
let images = [];
let viewing = 0;
let touchStart = null;
let rows = 4;
let resizeFrame = 0;

// Keep tiles square, but calculate enough rows to fill the current viewport.
// Only recalculate on viewport resizing, never during horizontal swipes.
function layout() {
    const mobile = window.innerWidth <= 630;
    const gap = mobile ? 8 : 10;
    const top = mobile ? 8 : 11;
    const bottom = top;
    const ideal = mobile ? 118 : 148;
    const h = track.clientHeight;
    const w = track.clientWidth;
    rows = Math.max(1, Math.floor((h - top - bottom + gap) / (ideal + gap)));
    const size = (h - top - bottom - (rows - 1) * gap) / rows;
    const columns = Math.max(1, Math.ceil((w - 2 + gap) / (size + gap)));
    track.style.setProperty('--rows', String(rows));
    render(rows * columns);
}

function showImage(index) {
    if (!images.length) return;
    viewing = (index + images.length) % images.length;
    const image = images[viewing];
    fullImage.src = image.url;
    $('originalLink').href = image.url;
    $('viewerIndex').textContent = (viewing + 1) + ' / ' + images.length;
    for (const i of [viewing - 1, viewing + 1]) {
        if (images[i]) {
            const preload = new Image();
            preload.src = images[i].url;
        }
    }
}

function render(minSlots = rows) {
    const previousScroll = track.scrollLeft;
    const fragment = document.createDocumentFragment();

    images.forEach((entry, index) => {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'tile photo';
        cell.setAttribute('aria-label', 'Xem ảnh ' + (index + 1));
        const img = document.createElement('img');
        img.alt = 'Khoảnh khắc ' + (index + 1);
        img.loading = index < 12 ? 'eager' : 'lazy';
        img.decoding = 'async';
        img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
        img.addEventListener('error', () => { cell.title = 'Không tải được ảnh'; }, { once: true });
        img.src = entry.url;
        cell.append(img);
        cell.addEventListener('click', () => openViewer(index));
        fragment.append(cell);
    });

    for (let i = images.length; i < minSlots; i++) {
        const placeholder = document.createElement('div');
        placeholder.className = 'tile placeholder';
        placeholder.setAttribute('aria-hidden', 'true');
        fragment.append(placeholder);
    }
    track.replaceChildren(fragment);
    track.scrollLeft = previousScroll;
}

function openViewer(index) {
    showImage(index);
    if (!viewer.open) viewer.showModal();
}

async function refresh() {
    try {
        images = await fetchPhotos();
        layout();
        $('message').textContent = images.length
          ? images.length + ' ảnh trong thư viện.'
          : 'Thư viện chưa có ảnh. Chủ repo có thể thêm ảnh trong thư mục photos.';
    } catch (error) {
        layout();
        $('message').textContent = 'Không tải được ảnh: ' + error.message;
    }
}

$('closeViewer').addEventListener('click', () => viewer.close());
$('viewerPrev').addEventListener('click', () => showImage(viewing - 1));
$('viewerNext').addEventListener('click', () => showImage(viewing + 1));
viewer.addEventListener('click', e => { if (e.target === viewer) viewer.close(); });
viewer.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); showImage(viewing - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); showImage(viewing + 1); }
});
stage.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') touchStart = { x: e.clientX, y: e.clientY };
}, { passive: true });
stage.addEventListener('pointerup', e => {
    if (!touchStart) return;
    const dx = e.clientX - touchStart.x;
    const dy = e.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)) showImage(viewing + (dx < 0 ? 1 : -1));
}, { passive: true });
stage.addEventListener('pointercancel', () => { touchStart = null; });

window.addEventListener('resize', () => {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
        resizeFrame = 0;
        layout();
    });
}, { passive: true });

layout();
refresh();
