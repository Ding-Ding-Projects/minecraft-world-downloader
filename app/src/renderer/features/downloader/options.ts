/**
 * The launch-option model for the bundled `world-downloader.jar`.
 *
 * Every entry here corresponds to a real `@Option` on `config/Config.java` in
 * the Java core. Nothing is invented: an option that the jar does not accept
 * would be rejected by args4j at startup, which is a failure the user would see
 * as an unexplained exit rather than as a mistake in this table.
 *
 * Two deliberate omissions, both stated rather than silently left out:
 *
 * - `--token` (a Minecraft access token) is not offered. It would place a live
 *   credential on a command line, where any process listing on the machine can
 *   read it. Automatic authentication and the Microsoft device-code flow both
 *   reach the same result without that exposure.
 * - Flags whose default is already the value they set — `--mark-old-chunks`
 *   and `--modded-block-colors` — are not offered as switches that "turn them
 *   on", because passing them changes nothing. The corresponding `--disable-…`
 *   flags are offered instead, so the control genuinely changes behaviour.
 */

export type OptionValue = string | number | boolean;
export type ProfileValues = Record<string, OptionValue>;

export type OptionGroupId = 'connection' | 'output' | 'map' | 'session' | 'containers' | 'chat';

export interface OptionChoice {
  value: string;
  /** i18n key. The value itself is the fallback, so a missing key still reads. */
  labelKey: string;
}

export interface OptionDefinition {
  /** Stable key inside a stored profile. Never renamed once shipped. */
  id: string;
  group: OptionGroupId;
  /** i18n key for the visible label. */
  labelKey: string;
  /** i18n key for the progressive-disclosure explanation. */
  descriptionKey: string;
  kind: 'text' | 'number' | 'switch' | 'select' | 'folder' | 'file';
  /** The compiled-in default, matching the Java field's own default. */
  defaultValue: OptionValue;
  /** The exact jar flag this option contributes, for the explanation line. */
  flag: string;
  min?: number;
  max?: number;
  step?: number;
  choices?: OptionChoice[];
  /** i18n key for a unit or placeholder suffix. */
  hintKey?: string;
  /** Extra search terms, so the option is findable by what it does. */
  keywords: string[];
  /** Arguments contributed by this option. Empty means "the jar default". */
  args(value: OptionValue, all: ProfileValues): string[];
  /** Plain-English reason the value is unusable, or null when it is fine. */
  validate?(value: OptionValue, all: ProfileValues): string | null;
  /**
   * Whether the option currently does anything. When it does not, the surface
   * disables it and shows this exact reason rather than leaving a control that
   * looks live and is ignored.
   */
  inertReason?(all: ProfileValues): string | null;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function asString(value: OptionValue | undefined): string {
  return value === undefined || value === null ? '' : String(value);
}

export function asNumber(value: OptionValue | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function asBoolean(value: OptionValue | undefined): boolean {
  return value === true || value === 'true';
}

function wholeNumberIn(
  value: OptionValue,
  min: number,
  max: number,
  what: string
): string | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return `${what} must be a whole number. Nothing was started.`;
  }
  if (parsed < min || parsed > max) {
    return `${what} must be between ${min} and ${max}. Nothing was started.`;
  }
  return null;
}

/** Hostname or IPv4/IPv6 literal, with no port: the port has its own field. */
const HOST_PATTERN = /^[A-Za-z0-9._:-]+$/;

const MINECRAFT_COLOURS = [
  'black',
  'dark_blue',
  'dark_green',
  'dark_aqua',
  'dark_red',
  'dark_purple',
  'gold',
  'gray',
  'dark_gray',
  'blue',
  'green',
  'aqua',
  'red',
  'light_purple',
  'yellow',
  'white'
];

function colourChoices(): OptionChoice[] {
  return MINECRAFT_COLOURS.map((name) => ({
    value: name,
    labelKey: `downloader.colour.${name}`
  }));
}

/* ------------------------------------------------------------------ */
/* Option ids                                                          */
/* ------------------------------------------------------------------ */

