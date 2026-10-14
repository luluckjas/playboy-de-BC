// Inimigos. Cada tipo tem uma IA:
//  melee  = anda até você e soca (Cowboy do Pix, Segurança)
//  ranged = mantém distância e joga garrafa (Sertanejo Universitário)
//  charge = toma distância e dá investida (Peão de Rodeio)
//  boss   = soca de perto e usa golpes especiais (cada chefe tem os seus):
//           fan (arremessa em leque), charge (investida), slam (pulo com onda de choque),
//           rain (coisas caindo do céu) e summon (chama capangas)
import { SpriteRenderer } from './sprites.js';

const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// Valores em comum dos chefes
const boss = def => ({
    speed: 75, ai: 'boss', heavy: true, boss: true, scale: 1.6,
    range: 70, windup: 0.5, attackDur: 0.4, dmg: 15, cooldown: 1.0, shot: 'bottle', rain: 'pedra',
    ...def,
});

const TYPES = {
    cowboy: {
        hp: 30, speed: 95, reward: 50, ai: 'melee',
        range: 48, windup: 0.45, attackDur: 0.3, dmg: 8, cooldown: 1.1,
        look: { shirt: '#8b4a2b', hat: '#c8963e', jeans: '#3a4a7a', skin: '#d9a066', mustache: true },
    },
    sertanejo: {
        hp: 24, speed: 85, reward: 70, ai: 'ranged',
        keep: 260, windup: 0.5, attackDur: 0.35, dmg: 7, cooldown: 1.9,
        look: { shirt: '#ff7eb6', hat: '#f4ecd8', jeans: '#2b3a67', skin: '#e8b88a', bottle: true },
    },
    peao: {
        hp: 28, speed: 150, reward: 80, ai: 'charge',
        keep: 220, windup: 0.55, attackDur: 0.55, dmg: 12, cooldown: 1.7,
        look: { shirt: '#c0392b', vest: '#5a3418', hat: '#6b3e1f', jeans: '#34495e', skin: '#c68642', bandana: true },
    },
    seguranca: {
        hp: 90, speed: 60, reward: 150, ai: 'melee', heavy: true, scale: 1.25,
        range: 56, windup: 0.6, attackDur: 0.35, dmg: 14, cooldown: 1.4,
        look: { shirt: '#15151c', hat: null, jeans: '#15151c', skin: '#8d5524', shades: true, suit: true },
    },

    // ---- Chefes (um por andar) ----
    tiozao: boss({
        name: 'Tiozão do Pagode', hp: 220, reward: 500, moves: ['fan', 'charge'], shot: 'pandeiro',
        look: { shirt: '#ff9f1a', hat: null, jeans: '#1e88e5', skin: '#e0a87a', mustache: true, shades: true },
    }),
    guia: boss({
        name: 'Guia do Bondinho', hp: 280, reward: 550, moves: ['rain', 'summon'], rain: 'pedra',
        look: { shirt: '#2e7d32', hat: '#c8e6c9', jeans: '#5d4037', skin: '#d9a066', shades: true },
    }),
    dj: boss({
        name: 'DJ Sofrência', hp: 340, reward: 600, moves: ['slam', 'fan', 'summon'], shot: 'vinil',
        look: { shirt: '#7a2cff', hat: null, jeans: '#111111', skin: '#8d5524', shades: true },
    }),
    cobrador: boss({
        name: 'Cobrador Bravo', hp: 420, reward: 650, moves: ['charge', 'rain', 'summon'], rain: 'moeda',
        look: { shirt: '#1e5aa8', hat: '#0d47a1', jeans: '#263238', skin: '#c68642', mustache: true },
    }),
    pescador: boss({
        name: 'Pescador do Agro', hp: 500, reward: 700, moves: ['fan', 'slam', 'rain'], shot: 'peixe', rain: 'gota',
        look: { shirt: '#fdd835', hat: '#f9a825', jeans: '#37474f', skin: '#d9a066', mustache: true },
    }),
    capataz: boss({
        name: 'Capataz do Xerife', hp: 620, reward: 800, moves: ['charge', 'slam', 'fan', 'summon'], dmg: 18,
        look: { shirt: '#5a3418', vest: '#2b1a0e', hat: '#1b1b1b', jeans: '#3a2a1a', skin: '#c68642', mustache: true },
    }),
};
export const ENEMY_TYPES = TYPES;

