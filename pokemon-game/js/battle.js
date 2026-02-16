import { getMoveData } from './api.js';
import { chance, clamp, effectiveness, pick, rand } from './utils.js';

const statuses = ['burn', 'poison', 'paralysis'];

export class BattleEngine {
  constructor(playerPokemon, enemyPokemon, isGym = false) {
    this.player = playerPokemon;
    this.enemy = enemyPokemon;
    this.turn = this.player.calc('speed') >= this.enemy.calc('speed') ? 'player' : 'enemy';
    this.log = [];
    this.isGym = isGym;
    this.done = false;
  }

  pushLog(message) {
    this.log.unshift(message);
    this.log = this.log.slice(0, 25);
  }

  applyStatusTick(target) {
    if (!target.status) return;
    if (target.status === 'poison' || target.status === 'burn') {
      const dmg = Math.max(1, Math.floor(target.maxHp * 0.07));
      target.currentHp = clamp(target.currentHp - dmg, 0, target.maxHp);
      this.pushLog(`${target.name} takes ${dmg} from ${target.status}.`);
    }
    target.statusTurns -= 1;
    if (target.statusTurns <= 0) target.status = null;
  }

  async performAttack(attacker, defender, moveName) {
    const mv = await getMoveData(moveName);
    if (!chance(mv.accuracy)) {
      this.pushLog(`${attacker.name}'s ${mv.name} missed!`);
      return { damage: 0, effectiveness: 1 };
    }

    const atk = attacker.calc('attack');
    const def = defender.calc('defense');
    const base = (((2 * attacker.level) / 5 + 2) * mv.power * (atk / Math.max(1, def))) / 50 + 2;
    const crit = chance(0.08) ? 1.5 : 1;
    const eff = effectiveness(mv.type, defender.types);
    const variance = rand(85, 100) / 100;
    const dmg = Math.max(1, Math.floor(base * crit * eff * variance));

    defender.currentHp = clamp(defender.currentHp - dmg, 0, defender.maxHp);
    this.pushLog(`${attacker.name} used ${mv.name}, dealing ${dmg}.`);
    if (crit > 1) this.pushLog('Critical hit!');
    if (eff > 1) this.pushLog(`It's super effective!`);
    if (eff < 1) this.pushLog(`It's not very effective.`);

    if (!defender.status && mv.effectChance > 0 && chance(mv.effectChance)) {
      defender.status = pick(statuses);
      defender.statusTurns = rand(2, 4);
      this.pushLog(`${defender.name} is now ${defender.status}!`);
    }
    return { damage: dmg, effectiveness: eff };
  }

  selectAiMove() {
    if (this.enemy.currentHp / this.enemy.maxHp < 0.25 && this.enemy.moves.includes('recover')) return 'recover';
    return pick(this.enemy.moves);
  }

  async nextTurn(playerMove) {
    if (this.done) return;
    const order = this.turn === 'player' ? [
      [this.player, this.enemy, playerMove],
      [this.enemy, this.player, this.selectAiMove()]
    ] : [
      [this.enemy, this.player, this.selectAiMove()],
      [this.player, this.enemy, playerMove]
    ];

    for (const [attacker, defender, move] of order) {
      if (attacker.currentHp <= 0 || defender.currentHp <= 0) continue;
      if (attacker.status === 'paralysis' && chance(0.25)) {
        this.pushLog(`${attacker.name} is paralyzed and cannot move.`);
      } else {
        await this.performAttack(attacker, defender, move);
      }
      this.applyStatusTick(attacker);
      if (defender.currentHp <= 0 || attacker.currentHp <= 0) break;
    }

    if (this.player.currentHp <= 0 || this.enemy.currentHp <= 0) this.done = true;
    this.turn = this.turn === 'player' ? 'enemy' : 'player';
  }
}
