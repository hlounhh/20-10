'use strict';
// Read-only public photo listing. Photos are added to photos/ by GitHub maintainers.
const REPO = process.env.GITHUB_REPOSITORY || 'hlounhh/20-10';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const ROOT = 'photos/';

function send(res, status, data) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(JSON.stringify(data));
}

function validateConfig() {
    if (!/^[\w.-]+\/[\w.-]+$/.test(REPO) || !/^[a-zA-Z0-9._/-]+$/.test(BRANCH)) {
        throw new Error('Invalid repository configuration');
    }
    return REPO.split('/');
}

function rawUrl(path, sha) {
    const [owner, repo] = validateConfig();
    return 'https://raw.githubusercontent.com/' +
        [owner, repo, BRANCH, ...path.split('/')].map(encodeURIComponent).join('/') +
        '?v=' + encodeURIComponent(sha);
}

module.exports = async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        res.setHeader('Allow', 'GET, OPTIONS');
        res.statusCode = 204;
        return res.end();
    }
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET, OPTIONS');
        return send(res, 405, { error: 'Kho ảnh chỉ cho phép xem, không hỗ trợ upload.' });
    }
    try {
        validateConfig();
        const response = await fetch(
            'https://api.github.com/repos/' + REPO + '/git/trees/' +
                encodeURIComponent(BRANCH) + '?recursive=1',
            {
                headers: {
                    Accept: 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2022-11-28',
                    'User-Agent': '20-10-photo-gallery'
                },
                signal: AbortSignal.timeout(14000)
            }
        );
        if (!response.ok) throw new Error('GitHub returned ' + response.status);
        const data = await response.json();
        if (data.truncated) return send(res, 503, { error: 'Danh sách ảnh đã vượt giới hạn GitHub.' });
        const images = (data.tree || [])
            .filter(item => item.type === 'blob' && item.path.startsWith(ROOT) && /\.(jpg|jpeg|png|webp)$/i.test(item.path))
            .sort((a, b) => b.path.localeCompare(a.path))
            .slice(0, 400)
            .map(item => ({ id: item.path, url: rawUrl(item.path, item.sha) }));
        res.setHeader('Cache-Control', 'public, s-maxage=12, stale-while-revalidate=45');
        return send(res, 200, { images });
    } catch (error) {
        console.error('Photo listing failed:', error.message);
        return send(res, 502, { error: 'Không thể tải danh sách ảnh GitHub. Thử lại sau.' });
    }
};