class Enemy {
    constructor(x, y, type, mult = 1) {
        const base = TYPES[type];
        // Fases mais avançadas deixam o inimigo mais ligeiro
        const t = { ...base, speed: base.speed * mult, windup: base.windup / mult, cooldown: base.cooldown / mult };
        Object.assign(this, { x, y, z: 0, vz: 0, vx: 0, type, t });
        this.hp = t.hp; this.maxHp = t.hp;
        this.reward = t.reward;
        this.scale = t.scale || 1;
        this.facing = -1;
        this.state = 'approach'; // approach | windup | attack | hurt | pulled | stunned | down | dead
        this.stateTime = 0;
        this.cooldown = 0.5 + Math.random() * 0.8;
        this.lastHitId = -1;
        this.walkCycle = Math.random() * 6;
        this.flash = 0;
        // Cada inimigo mira num ponto diferente ao redor do jogador
        this.offsetY = t.ai === 'melee' ? (Math.random() - 0.5) * 30 : 0;
        this.moveTimer = 2.5;   // chefes: tempo até o próximo golpe especial
        this.enraged = false;
        this.removed = false;
    }

    setState(s) { this.state = s; this.stateTime = 0; }

    canBeHit(attackId) {
        return this.lastHitId !== attackId && this.state !== 'down' && this.state !== 'dead';
    }

    hurt(hit, game) {
        this.lastHitId = hit.id;
        this.hp -= hit.dmg;
        this.flash = 0.1;
        // Chefe não cai com o 3º soco do combo, só morrendo
        if (this.hp <= 0 || (hit.finisher && !this.t.boss)) {
            this.facing = -hit.dir;
            this.setState('down');
            this.vx = hit.vdir ? 0 : hit.dir * hit.knock / this.scale;
            this.vy = hit.vdir ? hit.vdir * hit.knock * 0.6 / this.scale : 0;
            this.vz = 260;
            if (this.hp <= 0) game.onEnemyDefeated(this);
        } else if (!this.t.heavy) {
            // Segurança tem "super armadura": golpe fraco não interrompe
            this.facing = -hit.dir;
            this.setState('hurt');
            if (hit.vdir) this.y += hit.vdir * 12;
            else this.x += hit.dir * hit.knock * 0.15;
        }
    }

    // Pego pelo laço: é arrastado até a frente do jogador
    pull() {
        this.setState('pulled');
        this.z = 0;
        this.lastHitId = -1;
    }

    inRange(player, dx) {
        const ady = Math.abs(player.y - this.y);
        if (ady > 16) return false;
        const adx = Math.abs(dx);
        if (this.t.ai === 'melee' || this.t.ai === 'boss') return adx < this.t.range + 4;
        if (this.t.ai === 'ranged') return adx > 110 && adx < 440;
        return adx > 110 && adx < 340; // charge
    }

