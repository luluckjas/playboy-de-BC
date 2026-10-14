// Andares: cada um tem um tema (cenário), velocidade dos inimigos e os tipos que aparecem.
// O mapa de salas de cada andar é gerado em floor.js.
// Inimigos: c = Cowboy do Pix, s = Sertanejo Universitário, p = Peão de Rodeio, g = Segurança

const TYPE = { c: 'cowboy', s: 'sertanejo', p: 'peao', g: 'seguranca' };

const FLOOR_DEFS = [
    { name: 'Praia Central', theme: 'praia', boss: 'tiozao', speed: 1, pool: 'cccs', intro: 'Andar 1: Praia Central! Acha o chefe!' },
    { name: 'Teleférico da Barra Sul', theme: 'teleferico', boss: 'guia', speed: 1.05, pool: 'ccss', intro: 'Andar 2: Teleférico! Segura no cabo, peão!' },
    { name: 'Balada da Rua 3500', theme: 'balada', boss: 'dj', speed: 1.2, pool: 'ccpps', intro: 'Andar 3: Balada! Peão de balada é ligeiro!' },
    { name: 'Busão Mortal', theme: 'busao', boss: 'cobrador', speed: 1.2, pool: 'ccpsg', intro: 'Andar 4: Busão lotado de cowboy!' },
    { name: 'Molhes da Barra', theme: 'molhes', boss: 'pescador', speed: 1.25, pool: 'cpsg', intro: 'Andar 5: Noite nos molhes!' },
    { name: 'Avenida Atlântica', theme: 'avenida', boss: 'capataz', speed: 1.3, pool: 'cpsgg', intro: 'Andar 6: Última avenida antes do Xerife!' },
];
export const FLOORS = FLOOR_DEFS.map(d => ({ ...d, pool: [...d.pool].map(k => TYPE[k]) }));
export const FLOOR_COUNT = FLOORS.length;

export function drawBackground(theme, ctx, camX, time) {
    THEMES[theme](ctx, camX, time);
}

// Efeitos por cima de tudo (luz da balada, escuridão da noite)
export function drawOverlay(theme, ctx, time) {
    if (theme === 'balada') {
        const pulse = 1 - (time * 2) % 1;
        ctx.fillStyle = `rgba(255,0,200,${0.1 * pulse})`;
        ctx.fillRect(0, 0, 1024, 600);
    }
    if (theme === 'molhes' || theme === 'avenida') {
        const g = ctx.createRadialGradient(512, 400, 250, 512, 400, 700);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, 'rgba(0,0,20,0.45)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 1024, 600);
    }
}

// ---------- Helpers de desenho ----------

const wrap = (v, m) => ((v % m) + m) % m;
const hash = i => Math.abs(Math.floor(Math.sin(i * 127.1) * 43758.5453)) % 1000;

function gradient(ctx, y0, y1, stops) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
    ctx.fillStyle = g;
    ctx.fillRect(0, y0, 1024, y1 - y0);
}

// Prédios com janelas acesas, em parallax
function skyline(ctx, camX, factor, baseY, color, window, minH, maxH, width = 110) {
    const off = camX * factor;
    const first = Math.floor(off / width) - 1;
    for (let i = first; i < first + Math.ceil(1024 / width) + 3; i++) {
        const bx = i * width - off;
        const seed = hash(i);
        const h = minH + (seed % (maxH - minH));
        ctx.fillStyle = color;
        ctx.fillRect(bx, baseY - h, width - 20, h);
        ctx.fillStyle = window;
        for (let wy = baseY - h + 10; wy < baseY - 12; wy += 18) {
            for (let wx = 10; wx < width - 30; wx += 20) {
                if ((wx * 7 + wy * 3 + seed) % 5 < 2) ctx.fillRect(bx + wx, wy, 8, 8);
            }
        }
    }
}

