/**
 * Every word this surface says, in English and in Cantonese, at all five
 * humour levels.
 *
 * The two ladders are independent: somebody will run English at 1 beside
 * Cantonese at 5, and both halves have to read correctly in that combination.
 *
 * Humour styles the voice and never the facts. A warning that a rule will speak
 * on the user's behalf still says exactly that at level 5, and the message
 * content a player typed is never restyled by anything here — it is quoted
 * exactly as it arrived.
 */

import type { Catalogue } from '../../core/registry';

export const CHAT_STRINGS: Catalogue = {
  /* ---------------------------------------------------------------- */
  /* Destination and headings                                          */
  /* ---------------------------------------------------------------- */

  'mineflayer-chat.tab.title': {
    en: ['Bot chat', 'Bot chat', 'Bot chat', 'Bot chat, live from the server', 'Bot chat, live from the server'],
    yue: ['機械人聊天', '機械人聊天', '機械人聊天', '機械人聊天，伺服器直播', '機械人聊天，伺服器直播']
  },
  'mineflayer-chat.tab.subtitle': {
    en: [
      'Server messages, whispers, commands and the text surfaces the server draws.',
      'Server messages, whispers, commands and the text surfaces the server draws.',
      'Everything the server says, and everything you can say back.',
      'Everything the server says, everything you say back, and the scoreboards nobody reads.',
      'Everything the server says, everything you say back, and the scoreboards nobody reads.'
    ],
    yue: [
      '伺服器訊息、密語、指令，同埋伺服器畫出嚟嘅文字介面。',
      '伺服器訊息、密語、指令，同埋伺服器畫出嚟嘅文字介面。',
      '伺服器講嘅嘢，同你可以講返嘅嘢，全部喺呢度。',
      '伺服器講嘅嘢、你回敬嘅嘢，仲有冇人望嘅計分板，一次過齊晒。',
      '伺服器講嘅嘢、你回敬嘅嘢，仲有冇人望嘅計分板，一次過齊晒。'
    ]
  },
  'mineflayer-chat.section.log': {
    en: ['Message log', 'Message log', 'Message log', 'The message log', 'The message log'],
    yue: ['訊息紀錄', '訊息紀錄', '訊息紀錄', '訊息紀錄簿', '訊息紀錄簿']
  },
  'mineflayer-chat.section.log.description': {
    en: [
      'Every message the bot received this session, with its channel, its sender where the server identified one, and the server formatting rendered as it was sent.',
      'Every message the bot received this session, with its channel, its sender where the server identified one, and the server formatting rendered as it was sent.',
      'Every message the bot heard this session, with the channel, the sender when the server names one, and the colours as sent.',
      'Every message the bot has overheard this session, channel and sender and all, with the server colours drawn properly instead of a hedge of section signs.',
      'Every message the bot has overheard this session, channel and sender and all, with the server colours drawn properly instead of a hedge of section signs.'
    ],
    yue: [
      '今次連線收到嘅每一條訊息，包括頻道、伺服器有講嘅發送者，同埋原本嘅伺服器格式。',
      '今次連線收到嘅每一條訊息，包括頻道、伺服器有講嘅發送者，同埋原本嘅伺服器格式。',
      '今次連線聽到嘅所有訊息，有頻道、有發送者（伺服器講咗先有），顏色照原樣出。',
      '今次連線偷聽到嘅所有訊息，頻道發送者樣樣齊，顏色好好哋畫出嚟，唔係一堆 § 符號叢林。',
      '今次連線偷聽到嘅所有訊息，頻道發送者樣樣齊，顏色好好哋畫出嚟，唔係一堆 § 符號叢林。'
    ]
  },
  'mineflayer-chat.section.compose': {
    en: ['Send a message', 'Send a message', 'Send a message', 'Say something', 'Say something'],
    yue: ['發送訊息', '發送訊息', '發送訊息', '講兩句', '講兩句']
  },
  'mineflayer-chat.section.compose.description': {
    en: [
      'Sends on the public channel, whispers to one player, or runs a command. All three go through the bot that is connected now.',
      'Sends on the public channel, whispers to one player, or runs a command. All three go through the bot that is connected now.',
      'Public chat, a whisper to one player, or a command. All of it goes out through the connected bot.',
      'Shout at everyone, whisper to one unfortunate soul, or fire off a command. Whatever you pick, the connected bot is the one saying it.',
      'Shout at everyone, whisper to one unfortunate soul, or fire off a command. Whatever you pick, the connected bot is the one saying it.'
    ],
    yue: [
      '可以喺公開頻道發言、密語畀一位玩家，或者執行指令。三樣都經而家連線嗰個機械人送出。',
      '可以喺公開頻道發言、密語畀一位玩家，或者執行指令。三樣都經而家連線嗰個機械人送出。',
      '公開聊天、密語畀某個玩家，或者出指令。全部都係由連線嗰個機械人講出去。',
      '想大嗌畀全世界聽、想搵個倒霉友密語、想扔條指令都得。揀邊樣都好，出聲嗰個都係連線嗰個機械人。',
      '想大嗌畀全世界聽、想搵個倒霉友密語、想扔條指令都得。揀邊樣都好，出聲嗰個都係連線嗰個機械人。'
    ]
  },
  'mineflayer-chat.section.rules': {
    en: ['Pattern rules', 'Pattern rules', 'Pattern rules', 'Pattern rules', 'Pattern rules'],
    yue: ['模式規則', '模式規則', '模式規則', '模式規則', '模式規則']
  },
  'mineflayer-chat.section.rules.description': {
    en: [
      'Rules match incoming messages with a regular expression and take one action. A rule that replies or runs a command speaks on your behalf; each one states what it will do before it can be enabled.',
      'Rules match incoming messages with a regular expression and take one action. A rule that replies or runs a command speaks on your behalf; each one states what it will do before it can be enabled.',
      'A rule matches incoming messages and does one thing. Rules that reply or run a command speak for you, and each says what it will do before you can switch it on.',
      'Set a trap, and when a message walks into it the rule does exactly one thing. The ones that reply or run commands are speaking with your mouth, so each of them confesses what it will do before you can arm it.',
      'Set a trap, and when a message walks into it the rule does exactly one thing. The ones that reply or run commands are speaking with your mouth, so each of them confesses what it will do before you can arm it.'
    ],
    yue: [
      '規則用正則表達式配對收到嘅訊息，然後執行一個動作。會回覆或者執行指令嘅規則係代你講嘢；每條規則喺開啟之前都會講清楚佢會做乜。',
      '規則用正則表達式配對收到嘅訊息，然後執行一個動作。會回覆或者執行指令嘅規則係代你講嘢；每條規則喺開啟之前都會講清楚佢會做乜。',
      '規則配對到訊息就做一件事。會回覆或者出指令嗰啲係代你講嘢，開之前每條都會話你知佢會做乜。',
      '擺個陷阱，有訊息踩落去，規則就做一件事。會回覆同出指令嗰啲，係借你把口講嘢，所以開之前每條都要先自首佢會做乜。',
      '擺個陷阱，有訊息踩落去，規則就做一件事。會回覆同出指令嗰啲，係借你把口講嘢，所以開之前每條都要先自首佢會做乜。'
    ]
  },
  'mineflayer-chat.section.server': {
    en: ['Server text', 'Server text', 'Server text', 'Server text surfaces', 'Server text surfaces'],
    yue: ['伺服器文字', '伺服器文字', '伺服器文字', '伺服器文字介面', '伺服器文字介面']
  },
  'mineflayer-chat.section.server.description': {
    en: [
      'The tab list, boss bars, scoreboards, teams and titles the server is drawing right now. Every value is the real event value; nothing is shown while nothing is connected.',
      'The tab list, boss bars, scoreboards, teams and titles the server is drawing right now. Every value is the real event value; nothing is shown while nothing is connected.',
      'The tab list, boss bars, scoreboards, teams and titles as they stand right now. Real values only, and nothing at all while nothing is connected.',
      'Tab list, boss bars, scoreboards, teams and titles, exactly as the server is painting them this second. Real numbers only — while nothing is connected these panels stay honestly empty rather than showing you yesterday.',
      'Tab list, boss bars, scoreboards, teams and titles, exactly as the server is painting them this second. Real numbers only — while nothing is connected these panels stay honestly empty rather than showing you yesterday.'
    ],
    yue: [
      '伺服器而家畫緊嘅玩家列表、Boss 血條、計分板、隊伍同標題。全部都係真實事件數值；未連線就乜都唔會顯示。',
      '伺服器而家畫緊嘅玩家列表、Boss 血條、計分板、隊伍同標題。全部都係真實事件數值；未連線就乜都唔會顯示。',
      '玩家列表、Boss 血條、計分板、隊伍同標題，即刻嘅狀態。只有真數值，未連線就完全唔顯示。',
      '玩家列表、Boss 血條、計分板、隊伍同標題，同伺服器呢一秒畫緊嘅一模一樣。只有真數字——未連線嗰陣呢啲面板會老實咁吉住，唔會攞舊嘢呃你。',
      '玩家列表、Boss 血條、計分板、隊伍同標題，同伺服器呢一秒畫緊嘅一模一樣。只有真數字——未連線嗰陣呢啲面板會老實咁吉住，唔會攞舊嘢呃你。'
    ]
  },

  /* ---------------------------------------------------------------- */
  /* Session state                                                     */
  /* ---------------------------------------------------------------- */

  'mineflayer-chat.state.noRuntime': {
    en: [
      'No bot runtime is available',
      'No bot runtime is available',
      'No bot runtime is available',
      'There is no bot to talk through',
      'There is no bot to talk through'
    ],
    yue: [
      '而家冇機械人執行環境',
      '而家冇機械人執行環境',
      '而家冇機械人執行環境',
      '冇機械人可以借把口',
      '冇機械人可以借把口'
    ]
  },
  'mineflayer-chat.state.noRuntime.body': {
    en: [
      'The bot connection is owned by the bot control surface. Open it, connect a bot, and this surface follows that session. Nothing here is simulated while no session exists.',
      'The bot connection is owned by the bot control surface. Open it, connect a bot, and this surface follows that session. Nothing here is simulated while no session exists.',
      'The bot connection lives on the bot control surface. Connect one there and this surface picks it up. Nothing here is made up while there is no session.',
      'The connection belongs to the bot control surface — go and start one there and this page will latch onto it. Until then these panels stay empty on purpose, because inventing a conversation would be worse than showing none.',
      'The connection belongs to the bot control surface — go and start one there and this page will latch onto it. Until then these panels stay empty on purpose, because inventing a conversation would be worse than showing none.'
    ],
    yue: [
      '機械人連線由機械人控制介面負責。喺嗰邊連線之後，呢個介面就會跟住嗰個工作階段。冇工作階段嗰陣，呢度唔會模擬任何嘢。',
      '機械人連線由機械人控制介面負責。喺嗰邊連線之後，呢個介面就會跟住嗰個工作階段。冇工作階段嗰陣，呢度唔會模擬任何嘢。',
      '連線喺機械人控制介面度。喺嗰度連咗，呢邊就會接住。冇工作階段嗰陣，呢度唔會作嘢出嚟。',
      '連線係機械人控制介面嘅地盤，去嗰邊開一個，呢版就會即刻黐住佢。喺此之前呢啲面板故意吉住——作段對話出嚟仲衰過乜都唔顯示。',
      '連線係機械人控制介面嘅地盤，去嗰邊開一個，呢版就會即刻黐住佢。喺此之前呢啲面板故意吉住——作段對話出嚟仲衰過乜都唔顯示。'
    ]
  },
  'mineflayer-chat.state.disconnected': {
    en: [
      'The bot is not connected',
      'The bot is not connected',
      'The bot is not connected',
      'The bot is not connected to anything',
      'The bot is not connected to anything'
    ],
    yue: ['機械人未連線', '機械人未連線', '機械人未連線', '機械人邊度都未連到', '機械人邊度都未連到']
  },
  'mineflayer-chat.state.disconnected.body': {
    en: [
      'Sending is unavailable until the session reconnects. The messages already received stay in the log and can still be searched, copied and exported.',
      'Sending is unavailable until the session reconnects. The messages already received stay in the log and can still be searched, copied and exported.',
      'You cannot send until it reconnects. What already arrived stays in the log, and you can still search, copy and export it.',
      'Nothing can go out until it reconnects. Everything that already came in is still sitting in the log, still searchable, still copyable, still exportable — it just cannot talk back right now.',
      'Nothing can go out until it reconnects. Everything that already came in is still sitting in the log, still searchable, still copyable, still exportable — it just cannot talk back right now.'
    ],
    yue: [
      '重新連線之前唔可以發送。已經收到嘅訊息仲喺紀錄度，照樣可以搜尋、複製同匯出。',
      '重新連線之前唔可以發送。已經收到嘅訊息仲喺紀錄度，照樣可以搜尋、複製同匯出。',
      '未重連就send唔到。已經收到嘅嘢仲喺紀錄度，一樣搵得、copy得、匯出得。',
      '未重連就乜都出唔到。之前收到嘅嘢仲乖乖坐喺紀錄度，照搵、照 copy、照匯出——只係而家駁唔到嘴。',
      '未重連就乜都出唔到。之前收到嘅嘢仲乖乖坐喺紀錄度，照搵、照 copy、照匯出——只係而家駁唔到嘴。'
    ]
  },
  'mineflayer-chat.state.connected': {
    en: [
      'Connected as {username}',
      'Connected as {username}',
      'Connected as {username}',
      'Connected, playing the part of {username}',
      'Connected, playing the part of {username}'
    ],
    yue: [
      '已連線，身分為 {username}',
      '已連線，身分為 {username}',
      '已連線，身分係 {username}',
      '已連線，扮緊 {username} 咁款',
      '已連線，扮緊 {username} 咁款'
    ]
  },
  'mineflayer-chat.log.empty': {
    en: [
      'No messages yet',
      'No messages yet',
      'No messages yet',
      'Nothing has been said yet',
      'Nothing has been said yet'
    ],
    yue: ['未有訊息', '未有訊息', '未有訊息', '未有人講過嘢', '未有人講過嘢']
  },
  'mineflayer-chat.log.empty.body': {
    en: [
      'Messages appear here as the server sends them. Send one below to start.',
      'Messages appear here as the server sends them. Send one below to start.',
      'Messages land here as the server sends them. Send one below to get going.',
      'Messages land here the moment the server says anything. Or break the silence yourself with the box below.',
      'Messages land here the moment the server says anything. Or break the silence yourself with the box below.'
    ],
    yue: [
      '伺服器一有訊息就會顯示喺呢度。可以喺下面發送一條開始。',
      '伺服器一有訊息就會顯示喺呢度。可以喺下面發送一條開始。',
      '伺服器一講嘢就會出喺呢度。喺下面send一條先啦。',
      '伺服器一開口，訊息即刻出喺呢度。或者你自己喺下面打破沉默都得。',
      '伺服器一開口，訊息即刻出喺呢度。或者你自己喺下面打破沉默都得。'
    ]
  },
  'mineflayer-chat.log.dropped': {
    en: [
      '{count} older messages were dropped to stay inside the retention limit of {limit}.',
      '{count} older messages were dropped to stay inside the retention limit of {limit}.',
      '{count} older messages were dropped; the limit is {limit}.',
      '{count} older messages have fallen off the end — the limit is {limit}, and something had to give.',
      '{count} older messages have fallen off the end — the limit is {limit}, and something had to give.'
    ],
    yue: [
      '為咗守住 {limit} 條嘅保留上限，已經捨棄咗 {count} 條較舊嘅訊息。',
      '為咗守住 {limit} 條嘅保留上限，已經捨棄咗 {count} 條較舊嘅訊息。',
      '掉咗 {count} 條舊訊息，上限係 {limit} 條。',
      '有 {count} 條舊訊息跌咗出界——上限得 {limit} 條，總要有人犧牲。',
      '有 {count} 條舊訊息跌咗出界——上限得 {limit} 條，總要有人犧牲。'
    ]
  },

  /* ---------------------------------------------------------------- */
  /* Channels                                                          */
  /* ---------------------------------------------------------------- */

  'mineflayer-chat.channel.chat': {
    en: ['Chat', 'Chat', 'Chat', 'Chat', 'Chat'],
    yue: ['聊天', '聊天', '聊天', '聊天', '聊天']
  },
  'mineflayer-chat.channel.system': {
    en: ['System', 'System', 'System', 'System', 'System'],
    yue: ['系統', '系統', '系統', '系統', '系統']
  },
  'mineflayer-chat.channel.game_info': {
    en: ['Action bar', 'Action bar', 'Action bar', 'Action bar', 'Action bar'],
    yue: ['動作列', '動作列', '動作列', '動作列', '動作列']
  },
  'mineflayer-chat.channel.outgoing': {
    en: ['Sent from here', 'Sent from here', 'Sent from here', 'Sent from here', 'Sent from here'],
    yue: ['由呢度發出', '由呢度發出', '由呢度發出', '由呢度發出', '由呢度發出']
  },
  'mineflayer-chat.channel.chat.description': {
    en: [
      'A player message. The server sends these on the chat position and identifies the sender.',
      'A player message. The server sends these on the chat position and identifies the sender.',
      'A player said this. The server sends it on the chat position and names who spoke.',
      'An actual human (or something pretending to be one) said this. The server tags it as chat and names the culprit.',
      'An actual human (or something pretending to be one) said this. The server tags it as chat and names the culprit.'
    ],
    yue: [
      '玩家訊息。伺服器用 chat 位置發送，並會標明發送者。',
      '玩家訊息。伺服器用 chat 位置發送，並會標明發送者。',
      '有玩家講嘅。伺服器用 chat 位置send，仲會講明邊個講。',
      '真係有個人（或者扮人嗰啲嘢）講咗嘅。伺服器標明係 chat，仲會爆邊個講。',
      '真係有個人（或者扮人嗰啲嘢）講咗嘅。伺服器標明係 chat，仲會爆邊個講。'
    ]
  },
  'mineflayer-chat.channel.system.description': {
    en: [
      'A server message with no sender: join and leave notices, command output, death messages and plugin text.',
      'A server message with no sender: join and leave notices, command output, death messages and plugin text.',
      'The server talking with no sender attached: joins, leaves, command output, deaths and plugin text.',
      'The server itself talking, with nobody to blame: joins, leaves, command output, deaths, and whatever the plugins felt like announcing.',
      'The server itself talking, with nobody to blame: joins, leaves, command output, deaths, and whatever the plugins felt like announcing.'
    ],
    yue: [
      '冇發送者嘅伺服器訊息：出入通知、指令輸出、死亡訊息同插件文字。',
      '冇發送者嘅伺服器訊息：出入通知、指令輸出、死亡訊息同插件文字。',
      '伺服器自己講，冇發送者：入退、指令輸出、死亡訊息同插件文字。',
      '伺服器自己開口，冇人孭鑊：入退場、指令輸出、死亡通告，同插件想公佈嘅一切。',
      '伺服器自己開口，冇人孭鑊：入退場、指令輸出、死亡通告，同插件想公佈嘅一切。'
    ]
  },
  'mineflayer-chat.channel.game_info.description': {
    en: [
      'Text the game shows above the hotbar rather than in the chat box. The library calls this position game_info.',
      'Text the game shows above the hotbar rather than in the chat box. The library calls this position game_info.',
      'The line the game paints above the hotbar instead of in the chat box. The library names this position game_info.',
      'The line that floats above your hotbar instead of joining the chat box. The library files it under game_info, which is a strange name for it, but it is the real one.',
      'The line that floats above your hotbar instead of joining the chat box. The library files it under game_info, which is a strange name for it, but it is the real one.'
    ],
    yue: [
      '遊戲顯示喺快捷欄上方而唔係聊天框嘅文字。程式庫將呢個位置叫做 game_info。',
      '遊戲顯示喺快捷欄上方而唔係聊天框嘅文字。程式庫將呢個位置叫做 game_info。',
      '遊戲畫喺快捷欄上面、唔入聊天框嗰行字。程式庫叫呢個位置做 game_info。',
      '飄喺快捷欄上面、唔肯入聊天框嗰行字。程式庫叫佢 game_info，個名係怪咗啲，但真係叫呢個。',
      '飄喺快捷欄上面、唔肯入聊天框嗰行字。程式庫叫佢 game_info，個名係怪咗啲，但真係叫呢個。'
    ]
  },
  'mineflayer-chat.channel.outgoing.description': {
    en: [
      'Not a server channel. This surface records what it asked the bot to say, so it can never be mistaken for something the server sent back. The server’s own echo, if any, arrives on its own channel.',
      'Not a server channel. This surface records what it asked the bot to say, so it can never be mistaken for something the server sent back. The server’s own echo, if any, arrives on its own channel.',
      'Not a server channel. It is this surface’s note of what it told the bot to say, kept apart from anything the server sent. The server’s echo, if it sends one, arrives on its own channel.',
      'Not a server channel at all — it is this page’s own diary of what it told the bot to say, kept well apart from anything the server actually sent. If the server echoes it back, that copy arrives on its own channel.',
      'Not a server channel at all — it is this page’s own diary of what it told the bot to say, kept well apart from anything the server actually sent. If the server echoes it back, that copy arrives on its own channel.'
    ],
    yue: [
      '呢個唔係伺服器頻道。呢個介面自己記低叫過機械人講乜，以免同伺服器送返嚟嘅嘢混淆。伺服器如果有回音，會喺自己嘅頻道出現。',
      '呢個唔係伺服器頻道。呢個介面自己記低叫過機械人講乜，以免同伺服器送返嚟嘅嘢混淆。伺服器如果有回音，會喺自己嘅頻道出現。',
      '唔係伺服器頻道，係呢個介面記低叫過機械人講咩，同伺服器送嘅嘢分開。伺服器有回音就會喺自己頻道出。',
      '完全唔係伺服器頻道——係呢版自己嘅日記，記住叫過機械人講乜，同伺服器真正送嘅嘢分得好開。伺服器彈返嚟嗰份，會喺佢自己頻道出現。',
      '完全唔係伺服器頻道——係呢版自己嘅日記，記住叫過機械人講乜，同伺服器真正送嘅嘢分得好開。伺服器彈返嚟嗰份，會喺佢自己頻道出現。'
    ]
  },
  'mineflayer-chat.channel.filter': {
    en: [
      'Channels shown',
      'Channels shown',
      'Channels shown',
      'Which channels to show',
      'Which channels to show'
    ],
    yue: ['顯示嘅頻道', '顯示嘅頻道', '顯示嘅頻道', '要顯示邊啲頻道', '要顯示邊啲頻道']
  },
  'mineflayer-chat.channel.count': {
    en: ['{channel} ({count})', '{channel} ({count})', '{channel} ({count})', '{channel} ({count})', '{channel} ({count})'],
    yue: ['{channel}（{count}）', '{channel}（{count}）', '{channel}（{count}）', '{channel}（{count}）', '{channel}（{count}）']
  },

  /* ---------------------------------------------------------------- */
  /* Log list, selection and bulk actions                              */
  /* ---------------------------------------------------------------- */

  'mineflayer-chat.search': {
    en: [
      'Search messages',
      'Search messages',
      'Search the messages',
      'Search the messages and watch them thin out',
      'Search the messages and watch them thin out'
    ],
    yue: ['搜尋訊息', '搜尋訊息', '搵下啲訊息', '打字搵訊息，睇住佢哋一條條走', '打字搵訊息，睇住佢哋一條條走']
  },
  'mineflayer-chat.log.showing': {
    en: [
      'Showing {shown} of {total} messages',
      'Showing {shown} of {total} messages',
      'Showing {shown} of {total} messages',
      'Showing {shown} of {total} messages',
      'Showing {shown} of {total} messages'
    ],
    yue: [
      '顯示緊 {total} 條之中嘅 {shown} 條',
      '顯示緊 {total} 條之中嘅 {shown} 條',
      '顯示緊 {total} 條之中嘅 {shown} 條',
      '顯示緊 {total} 條之中嘅 {shown} 條',
      '顯示緊 {total} 條之中嘅 {shown} 條'
    ]
  },
  'mineflayer-chat.log.selected': {
    en: [
      '{count} selected',
      '{count} selected',
      '{count} selected',
      '{count} selected',
      '{count} selected'
    ],
    yue: ['已揀 {count} 條', '已揀 {count} 條', '已揀 {count} 條', '已揀 {count} 條', '已揀 {count} 條']
  },
  'mineflayer-chat.select.shown': {
    en: [
      'Select all {count} shown',
      'Select all {count} shown',
      'Select all {count} shown',
      'Select all {count} shown',
      'Select all {count} shown'
    ],
    yue: [
      '揀晒顯示緊嘅 {count} 條',
      '揀晒顯示緊嘅 {count} 條',
      '揀晒顯示緊嘅 {count} 條',
      '揀晒顯示緊嘅 {count} 條',
      '揀晒顯示緊嘅 {count} 條'
    ]
  },
  'mineflayer-chat.select.everything': {
    en: [
      'Select all {count} in the log',
      'Select all {count} in the log',
      'Select all {count} in the log',
      'Select all {count} in the log, filter or no filter',
      'Select all {count} in the log, filter or no filter'
    ],
    yue: [
      '揀晒紀錄入面全部 {count} 條',
      '揀晒紀錄入面全部 {count} 條',
      '揀晒紀錄入面全部 {count} 條',
      '唔理篩選，揀晒紀錄入面全部 {count} 條',
      '唔理篩選，揀晒紀錄入面全部 {count} 條'
    ]
  },
  'mineflayer-chat.select.invert': {
    en: [
      'Invert the selection',
      'Invert the selection',
      'Invert the selection',
      'Flip the selection around',
      'Flip the selection around'
    ],
    yue: ['反轉選取', '反轉選取', '反轉選取', '掉轉晒個選取', '掉轉晒個選取']
  },
  'mineflayer-chat.select.clear': {
    en: [
      'Clear the selection',
      'Clear the selection',
      'Clear the selection',
      'Let go of everything',
      'Let go of everything'
    ],
    yue: ['清除選取', '清除選取', '清除選取', '全部放手', '全部放手']
  },
  'mineflayer-chat.action.copy': {
    en: ['Copy', 'Copy', 'Copy', 'Copy them', 'Copy them'],
    yue: ['複製', '複製', '複製', '複製走', '複製走']
  },
  'mineflayer-chat.action.copied': {
    en: [
      'Copied {count} messages to the clipboard',
      'Copied {count} messages to the clipboard',
      'Copied {count} messages to the clipboard',
      '{count} messages are on the clipboard',
      '{count} messages are on the clipboard'
    ],
    yue: [
      '已複製 {count} 條訊息到剪貼簿',
      '已複製 {count} 條訊息到剪貼簿',
      '已複製 {count} 條訊息到剪貼簿',
      '{count} 條訊息已經入咗剪貼簿',
      '{count} 條訊息已經入咗剪貼簿'
    ]
  },
  'mineflayer-chat.action.copyFailed': {
    en: [
      'The clipboard refused the copy',
      'The clipboard refused the copy',
      'The clipboard refused the copy',
      'The clipboard would not take it',
      'The clipboard would not take it'
    ],
    yue: ['剪貼簿拒絕咗今次複製', '剪貼簿拒絕咗今次複製', '剪貼簿唔收', '剪貼簿唔肯收', '剪貼簿唔肯收']
  },
  'mineflayer-chat.action.export': {
    en: ['Export', 'Export', 'Export', 'Export them', 'Export them'],
    yue: ['匯出', '匯出', '匯出', '匯出佢哋', '匯出佢哋']
  },
  'mineflayer-chat.action.export.format': {
    en: ['Export format', 'Export format', 'Export format', 'Export format', 'Export format'],
    yue: ['匯出格式', '匯出格式', '匯出格式', '匯出格式', '匯出格式']
  },
  'mineflayer-chat.action.export.scope': {
    en: [
      'Exports the {count} messages currently shown, in the order shown, with the active filter applied.',
      'Exports the {count} messages currently shown, in the order shown, with the active filter applied.',
      'Exports the {count} messages you can see, in the order you see them, filter and all.',
      'Exports exactly the {count} messages in front of you, in that order, filter included — not the whole log behind it.',
      'Exports exactly the {count} messages in front of you, in that order, filter included — not the whole log behind it.'
    ],
    yue: [
      '會匯出而家顯示緊嘅 {count} 條訊息，按顯示次序，並套用現行篩選。',
      '會匯出而家顯示緊嘅 {count} 條訊息，按顯示次序，並套用現行篩選。',
      '匯出你而家見到嗰 {count} 條，跟住見到嘅次序，篩選照計。',
      '淨係匯出你眼前嗰 {count} 條，跟返個次序，篩選照計——唔係背後成份紀錄。',
      '淨係匯出你眼前嗰 {count} 條，跟住見到嘅次序，篩選照計——唔係背後成份紀錄。'
    ]
  },
  'mineflayer-chat.action.exported': {
    en: [
      'Exported to {path}',
      'Exported to {path}',
      'Exported to {path}',
      'Exported to {path}',
      'Exported to {path}'
    ],
    yue: ['已匯出到 {path}', '已匯出到 {path}', '已匯出到 {path}', '已匯出到 {path}', '已匯出到 {path}']
  },
  'mineflayer-chat.action.exportLoss': {
    en: [
      'The {format} format cannot carry every field: {fields}. Everything else is written in full.',
      'The {format} format cannot carry every field: {fields}. Everything else is written in full.',
      '{format} cannot carry every field: {fields}. The rest is written in full.',
      '{format} cannot hold on to everything — {fields} will not make the trip. The rest arrives intact.',
      '{format} cannot hold on to everything — {fields} will not make the trip. The rest arrives intact.'
    ],
    yue: [
      '{format} 格式載唔到全部欄位：{fields}。其餘欄位會完整寫入。',
      '{format} 格式載唔到全部欄位：{fields}。其餘欄位會完整寫入。',
      '{format} 載唔到全部欄位：{fields}。其餘照樣完整寫入。',
      '{format} 唔係樣樣都揸得住——{fields} 上唔到船。其餘嘅會完整咁到埗。',
      '{format} 唔係樣樣都揸得住——{fields} 上唔到船。其餘嘅會完整咁到埗。'
    ]
  },
  'mineflayer-chat.action.delete': {
    en: ['Delete', 'Delete', 'Delete', 'Delete them', 'Delete them'],
    yue: ['刪除', '刪除', '刪除', '刪咗佢哋', '刪咗佢哋']
  },
  'mineflayer-chat.action.clearLog': {
    en: ['Clear the log', 'Clear the log', 'Clear the log', 'Empty the whole log', 'Empty the whole log'],
    yue: ['清空紀錄', '清空紀錄', '清空紀錄', '成份紀錄倒晒佢', '成份紀錄倒晒佢']
  },
  'mineflayer-chat.delete.irreversible': {
    en: [
      'The selected messages are removed from this window’s log. The log is held in memory only, so they cannot be fetched back from the server and cannot be recovered. The deletion is recorded in local history.',
      'The selected messages are removed from this window’s log. The log is held in memory only, so they cannot be fetched back from the server and cannot be recovered. The deletion is recorded in local history.',
      'The selected messages leave this window’s log. The log lives in memory only, so they cannot be fetched back from the server and cannot be recovered. The deletion is recorded in local history.',
      'The selected messages leave this window’s log for good. The log lives in memory alone, so nothing can be fetched back from the server and nothing can be undone. The deletion itself is written to local history.',
      'The selected messages leave this window’s log for good. The log lives in memory alone, so nothing can be fetched back from the server and nothing can be undone. The deletion itself is written to local history.'
    ],
    yue: [
      '選取嘅訊息會由呢個視窗嘅紀錄移除。紀錄只係存喺記憶體，所以唔可以向伺服器取回，亦都復原唔到。今次刪除會寫入本機歷史。',
      '選取嘅訊息會由呢個視窗嘅紀錄移除。紀錄只係存喺記憶體，所以唔可以向伺服器取回，亦都復原唔到。今次刪除會寫入本機歷史。',
      '揀咗嘅訊息會離開呢個視窗嘅紀錄。紀錄淨係喺記憶體，所以攞唔返，亦都復原唔到。今次刪除會寫入本機歷史。',
      '揀咗嘅訊息會永久離開呢個視窗嘅紀錄。紀錄淨係住喺記憶體，向伺服器攞唔返，亦都冇得反悔。今次刪除本身會寫入本機歷史。',
      '揀咗嘅訊息會永久離開呢個視窗嘅紀錄。紀錄淨係住喺記憶體，向伺服器攞唔返，亦都冇得反悔。今次刪除本身會寫入本機歷史。'
    ]
  },
  'mineflayer-chat.delete.done': {
    en: [
      '{count} messages removed from the log',
      '{count} messages removed from the log',
      '{count} messages removed from the log',
      '{count} messages are gone from the log',
      '{count} messages are gone from the log'
    ],
    yue: [
      '已由紀錄移除 {count} 條訊息',
      '已由紀錄移除 {count} 條訊息',
      '已由紀錄移除 {count} 條訊息',
      '{count} 條訊息喺紀錄度冇咗',
      '{count} 條訊息喺紀錄度冇咗'
    ]
  },
  'mineflayer-chat.column.time': {
    en: ['Time', 'Time', 'Time', 'Time', 'Time'],
    yue: ['時間', '時間', '時間', '時間', '時間']
  },
  'mineflayer-chat.column.channel': {
    en: ['Channel', 'Channel', 'Channel', 'Channel', 'Channel'],
    yue: ['頻道', '頻道', '頻道', '頻道', '頻道']
  },
  'mineflayer-chat.column.sender': {
    en: ['Sender', 'Sender', 'Sender', 'Sender', 'Sender'],
    yue: ['發送者', '發送者', '發送者', '發送者', '發送者']
  },
  'mineflayer-chat.column.message': {
    en: ['Message', 'Message', 'Message', 'Message', 'Message'],
    yue: ['訊息', '訊息', '訊息', '訊息', '訊息']
  },
  'mineflayer-chat.sender.none': {
    en: [
      'No sender',
      'No sender',
      'No sender',
      'Nobody in particular',
      'Nobody in particular'
    ],
    yue: ['冇發送者', '冇發送者', '冇發送者', '冇特定邊個', '冇特定邊個']
  },
  'mineflayer-chat.verified': {
    en: [
      'The server signed this message and the signature verified.',
      'The server signed this message and the signature verified.',
      'Signed by the server, and the signature checked out.',
      'Signed by the server, and the signature actually checked out.',
      'Signed by the server, and the signature actually checked out.'
    ],
    yue: [
      '伺服器有簽署呢條訊息，而簽署驗證通過。',
      '伺服器有簽署呢條訊息，而簽署驗證通過。',
      '伺服器簽咗名，而個簽署驗到冇問題。',
      '伺服器簽咗名，而且個簽署真係驗得過。',
      '伺服器簽咗名，而且個簽署真係驗得過。'
    ]
  },
  'mineflayer-chat.unverified': {
    en: [
      'The server sent this message without a verified signature.',
      'The server sent this message without a verified signature.',
      'This one arrived without a verified signature.',
      'This one turned up without a verified signature, which is normal on plenty of servers.',
      'This one turned up without a verified signature, which is normal on plenty of servers.'
    ],
    yue: [
      '伺服器發呢條訊息嗰陣冇經驗證嘅簽署。',
      '伺服器發呢條訊息嗰陣冇經驗證嘅簽署。',
      '呢條入嚟嗰陣冇經驗證嘅簽署。',
      '呢條入嚟嗰陣冇經驗證嘅簽署，好多伺服器都係咁，唔使驚。',
      '呢條入嚟嗰陣冇經驗證嘅簽署，好多伺服器都係咁，唔使驚。'
    ]
  },
  'mineflayer-chat.row.label': {
    en: [
      '{channel} message from {sender} at {time}',
      '{channel} message from {sender} at {time}',
      '{channel} message from {sender} at {time}',
      '{channel} message from {sender} at {time}',
      '{channel} message from {sender} at {time}'
    ],
    yue: [
      '{time} 由 {sender} 發出嘅 {channel} 訊息',
      '{time} 由 {sender} 發出嘅 {channel} 訊息',
      '{time} 由 {sender} 發出嘅 {channel} 訊息',
      '{time} 由 {sender} 發出嘅 {channel} 訊息',
      '{time} 由 {sender} 發出嘅 {channel} 訊息'
    ]
  },

  /* ---------------------------------------------------------------- */
  /* Composer                                                          */
  /* ---------------------------------------------------------------- */

  'mineflayer-chat.compose.mode': {
    en: ['What to send', 'What to send', 'What to send', 'What to send', 'What to send'],
    yue: ['send乜嘢', 'send乜嘢', 'send乜嘢', 'send乜嘢', 'send乜嘢']
  },
  'mineflayer-chat.compose.mode.message': {
    en: ['Message', 'Message', 'Message', 'Message', 'Message'],
    yue: ['訊息', '訊息', '訊息', '訊息', '訊息']
  },
  'mineflayer-chat.compose.mode.whisper': {
    en: ['Whisper', 'Whisper', 'Whisper', 'Whisper', 'Whisper'],
    yue: ['密語', '密語', '密語', '密語', '密語']
  },
  'mineflayer-chat.compose.mode.command': {
    en: ['Command', 'Command', 'Command', 'Command', 'Command'],
    yue: ['指令', '指令', '指令', '指令', '指令']
  },
  'mineflayer-chat.compose.recipient': {
    en: ['Whisper to', 'Whisper to', 'Whisper to', 'Whisper to', 'Whisper to']
    ,
    yue: ['密語畀', '密語畀', '密語畀', '密語畀', '密語畀']
  },
  'mineflayer-chat.compose.recipient.empty': {
    en: [
      'No players are listed yet',
      'No players are listed yet',
      'No players are listed yet',
      'Nobody is in the tab list yet',
      'Nobody is in the tab list yet'
    ],
    yue: [
      '暫時未有玩家列表',
      '暫時未有玩家列表',
      '暫時未有玩家列表',
      '玩家列表暫時空空如也',
      '玩家列表暫時空空如也'
    ]
  },
  'mineflayer-chat.compose.recipient.help': {
    en: [
      'The list comes from the server’s own tab list. A player who is not listed can still be typed in.',
      'The list comes from the server’s own tab list. A player who is not listed can still be typed in.',
      'The list is the server’s own tab list. Somebody not on it can still be typed in.',
      'The list is straight off the server’s tab list. If the person you want is hiding from it, type the name in yourself.',
      'The list is straight off the server’s tab list. If the person you want is hiding from it, type the name in yourself.'
    ],
    yue: [
      '呢個清單嚟自伺服器本身嘅玩家列表。唔喺清單嘅玩家亦都可以自己打名。',
      '呢個清單嚟自伺服器本身嘅玩家列表。唔喺清單嘅玩家亦都可以自己打名。',
      '清單就係伺服器嘅玩家列表。唔喺上面嘅，都可以自己打個名。',
      '清單直接由伺服器嘅玩家列表嚟。如果你想搵嗰個匿埋咗，自己打個名入去都得。',
      '清單直接由伺服器嘅玩家列表嚟。如果你想搵嗰個匿埋咗，自己打個名入去都得。'
    ]
  },
  'mineflayer-chat.compose.recipient.typed': {
    en: [
      'Type a name instead',
      'Type a name instead',
      'Type a name instead',
      'Type a name instead',
      'Type a name instead'
    ],
    yue: ['或者自己打個名', '或者自己打個名', '或者自己打個名', '或者自己打個名', '或者自己打個名']
  },
  'mineflayer-chat.compose.message': {
    en: ['Message text', 'Message text', 'Message text', 'What to say', 'What to say'],
    yue: ['訊息內容', '訊息內容', '訊息內容', '想講咩', '想講咩']
  },
  'mineflayer-chat.compose.command': {
    en: ['Command', 'Command', 'Command', 'The command', 'The command'],
    yue: ['指令', '指令', '指令', '條指令', '條指令']
  },
  'mineflayer-chat.compose.command.hint': {
    en: [
      'A leading slash is added if you leave it off.',
      'A leading slash is added if you leave it off.',
      'The leading slash is added for you if you forget it.',
      'Forget the leading slash and it gets put in for you. No judgement.',
      'Forget the leading slash and it gets put in for you. No judgement.'
    ],
    yue: [
      '如果冇打前面嗰個斜線，會自動幫你加返。',
      '如果冇打前面嗰個斜線，會自動幫你加返。',
      '唔記得打斜線嘅話，會自動幫你補返。',
      '唔記得打前面嗰個斜線？幫你補返，唔會笑你。',
      '唔記得打前面嗰個斜線？幫你補返，唔會笑你。'
    ]
  },
  'mineflayer-chat.compose.send': {
    en: ['Send', 'Send', 'Send', 'Send it', 'Send it'],
    yue: ['發送', '發送', '發送', 'send咗佢', 'send咗佢']
  },
  'mineflayer-chat.compose.complete': {
    en: [
      'Ask the server for completions',
      'Ask the server for completions',
      'Ask the server for completions',
      'Ask the server how this command finishes',
      'Ask the server how this command finishes'
    ],
    yue: [
      '向伺服器要補全建議',
      '向伺服器要補全建議',
      '問伺服器攞補全',
      '問下伺服器呢條指令點收尾',
      '問下伺服器呢條指令點收尾'
    ]
  },
  'mineflayer-chat.compose.complete.none': {
    en: [
      'The server offered no completions for that',
      'The server offered no completions for that',
      'The server had no completions for that',
      'The server has no idea how you meant to finish that',
      'The server has no idea how you meant to finish that'
    ],
    yue: [
      '伺服器冇提供任何補全建議',
      '伺服器冇提供任何補全建議',
      '伺服器對呢個冇補全建議',
      '伺服器完全估唔到你想點收尾',
      '伺服器完全估唔到你想點收尾'
    ]
  },
  'mineflayer-chat.compose.complete.failed': {
    en: [
      'The completion request failed: {reason}',
      'The completion request failed: {reason}',
      'The completion request failed: {reason}',
      'The completion request fell over: {reason}',
      'The completion request fell over: {reason}'
    ],
    yue: [
      '補全要求失敗：{reason}',
      '補全要求失敗：{reason}',
      '補全要求失敗：{reason}',
      '補全要求仆咗街：{reason}',
      '補全要求仆咗街：{reason}'
    ]
  },
  'mineflayer-chat.compose.length': {
    en: [
      '{used} of {limit} characters',
      '{used} of {limit} characters',
      '{used} of {limit} characters',
      '{used} of {limit} characters',
      '{used} of {limit} characters'
    ],
    yue: [
      '已用 {used} / {limit} 個字元',
      '已用 {used} / {limit} 個字元',
      '已用 {used} / {limit} 個字元',
      '已用 {used} / {limit} 個字元',
      '已用 {used} / {limit} 個字元'
    ]
  },
  'mineflayer-chat.compose.length.over': {
    en: [
      'Over the server’s limit of {limit} characters. The library splits a long message into several, so it will arrive as {parts} separate lines.',
      'Over the server’s limit of {limit} characters. The library splits a long message into several, so it will arrive as {parts} separate lines.',
      'Past the server’s {limit}-character limit. The library splits it, so it lands as {parts} separate lines.',
      'Past the server’s {limit}-character limit. The library chops it up, so everyone will see {parts} separate lines rather than one.',
      'Past the server’s {limit}-character limit. The library chops it up, so everyone will see {parts} separate lines rather than one.'
    ],
    yue: [
      '超出咗伺服器 {limit} 個字元嘅上限。程式庫會將長訊息拆開，所以會分成 {parts} 行送到。',
      '超出咗伺服器 {limit} 個字元嘅上限。程式庫會將長訊息拆開，所以會分成 {parts} 行送到。',
      '過咗伺服器 {limit} 字元上限。程式庫會拆開佢，所以會變 {parts} 行。',
      '爆咗伺服器 {limit} 字元上限。程式庫會斬件，所以人哋會見到 {parts} 行而唔係一行。',
      '爆咗伺服器 {limit} 字元上限。程式庫會斬件，所以人哋會見到 {parts} 行而唔係一行。'
    ]
  },
  'mineflayer-chat.compose.empty': {
    en: [
      'There is nothing to send yet',
      'There is nothing to send yet',
      'There is nothing to send yet',
      'The box is empty, so there is nothing to send',
      'The box is empty, so there is nothing to send'
    ],
    yue: [
      '而家冇嘢可以發送',
      '而家冇嘢可以發送',
      '而家冇嘢可以send',
      '個格吉住，冇嘢好send',
      '個格吉住，冇嘢好send'
    ]
  },
  'mineflayer-chat.compose.needRecipient': {
    en: [
      'A whisper needs a recipient',
      'A whisper needs a recipient',
      'A whisper needs a recipient',
      'A whisper needs somebody to whisper to',
      'A whisper needs somebody to whisper to'
    ],
    yue: [
      '密語要有收件人',
      '密語要有收件人',
      '密語要有收件人',
      '密語總要有個對象先得',
      '密語總要有個對象先得'
    ]
  },
  'mineflayer-chat.compose.sent': {
    en: ['Sent', 'Sent', 'Sent', 'Sent', 'Sent'],
    yue: ['已發送', '已發送', '已發送', '已send出', '已send出']
  },
  'mineflayer-chat.compose.commandWarning': {
    en: [
      'This is sent to the server as a command. What it does depends entirely on the server, and this application cannot undo it.',
      'This is sent to the server as a command. What it does depends entirely on the server, and this application cannot undo it.',
      'This goes to the server as a command. What happens next is up to the server, and nothing here can undo it.',
      'This goes to the server as a command. What happens next is entirely the server’s business, and nothing in this application can take it back.',
      'This goes to the server as a command. What happens next is entirely the server’s business, and nothing in this application can take it back.'
    ],
    yue: [
      '呢句會以指令形式送去伺服器。做到啲乜完全由伺服器決定，本程式無法復原。',
      '呢句會以指令形式送去伺服器。做到啲乜完全由伺服器決定，本程式無法復原。',
      '呢句會當指令send去伺服器。之後發生咩事由伺服器話事，呢度復原唔到。',
      '呢句會當指令send去伺服器。之後發生咩事完全係伺服器嘅事，本程式收唔返轉頭。',
      '呢句會當指令send去伺服器。之後發生咩事完全係伺服器嘅事，本程式收唔返轉頭。'
    ]
  },

  /* ---------------------------------------------------------------- */
  /* Rules                                                             */
  /* ---------------------------------------------------------------- */

  'mineflayer-chat.rules.search': {
    en: ['Search rules', 'Search rules', 'Search the rules', 'Search the rules', 'Search the rules'],
    yue: ['搜尋規則', '搜尋規則', '搵下啲規則', '搵下啲規則', '搵下啲規則']
  },
  'mineflayer-chat.rules.empty': {
    en: [
      'No pattern rules yet',
      'No pattern rules yet',
      'No pattern rules yet',
      'No rules yet, and nothing is watching the chat',
      'No rules yet, and nothing is watching the chat'
    ],
    yue: [
      '未有模式規則',
      '未有模式規則',
      '未有模式規則',
      '一條規則都未有，冇嘢喺度睇住個聊天',
      '一條規則都未有，冇嘢喺度睇住個聊天'
    ]
  },
  'mineflayer-chat.rules.empty.body': {
    en: [
      'Create a rule to match incoming messages with a pattern and take one action.',
      'Create a rule to match incoming messages with a pattern and take one action.',
      'Create a rule to watch for a pattern and do one thing when it matches.',
      'Create a rule, give it a pattern to watch for, and it will do exactly one thing when something matches.',
      'Create a rule, give it a pattern to watch for, and it will do exactly one thing when something matches.'
    ],
    yue: [
      '建立規則，用模式配對收到嘅訊息，然後執行一個動作。',
      '建立規則，用模式配對收到嘅訊息，然後執行一個動作。',
      '整條規則，睇住某個模式，配對到就做一件事。',
      '整條規則，畀個模式佢守住，一有嘢啱就做返一件事，剛剛好一件。',
      '整條規則，畀個模式佢守住，一有嘢啱就做返一件事，剛剛好一件。'
    ]
  },
  'mineflayer-chat.rules.new': {
    en: ['New rule', 'New rule', 'New rule', 'Make a new rule', 'Make a new rule'],
    yue: ['新增規則', '新增規則', '新增規則', '整條新規則', '整條新規則']
  },
  'mineflayer-chat.rules.edit': {
    en: ['Edit the rule', 'Edit the rule', 'Edit the rule', 'Edit the rule', 'Edit the rule'],
    yue: ['編輯規則', '編輯規則', '編輯規則', '編輯規則', '編輯規則']
  },
  'mineflayer-chat.rules.name': {
    en: ['Rule name', 'Rule name', 'Rule name', 'What to call it', 'What to call it'],
    yue: ['規則名稱', '規則名稱', '規則名稱', '叫佢乜名', '叫佢乜名']
  },
  'mineflayer-chat.rules.pattern': {
    en: ['Pattern', 'Pattern', 'Pattern', 'The pattern', 'The pattern'],
    yue: ['模式', '模式', '模式', '個模式', '個模式']
  },
  'mineflayer-chat.rules.pattern.help': {
    en: [
      'Matched against the message with its formatting removed. Open the builder to compose it and try it against real text.',
      'Matched against the message with its formatting removed. Open the builder to compose it and try it against real text.',
      'Matched against the plain words of the message. Open the builder to compose it and try it on real text.',
      'Matched against the plain words, formatting stripped. Open the builder to put it together and try it on text that actually arrived.',
      'Matched against the plain words, formatting stripped. Open the builder to put it together and try it on text that actually arrived.'
    ],
    yue: [
      '會用去除格式之後嘅訊息內容做配對。開建構器可以砌模式，同用真實文字試下。',
      '會用去除格式之後嘅訊息內容做配對。開建構器可以砌模式，同用真實文字試下。',
      '用訊息去晒格式嘅純文字做配對。開建構器砌模式，仲可以用真文字試。',
      '用去晒格式嘅純文字做配對。開建構器砌好佢，仲可以攞真係收過嘅文字試下。',
      '用去晒格式嘅純文字做配對。開建構器砌好佢，仲可以攞真係收過嘅文字試下。'
    ]
  },
  'mineflayer-chat.rules.builder': {
    en: [
      'Open the pattern builder',
      'Open the pattern builder',
      'Open the pattern builder',
      'Open the pattern builder',
      'Open the pattern builder'
    ],
    yue: ['開啟模式建構器', '開啟模式建構器', '開啟模式建構器', '開啟模式建構器', '開啟模式建構器']
  },
  'mineflayer-chat.rules.flags': {
    en: ['Flags', 'Flags', 'Flags', 'Flags', 'Flags'],
    yue: ['旗標', '旗標', '旗標', '旗標', '旗標']
  },
  'mineflayer-chat.rules.flags.help': {
    en: [
      'i ignores case, m makes ^ and $ match each line, s lets a dot match a newline, u turns on Unicode mode. The global and sticky flags are deliberately not offered: both carry a position between calls, so a rule using one would match every other message.',
      'i ignores case, m makes ^ and $ match each line, s lets a dot match a newline, u turns on Unicode mode. The global and sticky flags are deliberately not offered: both carry a position between calls, so a rule using one would match every other message.',
      'i ignores case, m makes ^ and $ match each line, s lets a dot match a newline, u turns on Unicode mode. Global and sticky are left out on purpose — both remember a position, so a rule using one would match every other message.',
      'i ignores case, m makes ^ and $ mind each line, s lets a dot swallow a newline, u turns on Unicode mode. Global and sticky are left out on purpose: both remember where they got to, so a rule wearing one would match every other message and look haunted rather than wrong.',
      'i ignores case, m makes ^ and $ mind each line, s lets a dot swallow a newline, u turns on Unicode mode. Global and sticky are left out on purpose: both remember where they got to, so a rule wearing one would match every other message and look haunted rather than wrong.'
    ],
    yue: [
      'i 唔分大小寫、m 令 ^ 同 $ 對每一行生效、s 令點號可以配對換行、u 開啟 Unicode 模式。global 同 sticky 係故意唔提供嘅：兩者都會記住位置，用咗嘅規則會變成隔一條先配對到。',
      'i 唔分大小寫、m 令 ^ 同 $ 對每一行生效、s 令點號可以配對換行、u 開啟 Unicode 模式。global 同 sticky 係故意唔提供嘅：兩者都會記住位置，用咗嘅規則會變成隔一條先配對到。',
      'i 唔理大細楷、m 令 ^ 同 $ 對每行生效、s 令點號食得換行、u 開 Unicode 模式。global 同 sticky 故意唔畀：佢哋會記住位置，用咗就會隔一條先中一次。',
      'i 唔理大細楷、m 令 ^ 同 $ 睇住每一行、s 令點號吞得落換行、u 開 Unicode 模式。global 同 sticky 係特登唔畀嘅：佢哋會記住行到邊，戴咗嘅規則會變成隔一條中一次，睇落好似鬧鬼多過壞咗。',
      'i 唔理大細楷、m 令 ^ 同 $ 睇住每一行、s 令點號吞得落換行、u 開 Unicode 模式。global 同 sticky 係特登唔畀嘅：佢哋會記住行到邊，戴咗嘅規則會變成隔一條中一次，睇落好似鬧鬼多過壞咗。'
    ]
  },
  'mineflayer-chat.rules.channels': {
    en: [
      'Channels this rule watches',
      'Channels this rule watches',
      'Channels this rule watches',
      'Channels this rule keeps an eye on',
      'Channels this rule keeps an eye on'
    ],
    yue: [
      '呢條規則監看嘅頻道',
      '呢條規則監看嘅頻道',
      '呢條規則監看嘅頻道',
      '呢條規則睇實邊啲頻道',
      '呢條規則睇實邊啲頻道'
    ]
  },
  'mineflayer-chat.rules.channels.help': {
    en: [
      'Messages this surface sent are never matched, and neither are the bot’s own messages. That is what stops a reply rule answering itself.',
      'Messages this surface sent are never matched, and neither are the bot’s own messages. That is what stops a reply rule answering itself.',
      'Messages sent from here are never matched, and neither are the bot’s own. That is what stops a reply rule talking to itself.',
      'Anything sent from here is never matched, and neither is anything the bot said itself. That is the whole reason a reply rule does not end up in conversation with itself all evening.',
      'Anything sent from here is never matched, and neither is anything the bot said itself. That is the whole reason a reply rule does not end up in conversation with itself all evening.'
    ],
    yue: [
      '由呢個介面發出嘅訊息永遠唔會被配對，機械人自己講嘅都唔會。呢個就係防止回覆規則自己覆自己嘅機制。',
      '由呢個介面發出嘅訊息永遠唔會被配對，機械人自己講嘅都唔會。呢個就係防止回覆規則自己覆自己嘅機制。',
      '由呢度send嘅訊息唔會被配對，機械人自己講嘅都唔會。咁先唔會出現回覆規則自己同自己傾偈。',
      '由呢度send嘅嘢一律唔配對，機械人自己講嘅都唔配對。就係因為咁，回覆規則先唔會同自己傾足一晚。',
      '由呢度send嘅嘢一律唔配對，機械人自己講嘅都唔配對。就係因為咁，回覆規則先唔會同自己傾足一晚。'
    ]
  },
  'mineflayer-chat.rules.action': {
    en: ['What it does', 'What it does', 'What it does', 'What it does', 'What it does'],
    yue: ['佢會做乜', '佢會做乜', '佢會做乜', '佢會做乜', '佢會做乜']
  },
  'mineflayer-chat.rules.action.notify': {
    en: ['Show a notification', 'Show a notification', 'Show a notification', 'Show a notification', 'Show a notification'],
    yue: ['顯示通知', '顯示通知', '顯示通知', '彈個通知', '彈個通知']
  },
  'mineflayer-chat.rules.action.reply': {
    en: [
      'Reply in chat',
      'Reply in chat',
      'Reply in chat',
      'Reply in chat, out loud',
      'Reply in chat, out loud'
    ],
    yue: ['喺聊天回覆', '喺聊天回覆', '喺聊天回覆', '喺聊天度出聲回覆', '喺聊天度出聲回覆']
  },
  'mineflayer-chat.rules.action.command': {
    en: ['Run a command', 'Run a command', 'Run a command', 'Run a command', 'Run a command'],
    yue: ['執行指令', '執行指令', '執行指令', '出條指令', '出條指令']
  },
  'mineflayer-chat.rules.action.stop': {
    en: [
      'Stop, and skip the rules below',
      'Stop, and skip the rules below',
      'Stop, and skip the rules below',
      'Stop here and let no other rule look at this message',
      'Stop here and let no other rule look at this message'
    ],
    yue: [
      '停止，並跳過下面嘅規則',
      '停止，並跳過下面嘅規則',
      '停止，跳過下面啲規則',
      '停喺呢度，唔畀下面任何規則再睇呢條訊息',
      '停喺呢度，唔畀下面任何規則再睇呢條訊息'
    ]
  },
  'mineflayer-chat.rules.payload.reply': {
    en: ['Reply text', 'Reply text', 'Reply text', 'What to say back', 'What to say back'],
    yue: ['回覆內容', '回覆內容', '回覆內容', '要覆返啲乜', '要覆返啲乜']
  },
  'mineflayer-chat.rules.payload.command': {
    en: ['Command to run', 'Command to run', 'Command to run', 'The command to fire', 'The command to fire'],
    yue: ['要執行嘅指令', '要執行嘅指令', '要執行嘅指令', '要扔出去嗰條指令', '要扔出去嗰條指令']
  },
  'mineflayer-chat.rules.payload.help': {
    en: [
      '$0 is replaced with the whole match and $1 to $9 with the pattern’s capture groups.',
      '$0 is replaced with the whole match and $1 to $9 with the pattern’s capture groups.',
      '$0 becomes the whole match, and $1 to $9 become the capture groups.',
      '$0 becomes the whole match, $1 through $9 become whatever the pattern captured. Use them and the reply stops sounding like a form letter.',
      '$0 becomes the whole match, $1 through $9 become whatever the pattern captured. Use them and the reply stops sounding like a form letter.'
    ],
    yue: [
      '$0 會換成整段配對結果，$1 至 $9 會換成模式嘅擷取群組。',
      '$0 會換成整段配對結果，$1 至 $9 會換成模式嘅擷取群組。',
      '$0 變成成段配對到嘅嘢，$1 至 $9 變成擷取群組。',
      '$0 變成成段配對到嘅嘢，$1 到 $9 變成擷取到嘅內容。用咗佢哋，個回覆就唔會似封範本信。',
      '$0 變成成段配對到嘅嘢，$1 到 $9 變成擷取到嘅內容。用咗佢哋，個回覆就唔會似封範本信。'
    ]
  },
  'mineflayer-chat.rules.cooldown': {
    en: ['Cooldown', 'Cooldown', 'Cooldown', 'How long it must wait', 'How long it must wait'],
    yue: ['冷卻時間', '冷卻時間', '冷卻時間', '要等幾耐先可以再嚟', '要等幾耐先可以再嚟']
  },
  'mineflayer-chat.rules.cooldown.help': {
    en: [
      'The shortest gap between two firings. A rule that speaks cannot go below two seconds, because a faster one turns a busy channel into a flood the server will act on.',
      'The shortest gap between two firings. A rule that speaks cannot go below two seconds, because a faster one turns a busy channel into a flood the server will act on.',
      'The shortest gap between two firings. A rule that speaks cannot go below two seconds — faster than that floods a busy channel, and servers act on that.',
      'The shortest gap between two firings. A rule that speaks is held to two seconds at the very least, because anything quicker turns a busy channel into a flood, and servers have opinions about floods.',
      'The shortest gap between two firings. A rule that speaks is held to two seconds at the very least, because anything quicker turns a busy channel into a flood, and servers have opinions about floods.'
    ],
    yue: [
      '兩次觸發之間嘅最短間隔。會講嘢嘅規則唔可以少過兩秒，因為再快就會令繁忙頻道洗版，伺服器會出手處理。',
      '兩次觸發之間嘅最短間隔。會講嘢嘅規則唔可以少過兩秒，因為再快就會令繁忙頻道洗版，伺服器會出手處理。',
      '兩次觸發之間最短要隔幾耐。會講嘢嘅規則最少兩秒——再快就會洗版，伺服器唔會坐視。',
      '兩次觸發之間最短要隔幾耐。會講嘢嘅規則死死哋都要兩秒，因為再快啲就變洗版，而伺服器對洗版好有意見。',
      '兩次觸發之間最短要隔幾耐。會講嘢嘅規則死死哋都要兩秒，因為再快啲就變洗版，而伺服器對洗版好有意見。'
    ]
  },
  'mineflayer-chat.rules.enabled': {
    en: ['Enabled', 'Enabled', 'Enabled', 'Armed', 'Armed'],
    yue: ['已啟用', '已啟用', '已啟用', '上咗膛', '上咗膛']
  },
  'mineflayer-chat.rules.willDo': {
    en: ['What this rule will do', 'What this rule will do', 'What this rule will do', 'What this rule will do', 'What this rule will do'],
    yue: ['呢條規則會做乜', '呢條規則會做乜', '呢條規則會做乜', '呢條規則會做乜', '呢條規則會做乜']
  },
  'mineflayer-chat.rules.willDo.notify': {
    en: [
      'When a message on {channels} matches, a notification appears here. Nothing is sent to the server.',
      'When a message on {channels} matches, a notification appears here. Nothing is sent to the server.',
      'When a message on {channels} matches, a notification appears here. Nothing goes to the server.',
      'When a message on {channels} matches, a notification pops up here and that is the whole of it. The server never hears a thing.',
      'When a message on {channels} matches, a notification pops up here and that is the whole of it. The server never hears a thing.'
    ],
    yue: [
      '當 {channels} 上嘅訊息配對成功，呢度會出現一個通知。唔會向伺服器發送任何嘢。',
      '當 {channels} 上嘅訊息配對成功，呢度會出現一個通知。唔會向伺服器發送任何嘢。',
      '{channels} 上有訊息啱嘅時候，呢度會彈個通知。唔會send任何嘢去伺服器。',
      '{channels} 上有訊息啱嘅時候，呢度彈個通知，就係咁多。伺服器完全聽唔到。',
      '{channels} 上有訊息啱嘅時候，呢度彈個通知，就係咁多。伺服器完全聽唔到。'
    ]
  },
  'mineflayer-chat.rules.willDo.reply': {
    en: [
      'When a message on {channels} matches, the bot sends “{payload}” in public chat, under your account, at most once every {cooldown} seconds. This speaks on your behalf and everyone on the server sees it.',
      'When a message on {channels} matches, the bot sends “{payload}” in public chat, under your account, at most once every {cooldown} seconds. This speaks on your behalf and everyone on the server sees it.',
      'When a message on {channels} matches, the bot says “{payload}” in public chat under your account, at most once every {cooldown} seconds. It is speaking on your behalf and the whole server sees it.',
      'When a message on {channels} matches, the bot says “{payload}” in public chat under your account, at most once every {cooldown} seconds. That is your name on it, in front of everybody, without you being there.',
      'When a message on {channels} matches, the bot says “{payload}” in public chat under your account, at most once every {cooldown} seconds. That is your name on it, in front of everybody, without you being there.'
    ],
    yue: [
      '當 {channels} 上嘅訊息配對成功，機械人會用你嘅帳號喺公開聊天發送「{payload}」，最快每 {cooldown} 秒一次。呢個係代你講嘢，全伺服器都見到。',
      '當 {channels} 上嘅訊息配對成功，機械人會用你嘅帳號喺公開聊天發送「{payload}」，最快每 {cooldown} 秒一次。呢個係代你講嘢，全伺服器都見到。',
      '{channels} 上有訊息啱嘅時候，機械人會用你嘅帳號喺公開聊天講「{payload}」，最快每 {cooldown} 秒一次。係代你講嘢，成個伺服器都見到。',
      '{channels} 上有訊息啱嘅時候，機械人會用你個帳號喺公開聊天講「{payload}」，最快每 {cooldown} 秒一次。即係掛住你個名，喺大庭廣眾講，而你根本唔喺度。',
      '{channels} 上有訊息啱嘅時候，機械人會用你個帳號喺公開聊天講「{payload}」，最快每 {cooldown} 秒一次。即係掛住你個名，喺大庭廣眾講，而你根本唔喺度。'
    ]
  },
  'mineflayer-chat.rules.willDo.command': {
    en: [
      'When a message on {channels} matches, the bot runs “{payload}” as a command, under your account, at most once every {cooldown} seconds. What that command does is entirely the server’s business and cannot be undone from here.',
      'When a message on {channels} matches, the bot runs “{payload}” as a command, under your account, at most once every {cooldown} seconds. What that command does is entirely the server’s business and cannot be undone from here.',
      'When a message on {channels} matches, the bot runs “{payload}” as a command under your account, at most once every {cooldown} seconds. What it does is the server’s business, and nothing here can undo it.',
      'When a message on {channels} matches, the bot fires “{payload}” as a command under your account, at most once every {cooldown} seconds. Whatever that command does is the server’s business entirely, and nothing here can take it back.',
      'When a message on {channels} matches, the bot fires “{payload}” as a command under your account, at most once every {cooldown} seconds. Whatever that command does is the server’s business entirely, and nothing here can take it back.'
    ],
    yue: [
      '當 {channels} 上嘅訊息配對成功，機械人會用你嘅帳號執行指令「{payload}」，最快每 {cooldown} 秒一次。條指令做到乜完全係伺服器嘅事，喺呢度復原唔到。',
      '當 {channels} 上嘅訊息配對成功，機械人會用你嘅帳號執行指令「{payload}」，最快每 {cooldown} 秒一次。條指令做到乜完全係伺服器嘅事，喺呢度復原唔到。',
      '{channels} 上有訊息啱嘅時候，機械人會用你嘅帳號行「{payload}」呢條指令，最快每 {cooldown} 秒一次。做到乜係伺服器嘅事，呢度復原唔到。',
      '{channels} 上有訊息啱嘅時候，機械人會用你個帳號扔出「{payload}」，最快每 {cooldown} 秒一次。條指令搞出咩嚟完全係伺服器嘅事，呢度收唔返轉頭。',
      '{channels} 上有訊息啱嘅時候，機械人會用你個帳號扔出「{payload}」，最快每 {cooldown} 秒一次。條指令搞出咩嚟完全係伺服器嘅事，呢度收唔返轉頭。'
    ]
  },
  'mineflayer-chat.rules.willDo.stop': {
    en: [
      'When a message on {channels} matches, no rule after this one looks at that message. Nothing is sent and nothing is shown.',
      'When a message on {channels} matches, no rule after this one looks at that message. Nothing is sent and nothing is shown.',
      'When a message on {channels} matches, no later rule sees that message. Nothing is sent and nothing is shown.',
      'When a message on {channels} matches, every rule below it is waved past. Nothing is sent, nothing is shown, the message simply stops here.',
      'When a message on {channels} matches, every rule below it is waved past. Nothing is sent, nothing is shown, the message simply stops here.'
    ],
    yue: [
      '當 {channels} 上嘅訊息配對成功，排喺後面嘅規則都唔會再睇嗰條訊息。唔會發送、唔會顯示。',
      '當 {channels} 上嘅訊息配對成功，排喺後面嘅規則都唔會再睇嗰條訊息。唔會發送、唔會顯示。',
      '{channels} 上有訊息啱嘅時候，後面嘅規則都唔會見到嗰條訊息。唔send、唔顯示。',
      '{channels} 上有訊息啱嘅時候，下面所有規則一律揮手放行。唔send、唔顯示，條訊息就喺呢度停低。',
      '{channels} 上有訊息啱嘅時候，下面所有規則一律揮手放行。唔send、唔顯示，條訊息就喺呢度停低。'
    ]
  },
  'mineflayer-chat.rules.speakWarning': {
    en: [
      'This rule will speak on your behalf',
      'This rule will speak on your behalf',
      'This rule will speak on your behalf',
      'This rule borrows your mouth',
      'This rule borrows your mouth'
    ],
    yue: [
      '呢條規則會代你講嘢',
      '呢條規則會代你講嘢',
      '呢條規則會代你講嘢',
      '呢條規則會借你把口',
      '呢條規則會借你把口'
    ]
  },
  'mineflayer-chat.rules.needPattern': {
    en: [
      'A rule needs a pattern that compiles',
      'A rule needs a pattern that compiles',
      'A rule needs a pattern that compiles',
      'A rule needs a pattern that actually compiles',
      'A rule needs a pattern that actually compiles'
    ],
    yue: [
      '規則需要一個可以編譯嘅模式',
      '規則需要一個可以編譯嘅模式',
      '規則要有個編譯得到嘅模式',
      '規則要有個真係編譯得到嘅模式先得',
      '規則要有個真係編譯得到嘅模式先得'
    ]
  },
  'mineflayer-chat.rules.needPayload': {
    en: [
      'A rule that replies or runs a command needs the text it will send',
      'A rule that replies or runs a command needs the text it will send',
      'A rule that replies or runs a command needs the text it will send',
      'A rule that speaks needs to be told what to say',
      'A rule that speaks needs to be told what to say'
    ],
    yue: [
      '會回覆或者執行指令嘅規則要有佢會發送嘅內容',
      '會回覆或者執行指令嘅規則要有佢會發送嘅內容',
      '會回覆或者出指令嘅規則要有內容先得',
      '會講嘢嘅規則，總要話畀佢知講乜先得',
      '會講嘢嘅規則，總要話畀佢知講乜先得'
    ]
  },
  'mineflayer-chat.rules.needChannel': {
    en: [
      'A rule needs at least one channel to watch',
      'A rule needs at least one channel to watch',
      'A rule needs at least one channel to watch',
      'A rule watching no channels would never do anything',
      'A rule watching no channels would never do anything'
    ],
    yue: [
      '規則最少要監看一個頻道',
      '規則最少要監看一個頻道',
      '規則最少要監看一個頻道',
      '一個頻道都唔睇嘅規則，永遠都唔會做到嘢',
      '一個頻道都唔睇嘅規則，永遠都唔會做到嘢'
    ]
  },
  'mineflayer-chat.rules.save': {
    en: ['Save the rule', 'Save the rule', 'Save the rule', 'Save the rule', 'Save the rule'],
    yue: ['儲存規則', '儲存規則', '儲存規則', '儲存規則', '儲存規則']
  },
  'mineflayer-chat.rules.cancel': {
    en: ['Cancel', 'Cancel', 'Cancel', 'Never mind', 'Never mind'],
    yue: ['取消', '取消', '取消', '算數', '算數']
  },
  'mineflayer-chat.rules.saved': {
    en: ['Rule saved', 'Rule saved', 'Rule saved', 'Rule saved', 'Rule saved'],
    yue: ['規則已儲存', '規則已儲存', '規則已儲存', '規則已儲存', '規則已儲存']
  },
  'mineflayer-chat.rules.fired': {
    en: [
      'Fired {count} times this session',
      'Fired {count} times this session',
      'Fired {count} times this session',
      'Fired {count} times this session',
      'Fired {count} times this session'
    ],
    yue: [
      '今次連線觸發咗 {count} 次',
      '今次連線觸發咗 {count} 次',
      '今次連線觸發咗 {count} 次',
      '今次連線觸發咗 {count} 次',
      '今次連線觸發咗 {count} 次'
    ]
  },
  'mineflayer-chat.rules.deleteIrreversible': {
    en: [
      'The selected rules and their patterns are removed from the settings file. Their firing counts are lost. The deletion is recorded in local history, and rebuilding a rule means writing its pattern again.',
      'The selected rules and their patterns are removed from the settings file. Their firing counts are lost. The deletion is recorded in local history, and rebuilding a rule means writing its pattern again.',
      'The selected rules and their patterns leave the settings file, and their firing counts go with them. The deletion is recorded in local history; rebuilding a rule means writing the pattern again.',
      'The selected rules and their patterns leave the settings file for good, firing counts and all. The deletion goes into local history, but rebuilding one means writing that pattern out again from scratch.',
      'The selected rules and their patterns leave the settings file for good, firing counts and all. The deletion goes into local history, but rebuilding one means writing that pattern out again from scratch.'
    ],
    yue: [
      '選取嘅規則同佢哋嘅模式會由設定檔移除，觸發次數亦會消失。今次刪除會寫入本機歷史；想重建規則就要重新寫過個模式。',
      '選取嘅規則同佢哋嘅模式會由設定檔移除，觸發次數亦會消失。今次刪除會寫入本機歷史；想重建規則就要重新寫過個模式。',
      '揀咗嘅規則同模式會離開設定檔，觸發次數一齊冇埋。今次刪除會寫入本機歷史；想重建就要重新寫過個模式。',
      '揀咗嘅規則同模式會永久離開設定檔，連觸發次數都一齊走。今次刪除會入本機歷史，不過想重建就要由零再寫過個模式。',
      '揀咗嘅規則同模式會永久離開設定檔，連觸發次數都一齊走。今次刪除會入本機歷史，不過想重建就要由零再寫過個模式。'
    ]
  },
  'mineflayer-chat.rules.deleted': {
    en: ['{count} rules removed', '{count} rules removed', '{count} rules removed', '{count} rules removed', '{count} rules removed'],
    yue: ['已移除 {count} 條規則', '已移除 {count} 條規則', '已移除 {count} 條規則', '已移除 {count} 條規則', '已移除 {count} 條規則']
  },
  'mineflayer-chat.rules.bulkEnable': {
    en: ['Enable', 'Enable', 'Enable', 'Arm them', 'Arm them'],
    yue: ['啟用', '啟用', '啟用', '全部上膛', '全部上膛']
  },
  'mineflayer-chat.rules.bulkDisable': {
    en: ['Disable', 'Disable', 'Disable', 'Stand them down', 'Stand them down'],
    yue: ['停用', '停用', '停用', '全部落膛', '全部落膛']
  },
  'mineflayer-chat.rules.bulkEnableConfirm': {
    en: [
      'Enabling {count} rules, of which {speaking} will send messages or run commands under your account without asking again.',
      'Enabling {count} rules, of which {speaking} will send messages or run commands under your account without asking again.',
      'Enabling {count} rules; {speaking} of them will send messages or run commands under your account without asking again.',
      'Arming {count} rules, and {speaking} of them will send messages or run commands under your account without stopping to ask again.',
      'Arming {count} rules, and {speaking} of them will send messages or run commands under your account without stopping to ask again.'
    ],
    yue: [
      '將會啟用 {count} 條規則，其中 {speaking} 條會用你嘅帳號發送訊息或者執行指令，唔會再問過你。',
      '將會啟用 {count} 條規則，其中 {speaking} 條會用你嘅帳號發送訊息或者執行指令，唔會再問過你。',
      '將會啟用 {count} 條規則，當中 {speaking} 條會用你嘅帳號send訊息或者出指令，唔會再問你。',
      '將會上膛 {count} 條規則，其中 {speaking} 條會用你個帳號send訊息或者出指令，唔會再停低問你一句。',
      '將會上膛 {count} 條規則，其中 {speaking} 條會用你個帳號send訊息或者出指令，唔會再停低問你一句。'
    ]
  },
  'mineflayer-chat.rules.enabledCount': {
    en: [
      '{count} rules enabled, {speaking} of which speak',
      '{count} rules enabled, {speaking} of which speak',
      '{count} rules enabled, {speaking} of which speak',
      '{count} rules armed, {speaking} of them with a voice',
      '{count} rules armed, {speaking} of them with a voice'
    ],
    yue: [
      '已啟用 {count} 條規則，其中 {speaking} 條會講嘢',
      '已啟用 {count} 條規則，其中 {speaking} 條會講嘢',
      '已啟用 {count} 條規則，當中 {speaking} 條會講嘢',
      '上咗膛 {count} 條規則，其中 {speaking} 條識講嘢',
      '上咗膛 {count} 條規則，其中 {speaking} 條識講嘢'
    ]
  },
  'mineflayer-chat.rules.budget': {
    en: [
      '{used} of {total} messages sent by rules in the last minute',
      '{used} of {total} messages sent by rules in the last minute',
      '{used} of {total} messages sent by rules in the last minute',
      '{used} of {total} messages sent by rules in the last minute',
      '{used} of {total} messages sent by rules in the last minute'
    ],
    yue: [
      '過去一分鐘規則已發送 {used} / {total} 條訊息',
      '過去一分鐘規則已發送 {used} / {total} 條訊息',
      '過去一分鐘規則已發送 {used} / {total} 條訊息',
      '過去一分鐘規則已發送 {used} / {total} 條訊息',
      '過去一分鐘規則已發送 {used} / {total} 條訊息'
    ]
  },
  'mineflayer-chat.rule.matched': {
    en: ['A chat rule matched', 'A chat rule matched', 'A chat rule matched', 'A chat rule caught something', 'A chat rule caught something'],
    yue: ['有聊天規則配對成功', '有聊天規則配對成功', '有聊天規則中咗', '有聊天規則捉到嘢', '有聊天規則捉到嘢']
  },
  'mineflayer-chat.rule.matched.body': {
    en: ['{rule} matched: {message}', '{rule} matched: {message}', '{rule} matched: {message}', '{rule} caught this: {message}', '{rule} caught this: {message}'],
    yue: ['{rule} 配對到：{message}', '{rule} 配對到：{message}', '{rule} 中咗：{message}', '{rule} 捉到呢條：{message}', '{rule} 捉到呢條：{message}']
  },
  'mineflayer-chat.rule.notSent': {
    en: [
      'A chat rule could not send',
      'A chat rule could not send',
      'A chat rule could not send',
      'A chat rule had nothing to speak through',
      'A chat rule had nothing to speak through'
    ],
    yue: [
      '有聊天規則發送唔到',
      '有聊天規則發送唔到',
      '有聊天規則send唔到',
      '有聊天規則想講嘢但係冇把口',
      '有聊天規則想講嘢但係冇把口'
    ]
  },
  'mineflayer-chat.rule.notSent.body': {
    en: [
      '{rule} matched, but the bot is not connected, so nothing was sent.',
      '{rule} matched, but the bot is not connected, so nothing was sent.',
      '{rule} matched, but the bot is not connected, so nothing went out.',
      '{rule} matched, but the bot is not connected, so the whole thing went nowhere.',
      '{rule} matched, but the bot is not connected, so the whole thing went nowhere.'
    ],
    yue: [
      '{rule} 配對成功，但係機械人未連線，所以乜都冇發送。',
      '{rule} 配對成功，但係機械人未連線，所以乜都冇發送。',
      '{rule} 中咗，但機械人未連線，所以乜都冇send出去。',
      '{rule} 中咗，但機械人未連線，所以成件事都去唔到邊。',
      '{rule} 中咗，但機械人未連線，所以成件事都去唔到邊。'
    ]
  },
  'mineflayer-chat.rule.budget': {
    en: [
      'The reply budget is spent',
      'The reply budget is spent',
      'The reply budget is spent',
      'The reply budget has run dry',
      'The reply budget has run dry'
    ],
    yue: ['回覆額度已用完', '回覆額度已用完', '回覆額度用晒', '回覆額度乾塘', '回覆額度乾塘']
  },
  'mineflayer-chat.rule.budget.body': {
    en: [
      '{rule} matched but was not sent: this surface has already sent its allowance of {budget} messages in the last minute. Raise the allowance in settings, or turn the rule off.',
      '{rule} matched but was not sent: this surface has already sent its allowance of {budget} messages in the last minute. Raise the allowance in settings, or turn the rule off.',
      '{rule} matched but nothing was sent: the allowance of {budget} messages a minute is already used up. Raise it in settings, or turn the rule off.',
      '{rule} matched, but the allowance of {budget} messages a minute is already spent, so it stayed quiet. Raise the allowance in settings, or stand the rule down.',
      '{rule} matched, but the allowance of {budget} messages a minute is already spent, so it stayed quiet. Raise the allowance in settings, or stand the rule down.'
    ],
    yue: [
      '{rule} 配對成功但冇發送：呢個介面過去一分鐘已經用晒 {budget} 條訊息嘅額度。可以喺設定調高額度，或者停用呢條規則。',
      '{rule} 配對成功但冇發送：呢個介面過去一分鐘已經用晒 {budget} 條訊息嘅額度。可以喺設定調高額度，或者停用呢條規則。',
      '{rule} 中咗但冇send：每分鐘 {budget} 條嘅額度用晒。去設定調高，或者停用呢條規則。',
      '{rule} 中咗，但每分鐘 {budget} 條嘅額度用乾咗，所以佢收咗聲。去設定調高，或者索性停用佢。',
      '{rule} 中咗，但每分鐘 {budget} 條嘅額度用乾咗，所以佢收咗聲。去設定調高，或者索性停用佢。'
    ]
  },

  /* ---------------------------------------------------------------- */
  /* Server text read-outs                                             */
  /* ---------------------------------------------------------------- */

  'mineflayer-chat.server.tablist': {
    en: ['Tab list', 'Tab list', 'Tab list', 'The tab list', 'The tab list'],
    yue: ['玩家列表', '玩家列表', '玩家列表', '個玩家列表', '個玩家列表']
  },
  'mineflayer-chat.server.tablist.search': {
    en: ['Search players', 'Search players', 'Search the players', 'Search the players', 'Search the players'],
    yue: ['搜尋玩家', '搜尋玩家', '搵下啲玩家', '搵下啲玩家', '搵下啲玩家']
  },
  'mineflayer-chat.server.tablist.empty': {
    en: [
      'The tab list is empty',
      'The tab list is empty',
      'The tab list is empty',
      'Nobody is on the tab list',
      'Nobody is on the tab list'
    ],
    yue: ['玩家列表係空嘅', '玩家列表係空嘅', '玩家列表空吓空吓', '玩家列表一個人都冇', '玩家列表一個人都冇']
  },
  'mineflayer-chat.server.player.ping': {
    en: ['Ping', 'Ping', 'Ping', 'Ping', 'Ping'],
    yue: ['延遲', '延遲', '延遲', '延遲', '延遲']
  },
  'mineflayer-chat.server.player.gamemode': {
    en: ['Game mode', 'Game mode', 'Game mode', 'Game mode', 'Game mode'],
    yue: ['遊戲模式', '遊戲模式', '遊戲模式', '遊戲模式', '遊戲模式']
  },
  'mineflayer-chat.server.player.name': {
    en: ['Player', 'Player', 'Player', 'Player', 'Player'],
    yue: ['玩家', '玩家', '玩家', '玩家', '玩家']
  },
  'mineflayer-chat.server.gamemode.0': {
    en: ['Survival', 'Survival', 'Survival', 'Survival', 'Survival'],
    yue: ['生存', '生存', '生存', '生存', '生存']
  },
  'mineflayer-chat.server.gamemode.1': {
    en: ['Creative', 'Creative', 'Creative', 'Creative', 'Creative'],
    yue: ['創造', '創造', '創造', '創造', '創造']
  },
  'mineflayer-chat.server.gamemode.2': {
    en: ['Adventure', 'Adventure', 'Adventure', 'Adventure', 'Adventure'],
    yue: ['冒險', '冒險', '冒險', '冒險', '冒險']
  },
  'mineflayer-chat.server.gamemode.3': {
    en: ['Spectator', 'Spectator', 'Spectator', 'Spectator', 'Spectator'],
    yue: ['旁觀', '旁觀', '旁觀', '旁觀', '旁觀']
  },
  'mineflayer-chat.server.gamemode.unknown': {
    en: [
      'Mode {value}',
      'Mode {value}',
      'Mode {value}',
      'Mode {value}, whatever that is',
      'Mode {value}, whatever that is'
    ],
    yue: ['模式 {value}', '模式 {value}', '模式 {value}', '模式 {value}，唔知係乜', '模式 {value}，唔知係乜']
  },
  'mineflayer-chat.server.tablist.header': {
    en: ['Tab list header', 'Tab list header', 'Tab list header', 'Tab list header', 'Tab list header'],
    yue: ['玩家列表頁首', '玩家列表頁首', '玩家列表頁首', '玩家列表頁首', '玩家列表頁首']
  },
  'mineflayer-chat.server.tablist.footer': {
    en: ['Tab list footer', 'Tab list footer', 'Tab list footer', 'Tab list footer', 'Tab list footer'],
    yue: ['玩家列表頁尾', '玩家列表頁尾', '玩家列表頁尾', '玩家列表頁尾', '玩家列表頁尾']
  },
  'mineflayer-chat.server.bossbars': {
    en: ['Boss bars', 'Boss bars', 'Boss bars', 'Boss bars', 'Boss bars'],
    yue: ['Boss 血條', 'Boss 血條', 'Boss 血條', 'Boss 血條', 'Boss 血條']
  },
  'mineflayer-chat.server.bossbars.empty': {
    en: [
      'No boss bars are showing',
      'No boss bars are showing',
      'No boss bars are showing',
      'Nothing is dramatic enough for a boss bar right now',
      'Nothing is dramatic enough for a boss bar right now'
    ],
    yue: [
      '而家冇 Boss 血條',
      '而家冇 Boss 血條',
      '而家冇 Boss 血條',
      '而家冇嘢戲劇性到要出 Boss 血條',
      '而家冇嘢戲劇性到要出 Boss 血條'
    ]
  },
  'mineflayer-chat.server.bossbar.progress': {
    en: [
      '{percent} percent, colour {color}',
      '{percent} percent, colour {color}',
      '{percent} percent, colour {color}',
      '{percent} percent, colour {color}',
      '{percent} percent, colour {color}'
    ],
    yue: [
      '{percent} 百分比，顏色 {color}',
      '{percent} 百分比，顏色 {color}',
      '{percent} 百分比，顏色 {color}',
      '{percent} 百分比，顏色 {color}',
      '{percent} 百分比，顏色 {color}'
    ]
  },
  'mineflayer-chat.server.bossbar.dragon': {
    en: ['Dragon bar', 'Dragon bar', 'Dragon bar', 'Dragon bar', 'Dragon bar'],
    yue: ['末影龍血條', '末影龍血條', '末影龍血條', '末影龍血條', '末影龍血條']
  },
  'mineflayer-chat.server.bossbar.fog': {
    en: ['Creates fog', 'Creates fog', 'Creates fog', 'Creates fog', 'Creates fog'],
    yue: ['會產生迷霧', '會產生迷霧', '會產生迷霧', '會產生迷霧', '會產生迷霧']
  },
  'mineflayer-chat.server.bossbar.darkenSky': {
    en: ['Darkens the sky', 'Darkens the sky', 'Darkens the sky', 'Darkens the sky', 'Darkens the sky'],
    yue: ['會令天空變暗', '會令天空變暗', '會令天空變暗', '會令天空變暗', '會令天空變暗']
  },
  'mineflayer-chat.server.scoreboards': {
    en: ['Scoreboards', 'Scoreboards', 'Scoreboards', 'Scoreboards', 'Scoreboards'],
    yue: ['計分板', '計分板', '計分板', '計分板', '計分板']
  },
  'mineflayer-chat.server.scoreboards.empty': {
    en: [
      'No scoreboards are showing',
      'No scoreboards are showing',
      'No scoreboards are showing',
      'Nobody is keeping score right now',
      'Nobody is keeping score right now'
    ],
    yue: ['而家冇計分板', '而家冇計分板', '而家冇計分板', '而家冇人計緊分', '而家冇人計緊分']
  },
  'mineflayer-chat.server.scoreboard.slots': {
    en: [
      'Shown in {slots}',
      'Shown in {slots}',
      'Shown in {slots}',
      'Shown in {slots}',
      'Shown in {slots}'
    ],
    yue: ['顯示喺 {slots}', '顯示喺 {slots}', '顯示喺 {slots}', '顯示喺 {slots}', '顯示喺 {slots}']
  },
  'mineflayer-chat.server.scoreboard.noSlot': {
    en: [
      'Not currently in a display slot',
      'Not currently in a display slot',
      'Not currently in a display slot',
      'Registered, but nowhere on screen',
      'Registered, but nowhere on screen'
    ],
    yue: [
      '暫時唔喺任何顯示欄位',
      '暫時唔喺任何顯示欄位',
      '暫時唔喺任何顯示欄位',
      '登記咗，但畫面上邊度都搵唔到',
      '登記咗，但畫面上邊度都搵唔到'
    ]
  },
  'mineflayer-chat.server.teams': {
    en: ['Teams', 'Teams', 'Teams', 'Teams', 'Teams'],
    yue: ['隊伍', '隊伍', '隊伍', '隊伍', '隊伍']
  },
  'mineflayer-chat.server.teams.empty': {
    en: [
      'No teams are defined',
      'No teams are defined',
      'No teams are defined',
      'Nobody has been put in a team',
      'Nobody has been put in a team'
    ],
    yue: ['未定義任何隊伍', '未定義任何隊伍', '未定義任何隊伍', '冇人被編入任何隊伍', '冇人被編入任何隊伍']
  },
  'mineflayer-chat.server.team.members': {
    en: [
      '{count} members',
      '{count} members',
      '{count} members',
      '{count} members',
      '{count} members'
    ],
    yue: ['{count} 位成員', '{count} 位成員', '{count} 位成員', '{count} 位成員', '{count} 位成員']
  },
  'mineflayer-chat.server.team.friendlyFire': {
    en: ['Friendly fire is on', 'Friendly fire is on', 'Friendly fire is on', 'Friendly fire is on', 'Friendly fire is on'],
    yue: ['開咗友軍傷害', '開咗友軍傷害', '開咗友軍傷害', '開咗友軍傷害', '開咗友軍傷害']
  },
  'mineflayer-chat.server.team.noFriendlyFire': {
    en: ['Friendly fire is off', 'Friendly fire is off', 'Friendly fire is off', 'Friendly fire is off', 'Friendly fire is off'],
    yue: ['閂咗友軍傷害', '閂咗友軍傷害', '閂咗友軍傷害', '閂咗友軍傷害', '閂咗友軍傷害']
  },
  'mineflayer-chat.server.title': {
    en: ['Title and action bar', 'Title and action bar', 'Title and action bar', 'Title and action bar', 'Title and action bar'],
    yue: ['標題同動作列', '標題同動作列', '標題同動作列', '標題同動作列', '標題同動作列']
  },
  'mineflayer-chat.server.title.empty': {
    en: [
      'No title is showing',
      'No title is showing',
      'No title is showing',
      'The screen is not shouting anything at you',
      'The screen is not shouting anything at you'
    ],
    yue: ['而家冇標題', '而家冇標題', '而家冇標題', '個畫面而家冇嗌緊嘢', '個畫面而家冇嗌緊嘢']
  },
  'mineflayer-chat.server.title.label': {
    en: ['Title', 'Title', 'Title', 'Title', 'Title'],
    yue: ['標題', '標題', '標題', '標題', '標題']
  },
  'mineflayer-chat.server.subtitle.label': {
    en: ['Subtitle', 'Subtitle', 'Subtitle', 'Subtitle', 'Subtitle'],
    yue: ['副標題', '副標題', '副標題', '副標題', '副標題']
  },
  'mineflayer-chat.server.actionbar.label': {
    en: ['Action bar', 'Action bar', 'Action bar', 'Action bar', 'Action bar'],
    yue: ['動作列', '動作列', '動作列', '動作列', '動作列']
  },
  'mineflayer-chat.server.title.times': {
    en: [
      'Fades in over {fadeIn} ticks, stays {stay}, fades out over {fadeOut}',
      'Fades in over {fadeIn} ticks, stays {stay}, fades out over {fadeOut}',
      'Fades in over {fadeIn} ticks, stays {stay}, fades out over {fadeOut}',
      'Fades in over {fadeIn} ticks, stays {stay}, fades out over {fadeOut}',
      'Fades in over {fadeIn} ticks, stays {stay}, fades out over {fadeOut}'
    ],
    yue: [
      '淡入 {fadeIn} tick、停留 {stay}、淡出 {fadeOut}',
      '淡入 {fadeIn} tick、停留 {stay}、淡出 {fadeOut}',
      '淡入 {fadeIn} tick、停留 {stay}、淡出 {fadeOut}',
      '淡入 {fadeIn} tick、停留 {stay}、淡出 {fadeOut}',
      '淡入 {fadeIn} tick、停留 {stay}、淡出 {fadeOut}'
    ]
  },
  'mineflayer-chat.server.refresh': {
    en: [
      'Re-read the server state',
      'Re-read the server state',
      'Re-read the server state',
      'Ask the server for all of that again',
      'Ask the server for all of that again'
    ],
    yue: [
      '重新讀取伺服器狀態',
      '重新讀取伺服器狀態',
      '重新讀取伺服器狀態',
      '再問伺服器攞多次全部嘢',
      '再問伺服器攞多次全部嘢'
    ]
  },

  /* ---------------------------------------------------------------- */
  /* Settings                                                          */
  /* ---------------------------------------------------------------- */

  'mineflayer-chat.setting.retention': {
    en: [
      'Messages kept in the log',
      'Messages kept in the log',
      'Messages kept in the log',
      'How many messages to hang on to',
      'How many messages to hang on to'
    ],
    yue: [
      '紀錄保留嘅訊息數目',
      '紀錄保留嘅訊息數目',
      '紀錄保留嘅訊息數目',
      '要留住幾多條訊息',
      '要留住幾多條訊息'
    ]
  },
  'mineflayer-chat.setting.retention.description': {
    en: [
      'The log is held in memory only and is never written to disk. When it is full the oldest message is dropped, and the count of dropped messages is shown above the log so a gap is visible rather than silent.',
      'The log is held in memory only and is never written to disk. When it is full the oldest message is dropped, and the count of dropped messages is shown above the log so a gap is visible rather than silent.',
      'The log lives in memory and never touches the disk. When it is full the oldest goes, and the number dropped is shown above the log so the gap is visible.',
      'The log lives in memory and never touches the disk. Once it is full the oldest line walks the plank, and the count of the departed is shown above the log so you can see the gap rather than wonder about it.',
      'The log lives in memory and never touches the disk. Once it is full the oldest line walks the plank, and the count of the departed is shown above the log so you can see the gap rather than wonder about it.'
    ],
    yue: [
      '紀錄只係存喺記憶體，唔會寫落硬碟。滿咗就會捨棄最舊嗰條，而被捨棄嘅數目會喺紀錄上方顯示，令缺口睇得見而唔係靜靜雞消失。',
      '紀錄只係存喺記憶體，唔會寫落硬碟。滿咗就會捨棄最舊嗰條，而被捨棄嘅數目會喺紀錄上方顯示，令缺口睇得見而唔係靜靜雞消失。',
      '紀錄住喺記憶體，唔會掂硬碟。滿咗就掉最舊嗰條，掉咗幾多會喺紀錄上面寫住，睇得見。',
      '紀錄住喺記憶體，硬碟一下都唔掂。一滿，最舊嗰行就要行船板，而走咗幾多會列喺紀錄上面，等你見到個缺口而唔使自己估。',
      '紀錄住喺記憶體，硬碟一下都唔掂。一滿，最舊嗰行就要行船板，而走咗幾多會列喺紀錄上面，等你見到個缺口而唔使自己估。'
    ]
  },
  'mineflayer-chat.setting.timestamps': {
    en: [
      'Show a timestamp on every message',
      'Show a timestamp on every message',
      'Show a timestamp on every message',
      'Put a clock beside every message',
      'Put a clock beside every message'
    ],
    yue: [
      '每條訊息顯示時間',
      '每條訊息顯示時間',
      '每條訊息顯示時間',
      '每條訊息旁邊擺個鐘',
      '每條訊息旁邊擺個鐘'
    ]
  },
  'mineflayer-chat.setting.timestamps.description': {
    en: [
      'The time each message reached this window, which is not necessarily the time the server sent it. Turning it off saves a column on a narrow layout; the timestamp is still exported either way.',
      'The time each message reached this window, which is not necessarily the time the server sent it. Turning it off saves a column on a narrow layout; the timestamp is still exported either way.',
      'The time each message reached this window — not necessarily when the server sent it. Off saves a column on a narrow layout, and the timestamp is exported either way.',
      'The time each message reached this window, which is not quite the same as when the server sent it. Turn it off to win back a column on a narrow layout; the timestamp still rides along in every export regardless.',
      'The time each message reached this window, which is not quite the same as when the server sent it. Turn it off to win back a column on a narrow layout; the timestamp still rides along in every export regardless.'
    ],
    yue: [
      '訊息到達呢個視窗嘅時間，未必等於伺服器發送嘅時間。閂咗可以喺窄版面慳返一欄；不過無論點都會匯出時間。',
      '訊息到達呢個視窗嘅時間，未必等於伺服器發送嘅時間。閂咗可以喺窄版面慳返一欄；不過無論點都會匯出時間。',
      '訊息到呢個視窗嘅時間，未必係伺服器send嗰陣。閂咗喺窄版面慳返一欄，匯出照樣有時間。',
      '訊息到呢個視窗嘅時間，同伺服器send嗰刻唔完全一樣。閂咗可以喺窄版面贏返一欄；不過匯出嗰陣時間照樣跟住去。',
      '訊息到呢個視窗嘅時間，同伺服器send嗰刻唔完全一樣。閂咗可以喺窄版面贏返一欄；不過匯出嗰陣時間照樣跟住去。'
    ]
  },
  'mineflayer-chat.setting.autoScroll': {
    en: [
      'Follow the newest message',
      'Follow the newest message',
      'Follow the newest message',
      'Keep chasing the newest message',
      'Keep chasing the newest message'
    ],
    yue: [
      '跟住最新嘅訊息',
      '跟住最新嘅訊息',
      '跟住最新嘅訊息',
      '一路追住最新嗰條',
      '一路追住最新嗰條'
    ]
  },
  'mineflayer-chat.setting.autoScroll.description': {
    en: [
      'Scrolls to the bottom as messages arrive. Scrolling up by hand suspends it until you return to the bottom, so reading back is not interrupted by a busy channel.',
      'Scrolls to the bottom as messages arrive. Scrolling up by hand suspends it until you return to the bottom, so reading back is not interrupted by a busy channel.',
      'Scrolls to the bottom as messages arrive. Scroll up by hand and it waits until you come back down, so a busy channel cannot yank you away mid-sentence.',
      'Scrolls to the bottom as messages arrive. Scroll up yourself and it politely waits until you come back down, so a busy channel cannot drag you away halfway through reading something.',
      'Scrolls to the bottom as messages arrive. Scroll up yourself and it politely waits until you come back down, so a busy channel cannot drag you away halfway through reading something.'
    ],
    yue: [
      '有新訊息就捲到最底。自己向上捲會暫停呢個行為，直到你返到最底為止，咁樣睇返舊嘢就唔會俾繁忙頻道打斷。',
      '有新訊息就捲到最底。自己向上捲會暫停呢個行為，直到你返到最底為止，咁樣睇返舊嘢就唔會俾繁忙頻道打斷。',
      '有新訊息就捲到底。自己捲上去佢就會等你返落底先繼續，睇緊嘢唔會俾繁忙頻道扯走。',
      '有新訊息就捲到底。你自己捲上去，佢會好禮貌咁等你返落底先郁，唔會喺你睇到一半嗰陣扯你走。',
      '有新訊息就捲到底。你自己捲上去，佢會好禮貌咁等你返落底先郁，唔會喺你睇到一半嗰陣扯你走。'
    ]
  },
  'mineflayer-chat.setting.rulesEnabled': {
    en: [
      'Run the pattern rules',
      'Run the pattern rules',
      'Run the pattern rules',
      'Let the pattern rules run',
      'Let the pattern rules run'
    ],
    yue: [
      '執行模式規則',
      '執行模式規則',
      '執行模式規則',
      '畀啲模式規則行',
      '畀啲模式規則行'
    ]
  },
  'mineflayer-chat.setting.rulesEnabled.description': {
    en: [
      'The master switch for every rule. Turning it off stops all matching immediately, including rules that reply or run commands, without changing any rule’s own enabled state.',
      'The master switch for every rule. Turning it off stops all matching immediately, including rules that reply or run commands, without changing any rule’s own enabled state.',
      'The master switch. Off stops all matching at once, including rules that reply or run commands, and no rule’s own switch is touched.',
      'The master switch, and the one to reach for in a hurry. Off stops every rule dead, replies and commands included, and no individual rule’s own switch is disturbed while it is off.',
      'The master switch, and the one to reach for in a hurry. Off stops every rule dead, replies and commands included, and no individual rule’s own switch is disturbed while it is off.'
    ],
    yue: [
      '所有規則嘅總掣。閂咗會即刻停止所有配對，包括會回覆同執行指令嘅規則，而唔會改動任何一條規則自己嘅啟用狀態。',
      '所有規則嘅總掣。閂咗會即刻停止所有配對，包括會回覆同執行指令嘅規則，而唔會改動任何一條規則自己嘅啟用狀態。',
      '總掣。閂咗即刻停晒所有配對，包括會回覆同出指令嗰啲，每條規則自己個掣都唔會郁到。',
      '總掣，趕時間就撳呢個。閂咗全部規則即刻死火，回覆同指令都停埋，而每條規則自己個掣半分都唔會郁。',
      '總掣，趕時間就撳呢個。閂咗全部規則即刻死火，回覆同指令都停埋，而每條規則自己個掣半分都唔會郁。'
    ]
  },
  'mineflayer-chat.setting.replyBudget': {
    en: [
      'Messages rules may send each minute',
      'Messages rules may send each minute',
      'Messages rules may send each minute',
      'How much the rules are allowed to say each minute',
      'How much the rules are allowed to say each minute'
    ],
    yue: [
      '規則每分鐘可以發送嘅訊息數',
      '規則每分鐘可以發送嘅訊息數',
      '規則每分鐘可以send幾多條',
      '啲規則每分鐘准講幾多',
      '啲規則每分鐘准講幾多'
    ]
  },
  'mineflayer-chat.setting.replyBudget.description': {
    en: [
      'A shared ceiling across every rule, on top of each rule’s own cooldown. Reaching it raises a warning rather than sending; set it to zero to stop rules sending anything at all while leaving the notify rules working.',
      'A shared ceiling across every rule, on top of each rule’s own cooldown. Reaching it raises a warning rather than sending; set it to zero to stop rules sending anything at all while leaving the notify rules working.',
      'A ceiling shared by every rule, on top of each rule’s own cooldown. Hitting it raises a warning instead of sending. Zero stops rules sending anything while notify rules keep working.',
      'One ceiling shared by all the rules, sitting on top of each rule’s own cooldown. Hit it and you get a warning rather than a message going out. Set it to zero and the speaking rules go mute while the notify ones carry on as normal.',
      'One ceiling shared by all the rules, sitting on top of each rule’s own cooldown. Hit it and you get a warning rather than a message going out. Set it to zero and the speaking rules go mute while the notify ones carry on as normal.'
    ],
    yue: [
      '所有規則共用嘅上限，加喺每條規則自己嘅冷卻時間之上。到咗上限會發出警告而唔會發送；設做零就可以完全停止規則發送任何嘢，同時保留通知類規則正常運作。',
      '所有規則共用嘅上限，加喺每條規則自己嘅冷卻時間之上。到咗上限會發出警告而唔會發送；設做零就可以完全停止規則發送任何嘢，同時保留通知類規則正常運作。',
      '所有規則共用嘅上限，喺每條規則自己嘅冷卻之上。撞到就出警告而唔係send。設零即係規則咩都唔send，但通知類照行。',
      '所有規則夾份用嘅上限，疊喺每條規則自己嘅冷卻之上。撞到就出個警告，唔會有嘢send出去。設做零，會講嘢嗰啲即刻收聲，通知類就照樣做嘢。',
      '所有規則夾份用嘅上限，疊喺每條規則自己嘅冷卻之上。撞到就出個警告，唔會有嘢send出去。設做零，會講嘢嗰啲即刻收聲，通知類就照樣做嘢。'
    ]
  },
  'mineflayer-chat.setting.exportFormat': {
    en: ['Preferred export format', 'Preferred export format', 'Preferred export format', 'Preferred export format', 'Preferred export format'],
    yue: ['預設匯出格式', '預設匯出格式', '預設匯出格式', '預設匯出格式', '預設匯出格式']
  },
  'mineflayer-chat.setting.exportFormat.description': {
    en: [
      'Which format the export control starts on. Every format remains available, and the control still says which fields the chosen one cannot carry before anything is written.',
      'Which format the export control starts on. Every format remains available, and the control still says which fields the chosen one cannot carry before anything is written.',
      'Which format the export control starts on. All the others are still there, and it still tells you which fields the chosen one cannot carry before it writes anything.',
      'Which format the export control opens on. Every other format is still one click away, and it will still tell you exactly which fields the chosen one cannot carry before a single byte is written.',
      'Which format the export control opens on. Every other format is still one click away, and it will still tell you exactly which fields the chosen one cannot carry before a single byte is written.'
    ],
    yue: [
      '匯出控制項預設用邊個格式。其他格式一樣揀得到，而喺寫入之前佢照樣會講清楚所選格式載唔到邊啲欄位。',
      '匯出控制項預設用邊個格式。其他格式一樣揀得到，而喺寫入之前佢照樣會講清楚所選格式載唔到邊啲欄位。',
      '匯出控制項起手用邊個格式。其他格式照樣揀得到，寫嘢之前一樣會講明所選格式載唔到邊啲欄位。',
      '匯出控制項一開係邊個格式。其他格式都仲喺隔籬，而且落筆之前佢照樣會逐項講清楚所選格式載唔到啲乜。',
      '匯出控制項一開係邊個格式。其他格式都仲喺隔籬，而且落筆之前佢照樣會逐項講清楚所選格式載唔到啲乜。'
    ]
  },
  'mineflayer-chat.settings.section': {
    en: ['Bot chat', 'Bot chat', 'Bot chat', 'Bot chat', 'Bot chat'],
    yue: ['機械人聊天', '機械人聊天', '機械人聊天', '機械人聊天', '機械人聊天']
  },

  /* ---------------------------------------------------------------- */
  /* Palette                                                           */
  /* ---------------------------------------------------------------- */

  'mineflayer-chat.palette.open': {
    en: ['Open bot chat', 'Open bot chat', 'Open bot chat', 'Open bot chat', 'Open bot chat'],
    yue: ['開啟機械人聊天', '開啟機械人聊天', '開啟機械人聊天', '開啟機械人聊天', '開啟機械人聊天']
  },
  'mineflayer-chat.palette.compose': {
    en: [
      'Send a message through the bot',
      'Send a message through the bot',
      'Send a message through the bot',
      'Send a message through the bot',
      'Send a message through the bot'
    ],
    yue: [
      '經機械人發送訊息',
      '經機械人發送訊息',
      '經機械人發送訊息',
      '經機械人發送訊息',
      '經機械人發送訊息'
    ]
  },
  'mineflayer-chat.palette.rules': {
    en: ['Chat pattern rules', 'Chat pattern rules', 'Chat pattern rules', 'Chat pattern rules', 'Chat pattern rules'],
    yue: ['聊天模式規則', '聊天模式規則', '聊天模式規則', '聊天模式規則', '聊天模式規則']
  },
  'mineflayer-chat.palette.server': {
    en: [
      'Server text surfaces',
      'Server text surfaces',
      'Server text surfaces',
      'Server text surfaces',
      'Server text surfaces'
    ],
    yue: ['伺服器文字介面', '伺服器文字介面', '伺服器文字介面', '伺服器文字介面', '伺服器文字介面']
  },
  'mineflayer-chat.palette.export': {
    en: ['Export the chat log', 'Export the chat log', 'Export the chat log', 'Export the chat log', 'Export the chat log'],
    yue: ['匯出聊天紀錄', '匯出聊天紀錄', '匯出聊天紀錄', '匯出聊天紀錄', '匯出聊天紀錄']
  },
  'mineflayer-chat.palette.newRule': {
    en: ['New chat pattern rule', 'New chat pattern rule', 'New chat pattern rule', 'New chat pattern rule', 'New chat pattern rule'],
    yue: ['新增聊天模式規則', '新增聊天模式規則', '新增聊天模式規則', '新增聊天模式規則', '新增聊天模式規則']
  }
};
