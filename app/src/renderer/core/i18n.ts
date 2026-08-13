import { settings } from './settings';
import type {
  Catalogue,
  FunnyLadder,
  FunnyLevel,
  I18n,
  I18nSnapshot,
  LanguageMode,
  TranslateOptions,
  TranslationEntry,
  VocabularyLoadResult
} from './types';

/**
 * Language modes, humour levels, the emoji switch, School mode and the personal
 * vocabulary hook.
 *
 * Three things are worth knowing before editing this file.
 *
 * The funny level styles the VOICE and never the FACTS. Every ladder below says
 * the same thing at every rung: the same file, the same action, the same
 * consequence. A message that is funny but leaves the reader unsure what a
 * button will do is a broken message, not a good one — so error, warning and
 * destructive copy get humour too, and keep every fact intact while they do.
 *
 * The two funny levels are INDEPENDENT. English at 1 beside Cantonese at 5 is a
 * combination somebody will actually choose, and both halves of a bilingual line
 * must read correctly in it.
 *
 * The personal vocabulary ships EMPTY. There are no built-in mappings, no
 * samples and no templates anywhere in this file; until the user supplies a
 * validated local file, `applyVocabulary` is the identity function.
 */

/* ------------------------------------------------------------------ */
/* Setting ids                                                         */
/* ------------------------------------------------------------------ */

export const LANGUAGE_MODE_ID = 'language.mode';
export const FUNNY_EN_ID = 'language.funny.en';
export const FUNNY_YUE_ID = 'language.funny.yue';
export const EMOJI_DIALOGS_ID = 'language.emojiInDialogs';
export const SCHOOL_ENABLED_ID = 'school.enabled';
export const SCHOOL_NAME_ID = 'school.name';
export const VOCABULARY_LOADED_ID = 'vocabulary.loaded';

const DEFAULT_SCHOOL_NAME = 'School mode';

/* ------------------------------------------------------------------ */
/* Ladder helper                                                       */
/* ------------------------------------------------------------------ */

/**
 * Expands a short ladder to all five levels.
 *
 * One string means the copy genuinely reads the same at every level — which is
 * right for a bare noun like "Settings". Two means serious/playful. Three means
 * serious, middle, playful. Five is written out.
 */
function ladder(...steps: string[]): FunnyLadder {
  if (steps.length === 0) throw new Error('A ladder needs at least one string.');
  if (steps.length === 5) return steps as unknown as FunnyLadder;
  if (steps.length === 1) return [steps[0], steps[0], steps[0], steps[0], steps[0]];
  if (steps.length === 2) return [steps[0], steps[0], steps[0], steps[1], steps[1]];
  if (steps.length === 3) return [steps[0], steps[0], steps[1], steps[2], steps[2]];
  if (steps.length === 4) return [steps[0], steps[1], steps[2], steps[3], steps[3]];
  throw new Error(`A ladder takes 1, 2, 3, 4 or 5 strings; ${steps.length} were given.`);
}

function entry(en: FunnyLadder, yue: FunnyLadder): TranslationEntry {
  return { en, yue };
}

/* ------------------------------------------------------------------ */
/* Core catalogue                                                      */
/* ------------------------------------------------------------------ */

