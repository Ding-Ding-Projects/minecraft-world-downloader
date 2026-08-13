/**
 * The downloader option schema the web console renders as its configuration
 * form, mirrored here so the same options can be edited natively.
 *
 * This is a transcription of the `OPTIONS` table in `web/app.py`, which is in
 * turn a hand-maintained mirror of the Java `config/Config.java`. Keys, command
 * line flags, types and defaults are reproduced exactly, because the console
 * persists them by key into `manager-config.json` and turns them into flags by
 * the same names. A key invented here would be written to that file and then
 * ignored by the console, which is worse than not offering the option at all.
 *
 * Each option carries its own English and Cantonese copy. Those two strings are
 * expanded into full five-rung ladders by `strings.ts`: a field label and the
 * sentence describing what a flag does are facts, and a fact reads the same at
 * every humour level.
 *
 * `portLocal` is deliberately present and deliberately annotated: the console
 * always forces `--local-port` to the fixed container port, so this field is the
 * published host port shown in the connect hint and nothing else. Presenting it
 * as if it moved the listener would be a lie the user only discovers when their
 * client cannot connect.
 */

export type ConsoleOptionType = 'text' | 'int' | 'bool';

export interface ConsoleOption {
  /** Group heading, exactly as the console groups them. */
  group: string;
  /** Key persisted into `manager-config.json`. */
  key: string;
  /** Command line flag the console builds from this key. */
  flag: string;
  type: ConsoleOptionType;
  /** The console's own default for this key. */
  defaultValue: string | boolean;
  label: string;
  labelYue: string;
  help: string;
  helpYue: string;
  /**
   * Set when the console never passes this key straight through to the
   * downloader, with the exact reason. The surface states the reason rather
   * than rendering a control that appears to do more than it does.
   */
  passthroughNote?: string;
  passthroughNoteYue?: string;
}

