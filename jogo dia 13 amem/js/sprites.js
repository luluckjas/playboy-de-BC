// Sprites: uma imagem por personagem (fundo magenta chapado).
// No carregamento: remove o fundo (flood fill a partir das bordas), recorta
// automaticamente pela silhueta e acha o "pé" do personagem pra ancorar no chão.
// A animação é feita por transformações (balanço, inclinação, flash de dano).
// Se uma imagem não carregar, cai no desenho procedural antigo.

const SOURCES = {
    thiago:      { src: 'assets/sprites/thiago_idle.jpg',  h: 112 },
    thiagoPunch: { src: 'assets/sprites/thiago_punch.jpg', h: null, sameScaleAs: 'thiago' },
    cowboy:      { src: 'assets/sprites/cowboy.jpg',       h: 108 },
    sertanejo:   { src: 'assets/sprites/sertanejo.jpg',    h: 110 },
    peao:        { src: 'assets/sprites/peao.jpg',         h: 98 },
    seguranca:   { src: 'assets/sprites/seguranca.jpg',    h: 106 },
    tiozao:      { src: 'assets/sprites/tiozao.jpg',       h: 98 },
    guia:        { src: 'assets/sprites/guia.jpg',         h: 102 },
    dj:          { src: 'assets/sprites/dj.jpg',           h: 100 },
};

// Chefes que ainda não têm arte própria: versão recolorida de outro sprite
const RECOLORS = {
    cobrador: { from: 'cowboy', filter: 'hue-rotate(190deg) saturate(1.3)' },
    pescador: { from: 'tiozao', filter: 'hue-rotate(28deg) saturate(1.25) brightness(1.05)' },
    capataz:  { from: 'peao',   filter: 'brightness(0.62) contrast(1.3) saturate(0.85)' },
};

const RES = 2; // o canvas processado tem 2x a resolução de exibição

// ---------- Processamento da imagem ----------

function rawKey(img) {
    const W = img.naturalWidth, H = img.naturalHeight;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0);
    const id = x.getImageData(0, 0, W, H), d = id.data;

    // Cor do fundo = média dos 4 cantos
    let br = 0, bg = 0, bb = 0, n = 0;
    for (const [cx, cy] of [[0, 0], [W - 8, 0], [0, H - 8], [W - 8, H - 8]]) {
        for (let yy = 0; yy < 8; yy++) for (let xx = 0; xx < 8; xx++) {
            const i = ((cy + yy) * W + cx + xx) * 4;
            br += d[i]; bg += d[i + 1]; bb += d[i + 2]; n++;
        }
    }
    br /= n; bg /= n; bb /= n;
    const dist2 = i => {
        const r = d[i] - br, g = d[i + 1] - bg, b = d[i + 2] - bb;
        return r * r + g * g + b * b;
    };

    // 1) Flood fill a partir das bordas (tolerância larga, só pega o que encosta no fundo)
    const LOOSE = 82 * 82, STRICT = 50 * 50, EDGE = 120 * 120;
    const clear = new Uint8Array(W * H);
    const stack = [];
    for (let xx = 0; xx < W; xx++) stack.push(xx, (H - 1) * W + xx);
    for (let yy = 0; yy < H; yy++) stack.push(yy * W, yy * W + W - 1);
    while (stack.length) {
        const p = stack.pop();
        if (clear[p] || dist2(p * 4) > LOOSE) continue;
        clear[p] = 1;
        const px = p % W;
        if (px > 0) stack.push(p - 1);
        if (px < W - 1) stack.push(p + 1);
        if (p >= W) stack.push(p - W);
        if (p < W * (H - 1)) stack.push(p + W);
    }
    // 2) Bolsões de fundo presos (ex.: entre o braço e o corpo): tolerância estrita, global
    for (let p = 0; p < W * H; p++) if (!clear[p] && dist2(p * 4) < STRICT) clear[p] = 1;
    // 3) Remove a franja rosada da borda (1 pixel)
    const fringe = [];
    for (let p = W; p < W * (H - 1); p++) {
        if (clear[p]) continue;
        if ((clear[p - 1] || clear[p + 1] || clear[p - W] || clear[p + W]) && dist2(p * 4) < EDGE) fringe.push(p);
    }
    for (const p of fringe) clear[p] = 1;
    for (let p = 0; p < W * H; p++) if (clear[p]) d[p * 4 + 3] = 0;
    x.putImageData(id, 0, 0);

    // Caixa da silhueta (ignora sujeirinhas: linha/coluna precisa ter >= 3 pixels)
    const rows = new Uint32Array(H), cols = new Uint32Array(W);
    for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
        if (!clear[yy * W + xx]) { rows[yy]++; cols[xx]++; }
    }
    let top = 0, bot = H - 1, left = 0, right = W - 1;
    while (top < H && rows[top] < 3) top++;
    while (bot > top && rows[bot] < 3) bot--;
    while (left < W && cols[left] < 3) left++;
    while (right > left && cols[right] < 3) right--;

    // Âncora horizontal = centro das pernas (30% de baixo), não do braço esticado
    let sx = 0, sn = 0;
    const legTop = Math.floor(bot - (bot - top) * 0.3);
    for (let yy = legTop; yy <= bot; yy++) for (let xx = left; xx <= right; xx++) {
        if (!clear[yy * W + xx]) { sx += xx; sn++; }
    }
    const anchorX = sn ? sx / sn : (left + right) / 2;

    return { canvas: c, left, top, w: right - left + 1, h: bot - top + 1, anchorX };
}