const CORE: Catalogue = {
  /* --- application chrome --- */
  'core.app.name': entry(ladder('World Downloader Studio'), ladder('World Downloader Studio')),
  'core.window.minimize': entry(ladder('Minimize'), ladder('縮細')),
  'core.window.maximize': entry(ladder('Maximize'), ladder('放到最大')),
  'core.window.restore': entry(ladder('Restore'), ladder('還原')),
  'core.window.close': entry(ladder('Close'), ladder('閂咗佢')),
  'core.window.menu': entry(ladder('Application menu'), ladder('程式選單')),

  /* --- generic actions --- */
  'core.action.ok': entry(ladder('OK'), ladder('好')),
  'core.action.cancel': entry(ladder('Cancel'), ladder('唔使喇')),
  'core.action.confirm': entry(ladder('Confirm'), ladder('確認')),
  'core.action.apply': entry(ladder('Apply'), ladder('套用')),
  'core.action.close': entry(ladder('Close'), ladder('閂咗佢')),
  'core.action.save': entry(ladder('Save'), ladder('儲存')),
  'core.action.copy': entry(ladder('Copy'), ladder('複製')),
  'core.action.export': entry(ladder('Export'), ladder('匯出')),
  'core.action.reset': entry(ladder('Reset'), ladder('重設')),
  'core.action.resetAll': entry(ladder('Reset everything'), ladder('全部重設')),
  'core.action.delete': entry(ladder('Delete'), ladder('刪除')),
  'core.action.dismiss': entry(ladder('Dismiss'), ladder('唔理佢')),
  'core.action.retry': entry(ladder('Retry'), ladder('再試一次')),
  'core.action.browse': entry(ladder('Browse…'), ladder('揀檔案…')),
  'core.action.browseFolder': entry(ladder('Browse for folder…'), ladder('揀資料夾…')),
  'core.action.openInEditor': entry(ladder('Open in editor'), ladder('用編輯器開')),
  'core.action.selectAll': entry(ladder('Select all'), ladder('全選')),
  'core.action.invertSelection': entry(ladder('Invert selection'), ladder('反轉揀嘅嘢')),
  'core.action.more': entry(ladder('More'), ladder('仲有')),

  /* --- search and regular expressions --- */
  'core.search.label': entry(ladder('Search'), ladder('搵嘢')),
  'core.search.placeholder': entry(
    ladder('Search…', 'Search…', 'Search for something…', 'Type and it starts looking…', 'Type and it starts looking…'),
    ladder('搵嘢…', '搵嘢…', '搵下有咩…', '打字就開始搵…', '打字就開始搵…')
  ),
  'core.search.regexToggle': entry(ladder('Use a regular expression'), ladder('用正則表達式')),
  'core.search.builder': entry(ladder('Open the pattern builder'), ladder('打開圖樣製作器')),
  'core.search.noMatches': entry(
    ladder('Nothing matched.', 'Nothing matched.', 'Nothing matched that.', 'Nothing matched. Not one thing.', 'Nothing matched. Not one thing.'),
    ladder('搵唔到嘢。', '搵唔到嘢。', '乜都搵唔到。', '一件都搵唔到，真係一件都冇。', '一件都搵唔到，真係一件都冇。')
  ),
  'core.search.matchCount': entry(ladder('{count} of {total} shown'), ladder('顯示緊 {total} 個入面嘅 {count} 個')),

  'core.regex.title': entry(ladder('Pattern builder'), ladder('圖樣製作器')),
  'core.regex.engine': entry(
    ladder('This is the JavaScript RegExp engine. Patterns behave exactly as they do there.'),
    ladder('用嘅係 JavaScript RegExp 引擎，寫法同嗰邊一模一樣。')
  ),
  'core.regex.pattern': entry(ladder('Pattern'), ladder('圖樣')),
  'core.regex.flags': entry(ladder('Flags'), ladder('旗標')),
  'core.regex.sample': entry(ladder('Sample text'), ladder('試驗文字')),
  'core.regex.matches': entry(ladder('Matches'), ladder('配對結果')),
  'core.regex.groups': entry(ladder('Capture groups'), ladder('擷取組')),
  'core.regex.invalid': entry(ladder('That pattern does not compile: {message}'), ladder('呢個圖樣行唔通：{message}')),
  'core.regex.timeBudget': entry(
    ladder('Evaluation stopped after {ms} ms to keep the window responsive. The pattern is probably backtracking.'),
    ladder('行咗 {ms} 毫秒就停手，唔想個窗死咗。個圖樣好可能喺度不停回頭試。')
  ),
  'core.regex.insertLiteral': entry(ladder('Literal text'), ladder('原文字')),
  'core.regex.insertClass': entry(ladder('Character class'), ladder('字元類')),
  'core.regex.insertAnchor': entry(ladder('Anchor'), ladder('錨點')),
  'core.regex.insertGroup': entry(ladder('Group'), ladder('組合')),
  'core.regex.insertAlternation': entry(ladder('Alternation'), ladder('二揀一')),
  'core.regex.insertQuantifier': entry(ladder('Quantifier'), ladder('數量詞')),

  /* --- tabs --- */
  'core.tabs.strip': entry(ladder('Tabs'), ladder('分頁')),
  'core.tabs.overflow': entry(ladder('More tabs'), ladder('仲有分頁')),
  'core.tabs.searchStrip': entry(ladder('Search this tab strip'), ladder('搵呢條分頁列')),
  'core.tabs.searchGroup': entry(ladder('Search this group'), ladder('搵呢個組')),
  'core.tabs.searchGroups': entry(ladder('Search tab groups'), ladder('搵分頁組')),
  'core.tabs.searchAll': entry(ladder('Search every open tab'), ladder('搵晒所有開咗嘅分頁')),
  'core.tabs.pin': entry(ladder('Pin tab'), ladder('釘住分頁')),
  'core.tabs.unpin': entry(ladder('Unpin tab'), ladder('唔釘住')),
  'core.tabs.pinned': entry(ladder('Pinned'), ladder('釘住咗')),
  'core.tabs.newGroup': entry(ladder('New group…'), ladder('開新組…')),
  'core.tabs.moveToGroup': entry(ladder('Move into group…'), ladder('搬入組…')),
  'core.tabs.renameGroup': entry(ladder('Rename group…'), ladder('改組名…')),
  'core.tabs.groupColor': entry(ladder('Group colour…'), ladder('組嘅顏色…')),
  'core.tabs.collapseGroup': entry(ladder('Collapse group'), ladder('摺埋個組')),
  'core.tabs.expandGroup': entry(ladder('Expand group'), ladder('打開個組')),
  'core.tabs.editAppearance': entry(ladder('Edit tab appearance…'), ladder('改分頁外觀…')),
  'core.tabs.editGroupAppearance': entry(ladder('Edit group appearance…'), ladder('改組外觀…')),
  'core.tabs.closeContaining': entry(ladder('Close tabs containing text…'), ladder('閂走有呢啲字嘅分頁…')),
  'core.tabs.closeNotContaining': entry(ladder('Close tabs not containing text…'), ladder('閂走冇呢啲字嘅分頁…')),
  'core.tabs.closePreview': entry(
    ladder('{count} tabs will close. {pinned} pinned tabs are excluded.'),
    ladder('會閂 {count} 個分頁，{pinned} 個釘住咗嘅唔會郁。')
  ),
  'core.tabs.dock': entry(ladder('Tab strip position'), ladder('分頁列位置')),
  'core.tabs.dock.left': entry(ladder('Left'), ladder('左邊')),
  'core.tabs.dock.right': entry(ladder('Right'), ladder('右邊')),
  'core.tabs.dock.top': entry(ladder('Top'), ladder('上面')),
  'core.tabs.dock.bottom': entry(ladder('Bottom'), ladder('下面')),
  'core.tabs.includePinned': entry(ladder('Include pinned tabs'), ladder('連釘住嘅一齊')),

  /* --- command palette --- */
  'core.palette.title': entry(ladder('Command palette'), ladder('指令板')),
  'core.palette.placeholder': entry(
    ladder('Search commands, settings and destinations…', 'Search commands, settings and destinations…', 'Type anything you are looking for…', 'Type anything. It knows where everything lives.', 'Type anything. It knows where everything lives.'),
    ladder('搵指令、設定同去邊度…', '搵指令、設定同去邊度…', '打你想搵嘅嘢…', '亂打都得，佢知每樣嘢喺邊。', '亂打都得，佢知每樣嘢喺邊。')
  ),
  'core.palette.sizeCard': entry(ladder('Card'), ladder('細版')),
  'core.palette.sizeFull': entry(ladder('Full window'), ladder('全窗')),
  'core.palette.kind.command': entry(ladder('Command'), ladder('指令')),
  'core.palette.kind.destination': entry(ladder('Destination'), ladder('去處')),
  'core.palette.kind.setting': entry(ladder('Setting'), ladder('設定')),
  'core.palette.locked': entry(ladder('Locked'), ladder('鎖咗')),

  /* --- settings --- */
  'core.settings.title': entry(ladder('Settings'), ladder('設定')),
  'core.settings.search': entry(ladder('Search settings'), ladder('搵設定')),
  'core.settings.explain': entry(ladder('What this does'), ladder('呢樣做乜')),
  'core.settings.provenance.user': entry(
    ladder('Set by you, and stored in {path}.'),
    ladder('你自己設定嘅，存喺 {path}。')
  ),
  'core.settings.provenance.default': entry(
    ladder('No file has ever set this. The application is using its own value: {value}.'),
    ladder('未有任何檔案寫過呢項，程式用緊自己嗰個值：{value}。')
  ),
  'core.settings.provenance.scheduled': entry(
    ladder('Currently set by a schedule. Your own value returns when the schedule ends.'),
    ladder('而家係時間表決定緊，時間表完咗就會用返你嗰個。')
  ),
  'core.settings.provenance.imported': entry(
    ladder('Came from an imported theme or profile.'),
    ladder('由匯入嘅主題或者設定檔嚟。')
  ),
  'core.settings.onOtherTab': entry(
    ladder('This match is on the "{tab}" tab.'),
    ladder('呢個結果喺「{tab}」嗰版。')
  ),
  'core.settings.resetOne': entry(ladder('Reset to the shipped value'), ladder('還原做出廠值')),

  /* --- language settings --- */
  'core.language.section': entry(ladder('Language and voice'), ladder('語言同語氣')),
  'core.language.mode': entry(ladder('Language'), ladder('語言')),
  'core.language.mode.description': entry(
    ladder('Chooses the language every label, message and notification is written in. Bilingual keeps English as the primary line with a compact Cantonese second line.'),
    ladder('決定所有標籤、訊息同通知用邊種語言。雙語模式英文行頭，廣東話喺下面細行。')
  ),
  'core.language.mode.en': entry(ladder('English'), ladder('英文')),
  'core.language.mode.yue': entry(ladder('Cantonese'), ladder('廣東話')),
  'core.language.mode.both': entry(ladder('Bilingual'), ladder('雙語')),
  'core.language.funnyEn': entry(ladder('Humour level, English'), ladder('英文好笑程度')),
  'core.language.funnyYue': entry(ladder('Humour level, Cantonese'), ladder('廣東話好笑程度')),
  'core.language.funny.description': entry(
    ladder(
      'Styles every message in this language, including errors, warnings and destructive prompts. Level 1 is fully professional, level 5 is maximum playfulness. The facts never change: whatever the level, a message still names what happened, what it affects and what your options are.'
    ),
    ladder(
      '呢個語言嘅所有訊息都跟呢個語氣，錯誤、警告同刪除提示都一樣。1 級完全正經，5 級最搞笑。事實永遠唔會變：無論邊一級，訊息都會講明發生咗乜、影響咩、你可以點揀。'
    )
  ),
  'core.language.emoji': entry(ladder('Show emoji in dialogs and message boxes'), ladder('喺對話框同訊息盒顯示表情符號')),
  'core.language.emoji.description': entry(
    ladder('Adds one decorative emoji to a dialog or message box. Buttons, field labels and screen-reader names never carry one either way.'),
    ladder('喺對話框或者訊息盒加一個裝飾用嘅表情符號。掣、欄位標籤同讀屏名永遠都唔會有。')
  ),
  'core.language.vocabulary': entry(ladder('Personal vocabulary file'), ladder('個人詞彙檔案')),
  'core.language.vocabulary.description': entry(
    ladder(
      'Loads a JSON file of your own word replacements from this computer. It is read locally, never uploaded, never logged and never exported. Nothing is replaced until you supply a file.'
    ),
    ladder(
      '由呢部電腦讀一個你自己嘅 JSON 詞彙替換檔。純本機讀取，唔會上載、唔會寫入紀錄、唔會匯出。你唔畀檔案就乜都唔會換。'
    )
  ),
  'core.language.vocabulary.none': entry(ladder('No file loaded'), ladder('未載入任何檔案')),
  'core.language.vocabulary.loaded': entry(ladder('{count} replacements loaded'), ladder('載入咗 {count} 個替換')),
  'core.language.vocabulary.invalid': entry(ladder('That file was refused: {reason}'), ladder('個檔案唔收：{reason}')),
  'core.language.vocabulary.clear': entry(ladder('Clear vocabulary'), ladder('清走詞彙')),

  /* --- School mode --- */
  'core.school.title': entry(ladder('{name}'), ladder('{name}')),
  'core.school.description': entry(
    ladder(
      'Forces English and removes the Cantonese, bilingual, humour, personal-vocabulary and dim sum capabilities from every surface, as though they were not installed. Your existing choices are kept and return when it is turned off. Turning it off needs the unlock code you set. This is a user-experience lock, not security: deleting {path} resets it.'
    ),
    ladder(
      '強制用英文，並且喺所有畫面移走廣東話、雙語、語氣、個人詞彙同點心驚喜，好似冇裝過噉。你原本嘅設定會保留，閂咗之後會返嚟。要閂就要用你設嘅解鎖碼。呢個係體驗鎖，唔係保安：刪咗 {path} 就會重設。'
    )
  ),
  'core.school.rename': entry(ladder('Name for this mode'), ladder('呢個模式嘅名')),
  'core.school.unlockPrompt': entry(ladder('Enter the unlock code for {name}'), ladder('輸入 {name} 嘅解鎖碼')),
  'core.school.wrongCode': entry(
    ladder('That code did not match. Delete {path} to reset it.'),
    ladder('個碼唔啱。刪咗 {path} 就可以重設。')
  ),

  /* --- appearance --- */
  'core.appearance.section': entry(ladder('Appearance'), ladder('外觀')),
  'core.appearance.theme': entry(ladder('Theme'), ladder('主題')),
  'core.appearance.theme.light': entry(ladder('Light'), ladder('淺色')),
  'core.appearance.theme.dark': entry(ladder('Dark'), ladder('深色')),
  'core.appearance.theme.system': entry(ladder('Follow the system'), ladder('跟系統')),
  'core.appearance.seed': entry(ladder('Accent colour'), ladder('主色')),
  'core.appearance.seed.description': entry(
    ladder('The whole colour scheme is generated from this one colour, in both light and dark.'),
    ladder('成套顏色（淺色同深色）都由呢隻色生出嚟。')
  ),
  'core.appearance.contrast': entry(ladder('Contrast'), ladder('對比度')),
  'core.appearance.density': entry(ladder('Density'), ladder('密度')),
  'core.appearance.font': entry(ladder('Interface font'), ladder('介面字體')),
  'core.appearance.fontScale': entry(ladder('Text size'), ladder('字大細')),
  'core.appearance.fontWeight': entry(ladder('Text weight'), ladder('字粗幼')),
  'core.appearance.editElement': entry(ladder('Edit appearance…'), ladder('改外觀…')),
  'core.appearance.editorTitle': entry(ladder('Appearance of {target}'), ladder('{target} 嘅外觀')),
  'core.appearance.resetProperty': entry(ladder('Reset this property'), ladder('重設呢項')),
  'core.appearance.resetElement': entry(ladder('Reset this element'), ladder('重設呢個元素')),
  'core.appearance.presets': entry(ladder('Presets'), ladder('預設')),
  'core.appearance.exportTheme': entry(ladder('Export theme…'), ladder('匯出主題…')),
  'core.appearance.importTheme': entry(ladder('Import theme…'), ladder('匯入主題…')),
  'core.appearance.appName': entry(ladder('Name shown for this application'), ladder('呢個程式顯示嘅名')),
  'core.appearance.appName.description': entry(
    ladder(
      'Changes what the application calls itself in the title bar, the About surface and its notifications. It changes nothing else: the data directory, the installer identity and the update feed all stay put, and a diagnostic report still says {product} so a reader knows what software they are looking at.'
    ),
    ladder(
      '改嘅只係標題列、關於畫面同通知入面個名。其他嘢一律唔郁：資料夾、安裝身分同更新來源都留喺原位，診斷報告仍然寫住 {product}，等睇嘅人知係咩軟件。'
    )
  ),

  /* --- colour picker --- */
  'core.color.title': entry(ladder('Colour'), ladder('顏色')),
  'core.color.spectrum': entry(ladder('Spectrum'), ladder('色譜')),
  'core.color.hue': entry(ladder('Hue'), ladder('色相')),
  'core.color.alpha': entry(ladder('Opacity'), ladder('透明度')),
  'core.color.format': entry(ladder('Format'), ladder('格式')),
  'core.color.contrast': entry(ladder('Contrast against {against}: {ratio}:1'), ladder('同 {against} 嘅對比：{ratio}:1')),
  'core.color.outOfGamut': entry(
    ladder('That colour is outside the sRGB gamut and will be clipped to {hex}.'),
    ladder('呢隻色超出 sRGB 範圍，會夾埋做 {hex}。')
  ),
  'core.color.copy': entry(ladder('Copy this representation'), ladder('複製呢個寫法')),

  /* --- notifications --- */
  'core.notify.centre': entry(ladder('Notifications'), ladder('通知')),
  'core.notify.empty': entry(
    ladder('Nothing has been reported yet.', 'Nothing has been reported yet.', 'Nothing to report.', 'Nothing has gone wrong yet. Enjoy it.', 'Nothing has gone wrong yet. Enjoy it.'),
    ladder('暫時未有任何通知。', '暫時未有任何通知。', '冇嘢報告。', '暫時乜事都冇，好好享受。', '暫時乜事都冇，好好享受。')
  ),
  'core.notify.dismissAll': entry(ladder('Dismiss all'), ladder('全部唔理')),
  'core.notify.deleteSelected': entry(ladder('Delete selected'), ladder('刪走揀咗嘅')),
  'core.notify.exportFiltered': entry(ladder('Export what is shown'), ladder('匯出顯示緊嘅')),
  'core.notify.selected': entry(ladder('{count} selected'), ladder('揀咗 {count} 個')),
  'core.notify.severity.info': entry(ladder('Information'), ladder('資訊')),
  'core.notify.severity.success': entry(ladder('Success'), ladder('搞掂')),
  'core.notify.severity.warning': entry(ladder('Warning'), ladder('警告')),
  'core.notify.severity.error': entry(ladder('Error'), ladder('出錯')),
  'core.notify.severity.progress': entry(ladder('In progress'), ladder('做緊')),

  /* --- destructive gate --- */
  'core.confirm.title': entry(
    ladder(
      'Confirm: {action}',
      'Confirm: {action}',
      'This one is permanent: {action}',
      'Right. Two keys and a slider before this happens: {action}',
      'Right. Two keys and a slider before this happens: {action}'
    ),
    ladder(
      '確認：{action}',
      '確認：{action}',
      '呢個係冇得返轉頭：{action}',
      '好喇，要扭兩條匙再拉個掣先做得：{action}',
      '好喇，要扭兩條匙再拉個掣先做得：{action}'
    )
  ),
  'core.confirm.affected': entry(ladder('What this affects'), ladder('會影響咩')),
  'core.confirm.irreversible': entry(ladder('What cannot be undone'), ladder('冇得反悔嘅部分')),
  'core.confirm.keyA': entry(ladder('First key'), ladder('第一條匙')),
  'core.confirm.keyB': entry(ladder('Second key'), ladder('第二條匙')),
  'core.confirm.turnKey': entry(ladder('Turn'), ladder('扭')),
  'core.confirm.slider': entry(ladder('Slide all the way to confirm'), ladder('拉到底先算數')),
  'core.confirm.sliderLocked': entry(ladder('Turn both keys first'), ladder('要先扭晒兩條匙')),
  'core.confirm.emergency': entry(ladder('Emergency exit'), ladder('緊急走人')),
  'core.confirm.done': entry(ladder('Done'), ladder('搞掂')),
  'core.confirm.cancelled': entry(ladder('Cancelled. Nothing was changed.'), ladder('取消咗，乜都冇郁過。')),

  /* --- history --- */
  'core.history.title': entry(ladder('Version history'), ladder('版本紀錄')),
  'core.history.description': entry(
    ladder(
      'Every change is a new entry in a local repository inside the application data directory. Nothing is pushed anywhere. Restoring an earlier state is recorded as a new entry, so an undo can itself be undone.'
    ),
    ladder(
      '每次改動都會喺程式資料夾入面嘅本機倉庫加一筆新紀錄，唔會推去任何地方。還原舊狀態一樣係新一筆，所以還原都可以再還原。'
    )
  ),
  'core.history.backend.git': entry(ladder('Backed by a local git repository at {path}.'), ladder('用緊 {path} 嘅本機 git 倉庫。')),
  'core.history.backend.journal': entry(
    ladder('git is not available, so entries are appended to a journal at {path} without commits. {reason}'),
    ladder('搵唔到 git，所以只係喺 {path} 嘅日誌加紀錄，冇 commit。{reason}')
  ),
  'core.history.filterDate': entry(ladder('Date range'), ladder('日期範圍')),
  'core.history.filterAction': entry(ladder('Action'), ladder('動作')),
  'core.history.empty': entry(ladder('No entries match those filters.'), ladder('冇紀錄符合呢啲條件。')),
  'core.history.restore': entry(ladder('Restore this state'), ladder('還原做呢個狀態')),
  'core.history.prune': entry(ladder('Prune older entries…'), ladder('清走舊紀錄…')),
  'core.history.recorded': entry(ladder('Recorded: {action}'), ladder('已紀錄：{action}')),

  /* --- export --- */
  'core.export.title': entry(ladder('Export'), ladder('匯出')),
  'core.export.format': entry(ladder('Format'), ladder('格式')),
  'core.export.encoding': entry(ladder('UTF-8, schema version {version}'), ladder('UTF-8，結構版本 {version}')),
  'core.export.losses': entry(
    ladder('{format} cannot carry every field. These would be flattened or dropped: {fields}'),
    ladder('{format} 載唔起所有欄位，呢啲會被壓平或者掉走：{fields}')
  ),
  'core.export.noLosses': entry(ladder('{format} carries every field faithfully.'), ladder('{format} 可以完整載晒所有欄位。')),
  'core.export.saved': entry(ladder('Exported to {path}'), ladder('匯出咗去 {path}')),
  'core.export.openInEditor': entry(ladder('Open the export in the editor'), ladder('喺編輯器開返個匯出檔')),

  /* --- documentation --- */
  'core.docs.title': entry(ladder('Documentation'), ladder('說明文件')),
  'core.docs.search': entry(ladder('Search the documentation'), ladder('搵說明文件')),
  'core.docs.related': entry(ladder('Suggested articles'), ladder('建議睇埋')),
  'core.docs.empty': entry(ladder('No article matched.'), ladder('冇文章符合。')),
  'core.docs.offline': entry(
    ladder('Every article is bundled into this build. Nothing here needs a network connection.'),
    ladder('所有文章都打包咗入呢個版本，完全唔使上網。')
  ),

  /* --- locks --- */
  'core.lock.command': entry(ladder('Lock this element…'), ladder('鎖住呢個元素…')),
  'core.lock.wizardTitle': entry(ladder('Lock {label}'), ladder('鎖住 {label}')),
  'core.lock.method': entry(ladder('How to unlock it'), ladder('點樣解鎖')),
  'core.lock.method.password': entry(ladder('A password'), ladder('用密碼')),
  'core.lock.method.totp': entry(ladder('A one-time code from your authenticator'), ladder('用驗證器嘅一次性碼')),
  'core.lock.duration': entry(ladder('Stay unlocked for'), ladder('解鎖幾耐')),
  'core.lock.duration.surface': entry(ladder('This surface only'), ladder('淨係呢一版')),
  'core.lock.duration.minutes': entry(ladder('{count} minutes'), ladder('{count} 分鐘')),
  'core.lock.duration.session': entry(ladder('Until the application closes'), ladder('直到閂咗程式')),
  'core.lock.toyWarning': entry(
    ladder(
      'This is just for fun. It is not security, not encryption, and it protects nothing from anybody else using this computer. If you forget it, delete {path} and every lock is gone.'
    ),
    ladder(
      '呢個純粹好玩。唔係保安，唔係加密，對其他用呢部電腦嘅人零防護。唔記得咗就刪 {path}，所有鎖一齊冇。'
    )
  ),
  'core.lock.unlockTitle': entry(ladder('Unlock {label}'), ladder('解鎖 {label}')),
  'core.lock.forgot': entry(ladder('Forgotten your password?'), ladder('唔記得密碼？')),
  'core.lock.wrong': entry(
    ladder('That did not match. Nothing was changed and nothing was deleted.'),
    ladder('唔啱。乜都冇改到，乜都冇刪到。')
  ),
  'core.lock.locked': entry(ladder('This is locked.'), ladder('呢度鎖咗。')),
  'core.lock.list': entry(ladder('Locked elements'), ladder('鎖咗嘅元素')),

  /* --- dim sum --- */
  'core.dimsum.title': entry(ladder('A dim sum appeared'), ladder('有嚿點心走咗出嚟')),
  'core.dimsum.dismiss': entry(ladder('Lovely'), ladder('好嘢')),

  /* --- errors and generic states --- */
  'core.error.title': entry(
    ladder('Something failed', 'Something failed', 'That did not work', 'That did not work, and here is exactly why', 'That did not work, and here is exactly why'),
    ladder('有嘢失敗咗', '有嘢失敗咗', '呢樣做唔到', '呢樣做唔到，原因寫晒喺度', '呢樣做唔到，原因寫晒喺度')
  ),
  'core.error.detail': entry(ladder('{message}'), ladder('{message}')),
  'core.state.loading': entry(ladder('Loading…'), ladder('載入緊…')),
  'core.state.emptyTitle': entry(ladder('Nothing here yet'), ladder('暫時乜都冇')),
  'core.feature.initFailed.title': entry(ladder('A feature did not start'), ladder('有個功能開唔到')),
  'core.feature.initFailed.body': entry(ladder('{id} reported: {message}'), ladder('{id} 話：{message}')),
  'core.feature.registerFailed.title': entry(
    ladder(
      'A feature did not load',
      'A feature did not load',
      'One feature never made it in',
      'One feature never made it through the door',
      'One feature never made it through the door'
    ),
    ladder(
      '有個功能載入唔到',
      '有個功能載入唔到',
      '有個功能入唔到嚟',
      '有個功能連門口都入唔到',
      '有個功能連門口都入唔到'
    )
  ),
  'core.feature.registerFailed.body': entry(
    ladder(
      '{path} was skipped: {reason} Nothing else was changed, and the rest of the application is unaffected.',
      '{path} was skipped: {reason} Nothing else was changed, and the rest of the application is unaffected.',
      '{path} was skipped: {reason} Nothing else changed; everything else still works.',
      '{path} got left on the doorstep: {reason} Nothing else was touched, and the rest of the application carries on regardless.',
      '{path} got left on the doorstep: {reason} Nothing else was touched, and the rest of the application carries on regardless.'
    ),
    ladder(
      '{path} 跳過咗：{reason} 其他嘢一律冇改動，應用程式其餘部分照常運作。',
      '{path} 跳過咗：{reason} 其他嘢一律冇改動，應用程式其餘部分照常運作。',
      '{path} 跳過咗：{reason} 其他嘢冇郁過，第啲功能照用得。',
      '{path} 俾人擱喺門口：{reason} 其他嘢一啲都冇郁過，應用程式其餘部分照樣運作。',
      '{path} 俾人擱喺門口：{reason} 其他嘢一啲都冇郁過，應用程式其餘部分照樣運作。'
    )
  ),

  /* --- home --- */
  'core.home.title': entry(ladder('Overview'), ladder('概覽')),
  'core.home.welcome': entry(
    ladder(
      'World Downloader Studio',
      'World Downloader Studio',
      'World Downloader Studio',
      'World Downloader Studio, at your service',
      'World Downloader Studio, at your service'
    ),
    ladder('World Downloader Studio', 'World Downloader Studio', 'World Downloader Studio', 'World Downloader Studio，聽候差遣', 'World Downloader Studio，聽候差遣')
  ),
  'core.home.lede': entry(
    ladder(
      'Proxy control, world tools, the live map, the web console and automation, in one window.'
    ),
    ladder('代理控制、世界工具、即時地圖、網頁主控台同自動化，全部喺同一個窗。')
  ),
  'core.home.paletteHint': entry(
    ladder('Press Ctrl+Shift+F to search every command, setting and destination.'),
    ladder('撳 Ctrl+Shift+F 就可以搵晒所有指令、設定同去處。')
  )
};

