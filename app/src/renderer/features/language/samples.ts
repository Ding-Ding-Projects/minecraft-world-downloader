import type { FunnyLevel } from '../../core/registry';

/**
 * The three sample messages the live preview renders.
 *
 * They exist so a person can see, before they commit to a humour level, exactly
 * what that level does to the copy they will actually be reading — including the
 * two categories nobody wants a surprise from: a destructive warning and an
 * error.
 *
 * Two rules govern everything in this file.
 *
 * The FACTS are identical at every rung. Level 5 is allowed to be as playful as
 * it likes about the telling, and it still names the same file, the same count,
 * the same host and port, the same consequence and the same recovery. Each
 * sample declares those facts as literal tokens, and `verifySample` checks every
 * rung against them — so the claim "voice changes, facts never do" is a test
 * this feature runs and reports, not a sentence in a document.
 *
 * They are EXAMPLES and are labelled as such wherever they are rendered. Nothing
 * here describes something that has happened: no world was saved, no profile is
 * being deleted and no connection was refused. A preview that reads as a real
 * event is a lie told in a nice font.
 */

export type SampleId = 'info' | 'destructive' | 'error';

/** One string per humour level, 1 (fully professional) through 5. */
export type SampleLadder = [string, string, string, string, string];

export interface Sample {
  id: SampleId;
  /** i18n key for the category name shown above the sample. */
  categoryKey: string;
  /**
   * The one decorative emoji this category is allowed, and only inside a dialog
   * or message box, and only while the emoji switch is on. It never reaches a
   * button, a field label or an accessible name.
   */
  emoji: string;
  en: SampleLadder;
  yue: SampleLadder;
  /** Literal tokens every rung of that language must contain, case-insensitively. */
  facts: { en: string[]; yue: string[] };
}

export const SAMPLES: Sample[] = [
  {
    id: 'info',
    categoryKey: 'language.sample.info',
    emoji: 'ℹ️',
    facts: {
      en: ['128', 'worlds/example'],
      yue: ['128', 'worlds/example']
    },
    en: [
      'Saved 128 chunks to worlds/example.',
      'Saved 128 chunks to worlds/example. Nothing else was changed.',
      '128 chunks are on disk now, in worlds/example.',
      '128 chunks made it into worlds/example, and not one of them went missing.',
      'All 128 chunks are tucked safely into worlds/example. Nothing else was touched, so you can go back to what you were doing.'
    ],
    yue: [
      '已經儲存咗 128 個區塊入 worlds/example。',
      '已經儲存咗 128 個區塊入 worlds/example，其他嘢冇郁過。',
      '128 個區塊而家已經落咗硬碟，喺 worlds/example 度。',
      '128 個區塊全部安全到咗 worlds/example，一個都冇甩漏。',
      '128 個區塊乖乖噉瞓晒喺 worlds/example，一個都冇少，其他嘢一律冇郁，你可以繼續做返你嘅嘢。'
    ]
  },
  {
    id: 'destructive',
    categoryKey: 'language.sample.destructive',
    emoji: '🛑',
    facts: {
      en: ['3 download profiles', 'settings file', 'local history'],
      yue: ['3 個下載設定檔', '設定檔案', '本機紀錄']
    },
    en: [
      'Delete 3 download profiles. They are removed from the settings file. This cannot be undone here; the change is written to local history.',
      'Delete 3 download profiles. They leave the settings file for good. There is no undo in this window, though the change is written to local history.',
      'This deletes 3 download profiles. They go out of the settings file and do not come back from this window — local history is where the record of it lives.',
      'Straight up: 3 download profiles, gone from the settings file, and this window has no undo. Local history keeps the record.',
      'Say the word and 3 download profiles leave the settings file for good. This window has no undo button and never will. Local history keeps the record, so at least the deed is written down.'
    ],
    yue: [
      '刪除 3 個下載設定檔。佢哋會由設定檔案移走，喺呢個視窗冇得還原，改動會寫入本機紀錄。',
      '刪除 3 個下載設定檔。佢哋會永久離開設定檔案，呢個視窗冇還原掣，不過改動會寫入本機紀錄。',
      '呢下會刪走 3 個下載設定檔，佢哋由設定檔案除名，呢個視窗還原唔到，紀錄淨係留喺本機紀錄。',
      '講明先：3 個下載設定檔，由設定檔案永久消失，呢個視窗冇還原掣。本機紀錄會幫你記住呢件事。',
      '你一聲令下，3 個下載設定檔就會喺設定檔案永久消失，呢個視窗冇後悔藥，以後都唔會有。本機紀錄會白紙黑字寫住，起碼件事有得查。'
    ]
  },
  {
    id: 'error',
    categoryKey: 'language.sample.error',
    emoji: '⚠️',
    facts: {
      en: ['127.0.0.1:25565', 'ECONNREFUSED', 'Nothing was downloaded'],
      yue: ['127.0.0.1:25565', 'ECONNREFUSED', '未下載到任何嘢']
    },
    en: [
      'The connection to 127.0.0.1:25565 was refused (ECONNREFUSED). Nothing was downloaded. Start the server or change the port, then try again.',
      '127.0.0.1:25565 refused the connection (ECONNREFUSED). Nothing was downloaded. Start the server or change the port, then try again.',
      '127.0.0.1:25565 said no: ECONNREFUSED. Nothing was downloaded, so nothing is half-written. Start the server or change the port, then try again.',
      '127.0.0.1:25565 shut the door in our face — ECONNREFUSED. Nothing was downloaded, so there is nothing half-written to clean up. Start the server or change the port, then try again.',
      '127.0.0.1:25565 would not even say hello: ECONNREFUSED, a flat refusal. Nothing was downloaded, so there is nothing half-written to clean up. Start the server or change the port, and we will have another go.'
    ],
    yue: [
      '連線去 127.0.0.1:25565 俾人拒絕咗（ECONNREFUSED）。未下載到任何嘢。開返個伺服器或者改個埠，然後再試。',
      '127.0.0.1:25565 拒絕咗連線（ECONNREFUSED）。未下載到任何嘢。開返個伺服器或者改個埠，然後再試。',
      '127.0.0.1:25565 話唔得：ECONNREFUSED。未下載到任何嘢，所以冇寫到一半嘅檔案。開返個伺服器或者改個埠，再試過。',
      '127.0.0.1:25565 直接閂門唔理我哋 —— ECONNREFUSED。未下載到任何嘢，所以冇手尾要執。開返個伺服器或者改個埠，再試過。',
      '127.0.0.1:25565 連聲「你好」都唔講，直接 ECONNREFUSED。未下載到任何嘢，所以冇寫到一半嘅檔案要執手尾。開返個伺服器或者改個埠，我哋再嚟過。'
    ]
  }
];

