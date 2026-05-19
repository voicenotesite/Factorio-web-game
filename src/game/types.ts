/** Identyfikator surowca występującego na mapie. */
export type ResourceType = 'iron' | 'copper' | 'coal' | 'stone' | 'wood' | 'oil' | 'water' | 'uranium';
/** Typ budowli, którą gracz może postawić. */
export type BuildingType = 'miner' | 'furnace' | 'assembler' | 'conveyor' | 'inserter' | 'storage' | 'power_pole' | 'steam_engine' | 'boiler' | 'lab' | 'radar' | 'turret' | 'wall' | 'belt_junction' | 'splitter' | 'underground_belt' | 'pumpjack' | 'refinery' | 'chemical_plant' | 'pipe';
/** Rola NPC w rozgrywce. */
export type NPCType = 'worker' | 'scout' | 'trader' | 'guard' | 'settler';
/** Typ wrogiej jednostki. */
export type EnemyType = 'biter' | 'spitter' | 'worm' | 'behemoth' | 'spawner';
/** Nazwa biomu używanego przy generowaniu terenu. */
export type BiomeType = 'grass' | 'desert' | 'snow' | 'forest' | 'swamp' | 'volcanic';
/** Kierunek kardynalny (góra/dół/lewo/prawo). */
export type Direction = 'up' | 'down' | 'left' | 'right';
/** Alias dla identyfikatora przedmiotu (ItemId). */
export type ItemId = string;

/** Współrzędne 2D w przestrzeni gry (w pikselach lub kafelkach). */
export interface Position {
  /** Współrzędna X. */
  x: number;
  /** Współrzędna Y. */
  y: number;
}

/** Współrzędne chunka w siatce świata. */
export interface ChunkCoord {
  /** Indeks chunka w osi X. */
  cx: number;
  /** Indeks chunka w osi Y. */
  cy: number;
}

/** Pojedynczy kafelek na mapie — zawiera informacje o biomie, surowcu i postawionej budowli. */
export interface Tile {
  /** Pozycja X kafelka w siatce świata. */
  x: number;
  /** Pozycja Y kafelka w siatce świata. */
  y: number;
  /** Biom, do którego należy kafelek. */
  biome: BiomeType;
  /** Typ surowca występującego na kafelku (null = brak). */
  resource: ResourceType | null;
  /** Ilość surowca pozostałego do wydobycia. */
  resourceAmount: number;
  /** Klasa złoża surowca określająca jego wydajność. */
  resourceYield: 'depleted' | 'normal' | 'rich' | 'very_rich';
  /** Budowla postawiona na tym kafelku (null = puste pole). */
  building: Building | null;
  /** Poziom zanieczyszczenia kafelka (wpływa na agresję wrogów). */
  pollution: number;
  /** Poziom odkrycia kafelka (widoczność na minimapie). */
  visibility: number;
}

/** Budowla postawiona przez gracza na mapie. */
export interface Building {
  /** Unikalny identyfikator budowli. */
  id: string;
  /** Typ budowli. */
  type: BuildingType;
  /** Pozycja X budowli w siatce kafelków. */
  x: number;
  /** Pozycja Y budowli w siatce kafelków. */
  y: number;
  /** Kierunek ustawienia budowli. */
  direction: Direction;
  /** Obecne punkty wytrzymałości. */
  health: number;
  /** Maksymalna wytrzymałość. */
  maxHealth: number;
  /** Receptura aktualnie realizowana przez budowlę (null = brak). */
  recipe: Recipe | null;
  /** Postęp realizacji bieżącej receptury (0..1). */
  progress: number;
  /** Obecny poziom energii (paliwa / prądu). */
  energy: number;
  /** Maksymalna pojemność energetyczna. */
  maxEnergy: number;
  /** Ekwipunek wejściowy (surowce do przetworzenia). */
  inventory: InventorySlot[];
  /** Ekwipunek wyjściowy (gotowe produkty). */
  outputInventory: InventorySlot[];
  /** Czy budowla jest aktualnie aktywna. */
  isActive: boolean;
  /** Poziom ulepszenia budowli (np. zwiększona wydajność). */
  level: number;
}

