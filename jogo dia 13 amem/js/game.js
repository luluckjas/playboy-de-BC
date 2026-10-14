import { Player, nextAttackId, GROUND_MIN, GROUND_MAX } from './player.js';
import { EnemyManager, ENEMY_TYPES } from './enemies.js';
import { FLOOR_COUNT, FLOORS, drawBackground, drawOverlay } from './levels.js';
import { Floor, ENTRY, OPPOSITE } from './floor.js';
import { BONES, BONE_KEYS, BONE_DURATION } from './items.js';
import { EventManager } from './world.js';
import { Live } from './live.js';
import { Shop, newProfile, profileStats, UPGRADES } from './shop.js';
import { RELICS, RELIC_KEYS, Caramelo, drawRelicIcons } from './relics.js';
import { UI } from './ui.js';
import { RtxEngine } from './shaders.js';

export const VIEW_W = 1024;
export const VIEW_H = 600;

// Mapa de teclas -> ações (aceita maiúsculas/minúsculas)
const KEYMAP = {
    arrowleft: 'left', a: 'left',
    arrowright: 'right', d: 'right',
    arrowup: 'up', w: 'up',
    arrowdown: 'down', s: 'down',
    j: 'punch', k: 'lasso', l: 'jump', ' ': 'special',
    enter: 'start', m: 'mute', r: 'rtx',
    1: 'lvl1', 2: 'lvl2', 3: 'lvl3', 4: 'lvl4', 5: 'lvl5', 6: 'lvl6',
};

const pick = arr => arr[Math.floor(Math.random() * arr.length)];

