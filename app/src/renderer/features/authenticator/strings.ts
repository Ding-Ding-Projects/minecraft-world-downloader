/**
 * Every piece of copy this feature renders, in English and in playful Hong Kong
 * Cantonese, at all five humour levels.
 *
 * The humour styles the VOICE and never the facts. A warning at level five is
 * still exact about which entry is affected, what is about to happen and what
 * cannot be undone; a code, a secret, an algorithm name, a digit count, a period
 * and a number of seconds read the same at every level in both languages.
 */

import type { Catalogue, FunnyLadder, TranslationEntry } from '../../core/registry';

function ladder(...steps: string[]): FunnyLadder {
  if (steps.length === 1) return [steps[0], steps[0], steps[0], steps[0], steps[0]];
  if (steps.length === 2) return [steps[0], steps[0], steps[0], steps[1], steps[1]];
  if (steps.length === 3) return [steps[0], steps[0], steps[1], steps[2], steps[2]];
  if (steps.length === 4) return [steps[0], steps[1], steps[2], steps[3], steps[3]];
  if (steps.length === 5) return steps as unknown as FunnyLadder;
  throw new Error(`A ladder takes 1 to 5 strings; ${steps.length} were given.`);
}

function entry(en: FunnyLadder, yue: FunnyLadder): TranslationEntry {
  return { en, yue };
}

