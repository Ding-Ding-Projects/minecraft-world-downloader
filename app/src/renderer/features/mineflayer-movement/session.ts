/**
 * The typed contract this surface drives, and how it finds a live bot session.
 *
 * Every name here comes from the vendored library at `vendor/mineflayer`, not
 * from imagination:
 *
 *   - the seven control states are exactly the keys of `controlState` in
 *     `lib/plugins/physics.js`, which the same file also exposes as the
 *     `ControlState` union in `index.d.ts`;
 *   - `setControlState`, `getControlState`, `clearControlStates`, `look(yaw,
 *     pitch, force)` and `lookAt(point, force)` are that plugin's own methods,
 *     with its own argument order and radian units;
 *   - `blockAtCursor(maxDistance = 256)` and `entityAtCursor(maxDistance = 3.5)`
 *     are `lib/plugins/ray_trace.js`, including those defaults.
 *
 * The bot itself is a Node process: there is no `require` in this renderer, so
 * this feature never constructs one. It drives whatever session the bot feature
 * publishes, through the narrow interface below, and says so plainly on screen
 * when no session module is present rather than pretending to be connected.
 */

/* ================================================================== */
/* The vendored vocabulary                                             */
/* ================================================================== */

/** Exactly the keys of `controlState` in `lib/plugins/physics.js`. */
export type ControlName = 'forward' | 'back' | 'left' | 'right' | 'jump' | 'sprint' | 'sneak';

export const CONTROL_NAMES: ControlName[] = [
  'forward',
  'back',
  'left',
  'right',
  'jump',
  'sprint',
  'sneak'
];

/** The four that move the bot along the ground. */
export const DIRECTIONAL_CONTROLS: ControlName[] = ['forward', 'back', 'left', 'right'];

/** The three modifiers, which change how the four above behave. */
export const MODIFIER_CONTROLS: ControlName[] = ['sprint', 'sneak', 'jump'];

/** The library's own defaults for the two ray-trace entry points. */
export const RAY_BLOCK_DEFAULT_DISTANCE = 256;
export const RAY_ENTITY_DEFAULT_DISTANCE = 3.5;

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

/** One entity as the surface needs it, flattened out of `bot.entities`. */
export interface MovementEntitySummary {
  /** `entity.id`, the numeric network id. */
  id: number;
  /** `entity.name`, the type name such as `zombie`. */
  name: string;
  /** `entity.displayName` where the library has one, otherwise `name`. */
  displayName: string;
  /** `entity.username` for a player, null for everything else. */
  username: string | null;
  /** `entity.type`, e.g. `player`, `mob`, `object`. */
  type: string;
  position: Vec3Like;
  /** Metres from the bot, as the library measures it. */
  distance: number;
  height: number;
  width: number;
}

/** One ray-trace result, flattened out of a prismarine block. */
export interface MovementBlockHit {
  name: string;
  displayName: string;
  /** `block.position`, the integer block coordinate. */
  position: Vec3Like;
  /** `block.face`, the numeric face index the ray entered through, when known. */
  face: number | null;
  /** The unit vector of that face, when the ray reported one. */
  faceVector: Vec3Like | null;
  /** `block.intersect`, the exact point on the face the ray met. */
  intersect: Vec3Like | null;
  /** Metres from the bot's eye. */
  distance: number;
}

/**
 * The six cardinal faces, in the order `prismarine-world` numbers them.
 *
 * The vendored raycast reports `face` as an index; naming it costs nothing and
 * turns "face 4" into something a person can act on.
 */
export const FACE_NAMES = ['-Y (bottom)', '+Y (top)', '-Z (north)', '+Z (south)', '-X (west)', '+X (east)'];

export function faceName(face: number | null): string {
  if (face === null || !Number.isInteger(face) || face < 0 || face >= FACE_NAMES.length) return '';
  return FACE_NAMES[face];
}

/** Everything the read-out shows, refreshed from the running bot. */
export interface MovementSnapshot {
  connected: boolean;
  username: string;
  position: Vec3Like;
  velocity: Vec3Like;
  /** Radians. Counter-clockwise from due east, as `bot.look` documents. */
  yaw: number;
  /** Radians. 0 is level, +pi/2 straight up, -pi/2 straight down. */
  pitch: number;
  onGround: boolean;
  /** `entity.eyeHeight`; the ray-trace origin sits this far above the feet. */
  eyeHeight: number;
  isInWater: boolean;
  dimension: string;
  gameMode: string;
  physicsEnabled: boolean;
  controls: Record<ControlName, boolean>;
}

