// Touro mecânico: encoste pra montar. O touro sai atropelando os inimigos sozinho,
// e você só precisa se equilibrar apertando a seta que aparecer. Aguente 8 segundos!

import { nextAttackId } from './player.js';

const RIDE_TIME = 8; // a regra do rodeio
const ARROWS = { up: '⬆', down: '⬇', left: '⬅', right: '➡' };
const DIRS = Object.keys(ARROWS);

export class MechanicalBull {
    constructor(x, y) {
        Object.assign(this, { x, y, z: 0, state: 'idle', t: 0, facing: -1, vx: 0, buck: 0 });
        this.strikes = 0;
        this.prompt = null;
        this.promptCd = 0;
    }

    get visible() { return this.state !== 'gone'; }

    update(dt, game) {
        const p = game.player;
        this.t += dt;

        if (this.state === 'idle') {
            if ((p.state === 'idle' || p.state === 'walk') && Math.abs(p.x - this.x) < 44 && Math.abs(p.y - this.y) < 24) {
                this.mount(game);
            }
            return;
        }
        if (this.state === 'thrown') {
            // Sai correndo descontrolado e some
            this.x += this.facing * 500 * dt;
            this.buck = Math.abs(Math.sin(this.t * 14)) * 12;
            if (this.t > 1) this.state = 'gone';
            return;
        }
        if (this.state !== 'riding') return;

        // IA: corre atrás do inimigo mais próximo
        let target = null, best = Infinity;
        for (const e of game.enemies.list) {
            if (e.hp <= 0 || e.state === 'down' || e.state === 'dead') continue;
            const d = Math.abs(e.x - this.x) + Math.abs(e.y - this.y) * 2;
            if (d < best) { best = d; target = e; }
        }
        const tx = target ? target.x : this.x + this.facing * 200;
        const ty = target ? target.y : this.y;
        // Só vira depois de passar do alvo, pra parecer uma investida de verdade
        if (Math.sign(tx - this.x) !== this.facing && Math.abs(tx - this.x) > 70) this.facing *= -1;
        this.vx += (this.facing * 380 - this.vx) * Math.min(1, dt * 3);
        this.x += this.vx * dt;
        this.y += Math.sign(ty - this.y) * Math.min(Math.abs(ty - this.y), 130 * dt);
        const minX = game.cameraX + 50, maxX = game.cameraX + 974;
        if (this.x < minX) { this.x = minX; this.facing = 1; this.vx = 0; }
        if (this.x > maxX) { this.x = maxX; this.facing = -1; this.vx = 0; }
        this.y = Math.max(385, Math.min(565, this.y));
        this.buck = Math.abs(Math.sin(this.t * 12)) * 10;

        // Atropela quem estiver na frente
        for (const e of game.enemies.list) {
            if (e.hp <= 0 || e.state === 'down' || e.state === 'dead') continue;
            if (Math.abs(e.x - this.x) < 48 && Math.abs(e.y - this.y) < 26) {
                e.hurt({ id: nextAttackId(), dmg: 25, knock: 420, finisher: true, dir: this.facing }, game);
                game.audio.playSfx('bigHit');
                game.ui.addHitSpark(e.x, e.y, 50);
                game.live.onHit(game.ui.registerHit(), game);
                game.gainOstentacao(8);
            }
        }

        // O Thiago vai montado
        p.x = this.x;
        p.y = this.y + 0.5; // desenhado logo depois do touro
        p.facing = this.facing;
        p.rideBob = this.buck;

        // Equilíbrio: aperte a seta pedida antes do tempo acabar
        this.promptCd -= dt;
        const pressed = DIRS.find(d => game.pressed[d]);
        if (this.prompt) {
            this.prompt.left -= dt;
            if (pressed) {
                if (pressed === this.prompt.dir) {
                    this.prompt = null;
                    this.promptCd = 0.25;
                    game.audio.playSfx('good');
                    game.gainOstentacao(5);
                } else {
                    this.strike(game);
                }
            } else if (this.prompt.left <= 0) {
                this.strike(game);
            }
        } else if (this.promptCd <= 0) {
            // Fica mais rápido conforme o touro se irrita
            const time = Math.max(0.55, 1.0 - this.t * 0.05);
            this.prompt = { dir: DIRS[Math.floor(Math.random() * 4)], left: time, max: time };
        }

        if (this.state === 'riding' && this.t >= RIDE_TIME) this.dismount(game);
    }

    mount(game) {
        const p = game.player;
        this.state = 'riding';
        this.t = 0;
        this.facing = p.facing;
        this.promptCd = 0.8;
        p.setState('bull');
        p.lassoTarget = null;
        p.ropeLen = 0;
        game.ui.narrate('MONTOU NO TOURO! Aguenta 8 segundos!');
        game.audio.playSfx('moo');
        game.live.onBull(game);
    }

    strike(game) {
        this.strikes++;
        this.prompt = null;
        this.promptCd = 0.4;
        game.audio.playSfx('denied');
        game.shake = 0.2;
        if (this.strikes >= 3) this.throwOff(game);
        else game.ui.narrate(this.strikes === 1 ? 'Escorregou! Segura firme!' : 'Último aviso, peão!');
    }

