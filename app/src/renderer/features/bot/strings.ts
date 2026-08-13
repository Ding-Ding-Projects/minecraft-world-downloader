/**
 * The scraper bot feature's own copy catalogue.
 *
 * Every key here is namespaced `bot.*` so it can never collide with a sibling
 * feature's catalogue. Each entry carries a five-rung ladder in English and in
 * Cantonese; the two humour sliders are independent, so an entry's rungs 1–3
 * are the professional reading and rungs 4–5 are the playful one — the same
 * two-tier shape the integration contract's own worked example uses. Facts
 * (names, counts, addresses, `{placeholders}`) never change between rungs;
 * only the voice around them does.
 */

import type { Catalogue } from '../../core/registry';

type Ladder5 = [string, string, string, string, string];

/** Professional for rungs 1–3, playful for rungs 4–5. Never fewer than five. */
function pair(plain: string, playful: string): Ladder5 {
  return [plain, plain, plain, playful, playful];
}

const STRINGS: Catalogue = {};

function s(key: string, enPlain: string, enPlayful: string, yuePlain: string, yuePlayful: string): void {
  STRINGS[key] = { en: pair(enPlain, enPlayful), yue: pair(yuePlain, yuePlayful) };
}

/* ================================================================== */
/* Tab and top bar                                                     */
/* ================================================================== */

s('bot.tab', 'Scraper bot', 'Scraper bot, off the leash', '爬蟲機械人', '爬蟲機械人，放咗出街喇');
s(
  'bot.tab.subtitle',
  'Runs the bundled Node scraper through the downloader proxy and keeps what it prints.',
  'Sends the bundled Node scraper for a walk through the downloader proxy and writes down everything it shouts back.',
  '透過下載器嘅代理伺服器運行內置嘅 Node 爬蟲程式，並記低佢印出嚟嘅嘢。',
  '牽住內置嘅 Node 爬蟲程式，經下載器代理去散步，佢嗌乜都幫佢記低。'
);
s('bot.action.docs', 'Read the article', 'Read the manual (it is short, promise)', '閱讀文章', '睇下說明書（真係好短㗎）');

/* ================================================================== */
/* Run controls                                                        */
/* ================================================================== */

s('bot.run.title', 'Run controls', 'Mission control', '運行控制', '出動控制台');
s(
  'bot.run.help',
  'Starts node scrape.js with a configuration generated from the chosen profile. Start the downloader first: the proxy is what saves the chunks.',
  'Fires up node scrape.js with a configuration built from whichever profile you picked. Get the downloader running first — the proxy is the one actually catching the chunks.',
  '用揀選咗嘅設定檔生成一份配置，然後執行 node scrape.js。記得先開返下載器：真正儲低區塊嘅係嗰個代理。',
  '照住揀嘅設定檔整份配置，再放 node scrape.js 出去跑。落閘之前先開好下載器——真正執到嘢嘅係代理伺服器。'
);
s('bot.run.profile', 'Profile to run', 'Which profile is going out today', '要運行嘅設定檔', '今日邊個設定檔出更');
s(
  'bot.run.noProfiles',
  'There are no profiles yet. Create one below and it appears here.',
  'Nothing to run yet — make a profile below and it will turn up right here.',
  '仲未有設定檔。喺下面整一個，佢就會喺呢度出現。',
  '未有嘢好跑喎。喺下面整定一個，佢自動彈上嚟呢度。'
);
s('bot.run.start', 'Start the bot', 'Release the bot', '啟動機械人', '放機械人出去');
s('bot.run.stop', 'Stop the bot', 'Call the bot back', '停止機械人', '叫機械人返嚟');
s('bot.run.revealConfig', 'Show the generated configuration', 'Peek at the generated configuration', '顯示生成嘅配置檔', '偷睇下生成咗嘅配置檔');
s('bot.run.revealFailed', 'That folder could not be opened', 'That folder would not open', '呢個資料夾打唔開', '呢個資料夾死都唔開');
s(
  'bot.run.noProfileChosen',
  'Choose a profile to run.',
  'Pick a profile first — the bot needs marching orders.',
  '請選擇一個要運行嘅設定檔。',
  '揀個設定檔先啦，機械人要有指令先識郁㗎。'
);
s(
  'bot.run.ready',
  'Ready to run {name} against {host}:{port}.',
  'All set to send {name} against {host}:{port}.',
  '準備就緒，可以用 {name} 連接 {host}:{port}。',
  '整定晒喇，隨時放 {name} 去 {host}:{port} 搞搞震。'
);
s(
  'bot.run.detail',
  '{name} · process {pid} · started {started} · {lines} line(s) read · {messages} message(s) captured',
  '{name} · process {pid} · rolling since {started} · {lines} line(s) chewed through · {messages} message(s) caught',
  '{name} · 處理程序 {pid} · 開始於 {started} · 已讀取 {lines} 行 · 已捕獲 {messages} 個訊息',
  '{name} · 處理程序 {pid} · 由 {started} 開波 · 食咗 {lines} 行 · 網到 {messages} 個訊息'
);
s(
  'bot.run.alreadyRunning',
  'A run is already going. Stop it first.',
  'One is already off running around. Call it back first.',
  '已經有一個運行中。請先停止佢。',
  '已經有一個喺度跑緊喇，先叫佢返嚟啦。'
);
s(
  'bot.run.nothingToStop',
  'Nothing is running, so there is nothing to stop.',
  'Nothing is out there to call back.',
  '目前冇任何運行中嘅程序，所以冇嘢可以停止。',
  '而家咩都冇跑緊，冇嘢好停喎。'
);
s(
  'bot.run.noConfigYet',
  'A configuration file exists only while a run is going.',
  'The configuration file only exists while the bot is out and about.',
  '配置檔只在運行期間存在。',
  '配置檔淨係喺跑緊嗰陣先有得睇。'
);
s('bot.run.failedTitle', 'The bot did not start', 'The bot refused to leave the house', '機械人未能啟動', '機械人死都唔肯出門');
s(
  'bot.run.startedTitle',
  'The bot is running',
  'The bot is out there, living its best life',
  '機械人正在運行',
  '機械人出咗去玩緊喇'
);
s(
  'bot.run.startedBody',
  '{name} is connected through {host}:{port}.',
  '{name} has hopped onto {host}:{port} and is off exploring.',
  '{name} 已透過 {host}:{port} 連接。',
  '{name} 已經跳咗上 {host}:{port}，出去探索緊喇。'
);
s('bot.run.stopFailedTitle', 'The bot did not stop', 'The bot ignored the recall', '機械人未能停止', '機械人唔聽召喚喎');
s('bot.run.deviceTitle', 'Microsoft sign-in needed', 'Microsoft wants a word', '需要 Microsoft 登入', 'Microsoft 話要傾兩句');
s(
  'bot.run.deviceBody',
  'Open {url} in a browser and enter the code {code}. This is only needed once per account; the token is cached afterwards.',
  'Pop {url} open in a browser and type in {code}. Only a once-per-account chore — the token gets remembered afterwards.',
  '喺瀏覽器開啟 {url}，並輸入代碼 {code}。呢個步驟每個帳戶只需做一次；之後令牌會被快取。',
  '開返 {url} 打入代碼 {code} 就得。呢步每個帳戶淨係做一次，之後個令牌就幫你記住㗎喇。'
);
s('bot.run.deviceOpen', 'Open the sign-in page', 'Jump to the sign-in page', '開啟登入頁面', '彈去登入頁');
s('bot.run.deviceOpenFailed', 'That page could not be opened', 'That page would not budge', '呢個頁面打唔開', '呢版死都唔開');

/* ================================================================== */
/* Profiles list                                                       */
/* ================================================================== */