/**
 * A navigation plugin, if one is ever loaded.
 *
 * The vendored tree has no pathfinder — `vendor/mineflayer/lib/plugins` holds
 * forty-one plugins and none of them plans a route — so this is `null` in this
 * build and the surface says so out loud instead of implying navigation it
 * cannot perform. The shape is here so a session that genuinely gains one has
 * somewhere to report it from.
 */
export interface MovementPathfinder {
  /** The plugin's own name, shown verbatim so the claim is checkable. */
  name: string;
  /** Waypoints of the current plan, if it exposes them. */
  path(): Vec3Like[];
}

/**
 * The session this surface drives.
 *
 * `blockAtCursor` and `entityAtCursor` are optional because a session may be
 * connected before its ray-trace route exists; the picker reports that exact
 * gap rather than rendering a control that cannot fire.
 */
export interface MovementBotSession {
  /** Null when nothing is connected. Never a simulated value. */
  snapshot(): MovementSnapshot | null;
  /** Fires whenever the snapshot changes. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
  setControlState(control: ControlName, state: boolean): void | Promise<void>;
  clearControlStates(): void | Promise<void>;
  /** Radians, exactly as `bot.look(yaw, pitch, force)` takes them. */
  look(yaw: number, pitch: number, force?: boolean): void | Promise<void>;
  /** `bot.lookAt(point, force)`; the point is a world position, not an offset. */
  lookAt(point: Vec3Like, force?: boolean): void | Promise<void>;
  /** The live nearby-entity list, flattened from `bot.entities`. */
  entities(): MovementEntitySummary[];
  blockAtCursor?(maxDistance?: number): MovementBlockHit | null | Promise<MovementBlockHit | null>;
  entityAtCursor?(
    maxDistance?: number
  ): MovementEntitySummary | null | Promise<MovementEntitySummary | null>;
  pathfinder?: MovementPathfinder | null;
}

/** A provider that owns several sessions and names the active one. */
export interface MovementSessionHost {
  active(): MovementBotSession | null;
  subscribe(listener: () => void): () => void;
}

/* ================================================================== */
/* Defensive normalisation                                             */
/* ================================================================== */

function finite(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function vec(value: unknown): Vec3Like {
  if (!value || typeof value !== 'object') return { x: 0, y: 0, z: 0 };
  const source = value as Record<string, unknown>;
  return { x: finite(source.x), y: finite(source.y), z: finite(source.z) };
}

function maybeVec(value: unknown): Vec3Like | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  if (!Number.isFinite(Number(source.x))) return null;
  return { x: finite(source.x), y: finite(source.y), z: finite(source.z) };
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

/**
 * Repairs a snapshot that arrived with a missing or foreign field.
 *
 * The session is another module's code and may be older or newer than this one.
 * A read-out that throws on an absent field takes the whole tab down, so every
 * value is coerced and the surface renders what genuinely arrived.
 */
export function normaliseSnapshot(raw: unknown): MovementSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const controlsRaw = (source.controls ?? {}) as Record<string, unknown>;
  const controls = {} as Record<ControlName, boolean>;
  for (const name of CONTROL_NAMES) controls[name] = controlsRaw[name] === true;
  return {
    connected: source.connected !== false,
    username: text(source.username),
    position: vec(source.position),
    velocity: vec(source.velocity),
    yaw: finite(source.yaw),
    pitch: finite(source.pitch),
    onGround: source.onGround === true,
    eyeHeight: finite(source.eyeHeight, 1.62),
    isInWater: source.isInWater === true,
    dimension: text(source.dimension),
    gameMode: text(source.gameMode),
    physicsEnabled: source.physicsEnabled !== false,
    controls
  };
}

