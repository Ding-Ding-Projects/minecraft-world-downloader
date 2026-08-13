/**
 * This feature's copy, in English and playful Hong Kong Cantonese, at all five
 * humour levels.
 *
 * The rule the whole catalogue obeys: humour styles the voice and never the
 * facts. A message about a render that failed still names the world, the reason
 * and what to do next at level 5 exactly as it does at level 1; a message about
 * a local-only address still says loopback. Anything a reader would have to act
 * on stays in every rung.
 */

import type { Catalogue } from '../../core/registry';

export const strings: Catalogue = {
  /* ---------------- destination and headings ---------------- */

  'worldlens.tab': {
    en: ['Worldlens', 'Worldlens', 'Worldlens', 'Worldlens', 'Worldlens'],
    yue: ['Worldlens', 'Worldlens', 'Worldlens', 'Worldlens', 'Worldlens']
  },
  'worldlens.tab.subtitle': {
    en: [
      'Hand a downloaded world to the companion renderer.',
      'Hand a downloaded world to the companion renderer.',
      'Send a world you downloaded over to the renderer next door.',
      'This app catches worlds; Worldlens draws them. Pass one over.',
      'This app catches worlds; Worldlens draws them. Pass one over.'
    ],
    yue: [
      '將下載咗嘅世界交畀配套嘅渲染器。',
      '將下載咗嘅世界交畀配套嘅渲染器。',
      '將你下載返嚟嘅世界，遞畀隔籬個渲染器。',
      '呢個 app 負責捉世界，Worldlens 負責畫。遞個過去啦。',
      '呢個 app 負責捉世界，Worldlens 負責畫。遞個過去啦。'
    ]
  },
  'worldlens.section.desktop': {
    en: [
      'The Worldlens desktop application',
      'The Worldlens desktop application',
      'The Worldlens desktop application',
      'The Worldlens desktop application — is it actually here?',
      'The Worldlens desktop application — is it actually here?'
    ],
    yue: [
      'Worldlens 桌面應用程式',
      'Worldlens 桌面應用程式',
      'Worldlens 桌面應用程式',
      'Worldlens 桌面應用程式 —— 究竟裝咗未？',
      'Worldlens 桌面應用程式 —— 究竟裝咗未？'
    ]
  },
  'worldlens.section.renderer': {
    en: [
      'The headless renderer',
      'The headless renderer',
      'The headless renderer',
      'The headless renderer — the half with no windows',
      'The headless renderer — the half with no windows'
    ],
    yue: [
      '無介面渲染器',
      '無介面渲染器',
      '無介面渲染器',
      '無介面渲染器 —— 冇窗嗰半邊',
      '無介面渲染器 —— 冇窗嗰半邊'
    ]
  },
  'worldlens.section.worlds': {
    en: [
      'Downloaded worlds',
      'Downloaded worlds',
      'Downloaded worlds',
      'Worlds already in the bag',
      'Worlds already in the bag'
    ],
    yue: ['已下載嘅世界', '已下載嘅世界', '已下載嘅世界', '已經入咗袋嘅世界', '已經入咗袋嘅世界']
  },
  'worldlens.section.run': {
    en: [
      'Render and serve',
      'Render and serve',
      'Render and serve',
      'Render it, then serve it — locally, to you alone',
      'Render it, then serve it — locally, to you alone'
    ],
    yue: [
      '渲染同放送',
      '渲染同放送',
      '渲染同放送',
      '畫完就放送 —— 淨係喺本機，淨係畀你自己睇',
      '畫完就放送 —— 淨係喺本機，淨係畀你自己睇'
    ]
  },

  /* ---------------- desktop application states ---------------- */

  'worldlens.desktop.installed': {
    en: [
      'Worldlens {version} is installed at {path}.',
      'Worldlens {version} is installed at {path}.',
      'Found it: Worldlens {version}, at {path}.',
      'There it is — Worldlens {version}, sitting at {path}.',
      'There it is — Worldlens {version}, sitting at {path}.'
    ],
    yue: [
      'Worldlens {version} 已安裝喺 {path}。',
      'Worldlens {version} 已安裝喺 {path}。',
      '搵到喇：Worldlens {version}，喺 {path}。',
      '喺度呀 —— Worldlens {version}，就喺 {path} 度坐緊。',
      '喺度呀 —— Worldlens {version}，就喺 {path} 度坐緊。'
    ]
  },
  'worldlens.desktop.installedUnknownVersion': {
    en: [
      'Worldlens is installed at {path}. Its version could not be read from the install layout.',
      'Worldlens is installed at {path}. Its version could not be read from the install layout.',
      'Worldlens is at {path}. The install layout does not say which version.',
      'Worldlens is at {path}, though it declines to say which version it is.',
      'Worldlens is at {path}, though it declines to say which version it is.'
    ],
    yue: [
      'Worldlens 已安裝喺 {path}。由安裝結構讀唔到佢個版本。',
      'Worldlens 已安裝喺 {path}。由安裝結構讀唔到佢個版本。',
      'Worldlens 喺 {path}。安裝結構冇講係邊個版本。',
      'Worldlens 喺 {path}，不過佢唔肯講自己係邊個版本。',
      'Worldlens 喺 {path}，不過佢唔肯講自己係邊個版本。'
    ]
  },
  'worldlens.desktop.notInstalled': {
    en: [
      'Worldlens is not installed. Looked in: {searched}.',
      'Worldlens is not installed. Looked in: {searched}.',
      'No Worldlens here. Looked in: {searched}.',
      'No Worldlens on this machine. It was looked for in {searched} and was not there.',
      'No Worldlens on this machine. It was looked for in {searched} and was not there.'
    ],
    yue: [
      'Worldlens 未安裝。搵過：{searched}。',
      'Worldlens 未安裝。搵過：{searched}。',
      '呢部機冇 Worldlens。搵過：{searched}。',
      '呢部機真係冇 Worldlens。喺 {searched} 搵過，冇喺度。',
      '呢部機真係冇 Worldlens。喺 {searched} 搵過，冇喺度。'
    ]
  },
  'worldlens.desktop.unsupported': {
    en: [
      'Worldlens ships a Windows installer. This is {platform}, so there is no installed copy to detect.',
      'Worldlens ships a Windows installer. This is {platform}, so there is no installed copy to detect.',
      'Worldlens installs on Windows. This is {platform}, so there is nothing to find.',
      'Worldlens only has a Windows installer, and this is {platform} — so there is genuinely nothing to find, not a detection that failed.',
      'Worldlens only has a Windows installer, and this is {platform} — so there is genuinely nothing to find, not a detection that failed.'
    ],
    yue: [
      'Worldlens 出嘅係 Windows 安裝程式。呢部係 {platform}，所以根本冇已安裝嘅副本可以偵測。',
      'Worldlens 出嘅係 Windows 安裝程式。呢部係 {platform}，所以根本冇已安裝嘅副本可以偵測。',
      'Worldlens 淨係喺 Windows 裝到。呢部係 {platform}，冇嘢好搵。',
      'Worldlens 得 Windows 安裝程式，而呢部係 {platform} —— 即係真係冇嘢搵，唔係偵測失敗。',
      'Worldlens 得 Windows 安裝程式，而呢部係 {platform} —— 即係真係冇嘢搵，唔係偵測失敗。'
    ]
  },
  'worldlens.desktop.unreadable': {
    en: [
      'The search for an installed Worldlens could not be completed: {error}',
      'The search for an installed Worldlens could not be completed: {error}',
      'The search could not finish: {error}',
      'The search fell over before it could answer: {error}',
      'The search fell over before it could answer: {error}'
    ],
    yue: [
      '搵已安裝 Worldlens 嗰陣做唔完：{error}',
      '搵已安裝 Worldlens 嗰陣做唔完：{error}',
      '搵唔完：{error}',
      '仲未答到就跌低咗：{error}',
      '仲未答到就跌低咗：{error}'
    ]
  },
  'worldlens.desktop.invalid': {
    en: [
      'That path cannot be used: {error}',
      'That path cannot be used: {error}',
      'That path will not do: {error}',
      'That path will not do: {error}',
      'That path will not do: {error}'
    ],
    yue: [
      '嗰個路徑用唔到：{error}',
      '嗰個路徑用唔到：{error}',
      '嗰個路徑唔得：{error}',
      '嗰個路徑唔得：{error}',
      '嗰個路徑唔得：{error}'
    ]
  },

  /* ---------------- renderer states ---------------- */

  'worldlens.renderer.unconfigured': {
    en: [
      'No headless renderer is set. Choose the Worldlens command-line renderer to render a world here.',
      'No headless renderer is set. Choose the Worldlens command-line renderer to render a world here.',
      'No renderer chosen yet. Point this at the Worldlens command-line renderer to render here.',
      'No renderer chosen yet. Point this at the Worldlens command-line renderer and this tab can do the drawing itself.',
      'No renderer chosen yet. Point this at the Worldlens command-line renderer and this tab can do the drawing itself.'
    ],
    yue: [
      '未設定無介面渲染器。揀 Worldlens 嘅命令列渲染器，先可以喺呢度渲染世界。',
      '未設定無介面渲染器。揀 Worldlens 嘅命令列渲染器，先可以喺呢度渲染世界。',
      '仲未揀渲染器。指去 Worldlens 嘅命令列渲染器，就可以喺呢度渲染。',
      '仲未揀渲染器。指去 Worldlens 嘅命令列渲染器，呢版就可以自己畫。',
      '仲未揀渲染器。指去 Worldlens 嘅命令列渲染器，呢版就可以自己畫。'
    ]
  },
  'worldlens.renderer.ready': {
    en: [
      'Ready: {path}, started with {command}. Reported version: {version}',
      'Ready: {path}, started with {command}. Reported version: {version}',
      'Ready: {path}, run through {command}. It reports version {version}.',
      'All set: {path}, run through {command}, and it says it is version {version}.',
      'All set: {path}, run through {command}, and it says it is version {version}.'
    ],
    yue: [
      '準備好：{path}，用 {command} 起動。佢報嘅版本：{version}',
      '準備好：{path}，用 {command} 起動。佢報嘅版本：{version}',
      '準備好：{path}，經 {command} 行。佢話自己係 {version}。',
      '搞掂：{path}，經 {command} 行，佢自認係 {version}。',
      '搞掂：{path}，經 {command} 行，佢自認係 {version}。'
    ]
  },
  'worldlens.renderer.readyNoVersion': {
    en: [
      'Ready: {path}, started with {command}. Its version is unknown: {note}',
      'Ready: {path}, started with {command}. Its version is unknown: {note}',
      'Ready: {path}, run through {command}. The version is unknown: {note}',
      'Ready: {path}, run through {command}. It would not say which version it is: {note}',
      'Ready: {path}, run through {command}. It would not say which version it is: {note}'
    ],
    yue: [
      '準備好：{path}，用 {command} 起動。版本不明：{note}',
      '準備好：{path}，用 {command} 起動。版本不明：{note}',
      '準備好：{path}，經 {command} 行。版本不明：{note}',
      '準備好：{path}，經 {command} 行。佢唔肯講自己係邊個版本：{note}',
      '準備好：{path}，經 {command} 行。佢唔肯講自己係邊個版本：{note}'
    ]
  },
  'worldlens.renderer.unrecognized': {
    en: [
      '{path} is neither a .jar nor a JavaScript entry point, so there is no way to start it.',
      '{path} is neither a .jar nor a JavaScript entry point, so there is no way to start it.',
      '{path} is not a .jar and not a JavaScript entry point, so nothing here knows how to start it.',
      '{path} is neither a .jar nor a JavaScript entry point, so nothing here knows how to start it. Choose the command-line renderer jar, or its dist/index.js.',
      '{path} is neither a .jar nor a JavaScript entry point, so nothing here knows how to start it. Choose the command-line renderer jar, or its dist/index.js.'
    ],
    yue: [
      '{path} 唔係 .jar 又唔係 JavaScript 入口，所以起動唔到。',
      '{path} 唔係 .jar 又唔係 JavaScript 入口，所以起動唔到。',
      '{path} 唔係 .jar 又唔係 JavaScript 入口，冇人知點起動佢。',
      '{path} 唔係 .jar 又唔係 JavaScript 入口，冇人知點起動佢。揀命令列渲染器嘅 jar，或者佢個 dist/index.js。',
      '{path} 唔係 .jar 又唔係 JavaScript 入口，冇人知點起動佢。揀命令列渲染器嘅 jar，或者佢個 dist/index.js。'
    ]
  },

  /* ---------------- worlds list ---------------- */

  'worldlens.search.worlds': {
    en: [
      'Search worlds',
      'Search worlds',
      'Search the worlds',
      'Type, and watch the world list thin out',
      'Type, and watch the world list thin out'
    ],
    yue: ['搵世界', '搵世界', '喺啲世界度搵', '打字，睇住個世界清單縮水', '打字，睇住個世界清單縮水']
  },
  'worldlens.worlds.unconfigured': {
    en: [
      'No worlds folder is set.',
      'No worlds folder is set.',
      'No worlds folder chosen yet.',
      'No worlds folder chosen yet — nothing to list until there is one.',
      'No worlds folder chosen yet — nothing to list until there is one.'
    ],
    yue: [
      '未設定世界資料夾。',
      '未設定世界資料夾。',
      '仲未揀世界資料夾。',
      '仲未揀世界資料夾 —— 冇得列，直到揀咗為止。',
      '仲未揀世界資料夾 —— 冇得列，直到揀咗為止。'
    ]
  },
  'worldlens.worlds.unconfiguredBody': {
    en: [
      'Choose the folder your downloads are written to. A folder holding a level.dat is itself a world, and so is any folder of them.',
      'Choose the folder your downloads are written to. A folder holding a level.dat is itself a world, and so is any folder of them.',
      'Choose where your downloads land. A folder with a level.dat in it is a world; a folder of those works too.',
      'Choose where your downloads land. Anything with a level.dat in it counts as a world, and a folder full of them counts as several.',
      'Choose where your downloads land. Anything with a level.dat in it counts as a world, and a folder full of them counts as several.'
    ],
    yue: [
      '揀你啲下載寫去邊個資料夾。入面有 level.dat 嘅資料夾本身就係一個世界，一個裝住佢哋嘅資料夾亦得。',
      '揀你啲下載寫去邊個資料夾。入面有 level.dat 嘅資料夾本身就係一個世界，一個裝住佢哋嘅資料夾亦得。',
      '揀你啲下載落喺邊。有 level.dat 就算一個世界；裝住一堆嘅資料夾都得。',
      '揀你啲下載落喺邊。有 level.dat 就算一個世界，裝住一堆就算幾個。',
      '揀你啲下載落喺邊。有 level.dat 就算一個世界，裝住一堆就算幾個。'
    ]
  },
  'worldlens.worlds.missing': {
    en: [
      '{directory} does not exist.',
      '{directory} does not exist.',
      '{directory} is not there.',
      '{directory} is not there — it may have been moved or renamed since it was chosen.',
      '{directory} is not there — it may have been moved or renamed since it was chosen.'
    ],
    yue: [
      '{directory} 唔存在。',
      '{directory} 唔存在。',
      '{directory} 唔喺度。',
      '{directory} 唔喺度 —— 可能揀咗之後畀人搬走或者改咗名。',
      '{directory} 唔喺度 —— 可能揀咗之後畀人搬走或者改咗名。'
    ]
  },
  'worldlens.worlds.empty': {
    en: [
      'No worlds in {directory}.',
      'No worlds in {directory}.',
      'Nothing that looks like a world in {directory}.',
      'Nothing world-shaped in {directory}.',
      'Nothing world-shaped in {directory}.'
    ],
    yue: [
      '{directory} 入面冇世界。',
      '{directory} 入面冇世界。',
      '{directory} 入面冇乜似世界嘅嘢。',
      '{directory} 入面冇一件似世界嘅嘢。',
      '{directory} 入面冇一件似世界嘅嘢。'
    ]
  },
  'worldlens.worlds.emptyBody': {
    en: [
      '{inspected} folders were inspected and none held a level.dat. Download a world first, or point this at a different folder.',
      '{inspected} folders were inspected and none held a level.dat. Download a world first, or point this at a different folder.',
      '{inspected} folders were checked; not one had a level.dat. Download a world, or choose another folder.',
      '{inspected} folders were opened and not one had a level.dat in it. Download a world first, or point this somewhere else.',
      '{inspected} folders were opened and not one had a level.dat in it. Download a world first, or point this somewhere else.'
    ],
    yue: [
      '睇過 {inspected} 個資料夾，冇一個有 level.dat。先下載個世界，或者指去第個資料夾。',
      '睇過 {inspected} 個資料夾，冇一個有 level.dat。先下載個世界，或者指去第個資料夾。',
      '睇過 {inspected} 個資料夾，一個 level.dat 都冇。下載個世界啦，或者揀第個資料夾。',
      '揭過 {inspected} 個資料夾，一個 level.dat 都冇。先下載個世界，或者指去第度。',
      '揭過 {inspected} 個資料夾，一個 level.dat 都冇。先下載個世界，或者指去第度。'
    ]
  },
  'worldlens.worlds.unreadable': {
    en: [
      '{directory} could not be read: {error}',
      '{directory} could not be read: {error}',
      'Could not read {directory}: {error}',
      'Could not get into {directory} at all: {error}',
      'Could not get into {directory} at all: {error}'
    ],
    yue: [
      '讀唔到 {directory}：{error}',
      '讀唔到 {directory}：{error}',
      '讀唔到 {directory}：{error}',
      '入都入唔到 {directory}：{error}',
      '入都入唔到 {directory}：{error}'
    ]
  },
  'worldlens.worlds.skipped': {
    en: [
      '{skipped} folders were skipped because they hold no level.dat.',
      '{skipped} folders were skipped because they hold no level.dat.',
      '{skipped} folders were skipped: no level.dat in them.',
      '{skipped} folders were left alone — no level.dat, so not worlds.',
      '{skipped} folders were left alone — no level.dat, so not worlds.'
    ],
    yue: [
      '有 {skipped} 個資料夾冇 level.dat，跳過咗。',
      '有 {skipped} 個資料夾冇 level.dat，跳過咗。',
      '{skipped} 個資料夾跳過咗：入面冇 level.dat。',
      '{skipped} 個資料夾冇郁佢 —— 冇 level.dat，唔算世界。',
      '{skipped} 個資料夾冇郁佢 —— 冇 level.dat，唔算世界。'
    ]
  },

  /* ---------------- columns and world facts ---------------- */

  'worldlens.column.name': {
    en: ['World', 'World', 'World', 'World', 'World'],
    yue: ['世界', '世界', '世界', '世界', '世界']
  },
  'worldlens.column.version': {
    en: ['Version', 'Version', 'Version', 'Version', 'Version'],
    yue: ['版本', '版本', '版本', '版本', '版本']
  },
  'worldlens.column.support': {
    en: ['Renderer support', 'Renderer support', 'Renderer support', 'Renderer support', 'Renderer support'],
    yue: ['渲染器支援', '渲染器支援', '渲染器支援', '渲染器支援', '渲染器支援']
  },
  'worldlens.column.dimensions': {
    en: ['Dimensions', 'Dimensions', 'Dimensions', 'Dimensions', 'Dimensions'],
    yue: ['維度', '維度', '維度', '維度', '維度']
  },
  'worldlens.column.regions': {
    en: ['Region files', 'Region files', 'Region files', 'Region files', 'Region files'],
    yue: ['區域檔案', '區域檔案', '區域檔案', '區域檔案', '區域檔案']
  },
  'worldlens.column.actions': {
    en: ['Actions', 'Actions', 'Actions', 'Actions', 'Actions'],
    yue: ['操作', '操作', '操作', '操作', '操作']
  },
  'worldlens.support.supported': {
    en: [
      'Supported',
      'Supported',
      'Supported',
      'Supported',
      'Supported'
    ],
    yue: ['支援', '支援', '支援', '支援', '支援']
  },
  'worldlens.support.tooOld': {
    en: [
      'Older than {range}',
      'Older than {range}',
      'Older than {range}',
      'Older than {range}',
      'Older than {range}'
    ],
    yue: [
      '早過 {range}',
      '早過 {range}',
      '早過 {range}',
      '早過 {range}',
      '早過 {range}'
    ]
  },
  'worldlens.support.tooNew': {
    en: [
      'Newer than {range}',
      'Newer than {range}',
      'Newer than {range}',
      'Newer than {range}',
      'Newer than {range}'
    ],
    yue: ['遲過 {range}', '遲過 {range}', '遲過 {range}', '遲過 {range}', '遲過 {range}']
  },
  'worldlens.support.unknown': {
    en: ['Unknown', 'Unknown', 'Unknown', 'Unknown', 'Unknown'],
    yue: ['未知', '未知', '未知', '未知', '未知']
  },
  'worldlens.support.explainOld': {
    en: [
      '{world} records Minecraft {version}. Worldlens states it reads {range}, so this world is older than the renderer claims to handle. It can still be opened in the desktop application, which will say what it makes of it.',
      '{world} records Minecraft {version}. Worldlens states it reads {range}, so this world is older than the renderer claims to handle. It can still be opened in the desktop application, which will say what it makes of it.',
      '{world} says it is Minecraft {version}. Worldlens reads {range}, so this one is older than it claims to handle. The desktop application will still open it and tell you what it thinks.',
      '{world} says it is Minecraft {version}, and Worldlens claims {range}. That is older than the renderer promises, so a render may fail. Opening it in the desktop application is still allowed, and it will say what it makes of it.',
      '{world} says it is Minecraft {version}, and Worldlens claims {range}. That is older than the renderer promises, so a render may fail. Opening it in the desktop application is still allowed, and it will say what it makes of it.'
    ],
    yue: [
      '{world} 記住嘅係 Minecraft {version}。Worldlens 話佢讀 {range}，所以呢個世界舊過佢聲稱處理到嘅範圍。你仍然可以喺桌面應用程式打開佢，佢會話你知點睇。',
      '{world} 記住嘅係 Minecraft {version}。Worldlens 話佢讀 {range}，所以呢個世界舊過佢聲稱處理到嘅範圍。你仍然可以喺桌面應用程式打開佢，佢會話你知點睇。',
      '{world} 話自己係 Minecraft {version}。Worldlens 讀 {range}，呢個舊過佢聲稱嘅範圍。桌面應用程式照樣打開到，佢會話你知點睇。',
      '{world} 話自己係 Minecraft {version}，而 Worldlens 聲稱 {range}。舊過佢應承嘅範圍，所以渲染可能會失敗。仍然可以喺桌面應用程式打開，佢會話你知點睇。',
      '{world} 話自己係 Minecraft {version}，而 Worldlens 聲稱 {range}。舊過佢應承嘅範圍，所以渲染可能會失敗。仍然可以喺桌面應用程式打開，佢會話你知點睇。'
    ]
  },
  'worldlens.support.explainNew': {
    en: [
      '{world} records Minecraft {version}. Worldlens states it reads {range}, so this world is newer than the renderer claims to handle. Update Worldlens, or open it there anyway and see what it says.',
      '{world} records Minecraft {version}. Worldlens states it reads {range}, so this world is newer than the renderer claims to handle. Update Worldlens, or open it there anyway and see what it says.',
      '{world} says it is Minecraft {version}. Worldlens reads {range}, so this one is newer than it claims to handle. Update Worldlens, or open it there anyway.',
      '{world} says it is Minecraft {version}, and Worldlens claims {range}. The world is ahead of the renderer, so a render may fail. Update Worldlens, or open it there anyway and see what it says.',
      '{world} says it is Minecraft {version}, and Worldlens claims {range}. The world is ahead of the renderer, so a render may fail. Update Worldlens, or open it there anyway and see what it says.'
    ],
    yue: [
      '{world} 記住嘅係 Minecraft {version}。Worldlens 話佢讀 {range}，所以呢個世界新過佢聲稱處理到嘅範圍。更新 Worldlens，或者照樣打開嚟睇下佢點講。',
      '{world} 記住嘅係 Minecraft {version}。Worldlens 話佢讀 {range}，所以呢個世界新過佢聲稱處理到嘅範圍。更新 Worldlens，或者照樣打開嚟睇下佢點講。',
      '{world} 話自己係 Minecraft {version}。Worldlens 讀 {range}，呢個新過佢聲稱嘅範圍。更新 Worldlens，或者照樣打開佢。',
      '{world} 話自己係 Minecraft {version}，而 Worldlens 聲稱 {range}。個世界行先過渲染器，所以渲染可能會失敗。更新 Worldlens，或者照樣打開嚟睇下佢點講。',
      '{world} 話自己係 Minecraft {version}，而 Worldlens 聲稱 {range}。個世界行先過渲染器，所以渲染可能會失敗。更新 Worldlens，或者照樣打開嚟睇下佢點講。'
    ]
  },
  'worldlens.support.explainUnknown': {
    en: [
      '{world}: {reason} It has not been ruled out, and it has not been confirmed either.',
      '{world}: {reason} It has not been ruled out, and it has not been confirmed either.',
      '{world}: {reason} Not ruled out, not confirmed.',
      '{world}: {reason} So it is neither ruled out nor confirmed — the render is the thing that will tell you.',
      '{world}: {reason} So it is neither ruled out nor confirmed — the render is the thing that will tell you.'
    ],
    yue: [
      '{world}：{reason} 冇排除到，亦都未確認到。',
      '{world}：{reason} 冇排除到，亦都未確認到。',
      '{world}：{reason} 未排除，未確認。',
      '{world}：{reason} 即係唔排除又唔確認 —— 要渲染先答到你。',
      '{world}：{reason} 即係唔排除又唔確認 —— 要渲染先答到你。'
    ]
  },
  'worldlens.world.readError': {
    en: [
      'level.dat could not be read: {error}',
      'level.dat could not be read: {error}',
      'level.dat would not read: {error}',
      'level.dat would not read: {error}',
      'level.dat would not read: {error}'
    ],
    yue: [
      '讀唔到 level.dat：{error}',
      '讀唔到 level.dat：{error}',
      'level.dat 讀唔到：{error}',
      'level.dat 讀唔到：{error}',
      'level.dat 讀唔到：{error}'
    ]
  },

  /* ---------------- actions ---------------- */

  'worldlens.action.detect': {
    en: ['Detect Worldlens', 'Detect Worldlens', 'Look for Worldlens', 'Go and look for Worldlens', 'Go and look for Worldlens'],
    yue: ['偵測 Worldlens', '偵測 Worldlens', '搵下 Worldlens', '去搵下 Worldlens', '去搵下 Worldlens']
  },
  'worldlens.action.getWorldlens': {
    en: [
      'Get Worldlens',
      'Get Worldlens',
      'Get Worldlens',
      'Go and get Worldlens',
      'Go and get Worldlens'
    ],
    yue: ['攞 Worldlens', '攞 Worldlens', '攞 Worldlens', '去攞返個 Worldlens', '去攞返個 Worldlens']
  },
  'worldlens.action.openWorld': {
    en: [
      'Open this world in Worldlens',
      'Open this world in Worldlens',
      'Open this world in Worldlens',
      'Send this world over to Worldlens',
      'Send this world over to Worldlens'
    ],
    yue: [
      '喺 Worldlens 打開呢個世界',
      '喺 Worldlens 打開呢個世界',
      '喺 Worldlens 打開呢個世界',
      '將呢個世界遞去 Worldlens',
      '將呢個世界遞去 Worldlens'
    ]
  },
  'worldlens.action.renderAndServe': {
    en: [
      'Render and serve',
      'Render and serve',
      'Render it and serve it',
      'Render it and serve it up',
      'Render it and serve it up'
    ],
    yue: ['渲染同放送', '渲染同放送', '畫完再放送', '畫完就端上枱', '畫完就端上枱']
  },
  'worldlens.action.stop': {
    en: ['Stop the renderer', 'Stop the renderer', 'Stop the renderer', 'Pull the plug on the renderer', 'Pull the plug on the renderer'],
    yue: ['停止渲染器', '停止渲染器', '停咗個渲染器', '扯咗個渲染器條線', '扯咗個渲染器條線']
  },
  'worldlens.action.openMap': {
    en: [
      'Open the map in the browser',
      'Open the map in the browser',
      'Open the map in the browser',
      'Open the map in the browser and have a look',
      'Open the map in the browser and have a look'
    ],
    yue: [
      '喺瀏覽器打開地圖',
      '喺瀏覽器打開地圖',
      '喺瀏覽器打開地圖',
      '喺瀏覽器打開地圖睇下',
      '喺瀏覽器打開地圖睇下'
    ]
  },
  'worldlens.action.reveal': {
    en: [
      'Show the world folder',
      'Show the world folder',
      'Show the world folder',
      'Show me where the world folder is',
      'Show me where the world folder is'
    ],
    yue: [
      '顯示世界資料夾',
      '顯示世界資料夾',
      '顯示世界資料夾',
      '指畀我睇個世界資料夾喺邊',
      '指畀我睇個世界資料夾喺邊'
    ]
  },
  'worldlens.action.copyPath': {
    en: ['Copy the world path', 'Copy the world path', 'Copy the world path', 'Copy the world path', 'Copy the world path'],
    yue: ['複製世界路徑', '複製世界路徑', '複製世界路徑', '複製世界路徑', '複製世界路徑']
  },
  'worldlens.action.rowMenu': {
    en: [
      'Actions for this world',
      'Actions for this world',
      'Actions for this world',
      'Actions for this world',
      'Actions for this world'
    ],
    yue: ['呢個世界嘅操作', '呢個世界嘅操作', '呢個世界嘅操作', '呢個世界嘅操作', '呢個世界嘅操作']
  },
  'worldlens.action.rescan': {
    en: ['Rescan worlds', 'Rescan worlds', 'Scan the worlds again', 'Go round the worlds folder again', 'Go round the worlds folder again'],
    yue: ['重新掃描世界', '重新掃描世界', '再掃一次啲世界', '再行多次個世界資料夾', '再行多次個世界資料夾']
  },
  'worldlens.action.export': {
    en: ['Export the world list', 'Export the world list', 'Export the world list', 'Export the world list', 'Export the world list'],
    yue: ['匯出世界清單', '匯出世界清單', '匯出世界清單', '匯出世界清單', '匯出世界清單']
  },
  'worldlens.action.selectAllShown': {
    en: [
      'Select the {count} worlds shown',
      'Select the {count} worlds shown',
      'Select the {count} worlds shown',
      'Select the {count} worlds shown',
      'Select the {count} worlds shown'
    ],
    yue: [
      '揀晒顯示緊嘅 {count} 個世界',
      '揀晒顯示緊嘅 {count} 個世界',
      '揀晒顯示緊嘅 {count} 個世界',
      '揀晒顯示緊嘅 {count} 個世界',
      '揀晒顯示緊嘅 {count} 個世界'
    ]
  },
  'worldlens.action.selectAllFound': {
    en: [
      'Select all {count} worlds found',
      'Select all {count} worlds found',
      'Select all {count} worlds found',
      'Select all {count} worlds found',
      'Select all {count} worlds found'
    ],
    yue: [
      '揀晒搵到嘅全部 {count} 個世界',
      '揀晒搵到嘅全部 {count} 個世界',
      '揀晒搵到嘅全部 {count} 個世界',
      '揀晒搵到嘅全部 {count} 個世界',
      '揀晒搵到嘅全部 {count} 個世界'
    ]
  },
  'worldlens.action.invertSelection': {
    en: ['Invert the selection', 'Invert the selection', 'Invert the selection', 'Flip the selection', 'Flip the selection'],
    yue: ['反轉選取', '反轉選取', '反轉選取', '反轉個選取', '反轉個選取']
  },
  'worldlens.action.clearSelection': {
    en: ['Clear the selection', 'Clear the selection', 'Clear the selection', 'Clear the selection', 'Clear the selection'],
    yue: ['清除選取', '清除選取', '清除選取', '清除選取', '清除選取']
  },
  'worldlens.action.clearOutput': {
    en: [
      'Delete the render output',
      'Delete the render output',
      'Delete the render output',
      'Delete the render output',
      'Delete the render output'
    ],
    yue: ['刪除渲染輸出', '刪除渲染輸出', '刪除渲染輸出', '刪除渲染輸出', '刪除渲染輸出']
  },

  /* ---------------- handoff ---------------- */

  'worldlens.handoff.title': {
    en: [
      'Worldlens is opening',
      'Worldlens is opening',
      'Worldlens is opening',
      'Worldlens is on its way up',
      'Worldlens is on its way up'
    ],
    yue: ['Worldlens 開緊', 'Worldlens 開緊', 'Worldlens 開緊', 'Worldlens 上緊嚟', 'Worldlens 上緊嚟']
  },
  'worldlens.handoff.body': {
    en: [
      'Worldlens takes no world path on its command line and registers no link scheme, so it opens on its own start screen rather than on this world. The path has been copied to the clipboard: paste it into Worldlens’s own world picker. The world is {world}, at {path}.',
      'Worldlens takes no world path on its command line and registers no link scheme, so it opens on its own start screen rather than on this world. The path has been copied to the clipboard: paste it into Worldlens’s own world picker. The world is {world}, at {path}.',
      'Worldlens accepts no world path on its command line and registers no link scheme, so it opens on its own start screen. The path is on the clipboard — paste it into Worldlens’s world picker. The world is {world}, at {path}.',
      'Worldlens will not be told which world to open: it takes no path on its command line and registers no link scheme, so it opens wherever it likes. The path is on your clipboard — paste it into its own world picker. The world is {world}, at {path}.',
      'Worldlens will not be told which world to open: it takes no path on its command line and registers no link scheme, so it opens wherever it likes. The path is on your clipboard — paste it into its own world picker. The world is {world}, at {path}.'
    ],
    yue: [
      'Worldlens 喺命令列唔收世界路徑，亦冇登記連結協定，所以佢會開喺自己嘅起始畫面，唔會直接開呢個世界。路徑已經複製咗去剪貼簿：喺 Worldlens 自己嘅世界選擇器貼上就得。世界係 {world}，喺 {path}。',
      'Worldlens 喺命令列唔收世界路徑，亦冇登記連結協定，所以佢會開喺自己嘅起始畫面，唔會直接開呢個世界。路徑已經複製咗去剪貼簿：喺 Worldlens 自己嘅世界選擇器貼上就得。世界係 {world}，喺 {path}。',
      'Worldlens 命令列唔收世界路徑，亦冇登記連結協定，所以會開喺佢自己嘅起始畫面。路徑喺剪貼簿度 —— 貼入佢個世界選擇器。世界係 {world}，喺 {path}。',
      'Worldlens 唔畀你話佢知開邊個世界：命令列唔收路徑，又冇登記連結協定，所以佢鍾意開邊度就邊度。路徑已經喺你剪貼簿 —— 貼入佢自己個世界選擇器。世界係 {world}，喺 {path}。',
      'Worldlens 唔畀你話佢知開邊個世界：命令列唔收路徑，又冇登記連結協定，所以佢鍾意開邊度就邊度。路徑已經喺你剪貼簿 —— 貼入佢自己個世界選擇器。世界係 {world}，喺 {path}。'
    ]
  },
  'worldlens.handoff.failed': {
    en: [
      'Worldlens could not be started from {path}: {error}',
      'Worldlens could not be started from {path}: {error}',
      'Worldlens would not start from {path}: {error}',
      'Worldlens would not start from {path}: {error}',
      'Worldlens would not start from {path}: {error}'
    ],
    yue: [
      '由 {path} 起動唔到 Worldlens：{error}',
      '由 {path} 起動唔到 Worldlens：{error}',
      '由 {path} 起動唔到 Worldlens：{error}',
      '由 {path} 起動唔到 Worldlens：{error}',
      '由 {path} 起動唔到 Worldlens：{error}'
    ]
  },
  'worldlens.handoff.notInstalled': {
    en: [
      'Worldlens is not installed, so there is nothing to hand this world to. Install it from its releases page first.',
      'Worldlens is not installed, so there is nothing to hand this world to. Install it from its releases page first.',
      'Worldlens is not installed, so there is nobody to hand this world to. Install it from its releases page.',
      'Worldlens is not installed, so there is nobody on the other end to hand this world to. Install it from its releases page and try again.',
      'Worldlens is not installed, so there is nobody on the other end to hand this world to. Install it from its releases page and try again.'
    ],
    yue: [
      'Worldlens 未安裝，所以冇對象接呢個世界。先去佢個發佈頁裝返佢。',
      'Worldlens 未安裝，所以冇對象接呢個世界。先去佢個發佈頁裝返佢。',
      'Worldlens 未安裝，冇人接呢個世界。去佢個發佈頁裝返佢。',
      'Worldlens 未安裝，對面根本冇人接呢個世界。去佢個發佈頁裝返佢再試過。',
      'Worldlens 未安裝，對面根本冇人接呢個世界。去佢個發佈頁裝返佢再試過。'
    ]
  },

  /* ---------------- render run ---------------- */

  'worldlens.run.progress': {
    en: ['Render progress', 'Render progress', 'Render progress', 'Render progress', 'Render progress'],
    yue: ['渲染進度', '渲染進度', '渲染進度', '渲染進度', '渲染進度']
  },
  'worldlens.run.log': {
    en: [
      'Renderer output',
      'Renderer output',
      'Renderer output',
      'What the renderer is saying',
      'What the renderer is saying'
    ],
    yue: ['渲染器輸出', '渲染器輸出', '渲染器輸出', '渲染器講緊乜', '渲染器講緊乜']
  },
  'worldlens.run.idle': {
    en: [
      'Nothing is rendering.',
      'Nothing is rendering.',
      'Nothing is rendering.',
      'Nothing is rendering. The renderer is sitting quietly.',
      'Nothing is rendering. The renderer is sitting quietly.'
    ],
    yue: ['冇嘢渲染緊。', '冇嘢渲染緊。', '冇嘢渲染緊。', '冇嘢渲染緊，個渲染器靜靜哋坐緊。', '冇嘢渲染緊，個渲染器靜靜哋坐緊。']
  },
  'worldlens.run.preparing': {
    en: [
      'Writing the configuration for {world}.',
      'Writing the configuration for {world}.',
      'Writing the configuration for {world}.',
      'Writing the configuration for {world}.',
      'Writing the configuration for {world}.'
    ],
    yue: [
      '寫緊 {world} 嘅設定。',
      '寫緊 {world} 嘅設定。',
      '寫緊 {world} 嘅設定。',
      '寫緊 {world} 嘅設定。',
      '寫緊 {world} 嘅設定。'
    ]
  },
  'worldlens.run.starting': {
    en: ['Starting the renderer.', 'Starting the renderer.', 'Starting the renderer.', 'Starting the renderer.', 'Starting the renderer.'],
    yue: ['起動緊個渲染器。', '起動緊個渲染器。', '起動緊個渲染器。', '起動緊個渲染器。', '起動緊個渲染器。']
  },
  'worldlens.run.rendering': {
    en: ['{task}', '{task}', '{task}', '{task}', '{task}'],
    yue: ['{task}', '{task}', '{task}', '{task}', '{task}']
  },
  'worldlens.run.noPercentYet': {
    en: [
      'The renderer has not reported a percentage yet.',
      'The renderer has not reported a percentage yet.',
      'No percentage from the renderer yet.',
      'No percentage out of the renderer yet — it is still getting its bearings.',
      'No percentage out of the renderer yet — it is still getting its bearings.'
    ],
    yue: [
      '渲染器仲未報過百分比。',
      '渲染器仲未報過百分比。',
      '渲染器未有百分比。',
      '渲染器未吐過百分比出嚟 —— 佢仲搵緊方向。',
      '渲染器未吐過百分比出嚟 —— 佢仲搵緊方向。'
    ]
  },
  'worldlens.run.serving': {
    en: [
      'Serving {world} on {url}. This address is loopback: it is reachable from this computer only.',
      'Serving {world} on {url}. This address is loopback: it is reachable from this computer only.',
      'Serving {world} on {url}. Loopback only — this computer and nowhere else.',
      'Serving {world} on {url}. That is a loopback address: this computer and nowhere else can reach it.',
      'Serving {world} on {url}. That is a loopback address: this computer and nowhere else can reach it.'
    ],
    yue: [
      '喺 {url} 放送緊 {world}。呢個係 loopback 位址：淨係呢部電腦連得到。',
      '喺 {url} 放送緊 {world}。呢個係 loopback 位址：淨係呢部電腦連得到。',
      '喺 {url} 放送緊 {world}。淨係 loopback —— 得呢部電腦，第度連唔到。',
      '喺 {url} 放送緊 {world}。呢個係 loopback 位址：得呢部電腦連得到，第度一律連唔到。',
      '喺 {url} 放送緊 {world}。呢個係 loopback 位址：得呢部電腦連得到，第度一律連唔到。'
    ]
  },
  'worldlens.run.watching': {
    en: [
      'Serving {world} on {url} and watching the world for changes. The address is loopback: this computer only.',
      'Serving {world} on {url} and watching the world for changes. The address is loopback: this computer only.',
      'Serving {world} on {url} and watching for changes. Loopback only — this computer.',
      'Serving {world} on {url}, and keeping an eye on the world for changes. Loopback address: this computer and nowhere else.',
      'Serving {world} on {url}, and keeping an eye on the world for changes. Loopback address: this computer and nowhere else.'
    ],
    yue: [
      '喺 {url} 放送緊 {world}，同時睇住個世界有冇改動。位址係 loopback：淨係呢部電腦。',
      '喺 {url} 放送緊 {world}，同時睇住個世界有冇改動。位址係 loopback：淨係呢部電腦。',
      '喺 {url} 放送緊 {world}，一路睇住有冇改動。淨係 loopback —— 呢部電腦。',
      '喺 {url} 放送緊 {world}，仲一路睥住個世界有冇郁過。Loopback 位址：得呢部電腦，第度冇份。',
      '喺 {url} 放送緊 {world}，仲一路睥住個世界有冇郁過。Loopback 位址：得呢部電腦，第度冇份。'
    ]
  },
  'worldlens.run.stopping': {
    en: ['Stopping the renderer.', 'Stopping the renderer.', 'Stopping the renderer.', 'Stopping the renderer.', 'Stopping the renderer.'],
    yue: ['停緊個渲染器。', '停緊個渲染器。', '停緊個渲染器。', '停緊個渲染器。', '停緊個渲染器。']
  },
  'worldlens.run.finished': {
    en: [
      'The renderer finished and stopped. The output is in {output}.',
      'The renderer finished and stopped. The output is in {output}.',
      'The renderer finished and stopped. Output is in {output}.',
      'The renderer got to the end and stopped. Its output is sitting in {output}.',
      'The renderer got to the end and stopped. Its output is sitting in {output}.'
    ],
    yue: [
      '渲染器做完，停咗。輸出喺 {output}。',
      '渲染器做完，停咗。輸出喺 {output}。',
      '渲染器做完，停咗。輸出喺 {output}。',
      '渲染器做到尾就停咗。佢啲輸出擺喺 {output}。',
      '渲染器做到尾就停咗。佢啲輸出擺喺 {output}。'
    ]
  },
  'worldlens.run.cancelled': {
    en: [
      'The render was cancelled. Anything already written stays in {output}.',
      'The render was cancelled. Anything already written stays in {output}.',
      'The render was cancelled. What it had written stays in {output}.',
      'The render was called off. Whatever it had already written stays in {output}.',
      'The render was called off. Whatever it had already written stays in {output}.'
    ],
    yue: [
      '渲染取消咗。已經寫落嘅嘢仍然留喺 {output}。',
      '渲染取消咗。已經寫落嘅嘢仍然留喺 {output}。',
      '渲染取消咗。已經寫咗嘅嘢留喺 {output}。',
      '渲染叫停咗。佢已經寫落嘅嘢照留喺 {output}。',
      '渲染叫停咗。佢已經寫落嘅嘢照留喺 {output}。'
    ]
  },
  'worldlens.run.failed': {
    en: [
      'The render failed: {error}',
      'The render failed: {error}',
      'The render failed: {error}',
      'The render fell over: {error}',
      'The render fell over: {error}'
    ],
    yue: [
      '渲染失敗：{error}',
      '渲染失敗：{error}',
      '渲染失敗：{error}',
      '渲染跌低咗：{error}',
      '渲染跌低咗：{error}'
    ]
  },
  'worldlens.run.busy': {
    en: [
      'A render is already running. Stop it before starting another.',
      'A render is already running. Stop it before starting another.',
      'A render is already running. Stop that one first.',
      'A render is already running. One at a time — stop that one first.',
      'A render is already running. One at a time — stop that one first.'
    ],
    yue: [
      '已經有一個渲染行緊。停咗佢先可以開第二個。',
      '已經有一個渲染行緊。停咗佢先可以開第二個。',
      '已經有渲染行緊。停咗嗰個先。',
      '已經有渲染行緊。一次一個 —— 停咗嗰個先。',
      '已經有渲染行緊。一次一個 —— 停咗嗰個先。'
    ]
  },
  'worldlens.run.noSelection': {
    en: [
      'Select exactly one world to render.',
      'Select exactly one world to render.',
      'Select exactly one world to render.',
      'Pick exactly one world — the renderer takes one at a time.',
      'Pick exactly one world — the renderer takes one at a time.'
    ],
    yue: [
      '揀啱一個世界嚟渲染。',
      '揀啱一個世界嚟渲染。',
      '揀啱一個世界嚟渲染。',
      '揀返一個世界就得 —— 渲染器一次得一個。',
      '揀返一個世界就得 —— 渲染器一次得一個。'
    ]
  },
  'worldlens.run.noRenderer': {
    en: [
      'No headless renderer is set, so nothing can be rendered here. Open Worldlens instead, or set the renderer in settings.',
      'No headless renderer is set, so nothing can be rendered here. Open Worldlens instead, or set the renderer in settings.',
      'No renderer is set, so nothing renders here. Open Worldlens, or set the renderer in settings.',
      'No renderer is set, so nothing renders in this tab. Open Worldlens instead, or set the renderer in settings and come back.',
      'No renderer is set, so nothing renders in this tab. Open Worldlens instead, or set the renderer in settings and come back.'
    ],
    yue: [
      '未設定無介面渲染器，所以呢度渲染唔到。用返 Worldlens 打開，或者去設定度揀個渲染器。',
      '未設定無介面渲染器，所以呢度渲染唔到。用返 Worldlens 打開，或者去設定度揀個渲染器。',
      '未設定渲染器，呢度渲染唔到。開 Worldlens，或者去設定揀個渲染器。',
      '未設定渲染器，呢版渲染唔到嘢。開返 Worldlens，或者去設定揀好個渲染器再返嚟。',
      '未設定渲染器，呢版渲染唔到嘢。開返 Worldlens，或者去設定揀好個渲染器再返嚟。'
    ]
  },
  'worldlens.run.dimensions': {
    en: [
      'Dimensions to render',
      'Dimensions to render',
      'Dimensions to render',
      'Which dimensions to draw',
      'Which dimensions to draw'
    ],
    yue: ['要渲染嘅維度', '要渲染嘅維度', '要渲染嘅維度', '要畫邊幾個維度', '要畫邊幾個維度']
  },
  'worldlens.run.loopbackNote': {
    en: [
      'The map server is pinned to 127.0.0.1. No other machine can reach it, whatever the renderer’s own default would have been.',
      'The map server is pinned to 127.0.0.1. No other machine can reach it, whatever the renderer’s own default would have been.',
      'The map server is pinned to 127.0.0.1, so no other machine can reach it — whatever the renderer defaults to.',
      'The map server is nailed to 127.0.0.1. The renderer’s own default would have published to every interface on this machine; this never does.',
      'The map server is nailed to 127.0.0.1. The renderer’s own default would have published to every interface on this machine; this never does.'
    ],
    yue: [
      '地圖伺服器釘死喺 127.0.0.1。無論渲染器本身預設係乜，第二部機都連唔到。',
      '地圖伺服器釘死喺 127.0.0.1。無論渲染器本身預設係乜，第二部機都連唔到。',
      '地圖伺服器釘死喺 127.0.0.1，所以第二部機連唔到 —— 唔理渲染器預設係乜。',
      '地圖伺服器釘死喺 127.0.0.1。渲染器自己預設會放上呢部機每個介面；呢度永遠唔會。',
      '地圖伺服器釘死喺 127.0.0.1。渲染器自己預設會放上呢部機每個介面；呢度永遠唔會。'
    ]
  },

  /* ---------------- notifications ---------------- */

  'worldlens.notify.detected': {
    en: [
      'Detection finished',
      'Detection finished',
      'Had a look around',
      'Had a good look around',
      'Had a good look around'
    ],
    yue: ['偵測完成', '偵測完成', '搵咗一轉', '周圍搵咗一轉', '周圍搵咗一轉']
  },
  'worldlens.notify.copied': {
    en: [
      'The world path is on the clipboard.',
      'The world path is on the clipboard.',
      'World path copied.',
      'World path copied — paste away.',
      'World path copied — paste away.'
    ],
    yue: [
      '世界路徑已經喺剪貼簿。',
      '世界路徑已經喺剪貼簿。',
      '世界路徑複製咗。',
      '世界路徑複製咗 —— 隨便貼。',
      '世界路徑複製咗 —— 隨便貼。'
    ]
  },
  'worldlens.notify.copyFailed': {
    en: [
      'The path could not be copied: {error}. It is {path}.',
      'The path could not be copied: {error}. It is {path}.',
      'The path would not copy: {error}. It is {path}.',
      'The clipboard refused it: {error}. The path is {path}.',
      'The clipboard refused it: {error}. The path is {path}.'
    ],
    yue: [
      '複製唔到路徑：{error}。路徑係 {path}。',
      '複製唔到路徑：{error}。路徑係 {path}。',
      '路徑複製唔到：{error}。路徑係 {path}。',
      '剪貼簿唔收：{error}。路徑係 {path}。',
      '剪貼簿唔收：{error}。路徑係 {path}。'
    ]
  },
  'worldlens.notify.exported': {
    en: ['The world list was written to {path}.', 'The world list was written to {path}.', 'World list written to {path}.', 'World list written to {path}.', 'World list written to {path}.'],
    yue: ['世界清單寫咗去 {path}。', '世界清單寫咗去 {path}。', '世界清單寫咗去 {path}。', '世界清單寫咗去 {path}。', '世界清單寫咗去 {path}。']
  },
  'worldlens.notify.exportLoss': {
    en: [
      '{format} cannot carry every field: {fields}. Nothing has been written yet.',
      '{format} cannot carry every field: {fields}. Nothing has been written yet.',
      '{format} cannot carry every field: {fields}. Nothing written yet.',
      '{format} cannot carry all of it: {fields}. Nothing has been written yet — the choice is still yours.',
      '{format} cannot carry all of it: {fields}. Nothing has been written yet — the choice is still yours.'
    ],
    yue: [
      '{format} 載唔起全部欄位：{fields}。仲未寫任何嘢。',
      '{format} 載唔起全部欄位：{fields}。仲未寫任何嘢。',
      '{format} 載唔起全部欄位：{fields}。未寫過嘢。',
      '{format} 載唔起晒：{fields}。乜都未寫 —— 揀唔揀仍然係你話事。',
      '{format} 載唔起晒：{fields}。乜都未寫 —— 揀唔揀仍然係你話事。'
    ]
  },
  'worldlens.notify.outputDeleted': {
    en: [
      'The render output in {path} was deleted.',
      'The render output in {path} was deleted.',
      'The render output in {path} is gone.',
      'The render output in {path} is gone for good.',
      'The render output in {path} is gone for good.'
    ],
    yue: [
      '{path} 入面嘅渲染輸出刪除咗。',
      '{path} 入面嘅渲染輸出刪除咗。',
      '{path} 入面嘅渲染輸出冇咗。',
      '{path} 入面嘅渲染輸出冇晒，永遠。',
      '{path} 入面嘅渲染輸出冇晒，永遠。'
    ]
  },
  'worldlens.notify.outputMissing': {
    en: [
      'There is no render output to delete in {path}.',
      'There is no render output to delete in {path}.',
      'No render output in {path} to delete.',
      'Nothing to delete — {path} holds no render output.',
      'Nothing to delete — {path} holds no render output.'
    ],
    yue: [
      '{path} 度冇渲染輸出可以刪。',
      '{path} 度冇渲染輸出可以刪。',
      '{path} 冇渲染輸出可以刪。',
      '冇嘢好刪 —— {path} 度冇渲染輸出。',
      '冇嘢好刪 —— {path} 度冇渲染輸出。'
    ]
  },

  /* ---------------- settings ---------------- */

  'worldlens.setting.desktopPath': {
    en: [
      'Worldlens executable',
      'Worldlens executable',
      'Worldlens executable',
      'Worldlens executable',
      'Worldlens executable'
    ],
    yue: ['Worldlens 執行檔', 'Worldlens 執行檔', 'Worldlens 執行檔', 'Worldlens 執行檔', 'Worldlens 執行檔']
  },
  'worldlens.setting.desktopPath.description': {
    en: [
      'The Worldlens desktop application this app launches for a handoff. Leave it empty to use whatever detection finds under the local application-data directory, where Squirrel installs it. A path set here is validated exactly as a detected one is.',
      'The Worldlens desktop application this app launches for a handoff. Leave it empty to use whatever detection finds under the local application-data directory, where Squirrel installs it. A path set here is validated exactly as a detected one is.',
      'The Worldlens application launched for a handoff. Empty means detection picks it up from the local application-data directory, where Squirrel installs it. A path set here gets the same checks a detected one does.',
      'Which Worldlens gets launched when a world is handed over. Empty means detection goes looking in the local application-data directory, where Squirrel puts it. Whatever you type here is checked exactly as hard as anything detection finds.',
      'Which Worldlens gets launched when a world is handed over. Empty means detection goes looking in the local application-data directory, where Squirrel puts it. Whatever you type here is checked exactly as hard as anything detection finds.'
    ],
    yue: [
      '交接世界時起動嘅 Worldlens 桌面應用程式。留空就用偵測喺本機應用程式資料目錄搵到嗰個 —— Squirrel 就係裝喺嗰度。喺呢度填嘅路徑，會用同偵測一模一樣嘅方式驗證。',
      '交接世界時起動嘅 Worldlens 桌面應用程式。留空就用偵測喺本機應用程式資料目錄搵到嗰個 —— Squirrel 就係裝喺嗰度。喺呢度填嘅路徑，會用同偵測一模一樣嘅方式驗證。',
      '交接時起動邊個 Worldlens。留空就由偵測喺本機應用程式資料目錄搵，Squirrel 裝喺嗰度。喺呢度填嘅路徑，檢查同偵測到嘅一樣。',
      '遞世界過去嗰陣起動邊個 Worldlens。留空就由偵測去本機應用程式資料目錄搵，Squirrel 就係擺喺嗰度。你打乜落去，都會照樣嚴格檢查。',
      '遞世界過去嗰陣起動邊個 Worldlens。留空就由偵測去本機應用程式資料目錄搵，Squirrel 就係擺喺嗰度。你打乜落去，都會照樣嚴格檢查。'
    ]
  },
  'worldlens.setting.rendererPath': {
    en: [
      'Headless renderer',
      'Headless renderer',
      'Headless renderer',
      'Headless renderer',
      'Headless renderer'
    ],
    yue: ['無介面渲染器', '無介面渲染器', '無介面渲染器', '無介面渲染器', '無介面渲染器']
  },
  'worldlens.setting.rendererPath.description': {
    en: [
      'The command-line renderer driven for the in-app map. Two files work: the command-line renderer jar every Worldlens release attaches, run with java, or the @worldlens/cli entry point dist/index.js, run with node. Empty means this tab cannot render, and says so instead of pretending.',
      'The command-line renderer driven for the in-app map. Two files work: the command-line renderer jar every Worldlens release attaches, run with java, or the @worldlens/cli entry point dist/index.js, run with node. Empty means this tab cannot render, and says so instead of pretending.',
      'The command-line renderer driven for the in-app map. Either the renderer jar attached to every Worldlens release, run with java, or @worldlens/cli’s dist/index.js, run with node. Empty means no rendering here, stated rather than faked.',
      'Which command-line renderer draws the in-app map. Two things work: the renderer jar attached to every Worldlens release (java runs it) or @worldlens/cli’s dist/index.js (node runs it). Empty means this tab cannot render, and it says so rather than spinning forever.',
      'Which command-line renderer draws the in-app map. Two things work: the renderer jar attached to every Worldlens release (java runs it) or @worldlens/cli’s dist/index.js (node runs it). Empty means this tab cannot render, and it says so rather than spinning forever.'
    ],
    yue: [
      '驅動 app 內地圖嘅命令列渲染器。兩種檔案都得：每個 Worldlens release 都附嘅命令列渲染器 jar（用 java 行），或者 @worldlens/cli 嘅入口 dist/index.js（用 node 行）。留空即係呢版渲染唔到，佢會照直講，唔會扮嘢。',
      '驅動 app 內地圖嘅命令列渲染器。兩種檔案都得：每個 Worldlens release 都附嘅命令列渲染器 jar（用 java 行），或者 @worldlens/cli 嘅入口 dist/index.js（用 node 行）。留空即係呢版渲染唔到，佢會照直講，唔會扮嘢。',
      '驅動 app 內地圖嘅命令列渲染器。可以係 Worldlens release 附嘅渲染器 jar（java 行），或者 @worldlens/cli 嘅 dist/index.js（node 行）。留空即係渲染唔到，明講唔扮。',
      '邊個命令列渲染器負責畫 app 內嘅地圖。兩樣都得：每個 Worldlens release 附嘅渲染器 jar（java 行），或者 @worldlens/cli 嘅 dist/index.js（node 行）。留空即係呢版渲染唔到，佢會照直講，唔會喺度轉圈轉到天光。',
      '邊個命令列渲染器負責畫 app 內嘅地圖。兩樣都得：每個 Worldlens release 附嘅渲染器 jar（java 行），或者 @worldlens/cli 嘅 dist/index.js（node 行）。留空即係呢版渲染唔到，佢會照直講，唔會喺度轉圈轉到天光。'
    ]
  },
  'worldlens.setting.worldsDir': {
    en: ['Worlds folder', 'Worlds folder', 'Worlds folder', 'Worlds folder', 'Worlds folder'],
    yue: ['世界資料夾', '世界資料夾', '世界資料夾', '世界資料夾', '世界資料夾']
  },
  'worldlens.setting.worldsDir.description': {
    en: [
      'Where this tab looks for downloaded worlds. A folder holding a level.dat is treated as one world; any other folder is scanned one level deep for worlds. It is only ever read.',
      'Where this tab looks for downloaded worlds. A folder holding a level.dat is treated as one world; any other folder is scanned one level deep for worlds. It is only ever read.',
      'Where this tab looks for downloaded worlds. A folder with a level.dat is one world; anything else is scanned one level deep. Read only, never written.',
      'Where this tab goes looking for downloaded worlds. A folder with a level.dat in it is one world; any other folder gets scanned one level deep. Nothing here is ever written to.',
      'Where this tab goes looking for downloaded worlds. A folder with a level.dat in it is one world; any other folder gets scanned one level deep. Nothing here is ever written to.'
    ],
    yue: [
      '呢版去邊度搵下載咗嘅世界。入面有 level.dat 嘅資料夾當一個世界；其他資料夾就掃一層深搵世界。呢個位置淨係讀，唔會寫。',
      '呢版去邊度搵下載咗嘅世界。入面有 level.dat 嘅資料夾當一個世界；其他資料夾就掃一層深搵世界。呢個位置淨係讀，唔會寫。',
      '呢版去邊搵下載咗嘅世界。有 level.dat 就當一個世界；其他掃一層。淨係讀，唔會寫。',
      '呢版去邊度搵下載返嚟嘅世界。入面有 level.dat 嘅當一個世界；其他資料夾掃一層深。呢度永遠唔會寫嘢入去。',
      '呢版去邊度搵下載返嚟嘅世界。入面有 level.dat 嘅當一個世界；其他資料夾掃一層深。呢度永遠唔會寫嘢入去。'
    ]
  },
  'worldlens.setting.outputDir': {
    en: ['Render output folder', 'Render output folder', 'Render output folder', 'Render output folder', 'Render output folder'],
    yue: ['渲染輸出資料夾', '渲染輸出資料夾', '渲染輸出資料夾', '渲染輸出資料夾', '渲染輸出資料夾']
  },
  'worldlens.setting.outputDir.description': {
    en: [
      'Where a render writes. The renderer runs in this folder and creates config, web and data inside it; the map tiles end up in web/maps. Nothing is written outside it, and the world folder itself is never modified.',
      'Where a render writes. The renderer runs in this folder and creates config, web and data inside it; the map tiles end up in web/maps. Nothing is written outside it, and the world folder itself is never modified.',
      'Where a render writes. The renderer runs here and creates config, web and data inside; tiles land in web/maps. Nothing outside is touched and the world folder is never modified.',
      'Where a render writes. The renderer runs in this folder and makes config, web and data inside it, with the tiles landing in web/maps. Nothing outside it is touched, and your world folder is never modified.',
      'Where a render writes. The renderer runs in this folder and makes config, web and data inside it, with the tiles landing in web/maps. Nothing outside it is touched, and your world folder is never modified.'
    ],
    yue: [
      '渲染寫落邊度。渲染器喺呢個資料夾入面行，會建立 config、web 同 data；地圖磚落喺 web/maps。唔會寫出去外面，亦永遠唔會改你個世界資料夾。',
      '渲染寫落邊度。渲染器喺呢個資料夾入面行，會建立 config、web 同 data；地圖磚落喺 web/maps。唔會寫出去外面，亦永遠唔會改你個世界資料夾。',
      '渲染寫落邊。渲染器喺呢度行，入面開 config、web、data；磚落 web/maps。外面唔會郁，世界資料夾亦唔會改。',
      '渲染寫落邊度。渲染器喺呢個資料夾入面行，開 config、web 同 data，啲磚落 web/maps。外面一律唔郁，你個世界資料夾永遠唔會改。',
      '渲染寫落邊度。渲染器喺呢個資料夾入面行，開 config、web 同 data，啲磚落 web/maps。外面一律唔郁，你個世界資料夾永遠唔會改。'
    ]
  },
  'worldlens.setting.port': {
    en: ['Loopback port', 'Loopback port', 'Loopback port', 'Loopback port', 'Loopback port'],
    yue: ['Loopback 連接埠', 'Loopback 連接埠', 'Loopback 連接埠', 'Loopback 連接埠', 'Loopback 連接埠']
  },
  'worldlens.setting.port.description': {
    en: [
      'The port the map server listens on. It always binds 127.0.0.1, so the map is reachable from this computer only; the port decides which local address, never who can reach it. Change it if something else already holds the number.',
      'The port the map server listens on. It always binds 127.0.0.1, so the map is reachable from this computer only; the port decides which local address, never who can reach it. Change it if something else already holds the number.',
      'The port the map server listens on. It always binds 127.0.0.1, so only this computer reaches it; the port picks the local address, not the audience. Change it if the number is taken.',
      'The port the map server listens on. It always binds 127.0.0.1, so the audience is this computer and nobody else — the port only picks which local address, never who can get in. Change it if something else already has the number.',
      'The port the map server listens on. It always binds 127.0.0.1, so the audience is this computer and nobody else — the port only picks which local address, never who can get in. Change it if something else already has the number.'
    ],
    yue: [
      '地圖伺服器聽邊個連接埠。佢一定綁 127.0.0.1，所以得呢部電腦連得到；連接埠只係決定本機邊個位址，唔會決定邊個連得到。如果個號碼畀人佔咗就改佢。',
      '地圖伺服器聽邊個連接埠。佢一定綁 127.0.0.1，所以得呢部電腦連得到；連接埠只係決定本機邊個位址，唔會決定邊個連得到。如果個號碼畀人佔咗就改佢。',
      '地圖伺服器聽邊個連接埠。永遠綁 127.0.0.1，得呢部電腦連到；連接埠揀本機位址，唔係揀觀眾。個號碼被佔就改。',
      '地圖伺服器聽邊個連接埠。永遠綁 127.0.0.1，觀眾得呢部電腦一個 —— 連接埠淨係揀本機邊個位址，永遠唔會決定邊個入得嚟。個號碼畀人佔咗就改佢。',
      '地圖伺服器聽邊個連接埠。永遠綁 127.0.0.1，觀眾得呢部電腦一個 —— 連接埠淨係揀本機邊個位址，永遠唔會決定邊個入得嚟。個號碼畀人佔咗就改佢。'
    ]
  },
  'worldlens.setting.threads': {
    en: ['Render threads', 'Render threads', 'Render threads', 'Render threads', 'Render threads'],
    yue: ['渲染執行緒', '渲染執行緒', '渲染執行緒', '渲染執行緒', '渲染執行緒']
  },
  'worldlens.setting.threads.description': {
    en: [
      'How many worker threads the renderer uses. More finishes sooner and leaves less of the machine for anything else, including a download running at the same time.',
      'How many worker threads the renderer uses. More finishes sooner and leaves less of the machine for anything else, including a download running at the same time.',
      'How many worker threads the renderer uses. More is faster and leaves less machine for everything else, a download included.',
      'How many worker threads the renderer gets. More finishes sooner and leaves less of the machine for everything else — including a download running at the same time.',
      'How many worker threads the renderer gets. More finishes sooner and leaves less of the machine for everything else — including a download running at the same time.'
    ],
    yue: [
      '渲染器用幾多條工作執行緒。多啲會快啲做完，但留返畀其他嘢嘅機器資源就少啲，包括同時行緊嘅下載。',
      '渲染器用幾多條工作執行緒。多啲會快啲做完，但留返畀其他嘢嘅機器資源就少啲，包括同時行緊嘅下載。',
      '渲染器用幾多條執行緒。多啲快啲，但留返畀第啲嘢嘅就少啲，包括同時行緊嘅下載。',
      '渲染器攞到幾多條工作執行緒。多啲快啲做完，但留返畀其他嘢嘅機器就少啲 —— 包括同一時間行緊嘅下載。',
      '渲染器攞到幾多條工作執行緒。多啲快啲做完，但留返畀其他嘢嘅機器就少啲 —— 包括同一時間行緊嘅下載。'
    ]
  },
  'worldlens.setting.acceptDownload': {
    en: [
      'Let the renderer download Minecraft client files',
      'Let the renderer download Minecraft client files',
      'Let the renderer download Minecraft client files',
      'Let the renderer download Minecraft client files',
      'Let the renderer download Minecraft client files'
    ],
    yue: [
      '容許渲染器下載 Minecraft 客戶端檔案',
      '容許渲染器下載 Minecraft 客戶端檔案',
      '容許渲染器下載 Minecraft 客戶端檔案',
      '容許渲染器下載 Minecraft 客戶端檔案',
      '容許渲染器下載 Minecraft 客戶端檔案'
    ]
  },
  'worldlens.setting.acceptDownload.description': {
    en: [
      'Block textures come from Minecraft’s own client files. Off — the shipped default — means the renderer uses whatever is already on this machine and stops with a message when it cannot, rather than reaching the network. On means it may download them from Mojang while a render runs. This is the only setting here that permits a network request.',
      'Block textures come from Minecraft’s own client files. Off — the shipped default — means the renderer uses whatever is already on this machine and stops with a message when it cannot, rather than reaching the network. On means it may download them from Mojang while a render runs. This is the only setting here that permits a network request.',
      'Block textures come from Minecraft’s own client files. Off, the shipped default, means the renderer uses what is already here and stops with a message when it cannot. On means it may fetch them from Mojang mid-render. It is the only setting here that permits a network request.',
      'Block textures come out of Minecraft’s own client files. Off — the shipped default — means the renderer works with whatever is already on this machine and stops with a message when it cannot, rather than quietly reaching for the network. On means it may fetch them from Mojang while a render is running. It is the one setting here that permits a network request at all.',
      'Block textures come out of Minecraft’s own client files. Off — the shipped default — means the renderer works with whatever is already on this machine and stops with a message when it cannot, rather than quietly reaching for the network. On means it may fetch them from Mojang while a render is running. It is the one setting here that permits a network request at all.'
    ],
    yue: [
      '方塊材質嚟自 Minecraft 自己嘅客戶端檔案。閂（出廠預設）即係渲染器淨係用呢部機已經有嘅嘢，做唔到就出訊息停低，唔會上網。開就即係渲染途中佢可以去 Mojang 度下載。呢個係呢度唯一容許網絡請求嘅設定。',
      '方塊材質嚟自 Minecraft 自己嘅客戶端檔案。閂（出廠預設）即係渲染器淨係用呢部機已經有嘅嘢，做唔到就出訊息停低，唔會上網。開就即係渲染途中佢可以去 Mojang 度下載。呢個係呢度唯一容許網絡請求嘅設定。',
      '方塊材質嚟自 Minecraft 客戶端檔案。閂（出廠預設）即係淨用機上已有嘅，做唔到就出訊息停低。開就渲染途中可以去 Mojang 攞。呢個係呢度唯一容許網絡請求嘅設定。',
      '方塊材質係由 Minecraft 自己嘅客戶端檔案嚟。閂（出廠預設）即係渲染器用呢部機有咩就用咩，做唔到就出訊息停低，唔會靜靜雞上網。開就即係渲染行緊嗰陣佢可以去 Mojang 攞。呢個係呢度唯一一個容許網絡請求嘅設定。',
      '方塊材質係由 Minecraft 自己嘅客戶端檔案嚟。閂（出廠預設）即係渲染器用呢部機有咩就用咩，做唔到就出訊息停低，唔會靜靜雞上網。開就即係渲染行緊嗰陣佢可以去 Mojang 攞。呢個係呢度唯一一個容許網絡請求嘅設定。'
    ]
  },
  'worldlens.setting.watch': {
    en: [
      'Keep watching the world after rendering',
      'Keep watching the world after rendering',
      'Keep watching the world after rendering',
      'Keep watching the world after rendering',
      'Keep watching the world after rendering'
    ],
    yue: [
      '渲染完之後繼續睇住個世界',
      '渲染完之後繼續睇住個世界',
      '渲染完之後繼續睇住個世界',
      '渲染完之後繼續睇住個世界',
      '渲染完之後繼續睇住個世界'
    ]
  },
  'worldlens.setting.watch.description': {
    en: [
      'On, the renderer stays running after the first pass and updates the map when the world changes on disk — useful while a download is still writing to it. The renderer keeps using processor time until it is stopped.',
      'On, the renderer stays running after the first pass and updates the map when the world changes on disk — useful while a download is still writing to it. The renderer keeps using processor time until it is stopped.',
      'On, the renderer stays running after the first pass and re-renders when the world changes on disk — handy while a download is still writing. It keeps using processor time until stopped.',
      'On, the renderer stays put after the first pass and redraws whenever the world changes on disk — genuinely useful while a download is still writing into it. It goes on using processor time until you stop it.',
      'On, the renderer stays put after the first pass and redraws whenever the world changes on disk — genuinely useful while a download is still writing into it. It goes on using processor time until you stop it.'
    ],
    yue: [
      '開咗，渲染器第一輪做完唔會走，個世界喺硬碟度有變就更新地圖 —— 下載仲寫緊嘅時候幾有用。停佢之前佢會一直用緊處理器時間。',
      '開咗，渲染器第一輪做完唔會走，個世界喺硬碟度有變就更新地圖 —— 下載仲寫緊嘅時候幾有用。停佢之前佢會一直用緊處理器時間。',
      '開咗，第一輪做完渲染器唔會走，世界喺硬碟有變就重畫 —— 下載仲寫緊嗰陣好用。停佢之前一直食住處理器。',
      '開咗，渲染器第一輪做完唔會郁走，個世界喺硬碟有咩改動就重新畫 —— 下載仲寫緊入去嗰陣真係好用。你唔停佢，佢就一直食住處理器時間。',
      '開咗，渲染器第一輪做完唔會郁走，個世界喺硬碟有咩改動就重新畫 —— 下載仲寫緊入去嗰陣真係好用。你唔停佢，佢就一直食住處理器時間。'
    ]
  },
  'worldlens.setting.force': {
    en: [
      'Re-render every chunk',
      'Re-render every chunk',
      'Re-render every chunk',
      'Re-render every chunk from scratch',
      'Re-render every chunk from scratch'
    ],
    yue: [
      '重新渲染每一個 chunk',
      '重新渲染每一個 chunk',
      '重新渲染每一個 chunk',
      '由零重新渲染每一個 chunk',
      '由零重新渲染每一個 chunk'
    ]
  },
  'worldlens.setting.force.description': {
    en: [
      'On, every chunk is drawn again instead of only the ones that changed since the last render. Slower, and the way to fix a map that looks wrong after a partial render.',
      'On, every chunk is drawn again instead of only the ones that changed since the last render. Slower, and the way to fix a map that looks wrong after a partial render.',
      'On, every chunk is drawn again rather than only the changed ones. Slower, and the fix for a map that looks wrong after a partial render.',
      'On, every chunk gets drawn again rather than only the ones that moved since last time. Much slower — and the thing to reach for when a map looks wrong after a partial render.',
      'On, every chunk gets drawn again rather than only the ones that moved since last time. Much slower — and the thing to reach for when a map looks wrong after a partial render.'
    ],
    yue: [
      '開咗，每一個 chunk 都會重新畫，唔止畫上次渲染之後改咗嗰啲。慢啲，但係渲染做一半之後地圖睇落唔對路嗰陣，就係靠佢。',
      '開咗，每一個 chunk 都會重新畫，唔止畫上次渲染之後改咗嗰啲。慢啲，但係渲染做一半之後地圖睇落唔對路嗰陣，就係靠佢。',
      '開咗，每個 chunk 都重畫，唔止改咗嗰啲。慢啲，但地圖做一半睇落唔對路就靠佢救。',
      '開咗，每一個 chunk 都會重新畫過，唔係淨係畫上次之後郁過嗰啲。慢好多 —— 但地圖渲染到一半睇落唔對路，就係要搵佢。',
      '開咗，每一個 chunk 都會重新畫過，唔係淨係畫上次之後郁過嗰啲。慢好多 —— 但地圖渲染到一半睇落唔對路，就係要搵佢。'
    ]
  },
  'worldlens.setting.offerOnComplete': {
    en: [
      'Offer Worldlens when a download completes',
      'Offer Worldlens when a download completes',
      'Offer Worldlens when a download completes',
      'Offer Worldlens the moment a download completes',
      'Offer Worldlens the moment a download completes'
    ],
    yue: [
      '下載完成時提議用 Worldlens',
      '下載完成時提議用 Worldlens',
      '下載完成時提議用 Worldlens',
      '一下載完就提議用 Worldlens',
      '一下載完就提議用 Worldlens'
    ]
  },
  'worldlens.setting.offerOnComplete.description': {
    en: [
      'On, a finished download raises a dismissible notification offering to open the world in Worldlens or render it here. It is a notification, never a dialog, so it never interrupts what you are doing. Off, the same actions stay on this tab and in the command palette.',
      'On, a finished download raises a dismissible notification offering to open the world in Worldlens or render it here. It is a notification, never a dialog, so it never interrupts what you are doing. Off, the same actions stay on this tab and in the command palette.',
      'On, a finished download raises a dismissible notification offering to open the world in Worldlens or render it here. A notification, never a dialog, so it never interrupts. Off, the same actions stay on this tab and in the palette.',
      'On, a finished download quietly raises a dismissible notification offering to open the world in Worldlens or render it right here. It is a notification and never a dialog, so it never gets in your way. Off, those same actions are still on this tab and in the command palette.',
      'On, a finished download quietly raises a dismissible notification offering to open the world in Worldlens or render it right here. It is a notification and never a dialog, so it never gets in your way. Off, those same actions are still on this tab and in the command palette.'
    ],
    yue: [
      '開咗，下載完成會出一個可以撳走嘅通知，問你要唔要喺 Worldlens 打開個世界，或者喺呢度渲染。佢係通知，唔係對話框，所以唔會打斷你。閂咗，同樣嘅操作仍然喺呢版同指令面板度。',
      '開咗，下載完成會出一個可以撳走嘅通知，問你要唔要喺 Worldlens 打開個世界，或者喺呢度渲染。佢係通知，唔係對話框，所以唔會打斷你。閂咗，同樣嘅操作仍然喺呢版同指令面板度。',
      '開咗，下載完會出個可以撳走嘅通知，問你要唔要喺 Worldlens 開個世界，或者喺呢度渲染。係通知唔係對話框，唔會打斷你。閂咗，一樣嘅操作仍然喺呢版同面板。',
      '開咗，下載一完就靜靜哋出個可以撳走嘅通知，問你要唔要喺 Worldlens 打開個世界，定係就喺呢度渲染。佢係通知，唔係對話框，永遠唔會阻住你。閂咗，同一批操作照樣喺呢版同指令面板度等你。',
      '開咗，下載一完就靜靜哋出個可以撳走嘅通知，問你要唔要喺 Worldlens 打開個世界，定係就喺呢度渲染。佢係通知，唔係對話框，永遠唔會阻住你。閂咗，同一批操作照樣喺呢版同指令面板度等你。'
    ]
  },
  'worldlens.setting.getWorldlens': {
    en: [
      'Open the Worldlens releases page',
      'Open the Worldlens releases page',
      'Open the Worldlens releases page',
      'Open the Worldlens releases page',
      'Open the Worldlens releases page'
    ],
    yue: [
      '打開 Worldlens 發佈頁',
      '打開 Worldlens 發佈頁',
      '打開 Worldlens 發佈頁',
      '打開 Worldlens 發佈頁',
      '打開 Worldlens 發佈頁'
    ]
  },
  'worldlens.setting.getWorldlens.description': {
    en: [
      'Opens the Worldlens releases page in your browser, where the Windows installer is. This application never downloads or installs it for you, and never bundles a copy of it.',
      'Opens the Worldlens releases page in your browser, where the Windows installer is. This application never downloads or installs it for you, and never bundles a copy of it.',
      'Opens the Worldlens releases page in your browser, where the Windows installer lives. This application never downloads it, installs it or bundles a copy.',
      'Opens the Worldlens releases page in your own browser, where the Windows installer lives. This application never downloads it for you, never installs it and never bundles a copy of it.',
      'Opens the Worldlens releases page in your own browser, where the Windows installer lives. This application never downloads it for you, never installs it and never bundles a copy of it.'
    ],
    yue: [
      '喺你個瀏覽器打開 Worldlens 發佈頁，Windows 安裝程式喺嗰度。呢個應用程式唔會幫你下載、唔會幫你安裝，亦唔會夾帶一份副本。',
      '喺你個瀏覽器打開 Worldlens 發佈頁，Windows 安裝程式喺嗰度。呢個應用程式唔會幫你下載、唔會幫你安裝，亦唔會夾帶一份副本。',
      '喺你個瀏覽器打開 Worldlens 發佈頁，Windows 安裝程式喺嗰度。呢個 app 唔會幫你下載、安裝，亦唔會夾帶副本。',
      '喺你自己個瀏覽器打開 Worldlens 發佈頁，Windows 安裝程式就喺嗰度。呢個 app 唔會幫你下載、唔會幫你裝，亦都唔會夾帶一份副本。',
      '喺你自己個瀏覽器打開 Worldlens 發佈頁，Windows 安裝程式就喺嗰度。呢個 app 唔會幫你下載、唔會幫你裝，亦都唔會夾帶一份副本。'
    ]
  },
  'worldlens.setting.redetect': {
    en: ['Detect Worldlens now', 'Detect Worldlens now', 'Detect Worldlens now', 'Go and look for Worldlens now', 'Go and look for Worldlens now'],
    yue: ['即刻偵測 Worldlens', '即刻偵測 Worldlens', '即刻偵測 Worldlens', '而家就去搵 Worldlens', '而家就去搵 Worldlens']
  },
  'worldlens.setting.redetect.description': {
    en: [
      'Looks again for an installed Worldlens and re-validates the renderer path. Run it after installing or updating Worldlens; nothing is changed on disk by looking.',
      'Looks again for an installed Worldlens and re-validates the renderer path. Run it after installing or updating Worldlens; nothing is changed on disk by looking.',
      'Looks again for an installed Worldlens and re-checks the renderer path. Run it after installing or updating; looking changes nothing on disk.',
      'Goes and looks again for an installed Worldlens, and re-checks the renderer path while it is there. Worth running after installing or updating Worldlens. Looking changes nothing on disk.',
      'Goes and looks again for an installed Worldlens, and re-checks the renderer path while it is there. Worth running after installing or updating Worldlens. Looking changes nothing on disk.'
    ],
    yue: [
      '再搵一次已安裝嘅 Worldlens，同時重新驗證渲染器路徑。裝完或者更新完 Worldlens 就行佢；淨係搵，唔會改硬碟上任何嘢。',
      '再搵一次已安裝嘅 Worldlens，同時重新驗證渲染器路徑。裝完或者更新完 Worldlens 就行佢；淨係搵，唔會改硬碟上任何嘢。',
      '再搵一次已安裝嘅 Worldlens，順手重新檢查渲染器路徑。裝完或更新完就行佢；搵嘢唔會改到硬碟。',
      '再去搵多次已安裝嘅 Worldlens，順手重新檢查埋渲染器路徑。裝完或者更新完 Worldlens 之後行下佢好抵。淨係搵嘢，硬碟上乜都唔會改。',
      '再去搵多次已安裝嘅 Worldlens，順手重新檢查埋渲染器路徑。裝完或者更新完 Worldlens 之後行下佢好抵。淨係搵嘢，硬碟上乜都唔會改。'
    ]
  },

  /* ---------------- palette ---------------- */

  'worldlens.palette.open': {
    en: [
      'Worldlens pairing',
      'Worldlens pairing',
      'Worldlens pairing',
      'Worldlens pairing',
      'Worldlens pairing'
    ],
    yue: ['Worldlens 配對', 'Worldlens 配對', 'Worldlens 配對', 'Worldlens 配對', 'Worldlens 配對']
  }
};
