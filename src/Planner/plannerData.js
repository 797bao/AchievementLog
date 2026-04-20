/* ═══════════════════════════════════════
   PLANNER CONSTANTS & SAMPLE DATA
   ═══════════════════════════════════════ */

export const STATUSES = ['planned', 'progress', 'testing', 'done'];

export const STATUS_LABELS = {
  planned: 'Planned',
  progress: 'In Progress',
  testing: 'Testing',
  done: 'Done',
};

export const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const PUB = process.env.PUBLIC_URL || '';

export const TYPE_ICON_FILES = {
  art: `${PUB}/icons/Art.png`,
  anim: `${PUB}/icons/Animations.png`,
  script: `${PUB}/icons/Scripts.png`,
  fx: `${PUB}/icons/Effects.png`,
  rig: `${PUB}/icons/Rig.png`,
  scene: `${PUB}/icons/Scene.png`,
  props: `${PUB}/icons/Properties.png`,
  ui: `${PUB}/icons/Scripts.png`,
  prefab: `${PUB}/icons/Properties.png`,
  system: `${PUB}/icons/Scripts.png`,
};

export const CLICK_THRESHOLD = 5;
export const GRID_SIZE = 20;

export const STATUS_COLORS = {
  planned: '#9aa0a6',
  progress: '#D7681F',
  testing: '#fbbc04',
  done: '#34a853',
};

export const DEFAULT_COLOR_PALETTE = [
  '#4285f4', '#34a853', '#fbbc04', '#ea4335',
  '#9c27b0', '#00bcd4', '#ff9800', '#795548',
  '#607d8b', '#e91e63', '#3f51b5', '#009688',
  '#8ab4f8', '#81c995', '#fdd663', '#f28b82',
  '#c58af9', '#78d9ec', '#fcad70', '#bcaaa4',
];

/* ─── Blank starting state ─── */
export function createSampleMilestones() {
  return [
    {
      id: 'ms-' + Date.now(),
      name: 'Milestone 1',
      looseSystems: [],
      looseTasks: [],
      arrows: [],
      frames: [],
    },
  ];
}