    update(dt, player, game, mgr) {
        this.stateTime += dt;
        this.cooldown = Math.max(0, this.cooldown - dt);
        this.flash = Math.max(0, this.flash - dt);
        const t = this.t;
        const dx = player.x - this.x;
        const dy = player.y + this.offsetY - this.y;
        const melee = t.ai === 'melee' || t.ai === 'boss';
        if (t.boss) {
            this.moveTimer -= dt;
            if (!this.enraged && this.hp > 0 && this.hp < this.maxHp / 2) {
                this.enraged = true;
                game.ui.narrate(`${t.name} ficou BRAVO!`);
                game.audio.playSfx('moo');
            }
        }

        switch (this.state) {
            case 'approach': {
                // Chuva de Pix: o cowboy prefere o dinheiro a você
                const bait = game.items.baitFor(this);
                if (bait) {
                    const bx = bait.x - this.x, by = bait.y - this.y;
                    this.facing = bx > 0 ? 1 : -1;
                    this.x += Math.sign(bx) * Math.min(Math.abs(bx), t.speed * 1.2 * dt);
                    this.y += Math.sign(by) * Math.min(Math.abs(by), t.speed * 0.8 * dt);
                    this.walkCycle += dt * 10;
                    if (Math.abs(bx) < 16 && Math.abs(by) < 14 && bait.z === 0) {
                        bait.taken = true;
                        game.live.onSteal();
                    }
                    break;
                }
                this.facing = dx > 0 ? 1 : -1;
                // Distância que cada tipo gosta de manter do jogador
                const keep = melee ? t.range - 8 : t.keep;
                const gx = player.x - this.facing * keep - this.x;
                // Evita empilhar: afasta-se de outros inimigos
                let sep = 0;
                for (const o of mgr.list) {
                    if (o !== this && Math.abs(o.x - this.x) < 30 && Math.abs(o.y - this.y) < 20) {
                        sep += this.y >= o.y ? 1 : -1;
                    }
                }
                const mx = Math.abs(gx) > 8 ? Math.sign(gx) : 0;
                const my = Math.abs(dy) > 4 ? Math.sign(dy) : sep;
                this.x += mx * t.speed * dt;
                this.y += my * t.speed * 0.6 * dt;
                if (mx || my) this.walkCycle += dt * 8;

                if (t.boss && this.moveTimer <= 0 && player.state !== 'down') {
                    this.move = pick(t.moves);
                    this.moveFired = false;
                    this.setState('move');
                    break;
                }
                if (this.inRange(player, dx) && this.cooldown === 0 && player.state !== 'down') {
                    this.setState('windup');
                }
                break;
            }
            case 'move':
                this.updateMove(dt, player, game, mgr);
                break;
            case 'windup':
                if (this.stateTime > t.windup) {
                    this.setState('attack');
                    this.attackDone = false;
                    game.audio.playSfx(t.ai === 'charge' ? 'charge' : t.ai === 'ranged' ? 'throw' : 'whoosh');
                    if (t.ai === 'ranged') mgr.throwBottle(this);
                }
                break;
            case 'attack':
                if (melee) {
                    if (this.stateTime < 0.12 && !this.attackDone &&
                        Math.abs(player.x - this.x) < t.range + 8 &&
                        Math.sign(player.x - this.x) === this.facing &&
                        Math.abs(player.y - this.y) < 20 && player.z < 40) {
                        this.attackDone = player.hurt(t.dmg, this.facing, game, t.heavy);
                    }
                } else if (t.ai === 'charge') {
                    // Investida em linha reta: quem estiver na frente vai pro chão
                    this.x += this.facing * 560 * dt;
                    this.walkCycle += dt * 20;
                    if (!this.attackDone && Math.abs(player.x - this.x) < 30 &&
                        Math.abs(player.y - this.y) < 20 && player.z < 40) {
                        this.attackDone = player.hurt(t.dmg, this.facing, game, true);
                    }
                }
                if (this.stateTime > t.attackDur) {
                    this.cooldown = t.cooldown + Math.random() * 0.6;
                    this.setState('approach');
                }
                break;
            case 'hurt':
                if (this.stateTime > 0.35) this.setState('approach');
                break;
            case 'pulled': {
                const gx = player.x + player.facing * 42 - this.x;
                this.facing = -player.facing;
                this.x += Math.sign(gx) * Math.min(Math.abs(gx), 700 * dt);
                this.y += Math.sign(player.y - this.y) * Math.min(Math.abs(player.y - this.y), 400 * dt);
                if (Math.abs(gx) < 6 || this.stateTime > 1.0) {
                    this.hp = Math.max(1, this.hp - 4); // o tranco dói, mas não mata
                    this.setState('stunned');
                }
                break;
            }
            case 'stunned':
                // Tonto: janela pra encaixar o combo
                if (this.stateTime > 1.0) { this.setState('approach'); this.cooldown = 0.4; }
                break;
            case 'down':
                this.x += this.vx * dt;
                this.y += (this.vy || 0) * dt;
                this.vx *= 0.92;
                this.vy = (this.vy || 0) * 0.92;
                this.vz -= 1500 * dt;
                this.z = Math.max(0, this.z + this.vz * dt);
                if (this.stateTime > 1.0) {
                    if (this.hp <= 0) this.setState('dead');
                    else { this.setState('approach'); this.cooldown = 0.6; }
                }
                break;
            case 'dead':
                if (this.stateTime > 0.8) this.removed = true;
                break;
        }
        this.y = Math.max(380, Math.min(570, this.y));
    }

