import type { Catalogue, FunnyLadder, TranslationEntry } from '../../core/registry';

/**
 * Every piece of copy this feature renders, in English and in playful Hong Kong
 * Cantonese, at all five humour levels.
 *
 * The rule the ladders keep: humour styles the VOICE and never the FACTS. A
 * destructive line at level 5 still names the exact entries, the exact cutoff and
 * exactly what cannot be undone; a level-1 line says the same thing with a
 * straight face. Anything a reader has to act on — a count, a path, a date, an
 * error — is either interpolated or identical across the rungs.
 */

function ladder(...steps: string[]): FunnyLadder {
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

export const HISTORY_STRINGS: Catalogue = {
  /* ---------------- destinations ---------------- */

  'history.panel.title': entry(ladder('Version history'), ladder('版本紀錄')),
  'history.panel.subtitle': entry(
    ladder(
      'Every recorded change, newest first. Restoring adds a new entry rather than rewriting one.',
      'Every recorded change, newest first. Restoring adds a new entry rather than rewriting one.',
      'Everything that changed, newest first. Putting something back writes a new entry — it never edits the old one.',
      'Everything that changed, newest at the top. Undo writes a new line; the old line stays exactly where it was, forever.',
      'Everything that changed, newest at the top. Undo writes a new line; the old line stays exactly where it was, forever.'
    ),
    ladder(
      '所有記錄低嘅改動，最新喺上面。還原會加一條新紀錄，唔會改走舊嗰條。',
      '所有記錄低嘅改動，最新喺上面。還原會加一條新紀錄，唔會改走舊嗰條。',
      '改過嘅嘢全部喺呢度，最新排最前。撳還原係寫多一條，唔會郁舊嗰條。',
      '改過嘅嘢全部喺呢度，最新排最前。撳還原只係寫多一行，舊嗰行永世都喺度，郁都唔會郁。',
      '改過嘅嘢全部喺呢度，最新排最前。撳還原只係寫多一行，舊嗰行永世都喺度，郁都唔會郁。'
    )
  ),
  'history.protected.title': entry(ladder('Protected mutation log'), ladder('受保護嘅變更紀錄')),
  'history.protected.subtitle': entry(
    ladder(
      'Authenticator entries and the display name, each recorded before the change was reported complete. Behind its own credential.',
      'Authenticator entries and the display name, each recorded before the change was reported complete. Behind its own credential.',
      'Authenticator entries and the display name. Each one is written down before the change reports success, and this log has its own lock.',
      'Authenticator entries and the display name. Written down before the change dares call itself done, and locked with its own key — not the one next door.',
      'Authenticator entries and the display name. Written down before the change dares call itself done, and locked with its own key — not the one next door.'
    ),
    ladder(
      '驗證器項目同顯示名稱嘅每次改動，喺報告完成之前已經記低，另有自己嘅密碼。',
      '驗證器項目同顯示名稱嘅每次改動，喺報告完成之前已經記低，另有自己嘅密碼。',
      '驗證器同顯示名稱嘅改動，未講「搞掂」之前已經寫低咗，而且呢個紀錄有自己一條鎖。',
      '驗證器同顯示名稱嘅改動，未夠膽講搞掂之前已經寫低咗，仲要有自己一條匙 —— 隔籬嗰條開唔到。',
      '驗證器同顯示名稱嘅改動，未夠膽講搞掂之前已經寫低咗，仲要有自己一條匙 —— 隔籬嗰條開唔到。'
    )
  ),

  /* ---------------- status ---------------- */

  'history.status.heading': entry(ladder('Where this is stored'), ladder('啲嘢擺喺邊')),
  'history.status.git': entry(
    ladder('A local git repository at {path}. {count} entries. Nothing is pushed anywhere.'),
    ladder('本機 git 倉喺 {path}，共 {count} 條紀錄，唔會 push 去任何地方。')
  ),
  'history.status.journal': entry(
    ladder('An append-only journal at {path}. {count} entries. git is not in use here: {reason}'),
    ladder('唯加不改嘅日誌檔喺 {path}，共 {count} 條紀錄。而家冇用 git：{reason}')
  ),
  'history.status.unreadable': entry(
    ladder('The history could not be read: {reason}'),
    ladder('讀唔到紀錄：{reason}')
  ),
  'history.status.openFolder': entry(ladder('Open the folder'), ladder('打開資料夾')),
  'history.status.retry': entry(ladder('Try again'), ladder('再試')),
  'history.status.degraded': entry(
    ladder('Entries are still being kept, but not committed. {reason}'),
    ladder('紀錄仲有寫低，只係冇 commit。{reason}')
  ),

  /* ---------------- filters ---------------- */

  'history.filters.heading': entry(ladder('Filters'), ladder('篩選')),
  'history.filters.explain': entry(
    ladder(
      'The date range, the action filter and the text search all apply together. None of them overrides another.',
      'The date range, the action filter and the text search all apply together. None of them overrides another.',
      'Dates, actions and the text search all apply at once — none of them quietly cancels another.',
      'Dates, actions and text all apply at the same time. None of them elbows the others out of the way when you are not looking.',
      'Dates, actions and text all apply at the same time. None of them elbows the others out of the way when you are not looking.'
    ),
    ladder(
      '日期範圍、動作篩選同文字搜尋係一齊生效，唔會有邊個蓋過邊個。',
      '日期範圍、動作篩選同文字搜尋係一齊生效，唔會有邊個蓋過邊個。',
      '日期、動作、文字係一齊做嘢，冇邊個會靜雞雞取消另一個。',
      '日期、動作、文字全部一齊生效，冇邊個會趁你唔覺意撞開其他兩個。',
      '日期、動作、文字全部一齊生效，冇邊個會趁你唔覺意撞開其他兩個。'
    )
  ),
  'history.filters.show': entry(ladder('Show filters'), ladder('顯示篩選')),
  'history.filters.hide': entry(ladder('Hide filters'), ladder('收埋篩選')),
  'history.filters.clear': entry(ladder('Clear every filter'), ladder('清走所有篩選')),
  'history.filters.active': entry(
    ladder('Filtering by {summary}.'),
    ladder('而家用緊：{summary}。')
  ),
  'history.filters.none': entry(ladder('No filter is applied.'), ladder('冇用任何篩選。')),

  'history.date.label': entry(ladder('Date range'), ladder('日期範圍')),
  'history.date.from': entry(ladder('From'), ladder('由')),
  'history.date.to': entry(ladder('To'), ladder('至')),
  'history.date.open': entry(ladder('Open the calendar'), ladder('打開日曆')),
  'history.date.hint': entry(
    ladder('Type a date such as {example}, or open the calendar. Both stay in step.'),
    ladder('打個日期，例如 {example}，或者開日曆。兩邊會跟住對方走。')
  ),
  'history.date.partial': entry(
    ladder('Keep going — a full date looks like {example}. Nothing was cleared.'),
    ladder('繼續打 —— 完整日期係咁樣：{example}。你打嘅嘢一個字都冇刪。')
  ),
  'history.date.invalid': entry(
    ladder('That is not a date this can read. Try {example}. Nothing was cleared.'),
    ladder('呢個日期讀唔到，試下 {example}。你打嘅嘢一個字都冇刪。')
  ),
  'history.date.reversed': entry(
    ladder('The start is after the end, so nothing can fall between them.'),
    ladder('開始日期喺結束日期之後，中間咩都夾唔到。')
  ),
  'history.date.month': entry(ladder('Month'), ladder('月份')),
  'history.date.year': entry(ladder('Year'), ladder('年份')),
  'history.date.presets': entry(ladder('Quick ranges'), ladder('快速範圍')),
  'history.date.today': entry(ladder('Today'), ladder('今日')),
  'history.date.last7': entry(ladder('Last 7 days'), ladder('最近 7 日')),
  'history.date.last30': entry(ladder('Last 30 days'), ladder('最近 30 日')),
  'history.date.last90': entry(ladder('Last 90 days'), ladder('最近 90 日')),
  'history.date.thisMonth': entry(ladder('This month'), ladder('今個月')),
  'history.date.lastMonth': entry(ladder('Last month'), ladder('上個月')),
  'history.date.thisYear': entry(ladder('This year'), ladder('今年')),
  'history.date.all': entry(ladder('Every date'), ladder('所有日期')),
  'history.date.clear': entry(ladder('Clear the range'), ladder('清走範圍')),

  'history.action.filterLabel': entry(ladder('Filter by action'), ladder('用動作篩選')),
  'history.action.searchLabel': entry(ladder('Search the actions'), ladder('搵動作')),
  'history.action.none': entry(
    ladder('Nothing has been recorded yet, so there are no actions to filter by.'),
    ladder('而家一條紀錄都未有，所以冇動作可以揀。')
  ),
  'history.action.countOf': entry(ladder('{shown} of {total}'), ladder('{total} 之中嘅 {shown}')),
  'history.action.selected': entry(
    ladder('{count} actions selected'),
    ladder('揀咗 {count} 個動作')
  ),

  'history.search.label': entry(ladder('Search the history'), ladder('搵紀錄')),
  'history.search.placeholder': entry(
    ladder('Action, source, label or payload…'),
    ladder('動作、來源、標籤或者內容…')
  ),

  /* ---------------- results ---------------- */

  'history.results.heading': entry(ladder('Entries'), ladder('紀錄')),
  'history.results.count': entry(
    ladder('{shown} shown of {matched} matching, out of {total} kept.'),
    ladder('顯示緊 {shown} 條，符合條件嘅有 {matched} 條，總共留低咗 {total} 條。')
  ),
  'history.results.truncated': entry(
    ladder(
      'Only the newest {limit} entries in this range were loaded. Narrow the range to reach older ones.',
      'Only the newest {limit} entries in this range were loaded. Narrow the range to reach older ones.',
      'Only the newest {limit} entries in this range came back. Narrow the dates to reach the older ones.',
      'Only the newest {limit} in this range came back — the rest are still on disk, just not in this window. Narrow the dates to reach them.',
      'Only the newest {limit} in this range came back — the rest are still on disk, just not in this window. Narrow the dates to reach them.'
    ),
    ladder(
      '呢個範圍只載入咗最新嘅 {limit} 條，想睇舊啲就收窄日期。',
      '呢個範圍只載入咗最新嘅 {limit} 條，想睇舊啲就收窄日期。',
      '呢個範圍淨係攞返最新 {limit} 條，想睇舊啲就收窄日期。',
      '呢個範圍淨係攞返最新 {limit} 條，其餘嘅仲喺硬碟度，只係未入到呢個窗。收窄日期就搵得返。',
      '呢個範圍淨係攞返最新 {limit} 條，其餘嘅仲喺硬碟度，只係未入到呢個窗。收窄日期就搵得返。'
    )
  ),
  'history.results.empty': entry(
    ladder(
      'Nothing has been recorded yet. Change a setting or a record and the entry appears here.',
      'Nothing has been recorded yet. Change a setting or a record and the entry appears here.',
      'Nothing recorded yet. Change a setting or a record and it turns up here.',
      'Nothing recorded yet — an honest empty page rather than a pretend one. Change a setting and watch a line appear.',
      'Nothing recorded yet — an honest empty page rather than a pretend one. Change a setting and watch a line appear.'
    ),
    ladder(
      '而家一條紀錄都未有。改個設定或者改條紀錄，佢就會喺呢度出現。',
      '而家一條紀錄都未有。改個設定或者改條紀錄，佢就會喺呢度出現。',
      '仲未有嘢記低。改個設定或者改條紀錄，佢自然會走出嚟。',
      '仲未有嘢記低 —— 真係空，唔係扮空。改個設定，望住佢跳出一行。',
      '仲未有嘢記低 —— 真係空，唔係扮空。改個設定，望住佢跳出一行。'
    )
  ),
  'history.results.noMatch': entry(
    ladder('No entry matched. Filtered out by {summary}.'),
    ladder('冇紀錄符合。被呢啲條件篩走咗：{summary}。')
  ),
  'history.results.page': entry(ladder('Page {page} of {pages}'), ladder('第 {page} 頁，共 {pages} 頁')),
  'history.results.previous': entry(ladder('Previous page'), ladder('上一頁')),
  'history.results.next': entry(ladder('Next page'), ladder('下一頁')),

  'history.row.label': entry(ladder('Label'), ladder('標籤')),
  'history.row.labelPlaceholder': entry(
    ladder('Say what changed, not that something did'),
    ladder('寫低改咗乜，唔好淨係寫「改咗」')
  ),
  'history.row.actions': entry(ladder('Entry actions'), ladder('紀錄操作')),
  'history.row.details': entry(ladder('Open the details'), ladder('睇詳情')),
  'history.row.diffPrevious': entry(ladder('Compare with the previous entry from this source'), ladder('同呢個來源上一條比較')),
  'history.row.restore': entry(ladder('Restore this value'), ladder('還原呢個數值')),
  'history.row.copy': entry(ladder('Copy this entry'), ladder('複製呢條紀錄')),
  'history.row.select': entry(ladder('Select entry {id}'), ladder('揀紀錄 {id}')),

  /* ---------------- details and diff ---------------- */

  'history.details.title': entry(ladder('Entry {id}'), ladder('紀錄 {id}')),
  'history.details.payload': entry(ladder('Recorded payload'), ladder('記低嘅內容')),
  'history.details.redactedNote': entry(
    ladder('Values under credential-shaped keys were replaced before this was written to disk.'),
    ladder('似密碼類嘅欄位喺寫落硬碟之前已經換走。')
  ),
  'history.diff.title': entry(ladder('Compare entries'), ladder('比較紀錄')),
  'history.diff.needTwo': entry(
    ladder('Select exactly two entries to compare. {count} are selected.'),
    ladder('要揀啱兩條先可以比較，而家揀咗 {count} 條。')
  ),
  'history.diff.noPrevious': entry(
    ladder('There is no earlier entry from {source} in the loaded range.'),
    ladder('已載入嘅範圍入面，{source} 冇更早嘅紀錄。')
  ),
  'history.diff.path': entry(ladder('Field'), ladder('欄位')),
  'history.diff.left': entry(ladder('Older'), ladder('較舊')),
  'history.diff.right': entry(ladder('Newer'), ladder('較新')),
  'history.diff.kind': entry(ladder('Change'), ladder('變化')),
  'history.diff.added': entry(ladder('Added'), ladder('新增')),
  'history.diff.removed': entry(ladder('Removed'), ladder('刪走')),
  'history.diff.changed': entry(ladder('Changed'), ladder('改咗')),
  'history.diff.identical': entry(
    ladder('These two payloads are identical.'),
    ladder('呢兩份內容一模一樣。')
  ),

  /* ---------------- restore ---------------- */

  'history.restore.title': entry(ladder('Restore an earlier value'), ladder('還原返之前嘅數值')),
  'history.restore.notRestorable': entry(
    ladder(
      'This entry records what happened but does not carry the earlier value, so there is nothing to put back.',
      'This entry records what happened but does not carry the earlier value, so there is nothing to put back.',
      'This entry says what happened but never kept the old value, so there is nothing to put back.',
      'This entry remembers the event and not the value — a diary, not a photograph. There is nothing here to put back.',
      'This entry remembers the event and not the value — a diary, not a photograph. There is nothing here to put back.'
    ),
    ladder(
      '呢條紀錄寫低咗發生咗乜，但冇留低之前嘅數值，所以冇嘢還原得返。',
      '呢條紀錄寫低咗發生咗乜，但冇留低之前嘅數值，所以冇嘢還原得返。',
      '呢條淨係講咗發生乜事，冇留低舊數值，所以冇嘢擺得返。',
      '呢條淨係記得件事，唔記得個數值 —— 似日記多過似相。冇嘢擺得返。',
      '呢條淨係記得件事，唔記得個數值 —— 似日記多過似相。冇嘢擺得返。'
    )
  ),
  'history.restore.unchanged': entry(
    ladder('{id} already holds that value, so nothing was changed and nothing was recorded.'),
    ladder('{id} 而家已經係嗰個值，所以冇改過嘢，亦都冇記低。')
  ),
  'history.restore.done': entry(
    ladder('{id} was set back to its earlier value. That restore is itself entry {entry}, so it can be undone too.'),
    ladder('{id} 已經還原返之前嘅值。今次還原本身係第 {entry} 條紀錄，所以你想反悔都得。')
  ),
  'history.restore.confirmAction': entry(
    ladder('Restore {count} settings to their earlier values'),
    ladder('將 {count} 個設定還原返之前嘅值')
  ),
  'history.restore.irreversible': entry(
    ladder(
      'The current values are replaced immediately. Each replacement is recorded as a new entry, so this restore can itself be restored.'
    ),
    ladder('而家嘅值會即刻換走。每次換都會記低成一條新紀錄，所以今次還原本身都可以再還原。')
  ),
  'history.restore.skipped': entry(
    ladder('{count} of the selected entries carry no earlier value and were left alone.'),
    ladder('揀咗嘅紀錄有 {count} 條冇之前嘅值，所以冇郁佢哋。')
  ),

  /* ---------------- labels ---------------- */

  'history.label.applied': entry(
    ladder('Labelled entry {id}.'),
    ladder('已經幫第 {id} 條紀錄加咗標籤。')
  ),
  'history.label.bulkTitle': entry(ladder('Label the selected entries'), ladder('幫揀咗嘅紀錄加標籤')),
  'history.label.bulkBody': entry(
    ladder('The same label is applied to all {count} selected entries. Entries that already carry it are left alone.'),
    ladder('全部 {count} 條揀咗嘅紀錄會用同一個標籤。本身已經有嗰個標籤嘅唔會再郁。')
  ),
  'history.label.cleared': entry(ladder('Cleared the label from {count} entries.'), ladder('清走咗 {count} 條紀錄嘅標籤。')),
  'history.label.notSaved': entry(
    ladder('The label was applied in this window but not written to {path}: {reason}'),
    ladder('標籤喺呢個窗生效咗，但寫唔入 {path}：{reason}')
  ),

  /* ---------------- selection and bulk ---------------- */

  'history.bulk.selected': entry(ladder('{count} selected'), ladder('揀咗 {count} 條')),
  'history.bulk.selectPage': entry(ladder('Select the {count} on this page'), ladder('揀晒呢頁嘅 {count} 條')),
  'history.bulk.selectAll': entry(ladder('Select all {count} matching entries'), ladder('揀晒符合條件嘅 {count} 條')),
  'history.bulk.invert': entry(ladder('Invert the selection'), ladder('反轉揀嘅嘢')),
  'history.bulk.clear': entry(ladder('Clear the selection'), ladder('唔揀喇')),
  'history.bulk.export': entry(ladder('Export the selection'), ladder('匯出揀咗嘅嘢')),
  'history.bulk.exportEditor': entry(ladder('Export and open in the editor'), ladder('匯出之後用編輯器開')),
  'history.bulk.copy': entry(ladder('Copy the selection'), ladder('複製揀咗嘅嘢')),
  'history.bulk.label': entry(ladder('Label the selection'), ladder('幫揀咗嘅加標籤')),
  'history.bulk.clearLabels': entry(ladder('Clear their labels'), ladder('清走佢哋嘅標籤')),
  'history.bulk.compare': entry(ladder('Compare the two'), ladder('比較呢兩條')),
  'history.bulk.restore': entry(ladder('Restore their values'), ladder('還原佢哋嘅值')),
  'history.bulk.prune': entry(ladder('Prune everything older than the oldest selected'), ladder('刪走比最舊嗰條仲舊嘅紀錄')),
  'history.bulk.copied': entry(ladder('{count} entries copied to the clipboard.'), ladder('複製咗 {count} 條紀錄。')),
  'history.bulk.copyFailed': entry(
    ladder('The clipboard refused the copy: {reason}'),
    ladder('剪貼簿唔收：{reason}')
  ),

  /* ---------------- prune ---------------- */

  'history.prune.title': entry(ladder('Prune old entries'), ladder('刪走舊紀錄')),
  'history.prune.explain': entry(
    ladder(
      'Pruning removes entries older than a cutoff from the journal. The removal is itself recorded, but the removed entries do not come back.',
      'Pruning removes entries older than a cutoff from the journal. The removal is itself recorded, but the removed entries do not come back.',
      'Pruning drops every entry older than the cutoff. The prune is written down; the entries it dropped are gone.',
      'Pruning drops every entry older than the cutoff. The prune leaves a note saying it happened — the entries themselves do not come back.',
      'Pruning drops every entry older than the cutoff. The prune leaves a note saying it happened — the entries themselves do not come back.'
    ),
    ladder(
      '修剪會由日誌入面刪走比截止日更舊嘅紀錄。今次修剪本身會記低，但被刪嗰啲返唔到嚟。',
      '修剪會由日誌入面刪走比截止日更舊嘅紀錄。今次修剪本身會記低，但被刪嗰啲返唔到嚟。',
      '修剪會掃走所有比截止日舊嘅紀錄。修剪本身會記低，被掃走嗰啲就冇咗。',
      '修剪會掃走所有比截止日舊嘅紀錄。修剪會留低一句「我做過」—— 但啲紀錄係真係返唔到嚟。',
      '修剪會掃走所有比截止日舊嘅紀錄。修剪會留低一句「我做過」—— 但啲紀錄係真係返唔到嚟。'
    )
  ),
  'history.prune.preview': entry(
    ladder('{count} of the {total} kept entries are older than {cutoff} and would be removed.'),
    ladder('留低嘅 {total} 條入面，有 {count} 條比 {cutoff} 舊，會被刪走。')
  ),
  'history.prune.none': entry(
    ladder('Nothing is older than {cutoff}, so there is nothing to prune.'),
    ladder('冇嘢比 {cutoff} 舊，所以冇嘢好剪。')
  ),
  'history.prune.confirmAction': entry(
    ladder('Remove {count} history entries older than {cutoff}'),
    ladder('刪走 {count} 條比 {cutoff} 更舊嘅紀錄')
  ),
  'history.prune.irreversible': entry(
    ladder('Those entries are removed from the journal permanently. Nothing in the application can bring them back.'),
    ladder('嗰啲紀錄會由日誌永久刪走，程式入面冇任何嘢救得返。')
  ),
  'history.prune.done': entry(ladder('{count} entries were removed.'), ladder('刪走咗 {count} 條紀錄。')),
  'history.prune.failed': entry(ladder('Nothing was removed: {reason}'), ladder('冇刪到嘢：{reason}')),
  'history.prune.auto': entry(
    ladder('{count} entries older than the {days}-day retention window were removed at startup.'),
    ladder('開機時刪走咗 {count} 條超出 {days} 日保留期嘅紀錄。')
  ),

  /* ---------------- export ---------------- */

  'history.export.title': entry(ladder('Export history'), ladder('匯出紀錄')),
  'history.export.format': entry(ladder('File format'), ladder('檔案格式')),
  'history.export.scope': entry(
    ladder('{count} entries will be written, exactly the ones currently selected or matching.'),
    ladder('會寫低 {count} 條，就係而家揀咗或者符合條件嗰啲。')
  ),
  'history.export.redacted': entry(
    ladder('{fields} field values were replaced with a marker across {entries} entries.'),
    ladder('喺 {entries} 條紀錄入面，有 {fields} 個欄位嘅內容換成咗記號。')
  ),
  'history.export.noRedaction': entry(
    ladder('Redaction is off for this export, so payloads are written as they were stored.'),
    ladder('今次匯出冇遮蓋，內容照原樣寫出。')
  ),
  'history.export.losses': entry(
    ladder('{format} cannot carry these faithfully: {fields}'),
    ladder('{format} 承載唔到呢啲：{fields}')
  ),
  'history.export.saved': entry(ladder('Written to {path}'), ladder('寫咗去 {path}')),
  'history.export.cancelled': entry(ladder('Nothing was written.'), ladder('冇寫過任何嘢。')),
  'history.export.editorMissing': entry(
    ladder('No editor was found on this machine, so the file was written but not opened: {reason}'),
    ladder('喺呢部機搵唔到編輯器，所以檔案寫咗但開唔到：{reason}')
  ),

  /* ---------------- protected manager ---------------- */

  'history.protected.locked': entry(
    ladder('This log is locked. It has its own credential; unlocking anything else does not unlock this.'),
    ladder('呢個紀錄鎖咗，佢有自己一條密碼；開其他嘢係開唔到呢度嘅。')
  ),
  'history.protected.noFactor': entry(
    ladder(
      'No credential has been set for this log yet. Set one and it locks on every launch.',
      'No credential has been set for this log yet. Set one and it locks on every launch.',
      'This log has no credential yet. Set one and it locks itself every launch.',
      'This log has no credential yet, so it is not protecting anything. Set one and it locks itself on every launch.',
      'This log has no credential yet, so it is not protecting anything. Set one and it locks itself on every launch.'
    ),
    ladder(
      '呢個紀錄仲未設過密碼。設定咗之後，每次開程式都會自動鎖住。',
      '呢個紀錄仲未設過密碼。設定咗之後，每次開程式都會自動鎖住。',
      '呢個紀錄仲未有密碼。設定咗佢就會每次開程式自動鎖返。',
      '呢個紀錄仲未有密碼，即係而家咩都冇守住。設定咗佢就會每次開程式自動鎖返。',
      '呢個紀錄仲未有密碼，即係而家咩都冇守住。設定咗佢就會每次開程式自動鎖返。'
    )
  ),
  'history.protected.setFactor': entry(ladder('Set the credential'), ladder('設定密碼')),
  'history.protected.replaceFactor': entry(ladder('Replace the credential'), ladder('換過另一個密碼')),
  'history.protected.removeFactor': entry(ladder('Remove the credential'), ladder('刪走密碼')),
  'history.protected.method': entry(ladder('How to unlock'), ladder('點樣解鎖')),
  'history.protected.methodPassword': entry(ladder('A password'), ladder('用密碼')),
  'history.protected.methodTotp': entry(ladder('A code from an authenticator'), ladder('用驗證器嘅代碼')),
  'history.protected.password': entry(ladder('Password'), ladder('密碼')),
  'history.protected.passwordAgain': entry(ladder('Password again'), ladder('再打一次密碼')),
  'history.protected.mismatch': entry(
    ladder('The two entries are different, so nothing was stored.'),
    ladder('兩次打嘅唔一樣，所以咩都冇儲。')
  ),
  'history.protected.tooShort': entry(
    ladder('Use at least {min} characters. Nothing was stored.'),
    ladder('最少要 {min} 個字元，而家咩都冇儲。')
  ),
  'history.protected.code': entry(ladder('Six-digit code'), ladder('六位數字代碼')),
  'history.protected.pairing': entry(
    ladder('Scan this with your authenticator, then type one code back to confirm the pairing.'),
    ladder('用你嘅驗證器掃呢個，再打返一個代碼確認配對成功。')
  ),
  'history.protected.pairingManual': entry(
    ladder('If you cannot scan it, type this into the authenticator by hand: {secret}'),
    ladder('掃唔到就自己入呢串字落驗證器：{secret}')
  ),
  'history.protected.pairingFailed': entry(
    ladder('That code did not match, so the credential was not stored and this log is unchanged.'),
    ladder('個代碼唔啱，所以密碼冇儲到，呢個紀錄亦都冇變。')
  ),
  'history.protected.unlock': entry(ladder('Unlock'), ladder('解鎖')),
  'history.protected.lock': entry(ladder('Lock again'), ladder('即刻鎖返')),
  'history.protected.wrong': entry(
    ladder('That did not match. Nothing was deleted and nothing was changed. {remaining} attempts before a short wait.'),
    ladder('唔啱。冇刪過嘢，亦冇改過嘢。仲有 {remaining} 次機會就要等一陣。')
  ),
  'history.protected.cooldown': entry(
    ladder('Too many attempts. Try again in {seconds} seconds.'),
    ladder('試得太密，等 {seconds} 秒再嚟。')
  ),
  'history.protected.recovery': entry(
    ladder('Forgotten it? Deleting {path} resets this credential along with every other stored preference.'),
    ladder('唔記得咗？刪走 {path} 就會連同其他儲低嘅設定一齊重設呢條密碼。')
  ),
  'history.protected.empty': entry(
    ladder('No protected mutation has been recorded yet.'),
    ladder('而家未有任何受保護嘅變更紀錄。')
  ),
  'history.protected.vaultMissing': entry(
    ladder(
      'The credential store is not usable on this machine ({reason}), so snapshots are recorded without their encrypted body. The event itself is still written down.'
    ),
    ladder('呢部機用唔到密碼保管庫（{reason}），所以快照冇加密內容，但件事本身照樣記低咗。')
  ),
  'history.protected.recordFailed': entry(
    ladder(
      'The mutation happened, but it was not recorded: {reason} Your data is untouched; the log is incomplete and says so here.'
    ),
    ladder('個改動做咗，但記唔到低：{reason} 你嘅資料冇事，係呢個紀錄唔齊，而佢喺度自認。')
  ),
  'history.protected.reveal': entry(ladder('Reveal the snapshot metadata'), ladder('打開快照資料')),
  'history.protected.revealNote': entry(
    ladder('This is metadata only. No secret, code, password or pairing URI is ever written into an entry.'),
    ladder('呢度淨係中繼資料。任何密鑰、代碼、密碼、配對網址都唔會寫入紀錄。')
  ),
  'history.protected.scrubbed': entry(
    ladder('{count} fields were dropped before encryption because their names looked credential-shaped: {fields}'),
    ladder('加密之前扔咗 {count} 個欄位，因為佢哋個名似密碼：{fields}')
  ),
  'history.protected.verify': entry(ladder('Check the log against the credential store'), ladder('對一對紀錄同保管庫')),
  'history.protected.verifyClean': entry(
    ladder('Every stored account has a matching entry, and every entry has a matching account. {count} accounts checked.'),
    ladder('每個儲低嘅帳戶都有對應紀錄，每條紀錄都有對應帳戶。查咗 {count} 個。')
  ),
  'history.protected.verifyDrift': entry(
    ladder('{unrecorded} stored accounts have no entry, and {orphaned} entries name an account that is no longer stored.'),
    ladder('有 {unrecorded} 個儲低嘅帳戶冇紀錄，有 {orphaned} 條紀錄講嘅帳戶已經唔喺度。')
  ),
  'history.protected.verifyExplain': entry(
    ladder(
      'This compares account keys only, never values. Drift is reported rather than silently written down, because a guess in a log is worse than a gap.'
    ),
    ladder('呢個淨係比對帳戶名，唔會掂內容。有出入就照報，唔會靜雞雞補寫 —— 紀錄入面亂估，衰過留白。')
  ),

  /* ---------------- settings ---------------- */

  'history.settings.section': entry(ladder('Version history'), ladder('版本紀錄')),
  'history.settings.retention': entry(ladder('Keep entries for'), ladder('紀錄保留幾耐')),
  'history.settings.retention.description': entry(
    ladder(
      'The retention window used by the prune action and, when it is switched on, by the startup prune. Entries older than this are candidates for removal; nothing is removed until a prune actually runs.'
    ),
    ladder('修剪動作同開機自動修剪都會用呢個保留期。比呢個舊嘅紀錄係候選，真正跑修剪之前唔會刪任何嘢。')
  ),
  'history.settings.autoPrune': entry(ladder('Prune at startup'), ladder('開機自動修剪')),
  'history.settings.autoPrune.description': entry(
    ladder(
      'Runs one prune when the application starts, using the retention window above, and reports the exact number removed. Off by default, because a deletion that happens before anybody looks is a deletion nobody reviewed.'
    ),
    ladder('開程式時跑一次修剪，用上面嘅保留期，同埋照報刪咗幾多條。預設關咗，因為未有人望過就刪，即係冇人審過。')
  ),
  'history.settings.pageSize': entry(ladder('Entries per page'), ladder('每頁幾多條')),
  'history.settings.pageSize.description': entry(
    ladder('How many matching entries one page of the list holds. The select-all control names this number so its scope is never ambiguous.'),
    ladder('一頁裝幾多條符合條件嘅紀錄。全選嗰個掣會講明呢個數，所以範圍唔會含糊。')
  ),
  'history.settings.maxLoad': entry(ladder('Maximum entries loaded'), ladder('最多載入幾多條')),
  'history.settings.maxLoad.description': entry(
    ladder(
      'A ceiling on how many entries are read into the window at once, so a very long history cannot make the panel unresponsive. When the ceiling is reached the panel says so instead of quietly showing less.'
    ),
    ladder('一次過讀入視窗嘅上限，避免紀錄太長搞到個面板卡死。撞到上限佢會出聲，唔會靜雞雞少畀你睇。')
  ),
  'history.settings.redact': entry(ladder('Redact exports'), ladder('匯出時遮蓋')),
  'history.settings.redact.description': entry(
    ladder(
      'Replaces the value of any credential-shaped field with a marker before an export is written, and states in the file how many were replaced. The stored history is already redacted when it is written; this is the second pass on the way out.'
    ),
    ladder('匯出前將似密碼嘅欄位內容換成記號，仲會喺檔案入面寫明換咗幾多個。存落硬碟嗰陣已經遮過一次，呢次係出門口再遮一次。')
  ),
  'history.settings.exportFormat': entry(ladder('Default export format'), ladder('預設匯出格式')),
  'history.settings.exportFormat.description': entry(
    ladder('The format the export dialog opens on. Every other format stays available in that dialog.'),
    ladder('匯出對話框一開就係呢個格式，其他格式喺嗰度照樣揀得。')
  ),
  'history.settings.unlockMinutes': entry(ladder('Protected log stays unlocked for'), ladder('受保護紀錄開幾耐')),
  'history.settings.unlockMinutes.description': entry(
    ladder(
      'How long an unlock of the protected mutation log lasts. It always starts locked when the application launches, whatever this is set to.'
    ),
    ladder('受保護紀錄解鎖之後可以維持幾耐。無論設幾多，一開程式都係鎖住嘅。')
  ),
  'history.settings.factor': entry(ladder('Protected log credential'), ladder('受保護紀錄嘅密碼')),
  'history.settings.factor.description': entry(
    ladder(
      'Sets or replaces the credential that opens the protected mutation log. It is its own credential: no other unlock in the application opens this log, and this one opens nothing else.'
    ),
    ladder('設定或者換走開受保護紀錄嗰條密碼。佢係獨立嘅：程式入面其他解鎖開唔到呢度，呢條亦都開唔到其他地方。')
  ),
  'history.settings.forget': entry(ladder('Remove the protected log credential'), ladder('刪走受保護紀錄嘅密碼')),
  'history.settings.forget.description': entry(
    ladder(
      'Deletes the stored verifier so the protected log stops asking for anything. The entries themselves are untouched and stay readable.'
    ),
    ladder('刪走儲低嘅驗證資料，之後受保護紀錄唔會再問你嘢。啲紀錄本身唔會郁，照睇得。')
  ),

  /* ---------------- palette ---------------- */

  'history.palette.open': entry(ladder('Open the version history'), ladder('打開版本紀錄')),
  'history.palette.openProtected': entry(ladder('Open the protected mutation log'), ladder('打開受保護嘅變更紀錄')),
  'history.palette.refresh': entry(ladder('Reload the version history'), ladder('重新載入版本紀錄')),
  'history.palette.export': entry(ladder('Export the version history'), ladder('匯出版本紀錄')),
  'history.palette.prune': entry(ladder('Prune the version history'), ladder('修剪版本紀錄')),
  'history.palette.search': entry(ladder('Search the version history'), ladder('搵版本紀錄')),
  'history.palette.dates': entry(ladder('Filter the history by date'), ladder('用日期篩選紀錄')),

  /* ---------------- generic ---------------- */

  'history.action.refresh': entry(ladder('Reload'), ladder('重新載入')),
  'history.action.close': entry(ladder('Close'), ladder('閂咗佢')),
  'history.action.apply': entry(ladder('Apply'), ladder('套用')),
  'history.action.cancel': entry(ladder('Cancel'), ladder('唔使喇'))
};
