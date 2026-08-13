import type { Catalogue, TranslationEntry } from '../../core/registry';

/**
 * Every user-facing string this feature renders.
 *
 * The two humour ladders are independent, and humour only ever changes the
 * voice. The facts a person needs in order to act — which server, which folder,
 * which flag, what is irreversible — read the same at level 1 and at level 5.
 *
 * `t3` writes a five-rung ladder from three distinct voices: professional,
 * relaxed and playful. Rungs 1 and 2 share the professional wording and rungs 4
 * and 5 share the playful one, which is exactly the shape the integration
 * contract's own example uses.
 */
function t3(en: [string, string, string], yue: [string, string, string]): TranslationEntry {
  return {
    en: [en[0], en[0], en[1], en[2], en[2]],
    yue: [yue[0], yue[0], yue[1], yue[2], yue[2]]
  };
}

export const DOWNLOADER_STRINGS: Catalogue = {
  /* ---------------- destination ---------------- */
  'downloader.tab.title': t3(
    ['World downloader', 'World downloader', 'The world downloader'],
    ['世界下載器', '世界下載器', '個世界下載器']
  ),
  'downloader.tab.subtitle': t3(
    [
      'Runs the bundled Java downloader as a proxy and saves the world you walk through.',
      'Runs the bundled Java downloader as a proxy and saves the world you walk through.',
      'Sticks the Java downloader between you and the server, and keeps every chunk you walk past.'
    ],
    [
      '行緊個內置 Java 下載器做代理，你行過嘅世界佢就幫你儲落嚟。',
      '行緊個內置 Java 下載器做代理，你行過嘅世界佢就幫你儲落嚟。',
      '將 Java 下載器塞喺你同伺服器中間，你行過邊佢就袋起邊。'
    ]
  ),

  /* ---------------- sections ---------------- */
  'downloader.section.runtime': t3(
    ['Java runtime and jar', 'Java runtime and jar', 'Java and the jar'],
    ['Java 執行環境同 jar', 'Java 執行環境同 jar', 'Java 同個 jar']
  ),
  'downloader.section.runtime.description': t3(
    [
      'The downloader is a Java program. This states which Java runtime was found and which jar will be started.',
      'The downloader is a Java program. This states which Java runtime was found and which jar will be started.',
      'The downloader is a Java program, so it needs a Java and a jar. Here is what turned up.'
    ],
    [
      '個下載器係 Java 程式。呢度話你知搵到邊個 Java 執行環境、會用邊個 jar。',
      '個下載器係 Java 程式。呢度話你知搵到邊個 Java 執行環境、會用邊個 jar。',
      '下載器係 Java 嚟嘅，要有 Java 同 jar 先行到。呢度就係搵到嘅嘢。'
    ]
  ),
  'downloader.section.session': t3(
    ['Session', 'Session', 'The session'],
    ['今次連線', '今次連線', '今次呢鋪']
  ),
  'downloader.section.session.description': t3(
    [
      'Starts and stops the downloader. The exact command line that will run is shown before anything starts.',
      'Starts and stops the downloader. The exact command line that will run is shown before anything starts.',
      'Start and stop live here, and you can read the exact command line before it goes anywhere.'
    ],
    [
      '喺呢度開同閂個下載器。開之前會將完整命令行擺晒出嚟畀你睇。',
      '喺呢度開同閂個下載器。開之前會將完整命令行擺晒出嚟畀你睇。',
      '開機閂機喺呢度，未行之前成條命令都攤晒出嚟畀你睇清楚。'
    ]
  ),
  'downloader.section.status': t3(
    ['Live status', 'Live status', 'What is happening right now']
    ,
    ['即時狀態', '即時狀態', '而家發生緊乜']
  ),
  'downloader.section.status.description': t3(
    [
      'Every value here is read from the running downloader or from the files on disk. A value it has not reported stays empty.',
      'Every value here is read from the running downloader or from the files on disk. A value it has not reported stays empty.',
      'All of this comes from the real process or the real files. If it has not said something yet, the space stays blank rather than being filled in.'
    ],
    [
      '呢度每個數都係由行緊嘅下載器或者硬碟上面啲檔案讀返嚟。佢未講嘅就繼續留白。',
      '呢度每個數都係由行緊嘅下載器或者硬碟上面啲檔案讀返嚟。佢未講嘅就繼續留白。',
      '全部數字都係真嘅程序同真嘅檔案度攞返嚟。佢未講就留白，唔會亂噏一個畀你。'
    ]
  ),
  'downloader.section.options': t3(
    ['Launch options', 'Launch options', 'The knobs'],
    ['啟動選項', '啟動選項', '啲掣']
  ),
  'downloader.section.options.description': t3(
    [
      'Each control maps to one real command-line option of the Java downloader. An option left at its default contributes nothing to the command line.',
      'Each control maps to one real command-line option of the Java downloader. An option left at its default contributes nothing to the command line.',
      'Every control here is one genuine flag on the jar. Leave one alone and it stays off the command line entirely.'
    ],
    [
      '每個控制都對住 Java 下載器一個真實命令行選項。維持預設嘅就唔會出現喺命令行度。',
      '每個控制都對住 Java 下載器一個真實命令行選項。維持預設嘅就唔會出現喺命令行度。',
      '呢度每粒掣都係 jar 真係食嘅 flag。冇郁過嘅就唔會走上命令行。'
    ]
  ),
  'downloader.section.profiles': t3(
    ['Saved profiles', 'Saved profiles', 'Saved servers']
    ,
    ['已儲存設定檔', '已儲存設定檔', '儲低咗嘅伺服器']
  ),
  'downloader.section.profiles.description': t3(
    [
      'A profile stores every launch option under a name. Loading one replaces the current options; nothing starts until you start it.',
      'A profile stores every launch option under a name. Loading one replaces the current options; nothing starts until you start it.',
      'A profile is every knob above, saved under a name. Load one and the knobs change; nothing runs until you say so.'
    ],
    [
      '設定檔用一個名記住全部啟動選項。載入會覆蓋而家嘅選項；你唔撳開始就唔會行。',
      '設定檔用一個名記住全部啟動選項。載入會覆蓋而家嘅選項；你唔撳開始就唔會行。',
      '設定檔就係將上面啲掣改個名儲低。載入就換晒啲掣，你唔叫佢行佢唔會行。'
    ]
  ),
  'downloader.section.log': t3(
    ['Activity log', 'Activity log', 'What it has been saying'],
    ['活動記錄', '活動記錄', '佢一路噏咗啲乜']
  ),
  'downloader.section.log.description': t3(
    [
      'Every line the downloader wrote to standard output or standard error, in order, with the lines this application added marked as its own.',
      'Every line the downloader wrote to standard output or standard error, in order, with the lines this application added marked as its own.',
      'Everything the jar printed, in order, plus the few lines this application added — and those are labelled so you can tell them apart.'
    ],
    [
      '下載器寫入標準輸出同標準錯誤嘅每一行，順住嚟排；本應用自己加嘅行有標示。',
      '下載器寫入標準輸出同標準錯誤嘅每一行，順住嚟排；本應用自己加嘅行有標示。',
      'jar 印過嘅嘢全部順住排晒喺度，本應用自己加嘅幾行有標籤，分得清楚。'
    ]
  ),
  'downloader.section.versions': t3(
    ['Supported game versions', 'Supported game versions', 'Versions it knows'],
    ['支援嘅遊戲版本', '支援嘅遊戲版本', '佢識嘅版本']
  ),
  'downloader.section.versions.description': t3(
    [
      'Reference only. The downloader reads the protocol version from your client’s handshake, so there is no version to choose here; the live status shows the version the running session actually reported.',
      'Reference only. The downloader reads the protocol version from your client’s handshake, so there is no version to choose here; the live status shows the version the running session actually reported.',
      'Just a reference table. The jar works the version out from your client’s handshake, so there is nothing to pick; the live status shows what it actually found.'
    ],
    [
      '純參考。下載器由你 client 嘅握手封包讀通訊協定版本，所以呢度冇得揀；即時狀態會顯示今次真正報返嚟嘅版本。',
      '純參考。下載器由你 client 嘅握手封包讀通訊協定版本，所以呢度冇得揀；即時狀態會顯示今次真正報返嚟嘅版本。',
      '呢個純粹係對照表。版本 jar 自己由握手封包睇得出，冇嘢畀你揀；即時狀態度睇返佢真係搵到咩版本。'
    ]
  ),

  /* ---------------- runtime states ---------------- */
  'downloader.runtime.java.unknown': t3(
    ['The Java runtime has not been checked yet.', 'The Java runtime has not been checked yet.', 'Nobody has looked for Java yet.'],
    ['仲未檢查過 Java 執行環境。', '仲未檢查過 Java 執行環境。', '仲未去搵過 Java。']
  ),
  'downloader.runtime.java.checking': t3(
    ['Checking for a Java runtime…', 'Checking for a Java runtime…', 'Having a look for Java…'],
    ['檢查緊有冇 Java 執行環境⋯', '檢查緊有冇 Java 執行環境⋯', '搵緊 Java⋯']
  ),
  'downloader.runtime.java.present': t3(
    ['Java is available: {version}', 'Java is available: {version}', 'Java is here: {version}'],
    ['搵到 Java：{version}', '搵到 Java：{version}', 'Java 喺度：{version}']
  ),
  'downloader.runtime.java.missing': t3(
    [
      'No Java runtime named "{command}" could be started on this machine. The downloader cannot run without one. Install a Java 17 or newer runtime, then check again.',
      'No Java runtime named "{command}" could be started on this machine. The downloader cannot run without one. Install a Java 17 or newer runtime, then check again.',
      'This machine has no "{command}" to start. The downloader is a Java program, so it is going nowhere until a Java 17 or newer runtime is installed. Install one and press check again.'
    ],
    [
      '呢部機開唔到叫「{command}」嘅 Java 執行環境。冇佢個下載器行唔到。裝返 Java 17 或以上，然後再檢查。',
      '呢部機開唔到叫「{command}」嘅 Java 執行環境。冇佢個下載器行唔到。裝返 Java 17 或以上，然後再檢查。',
      '部機根本冇「{command}」可以開。下載器係 Java 程式，冇 Java 17 或以上就寸步難行。裝咗佢再撳一次檢查。'
    ]
  ),
  'downloader.runtime.java.failed': t3(
    [
      'The Java runtime answered, but the check did not succeed: {reason}',
      'The Java runtime answered, but the check did not succeed: {reason}',
      'Java answered and then fell over: {reason}'
    ],
    [
      'Java 執行環境有回應，但係檢查唔成功：{reason}',
      'Java 執行環境有回應，但係檢查唔成功：{reason}',
      'Java 應咗聲，然後仆咗：{reason}'
    ]
  ),
  'downloader.runtime.jar.found': t3(
    ['Downloader jar: {path} ({size})', 'Downloader jar: {path} ({size})', 'The jar: {path} ({size})'],
    ['下載器 jar：{path}（{size}）', '下載器 jar：{path}（{size}）', '個 jar：{path}（{size}）']
  ),
  'downloader.runtime.jar.missing': t3(
    [
      'No world-downloader.jar was found. Choose the jar file, or download the latest release and choose it afterwards.',
      'No world-downloader.jar was found. Choose the jar file, or download the latest release and choose it afterwards.',
      'There is no world-downloader.jar anywhere it looked. Point at one, or grab the latest release and point at that.'
    ],
    [
      '搵唔到 world-downloader.jar。揀返個 jar 檔，或者去下載最新版本再揀。',
      '搵唔到 world-downloader.jar。揀返個 jar 檔，或者去下載最新版本再揀。',
      '搵勻晒都冇 world-downloader.jar。你自己指返個畀佢，或者攞最新版返嚟再指。'
    ]
  ),
  'downloader.runtime.jar.searched': t3(
    ['Looked in: {paths}', 'Looked in: {paths}', 'Places it looked: {paths}'],
    ['搵過：{paths}', '搵過：{paths}', '去過呢啲位搵：{paths}']
  ),

  /* ---------------- actions ---------------- */
  'downloader.action.start': t3(
    ['Start the download', 'Start the download', 'Start capturing'],
    ['開始下載', '開始下載', '開始捉世界']
  ),
  'downloader.action.stop': t3(
    ['Stop the download', 'Stop the download', 'Stop capturing'],
    ['停止下載', '停止下載', '收工唔捉喇']
  ),
  'downloader.action.recheck': t3(
    ['Check for Java again', 'Check for Java again', 'Look for Java again'],
    ['再檢查一次 Java', '再檢查一次 Java', '再去搵一次 Java']
  ),
  'downloader.action.chooseJar': t3(
    ['Choose the downloader jar', 'Choose the downloader jar', 'Point at the jar'],
    ['揀下載器 jar', '揀下載器 jar', '指個 jar 畀佢']
  ),
  'downloader.action.getJar': t3(
    ['Open the releases page', 'Open the releases page', 'Open the releases page in your browser'],
    ['開啟發佈頁', '開啟發佈頁', '喺瀏覽器打開發佈頁']
  ),
  'downloader.action.getJava': t3(
    ['Open the Java download page', 'Open the Java download page', 'Open the Java download page in your browser'],
    ['開啟 Java 下載頁', '開啟 Java 下載頁', '喺瀏覽器打開 Java 下載頁']
  ),
  'downloader.action.copyCommand': t3(
    ['Copy the command line', 'Copy the command line', 'Copy the command line'],
    ['複製命令行', '複製命令行', '複製成條命令']
  ),
  'downloader.action.revealWorld': t3(
    ['Show the world folder', 'Show the world folder', 'Open the world folder in the file manager'],
    ['顯示世界資料夾', '顯示世界資料夾', '喺檔案總管打開個世界資料夾']
  ),
  'downloader.action.scanChunks': t3(
    ['Count the saved chunks', 'Count the saved chunks', 'Go and count the saved chunks'],
    ['點算已儲存區塊', '點算已儲存區塊', '去數下儲低咗幾多區塊']
  ),
  'downloader.action.cancelScan': t3(
    ['Stop counting', 'Stop counting', 'Stop counting'],
    ['停止點算', '停止點算', '唔數喇']
  ),
  'downloader.action.saveProfile': t3(
    ['Save as a profile', 'Save as a profile', 'Save these options as a profile'],
    ['儲存做設定檔', '儲存做設定檔', '將呢啲選項儲低做設定檔']
  ),
  'downloader.action.updateProfile': t3(
    ['Update the selected profile', 'Update the selected profile', 'Overwrite the selected profile'],
    ['更新已選設定檔', '更新已選設定檔', '覆蓋咗已選嗰個設定檔']
  ),
  'downloader.action.loadProfile': t3(
    ['Load into the options', 'Load into the options', 'Load it into the options'],
    ['載入到選項', '載入到選項', '載入返上面啲選項度']
  ),
  'downloader.action.duplicateProfile': t3(
    ['Duplicate', 'Duplicate', 'Make a copy'],
    ['複製', '複製', '整多份']
  ),
  'downloader.action.deleteProfiles': t3(
    ['Delete the selected profiles', 'Delete the selected profiles', 'Delete the selected profiles'],
    ['刪除已選設定檔', '刪除已選設定檔', '刪走揀咗嗰啲設定檔']
  ),
  'downloader.action.exportProfiles': t3(
    ['Export the profiles', 'Export the profiles', 'Export the profiles'],
    ['匯出設定檔', '匯出設定檔', '將啲設定檔匯出']
  ),
  'downloader.action.resetOptions': t3(
    ['Reset every option to its default', 'Reset every option to its default', 'Put every option back to its default'],
    ['將全部選項還原預設', '將全部選項還原預設', '全部掣打返回原位']
  ),
  'downloader.action.exportLog': t3(
    ['Export the log', 'Export the log', 'Export the log'],
    ['匯出記錄', '匯出記錄', '將記錄匯出']
  ),
  'downloader.action.copyLines': t3(
    ['Copy the selected lines', 'Copy the selected lines', 'Copy the selected lines'],
    ['複製已選行', '複製已選行', '複製揀咗嗰幾行']
  ),
  'downloader.action.deleteLines': t3(
    ['Delete the selected lines', 'Delete the selected lines', 'Delete the selected lines'],
    ['刪除已選行', '刪除已選行', '刪走揀咗嗰幾行']
  ),
  'downloader.action.selectAllShown': t3(
    ['Select the {count} lines shown', 'Select the {count} lines shown', 'Select the {count} lines on screen']
    ,
    ['選取畫面上 {count} 行', '選取畫面上 {count} 行', '揀晒畫面上嗰 {count} 行']
  ),
  'downloader.action.selectAllMatches': t3(
    ['Select all {count} matching lines', 'Select all {count} matching lines', 'Select every one of the {count} matching lines'],
    ['選取全部 {count} 行符合嘅', '選取全部 {count} 行符合嘅', '成 {count} 行符合嘅一次過揀晒']
  ),
  'downloader.action.invertSelection': t3(
    ['Invert the selection', 'Invert the selection', 'Flip the selection'],
    ['反轉選取', '反轉選取', '揀返轉頭']
  ),
  'downloader.action.clearSelection': t3(
    ['Clear the selection', 'Clear the selection', 'Clear the selection'],
    ['清除選取', '清除選取', '唔揀住先']
  ),
  'downloader.action.selectAllProfiles': t3(
    ['Select every profile', 'Select every profile', 'Select the lot'],
    ['選取全部設定檔', '選取全部設定檔', '成堆揀晒佢']
  ),

  /* ---------------- searches ---------------- */
  'downloader.search.options': t3(
    ['Search the launch options', 'Search the launch options', 'Search the knobs'],
    ['搜尋啟動選項', '搜尋啟動選項', '搵下有咩掣']
  ),
  'downloader.search.profiles': t3(
    ['Search the saved profiles', 'Search the saved profiles', 'Search the saved profiles'],
    ['搜尋已儲存設定檔', '搜尋已儲存設定檔', '搵下啲儲低咗嘅設定檔']
  ),
  'downloader.search.log': t3(
    ['Search the activity log', 'Search the activity log', 'Search everything it said'],
    ['搜尋活動記錄', '搜尋活動記錄', '喺佢噏過嘅嘢度搵']
  ),

  /* ---------------- status ---------------- */
  'downloader.status.pending': t3(
    ['Not reported yet', 'Not reported yet', 'Nothing said about this yet'],
    ['未報告', '未報告', '未講到呢樣']
  ),
  'downloader.status.phase': t3(['State', 'State', 'State'], ['狀態', '狀態', '狀態']),
  'downloader.status.phase.idle': t3(
    ['Not running', 'Not running', 'Sitting still'],
    ['未行緊', '未行緊', '坐喺度乜都冇做']
  ),
  'downloader.status.phase.starting': t3(['Starting', 'Starting', 'Starting up'], ['啟動緊', '啟動緊', '起緊身']),
  'downloader.status.phase.running': t3(['Running', 'Running', 'Running'], ['行緊', '行緊', '行緊']),
  'downloader.status.phase.stopping': t3(
    ['Stopping', 'Stopping', 'Winding down'],
    ['停緊', '停緊', '收緊尾']
  ),
  'downloader.status.phase.stopped': t3(['Stopped', 'Stopped', 'Stopped'], ['已停止', '已停止', '停咗']),
  'downloader.status.phase.failed': t3(['Failed', 'Failed', 'Fell over'], ['失敗', '失敗', '仆咗街']),
  'downloader.status.connection': t3(['Connection', 'Connection', 'Connection'], ['連線', '連線', '連線']),
  'downloader.status.connection.notStarted': t3(
    ['The proxy has not started listening yet.', 'The proxy has not started listening yet.', 'The proxy has not opened its ear yet.'],
    ['代理仲未開始聽。', '代理仲未開始聽。', '代理仲未擘開隻耳。']
  ),
  'downloader.status.connection.waitingForSignin': t3(
    ['Waiting for the Microsoft sign-in to be approved.', 'Waiting for the Microsoft sign-in to be approved.', 'Waiting for you to approve the Microsoft sign-in.'],
    ['等緊 Microsoft 登入獲批准。', '等緊 Microsoft 登入獲批准。', '等緊你去批准個 Microsoft 登入。']
  ),
  'downloader.status.connection.listening': t3(
    ['Listening. Connect your Minecraft client to localhost:{port}.', 'Listening. Connect your Minecraft client to localhost:{port}.', 'Ear open. Point your Minecraft client at localhost:{port}.'],
    ['聽緊。將你嘅 Minecraft client 連去 localhost:{port}。', '聽緊。將你嘅 Minecraft client 連去 localhost:{port}。', '擘大耳等緊你。Minecraft client 駁去 localhost:{port} 啦。']
  ),
  'downloader.status.connection.clientConnected': t3(
    ['A client is connected and chunks are being captured.', 'A client is connected and chunks are being captured.', 'A client is on, and the chunks are rolling in.'],
    ['已有 client 連線，正在擷取區塊。', '已有 client 連線，正在擷取區塊。', 'client 上咗嚟，區塊一路入袋。']
  ),
  'downloader.status.connection.disconnected': t3(
    ['Disconnected. The proxy is still running.', 'Disconnected. The proxy is still running.', 'The connection dropped, but the proxy is still up.'],
    ['已斷線，代理仲行緊。', '已斷線，代理仲行緊。', '斷咗線，不過代理仲未閂。']
  ),
  'downloader.status.connection.ended': t3(
    ['The downloader has exited.', 'The downloader has exited.', 'The downloader has gone home.'],
    ['下載器已經結束。', '下載器已經結束。', '下載器收咗工。']
  ),
  'downloader.status.elapsed': t3(['Elapsed', 'Elapsed', 'Running for'], ['已經行咗', '已經行咗', '行咗幾耐']),
  'downloader.status.version': t3(
    ['Game version', 'Game version', 'Game version it detected'],
    ['遊戲版本', '遊戲版本', '佢偵測到嘅版本']
  ),
  'downloader.status.versionValue': t3(
    ['{version} (protocol {protocol})', '{version} (protocol {protocol})', '{version} (protocol {protocol})'],
    ['{version}（通訊協定 {protocol}）', '{version}（通訊協定 {protocol}）', '{version}（通訊協定 {protocol}）']
  ),
  'downloader.status.account': t3(['Account', 'Account', 'Who is logged in'], ['帳號', '帳號', '邊個登咗入']),
  'downloader.status.proxy': t3(['Proxying', 'Proxying', 'Standing in front of'], ['代理緊', '代理緊', '幫邊個擋住先']),
  'downloader.status.localPort': t3(
    ['Local address', 'Local address', 'Where to point your client'],
    ['本機位址', '本機位址', 'client 應該駁去邊']
  ),
  'downloader.status.player': t3(['Player position', 'Player position', 'Where you are standing'], ['玩家座標', '玩家座標', '你企緊喺邊']),
  'downloader.status.dimension': t3(['Dimension', 'Dimension', 'Which dimension'], ['維度', '維度', '邊個維度']),
  'downloader.status.regionFiles': t3(
    ['Region files written', 'Region files written', 'Region files on disk'],
    ['已寫入區域檔', '已寫入區域檔', '硬碟上有幾多區域檔']
  ),
  'downloader.status.regionFilesValue': t3(
    ['{regions} region and {entities} entity files', '{regions} region and {entities} entity files', '{regions} region files and {entities} entity files'],
    ['{regions} 個區域檔、{entities} 個實體檔', '{regions} 個區域檔、{entities} 個實體檔', '區域檔 {regions} 個、實體檔 {entities} 個']
  ),
  'downloader.status.worldBytes': t3(
    ['World size on disk', 'World size on disk', 'How much space it has taken'],
    ['世界佔用空間', '世界佔用空間', '食咗幾多位']
  ),
  'downloader.status.lastWrite': t3(
    ['Last region write', 'Last region write', 'Last time it wrote something'],
    ['最後一次寫入區域', '最後一次寫入區域', '最後一次寫嘢係幾時']
  ),
  'downloader.status.chunks': t3(
    ['Chunks saved', 'Chunks saved', 'Chunks safely on disk'],
    ['已儲存區塊', '已儲存區塊', '安全落咗地嘅區塊']
  ),
  'downloader.status.chunks.never': t3(
    [
      'Not counted yet. Counting reads every region file’s header, so it runs only when you ask for it.',
      'Not counted yet. Counting reads every region file’s header, so it runs only when you ask for it.',
      'Nobody has counted yet. It has to read every region file’s header, so it waits until you ask.'
    ],
    [
      '仲未數過。要逐個區域檔讀檔頭，所以你唔叫佢就唔會做。',
      '仲未數過。要逐個區域檔讀檔頭，所以你唔叫佢就唔會做。',
      '未數過。佢要逐個區域檔揭開檔頭睇，所以等你開聲先做。'
    ]
  ),
  'downloader.status.chunks.value': t3(
    [
      '{chunks} chunks across {files} region files, counted {when}',
      '{chunks} chunks across {files} region files, counted {when}',
      '{chunks} chunks across {files} region files, counted {when}'
    ],
    [
      '{files} 個區域檔入面共 {chunks} 個區塊，{when} 數嘅',
      '{files} 個區域檔入面共 {chunks} 個區塊，{when} 數嘅',
      '{files} 個區域檔度總共 {chunks} 個區塊，{when} 數嘅'
    ]
  ),
  'downloader.status.chunks.skipped': t3(
    [
      '{count} region files were skipped because they are larger than the read ceiling; their chunks are not in the total.',
      '{count} region files were skipped because they are larger than the read ceiling; their chunks are not in the total.',
      '{count} region files were too big to read, so their chunks are not in that total.'
    ],
    [
      '{count} 個區域檔超過讀取上限所以略過咗；佢哋嘅區塊冇計入總數。',
      '{count} 個區域檔超過讀取上限所以略過咗；佢哋嘅區塊冇計入總數。',
      '{count} 個區域檔大到讀唔切，所以個總數冇包佢哋。'
    ]
  ),
  'downloader.status.player.needsMap': t3(
    [
      'The player position comes from the overview map’s own status file, and map rendering is turned off for this session.',
      'The player position comes from the overview map’s own status file, and map rendering is turned off for this session.',
      'The position lives in the overview map’s status file, and this session has map rendering switched off.'
    ],
    [
      '玩家座標係由總覽地圖自己嗰個狀態檔攞返嚟，而今次連線冇開地圖繪製。',
      '玩家座標係由總覽地圖自己嗰個狀態檔攞返嚟，而今次連線冇開地圖繪製。',
      '座標喺總覽地圖嘅狀態檔度，今次冇開地圖繪製，所以冇得睇。'
    ]
  ),
  'downloader.status.disconnect': t3(
    ['Last disconnect', 'Last disconnect', 'Why it dropped last time'],
    ['最近一次斷線', '最近一次斷線', '上次點解斷咗']
  ),
  'downloader.status.exit': t3(
    ['Exit', 'Exit', 'How it ended'],
    ['結束狀況', '結束狀況', '點收場']
  ),
  'downloader.status.exitValue': t3(
    ['Exit code {code}', 'Exit code {code}', 'Exit code {code}'],
    ['結束代碼 {code}', '結束代碼 {code}', '結束代碼 {code}']
  ),
  'downloader.status.microsoft': t3(
    ['Microsoft sign-in', 'Microsoft sign-in', 'Microsoft sign-in']
    ,
    ['Microsoft 登入', 'Microsoft 登入', 'Microsoft 登入']
  ),
  'downloader.status.microsoft.body': t3(
    [
      'Open {url} and enter the code {code}. The downloader waits until the sign-in is approved.',
      'Open {url} and enter the code {code}. The downloader waits until the sign-in is approved.',
      'Open {url}, type in {code}, and the downloader will sit patiently until you have done it.'
    ],
    [
      '開 {url}，輸入代碼 {code}。下載器會等到你批准登入為止。',
      '開 {url}，輸入代碼 {code}。下載器會等到你批准登入為止。',
      '開 {url}，打 {code} 入去，下載器會乖乖等到你搞掂為止。'
    ]
  ),
  'downloader.status.microsoft.open': t3(
    ['Open the sign-in page', 'Open the sign-in page', 'Open the sign-in page in your browser'],
    ['開啟登入頁', '開啟登入頁', '喺瀏覽器開個登入頁']
  ),
  'downloader.status.preparing': t3(
    [
      'First run for this game version: the downloader is generating its block and entity reports. This takes a minute and only happens once per version.',
      'First run for this game version: the downloader is generating its block and entity reports. This takes a minute and only happens once per version.',
      'First time on this game version, so the downloader is building its block and entity reports. One minute, once per version, then never again.'
    ],
    [
      '今個遊戲版本第一次行：下載器喺度產生方塊同實體報告。要一分鐘左右，每個版本淨係做一次。',
      '今個遊戲版本第一次行：下載器喺度產生方塊同實體報告。要一分鐘左右，每個版本淨係做一次。',
      '第一次見呢個版本，下載器要整方塊同實體報告。一分鐘啫，每個版本得一次。'
    ]
  ),
  'downloader.status.truncated': t3(
    [
      'The retained output reached its ceiling, so the earliest lines were dropped. The download itself is unaffected.',
      'The retained output reached its ceiling, so the earliest lines were dropped. The download itself is unaffected.',
      'The kept output hit its ceiling and the oldest lines fell off the end. The download carries on regardless.'
    ],
    [
      '保留嘅輸出到咗上限，所以最早嗰啲行被丟棄咗。下載本身唔受影響。',
      '保留嘅輸出到咗上限，所以最早嗰啲行被丟棄咗。下載本身唔受影響。',
      '留住嘅輸出爆咗上限，最舊嗰啲行跌咗出去。下載本身照行。'
    ]
  ),

  /* ---------------- session copy ---------------- */
  'downloader.session.command': t3(
    ['Command line', 'Command line', 'The command line it will run'],
    ['命令行', '命令行', '佢會行嘅命令']
  ),
  'downloader.session.problems': t3(
    [
      'These values must be corrected before a download can start:',
      'These values must be corrected before a download can start:',
      'Fix these first, and then it will start:'
    ],
    [
      '要改好以下數值先開始到下載：',
      '要改好以下數值先開始到下載：',
      '搞掂咗呢啲先，佢就會行：'
    ]
  ),
  'downloader.session.started': t3(
    ['The downloader started.', 'The downloader started.', 'It is away.'],
    ['下載器已經開始。', '下載器已經開始。', '出咗發喇。']
  ),
  'downloader.session.startFailed': t3(
    ['The downloader did not start: {reason}', 'The downloader did not start: {reason}', 'It did not start: {reason}'],
    ['下載器開唔到：{reason}', '下載器開唔到：{reason}', '開唔到：{reason}']
  ),
  'downloader.session.stopped': t3(
    ['The downloader has stopped.', 'The downloader has stopped.', 'It has stopped.'],
    ['下載器已經停咗。', '下載器已經停咗。', '停咗喇。']
  ),
  'downloader.session.alreadyRunning': t3(
    [
      'A download is already running in this window. Stop it before starting another.',
      'A download is already running in this window. Stop it before starting another.',
      'One download is already running here. Stop that one first.'
    ],
    [
      '呢個視窗已經行緊一個下載。要停咗佢先可以再開。',
      '呢個視窗已經行緊一個下載。要停咗佢先可以再開。',
      '呢度已經有一個行緊。停咗佢先啦。'
    ]
  ),
  'downloader.session.needsJava': t3(
    ['No usable Java runtime was found, so nothing can be started.', 'No usable Java runtime was found, so nothing can be started.', 'No usable Java, so nothing can start.'],
    ['搵唔到可用嘅 Java 執行環境，所以開唔到。', '搵唔到可用嘅 Java 執行環境，所以開唔到。', '冇可用嘅 Java，開唔到。']
  ),
  'downloader.session.needsJar': t3(
    ['No downloader jar has been chosen, so nothing can be started.', 'No downloader jar has been chosen, so nothing can be started.', 'No jar chosen, so nothing can start.'],
    ['未揀下載器 jar，所以開唔到。', '未揀下載器 jar，所以開唔到。', '未指個 jar 畀佢，開唔到。']
  ),
  'downloader.session.needsValidOptions': t3(
    ['Some launch options are not usable yet. The list above says which.', 'Some launch options are not usable yet. The list above says which.', 'Some options are not usable yet — the list above names them.'],
    ['有啲啟動選項仲用唔到，上面張單有寫邊啲。', '有啲啟動選項仲用唔到，上面張單有寫邊啲。', '有啲選項仲未得，上面張單寫晒係邊啲。']
  ),
  'downloader.session.runningReason': t3(
    ['A download is running. Stop it first.', 'A download is running. Stop it first.', 'It is running. Stop it first.'],
    ['而家行緊下載，要先停咗佢。', '而家行緊下載，要先停咗佢。', '行緊喎，停咗佢先。']
  ),
  'downloader.session.notRunningReason': t3(
    ['Nothing is running.', 'Nothing is running.', 'Nothing is running.'],
    ['而家冇嘢行緊。', '而家冇嘢行緊。', '而家乜都冇行緊。']
  ),
  'downloader.session.copied': t3(
    ['The command line is on the clipboard.', 'The command line is on the clipboard.', 'Copied — the command line is on the clipboard.'],
    ['命令行已經複製咗。', '命令行已經複製咗。', '複製咗喇，成條命令喺剪貼簿。']
  ),
  'downloader.session.copyFailed': t3(
    ['The clipboard refused the copy: {reason}', 'The clipboard refused the copy: {reason}', 'The clipboard would not take it: {reason}'],
    ['剪貼簿拒絕咗：{reason}', '剪貼簿拒絕咗：{reason}', '剪貼簿唔收：{reason}']
  ),

  /* ---------------- destructive gates ---------------- */
  'downloader.confirm.stop': t3(
    ['Stop the running download', 'Stop the running download', 'Stop the running download'],
    ['停止行緊嘅下載', '停止行緊嘅下載', '停止行緊嗰個下載']
  ),
  'downloader.confirm.stop.irreversible': t3(
    [
      'The downloader is terminated. Chunks it had captured but not yet flushed to disk are lost, and any client connected through the proxy is disconnected. Chunks already written to region files are not affected.',
      'The downloader is terminated. Chunks it had captured but not yet flushed to disk are lost, and any client connected through the proxy is disconnected. Chunks already written to region files are not affected.',
      'The downloader gets terminated. Anything it captured but had not written to disk yet is gone, and your client drops out. Chunks already in the region files stay exactly where they are.'
    ],
    [
      '下載器會被終止。已經擷取但仲未寫落硬碟嘅區塊會消失，經代理連住嘅 client 亦都會斷線。已經寫入區域檔嘅區塊唔受影響。',
      '下載器會被終止。已經擷取但仲未寫落硬碟嘅區塊會消失，經代理連住嘅 client 亦都會斷線。已經寫入區域檔嘅區塊唔受影響。',
      '下載器會即刻俾人熄。捉咗但未寫落硬碟嘅區塊就冇咗，你部 client 亦都會甩線。已經寫咗入區域檔嗰啲照樣安然無恙。'
    ]
  ),
  'downloader.confirm.deleteProfiles': t3(
    ['Delete {count} saved profiles', 'Delete {count} saved profiles', 'Delete {count} saved profiles'],
    ['刪除 {count} 個已儲存設定檔', '刪除 {count} 個已儲存設定檔', '刪走 {count} 個儲低咗嘅設定檔']
  ),
  'downloader.confirm.deleteProfiles.irreversible': t3(
    [
      'The profiles are removed from the settings file. Captured worlds on disk are not touched. The deletion is written to local history, so it can be reviewed there afterwards.',
      'The profiles are removed from the settings file. Captured worlds on disk are not touched. The deletion is written to local history, so it can be reviewed there afterwards.',
      'The profiles disappear from the settings file. Your captured worlds are not touched at all. The deletion goes into local history, so you can see it there afterwards.'
    ],
    [
      '設定檔會由設定檔案入面刪走。硬碟上擷取咗嘅世界完全唔會郁。刪除會寫入本機歷史，之後可以喺嗰度查返。',
      '設定檔會由設定檔案入面刪走。硬碟上擷取咗嘅世界完全唔會郁。刪除會寫入本機歷史，之後可以喺嗰度查返。',
      '設定檔會喺設定檔案度消失。你擷取咗嘅世界一條毛都唔會郁。刪除會入返本機歷史，之後查得返。'
    ]
  ),
  'downloader.confirm.deleteLines': t3(
    ['Delete {count} log lines', 'Delete {count} log lines', 'Delete {count} log lines'],
    ['刪除 {count} 行記錄', '刪除 {count} 行記錄', '刪走 {count} 行記錄']
  ),
  'downloader.confirm.deleteLines.irreversible': t3(
    [
      'The lines are removed from this window’s activity log. The downloader’s own retained output is not affected, but this application cannot put the lines back once they are gone from the list.',
      'The lines are removed from this window’s activity log. The downloader’s own retained output is not affected, but this application cannot put the lines back once they are gone from the list.',
      'Those lines vanish from this window’s log. The downloader’s own retained output is untouched, but this list cannot get them back once they are gone.'
    ],
    [
      '啲行會由呢個視窗嘅活動記錄度刪走。下載器自己保留嘅輸出唔受影響，但係本應用喺呢張單度冇得攞返啲行。',
      '啲行會由呢個視窗嘅活動記錄度刪走。下載器自己保留嘅輸出唔受影響，但係本應用喺呢張單度冇得攞返啲行。',
      '嗰啲行會喺呢個視窗嘅記錄度消失。下載器自己嗰份輸出照樣喺度，但係呢張單就攞唔返喇。'
    ]
  ),

  /* ---------------- profiles ---------------- */
  'downloader.profiles.empty': t3(
    ['No profiles have been saved yet.', 'No profiles have been saved yet.', 'Nothing saved yet.'],
    ['仲未儲存過任何設定檔。', '仲未儲存過任何設定檔。', '一個都未儲過。']
  ),
  'downloader.profiles.emptyBody': t3(
    [
      'Set the launch options above and save them under a name, or start from one of the offered presets. Every preset is the application’s own defaults plus the exact changes it names.',
      'Set the launch options above and save them under a name, or start from one of the offered presets. Every preset is the application’s own defaults plus the exact changes it names.',
      'Fill in the options above and save them under a name, or take one of the presets below. Each preset is just the real defaults plus the exact changes it lists.'
    ],
    [
      '喺上面設定好啲啟動選項，改個名儲低，或者揀下面其中一個預設起步。每個預設都係本應用真正嘅預設值加埋佢自己列明嗰幾項改動。',
      '喺上面設定好啲啟動選項，改個名儲低，或者揀下面其中一個預設起步。每個預設都係本應用真正嘅預設值加埋佢自己列明嗰幾項改動。',
      '上面啲選項填好，改個名儲低；或者攞下面嘅預設起步。每個預設都係真預設值加佢寫明嗰幾項改動，冇第二啲嘢。'
    ]
  ),
  'downloader.profiles.presets': t3(
    ['Start from a preset', 'Start from a preset', 'Start from a preset'],
    ['由預設開始', '由預設開始', '攞個預設起手']
  ),
  'downloader.profiles.presetSets': t3(
    ['Sets: {changes}', 'Sets: {changes}', 'Sets: {changes}'],
    ['會設定：{changes}', '會設定：{changes}', '會設定：{changes}']
  ),
  'downloader.profiles.presetSetsNothing': t3(
    ['Sets nothing beyond the application’s own defaults.', 'Sets nothing beyond the application’s own defaults.', 'Sets nothing at all beyond the real defaults.'],
    ['除咗本應用嘅預設值之外乜都唔會設定。', '除咗本應用嘅預設值之外乜都唔會設定。', '除咗真預設值之外，一樣都唔會改。']
  ),
  'downloader.profiles.name': t3(['Profile name', 'Profile name', 'Profile name'], ['設定檔名稱', '設定檔名稱', '設定檔叫咩名']),
  'downloader.profiles.notes': t3(['Notes', 'Notes', 'Notes to yourself'], ['備註', '備註', '寫低畀自己睇']),
  'downloader.profiles.saved': t3(
    ['Saved the profile "{name}".', 'Saved the profile "{name}".', 'Saved "{name}".'],
    ['已儲存設定檔「{name}」。', '已儲存設定檔「{name}」。', '「{name}」儲低咗。']
  ),
  'downloader.profiles.updated': t3(
    ['Updated the profile "{name}".', 'Updated the profile "{name}".', 'Updated "{name}".'],
    ['已更新設定檔「{name}」。', '已更新設定檔「{name}」。', '「{name}」更新咗。']
  ),
  'downloader.profiles.loaded': t3(
    ['Loaded "{name}" into the launch options.', 'Loaded "{name}" into the launch options.', 'Loaded "{name}" into the options.'],
    ['已將「{name}」載入啟動選項。', '已將「{name}」載入啟動選項。', '「{name}」載咗入去啲選項度。']
  ),
  'downloader.profiles.deleted': t3(
    ['{count} profiles were deleted.', '{count} profiles were deleted.', '{count} profiles deleted.'],
    ['刪除咗 {count} 個設定檔。', '刪除咗 {count} 個設定檔。', '刪咗 {count} 個設定檔。']
  ),
  'downloader.profiles.column.name': t3(['Name', 'Name', 'Name'], ['名稱', '名稱', '名']),
  'downloader.profiles.column.target': t3(['Server and output', 'Server and output', 'Server and output'], ['伺服器同輸出', '伺服器同輸出', '伺服器同出邊度']),
  'downloader.profiles.column.changed': t3(
    ['Options changed', 'Options changed', 'Options changed from default'],
    ['已改選項', '已改選項', '同預設唔同嘅選項']
  ),
  'downloader.profiles.column.updated': t3(['Updated', 'Updated', 'Last updated'], ['更新時間', '更新時間', '最後改嗰陣']),
  'downloader.profiles.selection': t3(
    ['{count} of {total} profiles selected', '{count} of {total} profiles selected', '{count} of {total} profiles selected'],
    ['已揀 {count} / {total} 個設定檔', '已揀 {count} / {total} 個設定檔', '揀咗 {count} / {total} 個設定檔']
  ),
  'downloader.profiles.needsOne': t3(
    ['Select exactly one profile first.', 'Select exactly one profile first.', 'Pick exactly one profile first.'],
    ['要先揀啱一個設定檔。', '要先揀啱一個設定檔。', '揀返一個先啦。']
  ),
  'downloader.profiles.needsSome': t3(
    ['Select at least one profile first.', 'Select at least one profile first.', 'Pick at least one profile first.'],
    ['要先至少揀一個設定檔。', '要先至少揀一個設定檔。', '起碼揀一個先啦。']
  ),

  /* ---------------- log ---------------- */
  'downloader.log.empty': t3(
    ['Nothing has been logged yet.', 'Nothing has been logged yet.', 'Nothing logged yet.'],
    ['仲未有任何記錄。', '仲未有任何記錄。', '一行都未有。']
  ),
  'downloader.log.emptyBody': t3(
    [
      'Lines appear here as soon as the downloader starts writing output.',
      'Lines appear here as soon as the downloader starts writing output.',
      'The moment the downloader says anything, it lands here.'
    ],
    [
      '下載器一開始有輸出，啲行就會喺呢度出現。',
      '下載器一開始有輸出，啲行就會喺呢度出現。',
      '下載器一開聲，啲字就會跌落嚟呢度。'
    ]
  ),
  'downloader.log.noMatches': t3(
    ['No line matches this search.', 'No line matches this search.', 'Nothing matches that search.'],
    ['冇行符合今次搜尋。', '冇行符合今次搜尋。', '搵唔到符合嘅行。']
  ),
  'downloader.log.showing': t3(
    [
      'Showing the most recent {shown} of {matching} matching lines ({total} in the log).',
      'Showing the most recent {shown} of {matching} matching lines ({total} in the log).',
      'Showing the newest {shown} of {matching} matching lines ({total} in the log altogether).'
    ],
    [
      '顯示緊最新 {shown} 行，符合嘅有 {matching} 行（記錄總共 {total} 行）。',
      '顯示緊最新 {shown} 行，符合嘅有 {matching} 行（記錄總共 {total} 行）。',
      '而家見到最新嗰 {shown} 行，符合嘅一共 {matching} 行（成個記錄 {total} 行）。'
    ]
  ),
  'downloader.log.showMore': t3(
    ['Show more lines', 'Show more lines', 'Show more lines'],
    ['顯示多啲行', '顯示多啲行', '再多睇幾行']
  ),
  'downloader.log.dropped': t3(
    [
      '{count} of the oldest lines were dropped to stay within the retained-line limit.',
      '{count} of the oldest lines were dropped to stay within the retained-line limit.',
      'The {count} oldest lines fell off the end to keep within the retained-line limit.'
    ],
    [
      '為咗唔超過保留行數上限，最舊嗰 {count} 行已經丟棄。',
      '為咗唔超過保留行數上限，最舊嗰 {count} 行已經丟棄。',
      '為咗唔爆保留行數上限，最舊嗰 {count} 行跌咗出去。'
    ]
  ),
  'downloader.log.autoScroll': t3(
    ['Follow new lines', 'Follow new lines', 'Follow new lines'],
    ['跟住新行', '跟住新行', '跟住新行落去']
  ),
  'downloader.log.severity.error': t3(['Errors', 'Errors', 'Errors'], ['錯誤', '錯誤', '錯誤']),
  'downloader.log.severity.warning': t3(['Warnings', 'Warnings', 'Warnings'], ['警告', '警告', '警告']),
  'downloader.log.severity.notice': t3(['Notices', 'Notices', 'Notices'], ['提示', '提示', '提示']),
  'downloader.log.severity.info': t3(['Information', 'Information', 'Everything else'], ['資訊', '資訊', '其餘全部']),
  'downloader.log.severityFilter': t3(
    ['Severity', 'Severity', 'Severity'],
    ['嚴重程度', '嚴重程度', '嚴重程度']
  ),
  'downloader.log.stream.stdout': t3(['Output', 'Output', 'Output'], ['輸出', '輸出', '輸出']),
  'downloader.log.stream.stderr': t3(['Error output', 'Error output', 'Error output'], ['錯誤輸出', '錯誤輸出', '錯誤輸出']),
  'downloader.log.stream.app': t3(
    ['Added by this application', 'Added by this application', 'Added by this application'],
    ['本應用加入', '本應用加入', '本應用自己加嘅']
  ),
  'downloader.log.selection': t3(
    ['{count} of {total} lines selected', '{count} of {total} lines selected', '{count} of {total} lines selected'],
    ['已揀 {count} / {total} 行', '已揀 {count} / {total} 行', '揀咗 {count} / {total} 行']
  ),
  'downloader.log.copied': t3(
    ['{count} lines are on the clipboard.', '{count} lines are on the clipboard.', '{count} lines copied.'],
    ['{count} 行已經複製咗。', '{count} 行已經複製咗。', '複製咗 {count} 行。']
  ),
  'downloader.log.deleted': t3(
    ['{count} lines were removed from the list.', '{count} lines were removed from the list.', '{count} lines gone from the list.'],
    ['由張單度移除咗 {count} 行。', '由張單度移除咗 {count} 行。', '張單度少咗 {count} 行。']
  ),

  /* ---------------- world and scanning ---------------- */
  'downloader.world.missing': t3(
    [
      'The output directory does not exist yet. It is created the first time the downloader writes a region.',
      'The output directory does not exist yet. It is created the first time the downloader writes a region.',
      'The output folder is not there yet. It appears the first time a region gets written.'
    ],
    [
      '輸出資料夾仲未存在。下載器第一次寫區域嗰陣就會整。',
      '輸出資料夾仲未存在。下載器第一次寫區域嗰陣就會整。',
      '輸出資料夾未出現。第一次寫區域嗰陣佢就會自己出嚟。'
    ]
  ),
  'downloader.world.deleteHint': t3(
    [
      'This application cannot delete a world folder: the privileged bridge has no delete capability, deliberately. Use the file manager to remove one.',
      'This application cannot delete a world folder: the privileged bridge has no delete capability, deliberately. Use the file manager to remove one.',
      'This application will not delete a world folder — the privileged bridge simply has no delete, on purpose. Do that one in the file manager.'
    ],
    [
      '本應用刪唔到世界資料夾：特權橋接刻意冇提供刪除能力。要刪就喺檔案總管度做。',
      '本應用刪唔到世界資料夾：特權橋接刻意冇提供刪除能力。要刪就喺檔案總管度做。',
      '本應用唔會刪世界資料夾——特權橋接根本刻意冇刪除呢樣嘢。要刪就自己喺檔案總管度郁手。'
    ]
  ),
  'downloader.scan.running': t3(
    ['Counting chunks: {done} of {total} region files read.', 'Counting chunks: {done} of {total} region files read.', 'Counting: {done} of {total} region files read.'],
    ['點算緊區塊：已讀 {done} / {total} 個區域檔。', '點算緊區塊：已讀 {done} / {total} 個區域檔。', '數緊：已讀 {done} / {total} 個區域檔。']
  ),
  'downloader.scan.cancelled': t3(
    ['Counting was stopped. The partial figure is shown and labelled as partial.', 'Counting was stopped. The partial figure is shown and labelled as partial.', 'Counting stopped. What is shown is partial, and says so.'],
    ['點算已停止。顯示嘅係部分數字，亦有標明。', '點算已停止。顯示嘅係部分數字，亦有標明。', '唔數住喇。而家見到嘅係部分數字，寫咗明。']
  ),
  'downloader.scan.nothing': t3(
    ['There are no region files to count yet.', 'There are no region files to count yet.', 'No region files to count yet.'],
    ['而家冇區域檔可以數。', '而家冇區域檔可以數。', '未有區域檔畀你數。']
  ),

  /* ---------------- exports ---------------- */
  'downloader.export.saved': t3(
    ['Written to {path}', 'Written to {path}', 'Written to {path}'],
    ['已寫入 {path}', '已寫入 {path}', '寫咗入 {path}']
  ),
  'downloader.export.cancelled': t3(
    ['Nothing was written.', 'Nothing was written.', 'Nothing was written.'],
    ['乜都冇寫低。', '乜都冇寫低。', '一個字都冇寫。']
  ),
  'downloader.export.format': t3(['Export format', 'Export format', 'Export format'], ['匯出格式', '匯出格式', '匯出用咩格式']),
  'downloader.export.losses': t3(
    [
      '{format} cannot carry these fields faithfully: {fields}',
      '{format} cannot carry these fields faithfully: {fields}',
      '{format} cannot carry these fields properly: {fields}'
    ],
    [
      '{format} 冇辦法完整保留呢啲欄位：{fields}',
      '{format} 冇辦法完整保留呢啲欄位：{fields}',
      '{format} 載唔起呢啲欄位：{fields}'
    ]
  ),

  /* ---------------- option group titles ---------------- */
  'downloader.group.connection': t3(['Connection', 'Connection', 'Connection'], ['連線', '連線', '連線']),
  'downloader.group.output': t3(['Output world', 'Output world', 'Output world'], ['輸出世界', '輸出世界', '出邊個世界']),
  'downloader.group.map': t3(['Map and rendering', 'Map and rendering', 'Map and rendering'], ['地圖同繪製', '地圖同繪製', '地圖同繪製']),
  'downloader.group.session': t3(['Session behaviour', 'Session behaviour', 'Session behaviour'], ['連線行為', '連線行為', '連線行為']),
  'downloader.group.containers': t3(['Containers', 'Containers', 'Containers'], ['容器', '容器', '容器']),
  'downloader.group.chat': t3(['Chat replies', 'Chat replies', 'Chat replies'], ['聊天回覆', '聊天回覆', '聊天回覆']),

  /* ---------------- option labels ---------------- */
  'downloader.option.serverHost': t3(['Server address', 'Server address', 'Server address'], ['伺服器位址', '伺服器位址', '伺服器位址']),
  'downloader.option.serverHost.description': t3(
    [
      'The remote server’s hostname or IP address, without a port. It is passed to the jar as --server, joined with the server port when that is not 25565.',
      'The remote server’s hostname or IP address, without a port. It is passed to the jar as --server, joined with the server port when that is not 25565.',
      'Where the real server lives — hostname or IP, no port. It becomes --server, with the port glued on when it is not 25565.'
    ],
    [
      '遠端伺服器嘅主機名或者 IP，唔使打埠號。會變成 jar 嘅 --server；伺服器埠唔係 25565 嗰陣會接埋落去。',
      '遠端伺服器嘅主機名或者 IP，唔使打埠號。會變成 jar 嘅 --server；伺服器埠唔係 25565 嗰陣會接埋落去。',
      '真正伺服器喺邊 — 主機名或者 IP，唔使埠號。佢會變 --server，埠唔係 25565 就會黐埋上去。'
    ]
  ),
  'downloader.option.serverPort': t3(['Server port', 'Server port', 'Server port'], ['伺服器埠', '伺服器埠', '伺服器埠']),
  'downloader.option.serverPort.description': t3(
    [
      'The remote server’s port. 25565 is the Minecraft default and is left off the command line; anything else is appended to --server as host:port.',
      'The remote server’s port. 25565 is the Minecraft default and is left off the command line; anything else is appended to --server as host:port.',
      'The remote port. 25565 is the default and stays off the command line; anything else rides along on --server as host:port.'
    ],
    [
      '遠端伺服器嘅埠。25565 係 Minecraft 預設，唔會出現喺命令行；其他數值會以 host:port 形式接落 --server。',
      '遠端伺服器嘅埠。25565 係 Minecraft 預設，唔會出現喺命令行；其他數值會以 host:port 形式接落 --server。',
      '遠端嘅埠。25565 係預設，唔會走上命令行；其他數就以 host:port 跟住 --server 一齊去。'
    ]
  ),
  'downloader.option.localPort': t3(['Local proxy port', 'Local proxy port', 'Local proxy port'], ['本機代理埠', '本機代理埠', '本機代理埠']),
  'downloader.option.localPort.description': t3(
    [
      'The port the downloader listens on. Your Minecraft client connects to localhost on this port instead of the real server. Passed as --local-port.',
      'The port the downloader listens on. Your Minecraft client connects to localhost on this port instead of the real server. Passed as --local-port.',
      'The port the downloader sits on. Your client connects to localhost here instead of the real server. It becomes --local-port.'
    ],
    [
      '下載器監聽嘅埠。你嘅 Minecraft client 要駁去 localhost 呢個埠，唔好直接駁真伺服器。會變成 --local-port。',
      '下載器監聽嘅埠。你嘅 Minecraft client 要駁去 localhost 呢個埠，唔好直接駁真伺服器。會變成 --local-port。',
      '下載器坐緊嘅埠。你部 client 要駁呢度嘅 localhost，唔係駁真伺服器。佢會變 --local-port。'
    ]
  ),
  'downloader.option.disableSrvLookup': t3(
    ['Skip the DNS service-record lookup', 'Skip the DNS service-record lookup', 'Skip the DNS service-record lookup'],
    ['略過 DNS 服務記錄查詢', '略過 DNS 服務記錄查詢', '唔查 DNS 服務記錄']
  ),
  'downloader.option.disableSrvLookup.description': t3(
    [
      'By default the downloader looks up _minecraft._tcp records and follows them to the real host and port. Turn this on to connect to exactly the address you typed. Passed as --disable-srv-lookup.',
      'By default the downloader looks up _minecraft._tcp records and follows them to the real host and port. Turn this on to connect to exactly the address you typed. Passed as --disable-srv-lookup.',
      'Normally it checks _minecraft._tcp records and follows them wherever they point. Turn this on and it goes to exactly the address you typed. It becomes --disable-srv-lookup.'
    ],
    [
      '預設之下下載器會查 _minecraft._tcp 記錄，跟住去真正嘅主機同埠。開咗呢個就一定連你打嗰個位址。會變成 --disable-srv-lookup。',
      '預設之下下載器會查 _minecraft._tcp 記錄，跟住去真正嘅主機同埠。開咗呢個就一定連你打嗰個位址。會變成 --disable-srv-lookup。',
      '平時佢會查 _minecraft._tcp 記錄，指去邊就跟去邊。開咗呢個就淨係連你打嗰個位址。佢會變 --disable-srv-lookup。'
    ]
  ),
  'downloader.option.authMethod': t3(
    ['Authentication', 'Authentication', 'How to sign in'],
    ['驗證方式', '驗證方式', '點樣登入']
  ),
  'downloader.option.authMethod.description': t3(
    [
      'Automatic reads the account details the Minecraft launcher already stored on this machine. Microsoft uses the device-code flow, which prints a one-time code to approve in a browser and caches the session afterwards. An access token cannot be entered here: it would sit on the command line where any process listing could read it.',
      'Automatic reads the account details the Minecraft launcher already stored on this machine. Microsoft uses the device-code flow, which prints a one-time code to approve in a browser and caches the session afterwards. An access token cannot be entered here: it would sit on the command line where any process listing could read it.',
      'Automatic borrows what the Minecraft launcher already saved here. Microsoft does the device-code dance: a one-time code, a browser, and then a cached session. There is deliberately no box for an access token — it would end up on the command line for any process listing to read.'
    ],
    [
      '「自動」會讀 Minecraft launcher 已經喺呢部機儲低嘅帳號資料。「Microsoft」用裝置代碼流程，印一個一次性代碼畀你喺瀏覽器批准，之後會快取個 session。呢度冇得直接輸入 access token：因為咁樣個 token 會擺喺命令行，任何程序清單都讀到。',
      '「自動」會讀 Minecraft launcher 已經喺呢部機儲低嘅帳號資料。「Microsoft」用裝置代碼流程，印一個一次性代碼畀你喺瀏覽器批准，之後會快取個 session。呢度冇得直接輸入 access token：因為咁樣個 token 會擺喺命令行，任何程序清單都讀到。',
      '「自動」即係借用 launcher 已經儲低嘅嘢。「Microsoft」就行裝置代碼嗰套：一個一次性代碼、開瀏覽器批准，之後 session 有快取。呢度刻意冇 access token 格 — 因為佢會走上命令行，畀人喺程序清單度一眼睇晒。'
    ]
  ),
  'downloader.auth.automatic': t3(
    ['Automatic (use the launcher’s stored account)', 'Automatic (use the launcher’s stored account)', 'Automatic (borrow the launcher’s account)'],
    ['自動（用 launcher 儲低嘅帳號）', '自動（用 launcher 儲低嘅帳號）', '自動（借用 launcher 嗰個帳號）']
  ),
  'downloader.auth.microsoft': t3(
    ['Microsoft device-code sign-in', 'Microsoft device-code sign-in', 'Microsoft device-code sign-in'],
    ['Microsoft 裝置代碼登入', 'Microsoft 裝置代碼登入', 'Microsoft 裝置代碼登入']
  ),
  'downloader.option.username': t3(['Minecraft username', 'Minecraft username', 'Minecraft username'], ['Minecraft 用戶名', 'Minecraft 用戶名', 'Minecraft 用戶名']),
  'downloader.option.username.description': t3(
    [
      'Which stored launcher account to use, when more than one is present. Leave it empty to let the downloader choose. Passed as --username.',
      'Which stored launcher account to use, when more than one is present. Leave it empty to let the downloader choose. Passed as --username.',
      'Which of the launcher’s saved accounts to use when there is more than one. Leave it blank and the downloader picks. It becomes --username.'
    ],
    [
      'launcher 有多過一個帳號嗰陣，用邊一個。留空就等下載器自己揀。會變成 --username。',
      'launcher 有多過一個帳號嗰陣，用邊一個。留空就等下載器自己揀。會變成 --username。',
      'launcher 有幾個帳號嗰陣用邊個。留白就由下載器自己決定。佢會變 --username。'
    ]
  ),
  'downloader.option.msAuthCache': t3(
    ['Microsoft session cache file', 'Microsoft session cache file', 'Microsoft session cache file'],
    ['Microsoft session 快取檔', 'Microsoft session 快取檔', 'Microsoft session 快取檔']
  ),
  'downloader.option.msAuthCache.description': t3(
    [
      'Where the device-code session is cached so later launches do not ask again. Empty means cache/ms-auth.json beside the jar’s working directory. Passed as --ms-auth-cache.',
      'Where the device-code session is cached so later launches do not ask again. Empty means cache/ms-auth.json beside the jar’s working directory. Passed as --ms-auth-cache.',
      'Where the device-code session gets cached so it stops asking every launch. Empty means cache/ms-auth.json beside the jar’s working directory. It becomes --ms-auth-cache.'
    ],
    [
      '裝置代碼 session 快取喺邊，令之後啟動唔使再問。留空即係 jar 工作目錄下面嘅 cache/ms-auth.json。會變成 --ms-auth-cache。',
      '裝置代碼 session 快取喺邊，令之後啟動唔使再問。留空即係 jar 工作目錄下面嘅 cache/ms-auth.json。會變成 --ms-auth-cache。',
      '裝置代碼 session 快取放邊，唔使次次啟動都問。留空即係 jar 工作目錄嗰個 cache/ms-auth.json。佢會變 --ms-auth-cache。'
    ]
  ),
  'downloader.option.outputDir': t3(
    ['Output world directory', 'Output world directory', 'Where the world goes'],
    ['輸出世界資料夾', '輸出世界資料夾', '個世界擺去邊']
  ),
  'downloader.option.outputDir.description': t3(
    [
      'The directory the captured world is written to. An existing world there is updated and merged rather than replaced. Passed as --output.',
      'The directory the captured world is written to. An existing world there is updated and merged rather than replaced. Passed as --output.',
      'Where the captured world lands. If a world is already there it gets merged into, not overwritten. It becomes --output.'
    ],
    [
      '擷取到嘅世界會寫入嘅資料夾。如果嗰度已經有世界，係更新合併而唔係取代。會變成 --output。',
      '擷取到嘅世界會寫入嘅資料夾。如果嗰度已經有世界，係更新合併而唔係取代。會變成 --output。',
      '捉返嚟嘅世界會擺喺呢度。如果嗰度本身有個世界，佢會合併入去，唔會蓋走。佢會變 --output。'
    ]
  ),
  'downloader.option.centerX': t3(['Centre X', 'Centre X', 'Centre X'], ['中心 X', '中心 X', '中心 X']),
  'downloader.option.centerX.description': t3(
    [
      'Offsets the saved world so this X coordinate becomes world origin. The jar rounds it down to a multiple of 512 blocks. Emitted with the centre Z value, because the jar requires both together.',
      'Offsets the saved world so this X coordinate becomes world origin. The jar rounds it down to a multiple of 512 blocks. Emitted with the centre Z value, because the jar requires both together.',
      'Shifts the saved world so this X lands on the origin. The jar rounds it down to a multiple of 512. It always travels with centre Z, because the jar insists on the pair.'
    ],
    [
      '將儲低嘅世界偏移，令呢個 X 座標變成世界原點。jar 會向下取整到 512 格嘅倍數。因為 jar 要求成對出現，所以會同中心 Z 一齊送出。',
      '將儲低嘅世界偏移，令呢個 X 座標變成世界原點。jar 會向下取整到 512 格嘅倍數。因為 jar 要求成對出現，所以會同中心 Z 一齊送出。',
      '將世界推位，令呢個 X 坐正原點。jar 會向下取整到 512 嘅倍數。佢一定同中心 Z 孖住去，因為 jar 唔收單身嘅。'
    ]
  ),
  'downloader.option.centerZ': t3(['Centre Z', 'Centre Z', 'Centre Z'], ['中心 Z', '中心 Z', '中心 Z']),
  'downloader.option.centerZ.description': t3(
    [
      'The Z half of the world-centre offset. It is emitted together with centre X; leaving both at 0 leaves the world uncentred.',
      'The Z half of the world-centre offset. It is emitted together with centre X; leaving both at 0 leaves the world uncentred.',
      'The Z half of the centring offset. It goes out with centre X; leave both at 0 and the world is not shifted at all.'
    ],
    [
      '世界中心偏移嘅 Z 部分。會同中心 X 一齊送出；兩個都係 0 就唔會偏移。',
      '世界中心偏移嘅 Z 部分。會同中心 X 一齊送出；兩個都係 0 就唔會偏移。',
      '中心偏移嘅 Z 嗰半。同中心 X 一齊出；兩個都留 0 就完全唔會郁。'
    ]
  ),
  'downloader.option.levelSeed': t3(['Level seed', 'Level seed', 'Level seed'], ['世界種子', '世界種子', '世界種子']),
  'downloader.option.levelSeed.description': t3(
    [
      'The numeric seed written into the saved world’s level data. It does not change what is captured; it changes what Minecraft generates around the captured chunks. Passed as --seed.',
      'The numeric seed written into the saved world’s level data. It does not change what is captured; it changes what Minecraft generates around the captured chunks. Passed as --seed.',
      'The number written into the saved world’s level data. It changes nothing about what is captured — only what Minecraft grows around it later. It becomes --seed.'
    ],
    [
      '寫入儲低世界 level 資料嘅數字種子。佢唔會影響擷取到咩，只影響 Minecraft 之後喺周圍生成咩。會變成 --seed。',
      '寫入儲低世界 level 資料嘅數字種子。佢唔會影響擷取到咩，只影響 Minecraft 之後喺周圍生成咩。會變成 --seed。',
      '寫入 level 資料嗰個數字。佢一啲都唔影響你捉到咩，淨係影響 Minecraft 之後喺隔籬生咩出嚟。佢會變 --seed。'
    ]
  ),
  'downloader.option.disableChunkSaving': t3(
    ['Do not write chunks to disk', 'Do not write chunks to disk', 'Do not write chunks to disk']
    ,
    ['唔好將區塊寫落硬碟', '唔好將區塊寫落硬碟', '唔好寫區塊落硬碟']
  ),
  'downloader.option.disableChunkSaving.description': t3(
    [
      'Parses chunks without saving them, which is a debugging mode: nothing at all is written to the output world while this is on. Passed as --disable-chunk-saving.',
      'Parses chunks without saving them, which is a debugging mode: nothing at all is written to the output world while this is on. Passed as --disable-chunk-saving.',
      'Parses chunks and then throws them away — a debugging mode. While this is on, the output world gets nothing whatsoever. It becomes --disable-chunk-saving.'
    ],
    [
      '解析區塊但唔儲存，係除錯模式：開住嘅時候輸出世界一個字都唔會寫。會變成 --disable-chunk-saving。',
      '解析區塊但唔儲存，係除錯模式：開住嘅時候輸出世界一個字都唔會寫。會變成 --disable-chunk-saving。',
      '解析完就掉，係除錯用嘅。開住嗰陣輸出世界乜都唔會有。佢會變 --disable-chunk-saving。'
    ]
  ),
  'downloader.option.disableWorldGen': t3(
    ['Stop Minecraft generating new terrain', 'Stop Minecraft generating new terrain', 'Stop Minecraft generating new terrain'],
    ['唔好等 Minecraft 生成新地形', '唔好等 Minecraft 生成新地形', '唔好畀 Minecraft 生新地形']
  ),
  'downloader.option.disableWorldGen.description': t3(
    [
      'Writes the saved world as a superflat void, so opening it in Minecraft does not generate terrain around the captured chunks. Passed as --disable-world-gen.',
      'Writes the saved world as a superflat void, so opening it in Minecraft does not generate terrain around the captured chunks. Passed as --disable-world-gen.',
      'Marks the saved world as a superflat void, so Minecraft does not grow fresh terrain around what you captured. It becomes --disable-world-gen.'
    ],
    [
      '將儲低嘅世界寫成超平坦虛空，咁喺 Minecraft 打開嗰陣就唔會喺擷取區塊周圍生地形。會變成 --disable-world-gen。',
      '將儲低嘅世界寫成超平坦虛空，咁喺 Minecraft 打開嗰陣就唔會喺擷取區塊周圍生地形。會變成 --disable-world-gen。',
      '將世界寫成超平坦虛空，Minecraft 就唔會喺你捉返嚟嘅嘢隔籬生新地形。佢會變 --disable-world-gen。'
    ]
  ),
  'downloader.option.ignoreBlockChanges': t3(
    ['Ignore block changes after a chunk loads', 'Ignore block changes after a chunk loads', 'Ignore block changes after a chunk loads'],
    ['區塊載入後唔理方塊變化', '區塊載入後唔理方塊變化', '區塊入咗之後唔理方塊點變']
  ),
  'downloader.option.ignoreBlockChanges.description': t3(
    [
      'Keeps each chunk as it was first received, ignoring later block updates. Useful when other players are actively changing the world you are capturing. Passed as --ignore-block-changes.',
      'Keeps each chunk as it was first received, ignoring later block updates. Useful when other players are actively changing the world you are capturing. Passed as --ignore-block-changes.',
      'Freezes each chunk as first received and ignores later block updates — handy when other players are busy rearranging the place. It becomes --ignore-block-changes.'
    ],
    [
      '每個區塊保持第一次收到嗰個樣，唔理之後嘅方塊更新。你擷取緊嘅世界有人一路改嗰陣好有用。會變成 --ignore-block-changes。',
      '每個區塊保持第一次收到嗰個樣，唔理之後嘅方塊更新。你擷取緊嘅世界有人一路改嗰陣好有用。會變成 --ignore-block-changes。',
      '每個區塊定格喺第一次收到嗰刻，之後點變都唔理 — 有人喺度亂咁改嗰陣幾好用。佢會變 --ignore-block-changes。'
    ]
  ),
  'downloader.option.renderMap': t3(
    ['Render the overview map', 'Render the overview map', 'Render the overview map']
    ,
    ['繪製總覽地圖', '繪製總覽地圖', '整埋張總覽地圖']
  ),
  'downloader.option.renderMap.description': t3(
    [
      'Writes PNG region tiles and a status file under <output>/overview. That status file is where this surface reads the live player position and dimension from, so turning it off leaves both blank. Passed as --render-map, or --disable-map-render when off.',
      'Writes PNG region tiles and a status file under <output>/overview. That status file is where this surface reads the live player position and dimension from, so turning it off leaves both blank. Passed as --render-map, or --disable-map-render when off.',
      'Writes PNG tiles and a status file under <output>/overview. That status file is exactly where the live player position and dimension above come from, so switching it off leaves both blank. It becomes --render-map, or --disable-map-render when off.'
    ],
    [
      '喺 <output>/overview 下面寫 PNG 區域圖磚同一個狀態檔。上面嘅即時玩家座標同維度就係由嗰個狀態檔讀返嚟，所以閂咗兩樣都會空白。開就係 --render-map，閂就係 --disable-map-render。',
      '喺 <output>/overview 下面寫 PNG 區域圖磚同一個狀態檔。上面嘅即時玩家座標同維度就係由嗰個狀態檔讀返嚟，所以閂咗兩樣都會空白。開就係 --render-map，閂就係 --disable-map-render。',
      '喺 <output>/overview 度寫 PNG 圖磚同一個狀態檔。上面嗰個即時座標同維度正正就係讀嗰個檔，閂咗就兩樣都空白。開就 --render-map，閂就 --disable-map-render。'
    ]
  ),
  'downloader.option.showJavaWindow': t3(
    ['Open the downloader’s own map window', 'Open the downloader’s own map window', 'Open the downloader’s own map window'],
    ['開下載器自己嘅地圖視窗', '開下載器自己嘅地圖視窗', '開埋下載器自己嗰個地圖視窗']
  ),
  'downloader.option.showJavaWindow.description': t3(
    [
      'The Java downloader ships its own JavaFX map window. Leaving this off runs it headless, which is what --no-gui does, and is the normal choice when this application is showing the status. Turning it on opens a second, separate window owned by the Java process.',
      'The Java downloader ships its own JavaFX map window. Leaving this off runs it headless, which is what --no-gui does, and is the normal choice when this application is showing the status. Turning it on opens a second, separate window owned by the Java process.',
      'The Java downloader has its own JavaFX map window. Leave this off and it runs headless — that is --no-gui — which is the sensible choice while this application is showing the status. Turn it on and the Java process opens a second window of its own.'
    ],
    [
      'Java 下載器自己有個 JavaFX 地圖視窗。唔開就係無介面行（即係 --no-gui），本應用喺度顯示狀態嗰陣通常都咁做。開咗就會多一個由 Java 程序自己擁有嘅視窗。',
      'Java 下載器自己有個 JavaFX 地圖視窗。唔開就係無介面行（即係 --no-gui），本應用喺度顯示狀態嗰陣通常都咁做。開咗就會多一個由 Java 程序自己擁有嘅視窗。',
      'Java 下載器自己都有個 JavaFX 地圖視窗。唔開就無介面行（即 --no-gui），本應用幫你睇住狀態嗰陣咁樣最順。開咗就會彈多個由 Java 程序自己話事嘅視窗。'
    ]
  ),
  'downloader.option.guiTheme': t3(
    ['Map window theme', 'Map window theme', 'Map window theme'],
    ['地圖視窗主題', '地圖視窗主題', '地圖視窗主題']
  ),
  'downloader.option.guiTheme.description': t3(
    [
      'The theme of the Java downloader’s own map window. It has no effect on this application’s appearance, which is set in the appearance settings. Passed as --gui-theme.',
      'The theme of the Java downloader’s own map window. It has no effect on this application’s appearance, which is set in the appearance settings. Passed as --gui-theme.',
      'The theme of the Java downloader’s own window. It does nothing to this application’s own look, which lives in the appearance settings. It becomes --gui-theme.'
    ],
    [
      'Java 下載器自己嗰個地圖視窗嘅主題。同本應用嘅外觀無關，本應用喺外觀設定度改。會變成 --gui-theme。',
      'Java 下載器自己嗰個地圖視窗嘅主題。同本應用嘅外觀無關，本應用喺外觀設定度改。會變成 --gui-theme。',
      'Java 下載器自己嗰個視窗嘅主題。同本應用個樣冇關，本應用嘅樣喺外觀設定度改。佢會變 --gui-theme。'
    ]
  ),
  'downloader.guiTheme.dark': t3(['Dark', 'Dark', 'Dark'], ['深色', '深色', '深色']),
  'downloader.guiTheme.light': t3(['Light', 'Light', 'Light'], ['淺色', '淺色', '淺色']),
  'downloader.guiTheme.contrast': t3(['High contrast', 'High contrast', 'High contrast'], ['高對比', '高對比', '高對比']),
  'downloader.option.extendedRenderDistance': t3(
    ['Extended render distance', 'Extended render distance', 'Extended render distance'],
    ['延伸渲染距離', '延伸渲染距離', '延伸渲染距離']
  ),
  'downloader.option.extendedRenderDistance.description': t3(
    [
      'Re-sends already-downloaded chunks to your client so you can see further than the server allows. 0 leaves the server’s own distance alone. Passed as --extended-render-distance.',
      'Re-sends already-downloaded chunks to your client so you can see further than the server allows. 0 leaves the server’s own distance alone. Passed as --extended-render-distance.',
      'Feeds already-downloaded chunks back to your client so you can see further than the server would let you. 0 leaves the server’s own distance be. It becomes --extended-render-distance.'
    ],
    [
      '將已經下載咗嘅區塊重新送返畀你嘅 client，等你睇得比伺服器容許嘅更遠。0 即係唔郁伺服器本身嘅距離。會變成 --extended-render-distance。',
      '將已經下載咗嘅區塊重新送返畀你嘅 client，等你睇得比伺服器容許嘅更遠。0 即係唔郁伺服器本身嘅距離。會變成 --extended-render-distance。',
      '將下載咗嘅區塊翻兜返畀你部 client，等你睇得遠過伺服器畀你睇。0 就即係唔郁佢。佢會變 --extended-render-distance。'
    ]
  ),
  'downloader.option.extendedRenderPace': t3(
    ['Pause between re-sent chunks', 'Pause between re-sent chunks', 'Pause between re-sent chunks'],
    ['重送區塊之間嘅暫停', '重送區塊之間嘅暫停', '重送區塊中間停幾耐']
  ),
  'downloader.option.extendedRenderPace.description': t3(
    [
      'Milliseconds between each re-sent chunk. Lower fills the view faster and can stutter; higher is smoother and slower. The jar’s own default is 6. Passed as --extended-render-pace.',
      'Milliseconds between each re-sent chunk. Lower fills the view faster and can stutter; higher is smoother and slower. The jar’s own default is 6. Passed as --extended-render-pace.',
      'Milliseconds between re-sent chunks. Lower fills the view quicker and can stutter; higher is smoother and slower. The jar’s own default is 6. It becomes --extended-render-pace.'
    ],
    [
      '每個重送區塊之間相隔幾多毫秒。細啲就填得快但可能會頓，大啲就順啲但慢啲。jar 本身預設係 6。會變成 --extended-render-pace。',
      '每個重送區塊之間相隔幾多毫秒。細啲就填得快但可能會頓，大啲就順啲但慢啲。jar 本身預設係 6。會變成 --extended-render-pace。',
      '重送區塊之間相隔幾多毫秒。細啲填得快但會頓下頓下，大啲順滑但慢。jar 預設係 6。佢會變 --extended-render-pace。'
    ]
  ),
  'downloader.option.drawExtendedChunks': t3(
    ['Draw extended chunks on the map', 'Draw extended chunks on the map', 'Draw extended chunks on the map'],
    ['喺地圖畫埋延伸區塊', '喺地圖畫埋延伸區塊', '地圖度畫埋延伸區塊']
  ),
  'downloader.option.drawExtendedChunks.description': t3(
    [
      'Shows the re-sent extended chunks on the overview map as well, rather than only the chunks the server sent. Passed as --draw-extended-chunks.',
      'Shows the re-sent extended chunks on the overview map as well, rather than only the chunks the server sent. Passed as --draw-extended-chunks.',
      'Puts the re-sent extended chunks on the overview map too, instead of only what the server actually sent. It becomes --draw-extended-chunks.'
    ],
    [
      '連重送嘅延伸區塊都畫埋喺總覽地圖，唔淨係畫伺服器送嗰啲。會變成 --draw-extended-chunks。',
      '連重送嘅延伸區塊都畫埋喺總覽地圖，唔淨係畫伺服器送嗰啲。會變成 --draw-extended-chunks。',
      '將重送嘅延伸區塊都畫埋落總覽地圖，唔止畫伺服器真係送嗰啲。佢會變 --draw-extended-chunks。'
    ]
  ),
  'downloader.option.markNewChunks': t3(
    ['Outline newly seen chunks', 'Outline newly seen chunks', 'Outline newly seen chunks'],
    ['標示新見到嘅區塊', '標示新見到嘅區塊', '幫新見到嘅區塊畫個框']
  ),
  'downloader.option.markNewChunks.description': t3(
    [
      'Draws an orange outline around partially-sent chunks on the map. It changes what the map shows, not what is saved. Passed as --mark-new-chunks.',
      'Draws an orange outline around partially-sent chunks on the map. It changes what the map shows, not what is saved. Passed as --mark-new-chunks.',
      'Puts an orange outline round partially-sent chunks on the map. It changes the picture, never the saved data. It becomes --mark-new-chunks.'
    ],
    [
      '喺地圖上面幫部分傳送嘅區塊畫橙色邊框。佢只改地圖顯示，唔改儲低咗嘅嘢。會變成 --mark-new-chunks。',
      '喺地圖上面幫部分傳送嘅區塊畫橙色邊框。佢只改地圖顯示，唔改儲低咗嘅嘢。會變成 --mark-new-chunks。',
      '喺地圖幫嗰啲淨係傳咗一部分嘅區塊畫個橙框。淨係改張圖，唔會改儲低嘅資料。佢會變 --mark-new-chunks。'
    ]
  ),
  'downloader.option.disableMarkUnsaved': t3(
    ['Stop marking unsaved chunks in red', 'Stop marking unsaved chunks in red', 'Stop marking unsaved chunks in red'],
    ['唔好用紅色標示未儲存區塊', '唔好用紅色標示未儲存區塊', '唔好再用紅色標未儲存嘅區塊']
  ),
  'downloader.option.disableMarkUnsaved.description': t3(
    [
      'By default the map tints chunks that are captured but not yet flushed to disk. Turn this on to leave them untinted. Passed as --disable-mark-unsaved.',
      'By default the map tints chunks that are captured but not yet flushed to disk. Turn this on to leave them untinted. Passed as --disable-mark-unsaved.',
      'Normally the map tints chunks that are captured but not yet on disk. Turn this on and they look like everything else. It becomes --disable-mark-unsaved.'
    ],
    [
      '預設之下地圖會將擷取咗但未寫落硬碟嘅區塊上色。開咗呢個就唔上色。會變成 --disable-mark-unsaved。',
      '預設之下地圖會將擷取咗但未寫落硬碟嘅區塊上色。開咗呢個就唔上色。會變成 --disable-mark-unsaved。',
      '平時地圖會幫捉咗但未落地嘅區塊上色。開咗呢個佢哋就同其他一模一樣。佢會變 --disable-mark-unsaved。'
    ]
  ),
  'downloader.option.renderPlayers': t3(
    ['Show other players on the map', 'Show other players on the map', 'Show other players on the map'],
    ['喺地圖顯示其他玩家', '喺地圖顯示其他玩家', '地圖度顯示埋其他玩家']
  ),
  'downloader.option.renderPlayers.description': t3(
    [
      'Draws other players the server tells your client about onto the overview map. Passed as --render-players.',
      'Draws other players the server tells your client about onto the overview map. Passed as --render-players.',
      'Draws whoever the server tells your client about onto the overview map. It becomes --render-players.'
    ],
    [
      '將伺服器話畀你 client 知嘅其他玩家畫上總覽地圖。會變成 --render-players。',
      '將伺服器話畀你 client 知嘅其他玩家畫上總覽地圖。會變成 --render-players。',
      '伺服器話畀你部 client 知邊個喺度，就畫上總覽地圖。佢會變 --render-players。'
    ]
  ),
  'downloader.option.caveMode': t3(
    ['Switch to cave rendering underground', 'Switch to cave rendering underground', 'Switch to cave rendering underground'],
    ['喺地底自動切換洞穴繪製', '喺地底自動切換洞穴繪製', '落到地底就轉洞穴繪製']
  ),
  'downloader.option.caveMode.description': t3(
    [
      'Automatically changes the map to a cave view when the player is underground. Passed as --enable-cave-mode.',
      'Automatically changes the map to a cave view when the player is underground. Passed as --enable-cave-mode.',
      'Flips the map to a cave view whenever the player is underground. It becomes --enable-cave-mode.'
    ],
    [
      '玩家去到地底嗰陣自動將地圖轉做洞穴視圖。會變成 --enable-cave-mode。',
      '玩家去到地底嗰陣自動將地圖轉做洞穴視圖。會變成 --enable-cave-mode。',
      '一落到地底就將地圖轉洞穴視圖。佢會變 --enable-cave-mode。'
    ]
  ),
  'downloader.option.moddedBlockColors': t3(
    ['Colour modded blocks on the map', 'Colour modded blocks on the map', 'Colour modded blocks on the map'],
    ['地圖上為模組方塊上色', '地圖上為模組方塊上色', '幫模組方塊喺地圖上色']
  ),
  'downloader.option.moddedBlockColors.description': t3(
    [
      'Extracts texture colours from mod jars in the Minecraft mods folder so non-vanilla blocks are drawn rather than left transparent. The jar has this on by default; turning it off passes --disable-modded-block-colors.',
      'Extracts texture colours from mod jars in the Minecraft mods folder so non-vanilla blocks are drawn rather than left transparent. The jar has this on by default; turning it off passes --disable-modded-block-colors.',
      'Digs texture colours out of the mod jars in the Minecraft mods folder so modded blocks are drawn instead of left transparent. The jar has this on by default; turn it off and --disable-modded-block-colors goes out.'
    ],
    [
      '由 Minecraft mods 資料夾入面嘅模組 jar 抽材質顏色，等非原版方塊有得畫而唔係透明。jar 預設係開嘅；閂咗就會送 --disable-modded-block-colors。',
      '由 Minecraft mods 資料夾入面嘅模組 jar 抽材質顏色，等非原版方塊有得畫而唔係透明。jar 預設係開嘅；閂咗就會送 --disable-modded-block-colors。',
      '喺 Minecraft mods 資料夾啲模組 jar 度挖材質顏色出嚟，令模組方塊有色唔係透明。jar 預設開；閂咗就會出 --disable-modded-block-colors。'
    ]
  ),
  'downloader.option.disableMessages': t3(
    ['Quiet the in-game info messages', 'Quiet the in-game info messages', 'Quiet the in-game info messages'],
    ['靜音遊戲內資訊訊息', '靜音遊戲內資訊訊息', '收聲，唔好再彈遊戲內訊息']
  ),
  'downloader.option.disableMessages.description': t3(
    [
      'Stops the downloader sending its own status messages, such as container-saved notices, to your client’s action bar. Passed as --disable-messages.',
      'Stops the downloader sending its own status messages, such as container-saved notices, to your client’s action bar. Passed as --disable-messages.',
      'Stops the downloader piping its own notices — such as “container saved” — into your client’s action bar. It becomes --disable-messages.'
    ],
    [
      '唔再將下載器自己嘅狀態訊息（例如容器已儲存嘅提示）送去你 client 嘅動作列。會變成 --disable-messages。',
      '唔再將下載器自己嘅狀態訊息（例如容器已儲存嘅提示）送去你 client 嘅動作列。會變成 --disable-messages。',
      '唔好再將下載器自己啲提示（好似「容器已儲存」）塞入你 client 嘅動作列。佢會變 --disable-messages。'
    ]
  ),
  'downloader.option.voiceProxy': t3(
    ['Proxy Simple Voice Chat traffic', 'Proxy Simple Voice Chat traffic', 'Proxy Simple Voice Chat traffic'],
    ['代理 Simple Voice Chat 流量', '代理 Simple Voice Chat 流量', '幫 Simple Voice Chat 都做代理']
  ),
  'downloader.option.voiceProxy.description': t3(
    [
      'Transparently forwards Simple Voice Chat and PlasmoVoice UDP traffic through the proxy so voice keeps working while you are connected through it. Passed as --enable-voice-proxy.',
      'Transparently forwards Simple Voice Chat and PlasmoVoice UDP traffic through the proxy so voice keeps working while you are connected through it. Passed as --enable-voice-proxy.',
      'Quietly forwards Simple Voice Chat and PlasmoVoice UDP through the proxy so voice keeps working while you are behind it. It becomes --enable-voice-proxy.'
    ],
    [
      '透明咁將 Simple Voice Chat 同 PlasmoVoice 嘅 UDP 流量經代理轉送，等你經代理連線嗰陣語音照用。會變成 --enable-voice-proxy。',
      '透明咁將 Simple Voice Chat 同 PlasmoVoice 嘅 UDP 流量經代理轉送，等你經代理連線嗰陣語音照用。會變成 --enable-voice-proxy。',
      '靜靜雞將 Simple Voice Chat 同 PlasmoVoice 嘅 UDP 經代理轉送，等你收埋喺代理後面都傾到偈。佢會變 --enable-voice-proxy。'
    ]
  ),
  'downloader.option.autoOpen': t3(
    ['Open nearby containers automatically', 'Open nearby containers automatically', 'Open nearby containers automatically'],
    ['自動開附近容器', '自動開附近容器', '自動幫你開附近啲容器']
  ),
  'downloader.option.autoOpen.description': t3(
    [
      'Experimental. Opens containers within survival reach, one at a time and rate-limited, so their contents are recorded as you move. It sends real interactions to the server and may trip anti-cheat. Passed as --auto-open-containers.',
      'Experimental. Opens containers within survival reach, one at a time and rate-limited, so their contents are recorded as you move. It sends real interactions to the server and may trip anti-cheat. Passed as --auto-open-containers.',
      'Experimental. Opens containers within survival reach, one at a time and rate-limited, so their contents get recorded as you walk. These are real interactions sent to the server and they may trip anti-cheat. It becomes --auto-open-containers.'
    ],
    [
      '實驗功能。喺生存模式伸手範圍內逐個、有速率限制咁開容器，等你行過就記低內容。佢會向伺服器發真實互動，可能會觸發反作弊。會變成 --auto-open-containers。',
      '實驗功能。喺生存模式伸手範圍內逐個、有速率限制咁開容器，等你行過就記低內容。佢會向伺服器發真實互動，可能會觸發反作弊。會變成 --auto-open-containers。',
      '實驗功能。喺生存伸手範圍內逐個慢慢開容器，等你行過就記低入面有咩。呢啲係真互動，係會撞到反作弊嘅。佢會變 --auto-open-containers。'
    ]
  ),
  'downloader.option.autoOpenDelay': t3(
    ['Delay between automatic opens', 'Delay between automatic opens', 'Delay between automatic opens'],
    ['自動開啟之間嘅延遲', '自動開啟之間嘅延遲', '每次自動開之間等幾耐']
  ),
  'downloader.option.autoOpenDelay.description': t3(
    [
      'Minimum milliseconds between two automatically opened containers. Higher is slower and less likely to look unusual to a server. The jar’s own default is 400. Passed as --auto-open-delay.',
      'Minimum milliseconds between two automatically opened containers. Higher is slower and less likely to look unusual to a server. The jar’s own default is 400. Passed as --auto-open-delay.',
      'Least milliseconds between two automatic opens. Higher is slower and looks less odd to a server. The jar’s own default is 400. It becomes --auto-open-delay.'
    ],
    [
      '兩次自動開容器之間最少幾多毫秒。大啲就慢啲，喺伺服器眼中亦冇咁異常。jar 本身預設係 400。會變成 --auto-open-delay。',
      '兩次自動開容器之間最少幾多毫秒。大啲就慢啲，喺伺服器眼中亦冇咁異常。jar 本身預設係 400。會變成 --auto-open-delay。',
      '兩次自動開之間最少等幾多毫秒。大啲慢啲，喺伺服器眼中冇咁怪。jar 預設 400。佢會變 --auto-open-delay。'
    ]
  ),
  'downloader.option.autoOpenGamemodes': t3(
    ['Gamemodes the sweep runs in', 'Gamemodes the sweep runs in', 'Gamemodes the sweep runs in'],
    ['喺邊啲遊戲模式先掃', '喺邊啲遊戲模式先掃', '邊幾個模式先會掃']
  ),
  'downloader.option.autoOpenGamemodes.description': t3(
    [
      'Restricts automatic opening to particular gamemodes. A restricted choice only becomes active once that gamemode is actually observed. Passed as --auto-open-gamemodes.',
      'Restricts automatic opening to particular gamemodes. A restricted choice only becomes active once that gamemode is actually observed. Passed as --auto-open-gamemodes.',
      'Limits automatic opening to certain gamemodes. A limited choice only wakes up once that gamemode is actually seen. It becomes --auto-open-gamemodes.'
    ],
    [
      '限制自動開啟只喺指定遊戲模式先做。揀咗限制之後，要真係見到嗰個模式先會啟用。會變成 --auto-open-gamemodes。',
      '限制自動開啟只喺指定遊戲模式先做。揀咗限制之後，要真係見到嗰個模式先會啟用。會變成 --auto-open-gamemodes。',
      '淨係喺指定模式先自動開。揀咗限制之後，真係見到嗰個模式先會郁。佢會變 --auto-open-gamemodes。'
    ]
  ),
  'downloader.gamemode.all': t3(['Every gamemode', 'Every gamemode', 'Every gamemode'], ['所有模式', '所有模式', '全部模式']),
  'downloader.gamemode.survival': t3(['Survival only', 'Survival only', 'Survival only'], ['只限生存', '只限生存', '淨係生存']),
  'downloader.gamemode.creative': t3(['Creative only', 'Creative only', 'Creative only'], ['只限創造', '只限創造', '淨係創造']),
  'downloader.gamemode.adventure': t3(['Adventure only', 'Adventure only', 'Adventure only'], ['只限冒險', '只限冒險', '淨係冒險']),
  'downloader.gamemode.spectator': t3(['Spectator only', 'Spectator only', 'Spectator only'], ['只限旁觀', '只限旁觀', '淨係旁觀']),
  'downloader.gamemode.survivalCreative': t3(
    ['Survival and creative', 'Survival and creative', 'Survival and creative'],
    ['生存同創造', '生存同創造', '生存加創造']
  ),
  'downloader.gamemode.creativeSpectator': t3(
    ['Creative and spectator', 'Creative and spectator', 'Creative and spectator'],
    ['創造同旁觀', '創造同旁觀', '創造加旁觀']
  ),
  'downloader.option.autoOpenAllowChests': t3(
    ['Open chests even with players nearby', 'Open chests even with players nearby', 'Open chests even with players nearby'],
    ['附近有人都照開箱', '附近有人都照開箱', '隔籬有人都照開箱']
  ),
  'downloader.option.autoOpenAllowChests.description': t3(
    [
      'By default chests, trapped chests, barrels and shulker boxes are skipped while another player is within the nearby-player radius. Turning this on opens them anyway; other container types are always opened. Passed as --auto-open-allow-chest-near-players.',
      'By default chests, trapped chests, barrels and shulker boxes are skipped while another player is within the nearby-player radius. Turning this on opens them anyway; other container types are always opened. Passed as --auto-open-allow-chest-near-players.',
      'Normally chests, trapped chests, barrels and shulker boxes are left alone while somebody else is inside the nearby-player radius. Turn this on and they get opened regardless; every other container type is always opened anyway. It becomes --auto-open-allow-chest-near-players.'
    ],
    [
      '預設之下，只要附近玩家半徑內有其他玩家，箱、陷阱箱、木桶同界伏蚌盒都會略過。開咗呢個就照開；其他容器類型一向都會開。會變成 --auto-open-allow-chest-near-players。',
      '預設之下，只要附近玩家半徑內有其他玩家，箱、陷阱箱、木桶同界伏蚌盒都會略過。開咗呢個就照開；其他容器類型一向都會開。會變成 --auto-open-allow-chest-near-players。',
      '平時只要半徑內有第二個玩家，箱、陷阱箱、木桶同界伏蚌盒都唔會掂。開咗呢個就照開唔理；其他容器一向都照開。佢會變 --auto-open-allow-chest-near-players。'
    ]
  ),
  'downloader.option.autoOpenAllowTrapped': t3(
    ['Open trapped chests as well', 'Open trapped chests as well', 'Open trapped chests as well'],
    ['連陷阱箱都開埋', '連陷阱箱都開埋', '連陷阱箱都照開']
  ),
  'downloader.option.autoOpenAllowTrapped.description': t3(
    [
      'Trapped chests are skipped by default because opening one emits a redstone pulse that can trigger contraptions or alarms. Turning this on opens them; the nearby-player protection still applies to them. Passed as --auto-open-allow-trapped-chests.',
      'Trapped chests are skipped by default because opening one emits a redstone pulse that can trigger contraptions or alarms. Turning this on opens them; the nearby-player protection still applies to them. Passed as --auto-open-allow-trapped-chests.',
      'Trapped chests are left alone by default, because opening one sends a redstone pulse that can set off contraptions or alarms. Turn this on and they get opened; the nearby-player protection still covers them. It becomes --auto-open-allow-trapped-chests.'
    ],
    [
      '陷阱箱預設會略過，因為開佢會出紅石訊號，可能觸發裝置或者警報。開咗呢個就會開佢；附近玩家嘅保護對佢仍然有效。會變成 --auto-open-allow-trapped-chests。',
      '陷阱箱預設會略過，因為開佢會出紅石訊號，可能觸發裝置或者警報。開咗呢個就會開佢；附近玩家嘅保護對佢仍然有效。會變成 --auto-open-allow-trapped-chests。',
      '陷阱箱預設唔掂，因為一開就出紅石訊號，隨時著晒警報。開咗呢個就會開；不過附近有人嗰個保護照樣管住佢。佢會變 --auto-open-allow-trapped-chests。'
    ]
  ),
  'downloader.option.autoOpenPlayerRadius': t3(
    ['Nearby-player radius', 'Nearby-player radius', 'Nearby-player radius'],
    ['附近玩家半徑', '附近玩家半徑', '附近玩家半徑']
  ),
  'downloader.option.autoOpenPlayerRadius.description': t3(
    [
      'How far away another player still counts as nearby, in blocks, for the chest protection above. The jar’s own default is 100. Passed as --auto-open-player-radius.',
      'How far away another player still counts as nearby, in blocks, for the chest protection above. The jar’s own default is 100. Passed as --auto-open-player-radius.',
      'How far another player can be and still count as nearby, in blocks, for the chest protection above. The jar’s own default is 100. It becomes --auto-open-player-radius.'
    ],
    [
      '上面嗰個箱保護入面，其他玩家離幾遠仍然當作「附近」，以方格計。jar 本身預設係 100。會變成 --auto-open-player-radius。',
      '上面嗰個箱保護入面，其他玩家離幾遠仍然當作「附近」，以方格計。jar 本身預設係 100。會變成 --auto-open-player-radius。',
      '上面嗰個箱保護度，第二個玩家離幾遠都仍然算「附近」，以方格計。jar 預設 100。佢會變 --auto-open-player-radius。'
    ]
  ),
  'downloader.option.autoOpenStateFile': t3(
    ['Already-opened record file', 'Already-opened record file', 'Already-opened record file'],
    ['已開啟記錄檔', '已開啟記錄檔', '開過乜嘅記錄檔']
  ),
  'downloader.option.autoOpenStateFile.description': t3(
    [
      'Records which container blocks were already opened, so none is opened twice even across restarts. Empty means auto-open-attempted.txt beside the world folder. Passed as --auto-open-state.',
      'Records which container blocks were already opened, so none is opened twice even across restarts. Empty means auto-open-attempted.txt beside the world folder. Passed as --auto-open-state.',
      'Keeps track of which container blocks have already been opened, so none gets opened twice even after a restart. Empty means auto-open-attempted.txt beside the world folder. It becomes --auto-open-state.'
    ],
    [
      '記住邊啲容器方塊已經開過，就算重開都唔會開多次。留空即係世界資料夾隔籬嘅 auto-open-attempted.txt。會變成 --auto-open-state。',
      '記住邊啲容器方塊已經開過，就算重開都唔會開多次。留空即係世界資料夾隔籬嘅 auto-open-attempted.txt。會變成 --auto-open-state。',
      '記住邊啲容器開過，就算重開都唔會開多次。留空即係世界資料夾隔籬嗰個 auto-open-attempted.txt。佢會變 --auto-open-state。'
    ]
  ),
  'downloader.option.autoOpenLogFile': t3(
    ['Captured-items log file', 'Captured-items log file', 'Captured-items log file'],
    ['已擷取物品記錄檔', '已擷取物品記錄檔', '捉到咩嘢嘅記錄檔']
  ),
  'downloader.option.autoOpenLogFile.description': t3(
    [
      'Appends a readable list of the items captured by automatic opening. Empty means auto-open-items.log beside the world folder. Passed as --auto-open-log.',
      'Appends a readable list of the items captured by automatic opening. Empty means auto-open-items.log beside the world folder. Passed as --auto-open-log.',
      'Adds a readable list of whatever automatic opening captured. Empty means auto-open-items.log beside the world folder. It becomes --auto-open-log.'
    ],
    [
      '將自動開啟擷取到嘅物品，以可讀清單形式續寫落去。留空即係世界資料夾隔籬嘅 auto-open-items.log。會變成 --auto-open-log。',
      '將自動開啟擷取到嘅物品，以可讀清單形式續寫落去。留空即係世界資料夾隔籬嘅 auto-open-items.log。會變成 --auto-open-log。',
      '將自動開啟捉到嘅物品寫成可讀清單續落去。留空即係世界資料夾隔籬嗰個 auto-open-items.log。佢會變 --auto-open-log。'
    ]
  ),
  'downloader.option.containerMessageFormat': t3(
    ['Container message template', 'Container message template', 'Container message template'],
    ['容器訊息範本', '容器訊息範本', '容器訊息範本']
  ),
  'downloader.option.containerMessageFormat.description': t3(
    [
      'The action-bar message shown when a container is saved. {type}, {count}, {x}, {y} and {z} are replaced; anything else is printed literally. Passed as --container-message-format.',
      'The action-bar message shown when a container is saved. {type}, {count}, {x}, {y} and {z} are replaced; anything else is printed literally. Passed as --container-message-format.',
      'The action-bar message when a container is saved. {type}, {count}, {x}, {y} and {z} get replaced; anything else is printed exactly as typed. It becomes --container-message-format.'
    ],
    [
      '儲存容器嗰陣喺動作列顯示嘅訊息。{type}、{count}、{x}、{y}、{z} 會被取代；其他字會原樣印出。會變成 --container-message-format。',
      '儲存容器嗰陣喺動作列顯示嘅訊息。{type}、{count}、{x}、{y}、{z} 會被取代；其他字會原樣印出。會變成 --container-message-format。',
      '儲存容器嗰陣動作列顯示嘅訊息。{type}、{count}、{x}、{y}、{z} 會換走；其他字打乜出乜。佢會變 --container-message-format。'
    ]
  ),
  'downloader.option.autoReply': t3(
    ['Reply to matching chat automatically', 'Reply to matching chat automatically', 'Reply to matching chat automatically'],
    ['自動回覆符合嘅聊天', '自動回覆符合嘅聊天', '見到符合嘅聊天就自動回']
  ),
  'downloader.option.autoReply.description': t3(
    [
      'Experimental. When an incoming chat message’s trigger-coloured text matches the trigger phrase, the reply-coloured text from that same message is sent back as a real chat message. Servers enforcing secure chat may reject it. Passed as --auto-reply.',
      'Experimental. When an incoming chat message’s trigger-coloured text matches the trigger phrase, the reply-coloured text from that same message is sent back as a real chat message. Servers enforcing secure chat may reject it. Passed as --auto-reply.',
      'Experimental. When the trigger-coloured text of an incoming chat message matches the trigger phrase, the reply-coloured text from that same message goes back as a genuine chat message. Servers enforcing secure chat may throw it out. It becomes --auto-reply.'
    ],
    [
      '實驗功能。當收到嘅聊天訊息入面觸發顏色嗰段字同觸發字串一樣，就會將同一條訊息入面回覆顏色嗰段字，當真正聊天訊息咁送返出去。強制安全聊天嘅伺服器可能會拒收。會變成 --auto-reply。',
      '實驗功能。當收到嘅聊天訊息入面觸發顏色嗰段字同觸發字串一樣，就會將同一條訊息入面回覆顏色嗰段字，當真正聊天訊息咁送返出去。強制安全聊天嘅伺服器可能會拒收。會變成 --auto-reply。',
      '實驗功能。收到嘅聊天訊息入面，觸發顏色嗰段字啱咗，就將同一條訊息入面回覆顏色嗰段字當真聊天咁送返去。有安全聊天嘅伺服器可能唔收。佢會變 --auto-reply。'
    ]
  ),
  'downloader.option.autoReplyTrigger': t3(
    ['Trigger phrase', 'Trigger phrase', 'Trigger phrase'],
    ['觸發字串', '觸發字串', '觸發字串']
  ),
  'downloader.option.autoReplyTrigger.description': t3(
    [
      'The exact text, in the trigger colour, that causes a reply. Surrounding spaces and quotes are ignored. Automatic replies do nothing without one. Passed as --auto-reply-trigger.',
      'The exact text, in the trigger colour, that causes a reply. Surrounding spaces and quotes are ignored. Automatic replies do nothing without one. Passed as --auto-reply-trigger.',
      'The exact text, in the trigger colour, that sets off a reply. Spaces and quotes round it are ignored. Without one, automatic replies do precisely nothing. It becomes --auto-reply-trigger.'
    ],
    [
      '觸發顏色嗰段字要一模一樣先會回覆。前後嘅空格同引號會被忽略。冇呢個字串，自動回覆乜都唔會做。會變成 --auto-reply-trigger。',
      '觸發顏色嗰段字要一模一樣先會回覆。前後嘅空格同引號會被忽略。冇呢個字串，自動回覆乜都唔會做。會變成 --auto-reply-trigger。',
      '觸發顏色嗰段字要一字不差先會回。前後嘅空格同引號唔理。冇佢，自動回覆就係完全唔會郁。佢會變 --auto-reply-trigger。'
    ]
  ),
  'downloader.option.autoReplyTriggerColor': t3(
    ['Trigger text colour', 'Trigger text colour', 'Trigger text colour'],
    ['觸發文字顏色', '觸發文字顏色', '觸發文字顏色']
  ),
  'downloader.option.autoReplyTriggerColor.description': t3(
    [
      'Which Minecraft text colour the trigger phrase must be in. The jar’s own default is yellow. Passed as --auto-reply-trigger-color.',
      'Which Minecraft text colour the trigger phrase must be in. The jar’s own default is yellow. Passed as --auto-reply-trigger-color.',
      'Which Minecraft text colour the trigger phrase has to be. The jar’s own default is yellow. It becomes --auto-reply-trigger-color.'
    ],
    [
      '觸發字串要用邊隻 Minecraft 文字顏色。jar 本身預設係黃色。會變成 --auto-reply-trigger-color。',
      '觸發字串要用邊隻 Minecraft 文字顏色。jar 本身預設係黃色。會變成 --auto-reply-trigger-color。',
      '觸發字串要係邊隻 Minecraft 文字顏色。jar 預設黃色。佢會變 --auto-reply-trigger-color。'
    ]
  ),
  'downloader.option.autoReplyColor': t3(
    ['Reply text colour', 'Reply text colour', 'Reply text colour'],
    ['回覆文字顏色', '回覆文字顏色', '回覆文字顏色']
  ),
  'downloader.option.autoReplyColor.description': t3(
    [
      'Which Minecraft text colour, in the same message, is sent back as the reply. The jar’s own default is red. Passed as --auto-reply-color.',
      'Which Minecraft text colour, in the same message, is sent back as the reply. The jar’s own default is red. Passed as --auto-reply-color.',
      'Which Minecraft text colour in that same message gets sent back as the reply. The jar’s own default is red. It becomes --auto-reply-color.'
    ],
    [
      '同一條訊息入面，邊隻 Minecraft 文字顏色會被當作回覆送返出去。jar 本身預設係紅色。會變成 --auto-reply-color。',
      '同一條訊息入面，邊隻 Minecraft 文字顏色會被當作回覆送返出去。jar 本身預設係紅色。會變成 --auto-reply-color。',
      '同一條訊息入面邊隻文字顏色會當回覆咁送返出去。jar 預設紅色。佢會變 --auto-reply-color。'
    ]
  ),
  'downloader.option.autoReplyDelay': t3(
    ['Delay between automatic replies', 'Delay between automatic replies', 'Delay between automatic replies'],
    ['自動回覆之間嘅延遲', '自動回覆之間嘅延遲', '兩次自動回覆之間等幾耐']
  ),
  'downloader.option.autoReplyDelay.description': t3(
    [
      'Minimum milliseconds between two automatic replies, so the account does not spam chat and get kicked. The jar’s own default is 1500. Passed as --auto-reply-delay.',
      'Minimum milliseconds between two automatic replies, so the account does not spam chat and get kicked. The jar’s own default is 1500. Passed as --auto-reply-delay.',
      'Least milliseconds between two automatic replies, so the account does not spam chat and get kicked. The jar’s own default is 1500. It becomes --auto-reply-delay.'
    ],
    [
      '兩次自動回覆之間最少幾多毫秒，免得個帳號洗版畀人踢。jar 本身預設係 1500。會變成 --auto-reply-delay。',
      '兩次自動回覆之間最少幾多毫秒，免得個帳號洗版畀人踢。jar 本身預設係 1500。會變成 --auto-reply-delay。',
      '兩次自動回覆最少隔幾多毫秒，唔好洗版洗到畀人踢。jar 預設 1500。佢會變 --auto-reply-delay。'
    ]
  ),

  /* ---------------- Minecraft colours ---------------- */
  'downloader.colour.black': t3(['Black', 'Black', 'Black'], ['黑色', '黑色', '黑色']),
  'downloader.colour.dark_blue': t3(['Dark blue', 'Dark blue', 'Dark blue'], ['深藍', '深藍', '深藍']),
  'downloader.colour.dark_green': t3(['Dark green', 'Dark green', 'Dark green'], ['深綠', '深綠', '深綠']),
  'downloader.colour.dark_aqua': t3(['Dark aqua', 'Dark aqua', 'Dark aqua'], ['深青', '深青', '深青']),
  'downloader.colour.dark_red': t3(['Dark red', 'Dark red', 'Dark red'], ['深紅', '深紅', '深紅']),
  'downloader.colour.dark_purple': t3(['Dark purple', 'Dark purple', 'Dark purple'], ['深紫', '深紫', '深紫']),
  'downloader.colour.gold': t3(['Gold', 'Gold', 'Gold'], ['金色', '金色', '金色']),
  'downloader.colour.gray': t3(['Grey', 'Grey', 'Grey'], ['灰色', '灰色', '灰色']),
  'downloader.colour.dark_gray': t3(['Dark grey', 'Dark grey', 'Dark grey'], ['深灰', '深灰', '深灰']),
  'downloader.colour.blue': t3(['Blue', 'Blue', 'Blue'], ['藍色', '藍色', '藍色']),
  'downloader.colour.green': t3(['Green', 'Green', 'Green'], ['綠色', '綠色', '綠色']),
  'downloader.colour.aqua': t3(['Aqua', 'Aqua', 'Aqua'], ['青色', '青色', '青色']),
  'downloader.colour.red': t3(['Red', 'Red', 'Red'], ['紅色', '紅色', '紅色']),
  'downloader.colour.light_purple': t3(['Light purple', 'Light purple', 'Light purple'], ['淺紫', '淺紫', '淺紫']),
  'downloader.colour.yellow': t3(['Yellow', 'Yellow', 'Yellow'], ['黃色', '黃色', '黃色']),
  'downloader.colour.white': t3(['White', 'White', 'White'], ['白色', '白色', '白色']),

  /* ---------------- presets ---------------- */
  'downloader.preset.defaults': t3(
    ['The application’s defaults', 'The application’s defaults', 'Straight down the middle'],
    ['本應用嘅預設值', '本應用嘅預設值', '照原裝出廠']
  ),
  'downloader.preset.defaults.description': t3(
    [
      'Every option exactly as it ships: headless, overview map on, nothing experimental turned on.',
      'Every option exactly as it ships: headless, overview map on, nothing experimental turned on.',
      'Every option exactly as shipped: headless, overview map on, and nothing experimental switched on.'
    ],
    [
      '全部選項照原裝：無介面行、開總覽地圖、冇開任何實驗功能。',
      '全部選項照原裝：無介面行、開總覽地圖、冇開任何實驗功能。',
      '全部照原裝出廠：無介面、總覽地圖開住、實驗嘢一樣都冇開。'
    ]
  ),
  'downloader.preset.javaWindow': t3(
    ['With the Java map window', 'With the Java map window', 'With the Java map window'],
    ['連 Java 地圖視窗', '連 Java 地圖視窗', '開埋 Java 地圖視窗']
  ),
  'downloader.preset.javaWindow.description': t3(
    [
      'The defaults, plus the downloader’s own JavaFX map window in its dark theme.',
      'The defaults, plus the downloader’s own JavaFX map window in its dark theme.',
      'The defaults, plus the downloader’s own JavaFX map window wearing its dark theme.'
    ],
    [
      '預設值，再加開下載器自己個 JavaFX 地圖視窗，用深色主題。',
      '預設值，再加開下載器自己個 JavaFX 地圖視窗，用深色主題。',
      '預設值加開埋下載器自己嗰個 JavaFX 地圖視窗，著住深色主題。'
    ]
  ),
  'downloader.preset.extendedRender': t3(
    ['Extended render distance', 'Extended render distance', 'See further than you should'],
    ['延伸渲染距離', '延伸渲染距離', '睇遠過你應該睇到嘅']
  ),
  'downloader.preset.extendedRender.description': t3(
    [
      'The defaults, plus re-sending downloaded chunks to a 16-chunk render distance and drawing them on the map.',
      'The defaults, plus re-sending downloaded chunks to a 16-chunk render distance and drawing them on the map.',
      'The defaults, plus feeding downloaded chunks back out to 16 chunks of render distance and drawing them on the map.'
    ],
    [
      '預設值，再加將已下載區塊重送到 16 區塊嘅渲染距離，同埋喺地圖畫埋佢哋。',
      '預設值，再加將已下載區塊重送到 16 區塊嘅渲染距離，同埋喺地圖畫埋佢哋。',
      '預設值加埋將下載咗嘅區塊翻兜到 16 區塊渲染距離，仲要畫埋上地圖。'
    ]
  ),
  'downloader.preset.containerSweep': t3(
    ['Container sweep', 'Container sweep', 'Container sweep']
    ,
    ['容器大掃除', '容器大掃除', '容器大掃除']
  ),
  'downloader.preset.containerSweep.description': t3(
    [
      'The defaults, plus experimental automatic container opening at a deliberately slow 600 ms between opens. It sends real interactions to the server and may trip anti-cheat.',
      'The defaults, plus experimental automatic container opening at a deliberately slow 600 ms between opens. It sends real interactions to the server and may trip anti-cheat.',
      'The defaults, plus the experimental automatic container opening, deliberately slowed to 600 ms between opens. These are real interactions sent to the server and they may trip anti-cheat.'
    ],
    [
      '預設值，再加實驗性自動開容器，刻意調慢到每次相隔 600 毫秒。佢會向伺服器發真實互動，可能會觸發反作弊。',
      '預設值，再加實驗性自動開容器，刻意調慢到每次相隔 600 毫秒。佢會向伺服器發真實互動，可能會觸發反作弊。',
      '預設值加埋實驗性自動開容器，特登慢到每次隔 600 毫秒。呢啲係真互動，係會撞到反作弊嘅。'
    ]
  ),

  /* ---------------- versions table ---------------- */
  'downloader.versions.column.version': t3(['Game version', 'Game version', 'Game version'], ['遊戲版本', '遊戲版本', '遊戲版本']),
  'downloader.versions.column.protocol': t3(['Protocol', 'Protocol', 'Protocol'], ['通訊協定', '通訊協定', '通訊協定']),
  'downloader.versions.column.dataVersion': t3(['Data version', 'Data version', 'Data version'], ['資料版本', '資料版本', '資料版本']),
  'downloader.versions.detected': t3(
    ['Detected in this session', 'Detected in this session', 'What this session actually found'],
    ['今次連線偵測到', '今次連線偵測到', '今次真係搵到嘅']
  ),

  /* ---------------- settings ---------------- */
  'downloader.settings.section': t3(
    ['World downloader', 'World downloader', 'World downloader'],
    ['世界下載器', '世界下載器', '世界下載器']
  ),
  'downloader.settings.jarPath': t3(
    ['Downloader jar file', 'Downloader jar file', 'Downloader jar file'],
    ['下載器 jar 檔', '下載器 jar 檔', '下載器 jar 檔']
  ),
  'downloader.settings.jarPath.description': t3(
    [
      'The world-downloader.jar this application starts. Leave it empty to use the copy in the application data directory when one is there.',
      'The world-downloader.jar this application starts. Leave it empty to use the copy in the application data directory when one is there.',
      'The world-downloader.jar this application starts. Leave it empty and it uses the copy in the application data directory, if one is sitting there.'
    ],
    [
      '本應用會啟動嘅 world-downloader.jar。留空就會用應用資料目錄入面嗰份（如果有）。',
      '本應用會啟動嘅 world-downloader.jar。留空就會用應用資料目錄入面嗰份（如果有）。',
      '本應用會開嘅 world-downloader.jar。留空就用應用資料目錄嗰份（有嘅話）。'
    ]
  ),
  'downloader.settings.javaCommand': t3(
    ['Java command', 'Java command', 'Java command'],
    ['Java 指令', 'Java 指令', 'Java 指令']
  ),
  'downloader.settings.javaCommand.description': t3(
    [
      'Which Java launcher to run, resolved on PATH. java keeps a console attached; javaw does not, which hides the console on Windows but also hides anything Java writes before this application attaches. Only these two are permitted by the privileged bridge.',
      'Which Java launcher to run, resolved on PATH. java keeps a console attached; javaw does not, which hides the console on Windows but also hides anything Java writes before this application attaches. Only these two are permitted by the privileged bridge.',
      'Which Java launcher to run, found on PATH. java keeps a console attached; javaw does not, which hides the console on Windows and also hides anything Java says before this application is listening. The privileged bridge allows only these two.'
    ],
    [
      '行邊個 Java 啟動器，喺 PATH 度搵。java 會帶住 console；javaw 唔會，喺 Windows 會冇咗個黑窗，但同時亦會冇咗 Java 喺本應用接駁之前寫嘅嘢。特權橋接只准呢兩個。',
      '行邊個 Java 啟動器，喺 PATH 度搵。java 會帶住 console；javaw 唔會，喺 Windows 會冇咗個黑窗，但同時亦會冇咗 Java 喺本應用接駁之前寫嘅嘢。特權橋接只准呢兩個。',
      '用邊個 Java 啟動器，喺 PATH 搵。java 有 console；javaw 冇，喺 Windows 唔會彈黑窗，但係本應用接駁之前 Java 講過咩你都聽唔到。特權橋接淨係准呢兩個。'
    ]
  ),
  'downloader.settings.workingDirectory': t3(
    ['Working directory', 'Working directory', 'Working directory'],
    ['工作目錄', '工作目錄', '工作目錄']
  ),
  'downloader.settings.workingDirectory.description': t3(
    [
      'The directory the Java process runs in. The downloader writes its own config.json, its version cache and any relative output world under it. Empty means the application data directory.',
      'The directory the Java process runs in. The downloader writes its own config.json, its version cache and any relative output world under it. Empty means the application data directory.',
      'Where the Java process runs. The downloader drops its own config.json, its version cache and any relative output world in there. Empty means the application data directory.'
    ],
    [
      'Java 程序行喺邊個目錄。下載器會喺入面寫自己嘅 config.json、版本快取，同埋任何相對路徑嘅輸出世界。留空即係應用資料目錄。',
      'Java 程序行喺邊個目錄。下載器會喺入面寫自己嘅 config.json、版本快取，同埋任何相對路徑嘅輸出世界。留空即係應用資料目錄。',
      'Java 程序喺邊度行。下載器會喺嗰度掉低自己嘅 config.json、版本快取，同相對路徑嘅輸出世界。留空即係應用資料目錄。'
    ]
  ),
  'downloader.settings.maxLogLines': t3(
    ['Log lines to keep', 'Log lines to keep', 'Log lines to keep'],
    ['保留幾多行記錄', '保留幾多行記錄', '記錄留幾多行']
  ),
  'downloader.settings.maxLogLines.description': t3(
    [
      'How many activity-log lines this window keeps. When the limit is passed the oldest lines are dropped, and the log says how many went.',
      'How many activity-log lines this window keeps. When the limit is passed the oldest lines are dropped, and the log says how many went.',
      'How many activity-log lines this window holds on to. Past the limit the oldest ones fall off the end, and the log says how many went.'
    ],
    [
      '呢個視窗保留幾多行活動記錄。超過上限就會丟棄最舊嘅行，記錄會寫明走咗幾多行。',
      '呢個視窗保留幾多行活動記錄。超過上限就會丟棄最舊嘅行，記錄會寫明走咗幾多行。',
      '呢個視窗留幾多行活動記錄。爆咗上限最舊嗰啲就會跌出去，記錄會講返走咗幾多行。'
    ]
  ),
  'downloader.settings.visibleLogLines': t3(
    ['Log lines to render at once', 'Log lines to render at once', 'Log lines to render at once'],
    ['一次過顯示幾多行', '一次過顯示幾多行', '一次顯示幾多行']
  ),
  'downloader.settings.visibleLogLines.description': t3(
    [
      'How many matching lines are drawn at a time. A long log stays responsive because only this many rows exist in the page; the count of matches above always names the true total.',
      'How many matching lines are drawn at a time. A long log stays responsive because only this many rows exist in the page; the count of matches above always names the true total.',
      'How many matching lines are drawn at once. A long log stays quick because only this many rows exist in the page, and the count above always names the true total.'
    ],
    [
      '一次過畫幾多行符合嘅記錄。長記錄都仲順，因為頁面上只有咁多行；上面嗰個符合數目永遠寫住真實總數。',
      '一次過畫幾多行符合嘅記錄。長記錄都仲順，因為頁面上只有咁多行；上面嗰個符合數目永遠寫住真實總數。',
      '一次畫幾多行符合嘅記錄。長極都仲快，因為頁面上得咁多行；上面個數字永遠係真總數。'
    ]
  ),
  'downloader.settings.pollSeconds': t3(
    ['World status refresh', 'World status refresh', 'World status refresh'],
    ['世界狀態更新間隔', '世界狀態更新間隔', '世界狀態幾耐睇一次']
  ),
  'downloader.settings.pollSeconds.description': t3(
    [
      'How often, in seconds, the region files and the overview status file are re-read while a download is running. Reading is cheap; counting chunks is not, and stays a separate explicit action.',
      'How often, in seconds, the region files and the overview status file are re-read while a download is running. Reading is cheap; counting chunks is not, and stays a separate explicit action.',
      'How often, in seconds, the region files and the overview status file get re-read while a download runs. That read is cheap; counting chunks is not, so it stays its own explicit action.'
    ],
    [
      '下載行緊嗰陣，每隔幾多秒重讀一次區域檔同總覽狀態檔。讀呢啲好平；數區塊唔平，所以佢仍然係一個獨立、要你撳嘅動作。',
      '下載行緊嗰陣，每隔幾多秒重讀一次區域檔同總覽狀態檔。讀呢啲好平；數區塊唔平，所以佢仍然係一個獨立、要你撳嘅動作。',
      '下載行緊每隔幾多秒重讀區域檔同總覽狀態檔。讀呢啲好平；數區塊就唔平，所以佢自己一個掣，你撳先做。'
    ]
  ),
  'downloader.settings.exportFormat': t3(
    ['Default export format', 'Default export format', 'Default export format'],
    ['預設匯出格式', '預設匯出格式', '預設匯出格式']
  ),
  'downloader.settings.exportFormat.description': t3(
    [
      'The format offered first when exporting profiles or the activity log. Every other format stays available at the moment of export.',
      'The format offered first when exporting profiles or the activity log. Every other format stays available at the moment of export.',
      'The format offered first when exporting profiles or the log. Every other format is still there when you export.'
    ],
    [
      '匯出設定檔或者活動記錄嗰陣，第一個提供嘅格式。匯出嗰刻其他格式一樣揀得。',
      '匯出設定檔或者活動記錄嗰陣，第一個提供嘅格式。匯出嗰刻其他格式一樣揀得。',
      '匯出設定檔或者記錄嗰陣預先揀好嘅格式。其他格式匯出嗰陣照樣揀得。'
    ]
  ),
  'downloader.settings.checkJava': t3(
    ['Check the Java runtime now', 'Check the Java runtime now', 'Go and look for Java now'],
    ['即刻檢查 Java 執行環境', '即刻檢查 Java 執行環境', '而家去搵下 Java']
  ),
  'downloader.settings.checkJava.description': t3(
    [
      'Runs the configured Java command with -version and reports exactly what it printed and what it exited with.',
      'Runs the configured Java command with -version and reports exactly what it printed and what it exited with.',
      'Runs the configured Java command with -version and reports exactly what it printed and how it exited.'
    ],
    [
      '用已設定嘅 Java 指令行 -version，然後原原本本報告佢印咗乜、用咩狀態結束。',
      '用已設定嘅 Java 指令行 -version，然後原原本本報告佢印咗乜、用咩狀態結束。',
      '用你設定嗰個 Java 指令行 -version，然後照實報告佢印咗乜、點收場。'
    ]
  ),

  /* ---------------- palette ---------------- */
  'downloader.palette.open': t3(
    ['Open the world downloader', 'Open the world downloader', 'Open the world downloader'],
    ['開啟世界下載器', '開啟世界下載器', '開個世界下載器']
  ),
  'downloader.palette.start': t3(
    ['Start a world download', 'Start a world download', 'Start a world download'],
    ['開始世界下載', '開始世界下載', '開始下載世界']
  ),
  'downloader.palette.stop': t3(
    ['Stop the world download', 'Stop the world download', 'Stop the world download'],
    ['停止世界下載', '停止世界下載', '停咗個下載']
  ),
  'downloader.palette.searchLog': t3(
    ['Search the downloader log', 'Search the downloader log', 'Search the downloader log'],
    ['搜尋下載器記錄', '搜尋下載器記錄', '搵下下載器嘅記錄']
  ),
  'downloader.palette.profiles': t3(
    ['Saved download profiles', 'Saved download profiles', 'Saved download profiles'],
    ['已儲存下載設定檔', '已儲存下載設定檔', '儲低咗嘅下載設定檔']
  ),
  'downloader.palette.scan': t3(
    ['Count the saved chunks', 'Count the saved chunks', 'Count the saved chunks'],
    ['點算已儲存區塊', '點算已儲存區塊', '數下儲低咗幾多區塊']
  ),
  'downloader.palette.checkJava': t3(
    ['Check the Java runtime', 'Check the Java runtime', 'Check the Java runtime'],
    ['檢查 Java 執行環境', '檢查 Java 執行環境', '睇下有冇 Java']
  ),

  /* ---------------- units ---------------- */
  'downloader.unit.milliseconds': t3(['ms', 'ms', 'ms'], ['毫秒', '毫秒', '毫秒']),
  'downloader.unit.chunks': t3(['chunks', 'chunks', 'chunks'], ['區塊', '區塊', '區塊']),
  'downloader.unit.blocks': t3(['blocks', 'blocks', 'blocks'], ['方格', '方格', '方格']),

  /* ---------------- misc ---------------- */
  'downloader.flagLabel': t3(
    ['Command-line flag: {flag}', 'Command-line flag: {flag}', 'Command-line flag: {flag}'],
    ['命令行參數：{flag}', '命令行參數：{flag}', '命令行參數：{flag}']
  ),
  'downloader.options.noMatches': t3(
    ['No launch option matches this search.', 'No launch option matches this search.', 'No option matches that search.'],
    ['冇啟動選項符合今次搜尋。', '冇啟動選項符合今次搜尋。', '搵唔到符合嘅選項。']
  ),
  'downloader.options.reset': t3(
    ['Every launch option is back at its default.', 'Every launch option is back at its default.', 'Every option is back at its default.'],
    ['全部啟動選項已還原預設。', '全部啟動選項已還原預設。', '全部選項打返晒回原位。']
  )
};