    // Golpes especiais dos chefes
    updateMove(dt, player, game, mgr) {
        const t = this.t, rage = this.enraged;
        const wind = rage ? 0.4 : 0.65; // tempo de aviso ("!") antes do golpe
        if (this.stateTime < wind) {
            this.facing = player.x > this.x ? 1 : -1;
            return;
        }
        const after = this.stateTime - wind;
        if (!this.moveFired) {
            this.moveFired = true;
            this.attackDone = false;
            if (this.move === 'fan') {
                const n = rage ? 5 : 3;
                for (let i = 0; i < n; i++) mgr.shoot(this, (i - (n - 1) / 2) * 50, t.shot);
                game.audio.playSfx('throw');
            } else if (this.move === 'summon') {
                for (let k = 0; k < 2; k++) {
                    if (mgr.alive >= 6) break;
                    const y = Math.max(395, Math.min(555, this.y + (k ? 50 : -50)));
                    mgr.spawn(Math.max(80, Math.min(944, this.x + (k ? 70 : -70))), y, pick(game.level.pool), game.level.speed);
                    game.ui.addHitSpark(this.x + (k ? 70 : -70), y, 40);
                }
                game.ui.narrate(`${t.name}: "Pega ele, peãozada!"`);
                game.audio.playSfx('honk');
            } else if (this.move === 'rain') {
                for (let k = 0; k < (rage ? 9 : 6); k++) {
                    mgr.rain(player.x + (Math.random() - 0.5) * 320, Math.max(390, Math.min(565, player.y + (Math.random() - 0.5) * 120)), t.rain);
                }
                game.audio.playSfx('whoosh');
            } else if (this.move === 'charge') {
                game.audio.playSfx('charge');
            } else if (this.move === 'slam') {
                this.vz = 750;
                this.slamX = player.x;
                game.audio.playSfx('jump');
            }
        }

        let done = after > 0.45;
        if (this.move === 'charge') {
            this.x += this.facing * (rage ? 720 : 620) * dt;
            this.walkCycle += dt * 20;
            if (!this.attackDone && Math.abs(player.x - this.x) < 50 && Math.abs(player.y - this.y) < 26 && player.z < 40) {
                this.attackDone = player.hurt(t.dmg, this.facing, game, true);
            }
            done = after > 0.8 || this.x < 45 || this.x > 979;
        }
        if (this.move === 'slam') {
            // Pula em cima de você e cai fazendo uma onda de choque (pule pra escapar!)
            this.x += Math.sign(this.slamX - this.x) * Math.min(Math.abs(this.slamX - this.x), 420 * dt);
            this.vz -= 1500 * dt;
            this.z = Math.max(0, this.z + this.vz * dt);
            if (this.z === 0 && !this.landed && after > 0.1) {
                this.landed = true;
                mgr.ring(this.x, this.y, t.dmg);
                game.shake = 0.4;
                game.audio.playSfx('boom');
            }
            done = this.landed && after > 0.9;
        }
        if (done) {
            this.landed = false;
            this.z = 0;
            this.setState('approach');
            this.moveTimer = rage ? 2.2 : 3.5;
            this.cooldown = 0.6;
        }
    }

