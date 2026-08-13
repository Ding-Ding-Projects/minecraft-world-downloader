import type { Catalogue, FunnyLadder, TranslationEntry } from '../../core/registry';

/**
 * This feature's copy, in English and in playful Hong Kong Cantonese, at all
 * five humour levels for each.
 *
 * The rule the whole ladder is written against: the level styles the VOICE and
 * never the FACTS. Level 5 is allowed to be funny about a toy lock; it is not
 * allowed to stop naming the folder that resets it, the exact thing that is
 * locked, or the fact that this protects nothing from anybody else using this
 * computer. A joke that leaves somebody unsure whether their data is safe is a
 * broken string, not a good one.
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

export const LOCK_STRINGS: Catalogue = {
  /* --- the destination --- */
  'locks.title': entry(ladder('Locks'), ladder('鎖')),
  'locks.subtitle': entry(
    ladder(
      'Every lock in this application, each with its own credential.',
      'Every lock in this application, each with its own credential.',
      'Everything you have put behind a password or a code, each with its own answer.',
      'Everything you have locked, every one with its own answer. There is no master key, on purpose.',
      'Everything you have locked, every one with its own answer. There is no master key, on purpose.'
    ),
    ladder(
      '呢個程式入面所有鎖，每個都有自己嘅密碼。',
      '呢個程式入面所有鎖，每個都有自己嘅密碼。',
      '你鎖過嘅嘢全部喺度，每個鎖有自己嗰條匙。',
      '你鎖過嘅嘢全部喺度，每個鎖有自己嗰條匙。冇萬能鎖匙，係特登嘅。',
      '你鎖過嘅嘢全部喺度，每個鎖有自己嗰條匙。冇萬能鎖匙，係特登嘅。'
    )
  ),

  /* --- the disclosure, said every single time --- */
  'locks.forFun.title': entry(ladder('This is just for fun'), ladder('呢啲鎖純粹好玩')),
  'locks.forFun.body': entry(
    ladder(
      'A lock here is a speed bump you set for yourself. It is not security, it is not encryption, and it protects nothing from anybody else who can use this computer. Deleting {path} removes every lock on this list.',
      'A lock here is a speed bump you set for yourself. It is not security, it is not encryption, and it protects nothing from anybody else who can use this computer. Deleting {path} removes every lock on this list.',
      'A lock here is a speed bump you put in your own way. Not security, not encryption, and no obstacle at all to anybody else sitting at this computer. Deleting {path} removes every lock on this list.',
      'A lock here is a speed bump you put in your own way, and it is very proud of itself. It is still not security, still not encryption, and still no obstacle at all to anybody else sitting at this computer. Deleting {path} removes every lock on this list.',
      'A lock here is a speed bump you put in your own way, and it is very proud of itself. It is still not security, still not encryption, and still no obstacle at all to anybody else sitting at this computer. Deleting {path} removes every lock on this list.'
    ),
    ladder(
      '呢啲鎖係你自己畀自己嘅減速墊。唔係保安，唔係加密，對其他用得呢部電腦嘅人零阻礙。刪咗 {path} 就會清走呢張單上面每一個鎖。',
      '呢啲鎖係你自己畀自己嘅減速墊。唔係保安，唔係加密，對其他用得呢部電腦嘅人零阻礙。刪咗 {path} 就會清走呢張單上面每一個鎖。',
      '呢啲鎖係你自己擺喺自己路中間嘅減速墊。唔係保安，唔係加密，對住其他坐喺呢部電腦前面嘅人完全冇用。刪咗 {path}，成張單嘅鎖一齊冇。',
      '呢啲鎖係你自己擺喺自己路中間嘅減速墊，仲要好自豪。佢一樣唔係保安、唔係加密，對住其他坐喺呢部電腦前面嘅人一樣完全冇用。刪咗 {path}，成張單嘅鎖一齊冇。',
      '呢啲鎖係你自己擺喺自己路中間嘅減速墊，仲要好自豪。佢一樣唔係保安、唔係加密，對住其他坐喺呢部電腦前面嘅人一樣完全冇用。刪咗 {path}，成張單嘅鎖一齊冇。'
    )
  ),
  'locks.recovery.title': entry(ladder('If you are locked out'), ladder('如果解唔到鎖')),
  'locks.recovery.body': entry(
    ladder(
      'Delete this folder and every lock is gone, along with everything else stored locally with it: {path}. There is no reset ticket, no account and no support channel, because nothing here leaves this machine.'
    ),
    ladder(
      '刪咗呢個資料夾，所有鎖一齊冇，同埋一齊存喺入面嘅其他本機資料都會冇：{path}。冇重設申請、冇帳戶、冇客服，因為呢度啲嘢根本冇離開過部機。'
    )
  ),
  'locks.recovery.open': entry(ladder('Open that folder'), ladder('開嗰個資料夾')),
  'locks.recovery.copy': entry(ladder('Copy the folder path'), ladder('複製資料夾路徑')),
  'locks.recovery.failed': entry(
    ladder('The file manager could not be opened: {reason}. The folder is {path}.'),
    ladder('開唔到檔案總管：{reason}。個資料夾係 {path}。')
  ),

  /* --- the list --- */
  'locks.list.label': entry(ladder('Locks'), ladder('鎖嘅清單')),
  'locks.list.search': entry(ladder('Search locks'), ladder('搵鎖')),
  'locks.list.empty.title': entry(
    ladder('Nothing is locked yet'),
    ladder('暫時乜都未鎖')
  ),
  'locks.list.empty.body': entry(
    ladder(
      'Right-click any element and choose "Lock this element…", or start from here.',
      'Right-click any element and choose "Lock this element…", or start from here.',
      'Right-click anything at all and choose "Lock this element…", or start from the button below.',
      'Right-click anything at all and choose "Lock this element…", or start from the button below. It will ask you what you are locking before it locks it.',
      'Right-click anything at all and choose "Lock this element…", or start from the button below. It will ask you what you are locking before it locks it.'
    ),
    ladder(
      '喺任何元素撳右鍵揀「鎖住呢個元素…」，或者由呢度開始。',
      '喺任何元素撳右鍵揀「鎖住呢個元素…」，或者由呢度開始。',
      '喺乜嘢上面撳右鍵都得，揀「鎖住呢個元素…」，或者用下面粒掣開始。',
      '喺乜嘢上面撳右鍵都得，揀「鎖住呢個元素…」，或者用下面粒掣開始。佢會先問清楚你鎖緊乜先至鎖。',
      '喺乜嘢上面撳右鍵都得，揀「鎖住呢個元素…」，或者用下面粒掣開始。佢會先問清楚你鎖緊乜先至鎖。'
    )
  ),
  'locks.list.noMatch': entry(
    ladder('No lock matched. {total} locks exist.'),
    ladder('冇鎖符合。總共有 {total} 個鎖。')
  ),
  'locks.list.count': entry(
    ladder('Showing {shown} of {total} locks, page {page} of {pages}.'),
    ladder('顯示緊 {total} 個鎖入面嘅 {shown} 個，第 {page} 頁，共 {pages} 頁。')
  ),
  'locks.list.previousPage': entry(ladder('Previous page'), ladder('上一頁')),
  'locks.list.nextPage': entry(ladder('Next page'), ladder('下一頁')),
  'locks.manager.exempt': entry(
    ladder(
      'This page is never blocked by an element lock, so a lock can always be removed from here.'
    ),
    ladder('呢一版永遠唔會俾元素鎖擋住，所以喺呢度一定刪得走個鎖。')
  ),
  'locks.list.firstPage': entry(ladder('This is the first page.'), ladder('已經係第一頁。')),
  'locks.list.lastPage': entry(ladder('This is the last page.'), ladder('已經係最後一頁。')),
  'locks.relock.nothing': entry(ladder('There are no locks to lock again.'), ladder('冇鎖可以再鎖。')),
  'locks.export.nothing': entry(ladder('There is nothing to export yet.'), ladder('而家未有嘢可以匯出。')),
  'locks.relocked.count': entry(
    ladder('{count} surfaces were unlocked and are locked again.'),
    ladder('有 {count} 個地方本來解咗鎖，而家鎖返晒。')
  ),
  'locks.action.alreadyUnlocked': entry(ladder('This is already unlocked.'), ladder('呢個已經解咗鎖。')),
  'locks.reveal.absent': entry(
    ladder('Nothing matching {selector} is on screen right now.'),
    ladder('而家畫面上冇任何嘢符合 {selector}。')
  ),
  'locks.state.locked': entry(ladder('Locked'), ladder('鎖住咗')),
  'locks.state.unlocked': entry(ladder('Unlocked'), ladder('解咗鎖')),
  'locks.state.unlockedUntilClose': entry(
    ladder('Unlocked until the application closes'),
    ladder('解咗鎖，直到閂咗程式')
  ),
  'locks.row.created': entry(ladder('Created {when}'), ladder('{when} 整嘅')),
  'locks.row.method': entry(ladder('Unlocks with: {method}'), ladder('解鎖方法：{method}')),
  'locks.row.duration': entry(ladder('Stays unlocked: {duration}'), ladder('解鎖之後維持：{duration}')),
  'locks.row.select': entry(ladder('Select this lock'), ladder('揀呢個鎖')),

  /* --- who enforces what --- */
  'locks.enforced.tab': entry(
    ladder('Opening this tab asks for its credential.'),
    ladder('開呢個分頁要輸入佢自己嘅密碼。')
  ),
  'locks.enforced.setting': entry(
    ladder('Changing this setting asks for its credential, in the settings surface and in the command palette.'),
    ladder('改呢個設定要輸入佢自己嘅密碼，設定頁同指令板都一樣。')
  ),
  'locks.enforced.element': entry(
    ladder('Clicking or activating any element matching this selector asks for its credential.'),
    ladder('撳或者啟動任何符合呢個選擇器嘅元素，都要輸入佢自己嘅密碼。')
  ),
  'locks.enforced.appearance': entry(
    ladder('This appearance value is restored immediately if it is changed while the lock is on.'),
    ladder('鎖住嗰陣改咗呢個外觀數值，會即刻改返轉頭。')
  ),
  'locks.enforced.unknown': entry(
    ladder('Nothing in this build enforces this target, so the lock is a record only. It is listed rather than hidden.'),
    ladder('呢個版本冇任何地方執行呢個目標，所以佢淨係一筆紀錄。照樣列出嚟，唔會收埋。')
  ),

  /* --- per-row actions --- */
  'locks.action.unlock': entry(ladder('Unlock'), ladder('解鎖')),
  'locks.action.relock': entry(ladder('Lock everything again'), ladder('全部再鎖返')),
  'locks.action.replace': entry(ladder('Replace this credential…'), ladder('換咗呢個密碼…')),
  'locks.action.remove': entry(ladder('Remove this lock'), ladder('刪走呢個鎖')),
  'locks.action.reveal': entry(ladder('Go to what this locks'), ladder('去返被鎖嗰樣嘢')),
  'locks.action.copyTarget': entry(ladder('Copy the target'), ladder('複製目標')),
  'locks.action.new': entry(ladder('Lock something…'), ladder('鎖啲嘢…')),
  'locks.action.export': entry(ladder('Export the list'), ladder('匯出張單')),
  'locks.replace.explain': entry(
    ladder(
      'This replaces the credential and the unlock duration for {label}. The old credential stops working the moment the new one is stored, and nothing else on the list is touched.'
    ),
    ladder(
      '呢個會換走 {label} 嘅密碼同解鎖時間。新嗰個一存低，舊嗰個即刻唔再有效，張單上面其他鎖唔會郁。'
    )
  ),

  /* --- selection and bulk --- */
  'locks.bulk.selectPage': entry(ladder('Select the {count} on this page'), ladder('揀呢一頁嘅 {count} 個')),
  'locks.bulk.selectAll': entry(ladder('Select every one of the {count} matches'), ladder('揀晒符合嘅 {count} 個')),
  'locks.bulk.invert': entry(ladder('Invert the selection'), ladder('反轉揀咗嘅嘢')),
  'locks.bulk.clear': entry(ladder('Clear the selection'), ladder('唔揀啦')),
  'locks.bulk.selected': entry(
    ladder('{count} selected. {affected} will change; {skipped} would be skipped.'),
    ladder('揀咗 {count} 個。有 {affected} 個會改到，{skipped} 個會跳過。')
  ),
  'locks.bulk.removeTitle': entry(ladder('Remove {count} locks'), ladder('刪走 {count} 個鎖')),
  'locks.bulk.removeIrreversible': entry(
    ladder(
      'The locks and their credentials are deleted from the credential vault. The things they covered become ordinary unlocked surfaces again. Removing a lock is recorded in local history; the credential itself never was and cannot be recovered.'
    ),
    ladder(
      '啲鎖同佢哋嘅密碼會由憑證庫刪走，被鎖嘅嘢會變返普通冇鎖嘅樣。刪鎖呢件事會入本機歷史，但密碼本身從來冇入過，救唔返。'
    )
  ),
  'locks.bulk.removed': entry(ladder('{count} locks removed'), ladder('刪走咗 {count} 個鎖')),
  'locks.bulk.removeFailed': entry(
    ladder('{count} locks could not be removed: {reason}'),
    ladder('有 {count} 個鎖刪唔到：{reason}')
  ),
  'locks.bulk.preview': entry(ladder('What will change'), ladder('會改到啲乜')),
  'locks.bulk.needSelection': entry(
    ladder('Nothing is selected, so nothing will happen.'),
    ladder('乜都冇揀，所以乜都唔會發生。')
  ),
  'locks.bulk.relockScope': entry(
    ladder(
      'Locking again is all-or-nothing in this build: it relocks every surface that is currently unlocked, not only the ones selected. {count} are unlocked right now.'
    ),
    ladder(
      '呢個版本嘅「再鎖返」係一次過嘅：會鎖返所有而家解咗鎖嘅嘢，唔淨係你揀嗰啲。而家有 {count} 個係解咗鎖。'
    )
  ),
  'locks.relocked': entry(
    ladder('Everything is locked again'),
    ladder('全部鎖返晒')
  ),

  /* --- the picker and the bulk wizard --- */
  'locks.picker.title': entry(ladder('Choose what to lock'), ladder('揀鎖乜嘢')),
  'locks.picker.search': entry(ladder('Search things you can lock'), ladder('搵可以鎖嘅嘢')),
  'locks.picker.kind': entry(ladder('Kind of thing'), ladder('邊類嘢')),
  'locks.picker.kind.tab': entry(ladder('Tabs'), ladder('分頁')),
  'locks.picker.kind.setting': entry(ladder('Settings'), ladder('設定')),
  'locks.picker.kind.element': entry(ladder('Elements on screen'), ladder('畫面上嘅元素')),
  'locks.picker.kind.appearance': entry(ladder('Appearance values'), ladder('外觀數值')),
  'locks.picker.property': entry(ladder('Appearance property'), ladder('外觀屬性')),
  'locks.picker.empty': entry(
    ladder('Nothing of this kind is on screen right now.'),
    ladder('而家畫面上冇呢類嘢。')
  ),
  'locks.picker.alreadyLocked': entry(ladder('Already locked'), ladder('已經鎖咗')),
  'locks.picker.breadth': entry(
    ladder(
      'A broad selector locks every element it matches, which can be a great many of them. The unlock prompt itself always stays reachable.'
    ),
    ladder(
      '範圍闊嘅選擇器會鎖住所有符合嘅元素，可能會好多。解鎖嘅視窗本身一定仲撳得到。'
    )
  ),
  'locks.picker.continue': entry(ladder('Set up {count} locks'), ladder('開始整 {count} 個鎖')),
  'locks.picker.rescan': entry(ladder('Scan the window again'), ladder('再掃描個窗一次')),
  'locks.picker.notLockable': entry(
    ladder('This setting cannot be locked.'),
    ladder('呢個設定鎖唔到。')
  ),
  'locks.picker.summary': entry(
    ladder('{count} selected of {total} shown. {replacing} of them already have a lock and would get a new credential.'),
    ladder('喺顯示嘅 {total} 個入面揀咗 {count} 個，其中 {replacing} 個已經有鎖，會換上新密碼。')
  ),
  'locks.queue.title': entry(ladder('One credential each'), ladder('一個鎖一條匙')),
  'locks.queue.body': entry(
    ladder(
      'Each of these gets its own lock and its own credential. Nothing is shared between them: if you want one password everywhere, you get there by deliberately typing the same one into each wizard.'
    ),
    ladder(
      '呢啲每一個都有自己嘅鎖同自己嘅密碼，互相唔通用。如果你想全部用同一個密碼，就要特登喺每個精靈度打多次同一個。'
    )
  ),
  'locks.queue.create': entry(ladder('Create this lock…'), ladder('整呢個鎖…')),
  'locks.queue.done': entry(ladder('Locked'), ladder('鎖咗')),
  'locks.queue.progress': entry(ladder('{done} of {total} locked'), ladder('{total} 個入面鎖咗 {done} 個')),

  /* --- the guard --- */
  'locks.guard.blocked': entry(
    ladder(
      '{label} is locked. Unlock it to use it.',
      '{label} is locked. Unlock it to use it.',
      '{label} is locked, so that did nothing. Unlock it to carry on.',
      '{label} is locked, so that click went nowhere. You did this to yourself, on purpose. Unlock it to carry on.',
      '{label} is locked, so that click went nowhere. You did this to yourself, on purpose. Unlock it to carry on.'
    ),
    ladder(
      '{label} 鎖咗，要解鎖先用得。',
      '{label} 鎖咗，要解鎖先用得。',
      '{label} 鎖咗，所以頭先撳嗰下乜都冇發生。解咗鎖先再嚟。',
      '{label} 鎖咗，所以頭先撳嗰下石沉大海。呢個係你自己特登搞出嚟嘅。解咗鎖先再嚟。',
      '{label} 鎖咗，所以頭先撳嗰下石沉大海。呢個係你自己特登搞出嚟嘅。解咗鎖先再嚟。'
    )
  ),
  'locks.guard.appearanceReverted': entry(
    ladder(
      'The {property} of {selector} is locked, so it was put back to {value}. Nothing else changed.'
    ),
    ladder(
      '{selector} 嘅 {property} 鎖咗，所以已經改返做 {value}。其他嘢冇郁過。'
    )
  ),
  'locks.guard.unlockAction': entry(ladder('Unlock it'), ladder('解鎖佢')),
  'locks.guard.unlockedBody': entry(
    ladder('{label} is unlocked. Activate it again to use it.'),
    ladder('{label} 解咗鎖，再撳一次就用得。')
  ),
  'locks.guard.noOverride': entry(ladder('no override'), ladder('冇覆寫')),
  'locks.relocked.reason': entry(ladder('Relocked because {reason}.'), ladder('鎖返嘅原因：{reason}。')),
  'locks.guard.badge': entry(ladder('Locked. Activating this asks for its credential.'), ladder('鎖咗。要用就要輸入佢自己嘅密碼。')),

  /* --- settings --- */
  'locks.settings.section': entry(ladder('Locks'), ladder('鎖')),
  'locks.settings.badge': entry(ladder('Mark locked elements'), ladder('喺鎖咗嘅元素加記號')),
  'locks.settings.badge.description': entry(
    ladder(
      'Adds a small padlock and a screen-reader description to every element a lock covers, so a locked control reads as locked rather than as broken.'
    ),
    ladder(
      '會喺每個被鎖嘅元素加個細鎖頭同埋一句畀螢幕閱讀器嘅說明，令鎖咗嘅控制項睇落係鎖咗，而唔係壞咗。'
    )
  ),
  'locks.settings.relockOnBlur': entry(ladder('Lock everything again when the window loses focus'), ladder('個窗一失去焦點就全部鎖返')),
  'locks.settings.relockOnBlur.description': entry(
    ladder(
      'When you switch to another application, every surface that is currently unlocked goes back to locked. Unlock durations are measured from the moment you unlock, so this only ever shortens them.'
    ),
    ladder(
      '你轉去用第個程式嗰陣，所有而家解咗鎖嘅嘢會鎖返。解鎖時間由你解鎖嗰刻計，所以呢個設定只會令時間短咗，唔會長咗。'
    )
  ),
  'locks.settings.idleMinutes': entry(ladder('Lock everything again after idle minutes'), ladder('閒置幾多分鐘之後全部鎖返')),
  'locks.settings.idleMinutes.description': entry(
    ladder(
      'Counts from the last pointer or keyboard activity in this window. 0 turns it off, which is the value this build ships with.'
    ),
    ladder(
      '由呢個窗最後一次有滑鼠或者鍵盤動作開始計。0 即係唔用，亦都係呢個版本出廠嘅數值。'
    )
  ),
  'locks.settings.recovery': entry(ladder('If you are locked out'), ladder('如果解唔到鎖')),
  'locks.settings.recovery.description': entry(
    ladder(
      'Names the exact folder that resets every lock on this machine, and opens it for you. The application never deletes it for you: that deletion is yours to make in your own file manager.'
    ),
    ladder(
      '會講明清楚邊個資料夾一刪就重設呢部機所有鎖，仲可以幫你開埋。程式唔會幫你刪：要刪就你自己喺檔案總管度刪。'
    )
  ),
  'locks.settings.relockNow': entry(ladder('Lock everything again now'), ladder('而家即刻全部鎖返')),
  'locks.settings.relockNow.description': entry(
    ladder(
      'Clears every unlock immediately, whatever duration it was given. The locks themselves and their credentials are untouched.'
    ),
    ladder(
      '即刻清走所有解鎖狀態，唔理當初畀咗幾長時間。啲鎖同密碼本身唔會有事。'
    )
  ),
  'locks.settings.manage': entry(ladder('Manage every lock'), ladder('管理所有鎖')),
  'locks.settings.manage.description': entry(
    ladder('Opens the Locks destination, where every lock can be searched, replaced, removed or exported.'),
    ladder('開個「鎖」嗰版，喺嗰度可以搵、換、刪或者匯出每個鎖。')
  ),

  /* --- palette --- */
  'locks.palette.manage': entry(ladder('Manage locks'), ladder('管理啲鎖')),
  'locks.palette.new': entry(ladder('Lock something…'), ladder('鎖啲嘢…')),
  'locks.palette.relock': entry(ladder('Lock every unlocked surface again'), ladder('將解咗鎖嘅嘢全部鎖返')),
  'locks.palette.recovery': entry(ladder('Open the folder that resets every lock'), ladder('開嗰個一刪就重設所有鎖嘅資料夾')),

  /* --- export --- */
  'locks.export.done': entry(ladder('Exported {count} locks to {path}'), ladder('匯出咗 {count} 個鎖去 {path}')),
  'locks.export.omitted': entry(
    ladder('No credential is in that file. Passwords and one-time-code secrets stay in the credential vault.'),
    ladder('個檔案入面冇任何密碼。密碼同一次性碼嘅種子留喺憑證庫入面。')
  )
};
