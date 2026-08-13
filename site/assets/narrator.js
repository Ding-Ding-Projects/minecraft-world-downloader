/*!
 * World Downloader Studio -- the site's spoken narrator (site/assets/narrator.js)
 *
 * A plain script, loaded after assets/site.js on any page that wants it. It adds
 * exactly one property to window: `StudioNarrator`. Nothing else.
 *
 * What it is:
 *   - The narration ENGINE always boots: it defines its own i18n copy, listens
 *     to every `Studio.notify` this site raises (an "app event", exactly the
 *     same events a visitor already sees as a toast), and speaks the ones the
 *     visitor has asked to hear. This runs on any page that includes this file,
 *     with no UI required, because a narrator that only works on one page is
 *     not "for app events" -- it is for one page's events.
 *   - The SETTINGS PANEL is opt-in: call `StudioNarrator.mount(host)` from a
 *     page that owns a place to put it (a tab panel, a section of a page). It
 *     builds the whole control surface -- the master switch, the language
 *     choice, one voice picker per narrated language, rate and pitch, what
 *     gets spoken, and a "hear it before you commit to it" test section --
 *     using only Studio.settingRow / Studio.makeSwitch / Studio.makeSlider /
 *     Studio.createSelect, so every row already carries the appearance editor,
 *     the lock wizard and the reset action the rest of this site's settings
 *     carry, with no extra code here.
 *
 * Ships OFF. The engine speaks nothing until `narrator.enabled` is explicitly
 * turned on by the visitor; the implementation above that switch is not
 * optional, per the shared feature contract.
 *
 * SITE_API.md documents no page-extension registration pattern beyond the
 * palette, so this follows the fallback it names explicitly: a single global
 * with a `mount(host)` function. See the "HOOK NEEDED" comment near the
 * bottom of this file for the one thing only a page that owns settings.html
 * can wire up.
 */