/* ------------------------------------------------------------------ */
/* Personal vocabulary                                                 */
/* ------------------------------------------------------------------ */

/**
 * The bounded contract for a personal vocabulary file. The schema and the limits
 * are generic and public; no real vocabulary value appears anywhere in this
 * source, in the documentation or in a test.
 */
const VOCABULARY_LIMITS = {
  maxBytes: 256 * 1024,
  maxEntries: 2000,
  maxKeyLength: 120,
  maxValueLength: 200,
  supportedVersions: [1]
} as const;

const VOCABULARY_CACHE_KEY = 'vocabulary.cache';

interface VocabularyCache {
  version: number;
  entries: Array<[string, string]>;
}

function validateVocabulary(json: string): { ok: true; cache: VocabularyCache } | { ok: false; error: string } {
  if (typeof json !== 'string') return { ok: false, error: 'The file could not be read as text.' };
  const bytes = new TextEncoder().encode(json).byteLength;
  if (bytes > VOCABULARY_LIMITS.maxBytes) {
    return { ok: false, error: `The file is ${bytes} bytes, beyond the ${VOCABULARY_LIMITS.maxBytes}-byte limit.` };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: 'The file is not valid JSON.' };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: 'The top level must be a JSON object.' };
  }
  const document = parsed as Record<string, unknown>;
  const version = document.version;
  if (typeof version !== 'number' || !VOCABULARY_LIMITS.supportedVersions.includes(version as 1)) {
    return {
      ok: false,
      error: `Unsupported schema version. Supported versions: ${VOCABULARY_LIMITS.supportedVersions.join(', ')}.`
    };
  }
  const replacements = document.replacements;
  if (typeof replacements !== 'object' || replacements === null || Array.isArray(replacements)) {
    return { ok: false, error: 'The "replacements" field must be a JSON object of string to string.' };
  }
  const entries = Object.entries(replacements as Record<string, unknown>);
  if (entries.length > VOCABULARY_LIMITS.maxEntries) {
    return { ok: false, error: `The file holds ${entries.length} entries, beyond the ${VOCABULARY_LIMITS.maxEntries} limit.` };
  }
  const accepted: Array<[string, string]> = [];
  for (const [key, value] of entries) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return { ok: false, error: 'A replacement key used a reserved object key. Nothing was applied.' };
    }
    if (key.length === 0 || key.length > VOCABULARY_LIMITS.maxKeyLength) {
      return { ok: false, error: `A replacement key is outside 1..${VOCABULARY_LIMITS.maxKeyLength} characters. Nothing was applied.` };
    }
    if (typeof value !== 'string' || value.length > VOCABULARY_LIMITS.maxValueLength) {
      return {
        ok: false,
        error: `A replacement value is not a string of at most ${VOCABULARY_LIMITS.maxValueLength} characters. Nothing was applied.`
      };
    }
    accepted.push([key, value]);
  }
  // Longest first, so a longer phrase is never broken by a shorter one inside it.
  accepted.sort((a, b) => b[0].length - a[0].length);
  return { ok: true, cache: { version, entries: accepted } };
}