export function normaliseEntity(raw: unknown): MovementEntitySummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const id = Number(source.id);
  if (!Number.isFinite(id)) return null;
  const name = text(source.name, 'entity');
  return {
    id,
    name,
    displayName: text(source.displayName, name),
    username: typeof source.username === 'string' && source.username.length > 0 ? source.username : null,
    type: text(source.type, 'unknown'),
    position: vec(source.position),
    distance: finite(source.distance, Number.NaN),
    height: finite(source.height, 1.8),
    width: finite(source.width, 0.6)
  };
}

export function normaliseBlockHit(raw: unknown): MovementBlockHit | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const position = maybeVec(source.position);
  if (!position) return null;
  const name = text(source.name, 'block');
  const face = Number.isInteger(Number(source.face)) ? Number(source.face) : null;
  return {
    name,
    displayName: text(source.displayName, name),
    position,
    face,
    faceVector: maybeVec(source.faceVector),
    intersect: maybeVec(source.intersect),
    distance: finite(source.distance, Number.NaN)
  };
}

/* ================================================================== */
/* Geometry the surface needs                                          */
/* ================================================================== */

export function horizontalDistance(a: Vec3Like, b: Vec3Like): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

export function distance3(a: Vec3Like, b: Vec3Like): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * The yaw and pitch that face `point` from `eye`.
 *
 * Copied from `bot.lookAt` in `lib/plugins/physics.js` so the preview and the
 * real call can never disagree about which way the bot will turn:
 *   yaw   = atan2(-dx, -dz)
 *   pitch = atan2(dy, sqrt(dx² + dz²))
 */
export function lookAngles(eye: Vec3Like, point: Vec3Like): { yaw: number; pitch: number } {
  const dx = point.x - eye.x;
  const dy = point.y - eye.y;
  const dz = point.z - eye.z;
  const groundDistance = Math.sqrt(dx * dx + dz * dz);
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, groundDistance) };
}

export function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Wraps to (-pi, pi], which is the range the library keeps yaw in. */
export function wrapRadians(value: number): number {
  const twoPi = Math.PI * 2;
  let wrapped = value % twoPi;
  if (wrapped > Math.PI) wrapped -= twoPi;
  if (wrapped <= -Math.PI) wrapped += twoPi;
  return wrapped;
}

/* ================================================================== */
/* Finding a session                                                   */
/* ================================================================== */

/**
 * The export names this feature accepts from the bot session module.
 *
 * They are listed rather than guessed at call time so the failure message can
 * name every one of them: a surface that says "no session found" without saying
 * what it looked for leaves the next person with nothing to act on.
 */
export const SESSION_EXPORT_NAMES = [
  'movementSession',
  'botSession',
  'mineflayerSession',
  'session'
] as const;

export const SESSION_FACTORY_NAMES = [
  'getMovementSession',
  'getBotSession',
  'getSession',
  'activeSession'
] as const;

export const SESSION_HOST_NAMES = ['sessionHost', 'sessions', 'botSessions', 'mineflayerSessions'] as const;

function asSession(value: unknown): MovementBotSession | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  const required = ['snapshot', 'subscribe', 'setControlState', 'clearControlStates', 'look', 'lookAt', 'entities'];
  for (const key of required) {
    if (typeof candidate[key] !== 'function') return null;
  }
  return candidate as unknown as MovementBotSession;
}

function asHost(value: unknown): MovementSessionHost | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.subscribe !== 'function') return null;
  const accessor = typeof candidate.active === 'function' ? candidate.active : candidate.current;
  if (typeof accessor !== 'function') return null;
  const subscribe = candidate.subscribe as (listener: () => void) => () => void;
  const read = accessor as () => unknown;
  return {
    active: () => asSession(read.call(candidate)),
    subscribe: (listener: () => void) => subscribe.call(candidate, listener)
  };
}

/**
 * The bot session module, imported only if it is genuinely in the build.
 *
 * `import.meta.glob` is the same mechanism the boot sequence uses to discover
 * features. It resolves to an empty record when nothing matches, so this
 * feature compiles, builds and runs whether or not the sibling module exists —
 * which a static import would not.
 */
const SESSION_MODULES = import.meta.glob<Record<string, unknown>>('../mineflayer/index.ts');

/** The global a session provider may call to hand this surface its session. */
export interface MovementProviderBridge {
  provideSession(session: MovementBotSession): void;
  provideHost(host: MovementSessionHost): void;
}

