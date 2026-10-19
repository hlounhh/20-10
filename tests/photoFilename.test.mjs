// Run: node tests/photoFilename.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const raw = readFileSync(new URL('../api/photos.js', import.meta.url), 'utf8');
// Backend uses CommonJS; run helpers without starting a Vercel server.
const { photoSecondName, photoSortKey } = new Function(
    'module', 'process', raw + '; return { photoSecondName, photoSortKey };'
)({ exports: {} }, { env: {} });
assert.equal(photoSecondName(new Date('2026-10-20T12:35:42.000Z')), '2026-10-20_19-35-42');
assert.equal(photoSecondName(new Date('2026-10-20T16:59:59.000Z')), '2026-10-20_23-59-59');
assert.equal(photoSecondName(new Date('2026-10-20T17:00:00.000Z')), '2026-10-21_00-00-00');
assert(photoSortKey('photos/2026-10-20_19-35-42.jpg') >
       photoSortKey('photos/2026-10-20_19-35.jpg'));
assert(photoSortKey('photos/2026-10-20_19-35-42.jpg') <
       photoSortKey('photos/2026-10-20_19-36-00.jpg'));
assert(photoSortKey('photos/2026/10/20261020193541-abc.jpg') <
       photoSortKey('photos/2026-10-20_19-35-42.jpg'));
console.log('PASS: Vietnam seconds, midnight, chronological legacy compatibility');

const simulated = {
    filename: photoSecondName(new Date('2026-10-20T12:35:42.000Z')),
    secondFilename: photoSecondName(new Date('2026-10-20T12:35:43.000Z'))
};
assert.notEqual(simulated.filename, simulated.secondFilename);
console.log('PASS: two photos one minute but different seconds have unique names');
