import { captureManually, startCamera } from './handTracking.js';
import { closeShare, saveImg } from './share.js';
import { initializeCard } from './card.js';

document.getElementById('btn').addEventListener('click', captureManually);
document.getElementById('sbtn-no').addEventListener('click', closeShare);
document.getElementById('sbtn-yes').addEventListener('click', saveImg);

initializeCard();
startCamera();
