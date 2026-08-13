/**
 * Every user-facing string this feature renders, in English and playful Hong
 * Kong-style Cantonese, at all five humour levels. Voice changes with the
 * level; the facts — what happened, what it affects, what the options are —
 * stay identical across all five rungs of both languages. Item names, block
 * names, error text the runtime returns, and numbers are never i18n keys:
 * they are the server's own real data and are interpolated with `{values}`.
 */

import type { Catalogue } from '../../core/registry';

type Ladder = [string, string, string, string, string];

function l(level1: string, level2: string, level3: string, level4: string, level5: string): Ladder {
  return [level1, level2, level3, level4, level5];
}

/** For technical labels where escalating jokes would obscure the fact rather than dress it. */
function same(text: string): Ladder {
  return [text, text, text, text, text];
}

export const MINEFLAYER_INVENTORY_STRINGS: Catalogue = {
  /* ---------------------------------------------------------------- */
  /* Tabs                                                              */
  /* ---------------------------------------------------------------- */
  'mineflayerInventory.tab.inventory': {
    en: l('Inventory', 'Inventory', 'Inventory', 'The bag of holding', 'The bag of holding'),
    yue: l('背包', '背包', '背包', '百寶袋', '百寶袋')
  },
  'mineflayerInventory.tab.inventory.subtitle': {
    en: l(
      'The bot\'s real slots, moved by drag or by keyboard',
      'The bot\'s real slots, moved by drag or by keyboard',
      'Every slot the bot really has, dragged or keyed around',
      'Rummage through what the bot is actually carrying',
      'Rummage through what the bot is actually carrying'
    ),
    yue: l(
      '機械人真實嘅格仔，可以拖或者用鍵盤郁',
      '機械人真實嘅格仔，可以拖或者用鍵盤郁',
      '機械人真係有嘅每一格，拖得郁又㩒得郁',
      '揦一揦機械人袋緊啲乜',
      '揦一揦機械人袋緊啲乜'
    )
  },
  'mineflayerInventory.tab.containers': {
    en: l('Containers', 'Containers', 'Containers', 'Other people\'s boxes', 'Other people\'s boxes'),
    yue: l('容器', '容器', '容器', '人哋嘅箱', '人哋嘅箱')
  },
  'mineflayerInventory.tab.containers.subtitle': {
    en: l(
      'Chests, dispensers, droppers, hoppers, shulkers, ender chests and barrels',
      'Chests, dispensers, droppers, hoppers, shulkers, ender chests and barrels',
      'Every openable box nearby: chest, dispenser, dropper, hopper, shulker, ender chest, barrel',
      'Every nearby box worth rummaging through',
      'Every nearby box worth rummaging through'
    ),
    yue: l(
      '箱、發射器、投擲器、漏斗、界伏盒、終界箱同木桶',
      '箱、發射器、投擲器、漏斗、界伏盒、終界箱同木桶',
      '附近每個開得嘅箱：箱、發射器、投擲器、漏斗、界伏盒、終界箱、木桶',
      '附近所有值得揦嘅箱',
      '附近所有值得揦嘅箱'
    )
  },
  'mineflayerInventory.tab.crafting': {
    en: l('Crafting', 'Crafting', 'Crafting', 'The recipe book', 'The recipe book'),
    yue: l('合成', '合成', '合成', '食譜簿', '食譜簿')
  },
  'mineflayerInventory.tab.crafting.subtitle': {
    en: l(
      'Search recipes by result or ingredient; craft what the inventory can really make',
      'Search recipes by result or ingredient; craft what the inventory can really make',
      'Search by result or ingredient, see what is really craftable right now',
      'Find the recipe, see what is missing, make the thing',
      'Find the recipe, see what is missing, make the thing'
    ),
    yue: l(
      '用成品或者材料搜尋食譜；合成背包真係整得出嘅嘢',
      '用成品或者材料搜尋食譜；合成背包真係整得出嘅嘢',
      '用成品或者材料搵食譜，睇下而家真係整唔整得出',
      '搵到食譜、睇差咩、整嘢出嚟',
      '搵到食譜、睇差咩、整嘢出嚟'
    )
  },
  'mineflayerInventory.tab.workstations': {
    en: l('Workstations', 'Workstations', 'Workstations', 'The workshop', 'The workshop'),
    yue: l('工作站', '工作站', '工作站', '工場', '工場')
  },
  'mineflayerInventory.tab.workstations.subtitle': {
    en: l(
      'Furnaces, blast furnaces, smokers, the anvil and the enchanting table',
      'Furnaces, blast furnaces, smokers, the anvil and the enchanting table',
      'Furnace, blast furnace, smoker, anvil, enchanting table',
      'Where the smelting, smacking and sparkling happens',
      'Where the smelting, smacking and sparkling happens'
    ),
    yue: l(
      '熔爐、高爐、煙燻爐、鐵砧同附魔台',
      '熔爐、高爐、煙燻爐、鐵砧同附魔台',
      '熔爐、高爐、煙燻爐、鐵砧、附魔台',
      '熔嘢、鎚嘢、閃令令嘅地方',
      '熔嘢、鎚嘢、閃令令嘅地方'
    )
  },
  'mineflayerInventory.tab.villagers': {
    en: l('Villager trading', 'Villager trading', 'Villager trading', 'The market stall', 'The market stall'),
    yue: l('村民交易', '村民交易', '村民交易', '墟市檔口', '墟市檔口')
  },
  'mineflayerInventory.tab.villagers.subtitle': {
    en: l(
      'Trades, uses remaining and disabled reasons',
      'Trades, uses remaining and disabled reasons',
      'What is on offer, how many uses are left, and why a trade is blocked',
      'Haggle with the locals, or at least see what they want',
      'Haggle with the locals, or at least see what they want'
    ),
    yue: l(
      '交易、剩餘次數同封鎖原因',
      '交易、剩餘次數同封鎖原因',
      '有咩交易、仲剩幾多次、點解某啲唔畀做',
      '同村民講價，至少睇下佢想點',
      '同村民講價，至少睇下佢想點'
    )
  },

  /* ---------------------------------------------------------------- */
  /* Common — bot state gates                                          */
  /* ---------------------------------------------------------------- */
  'mineflayerInventory.empty.noBot.title': {
    en: same('No bot is connected'),
    yue: same('未連線任何機械人')
  },
  'mineflayerInventory.empty.noBot.body': {
    en: l(
      'Connect a bot from the Bots tab first. This tab drives whichever bot is active there.',
      'Connect a bot from the Bots tab first. This tab drives whichever bot is active there.',
      'Head to the Bots tab and connect one — this tab always drives the active bot from there.',
      'No bot, no bag. Go connect one on the Bots tab first.',
      'No bot, no bag. Go connect one on the Bots tab first.'
    ),
    yue: l(
      '請先喺「機械人」分頁連線一隻機械人。呢個分頁會操控嗰邊揀緊嘅機械人。',
      '請先喺「機械人」分頁連線一隻機械人。呢個分頁會操控嗰邊揀緊嘅機械人。',
      '去「機械人」分頁揀隻連埋線先，呢度會跟住嗰邊揀緊嗰隻。',
      '冇機械人就冇袋執。快啲去「機械人」分頁接一隻。',
      '冇機械人就冇袋執。快啲去「機械人」分頁接一隻。'
    )
  },
  'mineflayerInventory.empty.notSpawned.title': {
    en: same('The bot has not spawned into the world yet'),
    yue: same('機械人仲未真正入到個世界')
  },
  'mineflayerInventory.empty.notSpawned.body': {
    en: l(
      'Slot data only exists once the bot has spawned. Current status: {status}.',
      'Slot data only exists once the bot has spawned. Current status: {status}.',
      'There is nothing real to show until spawn happens. Current status: {status}.',
      'No spawn, no stuff to show you. Current status: {status}.',
      'No spawn, no stuff to show you. Current status: {status}.'
    ),
    yue: l(
      '要等機械人真正入咗個世界先有格仔資料。而家狀態：{status}。',
      '要等機械人真正入咗個世界先有格仔資料。而家狀態：{status}。',
      '未入到世界就冇嘢好睇。而家狀態：{status}。',
      '未 spawn 就乜都冇得畀你睇。而家狀態：{status}。',
      '未 spawn 就乜都冇得畀你睇。而家狀態：{status}。'
    )
  },
  'mineflayerInventory.disabled.notReady': {
    en: same('The active bot is not spawned into the world right now, so nothing here can be moved.'),
    yue: same('而家揀緊嗰隻機械人未入到個世界，所以呢度啲嘢郁唔到。')
  },
  'mineflayerInventory.disabled.actionPending': {
    en: same('Another action on this window is still in flight — wait for it to finish before starting another.'),
    yue: same('呢個視窗仲有另一個動作進行緊，等佢做完先可以再嚟過。')
  },
  'mineflayerInventory.action.refresh': {
    en: same('Refresh'),
    yue: same('重新整理')
  },

  /* ---------------------------------------------------------------- */
  /* Slot accessibility (item-view.ts)                                 */
  /* ---------------------------------------------------------------- */
  'mineflayerInventory.slot.empty': {
    en: same('{slot}: empty'),
    yue: same('{slot}：空')
  },
  'mineflayerInventory.slot.filled': {
    en: same('{slot}: {name} times {count}{durability}'),
    yue: same('{slot}：{name} × {count}{durability}')
  },
  'mineflayerInventory.slot.durability': {
    en: same(', {used} of {max} durability used'),
    yue: same('，耐久用咗 {used}／{max}')
  },

  /* ---------------------------------------------------------------- */
  /* Inventory tab                                                     */
  /* ---------------------------------------------------------------- */
  'mineflayerInventory.inventory.section.craft': {
    en: same('Crafting grid'),
    yue: same('合成格')
  },
  'mineflayerInventory.inventory.section.armor': {
    en: same('Armour'),
    yue: same('盔甲')
  },
  'mineflayerInventory.inventory.section.offhand': {
    en: same('Off hand'),
    yue: same('副手')
  },
  'mineflayerInventory.inventory.section.main': {
    en: same('Main inventory'),
    yue: same('主背包')
  },
  'mineflayerInventory.inventory.section.hotbar': {
    en: same('Hotbar'),
    yue: same('快捷欄')
  },
  'mineflayerInventory.inventory.label.head': { en: same('Head'), yue: same('頭部') },
  'mineflayerInventory.inventory.label.torso': { en: same('Chest'), yue: same('身體') },
  'mineflayerInventory.inventory.label.legs': { en: same('Legs'), yue: same('腿部') },
  'mineflayerInventory.inventory.label.feet': { en: same('Feet'), yue: same('腳部') },
  'mineflayerInventory.inventory.pickedHint': {
    en: l(
      'Picked up {name}. Choose a destination slot, or press it again to put it back.',
      'Picked up {name}. Choose a destination slot, or press it again to put it back.',
      'Holding {name} — pick where it goes, or press the same slot to cancel.',
      'You are holding {name}. Point it somewhere, or tap it again to chicken out.',
      'You are holding {name}. Point it somewhere, or tap it again to chicken out.'
    ),
    yue: l(
      '揸緊 {name}。揀個目的地格，或者再撳返原本嗰格放返低。',
      '揸緊 {name}。揀個目的地格，或者再撳返原本嗰格放返低。',
      '手揸住 {name}——揀個位放，或者撳返原本個格取消。',
      '你手上有 {name}，揀個位擺低，唔係就撳返原位縮沙。',
      '你手上有 {name}，揀個位擺低，唔係就撳返原位縮沙。'
    )
  },
  'mineflayerInventory.inventory.pickedHint.empty': {
    en: same('Select a slot with an item in it to pick it up, then select where it should go.'),
    yue: same('揀一格有嘢嘅格仔揸起佢，再揀想放去邊。')
  },
  'mineflayerInventory.inventory.action.equip': { en: same('Equip'), yue: same('著上／揸起') },
  'mineflayerInventory.inventory.action.equipDestination': { en: same('Destination'), yue: same('目的地') },
  'mineflayerInventory.inventory.action.equipHead': { en: same('Equip to head'), yue: same('著喺頭部') },
  'mineflayerInventory.inventory.action.equipTorso': { en: same('Equip to chest'), yue: same('著喺身體') },
  'mineflayerInventory.inventory.action.equipLegs': { en: same('Equip to legs'), yue: same('著喺腿部') },
  'mineflayerInventory.inventory.action.equipFeet': { en: same('Equip to feet'), yue: same('著喺腳部') },
  'mineflayerInventory.inventory.action.equipHand': { en: same('Equip to hand'), yue: same('揸喺手上') },
  'mineflayerInventory.inventory.action.equipOffhand': { en: same('Equip to off hand'), yue: same('放喺副手') },
  'mineflayerInventory.inventory.action.split': {
    en: l('Split stack', 'Split stack', 'Split the stack in half', 'Snap it in two', 'Snap it in two'),
    yue: l('拆一半', '拆一半', '將呢疊拆一半', '一分為二', '一分為二')
  },
  'mineflayerInventory.inventory.action.dropOne': { en: same('Drop one'), yue: same('掉低一件') },
  'mineflayerInventory.inventory.action.dropStack': { en: same('Drop the stack'), yue: same('成疊掉低') },
  'mineflayerInventory.inventory.action.quickMove': {
    en: l(
      'Quick-move to hotbar',
      'Quick-move to hotbar',
      'Send it straight to the hotbar',
      'Zap it to the hotbar',
      'Zap it to the hotbar'
    ),
    yue: l('快速搬去快捷欄', '快速搬去快捷欄', '即刻搬去快捷欄', '嗖一聲搬去快捷欄', '嗖一聲搬去快捷欄')
  },
  'mineflayerInventory.inventory.action.cancel': { en: same('Cancel'), yue: same('取消') },
  'mineflayerInventory.inventory.moveFailed': {
    en: same('That move was refused: {error}'),
    yue: same('嗰個郁動被拒絕：{error}')
  },
  'mineflayerInventory.inventory.equipFailed': {
    en: same('Equipping {name} failed: {error}'),
    yue: same('著 {name} 失敗：{error}')
  },
  'mineflayerInventory.inventory.tossFailed': {
    en: same('Dropping {name} failed: {error}'),
    yue: same('掉低 {name} 失敗：{error}')
  },

  /* ---------------------------------------------------------------- */
  /* Containers tab                                                    */
  /* ---------------------------------------------------------------- */
  'mineflayerInventory.containers.nearbyLabel': {
    en: same('Nearby containers'),
    yue: same('附近容器')
  },
  'mineflayerInventory.containers.search': {
    en: same('Search nearby containers'),
    yue: same('搜尋附近容器')
  },
  'mineflayerInventory.containers.open': { en: same('Open'), yue: same('打開') },
  'mineflayerInventory.containers.none': {
    en: l(
      'No matching container was found within {radius} blocks.',
      'No matching container was found within {radius} blocks.',
      'Nothing matching turned up within {radius} blocks — try moving closer or widening the search radius in Settings.',
      'Nothing within {radius} blocks. Wander over, or widen the search radius in Settings.',
      'Nothing within {radius} blocks. Wander over, or widen the search radius in Settings.'
    ),
    yue: l(
      '{radius} 格範圍內搵唔到相關容器。',
      '{radius} 格範圍內搵唔到相關容器。',
      '{radius} 格內乜都搵唔到——行埋啲，或者去設定攞大搜尋範圍。',
      '{radius} 格內冇嘢。行過去睇下，或者喺設定加大範圍。',
      '{radius} 格內冇嘢。行過去睇下，或者喺設定加大範圍。'
    )
  },
  'mineflayerInventory.containers.openedTitle': {
    en: same('{name} — {count} slots'),
    yue: same('{name} — {count} 格')
  },
  'mineflayerInventory.containers.close': { en: same('Close container'), yue: same('關閉容器') },
  'mineflayerInventory.containers.section.container': { en: same('Container'), yue: same('容器') },
  'mineflayerInventory.containers.section.yourInventory': { en: same('Your inventory'), yue: same('你嘅背包') },
  'mineflayerInventory.containers.withdrawAll': { en: same('Withdraw all'), yue: same('全部提取') },
  'mineflayerInventory.containers.depositAll': { en: same('Deposit all'), yue: same('全部存入') },
  'mineflayerInventory.containers.withdrawAll.title': {
    en: same('Withdraw all {count} items from {name}'),
    yue: same('由 {name} 提取全部 {count} 件')
  },
  'mineflayerInventory.containers.depositAll.title': {
    en: same('Deposit all {count} items into {name}'),
    yue: same('存入全部 {count} 件去 {name}')
  },
  'mineflayerInventory.containers.previewBody': {
    en: same('{stacks} stacks, {count} items total, will move: {items}'),
    yue: same('{stacks} 疊、共 {count} 件會移動：{items}')
  },
  'mineflayerInventory.containers.nothingToMove': {
    en: same('There is nothing to move.'),
    yue: same('冇嘢可以移動。')
  },
  'mineflayerInventory.containers.moveResult': {
    en: same('{moved} of {total} stacks moved.'),
    yue: same('{moved}／{total} 疊已移動。')
  },
  'mineflayerInventory.containers.openFailed': {
    en: same('Opening {name} failed: {error}'),
    yue: same('打開 {name} 失敗：{error}')
  },
  'mineflayerInventory.containers.closedElsewhere': {
    en: same('This container was closed — by distance, another player, or the server.'),
    yue: same('呢個容器已經閂咗——可能太遠、俾第二個玩家或者伺服器閂咗。')
  },

  /* ---------------------------------------------------------------- */
  /* Crafting tab                                                      */
  /* ---------------------------------------------------------------- */
  'mineflayerInventory.crafting.search': {
    en: same('Search by result or ingredient'),
    yue: same('用成品或材料搜尋')
  },
  'mineflayerInventory.crafting.moreResults': {
    en: same('{count} more match — refine the search to narrow it down.'),
    yue: same('重仲有 {count} 個符合——收窄下搜尋條件。')
  },
  'mineflayerInventory.crafting.noResults': {
    en: same('No bundled recipe matches that search.'),
    yue: same('搵唔到符合嘅內置食譜。')
  },
  'mineflayerInventory.crafting.catalogNote': {
    en: l(
      'Recipes are read from a bundled Minecraft {version} snapshot, and never over the network. Craftability and every count shown are checked against the real, live inventory of the connected bot.',
      'Recipes are read from a bundled Minecraft {version} snapshot, and never over the network. Craftability and every count shown are checked against the real, live inventory of the connected bot.',
      'The recipe list comes from a bundled Minecraft {version} snapshot — no network involved. Whether something is craftable, and every count shown, is always checked against the connected bot\'s real, live inventory.',
      'Recipes: a bundled {version} snapshot, no internet required. Craftable-or-not: always the real, live inventory talking.',
      'Recipes: a bundled {version} snapshot, no internet required. Craftable-or-not: always the real, live inventory talking.'
    ),
    yue: l(
      '食譜資料嚟自內置嘅 Minecraft {version} 快照，唔會經網絡攞。可唔可以整同埋所有數量都係對住連線緊機械人嘅真實背包核實。',
      '食譜資料嚟自內置嘅 Minecraft {version} 快照，唔會經網絡攞。可唔可以整同埋所有數量都係對住連線緊機械人嘅真實背包核實。',
      '食譜清單嚟自內置 {version} 快照，唔使上網。整唔整得出同啲數量，永遠對住機械人真實背包核實。',
      '食譜：內置 {version} 快照，唔使上網。整唔整得出：永遠問返真背包。',
      '食譜：內置 {version} 快照，唔使上網。整唔整得出：永遠問返真背包。'
    )
  },
  'mineflayerInventory.crafting.variantLabel': {
    en: same('Variant {index} of {total}'),
    yue: same('第 {index} 款，共 {total} 款')
  },
  'mineflayerInventory.crafting.requiresTable': { en: same('Needs a crafting table'), yue: same('要用工作台') },
  'mineflayerInventory.crafting.noTable': { en: same('No table needed'), yue: same('唔使工作台') },
  'mineflayerInventory.crafting.craftableNow': { en: same('Craftable right now'), yue: same('而家整得出') },
  'mineflayerInventory.crafting.missingIngredients': {
    en: same('Missing: {list}'),
    yue: same('欠：{list}')
  },
  'mineflayerInventory.crafting.missingOne': {
    en: same('{name} ×{count} more'),
    yue: same('{name} 仲欠 {count} 件')
  },
  'mineflayerInventory.crafting.needsTableNearby': {
    en: same('Needs a crafting table — none was found within {radius} blocks.'),
    yue: same('要用工作台——{radius} 格範圍內搵唔到。')
  },
  'mineflayerInventory.crafting.craftCount': { en: same('How many to craft'), yue: same('整幾多次') },
  'mineflayerInventory.crafting.craftAction': { en: same('Craft'), yue: same('合成') },
  'mineflayerInventory.crafting.craftSuccess': {
    en: same('Crafted {count} × {name}.'),
    yue: same('已合成 {count} 件 {name}。')
  },
  'mineflayerInventory.crafting.craftFailed': {
    en: same('Crafting {name} failed: {error}'),
    yue: same('合成 {name} 失敗：{error}')
  },
  'mineflayerInventory.crafting.craftVariantNote': {
    en: l(
      'The bot crafts using whichever real recipe variant it finds it can complete, checked at the moment you craft — it may not always be the exact variant shown here if more than one exists.',
      'The bot crafts using whichever real recipe variant it finds it can complete, checked at the moment you craft — it may not always be the exact variant shown here if more than one exists.',
      'Crafting asks the bot to make this item; if more than one real variant exists it uses whichever it can complete at that moment, not necessarily the one pictured.',
      'Heads up: if there is more than one real recipe for this, the bot picks whichever one it can actually finish right now — might not be this exact picture.',
      'Heads up: if there is more than one real recipe for this, the bot picks whichever one it can actually finish right now — might not be this exact picture.'
    ),
    yue: l(
      '機械人會用佢當刻搵到、真係完成到嘅食譜變化去整——如果同一樣嘢有幾款食譜，未必一定係呢度顯示緊嗰款。',
      '機械人會用佢當刻搵到、真係完成到嘅食譜變化去整——如果同一樣嘢有幾款食譜，未必一定係呢度顯示緊嗰款。',
      '叫機械人整嘢嗰陣，如果有幾款食譜，佢會揀當刻做得到嗰款，未必係你而家見到嗰款。',
      '提提你：如果呢樣嘢有幾款食譜，機械人會用佢當刻搞得掂嗰款，未必係呢張圖。',
      '提提你：如果呢樣嘢有幾款食譜，機械人會用佢當刻搞得掂嗰款，未必係呢張圖。'
    )
  },

  /* ---------------------------------------------------------------- */
  /* Workstations tab                                                  */
  /* ---------------------------------------------------------------- */
  'mineflayerInventory.workstations.chooser': { en: same('Station'), yue: same('工作站') },
  'mineflayerInventory.workstations.furnace': { en: same('Furnace family'), yue: same('熔爐系列') },
  'mineflayerInventory.workstations.anvil': { en: same('Anvil'), yue: same('鐵砧') },
  'mineflayerInventory.workstations.enchanting': { en: same('Enchanting table'), yue: same('附魔台') },
  'mineflayerInventory.workstations.nearbyLabel': { en: same('Nearby stations'), yue: same('附近工作站') },
  'mineflayerInventory.workstations.none': {
    en: same('No matching station was found within {radius} blocks.'),
    yue: same('{radius} 格範圍內搵唔到相關工作站。')
  },
  'mineflayerInventory.workstations.open': { en: same('Open'), yue: same('打開') },
  'mineflayerInventory.workstations.close': { en: same('Close'), yue: same('關閉') },
  'mineflayerInventory.workstations.openFailed': {
    en: same('Opening {name} failed: {error}'),
    yue: same('打開 {name} 失敗：{error}')
  },
  'mineflayerInventory.workstations.furnace.input': { en: same('Input'), yue: same('放入格') },
  'mineflayerInventory.workstations.furnace.fuel': { en: same('Fuel'), yue: same('燃料') },
  'mineflayerInventory.workstations.furnace.output': { en: same('Output'), yue: same('產出格') },
  'mineflayerInventory.workstations.furnace.progressUnavailable': {
    en: l(
      'Live burn and cook progress is not available yet: the shared bot runtime does not currently forward furnace fuel/progress updates. The input, fuel and output slots above are real and update on refresh.',
      'Live burn and cook progress is not available yet: the shared bot runtime does not currently forward furnace fuel/progress updates. The input, fuel and output slots above are real and update on refresh.',
      'No live progress bar yet — the shared bot runtime does not forward the furnace\'s fuel/cook updates. What you see above (input, fuel, output) is real and refreshes on its own.',
      'The flame-and-progress bar isn\'t wired up on the runtime side yet, so it\'s honestly not shown. The three slots above are 100% real, though.',
      'The flame-and-progress bar isn\'t wired up on the runtime side yet, so it\'s honestly not shown. The three slots above are 100% real, though.'
    ),
    yue: l(
      '暫時未有即時燃燒同烹煮進度：共用嘅機械人執行環境未有轉發熔爐嘅燃料／進度更新。上面嘅放入、燃料、產出格係真實資料，會刷新。',
      '暫時未有即時燃燒同烹煮進度：共用嘅機械人執行環境未有轉發熔爐嘅燃料／進度更新。上面嘅放入、燃料、產出格係真實資料，會刷新。',
      '未有即時進度條——共用執行環境未轉發熔爐嘅燃料／進度更新。上面三格（放入、燃料、產出）係真實嘅，會自己刷新。',
      '火焰同進度條個部分執行環境仲未駁通，所以老實講冇顯示。不過上面三格係百分百真實。',
      '火焰同進度條個部分執行環境仲未駁通，所以老實講冇顯示。不過上面三格係百分百真實。'
    )
  },
  'mineflayerInventory.workstations.anvil.itemOne': { en: same('First item'), yue: same('第一件') },
  'mineflayerInventory.workstations.anvil.itemTwo': { en: same('Second item / material'), yue: same('第二件／材料') },
  'mineflayerInventory.workstations.anvil.result': { en: same('Result'), yue: same('結果') },
  'mineflayerInventory.workstations.anvil.collectResult': { en: same('Collect the result'), yue: same('攞走結果') },
  'mineflayerInventory.workstations.anvil.collectFailed': {
    en: same('Collecting the result failed: {error}'),
    yue: same('攞走結果失敗：{error}')
  },
  'mineflayerInventory.workstations.anvil.costUnavailable': {
    en: l(
      'The real repair cost is not shown: the shared bot runtime does not currently forward the anvil\'s cost, and there is no runtime method yet for renaming. Placing two items here still works — the server computes the real result, shown above once it appears.',
      'The real repair cost is not shown: the shared bot runtime does not currently forward the anvil\'s cost, and there is no runtime method yet for renaming. Placing two items here still works — the server computes the real result, shown above once it appears.',
      'No cost number shown: the runtime does not forward it yet, and there is no rename method either. Placing two real items still genuinely combines them — the server\'s own result appears above once it is ready.',
      'Cost and renaming aren\'t wired up here yet, honestly. Drop two items in, though, and the server will still really combine them — the result shows up above.',
      'Cost and renaming aren\'t wired up here yet, honestly. Drop two items in, though, and the server will still really combine them — the result shows up above.'
    ),
    yue: l(
      '暫時未顯示真實修理費用：共用嘅機械人執行環境未有轉發鐵砧費用，亦都仲未有改名嘅方法。喺呢度放兩件嘢仍然有效——伺服器會計出真實結果，一有就顯示喺上面。',
      '暫時未顯示真實修理費用：共用嘅機械人執行環境未有轉發鐵砧費用，亦都仲未有改名嘅方法。喺呢度放兩件嘢仍然有效——伺服器會計出真實結果，一有就顯示喺上面。',
      '未顯示費用：執行環境未轉發呢個數，亦都未有改名方法。但放兩件真嘢落去仍然係真係合成緊——伺服器算好個結果，一有就喺上面顯示。',
      '費用同改名呢部分老實講未駁好。不過放兩件落去，伺服器真係會幫你砌埋——結果會喺上面出現。',
      '費用同改名呢部分老實講未駁好。不過放兩件落去，伺服器真係會幫你砌埋——結果會喺上面出現。'
    )
  },
  'mineflayerInventory.workstations.enchant.target': { en: same('Item to enchant'), yue: same('要附魔嘅物品') },
  'mineflayerInventory.workstations.enchant.lapis': { en: same('Lapis lazuli'), yue: same('青金石') },
  'mineflayerInventory.workstations.enchant.offersUnavailable': {
    en: l(
      'The three enchantment offers, their real cost and their level requirement are not shown: the shared bot runtime does not yet forward the enchanting table\'s offers, and there is no runtime method yet to choose one. The item and lapis slots above are real.',
      'The three enchantment offers, their real cost and their level requirement are not shown: the shared bot runtime does not yet forward the enchanting table\'s offers, and there is no runtime method yet to choose one. The item and lapis slots above are real.',
      'No offer list here: the runtime does not forward the table\'s three offers yet, and there is no method to choose one either. The item and lapis slots above are real and move normally.',
      'The three glowing offers aren\'t wired up on the runtime side, so nothing fake is shown in their place. The slots above, though, are genuinely real.',
      'The three glowing offers aren\'t wired up on the runtime side, so nothing fake is shown in their place. The slots above, though, are genuinely real.'
    ),
    yue: l(
      '暫時未顯示三個附魔選項、真實費用同等級要求：共用嘅機械人執行環境未有轉發附魔台嘅選項，亦都未有方法揀選。上面嘅物品同青金石格係真實資料。',
      '暫時未顯示三個附魔選項、真實費用同等級要求：共用嘅機械人執行環境未有轉發附魔台嘅選項，亦都未有方法揀選。上面嘅物品同青金石格係真實資料。',
      '未顯示三個選項：執行環境未轉發附魔台嘅選項，亦都未有揀選方法。上面物品同青金石格係真實資料，郁得。',
      '三個閃令令附魔選項執行環境未駁好，所以冇假嘢擺喺度呃你。但上面嗰兩格係真㗎。',
      '三個閃令令附魔選項執行環境未駁好，所以冇假嘢擺喺度呃你。但上面嗰兩格係真㗎。'
    )
  },

  /* ---------------------------------------------------------------- */
  /* Villager trading tab                                              */
  /* ---------------------------------------------------------------- */
  'mineflayerInventory.villagers.nearbyLabel': { en: same('Nearby villagers'), yue: same('附近村民') },
  'mineflayerInventory.villagers.search': { en: same('Search nearby villagers'), yue: same('搜尋附近村民') },
  'mineflayerInventory.villagers.none': {
    en: same('No villager was found within {radius} blocks.'),
    yue: same('{radius} 格範圍內搵唔到村民。')
  },
  'mineflayerInventory.villagers.distance': {
    en: same('{distance} blocks away'),
    yue: same('距離 {distance} 格')
  },
  'mineflayerInventory.villagers.unavailable.title': {
    en: same('Trading is not available yet'),
    yue: same('交易功能暫時未有')
  },
  'mineflayerInventory.villagers.unavailable.body': {
    en: l(
      'Villagers are entities, and the shared bot runtime currently only opens a window at a block position. Opening a villager\'s trade window, and trading, need a runtime method this feature does not own — see this feature\'s documentation for exactly what is missing. The list above is real: it comes from the bot\'s own live entity list.',
      'Villagers are entities, and the shared bot runtime currently only opens a window at a block position. Opening a villager\'s trade window, and trading, need a runtime method this feature does not own — see this feature\'s documentation for exactly what is missing. The list above is real: it comes from the bot\'s own live entity list.',
      'The shared runtime can only open a window at a block position right now, and a villager is an entity, not a block — so its trade window cannot be opened yet. What you see above is a real, live list of nearby villagers.',
      'Villagers are people-shaped, not block-shaped, and the runtime only knows how to open block windows so far. The names and distances above are real, though — just no trading yet.',
      'Villagers are people-shaped, not block-shaped, and the runtime only knows how to open block windows so far. The names and distances above are real, though — just no trading yet.'
    ),
    yue: l(
      '村民係實體，而共用嘅機械人執行環境而家淨係識喺方塊位置開視窗。要開村民交易視窗同交易本身，都要一個呢個功能未擁有嘅執行環境方法——實際缺乜請睇呢個功能嘅文件。上面個名單係真實嘅：直接嚟自機械人自己嘅即時實體清單。',
      '村民係實體，而共用嘅機械人執行環境而家淨係識喺方塊位置開視窗。要開村民交易視窗同交易本身，都要一個呢個功能未擁有嘅執行環境方法——實際缺乜請睇呢個功能嘅文件。上面個名單係真實嘅：直接嚟自機械人自己嘅即時實體清單。',
      '共用執行環境而家淨係識開方塊視窗，村民係實體嚟嘅唔係方塊，所以開唔到交易視窗。上面嗰個就真係附近村民嘅即時名單。',
      '村民係人形唔係方塊形，執行環境暫時淨係識開方塊視窗。上面啲名同距離就真㗎，不過交易未得住先。',
      '村民係人形唔係方塊形，執行環境暫時淨係識開方塊視窗。上面啲名同距離就真㗎，不過交易未得住先。'
    )
  },

  /* ---------------------------------------------------------------- */
  /* Settings                                                          */
  /* ---------------------------------------------------------------- */
  'mineflayerInventory.settings.title': { en: same('Bot inventory search'), yue: same('機械人背包搜尋') },
  'mineflayerInventory.settings.radius': { en: same('Nearby search radius'), yue: same('附近搜尋範圍') },
  'mineflayerInventory.settings.radius.description': {
    en: same('How far, in blocks, the Containers, Workstations and Villager trading tabs search for real nearby matches.'),
    yue: same('「容器」、「工作站」同「村民交易」分頁搜尋附近真實目標嘅範圍，以格為單位。')
  },
  'mineflayerInventory.settings.limit': { en: same('Nearby result limit'), yue: same('附近結果上限') },
  'mineflayerInventory.settings.limit.description': {
    en: same('The most nearby matches those searches will list at once.'),
    yue: same('嗰啲搜尋一次過最多會列出幾多個附近結果。')
  },
  'mineflayerInventory.settings.autoRefresh': { en: same('Auto-refresh open windows'), yue: same('自動刷新開緊嘅視窗') },
  'mineflayerInventory.settings.autoRefresh.description': {
    en: same('While a container or workstation is open, poll the bot for its real current contents every couple of seconds instead of only on your own actions.'),
    yue: same('當容器或者工作站開緊嗰陣，每幾秒問機械人攞返真實內容，唔淨係響應你自己嘅動作先更新。')
  }
};