export const CONSOLE_OPTIONS: ConsoleOption[] = [
  {
    group: 'Connection',
    key: 'server',
    flag: '--server',
    type: 'text',
    defaultValue: '',
    label: 'Server address',
    labelYue: '伺服器地址',
    help: 'Remote server hostname or IP, without a port. The console refuses to start the downloader without it.',
    helpYue: '遠端伺服器嘅主機名或者 IP，唔使加埠號。冇咗佢，主控台唔會開下載器。'
  },
  {
    group: 'Connection',
    key: 'portLocal',
    flag: '--local-port',
    type: 'int',
    defaultValue: '25565',
    label: 'Proxy port (host)',
    labelYue: '代理埠（主機）',
    help: 'The host port your Minecraft client connects to. It is shown in the connect hint and saved with the configuration.',
    helpYue: '你 Minecraft 客戶端連去嘅主機埠。淨係顯示喺連線提示同埋跟住設定一齊儲。',
    passthroughNote:
      'The console always starts the proxy on the fixed container port 25565 regardless of this value, so changing this never moves the listener. Change the published port mapping instead.',
    passthroughNoteYue:
      '主控台一定用固定嘅容器埠 25565 開代理，唔理呢度填乜，所以改呢個永遠唔會搬個監聽埠。要改就去改發佈嘅埠對應。'
  },
  {
    group: 'Connection',
    key: 'disableSrvLookup',
    flag: '--disable-srv-lookup',
    type: 'bool',
    defaultValue: false,
    label: 'Disable SRV lookup',
    labelYue: '關閉 SRV 查詢',
    help: 'Stops the downloader resolving the true address through DNS SRV records before connecting.',
    helpYue: '唔好再用 DNS SRV 記錄去查真正地址先至連線。'
  },

  {
    group: 'World output',
    key: 'worldOutputDir',
    flag: '--output',
    type: 'text',
    defaultValue: 'world',
    label: 'Output directory',
    labelYue: '輸出資料夾',
    help: 'World output directory, relative to the data directory. An existing world at that path is updated rather than replaced.',
    helpYue: '世界輸出資料夾，相對於資料目錄。如果嗰度已經有世界，係更新，唔係覆蓋走。'
  },
  {
    group: 'World output',
    key: 'levelSeed',
    flag: '--seed',
    type: 'text',
    defaultValue: '',
    label: 'Level seed',
    labelYue: '世界種子',
    help: 'Numeric level seed written into the output world, so terrain generated beyond the captured chunks matches the server.',
    helpYue: '寫入輸出世界嘅數字種子，令捉唔到嘅區塊之外自己生成嘅地形同伺服器一樣。'
  },
  {
    group: 'World output',
    key: 'centerX',
    flag: '--center-x',
    type: 'int',
    defaultValue: '',
    label: 'Center X',
    labelYue: '中心 X',
    help: 'Offsets the world so this X coordinate sits at the origin, rounded to 512.',
    helpYue: '將世界平移，令呢個 X 坐標變做原點，會取整到 512。',
    passthroughNote: 'Both Center X and Center Z must be filled in; the console omits the pair entirely when either is blank.',
    passthroughNoteYue: '中心 X 同中心 Z 要一齊填；任何一個空咗，主控台就成對都唔會加。'
  },
  {
    group: 'World output',
    key: 'centerZ',
    flag: '--center-z',
    type: 'int',
    defaultValue: '',
    label: 'Center Z',
    labelYue: '中心 Z',
    help: 'Offsets the world so this Z coordinate sits at the origin, rounded to 512.',
    helpYue: '將世界平移，令呢個 Z 坐標變做原點，會取整到 512。',
    passthroughNote: 'Both Center X and Center Z must be filled in; the console omits the pair entirely when either is blank.',
    passthroughNoteYue: '中心 X 同中心 Z 要一齊填；任何一個空咗，主控台就成對都唔會加。'
  },
  {
    group: 'World output',
    key: 'disableWorldGen',
    flag: '--disable-world-gen',
    type: 'bool',
    defaultValue: false,
    label: 'Superflat void',
    labelYue: '超平坦虛空',
    help: 'Sets the output world type to a superflat void so nothing new generates around the chunks you captured.',
    helpYue: '將輸出世界設做超平坦虛空，咁你捉到嘅區塊周圍就唔會再生成新嘢。'
  },
  {
    group: 'World output',
    key: 'disableWriteChunks',
    flag: '--disable-chunk-saving',
    type: 'bool',
    defaultValue: false,
    label: 'Disable chunk saving',
    labelYue: '停止寫入區塊',
    help: 'Keeps the proxy running but writes no chunks to disk. A debugging switch: with it on, nothing is saved.',
    helpYue: '代理照跑，但係一個區塊都唔寫落硬碟。呢個係除錯掣：開咗就乜都唔會儲到。'
  },
  {
    group: 'World output',
    key: 'ignoreBlockChanges',
    flag: '--ignore-block-changes',
    type: 'bool',
    defaultValue: false,
    label: 'Ignore block changes',
    labelYue: '無視方塊改動',
    help: 'Ignores changes to a chunk after it has been loaded, so the saved copy is the state at first sight.',
    helpYue: '區塊載入之後嘅改動一律唔理，儲低嘅就係第一眼見到嗰個樣。'
  },

  {
    group: 'Render distance & map',
    key: 'extendedRenderDistance',
    flag: '--extended-render-distance',
    type: 'int',
    defaultValue: '0',
    label: 'Extended render distance',
    labelYue: '延伸渲染距離',
    help: 'Sends already-downloaded chunks back to your client to extend how far you can see. Zero turns it off.',
    helpYue: '將已經下載咗嘅區塊送返俾你個客戶端，等你望得遠啲。填 0 就係唔用。'
  },
  {
    group: 'Render distance & map',
    key: 'extendedRenderPace',
    flag: '--extended-render-pace',
    type: 'int',
    defaultValue: '6',
    label: 'Extended render pace (ms)',
    labelYue: '延伸渲染節奏（毫秒）',
    help: 'Pause between each re-sent chunk. Lower fills the view faster and more choppily; higher is smoother and slower.',
    helpYue: '每送一個區塊之間停幾耐。細啲就填得快但卡吓卡吓，大啲就順滑但慢。'
  },
  {
    group: 'Render distance & map',
    key: 'renderOtherPlayers',
    flag: '--render-players',
    type: 'bool',
    defaultValue: false,
    label: 'Render players',
    labelYue: '顯示其他玩家',
    help: 'Draws the other players on the overview map the console serves.',
    helpYue: '喺主控台個總覽地圖度畫埋其他玩家。'
  },
  {
    group: 'Render distance & map',
    key: 'markNewChunks',
    flag: '--mark-new-chunks',
    type: 'bool',
    defaultValue: false,
    label: 'Mark new chunks',
    labelYue: '標示新區塊',
    help: 'Outlines newly captured chunks in orange on the overview map.',
    helpYue: '喺總覽地圖度用橙色框住啱啱捉到嘅區塊。'
  },
  {
    group: 'Render distance & map',
    key: 'markOldChunks',
    flag: '--mark-old-chunks',
    type: 'bool',
    defaultValue: true,
    label: 'Mark old chunks',
    labelYue: '標示舊區塊',
    help: 'Greys out previously captured chunks on the overview map.',
    helpYue: '喺總覽地圖度將之前已經捉咗嘅區塊變灰。'
  },
  {
    group: 'Render distance & map',
    key: 'disableMarkUnsavedChunks',
    flag: '--disable-mark-unsaved',
    type: 'bool',
    defaultValue: false,
    label: 'Disable unsaved marking',
    labelYue: '關閉未儲存標示',
    help: 'Stops the map marking not-yet-written chunks in red.',
    helpYue: '唔好再用紅色喺地圖標住仲未寫落硬碟嘅區塊。'
  },
  {
    group: 'Render distance & map',
    key: 'drawExtendedChunks',
    flag: '--draw-extended-chunks',
    type: 'bool',
    defaultValue: false,
    label: 'Draw extended chunks',
    labelYue: '畫埋延伸區塊',
    help: 'Draws the chunks re-sent for extended render distance onto the map as well.',
    helpYue: '連為咗延伸渲染而重新送出嘅區塊都畫埋落地圖。'
  },
  {
    group: 'Render distance & map',
    key: 'enableCaveRenderMode',
    flag: '--enable-cave-mode',
    type: 'bool',
    defaultValue: false,
    label: 'Cave render mode',
    labelYue: '洞穴渲染模式',
    help: 'Switches the map to cave rendering automatically while you are underground.',
    helpYue: '你落到地底嘅時候，地圖自動轉做洞穴渲染。'
  },
  {
    group: 'Render distance & map',
    key: 'disableMapRender',
    flag: '--disable-map-render',
    type: 'bool',
    defaultValue: false,
    label: 'Disable live map',
    labelYue: '關閉即時地圖',
    help: 'Turns off the headless overview rendering. With it on, the live map has no tiles to show.',
    helpYue: '關咗無介面嘅總覽渲染。開咗呢個掣，即時地圖就冇圖磚可以顯示，即係一片空白。'
  },
  {
    group: 'Render distance & map',
    key: 'disableModdedBlockColors',
    flag: '--disable-modded-block-colors',
    type: 'bool',
    defaultValue: false,
    label: 'Disable modded block colours',
    labelYue: '關閉模組方塊顏色',
    help: 'Stops colouring blocks outside the minecraft: namespace on the map.',
    helpYue: '唔再幫 minecraft: 命名空間以外嘅方塊上色。'
  },

  {
    group: 'Auto-open containers',
    key: 'autoOpenContainers',
    flag: '--auto-open-containers',
    type: 'bool',
    defaultValue: false,
    label: 'Auto-open containers',
    labelYue: '自動打開容器',
    help: 'Opens nearby containers one at a time as you move so their contents are recorded. Experimental, and it can trip server anti-cheat.',
    helpYue: '你行過嘅時候逐個打開附近嘅容器，記低入面有咩。實驗功能，有機會踩親伺服器嘅反作弊。'
  },
  {
    group: 'Auto-open containers',
    key: 'autoOpenDelay',
    flag: '--auto-open-delay',
    type: 'int',
    defaultValue: '400',
    label: 'Delay (ms)',
    labelYue: '間隔（毫秒）',
    help: 'Minimum milliseconds between two auto-opened containers. Higher is slower and less likely to look automated.',
    helpYue: '兩個自動打開嘅容器之間最少隔幾多毫秒。大啲就慢啲，冇咁似機械人。'
  },
  {
    group: 'Auto-open containers',
    key: 'autoOpenGamemodes',
    flag: '--auto-open-gamemodes',
    type: 'text',
    defaultValue: 'all',
    label: 'Gamemodes',
    labelYue: '遊戲模式',
    help: 'Which gamemodes the sweep runs in: all, or a comma-separated list of survival, creative, adventure, spectator.',
    helpYue: '喺邊啲遊戲模式先掃：all，又或者用逗號分開嘅 survival、creative、adventure、spectator。'
  },
  {
    group: 'Auto-open containers',
    key: 'autoOpenAllowTrappedChests',
    flag: '--auto-open-allow-trapped-chests',
    type: 'bool',
    defaultValue: false,
    label: 'Open trapped chests',
    labelYue: '打開陷阱箱',
    help: 'Trapped chests are skipped by default because opening one emits a redstone pulse that can trigger a contraption or an alarm.',
    helpYue: '預設會跳過陷阱箱，因為一開就會出紅石信號，可能觸發機關或者警報。'
  },
  {
    group: 'Auto-open containers',
    key: 'autoOpenAllowChestNearPlayers',
    flag: '--auto-open-allow-chest-near-players',
    type: 'bool',
    defaultValue: false,
    label: 'Open chests near players',
    labelYue: '有人喺附近都開箱',
    help: 'Chests, barrels and shulkers are skipped while another player is within the radius below. Turning this on opens them anyway.',
    helpYue: '下面嗰個半徑之內有第二個玩家嘅時候，箱、桶同潛影盒都會跳過。開咗呢個就照開。'
  },
  {
    group: 'Auto-open containers',
    key: 'autoOpenPlayerRadius',
    flag: '--auto-open-player-radius',
    type: 'text',
    defaultValue: '100',
    label: 'Player radius (blocks)',
    labelYue: '玩家半徑（格）',
    help: 'Radius of the nearby-player check that protects chests, barrels and shulkers.',
    helpYue: '保護箱、桶同潛影盒嗰個「附近有冇人」檢查嘅半徑。'
  },
  {
    group: 'Auto-open containers',
    key: 'autoOpenLog',
    flag: '--auto-open-log',
    type: 'text',
    defaultValue: '',
    label: 'Item log file',
    labelYue: '物品記錄檔',
    help: 'File the captured item list is appended to. Blank writes auto-open-items.log beside the world.',
    helpYue: '捉到嘅物品清單會加落邊個檔案。留空就寫喺世界隔籬嘅 auto-open-items.log。'
  },
  {
    group: 'Auto-open containers',
    key: 'autoOpenState',
    flag: '--auto-open-state',
    type: 'text',
    defaultValue: '',
    label: 'State file',
    labelYue: '狀態檔',
    help: 'File recording which containers were already opened so none is opened twice. Blank writes auto-open-attempted.txt beside the world.',
    helpYue: '記住邊啲容器開過，等佢唔會開兩次。留空就寫喺世界隔籬嘅 auto-open-attempted.txt。'
  },

  {
    group: 'Chat auto-reply',
    key: 'autoReply',
    flag: '--auto-reply',
    type: 'bool',
    defaultValue: false,
    label: 'Enable auto-reply',
    labelYue: '開啟自動回覆',
    help: 'Sends real chat back to the server when an incoming message matches the trigger below. Experimental: it speaks as you.',
    helpYue: '收到嘅訊息夾中下面個觸發字眼時，會用真嘅聊天訊息回覆伺服器。實驗功能：佢係用你個名講嘢。'
  },
  {
    group: 'Chat auto-reply',
    key: 'autoReplyTrigger',
    flag: '--auto-reply-trigger',
    type: 'text',
    defaultValue: '',
    label: 'Trigger text',
    labelYue: '觸發字眼',
    help: 'The exact text that triggers a reply. Auto-reply does nothing without it.',
    helpYue: '一模一樣先算觸發嘅字眼。冇填就自動回覆乜都唔會做。'
  },
  {
    group: 'Chat auto-reply',
    key: 'autoReplyTriggerColor',
    flag: '--auto-reply-trigger-color',
    type: 'text',
    defaultValue: 'yellow',
    label: 'Trigger colour',
    labelYue: '觸發顏色',
    help: 'Minecraft colour name of the text that has to match the trigger.',
    helpYue: '要夾中觸發字眼嗰段文字嘅 Minecraft 顏色名。'
  },
  {
    group: 'Chat auto-reply',
    key: 'autoReplyColor',
    flag: '--auto-reply-color',
    type: 'text',
    defaultValue: 'red',
    label: 'Reply colour',
    labelYue: '回覆顏色',
    help: 'Minecraft colour name of the text sent back as the reply.',
    helpYue: '當做回覆送返出去嗰段文字嘅 Minecraft 顏色名。'
  },
  {
    group: 'Chat auto-reply',
    key: 'autoReplyDelay',
    flag: '--auto-reply-delay',
    type: 'int',
    defaultValue: '1500',
    label: 'Reply delay (ms)',
    labelYue: '回覆間隔（毫秒）',
    help: 'Minimum milliseconds between two auto-replies, so the server does not see a burst and kick you for spam.',
    helpYue: '兩次自動回覆之間最少隔幾多毫秒，唔好一次過爆一堆俾伺服器當洗版踢走你。'
  },

  {
    group: 'Advanced',
    key: 'disableInfoMessages',
    flag: '--disable-messages',
    type: 'bool',
    defaultValue: false,
    label: 'Disable info messages',
    labelYue: '關閉資訊訊息',
    help: 'Silences the downloader’s in-game information messages, such as the chest-saved notice.',
    helpYue: '收起下載器喺遊戲入面嘅資訊訊息，例如「已儲存箱子」嗰啲。'
  },
  {
    group: 'Advanced',
    key: 'enableVoiceProxy',
    flag: '--enable-voice-proxy',
    type: 'bool',
    defaultValue: false,
    label: 'Voice-chat proxy',
    labelYue: '語音聊天代理',
    help: 'Proxies Simple Voice Chat and PlasmoVoice UDP through the downloader. The UDP port has to be published as well.',
    helpYue: '將 Simple Voice Chat 同 PlasmoVoice 嘅 UDP 經下載器轉送。記住 UDP 埠都要一齊發佈。'
  },
  {
    group: 'Advanced',
    key: 'containerMessageFormat',
    flag: '--container-message-format',
    type: 'text',
    defaultValue: '',
    label: 'Container message format',
    labelYue: '容器訊息格式',
    help: 'Template for the saved-container action bar message. Placeholders: {type} {count} {x} {y} {z}. Blank uses the built-in format.',
    helpYue: '已儲存容器嗰句動作列訊息嘅格式。可以用 {type} {count} {x} {y} {z}。留空就用內建格式。'
  },
  {
    group: 'Advanced',
    key: 'devMode',
    flag: '--dev-mode',
    type: 'bool',
    defaultValue: false,
    label: 'Developer mode',
    labelYue: '開發者模式',
    help: 'Enables the downloader’s developer mode, which is noisier and not intended for ordinary capture runs.',
    helpYue: '開下載器嘅開發者模式，佢會嘈好多，唔係做普通捕捉嗰陣用嘅。'
  }
];

