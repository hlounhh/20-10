import { capture } from './capture.js';
import { closeShare, saveImg } from './share.js';
import { initializeCard } from './card.js';
import { startCamera } from './handTracking.js';

// Keep DOM event registration in one place, instead of inline onclick handlers.
document.getElementById('btn').addEventListener('click', capture);
document.getElementById('sbtn-no').addEventListener('click', closeShare);
document.getElementById('sbtn-yes').addEventListener('click', saveImg);

initializeCard();
startCamera();
