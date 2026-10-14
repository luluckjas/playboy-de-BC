import { BONES, BONE_DURATION } from './items.js';
import { spriteLoader } from './sprites.js';

// HUD, narrador de rodeio, popups de Pix e telas de menu/fim.

const NARRATOR = [
    'Olha o laço, minha gente!', 'Segura o peão!', 'Que tapa, que tapa!',
    'Esse aí foi pro camarote!', 'Ostentação pura!', 'Caiu do touro, sô!',
    'Aba reta não perdoa!', 'Pix recebido, peão abatido!',
];

export class UI {
    constructor() { this.reset(); }

    reset() {
        this.coins = 0;
        this.clearFx();
    }

    // Limpa efeitos e narração (ao trocar de fase), sem zerar o Pix
    clearFx() {
        this.narration = ''; this.narrationTime = 0;
        this.popups = []; this.sparks = []; this.floats = []; this.rings = [];
        this.goTime = 0;
        this.hits = 0; this.hitTimer = 0;
        this.camaroteTime = 0; this.bills = [];
        this.bannerTime = 0;
    }

    // Contador de combo: zera se ficar 1.2s sem acertar
    registerHit() {
        this.hits = this.hitTimer > 0 ? this.hits + 1 : 1;
        this.hitTimer = 1.2;
        return this.hits;
    }

    // Dispara o efeito de tela do especial: flash + chuva de notas
    camarote() {
        this.camaroteTime = 1.6;
        this.bills = Array.from({ length: 40 }, () => ({
            x: Math.random() * 1024, y: -Math.random() * 400,
            vy: 200 + Math.random() * 250, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 8,
        }));
    }

    narrate(text) {
        this.narration = text || NARRATOR[Math.floor(Math.random() * NARRATOR.length)];
        this.narrationTime = 2.2;
    }

    pixPopup(value) { this.popups.push({ text: `+R$ ${value} PIX`, t: 1.5 }); }
    addFloat(x, y, text, color) { this.floats.push({ x, y, text, color, t: 0.8 }); }
    addRing(x, y) { this.rings.push({ x, y, t: 0 }); }

    addHitSpark(x, y, z) { this.sparks.push({ x, y: y - z, t: 0.15 }); }
    showGo() { this.goTime = 2.5; }

    update(dt) {
        this.narrationTime = Math.max(0, this.narrationTime - dt);
        this.goTime = Math.max(0, this.goTime - dt);
        this.bannerTime = Math.max(0, this.bannerTime - dt);
        this.hitTimer = Math.max(0, this.hitTimer - dt);
        if (this.hitTimer === 0) this.hits = 0;
        this.camaroteTime = Math.max(0, this.camaroteTime - dt);
        for (const b of this.bills) { b.y += b.vy * dt; b.rot += b.vr * dt; }
        for (const p of this.popups) p.t -= dt;
        for (const s of this.sparks) s.t -= dt;
        this.popups = this.popups.filter(p => p.t > 0);
        this.sparks = this.sparks.filter(s => s.t > 0);
        for (const f of this.floats) { f.t -= dt; f.y -= 50 * dt; }
        for (const r of this.rings) r.t += dt;
        this.floats = this.floats.filter(f => f.t > 0);
        this.rings = this.rings.filter(r => r.t < 0.5);
    }

    // Efeitos desenhados no espaço do mundo (com câmera)
    drawWorldFx(ctx) {
        for (const r of this.rings) {
            ctx.strokeStyle = `rgba(0,229,255,${1 - r.t / 0.5})`;
            ctx.lineWidth = 5;
            ctx.beginPath(); ctx.ellipse(r.x, r.y - 30, r.t * 400, r.t * 160, 0, 0, Math.PI * 2); ctx.stroke();
        }
        for (const f of this.floats) {
            ctx.save();
            ctx.globalAlpha = Math.min(1, f.t * 3);
            ctx.font = 'bold 18px Arial';
            ctx.textAlign = 'center';
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#000';
            ctx.strokeText(f.text, f.x, f.y);
            ctx.fillStyle = f.color;
            ctx.fillText(f.text, f.x, f.y);
            ctx.restore();
        }
        for (const s of this.sparks) {
            ctx.fillStyle = '#fff';
            const r = 14 * (s.t / 0.15) + 4;
            ctx.beginPath();
            for (let i = 0; i < 8; i++) {
                const a = i * Math.PI / 4;
                const rr = i % 2 ? r * 0.4 : r;
                ctx.lineTo(s.x + Math.cos(a) * rr, s.y + Math.sin(a) * rr);
            }
            ctx.fill();
        }
    }

