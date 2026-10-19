// Run: node tests/photoCountdown.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../js/photoCountdown.js', import.meta.url), 'utf8');
const { countdownAt, COUNTDOWN_MS } = await import(
    'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
);
assert.equal(COUNTDOWN_MS, 5000);
const start=1000;
for (const [elapsed, expected] of [[0,5],[999,5],[1000,4],[1999,4],
    [2000,3],[2999,3],[3000,2],[3999,2],[4000,1],[4999,1]]) {
    const state = countdownAt(start,start+elapsed);
    assert.equal(state.remaining, expected, 'Second at '+elapsed);
    assert.equal(state.finished,false,'Premature finish '+elapsed);
}
assert.deepEqual(countdownAt(start,start+5000),{remaining:0,finished:true});
assert.deepEqual(countdownAt(start,start+7500),{remaining:0,finished:true});
console.log('PASS countdown transitions 5→1 in 5 seconds; no early shot');
