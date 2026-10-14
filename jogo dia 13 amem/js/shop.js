// Lojinha do Pix (sala da loja de cada andar): upgrades permanentes e roupas pro Thiago.

import { Player } from './player.js';
import { RELICS } from './relics.js';

export const UPGRADES = [
    { id: 'vida', name: 'Mais Vida', desc: '+20 de vida máxima', prices: [450, 750, 1100] },
    { id: 'soco', name: 'Soco de Ouro', desc: '+15% de dano em tudo', prices: [500, 800, 1200] },
    { id: 'laco', name: 'Cordão Longo', desc: '+60 de alcance no laço', prices: [400, 700, 1000] },
    { id: 'ost', name: 'Ostentação Duradoura', desc: 'A barra cai 35% mais devagar', prices: [400, 800] },
];

export const SHIRTS = {
    florida: { name: 'Camisa Florida', price: 0, colors: ['#ff3fa4', '#ffe14d'] },
    neon:    { name: 'Camisa Neon', price: 300, colors: ['#00e5ff', '#7a2cff'] },
    onca:    { name: 'Camisa de Oncinha', price: 600, colors: ['#e0a030', '#3b2010'] },
    terno:   { name: 'Terno Branco', price: 900, colors: ['#f4f4f4', '#cfd8dc'] },
};

export const CHAINS = {
    ouro:     { name: 'Corrente de Ouro', price: 0, color: '#ffd700' },
    diamante: { name: 'Corrente de Diamante', price: 700, color: '#b9f2ff' },
};

const QUEIJO_PRICE = 200;

export function newProfile() {
    return { up: { vida: 0, soco: 0, laco: 0, ost: 0 }, owned: ['florida', 'ouro'], shirt: 'florida', chain: 'ouro', relics: [] };
}

// Converte o que foi comprado em atributos do jogador
export function profileStats(pr) {
    return {
        maxHp: 100 + 20 * pr.up.vida,
        dmgBonus: 1 + 0.15 * pr.up.soco,
        lassoRange: 280 + 60 * pr.up.laco,
        ostDecay: 6 * (1 - 0.35 * pr.up.ost),
        look: { shirt: SHIRTS[pr.shirt].colors, chain: CHAINS[pr.chain].color },
        relics: new Set(pr.relics),
    };
}

export class Shop {
    open(hp) {
        this.hp = hp;   // vida do jogador enquanto compra
        this.sel = 0;
        this.msg = 'Bem-vindo à lojinha! Aqui o Pix vira ostentação.';
        this.preview = new Player(0, 0);
    }

    rows(game) {
        const pr = game.profile, ui = game.ui;
        const say = (m, sfx) => { this.msg = m; game.audio.playSfx(sfx); };
        const pay = (price) => {
            if (ui.coins < price) { say('Pix insuficiente, peão!', 'denied'); return false; }
            ui.coins -= price;
            return true;
        };
        const rows = [];

        for (const u of UPGRADES) {
            const lvl = pr.up[u.id], maxed = lvl >= u.prices.length;
            rows.push({
                label: `${u.name}  ${'★'.repeat(lvl)}${'☆'.repeat(u.prices.length - lvl)}`,
                desc: u.desc,
                right: maxed ? 'MÁX' : `R$ ${u.prices[lvl]}`,
                act: () => {
                    if (maxed) return say('Esse já tá no máximo!', 'denied');
                    if (!pay(u.prices[lvl])) return;
                    pr.up[u.id]++;
                    if (u.id === 'vida') this.hp += 20;
                    say(`${u.name} comprado!`, 'buy');
                },
            });
        }

        const maxHp = profileStats(pr).maxHp;
        rows.push({
            label: 'Queijo pra Viagem', desc: '+50 de vida agora',
            right: `R$ ${QUEIJO_PRICE}`,
            act: () => {
                if (this.hp >= maxHp) return say('Sua vida já tá cheia!', 'denied');
                if (!pay(QUEIJO_PRICE)) return;
                this.hp = Math.min(maxHp, this.hp + 50);
                say('Queijo coalho com mel. Vida recuperada!', 'heal');
            },
        });

        // Item especial da lojinha deste andar
        const relic = game.room?.shopRelic;
        if (relic && !pr.relics.includes(relic)) {
            const r = RELICS[relic];
            rows.push({
                label: `${r.icon} ${r.name}`, desc: r.desc, right: 'R$ 1200',
                act: () => {
                    if (!pay(1200)) return;
                    game.grantRelic(relic);
                    this.hp = Math.min(profileStats(pr).maxHp, this.hp);
                    say(`${r.name} é seu!`, 'buy');
                },
            });
        }

        const cosmetic = (id, item, slot) => {
            const owned = pr.owned.includes(id), equipped = pr[slot] === id;
            rows.push({
                label: item.name, desc: slot === 'shirt' ? 'Roupa (só visual)' : 'Corrente (só visual)',
                right: equipped ? 'EQUIPADO' : owned ? 'EQUIPAR' : `R$ ${item.price}`,
                act: () => {
                    if (equipped) return;
                    if (!owned) {
                        if (!pay(item.price)) return;
                        pr.owned.push(id);
                    }
                    pr[slot] = id;
                    say(`Tá na moda! ${item.name} equipado.`, 'buy');
                },
            });
        };
        for (const [id, s] of Object.entries(SHIRTS)) cosmetic(id, s, 'shirt');
        for (const [id, c] of Object.entries(CHAINS)) cosmetic(id, c, 'chain');

        rows.push({
            label: '◀ SAIR DA LOJA', desc: '', right: '', next: true,
            act: () => game.closeShop(),
        });
        return rows;
    }

