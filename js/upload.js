// Shared client for the first-party Vercel /api/photos endpoint.
// Never put a GitHub token in this file. Uploads are public; guard the API at the hosting layer.
export async function uploadPhoto(dataUrl) {
    if (typeof dataUrl !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(dataUrl)) {
        throw new Error('Ảnh không hợp lệ.');
    }
    const response = await fetch('/api/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl })
    });
    let result;
    try { result = await response.json(); } catch { throw new Error('Máy chủ phản hồi không hợp lệ.'); }
    if (!response.ok) throw new Error(result.error || 'Lỗi tải ảnh (' + response.status + ').');
    return result;
}
export async function fetchPhotos() {
    const response = await fetch('/api/photos', { headers: { Accept: 'application/json' } });
    const result = await response.json().catch(() => ({ error: 'Máy chủ không trả về JSON.' }));
    if (!response.ok) throw new Error(result.error || 'Không tải được danh sách ảnh.');
    return result.images || [];
}