s('bot.profiles.title', 'Profiles', 'The roster', '設定檔', '花名冊');
s(
  'bot.profiles.help',
  'Each profile is one complete scraper configuration. Selecting several lets you duplicate, export or delete them together.',
  'Each profile is one complete scraper loadout. Tick a few and duplicate, export or bin them together.',
  '每個設定檔都係一份完整嘅爬蟲配置。選取多個可以一齊複製、匯出或刪除。',
  '每個設定檔都係一套完整裝備。揀多幾個就可以一齊複製、匯出定係丟晒佢哋。'
);
s('bot.profiles.search', 'Search profiles', 'Hunt through the profiles', '搜尋設定檔', '喺設定檔堆度搵嘢');
s('bot.profiles.create', 'New profile', 'Fresh profile, please', '新增設定檔', '嚟個新設定檔');
s(
  'bot.profiles.selectShown',
  'Select the {count} shown',
  'Grab all {count} shown here',
  '選取顯示嘅 {count} 個',
  '將顯示緊嘅 {count} 個全部揀晒'
);
s(
  'bot.profiles.selectEvery',
  'Select all {count} profiles',
  'Grab the whole set — all {count} of them',
  '選取全部 {count} 個設定檔',
  '成套 {count} 個設定檔全部攞晒'
);
s(
  'bot.profiles.duplicate',
  'Duplicate selected',
  'Clone the chosen ones',
  '複製已選項目',
  '將揀咗嘅複製多份'
);
s(
  'bot.profiles.duplicated',
  '{count} profile(s) copied. The copies have no stored password, so automatic login is off on them.',
  '{count} clone(s) made. No password came along for the ride, so auto-login is switched off on them.',
  '已複製 {count} 個設定檔。複製本冇儲存密碼，所以自動登入喺佢哋度係關咗嘅。',
  '複製咗 {count} 個。密碼冇跟埋嚟，所以複製本嘅自動登入係熄咗嘅。'
);
s('bot.profiles.duplicatedTitle', 'Duplicated', 'Cloned', '已複製', '複製完成');
s('bot.profiles.export', 'Export selected', 'Ship out the chosen ones', '匯出已選項目', '將揀咗嘅寄走');
s(
  'bot.profiles.deleteAction',
  'Delete {count} scraper bot profile(s)',
  'Send {count} scraper bot profile(s) to the bin',
  '刪除 {count} 個爬蟲機械人設定檔',
  '將 {count} 個爬蟲機械人設定檔丟落垃圾桶'
);
s(
  'bot.profiles.deleteIrreversible',
  'The profiles are removed from the settings file. Any password each one stored in the credential vault is deleted with it. Captured messages and visited chunk caches are left alone.',
  'The profiles vanish from the settings file, and any password each one kept in the vault goes with them. Captured messages and visited chunk caches are untouched.',
  '設定檔會由設定檔案中移除。每個設定檔喺憑證儲存庫入面儲存嘅密碼都會一併刪除。已捕獲嘅訊息同已造訪嘅區塊快取則不受影響。',
  '設定檔會由設定檔入面剷走，連埋佢哋喺密碼庫度收埋嘅密碼一齊冚唪唥刪。捕獲咗嘅訊息同去過嘅區塊快取就冇事。'
);
s(
  'bot.profiles.deleted',
  '{count} profile(s) removed. The change is in local history.',
  '{count} profile(s) gone. It is all logged in local history.',
  '已移除 {count} 個設定檔，變更已記錄喺本機歷史紀錄中。',
  '{count} 個設定檔冇咗，呢單嘢已經記低咗喺本機歷史入面。'
);
s('bot.profiles.deletedTitle', 'Profiles deleted', 'Profiles binned', '設定檔已刪除', '設定檔已丟走');
s(
  'bot.profiles.emptyTitle',
  'No profiles yet',
  'The roster is empty',
  '仲未有設定檔',
  '花名冊仲係得個吉'
);
s(
  'bot.profiles.emptyBody',
  'A profile is the configuration the scraper actually reads. Start from a preset below, or build one field by field.',
  'A profile is the configuration the scraper actually reads. Grab a preset below, or build one field by field like a proper artisan.',
  '設定檔就係爬蟲程式實際讀取嘅配置。可以喺下面選用預設，或者逐個欄位自行建立。',
  '設定檔就係爬蟲真正照住讀嘅嗰份配置。喺下面攞個現成嘅，定係自己逐格砌都得。'
);
s('bot.profiles.list', 'Saved profiles', 'The profile stash', '已儲存嘅設定檔', '收埋咗嘅設定檔');
s('bot.profiles.runOne', 'Run {name}', 'Send {name} out', '運行 {name}', '放 {name} 出去');
s('bot.profiles.editOne', 'Edit {name}', 'Tinker with {name}', '編輯 {name}', '同 {name} 郁下手腳');
s(
  'bot.profiles.summary',
  '{host}:{port} · {bots} bot(s) · {area} · {status}',
  '{host}:{port} · {bots} bot(s) · {area} · {status}',
  '{host}:{port} · {bots} 個機械人 · {area} · {status}',
  '{host}:{port} · {bots} 隻機械人 · {area} · {status}'
);
s('bot.profiles.areaBox', 'bounding box', 'a boxed-in patch', '邊界範圍', '劃咗個框嘅地皮');
s('bot.profiles.areaSpawn', '{radius} blocks around each spawn', '{radius} blocks around wherever each bot lands', '每個重生點周圍 {radius} 個方塊', '每隻落地嗰度周圍 {radius} 個方塊');
s(
  'bot.profiles.areaCentre',
  '{radius} blocks around {x}, {z}',
  '{radius} blocks around {x}, {z}',
  '{x}, {z} 周圍 {radius} 個方塊',
  '{x}, {z} 周圍嗰 {radius} 個方塊'
);
s('bot.profiles.usable', 'ready to run', 'raring to go', '可立即運行', '整定晒可以出發');
s(
  'bot.profiles.needsWork',
  '{count} field(s) need attention',
  '{count} field(s) still need a poke',
  '{count} 個欄位需要處理',
  '{count} 格嘢仲要執下先得'
);
s('bot.profiles.noSelection', 'No profile is selected.', 'Nothing is picked yet.', '未選取任何設定檔。', '未揀到嘢喎。');
s('bot.profiles.none', 'There are no profiles yet.', 'The roster is still empty.', '仲未有設定檔。', '花名冊仲係吉嘅。');
s(
  'bot.profiles.noneShown',
  'The current filter shows no profiles.',
  'The filter is hiding every single profile.',
  '目前篩選條件冇顯示任何設定檔。',
  '而家嘅篩選乜設定檔都冇顯示到。'
);
s('bot.profiles.untitled', 'New profile', 'Nameless newcomer', '新設定檔', '未改名嘅新丁');
s('bot.profiles.copyName', '{name} (copy)', '{name} (copy)', '{name}（副本）', '{name}（複製版）');
s('bot.profiles.what', 'profiles', 'profiles', '設定檔', '啲設定檔');
s(
  'bot.profiles.editCancelled',
  'Editing was cancelled. Nothing was changed.',
  'Editing called off. Not a byte was touched.',
  '編輯已取消，未有任何變更。',
  '編輯取消咗，一個字都冇改過。'
);

/* ================================================================== */
/* Profile form — groups                                               */
/* ================================================================== */

s('bot.form.identity', 'Identity', 'Who this profile is', '身分', '呢個設定檔係邊個');
s(
  'bot.form.identity.help',
  'The name, the scraper folder and any notes you want to keep with this profile.',
  'The name, the scraper folder, and whatever notes you want stuck to this profile.',
  '呢個設定檔嘅名稱、爬蟲資料夾同任何想保留嘅備註。',
  '呢個設定檔嘅名、爬蟲資料夾，同你想貼埋嘅任何筆記。'
);
s('bot.form.connection', 'Connection', 'Where it is heading', '連線', '要去邊');
s(
  'bot.form.connection.help',
  'The proxy address, port and protocol version the bots connect with.',
  'The proxy address, port and protocol version the bots will show up with.',
  '機械人連接時所使用嘅代理位址、埠號同協議版本。',
  '啲機械人接頭時報住嘅代理位址、埠同協議版本。'
);
s('bot.form.accounts', 'Accounts', 'The crew', '帳戶', '成隊人馬');
s(
  'bot.form.accounts.help',
  'One account per bot. The area to cover is split between however many are listed here.',
  'One account per bot — the area gets carved up between however many names are on this list.',
  '每個機械人對應一個帳戶。要覆蓋嘅範圍會按照此列表嘅帳戶數量分配。',
  '一個帳戶一隻機械人。要行嘅範圍就按呢度嘅人數分晒佢。'
);
s('bot.form.area', 'Area', 'The turf', '範圍', '地頭');
s(
  'bot.form.area.help',
  'What the bots cover, and how finely they cover it.',
  'What patch of the world the bots are covering, and how thoroughly.',
  '機械人所覆蓋嘅範圍，以及覆蓋嘅密度。',
  '機械人負責嘅地皮，同埋行得幾密。'
);
s('bot.form.movement', 'Movement', 'How it gets about', '移動方式', '點郁法');
s(
  'bot.form.movement.help',
  'Whether the bots fly or walk, in which game mode, and how high they fly.',
  'Whether the bots fly or hoof it, which game mode calls for what, and how high they cruise.',
  '機械人喺唔同遊戲模式下係飛行定行走，以及飛行高度。',
  '機械人喺邊個模式飛定行，同埋飛幾高。'
);
s('bot.form.timing', 'Timing', 'The clockwork', '時間設定', '計時掣');
s(
  'bot.form.timing.help',
  'How long each bot waits at a chunk, at a waypoint, and before disconnecting.',
  'How long each bot lingers at a chunk, dawdles at a waypoint, and hangs about before logging off.',
  '每個機械人喺區塊、路徑點等待嘅時間，以及斷線前嘅等待時間。',
  '機械人喺區塊度呆幾耐、喺路徑點磨蹭幾耐，同埋落線前肯等幾耐。'
);
s('bot.form.dedup', 'Deduplication', 'Not doing the same chunk twice', '去重', '唔好行兩次同一格');
s(
  'bot.form.dedup.help',
  'Where the list of already-visited chunks is kept, and whether a run should ignore it.',
  'Where the already-been-there list lives, and whether a run should just pretend it never saw it.',
  '已造訪區塊清單嘅儲存位置，以及運行時是否忽略此清單。',
  '去過嘅區塊清單擺喺邊，同埋跑嗰陣要唔要理佢。'
);
s('bot.form.login', 'Automatic login', 'The password minder', '自動登入', '密碼保管員');
s(
  'bot.form.login.help',
  'A stored password for servers running an AuthMe-style login plugin, held in the operating system credential vault.',
  'A password tucked away in the operating system credential vault, for servers running an AuthMe-style login plugin.',
  '為運行 AuthMe 式登入外掛嘅伺服器儲存密碼，並存放喺作業系統嘅憑證儲存庫。',
  '幫用緊 AuthMe 式登入外掛嘅伺服器收埋密碼，藏喺作業系統嘅密碼庫入面。'
);
s('bot.form.preview', 'What will be written', 'What is about to hit disk', '將寫入嘅內容', '即刻要落硬碟嘅嘢');
s(
  'bot.form.preview.help',
  'Exactly the configuration file the scraper will read, with the password replaced by a marker.',
  'The exact configuration file the scraper is about to read — password swapped for a marker so nobody has to look at it.',
  '爬蟲程式將要讀取嘅確實配置檔內容，密碼部分以標記代替。',
  '爬蟲即刻要讀嗰份配置檔，一字不漏，密碼就換咗個記號頂住。'
);