(function () {
  'use strict';

  function boot(S) {
    var store = S.store;
    var el = S.el, icon = S.icon, clear = S.clear, t = S.t;

    /* ================================================================
     * 0. Copy. Five variants per language, lowest funny level first,
     * exactly as Studio.i18n.define requires. The facts inside a status
     * line -- which voice, which language, which limit -- never move
     * across a level; only the frame around them does. Every key here
     * is namespaced under "siteNarrator." so it cannot collide with a
     * key another module defines on the same shared dictionary.
     * ================================================================ */
    function same(en, zh) { return { en: [en, en, en, en, en], zh: [zh, zh, zh, zh, zh] }; }

    S.i18n.define({
      'siteNarrator.title': same('Spoken narrator', '有聲讀出'),
      'siteNarrator.lede': {
        en: [
          'Have this site read its own notifications aloud. Off until you turn it on.',
          'Have this site read its own notifications aloud. Off until you turn it on.',
          'This site can read its own notifications out loud. It stays quiet until you switch it on.',
          'This site can read its own notifications out loud, in whichever language and voice you pick. It stays quiet until you switch it on, and one button always stops it mid-sentence.',
          'This site can read its own notifications out loud, in whichever language and voice you like the sound of. Not one word leaves this browser until you flip the switch, and one button always shuts it up mid-sentence.'
        ],
        zh: [
          '呢個網站可以將自己嘅通知讀出嚟。未開之前係靜嘅。',
          '呢個網站可以將自己嘅通知讀出嚟。未開之前係靜嘅。',
          '呢個網站可以將自己嘅通知讀出嚟俾你聽，未撳開之前一路靜雞雞。',
          '呢個網站可以將自己嘅通知讀出嚟，你揀邊個語言、邊把聲都得。未撳開之前一路靜雞雞，仲有粒掣可以即刻叫佢收聲。',
          '呢個網站可以將自己嘅通知讀俾你聽，語言同把聲都由你揀。未撳掣之前一個字都唔會出，講到一半都有粒掣即刻叫佢收聲。'
        ]
      },
      'siteNarrator.unsupported': {
        en: [
          'This browser cannot speak text aloud. There is no Web Speech API here, so the rest of this section has nothing it could do and is left out.',
          'This browser cannot speak text aloud. There is no Web Speech API here, so the rest of this section has nothing it could do and is left out.',
          'This browser has no speech synthesis at all, so there is nothing the rest of this section could switch on. It is left out rather than shown broken.',
          'This browser exposes no speech synthesis of any kind, so there is nothing the rest of this section could turn on -- it is left out entirely rather than shown as a control that cannot work.',
          'This browser will not speak a single word: it has no speech synthesis whatsoever, so the rest of this section is left out rather than dressed up as a control that could never do anything.'
        ],
        zh: [
          '呢個瀏覽器唔識講嘢，冇 Web Speech API，所以呢版下面嘅嘢做唔到，索性唔顯示。',
          '呢個瀏覽器唔識講嘢，冇 Web Speech API，所以呢版下面嘅嘢做唔到，索性唔顯示。',
          '呢個瀏覽器完全冇語音功能，下面嗰啲設定開極都冇用，所以直接唔擺出嚟。',
          '呢個瀏覽器完全冇任何語音合成功能，下面嗰啲設定一個都開唔到，所以直接唔擺出嚟，好過擺個死掣呃你。',
          '呢個瀏覽器一個字都讀唔到，完全冇語音合成，所以下面嗰堆設定索性唔出現，好過擺個扮工嘅死掣氹你。'
        ]
      },

      'siteNarrator.enableLabel': same(
        "Speak this site's notifications aloud",
        '將呢個網站嘅通知讀出嚟'
      ),
      'siteNarrator.enableExplain': {
        en: [
          '**Off by default.** When on, every notification this site raises is also spoken, using the language and voices below.',
          '**Off by default.** When on, every notification this site raises is also spoken, using the language and voices below.',
          '**Off by default.** When on, every toast this site raises is also spoken aloud, in the language and voices set below.',
          '**Off by default, on your say-so only.** When on, every toast this site raises -- saved settings, refused files, everything -- is also spoken aloud, in the language and voices set below. If you are using a screen reader, this narrator speaks over its own announcements rather than instead of them, so it is worth leaving off unless you specifically want the second voice.',
          '**Off by default, and it stays that way until you say otherwise.** When on, every toast this site raises -- saved settings, refused files, all of it -- gets read aloud too, in whichever language and voices you set below. Running a screen reader already? This narrator talks over it rather than instead of it, so leave it off unless you genuinely want two voices arguing about the same notification.'
        ],
        zh: [
          '**預設係關嘅。** 開咗之後，呢個網站彈出嘅每個通知都會讀埋出嚟，用下面揀嘅語言同把聲。',
          '**預設係關嘅。** 開咗之後，呢個網站彈出嘅每個通知都會讀埋出嚟，用下面揀嘅語言同把聲。',
          '**預設係關嘅。** 開咗之後，網站每個彈出嘅通知都會讀出嚟，用下面設定嘅語言同把聲。',
          '**預設關咗，要你自己開先得。** 開咗之後，網站每個彈出通知——儲存好嘅設定、俾拒絕嘅檔案，全部——都會讀出嚟，用下面設定嘅語言同把聲。你如果本身用緊螢幕閱讀器，呢個讀出功能係同佢一齊講，唔係代替佢，所以除非你真係想有兩把聲，唔係就留返關咗佢好。',
          '**預設係關嘅，你唔撳佢就一直咁樣。** 開咗之後，網站每個彈出通知——儲存好嘅設定、俾拒絕嘅檔案，全部都算——都會讀埋出嚟，語言同把聲全部由下面設定。你已經用緊螢幕閱讀器？呢個讀出功能係同佢一齊搶住講，唔係代替佢，所以除非你真係想聽兩把聲為住同一個通知拗交，唔係就由佢關住。'
        ]
      },
      'siteNarrator.turnedOn': same('Spoken narrator turned on.', '有聲讀出開咗喇。'),
      'siteNarrator.turnedOff': same('Spoken narrator turned off.', '有聲讀出閂咗喇。'),

      'siteNarrator.languageLabel': same('Narrated language', '讀出用嘅語言'),
      'siteNarrator.languageExplain': {
        en: [
          'Which language is spoken. "Both" speaks the English line, then the Cantonese line, one after the other -- never at the same time.',
          'Which language is spoken. "Both" speaks the English line, then the Cantonese line, one after the other -- never at the same time.',
          'Which language is spoken. "Both" reads the English line, then the Cantonese line, strictly one after the other. They never overlap.',
          'Which language is spoken. "Both" reads the English line first and the Cantonese line second, strictly one after the other, with its own voice, rate and pitch for each -- they are never mixed into one utterance and never overlap.',
          'Which language is spoken. "Both" reads the English line first and the Cantonese line second, one after the other with no exceptions -- each keeps its own voice, rate and pitch, and the two are never mixed into one breath or allowed to talk over each other.'
        ],
        zh: [
          '揀讀邊種語言。「兩者都讀」係先讀英文，再讀廣東話，一句接一句，唔會同時講。',
          '揀讀邊種語言。「兩者都讀」係先讀英文，再讀廣東話，一句接一句，唔會同時講。',
          '揀讀邊種語言。「兩者都讀」會先讀英文，再讀廣東話，實一句接一句，唔會撞埋一齊。',
          '揀讀邊種語言。「兩者都讀」實會先讀英文，再讀廣東話，一句接一句，每種語言有自己嘅把聲、語速同音調，唔會混埋一句讀，亦唔會撞埋一齊講。',
          '揀讀邊種語言。「兩者都讀」實會先讀英文，再讀廣東話，一句都唔會走精面，各有各嘅把聲、語速同音調，唔會炒埋一碟讀，更加唔會兩把聲撞埋一齊嗌交。'
        ]
      },
      'siteNarrator.optEnglish': same('English only', '淨係英文'),
      'siteNarrator.optCantonese': same('Cantonese only', '淨係廣東話'),
      'siteNarrator.optBoth': same('Both, English then Cantonese', '兩者都讀，先英文後廣東話'),

      'siteNarrator.voiceSectionEn': same('English voice', '英文把聲'),
      'siteNarrator.voiceSectionZh': same('Cantonese voice', '廣東話把聲'),
      'siteNarrator.voiceAuto': same('Choose automatically', '自動揀'),
      'siteNarrator.voiceExplainEn': {
        en: [
          'Which voice reads the English line. "Choose automatically" is the shipped default: this site does not know what is installed until it asks, so it never picks a named voice for you.',
          'Which voice reads the English line. "Choose automatically" is the shipped default: this site does not know what is installed until it asks, so it never picks a named voice for you.',
          'Which voice reads the English line. "Choose automatically" ships as the default, because this site cannot know what is installed until it actually asks this browser -- so it never guesses at a named voice on your behalf.',
          'Which voice reads the English line. "Choose automatically" ships as the default: this site has no way to know which voices are installed until it asks this browser directly, so it never picks a named voice on your behalf -- that would be a preference for a voice most machines do not have.',
          'Which voice reads the English line. "Choose automatically" ships as the default and stays that way until you pick one, because this site genuinely cannot know which voices exist here until it asks -- naming a voice up front would just be a preference for the one voice most machines never installed.'
        ],
        zh: [
          '揀邊把聲讀英文。預設係「自動揀」：呢個網站要問過先知裝咗乜嘢，所以唔會幫你揀死一把聲。',
          '揀邊把聲讀英文。預設係「自動揀」：呢個網站要問過先知裝咗乜嘢，所以唔會幫你揀死一把聲。',
          '揀邊把聲讀英文。預設係「自動揀」，因為呢個網站要問返呢個瀏覽器先知裝咗啲乜，所以唔會幫你揀死一把聲。',
          '揀邊把聲讀英文。預設係「自動揀」：呢個網站冇辦法未問就知呢部機裝咗邊啲聲，所以唔會擅自幫你揀一把聲——嗰咁做只會係揀咗一把好多部機都冇裝嘅聲。',
          '揀邊把聲讀英文。預設一直係「自動揀」，直到你自己揀為止，因為呢個網站真係要問一問先知呢部機有邊啲聲——未問就幫你揀死一把，只會係揀咗大部分人部機都冇嗰把。'
        ]
      },
      'siteNarrator.voiceExplainZh': {
        en: [
          'Which voice reads the Cantonese line. Matched on `yue`, `zh-yue`, `zh-HK` and `zh-Hant-HK` only -- a plain Mandarin voice is not offered here, because it would produce confidently wrong speech rather than honest silence.',
          'Which voice reads the Cantonese line. Matched on `yue`, `zh-yue`, `zh-HK` and `zh-Hant-HK` only -- a plain Mandarin voice is not offered here, because it would produce confidently wrong speech rather than honest silence.',
          'Which voice reads the Cantonese line. Only voices tagged `yue`, `zh-yue`, `zh-HK` or `zh-Hant-HK` show up here -- a Mandarin voice is deliberately left out, because it cannot actually read Cantonese and would just be confidently wrong instead of honestly silent.',
          'Which voice reads the Cantonese line. Only voices tagged `yue`, `zh-yue`, `zh-HK` or `zh-Hant-HK` are offered -- a plain Mandarin voice is deliberately left out, because it cannot read Cantonese and offering it would produce confidently wrong speech rather than an honest silence.',
          'Which voice reads the Cantonese line. Only voices tagged `yue`, `zh-yue`, `zh-HK` or `zh-Hant-HK` ever turn up here -- a Mandarin voice is left out on purpose, because it would happily mispronounce every word of Cantonese rather than doing the honest thing and staying quiet.'
        ],
        zh: [
          '揀邊把聲讀廣東話。淨係揀語言標籤係 `yue`、`zh-yue`、`zh-HK` 或 `zh-Hant-HK` 嘅聲——唔會揀普通話聲，因為佢讀出嚟會錯得好肯定，唔係老實咁靜。',
          '揀邊把聲讀廣東話。淨係揀語言標籤係 `yue`、`zh-yue`、`zh-HK` 或 `zh-Hant-HK` 嘅聲——唔會揀普通話聲，因為佢讀出嚟會錯得好肯定，唔係老實咁靜。',
          '揀邊把聲讀廣東話。呢度淨係得標籤 `yue`、`zh-yue`、`zh-HK` 或 `zh-Hant-HK` 嘅聲先會出現——普通話聲刻意唔畀揀，因為佢讀唔到廣東話，讀出嚟會錯到肯定過龍。',
          '揀邊把聲讀廣東話。呢度淨係揀標籤 `yue`、`zh-yue`、`zh-HK` 或 `zh-Hant-HK` 嘅聲——普通話聲刻意冇份，因為佢讀廣東話會錯到十足十啱，寧願老實靜返都好過。',
          '揀邊把聲讀廣東話。呢度淨係擺標籤 `yue`、`zh-yue`、`zh-HK` 或 `zh-Hant-HK` 嘅聲出嚟——普通話聲刻意唔擺，因為佢一開口讀廣東話就錯到十足十肯定，寧願乜都唔講都好過吟錯晒。'
        ]
      },
      'siteNarrator.notInstalledShort': same('not installed here', '呢度未裝'),

      'siteNarrator.rateLabel': same('Speaking rate', '語速'),
      'siteNarrator.pitchLabel': same('Pitch', '音調'),
      'siteNarrator.rateExplainEn': same(
        'How fast the English line is read, from 0.1 to 10. 1.0 is the voice\'s own normal delivery.',
        '英文讀出嚟幾快，範圍 0.1 至 10。1.0 係呢把聲原本嘅正常語速。'
      ),
      'siteNarrator.rateExplainZh': same(
        'How fast the Cantonese line is read, from 0.1 to 10. 1.0 is the voice\'s own normal delivery.',
        '廣東話讀出嚟幾快，範圍 0.1 至 10。1.0 係呢把聲原本嘅正常語速。'
      ),
      'siteNarrator.pitchExplainEn': same(
        'How high or low the English line sounds, from 0 to 2. 1.0 is the voice\'s own normal pitch.',
        '英文讀出嚟幾高幾低，範圍 0 至 2。1.0 係呢把聲原本嘅正常音調。'
      ),
      'siteNarrator.pitchExplainZh': same(
        'How high or low the Cantonese line sounds, from 0 to 2. 1.0 is the voice\'s own normal pitch.',
        '廣東話讀出嚟幾高幾低，範圍 0 至 2。1.0 係呢把聲原本嘅正常音調。'
      ),

      'siteNarrator.statusLoading': {
        en: [
          'Still asking this browser which voices it has installed.',
          'Still asking this browser which voices it has installed.',
          'Still waiting on this browser to say which voices it has -- this can take a moment.',
          'Still waiting on this browser to say which voices it actually has installed. Some browsers answer instantly and some take a moment; this is not stuck, it just has not answered yet.',
          'Still waiting on this browser to admit which voices it has installed. Some answer the second you ask; some make you wait a beat. It is not stuck -- it just has not spoken up yet.'
        ],
        zh: [
          '仲喺度問緊呢個瀏覽器裝咗邊啲聲。',
          '仲喺度問緊呢個瀏覽器裝咗邊啲聲。',
          '仲喺度等緊呢個瀏覽器答緊裝咗邊啲聲，可能要等一陣。',
          '仲喺度等緊呢個瀏覽器答緊實際裝咗邊啲聲。有啲瀏覽器即刻答，有啲要等一陣，唔係卡住咗，淨係未答到。',
          '仲喺度等緊呢個瀏覽器肯認裝咗邊啲聲。有啲問完即刻答，有啲要諗定先，未死機，淨係未夠膽開聲。'
        ]
      },
      'siteNarrator.statusAuto': {
        en: [
          'Speaking with %VOICE%, chosen automatically for %LANG%.',
          'Speaking with %VOICE%, chosen automatically for %LANG%.',
          'Speaking with %VOICE%, which this browser offered first for %LANG%.',
          'Speaking with %VOICE%, the first voice this browser offered for %LANG%. Nothing was named ahead of time -- this is simply what turned up.',
          'Speaking with %VOICE% -- the first voice this browser handed over for %LANG%, no favourites picked in advance. That is genuinely all "automatic" means.'
        ],
        zh: [
          '而家用緊 %VOICE% 講，係幫 %LANG% 自動揀嘅。',
          '而家用緊 %VOICE% 講，係幫 %LANG% 自動揀嘅。',
          '而家用緊 %VOICE% 講，係呢個瀏覽器幫 %LANG% 第一個提供嘅聲。',
          '而家用緊 %VOICE% 講，佢係呢個瀏覽器幫 %LANG% 提供嘅第一把聲，事先冇揀死邊個，純粹啱啱好出現咗。',
          '而家用緊 %VOICE% 講——係呢個瀏覽器幫 %LANG% 交出嚟嘅第一把聲，事先冇偏袒邊個。「自動」真係淨係咁解。'
        ]
      },
      'siteNarrator.statusChosen': {
        en: [
          'Speaking with %VOICE%.',
          'Speaking with %VOICE%.',
          'Speaking with %VOICE%, the voice you chose.',
          'Speaking with %VOICE%, exactly the voice you chose.',
          'Speaking with %VOICE% -- your pick, and it is right here doing the job.'
        ],
        zh: [
          '而家用緊 %VOICE% 講。',
          '而家用緊 %VOICE% 講。',
          '而家用緊 %VOICE% 講，即係你揀嗰把。',
          '而家用緊 %VOICE% 講，正正係你揀嗰把聲。',
          '而家用緊 %VOICE% 講——你揀嘅，佢而家喺度做緊嘢。'
        ]
      },
      'siteNarrator.statusNotInstalledFallback': {
        en: [
          'The voice you chose is not installed here. Your choice is kept; for now this track uses %VOICE% instead.',
          'The voice you chose is not installed here. Your choice is kept; for now this track uses %VOICE% instead.',
          'The voice you chose is not installed on this browser. Nothing was reset -- your choice is kept, and %VOICE% is filling in for now.',
          'The voice you chose is not installed on this browser. Your choice is kept exactly as it is, not silently reset, and %VOICE% fills in for now until that voice is available again.',
          'The voice you chose is nowhere to be found on this browser right now. Your choice is kept, not quietly wiped out, and %VOICE% is standing in until it turns up again.'
        ],
        zh: [
          '你揀嗰把聲呢度未裝。你揀嘅選擇會保留，暫時就用 %VOICE% 代替。',
          '你揀嗰把聲呢度未裝。你揀嘅選擇會保留，暫時就用 %VOICE% 代替。',
          '你揀嗰把聲呢個瀏覽器未裝。冇幫你重設，你揀嘅選擇繼續留低，暫時由 %VOICE% 頂住先。',
          '你揀嗰把聲呢個瀏覽器未裝。你揀嘅選擇原封不動保留住，唔會靜靜雞幫你改返自動，暫時由 %VOICE% 頂住，等到嗰把聲返嚟為止。',
          '你揀嗰把聲而家喺呢個瀏覽器度搵唔到。你揀嘅選擇一路留住，冇偷偷幫你清咗，暫時由 %VOICE% 頂住檔，等到嗰把聲翻頭為止。'
        ]
      },
      'siteNarrator.statusNotInstalledNoFallback': {
        en: [
          'The voice you chose is not installed here, and no other voice on this browser can read %LANG%. Your choice is kept, but this track stays silent for now.',
          'The voice you chose is not installed here, and no other voice on this browser can read %LANG%. Your choice is kept, but this track stays silent for now.',
          'The voice you chose is not installed here, and this browser has no other voice for %LANG% either. Your choice is kept -- it is not silently reset -- but this track stays quiet until one turns up.',
          'The voice you chose is not installed here, and this browser has no other voice that can read %LANG% to fall back on. Your choice is kept exactly as it is, but this track stays silent until a voice for %LANG% exists on this machine.',
          'The voice you chose is not installed here, and this browser has not one other voice for %LANG% to stand in. Your choice is kept, not quietly abandoned, but this track is genuinely silent until a %LANG% voice shows up on this machine.'
        ],
        zh: [
          '你揀嗰把聲呢度未裝，而呢個瀏覽器都冇第二把聲識讀 %LANG%。你揀嘅選擇會保留，不過呢個聲道暫時係靜嘅。',
          '你揀嗰把聲呢度未裝，而呢個瀏覽器都冇第二把聲識讀 %LANG%。你揀嘅選擇會保留，不過呢個聲道暫時係靜嘅。',
          '你揀嗰把聲呢度未裝，而且呢個瀏覽器都無第二把聲識讀 %LANG%。你揀嘅選擇繼續留住，唔會幫你偷偷重設，不過呢個聲道暫時要靜先。',
          '你揀嗰把聲呢度未裝，而呢個瀏覽器連第二把識讀 %LANG% 嘅聲都冇。你揀嘅選擇原封不動保留，不過呢個聲道會一直靜，直到呢部機有識讀 %LANG% 嘅聲為止。',
          '你揀嗰把聲呢度未裝，而呢個瀏覽器連一把識讀 %LANG% 嘅聲都頂唔到你。你揀嘅選擇一路留住，唔會靜靜雞幫你放棄，不過呢個聲道真係會一路靜，直到呢部機有把識讀 %LANG% 嘅聲出現為止。'
        ]
      },
      'siteNarrator.statusNone': {
        en: [
          'No voice on this browser can read %LANG% at all. Install one in the operating system speech settings to hear this track.',
          'No voice on this browser can read %LANG% at all. Install one in the operating system speech settings to hear this track.',
          'This browser has no voice for %LANG% at all. Install one in the operating system speech settings and this track will pick it up.',
          'This browser genuinely has no voice for %LANG%, not one. Install a %LANG% voice in the operating system speech settings and this track will find it the next time this page asks.',
          'This browser has not one single voice for %LANG% installed. Add one in the operating system speech settings, and the moment this page asks again it will be right there.'
        ],
        zh: [
          '呢個瀏覽器完全冇聲識讀 %LANG%。去作業系統嘅語音設定裝一把，先聽到呢個聲道。',
          '呢個瀏覽器完全冇聲識讀 %LANG%。去作業系統嘅語音設定裝一把，先聽到呢個聲道。',
          '呢個瀏覽器真係一把識讀 %LANG% 嘅聲都冇。去作業系統嘅語音設定裝一把，呢個聲道就即刻執到。',
          '呢個瀏覽器真係一把識讀 %LANG% 嘅聲都無，一把都冇。去作業系統嘅語音設定裝把 %LANG% 聲，下次呢版問嗰陣就會執到。',
          '呢個瀏覽器連一把識讀 %LANG% 嘅聲都未裝。去作業系統嘅語音設定裝返把，下次呢版一問就即刻搵到佢。'
        ]
      },
      'siteNarrator.statusNetwork': {
        en: [
          '%VOICE% runs over the network and goes quiet offline.',
          '%VOICE% runs over the network and goes quiet offline.',
          '%VOICE% is a network voice, so it goes quiet whenever this computer is offline.',
          '%VOICE% runs over the network rather than on this machine, so this track goes quiet whenever the connection drops.',
          '%VOICE% phones home over the network to speak, so the instant the connection drops, this track goes quiet along with it.'
        ],
        zh: [
          '%VOICE% 係靠網絡運作，離線就會靜。',
          '%VOICE% 係靠網絡運作，離線就會靜。',
          '%VOICE% 係網絡聲，呢部機一離線就會靜。',
          '%VOICE% 唔係喺呢部機做嘢，係靠網絡，所以斷咗網呢個聲道就會靜。',
          '%VOICE% 講嘢都要靠上網先得，一斷網呢個聲道即刻同佢一齊靜晒。'
        ]
      },
      'siteNarrator.statusNetworkOffline': {
        en: [
          '%VOICE% runs over the network, and this browser is offline right now, so this track is silent.',
          '%VOICE% runs over the network, and this browser is offline right now, so this track is silent.',
          '%VOICE% is a network voice, and this browser is offline right now, so this track is silent until the connection returns.',
          '%VOICE% runs over the network rather than on this machine, and this browser is offline right now -- so this track is silent until the connection comes back.',
          '%VOICE% needs the network to speak, and this browser is offline this very moment, so this track is silent until the connection turns up again.'
        ],
        zh: [
          '%VOICE% 靠網絡運作，而呢個瀏覽器而家離線緊，所以呢個聲道係靜嘅。',
          '%VOICE% 靠網絡運作，而呢個瀏覽器而家離線緊，所以呢個聲道係靜嘅。',
          '%VOICE% 係網絡聲，而呢個瀏覽器而家冇網，所以呢個聲道靜住，等返網先算。',
          '%VOICE% 唔係喺呢部機度做嘢，要靠網絡，而呢個瀏覽器而家正正係離線緊，所以呢個聲道會靜到有網為止。',
          '%VOICE% 講嘢要靠上網，而呢個瀏覽器而家正正冇網，所以呢個聲道會一路靜，靜到網翻返嚟為止。'
        ]
      },

      'siteNarrator.categoriesTitle': same('What gets spoken', '幾時先出聲'),
      'siteNarrator.categoriesExplain': {
        en: [
          'Each kind of notification has its own switch and its own minimum gap between two of the same kind, so one burst of activity does not become a wall of speech. Exactly one line is spoken at a time; a new line of the same kind replaces one that is still waiting rather than queueing behind it.',
          'Each kind of notification has its own switch and its own minimum gap between two of the same kind, so one burst of activity does not become a wall of speech. Exactly one line is spoken at a time; a new line of the same kind replaces one that is still waiting rather than queueing behind it.',
          'Each kind of notification has its own switch and its own minimum gap between two of the same kind, so a burst of activity never turns into a wall of speech. Only one line is ever spoken at a time, and a fresh line of the same kind replaces one still waiting rather than stacking up behind it.',
          'Each kind of notification carries its own switch and its own minimum gap between two of the same kind, so a burst of activity never turns into a wall of speech. Exactly one line is spoken at a time through a single queue; a fresh line of the same kind replaces whatever of that kind is still waiting, rather than stacking up behind it and being read out one by one after the fact.',
          'Each kind of notification gets its own switch and its own breathing room between two of the same kind, so a flurry of activity never turns into a wall of speech nobody asked for. Only one line is ever spoken at a time, and a fresh line of the same kind bumps whatever of that kind was still waiting rather than piling up behind it to be read out long after it mattered.'
        ],
        zh: [
          '每種通知都有自己嘅開關，同埋自己嘅最短間隔，所以一輪爆嘅通知唔會變成一大堆聲。同一時間淨係讀一句，新嚟嗰句如果同一種類就會頂替仲等緊嘅嗰句，唔會排隊等埋一齊讀。',
          '每種通知都有自己嘅開關，同埋自己嘅最短間隔，所以一輪爆嘅通知唔會變成一大堆聲。同一時間淨係讀一句，新嚟嗰句如果同一種類就會頂替仲等緊嘅嗰句，唔會排隊等埋一齊讀。',
          '每種通知都有自己嘅開關，同埋自己嘅最短間隔，一輪爆嘅通知唔會讀成一大堆聲。同一時間永遠淨係讀一句，新嚟嗰句同種類嘅話會頂替仲等緊嗰句，唔會排隊等埋一齊讀。',
          '每種通知有自己個開關，同埋自己嘅最短間隔，一輪爆嘅通知唔會炒成一大堆聲。同一時間實淨係讀一句，用一條隊排，新嚟嗰句同種類嘅話會頂替仲等緊嗰句，唔會排晒隊之後一句一句咁讀返晒出嚟。',
          '每種通知有自己個開關，同埋自己嘅休息時間，一輪爆嘅通知先至唔會變成無人想聽嘅一大堆聲。同一時間實淨係讀一句，新嚟嗰句同種類嘅話會即刻頂替仲等緊嗰句，唔會排晒隊之後過咗鐘先一句一句讀返出嚟。'
        ]
      },
      'siteNarrator.catError': same('Speak failures', '讀出失敗'),
      'siteNarrator.catErrorExplain': {
        en: [
          'A failure this site raises. Never held back by the wait or the gap other kinds respect, and interrupts whatever is currently speaking.',
          'A failure this site raises. Never held back by the wait or the gap other kinds respect, and interrupts whatever is currently speaking.',
          'A failure this site raises. It skips the wait and the gap the other kinds respect, and it interrupts whatever is speaking right now to be heard immediately.',
          'A failure this site raises. Unlike every other kind here it skips both the wait and the minimum gap, and it interrupts whatever ordinary line is currently speaking so it is heard right away -- the one deliberate exception to "infrequent".',
          'A failure this site raises. It ignores the wait, ignores the minimum gap, and barges straight over whatever ordinary line is speaking to make sure it gets heard -- the one deliberate exception to keeping this narrator quiet.'
        ],
        zh: [
          '呢個網站彈出嘅失敗通知。唔會俾等候時間或者間隔卡住，仲會打斷而家講緊嘅嘢。',
          '呢個網站彈出嘅失敗通知。唔會俾等候時間或者間隔卡住，仲會打斷而家講緊嘅嘢。',
          '呢個網站彈出嘅失敗通知。唔使等，唔使睇間隔，仲會打斷而家講緊嘅嘢即刻插隊講。',
          '呢個網站彈出嘅失敗通知。同其他種類唔同，佢唔使等亦唔理最短間隔，仲會打斷而家講緊嘅嘢即刻插隊——係「盡量少講嘢」呢條規則唯一嘅例外。',
          '呢個網站彈出嘅失敗通知。唔等、唔理間隔，直接打斷而家講緊嘅嘢插隊講，確保你一定聽到——係呢個讀出功能想盡量靜嘅唯一例外。'
        ]
      },
      'siteNarrator.catWarn': same('Speak warnings', '讀出警告'),
      'siteNarrator.catSuccess': same('Speak completions', '讀出完成'),
      'siteNarrator.catInfo': same('Speak notices', '讀出提示'),
      'siteNarrator.catNoteWarn': {
        en: [
          'A warning this site raises. Waits at least 8 seconds after the last one of its kind.',
          'A warning this site raises. Waits at least 8 seconds after the last one of its kind.',
          'A warning this site raises. It waits at least 8 seconds since the last warning before it speaks again.',
          'A warning this site raises. It waits at least 8 seconds since the last warning of its own kind before speaking again, so a flurry of warnings becomes one spoken line rather than several.',
          'A warning this site raises. It sits out at least 8 seconds after the last warning of its own kind before opening its mouth again, so a flurry of them collapses into one spoken line, not several.'
        ],
        zh: [
          '呢個網站彈出嘅警告通知。上一個同類警告最少要隔 8 秒先會再講。',
          '呢個網站彈出嘅警告通知。上一個同類警告最少要隔 8 秒先會再講。',
          '呢個網站彈出嘅警告通知。同上一個同類警告最少要隔 8 秒先再講。',
          '呢個網站彈出嘅警告通知。同上一個同類警告最少要隔 8 秒先再開聲，所以一輪爆嘅警告最後淨係讀一句，唔係逐個逐個讀。',
          '呢個網站彈出嘅警告通知。同上一個同類警告最少要坐定 8 秒先再開口，一輪爆嘅警告最後就縮成一句嚟讀，唔係逐個逐個吟。'
        ]
      },
      'siteNarrator.catNoteSuccess': {
        en: [
          'A completion this site raises. Waits at least 8 seconds after the last one of its kind.',
          'A completion this site raises. Waits at least 8 seconds after the last one of its kind.',
          'A completion this site raises. It waits at least 8 seconds since the last completion before it speaks again.',
          'A completion this site raises. It waits at least 8 seconds since the last completion of its own kind before speaking again, so several finishing in a row become one spoken line.',
          'A completion this site raises. It sits out at least 8 seconds after the last completion of its own kind before saying anything more, so a run of them collapses into one line, not a chorus.'
        ],
        zh: [
          '呢個網站彈出嘅完成通知。上一個同類完成最少要隔 8 秒先會再講。',
          '呢個網站彈出嘅完成通知。上一個同類完成最少要隔 8 秒先會再講。',
          '呢個網站彈出嘅完成通知。同上一個同類完成最少要隔 8 秒先再講。',
          '呢個網站彈出嘅完成通知。同上一個同類完成最少要隔 8 秒先再開聲，一連串完成最後淨係讀一句。',
          '呢個網站彈出嘅完成通知。同上一個同類完成最少要坐定 8 秒先再出聲，一輪接一輪嘅完成最後縮成一句，唔會變合唱團。'
        ]
      },
      'siteNarrator.catNoteInfo': {
        en: [
          'An ordinary notice this site raises. Off by default; waits at least 12 seconds after the last one of its kind.',
          'An ordinary notice this site raises. Off by default; waits at least 12 seconds after the last one of its kind.',
          'An ordinary notice this site raises. Off by default, and it waits at least 12 seconds since the last notice before speaking again.',
          'An ordinary notice this site raises. Off by default, because most of them are not worth interrupting anything for, and it waits at least 12 seconds since the last notice of its own kind before speaking again.',
          'An ordinary notice this site raises. Off by default, because frankly most of them are not worth stopping what you are doing for, and it sits out at least 12 seconds after the last notice of its own kind before opening its mouth again.'
        ],
        zh: [
          '呢個網站彈出嘅一般提示。預設係關嘅；上一個同類提示最少要隔 12 秒先會再講。',
          '呢個網站彈出嘅一般提示。預設係關嘅；上一個同類提示最少要隔 12 秒先會再講。',
          '呢個網站彈出嘅一般提示。預設係關嘅，同上一個同類提示最少要隔 12 秒先再講。',
          '呢個網站彈出嘅一般提示。預設係關嘅，因為大部分都唔值得打斷你手頭上嘅嘢，同上一個同類提示最少要隔 12 秒先再開聲。',
          '呢個網站彈出嘅一般提示。預設係關嘅，講真大部分都唔值得為咗佢停低手上嘅嘢，同上一個同類提示最少要坐定 12 秒先再開口。'
        ]
      },

      'siteNarrator.tryTitle': same('Hear it before you commit to it', '未開之前先聽下'),
      'siteNarrator.tryExplain': {
        en: [
          'These three buttons speak the same three sample messages regardless of whether the master switch above is on.',
          'These three buttons speak the same three sample messages regardless of whether the master switch above is on.',
          'These three buttons speak the same three sample messages, and work whether or not the master switch above is on.',
          'These three buttons speak the same three sample messages this site uses to preview the funny level, and they work whether or not the master switch above is on -- so the current language, voices, rate and pitch can be checked before anything is actually turned on.',
          'These three buttons read out the same three sample lines this site already uses to preview the funny level, and they work no matter what the master switch above is set to -- so the current language, voices, rate and pitch can all be tried out before committing to anything.'
        ],
        zh: [
          '呢三粒掣會讀出三句樣本訊息，就算上面總開關未開都得。',
          '呢三粒掣會讀出三句樣本訊息，就算上面總開關未開都得。',
          '呢三粒掣會讀出三句樣本訊息，唔理上面總開關開定未開都得。',
          '呢三粒掣會讀出網站本身用嚟試搞笑級別嘅三句樣本訊息，唔理上面總開關開咗未都用得——即係開之前都可以試下而家嘅語言、把聲、語速同音調。',
          '呢三粒掣會讀出網站本身試搞笑級別用嗰三句樣本訊息，唔理上面總開關開定未都照用——即係未開之前，語言、把聲、語速同音調全部都可以試玩晒先。'
        ]
      },
      'siteNarrator.trySuccess': same('Speak the saved-settings message', '讀出「設定已儲存」'),
      'siteNarrator.tryWarn': same('Speak the skipped-rows message', '讀出「跳過咗幾行」'),
      'siteNarrator.tryError': same('Speak the refused-file message', '讀出「檔案被拒絕」'),
      'siteNarrator.silenceNow': same('Silence now', '即刻收聲'),
      'siteNarrator.silenceExplain': {
        en: [
          'Stops whatever is speaking right now and clears anything waiting to speak next.',
          'Stops whatever is speaking right now and clears anything waiting to speak next.',
          'Stops whatever is speaking this instant, and clears out anything queued behind it.',
          'Stops whatever is speaking this instant and clears out anything queued behind it, so a screen reader -- or a quiet room -- gets its silence back straight away.',
          'Shuts this narrator up this instant, mid-word if need be, and empties whatever was queued behind it -- because a screen reader, or just a quiet room, should never have to wait its turn.'
        ],
        zh: [
          '即刻停低而家講緊嘅嘢，仲會清埋所有排緊隊等講嘅嘢。',
          '即刻停低而家講緊嘅嘢，仲會清埋所有排緊隊等講嘅嘢。',
          '即刻停低而家講緊嘅嘢，順便清埋後面排緊隊嘅嘢。',
          '即刻停低而家講緊嘅嘢，順便清埋後面排緊隊嘅嘢，等螢幕閱讀器或者靜靜嘅房間即刻攞返靜返嚟。',
          '即刻叫呢個讀出功能收聲，講到一半都照叫佢收，順便清哂後面排緊隊嘅嘢——螢幕閱讀器又好，鍾意靜嘅房間又好，都唔應該要排隊等靜。'
        ]
      },
      'siteNarrator.speakingNow': same('Speaking now.', '講緊嘢。'),
      'siteNarrator.quietNow': same('Quiet.', '靜緊。'),

      'siteNarrator.sample.success': {
        en: [
          'Your settings were saved in this browser.',
          'Your settings were saved in this browser.',
          'Saved. Your settings are in this browser.',
          'Saved. Your settings are sitting in this browser and nowhere else.',
          'Saved. Your settings are sitting in this browser and nowhere else, which is exactly as far as they were ever going.'
        ],
        zh: [
          '你嘅設定已儲存喺呢個瀏覽器。',
          '你嘅設定已儲存喺呢個瀏覽器。',
          '搞掂，你嘅設定喺呢個瀏覽器度。',
          '搞掂，你嘅設定就坐喺呢個瀏覽器，第二度一份都無。',
          '搞掂，你嘅設定就坐喺呢個瀏覽器，第二度一份都無，佢哋本來就淨係去到咁遠。'
        ]
      },
      'siteNarrator.sample.warn': {
        en: [
          '3 of the 12 rows were skipped because they had no coordinates.',
          '3 of the 12 rows were skipped because they had no coordinates.',
          '3 of the 12 rows were skipped: they had no coordinates.',
          '3 of the 12 rows were skipped, because they arrived with no coordinates at all.',
          '3 of the 12 rows were skipped, because they turned up with no coordinates whatsoever and nobody could guess where they meant.'
        ],
        zh: [
          '12 行入面有 3 行因為無座標而略過咗。',
          '12 行入面有 3 行因為無座標而略過咗。',
          '12 行入面 3 行略過咗：佢哋無座標。',
          '12 行入面 3 行略過咗，因為佢哋嚟到嗰陣連座標都無。',
          '12 行入面 3 行略過咗，因為佢哋嚟到嗰陣連一個座標都無，無人估到佢哋想講邊度。'
        ]
      },
      'siteNarrator.sample.error': {
        en: [
          'The file was refused: it is 90,000 bytes and the limit is 65,536 bytes.',
          'The file was refused: it is 90,000 bytes and the limit is 65,536 bytes.',
          'The file was refused: it is 90,000 bytes, and the limit is 65,536 bytes.',
          'The file was refused. It is 90,000 bytes and the limit is 65,536 bytes, so nothing was loaded.',
          'The file was refused. It is 90,000 bytes and the limit is 65,536 bytes, so not one byte of it was loaded.'
        ],
        zh: [
          '檔案被拒絕：佢有 90,000 位元組，上限係 65,536 位元組。',
          '檔案被拒絕：佢有 90,000 位元組，上限係 65,536 位元組。',
          '檔案唔收：佢 90,000 位元組，上限 65,536 位元組。',
          '檔案唔收。佢有 90,000 位元組，上限係 65,536 位元組，所以乜都無載入。',
          '檔案唔收。佢有 90,000 位元組，上限係 65,536 位元組，所以連一個位元組都無載入到。'
        ]
      },

      'siteNarrator.screenReaderNote': {
        en: [
          'Browsers give a page no way to detect whether a screen reader is running, so this narrator cannot politely wait its turn behind one -- it can only warn about the overlap and stay off until asked. Every status this site shows already has an accessible name or an announcement of its own; turning this off loses no information, only the second voice.',
          'Browsers give a page no way to detect whether a screen reader is running, so this narrator cannot politely wait its turn behind one -- it can only warn about the overlap and stay off until asked. Every status this site shows already has an accessible name or an announcement of its own; turning this off loses no information, only the second voice.',
          'Browsers give a page no way to detect whether a screen reader is running, so this narrator cannot politely take turns with one -- it can only say so plainly and stay off unless asked. Every status this site shows already carries its own accessible name or announcement, so leaving this off loses no information, just the second voice.',
          'Browsers deliberately give a page no API to detect whether a screen reader is active, so this narrator has no way to politely take turns with one the way it can with rate limits or cooldowns -- it can only disclose the overlap plainly and stay off unless deliberately asked for. Every status and notification on this site already carries its own accessible name or `aria-live` announcement, so switching this off costs no information, only the second voice.',
          'Browsers deliberately give a page no way at all to notice a screen reader running alongside it, so this narrator cannot politely take turns the way it manages rate limits and cooldowns for itself -- the honest move is to say so plainly and leave it off unless it is deliberately switched on. Every status and notification here already speaks for itself through an accessible name or an `aria-live` announcement, so switching this off costs nothing but the second voice.'
        ],
        zh: [
          '瀏覽器根本冇辦法俾網頁知道有冇螢幕閱讀器開緊，所以呢個讀出功能冇辦法禮貌噉排隊等佢——淨係可以講明呢個問題，然後喺未撳開之前一路收聲。呢個網站每個狀態都本身已經有可讀名稱或者通知，所以關咗呢個功能一啲資訊都唔會少，淨係少咗第二把聲。',
          '瀏覽器根本冇辦法俾網頁知道有冇螢幕閱讀器開緊，所以呢個讀出功能冇辦法禮貌噉排隊等佢——淨係可以講明呢個問題，然後喺未撳開之前一路收聲。呢個網站每個狀態都本身已經有可讀名稱或者通知，所以關咗呢個功能一啲資訊都唔會少，淨係少咗第二把聲。',
          '瀏覽器根本冇辦法俾網頁知道有冇螢幕閱讀器開緊，所以呢個讀出功能冇得禮貌噉輪流講——淨係可以老實講明有呢個問題，然後未撳開就一路唔出聲。呢個網站每個狀態本身都有可讀名稱或者通知，關咗一啲資訊都唔會少，淨係少咗第二把聲。',
          '瀏覽器故意唔畀網頁知道有冇螢幕閱讀器開緊，所以呢個讀出功能冇辦法好似處理間隔咁樣禮貌噉輪流講——淨係可以坦白講明呢個重疊嘅問題，然後喺未刻意撳開之前一路收聲。呢個網站每個狀態同通知本身都有自己嘅可讀名稱或者 `aria-live` 通知，所以關咗呢個功能唔會少任何資訊，淨係少咗第二把聲。',
          '瀏覽器係刻意唔畀網頁知道有冇螢幕閱讀器一齊開緊，所以呢個讀出功能冇辦法好似自己管理間隔咁禮貌噉輪流講——老實嘅做法就係講明有呢件事，然後喺冇特登撳開之前一路收聲。呢度每個狀態同通知本身都已經識自己講嘢，靠可讀名稱或者 `aria-live` 通知，所以關咗呢個功能一啲資訊都唔會蝕底，淨係少咗第二把聲。'
        ]
      },
      'siteNarrator.quietBoundaryNote': {
        en: [
          'This browser exposes no "quiet" or "reduced sound" setting the way it exposes reduced motion, so there is nothing for this narrator to follow automatically. Deliberately not tied to reduced motion, either: speech is not animation, and silencing a narrator someone switched on because of a motion preference would be this site deciding it knows better. "Silence now" and the master switch are the two real controls.',
          'This browser exposes no "quiet" or "reduced sound" setting the way it exposes reduced motion, so there is nothing for this narrator to follow automatically. Deliberately not tied to reduced motion, either: speech is not animation, and silencing a narrator someone switched on because of a motion preference would be this site deciding it knows better. "Silence now" and the master switch are the two real controls.',
          'This browser exposes no "quiet" or "reduced sound" preference the way it exposes reduced motion, so there is nothing here for this narrator to follow automatically. It is deliberately not tied to reduced motion either -- speech is not animation, and silencing a narrator someone switched on because of a motion preference would be this site quietly deciding it knew better. "Silence now" and the master switch remain the two real controls.',
          'This browser gives no "quiet" or "reduced sound" media feature the way it gives reduced motion, so there is genuinely nothing standard for this narrator to follow on its own. It is deliberately not wired to reduced motion either: speech is not animation, and switching off a narrator someone turned on, purely because of a motion preference, would be this site quietly deciding it knew better than the person who asked for it. "Silence now" and the master switch stay the two real controls, and if a browser ever ships a genuine quiet-sound preference this narrator will follow it the same way it already follows reduced motion for everything else on this site.',
          'This browser hands this site no "quiet" or "reduced sound" signal the way it hands over reduced motion, so there is simply nothing standard here for the narrator to obey on its own initiative. And it is deliberately, stubbornly not wired to reduced motion either: speech is not a spinning animation, and muting a narrator someone deliberately turned on -- just because of an unrelated motion preference -- would be this site second-guessing the person who asked for it. "Silence now" and the master switch remain the two honest controls, and the day a browser ships a real quiet-sound preference, this narrator will follow it exactly the way the rest of this site already follows reduced motion.'
        ],
        zh: [
          '呢個瀏覽器冇好似「減少動態」咁嘅「靜」或者「減少聲音」設定，所以呢個讀出功能冇嘢可以自動跟。亦刻意冇綁住「減少動態」設定：講嘢唔係動畫，如果因為動態偏好就靜靜雞收咗人哋開緊嘅讀出功能，等於呢個網站自作聰明幫人決定。真正嘅控制淨係「即刻收聲」同總開關兩個。',
          '呢個瀏覽器冇好似「減少動態」咁嘅「靜」或者「減少聲音」設定，所以呢個讀出功能冇嘢可以自動跟。亦刻意冇綁住「減少動態」設定：講嘢唔係動畫，如果因為動態偏好就靜靜雞收咗人哋開緊嘅讀出功能，等於呢個網站自作聰明幫人決定。真正嘅控制淨係「即刻收聲」同總開關兩個。',
          '呢個瀏覽器冇好似「減少動態」咁樣嘅「靜」或者「減少聲音」偏好，所以呢個讀出功能真係冇嘢可以自己跟。亦刻意冇綁住「減少動態」：講嘢唔係動畫，如果純粹因為動態偏好就靜靜雞收咗人哋刻意開嘅讀出功能，即係呢個網站自作聰明話自己知得多啲。真正嘅控制一直都係「即刻收聲」同總開關兩個。',
          '呢個瀏覽器冇畀到好似「減少動態」咁嘅標準「靜」或者「減少聲音」設定，所以呢個讀出功能真係冇標準嘢可以自己跟。亦刻意冇接落「減少動態」度：講嘢唔係動畫，如果純粹因為一個動態偏好就靜靜雞收咗人哋刻意開嘅讀出功能，即係呢個網站自作聰明話自己知得比開嘅人多。「即刻收聲」同總開關一直係真正嘅兩個控制，如果日後瀏覽器真係出咗個「減少聲音」偏好，呢個讀出功能會好似而家跟「減少動態」咁樣去跟。',
          '呢個瀏覽器完全冇畀過呢個網站一個好似「減少動態」咁嘅「靜」或者「減少聲音」訊號，所以呢度真係冇標準嘢可以俾讀出功能自己主動跟。而且仲要死頑固噉刻意冇接落「減少動態」度：講嘢唔係轉緊圈嘅動畫，如果單單因為一個唔相關嘅動態偏好就靜靜雞收咗人哋刻意開嘅讀出功能，即係呢個網站質疑緊撳開佢嘅人。「即刻收聲」同總開關一直都係真正老實嘅兩個控制，如果有日瀏覽器真係出咗個真正嘅「減少聲音」偏好，呢個讀出功能實會好似而家跟「減少動態」咁樣跟足佢。'
        ]
      },
      'siteNarrator.storageNote': {
        en: [
          'Every choice on this page is stored in this browser only. Voices differ from device to device, so a voice chosen on one computer can show as not installed on another -- the choice is kept either way, per the notes above.',
          'Every choice on this page is stored in this browser only. Voices differ from device to device, so a voice chosen on one computer can show as not installed on another -- the choice is kept either way, per the notes above.',
          'Every choice on this page lives in this browser only. Voices differ between devices, so a voice chosen here can show up as not installed on a different computer -- the choice is kept regardless, exactly as the notes above describe.',
          'Every choice on this page lives in this browser only, never on a server and never synced to another device. Voices differ from machine to machine, so a voice chosen here can turn up as not installed on a different computer -- the choice is still kept, exactly as the status notes above describe, rather than silently reset.',
          'Every choice on this page lives in this browser and nowhere else -- no server, no account, no syncing to another device. Voices are a per-machine thing, so a voice chosen here can show up as missing entirely on a different computer -- and the choice is still kept regardless, exactly as the status notes above say, rather than being quietly wiped.'
        ],
        zh: [
          '呢版每個選擇都淨係存喺呢個瀏覽器。唔同機裝嘅聲會唔一樣，所以喺呢部機揀嘅聲，去到第二部機可能會顯示未裝——但係你揀嘅選擇一路都會保留，照返上面講嘅。',
          '呢版每個選擇都淨係存喺呢個瀏覽器。唔同機裝嘅聲會唔一樣，所以喺呢部機揀嘅聲，去到第二部機可能會顯示未裝——但係你揀嘅選擇一路都會保留，照返上面講嘅。',
          '呢版每個選擇都淨係存喺呢個瀏覽器。唔同機裝嘅聲唔一樣，喺呢部機揀嘅聲去到第二部機可能顯示未裝——但你揀嘅選擇照樣保留，照返上面講嘅噉。',
          '呢版每個選擇都淨係存喺呢個瀏覽器，唔會上伺服器，都唔會同步去第二部機。唔同機裝嘅聲唔一樣，喺呢部機揀嘅聲去到第二部機可能顯示未裝——但你揀嘅選擇照樣保留，照返上面狀態講嘅噉，唔會靜靜雞幫你重設。',
          '呢版每個選擇都淨係存喺呢個瀏覽器，第二度真係一份都無——冇伺服器、冇帳戶、都唔會同步去第二部機。裝咗邊啲聲係每部機自己嘅事，喺呢部機揀嘅聲去到第二部機分分鐘顯示完全未裝——但你揀嘅選擇一樣照樣保留，照返上面狀態講嘅，唔會靜靜雞幫你清咗。'
        ]
      }
    });

    /* ================================================================
     * 1. Small local helpers
     * ================================================================ */
    function clamp(n, lo, hi) {
      n = Number(n);
      if (isNaN(n)) n = lo;
      return n < lo ? lo : (n > hi ? hi : n);
    }
    function stripEmoji(text) {
      var s = String(text == null ? '' : text);
      try {
        return s.replace(/[\p{Extended_Pictographic}‍️]/gu, '').replace(/\s{2,}/g, ' ').trim();
      } catch (e) {
        /* Older engines without Unicode property escapes: a common-range
           fallback rather than leaving emoji in the spoken text. */
        return s.replace(/[←-⇿⌀-➿⬀-⯿\uD83C-\uDBFF][\uDC00-\uDFFF]?/g, '').trim();
      }
    }
    function tpl(key, fallback, subs) {
      var s = t(key, fallback);
      Object.keys(subs || {}).forEach(function (k) { s = s.split(k).join(subs[k]); });
      return s;
    }
    function ttsSupported() {
      return !!(window.speechSynthesis && window.SpeechSynthesisUtterance);
    }

    /* ================================================================
     * 2. Voice enumeration. speechSynthesis.getVoices() commonly answers
     * empty on the first call and fills in behind 'voiceschanged' a
     * moment later; some engines never fire that event reliably, so a
     * bounded poll backs it up. Subscribers are told every time the
     * list changes, however that happened.
     * ================================================================ */
    var voiceState = { list: [], settled: false };
    var voiceListeners = [];
    function onVoicesChanged(fn) {
      voiceListeners.push(fn);
      return function () { var i = voiceListeners.indexOf(fn); if (i >= 0) voiceListeners.splice(i, 1); };
    }
    function fireVoicesChanged() {
      voiceListeners.slice().forEach(function (fn) { try { fn(); } catch (e) { report(e); } });
    }
    function report(err) { if (window.console && window.console.error) window.console.error('[StudioNarrator]', err); }

    function refreshVoices() {
      if (!ttsSupported()) return;
      var list = [];
      try { list = window.speechSynthesis.getVoices() || []; } catch (e) { list = []; }
      voiceState.list = list;
      if (list.length) voiceState.settled = true;
      fireVoicesChanged();
    }
    var voiceEnumerationStarted = false;
    function ensureVoiceEnumeration() {
      if (voiceEnumerationStarted || !ttsSupported()) return;
      voiceEnumerationStarted = true;
      refreshVoices();
      try {
        if (window.speechSynthesis.addEventListener) window.speechSynthesis.addEventListener('voiceschanged', refreshVoices);
        else window.speechSynthesis.onvoiceschanged = refreshVoices;
      } catch (e) { /* some engines refuse the listener; the poll below still runs */ }
      var attempts = 0;
      var poller = window.setInterval(function () {
        attempts += 1;
        refreshVoices();
        if (voiceState.list.length || attempts >= 12) {
          window.clearInterval(poller);
          voiceState.settled = true;
          fireVoicesChanged();
        }
      }, 350);
    }

    function isEnglishVoice(v) { return /^en/i.test(String(v.lang || '')); }
    var YUE_PREFIXES = ['yue', 'zh-yue', 'zh-hk', 'zh-hant-hk'];
    function isCantoneseVoice(v) {
      var lang = String(v.lang || '').toLowerCase().replace(/_/g, '-');
      for (var i = 0; i < YUE_PREFIXES.length; i++) {
        var p = YUE_PREFIXES[i];
        if (lang === p || lang.indexOf(p + '-') === 0) return true;
      }
      return false;
    }
    function voicesFor(code) {
      return voiceState.list.filter(code === 'zh' ? isCantoneseVoice : isEnglishVoice);
    }
    function autoVoiceFor(code) {
      var list = voicesFor(code);
      if (!list.length) return null;
      for (var i = 0; i < list.length; i++) if (list[i].default) return list[i];
      return list[0];
    }
    function resolveVoice(code) {
      var storedURI = store.get('narrator.voice.' + code, null);
      var list = voicesFor(code);
      if (storedURI) {
        for (var i = 0; i < list.length; i++) {
          if (list[i].voiceURI === storedURI) return { voice: list[i], state: 'chosen' };
        }
        var fb = autoVoiceFor(code);
        return { voice: fb, state: fb ? 'missingFallback' : 'missingSilent', storedURI: storedURI };
      }
      var auto = autoVoiceFor(code);
      return { voice: auto, state: auto ? 'auto' : 'none' };
    }
    function voiceLabel(v) { return v.name + ' (' + v.lang + ')'; }

    /* ================================================================
     * 3. Settings accessors. Storage is this browser's localStorage
     * under wds.narrator.*, per Studio.store -- there is no operating
     * system credential vault or per-app data folder for a static page
     * to use instead, and that substitution is disclosed on the panel.
     * ================================================================ */
    function enabled() { return store.get('narrator.enabled', false) === true; }
    function narratedLanguageStored() {
      var v = store.get('narrator.language', 'en');
      return (v === 'en' || v === 'zh' || v === 'both') ? v : 'en';
    }
    function narratedLanguage() {
      var stored = narratedLanguageStored();
      if (S.school.suppresses('cantonese') && stored !== 'en') return 'en';
      return stored;
    }
    var CATEGORY_DEFAULT = { error: true, warn: true, success: true, info: false };
    function categoryEnabled(cat) { return store.get('narrator.cat.' + cat, CATEGORY_DEFAULT[cat]) === true; }
    function rateFor(code) { return clamp(store.get('narrator.rate.' + code, 1), 0.1, 10); }
    function pitchFor(code) { return clamp(store.get('narrator.pitch.' + code, 1), 0, 2); }

    /* ================================================================
     * 4. The queue. A debounce collapses a burst of the same category
     * into its last line; a per-category cooldown holds ordinary lines
     * back; exactly one utterance speaks at a time; a failure ignores
     * both, jumps the queue and interrupts whatever is speaking.
     * ================================================================ */
    var COOLDOWN_MS = { error: 0, warn: 8000, success: 8000, info: 12000 };
    var DEBOUNCE_MS = 650;
    var MAX_QUEUE = 6;
    var debounceTimers = {};
    var lastSpokenAt = {};
    var queue = [];
    var speaking = false;
    var speakingListeners = [];
    function onSpeakingChange(fn) {
      speakingListeners.push(fn);
      return function () { var i = speakingListeners.indexOf(fn); if (i >= 0) speakingListeners.splice(i, 1); };
    }
    function fireSpeakingChange() {
      speakingListeners.slice().forEach(function (fn) { try { fn(speaking); } catch (e) { report(e); } });
    }

    function speakSequence(text, langMode, done) {
      if (!ttsSupported()) { done(); return; }
      var jobs = langMode === 'both' ? ['en', 'zh'] : [langMode];
      var i = 0;
      function next() {
        if (i >= jobs.length) { done(); return; }
        var code = jobs[i]; i += 1;
        var resolved = resolveVoice(code);
        if (!resolved.voice) { next(); return; }
        try {
          var utter = new window.SpeechSynthesisUtterance(stripEmoji(text));
          utter.voice = resolved.voice;
          utter.lang = resolved.voice.lang;
          utter.rate = rateFor(code);
          utter.pitch = pitchFor(code);
          utter.onend = next;
          utter.onerror = next;
          window.speechSynthesis.speak(utter);
        } catch (e) { report(e); next(); }
      }
      next();
    }

    function pump() {
      if (speaking) return;
      var item = queue.shift();
      if (!item) return;
      speaking = true; fireSpeakingChange();
      lastSpokenAt[item.category] = Date.now();
      speakSequence(item.text, narratedLanguage(), function () {
        speaking = false; fireSpeakingChange(); pump();
      });
    }
    function enqueue(category, text, urgent) {
      if (urgent) {
        queue.length = 0;
        Object.keys(debounceTimers).forEach(function (k) {
          if (debounceTimers[k]) { window.clearTimeout(debounceTimers[k]); debounceTimers[k] = null; }
        });
        if (ttsSupported()) { try { window.speechSynthesis.cancel(); } catch (e) {} }
        speaking = false;
      } else if (queue.length >= MAX_QUEUE) {
        queue.shift();
      }
      queue.push({ category: category, text: text, at: Date.now() });
      pump();
    }
    /* The narration engine proper: an "app event" arrives as (category,
       text). Gated by the master switch, the category switch and the
       category cooldown; a failure ignores the last two. */
    function speak(category, text) {
      if (!enabled() || !ttsSupported()) return;
      text = String(text || '').trim();
      if (!text) return;
      if (category === 'error') {
        if (debounceTimers[category]) { window.clearTimeout(debounceTimers[category]); debounceTimers[category] = null; }
        enqueue(category, text, true);
        return;
      }
      if (!categoryEnabled(category)) return;
      if (debounceTimers[category]) window.clearTimeout(debounceTimers[category]);
      debounceTimers[category] = window.setTimeout(function () {
        debounceTimers[category] = null;
        var now = Date.now();
        var gap = COOLDOWN_MS[category] || 0;
        var last = lastSpokenAt[category] || 0;
        if (gap && (now - last) < gap) return; /* suppressed by its own cooldown */
        enqueue(category, text, false);
      }, DEBOUNCE_MS);
    }
    /* An explicit, user-initiated preview. Bypasses the master switch
       (that is the whole point -- hear it before turning it on),
       bypasses the category switches and the cooldown, but is still
       exactly one utterance at a time: it cuts off whatever is already
       speaking rather than overlapping it. */
    function speakPreview(text) {
      if (!ttsSupported()) return;
      Object.keys(debounceTimers).forEach(function (k) {
        if (debounceTimers[k]) { window.clearTimeout(debounceTimers[k]); debounceTimers[k] = null; }
      });
      queue.length = 0;
      try { window.speechSynthesis.cancel(); } catch (e) {}
      speaking = true; fireSpeakingChange();
      speakSequence(String(text || ''), narratedLanguage(), function () {
        speaking = false; fireSpeakingChange();
      });
    }
    function silenceNow() {
      Object.keys(debounceTimers).forEach(function (k) {
        if (debounceTimers[k]) { window.clearTimeout(debounceTimers[k]); debounceTimers[k] = null; }
      });
      queue.length = 0;
      if (ttsSupported()) { try { window.speechSynthesis.cancel(); } catch (e) {} }
      if (speaking) { speaking = false; fireSpeakingChange(); }
    }

    /* ================================================================
     * 5. Wire the real site. Every toast this site raises via
     * Studio.notify is an "app event"; the narrator is nothing more
     * than an optional spoken channel layered on top of the same
     * events a visitor already sees. This is what makes the feature
     * actually about app events rather than about one settings page.
     * ================================================================ */
    S.on('notify', function (record) {
      if (!record) return;
      var category = (record.kind === 'error' || record.kind === 'warn' || record.kind === 'success') ? record.kind : 'info';
      var text = (record.title ? record.title + '. ' : '') + record.body;
      speak(category, text);
    });

    function setEnabled(v) {
      var next = !!v;
      var was = enabled();
      store.set('narrator.enabled', next);
      S.history.record('settings', next ? 'Spoken narrator turned on' : 'Spoken narrator turned off', { 'narrator.enabled': next });
      if (!next) silenceNow();
      if (was !== next) {
        if (next) S.notify.success(t('siteNarrator.turnedOn', 'Spoken narrator turned on.'));
        else S.notify.info(t('siteNarrator.turnedOff', 'Spoken narrator turned off.'));
      }
    }
    function setLanguage(v) {
      var next = (v === 'en' || v === 'zh' || v === 'both') ? v : 'en';
      store.set('narrator.language', next);
      S.history.record('settings', 'Narrator language set to ' + next, { 'narrator.language': next });
    }
    function setVoiceChoice(code, value, displayName) {
      if (!value || value === 'auto') {
        store.remove('narrator.voice.' + code);
        store.remove('narrator.voice.' + code + '.name');
      } else {
        store.set('narrator.voice.' + code, value);
        if (displayName) store.set('narrator.voice.' + code + '.name', displayName);
      }
      S.history.record('settings', 'Narrator ' + (code === 'en' ? 'English' : 'Cantonese') + ' voice set to ' +
        (!value || value === 'auto' ? 'automatic' : (displayName || value)), { key: 'narrator.voice.' + code });
    }
    function setRate(code, v) {
      var next = clamp(v, 0.1, 10);
      store.set('narrator.rate.' + code, next);
      S.history.record('settings', 'Narrator ' + (code === 'en' ? 'English' : 'Cantonese') + ' rate set to ' + next, { key: 'narrator.rate.' + code });
    }
    function setPitch(code, v) {
      var next = clamp(v, 0, 2);
      store.set('narrator.pitch.' + code, next);
      S.history.record('settings', 'Narrator ' + (code === 'en' ? 'English' : 'Cantonese') + ' pitch set to ' + next, { key: 'narrator.pitch.' + code });
    }
    function setCategory(cat, v) {
      var next = !!v;
      store.set('narrator.cat.' + cat, next);
      S.history.record('settings', 'Narrator category "' + cat + '" ' + (next ? 'turned on' : 'turned off'), { key: 'narrator.cat.' + cat });
    }

    ensureVoiceEnumeration();

    /* ================================================================
     * 6. The settings panel. Built entirely from Studio.settingRow /
     * Studio.makeSwitch / Studio.makeSlider / Studio.createSelect, so
     * every row already carries appearance-editing, the lock wizard,
     * the reset action and provenance -- the same contract every other
     * setting on this site carries -- with no extra code written here.
     * ================================================================ */
    var SEARCH_ROWS = []; /* kept for StudioNarrator.searchEntries(), see the hook note below */
    var paletteRegisteredOnce = false;

    function row(container, tabId, spec) {
      var control = spec.control();
      var wrap = S.settingRow({
        id: spec.id, label: spec.label, secondary: spec.secondary || '',
        explain: spec.explain, storageKey: spec.storageKey || null,
        shippedValue: spec.shippedValue, control: control, onReset: spec.onReset || null
      });
      container.appendChild(wrap);

      SEARCH_ROWS.push({
        id: spec.id, tabId: tabId, label: spec.label, explain: spec.explain,
        keywords: spec.keywords || '', value: spec.value || function () { return ''; }
      });

      if (!paletteRegisteredOnce) {
        /* Registered once per row id, the first time this section is
           ever mounted -- see StudioNarrator.mount(). Studio.palette
           has no de-duplication of its own, so a module that called
           register() on every rebuild would grow a duplicate row per
           language switch; this module never does. */
      }
      return { el: wrap, id: spec.id, label: spec.label, keywords: spec.keywords || '', tabId: tabId };
    }

    function buildPanel(opts) {
      opts = opts || {};
      var page = opts.page || 'settings.html';
      var tabStrip = opts.tabStrip || null;
      var tabId = opts.tabId || 'narrator';
      var registered = [];

      var host = el('div', { class: 'stack', style: { gap: '20px', 'min-width': '0' } });

      if (!ttsSupported()) {
        var note = el('div', { class: 'note note--warn' });
        S.label(note, 'siteNarrator.unsupported', 'This browser cannot speak text aloud.');
        host.appendChild(el('h2', { class: 't-title-medium', text: t('siteNarrator.title', 'Spoken narrator') }));
        host.appendChild(note);
        host.appendChild(el('p', { class: 'note--plain', text: t('siteNarrator.storageNote', '') }));
        return { el: host, destroy: function () {}, registered: registered };
      }

      var title = el('h2', { class: 't-title-medium' });
      S.label(title, 'siteNarrator.title', 'Spoken narrator');
      var lede = el('p', { class: 'muted' });
      S.label(lede, 'siteNarrator.lede', '');
      host.appendChild(title);
      host.appendChild(lede);

      var mainRows = el('div', { class: 'stack', style: { gap: '20px' } });

      /* -- 6a. Master switch ------------------------------------- */
      registered.push(row(mainRows, tabId, {
        id: 'narrator.enable',
        label: t('siteNarrator.enableLabel', "Speak this site's notifications aloud"),
        explain: t('siteNarrator.enableExplain', ''),
        storageKey: 'narrator.enabled', shippedValue: false,
        keywords: 'narrator speech speak read aloud tts text to speech accessibility voice',
        value: function () { return enabled() ? 'on' : 'off'; },
        onReset: function () { setEnabled(false); },
        control: function () {
          return S.makeSwitch({
            checked: enabled(),
            ariaLabel: t('siteNarrator.enableLabel', "Speak this site's notifications aloud"),
            onChange: function (v) { setEnabled(v); }
          });
        }
      }));

      /* -- 6b. Narrated language ----------------------------------- */
      var langOptions = [{ value: 'en', label: t('siteNarrator.optEnglish', 'English only'), keywords: 'english' }];
      if (!S.school.suppresses('cantonese')) {
        langOptions.push({ value: 'zh', label: t('siteNarrator.optCantonese', 'Cantonese only'), keywords: 'cantonese 廣東話' });
        langOptions.push({ value: 'both', label: t('siteNarrator.optBoth', 'Both, English then Cantonese'), keywords: 'both bilingual serialized' });
      }
      registered.push(row(mainRows, tabId, {
        id: 'narrator.language',
        label: t('siteNarrator.languageLabel', 'Narrated language'),
        explain: t('siteNarrator.languageExplain', ''),
        storageKey: 'narrator.language', shippedValue: 'en',
        keywords: 'language english cantonese both serialized narrator',
        value: function () { return narratedLanguageStored(); },
        onReset: function () { setLanguage('en'); },
        control: function () {
          return S.createSelect({
            ariaLabel: t('siteNarrator.languageLabel', 'Narrated language'), storageKey: 'narrator-language',
            value: narratedLanguageStored(), options: langOptions,
            onChange: function (v) { setLanguage(v); }
          }).el;
        }
      }));

      /* -- 6c. Voice pickers, one per narrated language ------------ */
      function buildVoiceBlock(code, sectionKey, explainKey) {
        var sectionTitle = el('h3', { class: 't-title-small' });
        S.label(sectionTitle, sectionKey, code === 'en' ? 'English voice' : 'Cantonese voice');
        mainRows.appendChild(sectionTitle);

        var status = el('p', { class: 'row t-body-small', style: { gap: '6px', 'align-items': 'flex-start' } });
        function paintStatus() {
          clear(status);
          if (!voiceState.settled && !voicesFor(code).length) {
            status.appendChild(icon('info', 'i--sm'));
            status.appendChild(el('span', { text: t('siteNarrator.statusLoading', 'Still asking this browser which voices it has installed.') }));
            return;
          }
          var resolved = resolveVoice(code);
          var langWord = code === 'en' ? t('lang.en', 'English') : t('lang.zh', 'Cantonese');
          if (resolved.state === 'none') {
            status.appendChild(icon('warn', 'i--sm'));
            status.appendChild(el('span', { text: tpl('siteNarrator.statusNone', '', { '%LANG%': langWord }) }));
            return;
          }
          if (resolved.state === 'missingSilent') {
            status.appendChild(icon('warn', 'i--sm'));
            status.appendChild(el('span', { text: tpl('siteNarrator.statusNotInstalledNoFallback', '', { '%LANG%': langWord }) }));
            return;
          }
          var voiceName = voiceLabel(resolved.voice);
          if (resolved.state === 'missingFallback') {
            status.appendChild(icon('warn', 'i--sm'));
            status.appendChild(el('span', { text: tpl('siteNarrator.statusNotInstalledFallback', '', { '%VOICE%': voiceName }) }));
            return;
          }
          if (resolved.voice.localService === false) {
            var online = !window.navigator || window.navigator.onLine !== false;
            status.appendChild(icon(online ? 'info' : 'warn', 'i--sm'));
            status.appendChild(el('span', {
              text: online
                ? tpl('siteNarrator.statusNetwork', '', { '%VOICE%': voiceName })
                : tpl('siteNarrator.statusNetworkOffline', '', { '%VOICE%': voiceName })
            }));
            return;
          }
          status.appendChild(icon('success', 'i--sm'));
          status.appendChild(el('span', {
            text: resolved.state === 'auto'
              ? tpl('siteNarrator.statusAuto', '', { '%VOICE%': voiceName, '%LANG%': langWord })
              : tpl('siteNarrator.statusChosen', '', { '%VOICE%': voiceName })
          }));
        }

        var sel = null;
        registered.push(row(mainRows, tabId, {
          id: 'narrator.voice.' + code,
          label: t(sectionKey, code === 'en' ? 'English voice' : 'Cantonese voice'),
          explain: t(explainKey, ''),
          storageKey: 'narrator.voice.' + code, shippedValue: 'auto',
          keywords: 'voice picker ' + (code === 'en' ? 'english' : 'cantonese yue zh-hk'),
          value: function () { return store.get('narrator.voice.' + code, null) || 'auto'; },
          onReset: function () { setVoiceChoice(code, null); sel.setValue('auto'); paintStatus(); },
          control: function () {
            var stored = store.get('narrator.voice.' + code, null);
            var storedName = store.get('narrator.voice.' + code + '.name', null);
            var options = [{ value: 'auto', label: t('siteNarrator.voiceAuto', 'Choose automatically'), keywords: 'automatic default' }];
            var seen = Object.create(null);
            voicesFor(code).forEach(function (v) {
              options.push({ value: v.voiceURI, label: voiceLabel(v), keywords: v.lang + ' ' + v.name });
              seen[v.voiceURI] = true;
            });
            if (stored && !seen[stored]) {
              options.push({
                value: stored,
                label: (storedName || stored) + ' — ' + t('siteNarrator.notInstalledShort', 'not installed here'),
                keywords: 'missing not installed'
              });
            }
            sel = S.createSelect({
              ariaLabel: t(sectionKey, code === 'en' ? 'English voice' : 'Cantonese voice'),
              storageKey: 'narrator-voice-' + code,
              value: stored || 'auto', options: options,
              onChange: function (v, opt) {
                setVoiceChoice(code, v, opt ? (opt.label.split(' — ')[0]) : null);
                paintStatus();
              }
            });
            return sel.el;
          }
        }));
        mainRows.appendChild(status);
        paintStatus();
        var offVoices = onVoicesChanged(function () {
          if (sel) {
            var stored = store.get('narrator.voice.' + code, null);
            var storedName = store.get('narrator.voice.' + code + '.name', null);
            var options = [{ value: 'auto', label: t('siteNarrator.voiceAuto', 'Choose automatically'), keywords: 'automatic default' }];
            var seen = Object.create(null);
            voicesFor(code).forEach(function (v) {
              options.push({ value: v.voiceURI, label: voiceLabel(v), keywords: v.lang + ' ' + v.name });
              seen[v.voiceURI] = true;
            });
            if (stored && !seen[stored]) {
              options.push({ value: stored, label: (storedName || stored) + ' — ' + t('siteNarrator.notInstalledShort', 'not installed here'), keywords: 'missing' });
            }
            sel.setOptions(options);
          }
          paintStatus();
        });

        registered.push(row(mainRows, tabId, {
          id: 'narrator.rate.' + code,
          label: t('siteNarrator.rateLabel', 'Speaking rate') + ' — ' + t(sectionKey, ''),
          explain: t(code === 'en' ? 'siteNarrator.rateExplainEn' : 'siteNarrator.rateExplainZh', ''),
          storageKey: 'narrator.rate.' + code, shippedValue: 1,
          keywords: 'rate speed ' + (code === 'en' ? 'english' : 'cantonese'),
          value: function () { return String(rateFor(code)) + 'x'; },
          onReset: function () { setRate(code, 1); },
          control: function () {
            return S.makeSlider({
              min: 0.1, max: 10, step: 0.1, value: rateFor(code),
              ariaLabel: t('siteNarrator.rateLabel', 'Speaking rate') + ' — ' + t(sectionKey, ''),
              format: function (v) { return Number(v).toFixed(1) + 'x'; },
              onChange: function (v) { setRate(code, v); }
            });
          }
        }));

        registered.push(row(mainRows, tabId, {
          id: 'narrator.pitch.' + code,
          label: t('siteNarrator.pitchLabel', 'Pitch') + ' — ' + t(sectionKey, ''),
          explain: t(code === 'en' ? 'siteNarrator.pitchExplainEn' : 'siteNarrator.pitchExplainZh', ''),
          storageKey: 'narrator.pitch.' + code, shippedValue: 1,
          keywords: 'pitch tone ' + (code === 'en' ? 'english' : 'cantonese'),
          value: function () { return Number(pitchFor(code)).toFixed(1); },
          onReset: function () { setPitch(code, 1); },
          control: function () {
            return S.makeSlider({
              min: 0, max: 2, step: 0.1, value: pitchFor(code),
              ariaLabel: t('siteNarrator.pitchLabel', 'Pitch') + ' — ' + t(sectionKey, ''),
              format: function (v) { return Number(v).toFixed(1); },
              onChange: function (v) { setPitch(code, v); }
            });
          }
        }));

        return offVoices;
      }

      var offVoicesEn = buildVoiceBlock('en', 'siteNarrator.voiceSectionEn', 'siteNarrator.voiceExplainEn');
      var offVoicesZh = null;
      if (!S.school.suppresses('cantonese')) {
        offVoicesZh = buildVoiceBlock('zh', 'siteNarrator.voiceSectionZh', 'siteNarrator.voiceExplainZh');
      }

      /* -- 6d. What gets spoken ------------------------------------- */
      var catTitle = el('h3', { class: 't-title-small' });
      S.label(catTitle, 'siteNarrator.categoriesTitle', 'What gets spoken');
      mainRows.appendChild(catTitle);
      var catExplain = el('p', { class: 'muted' });
      S.label(catExplain, 'siteNarrator.categoriesExplain', '');
      mainRows.appendChild(catExplain);

      [
        { cat: 'error', labelKey: 'siteNarrator.catError', explainKey: 'siteNarrator.catErrorExplain', fallback: 'Speak failures' },
        { cat: 'warn', labelKey: 'siteNarrator.catWarn', explainKey: 'siteNarrator.catNoteWarn', fallback: 'Speak warnings' },
        { cat: 'success', labelKey: 'siteNarrator.catSuccess', explainKey: 'siteNarrator.catNoteSuccess', fallback: 'Speak completions' },
        { cat: 'info', labelKey: 'siteNarrator.catInfo', explainKey: 'siteNarrator.catNoteInfo', fallback: 'Speak notices' }
      ].forEach(function (spec) {
        registered.push(row(mainRows, tabId, {
          id: 'narrator.cat.' + spec.cat,
          label: t(spec.labelKey, spec.fallback),
          explain: t(spec.explainKey, ''),
          storageKey: 'narrator.cat.' + spec.cat, shippedValue: CATEGORY_DEFAULT[spec.cat],
          keywords: 'category ' + spec.cat + ' notification cooldown',
          value: function () { return categoryEnabled(spec.cat) ? 'on' : 'off'; },
          onReset: function () { setCategory(spec.cat, CATEGORY_DEFAULT[spec.cat]); },
          control: function () {
            return S.makeSwitch({
              checked: categoryEnabled(spec.cat),
              ariaLabel: t(spec.labelKey, spec.fallback),
              onChange: function (v) { setCategory(spec.cat, v); }
            });
          }
        }));
      });

      host.appendChild(mainRows);

      /* -- 6e. Boundaries, said plainly ------------------------------ */
      var srNote = el('p', { class: 'note note--warn' });
      S.label(srNote, 'siteNarrator.screenReaderNote', '');
      host.appendChild(srNote);

      var quietNote = el('p', { class: 'muted' });
      S.label(quietNote, 'siteNarrator.quietBoundaryNote', '');
      host.appendChild(quietNote);

      var storageNote = el('p', { class: 'note--plain' });
      S.label(storageNote, 'siteNarrator.storageNote', '');
      host.appendChild(storageNote);

      /* -- 6f. Hear it before you commit to it ----------------------- */
      var tryHost = el('div', { class: 'stack', style: { gap: '12px' } });
      var tryLede = el('p', { class: 'muted' });
      S.label(tryLede, 'siteNarrator.tryExplain', '');
      tryHost.appendChild(tryLede);

      var speakingStatus = el('p', { class: 'row t-body-small', role: 'status', 'aria-live': 'polite', style: { gap: '6px' } }, [icon('info', 'i--sm'), el('span', { text: t('siteNarrator.quietNow', 'Quiet.') })]);
      function paintSpeakingStatus(isSpeaking) {
        clear(speakingStatus);
        speakingStatus.appendChild(icon(isSpeaking ? 'play' : 'info', 'i--sm'));
        speakingStatus.appendChild(el('span', { text: isSpeaking ? t('siteNarrator.speakingNow', 'Speaking now.') : t('siteNarrator.quietNow', 'Quiet.') }));
      }
      var offSpeaking = onSpeakingChange(paintSpeakingStatus);

      var tryButtons = el('div', { class: 'row', style: { gap: '8px', 'flex-wrap': 'wrap' } });
      [
        { key: 'trySuccess', cat: 'success', sampleKey: 'siteNarrator.sample.success', fallback: 'Your settings were saved in this browser.' },
        { key: 'tryWarn', cat: 'warn', sampleKey: 'siteNarrator.sample.warn', fallback: '3 of the 12 rows were skipped because they had no coordinates.' },
        { key: 'tryError', cat: 'error', sampleKey: 'siteNarrator.sample.error', fallback: 'The file was refused: it is 90,000 bytes and the limit is 65,536 bytes.' }
      ].forEach(function (b) {
        tryButtons.appendChild(el('button', {
          class: 'btn btn--outlined', type: 'button',
          onclick: function () { speakPreview(t(b.sampleKey, b.fallback)); }
        }, [icon('play'), el('span', { text: t('siteNarrator.' + b.key, b.fallback) })]));
      });
      tryButtons.appendChild(el('button', {
        class: 'btn btn--tonal', type: 'button',
        onclick: function () { silenceNow(); }
      }, [icon('stop'), el('span', { text: t('siteNarrator.silenceNow', 'Silence now') })]));

      tryHost.appendChild(tryButtons);
      var silenceExplain = el('p', { class: 'cap muted' });
      S.label(silenceExplain, 'siteNarrator.silenceExplain', '');
      tryHost.appendChild(silenceExplain);
      tryHost.appendChild(speakingStatus);

      var tryCollapseHost = el('div', {});
      tryCollapseHost.appendChild(tryHost);
      host.appendChild(tryCollapseHost);
      S.collapse.attach(tryCollapseHost, { title: t('siteNarrator.tryTitle', 'Hear it before you commit to it'), descriptive: true, storageKey: 'narrator-try' });

      /* -- 6g. Palette, once ever ------------------------------------ */
      if (!paletteRegisteredOnce) {
        paletteRegisteredOnce = true;
        S.palette.register(registered.map(function (r) {
          return {
            id: 'setting.' + r.id,
            title: r.label,
            subtitle: 'Settings',
            kind: 'setting',
            keywords: r.keywords,
            target: '[data-setting="' + r.id + '"]',
            tabStrip: tabStrip, tabId: r.tabId,
            control: null
          };
        }));
      }

      var destroyed = false;
      return {
        el: host,
        registered: registered,
        destroy: function () {
          if (destroyed) return;
          destroyed = true;
          if (offVoicesEn) offVoicesEn();
          if (offVoicesZh) offVoicesZh();
          offSpeaking();
        }
      };
    }

    /* ================================================================
     * 7. Public surface
     * ================================================================ */
    var activeMount = null;
    var StudioNarrator = {
      version: 1,

      /* Mount the full settings panel into `host` (an existing element
         that can hold block content). Safe to call again on a new host,
         or the same host, at any time -- automatically tears down the
         previous mount first, so a caller that rebuilds its own page on
         every language change (as this site's settings page does for
         its own tabs) can call this on every rebuild with no leak. */
      mount: function (host, opts) {
        if (activeMount) { try { activeMount.destroy(); } catch (e) { report(e); } activeMount = null; }
        clear(host);
        var built = buildPanel(opts);
        host.appendChild(built.el);
        activeMount = built;
        return built.destroy;
      },

      /* Rows in the exact shape a settings page's own search index
         already uses ({id, tabId, label, explain, keywords, value}), so
         the one page that owns settings.html's search bar can concat
         these into its own array with one line. Empty until mount() has
         run at least once. See the HOOK NEEDED note below. */
      searchEntries: function () { return SEARCH_ROWS.slice(); },

      /* The engine, exposed directly in case another module on this
         site wants to narrate an event of its own without going through
         a toast. Category is 'error' | 'warn' | 'success' | 'info'. */
      speak: speak,
      speakPreview: speakPreview,
      silenceNow: silenceNow,
      isSpeaking: function () { return speaking; },
      isEnabled: enabled,
      isSupported: ttsSupported,
      onSpeakingChange: onSpeakingChange,
      onVoicesChanged: onVoicesChanged,
      voicesFor: function (code) { return voicesFor(code).slice(); },
      resolveVoice: resolveVoice
    };

    window.StudioNarrator = StudioNarrator;
  }

  /* ================================================================
   * HOOK NEEDED in site/settings.html (not made here -- that file is
   * owned by another agent and this module must not edit it):
   *
   *   1. Add one entry to the TABS array, e.g.
   *        { id: 'narrator', labelKey: 'tab.narrator', icon: 'text',
   *          keywords: 'speech voice tts speak read aloud accessibility' }
   *      and one 'tab.narrator' i18n key ("Narrator" / "有聲讀出").
   *
   *   2. Add a BUILDERS['narrator'] entry that calls this module:
   *        BUILDERS.narrator = function (panel) {
   *          if (window.StudioNarrator) {
   *            window.StudioNarrator.mount(panel, {
   *              page: 'settings.html', tabStrip: 'settings', tabId: 'narrator'
   *            });
   *          }
   *        };
   *      settings.html already clears and rebuilds every tab panel on
   *      every language/School-mode change (see its own render()), so
   *      no extra reactivity is needed here -- mount() is safe to call
   *      on every rebuild.
   *
   *   3. Splice this module's rows into the page's own settings search
   *      index so "Speak this site's notifications aloud" is findable
   *      from the page's own search bar, not only the command palette:
   *        Array.prototype.push.apply(searchIndex, window.StudioNarrator.searchEntries());
   *      (searchEntries() returns [] until mount() has run once, so
   *      call it after step 2's BUILDERS call, not before.)
   *
   *   4. Add <script defer src="assets/narrator.js"></script> to
   *      settings.html, after assets/site.js.
   *
   * Until that hook lands, the narration ENGINE still works on any page
   * that includes this script (it listens to Studio.notify and speaks
   * on request), but there is nowhere on this site a visitor can turn
   * it on, choose a voice, or find it from the command palette -- there
   * is no page-extension registry in SITE_API.md for a module to plug a
   * tab into on its own, so wiring an actual tab into settings.html is
   * squarely that page's decision to make.
   * ================================================================ */

  if (window.Studio) {
    window.Studio.ready(boot);
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      if (window.Studio) window.Studio.ready(boot);
      else if (window.console) window.console.error('[StudioNarrator] Studio runtime not found; load assets/site.js before assets/narrator.js.');
    });
  }
})();