export const CONSOLE_OPTION_GROUPS: string[] = [...new Set(CONSOLE_OPTIONS.map((option) => option.group))];

/** Cantonese headings for the console's own group names. */
export const CONSOLE_GROUP_YUE: Record<string, string> = {
  Connection: '連線',
  'World output': '世界輸出',
  'Render distance & map': '渲染距離同地圖',
  'Auto-open containers': '自動開容器',
  'Chat auto-reply': '聊天自動回覆',
  Advanced: '進階'
};

const BOOL_TRUE = new Set(['1', 'true', 'on', 'yes']);

/** The console's own truthiness rule, reproduced so a saved file round-trips. */
export function optionIsTrue(raw: unknown): boolean {
  if (raw === true) return true;
  if (typeof raw === 'number') return raw !== 0;
  return BOOL_TRUE.has(String(raw ?? '').trim().toLowerCase());
}

export type ConsoleConfig = Record<string, string | boolean>;

/** Every key at the console's compiled-in default. */
export function defaultConfig(): ConsoleConfig {
  const config: ConsoleConfig = {};
  for (const option of CONSOLE_OPTIONS) {
    config[option.key] = option.type === 'bool' ? optionIsTrue(option.defaultValue) : String(option.defaultValue ?? '');
  }
  return config;
}