/* ================================================================== */
/* Profile form — connection fields                                    */
/* ================================================================== */

s('bot.field.name', 'Profile name', 'What to call it', '設定檔名稱', '幫佢改個名');
s(
  'bot.field.name.help',
  'Shown in the profile list and in the run log.',
  'Shows up in the profile list and the run log, so make it one you recognise.',
  '會顯示喺設定檔列表同運行日誌入面。',
  '會喺設定檔列表同運行日誌度出現，改個認得出嘅。'
);
s('bot.field.scraperDirectory', 'Scraper folder for this profile', 'Where this profile’s scraper lives', '此設定檔嘅爬蟲資料夾', '呢個設定檔嘅爬蟲屋企');
s(
  'bot.field.scraperDirectory.help',
  'The folder containing scrape.js. Leave it empty to use the folder set in the feature settings.',
  'The folder holding scrape.js. Leave it blank and it borrows the folder set in the feature settings.',
  '包含 scrape.js 嘅資料夾。留空即使用功能設定中指定嘅資料夾。',
  '裝住 scrape.js 嘅資料夾。留白就借用功能設定入面嗰個。'
);
s(
  'bot.field.notes',
  'Notes',
  'The scratchpad',
  '備註',
  '雜記欄'
);
s(
  'bot.field.notes.help',
  'Anything you want to remember about this profile. Stored with it and exported with it.',
  'Whatever you want to remember about this profile — it travels with it, saved and exported alike.',
  '任何想記低嘅內容，會隨此設定檔一併儲存同匯出。',
  '想記低咩都得，會跟埋呢個設定檔一齊儲存同匯出。'
);
s('bot.field.hostPicker', 'Known proxy addresses', 'Proxies you have met before', '已知嘅代理位址', '見過面嘅代理位址');
s('bot.field.host', 'Proxy address', 'Proxy address', '代理伺服器位址', '代理伺服器位址');
s(
  'bot.field.host.help',
  'The address of the running downloader proxy, never the real server. The proxy is what saves the chunks.',
  'The address of the running downloader proxy — never the real server. The proxy is the one actually keeping the chunks.',
  '正在運行嘅下載器代理位址，並非真正嘅伺服器。真正儲存區塊嘅係代理伺服器。',
  '係跑緊嗰個下載器代理嘅位址，唔係真正個伺服器。真正儲低區塊嘅係代理。'
);
s('bot.field.port', 'Proxy port', 'Proxy port', '代理伺服器埠號', '代理伺服器埠號');
s(
  'bot.field.port.help',
  'The port the downloader listens on for players, not the port it connects out on.',
  'The port the downloader listens on for players — not the one it dials out on.',
  '下載器監聽玩家連線嘅埠號，並非其向外連接嘅埠號。',
  '下載器等玩家嚟接嗰個埠，唔係佢打出去嗰個。'
);
s('bot.field.version', 'Protocol version', 'Protocol version', '協議版本', '協議版本');
s('bot.field.version.auto', 'Detect automatically', 'Let it figure itself out', '自動偵測', '畀佢自己諗掂佢');
s('bot.field.versionCustom', 'Or type a version', 'Or just type one in', '或輸入版本號', '定係自己打個版本入去');
s(
  'bot.field.versionCustom.help',
  'Leave it empty to let the bot negotiate the version with the server.',
  'Leave it blank and let the bot and server sort out the version between themselves.',
  '留空以讓機械人自行與伺服器協商版本。',
  '留白就由機械人同伺服器自己傾掂條數。'
);

/* ================================================================== */
/* Version picker note                                                 */
/* ================================================================== */

s(
  'bot.version.noDirectory',
  'Set the scraper folder to read the installed version list.',
  'Point at the scraper folder first and the installed version list turns up.',
  '設定爬蟲資料夾以讀取已安裝嘅版本列表。',
  '揸埋爬蟲資料夾先，先睇到裝咗乜嘢版本。'
);
s(
  'bot.version.notReadable',
  'The installed version list could not be read.',
  'The installed version list would not open up.',
  '無法讀取已安裝嘅版本列表。',
  '裝咗乜版本睇唔到喎。'
);
s('bot.version.fromInstall', 'Read from the scraper folder.', 'Straight from the scraper folder.', '讀取自爬蟲資料夾。', '直接由爬蟲資料夾攞返嚟嘅。');
s(
  'bot.version.count',
  '{count} version(s) available. {note}',
  '{count} version(s) on the shelf. {note}',
  '有 {count} 個版本可用。{note}',
  '貨架上有 {count} 個版本。{note}'
);

/* ================================================================== */
/* Accounts                                                             */
/* ================================================================== */

s('bot.field.auth', 'Sign-in method', 'How they clock in', '登入方式', '點打卡');
s('bot.field.auth.offline', 'Offline name', 'Offline name', '離線名稱', '離線名稱');
s('bot.field.auth.microsoft', 'Microsoft account', 'Microsoft account', 'Microsoft 帳戶', 'Microsoft 帳戶');
s('bot.accounts.list', 'Accounts, one bot each', 'The crew, one seat each', '帳戶，一機械人一個', '成隊人，一人一個位');
s('bot.accounts.add', 'Add an account', 'Sign up another one', '新增帳戶', '搵多個嚟入伙');
s(
  'bot.accounts.generate',
  'Number the offline names',
  'Slap numbers on the offline names',
  '為離線名稱編號',
  '幫離線名逐個編號'
);
s(
  'bot.accounts.generateReason',
  'Microsoft accounts sign in by email, so they cannot be numbered.',
  'Microsoft accounts sign in by email — numbering them would just be confusing.',
  'Microsoft 帳戶以電郵登入，因此無法編號。',
  'Microsoft 帳戶用電郵登入，冇得編號㗎。'
);
s('bot.accounts.noneSelected', 'No account is selected.', 'Nobody is picked yet.', '未選取任何帳戶。', '一個都未揀。');
s(
  'bot.accounts.lastOne',
  'A profile needs at least one account, so they cannot all be removed.',
  'A profile needs at least one account left standing — cannot clear the whole crew.',
  '一個設定檔至少需要一個帳戶，因此不能全部移除。',
  '設定檔起碼要留一個帳戶，唔可以成隊人走晒。'
);
s(
  'bot.accounts.removeSelected',
  'Remove selected accounts',
  'Boot the selected accounts',
  '移除已選帳戶',
  '踢走揀咗嗰啲帳戶'
);
s('bot.accounts.select', 'Select account {position}', 'Tag account {position}', '選取第 {position} 個帳戶', '揀第 {position} 個帳戶');
s(
  'bot.accounts.offlineName',
  'Offline name for bot {position}',
  'What bot {position} goes by offline',
  '第 {position} 個機械人嘅離線名稱',
  '第 {position} 隻機械人離線嗰陣叫咩'
);
s(
  'bot.accounts.microsoftName',
  'Microsoft sign-in address for bot {position}',
  'Bot {position}’s Microsoft email',
  '第 {position} 個機械人嘅 Microsoft 登入電郵',
  '第 {position} 隻機械人嘅 Microsoft 電郵'
);
s(
  'bot.accounts.removeOne',
  'Remove account {position}',
  'Show account {position} the door',
  '移除第 {position} 個帳戶',
  '請第 {position} 個帳戶行人'
);
s(
  'bot.accounts.microsoftNote',
  'The first Microsoft sign-in prints a device code in the run log. Enter it in a browser once; the token is then cached per account.',
  'The first Microsoft sign-in drops a device code into the run log. Type it into a browser once, and the token sticks around after that.',
  '首次 Microsoft 登入會喺運行日誌中顯示裝置代碼。喺瀏覽器輸入一次即可；之後令牌會按帳戶快取。',
  '第一次 Microsoft 登入會喺運行日誌印個裝置代碼出嚟，去瀏覽器打一次就得，之後個令牌會幫個帳戶記住㗎喇。'
);