export const OPTION_IDS = {
  serverHost: 'serverHost',
  serverPort: 'serverPort',
  localPort: 'localPort',
  disableSrvLookup: 'disableSrvLookup',
  authMethod: 'authMethod',
  username: 'username',
  msAuthCache: 'msAuthCache',

  outputDir: 'outputDir',
  centerX: 'centerX',
  centerZ: 'centerZ',
  levelSeed: 'levelSeed',
  disableChunkSaving: 'disableChunkSaving',
  disableWorldGen: 'disableWorldGen',
  ignoreBlockChanges: 'ignoreBlockChanges',

  renderMap: 'renderMap',
  showJavaWindow: 'showJavaWindow',
  guiTheme: 'guiTheme',
  extendedRenderDistance: 'extendedRenderDistance',
  extendedRenderPace: 'extendedRenderPace',
  drawExtendedChunks: 'drawExtendedChunks',
  markNewChunks: 'markNewChunks',
  disableMarkUnsaved: 'disableMarkUnsaved',
  renderPlayers: 'renderPlayers',
  caveMode: 'caveMode',
  moddedBlockColors: 'moddedBlockColors',

  disableMessages: 'disableMessages',
  voiceProxy: 'voiceProxy',

  autoOpen: 'autoOpen',
  autoOpenDelay: 'autoOpenDelay',
  autoOpenGamemodes: 'autoOpenGamemodes',
  autoOpenAllowChests: 'autoOpenAllowChests',
  autoOpenAllowTrapped: 'autoOpenAllowTrapped',
  autoOpenPlayerRadius: 'autoOpenPlayerRadius',
  autoOpenStateFile: 'autoOpenStateFile',
  autoOpenLogFile: 'autoOpenLogFile',
  containerMessageFormat: 'containerMessageFormat',

  autoReply: 'autoReply',
  autoReplyTrigger: 'autoReplyTrigger',
  autoReplyTriggerColor: 'autoReplyTriggerColor',
  autoReplyColor: 'autoReplyColor',
  autoReplyDelay: 'autoReplyDelay'
} as const;

const DEFAULT_REMOTE_PORT = 25565;

/* ------------------------------------------------------------------ */
/* The table                                                           */
/* ------------------------------------------------------------------ */

