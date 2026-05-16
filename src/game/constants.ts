export const TILE_SIZE = 32;
export const CHUNK_SIZE = 32;
export const RENDER_DISTANCE = 4;
export const MAX_PARTICLES = 2000;
export const NPC_MAX = 50;
export const ENEMY_MAX = 200;
export const SPAWNER_MAX = 20;

export const WORLD_SEED = 42;
export const DAY_LENGTH = 6000;

export const RESOURCE_COLORS: Record<string, string> = {
  iron: '#8B7355',
  copper: '#B87333',
  coal: '#2C2C2C',
  stone: '#808080',
  wood: '#8B4513',
  oil: '#1a1a2e',
  water: '#4169E1',
  uranium: '#00FF00',
  iron_plate: '#c0c0c0',
  copper_plate: '#e8a060',
  steel_plate: '#a0a0b0',
  gear: '#888888',
  circuit: '#00cc44',
  advanced_circuit: '#0088cc',
  battery: '#ccaa00',
  plastic: '#c0c0d0',
  sulfuric_acid: '#cc8800',
  conveyor_belt: '#888888',
  inserter_item: '#ffcc00',
  miner_item: '#c0c0c0',
  furnace_item: '#ff6600',
  science_red: '#ff3333',
  science_green: '#33ff33',
  science_blue: '#3366ff',
  ammo: '#cc6600',
  wall_item: '#666666',
  turret_item: '#ff3333',
  petroleum_gas: '#88ccff',
  light_oil: '#aaddaa',
  heavy_oil: '#886644',
};

export const BIOME_COLORS: Record<string, string> = {
  grass: '#4a7c3f',
  desert: '#c2b280',
  snow: '#e8e8e8',
  forest: '#2d5a1e',
  swamp: '#3a5a3a',
  volcanic: '#4a2a2a',
};

export const BUILDING_COLORS: Record<string, string> = {
  miner: '#5a5a50',
  furnace: '#3a1a0a',
  assembler: '#1a2a3a',
  conveyor: '#3a3830',
  inserter: '#4a3a10',
  storage: '#2a2218',
  power_pole: '#2a2a28',
  steam_engine: '#1a2030',
  boiler: '#2a1808',
  lab: '#081828',
  radar: '#182818',
  turret: '#281010',
  wall: '#3a3838',
  belt_junction: '#3a3830',
  splitter: '#404038',
  underground_belt: '#303028',
  pumpjack: '#1e1a10',
  refinery: '#182030',
  chemical_plant: '#18101e',
  pipe: '#1a1a1a',
};

export const BUILDING_SIZES: Record<string, { w: number; h: number }> = {
  miner: { w: 2, h: 2 },
  furnace: { w: 2, h: 2 },
  assembler: { w: 3, h: 3 },
  conveyor: { w: 1, h: 1 },
  inserter: { w: 1, h: 1 },
  storage: { w: 2, h: 2 },
  power_pole: { w: 1, h: 1 },
  steam_engine: { w: 3, h: 2 },
  boiler: { w: 2, h: 2 },
  lab: { w: 3, h: 3 },
  radar: { w: 2, h: 2 },
  turret: { w: 2, h: 2 },
  wall: { w: 1, h: 1 },
  belt_junction: { w: 1, h: 1 },
  splitter: { w: 2, h: 1 },
  underground_belt: { w: 1, h: 1 },
  pumpjack: { w: 2, h: 2 },
  refinery: { w: 3, h: 3 },
  chemical_plant: { w: 2, h: 2 },
  pipe: { w: 1, h: 1 },
};

export const BUILDING_HEALTH: Record<string, number> = {
  miner: 300,
  furnace: 200,
  assembler: 250,
  conveyor: 100,
  inserter: 100,
  storage: 350,
  power_pole: 75,
  steam_engine: 300,
  boiler: 250,
  lab: 200,
  radar: 150,
  turret: 400,
  wall: 500,
  belt_junction: 100,
  splitter: 100,
  underground_belt: 100,
  pumpjack: 250,
  refinery: 300,
  chemical_plant: 200,
  pipe: 100,
};

