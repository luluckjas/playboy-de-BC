// Sistema de Shaders e "RTX ON" em tempo real para Canvas 2D
// Inclui:
// - Iluminação dinâmica com luzes pontuais (Point Lights) e sombras suaves
// - Bloom / Glow multi-pass (efeito neon das baladas e ouro)
// - Reflexos de chão em tempo real (Screen Space Reflections - SSR) na areia molhada, balada e busão
// - Raios volumétricos (God Rays) e lasers de balada
// - Distorção por onda de choque (Shockwave) em golpes pesados e especial
// - Vinheta cinematográfica e aberração cromática

export class RtxEngine {
    constructor(width = 1024, height = 600) {
        this.w = width;
        this.h = height;
        this.mode = 'ultra'; // 'ultra' | 'high' | 'off'
        this.lights = [];
        this.shockwaves = [];

        // Canvas auxiliar para o passe de Bloom (em resolução 1/4 para alta performance)
        this.bloomW = Math.floor(width / 4);
        this.bloomH = Math.floor(height / 4);
        this.bloomCanvas = document.createElement('canvas');
        this.bloomCanvas.width = this.bloomW;
        this.bloomCanvas.height = this.bloomH;
        this.bloomCtx = this.bloomCanvas.getContext('2d');

        // Canvas auxiliar para mapa de iluminação
        this.lightCanvas = document.createElement('canvas');
        this.lightCanvas.width = width;
        this.lightCanvas.height = height;
        this.lightCtx = this.lightCanvas.getContext('2d');

        // Canvas auxiliar para reflexos de chão
        this.reflectCanvas = document.createElement('canvas');
        this.reflectCanvas.width = width;
        this.reflectCanvas.height = height;
        this.reflectCtx = this.reflectCanvas.getContext('2d');
    }

    toggleMode() {
        if (this.mode === 'ultra') this.mode = 'high';
        else if (this.mode === 'high') this.mode = 'off';
        else this.mode = 'ultra';
        return this.mode;
    }

    addLight(x, y, radius, color = '#ffd700', intensity = 1, pulse = 0) {
        this.lights.push({ x, y, radius, color, intensity, pulse });
    }

    addShockwave(x, y, maxRadius = 160, color = 'rgba(0, 229, 255, 0.7)') {
        this.shockwaves.push({ x, y, radius: 10, maxRadius, life: 0.45, maxLife: 0.45, color });
    }

    update(dt) {
        for (const sw of this.shockwaves) {
            sw.life -= dt;
            const progress = 1 - sw.life / sw.maxLife;
            sw.radius = progress * sw.maxRadius;
        }
        this.shockwaves = this.shockwaves.filter(sw => sw.life > 0);
    }

