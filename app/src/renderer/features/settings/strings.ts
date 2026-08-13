import type { Catalogue, FunnyLadder, TranslationEntry } from '../../core/registry';

/**
 * Copy for the settings surface, in English and in playful Hong Kong Cantonese.
 *
 * Every string here has five rungs per language, and the two languages are
 * independent — English at level 1 beside Cantonese at level 5 is a real
 * combination somebody will choose, and both halves of a bilingual line have to
 * read correctly in it.
 *
 * The humour styles the VOICE and never the FACTS. A count is still the exact
 * count at level 5, a validation message still names the exact accepted range,
 * and the reset warning still says exactly which keys go and exactly where the
 * previous values can be read back from.
 */

function ladder(...steps: string[]): FunnyLadder {
  if (steps.length === 1) return [steps[0], steps[0], steps[0], steps[0], steps[0]];
  if (steps.length === 2) return [steps[0], steps[0], steps[0], steps[1], steps[1]];
  if (steps.length === 3) return [steps[0], steps[0], steps[1], steps[2], steps[2]];
  if (steps.length === 4) return [steps[0], steps[1], steps[2], steps[3], steps[3]];
  if (steps.length === 5) return [steps[0], steps[1], steps[2], steps[3], steps[4]];
  throw new Error(`A ladder takes 1 to 5 strings; ${steps.length} were given.`);
}

function entry(en: FunnyLadder, yue: FunnyLadder): TranslationEntry {
  return { en, yue };
}

