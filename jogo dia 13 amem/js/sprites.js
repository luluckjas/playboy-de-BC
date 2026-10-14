// Sistema avançado de sprites e renderização artística em alta fidelidade
// Suporta corte inteligente de spritesheets (com remoção de fundo/chroma-key)
// e fallback com renderização procedural de alta densidade (HD pixel-art).

class SpriteLoader {
    constructor() {
        this.images = {};
        this.canvases = {};
        this.loaded = false;
        this.loadAssets();
    }

    loadAssets() {
        const assets = {
            banner: 'assets/hero_banner.jpg',
            thiago: 'assets/thiago_sprites.jpg',
            enemies: 'assets/enemy_sprites.jpg',
            bosses: 'assets/boss_sprites.jpg',
            bullAndItems: 'assets/bull_and_items.jpg',
        };

        let pending = Object.keys(assets).length;
        for (const [key, src] of Object.entries(assets)) {
            const img = new Image();
            img.onload = () => {
                this.images[key] = img;
                this.processChromaKey(key, img);
                pending--;
                if (pending === 0) {
                    this.loaded = true;
                    console.log('Todos os sprites carregados com sucesso!');
                }
            };
            img.onerror = (e) => {
                console.warn(`Aviso ao carregar ${src}, usando renderizador vetorial procedural`, e);
                pending--;
                if (pending === 0) this.loaded = true;
            };
            img.src = src;
        }
    }

    // Processa a imagem para remover o fundo cinza/grade das spritesheets
    processChromaKey(key, img) {
        if (key === 'banner') return; // Banner mantém fundo original

        try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imgData.data;

            // Detecta a cor de fundo predominante nos cantos superiores
            const r0 = data[0], g0 = data[1], b0 = data[2];

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i], g = data[i + 1], b = data[i + 2];
                // Distância da cor de fundo (geralmente cinza escuro ou azul escuro)
                const d = Math.abs(r - r0) + Math.abs(g - g0) + Math.abs(b - b0);
                // Também remove fundos cinzas neutros de grid típicos (#202028 - #4a5568)
                const isGrid = Math.abs(r - g) < 15 && Math.abs(g - b) < 15 && r > 25 && r < 75;
                const isDarkBg = r < 35 && g < 35 && b < 40;

                if (d < 38 || isGrid || isDarkBg) {
                    data[i + 3] = 0; // Transparente
                } else if (d < 55) {
                    data[i + 3] = Math.round(data[i + 3] * ((d - 38) / 17));
                }
            }

            ctx.putImageData(imgData, 0, 0);
            this.canvases[key] = canvas;
        } catch (e) {
            console.warn('CORS ou erro ao processar chroma key, usando imagem direta', e);
            this.canvases[key] = img;
        }
    }

    getCanvas(key) {
        return this.canvases[key] || this.images[key] || null;
    }
}

export const spriteLoader = new SpriteLoader();

// ---------- RENDERIZADORES DE SPRITES E DETALHES DE ALTA QUALIDADE ----------

