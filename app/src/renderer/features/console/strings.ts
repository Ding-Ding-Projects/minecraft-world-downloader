/**
 * Every piece of copy this feature renders.
 *
 * The bulk of the catalogue is generated from `CONSOLE_OPTIONS` and
 * `CONSOLE_OPTION_GROUPS`: each option already carries its own English and
 * Cantonese sentence in `options.ts`, written once as a transcription of the
 * console's own form. A field label and the sentence describing what a flag
 * does are facts about the downloader, not jokes, so every rung of those
 * ladders is the same sentence — that is a deliberate, documented choice, not
 * a shortcut (`options.ts` says so directly).
 *
 * The surrounding UI chrome — the tab, the section headings, the buttons, the
 * notifications — gets real five-rung ladders in both languages, because that
 * copy is the surface a person actually reads while deciding what to click.
 */

import type { Catalogue, FunnyLadder } from '../../core/registry';
import { CONSOLE_GROUP_YUE, CONSOLE_OPTIONS, CONSOLE_OPTION_GROUPS } from './options';

function flat(en: string): FunnyLadder {
  return [en, en, en, en, en];
}

function flatYue(yue: string): FunnyLadder {
  return [yue, yue, yue, yue, yue];
}

/* ------------------------------------------------------------------ */
/* Generated from the option schema                                    */
/* ------------------------------------------------------------------ */

const optionEntries: Catalogue = {};
for (const option of CONSOLE_OPTIONS) {
  optionEntries[`console.option.${option.key}.label`] = { en: flat(option.label), yue: flatYue(option.labelYue) };
  optionEntries[`console.option.${option.key}.help`] = { en: flat(option.help), yue: flatYue(option.helpYue) };
  if (option.passthroughNote) {
    optionEntries[`console.option.${option.key}.passthrough`] = {
      en: flat(option.passthroughNote),
      yue: flatYue(option.passthroughNoteYue ?? option.passthroughNote)
    };
  }
}

const groupEntries: Catalogue = {};
for (const group of CONSOLE_OPTION_GROUPS) {
  groupEntries[`console.group.${group}`] = {
    en: flat(group),
    yue: flatYue(CONSOLE_GROUP_YUE[group] ?? group)
  };
}

/* ------------------------------------------------------------------ */
/* Chrome                                                               */
/* ------------------------------------------------------------------ */

