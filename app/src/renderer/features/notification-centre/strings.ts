import type { Catalogue, FunnyLadder, TranslationEntry } from '../../core/registry';

/**
 * This feature's copy, in English and in playful Hong Kong Cantonese.
 *
 * The funny level styles the VOICE and never the FACTS. Read down any ladder
 * here and the same things stay fixed at every rung: which records are affected,
 * how many there are, what cannot be undone afterwards, and where the log lives.
 * Only the way it is said moves.
 *
 * Counts, timestamps, sources, file paths and severity names are interpolated
 * values, so they are never styled at all.
 */

/**
 * Expands a short ladder to all five levels.
 *
 * One string means the copy genuinely reads the same at every level. Two means
 * serious then playful. Three means serious, middle, playful.
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

export const NOTIFICATION_CENTRE_STRINGS: Catalogue = {
  /* --- the surface itself --- */
  'notificationCentre.title': entry(ladder('Notification centre'), ladder('通知中心')),
  'notificationCentre.lede': entry(
    ladder(
      'Every notification this application has raised, including the ones already dismissed.',
      'Every notification this application has raised, including the ones already dismissed.',
      'Everything the application has told you, including what you waved away.',
      'Everything the application has ever said to you, including the bits you waved away without reading.',
      'Everything the application has ever said to you, including the bits you waved away without reading.'
    ),
    ladder(
      '呢個程式出過嘅通知全部喺呢度，撳走咗嗰啲都仲喺度。',
      '呢個程式出過嘅通知全部喺呢度，撳走咗嗰啲都仲喺度。',
      '程式同你講過嘅嘢全部喺呢度，你撳走咗嗰啲都走唔甩。',
      '程式同你講過嘅嘢全部喺呢度，包括你眼都唔眨就撳走嗰啲。',
      '程式同你講過嘅嘢全部喺呢度，包括你眼都唔眨就撳走嗰啲。'
    )
  ),
  'notificationCentre.search.label': entry(ladder('Search notifications'), ladder('搵通知')),
  'notificationCentre.search.placeholder': entry(
    ladder('Search the title, the body and the source…'),
    ladder('搵標題、內容同來源…')
  ),

  /* --- storage status --- */
  'notificationCentre.status.persisted': entry(
    ladder('{stored} kept in {path}. {loaded} were read back from earlier sessions.'),
    ladder('{stored} 條存喺 {path}。有 {loaded} 條係之前開機嗰陣留低讀返嚟嘅。')
  ),
  'notificationCentre.status.notYetWritten': entry(
    ladder('{stored} held, and the log has not been written to {path} yet this session.'),
    ladder('而家有 {stored} 條，今次開機仲未寫入過 {path}。')
  ),
  'notificationCentre.status.disabled': entry(
    ladder(
      'Keeping the log across restarts is switched off, so these {stored} records end when this window does.',
      'Keeping the log across restarts is switched off, so these {stored} records end when this window does.',
      'Keeping the log across restarts is off. These {stored} records leave with this window.',
      'Keeping the log across restarts is off, so these {stored} records vanish the moment this window shuts.',
      'Keeping the log across restarts is off, so these {stored} records vanish the moment this window shuts.'
    ),
    ladder(
      '而家冇開「重開之後仲保留」，所以呢 {stored} 條記錄關窗就冇。',
      '而家冇開「重開之後仲保留」，所以呢 {stored} 條記錄關窗就冇。',
      '「重開之後仲保留」冇開，呢 {stored} 條記錄跟住個窗一齊走。',
      '「重開之後仲保留」冇開，呢 {stored} 條記錄一關窗即刻蒸發。',
      '「重開之後仲保留」冇開，呢 {stored} 條記錄一關窗即刻蒸發。'
    )
  ),
  'notificationCentre.status.error': entry(
    ladder('The stored log at {path} could not be used: {reason} This session is still listed below.'),
    ladder('喺 {path} 嗰個記錄檔用唔到：{reason} 今次開機嘅通知照樣喺下面。')
  ),
  'notificationCentre.status.refused': entry(
    ladder('{count} stored records were refused as malformed and were not loaded. Nothing was deleted.'),
    ladder('有 {count} 條記錄格式唔啱，冇載入到。冇刪過任何嘢。')
  ),

  /* --- filters --- */
  'notificationCentre.filters.title': entry(ladder('Filters'), ladder('篩選')),
  'notificationCentre.filters.description': entry(
    ladder('Severity and source filters narrow the list. They compose with the search rather than replacing it.'),
    ladder('嚴重程度同來源篩選會收窄個清單。佢哋同搵嘢係一齊做，唔會取代對方。')
  ),
  'notificationCentre.filters.severity': entry(ladder('Severity'), ladder('嚴重程度')),
  'notificationCentre.filters.source': entry(ladder('Raised by'), ladder('邊個出嘅')),
  'notificationCentre.filters.state': entry(ladder('State'), ladder('狀態')),
  'notificationCentre.filters.state.all': entry(ladder('All'), ladder('全部')),
  'notificationCentre.filters.state.showing': entry(ladder('Still showing'), ladder('仲喺度顯示')),
  'notificationCentre.filters.state.dismissed': entry(ladder('Dismissed'), ladder('已經撳走')),
  'notificationCentre.filters.active': entry(
    ladder('{count} filters are applied and are hiding {hidden} of {total} records.'),
    ladder('用緊 {count} 個篩選，喺 {total} 條裏面收埋咗 {hidden} 條。')
  ),
  'notificationCentre.filters.inactive': entry(
    ladder('No filter is applied. All {total} records are eligible.'),
    ladder('冇用任何篩選，全部 {total} 條都計入。')
  ),
  'notificationCentre.filters.collapsedWarning': entry(
    ladder('The filter row is collapsed and is still hiding {hidden} of {total} records.'),
    ladder('篩選列收埋咗，但仲喺度收住 {total} 條裏面嘅 {hidden} 條。')
  ),
  'notificationCentre.filters.reset': entry(ladder('Clear every filter'), ladder('清走所有篩選')),
  'notificationCentre.filters.expand': entry(ladder('Show the filters'), ladder('打開篩選')),
  'notificationCentre.filters.collapse': entry(ladder('Hide the filters'), ladder('收埋篩選')),

  /* --- statistics --- */
  'notificationCentre.stats.title': entry(ladder('Statistics'), ladder('統計')),
  'notificationCentre.stats.description': entry(
    ladder('Counts describing the whole stored log. They describe the log; they do not filter it.'),
    ladder('呢啲數係講成個記錄檔嘅情況，凈係描述，唔會篩走任何嘢。')
  ),
  'notificationCentre.stats.expand': entry(ladder('Show the statistics'), ladder('打開統計')),
  'notificationCentre.stats.collapse': entry(ladder('Hide the statistics'), ladder('收埋統計')),
  'notificationCentre.stats.total': entry(ladder('Records stored'), ladder('存低咗幾多條')),
  'notificationCentre.stats.showing': entry(ladder('Still showing on screen'), ladder('仲喺畫面度')),
  'notificationCentre.stats.dismissed': entry(ladder('Dismissed'), ladder('撳走咗')),
  'notificationCentre.stats.thisSession': entry(ladder('Raised this session'), ladder('今次開機出嘅')),
  'notificationCentre.stats.oldest': entry(ladder('Oldest record'), ladder('最舊嗰條')),
  'notificationCentre.stats.newest': entry(ladder('Newest record'), ladder('最新嗰條')),
  'notificationCentre.stats.bySeverity': entry(ladder('By severity'), ladder('照嚴重程度分')),
  'notificationCentre.stats.bySource': entry(ladder('By source'), ladder('照來源分')),
  'notificationCentre.stats.retention': entry(
    ladder('The newest {count} records are kept; older ones are dropped as new ones arrive.'),
    ladder('凈係留最新嘅 {count} 條，有新嘅入嚟就會丟返最舊嗰啲。')
  ),
  'notificationCentre.stats.none': entry(
    ladder('Nothing has been recorded yet, so there is nothing to count.'),
    ladder('未記錄過任何嘢，所以冇嘢可以數。')
  ),

  /* --- selection --- */
  'notificationCentre.select.page': entry(
    ladder('Select the {count} on this page'),
    ladder('揀晒呢一頁嘅 {count} 條')
  ),
  'notificationCentre.select.every': entry(
    ladder('Select every match ({count})'),
    ladder('揀晒所有配對到嘅（{count} 條）')
  ),
  'notificationCentre.select.invert': entry(
    ladder('Invert the selection within the matches'),
    ladder('喺配對到嘅入面反轉揀嘅嘢')
  ),
  'notificationCentre.select.clear': entry(ladder('Clear the selection'), ladder('唔揀住先')),
  'notificationCentre.select.summary': entry(
    ladder('{selected} selected · {shown} of {total} shown · page {page} of {pages}'),
    ladder('揀咗 {selected} 條 · 顯示緊 {total} 條入面嘅 {shown} 條 · 第 {page} 頁，共 {pages} 頁')
  ),
  'notificationCentre.select.rowLabel': entry(ladder('Select this record'), ladder('揀呢條記錄')),
  'notificationCentre.select.announce': entry(
    ladder('{count} records selected.'),
    ladder('揀咗 {count} 條記錄。')
  ),

  /* --- actions --- */
  'notificationCentre.action.dismiss': entry(ladder('Dismiss selected'), ladder('撳走揀咗嘅')),
  'notificationCentre.action.delete': entry(ladder('Delete selected'), ladder('刪走揀咗嘅')),
  'notificationCentre.action.export': entry(ladder('Export…'), ladder('匯出…')),
  'notificationCentre.action.more': entry(ladder('More actions'), ladder('仲有其他動作')),
  'notificationCentre.action.dismissEverything': entry(
    ladder('Dismiss everything still showing'),
    ladder('撳走晒仲喺畫面嘅通知')
  ),
  'notificationCentre.action.deleteEverything': entry(
    ladder('Delete every stored notification'),
    ladder('刪晒所有存低咗嘅通知')
  ),
  'notificationCentre.action.openFolder': entry(
    ladder('Open the folder holding the log'),
    ladder('打開放住記錄檔嗰個資料夾')
  ),
  'notificationCentre.action.copyRecord': entry(ladder('Copy this record'), ladder('複製呢條記錄')),
  'notificationCentre.action.dismissRow': entry(ladder('Dismiss this notification'), ladder('撳走呢個通知')),
  'notificationCentre.action.deleteRow': entry(ladder('Delete this record'), ladder('刪走呢條記錄')),
  'notificationCentre.action.showMore': entry(ladder('Show the whole message'), ladder('睇晒成段')),
  'notificationCentre.action.showLess': entry(ladder('Shorten the message again'), ladder('收返短啲')),
  'notificationCentre.action.previousPage': entry(ladder('Previous page'), ladder('上一頁')),
  'notificationCentre.action.nextPage': entry(ladder('Next page'), ladder('下一頁')),
  'notificationCentre.action.openCentre': entry(ladder('Open the notification centre'), ladder('打開通知中心')),

  /* --- disabled reasons, which always name the unmet condition --- */
  'notificationCentre.disabled.noSelection': entry(
    ladder('Nothing is selected yet. Tick a record first.'),
    ladder('仲未揀到嘢，要先剔一條記錄。')
  ),
  'notificationCentre.disabled.noneDismissable': entry(
    ladder('None of the selected records is still showing, so there is nothing to dismiss.'),
    ladder('揀咗嗰啲冇一條仲喺畫面度，所以冇嘢可以撳走。')
  ),
  'notificationCentre.disabled.emptyLog': entry(
    ladder('The log is empty, so there is nothing to work on.'),
    ladder('記錄檔係空嘅，冇嘢可以做。')
  ),
  'notificationCentre.disabled.firstPage': entry(
    ladder('This is the first page.'),
    ladder('已經係第一頁。')
  ),
  'notificationCentre.disabled.lastPage': entry(ladder('This is the last page.'), ladder('已經係最後一頁。')),

  /* --- rows --- */
  'notificationCentre.row.showing': entry(ladder('Still showing'), ladder('仲喺畫面')),
  'notificationCentre.row.dismissedAt': entry(ladder('Dismissed {when}'), ladder('{when} 撳走咗')),
  'notificationCentre.row.earlierSession': entry(ladder('From an earlier session'), ladder('之前開機嗰陣嘅')),
  'notificationCentre.row.endedWithSession': entry(
    ladder('Still showing when that session ended'),
    ladder('嗰次關機嗰陣仲喺畫面度')
  ),
  'notificationCentre.row.actionsUnavailable': entry(
    ladder(
      'This notification carried the actions {labels}. They belonged to a session that has ended, so they cannot be run from here.',
      'This notification carried the actions {labels}. They belonged to a session that has ended, so they cannot be run from here.',
      'It carried the actions {labels}, but those belonged to a session that has ended and cannot be run now.',
      'It carried the actions {labels} — which went home when that session did, so there is nothing left to press.',
      'It carried the actions {labels} — which went home when that session did, so there is nothing left to press.'
    ),
    ladder(
      '呢個通知本來有 {labels} 呢啲動作，但係嗰次開機已經完咗，喺呢度撳唔到。',
      '呢個通知本來有 {labels} 呢啲動作，但係嗰次開機已經完咗，喺呢度撳唔到。',
      '佢本來有 {labels}，不過跟住嗰次開機一齊完咗，而家撳唔到。',
      '佢本來有 {labels}，不過嗰啲動作跟住嗰次開機返咗屋企，冇得撳。',
      '佢本來有 {labels}，不過嗰啲動作跟住嗰次開機返咗屋企，冇得撳。'
    )
  ),
  'notificationCentre.row.progress': entry(
    ladder('Progress recorded at {percent}%'),
    ladder('記錄低嗰陣做咗 {percent}%')
  ),
  'notificationCentre.row.body': entry(ladder('Message'), ladder('訊息內容')),

  /* --- empty states --- */
  'notificationCentre.empty.title': entry(
    ladder(
      'Nothing has been recorded yet',
      'Nothing has been recorded yet',
      'Nothing here yet',
      'Not one notification. Blissful, really',
      'Not one notification. Blissful, really'
    ),
    ladder('未有任何記錄', '未有任何記錄', '呢度仲係空', '一個通知都冇，其實幾爽', '一個通知都冇，其實幾爽')
  ),
  'notificationCentre.empty.body': entry(
    ladder(
      'Notifications appear here as soon as the application raises one, and they stay after you dismiss them.',
      'Notifications appear here as soon as the application raises one, and they stay after you dismiss them.',
      'The moment the application says something, it lands here, and it stays after you wave it away.',
      'The moment the application says anything at all, it lands here — and it stays put long after you wave it away.',
      'The moment the application says anything at all, it lands here — and it stays put long after you wave it away.'
    ),
    ladder(
      '程式一出通知就會即刻喺呢度出現，你撳走咗都仲會留低。',
      '程式一出通知就會即刻喺呢度出現，你撳走咗都仲會留低。',
      '程式一開聲就會跌落嚟呢度，你撳走咗佢都唔會走。',
      '程式一開聲就跌落嚟呢度，你撳走咗之後佢仲賴死唔走。',
      '程式一開聲就跌落嚟呢度，你撳走咗之後佢仲賴死唔走。'
    )
  ),
  'notificationCentre.emptyFiltered.title': entry(
    ladder('Nothing matched'),
    ladder('乜都配對唔到')
  ),
  'notificationCentre.emptyFiltered.body': entry(
    ladder('{total} records are stored, and the current search and filters exclude all of them.'),
    ladder('總共存住 {total} 條，而家嘅搵嘢同篩選將佢哋全部排除咗。')
  ),

  /* --- the reviewable preview of what a bulk action would touch --- */
  'notificationCentre.preview.title': entry(
    ladder('Records a bulk action would affect'),
    ladder('批量動作會影響邊啲記錄')
  ),
  'notificationCentre.preview.description': entry(
    ladder(
      'Exactly the records currently selected, listed so a bulk action can be reviewed before it runs.',
      'Exactly the records currently selected, listed so a bulk action can be reviewed before it runs.',
      'Exactly what is selected right now, listed so you can look before a bulk action runs.',
      'Exactly what is selected right now, listed so you can look at it before a bulk action goes anywhere near it.',
      'Exactly what is selected right now, listed so you can look at it before a bulk action goes anywhere near it.'
    ),
    ladder(
      '而家揀咗嘅記錄全部列晒喺度，等你喺批量動作跑之前可以睇清楚。',
      '而家揀咗嘅記錄全部列晒喺度，等你喺批量動作跑之前可以睇清楚。',
      '而家揀咗乜就列乜，等你喺批量動作跑之前睇真啲。',
      '而家揀咗乜就列乜，等批量動作埋身之前你可以睇真真哋。',
      '而家揀咗乜就列乜，等批量動作埋身之前你可以睇真真哋。'
    )
  ),
  'notificationCentre.preview.expand': entry(ladder('Show what is selected'), ladder('睇下揀咗啲乜')),
  'notificationCentre.preview.collapse': entry(ladder('Hide what is selected'), ladder('收埋揀咗嘅嘢')),

  /* --- export format names, which are file-format tokens in both languages --- */
  'notificationCentre.format.json': entry(ladder('JSON'), ladder('JSON')),
  'notificationCentre.format.jsonl': entry(ladder('JSONL'), ladder('JSONL')),
  'notificationCentre.format.yaml': entry(ladder('YAML'), ladder('YAML')),
  'notificationCentre.format.toml': entry(ladder('TOML'), ladder('TOML')),
  'notificationCentre.format.xml': entry(ladder('XML'), ladder('XML')),
  'notificationCentre.format.csv': entry(ladder('CSV'), ladder('CSV')),
  'notificationCentre.format.tsv': entry(ladder('TSV'), ladder('TSV')),
  'notificationCentre.format.markdown': entry(ladder('Markdown'), ladder('Markdown')),
  'notificationCentre.format.html': entry(ladder('HTML'), ladder('HTML')),
  'notificationCentre.format.sql': entry(ladder('SQL'), ladder('SQL')),

  /* --- export --- */
  'notificationCentre.export.title': entry(ladder('Export notifications'), ladder('匯出通知')),
  'notificationCentre.export.scope': entry(ladder('What to export'), ladder('匯出啲乜')),
  'notificationCentre.export.scope.selection': entry(
    ladder('The {count} selected records'),
    ladder('揀咗嘅 {count} 條記錄')
  ),
  'notificationCentre.export.scope.filtered': entry(
    ladder('The {count} records the current search and filters allow'),
    ladder('而家搵嘢同篩選之後剩返嘅 {count} 條')
  ),
  'notificationCentre.export.scope.everything': entry(
    ladder('Every stored record ({count})'),
    ladder('全部存低咗嘅記錄（{count} 條）')
  ),
  'notificationCentre.export.run': entry(ladder('Choose a file and export'), ladder('揀個檔案再匯出')),
  'notificationCentre.export.omitted': entry(
    ladder(
      'Action callbacks are not exported: a callback is code, not data. Their labels are included.',
      'Action callbacks are not exported: a callback is code, not data. Their labels are included.',
      'The action callbacks are not exported — a callback is code, not data — but their labels are.',
      'The action callbacks stay behind, because a callback is code and a file is not. Their labels come along.',
      'The action callbacks stay behind, because a callback is code and a file is not. Their labels come along.'
    ),
    ladder(
      '動作嘅程式碼唔會匯出，因為嗰啲係程式碼唔係資料。動作嘅名就會有。',
      '動作嘅程式碼唔會匯出，因為嗰啲係程式碼唔係資料。動作嘅名就會有。',
      '動作嘅程式碼唔會跟住走，佢係程式碼唔係資料；不過個名會有。',
      '動作嘅程式碼留低，因為佢係程式碼，唔係一個檔案入面裝得落嘅嘢。個名就跟得走。',
      '動作嘅程式碼留低，因為佢係程式碼，唔係一個檔案入面裝得落嘅嘢。個名就跟得走。'
    )
  ),
  'notificationCentre.export.cancelled': entry(
    ladder('No file was chosen, so nothing was written.'),
    ladder('冇揀檔案，所以乜都冇寫。')
  ),

  /* --- results, stated exactly --- */
  'notificationCentre.result.dismissed': entry(
    ladder('{count} dismissed'),
    ladder('撳走咗 {count} 個')
  ),
  'notificationCentre.result.dismissedWithSkips': entry(
    ladder('{count} dismissed. {skipped} were already dismissed or came from an earlier session, and were left alone.'),
    ladder('撳走咗 {count} 個。有 {skipped} 個本來就撳走咗，或者係之前開機嗰陣嘅，冇郁過。')
  ),
  'notificationCentre.result.nothingDismissed': entry(
    ladder('Nothing was dismissed: none of the {count} selected records is still showing.'),
    ladder('冇撳走到嘢：揀咗嘅 {count} 條冇一條仲喺畫面度。')
  ),
  'notificationCentre.result.deleted': entry(
    ladder('{count} records deleted from the log'),
    ladder('喺記錄檔度刪咗 {count} 條')
  ),
  'notificationCentre.result.cleared': entry(
    ladder('The log is empty. {count} records were deleted.'),
    ladder('記錄檔已經清空，刪咗 {count} 條。')
  ),
  'notificationCentre.result.copied': entry(
    ladder('The record was copied to the clipboard'),
    ladder('已經複製咗呢條記錄')
  ),
  'notificationCentre.result.copyFailed': entry(
    ladder('The clipboard refused the copy: {reason}'),
    ladder('剪貼簿唔收：{reason}')
  ),
  'notificationCentre.result.linkFailed': entry(
    ladder('The link could not be opened: {reason}'),
    ladder('開唔到條連結：{reason}')
  ),

  /* --- the destructive gate's copy, which stays exact at every level --- */
  'notificationCentre.confirm.delete': entry(
    ladder('Delete {count} notification records from the log'),
    ladder('喺記錄檔度刪走 {count} 條通知記錄')
  ),
  'notificationCentre.confirm.deleteIrreversible': entry(
    ladder(
      'These {count} records are removed from the stored log at {path} and cannot be recovered from within the application. The deletion itself is recorded in local history.',
      'These {count} records are removed from the stored log at {path} and cannot be recovered from within the application. The deletion itself is recorded in local history.',
      'These {count} records leave the stored log at {path} for good — the application cannot get them back. The deletion itself is recorded in local history.',
      'These {count} records leave the stored log at {path} for good. Nothing in this application can fetch them back. The deletion itself is recorded in local history, so at least the fact that it happened survives.',
      'These {count} records leave the stored log at {path} for good. Nothing in this application can fetch them back. The deletion itself is recorded in local history, so at least the fact that it happened survives.'
    ),
    ladder(
      '呢 {count} 條會喺 {path} 嗰個記錄檔度刪走，程式冇辦法攞返。今次刪除會寫入本機歷史。',
      '呢 {count} 條會喺 {path} 嗰個記錄檔度刪走，程式冇辦法攞返。今次刪除會寫入本機歷史。',
      '呢 {count} 條會永遠離開 {path} 嗰個記錄檔，程式救唔返。今次刪除會寫入本機歷史。',
      '呢 {count} 條會永遠離開 {path} 嗰個記錄檔，呢個程式係救唔返嘅。至少今次刪除會寫入本機歷史，證明發生過。',
      '呢 {count} 條會永遠離開 {path} 嗰個記錄檔，呢個程式係救唔返嘅。至少今次刪除會寫入本機歷史，證明發生過。'
    )
  ),
  'notificationCentre.confirm.clear': entry(
    ladder('Delete every stored notification record ({count})'),
    ladder('刪走所有存低咗嘅通知記錄（{count} 條）')
  ),
  'notificationCentre.confirm.affectedOthers': entry(
    ladder('…and {count} more records not listed here'),
    ladder('…仲有 {count} 條冇喺度列出')
  ),

  /* --- settings --- */
  'notificationCentre.settings.section': entry(ladder('Notification centre'), ladder('通知中心')),
  'notificationCentre.settings.persist': entry(
    ladder('Keep the log across restarts'),
    ladder('重開之後仲保留記錄')
  ),
  'notificationCentre.settings.persist.description': entry(
    ladder(
      'Writes the notification log to a file inside the application data directory so it survives closing the window. Turning it off leaves this session listed and stops writing; it does not delete the file that is already there.',
      'Writes the notification log to a file inside the application data directory so it survives closing the window. Turning it off leaves this session listed and stops writing; it does not delete the file that is already there.',
      'Writes the log to a file in the application data directory so it survives a restart. Turning it off just stops the writing — the file already on disk is left alone.',
      'Writes the log to a file in the application data directory so it survives a restart. Turning it off only stops the writing; whatever is already on disk is left exactly where it is.',
      'Writes the log to a file in the application data directory so it survives a restart. Turning it off only stops the writing; whatever is already on disk is left exactly where it is.'
    ),
    ladder(
      '會將通知記錄寫入程式資料夾入面嘅檔案，關窗都唔會冇。閂咗佢只係唔再寫入，唔會刪走已經喺度嗰個檔案。',
      '會將通知記錄寫入程式資料夾入面嘅檔案，關窗都唔會冇。閂咗佢只係唔再寫入，唔會刪走已經喺度嗰個檔案。',
      '會將記錄寫入程式資料夾嘅檔案，重開都仲喺度。閂咗只係唔再寫，本來喺硬碟嗰個檔唔會郁。',
      '會將記錄寫入程式資料夾嘅檔案，重開都仲喺度。閂咗只係唔再寫，硬碟入面本來嗰個檔一條毛都唔會少。',
      '會將記錄寫入程式資料夾嘅檔案，重開都仲喺度。閂咗只係唔再寫，硬碟入面本來嗰個檔一條毛都唔會少。'
    )
  ),
  'notificationCentre.settings.retention': entry(ladder('How many records to keep'), ladder('保留幾多條記錄')),
  'notificationCentre.settings.retention.description': entry(
    ladder(
      'The newest records up to this count are kept. When a new notification pushes the total past it, the oldest record is dropped. Lowering this value drops the excess the next time the log is written.',
      'The newest records up to this count are kept. When a new notification pushes the total past it, the oldest record is dropped. Lowering this value drops the excess the next time the log is written.',
      'Keeps this many of the newest records. A new notification past the ceiling pushes the oldest one out, and lowering the number drops the excess at the next write.',
      'Keeps this many of the newest records, and pushes the oldest one out of the queue every time a new arrival takes the total over the line. Lower it and the excess goes at the next write.',
      'Keeps this many of the newest records, and pushes the oldest one out of the queue every time a new arrival takes the total over the line. Lower it and the excess goes at the next write.'
    ),
    ladder(
      '會保留最新嘅記錄，最多去到呢個數。新通知令總數超咗，就會丟走最舊嗰條。校細咗嘅話，下次寫入就會丟走多出嗰啲。',
      '會保留最新嘅記錄，最多去到呢個數。新通知令總數超咗，就會丟走最舊嗰條。校細咗嘅話，下次寫入就會丟走多出嗰啲。',
      '留最新嘅咁多條，新通知一超額就會擠走最舊嗰條；校細咗，下次寫入就掉走多咗嗰啲。',
      '留最新嘅咁多條，新通知一超額就會擠走最舊嗰條；你校細咗，下次寫入就會掉走多咗嗰啲。',
      '留最新嘅咁多條，新通知一超額就會擠走最舊嗰條；你校細咗，下次寫入就會掉走多咗嗰啲。'
    )
  ),
  'notificationCentre.settings.pageSize': entry(ladder('Rows shown per page'), ladder('每頁顯示幾多行')),
  'notificationCentre.settings.pageSize.description': entry(
    ladder(
      'How many records the centre renders at once. Each row carries live controls, so a page is bounded rather than rendering thousands of them at the same time.',
      'How many records the centre renders at once. Each row carries live controls, so a page is bounded rather than rendering thousands of them at the same time.',
      'How many records the centre draws at once. Every row carries real controls, so the page is bounded rather than building thousands of them.',
      'How many records the centre draws at once. Every row carries real, working controls, so the page is bounded rather than building several thousand of them and grinding to a halt.',
      'How many records the centre draws at once. Every row carries real, working controls, so the page is bounded rather than building several thousand of them and grinding to a halt.'
    ),
    ladder(
      '通知中心一次過畫幾多條記錄。每一行都有真正可以撳嘅控制項，所以要限住一頁，唔可以一次過畫幾千行。',
      '通知中心一次過畫幾多條記錄。每一行都有真正可以撳嘅控制項，所以要限住一頁，唔可以一次過畫幾千行。',
      '通知中心一次畫幾多條。每行都有真控制項，所以一頁要有上限，唔可以一次過起幾千行。',
      '通知中心一次畫幾多條。每行都有真真正正撳得嘅控制項，所以一頁要有上限，唔係起幾千行之後成個窗慢到停低。',
      '通知中心一次畫幾多條。每行都有真真正正撳得嘅控制項，所以一頁要有上限，唔係起幾千行之後成個窗慢到停低。'
    )
  ),
  'notificationCentre.settings.filtersExpanded': entry(
    ladder('Open the filter row when the centre opens'),
    ladder('一打開通知中心就展開篩選列')
  ),
  'notificationCentre.settings.filtersExpanded.description': entry(
    ladder(
      'The filter row is collapsible either way. While it is collapsed and a filter is still excluding records, the collapsed header says so rather than letting the list look shorter for no visible reason.',
      'The filter row is collapsible either way. While it is collapsed and a filter is still excluding records, the collapsed header says so rather than letting the list look shorter for no visible reason.',
      'The filter row collapses either way. Collapsed with a filter still excluding records, the header says so — a list that is quietly shorter than it should be is how people conclude their data is missing.',
      'The filter row collapses either way. Collapsed while a filter is still excluding records, the header says so out loud, because a list that is quietly shorter than it should be is exactly how somebody concludes their data has gone missing.',
      'The filter row collapses either way. Collapsed while a filter is still excluding records, the header says so out loud, because a list that is quietly shorter than it should be is exactly how somebody concludes their data has gone missing.'
    ),
    ladder(
      '無論點都收埋得。收埋咗但仲有篩選喺度排除緊記錄嘅話，個標題會照樣講出嚟，唔會令個清單無端端短咗都冇人知。',
      '無論點都收埋得。收埋咗但仲有篩選喺度排除緊記錄嘅話，個標題會照樣講出嚟，唔會令個清單無端端短咗都冇人知。',
      '點都收埋得。收埋咗但篩選仲喺度排走緊嘢，個標題會照講；清單無端端短咗，人哋就會以為啲資料唔見咗。',
      '點都收埋得。收埋咗但篩選仲喺度排走緊嘢，個標題一定會照講，因為清單無端端短咗，人哋就真係會以為自己啲資料唔見咗。',
      '點都收埋得。收埋咗但篩選仲喺度排走緊嘢，個標題一定會照講，因為清單無端端短咗，人哋就真係會以為自己啲資料唔見咗。'
    )
  ),
  'notificationCentre.settings.statisticsExpanded': entry(
    ladder('Open the statistics panel when the centre opens'),
    ladder('一打開通知中心就展開統計')
  ),
  'notificationCentre.settings.statisticsExpanded.description': entry(
    ladder(
      'The statistics only describe the log, so they start collapsed and stay out of the way of the list itself.',
      'The statistics only describe the log, so they start collapsed and stay out of the way of the list itself.',
      'The statistics only describe the log rather than changing it, so they start collapsed and keep out of the way.',
      'The statistics only describe the log rather than changing anything in it, so they start collapsed and keep out of the way of the thing you actually came to read.',
      'The statistics only describe the log rather than changing anything in it, so they start collapsed and keep out of the way of the thing you actually came to read.'
    ),
    ladder(
      '統計凈係描述個記錄檔，所以預設收埋，唔阻住個清單。',
      '統計凈係描述個記錄檔，所以預設收埋，唔阻住個清單。',
      '統計凈係講個記錄檔嘅情況，唔會改到啲嘢，所以預設收埋，唔阻住你。',
      '統計凈係講個記錄檔嘅情況，一啲都改唔到，所以預設收埋，唔阻住你真正想睇嗰樣嘢。',
      '統計凈係講個記錄檔嘅情況，一啲都改唔到，所以預設收埋，唔阻住你真正想睇嗰樣嘢。'
    )
  ),
  'notificationCentre.settings.exportFormat': entry(
    ladder('Format the export starts on'),
    ladder('匯出時預先揀嘅格式')
  ),
  'notificationCentre.settings.exportFormat.description': entry(
    ladder(
      'Which format the export panel offers first. Every format is still available there, and the panel reports what a chosen format cannot carry before anything is written.',
      'Which format the export panel offers first. Every format is still available there, and the panel reports what a chosen format cannot carry before anything is written.',
      'Which format the export panel opens on. All of them are still there, and the panel says what a format cannot carry before it writes anything.',
      'Which format the export panel opens on. All of them are still there, and the panel tells you exactly what a format cannot carry faithfully before a single byte is written.',
      'Which format the export panel opens on. All of them are still there, and the panel tells you exactly what a format cannot carry faithfully before a single byte is written.'
    ),
    ladder(
      '匯出面板一開先揀邊個格式。所有格式都仲喺度，而且寫任何嘢之前，面板會講清楚邊啲欄位載唔起。',
      '匯出面板一開先揀邊個格式。所有格式都仲喺度，而且寫任何嘢之前，面板會講清楚邊啲欄位載唔起。',
      '匯出面板一開係邊個格式。全部格式都仲喺度，寫之前會講清楚邊啲嘢載唔起。',
      '匯出面板一開係邊個格式。全部格式都仲喺度，而且落筆寫一個位元之前，就會講清楚邊啲嘢載唔完整。',
      '匯出面板一開係邊個格式。全部格式都仲喺度，而且落筆寫一個位元之前，就會講清楚邊啲嘢載唔完整。'
    )
  ),
  'notificationCentre.settings.clear': entry(
    ladder('Delete every stored notification'),
    ladder('刪晒所有存低咗嘅通知')
  ),
  'notificationCentre.settings.clear.description': entry(
    ladder(
      'Empties the log, including the records raised by this session. It goes through the two-key confirmation, and the deletion is recorded in local history.',
      'Empties the log, including the records raised by this session. It goes through the two-key confirmation, and the deletion is recorded in local history.',
      'Empties the log, this session included. It goes through the two-key gate first, and the deletion is recorded in local history.',
      'Empties the log, this session included. It goes through the two-key gate first, and the deletion is written into local history — the one thing that does survive it.',
      'Empties the log, this session included. It goes through the two-key gate first, and the deletion is written into local history — the one thing that does survive it.'
    ),
    ladder(
      '會清空成個記錄檔，包括今次開機出嗰啲。要行兩把鎖匙嘅確認關卡，而且刪除會寫入本機歷史。',
      '會清空成個記錄檔，包括今次開機出嗰啲。要行兩把鎖匙嘅確認關卡，而且刪除會寫入本機歷史。',
      '會清空記錄檔，連今次開機嗰啲都清。要先過兩把鎖匙嗰關，刪除會寫入本機歷史。',
      '會清空記錄檔，連今次開機嗰啲都清。要先過兩把鎖匙嗰關；刪除會寫入本機歷史，係唯一活得低嘅嘢。',
      '會清空記錄檔，連今次開機嗰啲都清。要先過兩把鎖匙嗰關；刪除會寫入本機歷史，係唯一活得低嘅嘢。'
    )
  ),
  'notificationCentre.settings.reveal': entry(
    ladder('Open the folder holding the log'),
    ladder('打開放住記錄檔嗰個資料夾')
  ),
  'notificationCentre.settings.reveal.description': entry(
    ladder(
      'Opens the directory containing the notification log file in this platform’s own file manager. Nothing is deleted; the folder is simply opened.',
      'Opens the directory containing the notification log file in this platform’s own file manager. Nothing is deleted; the folder is simply opened.',
      'Opens the directory holding the log file in the platform’s own file manager. Nothing is deleted — the folder is just opened.',
      'Opens the directory holding the log file in the platform’s own file manager. Nothing is deleted, moved or tidied; the folder is simply opened and then it is your business.',
      'Opens the directory holding the log file in the platform’s own file manager. Nothing is deleted, moved or tidied; the folder is simply opened and then it is your business.'
    ),
    ladder(
      '會用系統自己個檔案總管打開放住記錄檔嗰個資料夾。唔會刪任何嘢，凈係打開。',
      '會用系統自己個檔案總管打開放住記錄檔嗰個資料夾。唔會刪任何嘢，凈係打開。',
      '會用系統嘅檔案總管打開放記錄檔嗰個資料夾。乜都唔會刪，凈係打開。',
      '會用系統嘅檔案總管打開放記錄檔嗰個資料夾。乜都唔會刪、唔會搬、唔會執，打開咗之後就係你嘅事。',
      '會用系統嘅檔案總管打開放記錄檔嗰個資料夾。乜都唔會刪、唔會搬、唔會執，打開咗之後就係你嘅事。'
    )
  )
};
