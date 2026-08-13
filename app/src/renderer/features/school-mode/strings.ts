import type { Catalogue, FunnyLadder, TranslationEntry } from '../../core/registry';

/**
 * Copy for the shared study-mode switch.
 *
 * Two rules govern this file.
 *
 * The funny level styles the VOICE and never the FACTS. Every rung of every
 * ladder still names the exact file, the exact folder, the exact consequence and
 * the exact route back, because a message that is funny and leaves the reader
 * unsure what a button does is a broken message.
 *
 * The mode is renamable, and once it has been renamed no surface may reveal the
 * shipped name. That is why the name-bearing keys are built at runtime by
 * `nameStrings()` and re-registered whenever the name changes: the settings
 * surface resolves a label with `t(key)` and no interpolation values, so a
 * `{name}` placeholder would render as literal braces. Baking the chosen name
 * into the ladder is what makes a renamed mode read correctly everywhere.
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
/* Static copy                                                         */
/* ------------------------------------------------------------------ */

export const SCHOOL_MODE_STRINGS: Catalogue = {
  /* --- the state control --- */
  'schoolMode.state.label': entry(ladder('Turn this mode on or off'), ladder('開定閂呢個模式')),
  'schoolMode.state.description': entry(
    ladder(
      'The switch below is the one shared record every application in this suite reads. Turning it on forces English and removes the Cantonese, bilingual, humour, personal-vocabulary and dim sum capabilities from every surface, as though they were not installed. Your existing choices stay stored and come back when it is turned off. Turning it off needs the unlock code stored on this computer.'
    ),
    ladder(
      '下面個掣係成套程式共用嗰份紀錄。開咗就會強制英文，並且喺所有畫面攞走廣東話、雙語、語氣、個人詞彙同點心驚喜，好似冇裝過噉。你原本嘅設定照樣留住，閂返就會返嚟。要閂就要用存喺呢部電腦嘅解鎖碼。'
    )
  ),
  'schoolMode.state.on': entry(ladder('On'), ladder('開咗')),
  'schoolMode.state.off': entry(ladder('Off'), ladder('閂咗')),
  'schoolMode.state.turnOn': entry(ladder('Turn it on'), ladder('開佢')),
  'schoolMode.state.turnOff': entry(ladder('Turn it off'), ladder('閂佢')),
  'schoolMode.state.mirrorNote': entry(
    ladder(
      'The line below describes this application’s local copy in its own settings file. The value itself comes from the shared record named above.'
    ),
    ladder('下面嗰行講嘅係呢個程式自己設定檔入面嗰份副本。真正嘅值嚟自上面寫住嗰份共用紀錄。')
  ),

  /* --- naming --- */
  'schoolMode.name.label': entry(ladder('Name for this mode'), ladder('呢個模式嘅名')),
  'schoolMode.name.description': entry(
    ladder(
      'Every application in the suite calls the mode whatever you type here, everywhere it appears: labels, descriptions, search results, notifications and screen-reader names. The name is written into the shared record with the state, so renaming it in one application renames it in all of them.'
    ),
    ladder(
      '你喺呢度打乜，成套程式所有地方都會叫呢個名：標籤、說明、搜尋結果、通知同讀屏名都一樣。個名同狀態一齊寫入共用紀錄，所以喺一個程式改名，全部都會改。'
    )
  ),
  'schoolMode.name.apply': entry(ladder('Apply this name'), ladder('用呢個名')),
  'schoolMode.name.useOriginal': entry(ladder('Use the original name'), ladder('用返原本個名')),
  'schoolMode.name.empty': entry(
    ladder('The mode needs a name. Nothing was changed.'),
    ladder('個模式要有個名。乜都冇改到。')
  ),
  'schoolMode.name.tooLong': entry(
    ladder('A name may be at most {max} characters. Nothing was changed.'),
    ladder('個名最多 {max} 個字。乜都冇改到。')
  ),
  'schoolMode.name.controlCharacters': entry(
    ladder('A name may not contain line breaks or control characters. Nothing was changed.'),
    ladder('個名唔可以有換行或者控制字元。乜都冇改到。')
  ),
  'schoolMode.name.renamed': entry(ladder('The mode is now called {name}.'), ladder('呢個模式而家叫做 {name}。')),

  /* --- the shared record --- */
  'schoolMode.shared.label': entry(ladder('Shared record folder'), ladder('共用紀錄資料夾')),
  'schoolMode.shared.pathLine': entry(ladder('Shared record: {path}'), ladder('共用紀錄：{path}')),
  'schoolMode.shared.authority.shared': entry(
    ladder('Read from the shared record. Every application in the suite sees the same value.'),
    ladder('由共用紀錄讀返嚟。成套程式睇到嘅值一模一樣。')
  ),
  'schoolMode.shared.authority.mirror': entry(
    ladder(
      'The shared record cannot be used right now, so this application is showing its own local copy only. Other applications may be in a different state until the record is readable again.'
    ),
    ladder('而家用唔到共用紀錄，所以呢個程式淨係顯示自己嗰份副本。喺紀錄讀得返之前，其他程式嘅狀態可能唔同。')
  ),
  'schoolMode.shared.missing': entry(
    ladder('No shared record exists yet at {path}. This application will create it the first time the mode changes.'),
    ladder('{path} 度重未有共用紀錄。呢個程式喺模式第一次改變嗰陣會整一份。')
  ),
  'schoolMode.shared.unreadable': entry(
    ladder('The shared record at {path} could not be read: {error}'),
    ladder('讀唔到 {path} 嘅共用紀錄：{error}')
  ),
  'schoolMode.shared.invalid': entry(
    ladder('The shared record at {path} was refused: {error} Nothing from it was applied.'),
    ladder('{path} 嘅共用紀錄唔收：{error} 入面啲嘢一樣都冇套用。')
  ),
  'schoolMode.shared.writeFailed': entry(
    ladder('The shared record at {path} could not be written: {error} The change stayed local to this application.'),
    ladder('寫唔到 {path} 嘅共用紀錄：{error} 呢次改動淨係留咗喺呢個程式度。')
  ),
  'schoolMode.shared.lastRead': entry(ladder('Last read at {time}'), ladder('最後讀嘅時間：{time}')),
  'schoolMode.shared.lastWritten': entry(
    ladder('Last written at {time} by {app}'),
    ladder('最後寫嘅時間：{time}，由 {app} 寫')
  ),
  'schoolMode.shared.reveal': entry(ladder('Open the shared folder'), ladder('打開共用資料夾')),
  'schoolMode.shared.revealFailed': entry(
    ladder('The shared folder could not be opened: {error}'),
    ladder('打唔開共用資料夾：{error}')
  ),
  'schoolMode.shared.folderDefault': entry(
    ladder('Leave this empty to use the derived location.'),
    ladder('留空就會用自動計出嚟嗰個位置。')
  ),

  /* --- watching --- */
  'schoolMode.watch.label': entry(ladder('How often to re-read the shared record'), ladder('幾耐讀一次共用紀錄')),
  'schoolMode.watch.description': entry(
    ladder(
      'The record is re-read on this interval, and immediately whenever this window regains focus, so a change made in another application arrives without restarting anything. A shorter interval notices a change sooner and touches the disk more often.'
    ),
    ladder(
      '每隔咁耐就讀一次紀錄，而且一返到呢個窗就即刻再讀，所以喺第二個程式改咗嘅嘢唔使重開就會生效。時間短啲會早啲知，但都會多啲讀硬碟。'
    )
  ),
  'schoolMode.watch.unit': entry(ladder('seconds'), ladder('秒')),
  'schoolMode.watch.watching': entry(
    ladder('Watching the shared record every {seconds} seconds, and on every window focus.'),
    ladder('每 {seconds} 秒睇一次共用紀錄，返到個窗嗰陣亦都會即刻睇。')
  ),
  'schoolMode.watch.stopped': entry(
    ladder('The shared record is not being watched: {error}'),
    ladder('而家冇睇住共用紀錄：{error}')
  ),
  'schoolMode.watch.refresh': entry(ladder('Re-read the shared record now'), ladder('即刻再讀一次共用紀錄')),
  'schoolMode.watch.changedElsewhere': entry(
    ladder('Another application changed the shared record. The new state is now in effect here too.'),
    ladder('第二個程式改咗共用紀錄。呢邊而家都跟咗新狀態。')
  ),

  /* --- honest disclosure --- */
  'schoolMode.toy.warning': entry(
    ladder(
      'This is a user-experience lock, not a security boundary. It is not encryption, it protects nothing from anybody else using this computer, and anyone who can reach the disk can undo it. Deleting the shared record folder at {path} resets the mode completely.'
    ),
    ladder(
      '呢個係體驗鎖，唔係保安。唔係加密，對其他用呢部電腦嘅人零防護，任何人掂到個硬碟都可以還原。刪咗 {path} 呢個共用紀錄資料夾，成個模式就會重設。'
    )
  ),

  /* --- credential --- */
  'schoolMode.credential.label': entry(ladder('Unlock code'), ladder('解鎖碼')),
  'schoolMode.credential.description': entry(
    ladder(
      'The code that turns the mode off. A password or PIN is stored as a verifier derived with PBKDF2, so the code itself is never written down; an authenticator pairing stores a standard TOTP secret. Either one lives in this computer’s credential vault and never appears in settings, exports, version history, logs or a screenshot.'
    ),
    ladder(
      '用嚟閂咗個模式嘅碼。密碼或者 PIN 只會存 PBKDF2 算出嚟嘅驗證值，個碼本身唔會寫低；配對驗證器就會存一個標準 TOTP 密鑰。兩樣都放喺呢部電腦嘅憑證庫，唔會出現喺設定、匯出、版本紀錄、日誌或者截圖。'
    )
  ),
  'schoolMode.credential.none': entry(
    ladder('No unlock code is set. Without one, the only way back is deleting the shared record folder.'),
    ladder('未設過解鎖碼。冇嘅話，淨係得刪走共用紀錄資料夾呢條路返轉頭。')
  ),
  'schoolMode.credential.password': entry(
    ladder('A password or PIN is set. It is checked against a stored verifier, never against a stored code.'),
    ladder('設咗密碼或者 PIN。對嘅係存住嗰個驗證值，唔係存住個碼。')
  ),
  'schoolMode.credential.totp': entry(
    ladder('An authenticator is paired. A current six-digit code from it turns the mode off.'),
    ladder('配對咗驗證器。用佢嗰個現時嘅六位數字碼就可以閂咗個模式。')
  ),
  'schoolMode.credential.vaultUnavailable': entry(
    ladder('This computer’s credential vault is not usable: {error} An unlock code cannot be stored until that is fixed.'),
    ladder('呢部電腦嘅憑證庫用唔到：{error} 整返掂之前存唔到解鎖碼。')
  ),
  'schoolMode.credential.backend': entry(ladder('Vault backend: {backend}'), ladder('憑證庫後端：{backend}')),
  'schoolMode.credential.setPassword': entry(ladder('Set a password or PIN…'), ladder('設一個密碼或者 PIN…')),
  'schoolMode.credential.setTotp': entry(ladder('Pair an authenticator…'), ladder('配對驗證器…')),
  'schoolMode.credential.remove': entry(ladder('Remove the unlock code'), ladder('攞走解鎖碼')),
  'schoolMode.credential.newLabel': entry(ladder('New code'), ladder('新碼')),
  'schoolMode.credential.repeatLabel': entry(ladder('Type it again'), ladder('再打一次')),
  'schoolMode.credential.mismatch': entry(
    ladder('The two entries are different. Nothing was stored.'),
    ladder('兩次打嘅唔一樣。乜都冇存到。')
  ),
  'schoolMode.credential.tooShort': entry(
    ladder('A code needs at least {min} characters. Nothing was stored.'),
    ladder('個碼最少要 {min} 個字。乜都冇存到。')
  ),
  'schoolMode.credential.stored': entry(
    ladder('The unlock code is stored. The code itself was not written anywhere.'),
    ladder('解鎖碼存好咗。個碼本身冇寫低喺任何地方。')
  ),
  'schoolMode.credential.storeFailed': entry(
    ladder('The unlock code was not stored: {error}'),
    ladder('存唔到解鎖碼：{error}')
  ),
  'schoolMode.credential.removed': entry(
    ladder('The unlock code is gone. The mode can now be turned off without one.'),
    ladder('解鎖碼冇咗。而家唔使碼都可以閂咗個模式。')
  ),
  'schoolMode.credential.pairTitle': entry(ladder('Pair an authenticator'), ladder('配對驗證器')),
  'schoolMode.credential.pairScan': entry(
    ladder('Scan this with your authenticator, or type the secret in by hand.'),
    ladder('用你嘅驗證器掃呢個，或者自己手打個密鑰。')
  ),
  'schoolMode.credential.pairQrAlt': entry(
    ladder('Pairing code for {name} on this computer, SHA-1, 6 digits, 30 second period.'),
    ladder('呢部電腦 {name} 嘅配對碼，SHA-1、6 位數字、30 秒一轉。')
  ),
  'schoolMode.credential.pairSecret': entry(ladder('Secret'), ladder('密鑰')),
  'schoolMode.credential.pairParameters': entry(
    ladder('SHA-1, 6 digits, 30 second period'),
    ladder('SHA-1、6 位數字、30 秒一轉')
  ),
  'schoolMode.credential.pairConfirm': entry(
    ladder('Type a current code to finish pairing'),
    ladder('打一個而家嘅碼完成配對')
  ),
  'schoolMode.credential.pairWrong': entry(
    ladder('That code did not match. Nothing was paired, and the previous unlock code is untouched.'),
    ladder('個碼唔啱。冇配對到，之前個解鎖碼一樣冇郁過。')
  ),
  'schoolMode.credential.pairDone': entry(ladder('Pairing complete.'), ladder('配對完成。')),
  'schoolMode.credential.reveal': entry(ladder('Show the secret'), ladder('顯示密鑰')),
  'schoolMode.credential.hide': entry(ladder('Hide the secret'), ladder('收埋密鑰')),

  /* --- unlock prompt --- */
  'schoolMode.unlock.password': entry(ladder('Password or PIN'), ladder('密碼或者 PIN')),
  'schoolMode.unlock.code': entry(ladder('Six-digit code'), ladder('六位數字碼')),
  'schoolMode.unlock.submit': entry(ladder('Unlock'), ladder('解鎖')),
  'schoolMode.unlock.cancel': entry(ladder('Keep it on'), ladder('繼續開住')),
  'schoolMode.unlock.wrong': entry(
    ladder(
      'That did not match. Nothing was changed and nothing was deleted. {attempts} attempts so far this session.'
    ),
    ladder('唔啱。乜都冇改到，乜都冇刪到。今次開機到而家試咗 {attempts} 次。')
  ),
  'schoolMode.unlock.wait': entry(
    ladder('Wait {seconds} seconds before trying again.'),
    ladder('等多 {seconds} 秒先再試。')
  ),
  'schoolMode.unlock.none': entry(
    ladder(
      'No unlock code was ever set, so there is nothing to type. The mode can be turned off from here, and deleting the shared record folder resets it too.'
    ),
    ladder('由頭到尾都未設過解鎖碼，所以冇嘢好打。喺呢度可以直接閂咗，刪走共用紀錄資料夾一樣得。')
  ),
  'schoolMode.unlock.recovery': entry(
    ladder('Forgotten it? Delete the shared record folder at {path}. That resets the mode on this computer.'),
    ladder('唔記得咗？刪咗 {path} 嗰個共用紀錄資料夾，呢部電腦嘅模式就會重設。')
  ),
  'schoolMode.unlock.vaultError': entry(
    ladder('The unlock code could not be checked: {error}'),
    ladder('對唔到解鎖碼：{error}')
  ),
  'schoolMode.unlock.done': entry(ladder('Unlocked. The mode is off.'), ladder('解咗鎖，模式閂咗。')),

  /* --- enabling without a code --- */
  'schoolMode.enable.noCodeTitle': entry(
    ladder('Turn it on with no unlock code?'),
    ladder('未設解鎖碼，照開？')
  ),
  'schoolMode.enable.noCodeBody': entry(
    ladder(
      'No unlock code is set. It will still turn off from this screen, and deleting the shared record folder at {path} resets it. Set a code first if you want it to ask for one.'
    ),
    ladder(
      '而家未設解鎖碼。喺呢一版一樣可以閂返，刪咗 {path} 呢個共用紀錄資料夾亦都會重設。想佢問你攞碼就先設一個。'
    )
  ),
  'schoolMode.enable.noCodeConfirm': entry(ladder('Turn it on anyway'), ladder('照開')),
  'schoolMode.enable.setCodeFirst': entry(ladder('Set a code first'), ladder('先設個碼')),
  'schoolMode.enable.done': entry(ladder('{name} is on. Everything is in English now.'), ladder('{name} 開咗，而家全部英文。')),

  /* --- capability list --- */
  'schoolMode.capability.title': entry(ladder('What this mode removes'), ladder('呢個模式會攞走啲乜')),
  'schoolMode.capability.description': entry(
    ladder(
      'While the mode is on, each of these behaves as though it were not installed: its controls, copy, palette entries and search results are omitted rather than merely disabled, and your stored choice for it is kept untouched until the mode goes off again.'
    ),
    ladder(
      '模式開住嗰陣，下面每樣都會好似冇裝過噉：控制項、文字、指令板同搜尋結果都會唔見咗，唔係淨係變灰，而你原本揀嘅嘢會完整咁擺住，等模式閂返先再出現。'
    )
  ),
  'schoolMode.capability.cantonese': entry(ladder('Cantonese language mode'), ladder('廣東話語言模式')),
  'schoolMode.capability.bilingual': entry(ladder('Bilingual language mode'), ladder('雙語模式')),
  'schoolMode.capability.funny': entry(ladder('Humour levels, both languages'), ladder('兩種語言嘅語氣程度')),
  'schoolMode.capability.vocabulary': entry(ladder('Personal vocabulary file'), ladder('個人詞彙檔案')),
  'schoolMode.capability.dimsum': entry(ladder('The dim sum surprise at startup'), ladder('開機嗰陣嘅點心驚喜')),
  'schoolMode.capability.hidden': entry(ladder('Removed while the mode is on'), ladder('模式開住嗰陣攞走咗')),
  'schoolMode.capability.available': entry(ladder('Available'), ladder('用得')),
  'schoolMode.capability.stored': entry(ladder('Your stored choice: {value}'), ladder('你存住嘅設定：{value}')),
  'schoolMode.capability.search': entry(ladder('Search these capabilities'), ladder('搵呢啲功能')),
  'schoolMode.capability.empty': entry(ladder('No capability matched that.'), ladder('冇功能符合。')),

  /* --- activity --- */
  'schoolMode.activity.title': entry(ladder('Activity'), ladder('活動紀錄')),
  'schoolMode.activity.description': entry(
    ladder(
      'Every change to the state, the name and the unlock method, taken from this application’s local version history. The unlock code itself is never recorded here, because it is never recorded anywhere.'
    ),
    ladder('狀態、名同解鎖方法嘅每次改動，由呢個程式嘅本機版本紀錄攞返嚟。解鎖碼本身唔會寫入呢度，因為佢邊度都唔會存。')
  ),
  'schoolMode.activity.search': entry(ladder('Search the activity'), ladder('搵活動紀錄')),
  'schoolMode.activity.empty': entry(
    ladder('Nothing has changed yet. The first change to the state, the name or the unlock code appears here.'),
    ladder('暫時乜都未變過。狀態、個名或者解鎖碼第一次改動就會喺呢度出現。')
  ),
  'schoolMode.activity.loadFailed': entry(
    ladder('The local version history could not be read: {error}'),
    ladder('讀唔到本機版本紀錄：{error}')
  ),

  /* --- generic list chrome --- */
  'schoolMode.list.selectPage': entry(ladder('Select the {count} on this page'), ladder('揀晒呢一版嘅 {count} 個')),
  'schoolMode.list.selectAll': entry(ladder('Select every match ({count})'), ladder('揀晒所有符合嘅（{count} 個）')),
  'schoolMode.list.invert': entry(ladder('Invert the selection'), ladder('反轉揀咗嘅嘢')),
  'schoolMode.list.clear': entry(ladder('Clear the selection'), ladder('唔揀住')),
  'schoolMode.list.selected': entry(ladder('{count} selected'), ladder('揀咗 {count} 個')),
  'schoolMode.list.page': entry(ladder('Page {page} of {pages}'), ladder('第 {page} 版，共 {pages} 版')),
  'schoolMode.list.previous': entry(ladder('Previous page'), ladder('上一版')),
  'schoolMode.list.next': entry(ladder('Next page'), ladder('下一版')),
  'schoolMode.list.selectRow': entry(ladder('Select {name}'), ladder('揀 {name}')),
  'schoolMode.list.previewTitle': entry(ladder('{action}: {count} items'), ladder('{action}：{count} 項')),
  'schoolMode.list.previewBody': entry(
    ladder('These are the exact items the action will run on. Nothing else is touched.'),
    ladder('下面就係會做嘅嗰啲，其他一律唔郁。')
  ),
  'schoolMode.list.previewExcluded': entry(
    ladder('{count} selected items are excluded: {reason}'),
    ladder('揀咗嘅入面有 {count} 項唔會做：{reason}')
  ),
  'schoolMode.list.previewRun': entry(ladder('Run it'), ladder('做落去')),
  'schoolMode.list.previewCancel': entry(ladder('Not now'), ladder('唔使住')),
  'schoolMode.list.nothingSelected': entry(
    ladder('Nothing is selected, so there is nothing to do.'),
    ladder('乜都冇揀，所以冇嘢好做。')
  ),
  'schoolMode.list.announceSelection': entry(ladder('{count} of {total} selected'), ladder('{total} 個入面揀咗 {count} 個')),

  /* --- bulk actions --- */
  'schoolMode.action.export': entry(ladder('Export the selection…'), ladder('匯出揀咗嘅…')),
  'schoolMode.action.copy': entry(ladder('Copy the selection'), ladder('複製揀咗嘅')),
  'schoolMode.action.copied': entry(ladder('{count} rows copied to the clipboard.'), ladder('複製咗 {count} 行去剪貼簿。')),
  'schoolMode.action.copyFailed': entry(
    ladder('The clipboard refused the copy: {error}'),
    ladder('剪貼簿唔收：{error}')
  ),
  'schoolMode.action.prune': entry(ladder('Prune history older than the oldest selected…'), ladder('清走比最舊嗰個仲舊嘅紀錄…')),
  'schoolMode.action.pruneIrreversible': entry(
    ladder('Pruned history entries are removed from the local history repository and cannot be brought back.'),
    ladder('清走咗嘅紀錄會喺本機紀錄倉庫度冇咗，攞唔返。')
  ),
  'schoolMode.action.pruned': entry(ladder('{count} history entries were removed.'), ladder('刪走咗 {count} 筆紀錄。')),
  'schoolMode.action.pruneFailed': entry(ladder('Nothing was pruned: {error}'), ladder('乜都冇清到：{error}')),
  'schoolMode.action.exportFormat': entry(ladder('Choose an export format'), ladder('揀個匯出格式')),
  'schoolMode.action.exported': entry(ladder('Exported to {path}'), ladder('匯出咗去 {path}')),
  'schoolMode.action.exportCancelled': entry(ladder('The export was cancelled. Nothing was written.'), ladder('取消咗匯出，冇寫過任何嘢。')),

  /* --- credential removal gate --- */
  'schoolMode.remove.action': entry(ladder('Remove the unlock code'), ladder('攞走解鎖碼')),
  'schoolMode.remove.irreversible': entry(
    ladder(
      'The stored verifier is deleted from this computer’s credential vault. It cannot be recovered, and a new code has to be set from scratch.'
    ),
    ladder('存喺呢部電腦憑證庫嗰個驗證值會刪走，攞唔返，要重新設過一個碼。')
  ),
  'schoolMode.remove.affected': entry(ladder('The unlock code for {name}'), ladder('{name} 嘅解鎖碼')),

  /* --- palette and tab chrome --- */
  'schoolMode.command.open': entry(ladder('Open the study-mode settings'), ladder('打開學習模式設定')),
  'schoolMode.command.toggle': entry(ladder('Turn the study mode on or off'), ladder('開閂學習模式')),
  'schoolMode.command.refresh': entry(ladder('Re-read the shared study-mode record'), ladder('再讀一次共用學習模式紀錄')),
  'schoolMode.command.reveal': entry(ladder('Open the shared study-mode folder'), ladder('打開共用學習模式資料夾')),
  'schoolMode.command.setCode': entry(ladder('Set the study-mode unlock code'), ladder('設學習模式解鎖碼')),
  'schoolMode.tab.summary': entry(
    ladder('One shared switch, read live from a record every application in this suite shares.'),
    ladder('一個共用掣，直接讀成套程式共用嗰份紀錄，即時生效。')
  ),
  'schoolMode.section.status': entry(ladder('Current state'), ladder('目前狀態')),
  'schoolMode.section.record': entry(ladder('The shared record'), ladder('共用紀錄')),
  'schoolMode.section.unlock': entry(ladder('Unlocking'), ladder('解鎖')),
  'schoolMode.openSettings': entry(ladder('Open this in settings'), ladder('喺設定度開'))
};

/* ------------------------------------------------------------------ */
/* Name-bearing copy                                                   */
/* ------------------------------------------------------------------ */

/**
 * Builds the keys that carry the mode's chosen name.
 *
 * These are re-registered every time the name changes, in either application,
 * so that a renamed mode reads correctly on a surface that resolves its label
 * without interpolation values — and so that the shipped name never appears
 * once the user has chosen their own.
 */
export function nameStrings(name: string): Catalogue {
  return {
    'schoolMode.section.title': entry(ladder(name), ladder(name)),
    'schoolMode.tab.title': entry(ladder(name), ladder(name)),
    'schoolMode.state.heading': entry(ladder(name), ladder(name)),
    'schoolMode.state.isOn': entry(ladder(`${name} is on`), ladder(`${name} 開咗`)),
    'schoolMode.state.isOff': entry(ladder(`${name} is off`), ladder(`${name} 閂咗`)),
    'schoolMode.unlock.title': entry(ladder(`Turn off ${name}`), ladder(`閂咗 ${name}`)),
    'schoolMode.state.switchLabel': entry(ladder(name), ladder(name))
  };
}