/* ------------------------------------------------------------------ */
/* Implementation                                                      */
/* ------------------------------------------------------------------ */

const EMOJI_BY_PREFIX: Array<[RegExp, string]> = [
  [/^core\.error\./, '⚠️'],
  [/^core\.confirm\./, '🛑'],
  [/^core\.dimsum\./, '🥟'],
  [/^core\.notify\.severity\.success$/, '✅'],
  [/^core\.notify\.severity\.warning$/, '⚠️'],
  [/^core\.notify\.severity\.error$/, '❌'],
  [/^core\.history\./, '🗂️'],
  [/^core\.lock\./, '🔒']
];

class I18nImpl implements I18n {
  private catalogue: Catalogue = { ...CORE };
  private listeners = new Set<(snapshot: I18nSnapshot) => void>();
  private vocabulary: Array<[string, string]> = [];

  register(catalogue: Catalogue): void {
    for (const [key, value] of Object.entries(catalogue)) {
      // Core keys win, so a feature cannot quietly restyle the destructive gate.
      if (key.startsWith('core.') && key in CORE) continue;
      this.catalogue[key] = value;
    }
  }

  snapshot(): I18nSnapshot {
    const school = this.schoolModeActive();
    return {
      mode: school ? 'en' : this.modeSetting(),
      funnyEn: school ? 1 : this.funnyLevel('en'),
      funnyYue: school ? 1 : this.funnyLevel('yue'),
      emojiInDialogs: settings.get<boolean>(EMOJI_DIALOGS_ID, true),
      schoolMode: school,
      schoolModeName: settings.get<string>(SCHOOL_NAME_ID, DEFAULT_SCHOOL_NAME) || DEFAULT_SCHOOL_NAME,
      vocabularyLoaded: !school && this.vocabulary.length > 0
    };
  }