/** Pojedynczy slot ekwipunku — para (przedmiot, ilość). */
export interface InventorySlot {
  /** Identyfikator przedmiotu. */
  itemId: ItemId;
  /** Liczba sztuk przedmiotu w slocie. */
  count: number;
}

/** Definicja receptury rzemieślniczej — co i w jakim czasie powstaje z jakich surowców. */
export interface Recipe {
  /** Unikalny identyfikator receptury. */
  id: string;
  /** Nazwa receptury wyświetlana w interfejsie. */
  name: string;
  /** Lista wymaganych surowców (wejście). */
  inputs: InventorySlot[];
  /** Lista produktów (wyjście). */
  outputs: InventorySlot[];
  /** Czas wykonania w tikach gry. */
  craftTime: number;
  /** Koszt energetyczny na jednostkę produktu. */
  energyCost: number;
  /** Kategoria receptury (np. "smelting", "crafting", "chemistry"). */
  category: string;
}

/** Stan pojedynczego odcinka taśmy transportującej przedmioty. */
export interface ConveyorState {
  /** Przedmiot aktualnie transportowany (null = pusta taśma). */
  itemId: ItemId | null;
  /** Postęp przesuwania przedmiotu wzdłuż odcinka (0..1). */
  progress: number;
  /** Kierunek transportu. */
  direction: Direction;
}

/** Niezależna postać NPC sterowana przez AI. */
export interface NPC {
  /** Unikalny identyfikator NPC. */
  id: string;
  /** Rola NPC określająca jego zachowanie. */
  type: NPCType;
  /** Aktualna pozycja X na mapie. */
  x: number;
  /** Aktualna pozycja Y na mapie. */
  y: number;
  /** Docelowa pozycja X (jeśli NPC się przemieszcza). */
  targetX: number;
  /** Docelowa pozycja Y (jeśli NPC się przemieszcza). */
  targetY: number;
  /** Obecne punkty wytrzymałości. */
  health: number;
  /** Maksymalna wytrzymałość. */
  maxHealth: number;
  /** Prędkość poruszania się. */
  speed: number;
  /** Aktualny stan aktywności NPC. */
  state: 'idle' | 'moving' | 'working' | 'building' | 'fleeing' | 'trading' | 'patrolling' | 'gathering';
  /** Ekwipunek NPC. */
  inventory: InventorySlot[];
  /** Współrzędna X domu / bazy NPC. */
  homeX: number;
  /** Współrzędna Y domu / bazy NPC. */
  homeY: number;
  /** Wyświetlane imię NPC. */
  name: string;
  /** Frakcja, do której należy NPC. */
  faction: string;
  /** Lista kwestii dialogowych dostępnych przy interakcji. */
  dialogue: string[];
  /** Licznik czasu bieżącego zadania. */
  taskTimer: number;
  /** Ścieżka do celu — lista punktów do odwiedzenia. */
  path: Position[];
  /** Indeks bieżącego punktu na ścieżce. */
  pathIndex: number;
}

/** Wroga jednostka (biter, spitter, worm, behemoth). */
export interface Enemy {
  /** Unikalny identyfikator wroga. */
  id: string;
  /** Typ wroga określający jego statystyki i zachowanie. */
  type: EnemyType;
  /** Pozycja X na mapie. */
  x: number;
  /** Pozycja Y na mapie. */
  y: number;
  /** Obecne punkty wytrzymałości. */
  health: number;
  /** Maksymalna wytrzymałość. */
  maxHealth: number;
  /** Siła ataku wroga. */
  attack: number;
  /** Prędkość poruszania się. */
  speed: number;
  /** Zasięg ataku. */
  range: number;
  /** Cel, do którego wróg zmierza (null = brak celu). */
  target: Position | null;
  /** Poziom ewolucji wroga (wpływa na trudność). */
  evolution: number;
  /** Aktualny stan aktywności. */
  state: 'idle' | 'moving' | 'attacking' | 'dying';
  /** Licznik odnowienia ataku w tikach. */
  attackCooldown: number;
  /** Identyfikator spawnera, który wygenerował tego wroga (null = naturalny). */
  spawnerId: string | null;
}

