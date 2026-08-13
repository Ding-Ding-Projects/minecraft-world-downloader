/**
 * Every user-facing string this feature renders, in English and playful Hong
 * Kong-style Cantonese, at all five humour levels. Voice changes with the
 * level; the facts in every entry — what happened, what it affects, what the
 * options are — stay identical across all five rungs of both languages.
 */

import type { Catalogue } from '../../core/registry';

type Ladder = [string, string, string, string, string];

function l(level1: string, level2: string, level3: string, level4: string, level5: string): Ladder {
  return [level1, level2, level3, level4, level5];
}

/** For technical labels and values where escalating jokes would obscure the fact rather than dress it. */
function same(text: string): Ladder {
  return [text, text, text, text, text];
}

export const MINEFLAYER_STRINGS: Catalogue = {
  /* ---------------------------------------------------------------- */
  /* Tabs                                                              */
  /* ---------------------------------------------------------------- */
  'mineflayer.tab.bots': {
    en: l('Bots', 'Bots', 'Bots', 'The bot pen', 'The bot pen'),
    yue: l('機械人', '機械人', '啲機械人', '機械人小窩', '機械人小窩')
  },
  'mineflayer.tab.bots.subtitle': {
    en: l(
      'Connections, live state and saved profiles',
      'Connections, live state and saved profiles',
      'Connect a bot, watch it live, keep the profile for next time',
      'Where the bots clock in, tell you how they feel, and go home again',
      'Where the bots clock in, tell you how they feel, and go home again'
    ),
    yue: l(
      '連線、即時狀態同已儲設定',
      '連線、即時狀態同已儲設定',
      '接個機械人、睇實佢、記低設定留返下次用',
      '機械人返工卡鐘、匯報心情、放工嘅地方',
      '機械人返工卡鐘、匯報心情、放工嘅地方'
    )
  },
  'mineflayer.tab.events': {
    en: l('Bot events', 'Bot events', 'Bot events', 'The firehose', 'The firehose'),
    yue: l('機械人事件', '機械人事件', '機械人事件簿', '事件水喉', '事件水喉')
  },
  'mineflayer.tab.events.subtitle': {
    en: l(
      'Every real library event, as it fires',
      'Every real library event, as it fires',
      'Every event the library actually fires, live',
      'Every single thing the library shouts, the moment it shouts it',
      'Every single thing the library shouts, the moment it shouts it'
    ),
    yue: l(
      '程式庫真正嘅事件，一發生就顯示',
      '程式庫真正嘅事件，一發生就顯示',
      '程式庫真係有嘅事件，即時顯示',
      '程式庫嗌乜，即刻畀你聽',
      '程式庫嗌乜，即刻畀你聽'
    )
  },

  /* ---------------------------------------------------------------- */
  /* Bots list                                                         */
  /* ---------------------------------------------------------------- */
  'mineflayer.bots.listRegion': {
    en: same('Saved profiles and live bots'),
    yue: same('已儲設定同即時機械人')
  },
  'mineflayer.bots.detailRegion': {
    en: same('Selected bot'),
    yue: same('已選機械人')
  },
  'mineflayer.bots.search': {
    en: l(
      'Search profiles and bots',
      'Search profiles and bots',
      'Search saved profiles and live bots',
      'Hunt down that one bot by name',
      'Hunt down that one bot by name'
    ),
    yue: l('搜尋設定同機械人', '搜尋設定同機械人', '搜尋已儲設定同即時機械人', '用名㨂返嗰隻機械人出嚟', '用名㨂返嗰隻機械人出嚟')
  },
  'mineflayer.bots.newProfile': {
    en: l('New profile', 'New profile', 'New profile', 'Adopt a new bot', 'Adopt a new bot'),
    yue: l('新增設定', '新增設定', '新增一個設定', '領養一隻新機械人', '領養一隻新機械人')
  },
  'mineflayer.bots.quickConnect': {
    en: l('Quick connect', 'Quick connect', 'Quick connect', 'Jump straight in', 'Jump straight in'),
    yue: l('快速連線', '快速連線', '快速連線', '即刻跳落去', '即刻跳落去')
  },
  'mineflayer.bots.connect.plain': {
    en: same('Connect'),
    yue: same('連線')
  },
  'mineflayer.bots.connect': {
    en: l('Connect {name}', 'Connect {name}', 'Connect {name}', 'Send {name} in', 'Send {name} in'),
    yue: l('連線 {name}', '連線 {name}', '連線 {name}', '派 {name} 出場', '派 {name} 出場')
  },
  'mineflayer.bots.disconnect': {
    en: l('Disconnect {name}', 'Disconnect {name}', 'Disconnect {name}', 'Call {name} back home', 'Call {name} back home'),
    yue: l('斷開 {name}', '斷開 {name}', '斷開 {name}', '叫 {name} 返屋企', '叫 {name} 返屋企')
  },
  'mineflayer.bots.disconnectReason': {
    en: same('Disconnected from the Bots tab.'),
    yue: same('喺「機械人」分頁斷開連線。')
  },
  'mineflayer.bots.edit': {
    en: l('Edit {name}', 'Edit {name}', 'Edit {name}', 'Give {name} a tune-up', 'Give {name} a tune-up'),
    yue: l('編輯 {name}', '編輯 {name}', '編輯 {name}', '幫 {name} 執下靚', '幫 {name} 執下靚')
  },
  'mineflayer.bots.forget': {
    en: l(
      'Forget {name}\'s live session',
      'Forget {name}\'s live session',
      'Forget {name}\'s live session',
      'Wipe {name}\'s slate clean and start fresh',
      'Wipe {name}\'s slate clean and start fresh'
    ),
    yue: l(
      '忘記 {name} 嘅即時連線',
      '忘記 {name} 嘅即時連線',
      '忘記 {name} 嘅即時連線',
      '幫 {name} 洗腦重新嚟過',
      '幫 {name} 洗腦重新嚟過'
    )
  },
  'mineflayer.bots.empty': {
    en: l('No bots yet', 'No bots yet', 'No bots yet', 'The pen is empty', 'The pen is empty'),
    yue: l('未有機械人', '未有機械人', '仲未有機械人', '個窩空吟吟', '個窩空吟吟')
  },
  'mineflayer.bots.emptyBody': {
    en: same('Save a profile or quick-connect to put a bot on a server.'),
    yue: same('儲低一個設定，或者用快速連線，就可以派機械人上伺服器。')
  },
  'mineflayer.bots.emptySearch': {
    en: same('Nothing here matches "{query}".'),
    yue: same('搵唔到同「{query}」相關嘅嘢。')
  },
  'mineflayer.bots.connectFailed': {
    en: same('Could not connect'),
    yue: same('未能連線')
  },
  'mineflayer.bots.deleteSelected': {
    en: l('Delete selected', 'Delete selected', 'Delete selected', 'Bin the selected ones', 'Bin the selected ones'),
    yue: l('刪除已選', '刪除已選', '刪除已選', '掟走已選嗰啲', '掟走已選嗰啲')
  },
  'mineflayer.bots.deleteSelectedCount': {
    en: l(
      'Delete {count} selected',
      'Delete {count} selected',
      'Delete {count} selected',
      'Bin the {count} you picked',
      'Bin the {count} you picked'
    ),
    yue: l('刪除已選 {count} 個', '刪除已選 {count} 個', '刪除已選 {count} 個', '掟走㨂咗嗰 {count} 個', '掟走㨂咗嗰 {count} 個')
  },
  'mineflayer.bots.deleteSelected.reason': {
    en: same('Select one or more saved profiles first.'),
    yue: same('請先㨂返一個或多個已儲設定。')
  },
  'mineflayer.bots.deleteAction': {
    en: same('Delete {count} saved bot profiles'),
    yue: same('刪除 {count} 個已儲機械人設定')
  },
  'mineflayer.bots.deleteIrreversible': {
    en: same(
      'Every listed profile and any vaulted password for it is removed. Any bot currently connected from one keeps running until you disconnect it separately.'
    ),
    yue: same('列出嘅每個設定，同埋為佢儲低嘅密碼，都會一併刪除。用嗰個設定連緊線嘅機械人仲會繼續行，直到你另外斷開為止。')
  },
  'mineflayer.bots.deleteRecorded': {
    en: same('Deleted {count} saved bot profiles'),
    yue: same('刪除咗 {count} 個已儲機械人設定')
  },
  'mineflayer.bots.deleted': {
    en: same('Profiles deleted'),
    yue: same('設定已刪除')
  },
  'mineflayer.bots.deletedBody': {
    en: same('{count} saved profiles removed.'),
    yue: same('已移除 {count} 個已儲設定。')
  },

  /* ---------------------------------------------------------------- */
  /* Detail panel                                                      */
  /* ---------------------------------------------------------------- */
  'mineflayer.detail.empty': {
    en: l('No bot selected', 'No bot selected', 'No bot selected', 'Nobody home', 'Nobody home'),
    yue: l('未選機械人', '未選機械人', '未有揀機械人', '冇人喺屋企', '冇人喺屋企')
  },
  'mineflayer.detail.emptyBody': {
    en: same('Connect a saved profile or use quick connect, then select it here.'),
    yue: same('連線一個已儲設定，或者用快速連線，然後喺呢度揀返佢。')
  },
  'mineflayer.detail.signInTitle': {
    en: l(
      'Microsoft sign-in needed',
      'Microsoft sign-in needed',
      'Microsoft sign-in needed',
      'The bot wants to log into its Microsoft account',
      'The bot wants to log into its Microsoft account'
    ),
    yue: l('需要登入 Microsoft 帳戶', '需要登入 Microsoft 帳戶', '需要登入 Microsoft 帳戶', '個機械人話要登入佢嘅 Microsoft 帳戶', '個機械人話要登入佢嘅 Microsoft 帳戶')
  },
  'mineflayer.detail.endReason': {
    en: same('Last disconnect reason: {reason}'),
    yue: same('上次斷線原因：{reason}')
  },

  /* ---------------------------------------------------------------- */
  /* Live state cards                                                  */
  /* ---------------------------------------------------------------- */
  'mineflayer.state.health': { en: same('Health'), yue: same('生命值') },
  'mineflayer.state.food': { en: same('Food'), yue: same('飢餓值') },
  'mineflayer.state.saturation': { en: same('Saturation'), yue: same('飽和度') },
  'mineflayer.state.oxygen': { en: same('Oxygen'), yue: same('氧氣值') },
  'mineflayer.state.experience': { en: same('Experience'), yue: same('經驗值') },
  'mineflayer.state.level': { en: same('Level'), yue: same('等級') },
  'mineflayer.state.gameMode': { en: same('Game mode'), yue: same('遊戲模式') },
  'mineflayer.state.dimension': { en: same('Dimension'), yue: same('維度') },
  'mineflayer.state.position': { en: same('Position'), yue: same('位置') },
  'mineflayer.state.velocity': { en: same('Velocity'), yue: same('速度向量') },
  'mineflayer.state.facing': { en: same('Facing'), yue: same('朝向') },
  'mineflayer.state.yaw': { en: same('yaw'), yue: same('偏航角') },
  'mineflayer.state.pitch': { en: same('pitch'), yue: same('俯仰角') },
  'mineflayer.state.onGround': { en: same('On ground'), yue: same('係咪企緊地') },
  'mineflayer.state.heldItem': { en: same('Held item'), yue: same('手持物品') },
  'mineflayer.state.empty': { en: same('Empty hand'), yue: same('空手') },
  'mineflayer.state.time': { en: same('Time of day'), yue: same('遊戲時間') },
  'mineflayer.state.day': { en: same('day'), yue: same('日頭') },
  'mineflayer.state.night': { en: same('night'), yue: same('夜晚') },
  'mineflayer.state.weather': { en: same('Weather'), yue: same('天氣') },
  'mineflayer.state.raining': { en: same('Raining'), yue: same('落緊雨') },
  'mineflayer.state.clear': { en: same('Clear'), yue: same('天晴') },
  'mineflayer.state.players': { en: same('Players online'), yue: same('線上玩家') },
  'mineflayer.state.entities': { en: same('Nearby entities'), yue: same('附近實體') },
  'mineflayer.state.serverVersion': { en: same('Server version'), yue: same('伺服器版本') },
  'mineflayer.state.serverBrand': { en: same('Server brand'), yue: same('伺服器品牌') },

  /* ---------------------------------------------------------------- */
  /* Status chips                                                      */
  /* ---------------------------------------------------------------- */
  'mineflayer.status.idle': {
    en: l('Idle', 'Idle', 'Idle', 'Loitering', 'Loitering'),
    yue: l('閒置', '閒置', '閒置緊', '瞓緊懶覺', '瞓緊懶覺')
  },
  'mineflayer.status.connecting': {
    en: l('Connecting…', 'Connecting…', 'Connecting…', 'Knocking on the door…', 'Knocking on the door…'),
    yue: l('連線緊…', '連線緊…', '連線緊…', '拍緊門…', '拍緊門…')
  },
  'mineflayer.status.connected': {
    en: l('Connected', 'Connected', 'Connected', 'In the door', 'In the door'),
    yue: l('已連線', '已連線', '已連線', '入到屋企門口', '入到屋企門口')
  },
  'mineflayer.status.spawned': {
    en: l('Spawned', 'Spawned', 'Spawned', 'On the map and moving', 'On the map and moving'),
    yue: l('已生成', '已生成', '已生成', '喺地圖度郁緊', '喺地圖度郁緊')
  },
  'mineflayer.status.reconnecting': {
    en: l('Reconnecting…', 'Reconnecting…', 'Reconnecting…', 'Trying the door again…', 'Trying the door again…'),
    yue: l('重連緊…', '重連緊…', '重新連線緊…', '再試多次拍門…', '再試多次拍門…')
  },
  'mineflayer.status.disconnected': {
    en: l('Disconnected', 'Disconnected', 'Disconnected', 'Gone home', 'Gone home'),
    yue: l('已斷線', '已斷線', '已斷線', '返咗屋企', '返咗屋企')
  },
  'mineflayer.status.failed': {
    en: l('Failed', 'Failed', 'Failed', 'Gave up', 'Gave up'),
    yue: l('失敗', '失敗', '連線失敗', '放棄咗', '放棄咗')
  },

  /* ---------------------------------------------------------------- */
  /* Connection form                                                   */
  /* ---------------------------------------------------------------- */
  'mineflayer.form.createTitle': {
    en: l('New profile', 'New profile', 'New profile', 'A brand new bot', 'A brand new bot'),
    yue: l('新增設定', '新增設定', '新增設定', '一隻全新機械人', '一隻全新機械人')
  },
  'mineflayer.form.editTitle': {
    en: l('Edit profile', 'Edit profile', 'Edit profile', 'Give this bot a once-over', 'Give this bot a once-over'),
    yue: l('編輯設定', '編輯設定', '編輯設定', '幫呢隻機械人執一執', '幫呢隻機械人執一執')
  },
  'mineflayer.form.name': { en: same('Profile name'), yue: same('設定名稱') },
  'mineflayer.form.host': { en: same('Server address'), yue: same('伺服器位址') },
  'mineflayer.form.host.description': {
    en: same('The hostname or IP address of the Minecraft server.'),
    yue: same('Minecraft 伺服器嘅主機名或者 IP 位址。')
  },
  'mineflayer.form.port': { en: same('Port'), yue: same('埠號') },
  'mineflayer.form.username': { en: same('Username'), yue: same('使用者名稱') },
  'mineflayer.form.username.description': {
    en: same('The account name the bot logs in as.'),
    yue: same('機械人登入所用嘅帳戶名。')
  },
  'mineflayer.form.auth': { en: same('Authentication'), yue: same('登入方式') },
  'mineflayer.form.auth.offline': {
    en: same('Offline (cracked / LAN server)'),
    yue: same('離線模式（盜版／區域網路伺服器）')
  },
  'mineflayer.form.auth.microsoft': {
    en: same('Microsoft account (device sign-in)'),
    yue: same('Microsoft 帳戶（裝置登入）')
  },
  'mineflayer.form.auth.mojang': {
    en: same('Legacy Mojang account (email + password)'),
    yue: same('舊式 Mojang 帳戶（電郵＋密碼）')
  },
  'mineflayer.form.password': { en: same('Account password'), yue: same('帳戶密碼') },
  'mineflayer.form.password.description': {
    en: same(
      'Stored only in the operating system credential vault, read back only at the moment of connecting. Leave blank to keep the currently stored password.'
    ),
    yue: same('只儲喺作業系統嘅密碼保險箱入面，淨係喺連線嗰一刻先讀返出嚟。留空即係保持而家儲低嘅密碼。')
  },
  'mineflayer.form.version': { en: same('Minecraft version'), yue: same('Minecraft 版本') },
  'mineflayer.form.version.placeholder': {
    en: same('Leave blank to auto-detect'),
    yue: same('留空即係自動偵測')
  },
  'mineflayer.form.version.description': {
    en: same('Empty lets the library ask the server which version to speak.'),
    yue: same('留空就會由程式庫問伺服器用邊個版本嘅語言。')
  },
  'mineflayer.form.viewDistance': { en: same('View distance'), yue: same('視野距離') },
  'mineflayer.form.viewDistance.far': { en: same('Far'), yue: same('遠') },
  'mineflayer.form.viewDistance.normal': { en: same('Normal'), yue: same('一般') },
  'mineflayer.form.viewDistance.short': { en: same('Short'), yue: same('短') },
  'mineflayer.form.viewDistance.tiny': { en: same('Tiny'), yue: same('極短') },
  'mineflayer.form.chat': { en: same('Chat visibility'), yue: same('聊天可見度') },
  'mineflayer.form.chat.enabled': { en: same('Enabled'), yue: same('啟用') },
  'mineflayer.form.chat.commandsOnly': { en: same('Commands only'), yue: same('只限指令') },
  'mineflayer.form.chat.disabled': { en: same('Disabled'), yue: same('停用') },
  'mineflayer.form.mainHand': { en: same('Main hand'), yue: same('慣用手') },
  'mineflayer.form.mainHand.right': { en: same('Right'), yue: same('右手') },
  'mineflayer.form.mainHand.left': { en: same('Left'), yue: same('左手') },
  'mineflayer.form.colors': { en: same('Render chat colours'), yue: same('顯示聊天顏色') },
  'mineflayer.form.physics': { en: same('Physics enabled'), yue: same('啟用物理') },
  'mineflayer.form.respawn': { en: same('Respawn automatically'), yue: same('自動重生') },
  'mineflayer.form.proxy': { en: same('Proxy (optional)'), yue: same('代理伺服器（可選）') },
  'mineflayer.form.proxyHost': { en: same('SOCKS5 proxy host'), yue: same('SOCKS5 代理主機') },
  'mineflayer.form.proxyHost.description': {
    en: same('Leave blank to connect directly, with no proxy.'),
    yue: same('留空即係直接連線，唔經代理伺服器。')
  },
  'mineflayer.form.proxyPort': { en: same('Proxy port'), yue: same('代理埠號') },
  'mineflayer.form.reconnectHeading': { en: same('Reconnect policy'), yue: same('重連策略') },
  'mineflayer.form.reconnect': { en: same('Reconnect automatically'), yue: same('自動重新連線') },
  'mineflayer.form.reconnectOnKick': {
    en: same('Reconnect after being kicked, not only after a dropped connection'),
    yue: same('俾人踢咗都會重連，唔淨係斷線先重連')
  },
  'mineflayer.form.reconnectMax': {
    en: same('Maximum reconnect attempts (0 = unlimited)'),
    yue: same('最多重連次數（0 即係無限）')
  },
  'mineflayer.form.quickConnectNote': {
    en: same('Connects once without saving a profile.'),
    yue: same('連線一次，唔會儲低成個設定。')
  },
  'mineflayer.form.unnamed': { en: same('Unnamed bot'), yue: same('未命名機械人') },
  'mineflayer.form.saved': { en: same('Profile saved'), yue: same('設定已儲存') },
  'mineflayer.form.recordedCreate': { en: same('Created the bot profile "{name}"'), yue: same('已建立機械人設定「{name}」') },
  'mineflayer.form.recordedUpdate': { en: same('Updated the bot profile "{name}"'), yue: same('已更新機械人設定「{name}」') },

  /* ---------------------------------------------------------------- */
  /* Runtime status                                                    */
  /* ---------------------------------------------------------------- */
  'mineflayer.runtime.idle': {
    en: l('Bot runtime not started yet', 'Bot runtime not started yet', 'Bot runtime not started yet', 'The engine room is cold', 'The engine room is cold'),
    yue: l('機械人執行環境未啟動', '機械人執行環境未啟動', '機械人執行環境仲未啟動', '機房仲未開火', '機房仲未開火')
  },
  'mineflayer.runtime.starting': {
    en: l('Starting the bot runtime…', 'Starting the bot runtime…', 'Starting the bot runtime…', 'Warming up the engine room…', 'Warming up the engine room…'),
    yue: l('啟動機械人執行環境緊…', '啟動機械人執行環境緊…', '啟動緊機械人執行環境…', '機房開緊火…', '機房開緊火…')
  },
  'mineflayer.runtime.ready': {
    en: same('Bot runtime ready — {version}'),
    yue: same('機械人執行環境已就緒 — {version}')
  },
  'mineflayer.runtime.crashed': {
    en: l('Bot runtime could not start', 'Bot runtime could not start', 'Bot runtime could not start', 'The engine room refused to light', 'The engine room refused to light'),
    yue: l('機械人執行環境無法啟動', '機械人執行環境無法啟動', '機械人執行環境開唔到', '機房死火', '機房死火')
  },
  'mineflayer.runtime.unavailable': {
    en: same('Bot runtime unavailable'),
    yue: same('機械人執行環境唔可用')
  },
  'mineflayer.runtime.stopped': {
    en: same('Bot runtime stopped'),
    yue: same('機械人執行環境已停止')
  },
  'mineflayer.runtime.start': {
    en: l('Start runtime', 'Start runtime', 'Start runtime', 'Fire it up', 'Fire it up'),
    yue: l('啟動執行環境', '啟動執行環境', '啟動執行環境', '開火', '開火')
  },
  'mineflayer.runtime.startFailed': {
    en: same('The bot runtime failed to start'),
    yue: same('機械人執行環境啟動失敗')
  },
  'mineflayer.runtime.attemptedPaths': {
    en: same('Every path the runtime searched ({count})'),
    yue: same('執行環境搵過嘅每一條路徑（{count}）')
  },
  'mineflayer.runtime.protocolMismatch': {
    en: same('The bot runtime is a different protocol version'),
    yue: same('機械人執行環境嘅通訊協定版本唔一樣')
  },
  'mineflayer.runtime.protocolMismatchBody': {
    en: same('This renderer expects protocol {expected}; the runtime answered with {actual}.'),
    yue: same('呢個介面預期通訊協定版本 {expected}；但執行環境回覆嘅係 {actual}。')
  },
  'mineflayer.runtime.exited': {
    en: same('The bot runtime process exited (code {code}, signal {signal}).'),
    yue: same('機械人執行環境進程已結束（代碼 {code}，訊號 {signal}）。')
  },
  'mineflayer.runtime.disposed': {
    en: same('The bot runtime was shut down.'),
    yue: same('機械人執行環境已經關咗。')
  },
  'mineflayer.runtime.notStarted': {
    en: same('The bot runtime has not started.'),
    yue: same('機械人執行環境仲未啟動。')
  },

  /* ---------------------------------------------------------------- */
  /* Manager-level notifications                                       */
  /* ---------------------------------------------------------------- */
  'mineflayer.manager.fault': {
    en: same('The bot runtime reported a fault'),
    yue: same('機械人執行環境報告咗一個故障')
  },
  'mineflayer.manager.forgetReason': {
    en: same('Session closed.'),
    yue: same('連線階段已關閉。')
  },
  'mineflayer.manager.profileMissing': {
    en: same('That saved profile no longer exists.'),
    yue: same('嗰個已儲設定已經唔存在。')
  },
  'mineflayer.manager.signInTitle': {
    en: same('Microsoft sign-in needed: enter {code}'),
    yue: same('需要登入 Microsoft：輸入 {code}')
  },
  'mineflayer.manager.signInOpen': {
    en: l('Open the sign-in page', 'Open the sign-in page', 'Open the sign-in page', 'Open the sign-in page and get it over with', 'Open the sign-in page and get it over with'),
    yue: l('打開登入頁面', '打開登入頁面', '打開登入頁面', '打開登入頁面，搞掂佢', '打開登入頁面，搞掂佢')
  },

  /* ---------------------------------------------------------------- */
  /* Event inspector                                                   */
  /* ---------------------------------------------------------------- */
  'mineflayer.events.bot': { en: same('Bot'), yue: same('機械人') },
  'mineflayer.events.pause': { en: same('Pause'), yue: same('暫停') },
  'mineflayer.events.highFrequency': {
    en: same('Include high-frequency events ({count} more)'),
    yue: same('包埋高頻事件（多 {count} 個）')
  },
  'mineflayer.events.clear': {
    en: l('Clear log', 'Clear log', 'Clear log', 'Wipe the slate', 'Wipe the slate'),
    yue: l('清空記錄', '清空記錄', '清空記錄', '洗返個板', '洗返個板')
  },
  'mineflayer.events.clearAction': {
    en: same('Clear the event log for this bot'),
    yue: same('清空呢隻機械人嘅事件記錄')
  },
  'mineflayer.events.clearIrreversible': {
    en: same('The retained events are removed from memory. Nothing about the connection changes.'),
    yue: same('保留緊嘅事件會由記憶體移除。連線本身乜都唔會變。')
  },
  'mineflayer.events.entries': { en: same('entries'), yue: same('條記錄') },
  'mineflayer.events.search': {
    en: same('Search event name or payload text'),
    yue: same('搜尋事件名稱或者內容文字')
  },
  'mineflayer.events.noBots': { en: same('No bot is connected yet.'), yue: same('仲未有機械人連咗線。') },
  'mineflayer.events.noBotSelected': { en: same('No bot selected'), yue: same('未揀機械人') },
  'mineflayer.events.noBotSelectedBody': {
    en: same('Connect a bot on the Bots tab, then pick it here.'),
    yue: same('去「機械人」分頁連線一隻機械人，再喺呢度揀返佢。')
  },
  'mineflayer.events.empty': {
    en: l('No events yet', 'No events yet', 'No events yet', 'Quiet in here so far', 'Quiet in here so far'),
    yue: l('未有事件', '未有事件', '仲未有事件', '呢度暫時靜英英', '呢度暫時靜英英')
  },
  'mineflayer.events.emptyBody': {
    en: same(
      'Nothing has fired yet, or every event is still subscribed off by default (see the high-frequency list in this feature\'s documentation).'
    ),
    yue: same('未有觸發過任何事件，又或者啲事件仲跟緊預設關閉（詳情睇呢個功能嘅說明文件入面嘅高頻事件清單）。')
  },
  'mineflayer.events.emptySearchBody': {
    en: same('Nothing in the retained log matches "{query}".'),
    yue: same('保留緊嘅記錄入面搵唔到同「{query}」相關嘅嘢。')
  },
  'mineflayer.events.dropped': {
    en: same('{count} events dropped so far under the per-second budget'),
    yue: same('受每秒配額限制，目前已經棄咗 {count} 個事件')
  },
  'mineflayer.events.droppedRow': { en: same('events dropped'), yue: same('事件被棄') },
  'mineflayer.events.hostLog': {
    en: same('Runtime diagnostic log ({count})'),
    yue: same('執行環境診斷記錄（{count}）')
  },
  'mineflayer.events.column.time': { en: same('Time'), yue: same('時間') },
  'mineflayer.events.column.name': { en: same('Event'), yue: same('事件') },
  'mineflayer.events.column.payload': { en: same('Payload'), yue: same('內容') },

  /* ---------------------------------------------------------------- */
  /* Settings section                                                  */
  /* ---------------------------------------------------------------- */
  'mineflayer.settings.title': {
    en: l('Bot connection defaults', 'Bot connection defaults', 'Bot connection defaults', 'How new bots start life', 'How new bots start life'),
    yue: l('機械人連線預設值', '機械人連線預設值', '機械人連線預設值', '新機械人一出世嘅設定', '新機械人一出世嘅設定')
  },
  'mineflayer.settings.viewDistance.description': {
    en: same('Pre-fills the view distance offered to a new saved profile or a quick connect. Each profile can still change it individually.'),
    yue: same('喺新增設定或者快速連線時預先填埋視野距離。每個設定仍然可以自己再改。')
  },
  'mineflayer.settings.chat.description': {
    en: same('Pre-fills the chat visibility offered to a new saved profile or a quick connect.'),
    yue: same('喺新增設定或者快速連線時預先填埋聊天可見度。')
  },
  'mineflayer.settings.auth.description': {
    en: same('Pre-fills the authentication mode offered to a new saved profile or a quick connect.'),
    yue: same('喺新增設定或者快速連線時預先填埋登入方式。')
  },
  'mineflayer.settings.mainHand.description': {
    en: same('Pre-fills the main hand offered to a new saved profile or a quick connect.'),
    yue: same('喺新增設定或者快速連線時預先填埋慣用手。')
  },
  'mineflayer.settings.reconnectEnabled.description': {
    en: same('Whether a new saved profile or a quick connect starts with automatic reconnection turned on.'),
    yue: same('新增設定或者快速連線嘅時候，係咪預設開咗自動重連。')
  },
  'mineflayer.settings.reconnectOnKick.description': {
    en: same('Whether a new profile reconnects after the server kicks the bot, not only after a dropped connection.'),
    yue: same('新設定係咪喺伺服器踢走機械人之後都會重連，唔淨係斷線先重連。')
  },
  'mineflayer.settings.reconnectMaxAttempts.description': {
    en: same('The default ceiling on reconnect attempts for a new profile. 0 means unlimited.'),
    yue: same('新設定嘅預設最多重連次數上限。0 即係無限次。')
  },
  'mineflayer.settings.eventBufferSize.label': {
    en: l('Event log buffer size', 'Event log buffer size', 'Event log buffer size', 'How much history the event inspector remembers', 'How much history the event inspector remembers'),
    yue: l('事件記錄緩衝大小', '事件記錄緩衝大小', '事件記錄緩衝大小', '事件檢查器記得幾多歷史', '事件檢查器記得幾多歷史')
  },
  'mineflayer.settings.eventBufferSize.description': {
    en: same(
      'The number of the most recent events kept per bot in the event inspector. Once full, the oldest entries are dropped to make room for new ones — export first if you need to keep them.'
    ),
    yue: same('事件檢查器為每隻機械人保留幾多條最新事件記錄。滿咗之後，最舊嘅記錄會俾新記錄頂走 — 想保留就記得先匯出。')
  }
};