export const RECIPES: Record<string, {
  id: string; name: string; inputs: { itemId: string; count: number }[];
  outputs: { itemId: string; count: number }[]; craftTime: number; energyCost: number; category: string;
}> = {
  iron_plate: { id: 'iron_plate', name: 'Iron Plate', inputs: [{ itemId: 'iron', count: 1 }], outputs: [{ itemId: 'iron_plate', count: 1 }], craftTime: 60, energyCost: 1, category: 'smelting' },
  copper_plate: { id: 'copper_plate', name: 'Copper Plate', inputs: [{ itemId: 'copper', count: 1 }], outputs: [{ itemId: 'copper_plate', count: 1 }], craftTime: 60, energyCost: 1, category: 'smelting' },
  steel_plate: { id: 'steel_plate', name: 'Steel Plate', inputs: [{ itemId: 'iron_plate', count: 5 }], outputs: [{ itemId: 'steel_plate', count: 1 }], craftTime: 300, energyCost: 2, category: 'smelting' },
  gear: { id: 'gear', name: 'Gear Wheel', inputs: [{ itemId: 'iron_plate', count: 2 }], outputs: [{ itemId: 'gear', count: 1 }], craftTime: 30, energyCost: 1, category: 'crafting' },
  circuit: { id: 'circuit', name: 'Electronic Circuit', inputs: [{ itemId: 'copper_plate', count: 3 }, { itemId: 'iron_plate', count: 1 }], outputs: [{ itemId: 'circuit', count: 1 }], craftTime: 60, energyCost: 1, category: 'crafting' },
  advanced_circuit: { id: 'advanced_circuit', name: 'Advanced Circuit', inputs: [{ itemId: 'circuit', count: 2 }, { itemId: 'copper_plate', count: 2 }, { itemId: 'plastic', count: 2 }], outputs: [{ itemId: 'advanced_circuit', count: 1 }], craftTime: 120, energyCost: 2, category: 'crafting' },
  battery: { id: 'battery', name: 'Battery', inputs: [{ itemId: 'copper_plate', count: 1 }, { itemId: 'iron_plate', count: 1 }, { itemId: 'sulfuric_acid', count: 2 }], outputs: [{ itemId: 'battery', count: 1 }], craftTime: 180, energyCost: 2, category: 'chemistry' },
  plastic: { id: 'plastic', name: 'Plastic Bar', inputs: [{ itemId: 'coal', count: 1 }, { itemId: 'oil', count: 3 }], outputs: [{ itemId: 'plastic', count: 2 }], craftTime: 60, energyCost: 1, category: 'chemistry' },
  conveyor_belt: { id: 'conveyor_belt', name: 'Conveyor Belt', inputs: [{ itemId: 'iron_plate', count: 1 }, { itemId: 'gear', count: 1 }], outputs: [{ itemId: 'conveyor_belt', count: 2 }], craftTime: 30, energyCost: 0.5, category: 'crafting' },
  inserter_item: { id: 'inserter_item', name: 'Inserter', inputs: [{ itemId: 'iron_plate', count: 1 }, { itemId: 'gear', count: 1 }, { itemId: 'circuit', count: 1 }], outputs: [{ itemId: 'inserter_item', count: 1 }], craftTime: 60, energyCost: 1, category: 'crafting' },
  miner_item: { id: 'miner_item', name: 'Mining Drill', inputs: [{ itemId: 'iron_plate', count: 3 }, { itemId: 'gear', count: 3 }, { itemId: 'circuit', count: 1 }], outputs: [{ itemId: 'miner_item', count: 1 }], craftTime: 120, energyCost: 2, category: 'crafting' },
  furnace_item: { id: 'furnace_item', name: 'Furnace', inputs: [{ itemId: 'stone', count: 5 }, { itemId: 'iron_plate', count: 2 }], outputs: [{ itemId: 'furnace_item', count: 1 }], craftTime: 90, energyCost: 1, category: 'crafting' },
  science_red: { id: 'science_red', name: 'Red Science Pack', inputs: [{ itemId: 'gear', count: 1 }, { itemId: 'copper_plate', count: 1 }], outputs: [{ itemId: 'science_red', count: 1 }], craftTime: 60, energyCost: 1, category: 'crafting' },
  science_green: { id: 'science_green', name: 'Green Science Pack', inputs: [{ itemId: 'conveyor_belt', count: 1 }, { itemId: 'inserter_item', count: 1 }], outputs: [{ itemId: 'science_green', count: 1 }], craftTime: 120, energyCost: 1, category: 'crafting' },
  science_blue: { id: 'science_blue', name: 'Blue Science Pack', inputs: [{ itemId: 'advanced_circuit', count: 1 }, { itemId: 'gear', count: 1 }, { itemId: 'sulfuric_acid', count: 1 }], outputs: [{ itemId: 'science_blue', count: 1 }], craftTime: 300, energyCost: 2, category: 'crafting' },
  sulfuric_acid: { id: 'sulfuric_acid', name: 'Sulfuric Acid', inputs: [{ itemId: 'iron_plate', count: 1 }, { itemId: 'water', count: 2 }, { itemId: 'oil', count: 1 }], outputs: [{ itemId: 'sulfuric_acid', count: 2 }], craftTime: 60, energyCost: 1, category: 'chemistry' },
  ammo: { id: 'ammo', name: 'Firearm Magazine', inputs: [{ itemId: 'iron_plate', count: 4 }], outputs: [{ itemId: 'ammo', count: 1 }], craftTime: 30, energyCost: 1, category: 'military' },
  wall_item: { id: 'wall_item', name: 'Wall', inputs: [{ itemId: 'stone', count: 5 }], outputs: [{ itemId: 'wall_item', count: 1 }], craftTime: 30, energyCost: 0.5, category: 'crafting' },
  turret_item: { id: 'turret_item', name: 'Gun Turret', inputs: [{ itemId: 'iron_plate', count: 5 }, { itemId: 'gear', count: 5 }, { itemId: 'copper_plate', count: 5 }], outputs: [{ itemId: 'turret_item', count: 1 }], craftTime: 180, energyCost: 2, category: 'military' },
};