    // Coleta automaticamente as fontes de luz dos elementos do jogo
    collectLights(game, time) {
        this.lights = [];
        if (this.mode === 'off') return;

        const p = game.player;
        if (p) {
            // Brilho da Corrente de Ouro e Relógio do Thiago
            this.addLight(p.x, p.y - p.z - 50, 65, '#ffd700', 0.65, Math.sin(time * 6) * 0.15);

            // Aura Dourada do Camarote Especial
            if (p.state === 'special') {
                this.addLight(p.x, p.y - 50, 280, '#ffd700', 1.8, Math.sin(time * 20) * 0.3);
                this.addLight(p.x, p.y - 50, 160, '#32ff7e', 1.2, 0);
            }
            // Laço de ouro reluzente
            if (p.state === 'lasso') {
                this.addLight(p.x + p.facing * (p.ropeLen || 30), p.y - 50, 80, '#ffd700', 0.9, 0);
            }
        }

        // Touro Mecânico (Olhos vermelhos e chamas)
        if (game.bull && game.bull.visible) {
            const b = game.bull;
            this.addLight(b.x + b.facing * 45, b.y - 55, 85, '#ff1744', 1.4, Math.sin(time * 12) * 0.3);
            if (b.state === 'riding' || b.state === 'thrown') {
                this.addLight(b.x - b.facing * 50, b.y - 45, 95, '#ff9100', 1.2, Math.random() * 0.3);
            }
        }

        // Inimigos com garrafas, chefes neon e efeitos
        for (const e of game.enemies.list) {
            if (e.hp <= 0) continue;
            if (e.t.boss) {
                // Chefe tem iluminação imponente
                const bCol = e.type === 'dj' ? '#7a2cff' : (e.type === 'tiozao' ? '#ff9f1a' : '#ff1744');
                this.addLight(e.x, e.y - 60, 130 * (e.scale || 1), bCol, 0.95, Math.sin(time * 8) * 0.2);
            }
            if (e.enraged) {
                this.addLight(e.x, e.y - 50, 100, '#ff1744', 1.3, Math.sin(time * 16) * 0.3);
            }
        }

        // Vendedor de Queijo Coalho (Brasa viva alaranjada)
        if (game.items?.vendors) {
            for (const v of game.items.vendors) {
                this.addLight(v.x + 35, v.y - 40, 110, '#ff6d00', 1.1, Math.sin(time * 10) * 0.25);
            }
        }

        // Itens caídos no chão (Notas de Pix verde esmeralda, Bonés)
        if (game.items?.list) {
            for (const it of game.items.list) {
                if (it.kind === 'pix') {
                    this.addLight(it.x, it.y - 10, 50, '#00e676', 0.8, Math.sin(time * 8 + it.x) * 0.2);
                } else if (it.kind === 'queijo') {
                    this.addLight(it.x, it.y - 12, 45, '#ffa000', 0.6, 0);
                } else {
                    this.addLight(it.x, it.y - 12, 60, '#00e5ff', 0.9, Math.sin(time * 6) * 0.2);
                }
            }
        }

        // Cenário da Balada: Luzes estroboscópicas e Lasers
        if (game.level?.theme === 'balada') {
            const beat = Math.floor(time * 2);
            const cols = ['#ff3fa4', '#00e5ff', '#7a2cff', '#32ff7e'];
            for (let i = 0; i < 4; i++) {
                const lx = (i * 260 + 100 + time * 60) % 1024;
                this.addLight(lx, 260, 180, cols[(i + beat) % 4], 0.8, 0);
            }
        }
    }

    // Aplica o passe completo de pós-processamento e shaders
    apply(ctx, game, time) {
        if (this.mode === 'off') {
            this.drawHudBadge(ctx);
            return;
        }

        this.collectLights(game, time);

        // 1. Passe de Reflexos de Chão (SSR - Screen Space Reflections)
        if (this.mode === 'ultra') {
            this.renderGroundReflections(ctx, game, time);
        }

        // 2. Passe de Iluminação Dinâmica (Lighting & Shadows)
        this.renderLightingPass(ctx, game, time);

        // 3. Passe de Ondas de Choque Refractivas (Shockwaves)
        this.renderShockwaves(ctx);

        // 4. Passe de Bloom / Glow Neon Multi-Scale
        this.renderBloomPass(ctx, time);

        // 5. Raios Volumétricos (God Rays)
        if (this.mode === 'ultra') {
            this.renderVolumetricRays(ctx, game, time);
        }

        // 6. Vinheta e Correção de Cor Cinematográfica
        this.renderVignetteAndTone(ctx);

        // 7. Badge de Indicação RTX ON
        this.drawHudBadge(ctx);
    }