export class Game {
    constructor(canvas, ctx, audio) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.audio = audio;
        this.ui = new UI();
        this.shop = new Shop();
        this.rtx = new RtxEngine(VIEW_W, VIEW_H);
        this.state = 'menu'; // menu | playing | shop | levelClear | gameOver | victory
        this.held = {};      // ações seguradas
        this.pressed = {};   // ações apertadas neste frame
        this.lastTime = 0;
        this.time = 0;
        this.setupInput();
    }

    setupInput() {
        window.addEventListener('keydown', (e) => {
            const action = KEYMAP[e.key.toLowerCase()];
            if (!action) return;
            e.preventDefault();
            this.audio.resume(); // navegador só libera áudio após interação
            if (!this.held[action]) this.pressed[action] = true;
            this.held[action] = true;
        });
        window.addEventListener('keyup', (e) => {
            const action = KEYMAP[e.key.toLowerCase()];
            if (action) this.held[action] = false;
        });
        window.addEventListener('blur', () => { this.held = {}; });
    }

    newGame(num = 1) {
        this.ui.reset();
        this.profile = newProfile();   // upgrades e roupas compradas
        this.live = new Live();        // seguidores duram o jogo todo
        this.startFloor(num);
    }

    // hp = null começa com a vida cheia
    startFloor(num, hp = null) {
        this.levelNum = num;
        this.level = new Floor(num);
        this.player = new Player(ENTRY.down.x, 475);
        this.player.applyStats(profileStats(this.profile));
        if (hp !== null) this.player.hp = Math.min(hp, this.player.maxHp);
        this.enemies = new EnemyManager();
        this.events = new EventManager(this.level);
        this.live.newLevel();
        this.levelStartCoins = this.ui.coins;
        this.ui.clearFx();
        this.cameraX = 0; // cada sala é uma tela só
        this.shake = 0;
        this.state = 'playing';
        this.room = null;
        this.pet = this.profile.relics.includes('caramelo') ? new Caramelo(450, 480) : null;
        this.jblTimer = 6;
        this.enterRoom(this.level.start, null);
        this.ui.narrate(this.level.intro);
        this.audio.playSfx('start');
        this.audio.playLevelMusic(num);
    }

    // Entra numa sala; `dir` é a direção em que o jogador estava andando
    enterRoom(room, dir) {
        const p = this.player;
        this.room = room;
        this.level.visit(room);
        this.items = room.items;
        this.props = room.props;
        this.bull = room.bull;
        this.enemies.list = [];
        this.enemies.clearFx();
        this.shots = [];
        this.events.cur = null;
        this.fade = 0.35;
        if (dir) {
            const e = ENTRY[OPPOSITE[dir]];
            p.x = e.x; p.y = e.y;
        }
        p.lassoTarget = null;
        p.ropeLen = 0;
        if (this.pet) { this.pet.x = p.x - 50 * Math.sign(p.x - 512 || 1) * -1; this.pet.y = p.y; }
        if (p.state !== 'down') p.setState('idle');
        // O touro fica parado esperando quando você volta pra sala
        if (this.bull && this.bull.state === 'riding') this.bull.state = 'gone';
        for (const f of room.fixtures) f.inside = false;

        if (!room.cleared) {
            // Porteiras fecham: só abrem quando derrubar todo mundo
            this.level.active = true;
            this.spawnQueue = [...room.enemyTypes];
            this.spawnTimer = 0.4;
            this.audio.playSfx('honk');
            if (room.type === 'boss') {
                this.ui.banner(`☠ ${ENEMY_TYPES[this.level.boss].name.toUpperCase()} ☠`, 'O chefe do andar quer briga!');
                this.audio.playSfx('moo');
            } else {
                this.ui.narrate(room.type === 'rodeio' ? 'Arena de rodeio! Monta no touro!' : 'A porteira fechou! Derruba geral!');
            }
        } else {
            this.level.active = false;
            this.spawnQueue = [];
            if (!room.welcomed) {
                const msg = { treasure: 'Sala do tesouro! Pega o item!', shop: 'Lojinha do Pix! Encosta no balcão.', vendor: 'Ó o queijo coalho, ó!' }[room.type];
                if (msg) this.ui.narrate(msg);
            }
        }
        room.welcomed = true;
    }

    update(timestamp) {
        // dt em segundos, limitado pra não "teleportar" após trocar de aba
        const dt = Math.min(0.05, (timestamp - (this.lastTime || timestamp)) / 1000);
        this.lastTime = timestamp;
        this.time += dt;

        this.rtx.update(dt);
        if (this.pressed.rtx) {
            const m = this.rtx.toggleMode();
            this.ui.narrate('⚡ RTX / SHADERS: ' + m.toUpperCase());
            this.audio.playSfx('powerup');
        }

        if (this.pressed.mute) this.audio.toggleMute();

        if (this.state === 'playing') this.updatePlaying(dt);
        else if (this.state === 'shop') this.shop.update(this);
        else if (this.state === 'menu') {
            // 1-6 no menu pula direto pro andar (bom pra testar)
            for (let i = 1; i <= FLOOR_COUNT; i++) if (this.pressed['lvl' + i]) this.newGame(i);
            if (this.pressed.start) this.newGame(1);
        } else if (this.pressed.start) {
            if (this.state === 'levelClear') {
                this.startFloor(this.levelNum + 1, Math.min(this.player.maxHp, this.player.hp + 30));
            } else if (this.state === 'gameOver') {
                // Tenta o andar de novo (mapa novo), com o Pix de antes dele
                this.ui.coins = this.levelStartCoins;
                this.startFloor(this.levelNum);
            } else {
                this.state = 'menu';
                this.audio.stopMusic();
            }
        }

        this.ui.update(dt);
        this.pressed = {};
    }

    updatePlaying(dt) {
        const { player, enemies, level } = this;
        this.shake = Math.max(0, this.shake - dt);
        this.fade = Math.max(0, this.fade - dt);

        player.update(dt, this.held, this.pressed, this, 50, VIEW_W - 50);
        this.bull?.update(dt, this);
        this.spawnEnemies(dt);
        enemies.update(dt, player, this);
        for (const e of enemies.list) e.x = Math.max(40, Math.min(VIEW_W - 40, e.x)); // ninguém sai da sala
        this.pet?.update(dt, this);
        this.updateRelics(dt);
        this.items.update(dt, player, this);
        this.props.update(dt, this);
        this.events.update(dt, this);
        this.live.update(dt, this);
        this.touchFixtures();

        // Sala limpa: abre as porteiras
        if (level.active && !this.spawnQueue.length && enemies.alive === 0) this.roomCleared();
        if (this.state === 'playing') this.tryDoors();

        if (player.hp <= 0 && player.state === 'down' && player.stateTime > 1.2) {
            this.state = 'gameOver';
            this.audio.stopMusic();
            this.audio.playSfx('gameover');
        }
    }

    spawnEnemies(dt) {
        if (!this.spawnQueue.length) return;
        this.spawnTimer -= dt;
        const maxAlive = 4 + Math.floor(this.player.ostentacao / 50);
        if (this.spawnTimer > 0 || this.enemies.alive >= maxAlive) return;
        // Aparece longe do jogador
        let x, y;
        for (let i = 0; i < 20; i++) {
            x = 120 + Math.random() * 784;
            y = 395 + Math.random() * 160;
            if (Math.abs(x - this.player.x) > 260) break;
        }
        const type = this.spawnQueue.shift();
        const e = this.enemies.spawn(x, y, type, this.level.speed);
        if (e.t.boss) e.cooldown = 1.2;
        this.ui.addHitSpark(x, y, 40);
        this.spawnTimer = 0.45 / this.level.speed;
    }

    roomCleared() {
        const room = this.room;
        room.cleared = true;
        this.level.active = false;
        this.audio.playSfx('victory');
        if (room.type === 'boss') {
            room.addExit();
            this.ui.coins += 500;
            this.ui.pixPopup(500);
            this.ui.banner('CHEFE DERRUBADO!', 'Pega o busão pro próximo andar ➜');
            this.items.drop(440, 470, pick(BONE_KEYS));
            this.items.drop(584, 470, 'queijo');
            this.live.gain(1000, this);
            return;
        }
        this.ui.narrate('Porteira aberta!');
        // Recompensa de sala limpa, às vezes
        const r = Math.random();
        if (r < 0.2) this.items.drop(512, 470, 'queijo');
        else if (r < 0.32) this.items.drop(512, 470, pick(BONE_KEYS));
        else if (r < 0.5) for (let i = 0; i < 4; i++) this.items.drop(470 + i * 28, 470, 'pix', 15);
    }

    // Andando contra uma porteira aberta, passa pra sala vizinha
    tryDoors() {
        const p = this.player, h = this.held, room = this.room;
        if (this.level.active || this.fade > 0.15 || (p.state !== 'idle' && p.state !== 'walk')) return;
        let dir = null;
        if (h.left && p.x <= 62 && Math.abs(p.y - 475) < 45) dir = 'left';
        else if (h.right && p.x >= VIEW_W - 62 && Math.abs(p.y - 475) < 45) dir = 'right';
        else if (h.up && p.y <= GROUND_MIN + 2 && Math.abs(p.x - 512) < 50) dir = 'up';
        else if (h.down && p.y >= GROUND_MAX - 2 && Math.abs(p.x - 512) < 50) dir = 'down';
        if (dir && room.doors[dir]) this.enterRoom(this.level.neighbor(room, dir), dir);
    }

    // Pedestal, balcão da loja e ponto de busão reagem quando você encosta
    touchFixtures() {
        const p = this.player;
        for (const f of this.room.fixtures) {
            const inside = Math.abs(p.x - f.x) < f.w && Math.abs(p.y - f.y) < f.h && p.state !== 'down';
            if (inside && !f.inside) f.touch(this);
            f.inside = inside;
        }
    }

    // Efeitos contínuos dos itens colecionáveis
    updateRelics(dt) {
        const p = this.player;
        // Caixinha de Som: grave que empurra todo mundo a cada 6s
        if (p.has('caixinha') && this.level.active) {
            this.jblTimer -= dt;
            if (this.jblTimer <= 0) {
                this.jblTimer = 6;
                this.ui.addRing(p.x, p.y);
                this.audio.playSfx('boom');
                for (const e of this.enemies.list) {
                    if (e.hp <= 0 || e.state === 'down' || e.state === 'dead') continue;
                    if (Math.hypot(e.x - p.x, (e.y - p.y) * 2) > 190) continue;
                    e.hurt({ id: nextAttackId(), dmg: 6, knock: 280, finisher: true, dir: Math.sign(e.x - p.x) || 1 }, this);
                }
            }
        }
        // Ímã de Pix: puxa os itens do chão
        if (p.has('ima')) {
            for (const it of this.items.list) {
                if (it.z > 0 || Math.abs(it.x - p.x) + Math.abs(it.y - p.y) > 320) continue;
                it.x += Math.sign(p.x - it.x) * Math.min(Math.abs(p.x - it.x), 380 * dt);
                it.y += Math.sign(p.y - it.y) * Math.min(Math.abs(p.y - it.y), 300 * dt);
            }
        }
        // Chinelos voando
        for (const s of this.shots) {
            s.t += dt;
            s.x += s.vx * dt;
            for (const e of this.enemies.list) {
                if (s.done || e.hp <= 0 || e.state === 'down' || e.state === 'dead') continue;
                if (Math.abs(e.x - s.x) < 26 * e.scale && Math.abs(e.y - s.y) < 22) {
                    e.hurt({ id: s.id, dmg: Math.round(12 * p.damageMult), knock: 150, finisher: false, dir: Math.sign(s.vx) }, this);
                    this.ui.addHitSpark(e.x, e.y, 50);
                    this.audio.playSfx('hit');
                    s.done = true;
                }
            }
            if (s.t > 1.2 || s.x < 0 || s.x > VIEW_W) s.done = true;
        }
        this.shots = this.shots.filter(s => !s.done);
    }

    throwChinelo(p) {
        this.shots.push({ x: p.x + p.facing * 24, y: p.y, z: 55, vx: p.facing * 640, t: 0, id: nextAttackId() });
        this.audio.playSfx('throw');
    }

    grantRelic(id) {
        const r = RELICS[id], p = this.player, hp = p.hp;
        this.profile.relics.push(id);
        p.applyStats(profileStats(this.profile));
        p.hp = Math.min(p.maxHp, hp);
        if (id === 'caramelo' && !this.pet) this.pet = new Caramelo(p.x - 50, p.y);
        this.ui.banner(`${r.icon} ${r.name.toUpperCase()}`, r.desc);
        this.audio.playSfx('powerup');
        this.live.say('win');
        this.live.gain(200, this);
    }

    // Pedestal: primeiro dá itens colecionáveis; depois upgrades; por último Pix
    takeTreasure() {
        const pr = this.profile, p = this.player;
        const relics = RELIC_KEYS.filter(k => !pr.relics.includes(k));
        if (relics.length) return this.grantRelic(pick(relics));
        const options = UPGRADES.filter(u => pr.up[u.id] < u.prices.length);
        if (!options.length) {
            this.ui.coins += 500;
            this.ui.banner('MALA DE PIX', '+R$ 500');
        } else {
            const u = pick(options);
            pr.up[u.id]++;
            const hp = p.hp;
            p.applyStats(profileStats(pr));
            p.hp = Math.min(p.maxHp, hp + (u.id === 'vida' ? 20 : 0));
            this.ui.banner(u.name.toUpperCase(), `${u.desc} (de graça!)`);
        }
        this.audio.playSfx('powerup');
        this.live.say('win');
        this.live.gain(200, this);
    }

    openShop() {
        this.shop.open(this.player.hp);
        this.state = 'shop';
        this.audio.playSfx('vendor');
    }

    closeShop() {
        const p = this.player;
        p.applyStats(profileStats(this.profile));
        p.hp = Math.min(p.maxHp, this.shop.hp);
        p.y = Math.min(GROUND_MAX, p.y + 60); // dá um passo pra trás do balcão
        this.state = 'playing';
    }

    nextFloor() {
        this.audio.playSfx('victory');
        if (this.levelNum < FLOOR_COUNT) {
            this.state = 'levelClear';
        } else {
            this.state = 'victory';
            this.audio.stopMusic();
        }
    }

    // Chamado pelo player quando um golpe está ativo
    resolvePlayerAttack(hitbox) {
        for (const e of this.enemies.list) {
            if (!e.canBeHit(hitbox.id)) continue;
            if (Math.abs(e.y - hitbox.y) > (hitbox.yTol ?? 22) * e.scale) continue; // mesma "faixa" de profundidade
            if (Math.abs(e.z - hitbox.z) > 60) continue;
            if (e.x + 18 * e.scale < hitbox.x1 || e.x - 18 * e.scale > hitbox.x2) continue;
            // Barra de Ostentação aumenta o dano; Óculos Juliet dá crítico
            let dmg = Math.round(hitbox.dmg * this.player.damageMult);
            if (this.player.has('juliet') && Math.random() < 0.2) {
                dmg *= 2;
                this.ui.addFloat(e.x, e.y - 110 * e.scale, 'CRÍTICO!', '#ffd700');
                this.audio.playSfx('crit');
            }
            e.hurt({ ...hitbox, dmg }, this);
            this.audio.playSfx(hitbox.finisher ? 'bigHit' : 'hit');
            this.ui.addHitSpark(e.x, e.y, e.z + 50);
            if (hitbox.finisher) {
                this.rtx.addShockwave(e.x, e.y - e.z - 30, 160, '#00e5ff');
            }
            // Combos longos enchem a barra mais rápido
            const hits = this.ui.registerHit();
            this.gainOstentacao(3 + Math.min(hits, 10) * 0.6 + (hitbox.finisher ? 5 : 0));
            if (hits === 10) this.ui.narrate('Segura o peão! 10 hits!');
            this.live.onHit(hits, this);
            if (hitbox.air) this.live.onAirHit(this);
        }
        // Dá pra bater no cenário também
        this.props.hitTest(hitbox, this);
    }

    gainOstentacao(amount) {
        if (this.player.addOstentacao(amount)) {
            this.audio.playSfx('ostFull');
            this.ui.narrate('Ostentação no talo! Aperta ESPAÇO!');
        }
    }

    // Laço: pega o inimigo mais próximo à frente, na mesma faixa, até `reach`
    lassoCatch(p, reach) {
        let best = null;
        for (const e of this.enemies.list) {
            if (e.hp <= 0 || e.t.heavy || ['down', 'dead', 'pulled'].includes(e.state)) continue;
            const dist = (e.x - p.x) * p.facing;
            if (dist < 0 || dist > reach + 15 || Math.abs(e.y - p.y) > 30) continue;
            if (!best || dist < (best.x - p.x) * p.facing) best = e;
        }
        if (best) {
            best.pull();
            this.audio.playSfx('catch');
            this.ui.narrate('Olha o laço, minha gente!');
            this.gainOstentacao(6);
            this.live.onLasso(this);
        }
        return best;
    }

    // Especial "Camarote Premium": explosão de ostentação em todos na sala
    camaroteBlast(p) {
        const id = nextAttackId();
        for (const e of this.enemies.list) {
            if (e.hp <= 0) continue;
            const dir = Math.sign(e.x - p.x) || 1;
            e.hurt({ id, dmg: 45, knock: 420, finisher: true, dir }, this);
            this.ui.addHitSpark(e.x, e.y, 50);
        }
        p.ostentacao = 0;
        p.ostDelay = 0;
        this.shake = 0.5;
        this.rtx.addShockwave(p.x, p.y - 40, 420, 'rgba(255, 215, 0, 0.95)');
        this.ui.camarote();
        this.audio.playSfx('camarote');
        this.ui.narrate('CAMAROTE PREMIUM! Open bar pra geral!');
        this.live.onSpecial(this);
    }

    onEnemyDefeated(enemy) {
        // Quanto mais seguidores na live, mais Pix por inimigo
        const reward = Math.round(enemy.reward * this.live.pixMult * (this.player.has('pochete') ? 1.5 : 1));
        this.ui.coins += reward;
        this.ui.pixPopup(reward);
        this.audio.playSfx('pix');
        if (Math.random() < 0.5) this.ui.narrate();
        this.live.onKill(this);

        // Drops: Boné da Sorte multiplica a chance
        const luck = this.player.bone === 'sorte' ? 2.5 : 1;
        const r = Math.random();
        if (r < 0.1 * luck) {
            this.items.drop(enemy.x, enemy.y, pick(BONE_KEYS));
        } else if (r < 0.17 * luck) {
            this.items.drop(enemy.x, enemy.y, 'queijo');
        }
    }

    onPickup(kind) {
        const p = this.player;
        if (kind === 'pix') {
            this.ui.coins += 30;
            this.audio.playSfx('coin');
            return;
        }
        this.live.onPickup();
        if (kind === 'queijo') {
            p.hp = Math.min(p.maxHp, p.hp + 30);
            this.ui.narrate('Queijo coalho com orégano! +30 de vida!');
            this.audio.playSfx('heal');
        } else {
            p.bone = kind;
            p.boneTime = BONE_DURATION * (p.has('boneVip') ? 2 : 1);
            this.ui.narrate(BONES[kind].msg);
            this.audio.playSfx('powerup');
        }
    }

    drawShots(ctx) {
        for (const s of this.shots) {
            ctx.save();
            ctx.translate(s.x, s.y - s.z);
            ctx.rotate(s.t * 20);
            ctx.fillStyle = '#ffd700';
            ctx.fillRect(-12, -5, 24, 10);
            ctx.fillStyle = '#1e88e5';
            ctx.fillRect(-4, -5, 3, 10);
            ctx.fillRect(1, -5, 3, 10);
            ctx.restore();
        }
    }

    draw() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, VIEW_W, VIEW_H);

        if (this.state === 'menu') {
            this.ui.drawMenu(ctx, this.time);
            return;
        }
        if (this.state === 'shop') {
            this.shop.draw(ctx, this.time, this);
            return;
        }

        const room = this.room, theme = this.level.theme;
        drawBackground(theme, ctx, room.scenery, this.time);
        this.level.drawDoors(ctx, room, this.level.active, this.time);

        ctx.save();
        // Tremida de tela
        const sx = this.shake > 0 ? (Math.random() - 0.5) * 16 * this.shake : 0;
        const sy = this.shake > 0 ? (Math.random() - 0.5) * 16 * this.shake : 0;
        ctx.translate(sx, sy);
        // Ordena por profundidade (y) pra quem está mais "na frente" ficar por cima
        const actors = [this.player, ...this.enemies.list, ...this.items.list, ...this.items.vendors,
            ...this.props.list, ...room.fixtures];
        if (this.pet) actors.push(this.pet);
        if (this.bull?.visible) actors.push(this.bull);
        actors.sort((a, b) => a.y - b.y);
        for (const a of actors) a.drawShadow(ctx);
        for (const a of actors) a.draw(ctx, this.time);
        this.enemies.drawBottles(ctx);
        this.drawShots(ctx);
        this.events.drawWorld(ctx, this);
        this.ui.drawWorldFx(ctx);
        ctx.restore();
        drawOverlay(theme, ctx, this.time);
        this.events.drawOverlay(ctx, this, this.time);

        // Aplica shaders e iluminação dinâmica RTX ON no cenário e personagens
        this.rtx.apply(ctx, this, this.time);

        this.ui.drawCamarote(ctx);
        this.ui.drawHud(ctx, this.player, this.level, this.time);
        this.level.drawMinimap(ctx, room);
        drawRelicIcons(ctx, this.player.relics);
        this.live.draw(ctx, this.time);
        this.bull?.drawHud(ctx, this, this.time);
        const boss = this.enemies.list.find(e => e.t.boss && e.hp > 0);
        if (boss) this.ui.drawBossBar(ctx, boss);
        this.ui.drawBanner(ctx);

        // Indicador da música
        ctx.font = 'bold 13px Arial';
        ctx.textAlign = 'right';
        ctx.fillStyle = this.audio.musicOn ? '#32ff7e' : '#888';
        ctx.fillText(this.audio.musicOn ? '♪ MÚSICA ON (M)' : '♪ MÚSICA OFF (M)', 1010, 596);
        ctx.textAlign = 'left';

        // Escurece rapidinho na troca de sala
        if (this.fade > 0) {
            ctx.fillStyle = `rgba(0,0,0,${Math.min(1, this.fade / 0.35)})`;
            ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        }

        if (this.state === 'gameOver') {
            this.ui.drawEnd(ctx, 'GAME OVER', '#ff3366', 'O peão caiu do touro...', 'Enter: tentar o andar de novo (mapa novo)');
        }
        if (this.state === 'levelClear') {
            this.ui.drawEnd(ctx, `ANDAR ${this.levelNum} COMPLETO!`, '#00ffcc',
                `Próximo: Andar ${this.levelNum + 1} - ${FLOORS[this.levelNum].name} (mais salas!)`, 'Enter: subir no busão (+30 de vida)');
        }
        if (this.state === 'victory') {
            this.ui.drawEnd(ctx, 'BALNEÁRIO LIBERTADA!', '#ffd700',
                `Mas o Xerife do Agro te espera no rodeio... (chefe em breve)  •  ${this.live.followersText} seguidores`,
                'Enter: voltar ao menu');
        }
    }
}
