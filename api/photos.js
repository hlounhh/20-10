'use strict';
// First-party GitHub Contents storage for a small PUBLIC photo gallery.
// Requires GITHUB_TOKEN (fine-grained Contents: read/write) and GALLERY_UPLOAD_KEY
// as Vercel server-side environment variables; neither is shipped to the client.
const crypto = require('node:crypto');

const REPO = process.env.GITHUB_REPOSITORY || 'hlounhh/20-10';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const ROOT = 'photos/';
const MAX_BYTES = 2_350_000;
const MAX_BODY_CHARS = 3_250_000;
const ACCEPTED = new Set(['image/jpeg','image/png','image/webp']);

function send(res, status, data) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(JSON.stringify(data));
}
function safeRepo() {
    if (!/^[\w.-]+\/[\w.-]+$/.test(REPO) || !/^[a-zA-Z0-9._/-]+$/.test(BRANCH)) {
        throw new Error('Invalid repository configuration');
    }
    return REPO.split('/');
}
function urlFor(path, version = BRANCH) {
    const [owner, repo] = safeRepo();
    return 'https://raw.githubusercontent.com/' + [owner, repo, version, ...path.split('/')].map(encodeURIComponent).join('/');
}
async function github(path, opts = {}) {
    const token = process.env.GITHUB_TOKEN;
    const response = await fetch('https://api.github.com/repos/' + REPO + '/' + path, {
        ...opts,
        headers: {
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': '20-10-photo-gallery',
            ...(token ? { Authorization: 'Bearer ' + token } : {}),
            ...(opts.headers || {})
        },
        signal: AbortSignal.timeout(14000)
    });
    let data;
    try { data = await response.json(); } catch { data = {}; }
    if (!response.ok) {
        const error = new Error('GitHub returned ' + response.status);
        error.status = response.status;
        throw error;
    }
    return data;
}
function constantTimeEqual(input, expected) {
    const a = crypto.createHash('sha256').update(input).digest();
    const b = crypto.createHash('sha256').update(expected).digest();
    return crypto.timingSafeEqual(a, b);
}
function decodeImage(dataUrl) {
    if (typeof dataUrl !== 'string' || dataUrl.length > MAX_BODY_CHARS) return null;
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([a-zA-Z0-9+/]+={0,2})$/.exec(dataUrl);
    if (!match || !ACCEPTED.has(match[1])) return null;
    const bytes = Buffer.from(match[2], 'base64');
    if (!bytes.length || bytes.length > MAX_BYTES) return null;
    const header = bytes.subarray(0, 12);
    const jpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    const png = header.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const webp = header.toString('ascii',0,4) === 'RIFF' && header.toString('ascii',8,12) === 'WEBP';
    const verified = match[1] === 'image/jpeg' ? jpeg : match[1] === 'image/png' ? png : webp;
    return verified ? { bytes, ext: match[1] === 'image/jpeg' ? 'jpg' : match[1] === 'image/png' ? 'png' : 'webp' } : null;
}
async function readBody(req) {
    if (req.body != null) {
        if (typeof req.body === 'object') return req.body;
        return JSON.parse(req.body);
    }
    let content = '';
    for await (const chunk of req) {
        content += chunk.toString();
        if (content.length > MAX_BODY_CHARS + 1000) throw new Error('Payload too large');
    }
    return JSON.parse(content);
}
module.exports = async function handler(req, res) {
    if (req.method === 'OPTIONS') { res.setHeader('Allow','GET, POST, OPTIONS'); return send(res, 204, {}); }
    if (req.method !== 'GET' && req.method !== 'POST') { res.setHeader('Allow','GET, POST'); return send(res,405,{error:'Phương thức không được hỗ trợ.'}); }
    try {
        safeRepo();
        if (req.method === 'GET') {
            // A Git tree provides the file listing without per-directory API calls.
            const data = await github('git/trees/' + encodeURIComponent(BRANCH) + '?recursive=1');
            if (data.truncated) return send(res,503,{error:'Kho ảnh đã vượt giới hạn danh sách GitHub.'});
            const images = (data.tree || [])
                .filter(item => item.type === 'blob' && item.path.startsWith(ROOT) && /\.(jpg|jpeg|png|webp)$/i.test(item.path))
                .sort((a,b) => b.path.localeCompare(a.path))
                .slice(0, 400)
                .map(item => ({ id:item.path, url:urlFor(item.path) + '?v=' + item.sha }));
            res.setHeader('Cache-Control','public, s-maxage=12, stale-while-revalidate=45');
            return send(res,200,{ images });
        }
        if (!process.env.GITHUB_TOKEN || !process.env.GALLERY_UPLOAD_KEY) {
            return send(res,503,{error:'Máy chủ chưa được cấu hình GitHub token và mã tải ảnh.'});
        }
        const contentType = String(req.headers['content-type'] || '').split(';')[0];
        if (contentType !== 'application/json') return send(res,415,{error:'Yêu cầu phải ở dạng JSON.'});
        const length = Number(req.headers['content-length'] || 0);
        if (length > MAX_BODY_CHARS + 1000) return send(res,413,{error:'Ảnh quá lớn.'});
        const password = req.headers['x-upload-key'];
        if (typeof password !== 'string' || !constantTimeEqual(password, process.env.GALLERY_UPLOAD_KEY)) {
            return send(res,401,{error:'Mã tải ảnh không đúng.'});
        }
        let body;
        try { body = await readBody(req); } catch { return send(res,400,{error:'Dữ liệu ảnh không hợp lệ.'}); }
        const image = decodeImage(body && body.dataUrl);
        if (!image) return send(res,400,{error:'Chỉ chấp nhận JPG, PNG, WebP có dung lượng dưới 2,35 MB.'});
        const stamp = new Date().toISOString();
        const month = stamp.slice(0,7).replace('-', '/');
        const file = stamp.replace(/[-:TZ.]/g,'') + '-' + crypto.randomBytes(6).toString('hex') + '.' + image.ext;
        const path = ROOT + month + '/' + file;
        const result = await github('contents/' + path, {
            method:'PUT',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({message:'photos: add a new 20-10 gallery image',content:image.bytes.toString('base64'),branch:BRANCH})
        });
        const commitSha = result.commit && result.commit.sha;
        res.setHeader('Cache-Control','no-store');
        return send(res,201,{ path, url:urlFor(path,commitSha || BRANCH) });
    } catch(error) {
        console.error('Photo gallery error:', error.message);
        if (error.status === 401 || error.status === 403) return send(res,502,{error:'GitHub từ chối quyền truy cập hoặc giới hạn API.'});
        return send(res,502,{error:'Không thể kết nối đến kho ảnh GitHub. Thử lại sau.'});
    }
};
