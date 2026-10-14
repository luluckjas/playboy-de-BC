// Andares no estilo The Binding of Isaac: um mapa de salas gerado aleatoriamente.
// Cada sala ocupa uma tela. Ao entrar numa sala com inimigos, as porteiras fecham
// e só abrem quando todo mundo for derrubado.

import { FLOORS } from './levels.js';
import { PropManager } from './world.js';
import { ItemManager } from './items.js';
import { MechanicalBull } from './bull.js';
import { RELIC_KEYS } from './relics.js';

export const DIRS = {
    left: { dx: -1, dy: 0 },
    right: { dx: 1, dy: 0 },
    up: { dx: 0, dy: -1 },
    down: { dx: 0, dy: 1 },
};
export const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };
// Onde o jogador aparece quando entra pela porta de cada lado
export const ENTRY = {
    left: { x: 90, y: 475 },
    right: { x: 934, y: 475 },
    up: { x: 512, y: 396 },
    down: { x: 512, y: 555 },
};

const DOOR_COLORS = { boss: '#ff1744', treasure: '#ffd700', shop: '#32ff7e', rodeio: '#ff9f1a', vendor: '#ffe08a' };
const MAP_ICONS = { boss: ['☠', '#ff1744'], treasure: ['★', '#ffd700'], shop: ['$', '#32ff7e'], rodeio: ['R', '#ff9f1a'], vendor: ['Q', '#ffe08a'] };