/* ─── Sample milestone data (commented out — restore if needed) ─── */
/*
export function _createSampleMilestones() {
  return [
    {
      id: 'ms1',
      name: 'Milestone 1: Basic Melee Enemy Combat',
      looseSystems: [],
      looseTasks: [],
      frames: [
        {
          id: 'f0',
          standalone: true,
          systems: [
            {
              id: 'kairos-char',
              name: 'Kairos (Character)',
              children: [
                { id: 'k-art', name: 'Artwork', type: 'art', status: 'done', time: '2h', sprint: '2026-0', completedAt: '2026-0' },
                { id: 'k-rig', name: 'Spine2D Rig', type: 'rig', status: 'done', time: '4h', sprint: '2026-0', completedAt: '2026-0' },
                { id: 'k-move', name: 'Move Anim', type: 'anim', status: 'done', time: '2h', sprint: '2026-0', completedAt: '2026-1' },
                { id: 'k-idle', name: 'Idle Anim', type: 'anim', status: 'done', time: '2h', sprint: '2026-1', completedAt: '2026-1' },
                { id: 'k-script', name: 'Player Script', type: 'script', status: 'done', time: '3h', sprint: '2026-1', completedAt: '2026-1' },
              ],
            },
          ],
        },
        {
          id: 'f1',
          label: 'Core Systems',
          note: 'Can be worked in parallel',
          systems: [
            {
              id: 'card-sys',
              name: 'Card System',
              children: [
                {
                  id: 'card',
                  name: 'Card',
                  type: 'system',
                  isGroup: true,
                  children: [
                    { id: 'c-props', name: 'Properties', type: 'props', status: 'done', time: '1h', sprint: '2026-1', completedAt: '2026-1' },
                    { id: 'c-canplay', name: 'CanPlay Condition', type: 'script', status: 'done', time: '1h', sprint: '2026-1', completedAt: '2026-1' },
                    { id: 'c-onplay', name: 'OnPlay', type: 'script', status: 'done', time: '2h', sprint: '2026-1', completedAt: '2026-2' },
                    { id: 'c-ondraw', name: 'OnDraw', type: 'script', status: 'done', time: '1h', sprint: '2026-2', completedAt: '2026-2' },
                    { id: 'c-ondiscard', name: 'OnDiscard', type: 'script', status: 'done', time: '1h', sprint: '2026-2', completedAt: '2026-2' },
                  ],
                },
                {
                  id: 'card-mgr',
                  name: 'Card Manager',
                  type: 'system',
                  isGroup: true,
                  children: [
                    { id: 'cm-deck', name: 'Deck Pile', type: 'script', status: 'done', time: '2h', sprint: '2026-2', completedAt: '2026-2' },
                    { id: 'cm-discard', name: 'Discard Pile', type: 'script', status: 'done', time: '1h', sprint: '2026-2', completedAt: '2026-2' },
                    { id: 'cm-draw', name: 'Draw Card', type: 'script', status: 'done', time: '2h', sprint: '2026-2', completedAt: '2026-2' },
                    { id: 'cm-discard2', name: 'Discard Card', type: 'script', status: 'done', time: '1h', sprint: '2026-2', completedAt: '2026-2' },
                    { id: 'cm-shuffle', name: 'Shuffle Deck', type: 'script', status: 'done', time: '1h', sprint: '2026-2', completedAt: '2026-2' },
                    { id: 'cm-hand', name: 'Hand Pile Logic', type: 'script', status: 'progress', time: '3h', sprint: '2026-3', completedAt: null },
                    { id: 'cm-play', name: 'Play Card', type: 'script', status: 'progress', time: '2h', sprint: '2026-3', completedAt: null },
                  ],
                },
                { id: 'cs-draw-anim', name: 'Card Draw Anim', type: 'anim', status: 'done', time: '2h', sprint: '2026-2', completedAt: '2026-2' },
                { id: 'cs-stack-anim', name: 'Card Stack Anim', type: 'anim', status: 'done', time: '1h', sprint: '2026-2', completedAt: '2026-2' },
                { id: 'cs-play-anim', name: 'Card Play Anim', type: 'anim', status: 'done', time: '2h', sprint: '2026-2', completedAt: '2026-3' },
                { id: 'cs-hover-anim', name: 'Card Hover Anim', type: 'anim', status: 'done', time: '1h', sprint: '2026-3', completedAt: '2026-3' },
                { id: 'cs-playable', name: 'Card Playable Anim', type: 'anim', status: 'progress', time: '2h', sprint: '2026-3', completedAt: null },
                { id: 'cs-hover-logic', name: 'Card Hover Logic', type: 'script', status: 'done', time: '2h', sprint: '2026-3', completedAt: '2026-3' },
                { id: 'cs-hand-ui', name: 'UI Hand Placement', type: 'ui', status: 'done', time: '3h', sprint: '2026-3', completedAt: '2026-3' },
                { id: 'cs-hover-desc', name: 'Hover Description', type: 'ui', status: 'planned', time: '2h', sprint: '2026-3', completedAt: null },
              ],
            },
            {
              id: 'grid-sys',
              name: 'Grid System',
              children: [
                {
                  id: 'grid-mgr',
                  name: 'Grid Manager',
                  type: 'system',
                  isGroup: true,
                  children: [
                    { id: 'gm-pos', name: 'GetGridPos', type: 'script', status: 'done', time: '1h', sprint: '2026-1', completedAt: '2026-1' },
                    { id: 'gm-reg', name: 'RegisterUnit', type: 'script', status: 'done', time: '1h', sprint: '2026-1', completedAt: '2026-1' },
                    { id: 'gm-unreg', name: 'UnRegisterUnit', type: 'script', status: 'done', time: '1h', sprint: '2026-1', completedAt: '2026-1' },
                    { id: 'gm-gen', name: 'GenerateGrid', type: 'script', status: 'done', time: '2h', sprint: '2026-1', completedAt: '2026-2' },
                    { id: 'gm-dir', name: 'GetMouseDir', type: 'script', status: 'done', time: '1h', sprint: '2026-2', completedAt: '2026-2' },
                    { id: 'gm-coord', name: 'GetMouseCoord', type: 'script', status: 'done', time: '1h', sprint: '2026-2', completedAt: '2026-2' },
                  ],
                },
                {
                  id: 'player-tile',
                  name: 'Player Tile',
                  type: 'system',
                  isGroup: true,
                  children: [
                    { id: 'pt-move', name: 'Move Clip To Grid', type: 'anim', status: 'done', time: '2h', sprint: '2026-2', completedAt: '2026-2' },
                    { id: 'pt-fx', name: 'Effect', type: 'fx', status: 'done', time: '1h', sprint: '2026-2', completedAt: '2026-2' },
                    { id: 'pt-pulse', name: 'Pulse Animation', type: 'anim', status: 'done', time: '1h', sprint: '2026-2', completedAt: '2026-2' },
                  ],
                },
                {
                  id: 'enemy-tile',
                  name: 'Enemy Tile',
                  type: 'system',
                  isGroup: true,
                  children: [
                    { id: 'et-enable', name: 'Enable', type: 'script', status: 'done', time: '1h', sprint: '2026-2', completedAt: '2026-2' },
                    { id: 'et-fx', name: 'Effect', type: 'fx', status: 'done', time: '1h', sprint: '2026-2', completedAt: '2026-2' },
                    { id: 'et-pulse', name: 'Pulse Animation', type: 'anim', status: 'done', time: '1h', sprint: '2026-2', completedAt: '2026-3' },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: 'f2',
          label: 'Content & Combat',
          note: 'Can be worked in parallel',
          systems: [
            {
              id: 'enemy-sys',
              name: 'Enemy System',
              children: [
                {
                  id: 'enemy1',
                  name: 'Enemy 1',
                  type: 'system',
                  isGroup: true,
                  children: [
                    { id: 'e1-art', name: 'Artwork', type: 'art', status: 'done', time: '15m', sprint: '2026-3', completedAt: '2026-3' },
                    { id: 'e1-props', name: 'Properties', type: 'props', status: 'done', time: '15m', sprint: '2026-3', completedAt: '2026-3' },
                  ],
                },
                {
                  id: 'enemy-heart',
                  name: 'Enemy Heart UI',
                  type: 'system',
                  isGroup: true,
                  children: [
                    { id: 'eh-art', name: 'Artwork', type: 'art', status: 'progress', time: '1h', sprint: '2026-3', completedAt: null },
                    { id: 'eh-hit', name: 'OnHit Animation', type: 'anim', status: 'planned', time: '1h', sprint: '2026-3', completedAt: null },
                    { id: 'eh-scale', name: 'Scale/Fill Follow Logic', type: 'script', status: 'planned', time: '1h', sprint: null, completedAt: null },
                  ],
                },
                { id: 'es-onhit', name: 'Global On Hit Anim', type: 'anim', status: 'planned', time: '45m', sprint: null, completedAt: null },
                { id: 'es-attack', name: 'Global Attack Anim', type: 'anim', status: 'planned', time: '45m', sprint: null, completedAt: null },
                { id: 'es-death', name: 'Global Death Anim', type: 'anim', status: 'planned', time: '30m', sprint: null, completedAt: null },
                {
                  id: 'enemy-intent',
                  name: 'Enemy Intent Indicator',
                  type: 'system',
                  isGroup: true,
                  children: [
                    { id: 'ei-atk', name: 'Attack Intent', type: 'art', status: 'planned', time: '30m', sprint: null, completedAt: null },
                    { id: 'ei-def', name: 'Defend Intent', type: 'art', status: 'planned', time: '30m', sprint: null, completedAt: null },
                    { id: 'ei-buff', name: 'Buff Intent', type: 'art', status: 'planned', time: '30m', sprint: null, completedAt: null },
                  ],
                },
              ],
            },
            {
              id: 'kairos-basic',
              name: 'Kairos Basic Card',
              children: [
                { id: 'kb-art', name: 'Card Artwork', type: 'art', status: 'planned', time: '2h', sprint: null, completedAt: null },
                { id: 'kb-atk1', name: 'Kairos Attack Anim 1', type: 'anim', status: 'planned', time: '1.5h', sprint: null, completedAt: null },
                { id: 'kb-atk2', name: 'Kairos Attack Anim 2', type: 'anim', status: 'planned', time: '1.5h', sprint: null, completedAt: null },
                { id: 'kb-trans', name: 'Anim State Transition', type: 'anim', status: 'planned', time: '1h', sprint: null, completedAt: null },
                { id: 'kb-fx', name: 'Card Attack Effect', type: 'fx', status: 'planned', time: '1h', sprint: null, completedAt: null },
                { id: 'kb-logic', name: 'Attack Card Logic', type: 'script', status: 'planned', time: '1h', sprint: null, completedAt: null },
              ],
            },
            {
              id: 'health-mana',
              name: 'Health & Mana',
              children: [
                { id: 'hm-hart', name: 'Health Artwork', type: 'art', status: 'done', time: '1h', sprint: '2026-3', completedAt: '2026-3' },
                { id: 'hm-mart', name: 'Mana Artwork', type: 'art', status: 'done', time: '1h', sprint: '2026-3', completedAt: '2026-3' },
                { id: 'hm-manim', name: 'Mana Animation', type: 'anim', status: 'progress', time: '2h', sprint: '2026-3', completedAt: null },
              ],
            },
          ],
        },
        {
          id: 'f3',
          label: 'Abilities & Effects',
          note: 'Can be worked in parallel',
          systems: [
            {
              id: 'kairos-prune',
              name: 'Kairos Prune Ability',
              children: [
                { id: 'kp-chan', name: 'Kairos Channel Animation', type: 'anim', status: 'progress', time: '2h', sprint: '2026-3', completedAt: null },
                { id: 'kp-prune', name: 'Kairos Prune Animation', type: 'anim', status: 'progress', time: '2h', sprint: '2026-3', completedAt: null },
                { id: 'kp-blast', name: 'Kairos Prune Blast', type: 'fx', status: 'planned', time: '1h', sprint: null, completedAt: null },
                { id: 'kp-pruning', name: 'Card Pruning Animation', type: 'anim', status: 'planned', time: '1h', sprint: null, completedAt: null },
                { id: 'kp-pruned', name: 'Card Pruned Animation', type: 'anim', status: 'planned', time: '1h', sprint: null, completedAt: null },
                { id: 'kp-logic', name: 'Kairos Prune Logic', type: 'script', status: 'planned', time: '1.5h', sprint: null, completedAt: null },
                { id: 'kp-tile', name: 'Kairos Prune Tile', type: 'prefab', status: 'planned', time: '30m', sprint: null, completedAt: null },
                { id: 'kp-tlogic', name: 'Kairos Prune Tile Logic', type: 'script', status: 'planned', time: '1h', sprint: null, completedAt: null },
              ],
            },
            {
              id: 'kairos-bonk',
              name: 'Kairos Bonk Card',
              children: [
                { id: 'kbk-art', name: 'Card Artwork', type: 'art', status: 'planned', time: '1h', sprint: null, completedAt: null },
                { id: 'kbk-fx', name: 'Card Attack Effect', type: 'fx', status: 'planned', time: '1h', sprint: null, completedAt: null },
                { id: 'kbk-logic', name: 'Bonk Card Logic', type: 'script', status: 'planned', time: '1h', sprint: null, completedAt: null },
              ],
            },
            {
              id: 'kairos-fx',
              name: 'Kairos (Effects)',
              children: [
                { id: 'kfx-hit', name: 'On Hit Animation', type: 'anim', status: 'planned', time: '2h', sprint: null, completedAt: null },
                { id: 'kfx-death', name: 'Death Animation', type: 'anim', status: 'planned', time: '2h', sprint: null, completedAt: null },
                { id: 'kfx-unplay', name: 'Card Unplayable Animation', type: 'anim', status: 'progress', time: '1h', sprint: '2026-3', completedAt: null },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'ms2',
      name: 'Milestone 2: Dungeon Traversal & More Enemies',
      looseSystems: [],
      looseTasks: [],
      frames: [
        {
          id: 'f2-enemies',
          label: 'Enemies',
          systems: [
            {
              id: 'enemy2-ranged',
              name: 'Enemy 2 Ranged',
              children: [
                { id: 'e2-art', name: 'Artwork', type: 'art', status: 'planned', time: '3h', sprint: null, completedAt: null },
                { id: 'e2-logic', name: 'Enemy Logic', type: 'script', status: 'planned', time: '3h', sprint: null, completedAt: null },
                { id: 'e2-ncb', name: 'Non-Combat Behavior', type: 'script', status: 'planned', time: '2h', sprint: null, completedAt: null },
              ],
            },
            {
              id: 'enemy3-zoner',
              name: 'Enemy 3 Zoner',
              children: [
                { id: 'e3-art', name: 'Artwork', type: 'art', status: 'planned', time: '3h', sprint: null, completedAt: null },
                { id: 'e3-logic', name: 'Enemy Logic', type: 'script', status: 'planned', time: '3h', sprint: null, completedAt: null },
                { id: 'e3-zone', name: 'Zone Indicator Effect', type: 'fx', status: 'planned', time: '1h', sprint: null, completedAt: null },
              ],
            },
            {
              id: 'enemy4',
              name: 'Enemy 4 ??',
              children: [
                { id: 'e4-art', name: 'Artwork', type: 'art', status: 'planned', time: '3h', sprint: null, completedAt: null },
                { id: 'e4-logic', name: 'Enemy Logic', type: 'script', status: 'planned', time: '3h', sprint: null, completedAt: null },
              ],
            },
          ],
        },
        {
          id: 'f2-ai',
          label: 'Enemy AI',
          systems: [
            {
              id: 'enemy-ncb',
              name: 'Enemy Non-Combat Behavior',
              children: [
                { id: 'ncb-patrol', name: 'Patrol', type: 'script', status: 'planned', time: '2h', sprint: null, completedAt: null },
                { id: 'ncb-aggro', name: 'Aggro', type: 'script', status: 'planned', time: '2h', sprint: null, completedAt: null },
                { id: 'ncb-deaggro', name: 'De-Aggro', type: 'script', status: 'planned', time: '1h', sprint: null, completedAt: null },
                { id: 'ncb-combat', name: 'Combat Atk Initiator', type: 'script', status: 'planned', time: '2h', sprint: null, completedAt: null },
                { id: 'ncb-path', name: 'Pathfinding', type: 'script', status: 'planned', time: '3h', sprint: null, completedAt: null },
              ],
            },
          ],
        },
        {
          id: 'f2-rooms',
          label: 'Room System',
          systems: [
            {
              id: 'room-sys',
              name: 'Room System',
              children: [
                { id: 'rm-gen', name: 'Generate Grid Placement', type: 'script', status: 'planned', time: '3h', sprint: null, completedAt: null },
                {
                  id: 'rm-rest',
                  name: 'Rest Site',
                  type: 'system',
                  isGroup: true,
                  children: [
                    { id: 'rest-scene', name: 'Scene Building', type: 'scene', status: 'planned', time: '3h', sprint: null, completedAt: null },
                    { id: 'rest-art', name: 'Scene Related Artwork', type: 'art', status: 'planned', time: '2h', sprint: null, completedAt: null },
                    { id: 'rest-heal', name: 'Heal', type: 'script', status: 'planned', time: '1h', sprint: null, completedAt: null },
                  ],
                },
                {
                  id: 'rm-enemy',
                  name: 'Enemy Site',
                  type: 'system',
                  isGroup: true,
                  children: [
                    { id: 'esite-scene', name: 'Scene Building', type: 'scene', status: 'planned', time: '3h', sprint: null, completedAt: null },
                    { id: 'esite-art', name: 'Scene Related Art', type: 'art', status: 'planned', time: '2h', sprint: null, completedAt: null },
                  ],
                },
                {
                  id: 'rm-event',
                  name: 'Event Site',
                  type: 'system',
                  isGroup: true,
                  children: [
                    { id: 'event-scene', name: 'Scene Building', type: 'scene', status: 'planned', time: '3h', sprint: null, completedAt: null },
                    { id: 'event-art', name: 'Scene Related Art', type: 'art', status: 'planned', time: '2h', sprint: null, completedAt: null },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: 'f2-cards',
          label: 'New Cards',
          systems: [
            {
              id: 'kairos-rush',
              name: 'Kairos Rush Card',
              children: [
                { id: 'kr-art', name: 'Card Artwork', type: 'art', status: 'planned', time: '1.5h', sprint: null, completedAt: null },
                { id: 'kr-logic', name: 'Rush Card Logic', type: 'script', status: 'planned', time: '1.5h', sprint: null, completedAt: null },
                { id: 'kr-fx', name: 'Card Attack Effect', type: 'fx', status: 'planned', time: '1h', sprint: null, completedAt: null },
              ],
            },
            {
              id: 'power-card',
              name: 'Power Card',
              children: [
                { id: 'pc-art', name: 'Card Artwork', type: 'art', status: 'planned', time: '1.5h', sprint: null, completedAt: null },
                { id: 'pc-fx', name: 'Card Attack Effect', type: 'fx', status: 'planned', time: '1h', sprint: null, completedAt: null },
                { id: 'pc-logic', name: 'Power Logic', type: 'script', status: 'planned', time: '1.5h', sprint: null, completedAt: null },
              ],
            },
            {
              id: 'def-skill',
              name: 'Defensive Skill Card',
              children: [
                { id: 'ds-art', name: 'Card Artwork', type: 'art', status: 'planned', time: '1.5h', sprint: null, completedAt: null },
                { id: 'ds-fx', name: 'Card Attack Effect', type: 'fx', status: 'planned', time: '1h', sprint: null, completedAt: null },
                { id: 'ds-logic', name: 'Skill Logic', type: 'script', status: 'planned', time: '1.5h', sprint: null, completedAt: null },
              ],
            },
            {
              id: 'draw-card',
              name: 'Card Draw Card',
              children: [
                { id: 'dc-art', name: 'Card Artwork', type: 'art', status: 'planned', time: '1.5h', sprint: null, completedAt: null },
                { id: 'dc-fx', name: 'Card Attack Effect', type: 'fx', status: 'planned', time: '1h', sprint: null, completedAt: null },
                { id: 'dc-logic', name: 'Draw Card Logic', type: 'script', status: 'planned', time: '1.5h', sprint: null, completedAt: null },
              ],
            },
          ],
        },
        {
          id: 'f2-equip',
          label: 'Equipment',
          systems: [
            {
              id: 'equip1',
              name: 'Equipment 1 (Relic)',
              children: [
                { id: 'eq1-art', name: 'Artwork', type: 'art', status: 'planned', time: '1h', sprint: null, completedAt: null },
                { id: 'eq1-int', name: 'Integration', type: 'script', status: 'planned', time: '1h', sprint: null, completedAt: null },
              ],
            },
            {
              id: 'equip2',
              name: 'Equipment 2 (Relic)',
              children: [
                { id: 'eq2-art', name: 'Artwork', type: 'art', status: 'planned', time: '1h', sprint: null, completedAt: null },
                { id: 'eq2-int', name: 'Integration', type: 'script', status: 'planned', time: '1h', sprint: null, completedAt: null },
              ],
            },
          ],
        },
        {
          id: 'f2-ui',
          label: 'UI & Systems',
          systems: [
            {
              id: 'dialogue-sys',
              name: 'Dialogue',
              children: [
                { id: 'dlg-box', name: 'Dialogue Box', type: 'ui', status: 'planned', time: '2h', sprint: null, completedAt: null },
                { id: 'dlg-anim', name: 'Dialogue Animations', type: 'anim', status: 'planned', time: '3h', sprint: null, completedAt: null },
              ],
            },
            {
              id: 'choice-sys',
              name: 'Choice/Reward System',
              children: [
                { id: 'ch-option', name: 'Card Choice Option', type: 'ui', status: 'planned', time: '1h', sprint: null, completedAt: null },
                { id: 'ch-preview', name: 'Card Choice Preview', type: 'ui', status: 'planned', time: '1h', sprint: null, completedAt: null },
                { id: 'ch-anim', name: 'Card Choice Anim', type: 'anim', status: 'planned', time: '1h', sprint: null, completedAt: null },
              ],
            },
          ],
        },
        {
          id: 'f2-exp',
          systems: [
            {
              id: 'experimental',
              name: 'Experimental',
              children: [
                { id: 'exp-1', name: 'Experimental Feature', type: 'script', status: 'planned', time: '5h', sprint: null, completedAt: null },
              ],
            },
          ],
        },
      ],
    },
  ];
}
*/
