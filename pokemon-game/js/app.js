import { getRandomPokemon, getStarterOptions } from './api.js';
import { BattleEngine } from './battle.js';
import { Player, PokemonInstance } from './player.js';
import { Storage } from './storage.js';
import { UI } from './ui.js';
import { chance, formatName, pick, rand } from './utils.js';

const gyms = [
  { name: 'Pewter Gym', minLevel: 8, teamSize: 2 },
  { name: 'Cerulean Gym', minLevel: 14, teamSize: 3 },
  { name: 'Vermilion Gym', minLevel: 21, teamSize: 4 },
  { name: 'Celadon Gym', minLevel: 28, teamSize: 5 }
];

const shop = { pokeball: 50, potion: 80, revive: 180, greatball: 120 };
const ui = new UI();

let state = {
  player: null,
  activeBattle: null,
  isGymBattle: false,
  loading: true
};

function autosave() {
  if (state.player) Storage.save({ player: state.player.toJSON() });
}

function recalcDaily(player) {
  const today = new Date().toDateString();
  if (player.daily.seed !== today) player.daily = { seed: today, completed: false, goal: 3, progress: 0 };
}

function render() {
  if (!state.player) return;
  ui.renderPlayer(state.player);
  ui.renderRegion(state.player, gyms);
  ui.renderDaily(state.player);
  ui.renderLeaderboard(Storage.loadLeaderboard());
  if (state.activeBattle) ui.renderBattle(state.activeBattle);
}

async function initNewGame() {
  const trainerName = prompt('Enter trainer name', 'Ash') || 'Ash';
  const starters = await getStarterOptions();
  const pickName = prompt(`Choose starter: ${starters.map(s => s.name).join(', ')}`, starters[0].name)?.toLowerCase();
  const base = starters.find(s => s.name === pickName) || starters[0];
  const starter = new PokemonInstance(base, 5);
  state.player = new Player(trainerName, starter);
}

async function init() {
  document.querySelector('#loading-bar').style.width = '35%';
  const save = Storage.load();
  if (save?.player) state.player = Player.from(save.player);
  else await initNewGame();

  recalcDaily(state.player);
  document.querySelector('#loading-bar').style.width = '75%';
  render();
  state.loading = false;
  document.querySelector('#loading-bar').style.width = '100%';
  setTimeout(() => {
    document.querySelector('#loading-screen').classList.add('hidden');
    document.querySelector('#app').classList.remove('hidden');
  }, 350);
  autosave();
}

function updateLeaderboard() {
  const rows = Storage.loadLeaderboard();
  const score = state.player.badges.length * 1000 + state.player.level * 100 + state.player.team.reduce((a, p) => a + p.level, 0);
  const others = rows.filter(r => r.name !== state.player.name);
  others.push({ name: state.player.name, score });
  others.sort((a, b) => b.score - a.score);
  Storage.saveLeaderboard(others);
}

async function startEncounter(gymMode = false) {
  const lead = state.player.team.find(p => p.currentHp > 0);
  if (!lead) return ui.renderTextBattle('All team members are down. Use revives.');

  const lvBand = gymMode ? [10 + state.player.badges.length * 5, 18 + state.player.badges.length * 6] : [2, 10 + state.player.region * 6];
  const enemyBase = await getRandomPokemon(lvBand);
  const enemy = new PokemonInstance(enemyBase, enemyBase.level || rand(...lvBand));
  state.activeBattle = new BattleEngine(lead, enemy, gymMode);
  state.isGymBattle = gymMode;
  render();
}

function attemptCatch() {
  const b = state.activeBattle;
  if (!b) return;
  const item = state.player.inventory.greatball > 0 ? 'greatball' : 'pokeball';
  if (state.player.inventory[item] <= 0) return b.pushLog('Out of balls!');
  state.player.inventory[item] -= 1;

  const hpFactor = 1 - b.enemy.currentHp / b.enemy.maxHp;
  const rarityPenalty = 1 / (1 + b.enemy.rarity * 0.25);
  const ballBonus = item === 'greatball' ? 1.4 : 1;
  const chanceValue = Math.min(0.95, 0.15 + hpFactor * 0.6 * rarityPenalty * ballBonus);
  const success = chance(chanceValue);
  b.pushLog(`You threw a ${item}!`);

  if (success) {
    const caught = b.enemy;
    state.player.addPokemon(caught);
    b.pushLog(`Caught ${formatName(caught.name)}!`);
    state.player.coins += 60;
    state.player.daily.progress += 1;
    if (state.player.daily.progress >= state.player.daily.goal) {
      state.player.daily.completed = true;
      state.player.grantAchievement('Daily Hunter');
      state.player.coins += 300;
    }
    state.activeBattle.done = true;
  } else b.pushLog('Oh no! It broke free.');
  autosave();
  render();
}

