/**
 * Copy for this feature, in English and playful Hong Kong Cantonese, at all
 * five humour levels. Humour styles the voice; the facts — which chunk, which
 * coordinate, what will be overwritten or removed — stay exact at every level.
 */
import type { Catalogue } from '../../core/registry';

export const WORLD_VAULT_EDIT_STRINGS: Catalogue = {
  'worldvaultedit.tab': {
    en: ['Chunk operations', 'Chunk operations', 'Chunk operations', 'Chunk surgery', 'Chunk surgery'],
    yue: ['區塊操作', '區塊操作', '搬區塊', '區塊小手術', '區塊小手術']
  },
  'worldvaultedit.tab.subtitle': {
    en: [
      'Copy or remove chunks in the downloaded world, from a real occupancy grid.',
      'Copy or remove chunks in the downloaded world, from a real occupancy grid.',
      'Copy or clear chunks in the world you downloaded, straight off the real grid.',
      'Grab a chunk, park it somewhere else, or bin it — off the real grid, no guessing.',
      'Grab a chunk, park it somewhere else, or bin it — off the real grid, no guessing.'
    ],
    yue: [
      '喺真實嘅佔用格仔度，複製或者移除已下載世界入面嘅區塊。',
      '喺真實嘅佔用格仔度，複製或者移除已下載世界入面嘅區塊。',
      '對住真實格仔，將已下載嘅世界搬區塊或者清走區塊。',
      '揀個區塊搬去第度，或者直接丟咗佢 —— 對住真實格仔，唔使估。',
      '揀個區塊搬去第度，或者直接丟咗佢 —— 對住真實格仔，唔使估。'
    ]
  },
  'worldvaultedit.action.refresh': {
    en: ['Refresh', 'Refresh', 'Refresh the grid', 'Refresh — see what changed', 'Refresh — see what changed'],
    yue: ['重新整理', '重新整理', '重新整理個格仔', '重新整理，睇下有咩變咗', '重新整理，睇下有咩變咗']
  },
  'worldvaultedit.config.title': {
    en: ['World and dimension', 'World and dimension', 'World and dimension', 'Where in the world', 'Where in the world'],
    yue: ['世界同維度', '世界同維度', '世界同維度', '你喺邊個世界', '你喺邊個世界']
  },
  'worldvaultedit.config.description': {
    en: [
      'Choose the downloaded world folder and which dimension to browse.',
      'Choose the downloaded world folder and which dimension to browse.',
      'Pick the downloaded world folder and the dimension you want to browse.',
      'Point this at the downloaded world, then pick which dimension to poke around in.',
      'Point this at the downloaded world, then pick which dimension to poke around in.'
    ],
    yue: [
      '揀已下載嘅世界資料夾，同要瀏覽嘅維度。',
      '揀已下載嘅世界資料夾，同要瀏覽嘅維度。',
      '揀返個已下載世界資料夾，同想睇邊個維度。',
      '指返去個已下載世界，再揀想搞邊個維度。',
      '指返去個已下載世界，再揀想搞邊個維度。'
    ]
  },
  'worldvaultedit.worldDirectory': {
    en: ['World folder', 'World folder', 'World folder', 'World folder', 'World folder'],
    yue: ['世界資料夾', '世界資料夾', '世界資料夾', '世界資料夾', '世界資料夾']
  },
  'worldvaultedit.worldDirectory.hint': {
    en: [
      'The same folder the downloader writes into. Defaults to whichever world the vault tab has open.',
      'The same folder the downloader writes into. Defaults to whichever world the vault tab has open.',
      'The folder the downloader writes into — defaults to whatever world the vault tab already has open.',
      'Same folder the downloader is filling up. Leave it and it follows whatever the vault tab has open.',
      'Same folder the downloader is filling up. Leave it and it follows whatever the vault tab has open.'
    ],
    yue: [
      '同下載器寫入嗰個資料夾一樣。預設跟返 vault 分頁而家開緊嘅世界。',
      '同下載器寫入嗰個資料夾一樣。預設跟返 vault 分頁而家開緊嘅世界。',
      '就係下載器寫嘢嗰個資料夾，預設跟住 vault 分頁開緊嘅世界。',
      '同下載器灌緊嘅資料夾一樣。唔理佢就跟住 vault 分頁開緊嗰個。',
      '同下載器灌緊嘅資料夾一樣。唔理佢就跟住 vault 分頁開緊嗰個。'
    ]
  },
  'worldvaultedit.dimension': {
    en: ['Dimension', 'Dimension', 'Dimension', 'Dimension', 'Dimension'],
    yue: ['維度', '維度', '維度', '維度', '維度']
  },
  'worldvaultedit.dimension.overworld': {
    en: ['Overworld', 'Overworld', 'Overworld', 'The Overworld', 'The Overworld'],
    yue: ['主世界', '主世界', '主世界', '主世界', '主世界']
  },
  'worldvaultedit.dimension.nether': {
    en: ['Nether', 'Nether', 'Nether', 'The Nether', 'The Nether'],
    yue: ['地獄', '地獄', '地獄', '地獄', '地獄']
  },
  'worldvaultedit.dimension.end': {
    en: ['End', 'End', 'End', 'The End', 'The End'],
    yue: ['終界', '終界', '終界', '終界', '終界']
  },
  'worldvaultedit.dimension.custom': {
    en: ['Custom path…', 'Custom path…', 'Custom path…', 'Somewhere else entirely…', 'Somewhere else entirely…'],
    yue: ['自訂路徑…', '自訂路徑…', '自訂路徑…', '第度囉…', '第度囉…']
  },
  'worldvaultedit.customDimensionPath': {
    en: ['Custom dimension folder', 'Custom dimension folder', 'Custom dimension folder', 'Custom dimension folder', 'Custom dimension folder'],
    yue: ['自訂維度資料夾', '自訂維度資料夾', '自訂維度資料夾', '自訂維度資料夾', '自訂維度資料夾']
  },
  'worldvaultedit.customDimensionPath.hint': {
    en: [
      'Path under the world folder, for a modded or plugin dimension, e.g. dimensions/mymod/myplace.',
      'Path under the world folder, for a modded or plugin dimension, e.g. dimensions/mymod/myplace.',
      'Path under the world folder for a modded dimension, like dimensions/mymod/myplace.',
      'For a modded dimension: the folder under the world root, e.g. dimensions/mymod/myplace.',
      'For a modded dimension: the folder under the world root, e.g. dimensions/mymod/myplace.'
    ],
    yue: [
      '世界資料夾下面嘅路徑，用喺 mod 或者外掛維度，例如 dimensions/mymod/myplace。',
      '世界資料夾下面嘅路徑，用喺 mod 或者外掛維度，例如 dimensions/mymod/myplace。',
      '世界資料夾底下嘅路徑，畀 mod 維度用，例如 dimensions/mymod/myplace。',
      'mod 維度嘅話：世界根目錄下面嗰個資料夾，例如 dimensions/mymod/myplace。',
      'mod 維度嘅話：世界根目錄下面嗰個資料夾，例如 dimensions/mymod/myplace。'
    ]
  },
  'worldvaultedit.status.noWorld': {
    en: [
      'Choose a world folder to begin.',
      'Choose a world folder to begin.',
      'Choose a world folder to begin.',
      'Pick a world folder and we can get started.',
      'Pick a world folder and we can get started.'
    ],
    yue: ['揀個世界資料夾先至可以開始。', '揀個世界資料夾先至可以開始。', '揀個世界資料夾先至可以開始。', '揀個世界資料夾，就可以郁手。', '揀個世界資料夾，就可以郁手。']
  },
  'worldvaultedit.status.unknown': {
    en: [
      'The vault status for this world could not be read yet.',
      'The vault status for this world could not be read yet.',
      'The vault status for this world could not be read yet.',
      "Can't tell what this world's vault is up to yet.",
      "Can't tell what this world's vault is up to yet."
    ],
    yue: ['未讀到呢個世界嘅 vault 狀態。', '未讀到呢個世界嘅 vault 狀態。', '未讀到呢個世界嘅 vault 狀態。', '暫時唔知呢個世界嘅 vault 做緊咩。', '暫時唔知呢個世界嘅 vault 做緊咩。']
  },
  'worldvaultedit.status.noVault': {
    en: [
      'This world has no vault yet. Create one in the World vault tab before editing here — every edit is recorded as a commit, and there is nothing to commit into without one.',
      'This world has no vault yet. Create one in the World vault tab before editing here — every edit is recorded as a commit, and there is nothing to commit into without one.',
      'No vault for this world yet. Create one in the World vault tab first — every edit here needs somewhere to commit into.',
      'No vault yet, so nowhere for an edit to land. Set one up in the World vault tab first.',
      'No vault yet, so nowhere for an edit to land. Set one up in the World vault tab first.'
    ],
    yue: [
      '呢個世界仲未有 vault。喺編輯之前，去 World vault 分頁整一個先 —— 每次編輯都會記錄做一個 commit，冇 vault 就冇地方 commit。',
      '呢個世界仲未有 vault。喺編輯之前，去 World vault 分頁整一個先 —— 每次編輯都會記錄做一個 commit，冇 vault 就冇地方 commit。',
      '呢個世界未有 vault，去 World vault 分頁整返個先 —— 呢度嘅編輯要有地方 commit。',
      '未有 vault，編輯完都冇地方擺。去 World vault 分頁整定佢先啦。',
      '未有 vault，編輯完都冇地方擺。去 World vault 分頁整定佢先啦。'
    ]
  },
  'worldvaultedit.status.ready': {
    en: ['Vault ready: {count} commits. Last: {last}', 'Vault ready: {count} commits. Last: {last}', 'Vault ready: {count} commits so far. Last one: {last}', 'Vault’s good to go: {count} commits in. Last: {last}', 'Vault’s good to go: {count} commits in. Last: {last}'],
    yue: ['Vault 就緒：{count} 個 commit。最新：{last}', 'Vault 就緒：{count} 個 commit。最新：{last}', 'Vault 就緒，已有 {count} 個 commit。最新嗰個：{last}', 'Vault 準備好喇，{count} 個 commit 落咗袋。最新：{last}', 'Vault 準備好喇，{count} 個 commit 落咗袋。最新：{last}']
  },
  'worldvaultedit.status.noCommits': {
    en: ['none yet', 'none yet', 'none yet', 'nothing yet', 'nothing yet'],
    yue: ['仲未有', '仲未有', '仲未有', '一個都未有', '一個都未有']
  },
  'worldvaultedit.grid.title': {
    en: ['Chunk grid', 'Chunk grid', 'Chunk grid', 'The grid', 'The grid'],
    yue: ['區塊格仔', '區塊格仔', '區塊格仔', '格仔', '格仔']
  },
  'worldvaultedit.grid.description': {
    en: [
      'Every cell is a real chunk, read from the region files on disk right now.',
      'Every cell is a real chunk, read from the region files on disk right now.',
      'Every cell here is a real chunk, read straight from the region files on disk.',
      'Every square is a real chunk — read live off the actual region files, not guessed.',
      'Every square is a real chunk — read live off the actual region files, not guessed.'
    ],
    yue: [
      '每一格都係真實區塊，即刻由硬碟上嘅 region 檔讀返嚟。',
      '每一格都係真實區塊，即刻由硬碟上嘅 region 檔讀返嚟。',
      '每一格都係真區塊，直接由硬碟嘅 region 檔讀出嚟。',
      '每格都係真嘢，即刻由硬碟嘅 region 檔攞返嚟，唔係估嘅。',
      '每格都係真嘢，即刻由硬碟嘅 region 檔攞返嚟，唔係估嘅。'
    ]
  },
  'worldvaultedit.action.pageUp': { en: ['Page up', 'Page up', 'Page up', 'Up a page', 'Up a page'], yue: ['向上一頁', '向上一頁', '向上一頁', '上一頁', '上一頁'] },
  'worldvaultedit.action.pageDown': { en: ['Page down', 'Page down', 'Page down', 'Down a page', 'Down a page'], yue: ['向下一頁', '向下一頁', '向下一頁', '落一頁', '落一頁'] },
  'worldvaultedit.action.pageLeft': { en: ['Page left', 'Page left', 'Page left', 'Left a page', 'Left a page'], yue: ['向左一頁', '向左一頁', '向左一頁', '左一頁', '左一頁'] },
  'worldvaultedit.action.pageRight': { en: ['Page right', 'Page right', 'Page right', 'Right a page', 'Right a page'], yue: ['向右一頁', '向右一頁', '向右一頁', '右一頁', '右一頁'] },
  'worldvaultedit.action.home': { en: ['Go to origin', 'Go to origin', 'Go to origin', 'Back to (0, 0)', 'Back to (0, 0)'], yue: ['去原點', '去原點', '去原點', '返去 (0, 0)', '返去 (0, 0)'] },
  'worldvaultedit.goto.x': { en: ['Chunk X', 'Chunk X', 'Chunk X', 'Chunk X', 'Chunk X'], yue: ['區塊 X', '區塊 X', '區塊 X', '區塊 X', '區塊 X'] },
  'worldvaultedit.goto.z': { en: ['Chunk Z', 'Chunk Z', 'Chunk Z', 'Chunk Z', 'Chunk Z'], yue: ['區塊 Z', '區塊 Z', '區塊 Z', '區塊 Z', '區塊 Z'] },
  'worldvaultedit.action.goto': { en: ['Go', 'Go', 'Go', 'Jump there', 'Jump there'], yue: ['前往', '前往', '前往', '跳過去', '跳過去'] },
  'worldvaultedit.grid.label': { en: ['Chunk selection grid', 'Chunk selection grid', 'Chunk selection grid', 'Chunk selection grid', 'Chunk selection grid'], yue: ['區塊選擇格仔', '區塊選擇格仔', '區塊選擇格仔', '區塊選擇格仔', '區塊選擇格仔'] },
  'worldvaultedit.grid.help': {
    en: [
      'Arrow keys move, Enter or Space toggles the focused chunk, Shift with either extends a rectangle. Click selects one chunk; Shift-click extends a rectangle; Ctrl or Cmd-click adds or removes one chunk without clearing the rest.',
      'Arrow keys move, Enter or Space toggles the focused chunk, Shift with either extends a rectangle. Click selects one chunk; Shift-click extends a rectangle; Ctrl or Cmd-click adds or removes one chunk without clearing the rest.',
      'Arrow keys move around, Enter or Space toggles the focused chunk, and Shift extends a rectangle. Click picks one chunk, Shift-click stretches a rectangle, Ctrl/Cmd-click adds or drops one chunk.',
      'Arrows to move, Space or Enter to toggle, Shift to stretch a rectangle. Click, Shift-click, Ctrl-click — same idea, mouse edition.',
      'Arrows to move, Space or Enter to toggle, Shift to stretch a rectangle. Click, Shift-click, Ctrl-click — same idea, mouse edition.'
    ],
    yue: [
      '方向鍵郁位，Enter 或者空白鍵揀返個焦點區塊，加 Shift 就伸展做長方形。滑鼠：撳一下揀一格，Shift+撳伸展長方形，Ctrl/Cmd+撳加減一格但唔會清晒其他。',
      '方向鍵郁位，Enter 或者空白鍵揀返個焦點區塊，加 Shift 就伸展做長方形。滑鼠：撳一下揀一格，Shift+撳伸展長方形，Ctrl/Cmd+撳加減一格但唔會清晒其他。',
      '方向鍵行位，Enter/空白揀焦點嗰格，加 Shift 就拉長方形。滑鼠一撳揀一格，Shift+撳拉長方形，Ctrl/Cmd+撳加減一格。',
      '方向鍵行，空白/Enter 揀，Shift 拉長方形。滑鼠一樣招式，撳、Shift撳、Ctrl撳。',
      '方向鍵行，空白/Enter 揀，Shift 拉長方形。滑鼠一樣招式，撳、Shift撳、Ctrl撳。'
    ]
  },
  'worldvaultedit.grid.empty.noWorld': {
    en: ['No world folder is chosen yet.', 'No world folder is chosen yet.', 'No world folder is chosen yet.', 'Nothing to show without a world folder.', 'Nothing to show without a world folder.'],
    yue: ['仲未揀世界資料夾。', '仲未揀世界資料夾。', '仲未揀世界資料夾。', '未揀世界資料夾，乜都冇得睇。', '未揀世界資料夾，乜都冇得睇。']
  },
  'worldvaultedit.grid.status': {
    en: [
      'Showing chunks {x1}–{x2}, {z1}–{z2}. {occupied} of {total} have data.',
      'Showing chunks {x1}–{x2}, {z1}–{z2}. {occupied} of {total} have data.',
      'Showing chunks {x1}–{x2}, {z1}–{z2}: {occupied} of {total} have data.',
      'Chunks {x1}–{x2}, {z1}–{z2} on screen — {occupied} of {total} actually exist.',
      'Chunks {x1}–{x2}, {z1}–{z2} on screen — {occupied} of {total} actually exist.'
    ],
    yue: [
      '而家顯示緊區塊 {x1}–{x2}, {z1}–{z2}。{total} 格入面有 {occupied} 格有資料。',
      '而家顯示緊區塊 {x1}–{x2}, {z1}–{z2}。{total} 格入面有 {occupied} 格有資料。',
      '顯示緊區塊 {x1}–{x2}, {z1}–{z2}：{total} 格有 {occupied} 格有資料。',
      '而家睇緊 {x1}–{x2}, {z1}–{z2} —— {total} 格入面真係得 {occupied} 格有嘢。',
      '而家睇緊 {x1}–{x2}, {z1}–{z2} —— {total} 格入面真係得 {occupied} 格有嘢。'
    ]
  },
  'worldvaultedit.cell.hasData': { en: ['has data', 'has data', 'has data', 'is real', 'is real'], yue: ['有資料', '有資料', '有資料', '有嘢', '有嘢'] },
  'worldvaultedit.cell.empty': { en: ['empty', 'empty', 'empty', 'nothing here', 'nothing here'], yue: ['空置', '空置', '空置', '乜都冇', '乜都冇'] },
  'worldvaultedit.cell.selected': { en: ['selected', 'selected', 'selected', 'picked', 'picked'], yue: ['已選取', '已選取', '已選取', '揀咗', '揀咗'] },
  'worldvaultedit.selection.title': { en: ['Selection', 'Selection', 'Selection', 'What you picked', 'What you picked'], yue: ['已選取', '已選取', '已選取', '揀咗啲乜', '揀咗啲乜'] },
  'worldvaultedit.selection.none': { en: ['No chunks selected.', 'No chunks selected.', 'No chunks selected.', 'Nothing picked yet.', 'Nothing picked yet.'], yue: ['未揀任何區塊。', '未揀任何區塊。', '未揀任何區塊。', '未揀嘢。', '未揀嘢。'] },
  'worldvaultedit.selection.one': { en: ['Chunk {chunk} selected.', 'Chunk {chunk} selected.', 'Chunk {chunk} selected.', 'Chunk {chunk} — that one.', 'Chunk {chunk} — that one.'], yue: ['已選取區塊 {chunk}。', '已選取區塊 {chunk}。', '已選取區塊 {chunk}。', '揀咗區塊 {chunk} — 就係佢。', '揀咗區塊 {chunk} — 就係佢。'] },
  'worldvaultedit.selection.many': {
    en: [
      '{count} chunks selected, from {min} to {max}.',
      '{count} chunks selected, from {min} to {max}.',
      '{count} chunks selected, from {min} to {max}.',
      '{count} chunks in the net, {min} through {max}.',
      '{count} chunks in the net, {min} through {max}.'
    ],
    yue: ['已選取 {count} 格區塊，由 {min} 到 {max}。', '已選取 {count} 格區塊，由 {min} 到 {max}。', '已選取 {count} 格區塊，由 {min} 到 {max}。', '網咗 {count} 格，由 {min} 到 {max}。', '網咗 {count} 格，由 {min} 到 {max}。']
  },
  'worldvaultedit.selection.clear': { en: ['Clear selection', 'Clear selection', 'Clear selection', 'Clear the picks', 'Clear the picks'], yue: ['清除選取', '清除選取', '清除選取', '清晒揀嘅', '清晒揀嘅'] },
  'worldvaultedit.destination.x': { en: ['Destination X', 'Destination X', 'Destination X', 'Landing X', 'Landing X'], yue: ['目的地 X', '目的地 X', '目的地 X', '落腳 X', '落腳 X'] },
  'worldvaultedit.destination.z': { en: ['Destination Z', 'Destination Z', 'Destination Z', 'Landing Z', 'Landing Z'], yue: ['目的地 Z', '目的地 Z', '目的地 Z', '落腳 Z', '落腳 Z'] },
  'worldvaultedit.destination.hint': {
    en: [
      'Where the selection’s top-left chunk should land. Every other selected chunk moves by the same offset.',
      'Where the selection’s top-left chunk should land. Every other selected chunk moves by the same offset.',
      'Where the top-left chunk of the selection lands. Everything else moves by the same offset.',
      'Say where the top-left corner lands; the rest of the block follows at the same offset.',
      'Say where the top-left corner lands; the rest of the block follows at the same offset.'
    ],
    yue: [
      '選取範圍左上角嗰個區塊要去邊。其他已選區塊會用同一個位移搬過去。',
      '選取範圍左上角嗰個區塊要去邊。其他已選區塊會用同一個位移搬過去。',
      '選取範圍左上角嗰格要落去邊，其他格都用同一個位移跟住去。',
      '講返個左上角落去邊度，成個範圍其他格都跟住同一個位移走。',
      '講返個左上角落去邊度，成個範圍其他格都跟住同一個位移走。'
    ]
  },
  'worldvaultedit.progress.label': { en: ['Editing chunks…', 'Editing chunks…', 'Editing chunks…', 'Shuffling chunks about…', 'Shuffling chunks about…'], yue: ['編輯緊區塊…', '編輯緊區塊…', '編輯緊區塊…', '搬緊啲區塊…', '搬緊啲區塊…'] },
  'worldvaultedit.action.copy': { en: ['Copy to destination', 'Copy to destination', 'Copy to destination', 'Copy it over', 'Copy it over'], yue: ['複製去目的地', '複製去目的地', '複製去目的地', '複製過去', '複製過去'] },
  'worldvaultedit.action.remove': { en: ['Remove selected chunks', 'Remove selected chunks', 'Remove selected chunks', 'Bin the selection', 'Bin the selection'], yue: ['移除已選區塊', '移除已選區塊', '移除已選區塊', '丟晒佢哋', '丟晒佢哋'] },
  'worldvaultedit.error.destination': {
    en: ['Enter whole-number destination coordinates. Nothing was changed.', 'Enter whole-number destination coordinates. Nothing was changed.', 'Enter whole-number destination coordinates. Nothing was changed.', 'Destination needs whole numbers. Nothing moved.', 'Destination needs whole numbers. Nothing moved.'],
    yue: ['請輸入整數嘅目的地座標。未有任何改動。', '請輸入整數嘅目的地座標。未有任何改動。', '請輸入整數嘅目的地座標。未有任何改動。', '目的地要打整數。乜都未搬過。', '目的地要打整數。乜都未搬過。']
  },
  'worldvaultedit.error.sameDestination': {
    en: ['That is where the selection already is. Choose a different destination.', 'That is where the selection already is. Choose a different destination.', 'That is where the selection already is. Pick a different destination.', 'It is already there. Pick somewhere that is not exactly here.', 'It is already there. Pick somewhere that is not exactly here.'],
    yue: ['選取範圍本身就喺嗰度。請揀第個目的地。', '選取範圍本身就喺嗰度。請揀第個目的地。', '本身就喺嗰度喇，揀第個目的地。', '本身就喺嗰度，揀個唔係「呢度」嘅位。', '本身就喺嗰度，揀個唔係「呢度」嘅位。']
  },
  'worldvaultedit.reason.tooLarge': {
    en: ['The selection has {count} chunks, past the {max}-chunk bound.', 'The selection has {count} chunks, past the {max}-chunk bound.', 'The selection has {count} chunks, past the {max}-chunk limit.', '{count} chunks is past the {max}-chunk cap — trim the selection.', '{count} chunks is past the {max}-chunk cap — trim the selection.'],
    yue: ['選取咗 {count} 格，超過咗 {max} 格嘅上限。', '選取咗 {count} 格，超過咗 {max} 格嘅上限。', '選取咗 {count} 格，超過 {max} 格上限。', '{count} 格超過咗 {max} 格上限，剪細啲揀嘅範圍。', '{count} 格超過咗 {max} 格上限，剪細啲揀嘅範圍。']
  },
  'worldvaultedit.reason.noWorld': { en: ['Choose a world folder first.', 'Choose a world folder first.', 'Choose a world folder first.', 'Pick a world folder first.', 'Pick a world folder first.'], yue: ['請先揀世界資料夾。', '請先揀世界資料夾。', '請先揀世界資料夾。', '要揀個世界資料夾先。', '要揀個世界資料夾先。'] },
  'worldvaultedit.reason.noVault': { en: ['Create the vault for this world first, in the World vault tab.', 'Create the vault for this world first, in the World vault tab.', 'Create the vault for this world first, in the World vault tab.', 'No vault yet — set one up in the World vault tab first.', 'No vault yet — set one up in the World vault tab first.'], yue: ['請先喺 World vault 分頁幫呢個世界整一個 vault。', '請先喺 World vault 分頁幫呢個世界整一個 vault。', '請先喺 World vault 分頁整個 vault。', '未有 vault，去 World vault 分頁整定先。', '未有 vault，去 World vault 分頁整定先。'] },
  'worldvaultedit.reason.noSelection': { en: ['Select at least one chunk first.', 'Select at least one chunk first.', 'Select at least one chunk first.', 'Pick at least one chunk first.', 'Pick at least one chunk first.'], yue: ['請先揀最少一格區塊。', '請先揀最少一格區塊。', '請先揀最少一格區塊。', '起碼揀一格先得。', '起碼揀一格先得。'] },
  'worldvaultedit.reason.running': { en: ['An edit is already in progress.', 'An edit is already in progress.', 'An edit is already in progress.', 'Already busy editing — hang on.', 'Already busy editing — hang on.'], yue: ['已經有一個編輯操作進行緊。', '已經有一個編輯操作進行緊。', '已經有一個編輯操作進行緊。', '手緊緊做緊編輯，等陣。', '手緊緊做緊編輯，等陣。'] },
  'worldvaultedit.confirm.copy.action': { en: ['Copy {count} chunk(s), offset by ({dx}, {dz})', 'Copy {count} chunk(s), offset by ({dx}, {dz})', 'Copy {count} chunk(s), offset by ({dx}, {dz})', 'Copy {count} chunk(s), shifted by ({dx}, {dz})', 'Copy {count} chunk(s), shifted by ({dx}, {dz})'], yue: ['複製 {count} 格區塊，位移 ({dx}, {dz})', '複製 {count} 格區塊，位移 ({dx}, {dz})', '複製 {count} 格區塊，位移 ({dx}, {dz})', '複製 {count} 格，搬 ({dx}, {dz})', '複製 {count} 格，搬 ({dx}, {dz})'] },
  'worldvaultedit.confirm.copy.overwrite': {
    en: [
      'Every destination chunk already containing data will be replaced ({count} of {total}). This is recorded as a commit, so it can be undone from the World vault tab, but nothing here undoes it automatically.',
      'Every destination chunk already containing data will be replaced ({count} of {total}). This is recorded as a commit, so it can be undone from the World vault tab, but nothing here undoes it automatically.',
      'Every destination chunk that already has data gets replaced ({count} of {total}). It is recorded as a commit, so the World vault tab can undo it — nothing here does that automatically.',
      '{count} of {total} destinations already have something there, and it gets overwritten. It is a real commit, so the World vault tab can roll it back — this button will not.',
      '{count} of {total} destinations already have something there, and it gets overwritten. It is a real commit, so the World vault tab can roll it back — this button will not.'
    ],
    yue: [
      '每一個已經有資料嘅目的地區塊都會被覆蓋（{total} 格入面有 {count} 格）。呢個動作會記錄做一個 commit，可以喺 World vault 分頁復原，但呢度唔會自動幫你復原。',
      '每一個已經有資料嘅目的地區塊都會被覆蓋（{total} 格入面有 {count} 格）。呢個動作會記錄做一個 commit，可以喺 World vault 分頁復原，但呢度唔會自動幫你復原。',
      '{total} 格入面有 {count} 格目的地已經有資料，會被覆蓋。呢個係真 commit，可以喺 World vault 分頁復原，呢度唔會自動幫你做。',
      '{total} 格入面 {count} 格已經有嘢，會被冚過。真係一個 commit，World vault 分頁可以扭返轉頭，呢個掣就唔會。',
      '{total} 格入面 {count} 格已經有嘢，會被冚過。真係一個 commit，World vault 分頁可以扭返轉頭，呢個掣就唔會。'
    ]
  },
  'worldvaultedit.confirm.copy.body': {
    en: [
      'Each source chunk’s own coordinates and every block entity and entity position inside it are rewritten to the new location. This is recorded as a commit, so it can be undone from the World vault tab.',
      'Each source chunk’s own coordinates and every block entity and entity position inside it are rewritten to the new location. This is recorded as a commit, so it can be undone from the World vault tab.',
      'Each source chunk’s own coordinates, and every block entity and entity position inside it, are rewritten to the new location. Recorded as a commit, so the World vault tab can undo it.',
      'Every coordinate the chunk carries — its own, plus every chest, sign and mob inside it — gets rewritten to the new spot. It is a real commit, undoable from the World vault tab.',
      'Every coordinate the chunk carries — its own, plus every chest, sign and mob inside it — gets rewritten to the new spot. It is a real commit, undoable from the World vault tab.'
    ],
    yue: [
      '每個來源區塊本身嘅座標，同埋入面每一個方塊實體同實體嘅位置，都會改寫去新位置。呢個動作會記錄做一個 commit，可以喺 World vault 分頁復原。',
      '每個來源區塊本身嘅座標，同埋入面每一個方塊實體同實體嘅位置，都會改寫去新位置。呢個動作會記錄做一個 commit，可以喺 World vault 分頁復原。',
      '每個來源區塊自己嘅座標，同入面每個方塊實體同實體位置，都會改去新位置。記錄做一個 commit，可以喺 World vault 分頁復原。',
      '個區塊自己嗰個座標，仲有入面成班箱、告示牌、生物嘅位置，全部改寫去新位。真 commit 嚟，可以喺 World vault 分頁復原。',
      '個區塊自己嗰個座標，仲有入面成班箱、告示牌、生物嘅位置，全部改寫去新位。真 commit 嚟，可以喺 World vault 分頁復原。'
    ]
  },
  'worldvaultedit.confirm.andMore': { en: ['…and {count} more', '…and {count} more', '…and {count} more', '…plus {count} more', '…plus {count} more'], yue: ['…仲有 {count} 個', '…仲有 {count} 個', '…仲有 {count} 個', '…重有 {count} 個', '…重有 {count} 個'] },
  'worldvaultedit.error.permissionDenied': { en: ['Access to {region} was refused.', 'Access to {region} was refused.', 'Access to {region} was refused.', 'Nope — {region} said no.', 'Nope — {region} said no.'], yue: ['存取 {region} 被拒絕。', '存取 {region} 被拒絕。', '存取 {region} 被拒絕。', '唔得，{region} 話唔准。', '唔得，{region} 話唔准。'] },
  'worldvaultedit.confirm.remove.action': { en: ['Remove {count} chunk(s)', 'Remove {count} chunk(s)', 'Remove {count} chunk(s)', 'Bin {count} chunk(s)', 'Bin {count} chunk(s)'], yue: ['移除 {count} 格區塊', '移除 {count} 格區塊', '移除 {count} 格區塊', '丟走 {count} 格', '丟走 {count} 格'] },
  'worldvaultedit.confirm.remove.body': {
    en: [
      'Every listed chunk’s entry is cleared, so the game treats it as absent and regenerates it the next time it is loaded. Anything built there is gone from the saved world. This is recorded as a commit, so it can be undone from the World vault tab.',
      'Every listed chunk’s entry is cleared, so the game treats it as absent and regenerates it the next time it is loaded. Anything built there is gone from the saved world. This is recorded as a commit, so it can be undone from the World vault tab.',
      'Every listed chunk gets cleared, so the game treats it as never generated and rebuilds it next time it loads. Anything built there is gone from the save. Recorded as a commit, undoable from the World vault tab.',
      'Every listed chunk vanishes from the save — the game will just regenerate it fresh next time. Whatever was built there goes with it. Real commit, undoable from the World vault tab.',
      'Every listed chunk vanishes from the save — the game will just regenerate it fresh next time. Whatever was built there goes with it. Real commit, undoable from the World vault tab.'
    ],
    yue: [
      '列出嘅每一格區塊都會被清空，遊戲會當佢未生成過，下次載入嗰陣重新生成。喺嗰度起過嘅嘢就冇咗。呢個動作會記錄做一個 commit，可以喺 World vault 分頁復原。',
      '列出嘅每一格區塊都會被清空，遊戲會當佢未生成過，下次載入嗰陣重新生成。喺嗰度起過嘅嘢就冇咗。呢個動作會記錄做一個 commit，可以喺 World vault 分頁復原。',
      '列出嘅區塊全部清空，遊戲會當佢未生成過，下次載入重新生成。喺嗰度起過嘅嘢冇咗。記錄做一個 commit，可以喺 World vault 分頁復原。',
      '列出嘅區塊全部消失，遊戲下次會當新嘅重新生成。起過嘅嘢一齊冚。真 commit，可以喺 World vault 分頁扭返轉頭。',
      '列出嘅區塊全部消失，遊戲下次會當新嘅重新生成。起過嘅嘢一齊冚。真 commit，可以喺 World vault 分頁扭返轉頭。'
    ]
  },
  'worldvaultedit.region': { en: ['region', 'region', 'region', 'region', 'region'], yue: ['region', 'region', 'region', 'region', 'region'] },
  'worldvaultedit.log.title': { en: ['Edit log', 'Edit log', 'Edit log', 'What just happened', 'What just happened'], yue: ['編輯記錄', '編輯記錄', '編輯記錄', '啱啱做咗咩', '啱啱做咗咩'] },
  'worldvaultedit.log.description': {
    en: ['Every copy and removal made from this tab, with the exact vault commit it produced.', 'Every copy and removal made from this tab, with the exact vault commit it produced.', 'Every copy and removal made here, with the exact vault commit it produced.', 'A running list of what this tab actually did, and which commit each one landed as.', 'A running list of what this tab actually did, and which commit each one landed as.'],
    yue: ['喺呢個分頁做過嘅每一次複製同移除，連埋佢產生嘅確實 vault commit。', '喺呢個分頁做過嘅每一次複製同移除，連埋佢產生嘅確實 vault commit。', '呢度做過嘅每次複製同移除，連埋確實 vault commit。', '一張清單，記低呢個分頁真正做過啲乜，同每次落咗邊個 commit。', '一張清單，記低呢個分頁真正做過啲乜，同每次落咗邊個 commit。']
  },
  'worldvaultedit.log.search': { en: ['Search the edit log', 'Search the edit log', 'Search the edit log', 'Search the edit log', 'Search the edit log'], yue: ['搜尋編輯記錄', '搜尋編輯記錄', '搜尋編輯記錄', '搜尋編輯記錄', '搜尋編輯記錄'] },
  'worldvaultedit.log.selectShown': { en: ['Select the {count} shown', 'Select the {count} shown', 'Select the {count} shown', 'Grab all {count} shown', 'Grab all {count} shown'], yue: ['選取顯示緊嘅 {count} 個', '選取顯示緊嘅 {count} 個', '選取顯示緊嘅 {count} 個', '成 {count} 個顯示緊嘅一齊揀', '成 {count} 個顯示緊嘅一齊揀'] },
  'worldvaultedit.log.selectAll': { en: ['Select every entry ({count})', 'Select every entry ({count})', 'Select every entry ({count})', 'Grab the lot ({count})', 'Grab the lot ({count})'], yue: ['選取全部 {count} 項', '選取全部 {count} 項', '選取全部 {count} 項', '成 {count} 樣嘢一齊揀', '成 {count} 樣嘢一齊揀'] },
  'worldvaultedit.log.invert': { en: ['Invert selection', 'Invert selection', 'Invert selection', 'Flip the picks', 'Flip the picks'], yue: ['反轉選取', '反轉選取', '反轉選取', '反轉揀法', '反轉揀法'] },
  'worldvaultedit.log.clearSelection': { en: ['Clear selection', 'Clear selection', 'Clear selection', 'Clear the picks', 'Clear the picks'], yue: ['清除選取', '清除選取', '清除選取', '清晒揀嘅', '清晒揀嘅'] },
  'worldvaultedit.log.format': { en: ['Format', 'Format', 'Format', 'Format', 'Format'], yue: ['格式', '格式', '格式', '格式', '格式'] },
  'worldvaultedit.log.export': { en: ['Export', 'Export', 'Export', 'Export it', 'Export it'], yue: ['匯出', '匯出', '匯出', '匯出佢', '匯出佢'] },
  'worldvaultedit.log.deleteEntries': { en: ['Delete entries', 'Delete entries', 'Delete entries', 'Bin entries', 'Bin entries'], yue: ['刪除項目', '刪除項目', '刪除項目', '丟走啲項目', '丟走啲項目'] },
  'worldvaultedit.log.count': { en: ['{shown} of {total} entries shown', '{shown} of {total} entries shown', '{shown} of {total} entries shown', '{shown} of {total} showing', '{shown} of {total} showing'], yue: ['顯示咗 {total} 項入面嘅 {shown} 項', '顯示咗 {total} 項入面嘅 {shown} 項', '顯示咗 {total} 項入面嘅 {shown} 項', '{total} 項入面顯示緊 {shown} 項', '{total} 項入面顯示緊 {shown} 項'] },
  'worldvaultedit.log.selected': { en: ['{count} selected', '{count} selected', '{count} selected', '{count} picked', '{count} picked'], yue: ['已選取 {count} 項', '已選取 {count} 項', '已選取 {count} 項', '揀咗 {count} 項', '揀咗 {count} 項'] },
  'worldvaultedit.log.nothingSelected': { en: ['Select at least one entry first', 'Select at least one entry first', 'Select at least one entry first', 'Pick at least one entry first', 'Pick at least one entry first'], yue: ['請先揀最少一項', '請先揀最少一項', '請先揀最少一項', '揀返一項先', '揀返一項先'] },
  'worldvaultedit.log.none.title': { en: ['No edits recorded yet', 'No edits recorded yet', 'No edits recorded yet', 'Nothing here yet', 'Nothing here yet'], yue: ['仲未有編輯記錄', '仲未有編輯記錄', '仲未有編輯記錄', '呢度仲係得個吉', '呢度仲係得個吉'] },
  'worldvaultedit.log.none.body': {
    en: ['Copy or remove a chunk above and it appears here, with a link to the exact vault commit it produced.', 'Copy or remove a chunk above and it appears here, with a link to the exact vault commit it produced.', 'Copy or remove a chunk above and it turns up here, with the exact vault commit it produced.', 'Do a copy or a removal up there and it shows up here, commit hash and all.', 'Do a copy or a removal up there and it shows up here, commit hash and all.'],
    yue: ['喺上面複製或者移除一格區塊，就會出現喺呢度，連埋佢產生嗰個確實 vault commit。', '喺上面複製或者移除一格區塊，就會出現喺呢度，連埋佢產生嗰個確實 vault commit。', '上面複製或者移除一格，就會喺呢度出現，連確實 vault commit。', '上面複製或者移除一下，呢度就見到，連 commit hash 都有。', '上面複製或者移除一下，呢度就見到，連 commit hash 都有。']
  },
  'worldvaultedit.log.empty.title': { en: ['Nothing matched', 'Nothing matched', 'Nothing matched', 'No hits', 'No hits'], yue: ['冇匹配嘅結果', '冇匹配嘅結果', '冇匹配嘅結果', '一個都冇撞到', '一個都冇撞到'] },
  'worldvaultedit.log.empty.body': { en: ['No log entry matched the current search. Clearing the field brings all of them back.', 'No log entry matched the current search. Clearing the field brings all of them back.', 'No log entry matched the current search. Clear the field to bring them all back.', 'Search came up empty. Clear it and everything is back.', 'Search came up empty. Clear it and everything is back.'], yue: ['冇任何記錄符合而家嘅搜尋。清空欄位就會全部顯示返。', '冇任何記錄符合而家嘅搜尋。清空欄位就會全部顯示返。', '冇記錄符合而家嘅搜尋。清空欄位全部返晒嚟。', '搵唔到嘢。清空佢，全部返晒嚟。', '搵唔到嘢。清空佢，全部返晒嚟。'] },
  'worldvaultedit.log.badge.copy': { en: ['copy', 'copy', 'copy', 'copy', 'copy'], yue: ['複製', '複製', '複製', '複製', '複製'] },
  'worldvaultedit.log.badge.remove': { en: ['remove', 'remove', 'remove', 'remove', 'remove'], yue: ['移除', '移除', '移除', '移除', '移除'] },
  'worldvaultedit.log.copied': { en: ['copied', 'copied', 'copied', 'copied', 'copied'], yue: ['已複製', '已複製', '已複製', '已複製', '已複製'] },
  'worldvaultedit.log.removed': { en: ['removed', 'removed', 'removed', 'removed', 'removed'], yue: ['已移除', '已移除', '已移除', '已移除', '已移除'] },
  'worldvaultedit.log.detail.ok': { en: ['{succeeded} of {total} chunks {verb}.', '{succeeded} of {total} chunks {verb}.', '{succeeded} of {total} chunks {verb}.', '{succeeded} of {total} chunks {verb} — clean.', '{succeeded} of {total} chunks {verb} — clean.'], yue: ['{total} 格入面 {succeeded} 格已{verb}。', '{total} 格入面 {succeeded} 格已{verb}。', '{total} 格入面 {succeeded} 格已{verb}。', '{total} 格入面 {succeeded} 格已{verb} —— 乾淨俐落。', '{total} 格入面 {succeeded} 格已{verb} —— 乾淨俐落。'] },
  'worldvaultedit.log.detail.partial': { en: ['{succeeded} of {total} succeeded; {failed} failed: {reasons}', '{succeeded} of {total} succeeded; {failed} failed: {reasons}', '{succeeded} of {total} succeeded; {failed} failed: {reasons}', '{succeeded} of {total} went fine; {failed} did not: {reasons}', '{succeeded} of {total} went fine; {failed} did not: {reasons}'], yue: ['{total} 格入面 {succeeded} 格成功；{failed} 格失敗：{reasons}', '{total} 格入面 {succeeded} 格成功；{failed} 格失敗：{reasons}', '{total} 格入面 {succeeded} 格成功；{failed} 格失敗：{reasons}', '{total} 格入面 {succeeded} 格搞掂；{failed} 格未得：{reasons}', '{total} 格入面 {succeeded} 格搞掂；{failed} 格未得：{reasons}'] },
  'worldvaultedit.export.losses': { en: ['This format cannot carry: {fields}', 'This format cannot carry: {fields}', 'This format cannot carry: {fields}', 'This format drops: {fields}', 'This format drops: {fields}'], yue: ['呢個格式帶唔到：{fields}', '呢個格式帶唔到：{fields}', '呢個格式帶唔到：{fields}', '呢個格式會漏走：{fields}', '呢個格式會漏走：{fields}'] },
  'worldvaultedit.export.saved': { en: ['Saved to {path}', 'Saved to {path}', 'Saved to {path}', 'Saved to {path}', 'Saved to {path}'], yue: ['已儲存至 {path}', '已儲存至 {path}', '已儲存至 {path}', '已儲存至 {path}', '已儲存至 {path}'] },
  'worldvaultedit.confirm.deleteLog.action': { en: ['Remove {count} entries from this log', 'Remove {count} entries from this log', 'Remove {count} entries from this log', 'Bin {count} log entries', 'Bin {count} log entries'], yue: ['喺記錄度移除 {count} 項', '喺記錄度移除 {count} 項', '喺記錄度移除 {count} 項', '丟走 {count} 項記錄', '丟走 {count} 項記錄'] },
  'worldvaultedit.confirm.deleteLog.body': {
    en: [
      'This only clears the entries from this panel’s own log. It does not touch the world, and it does not undo the vault commits those edits already made.',
      'This only clears the entries from this panel’s own log. It does not touch the world, and it does not undo the vault commits those edits already made.',
      'This only clears entries from this panel’s log. It does not touch the world or undo the vault commits those edits already made.',
      'Just tidies this panel’s own list. The world and the vault commits it already made are untouched.',
      'Just tidies this panel’s own list. The world and the vault commits it already made are untouched.'
    ],
    yue: [
      '呢個動作淨係清走呢個面板自己嘅記錄，唔會影響世界，亦都唔會復原嗰啲編輯已經做落嘅 vault commit。',
      '呢個動作淨係清走呢個面板自己嘅記錄，唔會影響世界，亦都唔會復原嗰啲編輯已經做落嘅 vault commit。',
      '淨係清走呢個面板自己嘅記錄，唔會郁到世界，亦都唔會復原已經做落嘅 vault commit。',
      '淨係執吓呢個面板自己張清單。世界同已經落咗嘅 vault commit 郁都冇郁過。',
      '淨係執吓呢個面板自己張清單。世界同已經落咗嘅 vault commit 郁都冇郁過。'
    ]
  },
  'worldvaultedit.log.deleted': { en: ['{count} entries removed', '{count} entries removed', '{count} entries removed', '{count} entries binned', '{count} entries binned'], yue: ['已移除 {count} 項', '已移除 {count} 項', '已移除 {count} 項', '丟咗 {count} 項', '丟咗 {count} 項'] }
};
