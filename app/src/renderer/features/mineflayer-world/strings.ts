import type { Catalogue, FunnyLadder } from '../../core/registry';

/**
 * Every copy key this feature renders, in English and playful Hong Kong
 * Cantonese, at five humour levels.
 *
 * `msg(level1, level3, level5)` fills a five-rung ladder where level 1 and 2
 * share the professional wording, level 3 and 4 share a slightly warmer
 * middle, and level 5 keeps the most playful line -- the ladder never falls
 * off the end, and the facts (what happened, what it affects, what the
 * options are) are identical at every rung; only the voice changes.
 * `flat(text)` is for pure labels -- a field name, a column header, a единица
 * of measurement -- where every rung genuinely reads the same, which the
 * integration contract explicitly allows.
 */
function msg(level1: string, level3: string, level5: string): FunnyLadder {
  return [level1, level1, level3, level5, level5];
}

function flat(text: string): FunnyLadder {
  return [text, text, text, text, text];
}

export const WORLD_STRINGS: Catalogue = {
  /* ================================================================ */
  /* Tab and settings                                                  */
  /* ================================================================ */

  'mineflayerWorld.tab.title': {
    en: msg('World', 'The world', 'Dirt, mobs and mischief'),
    yue: msg('世界', '個世界', '泥沙、怪同搞事')
  },
  'mineflayerWorld.settings.title': {
    en: msg('World interaction', 'World interaction', 'World interaction (aka digging around)'),
    yue: msg('世界互動', '世界互動', '世界互動（即係周圍挖）')
  },
  'mineflayerWorld.settings.entityPollMs': {
    en: msg('Entity list refresh rate', 'Entity list refresh rate', 'How often to peek at what is nearby'),
    yue: msg('生物清單更新頻率', '生物清單更新頻率', '幾耐望多次附近有咩')
  },
  'mineflayerWorld.settings.entityPollMs.description': {
    en: msg(
      'How often, in milliseconds, the nearby-entities list is refreshed from the bot\'s real state.',
      'How often, in milliseconds, the nearby-entities list is refreshed from the bot\'s real state.',
      'How often the bot glances around to update the nearby-entities list, in milliseconds.'
    ),
    yue: msg(
      '附近生物清單隔幾多毫秒由機械人嘅真實狀態更新一次。',
      '附近生物清單隔幾多毫秒由機械人嘅真實狀態更新一次。',
      '機械人隔幾多毫秒望一望周圍，更新附近生物清單。'
    )
  },
  'mineflayerWorld.settings.eventFeedLimit': {
    en: msg('Ambience feed size', 'Ambience feed size', 'How much noise to remember'),
    yue: msg('環境事件清單大小', '環境事件清單大小', '記幾多嘢先算多')
  },
  'mineflayerWorld.settings.eventFeedLimit.description': {
    en: msg(
      'The most recent sound, particle and weather events the ambience feed keeps before it drops the oldest.',
      'The most recent sound, particle and weather events the ambience feed keeps before it drops the oldest.',
      'How many sounds, particles and weather flips the ambience feed hangs onto before the oldest one falls off the end.'
    ),
    yue: msg(
      '環境事件清單會保留最近幾多個聲音、粒子同天氣事件，之後最舊嘅就會被踢走。',
      '環境事件清單會保留最近幾多個聲音、粒子同天氣事件，之後最舊嘅就會被踢走。',
      '環境事件清單記到幾多個先開始丟舊嘢。'
    )
  },
  'mineflayerWorld.settings.confirmMobAttacks': {
    en: msg('Confirm attacks on non-player entities too', 'Confirm attacks on non-player entities too', 'Make me double-check before punching a chicken'),
    yue: msg('攻擊非玩家生物都要確認', '攻擊非玩家生物都要確認', '打隻雞都要問多次先')
  },
  'mineflayerWorld.settings.confirmMobAttacks.description': {
    en: msg(
      'Attacking a real player always asks for confirmation naming them. Turning this on asks the same way before attacking anything else, too.',
      'Attacking a real player always asks for confirmation naming them. Turning this on asks the same way before attacking anything else, too.',
      'Attacking a player already needs a confirmation with their name on it. This makes every other creature get the same treatment.'
    ),
    yue: msg(
      '攻擊真正玩家一定會彈出確認，寫住佢個名。開咗呢個掣，打其他嘢都會咁樣問一次。',
      '攻擊真正玩家一定會彈出確認，寫住佢個名。開咗呢個掣，打其他嘢都會咁樣問一次。',
      '打玩家梗係要確認寫名，開咗呢個，打其他嘢都逃唔到。'
    )
  },
  'mineflayerWorld.settings.defaultFindDistance': {
    en: msg('Default block-search radius', 'Default block-search radius', 'How far to look for blocks by default'),
    yue: msg('預設搵方塊嘅搜尋半徑', '預設搵方塊嘅搜尋半徑', '預設搵方塊要望幾遠')
  },
  'mineflayerWorld.settings.defaultFindDistance.description': {
    en: msg(
      'The radius, in metres, the "Find blocks by type" search starts with. Changed per search too.',
      'The radius, in metres, the "Find blocks by type" search starts with. Changed per search too.',
      'How far, in metres, "Find blocks by type" looks by default -- you can still widen or narrow it per search.'
    ),
    yue: msg(
      '「搵指定類型方塊」預設嘅搜尋半徑（米）。每次搜尋都可以再改。',
      '「搵指定類型方塊」預設嘅搜尋半徑（米）。每次搜尋都可以再改。',
      '「搵指定類型方塊」預設望幾遠（米），照樣可以每次自己改。'
    )
  },
  'mineflayerWorld.settings.defaultFindCount': {
    en: msg('Default maximum results', 'Default maximum results', 'How many matches to bother with'),
    yue: msg('預設最多結果數量', '預設最多結果數量', '預設搵到幾多個就夠')
  },
  'mineflayerWorld.settings.defaultFindCount.description': {
    en: msg(
      'The maximum number of matching blocks the "Find blocks by type" search returns by default.',
      'The maximum number of matching blocks the "Find blocks by type" search returns by default.',
      'The cap on how many matching blocks "Find blocks by type" hands back before it stops counting.'
    ),
    yue: msg(
      '「搵指定類型方塊」預設最多會傳返幾多個符合嘅方塊。',
      '「搵指定類型方塊」預設最多會傳返幾多個符合嘅方塊。',
      '「搵指定類型方塊」搵到夠鐘就唔再數落去，呢個係上限。'
    )
  },

  /* ================================================================ */
  /* panel.ts — shared status bar and empty states                     */
  /* ================================================================ */

  'mineflayerWorld.empty.title': {
    en: msg('No bot runtime found', 'No bot runtime found', 'Nothing to drive here'),
    yue: msg('搵唔到機械人執行環境', '搵唔到機械人執行環境', '呢度冇嘢好㩒')
  },
  'mineflayerWorld.empty.searching': {
    en: msg(
      'Looking for the Minecraft bots feature that owns the connection…',
      'Looking for the Minecraft bots feature that owns the connection…',
      'Sniffing around for whoever holds the actual connection…'
    ),
    yue: msg('搵緊負責連線嘅「Minecraft 機械人」功能……', '搵緊負責連線嘅「Minecraft 機械人」功能……', '周圍嗅緊邊個攞住條連線……')
  },
  'mineflayerWorld.empty.unavailable': {
    en: msg(
      'The Minecraft bots feature is not present in this build, so there is nothing to dig, place or interact with. This tab searched for it and honestly found nothing rather than pretending to be connected.',
      'The Minecraft bots feature is not present in this build, so there is nothing to dig, place or interact with. This tab searched for it and honestly found nothing rather than pretending to be connected.',
      'This build simply does not have the Minecraft bots feature, so there is nothing here to dig, place or poke. This tab looked, found nothing, and is telling you rather than faking a connection.'
    ),
    yue: msg(
      '呢個版本冇「Minecraft 機械人」功能，所以冇嘢好挖、好放、好互動。呢個分頁搵過，老實講真係搵唔到，唔會扮已經連咗線。',
      '呢個版本冇「Minecraft 機械人」功能，所以冇嘢好挖、好放、好互動。呢個分頁搵過，老實講真係搵唔到，唔會扮已經連咗線。',
      '呢個版本根本冇「Minecraft 機械人」功能，冇嘢俾你郁。搵過，真係冇，唔會扮嘢話已經連緊線。'
    )
  },
  'mineflayerWorld.empty.noBot.title': {
    en: msg('No bot connected', 'No bot connected', 'Nobody home'),
    yue: msg('未有機械人連線', '未有機械人連線', '冇人喺度')
  },
  'mineflayerWorld.empty.noBot.body': {
    en: msg(
      'Connect a bot from the Minecraft bots tab, then come back here to dig, place, interact with entities, fish, sleep, write books, use creative tools and more.',
      'Connect a bot from the Minecraft bots tab, then come back here to dig, place, interact with entities, fish, sleep, write books, use creative tools and more.',
      'Pop over to the Minecraft bots tab, connect somebody, then come back to dig, place, poke entities, fish, sleep, scribble in books and boss around creative mode.'
    ),
    yue: msg(
      '去「Minecraft 機械人」分頁連接一個機械人，再返嚟呢度挖嘢、放嘢、同生物互動、釣魚、瞓覺、寫書、用創造模式工具等等。',
      '去「Minecraft 機械人」分頁連接一個機械人，再返嚟呢度挖嘢、放嘢、同生物互動、釣魚、瞓覺、寫書、用創造模式工具等等。',
      '快啲去「Minecraft 機械人」分頁揾個機械人連埋線，返嚟先有得挖有得放有得玩。'
    )
  },
  'mineflayerWorld.empty.noBot.action': {
    en: flat('Open Minecraft bots'),
    yue: flat('開啟 Minecraft 機械人')
  },
  'mineflayerWorld.status.connected': {
    en: msg('Driving {username}', 'Driving {username}', 'At the wheel of {username}'),
    yue: msg('操控緊 {username}', '操控緊 {username}', '手揸方向盤揸緊 {username}')
  },
  'mineflayerWorld.status.notConnected': {
    en: msg(
      'This bot is not connected right now ({status})',
      'This bot is not connected right now ({status})',
      'Nobody\'s driving -- this bot is offline ({status})'
    ),
    yue: msg('呢個機械人而家未連線（{status}）', '呢個機械人而家未連線（{status}）', '而家冇人揸，離晒線（{status}）')
  },
  'mineflayerWorld.status.health': { en: flat('Health'), yue: flat('生命值') },
  'mineflayerWorld.status.food': { en: flat('Food'), yue: flat('飢餓值') },
  'mineflayerWorld.status.oxygen': { en: flat('Oxygen'), yue: flat('氧氣值') },
  'mineflayerWorld.status.gameMode': { en: flat('Gamemode'), yue: flat('遊戲模式') },
  'mineflayerWorld.status.dimension': { en: flat('Dimension'), yue: flat('維度') },
  'mineflayerWorld.status.position': { en: flat('Position'), yue: flat('座標') },
  'mineflayerWorld.status.held': { en: flat('Held item'), yue: flat('手持物品') },
  'mineflayerWorld.status.time': { en: flat('Time'), yue: flat('時間') },
  'mineflayerWorld.status.day': { en: flat('day'), yue: flat('日頭') },
  'mineflayerWorld.status.night': { en: flat('night'), yue: flat('夜晚') },
  'mineflayerWorld.status.weather': { en: flat('Weather'), yue: flat('天氣') },
  'mineflayerWorld.status.clear': { en: flat('clear'), yue: flat('天晴') },
  'mineflayerWorld.status.rain': { en: flat('raining'), yue: flat('落緊雨') },
  'mineflayerWorld.status.thunder': { en: flat('thunderstorm'), yue: flat('行雷閃電') },

  /* ================================================================ */
  /* blocks-section.ts                                                 */
  /* ================================================================ */

  'mineflayerWorld.blocks.heading': {
    en: msg('Blocks: dig, place, activate and look up', 'Blocks: dig, place, activate and look up', 'Blocks: dig it, drop it, poke it, snoop on it'),
    yue: msg('方塊：挖、放、觸發同查睇', '方塊：挖、放、觸發同查睇', '方塊：挖佢放佢戳佢望埋佢')
  },
  'mineflayerWorld.blocks.heading.description': {
    en: msg(
      'Pick a target block by ray-tracing where the bot is looking, or by typing coordinates, then dig, place against it, activate it, or inspect its state.',
      'Pick a target block by ray-tracing where the bot is looking, or by typing coordinates, then dig, place against it, activate it, or inspect its state.',
      'Aim by looking (a real ray-trace) or by typing numbers, then go dig it, plonk something against it, poke it, or nose through its state.'
    ),
    yue: msg(
      '用射線追蹤揀返機械人望緊嘅方塊，或者自己打座標，然後可以挖、對住放嘢、觸發，或者查睇狀態。',
      '用射線追蹤揀返機械人望緊嘅方塊，或者自己打座標，然後可以挖、對住放嘢、觸發，或者查睇狀態。',
      '望過去自動追蹤揀個方塊，或者自己打座標，跟住想挖想放想撳想八卦都得。'
    )
  },
  'mineflayerWorld.blocks.x': { en: flat('X'), yue: flat('X') },
  'mineflayerWorld.blocks.y': { en: flat('Y'), yue: flat('Y') },
  'mineflayerWorld.blocks.z': { en: flat('Z'), yue: flat('Z') },
  'mineflayerWorld.blocks.rayDistance': { en: flat('Ray distance'), yue: flat('射線距離') },
  'mineflayerWorld.blocks.lookHere': {
    en: msg('Target what the bot is looking at', 'Target what the bot is looking at', 'Aim at whatever the bot is eyeing up'),
    yue: msg('鎖定機械人望緊嘅嘢', '鎖定機械人望緊嘅嘢', '鎖定機械人眼定定望住嘅嘢')
  },
  'mineflayerWorld.blocks.lookUp': {
    en: msg('Look up this position', 'Look up this position', 'Snoop on this exact spot'),
    yue: msg('查睇呢個座標', '查睇呢個座標', '八卦下呢個位有咩')
  },
  'mineflayerWorld.blocks.needCoordinates': {
    en: msg(
      'Enter X, Y and Z first, or use the ray-trace button above.',
      'Enter X, Y and Z first, or use the ray-trace button above.',
      'Type in X, Y, Z first, or just let the ray-trace button do the aiming.'
    ),
    yue: msg('請先輸入 X、Y、Z，或者用上面嘅射線追蹤掣。', '請先輸入 X、Y、Z，或者用上面嘅射線追蹤掣。', '未打 X Y Z 呀，唔係就撳上面嗰個追蹤掣。')
  },
  'mineflayerWorld.blocks.noTarget': {
    en: msg(
      'Nothing loaded is in view within that distance.',
      'Nothing loaded is in view within that distance.',
      'Nothing but thin air in that range -- try looking somewhere with actual blocks.'
    ),
    yue: msg('嗰個距離內冇已載入嘅嘢喺視野入面。', '嗰個距離內冇已載入嘅嘢喺視野入面。', '嗰個範圍望出去乜都冇，得返空氣。')
  },
  'mineflayerWorld.blocks.notLoaded': {
    en: msg(
      'That chunk is not loaded, so nothing can be read at that position.',
      'That chunk is not loaded, so nothing can be read at that position.',
      'That patch of world hasn\'t loaded yet, so there is nothing there to read.'
    ),
    yue: msg('嗰個區塊未載入，所以嗰個位置乜都讀唔到。', '嗰個區塊未載入，所以嗰個位置乜都讀唔到。', '嗰嚿地圖仲未載入，讀極都係得個吉。')
  },
  'mineflayerWorld.blocks.inspector.empty': {
    en: msg('No block has been looked up yet.', 'No block has been looked up yet.', 'Nothing inspected yet -- go find a victim.'),
    yue: msg('未有查睇過任何方塊。', '未有查睇過任何方塊。', '未查過邊個方塊，快啲揀一個嚟八卦。')
  },
  'mineflayerWorld.blocks.position': { en: flat('Position'), yue: flat('座標') },
  'mineflayerWorld.blocks.diggable': { en: flat('Diggable'), yue: flat('可挖') },
  'mineflayerWorld.blocks.hardness': { en: flat('Hardness'), yue: flat('硬度') },
  'mineflayerWorld.blocks.light': { en: flat('Light'), yue: flat('光度') },
  'mineflayerWorld.blocks.skyLight': { en: flat('Sky light'), yue: flat('天空光度') },
  'mineflayerWorld.blocks.stateId': { en: flat('State id'), yue: flat('狀態編號') },
  'mineflayerWorld.blocks.properties': { en: flat('Block state properties'), yue: flat('方塊狀態屬性') },
  'mineflayerWorld.blocks.tool': { en: flat('Tool to hold before digging'), yue: flat('挖之前手持嘅工具') },
  'mineflayerWorld.blocks.toolNone': { en: flat('Whatever is already held'), yue: flat('用返而家手持嗰件') },
  'mineflayerWorld.blocks.refreshInventory': {
    en: msg('Refresh the inventory list', 'Refresh the inventory list', 'Re-check what is actually in the bag'),
    yue: msg('重新整理背包清單', '重新整理背包清單', '再望多次個袋入面有咩')
  },
  'mineflayerWorld.blocks.slot': { en: flat('slot {slot}'), yue: flat('格 {slot}') },
  'mineflayerWorld.blocks.equip': { en: flat('Equip'), yue: flat('裝備') },
  'mineflayerWorld.blocks.equipped': {
    en: msg('Now holding {name}.', 'Now holding {name}.', 'Locked and loaded with {name}.'),
    yue: msg('而家手持緊 {name}。', '而家手持緊 {name}。', '而家手上係 {name}，準備好晒。')
  },
  'mineflayerWorld.blocks.digProgress': { en: flat('Dig progress'), yue: flat('挖掘進度') },
  'mineflayerWorld.blocks.dig': {
    en: msg('Dig the target block', 'Dig the target block', 'Smash the targeted block'),
    yue: msg('挖鎖定嘅方塊', '挖鎖定嘅方塊', '大力挖爛個目標方塊')
  },
  'mineflayerWorld.blocks.stopDig': {
    en: msg('Stop digging', 'Stop digging', 'Put the pickaxe down'),
    yue: msg('停止挖掘', '停止挖掘', '收手唔挖住先')
  },
  'mineflayerWorld.blocks.digInFlight': {
    en: msg('A dig is already in progress.', 'A dig is already in progress.', 'Already elbow-deep in a dig -- one at a time.'),
    yue: msg('已經有一個挖掘動作進行緊。', '已經有一個挖掘動作進行緊。', '手上已經有嘢挖緊，唔可以一心兩用。')
  },
  'mineflayerWorld.blocks.digging': {
    en: msg('Digging…', 'Digging…', 'Chipping away…'),
    yue: msg('挖緊……', '挖緊……', '篤緊篤緊……')
  },
  'mineflayerWorld.blocks.digDone': {
    en: msg('Block dug.', 'Block dug.', 'Block gone -- nice hole.'),
    yue: msg('方塊已挖走。', '方塊已挖走。', '方塊冇咗，個窿幾靚。')
  },
  'mineflayerWorld.blocks.digFailed': {
    en: msg('Digging stopped: {reason}', 'Digging stopped: {reason}', 'Digging fizzled out: {reason}'),
    yue: msg('挖掘停咗：{reason}', '挖掘停咗：{reason}', '挖到中途冇咗：{reason}')
  },
  'mineflayerWorld.blocks.undiggable': {
    en: msg(
      'This block cannot be dug (its dig time is infinite, as bedrock and similar blocks report).',
      'This block cannot be dug (its dig time is infinite, as bedrock and similar blocks report).',
      'This block is basically unbreakable -- its dig time comes back infinite, same as bedrock.'
    ),
    yue: msg(
      '呢個方塊挖唔到（挖掘時間係無限，同基岩之類嘅方塊一樣）。',
      '呢個方塊挖唔到（挖掘時間係無限，同基岩之類嘅方塊一樣）。',
      '呢舊嘢基本上打唔爛，挖掘時間係無限，同基岩一個級數。'
    )
  },
  'mineflayerWorld.blocks.serverStage': {
    en: flat('Server-reported break stage: {stage}/9'),
    yue: flat('伺服器回報嘅破壞階段：{stage}/9')
  },
  'mineflayerWorld.blocks.face': { en: flat('Face of the target block to place against'), yue: flat('要對住嘅目標方塊面') },
  'mineflayerWorld.blocks.place': {
    en: msg('Place block', 'Place block', 'Plonk it down'),
    yue: msg('放置方塊', '放置方塊', '啪一聲放低佢')
  },
  'mineflayerWorld.blocks.placeDone': {
    en: msg('The held item was placed against that face.', 'The held item was placed against that face.', 'Down it goes, right against that face.'),
    yue: msg('手持物品已對住嗰一面放置好。', '手持物品已對住嗰一面放置好。', '手上嘅嘢已經貼住嗰一面放低咗。')
  },
  'mineflayerWorld.blocks.placeEntity': {
    en: msg('Place entity (boat, minecart, armour stand…)', 'Place entity (boat, minecart, armour stand…)', 'Drop a boat, minecart or whatever'),
    yue: msg('放置生物/物件（船、礦車、盔甲架……）', '放置生物/物件（船、礦車、盔甲架……）', '擺低隻船、架礦車或者盔甲架')
  },
  'mineflayerWorld.blocks.placeEntityDone': {
    en: msg('Placed {name}.', 'Placed {name}.', '{name}, deployed.'),
    yue: msg('已放置 {name}。', '已放置 {name}。', '{name} 已經擺低咗。')
  },
  'mineflayerWorld.blocks.placeEntityDoneUnknown': {
    en: msg('The entity was placed.', 'The entity was placed.', 'It\'s down there somewhere now.'),
    yue: msg('該生物/物件已放置。', '該生物/物件已放置。', '嗰嚿嘢而家已經喺出面。')
  },
  'mineflayerWorld.blocks.activate': {
    en: msg('Activate (right-click) the target block', 'Activate (right-click) the target block', 'Give the target block a nudge (right-click)'),
    yue: msg('觸發（右鍵）鎖定嘅方塊', '觸發（右鍵）鎖定嘅方塊', '掂一掂（右鍵）個目標方塊')
  },
  'mineflayerWorld.blocks.activateDone': {
    en: msg(
      'The block was activated (a door opened, a lever flipped, a button pressed — whatever that block does).',
      'The block was activated (a door opened, a lever flipped, a button pressed — whatever that block does).',
      'Whatever that block does when poked, it just did it -- door, lever, button, you name it.'
    ),
    yue: msg(
      '方塊已觸發（開咗道門、撥咗個拉桿、撳咗個按鈕——視乎個方塊本身做咩）。',
      '方塊已觸發（開咗道門、撥咗個拉桿、撳咗個按鈕——視乎個方塊本身做咩）。',
      '個方塊撳咗落去，佢即刻做返自己嗰份嘢——開門定撥掣睇佢本性。'
    )
  },
  'mineflayerWorld.find.heading': {
    en: msg('Find blocks by type', 'Find blocks by type', 'Go treasure-hunting for a block type'),
    yue: msg('搵指定類型嘅方塊', '搵指定類型嘅方塊', '尋寶：搵晒某種方塊')
  },
  'mineflayerWorld.find.heading.description': {
    en: msg(
      'Search a radius around the bot for every loaded block matching the names you list.',
      'Search a radius around the bot for every loaded block matching the names you list.',
      'Sweep a radius around the bot and dig up every loaded block matching your list of names.'
    ),
    yue: msg(
      '喺機械人周圍某個半徑內，搜尋所有已載入、符合你所列名稱嘅方塊。',
      '喺機械人周圍某個半徑內，搜尋所有已載入、符合你所列名稱嘅方塊。',
      '喺機械人身邊一個範圍度篤晒個名單入面所有方塊出嚟。'
    )
  },
  'mineflayerWorld.find.matching': { en: flat('Block names to find (comma-separated)'), yue: flat('要搵嘅方塊名稱（用逗號分隔）') },
  'mineflayerWorld.find.matching.help': {
    en: msg(
      'Names are matched against the server\'s own real block registry; an unrecognised name is refused with the server\'s exact reason.',
      'Names are matched against the server\'s own real block registry; an unrecognised name is refused with the server\'s exact reason.',
      'The server checks these names against its real registry -- get one wrong and it will tell you exactly why.'
    ),
    yue: msg(
      '名稱會對照伺服器真正嘅方塊登記表；唔識嘅名會被拒絕，並會顯示伺服器嘅確實原因。',
      '名稱會對照伺服器真正嘅方塊登記表；唔識嘅名會被拒絕，並會顯示伺服器嘅確實原因。',
      '打錯名伺服器會照樣同你講清楚點解唔識。'
    )
  },
  'mineflayerWorld.find.maxDistance': { en: flat('Search radius'), yue: flat('搜尋半徑') },
  'mineflayerWorld.find.count': { en: flat('Maximum results'), yue: flat('最多結果數量') },
  'mineflayerWorld.find.run': {
    en: msg('Search', 'Search', 'Go dig up the list'),
    yue: msg('搜尋', '搜尋', '出動搵晒佢')
  },
  'mineflayerWorld.find.needNames': {
    en: msg('List at least one block name.', 'List at least one block name.', 'Give me at least one name to hunt for.'),
    yue: msg('請至少列出一個方塊名稱。', '請至少列出一個方塊名稱。', '總要俾個名我先識搵㗎嘛。')
  },
  'mineflayerWorld.find.found': {
    en: msg('{count} block(s) found.', '{count} block(s) found.', 'Bagged {count} block(s).'),
    yue: msg('搵到 {count} 個方塊。', '搵到 {count} 個方塊。', '搵到 {count} 舊，滿載而歸。')
  },
  'mineflayerWorld.find.results': { en: flat('Matching blocks'), yue: flat('符合嘅方塊') },
  'mineflayerWorld.find.column.name': { en: flat('Block'), yue: flat('方塊') },
  'mineflayerWorld.find.column.position': { en: flat('Position'), yue: flat('座標') },
  'mineflayerWorld.find.empty': {
    en: msg('No search has been run yet.', 'No search has been run yet.', 'Nothing searched for yet -- fire away.'),
    yue: msg('未搜尋過。', '未搜尋過。', '仲未搵過，快啲試下。')
  },
  'mineflayerWorld.find.search': { en: flat('Filter results'), yue: flat('篩選結果') },
  'mineflayerWorld.find.selectShown': { en: flat('Select all shown'), yue: flat('全選顯示緊嘅') },
  'mineflayerWorld.find.selectAll': { en: flat('Select every result (including hidden by the filter)'), yue: flat('全選所有結果（連篩走咗嘅都計）') },
  'mineflayerWorld.find.invert': { en: flat('Invert selection'), yue: flat('反選') },
  'mineflayerWorld.find.clearSelection': { en: flat('Clear selection'), yue: flat('清除選取') },
  'mineflayerWorld.find.useSelected': { en: flat('Set the selected block as target'), yue: flat('將揀咗嘅方塊設為目標') },

  /* ================================================================ */
  /* entities-section.ts                                               */
  /* ================================================================ */

  'mineflayerWorld.entities.heading': {
    en: msg('Nearby entities', 'Nearby entities', 'Who\'s lurking nearby'),
    yue: msg('附近生物', '附近生物', '周圍有咩喺度游蕩')
  },
  'mineflayerWorld.entities.heading.description': {
    en: msg(
      'Every entity the bot currently tracks, refreshed on a timer. Attacking a player is gated by a confirmation naming them, because that is a consequential action against another person.',
      'Every entity the bot currently tracks, refreshed on a timer. Attacking a player is gated by a confirmation naming them, because that is a consequential action against another person.',
      'Every creature and player the bot has clocked, kept fresh on a timer. Swinging at a real player always needs a confirmation with their name on it first -- that\'s a real person you\'re about to thump.'
    ),
    yue: msg(
      '機械人而家追蹤緊嘅每個生物，定時更新。攻擊玩家會彈確認，寫住佢個名，因為咁樣做係對另一個人有實際後果嘅行動。',
      '機械人而家追蹤緊嘅每個生物，定時更新。攻擊玩家會彈確認，寫住佢個名，因為咁樣做係對另一個人有實際後果嘅行動。',
      '機械人望到嘅每個生物同玩家，定時更新畀你睇。打玩家一定要先彈個確認寫明佢個名——嗰邊係真人嚟㗎。'
    )
  },
  'mineflayerWorld.entities.column.name': { en: flat('Name'), yue: flat('名稱') },
  'mineflayerWorld.entities.column.type': { en: flat('Type'), yue: flat('類型') },
  'mineflayerWorld.entities.column.distance': { en: flat('Distance'), yue: flat('距離') },
  'mineflayerWorld.entities.column.health': { en: flat('Health'), yue: flat('生命值') },
  'mineflayerWorld.entities.column.equipment': { en: flat('Equipment'), yue: flat('裝備') },
  'mineflayerWorld.entities.empty': {
    en: msg('No entities are currently tracked nearby.', 'No entities are currently tracked nearby.', 'Quiet out there -- nothing nearby right now.'),
    yue: msg('附近而家未有追蹤到任何生物。', '附近而家未有追蹤到任何生物。', '周圍靜英英，乜生物都冇。')
  },
  'mineflayerWorld.entities.search': { en: flat('Filter entities'), yue: flat('篩選生物') },
  'mineflayerWorld.entities.singleTarget': { en: flat('Act on'), yue: flat('操作對象') },
  'mineflayerWorld.entities.pickOne': { en: flat('Pick an entity above'), yue: flat('喺上面揀一個生物') },
  'mineflayerWorld.entities.attack': {
    en: msg('Attack', 'Attack', 'Swing at it'),
    yue: msg('攻擊', '攻擊', '劈落去')
  },
  'mineflayerWorld.entities.useOn': {
    en: msg('Use on (right-click)', 'Use on (right-click)', 'Poke it (right-click)'),
    yue: msg('使用於（右鍵）', '使用於（右鍵）', '掂一掂佢（右鍵）')
  },
  'mineflayerWorld.entities.mount': {
    en: msg('Mount', 'Mount', 'Hop on'),
    yue: msg('騎乘', '騎乘', '跳上去')
  },
  'mineflayerWorld.entities.dismount': {
    en: msg('Dismount', 'Dismount', 'Hop off'),
    yue: msg('下馬', '下馬', '跳返落嚟')
  },
  'mineflayerWorld.entities.dismountNote': {
    en: msg(
      'The library reports "not mounted" as an event rather than an error, so check the event inspector if nothing seemed to happen.',
      'The library reports "not mounted" as an event rather than an error, so check the event inspector if nothing seemed to happen.',
      'If nothing seemed to happen, that\'s not a bug -- the library quietly logs "not mounted" as an event, not an error. Check the event inspector.'
    ),
    yue: msg(
      '呢個庫會將「未有騎乘」當事件回報，唔係錯誤，所以如果好似冇反應，可以睇下事件檢查器。',
      '呢個庫會將「未有騎乘」當事件回報，唔係錯誤，所以如果好似冇反應，可以睇下事件檢查器。',
      '睇落冇反應好正常，因為「未有騎乘」係靜靜雞變咗個事件，唔係錯誤，去事件檢查器搵下佢。'
    )
  },
  'mineflayerWorld.entities.confirmAttack': {
    en: flat('Attack the player {name}'),
    yue: flat('攻擊玩家 {name}')
  },
  'mineflayerWorld.entities.confirmAttackBody': {
    en: flat('The bot will swing at and damage this player in the running game. This cannot be undone once it lands.'),
    yue: flat('機械人會喺遊戲入面向呢個玩家揮擊並造成傷害，一旦打中就冇得返轉頭。')
  },
  'mineflayerWorld.entities.confirmAttackMob': {
    en: flat('Attack {name}'),
    yue: flat('攻擊 {name}')
  },
  'mineflayerWorld.entities.confirmAttackMobBody': {
    en: flat('The bot will swing at and damage this entity.'),
    yue: flat('機械人會向呢個生物揮擊並造成傷害。')
  },
  'mineflayerWorld.entities.attackSelected': {
    en: msg('Attack selected', 'Attack selected', 'Jump the whole selected crowd'),
    yue: msg('攻擊已選取', '攻擊已選取', '一齊撲晒揀咗嗰班')
  },
  'mineflayerWorld.entities.confirmBulk': {
    en: flat('Attack {count} entities'),
    yue: flat('攻擊 {count} 個生物')
  },
  'mineflayerWorld.entities.confirmBulkBody': {
    en: flat('The bot will swing at and damage every selected entity.'),
    yue: flat('機械人會向每一個已選取嘅生物揮擊並造成傷害。')
  },
  'mineflayerWorld.entities.confirmBulkBodyPlayers': {
    en: flat('This includes {count} real player(s). The bot will swing at and damage every one of them.'),
    yue: flat('當中包括 {count} 位真正玩家，機械人會向每一位揮擊並造成傷害。')
  },
  'mineflayerWorld.entities.bulkDone': {
    en: msg('{count} attacks sent.', '{count} attacks sent.', '{count} swings thrown.'),
    yue: msg('已發出 {count} 次攻擊。', '已發出 {count} 次攻擊。', '劈咗 {count} 次出去。')
  },
  'mineflayerWorld.entities.bulkFailures': {
    en: flat('{failed} of {total} attacks were refused by the runtime.'),
    yue: flat('{total} 次攻擊入面有 {failed} 次被執行環境拒絕。')
  },
  'mineflayerWorld.entities.selectShown': { en: flat('Select all shown'), yue: flat('全選顯示緊嘅') },
  'mineflayerWorld.entities.selectAll': { en: flat('Select every tracked entity'), yue: flat('全選所有追蹤緊嘅生物') },
  'mineflayerWorld.entities.invert': { en: flat('Invert selection'), yue: flat('反選') },

  /* ================================================================ */
  /* survival-section.ts                                               */
  /* ================================================================ */

  'mineflayerWorld.survival.heading': {
    en: msg('Fishing, sleeping and respawn', 'Fishing, sleeping and respawn', 'Fish, snooze, come back to life'),
    yue: msg('釣魚、瞓覺同重生', '釣魚、瞓覺同重生', '釣魚、瞓覺、翻生三寶')
  },
  'mineflayerWorld.survival.heading.description': {
    en: msg(
      'Failures here are shown exactly as the game reported them -- "the bed is too far" is a different problem from "there are monsters nearby", and the message says which one happened.',
      'Failures here are shown exactly as the game reported them -- "the bed is too far" is a different problem from "there are monsters nearby", and the message says which one happened.',
      'Failures here are the game\'s own words, verbatim -- "too far from the bed" and "monsters nearby" are not the same excuse, and you\'ll know exactly which one bit you.'
    ),
    yue: msg(
      '呢度嘅失敗訊息係遊戲原話原句顯示——「張床太遠」同「附近有怪物」係兩碼事，訊息會講清楚係邊個。',
      '呢度嘅失敗訊息係遊戲原話原句顯示——「張床太遠」同「附近有怪物」係兩碼事，訊息會講清楚係邊個。',
      '失敗嘅原因照字照句畀返你——「太遠」定「有怪」，一睇就知邊條路唔通。'
    )
  },
  'mineflayerWorld.survival.fish': {
    en: msg('Cast the fishing rod', 'Cast the fishing rod', 'Chuck the line out'),
    yue: msg('拋出魚竿', '拋出魚竿', '甩支竿落水')
  },
  'mineflayerWorld.survival.fishIdle': {
    en: flat('Not fishing.'),
    yue: flat('未有釣緊魚。')
  },
  'mineflayerWorld.survival.fishInFlight': {
    en: msg('Already waiting for a bite.', 'Already waiting for a bite.', 'Already got a line in the water, patience.'),
    yue: msg('已經等緊魚上釣。', '已經等緊魚上釣。', '條線已經落咗水，等多陣啦。')
  },
  'mineflayerWorld.survival.fishing': {
    en: msg('Line cast -- waiting for a bite…', 'Line cast -- waiting for a bite…', 'Bobber\'s out there, fingers crossed…'),
    yue: msg('魚絲已拋出，等緊魚上釣……', '魚絲已拋出，等緊魚上釣……', '魚漂喺度浮緊，睇下有冇運行……')
  },
  'mineflayerWorld.survival.fishCaught': {
    en: msg('Something bit -- reeled in.', 'Something bit -- reeled in.', 'Got a bite, reeled it right in!'),
    yue: msg('有嘢上釣，已收線。', '有嘢上釣，已收線。', '上釣喇，即刻收返條線！')
  },
  'mineflayerWorld.survival.fishFailed': {
    en: msg('Fishing stopped: {reason}', 'Fishing stopped: {reason}', 'The fishing trip\'s over: {reason}'),
    yue: msg('釣魚已停止：{reason}', '釣魚已停止：{reason}', '呢鑊釣魚玩完：{reason}')
  },
  'mineflayerWorld.survival.findBed': {
    en: msg('Find the nearest bed', 'Find the nearest bed', 'Sniff out the closest bed'),
    yue: msg('搵最近嘅床', '搵最近嘅床', '搵下最近有冇張床')
  },
  'mineflayerWorld.survival.noBedFound': {
    en: msg('No bed is loaded within 32 blocks.', 'No bed is loaded within 32 blocks.', '32 blocks out and not a bed in sight.'),
    yue: msg('32 格範圍內冇已載入嘅床。', '32 格範圍內冇已載入嘅床。', '搵晒 32 格都冇張床，慘。')
  },
  'mineflayerWorld.survival.bedFound': {
    en: msg('Found a bed at {position}.', 'Found a bed at {position}.', 'Bed spotted at {position}!'),
    yue: msg('喺 {position} 搵到一張床。', '喺 {position} 搵到一張床。', '喺 {position} 見到張床！')
  },
  'mineflayerWorld.survival.needBedPosition': {
    en: msg(
      'Enter a bed position, or find the nearest one first.',
      'Enter a bed position, or find the nearest one first.',
      'Give it a bed to aim for, or hit "find the nearest bed" first.'
    ),
    yue: msg('請輸入床嘅座標，或者先搵最近嘅床。', '請輸入床嘅座標，或者先搵最近嘅床。', '未有床嘅座標喎，唔係就先撳「搵最近嘅床」。')
  },
  'mineflayerWorld.survival.sleep': {
    en: msg('Sleep', 'Sleep', 'Tuck in'),
    yue: msg('瞓覺', '瞓覺', '瞓一覺先')
  },
  'mineflayerWorld.survival.sleeping': {
    en: flat('Asleep.'),
    yue: flat('已經瞓咗。')
  },
  'mineflayerWorld.survival.sleepFailed': {
    en: msg('Could not sleep: {reason}', 'Could not sleep: {reason}', 'No sleep for you: {reason}'),
    yue: msg('未能瞓覺：{reason}', '未能瞓覺：{reason}', '想瞓都瞓唔到：{reason}')
  },
  'mineflayerWorld.survival.wake': {
    en: msg('Wake up', 'Wake up', 'Rise and shine'),
    yue: msg('起身', '起身', '起身喇，發吽哣')
  },
  'mineflayerWorld.survival.awake': {
    en: flat('Awake.'),
    yue: flat('已經起身。')
  },
  'mineflayerWorld.survival.wakeFailed': {
    en: msg('Could not wake: {reason}', 'Could not wake: {reason}', 'Waking up did not work: {reason}'),
    yue: msg('未能起身：{reason}', '未能起身：{reason}', '叫極都唔起身：{reason}')
  },
  'mineflayerWorld.survival.spawnPoint': {
    en: msg('Read the current spawn point', 'Read the current spawn point', 'Check where "home" currently is'),
    yue: msg('讀取目前重生點', '讀取目前重生點', '睇下而家「屋企」定咗喺邊')
  },
  'mineflayerWorld.survival.spawnAt': {
    en: msg('Spawn point: {position}', 'Spawn point: {position}', 'Home base: {position}'),
    yue: msg('重生點：{position}', '重生點：{position}', '屋企定咗喺：{position}')
  },
  'mineflayerWorld.survival.spawnUnknown': {
    en: msg('Spawn point not read yet.', 'Spawn point not read yet.', 'No idea where home is yet -- go check.'),
    yue: msg('未讀取重生點。', '未讀取重生點。', '重生點喺邊都未知，去睇下。')
  },
  'mineflayerWorld.survival.respawn': {
    en: msg('Respawn', 'Respawn', 'Come back to life'),
    yue: msg('重生', '重生', '返生喇')
  },
  'mineflayerWorld.survival.respawnSent': {
    en: msg(
      'A respawn request was sent. It only has an effect while the bot is dead.',
      'A respawn request was sent. It only has an effect while the bot is dead.',
      'Respawn request sent -- it only does anything if the bot is actually a ghost right now.'
    ),
    yue: msg(
      '已發出重生請求，只有喺機械人死咗嘅時候先有效。',
      '已發出重生請求，只有喺機械人死咗嘅時候先有效。',
      '重生請求已發出，不過機械人未死嘅話呢個掣其實冇用。'
    )
  },

  /* ================================================================ */
  /* book-section.ts                                                   */
  /* ================================================================ */

  'mineflayerWorld.book.heading': {
    en: msg('Write and sign a book', 'Write and sign a book', 'Scribble a book and sign it'),
    yue: msg('寫書同簽名', '寫書同簽名', '寫本書仲要簽埋名')
  },
  'mineflayerWorld.book.heading.description': {
    en: msg(
      'Up to {maxPages} pages, each up to {maxChars} characters -- the real limits this runtime enforces, shown before you can hit them.',
      'Up to {maxPages} pages, each up to {maxChars} characters -- the real limits this runtime enforces, shown before you can hit them.',
      'Up to {maxPages} pages, {maxChars} characters each -- the actual ceiling this runtime enforces, shown before you smack into it.'
    ),
    yue: msg(
      '最多 {maxPages} 頁，每頁最多 {maxChars} 個字元——呢個係執行環境真正嘅上限，喺你撞到之前就已經話咗你知。',
      '最多 {maxPages} 頁，每頁最多 {maxChars} 個字元——呢個係執行環境真正嘅上限，喺你撞到之前就已經話咗你知。',
      '最多 {maxPages} 頁，每頁 {maxChars} 個字——真金白銀嘅上限，未撞牆先話你知。'
    )
  },
  'mineflayerWorld.book.slot': { en: flat('Inventory slot holding an unsigned book'), yue: flat('放住未簽名書本嘅背包格') },
  'mineflayerWorld.book.noSlot': { en: flat('No writable book found yet'), yue: flat('未搵到可寫嘅書') },
  'mineflayerWorld.book.slotLabel': { en: flat('Slot {slot} ({count} book(s))'), yue: flat('第 {slot} 格（{count} 本書）') },
  'mineflayerWorld.book.refresh': {
    en: msg('Refresh the book slot list', 'Refresh the book slot list', 'Re-check the bag for books'),
    yue: msg('重新整理書本格清單', '重新整理書本格清單', '再翻下個袋有冇書')
  },
  'mineflayerWorld.book.author': { en: flat('Author (for signing only)'), yue: flat('作者（只限簽名用）') },
  'mineflayerWorld.book.title': { en: flat('Title (for signing only)'), yue: flat('書名（只限簽名用）') },
  'mineflayerWorld.book.pageCount': { en: flat('{count} of {max} pages'), yue: flat('第 {count} 頁，共 {max} 頁上限') },
  'mineflayerWorld.book.page': { en: flat('Page {n}'), yue: flat('第 {n} 頁') },
  'mineflayerWorld.book.pageChars': { en: flat('{count} of {max} characters'), yue: flat('{count} / {max} 個字元') },
  'mineflayerWorld.book.pageTooLong': {
    en: msg(
      'This page is over the limit and will be refused.',
      'This page is over the limit and will be refused.',
      'Whoa, this page is way over the limit -- it will get bounced.'
    ),
    yue: msg('呢一頁超過上限，會被拒絕。', '呢一頁超過上限，會被拒絕。', '呢頁寫爆咗上限，梗係唔收㗎啦。')
  },
  'mineflayerWorld.book.removePage': { en: flat('Remove page {n}'), yue: flat('刪除第 {n} 頁') },
  'mineflayerWorld.book.needOnePage': {
    en: flat('A book needs at least one page.'),
    yue: flat('一本書至少要有一頁。')
  },
  'mineflayerWorld.book.addPage': {
    en: msg('Add page', 'Add page', 'Chuck in another page'),
    yue: msg('新增一頁', '新增一頁', '加多一頁落去')
  },
  'mineflayerWorld.book.pageLimit': {
    en: flat('This runtime allows at most {max} pages.'),
    yue: flat('呢個執行環境最多容許 {max} 頁。')
  },
  'mineflayerWorld.book.needSlot': {
    en: msg('Choose a slot holding an unsigned book first.', 'Choose a slot holding an unsigned book first.', 'Pick a slot with an actual blank book in it first.'),
    yue: msg('請先揀一個放住未簽名書本嘅格。', '請先揀一個放住未簽名書本嘅格。', '未揀到有書嘅格喎，先揀返個。')
  },
  'mineflayerWorld.book.write': {
    en: msg('Write (leave unsigned)', 'Write (leave unsigned)', 'Jot it down, skip the autograph'),
    yue: msg('寫入（暫不簽名）', '寫入（暫不簽名）', '寫低就好，簽名遲啲先')
  },
  'mineflayerWorld.book.written': {
    en: flat('The book was written.'),
    yue: flat('書本已寫好。')
  },
  'mineflayerWorld.book.needAuthorTitle': {
    en: msg(
      'Enter both an author and a title to sign a book.',
      'Enter both an author and a title to sign a book.',
      'A signed book needs both a name and a title -- fill in both.'
    ),
    yue: msg('簽名前請輸入作者同書名。', '簽名前請輸入作者同書名。', '想簽名？作者同書名兩樣都要填。')
  },
  'mineflayerWorld.book.sign': {
    en: msg('Sign and finish', 'Sign and finish', 'Sign it, seal it'),
    yue: msg('簽名並完成', '簽名並完成', '簽埋個名搞掂佢')
  },
  'mineflayerWorld.book.signed': {
    en: flat('The book was signed.'),
    yue: flat('書本已簽名。')
  },
  'mineflayerWorld.book.signUnavailable': {
    en: msg(
      'Signing is not reachable yet: the shared bot runtime does not expose "signBook" on its method list. See this feature\'s documentation for the exact addition it needs.',
      'Signing is not reachable yet: the shared bot runtime does not expose "signBook" on its method list. See this feature\'s documentation for the exact addition it needs.',
      'Signing is not switched on yet -- the shared runtime never learned "signBook". This feature\'s docs say exactly what it needs.'
    ),
    yue: msg(
      '簽名功能未接通：共用嘅機械人執行環境未有喺方法清單度公開「signBook」。詳情見呢個功能嘅文件。',
      '簽名功能未接通：共用嘅機械人執行環境未有喺方法清單度公開「signBook」。詳情見呢個功能嘅文件。',
      '簽名暫時㩒唔到：共用執行環境仲未識「signBook」呢個方法。想知點解，去睇下呢個功能嘅文件。'
    )
  },

  /* ================================================================ */
  /* creative-section.ts                                               */
  /* ================================================================ */

  'mineflayerWorld.creative.heading': {
    en: msg('Creative mode tools', 'Creative mode tools', 'Creative mode: the fun toolbox'),
    yue: msg('創造模式工具', '創造模式工具', '創造模式嘅玩具箱')
  },
  'mineflayerWorld.creative.heading.description': {
    en: msg(
      'Give item, set block, fly and instant break -- available only while the connected server reports creative gamemode, and disabled with the exact reason otherwise.',
      'Give item, set block, fly and instant break -- available only while the connected server reports creative gamemode, and disabled with the exact reason otherwise.',
      'Give item, set block, fly and instant break -- only live while the server actually says creative, greyed out with the exact reason the rest of the time.'
    ),
    yue: msg(
      '給予物品、設置方塊、飛行同瞬間破壞——只有喺伺服器回報創造模式先可用，否則會停用並顯示確實原因。',
      '給予物品、設置方塊、飛行同瞬間破壞——只有喺伺服器回報創造模式先可用，否則會停用並顯示確實原因。',
      '畀嘢、放方塊、飛天、秒挖——伺服器話創造模式先開得，唔係就乖乖鎖住並話你知點解。'
    )
  },
  'mineflayerWorld.creative.notCreative': {
    en: flat('The connected server reports gamemode "{mode}", not creative.'),
    yue: flat('連接緊嘅伺服器回報遊戲模式係「{mode}」，唔係創造模式。')
  },
  'mineflayerWorld.creative.ready': {
    en: flat('This server is in creative mode; every control below is available.'),
    yue: flat('呢個伺服器係創造模式，下面全部功能都用得。')
  },
  'mineflayerWorld.creative.item': { en: flat('Item or block name'), yue: flat('物品或方塊名稱') },
  'mineflayerWorld.creative.slot': { en: flat('Inventory slot (0-44)'), yue: flat('背包格（0-44）') },
  'mineflayerWorld.creative.count': { en: flat('Count'), yue: flat('數量') },
  'mineflayerWorld.creative.give': {
    en: msg('Give / set block', 'Give / set block', 'Conjure it up'),
    yue: msg('給予／設置方塊', '給予／設置方塊', '變一件出嚟')
  },
  'mineflayerWorld.creative.needItem': {
    en: msg('Enter an item or block name and a slot number.', 'Enter an item or block name and a slot number.', 'Name the thing and pick a slot -- both needed.'),
    yue: msg('請輸入物品或方塊名稱以及格號。', '請輸入物品或方塊名稱以及格號。', '個名同格號兩樣都要打，唔係兩樣都要。')
  },
  'mineflayerWorld.creative.given': {
    en: msg('Slot {slot} now holds {name} ×{count}.', 'Slot {slot} now holds {name} ×{count}.', 'Slot {slot}: {name} ×{count}, delivered!'),
    yue: msg('第 {slot} 格而家係 {name} ×{count}。', '第 {slot} 格而家係 {name} ×{count}。', '第 {slot} 格已經有 {name} ×{count} 喇！')
  },
  'mineflayerWorld.creative.clearSlot': {
    en: msg('Clear this slot', 'Clear this slot', 'Empty this one out'),
    yue: msg('清空呢一格', '清空呢一格', '倒晒佢出嚟')
  },
  'mineflayerWorld.creative.slotCleared': {
    en: flat('Slot {slot} cleared.'),
    yue: flat('第 {slot} 格已清空。')
  },
  'mineflayerWorld.creative.clearAll': {
    en: msg('Clear the entire inventory', 'Clear the entire inventory', 'Wipe the whole bag'),
    yue: msg('清空整個背包', '清空整個背包', '成個袋倒晒佢')
  },
  'mineflayerWorld.creative.confirmClear': {
    en: flat('Clear every item from this bot\'s inventory'),
    yue: flat('清空呢個機械人背包入面所有物品')
  },
  'mineflayerWorld.creative.confirmClearAffected': {
    en: flat('Every slot in the bot\'s inventory'),
    yue: flat('機械人背包裏面嘅每一格')
  },
  'mineflayerWorld.creative.confirmClearBody': {
    en: flat('Every held and stored item is removed. Nothing here can bring them back.'),
    yue: flat('所有手持同儲存嘅物品都會被移除，冇得撤回。')
  },
  'mineflayerWorld.creative.cleared': {
    en: flat('Inventory cleared.'),
    yue: flat('背包已清空。')
  },
  'mineflayerWorld.creative.startFly': {
    en: msg('Start flying', 'Start flying', 'Take off'),
    yue: msg('開始飛行', '開始飛行', '起飛')
  },
  'mineflayerWorld.creative.stopFly': {
    en: msg('Stop flying', 'Stop flying', 'Come back down'),
    yue: msg('停止飛行', '停止飛行', '落返地面')
  },
  'mineflayerWorld.creative.flyTo': {
    en: msg('Fly to these coordinates', 'Fly to these coordinates', 'Zoom over there'),
    yue: msg('飛去呢個座標', '飛去呢個座標', '一飛沖天去嗰度')
  },
  'mineflayerWorld.creative.instantBreak': {
    en: msg(
      'Instant break needs no separate control: the Dig button in the Blocks section above already breaks blocks instantly here, because the game itself treats creative mode as zero dig time.',
      'Instant break needs no separate control: the Dig button in the Blocks section above already breaks blocks instantly here, because the game itself treats creative mode as zero dig time.',
      'No extra button for instant break -- the ordinary Dig button up in Blocks is already instant here, since the game itself sets creative-mode dig time to zero.'
    ),
    yue: msg(
      '瞬間破壞唔使獨立掣：上面「方塊」區嘅挖掘掣喺創造模式已經即挖即碎，因為遊戲本身將創造模式嘅挖掘時間當做零。',
      '瞬間破壞唔使獨立掣：上面「方塊」區嘅挖掘掣喺創造模式已經即挖即碎，因為遊戲本身將創造模式嘅挖掘時間當做零。',
      '唔使開多個掣——上面「方塊」嗰粒挖掘掣喺創造模式已經即挖即碎，遊戲本身已經將挖掘時間算做零。'
    )
  },

  /* ================================================================ */
  /* ambience-section.ts                                               */
  /* ================================================================ */

  'mineflayerWorld.ambience.heading': {
    en: msg('World ambience and command blocks', 'World ambience and command blocks', 'The world\'s soundtrack, plus command blocks'),
    yue: msg('世界環境同指令方塊', '世界環境同指令方塊', '世界嘅背景聲效，仲有指令方塊')
  },
  'mineflayerWorld.ambience.heading.description': {
    en: msg(
      'Time and weather are shown at the top of this tab. Sounds, particles and weather changes stream in below as they really happen.',
      'Time and weather are shown at the top of this tab. Sounds, particles and weather changes stream in below as they really happen.',
      'Time and weather live up in the status bar. Down here, sounds, particles and weather flips roll in live as they actually happen.'
    ),
    yue: msg(
      '時間同天氣已顯示喺呢個分頁頂部。聲音、粒子同天氣變化就會喺下面即時串流顯示。',
      '時間同天氣已顯示喺呢個分頁頂部。聲音、粒子同天氣變化就會喺下面即時串流顯示。',
      '時間天氣上面已經有得睇。聲音、粒子、天氣轉變就即時喺下面滾動顯示。'
    )
  },
  'mineflayerWorld.ambience.explosionNote': {
    en: msg(
      'This build of the bot library never emits an explosion event -- explosion.js only calculates damage, it does not report explosions happening. Nothing here fakes one; open the full event inspector to watch the raw "blockUpdate" events an explosion leaves behind instead.',
      'This build of the bot library never emits an explosion event -- explosion.js only calculates damage, it does not report explosions happening. Nothing here fakes one; open the full event inspector to watch the raw "blockUpdate" events an explosion leaves behind instead.',
      'No explosion event exists in this library -- explosion.js just does the maths, it never actually announces a boom. Nothing here is going to fake one; go watch the raw "blockUpdate" debris in the event inspector instead.'
    ),
    yue: msg(
      '呢個版本嘅機械人庫從來唔會發出爆炸事件——explosion.js 只會計算傷害，唔會回報爆炸實際發生。呢度唔會假扮一個；請打開完整事件檢查器，睇下爆炸留低嘅原始「blockUpdate」事件。',
      '呢個版本嘅機械人庫從來唔會發出爆炸事件——explosion.js 只會計算傷害，唔會回報爆炸實際發生。呢度唔會假扮一個；請打開完整事件檢查器，睇下爆炸留低嘅原始「blockUpdate」事件。',
      '呢個庫根本冇「爆炸」呢個事件——explosion.js 淨係識計數，唔會嗌一聲「嘭」。呢度唔會扮嘢整一個出嚟，想睇爆炸嘅手尾就去事件檢查器睇「blockUpdate」。'
    )
  },
  'mineflayerWorld.ambience.openInspector': {
    en: msg('Open the event inspector', 'Open the event inspector', 'Go peek at the raw event firehose'),
    yue: msg('開啟事件檢查器', '開啟事件檢查器', '去睇下原始事件水喉')
  },
  'mineflayerWorld.ambience.feed': { en: flat('Ambience feed'), yue: flat('環境事件清單') },
  'mineflayerWorld.ambience.column.time': { en: flat('Time'), yue: flat('時間') },
  'mineflayerWorld.ambience.column.event': { en: flat('Event'), yue: flat('事件') },
  'mineflayerWorld.ambience.column.detail': { en: flat('Detail'), yue: flat('詳情') },
  'mineflayerWorld.ambience.empty': {
    en: msg('Nothing has happened yet.', 'Nothing has happened yet.', 'Dead quiet so far.'),
    yue: msg('未有發生過任何事件。', '未有發生過任何事件。', '目前靜英英，乜都未發生。')
  },
  'mineflayerWorld.ambience.search': { en: flat('Filter the feed'), yue: flat('篩選事件清單') },
  'mineflayerWorld.ambience.pause': { en: flat('Pause the feed'), yue: flat('暫停事件清單') },
  'mineflayerWorld.ambience.clear': { en: flat('Clear'), yue: flat('清空') },

  'mineflayerWorld.command.heading': {
    en: msg('Command block editor', 'Command block editor', 'Command block, do my bidding'),
    yue: msg('指令方塊編輯器', '指令方塊編輯器', '指令方塊，聽我使喚')
  },
  'mineflayerWorld.command.heading.description': {
    en: flat('Requires creative mode, exactly as opening a command block does at a real Minecraft client.'),
    yue: flat('需要創造模式，同真正 Minecraft 客戶端打開指令方塊嘅要求一樣。')
  },
  'mineflayerWorld.command.text': { en: flat('Command'), yue: flat('指令') },
  'mineflayerWorld.command.mode': { en: flat('Block type'), yue: flat('方塊類型') },
  'mineflayerWorld.command.mode.redstone': { en: flat('Impulse (redstone)'), yue: flat('脈衝（紅石）') },
  'mineflayerWorld.command.mode.sequence': { en: flat('Chain (sequence)'), yue: flat('連鎖（順序）') },
  'mineflayerWorld.command.mode.auto': { en: flat('Repeat (auto)'), yue: flat('重複（自動）') },
  'mineflayerWorld.command.trackOutput': { en: flat('Track output'), yue: flat('記錄輸出') },
  'mineflayerWorld.command.conditional': { en: flat('Conditional'), yue: flat('條件式') },
  'mineflayerWorld.command.alwaysActive': { en: flat('Always active'), yue: flat('常時運作') },
  'mineflayerWorld.command.needPosition': {
    en: msg('Enter the command block\'s X, Y and Z.', 'Enter the command block\'s X, Y and Z.', 'Where\'s the block? Give me X, Y, Z.'),
    yue: msg('請輸入指令方塊嘅 X、Y、Z。', '請輸入指令方塊嘅 X、Y、Z。', '個方塊喺邊？打埋 X Y Z 先。')
  },
  'mineflayerWorld.command.needCommand': {
    en: msg('Enter a command.', 'Enter a command.', 'Type something for it to actually do.'),
    yue: msg('請輸入指令。', '請輸入指令。', '要打樣嘢畀佢做㗎嘛。')
  },
  'mineflayerWorld.command.apply': {
    en: msg('Set the command block', 'Set the command block', 'Program the block'),
    yue: msg('設置指令方塊', '設置指令方塊', '幫個方塊寫程式')
  },
  'mineflayerWorld.command.applied': {
    en: flat('Command block updated.'),
    yue: flat('指令方塊已更新。')
  },

  /* ================================================================ */
  /* resourcepack-section.ts                                           */
  /* ================================================================ */

  'mineflayerWorld.pack.heading': {
    en: msg('Resource pack requests', 'Resource pack requests', 'A server wants to redecorate'),
    yue: msg('資源包請求', '資源包請求', '伺服器想幫你換裝修')
  },
  'mineflayerWorld.pack.heading.description': {
    en: msg(
      'A server can ask the bot to load a resource pack. Nothing here accepts one on your behalf -- every request waits for an explicit choice.',
      'A server can ask the bot to load a resource pack. Nothing here accepts one on your behalf -- every request waits for an explicit choice.',
      'A server might ask the bot to load a resource pack. Nothing here says yes for you -- every request just sits there until you pick.'
    ),
    yue: msg(
      '伺服器可以要求機械人載入資源包。呢度唔會自動幫你答應——每個請求都要等你明確揀答案。',
      '伺服器可以要求機械人載入資源包。呢度唔會自動幫你答應——每個請求都要等你明確揀答案。',
      '伺服器想機械人載入個資源包？冇問題，但呢度唔會自把自為幫你答應，一定要你自己揀。'
    )
  },
  'mineflayerWorld.pack.none': {
    en: msg(
      'No resource pack has been requested this session.',
      'No resource pack has been requested this session.',
      'Nobody has asked for a new coat of paint yet this session.'
    ),
    yue: msg('呢個工作階段未有收到資源包請求。', '呢個工作階段未有收到資源包請求。', '呢節都未有人嚟叫你換裝修。')
  },
  'mineflayerWorld.pack.requested': {
    en: flat('The server offered: {url}'),
    yue: flat('伺服器提供：{url}')
  },
  'mineflayerWorld.pack.identifier': {
    en: flat('Identifier: {identifier}'),
    yue: flat('識別碼：{identifier}')
  },
  'mineflayerWorld.pack.explain': {
    en: msg(
      'Accepting downloads and applies that pack for the bot\'s client-side view of the world (textures, sounds and models). Declining tells the server the bot will keep its default look. Neither choice affects gameplay rules.',
      'Accepting downloads and applies that pack for the bot\'s client-side view of the world (textures, sounds and models). Declining tells the server the bot will keep its default look. Neither choice affects gameplay rules.',
      'Say yes and it downloads new textures, sounds and models for how the bot sees the world. Say no and it keeps the default look. Either way, the actual rules of the game do not change.'
    ),
    yue: msg(
      '接受會下載並套用呢個包，改變機械人客戶端顯示嘅世界（材質、聲音、模型）。拒絕就話伺服器機械人會保持預設外觀。兩者都唔會影響遊戲規則。',
      '接受會下載並套用呢個包，改變機械人客戶端顯示嘅世界（材質、聲音、模型）。拒絕就話伺服器機械人會保持預設外觀。兩者都唔會影響遊戲規則。',
      '答應就落新材質新聲音新模型，機械人望出去嘅世界會唔同晒。唔要就照舊，遊戲規則兩樣都唔會變。'
    )
  },
  'mineflayerWorld.pack.accept': {
    en: msg('Accept the current request', 'Accept the current request', 'Say yes to it'),
    yue: msg('接受目前請求', '接受目前請求', '應承佢')
  },
  'mineflayerWorld.pack.accepted': {
    en: flat('Accepted.'),
    yue: flat('已接受。')
  },
  'mineflayerWorld.pack.decline': {
    en: msg('Decline the current request', 'Decline the current request', 'Say no thanks'),
    yue: msg('拒絕目前請求', '拒絕目前請求', '唔要啦多謝')
  },
  'mineflayerWorld.pack.declined': {
    en: flat('Declined.'),
    yue: flat('已拒絕。')
  },
  'mineflayerWorld.pack.newRequest': {
    en: msg(
      'The server offered a resource pack. Review it before choosing.',
      'The server offered a resource pack. Review it before choosing.',
      'Ooh, the server just offered a resource pack -- have a look before you decide.'
    ),
    yue: msg('伺服器提供咗一個資源包，請先查看再決定。', '伺服器提供咗一個資源包，請先查看再決定。', '喂，伺服器彈咗個資源包出嚟，睇清楚先至答佢。')
  },
  'mineflayerWorld.pack.history': { en: flat('Request history'), yue: flat('請求記錄') },
  'mineflayerWorld.pack.column.time': { en: flat('Time'), yue: flat('時間') },
  'mineflayerWorld.pack.column.url': { en: flat('URL'), yue: flat('網址') },
  'mineflayerWorld.pack.column.identifier': { en: flat('Identifier'), yue: flat('識別碼') }
};
