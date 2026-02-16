import { chance, clamp, rand, uuid } from './utils.js';

export class PokemonInstance {
  constructor(base, level = 5) {
    this.uid = uuid();
    this.baseId = base.id;
    this.name = base.name;
    this.sprite = base.sprite;
    this.shinySprite = base.shinySprite;
    this.types = base.types;
    this.moves = base.moves.slice(0, 4);
    this.level = level;
    this.xp = 0;
    this.status = null;
    this.statusTurns = 0;
    this.iv = {
      hp: rand(0, 31), attack: rand(0, 31), defense: rand(0, 31), speed: rand(0, 31)
    };
    this.shiny = chance(0.01);
    this.rarity = base.rarity || 1;
    this.baseStats = base.stats;
    this.currentHp = this.maxHp;
  }

  get maxHp() {
    return Math.floor(((2 * this.baseStats.hp + this.iv.hp) * this.level) / 100) + this.level + 10;
  }

  calc(statName) {
    return Math.floor(((2 * this.baseStats[statName] + this.iv[statName]) * this.level) / 100) + 5;
  }

  gainXp(amount) {
    this.xp += amount;
    const needed = this.level * 16;
    let leveled = false;
    while (this.xp >= needed) {
      this.xp -= needed;
      this.level += 1;
      this.currentHp = this.maxHp;
      leveled = true;
    }
    return leveled;
  }

  heal(amount) {
    this.currentHp = clamp(this.currentHp + amount, 0, this.maxHp);
  }

  toJSON() {
    return { ...this };
  }

  static from(save) {
    const p = Object.create(PokemonInstance.prototype);
    Object.assign(p, save);
    return p;
  }
}

export class Player {
  constructor(name, starter) {
    this.name = name;
    this.level = 1;
    this.xp = 0;
    this.coins = 500;
    this.region = 1;
    this.badges = [];
    this.achievements = [];
    this.difficulty = 'normal';
    this.inventory = { pokeball: 10, potion: 5, revive: 2, greatball: 3 };
    this.team = [starter];
    this.pc = [];
    this.daily = { seed: new Date().toDateString(), completed: false, goal: 3, progress: 0 };
    this.soundOn = true;
  }

  addPokemon(pokemon) {
    if (this.team.length < 6) this.team.push(pokemon);
    else this.pc.push(pokemon);
  }

  gainTrainerXp(amount) {
    this.xp += amount;
    const needed = this.level * 50;
    if (this.xp >= needed) {
      this.level += 1;
      this.xp -= needed;
      return true;
    }
    return false;
  }

  grantAchievement(name) {
    if (!this.achievements.includes(name)) this.achievements.push(name);
  }

  useItem(item, target) {
    if (!this.inventory[item]) return false;
    if (item === 'potion') target.heal(20);
    if (item === 'revive' && target.currentHp <= 0) target.currentHp = Math.floor(target.maxHp * 0.5);
    this.inventory[item] -= 1;
    return true;
  }

  buy(item, cost) {
    if (this.coins < cost) return false;
    this.coins -= cost;
    this.inventory[item] = (this.inventory[item] || 0) + 1;
    return true;
  }

  toJSON() {
    return {
      ...this,
      team: this.team.map(p => p.toJSON()),
      pc: this.pc.map(p => p.toJSON())
    };
  }

  static from(save) {
    const p = Object.create(Player.prototype);
    Object.assign(p, save);
    p.team = save.team.map(PokemonInstance.from);
    p.pc = save.pc.map(PokemonInstance.from);
    return p;
  }
}