export class SpriteRenderer {
    static drawThiago(ctx, player, time) {
        const spr = spriteLoader.getCanvas('thiago');
        const state = player.state;
        const p = player;
        const look = p.look || { shirt: ['#ff3fa4', '#ffe14d'], chain: '#ffd700' };

        // Se a spritesheet foi carregada, recortamos os frames correspondentes
        if (spr && spriteLoader.loaded) {
            // Mapeamento de coordenadas na spritesheet thiago_sprites.jpg (1024x1024)
            let sx = 20, sy = 40, sw = 100, sh = 185;
            let drawW = 68, drawH = 115;
            let ox = -drawW / 2, oy = -drawH;

            if (state === 'idle') {
                const f = Math.floor(time * 6) % 6;
                sx = 25 + f * 105; sy = 40; sw = 95; sh = 185;
            } else if (state === 'walk') {
                const f = Math.floor(p.walkCycle) % 6;
                sx = 25 + f * 105; sy = 40; sw = 95; sh = 185;
                oy += Math.sin(p.walkCycle * 2) * 3;
            } else if (state === 'punch') {
                const step = p.comboStep || 0;
                const animT = p.stateTime;
                if (step === 0) { sx = 25; sy = 280; sw = 150; sh = 150; drawW = 95; drawH = 110; }
                else if (step === 1) { sx = 175; sy = 280; sw = 150; sh = 150; drawW = 95; drawH = 110; }
                else { sx = 410; sy = 280; sw = 160; sh = 150; drawW = 110; drawH = 110; }
                ox = -30;
            } else if (state === 'jump') {
                if (p.airAttack) { sx = 690; sy = 270; sw = 150; sh = 160; drawW = 100; drawH = 110; }
                else { sx = 550; sy = 270; sw = 130; sh = 160; drawW = 90; drawH = 110; }
            } else if (state === 'lasso') {
                const f = Math.floor(time * 8) % 4;
                sx = 20 + f * 160; sy = 550; sw = 160; sh = 180; drawW = 110; drawH = 120;
                ox = -45;
            } else if (state === 'special') {
                const f = Math.floor(time * 10) % 3;
                sx = 25 + f * 150; sy = 820; sw = 145; sh = 180; drawW = 100; drawH = 120;
            } else if (state === 'hurt' || state === 'down') {
                sx = 870; sy = 290; sw = 110; sh = 170; drawW = 75; drawH = 110;
            }

            // Desenha a sprite base
            ctx.save();
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(spr, sx, sy, sw, sh, ox, oy, drawW, drawH);

            // Shaders / Efeitos de alta fidelidade sobre a sprite:
            // 1. Brilho metálico da Corrente de Ouro e Relógio
            const glint = Math.sin(time * 8) * 0.5 + 0.5;
            ctx.fillStyle = look.chain || '#ffd700';
            ctx.shadowColor = '#ffd700';
            ctx.shadowBlur = 8 * glint;
            ctx.fillRect(ox + drawW * 0.46, oy + drawH * 0.42, 4, 4);

            // 2. Óculos Juliet polarizado arco-íris
            const jHue = (time * 120) % 360;
            ctx.fillStyle = `hsl(${jHue}, 100%, 65%)`;
            ctx.shadowColor = `hsl(${jHue}, 100%, 50%)`;
            ctx.shadowBlur = 6;
            ctx.fillRect(ox + drawW * 0.52, oy + drawH * 0.23, 7, 3);
            ctx.restore();
            return;
        }

        // Fallback procedural em altíssima definição caso a imagem ainda esteja carregando
        this.drawProceduralThiago(ctx, player, time);
    }