/** Gniazdo spawnujące wrogów (baza biterów/spitterów). */
export interface EnemySpawner {
  /** Unikalny identyfikator spawnera. */
  id: string;
  /** Pozycja X spawnera. */
  x: number;
  /** Pozycja Y spawnera. */
  y: number;
  /** Obecne punkty wytrzymałości. */
  health: number;
  /** Maksymalna wytrzymałość. */
  maxHealth: number;
  /** Licznik do następnego spawnu. */
  spawnTimer: number;
  /** Częstotliwość spawnu (im mniejsza wartość, tym częściej). */
  spawnRate: number;
  /** Poziom ewolucji spawnera (wpływa na siłę tworzonych wrogów). */
  evolution: number;
  /** Lista identyfikatorów wrogów wyprodukowanych przez ten spawner. */
  enemies: string[];
}

/** Efekt cząsteczkowy do celów wizualnych (dym, iskry, ogień, eksplozja itp.). */
export interface Particle {
  /** Pozycja X cząsteczki. */
  x: number;
  /** Pozycja Y cząsteczki. */
  y: number;
  /** Prędkość pozioma. */
  vx: number;
  /** Prędkość pionowa. */
  vy: number;
  /** Pozostały czas życia cząsteczki. */
  life: number;
  /** Maksymalny czas życia przy tworzeniu. */
  maxLife: number;
  /** Kolor cząsteczki w formacie CSS (#RRGGBB). */
  color: string;
  /** Rozmiar cząsteczki w pikselach. */
  size: number;
  /** Typ cząsteczki określający jej wygląd i zachowanie. */
  type: 'smoke' | 'spark' | 'fire' | 'resource' | 'explosion' | 'ambient';
}

/** Zdarzenie losowe występujące w świecie gry. */
export interface WorldEvent {
  /** Unikalny identyfikator zdarzenia. */
  id: string;
  /** Typ zdarzenia (meteor, najazd, migracja, odkrycie itp.). */
  type: 'meteor' | 'raid' | 'migration' | 'discovery' | 'trade_caravan' | 'earthquake' | 'resource_vein';
  /** Pozycja X zdarzenia. */
  x: number;
  /** Pozycja Y zdarzenia. */
  y: number;
  /** Licznik czasu do aktywacji / wygaśnięcia zdarzenia. */
  timer: number;
  /** Dodatkowe dane specyficzne dla danego typu zdarzenia. */
  data: Record<string, unknown>;
}

/** Węzeł drzewa technologicznego — definicja badania naukowego. */
export interface Research {
  /** Unikalny identyfikator badania. */
  id: string;
  /** Nazwa badania wyświetlana w interfejsie. */
  name: string;
  /** Opis badania. */
  description: string;
  /** Koszt w paczkach naukowych wymagany do odblokowania. */
  cost: InventorySlot[];
  /** Czas badania w tikach. */
  time: number;
  /** Lista identyfikatorów wymaganych badań poprzedzających. */
  prerequisites: string[];
  /** Czy badanie zostało już odblokowane. */
  unlocked: boolean;
  /** Postęp badania (0..1). */
  progress: number;
  /** Mapa efektów po odblokowaniu — nazwa efektu → wartość. */
  effects: Record<string, number>;
}

/** Stan gracza — pozycja, ekwipunek, statystyki i postępy. */
export interface PlayerState {
  /** Pozycja X gracza na mapie. */
  x: number;
  /** Pozycja Y gracza na mapie. */
  y: number;
  /** Obecne punkty wytrzymałości. */
  health: number;
  /** Maksymalna wytrzymałość. */
  maxHealth: number;
  /** Ekwipunek gracza. */
  inventory: InventorySlot[];
  /** Indeks wybranego slotu w pasku szybkiego dostępu. */
  selectedSlot: number;
  /** Kierunek, w którym patrzy gracz. */
  direction: Direction;
  /** Prędkość poruszania się gracza. */
  speed: number;
  /** Zasięg interakcji (sięgania) gracza. */
  reach: number;
  /** Mnożnik prędkości wydobycia. */
  miningSpeed: number;
  /** Mnożnik prędkości wytwarzania. */
  craftingSpeed: number;
  /** Punkty doświadczenia. */
  xp: number;
  /** Poziom gracza. */
  level: number;
  /** Waluta premium (płatności mikrotransakcyjne). */
  premiumCurrency: number;
  /** Klejnoty — dodatkowa waluta premium. */
  gems: number;
  /** Saldo konta premium. */
  premiumBalance: number;
  /** Poziom subskrypcji premium gracza. */
  premiumTier: 'free' | 'starter' | 'premium';
  /** Kosmetyki gracza (kolor skóry, kapelusz, efekt podążający). */
  cosmetics: { skinColor: string; hatType: string; trailEffect: string };
  /** Lista odblokowanych osiągnięć. */
  achievements: string[];
  /** Łączny czas gry w sekundach. */
  totalPlayTime: number;
}

