import type { Catalogue, FunnyLadder, TranslationEntry } from '../../core/registry';

/**
 * Every string this feature renders.
 *
 * Humour styles the voice and never the facts. A format name, a field name, a
 * byte count, a file path, a command line and an encryption warning read the
 * same at level 1 and at level 5 — only the sentence around them changes.
 */

function ladder(...steps: string[]): FunnyLadder {
  if (steps.length === 1) return [steps[0], steps[0], steps[0], steps[0], steps[0]];
  if (steps.length === 2) return [steps[0], steps[0], steps[0], steps[1], steps[1]];
  if (steps.length === 3) return [steps[0], steps[0], steps[1], steps[2], steps[2]];
  if (steps.length === 5) return [steps[0], steps[1], steps[2], steps[3], steps[4]];
  throw new Error(`A ladder takes 1, 2, 3 or 5 strings; ${steps.length} were given.`);
}

function entry(en: FunnyLadder, yue: FunnyLadder): TranslationEntry {
  return { en, yue };
}

export const EXPORT_STRINGS: Catalogue = {
  /* ---------------- chrome ---------------- */

  'export.tab.title': entry(ladder('Export'), ladder('匯出')),
  'export.title': entry(
    ladder('Export anything', 'Export anything', 'Take anything away with you', 'Take literally anything away with you', 'Take literally anything away with you'),
    ladder('乜都可以匯出', '乜都可以匯出', '想攞咩走都得', '真係乜都攞得走，唔講笑', '真係乜都攞得走，唔講笑')
  ),
  'export.lede': entry(
    ladder(
      'Every record, list, log, document, setting and generated artifact this application owns can be written to a file.',
      'Every record, list, log, document, setting and generated artifact this application owns can be written to a file.',
      'If a surface can show it, you can take it away. Every record, list, log, document, setting and generated artifact is here.',
      'If a screen can show it to you, you can walk off with it. Records, lists, logs, documents, settings, generated artifacts — the lot.',
      'If a screen can show it to you, you can walk off with it. Records, lists, logs, documents, settings, generated artifacts — the lot.'
    ),
    ladder(
      '呢個程式擁有嘅每一筆記錄、清單、日誌、文件、設定同產生出嚟嘅檔案，都可以寫成檔案。',
      '呢個程式擁有嘅每一筆記錄、清單、日誌、文件、設定同產生出嚟嘅檔案，都可以寫成檔案。',
      '畫面見到嘅嘢，你都攞得走。記錄、清單、日誌、文件、設定，樣樣都喺度。',
      '畫面見到嘅嘢，你就攞得走佢。記錄、清單、日誌、文件、設定、產生出嚟嘅嘢，一件都唔留低。',
      '畫面見到嘅嘢，你就攞得走佢。記錄、清單、日誌、文件、設定、產生出嚟嘅嘢，一件都唔留低。'
    )
  ),

  /* ---------------- sources ---------------- */

  'export.section.sources': entry(ladder('What you can take away'), ladder('可以攞走嘅嘢')),
  'export.section.sources.desc': entry(
    ladder(
      'One row per exportable thing. Each row chooses its own format, because tabular data belongs in CSV and structured records do not.',
      'One row per exportable thing. Each row chooses its own format, because tabular data belongs in CSV and structured records do not.',
      'One row per exportable thing, each with its own format. Tabular data belongs in CSV; nested records do not, and pretending otherwise loses fields.',
      'One row per exportable thing, each picking its own format. Tables want CSV. Nested records really do not, and squashing them flat is how a field quietly disappears.',
      'One row per exportable thing, each picking its own format. Tables want CSV. Nested records really do not, and squashing them flat is how a field quietly disappears.'
    ),
    ladder(
      '每樣可以匯出嘅嘢一行，每行揀自己嘅格式，因為表格數據啱用 CSV，有巢狀結構嘅記錄就唔啱。',
      '每樣可以匯出嘅嘢一行，每行揀自己嘅格式，因為表格數據啱用 CSV，有巢狀結構嘅記錄就唔啱。',
      '每樣嘢一行，各自揀格式。表格數據啱 CSV；巢狀記錄唔啱，硬要壓平就會靜雞雞唔見咗欄位。',
      '每樣嘢一行，各自揀格式。表格數據就 CSV 啦。巢狀記錄真係唔得，夾硬壓平係欄位人間蒸發嘅開始。',
      '每樣嘢一行，各自揀格式。表格數據就 CSV 啦。巢狀記錄真係唔得，夾硬壓平係欄位人間蒸發嘅開始。'
    )
  ),
  'export.search.label': entry(ladder('Search the exportable things'), ladder('搵可以匯出嘅嘢')),
  'export.search.placeholder': entry(ladder('Search by name, category or format…'), ladder('用名、分類或者格式搵…')),
  'export.sources.empty': entry(
    ladder('No source matched that search.'),
    ladder('冇嘢啱呢個搜尋。')
  ),
  'export.sources.none': entry(
    ladder('Nothing has registered itself as exportable yet.'),
    ladder('暫時未有嘢登記自己可以匯出。')
  ),
  'export.sources.noneBody': entry(
    ladder(
      'Every feature registers its own exportable sources. Reopen this tab after another feature has started, or use Refresh below.',
      'Every feature registers its own exportable sources. Reopen this tab after another feature has started, or use Refresh below.',
      'Features register their own sources. Reopen this tab once another feature has started, or press Refresh.',
      'Features hand in their own sources. Reopen this tab once something else has woken up, or just press Refresh and see who turns up.',
      'Features hand in their own sources. Reopen this tab once something else has woken up, or just press Refresh and see who turns up.'
    ),
    ladder(
      '每個功能自己登記可以匯出嘅嚟源。等其他功能啟動咗之後再開返呢版，或者撳下面嘅重新整理。',
      '每個功能自己登記可以匯出嘅嚟源。等其他功能啟動咗之後再開返呢版，或者撳下面嘅重新整理。',
      '功能自己交嚟源上嚟。等第二個功能起身之後再開返呢版，或者撳重新整理。',
      '功能自己交嚟源上嚟嘅。等第二個功能瞓醒再開返呢版，或者撳重新整理睇下邊個到咗。',
      '功能自己交嚟源上嚟嘅。等第二個功能瞓醒再開返呢版，或者撳重新整理睇下邊個到咗。'
    )
  ),
  'export.action.refresh': entry(ladder('Refresh the list'), ladder('重新整理清單')),

  'export.row.records': entry(ladder('{count} records'), ladder('{count} 筆記錄')),
  'export.row.document': entry(ladder('A document'), ladder('一份文件')),
  'export.row.counting': entry(ladder('Counting…'), ladder('數緊…')),
  'export.row.format': entry(ladder('Format'), ladder('格式')),
  'export.row.omits': entry(ladder('Omitted: {what}'), ladder('冇包含：{what}')),
  'export.row.preview': entry(ladder('Preview'), ladder('預覽')),
  'export.row.exportOne': entry(ladder('Export this one…'), ladder('淨係匯出呢樣…')),
  'export.row.select': entry(ladder('Select {name}'), ladder('揀 {name}')),
  'export.row.failed': entry(ladder('This source could not be read: {reason}'), ladder('讀唔到呢個嚟源：{reason}')),

  /* ---------------- selection ---------------- */

  'export.select.count': entry(ladder('{selected} selected of {shown} shown, {total} in total'), ladder('揀咗 {selected} 個，顯示緊 {shown} 個，總共 {total} 個')),
  'export.select.allShown': entry(ladder('Select the {count} shown'), ladder('揀晒顯示緊嘅 {count} 個')),
  'export.select.allSources': entry(ladder('Select every source ({count})'), ladder('揀晒全部 {count} 個嚟源')),
  'export.select.invert': entry(ladder('Invert the selection'), ladder('反轉揀咗嘅嘢')),
  'export.select.clear': entry(ladder('Clear the selection'), ladder('唔揀住')),
  'export.select.keyboardHint': entry(
    ladder('Space toggles a row. Shift and Space extends the selection from the last row you touched.'),
    ladder('空白鍵揀／唔揀一行。Shift 加空白鍵由上次撳嗰行一路揀落嚟。')
  ),

  /* ---------------- format and encoding ---------------- */

  'export.section.format': entry(ladder('How the file is written'), ladder('檔案點樣寫')),
  'export.section.format.desc': entry(
    ladder(
      'The encoding, the line endings and the schema version are written into every file, so it is readable by something other than this application.',
      'The encoding, the line endings and the schema version are written into every file, so it is readable by something other than this application.',
      'Encoding, line endings and schema version go into the file itself, so anything else can read it without guessing.',
      'Encoding, line endings and schema version get written into the file itself, so the next program along does not have to guess what it is holding.',
      'Encoding, line endings and schema version get written into the file itself, so the next program along does not have to guess what it is holding.'
    ),
    ladder(
      '編碼、換行符同結構版本都會寫入每個檔案，令佢唔靠呢個程式都讀得明。',
      '編碼、換行符同結構版本都會寫入每個檔案，令佢唔靠呢個程式都讀得明。',
      '編碼、換行符、結構版本都寫落檔案入面，第二個程式唔使估都讀得明。',
      '編碼、換行符、結構版本統統寫落檔案入面，唔使下一個程式攞住個檔案喺度估佢係乜。',
      '編碼、換行符、結構版本統統寫落檔案入面，唔使下一個程式攞住個檔案喺度估佢係乜。'
    )
  ),
  'export.encoding.statement': entry(
    ladder('UTF-8, {eol} line endings, schema version {version}.'),
    ladder('UTF-8，{eol} 換行符，結構版本 {version}。')
  ),
  'export.encoding.bomOn': entry(
    ladder('A UTF-8 byte-order mark is written at the start of every file.'),
    ladder('每個檔案開頭會寫一個 UTF-8 位元組順序標記。')
  ),
  'export.encoding.bomOff': entry(
    ladder('No byte-order mark is written.'),
    ladder('唔會寫位元組順序標記。')
  ),

  'export.preflight.title': entry(ladder('What this format cannot carry'), ladder('呢個格式載唔起嘅嘢')),
  'export.preflight.clean': entry(
    ladder('Nothing is lost: this format carries every field faithfully.'),
    ladder('冇嘢會唔見：呢個格式每個欄位都原原本本載得起。')
  ),
  'export.preflight.lossy': entry(
    ladder('{count} fields cannot be carried faithfully. They are listed before anything is written.'),
    ladder('有 {count} 個欄位載唔到原樣。寫檔案之前會逐個列出嚟。')
  ),
  'export.preflight.schemaOnly': entry(
    ladder('This is a schema. It describes the shape of the records and contains none of them.'),
    ladder('呢個係結構描述，只係講記錄嘅形狀，一筆記錄都冇。')
  ),

  /* ---------------- destination and running ---------------- */

  'export.section.run': entry(ladder('Write the files'), ladder('寫檔案')),
  'export.destination': entry(ladder('Destination folder'), ladder('目的地資料夾')),
  'export.destination.hint': entry(
    ladder('Each selected source is written as its own file inside this folder.'),
    ladder('每樣揀咗嘅嘢，都會喺呢個資料夾入面寫成一個檔案。')
  ),
  'export.destination.unset': entry(
    ladder('No folder chosen yet. Browse for one, or the export will ask for it.'),
    ladder('未揀資料夾。撳去揀一個，唔係匯出嗰陣會問你。')
  ),
  'export.run.selected': entry(ladder('Export the {count} selected…'), ladder('匯出揀咗嘅 {count} 樣…')),
  'export.run.nothingSelected': entry(
    ladder('Select at least one source first.'),
    ladder('最少要揀一樣嘢先。')
  ),
  'export.run.preview.title': entry(ladder('This is what will be written'), ladder('將會寫低嘅嘢')),
  'export.run.preview.body': entry(
    ladder('{count} files into {folder}. Existing files with the same name are replaced.'),
    ladder('{count} 個檔案寫入 {folder}。同名嘅舊檔案會被取代。')
  ),
  'export.run.progress': entry(ladder('Exported {done} of {total}: {current}'), ladder('已匯出 {done}／{total}：{current}')),
  'export.run.cancel': entry(ladder('Cancel the export'), ladder('取消匯出')),
  'export.run.cancelled': entry(
    ladder('Cancelled after {written} of {total} files. The files already written are complete and were left in place.'),
    ladder('寫咗 {written}／{total} 個檔案之後取消咗。已經寫好嗰啲係完整嘅，冇郁過。')
  ),
  'export.run.finished': entry(ladder('{written} written, {skipped} skipped, {failed} failed'), ladder('寫咗 {written} 個，跳過 {skipped} 個，失敗 {failed} 個')),
  'export.run.wroteOne': entry(ladder('Wrote {path}'), ladder('寫咗 {path}')),

  'export.section.results': entry(ladder('What was written'), ladder('寫低咗啲乜')),
  'export.results.empty': entry(
    ladder('Nothing has been exported in this session yet.'),
    ladder('今次開機仲未匯出過嘢。')
  ),
  'export.results.emptyBody': entry(
    ladder('Choose a source above and the file will appear here with the route to open it.'),
    ladder('喺上面揀樣嘢，寫好之後就會喺呢度出現，仲有得直接打開。')
  ),
  'export.result.written': entry(ladder('Written'), ladder('寫咗')),
  'export.result.failed': entry(ladder('Failed'), ladder('失敗')),
  'export.result.skipped': entry(ladder('Skipped'), ladder('跳過咗')),
  'export.result.cancelled': entry(ladder('Cancelled'), ladder('取消咗')),
  'export.result.openFolder': entry(ladder('Show in the file manager'), ladder('喺檔案總管度睇')),
  'export.result.copy': entry(ladder('Copy the contents'), ladder('複製內容')),
  'export.result.copied': entry(ladder('Copied {name} to the clipboard.'), ladder('已經複製咗 {name} 去剪貼簿。')),
  'export.results.select': entry(ladder('Select the export of {name}'), ladder('揀 {name} 嘅匯出結果')),
  'export.results.selected': entry(ladder('{selected} of {total} results selected'), ladder('揀咗 {total} 個結果入面嘅 {selected} 個')),
  'export.results.bulk.openEditor': entry(ladder('Open the {count} selected in Visual Studio Code'), ladder('用 Visual Studio Code 打開揀咗嘅 {count} 個')),
  'export.results.bulk.copyPaths': entry(ladder('Copy the {count} selected paths'), ladder('複製揀咗嘅 {count} 條路徑')),
  'export.results.bulk.remove': entry(ladder('Remove the {count} selected from this list'), ladder('喺呢個清單度移走揀咗嘅 {count} 個')),
  'export.results.bulk.note': entry(
    ladder('Removing an entry from this list does not delete the file it names. The file stays exactly where it was written.'),
    ladder('喺清單度移走一項唔會刪除佢指嘅檔案。檔案照樣留喺原本寫低嗰度。')
  ),
  'export.results.bulk.removed': entry(ladder('Removed {count} entries from the list. No file was deleted.'), ladder('喺清單度移走咗 {count} 項，冇刪過任何檔案。')),
  'export.results.bulk.noneSelected': entry(ladder('Select at least one result first.'), ladder('最少要揀一個結果先。')),
  'export.results.bulk.noPaths': entry(
    ladder('None of the selected results has a file: they failed, were skipped or were cancelled.'),
    ladder('揀咗嘅結果全部冇檔案：唔係失敗、就係跳過咗或者取消咗。')
  ),

  /* ---------------- Visual Studio Code ---------------- */

  'export.vscode.title': entry(ladder('Visual Studio Code'), ladder('Visual Studio Code')),
  'export.vscode.desc': entry(
    ladder(
      'Every export can be opened in Visual Studio Code from here or from the row it came from. Opening a folder opens it as a workspace root, so the file tree is usable.',
      'Every export can be opened in Visual Studio Code from here or from the row it came from. Opening a folder opens it as a workspace root, so the file tree is usable.',
      'Every export opens in Visual Studio Code from here or from its own row. A folder opens as a workspace root, so you get the file tree rather than one lonely file.',
      'Every export opens in Visual Studio Code, either from here or from its own row. Folders open as a workspace root, so you get the whole tree instead of one lonely file with no context.',
      'Every export opens in Visual Studio Code, either from here or from its own row. Folders open as a workspace root, so you get the whole tree instead of one lonely file with no context.'
    ),
    ladder(
      '每個匯出都可以喺呢度或者原本嗰行用 Visual Studio Code 打開。打開資料夾會當成工作區根目錄，個檔案樹先至用得着。',
      '每個匯出都可以喺呢度或者原本嗰行用 Visual Studio Code 打開。打開資料夾會當成工作區根目錄，個檔案樹先至用得着。',
      '每個匯出都可以喺呢度或者佢自己嗰行用 Visual Studio Code 打開。資料夾會當成工作區根目錄，唔係得個孤伶伶嘅檔案。',
      '每個匯出都可以喺呢度或者佢自己嗰行用 Visual Studio Code 打開。資料夾會當成工作區根目錄，唔會淨係開個孤伶伶又冇上文下理嘅檔案。',
      '每個匯出都可以喺呢度或者佢自己嗰行用 Visual Studio Code 打開。資料夾會當成工作區根目錄，唔會淨係開個孤伶伶又冇上文下理嘅檔案。'
    )
  ),
  'export.vscode.found': entry(ladder('{name} was found at {path}.'), ladder('喺 {path} 搵到 {name}。')),
  'export.vscode.missing': entry(
    ladder('Visual Studio Code was not found on this computer.'),
    ladder('喺呢部電腦搵唔到 Visual Studio Code。')
  ),
  'export.vscode.missingBody': entry(
    ladder(
      'The `code` command is not on PATH and none of the usual per-user, machine, Insiders or portable install paths exist. Nothing else will be opened in its place.',
      'The `code` command is not on PATH and none of the usual per-user, machine, Insiders or portable install paths exist. Nothing else will be opened in its place.',
      'There is no `code` on PATH and none of the usual install paths exist, Insiders and portable included. No other editor will be opened in its place.',
      'No `code` on PATH, and none of the usual install paths exist either — per-user, machine-wide, Insiders, portable, all absent. No stand-in editor will be opened behind your back.',
      'No `code` on PATH, and none of the usual install paths exist either — per-user, machine-wide, Insiders, portable, all absent. No stand-in editor will be opened behind your back.'
    ),
    ladder(
      'PATH 上面冇 `code` 指令，常見嘅個人、全機、Insiders 同免安裝版路徑都冇。唔會用第二個編輯器頂上。',
      'PATH 上面冇 `code` 指令，常見嘅個人、全機、Insiders 同免安裝版路徑都冇。唔會用第二個編輯器頂上。',
      'PATH 冇 `code`，常見安裝路徑（連 Insiders 同免安裝版）都冇。唔會靜雞雞用第二個編輯器代替。',
      'PATH 冇 `code`，常見安裝路徑一個都冇，個人版、全機版、Insiders、免安裝版通通失蹤。唔會喺你背後搵第二個編輯器頂上。',
      'PATH 冇 `code`，常見安裝路徑一個都冇，個人版、全機版、Insiders、免安裝版通通失蹤。唔會喺你背後搵第二個編輯器頂上。'
    )
  ),
  'export.vscode.download': entry(ladder('Open the download page'), ladder('打開下載頁')),
  'export.vscode.recheck': entry(ladder('Look again'), ladder('再搵一次')),
  'export.vscode.openFile': entry(ladder('Open in Visual Studio Code'), ladder('用 Visual Studio Code 打開')),
  'export.vscode.openFolder': entry(ladder('Open the folder in Visual Studio Code'), ladder('用 Visual Studio Code 打開資料夾')),
  'export.vscode.editor': entry(ladder('Editor to open exports in'), ladder('用邊個編輯器開匯出檔案')),
  'export.vscode.opened': entry(ladder('Asked Visual Studio Code to open {path}.'), ladder('已經叫 Visual Studio Code 打開 {path}。')),
  'export.vscode.failed': entry(ladder('Visual Studio Code did not open it: {reason}'), ladder('Visual Studio Code 打唔開：{reason}')),

  /* ---------------- archives ---------------- */

  'export.section.archive': entry(ladder('Archives'), ladder('壓縮檔')),
  'export.archive.desc': entry(
    ladder(
      'Bundle the selected exports into one ZIP or 7z file. Every entry is stored at a relative path, so extracting it can never write outside the folder you extract into.',
      'Bundle the selected exports into one ZIP or 7z file. Every entry is stored at a relative path, so extracting it can never write outside the folder you extract into.',
      'Bundle the selected exports into one ZIP or 7z. Entries are stored at relative paths, so extraction can never escape the folder you extract into.',
      'Bundle the selected exports into one ZIP or 7z. Entries are stored at relative paths only, so an extraction can never wander off and write somewhere you did not point it at.',
      'Bundle the selected exports into one ZIP or 7z. Entries are stored at relative paths only, so an extraction can never wander off and write somewhere you did not point it at.'
    ),
    ladder(
      '將揀咗嘅匯出檔案裝埋成一個 ZIP 或者 7z。每個項目都用相對路徑存放，解壓嗰陣寫唔出你解壓嗰個資料夾以外。',
      '將揀咗嘅匯出檔案裝埋成一個 ZIP 或者 7z。每個項目都用相對路徑存放，解壓嗰陣寫唔出你解壓嗰個資料夾以外。',
      '將揀咗嘅匯出裝埋一個 ZIP 或者 7z。項目全部用相對路徑，解壓走唔出你指定嗰個資料夾。',
      '將揀咗嘅匯出裝埋一個 ZIP 或者 7z。項目淨係用相對路徑，解壓時走唔出你指定嗰個資料夾，唔會周圍亂寫。',
      '將揀咗嘅匯出裝埋一個 ZIP 或者 7z。項目淨係用相對路徑，解壓時走唔出你指定嗰個資料夾，唔會周圍亂寫。'
    )
  ),
  'export.archive.format': entry(ladder('Archive format'), ladder('壓縮格式')),
  'export.archive.method': entry(ladder('Compression method'), ladder('壓縮方法')),
  'export.archive.level': entry(ladder('Compression level'), ladder('壓縮程度')),
  'export.archive.dictionary': entry(ladder('Dictionary size'), ladder('字典大細')),
  'export.archive.wordSize': entry(ladder('Word size'), ladder('字長')),
  'export.archive.solid': entry(ladder('Solid archive'), ladder('連續壓縮')),
  'export.archive.solidBlock': entry(ladder('Solid block size'), ladder('連續區塊大細')),
  'export.archive.threads': entry(ladder('Threads'), ladder('執行緒')),
  'export.archive.volume': entry(ladder('Split into volumes'), ladder('分割成多個檔案')),
  'export.archive.encryption': entry(ladder('Encryption'), ladder('加密')),
  'export.archive.password': entry(ladder('Archive password'), ladder('壓縮檔密碼')),
  'export.archive.encryptHeaders': entry(ladder('Encrypt the file names too'), ladder('連檔案名都加密')),
  'export.archive.name': entry(ladder('Archive file name'), ladder('壓縮檔名')),

  'export.archive.headers.on': entry(
    ladder('The file names inside are encrypted as well. Opening the archive asks for the password before it will list anything.'),
    ladder('入面嘅檔案名都會加密。要輸入密碼先至列到入面有咩。')
  ),
  'export.archive.headers.off': entry(
    ladder('The contents are encrypted but the file names inside are NOT. Anyone can list them without the password.'),
    ladder('內容加咗密，但係入面嘅檔案名冇。唔使密碼都列得晒出嚟。')
  ),
  'export.archive.headers.zip': entry(
    ladder('ZIP cannot encrypt file names. Even with AES-256 the names inside stay readable to anyone. Choose 7z if the names must be hidden.'),
    ladder('ZIP 加密唔到檔案名。就算用咗 AES-256，入面啲名一樣人人睇到。要收埋啲名就要揀 7z。')
  ),
  'export.archive.encryption.none': entry(
    ladder('No encryption. The archive can be opened by anybody.'),
    ladder('冇加密，人人開得。')
  ),
  'export.archive.password.note': entry(
    ladder(
      'The password is handed to the archiver on its command line and is never stored, logged, exported or recorded in history. On a shared machine another process could read that command line while the archive is being written.',
      'The password is handed to the archiver on its command line and is never stored, logged, exported or recorded in history. On a shared machine another process could read that command line while the archive is being written.',
      'The password goes to the archiver on its command line. It is never stored, logged, exported or put in history — but on a shared machine another process could read that command line while the archive is being written.',
      'The password goes to the archiver on its command line. It is never stored, logged, exported or written to history — but on a shared machine another process could read that command line while the archive is being written, and pretending otherwise would be a lie.',
      'The password goes to the archiver on its command line. It is never stored, logged, exported or written to history — but on a shared machine another process could read that command line while the archive is being written, and pretending otherwise would be a lie.'
    ),
    ladder(
      '密碼會經指令列交俾壓縮程式，唔會儲存、寫入日誌、匯出或者記入歷史。喺共用電腦上面，寫緊壓縮檔嗰陣其他程序有機會睇到條指令列。',
      '密碼會經指令列交俾壓縮程式，唔會儲存、寫入日誌、匯出或者記入歷史。喺共用電腦上面，寫緊壓縮檔嗰陣其他程序有機會睇到條指令列。',
      '密碼經指令列交俾壓縮程式。唔會儲存、唔會寫日誌、唔會匯出、唔會入歷史 —— 但喺共用電腦上面，寫緊壓縮檔嗰陣其他程序有機會睇到條指令列。',
      '密碼經指令列交俾壓縮程式。唔會儲存、唔會寫日誌、唔會匯出、唔會入歷史 —— 但喺共用電腦上面，寫緊壓縮檔嗰陣其他程序真係有機會睇到條指令列，講第二樣就係呃你。',
      '密碼經指令列交俾壓縮程式。唔會儲存、唔會寫日誌、唔會匯出、唔會入歷史 —— 但喺共用電腦上面，寫緊壓縮檔嗰陣其他程序真係有機會睇到條指令列，講第二樣就係呃你。'
    )
  ),
  'export.archive.password.missing': entry(
    ladder('Encryption is selected but no password was entered, so nothing was written.'),
    ladder('揀咗加密但係冇入密碼，所以乜都冇寫。')
  ),
  'export.archive.secrets': entry(
    ladder('No credential, token or vault secret is ever placed in an archive by this surface. Only the sources listed above go in.'),
    ladder('呢度絕對唔會將任何憑證、權杖或者保險庫秘密放入壓縮檔。淨係上面列出嗰啲嚟源會入去。')
  ),

  'export.archive.contents': entry(ladder('What goes inside'), ladder('入面裝乜')),
  'export.archive.contents.count': entry(ladder('{count} entries, all at relative paths under {root}/'), ladder('{count} 個項目，全部係 {root}/ 下面嘅相對路徑')),
  'export.archive.command': entry(ladder('The command that will run'), ladder('將會執行嘅指令')),
  'export.archive.command.redacted': entry(
    ladder('The password is shown as ******** here and is never written to the screen, a log or the history.'),
    ladder('密碼喺呢度顯示做 ********，唔會出現喺畫面、日誌或者歷史度。')
  ),
  'export.archive.copyCommand': entry(ladder('Copy the command'), ladder('複製指令')),
  'export.archive.create': entry(ladder('Create the archive…'), ladder('整壓縮檔…')),
  'export.archive.creating': entry(ladder('Creating the archive…'), ladder('整緊壓縮檔…')),
  'export.archive.created': entry(ladder('Created {path}'), ladder('整好咗 {path}')),
  'export.archive.failed': entry(ladder('The archiver failed: {reason}'), ladder('壓縮程式失敗咗：{reason}')),

  'export.archive.probe.checking': entry(ladder('Looking for an archiver…'), ladder('搵緊壓縮程式…')),
  'export.archive.probe.available': entry(ladder('{command} answered and will be used.'), ladder('{command} 有回應，就用佢。')),
  'export.archive.probe.unavailable': entry(
    ladder('No archiver can be started from here.'),
    ladder('喺呢度啟動唔到任何壓縮程式。')
  ),
  'export.archive.probe.reason': entry(
    ladder('The privileged bridge refused every archiver command that was tried. It reported: {reason}'),
    ladder('特權橋接拒絕咗試過嘅每一個壓縮指令。佢話：{reason}')
  ),
  'export.archive.probe.tried': entry(ladder('Tried: {commands}'), ladder('試過：{commands}')),
  'export.archive.fallback.title': entry(ladder('Write the archive contents as a folder instead'), ladder('改為將壓縮檔內容寫成資料夾')),
  'export.archive.fallback.body': entry(
    ladder(
      'The same entries, at the same relative paths, written into a folder with a manifest naming everything inside. Archive it yourself with the command above, or open the folder in Visual Studio Code.',
      'The same entries, at the same relative paths, written into a folder with a manifest naming everything inside. Archive it yourself with the command above, or open the folder in Visual Studio Code.',
      'The same entries at the same relative paths, in a folder, with a manifest naming everything inside. Archive it yourself with the command above, or open the folder in Visual Studio Code.',
      'Exactly the same entries at exactly the same relative paths, in a plain folder, with a manifest naming everything inside. Run the command above on it yourself, or open the folder in Visual Studio Code.',
      'Exactly the same entries at exactly the same relative paths, in a plain folder, with a manifest naming everything inside. Run the command above on it yourself, or open the folder in Visual Studio Code.'
    ),
    ladder(
      '一模一樣嘅項目、一模一樣嘅相對路徑，寫入一個資料夾，仲有份清單列明入面有咩。你可以自己用上面條指令壓縮，或者用 Visual Studio Code 打開個資料夾。',
      '一模一樣嘅項目、一模一樣嘅相對路徑，寫入一個資料夾，仲有份清單列明入面有咩。你可以自己用上面條指令壓縮，或者用 Visual Studio Code 打開個資料夾。',
      '一樣嘅項目、一樣嘅相對路徑，寫落一個資料夾，附埋份清單講明入面有咩。自己用上面條指令壓縮，或者用 Visual Studio Code 打開佢。',
      '一模一樣嘅項目、一模一樣嘅相對路徑，寫落一個普通資料夾，仲附埋份清單講明入面有咩。你自己攞上面條指令去壓縮，或者用 Visual Studio Code 打開佢。',
      '一模一樣嘅項目、一模一樣嘅相對路徑，寫落一個普通資料夾，仲附埋份清單講明入面有咩。你自己攞上面條指令去壓縮，或者用 Visual Studio Code 打開佢。'
    )
  ),
  'export.archive.fallback.action': entry(ladder('Write the folder…'), ladder('寫個資料夾出嚟…')),
  'export.archive.fallback.done': entry(ladder('Wrote {count} entries into {path}'), ladder('將 {count} 個項目寫咗入 {path}')),
  'export.archive.cost': entry(ladder('Cost'), ladder('代價')),

  /* ---------------- settings ---------------- */

  'export.settings.title': entry(ladder('Export and archives'), ladder('匯出同壓縮檔')),
  'export.setting.format.label': entry(ladder('Default format'), ladder('預設格式')),
  'export.setting.format.desc': entry(
    ladder('The format a source starts on before you change it. A source whose shape cannot use this format starts on the closest one that can.'),
    ladder('每個嚟源未改之前用嘅格式。如果佢嘅形狀用唔到呢個格式，就會用最接近而又用得嘅嗰個。')
  ),
  'export.setting.eol.label': entry(ladder('Line endings'), ladder('換行符')),
  'export.setting.eol.desc': entry(
    ladder('LF is what most tools expect. CRLF is what Windows Notepad and some spreadsheet importers expect. The choice is written into the file header.'),
    ladder('大部分工具預期 LF。Windows 記事本同某啲試算表匯入器預期 CRLF。你揀邊個都會寫落檔案標頭。')
  ),
  'export.setting.bom.label': entry(ladder('Write a UTF-8 byte-order mark'), ladder('寫 UTF-8 位元組順序標記')),
  'export.setting.bom.desc': entry(
    ladder('Off by default. Turn it on when a spreadsheet opens your CSV with mangled accented characters; leave it off for anything a program will parse.'),
    ladder('預設關咗。如果試算表開你個 CSV 時啲重音字亂晒碼就開佢；程式要解析嘅嘢就唔好開。')
  ),
  'export.setting.destination.label': entry(ladder('Destination folder'), ladder('目的地資料夾')),
  'export.setting.destination.desc': entry(
    ladder('Where exports are written when you do not choose a folder each time. Empty means the export asks every time.'),
    ladder('如果你唔係每次都揀資料夾，匯出就寫入呢度。留空就每次都問你。')
  ),
  'export.setting.openAfter.label': entry(ladder('Open every export in Visual Studio Code'), ladder('每次匯出都用 Visual Studio Code 打開')),
  'export.setting.openAfter.desc': entry(
    ladder('When an export finishes, hand the resulting file or folder straight to Visual Studio Code. Does nothing when it is not installed, and says so.'),
    ladder('匯出完成之後，直接將檔案或者資料夾交俾 Visual Studio Code。冇裝就唔會有嘢發生，仲會照直講。')
  ),
  'export.setting.editor.label': entry(ladder('Which editor'), ladder('用邊個編輯器')),
  'export.setting.editor.desc': entry(
    ladder('Visual Studio Code is the first-class target. Insiders and VSCodium are offered when they are the ones actually installed.'),
    ladder('首選係 Visual Studio Code。如果你裝嘅係 Insiders 或者 VSCodium，就會俾你揀嗰啲。')
  ),
  'export.setting.archiveFormat.label': entry(ladder('Archive format'), ladder('壓縮格式')),
  'export.setting.archiveFormat.desc': entry(
    ladder('ZIP opens everywhere without extra software. 7z compresses better and is the only one of the two that can hide the file names inside.'),
    ladder('ZIP 邊度都開到，唔使裝嘢。7z 壓得細啲，而且兩者之中淨係佢先收得埋入面啲檔案名。')
  ),
  'export.setting.method.label': entry(ladder('Compression method'), ladder('壓縮方法')),
  'export.setting.method.desc': entry(
    ladder('LZMA2 is the balanced default. PPMd is markedly better on plain text and markedly slower. Deflate is the fastest and the weakest. Copy stores the bytes with no compression at all.'),
    ladder('LZMA2 係平衡嘅預設值。PPMd 對純文字明顯好啲但慢好多。Deflate 最快最弱。Copy 完全唔壓，直接擺入去。')
  ),
  'export.setting.level.label': entry(ladder('Compression level'), ladder('壓縮程度')),
  'export.setting.level.desc': entry(
    ladder('0 stores without compressing. 5 is normal. 9 is ultra and can use several gigabytes of memory with a large dictionary.'),
    ladder('0 係唔壓直接存。5 係正常。9 係極限，配大字典可以食幾 GB 記憶體。')
  ),
  'export.setting.dictionary.label': entry(ladder('Dictionary size'), ladder('字典大細')),
  'export.setting.dictionary.desc': entry(
    ladder('A bigger dictionary finds repeats further apart and compresses better. Compressing needs roughly ten times the dictionary in memory; extracting needs roughly the dictionary itself.'),
    ladder('字典越大，搵到相隔越遠嘅重複，壓得越細。壓縮大約要字典嘅十倍記憶體；解壓大約要一個字典咁多。')
  ),
  'export.setting.wordSize.label': entry(ladder('Word size'), ladder('字長')),
  'export.setting.wordSize.desc': entry(
    ladder('The longest match the compressor will look for, from 8 to 273 bytes. Larger helps repetitive text and costs time.'),
    ladder('壓縮器最長會搵幾長嘅重複，由 8 到 273 位元組。越大對重複多嘅文字越有用，但越花時間。')
  ),
  'export.setting.solid.label': entry(ladder('Solid archive'), ladder('連續壓縮')),
  'export.setting.solid.desc': entry(
    ladder('Solid treats the files as one stream, which compresses many small files far better. The cost is that reading one file back means decompressing its whole block.'),
    ladder('連續壓縮將啲檔案當成一條流，對好多細檔案嚟講細好多。代價係要攞返其中一個檔案，就要解成個區塊。')
  ),
  'export.setting.solidBlock.label': entry(ladder('Solid block size'), ladder('連續區塊大細')),
  'export.setting.solidBlock.desc': entry(
    ladder('How much data shares one solid block. Bigger compresses better; smaller means a damaged archive loses less and a single file is cheaper to read back.'),
    ladder('幾多數據共用一個連續區塊。越大壓得越細；越細就算壓縮檔壞咗都損失少啲，攞返單一檔案又平啲。')
  ),
  'export.setting.threads.label': entry(ladder('Threads'), ladder('執行緒')),
  'export.setting.threads.desc': entry(
    ladder('More threads finish sooner and use proportionally more memory, because each thread keeps its own dictionary buffers.'),
    ladder('執行緒越多完成得越快，記憶體亦按比例用多啲，因為每條執行緒都有自己嘅字典緩衝。')
  ),
  'export.setting.volume.label': entry(ladder('Split into volumes'), ladder('分割成多個檔案')),
  'export.setting.volume.desc': entry(
    ladder('Writes .001, .002 and so on at this size. Every part is needed to extract; losing one loses the archive.'),
    ladder('會按呢個大細寫成 .001、.002 咁。解壓要齊晒每一份；唔見一份就成個壓縮檔冇用。')
  ),
  'export.setting.encryptHeaders.label': entry(ladder('Encrypt file names in 7z archives'), ladder('7z 壓縮檔連檔案名都加密')),
  'export.setting.encryptHeaders.desc': entry(
    ladder('Only 7z can do this. With it off, the names of the files inside an encrypted archive are readable by anyone without the password.'),
    ladder('淨係 7z 做到。唔開嘅話，就算加咗密，入面啲檔案名都係人人唔使密碼就睇到。')
  ),
  'export.setting.archiver.label': entry(ladder('Archiver command'), ladder('壓縮程式指令')),
  'export.setting.archiver.desc': entry(
    ladder('The bare command name tried first, before the built-in list. It must be reachable through the privileged bridge; a filesystem path is refused there.'),
    ladder('會喺內置清單之前先試呢個指令名。佢必須經特權橋接到手；喺嗰度用檔案路徑會被拒絕。')
  ),
  'export.setting.archiveName.label': entry(ladder('Archive name'), ladder('壓縮檔名')),
  'export.setting.archiveName.desc': entry(
    ladder('The base name of the archive and of the folder its entries sit under. The extension is added from the archive format.'),
    ladder('壓縮檔同入面資料夾嘅基本名。副檔名會按壓縮格式加上去。')
  ),

  /* ---------------- notifications ---------------- */

  'export.notify.title': entry(ladder('Export'), ladder('匯出')),
  'export.notify.nothingToDo': entry(
    ladder('Nothing was selected, so nothing was written.'),
    ladder('乜都冇揀，所以乜都冇寫。')
  )
};
