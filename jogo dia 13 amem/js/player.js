// Thiago "Cowboy" Beach: boné aba reta, corrente de ouro, camisa aberta.
// Coordenadas: x = horizontal, y = profundidade (chão), z = altura do pulo.

import { BONES } from './items.js';
import { SpriteRenderer } from './sprites.js';

export const GROUND_MIN = 380;
export const GROUND_MAX = 570;

// Combo de 3 socos: duração total, janela ativa do golpe, dano, alcance
const COMBO = [
    { dur: 0.22, active: [0.06, 0.13], dmg: 8, reach: 52, knock: 40 },
    { dur: 0.22, active: [0.06, 0.13], dmg: 9, reach: 55, knock: 50 },
    { dur: 0.42, active: [0.10, 0.20], dmg: 16, reach: 62, knock: 260, finisher: true },
];

let attackIdCounter = 0;
export const nextAttackId = () => ++attackIdCounter;

const LASSO_OUT = 0.18;    // tempo pro laço esticar todo

export class Player {
    constructor(x, y) {
        this.x = x; this.y = y; this.z = 0;
        this.vz = 0;
        this.facing = 1;
        this.hp = 100; this.maxHp = 100;
        this.speedX = 230; this.speedY = 150;
        this.state = 'idle'; // idle | walk | punch | jump | hurt | down
        this.stateTime = 0;
        this.comboStep = 0;
        this.comboWindow = 0;   // tempo pra encadear o próximo soco
        this.bufferedPunch = false;
        this.attackId = 0;
        this.invuln = 0;
        this.walkCycle = 0;
        // Laço
        this.lassoCd = 0; this.ropeLen = 0; this.lassoTarget = null;
        // Barra de Ostentação
        this.ostentacao = 0; this.maxOstentacao = 100;
        this.ostDelay = 0; // segundos até a barra começar a cair
        // Bonés
        this.bone = null; this.boneTime = 0;
        // Atributos que a lojinha melhora (ver profileStats em shop.js)
        this.dmgBonus = 1;
        this.lassoRange = 280;   // alcance do cordão de ouro
        this.ostDecay = 6;       // quanto a barra perde por segundo parada
        this.look = { shirt: ['#ff3fa4', '#ffe14d'], chain: '#ffd700' };
        this.rideBob = 0;        // balanço em cima do touro
        this.relics = new Set(); // itens colecionáveis (relics.js)
    }

    has(relic) { return this.relics.has(relic); }

    applyStats(st) {
        this.maxHp = st.maxHp;
        this.hp = st.maxHp;
        this.dmgBonus = st.dmgBonus;
        this.lassoRange = st.lassoRange;
        this.ostDecay = st.ostDecay;
        this.look = st.look;
        this.relics = st.relics;
    }

    setState(s) { this.state = s; this.stateTime = 0; }

