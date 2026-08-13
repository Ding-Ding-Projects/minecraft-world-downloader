/**
 * Every piece of copy this feature renders, in English and in playful Hong Kong
 * Cantonese, at all five humour levels.
 *
 * The rule the whole catalogue obeys: humour styles the sentence, never the
 * facts. A window, a setting id, a timezone, an HTTP status, a rule name and the
 * words "this cannot be undone" read identically at level 1 and level 5 — only
 * the wrapping around them changes. Anything a user checks their schedule against
 * is a fact.
 */

import type { Catalogue, FunnyLadder } from '../../core/registry';

/**
 * Expands a short ladder to five levels.
 *
 * One string means the copy genuinely reads the same at every level, which is
 * right for a plain noun. Two means serious and playful. Three means serious,
 * middle and playful. Five is written out.
 */
function ladder(...steps: string[]): FunnyLadder {
  const [a, b, c, d, e] = steps;
  if (steps.length === 1) return [a, a, a, a, a];
  if (steps.length === 2) return [a, a, b, b, b];
  if (steps.length === 3) return [a, a, b, c, c];
  if (steps.length === 4) return [a, b, c, d, d];
  return [a, b, c, d, e];
}

function entry(en: FunnyLadder, yue: FunnyLadder): { en: FunnyLadder; yue: FunnyLadder } {
  return { en, yue };
}