/* ================================================================== */
/* Area                                                                 */
/* ================================================================== */

s('bot.field.areaMode', 'Area to cover', 'Turf to cover', '要覆蓋嘅範圍', '要行嘅地皮');
s('bot.field.areaMode.center', 'Centre and radius', 'Centre and radius', '中心點及半徑', '中心點同半徑');
s('bot.field.areaMode.bbox', 'Bounding box', 'A drawn-out box', '邊界範圍', '劃個框出嚟');
s('bot.field.areaMode.spawn', 'Around each spawn', 'Wherever each bot lands', '每個重生點周圍', '每隻落地嗰度周圍');
s(
  'bot.field.areaMode.spawnNote',
  'Each bot builds its own grid around wherever it spawns, so the grid is not split between them.',
  'Each bot draws its own grid around wherever it happens to land — nobody shares.',
  '每個機械人會圍繞自己嘅重生點建立獨立網格，網格不會於機械人之間共用。',
  '每隻機械人喺自己落地嗰度自己劃個網格，唔會同人夾份。'
);
s('bot.field.centerX', 'Centre X', 'Centre X', '中心點 X', '中心 X');
s('bot.field.centerZ', 'Centre Z', 'Centre Z', '中心點 Z', '中心 Z');
s('bot.field.minX', 'Minimum X', 'Minimum X', '最小 X', '最細 X');
s('bot.field.minZ', 'Minimum Z', 'Minimum Z', '最小 Z', '最細 Z');
s('bot.field.maxX', 'Maximum X', 'Maximum X', '最大 X', '最大 X');
s('bot.field.maxZ', 'Maximum Z', 'Maximum Z', '最大 Z', '最大 Z');
s('bot.field.radius', 'Radius', 'How far out', '半徑', '行幾遠');
s(
  'bot.field.radius.help',
  'Measured in blocks from the centre, so 256 covers a 512 by 512 square.',
  'Counted in blocks out from the centre — 256 gets you a tidy 512 by 512 square.',
  '以方塊為單位，由中心點量度，256 即覆蓋 512 乘 512 嘅正方形。',
  '由中心度計方塊數，256 就係 512 乘 512 個正方形嘞。'
);
s('bot.field.chunkStep', 'Visit every Nth chunk', 'Skip-count the chunks', '每隔 N 個區塊造訪一次', '每隔 N 個區塊行一次');
s(
  'bot.field.chunkStep.help',
  '1 visits every chunk. A larger step covers ground faster and leaves gaps.',
  '1 hits every chunk. Crank it up and you cover ground quicker, but leave gaps behind.',
  '1 代表造訪每一個區塊。步數愈大，覆蓋速度愈快，但會留低空隙。',
  '1 就係逐格行晒。行大步啲就快啲行完，但會漏低啲窿。'
);

/* ================================================================== */
/* Movement                                                             */
/* ================================================================== */

s(
  'bot.field.flyWhenAble',
  'Fly the grid in creative and spectator',
  'Take to the air in creative and spectator',
  '在創造模式及旁觀者模式中飛行覆蓋網格',
  '創造模式同旁觀模式就飛住去行'
);
s(
  'bot.field.preferFly',
  'In creative, fly rather than walk',
  'In creative, wings over legs',
  '在創造模式中優先選用飛行而非行走',
  '創造模式就寧願飛，唔行路'
);
s(
  'bot.field.preferFly.reason',
  'Flying is turned off, so there is nothing to prefer.',
  'Flying is switched off, so there is no wings-versus-legs debate to have.',
  '飛行功能已關閉，因此沒有優先選項可言。',
  '飛行都熄咗，冇得揀住飛唔飛喇。'
);
s(
  'bot.field.walkWhenGrounded',
  'Walk the grid in survival and adventure',
  'Foot it in survival and adventure',
  '在生存模式及冒險模式中行走覆蓋網格',
  '生存模式同冒險模式就行路行'
);
s('bot.field.flyAltitude', 'Flying altitude', 'Cruising altitude', '飛行高度', '巡航高度');
s(
  'bot.field.flyAltitude.reason',
  'Flying is turned off, so the altitude is not used.',
  'Flying is off, so this altitude is just for show.',
  '飛行功能已關閉，故此高度設定未被使用。',
  '飛行熄咗，呢個高度擺喺度得個睇字。'
);
s('bot.field.arriveRadius', 'Counts as arrived within', 'Close enough counts as arrived within', '在此範圍內即視為已到達', '入到呢個範圍就當到咗');

/* ================================================================== */
/* Timing                                                               */
/* ================================================================== */

s('bot.field.waypointTimeoutMs', 'Give up on a waypoint after', 'Cut losses on a waypoint after', '此時間後放棄路徑點', '過咗呢個鐘就唔等呢個路徑點');
s(
  'bot.field.waypointTimeoutMs.help',
  'A waypoint that times out is marked visited and skipped rather than retried forever.',
  'A waypoint that runs out the clock gets marked done and skipped — no chasing it forever.',
  '逾時嘅路徑點會被標記為已造訪並跳過，不會無限重試。',
  '等到鐘嘅路徑點就當去咗跳過算，唔會纏住佢唔放。'
);
s('bot.field.loadWaitMs', 'Pause at each chunk', 'Dawdle at each chunk', '每個區塊嘅停留時間', '每個區塊停幾耐');
s(
  'bot.field.loadWaitMs.help',
  'Long enough for the proxy to receive and write the chunk before the bot moves on.',
  'Just long enough for the proxy to catch and write the chunk before the bot wanders off.',
  '足夠讓代理伺服器接收並寫入區塊，然後機械人才繼續前進。',
  '要夠耐畀代理收低寫低個區塊，機械人先可以郁下一步。'
);
s('bot.field.containerDwellMs', 'Extra pause for containers', 'A little extra for the containers', '容器額外停留時間', '開箱多等陣先');
s(
  'bot.field.containerDwellMs.help',
  'Only worth setting when the downloader is opening containers automatically. 400 to 800 ms is the usual range.',
  'Only worth bothering with when the downloader is auto-opening containers. 400 to 800 ms is the usual sweet spot.',
  '只有在下載器自動開啟容器時才值得設定，一般為 400 至 800 毫秒。',
  '淨係下載器自動開箱嗰陣先使得着，一般就 400 到 800 毫秒左右。'
);
s('bot.field.finalDrainMs', 'Stay connected after finishing', 'Linger a bit after finishing', '完成後保持連線', '做完都唔即刻走');
s(
  'bot.field.finalDrainMs.help',
  'Gives the proxy time to flush the last chunk and container writes before the bots leave.',
  'Buys the proxy a moment to flush the last chunk and container writes before the bots wander off.',
  '讓代理伺服器有時間在機械人離開前寫入最後嘅區塊同容器資料。',
  '畀代理夠時間喺機械人走之前，寫晒最後嗰啲區塊同容器資料。'
);
s('bot.field.loginStaggerMs', 'Wait between starting each bot', 'A beat between each bot’s entrance', '每個機械人啟動之間嘅等待時間', '每隻機械人出場相隔幾耐');
s('bot.field.stuckCheckMs', 'Check for a stuck bot every', 'Poke a stuck bot every', '每隔此時間檢查機械人是否卡住', '隔幾耐睇下有冇機械人卡咗');
s(
  'bot.field.stuckEpsilon',
  'Counts as progress if it moved',
  'Counts as progress once it has budged',
  '移動超過此距離即視為有進展',
  '郁咗呢個距離先當有進度'
);

/* ================================================================== */
/* Deduplication                                                       */
/* ================================================================== */

s('bot.field.visitedFile', 'Visited chunk cache', 'The been-there list', '已造訪區塊快取', '去過嗰張清單');
s(
  'bot.field.visitedFile.help',
  'Where the list of already captured chunks is kept, so a re-run skips them. Empty keeps it in the application data folder.',
  'Where the been-there list lives, so a re-run skips what is already done. Leave it blank and it stays in the application data folder.',
  '已捕獲區塊清單嘅儲存位置，重新運行時會跳過該等區塊。留空則儲存於應用程式資料資料夾。',
  '影過相嗰啲區塊清單擺喺邊，重跑就跳過佢哋。留白就擺喺程式資料資料夾入面。'
);
s(
  'bot.field.revisit',
  'Ignore the cache and walk everything again',
  'Forget the cache and do it all again for fun',
  '忽略快取並重新走訪全部區塊',
  '唔理個快取，成個範圍再行多次'
);

