import type { Catalogue, FunnyLadder, TranslationEntry } from '../../core/registry';

/**
 * Every piece of copy the downloads feature renders, in English and in playful
 * Hong Kong Cantonese, at all five humour levels.
 *
 * Humour styles the VOICE and never the FACTS. A cancel warning at level 5 still
 * names the exact file and says the partial bytes are deleted; a level-1 line
 * says the same thing with a straight face. A byte count, a path, a host name
 * and a state are either interpolated or identical across every rung, because
 * those are the numbers a person is checking a transfer against.
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

export const DOWNLOADS_STRINGS: Catalogue = {
  /* ---------------- tab, section, palette ---------------- */

  'downloads.tab.title': entry(ladder('Downloads'), ladder('下載')),
  'downloads.tab.subtitle': entry(
    ladder(
      'Nothing transfers until you confirm it in the Start download dialog.',
      'Nothing transfers until you confirm it in the Start download dialog.',
      'Nothing moves until you say so in the Start download dialog.',
      'Not one byte moves until you nod at the Start download dialog first.',
      'Not one byte moves until you nod at the Start download dialog first.'
    ),
    ladder(
      '未喺開始下載對話框度確認之前，乜嘢都唔會傳送。',
      '未喺開始下載對話框度確認之前，乜嘢都唔會傳送。',
      '未喺開始下載嗰度話得，一個位都唔會郁。',
      '未喺開始下載嗰度點頭之前，一個 byte 都唔准郁。',
      '未喺開始下載嗰度點頭之前，一個 byte 都唔准郁。'
    )
  ),
  'downloads.settings.title': entry(ladder('Downloads'), ladder('下載')),
  'downloads.palette.open': entry(ladder('Open Downloads'), ladder('打開下載')),
  'downloads.palette.addManual': entry(ladder('Add a download by address'), ladder('用網址新增下載')),
  'downloads.palette.startReceiver': entry(ladder('Start the capture receiver'), ladder('開啟擷取接收器')),
  'downloads.palette.stopReceiver': entry(ladder('Stop the capture receiver'), ladder('停止擷取接收器')),
  'downloads.palette.pairing': entry(ladder('Show browser extension pairing details'), ladder('顯示瀏覽器擴充配對資料')),

  /* ---------------- receiver, capture, manual entry ---------------- */

  'downloads.receiver.unavailable.title': entry(ladder('The capture receiver could not start'), ladder('擷取接收器開唔到')),
  'downloads.receiver.failed.title': entry(ladder('The capture receiver failed'), ladder('擷取接收器出咗事')),
  'downloads.capture.title': entry(
    ladder('A download was captured', 'A download was captured', 'The extension caught a download', 'The extension pounced on a download', 'The extension pounced on a download'),
    ladder('接住咗一個下載', '接住咗一個下載', '擴充程式捉到一個下載', '擴充程式一手撳住個下載', '擴充程式一手撳住個下載')
  ),
  'downloads.capture.body': entry(
    ladder('{name} from {host}. Nothing has transferred yet.'),
    ladder('嚟自 {host} 嘅 {name}。仲未傳送過任何嘢。')
  ),
  'downloads.capture.declined': entry(
    ladder(
      'You chose not to download it, so nothing was transferred and nothing was written.',
      'You chose not to download it, so nothing was transferred and nothing was written.',
      'You said no, so nothing was sent and nothing was written to disk.',
      'You waved it off, so nothing shipped and not one byte touched the disk.',
      'You waved it off, so nothing shipped and not one byte touched the disk.'
    ),
    ladder(
      '你揀咗唔下載，所以乜都冇傳送，都冇寫過入檔案。',
      '你揀咗唔下載，所以乜都冇傳送，都冇寫過入檔案。',
      '你話唔要，所以乜都冇送出，磁碟一個字都冇寫過。',
      '你一手揈開咗，所以乜都冇寄出，磁碟一粒 byte 都冇沾過。',
      '你一手揈開咗，所以乜都冇寄出，磁碟一粒 byte 都冇沾過。'
    )
  ),
  'downloads.manual.invalid.title': entry(ladder('That address cannot be downloaded'), ladder('呢個網址下載唔到')),
  'downloads.manual.invalid.body': entry(
    ladder('It is not a valid http or https URL, so nothing was added.'),
    ladder('唔係有效嘅 http 或 https 網址，所以冇加落去。')
  ),
  'downloads.manual.scheme.body': entry(
    ladder('Only http and https addresses are transferred; {scheme} was refused.'),
    ladder('淨係傳送 http 同 https 網址；{scheme} 畀拒絕咗。')
  ),
  'downloads.manual.declined': entry(
    ladder('You cancelled before it started, so nothing was written.'),
    ladder('喺開始之前你取消咗，所以冇寫過任何嘢。')
  ),
  'downloads.manual.dialog.title': entry(ladder('Add a download by address'), ladder('用網址新增下載')),
  'downloads.manual.dialog.url': entry(ladder('The address to download'), ladder('要下載嘅網址')),
  'downloads.manual.dialog.hint': entry(
    ladder(
      'Only http and https addresses can be downloaded. This opens the same Start download dialog a captured download does.',
      'Only http and https addresses can be downloaded. This opens the same Start download dialog a captured download does.',
      'Only http and https work here. It opens the exact same Start download dialog a real capture would.',
      'Only http and https, nothing exotic. It opens the same Start download dialog a proper capture gets — no shortcuts.',
      'Only http and https, nothing exotic. It opens the same Start download dialog a proper capture gets — no shortcuts.'
    ),
    ladder(
      '淨係下載到 http 同 https 網址。呢度會打開同擷取到嘅下載一樣嘅開始下載對話框。',
      '淨係下載到 http 同 https 網址。呢度會打開同擷取到嘅下載一樣嘅開始下載對話框。',
      '淨係 http 同 https 得，冇花巧。打開嗰個對話框同真正擷取到嘅一模一樣。',
      '淨係 http 同 https，冇乜花臣。打開嗰個開始下載對話框，同真係擷取到嗰個一式一樣，冇偷步。',
      '淨係 http 同 https，冇乜花臣。打開嗰個開始下載對話框，同真係擷取到嗰個一式一樣，冇偷步。'
    )
  ),
  'downloads.manual.dialog.confirm': entry(ladder('Continue'), ladder('繼續')),
  'downloads.manual.dialog.cancel': entry(ladder('Cancel'), ladder('取消')),

  /* ---------------- concurrency, errors ---------------- */

  'downloads.error.noReceiver.title': entry(ladder('The receiver is not running'), ladder('接收器未開')),
  'downloads.error.noReceiver': entry(
    ladder(
      'The capture receiver is not running, so nothing can be transferred. Start it from the Downloads tab.',
      'The capture receiver is not running, so nothing can be transferred. Start it from the Downloads tab.',
      'The receiver is off, so nothing can move. Start it from the Downloads tab.',
      'The receiver is fast asleep, so nothing is going anywhere. Wake it up from the Downloads tab.',
      'The receiver is fast asleep, so nothing is going anywhere. Wake it up from the Downloads tab.'
    ),
    ladder(
      '擷取接收器未開，所以乜都傳送唔到。去下載分頁開返佢。',
      '擷取接收器未開，所以乜都傳送唔到。去下載分頁開返佢。',
      '接收器閂咗，乜都郁唔到。去下載分頁開返佢。',
      '接收器瞓緊覺，乜都唔會郁。去下載分頁叫醒佢。',
      '接收器瞓緊覺，乜都唔會郁。去下載分頁叫醒佢。'
    )
  ),
  'downloads.error.notSent': entry(
    ladder('The instruction never reached the receiver, so nothing started.'),
    ladder('指令冚唪唥去唔到接收器，所以乜都冇開始。')
  ),
  'downloads.queued.note': entry(
    ladder('Waiting: {count} transfers are already running.'),
    ladder('等緊：已經有 {count} 個傳送喺度做緊。')
  ),
  'downloads.pause.notRunning.title': entry(ladder('That transfer is not running'), ladder('嗰個傳送未開始')),
  'downloads.pause.notRunning.body': entry(
    ladder('It is {state}, so there is nothing to pause.'),
    ladder('佢而家係 {state}，冇嘢可以暫停。')
  ),

  /* ---------------- cancel, remove ---------------- */

  'downloads.cancel.action': entry(ladder('Cancel the download of {name}'), ladder('取消下載 {name}')),
  'downloads.cancel.irreversible': entry(
    ladder(
      'The partial file is deleted from disk and the bytes received so far are lost. The completed file is not created.',
      'The partial file is deleted from disk and the bytes received so far are lost. The completed file is not created.',
      'The partial file on disk is deleted and every byte received so far is gone. No finished file is ever created.',
      'The partial file gets deleted and every byte you already had is gone for good. There is no finished file at the end of this.',
      'The partial file gets deleted and every byte you already had is gone for good. There is no finished file at the end of this.'
    ),
    ladder(
      '磁碟上嘅未完成檔案會刪走，已經收到嘅位元組會全部冇咗。唔會有完成咗嘅檔案。',
      '磁碟上嘅未完成檔案會刪走，已經收到嘅位元組會全部冇咗。唔會有完成咗嘅檔案。',
      '未完成嘅檔案會刪走，收咗嘅嘢全部冇晒。最尾唔會有完整檔案。',
      '未完成嘅檔案即刻刪走，已經有嘅嘢全部冇晒，冇得返轉頭。最尾乜完整檔案都冇。',
      '未完成嘅檔案即刻刪走，已經有嘅嘢全部冇晒，冇得返轉頭。最尾乜完整檔案都冇。'
    )
  ),
  'downloads.cancel.confirm': entry(ladder('Cancel it and delete the partial file'), ladder('取消並刪除未完成檔案')),
  'downloads.remove.action': entry(ladder('Remove {count} downloads from the list'), ladder('由清單移除 {count} 個下載')),
  'downloads.remove.irreversible': entry(
    ladder(
      'The list entries are deleted and cannot be recovered. Files that already finished are left on disk untouched.',
      'The list entries are deleted and cannot be recovered. Files that already finished are left on disk untouched.',
      'The list entries are gone for good. Anything already finished stays exactly where it is on disk.',
      'These rows are gone for good, no getting them back. Anything already finished just sits on disk, completely undisturbed.',
      'These rows are gone for good, no getting them back. Anything already finished just sits on disk, completely undisturbed.'
    ),
    ladder(
      '清單項目會刪除，唔可以復原。已經完成嘅檔案會留喺磁碟度，冇郁過。',
      '清單項目會刪除，唔可以復原。已經完成嘅檔案會留喺磁碟度，冇郁過。',
      '清單嗰啲項目刪咗就冇得返轉頭。已完成嘅檔案原封不動留喺磁碟。',
      '嗰幾行刪咗就真係冇得撈返。已完成嘅檔案原地企定,一條毛都冇郁過。',
      '嗰幾行刪咗就真係冇得撈返。已完成嘅檔案原地企定,一條毛都冇郁過。'
    )
  ),
  'downloads.remove.irreversible.running': entry(
    ladder(
      'The list entries are deleted and cannot be recovered. {count} of them are still transferring and will be cancelled, deleting their partial files. Files that already finished are left on disk untouched.',
      'The list entries are deleted and cannot be recovered. {count} of them are still transferring and will be cancelled, deleting their partial files. Files that already finished are left on disk untouched.',
      'The rows are gone for good. {count} of them are still transferring and get cancelled too, which deletes their partial files. Anything already finished is left alone on disk.',
      '{count} of these are still mid-transfer and get cancelled along with the row, which wipes their partial files. Anything already finished stays put on disk, unbothered.',
      '{count} of these are still mid-transfer and get cancelled along with the row, which wipes their partial files. Anything already finished stays put on disk, unbothered.'
    ),
    ladder(
      '清單項目會刪除，唔可以復原。當中 {count} 個仲喺度傳送緊，會一併取消，未完成嘅檔案亦會刪走。已經完成嘅檔案會留喺磁碟度，冇郁過。',
      '清單項目會刪除，唔可以復原。當中 {count} 個仲喺度傳送緊，會一併取消，未完成嘅檔案亦會刪走。已經完成嘅檔案會留喺磁碟度，冇郁過。',
      '呢啲行刪咗冇得返轉頭。當中 {count} 個仲傳送緊，會一齊取消，順便刪走未完成嘅檔案。已完成嘅就留喺度冇郁過。',
      '當中 {count} 個仲傳送緊，會跟住行一齊取消，未完成嘅檔案一鑊清。已完成嘅就原地企好，冇人郁過佢。',
      '當中 {count} 個仲傳送緊，會跟住行一齊取消，未完成嘅檔案一鑊清。已完成嘅就原地企好，冇人郁過佢。'
    )
  ),
  'downloads.remove.confirm': entry(ladder('Remove them from the list'), ladder('由清單移除')),
  'downloads.remove.done.title': entry(ladder('Removed from the list'), ladder('已經由清單移除')),
  'downloads.remove.done.body': entry(
    ladder('{count} entries were removed. Finished files were left on disk.'),
    ladder('已經移除咗 {count} 個項目，完成咗嘅檔案留咗喺磁碟。')
  ),
  'downloads.open.failed.title': entry(ladder('The file could not be opened'), ladder('打開唔到個檔案')),
  'downloads.reveal.failed.title': entry(ladder('The folder could not be opened'), ladder('打開唔到個資料夾')),

  /* ---------------- Start download dialog ---------------- */

  'downloads.start.title': entry(ladder('Start download'), ladder('開始下載')),
  'downloads.start.intro': entry(
    ladder(
      'Nothing has transferred yet. This is what was captured.',
      'Nothing has transferred yet. This is what was captured.',
      'Nothing has moved yet — here is exactly what got caught.',
      'Not a byte has moved yet. Here is the full catch, laid out for inspection.',
      'Not a byte has moved yet. Here is the full catch, laid out for inspection.'
    ),
    ladder(
      '仲未傳送過任何嘢。以下係擷取到嘅內容。',
      '仲未傳送過任何嘢。以下係擷取到嘅內容。',
      '一個位都未郁過，以下就係捉到嘅嘢。',
      '一粒 byte 都未郁，以下係成個戰利品，攤晒出嚟俾你檢查。',
      '一粒 byte 都未郁，以下係成個戰利品，攤晒出嚟俾你檢查。'
    )
  ),
  'downloads.start.filename': entry(ladder('File name'), ladder('檔案名稱')),
  'downloads.start.filename.hint': entry(
    ladder('Path separators and control characters are removed before anything is written.'),
    ladder('寫入之前會移除路徑分隔符同控制字元。')
  ),
  'downloads.start.folder': entry(ladder('Folder'), ladder('資料夾')),
  'downloads.start.folder.hint': entry(
    ladder('An absolute folder path. Browse to pick one.'),
    ladder('要用絕對路徑。可以撳瀏覽揀一個。')
  ),
  'downloads.start.destination': entry(ladder('It will be written to'), ladder('將會寫入')),
  'downloads.start.source': entry(ladder('Source'), ladder('來源')),
  'downloads.start.size': entry(ladder('Size the server declared'), ladder('伺服器申報嘅大小')),
  'downloads.start.size.unknown': entry(
    ladder('The server did not declare one.'),
    ladder('伺服器冇申報大小。')
  ),
  'downloads.start.type': entry(ladder('Type the server declared'), ladder('伺服器申報嘅類型')),
  'downloads.start.referrer': entry(ladder('Referred from'), ladder('轉介自')),
  'downloads.start.overwrite': entry(ladder('Overwrite an existing file'), ladder('覆寫現有檔案')),
  'downloads.start.overwrite.hint': entry(
    ladder(
      'Off writes a numbered variant beside an existing file of the same name. On replaces that file.',
      'Off writes a numbered variant beside an existing file of the same name. On replaces that file.',
      'Off keeps the old file and writes a numbered copy next to it. On replaces it outright.',
      'Off leaves the old file alone and parks a numbered copy beside it. On just barges in and replaces it.',
      'Off leaves the old file alone and parks a numbered copy beside it. On just barges in and replaces it.'
    ),
    ladder(
      '閂咗就會喺同名檔案旁邊寫一個編號版本；開咗就會取代嗰個檔案。',
      '閂咗就會喺同名檔案旁邊寫一個編號版本；開咗就會取代嗰個檔案。',
      '閂咗會留低舊檔案，喺旁邊寫個編號版；開咗就直接取代。',
      '閂咗舊檔案原封不動，旁邊擺個編號版；開咗就大搖大擺取代咗佢。',
      '閂咗舊檔案原封不動，旁邊擺個編號版；開咗就大搖大擺取代咗佢。'
    )
  ),
  'downloads.start.confirm': entry(ladder('Start the download'), ladder('開始下載')),
  'downloads.start.cancel': entry(ladder('Do not download it'), ladder('唔好下載')),
  'downloads.start.invalidFolder.title': entry(ladder('That destination folder cannot be used'), ladder('呢個目的地資料夾用唔到')),
  'downloads.start.invalidFolder.body': entry(
    ladder('The folder must be an absolute path, such as C:\\Users\\you\\Downloads. Nothing has been downloaded.'),
    ladder('資料夾要用絕對路徑，例如 C:\\Users\\you\\Downloads。而家乜都未下載過。')
  ),
  'downloads.start.nameAdjusted.title': entry(ladder('The file name was adjusted'), ladder('檔案名稱已經調整咗')),
  'downloads.start.nameAdjusted.body': entry(
    ladder('It is being saved as {name}.'),
    ladder('而家會用 {name} 呢個名嚟儲存。')
  ),

  /* ---------------- Downloading progress window ---------------- */

  'downloads.progress.title': entry(ladder('Downloading {name}'), ladder('下載緊 {name}')),
  'downloads.progress.bar': entry(ladder('Transfer progress'), ladder('傳送進度')),
  'downloads.progress.received': entry(ladder('Received'), ladder('已收到')),
  'downloads.progress.rate': entry(ladder('Rate'), ladder('速度')),
  'downloads.progress.eta': entry(ladder('Time left'), ladder('剩餘時間')),
  'downloads.progress.eta.noTotal': entry(
    ladder('Unknown — the server declared no size.'),
    ladder('唔知道 —— 伺服器冇申報大小。')
  ),
  'downloads.progress.eta.none': entry(ladder('Not measurable yet.'), ladder('仲量唔到。')),
  'downloads.progress.elapsed': entry(ladder('Elapsed'), ladder('已用時間')),
  'downloads.progress.destination': entry(ladder('Writing to'), ladder('寫入')),
  'downloads.progress.source': entry(ladder('From'), ladder('嚟自')),
  'downloads.progress.resumable': entry(ladder('Resumable'), ladder('可以續傳')),
  'downloads.progress.resumable.unknown': entry(
    ladder('Not known until the server has answered.'),
    ladder('要等伺服器回覆先知。')
  ),
  'downloads.progress.resumable.yes': entry(
    ladder('Yes — the server accepts a range request.'),
    ladder('可以 —— 伺服器接受範圍要求。')
  ),
  'downloads.progress.resumable.no': entry(
    ladder('No — this server restarts from the beginning.'),
    ladder('唔可以 —— 呢個伺服器要由頭嚟過。')
  ),
  'downloads.progress.announce': entry(ladder('{name}: {state}'), ladder('{name}：{state}')),

  /* ---------------- action labels ---------------- */

  'downloads.action.pause': entry(ladder('Pause'), ladder('暫停')),
  'downloads.action.resume': entry(ladder('Resume'), ladder('繼續')),
  'downloads.action.retry': entry(ladder('Retry'), ladder('重試')),
  'downloads.action.cancel': entry(ladder('Cancel'), ladder('取消')),
  'downloads.action.openFile': entry(ladder('Open the file'), ladder('打開檔案')),
  'downloads.action.reveal': entry(ladder('Show in folder'), ladder('喺資料夾顯示')),
  'downloads.action.closeWindow': entry(ladder('Close this window'), ladder('關閉呢個視窗')),
  'downloads.action.showInList': entry(ladder('Show in the list'), ladder('喺清單顯示')),
  'downloads.action.dismiss': entry(ladder('Dismiss'), ladder('忽略')),
  'downloads.action.openProgress': entry(ladder('Show progress window'), ladder('顯示進度視窗')),
  'downloads.action.addManual': entry(ladder('Add by address'), ladder('用網址新增')),
  'downloads.action.removeSelected': entry(ladder('Remove selected'), ladder('移除已選')),
  'downloads.action.retrySelected': entry(ladder('Retry selected'), ladder('重試已選')),
  'downloads.action.pauseSelected': entry(ladder('Pause selected'), ladder('暫停已選')),
  'downloads.action.resumeSelected': entry(ladder('Resume selected'), ladder('繼續已選')),
  'downloads.action.selectInverse': entry(ladder('Select the opposite'), ladder('反向選擇')),
  'downloads.action.exportSelected': entry(ladder('Export'), ladder('匯出')),

  /* ---------------- completion surface ---------------- */

  'downloads.complete.title': entry(
    ladder('Download complete', 'Download complete', 'Download complete', 'Landed. Download complete.', 'Landed. Download complete.'),
    ladder('下載完成', '下載完成', '下載完成', '搞掂，下載完成', '搞掂，下載完成')
  ),
  'downloads.complete.body': entry(
    ladder('{size} written to {path}{duration}'),
    ladder('{size} 已經寫入 {path}{duration}')
  ),
  'downloads.cancelled.title': entry(ladder('Download cancelled'), ladder('下載已取消')),
  'downloads.failed.title': entry(
    ladder('Download failed', 'Download failed', 'Download failed', 'That download did not make it.', 'That download did not make it.'),
    ladder('下載失敗', '下載失敗', '下載失敗', '呢個下載冚咗檔', '呢個下載冚咗檔')
  ),
  'downloads.failed.noReason': entry(
    ladder('The transfer stopped without the server giving a reason.'),
    ladder('傳送停咗，伺服器冇講原因。')
  ),
  'downloads.failed.partial': entry(
    ladder('Received so far: {size}.'),
    ladder('目前已收到：{size}。')
  ),

  /* ---------------- states ---------------- */

  'downloads.state.awaiting-decision': entry(ladder('Waiting for your decision'), ladder('等緊你決定')),
  'downloads.state.queued': entry(ladder('Queued'), ladder('排緊隊')),
  'downloads.state.connecting': entry(ladder('Connecting'), ladder('連緊接')),
  'downloads.state.downloading': entry(ladder('Downloading'), ladder('下載緊')),
  'downloads.state.paused': entry(ladder('Paused'), ladder('已暫停')),
  'downloads.state.interrupted': entry(ladder('Interrupted'), ladder('中斷咗')),
  'downloads.state.completed': entry(ladder('Completed'), ladder('已完成')),
  'downloads.state.cancelled': entry(ladder('Cancelled'), ladder('已取消')),
  'downloads.state.failed': entry(ladder('Failed'), ladder('失敗咗')),

  /* ---------------- shared values ---------------- */

  'downloads.value.none': entry(ladder('None'), ladder('無')),
  'downloads.value.unknownHost': entry(ladder('An unnamed host'), ladder('冇名嘅主機')),

  /* ---------------- the list tab ---------------- */

  'downloads.search': entry(ladder('Search downloads'), ladder('搵下載')),
  'downloads.column.filename': entry(ladder('File'), ladder('檔案')),
  'downloads.column.state': entry(ladder('State'), ladder('狀態')),
  'downloads.column.progress': entry(ladder('Received'), ladder('已收到')),
  'downloads.column.rate': entry(ladder('Rate'), ladder('速度')),
  'downloads.column.destination': entry(ladder('Destination'), ladder('目的地')),
  'downloads.column.captured': entry(ladder('Captured'), ladder('擷取時間')),
  'downloads.column.actions': entry(ladder('Actions'), ladder('動作')),
  'downloads.table.empty': entry(
    ladder(
      'No downloads yet. Turn the capture receiver on and browse to something, or add one by address below.',
      'No downloads yet. Turn the capture receiver on and browse to something, or add one by address below.',
      'Nothing here yet. Switch the receiver on and browse to a file, or add one by address below.',
      'Empty so far. Flip the receiver on and go find something to catch, or just type an address in below.',
      'Empty so far. Flip the receiver on and go find something to catch, or just type an address in below.'
    ),
    ladder(
      '仲未有下載。開啟擷取接收器再去瀏覽啲嘢，或者喺下面用網址新增一個。',
      '仲未有下載。開啟擷取接收器再去瀏覽啲嘢，或者喺下面用網址新增一個。',
      '而家乜都冇。撳開接收器去搵嘢，或者喺下面打個網址加一個。',
      '空空如也。撳開接收器去周圍捉嘢，或者索性喺下面打個網址算數。',
      '空空如也。撳開接收器去周圍捉嘢，或者索性喺下面打個網址算數。'
    )
  ),
  'downloads.selection.summary': entry(
    ladder(
      '{selected} of {shown} shown selected ({total} total). There is no paging: "shown" is every current match.',
      '{selected} of {shown} shown selected ({total} total). There is no paging: "shown" is every current match.',
      '{selected} of {shown} shown selected, out of {total} total. No paging here — "shown" already means every match.',
      '{selected} of {shown} shown are picked, out of {total} in the whole list. No hidden second page — what you see is every match there is.',
      '{selected} of {shown} shown are picked, out of {total} in the whole list. No hidden second page — what you see is every match there is.'
    ),
    ladder(
      '目前顯示緊嘅 {shown} 個入面揀咗 {selected} 個（總共 {total} 個）。冇分頁：顯示緊嘅就係全部符合條件嘅。',
      '目前顯示緊嘅 {shown} 個入面揀咗 {selected} 個（總共 {total} 個）。冇分頁：顯示緊嘅就係全部符合條件嘅。',
      '而家見到嘅 {shown} 個揀咗 {selected} 個，總共 {total} 個。冇分頁㗎，見到嘅就係全部。',
      '見到嘅 {shown} 個揀咗 {selected} 個，全部總共 {total} 個。冇第二頁收埋嘢，見到幾多就係幾多。',
      '見到嘅 {shown} 個揀咗 {selected} 個，全部總共 {total} 個。冇第二頁收埋嘢，見到幾多就係幾多。'
    )
  ),
  'downloads.bulk.retry.title': entry(ladder('Retry selected'), ladder('重試已選')),
  'downloads.bulk.retry.none': entry(
    ladder('None of the selected downloads have failed, so nothing was retried.'),
    ladder('已選嘅下載入面冇一個係失敗嘅，所以冇重試過。')
  ),
  'downloads.bulk.retry.done': entry(
    ladder('{count} of {selected} selected downloads were retried.'),
    ladder('已選嘅 {selected} 個入面，重試咗 {count} 個。')
  ),
  'downloads.bulk.pause.title': entry(ladder('Pause selected'), ladder('暫停已選')),
  'downloads.bulk.pause.none': entry(
    ladder('None of the selected downloads are running, so nothing was paused.'),
    ladder('已選嘅下載入面冇一個喺度傳送緊，所以冇暫停過。')
  ),
  'downloads.bulk.pause.done': entry(
    ladder('{count} of {selected} selected downloads were paused.'),
    ladder('已選嘅 {selected} 個入面，暫停咗 {count} 個。')
  ),
  'downloads.bulk.resume.title': entry(ladder('Resume selected'), ladder('繼續已選')),
  'downloads.bulk.resume.none': entry(
    ladder('None of the selected downloads can be resumed right now, so nothing changed.'),
    ladder('已選嘅下載而家冇一個可以繼續，所以乜都冇變。')
  ),
  'downloads.bulk.resume.done': entry(
    ladder('{count} of {selected} selected downloads were resumed.'),
    ladder('已選嘅 {selected} 個入面，繼續咗 {count} 個。')
  ),
  'downloads.export.title': entry(ladder('Export downloads'), ladder('匯出下載')),
  'downloads.export.empty': entry(
    ladder('Nothing is selected, so there is nothing to export.'),
    ladder('冇揀任何嘢，所以冇嘢可以匯出。')
  ),
  'downloads.export.lossy.title': entry(
    ladder('Some fields cannot be saved in this format'),
    ladder('有啲欄位呢個格式儲存唔到')
  ),
  'downloads.export.lossy.confirm': entry(ladder('Export anyway'), ladder('照樣匯出')),
  'downloads.export.lossy.cancel': entry(ladder('Cancel'), ladder('取消')),
  'downloads.export.done.title': entry(ladder('Export complete'), ladder('匯出完成')),

  /* ---------------- receiver card ---------------- */

  'downloads.receiver.card.title': entry(ladder('Capture receiver'), ladder('擷取接收器')),
  'downloads.receiver.card.description': entry(
    ladder(
      'The loopback listener the browser extension talks to. It runs as a small local Node process; it never listens on anything but 127.0.0.1.',
      'The loopback listener the browser extension talks to. It runs as a small local Node process; it never listens on anything but 127.0.0.1.',
      'The local address the browser extension hands captures to. A small Node process, listening only on 127.0.0.1, nowhere else.',
      'The little local doorbell the browser extension rings. It is a small Node process that only ever answers on 127.0.0.1 — nothing outside this machine can reach it.',
      'The little local doorbell the browser extension rings. It is a small Node process that only ever answers on 127.0.0.1 — nothing outside this machine can reach it.'
    ),
    ladder(
      '瀏覽器擴充程式對話嘅本機接聽位。以細細個本機 Node 程序運行，永遠只聽 127.0.0.1。',
      '瀏覽器擴充程式對話嘅本機接聽位。以細細個本機 Node 程序運行，永遠只聽 127.0.0.1。',
      '瀏覽器擴充程式交低嘢嘅本機位置。一個細細個 Node 程序，淨係聽 127.0.0.1，第二度都唔聽。',
      '瀏覽器擴充程式撳嘅本機門鐘。一個細細個 Node 程序，淨係喺 127.0.0.1 度應門 —— 呢部機以外嘅嘢摸都摸唔到佢。',
      '瀏覽器擴充程式撳嘅本機門鐘。一個細細個 Node 程序，淨係喺 127.0.0.1 度應門 —— 呢部機以外嘅嘢摸都摸唔到佢。'
    )
  ),
  'downloads.receiver.status.stopped': entry(ladder('Stopped'), ladder('已停止')),
  'downloads.receiver.status.starting': entry(ladder('Starting…'), ladder('啟動緊…')),
  'downloads.receiver.status.listening': entry(ladder('Listening'), ladder('接聽緊')),
  'downloads.receiver.status.failed': entry(ladder('Failed'), ladder('失敗咗')),
  'downloads.receiver.status.unavailable': entry(ladder('Unavailable — Node was not found'), ladder('用唔到 —— 搵唔到 Node')),
  'downloads.receiver.status.degraded': entry(ladder('Listening, with reduced reporting'), ladder('接聽緊，回報少咗')),
  'downloads.receiver.detail.listening': entry(
    ladder('Listening on {endpoint}. Node {version}.'),
    ladder('喺 {endpoint} 接聽緊。Node {version}。')
  ),
  'downloads.receiver.start': entry(ladder('Start the receiver'), ladder('開啟接收器')),
  'downloads.receiver.stop': entry(ladder('Stop the receiver'), ladder('停止接收器')),
  'downloads.receiver.restart': entry(ladder('Restart the receiver'), ladder('重新啟動接收器')),
  'downloads.receiver.pairing.open': entry(ladder('Show pairing details'), ladder('顯示配對資料')),
  'downloads.receiver.pairing.title': entry(ladder('Pair the browser extension'), ladder('配對瀏覽器擴充程式')),
  'downloads.receiver.pairing.notListening': entry(
    ladder(
      'The receiver is not listening right now, so there is nothing to pair yet. Start it first.',
      'The receiver is not listening right now, so there is nothing to pair yet. Start it first.',
      'The receiver is off right now, so there is nothing to hand over yet. Start it, then come back.',
      'The receiver is having a nap, so there is nothing to pair with. Wake it up first, then come back here.',
      'The receiver is having a nap, so there is nothing to pair with. Wake it up first, then come back here.'
    ),
    ladder(
      '接收器而家未接聽緊，所以未有嘢可以配對。請先開啟佢。',
      '接收器而家未接聽緊，所以未有嘢可以配對。請先開啟佢。',
      '接收器而家閂咗，未有嘢俾配對。開返佢先，再返嚟。',
      '接收器瞓緊教，冇嘢俾你配對。叫醒佢先，再返嚟呢度。',
      '接收器瞓緊教，冇嘢俾你配對。叫醒佢先，再返嚟呢度。'
    )
  ),
  'downloads.receiver.pairing.intro': entry(
    ladder(
      'In the extension\u2019s settings, paste both of these and press Test the connection.',
      'In the extension\u2019s settings, paste both of these and press Test the connection.',
      'Paste both of these into the extension\u2019s settings, then press Test the connection.',
      'Copy both of these into the extension\u2019s settings and hit Test the connection — that is the whole ceremony.',
      'Copy both of these into the extension\u2019s settings and hit Test the connection — that is the whole ceremony.'
    ),
    ladder(
      '喺擴充程式嘅設定入面，貼上呢兩樣嘢，然後撳測試連線。',
      '喺擴充程式嘅設定入面，貼上呢兩樣嘢，然後撳測試連線。',
      '將呢兩樣嘢貼入擴充程式設定，撳測試連線就得。',
      '將呢兩嚿嘢貼入擴充程式設定，撳一下測試連線，成個儀式就係咁多。',
      '將呢兩嚿嘢貼入擴充程式設定，撳一下測試連線，成個儀式就係咁多。'
    )
  ),
  'downloads.receiver.endpoint.label': entry(ladder('Loopback address'), ladder('本機接聽位址')),
  'downloads.receiver.token.label': entry(ladder('Pairing token'), ladder('配對權杖')),
  'downloads.receiver.pairing.copyEndpoint': entry(ladder('Copy the address'), ladder('複製位址')),
  'downloads.receiver.pairing.copyToken': entry(ladder('Copy the token'), ladder('複製權杖')),
  'downloads.receiver.pairing.regenerate': entry(
    ladder(
      'A new token is generated every time the receiver starts. If pairing stops working, the receiver was restarted — come back here for the new one.',
      'A new token is generated every time the receiver starts. If pairing stops working, the receiver was restarted — come back here for the new one.',
      'The token is regenerated on every start. If pairing suddenly stops working, the receiver restarted — grab the new token here.',
      'A fresh token is minted every single time the receiver starts. If pairing goes quiet, that is just the receiver having restarted — pop back here for the new one.',
      'A fresh token is minted every single time the receiver starts. If pairing goes quiet, that is just the receiver having restarted — pop back here for the new one.'
    ),
    ladder(
      '每次接收器開機都會重新產生權杖。如果配對突然唔得，即係接收器重開咗，返嚟呢度攞新嗰個。',
      '每次接收器開機都會重新產生權杖。如果配對突然唔得，即係接收器重開咗，返嚟呢度攞新嗰個。',
      '接收器每開一次機，權杖就換一次。配對突然死咗，即係接收器重開咗，返嚟拎新嗰個。',
      '接收器每次開機都換過個新權杖。配對突然斷晒線，梗係接收器啱啱重開咗，返嚟呢度執返個新嘅。',
      '接收器每次開機都換過個新權杖。配對突然斷晒線，梗係接收器啱啱重開咗，返嚟呢度執返個新嘅。'
    )
  ),
  'downloads.receiver.pairing.close': entry(ladder('Done'), ladder('搞掂')),

  /* ---------------- settings ---------------- */

  'downloads.settings.folder': entry(ladder('Download folder'), ladder('下載資料夾')),
  'downloads.settings.folder.description': entry(
    ladder(
      'Where new downloads are saved when no folder is chosen in the Start download dialog for that transfer. Leave empty to use the application\u2019s own data folder.',
      'Where new downloads are saved when no folder is chosen in the Start download dialog for that transfer. Leave empty to use the application\u2019s own data folder.',
      'The default save folder, used whenever the Start download dialog is not given a different one for that transfer. Empty means the application\u2019s own data folder.',
      'Where things land when you have not told the Start download dialog otherwise for that particular file. Leave it blank and it falls back to the application\u2019s own data folder.',
      'Where things land when you have not told the Start download dialog otherwise for that particular file. Leave it blank and it falls back to the application\u2019s own data folder.'
    ),
    ladder(
      '喺開始下載對話框冇揀資料夾嘅時候，新下載會存喺呢度。留空就會用程式自己嘅資料資料夾。',
      '喺開始下載對話框冇揀資料夾嘅時候，新下載會存喺呢度。留空就會用程式自己嘅資料資料夾。',
      '開始下載對話框冇另外指定嘅話，就會存喺呢度。留空就用返程式自己嘅資料夾。',
      '如果嗰次冇喺開始下載對話框話要放邊，就會跌落呢度。留空就跌返落程式自己個資料夾。',
      '如果嗰次冇喺開始下載對話框話要放邊，就會跌落呢度。留空就跌返落程式自己個資料夾。'
    )
  ),
  'downloads.settings.autoStartReceiver': entry(ladder('Start the receiver automatically'), ladder('自動開啟接收器')),
  'downloads.settings.autoStartReceiver.description': entry(
    ladder(
      'Starts the capture receiver as soon as the application launches, so the browser extension can hand over a capture straight away.',
      'Starts the capture receiver as soon as the application launches, so the browser extension can hand over a capture straight away.',
      'Turns the receiver on the moment the application opens, so the extension can hand things over right away.',
      'Fires the receiver up the instant the app opens, so the extension never has to wait around to hand something over.',
      'Fires the receiver up the instant the app opens, so the extension never has to wait around to hand something over.'
    ),
    ladder(
      '程式一開機就會啟動擷取接收器，等瀏覽器擴充程式可以即刻交低擷取到嘅嘢。',
      '程式一開機就會啟動擷取接收器，等瀏覽器擴充程式可以即刻交低擷取到嘅嘢。',
      '程式一開就開埋接收器，擴充程式即刻有嘢交得。',
      '程式一開就即刻開埋接收器，擴充程式想交嘢都唔使等。',
      '程式一開就即刻開埋接收器，擴充程式想交嘢都唔使等。'
    )
  ),
  'downloads.settings.port': entry(ladder('Receiver port'), ladder('接收器連接埠')),
  'downloads.settings.port.description': entry(
    ladder(
      'The loopback port the receiver asks to bind. If it is taken, the operating system may hand back a different one — the Downloads tab always shows the real address.',
      'The loopback port the receiver asks to bind. If it is taken, the operating system may hand back a different one — the Downloads tab always shows the real address.',
      'The port the receiver tries to use. If something else already has it, the system may give a different one — the Downloads tab always shows the real one.',
      'The port the receiver asks for first. If somebody beat it to it, the system might hand back a different one — but the Downloads tab always tells you the true address, no guessing.',
      'The port the receiver asks for first. If somebody beat it to it, the system might hand back a different one — but the Downloads tab always tells you the true address, no guessing.'
    ),
    ladder(
      '接收器嘗試綁定嘅本機連接埠。如果畀人用咗，作業系統可能會改派另一個 —— 下載分頁永遠顯示真正嘅位址。',
      '接收器嘗試綁定嘅本機連接埠。如果畀人用咗，作業系統可能會改派另一個 —— 下載分頁永遠顯示真正嘅位址。',
      '接收器想用嘅連接埠。畀人霸咗嘅話，系統可能會派過第二個 —— 下載分頁永遠會話你知真正嗰個。',
      '接收器想開頭用嘅連接埠。畀人搶先霸咗，系統可能改派第二個 —— 但下載分頁永遠老實話你知真正個位址，唔使估。',
      '接收器想開頭用嘅連接埠。畀人搶先霸咗，系統可能改派第二個 —— 但下載分頁永遠老實話你知真正個位址，唔使估。'
    )
  ),
  'downloads.settings.askBeforeStarting': entry(ladder('Ask before every capture'), ladder('每次擷取都要問過')),
  'downloads.settings.askBeforeStarting.description': entry(
    ladder(
      'Opens the Start download dialog for every capture. Turning this off starts matching captures immediately, using the last folder and overwrite choice — the decision is still yours, made in advance.',
      'Opens the Start download dialog for every capture. Turning this off starts matching captures immediately, using the last folder and overwrite choice — the decision is still yours, made in advance.',
      'Every capture opens the Start dialog when this is on. Off starts them right away using the last folder and overwrite choice — you still decided, just earlier.',
      'On, every single catch gets its own Start dialog. Off, it just goes straight to the last folder and overwrite choice — you already made the call, this just carries it out.',
      'On, every single catch gets its own Start dialog. Off, it just goes straight to the last folder and overwrite choice — you already made the call, this just carries it out.'
    ),
    ladder(
      '每次擷取都會打開開始下載對話框。閂咗嘅話會即刻用返上次嘅資料夾同覆寫選擇開始 —— 決定仍然係你揀，只係早咗做。',
      '每次擷取都會打開開始下載對話框。閂咗嘅話會即刻用返上次嘅資料夾同覆寫選擇開始 —— 決定仍然係你揀，只係早咗做。',
      '開咗嘅話每次擷取都會有開始下載對話框。閂咗就即刻用返上次嘅資料夾同覆寫設定開始 —— 都係你話事，淨係早咗決定。',
      '開咗，每次捉到嘢都要過一次開始下載對話框。閂咗就照返上次嘅資料夾同覆寫決定直接開跑 —— 話事嘅始終係你，淨係提早咗講。',
      '開咗，每次捉到嘢都要過一次開始下載對話框。閂咗就照返上次嘅資料夾同覆寫決定直接開跑 —— 話事嘅始終係你，淨係提早咗講。'
    )
  ),
  'downloads.settings.maxConcurrent': entry(ladder('Maximum transfers at once'), ladder('同時最多幾多個傳送')),
  'downloads.settings.maxConcurrent.description': entry(
    ladder(
      'How many downloads may move bytes at the same time. Anything over the limit is genuinely queued and says so, rather than competing for the same connection.',
      'How many downloads may move bytes at the same time. Anything over the limit is genuinely queued and says so, rather than competing for the same connection.',
      'The cap on downloads running together. Anything past it is really queued, not silently fighting for bandwidth.',
      'How many transfers get to run at the exact same time. Anything past that number sits honestly in a queue rather than elbowing the others for the same pipe.',
      'How many transfers get to run at the exact same time. Anything past that number sits honestly in a queue rather than elbowing the others for the same pipe.'
    ),
    ladder(
      '幾多個下載可以同時移動位元組。超出上限嘅會真係排隊，並會咁樣話你知，唔會爭同一個連線。',
      '幾多個下載可以同時移動位元組。超出上限嘅會真係排隊，並會咁樣話你知，唔會爭同一個連線。',
      '同一時間可以跑幾多個下載嘅上限。超咗嘅就真係排緊隊，唔會靜雞雞爭頻寬。',
      '幾多個傳送可以同一時間一齊跑嘅上限。超出嗰啲老老實實排隊，唔會同其他嘅爭同一條喉。',
      '幾多個傳送可以同一時間一齊跑嘅上限。超出嗰啲老老實實排隊，唔會同其他嘅爭同一條喉。'
    )
  ),
  'downloads.settings.alwaysOnTop': entry(ladder('Keep the application above the browser'), ladder('保持程式喺瀏覽器上面')),
  'downloads.settings.alwaysOnTop.description': entry(
    ladder(
      'While a Start download or completion surface is open, keeps this window above the browser it came from, so the surface is never left behind an unrelated tab.',
      'While a Start download or completion surface is open, keeps this window above the browser it came from, so the surface is never left behind an unrelated tab.',
      'Keeps this window on top of the browser while a Start or completion surface is open, so it never ends up hiding behind another tab.',
      'Pins this window above the browser for as long as a Start or completion surface is open, so it never quietly ends up buried under some unrelated tab.',
      'Pins this window above the browser for as long as a Start or completion surface is open, so it never quietly ends up buried under some unrelated tab.'
    ),
    ladder(
      '開始下載或者完成畫面顯示緊嘅時候，會將呢個視窗保持喺瀏覽器上面，避免俾其他分頁遮住。',
      '開始下載或者完成畫面顯示緊嘅時候，會將呢個視窗保持喺瀏覽器上面，避免俾其他分頁遮住。',
      '開始下載或者完成畫面開緊嘅時候，會保持呢個視窗喺瀏覽器上面，唔會俾第二個分頁遮咗。',
      '開始下載定完成畫面開住嗰陣，會擺呢個視窗喺瀏覽器上面，唔會靜雞雞俾第二個分頁遮埋佢。',
      '開始下載定完成畫面開住嗰陣，會擺呢個視窗喺瀏覽器上面，唔會靜雞雞俾第二個分頁遮埋佢。'
    )
  ),
  'downloads.settings.openProgressWindow': entry(ladder('Open a progress window automatically'), ladder('自動開啟進度視窗')),
  'downloads.settings.openProgressWindow.description': entry(
    ladder(
      'Opens the separate Downloading progress window as soon as a transfer starts. Off leaves the download running; open it any time from the list.',
      'Opens the separate Downloading progress window as soon as a transfer starts. Off leaves the download running; open it any time from the list.',
      'Pops the Downloading progress window open the moment a transfer starts. Off, it still runs — open the window from the list whenever you like.',
      'Snaps the Downloading progress window open the second a transfer kicks off. Off, the download still gets on with it — pull the window up from the list whenever the mood strikes.',
      'Snaps the Downloading progress window open the second a transfer kicks off. Off, the download still gets on with it — pull the window up from the list whenever the mood strikes.'
    ),
    ladder(
      '傳送一開始就會開啟獨立嘅下載進度視窗。閂咗嘅話下載一樣照跑，隨時可以喺清單度開返嚟睇。',
      '傳送一開始就會開啟獨立嘅下載進度視窗。閂咗嘅話下載一樣照跑，隨時可以喺清單度開返嚟睇。',
      '傳送一開始就即刻彈個下載進度視窗出嚟。閂咗都照跑，想睇隨時喺清單開返嚟。',
      '傳送一開跑就即刻彈個進度視窗出嚟。閂咗照樣照跑落去，想睇幾時都得，喺清單度撳返出嚟就有。',
      '傳送一開跑就即刻彈個進度視窗出嚟。閂咗照樣照跑落去，想睇幾時都得，喺清單度撳返出嚟就有。'
    )
  ),
  'downloads.settings.showCompletion': entry(ladder('Show the completion surface'), ladder('顯示完成畫面')),
  'downloads.settings.showCompletion.description': entry(
    ladder(
      'Shows the always-on-top completion surface when a transfer finishes, succeeds or fails. Off falls back to an ordinary notification instead.',
      'Shows the always-on-top completion surface when a transfer finishes, succeeds or fails. Off falls back to an ordinary notification instead.',
      'Shows the always-on-top completion card when a transfer ends, either way. Off, you just get a normal notification instead.',
      'Pops the always-on-top completion card up the second a transfer wraps, win or lose. Off, it just quietly becomes an ordinary notification.',
      'Pops the always-on-top completion card up the second a transfer wraps, win or lose. Off, it just quietly becomes an ordinary notification.'
    ),
    ladder(
      '傳送完成、成功或者失敗嘅時候，會顯示置頂嘅完成畫面。閂咗就改用一般通知代替。',
      '傳送完成、成功或者失敗嘅時候，會顯示置頂嘅完成畫面。閂咗就改用一般通知代替。',
      '傳送完咗，唔理成功定失敗，都會彈個置頂完成卡出嚟。閂咗就得返普通通知。',
      '傳送一完咗，唔理贏定輸，都會彈個置頂完成卡出嚟。閂咗就靜雞雞變返普通通知算數。',
      '傳送一完咗，唔理贏定輸，都會彈個置頂完成卡出嚟。閂咗就靜雞雞變返普通通知算數。'
    )
  ),
  'downloads.settings.overwrite': entry(ladder('Overwrite by default'), ladder('預設覆寫')),
  'downloads.settings.overwrite.description': entry(
    ladder(
      'The Overwrite switch\u2019s starting position in the Start download dialog for a new capture. It is still a choice made in that dialog every time; this only sets where the switch starts.',
      'The Overwrite switch\u2019s starting position in the Start download dialog for a new capture. It is still a choice made in that dialog every time; this only sets where the switch starts.',
      'Where the Overwrite switch starts in the Start dialog for a new capture. It is still decided there every time — this just sets its default position.',
      'Just sets where the Overwrite switch starts out sitting in the Start dialog for a fresh capture. You still flip it (or not) every single time — this is only the starting position.',
      'Just sets where the Overwrite switch starts out sitting in the Start dialog for a fresh capture. You still flip it (or not) every single time — this is only the starting position.'
    ),
    ladder(
      '新擷取喺開始下載對話框入面「覆寫」開關嘅起始位置。每次都仍然要喺嗰個對話框揀；呢度淨係設定開關嘅起始狀態。',
      '新擷取喺開始下載對話框入面「覆寫」開關嘅起始位置。每次都仍然要喺嗰個對話框揀；呢度淨係設定開關嘅起始狀態。',
      '新擷取喺開始下載對話框入面「覆寫」個開關一開始企邊個位。每次都要喺嗰度揀，呢度淨係設定開頭嘅位置。',
      '新擷取喺開始下載嗰度「覆寫」開關一開始擺邊個位，淨係呢度話事。每次都仲要你自己撳過，呢度淨係話開頭擺邊。',
      '新擷取喺開始下載嗰度「覆寫」開關一開始擺邊個位，淨係呢度話事。每次都仲要你自己撳過，呢度淨係話開頭擺邊。'
    )
  ),
  'downloads.settings.revealOnCompletion': entry(ladder('Reveal in the file manager when finished'), ladder('完成後喺檔案總管顯示')),
  'downloads.settings.revealOnCompletion.description': entry(
    ladder(
      'Opens the platform file manager to the finished file automatically as soon as a transfer completes.',
      'Opens the platform file manager to the finished file automatically as soon as a transfer completes.',
      'Automatically pops the file manager open at the finished file the moment a transfer completes.',
      'The instant a transfer wraps up, the file manager pops open right at the finished file — no clicking required.',
      'The instant a transfer wraps up, the file manager pops open right at the finished file — no clicking required.'
    ),
    ladder(
      '傳送一完成，就會自動喺作業系統嘅檔案總管度打開完成咗嘅檔案。',
      '傳送一完成，就會自動喺作業系統嘅檔案總管度打開完成咗嘅檔案。',
      '傳送一完成就自動彈個檔案總管出嚟，直接指住完成咗嗰個檔案。',
      '傳送一搞掂，即刻自動彈個檔案總管出嚟，指實個完成檔案畀你睇，都唔使撳。',
      '傳送一搞掂，即刻自動彈個檔案總管出嚟，指實個完成檔案畀你睇，都唔使撳。'
    )
  ),
  'downloads.settings.restartReceiver': entry(ladder('Restart the capture receiver'), ladder('重新啟動擷取接收器')),
  'downloads.settings.restartReceiver.description': entry(
    ladder(
      'Stops and starts the receiver again, generating a fresh pairing token. Any transfer in progress is not affected; it keeps running.',
      'Stops and starts the receiver again, generating a fresh pairing token. Any transfer in progress is not affected; it keeps running.',
      'Stops and restarts the receiver with a brand-new pairing token. A transfer already running is left alone.',
      'Kills the receiver and brings it straight back up with a fresh pairing token. Anything already mid-transfer just keeps chugging along, unbothered.',
      'Kills the receiver and brings it straight back up with a fresh pairing token. Anything already mid-transfer just keeps chugging along, unbothered.'
    ),
    ladder(
      '停止再重新啟動接收器，並產生一個新嘅配對權杖。進行緊嘅傳送唔會受影響，會繼續跑落去。',
      '停止再重新啟動接收器，並產生一個新嘅配對權杖。進行緊嘅傳送唔會受影響，會繼續跑落去。',
      '停咗再開返接收器，換過個新配對權杖。已經傳送緊嘅唔會受影響，照跑。',
      '一鑊淨閂咗再開返個接收器，換過個新鮮配對權杖。已經傳送緊嗰啲乜都唔理，照跑落去。',
      '一鑊淨閂咗再開返個接收器，換過個新鮮配對權杖。已經傳送緊嗰啲乜都唔理，照跑落去。'
    )
  ),
  'downloads.settings.showPairing': entry(ladder('Show browser extension pairing details'), ladder('顯示瀏覽器擴充配對資料')),
  'downloads.settings.showPairing.description': entry(
    ladder(
      'Opens the same pairing details shown on the Downloads tab: the loopback address and the current token.',
      'Opens the same pairing details shown on the Downloads tab: the loopback address and the current token.',
      'Shows the exact same pairing details as the Downloads tab: the address and the current token.',
      'Pops open the very same pairing details the Downloads tab shows — the address and whatever token is live right now.',
      'Pops open the very same pairing details the Downloads tab shows — the address and whatever token is live right now.'
    ),
    ladder(
      '打開同下載分頁一樣嘅配對資料：本機接聽位址同目前嘅權杖。',
      '打開同下載分頁一樣嘅配對資料：本機接聽位址同目前嘅權杖。',
      '打開同下載分頁一模一樣嘅配對資料：位址同目前嘅權杖。',
      '彈出同下載分頁一模一樣嘅配對資料 —— 位址同而家生效緊嗰個權杖。',
      '彈出同下載分頁一模一樣嘅配對資料 —— 位址同而家生效緊嗰個權杖。'
    )
  )
};
