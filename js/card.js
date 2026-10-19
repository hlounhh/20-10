import { scene, mShare } from './elements.js';

function showCard() {
    scene.classList.add('show');
    setTimeout(() => document.querySelector('.envelope').classList.add('in'), 80);
    setTimeout(() => document.querySelector('.hcard').classList.add('in'), 260);
    setTimeout(() => document.querySelector('.bouquet').classList.add('in'), 460);
    setTimeout(() => document.querySelector('.ribbon').classList.add('in'), 600);
}

function resetCard() {
    ['envelope', 'hcard', 'bouquet', 'ribbon'].forEach(cls => {
        document.querySelector('.' + cls).classList.remove('in');
    });
}

export function initializeCard() {
    scene.addEventListener('click', () => {
        scene.classList.remove('show');
        resetCard();
        setTimeout(() => mShare.classList.add('show'), 350);
    });
}

export { showCard, resetCard };