/* ================================================================== */
/* Login / password                                                    */
/* ================================================================== */

s(
  'bot.field.autoLogin',
  'Register and log in automatically',
  'Sign up and clock in automatically',
  '自動註冊並登入',
  '自動幫你註冊同打卡'
);
s('bot.field.password', 'Server login password', 'The server’s secret handshake', '伺服器登入密碼', '伺服器嘅暗號');
s(
  'bot.field.password.help',
  'Used only for servers running an AuthMe-style login plugin. It goes straight into the credential vault and is never read back to this screen.',
  'Only needed for servers running an AuthMe-style login plugin. It goes straight into the credential vault and never comes back to haunt this screen.',
  '僅適用於運行 AuthMe 式登入外掛嘅伺服器。密碼會直接存入憑證儲存庫，並不會顯示返呢個畫面。',
  '淨係用喺行 AuthMe 式登入外掛嘅伺服器。密碼直入密碼庫，唔會再喺呢版度現形。'
);
s('bot.field.password.store', 'Store the password', 'Lock the password away', '儲存密碼', '收埋個密碼');
s(
  'bot.field.password.stored',
  'A password is stored in this computer’s credential vault for this profile. It is written into the generated configuration file only while a run is going, and never shown here.',
  'A password is tucked away in this computer’s credential vault for this profile. It only surfaces inside the generated configuration file while a run is going, and never here.',
  '此電腦嘅憑證儲存庫中已為此設定檔儲存密碼，只會喺運行期間寫入生成嘅配置檔，並不會顯示喺此處。',
  '呢部機嘅密碼庫已經幫呢個設定檔收咗個密碼，淨係喺跑緊嗰陣先寫入配置檔，呢度永遠唔會見到。'
);
s(
  'bot.field.password.absent',
  'No password is stored for this profile.',
  'This profile is keeping no secrets — literally, no password at all.',
  '此設定檔未儲存任何密碼。',
  '呢個設定檔冇密碼收埋。'
);
s('bot.field.password.emptyTitle', 'Nothing to store', 'Nothing here to lock away', '沒有可儲存嘅內容', '冇嘢好收');
s(
  'bot.field.password.empty',
  'Type the password into the field first. Nothing was changed.',
  'Type something into the field first — nothing budged.',
  '請先在欄位中輸入密碼，未有任何變更。',
  '先打個密碼落個格入面，而家乜都未改過。'
);
s('bot.field.password.failedTitle', 'The password was not stored', 'The password would not stick', '密碼未能儲存', '密碼收唔到喎');
s('bot.field.password.storedTitle', 'Password stored', 'Password locked away', '密碼已儲存', '密碼收好晒');
s(
  'bot.field.password.storedBody',
  'It is held in the credential vault and never written to the settings file.',
  'Filed away in the credential vault, never anywhere near the settings file.',
  '密碼儲存於憑證儲存庫，永不會寫入設定檔案。',
  '密碼收咗喺密碼庫，永遠都唔會走入設定檔。'
);
s('bot.field.password.remove', 'Remove the stored password', 'Wipe the stored password', '移除已儲存嘅密碼', '刪走收埋咗嗰個密碼');
s(
  'bot.field.password.removeAction',
  'Remove the stored login password for {name}',
  'Wipe {name}’s stored password',
  '移除 {name} 已儲存嘅登入密碼',
  '刪走 {name} 收埋嗰個登入密碼'
);
s(
  'bot.field.password.removeIrreversible',
  'The password is deleted from the credential vault. It cannot be read back afterwards and must be typed again.',
  'The password is gone from the credential vault for good — it must be typed in fresh next time.',
  '密碼將由憑證儲存庫刪除，之後無法讀取，必須重新輸入。',
  '密碼由密碼庫剷走，之後睇唔返，要重新打過。'
);

/* ================================================================== */
/* Form feedback                                                       */
/* ================================================================== */

s(
  'bot.form.noProblems',
  'Every field is usable. This profile can start a run.',
  'Every field checks out — this profile is ready to go.',
  '所有欄位均可使用，此設定檔可以開始運行。',
  '每格都掂晒，呢個設定檔可以出發喇。'
);
s(
  'bot.form.problems',
  '{count} field needs attention',
  '{count} field is waving for attention',
  '{count} 個欄位需要處理',
  '{count} 個位仲要理下'
);
s(
  'bot.form.estimate',
  'About {chunks} chunks across {spanX} by {spanZ} blocks, shared between {bots} bot(s).',
  'Roughly {chunks} chunks over a {spanX} by {spanZ} block patch, split between {bots} bot(s).',
  '大約 {chunks} 個區塊，橫跨 {spanX} 乘 {spanZ} 個方塊，由 {bots} 個機械人分擔。',
  '差唔多 {chunks} 個區塊，成塊 {spanX} 乘 {spanZ} 咁大，畀 {bots} 隻機械人分工。'
);
s(
  'bot.form.estimateSpawn',
  'Each bot covers about {chunks} chunks around wherever it spawns, so the total depends on where they land.',
  'Each bot covers roughly {chunks} chunks around wherever it happens to land — the grand total is anyone’s guess.',
  '每個機械人覆蓋其重生點周圍約 {chunks} 個區塊，總數視乎落地位置而定。',
  '每隻機械人喺自己落地嗰度周圍行返 {chunks} 個區塊，總數就要睇落邊。'
);
s(
  'bot.form.create',
  'Create the profile',
  'Bring the profile to life',
  '建立設定檔',
  '整個設定檔出嚟'
);
s('bot.form.createdTitle', 'Profile created', 'Profile born', '設定檔已建立', '設定檔出世喇');
s(
  'bot.form.savedBody',
  '{name} is stored and can be started, edited or exported.',
  '{name} is filed away, ready to run, edit or ship out whenever.',
  '{name} 已儲存，可以隨時啟動、編輯或匯出。',
  '{name} 收咗喺度喇，隨時可以放行、改或者寄走。'
);
s('bot.form.savedTitle', 'Profile saved', 'Profile tucked in', '設定檔已儲存', '設定檔安置好喇');

/* ================================================================== */
/* Presets                                                              */
/* ================================================================== */

s('bot.presets.title', 'Start from a preset', 'Grab a ready-made preset', '從預設開始', '揸個現成套餐');
s(
  'bot.presets.help',
  'Every preset starts from the scraper’s own compiled-in defaults and changes only the fields it lists. The result is an ordinary profile you can edit.',
  'Every preset starts from the scraper’s own baked-in defaults and only tweaks what it says it will. What comes out is an ordinary profile, free to edit.',
  '每個預設均以爬蟲程式內建嘅預設值為基礎，僅更改所列出嘅欄位。結果係一個可自由編輯嘅一般設定檔。',
  '每個套餐都由爬蟲自己內建嗰套開始，淨係改返自己講明嘅嗰幾格。整返嚟嘅係個普通設定檔，任你郁。'
);
s('bot.presets.use', 'Use this preset', 'Grab this one', '使用此預設', '就用呢套');
s(
  'bot.presets.applied',
  'The preset {preset} was applied. Every field is still editable.',
  'The {preset} preset has moved in. Every field is still yours to change.',
  '已套用預設 {preset}，所有欄位仍可編輯。',
  '{preset} 呢個套餐已經入咗嚟，仲係任你改嘅。'
);

/* ================================================================== */
/* Run log                                                              */
/* ================================================================== */