    // Faixa grande no meio da tela, estilo "item novo" do Isaac
    banner(title, sub) {
        this.bannerTitle = title;
        this.bannerSub = sub;
        this.bannerTime = 3;
    }

    drawBanner(ctx) {
        if (this.bannerTime <= 0) return;
        ctx.save();
        ctx.globalAlpha = Math.min(1, this.bannerTime * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 215, 1024, 80);
        ctx.textAlign = 'center';
        ctx.font = 'bold 34px Arial';
        ctx.fillStyle = '#ffd700';
        ctx.fillText(this.bannerTitle, 512, 255);
        ctx.font = '18px Arial';
        ctx.fillStyle = '#fff';
        ctx.fillText(this.bannerSub, 512, 283);
        ctx.restore();
    }

    // Barra de vida do chefe no rodapé
    drawBossBar(ctx, boss) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = '#ff1744';
        ctx.fillText(`☠ ${boss.t.name.toUpperCase()}${boss.enraged ? ' (BRAVO!)' : ''} ☠`, 512, 546);
        this.bar(ctx, 262, 554, 500, 12, boss.hp / boss.maxHp, '#ff1744');
        ctx.restore();
    }

    drawCamarote(ctx) {
        if (this.camaroteTime <= 0) return;
        const t = this.camaroteTime;
        ctx.save();
        // Flash dourado que some rápido
        ctx.fillStyle = `rgba(255,215,0,${Math.max(0, t - 1.2) * 1.5})`;
        ctx.fillRect(0, 0, 1024, 600);
        // Chuva de notas
        for (const b of this.bills) {
            ctx.save();
            ctx.translate(b.x, b.y);
            ctx.rotate(b.rot);
            ctx.fillStyle = '#32c86e';
            ctx.fillRect(-14, -7, 28, 14);
            ctx.fillStyle = '#1a7a40';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('R$', 0, 4);
            ctx.restore();
        }
        // Letreiro
        const scale = 1 + Math.max(0, t - 1.3) * 3;
        ctx.globalAlpha = Math.min(1, t * 2);
        ctx.translate(512, 260);
        ctx.scale(scale, scale);
        ctx.textAlign = 'center';
        ctx.font = 'bold 64px Arial';
        ctx.lineWidth = 8;
        ctx.strokeStyle = '#7a2cff';
        ctx.strokeText('CAMAROTE PREMIUM', 0, 0);
        ctx.fillStyle = '#ffd700';
        ctx.fillText('CAMAROTE PREMIUM', 0, 0);
        ctx.restore();
    }

    drawHud(ctx, player, level, time = 0) {
        ctx.save();
        ctx.fillStyle = 'rgba(20,0,40,0.7)';
        ctx.fillRect(12, 12, 320, 78);
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'left';

        // Vida
        ctx.fillStyle = '#fff';
        ctx.fillText('THIAGO', 22, 32);
        this.bar(ctx, 90, 21, 230, 13, player.hp / player.maxHp, '#00ffcc');

        // Barra de Ostentação: pisca dourada quando cheia
        const full = player.ostentacao >= player.maxOstentacao;
        const blink = full && Math.floor(time * 6) % 2 === 0;
        ctx.fillStyle = '#ff3fa4';
        ctx.fillText('OSTENT.', 22, 54);
        this.bar(ctx, 90, 43, 230, 10, player.ostentacao / player.maxOstentacao, blink ? '#ffd700' : '#ff3fa4');
        if (player.ostentacao > 1) {
            ctx.fillStyle = '#ffb3dc';
            ctx.font = 'bold 11px Arial';
            ctx.fillText(`DANO x${player.damageMult.toFixed(1)}`, 270, 54);
            ctx.font = 'bold 14px Arial';
        }
        if (full) {
            ctx.fillStyle = blink ? '#ffd700' : '#fff';
            ctx.font = 'bold 16px Arial';
            ctx.fillText('ESPAÇO: CAMAROTE PREMIUM!', 22, 112);
            ctx.font = 'bold 14px Arial';
        }

        // Contador de combo
        if (this.hits >= 2) {
            ctx.save();
            ctx.textAlign = 'left';
            ctx.font = `bold ${28 + Math.min(this.hits, 20)}px Arial`;
            ctx.lineWidth = 5;
            ctx.strokeStyle = '#2a0845';
            ctx.strokeText(`${this.hits} HITS`, 30, 170);
            ctx.fillStyle = this.hits >= 10 ? '#ffd700' : '#00e5ff';
            ctx.fillText(`${this.hits} HITS`, 30, 170);
            ctx.restore();
        }

        // Pix
        ctx.fillStyle = '#ffd700';
        ctx.fillText(`PIX: R$ ${this.coins}`, 22, 78);
        if (player.bone) {
            const b = BONES[player.bone];
            ctx.fillStyle = b.color;
            ctx.fillText(`Boné ${b.name}`, 170, 78);
            this.bar(ctx, 270, 70, 50, 6, Math.min(1, player.boneTime / BONE_DURATION), b.color);
        }


        // Popups de Pix (empilhados)
        ctx.textAlign = 'center';
        this.popups.forEach((p, i) => {
            ctx.globalAlpha = Math.min(1, p.t * 2);
            ctx.fillStyle = '#32ff7e';
            ctx.font = 'bold 20px Arial';
            ctx.fillText(p.text, 512, 120 - (1.5 - p.t) * 30 + i * 4);
        });
        ctx.globalAlpha = 1;

        // Narrador
        if (this.narrationTime > 0) {
            ctx.font = 'bold 26px Arial';
            ctx.lineWidth = 5;
            ctx.strokeStyle = '#2a0845';
            ctx.strokeText('🎙️ ' + this.narration, 512, 170);
            ctx.fillStyle = '#ffe14d';
            ctx.fillText('🎙️ ' + this.narration, 512, 170);
        }

        // GO! ->
        if (this.goTime > 0 && Math.floor(this.goTime * 4) % 2 === 0) {
            ctx.font = 'bold 40px Arial';
            ctx.fillStyle = '#00ffcc';
            ctx.textAlign = 'right';
            ctx.fillText('VAI! ➜', 1000, 300);
        }
        ctx.restore();
    }

    bar(ctx, x, y, w, h, frac, color) {
        ctx.fillStyle = '#000';
        ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
        ctx.fillStyle = '#333';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
    }

    drawMenu(ctx, time) {
        const bannerImg = spriteLoader.getCanvas('banner');
        if (bannerImg) {
            ctx.drawImage(bannerImg, 0, 0, 1024, 600);
            // Gradiente escuro na base para legibilidade dos comandos
            const g = ctx.createLinearGradient(0, 320, 0, 600);
            g.addColorStop(0, 'rgba(10, 4, 32, 0)');
            g.addColorStop(0.6, 'rgba(10, 4, 32, 0.85)');
            g.addColorStop(1, 'rgba(10, 4, 32, 0.98)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 320, 1024, 280);
        } else {
            const g = ctx.createLinearGradient(0, 0, 0, 600);
            g.addColorStop(0, '#2a0845');
            g.addColorStop(1, '#0a0420');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, 1024, 600);
            // Grade neon retrô
            ctx.strokeStyle = 'rgba(255,63,164,0.4)';
            ctx.lineWidth = 1;
            for (let i = 0; i < 12; i++) {
                const y = 380 + ((i * 20 + time * 40) % 220);
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1024, y); ctx.stroke();
            }
            // Título apenas se não tiver o banner
            ctx.textAlign = 'center';
            ctx.font = 'bold 72px Arial';
            ctx.lineWidth = 8;
            ctx.strokeStyle = '#7a2cff';
            ctx.strokeText('BONEZÃO RODEIO', 512, 170);
            ctx.fillStyle = '#ffd700';
            ctx.fillText('BONEZÃO RODEIO', 512, 170);
            ctx.font = 'bold 28px Arial';
            ctx.fillStyle = '#00e5ff';
            ctx.fillText('Busão Mortal em Balneário', 512, 215);
        }

        ctx.textAlign = 'center';
        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = '#ffd700';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 6;
        ctx.fillText('💥 OS COWBOYS DO PIX TOMARAM A ORLA DE BALNEÁRIO CAMBORIÚ 💥', 512, 410);

        ctx.font = '14px Arial';
        ctx.fillStyle = '#fff';
        ctx.fillText('🎮 CONTROLES: Setas/WASD mover  •  J / clique esq. soco (3x combo)  •  K / clique dir. laço de ouro  •  L / ESPAÇO pulo (+J voadora)', 512, 440);
        ctx.fillStyle = '#00e5ff';
        ctx.fillText('⚡ BARRAS: Encha a Ostentação batendo  •  E = Camarote Premium Especial', 512, 465);
        ctx.fillStyle = '#ff9f1a';
        ctx.fillText('🐂 TOURO MECÂNICO: Encoste pra montar e aperte as setas pedidas para domar o AGRO-3000!', 512, 490);
        ctx.fillStyle = '#32ff7e';
        ctx.fillText('✨ R: Alternar RTX ON / ULTRA / OFF  •  M: Música  •  1 a 6: Selecionar andar direto', 512, 515);

        if (Math.floor(time * 2) % 2 === 0) {
            ctx.font = 'bold 30px Arial';
            ctx.fillStyle = '#ff3fa4';
            ctx.shadowColor = '#ff3fa4';
            ctx.shadowBlur = 14;
            ctx.fillText('▶ PRESSIONE ENTER PARA JOGAR ◀', 512, 560);
        }
        ctx.shadowBlur = 0;
    }

    drawConfirm(ctx, title, subtitle, time = 0) {
        const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
        ctx.fillStyle = 'rgba(10,0,25,0.72)';
        ctx.fillRect(0, 0, 1024, 600);

        const w = 600, h = 230, x = 512 - w / 2, y = 175;
        const pulse = 0.5 + 0.5 * Math.sin(time * 4);
        ctx.save();
        ctx.textAlign = 'center';

        // Painel com degradê e brilho neon pulsando
        const g = ctx.createLinearGradient(0, y, 0, y + h);
        g.addColorStop(0, '#3a1066');
        g.addColorStop(1, '#14052e');
        ctx.shadowColor = '#00e5ff';
        ctx.shadowBlur = 18 + pulse * 14;
        ctx.fillStyle = g;
        rr(x, y, w, h, 20); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 3;
        rr(x, y, w, h, 20); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1;
        rr(x + 6, y + 6, w - 12, h - 12, 15); ctx.stroke();

        // Busão balançando em cima do painel
        ctx.save();
        ctx.font = '44px Arial';
        ctx.translate(512, y - 4 + Math.sin(time * 6) * 2);
        ctx.rotate(Math.sin(time * 3) * 0.05);
        ctx.fillText('🚌', 0, 0);
        ctx.restore();

        // Título e subtítulo
        ctx.font = 'bold 34px Arial';
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#0a0220';
        ctx.strokeText(title, 512, y + 66);
        ctx.fillStyle = '#00ffcc';
        ctx.fillText(title, 512, y + 66);
        ctx.font = '17px Arial';
        ctx.fillStyle = '#d9c8ff';
        ctx.fillText(subtitle, 512, y + 100);

        // Botões
        const btn = (cx, key, label, color, dark, glow) => {
            const bw = 240, bh = 58, bx = cx - bw / 2, by = y + 130;
            ctx.shadowColor = color;
            ctx.shadowBlur = glow;
            ctx.fillStyle = dark;
            rr(bx, by, bw, bh, 14); ctx.fill();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = color;
            ctx.lineWidth = 2.5;
            rr(bx, by, bw, bh, 14); ctx.stroke();
            // "Tecla" à esquerda
            ctx.font = 'bold 14px Arial';
            const kw = ctx.measureText(key).width + 18;
            ctx.fillStyle = color;
            rr(bx + 12, by + 17, kw, 24, 6); ctx.fill();
            ctx.fillStyle = '#10002a';
            ctx.fillText(key, bx + 12 + kw / 2, by + 34);
            ctx.font = 'bold 20px Arial';
            ctx.fillStyle = '#fff';
            ctx.fillText(label, bx + 12 + kw + (bw - 12 - kw) / 2, by + 36);
        };
        btn(512 - 135, 'Enter', 'SIM, BORA!', '#32ff7e', '#0d3a22', 6 + pulse * 12);
        btn(512 + 135, 'Esc', 'AINDA NÃO', '#ff6b8a', '#401024', 6);
        ctx.restore();
    }

    drawEnd(ctx, title, color, subtitle, hint = 'Enter para voltar ao menu') {
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(0, 0, 1024, 600);
        ctx.textAlign = 'center';
        ctx.font = 'bold 60px Arial';
        ctx.fillStyle = color;
        ctx.fillText(title, 512, 240);
        ctx.font = '22px Arial';
        ctx.fillStyle = '#fff';
        ctx.fillText(subtitle, 512, 290);
        ctx.fillStyle = '#ffd700';
        ctx.fillText(`Total no Pix: R$ ${this.coins}`, 512, 340);
        ctx.fillStyle = '#ccc';
        ctx.fillText(hint, 512, 400);
    }
}
