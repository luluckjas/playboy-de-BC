import { Game, VIEW_W, VIEW_H } from './game.js';
import { Audio } from './audio.js';

const canvas = document.getElementById('canvas');
canvas.width = VIEW_W;
canvas.height = VIEW_H;
const ctx = canvas.getContext('2d');

const audio = new Audio();
audio.init();

const game = new Game(canvas, ctx, audio);

function loop(timestamp) {
    game.update(timestamp);
    game.draw();
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