    throwOff(game) {
        const p = game.player;
        this.state = 'thrown';
        this.t = 0;
        p.setState('idle');
        p.invuln = 0;
        p.hurt(5, -this.facing, game, true);
        game.ui.narrate('O touro te jogou longe!');
        game.live.say('fail');
    }

    dismount(game) {
        const p = game.player;
        this.state = 'gone';
        p.setState('jump');
        p.vz = 520;
        p.invuln = 1;
        const perfect = this.strikes === 0;
        const bonus = perfect ? 500 : 250;
        game.ui.coins += bonus;
        game.ui.pixPopup(bonus);
        game.ui.narrate(perfect ? '8 SEGUNDOS! RODEIO PERFEITO!' : 'Aguentou os 8 segundos!');
        game.audio.playSfx('victory');
        game.live.gain(perfect ? 800 : 300, game);
        game.live.say('win');
    }

    drawShadow(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, 42, 9, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    draw(ctx, time) {
        ctx.save();
        ctx.translate(Math.round(this.x), Math.round(this.y));
        const moving = this.state === 'riding' || this.state === 'thrown';
        if (moving) ctx.rotate(Math.sin(this.t * 12) * 0.12);
        ctx.scale(this.facing, 1);
        const leg = moving ? Math.sin(this.t * 22) * 6 : 0;
        const lift = -this.buck;

        // Pernas de metal
        ctx.fillStyle = '#5d6670';
        ctx.fillRect(-30 + leg, -28 + lift, 8, 28);
        ctx.fillRect(-16 - leg, -28 + lift, 8, 28);
        ctx.fillRect(14 + leg, -28 + lift, 8, 28);
        ctx.fillRect(26 - leg, -28 + lift, 8, 28);
        ctx.fillStyle = '#222';
        for (const lx of [-30, -16, 14, 26]) ctx.fillRect(lx - 1, -4, 10, 4);

        // Corpo
        ctx.fillStyle = '#4e342e';
        ctx.beginPath(); ctx.ellipse(0, -44 + lift, 42, 20, 0, 0, Math.PI * 2); ctx.fill();
        // Rebites e placa
        ctx.fillStyle = '#c0c0c0';
        for (let i = -3; i <= 3; i++) ctx.fillRect(i * 10 - 2, -56 + lift, 4, 4);
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(-14, -46 + lift, 28, 10);
        ctx.fillStyle = '#4e342e';
        ctx.font = 'bold 7px Arial';
        ctx.fillText('AGRO-3000', -13, -38 + lift);

        // Cabeça com chifres e olhos vermelhos
        ctx.fillStyle = '#3e2723';
        ctx.fillRect(34, -62 + lift, 22, 22);
        ctx.fillStyle = '#eee';
        ctx.beginPath(); ctx.moveTo(38, -62 + lift); ctx.lineTo(30, -78 + lift); ctx.lineTo(43, -62 + lift); ctx.fill();
        ctx.beginPath(); ctx.moveTo(50, -62 + lift); ctx.lineTo(60, -78 + lift); ctx.lineTo(55, -62 + lift); ctx.fill();
        ctx.fillStyle = Math.floor(time * 4) % 2 || moving ? '#ff1744' : '#7f0000';
        ctx.fillRect(48, -56 + lift, 5, 4);
        // Rabo
        ctx.strokeStyle = '#3e2723';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-40, -48 + lift); ctx.quadraticCurveTo(-56, -40 + Math.sin(time * 8) * 8, -52, -28 + lift); ctx.stroke();
        ctx.restore();

        if (this.state === 'idle') {
            const b = Math.sin(time * 4) * 4;
            ctx.textAlign = 'center';
            ctx.font = 'bold 14px Arial';
            ctx.fillStyle = '#ffd700';
            ctx.fillText('🐂 TOURO MECÂNICO', this.x, this.y - 100 + b);
            ctx.font = '12px Arial';
            ctx.fillStyle = '#fff';
            ctx.fillText('encoste pra montar', this.x, this.y - 84 + b);
            ctx.textAlign = 'left';
        }
    }

    // Seta pedida, tempo de montaria e quedas (na tela, sem câmera)
    drawHud(ctx, game, time) {
        if (this.state !== 'riding') return;
        const sx = this.x - game.cameraX, sy = this.y - 190;
        ctx.save();
        ctx.textAlign = 'center';
        if (this.prompt) {
            const f = this.prompt.left / this.prompt.max;
            ctx.fillStyle = 'rgba(0,0,0,0.75)';
            ctx.fillRect(sx - 32, sy - 32, 64, 64);
            ctx.strokeStyle = f > 0.35 ? '#32ff7e' : '#ff3366';
            ctx.lineWidth = 5;
            ctx.beginPath(); ctx.arc(sx, sy, 38, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f); ctx.stroke();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 40px Arial';
            ctx.fillText(ARROWS[this.prompt.dir], sx, sy + 14);
        }
        ctx.font = 'bold 18px Arial';
        ctx.fillStyle = '#ffd700';
        ctx.fillText(`AGUENTA! ${Math.max(0, RIDE_TIME - this.t).toFixed(1)}s`, sx, sy + 62);
        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = '#ff3366';
        ctx.fillText('✖'.repeat(this.strikes) + '○'.repeat(3 - this.strikes), sx, sy + 82);
        ctx.restore();
    }
}