// Recorta e redimensiona pra (alturaDeExibição * RES)
function finalize(raw, scale, filter) {
    const w = Math.max(1, Math.round(raw.w * scale)), h = Math.max(1, Math.round(raw.h * scale));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = true;
    x.imageSmoothingQuality = 'high';
    if (filter) x.filter = filter;
    x.drawImage(raw.canvas, raw.left, raw.top, raw.w, raw.h, 0, 0, w, h);
    // Silhueta branca pro flash de dano
    const white = document.createElement('canvas');
    white.width = w; white.height = h;
    const wx = white.getContext('2d');
    wx.drawImage(c, 0, 0);
    wx.globalCompositeOperation = 'source-in';
    wx.fillStyle = '#fff';
    wx.fillRect(0, 0, w, h);
    return { canvas: c, white, anchor: (raw.anchorX - raw.left) * scale, w, h };
}

class SpriteLoader {
    constructor() {
        this.images = {};
        this.sprites = {};
        this.loaded = false;
        this.load();
    }

    loadImage(src) {
        return new Promise(resolve => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => { console.warn('Sprite não carregou:', src); resolve(null); };
            img.src = src;
        });
    }

    async load() {
        this.images.banner = await this.loadImage('assets/hero_banner.jpg');
        const raws = {};
        await Promise.all(Object.entries(SOURCES).map(async ([k, def]) => {
            const img = await this.loadImage(def.src);
            if (!img) return;
            try { raws[k] = rawKey(img); } catch (e) { console.warn('Falha ao processar', k, e); }
        }));
        const scales = {};
        for (const [k, def] of Object.entries(SOURCES)) {
            const raw = raws[k];
            if (!raw) continue;
            if (def.sameScaleAs) {
                // Mesmo tamanho de pixel do sprite base (personagem não "encolhe" no soco)
                if (!scales[def.sameScaleAs]) continue;
                scales[k] = scales[def.sameScaleAs];
            } else {
                scales[k] = (def.h * RES) / raw.h;
            }
            this.sprites[k] = finalize(raw, scales[k]);
        }
        for (const [k, rc] of Object.entries(RECOLORS)) {
            const raw = raws[rc.from];
            if (raw) this.sprites[k] = finalize(raw, scales[rc.from], rc.filter);
        }
        this.loaded = true;
        console.log('Sprites prontos:', Object.keys(this.sprites).join(', '));
    }

    getCanvas(key) { return this.images[key] || null; }
    get(key) { return this.sprites[key] || null; }
}

export const spriteLoader = new SpriteLoader();

// Desenha um sprite com os pés na origem (0,0). O chamador já fez translate/scale(facing).
function blit(ctx, s, flash = false) {
    const w = s.w / RES, h = s.h / RES;
    ctx.drawImage(flash ? s.white : s.canvas, -s.anchor / RES, -h, w, h);
}

const BONE_GLOW = { sorte: '#32ff7e', blindado: '#9aa4b1', turbinado: '#ff3366' };

// ---------- Renderizadores ----------

