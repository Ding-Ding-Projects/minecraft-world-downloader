import type { Catalogue, FunnyLadder, TranslationEntry } from '../../core/registry';

/**
 * Every piece of copy the changelog viewer renders, in English and in playful
 * Hong Kong Cantonese, at all five funny levels.
 *
 * The rule this file is written under: the funny level styles the VOICE and
 * never the FACTS. A version number, a date, a commit id, a category name and
 * the sentence "this version has no recorded changes" say exactly the same
 * thing at level 1 and at level 5. What changes is how the sentence around them
 * reads. A changelog that is funny but leaves the reader unsure what shipped is
 * a broken changelog, and that includes security fixes and breaking changes,
 * which are styled like everything else and stay just as exact.
 *
 * The two levels are independent, so English at 1 beside Cantonese at 5 is a
 * combination somebody will pick and both halves must read correctly in it.
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

export const CHANGELOG_STRINGS: Catalogue = {
  /* ---------------- destination ---------------- */

  'changelog.title': entry(ladder('Changelog'), ladder('更新紀錄')),
  'changelog.subtitle': entry(
    ladder(
      'Every released version, with the commit behind each change.',
      'Every released version, with the commit behind each change.',
      'Every version ever released, and the commit that did it.',
      'Every version ever released, and the exact commit to blame for it.',
      'Every version ever released, and the exact commit to blame for it.'
    ),
    ladder(
      '每一個發佈過嘅版本，同每項改動背後嘅 commit。',
      '每一個發佈過嘅版本，同每項改動背後嘅 commit。',
      '由頭到尾每個版本，連邊個 commit 做嘅都寫低咗。',
      '由頭到尾每個版本都喺度，連邊個 commit 撞出嚟都捉咗出嚟。',
      '由頭到尾每個版本都喺度，連邊個 commit 撞出嚟都捉咗出嚟。'
    )
  ),
  'changelog.description': entry(
    ladder(
      'Read the release history, filter it by date and text, and open the commit behind any entry.',
      'Read the release history, filter it by date and text, and open the commit behind any entry.',
      'Read the whole release history, narrow it down, and jump straight to the commit.',
      'Read the whole release history, narrow it down, and jump straight to the commit that did the deed.',
      'Read the whole release history, narrow it down, and jump straight to the commit that did the deed.'
    ),
    ladder(
      '睇發佈歷史，用日期同文字篩選，再打開每項改動背後嘅 commit。',
      '睇發佈歷史，用日期同文字篩選，再打開每項改動背後嘅 commit。',
      '成個發佈歷史都喺度，篩窄啲，再直接跳去個 commit。',
      '成個發佈歷史都喺度，篩窄啲，再一擊跳去做壞事嗰個 commit。',
      '成個發佈歷史都喺度，篩窄啲，再一擊跳去做壞事嗰個 commit。'
    )
  ),

  /* ---------------- filters ---------------- */

  'changelog.search.label': entry(ladder('Search the changelog'), ladder('搵更新紀錄')),
  'changelog.search.placeholder': entry(
    ladder(
      'Version, summary, author or commit id…',
      'Version, summary, author or commit id…',
      'Version, summary, author, commit id — anything…',
      'Type anything: a version, a word, a name, half a commit id…',
      'Type anything: a version, a word, a name, half a commit id…'
    ),
    ladder(
      '版本、內容、作者或者 commit id…',
      '版本、內容、作者或者 commit id…',
      '版本、內容、作者、commit id，乜都得…',
      '打乜都得：版本、一個字、個名、半截 commit id 都得…',
      '打乜都得：版本、一個字、個名、半截 commit id 都得…'
    )
  ),
  'changelog.filter.date': entry(ladder('Release date range'), ladder('發佈日期範圍')),
  'changelog.filter.categories': entry(ladder('Categories'), ladder('分類')),
  'changelog.filter.categoriesHelp': entry(
    ladder(
      'Nothing selected means every category. Selecting one narrows the list to it.',
      'Nothing selected means every category. Selecting one narrows the list to it.',
      'Pick none and you get the lot. Pick one and you get only that.',
      'Pick none and you get the lot. Pick one and everything else politely leaves.',
      'Pick none and you get the lot. Pick one and everything else politely leaves.'
    ),
    ladder(
      '一個都唔揀就係全部分類。揀咗邊個就淨係睇嗰個。',
      '一個都唔揀就係全部分類。揀咗邊個就淨係睇嗰個。',
      '唔揀就全部出。揀一個就淨係出嗰款。',
      '唔揀就全部出晒。揀一個，其他就好識做咁行開。',
      '唔揀就全部出晒。揀一個，其他就好識做咁行開。'
    )
  ),
  'changelog.filter.breaking': entry(ladder('Breaking changes only'), ladder('淨係睇會搞爛嘢嘅改動')),
  'changelog.filter.released': entry(ladder('Released versions only'), ladder('淨係睇已經發佈嘅版本')),
  'changelog.filter.clear': entry(ladder('Clear the filters'), ladder('清走全部篩選')),
  'changelog.filter.active': entry(
    ladder('Filters are active: {summary}'),
    ladder('而家有篩選喺度：{summary}')
  ),

  /* ---------------- status ---------------- */

  'changelog.status.counts': entry(
    ladder('{releases} of {totalReleases} versions, {entries} of {totalEntries} changes'),
    ladder('{totalReleases} 個版本入面顯示 {releases} 個，{totalEntries} 項改動入面顯示 {entries} 項')
  ),
  'changelog.status.noMatch': entry(
    ladder(
      'No version and no change matched. Widen the date range or clear the search.',
      'No version and no change matched. Widen the date range or clear the search.',
      'Nothing matched that. Try a wider date range, or clear the search.',
      'Nothing matched that. Not one version, not one change. Widen the dates or clear the search.',
      'Nothing matched that. Not one version, not one change. Widen the dates or clear the search.'
    ),
    ladder(
      '冇版本亦冇改動符合。放闊日期範圍或者清走搜尋。',
      '冇版本亦冇改動符合。放闊日期範圍或者清走搜尋。',
      '乜都搵唔到。試下放闊日期，或者清走搜尋。',
      '乜都搵唔到，一個版本一項改動都冇。放闊日期範圍，或者清走搜尋啦。',
      '乜都搵唔到，一個版本一項改動都冇。放闊日期範圍，或者清走搜尋啦。'
    )
  ),
  'changelog.status.source': entry(
    ladder(
      'Built from this repository on {generated}. {releases} versions, {commits} commits across all release ranges.',
      'Built from this repository on {generated}. {releases} versions, {commits} commits across all release ranges.',
      'Built straight from this repository on {generated}: {releases} versions and {commits} commits across every release range.',
      'Built straight from this repository on {generated}: {releases} versions and {commits} commits across every release range. Nothing here was made up.',
      'Built straight from this repository on {generated}: {releases} versions and {commits} commits across every release range. Nothing here was made up.'
    ),
    ladder(
      '喺 {generated} 由呢個 repository 直接整出嚟。{releases} 個版本，全部發佈範圍加埋 {commits} 個 commit。',
      '喺 {generated} 由呢個 repository 直接整出嚟。{releases} 個版本，全部發佈範圍加埋 {commits} 個 commit。',
      '{generated} 直接由呢個 repository 度整出嚟：{releases} 個版本，全部發佈範圍加埋 {commits} 個 commit。',
      '{generated} 直接由呢個 repository 度挖出嚟：{releases} 個版本，全部發佈範圍加埋 {commits} 個 commit。一個字都冇作。',
      '{generated} 直接由呢個 repository 度挖出嚟：{releases} 個版本，全部發佈範圍加埋 {commits} 個 commit。一個字都冇作。'
    )
  ),
  'changelog.status.overlap': entry(
    ladder(
      'Tags that do not sit on one straight line of history share commits, so that total counts a shared commit once per range.',
      'Tags that do not sit on one straight line of history share commits, so that total counts a shared commit once per range.',
      'Where tags branch apart they share commits, so a shared commit is counted once in each range it belongs to.',
      'Where tags branch apart they share commits, so a shared commit gets counted once in every range it belongs to. That is arithmetic, not double vision.',
      'Where tags branch apart they share commits, so a shared commit gets counted once in every range it belongs to. That is arithmetic, not double vision.'
    ),
    ladder(
      '如果啲 tag 唔係喺同一條歷史直線上，佢哋會共用 commit，所以嗰個總數會喺每個範圍各數一次。',
      '如果啲 tag 唔係喺同一條歷史直線上，佢哋會共用 commit，所以嗰個總數會喺每個範圍各數一次。',
      'Tag 分咗叉就會共用 commit，所以同一個 commit 喺每個範圍都會各數一次。',
      'Tag 分咗叉就會共用 commit，所以同一個 commit 喺每個範圍都各數一次。係數學嚟，唔係眼花。',
      'Tag 分咗叉就會共用 commit，所以同一個 commit 喺每個範圍都各數一次。係數學嚟，唔係眼花。'
    )
  ),
  'changelog.empty.title': entry(
    ladder('This build carries no changelog'),
    ladder('呢個 build 冇夾帶更新紀錄')
  ),
  'changelog.empty.body': entry(
    ladder(
      'The changelog is generated from the repository at build time. Run "node scripts/generate-changelog.mjs" in the app directory and build again.',
      'The changelog is generated from the repository at build time. Run "node scripts/generate-changelog.mjs" in the app directory and build again.',
      'The changelog is generated from the repository when the app is built. Run "node scripts/generate-changelog.mjs" in the app directory, then build again.',
      'The changelog is generated from the repository when the app is built, so an empty one means the generator never ran. Run "node scripts/generate-changelog.mjs" in the app directory, then build again.',
      'The changelog is generated from the repository when the app is built, so an empty one means the generator never ran. Run "node scripts/generate-changelog.mjs" in the app directory, then build again.'
    ),
    ladder(
      '更新紀錄係 build 嗰陣由 repository 產生。喺 app 目錄行 "node scripts/generate-changelog.mjs"，再 build 一次。',
      '更新紀錄係 build 嗰陣由 repository 產生。喺 app 目錄行 "node scripts/generate-changelog.mjs"，再 build 一次。',
      '更新紀錄係 build 嗰陣由 repository 度整出嚟。去 app 目錄行 "node scripts/generate-changelog.mjs"，再 build 過。',
      '更新紀錄係 build 嗰陣由 repository 度整出嚟，空白即係個產生器根本冇行過。去 app 目錄行 "node scripts/generate-changelog.mjs"，再 build 過。',
      '更新紀錄係 build 嗰陣由 repository 度整出嚟，空白即係個產生器根本冇行過。去 app 目錄行 "node scripts/generate-changelog.mjs"，再 build 過。'
    )
  ),

  /* ---------------- releases ---------------- */

  'changelog.release.unreleased': entry(
    ladder('Unreleased'),
    ladder('未發佈')
  ),
  'changelog.release.unreleasedNote': entry(
    ladder(
      'Committed after the newest tag and not part of any release yet.',
      'Committed after the newest tag and not part of any release yet.',
      'Landed after the newest tag, so it is in no release yet.',
      'Landed after the newest tag, so it belongs to no release yet — it is waiting its turn.',
      'Landed after the newest tag, so it belongs to no release yet — it is waiting its turn.'
    ),
    ladder(
      '喺最新 tag 之後 commit，仲未計入任何發佈。',
      '喺最新 tag 之後 commit，仲未計入任何發佈。',
      '喺最新 tag 之後先入嚟，所以仲未屬於任何發佈。',
      '喺最新 tag 之後先入嚟，仲未屬於任何發佈，喺度排緊隊。',
      '喺最新 tag 之後先入嚟，仲未屬於任何發佈，喺度排緊隊。'
    )
  ),
  'changelog.release.noChanges': entry(
    ladder(
      'No changes are recorded for this version. Its tag points at the same commit as the version before it.',
      'No changes are recorded for this version. Its tag points at the same commit as the version before it.',
      'Nothing is recorded for this version: its tag sits on the same commit as the one before it.',
      'Nothing is recorded for this version at all. Its tag sits on exactly the same commit as the one before it, so there is genuinely nothing to report.',
      'Nothing is recorded for this version at all. Its tag sits on exactly the same commit as the one before it, so there is genuinely nothing to report.'
    ),
    ladder(
      '呢個版本冇紀錄到任何改動。佢個 tag 同上一個版本指住同一個 commit。',
      '呢個版本冇紀錄到任何改動。佢個 tag 同上一個版本指住同一個 commit。',
      '呢個版本乜紀錄都冇：個 tag 同上一個版本踩住同一個 commit。',
      '呢個版本真係乜都冇紀錄到。個 tag 同上一個版本踩住一模一樣嘅 commit，所以真係冇嘢好報。',
      '呢個版本真係乜都冇紀錄到。個 tag 同上一個版本踩住一模一樣嘅 commit，所以真係冇嘢好報。'
    )
  ),
  'changelog.release.hiddenByFilter': entry(
    ladder(
      '{hidden} of this version\'s {total} changes are hidden by the current filter.',
      '{hidden} of this version\'s {total} changes are hidden by the current filter.',
      '{hidden} of this version\'s {total} changes are hidden by the filter you have set.',
      '{hidden} of this version\'s {total} changes are hiding behind the filter you set.',
      '{hidden} of this version\'s {total} changes are hiding behind the filter you set.'
    ),
    ladder(
      '呢個版本 {total} 項改動入面，有 {hidden} 項俾而家嘅篩選收埋咗。',
      '呢個版本 {total} 項改動入面，有 {hidden} 項俾而家嘅篩選收埋咗。',
      '呢個版本 {total} 項改動，有 {hidden} 項俾你設嘅篩選收埋咗。',
      '呢個版本 {total} 項改動，有 {hidden} 項匿埋咗喺你設嘅篩選後面。',
      '呢個版本 {total} 項改動，有 {hidden} 項匿埋咗喺你設嘅篩選後面。'
    )
  ),
  'changelog.release.meta': entry(
    ladder('{count} changes from {commits} commits since {previous}'),
    ladder('由 {previous} 之後嘅 {commits} 個 commit，歸納成 {count} 項改動')
  ),
  'changelog.release.metaFirst': entry(
    ladder('{count} changes from {commits} commits, the first recorded version'),
    ladder('{commits} 個 commit 歸納成 {count} 項改動，係第一個有紀錄嘅版本')
  ),
  'changelog.release.tagged': entry(ladder('Tagged at {commit}'), ladder('Tag 喺 {commit}')),
  'changelog.release.select': entry(ladder('Select version {version}'), ladder('揀版本 {version}')),
  'changelog.release.jump': entry(ladder('Go to version {version}'), ladder('去版本 {version}')),
  'changelog.release.more': entry(
    ladder('Show more versions ({remaining} left)'),
    ladder('顯示多啲版本（仲有 {remaining} 個）')
  ),
  'changelog.release.allShown': entry(
    ladder('Every matching version is shown.'),
    ladder('所有符合嘅版本都顯示晒。')
  ),

  /* ---------------- entries ---------------- */

  'changelog.entry.summary': entry(
    ladder(
      'One entry for {count} commits with the same subject. The link is the commit that completed the change.',
      'One entry for {count} commits with the same subject. The link is the commit that completed the change.',
      'This is one entry standing for {count} commits that carried the same subject; the link goes to the one that finished the job.',
      'This is one entry standing for {count} commits that all said the same thing; the link goes to the one that actually finished the job.',
      'This is one entry standing for {count} commits that all said the same thing; the link goes to the one that actually finished the job.'
    ),
    ladder(
      '呢一項代表咗 {count} 個同標題嘅 commit。個連結係做完嗰個 commit。',
      '呢一項代表咗 {count} 個同標題嘅 commit。個連結係做完嗰個 commit。',
      '呢一項代表 {count} 個標題一樣嘅 commit；個連結指住做完件事嗰個。',
      '呢一項代表 {count} 個講同一句嘢嘅 commit；個連結指住真係做完件事嗰個。',
      '呢一項代表 {count} 個講同一句嘢嘅 commit；個連結指住真係做完件事嗰個。'
    )
  ),
  'changelog.entry.breaking': entry(ladder('Breaking change'), ladder('會搞爛舊嘢嘅改動')),
  'changelog.entry.breakingNote': entry(
    ladder(
      'The commit declared a breaking change. Read its message before upgrading.',
      'The commit declared a breaking change. Read its message before upgrading.',
      'This commit declared a breaking change, so read its message before you upgrade.',
      'This commit put its hand up and declared a breaking change, so read its message before you upgrade.',
      'This commit put its hand up and declared a breaking change, so read its message before you upgrade.'
    ),
    ladder(
      '呢個 commit 聲明咗會搞爛舊嘢。升級之前睇清楚佢段訊息。',
      '呢個 commit 聲明咗會搞爛舊嘢。升級之前睇清楚佢段訊息。',
      '呢個 commit 自己講明會搞爛舊嘢，升級前一定要睇佢段訊息。',
      '呢個 commit 舉手自首話會搞爛舊嘢，升級前一定要睇佢段訊息。',
      '呢個 commit 舉手自首話會搞爛舊嘢，升級前一定要睇佢段訊息。'
    )
  ),
  'changelog.entry.truncated': entry(
    ladder(
      'The commit message was cut at {limit} characters. Open the commit for the whole message.',
      'The commit message was cut at {limit} characters. Open the commit for the whole message.',
      'The commit message was cut at {limit} characters here; open the commit to read all of it.',
      'The commit message ran past {limit} characters, so it is cut here. Open the commit to read the rest.',
      'The commit message ran past {limit} characters, so it is cut here. Open the commit to read the rest.'
    ),
    ladder(
      'Commit 訊息喺 {limit} 個字度截咗。想睇全部就打開個 commit。',
      'Commit 訊息喺 {limit} 個字度截咗。想睇全部就打開個 commit。',
      'Commit 訊息喺 {limit} 個字度截咗，想睇晒就打開個 commit。',
      'Commit 訊息寫到爆 {limit} 個字，所以喺度截咗。想睇返其餘就打開個 commit。',
      'Commit 訊息寫到爆 {limit} 個字，所以喺度截咗。想睇返其餘就打開個 commit。'
    )
  ),
  'changelog.entry.by': entry(ladder('{author}, {date}'), ladder('{author}，{date}')),
  'changelog.entry.showBody': entry(ladder('Show the full commit message'), ladder('睇成段 commit 訊息')),
  'changelog.entry.hideBody': entry(ladder('Hide the commit message'), ladder('收埋 commit 訊息')),

  /* ---------------- commit references ---------------- */

  'changelog.commit.open': entry(
    ladder('Open commit {sha} for "{summary}" in your browser'),
    ladder('喺瀏覽器打開「{summary}」嘅 commit {sha}')
  ),
  'changelog.commit.copy': entry(ladder('Copy the commit id {sha}'), ladder('複製 commit id {sha}')),
  'changelog.commit.copied': entry(ladder('Commit id copied: {sha}'), ladder('已複製 commit id：{sha}')),
  'changelog.commit.noForge': entry(
    ladder(
      'This repository has no recognised forge, so commit ids are shown as text rather than as links that would go nowhere.',
      'This repository has no recognised forge, so commit ids are shown as text rather than as links that would go nowhere.',
      'No recognised forge for this repository, so commit ids stay as text instead of becoming links to nowhere.',
      'No recognised forge for this repository, so commit ids stay as plain text. A link that goes nowhere is worse than no link.',
      'No recognised forge for this repository, so commit ids stay as plain text. A link that goes nowhere is worse than no link.'
    ),
    ladder(
      '呢個 repository 冇認得出嘅 forge，所以 commit id 淨係顯示做文字，唔會整個去唔到嘅連結。',
      '呢個 repository 冇認得出嘅 forge，所以 commit id 淨係顯示做文字，唔會整個去唔到嘅連結。',
      '認唔出呢個 repository 用邊個 forge，所以 commit id 保持文字，唔會變成去唔到嘅連結。',
      '認唔出呢個 repository 用邊個 forge，所以 commit id 保持純文字。一個去唔到嘅連結，仲衰過冇連結。',
      '認唔出呢個 repository 用邊個 forge，所以 commit id 保持純文字。一個去唔到嘅連結，仲衰過冇連結。'
    )
  ),
  'changelog.commit.openFailed': entry(
    ladder('The commit could not be opened: {reason}'),
    ladder('打唔開個 commit：{reason}')
  ),

  /* ---------------- categories ---------------- */

  'changelog.category.added': entry(ladder('Added'), ladder('新加')),
  'changelog.category.changed': entry(ladder('Changed'), ladder('改咗')),
  'changelog.category.fixed': entry(ladder('Fixed'), ladder('整好咗')),
  'changelog.category.removed': entry(ladder('Removed'), ladder('拎走咗')),
  'changelog.category.security': entry(ladder('Security'), ladder('保安')),
  'changelog.category.performance': entry(ladder('Performance'), ladder('速度')),
  'changelog.category.documentation': entry(ladder('Documentation'), ladder('文件')),
  'changelog.category.maintenance': entry(ladder('Maintenance'), ladder('日常維護')),
  'changelog.category.reverted': entry(ladder('Reverted'), ladder('撤銷咗')),
  'changelog.category.merged': entry(ladder('Merged'), ladder('合併')),
  'changelog.category.other': entry(ladder('Other'), ladder('其他')),
  'changelog.category.uncategorized': entry(
    ladder(
      'Filed as "Other" because the commit subject matched no category rule. Its full text is shown so you can judge it.',
      'Filed as "Other" because the commit subject matched no category rule. Its full text is shown so you can judge it.',
      'Filed as "Other" because nothing in the subject matched a category rule, so you get the full text and can judge it yourself.',
      'Filed as "Other" because the subject matched no rule at all. You get the full text and can judge it yourself, which beats a guess.',
      'Filed as "Other" because the subject matched no rule at all. You get the full text and can judge it yourself, which beats a guess.'
    ),
    ladder(
      '歸類做「其他」，因為 commit 標題唔符合任何分類規則。全文照出，你自己判斷。',
      '歸類做「其他」，因為 commit 標題唔符合任何分類規則。全文照出，你自己判斷。',
      '歸類做「其他」，因為個標題唔中任何分類規則，所以全文照出，你自己判斷。',
      '歸類做「其他」，因為個標題一條規則都唔中。全文照出你自己判斷，好過亂估。',
      '歸類做「其他」，因為個標題一條規則都唔中。全文照出你自己判斷，好過亂估。'
    )
  ),

  /* ---------------- selection and bulk actions ---------------- */

  'changelog.bulk.title': entry(ladder('Selected versions'), ladder('揀咗嘅版本')),
  'changelog.bulk.none': entry(
    ladder('No version is selected. Copy and export use the current filter instead.'),
    ladder('冇揀任何版本。複製同匯出會改為用而家嘅篩選。')
  ),
  'changelog.bulk.count': entry(
    ladder('{count} of {matching} matching versions selected'),
    ladder('{matching} 個符合嘅版本入面，揀咗 {count} 個')
  ),
  'changelog.bulk.selectPage': entry(
    ladder('Select the {count} versions shown'),
    ladder('揀晒顯示緊嘅 {count} 個版本')
  ),
  'changelog.bulk.selectAll': entry(
    ladder('Select all {count} matching versions'),
    ladder('揀晒全部 {count} 個符合嘅版本')
  ),
  'changelog.bulk.invert': entry(ladder('Invert the selection'), ladder('反轉揀嘅嘢')),
  'changelog.bulk.clear': entry(ladder('Clear the selection'), ladder('唔揀晒佢')),
  'changelog.bulk.scopeNote': entry(
    ladder(
      '"Shown" is the versions currently rendered; "all matching" is every version the filter accepts, including ones further down.',
      '"Shown" is the versions currently rendered; "all matching" is every version the filter accepts, including ones further down.',
      '"Shown" means what is on screen right now; "all matching" means every version the filter accepts, including the ones you have not scrolled to.',
      '"Shown" means what is on screen right now. "All matching" means every version the filter accepts, including the ones still below the fold. They are different numbers and the buttons say which is which.',
      '"Shown" means what is on screen right now. "All matching" means every version the filter accepts, including the ones still below the fold. They are different numbers and the buttons say which is which.'
    ),
    ladder(
      '「顯示緊」係而家畫咗出嚟嘅版本；「全部符合」係篩選接受嘅所有版本，包括仲喺下面嗰啲。',
      '「顯示緊」係而家畫咗出嚟嘅版本；「全部符合」係篩選接受嘅所有版本，包括仲喺下面嗰啲。',
      '「顯示緊」係而家見到嗰啲；「全部符合」係篩選接受嘅全部版本，包括你未捲到嗰啲。',
      '「顯示緊」係而家見到嗰啲。「全部符合」係篩選接受嘅全部版本，包括仲埋喺下面嗰啲。兩個數係唔同嘅，掣上面寫得好清楚。',
      '「顯示緊」係而家見到嗰啲。「全部符合」係篩選接受嘅全部版本，包括仲埋喺下面嗰啲。兩個數係唔同嘅，掣上面寫得好清楚。'
    )
  ),
  'changelog.bulk.dropped': entry(
    ladder(
      '{count} selected versions no longer match the filter and were deselected.',
      '{count} selected versions no longer match the filter and were deselected.',
      '{count} versions you had selected no longer match the filter, so they were deselected.',
      '{count} versions you had selected no longer match the filter, so they let go of the selection on their way out.',
      '{count} versions you had selected no longer match the filter, so they let go of the selection on their way out.'
    ),
    ladder(
      '有 {count} 個揀咗嘅版本已經唔符合篩選，已經取消揀咗。',
      '有 {count} 個揀咗嘅版本已經唔符合篩選，已經取消揀咗。',
      '你揀咗嘅版本有 {count} 個已經唔符合篩選，所以幫你取消咗。',
      '你揀咗嘅版本有 {count} 個已經唔符合篩選，走嗰陣順手放低咗個剔。',
      '你揀咗嘅版本有 {count} 個已經唔符合篩選，走嗰陣順手放低咗個剔。'
    )
  ),
  'changelog.bulk.disabledNoMatch': entry(
    ladder('Nothing is available: the current filter matches no version.'),
    ladder('冇嘢做得：而家嘅篩選一個版本都唔啱。')
  ),
  'changelog.bulk.disabledNoSelection': entry(
    ladder('Nothing is selected, so there is nothing to clear.'),
    ladder('冇揀任何嘢，所以冇嘢好清。')
  ),
  'changelog.bulk.shiftHint': entry(
    ladder(
      'Shift-click a checkbox to select a range. Space toggles the focused version.',
      'Shift-click a checkbox to select a range. Space toggles the focused version.',
      'Shift-click a checkbox to take a whole range at once. Space toggles whichever version has focus.',
      'Shift-click a checkbox and it grabs the whole range in one go. Space toggles whichever version has focus.',
      'Shift-click a checkbox and it grabs the whole range in one go. Space toggles whichever version has focus.'
    ),
    ladder(
      '按住 Shift 撳格仔可以一次揀一段。Space 掣可以開關焦點嗰個版本。',
      '按住 Shift 撳格仔可以一次揀一段。Space 掣可以開關焦點嗰個版本。',
      '撳住 Shift 撳格仔，一次過拉一整段。Space 掣開關焦點嗰個版本。',
      '撳住 Shift 撳格仔，一嘢拉走一整段。Space 掣開關焦點嗰個版本。',
      '撳住 Shift 撳格仔，一嘢拉走一整段。Space 掣開關焦點嗰個版本。'
    )
  ),

  /* ---------------- copy and export ---------------- */

  'changelog.copy.action': entry(ladder('Copy'), ladder('複製')),
  'changelog.copy.done': entry(
    ladder('{releases} versions and {entries} changes copied to the clipboard as {format}.'),
    ladder('已用 {format} 格式複製咗 {releases} 個版本、{entries} 項改動落剪貼簿。')
  ),
  'changelog.copy.failed': entry(
    ladder('The clipboard refused the copy: {reason}'),
    ladder('剪貼簿唔收：{reason}')
  ),
  'changelog.copy.nothing': entry(
    ladder('There is nothing to copy: the current filter matches no version.'),
    ladder('冇嘢可以複製：而家嘅篩選一個版本都唔啱。')
  ),
  'changelog.export.action': entry(ladder('Export'), ladder('匯出')),
  'changelog.export.markdown': entry(ladder('Export as Markdown'), ladder('匯出做 Markdown')),
  'changelog.export.text': entry(ladder('Export as plain text'), ladder('匯出做純文字')),
  'changelog.export.records': entry(ladder('Export the changes as data'), ladder('將啲改動匯出做資料')),
  'changelog.export.format': entry(ladder('Data format'), ladder('資料格式')),
  'changelog.export.saved': entry(
    ladder('Exported {releases} versions and {entries} changes to {path}'),
    ladder('已將 {releases} 個版本、{entries} 項改動匯出去 {path}')
  ),
  'changelog.export.failed': entry(
    ladder('The export was not written: {reason}'),
    ladder('匯出寫唔到：{reason}')
  ),
  'changelog.export.scopeAll': entry(ladder('Everything the filter matches'), ladder('篩選接受嘅全部嘢')),
  'changelog.export.scopeSelection': entry(ladder('The selected versions only'), ladder('淨係揀咗嗰啲版本')),
  'changelog.export.rangeNote': entry(
    ladder(
      'The file states the exact range, the filter and the commit ids, so a copy stays traceable after it leaves this window.',
      'The file states the exact range, the filter and the commit ids, so a copy stays traceable after it leaves this window.',
      'The file spells out the range, the filter and every commit id, so the copy is still traceable once it leaves this window.',
      'The file spells out the range, the filter and every commit id, so your copy is still traceable long after it has left this window.',
      'The file spells out the range, the filter and every commit id, so your copy is still traceable long after it has left this window.'
    ),
    ladder(
      '個檔案會寫明確實範圍、篩選同 commit id，所以離開咗呢個視窗之後都仲追查得到。',
      '個檔案會寫明確實範圍、篩選同 commit id，所以離開咗呢個視窗之後都仲追查得到。',
      '個檔案會寫清楚範圍、篩選同每個 commit id，走出咗呢個視窗都仲追查到。',
      '個檔案會寫清楚範圍、篩選同每個 commit id，就算份 copy 走咗好遠都仲追查到。',
      '個檔案會寫清楚範圍、篩選同每個 commit id，就算份 copy 走咗好遠都仲追查到。'
    )
  ),

  /* ---------------- opening many commits ---------------- */

  'changelog.openAll.action': entry(ladder('Open every commit in the browser'), ladder('喺瀏覽器打開全部 commit')),
  'changelog.openAll.none': entry(
    ladder('There is no commit to open in what is selected.'),
    ladder('揀咗嘅嘢入面冇 commit 可以打開。')
  ),
  'changelog.openAll.confirmAction': entry(
    ladder('Open {count} commit pages in your browser'),
    ladder('喺瀏覽器打開 {count} 版 commit')
  ),
  'changelog.openAll.irreversible': entry(
    ladder(
      'Your browser opens {count} pages. Nothing is deleted and nothing changes on disk, but the windows cannot be recalled once they are handed to the operating system, and you will close them yourself.',
      'Your browser opens {count} pages. Nothing is deleted and nothing changes on disk, but the windows cannot be recalled once they are handed to the operating system, and you will close them yourself.',
      'Your browser opens {count} pages. Nothing is deleted and nothing on disk changes, but once the operating system has them they cannot be recalled, and closing them is your job.',
      'Your browser opens {count} pages. Nothing gets deleted, nothing on disk moves — but once the operating system has them there is no taking them back, and closing all {count} is entirely your problem.',
      'Your browser opens {count} pages. Nothing gets deleted, nothing on disk moves — but once the operating system has them there is no taking them back, and closing all {count} is entirely your problem.'
    ),
    ladder(
      '你個瀏覽器會開 {count} 版。冇刪任何嘢，硬碟都冇改動，但交咗俾作業系統之後就收唔返，要你自己閂。',
      '你個瀏覽器會開 {count} 版。冇刪任何嘢，硬碟都冇改動，但交咗俾作業系統之後就收唔返，要你自己閂。',
      '你個瀏覽器會開 {count} 版。冇刪嘢，硬碟都冇郁過，但交咗俾作業系統就收唔返，閂返係你嘅工作。',
      '你個瀏覽器會開 {count} 版。冇刪嘢，硬碟都冇郁過 —— 但交咗俾作業系統就收唔返，閂晒 {count} 版係你自己嘅事。',
      '你個瀏覽器會開 {count} 版。冇刪嘢，硬碟都冇郁過 —— 但交咗俾作業系統就收唔返，閂晒 {count} 版係你自己嘅事。'
    )
  ),
  'changelog.openAll.done': entry(
    ladder('{count} commit pages were handed to your browser.'),
    ladder('已經將 {count} 版 commit 交咗俾你個瀏覽器。')
  ),
  'changelog.openAll.partial': entry(
    ladder('{opened} of {count} commit pages opened. {failed} were refused: {reason}'),
    ladder('{count} 版 commit 入面開咗 {opened} 版。{failed} 版俾人拒絕咗：{reason}')
  ),

  /* ---------------- settings ---------------- */

  'changelog.settings.section': entry(ladder('Changelog'), ladder('更新紀錄')),
  'changelog.settings.pageSize': entry(ladder('Versions rendered at a time'), ladder('每次畫幾多個版本')),
  'changelog.settings.pageSizeHelp': entry(
    ladder(
      'The viewer renders this many versions, then renders more as you scroll. A larger number costs more work up front on a history this long.',
      'The viewer renders this many versions, then renders more as you scroll. A larger number costs more work up front on a history this long.',
      'The viewer draws this many versions, then keeps drawing more as you scroll. Turning it up costs more work up front on a history this long.',
      'The viewer draws this many versions and then keeps going as you scroll. Turn it up and it does more work before you see anything, which on a history this long you will feel.',
      'The viewer draws this many versions and then keeps going as you scroll. Turn it up and it does more work before you see anything, which on a history this long you will feel.'
    ),
    ladder(
      '睇更新紀錄嗰陣會先畫咁多個版本，之後你捲落去先再畫。呢個數大咗，第一下就會慢啲。',
      '睇更新紀錄嗰陣會先畫咁多個版本，之後你捲落去先再畫。呢個數大咗，第一下就會慢啲。',
      '會先畫咁多個版本，你捲落去佢就繼續畫。調大咗，開頭就要做多啲嘢。',
      '會先畫咁多個版本，你捲落去佢就繼續畫。調大咗，未見到嘢之前就要做多好多功夫，歷史咁長你會感覺到。',
      '會先畫咁多個版本，你捲落去佢就繼續畫。調大咗，未見到嘢之前就要做多好多功夫，歷史咁長你會感覺到。'
    )
  ),
  'changelog.settings.showBodies': entry(ladder('Show full commit messages'), ladder('展開成段 commit 訊息')),
  'changelog.settings.showBodiesHelp': entry(
    ladder(
      'Expands every commit message inline instead of keeping it behind its own disclosure control.',
      'Expands every commit message inline instead of keeping it behind its own disclosure control.',
      'Expands every commit message inline instead of leaving each one behind its own show control.',
      'Expands every commit message inline instead of leaving each one folded away behind its own show control.',
      'Expands every commit message inline instead of leaving each one folded away behind its own show control.'
    ),
    ladder(
      '直接展開每段 commit 訊息，唔使逐個撳開。',
      '直接展開每段 commit 訊息，唔使逐個撳開。',
      '直接喺度展開每段 commit 訊息，唔使逐個撳開嚟睇。',
      '直接喺度展開每段 commit 訊息，唔使逐個撳開嚟睇，慳返啲手指力。',
      '直接喺度展開每段 commit 訊息，唔使逐個撳開嚟睇，慳返啲手指力。'
    )
  ),
  'changelog.settings.groupByCategory': entry(
    ladder('Group each version by category'),
    ladder('每個版本按分類分開排')
  ),
  'changelog.settings.groupByCategoryHelp': entry(
    ladder(
      'Groups a version\'s changes under Added, Fixed and the rest instead of listing them in commit order.',
      'Groups a version\'s changes under Added, Fixed and the rest instead of listing them in commit order.',
      'Sorts a version\'s changes under Added, Fixed and the rest instead of listing them in the order the commits landed.',
      'Sorts a version\'s changes under Added, Fixed and the rest, instead of listing them in the order the commits happened to land.',
      'Sorts a version\'s changes under Added, Fixed and the rest, instead of listing them in the order the commits happened to land.'
    ),
    ladder(
      '將一個版本嘅改動分做「新加」「整好咗」等等，唔按 commit 次序排。',
      '將一個版本嘅改動分做「新加」「整好咗」等等，唔按 commit 次序排。',
      '將一個版本嘅改動分入「新加」「整好咗」嗰啲組，唔跟 commit 落地嘅次序。',
      '將一個版本嘅改動分入「新加」「整好咗」嗰啲組，唔跟啲 commit 碰巧落地嘅次序。',
      '將一個版本嘅改動分入「新加」「整好咗」嗰啲組，唔跟啲 commit 碰巧落地嘅次序。'
    )
  ),
  'changelog.settings.copyFormat': entry(ladder('Copy format'), ladder('複製格式')),
  'changelog.settings.copyFormatHelp': entry(
    ladder(
      'Which text shape the Copy action puts on the clipboard. Both keep every commit id as text.',
      'Which text shape the Copy action puts on the clipboard. Both keep every commit id as text.',
      'Which shape the Copy action puts on the clipboard. Either way every commit id stays as text.',
      'Which shape the Copy action puts on the clipboard. Either way every commit id survives as text, so the copy is still traceable.',
      'Which shape the Copy action puts on the clipboard. Either way every commit id survives as text, so the copy is still traceable.'
    ),
    ladder(
      '「複製」會將邊種文字格式放落剪貼簿。兩種都會保留 commit id 做文字。',
      '「複製」會將邊種文字格式放落剪貼簿。兩種都會保留 commit id 做文字。',
      '「複製」放落剪貼簿嘅係邊種格式。兩種都會保住 commit id 做文字。',
      '「複製」放落剪貼簿嘅係邊種格式。兩種都會保住 commit id 做文字，追查得返。',
      '「複製」放落剪貼簿嘅係邊種格式。兩種都會保住 commit id 做文字，追查得返。'
    )
  ),
  'changelog.settings.formatMarkdown': entry(ladder('Markdown'), ladder('Markdown')),
  'changelog.settings.formatText': entry(ladder('Plain text'), ladder('純文字')),
  'changelog.settings.rememberView': entry(
    ladder('Remember the last search and date range'),
    ladder('記住上次嘅搜尋同日期範圍')
  ),
  'changelog.settings.rememberViewHelp': entry(
    ladder(
      'Restores the plain-text search, the date range, the categories and both switches the next time the changelog opens. A regular expression is deliberately NOT restored: the field would read as plain text while filtering as a pattern. The stored view is recorded in local history like any other setting, so an earlier one can be restored.',
      'Restores the plain-text search, the date range, the categories and both switches the next time the changelog opens. A regular expression is deliberately NOT restored: the field would read as plain text while filtering as a pattern. The stored view is recorded in local history like any other setting, so an earlier one can be restored.',
      'Brings back the plain-text search, the date range, the categories and both switches next time you open the changelog. A regular expression is deliberately left behind, because the field would read as plain text while quietly filtering as a pattern. The stored view goes into local history like any other setting, so you can put an earlier one back.',
      'Brings back the plain-text search, the date range, the categories and both switches next time you open the changelog. A regular expression is deliberately left behind — restoring it would leave the field reading as plain text while it quietly filtered as a pattern, which is the sort of thing that costs an afternoon. The stored view lands in local history like any other setting, so an earlier one can always come back.',
      'Brings back the plain-text search, the date range, the categories and both switches next time you open the changelog. A regular expression is deliberately left behind — restoring it would leave the field reading as plain text while it quietly filtered as a pattern, which is the sort of thing that costs an afternoon. The stored view lands in local history like any other setting, so an earlier one can always come back.'
    ),
    ladder(
      '下次開更新紀錄，會還原純文字搜尋、日期範圍、分類同兩個開關。正則表達式係故意唔還原嘅：唔係嘅話個欄位會顯示純文字，實際卻用圖樣篩選。呢個記低咗嘅檢視同其他設定一樣入本機歷史，可以還原返舊嗰個。',
      '下次開更新紀錄，會還原純文字搜尋、日期範圍、分類同兩個開關。正則表達式係故意唔還原嘅：唔係嘅話個欄位會顯示純文字，實際卻用圖樣篩選。呢個記低咗嘅檢視同其他設定一樣入本機歷史，可以還原返舊嗰個。',
      '下次開更新紀錄會攞返你嘅純文字搜尋、日期範圍、分類同兩個開關。正則表達式就故意唔攞返，因為個欄位會顯示純文字但暗地裡用圖樣篩選。記低咗嘅檢視同其他設定一樣入本機歷史，舊嗰個都還原到。',
      '下次開更新紀錄會攞返你嘅純文字搜尋、日期範圍、分類同兩個開關。正則表達式就故意唔攞返 —— 唔係個欄位會扮住純文字，暗地裡用緊圖樣篩選，呢種嘢一搞就搞成日。記低咗嘅檢視同其他設定一樣入本機歷史，幾時想攞返舊嗰個都得。',
      '下次開更新紀錄會攞返你嘅純文字搜尋、日期範圍、分類同兩個開關。正則表達式就故意唔攞返 —— 唔係個欄位會扮住純文字，暗地裡用緊圖樣篩選，呢種嘢一搞就搞成日。記低咗嘅檢視同其他設定一樣入本機歷史，幾時想攞返舊嗰個都得。'
    )
  ),
  'changelog.settings.open': entry(ladder('Open the changelog'), ladder('打開更新紀錄')),
  'changelog.settings.openHelp': entry(
    ladder(
      'Opens the changelog destination, where every released version and the commit behind each change is listed.',
      'Opens the changelog destination, where every released version and the commit behind each change is listed.',
      'Opens the changelog, where every released version and the commit behind each change is listed.',
      'Opens the changelog, where every version ever released is listed along with the commit behind each change.',
      'Opens the changelog, where every version ever released is listed along with the commit behind each change.'
    ),
    ladder(
      '打開更新紀錄，入面列晒每個發佈過嘅版本，同埋每項改動背後嘅 commit。',
      '打開更新紀錄，入面列晒每個發佈過嘅版本，同埋每項改動背後嘅 commit。',
      '打開更新紀錄，入面列晒每個發佈過嘅版本同每項改動背後嘅 commit。',
      '打開更新紀錄，由頭到尾每個發佈過嘅版本，連每項改動背後嘅 commit 都列晒。',
      '打開更新紀錄，由頭到尾每個發佈過嘅版本，連每項改動背後嘅 commit 都列晒。'
    )
  ),
  'changelog.settings.provenanceNote': entry(
    ladder('The changelog itself is generated at build time and is not a setting you can edit here.'),
    ladder('更新紀錄本身係 build 嗰陣產生嘅，唔係喺呢度改得嘅設定。')
  ),

  /* ---------------- palette ---------------- */

  'changelog.palette.open': entry(ladder('Changelog: every released version'), ladder('更新紀錄：每個發佈過嘅版本')),
  'changelog.palette.copy': entry(ladder('Changelog: copy the current view'), ladder('更新紀錄：複製而家見到嘅嘢')),
  'changelog.palette.exportMarkdown': entry(
    ladder('Changelog: export the current view as Markdown'),
    ladder('更新紀錄：將而家見到嘅匯出做 Markdown')
  ),
  'changelog.palette.exportText': entry(
    ladder('Changelog: export the current view as plain text'),
    ladder('更新紀錄：將而家見到嘅匯出做純文字')
  ),
  'changelog.palette.latest': entry(ladder('Changelog: go to the newest version'), ladder('更新紀錄：跳去最新版本')),
  'changelog.palette.notOpen': entry(
    ladder('The changelog was opened first, because that action works on what it is showing.'),
    ladder('先幫你打開咗更新紀錄，因為嗰個動作係對住佢顯示緊嘅嘢做。')
  )
};
