/**
 * Every user-facing string this feature renders, in English and in Cantonese,
 * at all five humour levels.
 *
 * The rule that governs the whole file: humour styles the VOICE and never the
 * FACTS. A rejection at level five is funnier to read and still names the exact
 * format, the exact limit and the exact next step. A byte count, a pixel size,
 * a file format and a colour value are interpolated values and are never
 * restyled — they mean the same thing at every rung, in both languages.
 */

import type { Catalogue, FunnyLadder, TranslationEntry } from '../../core/registry';

/**
 * Expands a short ladder to the five rungs the resolver needs.
 *
 * One string means the copy genuinely reads the same at every level, which is
 * right for a bare noun. Three means serious, middle, playful.
 */
function ladder(...steps: string[]): FunnyLadder {
  if (steps.length === 1) return [steps[0], steps[0], steps[0], steps[0], steps[0]];
  if (steps.length === 2) return [steps[0], steps[0], steps[0], steps[1], steps[1]];
  if (steps.length === 3) return [steps[0], steps[0], steps[1], steps[2], steps[2]];
  if (steps.length === 4) return [steps[0], steps[1], steps[2], steps[3], steps[3]];
  if (steps.length === 5) return [steps[0], steps[1], steps[2], steps[3], steps[4]];
  throw new Error(`A ladder takes 1 to 5 strings; ${steps.length} were given.`);
}

function entry(en: FunnyLadder, yue: FunnyLadder): TranslationEntry {
  return { en, yue };
}

