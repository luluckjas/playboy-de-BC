// Cenário interativo (objetos que dá pra quebrar ou chutar) e eventos surpresa das fases.

import { nextAttackId } from './player.js';
import { BONE_KEYS } from './items.js';

// drop  = quebra e solta item
// throw = sai voando/rolando e derruba quem estiver no caminho
// boom  = explode e derruba todo mundo em volta
const PROP_TYPES = {
    isopor:    { hp: 1, kind: 'drop', w: 28 },
    lixeira:   { hp: 2, kind: 'drop', w: 24 },
    guardasol: { hp: 1, kind: 'throw', w: 26, speed: 640 },
    barril:    { hp: 1, kind: 'throw', w: 26, speed: 480 },
    cone:      { hp: 1, kind: 'throw', w: 18, speed: 720 },
    caixasom:  { hp: 2, kind: 'boom', w: 34 },
};

const THEME_PROPS = {
    praia: ['isopor', 'guardasol'],
    teleferico: ['barril', 'isopor'],
    balada: ['caixasom', 'isopor'],
    busao: ['lixeira', 'isopor'],
    molhes: ['barril', 'isopor'],
    avenida: ['cone', 'lixeira'],
};

const THEME_EVENTS = {
    praia: ['chuvaPix', 'onda'],
    teleferico: ['vento', 'chuvaPix'],
    balada: ['apagao', 'chuvaPix'],
    busao: ['freada', 'chuvaPix', 'freada'],
    molhes: ['onda', 'apagao'],
    avenida: ['apagao', 'chuvaPix'],
};

const EVENTS = {
    chuvaPix: { dur: 6, msg: 'CHUVA DE PIX! Pega antes dos cowboys!', sfx: 'powerup' },
    apagao:   { dur: 7, msg: 'APAGÃO! Cadê o peão?', sfx: 'denied' },
    onda:     { dur: 3.4, msg: 'Olha a onda, minha gente!', sfx: 'wave' },
    freada:   { dur: 2.2, msg: 'O motorista vai frear!', sfx: 'honk' },
    vento:    { dur: 6, msg: 'VENTANIA NO MORRO!', sfx: 'wave' },
};

const ONDA_WARN = 2, FREADA_WARN = 1.5;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const alive = e => e.hp > 0 && e.state !== 'down' && e.state !== 'dead';

class Prop {
    constructor(x, y, type) {
        this.x = x; this.y = y; this.z = 0;
        this.type = type;
        this.def = PROP_TYPES[type];
        this.hp = this.def.hp;
        this.state = 'idle'; // idle | flying | broken
        this.t = 0; this.vx = 0; this.flash = 0;
        this.lastHitId = -1;
        this.hitList = new Set();
        this.removed = false;
    }

    hit(hb, game) {
        if (this.state !== 'idle' || this.lastHitId === hb.id) return;
        this.lastHitId = hb.id;
        this.flash = 0.12;
        this.hp--;
        game.audio.playSfx('hit');
        if (this.def.kind === 'throw') {
            this.state = 'flying';
            this.t = 0;
            this.vx = hb.dir * this.def.speed;
            this.flyId = nextAttackId();
        } else if (this.hp <= 0) {
            this.smash(game);
        }
    }

    smash(game) {
        this.state = 'broken';
        this.t = 0;
        game.audio.playSfx('break');
        if (this.def.kind === 'boom') {
            game.audio.playSfx('boom');
            game.shake = 0.4;
            game.ui.narrate('A caixa de som explodiu! BUUUM!');
            for (const e of game.enemies.list) {
                if (!alive(e) || Math.abs(e.x - this.x) > 260 || Math.abs(e.y - this.y) > 120) continue;
                e.hurt({ id: nextAttackId(), dmg: 15, knock: 300, finisher: true, dir: Math.sign(e.x - this.x) || 1 }, game);
            }
            return;
        }
        const r = Math.random();
        if (r < 0.35) game.items.drop(this.x, this.y, 'queijo');
        else if (r < 0.55) game.items.drop(this.x, this.y, pick(BONE_KEYS));
        else for (let i = 0; i < 4; i++) game.items.drop(this.x + (Math.random() - 0.5) * 60, this.y + (Math.random() - 0.5) * 30, 'pix', 8);
    }

    update(dt, game) {
        this.t += dt;
        this.flash = Math.max(0, this.flash - dt);
        if (this.state === 'flying') {
            this.x += this.vx * dt;
            for (const e of game.enemies.list) {
                if (!alive(e) || this.hitList.has(e)) continue;
                if (Math.abs(e.x - this.x) < 32 && Math.abs(e.y - this.y) < 26) {
                    this.hitList.add(e);
                    e.hurt({ id: this.flyId, dmg: 22, knock: 320, finisher: true, dir: Math.sign(this.vx) }, game);
                    game.audio.playSfx('bigHit');
                    game.ui.addHitSpark(e.x, e.y, 40);
                    game.live.onHit(game.ui.registerHit(), game);
                    game.gainOstentacao(6);
                    if (this.hitList.size === 2) game.ui.narrate('STRIKE! Derrubou dois de uma vez!');
                }
            }
            if (this.t > 1.3) { this.state = 'broken'; this.t = 0; }
        }
        if (this.state === 'broken' && this.t > 0.6) this.removed = true;
    }