  schoolModeActive(): boolean {
    return settings.get<boolean>(SCHOOL_ENABLED_ID, false) === true;
  }

  private modeSetting(): LanguageMode {
    const raw = settings.get<string>(LANGUAGE_MODE_ID, 'en');
    return raw === 'yue' || raw === 'both' ? raw : 'en';
  }

  private funnyLevel(language: 'en' | 'yue'): FunnyLevel {
    const raw = settings.get<number>(language === 'en' ? FUNNY_EN_ID : FUNNY_YUE_ID, 3);
    const clamped = Math.min(5, Math.max(1, Math.round(Number(raw) || 3)));
    return clamped as FunnyLevel;
  }

  private lookup(key: string, language: 'en' | 'yue', level: FunnyLevel, fallbackEn?: string): string {
    const found = this.catalogue[key];
    if (!found) return fallbackEn ?? key;
    const ladderForLanguage = language === 'en' ? found.en : found.yue;
    // A ladder always has five rungs, so this cannot fall off the end. The
    // clamp is here so a corrupted persisted level still resolves rather than
    // rendering `undefined` at somebody.
    const index = Math.min(4, Math.max(0, level - 1));
    return ladderForLanguage[index] ?? ladderForLanguage[0] ?? fallbackEn ?? key;
  }