async function playTurn(move) {
  const b = state.activeBattle;
  if (!b || b.done) return;

  await b.nextTurn(move);

  if (b.enemy.currentHp <= 0) {
    const gain = 25 + b.enemy.level * 6;
    const leveledPokemon = b.player.gainXp(gain);
    const leveledTrainer = state.player.gainTrainerXp(Math.floor(gain / 2));
    state.player.coins += 40 + b.enemy.level * 5;
    b.pushLog(`Victory! +${gain} XP to ${formatName(b.player.name)}.`);

    if (state.isGymBattle) {
      const idx = state.player.badges.length;
      state.player.badges.push(gyms[idx].name);
      state.player.region += 1;
      state.player.grantAchievement(`Badge ${idx + 1}`);
      b.pushLog(`Badge earned: ${gyms[idx].name}`);
    }

    if (leveledPokemon) b.pushLog(`${formatName(b.player.name)} leveled up!`);
    if (leveledTrainer) state.player.grantAchievement('Rising Star');
    state.activeBattle.done = true;
    updateLeaderboard();
  }

  if (b.player.currentHp <= 0) {
    b.pushLog(`${formatName(b.player.name)} fainted. Battle lost.`);
    state.activeBattle.done = true;
  }

  autosave();
  render();
}

function showTeamModal(pc = false) {
  const list = (pc ? state.player.pc : state.player.team)
    .map(p => `<div class="card"><strong>${formatName(p.name)}</strong> Lv.${p.level}<br/>HP ${p.currentHp}/${p.maxHp}
      <div class="battle-actions">
        ${pc ? `<button data-pc-add="${p.uid}">Add To Team</button><button data-release="${p.uid}" class="danger">Release</button>` : `<button data-team-heal="${p.uid}">Potion</button><button data-team-pc="${p.uid}">Move To PC</button>`}
      </div></div>`).join('');
  ui.modal(pc ? 'PC Storage' : 'Team Management', `<div class="list-grid">${list || '<p>No Pokémon.</p>'}</div>`);
}

function showShopModal() {
  ui.modal('Shop', Object.entries(shop).map(([k, v]) => `<div class="card"><strong>${k}</strong> ${v} coins <button data-buy="${k}">Buy</button></div>`).join(''));
}

function showAchievements() {
  const body = `<p>${state.player.achievements.length ? state.player.achievements.join(', ') : 'No achievements yet.'}</p>`;
  ui.modal('Achievements', body, [{ key: 'difficulty', label: 'Cycle Difficulty' }]);
}

document.addEventListener('click', async e => {
  const action = e.target.dataset.action;
  const move = e.target.dataset.move;
  const battleAction = e.target.dataset.battle;

  if (action === 'explore') {
    if (chance(0.85)) await startEncounter(false);
    else ui.renderTextBattle('No encounter found. You discovered some tracks.');
  }

  if (action === 'gym') {
    const gym = gyms[state.player.badges.length];
    if (!gym) return ui.renderTextBattle('All available gyms cleared!');
    if (state.player.level < Math.max(1, gym.minLevel - 5)) return ui.renderTextBattle(`Train more before challenging ${gym.name}.`);
    await startEncounter(true);
  }

  if (action === 'shop') showShopModal();
  if (action === 'team') showTeamModal(false);
  if (action === 'pc') showTeamModal(true);
  if (action === 'achievements') showAchievements();

  if (move) await playTurn(move);
  if (battleAction === 'catch') attemptCatch();
  if (battleAction === 'item' && state.activeBattle) {
    const used = state.player.useItem('potion', state.activeBattle.player);
    state.activeBattle.pushLog(used ? 'Potion used.' : 'No potion left.');
    render();
    autosave();
  }

  if (e.target.dataset.buy) {
    const item = e.target.dataset.buy;
    const ok = state.player.buy(item, shop[item]);
    if (ok) autosave();
    render();
  }

  if (e.target.dataset.teamHeal) {
    const p = state.player.team.find(x => x.uid === e.target.dataset.teamHeal);
    if (p && state.player.useItem('potion', p)) render();
    autosave();
  }

  if (e.target.dataset.teamPc) {
    const idx = state.player.team.findIndex(x => x.uid === e.target.dataset.teamPc);
    if (idx > 0) {
      state.player.pc.push(state.player.team[idx]);
      state.player.team.splice(idx, 1);
      autosave();
      showTeamModal(false);
      render();
    }
  }

  if (e.target.dataset.pcAdd) {
    if (state.player.team.length >= 6) return;
    const idx = state.player.pc.findIndex(x => x.uid === e.target.dataset.pcAdd);
    if (idx >= 0) {
      state.player.team.push(state.player.pc[idx]);
      state.player.pc.splice(idx, 1);
      autosave();
      showTeamModal(true);
      render();
    }
  }

  if (e.target.dataset.release) {
    state.player.pc = state.player.pc.filter(x => x.uid !== e.target.dataset.release);
    autosave();
    showTeamModal(true);
    render();
  }

  if (e.target.dataset.modalAction === 'close') ui.closeModal();
  if (e.target.dataset.modalAction === 'difficulty') {
    const order = ['easy', 'normal', 'hard'];
    const idx = order.indexOf(state.player.difficulty);
    state.player.difficulty = order[(idx + 1) % order.length];
    ui.closeModal();
    autosave();
    render();
  }
});

document.querySelector('#theme-toggle').addEventListener('click', () => {
  const html = document.documentElement;
  html.dataset.theme = html.dataset.theme === 'dark' ? 'light' : 'dark';
});

document.querySelector('#sound-toggle').addEventListener('click', e => {
  state.player.soundOn = !state.player.soundOn;
  e.target.textContent = state.player.soundOn ? '🔊' : '🔇';
  autosave();
});

document.querySelector('#reset-game').addEventListener('click', () => {
  if (!confirm('Delete all save data?')) return;
  Storage.clear();
  location.reload();
});

init();
