import type { Catalogue, TranslationEntry } from '../../core/registry';

/**
 * Every user-facing string this feature renders.
 *
 * Humour styles the voice and never the facts. A refusal at level 5 still names
 * the editor, the path and the exact reason nothing happened, because a funny
 * message that leaves somebody unsure what a button did is a broken message.
 * The two languages are set independently, so English at 1 beside Cantonese at
 * 5 has to read correctly — which is why the facts are carried identically in
 * both halves rather than only in the serious one.
 *
 * `copy` takes three rungs per language and spreads them across the five the
 * resolver needs: the professional wording covers 1 and 2, a lighter one covers
 * 3, and the playful one covers 4 and 5.
 */
function copy(
  en: [string, string, string],
  yue: [string, string, string]
): TranslationEntry {
  return {
    en: [en[0], en[0], en[1], en[2], en[2]],
    yue: [yue[0], yue[0], yue[1], yue[2], yue[2]]
  };
}

export const externalEditorStrings: Catalogue = {
  /* ---------------- identity ---------------- */

  'externalEditor.title': copy(
    ['External editor', 'External editor', 'External editor'],
    ['外部編輯器', '外部編輯器', '外部編輯器']
  ),
  'externalEditor.subtitle': copy(
    [
      'Choose which editor opens files and folders, and hand a path to it.',
      'Pick the editor that opens your files, and send it something.',
      'Pick your editor, then fling a file at it and watch it catch.'
    ],
    [
      '揀邊個編輯器開檔案同資料夾，然後將路徑交俾佢。',
      '揀定用邊個編輯器開嘢，然後掉個路徑俾佢。',
      '揀定你隻編輯器，跟住掟個檔案過去，睇佢接唔接到。'
    ]
  ),

  /* ---------------- status section ---------------- */

  'externalEditor.status.title': copy(
    ['Active editor', 'Active editor', 'Whoever is on duty'],
    ['使用緊嘅編輯器', '使用緊嘅編輯器', '而家當值嗰位']
  ),
  'externalEditor.status.description': copy(
    [
      'Which editor a handoff uses. Choose automatically prefers Visual Studio Code and falls back through the rest of its family; an explicit choice is used exactly as given, and opens nothing when it is unavailable.',
      'Which editor gets your files. Automatic prefers Visual Studio Code; a choice you make is honoured exactly, and nothing else is opened in its place.',
      'Who catches the file. Automatic asks Visual Studio Code first; if you name one yourself it is that one or nothing — no understudy sneaks on stage.'
    ],
    [
      '交接時用邊個編輯器。自動揀會優先揀 Visual Studio Code，然後順住同系其他隻試；你自己揀嗰個就照用，用唔到嗰陣咩都唔會開。',
      '邊個編輯器收你啲檔案。自動會優先 Visual Studio Code；你自己揀就照你講，唔會用第二個頂替。',
      '邊個接住個檔案。自動會先問 Visual Studio Code；你自己點名就淨係佢，冇替工偷偷上場。'
    ]
  ),
  'externalEditor.active.label': copy(
    ['Editor used for every handoff', 'Editor used for every handoff', 'Who gets the files'],
    ['每次交接用嘅編輯器', '每次交接用嘅編輯器', '啲檔案交俾邊個']
  ),
  'externalEditor.active.auto': copy(
    [
      '{name} will be used. It was chosen automatically as the best of {count} editors this application can start.',
      '{name} will be used. It was picked automatically as the best of the {count} editors this application can start.',
      '{name} gets the job. It was picked automatically, being the best of the {count} editors this application can actually start.'
    ],
    [
      '會用 {name}。喺呢個應用程式啟動到嘅 {count} 個編輯器之中，佢係自動揀出嚟最好嗰個。',
      '會用 {name}。喺應用程式開得到嘅 {count} 個編輯器入面自動揀咗佢。',
      '份工交咗俾 {name}。喺應用程式真係開得郁嘅 {count} 個編輯器入面，佢自動當選。'
    ]
  ),
  'externalEditor.active.explicit': copy(
    [
      '{name} will be used, because you chose it.',
      '{name} will be used, because you chose it.',
      '{name} is on duty, by your own appointment.'
    ],
    ['因為你揀咗，所以會用 {name}。', '你揀咗 {name}，就用佢。', '{name} 當值，係你親自欽點嘅。']
  ),
  'externalEditor.active.unusable': copy(
    [
      'You chose {name}, and it cannot be started from here right now, so nothing will be opened. Nothing else will be started in its place.',
      'You chose {name} and it cannot be started right now, so nothing will open. Nothing else is used instead.',
      'You picked {name}, and it cannot be started right now — so nothing opens. No understudy is sent on in its place.'
    ],
    [
      '你揀咗 {name}，但而家喺呢度啟動唔到，所以咩都唔會開，亦唔會用第二個頂替。',
      '你揀咗 {name}，而家開唔到，所以咩都唔會開，亦唔會搵第二個代替。',
      '你點名要 {name}，但而家佢郁唔到，所以咩都唔會開，亦冇替工上場。'
    ]
  ),
  'externalEditor.active.unprobed': copy(
    [
      'This machine has not been checked for editors yet, so nothing can be opened.',
      'This machine has not been checked for editors yet, so nothing can be opened.',
      'Nobody has looked around this machine yet, so there is nothing to open with.'
    ],
    [
      '仲未檢查過呢部機有咩編輯器，所以開唔到嘢。',
      '仲未查過呢部機有咩編輯器，所以未開得。',
      '仲未有人喺呢部機周圍望過，所以冇嘢開得。'
    ]
  ),
  'externalEditor.active.none': copy(
    [
      'No editor this application can start was found on this machine, so nothing will be opened. Visual Studio Code is the one this application knows best.',
      'No editor this application can start was found here, so nothing will open. Visual Studio Code is the one it knows best.',
      'Nothing on this machine that this application can start turned up, so nothing opens. Visual Studio Code is the one it gets on with best.'
    ],
    [
      '喺呢部機搵唔到應用程式啟動到嘅編輯器，所以咩都唔會開。應用程式最熟嗰隻係 Visual Studio Code。',
      '呢度搵唔到應用程式開得到嘅編輯器，所以咩都唔會開。佢最熟嗰隻係 Visual Studio Code。',
      '喺呢部機搵唔到一個應用程式開得郁嘅編輯器，所以咩都唔開。佢同 Visual Studio Code 最夾。'
    ]
  ),
  'externalEditor.option.auto': copy(
    [
      'Choose automatically (Visual Studio Code first)',
      'Choose automatically (Visual Studio Code first)',
      'Let it decide (Visual Studio Code gets first refusal)'
    ],
    ['自動揀（優先 Visual Studio Code）', '自動揀（優先 Visual Studio Code）', '交俾佢決定（Visual Studio Code 有優先權）']
  ),
  'externalEditor.option.unusable': copy(
    [
      '{name} — cannot be started from here',
      '{name} — cannot be started from here',
      '{name} — listed, but this application cannot start it'
    ],
    ['{name} — 喺呢度啟動唔到', '{name} — 喺呢度開唔到', '{name} — 有記錄，但應用程式啟動唔到佢']
  ),
  'externalEditor.provenance.default': copy(
    [
      'Nothing has ever written this choice, so the built-in value is in effect: choose automatically, preferring Visual Studio Code.',
      'Nothing has written this choice, so the built-in value is in effect: choose automatically, preferring Visual Studio Code.',
      'Nobody has ever touched this one, so the built-in value stands: choose automatically, Visual Studio Code first.'
    ],
    [
      '從來未有人寫過呢個選擇，所以用緊內置值：自動揀，優先 Visual Studio Code。',
      '未有人寫過呢個選擇，用緊內置值：自動揀，優先 Visual Studio Code。',
      '呢個從來冇人掂過，所以照內置值嚟：自動揀，Visual Studio Code 行先。'
    ]
  ),
  'externalEditor.provenance.set': copy(
    [
      'This choice is set to {value} ({source}).',
      'This choice is set to {value} ({source}).',
      'This one is set to {value}, written by {source}.'
    ],
    ['呢個選擇設成 {value}（{source}）。', '呢個選擇設咗做 {value}（{source}）。', '呢個設咗做 {value}，係 {source} 寫落嘅。']
  ),
  'externalEditor.download.note': copy(
    [
      'The page is opened in your browser at {url}. This application downloads nothing itself and makes no request of its own.',
      'The page opens in your browser at {url}. This application downloads nothing and makes no request of its own.',
      'It opens {url} in your browser and then stays out of it. The application fetches nothing itself.'
    ],
    [
      '會喺你嘅瀏覽器開 {url}。應用程式本身唔會下載任何嘢，亦唔會自己發出請求。',
      '會喺你個瀏覽器開 {url}。應用程式自己咩都唔會下載，亦唔會自己發請求。',
      '喺你個瀏覽器開 {url}，然後就唔關佢事。應用程式自己乜都唔攞。'
    ]
  ),

  /* ---------------- editor list ---------------- */

  'externalEditor.list.title': copy(
    ['Editors on this machine', 'Editors on this machine', 'The editors this machine admits to having'],
    ['呢部機上面嘅編輯器', '呢部機有嘅編輯器', '呢部機肯認有嘅編輯器']
  ),
  'externalEditor.list.description': copy(
    [
      'Everything detected on this machine plus everything you added, with whether this application can actually start each one.',
      'What was detected here plus what you added, and whether each one can actually be started.',
      'What turned up here plus what you dragged in, and whether each one will actually get out of bed.'
    ],
    [
      '喺呢部機偵測到嘅，加上你自己加嘅，同埋每個應用程式究竟啟唔啟動到。',
      '偵測到嘅加你加嘅，同埋逐個講明開唔開得到。',
      '搵到嘅加你拉入嚟嘅，仲會講明邊個真係肯起身做嘢。'
    ]
  ),
  'externalEditor.list.search': copy(
    ['Search editors', 'Search editors', 'Sift the editors'],
    ['搵編輯器', '搵編輯器', '篩下啲編輯器']
  ),
  'externalEditor.list.empty': copy(
    [
      'No editor matched. Clear the search to see the whole list.',
      'Nothing matched. Clear the search to see them all.',
      'Nothing matched. Clear the search and everybody comes back.'
    ],
    ['冇編輯器符合。清走搜尋就會見返全部。', '冇嘢啱。清走搜尋就見返全部。', '冇一個啱。清走搜尋，大隊即刻返晒嚟。']
  ),
  'externalEditor.column.active': copy(['Active', 'Active', 'On duty'], ['使用中', '使用中', '當值']),
  'externalEditor.column.name': copy(['Name', 'Name', 'Name'], ['名稱', '名稱', '名']),
  'externalEditor.column.origin': copy(['Source', 'Source', 'Where it came from'], ['來源', '來源', '邊度嚟']),
  'externalEditor.column.status': copy(['Status', 'Status', 'State of play'], ['狀態', '狀態', '狀況']),
  'externalEditor.column.folder': copy(
    ['Folder support', 'Folder support', 'Takes folders?'],
    ['資料夾支援', '資料夾支援', '收唔收資料夾？']
  ),
  'externalEditor.column.command': copy(
    ['Executable', 'Executable', 'Where the program lives'],
    ['執行檔', '執行檔', '個程式住喺邊']
  ),
  'externalEditor.origin.detected': copy(
    ['Detected', 'Detected', 'Found by looking'],
    ['偵測到', '偵測到', '搵返嚟嘅']
  ),
  'externalEditor.origin.added': copy(
    ['Added by you', 'Added by you', 'Brought in by you'],
    ['你加嘅', '你加嘅', '你拉入嚟嘅']
  ),
  'externalEditor.status.ready': copy(
    ['Installed and ready', 'Installed and ready', 'Installed and awake'],
    ['已安裝，準備好', '已安裝，準備好', '裝咗，仲醒住']
  ),
  'externalEditor.status.linked': copy(
    [
      'The same file as a detected editor, so it can be started',
      'The same file as a detected editor, so it can be started',
      'Turns out to be one it already knew, so it starts fine'
    ],
    [
      '同偵測到嘅編輯器係同一個檔案，所以啟動到',
      '同偵測到嗰個係同一個檔案，所以開得到',
      '原來就係佢本身識嗰個，所以開得郁'
    ]
  ),
  'externalEditor.status.missing': copy(
    ['Not on this machine', 'Not on this machine', 'Not here at all'],
    ['唔喺呢部機', '唔喺呢部機', '根本唔喺度']
  ),
  'externalEditor.status.unlinked': copy(
    [
      'Present, but this application cannot start it',
      'Present, but this application cannot start it',
      'It is there; this application just cannot start it'
    ],
    ['喺度，但應用程式啟動唔到佢', '喺度，但應用程式開唔到佢', '佢喺度，只不過應用程式啟動唔到佢']
  ),
  'externalEditor.folder.yes': copy(
    [
      'Opens a folder as a workspace root',
      'Opens a folder as a workspace root',
      'Happily swallows a whole folder as a workspace root'
    ],
    ['可以將資料夾開做工作區根目錄', '開得到資料夾做工作區根目錄', '成個資料夾當工作區根目錄食得落']
  ),
  'externalEditor.folder.no': copy(
    ['Files only', 'Files only', 'Files only, thank you'],
    ['淨係開檔案', '淨係開檔案', '淨係收檔案，唔該']
  ),
  'externalEditor.probe.running': copy(
    ['Checking this machine for editors…', 'Checking this machine for editors…', 'Having a look around this machine…'],
    ['正喺度檢查呢部機有咩編輯器⋯', '檢查緊呢部機有咩編輯器⋯', '喺部機周圍望緊⋯']
  ),
  'externalEditor.probe.failed': copy(
    [
      'The machine could not be checked: {message}. Only editors you added yourself are listed.',
      'The machine could not be checked: {message}. Only the editors you added are listed.',
      'The check itself fell over: {message}. Only the editors you added are on the list.'
    ],
    [
      '檢查唔到部機：{message}。而家只列出你自己加嘅編輯器。',
      '部機檢查唔到：{message}。淨係列出你自己加嘅。',
      '檢查本身仆咗街：{message}。而家淨係得你自己加嗰啲。'
    ]
  ),
  'externalEditor.probe.never': copy(
    [
      'This machine has not been checked yet. Choose Re-check to look for installed editors.',
      'This machine has not been checked yet. Choose Re-check to look for installed editors.',
      'Nobody has looked yet. Press Re-check and it will go and see.'
    ],
    [
      '仲未檢查過呢部機。撳「再檢查」就會搵已安裝嘅編輯器。',
      '仲未檢查過。撳「再檢查」就會去搵。',
      '仲未有人望過。撳「再檢查」，佢就會去睇下。'
    ]
  ),
  'externalEditor.probe.noneUsable': copy(
    [
      'This machine was checked and no editor this application can start was found.',
      'This machine was checked and no editor this application can start was found.',
      'It looked, and found nothing here it can actually start.'
    ],
    [
      '已經檢查過呢部機，搵唔到應用程式啟動到嘅編輯器。',
      '檢查完，搵唔到應用程式開得到嘅編輯器。',
      '望過喇，搵唔到一個佢真係開得郁嘅。'
    ]
  ),
  'externalEditor.probe.done': copy(
    [
      '{usable} of {total} known editors can be started from here.',
      '{usable} of {total} known editors can be started from here.',
      '{usable} out of {total} will actually answer the door.'
    ],
    [
      '已知 {total} 個編輯器之中，有 {usable} 個喺呢度啟動到。',
      '{total} 個之中有 {usable} 個喺呢度開得到。',
      '{total} 個之中得 {usable} 個真係會應門。'
    ]
  ),

  /* ---------------- bulk actions ---------------- */

  'externalEditor.bulk.count': copy(
    [
      '{selected} selected of {shown} shown, {total} in total.',
      '{selected} selected of {shown} shown, {total} in total.',
      '{selected} picked out of the {shown} on screen; {total} exist altogether.'
    ],
    [
      '顯示緊 {shown} 個，揀咗 {selected} 個，總共 {total} 個。',
      '顯示 {shown} 個，揀咗 {selected} 個，一共 {total} 個。',
      'screen 上面 {shown} 個，你圈咗 {selected} 個，全世界有 {total} 個。'
    ]
  ),
  'externalEditor.bulk.selectShown': copy(
    [
      'Select the {count} rows shown',
      'Select the {count} rows shown',
      'Grab the {count} rows on screen'
    ],
    ['選取顯示緊嘅 {count} 行', '揀晒顯示緊嘅 {count} 行', '一嘢抄起 screen 上面 {count} 行']
  ),
  'externalEditor.bulk.selectEverything': copy(
    ['Select every row ({count})', 'Select every row ({count})', 'Take the lot ({count})'],
    ['選取全部 {count} 行', '揀晒全部 {count} 行', '一鋪清袋，全部 {count} 行']
  ),
  'externalEditor.bulk.invert': copy(
    ['Invert the selection', 'Invert the selection', 'Swap it round'],
    ['反轉選取', '反轉選取', '調轉嚟揀']
  ),
  'externalEditor.bulk.clear': copy(
    ['Clear the selection', 'Clear the selection', 'Let them all go'],
    ['清除選取', '清走選取', '全部放生']
  ),
  'externalEditor.bulk.nothingShown': copy(
    ['No rows are shown to select.', 'No rows are shown to select.', 'There is nothing on screen to grab.'],
    ['冇行顯示緊，冇嘢揀。', '冇行顯示緊。', 'screen 上面冇嘢俾你抄。']
  ),
  'externalEditor.bulk.nothingAtAll': copy(
    ['There is nothing in this list yet.', 'There is nothing in this list yet.', 'The list is empty.'],
    ['呢個清單而家係空嘅。', '清單而家空空如也。', '清單得個吉。']
  ),
  'externalEditor.bulk.nothingSelected': copy(
    ['Nothing is selected.', 'Nothing is selected.', 'Nothing is selected yet.'],
    ['咩都未揀。', '咩都未揀。', '一個都未圈到。']
  ),
  'externalEditor.bulk.oneOnly': copy(
    [
      'Exactly one editor can be the active one. Select a single row.',
      'Exactly one editor can be the active one. Select a single row.',
      'Only one editor can be on duty. Pick one row.'
    ],
    [
      '使用中嘅編輯器只可以有一個，請只選一行。',
      '使用中嘅只可以得一個，揀一行就得。',
      '當值嘅只可以得一個，揀一行啦。'
    ]
  ),
  'externalEditor.bulk.notStartable': copy(
    [
      'That editor cannot be started from this application, so it cannot be the active one.',
      'That editor cannot be started from this application, so it cannot be the active one.',
      'This application cannot start that one, so it cannot be on duty.'
    ],
    [
      '應用程式啟動唔到嗰個編輯器，所以佢做唔到使用中嗰個。',
      '應用程式開唔到嗰個，所以佢唔可以做使用中。',
      '應用程式開唔郁佢，所以佢當唔到值。'
    ]
  ),
  'externalEditor.bulk.detectedOnly': copy(
    [
      'Detected editors are found on the machine, not stored here, so there is nothing to remove.',
      'Detected editors are found on the machine, not stored here, so there is nothing to remove.',
      'Detected editors are found, not kept, so there is nothing here to remove.'
    ],
    [
      '偵測到嘅編輯器係喺部機搵返嚟，唔係儲喺呢度，所以冇嘢可以刪。',
      '偵測到嘅係搵返嚟，唔係儲喺度，所以冇得刪。',
      '偵測到嗰啲係搵返嚟嘅，唔係擺喺度嘅，所以刪無可刪。'
    ]
  ),
  'externalEditor.bulk.tooManyReopens': copy(
    [
      'Eight is the most that will be reopened at once, so a mis-click cannot open forty editor windows. {count} are selected.',
      'Eight is the most that will be reopened at once, so a mis-click cannot open forty windows. {count} are selected.',
      'Eight at a time is the ceiling, so one stray click cannot open forty windows. You have {count} selected.'
    ],
    [
      '一次最多重開八個，咁樣撳錯都唔會開四十個編輯器視窗。你揀咗 {count} 個。',
      '一次最多重開八個，撳錯都唔會開到四十個視窗。你揀咗 {count} 個。',
      '一次八個封頂，撳錯手都唔會爆四十個視窗出嚟。你揀咗 {count} 個。'
    ]
  ),
  'externalEditor.bulk.oneOnlyReveal': copy(
    [
      'The file manager is opened one path at a time. Select a single row.',
      'The file manager is opened one path at a time. Select a single row.',
      'The file manager takes one path at a time. Pick one row.'
    ],
    [
      '檔案總管一次只開一個路徑，請只選一行。',
      '檔案總管一次得一個路徑，揀一行。',
      '檔案總管一次淨係收一個路徑，揀一行啦。'
    ]
  ),

  /* ---------------- actions ---------------- */

  'externalEditor.action.recheck': copy(
    ['Re-check this machine', 'Re-check this machine', 'Go and look again'],
    ['再檢查呢部機', '再檢查呢部機', '再去望多次']
  ),
  'externalEditor.action.setActive': copy(
    ['Use this editor', 'Use this editor', 'Put this one on duty'],
    ['用呢個編輯器', '用呢個', '派佢當值']
  ),
  'externalEditor.action.isActive': copy(
    [
      'Active editor: {name}',
      'Active editor: {name}',
      'On duty: {name}'
    ],
    ['使用中嘅編輯器：{name}', '使用中：{name}', '當值中：{name}']
  ),
  'externalEditor.action.makeActive': copy(
    [
      'Use {name} for every handoff',
      'Use {name} for every handoff',
      'Hand everything to {name} from now on'
    ],
    ['每次交接都用 {name}', '每次都用 {name}', '之後啲嘢一律交俾 {name}']
  ),
  'externalEditor.action.copyPaths': copy(
    ['Copy the executable paths', 'Copy the executable paths', 'Copy where they live'],
    ['複製執行檔路徑', '複製執行檔路徑', '抄低佢哋住喺邊']
  ),
  'externalEditor.action.export': copy(
    ['Export the selection', 'Export the selection', 'Export what you picked'],
    ['匯出所選項目', '匯出你揀咗嘅', '將你圈起嗰啲匯出']
  ),
  'externalEditor.action.remove': copy(
    ['Remove from this application', 'Remove from this application', 'Strike them off the list'],
    ['喺應用程式移除', '喺應用程式度剷走', '喺份名單度劃走佢哋']
  ),
  'externalEditor.action.add': copy(
    ['Add this editor', 'Add this editor', 'Sign this one up'],
    ['加入呢個編輯器', '加呢個入去', '收咗佢入隊']
  ),
  'externalEditor.action.open': copy(
    ['Open in the editor', 'Open in the editor', 'Send it to the editor'],
    ['喺編輯器打開', '喺編輯器開', '掟俾編輯器']
  ),
  'externalEditor.action.openProject': copy(
    [
      'Open the project folder',
      'Open the project folder',
      'Open the whole project folder'
    ],
    ['打開專案資料夾', '打開專案資料夾', '成個專案資料夾開埋佢']
  ),
  'externalEditor.action.openAgain': copy(
    ['Open again', 'Open again', 'Send it over again'],
    ['再開多次', '再開多次', '再掟過去一次']
  ),
  'externalEditor.action.reveal': copy(
    ['Show in the file manager', 'Show in the file manager', 'Show me where it is'],
    ['喺檔案總管顯示', '喺檔案總管顯示', '帶我去睇下佢喺邊']
  ),
  'externalEditor.action.systemDefault': copy(
    [
      'Open with the default application',
      'Open with the default application',
      'Let the operating system decide'
    ],
    ['用預設應用程式打開', '用預設應用程式開', '交俾作業系統話事']
  ),
  'externalEditor.action.forget': copy(
    ['Forget these records', 'Forget these records', 'Forget these ever happened'],
    ['忘記呢啲記錄', '刪走呢啲記錄', '當呢啲從來未發生過']
  ),
  'externalEditor.action.download': copy(
    ['Download Visual Studio Code', 'Download Visual Studio Code', 'Go and get Visual Studio Code'],
    ['下載 Visual Studio Code', '下載 Visual Studio Code', '去攞返個 Visual Studio Code']
  ),

  /* ---------------- add section ---------------- */

  'externalEditor.add.title': copy(
    ['Add an editor', 'Add an editor', 'Bring your own editor'],
    ['加入一個編輯器', '加個編輯器', '自己帶編輯器嚟']
  ),
  'externalEditor.add.description': copy(
    [
      'Browse for an editor executable this application did not find. The path is verified against the disk before it is stored, and an executable that turns out to be one of the editors this application knows becomes startable immediately.',
      'Browse for an editor this application missed. The path is checked against the disk first, and one that turns out to be an editor it knows becomes startable straight away.',
      'Browse for an editor the probe walked straight past. The path is checked before it is stored, and if it turns out to be one this application already knows, it can be started at once.'
    ],
    [
      '瀏覽搵一個應用程式搵唔到嘅編輯器執行檔。路徑會先對照硬碟核實先儲低；如果原來就係應用程式識嗰啲，即刻就啟動到。',
      '瀏覽搵應用程式漏咗嘅編輯器。路徑會先核實至儲低；如果原來係佢識嗰啲，即刻開得。',
      '瀏覽搵個俾偵測行過都唔覺嘅編輯器。路徑會核實先儲；如果原來就係佢識嗰個，即刻開得郁。'
    ]
  ),
  'externalEditor.add.executable': copy(
    ['Editor executable', 'Editor executable', 'The editor program itself'],
    ['編輯器執行檔', '編輯器執行檔', '編輯器個程式本身']
  ),
  'externalEditor.add.executablePlaceholder': copy(
    [
      'The editor executable, chosen with Browse',
      'The editor executable, chosen with Browse',
      'Press Browse and go and find it'
    ],
    ['用「瀏覽」揀嘅編輯器執行檔', '用「瀏覽」揀嘅執行檔', '撳「瀏覽」，去搵返佢']
  ),
  'externalEditor.add.executableSupport': copy(
    [
      'The path is verified against the disk before it is stored. A folder is refused: choose the executable itself.',
      'The path is checked against the disk before it is stored. A folder is refused: choose the executable itself.',
      'It is checked against the disk before it is kept. A folder gets turned away: pick the program itself.'
    ],
    [
      '路徑會先對照硬碟核實至儲低。資料夾會被拒絕：請揀執行檔本身。',
      '會先對照硬碟核實至儲。資料夾唔收：揀執行檔本身。',
      '儲之前會對硬碟查真。資料夾唔收㗎，揀個程式本身。'
    ]
  ),
  'externalEditor.add.name': copy(
    ['Name (optional)', 'Name (optional)', 'Call it something (optional)'],
    ['名稱（可留空）', '名稱（可留空）', '幫佢改個名（唔改都得）']
  ),
  'externalEditor.add.nameSupport': copy(
    [
      'Left empty, the file name is used.',
      'Left empty, the file name is used.',
      'Leave it blank and the file name does the job.'
    ],
    ['留空嘅話會用檔案名。', '留空就用檔案名。', '空住就用返檔案名頂上。']
  ),
  'externalEditor.add.supportsFolder': copy(
    [
      'This editor opens a folder as a workspace root',
      'This editor opens a folder as a workspace root',
      'This one can swallow a whole folder as a workspace root'
    ],
    [
      '呢個編輯器可以將資料夾開做工作區根目錄',
      '呢個開得到資料夾做工作區根目錄',
      '呢個食得落成個資料夾做工作區根目錄'
    ]
  ),
  'externalEditor.add.blocked': copy(
    ['Choose an executable first.', 'Choose an executable first.', 'Pick the program first.'],
    ['請先揀執行檔。', '先揀執行檔啦。', '先揀個程式先啦。']
  ),
  'externalEditor.add.refused': copy(
    [
      'That editor was not added: {message}',
      'That editor was not added: {message}',
      'It did not get in: {message}'
    ],
    ['嗰個編輯器加唔到：{message}', '加唔到：{message}', '入唔到嚟：{message}']
  ),
  'externalEditor.add.addedLinked': copy(
    [
      '{name} was added, and it is the same file as an editor this application already knows, so it can be started from here.',
      '{name} was added, and it is the same file as an editor this application knows, so it can be started from here.',
      '{name} is in — and it turns out to be one this application already knew, so it starts from here without complaint.'
    ],
    [
      '已加入 {name}，而且佢同應用程式本身識嘅編輯器係同一個檔案，所以喺呢度啟動到。',
      '已加入 {name}，同應用程式識嗰個係同一個檔案，所以開得到。',
      '{name} 入咗喇 — 原來就係佢本身識嗰個，所以喺呢度開得郁，唔嘈。'
    ]
  ),
  'externalEditor.add.addedUnlinked': copy(
    [
      '{name} was added and its executable was verified, but this application cannot start it: a handoff runs one of the editors it knows how to launch, not an arbitrary program. Use the system default application, or show the file in the file manager, until that changes.',
      '{name} was added and its executable was verified, but this application cannot start it: a handoff runs one of the editors it knows how to launch, not any program at all. Use the default application or the file manager instead.',
      '{name} is in and its executable checks out, but this application cannot start it: a handoff launches one of the editors it knows, not any program you like. Use the default application or the file manager instead.'
    ],
    [
      '已加入 {name}，執行檔亦已核實，但應用程式啟動唔到佢：交接只會啟動佢識點開嗰啲編輯器，唔會開任意程式。喺呢個情況改變之前，請用預設應用程式，或者喺檔案總管顯示。',
      '已加入 {name}，執行檔核實咗，但應用程式開唔到佢：交接淨係開佢識嗰啲編輯器，唔係咩程式都開。請改用預設應用程式或者檔案總管。',
      '{name} 入咗，執行檔亦驗過，但應用程式開唔郁佢：交接淨係啟動佢識嗰啲編輯器，唔係你叫咩就開咩。轉用預設應用程式或者檔案總管啦。'
    ]
  ),

  /* ---------------- open section ---------------- */

  'externalEditor.open.title': copy(
    ['Open something', 'Open something', 'Hand something over'],
    ['打開啲嘢', '開啲嘢', '交啲嘢過去']
  ),
  'externalEditor.open.description': copy(
    [
      'Hand a file or a folder to the active editor. A folder is always opened as a workspace root, so the file tree is there.',
      'Hand a file or a folder to the active editor. A folder always opens as a workspace root, so the tree is there.',
      'Fling a file or a folder at the active editor. A folder always arrives as a workspace root, tree and all.'
    ],
    [
      '將一個檔案或者資料夾交俾使用中嘅編輯器。資料夾一定會開做工作區根目錄，咁先有檔案樹。',
      '將檔案或者資料夾交俾使用中嘅編輯器。資料夾一定開做工作區根目錄，有埋個樹。',
      '掟個檔案或者資料夾俾使用中嘅編輯器。資料夾一定係做工作區根目錄，連個樹一齊到。'
    ]
  ),
  'externalEditor.open.target': copy(
    ['File or folder to open', 'File or folder to open', 'What to hand over'],
    ['要打開嘅檔案或資料夾', '要開嘅檔案或者資料夾', '交咩過去']
  ),
  'externalEditor.open.targetPlaceholder': copy(
    [
      'A file or a folder, chosen with Browse',
      'A file or a folder, chosen with Browse',
      'Press Browse and point at something'
    ],
    ['用「瀏覽」揀嘅檔案或資料夾', '用「瀏覽」揀嘅檔案或資料夾', '撳「瀏覽」，指住樣嘢']
  ),
  'externalEditor.open.targetSupport': copy(
    [
      'The path is checked immediately before the handoff, so a path that has moved says so instead of failing silently.',
      'The path is checked just before the handoff, so a path that has moved says so rather than failing silently.',
      'It is checked a moment before the handoff, so a path that has wandered off says so instead of quietly failing.'
    ],
    [
      '交接之前會即刻核實路徑，所以路徑搬咗會直接講明，唔會靜靜雞失敗。',
      '交接前一刻會核實路徑，搬咗會講明，唔會靜雞雞失敗。',
      '交接前一刻會查真，路徑走咗佬會即刻話你知，唔會靜靜雞收檔。'
    ]
  ),
  'externalEditor.open.kind': copy(
    ['What the path is', 'What the path is', 'What sort of thing is it'],
    ['個路徑係咩', '個路徑係咩', '嗰樣係咩嚟']
  ),
  'externalEditor.open.kindFile': copy(['A file', 'A file', 'A file'], ['一個檔案', '一個檔案', '一個檔案']),
  'externalEditor.open.kindFolder': copy(
    ['A folder', 'A folder', 'A whole folder'],
    ['一個資料夾', '一個資料夾', '成個資料夾']
  ),
  'externalEditor.open.mode': copy(
    ['How a file opens', 'How a file opens', 'How the file arrives'],
    ['檔案點開', '檔案點開', '個檔案點樣到埗']
  ),
  'externalEditor.open.modeFile': copy(
    ['The file on its own', 'The file on its own', 'Just the file, on its own'],
    ['淨係開個檔案', '淨係開個檔案', '得個檔案，孤零零']
  ),
  'externalEditor.open.modeWorkspace': copy(
    [
      'Its folder as a workspace root',
      'Its folder as a workspace root',
      'Its whole folder, as a workspace root'
    ],
    ['佢個資料夾做工作區根目錄', '連資料夾做工作區根目錄', '成個資料夾做工作區根目錄']
  ),
  'externalEditor.open.modeLocked': copy(
    [
      'A folder is always opened as a workspace root, so there is nothing to choose here.',
      'A folder always opens as a workspace root, so there is nothing to choose here.',
      'A folder always arrives as a workspace root, so this one decides itself.'
    ],
    [
      '資料夾一定開做工作區根目錄，所以呢度冇嘢揀。',
      '資料夾一定係工作區根目錄，所以冇得揀。',
      '資料夾一定係做工作區根目錄，所以呢度佢自己話事。'
    ]
  ),
  'externalEditor.open.fallbackNote': copy(
    [
      'These two do not use the editor at all: one asks the operating system to open the path with whatever it considers the default application, and the other shows it in the file manager.',
      'These two do not use the editor: one asks the operating system for its default application, and the other shows the path in the file manager.',
      'Neither of these two goes near the editor: one asks the operating system for whatever it thinks is right, and the other just points at the file.'
    ],
    [
      '呢兩個完全唔會用到編輯器：一個係叫作業系統用佢認為嘅預設應用程式開，另一個係喺檔案總管顯示。',
      '呢兩個唔關編輯器事：一個叫作業系統用預設應用程式開，另一個喺檔案總管顯示。',
      '呢兩個完全唔會掂到編輯器：一個問作業系統點好，另一個淨係指住個檔案俾你睇。'
    ]
  ),
  'externalEditor.open.done': copy(
    ['{editor} opened {path}.', '{editor} opened {path}.', '{editor} caught {path}.'],
    ['{editor} 已經打開 {path}。', '{editor} 開咗 {path}。', '{editor} 接住咗 {path}。']
  ),
  'externalEditor.open.doneWorkspace': copy(
    [
      '{editor} opened {path} as a workspace root.',
      '{editor} opened {path} as a workspace root.',
      '{editor} took {path} on as a workspace root.'
    ],
    [
      '{editor} 已經將 {path} 開做工作區根目錄。',
      '{editor} 將 {path} 開咗做工作區根目錄。',
      '{editor} 接咗 {path} 做工作區根目錄。'
    ]
  ),

  /* ---------------- blocked reasons ---------------- */

  'externalEditor.blocked.noPath': copy(
    ['Choose a file or a folder first.', 'Choose a file or a folder first.', 'Point at something first.'],
    ['請先揀一個檔案或者資料夾。', '先揀個檔案或者資料夾啦。', '先指住樣嘢先啦。']
  ),
  'externalEditor.blocked.chosenUnusable': copy(
    [
      'The chosen editor, {name}, cannot be started from here. Choose another one.',
      'The chosen editor, {name}, cannot be started from here. Choose another one.',
      '{name} is the one you chose and it will not start from here. Pick another.'
    ],
    [
      '你揀嘅編輯器 {name} 喺呢度啟動唔到，請揀第二個。',
      '你揀嘅 {name} 喺呢度開唔到，揀第二個啦。',
      '你點名嗰個 {name} 喺呢度郁唔到，換一個啦。'
    ]
  ),
  'externalEditor.blocked.notProbed': copy(
    [
      'The machine has not been checked for editors yet.',
      'The machine has not been checked for editors yet.',
      'Nobody has looked for an editor yet.'
    ],
    ['仲未檢查過部機有咩編輯器。', '仲未檢查過部機。', '仲未有人去搵過編輯器。']
  ),
  'externalEditor.blocked.noneFound': copy(
    [
      'No editor this application can start was found on this machine.',
      'No editor this application can start was found on this machine.',
      'Nothing on this machine that this application can start turned up.'
    ],
    [
      '喺呢部機搵唔到應用程式啟動到嘅編輯器。',
      '呢部機搵唔到應用程式開得到嘅編輯器。',
      '喺呢部機搵唔到一個佢開得郁嘅。'
    ]
  ),
  'externalEditor.blocked.noWorkspace': copy(
    [
      '{name} cannot open a folder as a workspace root, so nothing was opened. Choose an editor that can, or open the file on its own.',
      '{name} cannot open a folder as a workspace root, so nothing was opened. Choose an editor that can, or open the file on its own.',
      '{name} does not take folders, so nothing was opened. Pick one that does, or send the file on its own.'
    ],
    [
      '{name} 開唔到資料夾做工作區根目錄，所以咩都冇開。請揀個做得到嘅編輯器，或者淨係開個檔案。',
      '{name} 開唔到資料夾做工作區根目錄，所以冇開到嘢。揀個做得到嘅，或者淨係開個檔案。',
      '{name} 唔收資料夾，所以咩都冇開。揀個收嘅，或者淨係掟個檔案過去。'
    ]
  ),
  'externalEditor.blocked.statFailed': copy(
    [
      'That path could not be read: {message}',
      'That path could not be read: {message}',
      'That path would not be read: {message}'
    ],
    ['讀唔到嗰個路徑：{message}', '嗰個路徑讀唔到：{message}', '嗰個路徑死都唔肯俾人讀：{message}']
  ),
  'externalEditor.blocked.missing': copy(
    [
      'There is nothing at {path} on this machine.',
      'There is nothing at {path} on this machine.',
      'There is nothing at {path} — it has gone.'
    ],
    ['呢部機 {path} 度乜都冇。', '{path} 度乜都冇。', '{path} 度吉嘅 — 走咗佬喇。']
  ),
  'externalEditor.blocked.notAFolder': copy(
    ['{path} is a file, not a folder.', '{path} is a file, not a folder.', '{path} is a file, not a folder.'],
    ['{path} 係檔案，唔係資料夾。', '{path} 係檔案，唔係資料夾。', '{path} 係檔案嚟嘅，唔係資料夾。']
  ),
  'externalEditor.blocked.launchFailed': copy(
    ['{name} did not start: {message}', '{name} did not start: {message}', '{name} refused to get up: {message}'],
    ['{name} 啟動唔到：{message}', '{name} 開唔到：{message}', '{name} 死都唔肯起身：{message}']
  ),
  'externalEditor.blocked.noProject': copy(
    [
      'No project folder is set. Choose one in Settings, under External editor.',
      'No project folder is set. Choose one in Settings, under External editor.',
      'No project folder has been set yet. Set one in Settings, under External editor.'
    ],
    [
      '未設定專案資料夾。喺「設定」入面「外部編輯器」度揀一個。',
      '未設定專案資料夾。去「設定」→「外部編輯器」揀一個。',
      '仲未揀過專案資料夾。去「設定」→「外部編輯器」度揀個先。'
    ]
  ),

  /* ---------------- notifications ---------------- */

  'externalEditor.notify.openedFile': copy(
    ['{name} opened {path}.', '{name} opened {path}.', '{name} caught {path}.'],
    ['{name} 已經打開 {path}。', '{name} 開咗 {path}。', '{name} 接住咗 {path}。']
  ),
  'externalEditor.notify.openedFolder': copy(
    [
      '{name} opened {path} as a workspace root.',
      '{name} opened {path} as a workspace root.',
      '{name} took {path} on as a workspace root.'
    ],
    [
      '{name} 已經將 {path} 開做工作區根目錄。',
      '{name} 將 {path} 開咗做工作區根目錄。',
      '{name} 接咗 {path} 做工作區根目錄。'
    ]
  ),
  'externalEditor.notify.rechecked': copy(
    [
      'The machine was checked: {count} usable editors.',
      'The machine was checked: {count} usable editors.',
      'Had another look: {count} editors that will actually start.'
    ],
    ['已檢查部機：{count} 個用得嘅編輯器。', '檢查完部機：{count} 個用得。', '再望多次：{count} 個真係開得郁。']
  ),
  'externalEditor.notify.activeSet': copy(
    ['{name} is now the active editor.', '{name} is now the active editor.', '{name} is on duty now.'],
    ['而家使用緊 {name}。', '而家用緊 {name}。', '{name} 而家當值。']
  ),
  'externalEditor.notify.copied': copy(
    [
      '{count} executable paths were copied to the clipboard.',
      '{count} executable paths were copied to the clipboard.',
      '{count} paths are on the clipboard.'
    ],
    ['已複製 {count} 個執行檔路徑到剪貼簿。', '已複製 {count} 個路徑到剪貼簿。', '{count} 個路徑喺剪貼簿度喇。']
  ),
  'externalEditor.notify.copyFailed': copy(
    [
      'The clipboard refused the copy: {message}',
      'The clipboard refused the copy: {message}',
      'The clipboard would not take it: {message}'
    ],
    ['剪貼簿拒絕咗今次複製：{message}', '剪貼簿唔收：{message}', '剪貼簿死都唔肯收：{message}']
  ),
  'externalEditor.notify.removed': copy(
    [
      '{count} added editors were removed.',
      '{count} added editors were removed.',
      '{count} added editors are off the list.'
    ],
    ['已移除 {count} 個你加嘅編輯器。', '剷走咗 {count} 個你加嘅。', '{count} 個你加嘅已經劃走咗。']
  ),
  'externalEditor.notify.removedPartial': copy(
    [
      '{count} added editors were removed. {skipped} detected editors were left alone, because they are found on the machine rather than stored here.',
      '{count} added editors were removed. {skipped} detected ones were left alone, because they are found on the machine rather than stored here.',
      '{count} added editors are off the list. {skipped} detected ones were left where they were — they are found on the machine, not kept here.'
    ],
    [
      '已移除 {count} 個你加嘅編輯器。{skipped} 個偵測到嘅冇郁過，因為佢哋係喺部機搵返嚟，唔係儲喺呢度。',
      '剷走咗 {count} 個你加嘅。{skipped} 個偵測到嘅冇郁，因為佢哋係搵返嚟，唔係儲喺度。',
      '{count} 個你加嘅劃走咗。{skipped} 個偵測到嘅原封不動 — 佢哋係喺部機搵返嚟，唔係擺喺呢度。'
    ]
  ),
  'externalEditor.notify.forgot': copy(
    [
      '{count} recent handoffs were forgotten.',
      '{count} recent handoffs were forgotten.',
      '{count} recent handoffs have been forgotten.'
    ],
    ['已忘記 {count} 條最近交接記錄。', '刪咗 {count} 條最近交接記錄。', '{count} 條最近交接記錄，當冇發生過。']
  ),
  'externalEditor.notify.exported': copy(
    [
      '{count} rows were written to {path}.',
      '{count} rows were written to {path}.',
      '{count} rows landed in {path}.'
    ],
    ['已將 {count} 行寫入 {path}。', '{count} 行寫咗入 {path}。', '{count} 行安全降落 {path}。']
  ),
  'externalEditor.notify.downloadOpened': copy(
    [
      'The download page was opened in your browser: {url}',
      'The download page was opened in your browser: {url}',
      'The download page is up in your browser: {url}'
    ],
    ['已喺你嘅瀏覽器打開下載頁：{url}', '已喺你個瀏覽器開咗下載頁：{url}', '下載頁喺你個瀏覽器度開好咗：{url}']
  ),
  'externalEditor.notify.downloadFailed': copy(
    [
      'The browser could not be opened: {message}. The address is {url}',
      'The browser could not be opened: {message}. The address is {url}',
      'The browser would not open: {message}. The address is {url}'
    ],
    ['開唔到瀏覽器：{message}。網址係 {url}', '瀏覽器開唔到：{message}。網址係 {url}', '瀏覽器唔肯開：{message}。網址係 {url}']
  ),
  'externalEditor.notify.systemOpened': copy(
    [
      'The operating system opened {path} with its default application, which may not be an editor.',
      'The operating system opened {path} with its default application, which may not be an editor.',
      'The operating system opened {path} with whatever it considers the default — which may well not be an editor.'
    ],
    [
      '作業系統已經用預設應用程式打開 {path}，嗰個未必係編輯器。',
      '作業系統用預設應用程式開咗 {path}，未必係編輯器嚟。',
      '作業系統用佢認為嘅預設程式開咗 {path} — 好可能唔係編輯器。'
    ]
  ),
  'externalEditor.notify.systemFailed': copy(
    ['{path} could not be opened: {message}', '{path} could not be opened: {message}', '{path} would not open: {message}'],
    ['開唔到 {path}：{message}', '{path} 開唔到：{message}', '{path} 死都唔肯開：{message}']
  ),
  'externalEditor.notify.revealed': copy(
    [
      '{path} was shown in the file manager.',
      '{path} was shown in the file manager.',
      '{path} is showing in the file manager.'
    ],
    ['已喺檔案總管顯示 {path}。', '已喺檔案總管顯示 {path}。', '{path} 而家喺檔案總管度晒緊命。']
  ),
  'externalEditor.notify.revealFailed': copy(
    [
      'The file manager could not be opened: {message}',
      'The file manager could not be opened: {message}',
      'The file manager would not open: {message}'
    ],
    ['開唔到檔案總管：{message}', '檔案總管開唔到：{message}', '檔案總管唔肯開：{message}']
  ),

  /* ---------------- confirmations ---------------- */

  'externalEditor.confirm.removeAction': copy(
    ['Remove {count} added editors', 'Remove {count} added editors', 'Remove {count} added editors'],
    ['移除 {count} 個你加嘅編輯器', '移除 {count} 個你加嘅編輯器', '剷走 {count} 個你加嘅編輯器']
  ),
  'externalEditor.confirm.removeIrreversible': copy(
    [
      'These entries are deleted from this application. The editors themselves are not touched and stay installed; adding one again means browsing for its executable again.',
      'These entries are deleted from this application. The editors themselves are untouched and stay installed; adding one back means browsing for its executable again.',
      'These entries are deleted from this application. The editors themselves are untouched and stay installed — adding one back means going and finding its executable again.'
    ],
    [
      '呢啲項目會喺應用程式度刪走。啲編輯器本身唔會有事，仍然裝住；想再加返就要再瀏覽搵返個執行檔。',
      '呢啲項目會喺應用程式度刪走。編輯器本身唔會郁到，照樣裝住；想加返就要再搵返個執行檔。',
      '呢啲項目會喺應用程式度刪走。編輯器本身安然無恙、照樣裝住 — 想加返就要再去搵過個執行檔。'
    ]
  ),
  'externalEditor.confirm.forgetAction': copy(
    ['Forget {count} recent handoffs', 'Forget {count} recent handoffs', 'Forget {count} recent handoffs'],
    ['忘記 {count} 條最近交接記錄', '刪走 {count} 條最近交接記錄', '當 {count} 條最近交接記錄冇發生過']
  ),
  'externalEditor.confirm.forgetIrreversible': copy(
    [
      'These records are removed from this application. No file is touched and nothing on disk is deleted.',
      'These records are removed from this application. No file is touched and nothing on disk is deleted.',
      'These records are removed from this application. Not one file is touched; nothing on disk goes anywhere.'
    ],
    [
      '呢啲記錄會喺應用程式度移除。唔會郁到任何檔案，硬碟上面亦唔會刪到嘢。',
      '呢啲記錄會喺應用程式度移除。唔會郁到檔案，硬碟上面乜都唔會刪。',
      '呢啲記錄會喺應用程式度移除。一個檔案都唔會郁到，硬碟上面乜都唔會少。'
    ]
  ),

  /* ---------------- export dialog ---------------- */

  'externalEditor.export.lossTitle': copy(
    [
      'This format cannot carry every field',
      'This format cannot carry every field',
      'This format cannot carry the lot'
    ],
    ['呢個格式載唔起所有欄位', '呢個格式載唔起晒啲欄位', '呢個格式載唔起咁多嘢']
  ),
  'externalEditor.export.lossBody': copy(
    [
      '{format} would drop or flatten: {fields}. Everything else is written exactly as shown.',
      '{format} would drop or flatten: {fields}. Everything else is written exactly as shown.',
      '{format} would drop or squash: {fields}. Everything else goes in exactly as you see it.'
    ],
    [
      '{format} 會丟失或者壓平：{fields}。其餘一切都會照顯示嘅樣寫入。',
      '{format} 會丟失或者壓平：{fields}。其餘照樣寫入。',
      '{format} 會漏走或者壓扁：{fields}。其餘一律照你見到嗰個樣入檔。'
    ]
  ),
  'externalEditor.export.proceed': copy(
    ['Write it anyway', 'Write it anyway', 'Write it anyway'],
    ['照樣寫入', '照樣寫入', '照寫唔理']
  ),
  'externalEditor.export.cancel': copy(
    ['Choose another format', 'Choose another format', 'Try another format'],
    ['揀第二個格式', '揀第二個格式', '換個格式試下']
  ),

  /* ---------------- recent handoffs ---------------- */

  'externalEditor.recent.title': copy(
    ['Recent handoffs', 'Recent handoffs', 'What was handed over lately'],
    ['最近嘅交接', '最近嘅交接', '最近交咗啲乜過去']
  ),
  'externalEditor.recent.description': copy(
    [
      'Every path handed over, successful or refused, with the exact reason a refusal gave. Forgetting a record removes the record only; no file is touched.',
      'Every path handed over, successful or refused, with the exact reason for a refusal. Forgetting a record removes the record only; no file is touched.',
      'Every path that was handed over, triumph or refusal, with the exact reason it was refused. Forgetting one forgets the record and nothing else.'
    ],
    [
      '每個交接過嘅路徑，成功定失敗都有，仲有失敗嗰陣嘅確實原因。刪走記錄淨係刪記錄，唔會郁到任何檔案。',
      '每個交接過嘅路徑，成功定失敗都記低，連失敗原因都有。刪記錄淨係刪記錄，唔會郁檔案。',
      '每個交接過嘅路徑，成功定食檸檬都記低晒，連被拒嘅原因都有。刪走一條淨係刪咗條記錄，其他乜都唔郁。'
    ]
  ),
  'externalEditor.recent.search': copy(
    ['Search recent handoffs', 'Search recent handoffs', 'Sift the recent handoffs'],
    ['搵最近嘅交接', '搵最近嘅交接', '篩下最近啲交接']
  ),
  'externalEditor.recent.empty': copy(
    [
      'No handoff matched. Clear the search to see them all.',
      'No handoff matched. Clear the search to see them all.',
      'Nothing matched. Clear the search and they all come back.'
    ],
    ['冇交接記錄符合。清走搜尋就見返全部。', '冇嘢啱。清走搜尋就見返全部。', '一條都唔啱。清走搜尋，全部返晒嚟。']
  ),
  'externalEditor.recent.emptyTitle': copy(
    ['Nothing has been handed over yet', 'Nothing has been handed over yet', 'Nothing has been handed over yet'],
    ['仲未交接過任何嘢', '仲未交接過嘢', '一次都仲未交接過']
  ),
  'externalEditor.recent.emptyBody': copy(
    [
      'Open a file or a folder above and it will be recorded here, including the exact reason if it is refused.',
      'Open a file or a folder above and it is recorded here, including the exact reason if it is refused.',
      'Send a file or a folder over and it lands here — including the exact reason if it bounces.'
    ],
    [
      '喺上面開個檔案或者資料夾，就會記低喺呢度，連被拒嘅確實原因都有。',
      '喺上面開個檔案或者資料夾，就會記低喺呢度，失敗原因都會記。',
      '掟個檔案或者資料夾過去，就會喺呢度出現 — 就算彈返轉頭都會寫清楚點解。'
    ]
  ),
  'externalEditor.recent.noEditor': copy(
    ['None could be started', 'None could be started', 'Nobody could be started'],
    ['冇一個啟動到', '冇一個開到', '一個都開唔郁']
  ),
  'externalEditor.column.when': copy(['When', 'When', 'When'], ['時間', '時間', '幾時']),
  'externalEditor.column.path': copy(['Path', 'Path', 'Path'], ['路徑', '路徑', '路徑']),
  'externalEditor.column.openedAs': copy(
    ['Opened as', 'Opened as', 'Arrived as'],
    ['以咩形式打開', '點樣開', '點樣到埗']
  ),
  'externalEditor.column.editor': copy(['Editor', 'Editor', 'Editor'], ['編輯器', '編輯器', '邊個編輯器']),
  'externalEditor.column.outcome': copy(['Outcome', 'Outcome', 'How it went'], ['結果', '結果', '點收科']),
  'externalEditor.outcome.ok': copy(['Opened', 'Opened', 'Opened'], ['已打開', '開咗', '開咗']),
  'externalEditor.mode.file': copy(
    ['The file on its own', 'The file on its own', 'Just the file'],
    ['淨係個檔案', '淨係個檔案', '得個檔案']
  ),
  'externalEditor.mode.workspace': copy(
    ['Folder as a workspace root', 'Folder as a workspace root', 'The whole folder, as a workspace root'],
    ['資料夾做工作區根目錄', '資料夾做工作區根目錄', '成個資料夾做工作區根目錄']
  ),

  /* ---------------- settings ---------------- */

  'externalEditor.settings.section': copy(
    ['External editor', 'External editor', 'External editor'],
    ['外部編輯器', '外部編輯器', '外部編輯器']
  ),
  'externalEditor.settings.active': copy(
    ['Editor used for every handoff', 'Editor used for every handoff', 'Who gets the files'],
    ['每次交接用嘅編輯器', '每次交接用嘅編輯器', '啲檔案交俾邊個']
  ),
  'externalEditor.settings.active.description': copy(
    [
      'The picker lists what was actually detected on this machine plus what you added, so it can never offer an editor that is not there. Choose automatically prefers Visual Studio Code; an explicit choice that is unavailable opens nothing rather than starting something else.',
      'The picker lists what was detected here plus what you added, so it never offers an editor that is not there. Automatic prefers Visual Studio Code; an explicit choice that is unavailable opens nothing rather than starting something else.',
      'The picker lists what actually turned up here plus what you added, so it cannot offer a ghost. Automatic prefers Visual Studio Code; name one yourself and it is that one or nothing.'
    ],
    [
      '選單列出喺呢部機真正偵測到嘅，加埋你自己加嘅，所以永遠唔會俾一個唔存在嘅編輯器你揀。自動揀會優先 Visual Studio Code；你明確揀嗰個如果用唔到，就咩都唔開，唔會用第二個代替。',
      '選單列出偵測到嘅同你加嘅，所以唔會俾唔存在嘅你揀。自動優先 Visual Studio Code；你揀嗰個用唔到就咩都唔開，唔會用第二個。',
      '選單淨係列真係搵到同你加嘅，唔會出鬼。自動優先 Visual Studio Code；你自己點名就淨係佢，唔得就算。'
    ]
  ),
  'externalEditor.settings.fileMode': copy(
    ['How a file opens by default', 'How a file opens by default', 'How a file usually arrives'],
    ['預設點開檔案', '預設點開檔案', '個檔案平時點到埗']
  ),
  'externalEditor.settings.fileMode.description': copy(
    [
      'A handoff for a single file can open the file on its own, or open its containing folder as a workspace root with the file tree. This is the starting choice; each handoff can override it.',
      'A single file can open on its own, or its folder can open as a workspace root with the file tree. This is the starting choice; each handoff can override it.',
      'A single file can arrive alone, or bring its whole folder along as a workspace root. This is the starting choice; any one handoff can overrule it.'
    ],
    [
      '單一檔案嘅交接可以淨係開個檔案，或者將佢所在資料夾開做工作區根目錄，連檔案樹一齊。呢個係起始選擇，每次交接都可以改。',
      '單一檔案可以淨係開個檔案，或者連資料夾開做工作區根目錄，有埋檔案樹。呢個係起始選擇，每次交接可以改。',
      '單一檔案可以孤身上路，或者拉埋成個資料夾做工作區根目錄。呢個係起始選擇，每次交接都可以推翻。'
    ]
  ),
  'externalEditor.settings.probeAtStart': copy(
    [
      'Check this machine for editors at startup',
      'Check this machine for editors at startup',
      'Look for editors when the application wakes up'
    ],
    ['啟動時檢查呢部機有咩編輯器', '開機時檢查有咩編輯器', '應用程式醒嗰陣去搵編輯器']
  ),
  'externalEditor.settings.probeAtStart.description': copy(
    [
      'Probes PATH and the usual install locations once, shortly after the application starts, so the first handoff does not have to wait. Turned off, the machine is checked the first time the External editor tab is opened, or when Re-check is used.',
      'Probes PATH and the usual install locations once, shortly after startup, so the first handoff does not wait. Turned off, the check happens the first time the tab is opened, or on Re-check.',
      'Has a look through PATH and the usual haunts shortly after startup, so the first handoff does not queue. Off, it looks the first time you open the tab, or when you press Re-check.'
    ],
    [
      '應用程式啟動之後好快會檢查一次 PATH 同常見安裝位置，等第一次交接唔使等。閂咗嘅話，就會喺第一次打開「外部編輯器」分頁，或者撳「再檢查」嗰陣先檢查。',
      '啟動後好快檢查一次 PATH 同常見安裝位置，第一次交接就唔使等。閂咗就等到你第一次開分頁或者撳「再檢查」先做。',
      '開機後好快去 PATH 同啲熟門熟路嘅位望一望，第一次交接就唔使排隊。閂咗就等你開分頁或者撳「再檢查」先郁。'
    ]
  ),
  'externalEditor.settings.projectFolder': copy(
    ['Project folder', 'Project folder', 'The folder you actually work in'],
    ['專案資料夾', '專案資料夾', '你真係做嘢嗰個資料夾']
  ),
  'externalEditor.settings.projectFolder.description': copy(
    [
      'The folder the "Open the project folder" command and button hand over, as a workspace root. Left empty, both say so and stay disabled rather than guessing at a folder.',
      'The folder the "Open the project folder" command and button hand over, as a workspace root. Left empty, both say so and stay disabled rather than guessing.',
      'The folder that "Open the project folder" sends over as a workspace root. Leave it empty and both say so and stay disabled, rather than guessing at one.'
    ],
    [
      '「打開專案資料夾」指令同按鈕會將呢個資料夾做工作區根目錄交出去。留空嘅話，兩者都會講明並且保持停用，唔會亂估一個資料夾。',
      '「打開專案資料夾」指令同按鈕會交呢個資料夾做工作區根目錄。留空就兩樣都會講明並停用，唔會亂估。',
      '「打開專案資料夾」就係交呢個做工作區根目錄。留空嘅話兩樣都會照直講然後停用，唔會靠估。'
    ]
  ),
  'externalEditor.settings.recentLimit': copy(
    ['Recent handoffs kept', 'Recent handoffs kept', 'How long the memory is'],
    ['保留幾多條最近交接', '保留幾多條最近交接', '記性有幾長']
  ),
  'externalEditor.settings.recentLimit.description': copy(
    [
      'How many recent handoffs are kept, successes and refusals alike. Older records fall off the end as new ones arrive. Zero keeps none, and the list says so rather than looking broken.',
      'How many recent handoffs are kept, successes and refusals alike. Older ones fall off as new ones arrive. Zero keeps none, and the list says so rather than looking broken.',
      'How many recent handoffs are kept, triumphs and refusals alike. Old ones fall off the end as new ones pile on. Zero keeps none, and the list says so rather than looking broken.'
    ],
    [
      '保留幾多條最近交接記錄，成功同失敗一樣咁計。有新記錄就會迫走最舊嗰啲。設做零就一條都唔留，而個清單會直接講明，唔會扮壞咗。',
      '保留幾多條最近交接，成功失敗一樣計。有新嘅就迫走舊嘅。零就一條都唔留，清單會講明，唔係壞咗。',
      '記住幾多條最近交接，威水同食檸檬一樣計。新嘅嚟舊嘅就跌出去。零就一條唔留，清單會照直講，唔係壞咗。'
    ]
  ),
  'externalEditor.settings.openTab': copy(
    ['Open the External editor tab', 'Open the External editor tab', 'Take me to the External editor tab'],
    ['打開「外部編輯器」分頁', '打開「外部編輯器」分頁', '帶我去「外部編輯器」分頁']
  ),
  'externalEditor.settings.openTab.description': copy(
    [
      'Opens the destination holding the editor list, the add form and the handoff controls.',
      'Opens the destination with the editor list, the add form and the handoff controls.',
      'Opens the destination holding the editor list, the add form and everything that does the handing over.'
    ],
    [
      '打開放住編輯器清單、加入表單同交接控制項嗰個分頁。',
      '打開有編輯器清單、加入表單同交接控制項嗰頁。',
      '打開放住編輯器清單、加入表單，同埋一切負責交接嘅嘢嗰頁。'
    ]
  ),
  'externalEditor.settings.recheck': copy(
    ['Check this machine now', 'Check this machine now', 'Go and look right now'],
    ['而家檢查呢部機', '而家檢查呢部機', '而家即刻去望']
  ),
  'externalEditor.settings.recheck.description': copy(
    [
      'Probes for installed editors again and re-verifies every executable you added against the disk, so an editor uninstalled or moved since the last check stops claiming to be there.',
      'Probes for installed editors again and re-checks every executable you added against the disk, so one that was uninstalled or moved stops claiming to be there.',
      'Goes and looks again, and re-checks every executable you added against the disk, so anything uninstalled or moved stops pretending it is still around.'
    ],
    [
      '再偵測一次已安裝嘅編輯器，同時將你加嘅每個執行檔對照硬碟重新核實，令上次檢查之後被移除或者搬咗嘅編輯器唔再扮仲喺度。',
      '再偵測一次已安裝嘅編輯器，同埋重新核實你加嘅每個執行檔，令搬咗或者移除咗嘅唔再扮喺度。',
      '再去望多次，順手將你加嘅每個執行檔對硬碟查真，令走咗佬嘅唔好再扮仲喺度。'
    ]
  ),
  'externalEditor.settings.download': copy(
    ['Download Visual Studio Code', 'Download Visual Studio Code', 'Go and get Visual Studio Code'],
    ['下載 Visual Studio Code', '下載 Visual Studio Code', '去攞返個 Visual Studio Code']
  ),
  'externalEditor.settings.download.description': copy(
    [
      'Opens the Visual Studio Code download page in your browser. This application downloads nothing itself and makes no request of its own.',
      'Opens the Visual Studio Code download page in your browser. This application downloads nothing and makes no request of its own.',
      'Opens the Visual Studio Code download page in your browser and then stays out of it. The application fetches nothing itself.'
    ],
    [
      '喺你嘅瀏覽器打開 Visual Studio Code 下載頁。應用程式本身唔會下載任何嘢，亦唔會自己發出請求。',
      '喺你個瀏覽器開 Visual Studio Code 下載頁。應用程式自己咩都唔下載，亦唔會發請求。',
      '喺你個瀏覽器開 Visual Studio Code 下載頁，然後就唔關佢事。應用程式自己乜都唔攞。'
    ]
  ),

  /* ---------------- palette ---------------- */

  'externalEditor.palette.open': copy(
    ['External editor', 'External editor', 'External editor'],
    ['外部編輯器', '外部編輯器', '外部編輯器']
  ),
  'externalEditor.palette.openSubtitle': copy(
    [
      'Choose an editor, add one, and hand a path over',
      'Choose an editor, add one, and hand a path over',
      'Choose an editor, add one, fling a path at it'
    ],
    ['揀編輯器、加編輯器、交路徑過去', '揀編輯器、加編輯器、交路徑', '揀編輯器、加編輯器、掟個路徑過去']
  ),
  'externalEditor.palette.openProject': copy(
    [
      'Open the project folder in the external editor',
      'Open the project folder in the external editor',
      'Send the project folder to the external editor'
    ],
    ['喺外部編輯器打開專案資料夾', '喺外部編輯器打開專案資料夾', '將專案資料夾掟俾外部編輯器']
  ),
  'externalEditor.palette.openFile': copy(
    [
      'Open a file in the external editor…',
      'Open a file in the external editor…',
      'Pick a file and send it to the external editor…'
    ],
    ['喺外部編輯器打開一個檔案⋯', '喺外部編輯器開個檔案⋯', '揀個檔案掟俾外部編輯器⋯']
  ),
  'externalEditor.palette.openFolder': copy(
    [
      'Open a folder in the external editor…',
      'Open a folder in the external editor…',
      'Pick a folder and send it over as a workspace root…'
    ],
    ['喺外部編輯器打開一個資料夾⋯', '喺外部編輯器開個資料夾⋯', '揀個資料夾，做工作區根目錄交過去⋯']
  ),
  'externalEditor.palette.recheck': copy(
    ['Check this machine for editors', 'Check this machine for editors', 'Go and look for editors'],
    ['檢查呢部機有咩編輯器', '檢查呢部機有咩編輯器', '去搵下有咩編輯器']
  ),
  'externalEditor.palette.download': copy(
    ['Download Visual Studio Code', 'Download Visual Studio Code', 'Go and get Visual Studio Code'],
    ['下載 Visual Studio Code', '下載 Visual Studio Code', '去攞返個 Visual Studio Code']
  ),
  'externalEditor.palette.add': copy(
    ['Add an editor by browsing for it', 'Add an editor by browsing for it', 'Go and find an editor yourself'],
    ['瀏覽加入一個編輯器', '瀏覽加個編輯器', '自己去搵個編輯器返嚟']
  ),
  'externalEditor.palette.recent': copy(
    ['Recent editor handoffs', 'Recent editor handoffs', 'What was handed over lately'],
    ['最近嘅編輯器交接', '最近嘅編輯器交接', '最近交咗啲乜過去']
  )
};