/** Coerces an arbitrary parsed JSON document into the schema's own shapes. */
export function normalizeConfig(raw: unknown): ConsoleConfig {
  const config = defaultConfig();
  if (!raw || typeof raw !== 'object') return config;
  const source = raw as Record<string, unknown>;
  for (const option of CONSOLE_OPTIONS) {
    if (!(option.key in source)) continue;
    const value = source[option.key];
    config[option.key] = option.type === 'bool' ? optionIsTrue(value) : String(value ?? '').trim();
  }
  return config;
}

/** True when the value differs from the console's own default for that key. */
export function isCustomised(option: ConsoleOption, value: string | boolean | undefined): boolean {
  if (option.type === 'bool') return optionIsTrue(value) !== optionIsTrue(option.defaultValue);
  return String(value ?? '') !== String(option.defaultValue ?? '');
}

/** Validates one value against the option's own type. Null means acceptable. */
export function validateOption(option: ConsoleOption, value: string | boolean): string | null {
  if (option.type === 'bool') return null;
  const text = String(value ?? '').trim();
  if (option.key === 'server') {
    if (text.length === 0) return null; // empty is allowed while editing; starting refuses it
    if (/\s/.test(text)) return 'A server address cannot contain a space.';
    if (text.includes(':')) return 'Leave the port out of the address; the proxy port is a separate field.';
    return null;
  }
  if (option.type === 'int') {
    if (text.length === 0) return null;
    if (!/^-?\d+$/.test(text)) return 'This option takes a whole number.';
    return null;
  }
  return null;
}