    drawShadow(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, 22 * this.scale, 7 * this.scale, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    draw(ctx, time) {
        if (this.state === 'dead' && Math.floor(time * 16) % 2 === 0) return;
        const L = this.t.look, ai = this.t.ai;
        ctx.save();
        ctx.translate(Math.round(this.x), Math.round(this.y - this.z));
        ctx.scale(this.facing * this.scale, this.scale);
        if (this.state === 'down' || this.state === 'dead') {
            ctx.rotate(-Math.PI / 2 * Math.min(1, this.stateTime * 4));
        }
        const shake = this.state === 'hurt' || this.state === 'pulled' || this.flash > 0 ? Math.sin(time * 80) * 2 : 0;
        // Peão se inclina pra frente na investida
        const charging = (ai === 'charge' && (this.state === 'attack' || this.state === 'windup')) ||
            (this.state === 'move' && this.move === 'charge');
        ctx.translate(shake, 0);
        if (charging) ctx.rotate(0.25);
        const moving = this.state === 'approach' || (charging && (this.state === 'attack' || this.stateTime > 0.4));

        // Renderiza o inimigo ou chefe com sprites HD e efeitos de shader
        if (this.t.boss) {
            SpriteRenderer.drawBoss(ctx, this, time);
        } else {
            SpriteRenderer.drawEnemy(ctx, this, time);
        }

        // Laço amarrado na cintura / estrelinhas de tontura
        if (this.state === 'pulled') {
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 3;
            ctx.shadowColor = '#ffd700';
            ctx.shadowBlur = 8;
            ctx.strokeRect(-16, -62, 32, 12);
            ctx.shadowBlur = 0;
        }
        if (this.state === 'stunned') {
            ctx.fillStyle = '#ffe14d';
            ctx.shadowColor = '#ffd700';
            ctx.shadowBlur = 6;
            for (let i = 0; i < 3; i++) {
                const a = time * 6 + i * 2.1;
                ctx.fillRect(Math.cos(a) * 18 - 3, -114 + Math.sin(a) * 6, 6, 6);
            }
            ctx.shadowBlur = 0;
        }
        // Poeira da investida
        if (charging && this.state === 'attack') {
            ctx.fillStyle = 'rgba(200,170,120,0.6)';
            for (let i = 0; i < 3; i++) ctx.fillRect(-30 - i * 12, -8 - i * 4, 10, 6);
        }

        // Chefe bravo fica vermelho incandescente
        if (this.enraged && Math.floor(time * 6) % 2 === 0) {
            ctx.fillStyle = 'rgba(255,0,0,0.3)';
            ctx.shadowColor = '#ff1744';
            ctx.shadowBlur = 14;
            ctx.fillRect(-24, -110, 48, 110);
            ctx.shadowBlur = 0;
        }
        // Aviso de ataque
        if (this.state === 'windup' || (this.state === 'move' && this.stateTime < (this.enraged ? 0.4 : 0.65))) {
            ctx.scale(this.facing, 1);
            ctx.fillStyle = '#ff1744';
            ctx.shadowColor = '#ff1744';
            ctx.shadowBlur = 10;
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(ai === 'charge' || this.state === 'move' ? '!!' : '!', 0, -116);
            ctx.shadowBlur = 0;
        }
        ctx.restore();

        // Barra de vida
        if (this.hp < this.maxHp && this.hp > 0) {
            const top = this.y - this.z - 118 * this.scale;
            ctx.fillStyle = '#222';
            ctx.fillRect(this.x - 18, top, 36, 4);
            ctx.fillStyle = '#ff3366';
            ctx.fillRect(this.x - 18, top, 36 * this.hp / this.maxHp, 4);
        }
    }
}

export class EnemyManager {
    constructor() { this.clearFx(); this.list = []; }

    clearFx() { this.bottles = []; this.drops = []; this.rings = []; }

    spawn(x, y, type = 'cowboy', mult = 1) {
        const e = new Enemy(x, y, type, mult);
        this.list.push(e);
        return e;
    }

    get alive() { return this.list.filter(e => e.hp > 0).length; }

    throwBottle(e) {
        this.bottles.push({ x: e.x + e.facing * 20, y: e.y, z: 60, vx: e.facing * 380, vy: 0, t: 0, dmg: e.t.dmg, done: false, sprite: 'bottle' });
    }

    // Projétil do chefe (vy espalha em leque)
    shoot(e, vy, sprite) {
        this.bottles.push({ x: e.x + e.facing * 30, y: e.y, z: 70, vx: e.facing * 360, vy, t: 0, dmg: 9, done: false, sprite });
    }

    // Coisa caindo do céu: a sombra avisa onde vai cair
    rain(x, y, sprite) {
        this.drops.push({ x, y, t: 0, delay: 0.8 + Math.random() * 0.5, sprite, done: false, hit: false });
    }

    // Onda de choque em volta do chefe
    ring(x, y, dmg) { this.rings.push({ x, y, t: 0, dmg, hit: false }); }

