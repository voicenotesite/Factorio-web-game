import { GameState } from '../game/types';
import { supabase } from './supabase';
import { getCurrentUserId } from './auth';

/** Struktura danych zapisu gry (wersja 2). */
export interface SaveData {
  /** Wersja formatu zapisu. */
  version: number;
  /** Timestamp zapisu (Date.now()). */
  timestamp: number;
  /** Nazwa użytkownika. */
  username: string;
  /** Tick gry w momencie zapisu. */
  tick: number;
  /** Stan gracza. */
  player: GameState['player'];
  /** Globalny poziom zanieczyszczenia. */
  pollution: number;
  /** Poziom ewolucji wrogów. */
  evolution: number;
  /** Aktualna pora dnia (0-1). */
  dayTime: number;
  /** Aktualna pogoda. */
  weather: GameState['weather'];
  /** Statystyki gry. */
  statistics: GameState['statistics'];
  /** Lista budynków (entries Map). */
  buildings: [string, unknown][];
  /** Lista taśmociągów (entries Map). */
  conveyors: [string, unknown][];
  /** Lista badań (entries Map). */
  research: [string, unknown][];
  /** Lista NPC (entries Map). */
  npcs: [string, unknown][];
  /** Kolejka budowy (celowo pusta – NPC orders reset na wylogowaniu). */
  buildQueue: GameState['buildQueue'];
}

/** Zwraca klucz localStorage dla danego użytkownika. */
function getSaveKey(username: string): string {
  return `novactorio_save_${username.toLowerCase()}`;
}

/**
 * Zapisuje grę do localStorage i wysyła kopię zapasową do Supabase.
 * buildQueue nie jest zapisywane celowo – resetuje się przy wylogowaniu.
 * @param username Nazwa użytkownika.
 * @param state Aktualny stan gry.
 */
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
    buildQueue: [],
  };
  localStorage.setItem(getSaveKey(username), JSON.stringify(data));

  // Kopia zapasowa do Supabase (fire-and-forget)
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
      save_data: JSON.stringify(data),
      updated_at: new Date().toISOString(),
    }).then(({ error }) => {
      if (error) console.warn('[Save] Cloud backup failed:', error.message);
    });
  }
}

/**
 * Wczytuje zapis gry z localStorage.
 * @param username Nazwa użytkownika.
 * @returns Obiekt SaveData lub null.
 */
export function loadGame(username: string): SaveData | null {
  const raw = localStorage.getItem(getSaveKey(username));
  if (!raw) return null;
  try { return JSON.parse(raw) as SaveData; } catch { return null; }
}

/** Usuwa zapis gry dla danego użytkownika. */
export function deleteSave(username: string): void {
  localStorage.removeItem(getSaveKey(username));
}

/** Sprawdza czy istnieje zapis gry dla danego użytkownika. */
export function hasSave(username: string): boolean {
  return !!localStorage.getItem(getSaveKey(username));
}

/**
 * Próbuje przywrócić zapis z Supabase do localStorage.
 * @param uid Supabase UID użytkownika.
 * @param username Nazwa użytkownika.
 * @returns True jeśli udało się przywrócić.
 */
export async function restoreFromCloud(uid: string, username: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('world_snapshots')
      .select('save_data')
      .eq('user_id', uid)
      .single();
    if (error || !data?.save_data) return false;
    localStorage.setItem(getSaveKey(username), data.save_data);
    return true;
  } catch {
    return false;
  }
}

/**
 * Zwraca podstawowe info o zapisie (timestamp, tick) bez pełnego ładowania.
 * @param username Nazwa użytkownika.
 * @returns Obiekt z timestamp i tick lub null.
 */
export function getSaveInfo(username: string): { timestamp: number; tick: number } | null {
  const save = loadGame(username);
  if (!save) return null;
  return { timestamp: save.timestamp, tick: save.tick };
}
