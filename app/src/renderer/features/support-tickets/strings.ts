import type { Catalogue, FunnyLadder, TranslationEntry } from '../../core/registry';

/**
 * Every piece of copy this feature renders.
 *
 * The humour level styles the VOICE and never the FACTS. At level 5 the desk is
 * insufferably officious; at level 1 it is a plain form. In both, and at every
 * rung between them, the ticket number is the same ticket number, the folder is
 * the same folder, the button does the same thing, and the sentence saying that
 * nothing is sent anywhere is the same sentence — that one is not in this file
 * at all, because it is deliberately outside the comedy (see `disclosure.ts`).
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

export const supportTicketsStrings: Catalogue = {
  /* ---------------- destination and headings ---------------- */

  'supportTickets.title': entry(ladder('Support Tickets'), ladder('客戶服務單')),
  'supportTickets.subtitle': entry(
    ladder(
      'Raise a ticket, then open the folder that actually fixes it.',
      'Raise a ticket, then open the folder that actually fixes it.',
      'Raise a ticket. Then open the folder that actually fixes it.',
      'Raise a ticket for the full service-desk experience. Then open the folder, which is the bit that works.',
      'Raise a ticket for the full service-desk experience. Then open the folder, which is the bit that works.'
    ),
    ladder(
      '開張單，再開個資料夾——真正解決問題嘅係嗰個資料夾。',
      '開張單，再開個資料夾——真正解決問題嘅係嗰個資料夾。',
      '開張單過下癮，跟住開個資料夾，因為得嗰個先真係有用。',
      '想試下客服全套流程就開張單，之後記得開個資料夾——得嗰個係真係work㗎。',
      '想試下客服全套流程就開張單，之後記得開個資料夾——得嗰個係真係work㗎。'
    )
  ),
  'supportTickets.deskName': entry(
    ladder("this application's own Support Desk"),
    ladder('呢個程式自己嘅客服部')
  ),
  'supportTickets.fictional': entry(
    ladder(
      'The desk is fictional and belongs to this application. It is not any company, product or person.',
      'The desk is fictional and belongs to this application. It is not any company, product or person.',
      'The desk is fictional and belongs to this application alone. It is not any company, product or person.',
      'The desk is fictional and belongs to this application alone. It is not a company, not a product, not a person, and definitely not anybody with a headset.',
      'The desk is fictional and belongs to this application alone. It is not a company, not a product, not a person, and definitely not anybody with a headset.'
    ),
    ladder(
      '呢個客服部係虛構嘅，只屬於呢個程式，唔代表任何公司、產品或者人。',
      '呢個客服部係虛構嘅，只屬於呢個程式，唔代表任何公司、產品或者人。',
      '呢個客服部係虛構嘅，淨係屬於呢個程式，唔關任何公司、產品或者人事。',
      '呢個客服部係虛構嘅，淨係屬於呢個程式：唔係公司，唔係產品，唔係人，更加唔係邊個戴住耳機喺度等你。',
      '呢個客服部係虛構嘅，淨係屬於呢個程式：唔係公司，唔係產品，唔係人，更加唔係邊個戴住耳機喺度等你。'
    )
  ),

  /* ---------------- the form ---------------- */

  'supportTickets.new.heading': entry(ladder('Raise a ticket'), ladder('開一張單')),
  'supportTickets.new.description': entry(
    ladder(
      'Creates a ticket record stored in this application on this computer.',
      'Creates a ticket record stored in this application on this computer.',
      'Creates a ticket record, stored in this application on this computer and nowhere else.',
      'Creates a ticket record, stored in this application on this computer and nowhere else, for your own amusement.',
      'Creates a ticket record, stored in this application on this computer and nowhere else, for your own amusement.'
    ),
    ladder(
      '會喺呢部電腦嘅程式入面開一筆單記錄。',
      '會喺呢部電腦嘅程式入面開一筆單記錄。',
      '會喺呢部電腦嘅程式入面開一筆單記錄，其他地方一律冇。',
      '會喺呢部電腦嘅程式入面開一筆單記錄，其他地方一律冇——純粹畀你玩下開心下。',
      '會喺呢部電腦嘅程式入面開一筆單記錄，其他地方一律冇——純粹畀你玩下開心下。'
    )
  ),
  'supportTickets.field.category': entry(ladder('Category'), ladder('問題類別')),
  'supportTickets.field.severity': entry(ladder('Severity'), ladder('緊急程度')),
  'supportTickets.field.severity.hint': entry(
    ladder(
      'Stored with the ticket. Nothing in this application treats one severity differently from another.',
      'Stored with the ticket. Nothing in this application treats one severity differently from another.',
      'Stored with the ticket. Nothing here treats one severity differently from another, so pick whichever feels right.',
      'Stored with the ticket, and honoured by absolutely nobody. Nothing here treats one severity differently from another, so pick the one that suits your mood.',
      'Stored with the ticket, and honoured by absolutely nobody. Nothing here treats one severity differently from another, so pick the one that suits your mood.'
    ),
    ladder(
      '會同單一齊儲起。程式對唔同緊急程度嘅處理完全一樣。',
      '會同單一齊儲起。程式對唔同緊急程度嘅處理完全一樣。',
      '會同單一齊儲起，不過程式對邊個級別都一視同仁，你鍾意揀邊個都得。',
      '會同單一齊儲起，然後冇人會理。程式對邊個級別都一視同仁，你今日心情想揀邊個就揀邊個。',
      '會同單一齊儲起，然後冇人會理。程式對邊個級別都一視同仁，你今日心情想揀邊個就揀邊個。'
    )
  ),
  'supportTickets.field.description': entry(ladder('Describe the issue'), ladder('講下咩事')),
  'supportTickets.field.description.placeholder': entry(
    ladder(
      'Up to {max} characters. Stored locally.',
      'Up to {max} characters. Stored locally.',
      'Up to {max} characters, stored locally and read by nobody.',
      'Up to {max} characters. Write whatever you like — it is stored on this machine and read by nobody, so you may be as honest as you please.',
      'Up to {max} characters. Write whatever you like — it is stored on this machine and read by nobody, so you may be as honest as you please.'
    ),
    ladder(
      '最多 {max} 個字元，儲喺本機。',
      '最多 {max} 個字元，儲喺本機。',
      '最多 {max} 個字元，儲喺本機，冇人會睇。',
      '最多 {max} 個字元。想寫咩就寫咩——淨係儲喺呢部機，冇人會睇，所以你想幾坦白都得。',
      '最多 {max} 個字元。想寫咩就寫咩——淨係儲喺呢部機，冇人會睇，所以你想幾坦白都得。'
    )
  ),
  'supportTickets.field.description.tooLong': entry(
    ladder('That is {count} characters. The limit is {max}.'),
    ladder('你寫咗 {count} 個字元，上限係 {max} 個。')
  ),
  'supportTickets.field.description.empty': entry(
    ladder(
      'Write something first, even one word.',
      'Write something first, even one word.',
      'Write something first — even one word will do.',
      'Write something first. One word is enough; the desk is not fussy, mostly because the desk is not real.',
      'Write something first. One word is enough; the desk is not fussy, mostly because the desk is not real.'
    ),
    ladder(
      '先寫少少嘢，一個字都得。',
      '先寫少少嘢，一個字都得。',
      '先寫少少嘢啦，一個字都收貨。',
      '先寫少少嘢啦，一個字都收貨——客服唔揀擇，主要係因為佢根本唔存在。',
      '先寫少少嘢啦，一個字都收貨——客服唔揀擇，主要係因為佢根本唔存在。'
    )
  ),
  'supportTickets.action.submit': entry(ladder('Raise the ticket'), ladder('開單')),
  'supportTickets.action.reset': entry(ladder('Clear the form'), ladder('清空表格')),

  /* ---------------- categories ---------------- */

  'supportTickets.category.lockout': entry(
    ladder('I have locked myself out'),
    ladder('我自己鎖死咗自己')
  ),
  'supportTickets.category.forgotten': entry(
    ladder('I have forgotten the password'),
    ladder('我唔記得咗個密碼')
  ),
  'supportTickets.category.authenticator': entry(
    ladder('My authenticator is on a phone I no longer have'),
    ladder('我個驗證器喺一部我已經冇咗嘅電話度')
  ),
  'supportTickets.category.appearance': entry(
    ladder('I locked an appearance setting and cannot change it back'),
    ladder('我鎖咗個外觀設定，而家改唔返')
  ),
  'supportTickets.category.other': entry(
    ladder('Something else entirely'),
    ladder('完全另一件事')
  ),

  /* ---------------- severities ---------------- */

  'supportTickets.severity.routine': entry(ladder('Routine'), ladder('普通')),
  'supportTickets.severity.elevated': entry(ladder('Elevated'), ladder('偏高')),
  'supportTickets.severity.urgent': entry(ladder('Urgent'), ladder('緊急')),
  'supportTickets.severity.catastrophic': entry(
    ladder('Business critical'),
    ladder('全公司死火')
  ),

  /* ---------------- statuses ---------------- */

  'supportTickets.status.received': entry(ladder('Received'), ladder('已收到')),
  'supportTickets.status.triaged': entry(ladder('Triaged'), ladder('已分流')),
  'supportTickets.status.escalated': entry(ladder('Escalated'), ladder('已升級')),
  'supportTickets.status.resolutionIssued': entry(
    ladder('Resolution issued'),
    ladder('已發出解決方案')
  ),
  'supportTickets.status.closed': entry(ladder('Closed'), ladder('已結案')),

  /* ---------------- canned replies ---------------- */

  'supportTickets.reply.received': entry(
    ladder(
      'Ticket {ticket} has been created. It is stored on this computer only.',
      'Ticket {ticket} has been created. It is stored on this computer only.',
      'Thank you for contacting the desk. Ticket {ticket} has been created and is stored on this computer only.',
      'Thank you for contacting the desk. Your ticket {ticket} is important to this application, which is storing it on this computer and showing it to nobody. A representative has not been assigned, because there are none.',
      'Thank you for contacting the desk. Your ticket {ticket} is important to this application, which is storing it on this computer and showing it to nobody. A representative has not been assigned, because there are none.'
    ),
    ladder(
      '單 {ticket} 已經開好，淨係儲喺呢部電腦。',
      '單 {ticket} 已經開好，淨係儲喺呢部電腦。',
      '多謝你聯絡客服部。單 {ticket} 已經開好，淨係儲喺呢部電腦。',
      '多謝你聯絡客服部。你張單 {ticket} 對本程式嚟講非常重要，所以佢已經儲咗喺呢部電腦，然後冇畀任何人睇。暫時未分配專員，因為根本一個都冇。',
      '多謝你聯絡客服部。你張單 {ticket} 對本程式嚟講非常重要，所以佢已經儲咗喺呢部電腦，然後冇畀任何人睇。暫時未分配專員，因為根本一個都冇。'
    )
  ),
  'supportTickets.reply.triaged': entry(
    ladder(
      'Ticket {ticket} has been triaged. The resolution is unchanged: open the folder below.',
      'Ticket {ticket} has been triaged. The resolution is unchanged: open the folder below.',
      'Ticket {ticket} has been triaged and categorised. The resolution has not changed: open the folder below.',
      'Ticket {ticket} has been triaged, categorised, and given a colour on a board nobody is looking at. The resolution is exactly what it was a moment ago: open the folder below.',
      'Ticket {ticket} has been triaged, categorised, and given a colour on a board nobody is looking at. The resolution is exactly what it was a moment ago: open the folder below.'
    ),
    ladder(
      '單 {ticket} 已經分流。解決方法冇變：開下面嗰個資料夾。',
      '單 {ticket} 已經分流。解決方法冇變：開下面嗰個資料夾。',
      '單 {ticket} 已經分流兼分類。解決方法一樣冇變：開下面嗰個資料夾。',
      '單 {ticket} 已經分流、分類，仲喺一塊冇人望嘅板上面畀咗個顏色。解決方法同頭先一模一樣：開下面嗰個資料夾。',
      '單 {ticket} 已經分流、分類，仲喺一塊冇人望嘅板上面畀咗個顏色。解決方法同頭先一模一樣：開下面嗰個資料夾。'
    )
  ),
  'supportTickets.reply.escalated': entry(
    ladder(
      'Ticket {ticket} has been escalated. The resolution is unchanged: open the folder below.',
      'Ticket {ticket} has been escalated. The resolution is unchanged: open the folder below.',
      'Ticket {ticket} has been escalated to the next tier. The resolution has not changed: open the folder below.',
      'Ticket {ticket} has been escalated to the next tier, which is the same tier, staffed by the same nobody. The resolution is unchanged: open the folder below.',
      'Ticket {ticket} has been escalated to the next tier, which is the same tier, staffed by the same nobody. The resolution is unchanged: open the folder below.'
    ),
    ladder(
      '單 {ticket} 已經升級。解決方法冇變：開下面嗰個資料夾。',
      '單 {ticket} 已經升級。解決方法冇變：開下面嗰個資料夾。',
      '單 {ticket} 已經升去上一層。解決方法一樣冇變：開下面嗰個資料夾。',
      '單 {ticket} 已經升去上一層——即係同一層，一樣冇人。解決方法冇變：開下面嗰個資料夾。',
      '單 {ticket} 已經升去上一層——即係同一層，一樣冇人。解決方法冇變：開下面嗰個資料夾。'
    )
  ),
  'supportTickets.reply.resolutionIssued': entry(
    ladder(
      'Resolution for ticket {ticket}: delete the application data folder shown below. Deleting it is your own action in your own file manager.',
      'Resolution for ticket {ticket}: delete the application data folder shown below. Deleting it is your own action in your own file manager.',
      'Resolution issued for ticket {ticket}: delete the application data folder shown below. This application will open it for you; deleting it is your own action in your own file manager.',
      'After extensive investigation lasting approximately no time at all, the resolution for ticket {ticket} is: delete the application data folder shown below. This application will open it for you and then stand well back; deleting it is your own action in your own file manager.',
      'After extensive investigation lasting approximately no time at all, the resolution for ticket {ticket} is: delete the application data folder shown below. This application will open it for you and then stand well back; deleting it is your own action in your own file manager.'
    ),
    ladder(
      '單 {ticket} 嘅解決方法：刪除下面嗰個程式資料資料夾。刪除係你喺自己個檔案總管度自己做嘅動作。',
      '單 {ticket} 嘅解決方法：刪除下面嗰個程式資料資料夾。刪除係你喺自己個檔案總管度自己做嘅動作。',
      '單 {ticket} 已發出解決方案：刪除下面嗰個程式資料資料夾。程式會幫你開個資料夾，但刪除要你自己喺檔案總管度做。',
      '經過大約完全冇用時間嘅深入調查，單 {ticket} 嘅解決方法係：刪除下面嗰個程式資料資料夾。程式會幫你開個資料夾，然後行遠啲企埋一邊；刪除嗰下要你自己喺檔案總管度落手。',
      '經過大約完全冇用時間嘅深入調查，單 {ticket} 嘅解決方法係：刪除下面嗰個程式資料資料夾。程式會幫你開個資料夾，然後行遠啲企埋一邊；刪除嗰下要你自己喺檔案總管度落手。'
    )
  ),
  'supportTickets.reply.closed': entry(
    ladder(
      'Ticket {ticket} is closed. It stays in this list until you delete it, or until you delete the folder.',
      'Ticket {ticket} is closed. It stays in this list until you delete it, or until you delete the folder.',
      'Ticket {ticket} is closed. It stays in this list until you delete it here, or until you delete the folder it points at.',
      'Ticket {ticket} is closed, and the desk would like to thank you for your patience, which was never required. It stays in this list until you delete it here, or until you delete the very folder it points at — which is either a design flaw or the funniest part of this whole thing.',
      'Ticket {ticket} is closed, and the desk would like to thank you for your patience, which was never required. It stays in this list until you delete it here, or until you delete the very folder it points at — which is either a design flaw or the funniest part of this whole thing.'
    ),
    ladder(
      '單 {ticket} 已結案。佢會留喺呢個清單，直到你喺呢度刪除佢，或者你刪咗個資料夾。',
      '單 {ticket} 已結案。佢會留喺呢個清單，直到你喺呢度刪除佢，或者你刪咗個資料夾。',
      '單 {ticket} 已結案。佢會留喺呢個清單，直到你喺呢度刪除佢，或者你刪咗佢所指嗰個資料夾。',
      '單 {ticket} 已結案，客服部多謝你嘅耐心等候——雖然根本唔使等。佢會留喺呢個清單，直到你喺呢度刪咗佢，或者你刪咗佢所指嗰個資料夾——呢個設計係失誤定係全場最好笑嗰part，就睇你點睇。',
      '單 {ticket} 已結案，客服部多謝你嘅耐心等候——雖然根本唔使等。佢會留喺呢個清單，直到你喺呢度刪咗佢，或者你刪咗佢所指嗰個資料夾——呢個設計係失誤定係全場最好笑嗰part，就睇你點睇。'
    )
  ),

  /* ---------------- the resolution card ---------------- */

  'supportTickets.resolution.heading': entry(ladder('The resolution'), ladder('解決方法')),
  'supportTickets.resolution.lede': entry(
    ladder(
      'Deleting this folder clears every toy lock, and everything else this application stores locally with them.',
      'Deleting this folder clears every toy lock, and everything else this application stores locally with them.',
      'Deleting this folder clears every toy lock — and everything else this application stores locally beside them, including these tickets.',
      'Deleting this folder clears every toy lock — and everything else this application stores locally beside them, these tickets included. There is no smaller undo. There is no reset link. There is a folder.',
      'Deleting this folder clears every toy lock — and everything else this application stores locally beside them, these tickets included. There is no smaller undo. There is no reset link. There is a folder.'
    ),
    ladder(
      '刪咗呢個資料夾就會清走所有玩具鎖，同埋程式喺本機同佢哋一齊儲嘅所有嘢。',
      '刪咗呢個資料夾就會清走所有玩具鎖，同埋程式喺本機同佢哋一齊儲嘅所有嘢。',
      '刪咗呢個資料夾就會清走所有玩具鎖，連埋程式喺本機同佢哋擺埋一齊嘅所有嘢，包括呢啲單。',
      '刪咗呢個資料夾就會清走所有玩具鎖，連埋程式喺本機同佢哋擺埋一齊嘅所有嘢，包括呢啲單。冇更細粒嘅還原，冇重設連結，得一個資料夾。',
      '刪咗呢個資料夾就會清走所有玩具鎖，連埋程式喺本機同佢哋擺埋一齊嘅所有嘢，包括呢啲單。冇更細粒嘅還原，冇重設連結，得一個資料夾。'
    )
  ),
  'supportTickets.resolution.always': entry(
    ladder(
      'This is available immediately, whatever any ticket says.',
      'This is available immediately, whatever any ticket says.',
      'This is available immediately, whatever status a ticket happens to be in.',
      'This is available immediately, whatever status a ticket happens to be in. Somebody locked out is not made to wait for a joke to finish.',
      'This is available immediately, whatever status a ticket happens to be in. Somebody locked out is not made to wait for a joke to finish.'
    ),
    ladder(
      '呢個即刻用得，唔理張單寫咩。',
      '呢個即刻用得，唔理張單寫咩。',
      '呢個即刻用得，唔理張單而家喺咩狀態。',
      '呢個即刻用得，唔理張單而家喺咩狀態。人哋畀鎖咗喺出面，唔應該等你講完個笑話先救得。',
      '呢個即刻用得，唔理張單而家喺咩狀態。人哋畀鎖咗喺出面，唔應該等你講完個笑話先救得。'
    )
  ),
  'supportTickets.resolution.pathLabel': entry(
    ladder('Application data folder'),
    ladder('程式資料資料夾')
  ),
  'supportTickets.resolution.pathSupport': entry(
    ladder('Select the text to copy it by hand, or use the copy action beside it.'),
    ladder('可以自己 select 文字複製，或者撳旁邊嗰個複製掣。')
  ),
  'supportTickets.resolution.open': entry(ladder('Open that folder'), ladder('打開嗰個資料夾')),
  'supportTickets.resolution.copy': entry(ladder('Copy the path'), ladder('複製路徑')),
  'supportTickets.resolution.copied': entry(
    ladder('The path was copied to the clipboard.'),
    ladder('路徑已經複製咗去剪貼簿。')
  ),
  'supportTickets.resolution.copyFailed': entry(
    ladder('The clipboard refused the copy: {message}. The path is {path}.'),
    ladder('剪貼簿唔收：{message}。路徑係 {path}。')
  ),
  'supportTickets.resolution.opened': entry(
    ladder('The folder was opened in the file manager.'),
    ladder('已經喺檔案總管度打開咗個資料夾。')
  ),
  'supportTickets.resolution.openFailed': entry(
    ladder('The file manager could not be opened: {message}. The folder is {path}.'),
    ladder('開唔到檔案總管：{message}。個資料夾係 {path}。')
  ),
  'supportTickets.resolution.neverDeletes': entry(
    ladder(
      'This application never deletes that folder. It opens it and stops there; deleting it is your own action in your own file manager.',
      'This application never deletes that folder. It opens it and stops there; deleting it is your own action in your own file manager.',
      'This application never deletes that folder for you. It opens it and stops there — deleting it is your own action in your own file manager.',
      'This application never deletes that folder for you. It opens it, stands well back, and lets you get on with it; deleting it is your own action in your own file manager.',
      'This application never deletes that folder for you. It opens it, stands well back, and lets you get on with it; deleting it is your own action in your own file manager.'
    ),
    ladder(
      '呢個程式永遠唔會幫你刪嗰個資料夾。佢淨係幫你開，之後就唔郁；刪除係你喺自己個檔案總管度自己做。',
      '呢個程式永遠唔會幫你刪嗰個資料夾。佢淨係幫你開，之後就唔郁；刪除係你喺自己個檔案總管度自己做。',
      '呢個程式永遠唔會幫你刪嗰個資料夾。佢淨係幫你開，開完就停手——刪除要你喺自己個檔案總管度自己落手。',
      '呢個程式永遠唔會幫你刪嗰個資料夾。佢幫你開完就企遠啲，剩返嘅你自己嚟；刪除要你喺自己個檔案總管度自己落手。',
      '呢個程式永遠唔會幫你刪嗰個資料夾。佢幫你開完就企遠啲，剩返嘅你自己嚟；刪除要你喺自己個檔案總管度自己落手。'
    )
  ),

  /* ---------------- the list ---------------- */

  'supportTickets.list.heading': entry(ladder('Your tickets'), ladder('你嘅單')),
  'supportTickets.list.description': entry(
    ladder('Every ticket this application has stored on this computer.'),
    ladder('程式喺呢部電腦儲低嘅每一張單。')
  ),
  'supportTickets.list.search': entry(ladder('Search tickets'), ladder('搵單')),
  'supportTickets.list.searchPlaceholder': entry(
    ladder('Number, category, status or description…'),
    ladder('單號、類別、狀態或者內容…')
  ),
  'supportTickets.list.filterStatus': entry(ladder('Status'), ladder('狀態')),
  'supportTickets.list.filterCategory': entry(ladder('Category'), ladder('類別')),
  'supportTickets.list.filterAny': entry(ladder('Any'), ladder('全部')),
  'supportTickets.list.count': entry(
    ladder('Showing {shown} of {matched} matching, out of {total} stored.'),
    ladder('顯示緊 {matched} 個相符入面嘅 {shown} 個，總共儲咗 {total} 張。')
  ),
  'supportTickets.list.showMore': entry(ladder('Show {count} more'), ladder('再顯示 {count} 張')),
  'supportTickets.list.empty.title': entry(ladder('No tickets yet'), ladder('未有任何單')),
  'supportTickets.list.empty.body': entry(
    ladder(
      'Nothing has been raised on this computer. The resolution above works without a ticket.',
      'Nothing has been raised on this computer. The resolution above works without a ticket.',
      'Nothing has been raised on this computer. The resolution above works perfectly well without one.',
      'Nothing has been raised on this computer. The resolution above works perfectly well without a ticket, which rather undermines the whole department.',
      'Nothing has been raised on this computer. The resolution above works perfectly well without a ticket, which rather undermines the whole department.'
    ),
    ladder(
      '呢部電腦未開過單。上面嗰個解決方法唔使開單都用得。',
      '呢部電腦未開過單。上面嗰個解決方法唔使開單都用得。',
      '呢部電腦未開過單。上面嗰個解決方法唔使開單一樣完全用得。',
      '呢部電腦未開過單。上面嗰個解決方法唔使開單一樣完全用得——即係話成個部門其實幾多餘。',
      '呢部電腦未開過單。上面嗰個解決方法唔使開單一樣完全用得——即係話成個部門其實幾多餘。'
    )
  ),
  'supportTickets.list.noMatch.title': entry(ladder('Nothing matched'), ladder('搵唔到相符嘅單')),
  'supportTickets.list.noMatch.body': entry(
    ladder('{total} tickets are stored; none of them matched this search and filter.'),
    ladder('總共儲咗 {total} 張單，但係冇一張夾到而家嘅搜尋同篩選。')
  ),
  'supportTickets.list.full': entry(
    ladder('{max} tickets are stored, which is the limit. Delete one before raising another.'),
    ladder('已經儲咗 {max} 張單，去到上限。要開新單就要先刪走一張。')
  ),

  /* ---------------- one ticket ---------------- */

  'supportTickets.ticket.raised': entry(
    ladder('Raised {date}'),
    ladder('{date} 開單')
  ),
  'supportTickets.ticket.updated': entry(ladder('Updated {date}'), ladder('{date} 更新')),
  'supportTickets.ticket.responses': entry(
    ladder('{count} replies from the desk'),
    ladder('客服部覆咗 {count} 次')
  ),
  'supportTickets.ticket.chase': entry(ladder('Chase this up'), ladder('催下佢')),
  'supportTickets.ticket.chaseHint': entry(
    ladder('Advances the status by one step and adds the next canned reply.'),
    ladder('將狀態推前一步，再加多句罐頭回覆。')
  ),
  'supportTickets.ticket.alreadyClosed': entry(
    ladder('This ticket is already closed.'),
    ladder('呢張單已經結咗案。')
  ),
  'supportTickets.ticket.close': entry(ladder('Close the ticket'), ladder('結案')),
  'supportTickets.ticket.reopen': entry(ladder('Reopen the ticket'), ladder('重開張單')),
  'supportTickets.ticket.delete': entry(ladder('Delete the ticket'), ladder('刪除張單')),
  'supportTickets.ticket.severityLabel': entry(
    ladder('Severity for {ticket}'),
    ladder('{ticket} 嘅緊急程度')
  ),
  'supportTickets.ticket.select': entry(
    ladder('Select ticket {ticket}'),
    ladder('揀單 {ticket}')
  ),
  'supportTickets.ticket.expand': entry(
    ladder('Show the correspondence for {ticket}'),
    ladder('顯示 {ticket} 嘅往來記錄')
  ),
  'supportTickets.ticket.collapse': entry(
    ladder('Hide the correspondence for {ticket}'),
    ladder('收埋 {ticket} 嘅往來記錄')
  ),

  /* ---------------- bulk actions ---------------- */

  'supportTickets.bulk.heading': entry(ladder('Selection'), ladder('已揀嘅單')),
  'supportTickets.bulk.selectShown': entry(
    ladder('Select the {count} shown'),
    ladder('揀晒顯示緊嗰 {count} 張')
  ),
  'supportTickets.bulk.selectMatched': entry(
    ladder('Select all {count} matching, including the {hidden} not shown'),
    ladder('揀晒 {count} 張相符嘅，連埋未顯示嗰 {hidden} 張')
  ),
  'supportTickets.bulk.selectEvery': entry(
    ladder('Select every one of the {count} stored tickets'),
    ladder('揀晒全部 {count} 張已儲存嘅單')
  ),
  'supportTickets.bulk.invert': entry(
    ladder('Invert the selection within the {count} matching'),
    ladder('喺 {count} 張相符嘅單入面反轉揀嘅嘢')
  ),
  'supportTickets.bulk.clear': entry(ladder('Clear the selection'), ladder('清走揀咗嘅嘢')),
  'supportTickets.bulk.selected': entry(ladder('{count} selected'), ladder('揀咗 {count} 張')),
  'supportTickets.bulk.none': entry(
    ladder('Nothing is selected, so nothing would change.'),
    ladder('乜都冇揀，所以乜都唔會變。')
  ),
  'supportTickets.bulk.advance': entry(ladder('Advance the status'), ladder('推前狀態')),
  'supportTickets.bulk.close': entry(ladder('Close'), ladder('結案')),
  'supportTickets.bulk.reopen': entry(ladder('Reopen'), ladder('重開')),
  'supportTickets.bulk.severity': entry(ladder('Set the severity'), ladder('設定緊急程度')),
  'supportTickets.bulk.export': entry(ladder('Export the selection'), ladder('匯出揀咗嘅單')),
  'supportTickets.bulk.copy': entry(ladder('Copy the selection'), ladder('複製揀咗嘅單')),
  'supportTickets.bulk.delete': entry(ladder('Delete the selection'), ladder('刪除揀咗嘅單')),
  'supportTickets.bulk.preview.title': entry(
    ladder('Review before it happens'),
    ladder('做之前睇清楚')
  ),
  'supportTickets.bulk.preview.willChange': entry(
    ladder('{willChange} of the {selected} selected will change. {skipped} will be skipped.'),
    ladder('揀咗 {selected} 張，其中 {willChange} 張會改變，{skipped} 張會跳過。')
  ),
  'supportTickets.bulk.preview.skippedReason': entry(
    ladder('Skipped, because: {reason}'),
    ladder('跳過咗，原因：{reason}')
  ),
  'supportTickets.bulk.preview.apply': entry(ladder('Apply'), ladder('做落去')),
  'supportTickets.bulk.preview.cancel': entry(ladder('Cancel'), ladder('唔做')),
  'supportTickets.bulk.skip.closed': entry(
    ladder('it is already closed'),
    ladder('佢已經結咗案')
  ),
  'supportTickets.bulk.skip.notClosed': entry(
    ladder('it is not closed'),
    ladder('佢未結案')
  ),
  'supportTickets.bulk.skip.sameSeverity': entry(
    ladder('it already has that severity'),
    ladder('佢已經係嗰個緊急程度')
  ),
  'supportTickets.bulk.done': entry(
    ladder('{count} tickets changed. {skipped} were skipped.'),
    ladder('{count} 張單改咗，{skipped} 張跳過咗。')
  ),

  /* ---------------- export ---------------- */

  'supportTickets.export.heading': entry(ladder('Export'), ladder('匯出')),
  'supportTickets.export.format': entry(ladder('File format'), ladder('檔案格式')),
  'supportTickets.export.scope': entry(ladder('What to export'), ladder('匯出咩')),
  'supportTickets.export.scope.selection': entry(
    ladder('The current selection'),
    ladder('而家揀咗嘅單')
  ),
  'supportTickets.export.scope.matching': entry(
    ladder('Everything matching the search and filter'),
    ladder('所有夾到搜尋同篩選嘅單')
  ),
  'supportTickets.export.scope.all': entry(ladder('Every stored ticket'), ladder('全部已儲存嘅單')),
  'supportTickets.export.save': entry(ladder('Save the file'), ladder('儲存檔案')),
  'supportTickets.export.copy': entry(ladder('Copy to the clipboard'), ladder('複製去剪貼簿')),
  'supportTickets.export.saved': entry(ladder('Written to {path}.'), ladder('已經寫咗去 {path}。')),
  'supportTickets.export.cancelled': entry(
    ladder('No destination was chosen, so nothing was written.'),
    ladder('冇揀目的地，所以乜都冇寫。')
  ),
  'supportTickets.export.failed': entry(
    ladder('The export failed: {message}'),
    ladder('匯出失敗：{message}')
  ),
  'supportTickets.export.losses': entry(
    ladder('{format} cannot carry these faithfully: {fields}'),
    ladder('{format} 承載唔到呢啲：{fields}')
  ),
  'supportTickets.export.noLosses': entry(
    ladder('{format} carries every field of every selected ticket.'),
    ladder('{format} 承載得晒每張揀咗嘅單嘅每個欄位。')
  ),
  'supportTickets.export.nothing': entry(
    ladder('There is nothing in that scope to export.'),
    ladder('嗰個範圍入面冇嘢可以匯出。')
  ),
  'supportTickets.export.openInEditor': entry(
    ladder('Open the exported file in the editor'),
    ladder('用編輯器開匯出咗嘅檔案')
  ),

  /* ---------------- settings ---------------- */

  'supportTickets.settings.section': entry(ladder('Support Tickets'), ladder('客戶服務單')),
  'supportTickets.settings.defaultSeverity': entry(
    ladder('Severity a new ticket starts at'),
    ladder('新開單嘅預設緊急程度')
  ),
  'supportTickets.settings.defaultSeverity.description': entry(
    ladder(
      'Preselects one severity in the form. Every severity behaves identically, so this changes the wording of a new ticket and nothing else.'
    ),
    ladder('喺表格度預先揀好一個緊急程度。所有級別行為完全一樣，所以呢個只係改咗新單嘅字眼，其他乜都冇變。')
  ),
  'supportTickets.settings.pageSize': entry(
    ladder('Tickets rendered at a time'),
    ladder('一次過顯示幾多張單')
  ),
  'supportTickets.settings.pageSize.description': entry(
    ladder(
      'The list builds this many rows, then offers a "show more" action. Long lists stay responsive because the rows past this point are never constructed.'
    ),
    ladder('清單一次過起呢個數量嘅行，之後畀你撳「再顯示」。超過呢個數嘅行根本唔會建立，所以幾長嘅清單都仲順暢。')
  ),
  'supportTickets.settings.adopt': entry(
    ladder('Use the full desk from the unlock prompt'),
    ladder('由解鎖提示直接開完整客服部')
  ),
  'supportTickets.settings.adopt.description': entry(
    ladder(
      'When on, the "Forgotten your password?" link in an unlock prompt opens this full Support Tickets desk. When off, that link keeps the short built-in recovery note, which shows the same folder path and the same open action.'
    ),
    ladder(
      '開咗嘅話，解鎖提示入面嗰個「唔記得密碼？」會直接開呢個完整嘅客服部。閂咗嘅話，就用返內置嗰段短短嘅復原說明——一樣有同一個資料夾路徑同一個開啟掣。'
    )
  ),
  'supportTickets.settings.openDesk': entry(
    ladder('Open Support Tickets'),
    ladder('打開客戶服務單')
  ),
  'supportTickets.settings.openDesk.description': entry(
    ladder('Opens the Support Tickets destination, where a ticket can be raised and the folder opened.'),
    ladder('打開「客戶服務單」呢個頁面，可以喺嗰度開單同埋開資料夾。')
  ),
  'supportTickets.settings.folder': entry(
    ladder('The folder a locked-out user deletes'),
    ladder('畀鎖死咗嘅用戶要刪嘅資料夾')
  ),
  'supportTickets.settings.folder.description': entry(
    ladder(
      'The exact application data directory. Deleting it clears every toy lock and every other local record this application keeps, these tickets included. This application never deletes it for you.'
    ),
    ladder(
      '就係呢個程式資料目錄。刪咗佢就會清走所有玩具鎖，同埋程式喺本機保存嘅所有其他記錄，包括呢啲單。程式永遠唔會幫你刪。'
    )
  ),
  'supportTickets.settings.prune': entry(
    ladder('Delete tickets older than a date'),
    ladder('刪除某個日期之前嘅單')
  ),
  'supportTickets.settings.prune.description': entry(
    ladder(
      'Removes stored tickets raised before the date you choose. It shows exactly which ones first, and goes through the destructive-action gate. Nothing happens automatically and nothing is removed on a schedule.'
    ),
    ladder(
      '刪走喺你揀嘅日期之前開嘅單。做之前會列清楚係邊幾張，而且要行完個破壞性動作關卡。唔會自動發生，亦都唔會定時刪嘢。'
    )
  ),
  'supportTickets.settings.prune.pick': entry(
    ladder('Raised before'),
    ladder('開單日期早過')
  ),
  'supportTickets.settings.prune.none': entry(
    ladder('No stored ticket was raised before {date}.'),
    ladder('冇任何已儲存嘅單係喺 {date} 之前開嘅。')
  ),
  'supportTickets.settings.prune.count': entry(
    ladder('{count} tickets were raised before {date}.'),
    ladder('有 {count} 張單係喺 {date} 之前開嘅。')
  ),

  /* ---------------- palette ---------------- */

  'supportTickets.palette.open': entry(
    ladder('Support Tickets'),
    ladder('客戶服務單')
  ),
  'supportTickets.palette.openSubtitle': entry(
    ladder('The local support desk, and the folder that actually resolves a lockout'),
    ladder('本機客服部，同埋真正解決鎖死問題嗰個資料夾')
  ),
  'supportTickets.palette.newTicket': entry(ladder('Raise a support ticket'), ladder('開一張客服單')),
  'supportTickets.palette.openFolder': entry(
    ladder('Open the application data folder'),
    ladder('打開程式資料資料夾')
  ),
  'supportTickets.palette.copyFolder': entry(
    ladder('Copy the application data folder path'),
    ladder('複製程式資料資料夾路徑')
  ),

  /* ---------------- notifications and confirmations ---------------- */

  'supportTickets.notify.created': entry(
    ladder('Ticket {ticket} raised'),
    ladder('已開單 {ticket}')
  ),
  'supportTickets.notify.advanced': entry(
    ladder('Ticket {ticket} is now {status}'),
    ladder('單 {ticket} 而家係「{status}」')
  ),
  'supportTickets.notify.deleted': entry(
    ladder('{count} tickets deleted from this computer'),
    ladder('喺呢部電腦刪咗 {count} 張單')
  ),
  'supportTickets.confirm.deleteAction': entry(
    ladder('Delete {count} support tickets'),
    ladder('刪除 {count} 張客服單')
  ),
  'supportTickets.confirm.deleteIrreversible': entry(
    ladder(
      'These ticket records are removed from this application permanently. There is no undo for them, and no copy anywhere else, because they were never sent anywhere.'
    ),
    ladder('呢啲單嘅記錄會喺程式度永久移除。冇得還原，其他地方亦都冇副本，因為佢哋由頭到尾都冇寄去任何地方。')
  ),

  /* ---------------- help ---------------- */

  'supportTickets.help.link': entry(
    ladder('Forgotten your password? Open Support Tickets'),
    ladder('唔記得密碼？打開客戶服務單')
  ),
  'supportTickets.help.article': entry(
    ladder('Read the Support Tickets article'),
    ladder('睇客戶服務單嘅說明文章')
  )
};
