'use strict';
// Public photo listing + consent-triggered camera sharing.
// GITHUB_TOKEN (Contents read/write for this repo) MUST stay in Vercel env.
// This is a public endpoint, NOT an authenticated upload service: configure
// Vercel Firewall rate limits before sharing widely.

const REPO = process.env.GITHUB_REPOSITORY || 'hlounhh/20-10';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const ROOT = 'photos/';
const MAX_BYTES = 2_350_000;
const MAX_BODY = 3_250_000;

// Timestamp filenames (to the second) in Vietnam local time.
// GitHub refuses to overwrite an existing file when no sha is provided.
function photoSecondName(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    }).formatToParts(date);
    const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
    return p.year + '-' + p.month + '-' + p.day + '_' +
        p.hour + '-' + p.minute + '-' + p.second;
}
function photoSortKey(path) {
    const name = path.split('/').pop();
    // Both the new second-precision names and the earlier minute-only names.
    // Treat minute-only files as :00 so old gallery order stays chronological.
    const modern = /^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})(?:-(\d{2}))?\./.exec(name);
    if (modern) return Number(modern.slice(1, 6).join('') + (modern[6] || '00'));
    // Historical files: photos/YYYY/MM/YYYYMMDDHHmmss-random.jpg
    const legacy = /^(20\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(name);
    return legacy ? Number(legacy.slice(1, 7).join('')) : 0;
}


function send(res, status, value) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(JSON.stringify(value));
}
function validateConfig() {
    if (!/^[\w.-]+\/[\w.-]+$/.test(REPO) || !/^[a-zA-Z0-9._/-]+$/.test(BRANCH)) {
        throw new Error('Invalid repository configuration');
    }
    return REPO.split('/');
}
function rawUrl(path, version = BRANCH) {
    const [owner, repo] = validateConfig();
    return 'https://raw.githubusercontent.com/' +
        [owner, repo, version, ...path.split('/')].map(encodeURIComponent).join('/');
}
function allowedOrigin(req) {
    // Browser cross-origin POSTs are blocked; this is NOT an authentication
    // mechanism and scripted clients may forge these headers.
    const origin = req.headers.origin;
    if (typeof origin !== 'string') return false;
    try {
        const requestOrigin = new URL(origin);
        const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim().toLowerCase();
        const local = /^localhost(?::\d+)?$|^127\.0\.0\.1(?::\d+)?$/.test(host);
        return requestOrigin.host.toLowerCase() === host &&
            (requestOrigin.protocol === 'https:' || (local && requestOrigin.protocol === 'http:'));
    } catch {
        return false;
    }
}
function parseImage(dataUrl) {
    if (typeof dataUrl !== 'string' || dataUrl.length > MAX_BODY) return null;
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([a-zA-Z0-9+/]+={0,2})$/.exec(dataUrl);
    if (!match) return null;
    const bytes = Buffer.from(match[2], 'base64');
    if (!bytes.length || bytes.length > MAX_BYTES) return null;
    const header = bytes.subarray(0, 12);
    const jpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    const png = header.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const webp = header.toString('ascii',0,4) === 'RIFF' && header.toString('ascii',8,12) === 'WEBP';
    const valid = match[1] === 'image/jpeg' ? jpeg : match[1] === 'image/png' ? png : webp;
    if (!valid) return null;
    return { bytes, ext: match[1] === 'image/jpeg' ? 'jpg' : match[1] === 'image/png' ? 'png' : 'webp' };
}
async function readBody(req) {
    if (req.body != null) {
        if (typeof req.body === 'object') return req.body;
        if (typeof req.body === 'string' && req.body.length > MAX_BODY + 500) throw new Error('Body too large');
        return JSON.parse(req.body);
    }
    let body = '';
    for await (const chunk of req) {
        body += chunk.toString();
        if (body.length > MAX_BODY + 500) throw new Error('Body too large');
    }
    return JSON.parse(body);
}
async function github(url, options = {}) {
    const token = process.env.GITHUB_TOKEN;
    const response = await fetch('https://api.github.com/repos/' + REPO + '/' + url, {
        ...options,
        headers: {
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': '20-10-photo-gallery',
            ...(token ? { Authorization: 'Bearer ' + token } : {}),
            ...(options.headers || {})
        },
        signal: AbortSignal.timeout(14000)
    });
    let data = {};
    try { data = await response.json(); } catch {}
    if (!response.ok) {
        const err = new Error('GitHub returned ' + response.status);
        err.status = response.status;
        throw err;
    }
    return data;
}
// If two visitors send in exactly the same second, retry under the next
// second's date-time name. No counters/random text and never overwrite photos.
async function uploadWithTimestamp(image) {
    const MAX_ATTEMPTS = 3;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const path = ROOT + photoSecondName() + '.' + image.ext;
        try {
            const saved = await github('contents/' + path, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: 'photos: add shared 20-10 camera image',
                    content: image.bytes.toString('base64'),
                    branch: BRANCH
                })
            });
            return { path, saved };
        } catch (error) {
            // GitHub may return 422 for a preexisting path and 409 for a
            // concurrent branch update. Retry with another second.
            if (![409, 422].includes(error.status) || attempt === MAX_ATTEMPTS - 1) throw error;
            const untilNextSecond = 1000 - (Date.now() % 1000) + 35;
            await new Promise(resolve => setTimeout(resolve, untilNextSecond));
        }
    }
}

