import type { Catalogue, FunnyLadder, TranslationEntry } from '../../core/registry';

/**
 * The credits.
 *
 * Every entry names a project or a person whose work this application actually
 * uses, and links to that project's own page. Nothing here is a marketing list:
 * a row exists because the thing it names is depended on, and the role column
 * says what it does here rather than what it is famous for.
 *
 * The funding rule lives with this data for a reason. This application takes no
 * money in any direction, so the only sensible destination for a contribution is
 * upstream — which means every link goes straight to that project's own page and
 * nothing routes through this project. Whether a given project accepts money at
 * all is stated on their page, and is deliberately not guessed at here.
 */

function ladder(...steps: string[]): FunnyLadder {
  if (steps.length === 3) return [steps[0], steps[0], steps[1], steps[2], steps[2]];
  if (steps.length === 1) return [steps[0], steps[0], steps[0], steps[0], steps[0]];
  throw new Error(`A ladder takes 1 or 3 strings; ${steps.length} were given.`);
}

function entry(en: FunnyLadder, yue: FunnyLadder): TranslationEntry {
  return { en, yue };
}

export type CreditRole =
  | 'upstream'
  | 'forkFix'
  | 'library'
  | 'buildTool'
  | 'runtime'
  | 'uiToolkit'
  | 'protocolReference'
  | 'mapRenderer'
  | 'installer';

export type CreditGroup =
  | 'original'
  | 'forks'
  | 'downloader'
  | 'buildAndTest'
  | 'webConsole'
  | 'desktop'
  | 'bot'
  | 'map'
  | 'protocol';

export interface Credit {
  id: string;
  /** A proper noun. Never translated and never styled by the humour level. */
  name: string;
  role: CreditRole;
  group: CreditGroup;
  /** The project's own page. Opened in the user's browser, never fetched. */
  url: string;
}