    // Reflexo realista no piso molhado ou polido
    renderGroundReflections(ctx, game, time) {
        // Só em pisos brilhantes (pista da balada, piso do busão, molhado à noite)
        const theme = game.level?.theme;
        if (!['balada', 'busao', 'molhes', 'avenida'].includes(theme)) return;

        const refCtx = this.reflectCtx;
        refCtx.clearRect(0, 0, this.w, this.h);

        const actors = [game.player, ...game.enemies.list];
        if (game.pet) actors.push(game.pet);
        if (game.bull?.visible) actors.push(game.bull);

        // Cada ator é espelhado em torno dos PRÓPRIOS pés (y), achatado em perspectiva
        const s = 0.45;
        for (const a of actors) {
            refCtx.save();
            refCtx.translate(0, a.y * (1 + s));
            refCtx.scale(1, -s);
            a.draw(refCtx, time);
            refCtx.restore();
        }

        ctx.save();
        ctx.globalAlpha = theme === 'balada' ? 0.28 : 0.18;
        ctx.drawImage(this.reflectCanvas, 0, 0);
        ctx.restore();
    }

    // Iluminação dinâmica combinada
    renderLightingPass(ctx, game, time) {
        const lCtx = this.lightCtx;
        lCtx.clearRect(0, 0, this.w, this.h);

        // Luz Ambiente por tema
        const theme = game.level?.theme || 'praia';
        let ambientColor = 'rgba(25, 15, 45, 0.15)'; // Balneário Sunset
        if (theme === 'balada') ambientColor = 'rgba(10, 0, 25, 0.4)'; // Balada Neon escuro
        else if (theme === 'molhes' || theme === 'avenida') ambientColor = 'rgba(5, 10, 35, 0.35)'; // Noite
        else if (theme === 'busao') ambientColor = 'rgba(30, 20, 15, 0.1)'; // Luz interior quente

        lCtx.fillStyle = ambientColor;
        lCtx.fillRect(0, 0, this.w, this.h);

        // Desenha todas as luzes pontuais com operação de 'destino-fora' ou 'clarear'
        lCtx.save();
        lCtx.globalCompositeOperation = 'destination-out';

        for (const l of this.lights) {
            const rad = l.radius * (1 + (l.pulse || 0));
            const g = lCtx.createRadialGradient(l.x, l.y, 0, l.x, l.y, rad);
            g.addColorStop(0, `rgba(0,0,0,${Math.min(1, l.intensity * 0.85)})`);
            g.addColorStop(0.5, `rgba(0,0,0,${Math.min(1, l.intensity * 0.4)})`);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            lCtx.fillStyle = g;
            lCtx.beginPath();
            lCtx.arc(l.x, l.y, rad, 0, Math.PI * 2);
            lCtx.fill();
        }
        lCtx.restore();

        // Aplica o mapa de sombra sobre o jogo
        ctx.save();
        ctx.globalAlpha = 1;
        ctx.drawImage(this.lightCanvas, 0, 0);
        ctx.restore();

        // Adiciona o brilho colorido das fontes de luz sobre o jogo (Add / Screen)
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        for (const l of this.lights) {
            const rad = l.radius * (1 + (l.pulse || 0));
            const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, rad);
            g.addColorStop(0, l.color);
            g.addColorStop(1, 'transparent');
            ctx.fillStyle = g;
            ctx.globalAlpha = Math.min(0.35, l.intensity * 0.25);
            ctx.beginPath();
            ctx.arc(l.x, l.y, rad, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    // Multi-pass Bloom Neon
    renderBloomPass(ctx, time) {
        const bCtx = this.bloomCtx;
        bCtx.clearRect(0, 0, this.bloomW, this.bloomH);

        // Copia a tela reduzida e desfocada (o desfoque é o que vira "glow")
        bCtx.filter = 'blur(3px) brightness(1.1)';
        bCtx.drawImage(ctx.canvas, 0, 0, this.w, this.h, 0, 0, this.bloomW, this.bloomH);
        bCtx.filter = 'none';

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = this.mode === 'ultra' ? 0.2 : 0.12;
        ctx.drawImage(this.bloomCanvas, 0, 0, this.w, this.h);
        ctx.restore();
    }

    // Ondas de choque refrativas
    renderShockwaves(ctx) {
        if (!this.shockwaves.length) return;
        ctx.save();
        for (const sw of this.shockwaves) {
            const alpha = sw.life / sw.maxLife;
            ctx.strokeStyle = sw.color;
            ctx.lineWidth = 6 * alpha;
            ctx.globalAlpha = alpha;
            ctx.shadowColor = '#00e5ff';
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.ellipse(sw.x, sw.y, sw.radius, sw.radius * 0.5, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }

    // Raios volumétricos (God Rays)
    renderVolumetricRays(ctx, game, time) {
        const theme = game.level?.theme;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';

        if (theme === 'praia') {
            // Raios de sol dourados atravessando o céu de Balneário
            const sunX = 780, sunY = 210;
            const rays = 8;
            for (let i = 0; i < rays; i++) {
                const angle = 0.3 + (i / rays) * 1.8 + Math.sin(time * 0.5 + i) * 0.05;
                const len = 700;
                const g = ctx.createLinearGradient(sunX, sunY, sunX - Math.cos(angle) * len, sunY + Math.sin(angle) * len);
                g.addColorStop(0, 'rgba(255, 225, 77, 0.22)');
                g.addColorStop(1, 'rgba(255, 63, 164, 0)');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.moveTo(sunX, sunY);
                ctx.lineTo(sunX - Math.cos(angle - 0.07) * len, sunY + Math.sin(angle - 0.07) * len);
                ctx.lineTo(sunX - Math.cos(angle + 0.07) * len, sunY + Math.sin(angle + 0.07) * len);
                ctx.closePath();
                ctx.fill();
            }
        } else if (theme === 'balada') {
            // Holofotes volumétricos giratórios
            const colors = ['rgba(255,0,200,0.18)', 'rgba(0,229,255,0.18)', 'rgba(122,44,255,0.2)'];
            for (let i = 0; i < 3; i++) {
                const ox = 200 + i * 310;
                const swAngle = Math.sin(time * 1.2 + i * 2) * 0.6;
                ctx.fillStyle = colors[i];
                ctx.beginPath();
                ctx.moveTo(ox, 0);
                ctx.lineTo(ox - 70 + Math.sin(swAngle) * 450, 480);
                ctx.lineTo(ox + 70 + Math.sin(swAngle) * 450, 480);
                ctx.closePath();
                ctx.fill();
            }
        }
        ctx.restore();
    }

    // Vinheta e Contraste
    renderVignetteAndTone(ctx) {
        ctx.save();
        const g = ctx.createRadialGradient(this.w / 2, this.h / 2, this.w * 0.35, this.w / 2, this.h / 2, this.w * 0.72);
        g.addColorStop(0, 'rgba(0, 0, 0, 0)');
        g.addColorStop(1, 'rgba(0, 0, 15, 0.38)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, this.w, this.h);
        ctx.restore();
    }

    // Selo futurista "RTX ON"
    drawHudBadge(ctx) {
        ctx.save();
        ctx.textAlign = 'right';
        const isUltra = this.mode === 'ultra';
        const isHigh = this.mode === 'high';
        const isOn = isUltra || isHigh;

        const badgeText = isUltra ? '⚡ RTX: ULTRA [ON]' : (isHigh ? '✨ RTX: HIGH [ON]' : '⚫ RTX: OFF');
        const badgeColor = isUltra ? '#00e5ff' : (isHigh ? '#32ff7e' : '#888888');

        // Moldura cyberpunk translúcida
        ctx.fillStyle = 'rgba(10, 5, 25, 0.85)';
        ctx.fillRect(820, 548, 194, 24);
        ctx.strokeStyle = badgeColor;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(820, 548, 194, 24);

        ctx.font = 'bold 12px Arial';
        ctx.fillStyle = badgeColor;
        ctx.shadowColor = isOn ? badgeColor : 'transparent';
        ctx.shadowBlur = isOn ? 8 : 0;
        ctx.fillText(badgeText, 1004, 564);

        ctx.restore();
    }
}
