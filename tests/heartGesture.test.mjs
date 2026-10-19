// Run: node tests/heartGesture.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../js/heartGesture.js', import.meta.url), 'utf8');
const { evaluateHeartPose, createHoldState, stepHold } = await import(
    'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
);
const p = (x, y) => ({ x, y, z: 0 });
const L = Array.from({length:21}, () => p(.1,.5));
Object.assign(L, {0:p(.12,.62),2:p(.2,.44),4:p(.47,.76),
    5:p(.25,.22),8:p(.48,.28),9:p(.14,.34),13:p(.10,.37),17:p(.06,.44)});
const R = L.map(q => p(1-q.x,q.y));
function check(name, pair, result) {
    const response = evaluateHeartPose(pair);
    assert.equal(response.matched, result, name + ': ' + response.hint);
    console.log('PASS',name);
}
const clone = a => structuredClone(a);
check('heart geometry', [L,R], true);
check('swapped order', [R,L], true);
check('one hand near face', [L], false);
check('no hands', [], false);
{
    const a=clone(L),b=clone(R);
    a[4]=p(.48,.32);b[4]=p(.52,.32);
    check('fingertips close but shape flat', [a,b], false);
}
{
    const a=clone(L),b=clone(R);
    a[5]=p(.55,.3);b[5]=p(.45,.3);
    check('index fingers outward', [a,b], false);
}
{
    const a=clone(L),b=clone(R);
    a[4]=p(.18,.76);b[4]=p(.82,.76);
    check('thumbs outwards', [a,b], false);
}
{
    const a=clone(L),b=clone(R);
    a[4]=p(.49,.3);b[4]=p(.51,.3);
    check('pinch near face', [a,b], false);
}
{
    const a=clone(L),b=clone(R);
    for (const q of b) { q.x=.8+(q.x-.8)*.2;q.y=.4+(q.y-.4)*.2; }
    check('one hand too close to camera', [a,b], false);
}
{
    const a=clone(L),b=clone(R);
    a[8]=p(.30,.28);b[8]=p(.70,.28);
    check('tips too far apart', [a,b], false);
}
{
    const a=clone(L),b=clone(R);
    for (const q of [...a,...b]) q.x/=1.5;
    assert.equal(evaluateHeartPose([a,b],1.5).matched,true);
    console.log('PASS aspect correction');
}
{
    let state=createHoldState(),ready=false;
    for(let i=0;i<25;i++) if(stepHold(state,true,true,100+i*33).ready)ready=true;
    assert(ready);console.log('PASS stable heart capture');
    state=createHoldState();
    for(let i=0;i<5;i++) stepHold(state,true,true,100+i*33);
    assert.equal(stepHold(state,false,false,280).progress,0);
    assert.equal(stepHold(state,true,true,1400).ready,false);
    console.log('PASS one missing hand resets hold');
    state=createHoldState();
    for(let i=0;i<5;i++)stepHold(state,true,true,100+i*33);
    stepHold(state,false,true,260);stepHold(state,true,true,300);
    assert(state.elapsed>0);
    stepHold(state,false,true,350);stepHold(state,false,true,500);
    assert.equal(state.elapsed,0);
    console.log('PASS small jitter tolerated, long loss reset');
}
