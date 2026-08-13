import type { Catalogue } from '../../core/registry';

/**
 * This feature's own copy, in English and playful Hong Kong Cantonese, at all
 * five humour levels. Humour styles the voice; the facts — which world, which
 * commit, what will leave the machine, what cannot be undone — read the same
 * at every level.
 */
export const WORLD_VAULT_STRINGS: Catalogue = {
  'world-vault.tab': {
    en: ['World vault', 'World vault', 'World vault', 'The world vault', 'The world vault, your world’s time machine'],
    yue: ['世界保險箱', '世界保險箱', '世界保險箱', '個世界保險箱', '個世界保險箱，你個世界嘅時光機']
  },
  'world-vault.tab.subtitle': {
    en: [
      'Version control for a downloaded world.',
      'Version control for a downloaded world.',
      'Every settled change to a downloaded world, kept and undoable.',
      'Your world, snapshotted the moment it stops wobbling.',
      'Your world, snapshotted the moment it stops wobbling, forever undoable.'
    ],
    yue: [
      '為已下載嘅世界做版本控制。',
      '為已下載嘅世界做版本控制。',
      '個世界一穩定落嚟就影低，隨時可以返轉頭。',
      '個世界一停郁就影相，儲埋一齊，隨時後悔隨時番。',
      '個世界一停郁就影相，儲埋一齊，隨時後悔隨時番，冇上限。'
    ]
  },
  'world-vault.search': {
    en: [
      'Search commits',
      'Search commits',
      'Search the commit history',
      'Hunt through the timeline',
      'Hunt through the timeline for that one moment'
    ],
    yue: ['搵返個commit', '搵返個commit', '喺歷史入面搵commit', '喺時間線度篤爆嚟搵', '喺時間線度篤爆嚟搵返嗰一刻']
  },
  'world-vault.picker.label': {
    en: ['World folder', 'World folder', 'World folder', 'Which world?', 'Which world are we time-travelling in?'],
    yue: ['世界資料夾', '世界資料夾', '世界資料夾', '邊個世界？', '我哋而家係邊個世界度時光旅行？']
  },
  'world-vault.picker.description': {
    en: [
      'The downloaded world folder this vault watches and versions. The vault, when created, lives inside it as a real git repository.',
      'The downloaded world folder this vault watches and versions. The vault, when created, lives inside it as a real git repository.',
      'Point this at a downloaded world and everything below tracks that exact folder. Its vault is a real git repository saved inside the folder itself, so it travels along if the folder is copied or moved.',
      'The world this whole tab fusses over. Its vault sets up shop inside the folder itself — a stowaway `.git` that goes wherever the world goes.',
      'The world this whole tab fusses over. Its vault sets up shop inside the folder itself — a stowaway `.git` that goes wherever the world goes, quietly, forever.'
    ],
    yue: [
      '呢個保險箱監察同版本化嘅已下載世界資料夾。一旦建立，保險箱就係一個放喺入面嘅真git repository。',
      '呢個保險箱監察同版本化嘅已下載世界資料夾。一旦建立，保險箱就係一個放喺入面嘅真git repository。',
      '指去一個已下載嘅世界，下面所有嘢就跟實嗰個資料夾。佢嘅保險箱係真係放喺資料夾入面嘅git repository，資料夾搬去邊佢就跟去邊。',
      '呢頁成日搞緊嘅嗰個世界。佢嘅保險箱就喺資料夾入面開檔 — 一個匿咗嘅`.git`，資料夾去邊佢跟去邊。',
      '呢頁成日搞緊嘅嗰個世界。佢嘅保險箱就喺資料夾入面開檔 — 一個匿咗嘅`.git`，資料夾去邊佢就靜靜雞跟去邊，永遠咁跟。'
    ]
  },
  'world-vault.picker.empty.title': {
    en: ['Choose a world', 'Choose a world', 'Choose a world folder', 'Pick a world to fuss over', 'Pick a world to fuss over'],
    yue: ['揀個世界', '揀個世界', '揀個世界資料夾', '揀個世界嚟搞', '揀個世界嚟搞']
  },
  'world-vault.picker.empty.body': {
    en: [
      'Select a downloaded world folder above to create or manage its vault.',
      'Select a downloaded world folder above to create or manage its vault.',
      'Select a downloaded world folder above, then create or manage its vault from here.',
      'Point the folder field above at a world and this whole tab wakes up.',
      'Point the folder field above at a world and this whole tab wakes up — no world, no fuss.'
    ],
    yue: [
      '喺上面揀一個已下載嘅世界資料夾，先可以建立或者管理佢嘅保險箱。',
      '喺上面揀一個已下載嘅世界資料夾，先可以建立或者管理佢嘅保險箱。',
      '喺上面揀一個已下載嘅世界資料夾，跟住就可以喺呢度建立或者管理佢嘅保險箱。',
      '上面個資料夾欄指去個世界，成頁就醒喇。',
      '上面個資料夾欄指去個世界，成頁就醒喇 — 冇世界，冇得搞。'
    ]
  },
  'world-vault.status.heading': {
    en: ['Vault status', 'Vault status', 'Vault status', 'What the vault is up to', 'What the vault is up to right now'],
    yue: ['保險箱狀態', '保險箱狀態', '保險箱狀態', '保險箱而家做緊乜', '保險箱而家做緊乜嘢']
  },
  'world-vault.status.notCreated': {
    en: [
      'No vault exists for this folder yet.',
      'No vault exists for this folder yet.',
      'No vault exists for this world yet.',
      'Nothing here yet — this world has no vault.',
      'Nothing here yet — this world has no vault, and no history to lose.'
    ],
    yue: [
      '呢個資料夾仲未建立保險箱。',
      '呢個資料夾仲未建立保險箱。',
      '呢個世界仲未有保險箱。',
      '未有嘢喎 — 呢個世界冇保險箱。',
      '未有嘢喎 — 呢個世界冇保險箱，都冇歷史可以整唔見。'
    ]
  },
  'world-vault.status.create': {
    en: ['Create the vault', 'Create the vault', 'Create the vault', 'Start keeping history', 'Start keeping history, right now'],
    yue: ['建立保險箱', '建立保險箱', '建立保險箱', '開始留低歷史', '即刻開始留低歷史']
  },
  'world-vault.status.createFailed': {
    en: [
      'The vault could not be created: {reason}',
      'The vault could not be created: {reason}',
      'The vault could not be created: {reason}',
      'That did not take: {reason}',
      'That did not take: {reason}. Not our finest moment.'
    ],
    yue: [
      '保險箱建立唔到：{reason}',
      '保險箱建立唔到：{reason}',
      '保險箱建立唔到：{reason}',
      '搞唔掂喎：{reason}',
      '搞唔掂喎：{reason}。今次唔係我哋叻嘅一刻。'
    ]
  },
  'world-vault.status.branch': {
    en: ['Branch: {branch}', 'Branch: {branch}', 'Branch: {branch}', 'Branch: {branch}', 'Riding on branch {branch}'],
    yue: ['分支：{branch}', '分支：{branch}', '分支：{branch}', '分支：{branch}', '揸緊分支{branch}']
  },
  'world-vault.status.commitCount': {
    en: [
      '{count} commits',
      '{count} commits',
      '{count} commits so far',
      '{count} commits and counting',
      '{count} commits and counting — not bad for a folder full of rocks'
    ],
    yue: [
      '{count}個commit', '{count}個commit', '目前有{count}個commit', '{count}個commit，仲加緊', '{count}個commit，仲加緊，一個裝滿石頭嘅資料夾都幾勤力'
    ]
  },
  'world-vault.status.lastCommit': {
    en: [
      'Last commit: {subject} · {when}',
      'Last commit: {subject} · {when}',
      'Last commit: {subject} · {when}',
      'Last snapshot: {subject} · {when}',
      'Last snapshot: {subject} · {when}, freshly minted'
    ],
    yue: [
      '最後commit：{subject}·{when}', '最後commit：{subject}·{when}', '最後commit：{subject}·{when}', '最新影相：{subject}·{when}', '最新影相：{subject}·{when}，啱啱出爐'
    ]
  },
  'world-vault.status.noCommit': {
    en: ['No commits yet.', 'No commits yet.', 'No commits recorded yet.', 'Nothing captured yet.', 'Nothing captured yet — give it a moment.'],
    yue: ['未有commit。', '未有commit。', '未記錄過commit。', '仲未影過相。', '仲未影過相 — 俾多陣。']
  },
  'world-vault.status.size': {
    en: [
      'History: {gitSize} · World: {worldSize}',
      'History: {gitSize} · World: {worldSize}',
      'History takes {gitSize} on disk; the world itself is {worldSize}.',
      'History is eating {gitSize}; the world weighs {worldSize}.',
      'History is eating {gitSize} of your disk; the world itself weighs {worldSize}. Watch that number.'
    ],
    yue: [
      '歷史：{gitSize}·世界：{worldSize}',
      '歷史：{gitSize}·世界：{worldSize}',
      '歷史喺硬碟度佔咗{gitSize}；個世界本身係{worldSize}。',
      '歷史食緊{gitSize}；個世界本身重{worldSize}。',
      '歷史食緊{gitSize}你嘅硬碟；個世界本身重{worldSize}。個數要睇實佢。'
    ]
  },
  'world-vault.status.degraded': {
    en: [
      'The vault is degraded: {reason}',
      'The vault is degraded: {reason}',
      'The vault is degraded: {reason}',
      'Something is off: {reason}',
      'Something is off with the vault: {reason}'
    ],
    yue: ['保險箱有啲失靈：{reason}', '保險箱有啲失靈：{reason}', '保險箱有啲失靈：{reason}', '有啲唔對路：{reason}', '保險箱有啲唔對路：{reason}']
  },
  'world-vault.status.waiting': {
    en: [
      'Waiting for writes to settle — last activity {seconds} ago.',
      'Waiting for writes to settle — last activity {seconds} ago.',
      'Waiting for writes to settle before committing — last activity {seconds} ago.',
      'Files are still wobbling — last write {seconds} ago.',
      'Files are still wobbling — last write {seconds} ago. No snapshot until they stop.'
    ],
    yue: [
      '等緊啲寫入嘢靜落嚟 — 最後動作係{seconds}前。',
      '等緊啲寫入嘢靜落嚟 — 最後動作係{seconds}前。',
      '喺commit之前，等緊啲寫入嘢靜落嚟 — 最後動作係{seconds}前。',
      '啲檔案仲喺度郁緊 — 最後寫入係{seconds}前。',
      '啲檔案仲喺度郁緊 — 最後寫入係{seconds}前。未停之前唔會影相。'
    ]
  },
  'world-vault.status.idle': {
    en: ['Nothing pending. Everything settled is committed.', 'Nothing pending. Everything settled is committed.', 'Nothing pending — everything that has settled is already committed.', 'All quiet. Everything settled is already saved.', 'All quiet on the region front. Everything settled is already saved.'],
    yue: ['冇嘢等緊。啲穩定咗嘅都commit咗。', '冇嘢等緊。啲穩定咗嘅都commit咗。', '冇嘢等緊 — 啲穩定咗嘅都已經commit咗。', '靜晒。穩定咗嘅嘢都已經存低咗。', 'region戰線一片寧靜。穩定咗嘅嘢都已經存低咗。']
  },
  'world-vault.status.startRunner': {
    en: ['Start watching', 'Start watching', 'Start watching this world', 'Start keeping watch', 'Start keeping watch over this world'],
    yue: ['開始監察', '開始監察', '開始監察呢個世界', '開始睇實佢', '開始睇實呢個世界']
  },
  'world-vault.status.stopRunner': {
    en: ['Stop watching', 'Stop watching', 'Stop watching this world', 'Stop keeping watch', 'Stop keeping watch — for now'],
    yue: ['停止監察', '停止監察', '停止監察呢個世界', '唔睇住佢喇', '暫時唔睇住呢個世界喇']
  },
  'world-vault.status.commitNow': {
    en: ['Commit now', 'Commit now', 'Commit the current state now', 'Snapshot it now', 'Snapshot it right this second'],
    yue: ['即刻commit', '即刻commit', '即刻commit目前狀態', '即刻影相', '即刻即刻影多張相']
  },
  'world-vault.status.commitNowNothing': {
    en: ['Nothing has changed since the last commit.', 'Nothing has changed since the last commit.', 'Nothing has changed since the last commit, so nothing was recorded.', 'Not a byte moved since last time.', 'Not a byte moved since last time — nothing to snapshot.'],
    yue: ['自上次commit之後冇嘢改變過。', '自上次commit之後冇嘢改變過。', '自上次commit之後冇嘢改變過，所以冇嘢記錄。', '自上次之後一粒byte都冇郁過。', '自上次之後一粒byte都冇郁過 — 冇嘢可以影。']
  },
  'world-vault.status.commitNowDone': {
    en: ['{count} changed files were committed.', '{count} changed files were committed.', '{count} changed files were committed as {hash}.', '{count} files, safely tucked away as {hash}.', '{count} files, safely tucked away as {hash}. Sleep easy.'],
    yue: ['已commit{count}個改咗嘅檔案。', '已commit{count}個改咗嘅檔案。', '已將{count}個改咗嘅檔案commit做{hash}。', '{count}個檔案，安全咁收埋做{hash}。', '{count}個檔案，安全咁收埋做{hash}。今晚瞓得安樂。']
  },
  'world-vault.status.gc': {
    en: ['Compact history', 'Compact history', 'Compact history on disk', 'Tidy up the history', 'Tidy up the history — no commit is ever lost by this'],
    yue: ['壓縮歷史', '壓縮歷史', '壓縮硬碟入面嘅歷史', '執一執啲歷史', '執一執啲歷史 — 呢個動作絕對唔會整少個commit']
  },
  'world-vault.status.gcDone': {
    en: ['History now takes {size} on disk.', 'History now takes {size} on disk.', 'Compaction finished. History now takes {size} on disk.', 'All tidy. History now takes {size}.', 'All tidy. History now takes {size} — every commit still intact.'],
    yue: ['歷史而家喺硬碟度佔{size}。', '歷史而家喺硬碟度佔{size}。', '壓縮完成。歷史而家喺硬碟度佔{size}。', '執好晒。歷史而家佔{size}。', '執好晒。歷史而家佔{size} — 每個commit都仲喺度。']
  },
  'world-vault.status.retentionNote': {
    en: [
      'History grows with every commit. This is not Git LFS — use Compact history to reclaim space, or Prune to permanently collapse old detail before a chosen commit.',
      'History grows with every commit. This is not Git LFS — use Compact history to reclaim space, or Prune to permanently collapse old detail before a chosen commit.',
      'History grows with every commit, and region files are large binaries that repeat across many commits. Compact history reclaims space safely; Prune permanently collapses everything before a chosen commit into one snapshot.',
      'Every commit costs disk. Compact history squeezes it down safely; Prune throws away the fine-grained past before a point you choose, on purpose, for good.',
      'Every commit costs disk, and region files are chunky. Compact history squeezes it down safely; Prune throws away the fine-grained past before a point you choose, on purpose, for good — read the warning before you touch that one.'
    ],
    yue: [
      '歷史會隨住每個commit增長。呢個唔係Git LFS — 用「壓縮歷史」嚟慳返啲空間，或者用「修剪」永久噉將舊嘅細節喺揀定嘅commit之前收埋。',
      '歷史會隨住每個commit增長。呢個唔係Git LFS — 用「壓縮歷史」嚟慳返啲空間，或者用「修剪」永久噉將舊嘅細節喺揀定嘅commit之前收埋。',
      '歷史會隨住每個commit增長，region檔案又大又係binary，重重覆覆出現喺唔同commit入面。「壓縮歷史」安全咁慳返空間；「修剪」就永久噉將揀定commit之前嘅所有細節壓做一個。',
      '每個commit都食硬碟。「壓縮歷史」安全咁擠壓返細；「修剪」就係特登永久噉丟低你揀嘅一點之前嘅細節。',
      '每個commit都食硬碟，region檔案仲肥。「壓縮歷史」安全咁擠壓返細；「修剪」就係特登永久噉丟低你揀嘅一點之前嘅細節 — 撳之前記得睇清楚個警告。'
    ]
  },
  'world-vault.status.gitMissing': {
    en: [
      'git was not found on this machine. Install Git for Windows to use the vault.',
      'git was not found on this machine. Install Git for Windows to use the vault.',
      'git was not found on this machine, so the vault cannot be created or read. Install Git for Windows and try again.',
      'No git, no vault. Install Git for Windows first.',
      'No git, no vault — sorry. Install Git for Windows first, then come back.'
    ],
    yue: [
      '呢部機搵唔到git。要用保險箱請先裝Git for Windows。',
      '呢部機搵唔到git。要用保險箱請先裝Git for Windows。',
      '呢部機搵唔到git，所以保險箱建立唔到都讀唔到。裝返Git for Windows再試多次。',
      '冇git就冇保險箱。先裝返Git for Windows。',
      '冇git就冇保險箱，唔好意思。先裝返Git for Windows，再返嚟搵我。'
    ]
  },
  'world-vault.status.openFolder': {
    en: ['Open in File Explorer', 'Open in File Explorer', 'Open the world folder', 'Peek at the folder', 'Peek at the folder yourself'],
    yue: ['喺檔案總管開啟', '喺檔案總管開啟', '打開世界資料夾', '望一望個資料夾', '自己去望一望個資料夾']
  },
  'world-vault.settings.title': {
    en: ['World vault', 'World vault', 'World vault', 'World vault', 'The world vault'],
    yue: ['世界保險箱', '世界保險箱', '世界保險箱', '世界保險箱', '個世界保險箱']
  },
  'world-vault.settings.worldPath.label': {
    en: ['World folder', 'World folder', 'World folder', 'Which world?', 'Which world are we fussing over?'],
    yue: ['世界資料夾', '世界資料夾', '世界資料夾', '邊個世界？', '我哋而家搞緊邊個世界？']
  },
  'world-vault.settings.worldPath.description': {
    en: [
      'The downloaded world folder the vault tab watches and versions.',
      'The downloaded world folder the vault tab watches and versions.',
      'The downloaded world folder the vault tab watches and versions. Its vault, once created, lives inside this folder.',
      'The world the whole vault tab is currently fussing over.',
      'The world the whole vault tab is currently fussing over, wherever it happens to sit on disk.'
    ],
    yue: [
      '保險箱分頁監察同版本化嘅已下載世界資料夾。',
      '保險箱分頁監察同版本化嘅已下載世界資料夾。',
      '保險箱分頁監察同版本化嘅已下載世界資料夾。一旦建立，保險箱就住喺呢個資料夾入面。',
      '成個保險箱分頁而家搞緊嘅嗰個世界。',
      '成個保險箱分頁而家搞緊嘅嗰個世界，唔理佢擺喺硬碟邊個角落。'
    ]
  },
  'world-vault.settings.quietPeriod.label': {
    en: ['Quiet period', 'Quiet period', 'Settle quiet period', 'How long to hold still', 'How long the world has to hold still'],
    yue: ['靜默期', '靜默期', '穩定靜默期', '要靜幾耐', '個世界要靜返幾耐']
  },
  'world-vault.settings.quietPeriod.description': {
    en: [
      'Milliseconds of no writes to a file before it is considered settled and safe to commit. Too short risks capturing a region file mid-write.',
      'Milliseconds of no writes to a file before it is considered settled and safe to commit. Too short risks capturing a region file mid-write.',
      'How many milliseconds a file must go untouched before the background runner treats it as settled and includes it in a commit. Set it too short and a region file can be captured half-written.',
      'How long a file has to sit still before it counts as done. Too short and you risk snapshotting a region file mid-write — which is a corrupt chunk.',
      'How long a file has to sit still before it counts as done. Too short and you risk snapshotting a region file mid-write — which is a corrupt chunk, and nobody wants that.'
    ],
    yue: [
      '一個檔案要幾多毫秒冇被寫入，先當佢穩定咗、可以安全commit。太短會有風險影到寫緊嘅region檔案。',
      '一個檔案要幾多毫秒冇被寫入，先當佢穩定咗、可以安全commit。太短會有風險影到寫緊嘅region檔案。',
      '一個檔案要幾多毫秒冇被郁過，背景runner先會當佢穩定咗，攞去commit。設得太短，region檔案有機會俾影到一半寫緊。',
      '一個檔案要坐定幾耐先算穩。太短就有機會影到region檔案寫到一半 — 咁樣個chunk就爛咗。',
      '一個檔案要坐定幾耐先算穩。太短就有機會影到region檔案寫到一半 — 咁樣個chunk就爛咗，冇人想咁。'
    ]
  },
  'world-vault.settings.pollInterval.label': {
    en: ['Check interval', 'Check interval', 'Watch check interval', 'How often to look', 'How often the runner peeks'],
    yue: ['檢查間隔', '檢查間隔', '監察檢查間隔', '幾耐睇一次', 'runner幾耐望一次']
  },
  'world-vault.settings.pollInterval.description': {
    en: [
      'Milliseconds between two checks of the world folder for changes.',
      'Milliseconds between two checks of the world folder for changes.',
      'How many milliseconds pass between the runner checking the world folder for changes. Shorter finds activity sooner but costs more disk reads.',
      'How often the runner looks for anything new. Faster notices sooner, at the cost of more looking.',
      'How often the runner peeks at the folder for anything new. Faster notices sooner, at the cost of doing a lot more peeking.'
    ],
    yue: [
      '每兩次檢查世界資料夾有冇改變之間相隔幾多毫秒。',
      '每兩次檢查世界資料夾有冇改變之間相隔幾多毫秒。',
      'runner兩次檢查世界資料夾有冇改變之間，相隔幾多毫秒。愈短愈快發現有動作，但要多讀硬碟。',
      'runner幾耐望一次有冇新嘢。快啲望就快啲發現，不過要望多好多次。',
      'runner幾耐窺一次個資料夾有冇新嘢。快啲窺就快啲發現，不過要窺多好多次。'
    ]
  },
  'world-vault.settings.autoStart.label': {
    en: ['Watch automatically', 'Watch automatically', 'Start watching automatically', 'Auto-watch new vaults', 'Auto-watch a fresh vault the moment it exists'],
    yue: ['自動監察', '自動監察', '自動開始監察', '自動監察新保險箱', '一有新保險箱就自動監察']
  },
  'world-vault.settings.autoStart.description': {
    en: [
      'When on, the background runner starts as soon as a vault is created or this tab is opened with an existing vault, instead of needing Start watching pressed by hand.',
      'When on, the background runner starts as soon as a vault is created or this tab is opened with an existing vault, instead of needing Start watching pressed by hand.',
      'When on, creating a vault or opening this tab with an existing vault starts the background runner immediately, rather than leaving it off until Start watching is pressed by hand.',
      'On, and the runner wakes up on its own the moment there is a vault to watch. Off, and you press Start watching yourself.',
      'On, and the runner wakes up on its own the moment there is a vault to watch — no button-pressing required. Off, and you press Start watching yourself, every single time.'
    ],
    yue: [
      '開咗嘅時候，一建立保險箱或者打開一個已有保險箱嘅分頁，背景runner就即刻開始，唔使自己撳「開始監察」。',
      '開咗嘅時候，一建立保險箱或者打開一個已有保險箱嘅分頁，背景runner就即刻開始，唔使自己撳「開始監察」。',
      '開咗嘅時候，建立保險箱或者打開一個已有保險箱嘅分頁，背景runner就即刻開始運行，唔會等你自己撳「開始監察」。',
      '開咗，一有保險箱可以監察，runner就自己醒。閂咗就要自己撳「開始監察」。',
      '開咗，一有保險箱可以監察，runner就自己醒 — 唔使撳掣。閂咗就每次都要自己撳「開始監察」，好煩㗎。'
    ]
  },
  'world-vault.settings.publishVisibility.label': {
    en: ['Default publish visibility', 'Default publish visibility', 'Default new-repository visibility', 'Default visibility for a new repo', 'Default visibility for a shiny new repo'],
    yue: ['發佈預設可見度', '發佈預設可見度', '新repository預設可見度', '新repo預設可見度', '閃令令新repo嘅預設可見度']
  },
  'world-vault.settings.publishVisibility.description': {
    en: [
      'The visibility pre-selected when creating a new GitHub repository from this vault. Private is the safer default because a world may hold other players’ builds.',
      'The visibility pre-selected when creating a new GitHub repository from this vault. Private is the safer default because a world may hold other players’ builds.',
      'Which visibility is pre-selected when using Create a GitHub repository. Still changed by hand before every publish; a world can hold other players’ builds, so private is the safer starting point.',
      'Which box is ticked by default when a new repo gets made. Private, because somebody else’s base does not belong on the public internet by accident.',
      'Which box is ticked by default when a new repo gets made. Private, because somebody else’s base does not belong on the public internet by accident — you still choose every time.'
    ],
    yue: [
      '用呢個保險箱建立新GitHub repository時，預先揀定嘅可見度。因為世界可能有其他玩家嘅建築，所以「私人」係比較安全嘅預設。',
      '用呢個保險箱建立新GitHub repository時，預先揀定嘅可見度。因為世界可能有其他玩家嘅建築，所以「私人」係比較安全嘅預設。',
      '用「建立GitHub repository」嗰陣預先揀定嘅可見度。每次發佈前你都可以自己改；因為世界可能有其他玩家嘅建築，所以「私人」係比較安全嘅起點。',
      '整新repo嗰陣，預設揀邊個掣。私人啦，因為人哋間base唔應該咁大意就公開晒俾成個網睇到。',
      '整新repo嗰陣，預設揀邊個掣。私人啦，因為人哋間base唔應該咁大意就公開晒俾成個網睇到 — 你每次都仲可以自己揀過。'
    ]
  },
  'world-vault.timeline.heading': {
    en: ['Timeline', 'Timeline', 'Commit timeline', 'The timeline', 'The timeline, every moment you can go back to'],
    yue: ['時間線', '時間線', 'commit時間線', '個時間線', '個時間線，每一刻都可以返轉頭']
  },
  'world-vault.timeline.empty.title': {
    en: ['No commits yet', 'No commits yet', 'No commits yet', 'Nothing here yet', 'Nothing here yet — give the world a moment'],
    yue: ['未有commit', '未有commit', '未有commit', '未有嘢喺度', '未有嘢喺度 — 俾個世界啲時間']
  },
  'world-vault.timeline.empty.body': {
    en: [
      'Create the vault or start watching to begin recording commits.',
      'Create the vault or start watching to begin recording commits.',
      'Create the vault, or start watching if it already exists, to begin recording commits.',
      'Create the vault, or hit Start watching, and this fills in on its own.',
      'Create the vault, or hit Start watching, and this fills in on its own — no waiting required after that.'
    ],
    yue: [
      '建立保險箱或者開始監察，先開始記錄commit。',
      '建立保險箱或者開始監察，先開始記錄commit。',
      '建立保險箱，或者如果已經有就開始監察，先開始記錄commit。',
      '建立保險箱，或者撳「開始監察」，呢度就會自動填返滿。',
      '建立保險箱，或者撳「開始監察」，呢度就會自動填返滿 — 之後乜都唔使做。'
    ]
  },
  'world-vault.timeline.column.date': { en: ['When', 'When', 'When', 'When', 'When it happened'], yue: ['幾時', '幾時', '幾時', '幾時', '發生喺幾時'] },
  'world-vault.timeline.column.subject': { en: ['Commit', 'Commit', 'Commit', 'Commit', 'What happened'], yue: ['Commit', 'Commit', 'Commit', 'Commit', '發生咗乜'] },
  'world-vault.timeline.column.kind': { en: ['Kind', 'Kind', 'Kind', 'Kind', 'Flavour'], yue: ['種類', '種類', '種類', '種類', '口味'] },
  'world-vault.timeline.column.files': { en: ['Files', 'Files', 'Files changed', 'Files', 'Files touched'], yue: ['檔案', '檔案', '改咗嘅檔案', '檔案', '摸過嘅檔案'] },
  'world-vault.timeline.column.bytes': { en: ['Bytes', 'Bytes', 'Bytes changed', 'Bytes', 'Bytes shuffled'], yue: ['位元組', '位元組', '改咗嘅位元組', '位元組', '搬咗嘅位元組'] },
  'world-vault.timeline.kind.snapshot': { en: ['Snapshot', 'Snapshot', 'Settled snapshot', 'Snapshot', 'Auto-snapshot'], yue: ['快照', '快照', '穩定快照', '快照', '自動快照'] },
  'world-vault.timeline.kind.restore': { en: ['Restore', 'Restore', 'Restore', 'Rewind', 'Time-travel'], yue: ['還原', '還原', '還原', '返轉頭', '時光倒流'] },
  'world-vault.timeline.kind.edit': { en: ['Edit', 'Edit', 'Chunk edit', 'Chunk edit', 'A chunk got fiddled with'], yue: ['編輯', '編輯', 'chunk編輯', 'chunk編輯', '有個chunk俾人搞過'] },
  'world-vault.timeline.kind.prune': { en: ['Prune', 'Prune', 'History prune', 'Squash', 'History diet'], yue: ['修剪', '修剪', '歷史修剪', '壓縮', '歷史減肥'] },
  'world-vault.bulk.selected': {
    en: ['{count} selected', '{count} selected', '{count} commits selected', '{count} picked', '{count} picked and ready'],
    yue: ['已揀{count}個', '已揀{count}個', '揀咗{count}個commit', '揀咗{count}個', '揀咗{count}個，就緒']
  },
  'world-vault.bulk.selectPage': {
    en: ['Select the {count} shown', 'Select the {count} shown', 'Select the {count} commits shown', 'Select these {count}', 'Select these {count} on screen'],
    yue: ['揀晒眼前呢{count}個', '揀晒眼前呢{count}個', '揀晒眼前呢{count}個commit', '揀晒呢{count}個', '揀晒眼前呢{count}個']
  },
  'world-vault.bulk.selectAll': {
    en: ['Select all {count} matching', 'Select all {count} matching', 'Select all {count} matching commits', 'Select all {count} matches', 'Select every last one of the {count} matches'],
    yue: ['揀晒符合條件嘅{count}個', '揀晒符合條件嘅{count}個', '揀晒符合條件嘅{count}個commit', '揀晒{count}個符合嘅', '揀晒符合條件嘅{count}個，一個都唔留']
  },
  'world-vault.bulk.invert': { en: ['Invert selection', 'Invert selection', 'Invert the selection', 'Flip the selection', 'Flip it inside out'], yue: ['反選', '反選', '反轉揀選', '反轉揀嘅', '成個反晒轉'] },
  'world-vault.bulk.clear': { en: ['Clear selection', 'Clear selection', 'Clear the selection', 'Deselect all', 'Wipe the slate'], yue: ['清除揀選', '清除揀選', '清除揀選', '全部取消揀選', '清晒佢']  },
  'world-vault.bulk.export': { en: ['Export', 'Export', 'Export the selection', 'Export it', 'Export it out into the world'], yue: ['匯出', '匯出', '匯出揀咗嘅', '匯出佢', '匯出去大世界'] },
  'world-vault.row.actions': { en: ['Commit actions', 'Commit actions', 'Commit actions', 'What to do with it', 'What to do with this commit'], yue: ['Commit動作', 'Commit動作', 'Commit動作', '想點搞佢', '想點搞呢個commit'] },
  'world-vault.row.restore': { en: ['Restore to this commit', 'Restore to this commit', 'Restore the world to this commit', 'Rewind to here', 'Rewind the whole world to here'], yue: ['還原去呢個commit', '還原去呢個commit', '將個世界還原去呢個commit', '返去呢個位', '將成個世界返去呢個位'] },
  'world-vault.row.pruneBefore': { en: ['Prune history before this commit', 'Prune history before this commit', 'Prune history before this commit', 'Squash everything before here', 'Squash everything older than this into one'], yue: ['修剪呢個commit之前嘅歷史', '修剪呢個commit之前嘅歷史', '修剪呢個commit之前嘅歷史', '將之前所有壓做一舊', '將呢個之前嘅嘢全部壓做一舊'] },
  'world-vault.row.copyHash': { en: ['Copy commit hash', 'Copy commit hash', 'Copy the commit hash', 'Copy the hash', 'Copy that hash to the clipboard'], yue: ['複製commit哈希', '複製commit哈希', '複製個commit哈希', '複製個hash', '複製個hash落clipboard'] },
  'world-vault.row.copied': { en: ['{hash} copied to the clipboard.', '{hash} copied to the clipboard.', '{hash} was copied to the clipboard.', '{hash}, snagged.', '{hash}, snagged straight off the clipboard.'], yue: ['{hash}已複製落clipboard。', '{hash}已複製落clipboard。', '{hash}已經複製落clipboard。', '{hash}，搶到手。', '{hash}，直接搶落clipboard。'] },
  'world-vault.restore.confirmAction': {
    en: [
      'Restore the world to commit {hash}',
      'Restore the world to commit {hash}',
      'Restore the world to commit {hash}',
      'Rewind the world to {hash}',
      'Rewind the whole world back to {hash}'
    ],
    yue: ['將個世界還原去commit{hash}', '將個世界還原去commit{hash}', '將個世界還原去commit{hash}', '將個世界撥返去{hash}', '將成個世界撥返去{hash}']
  },
  'world-vault.restore.irreversible': {
    en: [
      'Every file on disk in {path} is overwritten to match {hash}. This is recorded as a new commit, so the current state is not lost and this restore can itself be undone.',
      'Every file on disk in {path} is overwritten to match {hash}. This is recorded as a new commit, so the current state is not lost and this restore can itself be undone.',
      'Every file on disk in {path} is overwritten to match {hash}. The state being replaced is committed first if it was not already, and the restore itself is a new commit — so this can be undone, and that undo undone in turn.',
      'Every file in {path} gets rewritten to look exactly like {hash}. Nothing is thrown away: the current state is captured first, and this rewind is itself a commit you can rewind from.',
      'Every file in {path} gets rewritten to look exactly like {hash}. Nothing is thrown away: the current state is captured first, and this rewind is itself a commit you can rewind from — undo goes forever, in both directions.'
    ],
    yue: [
      '{path}入面每一個檔案都會被覆蓋去符合{hash}。呢個動作會記錄做一個新commit，所以目前狀態唔會冇咗，呢次還原本身都可以還原返轉頭。',
      '{path}入面每一個檔案都會被覆蓋去符合{hash}。呢個動作會記錄做一個新commit，所以目前狀態唔會冇咗，呢次還原本身都可以還原返轉頭。',
      '{path}入面每一個檔案都會被覆蓋去符合{hash}。目前狀態如果未commit會先自動commit，然後呢次還原本身又係一個新commit — 所以呢個動作可以undo，嗰個undo都可以再undo。',
      '{path}入面每一個檔案都會改到同{hash}一模一樣。乜都唔會冇咗：目前狀態會先影低，而呢次撥返轉頭本身又係一個commit，可以再撥返轉頭。',
      '{path}入面每一個檔案都會改到同{hash}一模一樣。乜都唔會冇咗：目前狀態會先影低，而呢次撥返轉頭本身又係一個commit，可以再撥返轉頭 — undo兩邊都冇上限。'
    ]
  },
  'world-vault.restore.done': {
    en: ['Restored to {hash}.', 'Restored to {hash}.', 'The world was restored to {hash}.', 'Back to {hash}. Done.', 'Back to {hash}. Time travel: successful.'],
    yue: ['已還原去{hash}。', '已還原去{hash}。', '個世界已經還原去{hash}。', '返咗去{hash}。搞掂。', '返咗去{hash}。時光旅行：成功。']
  },
  'world-vault.restore.failed': {
    en: ['The restore failed: {reason}', 'The restore failed: {reason}', 'The restore failed and nothing was changed: {reason}', 'That did not go through: {reason}', 'That did not go through, nothing touched: {reason}'],
    yue: ['還原失敗：{reason}', '還原失敗：{reason}', '還原失敗，冇改過任何嘢：{reason}', '搞唔掂：{reason}', '搞唔掂，乜都冇郁過：{reason}']
  },
  'world-vault.restore.needOne': {
    en: ['Select exactly one commit to restore to.', 'Select exactly one commit to restore to.', 'Select exactly one commit to restore to.', 'Pick exactly one — restoring to two places at once is not a thing.', 'Pick exactly one — restoring to two places at once is not a thing, however tempting.'],
    yue: ['要揀啱啱一個commit先可以還原。', '要揀啱啱一個commit先可以還原。', '要揀啱啱一個commit先可以還原。', '揀啱啱一個 — 同時還原去兩個地方冇呢支歌仔唱。', '揀啱啱一個 — 同時還原去兩個地方冇呢支歌仔唱，就算幾想都唔得。']
  },
  'world-vault.prune.confirmAction': {
    en: ['Prune history before {hash}', 'Prune history before {hash}', 'Squash the history before {hash} into one commit', 'Squash everything before {hash}', 'Squash everything before {hash} into one and reclaim the space'],
    yue: ['修剪{hash}之前嘅歷史', '修剪{hash}之前嘅歷史', '將{hash}之前嘅歷史壓做一個commit', '將{hash}之前全部壓做一舊', '將{hash}之前全部壓做一舊，慳返啲空間']
  },
  'world-vault.prune.irreversible': {
    en: [
      'Every commit before {hash} is collapsed into one. The file content at {hash} is kept exactly; only the individual steps that led to it are gone for good, and the space they used is reclaimed.',
      'Every commit before {hash} is collapsed into one. The file content at {hash} is kept exactly; only the individual steps that led to it are gone for good, and the space they used is reclaimed.',
      'Every commit before {hash} is collapsed into a single new one. The exact file content at {hash} survives; the individual commits leading up to it do not, and cannot be recovered afterwards. Disk space they used is reclaimed.',
      'Everything before {hash} gets flattened into one commit. The end result at {hash} looks identical; the play-by-play that got there is gone — permanently — and you get the disk space back.',
      'Everything before {hash} gets flattened into one commit, forever. The end result at {hash} looks identical; the play-by-play that got there is gone — permanently, no undo, none — and you get the disk space back.'
    ],
    yue: [
      '{hash}之前嘅每一個commit都會壓做一個。{hash}嘅檔案內容會原封不動咁保留；淨係去到嗰度嘅每一個步驟會永久消失，佔用嘅空間亦會攞返。',
      '{hash}之前嘅每一個commit都會壓做一個。{hash}嘅檔案內容會原封不動咁保留；淨係去到嗰度嘅每一個步驟會永久消失，佔用嘅空間亦會攞返。',
      '{hash}之前嘅每一個commit都會壓做一個新嘅。{hash}嗰刻嘅確實檔案內容會保留；不過去到嗰度嘅個別commit就會消失，之後冇得攞返，佔用嘅硬碟空間會攞返。',
      '{hash}之前嘅嘢全部壓平做一個commit。{hash}嘅最終結果睇落一模一樣；不過去到嗰度嘅逐步過程就冇咗 — 永久噉冇咗 — 換嚟嘅係攞返啲硬碟空間。',
      '{hash}之前嘅嘢全部永久噉壓平做一個commit。{hash}嘅最終結果睇落一模一樣；不過去到嗰度嘅逐步過程就冇咗 — 永久噉冇咗，冇得undo — 換嚟嘅係攞返啲硬碟空間。'
    ]
  },
  'world-vault.prune.done': {
    en: ['{count} commits were combined, reclaiming {size}.', '{count} commits were combined, reclaiming {size}.', '{count} commits were combined into one, reclaiming {size} on disk.', '{count} commits, squashed. {size} back.', '{count} commits, squashed into oblivion. {size} back in your pocket.'],
    yue: ['{count}個commit已經合併，攞返{size}空間。', '{count}個commit已經合併，攞返{size}空間。', '{count}個commit已經合併做一個，喺硬碟度攞返{size}。', '{count}個commit，壓咗。攞返{size}。', '{count}個commit，壓到冇晒。攞返{size}落你袋。']
  },
  'world-vault.prune.failed': {
    en: ['Pruning failed and was rolled back: {reason}', 'Pruning failed and was rolled back: {reason}', 'Pruning failed and was rolled back — no history was lost: {reason}', 'That did not work; nothing was touched: {reason}', 'That did not work; the whole thing was rolled back, nothing lost: {reason}'],
    yue: ['修剪失敗，已經還原返：{reason}', '修剪失敗，已經還原返：{reason}', '修剪失敗，已經還原返 — 冇失去任何歷史：{reason}', '搞唔掂，乜都冇郁過：{reason}', '搞唔掂，成件事已經還原返，冇整少過嘢：{reason}']
  },
  'world-vault.prune.needOne': {
    en: ['Select exactly one commit as the prune boundary.', 'Select exactly one commit as the prune boundary.', 'Select exactly one commit to prune before.', 'Pick exactly one commit as the cut-off.', 'Pick exactly one commit as the cut-off — the line in the sand.'],
    yue: ['要揀啱啱一個commit做修剪嘅界線。', '要揀啱啱一個commit做修剪嘅界線。', '要揀啱啱一個commit做修剪嘅起點。', '揀啱啱一個commit做分界線。', '揀啱啱一個commit做分界線 — 一條劃喺沙度嘅線。']
  },
  'world-vault.publish.heading': {
    en: ['Publish', 'Publish', 'Publish this vault', 'Send it out', 'Send this world out into the world'],
    yue: ['發佈', '發佈', '發佈呢個保險箱', '放出去', '將呢個世界放出去']
  },
  'world-vault.publish.risk': {
    en: [
      'Publishing sends the whole world to a remote you choose. It may contain other players’ builds, their chests and their coordinates. This never happens automatically — it only happens when you choose it, here.',
      'Publishing sends the whole world to a remote you choose. It may contain other players’ builds, their chests and their coordinates. This never happens automatically — it only happens when you choose it, here.',
      'Publishing sends the whole vault — every committed file, {size} of it, {files} files — to a remote you choose. A downloaded world can hold other players’ builds, chests and coordinates. This is never automatic and never runs on a timer; it only happens when you press one of the buttons below.',
      'This is the "send it to someone else’s server" button. {size} across {files} files leaves this machine, and it might carry other people’s builds, chests and coordinates with it. Nothing here ever fires on its own.',
      'This is the "send it to someone else’s server" button, and it is loud about it on purpose. {size} across {files} files leaves this machine, and it might carry other people’s builds, chests and coordinates with it. Nothing here ever fires on its own — you press it, or it does not happen.'
    ],
    yue: [
      '發佈會將成個世界送去你揀嘅remote。入面可能有其他玩家嘅建築、佢哋嘅箱同座標。呢件事永遠唔會自動發生 — 淨係你喺呢度撳先會發生。',
      '發佈會將成個世界送去你揀嘅remote。入面可能有其他玩家嘅建築、佢哋嘅箱同座標。呢件事永遠唔會自動發生 — 淨係你喺呢度撳先會發生。',
      '發佈會將成個保險箱 — 每一個已commit嘅檔案，共{size}，{files}個檔案 — 送去你揀嘅remote。已下載嘅世界可能有其他玩家嘅建築、箱同座標。呢件事唔會自動發生，亦唔會定時發生；淨係你撳低面其中一個掣先會發生。',
      '呢個係「送去人哋部server」掣。{size}共{files}個檔案會離開呢部機，仲有可能夾埋人哋間建築、箱同座標一齊走。呢度冇一樣嘢會自己郁。',
      '呢個係「送去人哋部server」掣，而且特登講得好大聲。{size}共{files}個檔案會離開呢部機，仲有可能夾埋人哋間建築、箱同座標一齊走。呢度冇一樣嘢會自己郁 — 你唔撳，佢就唔會發生。'
    ]
  },
  'world-vault.publish.preflight.summary': {
    en: [
      'World: {size} · {files} files',
      'World: {size} · {files} files',
      'World: {size} across {files} files',
      '{size}, {files} files — ready to go',
      '{size} across {files} files — ready to leave the nest'
    ],
    yue: ['世界：{size}·{files}個檔案', '世界：{size}·{files}個檔案', '世界：共{size}，{files}個檔案', '{size}，{files}個檔案 — 就緒', '{size}，{files}個檔案 — 準備飛出鳥巢']
  },
  'world-vault.publish.preflight.gitMissing': { en: ['git is not installed, so publishing is unavailable.', 'git is not installed, so publishing is unavailable.', 'git is not installed on this machine, so nothing can be published.', 'No git, no publish. Sorry.', 'No git, no publish. Sorry, that one is not optional.'], yue: ['未裝git，所以發佈用唔到。', '未裝git，所以發佈用唔到。', '呢部機未裝git，所以乜都發佈唔到。', '冇git就冇發佈。唔好意思。', '冇git就冇發佈。唔好意思，呢樣嘢冇得攤大手。'] },
  'world-vault.publish.preflight.ghMissing': { en: ['The GitHub CLI ("gh") was not found. Install it to publish to GitHub.', 'The GitHub CLI ("gh") was not found. Install it to publish to GitHub.', 'The GitHub CLI ("gh") was not found on PATH. Install it to create a new GitHub repository from here.', 'No "gh" on this machine, so no one-click GitHub repo.', 'No "gh" on this machine, so no one-click GitHub repo — install it first.'], yue: ['搵唔到GitHub CLI（「gh」）。裝返先可以發佈去GitHub。', '搵唔到GitHub CLI（「gh」）。裝返先可以發佈去GitHub。', 'PATH度搵唔到GitHub CLI（「gh」）。裝返先可以喺呢度一撳建立GitHub repository。', '呢部機冇「gh」，所以冇得一撳整GitHub repo。', '呢部機冇「gh」，所以冇得一撳整GitHub repo — 先裝返佢。'] },
  'world-vault.publish.preflight.ghNotAuthed': { en: ['The GitHub CLI is installed but not signed in. Run "gh auth login" first.', 'The GitHub CLI is installed but not signed in. Run "gh auth login" first.', 'The GitHub CLI is installed but not signed in to any account. Run "gh auth login" in a terminal, then try again.', '"gh" is here but not logged in. Sign in first.', '"gh" is here but not logged in — run "gh auth login" and come back.'], yue: ['GitHub CLI裝咗但未登入。請先行「gh auth login」。', 'GitHub CLI裝咗但未登入。請先行「gh auth login」。', 'GitHub CLI裝咗但未登入任何帳戶。喺terminal行「gh auth login」，再試多次。', '「gh」喺度但未登入。先登入。', '「gh」喺度但未登入 — 行「gh auth login」再返嚟。'] },
  'world-vault.publish.remoteUrl.label': { en: ['Remote URL', 'Remote URL', 'Remote repository URL', 'Where to send it', 'Where in the world does it go'], yue: ['遠端網址', '遠端網址', '遠端repository網址', '送去邊', '呢個世界要送去邊'] },
  'world-vault.publish.remoteUrl.description': {
    en: [
      'An existing empty repository’s URL, e.g. https://github.com/you/world.git',
      'An existing empty repository’s URL, e.g. https://github.com/you/world.git',
      'The URL of an existing, empty repository you already created. Used as "origin"; a repository that already has a `main.js`-shaped history of its own is the wrong target here.',
      'Paste the URL of a repo you already made. It should be empty — this is not a merge tool.',
      'Paste the URL of a repo you already made. It should be empty — this is a "send my world here", not a merge tool.'
    ],
    yue: [
      '一個現有嘅空repository網址，例如https://github.com/you/world.git',
      '一個現有嘅空repository網址，例如https://github.com/you/world.git',
      '你已經整好嘅一個空repository網址，會攞嚟做「origin」；一個已經有自己一堆歷史嘅repository唔係啱嘅目標。',
      '貼返你自己整好嘅repo網址。應該係空嘅 — 呢度唔係merge工具。',
      '貼返你自己整好嘅repo網址。應該係空嘅 — 呢度係「將我個世界送去嗰度」，唔係merge工具。'
    ]
  },
  'world-vault.publish.push': { en: ['Push', 'Push', 'Set the remote and push', 'Send it off', 'Send it off to that remote'], yue: ['推送', '推送', '設定遠端並推送', '送出去', '送去嗰個遠端'] },
  'world-vault.publish.pushConfirmAction': { en: ['Push the vault to {url}', 'Push the vault to {url}', 'Push the vault ({size}, {files} files) to {url}', 'Send {size} to {url}', 'Send {size} across {files} files to {url}'], yue: ['將保險箱推去{url}', '將保險箱推去{url}', '將保險箱（{size}，{files}個檔案）推去{url}', '送{size}去{url}', '送{size}共{files}個檔案去{url}'] },
  'world-vault.publish.pushIrreversible': {
    en: [
      'Every committed file in the vault becomes visible to anyone who can reach {url}. This cannot be undone from here once it has left the machine.',
      'Every committed file in the vault becomes visible to anyone who can reach {url}. This cannot be undone from here once it has left the machine.',
      'Every committed file in the vault — the whole history, not just the latest snapshot — becomes visible to anyone who can reach {url}. Once it has left this machine, this application cannot pull it back.',
      'The whole history goes, not just the current snapshot, and it goes to whoever can read {url}. Once it is out, it is out.',
      'The whole history goes, not just the current snapshot, and it goes to whoever can read {url}. Once it is out, it is out — for good, from this end.'
    ],
    yue: [
      '保險箱入面所有已commit嘅檔案都會俾能夠去到{url}嘅人睇到。一離開呢部機，喺呢度就冇得還原返。',
      '保險箱入面所有已commit嘅檔案都會俾能夠去到{url}嘅人睇到。一離開呢部機，喺呢度就冇得還原返。',
      '保險箱入面所有已commit嘅檔案 — 成部歷史，唔係淨係最新快照 — 都會俾能夠去到{url}嘅人睇到。一離開呢部機，呢個應用程式就攞唔返。',
      '成部歷史都會走，唔淨係而家嘅快照，仲會去到任何識睇{url}嘅人手上。一出咗去，就係出咗去。',
      '成部歷史都會走，唔淨係而家嘅快照，仲會去到任何識睇{url}嘅人手上。一出咗去，就係出咗去 — 喺呢部機呢邊，永遠冇得返轉頭。'
    ]
  },
  'world-vault.publish.pushDone': { en: ['Pushed to {url}.', 'Pushed to {url}.', 'The vault was pushed to {url}.', 'It is out. {url}.', 'It is out there now. {url}.'], yue: ['已推去{url}。', '已推去{url}。', '保險箱已經推去{url}。', '出咗去喇。{url}。', '而家已經出咗去。{url}。'] },
  'world-vault.publish.pushFailed': { en: ['The push failed: {reason}', 'The push failed: {reason}', 'The push failed and nothing left the machine: {reason}', 'That did not go anywhere: {reason}', 'That did not go anywhere, nothing left this machine: {reason}'], yue: ['推送失敗：{reason}', '推送失敗：{reason}', '推送失敗，乜都冇離開過呢部機：{reason}', '冇送到去邊：{reason}', '冇送到去邊，乜都冇離開過呢部機：{reason}'] },
  'world-vault.publish.repoName.label': { en: ['Repository name', 'Repository name', 'New repository name', 'Name it', 'Name it something memorable'], yue: ['Repository名稱', 'Repository名稱', '新repository名稱', '改個名', '改個記得住嘅名'] },
  'world-vault.publish.repoName.description': {
    en: [
      'The name of the new GitHub repository. Letters, digits, dots, hyphens and underscores only.',
      'The name of the new GitHub repository. Letters, digits, dots, hyphens and underscores only.',
      'The name the new GitHub repository is created with, under your signed-in account. Letters, digits, dots, hyphens and underscores only.',
      'What the new repo is called on GitHub, under your own account.',
      'What the new repo is called on GitHub, under your own account — make it good, renaming later is its own adventure.'
    ],
    yue: [
      '新GitHub repository嘅名，淨係可以有英文字母、數字、點、連字號同底線。',
      '新GitHub repository嘅名，淨係可以有英文字母、數字、點、連字號同底線。',
      '新GitHub repository會用呢個名，喺你已登入嘅帳戶入面建立。淨係可以有英文字母、數字、點、連字號同底線。',
      '新repo喺你自己GitHub帳戶入面叫咩名。',
      '新repo喺你自己GitHub帳戶入面叫咩名 — 改好啲，因為之後改名又係另一場冒險。'
    ]
  },
  'world-vault.publish.visibility.label': { en: ['Visibility', 'Visibility', 'Repository visibility', 'Public or private?', 'Public or private — pick carefully'], yue: ['可見度', '可見度', 'Repository可見度', '公開定私人？', '公開定私人 — 揀真啲'] },
  'world-vault.publish.visibility.private': { en: ['Private', 'Private', 'Private', 'Private (just for you)', 'Private (just for you, and whoever you invite)'], yue: ['私人', '私人', '私人', '私人（淨係你自己）', '私人（淨係你，同埋你請嘅人）'] },
  'world-vault.publish.visibility.public': { en: ['Public', 'Public', 'Public', 'Public (anyone can see it)', 'Public (the whole internet can see it)'], yue: ['公開', '公開', '公開', '公開（人人都睇到）', '公開（成個互聯網都睇到）'] },
  'world-vault.publish.createRepo': { en: ['Create a GitHub repository', 'Create a GitHub repository', 'Create a new GitHub repository', 'Make a fresh repo', 'Make a fresh repo and send it there'], yue: ['建立GitHub repository', '建立GitHub repository', '建立新GitHub repository', '整個新repo', '整個新repo同埋送過去'] },
  'world-vault.publish.createRepoConfirmAction': { en: ['Create "{name}" ({visibility}) and push {size}', 'Create "{name}" ({visibility}) and push {size}', 'Create "{name}" ({visibility}) on GitHub and push {size} across {files} files', 'Create "{name}" ({visibility}) and send {size}', 'Create "{name}" ({visibility}) and send {size} across {files} files out into the world'], yue: ['建立「{name}」（{visibility}）並推送{size}', '建立「{name}」（{visibility}）並推送{size}', '喺GitHub建立「{name}」（{visibility}）並推送{size}共{files}個檔案', '建立「{name}」（{visibility}）並送{size}', '建立「{name}」（{visibility}）並送{size}共{files}個檔案出去'] },
  'world-vault.publish.createRepoIrreversible': {
    en: [
      'A new {visibility} repository named "{name}" is created on GitHub under your account, and every committed file in the vault is pushed to it. This cannot be undone from here once it has left the machine.',
      'A new {visibility} repository named "{name}" is created on GitHub under your account, and every committed file in the vault is pushed to it. This cannot be undone from here once it has left the machine.',
      'A new {visibility} repository named "{name}" is created on GitHub under your signed-in account, and the whole committed history — not just the latest snapshot — is pushed to it. Once it has left this machine, this application cannot pull it back.',
      'A brand-new {visibility} repo called "{name}" appears on GitHub, and the whole history goes into it. Once it is out, it is out.',
      'A brand-new {visibility} repo called "{name}" appears on GitHub, and the whole history goes into it — not just today’s snapshot. Once it is out, it is out, for good, from this end.'
    ],
    yue: [
      '一個叫「{name}」嘅新{visibility} repository會喺GitHub入面、你嘅帳戶下面建立，保險箱入面所有已commit嘅檔案會推去嗰度。一離開呢部機，喺呢度就冇得還原返。',
      '一個叫「{name}」嘅新{visibility} repository會喺GitHub入面、你嘅帳戶下面建立，保險箱入面所有已commit嘅檔案會推去嗰度。一離開呢部機，喺呢度就冇得還原返。',
      '一個叫「{name}」嘅新{visibility} repository會喺GitHub入面、你已登入嘅帳戶下面建立，成部已commit嘅歷史 — 唔淨係最新快照 — 會推去嗰度。一離開呢部機，呢個應用程式就攞唔返。',
      '一個叫「{name}」嘅全新{visibility} repo會喺GitHub出現，成部歷史都會入去。一出咗去，就係出咗去。',
      '一個叫「{name}」嘅全新{visibility} repo會喺GitHub出現，成部歷史都會入去 — 唔淨係今日嘅快照。一出咗去，就係出咗去，永久噉，喺呢部機呢邊。'
    ]
  },
  'world-vault.publish.createRepoDone': { en: ['"{name}" was created and pushed: {url}', '"{name}" was created and pushed: {url}', '"{name}" was created and the vault was pushed: {url}', '"{name}" is live: {url}', '"{name}" is live and breathing: {url}'], yue: ['「{name}」已經建立並推送：{url}', '「{name}」已經建立並推送：{url}', '「{name}」已經建立，保險箱亦已推送：{url}', '「{name}」上咗線：{url}', '「{name}」上咗線，仲喺度呼吸緊：{url}'] },
  'world-vault.publish.createRepoFailed': { en: ['The repository could not be created: {reason}', 'The repository could not be created: {reason}', 'The repository could not be created and nothing was pushed: {reason}', 'That did not work: {reason}', 'That did not work, nothing was pushed: {reason}'], yue: ['Repository建立唔到：{reason}', 'Repository建立唔到：{reason}', 'Repository建立唔到，冇推送過任何嘢：{reason}', '搞唔掂：{reason}', '搞唔掂，乜都冇推送過：{reason}'] },
  'world-vault.regionDenied.title': { en: ['Region file busy', 'Region file busy', 'Region file access refused', 'Not right now', 'Not right now, that file is mid-write'], yue: ['Region檔案忙緊', 'Region檔案忙緊', 'Region檔案存取被拒', '而家唔得', '而家唔得，個檔案寫緊嘢'] },
  'world-vault.command.create': { en: ['Create the world vault', 'Create the world vault', 'Create the world vault', 'Start the vault', 'Start the vault, right now'], yue: ['建立世界保險箱', '建立世界保險箱', '建立世界保險箱', '開始保險箱', '即刻開始保險箱'] },
  'world-vault.command.publish': { en: ['Publish the world vault', 'Publish the world vault', 'Publish the world vault', 'Send the vault out', 'Send the vault out into the world'], yue: ['發佈世界保險箱', '發佈世界保險箱', '發佈世界保險箱', '將保險箱放出去', '將保險箱放出去見世面'] }
};
