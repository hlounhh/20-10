import { mShare } from './elements.js';
import { lastUrl } from './capture.js';

const saveButton = document.getElementById('sbtn-yes');
function closeShare() { mShare.classList.remove('show'); }

// Keep the camera experience useful without uploading visitor photos to GitHub.
function saveImg() {
    if (!lastUrl) { alert('Chưa có ảnh để lưu.'); return; }
    const download = document.createElement('a');
    download.href = lastUrl;
    download.download = '20-10-' + Date.now() + '.jpg';
    document.body.appendChild(download);
    download.click();
    download.remove();
    closeShare();
}
export { closeShare, saveImg };
