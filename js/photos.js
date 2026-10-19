// Read-only client. Gallery images are added by the repository maintainer.
export async function fetchPhotos() {
    const response = await fetch('/api/photos', { headers: { Accept: 'application/json' } });
    const result = await response.json().catch(() => ({ error: 'Máy chủ không trả về JSON.' }));
    if (!response.ok) throw new Error(result.error || 'Không tải được danh sách ảnh.');
    return result.images || [];
}
