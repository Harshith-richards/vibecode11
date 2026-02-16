import { formatName } from './utils.js';

export class UI {
  constructor() {
    this.$player = document.querySelector('#player-summary');
    this.$region = document.querySelector('#region-info');
    this.$daily = document.querySelector('#daily-challenge');
    this.$board = document.querySelector('#leaderboard');
    this.$battle = document.querySelector('#battle-area');
    this.$battleActions = document.querySelector('#battle-actions');
    this.$modalRoot = document.querySelector('#modal-root');
  }

  renderPlayer(player) {
    this.$player.innerHTML = `
      <p><strong>${player.name}</strong> Lv.${player.level}</p>
      <p>XP: ${player.xp}/${player.level * 50} | Coins: ${player.coins}</p>
      <p>Badges: ${player.badges.length} | Team: ${player.team.length}/6</p>
      <p class="mono">Items: 🧪${player.inventory.potion} 🧯${player.inventory.revive} ⚪${player.inventory.pokeball} 🔵${player.inventory.greatball}</p>
    `;
  }

  renderRegion(player, gyms) {
    this.$region.innerHTML = `
      <p>Region ${player.region}</p>
      <p>Next gym: <strong>${gyms[player.badges.length]?.name ?? 'Champion Cleared'}</strong></p>
      <p>Difficulty: ${player.difficulty}</p>
    `;
  }

  renderDaily(player) {
    const done = player.daily.completed ? '✅ Completed' : `Progress ${player.daily.progress}/${player.daily.goal}`;
    this.$daily.innerHTML = `<h3>Daily Challenge</h3><p>Catch ${player.daily.goal} Pokémon.</p><p>${done}</p>`;
  }

  renderLeaderboard(rows) {
    this.$board.innerHTML = `<h3>Leaderboard (Local)</h3>${rows.map((r, i) => `<p>${i + 1}. ${r.name} — ${r.score}</p>`).join('') || '<p>No entries yet</p>'}`;
  }

  renderBattle(engine) {
    const side = (p, role) => {
      const hpPct = Math.max(0, (p.currentHp / p.maxHp) * 100);
      const sprite = p.shiny && p.shinySprite ? p.shinySprite : p.sprite;
      return `
      <div class="combatant ${role}">
        <img src="${sprite}" alt="${p.name}" loading="lazy" />
        <div>
          <h3>${formatName(p.name)} Lv.${p.level} ${p.shiny ? '✨' : ''}</h3>
          <p>Type: ${p.types.join(', ')}</p>
          <div class="hp-wrap"><div class="hp-bar" style="width:${hpPct}%"></div></div>
          <p>HP: ${p.currentHp}/${p.maxHp} ${p.status ? `| ${p.status}` : ''}</p>
        </div>
      </div>`;
    };

    this.$battle.innerHTML = `
      ${side(engine.enemy, 'enemy')}
      ${side(engine.player, 'player')}
      <div class="log">${engine.log.map(x => `<div>${x}</div>`).join('')}</div>
    `;

    this.$battleActions.innerHTML = engine.player.moves
      .map(m => `<button data-move="${m}">${formatName(m)}</button>`)
      .join('') +
      `<button data-battle="catch">Throw Ball</button><button data-battle="item">Use Potion</button>`;
  }

  renderTextBattle(message) {
    this.$battle.innerHTML = `<p>${message}</p>`;
    this.$battleActions.innerHTML = '';
  }

  modal(title, body, actions = []) {
    this.$modalRoot.innerHTML = `
      <div class="modal" id="active-modal">
        <div class="modal-card">
          <h3>${title}</h3>
          <div>${body}</div>
          <div class="battle-actions">${actions.map(a => `<button data-modal-action="${a.key}">${a.label}</button>`).join('')}
          <button data-modal-action="close" class="ghost">Close</button></div>
        </div>
      </div>
    `;
  }

  closeModal() {
    this.$modalRoot.innerHTML = '';
  }
}