export const RESEARCH_TREE: Record<string, {
  id: string; name: string; description: string; cost: { itemId: string; count: number }[];
  time: number; prerequisites: string[]; effects: Record<string, number>;
}> = {
  automation: { id: 'automation', name: 'Automation', description: 'Basic automation technology', cost: [{ itemId: 'science_red', count: 10 }], time: 600, prerequisites: [], effects: { miningSpeed: 1.2 } },
  logistics: { id: 'logistics', name: 'Logistics', description: 'Improved logistics systems', cost: [{ itemId: 'science_red', count: 20 }], time: 900, prerequisites: ['automation'], effects: { beltSpeed: 1.5 } },
  electronics: { id: 'electronics', name: 'Electronics', description: 'Advanced circuit production', cost: [{ itemId: 'science_red', count: 15 }, { itemId: 'science_green', count: 10 }], time: 1200, prerequisites: ['automation'], effects: { craftingSpeed: 1.3 } },
  steel_processing: { id: 'steel_processing', name: 'Steel Processing', description: 'Unlock steel production', cost: [{ itemId: 'science_red', count: 20 }], time: 600, prerequisites: [], effects: { unlockSteel: 1 } },
  military: { id: 'military', name: 'Military', description: 'Basic military technology', cost: [{ itemId: 'science_red', count: 10 }, { itemId: 'science_green', count: 10 }], time: 900, prerequisites: [], effects: { turretDamage: 1.5 } },
  oil_processing: { id: 'oil_processing', name: 'Oil Processing', description: 'Unlock oil processing', cost: [{ itemId: 'science_green', count: 20 }], time: 1200, prerequisites: ['logistics', 'steel_processing'], effects: { unlockOil: 1 } },
  advanced_electronics: { id: 'advanced_electronics', name: 'Advanced Electronics', description: 'Advanced circuit technology', cost: [{ itemId: 'science_green', count: 20 }, { itemId: 'science_blue', count: 5 }], time: 1800, prerequisites: ['electronics', 'oil_processing'], effects: { craftingSpeed: 1.5, assemblerSpeed: 1.3 } },
  weapon_upgrade: { id: 'weapon_upgrade', name: 'Weapon Upgrades', description: 'Improved weapons', cost: [{ itemId: 'science_green', count: 15 }, { itemId: 'science_blue', count: 10 }], time: 1500, prerequisites: ['military', 'advanced_electronics'], effects: { turretDamage: 2.0, playerDamage: 1.5 } },
  power_armor: { id: 'power_armor', name: 'Power Armor', description: 'Advanced protection', cost: [{ itemId: 'science_blue', count: 20 }, { itemId: 'science_green', count: 30 }], time: 2400, prerequisites: ['advanced_electronics', 'military'], effects: { playerHealth: 2.0, playerSpeed: 1.3 } },
  rocket_science: { id: 'rocket_science', name: 'Rocket Science', description: 'The final frontier', cost: [{ itemId: 'science_blue', count: 50 }, { itemId: 'science_green', count: 50 }, { itemId: 'science_red', count: 50 }], time: 3600, prerequisites: ['power_armor', 'weapon_upgrade', 'advanced_electronics'], effects: { victory: 1 } },
};

