// Itens colecionáveis (estilo The Binding of Isaac): cada um dá um poder permanente no jogo.
// Aparecem na sala do tesouro, depois de matar o chefe e às vezes na lojinha.

import { nextAttackId } from './player.js';

export const RELICS = {
    chinelo:   { icon: '🩴', name: 'Chinelo Voador', desc: 'O 3º soco do combo arremessa um chinelo' },
    caramelo:  { icon: '🐕', name: 'Cachorro Caramelo', desc: 'Um vira-lata caramelo morde seus inimigos' },
    juliet:    { icon: '🕶', name: 'Óculos Juliet', desc: '20% de chance de golpe crítico (dano x2)' },
    pochete:   { icon: '👝', name: 'Pochete de Couro', desc: 'Inimigos dão 50% mais Pix' },
    caixinha:  { icon: '🔊', name: 'Caixinha de Som', desc: 'A cada 6s solta um grave que empurra todo mundo' },
    chimarrao: { icon: '🧉', name: 'Garrafa de Chimarrão', desc: 'Recupera vida devagar o tempo todo' },
    espora:    { icon: '✴', name: 'Espora de Ouro', desc: 'Pulo mais alto e chute aéreo com o dobro de dano' },
    ima:       { icon: '🧲', name: 'Ímã de Pix', desc: 'Itens e notas no chão vêm até você' },
    boneVip:   { icon: '🧢', name: 'Boné VIP', desc: 'Os bonés duram o dobro do tempo' },
};
export const RELIC_KEYS = Object.keys(RELICS);

// Fileira de itens coletados no canto de baixo
export function drawRelicIcons(ctx, relics) {
    ctx.save();
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    [...relics].forEach((id, i) => {
        const x = 14 + i * 30, y = 562;
        ctx.fillStyle = 'rgba(20,0,40,0.75)';
        ctx.fillRect(x, y, 26, 26);
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, 26, 26);
        ctx.fillStyle = '#fff';
        ctx.fillText(RELICS[id].icon, x + 13, y + 19);
    });
    ctx.restore();
}

// Cachorro caramelo: segue o Thiago e morde quem chegar perto
export class Caramelo {
    constructor(x, y) {
        Object.assign(this, { x, y, z: 0, facing: 1, biteCd: 0, run: 0 });
    }

    update(dt, game) {
        const p = game.player;
        this.biteCd = Math.max(0, this.biteCd - dt);
        let target = null, best = 300;
        for (const e of game.enemies.list) {
            if (e.hp <= 0 || e.state === 'down' || e.state === 'dead') continue;
            const d = Math.abs(e.x - this.x) + Math.abs(e.y - this.y);
            if (d < best) { best = d; target = e; }
        }
        let gx, gy, speed;
        if (target) {
            gx = target.x - Math.sign(target.x - this.x || 1) * 20; gy = target.y; speed = 270;
            if (Math.abs(target.x - this.x) < 34 && Math.abs(target.y - this.y) < 16 && this.biteCd === 0) {
                target.hurt({ id: nextAttackId(), dmg: 6, knock: 30, finisher: false, dir: this.facing }, game);
                game.ui.addHitSpark(target.x, target.y, 30);
                game.audio.playSfx('bark');
                this.biteCd = 0.9;
            }
        } else {
            gx = p.x - p.facing * 55; gy = p.y + 12; speed = 240;
        }
        const dx = gx - this.x, dy = gy - this.y;
        const moving = Math.abs(dx) > 10 || Math.abs(dy) > 6;
        if (moving) {
            this.x += Math.sign(dx) * Math.min(Math.abs(dx), speed * dt);
            this.y += Math.sign(dy) * Math.min(Math.abs(dy), speed * 0.7 * dt);
            if (Math.abs(dx) > 4) this.facing = Math.sign(dx);
            this.run += dt * 14;
        }
        this.x = Math.max(40, Math.min(984, this.x));
        this.y = Math.max(380, Math.min(575, this.y));
    }

    drawShadow(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.ellipse(this.x, this.y, 18, 5, 0, 0, Math.PI * 2); ctx.fill();
    }

    draw(ctx, time) {
        ctx.save();
        ctx.translate(Math.round(this.x), Math.round(this.y));
        ctx.scale(this.facing, 1);
        const leg = Math.sin(this.run) * 3;
        ctx.fillStyle = '#c47a2c';
        ctx.fillRect(-14 + leg, -10, 4, 10); ctx.fillRect(-6 - leg, -10, 4, 10);
        ctx.fillRect(6 + leg, -10, 4, 10); ctx.fillRect(12 - leg, -10, 4, 10);
        ctx.fillStyle = '#d98b3a';
        ctx.fillRect(-16, -22, 34, 13);                      // corpo
        ctx.fillRect(14, -32, 14, 13);                       // cabeça
        ctx.fillStyle = '#a0601e';
        ctx.fillRect(14, -36, 5, 7);                         // orelha
        ctx.fillStyle = '#111';
        ctx.fillRect(24, -29, 3, 3);                         // olho
        ctx.fillRect(27, -24, 3, 3);                         // focinho
        // Rabo abanando
        ctx.strokeStyle = '#d98b3a';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-16, -20); ctx.lineTo(-26, -30 + Math.sin(time * 18) * 5); ctx.stroke();
        ctx.restore();
    }
}