    update(dt, held, pressed, game, minX, maxX) {
        this.stateTime += dt;
        this.invuln = Math.max(0, this.invuln - dt);
        this.comboWindow = Math.max(0, this.comboWindow - dt);
        if (this.comboWindow === 0 && this.state !== 'punch') this.comboStep = 0;
        this.lassoCd = Math.max(0, this.lassoCd - dt);
        // Garrafa de Chimarrão: regenera vida
        if (this.has('chimarrao') && this.hp > 0) this.hp = Math.min(this.maxHp, this.hp + dt * 0.6);
        if (this.bone) {
            this.boneTime -= dt;
            if (this.boneTime <= 0) this.bone = null;
        }

        // Ostentação cai com o tempo se você parar de bater
        this.ostDelay = Math.max(0, this.ostDelay - dt);
        if (this.ostDelay === 0) this.ostentacao = Math.max(0, this.ostentacao - this.ostDecay * dt);

        const dx = (held.right ? 1 : 0) - (held.left ? 1 : 0);
        const dy = (held.down ? 1 : 0) - (held.up ? 1 : 0);

        switch (this.state) {
            case 'idle':
            case 'walk':
                if (pressed.punch) { this.startPunch(); break; }
                if (pressed.special) {
                    if (this.ostentacao >= this.maxOstentacao) {
                        this.setState('special');
                        this.specialFired = false;
                        break;
                    }
                    game.audio.playSfx('denied');
                }
                if (pressed.lasso && this.lassoCd === 0) {
                    this.setState('lasso');
                    this.ropeLen = 0;
                    this.lassoTarget = null;
                    game.audio.playSfx('lasso');
                    break;
                }
                if (pressed.jump) { this.setState('jump'); this.vz = this.has('espora') ? 650 : 520; game.audio.playSfx('jump'); break; }
                if (dx) this.facing = dx;
                this.x += dx * this.speedX * dt;
                this.y += dy * this.speedY * dt;
                this.setState(dx || dy ? 'walk' : 'idle');
                if (dx || dy) this.walkCycle += dt * 10;
                break;

            case 'punch': {
                // Boné Turbinado: socos 60% mais rápidos
                if (this.bone === 'turbinado') this.stateTime += dt * 0.6;
                const p = COMBO[this.comboStep];
                if (pressed.punch) this.bufferedPunch = true;
                if (this.stateTime >= p.active[0] && this.stateTime <= p.active[1]) {
                    game.resolvePlayerAttack(this.hitbox(p));
                    // Chinelo Voador: o 3º soco arremessa um chinelo
                    if (this.comboStep === 2 && !this.chineloThrown && this.has('chinelo')) {
                        this.chineloThrown = true;
                        game.throwChinelo(this);
                    }
                }
                if (this.stateTime >= p.dur) {
                    if (this.bufferedPunch && this.comboStep < 2) {
                        this.comboStep++;
                        this.startPunch(true);
                    } else {
                        this.comboWindow = this.comboStep < 2 ? 0.3 : 0;
                        if (this.comboStep >= 2) this.comboStep = 0;
                        this.setState('idle');
                    }
                }
                break;
            }

            case 'jump':
                // No ar: mantém controle horizontal, soco vira chute aéreo
                this.x += dx * this.speedX * 0.9 * dt;
                if (dx) this.facing = dx;
                this.vz -= 1500 * dt;
                this.z = Math.max(0, this.z + this.vz * dt);
                if (pressed.punch && !this.airAttack) {
                    this.airAttack = true;
                    this.attackId = ++attackIdCounter;
                    game.audio.playSfx('whoosh');
                }
                if (this.airAttack) {
                    game.resolvePlayerAttack(this.hitbox({ dmg: this.has('espora') ? 28 : 14, reach: 58, knock: 220, finisher: true, air: true }));
                }
                if (this.z === 0 && this.stateTime > 0.05) {
                    this.airAttack = false;
                    this.setState('idle');
                }
                break;

            case 'lasso':
                if (this.lassoTarget) {
                    // Puxando: o cordão acompanha o inimigo até ele chegar
                    this.ropeLen = Math.abs(this.lassoTarget.x - this.x);
                    if (this.lassoTarget.state !== 'pulled') this.endLasso();
                } else if (this.stateTime < LASSO_OUT) {
                    // Esticando: pega o primeiro inimigo que o cordão alcançar
                    this.ropeLen = this.lassoRange * this.stateTime / LASSO_OUT;
                    this.lassoTarget = game.lassoCatch(this, this.ropeLen);
                } else {
                    // Errou: recolhe o cordão
                    this.ropeLen = Math.max(0, this.lassoRange * (1 - (this.stateTime - LASSO_OUT) / 0.2));
                    if (this.ropeLen === 0) this.endLasso();
                }
                break;

            case 'special':
                // Camarote Premium: invencível durante a animação
                this.invuln = Math.max(this.invuln, 0.2);
                if (!this.specialFired && this.stateTime >= 0.3) {
                    this.specialFired = true;
                    game.camaroteBlast(this);
                }
                if (this.stateTime > 0.9) this.setState('idle');
                break;

            case 'bull':
                // Quem controla a posição é o touro (bull.js)
                break;

            case 'hurt':
                if (this.stateTime > 0.3) this.setState('idle');
                break;

            case 'down':
                this.z = Math.max(0, this.z + this.vz * dt);
                this.vz -= 1500 * dt;
                this.x -= this.facing * 120 * dt * Math.max(0, 1 - this.stateTime * 2);
                if (this.stateTime > 1.0 && this.hp > 0) {
                    this.invuln = 1.2;
                    this.setState('idle');
                }
                break;
        }

        this.x = Math.max(minX, Math.min(maxX, this.x));
        this.y = Math.max(GROUND_MIN, Math.min(GROUND_MAX, this.y));
    }

    startPunch(chained = false) {
        if (!chained) this.comboStep = this.comboWindow > 0 ? Math.min(2, this.comboStep + 1) : 0;
        this.bufferedPunch = false;
        this.chineloThrown = false;
        this.attackId = ++attackIdCounter;
        this.setState('punch');
    }

    endLasso() {
        this.lassoTarget = null;
        this.ropeLen = 0;
        this.lassoCd = 0.5;
        this.setState('idle');
    }

