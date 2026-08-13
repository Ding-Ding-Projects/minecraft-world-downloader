import type { Catalogue, FunnyLadder, TranslationEntry } from '../../core/registry';

/**
 * Every piece of copy this feature renders, in English and in playful Hong Kong
 * Cantonese, at all five humour levels.
 *
 * Humour styles the VOICE and never the FACTS. A destructive line at level 5
 * still names the exact lane, exactly what is removed and that it cannot be
 * undone; a level-1 line says the same thing with a straight face. A status
 * value, a count, a path or an age is either interpolated verbatim or held
 * identical across every rung.
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

export const STATUS_STRINGS: Catalogue = {
  /* ---------------- destination ---------------- */

  'status.tab.title': entry(ladder('Status'), ladder('狀態')),
  'status.tab.subtitle': entry(
    ladder(
      "This application's own status board — this checkout, plus anything else you choose to track here.",
      "This application's own status board — this checkout, plus anything else you choose to track here.",
      'This checkout, and anything else you keep an eye on, all on one board.',
      'This checkout and whatever else you fancy keeping an eye on, all parked on one board.',
      'This checkout and whatever else you fancy keeping an eye on, all parked on one board.'
    ),
    ladder(
      '呢個程式自己嘅狀態板 —— 呢個checkout，加埋你揀住要跟嘅嘢。',
      '呢個程式自己嘅狀態板 —— 呢個checkout，加埋你揀住要跟嘅嘢。',
      '呢個checkout，仲有你想跟嘅嘢，全部擺喺一塊板度。',
      '呢個checkout同埋你想睇住嘅嘢，全部齊齊整整泊喺一塊板度。',
      '呢個checkout同埋你想睇住嘅嘢，全部齊齊整整泊喺一塊板度。'
    )
  ),

  'status.action.refresh': entry(ladder('Refresh from Git'), ladder('由Git重新讀取')),
  'status.action.add': entry(ladder('Add a status lane'), ladder('加一條狀態')),

  'status.banner.heading': entry(
    ladder('A local record, not a live connection'),
    ladder('本機紀錄，唔係實時連線')
  ),
  'status.banner.body': entry(
    ladder(
      "This tab reads this application's own record from disk. It never connects to the shared status hub over the network, and it never shows or stores the hub's enrollment token. Everything below is what is actually on this computer, with its age stated beside it — never a stale record shown as current.",
      "This tab reads this application's own record from disk. It never connects to the shared status hub over the network, and it never shows or stores the hub's enrollment token. Everything below is what is actually on this computer, with its age stated beside it — never a stale record shown as current.",
      "This tab reads its own record straight off disk. It never phones the shared hub, and it never so much as glances at the hub's token. What you see below is exactly what is on this machine, with its age printed beside it, so nothing stale gets to pretend it's current.",
      "This tab minds its own business: it reads its own file off disk and never dials the shared hub, and the hub's token never comes anywhere near it. What's below is exactly what's on this machine, age tag and all — no stale gossip pretending to be breaking news.",
      "This tab minds its own business: it reads its own file off disk and never dials the shared hub, and the hub's token never comes anywhere near it. What's below is exactly what's on this machine, age tag and all — no stale gossip pretending to be breaking news."
    ),
    ladder(
      '呢個分頁淨係喺硬碟度讀返自己嘅紀錄。佢唔會經網絡連去嗰個共享狀態hub，亦都唔會顯示或者儲低hub嗰個登記token。下面顯示嘅嘢係呢部電腦真係有嘅資料，仲會寫低幾耐之前，唔會將舊資料當成新嘅。',
      '呢個分頁淨係喺硬碟度讀返自己嘅紀錄。佢唔會經網絡連去嗰個共享狀態hub，亦都唔會顯示或者儲低hub嗰個登記token。下面顯示嘅嘢係呢部電腦真係有嘅資料，仲會寫低幾耐之前，唔會將舊資料當成新嘅。',
      '呢個分頁淨係喺硬碟讀返自己嗰份紀錄，唔會打電話畀個共享hub，亦都唔會掂到hub嗰個token半吋。下面見到嘅，係呢部機真真正正嘅嘢，仲貼埋幾舊，唔會扮新聞呃你。',
      '呢個分頁乖乖哋淨係讀自己喺硬碟嗰份，唔會打畀個共享hub八卦，hub嗰條token更加摸都冇摸過。下面全部係呢部機嘅真料，仲貼埋「幾耐之前」，舊料唔會扮頭條呃你㗎。',
      '呢個分頁乖乖哋淨係讀自己喺硬碟嗰份，唔會打畀個共享hub八卦，hub嗰條token更加摸都冇摸過。下面全部係呢部機嘅真料，仲貼埋「幾耐之前」，舊料唔會扮頭條呃你㗎。'
    )
  ),

  'status.store.path': entry(ladder('Stored at {path}.'), ladder('儲存喺 {path}。')),
  'status.store.unreadable': entry(
    ladder('The local record could not be read: {reason}'),
    ladder('讀唔到本機紀錄：{reason}')
  ),

  /* ---------------- age ---------------- */

  'status.age.never': entry(ladder('never refreshed'), ladder('從未重新讀取過')),
  'status.age.justNow': entry(ladder('just now'), ladder('啱啱')),
  'status.age.oneMinute': entry(ladder('1 minute ago'), ladder('1 分鐘前')),
  'status.age.minutes': entry(ladder('{count} minutes ago'), ladder('{count} 分鐘前')),
  'status.age.oneHour': entry(ladder('1 hour ago'), ladder('1 個鐘前')),
  'status.age.hours': entry(ladder('{count} hours ago'), ladder('{count} 個鐘前')),
  'status.age.oneDay': entry(ladder('1 day ago'), ladder('1 日前')),
  'status.age.days': entry(ladder('{count} days ago'), ladder('{count} 日前')),

  /* ---------------- status values ---------------- */

  'status.value.running': entry(ladder('Running'), ladder('進行緊')),
  'status.value.waiting': entry(ladder('Waiting'), ladder('等緊')),
  'status.value.blocked': entry(ladder('Blocked'), ladder('卡住咗')),
  'status.value.landed': entry(ladder('Landed'), ladder('已經上咗')),
  'status.value.failed': entry(ladder('Failed'), ladder('失敗咗')),

  'status.evidenceValue.pending': entry(ladder('Pending'), ladder('未開始')),
  'status.evidenceValue.running': entry(ladder('Running'), ladder('進行緊')),
  'status.evidenceValue.verified': entry(ladder('Verified'), ladder('已核實')),
  'status.evidenceValue.failed': entry(ladder('Failed'), ladder('失敗咗')),

  /* ---------------- filters ---------------- */

  'status.filter.heading': entry(ladder('Filter by status'), ladder('用狀態篩選')),
  'status.filter.all': entry(ladder('All'), ladder('全部')),
  'status.search.label': entry(ladder('Search status lanes'), ladder('搵狀態')),
  'status.search.placeholder': entry(
    ladder('Search title, repository, summary, evidence…'),
    ladder('搵標題、倉、摘要、證據……')
  ),

  'status.lanes.heading': entry(ladder('Status lanes'), ladder('狀態')),
  'status.results.count': entry(ladder('{count} status lane(s).'), ladder('{count} 條狀態。')),
  'status.results.filtered': entry(
    ladder('{shown} of {total} status lane(s) match the current filter.'),
    ladder('{total} 條入面有 {shown} 條啱現時嘅篩選。')
  ),

  'status.empty.title': entry(ladder('Nothing matches'), ladder('搵唔到嘢')),
  'status.empty.body': entry(
    ladder(
      'Nothing matches the current search and filter. Clear them, or add a status lane.',
      'Nothing matches the current search and filter. Clear them, or add a status lane.',
      'Nothing matches the current search and filter. Clear one of them, or add a lane.',
      'Current search and filter turned up nothing. Clear one, or just add a lane — the board is only as full as you make it.',
      'Current search and filter turned up nothing. Clear one, or just add a lane — the board is only as full as you make it.'
    ),
    ladder(
      '現時嘅搜尋同篩選乜都搵唔到。清咗佢哋，或者加一條狀態。',
      '現時嘅搜尋同篩選乜都搵唔到。清咗佢哋，或者加一條狀態。',
      '而家嘅搜尋同篩選乜都搵唔返。清返一個，或者加返一條。',
      '搜尋加篩選夾埋乜都冇。清返一個，定係直接加一條——塊板有幾滿全睇你。',
      '搜尋加篩選夾埋乜都冇。清返一個，定係直接加一條——塊板有幾滿全睇你。'
    )
  ),

  /* ---------------- bulk ---------------- */

  'status.bulk.title': entry(ladder('Selected status lanes'), ladder('揀咗嘅狀態')),
  'status.bulk.count': entry(ladder('{count} selected'), ladder('揀咗 {count} 條')),
  'status.bulk.selectAll': entry(ladder('Select all matching'), ladder('全部揀晒')),
  'status.bulk.invert': entry(ladder('Invert selection'), ladder('反轉揀選')),
  'status.bulk.clear': entry(ladder('Clear selection'), ladder('清空揀選')),
  'status.bulk.export': entry(ladder('Export selected'), ladder('匯出揀咗嘅')),
  'status.bulk.delete': entry(ladder('Delete selected'), ladder('刪除揀咗嘅')),
  'status.bulk.deleteNoSelection': entry(ladder('Select at least one lane first.'), ladder('請先揀最少一條。')),
  'status.bulk.exportNoSelection': entry(ladder('Select at least one lane first.'), ladder('請先揀最少一條。')),
  'status.bulk.deleteOnlySelf': entry(
    ladder(
      "This checkout's own record can't be removed. Select a lane you added yourself.",
      "This checkout's own record can't be removed. Select a lane you added yourself.",
      "This checkout's own record stays put — pick a lane you added by hand instead.",
      "This checkout's own record is going nowhere — pick one of the lanes you actually added.",
      "This checkout's own record is going nowhere — pick one of the lanes you actually added."
    ),
    ladder(
      '呢個checkout自己嘅紀錄唔可以刪。揀返一條你自己加嘅。',
      '呢個checkout自己嘅紀錄唔可以刪。揀返一條你自己加嘅。',
      '呢個checkout自己嗰條紀錄唔郁得。揀返一條你自己加落去嗰啲。',
      '呢個checkout自己嗰條，佢唔會走。揀返一條你自己親手加嘅嚟刪。',
      '呢個checkout自己嗰條，佢唔會走。揀返一條你自己親手加嘅嚟刪。'
    )
  ),

  /* ---------------- confirm ---------------- */

  'status.confirm.deleteOneAction': entry(
    ladder('Delete the status lane "{title}"'),
    ladder('刪除狀態「{title}」')
  ),
  'status.confirm.deleteManyAction': entry(ladder('Delete {count} status lanes'), ladder('刪除 {count} 條狀態')),
  'status.confirm.irreversible': entry(
    ladder(
      'This local record is removed from the status file on disk. The removal is written to local history, so it can be reviewed there afterwards.',
      'This local record is removed from the status file on disk. The removal is written to local history, so it can be reviewed there afterwards.',
      'This is removed from the status file on disk. The removal itself is written to local history, so you can look it up again afterwards.',
      "This comes off the status file on disk for good. The removal gets its own entry in local history though, so it isn't gone from every record — just from this board.",
      "This comes off the status file on disk for good. The removal gets its own entry in local history though, so it isn't gone from every record — just from this board."
    ),
    ladder(
      '呢條本機紀錄會由硬碟嗰個狀態檔案入面刪走。呢個刪除動作會寫入本機歷史，之後可以喺嗰度查返。',
      '呢條本機紀錄會由硬碟嗰個狀態檔案入面刪走。呢個刪除動作會寫入本機歷史，之後可以喺嗰度查返。',
      '呢條會由硬碟嗰個狀態檔案入面刪走。刪除呢個動作本身會寫入本機歷史，之後可以查返。',
      '呢條會喺硬碟嗰個狀態檔案入面永久消失，不過刪除呢個動作自己會記喺本機歷史度——即係唔係完全冇晒紀錄，淨係喺呢塊板度冇咗。',
      '呢條會喺硬碟嗰個狀態檔案入面永久消失，不過刪除呢個動作自己會記喺本機歷史度——即係唔係完全冇晒紀錄，淨係喺呢塊板度冇咗。'
    )
  ),

  /* ---------------- export ---------------- */

  'status.export.title': entry(ladder('Export status lanes'), ladder('匯出狀態')),
  'status.export.empty': entry(ladder('There is nothing to export yet.'), ladder('而家仲未有嘢可以匯出。')),
  'status.export.count': entry(ladder('{count} lane(s) will be written.'), ladder('會寫入 {count} 條。')),
  'status.export.format': entry(ladder('Format'), ladder('格式')),
  'status.export.noLosses': entry(
    ladder('{format} carries every field faithfully.'),
    ladder('{format} 可以完整保留每一個欄位。')
  ),
  'status.export.losses': entry(
    ladder('{format} cannot carry every field faithfully. These become text: {fields}'),
    ladder('{format} 唔可以完整保留每一個欄位，呢啲會變成純文字：{fields}')
  ),
  'status.export.cancelled': entry(ladder('Nothing was written.'), ladder('冇寫低任何嘢。')),
  'status.export.saved': entry(ladder('Exported to {path}'), ladder('已匯出到 {path}')),

  /* ---------------- self lane ---------------- */

  'status.lane.local': entry(ladder('This checkout'), ladder('呢個checkout')),
  'status.self.refresh': entry(ladder('Refresh from Git'), ladder('由Git重新讀取')),
  'status.self.refreshing': entry(ladder('Reading Git…'), ladder('讀緊Git……')),
  'status.self.alreadyRefreshing': entry(ladder('Already refreshing.'), ladder('已經喺度讀緊。')),
  'status.self.retry': entry(ladder('Retry'), ladder('再試一次')),
  'status.self.lastAttempt': entry(ladder('Last refresh attempt: {age}'), ladder('上次嘗試重新讀取：{age}')),
  'status.self.error': entry(
    ladder('Git could not be read: {reason}'),
    ladder('讀唔到Git：{reason}')
  ),

  /* ---------------- lane row ---------------- */

  'status.lane.select': entry(ladder('Select "{title}"'), ladder('揀選「{title}」')),
  'status.lane.showDetails': entry(ladder('Show details for "{title}"'), ladder('顯示「{title}」嘅詳情')),
  'status.lane.hideDetails': entry(ladder('Hide details for "{title}"'), ladder('收起「{title}」嘅詳情')),
  'status.lane.edit': entry(ladder('Edit'), ladder('編輯')),
  'status.lane.delete': entry(ladder('Delete'), ladder('刪除')),
  'status.lane.noRepository': entry(ladder('No repository recorded'), ladder('未有記低倉')),
  'status.lane.noSummary': entry(ladder('No summary recorded yet.'), ladder('仲未有摘要。')),
  'status.lane.updated': entry(ladder('updated {age}'), ladder('{age}更新')),
  'status.lane.agent': entry(ladder('Agent'), ladder('負責嘅agent')),
  'status.lane.machine': entry(ladder('Machine'), ladder('機器')),
  'status.lane.verifiedBaseline': entry(ladder('Verified baseline'), ladder('已核實嘅基準')),
  'status.lane.assumption': entry(ladder('Assumption'), ladder('假設緊嘅嘢')),
  'status.lane.dirty': entry(ladder('uncommitted changes'), ladder('未commit嘅改動')),
  'status.lane.worktree': entry(ladder('{path} at {commit}{dirty}'), ladder('{path}，喺{commit}{dirty}')),
  'status.lane.evidence.heading': entry(ladder('Evidence'), ladder('證據')),
  'status.lane.evidence.empty': entry(ladder('No evidence recorded.'), ladder('未有記低證據。')),
  'status.lane.evidence.open': entry(ladder('Open "{label}" in your browser'), ladder('喺瀏覽器開「{label}」')),
  'status.lane.evidence.openFailedTitle': entry(ladder('Open evidence link'), ladder('開啟證據連結')),
  'status.lane.evidence.openFailed': entry(
    ladder('Could not open that link: {reason}'),
    ladder('開唔到嗰個連結：{reason}')
  ),
  'status.lane.gates.heading': entry(ladder('Next gates'), ladder('下一步嘅Chut')),
  'status.lane.gates.empty': entry(ladder('No next gates recorded.'), ladder('未有記低下一步。')),

  /* ---------------- notifications ---------------- */

  'status.notify.refreshTitle': entry(ladder('Refresh this checkout from Git'), ladder('由Git重新讀取呢個checkout')),
  'status.notify.refreshOk': entry(ladder('Refreshed.'), ladder('已經重新讀取。')),
  'status.notify.refreshFailed': entry(
    ladder('Git could not be read: {reason}'),
    ladder('讀唔到Git：{reason}')
  ),
  'status.notify.saveFailedTitle': entry(ladder('Save this status lane'), ladder('儲存呢條狀態')),
  'status.notify.saveFailed': entry(
    ladder('Could not save this lane: {reason}'),
    ladder('呢條儲存唔到：{reason}')
  ),
  'status.notify.added': entry(ladder('Added "{title}".'), ladder('已加咗「{title}」。')),
  'status.notify.updated': entry(ladder('Updated "{title}".'), ladder('已更新「{title}」。')),
  'status.notify.deleteFailedTitle': entry(ladder('Delete a status lane'), ladder('刪除一條狀態')),
  'status.notify.deleteFailed': entry(
    ladder('Could not remove that lane: {reason}'),
    ladder('刪唔到嗰條：{reason}')
  ),
  'status.notify.deletedOne': entry(ladder('Removed "{title}".'), ladder('已刪除「{title}」。')),
  'status.notify.deleted': entry(ladder('{count} status lane(s) removed.'), ladder('已刪除 {count} 條狀態。')),
  'status.notify.deleteSkippedSelf': entry(
    ladder(
      "This checkout's own record was left alone — it can be edited, but never removed.",
      "This checkout's own record was left alone — it can be edited, but never removed.",
      "This checkout's own record was left as it was — editable, never removable.",
      "This checkout's own record kept its seat — you can rewrite it all you like, but it is never leaving the board.",
      "This checkout's own record kept its seat — you can rewrite it all you like, but it is never leaving the board."
    ),
    ladder(
      '呢個checkout自己嗰條紀錄冇郁過——可以編輯，但係永遠唔會刪走。',
      '呢個checkout自己嗰條紀錄冇郁過——可以編輯，但係永遠唔會刪走。',
      '呢個checkout自己嗰條照舊喺度——可以改，但係唔會刪。',
      '呢個checkout自己嗰條穩坐釣魚船——你想點改都得，但佢就係唔會走。',
      '呢個checkout自己嗰條穩坐釣魚船——你想點改都得，但佢就係唔會走。'
    )
  ),

  /* ---------------- add/edit form ---------------- */

  'status.form.addTitle': entry(ladder('Add a status lane'), ladder('加一條狀態')),
  'status.form.editTitle': entry(ladder('Edit the status lane "{title}"'), ladder('編輯狀態「{title}」')),
  'status.form.editTitle.short': entry(ladder('Edit this lane'), ladder('編輯呢條')),
  'status.form.selfNote': entry(
    ladder(
      'This is this checkout’s own record. Repository, branch and the verified baseline are read from Git on the card behind this one — press Refresh from Git there to update them, not here.',
      'This is this checkout’s own record. Repository, branch and the verified baseline are read from Git on the card behind this one — press Refresh from Git there to update them, not here.',
      'This is this checkout’s own record. Repository, branch and the verified baseline come from Git on the card behind this one — refresh those there, not here.',
      'This one is this checkout’s own record, so Git already answered the repository, branch and baseline questions on the card behind this form — go press Refresh there if those need updating, not here.',
      'This one is this checkout’s own record, so Git already answered the repository, branch and baseline questions on the card behind this form — go press Refresh there if those need updating, not here.'
    ),
    ladder(
      '呢個係呢個checkout自己嘅紀錄。倉、分支同已核實嘅基準係喺後面嗰張卡由Git讀返嚟嘅——要更新就去嗰度撳「由Git重新讀取」，唔係喺呢度。',
      '呢個係呢個checkout自己嘅紀錄。倉、分支同已核實嘅基準係喺後面嗰張卡由Git讀返嚟嘅——要更新就去嗰度撳「由Git重新讀取」，唔係喺呢度。',
      '呢個係checkout自己嘅紀錄，倉、分支同基準都係後面嗰張卡由Git讀返嚟——要更新就去嗰度撳，唔喺呢度撳。',
      '呢條係checkout自己嗰條，倉呀分支呀基準呀，Git早就喺後面嗰張卡度答咗你——要改就返去嗰度撳「重新讀取」，喺呢度撳都冇用。',
      '呢條係checkout自己嗰條，倉呀分支呀基準呀，Git早就喺後面嗰張卡度答咗你——要改就返去嗰度撳「重新讀取」，喺呢度撳都冇用。'
    )
  ),
  'status.form.gitOwned': entry(
    ladder('Read from Git on the card behind this one. Press Refresh from Git there instead.'),
    ladder('由後面嗰張卡嘅Git讀返嚟。要改就去嗰度撳「由Git重新讀取」。')
  ),
  'status.form.title': entry(ladder('Title'), ladder('標題')),
  'status.form.title.hint': entry(
    ladder('A short name you will recognise in the list.'),
    ladder('一個你喺清單度一眼認得出嘅簡短名。')
  ),
  'status.form.repository': entry(ladder('Repository'), ladder('倉')),
  'status.form.branch': entry(ladder('Branch'), ladder('分支')),
  'status.form.agent': entry(ladder('Agent'), ladder('負責嘅agent')),
  'status.form.agent.hint': entry(
    ladder('Who or what is doing this work, if that is worth naming.'),
    ladder('邊個或者邊個agent做緊呢件事，值得寫就寫。')
  ),
  'status.form.machine': entry(ladder('Machine'), ladder('機器')),
  'status.form.machine.hint': entry(
    ladder("This application cannot read the computer’s name by itself; type it if it matters to you."),
    ladder('呢個程式冇辦法自己讀到部電腦嘅名；覺得緊要就自己打落去。')
  ),
  'status.form.status': entry(ladder('Status'), ladder('狀態')),
  'status.form.summary': entry(ladder('Summary'), ladder('摘要')),
  'status.form.summary.hint': entry(
    ladder('What is actually true right now, in a sentence or two.'),
    ladder('而家真正嘅情況，一兩句講清楚。')
  ),
  'status.form.assumption': entry(ladder('Assumption'), ladder('假設緊嘅嘢')),
  'status.form.assumption.hint': entry(
    ladder('Optional. What you are proceeding on, rather than waiting to confirm.'),
    ladder('唔填都得。你而家係跟住乜嘢假設繼續做，而唔係等緊確認先做。')
  ),
  'status.form.verifiedBaseline': entry(ladder('Verified baseline'), ladder('已核實嘅基準')),
  'status.form.verifiedBaseline.hint': entry(
    ladder('A claim about the remote you can actually prove — a SHA comparison, a run link — not a guess.'),
    ladder('一個關於remote、你真係可以證實嘅講法——例如SHA比對、run嘅連結——唔係靠估。')
  ),
  'status.form.evidence.heading': entry(ladder('Evidence'), ladder('證據')),
  'status.form.evidence.add': entry(ladder('Add evidence'), ladder('加證據')),
  'status.form.evidence.remove': entry(ladder('Remove this piece of evidence'), ladder('移除呢個證據')),
  'status.form.evidence.label': entry(ladder('What it is'), ladder('係咩嚟嘅')),
  'status.form.evidence.url': entry(ladder('Link (http or https)'), ladder('連結（http或https）')),
  'status.form.evidence.state': entry(ladder('State'), ladder('狀態')),
  'status.form.evidence.max': entry(
    ladder('Up to {max} pieces of evidence per lane.'),
    ladder('每條最多 {max} 個證據。')
  ),
  'status.form.gates.heading': entry(ladder('Next gates'), ladder('下一步嘅Chut')),
  'status.form.gates.add': entry(ladder('Add a gate'), ladder('加一個Chut')),
  'status.form.gates.remove': entry(ladder('Remove this gate'), ladder('移除呢個Chut')),
  'status.form.gates.placeholder': entry(ladder('What has to happen next'), ladder('下一步要做咩')),
  'status.form.gates.max': entry(
    ladder('Up to {max} next gates per lane.'),
    ladder('每條最多 {max} 個下一步。')
  ),
  'status.form.save': entry(ladder('Save'), ladder('儲存')),
  'status.form.cancel': entry(ladder('Cancel'), ladder('取消')),
  'status.form.validation.titleRequired': entry(
    ladder('Give this lane a name before saving.'),
    ladder('儲存之前要先畀個名呢條。')
  ),
  'status.form.validation.evidenceInvalid': entry(
    ladder('Every piece of evidence needs a label and a real http or https link, or should be removed.'),
    ladder('每個證據都要有標籤同真正嘅http或https連結，唔係就移除佢。')
  ),

  /* ---------------- settings ---------------- */

  'status.settings.autoRefresh': entry(
    ladder('Refresh this checkout automatically'),
    ladder('自動重新讀取呢個checkout')
  ),
  'status.settings.autoRefresh.description': entry(
    ladder(
      'While the Status tab is open, this checkout’s own record is re-read from Git on a timer, in the background, without interrupting anything you are doing.',
      'While the Status tab is open, this checkout’s own record is re-read from Git on a timer, in the background, without interrupting anything you are doing.',
      'While the Status tab is open, this checkout’s record refreshes itself from Git on a timer in the background.',
      'While the Status tab is open, this checkout quietly re-checks itself against Git on a timer, in the background, without so much as tapping you on the shoulder.',
      'While the Status tab is open, this checkout quietly re-checks itself against Git on a timer, in the background, without so much as tapping you on the shoulder.'
    ),
    ladder(
      '開住個狀態分頁嘅時候，呢個checkout自己嘅紀錄會定時喺背景由Git重新讀取，唔會打斷你手頭上嘅嘢。',
      '開住個狀態分頁嘅時候，呢個checkout自己嘅紀錄會定時喺背景由Git重新讀取，唔會打斷你手頭上嘅嘢。',
      '狀態分頁開住嘅時候，呢個checkout嘅紀錄會定時喺背景由Git自動更新。',
      '狀態分頁開住，呢個checkout就自己定時偷偷去問Git，喺背景做，唔會拍你膊頭打擾你。',
      '狀態分頁開住，呢個checkout就自己定時偷偷去問Git，喺背景做，唔會拍你膊頭打擾你。'
    )
  ),
  'status.settings.autoRefreshSeconds': entry(
    ladder('Refresh interval'),
    ladder('重新讀取間隔')
  ),
  'status.settings.autoRefreshSeconds.description': entry(
    ladder(
      'How often, in seconds, the automatic refresh above runs while the Status tab is open. Between 15 seconds and one hour.',
      'How often, in seconds, the automatic refresh above runs while the Status tab is open. Between 15 seconds and one hour.',
      'How often, in seconds, the automatic refresh runs while the tab is open. Between 15 seconds and an hour.',
      'How often, in seconds, that automatic refresh above actually fires while you have the tab open — anywhere from 15 seconds to a full hour.',
      'How often, in seconds, that automatic refresh above actually fires while you have the tab open — anywhere from 15 seconds to a full hour.'
    ),
    ladder(
      '上面嗰個自動重新讀取，喺開住狀態分頁嗰陣，每幾多秒行一次。範圍係15秒到1個鐘。',
      '上面嗰個自動重新讀取，喺開住狀態分頁嗰陣，每幾多秒行一次。範圍係15秒到1個鐘。',
      '開住分頁嘅時候，上面嗰個自動重新讀取每幾多秒行一次，15秒到1個鐘之間。',
      '開住分頁嗰陣，上面嗰個自動重新讀取實際上隔幾多秒先郁一次——由15秒到成個鐘都得，你話事。',
      '開住分頁嗰陣，上面嗰個自動重新讀取實際上隔幾多秒先郁一次——由15秒到成個鐘都得，你話事。'
    )
  ),

  /* ---------------- palette ---------------- */

  'status.palette.open': entry(ladder('Open Status'), ladder('開啟狀態')),
  'status.palette.open.subtitle': entry(
    ladder("This application's own status board"),
    ladder('呢個程式自己嘅狀態板')
  ),
  'status.palette.addLane': entry(ladder('Add a status lane…'), ladder('加一條狀態……')),
  'status.palette.search': entry(ladder('Search status lanes'), ladder('搵狀態')),
  'status.palette.refresh': entry(ladder('Refresh this checkout from Git'), ladder('由Git重新讀取呢個checkout'))
};