/**
 * The command line the console would build from this configuration.
 *
 * Reproduced from `Downloader.build_command` so the surface can show exactly
 * what will run before it runs, including the two places where the console
 * overrides what the form says.
 */
export function previewCommandLine(config: ConsoleConfig, jarPath: string): string[] {
  const command = ['java', '-Djava.awt.headless=true', '-jar', jarPath || 'world-downloader.jar', '--no-gui'];
  const server = String(config.server ?? '').trim();
  command.push('--server', server.length > 0 ? server : '<server address is required>');

  const centerX = String(config.centerX ?? '').trim();
  const centerZ = String(config.centerZ ?? '').trim();

  for (const option of CONSOLE_OPTIONS) {
    if (option.key === 'server' || option.key === 'centerX' || option.key === 'centerZ' || option.key === 'portLocal') {
      continue;
    }
    const raw = config[option.key];
    if (option.type === 'bool') {
      if (optionIsTrue(raw)) command.push(option.flag);
      continue;
    }
    const value = String(raw ?? '').trim();
    if (value.length > 0) command.push(option.flag, value);
  }

  // The console forces the listener onto the published container port, whatever
  // the host-port field says.
  command.push('--local-port', '25565');
  if (centerX.length > 0 && centerZ.length > 0) command.push('--center-x', centerX, '--center-z', centerZ);
  return command;
}
