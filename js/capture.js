import { v, flash, simg } from './elements.js';
import { showCard } from './card.js';

export let lastUrl = '';

function doFlash() { flash.style.opacity = 1; setTimeout(() => flash.style.opacity = 0, 150) }

function capture() {
    let sz = Math.min(v.videoWidth, v.videoHeight);
    let ox = (v.videoWidth - sz) / 2, oy = (v.videoHeight - sz) / 2;
    let sc = document.createElement('canvas');
    sc.width = sc.height = sz;
    let sx = sc.getContext('2d');
    sx.translate(sz, 0); sx.scale(-1, 1);
    sx.drawImage(v, ox, oy, sz, sz, 0, 0, sz, sz);
    lastUrl = sc.toDataURL('image/jpeg', 0.93);
    doFlash();
    simg.src = lastUrl;
    setTimeout(showCard, 220);
}

export { capture };
