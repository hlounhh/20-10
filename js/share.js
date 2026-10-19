import { mShare } from './elements.js';
import { lastUrl } from './capture.js';

function closeShare() { mShare.classList.remove('show') }

function dataURLtoBlob(dataURL) {
    var parts = dataURL.split(',');
    var mime = parts[0].match(/:(.*?);/)[1];
    var raw = atob(parts[1]);
    var arr = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return new Blob([arr], { type: mime });
}

async function saveImg() {
    var yesBtn = document.getElementById('sbtn-yes');
    yesBtn.textContent = 'Đang gửi...';
    yesBtn.disabled = true;

    try {
        var blob = dataURLtoBlob(lastUrl);
        var formData = new FormData();
        formData.append('file', blob, 'handheart-8-3-' + Date.now() + '.jpg');

        var resp = await fetch("https://hlounh.indevs.in/api.php?action=upload", {
            method: "POST",
            headers: { "x-admin-password": "2011" },
            body: formData
        });

        var result = await resp.json();
        console.log('Upload response:', result);

        if (result.error) throw new Error(result.error);

        closeShare();
        window.location.href = "https://hlounh.indevs.in/";
    } catch (err) {
        console.error('Upload failed:', err);
        alert("Ôi gửi ảnh bị lỗi rồi 🥺\n" + err.message);
        yesBtn.textContent = 'Có! 💾🌸';
        yesBtn.disabled = false;
    }
}

export { closeShare, saveImg };