/**
 * The chrome around the samples in a preview screen.
 *
 * A preview made only of message boxes would not show the thing bilingual mode
 * most needs checking for, which is a heading and a row of action labels sharing
 * one narrow column. These ladders exist so the matrix can render a screen at an
 * arbitrary level rather than only at the level currently in force.
 *
 * The action labels are the honest half of the demonstration: the wording is
 * allowed to relax, and the destructive one still says exactly what it deletes
 * at every rung, because a label a person has to decode is a broken label.
 */
export const CHROME = {
  title: {
    en: [
      'Download a world',
      'Download a world',
      'Download a world',
      'Grab yourself a world',
      'Grab yourself a world'
    ] as SampleLadder,
    yue: ['下載世界', '下載世界', '下載世界', '執個世界返嚟', '執個世界返嚟'] as SampleLadder
  },
  supporting: {
    en: [
      'The proxy records every chunk the server sends while you play.',
      'The proxy records every chunk the server sends while you play.',
      'Play as normal. The proxy writes down every chunk the server sends.',
      'Just play. The proxy is behind you writing down every chunk the server sends.',
      'Just play. The proxy sits behind you writing down every single chunk the server sends, and never says a word about it.'
    ] as SampleLadder,
    yue: [
      '你玩緊嘅時候，代理會記低伺服器送過嚟嘅每一個區塊。',
      '你玩緊嘅時候，代理會記低伺服器送過嚟嘅每一個區塊。',
      '照玩就得，代理會幫你記低伺服器送過嚟嘅每一個區塊。',
      '你照玩，代理喺你後面一個一個區塊噉抄低伺服器送過嚟嘅嘢。',
      '你照玩就得，代理喺你後面靜靜雞逐個區塊抄低伺服器送過嚟嘅嘢，一聲都唔會嘈你。'
    ] as SampleLadder
  },
  actions: [
    {
      en: ['Start', 'Start', 'Start', 'Start it up', 'Start it up'] as SampleLadder,
      yue: ['開始', '開始', '開始', '開工', '開工'] as SampleLadder
    },
    {
      en: ['Cancel', 'Cancel', 'Cancel', 'Not now', 'Not now'] as SampleLadder,
      yue: ['取消', '取消', '取消', '唔使喇', '唔使喇'] as SampleLadder
    },
    {
      // A destructive label names what it deletes at every rung. There is no
      // level at which "Delete profile" becomes a joke the reader has to decode.
      en: [
        'Delete profile',
        'Delete profile',
        'Delete profile',
        'Delete profile',
        'Delete profile'
      ] as SampleLadder,
      yue: ['刪除設定檔', '刪除設定檔', '刪除設定檔', '刪除設定檔', '刪除設定檔'] as SampleLadder
    }
  ]
};

export const SAMPLE_LEVELS: FunnyLevel[] = [1, 2, 3, 4, 5];

/** Clamps anything a corrupted stored value could hold into a real rung. */
export function clampLevel(value: unknown): FunnyLevel {
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric)) return 3;
  return Math.min(5, Math.max(1, numeric)) as FunnyLevel;
}

/** The raw rung, before vocabulary replacement and before emoji decoration. */
export function sampleText(sample: Sample, language: 'en' | 'yue', level: FunnyLevel): string {
  const ladder = language === 'en' ? sample.en : sample.yue;
  return ladder[clampLevel(level) - 1];
}

export interface FactCheck {
  sampleId: SampleId;
  language: 'en' | 'yue';
  level: FunnyLevel;
  /** Fact tokens this rung failed to carry. Empty means the rung is correct. */
  missing: string[];
}

/**
 * Checks every rung of every sample against its declared facts.
 *
 * This runs in the interface rather than only in a test, because the claim it
 * proves is one a reader is entitled to check for themselves: the humour level
 * cannot quietly drop the port number at level 5.
 */
export function verifySamples(): FactCheck[] {
  const results: FactCheck[] = [];
  for (const sample of SAMPLES) {
    for (const language of ['en', 'yue'] as const) {
      for (const level of SAMPLE_LEVELS) {
        const text = sampleText(sample, language, level).toLowerCase();
        const missing = sample.facts[language].filter((fact) => !text.includes(fact.toLowerCase()));
        results.push({ sampleId: sample.id, language, level, missing });
      }
    }
  }
  return results;
}