  private interpolate(text: string, values?: Record<string, string | number>): string {
    if (!values) return text;
    return text.replace(/\{(\w+)\}/g, (whole, name: string) => {
      const value = values[name];
      return value === undefined ? whole : String(value);
    });
  }

  private decorate(key: string, text: string, options?: TranslateOptions): string {
    if (!options?.dialog) return text;
    if (this.schoolModeActive()) return text;
    if (settings.get<boolean>(EMOJI_DIALOGS_ID, true) !== true) return text;
    for (const [pattern, emoji] of EMOJI_BY_PREFIX) {
      if (pattern.test(key)) return `${emoji} ${text}`;
    }
    return text;
  }

  pair(key: string, fallbackEn?: string, options?: TranslateOptions): { primary: string; secondary: string } {
    const snapshot = this.snapshot();
    const forced = options?.language;
    if (forced) {
      const level = forced === 'en' ? snapshot.funnyEn : snapshot.funnyYue;
      const text = this.finish(key, this.lookup(key, forced, level, fallbackEn), options);
      return { primary: text, secondary: '' };
    }
    if (snapshot.mode === 'en') {
      return {
        primary: this.finish(key, this.lookup(key, 'en', snapshot.funnyEn, fallbackEn), options),
        secondary: ''
      };
    }
    if (snapshot.mode === 'yue') {
      return {
        primary: this.finish(key, this.lookup(key, 'yue', snapshot.funnyYue, fallbackEn), options),
        secondary: ''
      };
    }
    return {
      primary: this.finish(key, this.lookup(key, 'en', snapshot.funnyEn, fallbackEn), options),
      secondary: this.finish(key, this.lookup(key, 'yue', snapshot.funnyYue, fallbackEn), options)
    };
  }