    update(game) {
        const rows = this.rows(game);
        if (game.pressed.up) this.sel = (this.sel + rows.length - 1) % rows.length;
        if (game.pressed.down) this.sel = (this.sel + 1) % rows.length;
        if (game.pressed.punch || game.pressed.start) rows[this.sel].act();
    }

    draw(ctx, time, game) {
        const g = ctx.createLinearGradient(0, 0, 0, 600);
        g.addColorStop(0, '#2a0845');
        g.addColorStop(1, '#0a0420');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 1024, 600);

        ctx.textAlign = 'left';
        ctx.font = 'bold 36px Arial';
        ctx.fillStyle = '#ffd700';
        ctx.fillText('LOJINHA DO PIX', 50, 60);
        ctx.font = '16px Arial';
        ctx.fillStyle = '#ccc';
        ctx.fillText('Upgrades valem pro resto do jogo. Roupas são só pra ostentar.', 50, 88);
        if (this.sel === undefined) this.sel = 0;

        const rows = this.rows(game);
        rows.forEach((r, i) => {
            const y = 112 + i * 34;
            const sel = i === this.sel;
            ctx.fillStyle = sel ? 'rgba(255,63,164,0.35)' : 'rgba(255,255,255,0.05)';
            ctx.fillRect(40, y, 600, 30);
            if (sel) { ctx.fillStyle = '#ff3fa4'; ctx.fillRect(40, y, 5, 30); }
            ctx.font = 'bold 16px Arial';
            ctx.fillStyle = r.next ? '#00ffcc' : '#fff';
            ctx.fillText(r.label, 56, y + 20);
            ctx.font = '13px Arial';
            ctx.fillStyle = '#aaa';
            ctx.fillText(r.desc.length > 34 ? r.desc.slice(0, 33) + '…' : r.desc, 330, y + 20);
            ctx.textAlign = 'right';
            ctx.font = 'bold 15px Arial';
            ctx.fillStyle = r.right.startsWith('R$') ? '#ffd700' : r.right === 'EQUIPADO' ? '#32ff7e' : '#ccc';
            ctx.fillText(r.right, 630, y + 20);
            ctx.textAlign = 'left';
        });

        // Prévia do Thiago com o visual atual
        const p = this.preview;
        p.applyStats(profileStats(game.profile));
        ctx.save();
        ctx.translate(830, 420);
        ctx.scale(2.4, 2.4);
        p.draw(ctx, time);
        ctx.restore();

        const maxHp = profileStats(game.profile).maxHp;
        ctx.textAlign = 'center';
        ctx.font = 'bold 22px Arial';
        ctx.fillStyle = '#ffd700';
        ctx.fillText(`PIX: R$ ${game.ui.coins}`, 830, 110);
        ctx.fillStyle = '#00ffcc';
        ctx.font = 'bold 16px Arial';
        ctx.fillText(`Vida: ${Math.round(this.hp)}/${maxHp}`, 830, 140);
        ctx.fillStyle = '#ff3fa4';
        ctx.fillText(`Seguidores: ${game.live.followersText}`, 830, 166);

        ctx.fillStyle = '#ffe14d';
        ctx.font = 'bold 17px Arial';
        ctx.fillText(this.msg, 512, 540);
        ctx.fillStyle = '#999';
        ctx.font = '14px Arial';
        ctx.fillText('W/S escolher  •  J ou Enter comprar/equipar  •  SAIR DA LOJA pra voltar', 512, 575);
        ctx.textAlign = 'left';
    }
}
