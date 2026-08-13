import type { Catalogue, FunnyLadder, TranslationEntry } from '../../core/registry';

/**
 * Every piece of copy this feature renders.
 *
 * The funny level styles the VOICE and never the FACTS. A ladder here says the
 * same thing at rung 1 and rung 5: the same preset, the same file, the same
 * number of overrides, the same warning about what cannot be undone. Anything a
 * reader would need in order to decide is present at every level.
 *
 * The two languages are independent, because English at 1 beside Cantonese at 5
 * is a combination somebody will genuinely choose and both halves have to read
 * correctly in it.
 */

/**
 * Expands a short ladder to all five levels.
 *
 * One string means the copy really does read the same at every level, which is
 * right for a bare noun. Two means serious and playful. Three means serious,
 * middle, playful. Five is written out in full.
 */
function ladder(...steps: string[]): FunnyLadder {
  if (steps.length === 0) throw new Error('A ladder needs at least one string.');
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

export const APPEARANCE_STRINGS: Catalogue = {
  /* ---------------- the destination ---------------- */

  'appearance.tab.title': entry(ladder('Appearance'), ladder('外觀')),
  'appearance.tab.subtitle': entry(
    ladder(
      'Theme, typography, presets and every rendered element.',
      'Theme, typography, presets and every rendered element.',
      'Theme, type, presets, and every last pixel this window paints.',
      'Theme, type, presets, and every last pixel this window paints. Go on, redecorate.',
      'Theme, type, presets, and every last pixel this window paints. Redecorate away — nothing here is load-bearing.'
    ),
    ladder(
      '主題、字體、預設，同埋每一個畫出嚟嘅元素。',
      '主題、字體、預設，同埋每一個畫出嚟嘅元素。',
      '主題、字體、預設，同埋成個窗畫出嚟嘅每一件嘢。',
      '主題、字體、預設，同埋成個窗畫出嚟嘅每一件嘢，隨你砌。',
      '主題、字體、預設，同埋成個窗畫出嚟嘅每一件嘢。放心砌，冇一樣係拆咗會冧樓嘅。'
    )
  ),

  'appearance.section.theme': entry(ladder('Theme'), ladder('主題')),
  'appearance.section.typography': entry(ladder('Typography'), ladder('字體排版')),
  'appearance.section.presets': entry(ladder('Presets and saved themes'), ladder('預設同已存主題')),
  'appearance.section.elements': entry(ladder('Rendered elements'), ladder('畫出嚟嘅元素')),
  'appearance.section.transfer': entry(ladder('Export and import'), ladder('匯出同匯入')),

  /* ---------------- theme controls ---------------- */

  'appearance.theme.mode': entry(ladder('Colour scheme'), ladder('色系')),
  'appearance.theme.mode.light': entry(ladder('Light'), ladder('淺色')),
  'appearance.theme.mode.dark': entry(ladder('Dark'), ladder('深色')),
  'appearance.theme.mode.system': entry(ladder('Follow the system'), ladder('跟系統')),
  'appearance.theme.contrast': entry(ladder('Contrast'), ladder('對比度')),
  'appearance.theme.contrast.standard': entry(ladder('Standard'), ladder('標準')),
  'appearance.theme.contrast.medium': entry(ladder('Medium'), ladder('中')),
  'appearance.theme.contrast.high': entry(ladder('High'), ladder('高')),
  'appearance.theme.density': entry(ladder('Density'), ladder('密度')),
  'appearance.theme.seed': entry(ladder('Accent colour'), ladder('主色')),
  'appearance.theme.seedOpen': entry(ladder('Choose the accent colour'), ladder('揀主色')),
  'appearance.theme.preview': entry(ladder('Live preview'), ladder('即時預覽')),
  'appearance.theme.previewNote': entry(
    ladder(
      'Every control below is the real one. Changing it changes this window immediately, with no restart.',
      'Every control below is the real one. Changing it changes this window immediately, with no restart.',
      'These are the real controls. Move one and the window changes under your hands — no restart, no ceremony.',
      'These are the real controls. Move one and the window changes under your hands. No restart, no ceremony.',
      'Real controls, not a photograph of some. Move one and the window changes while you watch — no restart, no ceremony, no "please close and reopen".'
    ),
    ladder(
      '下面全部都係真控制項。㩒一下即刻變，唔使重開程式。',
      '下面全部都係真控制項。㩒一下即刻變，唔使重開程式。',
      '呢啲係真嘢嚟㗎。撳落去成個窗即刻跟住變，唔使重開。',
      '呢啲係真嘢嚟㗎，唔係影相。撳落去成個窗即刻跟住變，唔使重開。',
      '呢啲係真控制項，唔係影張相貼上去。撳落去成個窗即刻喺你眼前變，唔使重開，唔使等，冇「請關閉再開啟」嗰套。'
    )
  ),
  'appearance.theme.tokenRoles': entry(ladder('Colour roles'), ladder('顏色角色')),
  'appearance.theme.resetTheme': entry(ladder('Reset the theme values'), ladder('重設主題數值')),

  /* ---------------- typography ---------------- */

  'appearance.type.family': entry(ladder('Interface typeface'), ladder('介面字體')),
  'appearance.type.familySearch': entry(ladder('Search typefaces'), ladder('搵字體')),
  'appearance.type.systemDefault': entry(ladder('System default'), ladder('系統預設')),
  'appearance.type.custom': entry(ladder('A family that is not in the list'), ladder('唔喺清單入面嘅字體')),
  'appearance.type.customHint': entry(
    ladder(
      'Type an exact family name. If this machine does not have it, the name is kept and the bundled stack renders instead.',
      'Type an exact family name. If this machine does not have it, the name is kept and the bundled stack renders instead.',
      'Type the exact family name. If this machine has never heard of it, your text stays exactly as you typed it and the bundled stack does the drawing.',
      'Type the exact family name. If this machine has never heard of it, your text stays exactly as you typed it and the bundled stack does the drawing.',
      'Type the exact family name. If this machine has never heard of it, nothing is thrown away — your text stays exactly as you typed it and the bundled stack quietly does the drawing.'
    ),
    ladder(
      '輸入完整字體名。如果部機冇呢隻字體，你輸入嘅名會保留，改用內建字體堆疊顯示。',
      '輸入完整字體名。如果部機冇呢隻字體，你輸入嘅名會保留，改用內建字體堆疊顯示。',
      '打完整字體名。部機冇嘅話，你打嘅嘢一個字都唔會唔見，改由內建字體堆疊出手。',
      '打完整字體名。部機冇嘅話，你打嘅嘢一個字都唔會唔見，改由內建字體堆疊出手。',
      '打完整字體名。部機從來未聽過呢隻字體都唔緊要，你打嘅嘢一個字都唔會唔見，靜靜雞由內建字體堆疊頂上。'
    )
  ),
  'appearance.type.notInstalled': entry(
    ladder('"{family}" is not installed on this computer. Your choice is kept; the bundled stack renders in its place.'),
    ladder('呢部電腦冇裝「{family}」。你嘅選擇會保留，暫時用內建字體堆疊顯示。')
  ),
  'appearance.type.installed': entry(
    ladder('"{family}" is installed on this computer and is rendering now.'),
    ladder('呢部電腦有「{family}」，而家就係用緊佢顯示。')
  ),
  'appearance.type.scale': entry(ladder('Text size'), ladder('字大細')),
  'appearance.type.weight': entry(ladder('Text weight'), ladder('字粗幼')),
  'appearance.type.sample': entry(ladder('Sample text'), ladder('樣本文字')),
  'appearance.type.scaleReadout': entry(
    ladder('Body text renders at {px} CSS pixels, which is {pt} points at 96 dpi.'),
    ladder('正文會用 {px} CSS 像素顯示，即係喺 96 dpi 之下嘅 {pt} 點。')
  ),
  'appearance.type.cjkNote': entry(
    ladder(
      'The Chinese line is the fallback check: a family with no Chinese coverage still renders it from the bundled stack rather than as empty boxes.',
      'The Chinese line is the fallback check: a family with no Chinese coverage still renders it from the bundled stack rather than as empty boxes.',
      'The Chinese line is there on purpose. A family with no Chinese in it still draws that line from the bundled stack instead of a row of little empty boxes.',
      'The Chinese line is there on purpose. A family with no Chinese in it still draws that line from the bundled stack instead of a row of little empty boxes.',
      'The Chinese line earns its keep: pick a family with no Chinese coverage and it is still drawn properly from the bundled stack, rather than the row of little empty boxes that means a font gave up.'
    ),
    ladder(
      '中文嗰行係用嚟檢查後備字體：就算揀咗隻冇中文嘅字體，都會用內建字體堆疊畫出嚟，唔會變豆腐方格。',
      '中文嗰行係用嚟檢查後備字體：就算揀咗隻冇中文嘅字體，都會用內建字體堆疊畫出嚟，唔會變豆腐方格。',
      '中文嗰行係特登擺喺度。揀到隻冇中文嘅字體，佢照樣用內建字體堆疊幫你畫返出嚟，唔會變一行豆腐。',
      '中文嗰行係特登擺喺度。揀到隻冇中文嘅字體，佢照樣用內建字體堆疊幫你畫返出嚟，唔會變一行豆腐。',
      '中文嗰行唔係擺設：揀到隻完全冇中文嘅字體，佢照樣用內建字體堆疊靚靚地畫返出嚟，唔會出現一行代表「字體投降」嘅豆腐方格。'
    )
  ),

  /* ---------------- presets ---------------- */

  'appearance.preset.apply': entry(ladder('Apply'), ladder('套用')),
  'appearance.preset.applied': entry(
    ladder('Applied the "{name}" preset. It changed {count} value(s).'),
    ladder('已套用「{name}」預設，改咗 {count} 個數值。')
  ),
  'appearance.preset.appliedNothing': entry(
    ladder('The "{name}" preset was already the current appearance. Nothing changed.'),
    ladder('「{name}」預設同而家嘅外觀一模一樣，冇嘢改到。')
  ),
  'appearance.preset.undo': entry(ladder('Put the previous appearance back'), ladder('還原返上一個外觀')),
  'appearance.preset.undone': entry(
    ladder('The appearance from before the preset was restored.'),
    ladder('已經還原返套用預設之前嘅外觀。')
  ),
  'appearance.preset.save': entry(ladder('Save the current appearance as a preset'), ladder('將而家嘅外觀存做預設')),
  'appearance.preset.saveName': entry(ladder('Preset name'), ladder('預設名')),
  'appearance.preset.saveNote': entry(ladder('Note (optional)'), ladder('備註（可以唔填）')),
  'appearance.preset.saved': entry(
    ladder('Saved "{name}". It carries {theme} theme value(s) and {overrides} element override(s).'),
    ladder('已儲存「{name}」，入面有 {theme} 個主題數值同 {overrides} 個元素覆寫。')
  ),
  'appearance.preset.rename': entry(ladder('Rename'), ladder('改名')),
  'appearance.preset.duplicate': entry(ladder('Duplicate'), ladder('複製一份')),
  'appearance.preset.delete': entry(ladder('Delete'), ladder('刪除')),
  'appearance.preset.exportOne': entry(ladder('Export to a file'), ladder('匯出做檔案')),
  'appearance.preset.search': entry(ladder('Search presets'), ladder('搵預設')),
  'appearance.preset.exportList': entry(ladder('Export the preset list'), ladder('匯出預設清單')),
  'appearance.preset.exportListNote': entry(
    ladder(
      'This writes the preset list as a table. To write a preset you can import again, use "Export to a file" on the preset itself.'
    ),
    ladder('呢個係將預設清單寫成一張表。想寫個可以再匯入嘅預設，就用預設自己嗰個「匯出做檔案」。')
  ),
  'appearance.preset.kind.application': entry(ladder('Provided by the application'), ladder('程式內建')),
  'appearance.preset.kind.saved': entry(ladder('Saved by you'), ladder('你儲存嘅')),
  'appearance.preset.observed': entry(
    ladder('Last time this was applied it set: {summary}'),
    ladder('上次套用嗰陣佢設定咗：{summary}')
  ),
  'appearance.preset.unobserved': entry(
    ladder(
      'This preset ships with the application. The exact values it sets are listed here the first time it is applied, and the appearance it replaced can be put back from the notification or from local history.',
      'This preset ships with the application. The exact values it sets are listed here the first time it is applied, and the appearance it replaced can be put back from the notification or from local history.',
      'This one ships with the application, so its exact values are listed here the moment you apply it once. Whatever it replaces can be put straight back from the notification or from local history.',
      'This one ships with the application, so its exact values are listed here the moment you apply it once. Whatever it replaces can be put straight back from the notification or from local history.',
      'This one ships with the application, so its exact values get listed here the moment you apply it once. Nothing is lost in the meantime: whatever it replaced can be put straight back from the notification, or dug out of local history later.'
    ),
    ladder(
      '呢個預設係程式內建。第一次套用之後，佢實際設定咗咩數值就會列喺呢度；被換走嘅外觀可以喺通知或者本機歷史度還原返。',
      '呢個預設係程式內建。第一次套用之後，佢實際設定咗咩數值就會列喺呢度；被換走嘅外觀可以喺通知或者本機歷史度還原返。',
      '呢個係程式內建嘅。套用一次之後，佢實際改咗啲乜就會即刻列喺呢度。原本嗰個外觀可以喺通知度一撳還原，或者去本機歷史揾返。',
      '呢個係程式內建嘅。套用一次之後，佢實際改咗啲乜就會即刻列喺呢度。原本嗰個外觀可以喺通知度一撳還原，或者去本機歷史揾返。',
      '呢個係程式內建嘅。套用一次之後，佢實際改咗啲乜就會即刻列喺呢度。中間都唔會蝕底：原本嗰個外觀喺通知度一撳就還原到，遲啲想揾都可以喺本機歷史度掘返出嚟。'
    )
  ),
  'appearance.preset.emptyTitle': entry(ladder('You have not saved a preset yet'), ladder('你未儲存過任何預設')),
  'appearance.preset.emptyBody': entry(
    ladder(
      'Set the theme and typography the way you want them, then save that state under a name. A saved preset is a file you can export, keep and re-import after a reinstall.',
      'Set the theme and typography the way you want them, then save that state under a name. A saved preset is a file you can export, keep and re-import after a reinstall.',
      'Get the theme and type exactly how you like them, then bottle it under a name. A saved preset exports to a file, so a reinstall costs you nothing.',
      'Get the theme and type exactly how you like them, then bottle it under a name. A saved preset exports to a file, so a reinstall costs you nothing.',
      'Get the theme and type exactly how you like them, then bottle the lot under a name. A saved preset exports to a real file, so the next reinstall costs you precisely nothing.'
    ),
    ladder(
      '將主題同字體調校到你想要嘅樣，然後改個名存起。存咗嘅預設可以匯出做檔案，重裝之後再匯入返。',
      '將主題同字體調校到你想要嘅樣，然後改個名存起。存咗嘅預設可以匯出做檔案，重裝之後再匯入返。',
      '將主題同字體調到你啱心水，再改個名收起佢。存咗嘅預設可以匯出做檔案，重裝都唔會蝕底。',
      '將主題同字體調到你啱心水，再改個名收起佢。存咗嘅預設可以匯出做檔案，重裝都唔會蝕底。',
      '將主題同字體調到你完全啱心水，再改個名成份收起佢。存咗嘅預設可以匯出做真檔案，下次重裝一啲都唔蝕底。'
    )
  ),
  'appearance.preset.selection': entry(
    ladder('{selected} of {shown} shown selected, out of {total} in total.'),
    ladder('喺顯示緊嘅 {shown} 個之中揀咗 {selected} 個，全部合共 {total} 個。')
  ),
  'appearance.preset.selectAllShown': entry(ladder('Select the {count} shown'), ladder('揀晒顯示緊嘅 {count} 個')),
  'appearance.preset.selectAllEverything': entry(ladder('Select all {count}'), ladder('揀晒全部 {count} 個')),
  'appearance.preset.invertSelection': entry(ladder('Invert the selection'), ladder('反轉選擇')),
  'appearance.preset.clearSelection': entry(ladder('Clear the selection'), ladder('清除選擇')),
  'appearance.preset.bulkDelete': entry(ladder('Delete the selected presets'), ladder('刪除揀咗嘅預設')),
  'appearance.preset.bulkExport': entry(ladder('Export the selected presets'), ladder('匯出揀咗嘅預設')),
  'appearance.preset.bulkRename': entry(ladder('Rename the selected by pattern'), ladder('用格式一次過改名')),
  'appearance.preset.bulkPattern': entry(ladder('Name pattern, where {name} is the old name'), ladder('名格式，{name} 代表舊名')),
  'appearance.preset.bulkApplyBlocked': entry(
    ladder('Apply works on one preset at a time, because only one appearance can be in effect.'),
    ladder('套用一次淨係做得一個，因為同一時間淨係可以有一個外觀生效。')
  ),
  'appearance.preset.bulkOnlySaved': entry(
    ladder('Only presets you saved can be renamed or deleted. Application presets are part of the build.'),
    ladder('淨係你自己存嘅預設先可以改名或者刪除，程式內建嗰啲係build入面嘅嘢。')
  ),
  'appearance.preset.previewBulk': entry(
    ladder('{count} preset(s) will be affected: {names}'),
    ladder('會影響 {count} 個預設：{names}')
  ),
  'appearance.preset.nameTaken': entry(
    ladder('"{name}" is already the name of a preset. Choose another name.'),
    ladder('已經有個預設叫「{name}」，改個第二個名啦。')
  ),
  'appearance.preset.nameEmpty': entry(
    ladder('A preset needs a name of at least one character.'),
    ladder('預設至少要有一個字嘅名。')
  ),

  /* ---------------- elements ---------------- */

  'appearance.elements.search': entry(ladder('Search rendered elements'), ladder('搵畫出嚟嘅元素')),
  'appearance.elements.edit': entry(ladder('Edit appearance…'), ladder('改外觀…')),
  'appearance.elements.reset': entry(ladder('Reset this element'), ladder('重設呢個元素')),
  'appearance.elements.lock': entry(ladder('Lock this element…'), ladder('鎖住呢個元素…')),
  'appearance.elements.overrideCount': entry(
    ladder('{count} override(s) on {selector}'),
    ladder('{selector} 上面有 {count} 個覆寫')
  ),
  'appearance.elements.none': entry(ladder('No overrides on {selector}'), ladder('{selector} 上面冇覆寫')),
  'appearance.elements.note': entry(
    ladder(
      'Each sample below is a real control built from the same component kit as the rest of the window, and the editor it opens writes to the real selector named beside it — so an edit here reaches the application chrome, not a copy of it.',
      'Each sample below is a real control built from the same component kit as the rest of the window, and the editor it opens writes to the real selector named beside it — so an edit here reaches the application chrome, not a copy of it.',
      'Every sample below is a real control from the same kit as the rest of the window, and the editor writes to the real selector printed beside it. Edit here and the actual chrome changes, not a photograph of it.',
      'Every sample below is a real control from the same kit as the rest of the window, and the editor writes to the real selector printed beside it. Edit here and the actual chrome changes, not a photograph of it.',
      'Every sample below is a real control from the same kit as the rest of the window, and the editor writes to the real selector printed beside it. Edit one and the actual chrome changes — this is not a museum exhibit with a rope in front of it.'
    ),
    ladder(
      '下面每個樣本都係用返同一套組件砌出嚟嘅真控制項，開出嚟嘅編輯器係寫落隔籬寫住嗰個真選擇器，所以喺呢度改係改到程式本身，唔係改個複製品。',
      '下面每個樣本都係用返同一套組件砌出嚟嘅真控制項，開出嚟嘅編輯器係寫落隔籬寫住嗰個真選擇器，所以喺呢度改係改到程式本身，唔係改個複製品。',
      '下面每個樣本都係真控制項，編輯器係寫落隔籬印住嗰個真選擇器。喺呢度改，係改到真嘅程式外殼，唔係改張相。',
      '下面每個樣本都係真控制項，編輯器係寫落隔籬印住嗰個真選擇器。喺呢度改，係改到真嘅程式外殼，唔係改張相。',
      '下面每個樣本都係真控制項，編輯器係寫落隔籬印住嗰個真選擇器。改一個，真嘅程式外殼就跟住變，唔係擺喺欄杆後面畀你睇嘅博物館展品。'
    )
  ),
  'appearance.elements.bulkReset': entry(ladder('Reset the selected elements'), ladder('重設揀咗嘅元素')),
  'appearance.elements.bulkExport': entry(ladder('Export the selected overrides'), ladder('匯出揀咗嘅覆寫')),
  'appearance.elements.showNotification': entry(ladder('Raise a real notification'), ladder('出一個真通知')),
  'appearance.elements.editSelf': entry(
    ladder('Open the appearance editor on the appearance editor'),
    ladder('用外觀編輯器改外觀編輯器自己')
  ),
  'appearance.elements.openMenu': entry(ladder('Open a real menu'), ladder('開一個真選單')),
  'appearance.elements.openDialog': entry(ladder('Open a real dialog'), ladder('開一個真對話框')),
  'appearance.elements.openSettings': entry(ladder('Open the settings surface'), ladder('開設定頁面')),
  'appearance.elements.fieldSupport': entry(
    ladder('Supporting text sits under the field.'),
    ladder('輔助文字放喺欄位下面。')
  ),
  'appearance.elements.emptyExplain': entry(
    ladder('An empty state says what is missing and offers the action that fills it.'),
    ladder('空白狀態會講清楚缺咗啲乜，同埋畀返個補得返嘅動作你。')
  ),
  'appearance.elements.groupExplain': entry(
    ladder(
      'A group header appears in the tab strip once a group exists. Editing this category changes every group header, including the ones created later.'
    ),
    ladder('一有分組，分組標題就會喺分頁條度出現。改呢一類會影響全部分組標題，包括之後先開嘅。')
  ),
  'appearance.elements.confirmExplain': entry(
    ladder(
      'The two-key gate appears whenever an irreversible action is taken, such as deleting saved presets on this same page. It is not opened here for a pretend action, but editing this category changes the gate wherever it genuinely appears.'
    ),
    ladder(
      '兩條鎖匙嘅關卡係做唔可逆嘅動作嗰陣先出現，例如喺同一版度刪除已存嘅預設。呢度唔會為咗做戲而開佢，但係改呢一類，關卡真係出現嗰陣就會跟住變。'
    )
  ),
  'appearance.elements.dateLabel': entry(ladder('Date'), ladder('日期')),

  /* ---------------- export and import ---------------- */

  'appearance.transfer.exportTheme': entry(ladder('Export the current appearance'), ladder('匯出而家嘅外觀')),
  'appearance.transfer.importTheme': entry(ladder('Import an appearance file'), ladder('匯入外觀檔案')),
  'appearance.transfer.exportOverrides': entry(ladder('Export the override table'), ladder('匯出覆寫表')),
  'appearance.transfer.format': entry(ladder('Format'), ladder('格式')),
  'appearance.transfer.saved': entry(ladder('Written to {path}'), ladder('已經寫入 {path}')),
  'appearance.transfer.openInEditor': entry(ladder('Open it in the external editor'), ladder('用外部編輯器開佢')),
  'appearance.transfer.importMode': entry(ladder('How an import combines with what is here'), ladder('匯入點樣同而家嘅嘢合併')),
  'appearance.transfer.importMode.replace': entry(ladder('Replace the current overrides'), ladder('取代而家嘅覆寫')),
  'appearance.transfer.importMode.merge': entry(ladder('Merge into the current overrides'), ladder('合併入而家嘅覆寫')),
  'appearance.transfer.imported': entry(
    ladder('Imported {theme} theme value(s) and {overrides} element override(s) from {path}.'),
    ladder('已經由 {path} 匯入咗 {theme} 個主題數值同 {overrides} 個元素覆寫。')
  ),
  'appearance.transfer.rejected': entry(
    ladder('That file was refused and nothing was changed. {reason}'),
    ladder('嗰個檔案唔收，乜都冇改到。{reason}')
  ),
  'appearance.transfer.unapplied': entry(
    ladder(
      '{count} entry from that file could not be applied by this version. It has been kept exactly as written and is listed below; nothing was discarded.',
      '{count} entry from that file could not be applied by this version. It has been kept exactly as written and is listed below; nothing was discarded.',
      '{count} entry in that file means nothing to this version. It has been kept byte for byte and listed below — this application does not quietly bin things it does not recognise.',
      '{count} entry in that file means nothing to this version. It has been kept byte for byte and listed below — this application does not quietly bin things it does not recognise.',
      '{count} entry in that file means nothing to this version. It has been kept byte for byte and listed below, because quietly binning the bits it did not recognise is exactly the trick this application refuses to pull.'
    ),
    ladder(
      '嗰個檔案有 {count} 項呢個版本套用唔到。原文照樣保留，列咗喺下面，冇掉任何嘢。',
      '嗰個檔案有 {count} 項呢個版本套用唔到。原文照樣保留，列咗喺下面，冇掉任何嘢。',
      '嗰個檔案有 {count} 項呢個版本睇唔明。原文一個字都冇改咁保留咗，列晒喺下面 —— 呢個程式唔會靜靜雞掉你啲嘢。',
      '嗰個檔案有 {count} 項呢個版本睇唔明。原文一個字都冇改咁保留咗，列晒喺下面 —— 呢個程式唔會靜靜雞掉你啲嘢。',
      '嗰個檔案有 {count} 項呢個版本睇唔明。原文一個字都冇改咁保留咗，列晒喺下面，因為靜靜雞掉走睇唔明嘅嘢，正正就係呢個程式唔會做嘅嘢。'
    )
  ),
  'appearance.transfer.unappliedTitle': entry(ladder('Kept but not applied'), ladder('保留咗但未套用')),
  'appearance.transfer.unappliedExport': entry(ladder('Export the kept entries'), ladder('匯出保留咗嘅項目')),
  'appearance.transfer.unappliedClear': entry(ladder('Discard the kept entries'), ladder('掉走保留咗嘅項目')),
  'appearance.transfer.unappliedEmpty': entry(
    ladder('Nothing has been kept back from an import.'),
    ladder('冇任何嘢係匯入時保留低嘅。')
  ),
  'appearance.transfer.losses': entry(
    ladder('This format cannot carry: {fields}. Choose another format if that matters.'),
    ladder('呢個格式載唔到：{fields}。如果緊要嘅話揀第二個格式。')
  ),
  'appearance.transfer.noLosses': entry(
    ladder('This format carries every field faithfully.'),
    ladder('呢個格式可以完整咁載晒每一個欄位。')
  ),

  /* ---------------- settings ---------------- */

  'appearance.setting.section': entry(ladder('Appearance studio'), ladder('外觀工作室')),
  'appearance.setting.livePreview': entry(ladder('Apply while a slider is moving'), ladder('拖動滑桿時即時套用')),
  'appearance.setting.livePreview.description': entry(
    ladder(
      'On, the window repaints on every step of a slider, which is how you see a density or size change as you choose it. Off, the change is applied when you let go, which is steadier on a slow machine.',
      'On, the window repaints on every step of a slider, which is how you see a density or size change as you choose it. Off, the change is applied when you let go, which is steadier on a slow machine.',
      'On, the window repaints at every step of the slider, so you see the size or density land as you drag. Off, it waits until you let go — kinder to a tired machine.',
      'On, the window repaints at every step of the slider, so you see the size or density land as you drag. Off, it waits until you let go — kinder to a tired machine.',
      'On, the window repaints at every step of the slider, so you watch the size or density land under your thumb. Off, it politely waits until you let go, which a tired machine will thank you for.'
    ),
    ladder(
      '開咗嘅話，拖滑桿每一格個窗都會即刻重畫，咁你揀嗰陣就見到密度或者大細嘅變化。閂咗嘅話，放手先套用，喺慢機上面順滑啲。',
      '開咗嘅話，拖滑桿每一格個窗都會即刻重畫，咁你揀嗰陣就見到密度或者大細嘅變化。閂咗嘅話，放手先套用，喺慢機上面順滑啲。',
      '開咗，拖到邊個窗就重畫到邊，大細同密度即刻見到。閂咗，等你放手先變，慢機會舒服好多。',
      '開咗，拖到邊個窗就重畫到邊，大細同密度即刻見到。閂咗，等你放手先變，慢機會舒服好多。',
      '開咗，你拖到邊個窗就跟到邊，大細同密度喺你手指底下即刻定形。閂咗，佢會好禮貌咁等你放手先郁，部老爺機會多謝你。'
    )
  ),
  'appearance.setting.sampleText': entry(ladder('Text used in the previews'), ladder('預覽用嘅文字')),
  'appearance.setting.sampleText.description': entry(
    ladder(
      'The line shown in the typography preview and in every element sample. Leave it empty to use the shipped sample, which includes Latin, digits and Chinese so a missing glyph is visible.',
      'The line shown in the typography preview and in every element sample. Leave it empty to use the shipped sample, which includes Latin, digits and Chinese so a missing glyph is visible.',
      'The line the typography preview and every element sample shows. Leave it empty for the shipped sample, which has Latin, digits and Chinese in it so a missing glyph cannot hide.',
      'The line the typography preview and every element sample shows. Leave it empty for the shipped sample, which has Latin, digits and Chinese in it so a missing glyph cannot hide.',
      'The line the typography preview and every element sample shows. Leave it empty for the shipped sample, which deliberately mixes Latin, digits and Chinese so a missing glyph has nowhere to hide.'
    ),
    ladder(
      '字體預覽同每個元素樣本顯示嘅嗰行字。留白就用內建樣本，入面有拉丁字母、數字同中文，缺字嘅話一眼睇到。',
      '字體預覽同每個元素樣本顯示嘅嗰行字。留白就用內建樣本，入面有拉丁字母、數字同中文，缺字嘅話一眼睇到。',
      '字體預覽同每個元素樣本show嗰行字。留白就用內建樣本，有拉丁字母、數字同中文，缺字匿唔到。',
      '字體預覽同每個元素樣本show嗰行字。留白就用內建樣本，有拉丁字母、數字同中文，缺字匿唔到。',
      '字體預覽同每個元素樣本show嗰行字。留白就用內建樣本，特登溝埋拉丁字母、數字同中文，邊個字缺咗都匿唔到。'
    )
  ),
  'appearance.setting.includeOverrides': entry(
    ladder('Include per-element overrides when exporting'),
    ladder('匯出時包埋每個元素嘅覆寫')
  ),
  'appearance.setting.includeOverrides.description': entry(
    ladder(
      'On, an exported appearance file carries the theme values and every per-element override. Off, it carries the theme values alone, which is the smaller and more portable file.',
      'On, an exported appearance file carries the theme values and every per-element override. Off, it carries the theme values alone, which is the smaller and more portable file.',
      'On, the exported file carries the theme and every per-element override you have made. Off, it carries the theme alone — smaller, and easier to hand to somebody else.',
      'On, the exported file carries the theme and every per-element override you have made. Off, it carries the theme alone — smaller, and easier to hand to somebody else.',
      'On, the exported file carries the theme plus every per-element override you have ever made. Off, it carries the theme alone: smaller, tidier, and much easier to hand to somebody else without explaining yourself.'
    ),
    ladder(
      '開咗，匯出嘅外觀檔案會包主題數值同每一個元素覆寫。閂咗就淨係得主題數值，檔案細啲，方便傳。',
      '開咗，匯出嘅外觀檔案會包主題數值同每一個元素覆寫。閂咗就淨係得主題數值，檔案細啲，方便傳。',
      '開咗，匯出嘅檔案有主題同你改過嘅每一個元素覆寫。閂咗淨係得主題 —— 細啲，畀人都易啲。',
      '開咗，匯出嘅檔案有主題同你改過嘅每一個元素覆寫。閂咗淨係得主題 —— 細啲，畀人都易啲。',
      '開咗，匯出嘅檔案會連你歷來改過嘅每一個元素覆寫都帶埋。閂咗淨係得主題：細啲、整齊啲，畀人嗰陣都唔使解釋咁多。'
    )
  ),
  'appearance.setting.importMode.description': entry(
    ladder(
      'Replace removes the current per-element overrides before writing the imported ones. Merge keeps yours and lets the file win where the same element and property appear in both. The theme values are always taken from the file.',
      'Replace removes the current per-element overrides before writing the imported ones. Merge keeps yours and lets the file win where the same element and property appear in both. The theme values are always taken from the file.',
      'Replace clears your per-element overrides first, then writes the file\'s. Merge keeps yours and lets the file win only where both name the same element and property. Theme values always come from the file.',
      'Replace clears your per-element overrides first, then writes the file\'s. Merge keeps yours and lets the file win only where both name the same element and property. Theme values always come from the file.',
      'Replace sweeps your per-element overrides away first and writes the file\'s. Merge keeps yours and lets the file win only where both point at the same element and the same property. Either way the theme values come from the file.'
    ),
    ladder(
      '「取代」會先清走而家嘅元素覆寫，再寫入匯入嗰啲。「合併」會保留你嘅，兩邊指住同一個元素同同一項屬性嗰陣先由檔案話事。主題數值一定跟檔案。',
      '「取代」會先清走而家嘅元素覆寫，再寫入匯入嗰啲。「合併」會保留你嘅，兩邊指住同一個元素同同一項屬性嗰陣先由檔案話事。主題數值一定跟檔案。',
      '「取代」先掃走你嘅元素覆寫，再寫檔案嗰啲。「合併」保留你嘅，淨係兩邊撞正同一個元素同同一項屬性先由檔案話事。主題數值梗係跟檔案。',
      '「取代」先掃走你嘅元素覆寫，再寫檔案嗰啲。「合併」保留你嘅，淨係兩邊撞正同一個元素同同一項屬性先由檔案話事。主題數值梗係跟檔案。',
      '「取代」會先掃清你嘅元素覆寫，再寫入檔案嗰啲。「合併」就留返你嘅，淨係兩邊撞正同一個元素、同一項屬性嗰陣先由檔案話事。無論邊種，主題數值都係跟檔案。'
    )
  ),
  'appearance.setting.openStudio': entry(ladder('Open the appearance studio'), ladder('開外觀工作室')),
  'appearance.setting.openStudio.description': entry(
    ladder('Opens the Appearance destination, where the theme, typography, presets and every rendered element live.'),
    ladder('開「外觀」呢個頁面，主題、字體、預設同每一個畫出嚟嘅元素都喺嗰度。')
  ),
  'appearance.setting.resetTheme.description': entry(
    ladder(
      'Puts the colour scheme, accent, contrast, density and typography back to the values the application ships with. Per-element overrides are left alone, and the change is recorded in local history.',
      'Puts the colour scheme, accent, contrast, density and typography back to the values the application ships with. Per-element overrides are left alone, and the change is recorded in local history.',
      'Sends the colour scheme, accent, contrast, density and typography back to the values the application shipped with. Your per-element overrides are untouched, and the whole thing lands in local history.',
      'Sends the colour scheme, accent, contrast, density and typography back to the values the application shipped with. Your per-element overrides are untouched, and the whole thing lands in local history.',
      'Marches the colour scheme, accent, contrast, density and typography back to the values the application shipped with. Your per-element overrides are left completely alone, and the whole thing lands in local history in case you regret it.'
    ),
    ladder(
      '將色系、主色、對比度、密度同字體排版還原做程式出廠嘅數值。每個元素嘅覆寫唔會郁，改動會記入本機歷史。',
      '將色系、主色、對比度、密度同字體排版還原做程式出廠嘅數值。每個元素嘅覆寫唔會郁，改動會記入本機歷史。',
      '將色系、主色、對比度、密度同字體排版送返去出廠設定。你嘅元素覆寫一條毛都唔會郁，成件事會落本機歷史。',
      '將色系、主色、對比度、密度同字體排版送返去出廠設定。你嘅元素覆寫一條毛都唔會郁，成件事會落本機歷史。',
      '將色系、主色、對比度、密度同字體排版通通押返去出廠設定。你嘅元素覆寫一條毛都唔會郁，成件事會落本機歷史，驚你後悔。'
    )
  ),
  'appearance.setting.deletePresets.description': entry(
    ladder(
      'Deletes every preset you saved. Application presets are part of the build and stay. Export the ones you want to keep first, because the saved copies are removed from the settings file.',
      'Deletes every preset you saved. Application presets are part of the build and stay. Export the ones you want to keep first, because the saved copies are removed from the settings file.',
      'Deletes every preset you saved. The application\'s own presets are part of the build and stay put. Export anything you want to keep first — the saved copies leave the settings file.',
      'Deletes every preset you saved. The application\'s own presets are part of the build and stay put. Export anything you want to keep first — the saved copies leave the settings file.',
      'Deletes every preset you saved. The application\'s own presets are part of the build and are not going anywhere. Export anything you want to keep before you press it, because the saved copies leave the settings file for good.'
    ),
    ladder(
      '刪除你儲存嘅全部預設。程式內建嘅預設係build入面嘅嘢，會留低。想保留嘅記得先匯出，因為存低嘅副本會喺設定檔度移除。',
      '刪除你儲存嘅全部預設。程式內建嘅預設係build入面嘅嘢，會留低。想保留嘅記得先匯出，因為存低嘅副本會喺設定檔度移除。',
      '刪除你儲存嘅全部預設。程式自己嗰啲係build入面嘅，唔會郁。想留嘅先匯出 —— 存低嗰啲會離開設定檔。',
      '刪除你儲存嘅全部預設。程式自己嗰啲係build入面嘅，唔會郁。想留嘅先匯出 —— 存低嗰啲會離開設定檔。',
      '刪除你儲存嘅全部預設。程式自己嗰啲係build入面嘅嘢，一步都唔會走。撳之前想留咩就先匯出，因為存低嗰啲一走就唔會返嚟。'
    )
  ),

  /* ---------------- element categories ---------------- */

  'appearance.category.chrome.titlebar': entry(ladder('Application title bar'), ladder('程式標題列')),
  'appearance.category.chrome.tabstrip': entry(ladder('Tab strip'), ladder('分頁條')),
  'appearance.category.tabs.tab': entry(ladder('A tab in the strip'), ladder('分頁條入面嘅一個分頁')),
  'appearance.category.tabs.group': entry(ladder('A tab group header'), ladder('分頁分組標題')),
  'appearance.category.chrome.topbar': entry(ladder('Toolbar and top app bar'), ladder('工具列同頂部應用列')),
  'appearance.category.controls.button': entry(ladder('Buttons'), ladder('按鈕')),
  'appearance.category.controls.iconButton': entry(ladder('Icon buttons'), ladder('圖示按鈕')),
  'appearance.category.controls.field': entry(ladder('Text fields'), ladder('文字欄位')),
  'appearance.category.controls.select': entry(ladder('Dropdowns'), ladder('下拉選單')),
  'appearance.category.controls.switch': entry(ladder('Switches and checkboxes'), ladder('開關同勾選格')),
  'appearance.category.controls.slider': entry(ladder('Sliders'), ladder('滑桿')),
  'appearance.category.controls.chip': entry(ladder('Chips'), ladder('標籤粒')),
  'appearance.category.surfaces.card': entry(ladder('Cards'), ladder('卡片')),
  'appearance.category.surfaces.list': entry(ladder('List rows'), ladder('清單列')),
  'appearance.category.surfaces.table': entry(ladder('Tables'), ladder('表格')),
  'appearance.category.surfaces.menu': entry(ladder('Menus and context menus'), ladder('選單同右鍵選單')),
  'appearance.category.surfaces.notification': entry(ladder('Notifications'), ladder('通知')),
  'appearance.category.surfaces.dialog': entry(ladder('Dialogs'), ladder('對話框')),
  'appearance.category.surfaces.confirm': entry(ladder('The destructive-action gate'), ladder('不可逆動作嘅關卡')),
  'appearance.category.surfaces.settingRow': entry(ladder('Settings rows'), ladder('設定列')),
  'appearance.category.surfaces.search': entry(ladder('Search bars'), ladder('搜尋列')),
  'appearance.category.surfaces.palette': entry(ladder('The command palette'), ladder('指令面板')),
  'appearance.category.surfaces.appearanceEditor': entry(
    ladder("The appearance editor's own dialog"),
    ladder('外觀編輯器自己個對話框')
  ),
  'appearance.category.surfaces.colorPicker': entry(ladder('The colour picker'), ladder('顏色選擇器')),
  'appearance.category.surfaces.datePicker': entry(ladder('The date picker'), ladder('日期選擇器')),
  'appearance.category.surfaces.empty': entry(ladder('Empty states'), ladder('空白狀態')),

  /* ---------------- readouts and descriptions ---------------- */

  'appearance.theme.schemeReadout': entry(
    ladder('Rendering the {scheme} scheme right now, generated from {seed} at {contrast} contrast and density {density}.'),
    ladder('而家用緊 {scheme} 色系，由 {seed} 生成，對比度 {contrast}，密度 {density}。')
  ),
  'appearance.theme.mode.description': entry(
    ladder(
      'Chooses the light or dark scheme, or follows the operating system. Both schemes are generated from the accent colour below.'
    ),
    ladder('揀淺色定深色色系，或者跟返作業系統。兩個色系都係由下面嗰隻主色生成。')
  ),
  'appearance.theme.contrast.description': entry(
    ladder(
      'Pushes the text and container tones further apart. The accent colour itself does not move, so a higher setting never silently changes the scheme.'
    ),
    ladder('將文字同容器嘅色調推開啲。主色本身唔會郁，所以調高對比度唔會靜靜雞換咗成個配色。')
  ),
  'appearance.theme.density.description': entry(
    ladder(
      'Tightens the height of rows, buttons and fields. 0 is the shipped spacing and -3 is the most compact. Touch targets stay at their accessible minimum at every level.'
    ),
    ladder('收緊列、按鈕同欄位嘅高度。0 係出廠間距，-3 最密。無論邊一級，可觸控範圍都會維持喺無障礙最低要求。')
  ),
  'appearance.type.family.description': entry(
    ladder(
      'Chooses the interface typeface from the families installed on this machine, ahead of the bundled fallback stack. A family that cannot render Chinese still falls back for those characters.'
    ),
    ladder('喺呢部機裝咗嘅字體入面揀介面字體，排喺內建後備字體堆疊前面。就算隻字體出唔到中文，中文字都會有後備字體頂上。')
  ),
  'appearance.type.scale.description': entry(
    ladder(
      'Multiplies the whole type scale. Sizes are declared in CSS pixels throughout; the point equivalent shown beside the slider is the pixel value times 72 divided by 96.'
    ),
    ladder('將成個字級乘大或者縮細。全部尺寸都係用 CSS 像素寫；滑桿旁邊嗰個點數，係像素值乘 72 除 96 得出嚟。')
  ),
  'appearance.type.weight.description': entry(
    ladder('Sets the base weight. A family without the chosen weight is synthesised by the platform, which looks heavier rather than sharper.'),
    ladder('設定基本字重。如果隻字體冇你揀嗰個字重，系統會自己合成，出嚟會粗咗但唔會靚咗。')
  ),
  'appearance.type.systemDefaultStatus': entry(
    ladder('The bundled stack is rendering, which covers Latin and Chinese on this platform.'),
    ladder('而家用緊內建字體堆疊，喺呢個平台上面拉丁字母同中文都覆蓋到。')
  ),
  'appearance.type.familyCountLimited': entry(
    ladder('{shown} of {total} typefaces shown. Narrow the search to reach the rest.'),
    ladder('顯示緊 {total} 隻字體之中嘅 {shown} 隻。搜尋收窄啲就見到其餘嗰啲。')
  ),
  'appearance.preset.contents': entry(
    ladder('This preset carries {theme} theme value(s) and {overrides} element override(s).'),
    ladder('呢個預設帶住 {theme} 個主題數值同 {overrides} 個元素覆寫。')
  ),
  'appearance.preset.nothingSelected': entry(ladder('Nothing is selected.'), ladder('而家乜都未揀。')),
  'appearance.elements.selectedHaveNoOverrides': entry(
    ladder('None of the selected elements has an override to reset.'),
    ladder('揀咗嘅元素入面，冇一個有覆寫可以重設。')
  ),
  'appearance.elements.sampleFailed': entry(
    ladder('This sample could not be built: {reason}'),
    ladder('呢個樣本砌唔到出嚟：{reason}')
  ),
  'appearance.transfer.includePresets': entry(
    ladder('Include the saved presets in the file'),
    ladder('連已存嘅預設一齊放入檔案')
  ),
  'appearance.transfer.exportSummary': entry(
    ladder('The file will carry {theme} theme value(s) and {overrides} element override(s).'),
    ladder('個檔案會帶住 {theme} 個主題數值同 {overrides} 個元素覆寫。')
  ),
  'appearance.transfer.importPreview': entry(
    ladder('{theme} theme value(s), {overrides} element override(s) and {presets} preset(s) will be applied from {path}.'),
    ladder('會由 {path} 套用 {theme} 個主題數值、{overrides} 個元素覆寫同 {presets} 個預設。')
  ),
  'appearance.transfer.exportOverrides.description': entry(
    ladder(
      'Writes the per-element overrides as a flat table of selector, property and value, in whichever format you choose. Anything the chosen format cannot carry is named before the file is written.'
    ),
    ladder('將每個元素嘅覆寫寫成一張「選擇器、屬性、數值」嘅平面表，用你揀嘅格式。揀咗嘅格式載唔到嘅嘢，寫檔之前就會講清楚。')
  ),
  'appearance.transfer.keptPath': entry(ladder('Where it came from'), ladder('嚟自邊度')),
  'appearance.transfer.keptValue': entry(ladder('Value as written'), ladder('原文數值')),
  'appearance.transfer.keptReason': entry(ladder('Why it was not applied'), ladder('點解冇套用')),
  'appearance.transfer.keptWhen': entry(ladder('Kept at'), ladder('保留時間')),
  'appearance.transfer.keptScope': entry(
    ladder('Actions below apply to {scope}.'),
    ladder('下面嘅動作會作用喺{scope}。')
  ),
  'appearance.transfer.keptScopeSelected': entry(
    ladder('the {count} selected entries'),
    ladder('揀咗嘅 {count} 項')
  ),
  'appearance.transfer.keptScopeAll': entry(ladder('all {count} entries'), ladder('全部 {count} 項')),
  'appearance.transfer.unappliedEmptyBody': entry(
    ladder('When an import carries something this build cannot apply, it is kept here rather than discarded.'),
    ladder('如果匯入嘅嘢有啲係呢個版本套用唔到，就會擺喺呢度，唔會掉。')
  ),

  /* ---------------- shared ---------------- */

  'appearance.action.deletePresets': entry(ladder('Delete every preset you saved'), ladder('刪除你儲存嘅全部預設')),
  'appearance.action.resetTheme': entry(ladder('Reset the theme values'), ladder('重設主題數值')),
  'appearance.provenance.default': entry(
    ladder('No file has ever set this. The application is using its own value: {value}.'),
    ladder('未有任何檔案設定過呢項。程式而家用緊自己嘅數值：{value}。')
  ),
  'appearance.provenance.user': entry(ladder('Set by you.'), ladder('由你設定。')),
  'appearance.provenance.imported': entry(ladder('Set by an imported file.'), ladder('由匯入嘅檔案設定。')),
  'appearance.provenance.scheduled': entry(ladder('Set by a schedule.'), ladder('由排程設定。')),
  'appearance.error.readFailed': entry(
    ladder('That file could not be read: {reason}'),
    ladder('讀唔到嗰個檔案：{reason}')
  ),
  'appearance.error.writeFailed': entry(
    ladder('That file could not be written: {reason}'),
    ladder('寫唔到嗰個檔案：{reason}')
  )
};