    update(dt, player, game) {
        for (const e of this.list) e.update(dt, player, game, this);
        this.list = this.list.filter(e => !e.removed);

        for (const b of this.bottles) {
            b.t += dt;
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            if (Math.abs(b.x - player.x) < 20 && Math.abs(b.y - player.y) < 18 && player.z < 45) {
                if (player.hurt(b.dmg, Math.sign(b.vx), game)) {
                    b.done = true;
                    game.audio.playSfx('glass');
                }
            }
            if (b.t > 1.8) b.done = true;
        }
        this.bottles = this.bottles.filter(b => !b.done);

        for (const d of this.drops) {
            d.t += dt;
            if (!d.hit && d.t >= d.delay) {
                d.hit = true;
                if (Math.abs(player.x - d.x) < 34 && Math.abs(player.y - d.y) < 18 && player.z < 30) {
                    player.hurt(10, Math.sign(player.x - d.x) || 1, game);
                }
                game.ui.addHitSpark(d.x, d.y, 0);
            }
            if (d.t > d.delay + 0.3) d.done = true;
        }
        this.drops = this.drops.filter(d => !d.done);

        for (const r of this.rings) {
            r.t += dt;
            const radius = r.t * 600;
            const dist = Math.hypot(player.x - r.x, (player.y - r.y) * 2.5);
            if (!r.hit && Math.abs(dist - radius) < 28 && player.z < 10) {
                r.hit = player.hurt(r.dmg, Math.sign(player.x - r.x) || 1, game, true);
            }
        }
        this.rings = this.rings.filter(r => r.t < 0.45);
    }

    drawBottles(ctx) {
        for (const b of this.bottles) {
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath(); ctx.ellipse(b.x, b.y, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
            ctx.save();
            ctx.translate(b.x, b.y - b.z);
            ctx.rotate(b.t * 18);
            drawSprite(ctx, b.sprite);
            ctx.restore();
        }
        for (const d of this.drops) {
            // Sombra crescendo + objeto caindo
            const f = Math.min(1, d.t / d.delay);
            ctx.fillStyle = `rgba(255,30,60,${0.25 + 0.35 * f})`;
            ctx.beginPath(); ctx.ellipse(d.x, d.y, 30 * f + 6, 9 * f + 2, 0, 0, Math.PI * 2); ctx.fill();
            if (d.t < d.delay) {
                ctx.save();
                ctx.translate(d.x, d.y - (1 - f) * 520);
                ctx.rotate(d.t * 6);
                drawSprite(ctx, d.sprite);
                ctx.restore();
            }
        }
        for (const r of this.rings) {
            ctx.strokeStyle = `rgba(255,215,0,${1 - r.t / 0.45})`;
            ctx.lineWidth = 6;
            ctx.beginPath(); ctx.ellipse(r.x, r.y, r.t * 600, r.t * 240, 0, 0, Math.PI * 2); ctx.stroke();
        }
    }
}

// Desenho dos projéteis (já transladado e girado)
function drawSprite(ctx, sprite) {
    switch (sprite) {
        case 'pandeiro':
            ctx.fillStyle = '#d7b98e'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#c0c0c0';
            for (let i = 0; i < 5; i++) ctx.fillRect(Math.cos(i * 1.26) * 9 - 2, Math.sin(i * 1.26) * 9 - 2, 4, 4);
            break;
        case 'vinil':
            ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ff3fa4'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
            break;
        case 'peixe':
            ctx.fillStyle = '#b0bec5'; ctx.beginPath(); ctx.ellipse(0, 0, 13, 6, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(-19, -7); ctx.lineTo(-19, 7); ctx.fill();
            break;
        case 'pedra':
            ctx.fillStyle = '#795548'; ctx.fillRect(-12, -10, 24, 20);
            ctx.fillStyle = '#5d4037'; ctx.fillRect(-12, 4, 24, 6);
            break;
        case 'moeda':
            ctx.fillStyle = '#ffd700'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#b8860b'; ctx.fillRect(-2, -6, 4, 12);
            break;
        case 'gota':
            ctx.fillStyle = '#4fc3f7'; ctx.beginPath(); ctx.arc(0, 2, 10, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.moveTo(-8, -2); ctx.lineTo(0, -16); ctx.lineTo(8, -2); ctx.fill();
            break;
        default:
            ctx.fillStyle = '#2e8b57'; ctx.fillRect(-3, -9, 6, 18);
            ctx.fillStyle = '#ddd'; ctx.fillRect(-2, -12, 4, 4);
    }
}