  private finish(key: string, raw: string, options?: TranslateOptions): string {
    return this.decorate(key, this.applyVocabulary(this.interpolate(raw, options?.values)), options);
  }

  t(key: string, fallbackEn?: string, options?: TranslateOptions): string {
    const { primary, secondary } = this.pair(key, fallbackEn, options);
    // An em space, so the two halves stay visually separable in a plain string
    // context while `pair()` remains the route for styling them independently.
    return secondary ? `${primary} ${secondary}` : primary;
  }

  setMode(mode: LanguageMode): void {
    settings.set(LANGUAGE_MODE_ID, mode);
    this.emit();
  }

  setFunny(language: 'en' | 'yue', level: FunnyLevel): void {
    settings.set(language === 'en' ? FUNNY_EN_ID : FUNNY_YUE_ID, level);
    this.emit();
  }

  setEmojiInDialogs(on: boolean): void {
    settings.set(EMOJI_DIALOGS_ID, on);
    this.emit();
  }

  onChange(listener: (snapshot: I18nSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(): void {
    const snapshot = this.snapshot();
    for (const listener of [...this.listeners]) {
      try {
        listener(snapshot);
      } catch (error) {
        console.error('A language listener threw:', error);
      }
    }
  }

  applyVocabulary(text: string): string {
    if (this.vocabulary.length === 0) return text;
    if (this.schoolModeActive()) return text;
    let out = text;
    for (const [from, to] of this.vocabulary) {
      if (!from) continue;
      out = out.split(from).join(to);
    }
    return out;
  }

  async loadVocabularyFile(json: string): Promise<VocabularyLoadResult> {
    const validated = validateVocabulary(json);
    if (!validated.ok) {
      // A rejected file never applies partially, and the previous cache stays.
      return { ok: false, entryCount: this.vocabulary.length, error: validated.error };
    }
    this.vocabulary = validated.cache.entries;
    settings.set(VOCABULARY_LOADED_ID, true);
    // Only the validated cache is persisted: never the source path, never the
    // original file, and never anything that could identify the user's file.
    settings.set(VOCABULARY_CACHE_KEY, validated.cache);
    this.emit();
    return { ok: true, entryCount: this.vocabulary.length };
  }

  async clearVocabulary(): Promise<void> {
    this.vocabulary = [];
    settings.set(VOCABULARY_LOADED_ID, false);
    settings.reset(VOCABULARY_CACHE_KEY);
    this.emit();
  }

  /** Revalidates the persisted cache at boot and fails closed to shipped wording. */
  restoreVocabularyCache(): void {
    const cached = settings.get<VocabularyCache | undefined>(VOCABULARY_CACHE_KEY, undefined);
    if (!cached || typeof cached !== 'object' || !Array.isArray(cached.entries)) {
      this.vocabulary = [];
      return;
    }
    const revalidated = validateVocabulary(
      JSON.stringify({ version: cached.version ?? 1, replacements: Object.fromEntries(cached.entries) })
    );
    this.vocabulary = revalidated.ok ? revalidated.cache.entries : [];
    if (!revalidated.ok) settings.reset(VOCABULARY_CACHE_KEY);
  }

  vocabularyLimits(): typeof VOCABULARY_LIMITS {
    return VOCABULARY_LIMITS;
  }
}

export const i18n = new I18nImpl();

/** Shorthand used across the core and available on every context object. */
export function t(key: string, fallbackEn?: string, options?: TranslateOptions): string {
  return i18n.t(key, fallbackEn, options);
}

/** Wires the language settings so a change repaints without a restart. */
export function initI18n(): void {
  i18n.restoreVocabularyCache();
  settings.onChange((change) => {
    if (
      change.id === LANGUAGE_MODE_ID ||
      change.id === FUNNY_EN_ID ||
      change.id === FUNNY_YUE_ID ||
      change.id === EMOJI_DIALOGS_ID ||
      change.id === SCHOOL_ENABLED_ID ||
      change.id === SCHOOL_NAME_ID
    ) {
      i18n.emit();
    }
  });
}

export { DEFAULT_SCHOOL_NAME, VOCABULARY_LIMITS };
