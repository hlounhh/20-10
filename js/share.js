import { mShare } from './elements.js';
import { lastUrl } from './capture.js';
import { uploadPhoto } from './upload.js';

const yesBtn = document.getElementById('sbtn-yes');

function closeShare() { mShare.classList.remove('show'); }

async function saveImg() {
    if (yesBtn.disabled) return;
    yesBtn.textContent = 'Đang gửi...';
    yesBtn.disabled = true;
    try {
        if (!lastUrl) throw new Error('Chưa có ảnh để gửi.');
        await uploadPhoto(lastUrl);
        closeShare();
        window.location.assign('./gallery.html');
    } catch (error) {
        alert('Không thể gửi ảnh: ' + error.message);
    } finally {
        yesBtn.textContent = 'Cóooooo!🌸';
        yesBtn.disabled = false;
    }
}

export { closeShare, saveImg };
