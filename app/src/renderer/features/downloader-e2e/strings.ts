import type { Catalogue } from '../../core/registry';

/**
 * Copy for the end-to-end harness tab. Every key names the real behaviour at
 * every humour level — which stage a run reached, which of the five distinct
 * failure causes stopped it, how many chunks matched — the same facts, told
 * more or less seriously.
 */
export const DOWNLOADER_E2E_STRINGS: Catalogue = {
  'downloader-e2e.tab.title': {
    en: ['End-to-end test', 'End-to-end test', 'End-to-end test', 'The real-server torture test', 'The real-server torture test'],
    yue: ['端到端測試', '端到端測試', '一條龍測試', '真實伺服器整蠱測試', '真實伺服器整蠱測試']
  },
  'downloader-e2e.tab.subtitle': {
    en: [
      'Real server, bots through the proxy, world verified on disk.',
      'Real server, bots through the proxy, world verified on disk.',
      'Brings up a real server, walks bots through the proxy, and checks the saved world.',
      'A real server, real bots, and a nosy read of the region files afterwards.',
      'A real server, real bots, and a nosy read of the region files afterwards.'
    ],
    yue: [
      '真實伺服器，機械人經代理連線，落實檢查磁碟上嘅世界。',
      '真實伺服器，機械人經代理連線，落實檢查磁碟上嘅世界。',
      '開一個真伺服器，叫機械人經代理行一轉，然後查返個世界有冇儲到。',
      '真伺服器、真機械人，跟住偷睇下啲 region 檔案儲成點。',
      '真伺服器、真機械人，跟住偷睇下啲 region 檔案儲成點。'
    ]
  },
  'downloader-e2e.palette.open': {
    en: ['End-to-end test', 'End-to-end test', 'End-to-end test', 'Go poke the real server', 'Go poke the real server'],
    yue: ['端到端測試', '端到端測試', '一條龍測試', '去篤下個真伺服器', '去篤下個真伺服器']
  },
  'downloader-e2e.palette.start': {
    en: ['Start an end-to-end run', 'Start an end-to-end run', 'Start a real-server run', 'Let the bots loose', 'Let the bots loose'],
    yue: ['開始一次端到端測試', '開始一次端到端測試', '開始一次真伺服器測試', '放啲機械人出去玩', '放啲機械人出去玩']
  },
  'downloader-e2e.palette.cancel': {
    en: ['Cancel the running end-to-end test', 'Cancel the running end-to-end test', 'Stop the current run', 'Call the bots back', 'Call the bots back'],
    yue: ['取消進行緊嘅端到端測試', '取消進行緊嘅端到端測試', '停低而家嘅測試', '叫啲機械人返嚟', '叫啲機械人返嚟']
  },

  /* ---- launch card ---- */

  'downloader-e2e.unit.blocks': {
    en: ['blocks', 'blocks', 'blocks', 'blocks (a proper lap)', 'blocks (a proper lap)'],
    yue: ['格', '格', '格', '格（真係要行嘅嗰種）', '格（真係要行嘅嗰種）']
  },
  'downloader-e2e.launch.title': {
    en: ['Launch a run', 'Launch a run', 'Launch a run', 'Fire off a run', 'Fire off a run'],
    yue: ['開始一次測試', '開始一次測試', '開始一次測試', '㩒掣開跑', '㩒掣開跑']
  },
  'downloader-e2e.launch.version': {
    en: ['Minecraft / Paper version', 'Minecraft / Paper version', 'Version to test', 'Which Minecraft flavour', 'Which Minecraft flavour'],
    yue: ['Minecraft／Paper 版本', 'Minecraft／Paper 版本', '要測邊個版本', '想試邊個口味', '想試邊個口味']
  },
  'downloader-e2e.launch.mode': {
    en: ['Server route', 'Server route', 'How to bring up the server', 'How the server gets born', 'How the server gets born'],
    yue: ['伺服器啟動方式', '伺服器啟動方式', '點樣開起伺服器', '伺服器點樣出世', '伺服器點樣出世'],
  },
  'downloader-e2e.launch.mode.auto': {
    en: ['Auto (Docker, then a downloaded jar)', 'Auto (Docker, then a downloaded jar)', 'Auto: prefer Docker, fall back to a jar', 'Auto: Docker if it shows up, else a jar', 'Auto: Docker if it shows up, else a jar'],
    yue: ['自動（先試 Docker，唔得就落 jar）', '自動（先試 Docker，唔得就落 jar）', '自動：優先 Docker，唔得就用 jar', '自動：Docker 有得撈就用，冇就落 jar', '自動：Docker 有得撈就用，冇就落 jar']
  },
  'downloader-e2e.launch.mode.docker': {
    en: ['Docker only', 'Docker only', 'Docker only (fails if unavailable)', 'Docker or bust', 'Docker or bust'],
    yue: ['只用 Docker', '只用 Docker', '只用 Docker（冇就死火）', 'Docker 唔得就散水', 'Docker 唔得就散水']
  },
  'downloader-e2e.launch.mode.jar': {
    en: ['Downloaded server jar only', 'Downloaded server jar only', 'Skip Docker; download and run a jar', 'Straight to the jar', 'Straight to the jar'],
    yue: ['只用下載嘅伺服器 jar', '只用下載嘅伺服器 jar', '跳過 Docker，直接落 jar 開', '直接落 jar', '直接落 jar']
  },
  'downloader-e2e.launch.radius': {
    en: ['Route radius (blocks)', 'Route radius (blocks)', 'How far the bot walks from spawn', 'How big a lap the bot does', 'How big a lap the bot does'],
    yue: ['路線半徑（格數）', '路線半徑（格數）', '機械人由重生點行幾遠', '機械人兜幾大個圈', '機械人兜幾大個圈']
  },
  'downloader-e2e.launch.bots': {
    en: ['Bot count', 'Bot count', 'How many bots to run', 'How many little walkers', 'How many little walkers'],
    yue: ['機械人數量', '機械人數量', '出幾多隻機械人', '派幾多隻細路出去行', '派幾多隻細路出去行']
  },
  'downloader-e2e.launch.coverageThreshold': {
    en: ['Pass threshold', 'Pass threshold', 'Coverage fraction that counts as a pass', 'How forgiving to be about missing chunks', 'How forgiving to be about missing chunks'],
    yue: ['合格門檻', '合格門檻', '幾多覆蓋率先算過關', '對唔見咗嘅 chunk 有幾寬容', '對唔見咗嘅 chunk 有幾寬容']
  },
  'downloader-e2e.launch.start': {
    en: ['Start run', 'Start run', 'Start the end-to-end run', 'Send the bots in', 'Send the bots in'],
    yue: ['開始測試', '開始測試', '開始端到端測試', '放機械人入去', '放機械人入去']
  },
  'downloader-e2e.launch.cancel': {
    en: ['Cancel', 'Cancel', 'Cancel the run', 'Pull the plug', 'Pull the plug'],
    yue: ['取消', '取消', '取消測試', '扯咗佢', '扯咗佢']
  },
  'downloader-e2e.launch.disabled.busy': {
    en: [
      'A run is already in progress in this window.',
      'A run is already in progress in this window.',
      'Another run is already going in this window.',
      'One run is already loose; wait for it to finish.',
      'One run is already loose; wait for it to finish.'
    ],
    yue: [
      '呢個視窗已經有一次測試進行緊。',
      '呢個視窗已經有一次測試進行緊。',
      '呢個視窗仲有一次測試喺度跑緊。',
      '已經有一隻走緊，等埋佢先。',
      '已經有一隻走緊，等埋佢先。'
    ]
  },
  'downloader-e2e.launch.disabled.noHarness': {
    en: [
      'The harness script has not been located yet. Set it in settings.',
      'The harness script has not been located yet. Set it in settings.',
      'Point the harness-script setting at test-e2e/run.js first.',
      'Nobody has told this app where test-e2e/run.js lives yet.',
      'Nobody has told this app where test-e2e/run.js lives yet.'
    ],
    yue: [
      '仲未搵到個測試腳本，喺設定入面指定先。',
      '仲未搵到個測試腳本，喺設定入面指定先。',
      '要先喺設定指返 test-e2e/run.js 喺邊。',
      '呢個 app 仲未知 test-e2e/run.js 喺邊度。',
      '呢個 app 仲未知 test-e2e/run.js 喺邊度。'
    ]
  },
  'downloader-e2e.launch.disabled.invalid': {
    en: [
      'Some launch options are not usable yet: {reason}',
      'Some launch options are not usable yet: {reason}',
      'Fix the launch options first: {reason}',
      'That combination will not fly: {reason}',
      'That combination will not fly: {reason}'
    ],
    yue: [
      '有啲啟動選項用唔到：{reason}',
      '有啲啟動選項用唔到：{reason}',
      '要先執返個啟動選項：{reason}',
      '呢個配搭飛唔起：{reason}',
      '呢個配搭飛唔起：{reason}'
    ]
  },

  /* ---- live status ---- */

  'downloader-e2e.status.title': {
    en: ['Current run', 'Current run', 'Current run', 'What the bots are up to right now', 'What the bots are up to right now'],
    yue: ['現正測試', '現正測試', '現正測試', '啲機械人而家做緊乜', '啲機械人而家做緊乜']
  },
  'downloader-e2e.status.idle': {
    en: ['No run has been started yet.', 'No run has been started yet.', 'Nothing running — start one above.', 'All quiet. Nobody has pressed the button yet.', 'All quiet. Nobody has pressed the button yet.'],
    yue: ['仲未開始過測試。', '仲未開始過測試。', '而家冇嘢跑緊，喺上面開始一個。', '靜英英，未有人㩒過掣。', '靜英英，未有人㩒過掣。']
  },
  'downloader-e2e.status.stage': {
    en: ['Stage: {stage}', 'Stage: {stage}', 'Stage: {stage}', 'We are at: {stage}', 'We are at: {stage}'],
    yue: ['階段：{stage}', '階段：{stage}', '階段：{stage}', '而家去到：{stage}', '而家去到：{stage}']
  },
  'downloader-e2e.status.log.title': {
    en: ['Progress log', 'Progress log', 'Progress log', 'The blow-by-blow', 'The blow-by-blow'],
    yue: ['進度紀錄', '進度紀錄', '進度紀錄', '逐格戰報', '逐格戰報']
  },

  /* ---- stage names ---- */

  'downloader-e2e.stage.preflight': { en: ['Preflight', 'Preflight', 'Preflight', 'Warming up', 'Warming up'], yue: ['起飛前檢查', '起飛前檢查', '起飛前檢查', '熱身緊', '熱身緊'] },
  'downloader-e2e.stage.server-starting': { en: ['Starting the server', 'Starting the server', 'Starting the server', 'Waking the server up', 'Waking the server up'], yue: ['開緊伺服器', '開緊伺服器', '開緊伺服器', '叫醒個伺服器', '叫醒個伺服器'] },
  'downloader-e2e.stage.server-ready': { en: ['Server is ready', 'Server is ready', 'Server is ready', 'Server is up and yawning', 'Server is up and yawning'], yue: ['伺服器就緒', '伺服器就緒', '伺服器就緒', '伺服器起咗身', '伺服器起咗身'] },
  'downloader-e2e.stage.proxy-starting': { en: ['Starting the proxy', 'Starting the proxy', 'Starting the downloader proxy', 'Booting the middle-man', 'Booting the middle-man'], yue: ['開緊代理', '開緊代理', '開緊下載代理', '開緊中間人', '開緊中間人'] },
  'downloader-e2e.stage.proxy-listening': { en: ['Proxy is listening', 'Proxy is listening', 'Proxy is listening', 'Middle-man is on the line', 'Middle-man is on the line'], yue: ['代理接聽緊', '代理接聽緊', '代理接聽緊', '中間人聽緊電話', '中間人聽緊電話'] },
  'downloader-e2e.stage.bot-connecting': { en: ['Connecting the bot', 'Connecting the bot', 'Connecting the bot(s)', 'Sending the bots in', 'Sending the bots in'], yue: ['機械人連線緊', '機械人連線緊', '機械人連線緊', '派機械人入場', '派機械人入場'] },
  'downloader-e2e.stage.bot-connected': { en: ['Bot connected', 'Bot connected', 'Bot(s) connected', 'Bots are in', 'Bots are in'], yue: ['機械人連咗線', '機械人連咗線', '機械人連咗線', '機械人入咗場', '機械人入咗場'] },
  'downloader-e2e.stage.bot-walking': { en: ['Bot walking the route', 'Bot walking the route', 'Bot(s) walking the route', 'Bots on their lap', 'Bots on their lap'], yue: ['機械人行緊路線', '機械人行緊路線', '機械人行緊路線', '機械人兜緊圈', '機械人兜緊圈'] },
  'downloader-e2e.stage.bot-drained': { en: ['Flushing pending saves', 'Flushing pending saves', 'Draining before disconnect', 'Letting the last bits settle', 'Letting the last bits settle'], yue: ['沖緊未儲嘅嘢', '沖緊未儲嘅嘢', '斷線前排乾淨', '等啲尾嘢定落嚟', '等啲尾嘢定落嚟'] },
  'downloader-e2e.stage.verifying': { en: ['Verifying on disk', 'Verifying on disk', 'Reading the region files back', 'Nosing through the region files', 'Nosing through the region files'], yue: ['磁碟核實緊', '磁碟核實緊', '讀返啲 region 檔案', '偷睇緊啲 region 檔案', '偷睇緊啲 region 檔案'] },
  'downloader-e2e.stage.done': { en: ['Done', 'Done', 'Done', 'All wrapped up', 'All wrapped up'], yue: ['完成', '完成', '完成', '搞掂收工', '搞掂收工'] },
  'downloader-e2e.stage.running': { en: ['Running…', 'Running…', 'Still running…', 'Off doing its thing…', 'Off doing its thing…'], yue: ['進行緊……', '進行緊……', '仲跑緊……', '仲喺度搏緊……', '仲喺度搏緊……'] },

  'downloader-e2e.confirm.cancel.irreversible': {
    en: [
      'The server, proxy and any bots this run started are stopped immediately. Whatever was saved before the cancel stays on disk in the run\'s work directory; nothing further is verified.',
      'The server, proxy and any bots this run started are stopped immediately. Whatever was saved before the cancel stays on disk in the run\'s work directory; nothing further is verified.',
      'Stops the server, proxy and bots this run started right away. What was already saved stays on disk; nothing further gets checked.',
      'Pulls the plug on the server, proxy and bots this run started. Whatever got saved before that stays put; nobody checks the rest.',
      'Pulls the plug on the server, proxy and bots this run started. Whatever got saved before that stays put; nobody checks the rest.'
    ],
    yue: [
      '呢次測試開嘅伺服器、代理同任何機械人會即刻停止。取消之前已經儲低嘅嘢會留喺磁碟嘅工作目錄，之後唔會再核實。',
      '呢次測試開嘅伺服器、代理同任何機械人會即刻停止。取消之前已經儲低嘅嘢會留喺磁碟嘅工作目錄，之後唔會再核實。',
      '即刻停止呢次測試開嘅伺服器、代理同機械人。已經儲低嘅嘢會留喺度，之後唔會再檢查。',
      '即刻扯線，停晒呢次測試嘅伺服器、代理同機械人。之前儲低嘅照留低，之後嘅嘢就冇人再查。',
      '即刻扯線，停晒呢次測試嘅伺服器、代理同機械人。之前儲低嘅照留低，之後嘅嘢就冇人再查。'
    ]
  },

  'downloader-e2e.history.delete.needsSelection': {
    en: [
      'Select at least one run first.',
      'Select at least one run first.',
      'Select at least one run before deleting.',
      'Pick something first — cannot bin thin air.',
      'Pick something first — cannot bin thin air.'
    ],
    yue: [
      '請先選最少一個測試。',
      '請先選最少一個測試。',
      '刪除之前要先揀返個測試。',
      '要揀啲嘢先——冇嘢點掟。',
      '要揀啲嘢先——冇嘢點掟。'
    ]
  },

  /* ---- failure causes ---- */

  'downloader-e2e.cause.environment-unavailable': {
    en: [
      'This machine could not provide something the run needed.',
      'This machine could not provide something the run needed.',
      'A required piece of the environment was missing.',
      'The machine did not have what it takes today.',
      'The machine did not have what it takes today.'
    ],
    yue: ['呢部機提供唔到測試所需嘅嘢。', '呢部機提供唔到測試所需嘅嘢。', '環境入面缺咗一嚿嘢。', '呢部機今日唔夠料。', '呢部機今日唔夠料。']
  },
  'downloader-e2e.cause.server-not-ready': {
    en: ['The server never became ready.', 'The server never became ready.', 'The server never printed its ready line.', 'The server overslept.', 'The server overslept.'],
    yue: ['伺服器一直未就緒。', '伺服器一直未就緒。', '伺服器冇印過就緒嗰句。', '伺服器瞓過龍。', '伺服器瞓過龍。']
  },
  'downloader-e2e.cause.proxy-not-accepting': {
    en: ['The proxy never accepted a connection.', 'The proxy never accepted a connection.', 'The downloader proxy never reported listening.', 'The middle-man never picked up the phone.', 'The middle-man never picked up the phone.'],
    yue: ['代理一直冇接收連線。', '代理一直冇接收連線。', '下載代理冇報話聽緊電話。', '中間人一直冇聽電話。', '中間人一直冇聽電話。']
  },
  'downloader-e2e.cause.bot-not-connected': {
    en: ['The bot never connected.', 'The bot never connected.', 'The bot process never logged in.', 'The bots never made it through the door.', 'The bots never made it through the door.'],
    yue: ['機械人一直冇連到線。', '機械人一直冇連到線。', '機械人程序一直冇登入到。', '啲機械人一直入唔到門。', '啲機械人一直入唔到門。']
  },
  'downloader-e2e.cause.no-chunks-streamed': {
    en: ['The bot connected, but no chunks streamed.', 'The bot connected, but no chunks streamed.', 'Connected fine; chunk delivery never started.', 'It logged in, but nothing came through.', 'It logged in, but nothing came through.'],
    yue: ['機械人連到線，但係冇 chunk 傳過嚟。', '機械人連到線，但係冇 chunk 傳過嚟。', '連線冇問題，但係冇 chunk 傳送。', '入咗門，但係乜都冇傳過嚟。', '入咗門，但係乜都冇傳過嚟。']
  },
  'downloader-e2e.cause.chunks-streamed-not-written': {
    en: [
      'Chunks streamed, but too few were written to disk.',
      'Chunks streamed, but too few were written to disk.',
      'The proxy delivered chunks, but the region files came up short.',
      'It got the memo but forgot to write it down.',
      'It got the memo but forgot to write it down.'
    ],
    yue: [
      'Chunk 有傳送，但係磁碟儲得唔夠。',
      'Chunk 有傳送，但係磁碟儲得唔夠。',
      '代理有送 chunk，但係 region 檔案唔夠數。',
      '收到料，但係唔記得寫低。',
      '收到料，但係唔記得寫低。'
    ]
  },
  'downloader-e2e.cause.cancelled': {
    en: ['The run was cancelled.', 'The run was cancelled.', 'Cancelled before it finished.', 'Somebody pulled the plug.', 'Somebody pulled the plug.'],
    yue: ['測試已取消。', '測試已取消。', '未跑完就取消咗。', '有人扯咗條線。', '有人扯咗條線。']
  },

  /* ---- run history ---- */

  'downloader-e2e.history.title': {
    en: ['Run history', 'Run history', 'Run history', 'The rap sheet', 'The rap sheet'],
    yue: ['測試紀錄', '測試紀錄', '測試紀錄', '往績表', '往績表']
  },
  'downloader-e2e.history.empty': {
    en: [
      'No run has finished yet. There is no sample data — an empty list really means empty.',
      'No run has finished yet. There is no sample data — an empty list really means empty.',
      'Nothing here yet. Finish a run to see it appear.',
      'Nothing here yet — not even a fake one to look busy.',
      'Nothing here yet — not even a fake one to look busy.'
    ],
    yue: [
      '仲未有測試跑完。呢度冇假資料——空就係真係空。',
      '仲未有測試跑完。呢度冇假資料——空就係真係空。',
      '仲未有嘢，跑完一次就會出現喺度。',
      '乜都冇，連扮嘢嘅假資料都冇一個。',
      '乜都冇，連扮嘢嘅假資料都冇一個。'
    ]
  },
  'downloader-e2e.history.column.startedAt': { en: ['Started', 'Started', 'Started', 'Kicked off', 'Kicked off'], yue: ['開始時間', '開始時間', '開始時間', '開跑時間', '開跑時間'] },
  'downloader-e2e.history.column.version': { en: ['Version', 'Version', 'Version', 'Flavour', 'Flavour'], yue: ['版本', '版本', '版本', '口味', '口味'] },
  'downloader-e2e.history.column.result': { en: ['Result', 'Result', 'Result', 'Verdict', 'Verdict'], yue: ['結果', '結果', '結果', '判決', '判決'] },
  'downloader-e2e.history.column.stage': { en: ['Reached', 'Reached', 'Reached stage', 'Got as far as', 'Got as far as'], yue: ['去到', '去到', '去到階段', '行到邊', '行到邊'] },
  'downloader-e2e.history.column.coverage': { en: ['Coverage', 'Coverage', 'Coverage', 'How much stuck', 'How much stuck'], yue: ['覆蓋率', '覆蓋率', '覆蓋率', '中咗幾多', '中咗幾多'] },
  'downloader-e2e.history.result.pass': { en: ['Pass', 'Pass', 'Pass', 'Nailed it', 'Nailed it'], yue: ['過關', '過關', '過關', '搞掂', '搞掂'] },
  'downloader-e2e.history.result.fail': { en: ['Fail', 'Fail', 'Fail', 'Flopped', 'Flopped'], yue: ['唔過關', '唔過關', '唔過關', '炒咗', '炒咗'] },
  'downloader-e2e.history.search': { en: ['Search runs', 'Search runs', 'Search run history', 'Dig through the rap sheet', 'Dig through the rap sheet'], yue: ['搵測試紀錄', '搵測試紀錄', '喺測試紀錄度搵', '喺往績表度篤', '喺往績表度篤'] },
  'downloader-e2e.history.viewReport': { en: ['Open report', 'Open report', 'Open the full report', 'Read the whole file', 'Read the whole file'], yue: ['打開報告', '打開報告', '打開完整報告', '睇成份報告', '睇成份報告'] },
  'downloader-e2e.history.delete': { en: ['Delete', 'Delete', 'Delete selected', 'Bin selected', 'Bin selected'], yue: ['刪除', '刪除', '刪除已選', '掟咗已選嗰啲', '掟咗已選嗰啲'] },
  'downloader-e2e.history.delete.confirm': { en: ['Delete {count} run record(s)', 'Delete {count} run record(s)', 'Delete {count} run record(s)', 'Bin {count} run record(s)', 'Bin {count} run record(s)'], yue: ['刪除 {count} 條測試紀錄', '刪除 {count} 條測試紀錄', '刪除 {count} 條測試紀錄', '掟咗 {count} 條測試紀錄', '掟咗 {count} 條測試紀錄'] },
  'downloader-e2e.history.delete.irreversible': {
    en: [
      'The run record is removed from this list. The work directory it points to on disk is not touched.',
      'The run record is removed from this list. The work directory it points to on disk is not touched.',
      'Removed from the list only; the on-disk work directory is left alone.',
      'Wiped from the list; the folder it made stays right where it is.',
      'Wiped from the list; the folder it made stays right where it is.'
    ],
    yue: [
      '測試紀錄會由呢個清單移除。佢喺磁碟上指嘅工作資料夾唔會受影響。',
      '測試紀錄會由呢個清單移除。佢喺磁碟上指嘅工作資料夾唔會受影響。',
      '淨係喺清單度刪走，磁碟上嘅工作資料夾唔會郁。',
      '喺清單度抹走，但佢整出嚟嗰個資料夾原封不動。',
      '喺清單度抹走，但佢整出嚟嗰個資料夾原封不動。'
    ]
  },
  'downloader-e2e.history.export': { en: ['Export', 'Export', 'Export run history', 'Take a copy', 'Take a copy'], yue: ['匯出', '匯出', '匯出測試紀錄', '拎份副本', '拎份副本'] },
  'downloader-e2e.history.selectAll': { en: ['Select all shown', 'Select all shown', 'Select every shown run', 'Grab everything on screen', 'Grab everything on screen'], yue: ['全選顯示中', '全選顯示中', '全選顯示緊嘅測試', '掃埋畫面上嘅嘢', '掃埋畫面上嘅嘢'] },
  'downloader-e2e.history.clearSelection': { en: ['Clear selection', 'Clear selection', 'Clear selection', 'Let go', 'Let go'], yue: ['清除選取', '清除選取', '清除選取', '放手', '放手'] },

  /* ---- settings section ---- */

  'downloader-e2e.settings.section': { en: ['End-to-end test', 'End-to-end test', 'End-to-end test', 'Real-server torture test', 'Real-server torture test'], yue: ['端到端測試', '端到端測試', '端到端測試', '真伺服器整蠱測試', '真伺服器整蠱測試'] },
  'downloader-e2e.settings.harnessPath': { en: ['Harness script', 'Harness script', 'test-e2e/run.js location', 'Where the harness script lives', 'Where the harness script lives'], yue: ['測試腳本', '測試腳本', 'test-e2e/run.js 位置', '測試腳本喺邊', '測試腳本喺邊'] },
  'downloader-e2e.settings.harnessPath.description': {
    en: [
      'Absolute path to test-e2e/run.js in this checkout. The harness is a standalone Node script the repository ships, not something bundled into the packaged application, so this has to be pointed at a real checkout.',
      'Absolute path to test-e2e/run.js in this checkout. The harness is a standalone Node script the repository ships, not something bundled into the packaged application, so this has to be pointed at a real checkout.',
      'Point this at test-e2e/run.js in a checkout of this repository. It is a separate Node script, not part of the packaged app.',
      'Where the actual harness lives. It is not baked into this app — go find a checkout of the repository and point here at test-e2e/run.js.',
      'Where the actual harness lives. It is not baked into this app — go find a checkout of the repository and point here at test-e2e/run.js.'
    ],
    yue: [
      '呢個 checkout 入面 test-e2e/run.js 嘅絕對路徑。呢個測試腳本係獨立 Node 腳本，冇打包入呢個 app，所以要指去一個真係嘅 checkout。',
      '呢個 checkout 入面 test-e2e/run.js 嘅絕對路徑。呢個測試腳本係獨立 Node 腳本，冇打包入呢個 app，所以要指去一個真係嘅 checkout。',
      '指去 repository checkout 入面嘅 test-e2e/run.js。佢係獨立 Node 腳本，冇打包入 app。',
      '個測試腳本唔喺呢個 app 入面——去搵返個 repository checkout，指去嗰邊嘅 test-e2e/run.js。',
      '個測試腳本唔喺呢個 app 入面——去搵返個 repository checkout，指去嗰邊嘅 test-e2e/run.js。'
    ]
  },
  'downloader-e2e.settings.nodeCommand': { en: ['Node command', 'Node command', 'Node command', 'The node to run it with', 'The node to run it with'], yue: ['Node 指令', 'Node 指令', 'Node 指令', '用嚟跑嘅 node', '用嚟跑嘅 node'] },
  'downloader-e2e.settings.nodeCommand.description': {
    en: [
      'The Node.js executable used to launch the harness script. Defaults to "node" on the system PATH.',
      'The Node.js executable used to launch the harness script. Defaults to "node" on the system PATH.',
      'Which node binary launches the harness. Defaults to "node" on PATH.',
      'Which node gets the job. Defaults to whatever "node" resolves to.',
      'Which node gets the job. Defaults to whatever "node" resolves to.'
    ],
    yue: [
      '用嚟開個測試腳本嘅 Node.js 執行檔。預設用系統 PATH 入面嘅「node」。',
      '用嚟開個測試腳本嘅 Node.js 執行檔。預設用系統 PATH 入面嘅「node」。',
      '用邊個 node 嚟開測試腳本，預設用 PATH 入面嘅「node」。',
      '邊個 node 做呢單嘢，預設用 PATH 度嗰個「node」。',
      '邊個 node 做呢單嘢，預設用 PATH 度嗰個「node」。'
    ]
  },
  'downloader-e2e.settings.javaCommand': { en: ['Java command', 'Java command', 'Java command', 'The java to run it with', 'The java to run it with'], yue: ['Java 指令', 'Java 指令', 'Java 指令', '用嚟跑嘅 java', '用嚟跑嘅 java'] },
  'downloader-e2e.settings.javaCommand.description': {
    en: [
      'The Java executable used for both the server jar (when Docker is not used) and the downloader jar. Defaults to "java" on PATH.',
      'The Java executable used for both the server jar (when Docker is not used) and the downloader jar. Defaults to "java" on PATH.',
      'Which java runs the server jar (jar route) and the downloader jar. Defaults to "java" on PATH.',
      'Which java does the heavy lifting for both jars. Defaults to whatever "java" resolves to.',
      'Which java does the heavy lifting for both jars. Defaults to whatever "java" resolves to.'
    ],
    yue: [
      '用嚟跑伺服器 jar（用 jar 方式時）同下載器 jar 嘅 Java 執行檔。預設用 PATH 入面嘅「java」。',
      '用嚟跑伺服器 jar（用 jar 方式時）同下載器 jar 嘅 Java 執行檔。預設用 PATH 入面嘅「java」。',
      '用邊個 java 跑伺服器 jar 同下載器 jar，預設用 PATH 入面嘅「java」。',
      '邊個 java 做粗重嘢，預設用 PATH 度嗰個「java」。',
      '邊個 java 做粗重嘢，預設用 PATH 度嗰個「java」。'
    ]
  },
  'downloader-e2e.settings.downloaderJarPath': { en: ['world-downloader.jar path', 'world-downloader.jar path', 'world-downloader.jar path', 'Where the actual jar sits', 'Where the actual jar sits'], yue: ['world-downloader.jar 路徑', 'world-downloader.jar 路徑', 'world-downloader.jar 路徑', '個 jar 實際擺喺邊', '個 jar 實際擺喺邊'] },
  'downloader-e2e.settings.downloaderJarPath.description': {
    en: [
      'Absolute path to the built world-downloader.jar the harness starts as the proxy. Build it with "mvn package" from the repository root; the default guess is target/world-downloader.jar beside this checkout.',
      'Absolute path to the built world-downloader.jar the harness starts as the proxy. Build it with "mvn package" from the repository root; the default guess is target/world-downloader.jar beside this checkout.',
      'The jar the harness runs as the proxy. Build with "mvn package"; the default guess is target/world-downloader.jar.',
      'The actual jar. "mvn package" makes one at target/world-downloader.jar if you have not got one yet.',
      'The actual jar. "mvn package" makes one at target/world-downloader.jar if you have not got one yet.'
    ],
    yue: [
      '已編譯好嘅 world-downloader.jar 絕對路徑，測試腳本會用佢做代理。喺 repository 根目錄用「mvn package」編譯；預設猜測係呢個 checkout 嘅 target/world-downloader.jar。',
      '已編譯好嘅 world-downloader.jar 絕對路徑，測試腳本會用佢做代理。喺 repository 根目錄用「mvn package」編譯；預設猜測係呢個 checkout 嘅 target/world-downloader.jar。',
      '測試腳本用嚟做代理嘅 jar。用「mvn package」編譯；預設猜測 target/world-downloader.jar。',
      '真正嗰個 jar。未有嘅話用「mvn package」整一個出嚟，喺 target/world-downloader.jar。',
      '真正嗰個 jar。未有嘅話用「mvn package」整一個出嚟，喺 target/world-downloader.jar。'
    ]
  },
  'downloader-e2e.settings.scraperDir': { en: ['Scraper directory', 'Scraper directory', 'scraper/ directory', 'Where the bot code lives', 'Where the bot code lives'], yue: ['機械人腳本目錄', '機械人腳本目錄', 'scraper/ 目錄', '機械人程式碼喺邊', '機械人程式碼喺邊'] },
  'downloader-e2e.settings.scraperDir.description': {
    en: [
      'Absolute path to this repository\'s scraper/ directory, whose scrape.js drives the mineflayer bot(s) through the proxy. It needs its own "npm install" run first.',
      'Absolute path to this repository\'s scraper/ directory, whose scrape.js drives the mineflayer bot(s) through the proxy. It needs its own "npm install" run first.',
      'The scraper/ directory whose scrape.js drives the bots. Needs its own "npm install" first.',
      'Where the bot code is. It needs its own "npm install" before it can drive anything.',
      'Where the bot code is. It needs its own "npm install" before it can drive anything.'
    ],
    yue: [
      '呢個 repository scraper/ 目錄嘅絕對路徑，佢入面嘅 scrape.js 負責帶住 mineflayer 機械人經代理行走。要先喺嗰度跑過「npm install」。',
      '呢個 repository scraper/ 目錄嘅絕對路徑，佢入面嘅 scrape.js 負責帶住 mineflayer 機械人經代理行走。要先喺嗰度跑過「npm install」。',
      'scraper/ 目錄，入面 scrape.js 帶機械人行走。要先喺嗰度跑「npm install」。',
      '機械人嘅程式碼喺呢度。未跑過「npm install」就郁唔到。',
      '機械人嘅程式碼喺呢度。未跑過「npm install」就郁唔到。'
    ]
  },
  'downloader-e2e.settings.checkHarness': { en: ['Check the harness locations', 'Check the harness locations', 'Re-check every configured path', 'Poke every path and see what answers', 'Poke every path and see what answers'], yue: ['檢查測試腳本位置', '檢查測試腳本位置', '重新檢查晒每個設定路徑', '篤下每條路徑睇下有冇反應', '篤下每條路徑睇下有冇反應'] },
  'downloader-e2e.settings.checkHarness.description': {
    en: [
      'Re-probes the harness script, the world-downloader jar and the scraper directory, and reports exactly which are found.',
      'Re-probes the harness script, the world-downloader jar and the scraper directory, and reports exactly which are found.',
      'Re-checks the three configured paths and reports which exist.',
      'Goes and looks at all three paths again, honestly.',
      'Goes and looks at all three paths again, honestly.'
    ],
    yue: [
      '重新檢查測試腳本、world-downloader jar 同 scraper 目錄，話你知邊啲搵到。',
      '重新檢查測試腳本、world-downloader jar 同 scraper 目錄，話你知邊啲搵到。',
      '重新檢查三個設定路徑，話你知邊啲存在。',
      '老實去睇多次三條路徑。',
      '老實去睇多次三條路徑。'
    ]
  },
  'downloader-e2e.settings.checkHarness.found': {
    en: ['Found: {what}', 'Found: {what}', 'Found: {what}', 'Spotted it: {what}', 'Spotted it: {what}'],
    yue: ['搵到：{what}', '搵到：{what}', '搵到：{what}', '見到喇：{what}', '見到喇：{what}']
  },
  'downloader-e2e.settings.checkHarness.missing': {
    en: ['Missing: {what}', 'Missing: {what}', 'Missing: {what}', 'Nowhere to be seen: {what}', 'Nowhere to be seen: {what}'],
    yue: ['搵唔到：{what}', '搵唔到：{what}', '搵唔到：{what}', '影都冇：{what}', '影都冇：{what}']
  },

  /* ---- notifications ---- */

  'downloader-e2e.notify.started': { en: ['End-to-end run started', 'End-to-end run started', 'End-to-end run started', 'Bots away!', 'Bots away!'], yue: ['端到端測試已開始', '端到端測試已開始', '端到端測試已開始', '機械人出發喇！', '機械人出發喇！'] },
  'downloader-e2e.notify.pass': { en: ['End-to-end run passed', 'End-to-end run passed', 'End-to-end run passed', 'It actually worked', 'It actually worked'], yue: ['端到端測試過關', '端到端測試過關', '端到端測試過關', '真係得㗎喎', '真係得㗎喎'] },
  'downloader-e2e.notify.fail': { en: ['End-to-end run failed', 'End-to-end run failed', 'End-to-end run failed', 'Nope, that did not work', 'Nope, that did not work'], yue: ['端到端測試失敗', '端到端測試失敗', '端到端測試失敗', '唔得，冇成功', '唔得，冇成功'] },
  'downloader-e2e.notify.cancelled': { en: ['Run cancelled', 'Run cancelled', 'Run cancelled', 'Called it off', 'Called it off'], yue: ['測試已取消', '測試已取消', '測試已取消', '叫停咗', '叫停咗'] },

  /* ---- docs ---- */

  'downloader-e2e.docs.title': { en: ['The end-to-end test', 'The end-to-end test', 'The end-to-end test', 'The end-to-end test', 'The end-to-end test'], yue: ['端到端測試', '端到端測試', '端到端測試', '端到端測試', '端到端測試'] }
};
