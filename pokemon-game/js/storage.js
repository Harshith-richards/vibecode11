import { STORAGE_KEY, safeJSONParse } from './utils.js';

export const Storage = {
  load() {
    return safeJSONParse(localStorage.getItem(STORAGE_KEY), null);
  },
  save(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  },
  clear() {
    localStorage.removeItem(STORAGE_KEY);
  },
  loadLeaderboard() {
    return safeJSONParse(localStorage.getItem('pokelite-leaderboard'), []);
  },
  saveLeaderboard(rows) {
    localStorage.setItem('pokelite-leaderboard', JSON.stringify(rows.slice(0, 10)));
  }
};
