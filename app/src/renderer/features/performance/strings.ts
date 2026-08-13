import type { Catalogue } from '../../core/registry';

/**
 * Every user-facing string this feature owns, in English and playful Hong Kong
 * Cantonese, at all five humour levels. The two ladders are independent: an
 * English reader at level 1 and a Cantonese reader at level 5 must both still
 * come away knowing exactly what each knob does and what the Speed picker
 * just changed.
 */

export const PERFORMANCE_STRINGS: Catalogue = {
  /* ---------------- section and Speed picker ---------------- */

  'performance.section': {
    en: ['Performance', 'Performance', 'Performance tuning', 'Performance tuning (the fun knobs)', 'Performance tuning (the fun knobs)'],
    yue: ['效能', '效能', '效能調校', '效能調校（好玩嘅掣）', '效能調校（好玩嘅掣）']
  },
  'performance.speed.label': {
    en: ['Speed', 'Speed', 'Speed', 'Speed — one dial for all six knobs', 'Speed — one dial for all six knobs'],
    yue: ['速度', '速度', '速度', '速度 —一個掣控制晒六個掣', '速度 —一個掣控制晒六個掣']
  },
  'performance.speed.description': {
    en: [
      'A single level from 1 to 5 that sets the six advanced values below together. Moving it writes those values; changing one of the six directly is reflected here, including an explicit "Custom" state when the values match no documented level.',
      'A single level from 1 to 5 that sets the six advanced values below together. Moving it writes those values, and changing one of the six directly is reflected here too — including an honest "Custom" state when nothing matches.',
      'One dial for the six advanced values below. Move it and all six change together; change one of the six by hand instead, and this dial updates to match — or says "Custom" plainly when nothing lines up.',
      'One dial, six knobs underneath. Slide it and all six advanced values jump together; nudge just one of the six yourself and the dial notices, honestly landing on "Custom" instead of pretending it still knows which level you meant.',
      'One dial to rule the six knobs below. Slide it and all six leap into formation; poke just one knob yourself and the dial catches you red-handed — "Custom", no judgement, no guessing.'
    ],
    yue: [
      '一個 1 到 5 嘅級數，一次過設定晒下面六個進階數值。撥動佢就會寫低嗰啲數值；直接改咗其中一個，呢度都會照樣反映，包括喺乜都對唔上嘅時候老實講句「自訂」。',
      '一個 1 到 5 嘅級數，一次過設定晒下面六個進階數值。撥動佢就會寫低嗰啲數值，直接改其中一個都會喺呢度反映 —包括老實講句「自訂」。',
      '一個掣控制晒下面六個進階數值。撥佢就六個一齊變；反而手動改其中一個，呢個掣就會自動對返 —定係坦白講「自訂」。',
      '一個掣，底下六個掣。撥佢六個進階數值一齊跳；自己郁咗其中一個，呢個掣會察覺到，老老實實顯示「自訂」，唔會扮嘢話自己仲知你想揀邊級。',
      '一個掣統領下面六個掣。撥佢六個一齊變陣；自己郁咗一個掣，佢即刻捉你正 —「自訂」，唔怪你，亦唔會靠估。'
    ]
  },
  'performance.speed.status.level': {
    en: ['Level {level} — {name}.', 'Level {level} — {name}.', 'Currently Level {level} — {name}.', 'Sitting pretty at Level {level} — {name}.', 'Cruising at Level {level} — {name}. Nice.'],
    yue: [
      '而家係第 {level} 級 —{name}。',
      '而家係第 {level} 級 —{name}。',
      '而家用緊第 {level} 級 —{name}。',
      '安安樂樂喺第 {level} 級 —{name} 度。',
      '型爆爆咁喺第 {level} 級 —{name}，正！'
    ]
  },
  'performance.speed.status.custom': {
    en: [
      'Custom: the six advanced values below do not match any documented level.',
      'Custom: the six advanced values below do not match any documented level.',
      'Custom: at least one advanced value below has been changed by hand, so it no longer matches any documented level.',
      'Custom — somebody has been in here fiddling with the knobs directly. None of the five documented levels matches what is set below, and that is fine.',
      'Custom! Somebody went off-script and hand-tuned a knob below. None of the five levels matches any more — and that is completely fine, this is your app.'
    ],
    yue: [
      '自訂：下面六個進階數值同任何一級都對唔上。',
      '自訂：下面六個進階數值同任何一級都對唔上。',
      '自訂：下面至少有一個進階數值畀人手動改咗，所以同任何一級都對唔上。',
      '自訂 —有人自己入嚟撥掣。下面嘅設定同五個級數冇一個夾得上，冇問題㗎。',
      '自訂喇！有人自己走去撥掣，而家同邊個級數都夾唔上 —冇所謂，呢個係你嘅程式嘛。'
    ]
  },
  'performance.speed.picker.label': {
    en: ['Choose a Speed level', 'Choose a Speed level', 'Pick a Speed level', 'Pick a Speed level — it sets all six knobs at once', 'Pick a Speed level — it sets all six knobs at once'],
    yue: ['揀一個速度級數', '揀一個速度級數', '揀個速度級數', '揀個速度級數 —一次過設定晒六個掣', '揀個速度級數 —一次過設定晒六個掣']
  },
  'performance.speed.applyDefault': {
    en: [
      'Use the shipped default (Level {level} — {name})',
      'Use the shipped default (Level {level} — {name})',
      'Return to the shipped default: Level {level} — {name}',
      'Back to how it shipped: Level {level} — {name}',
      'Snap back to factory-fresh: Level {level} — {name}'
    ],
    yue: [
      '用返出廠預設（第 {level} 級 —{name}）',
      '用返出廠預設（第 {level} 級 —{name}）',
      '返去出廠預設值：第 {level} 級 —{name}',
      '返去出廠原裝：第 {level} 級 —{name}',
      '一鍵返廠：第 {level} 級 —{name}'
    ]
  },
  'performance.speed.applied': {
    en: [
      'Applied Level {level} — {name}. {count} advanced settings were updated and recorded in local history.',
      'Applied Level {level} — {name}. {count} advanced settings were updated and recorded in local history.',
      'Applied Level {level} — {name}. {count} advanced settings changed, and the change was recorded in local history so it can be undone.',
      'Level {level} — {name} is in. {count} advanced settings just moved together, and local history has the receipt in case you want it back.',
      'Level {level} — {name}, locked in! {count} advanced settings shuffled into place, and local history kept the receipt.'
    ],
    yue: [
      '已套用第 {level} 級 —{name}。{count} 個進階設定已更新，並記錄咗喺本機紀錄入面。',
      '已套用第 {level} 級 —{name}。{count} 個進階設定已更新，並記錄咗喺本機紀錄入面。',
      '已套用第 {level} 級 —{name}。{count} 個進階設定已改咗，並記錄咗喺本機紀錄，隨時可以撤銷。',
      '第 {level} 級 —{name} 上咗場！{count} 個進階設定一齊郁咗，本機紀錄有單據留底。',
      '第 {level} 級 —{name}，搞掂！{count} 個進階設定齊齊郁位，本機紀錄幫你留咗單。'
    ]
  },
  'performance.speed.table.caption': {
    en: [
      'Exactly what each Speed level sets',
      'Exactly what each Speed level sets',
      'Exactly what each Speed level sets, so the mapping is checkable rather than taken on faith',
      'Exactly what each Speed level sets — no hand-waving, just the six numbers',
      'Exactly what each Speed level sets — receipts, not vibes'
    ],
    yue: [
      '每個速度級數實際會設定咩',
      '每個速度級數實際會設定咩',
      '每個速度級數實際會設定咩 —成個對應表睇得一清二楚，唔使靠估',
      '每個速度級數實際設定咩 —冇花巧，淨係六個數字',
      '每個速度級數實際設定咩 —講證據，唔講感覺'
    ]
  },
  'performance.speed.table.col.level': {
    en: ['Level', 'Level', 'Level', 'Level', 'Level'],
    yue: ['級數', '級數', '級數', '級數', '級數']
  },
  'performance.speed.table.col.chunkBatchSize': {
    en: ['Chunk batch size', 'Chunk batch size', 'Chunk batch size', 'Chunk batch size', 'Chunk batch size'],
    yue: ['區塊批次大小', '區塊批次大小', '區塊批次大小', '區塊批次大小', '區塊批次大小']
  },
  'performance.speed.table.col.workerConcurrency': {
    en: ['Worker concurrency', 'Worker concurrency', 'Worker concurrency', 'Worker concurrency', 'Worker concurrency'],
    yue: ['並行工作數量', '並行工作數量', '並行工作數量', '並行工作數量', '並行工作數量']
  },
  'performance.speed.table.col.mapTileResolution': {
    en: ['Map tile resolution', 'Map tile resolution', 'Map tile resolution', 'Map tile resolution', 'Map tile resolution'],
    yue: ['地圖圖磚解像度', '地圖圖磚解像度', '地圖圖磚解像度', '地圖圖磚解像度', '地圖圖磚解像度']
  },
  'performance.speed.table.col.logRetentionDays': {
    en: ['Log retention', 'Log retention', 'Log retention', 'Log retention', 'Log retention'],
    yue: ['紀錄保留期', '紀錄保留期', '紀錄保留期', '紀錄保留期', '紀錄保留期']
  },
  'performance.speed.table.col.refreshIntervalMs': {
    en: ['Refresh interval', 'Refresh interval', 'Refresh interval', 'Refresh interval', 'Refresh interval'],
    yue: ['重新整理間隔', '重新整理間隔', '重新整理間隔', '重新整理間隔', '重新整理間隔']
  },
  'performance.speed.table.col.animationLevel': {
    en: ['Animation level', 'Animation level', 'Animation level', 'Animation level', 'Animation level'],
    yue: ['動畫等級', '動畫等級', '動畫等級', '動畫等級', '動畫等級']
  },
  'performance.speed.table.current': {
    en: ['current', 'current', 'current', 'current', 'current'],
    yue: ['現用', '現用', '現用', '現用', '現用']
  },
  'performance.speed.export': {
    en: [
      'Export current performance values',
      'Export current performance values',
      'Export the current performance values',
      'Export what is actually set right now',
      'Export what is actually set right now'
    ],
    yue: ['匯出目前嘅效能數值', '匯出目前嘅效能數值', '匯出而家嘅效能數值', '匯出而家實際生效嘅數值', '匯出而家實際生效嘅數值']
  },
  'performance.speed.exported': {
    en: ['Saved to {path}.', 'Saved to {path}.', 'The current performance values were saved to {path}.', 'Done — saved to {path}.', 'Done — saved to {path}.'],
    yue: ['已儲存去 {path}。', '已儲存去 {path}。', '目前嘅效能數值已儲存去 {path}。', '搞掂 —已儲存去 {path}。', '搞掂 —已儲存去 {path}。']
  },

  /* ---------------- units, used in the table and the status line ---------------- */

  'performance.unit.chunks': {
    en: ['{value} chunks per batch', '{value} chunks per batch', '{value} chunks per batch', '{value} chunks a bite', '{value} chunks a gulp'],
    yue: ['每批 {value} 個區塊', '每批 {value} 個區塊', '每批 {value} 個區塊', '一啖 {value} 個區塊', '一啖 {value} 個區塊']
  },
  'performance.unit.workers': {
    en: ['{value} worker(s)', '{value} worker(s)', '{value} concurrent workers', '{value} workers elbow to elbow', '{value} workers shoulder to shoulder'],
    yue: ['{value} 個工作', '{value} 個工作', '{value} 個同時進行嘅工作', '{value} 個工作你撞我我撞你', '{value} 個工作肩併肩']
  },
  'performance.unit.days': {
    en: ['{value} days', '{value} days', '{value} days', '{value} days before the sweep', '{value} days before the sweep'],
    yue: ['{value} 日', '{value} 日', '{value} 日', '{value} 日先掃走', '{value} 日先掃走']
  },
  'performance.unit.ms': {
    en: ['every {value} ms', 'every {value} ms', 'every {value} ms', 'a check every {value} ms', 'a check every {value} ms'],
    yue: ['每 {value} 毫秒', '每 {value} 毫秒', '每 {value} 毫秒', '每 {value} 毫秒check一次', '每 {value} 毫秒check一次']
  },

  /* ---------------- level names and blurbs ---------------- */

  'performance.level.1.name': {
    en: ['Battery saver', 'Battery saver', 'Battery saver', 'Battery saver', 'Battery saver'],
    yue: ['省電模式', '省電模式', '省電模式', '省電模式', '省電模式']
  },
  'performance.level.1.blurb': {
    en: [
      'The lightest load on the machine: one worker, small batches, low-resolution tiles and infrequent refreshes.',
      'The lightest load on the machine: one worker, small batches, low-resolution tiles and infrequent refreshes.',
      'The lightest possible load: one worker at a time, small batches, low-resolution map tiles, infrequent refreshes and no decorative animation.',
      'Barely breaks a sweat: one worker, tiny batches, blurry-by-design map tiles, a slow refresh and zero decorative animation.',
      'Whisper mode: one worker, tiny batches, tiles kept deliberately blurry, a lazy refresh and every decorative animation switched off.'
    ],
    yue: [
      '對機器負擔最輕：淨係一個工作、細批次、低解像度圖磚，仲有耐唔耐先更新一次。',
      '對機器負擔最輕：淨係一個工作、細批次、低解像度圖磚，仲有耐唔耐先更新一次。',
      '負擔輕到極：一個工作行住先、細批次、低解像度圖磚、耐耐先更新一次，仲關埋晒裝飾動畫。',
      '慢工出細貨：一個工作、蚊型批次、圖磚特登整矇啲、更新慢吞吞，裝飾動畫全部熄晒。',
      '靜英英模式：一個工作、蚊型批次、圖磚特登矇查查、更新慢過龜、裝飾動畫全熄。'
    ]
  },
  'performance.level.2.name': {
    en: ['Light', 'Light', 'Light', 'Light', 'Light'],
    yue: ['輕量', '輕量', '輕量', '輕量', '輕量']
  },
  'performance.level.2.blurb': {
    en: [
      'A gentler load than the default: two workers, modest batches and a slower refresh.',
      'A gentler load than the default: two workers, modest batches and a slower refresh.',
      'Gentler than the default: two workers, modest batches, standard-resolution tiles, a slower refresh and only minimal decorative animation.',
      'Takes it easy: two workers, modest batches, a slower refresh and just a hint of decorative animation.',
      'Cruise control: two workers, modest batches, an unhurried refresh and a hint of decorative animation, nothing flashy.'
    ],
    yue: [
      '負擔比預設輕少少：兩個工作、中等批次、更新慢啲。',
      '負擔比預設輕少少：兩個工作、中等批次、更新慢啲。',
      '負擔比預設輕：兩個工作、中等批次、標準解像度圖磚、更新慢啲，裝飾動畫都係少少。',
      '慢慢嚟：兩個工作、中等批次、更新唔急、裝飾動畫得少少。',
      '巡航模式：兩個工作、中等批次、唔急住更新、裝飾動畫淡淡地，唔浮誇。'
    ]
  },
  'performance.level.3.name': {
    en: ['Balanced', 'Balanced', 'Balanced', 'Balanced', 'Balanced'],
    yue: ['平衡', '平衡', '平衡', '平衡', '平衡']
  },
  'performance.level.3.blurb': {
    en: [
      'The shipped default: a middle ground across every knob, suited to most machines.',
      'The shipped default: a middle ground across every knob, suited to most machines.',
      'The shipped default and a middle ground across every knob: four workers, medium batches, standard tiles, a one-second refresh and standard animation.',
      'The one this app ships with, because it works well almost everywhere: four workers, medium batches, a once-a-second refresh and standard animation.',
      'The house blend — ships as default because it just works: four workers, medium batches, a once-a-second refresh, standard animation, nothing to fuss over.'
    ],
    yue: [
      '出廠預設：每個掣都取中間值，啱大部分機器。',
      '出廠預設：每個掣都取中間值，啱大部分機器。',
      '出廠預設值，每個掣都行中庸之道：四個工作、中等批次、標準圖磚、一秒更新一次、標準動畫。',
      '呢個係出廠原裝，因為幾乎邊部機都夾：四個工作、中等批次、一秒更新一次、標準動畫。',
      '招牌配方 —出廠預設，因為夠晒穩陣：四個工作、中等批次、一秒一更新、標準動畫，唔使諗。'
    ]
  },
  'performance.level.4.name': {
    en: ['Fast', 'Fast', 'Fast', 'Fast', 'Fast'],
    yue: ['快速', '快速', '快速', '快速', '快速']
  },
  'performance.level.4.blurb': {
    en: [
      'A heavier load for a capable machine: six workers, larger batches and a faster refresh.',
      'A heavier load for a capable machine: six workers, larger batches and a faster refresh.',
      'A heavier load for a capable machine: six workers, larger batches, high-resolution tiles and a half-second refresh.',
      'Puts a capable machine to work: six workers, chunky batches, sharp tiles and a half-second refresh.',
      'Steps on it: six workers, chunky batches, crisp tiles and a half-second refresh — your fans have opinions now.'
    ],
    yue: [
      '負擔比較重，啱效能夠嘅機：六個工作、大啲批次、更新快啲。',
      '負擔比較重，啱效能夠嘅機：六個工作、大啲批次、更新快啲。',
      '負擔重啲，啱效能夠強嘅機：六個工作、大批次、高解像度圖磚、半秒更新一次。',
      '叫部夠力嘅機做多啲嘢：六個工作、大批次、圖磚夠晒清、半秒更新一次。',
      '踩盡油門：六個工作、大批次、圖磚靚爆、半秒一更新 —風扇開始有意見。'
    ]
  },
  'performance.level.5.name': {
    en: ['Maximum', 'Maximum', 'Maximum', 'Maximum', 'Maximum'],
    yue: ['極速', '極速', '極速', '極速', '極速']
  },
  'performance.level.5.blurb': {
    en: [
      'The heaviest load this application offers: eight workers, the largest batches, the highest-resolution tiles and the fastest refresh.',
      'The heaviest load this application offers: eight workers, the largest batches, the highest-resolution tiles and the fastest refresh.',
      'The heaviest load offered: eight workers, the largest batches, the highest-resolution tiles, a quarter-second refresh and full decorative animation.',
      'Everything turned up: eight workers, the biggest batches, the sharpest tiles, a quarter-second refresh and every decorative animation switched on.',
      'Absolutely everything, all at once: eight workers, the biggest batches, the sharpest tiles, a quarter-second refresh and full decorative animation. Your machine may audibly object.'
    ],
    yue: [
      '呢個程式最重嘅負擔：八個工作、最大批次、最高解像度圖磚、最快更新。',
      '呢個程式最重嘅負擔：八個工作、最大批次、最高解像度圖磚、最快更新。',
      '提供緊最重負擔：八個工作、最大批次、最高解像度圖磚、四分一秒更新一次、全開裝飾動畫。',
      '樣樣都開盡：八個工作、最大批次、圖磚最靚、四分一秒一更新、裝飾動畫全開。',
      '全部一齊嚟：八個工作、最大批次、圖磚靚到爆、四分一秒一更新、裝飾動畫全開 —部機可能會出聲抗議。'
    ]
  },

  /* ---------------- the six real advanced settings ---------------- */

  'performance.chunkBatchSize.label': {
    en: ['Chunk batch size', 'Chunk batch size', 'Chunk batch size', 'Chunk batch size', 'Chunk batch size'],
    yue: ['區塊批次大小', '區塊批次大小', '區塊批次大小', '區塊批次大小', '區塊批次大小']
  },
  'performance.chunkBatchSize.description': {
    en: [
      'How many world chunks the downloader processes together in one batch. A larger batch uses more memory but finishes a batch sooner.',
      'How many world chunks the downloader processes together in one batch. A larger batch uses more memory but finishes a batch sooner.',
      'How many world chunks the downloader processes together in one batch, from 8 to 256 in steps of 8. A larger batch uses more memory and disk I/O at once, but completes a batch sooner.',
      'How many chunks the downloader chews through in one bite, from 8 to 256. Bigger bites use more memory and disk at once, but each bite finishes sooner.',
      'How many chunks the downloader gobbles in one go, from 8 to 256. Bigger gulps use more memory and disk at once, but clear the plate faster.'
    ],
    yue: [
      '下載器一次過處理幾多個世界區塊。批次越大，用嘅記憶體越多，但一批完成得越快。',
      '下載器一次過處理幾多個世界區塊。批次越大，用嘅記憶體越多，但一批完成得越快。',
      '下載器一次過處理幾多個世界區塊，範圍係 8 到 256，每次跳 8。批次越大，即時用嘅記憶體同磁碟讀寫越多，但一批就完成得越快。',
      '下載器一啖過吞幾多個世界區塊，8 到 256。啖越大，即時食嘅記憶體同磁碟越多，但食完一啖嘅時間越短。',
      '下載器一啖過吞幾多個世界區塊，8 到 256。啖越大，記憶體同磁碟即時食得越勁，但一啖清盤嘅速度就越快。'
    ]
  },
  'performance.workerConcurrency.label': {
    en: ['Worker concurrency', 'Worker concurrency', 'Worker concurrency', 'Worker concurrency', 'Worker concurrency'],
    yue: ['並行工作數量', '並行工作數量', '並行工作數量', '並行工作數量', '並行工作數量']
  },
  'performance.workerConcurrency.description': {
    en: [
      'How many download workers run at the same time, from 1 to 8. More workers can finish faster but compete for the same network and disk.',
      'How many download workers run at the same time, from 1 to 8. More workers can finish faster but compete for the same network and disk.',
      'How many download workers run at the same time, from 1 to 8. More workers can finish a session faster, but they compete for the same network connection and disk.',
      'How many download workers are elbowing each other at once, from 1 to 8. More elbows means faster finishes, but they are all sharing one network connection and one disk.',
      'How many download workers are shoulder-to-shoulder right now, 1 to 8. More shoulders, faster finishes — but they are still all fighting over one network connection and one disk.'
    ],
    yue: [
      '幾多個下載工作同一時間運行，1 到 8 個。工作越多完成得越快，但會爭緊同一條網絡同磁碟。',
      '幾多個下載工作同一時間運行，1 到 8 個。工作越多完成得越快，但會爭緊同一條網絡同磁碟。',
      '幾多個下載工作同一時間運行，1 到 8 個。工作越多，一次工作階段完成得越快，但佢哋會爭緊同一條網絡連線同磁碟。',
      '幾多個下載工作同一時間你撞我我撞你，1 到 8 個。人越多做得越快，但大家都爭緊同一條網絡連線同同一舊磁碟。',
      '幾多個下載工作而家肩併肩開緊工，1 到 8 個。人多手腳快，不過大家仍然係爭緊同一條網絡連線同同一舊磁碟。'
    ]
  },
  'performance.mapTileResolution.label': {
    en: ['Map tile resolution', 'Map tile resolution', 'Map tile resolution', 'Map tile resolution', 'Map tile resolution'],
    yue: ['地圖圖磚解像度', '地圖圖磚解像度', '地圖圖磚解像度', '地圖圖磚解像度', '地圖圖磚解像度']
  },
  'performance.mapTileResolution.description': {
    en: [
      'The pixel size of each rendered map tile: 128, 256, 512 or 1024. A higher resolution looks sharper but takes longer to render and more memory to hold.',
      'The pixel size of each rendered map tile: 128, 256, 512 or 1024. A higher resolution looks sharper but takes longer to render and more memory to hold.',
      'The pixel size of each rendered map tile: 128, 256, 512 or 1024 pixels square. A higher resolution looks sharper on a large display but takes longer to render and more memory to hold.',
      'How chunky or crisp each map tile is: 128 up to 1024 pixels. Crisper looks better on a big screen, but costs more render time and memory per tile.',
      'How blurry or crisp each map tile is: 128 up to 1024 pixels. Crisper is gorgeous on a big screen, and it costs render time and memory to get there.'
    ],
    yue: [
      '每塊渲染出嚟嘅地圖圖磚有幾多像素：128、256、512 定 1024。解像度越高睇落越清，但渲染越耐、用嘅記憶體越多。',
      '每塊渲染出嚟嘅地圖圖磚有幾多像素：128、256、512 定 1024。解像度越高睇落越清，但渲染越耐、用嘅記憶體越多。',
      '每塊渲染出嚟嘅地圖圖磚有幾多像素（正方形）：128、256、512 或者 1024。解像度越高喺大螢幕睇越清，但渲染時間同記憶體都會加多。',
      '每塊地圖圖磚有幾矇定幾清：128 到 1024 像素。夠清喺大螢幕睇會靚啲，但每塊圖磚嘅渲染時間同記憶體都要加多。',
      '每塊地圖圖磚有幾矇定幾靚：128 到 1024 像素。夠靚喺大螢幕睇會勁靚，但渲染時間同記憶體都要畀返代價。'
    ]
  },
  'performance.mapTileResolution.option.128': { en: ['128 px', '128 px', '128 px', '128 px', '128 px'], yue: ['128 像素', '128 像素', '128 像素', '128 像素', '128 像素'] },
  'performance.mapTileResolution.option.256': { en: ['256 px', '256 px', '256 px', '256 px', '256 px'], yue: ['256 像素', '256 像素', '256 像素', '256 像素', '256 像素'] },
  'performance.mapTileResolution.option.512': { en: ['512 px', '512 px', '512 px', '512 px', '512 px'], yue: ['512 像素', '512 像素', '512 像素', '512 像素', '512 像素'] },
  'performance.mapTileResolution.option.1024': { en: ['1024 px', '1024 px', '1024 px', '1024 px', '1024 px'], yue: ['1024 像素', '1024 像素', '1024 像素', '1024 像素', '1024 像素'] },

  'performance.logRetentionDays.label': {
    en: ['Log retention', 'Log retention', 'Log retention', 'Log retention', 'Log retention'],
    yue: ['紀錄保留期', '紀錄保留期', '紀錄保留期', '紀錄保留期', '紀錄保留期']
  },
  'performance.logRetentionDays.description': {
    en: [
      'How many days of runtime performance logs are kept before older ones are pruned, from 1 to 90.',
      'How many days of runtime performance logs are kept before older ones are pruned, from 1 to 90.',
      'How many days of runtime performance logs — not the version history, a separate operational log — are kept before older entries are pruned, from 1 to 90 days.',
      'How long runtime performance logs hang around before they get swept out, 1 to 90 days. This is separate from the version history in the History tab.',
      'How long runtime performance logs get to overstay their welcome before the sweep, 1 to 90 days. Not the same thing as the version history in the History tab — that one is forever, this one is not.'
    ],
    yue: [
      '執行期效能紀錄保留幾多日先會被清走，範圍係 1 到 90 日。',
      '執行期效能紀錄保留幾多日先會被清走，範圍係 1 到 90 日。',
      '執行期效能紀錄 —同版本歷史唔同，係另一種運作紀錄 —保留幾多日先清走，1 到 90 日。',
      '執行期效能紀錄可以賴喺度幾耐先畀人清走，1 到 90 日。呢個同「歷史」分頁嘅版本歷史係兩回事。',
      '執行期效能紀錄可以賴皮賴幾耐先被掃走，1 到 90 日。同「歷史」分頁嗰個版本歷史唔同 —嗰個係永久，呢個唔係。'
    ]
  },
  'performance.refreshIntervalMs.label': {
    en: ['Refresh interval', 'Refresh interval', 'Refresh interval', 'Refresh interval', 'Refresh interval'],
    yue: ['重新整理間隔', '重新整理間隔', '重新整理間隔', '重新整理間隔', '重新整理間隔']
  },
  'performance.refreshIntervalMs.description': {
    en: [
      'How often live views such as status and the map poll for new data, in milliseconds, from 100 to 5000. A shorter interval feels more live but does more work.',
      'How often live views such as status and the map poll for new data, in milliseconds, from 100 to 5000. A shorter interval feels more live but does more work.',
      'How often live views such as the connection status and the map poll for new data, in milliseconds, from 100 to 5000. A shorter interval feels more live but does more work in the background.',
      'How often the live views — status, the map — bother to check for something new, in milliseconds, 100 to 5000. Shorter feels snappier, and costs more background work.',
      'How twitchy the live views are about checking for something new, 100 to 5000 milliseconds. Twitchier feels snappier and burns more background work doing it.'
    ],
    yue: [
      '狀態、地圖等即時畫面幾耐check一次新資料，單位係毫秒，100 到 5000。間隔越短睇落越即時，但做嘅嘢越多。',
      '狀態、地圖等即時畫面幾耐check一次新資料，單位係毫秒，100 到 5000。間隔越短睇落越即時，但做嘅嘢越多。',
      '連線狀態、地圖呢啲即時畫面幾耐check一次新資料，毫秒為單位，100 到 5000。間隔越短感覺越即時，但背後做嘅嘢越多。',
      '狀態、地圖呢啲即時畫面幾耐先check一次新嘢，毫秒為單位，100 到 5000。越短越夠即時感，但背後嘅工作量越大。',
      '狀態、地圖呢啲即時畫面幾大礙口check新嘢，100 到 5000 毫秒。越急躁感覺越即時，燒嘅背景工夫都越多。'
    ]
  },
  'performance.animationLevel.label': {
    en: ['Animation level', 'Animation level', 'Animation level', 'Animation level', 'Animation level'],
    yue: ['動畫等級', '動畫等級', '動畫等級', '動畫等級', '動畫等級']
  },
  'performance.animationLevel.description': {
    en: [
      "How much decorative motion this application's own surfaces use: off, minimal, standard or full. This is separate from the operating system's reduced-motion setting, which is always respected regardless of this value.",
      "How much decorative motion this application's own surfaces use: off, minimal, standard or full. This is separate from the operating system's reduced-motion setting, which is always respected regardless of this value.",
      "How much decorative motion this application uses in its own surfaces: off, minimal, standard or full. This never overrides the operating system's reduced-motion preference, which this application always respects regardless.",
      "How much decorative wiggle the interface allows itself: off, minimal, standard or full. The operating system's reduced-motion setting still wins over this, always.",
      "How much decorative wiggle and swoosh the interface allows itself: off, minimal, standard or full. The operating system's reduced-motion setting always overrules this, no exceptions."
    ],
    yue: [
      '呢個程式自己畫面用幾多裝飾性動畫：熄、精簡、標準定全開。呢個同作業系統嘅「減少動態效果」設定係兩回事，後者無論如何都會被尊重。',
      '呢個程式自己畫面用幾多裝飾性動畫：熄、精簡、標準定全開。呢個同作業系統嘅「減少動態效果」設定係兩回事，後者無論如何都會被尊重。',
      '呢個程式自己畫面用幾多裝飾性動畫：熄、精簡、標準定全開。呢個唔會蓋過作業系統嘅「減少動態效果」偏好，本程式無論如何都會遵守嗰個設定。',
      '介面畀自己用幾多裝飾性搖擺：熄、精簡、標準定全開。作業系統嘅「減少動態效果」設定永遠贏。',
      '介面畀自己用幾多花巧搖擺特效：熄、精簡、標準定全開。作業系統嘅「減少動態效果」設定永遠有王牌，冇得拗。'
    ]
  },
  'performance.animationLevel.option.off': { en: ['Off', 'Off', 'Off', 'Off', 'Off'], yue: ['熄', '熄', '熄', '熄', '熄'] },
  'performance.animationLevel.option.minimal': { en: ['Minimal', 'Minimal', 'Minimal', 'Minimal', 'Minimal'], yue: ['精簡', '精簡', '精簡', '精簡', '精簡'] },
  'performance.animationLevel.option.standard': { en: ['Standard', 'Standard', 'Standard', 'Standard', 'Standard'], yue: ['標準', '標準', '標準', '標準', '標準'] },
  'performance.animationLevel.option.full': { en: ['Full', 'Full', 'Full', 'Full', 'Full'], yue: ['全開', '全開', '全開', '全開', '全開'] },

  /* ---------------- palette ---------------- */

  'performance.palette.open': {
    en: ['Open performance settings', 'Open performance settings', 'Open the performance settings', 'Open the performance dial', 'Open the performance dial'],
    yue: ['開啟效能設定', '開啟效能設定', '開啟效能設定', '開個效能撥掣出嚟', '開個效能撥掣出嚟']
  },
  'performance.palette.setLevel': {
    en: [
      'Set the Speed level to {level} — {name}',
      'Set the Speed level to {level} — {name}',
      'Set the Speed level to {level} — {name}',
      'Slide Speed straight to {level} — {name}',
      'Slide Speed straight to {level} — {name}'
    ],
    yue: [
      '將速度級數設做 {level} —{name}',
      '將速度級數設做 {level} —{name}',
      '將速度級數設做 {level} —{name}',
      '一手撥去速度 {level} —{name}',
      '一手撥去速度 {level} —{name}'
    ]
  }
};