export const OPTION_DEFINITIONS: OptionDefinition[] = [
  /* ---------------- connection ---------------- */
  {
    id: OPTION_IDS.serverHost,
    group: 'connection',
    labelKey: 'downloader.option.serverHost',
    descriptionKey: 'downloader.option.serverHost.description',
    kind: 'text',
    defaultValue: '',
    flag: '--server',
    keywords: ['server', 'address', 'host', 'ip', 'connect'],
    args: () => [],
    validate: (value) => {
      const host = asString(value).trim();
      if (host === '') return 'A server address is required. Nothing was started.';
      if (!HOST_PATTERN.test(host)) {
        return 'The address may only contain letters, digits, dots, colons and hyphens. Put the port in the port field, not here.';
      }
      return null;
    }
  },
  {
    id: OPTION_IDS.serverPort,
    group: 'connection',
    labelKey: 'downloader.option.serverPort',
    descriptionKey: 'downloader.option.serverPort.description',
    kind: 'number',
    defaultValue: DEFAULT_REMOTE_PORT,
    flag: '--server',
    min: 1,
    max: 65535,
    step: 1,
    keywords: ['port', 'server', 'remote', '25565'],
    args: () => [],
    validate: (value) => wholeNumberIn(value, 1, 65535, 'The server port')
  },
  {
    id: OPTION_IDS.localPort,
    group: 'connection',
    labelKey: 'downloader.option.localPort',
    descriptionKey: 'downloader.option.localPort.description',
    kind: 'number',
    defaultValue: 25565,
    flag: '--local-port',
    min: 1,
    max: 65535,
    step: 1,
    keywords: ['local', 'proxy', 'port', 'listen'],
    args: (value) => ['--local-port', String(asNumber(value, 25565))],
    validate: (value) => wholeNumberIn(value, 1, 65535, 'The local proxy port')
  },
  {
    id: OPTION_IDS.disableSrvLookup,
    group: 'connection',
    labelKey: 'downloader.option.disableSrvLookup',
    descriptionKey: 'downloader.option.disableSrvLookup.description',
    kind: 'switch',
    defaultValue: false,
    flag: '--disable-srv-lookup',
    keywords: ['srv', 'dns', 'lookup', 'record'],
    args: (value) => (asBoolean(value) ? ['--disable-srv-lookup'] : [])
  },
  {
    id: OPTION_IDS.authMethod,
    group: 'connection',
    labelKey: 'downloader.option.authMethod',
    descriptionKey: 'downloader.option.authMethod.description',
    kind: 'select',
    defaultValue: 'automatic',
    flag: '--microsoft-login',
    choices: [
      { value: 'automatic', labelKey: 'downloader.auth.automatic' },
      { value: 'microsoft', labelKey: 'downloader.auth.microsoft' }
    ],
    keywords: ['authentication', 'login', 'microsoft', 'account', 'device code'],
    args: (value) => (asString(value) === 'microsoft' ? ['--microsoft-login'] : [])
  },
  {
    id: OPTION_IDS.username,
    group: 'connection',
    labelKey: 'downloader.option.username',
    descriptionKey: 'downloader.option.username.description',
    kind: 'text',
    defaultValue: '',
    flag: '--username',
    keywords: ['username', 'account', 'player', 'launcher'],
    args: (value) => {
      const name = asString(value).trim();
      return name === '' ? [] : ['--username', name];
    },
    validate: (value) => {
      const name = asString(value).trim();
      if (name !== '' && /\s/.test(name)) {
        return 'A Minecraft username contains no spaces. Nothing was started.';
      }
      return null;
    },
    inertReason: (all) =>
      asString(all[OPTION_IDS.authMethod]) === 'microsoft'
        ? 'The Microsoft device-code flow supplies the account itself, so a username here would be ignored.'
        : null
  },
  {
    id: OPTION_IDS.msAuthCache,
    group: 'connection',
    labelKey: 'downloader.option.msAuthCache',
    descriptionKey: 'downloader.option.msAuthCache.description',
    kind: 'file',
    defaultValue: '',
    flag: '--ms-auth-cache',
    keywords: ['microsoft', 'cache', 'session', 'token', 'sign in'],
    args: (value, all) => {
      const path = asString(value).trim();
      if (path === '' || asString(all[OPTION_IDS.authMethod]) !== 'microsoft') return [];
      return ['--ms-auth-cache', path];
    },
    inertReason: (all) =>
      asString(all[OPTION_IDS.authMethod]) === 'microsoft'
        ? null
        : 'This is the Microsoft device-code session cache, and the authentication mode is not Microsoft.'
  },

  /* ---------------- output ---------------- */
  {
    id: OPTION_IDS.outputDir,
    group: 'output',
    labelKey: 'downloader.option.outputDir',
    descriptionKey: 'downloader.option.outputDir.description',
    kind: 'folder',
    defaultValue: 'world',
    flag: '--output',
    keywords: ['output', 'world', 'folder', 'directory', 'save'],
    args: (value) => ['--output', asString(value).trim() || 'world'],
    validate: (value) =>
      asString(value).trim() === '' ? 'An output world directory is required. Nothing was started.' : null
  },
  {
    id: OPTION_IDS.centerX,
    group: 'output',
    labelKey: 'downloader.option.centerX',
    descriptionKey: 'downloader.option.centerX.description',
    kind: 'number',
    defaultValue: 0,
    flag: '--center-x',
    min: -30_000_000,
    max: 30_000_000,
    step: 512,
    keywords: ['center', 'centre', 'offset', 'origin', 'x'],
    // args4j declares --center-x and --center-z as depending on each other, so
    // they are emitted together or not at all.
    args: (value, all) => {
      const x = asNumber(value, 0);
      const z = asNumber(all[OPTION_IDS.centerZ], 0);
      if (x === 0 && z === 0) return [];
      return ['--center-x', String(x), '--center-z', String(z)];
    },
    validate: (value) => wholeNumberIn(value, -30_000_000, 30_000_000, 'The centre X coordinate')
  },
  {
    id: OPTION_IDS.centerZ,
    group: 'output',
    labelKey: 'downloader.option.centerZ',
    descriptionKey: 'downloader.option.centerZ.description',
    kind: 'number',
    defaultValue: 0,
    flag: '--center-z',
    min: -30_000_000,
    max: 30_000_000,
    step: 512,
    keywords: ['center', 'centre', 'offset', 'origin', 'z'],
    // Emitted by the centre-X entry above, which writes both flags at once.
    args: () => [],
    validate: (value) => wholeNumberIn(value, -30_000_000, 30_000_000, 'The centre Z coordinate')
  },
  {
    id: OPTION_IDS.levelSeed,
    group: 'output',
    labelKey: 'downloader.option.levelSeed',
    descriptionKey: 'downloader.option.levelSeed.description',
    kind: 'text',
    defaultValue: '0',
    flag: '--seed',
    keywords: ['seed', 'level', 'generation'],
    args: (value) => {
      const seed = asString(value).trim();
      if (seed === '' || seed === '0') return [];
      return ['--seed', seed];
    },
    validate: (value) => {
      const seed = asString(value).trim();
      if (seed === '') return null;
      if (!/^-?\d+$/.test(seed)) {
        return 'The level seed is a whole number, which may be negative. Nothing was started.';
      }
      try {
        BigInt(seed);
      } catch {
        return 'That seed is not a whole number the jar can read. Nothing was started.';
      }
      return null;
    }
  },
  {
    id: OPTION_IDS.disableChunkSaving,
    group: 'output',
    labelKey: 'downloader.option.disableChunkSaving',
    descriptionKey: 'downloader.option.disableChunkSaving.description',
    kind: 'switch',
    defaultValue: false,
    flag: '--disable-chunk-saving',
    keywords: ['chunk', 'saving', 'disable', 'debug', 'dry run'],
    args: (value) => (asBoolean(value) ? ['--disable-chunk-saving'] : [])
  },
  {
    id: OPTION_IDS.disableWorldGen,
    group: 'output',
    labelKey: 'downloader.option.disableWorldGen',
    descriptionKey: 'downloader.option.disableWorldGen.description',
    kind: 'switch',
    defaultValue: false,
    flag: '--disable-world-gen',
    keywords: ['world generation', 'superflat', 'void', 'terrain'],
    args: (value) => (asBoolean(value) ? ['--disable-world-gen'] : [])
  },
  {
    id: OPTION_IDS.ignoreBlockChanges,
    group: 'output',
    labelKey: 'downloader.option.ignoreBlockChanges',
    descriptionKey: 'downloader.option.ignoreBlockChanges.description',
    kind: 'switch',
    defaultValue: false,
    flag: '--ignore-block-changes',
    keywords: ['block', 'changes', 'ignore', 'updates'],
    args: (value) => (asBoolean(value) ? ['--ignore-block-changes'] : [])
  },

  /* ---------------- map ---------------- */
  {
    id: OPTION_IDS.renderMap,
    group: 'map',
    labelKey: 'downloader.option.renderMap',
    descriptionKey: 'downloader.option.renderMap.description',
    kind: 'switch',
    defaultValue: true,
    flag: '--render-map / --disable-map-render',
    keywords: ['map', 'overview', 'render', 'tiles', 'position'],
    args: (value) => (asBoolean(value) ? ['--render-map'] : ['--disable-map-render'])
  },
  {
    id: OPTION_IDS.showJavaWindow,
    group: 'map',
    labelKey: 'downloader.option.showJavaWindow',
    descriptionKey: 'downloader.option.showJavaWindow.description',
    kind: 'switch',
    defaultValue: false,
    flag: '--no-gui',
    keywords: ['window', 'javafx', 'gui', 'map window'],
    // The switch reads "show the window", so the flag is emitted when it is off.
    args: (value) => (asBoolean(value) ? [] : ['--no-gui'])
  },
  {
    id: OPTION_IDS.guiTheme,
    group: 'map',
    labelKey: 'downloader.option.guiTheme',
    descriptionKey: 'downloader.option.guiTheme.description',
    kind: 'select',
    defaultValue: 'dark',
    flag: '--gui-theme',
    choices: [
      { value: 'dark', labelKey: 'downloader.guiTheme.dark' },
      { value: 'light', labelKey: 'downloader.guiTheme.light' },
      { value: 'contrast', labelKey: 'downloader.guiTheme.contrast' }
    ],
    keywords: ['theme', 'javafx', 'window', 'dark', 'light', 'contrast'],
    args: (value, all) => {
      if (!asBoolean(all[OPTION_IDS.showJavaWindow])) return [];
      const theme = asString(value) || 'dark';
      return theme === 'dark' ? [] : ['--gui-theme', theme];
    },
    inertReason: (all) =>
      asBoolean(all[OPTION_IDS.showJavaWindow])
        ? null
        : 'This themes the downloader’s own Java map window, which is turned off.'
  },
  {
    id: OPTION_IDS.extendedRenderDistance,
    group: 'map',
    labelKey: 'downloader.option.extendedRenderDistance',
    descriptionKey: 'downloader.option.extendedRenderDistance.description',
    kind: 'number',
    defaultValue: 0,
    flag: '--extended-render-distance',
    min: 0,
    max: 64,
    step: 1,
    hintKey: 'downloader.unit.chunks',
    keywords: ['render distance', 'extended', 'chunks', 'view'],
    args: (value) => {
      const distance = asNumber(value, 0);
      return distance > 0 ? ['--extended-render-distance', String(distance)] : [];
    },
    validate: (value) => wholeNumberIn(value, 0, 64, 'The extended render distance')
  },
  {
    id: OPTION_IDS.extendedRenderPace,
    group: 'map',
    labelKey: 'downloader.option.extendedRenderPace',
    descriptionKey: 'downloader.option.extendedRenderPace.description',
    kind: 'number',
    defaultValue: 6,
    flag: '--extended-render-pace',
    min: 0,
    max: 1000,
    step: 1,
    hintKey: 'downloader.unit.milliseconds',
    keywords: ['pace', 'delay', 'stutter', 'extended render'],
    args: (value, all) => {
      if (asNumber(all[OPTION_IDS.extendedRenderDistance], 0) <= 0) return [];
      const pace = asNumber(value, 6);
      return pace === 6 ? [] : ['--extended-render-pace', String(pace)];
    },
    validate: (value) => wholeNumberIn(value, 0, 1000, 'The extended render pace'),
    inertReason: (all) =>
      asNumber(all[OPTION_IDS.extendedRenderDistance], 0) > 0
        ? null
        : 'Nothing is re-sent to the client while the extended render distance is 0.'
  },
  {
    id: OPTION_IDS.drawExtendedChunks,
    group: 'map',
    labelKey: 'downloader.option.drawExtendedChunks',
    descriptionKey: 'downloader.option.drawExtendedChunks.description',
    kind: 'switch',
    defaultValue: false,
    flag: '--draw-extended-chunks',
    keywords: ['extended', 'chunks', 'draw', 'map'],
    args: (value) => (asBoolean(value) ? ['--draw-extended-chunks'] : [])
  },
  {
    id: OPTION_IDS.markNewChunks,
    group: 'map',
    labelKey: 'downloader.option.markNewChunks',
    descriptionKey: 'downloader.option.markNewChunks.description',
    kind: 'switch',
    defaultValue: false,
    flag: '--mark-new-chunks',
    keywords: ['mark', 'new', 'chunks', 'orange', 'outline'],
    args: (value) => (asBoolean(value) ? ['--mark-new-chunks'] : [])
  },
  {
    id: OPTION_IDS.disableMarkUnsaved,
    group: 'map',
    labelKey: 'downloader.option.disableMarkUnsaved',
    descriptionKey: 'downloader.option.disableMarkUnsaved.description',
    kind: 'switch',
    defaultValue: false,
    flag: '--disable-mark-unsaved',
    keywords: ['unsaved', 'red', 'mark', 'map'],
    args: (value) => (asBoolean(value) ? ['--disable-mark-unsaved'] : [])
  },
  {
    id: OPTION_IDS.renderPlayers,
    group: 'map',
    labelKey: 'downloader.option.renderPlayers',
    descriptionKey: 'downloader.option.renderPlayers.description',
    kind: 'switch',
    defaultValue: false,
    flag: '--render-players',
    keywords: ['players', 'render', 'map', 'others'],
    args: (value) => (asBoolean(value) ? ['--render-players'] : [])
  },
  {
    id: OPTION_IDS.caveMode,
    group: 'map',
    labelKey: 'downloader.option.caveMode',
    descriptionKey: 'downloader.option.caveMode.description',
    kind: 'switch',
    defaultValue: false,
    flag: '--enable-cave-mode',
    keywords: ['cave', 'underground', 'render mode'],
    args: (value) => (asBoolean(value) ? ['--enable-cave-mode'] : [])
  },
  {
    id: OPTION_IDS.moddedBlockColors,
    group: 'map',
    labelKey: 'downloader.option.moddedBlockColors',
    descriptionKey: 'downloader.option.moddedBlockColors.description',
    kind: 'switch',
    defaultValue: true,
    flag: '--disable-modded-block-colors',
    keywords: ['modded', 'colours', 'colors', 'blocks', 'mods'],
    args: (value) => (asBoolean(value) ? [] : ['--disable-modded-block-colors'])
  },

  /* ---------------- session ---------------- */
  {
    id: OPTION_IDS.disableMessages,
    group: 'session',
    labelKey: 'downloader.option.disableMessages',
    descriptionKey: 'downloader.option.disableMessages.description',
    kind: 'switch',
    defaultValue: false,
    flag: '--disable-messages',
    keywords: ['messages', 'chat', 'info', 'quiet'],
    args: (value) => (asBoolean(value) ? ['--disable-messages'] : [])
  },
  {
    id: OPTION_IDS.voiceProxy,
    group: 'session',
    labelKey: 'downloader.option.voiceProxy',
    descriptionKey: 'downloader.option.voiceProxy.description',
    kind: 'switch',
    defaultValue: false,
    flag: '--enable-voice-proxy',
    keywords: ['voice', 'simple voice chat', 'plasmovoice', 'udp'],
    args: (value) => (asBoolean(value) ? ['--enable-voice-proxy'] : [])
  },

  /* ---------------- containers ---------------- */
  {
    id: OPTION_IDS.autoOpen,
    group: 'containers',
    labelKey: 'downloader.option.autoOpen',
    descriptionKey: 'downloader.option.autoOpen.description',
    kind: 'switch',
    defaultValue: false,
    flag: '--auto-open-containers',
    keywords: ['containers', 'chests', 'auto open', 'experimental'],
    args: (value) => (asBoolean(value) ? ['--auto-open-containers'] : [])
  },
  {
    id: OPTION_IDS.autoOpenDelay,
    group: 'containers',
    labelKey: 'downloader.option.autoOpenDelay',
    descriptionKey: 'downloader.option.autoOpenDelay.description',
    kind: 'number',
    defaultValue: 400,
    flag: '--auto-open-delay',
    min: 50,
    max: 60_000,
    step: 50,
    hintKey: 'downloader.unit.milliseconds',
    keywords: ['delay', 'rate', 'auto open', 'anti-cheat'],
    args: (value, all) => {
      if (!asBoolean(all[OPTION_IDS.autoOpen])) return [];
      const delay = asNumber(value, 400);
      return delay === 400 ? [] : ['--auto-open-delay', String(delay)];
    },
    validate: (value) => wholeNumberIn(value, 50, 60_000, 'The auto-open delay'),
    inertReason: (all) =>
      asBoolean(all[OPTION_IDS.autoOpen]) ? null : 'Automatic container opening is turned off.'
  },
  {
    id: OPTION_IDS.autoOpenGamemodes,
    group: 'containers',
    labelKey: 'downloader.option.autoOpenGamemodes',
    descriptionKey: 'downloader.option.autoOpenGamemodes.description',
    kind: 'select',
    defaultValue: 'all',
    flag: '--auto-open-gamemodes',
    choices: [
      { value: 'all', labelKey: 'downloader.gamemode.all' },
      { value: 'survival', labelKey: 'downloader.gamemode.survival' },
      { value: 'creative', labelKey: 'downloader.gamemode.creative' },
      { value: 'adventure', labelKey: 'downloader.gamemode.adventure' },
      { value: 'spectator', labelKey: 'downloader.gamemode.spectator' },
      { value: 'survival,creative', labelKey: 'downloader.gamemode.survivalCreative' },
      { value: 'creative,spectator', labelKey: 'downloader.gamemode.creativeSpectator' }
    ],
    keywords: ['gamemode', 'survival', 'creative', 'spectator', 'auto open'],
    args: (value, all) => {
      if (!asBoolean(all[OPTION_IDS.autoOpen])) return [];
      const modes = asString(value) || 'all';
      return modes === 'all' ? [] : ['--auto-open-gamemodes', modes];
    },
    inertReason: (all) =>
      asBoolean(all[OPTION_IDS.autoOpen]) ? null : 'Automatic container opening is turned off.'
  },
  {
    id: OPTION_IDS.autoOpenAllowChests,
    group: 'containers',
    labelKey: 'downloader.option.autoOpenAllowChests',
    descriptionKey: 'downloader.option.autoOpenAllowChests.description',
    kind: 'switch',
    defaultValue: false,
    flag: '--auto-open-allow-chest-near-players',
    keywords: ['chest', 'players', 'nearby', 'auto open'],
    args: (value, all) =>
      asBoolean(all[OPTION_IDS.autoOpen]) && asBoolean(value)
        ? ['--auto-open-allow-chest-near-players']
        : [],
    inertReason: (all) =>
      asBoolean(all[OPTION_IDS.autoOpen]) ? null : 'Automatic container opening is turned off.'
  },
  {
    id: OPTION_IDS.autoOpenAllowTrapped,
    group: 'containers',
    labelKey: 'downloader.option.autoOpenAllowTrapped',
    descriptionKey: 'downloader.option.autoOpenAllowTrapped.description',
    kind: 'switch',
    defaultValue: false,
    flag: '--auto-open-allow-trapped-chests',
    keywords: ['trapped chest', 'redstone', 'auto open'],
    args: (value, all) =>
      asBoolean(all[OPTION_IDS.autoOpen]) && asBoolean(value)
        ? ['--auto-open-allow-trapped-chests']
        : [],
    inertReason: (all) =>
      asBoolean(all[OPTION_IDS.autoOpen]) ? null : 'Automatic container opening is turned off.'
  },
  {
    id: OPTION_IDS.autoOpenPlayerRadius,
    group: 'containers',
    labelKey: 'downloader.option.autoOpenPlayerRadius',
    descriptionKey: 'downloader.option.autoOpenPlayerRadius.description',
    kind: 'number',
    defaultValue: 100,
    flag: '--auto-open-player-radius',
    min: 1,
    max: 512,
    step: 1,
    hintKey: 'downloader.unit.blocks',
    keywords: ['radius', 'players', 'nearby', 'auto open'],
    args: (value, all) => {
      if (!asBoolean(all[OPTION_IDS.autoOpen])) return [];
      const radius = asNumber(value, 100);
      return radius === 100 ? [] : ['--auto-open-player-radius', String(radius)];
    },
    validate: (value) => wholeNumberIn(value, 1, 512, 'The nearby-player radius'),
    inertReason: (all) =>
      asBoolean(all[OPTION_IDS.autoOpen]) ? null : 'Automatic container opening is turned off.'
  },
  {
    id: OPTION_IDS.autoOpenStateFile,
    group: 'containers',
    labelKey: 'downloader.option.autoOpenStateFile',
    descriptionKey: 'downloader.option.autoOpenStateFile.description',
    kind: 'file',
    defaultValue: '',
    flag: '--auto-open-state',
    keywords: ['state', 'file', 'attempted', 'auto open'],
    args: (value, all) => {
      if (!asBoolean(all[OPTION_IDS.autoOpen])) return [];
      const path = asString(value).trim();
      return path === '' ? [] : ['--auto-open-state', path];
    },
    inertReason: (all) =>
      asBoolean(all[OPTION_IDS.autoOpen]) ? null : 'Automatic container opening is turned off.'
  },
  {
    id: OPTION_IDS.autoOpenLogFile,
    group: 'containers',
    labelKey: 'downloader.option.autoOpenLogFile',
    descriptionKey: 'downloader.option.autoOpenLogFile.description',
    kind: 'file',
    defaultValue: '',
    flag: '--auto-open-log',
    keywords: ['log', 'items', 'captured', 'auto open'],
    args: (value, all) => {
      if (!asBoolean(all[OPTION_IDS.autoOpen])) return [];
      const path = asString(value).trim();
      return path === '' ? [] : ['--auto-open-log', path];
    },
    inertReason: (all) =>
      asBoolean(all[OPTION_IDS.autoOpen]) ? null : 'Automatic container opening is turned off.'
  },
  {
    id: OPTION_IDS.containerMessageFormat,
    group: 'containers',
    labelKey: 'downloader.option.containerMessageFormat',
    descriptionKey: 'downloader.option.containerMessageFormat.description',
    kind: 'text',
    defaultValue: '{type} ({count}) - {x} {y} {z}',
    flag: '--container-message-format',
    keywords: ['message', 'action bar', 'format', 'template', 'container'],
    args: (value) => {
      const format = asString(value).trim();
      if (format === '' || format === '{type} ({count}) - {x} {y} {z}') return [];
      return ['--container-message-format', format];
    },
    validate: (value) => {
      const format = asString(value);
      if (format.trim() === '') return null;
      const unknown = [...format.matchAll(/\{([a-z]+)\}/gi)]
        .map((match) => match[1])
        .filter((name) => !['type', 'count', 'x', 'y', 'z'].includes(name));
      if (unknown.length > 0) {
        return `The jar only replaces {type}, {count}, {x}, {y} and {z}. It would print {${unknown[0]}} literally.`;
      }
      return null;
    }
  },

  /* ---------------- chat ---------------- */
  {
    id: OPTION_IDS.autoReply,
    group: 'chat',
    labelKey: 'downloader.option.autoReply',
    descriptionKey: 'downloader.option.autoReply.description',
    kind: 'switch',
    defaultValue: false,
    flag: '--auto-reply',
    keywords: ['auto reply', 'chat', 'experimental'],
    args: (value) => (asBoolean(value) ? ['--auto-reply'] : [])
  },
  {
    id: OPTION_IDS.autoReplyTrigger,
    group: 'chat',
    labelKey: 'downloader.option.autoReplyTrigger',
    descriptionKey: 'downloader.option.autoReplyTrigger.description',
    kind: 'text',
    defaultValue: '',
    flag: '--auto-reply-trigger',
    keywords: ['trigger', 'auto reply', 'chat', 'match'],
    args: (value, all) => {
      if (!asBoolean(all[OPTION_IDS.autoReply])) return [];
      const trigger = asString(value).trim();
      return trigger === '' ? [] : ['--auto-reply-trigger', trigger];
    },
    validate: (value, all) => {
      if (!asBoolean(all[OPTION_IDS.autoReply])) return null;
      return asString(value).trim() === ''
        ? 'Automatic replies do nothing without a trigger phrase. Give one, or turn automatic replies off.'
        : null;
    },
    inertReason: (all) => (asBoolean(all[OPTION_IDS.autoReply]) ? null : 'Automatic replies are turned off.')
  },
  {
    id: OPTION_IDS.autoReplyTriggerColor,
    group: 'chat',
    labelKey: 'downloader.option.autoReplyTriggerColor',
    descriptionKey: 'downloader.option.autoReplyTriggerColor.description',
    kind: 'select',
    defaultValue: 'yellow',
    flag: '--auto-reply-trigger-color',
    choices: colourChoices(),
    keywords: ['colour', 'color', 'trigger', 'auto reply'],
    args: (value, all) => {
      if (!asBoolean(all[OPTION_IDS.autoReply])) return [];
      const colour = asString(value) || 'yellow';
      return colour === 'yellow' ? [] : ['--auto-reply-trigger-color', colour];
    },
    inertReason: (all) => (asBoolean(all[OPTION_IDS.autoReply]) ? null : 'Automatic replies are turned off.')
  },
  {
    id: OPTION_IDS.autoReplyColor,
    group: 'chat',
    labelKey: 'downloader.option.autoReplyColor',
    descriptionKey: 'downloader.option.autoReplyColor.description',
    kind: 'select',
    defaultValue: 'red',
    flag: '--auto-reply-color',
    choices: colourChoices(),
    keywords: ['colour', 'color', 'reply', 'auto reply'],
    args: (value, all) => {
      if (!asBoolean(all[OPTION_IDS.autoReply])) return [];
      const colour = asString(value) || 'red';
      return colour === 'red' ? [] : ['--auto-reply-color', colour];
    },
    inertReason: (all) => (asBoolean(all[OPTION_IDS.autoReply]) ? null : 'Automatic replies are turned off.')
  },
  {
    id: OPTION_IDS.autoReplyDelay,
    group: 'chat',
    labelKey: 'downloader.option.autoReplyDelay',
    descriptionKey: 'downloader.option.autoReplyDelay.description',
    kind: 'number',
    defaultValue: 1500,
    flag: '--auto-reply-delay',
    min: 250,
    max: 600_000,
    step: 250,
    hintKey: 'downloader.unit.milliseconds',
    keywords: ['delay', 'auto reply', 'spam', 'chat'],
    args: (value, all) => {
      if (!asBoolean(all[OPTION_IDS.autoReply])) return [];
      const delay = asNumber(value, 1500);
      return delay === 1500 ? [] : ['--auto-reply-delay', String(delay)];
    },
    validate: (value) => wholeNumberIn(value, 250, 600_000, 'The automatic-reply delay'),
    inertReason: (all) => (asBoolean(all[OPTION_IDS.autoReply]) ? null : 'Automatic replies are turned off.')
  }
];