const chrome: Catalogue = {
  'console.tab': {
    en: ['Web console', 'Web console', 'Console', 'The console, unleashed from the browser', 'THE CONSOLE, UNLEASHED FROM THE BROWSER'],
    yue: ['網頁主控台', '網頁主控台', '主控台', '主控台，脫離咗個瀏覽器', '主控台，脫離晒個瀏覽器，自由喇']
  },
  'console.tab.subtitle': {
    en: [
      'Every capability of the web dashboard, spoken to natively.',
      'Every capability of the web dashboard, spoken to natively.',
      'Everything the dashboard could do, done here instead.',
      'Everything the browser dashboard could do — minus the browser, plus the swagger.',
      'Everything the browser dashboard could do — minus the browser, plus the swagger.'
    ],
    yue: [
      '網頁主控台嘅所有功能，喺呢度直接講。',
      '網頁主控台嘅所有功能，喺呢度直接講。',
      '瀏覽器主控台識做嘅嘢，呢度照樣做晒。',
      '瀏覽器主控台識做嘅嘢，呢度照做——仲多咗份型。',
      '瀏覽器主控台識做嘅嘢，呢度照做——仲多咗份型。'
    ]
  },

  /* ---- section headings ---- */
  'console.section.service': {
    en: ['Service', 'Service', 'Service', 'The service, in the flesh', 'The service, in the flesh'],
    yue: ['服務', '服務', '服務', '服務本尊', '服務本尊']
  },
  'console.section.service.description': {
    en: [
      'Whether the console process is installed, running and answering.',
      'Whether the console process is installed, running and answering.',
      'Is it installed, is it running, is it actually answering.',
      'Installed? Running? Actually talking back? All three, honestly reported.',
      'Installed? Running? Actually talking back? All three, honestly reported.'
    ],
    yue: [
      '主控台程序有冇裝好、有冇跑緊、有冇回應緊。',
      '主控台程序有冇裝好、有冇跑緊、有冇回應緊。',
      '裝咗未？跑緊未？真係有冇回應？',
      '裝咗未？跑緊未？真係有冇應緊聲？三樣嘢，老實講俾你知。',
      '裝咗未？跑緊未？真係有冇應緊聲？三樣嘢，老實講俾你知。'
    ]
  },
  'console.section.configuration': {
    en: ['Configuration', 'Configuration', 'Configuration', 'The great big form of knobs', 'The great big form of knobs'],
    yue: ['設定', '設定', '設定', '成個掣掣掣嘅大表格', '成個掣掣掣嘅大表格']
  },
  'console.section.configuration.description': {
    en: [
      'Every downloader option the console persists, grouped exactly as the console groups them.',
      'Every downloader option the console persists, grouped exactly as the console groups them.',
      'Every option the console saves, in the same groups it uses.',
      'Every dial the console lets you turn, sorted into the exact same drawers it uses.',
      'Every dial the console lets you turn, sorted into the exact same drawers it uses.'
    ],
    yue: [
      '主控台會儲低嘅每一個下載器選項，分組同主控台一樣。',
      '主控台會儲低嘅每一個下載器選項，分組同主控台一樣。',
      '主控台儲低嘅每個選項，分組同佢一樣。',
      '主控台俾你撥嘅每一個掣，分喺同佢一模一樣嘅櫃桶入面。',
      '主控台俾你撥嘅每一個掣，分喺同佢一模一樣嘅櫃桶入面。'
    ]
  },
  'console.section.account': {
    en: ['Minecraft account', 'Minecraft account', 'Account', 'Who this console is pretending to be', 'Who this console is pretending to be'],
    yue: ['Minecraft 帳戶', 'Minecraft 帳戶', '帳戶', '主控台而家扮緊邊個', '主控台而家扮緊邊個']
  },
  'console.section.worlds': {
    en: ['Worlds', 'Worlds', 'Worlds', 'Every world this console has ever hoarded', 'Every world this console has ever hoarded'],
    yue: ['世界', '世界', '世界', '主控台囤落嘅所有世界', '主控台囤落嘅所有世界']
  },
  'console.section.records': {
    en: ['Stored records', 'Stored records', 'Records', 'What the console keeps in its drawers', 'What the console keeps in its drawers'],
    yue: ['儲存記錄', '儲存記錄', '記錄', '主控台櫃桶入面藏住嘅嘢', '主控台櫃桶入面藏住嘅嘢']
  },
  'console.section.logs': {
    en: ['Logs', 'Logs', 'Logs', 'The console’s running commentary', 'The console’s running commentary'],
    yue: ['紀錄', '紀錄', '紀錄', '主控台嘅隨口旁述', '主控台嘅隨口旁述']
  },
  'console.section.installation': {
    en: ['Installation', 'Installation', 'Installation', 'What is actually sitting in that folder', 'What is actually sitting in that folder'],
    yue: ['安裝', '安裝', '安裝', '嗰個資料夾入面真係有咩', '嗰個資料夾入面真係有咩']
  },
  'console.section.bot': {
    en: ['Auto-explore bot', 'Auto-explore bot', 'The bot', 'The little walking robot', 'The little walking robot'],
    yue: ['自動探索機械人', '自動探索機械人', '機械人', '嗰隻識行路嘅細機械人', '嗰隻識行路嘅細機械人']
  },

  /* ---- buttons and actions ---- */
  'console.action.start': {
    en: ['Start the console', 'Start the console', 'Start it up', 'Fire up the console', 'FIRE UP THE CONSOLE'],
    yue: ['開啟主控台', '開啟主控台', '開機', '開動主控台', '開動主控台，火喇']
  },
  'console.action.stop': {
    en: ['Stop the console', 'Stop the console', 'Stop it', 'Pull the plug on the console', 'Pull the plug on the console'],
    yue: ['停止主控台', '停止主控台', '停低佢', '拔咗主控台條線', '拔咗主控台條線']
  },
  'console.action.installDeps': {
    en: [
      'Install dependencies',
      'Install dependencies',
      'Install what it needs',
      'Feed it Flask, waitress and requests',
      'Feed it Flask, waitress and requests'
    ],
    yue: ['安裝相依套件', '安裝相依套件', '裝返佢要嘅嘢', '餵佢食 Flask、waitress 同 requests', '餵佢食 Flask、waitress 同 requests']
  },
  'console.action.openFolder': {
    en: ['Open console folder', 'Open console folder', 'Open the folder', 'Open the console’s folder', 'Open the console’s folder'],
    yue: ['打開主控台資料夾', '打開主控台資料夾', '打開資料夾', '打開主控台嘅老窩', '打開主控台嘅老窩']
  },
  'console.action.openDataFolder': {
    en: ['Open data folder', 'Open data folder', 'Open the data folder', 'Open the folder where everything lands', 'Open the folder where everything lands'],
    yue: ['打開資料夾', '打開資料夾', '打開資料資料夾', '打開嗰個乜都掉入去嘅資料夾', '打開嗰個乜都掉入去嘅資料夾']
  },
  'console.action.refresh': {
    en: ['Refresh now', 'Refresh now', 'Refresh', 'Poke it and see', 'Poke it and see'],
    yue: ['即刻更新', '即刻更新', '更新', '篤下佢，睇下有咩反應', '篤下佢，睇下有咩反應']
  },
  'console.action.save': {
    en: ['Save configuration', 'Save configuration', 'Save', 'Save it before it forgets', 'Save it before it forgets'],
    yue: ['儲存設定', '儲存設定', '儲存', '快啲儲，唔好等佢唔記得', '快啲儲，唔好等佢唔記得']
  },
  'console.action.restart': {
    en: [
      'Restart with this configuration',
      'Restart with this configuration',
      'Restart with these settings',
      'Restart it, this time properly',
      'Restart it, this time properly'
    ],
    yue: ['用呢個設定重啟', '用呢個設定重啟', '用呢啲設定重啟', '重啟佢，今次認真啲', '重啟佢，今次認真啲']
  },
  'console.action.resetToSaved': {
    en: ['Reset to saved', 'Reset to saved', 'Discard changes', 'Throw away the fiddling', 'Throw away the fiddling'],
    yue: ['還原至已儲存', '還原至已儲存', '棄置改動', '掉晒啱啱撥嘅嘢', '掉晒啱啱撥嘅嘢']
  },
  'console.action.copyCommand': {
    en: ['Copy command line', 'Copy command line', 'Copy the command', 'Copy the exact incantation', 'Copy the exact incantation'],
    yue: ['複製指令', '複製指令', '複製指令', '抄低嗰句咒語', '抄低嗰句咒語']
  },
  'console.action.scan': {
    en: ['Scan for worlds', 'Scan for worlds', 'Scan the folder', 'Go and count every world', 'Go and count every world'],
    yue: ['掃描世界', '掃描世界', '掃描資料夾', '去數晒有幾多個世界', '去數晒有幾多個世界']
  },
  'console.action.cancelScan': {
    en: ['Cancel scan', 'Cancel scan', 'Stop scanning', 'Call off the scan', 'Call off the scan'],
    yue: ['取消掃描', '取消掃描', '停止掃描', '收工，唔掃喇', '收工，唔掃喇']
  },
  'console.action.selectAll': {
    en: ['Select every match', 'Select every match', 'Select all', 'Grab the lot', 'Grab the lot'],
    yue: ['全選符合項目', '全選符合項目', '全選', '一次過攞晒', '一次過攞晒']
  },
  'console.action.selectNone': {
    en: ['Select none', 'Select none', 'Clear selection', 'Let go of all of them', 'Let go of all of them'],
    yue: ['清除選擇', '清除選擇', '清除選擇', '成隻手放晒', '成隻手放晒']
  },
  'console.action.invertSelection': {
    en: ['Invert selection', 'Invert selection', 'Flip the selection', 'Swap who is picked', 'Swap who is picked'],
    yue: ['反轉選擇', '反轉選擇', '掉轉選擇', '換轉邊個被揀', '換轉邊個被揀']
  },
  'console.action.exportSelected': {
    en: ['Export selected', 'Export selected', 'Export the selection', 'Take the chosen ones with you', 'Take the chosen ones with you'],
    yue: ['匯出已選項目', '匯出已選項目', '匯出已選', '揀咗嘅就帶走', '揀咗嘅就帶走']
  },
  'console.action.exportAll': {
    en: ['Export all', 'Export all', 'Export everything', 'Take it all with you', 'Take it all with you'],
    yue: ['匯出全部', '匯出全部', '匯出所有', '成堆都帶走', '成堆都帶走']
  },
  'console.action.reveal': {
    en: ['Reveal in folder', 'Reveal in folder', 'Show in folder', 'Point at exactly where it lives', 'Point at exactly where it lives'],
    yue: ['喺資料夾顯示', '喺資料夾顯示', '喺資料夾顯示', '指返出佢住喺邊', '指返出佢住喺邊']
  },
  'console.action.clearLog': {
    en: ['Clear the log', 'Clear the log', 'Clear log', 'Wipe the on-screen log clean', 'Wipe the on-screen log clean'],
    yue: ['清除紀錄', '清除紀錄', '清除紀錄', '將畫面上嘅紀錄洗乾淨', '將畫面上嘅紀錄洗乾淨']
  },
  'console.action.exportLog': {
    en: ['Export log', 'Export log', 'Export the log', 'Take the log lines with you', 'Take the log lines with you'],
    yue: ['匯出紀錄', '匯出紀錄', '匯出紀錄', '將啲紀錄行帶走', '將啲紀錄行帶走']
  },
  'console.action.signInToken': {
    en: ['Sign in with a token', 'Sign in with a token', 'Use a pasted token', 'Sign in with a pasted access token', 'Sign in with a pasted access token'],
    yue: ['用權杖登入', '用權杖登入', '用貼上嘅權杖', '用貼上嘅存取權杖登入', '用貼上嘅存取權杖登入']
  },
  'console.action.signInOffline': {
    en: ['Sign in offline', 'Sign in offline', 'Use an offline name', 'Sign in with an offline username', 'Sign in with an offline username'],
    yue: ['離線登入', '離線登入', '用離線名', '用離線用戶名登入', '用離線用戶名登入']
  },
  'console.action.beginMicrosoft': {
    en: ['Sign in with Microsoft', 'Sign in with Microsoft', 'Start Microsoft sign-in', 'Start the Microsoft dance', 'Start the Microsoft dance'],
    yue: ['用 Microsoft 登入', '用 Microsoft 登入', '開始 Microsoft 登入', '開始跳 Microsoft 嗰段舞', '開始跳 Microsoft 嗰段舞']
  },
  'console.action.cancelMicrosoft': {
    en: ['Cancel sign-in', 'Cancel sign-in', 'Cancel', 'Call it off', 'Call it off'],
    yue: ['取消登入', '取消登入', '取消', '唔玩喇', '唔玩喇']
  },
  'console.action.signOut': {
    en: ['Sign out', 'Sign out', 'Sign out', 'Sign this account out', 'Sign this account out'],
    yue: ['登出', '登出', '登出', '將呢個帳戶踢走', '將呢個帳戶踢走']
  },
  'console.action.copyCode': {
    en: ['Copy code', 'Copy code', 'Copy the code', 'Copy the code before it expires', 'Copy the code before it expires'],
    yue: ['複製代碼', '複製代碼', '複製代碼', '快啲抄低個代碼，唔好過期', '快啲抄低個代碼，唔好過期']
  },
  'console.action.storePassword': {
    en: ['Store password', 'Store password', 'Save the password', 'Lock the password away in the vault', 'Lock the password away in the vault'],
    yue: ['儲存密碼', '儲存密碼', '儲存密碼', '將密碼鎖入保險箱', '將密碼鎖入保險箱']
  },
  'console.action.forgetPassword': {
    en: ['Forget password', 'Forget password', 'Remove the password', 'Wipe the stored password', 'Wipe the stored password'],
    yue: ['忘記密碼', '忘記密碼', '刪除密碼', '將已儲密碼一筆勾銷', '將已儲密碼一筆勾銷']
  },
  'console.action.startBot': {
    en: ['Start the bot', 'Start the bot', 'Start bot', 'Let the little robot loose', 'Let the little robot loose'],
    yue: ['啟動機械人', '啟動機械人', '啟動機械人', '放隻機械人出去行', '放隻機械人出去行']
  },
  'console.action.stopBot': {
    en: ['Stop the bot', 'Stop the bot', 'Stop bot', 'Call the robot home', 'Call the robot home'],
    yue: ['停止機械人', '停止機械人', '停止機械人', '叫機械人返屋企', '叫機械人返屋企']
  },
  'console.action.authenticateBot': {
    en: [
      'Sign the bot in to Microsoft',
      'Sign the bot in to Microsoft',
      'Sign the bot in',
      'Give the robot its own Microsoft login',
      'Give the robot its own Microsoft login'
    ],
    yue: ['幫機械人登入 Microsoft', '幫機械人登入 Microsoft', '幫機械人登入', '俾隻機械人自己嘅 Microsoft 帳戶', '俾隻機械人自己嘅 Microsoft 帳戶']
  },

  /* ---- fields ---- */
  'console.field.token': {
    en: ['Access token', 'Access token', 'Access token', 'Access token', 'Access token'],
    yue: ['存取權杖', '存取權杖', '存取權杖', '存取權杖', '存取權杖']
  },
  'console.field.offlineName': {
    en: ['Offline username', 'Offline username', 'Offline username', 'Offline username', 'Offline username'],
    yue: ['離線用戶名', '離線用戶名', '離線用戶名', '離線用戶名', '離線用戶名']
  },
  'console.field.botAccount': {
    en: ['Bot account name', 'Bot account name', 'Bot account name', 'Bot account name', 'Bot account name'],
    yue: ['機械人帳戶名', '機械人帳戶名', '機械人帳戶名', '機械人帳戶名', '機械人帳戶名']
  },

  /* ---- search ---- */
  'console.search.worlds': {
    en: ['Search worlds', 'Search worlds', 'Search worlds', 'Search worlds', 'Search worlds'],
    yue: ['搜尋世界', '搜尋世界', '搜尋世界', '搜尋世界', '搜尋世界']
  },
  'console.search.records': {
    en: ['Search records', 'Search records', 'Search records', 'Search records', 'Search records'],
    yue: ['搜尋記錄', '搜尋記錄', '搜尋記錄', '搜尋記錄', '搜尋記錄']
  },
  'console.search.logs': {
    en: ['Search the log', 'Search the log', 'Search the log', 'Search the log', 'Search the log'],
    yue: ['搜尋紀錄', '搜尋紀錄', '搜尋紀錄', '搜尋紀錄', '搜尋紀錄']
  },
  'console.search.options': {
    en: ['Search options', 'Search options', 'Search options', 'Search options', 'Search options'],
    yue: ['搜尋選項', '搜尋選項', '搜尋選項', '搜尋選項', '搜尋選項']
  },

  /* ---- states ---- */
  'console.state.running': { en: flat('Running'), yue: flatYue('運行中') },
  'console.state.runningElsewhere': { en: flat('Running (started elsewhere)'), yue: flatYue('運行中（喺別處開嘅）') },
  'console.state.starting': { en: flat('Starting'), yue: flatYue('啟動緊') },
  'console.state.stopped': { en: flat('Stopped'), yue: flatYue('已停止') },
  'console.state.exited': { en: flat('Exited'), yue: flatYue('已退出') },
  'console.state.loginGated': { en: flat('Behind its own login'), yue: flatYue('畀自己嘅登入擋咗') },
  'console.state.unhealthy': { en: flat('Something else is on that port'), yue: flatYue('嗰個埠俾第二啲嘢佔咗') },
  'console.state.notInstalled': { en: flat('Not installed'), yue: flatYue('未安裝') },
  'console.state.unconfigured': { en: flat('Not configured'), yue: flatYue('未設定') },

  /* ---- empty states ---- */
  'console.empty.worlds.title': { en: flat('No worlds found yet'), yue: flatYue('仲未搵到世界') },
  'console.empty.worlds.body': {
    en: flat('Scan the data directory, or check that it is set correctly in Settings.'),
    yue: flatYue('掃描一下資料目錄，或者去設定確認個路徑啱唔啱。')
  },
  'console.empty.records.title': { en: flat('No data directory configured'), yue: flatYue('未設定資料目錄') },
  'console.empty.records.body': {
    en: flat('Set the console’s data directory in Settings to see its stored records.'),
    yue: flatYue('喺設定入面填返主控台嘅資料目錄，先可以睇到儲存記錄。')
  },
  'console.empty.logs.title': { en: flat('Nothing logged yet'), yue: flatYue('仲未有紀錄') },
  'console.empty.logs.body': {
    en: flat('Log lines appear here once the console is running and something happens.'),
    yue: flatYue('主控台跑緊、有嘢發生嘅時候，紀錄就會出現喺呢度。')
  },

  /* ---- notifications already referenced by controller.ts and worlds usage ---- */
  'console.notify.depsInstalled': { en: flat('The console dependencies are installed'), yue: flatYue('主控台嘅相依套件已經裝好') },
  'console.notify.depsInstalledBody': {
    en: flat('Flask, waitress and requests were installed for this user. The service can be started now.'),
    yue: flatYue('已經幫呢個用戶裝好 Flask、waitress 同 requests。而家可以開服務喇。')
  },
  'console.notify.depsFailed': { en: flat('The dependency installation failed'), yue: flatYue('相依套件安裝失敗') },
  'console.notify.depsFailedBody': {
    en: flat('The installer exited with code {code}. The service log holds the output.'),
    yue: flatYue('安裝程式以代碼 {code} 結束。服務紀錄入面有完整輸出。')
  },
  'console.notify.startBlocked': { en: flat('The console cannot be started'), yue: flatYue('主控台開唔到') },
  'console.notify.startBlockedBody': {
    en: flat('There is no app.py in the configured console folder, so there is nothing to run.'),
    yue: flatYue('設定咗嗰個主控台資料夾入面冇 app.py，冇嘢可以跑。')
  },
  'console.notify.noPassword': { en: flat('No console password is stored'), yue: flatYue('未儲存主控台密碼') },
  'console.notify.noPasswordBody': {
    en: flat('The console is set to require a sign-in, but no password is in the credential vault. Store one, or turn the requirement off.'),
    yue: flatYue('主控台設定咗要登入，但係保險箱入面冇密碼。去儲返個密碼，或者關咗呢個要求。')
  },
  'console.notify.startFailed': { en: flat('The console service did not start'), yue: flatYue('主控台服務開唔到') },
  'console.notify.stopFailed': { en: flat('The console service did not stop'), yue: flatYue('主控台服務停唔到') },
  'console.notify.installFailed': { en: flat('The dependency installation did not start'), yue: flatYue('相依套件安裝都開始唔到') },

  /* ---- notifications this UI layer raises itself ---- */
  'console.notify.saved': { en: flat('Configuration saved'), yue: flatYue('設定已儲存') },
  'console.notify.saveFailed': { en: flat('The configuration was not saved'), yue: flatYue('設定儲存唔到') },
  'console.notify.restarted': { en: flat('The console is restarting with this configuration'), yue: flatYue('主控台用緊呢個設定重啟緊') },
  'console.notify.restartFailed': { en: flat('The restart did not succeed'), yue: flatYue('重啟唔成功') },
  'console.notify.signedIn': { en: flat('Signed in as {username}'), yue: flatYue('已登入，用戶：{username}') },
  'console.notify.signInFailed': { en: flat('The sign-in did not succeed'), yue: flatYue('登入唔成功') },
  'console.notify.signedOut': { en: flat('Signed out'), yue: flatYue('已登出') },
  'console.notify.signOutFailed': { en: flat('The console did not sign out'), yue: flatYue('主控台登出唔到') },
  'console.notify.microsoftStarted': { en: flat('Enter the code at the address shown to finish signing in'), yue: flatYue('去下面嗰個網址輸入代碼，完成登入') },
  'console.notify.microsoftFailed': { en: flat('The Microsoft sign-in did not start'), yue: flatYue('Microsoft 登入開始唔到') },
  'console.notify.passwordStored': { en: flat('The console password was stored'), yue: flatYue('主控台密碼已經儲存') },
  'console.notify.passwordForgotten': { en: flat('The stored console password was removed'), yue: flatYue('已儲存嘅主控台密碼刪除咗') },
  'console.notify.commandCopied': { en: flat('The command line was copied'), yue: flatYue('指令已複製') },
  'console.notify.exportSnapshot': { en: flat('Snapshot copied to the exports folder'), yue: flatYue('快照已複製到匯出資料夾') },
  'console.notify.exportSnapshotFailed': { en: flat('The snapshot was not copied'), yue: flatYue('快照複製唔到') },
  'console.notify.botStarted': { en: flat('The auto-explore bot is starting'), yue: flatYue('自動探索機械人啟動緊') },
  'console.notify.botStartFailed': { en: flat('The bot did not start'), yue: flatYue('機械人開唔到') },
  'console.notify.botStopped': { en: flat('The bot was stopped'), yue: flatYue('機械人已停止') },
  'console.notify.botStopFailed': { en: flat('The bot did not stop'), yue: flatYue('機械人停唔到') },
  'console.notify.botAuthStarted': { en: flat('The bot’s Microsoft sign-in is starting'), yue: flatYue('機械人嘅 Microsoft 登入開始緊') },
  'console.notify.botAuthFailed': { en: flat('The bot sign-in did not start'), yue: flatYue('機械人登入開始唔到') },
  'console.notify.unavailable': { en: flat('The console is not reachable right now'), yue: flatYue('而家連唔到主控台') },

  /* ---- settings ---- */
  'console.settings.section': {
    en: ['Web console', 'Web console', 'Console', 'The console’s own dials', 'The console’s own dials'],
    yue: ['網頁主控台', '網頁主控台', '主控台', '主控台自己嘅一堆掣', '主控台自己嘅一堆掣']
  },
  'console.settings.serviceDirectory': { en: flat('Console folder'), yue: flatYue('主控台資料夾') },
  'console.settings.serviceDirectory.description': {
    en: flat('The folder holding the console’s app.py, auth.py and requirements.txt. This is where the service is started from.'),
    yue: flatYue('存放主控台 app.py、auth.py 同 requirements.txt 嘅資料夾。服務就係由呢度開始。')
  },
  'console.settings.dataDirectory': { en: flat('Data directory'), yue: flatYue('資料目錄') },
  'console.settings.dataDirectory.description': {
    en: flat('The console’s DATA_DIR: worlds, the saved configuration, account records and snapshots all live here.'),
    yue: flatYue('主控台嘅 DATA_DIR：世界、已儲存設定、帳戶記錄同快照全部都喺呢度。')
  },
  'console.settings.pythonCommand': { en: flat('Python launcher'), yue: flatYue('Python 啟動器') },
  'console.settings.pythonCommand.description': {
    en: flat('Which Python command starts the console. Only bare launcher names the privileged bridge permits are offered.'),
    yue: flatYue('用邊個 Python 指令去開主控台。淨係俾特權橋接允許嘅純啟動器名。')
  },
  'console.settings.port': { en: flat('Console port'), yue: flatYue('主控台埠') },
  'console.settings.port.description': {
    en: flat('The loopback port the console listens on. The host is always 127.0.0.1; nothing here is exposed to the network.'),
    yue: flatYue('主控台監聽嘅本機埠。主機一定係 127.0.0.1，唔會開放俾網絡。')
  },
  'console.settings.jarPath': { en: flat('Downloader jar'), yue: flatYue('下載器 jar 檔') },
  'console.settings.jarPath.description': {
    en: flat('Path to world-downloader.jar, passed to the console as JAR_PATH. Left blank, the console uses its own default.'),
    yue: flatYue('world-downloader.jar 嘅路徑，會用 JAR_PATH 傳俾主控台。留空就用主控台自己嘅預設值。')
  },
  'console.settings.autoProbe': { en: flat('Poll automatically'), yue: flatYue('自動輪詢') },
  'console.settings.autoProbe.description': {
    en: flat('Checks the console’s health on a timer while this tab is open, instead of only on demand.'),
    yue: flatYue('呢個分頁開住嘅時候，會定時檢查主控台健康狀況，唔止靠手動。')
  },
  'console.settings.probeSeconds': { en: flat('Seconds between health checks'), yue: flatYue('健康檢查間隔（秒）') },
  'console.settings.probeSeconds.description': {
    en: flat('How often the health endpoint is polled while automatic polling is on.'),
    yue: flatYue('自動輪詢開住嘅時候，隔幾耐檢查一次健康端點。')
  },
  'console.settings.logSeconds': { en: flat('Seconds between log fetches'), yue: flatYue('紀錄擷取間隔（秒）') },
  'console.settings.logSeconds.description': {
    en: flat('How often new log lines are fetched while the console is running.'),
    yue: flatYue('主控台跑緊嘅時候，隔幾耐攞一次新紀錄行。')
  },
  'console.settings.logRetention': { en: flat('Log lines kept'), yue: flatYue('保留紀錄行數') },
  'console.settings.logRetention.description': {
    en: flat('How many log lines this surface keeps in memory before dropping the oldest. This does not change what the console itself retains.'),
    yue: flatYue('呢個介面喺記憶體保留幾多行紀錄，滿咗就丟最舊嗰啲。呢個唔會影響主控台自己保留幾多。')
  },
  'console.settings.logFollow': { en: flat('Follow the log'), yue: flatYue('跟住紀錄捲動') },
  'console.settings.logFollow.description': {
    en: flat('Keeps the log view scrolled to the newest line as it arrives.'),
    yue: flatYue('新紀錄行一到就自動捲落最底。')
  },
  'console.settings.scanDepth': { en: flat('World scan depth'), yue: flatYue('世界掃描深度') },
  'console.settings.scanDepth.description': {
    en: flat('How many folders deep a world measurement walks below the data directory before it stops counting and marks the total as a floor.'),
    yue: flatYue('量度一個世界嘅時候，喺資料目錄下面行幾多層資料夾先至停低，之後嘅總數就當做底線。')
  },
  'console.settings.scanCap': { en: flat('World scan file cap'), yue: flatYue('世界掃描檔案上限') },
  'console.settings.scanCap.description': {
    en: flat('Hard ceiling on files visited while measuring one world, so a scan of a huge world cannot run forever.'),
    yue: flatYue('量度一個世界嘅時候最多睇幾多個檔案，咁樣掃一個超大世界就唔會冇止境咁行落去。')
  },
  'console.settings.consoleUsername': { en: flat('Console sign-in username'), yue: flatYue('主控台登入用戶名') },
  'console.settings.consoleUsername.description': {
    en: flat('Username this application uses when it starts a console with its own login gate switched on.'),
    yue: flatYue('開啟咗自己登入閘嘅主控台嘅時候，呢個程式會用嘅用戶名。')
  },
  'console.settings.requireLogin': { en: flat('Start with the console’s login gate'), yue: flatYue('開機時開埋主控台登入閘') },
  'console.settings.requireLogin.description': {
    en: flat('Starts the console with WEB_PASSWORD set, so its own username and password gate is switched on. Requires a password to be stored first.'),
    yue: flatYue('用 WEB_PASSWORD 開主控台，等佢自己嘅用戶名密碼閘開住。要先儲低個密碼先得。')
  },
  'console.settings.storedPassword': { en: flat('Console password'), yue: flatYue('主控台密碼') },
  'console.settings.storedPassword.description': {
    en: flat('The console’s own login password, kept only in the operating system credential vault. It is read once, immediately before the console starts, and handed straight to the child process.'),
    yue: flatYue('主控台自己嘅登入密碼，淨係擺喺作業系統嘅保險箱入面。開主控台之前先讀一次，直接交俾子程序。')
  },
  'console.settings.storedPassword.warning': {
    en: flat('This is never displayed, exported or logged. Typing a new one replaces the stored value.'),
    yue: flatYue('呢個永遠唔會顯示、匯出或者寫入紀錄。打個新嘅就會取代舊嘅。')
  },
  'console.settings.storedPassword.status.set': { en: flat('A password is stored.'), yue: flatYue('已經有密碼儲存喺度。') },
  'console.settings.storedPassword.status.unset': { en: flat('No password is stored.'), yue: flatYue('未儲存密碼。') },
  'console.settings.storedPassword.status.unavailable': {
    en: flat('The operating system credential vault is not available, so a password cannot be stored here.'),
    yue: flatYue('作業系統嘅保險箱用唔到，所以呢度儲唔到密碼。')
  },
  'console.settings.rescanOnFocus': { en: flat('Rescan worlds when this tab regains focus'), yue: flatYue('分頁攞返焦點就重新掃描世界') },
  'console.settings.rescanOnFocus.description': {
    en: flat('Runs a fresh world scan automatically whenever this application’s window is focused again.'),
    yue: flatYue('程式視窗每次攞返焦點，就自動重新掃描一次世界。')
  },
  'console.settings.action.selfCheck': { en: flat('Check installation now'), yue: flatYue('即刻檢查安裝狀況') },
  'console.settings.action.selfCheck.description': {
    en: flat('Re-inspects the configured console folder and reports exactly what is found.'),
    yue: flatYue('重新檢查設定咗嗰個主控台資料夾，講返實際搵到啲乜。')
  },

  /* ---- palette ---- */
  'console.palette.open': { en: flat('Open the web console'), yue: flatYue('打開網頁主控台') },
  'console.palette.start': { en: flat('Start the console'), yue: flatYue('開啟主控台') },
  'console.palette.stop': { en: flat('Stop the console'), yue: flatYue('停止主控台') },
  'console.palette.scan': { en: flat('Scan for worlds'), yue: flatYue('掃描世界') },
  'console.palette.configuration': { en: flat('Console configuration'), yue: flatYue('主控台設定') },
  'console.palette.account': { en: flat('Console account'), yue: flatYue('主控台帳戶') },
  'console.palette.logs': { en: flat('Console logs'), yue: flatYue('主控台紀錄') },
  'console.palette.records': { en: flat('Console records'), yue: flatYue('主控台記錄') },
  'console.palette.worlds': { en: flat('Console worlds'), yue: flatYue('主控台世界') },
  'console.palette.settings': { en: flat('Console settings'), yue: flatYue('主控台設定頁') }
};

export const CONSOLE_STRINGS: Catalogue = {
  ...chrome,
  ...optionEntries,
  ...groupEntries
};
