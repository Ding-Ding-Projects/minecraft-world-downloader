import type { Catalogue, FunnyLadder, TranslationEntry } from '../../core/registry';

/**
 * Every piece of chrome this feature renders, in English and in playful Hong
 * Kong Cantonese, at all five humour levels.
 *
 * The rule the ladders keep: humour styles the VOICE and never the FACTS. A
 * verdict is still a verdict at level five, a deletion still names what goes,
 * and every figure a reader has to act on — a size, a count, an address, a
 * refusal reason — is interpolated rather than rewritten, so it reads the same
 * on every rung and in both languages.
 *
 * One thing is deliberately not in here, and the surface says so where it
 * appears: the arithmetic behind a hardware-fit verdict and the runtime's own
 * status and error lines are reported verbatim in English. They are measured
 * facts and quoted output rather than copy, and translating a quoted refusal
 * would make it something the runtime did not say.
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

export const MODELS_STRINGS: Catalogue = {
  /* ---------------- destinations ---------------- */

  'models.tab.overview': entry(ladder('Local models'), ladder('本機模型')),
  'models.tab.store': entry(ladder('Model store'), ladder('模型倉')),
  'models.tab.chat': entry(ladder('Model chat'), ladder('模型傾偈')),
  'models.tab.harness': entry(ladder('Harness profiles'), ladder('啟動設定檔')),

  'models.overview.title': entry(ladder('Local model runtime'), ladder('本機模型執行環境')),
  'models.overview.subtitle': entry(
    ladder(
      'Health, installed models and the hardware evidence every fit verdict is computed from.',
      'Health, installed models and the hardware evidence every fit verdict is computed from.',
      'Is it alive, what has it got, and what this machine can actually carry.',
      'Is it alive, what has it got, and exactly how much this poor machine can carry before it starts wheezing.',
      'Is it alive, what has it got, and exactly how much this poor machine can carry before it starts wheezing.'
    ),
    ladder(
      '執行狀態、已安裝模型，同埋每個硬件評估所根據嘅實測證據。',
      '執行狀態、已安裝模型，同埋每個硬件評估所根據嘅實測證據。',
      '仲喺唔喺度、有啲乜、同埋部機究竟孭得起幾多。',
      '仲喺唔喺度、有啲乜、同埋部機究竟孭得起幾多先開始喘氣。',
      '仲喺唔喺度、有啲乜、同埋部機究竟孭得起幾多先開始喘氣。'
    )
  ),

  /* ---------------- health ---------------- */

  'models.health.title': entry(ladder('Runtime health'), ladder('執行環境狀態')),
  'models.health.check': entry(
    ladder('Check the runtime', 'Check the runtime', 'Check the runtime', 'Poke the runtime and see if it answers', 'Poke the runtime and see if it answers'),
    ladder('檢查執行環境', '檢查執行環境', '檢查執行環境', '篤下佢睇下應唔應', '篤下佢睇下應唔應')
  ),
  'models.health.reachable': entry(
    ladder('The runtime answered at {address}. Version {version}, {latency} round trip.'),
    ladder('執行環境喺 {address} 有應。版本 {version}，來回 {latency}。')
  ),
  'models.health.unreachable': entry(
    ladder(
      'The runtime at {address} did not answer. {reason}',
      'The runtime at {address} did not answer. {reason}',
      'Nothing answered at {address}. {reason}',
      'Complete silence from {address}. {reason}',
      'Complete silence from {address}. {reason}'
    ),
    ladder(
      '{address} 嘅執行環境冇應。{reason}',
      '{address} 嘅執行環境冇應。{reason}',
      '{address} 嗰邊靜英英，冇人應。{reason}',
      '{address} 嗰邊靜到得返回音。{reason}',
      '{address} 嗰邊靜到得返回音。{reason}'
    )
  ),
  'models.health.never': entry(
    ladder('The runtime has not been checked yet in this session.'),
    ladder('今次未檢查過執行環境。')
  ),

  'models.troubleshoot.title': entry(ladder('What to do about it'), ladder('可以點做')),
  'models.troubleshoot.notInstalled': entry(
    ladder(
      'Nothing is listening on {address}. Install the model runtime from its own official installer for {platform}, then run the check again. This application never downloads or installs it for you, and never runs an installer you did not start.'
    ),
    ladder(
      '{address} 冇嘢聽住。請用 {platform} 嘅官方安裝程式裝好模型執行環境，然後再檢查一次。呢個應用程式唔會幫你下載或者安裝，亦都唔會走去執行你冇撳過嘅安裝程式。'
    )
  ),
  'models.troubleshoot.stopped': entry(
    ladder(
      'The address is valid but the service is not running. Start it the way you normally start it on {platform}, then run the check again.'
    ),
    ladder('地址啱，但個服務未行。用你平時喺 {platform} 開佢嘅方法開返，然後再檢查一次。')
  ),
  'models.troubleshoot.refused': entry(
    ladder(
      'Something answered at {address} but refused the request: {reason} Check that the address points at the model runtime and not at another service on the same port.'
    ),
    ladder('{address} 有嘢應，但拒絕咗個請求：{reason} 睇下個地址係咪指住模型執行環境，唔係同一個連接埠上面另一個服務。')
  ),
  'models.troubleshoot.retry': entry(ladder('Check again'), ladder('再檢查一次')),
  'models.troubleshoot.openDocs': entry(ladder('Open the bundled guide'), ladder('打開內置指南')),
  'models.troubleshoot.returnTo': entry(
    ladder('Return to what you were doing: {action}'),
    ladder('返去頭先做緊嘅嘢：{action}')
  ),
  'models.troubleshoot.offlineNote': entry(
    ladder(
      'Everything below still works without the runtime: the last verified catalog, saved chats, harness profiles, snapshots and this guide are all local.'
    ),
    ladder('下面啲嘢冇執行環境一樣用得：上次驗證過嘅目錄、儲低嘅對話、設定檔、快照同呢份指南全部都喺本機。')
  ),

  /* ---------------- installed ---------------- */

  'models.installed.title': entry(ladder('Installed models'), ladder('已安裝模型')),
  'models.installed.search': entry(ladder('Search installed models'), ladder('搵已安裝模型')),
  'models.installed.empty.title': entry(ladder('Nothing is installed yet'), ladder('未裝過任何模型')),
  'models.installed.empty.body': entry(
    ladder(
      'The runtime answered and holds no models. Open the Model store to browse the catalog and queue one.',
      'The runtime answered and holds no models. Open the Model store to browse the catalog and queue one.',
      'The runtime is up and completely empty. Head to the Model store and queue something.',
      'The runtime is up, awake, and holding absolutely nothing. Off to the Model store with you.',
      'The runtime is up, awake, and holding absolutely nothing. Off to the Model store with you.'
    ),
    ladder(
      '執行環境有應，但一個模型都冇。去模型倉睇下目錄，揀個排隊落載。',
      '執行環境有應，但一個模型都冇。去模型倉睇下目錄，揀個排隊落載。',
      '行係行緊，不過吉桶一個。去模型倉揀個返嚟先。',
      '行係行緊，精神奕奕，但係空空如也。快啲去模型倉揀個返嚟。',
      '行係行緊，精神奕奕，但係空空如也。快啲去模型倉揀個返嚟。'
    )
  ),
  'models.installed.stale': entry(
    ladder('This list was read at {time} and the runtime is not answering now, so it may be out of date.'),
    ladder('呢個清單喺 {time} 讀返嚟，而家執行環境冇應，所以可能唔係最新。')
  ),
  'models.column.name': entry(ladder('Model'), ladder('模型')),
  'models.column.tag': entry(ladder('Tag'), ladder('標籤')),
  'models.column.size': entry(ladder('Size'), ladder('大小')),
  'models.column.download': entry(ladder('Download'), ladder('下載量')),
  'models.column.parameters': entry(ladder('Parameters'), ladder('參數量')),
  'models.column.quantization': entry(ladder('Quantization'), ladder('量化')),
  'models.column.family': entry(ladder('Family'), ladder('系列')),
  'models.column.context': entry(ladder('Context'), ladder('上下文')),
  'models.column.capabilities': entry(ladder('Capabilities'), ladder('能力')),
  'models.column.state': entry(ladder('State'), ladder('狀態')),
  'models.column.fit': entry(ladder('Hardware fit'), ladder('硬件評估')),
  'models.column.modified': entry(ladder('Last changed'), ladder('最後改動')),
  'models.state.installed': entry(ladder('Installed'), ladder('已安裝')),
  'models.state.running': entry(ladder('Loaded'), ladder('已載入')),
  'models.state.catalog': entry(ladder('Not installed'), ladder('未安裝')),

  /* ---------------- actions ---------------- */

  'models.action.refresh': entry(ladder('Refresh'), ladder('重新讀取')),
  'models.action.delete': entry(ladder('Delete'), ladder('刪除')),
  'models.action.copy': entry(ladder('Copy to a new name'), ladder('複製做新名')),
  'models.action.export': entry(ladder('Export'), ladder('匯出')),
  'models.action.details': entry(ladder('Details'), ladder('詳情')),
  'models.action.selectShown': entry(ladder('Select the {count} shown'), ladder('揀晒顯示緊嘅 {count} 個')),
  'models.action.selectAll': entry(ladder('Select all {count} matching'), ladder('揀晒符合條件嘅 {count} 個')),
  'models.action.invert': entry(ladder('Invert the selection'), ladder('反轉選取')),
  'models.action.clearSelection': entry(ladder('Clear the selection'), ladder('清除選取')),
  'models.action.queue': entry(ladder('Add to the pull queue'), ladder('加入落載隊列')),
  'models.action.cancel': entry(ladder('Cancel'), ladder('取消')),
  'models.action.retry': entry(ladder('Retry'), ladder('再試')),
  'models.action.remove': entry(ladder('Remove from the list'), ladder('喺清單移走')),
  'models.selection.count': entry(
    ladder('{selected} selected of {shown} shown, {total} in the whole inventory.'),
    ladder('喺顯示緊嘅 {shown} 個入面揀咗 {selected} 個，全部庫存有 {total} 個。')
  ),

  'models.copy.title': entry(ladder('Copy {name} to a new local name'), ladder('將 {name} 複製做一個新本機名')),
  'models.copy.field': entry(ladder('New name'), ladder('新名')),
  'models.copy.hint': entry(ladder('Letters, digits, dots, dashes, underscores, one optional colon tag'), ladder('英文字母、數字、點、橫線、底線，可以加一個冒號標籤')),
  'models.copy.done': entry(ladder('{source} was copied to {destination}.'), ladder('{source} 已經複製做 {destination}。')),

  'models.delete.done': entry(
    ladder('{count} model(s) were deleted from the runtime. {failed} could not be.'),
    ladder('喺執行環境刪走咗 {count} 個模型，有 {failed} 個做唔到。')
  ),

  /* ---------------- hardware ---------------- */

  'models.hardware.title': entry(ladder('Hardware evidence'), ladder('硬件實測證據')),
  'models.hardware.description': entry(
    ladder(
      'Every fit verdict is arithmetic over these figures. Anything nothing measured stays Unknown; nothing here is read off a model’s name.',
      'Every fit verdict is arithmetic over these figures. Anything nothing measured stays Unknown; nothing here is read off a model’s name.',
      'Verdicts are arithmetic over these numbers. What nobody measured stays Unknown, and nothing is guessed from a model’s name.',
      'Verdicts are arithmetic, not vibes. Nothing measured means Unknown, and a model’s name never gets a vote.',
      'Verdicts are arithmetic, not vibes. Nothing measured means Unknown, and a model’s name never gets a vote.'
    ),
    ladder(
      '每個硬件評估都係用呢啲數字計出嚟。冇量到嘅一律當「未知」，冇一樣係睇個模型名估出嚟。',
      '每個硬件評估都係用呢啲數字計出嚟。冇量到嘅一律當「未知」，冇一樣係睇個模型名估出嚟。',
      '評估係計數計出嚟。冇人量過就係未知，唔會靠個名亂估。',
      '評估係計數，唔係靠感覺。冇量過就寫未知，個模型名冇資格投票。',
      '評估係計數，唔係靠感覺。冇量過就寫未知，個模型名冇資格投票。'
    )
  ),
  'models.hardware.gaps': entry(ladder('Not measured'), ladder('未量到')),
  'models.hardware.probe': entry(ladder('Run the measurement helper'), ladder('行埋量度小工具')),
  'models.hardware.probeOff': entry(
    ladder(
      'The measurement helper is off. Turn it on in Settings › Local models to replace the estimated memory figure with a measured one and to learn the free disk space.'
    ),
    ladder('量度小工具而家閂咗。喺「設定 › 本機模型」開返佢，就可以用實測記憶體數字代替估算，順便知埋剩幾多磁碟空間。')
  ),
  'models.hardware.probePreview': entry(
    ladder('It runs exactly this, with no shell involved: {command}'),
    ladder('佢淨係會行呢一句，冇經過任何 shell：{command}')
  ),
  'models.hardware.probeDone': entry(ladder('The machine was measured.'), ladder('已經量度過部機。')),
  'models.hardware.evidenceLanguage': entry(
    ladder(
      'The evidence rows and verdict reasoning below are reported in English, because they are measured figures and quoted output rather than copy.'
    ),
    ladder('下面嘅證據同評估推理係用英文寫，因為嗰啲係實測數字同原文引述，唔係一般文案。')
  ),

  'models.fit.well': entry(ladder('Runs well'), ladder('行得順')),
  'models.fit.limits': entry(ladder('Runs with limits'), ladder('行得到但有限制')),
  'models.fit.unlikely': entry(ladder('Unlikely'), ladder('多數唔得')),
  'models.fit.unknown': entry(ladder('Unknown'), ladder('未知')),
  'models.fit.title': entry(ladder('Hardware fit for {ref}'), ladder('{ref} 嘅硬件評估')),
  'models.fit.reasons': entry(ladder('How the verdict was reached'), ladder('個評估點計出嚟')),
  'models.fit.assumptions': entry(ladder('What was assumed'), ladder('用咗咩假設')),
  'models.fit.computedAt': entry(ladder('Computed at {time}'), ladder('喺 {time} 計出')),
  'models.fit.notAPromise': entry(
    ladder(
      'A verdict is evidence about this machine, not a promise about a run. It is recomputed whenever the hardware figures, the storage figures, the model metadata or the overhead setting change.'
    ),
    ladder('呢個評估係關於呢部機嘅證據，唔係保證行到。硬件數字、儲存數字、模型資料或者預留設定一改，就會重新計過。')
  ),

  /* ---------------- store ---------------- */

  'models.store.title': entry(ladder('Model store'), ladder('模型倉')),
  'models.store.subtitle': entry(
    ladder(
      'Every published variant the catalog source lists, combined with everything installed locally. Neither set is hidden.',
      'Every published variant the catalog source lists, combined with everything installed locally. Neither set is hidden.',
      'Every published variant the source lists, plus everything already on this machine. Nothing is filtered out for you.',
      'Every published variant the source will admit to, plus everything already sitting on this machine. Nobody curated this on your behalf.',
      'Every published variant the source will admit to, plus everything already sitting on this machine. Nobody curated this on your behalf.'
    ),
    ladder(
      '目錄來源列出嘅所有已發佈版本，加埋本機已安裝嘅全部，兩邊都唔會收埋。',
      '目錄來源列出嘅所有已發佈版本，加埋本機已安裝嘅全部，兩邊都唔會收埋。',
      '來源列到嘅所有版本，加埋部機已經有嘅，唔會幫你隱藏任何一樣。',
      '來源肯認嘅所有版本，加埋部機已經有嗰啲，冇人幫你揀過、篩過。',
      '來源肯認嘅所有版本，加埋部機已經有嗰啲，冇人幫你揀過、篩過。'
    )
  ),
  'models.store.search': entry(ladder('Search the inventory'), ladder('搵庫存')),
  'models.store.refresh': entry(ladder('Refresh the catalog'), ladder('重新讀取目錄')),
  'models.store.cancelRefresh': entry(ladder('Stop the refresh'), ladder('停止讀取')),
  'models.store.enrich': entry(ladder('Read manifests for the shown variants'), ladder('讀取顯示緊版本嘅資訊')),
  'models.store.empty.title': entry(ladder('The inventory is empty'), ladder('庫存係空嘅')),
  'models.store.empty.body': entry(
    ladder('No refresh has produced entries in this profile yet, and nothing is installed. Refresh the catalog to build the inventory.'),
    ladder('喺呢個設定檔入面未有任何一次讀取搵到嘢，本機亦都乜都未裝。撳重新讀取目錄整返個庫存出嚟。')
  ),
  'models.store.noMatch': entry(
    ladder('Nothing in the {total} inventory entries matches the current search and filters.'),
    ladder('庫存 {total} 項入面，冇一項符合而家嘅搜尋同篩選。')
  ),
  'models.store.completeness': entry(ladder('Refresh record'), ladder('讀取紀錄')),
  'models.store.completeVerdict': entry(ladder('Complete'), ladder('完整')),
  'models.store.incompleteVerdict': entry(ladder('Incomplete'), ladder('唔完整')),
  'models.store.refreshedAt': entry(ladder('Last attempt {time}'), ladder('上次嘗試 {time}')),
  'models.store.verifiedAt': entry(ladder('Last verified refresh {time} ({age})'), ladder('上次成功讀取 {time}（{age}）')),
  'models.store.pages': entry(ladder('{pages} pages followed across {repositories} repositories'), ladder('跟咗 {pages} 版，涵蓋 {repositories} 個倉庫')),
  'models.store.revision': entry(ladder('Source revision {revision}'), ladder('來源版本 {revision}')),
  'models.store.stale': entry(
    ladder('This catalog is {age} old, past the {hours} hour staleness setting. Refresh to verify it again.'),
    ladder('呢份目錄已經 {age}，超過設定嘅 {hours} 個鐘。撳重新讀取再驗證一次。')
  ),
  'models.store.offline': entry(
    ladder(
      'The catalog source is not reachable, so this is the last verified catalog plus the current installed state. Nothing new was guessed at.'
    ),
    ladder('而家連唔到目錄來源，所以呢度顯示上次驗證過嘅目錄加埋現時安裝狀態。冇估過任何新嘢。')
  ),
  'models.store.filter.state': entry(ladder('Filter by state'), ladder('按狀態篩選')),
  'models.store.filter.family': entry(ladder('Filter by family'), ladder('按系列篩選')),
  'models.store.filter.capability': entry(ladder('Filter by capability'), ladder('按能力篩選')),
  'models.store.filter.quantization': entry(ladder('Filter by quantization'), ladder('按量化篩選')),
  'models.store.filter.fit': entry(ladder('Filter by hardware fit'), ladder('按硬件評估篩選')),
  'models.store.filter.any': entry(ladder('Any'), ladder('全部')),
  'models.store.sort': entry(ladder('Sort by'), ladder('排序方式')),
  'models.store.sort.name': entry(ladder('Name'), ladder('名')),
  'models.store.sort.size': entry(ladder('Size'), ladder('大小')),
  'models.store.sort.fit': entry(ladder('Hardware fit'), ladder('硬件評估')),
  'models.store.group': entry(ladder('Group by repository'), ladder('按倉庫分組')),

  /* ---------------- queue ---------------- */

  'models.queue.title': entry(ladder('Pull queue'), ladder('落載隊列')),
  'models.queue.disclosure': entry(
    ladder(
      'Adding a variant schedules a local download and nothing else. There is no price, no purchase, no account and no payment anywhere in this application.',
      'Adding a variant schedules a local download and nothing else. There is no price, no purchase, no account and no payment anywhere in this application.',
      'This queues a download. There is no price, no purchase, no account and no payment anywhere in this application.',
      'This queues a download. Nothing here costs a penny, wants an account, or has ever seen a checkout.',
      'This queues a download. Nothing here costs a penny, wants an account, or has ever seen a checkout.'
    ),
    ladder(
      '加入版本只係排隊喺本機落載，冇其他。呢個應用程式入面冇價錢、冇購買、冇帳戶、冇付款。',
      '加入版本只係排隊喺本機落載，冇其他。呢個應用程式入面冇價錢、冇購買、冇帳戶、冇付款。',
      '呢度只係排隊落載。冇價錢、冇購買、冇帳戶、冇付款。',
      '呢度只係排隊落載。一蚊都唔使俾，唔使開戶口，亦都由頭到尾冇見過收銀處。',
      '呢度只係排隊落載。一蚊都唔使俾，唔使開戶口，亦都由頭到尾冇見過收銀處。'
    )
  ),
  'models.queue.summary': entry(
    ladder('{queued} waiting, {running} running, {done} done, {failed} failed, {cancelled} cancelled.'),
    ladder('{queued} 個等緊、{running} 個行緊、{done} 個完成、{failed} 個失敗、{cancelled} 個取消咗。')
  ),
  'models.queue.estimate': entry(
    ladder('The outstanding items transfer {bytes} according to the catalog.'),
    ladder('根據目錄，未做完嗰啲要傳 {bytes}。')
  ),
  'models.queue.estimateUnknown': entry(
    ladder('At least one outstanding item has no published size, so the total below is a floor rather than a total.'),
    ladder('最少有一項未有公佈大小，所以下面個數係下限，唔係總數。')
  ),
  'models.queue.disk': entry(ladder('Measured free space at {path}: {free}'), ladder('{path} 實測剩餘空間：{free}')),
  'models.queue.diskUnknown': entry(
    ladder('Free disk space has not been measured, so nothing checked whether this fits.'),
    ladder('未量過剩餘磁碟空間，所以冇人查過放唔放得落。')
  ),
  'models.queue.network': entry(
    ladder('Each pull is a direct transfer from the configured catalog source to the model runtime on this machine.'),
    ladder('每次落載都係由設定嘅目錄來源，直接傳去本機嘅模型執行環境。')
  ),
  'models.queue.start': entry(ladder('Start the queue'), ladder('開始隊列')),
  'models.queue.stop': entry(ladder('Stop after the current attempt'), ladder('做完手頭嗰次就停')),
  'models.queue.empty.title': entry(ladder('The queue is empty'), ladder('隊列係空嘅')),
  'models.queue.empty.body': entry(
    ladder('Choose variants in the inventory above and add them to the queue.'),
    ladder('喺上面庫存揀啲版本，加入隊列。')
  ),
  'models.queue.attempts': entry(ladder('{attempts} of {max} attempts used'), ladder('用咗 {attempts} / {max} 次嘗試')),
  'models.queue.mechanism': entry(
    ladder(
      'A pull runs as a series of bounded attempts, because the privileged network boundary caps one request at two minutes and hands the body back complete rather than as it arrives. The runtime keeps the layers it already fetched and resumes from them, and after every attempt the queue asks the runtime’s own installed list whether the model is there — which is the only thing that proves it landed.'
    ),
    ladder(
      '一次落載會分做幾次有上限嘅嘗試，因為受管制嘅網絡通道限制每個請求兩分鐘，而且要成個回應收齊先交返出嚟。執行環境會留住已經攞到嘅層，下次由嗰度續，而每次嘗試之後，隊列都會問返執行環境自己嘅安裝清單有冇呢個模型——得呢樣先證明真係入咗。'
    )
  ),
  'models.queue.status.queued': entry(ladder('Waiting'), ladder('等緊')),
  'models.queue.status.running': entry(ladder('Pulling'), ladder('落載緊')),
  'models.queue.status.done': entry(ladder('Installed'), ladder('已安裝')),
  'models.queue.status.failed': entry(ladder('Failed'), ladder('失敗')),
  'models.queue.status.cancelled': entry(ladder('Cancelled'), ladder('取消咗')),
  'models.queue.status.skipped': entry(ladder('Skipped'), ladder('略過')),
  'models.queue.added': entry(
    ladder('{added} added, {queued} were already waiting, {installed} were already installed.'),
    ladder('加咗 {added} 個，{queued} 個本身已經喺隊列，{installed} 個已經裝咗。')
  ),

  /* ---------------- chat ---------------- */

  'models.chat.title': entry(ladder('Model chat'), ladder('模型傾偈')),
  'models.chat.subtitle': entry(
    ladder(
      'Local sessions against an installed model. Nothing leaves this machine.',
      'Local sessions against an installed model. Nothing leaves this machine.',
      'Local sessions against an installed model. Not one byte leaves this machine.',
      'Local sessions against an installed model. Not one byte leaves this machine — it has nowhere to go.',
      'Local sessions against an installed model. Not one byte leaves this machine — it has nowhere to go.'
    ),
    ladder(
      '同已安裝模型喺本機傾偈，啲嘢唔會離開呢部機。',
      '同已安裝模型喺本機傾偈，啲嘢唔會離開呢部機。',
      '同已安裝模型喺本機傾偈，一個位元都唔會走出去。',
      '同已安裝模型喺本機傾偈，一個位元都走唔出去——佢根本冇路可以走。',
      '同已安裝模型喺本機傾偈，一個位元都走唔出去——佢根本冇路可以走。'
    )
  ),
  'models.chat.sessions': entry(ladder('Sessions'), ladder('對話')),
  'models.chat.search': entry(ladder('Search sessions and messages'), ladder('搵對話同訊息')),
  'models.chat.new': entry(ladder('New session'), ladder('新對話')),
  'models.chat.rename': entry(ladder('Rename'), ladder('改名')),
  'models.chat.delete': entry(ladder('Delete the session'), ladder('刪除對話')),
  'models.chat.export': entry(ladder('Export the session'), ladder('匯出對話')),
  'models.chat.model': entry(ladder('Model'), ladder('模型')),
  'models.chat.system': entry(ladder('System prompt'), ladder('系統提示')),
  'models.chat.temperature': entry(ladder('Temperature'), ladder('溫度')),
  'models.chat.topP': entry(ladder('Top-p'), ladder('Top-p')),
  'models.chat.numPredict': entry(ladder('Maximum reply tokens'), ladder('回覆最多字元數')),
  'models.chat.message': entry(ladder('Your message'), ladder('你嘅訊息')),
  'models.chat.send': entry(ladder('Send'), ladder('傳送')),
  'models.chat.stop': entry(ladder('Stop waiting'), ladder('唔等喇')),
  'models.chat.regenerate': entry(ladder('Ask again'), ladder('再問一次')),
  'models.chat.empty.title': entry(ladder('No sessions yet'), ladder('未有對話')),
  'models.chat.empty.body': entry(
    ladder('Create a session and choose one of the installed models to talk to.'),
    ladder('開個對話，揀個已安裝模型嚟傾。')
  ),
  'models.chat.noModels': entry(
    ladder('No model is installed, so there is nothing to talk to yet. Queue one in the Model store.'),
    ladder('一個模型都未裝，暫時冇嘢可以傾。去模型倉排隊攞個返嚟。')
  ),
  'models.chat.waiting': entry(
    ladder('Waiting for {model}. {elapsed} elapsed.'),
    ladder('等緊 {model}。已經過咗 {elapsed}。')
  ),
  'models.chat.deliveryNote': entry(
    ladder(
      'A reply arrives complete rather than a word at a time. The privileged network boundary hands a response back only once it is whole, so there is nothing to render progressively; the timing counters below are the runtime’s own.'
    ),
    ladder(
      '回覆會一次過成段返嚟，唔會逐個字出。受管制嘅網絡通道要成個回應收齊先交返出嚟，所以冇嘢可以逐步顯示；下面啲時間數字係執行環境自己報嘅。'
    )
  ),
  'models.chat.stats': entry(
    ladder('{promptTokens} prompt tokens, {responseTokens} reply tokens, {duration} total, {rate} tokens per second.'),
    ladder('提示 {promptTokens} 個字元、回覆 {responseTokens} 個字元、合共 {duration}、每秒 {rate} 個字元。')
  ),
  'models.chat.attachments': entry(ladder('Attach an image'), ladder('附加圖片')),
  'models.chat.attachmentsDisabled': entry(
    ladder(
      'The runtime reports no vision capability for {model}, so an image cannot be sent to it. Filter the inventory by the vision capability to find a model that can.'
    ),
    ladder('執行環境話 {model} 冇視覺能力，所以送唔到圖片俾佢。喺庫存用「視覺」能力篩選，搵個做得到嘅。')
  ),
  'models.chat.attachmentsUnknown': entry(
    ladder('{model} has not reported its capabilities yet. Open it on the Local models tab to read them.'),
    ladder('{model} 未報過自己有啲乜能力。喺「本機模型」分頁打開佢讀返。')
  ),
  'models.chat.attachmentAdded': entry(ladder('{name} attached, {size}.'), ladder('已附加 {name}，{size}。')),
  'models.chat.exported': entry(ladder('The session was written to {path}.'), ladder('對話已經寫入 {path}。')),

  /* ---------------- harness ---------------- */

  'models.harness.title': entry(ladder('Harness profiles'), ladder('啟動設定檔')),
  'models.harness.subtitle': entry(
    ladder(
      'This application launching a local program against a model, from an allow-listed schema. The model runtime cannot launch anything, and nothing here accepts a shell command.',
      'This application launching a local program against a model, from an allow-listed schema. The model runtime cannot launch anything, and nothing here accepts a shell command.',
      'This application launches a local program against a model, from a strict schema. The runtime launches nothing, and there is no place to type a shell command.',
      'This application launches a local program against a model, from a strict schema. The runtime launches nothing, and there is nowhere to type a shell command — deliberately, and permanently.',
      'This application launches a local program against a model, from a strict schema. The runtime launches nothing, and there is nowhere to type a shell command — deliberately, and permanently.'
    ),
    ladder(
      '由呢個應用程式按白名單結構，喺本機開一個程式配住個模型。模型執行環境本身開唔到嘢，呢度亦都唔收 shell 指令。',
      '由呢個應用程式按白名單結構，喺本機開一個程式配住個模型。模型執行環境本身開唔到嘢，呢度亦都唔收 shell 指令。',
      '由呢個應用程式按嚴格結構，喺本機開個程式配住個模型。執行環境開唔到嘢，亦都冇位俾你打 shell 指令。',
      '由呢個應用程式按嚴格結構開程式。執行環境開唔到嘢，亦都冇位俾你打 shell 指令——係特登嘅，而且永遠都係咁。',
      '由呢個應用程式按嚴格結構開程式。執行環境開唔到嘢，亦都冇位俾你打 shell 指令——係特登嘅，而且永遠都係咁。'
    )
  ),
  'models.harness.search': entry(ladder('Search profiles'), ladder('搵設定檔')),
  'models.harness.new': entry(ladder('New profile'), ladder('新設定檔')),
  'models.harness.duplicate': entry(ladder('Duplicate'), ladder('複製一份')),
  'models.harness.edit': entry(ladder('Edit'), ladder('編輯')),
  'models.harness.delete': entry(ladder('Delete the profile'), ladder('刪除設定檔')),
  'models.harness.preflight': entry(ladder('Run the preflight'), ladder('做起飛前檢查')),
  'models.harness.launch': entry(ladder('Launch'), ladder('啟動')),
  'models.harness.snapshots': entry(ladder('Snapshots'), ladder('快照')),
  'models.harness.restore': entry(ladder('Restore this snapshot'), ladder('還原呢個快照')),
  'models.harness.command': entry(ladder('Executable'), ladder('執行檔')),
  'models.harness.args': entry(ladder('Arguments'), ladder('引數')),
  'models.harness.cwd': entry(ladder('Working directory'), ladder('工作目錄')),
  'models.harness.env': entry(ladder('Environment'), ladder('環境變數')),
  'models.harness.ports': entry(ladder('Expected ports'), ladder('預期連接埠')),
  'models.harness.files': entry(ladder('Required files'), ladder('必要檔案')),
  'models.harness.marker': entry(ladder('Readiness marker'), ladder('就緒標記')),
  'models.harness.settle': entry(ladder('Settle window'), ladder('觀察時間')),
  'models.harness.preview': entry(ladder('Exactly what will run'), ladder('實際會行嘅嘢')),
  'models.harness.blockers': entry(ladder('What is stopping it'), ladder('而家卡住咗乜')),
  'models.harness.ready': entry(ladder('Everything the preflight can check passed.'), ladder('起飛前檢查查得到嘅全部過關。')),
  'models.harness.secretNote': entry(
    ladder(
      'A secret is read from the operating system vault at the moment of launch and is never written into a snapshot, a log, an export, this preview or the settings file.'
    ),
    ladder('密碼類嘅嘢係啟動嗰刻先由作業系統保險庫讀出嚟，唔會寫入快照、記錄、匯出檔、呢個預覽，或者設定檔。')
  ),
  'models.harness.template': entry(
    ladder(
      'This is a shipped template. Duplicate it to make a profile of your own, then choose its folder and the rest through the pickers.'
    ),
    ladder('呢個係內置範本。複製一份做自己嘅設定檔，再用揀選器揀個資料夾同其他項目。')
  ),
  'models.harness.empty.title': entry(ladder('No profiles of your own yet'), ladder('未有自己嘅設定檔')),
  'models.harness.empty.body': entry(
    ladder('Duplicate one of the shipped templates below, or create a profile from scratch.'),
    ladder('喺下面複製一個內置範本，或者由零開始整個新嘅。')
  ),
  'models.harness.launched': entry(ladder('{name} started. {summary}'), ladder('{name} 已經開咗。{summary}')),
  'models.harness.launchFailed': entry(ladder('{name} did not become ready. {summary}'), ladder('{name} 未去到就緒。{summary}')),
  'models.harness.scriptsRead': entry(ladder('{count} scripts were read from {path}.'), ladder('喺 {path} 讀到 {count} 個 script。')),

  /* ---------------- settings ---------------- */

  'models.settings.section': entry(ladder('Local models'), ladder('本機模型')),
  'models.settings.host': entry(ladder('Model runtime address'), ladder('模型執行環境地址')),
  'models.settings.host.description': entry(
    ladder(
      'The base address every runtime call is sent to. Plain http is only permitted for a loopback address, because that is exactly what the privileged network boundary allows; a remote runtime must be reached over https.'
    ),
    ladder('所有執行環境請求都會送去呢個地址。淨係 loopback 地址先可以用純 http，因為受管制嘅網絡通道就係咁定；遠端執行環境要行 https。')
  ),
  'models.settings.timeout': entry(ladder('Request timeout'), ladder('請求逾時')),
  'models.settings.timeout.description': entry(
    ladder(
      'How long one call may take before it is abandoned. The privileged network boundary caps this at 120 seconds whatever is set here, and that cap is why a large pull runs as a series of attempts.'
    ),
    ladder('一次請求最多等幾耐先放棄。無論呢度set幾多，受管制嘅網絡通道都上限 120 秒；正正因為咁，大型落載要分開幾次嘗試。')
  ),
  'models.settings.registryHost': entry(ladder('Catalog source'), ladder('目錄來源')),
  'models.settings.registryHost.description': entry(
    ladder(
      'The registry the published catalog is enumerated from, using its standard repository and tag listing endpoints. Choosing None leaves the inventory as the locally installed models alone.'
    ),
    ladder('用嚟列舉已發佈目錄嘅登錄庫，行佢標準嘅倉庫同標籤列表介面。揀「唔用」就淨係剩返本機已安裝嘅模型。')
  ),
  'models.settings.registryPageSize': entry(ladder('Catalog page size'), ladder('目錄每頁數量')),
  'models.settings.registryPageSize.description': entry(
    ladder('How many entries each listing page asks for. Every page is followed to the end regardless of this figure; it only changes how many requests that takes.'),
    ladder('每頁列表要求幾多項。無論呢個數係幾多，每一頁都會跟到底，佢只係影響要發幾多次請求。')
  ),
  'models.settings.registryMaxRepositories': entry(ladder('Repository ceiling'), ladder('倉庫上限')),
  'models.settings.registryMaxRepositories.description': entry(
    ladder('The most repositories one refresh will enumerate. Hitting it marks the refresh incomplete and says so by name rather than silently trimming the result.'),
    ladder('一次讀取最多列舉幾多個倉庫。撞到上限就會標明今次讀取唔完整，唔會靜靜雞剪走結果。')
  ),
  'models.settings.staleHours': entry(ladder('Catalog goes stale after'), ladder('目錄幾耐當過期')),
  'models.settings.staleHours.description': entry(
    ladder('How old a verified refresh may be before the store labels it stale and offers to verify it again. Nothing is deleted when it goes stale.'),
    ladder('一次成功讀取可以舊到幾時先當佢過期、提你再驗證一次。過期唔會刪走任何嘢。')
  ),
  'models.settings.parallelism': entry(ladder('Concurrent pulls'), ladder('同時落載數')),
  'models.settings.parallelism.description': entry(
    ladder('How many queue items may be pulling at once. More is not faster once the link is saturated, and each one competes for the same disk.'),
    ladder('隊列最多幾多項同時落載。條線塞滿咗之後加多都唔會快，而且大家都爭同一隻碟。')
  ),
  'models.settings.attempts': entry(ladder('Attempt budget per item'), ladder('每項嘗試次數上限')),
  'models.settings.attempts.description': entry(
    ladder(
      'How many bounded attempts one queue item may use before it is marked failed. A large model over a slow link genuinely needs several, because each attempt resumes from the layers the runtime already has.'
    ),
    ladder('一項隊列最多可以用幾多次有上限嘅嘗試先當佢失敗。大模型加慢線真係要幾次，因為每次都由執行環境已經有嘅層度續落去。')
  ),
  'models.settings.contextOverhead': entry(ladder('Context and runtime allowance'), ladder('上下文同執行預留')),
  'models.settings.contextOverhead.description': entry(
    ladder(
      'Memory budgeted on top of a model’s weights when a fit verdict is computed. It is a flat figure rather than a per-model calculation, and every verdict says so among its assumptions.'
    ),
    ladder('計硬件評估嗰陣，喺模型權重之上再預留嘅記憶體。呢個係一個劃一數字，唔係逐個模型計，每個評估都會喺假設嗰度講明。')
  ),
  'models.settings.probe': entry(ladder('Measurement helper'), ladder('量度小工具')),
  'models.settings.probe.description': entry(
    ladder(
      'Allows a fixed, bundled measurement program to run through the privileged process bridge so system memory and free disk space become measured figures instead of estimates. It reads three numbers and writes nothing; the program is a constant in this application’s own source and no text you type ever becomes part of it.'
    ),
    ladder(
      '容許一個固定嘅內置量度程式經受管制嘅程序通道行一次，令系統記憶體同剩餘磁碟空間由估算變成實測。佢淨係讀三個數字，乜都唔會寫；個程式係應用程式原始碼入面嘅常數，你打嘅字永遠唔會變成佢嘅一部分。'
    )
  ),
  'models.settings.probePath': entry(ladder('Folder to measure free space at'), ladder('量度剩餘空間嘅資料夾')),
  'models.settings.probePath.description': entry(
    ladder('The folder whose filesystem the free-space figure is read from. Leave it empty to measure the home folder, which is where the runtime keeps its models by default.'),
    ladder('剩餘空間會喺呢個資料夾所屬嘅檔案系統度讀。留空就量家目錄，執行環境預設就係將模型放喺嗰度。')
  ),
  'models.settings.chatTurns': entry(ladder('Turns kept per session'), ladder('每個對話保留輪數')),
  'models.settings.chatTurns.description': entry(
    ladder('How many past messages are sent with each new turn, and how many a session keeps. Bounding this is what keeps a long session from growing without limit.'),
    ladder('每次新一輪會帶幾多舊訊息，以及一個對話最多留幾多。有呢個上限，長對話先唔會無止境咁脹大。')
  ),
  'models.settings.temperature': entry(ladder('Default temperature'), ladder('預設溫度')),
  'models.settings.temperature.description': entry(
    ladder('The sampling temperature a new session starts at. Lower is more repeatable; higher wanders further. Each session can change its own.'),
    ladder('新對話開頭用嘅取樣溫度。低啲比較穩定重複，高啲就行遠啲。每個對話可以自己再改。')
  ),
  'models.settings.topP': entry(ladder('Default top-p'), ladder('預設 top-p')),
  'models.settings.topP.description': entry(
    ladder('The nucleus sampling threshold a new session starts at. Each session can change its own.'),
    ladder('新對話開頭用嘅 nucleus 取樣閾值。每個對話可以自己再改。')
  ),
  'models.settings.numPredict': entry(ladder('Default reply ceiling'), ladder('預設回覆上限')),
  'models.settings.numPredict.description': entry(
    ladder('The most tokens a reply may run to by default. A session can change its own; the runtime stops at whichever limit it reaches first.'),
    ladder('預設一個回覆最多去到幾多字元。每個對話可以自己再改；執行環境會喺最先撞到嘅上限度停。')
  ),
  'models.settings.exportFormat': entry(ladder('Preferred export format'), ladder('慣用匯出格式')),
  'models.settings.exportFormat.description': entry(
    ladder('The format offered first when exporting an inventory, a queue or a chat session. Every other format stays available at the moment of export.'),
    ladder('匯出庫存、隊列或者對話嗰陣，預設先擺出嚟嘅格式。其他格式喺匯出嗰刻一樣揀得。')
  ),
  'models.settings.refreshNow': entry(ladder('Refresh the catalog now'), ladder('而家重新讀取目錄')),
  'models.settings.refreshNow.description': entry(
    ladder('Runs a full catalog refresh against the configured source and records its page count, completeness verdict and timestamp.'),
    ladder('即刻對住設定咗嘅來源做一次完整目錄讀取，並記低頁數、完整度判斷同時間。')
  ),
  'models.settings.checkNow': entry(ladder('Check the runtime now'), ladder('而家檢查執行環境')),
  'models.settings.checkNow.description': entry(
    ladder('Asks the runtime for its version and reads its installed and loaded model lists, then reports what it found.'),
    ladder('問執行環境攞版本，順手讀返已安裝同已載入嘅模型清單，然後報返結果。')
  ),

  /* ---------------- shared notices ---------------- */

  'models.notice.refreshed': entry(
    ladder('{variants} variants across {repositories} repositories, {pages} pages followed. {verdict}'),
    ladder('{repositories} 個倉庫合共 {variants} 個版本，跟咗 {pages} 版。{verdict}')
  ),
  'models.notice.refreshFailed': entry(ladder('The catalog refresh did not complete. {reason}'), ladder('目錄讀取未完成。{reason}')),
  'models.notice.exported': entry(ladder('Written to {path}.'), ladder('已經寫入 {path}。')),
  'models.notice.exportLosses': entry(
    ladder('{count} field(s) cannot be carried by {format} and were named before writing.'),
    ladder('{format} 載唔到 {count} 個欄位，寫入之前已經逐個講明。')
  ),
  'models.notice.nothingSelected': entry(ladder('Nothing is selected.'), ladder('乜都未揀。')),
  'models.notice.unreachable': entry(
    ladder('The runtime is not answering, so this could not be done. {reason}'),
    ladder('執行環境冇應，所以做唔到呢件事。{reason}')
  ),
  'models.notice.enriched': entry(
    ladder('{enriched} manifests read, {failed} refused.'),
    ladder('讀咗 {enriched} 份資訊，有 {failed} 份被拒。')
  )
};
