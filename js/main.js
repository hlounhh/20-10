// Remove any legacy camera gallery shortcut left by stale HTML/templates.
// Only the consent-based share flow can navigate to the photo gallery.
document.querySelectorAll('.camera-gallery-link, #wrap a[href="./gallery.html"]').forEach(link => link.remove());

import { captureManually, startCamera } from './handTracking.js?v=pose-countdown-16';
import { closeShare, saveImg } from './share.js';
import { initializeCard } from './card.js';

document.getElementById('btn').addEventListener('click', captureManually);
document.getElementById('sbtn-no').addEventListener('click', closeShare);
document.getElementById('sbtn-yes').addEventListener('click', saveImg);

initializeCard();
startCamera();