function stars(ctx, time, count = 60) {
    for (let i = 0; i < count; i++) {
        const tw = 0.5 + 0.5 * Math.sin(time * 2 + i);
        ctx.fillStyle = `rgba(255,255,255,${0.3 + tw * 0.7})`;
        ctx.fillRect((hash(i) * 1.024) | 0, (hash(i + 99) * 0.25) | 0, 2, 2);
    }
}

// ---------- Cenários ----------

const THEMES = {
    praia(ctx, camX, time) {
        gradient(ctx, 0, 300, ['#2a0845', '#ff3fa4', '#ffb347']);
        ctx.fillStyle = '#ffe14d';
        ctx.beginPath(); ctx.arc(780, 210, 60, 0, Math.PI * 2); ctx.fill();
        skyline(ctx, camX, 0.2, 260, '#1b0f3a', 'rgba(0,229,255,0.5)', 120, 260);

        // Mar
        ctx.fillStyle = '#0a6fa8';
        ctx.fillRect(0, 260, 1024, 70);
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 12; i++) {
            const wx = i * 100 - wrap(camX * 0.5, 100) + Math.sin(time * 2 + i) * 6;
            ctx.beginPath(); ctx.moveTo(wx, 300); ctx.quadraticCurveTo(wx + 15, 292, wx + 30, 300); ctx.stroke();
        }

        // Areia
        ctx.fillStyle = '#f2d18b';
        ctx.fillRect(0, 330, 1024, 270);
        ctx.fillStyle = '#e6be72';
        for (let i = 0; i < 40; i++) ctx.fillRect(wrap(i * 137 - camX, 1100), 350 + (i * 53) % 240, 4, 2);

        // Guarda-sóis
        for (let i = 0; i < 20; i++) {
            const ux = i * 260 + 120 - camX;
            if (ux < -80 || ux > 1100) continue;
            ctx.fillStyle = '#ddd';
            ctx.fillRect(ux - 2, 300, 4, 60);
            ctx.fillStyle = i % 2 ? '#ff3fa4' : '#00e5ff';
            ctx.beginPath(); ctx.moveTo(ux - 45, 312); ctx.quadraticCurveTo(ux, 270, ux + 45, 312); ctx.fill();
        }
    },

    teleferico(ctx, camX, time) {
        gradient(ctx, 0, 330, ['#1e3c72', '#7a2cff', '#ff9a8b']);
        // Mar lá embaixo e morros da Mata Atlântica
        ctx.fillStyle = '#0a4f7a';
        ctx.fillRect(0, 250, 1024, 80);
        for (const [factor, color, amp, base] of [[0.1, '#1b4d3e', 60, 250], [0.3, '#0f3d2e', 80, 300]]) {
            ctx.fillStyle = color;
            ctx.beginPath(); ctx.moveTo(0, 330);
            for (let x = 0; x <= 1024; x += 16) {
                const wx = x + camX * factor;
                ctx.lineTo(x, base - Math.abs(Math.sin(wx / 230)) * amp - Math.sin(wx / 71) * 10);
            }
            ctx.lineTo(1024, 330); ctx.fill();
        }
        // Cabos e cabines andando (cenário em movimento)
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, 60); ctx.lineTo(1024, 140); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, 90); ctx.lineTo(1024, 170); ctx.stroke();
        for (let i = 0; i < 5; i++) {
            const up = wrap(i * 260 + time * 50 - camX * 0.4, 1300) - 140;
            const down = wrap(i * 260 - time * 50 - camX * 0.4 + 130, 1300) - 140;
            for (const [cx, lineY] of [[up, 60], [down, 90]]) {
                const cy = lineY + cx * 80 / 1024;
                ctx.fillStyle = '#888'; ctx.fillRect(cx + 18, cy, 3, 22);
                ctx.fillStyle = i % 2 ? '#ffd700' : '#ff3fa4';
                ctx.fillRect(cx, cy + 22, 40, 30);
                ctx.fillStyle = '#9fe8ff'; ctx.fillRect(cx + 5, cy + 27, 30, 12);
            }
        }
        // Plataforma da estação
        ctx.fillStyle = '#5c6370';
        ctx.fillRect(0, 330, 1024, 270);
        ctx.fillStyle = '#ffd700';
        for (let x = -wrap(camX, 60); x < 1024; x += 60) ctx.fillRect(x, 334, 30, 8);
        ctx.fillStyle = '#4a505c';
        for (let x = -wrap(camX, 120); x < 1024; x += 120) ctx.fillRect(x, 342, 4, 258);
        // Pilares da estação
        for (let i = 0; i < 12; i++) {
            const px = i * 420 + 200 - camX;
            if (px < -60 || px > 1100) continue;
            ctx.fillStyle = '#2d3138';
            ctx.fillRect(px, 140, 26, 195);
            ctx.fillStyle = '#ff3fa4';
            ctx.fillRect(px - 6, 140, 38, 8);
        }
    },

    balada(ctx, camX, time) {
        const beat = Math.floor(time * 2);
        ctx.fillStyle = '#120024';
        ctx.fillRect(0, 0, 1024, 330);
        // Lasers saindo do teto
        const colors = ['#ff3fa4', '#00e5ff', '#7a2cff', '#32ff7e'];
        ctx.lineWidth = 3;
        for (let i = 0; i < 6; i++) {
            const ox = i * 190 + 60;
            const a = Math.sin(time * 1.5 + i) * 0.8;
            ctx.strokeStyle = colors[(i + beat) % 4];
            ctx.globalAlpha = 0.6;
            ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox + Math.sin(a) * 500, 330); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        // Letreiros neon na parede
        for (let i = 0; i < 10; i++) {
            const sx = i * 520 + 100 - camX * 0.6;
            if (sx < -300 || sx > 1100) continue;
            ctx.font = 'bold 40px Arial';
            ctx.lineWidth = 2;
            ctx.strokeStyle = colors[i % 4];
            ctx.strokeText(['RUA 3500', 'OPEN BAR', 'CAMAROTE', 'VIP'][i % 4], sx, 120);
        }
        // Palco do DJ
        for (let i = 0; i < 6; i++) {
            const dx = i * 900 + 450 - camX * 0.8;
            if (dx < -250 || dx > 1100) continue;
            ctx.fillStyle = '#2a1050';
            ctx.fillRect(dx, 200, 200, 130);
            ctx.fillStyle = '#00e5ff';
            ctx.fillRect(dx, 200, 200, 6);
            // Caixas de som pulsando
            const s = beat % 2 ? 1.1 : 1;
            for (const bx of [dx - 70, dx + 210]) {
                ctx.fillStyle = '#111'; ctx.fillRect(bx, 170, 60, 160);
                ctx.fillStyle = '#444';
                ctx.beginPath(); ctx.arc(bx + 30, 270, 22 * s, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(bx + 30, 205, 12 * s, 0, Math.PI * 2); ctx.fill();
            }
        }
        // Pista que acende no ritmo
        const tw = 64, th = 45;
        for (let iy = 0; iy < 6; iy++) {
            for (let ix = -1; ix < 18; ix++) {
                const worldIx = ix + Math.floor(camX / tw);
                const lit = (worldIx + iy + beat) % 3 === 0;
                ctx.fillStyle = lit ? colors[(worldIx + iy) % 4] : '#1d0838';
                ctx.fillRect(worldIx * tw - camX, 330 + iy * th, tw - 2, th - 2);
            }
        }
    },

    busao(ctx, camX, time) {
        const bump = Math.sin(time * 25) * 1.2; // ônibus tremendo
        ctx.save();
        ctx.translate(0, bump);
        // Paisagem passando rápido pela janela
        gradient(ctx, 70, 260, ['#ff9a8b', '#ffd27f']);
        skyline(ctx, time * 500 + camX, 1, 260, '#5a3d7a', 'rgba(255,255,200,0.6)', 60, 150, 90);
        for (let i = 0; i < 8; i++) {
            const px = wrap(i * 170 - time * 900 - camX, 1360) - 160;
            ctx.fillStyle = '#5a3418'; ctx.fillRect(px, 170, 8, 90);
            ctx.fillStyle = '#2e8b57';
            for (let k = 0; k < 5; k++) {
                ctx.beginPath(); ctx.ellipse(px + 4 + Math.cos(k * 1.3) * 22, 168 + Math.sin(k * 1.3) * 6, 26, 7, k * 1.3, 0, Math.PI * 2); ctx.fill();
            }
        }
        // Parede do busão com janelas
        ctx.fillStyle = '#e0d6c3';
        ctx.fillRect(0, 0, 1024, 70);
        ctx.fillRect(0, 260, 1024, 75);
        for (let x = -wrap(camX, 200); x < 1100; x += 200) ctx.fillRect(x - 15, 70, 30, 190);
        // Corrimão
        ctx.fillStyle = '#c0c0c0';
        ctx.fillRect(0, 40, 1024, 6);
        for (let x = -wrap(camX, 200) + 100; x < 1100; x += 200) {
            ctx.fillRect(x, 46, 3, 20);
            ctx.fillStyle = '#ffd700'; ctx.fillRect(x - 6, 64, 15, 4); ctx.fillStyle = '#c0c0c0';
        }
        // Bancos
        for (let x = -wrap(camX, 200) + 30; x < 1100; x += 200) {
            ctx.fillStyle = '#1e5aa8'; ctx.fillRect(x, 270, 60, 50);
            ctx.fillStyle = '#163f78'; ctx.fillRect(x, 310, 60, 22);
        }
        ctx.fillStyle = '#7a2cff';
        ctx.font = 'bold 14px Arial';
        for (let x = -wrap(camX, 800) + 300; x < 1100; x += 800) ctx.fillText('PROIBIDO RODEIO NO BUSÃO', x, 26);
        ctx.restore();
        // Piso de borracha
        ctx.fillStyle = '#3c3f45';
        ctx.fillRect(0, 335, 1024, 265);
        ctx.fillStyle = '#33363b';
        for (let y = 345; y < 600; y += 14) ctx.fillRect(0, y, 1024, 4);
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(0, 335, 1024, 4);
    },

    molhes(ctx, camX, time) {
        gradient(ctx, 0, 290, ['#050a30', '#1a1050', '#3d1a6e']);
        stars(ctx, time);
        ctx.fillStyle = '#fff6d5';
        ctx.beginPath(); ctx.arc(200, 90, 34, 0, Math.PI * 2); ctx.fill();
        // Farol com facho girando
        const fx = 760 - wrap(camX * 0.1, 1400);
        ctx.fillStyle = '#ddd'; ctx.fillRect(fx, 150, 26, 120);
        ctx.fillStyle = '#c0392b';
        for (let y = 160; y < 270; y += 30) ctx.fillRect(fx, y, 26, 12);
        ctx.fillStyle = '#ffe14d'; ctx.fillRect(fx + 3, 136, 20, 14);
        const a = time * 1.5;
        ctx.fillStyle = 'rgba(255,240,150,0.18)';
        ctx.beginPath();
        ctx.moveTo(fx + 13, 143);
        ctx.lineTo(fx + 13 + Math.cos(a) * 900, 143 + Math.sin(a) * 120 - 60);
        ctx.lineTo(fx + 13 + Math.cos(a) * 900, 143 + Math.sin(a) * 120 + 60);
        ctx.fill();
        // Mar escuro com reflexo da lua
        ctx.fillStyle = '#0b1a4a';
        ctx.fillRect(0, 270, 1024, 70);
        ctx.fillStyle = 'rgba(255,246,213,0.5)';
        for (let i = 0; i < 6; i++) ctx.fillRect(170 + Math.sin(time * 3 + i) * 12, 280 + i * 9, 60 - i * 8, 2);
        // Pedras na beira
        ctx.fillStyle = '#2b2b38';
        for (let i = -1; i < 14; i++) {
            const rx = i * 90 - wrap(camX, 90);
            ctx.beginPath(); ctx.ellipse(rx + 45, 338, 50, 18 + (hash(i + Math.floor(camX / 90)) % 10), 0, Math.PI, 0); ctx.fill();
        }
        // Piso de blocos de pedra
        ctx.fillStyle = '#6b6b78';
        ctx.fillRect(0, 338, 1024, 262);
        ctx.strokeStyle = '#55555f';
        ctx.lineWidth = 2;
        for (let row = 0; row < 6; row++) {
            const y = 338 + row * 44;
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1024, y); ctx.stroke();
            for (let x = -wrap(camX + row * 50, 100); x < 1024; x += 100) {
                ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 44); ctx.stroke();
            }
        }
    },

    avenida(ctx, camX, time, level) {
        gradient(ctx, 0, 330, ['#0a0420', '#2a0845', '#5a1a6e']);
        stars(ctx, time, 30);
        // Roda-gigante girando ao fundo
        const wx = 820 - wrap(camX * 0.08, 1600), wy = 150;
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(wx, wy, 100, 0, Math.PI * 2); ctx.stroke();
        for (let i = 0; i < 12; i++) {
            const a = time * 0.3 + i * Math.PI / 6;
            ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx + Math.cos(a) * 100, wy + Math.sin(a) * 100); ctx.stroke();
            ctx.fillStyle = i % 2 ? '#ff3fa4' : '#ffd700';
            ctx.fillRect(wx + Math.cos(a) * 100 - 6, wy + Math.sin(a) * 100, 12, 12);
        }
        skyline(ctx, camX, 0.3, 290, '#160a30', 'rgba(255,63,164,0.6)', 140, 280, 130);
        // Calçadão
        ctx.fillStyle = '#8d8d99';
        ctx.fillRect(0, 290, 1024, 50);
        ctx.fillStyle = '#7a7a86';
        for (let x = -wrap(camX, 40); x < 1024; x += 40) ctx.fillRect(x, 290, 20, 50);
        // Postes
        for (let i = 0; i < 16; i++) {
            const px = i * 330 + 80 - camX;
            if (px < -40 || px > 1100) continue;
            ctx.fillStyle = '#333'; ctx.fillRect(px, 170, 6, 170);
            ctx.fillStyle = '#ffe14d'; ctx.fillRect(px - 10, 166, 26, 8);
            ctx.fillStyle = 'rgba(255,225,77,0.12)';
            ctx.beginPath(); ctx.moveTo(px + 3, 174); ctx.lineTo(px - 60, 340); ctx.lineTo(px + 66, 340); ctx.fill();
        }
        // Asfalto com faixa
        ctx.fillStyle = '#26262e';
        ctx.fillRect(0, 340, 1024, 260);
        ctx.fillStyle = '#ffd700';
        for (let x = -wrap(camX, 120); x < 1024; x += 120) ctx.fillRect(x, 470, 60, 6);
        // Porteira do rodeio no fim da fase (gancho pro chefe final)
        const gx = level ? level.length - 260 - camX : 1e9;
        if (gx < 1100) {
            ctx.fillStyle = '#5a3418';
            ctx.fillRect(gx, 120, 24, 220); ctx.fillRect(gx + 216, 120, 24, 220);
            ctx.fillRect(gx - 10, 110, 260, 40);
            ctx.fillStyle = '#ffd700';
            ctx.font = 'bold 20px Arial';
            ctx.fillText('RODEIO DO XERIFE', gx + 18, 138);
        }
    },
};