s('bot.log.title', 'Run log', 'The play-by-play', '運行日誌', '逐格解說');
s(
  'bot.log.help',
  'Every line the scraper wrote, verbatim. The severity is read from the line and from which stream it came out of; the text itself is never rewritten.',
  'Every line the scraper wrote, word for word. Severity is guessed from the line and the stream it came out of; the text itself never gets rewritten.',
  '爬蟲程式輸出嘅每一行，原文照錄。嚴重程度按行內容及所屬串流判斷；文字內容永不會被改寫。',
  '爬蟲印乜就記乜，一隻字都冇改。輕重就照行文同嚟自邊條串流嚟判斷，文字本身永遠原汁原味。'
);
s('bot.log.search', 'Search the run log', 'Dig through the run log', '搜尋運行日誌', '喺運行日誌度掘嘢');
s('bot.log.severity', 'Severity filter', 'Pick your drama level', '嚴重程度篩選', '揀睇邊個級數');
s('bot.log.follow', 'Follow the newest line', 'Chase the newest line', '跟隨最新一行', '追住最新嗰行');
s('bot.log.clear', 'Clear the view', 'Wipe the view clean', '清除畫面', '洗返乾淨個畫面');
s(
  'bot.log.cleared',
  'The run log view was emptied. Captured messages were not touched.',
  'The run log view is now spotless. Captured messages were never in danger.',
  '運行日誌畫面已清空，已捕獲嘅訊息未受影響。',
  '運行日誌個畫面洗晒喇，捕獲咗嘅訊息冇郁過。'
);
s('bot.log.export', 'Export the shown lines', 'Ship out what is on screen', '匯出顯示嘅行', '將顯示緊嘅行寄走');
s('bot.log.region', 'Run log', 'The play-by-play', '運行日誌', '逐格解說');
s('bot.log.what', 'log lines', 'log lines', '日誌行', '日誌行');
s(
  'bot.log.empty',
  'Nothing has run yet. Start a profile and the scraper’s own output appears here as it arrives.',
  'Nothing has happened yet. Kick off a profile and the scraper’s chatter shows up here live.',
  '仲未有運行紀錄。啟動一個設定檔後，爬蟲程式嘅輸出便會即時顯示喺此處。',
  '仲未跑過嘢。開返個設定檔，爬蟲一有嘢講就即刻喺度出。'
);
s(
  'bot.log.count',
  '{shown} of {total} line(s) shown.',
  '{shown} of {total} line(s) on display.',
  '顯示 {total} 行中嘅 {shown} 行。',
  '{total} 行入面而家睇緊 {shown} 行。'
);
s(
  'bot.log.windowed',
  'Showing the newest {shown} of {total} matching line(s); {held} line(s) are held in memory.',
  'Showing the freshest {shown} of {total} matching line(s); {held} line(s) are stashed in memory.',
  '顯示符合條件嘅最新 {shown} 行，共 {total} 行相符；記憶體中保留咗 {held} 行。',
  '顯緊最新 {shown} 行，符合嘅成共 {total} 行；記憶體度收埋咗 {held} 行。'
);

/* ================================================================== */
/* Captured messages                                                   */
/* ================================================================== */

s('bot.messages.title', 'Captured messages', 'The catch of the day', '已捕獲訊息', '今日網到嘅嘢');
s(
  'bot.messages.help',
  'Lines a capture rule matched, kept as rows you can sort, filter, tag, export and delete. Every row states which run or file it came from.',
  'Lines a capture rule caught, filed as rows you can sort, filter, tag, export and bin. Every row says exactly where it came from.',
  '符合捕獲規則嘅行會以列表形式保留，可供排序、篩選、標記、匯出同刪除。每一列均標明來源運行或檔案。',
  '啱嗮規則嘅行就變成一行行紀錄，任你排序、篩選、貼標籤、匯出定刪走。每行都寫住嚟自邊次運行定邊個檔。'
);
s('bot.messages.search', 'Search captured messages', 'Rummage through the catch', '搜尋已捕獲訊息', '喺網到嘅嘢度搵');
s('bot.messages.channel', 'Channel', 'Channel', '頻道', '頻道');
s('bot.channel.all', 'Every channel', 'The whole lot of channels', '所有頻道', '成晒啲頻道');
s(
  'bot.messages.emptyTitle',
  'Nothing captured yet',
  'The net is still empty',
  '仲未捕獲任何訊息',
  '個網仲係吉嘅'
);
s(
  'bot.messages.emptyBody',
  'Rows appear here when a capture rule matches a line the scraper printed. The scraper as shipped reports sign-in, progress, kicks and errors; it does not echo server chat, so chat rows come from a server or console log you import.',
  'Rows show up here whenever a capture rule catches a line the scraper printed. Out of the box it reports sign-in, progress, kicks and errors — it does not echo server chat, so chat rows need a server or console log imported.',
  '當捕獲規則配對爬蟲程式輸出嘅某一行，該行便會顯示於此。原廠爬蟲會回報登入、進度、被踢及錯誤，但不會複述伺服器聊天訊息；聊天訊息需透過匯入伺服器或主控台日誌取得。',
  '爬蟲印嘅嘢一啱條規則就會變成一行喺呢度出現。原裝爬蟲會報登入、進度、被踢同錯誤，但唔會覆述伺服器嘅傾偈；想要傾偈紀錄就要自己匯入伺服器或者主控台日誌。'
);
s('bot.messages.selectShown', 'Select the {count} shown', 'Grab all {count} on screen', '選取顯示嘅 {count} 個', '將顯示緊嘅 {count} 個攞晒');
s('bot.messages.selectEvery', 'Select all {count} captured', 'Grab the whole catch — {count} of them', '選取全部 {count} 個已捕獲項目', '成網 {count} 個全部攞晒');
s('bot.messages.noSelection', 'No message is selected.', 'Nothing is picked yet.', '未選取任何訊息。', '一個都未揀。');
s('bot.messages.none', 'Nothing has been captured yet.', 'The net is still empty.', '仲未捕獲任何訊息。', '仲未網到嘢。');
s('bot.messages.noneShown', 'The current filter shows no messages.', 'The filter is hiding every message.', '目前篩選條件冇顯示任何訊息。', '而家嘅篩選乜訊息都冇顯示到。');
s(
  'bot.messages.copied',
  '{count} message(s) copied to the clipboard.',
  '{count} message(s) whisked onto the clipboard.',
  '已複製 {count} 個訊息至剪貼簿。',
  '{count} 個訊息已經抄咗落剪貼簿。'
);
s('bot.messages.copiedTitle', 'Copied', 'Copied', '已複製', '複製咗喇');
s('bot.messages.copyFailedTitle', 'Nothing was copied', 'Copying went nowhere', '未有複製任何內容', '乜都複製唔到');
s('bot.messages.tagAction', 'Tag selected', 'Sticker the selected ones', '標記已選項目', '幫揀咗嘅貼貼紙');
s('bot.messages.untagAction', 'Untag selected', 'Peel the sticker off', '取消標記已選項目', '同揀咗嘅撕貼紙');
s('bot.messages.tagAddTitle', 'Tag the selected messages', 'Sticker the selected messages', '標記已選訊息', '幫揀咗嘅訊息貼貼紙');
s(
  'bot.messages.tagRemoveTitle',
  'Remove a tag from the selected messages',
  'Peel a tag off the selected messages',
  '從已選訊息中移除標記',
  '幫揀咗嘅訊息撕走個標籤'
);
s('bot.messages.tagExisting', 'A tag already in use', 'A tag already doing the rounds', '已使用嘅標記', '已經用緊嗰啲標籤');
s('bot.messages.tagName', 'Tag', 'Tag', '標記', '標籤');
s(
  'bot.messages.tagHelp',
  'Tags are your own labels. They are stored with the message and exported with it.',
  'Tags are entirely your own labels — they ride along with the message, saved and exported alike.',
  '標記係您自訂嘅標籤，會隨訊息一併儲存及匯出。',
  '標籤係你自己嘅招牌，會跟住訊息一齊儲存同匯出。'
);
s('bot.messages.tagAdd', 'Add the tag', 'Slap the tag on', '新增標記', '貼上標籤');
s('bot.messages.tagRemove', 'Remove the tag', 'Peel the tag off', '移除標記', '撕走標籤');
s('bot.messages.tagEmptyTitle', 'No tag was given', 'No tag turned up', '未提供標記', '冇畀到標籤');
s(
  'bot.messages.tagEmpty',
  'Type a tag first. Nothing was changed.',
  'Type something first — nothing budged.',
  '請先輸入標記，未有任何變更。',
  '先打個標籤啦，乜都未改過。'
);
s(
  'bot.messages.tagged',
  '{changed} of {selected} selected message(s) changed.',
  '{changed} of {selected} selected message(s) got the sticker.',
  '已選 {selected} 個訊息中，{changed} 個已變更。',
  '揀咗嘅 {selected} 個入面，{changed} 個貼咗喇。'
);
s('bot.messages.taggedTitle', 'Tagged', 'Stickered', '已標記', '貼咗喇');
s('bot.messages.untaggedTitle', 'Tag removed', 'Sticker peeled', '標記已移除', '標籤撕走咗');
s('bot.messages.exportShown', 'Export the shown rows', 'Ship out what is on screen', '匯出顯示嘅列', '將顯示緊嘅列寄走');
s('bot.messages.exportSelected', 'Export selected', 'Ship out the chosen ones', '匯出已選項目', '將揀咗嘅寄走');
s('bot.messages.deleteSelected', 'Delete selected', 'Bin the chosen ones', '刪除已選項目', '丟走揀咗嘅');
s(
  'bot.messages.deleteAction',
  'Delete {count} captured message(s)',
  'Bin {count} captured message(s)',
  '刪除 {count} 個已捕獲訊息',
  '丟走 {count} 個捕獲咗嘅訊息'
);
s(
  'bot.messages.deleteIrreversible',
  'The messages are removed from the stored table. They can only come back by running the scraper again or importing a log file that still contains them.',
  'The messages are gone from the stored table. They only come back by running the scraper again, or re-importing a log file that still has them.',
  '訊息將由儲存嘅列表中移除，只可透過重新運行爬蟲程式或匯入仍載有該等訊息嘅日誌檔案取回。',
  '訊息由列表度剷走，要返嚟就要再跑一次爬蟲，或者匯返個仲有佢哋嘅日誌檔。'
);
s('bot.messages.deletedTitle', 'Messages deleted', 'Messages binned', '訊息已刪除', '訊息丟走咗');
s(
  'bot.messages.deleted',
  '{count} message(s) removed.',
  '{count} message(s) sent packing.',
  '已移除 {count} 個訊息。',
  '{count} 個訊息冇咗喇。'
);
s(
  'bot.messages.clearAll',
  'Clear every captured message',
  'Wipe the whole catch clean',
  '清除所有已捕獲訊息',
  '成網嘢一次過洗晒'
);
s(
  'bot.messages.clearAction',
  'Clear every captured message ({count})',
  'Wipe the whole catch clean ({count})',
  '清除所有 {count} 個已捕獲訊息',
  '成網 {count} 個一次過洗晒'
);
s(
  'bot.messages.clearAffected',
  'Every captured message, from every run and every imported file',
  'Every last message, from every run and every imported file',
  '所有已捕獲訊息，來自每次運行及每個匯入嘅檔案',
  '所有捕獲咗嘅訊息，唔理係邊次跑定邊個匯入檔'
);
s(
  'bot.messages.clearIrreversible',
  'The whole table is emptied, including rows the current filter is hiding. Profiles, the run log and the visited chunk cache are left alone.',
  'The whole table gets emptied out, filter-hidden rows included. Profiles, the run log and the visited chunk cache stay exactly where they were.',
  '整個列表將被清空，包括目前篩選條件隱藏嘅列。設定檔、運行日誌及已造訪區塊快取則不受影響。',
  '成張表洗清光，連篩選緊冇顯示嘅都一齊冚。設定檔、運行日誌同去過區塊快取就冇事。'
);
s('bot.messages.clearedTitle', 'Table cleared', 'Table wiped spotless', '列表已清除', '張表洗到閃令令');
s(
  'bot.messages.cleared',
  '{count} message(s) removed.',
  '{count} message(s) swept away.',
  '已移除 {count} 個訊息。',
  '{count} 個訊息掃走咗。'
);
s('bot.messages.import', 'Import a log file', 'Feed it a log file', '匯入日誌檔案', '餵佢一份日誌檔');
s('bot.messages.importTitle', 'Choose a log file to read', 'Pick a log file to feed it', '選擇要讀取嘅日誌檔案', '揀份日誌檔畀佢食');
s('bot.messages.importFailedTitle', 'The file was not read', 'The file would not open up', '未能讀取檔案', '個檔案讀唔到');
s(
  'bot.messages.importNothingTitle',
  'Nothing matched in that file',
  'That file gave up nothing',
  '該檔案中沒有相符內容',
  '嗰個檔一啲都撈唔到嘢'
);
s(
  'bot.messages.importNothing',
  '{lines} line(s) were read and no capture rule matched any of them. Adjust a rule below, or add one, and import again.',
  '{lines} line(s) went by and not one capture rule bit. Tweak a rule below, or add a fresh one, and try the import again.',
  '已讀取 {lines} 行，但無任何捕獲規則相符。請調整下方規則或新增規則，然後重新匯入。',
  '睇咗 {lines} 行，一條規則都冧唔到。落面改條規則定加條新嘅，再匯過先。'
);
s(
  'bot.messages.imported',
  '{captured} message(s) captured from {lines} line(s).',
  '{captured} message(s) reeled in from {lines} line(s).',
  '已由 {lines} 行中捕獲 {captured} 個訊息。',
  '由 {lines} 行度網到咗 {captured} 個訊息。'
);
s('bot.messages.importedTitle', 'Log file imported', 'Log file digested', '日誌檔案已匯入', '日誌檔消化咗喇');
s(
  'bot.messages.importedTrimmed',
  '{captured} message(s) captured from {lines} line(s). {dropped} older row(s) were dropped to stay inside the stored message limit.',
  '{captured} message(s) reeled in from {lines} line(s). {dropped} older row(s) got tossed to stay under the storage limit.',
  '已由 {lines} 行中捕獲 {captured} 個訊息，並移除 {dropped} 個較舊嘅項目以維持儲存上限。',
  '由 {lines} 行度網到 {captured} 個訊息，仲丟咗 {dropped} 個舊嘅先夾得入儲存上限。'
);
s('bot.messages.time', 'Time', 'Time', '時間', '時間');
s(
  'bot.messages.timeCaptured',
  'The line carried no time of its own, so this is when it was captured.',
  'The line came with no clock of its own, so this is just when it got caught.',
  '此行本身沒有附帶時間，因此顯示嘅係捕獲時間。',
  '呢行本身冇帶時間嚟，呢個係網到佢嗰刻。'
);
s('bot.messages.sender', 'Sender', 'Sender', '發送者', '講嘢嗰個');
s('bot.messages.channelColumn', 'Channel', 'Channel', '頻道', '頻道');
s('bot.messages.message', 'Message', 'Message', '訊息', '訊息');
s('bot.messages.tags', 'Tags', 'Tags', '標記', '標籤');
s('bot.messages.table', 'Captured messages', 'The catch of the day', '已捕獲訊息', '今日網到嘅嘢');
s(
  'bot.messages.count',
  '{shown} of {total} captured message(s) shown, {selected} selected.',
  '{shown} of {total} captured message(s) on screen, {selected} picked out.',
  '已顯示 {total} 個已捕獲訊息中嘅 {shown} 個，已選取 {selected} 個。',
  '{total} 個捕獲咗嘅入面睇緊 {shown} 個，揀咗 {selected} 個。'
);
s('bot.messages.what', 'captured messages', 'captured messages', '已捕獲訊息', '網到嘅訊息');

