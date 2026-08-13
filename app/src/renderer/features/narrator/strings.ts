import type { Catalogue, FunnyLadder, TranslationEntry } from '../../core/registry';

/**
 * Every piece of copy this feature renders or speaks.
 *
 * The humour ladders style the VOICE. They never move a fact: which voice will
 * speak, whether it is installed, whether it needs the network, what the
 * cooldown is, and what a destructive action will remove all read identically
 * at level 1 and level 5. That is the whole rule, and it matters more here than
 * almost anywhere else in the application, because half of this copy is read
 * out loud to somebody who cannot see the screen it came from.
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

export const NARRATOR_STRINGS: Catalogue = {
  /* ---------------- destinations and headings ---------------- */

  'narrator.tab.title': entry(ladder('Narrator'), ladder('旁白')),
  'narrator.tab.subtitle': entry(
    ladder(
      'Speaks what the application is doing. Switched off until you switch it on.',
      'Speaks what the application is doing. Switched off until you switch it on.',
      'Reads out what the application is up to. It stays quiet until you say otherwise.',
      'Reads the application out loud. It says nothing at all until you let it.',
      'Reads the application out loud. It says nothing at all until you let it.'
    ),
    ladder(
      '將程式做緊乜讀出嚟。你未開之前佢唔會出聲。',
      '將程式做緊乜讀出嚟。你未開之前佢唔會出聲。',
      '同你讀出程式做緊咩。你唔開佢就乖乖收聲。',
      '同你讀出程式做緊咩。冇你俾聲就一個字都唔講。',
      '同你讀出程式做緊咩。冇你俾聲就一個字都唔講。'
    )
  ),
  'narrator.section': entry(ladder('Narrator'), ladder('旁白')),
  'narrator.section.voices': entry(ladder('Voices'), ladder('聲音')),
  'narrator.section.categories': entry(ladder('What gets spoken'), ladder('會讀啲乜')),
  'narrator.section.restraint': entry(ladder('How often it speaks'), ladder('幾密先出聲')),
  'narrator.section.log': entry(ladder('What it has said'), ladder('講過啲乜')),

  /* ---------------- the master controls ---------------- */

  'narrator.enabled': entry(ladder('Speak application events aloud'), ladder('讀出程式事件')),
  'narrator.enabled.description': entry(
    ladder(
      'Turns spoken narration on. It is off in a new installation and nothing is spoken until you turn it on here. Narration is deliberately infrequent: a burst of similar events collapses into one line, each kind of event has its own minimum gap, and only one line is ever spoken at a time.',
      'Turns spoken narration on. It is off in a new installation and nothing is spoken until you turn it on here. Narration is deliberately infrequent: a burst of similar events collapses into one line, each kind of event has its own minimum gap, and only one line is ever spoken at a time.',
      'Turns the talking on. A new installation is silent, and stays silent until this switch moves. It is built to be sparing: a flurry of similar events becomes one line, every kind of event has its own minimum gap, and it never talks over itself.',
      'Gives the application a mouth. A fresh installation has none, and it keeps none until you flip this. It is a restrained mouth: a flurry of similar events becomes one line, every kind has its own minimum gap, and it never talks over itself.',
      'Gives the application a mouth. A fresh installation has none, and it keeps none until you flip this. It is a restrained mouth: a flurry of similar events becomes one line, every kind has its own minimum gap, and it never talks over itself.'
    ),
    ladder(
      '開咗就會用聲讀出嚟。新裝嘅時候係熄嘅，你唔喺呢度開就一句都唔會講。設計上會刻意講少啲：連環發生嘅同類事件會併埋一句，每類事件有自己嘅最短間隔，而且同一時間淨係讀一句。',
      '開咗就會用聲讀出嚟。新裝嘅時候係熄嘅，你唔喺呢度開就一句都唔會講。設計上會刻意講少啲：連環發生嘅同類事件會併埋一句，每類事件有自己嘅最短間隔，而且同一時間淨係讀一句。',
      '撳開佢就會出聲。啱啱裝好嗰陣係啞嘅，你唔開佢就繼續啞。佢好識做：同類事件一次過講一句，每類都有自己嘅冷卻時間，唔會自己嗌自己。',
      '呢個掣一開，程式就有把口。啱裝嗰時佢係冇口嘅，你唔俾佢都唔會有。放心，佢好收斂：同類嘢併埋一句講，每類有冷卻時間，唔會自己同自己爭住講。',
      '呢個掣一開，程式就有把口。啱裝嗰時佢係冇口嘅，你唔俾佢都唔會有。放心，佢好收斂：同類嘢併埋一句講，每類有冷卻時間，唔會自己同自己爭住講。'
    )
  ),

  'narrator.mode': entry(ladder('Narrated language'), ladder('讀邊種語言')),
  'narrator.mode.description': entry(
    ladder(
      'Chooses which track speaks. "Both" speaks the English line first and the Cantonese line after it, strictly one at a time — the two are never mixed into one utterance and never overlap. Each track keeps its own voice, rate and pitch.',
      'Chooses which track speaks. "Both" speaks the English line first and the Cantonese line after it, strictly one at a time — the two are never mixed into one utterance and never overlap. Each track keeps its own voice, rate and pitch.',
      'Picks which track talks. "Both" reads the English line, waits for it to finish, then reads the Cantonese one. They never speak over each other, and each keeps its own voice, speed and pitch.',
      'Picks who does the talking. "Both" means English first, Cantonese after — one at a time, politely, never both shouting at once. Each track keeps its own voice, speed and pitch.',
      'Picks who does the talking. "Both" means English first, Cantonese after — one at a time, politely, never both shouting at once. Each track keeps its own voice, speed and pitch.'
    ),
    ladder(
      '揀邊條聲道出聲。「兩樣都要」會先讀英文，讀完先讀廣東話，嚴格一句接一句 —— 兩邊唔會撈埋一齊，亦唔會撞聲。每條聲道有自己嘅聲音、語速同音調。',
      '揀邊條聲道出聲。「兩樣都要」會先讀英文，讀完先讀廣東話，嚴格一句接一句 —— 兩邊唔會撈埋一齊，亦唔會撞聲。每條聲道有自己嘅聲音、語速同音調。',
      '揀邊個講嘢。「兩樣都要」即係英文行先，講完到廣東話。兩把聲唔會撞埋，各自有自己嘅聲音、速度同音調。',
      '揀邊個開口。「兩樣都要」就英文先講，廣東話跟尾，一句一句嚟，唔會兩個一齊嗌。每邊各有各嘅聲、速度同音調。',
      '揀邊個開口。「兩樣都要」就英文先講，廣東話跟尾，一句一句嚟，唔會兩個一齊嗌。每邊各有各嘅聲、速度同音調。'
    )
  ),
  'narrator.mode.en': entry(ladder('English'), ladder('英文')),
  'narrator.mode.yue': entry(ladder('Cantonese'), ladder('廣東話')),
  'narrator.mode.both': entry(ladder('Both, English first'), ladder('兩樣都要，英文行先')),

  /* ---------------- voices ---------------- */

  'narrator.voice.en': entry(ladder('English voice'), ladder('英文聲音')),
  'narrator.voice.yue': entry(ladder('Cantonese voice'), ladder('廣東話聲音')),
  'narrator.voice.description': entry(
    ladder(
      'Chooses which installed voice reads this track. The list is the voices this computer actually has for the language, read from the platform at runtime. "Choose automatically" is the shipped default: no named voice ships as a default, because the application cannot know what is installed until it asks. The choice is stored as the platform voice identity rather than the display name, so it survives a language change and does not match the wrong voice on another machine.',
      'Chooses which installed voice reads this track. The list is the voices this computer actually has for the language, read from the platform at runtime. "Choose automatically" is the shipped default: no named voice ships as a default, because the application cannot know what is installed until it asks. The choice is stored as the platform voice identity rather than the display name, so it survives a language change and does not match the wrong voice on another machine.',
      'Picks which installed voice reads this track. The list is what this computer genuinely has, asked for at runtime rather than guessed. "Choose automatically" is the default, because shipping a named voice would be a preference for one that most machines do not have. What gets stored is the platform identity, never the display name — names are not unique and platforms translate them.',
      'Picks the voice for this track. The list is whatever this computer really has, asked for rather than assumed. The default is "choose automatically", because naming a favourite voice out of the box would be picking one most machines have never heard of. It stores the platform identity, not the pretty name — names are neither unique nor stable.',
      'Picks the voice for this track. The list is whatever this computer really has, asked for rather than assumed. The default is "choose automatically", because naming a favourite voice out of the box would be picking one most machines have never heard of. It stores the platform identity, not the pretty name — names are neither unique nor stable.'
    ),
    ladder(
      '揀邊把已安裝嘅聲讀呢條聲道。表入面係呢部電腦真係有、又識讀呢種語言嘅聲，係即時問系統攞返嚟。預設係「自動揀」：出廠唔會指定邊把聲，因為程式未問過就唔會知你裝咗啲乜。儲存嘅係系統嘅聲音識別碼，唔係顯示名，所以轉語言都唔會走樣，換部機都唔會揀錯人。',
      '揀邊把已安裝嘅聲讀呢條聲道。表入面係呢部電腦真係有、又識讀呢種語言嘅聲，係即時問系統攞返嚟。預設係「自動揀」：出廠唔會指定邊把聲，因為程式未問過就唔會知你裝咗啲乜。儲存嘅係系統嘅聲音識別碼，唔係顯示名，所以轉語言都唔會走樣，換部機都唔會揀錯人。',
      '揀邊把聲讀呢條聲道。表入面全部係你部機真係有嘅，即時問返嚟，唔係靠估。預設「自動揀」，因為出廠指定一把聲，多數機都根本冇裝過。儲低嘅係系統識別碼，唔係個名 —— 個名唔獨一無二，仲會俾系統翻譯。',
      '揀把聲嚟讀呢邊。表度嘅係你部機真係有嘅聲，問返嚟嘅，唔係靠估。預設「自動揀」，因為出廠幫你揀一把，多數人部機根本冇。佢記住嘅係系統識別碼，唔係個靚名 —— 個名唔穩陣，仲會俾人翻譯。',
      '揀把聲嚟讀呢邊。表度嘅係你部機真係有嘅聲，問返嚟嘅，唔係靠估。預設「自動揀」，因為出廠幫你揀一把，多數人部機根本冇。佢記住嘅係系統識別碼，唔係個靚名 —— 個名唔穩陣，仲會俾人翻譯。'
    )
  ),
  'narrator.voice.automatic': entry(ladder('Choose automatically'), ladder('自動揀')),
  'narrator.voice.count': entry(
    ladder('{count} voices on this computer can read {language}.'),
    ladder('呢部電腦有 {count} 把聲識讀{language}。')
  ),

  'narrator.voice.pending': entry(
    ladder('Reading the installed voices from the platform. The list often arrives a moment after the window opens.'),
    ladder('緊喺度問系統攞已安裝嘅聲。呢張表通常喺個窗開咗之後先至返到嚟。')
  ),
  'narrator.voice.unsupported': entry(
    ladder('This build has no speech synthesis, so nothing can be spoken. Every control below is disabled and none of your choices were changed.'),
    ladder('呢個版本冇語音合成，所以乜都讀唔到。下面啲控制項全部停用，你揀過嘅嘢一樣都冇改。')
  ),
  'narrator.voice.emptyList': entry(
    ladder('The platform answered, and this computer has no speech voices installed at all. Installing one in the operating system speech settings is what fixes it.'),
    ladder('系統答咗，但呢部電腦一把語音都冇裝。去作業系統嘅語音設定裝一把，就搞掂。')
  ),

  'narrator.voiceStatus.chosen': entry(
    ladder('{name} will speak. {origin}'),
    ladder('會由 {name} 讀。{origin}')
  ),
  'narrator.voiceStatus.automatic': entry(
    ladder('No voice chosen, so {name} speaks — the first one this computer offers for {language}. {origin}'),
    ladder('你未揀聲，所以由 {name} 讀 —— 佢係呢部電腦畀嘅{language}第一把聲。{origin}')
  ),
  'narrator.voiceStatus.missingFallback': entry(
    ladder(
      'The voice you chose is NOT installed on this computer. Your choice is kept exactly as it is; until that voice is installed, {name} speaks instead. {origin}'
    ),
    ladder('你揀嗰把聲喺呢部電腦度冇裝。你嘅選擇原封不動咁留住；喺佢裝返之前，改由 {name} 讀。{origin}')
  ),
  'narrator.voiceStatus.missingSilent': entry(
    ladder(
      'The voice you chose is NOT installed on this computer, and nothing else here can read {language}. Your choice is kept; this track stays silent until a voice for it exists.'
    ),
    ladder('你揀嗰把聲喺呢部電腦度冇裝，而且冇其他聲識讀{language}。你嘅選擇會留住；喺有得揀之前，呢條聲道唔會出聲。')
  ),
  'narrator.voiceStatus.none': entry(
    ladder(
      'No voice on this computer can read {language} at all, so this track stays silent. Installing one in the operating system speech settings is what fixes it.'
    ),
    ladder('呢部電腦冇任何一把聲識讀{language}，所以呢條聲道唔會出聲。去作業系統嘅語音設定裝一把就得。')
  ),
  'narrator.voiceStatus.originLocal': entry(
    ladder('It runs on this computer and keeps working offline.'),
    ladder('佢喺你部電腦度行，冇網都照讀。')
  ),
  'narrator.voiceStatus.originNetwork': entry(
    ladder('It is produced over the network and goes quiet whenever this computer is offline.'),
    ladder('佢要經網絡先出到聲，一冇網就會靜晒。')
  ),
  'narrator.voiceStatus.offlineNow': entry(
    ladder('This computer is offline right now, so this voice will produce no sound until it reconnects.'),
    ladder('呢部電腦而家冇網，所以呢把聲要等駁返先出到聲。')
  ),

  'narrator.rate': entry(ladder('Speaking rate'), ladder('語速')),
  'narrator.rate.description': entry(
    ladder(
      'How fast this track speaks. The platform documents 0.1 to 10 and 1 is the voice\'s own normal delivery, which is what ships. Many voices ignore the extremes and simply speak at their fastest or slowest.',
      'How fast this track speaks. The platform documents 0.1 to 10 and 1 is the voice\'s own normal delivery, which is what ships. Many voices ignore the extremes and simply speak at their fastest or slowest.',
      'How fast this track talks. The platform allows 0.1 to 10, and 1 is the voice speaking the way its author intended, which is where this starts. Plenty of voices ignore the far ends and just go as fast or slow as they can.',
      'How fast this track rattles on. The platform allows 0.1 to 10; 1 is the voice being itself, which is where it starts. Most voices treat the extremes as a suggestion and go as fast or slow as they can manage.',
      'How fast this track rattles on. The platform allows 0.1 to 10; 1 is the voice being itself, which is where it starts. Most voices treat the extremes as a suggestion and go as fast or slow as they can manage.'
    ),
    ladder(
      '呢條聲道讀得幾快。系統寫明係 0.1 至 10，而 1 就係把聲本身正常嘅講法，出廠亦係 1。好多把聲根本唔理極端值，淨係用佢最快或者最慢嗰個速度。',
      '呢條聲道讀得幾快。系統寫明係 0.1 至 10，而 1 就係把聲本身正常嘅講法，出廠亦係 1。好多把聲根本唔理極端值，淨係用佢最快或者最慢嗰個速度。',
      '呢邊講得幾快。系統容許 0.1 到 10，1 就係把聲原本嘅講法，亦係起步點。好多聲都唔會理你兩端嘅極限，佢最快得咁快就咁快。',
      '呢邊噏得幾快。系統容許 0.1 到 10，1 即係把聲做返自己，亦係起步嗰度。多數聲當兩端係參考啫，佢盡到幾多就幾多。',
      '呢邊噏得幾快。系統容許 0.1 到 10，1 即係把聲做返自己，亦係起步嗰度。多數聲當兩端係參考啫，佢盡到幾多就幾多。'
    )
  ),
  'narrator.pitch': entry(ladder('Pitch'), ladder('音調')),
  'narrator.pitch.description': entry(
    ladder(
      'How high this track speaks. The platform documents 0 to 2 and 1 is the voice\'s own normal pitch, which is what ships. Some voices do not support pitch at all and will ignore this.',
      'How high this track speaks. The platform documents 0 to 2 and 1 is the voice\'s own normal pitch, which is what ships. Some voices do not support pitch at all and will ignore this.',
      'How high this track sits. The platform allows 0 to 2, and 1 is the voice at its natural pitch, which is where it starts. Some voices cannot change pitch and will quietly ignore this.',
      'How high or low the voice sits. Range 0 to 2; 1 is its natural pitch and where it starts. Some voices cannot be moved at all and will simply pretend they did not hear you.',
      'How high or low the voice sits. Range 0 to 2; 1 is its natural pitch and where it starts. Some voices cannot be moved at all and will simply pretend they did not hear you.'
    ),
    ladder(
      '呢條聲道讀得幾高音。系統寫明係 0 至 2，而 1 係把聲本身嘅正常音調，出廠亦係 1。有啲聲根本唔支援調音調，會直接忽略呢個設定。',
      '呢條聲道讀得幾高音。系統寫明係 0 至 2，而 1 係把聲本身嘅正常音調，出廠亦係 1。有啲聲根本唔支援調音調，會直接忽略呢個設定。',
      '呢邊把聲有幾高。系統容許 0 到 2，1 就係佢原本嘅音調，亦係起步位。有啲聲改唔到音調，會靜靜哋當睇唔到。',
      '把聲高定低。範圍 0 到 2，1 就係佢本來個樣，亦係起步位。有啲聲根本郁唔到，會扮聽唔到你。',
      '把聲高定低。範圍 0 到 2，1 就係佢本來個樣，亦係起步位。有啲聲根本郁唔到，會扮聽唔到你。'
    )
  ),
  'narrator.volume': entry(ladder('Volume'), ladder('音量')),
  'narrator.volume.description': entry(
    ladder(
      'The narrator\'s own volume, from 0 to 1, applied on top of the system volume. It is one setting for both tracks so a bilingual line does not change loudness halfway through.',
      'The narrator\'s own volume, from 0 to 1, applied on top of the system volume. It is one setting for both tracks so a bilingual line does not change loudness halfway through.',
      'How loud the narrator is, 0 to 1, on top of the system volume. One setting covers both tracks, so a bilingual line does not get louder halfway through.',
      'How loud this thing is, 0 to 1, riding on top of the system volume. One setting for both tracks, so a bilingual line does not suddenly shout at you in the second half.',
      'How loud this thing is, 0 to 1, riding on top of the system volume. One setting for both tracks, so a bilingual line does not suddenly shout at you in the second half.'
    ),
    ladder(
      '旁白自己嘅音量，0 至 1，係疊喺系統音量之上。兩條聲道共用一個設定，所以雙語嗰句唔會讀讀吓突然大聲咗。',
      '旁白自己嘅音量，0 至 1，係疊喺系統音量之上。兩條聲道共用一個設定，所以雙語嗰句唔會讀讀吓突然大聲咗。',
      '旁白幾大聲，0 到 1，加喺系統音量上面。兩邊共用一個掣，雙語嗰句唔會讀到一半突然嘈起上嚟。',
      '佢有幾嘈，0 到 1，疊喺系統音量上面。兩邊共用一個掣，雙語嗰句唔會讀到半路突然大嗌。',
      '佢有幾嘈，0 到 1，疊喺系統音量上面。兩邊共用一個掣，雙語嗰句唔會讀到半路突然大嗌。'
    )
  ),

  /* ---------------- restraint ---------------- */

  'narrator.debounce': entry(ladder('Wait before speaking (milliseconds)'), ladder('出聲前等幾耐（毫秒）')),
  'narrator.debounce.description': entry(
    ladder(
      'How long a line waits before it is spoken. Anything of the same kind arriving inside that window REPLACES it rather than queueing behind it, so a burst of similar events becomes the one line that was current when the burst stopped. Errors ignore this entirely.',
      'How long a line waits before it is spoken. Anything of the same kind arriving inside that window REPLACES it rather than queueing behind it, so a burst of similar events becomes the one line that was current when the burst stopped. Errors ignore this entirely.',
      'How long a line sits before it is read. Anything of the same kind arriving in that window REPLACES it instead of piling up behind it, so a flurry of similar events turns into whichever line was last. Errors ignore this completely.',
      'How long a line waits its turn. Same-kind lines arriving in that window shove the old one aside rather than forming an orderly queue, so a flurry becomes one final line. Errors barge straight past all of it.',
      'How long a line waits its turn. Same-kind lines arriving in that window shove the old one aside rather than forming an orderly queue, so a flurry becomes one final line. Errors barge straight past all of it.'
    ),
    ladder(
      '一句嘢等幾耐先讀出嚟。喺呢段時間入面嚟嘅同類訊息會「換走」佢，而唔係排喺後面，所以一連串同類事件最後只會變成最新嗰一句。錯誤完全唔理呢個設定。',
      '一句嘢等幾耐先讀出嚟。喺呢段時間入面嚟嘅同類訊息會「換走」佢，而唔係排喺後面，所以一連串同類事件最後只會變成最新嗰一句。錯誤完全唔理呢個設定。',
      '一句嘢等幾耐先出聲。呢段時間入面嚟嘅同類嘢會直接換走佢，唔會喺後面排隊，所以連環嘅同類事件最後淨返最新嗰句。錯誤直接無視。',
      '一句嘢排幾耐隊。同類嘅新嘢一到就即刻頂走舊嗰句，唔會乖乖排隊，所以一大堆最後只剩最新一句。錯誤？佢直接打尖。',
      '一句嘢排幾耐隊。同類嘅新嘢一到就即刻頂走舊嗰句，唔會乖乖排隊，所以一大堆最後只剩最新一句。錯誤？佢直接打尖。'
    )
  ),
  'narrator.cooldown': entry(ladder('Minimum gap (milliseconds)'), ladder('最短間隔（毫秒）')),
  'narrator.cooldown.description': entry(
    ladder(
      'The shortest time between two spoken lines of this category. A line that arrives inside the gap is not spoken, and the reason is recorded in the log below so a missing line is explainable rather than mysterious.',
      'The shortest time between two spoken lines of this category. A line that arrives inside the gap is not spoken, and the reason is recorded in the log below so a missing line is explainable rather than mysterious.',
      'The shortest gap between two spoken lines of this kind. A line arriving inside the gap is not read, and the log below records exactly why, so a line you expected and did not hear is explainable.',
      'The shortest gap between two lines of this kind. Anything landing inside the gap does not get read, and the log says exactly why, so a line you never heard is never a mystery.',
      'The shortest gap between two lines of this kind. Anything landing inside the gap does not get read, and the log says exactly why, so a line you never heard is never a mystery.'
    ),
    ladder(
      '同一類嘢兩句之間最少要隔幾耐。喺呢段時間入面嚟嗰句唔會讀，原因會寫喺下面嘅紀錄度，所以少咗一句係查得到，唔係無啦啦冇咗。',
      '同一類嘢兩句之間最少要隔幾耐。喺呢段時間入面嚟嗰句唔會讀，原因會寫喺下面嘅紀錄度，所以少咗一句係查得到，唔係無啦啦冇咗。',
      '同類嘢兩句之間最少隔幾耐。喺呢段時間入面到嗰句就唔讀，下面本紀錄會寫清楚點解，所以你等唔到嗰句唔會變咗個謎。',
      '同類嘢兩句之間最少隔幾耐。喺呢段時間入面到嗰句唔讀，紀錄度寫到明明白白，所以你聽唔到嗰句，唔會變成靈異事件。',
      '同類嘢兩句之間最少隔幾耐。喺呢段時間入面到嗰句唔讀，紀錄度寫到明明白白，所以你聽唔到嗰句，唔會變成靈異事件。'
    )
  ),
  'narrator.category.enabled': entry(ladder('Spoken'), ladder('會讀')),

  // One label per category, because eight rows all reading "Minimum gap" would
  // be eight rows nobody can tell apart in a settings search result.
  'narrator.cooldown.error': entry(ladder('Minimum gap: failures'), ladder('最短間隔：出事')),
  'narrator.cooldown.warning': entry(ladder('Minimum gap: warnings'), ladder('最短間隔：警告')),
  'narrator.cooldown.success': entry(ladder('Minimum gap: completions'), ladder('最短間隔：搞掂')),
  'narrator.cooldown.notice': entry(ladder('Minimum gap: notices'), ladder('最短間隔：提示')),
  'narrator.cooldown.progress': entry(ladder('Minimum gap: progress'), ladder('最短間隔：進度')),
  'narrator.cooldown.lifecycle': entry(ladder('Minimum gap: application events'), ladder('最短間隔：程式大事')),
  'narrator.cooldown.navigation': entry(ladder('Minimum gap: navigation'), ladder('最短間隔：去咗邊')),
  'narrator.cooldown.settings': entry(ladder('Minimum gap: settings changes'), ladder('最短間隔：設定改動')),

  'narrator.screenReader': entry(ladder('When a screen reader is running'), ladder('有螢幕閱讀器行緊嗰陣')),
  'narrator.screenReader.description': entry(
    ladder(
      'A window is given no way to ask whether a screen reader is running, so this application does not claim to detect one. On the automatic setting the narrator instead ducks around the application\'s OWN announcements — the moments a screen reader would be speaking — by waiting and lowering its volume. The other settings let you say plainly what is true on this computer.',
      'A window is given no way to ask whether a screen reader is running, so this application does not claim to detect one. On the automatic setting the narrator instead ducks around the application\'s OWN announcements — the moments a screen reader would be speaking — by waiting and lowering its volume. The other settings let you say plainly what is true on this computer.',
      'Nothing lets a window ask whether a screen reader is running, so this does not pretend to know. On automatic it ducks around the application\'s own announcements instead — exactly when a reader would be talking — by waiting and dropping its volume. The other settings let you just tell it the truth.',
      'No window can ask whether a screen reader is running, so this one does not pretend it can. On automatic it ducks around the application\'s own announcements — the moments a reader would be talking — by waiting and going quieter. Or you can simply tell it what is going on.',
      'No window can ask whether a screen reader is running, so this one does not pretend it can. On automatic it ducks around the application\'s own announcements — the moments a reader would be talking — by waiting and going quieter. Or you can simply tell it what is going on.'
    ),
    ladder(
      '個視窗根本冇途徑去問「而家有冇螢幕閱讀器行緊」，所以呢個程式唔會扮偵測到。揀「自動」嘅時候，佢會改為避開程式自己嘅播報 —— 即係螢幕閱讀器會開口嗰啲時刻 —— 等一等再細聲啲讀。其他選項就係俾你直接講出實情。',
      '個視窗根本冇途徑去問「而家有冇螢幕閱讀器行緊」，所以呢個程式唔會扮偵測到。揀「自動」嘅時候，佢會改為避開程式自己嘅播報 —— 即係螢幕閱讀器會開口嗰啲時刻 —— 等一等再細聲啲讀。其他選項就係俾你直接講出實情。',
      '個窗係問唔到有冇螢幕閱讀器行緊嘅，所以佢唔會扮曬嘢。揀「自動」就避開程式自己嘅播報 —— 啱啱就係閱讀器會出聲嗰陣 —— 等一等再細聲讀。或者你直接同佢講實情。',
      '個窗係冇可能知有冇螢幕閱讀器行緊，所以佢唔扮曬有超能力。揀「自動」就係避開程式自己嘅播報 —— 閱讀器出聲嗰陣 —— 等埋佢再細細聲。或者你索性同佢講聲。',
      '個窗係冇可能知有冇螢幕閱讀器行緊，所以佢唔扮曬有超能力。揀「自動」就係避開程式自己嘅播報 —— 閱讀器出聲嗰陣 —— 等埋佢再細細聲。或者你索性同佢講聲。'
    )
  ),
  'narrator.screenReader.auto': entry(
    ladder('Automatic: duck around this application\'s own announcements'),
    ladder('自動：避開呢個程式自己嘅播報')
  ),
  'narrator.screenReader.duck': entry(
    ladder('A screen reader is running: always speak quietly and wait'),
    ladder('有螢幕閱讀器行緊：一直細聲讀，仲要等埋佢')
  ),
  'narrator.screenReader.silent': entry(
    ladder('A screen reader is running: say nothing at all'),
    ladder('有螢幕閱讀器行緊：完全唔出聲')
  ),
  'narrator.screenReader.off': entry(
    ladder('No screen reader: never duck'),
    ladder('冇螢幕閱讀器：唔使避')
  ),
  'narrator.duckVolume': entry(ladder('Volume while ducking'), ladder('避讓時嘅音量')),
  'narrator.duckVolume.description': entry(
    ladder('The fraction of the narrator volume used while it is ducking under an announcement. 0.45 is a little under half.'),
    ladder('避讓緊嗰陣用返旁白音量嘅幾多成。0.45 即係略少過一半。')
  ),
  'narrator.duckWindow': entry(ladder('Duck for (milliseconds)'), ladder('避讓幾耐（毫秒）')),
  'narrator.duckWindow.description': entry(
    ladder('How long the narrator holds back after the application announces something on a live region.'),
    ladder('程式喺即時區域播報咗之後，旁白要忍幾耐先出聲。')
  ),

  'narrator.quiet.enabled': entry(ladder('Quiet hours'), ladder('安靜時段')),
  'narrator.quiet.enabled.description': entry(
    ladder(
      'Stops every spoken line, including errors, between the two times below. The events still happen and still appear as notifications; only the speaking stops, and the log records the reason.',
      'Stops every spoken line, including errors, between the two times below. The events still happen and still appear as notifications; only the speaking stops, and the log records the reason.',
      'Silences every line, errors included, between the two times below. The events still happen and still show up as notifications — only the talking stops, and the log says why.',
      'Puts a hand over its mouth between the two times below, errors and all. Everything still happens and still shows up as a notification; only the talking stops, and the log says exactly why.',
      'Puts a hand over its mouth between the two times below, errors and all. Everything still happens and still shows up as a notification; only the talking stops, and the log says exactly why.'
    ),
    ladder(
      '喺下面兩個時間之間，連錯誤都唔會讀出嚟。啲事一樣會發生，一樣有通知；淨係唔出聲，紀錄度會寫低原因。',
      '喺下面兩個時間之間，連錯誤都唔會讀出嚟。啲事一樣會發生，一樣有通知；淨係唔出聲，紀錄度會寫低原因。',
      '喺下面兩個時間之間乜都唔講，連錯誤都係。啲嘢一樣照樣發生、照樣有通知 —— 淨係唔開口，紀錄會寫明點解。',
      '喺下面兩個時間之間佢會摀住把口，連錯誤都唔例外。啲嘢照發生、照通知，淨係唔出聲，紀錄寫到一清二楚。',
      '喺下面兩個時間之間佢會摀住把口，連錯誤都唔例外。啲嘢照發生、照通知，淨係唔出聲，紀錄寫到一清二楚。'
    )
  ),
  'narrator.quiet.from': entry(ladder('Quiet from'), ladder('由幾點開始靜')),
  'narrator.quiet.to': entry(ladder('Quiet until'), ladder('靜到幾點')),
  'narrator.quiet.time.description': entry(
    ladder('A 24-hour local time, written as HH:MM. A window that crosses midnight, such as 22:00 to 07:00, works as written.'),
    ladder('24 小時制嘅本地時間，寫成 HH:MM。跨過午夜嘅時段，好似 22:00 至 07:00，一樣照用得。')
  ),
  'narrator.log.limit': entry(ladder('Lines kept in the log'), ladder('紀錄留幾多句')),
  'narrator.log.limit.description': entry(
    ladder('How many spoken and suppressed lines this session keeps. The log lives in memory for this session only and is never written to disk.'),
    ladder('今次開機留低幾多句（讀咗嘅同冇讀嘅都計）。呢本紀錄淨係喺記憶體度，唔會寫落硬碟。')
  ),

  /* ---------------- categories ---------------- */

  'narrator.category.error': entry(ladder('Failures'), ladder('出事')),
  'narrator.category.error.description': entry(
    ladder(
      'Anything that failed. This category jumps the queue, ignores the wait and the minimum gap, and interrupts an ordinary line that is already speaking. A spoken failure names the actual failure and what to do about it; a rate limit that swallowed it would be worse than no narrator at all.'
    ),
    ladder(
      '所有失敗嘅嘢。呢類會打尖，唔理等候時間同最短間隔，仲會打斷緊讀緊嘅普通句子。讀出嚟嗰句會講明真係出咗咩事、可以點做；如果俾個限流食咗，倒不如唔好有旁白。'
    )
  ),
  'narrator.category.warning': entry(ladder('Warnings'), ladder('警告')),
  'narrator.category.warning.description': entry(
    ladder('Something that needs attention but did not fail.'),
    ladder('要留意，但仲未算失敗嗰啲。')
  ),
  'narrator.category.success': entry(ladder('Completions'), ladder('搞掂')),
  'narrator.category.success.description': entry(
    ladder('An operation finished successfully.'),
    ladder('件事順利做完咗。')
  ),
  'narrator.category.notice': entry(ladder('Notices'), ladder('提示')),
  'narrator.category.notice.description': entry(
    ladder('Plain informational messages. Off by default, because most of them are already on screen.'),
    ladder('純粹話你知嘅訊息。預設熄，因為呢啲多數已經寫咗喺畫面度。')
  ),
  'narrator.category.progress': entry(ladder('Progress'), ladder('進度')),
  'narrator.category.progress.description': entry(
    ladder('Progress of a long operation. Off by default and slow by default, because progress that speaks every few seconds is unbearable.'),
    ladder('做緊嘅長工序嘅進度。預設熄、預設慢，因為每隔幾秒讀一次進度真係頂唔順。')
  ),
  'narrator.category.lifecycle': entry(ladder('Application events'), ladder('程式大事')),
  'narrator.category.lifecycle.description': entry(
    ladder('The application becoming ready, and other whole-application moments.'),
    ladder('程式準備好，同埋其他成個程式層面嘅時刻。')
  ),
  'narrator.category.navigation': entry(ladder('Navigation'), ladder('去咗邊')),
  'narrator.category.navigation.description': entry(
    ladder('The tab you moved to. Off by default: you can see where you are.'),
    ladder('你轉去邊個分頁。預設熄：你自己睇得到你喺邊。')
  ),
  'narrator.category.settings': entry(ladder('Settings changes'), ladder('設定改動')),
  'narrator.category.settings.description': entry(
    ladder('A setting you changed, and its new value. Off by default.'),
    ladder('你改咗邊個設定、改成幾多。預設熄。')
  ),

  /* ---------------- the sentence frames ---------------- */

  'narrator.frame.error': entry(
    ladder(
      'Failure. {title}. {body}',
      'Failure. {title}. {body}',
      'That did not work. {title}. {body}',
      'Bad news. {title}. {body}',
      'Bad news. {title}. {body}'
    ),
    ladder(
      '出咗事。{title}。{body}',
      '出咗事。{title}。{body}',
      '搞唔掂。{title}。{body}',
      '弊傢伙。{title}。{body}',
      '弊傢伙。{title}。{body}'
    )
  ),
  'narrator.frame.warning': entry(
    ladder('Warning. {title}. {body}', 'Warning. {title}. {body}', 'Worth a look. {title}. {body}', 'Careful now. {title}. {body}', 'Careful now. {title}. {body}'),
    ladder('注意。{title}。{body}', '注意。{title}。{body}', '睇下先。{title}。{body}', '小心啲。{title}。{body}', '小心啲。{title}。{body}')
  ),
  'narrator.frame.success': entry(
    ladder('Finished. {title}. {body}', 'Finished. {title}. {body}', 'All done. {title}. {body}', 'Done and dusted. {title}. {body}', 'Done and dusted. {title}. {body}'),
    ladder('完成。{title}。{body}', '完成。{title}。{body}', '搞掂晒。{title}。{body}', '掂晒收工。{title}。{body}', '掂晒收工。{title}。{body}')
  ),
  'narrator.frame.notice': entry(
    ladder('{title}. {body}', '{title}. {body}', 'Note. {title}. {body}', 'Just so you know. {title}. {body}', 'Just so you know. {title}. {body}'),
    ladder('{title}。{body}', '{title}。{body}', '話你知。{title}。{body}', '講聲你知。{title}。{body}', '講聲你知。{title}。{body}')
  ),
  'narrator.frame.progress': entry(
    ladder('{title}, {body}.', '{title}, {body}.', 'Still going. {title}, {body}.', 'Still at it. {title}, {body}.', 'Still at it. {title}, {body}.'),
    ladder('{title}，{body}。', '{title}，{body}。', '仲做緊。{title}，{body}。', '仲喺度捱緊。{title}，{body}。', '仲喺度捱緊。{title}，{body}。')
  ),
  'narrator.frame.lifecycle': entry(
    ladder('{title}.', '{title}.', '{title}.', '{title}. There you go.', '{title}. There you go.'),
    ladder('{title}。', '{title}。', '{title}。', '{title}，得喇。', '{title}，得喇。')
  ),
  'narrator.frame.navigation': entry(
    ladder('{title}.', '{title}.', 'Now on {title}.', 'You are on {title} now.', 'You are on {title} now.'),
    ladder('{title}。', '{title}。', '而家喺{title}。', '你而家喺{title}度。', '你而家喺{title}度。')
  ),
  'narrator.frame.settings': entry(
    ladder('{title} is now {body}.', '{title} is now {body}.', '{title} is now {body}.', '{title} is {body} now.', '{title} is {body} now.'),
    ladder('{title} 而家係 {body}。', '{title} 而家係 {body}。', '{title} 改咗做 {body}。', '{title} 而家變咗 {body} 喇。', '{title} 而家變咗 {body} 喇。')
  ),

  /* ---------------- spoken events the feature raises itself ---------------- */

  'narrator.event.ready': entry(
    ladder('{title} is ready', '{title} is ready', '{title} is ready to go', '{title} is up and ready', '{title} is up and ready'),
    ladder('{title} 準備好喇', '{title} 準備好喇', '{title} 可以開工喇', '{title} 已經就緒，開工得喇', '{title} 已經就緒，開工得喇')
  ),
  'narrator.sample.en': entry(
    ladder('This is the English narrator voice, speaking at the current rate and pitch.'),
    ladder('This is the English narrator voice, speaking at the current rate and pitch.')
  ),
  'narrator.sample.yue': entry(
    ladder('呢把係廣東話旁白，用緊而家嘅語速同音調讀畀你聽。'),
    ladder('呢把係廣東話旁白，用緊而家嘅語速同音調讀畀你聽。')
  ),

  /* ---------------- panel copy ---------------- */

  'narrator.action.preview': entry(ladder('Speak a sample'), ladder('讀段樣本嚟聽下')),
  'narrator.action.stop': entry(ladder('Stop speaking'), ladder('停止讀')),
  'narrator.action.refresh': entry(ladder('Re-read the installed voices'), ladder('再讀一次已安裝嘅聲')),
  'narrator.action.testCategory': entry(ladder('Speak this category'), ladder('試讀呢一類')),
  'narrator.action.clearLog': entry(ladder('Clear the log'), ladder('清空紀錄')),
  'narrator.action.resetVoice': entry(ladder('Back to choosing automatically'), ladder('返去自動揀')),

  'narrator.state.idle': entry(ladder('Ready, and not speaking.'), ladder('準備好，而家冇讀緊。')),
  'narrator.state.speaking': entry(
    ladder('Speaking now. {count} lines waiting.'),
    ladder('讀緊。仲有 {count} 句排緊隊。')
  ),
  'narrator.state.ducking': entry(
    ladder('Holding back for {ms} milliseconds while the application announces something.'),
    ladder('程式喺度播報緊，所以忍住 {ms} 毫秒先。')
  ),
  'narrator.state.silent': entry(ladder('Silent: {reason}'), ladder('唔會出聲：{reason}')),
  'narrator.state.lastError': entry(ladder('Last problem: {message}'), ladder('上次出事：{message}')),

  'narrator.log.title': entry(ladder('What the narrator has said this session'), ladder('今次開機讀過啲乜')),
  'narrator.log.description': entry(
    ladder(
      'Every line the narrator spoke, and every line it did not, with the exact reason. It lives in memory for this session only and is never written to disk.'
    ),
    ladder('旁白讀過嘅每一句，同埋冇讀嗰啲同確實原因。淨係喺今次開機嘅記憶體度，唔會寫落硬碟。')
  ),
  'narrator.log.empty': entry(
    ladder('Nothing has been spoken or suppressed yet.'),
    ladder('暫時未讀過、亦未擋過任何一句。')
  ),
  'narrator.log.column.time': entry(ladder('When'), ladder('幾時')),
  'narrator.log.column.category': entry(ladder('Category'), ladder('類別')),
  'narrator.log.column.text': entry(ladder('Line'), ladder('句子')),
  'narrator.log.column.voice': entry(ladder('Voice'), ladder('聲音')),
  'narrator.log.column.outcome': entry(ladder('Outcome'), ladder('結果')),
  'narrator.log.column.reason': entry(ladder('Reason'), ladder('原因')),

  'narrator.outcome.spoken': entry(ladder('Spoken'), ladder('讀咗')),
  'narrator.outcome.replaced': entry(ladder('Replaced by a newer line'), ladder('俾新一句換走')),
  'narrator.outcome.dropped': entry(ladder('Dropped'), ladder('掉咗')),
  'narrator.outcome.suppressed': entry(ladder('Not spoken'), ladder('冇讀')),
  'narrator.outcome.interrupted': entry(ladder('Interrupted'), ladder('俾人打斷')),
  'narrator.outcome.failed': entry(ladder('Failed'), ladder('讀唔到')),

  'narrator.search.log': entry(ladder('Search the spoken log'), ladder('搵紀錄')),
  'narrator.search.categories': entry(ladder('Search the categories'), ladder('搵類別')),

  /* ---------------- bulk actions ---------------- */

  'narrator.bulk.selectPage': entry(ladder('Select the {count} rows shown'), ladder('揀曬顯示緊嘅 {count} 行')),
  'narrator.bulk.selectAll': entry(ladder('Select all {count} rows, including those the search hides'), ladder('揀曬全部 {count} 行，包括俾搜尋收埋嗰啲')),
  'narrator.bulk.invert': entry(ladder('Invert the selection'), ladder('反轉揀咗嘅')),
  'narrator.bulk.clear': entry(ladder('Clear the selection'), ladder('唔揀住')),
  'narrator.bulk.count': entry(ladder('{selected} selected of {shown} shown, {total} in total'), ladder('揀咗 {selected} 個，顯示緊 {shown} 個，總共 {total} 個')),
  'narrator.bulk.none': entry(ladder('Nothing is selected, so no action can run.'), ladder('冇揀嘢，所以做唔到任何動作。')),
  'narrator.bulk.enable': entry(ladder('Speak these categories'), ladder('呢啲類別要讀')),
  'narrator.bulk.disable': entry(ladder('Stop speaking these categories'), ladder('呢啲類別唔好讀')),
  'narrator.bulk.resetCooldown': entry(ladder('Restore the shipped gaps'), ladder('還原出廠間隔')),
  'narrator.bulk.delete': entry(ladder('Remove these lines from the log'), ladder('喺紀錄度剷走呢啲')),
  'narrator.bulk.export': entry(ladder('Export the selected lines'), ladder('匯出揀咗嘅句子')),
  'narrator.bulk.preview': entry(ladder('Review what will change'), ladder('睇下會改啲乜')),
  'narrator.bulk.previewTitle': entry(ladder('{count} rows will change'), ladder('會改 {count} 行')),
  'narrator.bulk.skipped': entry(ladder('{count} rows were left alone: {reason}'), ladder('有 {count} 行冇郁過：{reason}')),
  'narrator.bulk.applied': entry(ladder('{count} rows changed'), ladder('改咗 {count} 行')),

  /* ---------------- notifications ---------------- */

  'narrator.notify.unsupportedTitle': entry(ladder('This build cannot speak'), ladder('呢個版本讀唔到嘢')),
  'narrator.notify.unsupportedBody': entry(
    ladder('There is no speech synthesis available to this window, so the narrator has nothing to speak with. Your settings were left exactly as they are.'),
    ladder('呢個視窗攞唔到語音合成，所以旁白冇嘢用嚟出聲。你嘅設定原封不動。')
  ),
  'narrator.notify.noVoiceTitle': entry(ladder('No voice for that language'), ladder('冇聲識讀嗰種語言')),
  'narrator.notify.noVoiceBody': entry(
    ladder('This computer has no installed voice that can read {language}, so that track will stay silent. Installing one in the operating system speech settings is what fixes it.'),
    ladder('呢部電腦冇裝到識讀{language}嘅聲，所以嗰條聲道會靜。去作業系統嘅語音設定裝一把就搞掂。')
  ),
  'narrator.notify.logCleared': entry(ladder('The narrator log was cleared'), ladder('旁白紀錄清空咗')),
  'narrator.notify.exported': entry(ladder('Exported to {path}'), ladder('匯出咗去 {path}')),

  /* ---------------- palette ---------------- */

  'narrator.palette.open': entry(ladder('Open the narrator'), ladder('打開旁白')),
  'narrator.palette.toggle': entry(ladder('Turn the narrator on or off'), ladder('開／熄旁白')),
  'narrator.palette.stop': entry(ladder('Stop the narrator speaking now'), ladder('即刻叫旁白收聲')),
  'narrator.palette.sampleEn': entry(ladder('Speak an English sample'), ladder('讀段英文樣本')),
  'narrator.palette.sampleYue': entry(ladder('Speak a Cantonese sample'), ladder('讀段廣東話樣本')),
  'narrator.palette.voiceEn': entry(ladder('Choose the English narrator voice'), ladder('揀英文旁白聲')),
  'narrator.palette.voiceYue': entry(ladder('Choose the Cantonese narrator voice'), ladder('揀廣東話旁白聲')),

  /* ---------------- school mode ---------------- */

  'narrator.school.note': entry(
    ladder(
      'The narrator is speaking English only, because the study mode is on. The Cantonese track, its voice, its rate and its pitch are not offered while it is on, and every choice you made for them is kept and returns when it is turned off.'
    ),
    ladder(
      '而家旁白淨係讀英文，因為學習模式開咗。開住嗰陣唔會提供廣東話聲道、佢嘅聲音、語速同音調，你之前揀過嘅嘢全部留住，熄咗就返晒嚟。'
    )
  )
};