export const CREDITS: Credit[] = [
  {
    id: 'mircokroon',
    name: 'minecraft-world-downloader by Mirco Kroon',
    role: 'upstream',
    group: 'original',
    url: 'https://github.com/mircokroon/minecraft-world-downloader'
  },
  {
    id: 'mircokroon-launcher',
    name: 'minecraft-world-downloader-launcher',
    role: 'upstream',
    group: 'original',
    url: 'https://github.com/mircokroon/minecraft-world-downloader-launcher'
  },
  {
    id: 'thehecateii',
    name: 'TheHecateII',
    role: 'forkFix',
    group: 'forks',
    url: 'https://github.com/TheHecateII/minecraft-world-downloader'
  },
  {
    id: 'byloper',
    name: '7byLoper',
    role: 'forkFix',
    group: 'forks',
    url: 'https://github.com/7byLoper/minecraft-world-downloader'
  },
  {
    id: 'trichhoffson',
    name: 'trichhoffson',
    role: 'forkFix',
    group: 'forks',
    url: 'https://github.com/trichhoffson/minecraft-world-downloader'
  },
  { id: 'jo-nbt', name: 'jo-nbt', role: 'library', group: 'downloader', url: 'https://github.com/llbit/jo-nbt' },
  { id: 'gson', name: 'Gson', role: 'library', group: 'downloader', url: 'https://github.com/google/gson' },
  { id: 'unirest', name: 'Unirest for Java', role: 'library', group: 'downloader', url: 'https://github.com/Kong/unirest-java' },
  { id: 'nanohttpd', name: 'NanoHTTPD', role: 'library', group: 'downloader', url: 'https://github.com/NanoHttpd/nanohttpd' },
  { id: 'commons-io', name: 'Apache Commons IO', role: 'library', group: 'downloader', url: 'https://github.com/apache/commons-io' },
  { id: 'commons-lang', name: 'Apache Commons Lang', role: 'library', group: 'downloader', url: 'https://github.com/apache/commons-lang' },
  { id: 'args4j', name: 'args4j', role: 'library', group: 'downloader', url: 'https://github.com/kohsuke/args4j' },
  { id: 'slf4j', name: 'SLF4J', role: 'library', group: 'downloader', url: 'https://github.com/qos-ch/slf4j' },
  { id: 'dnsjava', name: 'dnsjava', role: 'library', group: 'downloader', url: 'https://github.com/dnsjava/dnsjava' },
  { id: 'openjfx', name: 'OpenJFX / JavaFX', role: 'uiToolkit', group: 'downloader', url: 'https://github.com/openjdk/jfx' },
  { id: 'junit5', name: 'JUnit 5', role: 'buildTool', group: 'buildAndTest', url: 'https://github.com/junit-team/junit5' },
  { id: 'assertj', name: 'AssertJ', role: 'buildTool', group: 'buildAndTest', url: 'https://github.com/assertj/assertj' },
  { id: 'mockito', name: 'Mockito', role: 'buildTool', group: 'buildAndTest', url: 'https://github.com/mockito/mockito' },
  { id: 'maven', name: 'Apache Maven', role: 'buildTool', group: 'buildAndTest', url: 'https://github.com/apache/maven' },
  {
    id: 'javafx-maven-plugin',
    name: 'javafx-maven-plugin',
    role: 'buildTool',
    group: 'buildAndTest',
    url: 'https://github.com/openjfx/javafx-maven-plugin'
  },
  { id: 'flask', name: 'Flask', role: 'library', group: 'webConsole', url: 'https://github.com/pallets/flask' },
  { id: 'waitress', name: 'Waitress', role: 'library', group: 'webConsole', url: 'https://github.com/Pylons/waitress' },
  { id: 'requests', name: 'Requests', role: 'library', group: 'webConsole', url: 'https://github.com/psf/requests' },
  { id: 'electron', name: 'Electron', role: 'runtime', group: 'desktop', url: 'https://github.com/electron/electron' },
  { id: 'chromium', name: 'Chromium', role: 'runtime', group: 'desktop', url: 'https://www.chromium.org/Home/' },
  { id: 'nodejs', name: 'Node.js', role: 'runtime', group: 'desktop', url: 'https://github.com/nodejs/node' },
  { id: 'typescript', name: 'TypeScript', role: 'buildTool', group: 'desktop', url: 'https://github.com/microsoft/TypeScript' },
  { id: 'vite', name: 'Vite', role: 'buildTool', group: 'desktop', url: 'https://github.com/vitejs/vite' },
  {
    id: 'electron-vite',
    name: 'electron-vite',
    role: 'buildTool',
    group: 'desktop',
    url: 'https://github.com/alex8088/electron-vite'
  },
  {
    id: 'electron-builder',
    name: 'electron-builder',
    role: 'buildTool',
    group: 'desktop',
    url: 'https://github.com/electron-userland/electron-builder'
  },
  {
    id: 'squirrel-windows',
    name: 'Squirrel.Windows',
    role: 'installer',
    group: 'desktop',
    url: 'https://github.com/Squirrel/Squirrel.Windows'
  },
  { id: 'mineflayer', name: 'Mineflayer', role: 'library', group: 'bot', url: 'https://github.com/PrismarineJS/mineflayer' },
  {
    id: 'mineflayer-pathfinder',
    name: 'mineflayer-pathfinder',
    role: 'library',
    group: 'bot',
    url: 'https://github.com/PrismarineJS/mineflayer-pathfinder'
  },
  {
    id: 'prismarine-auth',
    name: 'prismarine-auth',
    role: 'library',
    group: 'bot',
    url: 'https://github.com/PrismarineJS/prismarine-auth'
  },
  {
    id: 'bluemap',
    name: 'BlueMap',
    role: 'mapRenderer',
    group: 'map',
    url: 'https://github.com/BlueMap-Minecraft/BlueMap'
  },
  { id: 'paper', name: 'PaperMC', role: 'runtime', group: 'map', url: 'https://github.com/PaperMC/Paper' },
  {
    id: 'minecraft-data',
    name: 'PrismarineJS / minecraft-data',
    role: 'protocolReference',
    group: 'protocol',
    url: 'https://github.com/PrismarineJS/minecraft-data'
  },
  {
    id: 'minecraft-wiki',
    name: 'minecraft.wiki protocol documentation',
    role: 'protocolReference',
    group: 'protocol',
    url: 'https://minecraft.wiki/w/Java_Edition_protocol'
  }
];