export const STRINGS: Catalogue = {
  /* ---------------- destinations and headings ---------------- */

  'appLogo.tab': entry(ladder('Application logo'), ladder('程式標誌')),

  'appLogo.tab.subtitle': entry(
    ladder(
      'Choose a shipped mark or convert one of your own. Everything happens on this computer.',
      'Pick a shipped mark, or bring your own and it is converted right here.',
      'Pick one of ours, or bring your own — nothing leaves this computer, not even a little bit.'
    ),
    ladder(
      '揀一個內置標誌，或者用你自己嘅圖片轉換。全部喺呢部電腦度做。',
      '揀我哋內置嘅，又或者攞你自己張圖上嚟，即場幫你轉。',
      '揀我哋嘅定係用你自己張圖都得 — 啲嘢一步都唔會離開呢部電腦，一格 bit 都唔會。'
    )
  ),

  'appLogo.search': entry(
    ladder('Search marks', 'Search marks', 'Search the marks', 'Type and watch the marks thin out', 'Type and watch the marks thin out'),
    ladder('搵標誌', '搵標誌', '搵下啲標誌', '打字，睇住啲標誌少埋', '打字，睇住啲標誌少埋')
  ),

  'appLogo.variantSearch': entry(
    ladder('Search generated sizes', 'Search generated sizes', 'Search the generated sizes', 'Filter the sizes down to the one you want', 'Filter the sizes down to the one you want'),
    ladder('搵已產生嘅尺寸', '搵已產生嘅尺寸', '搵下啲已產生嘅尺寸', '篩到淨返你想要嗰個尺寸', '篩到淨返你想要嗰個尺寸')
  ),

  /* ---------------- presets ---------------- */

  'appLogo.preset.blockDownload': entry(ladder('Block and arrow'), ladder('方塊加箭嘴')),
  'appLogo.preset.blockDownload.description': entry(
    ladder('An isometric block with a download arrow cut into its top face.'),
    ladder('一個等距方塊，頂面刻咗個下載箭嘴。')
  ),
  'appLogo.preset.worldArrow': entry(ladder('World and arrow'), ladder('世界加箭嘴')),
  'appLogo.preset.worldArrow.description': entry(
    ladder('A globe with meridians, and a descending arrow beside it.'),
    ladder('一個有經緯線嘅地球，隔籬有支向下嘅箭嘴。')
  ),
  'appLogo.preset.chunkGrid': entry(ladder('Chunk grid'), ladder('區塊格')),
  'appLogo.preset.chunkGrid.description': entry(
    ladder('Sixteen chunks, with the loaded quadrant filled in.'),
    ladder('十六個區塊，載入咗嗰一格填實晒。')
  ),
  'appLogo.preset.compass': entry(ladder('Compass rose'), ladder('羅盤')),
  'appLogo.preset.compass.description': entry(
    ladder('A four-point compass rose inside a ring.'),
    ladder('一個四方位羅盤，外面有個圈。')
  ),
  'appLogo.preset.mapPin': entry(ladder('Folded map'), ladder('摺地圖')),
  'appLogo.preset.mapPin.description': entry(
    ladder('A folded map with a pin at the destination.'),
    ladder('一張摺起嘅地圖，目的地插咗支針。')
  ),
  'appLogo.preset.regionStack': entry(ladder('Region stack'), ladder('區域疊')),
  'appLogo.preset.regionStack.description': entry(
    ladder('Three saved region files stacked, with a save badge.'),
    ladder('三個儲低咗嘅區域檔疊埋，仲有個儲存徽章。')
  ),
  'appLogo.preset.monogram': entry(ladder('Monogram'), ladder('字母標誌')),
  'appLogo.preset.monogram.description': entry(
    ladder('The two initials of the application on a rounded plate.'),
    ladder('程式兩個字頭，放喺一塊圓角牌上面。')
  ),

  /* ---------------- settings ---------------- */

  'appLogo.setting.source': entry(ladder('Logo mark'), ladder('標誌圖案')),
  'appLogo.setting.source.description': entry(
    ladder(
      'Which mark the application draws beside its name. Choosing "Your own image" needs a converted custom mark; without one the change is refused and the current mark stays.',
      'Which mark the application draws beside its name. "Your own image" only works once a custom mark has been converted.',
      'Which mark sits beside the name up top. Pick "Your own image" without converting one first and it politely declines, leaving the current mark exactly where it is.'
    ),
    ladder(
      '程式喺自己個名隔籬畫邊個標誌。揀「你自己張圖」要先有轉換好嘅自訂標誌；冇嘅話會拒絕改動，維持而家嗰個。',
      '程式喺個名隔籬畫邊個標誌。「你自己張圖」要轉換好咗先用得。',
      '上面個名隔籬擺邊個標誌。未轉換就揀「你自己張圖」，佢會客客氣氣拒絕你，而家嗰個標誌照舊企喺度。'
    )
  ),

  'appLogo.setting.showInTitleBar': entry(ladder('Show the mark in the title bar'), ladder('喺標題列顯示標誌')),
  'appLogo.setting.showInTitleBar.description': entry(
    ladder(
      'Places the chosen mark to the left of the application name in the title bar. Turning it off restores the shipped icon and deletes nothing.',
      'Puts the chosen mark left of the name in the title bar. Off restores the shipped icon; nothing is deleted.',
      'Sticks your mark left of the name up top. Switch it off and the shipped icon comes back — your mark is still saved, just sitting one setting away.'
    ),
    ladder(
      '將揀咗嘅標誌放喺標題列程式名嘅左邊。閂咗就還原內置圖示，一件嘢都唔會刪。',
      '將標誌放喺標題列個名左邊。閂咗還原內置圖示，乜都唔會刪。',
      '將你個標誌貼喺上面個名左邊。閂咗內置圖示就返嚟 — 你個標誌仲喺度，淨係差一個掣。'
    )
  ),

  'appLogo.setting.fit': entry(ladder('How the image fills the square'), ladder('張圖點填滿個方格')),
  'appLogo.setting.fit.description': entry(
    ladder(
      'Contain keeps the whole cropped image inside the square. Cover fills the square and crops the overflow. Fill stretches to the square and does not preserve the aspect ratio.',
      'Contain keeps everything visible. Cover fills the square and cuts the overflow. Fill stretches, so the shape changes.',
      'Contain shows the lot. Cover fills the square and trims whatever hangs over. Fill just stretches it — honest, but your circle becomes an oval.'
    ),
    ladder(
      '「包含」將整張裁剪後嘅圖放晒入方格。「覆蓋」填滿方格，多出嘅部分會裁走。「拉伸」拉到啱個方格，唔會保持長闊比例。',
      '「包含」乜都見到。「覆蓋」填滿方格，多出嗰啲剪走。「拉伸」會拉到變形。',
      '「包含」全部show晒。「覆蓋」填到滿瀉，出界嗰啲剪走。「拉伸」就硬拉 — 好老實，不過你個圓形會變咗橢圓。'
    )
  ),
  'appLogo.fit.contain': entry(ladder('Contain'), ladder('包含')),
  'appLogo.fit.cover': entry(ladder('Cover'), ladder('覆蓋')),
  'appLogo.fit.fill': entry(ladder('Fill'), ladder('拉伸')),

  'appLogo.setting.focalX': entry(ladder('Focal point across'), ladder('焦點左右位置')),
  'appLogo.setting.focalX.description': entry(
    ladder(
      'Where the image sits horizontally when it does not exactly fill the square. 0 is hard left, 100 is hard right.',
      'Horizontal position when the image does not exactly fill the square. 0 is left, 100 is right.',
      'Which way the image leans when it does not fill the square exactly. 0 hugs the left, 100 hugs the right.'
    ),
    ladder(
      '當張圖唔係啱啱好填滿個方格，佢橫向擺喺邊。0 係最左，100 係最右。',
      '張圖唔啱啱好填滿方格時嘅橫向位置。0 最左，100 最右。',
      '張圖填唔滿方格時，佢會攤埋邊。0 貼實左邊，100 貼實右邊。'
    )
  ),

  'appLogo.setting.focalY': entry(ladder('Focal point down'), ladder('焦點上下位置')),
  'appLogo.setting.focalY.description': entry(
    ladder(
      'Where the image sits vertically when it does not exactly fill the square. 0 is the top, 100 is the bottom.',
      'Vertical position when the image does not exactly fill the square. 0 is top, 100 is bottom.',
      'Which way the image leans vertically when it falls short. 0 sits at the top, 100 sinks to the bottom.'
    ),
    ladder(
      '當張圖唔係啱啱好填滿個方格，佢直向擺喺邊。0 係最頂，100 係最底。',
      '張圖唔啱啱好填滿方格時嘅直向位置。0 最頂，100 最底。',
      '張圖唔夠位時上下攤埋邊。0 企喺最頂，100 沉到最底。'
    )
  ),

  'appLogo.setting.backgroundTransparent': entry(ladder('Keep the background transparent'), ladder('保持背景透明')),
  'appLogo.setting.backgroundTransparent.description': entry(
    ladder(
      'Leaves the area behind the image transparent. Turning it off fills that area with the chosen background colour, which permanently removes transparency from the generated sizes.',
      'Leaves the area behind the image transparent. Off fills it with the chosen colour and the generated sizes lose their transparency.',
      'Leaves the space behind your image see-through. Switch it off and the chosen colour is painted in behind — the generated sizes then have no transparency left at all.'
    ),
    ladder(
      '張圖後面嗰塊保持透明。閂咗就會用揀咗嘅背景色填實，產生出嚟嘅尺寸會永久冇咗透明度。',
      '張圖後面保持透明。閂咗就用揀嘅顏色填實，產生嘅尺寸冇晒透明度。',
      '你張圖後面嗰塊保持通透。閂咗就會喺後面搽上你揀嘅顏色 — 之後產生嘅尺寸就一滴透明都冇。'
    )
  ),

  'appLogo.setting.backgroundColour': entry(ladder('Background colour'), ladder('背景顏色')),
  'appLogo.setting.backgroundColour.description': entry(
    ladder(
      'The colour painted behind the image when the transparent background is switched off. It has no effect while the background is transparent.',
      'The colour painted behind the image when transparency is off. Ignored while the background is transparent.',
      'The colour that goes in behind your image once transparency is off. While transparency is on it just sits there, waiting.'
    ),
    ladder(
      '當關咗透明背景，喺張圖後面搽嘅顏色。背景仲係透明嘅時候佢唔會有作用。',
      '關咗透明之後喺圖後面搽嘅顏色。透明開住嘅時候唔理佢。',
      '一關咗透明就會搽落你張圖後面嘅顏色。透明開住嗰陣，佢就喺度等。'
    )
  ),

  'appLogo.setting.cornerRadius': entry(ladder('Corner rounding'), ladder('圓角')),
  'appLogo.setting.cornerRadius.description': entry(
    ladder(
      'Rounds the corners of the generated sizes, as a percentage of the size. 0 leaves the mark square and 50 makes it a circle.',
      'Rounds the corners of the generated sizes. 0 is square, 50 is a circle.',
      'Rounds off the corners of every generated size. 0 is a proper square, 50 is a full circle, and everything between is a matter of taste.'
    ),
    ladder(
      '將產生嘅尺寸修圓角，數值係尺寸嘅百分比。0 保持四方，50 變成圓形。',
      '將產生嘅尺寸修圓角。0 四四方方，50 變圓形。',
      '幫每個產生嘅尺寸修圓角。0 係正正方方，50 係一個圓，中間嘅就睇你口味。'
    )
  ),

  'appLogo.setting.safeArea': entry(ladder('Show the safe-area guide'), ladder('顯示安全區指引')),
  'appLogo.setting.safeArea.description': entry(
    ladder(
      'Draws an outline over the previews showing the area that survives a circular mask. It is a guide only and never appears in the generated sizes.',
      'Draws an outline over the previews showing what survives a circular mask. Guide only; never in the output.',
      'Draws a ring over the previews so you can see what a circular mask would keep. It is only a guide — it never sneaks into the actual output.'
    ),
    ladder(
      '喺預覽上面畫一條線，顯示畀圓形遮罩剪完之後仲會見到嘅範圍。淨係指引，唔會出現喺產生嘅尺寸入面。',
      '喺預覽上面畫線，顯示圓形遮罩之後留低嘅範圍。淨係指引，唔會入到輸出。',
      '喺預覽度畫個圈，等你睇到圓形遮罩會留低啲乜。純粹指引，唔會偷偷走入真正輸出。'
    )
  ),

  'appLogo.setting.openEditor': entry(ladder('Open the logo editor'), ladder('打開標誌編輯器')),
  'appLogo.setting.openEditor.description': entry(
    ladder(
      'Opens the application logo tab, where the mark is chosen, cropped and converted.',
      'Opens the application logo tab: choosing, cropping and converting all live there.',
      'Opens the application logo tab, where all the choosing, cropping and converting actually happens.'
    ),
    ladder(
      '打開程式標誌分頁，喺嗰度揀標誌、裁剪同轉換。',
      '打開程式標誌分頁，揀、裁、轉都喺嗰度。',
      '打開程式標誌分頁，揀圖、裁圖、轉換全部喺嗰度發生。'
    )
  ),

  'appLogo.setting.resetAction': entry(ladder('Reset to the shipped mark'), ladder('還原做內置標誌')),
  'appLogo.setting.resetAction.description': entry(
    ladder(
      'Restores the shipped mark and deletes the converted custom sizes from the settings file. The original file on your disk is never touched.',
      'Restores the shipped mark and deletes the converted custom sizes. Your original file on disk is untouched.',
      'Puts the shipped mark back and throws away the converted custom sizes. Your original file on disk is not touched — we never had a copy of it to begin with.'
    ),
    ladder(
      '還原做內置標誌，並且喺設定檔刪走已轉換嘅自訂尺寸。你硬碟上面原本嗰個檔案唔會郁到。',
      '還原做內置標誌，刪走轉換好嘅自訂尺寸。你硬碟上面原檔唔會郁。',
      '換返內置標誌，順手掉咗啲轉換好嘅自訂尺寸。你硬碟嗰個原檔完全冇郁過 — 我哋根本冇留過副本。'
    )
  ),

  /* ---------------- current mark ---------------- */

  'appLogo.current.title': entry(ladder('The mark in use'), ladder('而家用緊嘅標誌')),
  'appLogo.current.preset': entry(
    ladder('A shipped mark is in use: {name}.'),
    ladder('而家用緊內置標誌：{name}。')
  ),
  'appLogo.current.custom': entry(
    ladder('Your own image is in use. It was converted on {date} from a {format} source of {width}x{height} pixels.'),
    ladder('而家用緊你自己張圖。喺 {date} 由一個 {width}x{height} 像素嘅 {format} 檔轉換出嚟。')
  ),
  'appLogo.current.missing': entry(
    ladder(
      'The stored choice "{id}" cannot be rendered, so the shipped icon is showing. Choose a mark below to fix it.',
      'The stored choice "{id}" cannot be rendered, so the shipped icon is showing. Pick a mark below.',
      'The saved choice "{id}" cannot be drawn, so the shipped icon is holding the fort. Pick a mark below and it will step aside.'
    ),
    ladder(
      '儲低咗嘅選擇「{id}」畫唔到，所以而家顯示內置圖示。喺下面揀返個標誌就搞掂。',
      '儲低嘅選擇「{id}」畫唔到，而家顯示內置圖示。喺下面揀個標誌。',
      '儲低嗰個「{id}」畫唔出，內置圖示暫時頂住檔。喺下面揀個標誌，佢就會讓位。'
    )
  ),
  'appLogo.current.chrome': entry(ladder('Title bar: {state}'), ladder('標題列：{state}')),

  /* ---------------- identity ---------------- */

  'appLogo.identity.title': entry(ladder('What a logo change never moves'), ladder('換標誌永遠唔會郁到嘅嘢')),
  'appLogo.identity.body': entry(
    ladder(
      'The mark is presentation only. The package identity, the installer identity, the update feed and the data directory are set by the build and are unchanged by anything on this page.',
      'The mark is presentation only: package identity, installer identity, update feed and data directory all stay exactly as the build set them.',
      'The mark is decoration with a job. Package identity, installer identity, update feed and data directory are all set by the build and none of them so much as blinks at anything you do here.'
    ),
    ladder(
      '標誌淨係外觀。套件識別、安裝程式識別、更新來源同資料夾都係由建置決定，呢一頁嘅嘢一樣都改唔到。',
      '標誌淨係外觀：套件識別、安裝程式識別、更新來源同資料夾一律照建置嗰個，唔會變。',
      '標誌係有用途嘅裝飾。套件識別、安裝程式識別、更新來源同資料夾全部由建置話事，你喺呢度做乜佢哋都唔會眨吓眼。'
    )
  ),
  'appLogo.identity.packageName': entry(ladder('Package identity'), ladder('套件識別')),
  'appLogo.identity.productName': entry(ladder('Shipped product name'), ladder('出廠產品名')),
  'appLogo.identity.version': entry(ladder('Version'), ladder('版本')),
  'appLogo.identity.userDataDir': entry(ladder('Data directory'), ladder('資料夾')),

  /* ---------------- source table ---------------- */

  'appLogo.sources.title': entry(ladder('Choose a mark'), ladder('揀個標誌')),
  'appLogo.sources.description': entry(
    ladder(
      'Every shipped mark, plus your own converted image once one exists. Select exactly one and apply it.',
      'Every shipped mark, plus your converted image if there is one. Select one and apply it.',
      'All the shipped marks, plus your own once you have converted one. Tick exactly one and press apply.'
    ),
    ladder(
      '所有內置標誌，加埋你轉換咗嘅自訂圖（如果有）。揀啱一個然後套用。',
      '所有內置標誌，有嘅話仲有你轉換咗嘅圖。揀一個套用。',
      '晒冷內置標誌，加埋你轉換好嗰張。剔啱一個，撳套用。'
    )
  ),
  'appLogo.column.name': entry(ladder('Mark'), ladder('標誌')),
  'appLogo.column.kind': entry(ladder('Origin'), ladder('來源')),
  'appLogo.column.detail': entry(ladder('Detail'), ladder('詳情')),
  'appLogo.column.preview': entry(ladder('Preview'), ladder('預覽')),
  'appLogo.kind.preset': entry(ladder('Shipped'), ladder('內置')),
  'appLogo.kind.custom': entry(ladder('Your own image'), ladder('你自己張圖')),
  'appLogo.custom.detail': entry(
    ladder('{count} sizes, {bytes} in total, converted on {date}.'),
    ladder('{count} 個尺寸，合共 {bytes}，喺 {date} 轉換。')
  ),

  'appLogo.action.apply': entry(ladder('Apply the selected mark'), ladder('套用揀咗嘅標誌')),
  'appLogo.action.apply.needOne': entry(
    ladder('Select exactly one mark to apply. {count} are selected.'),
    ladder('要揀啱一個標誌先套用得。而家揀咗 {count} 個。')
  ),
  'appLogo.action.selectShown': entry(ladder('Select the {count} shown'), ladder('揀晒顯示緊嘅 {count} 個')),
  'appLogo.action.selectEverything': entry(ladder('Select every one of the {count}'), ladder('揀晒全部 {count} 個')),
  'appLogo.action.invert': entry(ladder('Invert the selection'), ladder('反轉揀咗嘅嘢')),
  'appLogo.selection.summary': entry(
    ladder('{selected} selected of {shown} shown and {total} in total. {hidden} of the selected are hidden by the current filter.'),
    ladder('揀咗 {selected} 個，顯示緊 {shown} 個，全部有 {total} 個。揀咗嘅入面有 {hidden} 個畀而家嘅篩選遮住咗。')
  ),

  'appLogo.export.action': entry(ladder('Export the selected rows'), ladder('匯出揀咗嘅行')),
  'appLogo.export.format': entry(ladder('Export format'), ladder('匯出格式')),
  'appLogo.export.omitted': entry(
    ladder(
      'Image data is deliberately left out of every export. Only names, sizes, byte counts and verification results are written.',
      'Image data is left out of every export on purpose. Names, sizes, byte counts and verification results are written.',
      'The picture itself never goes in an export, on purpose. You get names, sizes, byte counts and verification results — no pixels.'
    ),
    ladder(
      '匯出一律唔會包含圖像數據，呢個係刻意嘅。淨係寫名稱、尺寸、位元組數同驗證結果。',
      '匯出刻意唔包圖像數據。淨係寫名、尺寸、位元組數同驗證結果。',
      '張圖本身永遠唔會落到匯出檔，係特登嘅。你得到名、尺寸、位元組數同驗證結果 — 一粒像素都冇。'
    )
  ),
  'appLogo.export.needRows': entry(
    ladder('Select at least one row to export.'),
    ladder('至少揀一行先匯出得。')
  ),
  'appLogo.export.done': entry(ladder('Exported {count} rows to {path}.'), ladder('已經匯出 {count} 行去 {path}。')),

  /* ---------------- upload ---------------- */

  'appLogo.upload.title': entry(ladder('Use your own image'), ladder('用你自己張圖')),
  'appLogo.upload.limits': entry(
    ladder(
      'PNG, JPEG, WebP and BMP only, up to {bytes}, between {min} and {max} pixels on each side, single frame. The bytes are checked rather than the file name, and the file is decoded in this window only.',
      'PNG, JPEG, WebP and BMP only, up to {bytes}, {min} to {max} pixels a side, one frame. The bytes are checked, not the name.',
      'PNG, JPEG, WebP and BMP only, up to {bytes}, {min} to {max} pixels a side, and exactly one frame. We read the actual bytes rather than believing the file name, and the whole thing is decoded right here in this window.'
    ),
    ladder(
      '淨係收 PNG、JPEG、WebP 同 BMP，最大 {bytes}，每邊 {min} 至 {max} 像素，單格圖。我哋睇實際位元組，唔係睇檔名，而且淨係喺呢個窗度解碼。',
      '淨係收 PNG、JPEG、WebP、BMP，最大 {bytes}，每邊 {min} 至 {max} 像素，單格。睇位元組唔係睇檔名。',
      '淨係收 PNG、JPEG、WebP 同 BMP，最大 {bytes}，每邊 {min} 至 {max} 像素，剩係一格。我哋讀真正嘅位元組，唔會信個檔名，成件事就喺呢個窗入面解碼。'
    )
  ),
  'appLogo.upload.choose': entry(ladder('Choose an image file'), ladder('揀一個圖片檔')),
  'appLogo.upload.replace': entry(ladder('Choose a different image file'), ladder('揀第二個圖片檔')),
  'appLogo.upload.none': entry(
    ladder(
      'No image is loaded in this session. Choose a file to start.',
      'No image is loaded in this session. Choose a file to start.',
      'Nothing loaded this session. Pick a file and we can begin.'
    ),
    ladder(
      '呢次開機未載入任何圖片。揀個檔案就可以開始。',
      '今次未載入任何圖片。揀個檔案開始。',
      '今次一張圖都未載入。揀個檔案，我哋就可以開工。'
    )
  ),
  'appLogo.upload.loading': entry(
    ladder('Reading and checking the file…'),
    ladder('讀緊同檢查緊個檔案…')
  ),
  'appLogo.upload.ready': entry(
    ladder('Loaded: {format}, {width}x{height} pixels, {bytes}. {alpha}'),
    ladder('已載入：{format}，{width}x{height} 像素，{bytes}。{alpha}')
  ),
  'appLogo.upload.hasAlpha': entry(ladder('It carries an alpha channel.'), ladder('佢有 alpha 透明通道。')),
  'appLogo.upload.noAlpha': entry(ladder('It carries no alpha channel.'), ladder('佢冇 alpha 透明通道。')),
  'appLogo.upload.rejected': entry(
    ladder(
      'The file was refused and nothing was changed. {detail}',
      'The file was refused and nothing was changed. {detail}',
      'The file was turned away, and nothing at all was changed. {detail}'
    ),
    ladder(
      '個檔案畀拒絕咗，乜都冇改到。{detail}',
      '個檔案畀拒絕咗，乜都冇改。{detail}',
      '個檔案畀請走咗，一樣嘢都冇改動過。{detail}'
    )
  ),
  'appLogo.upload.notRetained': entry(
    ladder(
      'The original file is not kept. Only the generated sizes are stored, so re-cropping after a restart means choosing the file again.',
      'The original file is not kept — only the generated sizes are stored. Re-cropping after a restart means picking the file again.',
      'We do not keep your original. Only the generated sizes are stored, so if you want to re-crop after a restart you will have to hand us the file once more.'
    ),
    ladder(
      '原本個檔案唔會保留。淨係儲產生咗嘅尺寸，所以重開之後想再裁剪就要再揀一次檔案。',
      '原檔唔會保留，淨係儲產生嘅尺寸。重開之後想再裁就再揀一次檔。',
      '我哋唔會留低你嘅原檔。淨係儲低產生咗嘅尺寸，所以重開之後想再裁剪，就要再拎個檔案畀我哋一次。'
    )
  ),

  /* ---------------- editor ---------------- */

  'appLogo.editor.title': entry(ladder('Crop and framing'), ladder('裁剪同構圖')),
  'appLogo.editor.unavailable': entry(
    ladder(
      'Load an image in this session to crop it. The editor cannot work from the generated sizes alone.',
      'Load an image this session to crop it. The generated sizes alone are not enough to crop from.',
      'Load an image this session before cropping. The generated sizes are output, not source — there is nothing there to crop.'
    ),
    ladder(
      '今次開機要載入一張圖先裁剪得。單靠產生咗嘅尺寸，編輯器做唔到嘢。',
      '今次要載入圖片先裁剪得，單靠產生嘅尺寸唔夠。',
      '今次要先載入一張圖先可以裁。產生嘅尺寸係成品唔係原料，冇嘢可以裁。'
    )
  ),
  'appLogo.crop.region': entry(ladder('Crop rectangle'), ladder('裁剪範圍')),
  'appLogo.crop.regionHint': entry(
    ladder(
      'Drag the rectangle or its corners. From the keyboard, focus a corner and use the arrow keys; hold Shift for larger steps.',
      'Drag the rectangle or its corners, or focus a corner and use the arrow keys. Shift makes the steps larger.',
      'Drag the rectangle or its corners. From the keyboard, focus a corner and press the arrow keys — hold Shift if you are in a hurry.'
    ),
    ladder(
      '拖動個長方形或者佢啲角。用鍵盤嘅話，將焦點放喺一個角再撳方向鍵；撳住 Shift 就行得大步啲。',
      '拖個長方形或者佢啲角，又或者將焦點放喺個角撳方向鍵。撳 Shift 行大步啲。',
      '拖個長方形或者拉佢啲角。用鍵盤就將焦點放喺個角撳方向鍵 — 趕時間就撳住 Shift。'
    )
  ),
  'appLogo.crop.x': entry(ladder('Left edge, percent'), ladder('左邊界（百分比）')),
  'appLogo.crop.y': entry(ladder('Top edge, percent'), ladder('上邊界（百分比）')),
  'appLogo.crop.width': entry(ladder('Width, percent'), ladder('闊度（百分比）')),
  'appLogo.crop.height': entry(ladder('Height, percent'), ladder('高度（百分比）')),
  'appLogo.crop.handle.topLeft': entry(ladder('Top-left crop corner'), ladder('左上裁剪角')),
  'appLogo.crop.handle.topRight': entry(ladder('Top-right crop corner'), ladder('右上裁剪角')),
  'appLogo.crop.handle.bottomLeft': entry(ladder('Bottom-left crop corner'), ladder('左下裁剪角')),
  'appLogo.crop.handle.bottomRight': entry(ladder('Bottom-right crop corner'), ladder('右下裁剪角')),
  'appLogo.crop.reset': entry(ladder('Use the whole image'), ladder('用返成張圖')),
  'appLogo.crop.summary': entry(
    ladder('Keeping {width}x{height} pixels of {sourceWidth}x{sourceHeight}.'),
    ladder('喺 {sourceWidth}x{sourceHeight} 入面留 {width}x{height} 像素。')
  ),

  'appLogo.background.pick': entry(ladder('Pick the background colour'), ladder('揀背景顏色')),
  'appLogo.background.disabled': entry(
    ladder(
      'The background is transparent, so a background colour would have no effect. Turn transparency off to choose one.',
      'The background is transparent, so a colour would do nothing. Turn transparency off first.',
      'The background is transparent, so a colour here would do precisely nothing. Turn transparency off and it wakes up.'
    ),
    ladder(
      '背景而家係透明，所以揀背景色都唔會有作用。閂咗透明先揀。',
      '背景透明緊，揀顏色都冇用。閂咗透明先。',
      '背景而家透明，喺呢度揀色係一啲作用都冇。閂咗透明佢就醒返。'
    )
  ),
  'appLogo.background.contrast': entry(
    ladder('Contrast against the window surface: {ratio}:1.'),
    ladder('同視窗表面嘅對比度：{ratio}:1。')
  ),
  'appLogo.background.lowContrast': entry(
    ladder(
      'That background is within {ratio}:1 of the window surface, so the mark will be hard to pick out. 3:1 or more is comfortable.',
      'That background is only {ratio}:1 against the window surface, so the mark will be hard to see. Aim for 3:1 or more.',
      'That background sits at {ratio}:1 against the window surface, which means your mark will more or less vanish into it. 3:1 or better is the comfortable range.'
    ),
    ladder(
      '呢個背景同視窗表面嘅對比度得 {ratio}:1，個標誌會好難認。3:1 或以上會舒服啲。',
      '呢個背景對視窗表面得 {ratio}:1，個標誌會好難睇到。目標 3:1 或以上。',
      '呢個背景對住視窗表面得 {ratio}:1，你個標誌基本上會溶咗入去。3:1 或以上先叫舒服。'
    )
  ),

  /* ---------------- previews ---------------- */

  'appLogo.preview.title': entry(ladder('Every display size'), ladder('每個顯示尺寸')),
  'appLogo.preview.description': entry(
    ladder(
      'The sizes the application actually draws. Each is rendered by the same code that writes the output, so a preview cannot disagree with the result.',
      'The sizes the application actually draws, rendered by the same code that writes the output.',
      'Every size the application really draws, each one rendered by exactly the code that writes the output — so a preview cannot quietly lie to you.'
    ),
    ladder(
      '程式真係會畫嘅尺寸。每個都用寫輸出嗰段程式碼去畫，所以預覽同結果唔會唔一致。',
      '程式真係會畫嘅尺寸，同輸出用同一段程式碼畫。',
      '程式真正會畫嘅每個尺寸，全部用寫輸出嗰段碼去畫 — 所以預覽唔會靜靜雞呃你。'
    )
  ),
  'appLogo.preview.size': entry(ladder('{size} pixels'), ladder('{size} 像素')),

  /* ---------------- losses ---------------- */

  'appLogo.losses.title': entry(ladder('What conversion will change'), ladder('轉換會改變啲乜')),
  'appLogo.losses.none': entry(
    ladder('Nothing beyond the resize itself. The image is already a single-frame PNG at the full crop.'),
    ladder('除咗改尺寸之外冇嘢。張圖本身已經係單格 PNG，而且冇裁剪。')
  ),
  'appLogo.loss.reencode': entry(ladder('Re-encoded as PNG'), ladder('重新編碼做 PNG')),
  'appLogo.loss.colourProfile': entry(ladder('Colour profile flattened'), ladder('色彩描述檔壓平')),
  'appLogo.loss.transparency': entry(ladder('Transparency removed'), ladder('移除透明度')),
  'appLogo.loss.crop': entry(ladder('Cropped'), ladder('裁剪')),
  'appLogo.loss.downscale': entry(ladder('Detail lost at small sizes'), ladder('細尺寸會蝕細節')),
  'appLogo.loss.upscale': entry(ladder('Enlarged at large sizes'), ladder('大尺寸會放大')),
  'appLogo.loss.metadata': entry(ladder('Metadata dropped'), ladder('中繼資料唔會保留')),
  'appLogo.loss.stretch': entry(ladder('Aspect ratio not preserved'), ladder('唔會保持長闊比例')),

  /* ---------------- conversion ---------------- */

  'appLogo.convert.action': entry(ladder('Convert and apply'), ladder('轉換並套用')),
  'appLogo.convert.needSource': entry(
    ladder('Load an image in this session before converting.'),
    ladder('轉換之前要今次先載入一張圖。')
  ),
  'appLogo.convert.progress': entry(
    ladder('Converting: {done} of {total} sizes written, at {size} pixels.'),
    ladder('轉換緊：{total} 個尺寸寫咗 {done} 個，而家 {size} 像素。')
  ),
  'appLogo.convert.title': entry(ladder('Converting the logo'), ladder('轉換緊標誌')),
  'appLogo.convert.success': entry(
    ladder('All {count} sizes were written and verified, totalling {bytes}. The mark is now in use.'),
    ladder('{count} 個尺寸全部寫好並驗證咗，合共 {bytes}。標誌已經開始用緊。')
  ),
  'appLogo.convert.failed': entry(
    ladder(
      'Conversion failed and the previous mark is still in use. {detail}',
      'Conversion failed and the previous mark is still in use. {detail}',
      'Conversion fell over, and the previous mark is still doing its job. {detail}'
    ),
    ladder(
      '轉換失敗，之前嗰個標誌仲用緊。{detail}',
      '轉換失敗，之前嗰個標誌照用。{detail}',
      '轉換仆咗街，之前嗰個標誌仲喺度頂硬上。{detail}'
    )
  ),

  /* ---------------- variants table ---------------- */

  'appLogo.variants.title': entry(ladder('Generated sizes'), ladder('產生咗嘅尺寸')),
  'appLogo.variants.description': entry(
    ladder(
      'Each generated size, its byte count and the result of its last verification.',
      'Each generated size, its byte count and its last verification result.',
      'Every generated size, how many bytes it costs, and how its last check went.'
    ),
    ladder(
      '每個產生咗嘅尺寸、佢嘅位元組數，同最後一次驗證嘅結果。',
      '每個產生嘅尺寸、位元組數同最後驗證結果。',
      '每個產生嘅尺寸、食幾多位元組，同最近一次檢查嘅成績。'
    )
  ),
  'appLogo.variants.empty': entry(
    ladder(
      'No sizes have been generated. Choose an image above and convert it.',
      'No sizes have been generated. Choose an image above and convert it.',
      'No sizes yet. Choose an image above and convert it — that is the whole ceremony.'
    ),
    ladder(
      '仲未產生過任何尺寸。喺上面揀張圖然後轉換。',
      '未產生過任何尺寸。上面揀張圖轉換。',
      '一個尺寸都未產生。上面揀張圖再轉換 — 儀式就係咁多。'
    )
  ),
  'appLogo.variants.column.size': entry(ladder('Size'), ladder('尺寸')),
  'appLogo.variants.column.bytes': entry(ladder('Bytes'), ladder('位元組')),
  'appLogo.variants.column.verified': entry(ladder('Verification'), ladder('驗證')),
  'appLogo.variants.verified': entry(ladder('Verified'), ladder('已驗證')),
  'appLogo.variants.unverified': entry(ladder('Not verified'), ladder('未通過驗證')),
  'appLogo.variants.reverify': entry(ladder('Verify the selected sizes again'), ladder('再驗證揀咗嘅尺寸')),
  'appLogo.variants.reverified': entry(
    ladder('{passed} of {count} selected sizes passed verification.'),
    ladder('揀咗嘅 {count} 個尺寸有 {passed} 個通過驗證。')
  ),

  /* ---------------- removal and reset ---------------- */

  'appLogo.remove.title': entry(ladder('Remove your converted mark'), ladder('刪走你轉換咗嘅標誌')),
  'appLogo.remove.action': entry(ladder('Remove the converted sizes'), ladder('刪走已轉換嘅尺寸')),
  'appLogo.remove.none': entry(
    ladder('There is no converted mark to remove.'),
    ladder('冇轉換咗嘅標誌可以刪。')
  ),
  'appLogo.remove.done': entry(
    ladder('The converted sizes were removed and the shipped mark is back in use.'),
    ladder('已轉換嘅尺寸刪走咗，內置標誌返嚟用緊。')
  ),

  /* ---------------- notifications ---------------- */

  'appLogo.notify.applied': entry(
    ladder('The application logo is now {name}.'),
    ladder('程式標誌而家係 {name}。')
  ),
  'appLogo.notify.title': entry(ladder('Application logo'), ladder('程式標誌')),
  'appLogo.notify.chromeMissing': entry(
    ladder(
      'The mark was saved but the title bar could not be found in this window, so nothing changed on screen.',
      'The mark was saved but the title bar was not found, so nothing changed on screen.',
      'The mark is saved, but the title bar was nowhere to be found in this window, so the screen looks exactly as it did.'
    ),
    ladder(
      '標誌儲咗，但係喺呢個窗搵唔到標題列，所以畫面冇變。',
      '標誌儲咗，但搵唔到標題列，畫面冇變。',
      '標誌儲低咗，但係呢個窗入面搵極都搵唔到標題列，所以畫面同之前一模一樣。'
    )
  ),

  /* ---------------- palette ---------------- */

  'appLogo.palette.open': entry(ladder('Application logo'), ladder('程式標誌')),
  'appLogo.palette.upload': entry(ladder('Choose an image for the application logo'), ladder('揀張圖做程式標誌')),
  'appLogo.palette.reset': entry(ladder('Reset the application logo'), ladder('重設程式標誌'))
};