const key = (x, y) => `${x},${y}`;
const shuffle = arr => {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// ---------- Objetos especiais das salas ----------

// Pedestal com item grátis (sala do tesouro e depois do chefe)
class Pedestal {
    constructor(x = 512) { Object.assign(this, { x, y: 440, w: 40, h: 26, taken: false }); }
    touch(game) {
        if (this.taken) return;
        this.taken = true;
        game.takeTreasure();
    }
    drawShadow(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.ellipse(this.x, this.y, 34, 8, 0, 0, Math.PI * 2); ctx.fill();
    }
    draw(ctx, time) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = '#9e9e9e'; ctx.fillRect(-26, -40, 52, 40);
        ctx.fillStyle = '#bdbdbd'; ctx.fillRect(-32, -46, 64, 8);
        if (!this.taken) {
            const b = Math.sin(time * 3) * 5;
            ctx.fillStyle = `rgba(255,215,0,${0.25 + 0.15 * Math.sin(time * 5)})`;
            ctx.beginPath(); ctx.arc(0, -80 + b, 30, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffd700'; ctx.fillRect(-14, -94 + b, 28, 28);
            ctx.fillStyle = '#7a2cff'; ctx.font = 'bold 22px Arial'; ctx.textAlign = 'center';
            ctx.fillText('?', 0, -72 + b);
        }
        ctx.restore();
    }
}

// Sala da loja: encoste no balcão pra abrir a lojinha
class ShopCounter {
    // Fica no canto pra não bloquear a porteira de cima
    constructor() { Object.assign(this, { x: 300, y: 400, w: 70, h: 30 }); }
    touch(game) { game.openShop(); }
    drawShadow(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.ellipse(this.x, this.y, 80, 10, 0, 0, Math.PI * 2); ctx.fill();
    }
    draw(ctx, time) {
        ctx.save();
        ctx.translate(this.x, this.y);
        // Seu Agiota atrás do balcão
        ctx.fillStyle = '#1b5e20'; ctx.fillRect(-14, -96, 28, 34);
        ctx.fillStyle = '#c68642'; ctx.fillRect(-11, -120, 22, 24);
        ctx.fillStyle = '#111'; ctx.fillRect(-8, -112, 16, 5);
        ctx.fillStyle = '#ffd700'; ctx.fillRect(-10, -66, 20, 3);
        // Balcão
        ctx.fillStyle = '#5a3418'; ctx.fillRect(-70, -62, 140, 62);
        ctx.fillStyle = '#8d5524'; ctx.fillRect(-76, -66, 152, 8);
        ctx.fillStyle = '#32ff7e'; ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center';
        ctx.fillText('LOJINHA DO PIX', 0, -30);
        ctx.fillStyle = '#fff'; ctx.font = '11px Arial';
        ctx.fillText(Math.floor(time * 2) % 2 ? 'encoste pra comprar' : 'aceitamos Pix', 0, -12);
        ctx.restore();
    }
}

// Aparece depois do chefe: ponto de busão pro próximo andar
class BusStop {
    constructor() { Object.assign(this, { x: 512, y: 470, w: 50, h: 30 }); }
    touch(game) { game.askNextFloor(); }
    drawShadow(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.ellipse(this.x, this.y, 40, 8, 0, 0, Math.PI * 2); ctx.fill();
    }
    draw(ctx, time) {
        ctx.save();
        ctx.translate(this.x, this.y);
        const glow = 0.3 + 0.3 * Math.sin(time * 5);
        ctx.fillStyle = `rgba(0,229,255,${glow})`;
        ctx.beginPath(); ctx.ellipse(0, 0, 50, 14, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#888'; ctx.fillRect(-3, -110, 6, 110);
        ctx.fillStyle = '#1e5aa8'; ctx.fillRect(-36, -140, 72, 34);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center';
        ctx.fillText('PONTO DE', 0, -126);
        ctx.fillText('BUSÃO ➜', 0, -112);
        ctx.fillStyle = '#ffd700'; ctx.font = 'bold 13px Arial';
        ctx.fillText('próximo andar', 0, -150 + Math.sin(time * 4) * 3);
        ctx.restore();
    }
}

// ---------- Salas ----------

class Room {
    constructor(gx, gy, type) {
        Object.assign(this, { gx, gy, type });
        this.visited = false;
        this.seen = false;
        // Salas sem briga já começam "limpas"
        this.cleared = !['combat', 'rodeio', 'boss'].includes(type);
        this.doors = {};
        this.fixtures = [];
        this.bull = null;
        // Cada sala mostra um pedaço diferente do cenário do tema
        this.scenery = (((gx * 1337 + gy * 911) % 3800) + 3800) % 3800;
        this.built = false;
    }

    // Monta o conteúdo na primeira visita
    build(floor) {
        this.built = true;
        const n = floor.num;
        const types = [];
        if (this.type === 'combat') {
            const count = Math.min(8, 2 + n + Math.floor(Math.random() * 3));
            for (let i = 0; i < count; i++) types.push(pick(floor.pool));
        } else if (this.type === 'rodeio') {
            for (let i = 0; i < 3 + n; i++) types.push(pick(floor.pool));
            this.bull = new MechanicalBull(512, 470);
        } else if (this.type === 'boss') {
            types.push(floor.boss);
            for (let i = 0; i < 1 + Math.ceil(n / 2); i++) types.push(pick(floor.pool));
        }
        this.enemyTypes = types;

        this.items = new ItemManager(this.type === 'vendor' ? [440] : []);
        if (this.type === 'vendor') this.items.drop(600, 470, 'queijo', 1e9);
        if (this.type === 'treasure') this.fixtures.push(new Pedestal());
        if (this.type === 'shop') {
            this.fixtures.push(new ShopCounter());
            this.shopRelic = pick(RELIC_KEYS); // item especial à venda
        }

        // Objetos quebráveis espalhados (longe das portas e do centro)
        const spots = [];
        const nProps = this.type === 'combat' || this.type === 'rodeio' ? 1 + Math.floor(Math.random() * 3)
            : this.type === 'start' ? 1 : 0;
        for (let i = 0; i < nProps; i++) {
            const left = Math.random() < 0.5;
            spots.push({ x: left ? 150 + Math.random() * 230 : 644 + Math.random() * 230, y: 400 + Math.random() * 150 });
        }
        this.props = new PropManager(floor.theme, spots);
    }

    // Depois do chefe: busão pro próximo andar + item do chefe
    addExit() { this.fixtures.push(new BusStop(), new Pedestal(320)); }
}

export class Floor {
    constructor(num) {
        const def = FLOORS[num - 1];
        Object.assign(this, { num, ...def });
        this.active = false; // true enquanto as porteiras estão fechadas
        this.rooms = new Map();
        this.generate(Math.min(14, 7 + num));
    }

    room(gx, gy) { return this.rooms.get(key(gx, gy)); }

    neighbor(room, dir) {
        const d = DIRS[dir];
        return this.room(room.gx + d.dx, room.gy + d.dy);
    }

    generate(count) {
        let cells, ends;
        // Tenta algumas vezes até conseguir salas "sem saída" suficientes pras salas especiais
        for (let attempt = 0; attempt < 60; attempt++) {
            cells = new Map([[key(0, 0), { gx: 0, gy: 0 }]]);
            let queue = [{ gx: 0, gy: 0 }];
            for (let guard = 0; guard < 400 && cells.size < count; guard++) {
                if (!queue.length) queue = shuffle([...cells.values()]);
                const c = queue.shift();
                for (const d of shuffle(Object.values(DIRS))) {
                    const nx = c.gx + d.dx, ny = c.gy + d.dy;
                    if (cells.size >= count || cells.has(key(nx, ny)) || Math.random() < 0.5) continue;
                    // Evita blocos de salas grudadas: a sala nova só pode encostar em 1 sala
                    let touching = 0;
                    for (const e of Object.values(DIRS)) if (cells.has(key(nx + e.dx, ny + e.dy))) touching++;
                    if (touching > 1) continue;
                    const cell = { gx: nx, gy: ny };
                    cells.set(key(nx, ny), cell);
                    queue.push(cell);
                }
            }
            const neighbors = c => Object.values(DIRS).filter(d => cells.has(key(c.gx + d.dx, c.gy + d.dy))).length;
            ends = [...cells.values()].filter(c => (c.gx || c.gy) && neighbors(c) === 1);
            if (cells.size === count && ends.length >= 4) break;
        }

        // Distância (em salas) a partir do início, pra pôr o chefe no fundo
        const dist = new Map([[key(0, 0), 0]]);
        const bfs = [{ gx: 0, gy: 0 }];
        while (bfs.length) {
            const c = bfs.shift();
            for (const d of Object.values(DIRS)) {
                const k = key(c.gx + d.dx, c.gy + d.dy);
                if (cells.has(k) && !dist.has(k)) { dist.set(k, dist.get(key(c.gx, c.gy)) + 1); bfs.push(cells.get(k)); }
            }
        }
        ends.sort((a, b) => dist.get(key(b.gx, b.gy)) - dist.get(key(a.gx, a.gy)));

        const types = new Map();
        const special = ['boss', 'treasure', 'shop', 'rodeio', 'vendor'];
        ends.forEach((c, i) => { if (i < special.length) types.set(key(c.gx, c.gy), special[i]); });
        // Se faltou sala sem saída, coloca o resto em salas normais
        const free = shuffle([...cells.values()].filter(c => (c.gx || c.gy) && !types.has(key(c.gx, c.gy))));
        for (const s of special.slice(ends.length)) {
            if (s === 'boss' || !free.length) continue;
            const c = free.pop();
            types.set(key(c.gx, c.gy), s);
        }

        for (const c of cells.values()) {
            const t = c.gx === 0 && c.gy === 0 ? 'start' : types.get(key(c.gx, c.gy)) || 'combat';
            this.rooms.set(key(c.gx, c.gy), new Room(c.gx, c.gy, t));
        }
        for (const r of this.rooms.values()) {
            for (const dir of Object.keys(DIRS)) if (this.neighbor(r, dir)) r.doors[dir] = true;
        }
        this.start = this.room(0, 0);
    }

    visit(room) {
        if (!room.built) room.build(this);
        room.visited = true;
        room.seen = true;
        for (const dir of Object.keys(room.doors)) this.neighbor(room, dir).seen = true;
    }

    // ---------- Desenho ----------

    // Cercas do curral com as porteiras (abertas ou fechadas)
    drawDoors(ctx, room, closed, time) {
        const wood = '#6d4c41', dark = '#3e2723';
        ctx.save();
        // Cercas laterais e da frente
        ctx.fillStyle = wood;
        for (const x of [0, 994]) {
            ctx.fillRect(x, 340, 30, 260);
            ctx.fillStyle = dark;
            for (let y = 350; y < 600; y += 40) ctx.fillRect(x, y, 30, 4);
            ctx.fillStyle = wood;
        }
        ctx.fillRect(0, 586, 1024, 14);

        const frame = dir => DOOR_COLORS[this.neighbor(room, dir).type] || '#a1887f';
        const bars = (x, y, w, h, vertical) => {
            ctx.fillStyle = '#8d5524';
            if (vertical) for (let i = 0; i < 4; i++) ctx.fillRect(x + 4 + i * (w - 8) / 3 - 3, y, 6, h);
            else for (let i = 0; i < 4; i++) ctx.fillRect(x, y + 4 + i * (h - 8) / 3 - 3, w, 6);
            ctx.fillStyle = '#ff3366';
            ctx.fillRect(x + w / 2 - 6, y + h / 2 - 6, 12, 12); // cadeado
        };

        for (const dir of Object.keys(room.doors)) {
            let x, y, w, h;
            if (dir === 'left') [x, y, w, h] = [0, 432, 34, 88];
            if (dir === 'right') [x, y, w, h] = [990, 432, 34, 88];
            if (dir === 'up') [x, y, w, h] = [462, 290, 100, 92];
            if (dir === 'down') [x, y, w, h] = [462, 582, 100, 18];
            ctx.fillStyle = frame(dir);
            ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
            ctx.fillStyle = '#120a06';
            ctx.fillRect(x, y, w, h);
            if (closed) {
                bars(x, y, w, h, dir === 'up' || dir === 'down');
            } else {
                // Setinha piscando mostrando a saída
                const a = 0.4 + 0.4 * Math.sin(time * 5);
                ctx.fillStyle = `rgba(255,255,255,${a})`;
                ctx.font = 'bold 20px Arial';
                ctx.textAlign = 'center';
                const arrow = { left: '◀', right: '▶', up: '▲', down: '▼' }[dir];
                ctx.fillText(arrow, x + w / 2, y + h / 2 + 7);
            }
        }
        ctx.restore();
    }

    drawMinimap(ctx, current) {
        const seen = [...this.rooms.values()].filter(r => r.seen);
        const minX = Math.min(...seen.map(r => r.gx)), maxX = Math.max(...seen.map(r => r.gx));
        const minY = Math.min(...seen.map(r => r.gy)), maxY = Math.max(...seen.map(r => r.gy));
        const cw = 18, ch = 12, gap = 3;
        const boxX = 862, boxY = 26, boxW = 152, boxH = 92;
        const mapW = (maxX - minX + 1) * (cw + gap), mapH = (maxY - minY + 1) * (ch + gap);
        const scale = Math.min(1, boxW / mapW, boxH / mapH);
        const ox = boxX + (boxW - mapW * scale) / 2, oy = boxY + (boxH - mapH * scale) / 2;

        ctx.save();
        ctx.fillStyle = 'rgba(10,0,25,0.75)';
        ctx.fillRect(boxX - 4, boxY - 4, boxW + 8, boxH + 8);
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'right';
        ctx.fillStyle = '#fff';
        ctx.fillText(`ANDAR ${this.num}: ${this.name.toUpperCase()}`, 1014, 16);

        for (const r of seen) {
            const x = ox + (r.gx - minX) * (cw + gap) * scale;
            const y = oy + (r.gy - minY) * (ch + gap) * scale;
            const w = cw * scale, h = ch * scale;
            ctx.fillStyle = r === current ? '#ffffff' : r.visited ? '#8a8a99' : '#2c2c3a';
            ctx.fillRect(x, y, w, h);
            if (!r.visited) { ctx.strokeStyle = '#8a8a99'; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h); }
            const icon = MAP_ICONS[r.type];
            if (icon) {
                ctx.fillStyle = r === current ? '#000' : icon[1];
                ctx.font = `bold ${Math.round(10 * scale + 1)}px Arial`;
                ctx.textAlign = 'center';
                ctx.fillText(icon[0], x + w / 2, y + h - 2);
            }
        }
        ctx.restore();
    }
}
