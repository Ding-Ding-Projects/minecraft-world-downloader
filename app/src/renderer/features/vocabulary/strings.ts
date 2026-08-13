import type { Catalogue, FunnyLadder, TranslationEntry } from '../../core/registry';

/**
 * This feature's copy, in English and in playful Hong Kong Cantonese, at all
 * five humour levels for each language independently.
 *
 * The rule the ladders below obey: humour styles the VOICE, never the FACTS. At
 * level 5 a rejection still names the exact rule that was broken, the clear
 * action still says the vocabulary is gone until the file is loaded again, and
 * every count, limit and field name is identical at every rung. A line that is
 * funny and leaves the reader unsure what a button does is a broken line.
 *
 * No ladder here contains a vocabulary term. The copy talks ABOUT replacements;
 * it never carries one, because this file is a public record and the user's word
 * list is not.
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

export const VOCABULARY_STRINGS: Catalogue = {
  /* ---------------- destination and headings ---------------- */

  'vocabulary.tab.title': entry(ladder('Personal vocabulary'), ladder('個人詞彙')),
  'vocabulary.title': entry(ladder('Personal vocabulary'), ladder('個人詞彙')),
  'vocabulary.subtitle': entry(
    ladder(
      'Replace words in this application with your own, from a local JSON file.',
      'Swap the wording in this application for your own, from a JSON file on this computer.',
      'Bring your own words. This application reads one local JSON file and uses your wording instead of its own.'
    ),
    ladder(
      '用你自己嘅本機 JSON 檔案，換走呢個程式入面嘅字眼。',
      '用一個喺呢部電腦嘅 JSON 檔，換走程式入面嘅字眼。',
      '自己嘅字自己話事：擺個本機 JSON 檔入嚟，程式就會用返你嘅講法。'
    )
  ),

  'vocabulary.section.file': entry(ladder('Vocabulary file'), ladder('詞彙檔案')),
  'vocabulary.section.file.description': entry(
    ladder(
      'Choose one JSON file from this computer. It is read locally, validated completely before anything is applied, and never sent anywhere.',
      'Pick one JSON file off this computer. It is read here, checked from end to end before a single word changes, and never leaves the machine.'
    ),
    ladder(
      '喺呢部電腦揀一個 JSON 檔。淨係喺本機讀，完全檢查晒先至用，唔會傳去任何地方。',
      '喺呢部電腦揀一個 JSON 檔。喺本機讀、由頭檢查到尾先至郁一個字，永遠唔會離開部機。'
    )
  ),
  'vocabulary.section.entries': entry(ladder('Loaded replacements'), ladder('已載入嘅替換')),
  'vocabulary.section.entries.description': entry(
    ladder(
      'Every replacement in the loaded file. Suppressing one stops it being applied without changing your file; removing one takes it out of the loaded copy, and your file on disk is untouched.',
      'Everything the loaded file asks for. Suppress one and it stops applying while your file stays exactly as it is; remove one and it leaves the loaded copy only — the file on disk is not touched.'
    ),
    ladder(
      '檔案入面每一個替換。「暫停」係停止套用但唔會改你個檔；「移除」係喺已載入嘅副本攞走，硬碟上嘅檔案完全冇郁過。',
      '個檔要求嘅嘢全部喺度。撳「暫停」就停用，你個檔一個字都唔會變；撳「移除」淨係喺已載入嗰份攞走，硬碟嗰個檔照舊。'
    )
  ),
  'vocabulary.section.preview': entry(ladder('Try it on some text'), ladder('試吓效果')),
  'vocabulary.section.preview.description': entry(
    ladder(
      'Type anything and see exactly what the active replacements do to it. This runs the same replacement code the rest of the application uses.',
      'Type anything here and watch what the active replacements make of it. It is the same code the whole application runs, not an imitation of it.'
    ),
    ladder(
      '打啲字入去，睇吓啲替換實際會點改。呢度用嘅係全個程式一樣嘅替換程式碼。',
      '想打乜就打乜，即刻睇到啲替換點整你段字。同全個程式用緊嘅係同一段碼，唔係扮嘅。'
    )
  ),
  'vocabulary.section.schema': entry(ladder('File format'), ladder('檔案格式')),
  'vocabulary.section.schema.description': entry(
    ladder(
      'The exact schema, its version and every limit a file must stay inside.',
      'The exact shape of the file, which version it must declare, and every limit it has to stay inside.'
    ),
    ladder(
      '確實嘅格式、版本，同埋每一個檔案要守嘅上限。',
      '個檔要點寫、要寫邊個版本、同每一條唔可以踩過嘅界線，全部喺度。'
    )
  ),
  'vocabulary.section.options': entry(ladder('Options'), ladder('選項')),
  'vocabulary.section.options.description': entry(
    ladder('How this destination behaves. Every option here is stored on this computer only.'),
    ladder('呢個頁面點運作。呢度每個選項都淨係存喺呢部電腦。')
  ),
  'vocabulary.section.privacy': entry(ladder('What leaves this computer'), ladder('有咩會離開呢部電腦')),

  /* ---------------- status ---------------- */

  'vocabulary.status.label': entry(ladder('Vocabulary status'), ladder('詞彙狀態')),
  'vocabulary.status.none': entry(ladder('No file loaded'), ladder('未載入任何檔案')),
  'vocabulary.status.none.body': entry(
    ladder(
      'Every surface is showing the wording this build ships with. This application contains no vocabulary of its own: nothing is replaced until you supply a file.',
      'Everything you can see is the wording this build shipped with. There is no built-in word list hiding anywhere — nothing changes until you hand over a file.'
    ),
    ladder(
      '而家所有介面都係用緊呢個版本原本嘅字眼。程式本身冇夾帶任何詞彙：你未俾檔案之前，一個字都唔會換。',
      '你見到嘅全部係出廠原字。程式冇偷偷收埋任何詞彙表——你未交檔案上嚟，一個字都唔會郁。'
    )
  ),
  'vocabulary.status.loaded': entry(
    ladder('{active} of {total} replacements active'),
    ladder('{total} 個替換之中，有 {active} 個生效緊')
  ),
  'vocabulary.status.loaded.body': entry(
    ladder(
      'Loaded from a file you chose. The validated replacements are cached in this application\'s own data folder; the file itself, its name and its location are not stored.',
      'Loaded from the file you picked. The checked replacements sit in this application\'s own data folder — the file, its name and where it lives are not written down anywhere.'
    ),
    ladder(
      '由你揀嘅檔案載入。通過檢查嘅替換會存喺程式自己嘅資料夾；個檔案本身、佢個名同位置都冇儲低。',
      '由你揀嗰個檔載入。檢查過嘅替換擺喺程式自己嘅資料夾——個檔、個名、擺喺邊都冇記低。'
    )
  ),
  'vocabulary.status.empty': entry(
    ladder('A file is loaded and it contains no replacements'),
    ladder('載入咗檔案，但入面一個替換都冇')
  ),
  'vocabulary.status.empty.body': entry(
    ladder(
      'The file is valid and asks for nothing to change, so every surface reads exactly as this build shipped it.',
      'The file is perfectly valid and asks for nothing at all, so every surface reads exactly as it shipped.'
    ),
    ladder(
      '個檔冇問題，只係冇要求改任何嘢，所以所有介面同出廠一樣。',
      '個檔完全合格，不過咩都冇要求，所以所有介面照出廠嗰個樣。'
    )
  ),
  'vocabulary.status.loadedAt': entry(ladder('Loaded {time}'), ladder('{time} 載入')),
  'vocabulary.status.rejected': entry(ladder('The last file was refused'), ladder('上一個檔案唔收')),
  'vocabulary.status.rejectedKept': entry(
    ladder('Nothing was applied from it, and what was already loaded is unchanged.'),
    ladder('入面一樣嘢都冇套用，原本載入咗嘅嘢一個字都冇變。')
  ),
  'vocabulary.status.unavailable': entry(
    ladder('Not available while {mode} is on'),
    ladder('{mode} 開住嗰陣用唔到')
  ),

  /* ---------------- actions ---------------- */

  'vocabulary.action.choose': entry(ladder('Choose a JSON file'), ladder('揀個 JSON 檔')),
  'vocabulary.action.replace': entry(ladder('Replace the loaded file'), ladder('換走而家載入嘅檔案')),
  'vocabulary.action.clear': entry(
    ladder('Clear and restore the original wording'),
    ladder('清走，還原做原本嘅字眼')
  ),
  'vocabulary.action.clear.disabled': entry(
    ladder(
      'No vocabulary is loaded, so there is nothing to clear. Every surface is already using the wording this build ships with.'
    ),
    ladder('未載入任何詞彙，所以冇嘢可以清。所有介面而家已經係用緊呢個版本原本嘅字眼。')
  ),
  'vocabulary.action.template': entry(ladder('Save a blank template'), ladder('存一個空白範本')),
  'vocabulary.action.dismiss': entry(ladder('Dismiss'), ladder('知道喇')),
  'vocabulary.action.suppress': entry(ladder('Suppress'), ladder('暫停')),
  'vocabulary.action.restore': entry(ladder('Restore'), ladder('復用')),
  'vocabulary.action.suppress.disabled': entry(
    ladder('Every selected replacement is already suppressed.'),
    ladder('揀咗嘅替換全部已經暫停咗。')
  ),
  'vocabulary.action.restore.disabled': entry(
    ladder('Every selected replacement is already active.'),
    ladder('揀咗嘅替換全部已經生效緊。')
  ),
  'vocabulary.action.remove': entry(ladder('Remove'), ladder('移除')),
  'vocabulary.action.selectPage': entry(
    ladder('Select the {count} on this page'),
    ladder('揀晒呢一版嘅 {count} 個')
  ),
  'vocabulary.action.selectMatches': entry(
    ladder('Select all {count} matching'),
    ladder('揀晒所有 {count} 個相符嘅')
  ),
  'vocabulary.action.invert': entry(ladder('Invert the selection'), ladder('反轉選取')),
  'vocabulary.action.clearSelection': entry(ladder('Clear the selection'), ladder('唔揀喇')),
  'vocabulary.action.previous': entry(ladder('Previous page'), ladder('上一版')),
  'vocabulary.action.next': entry(ladder('Next page'), ladder('下一版')),

  /* ---------------- table ---------------- */

  'vocabulary.table.label': entry(ladder('Loaded replacements'), ladder('已載入嘅替換')),
  'vocabulary.table.from': entry(ladder('Text replaced'), ladder('被換走嘅字')),
  'vocabulary.table.to': entry(ladder('Shown instead'), ladder('換成')),
  'vocabulary.table.state': entry(ladder('State'), ladder('狀態')),
  'vocabulary.table.select': entry(ladder('Select replacement {index}'), ladder('揀第 {index} 個替換')),
  'vocabulary.table.active': entry(ladder('Active'), ladder('生效緊')),
  'vocabulary.table.suppressed': entry(ladder('Suppressed'), ladder('暫停咗')),
  'vocabulary.table.emptyValue': entry(ladder('(removed)'), ladder('（刪走）')),
  'vocabulary.table.none': entry(
    ladder('No file is loaded, so there is nothing to list.'),
    ladder('未載入檔案，所以冇嘢可以列。')
  ),
  'vocabulary.table.noMatches': entry(
    ladder('No loaded replacement matches this search.'),
    ladder('冇任何已載入嘅替換啱呢個搜尋。')
  ),
  'vocabulary.table.hidden': entry(ladder('The list is hidden'), ladder('個清單收埋咗')),
  'vocabulary.table.hidden.body': entry(
    ladder(
      '{count} replacements are loaded and working. Turn on "Show the loaded replacements" below to see them.',
      '{count} replacements are loaded and doing their job out of sight. Turn on "Show the loaded replacements" below if you want to look at them.'
    ),
    ladder(
      '載入咗 {count} 個替換，運作緊。想睇就喺下面開「顯示已載入嘅替換」。',
      '有 {count} 個替換靜靜雞做緊嘢。想睇就喺下面開「顯示已載入嘅替換」。'
    )
  ),
  'vocabulary.page.status': entry(
    ladder('Showing {from} to {to} of {total}'),
    ladder('顯示緊第 {from} 至 {to} 個，共 {total} 個')
  ),
  'vocabulary.selection.count': entry(ladder('{count} selected'), ladder('揀咗 {count} 個')),
  'vocabulary.selection.none': entry(ladder('Nothing selected'), ladder('乜都未揀')),
  'vocabulary.selection.preview': entry(
    ladder('{suppress} would be suppressed, {restore} would be restored, {remove} would be removed.'),
    ladder('會暫停 {suppress} 個、復用 {restore} 個、移除 {remove} 個。')
  ),
  'vocabulary.table.elsewhere.body': entry(
    ladder(
      'A vocabulary is applied, but it was loaded through the settings surface and its entries cannot be listed here. Loading your file from this destination lists them.',
      'A vocabulary is applied — it just came in through the settings surface, so its entries cannot be listed here. Load your file from this destination and they appear.'
    ),
    ladder(
      '有詞彙生效緊，不過係喺設定嗰邊載入，所以呢度列唔到啲項目。喺呢一頁載入你個檔就會列出嚟。',
      '有詞彙生效緊，只不過係喺設定嗰邊入嚟，所以呢度列唔到。喺呢一頁載入你個檔，即刻見到。'
    )
  ),
  'vocabulary.action.clearSearch': entry(ladder('Clear the search'), ladder('清走搜尋')),

  /* ---------------- search ---------------- */

  'vocabulary.search.label': entry(
    ladder('Search the loaded replacements'),
    ladder('搵已載入嘅替換')
  ),
  'vocabulary.search.placeholder': entry(
    ladder('Search replaced or replacement text'),
    ladder('搵被換走或者換成嘅字')
  ),

  /* ---------------- preview ---------------- */

  'vocabulary.preview.sample': entry(ladder('Sample text'), ladder('測試字句')),
  'vocabulary.preview.result': entry(ladder('With your vocabulary applied'), ladder('套用你嘅詞彙之後')),
  'vocabulary.preview.identical': entry(
    ladder('Nothing in this sample changes.'),
    ladder('呢段字一個字都唔會變。')
  ),
  'vocabulary.preview.changed': entry(
    ladder('{count} replacements changed this sample.'),
    ladder('有 {count} 個替換改咗呢段字。')
  ),
  'vocabulary.preview.empty': entry(
    ladder('Type something above to see what the active replacements do to it.'),
    ladder('喺上面打啲字，就會見到生效緊嘅替換點改佢。')
  ),

  /* ---------------- destructive gate ---------------- */

  'vocabulary.confirm.clear': entry(
    ladder('Clear the personal vocabulary and restore the original wording'),
    ladder('清走個人詞彙，還原做原本嘅字眼')
  ),
  'vocabulary.confirm.clear.irreversible': entry(
    ladder(
      'The cached replacements are deleted from this computer and every surface returns to the wording this build ships with. Your own file is not touched, but version history never records vocabulary content, so this cannot be undone from history: load your file again to bring it back.',
      'The cached replacements are wiped off this computer and every surface goes back to the wording this build shipped with. Your own file is untouched — but version history never writes down vocabulary content, so history cannot bring this back. Loading your file again is the way back.'
    ),
    ladder(
      '快取入面嘅替換會喺呢部電腦刪走，所有介面返去呢個版本原本嘅字眼。你自己個檔唔會郁，但版本紀錄從來唔會記低詞彙內容，所以唔可以用紀錄還原：想要返就再載入你個檔。',
      '快取嗰啲替換會喺部機清走，所有介面返晒去出廠字眼。你個檔一條毛都唔會少，但版本紀錄由頭到尾都唔記詞彙內容，所以還原唔到：想要返就再載入你個檔。'
    )
  ),
  'vocabulary.row.suppress.disabled': entry(
    ladder('This replacement is already suppressed.'),
    ladder('呢個替換已經暫停咗。')
  ),
  'vocabulary.row.restore.disabled': entry(
    ladder('This replacement is already active.'),
    ladder('呢個替換已經生效緊。')
  ),
  'vocabulary.confirm.andMore': entry(ladder('… and {count} more'), ladder('… 仲有 {count} 個')),
  'vocabulary.confirm.remove': entry(
    ladder('Remove {count} replacements from the loaded vocabulary'),
    ladder('喺已載入嘅詞彙度移除 {count} 個替換')
  ),
  'vocabulary.confirm.remove.irreversible': entry(
    ladder(
      'They stop applying and leave the loaded copy on this computer. Your file on disk is not changed, so loading it again brings them back.',
      'They stop applying and drop out of the loaded copy on this computer. The file on disk is not changed one bit, so loading it again brings them straight back.'
    ),
    ladder(
      '佢哋會停止套用，亦會喺呢部電腦已載入嗰份度消失。硬碟上嘅檔案唔會變，所以再載入一次就返晒嚟。',
      '佢哋即刻停用，亦會喺部機已載入嗰份度消失。硬碟嗰個檔一個字都冇改，再載入一次就乜都返晒嚟。'
    )
  ),

  /* ---------------- notifications ---------------- */

  'vocabulary.notify.loaded': entry(ladder('Personal vocabulary loaded'), ladder('個人詞彙載入咗')),
  'vocabulary.notify.loaded.body': entry(
    ladder('{count} replacements passed validation and are in use.'),
    ladder('{count} 個替換通過檢查，而家用緊。')
  ),
  'vocabulary.notify.refused': entry(ladder('That file was refused'), ladder('嗰個檔唔收得')),
  'vocabulary.notify.cleared': entry(
    ladder('Personal vocabulary cleared'),
    ladder('個人詞彙清走咗')
  ),
  'vocabulary.notify.cleared.body': entry(
    ladder('Every surface is back to the wording this build ships with.'),
    ladder('所有介面都返咗去呢個版本原本嘅字眼。')
  ),
  'vocabulary.notify.templateSaved': entry(ladder('Blank template saved'), ladder('空白範本存咗')),
  'vocabulary.notify.templateSaved.body': entry(
    ladder('It declares schema version {version} and contains no replacements.'),
    ladder('入面寫住格式版本 {version}，一個替換都冇。')
  ),
  'vocabulary.notify.readFailed': entry(ladder('The file could not be read'), ladder('讀唔到個檔')),
  'vocabulary.notify.readFailed.body': entry(
    ladder(
      'It could not be opened, or it is beyond the {limit}-byte limit. Nothing was applied.',
      'It would not open, or it is bigger than the {limit}-byte limit. Nothing was applied.'
    ),
    ladder(
      '開唔到，又或者超過 {limit} bytes 上限。一樣嘢都冇套用。',
      '開唔到，又或者大過 {limit} bytes 上限。一樣嘢都冇套用。'
    )
  ),
  'vocabulary.notify.suppressed': entry(
    ladder('{count} replacements suppressed'),
    ladder('暫停咗 {count} 個替換')
  ),
  'vocabulary.notify.restored': entry(
    ladder('{count} replacements restored'),
    ladder('復用咗 {count} 個替換')
  ),
  'vocabulary.notify.removed': entry(
    ladder('{count} replacements removed from the loaded copy'),
    ladder('喺已載入嗰份移除咗 {count} 個替換')
  ),
  'vocabulary.notify.applyFailed': entry(
    ladder('The change was not applied'),
    ladder('改動套用唔到')
  ),
  'vocabulary.notify.cacheDropped': entry(
    ladder('The cached vocabulary was dropped'),
    ladder('快取嘅詞彙已經丟棄')
  ),
  'vocabulary.notify.cacheDropped.body': entry(
    ladder(
      'The stored copy no longer passes validation, so the original wording is in use again. Load your file to restore it.',
      'The stored copy stopped passing validation, so the original wording is back. Load your file again to restore it.'
    ),
    ladder(
      '存低嗰份而家過唔到檢查，所以又用返原本嘅字眼。載入返你個檔就得。',
      '存低嗰份過唔到檢查，所以又返咗做原本字眼。載入返你個檔就搞掂。'
    )
  ),

  /* ---------------- options ---------------- */

  'vocabulary.setting.showEntries': entry(
    ladder('Show the loaded replacements'),
    ladder('顯示已載入嘅替換')
  ),
  'vocabulary.setting.showEntries.description': entry(
    ladder(
      'Whether this destination lists your replacement terms on screen. Turning it off keeps them working and shows only a count, which is useful when somebody else can see the screen.',
      'Whether this destination puts your replacement terms on screen. Turn it off and they keep working while only a count shows, which is handy when the screen is not just yours.'
    ),
    ladder(
      '呢個頁面會唔會喺畫面列出你嘅替換字眼。閂咗佢，啲替換照樣運作，淨係顯示數量——旁邊有人望住個畫面嗰陣好用。',
      '呢頁會唔會喺畫面攤開你嘅字眼。閂咗都照做嘢，淨係顯示個數——隔籬有人望住個芒嗰陣好使。'
    )
  ),
  'vocabulary.setting.pageSize': entry(ladder('Replacements per page'), ladder('每版顯示幾多個替換')),
  'vocabulary.setting.pageSize.description': entry(
    ladder(
      'How many rows the list renders at once. A page is what "select the page" selects, so this number decides that scope too.',
      'How many rows the list draws at once. A page is exactly what "select the page" selects, so this number sets that scope as well.'
    ),
    ladder(
      '個清單一次過畫幾多行。「揀晒呢一版」揀嘅就係一版，所以呢個數亦都決定咗嗰個範圍。',
      '個清單一次過畫幾多行。「揀晒呢一版」揀嘅正正就係一版，所以呢個數順便定咗嗰個範圍。'
    )
  ),
  'vocabulary.setting.sample': entry(ladder('Sample text'), ladder('測試字句')),
  'vocabulary.setting.sample.description': entry(
    ladder(
      'The text the preview starts with. It is stored on this computer with the rest of this destination\'s options.',
      'The text the preview opens with. It is kept on this computer along with this destination\'s other options.'
    ),
    ladder(
      '預覽一開始用嘅字句。同呢頁其他選項一齊存喺呢部電腦。',
      '預覽開頭嗰段字。同呢頁其他選項一齊擺喺呢部電腦。'
    )
  ),

  /* ---------------- schema reference ---------------- */

  'vocabulary.schema.show': entry(ladder('Show the file format'), ladder('顯示檔案格式')),
  'vocabulary.schema.hide': entry(ladder('Hide the file format'), ladder('收埋檔案格式')),
  'vocabulary.schema.intro': entry(
    ladder(
      'A vocabulary file is a JSON object with exactly two fields: "version", a whole number, and "replacements", an object whose members are all text. Any other field is refused.',
      'A vocabulary file is a JSON object with exactly two fields — "version", a whole number, and "replacements", an object whose members are all text. Anything else in there and the file is refused.'
    ),
    ladder(
      '詞彙檔案係一個 JSON 物件，剛好兩個欄位："version" 係整數，"replacements" 係一個成員全部係文字嘅物件。其他欄位一律唔收。',
      '詞彙檔案係一個 JSON 物件，剛剛好兩個欄位："version" 整數，"replacements" 入面成員全部要文字。多咗第樣就唔收。'
    )
  ),
  'vocabulary.schema.example': entry(
    ladder(
      'A blank file in this format. It is the whole shape, with no replacements in it — this application ships no vocabulary of its own.',
      'A blank file in this format: the whole shape, nothing inside it. This application ships no vocabulary of its own and this is not one.'
    ),
    ladder(
      '呢個格式嘅空白檔。個樣完整，入面一個替換都冇——呢個程式本身冇夾帶任何詞彙。',
      '呢個格式嘅空白檔：個殼齊晒，入面乜都冇。程式本身冇夾帶詞彙，呢個亦都唔係。'
    )
  ),
  'vocabulary.schema.limits': entry(
    ladder(
      'Limits: at most {bytes} bytes, at most {entries} replacements, keys of 1 to {keyLength} characters, values of at most {valueLength} characters, nesting at most {depth} levels deep. Duplicate member names, reserved object keys, unknown fields and non-text values are all refused.'
    ),
    ladder(
      '上限：最多 {bytes} bytes、最多 {entries} 個替換、key 1 至 {keyLength} 個字元、value 最多 {valueLength} 個字元、最多 {depth} 層巢狀。重複成員名、保留字 key、未知欄位、非文字 value 一律唔收。'
    )
  ),
  'vocabulary.schema.partial': entry(
    ladder(
      'A file that breaks any rule is refused whole. There is no partial load: the replacements you already had stay exactly as they were.',
      'Break one rule and the whole file is refused. There is no half-load — whatever you already had stays exactly as it was.'
    ),
    ladder(
      '有一條規則唔啱，成個檔都唔收。冇「部分載入」呢回事：你原本嗰啲替換一個字都唔會變。',
      '踩親一條規則，成個檔照樣唔收。冇得載一半——你本身嗰啲原封不動。'
    )
  ),

  /* ---------------- privacy ---------------- */

  'vocabulary.privacy.body': entry(
    ladder(
      'Nothing. Your file is read on this computer, validated on this computer, and cached on this computer. No network request is made by this feature at any point. Your replacement terms, the file\'s name and its location never appear in a log, an export, a version-history entry, a crash report, a screenshot taken by this application, or any other record — and the exports and history views say so where the data would have been.',
      'Nothing at all. Your file is read here, checked here, and cached here. This feature makes no network request at any point, ever. Your terms, the file\'s name and where it lives never turn up in a log, an export, a history entry, a crash report or any other record — and the exports and history views say so plainly where the data would have been.'
    ),
    ladder(
      '冇。你個檔喺呢部電腦讀、喺呢部電腦檢查、喺呢部電腦快取。呢個功能任何時候都唔會發網絡請求。你嘅替換字眼、個檔嘅名同位置，永遠唔會出現喺日誌、匯出、版本紀錄、當機報告、程式截圖或者任何紀錄——匯出同紀錄畫面亦會喺應該有資料嗰度講明白。',
      '一樣都冇。你個檔喺呢部機讀、喺呢部機檢查、喺呢部機快取。呢個功能任何時候都唔會出網。你啲字眼、個檔名、擺喺邊，永遠唔會走入日誌、匯出、版本紀錄、當機報告或者任何紀錄——匯出同紀錄畫面仲會喺本應有資料嗰個位講明。'
    )
  ),

  /* ---------------- palette ---------------- */

  'vocabulary.palette.open': entry(
    ladder('Open the personal vocabulary'),
    ladder('打開個人詞彙')
  ),
  'vocabulary.palette.choose': entry(
    ladder('Load a personal vocabulary file'),
    ladder('載入個人詞彙檔案')
  ),
  'vocabulary.palette.clear': entry(
    ladder('Clear the personal vocabulary'),
    ladder('清走個人詞彙')
  ),
  'vocabulary.palette.template': entry(
    ladder('Save a blank personal vocabulary template'),
    ladder('存一個空白個人詞彙範本')
  ),
  'vocabulary.palette.preview': entry(
    ladder('Try the personal vocabulary on some text'),
    ladder('試吓個人詞彙嘅效果')
  ),
  'vocabulary.palette.schema': entry(
    ladder('Personal vocabulary file format'),
    ladder('個人詞彙檔案格式')
  )
};
