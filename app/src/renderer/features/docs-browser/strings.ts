import type { Catalogue } from '../../core/registry';

/**
 * Every user-facing string this feature renders, in English and playful Hong
 * Kong Cantonese, at all five humour levels.
 *
 * The two ladders are independent — English at 1 beside Cantonese at 5 is a
 * combination somebody will choose, and both halves have to read correctly in
 * it. Humour styles the voice and never the facts: an article count, a category,
 * a file path, a byte figure and a checksum say exactly the same thing at level
 * 5 as at level 1, because a reader who cannot tell which article failed its
 * integrity check has been entertained instead of informed.
 */

export const STRINGS: Catalogue = {
  'docs-browser.tab': {
    en: ['Documentation', 'Documentation', 'Documentation', 'The manual', 'The manual'],
    yue: ['說明文件', '說明文件', '說明文件', '說明書喺呢度', '說明書喺呢度']
  },
  'docs-browser.subtitle': {
    en: [
      '{count} articles compiled into this build. Nothing is downloaded.',
      '{count} articles compiled into this build. Nothing is downloaded.',
      '{count} articles, built right in. Nothing is downloaded.',
      '{count} articles baked into the build — not one byte comes off the internet.',
      '{count} articles baked into the build — not one byte comes off the internet.'
    ],
    yue: [
      '呢個版本入面編譯咗 {count} 篇文章，唔會download任何嘢。',
      '呢個版本入面編譯咗 {count} 篇文章，唔會download任何嘢。',
      '{count} 篇文章直接砌咗入去，唔使上網download。',
      '{count} 篇文章早就焗晒入個build度，一個byte都唔使上網攞。',
      '{count} 篇文章早就焗晒入個build度，一個byte都唔使上網攞。'
    ]
  },
  'docs-browser.search': {
    en: [
      'Search the documentation',
      'Search the documentation',
      'Search the documentation',
      'Search the manual — titles and every word inside them',
      'Search the manual — titles and every word inside them'
    ],
    yue: ['搜尋說明文件', '搜尋說明文件', '搵下啲說明文件', '喺說明書入面搵，標題同埋入面每隻字都搵', '喺說明書入面搵，標題同埋入面每隻字都搵']
  },
  'docs-browser.search.placeholder': {
    en: ['Search titles and bodies…', 'Search titles and bodies…', 'Search titles and bodies…', 'Type a word, watch the list thin out…', 'Type a word, watch the list thin out…'],
    yue: ['搵標題同內文…', '搵標題同內文…', '搵標題同內文…', '打隻字落去，睇住個list瘦晒…', '打隻字落去，睇住個list瘦晒…']
  },
  'docs-browser.index.label': {
    en: ['Article index', 'Article index', 'Article index', 'The list of articles', 'The list of articles'],
    yue: ['文章目錄', '文章目錄', '文章目錄', '成份文章清單', '成份文章清單']
  },
  'docs-browser.article.label': {
    en: ['Article', 'Article', 'Article', 'The article itself', 'The article itself'],
    yue: ['文章', '文章', '文章', '文章本身', '文章本身']
  },
  'docs-browser.splitter': {
    en: [
      'Resize the index pane',
      'Resize the index pane',
      'Resize the index pane',
      'Drag me, or use the arrow keys, to resize the index',
      'Drag me, or use the arrow keys, to resize the index'
    ],
    yue: ['調整目錄闊度', '調整目錄闊度', '調整目錄闊度', '拉我，或者撳方向鍵，調個目錄闊度', '拉我，或者撳方向鍵，調個目錄闊度']
  },
  'docs-browser.splitter.reset': {
    en: ['Reset the layout', 'Reset the layout', 'Reset the layout', 'Put the panes back where they started', 'Put the panes back where they started'],
    yue: ['重設版面', '重設版面', '重設版面', '將兩邊擺返原位', '將兩邊擺返原位']
  },
  'docs-browser.back': {
    en: ['Back', 'Back', 'Back', 'Back one article', 'Back one article'],
    yue: ['返上一篇', '返上一篇', '返上一篇', '退返上一篇', '退返上一篇']
  },
  'docs-browser.forward': {
    en: ['Forward', 'Forward', 'Forward', 'Forward one article', 'Forward one article'],
    yue: ['去下一篇', '去下一篇', '去下一篇', '前進一篇', '前進一篇']
  },
  'docs-browser.nav.noBack': {
    en: [
      'There is nothing earlier in this session to go back to.',
      'There is nothing earlier in this session to go back to.',
      'Nothing earlier this session to go back to.',
      'Nothing behind you yet — this is the first article you have opened this session.',
      'Nothing behind you yet — this is the first article you have opened this session.'
    ],
    yue: [
      '今次開咗個app之後未去過第二篇，冇得返轉頭。',
      '今次開咗個app之後未去過第二篇，冇得返轉頭。',
      '今次仲未去過第二篇，冇得返轉頭。',
      '後面乜都冇——呢篇係你今次開嘅第一篇。',
      '後面乜都冇——呢篇係你今次開嘅第一篇。'
    ]
  },
  'docs-browser.nav.noForward': {
    en: [
      'There is nothing further forward to go to.',
      'There is nothing further forward to go to.',
      'Nothing further forward to go to.',
      'Nothing ahead of you — you are at the newest article in the trail.',
      'Nothing ahead of you — you are at the newest article in the trail.'
    ],
    yue: ['前面冇嘢好去。', '前面冇嘢好去。', '前面冇嘢好去。', '前面空空如也——你已經喺條路最尾嗰篇。', '前面空空如也——你已經喺條路最尾嗰篇。']
  },
  'docs-browser.open': {
    en: ['Open this article', 'Open this article', 'Open this article', 'Open this one up', 'Open this one up'],
    yue: ['開呢篇', '開呢篇', '開呢篇', '打開嚟睇', '打開嚟睇']
  },
  'docs-browser.select': {
    en: ['Select for a bulk action', 'Select for a bulk action', 'Select for a bulk action', 'Tick it for a bulk action', 'Tick it for a bulk action'],
    yue: ['揀嚟做批次操作', '揀嚟做批次操作', '揀嚟做批次操作', '剔咗佢，等陣一次過搞', '剔咗佢，等陣一次過搞']
  },
  'docs-browser.read': {
    en: ['Read', 'Read', 'Read', 'Read it already', 'Read it already'],
    yue: ['睇咗', '睇咗', '睇咗', '呢篇睇咗喇', '呢篇睇咗喇']
  },
  'docs-browser.bookmark': {
    en: ['Bookmark', 'Bookmark', 'Bookmark', 'Keep a bookmark on it', 'Keep a bookmark on it'],
    yue: ['書籤', '書籤', '書籤', '幫佢夾個書籤', '幫佢夾個書籤']
  },
  'docs-browser.bookmarked': {
    en: ['Bookmarked', 'Bookmarked', 'Bookmarked', 'Bookmarked', 'Bookmarked'],
    yue: ['已加書籤', '已加書籤', '已加書籤', '夾咗書籤', '夾咗書籤']
  },
  'docs-browser.outline': {
    en: ['On this page', 'On this page', 'On this page', 'What is on this page', 'What is on this page'],
    yue: ['本頁內容', '本頁內容', '本頁內容', '呢版有咩', '呢版有咩']
  },
  'docs-browser.outline.unavailable': {
    en: [
      'The heading outline is not shown for this article: its headings could not be matched to the rendered page.',
      'The heading outline is not shown for this article: its headings could not be matched to the rendered page.',
      'No outline for this one: the headings did not line up with the rendered page.',
      'No outline here. The recorded headings did not line up with the rendered page, and an outline whose links go nowhere is worse than none.',
      'No outline here. The recorded headings did not line up with the rendered page, and an outline whose links go nowhere is worse than none.'
    ],
    yue: [
      '呢篇唔顯示標題大綱：記錄嘅標題同實際排版對唔上。',
      '呢篇唔顯示標題大綱：記錄嘅標題同實際排版對唔上。',
      '呢篇冇大綱：啲標題同排出嚟嘅對唔上。',
      '呢篇冇大綱。記錄嘅標題同排出嚟嘅對唔上，而一個撳落去乜都冇嘅大綱，仲衰過冇。',
      '呢篇冇大綱。記錄嘅標題同排出嚟嘅對唔上，而一個撳落去乜都冇嘅大綱，仲衰過冇。'
    ]
  },
  'docs-browser.related': {
    en: ['Suggested articles', 'Suggested articles', 'Suggested articles', 'Where to go next', 'Where to go next'],
    yue: ['推薦文章', '推薦文章', '推薦文章', '跟住睇邊篇好', '跟住睇邊篇好']
  },
  'docs-browser.alsoInCategory': {
    en: ['Also in {category}', 'Also in {category}', 'Also in {category}', 'The neighbours in {category}', 'The neighbours in {category}'],
    yue: ['「{category}」入面仲有', '「{category}」入面仲有', '「{category}」入面仲有', '「{category}」隔籬仲有呢啲', '「{category}」隔籬仲有呢啲']
  },
  'docs-browser.related.missing': {
    en: [
      'This article has not been written yet.',
      'This article has not been written yet.',
      'That article does not exist yet.',
      'That one has not been written yet — the link is honest about it rather than pretending.',
      'That one has not been written yet — the link is honest about it rather than pretending.'
    ],
    yue: ['呢篇仲未寫。', '呢篇仲未寫。', '呢篇仲未寫出嚟。', '嗰篇仲未寫——所以直接話你知，唔會扮到似層層。', '嗰篇仲未寫——所以直接話你知，唔會扮到似層層。']
  },
  'docs-browser.meta': {
    en: [
      '{minutes} min read · {size} · {category}',
      '{minutes} min read · {size} · {category}',
      '{minutes} min read · {size} · {category}',
      '{minutes} min read · {size} · {category}',
      '{minutes} min read · {size} · {category}'
    ],
    yue: ['讀約 {minutes} 分鐘 · {size} · {category}', '讀約 {minutes} 分鐘 · {size} · {category}', '讀約 {minutes} 分鐘 · {size} · {category}', '讀約 {minutes} 分鐘 · {size} · {category}', '讀約 {minutes} 分鐘 · {size} · {category}']
  },
  'docs-browser.source': {
    en: ['Source: {file}', 'Source: {file}', 'Source: {file}', 'Written in {file}', 'Written in {file}'],
    yue: ['原始檔：{file}', '原始檔：{file}', '原始檔：{file}', '正本喺 {file}', '正本喺 {file}']
  },
  'docs-browser.source.module': {
    en: [
      'Registered by a feature module rather than bundled from a file.',
      'Registered by a feature module rather than bundled from a file.',
      'Registered by a feature module, not bundled from a file.',
      'This one comes from a feature module in code, not from a Markdown file on disk.',
      'This one comes from a feature module in code, not from a Markdown file on disk.'
    ],
    yue: [
      '呢篇由功能模組登記，唔係由檔案打包入嚟。',
      '呢篇由功能模組登記，唔係由檔案打包入嚟。',
      '呢篇由功能模組登記，唔係由檔案打包。',
      '呢篇係程式碼入面嘅功能模組登記嘅，唔係硬碟上面嘅 Markdown 檔。',
      '呢篇係程式碼入面嘅功能模組登記嘅，唔係硬碟上面嘅 Markdown 檔。'
    ]
  },
  'docs-browser.hits': {
    en: [
      '{count} matches in the body',
      '{count} matches in the body',
      '{count} matches in the body',
      '{count} hits inside this one',
      '{count} hits inside this one'
    ],
    yue: ['內文有 {count} 個match', '內文有 {count} 個match', '內文有 {count} 個match', '呢篇入面中咗 {count} 次', '呢篇入面中咗 {count} 次']
  },
  'docs-browser.matchCount': {
    en: [
      '{count} of {total} articles shown.',
      '{count} of {total} articles shown.',
      '{count} of {total} articles shown.',
      'Showing {count} of {total} articles.',
      'Showing {count} of {total} articles.'
    ],
    yue: ['顯示緊 {total} 篇入面嘅 {count} 篇。', '顯示緊 {total} 篇入面嘅 {count} 篇。', '顯示緊 {total} 篇入面嘅 {count} 篇。', '而家 {total} 篇入面show緊 {count} 篇。', '而家 {total} 篇入面show緊 {count} 篇。']
  },
  'docs-browser.selection': {
    en: [
      '{count} selected of {shown} shown, {total} in all.',
      '{count} selected of {shown} shown, {total} in all.',
      '{count} selected of {shown} shown, {total} in all.',
      '{count} ticked, out of {shown} on screen and {total} altogether.',
      '{count} ticked, out of {shown} on screen and {total} altogether.'
    ],
    yue: [
      '揀咗 {count} 篇；畫面上有 {shown} 篇，總共 {total} 篇。',
      '揀咗 {count} 篇；畫面上有 {shown} 篇，總共 {total} 篇。',
      '揀咗 {count} 篇；畫面上有 {shown} 篇，總共 {total} 篇。',
      '剔咗 {count} 篇；畫面得 {shown} 篇，全部有 {total} 篇。',
      '剔咗 {count} 篇；畫面得 {shown} 篇，全部有 {total} 篇。'
    ]
  },
  'docs-browser.selectShown': {
    en: ['Select the {count} shown', 'Select the {count} shown', 'Select the {count} shown', 'Tick the {count} on screen', 'Tick the {count} on screen'],
    yue: ['揀晒畫面嗰 {count} 篇', '揀晒畫面嗰 {count} 篇', '揀晒畫面嗰 {count} 篇', '剔晒畫面上嗰 {count} 篇', '剔晒畫面上嗰 {count} 篇']
  },
  'docs-browser.selectEvery': {
    en: ['Select every one of {count}', 'Select every one of {count}', 'Select every one of {count}', 'Tick all {count}, filter or no filter', 'Tick all {count}, filter or no filter'],
    yue: ['揀晒全部 {count} 篇', '揀晒全部 {count} 篇', '揀晒全部 {count} 篇', '唔理篩選，{count} 篇全部剔晒', '唔理篩選，{count} 篇全部剔晒']
  },
  'docs-browser.invert': {
    en: ['Invert the selection', 'Invert the selection', 'Invert the selection', 'Flip the selection round', 'Flip the selection round'],
    yue: ['反轉選擇', '反轉選擇', '反轉選擇', '調轉晒嚟揀', '調轉晒嚟揀']
  },
  'docs-browser.clearSelection': {
    en: ['Clear the selection', 'Clear the selection', 'Clear the selection', 'Untick everything', 'Untick everything'],
    yue: ['清除選擇', '清除選擇', '清除選擇', '全部唔剔', '全部唔剔']
  },
  'docs-browser.bulk.markRead': {
    en: ['Mark read', 'Mark read', 'Mark read', 'Mark them read', 'Mark them read'],
    yue: ['標記為睇咗', '標記為睇咗', '標記為睇咗', '標晒佢哋做睇咗', '標晒佢哋做睇咗']
  },
  'docs-browser.bulk.markUnread': {
    en: ['Mark unread', 'Mark unread', 'Mark unread', 'Mark them unread again', 'Mark them unread again'],
    yue: ['標記為未睇', '標記為未睇', '標記為未睇', '標返佢哋做未睇', '標返佢哋做未睇']
  },
  'docs-browser.bulk.bookmark': {
    en: ['Bookmark', 'Bookmark', 'Bookmark', 'Bookmark the lot', 'Bookmark the lot'],
    yue: ['加書籤', '加書籤', '加書籤', '成堆都夾書籤', '成堆都夾書籤']
  },
  'docs-browser.bulk.unbookmark': {
    en: ['Remove bookmark', 'Remove bookmark', 'Remove bookmark', 'Take the bookmarks off', 'Take the bookmarks off'],
    yue: ['移除書籤', '移除書籤', '移除書籤', '啲書籤攞晒走', '啲書籤攞晒走']
  },
  'docs-browser.bulk.copy': {
    en: ['Copy as Markdown', 'Copy as Markdown', 'Copy as Markdown', 'Copy the lot as Markdown', 'Copy the lot as Markdown'],
    yue: ['複製做 Markdown', '複製做 Markdown', '複製做 Markdown', '成堆copy做 Markdown', '成堆copy做 Markdown']
  },
  'docs-browser.bulk.export': {
    en: ['Export…', 'Export…', 'Export…', 'Export the lot…', 'Export the lot…'],
    yue: ['匯出…', '匯出…', '匯出…', '成堆匯出…', '成堆匯出…']
  },
  'docs-browser.bulk.none': {
    en: [
      'Select at least one article first.',
      'Select at least one article first.',
      'Pick at least one article first.',
      'Nothing is ticked yet, so there is nothing to do it to.',
      'Nothing is ticked yet, so there is nothing to do it to.'
    ],
    yue: ['請先揀最少一篇文章。', '請先揀最少一篇文章。', '起碼揀一篇先。', '一篇都未剔，冇嘢好做喎。', '一篇都未剔，冇嘢好做喎。']
  },
  'docs-browser.bulk.done': {
    en: [
      '{count} articles updated.',
      '{count} articles updated.',
      '{count} articles updated.',
      '{count} articles updated. Recorded in local history, so it can be undone.',
      '{count} articles updated. Recorded in local history, so it can be undone.'
    ],
    yue: [
      '更新咗 {count} 篇。',
      '更新咗 {count} 篇。',
      '更新咗 {count} 篇。',
      '更新咗 {count} 篇，已經寫入本機歷史，想返轉頭都得。',
      '更新咗 {count} 篇，已經寫入本機歷史，想返轉頭都得。'
    ]
  },
  'docs-browser.bulk.noChange': {
    en: [
      'Nothing changed: the {count} selected articles were already in that state.',
      'Nothing changed: the {count} selected articles were already in that state.',
      'Nothing changed — those {count} were already like that.',
      'Nothing changed. All {count} were already in that state, so no history entry was written either.',
      'Nothing changed. All {count} were already in that state, so no history entry was written either.'
    ],
    yue: [
      '冇變動：揀咗嘅 {count} 篇本身已經係咁。',
      '冇變動：揀咗嘅 {count} 篇本身已經係咁。',
      '冇變動——嗰 {count} 篇本身已經係咁。',
      '冇變動。{count} 篇本身已經係咁，所以連歷史記錄都冇寫。',
      '冇變動。{count} 篇本身已經係咁，所以連歷史記錄都冇寫。'
    ]
  },
  'docs-browser.clearAll': {
    en: [
      'Clear every read mark and bookmark',
      'Clear every read mark and bookmark',
      'Clear every read mark and bookmark',
      'Wipe every read mark and bookmark',
      'Wipe every read mark and bookmark'
    ],
    yue: ['清除所有已讀標記同書籤', '清除所有已讀標記同書籤', '清除所有已讀標記同書籤', '一次過抹晒所有已讀標記同書籤', '一次過抹晒所有已讀標記同書籤']
  },
  'docs-browser.clearAll.done': {
    en: [
      'Cleared {read} read marks and {bookmarks} bookmarks.',
      'Cleared {read} read marks and {bookmarks} bookmarks.',
      'Cleared {read} read marks and {bookmarks} bookmarks.',
      'Cleared {read} read marks and {bookmarks} bookmarks. It is in local history if you want it back.',
      'Cleared {read} read marks and {bookmarks} bookmarks. It is in local history if you want it back.'
    ],
    yue: [
      '清除咗 {read} 個已讀標記同 {bookmarks} 個書籤。',
      '清除咗 {read} 個已讀標記同 {bookmarks} 個書籤。',
      '清除咗 {read} 個已讀標記同 {bookmarks} 個書籤。',
      '清除咗 {read} 個已讀標記同 {bookmarks} 個書籤，本機歷史度仲有得攞返。',
      '清除咗 {read} 個已讀標記同 {bookmarks} 個書籤，本機歷史度仲有得攞返。'
    ]
  },
  'docs-browser.clearAll.empty': {
    en: [
      'There are no read marks or bookmarks to clear.',
      'There are no read marks or bookmarks to clear.',
      'No read marks or bookmarks to clear.',
      'Nothing to clear — no read marks, no bookmarks.',
      'Nothing to clear — no read marks, no bookmarks.'
    ],
    yue: ['冇已讀標記或者書籤可以清除。', '冇已讀標記或者書籤可以清除。', '冇已讀標記或者書籤好清。', '冇嘢好清——冇已讀標記，冇書籤。', '冇嘢好清——冇已讀標記，冇書籤。']
  },
  'docs-browser.copy.ok': {
    en: [
      '{count} articles copied to the clipboard as Markdown.',
      '{count} articles copied to the clipboard as Markdown.',
      '{count} articles copied to the clipboard as Markdown.',
      '{count} articles are on the clipboard, as Markdown, ready to paste.',
      '{count} articles are on the clipboard, as Markdown, ready to paste.'
    ],
    yue: [
      '已將 {count} 篇以 Markdown 複製到剪貼簿。',
      '已將 {count} 篇以 Markdown 複製到剪貼簿。',
      '已將 {count} 篇以 Markdown 複製到剪貼簿。',
      '{count} 篇已經以 Markdown 入咗剪貼簿，隨時可以貼。',
      '{count} 篇已經以 Markdown 入咗剪貼簿，隨時可以貼。'
    ]
  },
  'docs-browser.copy.fail': {
    en: [
      'The clipboard refused the copy: {reason}. Nothing was copied.',
      'The clipboard refused the copy: {reason}. Nothing was copied.',
      'The clipboard refused it: {reason}. Nothing was copied.',
      'The clipboard would not take it: {reason}. Nothing was copied — no point pretending otherwise.',
      'The clipboard would not take it: {reason}. Nothing was copied — no point pretending otherwise.'
    ],
    yue: [
      '剪貼簿唔收：{reason}。乜都冇copy到。',
      '剪貼簿唔收：{reason}。乜都冇copy到。',
      '剪貼簿唔收：{reason}。乜都冇copy到。',
      '剪貼簿唔肯收：{reason}。乜都冇copy到——扮成功都冇意思。',
      '剪貼簿唔肯收：{reason}。乜都冇copy到——扮成功都冇意思。'
    ]
  },
  'docs-browser.export.saved': {
    en: ['Saved to {path}', 'Saved to {path}', 'Saved to {path}', 'Written to {path}', 'Written to {path}'],
    yue: ['已儲存到 {path}', '已儲存到 {path}', '已儲存到 {path}', '寫咗落 {path}', '寫咗落 {path}']
  },
  'docs-browser.export.format': {
    en: ['Export format', 'Export format', 'Export format', 'Which format to export in', 'Which format to export in'],
    yue: ['匯出格式', '匯出格式', '匯出格式', '要匯出成咩格式', '要匯出成咩格式']
  },
  'docs-browser.export.losses': {
    en: [
      'This format cannot carry: {fields}. The rest is exported in full.',
      'This format cannot carry: {fields}. The rest is exported in full.',
      'This format cannot carry: {fields}. Everything else goes.',
      'Heads up — this format cannot carry: {fields}. Everything else is exported in full.',
      'Heads up — this format cannot carry: {fields}. Everything else is exported in full.'
    ],
    yue: [
      '呢個格式載唔到：{fields}。其餘全部照樣匯出。',
      '呢個格式載唔到：{fields}。其餘全部照樣匯出。',
      '呢個格式載唔到：{fields}。其他全部照出。',
      '提提你——呢個格式載唔到：{fields}。其他嘢照樣完整匯出。',
      '提提你——呢個格式載唔到：{fields}。其他嘢照樣完整匯出。'
    ]
  },
  'docs-browser.link.outside': {
    en: [
      'That link points outside the bundled documentation: {target}',
      'That link points outside the bundled documentation: {target}',
      'That link points outside the bundled documentation: {target}',
      'That link leads out of the bundle: {target}. Nothing here can open it, so here is exactly where it pointed.',
      'That link leads out of the bundle: {target}. Nothing here can open it, so here is exactly where it pointed.'
    ],
    yue: [
      '呢條link指去打包範圍以外：{target}',
      '呢條link指去打包範圍以外：{target}',
      '呢條link指去打包範圍以外：{target}',
      '呢條link去咗打包範圍以外：{target}。呢度開唔到，所以直接話你知佢指去邊。',
      '呢條link去咗打包範圍以外：{target}。呢度開唔到，所以直接話你知佢指去邊。'
    ]
  },
  'docs-browser.empty.noArticles': {
    en: [
      'No articles are bundled in this build.',
      'No articles are bundled in this build.',
      'No articles are bundled in this build.',
      'This build has no articles in it at all, which should never happen — the build guard is meant to stop exactly that.',
      'This build has no articles in it at all, which should never happen — the build guard is meant to stop exactly that.'
    ],
    yue: [
      '呢個版本冇打包任何文章。',
      '呢個版本冇打包任何文章。',
      '呢個版本冇打包任何文章。',
      '呢個build入面一篇文章都冇，正常唔應該發生——個build guard就係為咗擋呢件事。',
      '呢個build入面一篇文章都冇，正常唔應該發生——個build guard就係為咗擋呢件事。'
    ]
  },
  'docs-browser.empty.noMatches': {
    en: [
      'No article matches that search.',
      'No article matches that search.',
      'No article matches that search.',
      'Not one article matches that. Try a shorter word, or clear the field.',
      'Not one article matches that. Try a shorter word, or clear the field.'
    ],
    yue: ['冇文章match到呢個搜尋。', '冇文章match到呢個搜尋。', '冇文章match到。', '一篇都match唔到。試下打短啲，或者清空個格。', '一篇都match唔到。試下打短啲，或者清空個格。']
  },
  'docs-browser.empty.pick': {
    en: [
      'Choose an article from the index to read it here.',
      'Choose an article from the index to read it here.',
      'Pick an article from the index to read it here.',
      'Pick something from the index on the left and it appears here.',
      'Pick something from the index on the left and it appears here.'
    ],
    yue: [
      '喺目錄揀一篇，就會喺呢度顯示。',
      '喺目錄揀一篇，就會喺呢度顯示。',
      '喺目錄揀一篇，就會喺呢度顯示。',
      '喺左邊目錄揀樣嘢，佢就會喺呢度出現。',
      '喺左邊目錄揀樣嘢，佢就會喺呢度出現。'
    ]
  },
  'docs-browser.empty.body': {
    en: [
      'No text was provided for this article.',
      'No text was provided for this article.',
      'No text was provided for this article.',
      'This article carries no text at all. That is what it says rather than a blank space that reads as a loading failure.',
      'This article carries no text at all. That is what it says rather than a blank space that reads as a loading failure.'
    ],
    yue: [
      '呢篇文章冇提供任何內文。',
      '呢篇文章冇提供任何內文。',
      '呢篇文章冇提供任何內文。',
      '呢篇一個字都冇。所以直接寫明，好過留一片空白令你以為載唔到。',
      '呢篇一個字都冇。所以直接寫明，好過留一片空白令你以為載唔到。'
    ]
  },
  'docs-browser.integrity.title': {
    en: ['Verify the bundle now', 'Verify the bundle now', 'Verify the bundle now', 'Check the bundle over right now', 'Check the bundle over right now'],
    yue: ['即刻驗證打包內容', '即刻驗證打包內容', '即刻驗證打包內容', '而家即刻查一次個bundle', '而家即刻查一次個bundle']
  },
  'docs-browser.integrity.description': {
    en: [
      'Recomputes each bundled article’s checksum and byte length from its own text and compares them with the values recorded when the bundle was written. It catches a generated file that was truncated, hand-edited or badly merged after the build. It cannot see the files on disk; that comparison is the build guard’s job.',
      'Recomputes each bundled article’s checksum and byte length from its own text and compares them with the values recorded when the bundle was written. It catches a generated file that was truncated, hand-edited or badly merged after the build. It cannot see the files on disk; that comparison is the build guard’s job.',
      'Recomputes each article’s checksum and byte length from its own text and compares them with what was recorded at build time. It catches a generated file that was truncated or hand-edited. It cannot see the files on disk — that is the build guard’s job.',
      'Recomputes every article’s checksum and byte length from its own text and holds them against what was written down at build time, which catches a generated file somebody truncated, hand-edited or merged badly. It cannot see your disk, mind: comparing against the real Markdown files is the build guard’s job.',
      'Recomputes every article’s checksum and byte length from its own text and holds them against what was written down at build time, which catches a generated file somebody truncated, hand-edited or merged badly. It cannot see your disk, mind: comparing against the real Markdown files is the build guard’s job.'
    ],
    yue: [
      '重新計算每篇打包文章嘅checksum同byte數，同打包時記低嘅數值比較，可以捉到build完之後被截斷、手改或者merge錯嘅generated檔。佢睇唔到硬碟上面嘅檔案，嗰部分係build guard負責。',
      '重新計算每篇打包文章嘅checksum同byte數，同打包時記低嘅數值比較，可以捉到build完之後被截斷、手改或者merge錯嘅generated檔。佢睇唔到硬碟上面嘅檔案，嗰部分係build guard負責。',
      '重新計每篇文章嘅checksum同byte數，同build時記低嘅比對，捉到被截斷或者手改嘅generated檔。佢睇唔到你部機嘅檔案——嗰啲係build guard做。',
      '逐篇重新計checksum同byte數，同build嗰陣寫低嘅對數，捉得到俾人截斷、手改或者merge衰咗嘅generated檔。不過佢睇唔到你部機啲檔案㗎——同真正嘅 Markdown 對數係build guard嘅工作。',
      '逐篇重新計checksum同byte數，同build嗰陣寫低嘅對數，捉得到俾人截斷、手改或者merge衰咗嘅generated檔。不過佢睇唔到你部機啲檔案㗎——同真正嘅 Markdown 對數係build guard嘅工作。'
    ]
  },
  'docs-browser.integrity.ok': {
    en: [
      '{count} bundled articles verified, {size} of text, all checksums match.',
      '{count} bundled articles verified, {size} of text, all checksums match.',
      '{count} bundled articles verified, {size} of text, every checksum matches.',
      'All {count} bundled articles check out — {size} of text and not a checksum out of place.',
      'All {count} bundled articles check out — {size} of text and not a checksum out of place.'
    ],
    yue: [
      '已驗證 {count} 篇打包文章，共 {size} 內文，checksum 全部相符。',
      '已驗證 {count} 篇打包文章，共 {size} 內文，checksum 全部相符。',
      '已驗證 {count} 篇打包文章，共 {size} 內文，checksum 全部啱。',
      '{count} 篇打包文章全部過關——{size} 內文，冇一個 checksum 走位。',
      '{count} 篇打包文章全部過關——{size} 內文，冇一個 checksum 走位。'
    ]
  },
  'docs-browser.integrity.bad': {
    en: [
      '{count} bundled articles failed verification: {ids}. The rest are unaffected and still readable. Rebuild with the bundler to fix it.',
      '{count} bundled articles failed verification: {ids}. The rest are unaffected and still readable. Rebuild with the bundler to fix it.',
      '{count} bundled articles failed verification: {ids}. The rest are fine and still readable. Rebuild with the bundler to fix it.',
      '{count} bundled articles did not survive verification: {ids}. Every other article is untouched and still perfectly readable — a bad checksum is a reason to distrust one article, not to hide the rest. Rebuild with the bundler to fix it.',
      '{count} bundled articles did not survive verification: {ids}. Every other article is untouched and still perfectly readable — a bad checksum is a reason to distrust one article, not to hide the rest. Rebuild with the bundler to fix it.'
    ],
    yue: [
      '{count} 篇打包文章驗證唔過：{ids}。其餘唔受影響，照樣睇得。用bundler重新build就搞掂。',
      '{count} 篇打包文章驗證唔過：{ids}。其餘唔受影響，照樣睇得。用bundler重新build就搞掂。',
      '{count} 篇打包文章驗證唔過：{ids}。其他冇事，照睇得。用bundler重新build就得。',
      '{count} 篇打包文章驗證唔過：{ids}。其他每篇都冇事，照樣睇得——checksum衰咗只係代表嗰一篇信唔過，唔係要收埋其餘全部。用bundler重新build就搞掂。',
      '{count} 篇打包文章驗證唔過：{ids}。其他每篇都冇事，照樣睇得——checksum衰咗只係代表嗰一篇信唔過，唔係要收埋其餘全部。用bundler重新build就搞掂。'
    ]
  },
  'docs-browser.integrity.warnTitle': {
    en: ['The bundled documentation failed its own check', 'The bundled documentation failed its own check', 'The bundled documentation failed its own check', 'The bundled documentation did not pass its own check', 'The bundled documentation did not pass its own check'],
    yue: ['打包嘅說明文件驗證唔過', '打包嘅說明文件驗證唔過', '打包嘅說明文件驗證唔過', '打包嘅說明文件過唔到自己個檢查', '打包嘅說明文件過唔到自己個檢查']
  },
  'docs-browser.settings.title': {
    en: ['Documentation', 'Documentation', 'Documentation', 'Documentation browser', 'Documentation browser'],
    yue: ['說明文件', '說明文件', '說明文件', '說明文件瀏覽器', '說明文件瀏覽器']
  },
  'docs-browser.setting.start': {
    en: ['Article to open first', 'Article to open first', 'Article to open first', 'Which article greets you', 'Which article greets you'],
    yue: ['最先開邊篇', '最先開邊篇', '最先開邊篇', '一入嚟見到邊篇', '一入嚟見到邊篇']
  },
  'docs-browser.setting.start.description': {
    en: [
      'Which article the documentation destination opens on. "Continue where I left off" reopens the last article you read; every other choice names a real article in this build, so the list can never point at one that does not exist.',
      'Which article the documentation destination opens on. "Continue where I left off" reopens the last article you read; every other choice names a real article in this build, so the list can never point at one that does not exist.',
      'Which article opens when you go to Documentation. "Continue where I left off" reopens the last one you read; every other choice names a real article in this build.',
      'Decides which article is waiting for you when you open Documentation. "Continue where I left off" reopens whatever you were last reading; every other option is drawn from the real bundle, so it can never offer you an article that is not there.',
      'Decides which article is waiting for you when you open Documentation. "Continue where I left off" reopens whatever you were last reading; every other option is drawn from the real bundle, so it can never offer you an article that is not there.'
    ],
    yue: [
      '決定入到說明文件時開邊篇。「接住上次嗰篇」會重開你最後睇嗰篇；其餘每個選項都係呢個版本入面真實存在嘅文章，所以永遠唔會指去一篇唔存在嘅嘢。',
      '決定入到說明文件時開邊篇。「接住上次嗰篇」會重開你最後睇嗰篇；其餘每個選項都係呢個版本入面真實存在嘅文章，所以永遠唔會指去一篇唔存在嘅嘢。',
      '入到說明文件開邊篇。「接住上次嗰篇」會重開你最後睇嗰篇；其他選項全部係呢個版本真實有嘅文章。',
      '話俾個app知你一開說明文件應該見到邊篇。「接住上次嗰篇」會幫你重開返上次睇嗰篇；其他選項全部由真實嘅bundle抽出嚟，所以永遠唔會俾一篇唔存在嘅文章你揀。',
      '話俾個app知你一開說明文件應該見到邊篇。「接住上次嗰篇」會幫你重開返上次睇嗰篇；其他選項全部由真實嘅bundle抽出嚟，所以永遠唔會俾一篇唔存在嘅文章你揀。'
    ]
  },
  'docs-browser.setting.start.last': {
    en: ['Continue where I left off', 'Continue where I left off', 'Continue where I left off', 'Continue where I left off', 'Continue where I left off'],
    yue: ['接住上次嗰篇', '接住上次嗰篇', '接住上次嗰篇', '接住上次嗰篇', '接住上次嗰篇']
  },
  'docs-browser.setting.searchBodies': {
    en: ['Search article text as well as titles', 'Search article text as well as titles', 'Search article text as well as titles', 'Search every word, not just the titles', 'Search every word, not just the titles'],
    yue: ['連內文一齊搜尋', '連內文一齊搜尋', '連內文一齊搜尋', '連每隻字都搵，唔淨止標題', '連每隻字都搵，唔淨止標題']
  },
  'docs-browser.setting.searchBodies.description': {
    en: [
      'On, the search matches the full text of every article and reports how many times the term occurs in each. Off, it matches titles, categories and source file names only. Off is the narrower search: a common word matches almost every article, which is a longer list rather than a more useful one.',
      'On, the search matches the full text of every article and reports how many times the term occurs in each. Off, it matches titles, categories and source file names only. Off is the narrower search: a common word matches almost every article, which is a longer list rather than a more useful one.',
      'On, the search matches the whole text of every article and counts the hits. Off, it matches titles, categories and file names only — which is narrower, because a common word matches nearly everything.',
      'On, it reads right through every article and tells you how many times your word turns up in each. Off, it only looks at titles, categories and file names — which is the narrower search, because a common word matches nearly every article and gives you a longer list rather than a more useful one.',
      'On, it reads right through every article and tells you how many times your word turns up in each. Off, it only looks at titles, categories and file names — which is the narrower search, because a common word matches nearly every article and gives you a longer list rather than a more useful one.'
    ],
    yue: [
      '開咗，搜尋會match每篇文章嘅全文，仲會話你知每篇中咗幾多次。閂咗，就只係match標題、分類同原始檔名。閂咗其實搵得窄啲：一個常用字幾乎篇篇都中，出到嚟只係一張更長嘅list，唔會更有用。',
      '開咗，搜尋會match每篇文章嘅全文，仲會話你知每篇中咗幾多次。閂咗，就只係match標題、分類同原始檔名。閂咗其實搵得窄啲：一個常用字幾乎篇篇都中，出到嚟只係一張更長嘅list，唔會更有用。',
      '開咗會搵晒全文仲會數埋中幾多次。閂咗淨係搵標題、分類同檔名——搵得窄啲，因為常用字幾乎篇篇都中。',
      '開咗佢就會由頭到尾睇晒每篇文，仲會報返你隻字喺每篇出現咗幾多次。閂咗就淨係睇標題、分類同檔名——其實係搵窄咗，因為一個常用字幾乎篇篇都中，出嚟只係一張更長嘅list，唔會更有用。',
      '開咗佢就會由頭到尾睇晒每篇文，仲會報返你隻字喺每篇出現咗幾多次。閂咗就淨係睇標題、分類同檔名——其實係搵窄咗，因為一個常用字幾乎篇篇都中，出嚟只係一張更長嘅list，唔會更有用。'
    ]
  },
  'docs-browser.setting.showSource': {
    en: ['Show each article’s source file', 'Show each article’s source file', 'Show each article’s source file', 'Show where each article was written', 'Show where each article was written'],
    yue: ['顯示每篇嘅原始檔', '顯示每篇嘅原始檔', '顯示每篇嘅原始檔', '顯示每篇文章寫喺邊', '顯示每篇文章寫喺邊']
  },
  'docs-browser.setting.showSource.description': {
    en: [
      'Prints the repository-relative path an article was bundled from, such as docs/features/locks.md, beneath its title. Articles registered by a feature module in code have no file and say so instead.',
      'Prints the repository-relative path an article was bundled from, such as docs/features/locks.md, beneath its title. Articles registered by a feature module in code have no file and say so instead.',
      'Prints the path an article was bundled from, such as docs/features/locks.md, under its title. Articles registered in code have no file and say so.',
      'Prints the path an article came from — docs/features/locks.md and so on — right under its title. Handy when you are editing the manual rather than reading it. Articles registered in code have no file at all, and say that rather than showing a blank.',
      'Prints the path an article came from — docs/features/locks.md and so on — right under its title. Handy when you are editing the manual rather than reading it. Articles registered in code have no file at all, and say that rather than showing a blank.'
    ],
    yue: [
      '喺標題下面顯示文章打包自邊個檔案路徑，例如 docs/features/locks.md。由程式碼登記嘅文章冇檔案，會直接寫明。',
      '喺標題下面顯示文章打包自邊個檔案路徑，例如 docs/features/locks.md。由程式碼登記嘅文章冇檔案，會直接寫明。',
      '喺標題下面顯示文章嘅來源路徑，例如 docs/features/locks.md。由程式碼登記嘅冇檔案，會寫明。',
      '喺標題下面直接印出文章由邊個檔案嚟——例如 docs/features/locks.md。你改緊說明書而唔係睇緊嘅時候好有用。由程式碼登記嘅文章根本冇檔案，佢會直接寫明，唔會留一片空白。',
      '喺標題下面直接印出文章由邊個檔案嚟——例如 docs/features/locks.md。你改緊說明書而唔係睇緊嘅時候好有用。由程式碼登記嘅文章根本冇檔案，佢會直接寫明，唔會留一片空白。'
    ]
  },
  'docs-browser.setting.showOutline': {
    en: ['Show the heading outline', 'Show the heading outline', 'Show the heading outline', 'Show the "On this page" outline', 'Show the "On this page" outline'],
    yue: ['顯示標題大綱', '顯示標題大綱', '顯示標題大綱', '顯示「本頁內容」大綱', '顯示「本頁內容」大綱']
  },
  'docs-browser.setting.showOutline.description': {
    en: [
      'Puts an "On this page" list of the article’s own headings above it, each one jumping to that heading. When the recorded headings cannot be matched to the rendered page the outline is omitted and says why, rather than offering links that go nowhere.',
      'Puts an "On this page" list of the article’s own headings above it, each one jumping to that heading. When the recorded headings cannot be matched to the rendered page the outline is omitted and says why, rather than offering links that go nowhere.',
      'Puts an "On this page" list of the article’s headings above it, each jumping to that heading. If the headings cannot be matched to the rendered page the outline is omitted and says why.',
      'Sticks an "On this page" list of the article’s own headings above it, and each one jumps you straight there. If the recorded headings cannot be lined up with the rendered page, the outline is dropped and tells you why — an outline whose links go nowhere is worse than none.',
      'Sticks an "On this page" list of the article’s own headings above it, and each one jumps you straight there. If the recorded headings cannot be lined up with the rendered page, the outline is dropped and tells you why — an outline whose links go nowhere is worse than none.'
    ],
    yue: [
      '喺文章上面加一個「本頁內容」標題清單，撳一下就跳去嗰個標題。如果記錄嘅標題同排出嚟嘅版面對唔上，就會唔顯示並講明原因，而唔係俾啲撳落去乜都冇嘅link你。',
      '喺文章上面加一個「本頁內容」標題清單，撳一下就跳去嗰個標題。如果記錄嘅標題同排出嚟嘅版面對唔上，就會唔顯示並講明原因，而唔係俾啲撳落去乜都冇嘅link你。',
      '喺文章上面加「本頁內容」標題清單，撳一下就跳去。如果標題對唔上排版就會唔顯示，同埋講明原因。',
      '喺文章上面擺個「本頁內容」標題清單，撳一下即刻跳過去。如果記低嘅標題同排出嚟嘅版面砌唔埋，個大綱就會唔出，同埋話你知點解——啲link撳落去乜都冇嘅大綱，仲衰過冇。',
      '喺文章上面擺個「本頁內容」標題清單，撳一下即刻跳過去。如果記低嘅標題同排出嚟嘅版面砌唔埋，個大綱就會唔出，同埋話你知點解——啲link撳落去乜都冇嘅大綱，仲衰過冇。'
    ]
  },
  'docs-browser.setting.verify': {
    en: ['Verify the bundle at startup', 'Verify the bundle at startup', 'Verify the bundle at startup', 'Check the bundle over every launch', 'Check the bundle over every launch'],
    yue: ['開機時驗證打包內容', '開機時驗證打包內容', '開機時驗證打包內容', '每次開app都查一次個bundle', '每次開app都查一次個bundle']
  },
  'docs-browser.setting.verify.description': {
    en: [
      'Runs the integrity check once at startup and raises a warning notification naming any article whose checksum or byte length no longer matches its own text. It reads only memory that is already loaded, so it costs no disk access and no network. Off, the check still runs on demand from this section.',
      'Runs the integrity check once at startup and raises a warning notification naming any article whose checksum or byte length no longer matches its own text. It reads only memory that is already loaded, so it costs no disk access and no network. Off, the check still runs on demand from this section.',
      'Runs the integrity check once at startup and warns, by name, about any article whose checksum no longer matches its text. It reads memory that is already loaded — no disk, no network. Off, you can still run it on demand here.',
      'Gives the bundle a once-over each time the application starts and puts up a warning naming any article whose checksum or byte length has drifted from its own text. It only reads memory that is already loaded, so it touches neither disk nor network. Turn it off and you can still run the check by hand from right here.',
      'Gives the bundle a once-over each time the application starts and puts up a warning naming any article whose checksum or byte length has drifted from its own text. It only reads memory that is already loaded, so it touches neither disk nor network. Turn it off and you can still run the check by hand from right here.'
    ],
    yue: [
      '開機時行一次完整性檢查，如果有文章嘅checksum或者byte數同佢自己嘅內文對唔上，就會出警告通知並講明係邊篇。佢只係讀已經載入咗嘅記憶體，唔會讀碟亦唔會上網。閂咗都仲可以喺呢度手動行。',
      '開機時行一次完整性檢查，如果有文章嘅checksum或者byte數同佢自己嘅內文對唔上，就會出警告通知並講明係邊篇。佢只係讀已經載入咗嘅記憶體，唔會讀碟亦唔會上網。閂咗都仲可以喺呢度手動行。',
      '開機行一次完整性檢查，有邊篇checksum對唔上就出警告講明。只讀已載入嘅記憶體，唔讀碟唔上網。閂咗都可以喺呢度手動行。',
      '每次開app幫個bundle驗一次身，邊篇文章嘅checksum或者byte數同自己嘅內文走咗位就出警告，仲會講明係邊篇。佢淨係讀已經載入咗嘅記憶體，碟同網都唔會掂。就算閂咗，你都仲可以喺呢度自己撳嚟行。',
      '每次開app幫個bundle驗一次身，邊篇文章嘅checksum或者byte數同自己嘅內文走咗位就出警告，仲會講明係邊篇。佢淨係讀已經載入咗嘅記憶體，碟同網都唔會掂。就算閂咗，你都仲可以喺呢度自己撳嚟行。'
    ]
  },
  'docs-browser.setting.splitWidth': {
    en: ['Index pane width', 'Index pane width', 'Index pane width', 'How wide the index pane sits', 'How wide the index pane sits'],
    yue: ['目錄闊度', '目錄闊度', '目錄闊度', '目錄嗰邊擺幾闊', '目錄嗰邊擺幾闊']
  },
  'docs-browser.setting.splitWidth.description': {
    en: [
      'Width of the article index in CSS pixels. Normally set by dragging the splitter between the two panes, or by focusing it and using the arrow keys; the value is here so it can be typed exactly and reset. Below the narrow-layout threshold the two panes stack instead, and this width is not used.',
      'Width of the article index in CSS pixels. Normally set by dragging the splitter between the two panes, or by focusing it and using the arrow keys; the value is here so it can be typed exactly and reset. Below the narrow-layout threshold the two panes stack instead, and this width is not used.',
      'Width of the article index in CSS pixels. Normally set by dragging the splitter or using the arrow keys; it is here so it can be typed exactly. In a narrow window the panes stack and this is not used.',
      'How wide the article index sits, in CSS pixels. You would normally just drag the splitter, or focus it and nudge it with the arrow keys — the number lives here so you can type an exact one and reset it. Squeeze the window narrow enough and the two panes stack instead, at which point this is ignored.',
      'How wide the article index sits, in CSS pixels. You would normally just drag the splitter, or focus it and nudge it with the arrow keys — the number lives here so you can type an exact one and reset it. Squeeze the window narrow enough and the two panes stack instead, at which point this is ignored.'
    ],
    yue: [
      '文章目錄嘅闊度（CSS像素）。平時係拉兩邊之間條分隔線，或者focus咗佢再撳方向鍵嚟調；呢個數值放喺呢度係為咗可以打得好準同埋重設。視窗窄過臨界值時兩邊會上下疊，呢個闊度就唔會用。',
      '文章目錄嘅闊度（CSS像素）。平時係拉兩邊之間條分隔線，或者focus咗佢再撳方向鍵嚟調；呢個數值放喺呢度係為咗可以打得好準同埋重設。視窗窄過臨界值時兩邊會上下疊，呢個闊度就唔會用。',
      '文章目錄闊度（CSS像素）。平時拉條分隔線或者撳方向鍵調；放喺呢度係方便打得準。視窗窄嘅時候兩邊會疊，就唔會用呢個數。',
      '文章目錄擺幾闊，用 CSS 像素計。平時你拉下兩邊中間條線，或者focus咗佢用方向鍵推就得——個數字放喺呢度係俾你打得準啲同埋一撳重設。視窗窄到某個位，兩邊就會上下疊，到時呢個數就唔理。',
      '文章目錄擺幾闊，用 CSS 像素計。平時你拉下兩邊中間條線，或者focus咗佢用方向鍵推就得——個數字放喺呢度係俾你打得準啲同埋一撳重設。視窗窄到某個位，兩邊就會上下疊，到時呢個數就唔理。'
    ]
  },
  'docs-browser.setting.exportIndex': {
    en: ['Export the article index', 'Export the article index', 'Export the article index', 'Export the whole article index', 'Export the whole article index'],
    yue: ['匯出文章目錄', '匯出文章目錄', '匯出文章目錄', '成個文章目錄匯出', '成個文章目錄匯出']
  },
  'docs-browser.setting.exportIndex.description': {
    en: [
      'Writes one row per article — id, title, category, source file, reading time, size, read and bookmarked state — through the standard exporter, in any format it supports. Article bodies are not included; use Copy as Markdown in the library for those.',
      'Writes one row per article — id, title, category, source file, reading time, size, read and bookmarked state — through the standard exporter, in any format it supports. Article bodies are not included; use Copy as Markdown in the library for those.',
      'Writes one row per article — id, title, category, source file, reading time, size, read and bookmarked state — through the standard exporter. Bodies are not included; use Copy as Markdown for those.',
      'Writes a row per article — id, title, category, source file, reading time, size, whether you have read it and whether you bookmarked it — through the standard exporter in whichever format you like. The article text itself is not in there; Copy as Markdown in the library is the one that carries the words.',
      'Writes a row per article — id, title, category, source file, reading time, size, whether you have read it and whether you bookmarked it — through the standard exporter in whichever format you like. The article text itself is not in there; Copy as Markdown in the library is the one that carries the words.'
    ],
    yue: [
      '經標準匯出器，每篇文章寫一行——id、標題、分類、原始檔、閱讀時間、大小、已讀同書籤狀態——支援嘅格式全部可以。唔包內文；要內文請用文庫入面嘅「複製做 Markdown」。',
      '經標準匯出器，每篇文章寫一行——id、標題、分類、原始檔、閱讀時間、大小、已讀同書籤狀態——支援嘅格式全部可以。唔包內文；要內文請用文庫入面嘅「複製做 Markdown」。',
      '經標準匯出器每篇寫一行——id、標題、分類、原始檔、閱讀時間、大小、已讀同書籤狀態。唔包內文；要內文用「複製做 Markdown」。',
      '經標準匯出器每篇寫一行——id、標題、分類、原始檔、閱讀時間、大細、你睇咗未、有冇夾書籤——你鍾意咩格式都得。內文唔喺入面；要成篇字嘅話，用文庫嗰個「複製做 Markdown」。',
      '經標準匯出器每篇寫一行——id、標題、分類、原始檔、閱讀時間、大細、你睇咗未、有冇夾書籤——你鍾意咩格式都得。內文唔喺入面；要成篇字嘅話，用文庫嗰個「複製做 Markdown」。'
    ]
  },
  'docs-browser.palette.open': {
    en: ['Open the documentation', 'Open the documentation', 'Open the documentation', 'Open the manual', 'Open the manual'],
    yue: ['開說明文件', '開說明文件', '開說明文件', '開說明書', '開說明書']
  },
  'docs-browser.palette.bookmarks': {
    en: ['Go to a bookmarked article', 'Go to a bookmarked article', 'Go to a bookmarked article', 'Jump to something you bookmarked', 'Jump to something you bookmarked'],
    yue: ['去有書籤嘅文章', '去有書籤嘅文章', '去有書籤嘅文章', '跳去你夾咗書籤嗰啲', '跳去你夾咗書籤嗰啲']
  },
  'docs-browser.bookmarks.none': {
    en: [
      'No article is bookmarked yet. Open one and use its bookmark control.',
      'No article is bookmarked yet. Open one and use its bookmark control.',
      'Nothing is bookmarked yet. Open an article and use its bookmark control.',
      'Nothing is bookmarked yet. Open an article and hit its bookmark control, then this will take you straight back to it.',
      'Nothing is bookmarked yet. Open an article and hit its bookmark control, then this will take you straight back to it.'
    ],
    yue: [
      '仲未有文章加咗書籤。開一篇，撳個書籤掣。',
      '仲未有文章加咗書籤。開一篇，撳個書籤掣。',
      '仲未有書籤。開一篇文章，撳個書籤掣。',
      '仲未夾過書籤。開一篇文章撳個書籤掣，之後呢度就會直接帶你返去。',
      '仲未夾過書籤。開一篇文章撳個書籤掣，之後呢度就會直接帶你返去。'
    ]
  },
  'docs-browser.markdown.region': {
    en: ['Rendered article text', 'Rendered article text', 'Rendered article text', 'The article text, rendered', 'The article text, rendered'],
    yue: ['已排版嘅文章內容', '已排版嘅文章內容', '已排版嘅文章內容', '排好版嘅文章內容', '排好版嘅文章內容']
  },
  'docs-browser.markdown.empty': {
    en: [
      'No notes were provided.',
      'No notes were provided.',
      'No notes were provided.',
      'No notes were provided — that is genuinely what came through, not something still loading.',
      'No notes were provided — that is genuinely what came through, not something still loading.'
    ],
    yue: [
      '冇提供任何說明。',
      '冇提供任何說明。',
      '冇提供任何說明。',
      '真係冇提供任何說明——唔係載緊，係本身就冇。',
      '真係冇提供任何說明——唔係載緊，係本身就冇。'
    ]
  }
};
