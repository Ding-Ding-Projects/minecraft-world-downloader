/**
 * Every user-facing string this feature renders, in English and in playful Hong
 * Kong Cantonese, at all five humour levels.
 *
 * The two ladders are independent: somebody will read English at level 1 beside
 * Cantonese at level 5, and both halves have to read correctly in that
 * combination. Humour styles the voice and never the facts — a coordinate, a
 * tile count, a file path and a "this cannot be undone" sentence say exactly the
 * same thing at level 5 as they do at level 1.
 */

import type { Catalogue } from '../../core/registry';

export const MAP_STRINGS: Catalogue = {
  /* ---------------- destination ---------------- */

  'map.tab': {
    en: ['Live map', 'Live map', 'Live map', 'Live map, straight off your disk', 'Live map, straight off your disk'],
    yue: ['即時地圖', '即時地圖', '即時地圖', '即時地圖，直接喺你硬碟攞', '即時地圖，直接喺你硬碟攞']
  },
  'map.tab.subtitle': {
    en: [
      'Region tiles written by the downloader, read from local files only.',
      'Region tiles written by the downloader, read from local files only.',
      'The tiles the downloader wrote, read straight off local files.',
      'The tiles the downloader dropped on your disk — no map service, no server, no internet.',
      'The tiles the downloader dropped on your disk — no map service, no server, no internet.'
    ],
    yue: [
      '下載器寫低嘅區域圖磚，只會由本機檔案讀取。',
      '下載器寫低嘅區域圖磚，只會由本機檔案讀取。',
      '下載器寫低嘅圖磚，直接喺本機檔案度讀。',
      '下載器丟落你硬碟嘅圖磚 — 冇地圖服務、冇伺服器、唔使上網。',
      '下載器丟落你硬碟嘅圖磚 — 冇地圖服務、冇伺服器、唔使上網。'
    ]
  },
  'map.settings.section': {
    en: ['Live map', 'Live map', 'Live map', 'Live map', 'Live map'],
    yue: ['即時地圖', '即時地圖', '即時地圖', '即時地圖', '即時地圖']
  },

  /* ---------------- status ---------------- */

  'map.status.live': {
    en: [
      '{tiles} tiles on disk',
      '{tiles} tiles on disk',
      '{tiles} tiles sitting on disk',
      '{tiles} tiles sitting on disk, all yours',
      '{tiles} tiles sitting on disk, all yours'
    ],
    yue: ['硬碟上有 {tiles} 塊圖磚', '硬碟上有 {tiles} 塊圖磚', '硬碟度擺住 {tiles} 塊圖磚', '硬碟度擺住 {tiles} 塊圖磚，全部係你嘅', '硬碟度擺住 {tiles} 塊圖磚，全部係你嘅']
  },
  'map.status.waiting': {
    en: [
      'No tiles have been written yet.',
      'No tiles have been written yet.',
      'Nothing written yet — still waiting on tiles.',
      'Not one tile yet. The renderer has not put anything on disk.',
      'Not one tile yet. The renderer has not put anything on disk.'
    ],
    yue: ['未有任何圖磚寫落嚟。', '未有任何圖磚寫落嚟。', '仲未寫到嘢 — 等緊啲圖磚。', '一塊都未有。算圖器仲未擺任何嘢落硬碟。', '一塊都未有。算圖器仲未擺任何嘢落硬碟。']
  },
  'map.status.updated': {
    en: ['Index updated {time}', 'Index updated {time}', 'Index last updated {time}', 'Index last refreshed {time}', 'Index last refreshed {time}'],
    yue: ['索引更新於 {time}', '索引更新於 {time}', '索引上次更新 {time}', '索引最後刷新係 {time}', '索引最後刷新係 {time}']
  },
  'map.status.folder': {
    en: ['Reading from {path}', 'Reading from {path}', 'Reading from {path}', 'Reading from {path}', 'Reading from {path}'],
    yue: ['喺 {path} 度讀', '喺 {path} 度讀', '喺 {path} 度讀', '喺 {path} 度讀', '喺 {path} 度讀']
  },
  'map.status.tooWide': {
    en: [
      'The view covers more region tiles than one frame will draw. Zoom in to see terrain again.',
      'The view covers more region tiles than one frame will draw. Zoom in to see terrain again.',
      'That view asks for more tiles than one frame will draw. Zoom in and the terrain comes back.',
      'You have zoomed out past what one frame will draw. Nothing is missing from disk — zoom in and it all comes back.',
      'You have zoomed out past what one frame will draw. Nothing is missing from disk — zoom in and it all comes back.'
    ],
    yue: [
      '目前視野涵蓋嘅圖磚多過一格畫面畫得晒，放大返先睇到地形。',
      '目前視野涵蓋嘅圖磚多過一格畫面畫得晒，放大返先睇到地形。',
      '你要嘅圖磚多過一格畫面畫得晒，放大返地形就返嚟。',
      '你縮得太遠，超咗一格畫面畫得晒嘅數量。硬碟啲嘢冇少 — 放大返就乜都返晒嚟。',
      '你縮得太遠，超咗一格畫面畫得晒嘅數量。硬碟啲嘢冇少 — 放大返就乜都返晒嚟。'
    ]
  },

  /* ---------------- actions ---------------- */

  'map.action.refreshNow': {
    en: ['Refresh now', 'Refresh now', 'Refresh now', 'Refresh now', 'Refresh now'],
    yue: ['即刻刷新', '即刻刷新', '即刻刷新', '即刻刷新', '即刻刷新']
  },
  'map.action.resetView': {
    en: ['Reset view', 'Reset view', 'Reset the view', 'Reset the view', 'Reset the view'],
    yue: ['重設視野', '重設視野', '重設返個視野', '重設返個視野', '重設返個視野']
  },
  'map.action.zoomIn': {
    en: ['Zoom in', 'Zoom in', 'Zoom in', 'Zoom in', 'Zoom in'],
    yue: ['放大', '放大', '放大', '放大', '放大']
  },
  'map.action.zoomOut': {
    en: ['Zoom out', 'Zoom out', 'Zoom out', 'Zoom out', 'Zoom out'],
    yue: ['縮細', '縮細', '縮細', '縮細', '縮細']
  },
  'map.action.chooseFolder': {
    en: [
      'Choose the world folder…',
      'Choose the world folder…',
      'Choose the world folder…',
      'Point me at the world folder…',
      'Point me at the world folder…'
    ],
    yue: ['揀世界資料夾…', '揀世界資料夾…', '揀個世界資料夾…', '話我知世界資料夾喺邊…', '話我知世界資料夾喺邊…']
  },
  'map.action.openFolder': {
    en: ['Open the tile folder', 'Open the tile folder', 'Open the tile folder', 'Open the tile folder', 'Open the tile folder'],
    yue: ['打開圖磚資料夾', '打開圖磚資料夾', '打開圖磚資料夾', '打開圖磚資料夾', '打開圖磚資料夾']
  },
  'map.action.centreOnTiles': {
    en: [
      'Centre on the explored area',
      'Centre on the explored area',
      'Centre on what you have explored',
      'Centre on everything you have actually walked',
      'Centre on everything you have actually walked'
    ],
    yue: ['置中喺已探索範圍', '置中喺已探索範圍', '置中喺你探索過嘅地方', '置中喺你真係行過嘅地方', '置中喺你真係行過嘅地方']
  },
  'map.action.centreOnPlayer': {
    en: ['Centre on the player', 'Centre on the player', 'Centre on the player', 'Centre on the player', 'Centre on the player'],
    yue: ['置中喺玩家', '置中喺玩家', '置中喺玩家', '置中喺玩家', '置中喺玩家']
  },

  /* ---------------- layers ---------------- */

  'map.layers.title': {
    en: ['Layers', 'Layers', 'Layers', 'Layers', 'Layers'],
    yue: ['圖層', '圖層', '圖層', '圖層', '圖層']
  },
  'map.layers.description': {
    en: [
      'Which dimension and render mode are drawn, and which overlays sit on top of them.',
      'Which dimension and render mode are drawn, and which overlays sit on top of them.',
      'Pick the dimension, pick the render mode, and choose what sits on top.',
      'Pick a dimension, pick a render mode, then decide what gets sprinkled on top.',
      'Pick a dimension, pick a render mode, then decide what gets sprinkled on top.'
    ],
    yue: [
      '揀邊個維度、邊個算圖模式，同埋上面疊咩圖層。',
      '揀邊個維度、邊個算圖模式，同埋上面疊咩圖層。',
      '揀維度、揀算圖模式，再決定上面加咩。',
      '揀維度、揀算圖模式，跟住決定上面灑啲咩落去。',
      '揀維度、揀算圖模式，跟住決定上面灑啲咩落去。'
    ]
  },
  'map.layers.dimension': {
    en: ['Dimension', 'Dimension', 'Dimension', 'Dimension', 'Dimension'],
    yue: ['維度', '維度', '維度', '維度', '維度']
  },
  'map.layers.dimension.empty': {
    en: [
      'No dimension has any tiles yet',
      'No dimension has any tiles yet',
      'No dimension has tiles yet',
      'Not a single dimension has tiles yet',
      'Not a single dimension has tiles yet'
    ],
    yue: ['未有任何維度有圖磚', '未有任何維度有圖磚', '未有維度有圖磚', '一個維度都未有圖磚', '一個維度都未有圖磚']
  },
  'map.layers.mode': {
    en: ['Render mode', 'Render mode', 'Render mode', 'Render mode', 'Render mode'],
    yue: ['算圖模式', '算圖模式', '算圖模式', '算圖模式', '算圖模式']
  },
  'map.mode.normal': {
    en: ['Surface', 'Surface', 'Surface', 'Surface', 'Surface'],
    yue: ['地面', '地面', '地面', '地面', '地面']
  },
  'map.mode.caves': {
    en: ['Caves', 'Caves', 'Caves', 'Caves', 'Caves'],
    yue: ['洞穴', '洞穴', '洞穴', '洞穴', '洞穴']
  },
  'map.layer.regionGrid': {
    en: ['Region grid', 'Region grid', 'Region grid', 'Region grid', 'Region grid'],
    yue: ['區域格網', '區域格網', '區域格網', '區域格網', '區域格網']
  },
  'map.layer.regionGrid.description': {
    en: [
      'Draws the boundary of each 512-block region tile. The grid is hidden automatically when the tiles are drawn smaller than 24 pixels, where it would read as noise instead of as a grid.',
      'Draws the boundary of each 512-block region tile. The grid is hidden automatically when the tiles are drawn smaller than 24 pixels, where it would read as noise instead of as a grid.',
      'Outlines each 512-block region tile. It hides itself when tiles get smaller than 24 pixels, because at that size a grid is just noise.',
      'Outlines each 512-block region tile so you can see where one file stops and the next begins. Below 24 pixels a tile it hides itself, because at that size a grid is just fuzz.',
      'Outlines each 512-block region tile so you can see where one file stops and the next begins. Below 24 pixels a tile it hides itself, because at that size a grid is just fuzz.'
    ],
    yue: [
      '畫出每塊 512 格區域圖磚嘅邊界。當圖磚細過 24 像素會自動收起，因為嗰陣格網只會變雜訊。',
      '畫出每塊 512 格區域圖磚嘅邊界。當圖磚細過 24 像素會自動收起，因為嗰陣格網只會變雜訊。',
      '畫出每塊 512 格區域圖磚嘅邊界；圖磚細過 24 像素就自動收起，唔係就變雜訊。',
      '畫出每塊 512 格區域圖磚嘅界線，睇得出邊度一個檔完、下一個開始。細過 24 像素佢就識收埋，因為咁細睇落只係一片毛。',
      '畫出每塊 512 格區域圖磚嘅界線，睇得出邊度一個檔完、下一個開始。細過 24 像素佢就識收埋，因為咁細睇落只係一片毛。'
    ]
  },
  'map.layer.player': {
    en: ['Player marker', 'Player marker', 'Player marker', 'Player marker', 'Player marker'],
    yue: ['玩家標記', '玩家標記', '玩家標記', '玩家標記', '玩家標記']
  },
  'map.layer.player.description': {
    en: [
      'Draws the position the index last recorded for the player. It is drawn only while the viewer is showing the dimension the player is actually in; in any other dimension no marker is drawn, because the position would be meaningless there.',
      'Draws the position the index last recorded for the player. It is drawn only while the viewer is showing the dimension the player is actually in; in any other dimension no marker is drawn, because the position would be meaningless there.',
      'Draws where the index last saw the player. Only in the dimension the player is really in — anywhere else the position would mean nothing, so nothing is drawn.',
      'Draws where the index last saw you. It only appears in the dimension you are genuinely standing in; plotting your overworld position onto the Nether would be a confident lie, so it stays away.',
      'Draws where the index last saw you. It only appears in the dimension you are genuinely standing in; plotting your overworld position onto the Nether would be a confident lie, so it stays away.'
    ],
    yue: [
      '畫出索引最後記錄嘅玩家位置。只會喺玩家真正身處嘅維度顯示；其他維度唔會畫，因為個位置喺嗰度冇意思。',
      '畫出索引最後記錄嘅玩家位置。只會喺玩家真正身處嘅維度顯示；其他維度唔會畫，因為個位置喺嗰度冇意思。',
      '畫出索引最後見到玩家嘅位置，淨係喺佢真正身處嘅維度先出現，其他維度畫出嚟根本冇意思。',
      '畫出索引最後見到你嘅位置。淨係喺你真係企緊嗰個維度先會出現；將主世界坐標畫落地獄度係扮曬嘢呃人，所以佢唔會出現。',
      '畫出索引最後見到你嘅位置。淨係喺你真係企緊嗰個維度先會出現；將主世界坐標畫落地獄度係扮曬嘢呃人，所以佢唔會出現。'
    ]
  },
  'map.layer.markers': {
    en: ['Your markers', 'Your markers', 'Your markers', 'Your markers', 'Your markers'],
    yue: ['你嘅標記', '你嘅標記', '你嘅標記', '你嘅標記', '你嘅標記']
  },
  'map.layer.markers.description': {
    en: [
      'Draws the markers you have saved for the dimension on screen. Turning this off hides them from the canvas only; nothing is deleted and the marker list below is unaffected.',
      'Draws the markers you have saved for the dimension on screen. Turning this off hides them from the canvas only; nothing is deleted and the marker list below is unaffected.',
      'Draws the markers you saved for the dimension on screen. Off just hides them from the canvas — nothing is deleted, and the list below still has every one.',
      'Draws the markers you saved for whichever dimension is on screen. Switching it off only hides them from the canvas; not one is deleted and the list below still knows about all of them.',
      'Draws the markers you saved for whichever dimension is on screen. Switching it off only hides them from the canvas; not one is deleted and the list below still knows about all of them.'
    ],
    yue: [
      '畫出你為畫面上呢個維度儲低嘅標記。閂咗只係喺畫布上收起，唔會刪任何嘢，下面個標記清單照舊。',
      '畫出你為畫面上呢個維度儲低嘅標記。閂咗只係喺畫布上收起，唔會刪任何嘢，下面個標記清單照舊。',
      '畫出你為畫面上呢個維度儲低嘅標記。閂咗淨係喺畫布收埋，乜都唔會刪，下面清單一個都唔少。',
      '畫出你為畫面上嗰個維度儲低嘅標記。閂咗佢只係喺畫布度收埋，一個都唔會刪，下面個清單仲係知晒全部。',
      '畫出你為畫面上嗰個維度儲低嘅標記。閂咗佢只係喺畫布度收埋，一個都唔會刪，下面個清單仲係知晒全部。'
    ]
  },
  'map.layer.crosshair': {
    en: ['Centre crosshair', 'Centre crosshair', 'Centre crosshair', 'Centre crosshair', 'Centre crosshair'],
    yue: ['中心十字', '中心十字', '中心十字', '中心十字', '中心十字']
  },
  'map.layer.crosshair.description': {
    en: [
      'Marks the exact centre of the viewport, which is the point the centre coordinate readout reports and the point that jumping to coordinates lands on.',
      'Marks the exact centre of the viewport, which is the point the centre coordinate readout reports and the point that jumping to coordinates lands on.',
      'Marks the exact centre of the viewport — the same point the centre readout reports and the point a coordinate jump lands on.',
      'Marks dead centre of the viewport. That is the point the centre readout is talking about, and the point a coordinate jump drops you on.',
      'Marks dead centre of the viewport. That is the point the centre readout is talking about, and the point a coordinate jump drops you on.'
    ],
    yue: [
      '標示視窗正中心，亦即中心坐標讀數所指嘅點，同埋跳去坐標時落腳嘅點。',
      '標示視窗正中心，亦即中心坐標讀數所指嘅點，同埋跳去坐標時落腳嘅點。',
      '標示視窗正中心 — 就係中心讀數所講嗰點，亦即跳坐標會落嘅位。',
      '標示視窗正中間。中心讀數講緊嘅就係嗰點，跳坐標亦都係落嗰度。',
      '標示視窗正中間。中心讀數講緊嘅就係嗰點，跳坐標亦都係落嗰度。'
    ]
  },
  'map.smoothing': {
    en: ['Smooth when zoomed out', 'Smooth when zoomed out', 'Smooth when zoomed out', 'Smooth when zoomed out', 'Smooth when zoomed out'],
    yue: ['縮細時平滑處理', '縮細時平滑處理', '縮細時平滑處理', '縮細時平滑處理', '縮細時平滑處理']
  },
  'map.smoothing.description': {
    en: [
      'Interpolates tile pixels when the map is drawn below one pixel per block. Above that the tiles are drawn one pixel per block with no interpolation, so a single block stays a crisp square.',
      'Interpolates tile pixels when the map is drawn below one pixel per block. Above that the tiles are drawn one pixel per block with no interpolation, so a single block stays a crisp square.',
      'Blends tile pixels when the map is drawn smaller than one pixel per block. Zoomed in past that, blocks stay crisp squares with no blending.',
      'Blends the pixels when you are zoomed out past one pixel a block, so it stops looking like static. Zoomed in, every block stays a nice sharp square.',
      'Blends the pixels when you are zoomed out past one pixel a block, so it stops looking like static. Zoomed in, every block stays a nice sharp square.'
    ],
    yue: [
      '當地圖畫細過每格一像素時，會對圖磚像素做插值。放大過嗰個比例就一格一像素直出，唔做插值，方塊保持清晰。',
      '當地圖畫細過每格一像素時，會對圖磚像素做插值。放大過嗰個比例就一格一像素直出，唔做插值，方塊保持清晰。',
      '縮到細過每格一像素時會溝淡啲像素；放大返之後方塊維持清晰四方，唔會溝。',
      '縮到細過每格一像素嗰陣會溝一溝，唔好似雪花咁。放大返，每個方塊都係靚靚正方形。',
      '縮到細過每格一像素嗰陣會溝一溝，唔好似雪花咁。放大返，每個方塊都係靚靚正方形。'
    ]
  },
  'map.followPlayer': {
    en: ['Follow the player', 'Follow the player', 'Follow the player', 'Follow the player', 'Follow the player'],
    yue: ['跟住玩家', '跟住玩家', '跟住玩家', '跟住玩家', '跟住玩家']
  },
  'map.followPlayer.description': {
    en: [
      'Re-centres the viewport on the player each time the index reports a new position. Panning or zooming by hand turns it off, so a deliberate look somewhere else is never yanked back.',
      'Re-centres the viewport on the player each time the index reports a new position. Panning or zooming by hand turns it off, so a deliberate look somewhere else is never yanked back.',
      'Re-centres on the player whenever the index reports a new position. Panning or zooming by hand switches it off, so a deliberate look elsewhere is never dragged back.',
      'Snaps the view back onto the player every time the index reports a new position. Pan or zoom yourself and it politely gives up, so you are never yanked away from the thing you were looking at.',
      'Snaps the view back onto the player every time the index reports a new position. Pan or zoom yourself and it politely gives up, so you are never yanked away from the thing you were looking at.'
    ],
    yue: [
      '每次索引報告新位置就將視窗置中返喺玩家度。你手動平移或縮放就會自動閂咗，唔會將你扯返去。',
      '每次索引報告新位置就將視窗置中返喺玩家度。你手動平移或縮放就會自動閂咗，唔會將你扯返去。',
      '索引一報新位置就置中返喺玩家；你自己拉或者縮就會閂咗，唔會硬扯你返去。',
      '索引一報新位置就即刻彈返去玩家嗰度。你自己拉或者縮，佢就好識做咁放手，唔會將你由你想睇嗰忽扯走。',
      '索引一報新位置就即刻彈返去玩家嗰度。你自己拉或者縮，佢就好識做咁放手，唔會將你由你想睇嗰忽扯走。'
    ]
  },
  'map.autoRefresh': {
    en: ['Re-read the index automatically', 'Re-read the index automatically', 'Re-read the index automatically', 'Re-read the index automatically', 'Re-read the index automatically'],
    yue: ['自動重讀索引', '自動重讀索引', '自動重讀索引', '自動重讀索引', '自動重讀索引']
  },
  'map.autoRefresh.description': {
    en: [
      'Re-reads the index file on a timer so newly rendered tiles appear without a manual refresh. The renderer flushes about every three seconds, so nothing appears instantly however short this interval is.',
      'Re-reads the index file on a timer so newly rendered tiles appear without a manual refresh. The renderer flushes about every three seconds, so nothing appears instantly however short this interval is.',
      'Re-reads the index on a timer so fresh tiles turn up on their own. The renderer only flushes every three seconds or so, so nothing is instant no matter how short you set this.',
      'Keeps re-reading the index so fresh tiles turn up by themselves. The renderer only flushes every three seconds or so, so setting this to two seconds will not make chunks appear any faster — it just asks more often.',
      'Keeps re-reading the index so fresh tiles turn up by themselves. The renderer only flushes every three seconds or so, so setting this to two seconds will not make chunks appear any faster — it just asks more often.'
    ],
    yue: [
      '按時重讀索引檔，新算好嘅圖磚唔使手動刷新都會出現。算圖器大約每三秒先寫一次，所以無論你設幾短都唔會即時出現。',
      '按時重讀索引檔，新算好嘅圖磚唔使手動刷新都會出現。算圖器大約每三秒先寫一次，所以無論你設幾短都唔會即時出現。',
      '按時重讀索引，新圖磚自己會出現。算圖器大約三秒先寫一次，所以幾短都唔會即時。',
      '不停重讀索引，新圖磚自己走出嚟。算圖器大約三秒先寫一次，設做兩秒唔會令區塊出得快啲 — 淨係問密啲。',
      '不停重讀索引，新圖磚自己走出嚟。算圖器大約三秒先寫一次，設做兩秒唔會令區塊出得快啲 — 淨係問密啲。'
    ]
  },
  'map.refreshSeconds': {
    en: ['Seconds between re-reads', 'Seconds between re-reads', 'Seconds between re-reads', 'Seconds between re-reads', 'Seconds between re-reads'],
    yue: ['重讀之間嘅秒數', '重讀之間嘅秒數', '重讀之間嘅秒數', '重讀之間嘅秒數', '重讀之間嘅秒數']
  },
  'map.refreshSeconds.description': {
    en: [
      'How long to wait between automatic re-reads of the index file. Only the small index is read on the timer; a region tile is read once and cached until the index version changes.',
      'How long to wait between automatic re-reads of the index file. Only the small index is read on the timer; a region tile is read once and cached until the index version changes.',
      'How long between automatic re-reads of the index. Only the small index is read on the timer — a tile is read once and kept until the index version moves.',
      'How long between automatic re-reads. Only the tiny index file rides the timer; a region tile is read once and kept until the index says it changed, so a short interval is cheap.',
      'How long between automatic re-reads. Only the tiny index file rides the timer; a region tile is read once and kept until the index says it changed, so a short interval is cheap.'
    ],
    yue: [
      '每次自動重讀索引檔之間等幾耐。計時器只會讀細細個索引檔；區域圖磚讀一次就快取住，直到索引版本改變。',
      '每次自動重讀索引檔之間等幾耐。計時器只會讀細細個索引檔；區域圖磚讀一次就快取住，直到索引版本改變。',
      '自動重讀索引之間隔幾耐。計時器只讀細個索引檔 — 圖磚讀一次就留住，直到索引版本郁。',
      '自動重讀之間隔幾耐。跟住計時器行嘅只係嗰個好細嘅索引檔；區域圖磚讀一次就留住，直到索引話佢變咗，所以間隔短唔會蝕本。',
      '自動重讀之間隔幾耐。跟住計時器行嘅只係嗰個好細嘅索引檔；區域圖磚讀一次就留住，直到索引話佢變咗，所以間隔短唔會蝕本。'
    ]
  },
  'map.refreshSeconds.hint': {
    en: ['seconds', 'seconds', 'seconds', 'seconds', 'seconds'],
    yue: ['秒', '秒', '秒', '秒', '秒']
  },
  'map.tileCacheSize': {
    en: ['Tiles kept in memory', 'Tiles kept in memory', 'Tiles kept in memory', 'Tiles kept in memory', 'Tiles kept in memory'],
    yue: ['記憶體保留嘅圖磚數', '記憶體保留嘅圖磚數', '記憶體保留嘅圖磚數', '記憶體保留嘅圖磚數', '記憶體保留嘅圖磚數']
  },
  'map.tileCacheSize.description': {
    en: [
      'How many decoded region tiles are kept in memory before the least recently used one is dropped. A 512 by 512 tile costs about one megabyte decoded, so this number multiplied by one megabyte is roughly what the cache costs.',
      'How many decoded region tiles are kept in memory before the least recently used one is dropped. A 512 by 512 tile costs about one megabyte decoded, so this number multiplied by one megabyte is roughly what the cache costs.',
      'How many decoded tiles stay in memory before the least recently used one is dropped. Each decoded tile is about a megabyte, so this number is roughly the cost in megabytes.',
      'How many decoded tiles stay in memory before the oldest gets shown the door. Each one is about a megabyte decoded, so this number is roughly how many megabytes the cache costs you.',
      'How many decoded tiles stay in memory before the oldest gets shown the door. Each one is about a megabyte decoded, so this number is roughly how many megabytes the cache costs you.'
    ],
    yue: [
      '喺丟走最耐冇用嗰塊之前，記憶體保留幾多塊已解碼區域圖磚。一塊 512 乘 512 圖磚解碼後大約一 MB，所以呢個數乘一 MB 就大約係快取成本。',
      '喺丟走最耐冇用嗰塊之前，記憶體保留幾多塊已解碼區域圖磚。一塊 512 乘 512 圖磚解碼後大約一 MB，所以呢個數乘一 MB 就大約係快取成本。',
      '丟走最耐冇用嗰塊之前，記憶體留幾多塊已解碼圖磚。每塊大約一 MB，所以呢個數大約就係幾多 MB。',
      '喺請最舊嗰塊走之前，記憶體留幾多塊已解碼圖磚。每塊解碼後大約一 MB，所以呢個數大約就係個快取食你幾多 MB。',
      '喺請最舊嗰塊走之前，記憶體留幾多塊已解碼圖磚。每塊解碼後大約一 MB，所以呢個數大約就係個快取食你幾多 MB。'
    ]
  },
  'map.overviewDirectory': {
    en: ['World output folder', 'World output folder', 'World output folder', 'World output folder', 'World output folder'],
    yue: ['世界輸出資料夾', '世界輸出資料夾', '世界輸出資料夾', '世界輸出資料夾', '世界輸出資料夾']
  },
  'map.overviewDirectory.description': {
    en: [
      'The folder the downloader writes the world into. Either the world folder itself or the overview folder inside it is accepted, and both are checked before the viewer reports that no index was found. Nothing outside this folder is ever read.',
      'The folder the downloader writes the world into. Either the world folder itself or the overview folder inside it is accepted, and both are checked before the viewer reports that no index was found. Nothing outside this folder is ever read.',
      'The folder the downloader writes the world into. Give it the world folder or the overview folder inside it — both are checked before it reports that nothing was found, and nothing outside it is read.',
      'The folder the downloader dumps the world into. Hand it either the world folder or the overview folder inside it; both get checked before it admits it found nothing, and it never reads a byte outside that folder.',
      'The folder the downloader dumps the world into. Hand it either the world folder or the overview folder inside it; both get checked before it admits it found nothing, and it never reads a byte outside that folder.'
    ],
    yue: [
      '下載器寫世界嘅資料夾。世界資料夾本身或者入面嘅 overview 資料夾都收，兩個都會檢查過先會話搵唔到索引。呢個資料夾以外嘅嘢一律唔會讀。',
      '下載器寫世界嘅資料夾。世界資料夾本身或者入面嘅 overview 資料夾都收，兩個都會檢查過先會話搵唔到索引。呢個資料夾以外嘅嘢一律唔會讀。',
      '下載器寫世界嘅資料夾。俾世界資料夾或者入面 overview 都得，兩個都查完先會話搵唔到，資料夾以外嘅嘢唔會讀。',
      '下載器倒世界落去嗰個資料夾。俾世界資料夾或者入面嘅 overview 都收；兩個都查完先肯認搵唔到，而且資料夾以外一個 byte 都唔會讀。',
      '下載器倒世界落去嗰個資料夾。俾世界資料夾或者入面嘅 overview 都收；兩個都查完先肯認搵唔到，而且資料夾以外一個 byte 都唔會讀。'
    ]
  },
  'map.defaultMode': {
    en: ['Render mode at start-up', 'Render mode at start-up', 'Render mode at start-up', 'Render mode at start-up', 'Render mode at start-up'],
    yue: ['開機時嘅算圖模式', '開機時嘅算圖模式', '開機時嘅算圖模式', '開機時嘅算圖模式', '開機時嘅算圖模式']
  },
  'map.defaultMode.description': {
    en: [
      'Which of the renderer’s two modes the viewer opens on. Surface shows the top visible block; caves shows the cave rendering, which the Nether does not use because it is rendered with the surface variant instead.',
      'Which of the renderer’s two modes the viewer opens on. Surface shows the top visible block; caves shows the cave rendering, which the Nether does not use because it is rendered with the surface variant instead.',
      'Which of the two modes the viewer opens on. Surface is the top visible block; caves is the cave rendering, which the Nether skips because it uses the surface variant.',
      'Which of the two modes the viewer opens on. Surface is the top block you can see; caves is the cave rendering — the Nether ignores it entirely and uses the surface variant instead.',
      'Which of the two modes the viewer opens on. Surface is the top block you can see; caves is the cave rendering — the Nether ignores it entirely and uses the surface variant instead.'
    ],
    yue: [
      '檢視器開啟時用邊個算圖模式。地面顯示最頂可見方塊；洞穴顯示洞穴算圖，而地獄唔會用洞穴，佢用地面變體算。',
      '檢視器開啟時用邊個算圖模式。地面顯示最頂可見方塊；洞穴顯示洞穴算圖，而地獄唔會用洞穴，佢用地面變體算。',
      '檢視器開時用邊個模式。地面即係最頂睇到嗰塊；洞穴即係洞穴算圖，地獄唔用佢，改用地面變體。',
      '檢視器開嗰陣用邊個模式。地面即係你見到嘅最頂方塊；洞穴即係洞穴算圖 — 地獄完全唔理佢，改用地面變體。',
      '檢視器開嗰陣用邊個模式。地面即係你見到嘅最頂方塊；洞穴即係洞穴算圖 — 地獄完全唔理佢，改用地面變體。'
    ]
  },
  'map.revealFolder': {
    en: ['Show the tile folder', 'Show the tile folder', 'Show the tile folder', 'Show the tile folder', 'Show the tile folder'],
    yue: ['顯示圖磚資料夾', '顯示圖磚資料夾', '顯示圖磚資料夾', '顯示圖磚資料夾', '顯示圖磚資料夾']
  },
  'map.revealFolder.description': {
    en: [
      'Opens the folder the tiles are read from in the operating system file manager, so the PNG files can be inspected, copied or deleted directly.',
      'Opens the folder the tiles are read from in the operating system file manager, so the PNG files can be inspected, copied or deleted directly.',
      'Opens the folder the tiles come from in the file manager, so you can look at the PNG files, copy them or delete them yourself.',
      'Opens the folder the tiles come from in the file manager, so you can poke at the PNG files, copy them somewhere or delete the lot yourself.',
      'Opens the folder the tiles come from in the file manager, so you can poke at the PNG files, copy them somewhere or delete the lot yourself.'
    ],
    yue: [
      '喺作業系統檔案總管打開讀取圖磚嗰個資料夾，可以直接睇、複製或刪除啲 PNG 檔。',
      '喺作業系統檔案總管打開讀取圖磚嗰個資料夾，可以直接睇、複製或刪除啲 PNG 檔。',
      '喺檔案總管打開圖磚嗰個資料夾，你可以自己睇、抄走或者刪走啲 PNG。',
      '喺檔案總管打開圖磚嗰個資料夾，你可以自己撩下啲 PNG、抄走佢哋，或者一次過刪晒。',
      '喺檔案總管打開圖磚嗰個資料夾，你可以自己撩下啲 PNG、抄走佢哋，或者一次過刪晒。'
    ]
  },

  /* ---------------- readout ---------------- */

  'map.readout.title': {
    en: ['Position', 'Position', 'Position', 'Position', 'Position'],
    yue: ['位置', '位置', '位置', '位置', '位置']
  },
  'map.readout.pointer': {
    en: ['Pointer', 'Pointer', 'Pointer', 'Pointer', 'Pointer'],
    yue: ['游標', '游標', '游標', '游標', '游標']
  },
  'map.readout.pointerNone': {
    en: [
      'Pointer is not over the map',
      'Pointer is not over the map',
      'Pointer is off the map',
      'Pointer is off the map',
      'Pointer is off the map'
    ],
    yue: ['游標唔喺地圖上', '游標唔喺地圖上', '游標唔喺地圖度', '游標唔喺地圖度', '游標唔喺地圖度']
  },
  'map.readout.centre': {
    en: ['Centre', 'Centre', 'Centre', 'Centre', 'Centre'],
    yue: ['中心', '中心', '中心', '中心', '中心']
  },
  'map.readout.zoom': {
    en: ['Zoom', 'Zoom', 'Zoom', 'Zoom', 'Zoom'],
    yue: ['縮放', '縮放', '縮放', '縮放', '縮放']
  },
  'map.readout.zoomValue': {
    en: [
      '{pixels} pixels per block',
      '{pixels} pixels per block',
      '{pixels} pixels per block',
      '{pixels} pixels per block',
      '{pixels} pixels per block'
    ],
    yue: ['每格 {pixels} 像素', '每格 {pixels} 像素', '每格 {pixels} 像素', '每格 {pixels} 像素', '每格 {pixels} 像素']
  },
  'map.readout.scale': {
    en: ['{blocks} blocks', '{blocks} blocks', '{blocks} blocks', '{blocks} blocks', '{blocks} blocks'],
    yue: ['{blocks} 格', '{blocks} 格', '{blocks} 格', '{blocks} 格', '{blocks} 格']
  },
  'map.readout.player': {
    en: ['Player', 'Player', 'Player', 'Player', 'Player'],
    yue: ['玩家', '玩家', '玩家', '玩家', '玩家']
  },
  'map.readout.playerNone': {
    en: [
      'The index has no player position',
      'The index has no player position',
      'The index has no player position yet',
      'The index has no player position yet',
      'The index has no player position yet'
    ],
    yue: ['索引未有玩家位置', '索引未有玩家位置', '索引仲未有玩家位置', '索引仲未有玩家位置', '索引仲未有玩家位置']
  },
  'map.readout.playerElsewhere': {
    en: [
      'The player is in {dimension}',
      'The player is in {dimension}',
      'The player is over in {dimension}',
      'The player is over in {dimension}',
      'The player is over in {dimension}'
    ],
    yue: ['玩家喺 {dimension}', '玩家喺 {dimension}', '玩家而家喺 {dimension}', '玩家而家喺 {dimension}', '玩家而家喺 {dimension}']
  },
  'map.canvas.label': {
    en: ['Map viewport', 'Map viewport', 'Map viewport', 'Map viewport', 'Map viewport'],
    yue: ['地圖視窗', '地圖視窗', '地圖視窗', '地圖視窗', '地圖視窗']
  },
  'map.canvas.help': {
    en: [
      'Arrow keys pan, Shift and an arrow key pans one small step, plus and minus zoom, Page Up and Page Down zoom, Home returns to the origin. Drag to pan, scroll to zoom.',
      'Arrow keys pan, Shift and an arrow key pans one small step, plus and minus zoom, Page Up and Page Down zoom, Home returns to the origin. Drag to pan, scroll to zoom.',
      'Arrow keys pan; hold Shift for a small step; plus and minus or Page Up and Page Down zoom; Home goes back to the origin. Drag to pan and scroll to zoom.',
      'Arrow keys pan; hold Shift to creep along; plus and minus or Page Up and Page Down zoom; Home takes you back to nought, nought. Drag to pan and scroll to zoom.',
      'Arrow keys pan; hold Shift to creep along; plus and minus or Page Up and Page Down zoom; Home takes you back to nought, nought. Drag to pan and scroll to zoom.'
    ],
    yue: [
      '方向鍵平移，按住 Shift 加方向鍵行細步，加減號縮放，Page Up 同 Page Down 亦可縮放，Home 返回原點。拖曳可平移，滾輪可縮放。',
      '方向鍵平移，按住 Shift 加方向鍵行細步，加減號縮放，Page Up 同 Page Down 亦可縮放，Home 返回原點。拖曳可平移，滾輪可縮放。',
      '方向鍵平移；撳住 Shift 行細步；加減號或者 Page Up／Page Down 縮放；Home 返返原點。拖曳平移，滾輪縮放。',
      '方向鍵平移；撳住 Shift 慢慢挪；加減號或者 Page Up／Page Down 縮放；Home 帶你返零零嗰點。拖曳平移，滾輪縮放。',
      '方向鍵平移；撳住 Shift 慢慢挪；加減號或者 Page Up／Page Down 縮放；Home 帶你返零零嗰點。拖曳平移，滾輪縮放。'
    ]
  },

  /* ---------------- honest states ---------------- */

  'map.empty.noFolder.title': {
    en: [
      'No world folder is chosen yet',
      'No world folder is chosen yet',
      'No world folder chosen yet',
      'No world folder chosen yet',
      'No world folder chosen yet'
    ],
    yue: ['仲未揀世界資料夾', '仲未揀世界資料夾', '仲未揀世界資料夾', '仲未揀世界資料夾', '仲未揀世界資料夾']
  },
  'map.empty.noFolder.body': {
    en: [
      'The viewer reads region tiles the downloader has already written to disk. Choose the folder the downloader writes the world into and the map appears as soon as tiles exist there.',
      'The viewer reads region tiles the downloader has already written to disk. Choose the folder the downloader writes the world into and the map appears as soon as tiles exist there.',
      'This viewer only reads tiles the downloader already wrote to disk. Point it at the world folder and the map turns up as soon as there are tiles in it.',
      'This viewer only reads tiles that are already on your disk — it never renders a world itself and never asks the internet for one. Point it at the world folder and the map turns up the moment tiles exist.',
      'This viewer only reads tiles that are already on your disk — it never renders a world itself and never asks the internet for one. Point it at the world folder and the map turns up the moment tiles exist.'
    ],
    yue: [
      '檢視器只會讀下載器已經寫落硬碟嘅區域圖磚。揀返下載器寫世界嗰個資料夾，一有圖磚地圖就會出現。',
      '檢視器只會讀下載器已經寫落硬碟嘅區域圖磚。揀返下載器寫世界嗰個資料夾，一有圖磚地圖就會出現。',
      '呢個檢視器只讀下載器寫咗落硬碟嘅圖磚。指去世界資料夾，一有圖磚地圖就會現身。',
      '呢個檢視器淨係讀你硬碟上已經有嘅圖磚 — 佢自己唔會算圖，亦都唔會問互聯網攞。指去世界資料夾，一有圖磚就即刻見到。',
      '呢個檢視器淨係讀你硬碟上已經有嘅圖磚 — 佢自己唔會算圖，亦都唔會問互聯網攞。指去世界資料夾，一有圖磚就即刻見到。'
    ]
  },
  'map.empty.missingFolder.title': {
    en: [
      'That folder is not there',
      'That folder is not there',
      'That folder is not there',
      'That folder has gone missing',
      'That folder has gone missing'
    ],
    yue: ['嗰個資料夾唔喺度', '嗰個資料夾唔喺度', '嗰個資料夾唔喺度', '嗰個資料夾唔見咗', '嗰個資料夾唔見咗']
  },
  'map.empty.missingFolder.body': {
    en: [
      '{path} does not exist, or is not a folder. Nothing has been deleted by this viewer; choose the folder again or restore it on disk.',
      '{path} does not exist, or is not a folder. Nothing has been deleted by this viewer; choose the folder again or restore it on disk.',
      '{path} is not there, or is not a folder. This viewer deleted nothing — choose it again, or put it back on disk.',
      '{path} is not there, or is not a folder. This viewer has not deleted a thing; pick it again, or put it back where it was.',
      '{path} is not there, or is not a folder. This viewer has not deleted a thing; pick it again, or put it back where it was.'
    ],
    yue: [
      '{path} 唔存在，或者唔係資料夾。檢視器冇刪過任何嘢；請重新揀資料夾或者喺硬碟還原返。',
      '{path} 唔存在，或者唔係資料夾。檢視器冇刪過任何嘢；請重新揀資料夾或者喺硬碟還原返。',
      '{path} 唔喺度，或者唔係資料夾。檢視器乜都冇刪 — 重新揀過，或者放返落硬碟。',
      '{path} 唔喺度，或者唔係資料夾。檢視器一件嘢都冇刪；再揀多次，或者放返佢原本嗰個位。',
      '{path} 唔喺度，或者唔係資料夾。檢視器一件嘢都冇刪；再揀多次，或者放返佢原本嗰個位。'
    ]
  },
  'map.empty.noIndex.title': {
    en: [
      'No map index in that folder',
      'No map index in that folder',
      'No map index in that folder',
      'No map index in that folder',
      'No map index in that folder'
    ],
    yue: ['嗰個資料夾冇地圖索引', '嗰個資料夾冇地圖索引', '嗰個資料夾冇地圖索引', '嗰個資料夾冇地圖索引', '嗰個資料夾冇地圖索引']
  },
  'map.empty.noIndex.body': {
    en: [
      'Neither {first} nor {second} exists. The downloader writes that index only while overview rendering is on: it is on automatically in headless mode, can be forced with the render-map flag, and is switched off by the disable-map-render flag.',
      'Neither {first} nor {second} exists. The downloader writes that index only while overview rendering is on: it is on automatically in headless mode, can be forced with the render-map flag, and is switched off by the disable-map-render flag.',
      'Neither {first} nor {second} is there. The downloader only writes that index while overview rendering is on — automatic in headless mode, forced with the render-map flag, and killed by the disable-map-render flag.',
      'Neither {first} nor {second} exists. The downloader only writes that index while overview rendering is on: automatic when it runs headless, forced with the render-map flag, and switched off entirely by the disable-map-render flag.',
      'Neither {first} nor {second} exists. The downloader only writes that index while overview rendering is on: automatic when it runs headless, forced with the render-map flag, and switched off entirely by the disable-map-render flag.'
    ],
    yue: [
      '{first} 同 {second} 都唔存在。下載器只會喺總覽算圖開咗嗰陣先寫呢個索引：無介面模式會自動開，可以用 render-map 旗標強制開，用 disable-map-render 旗標就會閂。',
      '{first} 同 {second} 都唔存在。下載器只會喺總覽算圖開咗嗰陣先寫呢個索引：無介面模式會自動開，可以用 render-map 旗標強制開，用 disable-map-render 旗標就會閂。',
      '{first} 同 {second} 都唔喺度。下載器淨係喺總覽算圖開住嗰陣寫呢個索引 — 無介面模式自動開，render-map 旗標可以強制開，disable-map-render 旗標一撳就冇。',
      '{first} 同 {second} 都唔存在。下載器淨係喺總覽算圖開住嗰陣先寫呢個索引：跑無介面模式會自動開，可以用 render-map 旗標夾硬開，而 disable-map-render 旗標就會完全閂咗佢。',
      '{first} 同 {second} 都唔存在。下載器淨係喺總覽算圖開住嗰陣先寫呢個索引：跑無介面模式會自動開，可以用 render-map 旗標夾硬開，而 disable-map-render 旗標就會完全閂咗佢。'
    ]
  },
  'map.empty.noTiles.title': {
    en: [
      'The index is there, but it lists no tiles',
      'The index is there, but it lists no tiles',
      'The index is there and lists no tiles',
      'The index is there and lists exactly nothing',
      'The index is there and lists exactly nothing'
    ],
    yue: ['索引喺度，但係一塊圖磚都冇列', '索引喺度，但係一塊圖磚都冇列', '索引喺度，但係冇列到圖磚', '索引喺度，但係一樣嘢都冇列', '索引喺度，但係一樣嘢都冇列']
  },
  'map.empty.noTiles.body': {
    en: [
      'The renderer has started but has not flushed a tile yet. Tiles are flushed about every three seconds and only for chunks that have actually been loaded, so connect through the proxy and explore, then refresh.',
      'The renderer has started but has not flushed a tile yet. Tiles are flushed about every three seconds and only for chunks that have actually been loaded, so connect through the proxy and explore, then refresh.',
      'The renderer has started but has not flushed a tile yet. It flushes about every three seconds, and only for chunks that were actually loaded — connect through the proxy, explore a bit, then refresh.',
      'The renderer is up but has not flushed a single tile. It flushes about every three seconds, and only for chunks you have genuinely loaded, so go and walk somewhere through the proxy and come back.',
      'The renderer is up but has not flushed a single tile. It flushes about every three seconds, and only for chunks you have genuinely loaded, so go and walk somewhere through the proxy and come back.'
    ],
    yue: [
      '算圖器已經開咗，但仲未寫出任何圖磚。圖磚大約每三秒寫一次，而且只會寫真正載入過嘅區塊，所以請經代理連線去行下，再刷新。',
      '算圖器已經開咗，但仲未寫出任何圖磚。圖磚大約每三秒寫一次，而且只會寫真正載入過嘅區塊，所以請經代理連線去行下，再刷新。',
      '算圖器開咗但仲未寫出圖磚。佢大約三秒寫一次，而且只寫真係載入過嘅區塊 — 經代理連線行下，再刷新。',
      '算圖器起咗但一塊圖磚都未寫。佢大約三秒寫一次，而且只寫你真係載入過嘅區塊，所以經代理入去行走一陣先返嚟。',
      '算圖器起咗但一塊圖磚都未寫。佢大約三秒寫一次，而且只寫你真係載入過嘅區塊，所以經代理入去行走一陣先返嚟。'
    ]
  },
  'map.error.unreadable.title': {
    en: ['The index could not be read', 'The index could not be read', 'The index could not be read', 'The index would not open', 'The index would not open'],
    yue: ['讀唔到索引', '讀唔到索引', '讀唔到索引', '個索引唔肯開', '個索引唔肯開']
  },
  'map.error.unreadable.body': {
    en: [
      '{path} exists but could not be read. The operating system reported: {error}',
      '{path} exists but could not be read. The operating system reported: {error}',
      '{path} is there but would not open. The operating system said: {error}',
      '{path} is there but flatly refused to open. The operating system said: {error}',
      '{path} is there but flatly refused to open. The operating system said: {error}'
    ],
    yue: [
      '{path} 存在但讀唔到。作業系統報告：{error}',
      '{path} 存在但讀唔到。作業系統報告：{error}',
      '{path} 喺度但開唔到。作業系統話：{error}',
      '{path} 喺度但死都唔肯開。作業系統話：{error}',
      '{path} 喺度但死都唔肯開。作業系統話：{error}'
    ]
  },
  'map.error.invalid.title': {
    en: [
      'The index is not readable JSON',
      'The index is not readable JSON',
      'The index is not readable JSON',
      'The index is not readable JSON',
      'The index is not readable JSON'
    ],
    yue: ['索引唔係可讀嘅 JSON', '索引唔係可讀嘅 JSON', '索引唔係可讀嘅 JSON', '索引唔係可讀嘅 JSON', '索引唔係可讀嘅 JSON']
  },
  'map.error.invalid.body': {
    en: [
      '{path} was read but could not be parsed: {error}. This usually means the renderer was writing the file at the moment it was read; refreshing again normally succeeds.',
      '{path} was read but could not be parsed: {error}. This usually means the renderer was writing the file at the moment it was read; refreshing again normally succeeds.',
      '{path} was read but would not parse: {error}. Usually the renderer was mid-write when it was read, and a second refresh works.',
      '{path} was read but would not parse: {error}. Nine times out of ten the renderer was halfway through writing it, and a second refresh sorts it out.',
      '{path} was read but would not parse: {error}. Nine times out of ten the renderer was halfway through writing it, and a second refresh sorts it out.'
    ],
    yue: [
      '{path} 讀到但解析唔到：{error}。通常係讀嗰刻算圖器正寫緊個檔；再刷新多次一般就得。',
      '{path} 讀到但解析唔到：{error}。通常係讀嗰刻算圖器正寫緊個檔；再刷新多次一般就得。',
      '{path} 讀到但解唔到：{error}。多數係算圖器寫到一半，再刷新多次就掂。',
      '{path} 讀到但解唔到：{error}。十次有九次係算圖器寫到一半，再刷新多次就搞掂。',
      '{path} 讀到但解唔到：{error}。十次有九次係算圖器寫到一半，再刷新多次就搞掂。'
    ]
  },

  /* ---------------- markers ---------------- */

  'map.markers.title': {
    en: ['Markers', 'Markers', 'Markers', 'Markers', 'Markers'],
    yue: ['標記', '標記', '標記', '標記', '標記']
  },
  'map.markers.description': {
    en: [
      'Places you saved, stored with this application’s settings and never written into the world folder.',
      'Places you saved, stored with this application’s settings and never written into the world folder.',
      'Places you saved. They live with this application’s settings and are never written into the world folder.',
      'Places you saved. They live with this application’s settings and never touch the world folder, so nothing here can corrupt a download.',
      'Places you saved. They live with this application’s settings and never touch the world folder, so nothing here can corrupt a download.'
    ],
    yue: [
      '你儲低嘅地點，同呢個應用程式嘅設定一齊儲存，永遠唔會寫入世界資料夾。',
      '你儲低嘅地點，同呢個應用程式嘅設定一齊儲存，永遠唔會寫入世界資料夾。',
      '你儲低嘅地點。佢哋同應用程式設定一齊擺，永遠唔會寫入世界資料夾。',
      '你儲低嘅地點。佢哋同應用程式設定一齊擺，完全唔會掂世界資料夾，所以呢度做乜都搞唔壞你個下載。',
      '你儲低嘅地點。佢哋同應用程式設定一齊擺，完全唔會掂世界資料夾，所以呢度做乜都搞唔壞你個下載。'
    ]
  },
  'map.markers.search': {
    en: ['Search markers', 'Search markers', 'Search the markers', 'Search the markers', 'Search the markers'],
    yue: ['搜尋標記', '搜尋標記', '搵下啲標記', '搵下啲標記', '搵下啲標記']
  },
  'map.markers.none.title': {
    en: ['No markers yet', 'No markers yet', 'No markers yet', 'No markers yet', 'No markers yet'],
    yue: ['仲未有標記', '仲未有標記', '仲未有標記', '仲未有標記', '仲未有標記']
  },
  'map.markers.none.body': {
    en: [
      'Centre the map on a place worth remembering and add a marker for it. Markers can be renamed, hidden, exported and deleted at any time.',
      'Centre the map on a place worth remembering and add a marker for it. Markers can be renamed, hidden, exported and deleted at any time.',
      'Centre the map on somewhere worth remembering, then add a marker for it. You can rename, hide, export and delete them whenever you like.',
      'Centre the map on somewhere worth remembering and pin it. Rename it, hide it, export it or bin it later — none of that is a one-way door.',
      'Centre the map on somewhere worth remembering and pin it. Rename it, hide it, export it or bin it later — none of that is a one-way door.'
    ],
    yue: [
      '將地圖置中喺值得記住嘅地方，然後加個標記。標記隨時可以改名、收起、匯出同刪除。',
      '將地圖置中喺值得記住嘅地方，然後加個標記。標記隨時可以改名、收起、匯出同刪除。',
      '將地圖置中喺值得記低嘅地方，跟住加個標記。改名、收埋、匯出、刪除，幾時都得。',
      '將地圖置中喺值得記低嘅地方，然後釘一個。之後想改名、收埋、匯出定係掉咗佢都得 — 冇一樣係一去不返。',
      '將地圖置中喺值得記低嘅地方，然後釘一個。之後想改名、收埋、匯出定係掉咗佢都得 — 冇一樣係一去不返。'
    ]
  },
  'map.markers.empty.title': {
    en: ['Nothing matched', 'Nothing matched', 'Nothing matched', 'Nothing matched', 'Nothing matched'],
    yue: ['冇嘢符合', '冇嘢符合', '冇嘢符合', '冇嘢符合', '冇嘢符合']
  },
  'map.markers.empty.body': {
    en: [
      'No marker matched the current search. Clearing the field brings all of them back; nothing was deleted.',
      'No marker matched the current search. Clearing the field brings all of them back; nothing was deleted.',
      'No marker matched that search. Clear the field and they all come back — nothing was deleted.',
      'Not one marker matched that search. Clear the field and the whole lot comes back; nothing was deleted.',
      'Not one marker matched that search. Clear the field and the whole lot comes back; nothing was deleted.'
    ],
    yue: [
      '冇標記符合目前嘅搜尋。清空個欄位就會全部返晒嚟；冇刪過任何嘢。',
      '冇標記符合目前嘅搜尋。清空個欄位就會全部返晒嚟；冇刪過任何嘢。',
      '冇標記符合呢個搜尋。清空個欄位就全部返晒嚟 — 冇刪過嘢。',
      '一個標記都唔符合。清空個欄位，成班就返晒嚟；一件都冇刪。',
      '一個標記都唔符合。清空個欄位，成班就返晒嚟；一件都冇刪。'
    ]
  },
  'map.markers.add': {
    en: [
      'Add a marker here',
      'Add a marker here',
      'Add a marker right here',
      'Pin this spot',
      'Pin this spot'
    ],
    yue: ['喺呢度加標記', '喺呢度加標記', '就喺呢度加個標記', '釘住呢個位', '釘住呢個位']
  },
  'map.markers.name': {
    en: ['Marker name', 'Marker name', 'Marker name', 'Marker name', 'Marker name'],
    yue: ['標記名稱', '標記名稱', '標記名稱', '標記名稱', '標記名稱']
  },
  'map.markers.namePlaceholder': {
    en: ['Name this place', 'Name this place', 'Name this place', 'Give the place a name', 'Give the place a name'],
    yue: ['幫呢個地方改名', '幫呢個地方改名', '幫呢個地方改名', '同呢個地方改個名', '同呢個地方改個名']
  },
  'map.markers.unnamed': {
    en: ['Unnamed marker', 'Unnamed marker', 'Unnamed marker', 'Unnamed marker', 'Unnamed marker'],
    yue: ['未命名標記', '未命名標記', '未命名標記', '未命名標記', '未命名標記']
  },
  'map.markers.visible': {
    en: ['Draw on the map', 'Draw on the map', 'Draw it on the map', 'Draw it on the map', 'Draw it on the map'],
    yue: ['喺地圖上顯示', '喺地圖上顯示', '喺地圖度畫出嚟', '喺地圖度畫出嚟', '喺地圖度畫出嚟']
  },
  'map.markers.colour': {
    en: ['Marker colour', 'Marker colour', 'Marker colour', 'Marker colour', 'Marker colour'],
    yue: ['標記顏色', '標記顏色', '標記顏色', '標記顏色', '標記顏色']
  },
  'map.markers.colour.primary': {
    en: ['Primary', 'Primary', 'Primary', 'Primary', 'Primary'],
    yue: ['主色', '主色', '主色', '主色', '主色']
  },
  'map.markers.colour.secondary': {
    en: ['Secondary', 'Secondary', 'Secondary', 'Secondary', 'Secondary'],
    yue: ['次色', '次色', '次色', '次色', '次色']
  },
  'map.markers.colour.tertiary': {
    en: ['Tertiary', 'Tertiary', 'Tertiary', 'Tertiary', 'Tertiary'],
    yue: ['第三色', '第三色', '第三色', '第三色', '第三色']
  },
  'map.markers.colour.error': {
    en: ['Danger', 'Danger', 'Danger', 'Danger', 'Danger'],
    yue: ['危險', '危險', '危險', '危險', '危險']
  },
  'map.markers.colour.success': {
    en: ['Safe', 'Safe', 'Safe', 'Safe', 'Safe'],
    yue: ['安全', '安全', '安全', '安全', '安全']
  },
  'map.markers.colour.warning': {
    en: ['Caution', 'Caution', 'Caution', 'Caution', 'Caution'],
    yue: ['注意', '注意', '注意', '注意', '注意']
  },
  'map.markers.goto': {
    en: ['Go to this marker', 'Go to this marker', 'Go to this marker', 'Take me there', 'Take me there'],
    yue: ['去呢個標記', '去呢個標記', '去呢個標記', '帶我去嗰度', '帶我去嗰度']
  },
  'map.markers.count': {
    en: [
      '{shown} of {total} markers shown',
      '{shown} of {total} markers shown',
      '{shown} of {total} markers shown',
      '{shown} of {total} markers shown',
      '{shown} of {total} markers shown'
    ],
    yue: ['顯示緊 {total} 個標記入面嘅 {shown} 個', '顯示緊 {total} 個標記入面嘅 {shown} 個', '顯示緊 {total} 個標記入面嘅 {shown} 個', '顯示緊 {total} 個標記入面嘅 {shown} 個', '顯示緊 {total} 個標記入面嘅 {shown} 個']
  },
  'map.markers.selectShown': {
    en: [
      'Select the {count} shown',
      'Select the {count} shown',
      'Select the {count} shown',
      'Select the {count} shown',
      'Select the {count} shown'
    ],
    yue: ['選取顯示緊嘅 {count} 個', '選取顯示緊嘅 {count} 個', '選取顯示緊嘅 {count} 個', '選取顯示緊嘅 {count} 個', '選取顯示緊嘅 {count} 個']
  },
  'map.markers.selectAll': {
    en: [
      'Select every marker ({count})',
      'Select every marker ({count})',
      'Select every marker ({count})',
      'Select every marker ({count})',
      'Select every marker ({count})'
    ],
    yue: ['選取全部標記（{count} 個）', '選取全部標記（{count} 個）', '選取全部標記（{count} 個）', '選取全部標記（{count} 個）', '選取全部標記（{count} 個）']
  },
  'map.markers.invert': {
    en: ['Invert the selection', 'Invert the selection', 'Invert the selection', 'Invert the selection', 'Invert the selection'],
    yue: ['反轉選取', '反轉選取', '反轉選取', '反轉選取', '反轉選取']
  },
  'map.markers.clearSelection': {
    en: ['Clear the selection', 'Clear the selection', 'Clear the selection', 'Clear the selection', 'Clear the selection'],
    yue: ['清除選取', '清除選取', '清除選取', '清除選取', '清除選取']
  },
  'map.markers.show': {
    en: ['Show selected', 'Show selected', 'Show the selected ones', 'Show the selected ones', 'Show the selected ones'],
    yue: ['顯示已選', '顯示已選', '顯示揀咗嗰啲', '顯示揀咗嗰啲', '顯示揀咗嗰啲']
  },
  'map.markers.hide': {
    en: ['Hide selected', 'Hide selected', 'Hide the selected ones', 'Hide the selected ones', 'Hide the selected ones'],
    yue: ['收起已選', '收起已選', '收埋揀咗嗰啲', '收埋揀咗嗰啲', '收埋揀咗嗰啲']
  },
  'map.markers.delete': {
    en: ['Delete selected', 'Delete selected', 'Delete the selected ones', 'Delete the selected ones', 'Delete the selected ones'],
    yue: ['刪除已選', '刪除已選', '刪走揀咗嗰啲', '刪走揀咗嗰啲', '刪走揀咗嗰啲']
  },
  'map.markers.export': {
    en: ['Export markers', 'Export markers', 'Export the markers', 'Export the markers', 'Export the markers'],
    yue: ['匯出標記', '匯出標記', '匯出啲標記', '匯出啲標記', '匯出啲標記']
  },
  'map.markers.format': {
    en: ['Export format', 'Export format', 'Export format', 'Export format', 'Export format'],
    yue: ['匯出格式', '匯出格式', '匯出格式', '匯出格式', '匯出格式']
  },
  'map.markers.selected': {
    en: ['{count} selected', '{count} selected', '{count} selected', '{count} selected', '{count} selected'],
    yue: ['已選 {count} 個', '已選 {count} 個', '已選 {count} 個', '已選 {count} 個', '已選 {count} 個']
  },
  'map.markers.nothingSelected': {
    en: [
      'Select at least one marker first',
      'Select at least one marker first',
      'Select at least one marker first',
      'Select at least one marker first',
      'Select at least one marker first'
    ],
    yue: ['先至少揀一個標記', '先至少揀一個標記', '先至少揀一個標記', '先至少揀一個標記', '先至少揀一個標記']
  },
  'map.markers.otherDimension': {
    en: [
      'In {dimension}, which is not the dimension on screen',
      'In {dimension}, which is not the dimension on screen',
      'In {dimension} — not the dimension on screen',
      'In {dimension} — not the dimension on screen',
      'In {dimension} — not the dimension on screen'
    ],
    yue: ['喺 {dimension}，唔係畫面上嗰個維度', '喺 {dimension}，唔係畫面上嗰個維度', '喺 {dimension} — 唔係畫面上嗰個', '喺 {dimension} — 唔係畫面上嗰個', '喺 {dimension} — 唔係畫面上嗰個']
  },
  'map.markers.added': {
    en: ['Marker added at {x}, {z}', 'Marker added at {x}, {z}', 'Marker added at {x}, {z}', 'Pinned {x}, {z}', 'Pinned {x}, {z}'],
    yue: ['喺 {x}, {z} 加咗標記', '喺 {x}, {z} 加咗標記', '喺 {x}, {z} 加咗標記', '釘咗 {x}, {z}', '釘咗 {x}, {z}']
  },
  'map.markers.deleted': {
    en: [
      '{count} markers deleted',
      '{count} markers deleted',
      '{count} markers deleted',
      '{count} markers deleted',
      '{count} markers deleted'
    ],
    yue: ['刪咗 {count} 個標記', '刪咗 {count} 個標記', '刪咗 {count} 個標記', '刪咗 {count} 個標記', '刪咗 {count} 個標記']
  },
  'map.markers.restored': {
    en: [
      '{count} markers restored',
      '{count} markers restored',
      '{count} markers restored',
      '{count} markers back where they were',
      '{count} markers back where they were'
    ],
    yue: ['還原咗 {count} 個標記', '還原咗 {count} 個標記', '還原咗 {count} 個標記', '{count} 個標記返晒原位', '{count} 個標記返晒原位']
  },
  'map.markers.undo': {
    en: ['Put them back', 'Put them back', 'Put them back', 'Put them back', 'Put them back'],
    yue: ['放返佢哋', '放返佢哋', '放返佢哋', '放返佢哋', '放返佢哋']
  },
  'map.markers.visibilityChanged': {
    en: [
      '{count} markers changed',
      '{count} markers changed',
      '{count} markers changed',
      '{count} markers changed',
      '{count} markers changed'
    ],
    yue: ['改咗 {count} 個標記', '改咗 {count} 個標記', '改咗 {count} 個標記', '改咗 {count} 個標記', '改咗 {count} 個標記']
  },
  'map.markers.full': {
    en: [
      'The marker list is full at {limit}. Delete one before adding another.',
      'The marker list is full at {limit}. Delete one before adding another.',
      'The marker list is full at {limit}. Delete one before adding another.',
      'The marker list is full at {limit}. Something has to go before something else arrives.',
      'The marker list is full at {limit}. Something has to go before something else arrives.'
    ],
    yue: [
      '標記清單已滿（上限 {limit}）。要加新嘅就要先刪一個。',
      '標記清單已滿（上限 {limit}）。要加新嘅就要先刪一個。',
      '標記清單滿咗（上限 {limit}）。加新嘅之前要先刪一個。',
      '標記清單爆晒（上限 {limit}）。要入新嘅，就要有舊嘅走先。',
      '標記清單爆晒（上限 {limit}）。要入新嘅，就要有舊嘅走先。'
    ]
  },
  'map.markers.deletePreview': {
    en: [
      'These {count} markers will be deleted',
      'These {count} markers will be deleted',
      'These {count} markers will be deleted',
      'These {count} markers will be deleted',
      'These {count} markers will be deleted'
    ],
    yue: ['以下 {count} 個標記將會被刪除', '以下 {count} 個標記將會被刪除', '以下 {count} 個標記將會被刪除', '以下 {count} 個標記將會被刪除', '以下 {count} 個標記將會被刪除']
  },

  /* ---------------- jump ---------------- */

  'map.jump.title': {
    en: ['Go to coordinates', 'Go to coordinates', 'Go to coordinates', 'Go to coordinates', 'Go to coordinates'],
    yue: ['去指定坐標', '去指定坐標', '去指定坐標', '去指定坐標', '去指定坐標']
  },
  'map.jump.description': {
    en: [
      'Centres the viewport on one point. The height is recorded on a marker but does not affect the plan view, which is drawn from directly overhead.',
      'Centres the viewport on one point. The height is recorded on a marker but does not affect the plan view, which is drawn from directly overhead.',
      'Centres the viewport on a point. Height is kept on a marker but changes nothing on screen — this view is straight down from above.',
      'Centres the viewport on a point. Height gets written onto a marker but changes nothing you can see, because this view is straight down from above.',
      'Centres the viewport on a point. Height gets written onto a marker but changes nothing you can see, because this view is straight down from above.'
    ],
    yue: [
      '將視窗置中喺一個點。高度會記錄喺標記上，但唔會影響呢個由正上方睇落嚟嘅平面圖。',
      '將視窗置中喺一個點。高度會記錄喺標記上，但唔會影響呢個由正上方睇落嚟嘅平面圖。',
      '將視窗置中喺一點。高度會記喺標記度但畫面上冇分別 — 呢個視角係由上而下直望。',
      '將視窗置中喺一點。高度會寫落標記度，但你係睇唔出分別嘅，因為呢個視角係由正上方直望落去。',
      '將視窗置中喺一點。高度會寫落標記度，但你係睇唔出分別嘅，因為呢個視角係由正上方直望落去。'
    ]
  },
  'map.jump.x': {
    en: ['X', 'X', 'X', 'X', 'X'],
    yue: ['X', 'X', 'X', 'X', 'X']
  },
  'map.jump.y': {
    en: ['Y (height, recorded on a marker)', 'Y (height, recorded on a marker)', 'Y (height, recorded on a marker)', 'Y (height, recorded on a marker)', 'Y (height, recorded on a marker)'],
    yue: ['Y（高度，記錄喺標記上）', 'Y（高度，記錄喺標記上）', 'Y（高度，記錄喺標記上）', 'Y（高度，記錄喺標記上）', 'Y（高度，記錄喺標記上）']
  },
  'map.jump.z': {
    en: ['Z', 'Z', 'Z', 'Z', 'Z'],
    yue: ['Z', 'Z', 'Z', 'Z', 'Z']
  },
  'map.jump.go': {
    en: ['Go there', 'Go there', 'Go there', 'Go there', 'Go there'],
    yue: ['去嗰度', '去嗰度', '去嗰度', '去嗰度', '去嗰度']
  },
  'map.jump.goAndMark': {
    en: [
      'Go there and add a marker',
      'Go there and add a marker',
      'Go there and add a marker',
      'Go there and pin it',
      'Go there and pin it'
    ],
    yue: ['去嗰度並加標記', '去嗰度並加標記', '去嗰度並加標記', '去嗰度順手釘住佢', '去嗰度順手釘住佢']
  },
  'map.jump.error.blank': {
    en: [
      'Enter a value for {field}. Nothing has moved.',
      'Enter a value for {field}. Nothing has moved.',
      'Enter a value for {field}. Nothing has moved.',
      'Enter a value for {field}. Nothing has moved.',
      'Enter a value for {field}. Nothing has moved.'
    ],
    yue: ['請輸入 {field} 嘅數值。畫面冇郁過。', '請輸入 {field} 嘅數值。畫面冇郁過。', '請輸入 {field} 嘅數值。畫面冇郁過。', '請輸入 {field} 嘅數值。畫面冇郁過。', '請輸入 {field} 嘅數值。畫面冇郁過。']
  },
  'map.jump.error.number': {
    en: [
      '{field} must be a whole number, such as -1240. Nothing has moved.',
      '{field} must be a whole number, such as -1240. Nothing has moved.',
      '{field} has to be a whole number, such as -1240. Nothing has moved.',
      '{field} has to be a whole number, such as -1240. Nothing has moved.',
      '{field} has to be a whole number, such as -1240. Nothing has moved.'
    ],
    yue: [
      '{field} 必須係整數，例如 -1240。畫面冇郁過。',
      '{field} 必須係整數，例如 -1240。畫面冇郁過。',
      '{field} 要係整數，例如 -1240。畫面冇郁過。',
      '{field} 要係整數，例如 -1240。畫面冇郁過。',
      '{field} 要係整數，例如 -1240。畫面冇郁過。'
    ]
  },
  'map.jump.error.range': {
    en: [
      '{field} must be between {min} and {max}. Nothing has moved.',
      '{field} must be between {min} and {max}. Nothing has moved.',
      '{field} has to sit between {min} and {max}. Nothing has moved.',
      '{field} has to sit between {min} and {max}. Nothing has moved.',
      '{field} has to sit between {min} and {max}. Nothing has moved.'
    ],
    yue: [
      '{field} 必須喺 {min} 同 {max} 之間。畫面冇郁過。',
      '{field} 必須喺 {min} 同 {max} 之間。畫面冇郁過。',
      '{field} 要喺 {min} 同 {max} 之間。畫面冇郁過。',
      '{field} 要喺 {min} 同 {max} 之間。畫面冇郁過。',
      '{field} 要喺 {min} 同 {max} 之間。畫面冇郁過。'
    ]
  },
  'map.jump.error.dimension': {
    en: [
      'Choose a dimension first. None has any tiles yet, so there is nothing to jump into.',
      'Choose a dimension first. None has any tiles yet, so there is nothing to jump into.',
      'Choose a dimension first — none has tiles yet, so there is nowhere to jump to.',
      'Choose a dimension first. None of them has tiles yet, so there is nowhere to jump to.',
      'Choose a dimension first. None of them has tiles yet, so there is nowhere to jump to.'
    ],
    yue: [
      '請先揀維度。而家一個都未有圖磚，所以冇地方可以跳去。',
      '請先揀維度。而家一個都未有圖磚，所以冇地方可以跳去。',
      '請先揀維度 — 而家一個都未有圖磚，冇地方可以跳。',
      '請先揀維度。而家一個都未有圖磚，冇地方可以跳過去。',
      '請先揀維度。而家一個都未有圖磚，冇地方可以跳過去。'
    ]
  },
  'map.jump.done': {
    en: ['Centred on {x}, {z}', 'Centred on {x}, {z}', 'Centred on {x}, {z}', 'Centred on {x}, {z}', 'Centred on {x}, {z}'],
    yue: ['已置中喺 {x}, {z}', '已置中喺 {x}, {z}', '已置中喺 {x}, {z}', '已置中喺 {x}, {z}', '已置中喺 {x}, {z}']
  },
  'map.jump.preset.player': {
    en: ['Use the player position', 'Use the player position', 'Use the player position', 'Use the player position', 'Use the player position'],
    yue: ['用玩家位置', '用玩家位置', '用玩家位置', '用玩家位置', '用玩家位置']
  },
  'map.jump.preset.origin': {
    en: ['Use the origin', 'Use the origin', 'Use the origin', 'Use the origin', 'Use the origin'],
    yue: ['用原點', '用原點', '用原點', '用原點', '用原點']
  },
  'map.jump.preset.tiles': {
    en: [
      'Use the centre of the explored area',
      'Use the centre of the explored area',
      'Use the centre of what you have explored',
      'Use the centre of what you have explored',
      'Use the centre of what you have explored'
    ],
    yue: ['用已探索範圍嘅中心', '用已探索範圍嘅中心', '用你探索過範圍嘅中心', '用你探索過範圍嘅中心', '用你探索過範圍嘅中心']
  },
  'map.jump.noPlayer': {
    en: [
      'The index has no player position to copy',
      'The index has no player position to copy',
      'The index has no player position to copy',
      'The index has no player position to copy',
      'The index has no player position to copy'
    ],
    yue: ['索引冇玩家位置可以攞', '索引冇玩家位置可以攞', '索引冇玩家位置可以攞', '索引冇玩家位置可以攞', '索引冇玩家位置可以攞']
  },
  'map.jump.noTiles': {
    en: [
      'There are no tiles to centre on yet',
      'There are no tiles to centre on yet',
      'There are no tiles to centre on yet',
      'There are no tiles to centre on yet',
      'There are no tiles to centre on yet'
    ],
    yue: ['而家未有圖磚可以置中', '而家未有圖磚可以置中', '而家未有圖磚可以置中', '而家未有圖磚可以置中', '而家未有圖磚可以置中']
  },

  /* ---------------- export and notifications ---------------- */

  'map.export.saved': {
    en: ['Markers written to {path}', 'Markers written to {path}', 'Markers written to {path}', 'Markers written to {path}', 'Markers written to {path}'],
    yue: ['標記已寫入 {path}', '標記已寫入 {path}', '標記已寫入 {path}', '標記已寫入 {path}', '標記已寫入 {path}']
  },
  'map.export.losses': {
    en: [
      'This format cannot carry: {fields}',
      'This format cannot carry: {fields}',
      'This format cannot carry: {fields}',
      'This format cannot carry: {fields}',
      'This format cannot carry: {fields}'
    ],
    yue: ['呢個格式載唔到：{fields}', '呢個格式載唔到：{fields}', '呢個格式載唔到：{fields}', '呢個格式載唔到：{fields}', '呢個格式載唔到：{fields}']
  },
  'map.notify.folderChosen': {
    en: ['Reading the map from {path}', 'Reading the map from {path}', 'Reading the map from {path}', 'Reading the map from {path}', 'Reading the map from {path}'],
    yue: ['由 {path} 讀取地圖', '由 {path} 讀取地圖', '由 {path} 讀取地圖', '由 {path} 讀取地圖', '由 {path} 讀取地圖']
  },
  'map.notify.refreshed': {
    en: [
      'Index re-read: {tiles} tiles',
      'Index re-read: {tiles} tiles',
      'Index re-read: {tiles} tiles',
      'Index re-read: {tiles} tiles',
      'Index re-read: {tiles} tiles'
    ],
    yue: ['索引已重讀：{tiles} 塊圖磚', '索引已重讀：{tiles} 塊圖磚', '索引已重讀：{tiles} 塊圖磚', '索引已重讀：{tiles} 塊圖磚', '索引已重讀：{tiles} 塊圖磚']
  },
  'map.notify.folderFailed': {
    en: [
      'That folder could not be opened: {error}',
      'That folder could not be opened: {error}',
      'That folder would not open: {error}',
      'That folder would not open: {error}',
      'That folder would not open: {error}'
    ],
    yue: ['打唔開嗰個資料夾：{error}', '打唔開嗰個資料夾：{error}', '嗰個資料夾唔肯開：{error}', '嗰個資料夾唔肯開：{error}', '嗰個資料夾唔肯開：{error}']
  },

  /* ---------------- palette ---------------- */

  'map.palette.open': {
    en: ['Open the live map', 'Open the live map', 'Open the live map', 'Open the live map', 'Open the live map'],
    yue: ['打開即時地圖', '打開即時地圖', '打開即時地圖', '打開即時地圖', '打開即時地圖']
  },
  'map.palette.jump': {
    en: [
      'Live map: go to coordinates',
      'Live map: go to coordinates',
      'Live map: go to coordinates',
      'Live map: go to coordinates',
      'Live map: go to coordinates'
    ],
    yue: ['即時地圖：去指定坐標', '即時地圖：去指定坐標', '即時地圖：去指定坐標', '即時地圖：去指定坐標', '即時地圖：去指定坐標']
  },
  'map.palette.markers': {
    en: ['Live map: markers', 'Live map: markers', 'Live map: markers', 'Live map: markers', 'Live map: markers'],
    yue: ['即時地圖：標記', '即時地圖：標記', '即時地圖：標記', '即時地圖：標記', '即時地圖：標記']
  },
  'map.palette.layers': {
    en: ['Live map: layers', 'Live map: layers', 'Live map: layers', 'Live map: layers', 'Live map: layers'],
    yue: ['即時地圖：圖層', '即時地圖：圖層', '即時地圖：圖層', '即時地圖：圖層', '即時地圖：圖層']
  },
  'map.palette.refresh': {
    en: [
      'Live map: re-read the index now',
      'Live map: re-read the index now',
      'Live map: re-read the index now',
      'Live map: re-read the index now',
      'Live map: re-read the index now'
    ],
    yue: ['即時地圖：即刻重讀索引', '即時地圖：即刻重讀索引', '即時地圖：即刻重讀索引', '即時地圖：即刻重讀索引', '即時地圖：即刻重讀索引']
  }
};
