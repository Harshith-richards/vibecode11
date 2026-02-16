import { pick, rand } from './utils.js';

const API_BASE = 'https://pokeapi.co/api/v2';
const mem = new Map();

const fallbackStarters = [
  { id: 1, name: 'bulbasaur' },
  { id: 4, name: 'charmander' },
  { id: 7, name: 'squirtle' }
];

async function fetchJSON(url) {
  if (mem.has(url)) return mem.get(url);
  const key = `cache:${url}`;
  const cached = localStorage.getItem(key);
  if (cached) {
    const parsed = JSON.parse(cached);
    mem.set(url, parsed);
    return parsed;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error for ${url}`);
  const json = await res.json();
  mem.set(url, json);
  localStorage.setItem(key, JSON.stringify(json));
  return json;
}

export async function getStarterOptions() {
  try {
    return Promise.all(fallbackStarters.map(x => getPokemonById(x.id)));
  } catch {
    return fallbackStarters.map((p, idx) => ({
      id: p.id,
      name: p.name,
      sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png`,
      types: [idx === 0 ? 'grass' : idx === 1 ? 'fire' : 'water'],
      stats: { hp: 45, attack: 49, defense: 49, speed: 45 },
      moves: ['tackle'],
      rarity: 1
    }));
  }
}

function normalizePokemon(raw) {
  const stat = n => raw.stats.find(s => s.stat.name === n)?.base_stat ?? 40;
  const moves = raw.moves.slice(0, 12).map(m => m.move.name);
  return {
    id: raw.id,
    name: raw.name,
    sprite: raw.sprites?.front_default || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${raw.id}.png`,
    shinySprite: raw.sprites?.front_shiny,
    types: raw.types.map(t => t.type.name),
    stats: {
      hp: stat('hp'),
      attack: stat('attack'),
      defense: stat('defense'),
      speed: stat('speed')
    },
    moves: moves.length ? moves : ['tackle'],
    rarity: Math.max(1, Math.floor(raw.base_experience / 80))
  };
}

export async function getPokemonById(id) {
  const raw = await fetchJSON(`${API_BASE}/pokemon/${id}`);
  return normalizePokemon(raw);
}

export async function getRandomPokemon(levelBand = [2, 25]) {
  const roll = rand(1, 1010);
  const poke = await getPokemonById(roll);
  poke.level = rand(levelBand[0], levelBand[1]);
  return poke;
}

export async function getPokemonPool(offset = 0, limit = 30) {
  const list = await fetchJSON(`${API_BASE}/pokemon?offset=${offset}&limit=${limit}`);
  return list.results;
}

export async function getMoveData(moveName) {
  try {
    const move = await fetchJSON(`${API_BASE}/move/${moveName}`);
    const dmgClass = move.damage_class?.name || 'physical';
    return {
      name: move.name,
      power: move.power ?? 45,
      type: move.type?.name ?? 'normal',
      accuracy: (move.accuracy ?? 95) / 100,
      dmgClass,
      effectChance: (move.effect_chance ?? 0) / 100
    };
  } catch {
    return { name: moveName, power: pick([35, 40, 50]), type: 'normal', accuracy: 0.95, dmgClass: 'physical', effectChance: 0 };
  }
}
