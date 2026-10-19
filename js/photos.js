// Read-only: gallery auto-syncs the public GitHub photos folder while the tab is open.
export async function fetchPhotos() {
    const response = await fetch('/api/photos', {
        headers: { Accept: 'application/json' },
        cache: 'no-store'
    });
    const result = await response.json().catch(() => ({ error: 'Máy chủ không trả về JSON.' }));
    if (!response.ok) throw new Error(result.error || 'Không tải được danh sách ảnh.');
    return result.images || [];
}
