import { mShare } from './elements.js';
import { lastUrl } from './capture.js';
import { uploadPhoto } from './upload.js';

const keyInput = document.getElementById('share-upload-key');
const yesBtn = document.getElementById('sbtn-yes');

function closeShare() { mShare.classList.remove('show'); }

async function saveImg() {
    const key = keyInput.value.trim();
    if (!key) {
        keyInput.focus();
        keyInput.setCustomValidity('Cần có mã tải ảnh lên.');
        keyInput.reportValidity();
        return;
    }
    keyInput.setCustomValidity('');
    yesBtn.textContent = 'Đang gửi...';
    yesBtn.disabled = true;
    try {
        if (!lastUrl) throw new Error('Chưa có ảnh để gửi.');
        await uploadPhoto(lastUrl, key);
        keyInput.value = '';
        closeShare();
        window.location.assign('./gallery.html');
    } catch (error) {
        alert('Không thể gửi ảnh: ' + error.message);
    } finally {
        yesBtn.textContent = 'Cóooooo!🌸';
        yesBtn.disabled = false;
    }
}
keyInput.addEventListener('input', () => keyInput.setCustomValidity(''));
export { closeShare, saveImg };