declare global {
  interface Window {
    mineflayerMovement?: MovementProviderBridge;
  }
}

export type BridgeState = 'searching' | 'unavailable' | 'ready';

/**
 * Holds whichever session was found and tells the surface which state it is in.
 *
 * There are three genuinely different states and the surface renders all three:
 * still looking, nothing to drive, and connected. Collapsing "no module" into
 * "not connected" would send somebody hunting for a server problem that is
 * really a missing module.
 */
export class MovementSessionBridge {
  private currentState: BridgeState = 'searching';
  private currentSession: MovementBotSession | null = null;
  private host: MovementSessionHost | null = null;
  private hostUnsubscribe: (() => void) | null = null;
  private readonly listeners = new Set<() => void>();
  private searched = false;

  state(): BridgeState {
    return this.currentState;
  }

  session(): MovementBotSession | null {
    return this.currentSession;
  }

  /** The exact places that were searched, for the honest empty state. */
  searchedFor(): string[] {
    return [
      `features/mineflayer/index.ts exporting one of: ${SESSION_EXPORT_NAMES.join(', ')}`,
      `features/mineflayer/index.ts exporting a factory: ${SESSION_FACTORY_NAMES.join(', ')}`,
      `features/mineflayer/index.ts exporting a multi-bot host: ${SESSION_HOST_NAMES.join(', ')}`,
      'window.mineflayerMovement.provideSession(session)'
    ];
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of [...this.listeners]) {
      try {
        listener();
      } catch (error) {
        console.error('A movement surface listener threw while the session changed.', error);
      }
    }
  }

  private adopt(session: MovementBotSession | null): void {
    this.currentSession = session;
    this.currentState = session ? 'ready' : this.searched ? 'unavailable' : 'searching';
    this.emit();
  }

  private adoptHost(host: MovementSessionHost): void {
    this.hostUnsubscribe?.();
    this.host = host;
    this.hostUnsubscribe = host.subscribe(() => this.adopt(this.host?.active() ?? null));
    this.adopt(host.active());
  }

  /** Installs the registration hook and then searches the sibling module. */
  async start(): Promise<void> {
    const bridge: MovementProviderBridge = {
      provideSession: (session: MovementBotSession) => {
        const checked = asSession(session);
        if (!checked) {
          console.error(
            'window.mineflayerMovement.provideSession was called with an object that does not implement the movement session contract.'
          );
          return;
        }
        this.hostUnsubscribe?.();
        this.hostUnsubscribe = null;
        this.host = null;
        this.adopt(checked);
      },
      provideHost: (host: MovementSessionHost) => {
        const checked = asHost(host);
        if (!checked) {
          console.error(
            'window.mineflayerMovement.provideHost was called with an object that does not implement the session-host contract.'
          );
          return;
        }
        this.adoptHost(checked);
      }
    };
    window.mineflayerMovement = bridge;

    const loaders = Object.values(SESSION_MODULES);
    let moduleExports: Record<string, unknown> | null = null;
    if (loaders.length > 0) {
      try {
        moduleExports = await loaders[0]();
      } catch (error) {
        console.error('The bot session module failed to load for the movement surface.', error);
      }
    }
    this.searched = true;

    if (!moduleExports) {
      if (!this.currentSession) this.adopt(null);
      return;
    }

    for (const name of SESSION_HOST_NAMES) {
      const host = asHost(moduleExports[name]);
      if (host) {
        this.adoptHost(host);
        return;
      }
    }

    for (const name of SESSION_EXPORT_NAMES) {
      const session = asSession(moduleExports[name]);
      if (session) {
        this.adopt(session);
        return;
      }
    }

    for (const name of SESSION_FACTORY_NAMES) {
      const factory = moduleExports[name];
      if (typeof factory !== 'function') continue;
      try {
        const session = asSession((factory as () => unknown)());
        if (session) {
          this.adopt(session);
          return;
        }
      } catch (error) {
        console.error(`The bot session factory "${name}" threw while the movement surface called it.`, error);
      }
    }

    if (!this.currentSession) this.adopt(null);
  }

  dispose(): void {
    this.hostUnsubscribe?.();
    this.hostUnsubscribe = null;
    this.listeners.clear();
  }
}

export const sessionBridge = new MovementSessionBridge();