    // Dano extra conforme a barra: vazia = x1, cheia = x2
    get damageMult() { return (1 + this.ostentacao / this.maxOstentacao) * this.dmgBonus; }

    addOstentacao(amount) {
        const wasFull = this.ostentacao >= this.maxOstentacao;
        this.ostentacao = Math.min(this.maxOstentacao, this.ostentacao + amount);
        const full = this.ostentacao >= this.maxOstentacao;
        // Barra cheia segura mais tempo, pra dar chance de usar o especial
        this.ostDelay = full ? 4 : 1.5;
        return full && !wasFull;
    }

    hitbox(p) {
        const x1 = this.facing > 0 ? this.x + 5 : this.x - p.reach;
        return {
            id: this.attackId, x1, x2: x1 + p.reach - 5, y: this.y, z: this.z,
            dmg: p.dmg, knock: p.knock, finisher: !!p.finisher, air: !!p.air, dir: this.facing,
        };
    }

    // Chamado pelos inimigos
    hurt(dmg, dir, game, knockdown = false) {
        if (this.invuln > 0 || this.state === 'down' || this.state === 'bull') return false;
        // Boné Blindado: metade do dano
        if (this.bone === 'blindado') dmg = Math.ceil(dmg / 2);
        this.hp = Math.max(0, this.hp - dmg);
        this.facing = -dir;
        this.airAttack = false;
        this.lassoTarget = null;
        this.ropeLen = 0;
        // Apanhar é feio: perde um pouco da ostentação
        this.ostentacao = Math.max(0, this.ostentacao - 15);
        game.audio.playSfx('hurt');
        game.live?.onHurt(game);
        if (knockdown || this.hp <= 0 || this.z > 0) {
            this.setState('down');
            this.vz = 300;
        } else {
            this.setState('hurt');
            this.invuln = 0.5;
            this.x += dir * 18;
        }
        return true;
    }

    drawShadow(ctx) {
        const s = Math.max(0.5, 1 - this.z / 300);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, 22 * s, 7 * s, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    draw(ctx, time) {
        // Pisca durante invencibilidade
        if (this.invuln > 0 && Math.floor(time * 20) % 2 === 0) return;

        ctx.save();
        ctx.translate(Math.round(this.x), Math.round(this.y - this.z));
        ctx.scale(this.facing, 1);

        if (this.state === 'down') {
            // Deitado no chão
            ctx.rotate(-Math.PI / 2 * Math.min(1, this.stateTime * 4));
        }

        // Montado no touro: sobe e balança junto
        if (this.state === 'bull') ctx.translate(0, -40 - this.rideBob);

        // Desenha o personagem com sprites em alta resolução e efeitos de iluminação
        SpriteRenderer.drawThiago(ctx, this, time);

        // Aura dourada do especial
        if (this.state === 'special') {
            const r = 30 + this.stateTime * 120;
            ctx.strokeStyle = `rgba(255,215,0,${Math.max(0, 1 - this.stateTime)})`;
            ctx.lineWidth = 6;
            ctx.shadowColor = '#ffd700';
            ctx.shadowBlur = 18;
            ctx.beginPath();
            ctx.arc(0, -50, r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
            // Notas de dinheiro voando ao redor
            ctx.fillStyle = '#32ff7e';
            ctx.fillRect(-22, -112 - Math.sin(this.stateTime * 20) * 8, 16, 9);
            ctx.fillRect(10, -112 + Math.sin(this.stateTime * 20) * 8, 16, 9);
        }

        // Cordão de ouro (laço esticado)
        if (this.state === 'lasso' && this.ropeLen > 0) {
            const tipY = this.lassoTarget ? -56 + (this.lassoTarget.y - this.y) : -56;
            const len = this.ropeLen - (this.lassoTarget ? 15 : 0);
            ctx.strokeStyle = '#ffd700';
            ctx.shadowColor = '#ffd700';
            ctx.shadowBlur = 8;
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.moveTo(18, -56);
            for (let i = 1; i <= 10; i++) {
                const f = i / 10;
                const wave = this.lassoTarget ? 0 : Math.sin(f * 12 + time * 30) * 4 * (1 - f);
                ctx.lineTo(18 + (len - 18) * f, -56 + (tipY + 56) * f + wave);
            }
            ctx.stroke();
            // Argola na ponta
            ctx.beginPath();
            ctx.ellipse(len + 8, tipY, 12, 16, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        if (this.state === 'hurt') {
            ctx.fillStyle = '#ff1744';
            ctx.font = 'bold 15px Arial';
            ctx.fillText('AI!', -10, -106);
        }
        ctx.restore();
    }
}