export const OPTION_GROUP_ORDER: OptionGroupId[] = [
  'connection',
  'output',
  'map',
  'session',
  'containers',
  'chat'
];

export const OPTION_GROUP_TITLES: Record<OptionGroupId, string> = {
  connection: 'downloader.group.connection',
  output: 'downloader.group.output',
  map: 'downloader.group.map',
  session: 'downloader.group.session',
  containers: 'downloader.group.containers',
  chat: 'downloader.group.chat'
};

const BY_ID = new Map(OPTION_DEFINITIONS.map((definition) => [definition.id, definition]));

export function optionById(id: string): OptionDefinition | null {
  return BY_ID.get(id) ?? null;
}

/** The compiled-in defaults, exactly as the Java fields declare them. */
export function defaultValues(): ProfileValues {
  const values: ProfileValues = {};
  for (const definition of OPTION_DEFINITIONS) values[definition.id] = definition.defaultValue;
  return values;
}

/** Fills in anything a stored profile is missing, and drops keys nobody owns. */
export function normalizeValues(stored: unknown): ProfileValues {
  const values = defaultValues();
  if (!stored || typeof stored !== 'object') return values;
  const record = stored as Record<string, unknown>;
  for (const definition of OPTION_DEFINITIONS) {
    const raw = record[definition.id];
    if (raw === undefined || raw === null) continue;
    switch (definition.kind) {
      case 'switch':
        values[definition.id] = raw === true || raw === 'true';
        break;
      case 'number': {
        const parsed = Number(raw);
        values[definition.id] = Number.isFinite(parsed) ? parsed : definition.defaultValue;
        break;
      }
      case 'select': {
        const candidate = String(raw);
        const known = definition.choices?.some((choice) => choice.value === candidate) ?? false;
        values[definition.id] = known ? candidate : definition.defaultValue;
        break;
      }
      default:
        values[definition.id] = String(raw);
        break;
    }
  }
  return values;
}