export class SpriteRenderer {
    static drawThiago(ctx, p, time) {
        const idle = spriteLoader.get('thiago');
        if (!idle) return this.drawProceduralThiago(ctx, p, time);
        const punchSpr = spriteLoader.get('thiagoPunch') || idle;
        const st = p.state;
        let spr = idle, rot = 0, dx = 0, dy = 0, sx = 1, sy = 1;

        if (st === 'idle' || st === 'bull') {
            const b = Math.sin(time * 4);
            sy = 1 + b * 0.012; sx = 1 - b * 0.008;
        } else if (st === 'walk') {
            dy = -Math.abs(Math.sin(p.walkCycle)) * 4;
            rot = Math.sin(p.walkCycle) * 0.05;
        } else if (st === 'punch' || st === 'lasso') {
            spr = punchSpr;
            dx = 3;
            if (st === 'punch' && p.comboStep === 2) { sx = sy = 1.06; rot = 0.06; }
        } else if (st === 'jump') {
            spr = p.airAttack ? punchSpr : idle;
            rot = p.airAttack ? 0.25 : -0.12;
        } else if (st === 'special') {
            const k = 1 + Math.abs(Math.sin(time * 18)) * 0.05;
            sx = sy = k;
        } else if (st === 'hurt') {
            rot = -0.18; dx = -4;
        }

        // Brilho do boné power-up no chão
        if (p.bone && BONE_GLOW[p.bone]) {
            ctx.save();
            ctx.globalAlpha = 0.35 + 0.15 * Math.sin(time * 8);
            ctx.fillStyle = BONE_GLOW[p.bone];
            ctx.beginPath(); ctx.ellipse(0, 0, 26, 8, 0, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }

        ctx.save();
        ctx.translate(dx, dy);
        ctx.rotate(rot);
        ctx.scale(sx, sy);
        blit(ctx, spr, st === 'hurt' && Math.floor(time * 30) % 2 === 0);
        ctx.restore();
    }

    static drawEnemy(ctx, e, time) {
        const spr = spriteLoader.get(e.type);
        if (!spr) return this.drawProceduralEnemy(ctx, e, time);
        const st = e.state;
        let rot = 0, dx = 0, dy = 0, sx = 1, sy = 1;
        if (st === 'approach') {
            dy = -Math.abs(Math.sin(e.walkCycle)) * 3;
            rot = Math.sin(e.walkCycle) * 0.04;
        } else if (st === 'windup') {
            rot = -0.12; dx = -3;
        } else if (st === 'attack' || st === 'move') {
            rot = 0.16; dx = 8;
        } else {
            const b = Math.sin(time * 3 + e.walkCycle);
            sy = 1 + b * 0.01;
        }
        ctx.save();
        ctx.translate(dx, dy);
        ctx.rotate(rot);
        ctx.scale(sx, sy);
        blit(ctx, spr, e.flash > 0);
        ctx.restore();
    }

    static drawBoss(ctx, boss, time) {
        this.drawEnemy(ctx, boss, time);
    }

    // ---------- Touro, cachorro e itens: desenho procedural ----------

    static drawBull(ctx, bull, time) {
        const moving = bull.state === 'riding' || bull.state === 'thrown';
        const lift = -bull.buck;
        const leg = moving ? Math.sin(bull.t * 22) * 8 : 0;

        const metal = ctx.createLinearGradient(0, -70 + lift, 0, -20 + lift);
        metal.addColorStop(0, '#eceff1');
        metal.addColorStop(0.45, '#90a4ae');
        metal.addColorStop(1, '#37474f');

        // Pernas com pistão
        for (const [lx, ph] of [[-32, 1], [-16, -1], [14, 1], [28, -1]]) {
            ctx.fillStyle = '#546e7a';
            ctx.fillRect(lx + leg * ph, -30 + lift, 9, 30 - lift);
            ctx.fillStyle = '#cfd8dc';
            ctx.fillRect(lx + 2 + leg * ph, -28 + lift, 3, 14);
            ctx.fillStyle = '#212121';
            ctx.fillRect(lx - 2 + leg * ph, -5, 13, 5);
        }
        // Corpo
        ctx.fillStyle = metal;
        ctx.beginPath(); ctx.ellipse(0, -46 + lift, 46, 22, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#263238'; ctx.lineWidth = 2; ctx.stroke();
        // Faixas de LED
        ctx.fillStyle = moving || Math.floor(time * 3) % 2 ? '#ff1744' : '#b71c1c';
        ctx.fillRect(-30, -40 + lift, 14, 3); ctx.fillRect(16, -40 + lift, 14, 3);
        // Sela dourada
        ctx.fillStyle = '#c99a2e';
        ctx.beginPath(); ctx.ellipse(-2, -66 + lift, 18, 7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffd54f';
        ctx.fillRect(-14, -70 + lift, 24, 3);
        // Placa
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(-18, -50 + lift, 36, 11);
        ctx.fillStyle = '#111';
        ctx.font = 'bold 8px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('AGRO-3000', -16, -42 + lift);
        // Cabeça
        ctx.fillStyle = metal;
        ctx.fillRect(36, -66 + lift, 26, 26);
        ctx.strokeStyle = '#263238'; ctx.strokeRect(36, -66 + lift, 26, 26);
        ctx.fillStyle = '#eceff1';
        ctx.beginPath();
        ctx.moveTo(40, -66 + lift); ctx.lineTo(30, -86 + lift); ctx.lineTo(46, -66 + lift);
        ctx.moveTo(54, -66 + lift); ctx.lineTo(66, -86 + lift); ctx.lineTo(60, -66 + lift);
        ctx.fill();
        // Olho
        ctx.fillStyle = Math.floor(time * 6) % 2 || moving ? '#ff1744' : '#7f0000';
        ctx.shadowColor = '#ff1744'; ctx.shadowBlur = 10;
        ctx.fillRect(52, -60 + lift, 6, 5);
        ctx.shadowBlur = 0;
        // Escapamento + fogo
        ctx.fillStyle = '#455a64';
        ctx.fillRect(-50, -48 + lift, 12, 5);
        if (moving) {
            const fl = 10 + Math.random() * 16;
            ctx.fillStyle = '#ff9100';
            ctx.beginPath();
            ctx.moveTo(-50, -49 + lift); ctx.lineTo(-50 - fl, -46 + lift); ctx.lineTo(-50, -42 + lift);
            ctx.fill();
        }
        // Rabo
        ctx.strokeStyle = '#37474f'; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-44, -50 + lift);
        ctx.quadraticCurveTo(-60, -42 + Math.sin(time * 8) * 8, -56, -28 + lift);
        ctx.stroke();
    }

    static drawCaramelo(ctx, dog, time) {
        const leg = Math.sin(dog.run) * 4;
        ctx.fillStyle = '#b06a24';
        ctx.fillRect(-15 + leg, -11, 5, 11); ctx.fillRect(-7 - leg, -11, 5, 11);
        ctx.fillRect(7 + leg, -11, 5, 11); ctx.fillRect(14 - leg, -11, 5, 11);
        const fur = ctx.createLinearGradient(0, -26, 0, -9);
        fur.addColorStop(0, '#e8a050'); fur.addColorStop(1, '#b8732c');
        ctx.fillStyle = fur;
        ctx.beginPath(); ctx.ellipse(1, -17, 19, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(15, -34, 15, 14);
        ctx.fillStyle = '#f5d6a8';
        ctx.fillRect(24, -26, 9, 6);
        ctx.fillStyle = '#8d5524';
        ctx.fillRect(15, -38, 6, 9);
        ctx.fillStyle = '#111';
        ctx.fillRect(25, -31, 3, 3);
        ctx.fillRect(31, -26, 3, 3);
        ctx.strokeStyle = '#d98b3a'; ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.moveTo(-18, -20); ctx.lineTo(-28, -32 + Math.sin(time * 20) * 6); ctx.stroke();
    }

    static drawPickup(ctx, p, time) {
        if (p.kind === 'pix') {
            ctx.rotate(Math.sin(time * 6 + p.x) * 0.3);
            ctx.shadowColor = '#00e676'; ctx.shadowBlur = 10;
            ctx.fillStyle = '#2ecc71';
            ctx.fillRect(-14, -16, 28, 14);
            ctx.shadowBlur = 0;
            ctx.strokeStyle = '#145a32'; ctx.lineWidth = 1.5;
            ctx.strokeRect(-12, -14, 24, 10);
            ctx.fillStyle = '#145a32';
            ctx.font = 'bold 8px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('R$', 0, -6);
        } else if (p.kind === 'queijo') {
            ctx.fillStyle = '#8b5a2b';
            ctx.fillRect(-1, -4, 3, 22);
            ctx.shadowColor = '#ff9800'; ctx.shadowBlur = 8;
            ctx.fillStyle = '#ffe08a';
            ctx.fillRect(-8, -24, 16, 21);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#c98a2e';
            ctx.fillRect(-8, -18, 16, 3); ctx.fillRect(-8, -10, 16, 3);
        } else {
            const c = BONE_GLOW[p.kind] || '#00e5ff';
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.beginPath(); ctx.arc(0, -10, 18, 0, Math.PI * 2); ctx.fill();
            ctx.shadowColor = c; ctx.shadowBlur = 12;
            ctx.fillStyle = c;
            ctx.beginPath(); ctx.arc(0, -8, 11, Math.PI, 0); ctx.fill();
            ctx.fillRect(0, -9, 18, 4);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#fff';
            ctx.fillRect(-2, -16, 4, 4);
        }
    }

    // ---------- Fallbacks procedurais (enquanto as imagens carregam) ----------

    static drawProceduralThiago(ctx, p, time) {
        const leg = p.state === 'walk' ? Math.sin(p.walkCycle) * 8 : 0;
        const look = p.look || { shirt: ['#ff3fa4', '#ffe14d'], chain: '#ffd700' };
        ctx.fillStyle = '#2b6cb0';
        ctx.fillRect(-11 + leg, -34, 9, 24); ctx.fillRect(2 - leg, -34, 9, 24);
        ctx.fillStyle = '#fff';
        ctx.fillRect(-13 + leg, -10, 13, 8); ctx.fillRect(0 - leg, -10, 13, 8);
        ctx.fillStyle = '#e0a87a'; ctx.fillRect(-12, -66, 24, 34);
        ctx.fillStyle = look.shirt[0];
        ctx.fillRect(-15, -66, 9, 34); ctx.fillRect(6, -66, 9, 34);
        ctx.strokeStyle = look.chain; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, -66, 9, 0.2, Math.PI - 0.2); ctx.stroke();
        const arm = p.state === 'punch' ? 30 : 14;
        ctx.fillStyle = '#e0a87a'; ctx.fillRect(4, -60, arm, 8); ctx.fillRect(arm + 2, -62, 8, 11);
        ctx.fillRect(-10, -88, 20, 22);
        ctx.fillStyle = '#111'; ctx.fillRect(-2, -82, 12, 5);
        ctx.fillStyle = '#7a2cff'; ctx.fillRect(-12, -96, 24, 10);
        ctx.fillStyle = '#00e5ff'; ctx.fillRect(4, -88, 18, 3);
    }

    static drawProceduralEnemy(ctx, e, time) {
        const L = e.t.look;
        const leg = e.state === 'approach' ? Math.sin(e.walkCycle) * 7 : 0;
        ctx.fillStyle = L.jeans;
        ctx.fillRect(-11 + leg, -36, 9, 26); ctx.fillRect(2 - leg, -36, 9, 26);
        ctx.fillStyle = L.suit ? '#000' : '#5a3418';
        ctx.fillRect(-13 + leg, -14, 12, 14); ctx.fillRect(1 - leg, -14, 12, 14);
        ctx.fillStyle = L.shirt; ctx.fillRect(-13, -70, 26, 30);
        if (L.vest) { ctx.fillStyle = L.vest; ctx.fillRect(-13, -70, 8, 30); ctx.fillRect(5, -70, 8, 30); }
        const arm = e.state === 'attack' ? 30 : e.state === 'windup' ? 2 : 12;
        ctx.fillStyle = L.shirt; ctx.fillRect(2, -64, arm, 8);
        ctx.fillStyle = L.skin; ctx.fillRect(arm + 1, -65, 8, 10);
        ctx.fillRect(-9, -90, 18, 20);
        ctx.fillStyle = '#111';
        if (L.shades) ctx.fillRect(-2, -84, 12, 5); else ctx.fillRect(3, -84, 3, 3);
        if (L.mustache) { ctx.fillStyle = '#3b2010'; ctx.fillRect(0, -77, 10, 3); }
        if (L.hat) { ctx.fillStyle = L.hat; ctx.fillRect(-20, -92, 40, 5); ctx.fillRect(-10, -104, 20, 13); }
    }
}
