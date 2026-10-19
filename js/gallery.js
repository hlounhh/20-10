import { fetchPhotos, uploadPhoto } from './upload.js';

const $ = id => document.getElementById(id);
const track = $('track');
const add = $('add');
const uploadDialog = $('uploadDialog');
const uploadForm = $('uploadForm');
const fileInput = $('photoFiles');
const submitButton = $('uploadSubmit');
const viewer = $('viewer');
const stage = $('viewerStage');
const fullImage = $('fullImage');
let images = [];
let viewing = 0;
let touchStart = null;
let messageTimer;
let scrollScheduled = false;

function status(text, temporary = false) {
    const el = $('message');
    el.textContent = text;
    if (temporary) {
        clearTimeout(messageTimer);
        messageTimer = setTimeout(() => { el.textContent = 'Vuốt ngang để xem thêm ảnh.'; }, 3500);
    }
}
function updateArrows() {
    $('prev').disabled = track.scrollLeft < 4;
    $('next').disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
}
function showImage(index) {
    if (!images.length) return;
    viewing = (index + images.length) % images.length;
    const image = images[viewing];
    fullImage.src = image.url;
    $('originalLink').href = image.url;
    $('viewerIndex').textContent = (viewing + 1) + ' / ' + images.length;
    for (const i of [viewing - 1, viewing + 1]) {
        if (images[i]) { const preload = new Image(); preload.src = images[i].url; }
    }
}
function openViewer(index) {
    showImage(index);
    if (!viewer.open) viewer.showModal();
}
function render() {
    const previousScroll = track.scrollLeft;
    track.replaceChildren(add);
    // Keep the plus cell even for an empty album, just like the design reference.
    const fragment = document.createDocumentFragment();
    images.forEach((entry, index) => {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'tile photo';
        cell.setAttribute('aria-label', 'Xem ảnh ' + (index + 1));
        const img = document.createElement('img');
        img.alt = 'Khoảnh khắc ' + (index + 1);
        img.loading = index < 10 ? 'eager' : 'lazy';
        img.decoding = 'async';
        img.src = entry.url;
        img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
        img.addEventListener('error', () => { cell.title = 'Không tải được ảnh'; }, { once: true });
        cell.append(img);
        cell.addEventListener('click', () => openViewer(index));
        fragment.append(cell);
    });
    const placeholderCount = Math.max(0, 14 - images.length - 1);
    for (let i = 0; i < placeholderCount; i++) {
        const placeholder = document.createElement('div');
        placeholder.className = 'tile placeholder';
        placeholder.setAttribute('aria-hidden', 'true');
        fragment.append(placeholder);
    }
    track.append(fragment);
    track.scrollLeft = previousScroll;
    $('count').textContent = images.length + ' tấm ảnh';
    requestAnimationFrame(updateArrows);
}
async function refresh() {
    try {
        const photoList = await fetchPhotos();
        // Stable order prevents reshuffling after a new upload.
        // Keep recently uploaded images visible until the cached GitHub listing catches up.
        const remote = new Set(photoList.map(entry => entry.id));
        const pending = images.filter(entry => entry.optimistic && !remote.has(entry.id));
        images = [...pending, ...photoList];
        render();
        status(images.length ? 'Chạm để xem ảnh · kéo ngang để khám phá.' : 'Chạm + để bắt đầu album.');
    } catch (error) {
        render();
        status('Không tải được ảnh: ' + error.message);
    }
}
function openUpload() {
    uploadForm.reset();
    $('fileLabel').textContent = 'Chạm để chọn ảnh';
    $('uploadStatus').textContent = '';
    uploadDialog.showModal();
}
add.addEventListener('click', openUpload);
$('closeUpload').addEventListener('click', () => uploadDialog.close());
uploadDialog.addEventListener('click', e => { if (e.target === uploadDialog) uploadDialog.close(); });
fileInput.addEventListener('change', () => {
    $('fileLabel').textContent = fileInput.files.length ? fileInput.files.length + ' ảnh được chọn' : 'Chạm để chọn ảnh';
});
track.addEventListener('scroll', () => {
    if (scrollScheduled) return;
    scrollScheduled = true;
    requestAnimationFrame(() => { scrollScheduled = false; updateArrows(); });
}, { passive: true });
const step = () => {
    const css = getComputedStyle(track);
    return parseFloat(css.gridAutoColumns) + parseFloat(css.columnGap);
};
$('prev').addEventListener('click', () => track.scrollBy({ left: -step() * 2, behavior: 'smooth' }));
$('next').addEventListener('click', () => track.scrollBy({ left: step() * 2, behavior: 'smooth' }));
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

function readImage(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Không mở được ' + file.name)); };
        img.src = url;
    });
}
async function optimize(file) {
    if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) throw new Error('Chỉ hỗ trợ định dạng ảnh thông dụng.');
    if (file.size > 15 * 1024 * 1024) throw new Error('Ảnh gốc vượt quá 15 MB.');
    const img = await readImage(file);
    const maxSide = 1440;
    const ratio = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio));
    if (canvas.width * canvas.height > 4_000_000) throw new Error('Ảnh có kích thước quá lớn.');
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    let dataUrl = canvas.toDataURL('image/jpeg', .82);
    if (dataUrl.length > 3_100_000) dataUrl = canvas.toDataURL('image/jpeg', .62);
    if (dataUrl.length > 3_100_000) throw new Error('Ảnh quá lớn sau khi tối ưu.');
    canvas.width = canvas.height = 0;
    return dataUrl;
}
uploadForm.addEventListener('submit', async e => {
    e.preventDefault();
    const files = Array.from(fileInput.files);
    if (!files.length) { $('uploadStatus').textContent = 'Hãy chọn ít nhất một ảnh.'; return; }
    if (files.length > 10) { $('uploadStatus').textContent = 'Chỉ chọn tối đa 10 ảnh mỗi lần.'; return; }
    submitButton.disabled = true;
    let saved = 0;
    try {
        for (let i = 0; i < files.length; i++) {
            $('uploadStatus').textContent = 'Đang xử lý ảnh ' + (i + 1) + ' / ' + files.length + '…';
            const dataUrl = await optimize(files[i]);
            const savedPhoto = await uploadPhoto(dataUrl);
            // Add immediately: list API may be cached for a few seconds.
            images.unshift({ id: savedPhoto.path, url: savedPhoto.url, optimistic: true });
            saved++;
            render();
        }
        uploadDialog.close();
        status('Đã lưu ' + saved + ' ảnh thành công ♡', true);
        // Refresh shortly after upload so server-side canonical ordering catches up.
        setTimeout(refresh, 2000);
    } catch (error) {
        $('uploadStatus').textContent = 'Đã lưu ' + saved + '/' + files.length + '. Lỗi: ' + error.message;
    } finally {
        submitButton.disabled = false;
    }
});
refresh();