export const strings: Catalogue = {
  /* ---------------- surface titles ---------------- */

  'schedule.tab.title': entry(
    ladder('Schedule', 'Schedule', 'On a timer'),
    ladder('排程', '排程', '定時搞掂')
  ),
  'schedule.section.title': entry(
    ladder('Scheduled settings', 'Scheduled settings', 'Settings on a timer'),
    ladder('排程設定', '排程設定', '啲設定識自己轉')
  ),
  'schedule.heading.title': entry(
    ladder('Scheduled settings', 'Scheduled settings', 'Settings that change themselves'),
    ladder('排程設定', '排程設定', '識自己㩒掣嘅設定')
  ),
  'schedule.heading.description': entry(
    ladder(
      'A rule sets one or more settings for a chosen time window. The values it changes are borrowed: when the window ends, every setting goes back to the value it had before the rule took it.',
      'A rule sets one or more settings for a chosen time window. The values it changes are borrowed: when the window ends, every setting goes back to the value it had before the rule took it.',
      'A rule borrows settings for a while and gives them back after. Nothing is kept: when the window ends, every setting goes back exactly to the value it had before.'
    ),
    ladder(
      '一條規則喺你揀嘅時段內改一項或多項設定。改咗嘅值只係借：時段完咗，每項設定都會變返做被借之前嗰個值。',
      '一條規則喺你揀嘅時段內改一項或多項設定。改咗嘅值只係借：時段完咗，每項設定都會變返做被借之前嗰個值。',
      '規則係借嘢，唔係搶嘢。時段完咗，每項設定都乖乖變返做原本嗰個值，一個都唔會走數。'
    )
  ),

  /* ---------------- timezone ---------------- */

  'schedule.timezone.label': entry(ladder('Times are read in your local timezone'), ladder('時間以你本機時區計')),
  'schedule.timezone.dst': entry(
    ladder(
      'This zone changes its offset for daylight saving. A wall-clock time that the local clock skips in spring never matches, and a time the clock repeats in autumn matches on both passes.',
      'This zone changes its offset for daylight saving. A wall-clock time that the local clock skips in spring never matches, and a time the clock repeats in autumn matches on both passes.',
      'This zone does the daylight-saving dance. A time the clock jumps over in spring never fires, and a time the clock plays twice in autumn fires twice.'
    ),
    ladder(
      '呢個時區會因為夏令時間改時差。春天時鐘跳過嘅鐘點永遠唔會中，秋天時鐘行多次嘅鐘點就兩次都會中。',
      '呢個時區會因為夏令時間改時差。春天時鐘跳過嘅鐘點永遠唔會中，秋天時鐘行多次嘅鐘點就兩次都會中。',
      '呢個時區會跟住夏令時間跳舞。春天時鐘飛咗嗰個鐘點就唔會響，秋天時鐘行多次嗰個鐘點就會響兩次。'
    )
  ),
  'schedule.timezone.noDst': entry(
    ladder('This zone keeps one offset all year, so no daylight-saving edge case applies.'),
    ladder('呢個時區成年得一個時差，所以冇夏令時間嘅邊界問題。')
  ),

  /* ---------------- list and toolbar ---------------- */

  'schedule.list.label': entry(ladder('Schedule rules'), ladder('排程規則')),
  'schedule.search.label': entry(ladder('Search rules'), ladder('搵規則')),
  'schedule.search.placeholder': entry(ladder('Name, setting id or source'), ladder('名、設定 id 或者來源')),
  'schedule.column.enabled': entry(ladder('On'), ladder('開')),
  'schedule.column.name': entry(ladder('Rule'), ladder('規則')),
  'schedule.column.when': entry(ladder('When'), ladder('幾時')),
  'schedule.column.source': entry(ladder('Source'), ladder('來源')),
  'schedule.column.settings': entry(ladder('Settings'), ladder('設定')),
  'schedule.column.priority': entry(ladder('Priority'), ladder('優先')),
  'schedule.column.state': entry(ladder('State'), ladder('狀態')),
  'schedule.column.actions': entry(ladder('Actions'), ladder('動作')),

  'schedule.action.new': entry(
    ladder('New rule', 'New rule', 'Add a rule'),
    ladder('新規則', '新規則', '加條規則')
  ),
  'schedule.action.edit': entry(ladder('Edit'), ladder('改')),
  'schedule.action.duplicate': entry(ladder('Duplicate'), ladder('複製')),
  'schedule.action.delete': entry(ladder('Delete'), ladder('刪除')),
  'schedule.action.enable': entry(ladder('Enable'), ladder('開著')),
  'schedule.action.disable': entry(ladder('Disable'), ladder('熄咗')),
  'schedule.action.export': entry(ladder('Export'), ladder('匯出')),
  'schedule.action.refresh': entry(ladder('Refresh now'), ladder('即刻更新')),
  'schedule.action.refreshAll': entry(ladder('Refresh every source now'), ladder('即刻更新所有來源')),
  'schedule.action.releaseAll': entry(ladder('Release every override now'), ladder('即刻放返晒所有設定')),
  'schedule.action.release': entry(ladder('Release'), ladder('放返')),
  'schedule.action.open': entry(ladder('Open the schedule'), ladder('打開排程')),
  'schedule.action.save': entry(ladder('Save rule'), ladder('儲存規則')),
  'schedule.action.cancel': entry(ladder('Cancel'), ladder('取消')),
  'schedule.action.selectAll': entry(ladder('Select every rule'), ladder('揀晒所有規則')),
  'schedule.action.selectMatches': entry(ladder('Select every match'), ladder('揀晒所有符合嘅')),
  'schedule.action.invertSelection': entry(ladder('Invert the selection'), ladder('倒轉揀')),
  'schedule.action.clearSelection': entry(ladder('Clear the selection'), ladder('唔揀住')),
  'schedule.action.selectRow': entry(ladder('Select this rule'), ladder('揀呢條規則')),
  'schedule.action.rowMenu': entry(ladder('Actions for this rule'), ladder('呢條規則嘅動作')),

  /* ---------------- selection and bulk ---------------- */

  'schedule.selection.count': entry(
    ladder('{selected} of {total} rules selected'),
    ladder('揀咗 {selected} 條，一共 {total} 條')
  ),
  'schedule.selection.scope': entry(
    ladder('Select all here selects the {shown} rules the current search shows, not all {total} stored rules.'),
    ladder('「全揀」揀嘅係而家搜尋顯示嘅 {shown} 條，唔係全部 {total} 條。')
  ),
  'schedule.bulk.previewTitle': entry(
    ladder('Review before this runs'),
    ladder('做之前睇清楚')
  ),
  'schedule.bulk.previewBody': entry(
    ladder('{action} will affect these {count} rule(s):'),
    ladder('{action} 會影響呢 {count} 條規則：')
  ),
  'schedule.bulk.skipped': entry(
    ladder('{count} selected rule(s) were skipped: {reason}'),
    ladder('有 {count} 條揀咗嘅規則跳咗過：{reason}')
  ),

  /* ---------------- empty and error states ---------------- */

  'schedule.empty.title': entry(
    ladder('No rules yet', 'No rules yet', 'Nothing on the timer yet'),
    ladder('未有規則', '未有規則', '個計時器仲係吉嘅')
  ),
  'schedule.empty.body': entry(
    ladder(
      'A rule changes chosen settings inside a time window and hands them back afterwards. Nothing is scheduled until you make one.',
      'A rule changes chosen settings inside a time window and hands them back afterwards. Nothing is scheduled until you make one.',
      'A rule changes the settings you pick for a while, then puts them back. Until you make one, nothing happens on its own.'
    ),
    ladder(
      '一條規則會喺指定時段改你揀嘅設定，之後放返。未整過規則之前，乜都唔會自己變。',
      '一條規則會喺指定時段改你揀嘅設定，之後放返。未整過規則之前，乜都唔會自己變。',
      '規則就係幫你喺某段時間改設定，跟住放返。你未整過之前，乜都唔會郁。'
    )
  ),
  'schedule.empty.search': entry(
    ladder('No rule matched that search.'),
    ladder('冇規則配到呢個搜尋。')
  ),

  'schedule.quarantine.title': entry(
    ladder('Rules that were not loaded'),
    ladder('冇載入到嘅規則')
  ),
  'schedule.quarantine.body': entry(
    ladder(
      'These rules are still stored exactly as they are. None of them is running, and none of them was deleted.',
      'These rules are still stored exactly as they are. None of them is running, and none of them was deleted.',
      'These are still sitting in the file untouched. None is running, and nothing was thrown away.'
    ),
    ladder(
      '呢啲規則原封不動咁留喺檔案入面，冇一條喺度行緊，亦都冇刪過。',
      '呢啲規則原封不動咁留喺檔案入面，冇一條喺度行緊，亦都冇刪過。',
      '呢啲仲原封不動放喺檔案度，冇一條行緊，一條都冇掉。'
    )
  ),

  /* ---------------- active overrides ---------------- */

  'schedule.active.title': entry(
    ladder('In effect right now'),
    ladder('而家生效緊')
  ),
  'schedule.active.none': entry(
    ladder('No rule is holding a setting at the moment, so every setting shows its own base value.'),
    ladder('而家冇規則揸住任何設定，所以每項設定顯示嘅都係佢自己嘅原本值。')
  ),
  'schedule.active.baseValue': entry(ladder('Base value: {value}'), ladder('原本值：{value}')),
  'schedule.active.baseMissing': entry(
    ladder('No stored base value; the setting goes back to the application default {value}.'),
    ladder('冇儲過原本值；設定會變返做程式預設 {value}。')
  ),
  'schedule.active.setBy': entry(ladder('Set by "{rule}"'), ladder('由「{rule}」設定')),
  'schedule.active.contested': entry(
    ladder('Also claimed by: {rules}. The rule above wins because it has the higher priority, or sits further down the list.'),
    ladder('都想改呢項嘅仲有：{rules}。上面嗰條贏，因為佢優先度高啲，或者喺清單更下面。')
  ),
  'schedule.active.suppressed': entry(
    ladder('You changed these by hand while a rule held them, so the rule is leaving them alone until the schedule changes: {ids}'),
    ladder('呢啲你喺規則揸住嘅時候親手改過，所以規則會唔掂佢哋，直到排程有變：{ids}')
  ),

  /* ---------------- rule editor ---------------- */

  'schedule.editor.newTitle': entry(ladder('New schedule rule'), ladder('新排程規則')),
  'schedule.editor.editTitle': entry(ladder('Edit schedule rule'), ladder('改排程規則')),
  'schedule.editor.name': entry(ladder('Rule name'), ladder('規則名')),
  'schedule.editor.nameHint': entry(
    ladder('The name shown in the list and in the notification when the rule takes effect.'),
    ladder('呢個名會喺清單同規則生效嘅通知度出現。')
  ),
  'schedule.editor.enabled': entry(ladder('Rule is on'), ladder('規則開著')),
  'schedule.editor.priority': entry(ladder('Priority'), ladder('優先度')),
  'schedule.editor.priorityHint': entry(
    ladder('0 to 999. When two rules set the same setting at the same moment, the higher priority wins; equal priorities are settled by position in the list, where further down wins.'),
    ladder('0 至 999。兩條規則同一時間改同一項設定嗰陣，優先度高嗰條贏；一樣優先度就睇清單位置，越下面越贏。')
  ),
  'schedule.editor.startDate': entry(ladder('Start date'), ladder('開始日期')),
  'schedule.editor.endDate': entry(ladder('End date'), ladder('結束日期')),
  'schedule.editor.datesHint': entry(
    ladder('Both dates are optional and both are inclusive. Leave them empty for a rule with no calendar bounds.'),
    ladder('兩個日期都係可選，而且兩頭都包。想規則冇日期限制就留空。')
  ),
  'schedule.editor.startTime': entry(ladder('Start time'), ladder('開始時間')),
  'schedule.editor.endTime': entry(ladder('End time'), ladder('結束時間')),
  'schedule.editor.timesHint': entry(
    ladder('The window is [start, end): it includes the start minute and excludes the end minute, so adjacent rules meet exactly without overlapping. An end earlier than the start crosses midnight. An end equal to the start means the whole day.'),
    ladder('時段係 [開始, 結束)：包開始嗰分鐘，唔包結束嗰分鐘，所以連續嘅規則啱啱好接得上又唔會撞。結束早過開始就係過咗午夜。結束同開始一樣就係成日。')
  ),
  'schedule.editor.everyDay': entry(ladder('Every day'), ladder('日日')),
  'schedule.editor.everyDayHint': entry(
    ladder('Every day means all seven weekdays for the time window above — it is one rule, not seven.'),
    ladder('日日即係上面嗰個時段七日都算——一條規則搞掂，唔使開七條。')
  ),
  'schedule.editor.weekdays': entry(ladder('Weekdays'), ladder('星期')),
  'schedule.editor.weekdaysHint': entry(
    ladder('For a window that crosses midnight, the weekday is the day the window starts on.'),
    ladder('過咗午夜嘅時段，星期係睇時段開始嗰日。')
  ),
  'schedule.editor.summary': entry(ladder('This rule holds: {summary}'), ladder('呢條規則生效時段：{summary}')),

  'schedule.editor.source': entry(ladder('Where the answer comes from'), ladder('個答案邊度嚟')),
  'schedule.editor.source.local': entry(ladder('This computer'), ladder('本機')),
  'schedule.editor.source.api': entry(ladder('HTTPS endpoint'), ladder('HTTPS 端點')),
  'schedule.editor.source.ha': entry(ladder('Home Assistant'), ladder('Home Assistant')),
  'schedule.editor.source.localHint': entry(
    ladder('The rule uses its own stored values and makes no network request at all.'),
    ladder('規則用自己儲低嘅值，完全唔會上網。')
  ),
  'schedule.editor.source.apiHint': entry(
    ladder('The endpoint answers with {"schemaVersion":1,"active":true,"settings":{…}}. A setting id the application does not have is refused rather than stored. Any setting can be driven this way, not only the language.'),
    ladder('端點要答 {"schemaVersion":1,"active":true,"settings":{…}}。程式冇嘅設定 id 會被拒，唔會儲。任何設定都可以咁樣控制，唔淨止語言。')
  ),
  'schedule.editor.source.haHint': entry(
    ladder('A binary_sensor or input_boolean entity. "on" activates this rule so its own values apply; "off" leaves the base settings, or another matching rule, in effect.'),
    ladder('一個 binary_sensor 或者 input_boolean。「on」會啟動呢條規則，用返佢自己嘅值；「off」就維持原本設定，或者交返畀另一條啱嘅規則。')
  ),
  'schedule.editor.url': entry(ladder('Endpoint address'), ladder('端點網址')),
  'schedule.editor.urlHint': entry(
    ladder('https only, except for a loopback address such as http://127.0.0.1:8000 during development. A username or password in the address is refused.'),
    ladder('淨係收 https，除咗開發時用嘅 loopback 地址例如 http://127.0.0.1:8000。網址入面有用戶名或密碼會被拒。')
  ),
  'schedule.editor.baseUrl': entry(ladder('Home Assistant address'), ladder('Home Assistant 網址')),
  'schedule.editor.entityId': entry(ladder('Entity id'), ladder('Entity id')),
  'schedule.editor.entityHint': entry(
    ladder('For example binary_sensor.evening or input_boolean.focus_mode.'),
    ladder('例如 binary_sensor.evening 或者 input_boolean.focus_mode。')
  ),
  'schedule.editor.refresh': entry(ladder('Refresh interval'), ladder('更新間隔')),
  'schedule.editor.refreshHint': entry(
    ladder('Seconds between requests, with a floor of {min} so a rule can never become a hot loop. The source is also asked once the moment the window opens. After a failure the wait doubles, up to eight times this interval.'),
    ladder('每次請求之間隔幾多秒，最少 {min} 秒，等規則唔會變成死 loop。時段一開始亦都會即刻問一次。失敗之後等候時間會加倍，最多去到呢個間隔嘅八倍。')
  ),
  'schedule.editor.token': entry(ladder('Long-lived access token'), ladder('長期存取權杖')),
  'schedule.editor.tokenHint': entry(
    ladder('Stored in the operating system credential vault under this rule\'s own account key. It is never written into the schedule, an export, the local history, a log or a screenshot, and it is never shown again after it is stored.'),
    ladder('存喺作業系統嘅憑證保險庫，用呢條規則自己嘅帳戶鎖匙。佢唔會寫入排程、匯出檔、本機歷史、記錄或者截圖，儲咗之後亦都唔會再顯示。')
  ),
  'schedule.editor.tokenStore': entry(ladder('Store in the credential vault'), ladder('存入憑證保險庫')),
  'schedule.editor.tokenStored': entry(ladder('A token is stored for this rule.'), ladder('呢條規則已經存咗權杖。')),
  'schedule.editor.tokenMissing': entry(ladder('No token is stored for this rule yet.'), ladder('呢條規則仲未存過權杖。')),
  'schedule.editor.tokenRemove': entry(ladder('Remove the stored token'), ladder('刪走存咗嘅權杖')),
  'schedule.editor.test': entry(ladder('Test this source now'), ladder('即刻試下呢個來源')),

  'schedule.editor.assignments': entry(ladder('Settings this rule changes'), ladder('呢條規則會改嘅設定')),
  'schedule.editor.assignmentsHint': entry(
    ladder('Every setting this application registers can be scheduled, apart from actions, custom controls and this feature\'s own keys. The value box below is the same control the settings surface uses, so it accepts exactly what that surface accepts.'),
    ladder('程式登記過嘅設定基本上都排得，除咗動作、自訂控制同呢個功能自己嘅鍵。下面個值輸入格同設定畫面用嘅係同一個控制，接受嘅嘢一模一樣。')
  ),
  'schedule.editor.addSetting': entry(ladder('Setting to add'), ladder('要加嘅設定')),
  'schedule.editor.add': entry(ladder('Add'), ladder('加')),
  'schedule.editor.removeAssignment': entry(ladder('Remove this setting from the rule'), ladder('喺規則度攞走呢項設定')),
  'schedule.editor.noAssignments': entry(
    ladder('No settings yet. Choose one above; a rule with no settings would do nothing.'),
    ladder('未有設定。喺上面揀一個啦；冇設定嘅規則咩都唔會做。')
  ),
  'schedule.editor.noSchedulable': entry(
    ladder('No setting is available to schedule right now.'),
    ladder('而家冇設定可以排程。')
  ),
  'schedule.editor.problems': entry(
    ladder('This rule was not saved. {count} field(s) need attention:'),
    ladder('呢條規則儲唔到。有 {count} 個欄位要處理：')
  ),

  /* ---------------- source states ---------------- */

  'schedule.state.local': entry(ladder('Local'), ladder('本機')),
  'schedule.state.never-run': entry(ladder('Not asked yet'), ladder('未問過')),
  'schedule.state.running': entry(ladder('Asking'), ladder('問緊')),
  'schedule.state.ok': entry(ladder('Active'), ladder('生效')),
  'schedule.state.gate-closed': entry(ladder('Source says off'), ladder('來源話熄')),
  'schedule.state.stale': entry(ladder('Stale'), ladder('過時')),
  'schedule.state.failed': entry(ladder('Failed'), ladder('失敗')),
  'schedule.state.offline': entry(ladder('Offline'), ladder('離線')),
  'schedule.state.unauthorized': entry(ladder('Not authorized'), ladder('冇授權')),
  'schedule.state.rate-limited': entry(ladder('Rate limited'), ladder('被限流')),
  'schedule.state.refused': entry(ladder('Answer refused'), ladder('答案唔收')),
  'schedule.state.inWindow': entry(ladder('In its window'), ladder('喺時段內')),
  'schedule.state.outsideWindow': entry(ladder('Outside its window'), ladder('唔喺時段內')),
  'schedule.state.disabled': entry(ladder('Off'), ladder('熄咗')),

  /* ---------------- settings section ---------------- */

  'schedule.setting.enabled': entry(ladder('Run the schedule'), ladder('行排程')),
  'schedule.setting.enabledDesc': entry(
    ladder(
      'When this is off, no rule is evaluated and every setting a rule was holding is handed back immediately. The rules themselves are kept.',
      'When this is off, no rule is evaluated and every setting a rule was holding is handed back immediately. The rules themselves are kept.',
      'Switch this off and the whole thing goes quiet: no rule runs, and anything a rule was holding is handed straight back. Your rules stay where they are.'
    ),
    ladder(
      '熄咗之後唔會計任何規則，規則揸住嘅設定會即刻放返。規則本身照樣留住。',
      '熄咗之後唔會計任何規則，規則揸住嘅設定會即刻放返。規則本身照樣留住。',
      '一熄就全部收聲：冇規則行，揸住嘅設定即刻放返。你啲規則照樣喺度。'
    )
  ),
  'schedule.setting.tick': entry(ladder('Check the schedule every'), ladder('幾耐睇一次排程')),
  'schedule.setting.tickDesc': entry(
    ladder('Seconds between checks. A shorter interval reacts sooner to a window opening; a longer one does less work. A machine that was asleep catches up on the next check either way.'),
    ladder('每隔幾多秒睇一次。短啲反應快啲；長啲慳力啲。部機瞓咗醒返，下一次檢查都會追返。')
  ),
  'schedule.setting.notify': entry(ladder('Say when a rule takes or releases a setting'), ladder('規則攞或者放設定嗰陣通知')),
  'schedule.setting.notifyDesc': entry(
    ladder('A non-blocking notification naming the settings involved. Turning this off does not change what the schedule does, only whether it says so.'),
    ladder('會出一個唔阻你做嘢嘅通知，寫明係邊啲設定。熄咗只係唔出聲，排程做嘅嘢完全一樣。')
  ),
  'schedule.setting.timeout': entry(ladder('Network timeout'), ladder('網絡逾時')),
  'schedule.setting.timeoutDesc': entry(
    ladder('Milliseconds a request to an endpoint or to Home Assistant may take before it is abandoned. An abandoned request never applies a value.'),
    ladder('去端點或者 Home Assistant 嘅請求最多等幾多毫秒，過咗就放棄。放棄咗嘅請求唔會套用任何值。')
  ),
  'schedule.setting.rules': entry(ladder('Rules'), ladder('規則')),
  'schedule.setting.rulesDesc': entry(
    ladder('The stored schedule document. Open the schedule tab to add, edit, reorder or delete rules.'),
    ladder('儲低嘅排程檔案。去排程分頁加、改、排序或者刪規則。')
  ),
  'schedule.setting.openEditor': entry(ladder('Open the schedule'), ladder('打開排程')),
  'schedule.setting.openEditorDesc': entry(
    ladder('Opens the schedule tab, where the rules, their sources and everything currently in effect are listed.'),
    ladder('打開排程分頁，入面有規則、佢哋嘅來源，同埋而家生效緊嘅嘢。')
  ),
  'schedule.setting.deleteAll': entry(ladder('Delete every rule'), ladder('刪晒所有規則')),
  'schedule.setting.deleteAllDesc': entry(
    ladder('Removes every stored rule and every Home Assistant token stored for one. Settings a rule was holding are handed back first. This cannot be undone from here; a copy stays in the local version history.'),
    ladder('刪走所有儲低嘅規則，同埋為佢哋儲嘅 Home Assistant 權杖。規則揸住嘅設定會先放返。喺呢度做咗就冇得反悔；本機版本歷史仲有一份。')
  ),

  /* ---------------- palette ---------------- */

  'schedule.palette.open': entry(ladder('Scheduled settings: open the schedule'), ladder('排程設定：打開排程')),
  'schedule.palette.new': entry(ladder('Scheduled settings: new rule'), ladder('排程設定：新規則')),
  'schedule.palette.refresh': entry(ladder('Scheduled settings: refresh every source now'), ladder('排程設定：即刻更新所有來源')),
  'schedule.palette.release': entry(ladder('Scheduled settings: release every override now'), ladder('排程設定：即刻放返晒所有設定')),
  'schedule.palette.docs': entry(ladder('Scheduled settings: read the documentation'), ladder('排程設定：睇說明')),

  /* ---------------- notifications ---------------- */

  'schedule.notify.refused.title': entry(
    ladder('The stored schedule was not read'),
    ladder('讀唔到儲低嘅排程')
  ),
  'schedule.notify.quarantined.title': entry(
    ladder('Some schedule rules were not loaded'),
    ladder('有排程規則載入唔到')
  ),
  'schedule.notify.quarantined.body': entry(
    ladder('{count} rule(s) did not pass validation. They are still stored and are listed in the schedule tab; none of them is running.'),
    ladder('有 {count} 條規則過唔到檢查。佢哋仲儲住，喺排程分頁見到；冇一條喺度行。')
  ),
  'schedule.notify.migrated.title': entry(
    ladder('The schedule was brought up to date'),
    ladder('排程已經更新到最新格式')
  ),
  'schedule.notify.migrated.body': entry(
    ladder('The stored schedule was written by schema {from}; it was read and rewritten as schema {to}.'),
    ladder('儲低嘅排程係 schema {from} 寫嘅，已經讀咗再用 schema {to} 寫返。')
  ),
  'schedule.notify.applied.title': entry(
    ladder('A schedule rule took effect', 'A schedule rule took effect', 'A rule just borrowed a setting'),
    ladder('有排程規則生效咗', '有排程規則生效咗', '有條規則啱啱借咗個設定')
  ),
  'schedule.notify.applied.body': entry(
    ladder('Now set by the schedule: {labels}. The previous values are held and go back when the window ends.'),
    ladder('而家由排程話事：{labels}。之前嘅值收埋咗，時段完就放返。')
  ),
  'schedule.notify.released.title': entry(
    ladder('A schedule window ended', 'A schedule window ended', 'A window closed'),
    ladder('排程時段完咗', '排程時段完咗', '個時段閂咗')
  ),
  'schedule.notify.released.body': entry(
    ladder('{count} setting(s) went back to the values they had before the schedule borrowed them.'),
    ladder('有 {count} 項設定變返做被排程借走之前嗰個值。')
  ),
  'schedule.notify.releasedAll.title': entry(
    ladder('Every scheduled override was released'),
    ladder('所有排程改動都放返晒')
  ),
  'schedule.notify.releasedAll.body': entry(
    ladder('{count} setting(s) went back to their base values. {reason}'),
    ladder('有 {count} 項設定變返做原本值。{reason}')
  ),
  'schedule.notify.suppressed.title': entry(
    ladder('Your change wins', 'Your change wins', 'You win this one'),
    ladder('你改嘅為準', '你改嘅為準', '呢鋪你話事')
  ),
  'schedule.notify.suppressed.body': entry(
    ladder('"{label}" was being set by the rule "{rule}". Your value is now the base value, and the rule leaves this setting alone until the schedule changes.'),
    ladder('「{label}」本來由規則「{rule}」設定。而家你嗰個值變咗做原本值，規則會唔掂佢，直到排程有變。')
  ),
  'schedule.notify.noExternal.title': entry(ladder('Nothing to refresh'), ladder('冇嘢需要更新')),
  'schedule.notify.noExternal.body': entry(
    ladder('No rule reads from an endpoint or from Home Assistant, so no request was made.'),
    ladder('冇規則要讀端點或者 Home Assistant，所以冇發出過任何請求。')
  ),
  'schedule.notify.saved.title': entry(ladder('Rule saved'), ladder('規則儲咗')),
  'schedule.notify.saved.body': entry(ladder('"{label}" holds: {summary}'), ladder('「{label}」生效時段：{summary}')),
  'schedule.notify.tokenStored.title': entry(ladder('Token stored'), ladder('權杖已存')),
  'schedule.notify.tokenStored.body': entry(
    ladder('The token for "{label}" is in the operating system credential vault. It is not shown again and does not appear in any export.'),
    ladder('「{label}」嘅權杖已經放入作業系統憑證保險庫。之後唔會再顯示，亦唔會出現喺任何匯出檔。')
  ),
  'schedule.notify.tokenFailed.title': entry(ladder('The token was not stored'), ladder('權杖存唔到')),
  'schedule.notify.exported.title': entry(ladder('Schedule exported'), ladder('排程匯出咗')),
  'schedule.notify.exported.body': entry(
    ladder('Written to {path}. Home Assistant tokens were left out, because they live in the credential vault and never in a file this application writes.'),
    ladder('寫咗去 {path}。Home Assistant 權杖冇包括喺入面，因為佢哋只係住喺憑證保險庫，唔會出現喺呢個程式寫嘅檔案。')
  ),
  'schedule.notify.testDone.title': entry(ladder('Source tested'), ladder('試完個來源')),

  /* ---------------- destructive gate ---------------- */

  'schedule.confirm.deleteRules': entry(
    ladder('Delete {count} schedule rule(s)'),
    ladder('刪除 {count} 條排程規則')
  ),
  'schedule.confirm.deleteIrreversible': entry(
    ladder('The rules are removed from the schedule and any Home Assistant token stored for them is deleted from the credential vault. Settings a rule was holding are handed back to their base values first. The deletion is recorded in the local version history, which is the only place a copy remains.'),
    ladder('啲規則會喺排程度移走，同埋為佢哋存喺憑證保險庫嘅 Home Assistant 權杖都會刪埋。規則揸住嘅設定會先變返原本值。刪除會記錄喺本機版本歷史，嗰度係唯一仲有副本嘅地方。')
  ),
  'schedule.confirm.deleteAll': entry(ladder('Delete every schedule rule'), ladder('刪除所有排程規則')),

  /* ---------------- honest failure ---------------- */

  'schedule.notRunning': entry(
    ladder(
      'The schedule engine did not start, so no rule is running and no setting is being held. Reopening the application will try again.'
    ),
    ladder('排程引擎冇啟動到，所以冇規則行緊，亦冇設定被揸住。重開程式會再試一次。')
  )
};