export const ROLE_KEYS: Record<CreditRole, string> = {
  upstream: 'app-identity.role.upstream',
  forkFix: 'app-identity.role.forkFix',
  library: 'app-identity.role.library',
  buildTool: 'app-identity.role.buildTool',
  runtime: 'app-identity.role.runtime',
  uiToolkit: 'app-identity.role.uiToolkit',
  protocolReference: 'app-identity.role.protocolReference',
  mapRenderer: 'app-identity.role.mapRenderer',
  installer: 'app-identity.role.installer'
};

export const GROUP_KEYS: Record<CreditGroup, string> = {
  original: 'app-identity.group.original',
  forks: 'app-identity.group.forks',
  downloader: 'app-identity.group.downloader',
  buildAndTest: 'app-identity.group.buildAndTest',
  webConsole: 'app-identity.group.webConsole',
  desktop: 'app-identity.group.desktop',
  bot: 'app-identity.group.bot',
  map: 'app-identity.group.map',
  protocol: 'app-identity.group.protocol'
};

export const CREDIT_STRINGS: Catalogue = {
  'app-identity.role.upstream': entry(
    ladder('The project this one grew out of', 'The project this one grew out of', 'The project this whole thing grew out of'),
    ladder('呢個專案嘅源頭', '呢個專案嘅源頭', '成件事嘅源頭就係佢')
  ),
  'app-identity.role.forkFix': entry(
    ladder('Fixes and features borrowed from their fork', 'Fixes and features borrowed from their fork', 'Fixes and features borrowed, with thanks, from their fork'),
    ladder('由佢個分支借嚟嘅修正同功能', '由佢個分支借嚟嘅修正同功能', '厚住面皮由佢個分支借返嚟嘅修正同功能')
  ),
  'app-identity.role.library': entry(
    ladder('A library this runs on'),
    ladder('本程式靠住行嘅程式庫')
  ),
  'app-identity.role.buildTool': entry(
    ladder('Builds or tests it'),
    ladder('負責建置或者測試')
  ),
  'app-identity.role.runtime': entry(
    ladder('The runtime it executes on'),
    ladder('佢行喺上面嘅執行環境')
  ),
  'app-identity.role.uiToolkit': entry(
    ladder('The interface toolkit'),
    ladder('介面工具套件')
  ),
  'app-identity.role.protocolReference': entry(
    ladder('Protocol reference used when adding version support'),
    ladder('加版本支援時參考嘅協定文件')
  ),
  'app-identity.role.mapRenderer': entry(
    ladder('Renders the map'),
    ladder('負責畫地圖')
  ),
  'app-identity.role.installer': entry(
    ladder('Packages the Windows installer'),
    ladder('打包 Windows 安裝程式')
  ),
  'app-identity.group.original': entry(ladder('Original project'), ladder('原始專案')),
  'app-identity.group.forks': entry(ladder('Forks this one borrows from'), ladder('借咗嘢嘅分支')),
  'app-identity.group.downloader': entry(ladder('World downloader'), ladder('世界下載器')),
  'app-identity.group.buildAndTest': entry(ladder('Build and test'), ladder('建置同測試')),
  'app-identity.group.webConsole': entry(ladder('Web console'), ladder('網頁主控台')),
  'app-identity.group.desktop': entry(ladder('Desktop application'), ladder('桌面程式')),
  'app-identity.group.bot': entry(ladder('Scraper bot'), ladder('自動探索機械人')),
  'app-identity.group.map': entry(ladder('Map renderer'), ladder('地圖繪製')),
  'app-identity.group.protocol': entry(ladder('Protocol reference'), ladder('協定參考'))
};
