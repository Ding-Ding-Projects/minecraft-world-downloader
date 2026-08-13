import type { Catalogue, FunnyLadder, TranslationEntry } from '../../core/registry';

/**
 * This feature's own copy, in both languages, at all five humour levels.
 *
 * A surface that lets you choose a voice and then speaks in one fixed voice
 * itself would be the most obvious possible failure, so every string here is a
 * real ladder wherever the sentence has a voice at all. Bare nouns — "Level",
 * "Language", a column heading — read the same at every rung and say so by
 * carrying one string.
 *
 * The facts stay put at every rung, exactly as they must everywhere else: a
 * count is the same count, a setting id is the same id, and a status that says
 * something failed still says what failed.
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

export const LANGUAGE_STRINGS: Catalogue = {
  /* --- the settings section --- */

  'language.section.title': entry(ladder('Language and voice'), ladder('語言同語氣')),
  'language.section.description': entry(
    ladder(
      'The language every label and message is written in, the humour level for each language, and whether a dialog carries a decorative emoji. Every control here shows you the result before you commit to it.'
    ),
    ladder(
      '呢度決定所有標籤同訊息用邊種語言、每種語言嘅語氣去到幾搞笑，同埋對話框有冇裝飾用嘅表情符號。每個控制項都會即刻畀你睇到效果先。'
    )
  ),

  'language.controls.title': entry(
    ladder('The controls', 'The controls', 'The controls themselves', 'The knobs themselves', 'The knobs themselves'),
    ladder('控制項', '控制項', '啲控制項', '啲掣喺呢度', '啲掣喺呢度')
  ),

  /* --- language mode --- */

  'language.mode.label': entry(ladder('Language'), ladder('語言')),
  'language.mode.description': entry(
    ladder(
      'Chooses the language every label, message and notification is written in. Bilingual keeps English as the prominent primary line and puts a compact Cantonese line beneath it, so the interface does not double in height.'
    ),
    ladder(
      '決定所有標籤、訊息同通知用邊種語言。雙語模式將英文放喺顯眼嘅第一行，廣東話用細行放喺下面，唔會令個介面高一倍。'
    )
  ),

  /* --- humour levels --- */

  'language.funny.en.label': entry(ladder('Humour level, English'), ladder('英文語氣程度')),
  'language.funny.yue.label': entry(ladder('Humour level, Cantonese'), ladder('廣東話語氣程度')),
  'language.funny.description': entry(
    ladder(
      'Styles every message written in this language, with no category left out: information, progress, warnings, errors, security prompts and the destructive-action gate are all included. Level 1 reads fully professional and level 5 is maximum playfulness. The facts never move: at any level a message still names exactly what happened, what it affects, and what your options are. The two languages are independent, so English at 1 beside Cantonese at 5 is a combination you can actually have.'
    ),
    ladder(
      '呢個語言所有訊息都會跟呢個語氣，冇一個類別例外：資訊、進度、警告、錯誤、保安提示同刪除確認全部包括在內。1 級完全正經，5 級最搞笑。事實永遠唔會走樣：無論邊一級，訊息都會講清楚發生咗乜、影響咩、你可以點揀。兩種語言各行各路，所以英文 1 級配廣東話 5 級係真係揀得到嘅組合。'
    )
  ),
  'language.funny.level.1': entry(ladder('Fully professional'), ladder('完全正經')),
  'language.funny.level.2': entry(ladder('Plain'), ladder('平實')),
  'language.funny.level.3': entry(ladder('Warm'), ladder('親切')),
  'language.funny.level.4': entry(ladder('Playful'), ladder('抵死')),
  'language.funny.level.5': entry(ladder('Maximum playfulness'), ladder('最盡情')),
  'language.funny.current': entry(
    ladder('Level {level} of 5 — {name}'),
    ladder('第 {level} 級（共 5 級）—— {name}')
  ),

  /* --- emoji switch --- */

  'language.emoji.label': entry(
    ladder('Show emojis in dialogs and message boxes'),
    ladder('喺對話框同訊息盒顯示表情符號')
  ),
  'language.emoji.description': entry(
    ladder(
      'Adds one decorative emoji to a dialog or message box. It never reaches a button, an action label, a field label or a screen-reader name, in either position of the switch, because a control name has to be readable aloud.'
    ),
    ladder(
      '喺對話框或者訊息盒加一個裝飾用嘅表情符號。無論開定閂，都唔會出現喺掣、動作標籤、欄位標籤或者讀屏名，因為控制項嘅名要讀得出。'
    )
  ),
  'language.emoji.on': entry(ladder('With the switch on'), ladder('開咗個掣')),
  'language.emoji.off': entry(ladder('With the switch off'), ladder('閂咗個掣')),

  /* --- the preview --- */

  'language.preview.title': entry(
    ladder('Live preview', 'Live preview', 'Live preview', 'What you are actually signing up for', 'What you are actually signing up for'),
    ladder('即時預覽', '即時預覽', '即時預覽', '你到底揀咗啲乜', '你到底揀咗啲乜')
  ),
  'language.preview.static': entry(
    ladder('Static preview. Nothing here is a live control.'),
    ladder('靜態預覽，呢度冇一件嘢係真控制項。')
  ),
  'language.preview.examples': entry(
    ladder(
      'These three messages are examples written for this preview. No world was saved, nothing is being deleted and no connection was refused.'
    ),
    ladder('呢三條訊息係專登為咗預覽寫嘅例子。冇儲存過任何世界、冇刪緊嘢、亦冇任何連線被拒絕。')
  ),
  'language.preview.cell': entry(
    ladder('{mode}, English at level {en}, Cantonese at level {yue}'),
    ladder('{mode}，英文第 {en} 級，廣東話第 {yue} 級')
  ),
  'language.preview.width': entry(ladder('Preview width'), ladder('預覽闊度')),
  'language.preview.width.description': entry(
    ladder(
      'Renders each preview at this width in CSS pixels. Bilingual copy is the longest the interface ever gets, so narrowing this is how you check that it wraps instead of clipping.'
    ),
    ladder(
      '用呢個闊度（CSS 像素）去畫每個預覽。雙語文字係成個介面入面最長嘅，所以校窄啲就係用嚟睇佢會換行定係被切走。'
    )
  ),
  'language.preview.scale': entry(ladder('Preview text scale'), ladder('預覽字體比例')),
  'language.preview.scale.description': entry(
    ladder(
      'Scales the text inside the previews only, so the 125, 150 and 200 per cent display scales can be checked without changing your actual display settings.'
    ),
    ladder(
      '淨係放大預覽入面嘅文字，等你唔使真係改顯示設定，都可以檢查 125、150 同 200 百分比嘅顯示比例。'
    )
  ),
  'language.preview.matrix': entry(
    ladder('The full matrix'),
    ladder('完整對照表')
  ),
  'language.preview.matrix.description': entry(
    ladder(
      'The same screen in all three language modes at both humour extremes. Six cells, so the crowding a bilingual layout has to survive is visible side by side rather than described.'
    ),
    ladder(
      '同一個畫面，三種語言模式加語氣兩個極端，一共六格。雙語排版要頂得住嘅擠迫程度，擺埋一齊睇得一清二楚，唔使靠人講。'
    )
  ),

  /* --- sample categories --- */

  'language.sample.info': entry(ladder('An ordinary information line'), ladder('普通資訊')),
  'language.sample.destructive': entry(ladder('A destructive warning'), ladder('刪除警告')),
  'language.sample.error': entry(ladder('An error'), ladder('錯誤訊息')),

  /* --- the fact check --- */

  'language.facts.title': entry(
    ladder('Voice changes, facts do not'),
    ladder('語氣會變，事實唔會')
  ),
  'language.facts.description': entry(
    ladder(
      'Each sample declares the facts every rung of its ladder must carry — a count, a folder, a host and port, a consequence. This check reads all thirty rendered variants and reports any that dropped one, so the promise is something you can see rather than something you are told.'
    ),
    ladder(
      '每條樣本都列明咗每一級都必須保留嘅事實：個數目、個資料夾、個主機同埠、同埋後果。呢個檢查會讀晒全部三十個變體，邊個甩咗都會報畀你知，等個承諾係睇得見，唔係淨係聽人講。'
    )
  ),
  'language.facts.pass': entry(
    ladder('All {total} rendered variants carry every fact they declare.'),
    ladder('全部 {total} 個變體都完整保留咗自己列明嘅事實。')
  ),
  'language.facts.fail': entry(
    ladder('{count} of {total} variants dropped a declared fact: {detail}'),
    ladder('{total} 個變體入面有 {count} 個甩咗列明嘅事實：{detail}')
  ),

  /* --- disclosure --- */

  'language.disclosure.title': entry(
    ladder('Before you move that slider'),
    ladder('喺你拉個掣之前')
  ),
  'language.disclosure.body': entry(
    ladder(
      'The humour level styles every message this application writes in that language. That includes errors, warnings, security prompts and the confirmation you see before something is deleted — no category is carved out of it. What it never changes is the content: at every level a message still names what happened, exactly what it affects, and what your options are. You can change either level at any time, or reset both to the shipped value, from the language settings.'
    ),
    ladder(
      '語氣程度會影響呢個程式用嗰種語言寫嘅所有訊息，包括錯誤、警告、保安提示，同埋刪嘢之前嗰個確認——冇一個類別例外。但佢永遠唔會改內容：無論邊一級，訊息一樣會講清楚發生咗乜、影響邊啲嘢、你可以點揀。你隨時可以喺語言設定度改，或者將兩個都還原做出廠值。'
    )
  ),
  'language.disclosure.ack': entry(ladder('I understand'), ladder('我明白')),
  'language.disclosure.acknowledged': entry(
    ladder('You acknowledged this on {when}. It stays here so you can read it again.'),
    ladder('你喺 {when} 已經睇過。呢段字唔會走，隨時可以再睇。')
  ),
  'language.disclosure.pending': entry(
    ladder('Not acknowledged yet. Reading it changes nothing on its own.'),
    ladder('仲未確認過。淨係睇一睇，本身唔會改到任何嘢。')
  ),
  'language.disclosure.show': entry(ladder('Show the humour disclosure'), ladder('睇返語氣說明')),
  'language.disclosure.read': entry(ladder('Read it'), ladder('去睇')),

  /* --- the variant table --- */

  'language.table.title': entry(
    ladder('Every rendered variant'),
    ladder('全部變體')
  ),
  'language.table.description': entry(
    ladder(
      'Three sample messages, two languages, five levels: thirty rows. Select any of them and copy or export the exact text, which is the quickest way to compare two levels without moving a slider back and forth.'
    ),
    ladder(
      '三條樣本訊息、兩種語言、五個級數，一共三十行。揀邊行都得，可以複製或者匯出原文；想比較兩個級數，呢個仲快過拉來拉去。'
    )
  ),
  'language.table.search': entry(ladder('Search the variants'), ladder('搵變體')),
  'language.table.column.category': entry(ladder('Category'), ladder('類別')),
  'language.table.column.language': entry(ladder('Language'), ladder('語言')),
  'language.table.column.level': entry(ladder('Level'), ladder('級數')),
  'language.table.column.text': entry(ladder('Text'), ladder('內容')),
  'language.table.selectShown': entry(ladder('Select the {count} shown'), ladder('揀晒顯示緊嘅 {count} 行')),
  'language.table.selectEvery': entry(ladder('Select all {count}, shown or not'), ladder('揀晒全部 {count} 行，唔理有冇顯示')),
  'language.table.invert': entry(ladder('Invert the selection'), ladder('反轉揀咗嘅')),
  'language.table.clear': entry(ladder('Clear the selection'), ladder('清走揀咗嘅')),
  'language.table.selected': entry(
    ladder('{selected} selected. {affected} will be acted on; {hidden} of them are hidden by the current search.'),
    ladder('揀咗 {selected} 行。會處理 {affected} 行，其中 {hidden} 行俾而家嘅搜尋收埋咗。')
  ),
  'language.table.copy': entry(ladder('Copy the selected text'), ladder('複製揀咗嘅內容')),
  'language.table.export': entry(ladder('Export the selection…'), ladder('匯出揀咗嘅…')),
  'language.table.copied': entry(ladder('{count} variants copied to the clipboard.'), ladder('已複製 {count} 個變體去剪貼簿。')),
  'language.table.copyFailed': entry(
    ladder('The clipboard refused the copy: {reason}. Nothing was changed.'),
    ladder('剪貼簿唔收：{reason}。乜都冇改到。')
  ),
  'language.table.none': entry(
    ladder('Nothing is selected, so nothing was done.'),
    ladder('冇揀到嘢，所以乜都冇做。')
  ),
  'language.table.noDestructive': entry(
    ladder(
      'These rows are shipped preview samples rather than your data, so there is no delete, rename or move here. Copy and export are the whole set of actions this list can honestly offer.'
    ),
    ladder(
      '呢啲行係隨程式出貨嘅預覽樣本，唔係你嘅資料，所以冇刪除、改名或者搬移。複製同匯出就係呢張清單老老實實做得到嘅全部動作。'
    )
  ),
  'language.table.empty': entry(
    ladder('No variant matched that search.'),
    ladder('冇變體符合呢個搜尋。')
  ),
  'language.table.row': entry(
    ladder('{category}, {language}, level {level}'),
    ladder('{category}，{language}，第 {level} 級')
  ),

  /* --- reset --- */

  'language.reset.label': entry(ladder('Reset the language and voice settings'), ladder('重設語言同語氣設定')),
  'language.reset.description': entry(
    ladder(
      'Restores the language mode, both humour levels and the emoji switch to the values this build ships with. Nothing else is touched, and the change is recorded in local history like any other, so the values you had are readable from there.'
    ),
    ladder(
      '將語言模式、兩個語氣程度同表情符號掣還原做呢個版本嘅出廠值。其他嘢一律唔郁，改動同平時一樣會寫入本機紀錄，所以你原本嘅設定喺嗰度查得返。'
    )
  ),
  'language.reset.confirm': entry(
    ladder('Reset language mode, both humour levels and the emoji switch?'),
    ladder('要重設語言模式、兩個語氣程度同表情符號掣？')
  ),
  'language.reset.confirmBody': entry(
    ladder(
      'The language mode returns to English, both humour levels return to 3, and the emoji switch returns to on. The change is written to local history, so the values you had now can be read back from there.'
    ),
    ladder(
      '語言模式會返做英文，兩個語氣程度返做 3，表情符號掣返做開。改動會寫入本機紀錄，所以你而家嘅設定之後喺嗰度查得返。'
    )
  ),
  'language.reset.done': entry(
    ladder('Language mode, both humour levels and the emoji switch are back to their shipped values.'),
    ladder('語言模式、兩個語氣程度同表情符號掣都返咗出廠值。')
  ),

  /* --- destinations --- */

  'language.tab.title': entry(ladder('Language'), ladder('語言')),
  'language.tab.subtitle': entry(
    ladder('Every language mode and both humour extremes, side by side, at any width you like.'),
    ladder('全部語言模式同語氣兩個極端擺埋一齊，闊度你話事。')
  ),
  'language.palette.destination': entry(ladder('Language preview'), ladder('語言預覽')),

  /* --- provenance of the mirrored settings --- */

  'language.mirror.note': entry(
    ladder(
      'This control writes the application-wide setting {source} and keeps its own copy at {mirror} in step with it, so the provenance line above describes the value that is actually in force.'
    ),
    ladder(
      '呢個控制項會寫入全程式共用嘅設定 {source}，同時將自己嗰份 {mirror} 同步跟住，所以上面嗰行來源說明講嘅，就係真正生效嗰個值。'
    )
  )
};