/* ================================================================== */
/* Capture rules                                                       */
/* ================================================================== */

s('bot.rules.title', 'Capture rules', 'The catching rules', '捕獲規則', '網嘢規則');
s(
  'bot.rules.help',
  'A line becomes a captured message only when one of these patterns matches it. The shipped rules match the shapes the bundled scraper genuinely prints; add your own for a server or console log format.',
  'A line only becomes a captured message when one of these patterns bites. The shipped rules match exactly what the bundled scraper actually prints; add your own for a server or console log shape.',
  '一行文字只有喺配對到以下其中一條規則時，才會成為已捕獲訊息。原廠規則配對內置爬蟲程式實際輸出嘅格式；亦可自行新增規則以配對伺服器或主控台日誌格式。',
  '一行嘢要啱到以下其中一條規則先會變成捕獲訊息。原廠規則係跟內置爬蟲實際印嘅格式；想撈伺服器或主控台日誌就自己加條規則。'
);
s('bot.rules.add', 'Add a rule', 'Cook up a new rule', '新增規則', '整條新規則');
s(
  'bot.rules.restore',
  'Restore the shipped rules',
  'Bring back the factory rules',
  '還原原廠規則',
  '叫返原廠規則出嚟'
);
s(
  'bot.rules.restored',
  'The rules that ship with the application are back. Rules you wrote were kept.',
  'The factory rules are back in the fold. Anything you wrote yourself stayed put.',
  '應用程式內建嘅規則已還原，您自訂嘅規則則予以保留。',
  '程式自帶嘅規則返晒嚟喇，你自己寫嗰啲冇郁過。'
);
s('bot.rules.restoredTitle', 'Shipped rules restored', 'Factory rules reinstated', '原廠規則已還原', '原廠規則歸位');
s('bot.rules.enabled', 'Use “{name}”', 'Keep “{name}” in the game', '使用「{name}」', '用緊「{name}」');
s('bot.rules.pattern', 'Pattern for “{name}”', 'The pattern behind “{name}”', '「{name}」嘅樣式', '「{name}」用嘅樣式');
s(
  'bot.rules.builder',
  'Open the pattern builder for “{name}”',
  'Pop open the pattern builder for “{name}”',
  '開啟「{name}」嘅樣式建構工具',
  '開返「{name}」嘅樣式砌製工具'
);
s('bot.rules.channel', 'Channel for “{name}”', 'Which channel “{name}” lands in', '「{name}」嘅頻道', '「{name}」會入邊個頻道');
s('bot.rules.remove', 'Remove the rule “{name}”', 'Retire the rule “{name}”', '移除規則「{name}」', '炒咗「{name}」呢條規則');
s(
  'bot.rules.removeAction',
  'Remove the capture rule “{name}”',
  'Retire the capture rule “{name}”',
  '移除捕獲規則「{name}」',
  '炒咗「{name}」呢條捕獲規則'
);
s(
  'bot.rules.removeBuiltIn',
  'A shipped rule is removed from the list. Restoring the shipped rules brings it back; messages it already captured are untouched.',
  'A factory rule leaves the list. Restoring the shipped rules brings it straight back; messages it already caught stay exactly as they were.',
  '原廠規則將由列表中移除。還原原廠規則可將其帶回；已捕獲嘅訊息不受影響。',
  '原廠規則會由清單度走。還原原廠規則就可以叫返佢出嚟；已經網到嘅訊息唔會受影響。'
);
s(
  'bot.rules.removeCustom',
  'A rule you wrote is deleted and cannot be restored. Messages it already captured are untouched.',
  'A rule you wrote is gone for good — no bringing it back. Messages it already caught are safe and sound.',
  '您自訂嘅規則將被刪除且無法還原。已捕獲嘅訊息不受影響。',
  '你自己寫嗰條規則刪咗就冇得返轉頭㗎喇。已經網到嘅訊息就冇事。'
);
s('bot.rules.newName', 'New rule', 'Fresh rule', '新規則', '新鮮出爐嘅規則');
s('bot.rules.list', 'Capture rules', 'The catching rules', '捕獲規則', '網嘢規則');