/** Element w kolejce budowy — budowla oczekująca na postawienie przez NPC. */
export interface BuildQueueItem {
  /** Unikalny identyfikator zadania budowlanego. */
  id: string;
  /** Typ budowli do postawienia. */
  type: string;
  /** Docelowa pozycja X. */
  x: number;
  /** Docelowa pozycja Y. */
  y: number;
  /** Kierunek ustawienia budowli. */
  direction: Direction;
  /** Identyfikator NPC przypisanego do budowy (opcjonalne). */
  assignedNpcId?: string;
  /** Postęp budowy w procentach (0..100). */
  constructionProgress: number;
}

/** Kompletny stan gry — wszystkie dane potrzebne do zapisu/odtworzenia sesji. */
export interface GameState {
  /** Stan gracza. */
  player: PlayerState;
  /** Ustawienia kamery (przesunięcie i przybliżenie). */
  camera: { x: number; y: number; zoom: number };
  /** Mapa chunków — każdy chunk to siatka kafelków. */
  chunks: Map<string, Tile[][]>;
  /** Mapa wszystkich budowli na planszy. */
  buildings: Map<string, Building>;
  /** Mapa wszystkich NPC. */
  npcs: Map<string, NPC>;
  /** Mapa wszystkich wrogów. */
  enemies: Map<string, Enemy>;
  /** Mapa spawnerów wrogów. */
  spawners: Map<string, EnemySpawner>;
  /** Stan taśm transportujących — mapa identyfikator budowli → lista odcinków. */
  conveyors: Map<string, ConveyorState[]>;
  /** Lista aktywnych cząsteczek efektów wizualnych. */
  particles: Particle[];
  /** Lista aktywnych zdarzeń świata. */
  events: WorldEvent[];
  /** Drzewo technologiczne — mapa identyfikator → badanie. */
  research: Map<string, Research>;
  /** Bieżący tik gry (numer klatki symulacji). */
  tick: number;
  /** Globalny poziom zanieczyszczenia. */
  pollution: number;
  /** Globalny poziom ewolucji wrogów (0..1). */
  evolution: number;
  /** Sieć energetyczna — mapa identyfikator sieci → produkcja / konsumpcja / magazyn. */
  powerGrid: Map<string, { production: number; consumption: number; stored: number }>;
  /** Bieżący czas w cyklu dobowym (w tikach od północy). */
  dayTime: number;
  /** Długość dnia w tikach. */
  dayLength: number;
  /** Aktualna pogoda. */
  weather: 'clear' | 'rain' | 'storm' | 'fog';
  /** Licznik zmiany pogody. */
  weatherTimer: number;
  /** Statystyki rozgrywki. */
  statistics: {
    itemsProduced: Record<string, number>;
    itemsConsumed: Record<string, number>;
    enemiesKilled: number;
    buildingsPlaced: number;
    timePlayed: number;
  };
  /** Lista powiadomień dla gracza. */
  notifications: { text: string; timer: number; type?: 'info' | 'error' | 'success' | 'build' }[];
  /** Kolejka budowy. */
  buildQueue: BuildQueueItem[];
  /** Ziarno generowania świata. */
  worldSeed: number;
  /** Odwiedzający w trybie kooperacji (opcjonalne). */
  coopVisitors?: Map<string, { username: string; x: number; y: number; color: string }>;
}