export interface ArgumentProblem {
  optionId: string;
  message: string;
}

export interface ArgumentPlan {
  /** The complete argument vector, `--server` first. */
  args: string[];
  problems: ArgumentProblem[];
  /** Everything the plan leaves at the jar's own default, for the explanation. */
  omitted: string[];
}

/**
 * Builds the argument vector.
 *
 * An option that equals the jar's own default contributes nothing, so the
 * command line stays readable and a future change to a Java default is not
 * silently pinned by this application.
 */
export function buildArguments(values: ProfileValues): ArgumentPlan {
  const problems: ArgumentProblem[] = [];
  const omitted: string[] = [];

  for (const definition of OPTION_DEFINITIONS) {
    const reason = definition.validate?.(values[definition.id], values) ?? null;
    if (reason) problems.push({ optionId: definition.id, message: reason });
  }

  const host = asString(values[OPTION_IDS.serverHost]).trim();
  const port = asNumber(values[OPTION_IDS.serverPort], DEFAULT_REMOTE_PORT);
  const target = port === DEFAULT_REMOTE_PORT ? host : `${host}:${port}`;

  const args: string[] = [];
  if (host !== '') args.push('--server', target);

  for (const definition of OPTION_DEFINITIONS) {
    const contributed = definition.args(values[definition.id], values);
    if (contributed.length === 0) omitted.push(definition.id);
    else args.push(...contributed);
  }

  return { args, problems, omitted };
}

/** A copy-and-paste command line, for the docs and for a bug report. */
export function renderCommandLine(jarPath: string, javaCommand: string, args: string[]): string {
  const quote = (value: string): string => (/[\s"]/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value);
  return [javaCommand, '-jar', quote(jarPath), ...args.map(quote)].join(' ');
}