module.exports = async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        res.setHeader('Allow', 'GET, POST, OPTIONS');
        res.statusCode = 204;
        return res.end();
    }
    if (req.method !== 'GET' && req.method !== 'POST') {
        res.setHeader('Allow', 'GET, POST, OPTIONS');
        return send(res, 405, { error: 'Phương thức không được hỗ trợ.' });
    }
    try {
        validateConfig();
        if (req.method === 'GET') {
            const data = await github('git/trees/' + encodeURIComponent(BRANCH) + '?recursive=1');
            if (data.truncated) return send(res, 503, { error: 'Danh sách ảnh vượt giới hạn GitHub.' });
            const images = (data.tree || [])
                .filter(item => item.type === 'blob' && item.path.startsWith(ROOT) &&
                    /\.(jpg|jpeg|png|webp)$/i.test(item.path))
                .sort((a, b) => photoSortKey(a.path) - photoSortKey(b.path) ||
                    a.path.localeCompare(b.path))
                .slice(-400)
                .map(item => ({ id: item.path, url: rawUrl(item.path) + '?v=' + encodeURIComponent(item.sha) }));
            res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=5');
            return send(res, 200, { images });
        }
        res.setHeader('Cache-Control', 'no-store');
        if (!allowedOrigin(req)) return send(res, 403, { error: 'Yêu cầu chia sẻ không hợp lệ.' });
        if (!process.env.GITHUB_TOKEN) {
            return send(res, 503, { error: 'Chưa cấu hình GITHUB_TOKEN trên Vercel.' });
        }
        if (String(req.headers['content-type'] || '').split(';')[0] !== 'application/json') {
            return send(res, 415, { error: 'Ảnh phải gửi ở dạng JSON.' });
        }
        const length = Number(req.headers['content-length'] || 0);
        if (length > MAX_BODY + 500) return send(res, 413, { error: 'Ảnh quá lớn.' });
        let body;
        try { body = await readBody(req); }
        catch { return send(res, 400, { error: 'Dữ liệu ảnh không hợp lệ.' }); }
        const image = parseImage(body?.dataUrl);
        if (!image) {
            return send(res, 400, { error: 'Chỉ hỗ trợ JPG, PNG, WebP dưới 2,35 MB.' });
        }

        const { path, saved } = await uploadWithTimestamp(image);
        const commit = saved.commit?.sha || BRANCH;
        return send(res, 201, { path, url: rawUrl(path, commit) });
    } catch (error) {
        console.error('Photo API error:', error.message);
        if (error.status === 409 || error.status === 422) {
            return send(res, 409, {
                error: 'Ảnh được gửi cùng lúc với ảnh khác. Vui lòng thử lại sau vài giây.'
            });
        }
        if (error.status === 401 || error.status === 403) {
            return send(res, 502, { error: 'GitHub từ chối token hoặc quyền lưu ảnh.' });
        }
        return send(res, 502, { error: 'Không thể xử lý ảnh. Vui lòng thử lại sau.' });
    }
};