    drawShadow(ctx) {
        if (this.state === 'broken') return;
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, this.def.w * 0.7, 6, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    draw(ctx, time) {
        ctx.save();
        ctx.translate(Math.round(this.x), Math.round(this.y));
        if (this.state === 'broken') {
            // Pedaços voando
            const t = this.t;
            ctx.globalAlpha = Math.max(0, 1 - t / 0.6);
            ctx.fillStyle = this.type === 'caixasom' ? '#ff3fa4' : '#ddd';
            for (let i = 0; i < 8; i++) {
                const a = i * Math.PI / 4;
                ctx.fillRect(Math.cos(a) * t * 160, -20 + Math.sin(a) * t * 100 + t * t * 200, 6, 6);
            }
            ctx.restore();
            return;
        }
        if (this.flash > 0) ctx.globalAlpha = 0.6;
        if (this.state === 'flying') {
            ctx.translate(0, -14);
            ctx.rotate(this.t * 14 * Math.sign(this.vx));
            ctx.translate(0, 14);
        }
        switch (this.type) {
            case 'isopor':
                ctx.fillStyle = '#f4f4f4'; ctx.fillRect(-15, -24, 30, 24);
                ctx.fillStyle = '#1e88e5'; ctx.fillRect(-16, -28, 32, 6);
                ctx.fillStyle = '#1e88e5'; ctx.font = 'bold 8px Arial'; ctx.fillText('GELADA', -13, -10);
                break;
            case 'lixeira':
                ctx.fillStyle = '#2e7d32'; ctx.fillRect(-12, -34, 24, 34);
                ctx.fillStyle = '#1b5e20'; ctx.fillRect(-14, -38, 28, 6);
                break;
            case 'guardasol':
                ctx.fillStyle = '#ddd'; ctx.fillRect(-2, -50, 4, 50);
                ctx.fillStyle = '#00e5ff';
                ctx.beginPath(); ctx.moveTo(-30, -44); ctx.quadraticCurveTo(0, -74, 30, -44); ctx.fill();
                break;
            case 'barril':
                ctx.fillStyle = '#8d5524'; ctx.fillRect(-13, -32, 26, 32);
                ctx.fillStyle = '#4e342e'; ctx.fillRect(-13, -26, 26, 3); ctx.fillRect(-13, -9, 26, 3);
                break;
            case 'cone':
                ctx.fillStyle = '#ff6d00';
                ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(0, -30); ctx.lineTo(10, 0); ctx.fill();
                ctx.fillStyle = '#fff'; ctx.fillRect(-6, -14, 12, 4);
                break;
            case 'caixasom': {
                const s = Math.floor(time * 2) % 2 ? 1.12 : 1;
                ctx.fillStyle = '#111'; ctx.fillRect(-17, -48, 34, 48);
                ctx.fillStyle = '#444';
                ctx.beginPath(); ctx.arc(0, -15, 10 * s, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(0, -36, 6 * s, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#ff3fa4'; ctx.fillRect(-17, -48, 34, 3);
                break;
            }
        }
        ctx.restore();
    }
}

export class PropManager {
    constructor(theme, spots) {
        const kinds = THEME_PROPS[theme];
        this.list = spots.map(s => new Prop(s.x, s.y, pick(kinds)));
    }

    // Golpes do jogador também acertam o cenário
    hitTest(hb, game) {
        for (const p of this.list) {
            if (p.state !== 'idle' || Math.abs(p.y - hb.y) > 24 || hb.z > 70) continue;
            if (p.x + p.def.w / 2 < hb.x1 || p.x - p.def.w / 2 > hb.x2) continue;
            p.hit(hb, game);
        }
    }

    update(dt, game) {
        for (const p of this.list) p.update(dt, game);
        this.list = this.list.filter(p => !p.removed);
    }
}

export class EventManager {
    constructor(level) {
        this.pool = THEME_EVENTS[level.theme];
        this.cur = null;
        this.timer = 10 + Math.random() * 6;
    }

    get id() { return this.cur?.id; }

    update(dt, game) {
        if (!this.cur) {
            // Eventos só acontecem no meio da briga
            if (game.level.active) this.timer -= dt;
            if (this.timer <= 0) this.start(pick(this.pool), game);
            return;
        }
        const c = this.cur;
        c.t += dt;
        this[c.id](dt, game, c);
        if (c.t >= EVENTS[c.id].dur) {
            this.cur = null;
            this.timer = 20 + Math.random() * 12;
        }
    }

    start(id, game) {
        this.cur = { id, t: 0, hit: new Set(), drop: 0, dir: Math.random() < 0.5 ? -1 : 1 };
        game.ui.narrate(EVENTS[id].msg);
        game.audio.playSfx(EVENTS[id].sfx);
        game.live.onEvent();
    }

    // ---- Comportamento de cada evento ----

    chuvaPix(dt, game, c) {
        c.drop -= dt;
        if (c.drop <= 0 && c.t < 5) {
            c.drop = 0.12;
            game.items.drop(game.cameraX + 40 + Math.random() * 944, 390 + Math.random() * 170, 'pix', 6, 420 + Math.random() * 200);
        }
    }

    apagao() {}

    onda(dt, game, c) {
        if (c.t < ONDA_WARN) return;
        if (!c.splashed) { c.splashed = true; game.audio.playSfx('wave'); game.shake = 0.3; }
        // A onda varre a tela da esquerda pra direita; quem estiver no chão é derrubado
        c.waveX = game.cameraX - 150 + (c.t - ONDA_WARN) / 1.4 * 1324;
        for (const e of game.enemies.list) {
            if (!alive(e) || c.hit.has(e) || e.x > c.waveX) continue;
            c.hit.add(e);
            e.hurt({ id: nextAttackId(), dmg: 20, knock: 350, finisher: true, dir: 1 }, game);
        }
        const p = game.player;
        if (!c.hit.has(p) && p.x < c.waveX) {
            c.hit.add(p);
            if (p.z > 15 || p.state === 'bull') {
                game.ui.narrate('Pulou a onda! Surfista de BC!');
                game.live.gain(150, game);
            } else {
                p.hurt(10, 1, game, true);
            }
        }
    }

    freada(dt, game, c) {
        if (c.t < FREADA_WARN || c.done) return;
        c.done = true;
        game.shake = 0.5;
        game.audio.playSfx('boom');
        // Todo mundo escorrega pra frente do busão
        for (const e of game.enemies.list) {
            if (!alive(e)) continue;
            e.hurt({ id: nextAttackId(), dmg: 8, knock: 500, finisher: true, dir: 1 }, game);
        }
        const p = game.player;
        if (p.z > 10 || p.state === 'bull') {
            game.ui.narrate('Pulou na hora! Nem sentiu a freada!');
            game.live.gain(150, game);
        } else {
            p.hurt(5, 1, game, true);
        }
    }

    vento(dt, game, c) {
        const p = game.player;
        if (p.state !== 'down' && p.state !== 'bull') p.x += c.dir * 110 * dt;
        for (const e of game.enemies.list) if (alive(e)) e.x += c.dir * 80 * dt;
    }

    // ---- Desenho ----

    // No espaço do mundo (com câmera)
    drawWorld(ctx, game) {
        const c = this.cur;
        if (c?.id !== 'onda' || c.waveX === undefined) return;
        const left = game.cameraX - 200;
        const g = ctx.createLinearGradient(left, 0, c.waveX, 0);
        g.addColorStop(0, 'rgba(10,111,168,0.0)');
        g.addColorStop(1, 'rgba(10,140,200,0.75)');
        ctx.fillStyle = g;
        ctx.fillRect(left, 300, c.waveX - left, 300);
        // Crista de espuma
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        for (let y = 300; y < 600; y += 20) {
            ctx.beginPath();
            ctx.arc(c.waveX + Math.sin(y * 0.1 + c.t * 20) * 8, y, 14, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Por cima de tudo (escuridão, avisos, vento)
    drawOverlay(ctx, game, time) {
        const c = this.cur;
        if (!c) return;
        const blink = Math.floor(time * 6) % 2 === 0;
        const warn = (text, color) => {
            if (!blink) return;
            ctx.save();
            ctx.textAlign = 'center';
            ctx.font = 'bold 44px Arial';
            ctx.lineWidth = 7;
            ctx.strokeStyle = '#000';
            ctx.strokeText(text, 512, 260);
            ctx.fillStyle = color;
            ctx.fillText(text, 512, 260);
            ctx.restore();
        };

        if (c.id === 'apagao') {
            // Escuro total, só uma luz em volta do Thiago
            const fade = Math.min(1, c.t * 3, (EVENTS.apagao.dur - c.t) * 3);
            const px = game.player.x - game.cameraX, py = game.player.y - 50;
            const g = ctx.createRadialGradient(px, py, 70, px, py, 190);
            g.addColorStop(0, 'rgba(0,0,10,0)');
            g.addColorStop(1, `rgba(0,0,10,${0.93 * fade})`);
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, 1024, 600);
        }
        if (c.id === 'onda' && c.t < ONDA_WARN) warn('🌊 ONDA GIGANTE! PULA (L)!', '#00e5ff');
        if (c.id === 'freada' && c.t < FREADA_WARN) warn('🚌 FREADA! PULA (L)!', '#ffd700');
        if (c.id === 'chuvaPix' && c.t < 1.5) warn('💸 CHUVA DE PIX! 💸', '#32ff7e');
        if (c.id === 'vento') {
            ctx.strokeStyle = 'rgba(255,255,255,0.35)';
            ctx.lineWidth = 2;
            for (let i = 0; i < 30; i++) {
                const x = ((i * 97 + c.dir * time * 900) % 1100 + 1100) % 1100 - 40;
                const y = (i * 53) % 560 + 20;
                ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + c.dir * 50, y); ctx.stroke();
            }
            if (c.t < 1.5) warn(c.dir > 0 ? 'VENTANIA ➜' : '⬅ VENTANIA', '#fff');
        }
    }
}