/* ================================================================== */
/* Export                                                               */
/* ================================================================== */

s('bot.export.nothingTitle', 'Nothing to export', 'Nothing to ship out', '沒有可匯出嘅內容', '冇嘢好寄');
s(
  'bot.export.nothing',
  'The current filter selects no rows, so nothing would be written.',
  'The current filter comes up empty, so there is nothing to write.',
  '目前篩選條件未選取任何列，因此不會寫入任何內容。',
  '而家嘅篩選一行都揀唔到，寫都冇嘢好寫。'
);
s(
  'bot.export.lossesTitle',
  'Some fields will not survive this format',
  'This format eats a few fields alive',
  '部分欄位在此格式下將無法保留',
  '呢個格式會食埋幾個欄位'
);
s(
  'bot.export.lossesBody',
  '{format} cannot carry every field faithfully:',
  '{format} cannot lug every field along faithfully:',
  '{format} 無法完整保留以下所有欄位：',
  '{format} 唔可以原汁原味帶埋以下啲欄位：'
);
s('bot.export.proceed', 'Write it anyway', 'Write it anyway, losses be damned', '仍然寫入', '照寫，唔理咁多喇');
s('bot.export.savedTitle', 'Exported', 'Shipped out', '已匯出', '寄走咗喇');
s(
  'bot.export.saved',
  '{count} row(s) of {what} written to {path}.',
  '{count} row(s) of {what} landed at {path}.',
  '已將 {count} 行嘅 {what} 寫入 {path}。',
  '{count} 行 {what} 已經落咗埋 {path}。'
);
s('bot.export.failedTitle', 'The export was not written', 'The export would not save', '未能寫入匯出檔案', '匯出檔案寫唔到');

/* ================================================================== */
/* Channels, phases and severities                                     */
/* ================================================================== */

s('bot.channel.chat', 'Chat', 'Chit-chat', '聊天', '吹水');
s('bot.channel.system', 'System', 'System noise', '系統', '系統聲');
s('bot.channel.auth', 'Sign-in', 'Sign-in shenanigans', '登入', '登入嗰啲事');
s('bot.channel.progress', 'Progress', 'Progress report', '進度', '進度報告');
s('bot.channel.disconnect', 'Disconnect', 'The goodbyes', '斷線', '講拜拜');
s('bot.channel.error', 'Error', 'Uh-oh', '錯誤', '出事喇');

s('bot.phase.idle', 'Idle', 'Loitering', '閒置', '匿埋唞緊');
s('bot.phase.checking', 'Checking', 'Sniffing about', '檢查中', '嗅緊嘢');
s('bot.phase.starting', 'Starting', 'Warming up', '啟動中', '熱緊身');
s('bot.phase.running', 'Running', 'Off and running', '運行中', '跑緊喇');
s('bot.phase.stopping', 'Stopping', 'Winding down', '停止中', '收緊皮');
s('bot.phase.finished', 'Finished', 'Done and dusted', '已完成', '搞掂收工');
s('bot.phase.failed', 'Failed', 'Fell over', '失敗', '瓜咗');

s('bot.severity.info', 'Info', 'FYI', '資訊', '講埋你知');
s('bot.severity.warning', 'Warning', 'Heads up', '警告', '小心啲喎');
s('bot.severity.error', 'Error', 'Uh-oh', '錯誤', '出事喇');

/* ================================================================== */
/* Settings section                                                    */
/* ================================================================== */

s('bot.settings.section', 'Scraper bot', 'Scraper bot HQ', '爬蟲機械人', '爬蟲機械人總部');
s('bot.settings.scraperDirectory', 'Default scraper folder', 'Where the scraper lives by default', '預設爬蟲資料夾', '爬蟲預設瞓喺邊');
s(
  'bot.settings.scraperDirectory.description',
  'The folder containing scrape.js, used by any profile that does not name its own scraper folder.',
  'The folder holding scrape.js — the fallback address for any profile that does not name its own.',
  '包含 scrape.js 嘅資料夾，供未指定自己爬蟲資料夾嘅設定檔使用。',
  '裝住 scrape.js 嘅資料夾，畀冇自己揸實資料夾嘅設定檔頂住先。'
);
s('bot.settings.messageLimit', 'Captured message limit', 'How big the catch can grow', '已捕獲訊息上限', '個網最多裝幾多');
s(
  'bot.settings.messageLimit.description',
  'The most captured messages kept at once. Older rows are dropped first when a run or an import would go over it.',
  'The most captured messages allowed to pile up at once. Older rows get tossed first once a run or import would spill over it.',
  '同時保留嘅已捕獲訊息數量上限，超出時會優先移除較舊嘅項目。',
  '同一時間最多留幾多個捕獲訊息，跑多咗就先丟舊嗰啲。'
);
s('bot.settings.logLimit', 'Run log limit', 'How long a memory the log keeps', '運行日誌上限', '日誌記性有幾長');
s(
  'bot.settings.logLimit.description',
  'The most run log lines kept in memory at once. Older lines are dropped first.',
  'The most run log lines allowed to hang about in memory. Older lines get shown the door first.',
  '同時保留喺記憶體中嘅運行日誌行數上限，超出時會優先移除較舊嘅行。',
  '記憶體度最多擺幾多行運行日誌，多咗就先丟舊嗰啲。'
);
s('bot.settings.followLog', 'Follow the newest run log line by default', 'Chase the newest line by default', '預設跟隨最新運行日誌行', '預設追住最新嗰行日誌');
s(
  'bot.settings.followLog.description',
  'Starting value of the run log’s “Follow the newest line” switch. Each session can still turn it off.',
  'The starting position of the run log’s “Follow the newest line” switch — still free to flip off any time.',
  '運行日誌「跟隨最新一行」開關嘅初始值，每次仍可自行關閉。',
  '運行日誌「追住最新嗰行」呢個掣嘅出廠位置，你隨時都可以熄返佢。'
);
s('bot.settings.captureFromRun', 'Capture messages while a run is going', 'Net messages while the bot is out', '運行期間捕獲訊息', '機械人出更嗰陣照網訊息');
s(
  'bot.settings.captureFromRun.description',
  'When on, every line a running scraper prints is also checked against the capture rules, not just written to the run log.',
  'When on, every line a running scraper shouts also gets checked against the capture rules — not just parked in the run log.',
  '啟用後，運行中嘅爬蟲程式輸出嘅每一行除寫入運行日誌外，亦會與捕獲規則進行配對。',
  '開咗嘅話，爬蟲跑緊嗰陣印嘅每行除咗入運行日誌，仲會攞去同捕獲規則撈吓。'
);
s('bot.settings.exportFormat', 'Default export format', 'The go-to export format', '預設匯出格式', '慣用匯出格式');
s(
  'bot.settings.exportFormat.description',
  'The file format offered first when exporting profiles, the run log or captured messages.',
  'The file format that turns up first whenever you export profiles, the run log or captured messages.',
  '匯出設定檔、運行日誌或已捕獲訊息時，預先選取嘅檔案格式。',
  '匯出設定檔、運行日誌定捕獲訊息嗰陣，一開波就揀住嗰個格式。'
);
s('bot.settings.stopSignal', 'Signal used to stop the bot', 'How the recall whistle sounds', '停止機械人所用嘅訊號', '叫佢返嚟嗰下用咩笛聲');
s(
  'bot.settings.stopSignal.description',
  'The operating system signal sent to the scraper process when you press Stop. SIGTERM asks it to shut down cleanly; SIGKILL ends it immediately with no cleanup.',
  'The operating system signal that goes to the scraper process when you hit Stop. SIGTERM asks nicely for a clean shutdown; SIGKILL just pulls the plug.',
  '按下「停止」時傳送給爬蟲程式嘅作業系統訊號。SIGTERM 要求其正常關閉；SIGKILL 則立即終止且不作清理。',
  '撳「停止」嗰陣送畀爬蟲程式嘅作業系統訊號。SIGTERM 係好聲好氣叫佢收工；SIGKILL 就直接屈機唔理手尾。'
);

export const BOT_STRINGS: Catalogue = STRINGS;
