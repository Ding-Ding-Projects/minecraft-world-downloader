import type { Catalogue, FunnyLadder, TranslationEntry } from '../../core/registry';

/**
 * Every piece of copy this feature renders, in English and in playful Hong Kong
 * Cantonese, at all five humour levels.
 *
 * The rule the ladders keep, same as every other feature: humour styles the
 * VOICE and never the FACTS. A destructive line at level 5 still names the
 * exact container, the exact grace period and exactly what is kept and what is
 * lost; a level-1 line says the same thing with a straight face. Anything a
 * reader has to act on — a count, a name, a port, an error string — is either
 * interpolated or identical across every rung.
 *
 * Strings that are almost entirely a `{value}` (a raw error, a command line, a
 * count) use a shorter ladder: the `ladder()` helper below fills every rung
 * with the same text when only one or two are given, exactly as the finished
 * `history` feature does for its own technical messages.
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

export const SERVER_STRINGS: Catalogue = {
  /* ================================================================ */
  /* Tabs and top bars                                                  */
  /* ================================================================ */

  'server.tab.containers': entry(
    ladder('Containers', 'Containers', 'Containers', 'The containers', 'The containers, all lined up'),
    ladder('容器', '容器', '啲容器', '成班容器', '成班容器，排晒隊')
  ),
  'server.tab.containers.subtitle': entry(
    ladder(
      'Every container Docker knows about on this machine, with start, stop, restart and remove.',
      'Every container Docker knows about on this machine, with start, stop, restart and remove.',
      'Every container Docker knows about here, and the controls to start, stop, restart or remove one.',
      'Every container Docker will admit to running on this machine, plus the levers to start, stop, restart or bin one.',
      'Every container Docker will admit to running on this machine, plus the levers to start, stop, restart or bin one.'
    ),
    ladder(
      '呢部機入面 Docker 知道嘅所有容器，可以開、停、重啟同刪除。',
      '呢部機入面 Docker 知道嘅所有容器，可以開、停、重啟同刪除。',
      '呢部機所有 Docker 知道嘅容器，仲有開停重啟刪除嘅掣。',
      '呢部機 Docker 肯認嘅所有容器，仲有開佢停佢重啟佢掉佢嘅掣。',
      '呢部機 Docker 肯認嘅所有容器，仲有開佢停佢重啟佢掉佢嘅掣。'
    )
  ),
  'server.tab.logs': entry(
    ladder('Container logs', 'Container logs', 'Container logs', 'The container logs', 'What the container has been muttering'),
    ladder('容器日誌', '容器日誌', '容器嘅日誌', '容器嘅日誌', '睇下個容器一路噏緊乜')
  ),
  'server.tab.logs.subtitle': entry(
    ladder(
      'Read a snapshot or follow one container live.',
      'Read a snapshot or follow one container live.',
      'Read a snapshot of one container, or follow it live as it prints.',
      'Grab a snapshot of one container, or sit and watch it live as it types.',
      'Grab a snapshot of one container, or sit and watch it live as it types.'
    ),
    ladder(
      '讀一個快照，或者即時跟住一個容器。',
      '讀一個快照，或者即時跟住一個容器。',
      '睇一個容器嘅快照，或者即時跟實佢打緊乜。',
      '影一張容器嘅快照，或者坐低即時睇住佢打字。',
      '影一張容器嘅快照，或者坐低即時睇住佢打字。'
    )
  ),

  /* ================================================================ */
  /* Daemon banner                                                      */
  /* ================================================================ */

  'server.daemon.label': entry(ladder('Docker availability'), ladder('Docker 可用狀態')),
  'server.daemon.checking': entry(
    ladder('Asking Docker whether it is there', 'Asking Docker whether it is there', 'Checking whether Docker is here', 'Knocking on Docker’s door to see if anyone’s home', 'Knocking on Docker’s door to see if anyone’s home'),
    ladder('問緊 Docker 喺唔喺度', '問緊 Docker 喺唔喺度', '睇下 Docker 喺唔喺度', '拍緊 Docker 度門睇下有冇人應', '拍緊 Docker 度門睇下有冇人應')
  ),
  'server.daemon.checking.body': entry(
    ladder(
      'Running "docker version" to find out whether the command line exists on this computer and whether a daemon answers it.'
    ),
    ladder('行緊 "docker version"，睇下呢部機有冇裝命令列，同埋有冇個 daemon 應緊佢。')
  ),
  'server.daemon.ready': entry(
    ladder('Docker is answering', 'Docker is answering', 'Docker answered', 'Docker picked up the phone', 'Docker picked up the phone, all chipper'),
    ladder('Docker 有應', 'Docker 有應', 'Docker 應咗喇', 'Docker 聽咗電話', 'Docker 聽咗電話，仲幾精神')
  ),
  'server.daemon.ready.body': entry(
    ladder('Command line {client}, daemon {server} on {os}. Checked at {time}.'),
    ladder('命令列 {client}，daemon {server}，喺 {os} 上面。喺 {time} 檢查過。')
  ),
  'server.list.listedAt': entry(
    ladder('Container list last read at {time}.'),
    ladder('容器清單最後喺 {time} 讀過。')
  ),
  'server.list.unreadable': entry(
    ladder('{count} lines of the listing could not be read as container records and were left out.'),
    ladder('清單入面有 {count} 行讀唔到做容器紀錄，已經剔走。')
  ),
  'server.daemon.missing': entry(
    ladder(
      'Docker is not installed on this computer',
      'Docker is not installed on this computer',
      'Docker is not installed here',
      'There is no Docker on this machine at all',
      'There is no Docker on this machine at all — none, zero, zilch'
    ),
    ladder(
      '呢部機冇裝 Docker',
      '呢部機冇裝 Docker',
      '呢部機根本冇裝 Docker',
      '呢部機完全冇 Docker，一啲都冇',
      '呢部機完全冇 Docker，一啲都冇，零'
    )
  ),
  'server.daemon.missing.body': entry(
    ladder('The "docker" command could not be run at all. Docker reported: {detail}'),
    ladder('"docker" 呢個指令完全行唔到。Docker 話：{detail}')
  ),
  'server.daemon.missing.help': entry(
    ladder(
      'This is a different problem from a stopped daemon: there is nothing installed to start. The button opens the official installation page in your browser; it is the only request this feature ever makes to the internet, and only when you press it.'
    ),
    ladder(
      '呢個同「daemon 停咗」係唔同嘅問題：根本冇嘢裝過，冇得開。撳個掣會喺瀏覽器開官方安裝頁；呢個功能一世人淨係會做呢一個上網請求，仲要係你撳咗先會發生。'
    )
  ),
  'server.daemon.refused': entry(
    ladder('Docker answered with a refusal', 'Docker answered with a refusal', 'Docker answered, but said no', 'Docker picked up and slammed the phone down', 'Docker picked up, said "not today", and slammed the phone down'),
    ladder('Docker 應咗，但係拒絕咗', 'Docker 應咗，但係拒絕咗', 'Docker 應咗但係話唔得', 'Docker 聽咗電話即刻㨂低', 'Docker 聽咗電話，話「今日唔得」，即刻㨂低')
  ),
  'server.daemon.refused.body': entry(ladder('Docker reported: {detail}'), ladder('Docker 話：{detail}')),
  'server.daemon.refused.help': entry(
    ladder(
      'The command line exists and the daemon rejected the request rather than failing to answer. On Linux this is usually group membership; on Windows it is usually a container engine that is still starting.'
    ),
    ladder(
      '命令列本身冇問題，係個 daemon 拒絕咗個請求，唔係應唔到。喺 Linux 通常係用戶群組問題；喺 Windows 通常係個容器引擎仲未開好。'
    )
  ),
  'server.daemon.unreachable': entry(
    ladder(
      'Docker is installed and nothing is answering it',
      'Docker is installed and nothing is answering it',
      'Docker is installed, but nothing is answering',
      'Docker is here, but the daemon has gone quiet',
      'Docker is here, sitting on the shelf, while the daemon has gone very quiet'
    ),
    ladder(
      'Docker 裝咗，但係冇嘢應緊佢',
      'Docker 裝咗，但係冇嘢應緊佢',
      'Docker 裝咗，但係完全冇回應',
      'Docker 喺度，不過個 daemon 靜晒',
      'Docker 就喺度企定定，但個 daemon 靜到出奇'
    )
  ),
  'server.daemon.unreachable.body': entry(
    ladder(
      'The "docker" command ran, so it is installed; the daemon it talks to did not reply. Docker reported: {detail}'
    ),
    ladder('"docker" 呢個指令行到，即係裝咗；不過佢傾偈嗰個 daemon 冇回。Docker 話：{detail}')
  ),
  'server.daemon.unreachable.desktop': entry(
    ladder('Docker Desktop is installed at {path}, so it can be started from here.'),
    ladder('Docker Desktop 裝咗喺 {path}，所以可以喺呢度開返佢。')
  ),
  'server.daemon.unreachable.noDesktop': entry(
    ladder(
      'No Docker Desktop was found in the usual place on this platform, so there is nothing here to press to start it. Start the Docker service the way it was installed, then check again.'
    ),
    ladder(
      '喺呢個平台平時嘅位置搵唔到 Docker Desktop，所以呢度冇掣俾你撳嚟開佢。用你裝 Docker 嗰陣嘅方法開返個服務，再檢查多次。'
    )
  ),
  'server.desktop.opened': entry(
    ladder(
      'Docker Desktop was opened from {path}. It takes a little while to start its daemon; this surface keeps checking.',
      'Docker Desktop was opened from {path}. It takes a little while to start its daemon; this surface keeps checking.',
      'Docker Desktop was opened from {path}. Its daemon takes a moment to come up, and this surface keeps checking on its own.',
      'Docker Desktop just launched from {path}. Give its daemon a moment to stretch and wake up; this surface keeps peeking in for you.',
      'Docker Desktop just launched from {path}. Give its daemon a moment to stretch and wake up; this surface keeps peeking in for you.'
    ),
    ladder(
      'Docker Desktop 喺 {path} 開咗。佢個 daemon 要少少時間先起到身，呢度會自動繼續檢查。',
      'Docker Desktop 喺 {path} 開咗。佢個 daemon 要少少時間先起到身，呢度會自動繼續檢查。',
      'Docker Desktop 由 {path} 開咗。個 daemon 要陣間先起到身，呢度會自己繼續睇住。',
      'Docker Desktop 啱啱由 {path} 彈出嚟。俾佢個 daemon 伸下懶腰起身，呢度會自動幫你睇實佢。',
      'Docker Desktop 啱啱由 {path} 彈出嚟。俾佢個 daemon 伸下懶腰起身，呢度會自動幫你睇實佢。'
    )
  ),
  'server.desktop.failed': entry(
    ladder('It could not be opened: {reason}'),
    ladder('打唔開：{reason}')
  ),

  /* ================================================================ */
  /* Actions                                                            */
  /* ================================================================ */

  'server.action.refresh': entry(
    ladder('Refresh the container list', 'Refresh the container list', 'Refresh the list', 'Give the list a shake and see what falls out', 'Give the list a shake and see what falls out'),
    ladder('重新整理容器清單', '重新整理容器清單', '重新整理清單', '搖一搖個清單，睇下有咩跌出嚟', '搖一搖個清單，睇下有咩跌出嚟')
  ),
  'server.action.check': entry(
    ladder('Check Docker again', 'Check Docker again', 'Check again', 'Poke Docker and see if it flinches', 'Poke Docker and see if it flinches'),
    ladder('再檢查 Docker', '再檢查 Docker', '再檢查一次', '㧻一下 Docker，睇下佢有冇反應', '㧻一下 Docker，睇下佢有冇反應')
  ),
  'server.action.install': entry(
    ladder('Install Docker', 'Install Docker', 'Install Docker', 'Go and get Docker', 'Go and get Docker — it will not install itself'),
    ladder('安裝 Docker', '安裝 Docker', '安裝 Docker', '去攞返個 Docker', '去攞返個 Docker，佢唔會自己走嚟')
  ),
  'server.action.openDesktop': entry(
    ladder('Open Docker Desktop', 'Open Docker Desktop', 'Open Docker Desktop', 'Give Docker Desktop a nudge', 'Give Docker Desktop a nudge and see if it wakes up'),
    ladder('開 Docker Desktop', '開 Docker Desktop', '開 Docker Desktop', '㨂醒 Docker Desktop', '㨂醒 Docker Desktop，睇下佢起唔起到身')
  ),
  'server.action.busy': entry(
    ladder('An operation is already running against this container.'),
    ladder('呢個容器已經有嘢喺度做緊。')
  ),
  'server.action.start': entry(
    ladder('Start', 'Start', 'Start', 'Fire it up', 'Fire it up'),
    ladder('啟動', '啟動', '開機', '着火', '着火')
  ),
  'server.action.start.disabled': entry(
    ladder('This container is already running.'),
    ladder('呢個容器已經運行緊喇。')
  ),
  'server.action.stop': entry(
    ladder('Stop', 'Stop', 'Stop', 'Pull the plug (politely)', 'Pull the plug (politely, with a grace period)'),
    ladder('停止', '停止', '停機', '拔電源（斯文咁拔）', '拔電源（斯文咁拔，仲畀時間佢執嘢）')
  ),
  'server.action.stop.disabled': entry(
    ladder('This container is not running, so there is nothing to stop.'),
    ladder('呢個容器冇運行緊，冇嘢好停。')
  ),
  'server.action.restart': entry(
    ladder('Restart', 'Restart', 'Restart', 'Off and on again', 'Off and on again, the universal fix'),
    ladder('重新啟動', '重新啟動', '重啟', '熄咗再開', '熄咗再開，萬用維修法')
  ),
  'server.action.restartOne': entry(
    ladder('Restart {name}'),
    ladder('重新啟動 {name}')
  ),
  'server.action.remove': entry(
    ladder('Remove', 'Remove', 'Remove', 'Bin it', 'Bin it for good'),
    ladder('移除', '移除', '刪除', '掉咗佢', '永久掉咗佢')
  ),
  'server.action.selectMatching': entry(
    ladder('Select the {count} shown'),
    ladder('揀晒眼前 {count} 個')
  ),
  'server.action.selectAll': entry(
    ladder('Select all {count}, including hidden'),
    ladder('揀晒全部 {count} 個，包埋隱藏嗰啲')
  ),
  'server.action.invert': entry(
    ladder('Invert selection', 'Invert selection', 'Flip the selection', 'Flip the selection inside out', 'Flip the selection inside out'),
    ladder('反轉選擇', '反轉選擇', '揀返冇揀嘅', '將選擇裏面翻出嚟', '將選擇裏面翻出嚟')
  ),
  'server.action.clearSelection': entry(
    ladder('Clear selection', 'Clear selection', 'Clear the selection', 'Let go of everything', 'Let go of everything, gently'),
    ladder('清除選擇', '清除選擇', '清空選擇', '全部放手', '全部放手，輕輕咁')
  ),
  'server.action.export': entry(
    ladder('Export', 'Export', 'Export', 'Take a copy home', 'Take a copy home'),
    ladder('匯出', '匯出', '匯出', '攞份副本返屋企', '攞份副本返屴企')
  ),

  /* ================================================================ */
  /* Filters                                                            */
  /* ================================================================ */

  'server.filters.title': entry(
    ladder('Filters', 'Filters', 'Filters', 'Narrow it down', 'Narrow it down'),
    ladder('篩選', '篩選', '篩選', '收窄範圍', '收窄範圍')
  ),
  'server.filters.description': entry(
    ladder(
      'Search text, container state and Compose project. Every field here narrows what is shown; nothing here changes what Docker actually has.'
    ),
    ladder('搜尋文字、容器狀態同 Compose 專案。呢度嘅每個欄位淨係收窄顯示嘅範圍，唔會改動 Docker 實際有嘅嘢。')
  ),
  'server.filters.states': entry(ladder('Show these states'), ladder('顯示呢啲狀態')),
  'server.filters.showStopped': entry(
    ladder('Show stopped containers', 'Show stopped containers', 'Show stopped containers too', 'Let the stopped ones stay in the room', 'Let the stopped ones stay in the room'),
    ladder('顯示已停止嘅容器', '顯示已停止嘅容器', '連停咗嘅都顯示', '畀停咗嘅都留喺度', '畀停咗嘅都留喺度')
  ),
  'server.filters.reset': entry(
    ladder('Reset filters', 'Reset filters', 'Reset the filters', 'Wipe the slate clean', 'Wipe the slate clean'),
    ladder('重設篩選', '重設篩選', '重設篩選', '一鍵打回原形', '一鍵打回原形')
  ),
  'server.filters.project': entry(ladder('Compose project'), ladder('Compose 專案')),
  'server.filters.project.all': entry(
    ladder('Every container on this machine'),
    ladder('呢部機所有容器')
  ),
  'server.filters.project.disabled': entry(
    ladder('No container on this machine carries a Compose project label, so there is nothing to narrow to.'),
    ladder('呢部機冇容器帶有 Compose 專案標籤，所以冇嘢可以再篩。')
  ),
  'server.filters.summary': entry(
    ladder('{shown} of {total} shown'),
    ladder('顯示緊 {shown} / {total}')
  ),
  'server.search.label': entry(
    ladder('Search containers', 'Search containers', 'Search containers', 'Hunt for a container', 'Hunt for a container'),
    ladder('搜尋容器', '搜尋容器', '搵容器', '搵嗰個容器出嚟', '搵嗰個容器出嚟')
  ),
  'server.search.placeholder': entry(
    ladder('Name, image, status or Compose service'),
    ladder('名稱、image、狀態或 Compose 服務')
  ),
  'server.empty.filtered': entry(
    ladder('No container matches the current filter.'),
    ladder('冇容器合乎而家嘅篩選。')
  ),
  'server.empty.filtered.body': entry(
    ladder('{total} containers exist; the search text, the state chips and the project picker are hiding all of them.'),
    ladder('一共有 {total} 個容器；搜尋文字、狀態標籤同專案篩選將佢哋全部收埋咗。')
  ),
  'server.empty.title': entry(
    ladder('Docker listed no containers on this machine.'),
    ladder('Docker 話呢部機冇任何容器。')
  ),
  'server.empty.body': entry(
    ladder(
      'Nothing exists yet, running or stopped. This project\'s compose file defines {known}; bringing it up with "docker compose up -d" from the repository creates them, and they appear here on the next refresh.'
    ),
    ladder(
      '運行緊定停咗嘅都冇。呢個項目嘅 compose 檔案定義咗 {known}；喺 repository 用 "docker compose up -d" 開返佢，佢哋就會建立，落次重新整理就會見到。'
    )
  ),
  'server.empty.noDaemon': entry(
    ladder('No container list, because Docker is not answering'),
    ladder('冇容器清單，因為 Docker 冇回應')
  ),
  'server.empty.noDaemon.body': entry(
    ladder('The panel above says which of the two problems this is and how to get out of it.'),
    ladder('上面個面板會話你知係邊個問題，同埋點樣解決。')
  ),
  'server.list.error': entry(
    ladder('The container list could not be read'),
    ladder('讀唔到容器清單')
  ),

  /* ================================================================ */
  /* Statistics                                                         */
  /* ================================================================ */

  'server.stats.title': entry(ladder('Statistics'), ladder('統計')),
  'server.stats.description': entry(
    ladder('A read-only summary of every container Docker listed. This panel does not change anything.'),
    ladder('一份純顯示嘅摘要，涵蓋 Docker 列出嘅所有容器。呢個面板唔會改動任何嘢。')
  ),
  'server.stats.summary': entry(
    ladder('{running} running of {total}'),
    ladder('{running} / {total} 運行緊')
  ),
  'server.stats.total': entry(ladder('Containers on this machine'), ladder('呢部機嘅容器')),
  'server.stats.shown': entry(ladder('Shown by the current filter'), ladder('而家篩選顯示緊')),
  'server.stats.running': entry(ladder('Running'), ladder('運行緊')),
  'server.stats.stopped': entry(ladder('Exited or dead'), ladder('已退出或死咗')),
  'server.stats.healthy': entry(ladder('Reporting healthy'), ladder('報稱健康')),
  'server.stats.unhealthy': entry(ladder('Reporting unhealthy'), ladder('報稱唔健康')),
  'server.stats.published': entry(ladder('Published port bindings'), ladder('已公開嘅埠')),
  'server.stats.images': entry(ladder('Distinct images'), ladder('唔同嘅 image 數目')),
  'server.stats.projects': entry(ladder('Compose projects'), ladder('Compose 專案')),
  'server.stats.note': entry(
    ladder(
      'Every figure counts every container Docker listed, including the ones the filter is hiding, except the row marked as shown by the current filter.'
    ),
    ladder('每個數字都計晒 Docker 列出嘅所有容器，包括篩選收埋嗰啲，淨係「而家篩選顯示緊」嗰行例外。')
  ),

  /* ================================================================ */
  /* Selection and bulk (containers)                                    */
  /* ================================================================ */

  'server.selection.none': entry(ladder('No container selected'), ladder('未揀任何容器')),
  'server.selection.count': entry(ladder('{count} selected'), ladder('已揀 {count} 個')),
  'server.selection.preview': entry(
    ladder('{start} would start, {stop} would stop, {restart} would restart, {remove} would be removed.'),
    ladder('{start} 個會開機，{stop} 個會停機，{restart} 個會重啟，{remove} 個會被移除。')
  ),
  'server.selection.noneApplicable': entry(
    ladder('No selected container can be {action}ed right now.'),
    ladder('已揀嘅容器而家冇一個可以 {action}。')
  ),
  'server.table.selectShown': entry(
    ladder('Select the {count} containers this filter shows'),
    ladder('揀晒篩選顯示緊嘅 {count} 個容器')
  ),
  'server.table.select': entry(
    ladder('Select the container {name}'),
    ladder('揀容器 {name}')
  ),

  /* ================================================================ */
  /* Confirmation copy                                                  */
  /* ================================================================ */

  'server.confirm.stop.irreversible': entry(
    ladder(
      'Every process inside the container is asked to finish and is killed after {grace} seconds if it has not. Anything the program was holding in memory and had not written to disk is lost. The container itself, its filesystem and its mounted directories are kept, so it can be started again.'
    ),
    ladder(
      '容器入面所有程序都會被要求收工，{grace} 秒之後仲未收工就會被強制殺咗。程式喺記憶體度未寫入磁碟嘅嘢會冇咗。容器本身、佢嘅檔案系統同掛載嘅目錄會保留，所以之後可以再開返。'
    )
  ),
  'server.confirm.restart.irreversible': entry(
    ladder(
      'The container is stopped exactly as a stop would stop it, with the same {grace}-second grace period and the same loss of anything held only in memory, and then started again. Connections open through it are dropped.'
    ),
    ladder(
      '容器會好似停機咁停低，用同一個 {grace} 秒緩衝期，記憶體度嘅嘢一樣會冇咗，然後再開返。經佢開住嘅連線會斷。'
    )
  ),
  'server.confirm.remove.irreversible': entry(
    ladder(
      'The container is stopped if it is running and then deleted, together with anything written inside it that is not on a mounted volume. Named volumes and bind-mounted directories, which is where this project keeps a downloaded world, are NOT deleted. A removed container cannot be started again; it has to be created again.'
    ),
    ladder(
      '如果容器運行緊會先停低，然後連同容器入面所有唔喺掛載卷嗰啲嘢一齊刪除。命名卷同 bind-mount 嘅目錄——即係呢個項目擺低載咗嘅世界嗰度——唔會被刪除。移除咗嘅容器唔可以再開返，一定要重新建立。'
    )
  ),
  'server.confirm.one': entry(
    ladder('{action} the container {name}'),
    ladder('{action} 容器 {name}')
  ),
  'server.confirm.many': entry(
    ladder('{action} {count} containers'),
    ladder('{action} {count} 個容器')
  ),
  'server.confirm.andMore': entry(
    ladder('… and {count} more'),
    ladder('… 仲有 {count} 個')
  ),
  'server.confirm.skipped': entry(
    ladder(
      '{count} of the {selected} selected are left alone: they are already in the requested state or an operation is already running against them.'
    ),
    ladder('已揀嘅 {selected} 個入面有 {count} 個唔會郁：已經係要求嗰個狀態，或者已經有嘢喺度做緊。')
  ),
  'server.confirm.affected.container': entry(
    ladder('{name} — image {image}, currently {state}'),
    ladder('{name} — image {image}，而家 {state}')
  ),
  'server.confirm.affected.port': entry(
    ladder('Published address {address} stops answering'),
    ladder('公開地址 {address} 會停止回應')
  ),

  /* ================================================================ */
  /* Notifications                                                      */
  /* ================================================================ */

  'server.notify.done': entry(ladder('{action} {name}'), ladder('{action} {name}')),
  'server.notify.failed': entry(
    ladder('{action} {name} did not succeed'),
    ladder('{action} {name} 唔成功')
  ),
  'server.notify.bulk': entry(
    ladder('{succeeded} succeeded, {failed} failed, {skipped} left alone.'),
    ladder('{succeeded} 個成功，{failed} 個失敗，{skipped} 個冇郁過。')
  ),
  'server.notify.bulkTitle': entry(
    ladder('{action} {count} containers'),
    ladder('{action} {count} 個容器')
  ),
  'server.copy.ok': entry(ladder('Copied'), ladder('已複製')),
  'server.copy.ok.body': entry(ladder('{what} is on the clipboard.'), ladder('{what} 已經喺剪貼簿度。')),
  'server.copy.failed': entry(ladder('Nothing was copied'), ladder('冇嘢複製到')),
  'server.copy.failed.body': entry(ladder('The clipboard refused: {reason}'), ladder('剪貼簿拒絕咗：{reason}')),

  /* ================================================================ */
  /* Export                                                             */
  /* ================================================================ */

  'server.export.title': entry(
    ladder('Export the container list', 'Export the container list', 'Export the container list', 'Take the container list to go', 'Take the container list to go'),
    ladder('匯出容器清單', '匯出容器清單', '匯出容器清單', '打包個容器清單帶走', '打包個容器清單帶走')
  ),
  'server.export.empty': entry(
    ladder('There is nothing to export: no container is selected and none is shown.'),
    ladder('冇嘢可以匯出：冇揀任何容器，亦都冇顯示緊嘅。')
  ),
  'server.export.losses': entry(
    ladder('This format cannot carry everything'),
    ladder('呢個格式裝唔晒所有嘢')
  ),
  'server.export.proceed': entry(ladder('Export anyway'), ladder('照樣匯出')),
  'server.export.cancel': entry(ladder('Choose another format first'), ladder('先揀返個其他格式')),

  /* ================================================================ */
  /* Row menu                                                           */
  /* ================================================================ */

  'server.row.more': entry(ladder('Actions for {name}'), ladder('{name} 嘅動作')),
  'server.row.logs': entry(
    ladder('Open the log stream', 'Open the log stream', 'Open the log stream', 'Go and listen in', 'Go and listen in'),
    ladder('開日誌串流', '開日誌串流', '開日誌', '入去聽下佢講咩', '入去聽下佢講咩')
  ),
  'server.row.open.group': entry(
    ladder('Open a published address in the browser'),
    ladder('喺瀏覽器開一個公開地址')
  ),
  'server.row.open.disabled': entry(
    ladder('This container publishes no TCP port to this machine, so there is no address to open.'),
    ladder('呢個容器冇喺呢部機公開任何 TCP 埠，所以冇地址可以開。')
  ),
  'server.row.open': entry(ladder('Open {address}'), ladder('開 {address}')),
  'server.row.copyName': entry(ladder('Copy the container name'), ladder('複製容器名稱')),
  'server.row.copyId': entry(ladder('Copy the container id'), ladder('複製容器 id')),
  'server.row.id': entry(ladder('Container id'), ladder('容器 id')),
  'server.row.copyCommand': entry(ladder('Copy the container command line'), ladder('複製容器命令列')),
  'server.row.copyCommand.disabled': entry(
    ladder('Docker reported no command line for this container.'),
    ladder('Docker 話呢個容器冇命令列。')
  ),

  /* ================================================================ */
  /* Table headers                                                      */
  /* ================================================================ */

  'server.table.label': entry(ladder('Containers'), ladder('容器')),
  'server.table.name': entry(ladder('Name'), ladder('名稱')),
  'server.table.state': entry(ladder('State'), ladder('狀態')),
  'server.table.image': entry(ladder('Image'), ladder('Image')),
  'server.table.ports': entry(ladder('Ports'), ladder('埠')),
  'server.table.status': entry(ladder('Reported status'), ladder('報告狀態')),
  'server.table.uptime': entry(ladder('Started'), ladder('開始咗')),
  'server.table.uptime.none': entry(ladder('Not reported'), ladder('未有報告')),
  'server.table.controls': entry(ladder('Controls'), ladder('操作')),
  'server.table.command': entry(ladder('Command'), ladder('命令')),
  'server.table.service': entry(
    ladder('Compose service {service} in project {project}'),
    ladder('Compose 服務 {service}，屬於專案 {project}')
  ),
  'server.ports.none': entry(ladder('None published'), ladder('冇公開')),

  /* ================================================================ */
  /* Container states, health, operation kind and phase                 */
  /* ================================================================ */

  'server.state.running': entry(
    ladder('Running', 'Running', 'Running', 'Wide awake', 'Wide awake and hard at work'),
    ladder('運行緊', '運行緊', '運行緊', '精神奕奕', '精神奕奕，努力開工')
  ),
  'server.state.restarting': entry(
    ladder('Restarting', 'Restarting', 'Restarting', 'Doing a little spin', 'Doing a little spin'),
    ladder('重啟緊', '重啟緊', '重啟緊', '轉緊個圈', '轉緊個圈')
  ),
  'server.state.paused': entry(
    ladder('Paused', 'Paused', 'Paused', 'On a coffee break', 'On a coffee break'),
    ladder('暫停咗', '暫停咗', '暫停咗', '飲緊咖啡', '飲緊咖啡')
  ),
  'server.state.created': entry(
    ladder('Created', 'Created', 'Created', 'Freshly minted, not started yet', 'Freshly minted, not started yet'),
    ladder('已建立', '已建立', '已建立', '啱啱整好，未開機', '啱啱整好，未開機')
  ),
  'server.state.exited': entry(
    ladder('Exited', 'Exited', 'Exited', 'Clocked off', 'Clocked off'),
    ladder('已退出', '已退出', '已退出', '收咗工', '收咗工')
  ),
  'server.state.removing': entry(
    ladder('Removing', 'Removing', 'Removing', 'On its way out', 'On its way out'),
    ladder('移除緊', '移除緊', '移除緊', '執緊嘢走人', '執緊嘢走人')
  ),
  'server.state.dead': entry(
    ladder('Dead', 'Dead', 'Dead', 'Properly dead', 'Properly, thoroughly dead'),
    ladder('死咗', '死咗', '死咗', '真係死咗喇', '真係死到不能再死')
  ),
  'server.state.unknown': entry(ladder('Unknown'), ladder('不明')),

  'server.health.healthy': entry(ladder('Healthy'), ladder('健康')),
  'server.health.unhealthy': entry(ladder('Unhealthy'), ladder('唔健康')),
  'server.health.starting': entry(ladder('Health check starting'), ladder('健康檢查啟動緊')),
  'server.health.none': entry(ladder('No health check'), ladder('冇健康檢查')),

  'server.op.kind.start': entry(ladder('Starting'), ladder('啟動緊')),
  'server.op.kind.stop': entry(ladder('Stopping'), ladder('停止緊')),
  'server.op.kind.restart': entry(ladder('Restarting'), ladder('重啟緊')),
  'server.op.kind.remove': entry(ladder('Removing'), ladder('移除緊')),

  'server.op.phase.sending': entry(ladder('Sending the command'), ladder('發緊個命令')),
  'server.op.phase.waiting': entry(ladder('Waiting for Docker'), ladder('等緊 Docker')),
  'server.op.phase.verifying': entry(ladder('Checking the result'), ladder('檢查緊結果')),
  'server.op.phase.succeeded': entry(ladder('Succeeded'), ladder('成功咗')),
  'server.op.phase.failed': entry(ladder('Failed'), ladder('失敗咗')),

  'server.severity.error': entry(ladder('Error'), ladder('錯誤')),
  'server.severity.warning': entry(ladder('Warning'), ladder('警告')),
  'server.severity.info': entry(ladder('Info'), ladder('資訊')),
  'server.severity.debug': entry(ladder('Debug'), ladder('偵錯')),
  'server.severity.other': entry(ladder('Other'), ladder('其他')),

  /* ================================================================ */
  /* Operations panel                                                   */
  /* ================================================================ */

  'server.op.section': entry(ladder('In progress'), ladder('進行緊')),
  'server.op.section.description': entry(
    ladder('Commands currently running against a container, with what they have printed so far.'),
    ladder('而家對緊某個容器運行緊嘅命令，同埋佢哋暫時打印咗嘅嘢。')
  ),
  'server.op.title': entry(ladder('{action} {name}'), ladder('{action} {name}')),
  'server.op.elapsedLabel': entry(
    ladder('Time elapsed against the grace period'),
    ladder('相對緩衝期已經過咗嘅時間')
  ),
  'server.op.elapsed': entry(
    ladder(
      '{elapsed} elapsed of the {grace} Docker was told to wait before it stops waiting politely. This bar is elapsed time, not an estimate of how far the work has got.'
    ),
    ladder(
      '已經過咗 {elapsed}，Docker 被要求斯文咁等最多 {grace}。呢條bar係已過時間，唔係估計做咗幾多。'
    )
  ),
  'server.op.workingLabel': entry(ladder('The command is running'), ladder('命令運行緊')),
  'server.op.working': entry(
    ladder(
      '{elapsed} elapsed. Docker reports no completion figure for this command, so this bar shows that work is happening and nothing more.'
    ),
    ladder('已經過咗 {elapsed}。Docker 冇話呢個命令做到幾多，所以呢條bar淨係話緊有嘢喺度做，僅此而已。')
  ),
  'server.op.output': entry(ladder('What the command printed'), ladder('個命令打印咗啲乜')),
  'server.op.dismiss': entry(
    ladder('Dismiss', 'Dismiss', 'Dismiss', 'Shoo it away', 'Shoo it away'),
    ladder('關閉', '關閉', '收埋佢', '揮手趕走', '揮手趕走')
  ),

  /* ================================================================ */
  /* Logs: source row                                                   */
  /* ================================================================ */

  'server.logs.source': entry(ladder('Source'), ladder('來源')),
  'server.logs.source.description': entry(
    ladder(
      'Which container, how many lines from the end, and whether to keep reading as new lines arrive.'
    ),
    ladder('揀邊個容器、由尾讀返幾多行，同埋要唔要一路跟住新嘅行讀落去。')
  ),
  'server.logs.container': entry(ladder('Container'), ladder('容器')),
  'server.logs.container.disabled': entry(
    ladder('Docker listed no containers, so there is no log to read. The containers destination says why.'),
    ladder('Docker 話冇任何容器，所以冇日誌好讀。容器嗰個分頁會話你知原因。')
  ),
  'server.logs.missing': entry(
    ladder('{name} — no longer listed'),
    ladder('{name} — 已經唔喺清單度')
  ),
  'server.logs.none': entry(ladder('No container'), ladder('冇容器')),
  'server.logs.tail': entry(ladder('Lines to read'), ladder('讀幾多行')),
  'server.logs.tail.support': entry(
    ladder('Lines read from the end of the log, between 50 and 5000.'),
    ladder('由日誌尾讀返嘅行數，介乎 50 至 5000 之間。')
  ),
  'server.logs.follow': entry(
    ladder('Follow live', 'Follow live', 'Follow live', 'Stick around and watch', 'Stick around and watch'),
    ladder('即時跟蹤', '即時跟蹤', '即時跟住', '坐低睇實佢', '坐低睇實佢')
  ),
  'server.logs.follow.disabled': entry(
    ladder('Choose a container first; there is nothing to follow yet.'),
    ladder('要先揀個容器；而家仲冇嘢好跟。')
  ),
  'server.logs.reload': entry(
    ladder('Read the log again', 'Read the log again', 'Read again', 'Give the log another read', 'Give the log another read'),
    ladder('再讀一次日誌', '再讀一次日誌', '再讀一次', '再讀多次個日誌', '再讀多次個日誌')
  ),
  'server.logs.openContainers': entry(ladder('Open the containers list'), ladder('開容器清單')),

  /* ================================================================ */
  /* Logs: status line                                                  */
  /* ================================================================ */

  'server.logs.status.none': entry(ladder('No container chosen.'), ladder('未揀容器。')),
  'server.logs.status.loading': entry(
    ladder('Reading the last {tail} lines of {name}.'),
    ladder('讀緊 {name} 最尾 {tail} 行。')
  ),
  'server.logs.status.following': entry(
    ladder('Following {name}. New lines appear as the container prints them.'),
    ladder('跟緊 {name}。容器一打新行，呢度就出返嚟。')
  ),
  'server.logs.status.snapshot': entry(
    ladder('{count} lines read from {name}. This is a snapshot, not a live view.'),
    ladder('由 {name} 讀咗 {count} 行。呢個係快照，唔係即時畫面。')
  ),
  'server.logs.status.dropped': entry(
    ladder('{count} of the oldest lines were dropped to stay within the {max}-line ceiling this destination holds in memory.'),
    ladder('為咗守住呢度記憶體嘅 {max} 行上限，最舊嘅 {count} 行已經被丟棄。')
  ),
  'server.logs.status.redacted': entry(
    ladder('Values that read as a password, a token, a secret or a key are shown as <redacted>. Turn redaction off in settings to see them.'),
    ladder('睇落似密碼、token、secret 或者 key 嘅值會顯示做 <redacted>。喺設定關咗遮蔽先睇到真身。')
  ),
  'server.logs.follow.ended': entry(
    ladder(
      'The follow ended. This happens when the container stops, when Docker closes the stream, or when following was switched off.'
    ),
    ladder('跟蹤結束咗。呢種情況會喺容器停機、Docker 關咗串流、或者跟蹤被關掉嗰陣發生。')
  ),

  /* ================================================================ */
  /* Logs: filters                                                      */
  /* ================================================================ */

  'server.logs.filters': entry(ladder('Filters'), ladder('篩選')),
  'server.logs.filters.description': entry(
    ladder('Search text and severity. Both narrow what is shown; neither changes what the container printed.'),
    ladder('搜尋文字同嚴重程度。兩者都淨係收窄顯示範圍，唔會改動容器真正打印過嘅嘢。')
  ),
  'server.logs.search': entry(
    ladder('Search log lines', 'Search log lines', 'Search the log', 'Go hunting in the log', 'Go hunting in the log'),
    ladder('搜尋日誌行', '搜尋日誌行', '搵日誌', '入去日誌度尋寶', '入去日誌度尋寶')
  ),
  'server.logs.search.placeholder': entry(ladder('Text or a regular expression'), ladder('文字或者正則表達式')),
  'server.logs.severity': entry(ladder('Show these severities'), ladder('顯示呢啲嚴重程度')),
  'server.logs.severity.note': entry(
    ladder(
      'A container log carries no severity channel. These are read from the words in each line, and from whether the line came from the error stream, so treat them as a reading rather than as a fact Docker reported.'
    ),
    ladder(
      '容器日誌本身冇嚴重程度呢個概念。呢啲係由每行嘅字眼、同埋嗰行係咪嚟自 error 串流推斷出嚟嘅，所以當佢係一個判讀，而唔係 Docker 講嘅事實。'
    )
  ),
  'server.logs.filters.summary': entry(ladder('{shown} of {held} lines shown'), ladder('顯示緊 {shown} / {held} 行')),
  'server.logs.clearFilter': entry(ladder('Clear filters'), ladder('清除篩選')),

  /* ================================================================ */
  /* Logs: statistics                                                   */
  /* ================================================================ */

  'server.logs.stats': entry(ladder('Statistics'), ladder('統計')),
  'server.logs.stats.description': entry(
    ladder('A read-only breakdown of the lines held in memory right now.'),
    ladder('一份純顯示嘅摘要，講而家記憶體度有幾多行。')
  ),
  'server.logs.stats.summary': entry(ladder('{lines} lines, {errors} read as errors'), ladder('{lines} 行，{errors} 行判讀為錯誤')),
  'server.logs.stats.loaded': entry(ladder('Lines held'), ladder('儲住嘅行')),
  'server.logs.stats.searched': entry(ladder('Matching the search'), ladder('合乎搜尋')),
  'server.logs.stats.shown': entry(ladder('Shown after the severity filter'), ladder('經嚴重程度篩選後顯示')),
  'server.logs.stats.dropped': entry(ladder('Dropped at the ceiling'), ladder('去到上限被丟棄')),

  /* ================================================================ */
  /* Logs: selection and bulk                                           */
  /* ================================================================ */

  'server.logs.selection.none': entry(ladder('No line selected'), ladder('未揀任何行')),
  'server.logs.selection.count': entry(ladder('{count} lines selected'), ladder('已揀 {count} 行')),
  'server.logs.selection.preview': entry(
    ladder('Copying or exporting acts on exactly those {count} lines.'),
    ladder('複製或者匯出會準確咁淨係作用喺呢 {count} 行。')
  ),
  'server.logs.copy': entry(
    ladder('Copy', 'Copy', 'Copy', 'Snag a copy', 'Snag a copy'),
    ladder('複製', '複製', '複製', '拎份副本', '拎份副本')
  ),
  'server.logs.copied': entry(ladder('Copied'), ladder('已複製')),
  'server.logs.copied.body': entry(
    ladder('{count} lines are on the clipboard, exactly as they are shown here.'),
    ladder('{count} 行已經喺剪貼簿度，同呢度顯示嘅一模一樣。')
  ),
  'server.logs.selectShown': entry(ladder('Select the {count} shown'), ladder('揀晒眼前 {count} 行')),
  'server.logs.selectAll': entry(
    ladder('Select all {count} held, including filtered out'),
    ladder('揀晒儲住嘅全部 {count} 行，包埋被篩走嗰啲')
  ),
  'server.logs.selectPage': entry(ladder('Select the {count} lines on this page'), ladder('揀晒呢頁 {count} 行')),
  'server.logs.select': entry(ladder('Select line {index}'), ladder('揀第 {index} 行')),

  /* ================================================================ */
  /* Logs: export                                                       */
  /* ================================================================ */

  'server.logs.export': entry(
    ladder('Export log lines', 'Export log lines', 'Export log lines', 'Take the log lines to go', 'Take the log lines to go'),
    ladder('匯出日誌行', '匯出日誌行', '匯出日誌行', '打包啲日誌行帶走', '打包啲日誌行帶走')
  ),
  'server.logs.export.empty': entry(
    ladder('There is nothing to export: no line is selected and none is shown.'),
    ladder('冇嘢可以匯出：冇揀任何行，亦都冇顯示緊嘅。')
  ),
  'server.logs.export.redacted': entry(
    ladder(
      '{count} lines written to {path}. They carry the same redaction the surface shows, so a value that reads as a password or a token is written as <redacted> in the file too.'
    ),
    ladder('{count} 行已經寫入 {path}。同呢度顯示一樣有遮蔽，所以睇落似密碼或者 token 嘅值喺檔案入面都會寫做 <redacted>。')
  ),
  'server.logs.export.raw': entry(
    ladder(
      '{count} lines written to {path}. Redaction is switched off, so anything the container printed — including a token or a password — is in that file exactly as it was printed.'
    ),
    ladder('{count} 行已經寫入 {path}。遮蔽而家係關咗嘅，所以容器打印過嘅任何嘢——包括 token 或者密碼——都會原原本本喺個檔案入面。')
  ),

  /* ================================================================ */
  /* Logs: table and pager                                              */
  /* ================================================================ */

  'server.logs.table': entry(ladder('Log lines'), ladder('日誌行')),
  'server.logs.column.time': entry(ladder('Time'), ladder('時間')),
  'server.logs.column.severity': entry(ladder('Severity'), ladder('嚴重程度')),
  'server.logs.column.text': entry(ladder('Line'), ladder('內容')),
  'server.logs.noTime': entry(ladder('Not stamped'), ladder('冇時間戳')),
  'server.logs.page': entry(ladder('Showing {from} to {to} of {total}'), ladder('顯示緊 {from} 至 {to}，共 {total}')),
  'server.logs.previous': entry(ladder('Previous page'), ladder('上一頁')),
  'server.logs.next': entry(ladder('Next page'), ladder('下一頁')),
  'server.logs.firstPage': entry(ladder('This is the first page.'), ladder('已經係第一頁。')),
  'server.logs.lastPage': entry(ladder('This is the last page.'), ladder('已經係最後一頁。')),

  /* ================================================================ */
  /* Logs: empty and error states                                       */
  /* ================================================================ */

  'server.logs.empty.noContainer': entry(
    ladder('Choose a container to read its log'),
    ladder('揀個容器嚟讀佢嘅日誌')
  ),
  'server.logs.empty.noContainer.none': entry(
    ladder(
      'Docker listed no containers, so there is no log to choose. The containers destination says whether Docker is missing or simply not answering.'
    ),
    ladder('Docker 話冇任何容器，所以冇日誌可以揀。容器嗰個分頁會話你知係 Docker 未裝定係得個冇回應。')
  ),
  'server.logs.empty.noContainer.some': entry(
    ladder('{count} containers exist. Pick one above.'),
    ladder('一共有 {count} 個容器。喺上面揀一個。')
  ),
  'server.logs.error': entry(ladder('The log could not be read'), ladder('讀唔到個日誌')),
  'server.logs.empty': entry(ladder('No line has been read yet.'), ladder('仲未讀到任何一行。')),
  'server.logs.empty.body': entry(
    ladder(
      '{name} has printed nothing that Docker retained, or it has only just started. Following it shows each line as it arrives.'
    ),
    ladder('{name} 未打印過 Docker 有保留嘅嘢，或者佢啱啱先開始。跟蹤佢會即時顯示每一行。')
  ),
  'server.logs.empty.filtered': entry(
    ladder('No line matches the search and severity filter.'),
    ladder('冇行合乎搜尋同嚴重程度篩選。')
  ),
  'server.logs.empty.filtered.body': entry(
    ladder('{count} lines are held; the filter is hiding all of them.'),
    ladder('儲住咗 {count} 行；篩選將佢哋全部收埋咗。')
  ),

  /* ================================================================ */
  /* Settings                                                           */
  /* ================================================================ */

  'server.settings.title': entry(ladder('Server and containers'), ladder('伺服器同容器')),
  'server.settings.refresh': entry(ladder('Automatic refresh, in seconds'), ladder('自動重新整理，以秒計')),
  'server.settings.refresh.description': entry(
    ladder(
      'How often the container list is re-read while a server destination is open. Nothing is polled while both destinations are closed.'
    ),
    ladder('喺伺服器分頁開住嗰陣，容器清單幾耐重讀一次。兩個分頁都關咗嗰陣就完全唔會查詢。')
  ),
  'server.settings.showStopped': entry(ladder('Show stopped containers by default'), ladder('預設顯示已停止嘅容器')),
  'server.settings.showStopped.description': entry(
    ladder(
      'The starting position of the "show stopped containers" switch on the containers destination. It can still be changed there at any time.'
    ),
    ladder('容器分頁入面「顯示已停止嘅容器」呢個掣嘅初始位置。之後隨時都可以喺嗰度改返。')
  ),
  'server.settings.stopTimeout': entry(ladder('Stop grace period, in seconds'), ladder('停機緩衝期，以秒計')),
  'server.settings.stopTimeout.description': entry(
    ladder(
      'How long Docker waits for a container to finish on its own after a stop or restart before killing it. The confirmation dialog always states the exact figure that will be used.'
    ),
    ladder('停機或重啟嗰陣，Docker 會等容器自己收工幾耐先強制殺咗佢。確認對話框每次都會講清楚實際會用嘅數字。')
  ),
  'server.settings.logTail': entry(ladder('Default lines to read'), ladder('預設讀嘅行數')),
  'server.settings.logTail.description': entry(
    ladder('How many lines from the end of a log are read by default when the log destination opens.'),
    ladder('開日誌分頁嗰陣，預設由尾讀返幾多行。')
  ),
  'server.settings.logFollow': entry(ladder('Follow live by default'), ladder('預設即時跟蹤')),
  'server.settings.logFollow.description': entry(
    ladder(
      'Whether a newly chosen container is followed live by default, rather than read as a snapshot. It can be switched on or off at any time from the log destination.'
    ),
    ladder('新揀嘅容器預設係咪即時跟蹤，定係讀快照。隨時都可以喺日誌分頁改返。')
  ),
  'server.settings.logPageSize': entry(ladder('Log lines per page'), ladder('每頁日誌行數')),
  'server.settings.logPageSize.description': entry(
    ladder('How many log lines are shown on one page of the log table.'),
    ladder('日誌表每頁顯示幾多行。')
  ),
  'server.settings.redactSecrets': entry(ladder('Redact secrets in command lines and logs'), ladder('喺命令列同日誌遮蔽敏感資料')),
  'server.settings.redactSecrets.description': entry(
    ladder(
      'Replaces any value assigned to a key that looks like a password, token, secret or key — in an echoed command line and in log lines — with <redacted>. Turning this off shows the real values, including in exports.'
    ),
    ladder('將任何指派俾睇落似密碼、token、secret 或 key 嘅值——喺顯示嘅命令列同日誌行度——換成 <redacted>。關咗呢個會顯示真實嘅值，匯出都係。')
  ),
  'server.settings.exportFormat': entry(ladder('Default export format'), ladder('預設匯出格式')),
  'server.settings.exportFormat.description': entry(
    ladder('The format the export action writes to by default for both the container list and log lines.'),
    ladder('容器清單同日誌行匯出嗰陣，預設用嘅格式。')
  ),

  /* ================================================================ */
  /* Palette                                                            */
  /* ================================================================ */

  'server.palette.openContainers': entry(ladder('Open the containers list'), ladder('開容器清單')),
  'server.palette.openLogs': entry(ladder('Open container logs'), ladder('開容器日誌')),
  'server.palette.refresh': entry(ladder('Refresh the container list'), ladder('重新整理容器清單')),
  'server.palette.checkDaemon': entry(ladder('Check Docker again'), ladder('再檢查 Docker')),
  'server.palette.searchContainers': entry(ladder('Search containers'), ladder('搜尋容器')),
  'server.palette.searchLogs': entry(ladder('Search log lines'), ladder('搜尋日誌行')),
  'server.palette.exportContainers': entry(ladder('Export the container list'), ladder('匯出容器清單')),
  'server.palette.exportLogs': entry(ladder('Export log lines'), ladder('匯出日誌行')),
  'server.palette.toggleFollow': entry(ladder('Toggle following the log live'), ladder('切換即時跟蹤日誌')),
  'server.palette.installDocker': entry(ladder('Open the Docker installation page'), ladder('開 Docker 安裝頁'))
};
