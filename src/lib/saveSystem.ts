import { GameState } from '../game/types';
import { supabase } from './supabase';
import { getCurrentUserId } from './auth';

export interface SaveData {
  version: number;
  timestamp: number;
  username: string;
  tick: number;
  player: GameState['player'];
  pollution: number;
  evolution: number;
  dayTime: number;
  weather: GameState['weather'];
  statistics: GameState['statistics'];
  buildings: [string, unknown][];
  conveyors: [string, unknown][];
  research: [string, unknown][];
  npcs: [string, unknown][];
  buildQueue: GameState['buildQueue'];
}

function getSaveKey(username: string): string {
  return `novactorio_save_${username.toLowerCase()}`;
}

export function saveGame(username: string, state: GameState): void {
  const data: SaveData = {
    version: 2,
    timestamp: Date.now(),
    username,
    tick: state.tick,
    player: { ...state.player },
    pollution: state.pollution,
    evolution: state.evolution,
    dayTime: state.dayTime,
    weather: state.weather,
    statistics: { ...state.statistics },
    buildings: Array.from(state.buildings.entries()),
    conveyors: Array.from(state.conveyors.entries()),
    research: Array.from(state.research.entries()).map(([k, v]) => [k, { ...v }]),
    npcs: Array.from(state.npcs.entries()),
    buildQueue: [],  // intentionally not persisted — NPC orders reset on logout
  };
  localStorage.setItem(getSaveKey(username), JSON.stringify(data));

  // Push snapshot to Supabase for world sharing (fire and forget)
  const uid = getCurrentUserId();
  if (uid) {
    const worldData = JSON.stringify({
      v: 1,
      seed: state.worldSeed,
      buildings: Array.from(state.buildings.entries()),
    });
    supabase.from('world_snapshots').upsert({
      user_id: uid,
      username,
      tick: state.tick,
      building_count: state.buildings.size,
      world_data: worldData,
      updated_at: new Date().toISOString(),
    }).then(() => {});
  }
}

export function loadGame(username: string): SaveData | null {
  const raw = localStorage.getItem(getSaveKey(username));
  if (!raw) return null;
  try { return JSON.parse(raw) as SaveData; } catch { return null; }
}

export function deleteSave(username: string): void {
  localStorage.removeItem(getSaveKey(username));
}

export function hasSave(username: string): boolean {
  return !!localStorage.getItem(getSaveKey(username));
}

export function getSaveInfo(username: string): { timestamp: number; tick: number } | null {
  const save = loadGame(username);
  if (!save) return null;
  return { timestamp: save.timestamp, tick: save.tick };
}