    // Thiago renderizado com múltiplos gradientes, tecidos, sombra e reflexos
    static drawProceduralThiago(ctx, player, time) {
        const walking = player.state === 'walk';
        const leg = walking ? Math.sin(player.walkCycle) * 10 : 0;
        const bob = player.state === 'idle' ? Math.sin(time * 5) * 2 : 0;
        const look = player.look || { shirt: ['#ff3fa4', '#ffe14d'], chain: '#ffd700' };

        // Pernas (Bermuda jeans destroyed com rasgos + Tênis Nike Air dourado)
        ctx.fillStyle = '#1e3c72';
        ctx.fillRect(-12 + leg, -36, 11, 26);
        ctx.fillRect(3 - leg, -36, 11, 26);
        // Rasgos do jeans
        ctx.fillStyle = '#4a90e2';
        ctx.fillRect(-10 + leg, -26, 7, 2);
        ctx.fillRect(5 - leg, -24, 7, 2);

        // Tênis estiloso com amortecedor visível
        ctx.fillStyle = '#111';
        ctx.fillRect(-15 + leg, -12, 16, 12);
        ctx.fillRect(1 - leg, -12, 16, 12);
        ctx.fillStyle = '#ffd700'; // Detalhe ouro no sneaker
        ctx.fillRect(-14 + leg, -10, 14, 4);
        ctx.fillRect(2 - leg, -10, 14, 4);
        ctx.fillStyle = '#00e5ff'; // Bolha de ar neon
        ctx.fillRect(-13 + leg, -4, 12, 3);
        ctx.fillRect(3 - leg, -4, 12, 3);

        ctx.translate(0, bob);

        // Tronco definido (tan tanquinho)
        const skinGrad = ctx.createLinearGradient(0, -70, 0, -36);
        skinGrad.addColorStop(0, '#f2b588');
        skinGrad.addColorStop(1, '#d8905e');
        ctx.fillStyle = skinGrad;
        ctx.fillRect(-13, -70, 26, 36);

        // Músculos do abdômen e peitoral
        ctx.fillStyle = 'rgba(160, 80, 40, 0.35)';
        ctx.fillRect(-6, -64, 12, 2); // Linha do peito
        ctx.fillRect(-1, -64, 2, 26);  // Linha central
        ctx.fillRect(-5, -56, 10, 2); // Gomo 1
        ctx.fillRect(-5, -48, 10, 2); // Gomo 2

        // Camisa floral aberta (com gradientes e estampas vivas)
        const shirtL = ctx.createLinearGradient(-18, -70, -7, -34);
        shirtL.addColorStop(0, look.shirt[0]);
        shirtL.addColorStop(1, '#ff1744');
        ctx.fillStyle = shirtL;
        ctx.fillRect(-17, -70, 10, 36);
        ctx.fillRect(7, -70, 10, 36);

        // Flores da estampa havaiana
        ctx.fillStyle = look.shirt[1];
        for (const [fx, fy] of [[-14, -62], [-12, -46], [10, -60], [12, -42]]) {
            ctx.beginPath();
            ctx.arc(fx, fy, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // Corrente de Ouro grossa com pingente de cifrão reluzente
        ctx.strokeStyle = look.chain;
        ctx.lineWidth = 3.5;
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(0, -68, 10, 0.2, Math.PI - 0.2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        // Pingente cifrão $
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 9px Arial';
        ctx.fillText('$', -3, -54);

        // Braço e relógio dourado
        let armLen = 16;
        if (player.state === 'punch') armLen = 32;
        if (player.state === 'jump' && player.airAttack) armLen = 30;
        ctx.fillStyle = '#e5a574';
        ctx.fillRect(5, -64, armLen, 10);
        // Relógio Rolex dourado
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(armLen - 3, -65, 5, 12);
        ctx.fillStyle = '#00e5ff'; // Mostrador esmeralda/ciano
        ctx.fillRect(armLen - 2, -63, 3, 8);
        // Mão fechada
        ctx.fillStyle = '#d8905e';
        ctx.fillRect(armLen + 2, -66, 9, 13);

        // Cabeça e rosto
        ctx.fillStyle = '#f2b588';
        ctx.fillRect(-11, -92, 22, 24);
        // Barba estilizada e sorriso
        ctx.fillStyle = '#3a2010';
        ctx.fillRect(-8, -74, 16, 4);
        ctx.fillStyle = '#fff';
        ctx.fillRect(1, -73, 5, 2); // Dentes brilhando

        // Óculos Juliet com lentes polarizadas iridescentes
        const jHue = (time * 100) % 360;
        ctx.fillStyle = '#111';
        ctx.fillRect(-4, -86, 17, 7); // Armação plasma
        ctx.fillStyle = `hsl(${jHue}, 100%, 60%)`;
        ctx.shadowColor = `hsl(${jHue}, 100%, 50%)`;
        ctx.shadowBlur = 5;
        ctx.fillRect(-2, -85, 6, 5);
        ctx.fillRect(6, -85, 6, 5);
        ctx.shadowBlur = 0;

        // Boné aba reta personalizado
        const capColor = player.bone ? '#32ff7e' : '#7a2cff';
        ctx.fillStyle = capColor;
        ctx.fillRect(-13, -100, 26, 12);
        // Aba reta estilizada
        ctx.fillStyle = '#00e5ff';
        ctx.fillRect(4, -92, 22, 4);
        // Logomarca frontal do boné
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 7px Arial';
        ctx.fillText('BC', -9, -92);
    }

    // Desenha inimigos usando as spritesheets com chroma-key ou fallback enriquecido
    static drawEnemy(ctx, e, time) {
        const spr = spriteLoader.getCanvas('enemies');
        const ai = e.t.ai;
        const state = e.state;

        if (spr && spriteLoader.loaded && !e.t.boss) {
            let rowY = 0;
            if (e.type === 'cowboy') rowY = 40;
            else if (e.type === 'sertanejo') rowY = 240;
            else if (e.type === 'peao') rowY = 445;
            else if (e.type === 'seguranca') rowY = 665;

            let colX = 25;
            let drawW = 75, drawH = 115;
            let ox = -drawW / 2, oy = -drawH;

            if (state === 'approach') {
                const f = Math.floor(e.walkCycle) % 5;
                colX = 25 + f * 98;
            } else if (state === 'attack' || state === 'windup') {
                colX = 520;
            } else if (state === 'hurt' || state === 'pulled' || state === 'stunned') {
                colX = 770;
            } else if (state === 'down' || state === 'dead') {
                colX = 890;
            }

            ctx.save();
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(spr, colX, rowY, 95, 175, ox, oy, drawW, drawH);
            ctx.restore();
            return;
        }

        // Fallback procedural HD com texturas
        this.drawProceduralEnemy(ctx, e, time);
    }

    static drawProceduralEnemy(ctx, e, time) {
        const L = e.t.look;
        const charging = (e.t.ai === 'charge' && (e.state === 'attack' || e.state === 'windup'));
        const leg = (e.state === 'approach' || charging) ? Math.sin(e.walkCycle) * 8 : 0;

        // Botas e calça com costuras
        ctx.fillStyle = L.jeans;
        ctx.fillRect(-12 + leg, -38, 10, 28);
        ctx.fillRect(3 - leg, -38, 10, 28);
        ctx.fillStyle = L.suit ? '#111' : '#4e2710';
        ctx.fillRect(-14 + leg, -14, 13, 14);
        ctx.fillRect(2 - leg, -14, 13, 14);

        // Fivelona de ouro
        ctx.fillStyle = '#221105';
        ctx.fillRect(-14, -42, 28, 6);
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(-5, -44, 10, 9);

        // Tronco
        ctx.fillStyle = L.shirt;
        ctx.fillRect(-14, -72, 28, 32);
        if (L.vest) {
            ctx.fillStyle = L.vest;
            ctx.fillRect(-14, -72, 9, 32);
            ctx.fillRect(5, -72, 9, 32);
        } else if (L.suit) {
            ctx.fillStyle = '#fff';
            ctx.fillRect(-3, -72, 6, 16);
            ctx.fillStyle = '#e53935';
            ctx.fillRect(-1, -70, 3, 18);
        }

        // Braço
        let arm = 14, armY = -66;
        if (e.state === 'windup') arm = 4;
        if (e.state === 'attack') arm = 32;
        ctx.fillStyle = L.shirt;
        ctx.fillRect(2, armY, arm, 9);
        ctx.fillStyle = L.skin;
        ctx.fillRect(arm + 1, armY - 1, 9, 11);

        // Garrafa de cerveja (para o Sertanejo)
        if (L.bottle && e.state !== 'attack') {
            ctx.fillStyle = '#1b5e20';
            ctx.fillRect(arm + 3, armY - 16, 6, 18);
            ctx.fillStyle = '#ffd700'; // Rótulo
            ctx.fillRect(arm + 3, armY - 10, 6, 6);
        }

        // Cabeça
        ctx.fillStyle = L.skin;
        ctx.fillRect(-10, -92, 20, 22);
        ctx.fillStyle = '#111';
        if (L.shades) ctx.fillRect(-3, -86, 14, 6);
        else ctx.fillRect(4, -86, 4, 4);
        if (L.mustache) {
            ctx.fillStyle = '#2b1608';
            ctx.fillRect(0, -78, 12, 4);
        }
        if (L.bandana) {
            ctx.fillStyle = '#d32f2f';
            ctx.beginPath();
            ctx.moveTo(-10, -74); ctx.lineTo(10, -74); ctx.lineTo(0, -62);
            ctx.fill();
        }

        // Chapéu de cowboy estilizado
        if (L.hat) {
            ctx.fillStyle = L.hat;
            ctx.fillRect(-22, -94, 44, 6);
            ctx.fillRect(-12, -108, 24, 15);
            ctx.fillStyle = '#ffd700'; // Faixa dourada no chapéu
            ctx.fillRect(-12, -96, 24, 3);
        }
    }

    // Desenha Chefes usando a spritesheet de Bosses ou fallback
    static drawBoss(ctx, boss, time) {
        const spr = spriteLoader.getCanvas('bosses');
        if (spr && spriteLoader.loaded) {
            let rowY = 50;
            if (boss.type === 'dj') rowY = 50;
            else if (boss.type === 'tiozao') rowY = 430;
            else if (boss.type === 'capataz') rowY = 720;

            let colX = 40;
            if (boss.state === 'approach') {
                const f = Math.floor(boss.walkCycle) % 3;
                colX = 40 + f * 170;
            } else if (boss.state === 'attack' || boss.state === 'move') {
                colX = 420;
            } else if (boss.state === 'hurt' || boss.flash > 0) {
                colX = 720;
            } else if (boss.state === 'down' || boss.state === 'dead') {
                colX = 860;
            }

            ctx.save();
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(spr, colX, rowY, 150, 190, -55, -135, 110, 140);
            ctx.restore();
            return;
        }

        this.drawProceduralEnemy(ctx, boss, time);
    }

    // Desenha o Touro Mecânico AGRO-3000 ultra tecnológico
    static drawBull(ctx, bull, time) {
        const spr = spriteLoader.getCanvas('bullAndItems');
        const moving = bull.state === 'riding' || bull.state === 'thrown';
        const lift = -bull.buck;

        if (spr && spriteLoader.loaded) {
            ctx.save();
            ctx.imageSmoothingEnabled = false;
            // Coordenadas do Touro no spritesheet: 120, 120, 680, 360
            const drawW = 150, drawH = 95;
            ctx.drawImage(spr, 70, 100, 750, 400, -75, -85 + lift, drawW, drawH);

            // Adiciona efeitos dinâmicos de luz RTX nos olhos e canos de escape
            const eyeGlow = Math.floor(time * 6) % 2 || moving ? '#ff1744' : '#7f0000';
            ctx.fillStyle = eyeGlow;
            ctx.shadowColor = '#ff1744';
            ctx.shadowBlur = 12;
            ctx.fillRect(40, -56 + lift, 7, 5);

            // Chamas do escapamento traseiro
            if (moving) {
                ctx.fillStyle = '#ff9100';
                ctx.shadowColor = '#ff3d00';
                ctx.shadowBlur = 15;
                const flLen = 15 + Math.random() * 20;
                ctx.beginPath();
                ctx.moveTo(-60, -42 + lift);
                ctx.lineTo(-60 - flLen, -45 + lift + (Math.random() - 0.5) * 8);
                ctx.lineTo(-60, -38 + lift);
                ctx.fill();
            }
            ctx.restore();
            return;
        }

        // Procedural HD caso a spritesheet esteja carregando
        this.drawProceduralBull(ctx, bull, time, moving, lift);
    }

    static drawProceduralBull(ctx, bull, time, moving, lift) {
        const leg = moving ? Math.sin(bull.t * 22) * 8 : 0;

        // Pernas cromadas com pistões articulados
        const metalGrad = ctx.createLinearGradient(-35, -30, 35, 0);
        metalGrad.addColorStop(0, '#78909c');
        metalGrad.addColorStop(0.5, '#cfd8dc');
        metalGrad.addColorStop(1, '#546e7a');

        ctx.fillStyle = metalGrad;
        ctx.fillRect(-32 + leg, -30 + lift, 9, 30);
        ctx.fillRect(-16 - leg, -30 + lift, 9, 30);
        ctx.fillRect(14 + leg, -30 + lift, 9, 30);
        ctx.fillRect(28 - leg, -30 + lift, 9, 30);

        // Cascos de aço reforçado
        ctx.fillStyle = '#263238';
        for (const lx of [-32, -16, 14, 28]) ctx.fillRect(lx - 2, -4, 13, 5);

        // Corpo cilíndrico metálico brilhante
        ctx.fillStyle = metalGrad;
        ctx.beginPath();
        ctx.ellipse(0, -46 + lift, 46, 22, 0, 0, Math.PI * 2);
        ctx.fill();

        // Placa dourada AGRO-3000 com LED
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(-18, -48 + lift, 36, 12);
        ctx.fillStyle = '#111';
        ctx.font = 'bold 8px Arial';
        ctx.fillText('AGRO-3000', -16, -39 + lift);

        // Cabeça com chifres cromados afiados
        ctx.fillStyle = '#37474f';
        ctx.fillRect(36, -64 + lift, 25, 24);
        ctx.fillStyle = '#eceff1';
        ctx.beginPath();
        ctx.moveTo(40, -64 + lift); ctx.lineTo(30, -82 + lift); ctx.lineTo(46, -64 + lift);
        ctx.moveTo(52, -64 + lift); ctx.lineTo(64, -82 + lift); ctx.lineTo(58, -64 + lift);
        ctx.fill();

        // Olhos de LED vermelho intenso
        ctx.fillStyle = Math.floor(time * 6) % 2 || moving ? '#ff1744' : '#b71c1c';
        ctx.shadowColor = '#ff1744';
        ctx.shadowBlur = 10;
        ctx.fillRect(50, -58 + lift, 6, 5);
        ctx.shadowBlur = 0;

        // Escapamentos duplos cromados soltando fogo
        ctx.fillStyle = '#455a64';
        ctx.fillRect(-48, -46 + lift, 14, 6);
        ctx.fillRect(-48, -38 + lift, 14, 6);
        if (moving) {
            ctx.fillStyle = '#ff6d00';
            ctx.fillRect(-62, -45 + lift, 12, 4);
            ctx.fillRect(-64, -37 + lift, 14, 4);
        }
    }

    // Desenha o mascote Cachorro Caramelo
    static drawCaramelo(ctx, dog, time) {
        const spr = spriteLoader.getCanvas('enemies');
        const moving = Math.abs(dog.facing) > 0;

        if (spr && spriteLoader.loaded) {
            ctx.save();
            ctx.imageSmoothingEnabled = false;
            // Pega a linha do Caramelo (y: 890 a 980)
            const f = Math.floor(dog.run) % 4;
            const colX = 130 + f * 95;
            ctx.drawImage(spr, colX, 900, 90, 75, -28, -26, 56, 38);
            ctx.restore();
            return;
        }

        // Procedural
        const leg = Math.sin(dog.run) * 4;
        ctx.fillStyle = '#c47a2c';
        ctx.fillRect(-15 + leg, -10, 5, 10); ctx.fillRect(-7 - leg, -10, 5, 10);
        ctx.fillRect(7 + leg, -10, 5, 10); ctx.fillRect(14 - leg, -10, 5, 10);
        ctx.fillStyle = '#d98b3a';
        ctx.fillRect(-18, -24, 38, 15);                      // corpo
        ctx.fillRect(16, -34, 16, 15);                       // cabeça
        ctx.fillStyle = '#8d5524';
        ctx.fillRect(16, -38, 6, 8);                         // orelha caída
        ctx.fillStyle = '#111';
        ctx.fillRect(26, -31, 4, 4);                         // olho esperto
        ctx.fillRect(30, -25, 4, 4);                         // focinho
        // Rabo abanando
        ctx.strokeStyle = '#d98b3a';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(-18, -22);
        ctx.lineTo(-28, -32 + Math.sin(time * 20) * 6);
        ctx.stroke();
    }

    // Desenha itens colecionáveis e pickups com brilhos e partículas
    static drawPickup(ctx, p, time) {
        const spr = spriteLoader.getCanvas('bullAndItems');

        if (spr && spriteLoader.loaded) {
            ctx.save();
            ctx.imageSmoothingEnabled = false;
            if (p.kind === 'pix') {
                // Maço de 100 Reais com brilho verde neon
                ctx.shadowColor = '#00e676';
                ctx.shadowBlur = 10;
                ctx.drawImage(spr, 280, 530, 180, 180, -18, -18, 36, 36);
                ctx.shadowBlur = 0;
            } else if (p.kind === 'queijo') {
                // Espeto de Queijo Coalho tostado
                ctx.shadowColor = '#ff9800';
                ctx.shadowBlur = 8;
                ctx.drawImage(spr, 25, 520, 200, 200, -16, -24, 32, 40);
                ctx.shadowBlur = 0;
            } else {
                // Bonés Neon
                let cx = 500;
                if (p.kind === 'blindado') cx = 665;
                if (p.kind === 'turbinado') cx = 820;
                ctx.shadowColor = p.kind === 'turbinado' ? '#ff1744' : (p.kind === 'blindado' ? '#90caf9' : '#00e676');
                ctx.shadowBlur = 12;
                ctx.drawImage(spr, cx, 570, 150, 130, -18, -16, 36, 32);
                ctx.shadowBlur = 0;
            }
            ctx.restore();
            return;
        }

        // Procedural
        if (p.kind === 'pix') {
            ctx.fillStyle = '#00e676';
            ctx.shadowColor = '#00e676';
            ctx.shadowBlur = 8;
            ctx.fillRect(-14, -14, 28, 14);
            ctx.fillStyle = '#004d40';
            ctx.font = 'bold 9px Arial';
            ctx.fillText('R$ PIX', -12, -4);
            ctx.shadowBlur = 0;
        } else if (p.kind === 'queijo') {
            ctx.fillStyle = '#795548';
            ctx.fillRect(-1, -4, 3, 24);
            ctx.fillStyle = '#ffe082';
            ctx.fillRect(-8, -24, 16, 22);
            ctx.fillStyle = '#d7ccc8';
            ctx.fillRect(-8, -18, 16, 3);
            ctx.fillRect(-8, -10, 16, 3);
        } else {
            ctx.fillStyle = '#00e5ff';
            ctx.beginPath();
            ctx.arc(0, -10, 14, Math.PI, 0);
            ctx.fill();
            ctx.fillRect(0, -10, 18, 4);
        }
    }
}
