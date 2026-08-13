import type { Catalogue, FunnyLadder, TranslationEntry } from '../../core/registry';

/**
 * Every word this feature renders, in English and in playful Hong Kong
 * Cantonese, at all five humour levels.
 *
 * The two levels are independent, so each rung of each ladder has to read
 * correctly beside any rung of the other. Humour changes the voice and never
 * the facts: at level 5 a warning still names the exact setting, the exact
 * path and the exact consequence, because a funny message that leaves the
 * reader guessing is a broken message.
 */

/** Expands a short ladder to the five rungs the resolver needs. */
function ladder(...steps: string[]): FunnyLadder {
  if (steps.length === 5) return [steps[0], steps[1], steps[2], steps[3], steps[4]];
  if (steps.length === 3) return [steps[0], steps[0], steps[1], steps[2], steps[2]];
  if (steps.length === 2) return [steps[0], steps[0], steps[0], steps[1], steps[1]];
  if (steps.length === 1) return [steps[0], steps[0], steps[0], steps[0], steps[0]];
  throw new Error(`A ladder takes 1, 2, 3 or 5 strings; ${steps.length} were given.`);
}

function entry(en: FunnyLadder, yue: FunnyLadder): TranslationEntry {
  return { en, yue };
}

export const STRINGS: Catalogue = {
  /* ---------------- destinations and headings ---------------- */

  'app-identity.tab': entry(
    ladder('About', 'About', 'About this application', 'About this application, and what it calls itself', 'About this application, and what it calls itself'),
    ladder('關於', '關於', '關於呢個程式', '關於呢個程式，同埋佢叫自己咩名', '關於呢個程式，同埋佢叫自己咩名')
  ),
  'app-identity.section.settings': entry(
    ladder('Application identity'),
    ladder('程式身分')
  ),
  'app-identity.subtitle': entry(
    ladder('Version {version} · {licence}'),
    ladder('版本 {version} · {licence}')
  ),

  /* ---------------- the name card ---------------- */

  'app-identity.name.heading': entry(
    ladder('The name it calls itself', 'The name it calls itself', 'What this application calls itself', 'What this application calls itself — your call', 'What this application calls itself — your call'),
    ladder('佢叫自己咩名', '佢叫自己咩名', '呢個程式叫自己咩名', '呢個程式叫自己咩名——你話事', '呢個程式叫自己咩名——你話事')
  ),
  'app-identity.name.label': entry(
    ladder('Display name'),
    ladder('顯示名稱')
  ),
  'app-identity.name.hint': entry(
    ladder(
      'Leave it empty to use the shipped name, {shipped}. At most {max} characters.',
      'Leave it empty to use the shipped name, {shipped}. At most {max} characters.',
      'Empty means the shipped name, {shipped}. Up to {max} characters.',
      'Empty means it goes back to being {shipped}. Up to {max} characters, so no essays.',
      'Empty means it goes back to being {shipped}. Up to {max} characters, so no essays.'
    ),
    ladder(
      '留空就用出廠名 {shipped}，最多 {max} 個字。',
      '留空就用出廠名 {shipped}，最多 {max} 個字。',
      '空咗就用返出廠名 {shipped}，最多 {max} 個字。',
      '空咗佢就變返做 {shipped}，最多 {max} 個字，唔好寫成篇文。',
      '空咗佢就變返做 {shipped}，最多 {max} 個字，唔好寫成篇文。'
    )
  ),
  'app-identity.name.explain': entry(
    ladder(
      'Changes the name shown in the title bar, in notifications, on this surface and anywhere else the application introduces itself. It changes nothing else: the data directory, the package identity, the installer identity and the update feed are compiled-in constants and stay exactly where they are.',
      'Changes the name shown in the title bar, in notifications, on this surface and anywhere else the application introduces itself. It changes nothing else: the data directory, the package identity, the installer identity and the update feed are compiled-in constants and stay exactly where they are.',
      'Changes the name in the title bar, in notifications and anywhere else the application introduces itself. Nothing else moves: the data directory, the package identity, the installer identity and the update feed are constants and stay put.',
      'Changes what the window calls itself — title bar, notifications, this page, everywhere it introduces itself. Nothing else budges: the data directory, the package identity, the installer and the update feed are constants, and they stay exactly where they are no matter what you type.',
      'Changes what the window calls itself — title bar, notifications, this page, everywhere it introduces itself. Nothing else budges: the data directory, the package identity, the installer and the update feed are constants, and they stay exactly where they are no matter what you type.'
    ),
    ladder(
      '改標題列、通知、呢一版，同埋任何佢自我介紹嘅地方所顯示嘅名。其他嘢一律唔改：資料夾、套件身分、安裝程式身分、更新來源全部係寫死嘅常數，原封不動。',
      '改標題列、通知、呢一版，同埋任何佢自我介紹嘅地方所顯示嘅名。其他嘢一律唔改：資料夾、套件身分、安裝程式身分、更新來源全部係寫死嘅常數，原封不動。',
      '改標題列、通知同其他自我介紹嘅地方個名。其他唔郁：資料夾、套件身分、安裝程式身分同更新來源都係常數，照舊。',
      '你改嘅只係佢點稱呼自己——標題列、通知、呢版、所有自我介紹嘅位。其餘一律唔郁：資料夾、套件身分、安裝程式同更新來源都係常數，你打乜都好，佢哋一步都唔會挪。',
      '你改嘅只係佢點稱呼自己——標題列、通知、呢版、所有自我介紹嘅位。其餘一律唔郁：資料夾、套件身分、安裝程式同更新來源都係常數，你打乜都好，佢哋一步都唔會挪。'
    )
  ),
  'app-identity.name.diagnosticsNote': entry(
    ladder(
      'Diagnostic reports, crash logs and anything you file as an issue use the shipped name {shipped}, not the name you choose here, so a reader can tell what software they are looking at.',
      'Diagnostic reports, crash logs and anything you file as an issue use the shipped name {shipped}, not the name you choose here, so a reader can tell what software they are looking at.',
      'Diagnostics, crash logs and issue reports say {shipped}, not your chosen name, so whoever reads them knows what software it is.',
      'Diagnostics, crash logs and anything you file elsewhere still say {shipped}. Nobody on the receiving end has heard of the name you picked, and a report nobody can place is a report nobody can act on.',
      'Diagnostics, crash logs and anything you file elsewhere still say {shipped}. Nobody on the receiving end has heard of the name you picked, and a report nobody can place is a report nobody can act on.'
    ),
    ladder(
      '診斷報告、當機紀錄、你去開 issue 嗰啲，全部用出廠名 {shipped}，唔會用你喺度改嘅名，等睇嘅人知道係咩軟件。',
      '診斷報告、當機紀錄、你去開 issue 嗰啲，全部用出廠名 {shipped}，唔會用你喺度改嘅名，等睇嘅人知道係咩軟件。',
      '診斷、當機紀錄同報告都會寫 {shipped}，唔會寫你改嘅名，睇嘅人先知係邊隻軟件。',
      '診斷、當機紀錄，同埋你攞去出面交嘅嘢，一律照寫 {shipped}。對面冇人聽過你改嗰個名，一份冇人認得嘅報告即係冇人跟得到。',
      '診斷、當機紀錄，同埋你攞去出面交嘅嘢，一律照寫 {shipped}。對面冇人聽過你改嗰個名，一份冇人認得嘅報告即係冇人跟得到。'
    )
  ),
  'app-identity.name.apply': entry(
    ladder('Use this name'),
    ladder('用呢個名')
  ),
  'app-identity.name.reset': entry(
    ladder('Restore the shipped name', 'Restore the shipped name', 'Go back to the shipped name', 'Put the shipped name back', 'Put the shipped name back'),
    ladder('回復出廠名', '回復出廠名', '用返出廠名', '將出廠名擺返落去', '將出廠名擺返落去')
  ),
  'app-identity.name.saved': entry(
    ladder('The display name is now {name}'),
    ladder('顯示名稱而家係 {name}')
  ),
  'app-identity.name.savedBody': entry(
    ladder(
      'The title bar, notifications and this surface follow it. The data directory, the package identity, the installer and the update feed did not move.',
      'The title bar, notifications and this surface follow it. The data directory, the package identity, the installer and the update feed did not move.',
      'Title bar, notifications and this page follow it. The data directory, package identity, installer and update feed did not move.',
      'Title bar, notifications and this page are already saying it. The data directory, package identity, installer and update feed did not so much as blink.',
      'Title bar, notifications and this page are already saying it. The data directory, package identity, installer and update feed did not so much as blink.'
    ),
    ladder(
      '標題列、通知同呢一版都會跟住改。資料夾、套件身分、安裝程式同更新來源全部冇郁過。',
      '標題列、通知同呢一版都會跟住改。資料夾、套件身分、安裝程式同更新來源全部冇郁過。',
      '標題列、通知、呢版都跟咗。資料夾、套件身分、安裝程式同更新來源都冇郁。',
      '標題列、通知、呢版已經改咗口。資料夾、套件身分、安裝程式同更新來源連眼都冇眨過。',
      '標題列、通知、呢版已經改咗口。資料夾、套件身分、安裝程式同更新來源連眼都冇眨過。'
    )
  ),
  'app-identity.name.resetDone': entry(
    ladder('The shipped name is back: {name}'),
    ladder('回復咗出廠名：{name}')
  ),
  'app-identity.name.resetBody': entry(
    ladder(
      'Your previous name was "{previous}". The change is in the local version history, so you can read it back or type that name again.',
      'Your previous name was "{previous}". The change is in the local version history, so you can read it back or type that name again.',
      'The previous name was "{previous}". It is in the local version history if you want it back.',
      'The previous name was "{previous}", and it is safely in the local version history. Nothing has been lost; type it again any time you miss it.',
      'The previous name was "{previous}", and it is safely in the local version history. Nothing has been lost; type it again any time you miss it.'
    ),
    ladder(
      '你之前個名係「{previous}」。呢個改動記咗喺本機版本紀錄，想要返隨時查得返，或者再打一次。',
      '你之前個名係「{previous}」。呢個改動記咗喺本機版本紀錄，想要返隨時查得返，或者再打一次。',
      '之前個名係「{previous}」，記咗喺本機版本紀錄，想要返都得。',
      '之前個名係「{previous}」，安安全全咁記咗喺本機版本紀錄。乜都冇冇咗，掛住就再打多次。',
      '之前個名係「{previous}」，安安全全咁記咗喺本機版本紀錄。乜都冇冇咗，掛住就再打多次。'
    )
  ),
  'app-identity.name.alreadyShipped': entry(
    ladder('It is already using the shipped name {name}. Nothing was changed.'),
    ladder('佢而家已經用緊出廠名 {name}，冇改到任何嘢。')
  ),
  'app-identity.name.error.type': entry(
    ladder('A display name has to be text. Nothing was changed.'),
    ladder('顯示名稱要係文字。乜都冇改到。')
  ),
  'app-identity.name.error.tooLong': entry(
    ladder(
      'That name is longer than {max} characters, so it would be cut off in the title bar. Nothing was changed.',
      'That name is longer than {max} characters, so it would be cut off in the title bar. Nothing was changed.',
      'That is over {max} characters and the title bar would cut it off. Nothing was changed.',
      'That is over {max} characters. The title bar would eat the end of it and you would never see the punchline. Nothing was changed.',
      'That is over {max} characters. The title bar would eat the end of it and you would never see the punchline. Nothing was changed.'
    ),
    ladder(
      '個名超過 {max} 個字，標題列會截斷佢。乜都冇改到。',
      '個名超過 {max} 個字，標題列會截斷佢。乜都冇改到。',
      '超過 {max} 個字，標題列會剪咗尾。乜都冇改到。',
      '超過 {max} 個字，標題列會食咗個尾，你永遠見唔到笑點。乜都冇改到。',
      '超過 {max} 個字，標題列會食咗個尾，你永遠見唔到笑點。乜都冇改到。'
    )
  ),
  'app-identity.name.error.control': entry(
    ladder(
      'That name contains invisible control or formatting characters, which would render as nothing or as a box. Nothing was changed.',
      'That name contains invisible control or formatting characters, which would render as nothing or as a box. Nothing was changed.',
      'That name holds invisible control characters that render as nothing or as a box. Nothing was changed.',
      'That name is hiding invisible control characters. They render as nothing at all, or as a little box, and a name that looks empty is worse than no name. Nothing was changed.',
      'That name is hiding invisible control characters. They render as nothing at all, or as a little box, and a name that looks empty is worse than no name. Nothing was changed.'
    ),
    ladder(
      '個名入面有睇唔到嘅控制或格式字元，畫出嚟會係空白或者一個方格。乜都冇改到。',
      '個名入面有睇唔到嘅控制或格式字元，畫出嚟會係空白或者一個方格。乜都冇改到。',
      '個名匿咗啲睇唔到嘅控制字元，出嚟會空白或者變方格。乜都冇改到。',
      '個名匿埋咗啲隱形控制字元，畫出嚟一係乜都冇，一係一個細方格。一個睇落空白嘅名，仲衰過冇名。乜都冇改到。',
      '個名匿埋咗啲隱形控制字元，畫出嚟一係乜都冇，一係一個細方格。一個睇落空白嘅名，仲衰過冇名。乜都冇改到。'
    )
  ),
  'app-identity.name.provenance.default': entry(
    ladder('No file has ever set this. The application is using its shipped name: {value}.'),
    ladder('未有任何檔案寫過呢項，程式而家用緊出廠名：{value}。')
  ),
  'app-identity.name.provenance.user': entry(
    ladder('Set by you, and stored in {path}.'),
    ladder('由你設定，儲喺 {path}。')
  ),
  'app-identity.name.provenance.other': entry(
    ladder('Set by {source}, and stored in {path}.'),
    ladder('由 {source} 設定，儲喺 {path}。')
  ),

  /* ---------------- preview ---------------- */

  'app-identity.preview.heading': entry(
    ladder('Where the name appears'),
    ladder('個名會喺邊度出現')
  ),
  'app-identity.preview.static': entry(
    ladder(
      'These three lines are a static preview. They show the text, not working controls.',
      'These three lines are a static preview. They show the text, not working controls.',
      'A static preview: the text only, not working controls.',
      'A static preview. It shows you the words and nothing else — no buttons hiding in here pretending to work.',
      'A static preview. It shows you the words and nothing else — no buttons hiding in here pretending to work.'
    ),
    ladder(
      '呢三行係靜態預覽，淨係顯示文字，唔係可以㩒嘅控制項。',
      '呢三行係靜態預覽，淨係顯示文字，唔係可以㩒嘅控制項。',
      '靜態預覽：淨係文字，唔係真控制項。',
      '靜態預覽，淨係俾你睇字。冇任何扮到似真嘅掣匿喺入面。',
      '靜態預覽，淨係俾你睇字。冇任何扮到似真嘅掣匿喺入面。'
    )
  ),
  'app-identity.preview.titleBar': entry(ladder('Title bar'), ladder('標題列')),
  'app-identity.preview.notification': entry(ladder('A notification'), ladder('一個通知')),
  'app-identity.preview.about': entry(ladder('This surface'), ladder('呢一版')),
  'app-identity.preview.diagnostic': entry(ladder('A diagnostic report'), ladder('診斷報告')),
  'app-identity.preview.notificationBody': entry(
    ladder('{name} finished writing the world.'),
    ladder('{name} 寫完個世界喇。')
  ),
  'app-identity.preview.aboutBody': entry(
    ladder('{name}, version {version}'),
    ladder('{name}，版本 {version}')
  ),

  /* ---------------- checks ---------------- */

  'app-identity.checks.heading': entry(
    ladder('What a rename does not move', 'What a rename does not move', 'What a rename does not move', 'What a rename does not move — checked, not promised', 'What a rename does not move — checked, not promised'),
    ladder('改名唔會郁到嘅嘢', '改名唔會郁到嘅嘢', '改名唔會郁到嘅嘢', '改名唔會郁到嘅嘢——係查過，唔係口噏', '改名唔會郁到嘅嘢——係查過，唔係口噏')
  ),
  'app-identity.checks.explain': entry(
    ladder(
      'Each line below is checked against the paths and the settings store this window is actually using, right now. The evidence beside each verdict is the value that was read, not a description of it.',
      'Each line below is checked against the paths and the settings store this window is actually using, right now. The evidence beside each verdict is the value that was read, not a description of it.',
      'Every line is checked against the real paths and the real settings store, right now. The evidence is the value that was read.',
      'Every line is checked against the real paths and the real settings store, this second. The evidence beside each verdict is the actual value that was read — a promise would be cheaper and worth less.',
      'Every line is checked against the real paths and the real settings store, this second. The evidence beside each verdict is the actual value that was read — a promise would be cheaper and worth less.'
    ),
    ladder(
      '下面每一行都係即時對住呢個窗真正用緊嘅路徑同設定檔查出嚟。每個結論旁邊嘅證據，就係讀返嚟嗰個值本身，唔係形容詞。',
      '下面每一行都係即時對住呢個窗真正用緊嘅路徑同設定檔查出嚟。每個結論旁邊嘅證據，就係讀返嚟嗰個值本身，唔係形容詞。',
      '每一行都係即時查真路徑同真設定檔。旁邊嘅證據就係讀到嘅值。',
      '每一行都係即刻查真路徑同真設定檔。每個結論隔籬嘅證據就係真真正正讀到嗰個值——講句「放心啦」平好多，但係唔值錢。',
      '每一行都係即刻查真路徑同真設定檔。每個結論隔籬嘅證據就係真真正正讀到嗰個值——講句「放心啦」平好多，但係唔值錢。'
    )
  ),
  'app-identity.checks.rerun': entry(ladder('Run the checks again'), ladder('再查一次')),
  'app-identity.checks.summary': entry(
    ladder('{passed} of {total} passed, {failed} failed.'),
    ladder('{total} 項入面 {passed} 項過關，{failed} 項唔過。')
  ),
  'app-identity.checks.state.pass': entry(ladder('Passed'), ladder('過關')),
  'app-identity.checks.state.fail': entry(ladder('Failed'), ladder('唔過')),
  'app-identity.checks.state.unknown': entry(ladder('Inconclusive'), ladder('講唔準')),
  'app-identity.check.dataDir.title': entry(
    ladder('The data directory is named by the package identity, not by the display name'),
    ladder('資料夾用套件身分嚟改名，唔係用顯示名稱')
  ),
  'app-identity.check.dataDir.evidence': entry(
    ladder('The data directory ends in "{segment}". The package identity is "{package}".'),
    ladder('資料夾最後一層係「{segment}」，套件身分係「{package}」。')
  ),
  'app-identity.check.contained.title': entry(
    ladder('Everything the application stores sits inside that one directory'),
    ladder('程式儲低嘅嘢全部喺同一個資料夾入面')
  ),
  'app-identity.check.contained.evidence.pass': entry(
    ladder('The history directory, the log directory and the settings file all sit inside {path}.'),
    ladder('版本紀錄資料夾、記錄檔資料夾同設定檔全部喺 {path} 入面。')
  ),
  'app-identity.check.contained.evidence.fail': entry(
    ladder('Outside {path}: {list}.'),
    ladder('喺 {path} 外面嘅有：{list}。')
  ),
  'app-identity.check.singleKey.title': entry(
    ladder('Renaming writes exactly one settings key'),
    ladder('改名淨係寫一個設定鍵')
  ),
  'app-identity.check.singleKey.evidence': entry(
    ladder('Settings keys currently holding "{name}": {keys}.'),
    ladder('而家載住「{name}」嘅設定鍵：{keys}。')
  ),
  'app-identity.check.singleKey.evidence.none': entry(
    ladder('No name is stored, so no settings key holds one. The shipped name is in use.'),
    ladder('未儲過任何名，所以冇設定鍵載住名，而家用緊出廠名。')
  ),
  'app-identity.check.noIdentitySetting.title': entry(
    ladder('No setting exists that could move the package identity'),
    ladder('冇任何設定郁得到套件身分')
  ),
  'app-identity.check.noIdentitySetting.evidence.pass': entry(
    ladder('None of {keys} exists in the settings store, and the bridge exposes no call that writes them.'),
    ladder('{keys} 呢啲鍵喺設定檔一個都冇，橋接層亦都冇任何寫得到佢哋嘅呼叫。')
  ),
  'app-identity.check.noIdentitySetting.evidence.fail': entry(
    ladder('Present in the settings store: {keys}.'),
    ladder('設定檔入面竟然有：{keys}。')
  ),
  'app-identity.check.shipped.title': entry(
    ladder('The shipped name is still available for anything that must be exact'),
    ladder('需要準確嗰啲場合，出廠名一直都攞得到')
  ),
  'app-identity.check.shipped.evidence': entry(
    ladder('Diagnostics report "{shipped}". The window currently calls itself "{display}".'),
    ladder('診斷會寫「{shipped}」，而個窗而家叫自己做「{display}」。')
  ),

  /* ---------------- facts table ---------------- */

  'app-identity.facts.heading': entry(
    ladder('Identity values'),
    ladder('身分數值')
  ),
  'app-identity.facts.explain': entry(
    ladder(
      'Every identity value this build holds. "Constant" values are compiled in and no setting can reach them; "display" is the one value a rename moves; "path" values are derived from the package constant; "runtime" values come from the running process.',
      'Every identity value this build holds. "Constant" values are compiled in and no setting can reach them; "display" is the one value a rename moves; "path" values are derived from the package constant; "runtime" values come from the running process.',
      'Every identity value this build holds. Constants are compiled in, display is the one a rename moves, paths come from the package constant, runtime values come from the process.',
      'Every identity value in this build, laid out. Constants are welded in, display is the single one your rename touches, paths grow out of the package constant, and runtime values are whatever the process is actually running on.',
      'Every identity value in this build, laid out. Constants are welded in, display is the single one your rename touches, paths grow out of the package constant, and runtime values are whatever the process is actually running on.'
    ),
    ladder(
      '呢個版本持有嘅全部身分數值。「常數」係編譯入去、任何設定都掂唔到；「顯示」係改名唯一會郁到嗰個；「路徑」由套件常數推出嚟；「執行期」由行緊嘅程序報返嚟。',
      '呢個版本持有嘅全部身分數值。「常數」係編譯入去、任何設定都掂唔到；「顯示」係改名唯一會郁到嗰個；「路徑」由套件常數推出嚟；「執行期」由行緊嘅程序報返嚟。',
      '呢個版本全部身分數值。常數係編譯入去，顯示係改名唯一郁到嗰個，路徑由套件常數推出，執行期由程序報返。',
      '呢個版本啲身分數值，一次過攤晒出嚟。常數係焊死咗嘅，顯示係你改名唯一掂到嗰個，路徑由套件常數生出嚟，執行期就係程序而家真係踩緊乜。',
      '呢個版本啲身分數值，一次過攤晒出嚟。常數係焊死咗嘅，顯示係你改名唯一掂到嗰個，路徑由套件常數生出嚟，執行期就係程序而家真係踩緊乜。'
    )
  ),
  'app-identity.facts.search': entry(
    ladder('Search identity values'),
    ladder('搵身分數值')
  ),
  'app-identity.facts.column.label': entry(ladder('Value'), ladder('項目')),
  'app-identity.facts.column.value': entry(ladder('What it is'), ladder('內容')),
  'app-identity.facts.column.kind': entry(ladder('Kind'), ladder('種類')),
  'app-identity.fact.packageName': entry(ladder('Package identity'), ladder('套件身分')),
  'app-identity.fact.productName': entry(ladder('Product name (shipped)'), ladder('產品名稱（出廠）')),
  'app-identity.fact.displayName': entry(ladder('Display name (yours)'), ladder('顯示名稱（你嘅）')),
  'app-identity.fact.displayName.shipped': entry(
    ladder('{name} (the shipped name; no name chosen)'),
    ladder('{name}（出廠名；你未揀過名）')
  ),
  'app-identity.fact.version': entry(ladder('Version'), ladder('版本')),
  'app-identity.fact.licence': entry(ladder('Licence'), ladder('授權條款')),
  'app-identity.fact.dataDir': entry(ladder('Application data directory'), ladder('程式資料夾')),
  'app-identity.fact.historyDir': entry(ladder('Version history directory'), ladder('版本紀錄資料夾')),
  'app-identity.fact.logsDir': entry(ladder('Log directory'), ladder('記錄檔資料夾')),
  'app-identity.fact.settingsFile': entry(ladder('Settings file'), ladder('設定檔')),
  'app-identity.fact.platform': entry(ladder('Platform'), ladder('平台')),
  'app-identity.fact.arch': entry(ladder('Architecture'), ladder('架構')),
  'app-identity.fact.electron': entry(ladder('Electron'), ladder('Electron')),
  'app-identity.fact.chrome': entry(ladder('Chromium'), ladder('Chromium')),
  'app-identity.fact.node': entry(ladder('Node'), ladder('Node')),
  'app-identity.fact.v8': entry(ladder('V8'), ladder('V8')),
  'app-identity.fact.packaged': entry(ladder('Packaged build'), ladder('已封裝版本')),
  'app-identity.fact.development': entry(ladder('Development build'), ladder('開發版本')),
  'app-identity.fact.startedAt': entry(ladder('Process started'), ladder('程序開始時間')),
  'app-identity.kind.constant': entry(ladder('Constant'), ladder('常數')),
  'app-identity.kind.display': entry(ladder('Display'), ladder('顯示')),
  'app-identity.kind.path': entry(ladder('Path'), ladder('路徑')),
  'app-identity.kind.runtime': entry(ladder('Runtime'), ladder('執行期')),
  'app-identity.value.yes': entry(ladder('Yes'), ladder('係')),
  'app-identity.value.no': entry(ladder('No'), ladder('唔係')),
  'app-identity.value.unknown': entry(ladder('Not reported yet'), ladder('未報返')),
  'app-identity.facts.copyRow': entry(
    ladder('Copy the value of {label}'),
    ladder('複製 {label} 嘅內容')
  ),
  'app-identity.dataFolder.open': entry(
    ladder('Open the application data folder'),
    ladder('打開程式資料夾')
  ),
  'app-identity.dataFolder.failed': entry(
    ladder('The file manager did not open: {reason}'),
    ladder('開唔到檔案總管：{reason}')
  ),

  /* ---------------- bulk actions ---------------- */

  'app-identity.bulk.selectShown': entry(
    ladder('Select the {count} shown'),
    ladder('揀晒顯示緊嘅 {count} 個')
  ),
  'app-identity.bulk.selectEvery': entry(
    ladder('Select every one of the {count}'),
    ladder('揀晒全部 {count} 個')
  ),
  'app-identity.bulk.selectRow': entry(
    ladder('Select {name}'),
    ladder('揀 {name}')
  ),
  'app-identity.bulk.invert': entry(ladder('Invert the selection'), ladder('反轉揀咗嘅')),
  'app-identity.bulk.clear': entry(ladder('Clear the selection'), ladder('唔揀住先')),
  'app-identity.bulk.status': entry(
    ladder('{selected} selected · {shown} of {total} shown'),
    ladder('揀咗 {selected} 個 · 顯示緊 {total} 個入面嘅 {shown} 個')
  ),
  'app-identity.bulk.copy': entry(ladder('Copy the selection'), ladder('複製揀咗嘅')),
  'app-identity.bulk.export': entry(ladder('Export the selection…'), ladder('匯出揀咗嘅…')),
  'app-identity.bulk.needSelection': entry(
    ladder('Nothing is selected yet, so there is nothing to act on.'),
    ladder('而家一個都未揀，所以冇嘢可以做。')
  ),
  'app-identity.bulk.previewTitle': entry(
    ladder('{count} rows will be copied'),
    ladder('會複製 {count} 行')
  ),
  'app-identity.bulk.previewMore': entry(
    ladder('…and {count} more'),
    ladder('…仲有 {count} 個')
  ),
  'app-identity.bulk.copied': entry(
    ladder('{count} rows are on the clipboard'),
    ladder('{count} 行已經放咗上剪貼簿')
  ),
  'app-identity.bulk.copyFailed': entry(
    ladder('The clipboard refused the text: {reason}'),
    ladder('剪貼簿唔收呢段文字：{reason}')
  ),
  'app-identity.export.heading': entry(ladder('Export {count} rows'), ladder('匯出 {count} 行')),
  'app-identity.export.format': entry(ladder('File format'), ladder('檔案格式')),
  'app-identity.export.losses': entry(
    ladder('This format cannot carry every field faithfully:'),
    ladder('呢個格式載唔齊全部欄位：')
  ),
  'app-identity.export.noLosses': entry(
    ladder('This format carries every field exactly as it is.'),
    ladder('呢個格式可以原汁原味咁載晒全部欄位。')
  ),
  'app-identity.export.run': entry(ladder('Choose a file and write it'), ladder('揀個檔案寫落去')),
  'app-identity.export.saved': entry(ladder('Written to {path}'), ladder('寫咗落 {path}')),
  'app-identity.export.cancelled': entry(
    ladder('No file was chosen, so nothing was written.'),
    ladder('冇揀到檔案，所以乜都冇寫。')
  ),

  /* ---------------- release code name ---------------- */

  'app-identity.codename.heading': entry(
    ladder('Release code name'),
    ladder('版本代號')
  ),
  'app-identity.codename.explain': entry(
    ladder(
      'Every release carries a dim sum code name beside its version number. The code name is a label, never a replacement for the version. The photograph of the dish lives in the public catalogue and is deliberately not bundled here, so this surface links to the catalogue instead of shipping a picture.',
      'Every release carries a dim sum code name beside its version number. The code name is a label, never a replacement for the version. The photograph of the dish lives in the public catalogue and is deliberately not bundled here, so this surface links to the catalogue instead of shipping a picture.',
      'Every release carries a dim sum code name beside its version. It is a label, not a replacement for the version. The photo lives in the public catalogue and is not bundled here, so this links there instead.',
      'Every release gets a dim sum code name to sit beside its version number. It is a label and never a stand-in for the version, and the photograph lives in the public catalogue rather than in here, so this page points at the catalogue instead of smuggling a picture in.',
      'Every release gets a dim sum code name to sit beside its version number. It is a label and never a stand-in for the version, and the photograph lives in the public catalogue rather than in here, so this page points at the catalogue instead of smuggling a picture in.'
    ),
    ladder(
      '每個版本都會喺版本號隔籬掛住一個點心代號。代號只係一個標籤，永遠唔會代替版本號。點心相放喺公開圖庫，特登唔會打包入嚟，所以呢一版係連去圖庫，而唔係自己夾埋張相。',
      '每個版本都會喺版本號隔籬掛住一個點心代號。代號只係一個標籤，永遠唔會代替版本號。點心相放喺公開圖庫，特登唔會打包入嚟，所以呢一版係連去圖庫，而唔係自己夾埋張相。',
      '每個版本喺版本號隔籬有個點心代號。淨係標籤，唔代替版本號。相喺公開圖庫，冇打包入嚟，所以呢度連過去。',
      '每個版本都會揀隻點心做代號，坐喺版本號隔籬。佢淨係一個標籤，永世都唔會頂替版本號；張相住喺公開圖庫，冇偷運入嚟呢度，所以呢版係指你去圖庫。',
      '每個版本都會揀隻點心做代號，坐喺版本號隔籬。佢淨係一個標籤，永世都唔會頂替版本號；張相住喺公開圖庫，冇偷運入嚟呢度，所以呢版係指你去圖庫。'
    )
  ),
  'app-identity.codename.none': entry(
    ladder(
      'This build has no code name recorded. The release notes are where the authoritative one lives; you can record it here so this window agrees with them.',
      'This build has no code name recorded. The release notes are where the authoritative one lives; you can record it here so this window agrees with them.',
      'No code name is recorded for this build. The release notes hold the real one; record it here so this window agrees.',
      'No code name recorded for this build — the release notes hold the real one. Write it in here and this window will finally agree with them.',
      'No code name recorded for this build — the release notes hold the real one. Write it in here and this window will finally agree with them.'
    ),
    ladder(
      '呢個版本冇記低代號。真正嗰個喺發佈說明度；你可以喺呢度記低，等呢個窗同佢對得返上。',
      '呢個版本冇記低代號。真正嗰個喺發佈說明度；你可以喺呢度記低，等呢個窗同佢對得返上。',
      '呢個版本未記代號。真嗰個喺發佈說明，喺呢度記低就對得返上。',
      '呢個版本未記代號——真嗰個喺發佈說明度。喺呢度寫低，個窗先至同佢講返同一個名。',
      '呢個版本未記代號——真嗰個喺發佈說明度。喺呢度寫低，個窗先至同佢講返同一個名。'
    )
  ),
  'app-identity.codename.current': entry(
    ladder('Recorded for this build: {name}'),
    ladder('呢個版本記低嘅係：{name}')
  ),
  'app-identity.codename.picker': entry(ladder('Dish'), ladder('點心')),
  'app-identity.codename.record': entry(ladder('Record this code name'), ladder('記低呢個代號')),
  'app-identity.codename.clear': entry(ladder('Clear the recorded code name'), ladder('清走記低咗嘅代號')),
  'app-identity.codename.recorded': entry(
    ladder('{name} recorded as this build’s code name'),
    ladder('已記低 {name} 做呢個版本嘅代號')
  ),
  'app-identity.codename.cleared': entry(
    ladder('The recorded code name was cleared. The version number is unchanged.'),
    ladder('記低咗嘅代號已經清走，版本號冇變。')
  ),
  'app-identity.codename.catalogue': entry(
    ladder('Open the public dish catalogue'),
    ladder('打開公開點心圖庫')
  ),
  'app-identity.codename.notBundled': entry(
    ladder(
      'No photograph is bundled in this build. The catalogue link opens in your browser.',
      'No photograph is bundled in this build. The catalogue link opens in your browser.',
      'No photo is bundled here; the catalogue link opens in your browser.',
      'There is no photo in here at all — the catalogue link opens in your browser, where the actual steamer basket lives.',
      'There is no photo in here at all — the catalogue link opens in your browser, where the actual steamer basket lives.'
    ),
    ladder(
      '呢個版本冇打包任何相片，圖庫連結會喺你嘅瀏覽器打開。',
      '呢個版本冇打包任何相片，圖庫連結會喺你嘅瀏覽器打開。',
      '呢度冇夾任何相，圖庫連結會喺瀏覽器打開。',
      '呢度一張相都冇——圖庫連結會喺瀏覽器打開，真嘅蒸籠喺嗰邊。',
      '呢度一張相都冇——圖庫連結會喺瀏覽器打開，真嘅蒸籠喺嗰邊。'
    )
  ),

  /* ---------------- licence and funding ---------------- */

  'app-identity.licence.heading': entry(ladder('Licence'), ladder('授權條款')),
  'app-identity.licence.body': entry(
    ladder(
      'This application is distributed under {licence}. You may use it, read its source, change it and pass it on under the same terms.',
      'This application is distributed under {licence}. You may use it, read its source, change it and pass it on under the same terms.',
      'Distributed under {licence}: use it, read the source, change it, pass it on under the same terms.',
      'Distributed under {licence}. Use it, read every line of it, change whatever you like, and pass it on under the same terms — that last part is the whole point.',
      'Distributed under {licence}. Use it, read every line of it, change whatever you like, and pass it on under the same terms — that last part is the whole point.'
    ),
    ladder(
      '呢個程式以 {licence} 發佈。你可以用、睇原始碼、改，同埋用同一套條款傳落去。',
      '呢個程式以 {licence} 發佈。你可以用、睇原始碼、改，同埋用同一套條款傳落去。',
      '以 {licence} 發佈：用得、睇得原始碼、改得，同埋要用返同一套條款傳落去。',
      '以 {licence} 發佈。你用得、每一行都睇得、想點改就點改，然後要用返同一套條款傳落去——最後嗰句先係重點。',
      '以 {licence} 發佈。你用得、每一行都睇得、想點改就點改，然後要用返同一套條款傳落去——最後嗰句先係重點。'
    )
  ),
  'app-identity.licence.open': entry(ladder('Read the licence text'), ladder('睇授權條款全文')),
  'app-identity.money.heading': entry(ladder('What this costs'), ladder('要幾錢')),
  'app-identity.money.body': entry(
    ladder(
      'Nothing, ever. There is no purchase, no licence fee, no subscription, no trial that lapses and no capability held back for anyone. Nothing on this surface asks you for money, and nothing here routes a payment through this project.',
      'Nothing, ever. There is no purchase, no licence fee, no subscription, no trial that lapses and no capability held back for anyone. Nothing on this surface asks you for money, and nothing here routes a payment through this project.',
      'Nothing, ever. No purchase, no fee, no subscription, no lapsing trial, no capability held back. Nothing here asks you for money or routes a payment through this project.',
      'Nothing, ever, in any direction. No purchase, no fee, no subscription, no trial quietly counting down, no feature kept behind a rope. Nothing on this page will ever ask you for money, and no payment goes through this project.',
      'Nothing, ever, in any direction. No purchase, no fee, no subscription, no trial quietly counting down, no feature kept behind a rope. Nothing on this page will ever ask you for money, and no payment goes through this project.'
    ),
    ladder(
      '一蚊都唔使，永遠都係。冇購買、冇授權費、冇訂閱、冇會過期嘅試用、亦冇任何功能係鎖住唔俾人用。呢一版唔會問你攞錢，亦唔會有任何付款經過呢個專案。',
      '一蚊都唔使，永遠都係。冇購買、冇授權費、冇訂閱、冇會過期嘅試用、亦冇任何功能係鎖住唔俾人用。呢一版唔會問你攞錢，亦唔會有任何付款經過呢個專案。',
      '一蚊都唔使，永遠都係。冇購買、冇費用、冇訂閱、冇試用期、冇功能鎖住。呢度唔會問你攞錢，亦冇付款經過呢個專案。',
      '一蚊都唔使，永遠都係，邊個方向都係。冇購買、冇費用、冇訂閱、冇喺度靜靜雞倒數嘅試用、冇功能圍住條紅繩。呢一版永遠唔會問你攞錢，亦冇任何付款會經過呢個專案。',
      '一蚊都唔使，永遠都係，邊個方向都係。冇購買、冇費用、冇訂閱、冇喺度靜靜雞倒數嘅試用、冇功能圍住條紅繩。呢一版永遠唔會問你攞錢，亦冇任何付款會經過呢個專案。'
    )
  ),
  'app-identity.money.upstream': entry(
    ladder(
      'This application is built on other people’s work. If you want to fund any of it, fund them: each entry below links to that project’s own page, anything they accept goes to them, and no link here passes through this project.',
      'This application is built on other people’s work. If you want to fund any of it, fund them: each entry below links to that project’s own page, anything they accept goes to them, and no link here passes through this project.',
      'This is built on other people’s work. To fund any of it, fund them: each entry links to that project’s own page, anything they accept goes to them, and nothing routes through this project.',
      'This whole thing stands on other people’s work. If you want to put money anywhere, put it there: every entry links to that project’s own page, whatever they accept goes straight to them, and not one link here takes a detour through this project.',
      'This whole thing stands on other people’s work. If you want to put money anywhere, put it there: every entry links to that project’s own page, whatever they accept goes straight to them, and not one link here takes a detour through this project.'
    ),
    ladder(
      '呢個程式係踩住好多人嘅成果整出嚟。想出錢支持，就支持佢哋：下面每一項都連去嗰個專案自己嘅頁，佢哋收到嘅錢係佢哋嘅，呢度冇一條連結會經過呢個專案。',
      '呢個程式係踩住好多人嘅成果整出嚟。想出錢支持，就支持佢哋：下面每一項都連去嗰個專案自己嘅頁，佢哋收到嘅錢係佢哋嘅，呢度冇一條連結會經過呢個專案。',
      '呢個係踩住人哋嘅成果整出嚟。想出錢就支持佢哋：每項都連去嗰個專案自己嘅頁，收到嘅錢係佢哋嘅，唔會經過呢個專案。',
      '成件事都係踩住人哋嘅成果整出嚟。想擺錢落去，就擺落佢哋度：每一項都連去嗰個專案自己嘅頁，佢哋收幾多就係佢哋嘅，呢度冇一條連結會兜路經過呢個專案。',
      '成件事都係踩住人哋嘅成果整出嚟。想擺錢落去，就擺落佢哋度：每一項都連去嗰個專案自己嘅頁，佢哋收幾多就係佢哋嘅，呢度冇一條連結會兜路經過呢個專案。'
    )
  ),
  'app-identity.money.noKnownFunding': entry(
    ladder(
      'Whether a project accepts money at all is stated on its own page, not guessed at here.',
      'Whether a project accepts money at all is stated on its own page, not guessed at here.',
      'Whether a project takes money is stated on its own page; this surface does not guess.',
      'Whether a project takes money at all is written on its own page. This surface refuses to guess on their behalf.',
      'Whether a project takes money at all is written on its own page. This surface refuses to guess on their behalf.'
    ),
    ladder(
      '個專案收唔收錢，寫喺佢自己嗰版度，呢度唔會估。',
      '個專案收唔收錢，寫喺佢自己嗰版度，呢度唔會估。',
      '收唔收錢寫喺佢自己嗰版，呢度唔會估。',
      '收唔收錢，寫喺佢自己嗰版度。呢一版唔會代人哋估。',
      '收唔收錢，寫喺佢自己嗰版度。呢一版唔會代人哋估。'
    )
  ),

  /* ---------------- credits ---------------- */

  'app-identity.credits.heading': entry(ladder('Credits'), ladder('鳴謝')),
  'app-identity.credits.explain': entry(
    ladder(
      'The projects and people this application is built on. If your work is used here and is not listed, it is an omission rather than a decision — say so and it will be added.',
      'The projects and people this application is built on. If your work is used here and is not listed, it is an omission rather than a decision — say so and it will be added.',
      'The projects and people this is built on. Missing from the list means an oversight, not a decision — say so and it gets added.',
      'The projects and people this thing stands on. If your work is in here and your name is not, that is an oversight and not a decision — say so and it goes in.',
      'The projects and people this thing stands on. If your work is in here and your name is not, that is an oversight and not a decision — say so and it goes in.'
    ),
    ladder(
      '呢個程式係踩住呢啲專案同人整出嚟。如果你嘅成果用咗喺度但係冇上榜，係漏咗，唔係故意——講聲就會加返。',
      '呢個程式係踩住呢啲專案同人整出嚟。如果你嘅成果用咗喺度但係冇上榜，係漏咗，唔係故意——講聲就會加返。',
      '呢個係踩住呢啲專案同人整出嚟。冇上榜係漏咗，唔係故意，講聲就加返。',
      '呢件嘢係踩住呢啲專案同人企喺度。你嘅嘢喺入面但係個名唔喺度，係漏咗，唔係有心——出聲，即刻加返。',
      '呢件嘢係踩住呢啲專案同人企喺度。你嘅嘢喺入面但係個名唔喺度，係漏咗，唔係有心——出聲，即刻加返。'
    )
  ),
  'app-identity.credits.search': entry(ladder('Search the credits'), ladder('搵鳴謝名單')),
  'app-identity.credits.column.name': entry(ladder('Project or person'), ladder('專案或者人')),
  'app-identity.credits.column.role': entry(ladder('What it does here'), ladder('喺呢度做咩')),
  'app-identity.credits.column.group': entry(ladder('Part'), ladder('部分')),
  'app-identity.credits.column.url': entry(ladder('Their own page'), ladder('佢哋自己嗰版')),
  'app-identity.credits.open': entry(ladder('Open the page for {name}'), ladder('打開 {name} 嗰版')),
  'app-identity.credits.openFailed': entry(
    ladder('That link did not open: {reason}'),
    ladder('打唔開條連結：{reason}')
  ),

  /* ---------------- diagnostics ---------------- */

  'app-identity.diagnostics.heading': entry(ladder('Diagnostic report'), ladder('診斷報告')),
  'app-identity.diagnostics.explain': entry(
    ladder(
      'A plain-text report you can paste into an issue. It identifies this software by its shipped name, lists the versions and paths, and records what the identity checks above actually found.',
      'A plain-text report you can paste into an issue. It identifies this software by its shipped name, lists the versions and paths, and records what the identity checks above actually found.',
      'A plain-text report to paste into an issue. Shipped name, versions, paths, and what the checks above found.',
      'A plain-text report you can paste straight into an issue. Shipped name at the top so the reader knows what it is, then versions, paths, and exactly what the checks above found.',
      'A plain-text report you can paste straight into an issue. Shipped name at the top so the reader knows what it is, then versions, paths, and exactly what the checks above found.'
    ),
    ladder(
      '一份純文字報告，可以直接貼落 issue。佢用出廠名認住呢隻軟件，列晒版本同路徑，仲會寫低上面啲檢查真係查到啲乜。',
      '一份純文字報告，可以直接貼落 issue。佢用出廠名認住呢隻軟件，列晒版本同路徑，仲會寫低上面啲檢查真係查到啲乜。',
      '一份純文字報告，貼得落 issue。出廠名、版本、路徑，同上面啲檢查嘅結果。',
      '一份純文字報告，可以照抄照貼落 issue。開頭寫出廠名等人認得，跟住版本、路徑，同埋上面啲檢查究竟查到乜。',
      '一份純文字報告，可以照抄照貼落 issue。開頭寫出廠名等人認得，跟住版本、路徑，同埋上面啲檢查究竟查到乜。'
    )
  ),
  'app-identity.diagnostics.copy': entry(ladder('Copy the report'), ladder('複製報告')),
  'app-identity.diagnostics.save': entry(ladder('Save the report…'), ladder('儲存報告…')),
  'app-identity.diagnostics.openEditor': entry(
    ladder('Open the report in an editor'),
    ladder('用編輯器開份報告')
  ),
  'app-identity.diagnostics.copied': entry(
    ladder('The report is on the clipboard'),
    ladder('報告已經放咗上剪貼簿')
  ),
  'app-identity.diagnostics.saved': entry(ladder('Report written to {path}'), ladder('報告寫咗落 {path}')),
  'app-identity.diagnostics.saveFailed': entry(
    ladder('The report was not written: {reason}'),
    ladder('報告寫唔到落去：{reason}')
  ),
  'app-identity.diagnostics.editorMissing': entry(
    ladder(
      'No editor was found on this machine, so the report was left where it was saved.',
      'No editor was found on this machine, so the report was left where it was saved.',
      'No editor was found here, so the report stayed where it was saved.',
      'No editor turned up on this machine, so the report is sitting exactly where it was saved.',
      'No editor turned up on this machine, so the report is sitting exactly where it was saved.'
    ),
    ladder(
      '喺呢部機搵唔到編輯器，所以份報告就留喺儲存嘅位置。',
      '喺呢部機搵唔到編輯器，所以份報告就留喺儲存嘅位置。',
      '搵唔到編輯器，份報告留喺儲存位置。',
      '呢部機一個編輯器都搵唔到，份報告就乖乖坐喺儲存咗嘅位置。',
      '呢部機一個編輯器都搵唔到，份報告就乖乖坐喺儲存咗嘅位置。'
    )
  ),
  'app-identity.diagnostics.needSave': entry(
    ladder(
      'Save the report to a file first; an editor opens a file, not a clipboard.',
      'Save the report to a file first; an editor opens a file, not a clipboard.',
      'Save it to a file first — an editor opens files, not clipboards.',
      'Save it to a file first. An editor opens files; it has no idea what to do with a clipboard.',
      'Save it to a file first. An editor opens files; it has no idea what to do with a clipboard.'
    ),
    ladder(
      '要先儲成檔案；編輯器開嘅係檔案，唔係剪貼簿。',
      '要先儲成檔案；編輯器開嘅係檔案，唔係剪貼簿。',
      '先儲成檔案——編輯器開檔案，唔開剪貼簿。',
      '先儲成檔案啦。編輯器係開檔案嘅，你俾個剪貼簿佢，佢都唔知點算。',
      '先儲成檔案啦。編輯器係開檔案嘅，你俾個剪貼簿佢，佢都唔知點算。'
    )
  ),

  /* ---------------- settings ---------------- */

  'app-identity.setting.includeChosen': entry(
    ladder('Note the local display name in diagnostic reports'),
    ladder('喺診斷報告寫低本機顯示名稱')
  ),
  'app-identity.setting.includeChosen.description': entry(
    ladder(
      'Adds a line saying what this copy calls itself locally. The shipped name is always in the report regardless, because that is what tells a reader which software they are looking at.',
      'Adds a line saying what this copy calls itself locally. The shipped name is always in the report regardless, because that is what tells a reader which software they are looking at.',
      'Adds a line naming the local display name. The shipped name is in the report either way, because that is what identifies the software.',
      'Adds a line naming whatever this copy calls itself locally. The shipped name is in the report either way — it is the part that tells a stranger what they are reading.',
      'Adds a line naming whatever this copy calls itself locally. The shipped name is in the report either way — it is the part that tells a stranger what they are reading.'
    ),
    ladder(
      '加一行寫低呢一份本機叫自己咩名。無論開唔開，出廠名一定會喺報告入面，因為嗰個先話到俾人知係邊隻軟件。',
      '加一行寫低呢一份本機叫自己咩名。無論開唔開，出廠名一定會喺報告入面，因為嗰個先話到俾人知係邊隻軟件。',
      '加一行寫低本機顯示名稱。出廠名點都會喺報告入面，因為嗰個先認得出係咩軟件。',
      '加一行寫低呢一份喺本機叫自己咩名。出廠名點都會喺報告度——嗰截先至話到俾一個唔識你嘅人知，佢而家睇緊乜。',
      '加一行寫低呢一份喺本機叫自己咩名。出廠名點都會喺報告度——嗰截先至話到俾一個唔識你嘅人知，佢而家睇緊乜。'
    )
  ),
  'app-identity.setting.redactPaths': entry(
    ladder('Shorten paths in diagnostic reports'),
    ladder('喺診斷報告縮短路徑')
  ),
  'app-identity.setting.redactPaths.description': entry(
    ladder(
      'Writes paths from the application directory downwards, replacing everything above it with an ellipsis. Everything above it is an account name and a machine layout, which a report does not need in order to be useful.',
      'Writes paths from the application directory downwards, replacing everything above it with an ellipsis. Everything above it is an account name and a machine layout, which a report does not need in order to be useful.',
      'Writes paths from the application directory downwards and replaces the part above it with an ellipsis. That part is an account name and a machine layout, which the report does not need.',
      'Writes paths from the application directory downwards, with an ellipsis where the rest used to be. The rest is your account name and the shape of your machine, and a report is perfectly useful without either.',
      'Writes paths from the application directory downwards, with an ellipsis where the rest used to be. The rest is your account name and the shape of your machine, and a report is perfectly useful without either.'
    ),
    ladder(
      '路徑由程式資料夾嗰層開始寫，上面嗰截用省略號代替。上面嗰截係帳戶名同機器擺位，一份有用嘅報告根本唔需要。',
      '路徑由程式資料夾嗰層開始寫，上面嗰截用省略號代替。上面嗰截係帳戶名同機器擺位，一份有用嘅報告根本唔需要。',
      '路徑由程式資料夾開始寫，上面嗰截變省略號。嗰截係帳戶名同機器擺位，報告唔需要。',
      '路徑由程式資料夾嗰層開始寫，上面本來嗰截變咗個省略號。嗰截係你個帳戶名同你部機點擺，冇咗佢份報告一樣好用。',
      '路徑由程式資料夾嗰層開始寫，上面本來嗰截變咗個省略號。嗰截係你個帳戶名同你部機點擺，冇咗佢份報告一樣好用。'
    )
  ),
  'app-identity.setting.resetName': entry(
    ladder('Restore the shipped name'),
    ladder('回復出廠名')
  ),
  'app-identity.setting.resetName.description': entry(
    ladder(
      'Clears the display name in one action, so the application goes back to introducing itself by its shipped name. The change is recorded in local version history, so the name you had is still readable there.',
      'Clears the display name in one action, so the application goes back to introducing itself by its shipped name. The change is recorded in local version history, so the name you had is still readable there.',
      'Clears the display name in one action. The change goes into local version history, so the old name is still readable there.',
      'Clears the display name in one go and the application goes back to its shipped name. Local version history keeps the name you had, so nothing is actually lost.',
      'Clears the display name in one go and the application goes back to its shipped name. Local version history keeps the name you had, so nothing is actually lost.'
    ),
    ladder(
      '一個動作清走顯示名稱，程式即刻用返出廠名自我介紹。改動會記入本機版本紀錄，你之前個名喺嗰度仲睇得返。',
      '一個動作清走顯示名稱，程式即刻用返出廠名自我介紹。改動會記入本機版本紀錄，你之前個名喺嗰度仲睇得返。',
      '一下清走顯示名稱，改動記入本機版本紀錄，舊名喺嗰度睇得返。',
      '一下就清走顯示名稱，程式用返出廠名。本機版本紀錄會幫你留住舊個名，所以其實乜都冇冇咗。',
      '一下就清走顯示名稱，程式用返出廠名。本機版本紀錄會幫你留住舊個名，所以其實乜都冇冇咗。'
    )
  ),
  'app-identity.setting.openAbout': entry(
    ladder('Open the About surface'),
    ladder('打開「關於」嗰版')
  ),
  'app-identity.setting.openAbout.description': entry(
    ladder(
      'Opens the tab holding the rename editor, the identity checks, the licence, the credits and the diagnostic report.',
      'Opens the tab holding the rename editor, the identity checks, the licence, the credits and the diagnostic report.',
      'Opens the tab with the rename editor, the identity checks, the licence, the credits and the diagnostic report.',
      'Opens the tab where the rename editor, the identity checks, the licence, the credits and the diagnostic report all live.',
      'Opens the tab where the rename editor, the identity checks, the licence, the credits and the diagnostic report all live.'
    ),
    ladder(
      '打開嗰個分頁，入面有改名編輯器、身分檢查、授權條款、鳴謝同診斷報告。',
      '打開嗰個分頁，入面有改名編輯器、身分檢查、授權條款、鳴謝同診斷報告。',
      '打開有改名編輯器、身分檢查、授權、鳴謝同診斷報告嗰個分頁。',
      '打開嗰個分頁——改名編輯器、身分檢查、授權條款、鳴謝同診斷報告全部住喺嗰度。',
      '打開嗰個分頁——改名編輯器、身分檢查、授權條款、鳴謝同診斷報告全部住喺嗰度。'
    )
  ),

  /* ---------------- palette ---------------- */

  'app-identity.palette.about': entry(ladder('About this application'), ladder('關於呢個程式')),
  'app-identity.palette.rename': entry(ladder('Rename the application'), ladder('改程式個名')),
  'app-identity.palette.checks': entry(ladder('Identity checks'), ladder('身分檢查')),
  'app-identity.palette.credits': entry(ladder('Credits and licence'), ladder('鳴謝同授權')),
  'app-identity.palette.copyReport': entry(ladder('Copy the diagnostic report'), ladder('複製診斷報告')),
  'app-identity.palette.resetName': entry(ladder('Restore the shipped application name'), ladder('回復程式出廠名'))
};
