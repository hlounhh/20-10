import { mShare } from './elements.js';
import { lastUrl } from './capture.js';

// No request leaves the browser until the visitor explicitly clicks "Cóooooo!".
// "Không" only closes the dialog. No password or GitHub token is exposed here.
const yesBtn = document.getElementById('sbtn-yes');
let sending = false;

function closeShare() {
    if (sending) return;
    mShare.classList.remove('show');
}

async function saveImg() {
    if (sending || !mShare.classList.contains('show')) return;
    if (!lastUrl) {
        alert('Chưa có ảnh để chia sẻ.');
        return;
    }

    sending = true;
    yesBtn.disabled = true;
    yesBtn.textContent = 'Đang gửi...';
    try {
        const response = await fetch('/api/photos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dataUrl: lastUrl }),
            cache: 'no-store'
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.path) {
            throw new Error(result.error || 'Không thể gửi ảnh. Thử lại sau.');
        }
        mShare.classList.remove('show');
        window.location.assign('./gallery.html');
    } catch (error) {
        alert('Ôi gửi ảnh bị lỗi rồi 🥺\n' + error.message);
    } finally {
        sending = false;
        yesBtn.disabled = false;
        yesBtn.textContent = 'Cóooooo!🌸';
    }
}

export { closeShare, saveImg };