export const SETTINGS_STRINGS: Catalogue = {
  /* ---------------- the destination itself ---------------- */

  // This is the full settings manager, distinct from the plain "Quick settings"
  // jump target `core/coreFeature.ts` registers as `core.settings` — that one
  // is where every "reveal this setting" link in the application lands; this
  // one is where you come to search by value, select in bulk, and export or
  // import. Two different destinations, so two different titles.
  'settings.tab.title': entry(ladder('Settings'), ladder('設定')),
  'settings.tab.subtitle': entry(
    ladder(
      'Every setting in the application, grouped into tabs, with search by value, bulk actions, and import or export.',
      'Every setting in the application, grouped into tabs, with search by value, bulk actions, and import or export.',
      'Everything you can change, sorted into tabs, plus the search, bulk actions and import/export the quick jump target does not have.',
      'Everything you can change, in tabs, with the value search, bulk actions and import/export that make this the manager rather than just a jump target.',
      'Everything you can change, in tabs, with the value search, bulk actions and import/export that make this the manager rather than just a jump target.'
    ),
    ladder(
      '程式入面所有設定，按分頁分好，仲可以搵值、批量處理、匯入匯出。',
      '程式入面所有設定，按分頁分好，仲可以搵值、批量處理、匯入匯出。',
      '所有可以改嘅嘢，分開分頁擺好，仲有搵值、批量同匯入匯出，快速跳轉嗰版冇呢啲。',
      '所有可以改嘅嘢分晒頁，仲有搵值、批量處理、匯入匯出——呢啲先至叫做「管理」，唔淨係跳轉咁簡單。',
      '所有可以改嘅嘢分晒頁，仲有搵值、批量處理、匯入匯出——呢啲先至叫做「管理」，唔淨係跳轉咁簡單。'
    )
  ),
  'settings.section.title': entry(ladder('The settings surface'), ladder('設定畫面本身')),
  'settings.section.description': entry(
    ladder('How the settings destination itself behaves: where its tab strip sits and how it starts.'),
    ladder('設定畫面自己點運作：佢條分頁列擺喺邊，同開頭係咩樣。')
  ),

  /* ---------------- search ---------------- */

  'settings.section.count': entry(
    ladder('{count} settings live on this tab. Every one of them shows where its current value came from.'),
    ladder('呢一版有 {count} 個設定，每個都會講明而家嗰個值由邊度嚟。')
  ),

  'settings.search.label': entry(ladder('Search settings'), ladder('搵設定')),
  'settings.search.placeholder': entry(
    ladder(
      'Search labels, explanations and current values…',
      'Search labels, explanations and current values…',
      'Type a name, an explanation or the value itself…',
      'Type anything — the name, the explanation, or the value sitting in it right now…',
      'Type anything — the name, the explanation, or the value sitting in it right now…'
    ),
    ladder(
      '搵標籤、解釋同而家嘅值…',
      '搵標籤、解釋同而家嘅值…',
      '打個名、打段解釋、打個值都得…',
      '亂打都得——個名、段解釋、或者而家入面嗰個值，全部搵得到…',
      '亂打都得——個名、段解釋、或者而家入面嗰個值，全部搵得到…'
    )
  ),
  'settings.search.summary': entry(
    ladder('{shown} of {total} settings shown on this tab.'),
    ladder('呢一版顯示緊 {total} 個設定入面嘅 {shown} 個。')
  ),
  'settings.search.elsewhere': entry(
    ladder('{count} more matches sit on other tabs: {tabs}'),
    ladder('仲有 {count} 個結果喺其他分頁：{tabs}')
  ),
  'settings.search.goto': entry(ladder('Go to {tab}'), ladder('去 {tab}')),
  'settings.search.noMatches': entry(
    ladder(
      'No setting on this tab matched.',
      'No setting on this tab matched.',
      'Nothing on this tab matched that.',
      'Nothing on this tab matched. Check the other tabs listed above.',
      'Nothing on this tab matched. Check the other tabs listed above.'
    ),
    ladder(
      '呢一版冇設定符合。',
      '呢一版冇設定符合。',
      '呢一版乜都搵唔到。',
      '呢一版乜都搵唔到，睇下上面列住嗰幾版。',
      '呢一版乜都搵唔到，睇下上面列住嗰幾版。'
    )
  ),

  /* ---------------- the nested tab strip ---------------- */

  'settings.strip.label': entry(ladder('Settings tabs'), ladder('設定分頁')),
  'settings.strip.search': entry(ladder('Search this settings tab strip'), ladder('搵呢條設定分頁列')),
  'settings.strip.searchGroup': entry(ladder('Search this settings group'), ladder('搵呢個設定組')),
  'settings.strip.searchGroups': entry(ladder('Search settings groups'), ladder('搵設定組')),
  'settings.strip.searchAll': entry(ladder('Search every settings tab'), ladder('搵晒所有設定分頁')),
  'settings.strip.overflow': entry(ladder('More settings tabs'), ladder('仲有設定分頁')),
  'settings.strip.tools': entry(ladder('Tab tools and bulk actions'), ladder('分頁工具同批量動作')),
  'settings.strip.dock': entry(ladder('Settings tab strip position'), ladder('設定分頁列位置')),
  'settings.strip.dock.description': entry(
    ladder(
      'Which edge the settings tab strip sits on. Left is the default: a screen is wider than it is tall and a tab label is wider than it is high, so a vertical strip shows more tabs legibly.'
    ),
    ladder('設定分頁列擺喺邊一邊。預設係左邊：個畫面闊過高，分頁標籤又闊過高，直排就睇到多啲。')
  ),
  'settings.strip.dock.left': entry(ladder('Left'), ladder('左邊')),
  'settings.strip.dock.right': entry(ladder('Right'), ladder('右邊')),
  'settings.strip.dock.top': entry(ladder('Top'), ladder('上面')),
  'settings.strip.dock.bottom': entry(ladder('Bottom'), ladder('下面')),
  'settings.strip.pinned': entry(ladder('Pinned settings tabs'), ladder('釘住咗嘅設定分頁')),
  'settings.strip.empty': entry(
    ladder('Every settings tab is closed. Reopen them from the tab tools.'),
    ladder('所有設定分頁都閂咗，喺分頁工具嗰度開返佢哋。')
  ),
  'settings.strip.emptyAction': entry(ladder('Reopen every closed tab'), ladder('開返所有閂咗嘅分頁')),

  'settings.tab.open': entry(ladder('Open this settings tab'), ladder('打開呢個設定分頁')),
  'settings.tab.isClosed': entry(ladder('Closed'), ladder('閂咗')),
  'settings.tab.noGroup': entry(ladder('Not in a group'), ladder('唔喺任何組')),
  'settings.tab.pin': entry(ladder('Pin this settings tab'), ladder('釘住呢個設定分頁')),
  'settings.tab.unpin': entry(ladder('Unpin this settings tab'), ladder('唔釘住呢個設定分頁')),
  'settings.tab.moveEarlier': entry(ladder('Move earlier'), ladder('移前啲')),
  'settings.tab.moveLater': entry(ladder('Move later'), ladder('移後啲')),
  'settings.tab.moveToGroup': entry(ladder('Move into group…'), ladder('搬入組…')),
  'settings.tab.removeFromGroup': entry(ladder('Remove from its group'), ladder('搬出個組')),
  'settings.tab.editAppearance': entry(ladder('Edit tab appearance…'), ladder('改分頁外觀…')),
  'settings.tab.lock': entry(ladder('Lock this settings tab…'), ladder('鎖住呢個設定分頁…')),
  'settings.tab.close': entry(ladder('Close this settings tab'), ladder('閂咗呢個設定分頁')),
  'settings.tab.closed': entry(
    ladder('{count} settings tabs are closed.'),
    ladder('有 {count} 個設定分頁閂咗。')
  ),
  'settings.tab.reopenAll': entry(ladder('Reopen every closed settings tab'), ladder('開返所有閂咗嘅設定分頁')),

  'settings.group.new': entry(ladder('New group…'), ladder('開新組…')),
  'settings.group.rename': entry(ladder('Rename group…'), ladder('改組名…')),
  'settings.group.colour': entry(ladder('Group colour…'), ladder('組嘅顏色…')),
  'settings.group.collapse': entry(ladder('Collapse group'), ladder('摺埋個組')),
  'settings.group.expand': entry(ladder('Expand group'), ladder('打開個組')),
  'settings.group.editAppearance': entry(ladder('Edit group appearance…'), ladder('改組外觀…')),
  'settings.group.members': entry(ladder('{count} tabs in this group'), ladder('呢個組有 {count} 個分頁')),
  'settings.group.namePrompt': entry(ladder('Name for this group'), ladder('呢個組叫咩名')),
  'settings.group.none': entry(
    ladder('No groups yet. Create one and the tab moves straight into it.'),
    ladder('未有任何組。開一個，個分頁就會即刻搬入去。')
  ),

  'settings.bulk.closeContaining': entry(
    ladder('Close settings tabs containing text…'),
    ladder('閂走有呢啲字嘅設定分頁…')
  ),
  'settings.bulk.closeNotContaining': entry(
    ladder('Close settings tabs not containing text…'),
    ladder('閂走冇呢啲字嘅設定分頁…')
  ),
  'settings.bulk.preview': entry(
    ladder('{count} settings tabs will close. {pinned} pinned tabs are excluded.'),
    ladder('會閂 {count} 個設定分頁，{pinned} 個釘住咗嘅唔會郁。')
  ),
  'settings.bulk.emptyQuery': entry(
    ladder('Type something first. Nothing closes on an empty query.'),
    ladder('先打啲字。空白查詢乜都唔會閂。')
  ),
  'settings.bulk.includePinned': entry(ladder('Include pinned tabs'), ladder('連釘住嘅一齊')),
  'settings.bulk.confirmTitle': entry(ladder('Close {count} settings tabs?'), ladder('要閂 {count} 個設定分頁？')),
  'settings.bulk.confirmBody': entry(
    ladder(
      'Nothing is deleted and no value changes. The tabs are hidden from this strip, and "Reopen every closed settings tab" in the tab tools brings all of them back.'
    ),
    ladder('乜都唔會刪，亦都唔會改任何值。啲分頁只係喺呢條列度收埋，喺分頁工具撳「開返所有閂咗嘅設定分頁」就全部返晒嚟。')
  ),

  /* ---------------- rows ---------------- */

  'settings.row.explain': entry(ladder('What this does'), ladder('呢樣做乜')),
  'settings.row.hideExplain': entry(ladder('Hide the explanation'), ladder('收埋解釋')),
  'settings.row.actions': entry(ladder('Actions for this setting'), ladder('呢個設定嘅動作')),
  'settings.row.copyId': entry(ladder('Copy the setting id'), ladder('複製設定編號')),
  'settings.row.copied': entry(ladder('Copied {id}'), ladder('複製咗 {id}')),
  'settings.row.lock': entry(ladder('Lock this setting…'), ladder('鎖住呢個設定…')),
  'settings.row.lockNotAvailable': entry(
    ladder('This setting cannot be locked: {reason}'),
    ladder('呢個設定唔可以鎖：{reason}')
  ),
  'settings.row.locked': entry(ladder('Locked'), ladder('鎖咗')),
  'settings.row.editAppearance': entry(ladder('Edit appearance…'), ladder('改外觀…')),
  'settings.row.reset': entry(ladder('Reset to the shipped value'), ladder('還原做出廠值')),
  'settings.row.resetDisabled': entry(
    ladder('This is already the shipped value, so there is nothing to reset.'),
    ladder('而家已經係出廠值，冇嘢好重設。')
  ),
  'settings.row.currentValue': entry(ladder('Current value: {value}'), ladder('而家嘅值：{value}')),
  'settings.row.select': entry(ladder('Select this setting'), ladder('揀呢個設定')),

  'settings.provenance.user': entry(
    ladder('From your settings file at {path}.'),
    ladder('由你嘅設定檔嚟，路徑係 {path}。')
  ),
  'settings.provenance.userNoPath': entry(
    ladder('Set by you. The settings file path could not be read from the main process.'),
    ladder('你自己設定嘅。主程序讀唔到設定檔嘅路徑。')
  ),
  'settings.provenance.default': entry(
    ladder('No file has ever set this. The application is using its built-in value: {value}.'),
    ladder('未有任何檔案寫過呢項，程式用緊自己內置嗰個值：{value}。')
  ),
  'settings.provenance.scheduled': entry(
    ladder('A schedule is setting this right now. Your own value returns when the schedule ends. The built-in value is {value}.'),
    ladder('而家係時間表決定緊，時間表完咗就會用返你嗰個。內置值係 {value}。')
  ),
  'settings.provenance.imported': entry(
    ladder('Came from an imported theme or settings file. The built-in value is {value}.'),
    ladder('由匯入嘅主題或者設定檔嚟。內置值係 {value}。')
  ),

  /* ---------------- validation and guidance ---------------- */

  'settings.validate.range': entry(
    ladder('Must be a number between {min} and {max}.'),
    ladder('要係 {min} 至 {max} 之間嘅數字。')
  ),
  'settings.validate.min': entry(ladder('Must be {min} or more.'), ladder('要 {min} 或者以上。')),
  'settings.validate.max': entry(ladder('Must be {max} or less.'), ladder('要 {max} 或者以下。')),
  'settings.validate.number': entry(
    ladder('That is not a number. Nothing was changed.'),
    ladder('呢個唔係數字，乜都冇改到。')
  ),
  'settings.validate.step': entry(
    ladder('Must be a multiple of {step}, counting from {min}.'),
    ladder('要係 {step} 嘅倍數，由 {min} 數起。')
  ),
  'settings.validate.required': entry(
    ladder('This cannot be empty. Nothing was changed.'),
    ladder('呢個唔可以空白，乜都冇改到。')
  ),
  'settings.validate.accepted': entry(ladder('Accepted.'), ladder('收到。')),
  'settings.hint.suggested': entry(ladder('Suggested: {value}'), ladder('建議：{value}')),
  'settings.hint.useSuggested': entry(ladder('Use the built-in value'), ladder('用內置嗰個值')),
  'settings.hint.range': entry(ladder('Between {min} and {max}.'), ladder('{min} 至 {max} 之間。')),
  'settings.hint.browseFile': entry(ladder('Browse for a file…'), ladder('揀個檔案…')),
  'settings.hint.browseFolder': entry(ladder('Browse for a folder…'), ladder('揀個資料夾…')),
  'settings.hint.sameValidation': entry(
    ladder('A path you browse for runs through exactly the same checks as one you type.'),
    ladder('揀返嚟嘅路徑同你打嘅一樣，行同一套檢查。')
  ),
  'settings.disabled.noOptions': entry(
    ladder('This has no choices to offer yet, because the feature that fills it has not reported any.'),
    ladder('而家未有得揀，因為負責填佢嘅功能仲未報返任何選項。')
  ),
  'settings.disabled.locked': entry(
    ladder('This setting is locked. Unlock it from the padlock beside its name.'),
    ladder('呢個設定鎖咗，撳個名旁邊嗰個鎖頭解鎖。')
  ),
  'settings.disabled.custom': entry(
    ladder('This control is drawn by the feature that owns it and has no simple value to reset.'),
    ladder('呢個控制項由佢自己嘅功能畫，冇一個簡單值可以重設。')
  ),

  /* ---------------- selection and bulk actions ---------------- */

  'settings.select.mode': entry(ladder('Select settings'), ladder('揀設定')),
  'settings.select.modeOff': entry(ladder('Stop selecting'), ladder('唔揀喇')),
  'settings.select.thisTab': entry(ladder('Select every setting on this tab'), ladder('揀晒呢一版嘅設定')),
  'settings.select.everyMatch': entry(
    ladder('Select every setting matching the search, on every tab'),
    ladder('揀晒所有分頁入面符合搜尋嘅設定')
  ),
  'settings.select.invert': entry(ladder('Invert the selection'), ladder('反轉揀咗嘅嘢')),
  'settings.select.none': entry(ladder('Clear the selection'), ladder('唔揀晒')),
  'settings.select.count': entry(
    ladder('{count} selected, {changed} of which differ from the shipped value.'),
    ladder('揀咗 {count} 個，其中 {changed} 個同出廠值唔同。')
  ),
  'settings.select.empty': entry(
    ladder('Nothing is selected, so these actions have nothing to work on.'),
    ladder('冇揀任何嘢，所以呢啲動作冇嘢做得。')
  ),
  'settings.bulk.resetSelected': entry(ladder('Reset the selected settings'), ladder('重設揀咗嘅設定')),
  'settings.bulk.exportSelected': entry(ladder('Export the selected settings'), ladder('匯出揀咗嘅設定')),
  'settings.bulk.copySelected': entry(ladder('Copy the selected ids'), ladder('複製揀咗嘅編號')),
  'settings.bulk.resetPreview': entry(
    ladder('{count} settings will return to their shipped values. {unchanged} were already at them and will not move.'),
    ladder('{count} 個設定會返返出廠值，另外 {unchanged} 個本身已經係，唔會郁。')
  ),

  /* ---------------- export and import ---------------- */

  'settings.export.title': entry(ladder('Export settings'), ladder('匯出設定')),
  'settings.export.description': entry(
    ladder(
      'Writes the settings, their provenance and their shipped defaults to a file in the format you choose. Credentials and the personal vocabulary cache are never included, and the file says so.'
    ),
    ladder('將設定、佢哋嘅來源同出廠值寫入你揀嘅格式。憑證同個人詞彙快取永遠唔會包含在內，個檔案自己會講明。')
  ),
  'settings.export.format': entry(ladder('File format'), ladder('檔案格式')),
  'settings.export.scope': entry(ladder('What to export'), ladder('匯出啲乜')),
  'settings.export.scope.all': entry(ladder('Every setting'), ladder('全部設定')),
  'settings.export.scope.tab': entry(ladder('This tab only'), ladder('淨係呢一版')),
  'settings.export.scope.selected': entry(ladder('The selected settings only'), ladder('淨係揀咗嗰啲')),
  'settings.export.scope.changed': entry(
    ladder('Only settings that differ from the shipped value'),
    ladder('淨係同出廠值唔同嗰啲')
  ),
  'settings.export.count': entry(ladder('{count} settings will be written.'), ladder('會寫入 {count} 個設定。')),
  'settings.export.losses': entry(
    ladder('{format} cannot carry every field faithfully. These become text: {fields}'),
    ladder('{format} 載唔起所有欄位，呢啲會變成文字：{fields}')
  ),
  'settings.export.noLosses': entry(
    ladder('{format} carries every field faithfully.'),
    ladder('{format} 可以完整載晒所有欄位。')
  ),
  'settings.export.omitted': entry(
    ladder('Credentials, the personal vocabulary cache and the lock verifiers are not included in this export.'),
    ladder('憑證、個人詞彙快取同鎖嘅驗證資料唔會包喺呢個匯出入面。')
  ),
  'settings.export.saved': entry(ladder('Exported to {path}'), ladder('匯出咗去 {path}')),
  'settings.export.openInEditor': entry(ladder('Open the export in the editor'), ladder('喺編輯器開返個匯出檔')),
  'settings.export.cancelled': entry(ladder('Nothing was written.'), ladder('乜都冇寫到。')),

  'settings.import.title': entry(ladder('Import settings'), ladder('匯入設定')),
  'settings.import.description': entry(
    ladder(
      'Reads a settings file this application exported as JSON and applies the values it carries. Every key is listed before anything is applied, and a key this build does not know is reported rather than written.'
    ),
    ladder('讀返一個由呢個程式匯出嘅 JSON 設定檔，然後套用入面嘅值。套用之前會列晒每一條鎖匙，遇到呢個版本唔識嘅鎖匙就會報返出嚟，唔會寫落去。')
  ),
  'settings.import.choose': entry(ladder('Choose a settings file…'), ladder('揀個設定檔…')),
  'settings.import.invalid': entry(ladder('That file was refused: {reason}'), ladder('個檔案唔收：{reason}')),
  'settings.import.preview': entry(
    ladder('{apply} values will be applied, {unknown} keys are not known to this build and {same} already match.'),
    ladder('會套用 {apply} 個值，{unknown} 條鎖匙呢個版本唔識，另外 {same} 個本身已經一樣。')
  ),
  'settings.import.unknownList': entry(
    ladder('Not known to this build: {keys}'),
    ladder('呢個版本唔識：{keys}')
  ),
  'settings.import.apply': entry(ladder('Apply these values'), ladder('套用呢啲值')),
  'settings.import.applied': entry(ladder('{count} settings were applied.'), ladder('套用咗 {count} 個設定。')),
  'settings.import.nothing': entry(
    ladder('That file carried nothing this build could apply.'),
    ladder('呢個檔案冇任何呢個版本用得着嘅嘢。')
  ),

  /* ---------------- reset ---------------- */

  'settings.reset.all': entry(ladder('Reset every setting'), ladder('重設所有設定')),
  'settings.reset.allDescription': entry(
    ladder(
      'Removes every stored preference from the settings file so the application falls back to the value this build ships with. Credentials, locks and the local history are not touched, and the change is recorded in local history so the previous values can be read back from there.'
    ),
    ladder('由設定檔清走所有已存偏好，令程式退返去呢個版本自帶嘅值。憑證、鎖同本機紀錄唔會郁，而且呢次改動會入紀錄，之前啲值可以喺嗰度睇返。')
  ),
  'settings.reset.done': entry(
    ladder('{count} stored values were removed. The application is now using its built-in values.'),
    ladder('清走咗 {count} 個已存值，程式而家用緊內置嘅值。')
  ),
  'settings.reset.nothing': entry(
    ladder('Nothing was stored, so nothing changed.'),
    ladder('本身冇存過嘢，所以乜都冇變。')
  ),

  /* ---------------- start-up and misc ---------------- */

  'settings.startTab': entry(ladder('Settings tab to open first'), ladder('先開邊個設定分頁')),
  'settings.startTab.description': entry(
    ladder(
      'Which settings tab opens when you come here. "Last one used" remembers where you were; anything else always starts in the same place.'
    ),
    ladder('嚟到設定嗰陣先開邊一版。「上次嗰版」會記住你走嗰陣喺邊；揀第二樣就每次都由同一版開始。')
  ),
  'settings.startTab.last': entry(ladder('Last one used'), ladder('上次嗰版')),
  'settings.showIds': entry(ladder('Show the setting id under each name'), ladder('喺每個名下面顯示設定編號')),
  'settings.showIds.description': entry(
    ladder(
      'Shows the stable dotted id, e.g. downloader.port, beside each setting. The id is what an exported file, a support request and the command palette all use, so it is worth being able to read it.'
    ),
    ladder('喺每個設定旁邊顯示佢個穩定編號（例如 downloader.port）。匯出檔、求助同指令板全部用呢個編號，睇得到會方便好多。')
  ),
  'settings.expandAll': entry(ladder('Open every explanation'), ladder('打開所有解釋')),
  'settings.expandAll.description': entry(
    ladder('Starts every setting with its explanation already open rather than behind the question mark.'),
    ladder('一開始就展開晒每個設定嘅解釋，唔使逐個撳問號。')
  ),
  'settings.empty.section': entry(
    ladder('This tab has no settings in it.'),
    ladder('呢一版一個設定都冇。')
  ),
  'settings.empty.noSections': entry(
    ladder('No feature has registered any settings yet.'),
    ladder('未有任何功能登記過設定。')
  ),
  'settings.schoolNotice': entry(
    ladder('{name} is on, so the language, humour, personal-vocabulary and dim sum settings are not present.'),
    ladder('{name} 開咗，所以語言、語氣、個人詞彙同點心嗰啲設定唔會出現。')
  ),
  'settings.tools.title': entry(ladder('Settings tools'), ladder('設定工具')),
  'settings.announce.opened': entry(ladder('Opened the {tab} settings tab'), ladder('打開咗 {tab} 設定分頁')),
  'settings.announce.reset': entry(ladder('{label} was reset to {value}'), ladder('{label} 重設返做 {value}')),
  'settings.announce.set': entry(ladder('{label} is now {value}'), ladder('{label} 而家係 {value}'))
};
