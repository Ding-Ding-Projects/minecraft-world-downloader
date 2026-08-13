import type { Catalogue } from '../../core/registry';

/**
 * Every word this feature renders.
 *
 * Five rungs per language, and the two ladders are independent — English at 1
 * beside Cantonese at 5 is a combination somebody will choose. Humour styles the
 * voice; it never touches a fact. A version number, a byte count, a digest and a
 * file path read the same at level 1 and level 5, because a reader at level 5
 * still has to be able to act on them.
 *
 * One fact in particular is never softened at any level: these artifacts are
 * unsigned, and nothing here verifies who published them.
 */

/** Builds an entry where every rung is the same sentence, for pure facts. */
function flat(en: string, yue: string): Catalogue[string] {
  return { en: [en, en, en, en, en], yue: [yue, yue, yue, yue, yue] };
}

/** Builds an entry from three distinct voices: plain, warmer, playful. */
function ladder(
  en: [string, string, string],
  yue: [string, string, string]
): Catalogue[string] {
  return {
    en: [en[0], en[0], en[1], en[2], en[2]],
    yue: [yue[0], yue[0], yue[1], yue[2], yue[2]]
  };
}

export const UPDATES_STRINGS: Catalogue = {
  /* ---------------------------------------------------------------- */
  /* Destination and headings                                          */
  /* ---------------------------------------------------------------- */

  'updates.tab': ladder(
    ['Updates', 'App updates', 'Updates — is there a newer one yet?'],
    ['更新', '應用程式更新', '更新 —— 睇下有冇新版啦']
  ),
  'updates.title': ladder(
    ['Application updates', 'Application updates', 'Application updates, checked and staged'],
    ['應用程式更新', '應用程式更新', '應用程式更新，查完擺定咗']
  ),
  'updates.subtitle': ladder(
    [
      'Checks the release feed, verifies the package against the digest the feed states, and stages it for an explicit restart.',
      'Reads the release feed, checks the package against the digest the feed states, and puts it aside for a restart you ask for.',
      'Reads the feed, weighs the package against the digest the feed swears by, and parks it until you say restart.'
    ],
    [
      '讀取發佈來源、用來源列明嘅摘要核對安裝包，然後擺定，等你自己揀幾時重新開機安裝。',
      '讀發佈來源、對返來源寫低嘅摘要，擺定一份，等你話重新開機先安裝。',
      '去發佈來源攞料、對返佢寫低嘅摘要，擺定一份喺度等你出聲先郁。'
    ]
  ),
  'updates.section.status': ladder(
    ['Current state', 'Current state', 'Where things stand right now'],
    ['目前狀態', '目前狀態', '而家去到邊']
  ),
  'updates.section.actions': flat('Actions', '動作'),
  'updates.section.log': ladder(
    ['Check log', 'Check log', 'Every check, and how each one went'],
    ['檢查紀錄', '檢查紀錄', '每次檢查同結果，一次都冇漏']
  ),

  /* ---------------------------------------------------------------- */
  /* The unsigned artifact statement — never softened                  */
  /* ---------------------------------------------------------------- */

  'updates.unsigned.heading': flat('Unsigned artifact', '未簽署嘅安裝檔'),
  'updates.unsigned.body': flat(
    'This application is not code-signed. The digest check proves the downloaded bytes are the bytes the release feed named; it proves nothing about who published them. Windows will show an unknown-publisher warning when the installer runs.',
    '呢個應用程式冇做程式碼簽署。摘要核對淨係證明下載到嘅位元組同發佈來源寫低嗰個一樣，完全唔證明係邊個發佈。行安裝檔嗰陣，Windows 會彈「發行者不明」嘅警告。'
  ),

  /* ---------------------------------------------------------------- */
  /* Phases                                                            */
  /* ---------------------------------------------------------------- */

  'updates.phase.idle': ladder(
    ['Not checked yet this session', 'Not checked yet this session', 'Nothing checked yet this session'],
    ['今次開機仲未查過', '今次開機仲未查過', '今次開機都未去查過添']
  ),
  'updates.phase.disabled': flat('Automatic updates are switched off', '自動更新已經閂咗'),
  'updates.phase.unconfigured': flat('No release feed is configured', '未設定發佈來源'),
  'updates.phase.checking': ladder(
    ['Checking the release feed', 'Checking the release feed', 'Having a look at the release feed'],
    ['檢查緊發佈來源', '檢查緊發佈來源', '而家去發佈來源望下']
  ),
  'updates.phase.upToDate': ladder(
    ['Up to date', 'Up to date', 'Up to date — nothing to do'],
    ['已經係最新', '已經係最新', '已經係最新，乜都唔使做']
  ),
  'updates.phase.available': ladder(
    ['An update is available', 'An update is available', 'A newer build is sitting in the feed'],
    ['有更新可以裝', '有更新可以裝', '發佈來源度有個新版本喺度等']
  ),
  'updates.phase.downloading': ladder(
    ['Downloading the package', 'Downloading the package', 'Pulling the package down'],
    ['下載緊安裝包', '下載緊安裝包', '扯緊個安裝包落嚟']
  ),
  'updates.phase.verifying': ladder(
    ['Verifying the digest', 'Verifying the digest', 'Checking the digest matches'],
    ['核對緊摘要', '核對緊摘要', '對緊摘要啱唔啱']
  ),
  'updates.phase.staging': ladder(
    [
      'Writing the package to the staging directory',
      'Writing the package aside',
      'Parking the package in the staging directory'
    ],
    ['寫緊安裝包入暫存資料夾', '寫緊安裝包入暫存資料夾', '將個安裝包寫入暫存資料夾，擺定佢']
  ),
  'updates.phase.ready': ladder(
    ['An update is staged and ready to install', 'An update is staged and ready', 'Staged, verified, and waiting on you'],
    ['更新已經擺定，隨時可以裝', '更新已經擺定，隨時可以裝', '擺定咗、核對咗，就等你出聲']
  ),
  'updates.phase.installing': ladder(
    ['Handing the package to the platform updater', 'Handing the package over to install', 'Handing it over — the installer takes it from here'],
    ['交緊個安裝包畀系統更新程式', '交緊個安裝包去安裝', '交咗畀安裝程式，跟住就佢話事']
  ),
  'updates.phase.failed': ladder(
    ['The last attempt failed', 'The last attempt failed', 'The last attempt did not get there'],
    ['上次試唔成功', '上次試唔成功', '上次試極都去唔到']
  ),

  /* ---------------------------------------------------------------- */
  /* Fields                                                            */
  /* ---------------------------------------------------------------- */

  'updates.field.currentVersion': flat('Installed version', '已安裝版本'),
  'updates.field.candidateVersion': flat('Offered version', '來源提供嘅版本'),
  'updates.field.lastChecked': flat('Last checked', '上次檢查'),
  'updates.field.nextCheck': flat('Next scheduled check', '下次排定檢查'),
  'updates.field.feed': flat('Release feed', '發佈來源'),
  'updates.field.packageFile': flat('Package file', '安裝包檔案'),
  'updates.field.digest': flat('SHA-1 digest stated by the feed', '來源列明嘅 SHA-1 摘要'),
  'updates.field.size': flat('Package size', '安裝包大細'),
  'updates.field.stagedAt': flat('Staged at', '擺定時間'),
  'updates.field.stagedPath': flat('Staged payload path', '擺定檔案路徑'),
  'updates.field.progress': flat('Transferred', '已傳送'),
  'updates.field.rate': flat('Transfer rate', '傳送速度'),
  'updates.field.installBridge': flat('Installer handover', '安裝交接'),
  'updates.value.never': flat('Never', '從未'),
  'updates.value.none': flat('None', '無'),
  'updates.value.notScheduled': flat('Not scheduled', '未排定'),
  'updates.value.installReady': flat('Available in this build', '呢個版本有'),
  'updates.value.installMissing': flat(
    'Not available in this build — the package can be installed by hand',
    '呢個版本冇 —— 個安裝包可以自己手動裝'
  ),
  'updates.value.rangeYes': flat('Byte ranges honoured; progress below is exact', '伺服器支援分段下載，下面嘅進度係實數'),
  'updates.value.rangeNo': flat(
    'The server sent the whole package in one response, so there was no intermediate progress to report',
    '伺服器一次過送晒成個包落嚟，所以中途冇進度可以報'
  ),

  /* ---------------------------------------------------------------- */
  /* Actions                                                           */
  /* ---------------------------------------------------------------- */

  'updates.action.check': ladder(
    ['Check for updates', 'Check for updates', 'Go and look for an update'],
    ['檢查更新', '檢查更新', '去睇下有冇更新']
  ),
  'updates.action.download': ladder(
    ['Download and verify', 'Download and verify', 'Pull it down and check the digest'],
    ['下載並核對', '下載並核對', '扯落嚟再對下摘要']
  ),
  'updates.action.cancel': flat('Cancel the transfer', '取消傳送'),
  'updates.action.restart': ladder(
    ['Restart to install update', 'Restart to install update', 'Restart and let it install'],
    ['重新開機安裝更新', '重新開機安裝更新', '重新開機，畀佢裝']
  ),
  'updates.action.later': flat('Later', '遲啲先'),
  'updates.action.releaseNotes': flat('Open the release notes', '開發佈說明'),
  'updates.action.showStaged': flat('Show the staged package', '顯示擺定嘅安裝包'),
  'updates.action.discard': ladder(
    ['Discard the staged update', 'Discard the staged update', 'Throw the staged update away'],
    ['棄用擺定嘅更新', '棄用擺定嘅更新', '掉咗擺定嗰份更新']
  ),
  'updates.action.export': flat('Export the check log', '匯出檢查紀錄'),
  'updates.action.retry': flat('Try again', '再試一次'),
  'updates.action.openSettings': flat('Open the update settings', '開更新設定'),
  'updates.action.deleteSelected': flat('Delete the selected rows', '刪除已選嘅行'),

  /* ---------------------------------------------------------------- */
  /* Disabled reasons — each names the exact unmet condition           */
  /* ---------------------------------------------------------------- */

  'updates.disabled.noCandidate': flat(
    'Nothing has been offered by the feed yet. Check for updates first.',
    '發佈來源仲未提供過任何嘢。要先檢查更新。'
  ),
  'updates.disabled.busy': flat(
    'A check or transfer is already running. Wait for it, or cancel it.',
    '而家有檢查或者傳送做緊。等佢完，或者取消佢。'
  ),
  'updates.disabled.notStaged': flat(
    'No verified package is staged yet, so there is nothing to install.',
    '仲未擺定任何核對過嘅安裝包，所以冇嘢可以裝。'
  ),
  'updates.disabled.noInstallBridge': flat(
    'This build has no privileged installer handover, so the application cannot install the staged package itself. The package is staged and can be installed by hand.',
    '呢個版本冇特權安裝交接，所以程式自己裝唔到擺定咗嗰個包。個包已經擺定，可以自己手動裝。'
  ),
  'updates.disabled.nothingSelected': flat('No rows are selected.', '未揀到任何一行。'),
  'updates.disabled.emptyLog': flat('The check log has no entries yet.', '檢查紀錄仲係空嘅。'),
  'updates.disabled.noTransfer': flat('No transfer is running.', '而家冇傳送做緊。'),
  'updates.disabled.noNotes': flat('No release notes address is configured.', '未設定發佈說明網址。'),

  /* ---------------------------------------------------------------- */
  /* The ready banner                                                  */
  /* ---------------------------------------------------------------- */

  'updates.banner.label': flat('Update ready to install', '更新已準備好安裝'),
  'updates.banner.title': ladder(
    ['Version {version} is ready to install', 'Version {version} is ready to install', 'Version {version} is downloaded, checked and waiting'],
    ['版本 {version} 已經可以裝', '版本 {version} 已經可以裝', '版本 {version} 下載好、對完數，喺度等緊']
  ),
  'updates.banner.body': ladder(
    [
      'It was downloaded and its SHA-1 matched the release feed. The application is unsigned, so Windows will warn about an unknown publisher. Restarting installs it; nothing installs until you choose to.',
      'It came down and its SHA-1 matched the release feed. The application is unsigned, so Windows will warn about an unknown publisher. Restarting installs it; nothing happens until you choose.',
      'Down it came, and its SHA-1 matched the feed exactly. It is unsigned, so Windows will grumble about an unknown publisher. Restart when you like — it sits there quietly until then.'
    ],
    [
      '已經下載好，SHA-1 同發佈來源一樣。程式冇簽署，所以 Windows 會話發行者不明。重新開機就會裝；你唔揀就唔會郁。',
      '扯咗落嚟，SHA-1 同發佈來源啱晒。程式冇簽署，Windows 會話發行者不明。重新開機先會裝，你唔出聲就唔會郁。',
      '扯咗落嚟，SHA-1 對得一模一樣。冇簽署，所以 Windows 會嘈發行者不明。你幾時想重新開機就幾時，佢會乖乖坐喺度等。'
    ]
  ),
  'updates.banner.dismiss': flat('Hide this banner for now', '暫時收埋呢條橫額'),

  /* ---------------------------------------------------------------- */
  /* Notifications                                                     */
  /* ---------------------------------------------------------------- */

  'updates.notify.busy.title': flat('An update task is already running', '已經有更新工作做緊'),
  'updates.notify.busy.body': flat(
    'Wait for the current check or transfer to finish, or cancel it first.',
    '等而家嘅檢查或者傳送做完，又或者先取消佢。'
  ),
  'updates.notify.upToDate.title': ladder(
    ['No update available', 'No update available', 'Nothing new — you already have the newest'],
    ['冇更新', '冇更新', '冇新嘢，你已經係最新嗰個']
  ),
  'updates.notify.upToDate.body': flat(
    'This build is {version}, which is the newest the feed offers.',
    '呢個版本係 {version}，已經係發佈來源最新嗰個。'
  ),
  'updates.notify.available.title': flat('An update is available', '有更新'),
  'updates.notify.available.body': flat(
    'Version {version} is available. Downloading it is a separate step.',
    '版本 {version} 可以裝。下載係另一個步驟。'
  ),
  'updates.notify.nothingToDownload.title': flat('There is no update to download', '冇更新可以下載'),
  'updates.notify.nothingToDownload.body': flat(
    'Check for updates first; nothing has been offered by the feed yet.',
    '要先檢查更新，發佈來源仲未提供過任何嘢。'
  ),
  'updates.notify.staged.title': ladder(
    ['Update {version} is staged', 'Update {version} is staged and verified', 'Update {version} is down, checked and parked'],
    ['更新 {version} 已擺定', '更新 {version} 已擺定同核對好', '更新 {version} 扯咗落嚟、對完數、泊好']
  ),
  'updates.notify.staged.body': flat(
    'Its SHA-1 matched the release feed. It installs when you restart, and not before.',
    'SHA-1 同發佈來源一樣。你重新開機先會裝，之前唔會郁。'
  ),
  'updates.notify.failed.title': ladder(
    ['The update attempt failed', 'The update attempt failed', 'That update attempt did not make it'],
    ['更新失敗', '更新失敗', '今次更新去唔到']
  ),
  'updates.notify.cancelled.title': flat('The transfer was cancelled', '傳送已取消'),
  'updates.notify.cancelled.body': flat(
    'Nothing was written to disk. The staged update, if there was one, is untouched.',
    '冇寫任何嘢入硬碟。之前擺定嗰個更新（如果有）原封不動。'
  ),
  'updates.notify.discarded.title': flat('The staged update was discarded', '擺定嘅更新已棄用'),
  'updates.notify.discarded.body': flat(
    'The payload at {path} was truncated to zero bytes and can be deleted. Nothing was installed.',
    '{path} 嗰個檔案已經截到零位元組，可以自己刪。冇裝過任何嘢。'
  ),
  'updates.notify.installUnavailable.title': flat('This build cannot install the update itself', '呢個版本自己裝唔到更新'),
  'updates.notify.installUnavailable.body': flat(
    'The verified package is staged at {path}. It has to be installed by hand until a privileged installer handover is present.',
    '核對過嘅安裝包擺咗喺 {path}。喺有特權安裝交接之前，要自己手動裝。'
  ),
  'updates.notify.unsaved.title': flat('Unsaved work is open', '有未儲存嘅嘢開住'),
  'updates.notify.exported.title': flat('The check log was exported', '檢查紀錄已匯出'),
  'updates.notify.logCleared.title': flat('{count} log entries were removed', '刪咗 {count} 條紀錄'),
  'updates.notify.openFailed.title': flat('That address could not be opened', '開唔到嗰個網址'),

  /* ---------------------------------------------------------------- */
  /* Failure reasons                                                   */
  /* ---------------------------------------------------------------- */

  'updates.failure.notConfigured': flat(
    'No release feed address is configured, so there is nothing to check against.',
    '未設定發佈來源網址，所以冇嘢可以對。'
  ),
  'updates.failure.offline': flat(
    'This computer reports that it is offline, so the feed was not contacted.',
    '部電腦話自己冇網絡，所以冇去搵過發佈來源。'
  ),
  'updates.failure.feedUnreachable': flat(
    'The release feed could not be read.',
    '讀唔到發佈來源。'
  ),
  'updates.failure.feedInvalid': flat(
    'The release feed was read but is not a usable RELEASES document.',
    '讀到發佈來源，但係佢唔係一份用得嘅 RELEASES 檔。'
  ),
  'updates.failure.downgradeBlocked': flat(
    'The feed offers an older build than the one installed, and rollback protection refused it.',
    '發佈來源提供嘅版本比已裝嗰個舊，回滾保護唔畀。'
  ),
  'updates.failure.tooLarge': flat(
    'The package is larger than the staging ceiling in the settings.',
    '安裝包大過設定入面嘅暫存上限。'
  ),
  'updates.failure.transferFailed': flat('The transfer did not complete.', '傳送冇完成。'),
  'updates.failure.sizeMismatch': flat(
    'The number of bytes that arrived is not the number the feed stated.',
    '收到嘅位元組數同發佈來源寫嗰個唔夾。'
  ),
  'updates.failure.hashMismatch': flat(
    'The transferred bytes do not hash to the digest the feed stated. Nothing was written to disk.',
    '傳送到嘅位元組計出嚟嘅摘要，同發佈來源寫嗰個唔同。冇寫任何嘢入硬碟。'
  ),
  'updates.failure.writeFailed': flat('The staging directory could not be written.', '寫唔到入暫存資料夾。'),
  'updates.failure.assetCorrupt': flat(
    'The staged file did not read back as what was written, so it is not usable.',
    '擺定咗嘅檔案讀返出嚟同寫入去嗰陣唔同，用唔到。'
  ),
  'updates.failure.cancelled': flat('You cancelled the transfer.', '你取消咗傳送。'),
  'updates.failure.installUnavailable': flat(
    'This build has no privileged installer handover, so it cannot install the staged package itself.',
    '呢個版本冇特權安裝交接，所以自己裝唔到擺定嗰個包。'
  ),
  'updates.failure.installFailed': flat('The installer handover reported a failure.', '安裝交接報告失敗。'),
  'updates.failure.detail': flat('Reported detail: {detail}', '報告詳情：{detail}'),

  /* ---------------------------------------------------------------- */
  /* Check log                                                         */
  /* ---------------------------------------------------------------- */

  'updates.log.search': ladder(
    ['Search the check log', 'Search the check log', 'Type here and watch the log thin out'],
    ['搵檢查紀錄', '搵檢查紀錄', '打字，睇住啲紀錄少埋']
  ),
  'updates.log.column.at': flat('When', '幾時'),
  'updates.log.column.trigger': flat('Started by', '由邊個開始'),
  'updates.log.column.outcome': flat('Outcome', '結果'),
  'updates.log.column.version': flat('Version', '版本'),
  'updates.log.column.duration': flat('Took', '用咗'),
  'updates.log.column.detail': flat('Detail', '詳情'),
  'updates.log.empty.title': ladder(
    ['No checks have been recorded yet', 'No checks have been recorded yet', 'Nothing in the log yet'],
    ['仲未記錄過任何檢查', '仲未記錄過任何檢查', '紀錄度仲係空空如也']
  ),
  'updates.log.empty.body': flat(
    'Every check writes one row here, whether it found an update or not. Run a check to start the log.',
    '每次檢查都會喺呢度寫一行，搵唔搵到更新都會寫。行一次檢查就有嘢睇。'
  ),
  'updates.log.noMatches': flat(
    'No log rows match the current search.',
    '冇紀錄啱而家嘅搜尋。'
  ),
  'updates.log.trigger.startup': flat('Startup', '開機'),
  'updates.log.trigger.schedule': flat('Schedule', '排程'),
  'updates.log.trigger.manual': flat('You', '你'),
  'updates.log.trigger.retry': flat('Retry', '重試'),
  'updates.log.outcome.upToDate': flat('Up to date', '已最新'),
  'updates.log.outcome.available': flat('Update available', '有更新'),
  'updates.log.outcome.staged': flat('Staged', '已擺定'),
  'updates.log.outcome.failed': flat('Failed', '失敗'),
  'updates.log.outcome.cancelled': flat('Cancelled', '已取消'),
  'updates.log.outcome.skipped': flat('Skipped', '略過'),
  'updates.log.selectShown': flat('Select the {count} rows on this page', '揀呢頁嘅 {count} 行'),
  'updates.log.selectMatching': flat('Select all {count} rows matching the search', '揀晒啱搜尋嘅 {count} 行'),
  'updates.log.invert': flat('Invert the selection', '反轉選取'),
  'updates.log.clearSelection': flat('Clear the selection', '清除選取'),
  'updates.log.selection': flat('{selected} of {total} rows selected', '已揀 {selected} 行，總共 {total} 行'),
  'updates.log.page': flat('Page {page} of {pages}, showing {shown} of {total} rows', '第 {page} 頁，共 {pages} 頁；顯示 {shown} 行，總共 {total} 行'),
  'updates.log.previousPage': flat('Previous page', '上一頁'),
  'updates.log.nextPage': flat('Next page', '下一頁'),
  'updates.log.exportFormat': flat('Export format', '匯出格式'),
  'updates.log.exportLosses': flat(
    'The {format} format cannot carry {fields} faithfully.',
    '{format} 格式載唔到 {fields}。'
  ),

  /* ---------------------------------------------------------------- */
  /* Confirmation copy                                                 */
  /* ---------------------------------------------------------------- */

  'updates.confirm.discard.action': flat('Discard the staged update {version}', '棄用擺定咗嘅更新 {version}'),
  'updates.confirm.discard.irreversible': flat(
    'The downloaded package at {path} is truncated to zero bytes and has to be downloaded again to be installed. The application itself is not touched.',
    '{path} 嗰個下載咗嘅安裝包會截到零位元組，要重新下載先裝得。應用程式本身唔會受影響。'
  ),
  'updates.confirm.deleteLog.action': flat('Delete {count} check log entries', '刪除 {count} 條檢查紀錄'),
  'updates.confirm.deleteLog.irreversible': flat(
    'The rows are removed from the stored log. The removal is recorded in local history, but the rows themselves are not recoverable from it.',
    '啲行會由儲低嘅紀錄度移除。移除呢個動作會記入本機歷史，但係啲行本身喺度攞唔返。'
  ),
  'updates.confirm.restart.title': ladder(
    ['Restart now and install version {version}?', 'Restart now and install version {version}?', 'Restart now and let version {version} in?'],
    ['而家重新開機，裝版本 {version}？', '而家重新開機，裝版本 {version}？', '而家重新開機，畀版本 {version} 入嚟？']
  ),
  'updates.confirm.restart.body': flat(
    'The application closes and the platform updater installs version {version}. The installer is unsigned, so Windows will show an unknown-publisher warning.',
    '應用程式會閂咗，然後系統更新程式會裝版本 {version}。安裝檔冇簽署，所以 Windows 會彈「發行者不明」嘅警告。'
  ),
  'updates.confirm.restart.unsaved': flat(
    'These surfaces say they hold unsaved work and it will be lost: {items}',
    '以下呢啲地方話自己有未儲存嘅嘢，重新開機就會冇咗：{items}'
  ),
  'updates.confirm.restart.confirm': flat('Restart and install', '重新開機並安裝'),
  'updates.confirm.restart.cancel': flat('Stay open', '繼續留喺度'),

  /* ---------------------------------------------------------------- */
  /* Settings                                                          */
  /* ---------------------------------------------------------------- */

  'updates.settings.title': ladder(
    ['Updates', 'Application updates', 'Updates — how eager should it be?'],
    ['更新', '應用程式更新', '更新 —— 你想佢幾勤力？']
  ),

  'updates.setting.enabled': flat('Check for updates automatically', '自動檢查更新'),
  'updates.setting.enabled.description': ladder(
    [
      'Reads the release feed on a schedule and, when a newer package exists, downloads and verifies it in the background. Nothing installs without an explicit restart. Off means no feed is contacted at all, and the manual check still works.',
      'Reads the release feed on a schedule and quietly fetches a newer package when there is one. Nothing installs without an explicit restart. Off means the feed is never contacted, and you can still check by hand.',
      'Keeps an eye on the release feed and quietly fetches anything newer. Nothing installs behind your back — a restart is always yours to choose. Off means it never phones anywhere, and the manual check still works.'
    ],
    [
      '按排程讀發佈來源；有新版就喺背景下載同核對。冇你重新開機就唔會裝。閂咗即係完全唔會聯絡發佈來源，但手動檢查照用得。',
      '按排程讀發佈來源，有新版就靜靜雞攞落嚟。冇你重新開機就唔會裝。閂咗即係完全唔會出去攞嘢，手動檢查照用得。',
      '幫你睇實發佈來源，有新嘢就靜靜雞扯落嚟。唔會偷偷哋裝，重新開機永遠你話事。閂咗就乜都唔會撥出去，手動檢查照樣得。'
    ]
  ),

  'updates.setting.feedUrl': flat('Release feed address', '發佈來源網址'),
  'updates.setting.feedUrl.description': ladder(
    [
      'The RELEASES document listing every published package with its SHA-1 digest and size. It must be an https address, or an http address on a loopback host for local testing.',
      'The RELEASES document listing every published package with its digest and size. It has to be https, or http on a loopback host if you are testing locally.',
      'The RELEASES list of every published package, with the digest and size of each. https only, unless you are pointing it at your own machine.'
    ],
    [
      'RELEASES 檔，列晒每個已發佈嘅安裝包同佢嘅 SHA-1 摘要同大細。要係 https 網址，或者本機回送位址嘅 http 用嚟測試。',
      'RELEASES 檔，列晒每個已發佈嘅包同佢嘅摘要同大細。要 https，除非你係喺本機回送位址度測試。',
      '就係 RELEASES 嗰張單，寫晒每個包同佢嘅摘要同大細。要 https，除非你指住自己部機測試。'
    ]
  ),

  'updates.setting.releaseNotesUrl': flat('Release notes address', '發佈說明網址'),
  'updates.setting.releaseNotesUrl.description': flat(
    'The page the banner and the status card link to. It is opened in your browser, never inside the application, and nothing is fetched from it.',
    '橫額同狀態卡連去嗰版。佢會喺你嘅瀏覽器度開，唔會喺應用程式入面開，亦都唔會攞佢任何嘢。'
  ),

  'updates.setting.checkOnStartup': flat('Check once shortly after startup', '開機後不久檢查一次'),
  'updates.setting.checkOnStartup.description': flat(
    'Runs one check a short while after the window opens, deliberately after startup rather than during it, so the application is usable first.',
    '開窗之後一陣先行一次檢查，特登擺喺開機之後而唔係開機途中，等你可以即刻用到個程式。'
  ),

  'updates.setting.startupDelay': flat('Wait before the startup check', '開機檢查前等幾耐'),
  'updates.setting.startupDelay.description': flat(
    'Seconds between the window opening and the startup check. A longer wait keeps the first moments of a launch entirely free.',
    '由開窗到行開機檢查之間隔幾多秒。等耐啲，開機頭嗰陣就完全冇嘢阻住。'
  ),

  'updates.setting.intervalHours': flat('Hours between background checks', '背景檢查之間隔幾多個鐘'),
  'updates.setting.intervalHours.description': flat(
    'How often the feed is read while the application is open. Each check is one small text request; the package is only fetched when a newer version exists.',
    '程式開住嗰陣幾耐讀一次發佈來源。每次檢查淨係一個細細嘅文字請求；有新版本先至會扯個包落嚟。'
  ),

  'updates.setting.autoDownload': flat('Download an update as soon as one is found', '搵到更新即刻下載'),
  'updates.setting.autoDownload.description': ladder(
    [
      'Transfers and verifies the package in the background as soon as a check finds one, so the restart is instant when you choose it. Off stops at "an update is available" and waits for you to start the transfer.',
      'Fetches and checks the package in the background the moment one is found, so restarting is instant. Off stops at "an update is available" and waits for you.',
      'Grabs the package the moment it appears, so the restart is instant later. Off just tells you one exists and lets you decide when to spend the bandwidth.'
    ],
    [
      '一檢查到就喺背景下載同核對，等你揀重新開機嗰陣即刻搞掂。閂咗就停喺「有更新」嗰步，等你自己開始下載。',
      '一搵到就喺背景攞落嚟同對數，重新開機即刻得。閂咗就停喺「有更新」，等你話事。',
      '一有新嘢即刻扯落嚟，遲啲重新開機就快夾順。閂咗就淨係話你知有，幾時用頻寬你話事。'
    ]
  ),

  'updates.setting.acceptPrerelease': flat('Accept prerelease versions', '接受預發佈版本'),
  'updates.setting.acceptPrerelease.description': flat(
    'Treats a version with a prerelease tail, such as 1.2.0-beta.1, as installable. With this off, such a package is reported as present but not chosen, rather than being hidden.',
    '將帶預發佈尾綴嘅版本（例如 1.2.0-beta.1）當成可以裝。閂咗嘅話，呢類包會照樣講畀你知存在，只係唔會揀佢，唔會靜靜雞收埋。'
  ),

  'updates.setting.allowDowngrade': flat('Allow installing an older version', '容許裝返舊版本'),
  'updates.setting.allowDowngrade.description': ladder(
    [
      'Rollback protection. With this off, a feed offering an older build than the one installed is refused and the refusal is reported. Turn it on only when you deliberately want to go back.',
      'Rollback protection. Off means a feed offering an older build is refused, and you are told it was. Turn it on only when going back is what you actually want.',
      'Rollback protection. Off means an older build gets shown the door, loudly. Turn it on only if going backwards is genuinely the plan.'
    ],
    [
      '回滾保護。閂咗嘅話，發佈來源提供比已裝更舊嘅版本會被拒絕，而且會報你知。真係想返舊版先開。',
      '回滾保護。閂咗即係舊版會被拒，仲會話你知。真係想倒返轉先開。',
      '回滾保護。閂咗即係舊版一嚟就請走，仲要大聲講。真係想行返轉頭先開。'
    ]
  ),

  'updates.setting.maxPackageBytes': flat('Largest package to stage', '最大可擺定嘅安裝包'),
  'updates.setting.maxPackageBytes.description': flat(
    'A package larger than this is refused before any bytes are transferred, and the refusal names both numbers. The staged payload is held in memory while it is hashed, so this ceiling bounds that too.',
    '大過呢個數嘅包會喺傳送任何位元組之前拒絕，而且會講埋兩個數字。計摘要嗰陣份資料會擺喺記憶體，所以呢個上限一樣限住嗰度。'
  ),

  'updates.setting.chunkBytes': flat('Transfer chunk size', '每段傳送大細'),
  'updates.setting.chunkBytes.description': flat(
    'The package is fetched in byte ranges of this size. Smaller chunks give finer progress and a more responsive cancel; larger chunks make fewer requests. A server that ignores byte ranges sends the whole package at once and the surface says so.',
    '個包會用呢個大細嘅位元組分段攞。段細啲，進度細緻啲、取消快啲；段大啲，請求少啲。伺服器唔支援分段嘅話會一次過送晒，畫面會照講。'
  ),

  'updates.setting.verifyAfterWrite': flat('Re-read and re-hash the staged file', '寫完再讀返同再計摘要'),
  'updates.setting.verifyAfterWrite.description': flat(
    'After writing, the staged file is read back and hashed again. It costs time on a large package and it is the only thing that catches a file that was written wrongly or damaged on disk.',
    '寫完之後會讀返個檔再計多次摘要。大包會慢啲，但係唯獨呢步先捉到寫錯咗或者喺硬碟度爛咗嘅檔。'
  ),

  'updates.setting.snoozeHours': flat('Hours the ready banner stays hidden', '準備好嘅橫額收埋幾多個鐘'),
  'updates.setting.snoozeHours.description': flat(
    'How long "Later" keeps the ready banner out of the way. The staged update is untouched; only the banner is hidden, and it returns afterwards.',
    '撳「遲啲先」之後，準備好嘅橫額會收埋幾耐。擺定咗嘅更新一啲都唔會郁，淨係橫額收起，之後會返嚟。'
  ),

  'updates.setting.logPageSize': flat('Check log rows per page', '檢查紀錄每頁行數'),
  'updates.setting.logPageSize.description': flat(
    'How many log rows one page shows. It is also what "select the rows on this page" means, which is why the two selection actions say different numbers.',
    '一頁顯示幾多行紀錄。「揀呢頁嘅行」都係跟呢個數，所以兩個選取動作講嘅數字唔同。'
  ),

  'updates.setting.checkNow': flat('Check for updates now', '而家檢查更新'),
  'updates.setting.checkNow.description': flat(
    'Runs one check immediately, whatever the schedule is doing, and reports the result as a notification.',
    '無論排程做緊乜，即刻行一次檢查，跟住用通知報你知結果。'
  ),

  'updates.setting.status': flat('Update state', '更新狀態'),
  'updates.setting.status.description': flat(
    'The live state of the updater: the installed version, what the feed last offered, when it was last checked, and whether a verified package is staged.',
    '更新器嘅即時狀態：已裝版本、發佈來源上次提供咩、上次幾時查、有冇擺定咗一個核對過嘅包。'
  ),

  /* ---------------------------------------------------------------- */
  /* Palette                                                           */
  /* ---------------------------------------------------------------- */

  'updates.palette.open': flat('Updates: open the updates destination', '更新：開更新頁'),
  'updates.palette.check': flat('Updates: check for updates now', '更新：而家檢查更新'),
  'updates.palette.download': flat('Updates: download and verify the offered package', '更新：下載同核對提供嘅安裝包'),
  'updates.palette.restart': flat('Updates: restart to install the staged update', '更新：重新開機安裝擺定嘅更新'),
  'updates.palette.discard': flat('Updates: discard the staged update', '更新：棄用擺定嘅更新'),
  'updates.palette.notes': flat('Updates: open the release notes', '更新：開發佈說明'),
  'updates.palette.docs': flat('Updates: read how updating works', '更新：睇下更新點運作')
};