export const NPC_NAMES = [
  'Elena', 'Marcus', 'Sofia', 'Viktor', 'Aria', 'Dmitri', 'Luna', 'Kai',
  'Nadia', 'Rex', 'Zara', 'Finn', 'Mira', 'Axel', 'Ivy', 'Hugo',
  'Nova', 'Leo', 'Ada', 'Raven', 'Jade', 'Blaze', 'Echo', 'Storm',
];

export const NPC_DIALOGUES: Record<string, string[]> = {
  worker: [
    'Another day in the factory!',
    'The conveyor belts need maintenance.',
    'Production is running smoothly.',
    'I need more resources over here!',
    'Watch out for biters at night.',
  ],
  scout: [
    'I spotted a resource vein to the east!',
    'Enemies are gathering near the perimeter.',
    'The pollution is attracting more biters.',
    'I found an abandoned outpost!',
    'The terrain gets rough up north.',
  ],
  trader: [
    'Looking to trade? I have rare goods!',
    'Prices are fair, I promise.',
    'I can get you anything you need.',
    'Special discount for factory owners!',
    'My caravan travels far and wide.',
  ],
  guard: [
    'Perimeter is secure, for now.',
    'Stay alert, biters are restless.',
    'The walls are holding strong.',
    'I heard something in the bushes.',
    'Night watch is the hardest.',
  ],
  settler: [
    'This looks like a good place to settle.',
    'The factory provides, the factory protects.',
    'We should expand the walls further.',
    'I dream of green fields without pollution.',
    'Progress requires sacrifice.',
  ],
};

export const ENEMY_STATS: Record<string, { health: number; attack: number; speed: number; range: number }> = {
  biter: { health: 30, attack: 8, speed: 1.5, range: 1.2 },
  spitter: { health: 20, attack: 12, speed: 1.0, range: 5 },
  worm: { health: 100, attack: 20, speed: 0, range: 8 },
  behemoth: { health: 500, attack: 40, speed: 1.2, range: 1.5 },
  spawner: { health: 300, attack: 0, speed: 0, range: 0 },
};
