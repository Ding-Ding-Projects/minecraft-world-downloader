import type { Catalogue } from '../../core/registry';

export const STRINGS: Catalogue = {
  'worldvaultrenders.tab': {
    en: ['Renders', 'Renders', 'Renders', 'Renders (the pretty pictures)', 'Renders (the pretty pictures)'],
    yue: ['渲染圖', '渲染圖', '渲染圖', '渲染圖（靚相嗰啲）', '渲染圖（靚相嗰啲）']
  },
  'worldvaultrenders.settings.title': {
    en: ['World Vault renders', 'World Vault renders', 'World Vault renders', 'World Vault renders', 'World Vault renders'],
    yue: ['世界保險庫渲染', '世界保險庫渲染', '世界保險庫渲染', '世界保險庫渲染', '世界保險庫渲染']
  },

  /* ---------------- settings ---------------- */
  'worldvaultrenders.enabled': {
    en: [
      'Render a map for each commit',
      'Render a map for each commit',
      'Render a map on every commit',
      'Snap a picture of every commit',
      'Snap a picture of every single commit'
    ],
    yue: ['每個提交都渲染地圖', '每個提交都渲染地圖', '每個 commit 都渲染番次', '每個 commit 都影低幅相', '每個 commit 都影低幅相，一個都唔漏']
  },
  'worldvaultrenders.enabled.description': {
    en: [
      'Off by default. Turning this on queues a full map render every time the vault makes a new commit, which costs real minutes of CPU time and a Java runtime, so it is never switched on silently.',
      'Off by default. Turning this on queues a full map render every time the vault makes a new commit, which costs real minutes of CPU time and a Java runtime, so it is never switched on silently.',
      'Off by default: switching it on queues a render on every new vault commit. Each render takes real minutes of CPU and needs Java, so it stays an explicit choice.',
      'Off by default, because each render genuinely eats minutes of CPU and wants a Java runtime standing by — flip it on and every new commit gets its own little photoshoot.',
      'Off by default, because each render genuinely eats minutes of CPU and wants a Java runtime standing by — flip it on and every new commit gets its own little photoshoot.'
    ],
    yue: [
      '預設為關閉。開咗之後，保險庫每次新增提交都會排隊做一次完整地圖渲染，會用真金白銀嘅 CPU 時間同埋 Java 運行環境，所以唔會靜靜雞幫你開。',
      '預設為關閉。開咗之後，保險庫每次新增提交都會排隊做一次完整地圖渲染，會用真金白銀嘅 CPU 時間同埋 Java 運行環境，所以唔會靜靜雞幫你開。',
      '預設關閉：開咗嘅話，每次 vault 有新 commit 都會排隊渲染。每次都要用幾分鐘 CPU 同 Java，所以要你自己揀先算。',
      '預設閂住，因為每次渲染真係要食幾分鐘 CPU，仲要有部 Java 喺度候命——撳開咗，每個新 commit 都有專屬寫真。',
      '預設閂住，因為每次渲染真係要食幾分鐘 CPU，仲要有部 Java 喺度候命——撳開咗，每個新 commit 都有專屬寫真。'
    ]
  },
  'worldvaultrenders.concurrency': {
    en: ['Renders running at once', 'Renders running at once', 'Renders running at once', 'How many renders run at once', 'How many renders run at once'],
    yue: ['同時渲染數量', '同時渲染數量', '同時渲染數量', '一齊做幾多個渲染', '一齊做幾多個渲染']
  },
  'worldvaultrenders.concurrency.description': {
    en: [
      'The maximum number of render jobs allowed to run at the same time. Higher uses more CPU and memory at once; it never affects whether a render starts, only how many can overlap.',
      'The maximum number of render jobs allowed to run at the same time. Higher uses more CPU and memory at once; it never affects whether a render starts, only how many can overlap.',
      'The most render jobs allowed to run together. A higher number uses more CPU and memory at once, but never changes whether a render happens — only how many overlap.',
      'The ceiling on how many renders are allowed to hog the CPU together. Crank it up and things finish sooner but your fans get louder.',
      'The ceiling on how many renders are allowed to hog the CPU together. Crank it up and things finish sooner but your fans get louder.'
    ],
    yue: [
      '容許同時運行嘅渲染工作上限。數值越大，同一時間會用更多 CPU 同記憶體；唔會影響會唔會開始渲染，只係影響幾多個可以疊埋一齊做。',
      '容許同時運行嘅渲染工作上限。數值越大，同一時間會用更多 CPU 同記憶體；唔會影響會唔會開始渲染，只係影響幾多個可以疊埋一齊做。',
      '容許一齊行嘅渲染工作上限。數值大啲就同時用多啲 CPU 同記憶體，唔會影響會唔會渲染，淨係影響幾多個一齊做。',
      '畀幾多個渲染一齊喺度爭 CPU 嘅上限。調高啲就做得快啲，不過部機把風扇會嘈啲。',
      '畀幾多個渲染一齊喺度爭 CPU 嘅上限。調高啲就做得快啲，不過部機把風扇會嘈啲。'
    ]
  },
  'worldvaultrenders.rendererPath': {
    en: ['Renderer file', 'Renderer file', 'Renderer file', 'The renderer file itself', 'The renderer file itself'],
    yue: ['渲染器檔案', '渲染器檔案', '渲染器檔案', '渲染器嗰個檔案', '渲染器嗰個檔案']
  },
  'worldvaultrenders.rendererPath.description': {
    en: [
      'The BlueMap-compatible renderer to run: either the BlueMap CLI jar or a Worldlens Node entry point. This application does not download a renderer for you; use the browse control to point at a file you already have.',
      'The BlueMap-compatible renderer to run: either the BlueMap CLI jar or a Worldlens Node entry point. This application does not download a renderer for you; use the browse control to point at a file you already have.',
      'The BlueMap-compatible renderer to run — the BlueMap CLI jar, or a Worldlens Node entry point. Nothing is downloaded automatically; browse to a copy you already have.',
      'The BlueMap-style renderer that does the actual drawing. Point this at a jar or a Node entry point you already have — this app will not sneak off and fetch one for you.',
      'The BlueMap-style renderer that does the actual drawing. Point this at a jar or a Node entry point you already have — this app will not sneak off and fetch one for you.'
    ],
    yue: [
      '要運行嘅 BlueMap 相容渲染器：可以係 BlueMap 嘅 CLI jar，或者 Worldlens 嘅 Node 入口檔。呢個應用程式唔會幫你落載渲染器，用瀏覽按鈕揀你已經有嘅檔案。',
      '要運行嘅 BlueMap 相容渲染器：可以係 BlueMap 嘅 CLI jar，或者 Worldlens 嘅 Node 入口檔。呢個應用程式唔會幫你落載渲染器，用瀏覽按鈕揀你已經有嘅檔案。',
      '要行嘅 BlueMap 相容渲染器——BlueMap 嘅 CLI jar，或者 Worldlens 嘅 Node 入口檔。乜都唔會自動落載，用瀏覽揀返個你已經有嘅檔案。',
      '真正落手畫圖嗰個 BlueMap 式渲染器。揀返個你自己有嘅 jar 或者 Node 檔——呢個 app 唔會偷偷幫你去攞。',
      '真正落手畫圖嗰個 BlueMap 式渲染器。揀返個你自己有嘅 jar 或者 Node 檔——呢個 app 唔會偷偷幫你去攞。'
    ]
  },
  'worldvaultrenders.acceptDownload': {
    en: ['Allow the renderer to fetch textures', 'Allow the renderer to fetch textures', 'Let the renderer fetch textures', 'Let the renderer go fetch its textures', 'Let the renderer go fetch its textures'],
    yue: ['容許渲染器下載材質', '容許渲染器下載材質', '畀渲染器去攞材質', '畀渲染器出去攞材質', '畀渲染器出去攞材質']
  },
  'worldvaultrenders.acceptDownload.description': {
    en: [
      'Off by default. The renderer needs Minecraft’s own client files for block textures; this is the explicit consent for it to fetch them over the network the first time. Left off, a render either uses textures already cached locally or fails saying exactly that — never a silent download.',
      'Off by default. The renderer needs Minecraft’s own client files for block textures; this is the explicit consent for it to fetch them over the network the first time. Left off, a render either uses textures already cached locally or fails saying exactly that — never a silent download.',
      'Off by default. The renderer needs Minecraft’s own client files for its block textures — this is the explicit go-ahead for one network fetch. Off, it either uses what is already cached or fails saying so, never a silent download.',
      'Off by default. Ticking this is the one explicit "yes, go fetch Minecraft’s texture files" moment — leave it off and the renderer either uses what is already on disk or tells you plainly it needs this switch.',
      'Off by default. Ticking this is the one explicit "yes, go fetch Minecraft’s texture files" moment — leave it off and the renderer either uses what is already on disk or tells you plainly it needs this switch.'
    ],
    yue: [
      '預設關閉。渲染器需要 Minecraft 官方嘅客戶端檔案嚟畫方塊材質；呢個係你明確同意佢第一次經網絡下載。閂住嘅話，渲染要嘛用返本機已經有嘅材質，要嘛老實話畀你知需要呢樣嘢——唔會靜雞雞落載。',
      '預設關閉。渲染器需要 Minecraft 官方嘅客戶端檔案嚟畫方塊材質；呢個係你明確同意佢第一次經網絡下載。閂住嘅話，渲染要嘛用返本機已經有嘅材質，要嘛老實話畀你知需要呢樣嘢——唔會靜雞雞落載。',
      '預設關閉。渲染器要用 Minecraft 官方客戶端檔案嚟畫材質——呢個係你俾一次網絡下載嘅明確同意。閂住嘅話就用返已有嘅，或者老實講畀你聽差咩，唔會靜雞雞落載。',
      '預設閂住。撳呢個掣就等於話「好啦去攞 Minecraft 嘅材質檔啦」——唔撳嘅話，渲染器就用返本機有嘅，或者老實話你知仲欠呢個掣。',
      '預設閂住。撳呢個掣就等於話「好啦去攞 Minecraft 嘅材質檔啦」——唔撳嘅話，渲染器就用返本機有嘅，或者老實話你知仲欠呢個掣。'
    ]
  },
  'worldvaultrenders.threads': {
    en: ['Render threads', 'Render threads', 'Render threads', 'Render threads', 'Render threads'],
    yue: ['渲染執行緒', '渲染執行緒', '渲染執行緒', '渲染 threads', '渲染 threads']
  },
  'worldvaultrenders.threads.description': {
    en: [
      '0 lets the renderer choose automatically, based on the machine’s CPU. A specific number pins it, which is useful on a shared machine that should not be fully occupied by a render.',
      '0 lets the renderer choose automatically, based on the machine’s CPU. A specific number pins it, which is useful on a shared machine that should not be fully occupied by a render.',
      '0 leaves it to the renderer to pick automatically from the machine’s CPU. A specific number pins it — handy on a shared machine that should not be entirely taken over.',
      '0 means "figure it out yourself" — the renderer picks a sensible thread count from the CPU. Pin a specific number if this machine has other jobs to do.',
      '0 means "figure it out yourself" — the renderer picks a sensible thread count from the CPU. Pin a specific number if this machine has other jobs to do.'
    ],
    yue: [
      '0 即係畀渲染器自己按 CPU 揀。設定一個實際數字就會鎖住咁多，喺一部要分俾其他工作嘅機度好有用。',
      '0 即係畀渲染器自己按 CPU 揀。設定一個實際數字就會鎖住咁多，喺一部要分俾其他工作嘅機度好有用。',
      '0 就係畀渲染器自己揀，跟返部機嘅 CPU。揀個實數就鎖死咁多——一部機仲有其他嘢做嘅話好用。',
      '0 即係「你自己諗掂佢」，渲染器會自己揀個合理數。呢部機仲有其他嘢做嘅話，就鎖返個實數。',
      '0 即係「你自己諗掂佢」，渲染器會自己揀個合理數。呢部機仲有其他嘢做嘅話，就鎖返個實數。'
    ]
  },
  'worldvaultrenders.backlogWarningThreshold': {
    en: ['Queue backlog warning', 'Queue backlog warning', 'Queue backlog warning', 'When to say the queue is falling behind', 'When to say the queue is falling behind'],
    yue: ['排隊積壓警告', '排隊積壓警告', '排隊積壓警告', '幾時話畀你知排隊追唔切', '幾時話畀你知排隊追唔切']
  },
  'worldvaultrenders.backlogWarningThreshold.description': {
    en: [
      'How many queued renders count as "falling behind". Past this many, queued entries are labelled behind and this application notifies once rather than staying silent while commits pile up.',
      'How many queued renders count as "falling behind". Past this many, queued entries are labelled behind and this application notifies once rather than staying silent while commits pile up.',
      'How many queued renders count as "falling behind". Beyond this, queued entries are labelled behind, and there is one notification rather than silence while commits pile up.',
      'The point where a growing queue stops being fine and starts being "behind" — past this many waiting renders, this app says so out loud, once, instead of just letting commits stack up quietly.',
      'The point where a growing queue stops being fine and starts being "behind" — past this many waiting renders, this app says so out loud, once, instead of just letting commits stack up quietly.'
    ],
    yue: [
      '幾多個排緊隊嘅渲染先算「追唔切」。超過呢個數，排隊項目會標示為落後，呢個應用程式會通知你一次，唔會靜靜雞睇住 commit 越疊越多。',
      '幾多個排緊隊嘅渲染先算「追唔切」。超過呢個數，排隊項目會標示為落後，呢個應用程式會通知你一次，唔會靜靜雞睇住 commit 越疊越多。',
      '幾多個排隊渲染先算「追唔切」。過咗呢個數，排隊項目就標做落後，會通知你一次，唔會靜雞雞由佢疊落去。',
      '排隊排到幾多個先算「唔妥」——過咗呢個數，呢個 app 就大聲講一次，唔會由得 commit 靜雞雞越疊越高。',
      '排隊排到幾多個先算「唔妥」——過咗呢個數，呢個 app 就大聲講一次，唔會由得 commit 靜雞雞越疊越高。'
    ]
  },

  /* ---------------- queue panel ---------------- */
  'worldvaultrenders.queue.title': {
    en: ['Render queue', 'Render queue', 'Render queue', 'The render queue', 'The render queue'],
    yue: ['渲染隊列', '渲染隊列', '渲染隊列', '渲染排隊嗰度', '渲染排隊嗰度']
  },
  'worldvaultrenders.queue.empty': {
    en: [
      'No renders yet. Turn on rendering in settings, or start one for a commit below.',
      'No renders yet. Turn on rendering in settings, or start one for a commit below.',
      'Nothing rendered yet. Turn it on in settings, or start one for a commit below.',
      'Nothing here yet — flip the setting on, or pick a commit below and give it a render.',
      'Nothing here yet — flip the setting on, or pick a commit below and give it a render.'
    ],
    yue: ['暫時未有渲染。可以喺設定度開啟，或者喺下面揀個提交開始渲染。', '暫時未有渲染。可以喺設定度開啟，或者喺下面揀個提交開始渲染。', '未有渲染。喺設定開返，或者喺下面揀個 commit 開始。', '呢度暫時得個吉——去設定開返個掣，或者喺下面揀個 commit 話畀佢知要影相。', '呢度暫時得個吉——去設定開返個掣，或者喺下面揀個 commit 話畀佢知要影相。']
  },
  'worldvaultrenders.queue.search': {
    en: ['Search renders', 'Search renders', 'Search the renders', 'Hunt down a render', 'Hunt down a render'],
    yue: ['搜尋渲染', '搜尋渲染', '搵下啲渲染', '搵返個渲染出嚟', '搵返個渲染出嚟']
  },
  'worldvaultrenders.queue.column.commit': {
    en: ['Commit', 'Commit', 'Commit', 'Commit', 'Commit'],
    yue: ['提交', '提交', '提交', 'Commit', 'Commit']
  },
  'worldvaultrenders.queue.column.status': {
    en: ['Status', 'Status', 'Status', 'Status', 'Status'],
    yue: ['狀態', '狀態', '狀態', '狀態', '狀態']
  },
  'worldvaultrenders.queue.column.progress': {
    en: ['Progress', 'Progress', 'Progress', 'How far along', 'How far along'],
    yue: ['進度', '進度', '進度', '做到邊', '做到邊']
  },
  'worldvaultrenders.queue.column.queuedAt': {
    en: ['Queued', 'Queued', 'Queued', 'Queued', 'Queued'],
    yue: ['排隊時間', '排隊時間', '排隊時間', '幾時排隊', '幾時排隊']
  },
  'worldvaultrenders.queue.selectAllShown': {
    en: ['Select all {count} shown', 'Select all {count} shown', 'Select all {count} shown', 'Grab all {count} shown here', 'Grab all {count} shown here'],
    yue: ['全選顯示緊嘅 {count} 個', '全選顯示緊嘅 {count} 個', '全選顯示緊嘅 {count} 個', '成 {count} 個顯示緊嘅一齊揀晒', '成 {count} 個顯示緊嘅一齊揀晒']
  },
  'worldvaultrenders.queue.selectAllMatching': {
    en: ['Select all {count} matching', 'Select all {count} matching', 'Select all {count} matching', 'Grab every one of the {count} matches', 'Grab every one of the {count} matches'],
    yue: ['全選符合嘅 {count} 個', '全選符合嘅 {count} 個', '全選符合嘅 {count} 個', '成 {count} 個啱嘅一齊揀晒', '成 {count} 個啱嘅一齊揀晒']
  },
  'worldvaultrenders.queue.selectInverse': {
    en: ['Invert selection', 'Invert selection', 'Invert selection', 'Flip the selection', 'Flip the selection'],
    yue: ['反轉選擇', '反轉選擇', '反轉選擇', '揀嘅反轉晒', '揀嘅反轉晒']
  },
  'worldvaultrenders.queue.bulkCancel': {
    en: ['Cancel {count} selected', 'Cancel {count} selected', 'Cancel {count} selected', 'Call off {count} selected', 'Call off {count} selected'],
    yue: ['取消已選 {count} 個', '取消已選 {count} 個', '取消已選 {count} 個', '成 {count} 個揀咗嘅唔做喇', '成 {count} 個揀咗嘅唔做喇']
  },
  'worldvaultrenders.queue.bulkRetry': {
    en: ['Retry {count} selected', 'Retry {count} selected', 'Retry {count} selected', 'Give {count} selected another go', 'Give {count} selected another go'],
    yue: ['重試已選 {count} 個', '重試已選 {count} 個', '重試已選 {count} 個', '成 {count} 個揀咗嘅再嚟多次', '成 {count} 個揀咗嘅再嚟多次']
  },
  'worldvaultrenders.queue.bulkExport': {
    en: ['Export {count} selected', 'Export {count} selected', 'Export {count} selected', 'Export {count} selected', 'Export {count} selected'],
    yue: ['匯出已選 {count} 個', '匯出已選 {count} 個', '匯出已選 {count} 個', '匯出已揀嘅 {count} 個', '匯出已揀嘅 {count} 個']
  },
  'worldvaultrenders.queue.cancel': {
    en: ['Cancel', 'Cancel', 'Cancel', 'Call it off', 'Call it off'],
    yue: ['取消', '取消', '取消', '唔做喇', '唔做喇']
  },
  'worldvaultrenders.queue.retry': {
    en: ['Retry', 'Retry', 'Retry', 'Have another go', 'Have another go'],
    yue: ['重試', '重試', '重試', '再嚟一次', '再嚟一次']
  },
  'worldvaultrenders.queue.viewRender': {
    en: ['View in browser', 'View in browser', 'View in browser', 'Pop it open in the browser', 'Pop it open in the browser'],
    yue: ['喺瀏覽器打開', '喺瀏覽器打開', '喺瀏覽器打開', '喺瀏覽器度彈出嚟睇', '喺瀏覽器度彈出嚟睇']
  },
  'worldvaultrenders.queue.enqueue': {
    en: ['Render this commit', 'Render this commit', 'Render this commit', 'Give this commit a render', 'Give this commit a render'],
    yue: ['渲染呢個提交', '渲染呢個提交', '渲染呢個提交', '幫呢個 commit 影張相', '幫呢個 commit 影張相']
  },

  /* ---------------- status chips ---------------- */
  'worldvaultrenders.status.queued': { en: ['Queued', 'Queued', 'Queued', 'In line', 'In line'], yue: ['排隊中', '排隊中', '排隊中', '排緊隊', '排緊隊'] },
  'worldvaultrenders.status.behind': {
    en: ['Queued (behind)', 'Queued (behind)', 'Queued (behind)', 'In line, and the line is long', 'In line, and the line is long'],
    yue: ['排隊中（落後）', '排隊中（落後）', '排隊中（落後）', '排緊隊，仲要排好耐', '排緊隊，仲要排好耐']
  },
  'worldvaultrenders.status.exporting': { en: ['Exporting', 'Exporting', 'Exporting', 'Pulling the commit out', 'Pulling the commit out'], yue: ['匯出緊', '匯出緊', '匯出緊', '拎緊個 commit 出嚟', '拎緊個 commit 出嚟'] },
  'worldvaultrenders.status.rendering': { en: ['Rendering', 'Rendering', 'Rendering', 'Drawing away', 'Drawing away'], yue: ['渲染緊', '渲染緊', '渲染緊', '畫緊圖', '畫緊圖'] },
  'worldvaultrenders.status.finished': { en: ['Finished', 'Finished', 'Finished', 'Done and dusted', 'Done and dusted'], yue: ['完成', '完成', '完成', '搞掂', '搞掂'] },
  'worldvaultrenders.status.failed': { en: ['Failed', 'Failed', 'Failed', 'Went sideways', 'Went sideways'], yue: ['失敗', '失敗', '失敗', '搞唔掂', '搞唔掂'] },
  'worldvaultrenders.status.cancelled': { en: ['Cancelled', 'Cancelled', 'Cancelled', 'Called off', 'Called off'], yue: ['已取消', '已取消', '已取消', '唔做咗', '唔做咗'] },
  'worldvaultrenders.status.noRenderYet': {
    en: [
      'No render for this commit yet',
      'No render for this commit yet',
      'This commit has no render yet',
      'Nothing rendered here yet — this is not another commit’s picture',
      'Nothing rendered here yet — this is not another commit’s picture'
    ],
    yue: ['呢個提交暫時未有渲染', '呢個提交暫時未有渲染', '呢個 commit 未渲染過', '呢度未渲染過，唔係影咗另一個 commit 嘅相畀你睇', '呢度未渲染過，唔係影咗另一個 commit 嘅相畀你睇']
  },

  /* ---------------- failures and recovery ---------------- */
  'worldvaultrenders.failure.javaMissing': {
    en: ['No Java runtime was found', 'No Java runtime was found', 'No Java runtime found', 'No Java to be found anywhere', 'No Java to be found anywhere'],
    yue: ['搵唔到 Java 運行環境', '搵唔到 Java 運行環境', '搵唔到 Java', '周圍都搵唔到部 Java', '周圍都搵唔到部 Java']
  },
  'worldvaultrenders.failure.rendererNotConfigured': {
    en: ['No renderer file is configured', 'No renderer file is configured', 'No renderer file configured', 'Nobody told this app which renderer to use', 'Nobody told this app which renderer to use'],
    yue: ['未設定渲染器檔案', '未設定渲染器檔案', '未設定渲染器', '無人話畀呢個 app 知用邊個渲染器', '無人話畀呢個 app 知用邊個渲染器']
  },
  'worldvaultrenders.failure.rendererInvalid': {
    en: ['The configured renderer file is not usable', 'The configured renderer file is not usable', 'The renderer file is not usable', 'The renderer file it was pointed at is no good', 'The renderer file it was pointed at is no good'],
    yue: ['已設定嘅渲染器檔案用唔到', '已設定嘅渲染器檔案用唔到', '渲染器檔案用唔到', '揀咗嘅渲染器檔案唔啱用', '揀咗嘅渲染器檔案唔啱用']
  },
  'worldvaultrenders.failure.exportFailed': {
    en: ['The commit could not be exported', 'The commit could not be exported', 'The commit could not be exported', 'Could not pull that commit out to render it', 'Could not pull that commit out to render it'],
    yue: ['呢個提交匯出唔到', '呢個提交匯出唔到', '呢個提交匯出唔到', '拎唔到嗰個 commit 出嚟渲染', '拎唔到嗰個 commit 出嚟渲染']
  },
  'worldvaultrenders.failure.spawnFailed': {
    en: ['The renderer could not be started', 'The renderer could not be started', 'The renderer could not be started', 'The renderer refused to even start', 'The renderer refused to even start'],
    yue: ['渲染器啟動唔到', '渲染器啟動唔到', '渲染器啟動唔到', '渲染器連開都開唔到', '渲染器連開都開唔到']
  },
  'worldvaultrenders.failure.renderFailed': {
    en: ['The render failed', 'The render failed', 'The render failed', 'The render fell over', 'The render fell over'],
    yue: ['渲染失敗', '渲染失敗', '渲染失敗', '渲染死咗', '渲染死咗']
  },
  'worldvaultrenders.failure.detail': {
    en: ['Detail: {detail}', 'Detail: {detail}', 'Detail: {detail}', 'What actually happened: {detail}', 'What actually happened: {detail}'],
    yue: ['詳情：{detail}', '詳情：{detail}', '詳情：{detail}', '實際發生咩事：{detail}', '實際發生咩事：{detail}']
  },
  'worldvaultrenders.recovery.javaMissing': {
    en: [
      'Install a Java runtime, then retry this render.',
      'Install a Java runtime, then retry this render.',
      'Install a Java runtime, then retry this render.',
      'Go grab yourself a Java runtime, then try this one again.',
      'Go grab yourself a Java runtime, then try this one again.'
    ],
    yue: ['安裝一個 Java 運行環境，然後重試呢個渲染。', '安裝一個 Java 運行環境，然後重試呢個渲染。', '裝返個 Java，然後重試。', '去裝返部 Java，之後再試多次。', '去裝返部 Java，之後再試多次。']
  },
  'worldvaultrenders.recovery.rendererMissing': {
    en: [
      'Choose a renderer file in settings, or get one from the BlueMap releases page, then retry.',
      'Choose a renderer file in settings, or get one from the BlueMap releases page, then retry.',
      'Choose a renderer file in settings, or get one from the BlueMap releases page, then retry.',
      'Point settings at a renderer file, or go grab one from the BlueMap releases page, then try again.',
      'Point settings at a renderer file, or go grab one from the BlueMap releases page, then try again.'
    ],
    yue: ['去設定揀返個渲染器檔案，或者去 BlueMap 發布頁攞一個，然後重試。', '去設定揀返個渲染器檔案，或者去 BlueMap 發布頁攞一個，然後重試。', '去設定揀個渲染器，或者去 BlueMap 發布頁攞一個，之後重試。', '去設定揀返個渲染器檔案，或者去 BlueMap 個發布頁攞一個返嚟，之後再試。', '去設定揀返個渲染器檔案，或者去 BlueMap 個發布頁攞一個返嚟，之後再試。']
  },
  'worldvaultrenders.recovery.openReleases': {
    en: ['Open the BlueMap releases page', 'Open the BlueMap releases page', 'Open BlueMap releases', 'Go and get one', 'Go and get one'],
    yue: ['打開 BlueMap 發布頁', '打開 BlueMap 發布頁', '打開 BlueMap 發布頁', '去攞一個返嚟', '去攞一個返嚟']
  },
  'worldvaultrenders.recovery.browseRenderer': {
    en: ['Choose a renderer file', 'Choose a renderer file', 'Choose a renderer file', 'Pick a renderer file', 'Pick a renderer file'],
    yue: ['揀渲染器檔案', '揀渲染器檔案', '揀渲染器檔案', '揀返個渲染器檔案', '揀返個渲染器檔案']
  },

  /* ---------------- backlog notification ---------------- */
  'worldvaultrenders.backlog.title': {
    en: ['The render queue is falling behind', 'The render queue is falling behind', 'The render queue is falling behind', 'The render queue is getting a bit of a tail', 'The render queue is getting a bit of a tail'],
    yue: ['渲染隊列開始追唔切', '渲染隊列開始追唔切', '渲染隊列開始追唔切', '渲染隊排到有條尾', '渲染隊排到有條尾']
  },
  'worldvaultrenders.backlog.body': {
    en: [
      '{count} renders are waiting. Nothing is being dropped; they will run in order.',
      '{count} renders are waiting. Nothing is being dropped; they will run in order.',
      '{count} renders are waiting. Nothing is dropped — they will run in order.',
      '{count} renders are queued up and waiting their turn. Nobody is being skipped, they are just queuing.',
      '{count} renders are queued up and waiting their turn. Nobody is being skipped, they are just queuing.'
    ],
    yue: ['有 {count} 個渲染排緊隊。乜都唔會丟低，會跟順序做。', '有 {count} 個渲染排緊隊。乜都唔會丟低，會跟順序做。', '{count} 個渲染排緊隊，乜都唔會漏，會跟順序做。', '有 {count} 個渲染排緊隊等緊入位，冇邊個俾人跳過，淨係要排隊啫。', '有 {count} 個渲染排緊隊等緊入位，冇邊個俾人跳過，淨係要排隊啫。']
  },

  /* ---------------- comparison ---------------- */
  'worldvaultrenders.compare.title': {
    en: ['Compare two commits', 'Compare two commits', 'Compare two commits', 'Compare two commits', 'Compare two commits'],
    yue: ['比較兩個提交', '比較兩個提交', '比較兩個提交', '比較兩個 commit', '比較兩個 commit']
  },
  'worldvaultrenders.compare.left': { en: ['Left / before', 'Left / before', 'Left / before', 'Left / before', 'Left / before'], yue: ['左邊／之前', '左邊／之前', '左邊／之前', '左邊／之前', '左邊／之前'] },
  'worldvaultrenders.compare.right': { en: ['Right / after', 'Right / after', 'Right / after', 'Right / after', 'Right / after'], yue: ['右邊／之後', '右邊／之後', '右邊／之後', '右邊／之後', '右邊／之後'] },
  'worldvaultrenders.compare.pickPrompt': {
    en: ['Choose two commits to compare.', 'Choose two commits to compare.', 'Choose two commits to compare.', 'Pick two commits and let’s see what changed.', 'Pick two commits and let’s see what changed.'],
    yue: ['揀兩個提交嚟比較。', '揀兩個提交嚟比較。', '揀兩個提交嚟比較。', '揀兩個 commit，睇下有咩變咗。', '揀兩個 commit，睇下有咩變咗。']
  },
  'worldvaultrenders.compare.run': {
    en: ['Compare', 'Compare', 'Compare', 'Show me the difference', 'Show me the difference'],
    yue: ['比較', '比較', '比較', '睇下有咩唔同', '睇下有咩唔同']
  },
  'worldvaultrenders.compare.mode': { en: ['Comparison view', 'Comparison view', 'Comparison view', 'How to look at it', 'How to look at it'], yue: ['比較檢視', '比較檢視', '比較檢視', '點樣睇法', '點樣睇法'] },
  'worldvaultrenders.compare.mode.slider': { en: ['Slider', 'Slider', 'Slider', 'Drag a slider', 'Drag a slider'], yue: ['拉桿', '拉桿', '拉桿', '拖拉桿', '拖拉桿'] },
  'worldvaultrenders.compare.mode.toggle': { en: ['Toggle', 'Toggle', 'Toggle', 'Flip between them', 'Flip between them'], yue: ['切換', '切換', '切換', '兩邊撳嚟撳去', '兩邊撳嚟撳去'] },
  'worldvaultrenders.compare.mode.sideBySide': { en: ['Side by side', 'Side by side', 'Side by side', 'Both at once', 'Both at once'], yue: ['並排', '並排', '並排', '兩邊一齊睇', '兩邊一齊睇'] },
  'worldvaultrenders.compare.openVisual': {
    en: ['Open visual comparison', 'Open visual comparison', 'Open visual comparison', 'Open the visual side of things', 'Open the visual side of things'],
    yue: ['打開視覺比較', '打開視覺比較', '打開視覺比較', '打開個靚相比較', '打開個靚相比較']
  },
  'worldvaultrenders.compare.stopVisual': {
    en: ['Stop serving both renders', 'Stop serving both renders', 'Stop serving both renders', 'Stop showing both of these off', 'Stop showing both of these off'],
    yue: ['停止提供兩邊渲染', '停止提供兩邊渲染', '停止提供兩邊渲染', '收檔，唔再展示呢兩個喇', '收檔，唔再展示呢兩個喇']
  },
  'worldvaultrenders.compare.needsBothRendered': {
    en: [
      'Both commits need a finished render before they can be compared visually. Use the word comparison below in the meantime.',
      'Both commits need a finished render before they can be compared visually. Use the word comparison below in the meantime.',
      'Both commits need a finished render first. Use the word comparison below in the meantime.',
      'Both of these need a finished render before there is anything to look at side by side. The word comparison below already works right now, though.',
      'Both of these need a finished render before there is anything to look at side by side. The word comparison below already works right now, though.'
    ],
    yue: ['兩個提交都要先有完成咗嘅渲染，先可以視覺比較。同時可以用返下面嘅文字比較。', '兩個提交都要先有完成咗嘅渲染，先可以視覺比較。同時可以用返下面嘅文字比較。', '兩個都要有完成咗嘅渲染先可以並排睇。可以先用返下面文字比較。', '呢兩個都要先渲染完，先有嘢俾你並排睇。不過下面嗰個文字比較而家就用得。', '呢兩個都要先渲染完，先有嘢俾你並排睇。不過下面嗰個文字比較而家就用得。']
  },
  'worldvaultrenders.compare.summary': {
    en: [
      '{regions} regions differ: {added} chunks added, {removed} removed, {changed} changed.',
      '{regions} regions differ: {added} chunks added, {removed} removed, {changed} changed.',
      '{regions} regions differ: {added} chunks added, {removed} removed, {changed} changed.',
      '{regions} regions are different — {added} chunks new, {removed} gone, {changed} rewritten.',
      '{regions} regions are different — {added} chunks new, {removed} gone, {changed} rewritten.'
    ],
    yue: ['有 {regions} 個區域唔同：新增 {added} 個區塊，移除 {removed} 個，改咗 {changed} 個。', '有 {regions} 個區域唔同：新增 {added} 個區塊，移除 {removed} 個，改咗 {changed} 個。', '{regions} 個區域唔同：新增 {added}、移除 {removed}、改咗 {changed} 個區塊。', '有 {regions} 個區域唔同咗——新增 {added} 個 chunk，冇咗 {removed} 個，改寫咗 {changed} 個。', '有 {regions} 個區域唔同咗——新增 {added} 個 chunk，冇咗 {removed} 個，改寫咗 {changed} 個。']
  },
  'worldvaultrenders.compare.noDifference': {
    en: [
      'No region files differ between these two commits.',
      'No region files differ between these two commits.',
      'No region files differ between these two commits.',
      'These two commits are identical, region-file for region-file.',
      'These two commits are identical, region-file for region-file.'
    ],
    yue: ['呢兩個提交嘅區域檔案完全一樣。', '呢兩個提交嘅區域檔案完全一樣。', '呢兩個提交嘅區域檔完全一樣。', '呢兩個 commit 逐個區域檔都一模一樣。', '呢兩個 commit 逐個區域檔都一模一樣。']
  },
  'worldvaultrenders.compare.unreadable': {
    en: [
      '{count} region file(s) could not be read and were left out of the totals above.',
      '{count} region file(s) could not be read and were left out of the totals above.',
      '{count} region file(s) could not be read and were left out of the totals above.',
      '{count} region file(s) would not read, so they are not in the numbers above — nothing was guessed for them.',
      '{count} region file(s) would not read, so they are not in the numbers above — nothing was guessed for them.'
    ],
    yue: ['有 {count} 個區域檔案讀唔到，冇計入上面嘅總數。', '有 {count} 個區域檔案讀唔到，冇計入上面嘅總數。', '{count} 個區域檔讀唔到，冇計入上面總數。', '{count} 個區域檔讀唔到，所以冇計入上面個數——冇亂估。', '{count} 個區域檔讀唔到，所以冇計入上面個數——冇亂估。']
  },
  'worldvaultrenders.compare.column.dimension': { en: ['Dimension', 'Dimension', 'Dimension', 'Dimension', 'Dimension'], yue: ['維度', '維度', '維度', '維度', '維度'] },
  'worldvaultrenders.compare.column.region': { en: ['Region file', 'Region file', 'Region file', 'Region file', 'Region file'], yue: ['區域檔案', '區域檔案', '區域檔案', '區域檔', '區域檔'] },
  'worldvaultrenders.compare.column.status': { en: ['Change', 'Change', 'Change', 'What happened', 'What happened'], yue: ['變化', '變化', '變化', '發生咗咩', '發生咗咩'] },
  'worldvaultrenders.compare.column.chunks': { en: ['Chunks +/-/~', 'Chunks +/-/~', 'Chunks +/-/~', 'Chunks +/-/~', 'Chunks +/-/~'], yue: ['區塊 +/-/~', '區塊 +/-/~', '區塊 +/-/~', '區塊 +/-/~', '區塊 +/-/~'] },
  'worldvaultrenders.compare.regionAdded': { en: ['added', 'added', 'added', 'brand new', 'brand new'], yue: ['新增', '新增', '新增', '全新', '全新'] },
  'worldvaultrenders.compare.regionRemoved': { en: ['removed', 'removed', 'removed', 'gone', 'gone'], yue: ['移除', '移除', '移除', '冇咗', '冇咗'] },
  'worldvaultrenders.compare.regionChanged': { en: ['changed', 'changed', 'changed', 'rewritten', 'rewritten'], yue: ['改變', '改變', '改變', '改寫咗', '改寫咗'] },

  /* ---------------- palette ---------------- */
  'worldvaultrenders.palette.open': {
    en: ['Open the render queue', 'Open the render queue', 'Open the render queue', 'Open the render queue', 'Open the render queue'],
    yue: ['打開渲染隊列', '打開渲染隊列', '打開渲染隊列', '打開渲染隊列', '打開渲染隊列']
  },
  'worldvaultrenders.palette.settings': {
    en: ['Open World Vault render settings', 'Open World Vault render settings', 'Open World Vault render settings', 'Open World Vault render settings', 'Open World Vault render settings'],
    yue: ['打開世界保險庫渲染設定', '打開世界保險庫渲染設定', '打開世界保險庫渲染設定', '打開世界保險庫渲染設定', '打開世界保險庫渲染設定']
  },

  /* ---------------- disk usage ---------------- */
  'worldvaultrenders.disk.exportRoot': {
    en: ['Exported snapshots folder', 'Exported snapshots folder', 'Exported snapshots folder', 'Where the exported snapshots live', 'Where the exported snapshots live'],
    yue: ['匯出快照資料夾', '匯出快照資料夾', '匯出快照資料夾', '匯出快照擺喺邊', '匯出快照擺喺邊']
  },
  'worldvaultrenders.disk.outputRoot': {
    en: ['Rendered maps folder', 'Rendered maps folder', 'Rendered maps folder', 'Where the rendered maps live', 'Where the rendered maps live'],
    yue: ['渲染地圖資料夾', '渲染地圖資料夾', '渲染地圖資料夾', '渲染地圖擺喺邊', '渲染地圖擺喺邊']
  },
  'worldvaultrenders.disk.description': {
    en: [
      'Every render keeps an exported world snapshot and its rendered web output on disk, and this application does not currently have a way to delete either through its own interface. Open either folder below and remove old ones by hand when they take up more space than is welcome.',
      'Every render keeps an exported world snapshot and its rendered web output on disk, and this application does not currently have a way to delete either through its own interface. Open either folder below and remove old ones by hand when they take up more space than is welcome.',
      'Every render keeps an exported snapshot and its rendered output on disk. This app cannot delete either from inside itself yet — open a folder below and clear old ones by hand.',
      'Every render leaves an exported snapshot and its rendered output sitting on disk, and this app cannot yet delete either one itself — open the folder below and have a clear-out by hand when it gets too big for its boots.',
      'Every render leaves an exported snapshot and its rendered output sitting on disk, and this app cannot yet delete either one itself — open the folder below and have a clear-out by hand when it gets too big for its boots.'
    ],
    yue: ['每次渲染都會喺硬碟度留低一個匯出咗嘅世界快照同埋渲染出嚟嘅網頁輸出，而呢個應用程式目前喺自己介面入面冇辦法刪除。想清理嘅話，用下面嘅按鈕打開資料夾，自己手動刪走舊嘅。', '每次渲染都會喺硬碟度留低一個匯出咗嘅世界快照同埋渲染出嚟嘅網頁輸出，而呢個應用程式目前喺自己介面入面冇辦法刪除。想清理嘅話，用下面嘅按鈕打開資料夾，自己手動刪走舊嘅。', '每次渲染都留低匯出快照同渲染輸出喺硬碟。呢個 app 而家自己刪唔到，打開資料夾自己手動清返啲舊嘅。', '每次渲染都會喺硬碟留低一份匯出快照同埋渲染成品，而呢個 app 而家自己仲刪唔到——打開落面個資料夾，太大就自己手動清返啲舊嘢。', '每次渲染都會喺硬碟留低一份匯出快照同埋渲染成品，而呢個 app 而家自己仲刪唔到——打開落面個資料夾，太大就自己手動清返啲舊嘢。']
  },
  'worldvaultrenders.disk.reveal': {
    en: ['Reveal in file manager', 'Reveal in file manager', 'Reveal in file manager', 'Show me where it lives', 'Show me where it lives'],
    yue: ['喺檔案總管顯示', '喺檔案總管顯示', '喺檔案總管顯示', '帶我去睇下佢瞓喺邊', '帶我去睇下佢瞓喺邊']
  }
};