export const AUTHENTICATOR_STRINGS: Catalogue = {
  /* ---------------- the destination ---------------- */

  'authenticator.title': entry(ladder('Authenticator'), ladder('驗證器')),
  'authenticator.subtitle': entry(
    ladder(
      'One-time codes for your own accounts, generated on this computer.',
      'Your own one-time codes, worked out right here on this computer.',
      'Your one-time codes, cooked fresh on this computer — no cloud, no account, no nonsense.'
    ),
    ladder(
      '你自己嘅一次性驗證碼，喺呢部電腦度計出嚟。',
      '你嘅一次性碼，喺呢部電腦度即場計，唔使上網。',
      '你嘅一次性碼，喺呢部機即叫即整，冇雲端冇戶口冇廢話。'
    )
  ),
  'authenticator.tab.entries': entry(ladder('Codes'), ladder('驗證碼')),
  'authenticator.tab.checks': entry(ladder('Verification'), ladder('驗證測試')),

  /* ---------------- the list ---------------- */

  'authenticator.list.label': entry(ladder('Registered accounts'), ladder('已登記嘅戶口')),
  'authenticator.search': entry(ladder('Search entries'), ladder('搵嘢')),
  'authenticator.search.placeholder': entry(
    ladder('Issuer, account, label or note'),
    ladder('發行方、戶口、標籤或者備註')
  ),
  'authenticator.empty.title': entry(
    ladder('No entries yet', 'Nothing in here yet', 'Empty as a dim sum basket at four o’clock'),
    ladder('未有任何項目', '呢度重係空嘅', '空到好似四點半嘅蒸籠')
  ),
  'authenticator.empty.body': entry(
    ladder(
      'Add an account and its codes appear here. Nothing is created for you and no example data is shipped.',
      'Add an account and its codes turn up here. There is no sample data: an empty list means the list really is empty.',
      'Add an account and the codes show up here. No fake samples to make it look busy — empty means empty.'
    ),
    ladder(
      '加咗戶口之後，驗證碼就會喺呢度出現。呢度冇任何示範資料。',
      '加個戶口，個碼就會喺度。冇假資料扮熱鬧，空就係真係空。',
      '加個戶口先啦，個碼即刻喺度。唔會擺啲假嘢扮好多嘢做，空就係真空。'
    )
  ),
  'authenticator.empty.action': entry(ladder('Add an account'), ladder('加個戶口')),
  'authenticator.count': entry(
    ladder('{shown} of {total} shown'),
    ladder('顯示緊 {total} 個之中嘅 {shown} 個')
  ),
  'authenticator.paging': entry(
    ladder('Showing entries {from} to {to} of {total}'),
    ladder('顯示第 {from} 至 {to} 個，總共 {total} 個')
  ),
  'authenticator.page.next': entry(ladder('Next page'), ladder('下一頁')),
  'authenticator.page.previous': entry(ladder('Previous page'), ladder('上一頁')),

  /* ---------------- one row ---------------- */

  'authenticator.code': entry(ladder('Current code'), ladder('而家個碼')),
  'authenticator.code.copy': entry(ladder('Copy code'), ladder('複製個碼')),
  'authenticator.code.copied': entry(
    ladder('Code copied', 'The code is on the clipboard', 'Snatched it — the code is on your clipboard'),
    ladder('已複製個碼', '個碼已經喺剪貼簿', '搶咗嚟喇，個碼喺剪貼簿度')
  ),
  'authenticator.code.next': entry(ladder('Next code'), ladder('下一個碼')),
  'authenticator.code.hidden': entry(ladder('Hidden'), ladder('已收埋')),
  'authenticator.code.reveal': entry(ladder('Show this code'), ladder('顯示呢個碼')),
  'authenticator.code.unavailable': entry(
    ladder('No secret is stored for this entry'),
    ladder('呢個項目冇儲低密鑰')
  ),
  'authenticator.code.unavailable.body': entry(
    ladder(
      'The record exists but the credential vault has nothing under its key, so no code can be produced. Register the account again, or delete this row.',
      'The row is here but the vault is empty behind it, so there is no code to give you. Register it again, or delete the row.',
      'The row survived but its secret did not. Nothing to compute from — register it again, or send the row on its way.'
    ),
    ladder(
      '記錄仲喺度，但憑證保險庫入面冇對應嘅密鑰，所以計唔到碼。請重新登記，或者刪走呢一行。',
      '行係喺度，但係後面個保險庫空咗，計唔到碼㗎。重新登記過，或者刪咗佢。',
      '行仲喺度，密鑰就唔見咗。冇嘢計得到 — 重新登記，或者送佢走。'
    )
  ),
  'authenticator.seconds': entry(
    ladder('{seconds} seconds left'),
    ladder('仲有 {seconds} 秒')
  ),
  'authenticator.seconds.short': entry(ladder('{seconds}s'), ladder('{seconds}秒')),
  'authenticator.parameters': entry(
    ladder('{algorithm}, {digits} digits, every {period} seconds'),
    ladder('{algorithm}，{digits} 位數，每 {period} 秒')
  ),
  'authenticator.unverified': entry(ladder('Not checked'), ladder('未核對過')),
  'authenticator.unverified.explain': entry(
    ladder(
      'No live code from this secret was ever matched, so a typing mistake in the secret would not have been caught.',
      'Nobody ever checked a live code against this one, so a slip in the secret would have gone unnoticed.',
      'This one was never spot-checked, so if a character went astray nobody would know until it mattered.'
    ),
    ladder(
      '未曾用即時碼核對過，所以密鑰打錯咗都唔會發現到。',
      '未試過即場對過個碼，所以打漏咗個字都冇人知。',
      '從來冇人抽查過，打錯咗都要等到緊要關頭先知。'
    )
  ),
  'authenticator.row.menu': entry(ladder('Entry actions'), ladder('項目操作')),
  'authenticator.row.edit': entry(ladder('Edit details…'), ladder('改資料…')),
  'authenticator.row.showPairing': entry(ladder('Show pairing code…'), ladder('顯示配對碼…')),
  'authenticator.row.reveal': entry(ladder('Reveal the secret…'), ladder('顯示密鑰…')),
  'authenticator.row.moveUp': entry(ladder('Move up'), ladder('向上移')),
  'authenticator.row.moveDown': entry(ladder('Move down'), ladder('向下移')),
  'authenticator.row.group': entry(ladder('Move into group…'), ladder('放入群組…')),
  'authenticator.row.delete': entry(ladder('Delete this entry…'), ladder('刪除呢個項目…')),
  'authenticator.row.label': entry(ladder('Label'), ladder('標籤')),
  'authenticator.row.icon': entry(ladder('Icon'), ladder('圖示')),
  'authenticator.row.note': entry(ladder('Note'), ladder('備註')),
  'authenticator.row.group.field': entry(ladder('Group'), ladder('群組')),
  'authenticator.row.group.none': entry(ladder('No group'), ladder('唔入群組')),

  /* ---------------- selection and bulk ---------------- */

  'authenticator.select': entry(ladder('Select {name}'), ladder('揀 {name}')),
  'authenticator.selection': entry(
    ladder('{count} selected'),
    ladder('揀咗 {count} 個')
  ),
  'authenticator.selectAllMatching': entry(
    ladder('Select all {count} matching this search'),
    ladder('揀晒符合搜尋嘅 {count} 個')
  ),
  'authenticator.selectAllEverything': entry(
    ladder('Select all {count} entries, including those the search hides'),
    ladder('揀晒全部 {count} 個，包埋搜尋隱藏咗嗰啲')
  ),
  'authenticator.invertSelection': entry(ladder('Invert the selection'), ladder('反轉揀咗嘅嘢')),
  'authenticator.clearSelection': entry(ladder('Clear the selection'), ladder('唔揀住先')),
  'authenticator.bulk.delete': entry(ladder('Delete selected…'), ladder('刪除揀咗嘅…')),
  'authenticator.bulk.export': entry(ladder('Export selected…'), ladder('匯出揀咗嘅…')),
  'authenticator.bulk.group': entry(ladder('Move selected into group…'), ladder('將揀咗嘅放入群組…')),
  'authenticator.bulk.preview': entry(
    ladder('These {count} entries will be affected:'),
    ladder('會影響到呢 {count} 個項目：')
  ),
  'authenticator.delete.irreversible': entry(
    ladder(
      'The secret behind each of these entries is removed from the credential vault. Nothing here can produce their codes afterwards, and only the issuer can give you a new secret.'
    ),
    ladder(
      '每個項目背後嘅密鑰都會由憑證保險庫入面移除。之後呢度再計唔到佢哋嘅碼，只有發行方先可以再畀你一個新密鑰。'
    )
  ),
  'authenticator.bulk.none': entry(
    ladder('Nothing is selected, so there is nothing to act on.'),
    ladder('乜都未揀，所以冇嘢好做。')
  ),

  /* ---------------- groups ---------------- */

  'authenticator.groups.title': entry(ladder('Groups'), ladder('群組')),
  'authenticator.groups.create': entry(ladder('New group…'), ladder('開個新群組…')),
  'authenticator.groups.name': entry(ladder('Group name'), ladder('群組名')),
  'authenticator.groups.search': entry(ladder('Search groups'), ladder('搵群組')),
  'authenticator.groups.empty': entry(
    ladder('No groups yet. Create one and entries can be moved into it.'),
    ladder('重未有群組。開一個，就可以將項目放入去。')
  ),
  'authenticator.groups.collapse': entry(ladder('Collapse {name}'), ladder('收埋 {name}')),
  'authenticator.groups.expand': entry(ladder('Expand {name}'), ladder('展開 {name}')),
  'authenticator.groups.ungrouped': entry(ladder('Ungrouped'), ladder('未分組')),
  'authenticator.groups.delete': entry(ladder('Delete this group'), ladder('刪除呢個群組')),
  'authenticator.groups.deleteKeeps': entry(
    ladder('Deleting a group keeps its entries; they simply stop being grouped.'),
    ladder('刪群組唔會刪入面嘅項目，佢哋淨係唔再分組咋。')
  ),

  /* ---------------- registration ---------------- */

  'authenticator.add': entry(ladder('Add an account'), ladder('加個戶口')),
  'authenticator.add.title': entry(ladder('Add a one-time code account'), ladder('加一個一次性驗證碼戶口')),
  'authenticator.add.route': entry(ladder('How you have the secret'), ladder('你手上嘅密鑰喺邊種形式')),
  'authenticator.add.route.generate': entry(ladder('Create a new secret here'), ladder('喺呢度整個新密鑰')),
  'authenticator.add.route.uri': entry(ladder('Paste a pairing link'), ladder('貼上配對連結')),
  'authenticator.add.route.image': entry(ladder('Read a picture of a code'), ladder('讀一張碼嘅相')),
  'authenticator.add.route.camera': entry(ladder('Scan with a camera'), ladder('用鏡頭掃')),
  'authenticator.add.route.manual': entry(ladder('Type the secret'), ladder('自己打密鑰')),
  'authenticator.add.regenerate': entry(ladder('Draw a different secret'), ladder('換過另一個密鑰')),
  'authenticator.add.issuer': entry(ladder('Issuer'), ladder('發行方')),
  'authenticator.add.issuer.hint': entry(
    ladder('The service the code is for, for example the site name'),
    ladder('個碼係用嚟登入邊個服務，例如網站名')
  ),
  'authenticator.add.account': entry(ladder('Account'), ladder('戶口')),
  'authenticator.add.account.hint': entry(
    ladder('Which account at that service, usually an email address or user name'),
    ladder('嗰個服務入面邊個戶口，通常係電郵或者用戶名')
  ),
  'authenticator.add.algorithm': entry(ladder('Algorithm'), ladder('演算法')),
  'authenticator.add.digits': entry(ladder('Digits'), ladder('位數')),
  'authenticator.add.period': entry(ladder('Period in seconds'), ladder('週期（秒）')),
  'authenticator.add.secret': entry(ladder('Secret in base32'), ladder('Base32 密鑰')),
  'authenticator.add.uri': entry(ladder('Pairing link'), ladder('配對連結')),
  'authenticator.add.uri.hint': entry(
    ladder('Starts with otpauth://totp/ — every parameter it carries is kept'),
    ladder('由 otpauth://totp/ 開頭 — 入面帶嘅設定會照跟')
  ),
  'authenticator.add.paste': entry(ladder('Paste from clipboard'), ladder('由剪貼簿貼上')),
  'authenticator.add.pasteImage': entry(ladder('Read the picture on the clipboard'), ladder('讀剪貼簿入面張相')),
  'authenticator.add.chooseImage': entry(ladder('Choose a picture…'), ladder('揀張相…')),
  'authenticator.add.cameras': entry(ladder('Camera'), ladder('鏡頭')),
  'authenticator.add.startCamera': entry(ladder('Start the camera'), ladder('開鏡頭')),
  'authenticator.add.stopCamera': entry(ladder('Stop the camera'), ladder('熄鏡頭')),
  'authenticator.add.noCamera': entry(
    ladder('No camera was found on this computer, so scanning is not available. The other routes all work.'),
    ladder('呢部電腦搵唔到鏡頭，所以掃唔到。其他方法照用得。')
  ),
  'authenticator.add.cameraRefused': entry(
    ladder('The camera was not made available: {reason}'),
    ladder('用唔到鏡頭：{reason}')
  ),
  'authenticator.add.scanning': entry(ladder('Looking for a code…'), ladder('搵緊個碼…')),
  'authenticator.add.readOk': entry(
    ladder('Read a version {version} code at error correction level {level}.'),
    ladder('讀到一個第 {version} 版、{level} 級糾錯嘅碼。')
  ),

  /* ---------------- the pairing picture ---------------- */

  'authenticator.pair.title': entry(ladder('Pair your other authenticator'), ladder('同你另一個驗證器配對')),
  'authenticator.pair.qrAlt': entry(
    ladder('Pairing code for {account} at {issuer}. Scan it with an authenticator, or use the written secret beside it.'),
    ladder('{issuer} 嘅 {account} 配對碼。用驗證器掃佢，或者用旁邊寫住嘅密鑰。')
  ),
  'authenticator.pair.drawnHere': entry(
    ladder(
      'This picture is drawn on this computer. It is never sent anywhere, because it contains the secret.',
      'This picture is drawn right here and goes nowhere, because the secret is inside it.',
      'Drawn on this very machine and going absolutely nowhere — the secret is sitting inside those squares.'
    ),
    ladder(
      '呢張圖係喺呢部電腦度畫嘅，唔會傳去任何地方，因為入面有密鑰。',
      '呢張圖喺呢度畫，邊度都唔會去，因為密鑰就喺入面。',
      '喺呢部機度畫，邊度都唔會去 — 密鑰就收埋喺啲格仔入面。'
    )
  ),
  'authenticator.pair.secretLabel': entry(ladder('The same secret, written out'), ladder('同一個密鑰，寫出嚟')),
  'authenticator.pair.showSecret': entry(ladder('Show the secret'), ladder('顯示密鑰')),
  'authenticator.pair.hideSecret': entry(ladder('Hide the secret'), ladder('收埋密鑰')),
  'authenticator.pair.copySecret': entry(ladder('Copy the secret'), ladder('複製密鑰')),
  'authenticator.pair.copyUri': entry(ladder('Copy the pairing link'), ladder('複製配對連結')),
  'authenticator.pair.whyWritten': entry(
    ladder(
      'A picture is no use to somebody who cannot see it, and no use at all when the authenticator being paired is on this same screen. The written secret is always here for both of those.',
      'A picture helps nobody who cannot see it, and helps nobody pairing on this very screen. The written secret covers both.',
      'A picture is no good to somebody who cannot see it, and no good at all if the thing you are pairing is on this very screen. Hence the written version, always.'
    ),
    ladder(
      '睇唔到圖嘅人用唔到張圖，而家部機自己配對亦都用唔到。所以密鑰永遠都寫埋喺度。',
      '睇唔到嘅人用唔到張圖，喺同一個畫面配對又用唔到。所以密鑰一定寫埋。',
      '睇唔到就用唔到張圖，喺同一個螢幕配對更加冇用。所以永遠都寫埋個密鑰。'
    )
  ),
  'authenticator.pair.parameters': entry(
    ladder('Algorithm {algorithm}, {digits} digits, {period} second period.'),
    ladder('演算法 {algorithm}，{digits} 位數，{period} 秒一個週期。')
  ),
  'authenticator.pair.levelUsed': entry(
    ladder('Drawn as a version {version} code at error correction level {level}.'),
    ladder('畫成第 {version} 版、{level} 級糾錯嘅碼。')
  ),

  /* ---------------- confirming the pairing ---------------- */

  'authenticator.confirm.title': entry(ladder('Check one code before this is saved'), ladder('儲之前對一次碼')),
  'authenticator.confirm.body': entry(
    ladder(
      'Type the code your authenticator is showing now. Only a match completes the registration, so a mis-scanned or mistyped secret is caught here rather than the first time you need it.',
      'Type the code your authenticator shows right now. Only a match saves it, so a bad scan is caught here instead of at the worst moment.',
      'Type whatever code your authenticator is showing. Only a match gets saved — better to catch a bad scan now than at the exact moment you are locked out.'
    ),
    ladder(
      '打低你個驗證器而家顯示緊嘅碼。要對得上先會完成登記，咁掃錯或者打錯就而家發現到，唔使等到要用嗰陣。',
      '打低你驗證器而家顯示嘅碼。啱先儲得低，掃錯而家就捉到，唔使等到最緊要嗰陣。',
      '打低你個驗證器而家出緊嘅碼。啱先儲，掃錯而家捉到好過畀你鎖喺門外嗰刻先知。'
    )
  ),
  'authenticator.confirm.field': entry(ladder('Code from your authenticator'), ladder('你驗證器上面嘅碼')),
  'authenticator.confirm.check': entry(ladder('Check the code'), ladder('對一對')),
  'authenticator.confirm.matched': entry(
    ladder('That matched. The entry has been saved.', 'That matched — saved.', 'Bang on. Saved.'),
    ladder('對得上，已經儲低咗。', '對得啱 — 儲咗喇。', '啱晒！儲咗喇。')
  ),
  'authenticator.confirm.mismatch': entry(
    ladder(
      'That code does not match. Nothing has been saved. Check the secret, and check that both clocks agree.',
      'No match, and nothing was saved. Check the secret, and check the two clocks agree.',
      'Not a match, and nothing saved. Either the secret has a typo or the two clocks are having an argument.'
    ),
    ladder(
      '個碼對唔上，乜都未儲。檢查下密鑰，仲有兩邊部機嘅時間啱唔啱。',
      '對唔上，乜都冇儲。睇下密鑰，同埋兩邊時間夾唔夾。',
      '對唔上，冇儲到。要唔係密鑰打錯，要唔係兩邊時鐘嗌緊交。'
    )
  ),
  'authenticator.confirm.skip': entry(
    ladder('I cannot check a code right now — add it anyway'),
    ladder('而家對唔到碼 — 照加落去')
  ),
  'authenticator.confirm.skipExplain': entry(
    ladder(
      'The entry is saved and marked as not checked. If the secret was mistyped, that will only show up when a service refuses the code.',
      'It is saved and marked as not checked. A mistyped secret will only surface when something refuses the code.',
      'Saved, and flagged as not checked. If a character went astray you will meet it later, at the worst possible moment.'
    ),
    ladder(
      '項目會儲低並標記為「未核對」。如果密鑰打錯咗，要等到有服務唔收個碼先會知。',
      '會儲低同標記「未核對」。打錯咗要等到有嘢唔收個碼先知。',
      '儲低，標住「未核對」。如果打漏咗個字，你會喺最唔啱嘅時候先撞到佢。'
    )
  ),
  'authenticator.confirm.generatedRequired': entry(
    ladder(
      'A secret created here has not been paired with anything yet, so a matching code is the only proof the pairing worked. This step cannot be skipped for a new secret.',
      'A secret created here is paired with nothing yet, so a matching code is the only proof it worked. No skipping this one.',
      'This secret is brand new and paired with precisely nothing, so a matching code is the only proof it took. No skipping.'
    ),
    ladder(
      '喺呢度整嘅密鑰重未同任何嘢配對過，所以對得啱個碼係唯一嘅證據。新密鑰唔可以跳過呢步。',
      '呢度整嘅密鑰重未配對過，對啱個碼先算數。新密鑰唔跳得。',
      '呢個密鑰全新，重未同任何嘢配過對，對得啱先算數。呢步唔跳得。'
    )
  ),

  /* ---------------- the clock ---------------- */

  'authenticator.clock.title': entry(ladder('The clock'), ladder('時鐘')),
  'authenticator.clock.ok': entry(
    ladder('The clock was checked and agrees with your other device.'),
    ladder('時鐘核對過，同你另一部機一致。')
  ),
  'authenticator.clock.unchecked': entry(
    ladder(
      'This computer’s clock has never been checked against another device. Codes come from that clock, so if it is wrong every code will be refused with nothing to explain why.',
      'This clock has never been checked against another device. Codes come straight off it, so if it is wrong every code is refused and nothing says why.',
      'Nobody has ever checked this clock against anything. Every code comes off it, so if it is wrong the codes all get refused and nothing tells you why.'
    ),
    ladder(
      '呢部電腦嘅時鐘未同其他裝置核對過。驗證碼係跟住個時鐘計，如果佢唔準，全部碼都會畀人拒絕，而且冇任何提示。',
      '呢個時鐘未同其他裝置對過。個碼跟住佢計，唔準嘅話全部碼都收唔到，仲要冇解釋。',
      '冇人同呢個時鐘對過數。啲碼全部跟住佢計，唔準嘅話個個碼都畀人拒收，仲要唔知點解。'
    )
  ),
  'authenticator.clock.measured': entry(
    ladder(
      'This computer’s clock is {seconds} seconds away from the reference you gave on {when}. Codes will be refused until that is corrected.',
      'This clock sits {seconds} seconds off the reference you gave on {when}. Codes get refused until that is sorted.',
      'This clock is {seconds} seconds adrift from the reference you gave on {when}. Every code gets refused until somebody fixes it.'
    ),
    ladder(
      '呢部電腦嘅時鐘同你喺 {when} 提供嘅參考時間差咗 {seconds} 秒。校正之前，啲碼都會畀人拒絕。',
      '呢個時鐘同你 {when} 畀嘅參考時間差 {seconds} 秒。唔搞掂，啲碼都收唔到。',
      '呢個時鐘同你 {when} 畀嘅參考差咗 {seconds} 秒。唔整返好，個個碼都畀人彈返轉頭。'
    )
  ),
  'authenticator.clock.offsetApplied': entry(
    ladder(
      'Codes are being computed with a manual correction of {seconds} seconds, not this computer’s own clock.',
      'Codes use a manual correction of {seconds} seconds rather than this computer’s clock.',
      'Codes are being worked out with a hand-set correction of {seconds} seconds — this computer’s own clock is not being trusted.'
    ),
    ladder(
      '而家啲碼係用手動校正 {seconds} 秒計，唔係用呢部電腦本身個時鐘。',
      '啲碼用緊手動校正 {seconds} 秒，唔係跟部機個時鐘。',
      '啲碼用手動調嘅 {seconds} 秒計，冇信呢部機自己個時鐘。'
    )
  ),
  'authenticator.clock.drifted': entry(
    ladder(
      'The system clock moved {seconds} seconds relative to the steady clock while this application was open. Waking from sleep looks exactly like this and is harmless; a clock being reset does not.',
      'The system clock jumped {seconds} seconds against the steady clock while this was open. Waking from sleep looks the same and is harmless; a reset clock is not.',
      'The system clock leapt {seconds} seconds sideways while this was open. Waking from sleep looks identical and is nothing to worry about; a clock quietly being reset is another matter.'
    ),
    ladder(
      '呢個程式開住嗰陣，系統時鐘相對穩定時鐘郁咗 {seconds} 秒。瞓醒返嚟都係咁樣，冇問題；但如果係時鐘畀人改咗就有。',
      '開住呢個程式嗰陣，系統時鐘對穩定時鐘跳咗 {seconds} 秒。瞓醒都係咁，冇事；時鐘畀人改就唔同。',
      '開住呢度嗰陣，系統時鐘飛咗 {seconds} 秒。瞓醒返嚟一模一樣，唔使驚；但畀人靜靜雞改咗就另一回事。'
    )
  ),
  'authenticator.clock.implausible': entry(
    ladder(
      'This computer’s clock reads a year that cannot be right, so every code it produces will be refused.',
      'This clock reads a year that cannot be right, so every code will be refused.',
      'This clock thinks it is a year that simply cannot be, so every single code will be refused.'
    ),
    ladder(
      '呢部電腦嘅時鐘顯示嘅年份唔可能啱，所以佢出嘅碼全部都會畀人拒絕。',
      '呢個時鐘個年份唔可能啱，出嘅碼全部都收唔到。',
      '呢個時鐘覺得而家係一個唔可能嘅年份，所以出嘅碼全部畀人彈返。'
    )
  ),
  'authenticator.clock.timezone': entry(
    ladder(
      'Time zones never matter here: the standard counts from the same instant everywhere, so a machine in the wrong zone but at the right instant produces correct codes.',
      'Time zones do not matter here — the standard counts from the same instant everywhere, so the wrong zone at the right instant is fine.',
      'Time zones are innocent here. The standard counts from the same instant everywhere, so the wrong zone at the right instant is perfectly fine.'
    ),
    ladder(
      '時區喺呢度完全唔重要：標準係由全世界同一刻開始數，所以時區錯但時間啱，個碼一樣啱。',
      '時區喺呢度冇關係，標準由同一刻開始數，時區錯但時間啱都冇問題。',
      '時區喺呢度係無辜嘅。標準全世界由同一刻數起，時區錯時間啱一樣冇事。'
    )
  ),
  'authenticator.clock.checkAction': entry(ladder('Check against another device'), ladder('同另一部機對時')),
  'authenticator.clock.reference': entry(ladder('The time your other device shows'), ladder('你另一部機顯示嘅時間')),
  'authenticator.clock.reference.hint': entry(
    ladder('For example 14:05:30, or a full date and time'),
    ladder('例如 14:05:30，或者完整日期時間')
  ),
  'authenticator.clock.record': entry(ladder('Record this reading'), ladder('記低呢個讀數')),
  'authenticator.clock.result': entry(
    ladder('This computer is {seconds} seconds away from that reading.'),
    ladder('呢部電腦同嗰個讀數差咗 {seconds} 秒。')
  ),
  'authenticator.clock.apply': entry(ladder('Correct the codes by {seconds} seconds'), ladder('將啲碼校正 {seconds} 秒')),
  'authenticator.clock.clear': entry(ladder('Remove the correction'), ladder('取消校正')),
  'authenticator.clock.acknowledge': entry(ladder('Understood, stop showing this'), ladder('知道喇，唔使再提')),

  /* ---------------- self test ---------------- */

  'authenticator.checks.title': entry(ladder('Verification'), ladder('驗證測試')),
  'authenticator.checks.intro': entry(
    ladder(
      'These checks run the real code that produces your codes, against the published test vectors. An authenticator that is subtly wrong produces codes every service refuses with no error to read, so this exists to settle the question either way.',
      'These run the real code that makes your codes, against the published vectors. A subtly wrong authenticator gets refused everywhere with no error to read, so this settles it either way.',
      'These put the actual code-making machinery against the published vectors. A subtly wrong authenticator gets refused everywhere and never tells you why, so this settles the argument.'
    ),
    ladder(
      '呢啲測試用嘅係真正計驗證碼嘅程式碼，同公開嘅測試向量對照。驗證器只要有少少錯，出嘅碼就會處處畀人拒絕，而且冇錯誤訊息可睇，所以要有呢個嚟一次過講清楚。',
      '呢啲測試用真正計碼嗰段碼同公開向量對。驗證器差少少就周圍畀人拒絕，仲要冇錯誤訊息，所以要有呢個。',
      '呢度攞真正整碼嗰套嘢同公開向量鬥。錯少少就周圍畀人拒收，仲要唔出聲，所以要有呢個嚟斷症。'
    )
  ),
  'authenticator.checks.run': entry(ladder('Run the checks'), ladder('跑測試')),
  'authenticator.checks.running': entry(
    ladder('Running check {done} of {total}…'),
    ladder('跑緊第 {done} 個測試，總共 {total} 個…')
  ),
  'authenticator.checks.summary': entry(
    ladder('{passed} passed, {failed} failed, in {ms} milliseconds.'),
    ladder('{passed} 個過，{failed} 個唔過，用咗 {ms} 毫秒。')
  ),
  'authenticator.checks.allPassed': entry(
    ladder(
      'Every check passed. The codes this application produces match the published vectors exactly.',
      'All clear. The codes match the published vectors exactly.',
      'All green. The codes match the published vectors to the digit.'
    ),
    ladder(
      '全部測試通過。呢個程式出嘅碼同公開向量完全一致。',
      '全部過晒。啲碼同公開向量一模一樣。',
      '全綠。啲碼同公開向量一個位都冇差。'
    )
  ),
  'authenticator.checks.someFailed': entry(
    ladder(
      '{failed} checks failed. Codes from this build cannot be trusted until that is explained; the exact failure is listed against each check.',
      '{failed} checks failed. Do not trust codes from this build until that is explained; each failure is listed below.',
      '{failed} checks failed, so do not trust a single code from this build until somebody explains why. The exact failures are listed below.'
    ),
    ladder(
      '有 {failed} 個測試唔過。喺解釋清楚之前，唔好信呢個版本出嘅碼；每個測試下面有確實嘅失敗原因。',
      '有 {failed} 個唔過。解釋清楚之前唔好信呢個版本嘅碼；下面有確實原因。',
      '有 {failed} 個仆街咗。未搞清楚之前一個碼都唔好信；下面寫晒係咩事。'
    )
  ),
  'authenticator.checks.never': entry(
    ladder('These have not been run in this session yet.'),
    ladder('今次開機重未跑過。')
  ),
  'authenticator.checks.passed': entry(ladder('Passed'), ladder('過')),
  'authenticator.checks.failed': entry(ladder('Failed'), ladder('唔過')),

  /* ---------------- export ---------------- */

  'authenticator.export': entry(ladder('Export the list…'), ladder('匯出清單…')),
  'authenticator.export.format': entry(ladder('Format'), ladder('格式')),
  'authenticator.export.noSecrets': entry(
    ladder(
      'An ordinary export carries the records and NOT the secrets. Every row says so in its own secret column, so a file cannot be mistaken for a backup that would restore your codes.',
      'An ordinary export carries the records and not the secrets. Every row says so, so nobody mistakes the file for a backup that restores codes.',
      'An ordinary export takes the records and leaves the secrets behind. Every row says so, so nobody mistakes it for a backup that would bring your codes back.'
    ),
    ladder(
      '普通匯出只會帶走記錄，唔會帶走密鑰。每一行喺密鑰欄都會寫明，咁就唔會有人當咗個檔案係可以還原驗證碼嘅備份。',
      '普通匯出只帶記錄，唔帶密鑰。每行都寫明，唔會有人當佢係可以還原嘅備份。',
      '普通匯出淨係帶走記錄，密鑰留低。每行都寫清楚，冇人會當佢係可以攞返啲碼嘅備份。'
    )
  ),
  'authenticator.export.done': entry(
    ladder('Exported {count} entries to {path}'),
    ladder('已將 {count} 個項目匯出去 {path}')
  ),
  'authenticator.exportSecrets': entry(ladder('Export the secrets in the clear…'), ladder('匯出未加密嘅密鑰…')),
  'authenticator.exportSecrets.warning': entry(
    ladder(
      'This writes every secret in readable form. Anybody who opens that file can generate your codes for ever. It is not encrypted, it is not protected, and it cannot be unshared once it leaves this computer.',
      'This writes every secret in readable form. Anyone who opens the file can generate your codes for ever. Not encrypted, not protected, and impossible to unshare once it leaves.',
      'This writes every secret out in plain readable form. Anybody who opens that file can make your codes for ever. No encryption, no protection, and no taking it back once it leaves this computer.'
    ),
    ladder(
      '呢個操作會將全部密鑰用可讀形式寫出嚟。任何人打開個檔案都可以永遠生成你嘅驗證碼。冇加密、冇保護，一旦離開咗呢部電腦就收唔返。',
      '呢個會將全部密鑰用睇得明嘅形式寫出。開到個檔案嘅人可以永遠整到你嘅碼。冇加密冇保護，出咗去就收唔返。',
      '呢個會將全部密鑰白紙黑字寫出嚟。邊個開到個檔案，就可以永世整到你啲碼。冇加密冇保護，出咗門口就攞唔返。'
    )
  ),
  'authenticator.exportSecrets.action': entry(ladder('Write the secrets in the clear'), ladder('寫出未加密嘅密鑰')),
  'authenticator.exportSecrets.irreversible': entry(
    ladder(
      'A file of readable secrets will exist on this computer. Anyone who copies it can generate these codes for ever, and there is no way to withdraw it afterwards.'
    ),
    ladder('呢部電腦會出現一個載住可讀密鑰嘅檔案。任何人複製咗佢就可以永遠生成呢啲碼，而且事後收唔返。')
  ),

  /* ---------------- the ornamental lock ---------------- */

  'authenticator.ownLock.title': entry(
    ladder('One of this application’s own locks is kept here'),
    ladder('呢個程式自己嘅鎖擺咗喺呢度')
  ),
  'authenticator.ownLock.body': entry(
    ladder(
      'That lock is now ornamental: the key is sitting inside the box it opens, so anybody who can reach this list can also open the thing it was locking. That is a perfectly reasonable thing to want, and it stays exactly as you set it.',
      'That lock is ornamental now: the key sits inside the box it opens. Anybody who can reach this list can open what it was locking. Reasonable enough, and it stays as you set it.',
      'That lock is now purely decorative — the key is sitting inside the box it opens. Anybody who reaches this list can open the very thing it was guarding. Which is a fine thing to want, and it stays exactly as you set it.'
    ),
    ladder(
      '嗰個鎖而家淨係得個裝飾：條鎖匙就擺喺佢自己鎖住嗰個箱入面，所以入到嚟呢個清單嘅人，一樣開到佢鎖住嘅嘢。你想咁樣係完全合理嘅，我哋照跟你設定。',
      '嗰個鎖而家係裝飾：鎖匙擺咗喺佢鎖住嗰個箱入面。入到嚟呢度嘅人一樣開到。合理㗎，照跟你設定。',
      '嗰個鎖而家純粹係擺設 — 鎖匙就攤喺佢鎖住嗰個箱入面。入到嚟呢度就開到佢守住嘅嘢。想咁樣都好合理，我哋照跟。'
    )
  ),

  /* ---------------- privacy and storage ---------------- */

  'authenticator.privacy.title': entry(ladder('Where this is kept'), ladder('啲嘢擺喺邊')),
  'authenticator.privacy.body': entry(
    ladder(
      'Records are in this application’s settings file. Secrets are in the operating system’s credential vault, one key per entry, and never in the settings file, an export, a log, a screenshot or a history entry. There is no account, no synchronization and no network request anywhere in this feature.',
      'Records go in the settings file. Secrets go in the operating system credential vault, one key each, and never into the settings file, an export, a log, a screenshot or the history. No account, no sync, no network.',
      'Records live in the settings file; secrets live in the operating system’s credential vault, one key each, and go nowhere near an export, a log, a screenshot or the history. No account, no sync, and not one network request.'
    ),
    ladder(
      '記錄擺喺呢個程式嘅設定檔。密鑰擺喺作業系統嘅憑證保險庫，一個項目一條鎖匙，永遠唔會出現喺設定檔、匯出檔、記錄檔、螢幕截圖或者歷史記錄。呢個功能冇戶口、冇同步、冇任何網絡要求。',
      '記錄喺設定檔，密鑰喺作業系統保險庫，一個項目一條匙，唔會入設定檔、匯出、log、截圖或者歷史。冇戶口冇同步冇網絡。',
      '記錄擺設定檔，密鑰擺作業系統保險庫，一個項目一條匙，唔會走去匯出檔、log、截圖或者歷史。冇戶口、冇同步、一個網絡要求都冇。'
    )
  ),
  'authenticator.privacy.cached': entry(
    ladder('{count} secrets are held in this window’s memory so the codes can tick.'),
    ladder('有 {count} 條密鑰暫時放喺呢個視窗嘅記憶體，個碼先跳得郁。')
  ),
  'authenticator.privacy.forget': entry(ladder('Forget them until they are needed again'), ladder('暫時放低佢哋')),
  'authenticator.privacy.vault': entry(
    ladder('Credential vault: {backend}, {state}.'),
    ladder('憑證保險庫：{backend}，{state}。')
  ),
  'authenticator.privacy.vault.encrypted': entry(ladder('encrypted by the operating system'), ladder('由作業系統加密')),
  'authenticator.privacy.vault.plain': entry(
    ladder('NOT encrypted on this machine — the operating system offered no encryption service'),
    ladder('喺呢部機冇加密 — 作業系統冇提供加密服務')
  ),

  /* ---------------- errors ---------------- */

  'authenticator.error.title': entry(ladder('That did not work'), ladder('唔得')),
  'authenticator.error.clipboardText': entry(
    ladder('Nothing could be read from the clipboard: {reason}'),
    ladder('剪貼簿讀唔到嘢：{reason}')
  ),
  'authenticator.error.clipboardImage': entry(
    ladder('No picture was found on the clipboard.'),
    ladder('剪貼簿冇圖片。')
  ),
  'authenticator.error.tooLarge': entry(
    ladder('That picture is {size} and the limit is {limit}. Crop it and try again.'),
    ladder('張相 {size}，上限係 {limit}。剪細啲再試。')
  ),
  'authenticator.error.duplicate': entry(
    ladder('An entry for {account} at {issuer} already exists. Adding it again would give you two rows that agree, which is harmless but confusing.'),
    ladder('{issuer} 嘅 {account} 已經有一個項目。再加多次會有兩行一樣嘅嘢，冇害但係好亂。')
  ),
  'authenticator.error.addAnyway': entry(ladder('Add a second one anyway'), ladder('照加多個')),

  /* ---------------- settings ---------------- */

  'authenticator.settings.section': entry(ladder('Authenticator'), ladder('驗證器')),
  'authenticator.settings.defaultAlgorithm': entry(ladder('Algorithm for new secrets'), ladder('新密鑰用嘅演算法')),
  'authenticator.settings.defaultAlgorithm.description': entry(
    ladder(
      'Used only when this application creates a secret. A secret arriving from a pairing link keeps whatever that link states. SHA-1 is the shipped value because it is what almost every service issues.',
      'Only used when this application creates a secret; a pairing link keeps whatever it states. SHA-1 ships because it is what nearly every service issues.',
      'Only applies when this application makes a secret itself; a pairing link keeps its own settings. SHA-1 ships because that is what nearly everybody issues.'
    ),
    ladder(
      '淨係喺呢個程式自己整密鑰嗰陣用。由配對連結嚟嘅密鑰會跟返連結寫嘅嘢。出廠用 SHA-1，因為幾乎所有服務都係咁發。',
      '淨係自己整密鑰嗰陣用；配對連結嚟嘅跟返佢自己。出廠 SHA-1，因為個個服務都係咁。',
      '淨係自己整密鑰先用到；配對連結嚟嘅照跟佢自己嗰套。出廠 SHA-1，因為周圍都係咁發。'
    )
  ),
  'authenticator.settings.defaultDigits': entry(ladder('Digits for new secrets'), ladder('新密鑰嘅位數')),
  'authenticator.settings.defaultDigits.description': entry(
    ladder(
      'How many digits a secret created here produces. Six is what nearly every service expects; eight exists and is rarer.',
      'How many digits a secret created here produces. Six is what nearly everybody expects; eight exists and is rare.',
      'How many digits a secret made here spits out. Six is what nearly everybody expects; eight exists and is rare.'
    ),
    ladder(
      '喺呢度整嘅密鑰出幾多位數。六位係幾乎所有服務要求嘅；八位有，但少見。',
      '喺呢度整嘅密鑰出幾多位。六位最通用，八位有但少見。',
      '喺呢度整嘅密鑰出幾多個位。六位通街都係，八位有但罕見。'
    )
  ),
  'authenticator.settings.defaultPeriod': entry(ladder('Period for new secrets'), ladder('新密鑰嘅週期')),
  'authenticator.settings.defaultPeriod.description': entry(
    ladder(
      'How many seconds a code from a secret created here lasts. Thirty is the near-universal value; any period from 5 to 300 seconds is supported for a link that asks for one.',
      'How long a code from a secret created here lasts. Thirty is near-universal; 5 to 300 seconds is supported for a link that asks for it.',
      'How long a code from a secret made here lives. Thirty is near-universal; anything from 5 to 300 seconds is supported when a link asks for it.'
    ),
    ladder(
      '喺呢度整嘅密鑰出嘅碼有效幾多秒。三十秒幾乎係通用值；如果連結指定，5 至 300 秒都支援。',
      '喺呢度整嘅密鑰個碼撐幾耐。三十秒最通用；連結指定嘅話 5 至 300 秒都得。',
      '喺呢度整嘅密鑰個碼命有幾長。三十秒最通用；連結指定嘅話 5 至 300 秒都食得。'
    )
  ),
  'authenticator.settings.hideCodes': entry(ladder('Hide codes until asked for'), ladder('要撳先顯示驗證碼')),
  'authenticator.settings.hideCodes.description': entry(
    ladder(
      'Every code is masked until you reveal it, one row at a time. Useful when a screen is being shared or recorded; the countdown keeps running either way.',
      'Every code stays masked until you reveal it, one row at a time. Handy on a shared screen; the countdown runs either way.',
      'Every code stays behind a mask until you ask, one row at a time. Handy when a screen is being shared; the countdown keeps ticking regardless.'
    ),
    ladder(
      '每個碼都會遮住，要逐行撳先顯示。分享或者錄緊螢幕嗰陣好有用；倒數照樣行。',
      '每個碼遮住，逐行撳先出。分享螢幕嗰陣好用；倒數照行。',
      '每個碼遮實，要逐行撳先肯出。分享螢幕嗰陣啱用；倒數照樣行。'
    )
  ),
  'authenticator.settings.showNext': entry(ladder('Show the next code as well'), ladder('順便顯示下一個碼')),
  'authenticator.settings.showNext.description': entry(
    ladder(
      'A small preview of the code the next period will produce, so nobody starts typing a code with two seconds left on it.',
      'A small preview of the next period’s code, so nobody starts typing one with two seconds left.',
      'A small preview of what comes next, so nobody starts typing a code that has two seconds to live.'
    ),
    ladder(
      '細細個預覽下一個週期會出嘅碼，咁就唔會有人喺得返兩秒嗰陣先開始打。',
      '預覽下一個週期嘅碼，唔會有人得返兩秒先開始打。',
      '預覽下一個碼，咁就唔會有人喺得返兩秒嗰陣先開始打。'
    )
  ),
  'authenticator.settings.qrModuleSize': entry(ladder('Pairing picture size'), ladder('配對圖大細')),
  'authenticator.settings.qrModuleSize.description': entry(
    ladder(
      'Pixels per square in the pairing picture. Larger squares stay scannable on a smaller window or a lower quality camera; the picture is always true black on white rather than themed, because a tinted code stops scanning.',
      'Pixels per square in the pairing picture. Bigger squares survive a smaller window or a poorer camera; the picture is always true black on white, because a tinted code stops scanning.',
      'Pixels per square in the pairing picture. Bigger squares survive a small window and a bad camera; it is always true black on white, because a code tinted to match the theme simply stops scanning.'
    ),
    ladder(
      '配對圖每格幾多像素。格大啲，喺細視窗或者差鏡頭之下都掃得到；張圖永遠係真黑白，唔會跟主題上色，因為上咗色就掃唔到。',
      '配對圖每格幾多像素。格大啲，細視窗或者爛鏡頭都掃到；張圖永遠真黑白，上咗色就掃唔到。',
      '配對圖每格幾多點。格大啲，細視窗爛鏡頭都掃得到；永遠真黑白，跟主題上色就即刻掃唔到。'
    )
  ),
  'authenticator.settings.clockWarn': entry(ladder('Clock difference worth warning about'), ladder('時鐘差幾多先警告')),
  'authenticator.settings.clockWarn.description': entry(
    ladder(
      'How many seconds of difference between this computer and your reference device counts as a problem. Most services accept about thirty seconds either side, so ten is a cautious value.',
      'How many seconds of difference counts as a problem. Most services accept about thirty seconds either side, so ten is cautious.',
      'How far this computer may drift from your reference before it is called a problem. Most services tolerate about thirty seconds either way, so ten is deliberately cautious.'
    ),
    ladder(
      '呢部電腦同你參考裝置差幾多秒先當有問題。大部分服務前後容許大約三十秒，所以十秒係保守嘅設定。',
      '差幾多秒先當有事。大部分服務前後容忍三十秒左右，十秒算保守。',
      '差幾多秒先當佢有事。大部分服務前後畀三十秒左右，所以十秒係特登保守。'
    )
  ),
  'authenticator.settings.clockOffset': entry(ladder('Manual clock correction'), ladder('手動時鐘校正')),
  'authenticator.settings.clockOffset.description': entry(
    ladder(
      'Seconds added to this computer’s clock before a code is computed. Zero means the clock is used as it is. While this is not zero, every code surface says so, because a correction that is silently applied is indistinguishable from a bug.',
      'Seconds added to this computer’s clock before a code is worked out. Zero uses the clock as it is. While it is not zero every code surface says so, because a silent correction is indistinguishable from a fault.',
      'Seconds added to this computer’s clock before a code is worked out. Zero leaves the clock alone. While it is not zero every code surface says so, because a correction applied in silence looks exactly like a fault.'
    ),
    ladder(
      '計驗證碼之前加落呢部電腦時鐘嘅秒數。零即係照用個時鐘。只要唔係零，每個顯示碼嘅位置都會寫明，因為靜靜雞校正同「壞咗」根本分唔開。',
      '計碼之前加落時鐘嘅秒數。零即係照用。唔係零嗰陣每個碼面都會寫明，因為靜靜雞校正同壞咗分唔到。',
      '計碼之前加落個時鐘嘅秒數。零即係唔郁佢。唔係零嗰陣每處都會寫明，因為靜靜雞校正同壞咗根本一模一樣。'
    )
  ),
  'authenticator.settings.selfTest': entry(ladder('Run the verification checks'), ladder('跑驗證測試')),
  'authenticator.settings.selfTest.description': entry(
    ladder(
      'Runs the published RFC 4226 and RFC 6238 test vectors, plus this feature’s own QR encoder and reader, against the real code paths and reports exactly what happened.',
      'Runs the published RFC 4226 and RFC 6238 vectors plus this feature’s QR encoder and reader against the real code paths, and reports exactly what happened.',
      'Throws the published RFC 4226 and RFC 6238 vectors, plus this feature’s own QR encoder and reader, at the real code paths and reports exactly what happened.'
    ),
    ladder(
      '用公開嘅 RFC 4226 同 RFC 6238 測試向量，加埋呢個功能自己嘅 QR 編碼器同讀取器，跑真正嘅程式路徑，然後照實報告結果。',
      '用公開嘅 RFC 4226 同 RFC 6238 向量，加埋自己嘅 QR 編碼同讀取，跑真路徑，照實報告。',
      '攞公開嘅 RFC 4226 同 RFC 6238 向量，連埋自己套 QR 編碼同讀取，掟落真路徑度跑，然後照實報。'
    )
  ),
  'authenticator.settings.exportSecrets.description': entry(
    ladder(
      'Writes every stored secret in readable form to a file you choose. It is behind the two-key confirmation because the file it produces can generate your codes for ever and cannot be withdrawn once copied.',
      'Writes every stored secret in readable form to a file you choose. It sits behind the two-key confirmation because the file can generate your codes for ever and cannot be withdrawn.',
      'Writes every stored secret out in readable form to a file you pick. It sits behind the two-key confirmation because that file can make your codes for ever and cannot be taken back.'
    ),
    ladder(
      '將全部儲低嘅密鑰用可讀形式寫入你揀嘅檔案。要過雙鎖匙確認，因為整出嚟嘅檔案可以永遠生成你嘅碼，而且複製咗就收唔返。',
      '將全部密鑰用可讀形式寫入你揀嘅檔案。要過雙鎖匙確認，因為個檔案可以永遠整到你嘅碼，收唔返。',
      '將全部密鑰白紙黑字寫入你揀嘅檔案。要過雙鎖匙確認，因為嗰個檔案可以永世整到你啲碼，收唔返。'
    )
  ),

  /* ---------------- palette ---------------- */

  'authenticator.palette.open': entry(ladder('Open the authenticator'), ladder('打開驗證器')),
  'authenticator.palette.add': entry(ladder('Add a one-time code account'), ladder('加一個一次性驗證碼戶口')),
  'authenticator.palette.checks': entry(ladder('Verify the authenticator against the published vectors'), ladder('用公開向量驗證呢個驗證器')),
  'authenticator.palette.clock': entry(ladder('Check the clock against another device'), ladder('同另一部機對時')),
  'authenticator.palette.export': entry(ladder('Export the authenticator list'), ladder('匯出驗證器清單')),
  'authenticator.palette.forget': entry(ladder('Forget the secrets held in memory'), ladder('放低記憶體入面嘅密鑰'))
};
