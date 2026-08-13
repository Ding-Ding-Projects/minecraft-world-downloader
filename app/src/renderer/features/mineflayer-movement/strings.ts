import type { Catalogue } from '../../core/registry';

/**
 * Every word this surface says, in both languages, at all five humour levels.
 *
 * The humour styles the voice and never the facts. A refusal still names the
 * exact condition that was not met, a failed walk still reports the metres that
 * were left, and a control that is held still says which control it is — at
 * level 5 in Cantonese exactly as at level 1 in English.
 */
export const MOVEMENT_STRINGS: Catalogue = {
  /* ---------------- the destination itself ---------------- */

  'mineflayerMovement.tab.title': {
    en: ['Bot movement', 'Bot movement', 'Bot movement', 'Piloting the bot', 'Piloting the bot'],
    yue: ['機械人移動', '機械人移動', '機械人郁動', '揸機械人', '揸機械人']
  },
  'mineflayerMovement.tab.subtitle': {
    en: [
      'Directional controls, look, ray tracing and straight-line walking.',
      'Directional controls, look, ray tracing and straight-line walking.',
      'Steer it, aim it, trace what it is looking at, and send it walking in a straight line.',
      'Steer it, aim its head, shoot a ray at whatever it is staring at, and march it in a straight line.',
      'Steer it, aim its head, shoot a ray at whatever it is staring at, and march it in a straight line.'
    ],
    yue: [
      '方向控制、視線、射線偵測同直線行走。',
      '方向控制、視線、射線偵測同直線行走。',
      '揸方向、擰個頭、射條線睇下佢望緊乜、再叫佢直線行過去。',
      '揸方向、扭個頭、射條線睇下佢盯住嘅係乜、然後叫佢一條直線衝過去。',
      '揸方向、扭個頭、射條線睇下佢盯住嘅係乜、然後叫佢一條直線衝過去。'
    ]
  },

  /* ---------------- section headings ---------------- */

  'mineflayerMovement.section.status': {
    en: ['Live read-out', 'Live read-out', 'Live read-out', 'What the bot is doing right now', 'What the bot is doing right now'],
    yue: ['即時數據', '即時數據', '即時數據', '而家隻機械人做緊乜', '而家隻機械人做緊乜']
  },
  'mineflayerMovement.section.status.description': {
    en: [
      'Position, velocity, facing and on-ground state, read from the running bot. Nothing here is simulated while nothing is connected.',
      'Position, velocity, facing and on-ground state, read from the running bot. Nothing here is simulated while nothing is connected.',
      'Position, velocity, facing and whether its feet are on the floor — straight off the running bot. With nothing connected it shows nothing rather than making numbers up.',
      'Position, velocity, facing and whether its feet are actually on the floor — straight off the running bot. Disconnected, it shows you nothing at all, because inventing numbers would be a lie with decimal places.',
      'Position, velocity, facing and whether its feet are actually on the floor — straight off the running bot. Disconnected, it shows you nothing at all, because inventing numbers would be a lie with decimal places.'
    ],
    yue: [
      '位置、速度、朝向同埋落唔落地，全部由運行中嘅機械人度讀返嚟。無連線嘅時候唔會模擬任何數值。',
      '位置、速度、朝向同埋落唔落地，全部由運行中嘅機械人度讀返嚟。無連線嘅時候唔會模擬任何數值。',
      '位置、速度、朝向同對腳有無踩住地，全部真係由機械人度攞。無連線就乜都唔顯示，唔會作數。',
      '位置、速度、朝向同對腳係咪真係踩住地，全部真金白銀由機械人度攞。斷咗線就乜都唔顯示，作個數出嚟呃你等於講大話仲要有小數位。',
      '位置、速度、朝向同對腳係咪真係踩住地，全部真金白銀由機械人度攞。斷咗線就乜都唔顯示，作個數出嚟呃你等於講大話仲要有小數位。'
    ]
  },
  'mineflayerMovement.section.pad': {
    en: ['Directional controls', 'Directional controls', 'Directional controls', 'The steering pad', 'The steering pad'],
    yue: ['方向控制', '方向控制', '方向控制', '方向掣', '方向掣']
  },
  'mineflayerMovement.section.pad.description': {
    en: [
      'Each control is held while the pointer or the key is held, and released the moment either is released or focus leaves the pad.',
      'Each control is held while the pointer or the key is held, and released the moment either is released or focus leaves the pad.',
      'Hold a control with the pointer or the keyboard; it lets go the instant you do, or the instant focus leaves the pad.',
      'Hold a control with the pointer or the keyboard and it stays held. Let go, or take focus away, and it lets go too — nobody wants a bot that keeps jogging into a ravine because a button lost focus.',
      'Hold a control with the pointer or the keyboard and it stays held. Let go, or take focus away, and it lets go too — nobody wants a bot that keeps jogging into a ravine because a button lost focus.'
    ],
    yue: [
      '撳住滑鼠或者掣就會一直按住，一放手、放開個掣、或者焦點離開個控制區，即刻放開。',
      '撳住滑鼠或者掣就會一直按住，一放手、放開個掣、或者焦點離開個控制區，即刻放開。',
      '用滑鼠或者鍵盤撳住就一直按住；你一放手，或者焦點走咗，佢即刻放開。',
      '用滑鼠或者鍵盤撳住就一直撳住；你一放手，或者焦點走咗，佢即刻放。冇人想部機械人因為個掣失焦就一路跑落山窿。',
      '用滑鼠或者鍵盤撳住就一直撳住；你一放手，或者焦點走咗，佢即刻放。冇人想部機械人因為個掣失焦就一路跑落山窿。'
    ]
  },
  'mineflayerMovement.section.look': {
    en: ['Look', 'Look', 'Look', 'Where it is looking', 'Where it is looking'],
    yue: ['視線', '視線', '視線', '佢望緊邊', '佢望緊邊']
  },
  'mineflayerMovement.section.look.description': {
    en: [
      'Yaw and pitch in radians, with the degree equivalent shown. Yaw is measured counter-clockwise from due east and pitch is zero when level.',
      'Yaw and pitch in radians, with the degree equivalent shown. Yaw is measured counter-clockwise from due east and pitch is zero when level.',
      'Yaw and pitch in radians, degrees shown beside them. Yaw runs counter-clockwise from due east; pitch is zero looking level.',
      'Yaw and pitch in radians, with degrees beside them for the rest of us. Yaw runs counter-clockwise from due east; pitch is zero when the bot is looking dead level.',
      'Yaw and pitch in radians, with degrees beside them for the rest of us. Yaw runs counter-clockwise from due east; pitch is zero when the bot is looking dead level.'
    ],
    yue: [
      '水平角同俯仰角以弧度顯示，旁邊有度數。水平角由正東開始逆時針計，俯仰角望平就係零。',
      '水平角同俯仰角以弧度顯示，旁邊有度數。水平角由正東開始逆時針計，俯仰角望平就係零。',
      '水平角同俯仰角用弧度，隔籬有度數。水平角由正東逆時針計，望平嗰陣俯仰角係零。',
      '水平角同俯仰角用弧度，隔籬有度數畀我哋呢啲凡人睇。水平角由正東逆時針計，望到平平地嗰陣俯仰角就係零。',
      '水平角同俯仰角用弧度，隔籬有度數畀我哋呢啲凡人睇。水平角由正東逆時針計，望到平平地嗰陣俯仰角就係零。'
    ]
  },
  'mineflayerMovement.section.ray': {
    en: ['Ray-trace target picker', 'Ray-trace target picker', 'Ray-trace target picker', 'Point at it instead of typing it', 'Point at it instead of typing it'],
    yue: ['射線目標選擇', '射線目標選擇', '射線目標選擇', '用射線指，唔使打字', '用射線指，唔使打字']
  },
  'mineflayerMovement.section.ray.description': {
    en: [
      'Casts from the bot eye along its current facing and reports the real block or entity it meets, so the other forms can be filled from a target rather than from typed coordinates.',
      'Casts from the bot eye along its current facing and reports the real block or entity it meets, so the other forms can be filled from a target rather than from typed coordinates.',
      'Fires a ray from the bot eye along whatever it is facing, reports what it actually hit, and fills the other forms from it so you never type a coordinate you could have pointed at.',
      'Fires a ray out of the bot eye along whatever it is facing, tells you exactly what it hit, and pours that into the other forms — because typing a coordinate you could have pointed at is a small daily tragedy.',
      'Fires a ray out of the bot eye along whatever it is facing, tells you exactly what it hit, and pours that into the other forms — because typing a coordinate you could have pointed at is a small daily tragedy.'
    ],
    yue: [
      '由機械人眼部沿住現時朝向射出，回報真正打中嘅方塊或者實體，其他表格可以直接用嗰個目標填，唔使自己打座標。',
      '由機械人眼部沿住現時朝向射出，回報真正打中嘅方塊或者實體，其他表格可以直接用嗰個目標填，唔使自己打座標。',
      '由機械人隻眼沿住佢望嘅方向射一條線出去，話返畀你真係打中乜，再幫你填晒其他表格，唔使自己打座標。',
      '由機械人隻眼順住佢望緊嘅方向射條線出去，老實話返畀你打中咗乜，再自動填晒其他表格 —— 明明可以指下就搞掂，仲要自己打座標，真係人間慘劇。',
      '由機械人隻眼順住佢望緊嘅方向射條線出去，老實話返畀你打中咗乜，再自動填晒其他表格 —— 明明可以指下就搞掂，仲要自己打座標，真係人間慘劇。'
    ]
  },
  'mineflayerMovement.section.walk': {
    en: ['Walk to coordinates', 'Walk to coordinates', 'Walk to coordinates', 'Send it walking somewhere', 'Send it walking somewhere'],
    yue: ['行去座標', '行去座標', '行去座標', '叫佢行去某處', '叫佢行去某處']
  },
  'mineflayerMovement.section.follow': {
    en: ['Follow an entity', 'Follow an entity', 'Follow an entity', 'Tail somebody', 'Tail somebody'],
    yue: ['跟住實體', '跟住實體', '跟住實體', '跟住個目標行', '跟住個目標行']
  },
  'mineflayerMovement.section.preview': {
    en: ['Route preview', 'Route preview', 'Route preview', 'The route, from above', 'The route, from above'],
    yue: ['路線預覽', '路線預覽', '路線預覽', '由上面睇條路線', '由上面睇條路線']
  },
  'mineflayerMovement.section.log': {
    en: ['Movement log', 'Movement log', 'Movement log', 'Everything the bot was told to do', 'Everything the bot was told to do'],
    yue: ['移動記錄', '移動記錄', '移動記錄', '叫過機械人做嘅每一件事', '叫過機械人做嘅每一件事']
  },

  /* ---------------- session state ---------------- */

  'mineflayerMovement.session.searching': {
    en: [
      'Looking for a bot session.',
      'Looking for a bot session.',
      'Looking for a bot session.',
      'Having a look round for a bot session.',
      'Having a look round for a bot session.'
    ],
    yue: ['搵緊機械人連線。', '搵緊機械人連線。', '搵緊有無機械人連線。', '周圍望下有無機械人連線先。', '周圍望下有無機械人連線先。']
  },
  'mineflayerMovement.session.unavailable': {
    en: [
      'No bot session module is present in this build.',
      'No bot session module is present in this build.',
      'This build has no bot session module, so there is nothing to drive.',
      'This build has no bot session module in it, so there is precisely nothing here to drive.',
      'This build has no bot session module in it, so there is precisely nothing here to drive.'
    ],
    yue: [
      '呢個版本冇機械人連線模組。',
      '呢個版本冇機械人連線模組。',
      '呢個版本冇機械人連線模組，所以冇嘢可以揸。',
      '呢個版本入面根本冇機械人連線模組，即係話呢度一件可以揸嘅嘢都冇。',
      '呢個版本入面根本冇機械人連線模組，即係話呢度一件可以揸嘅嘢都冇。'
    ]
  },
  'mineflayerMovement.session.unavailable.body': {
    en: [
      'The controls below stay visible and disabled rather than disappearing, so what is missing is visible. These are the places that were searched:',
      'The controls below stay visible and disabled rather than disappearing, so what is missing is visible. These are the places that were searched:',
      'The controls stay on screen and disabled instead of vanishing, so you can see what is missing. Here is everywhere that was searched:',
      'The controls stay on screen, disabled rather than vanished, so the gap is visible instead of mysterious. Here is every place that was searched:',
      'The controls stay on screen, disabled rather than vanished, so the gap is visible instead of mysterious. Here is every place that was searched:'
    ],
    yue: [
      '下面啲控制會保留同埋停用，唔會消失，令你睇到差咗乜。以下係搵過嘅位置：',
      '下面啲控制會保留同埋停用，唔會消失，令你睇到差咗乜。以下係搵過嘅位置：',
      '下面啲控制會留喺度但停用，唔會無咗，等你睇得到差咗啲乜。以下係搵過嘅地方：',
      '下面啲控制會留喺度變灰，唔會憑空消失，等你一眼睇到個窿喺邊。以下係逐個搵過嘅地方：',
      '下面啲控制會留喺度變灰，唔會憑空消失，等你一眼睇到個窿喺邊。以下係逐個搵過嘅地方：'
    ]
  },
  'mineflayerMovement.session.disconnected': {
    en: [
      'A bot session exists but no bot is connected.',
      'A bot session exists but no bot is connected.',
      'The session is here, but no bot is connected to it.',
      'The session module is right here, but there is no bot on the end of it.',
      'The session module is right here, but there is no bot on the end of it.'
    ],
    yue: [
      '有機械人連線模組，但係無機械人連線。',
      '有機械人連線模組，但係無機械人連線。',
      '連線模組喺度，但係冇機械人接住。',
      '連線模組就喺度，不過條線另一頭一隻機械人都冇。',
      '連線模組就喺度，不過條線另一頭一隻機械人都冇。'
    ]
  },
  'mineflayerMovement.session.connected': {
    en: [
      'Connected as {name}.',
      'Connected as {name}.',
      'Connected as {name}.',
      'Connected, answering to the name {name}.',
      'Connected, answering to the name {name}.'
    ],
    yue: ['已連線，身份係 {name}。', '已連線，身份係 {name}。', '已連線，叫做 {name}。', '已連線，叫佢做 {name} 佢會應。', '已連線，叫佢做 {name} 佢會應。']
  },
  'mineflayerMovement.session.requires': {
    en: [
      'Requires a connected bot.',
      'Requires a connected bot.',
      'Needs a connected bot first.',
      'Needs a bot on the other end of the line first.',
      'Needs a bot on the other end of the line first.'
    ],
    yue: ['要有已連線嘅機械人先得。', '要有已連線嘅機械人先得。', '要先有機械人連線。', '要條線另一頭有隻機械人先玩得。', '要條線另一頭有隻機械人先玩得。']
  },

  /* ---------------- read-out ---------------- */

  'mineflayerMovement.readout.position': {
    en: ['Position', 'Position', 'Position', 'Where it is', 'Where it is'],
    yue: ['位置', '位置', '位置', '喺邊度', '喺邊度']
  },
  'mineflayerMovement.readout.velocity': {
    en: ['Velocity', 'Velocity', 'Velocity', 'How fast, and which way', 'How fast, and which way'],
    yue: ['速度向量', '速度向量', '速度向量', '幾快、去邊個方向', '幾快、去邊個方向']
  },
  'mineflayerMovement.readout.speed': {
    en: ['Ground speed', 'Ground speed', 'Ground speed', 'Ground speed', 'Ground speed'],
    yue: ['地面速度', '地面速度', '地面速度', '地面速度', '地面速度']
  },
  'mineflayerMovement.readout.onGround': {
    en: ['On ground', 'On ground', 'On ground', 'Feet on the floor', 'Feet on the floor'],
    yue: ['係咪落地', '係咪落地', '係咪落地', '對腳踩唔踩住地', '對腳踩唔踩住地']
  },
  'mineflayerMovement.readout.yes': {
    en: ['Yes', 'Yes', 'Yes', 'Yes', 'Yes'],
    yue: ['係', '係', '係', '係', '係']
  },
  'mineflayerMovement.readout.no': {
    en: ['No', 'No', 'No', 'No', 'No'],
    yue: ['唔係', '唔係', '唔係', '唔係', '唔係']
  },
  'mineflayerMovement.readout.yaw': {
    en: ['Yaw', 'Yaw', 'Yaw', 'Yaw', 'Yaw'],
    yue: ['水平角', '水平角', '水平角', '水平角', '水平角']
  },
  'mineflayerMovement.readout.pitch': {
    en: ['Pitch', 'Pitch', 'Pitch', 'Pitch', 'Pitch'],
    yue: ['俯仰角', '俯仰角', '俯仰角', '俯仰角', '俯仰角']
  },
  'mineflayerMovement.readout.eyeHeight': {
    en: ['Eye height', 'Eye height', 'Eye height', 'Eye height', 'Eye height'],
    yue: ['眼部高度', '眼部高度', '眼部高度', '眼部高度', '眼部高度']
  },
  'mineflayerMovement.readout.dimension': {
    en: ['Dimension', 'Dimension', 'Dimension', 'Dimension', 'Dimension'],
    yue: ['維度', '維度', '維度', '維度', '維度']
  },
  'mineflayerMovement.readout.gameMode': {
    en: ['Game mode', 'Game mode', 'Game mode', 'Game mode', 'Game mode'],
    yue: ['遊戲模式', '遊戲模式', '遊戲模式', '遊戲模式', '遊戲模式']
  },
  'mineflayerMovement.readout.physics': {
    en: ['Physics', 'Physics', 'Physics', 'Physics', 'Physics'],
    yue: ['物理運算', '物理運算', '物理運算', '物理運算', '物理運算']
  },
  'mineflayerMovement.readout.physics.on': {
    en: ['Running', 'Running', 'Running', 'Running', 'Running'],
    yue: ['運行中', '運行中', '運行中', '運行中', '運行中']
  },
  'mineflayerMovement.readout.physics.off': {
    en: [
      'Off — the bot will not move even when a control is held',
      'Off — the bot will not move even when a control is held',
      'Off, so holding a control moves nothing',
      'Off, so you can hold every control at once and it will sit there like a rock',
      'Off, so you can hold every control at once and it will sit there like a rock'
    ],
    yue: [
      '關閉 —— 就算按住控制，機械人都唔會郁',
      '關閉 —— 就算按住控制，機械人都唔會郁',
      '關咗，撳住幾多個掣都唔會郁',
      '關咗，你撳晒所有掣佢都會好似舊石咁坐喺度',
      '關咗，你撳晒所有掣佢都會好似舊石咁坐喺度'
    ]
  },
  'mineflayerMovement.readout.unavailable': {
    en: ['—', '—', '—', '—', '—'],
    yue: ['—', '—', '—', '—', '—']
  },

  /* ---------------- controls ---------------- */

  'mineflayerMovement.control.forward': {
    en: ['Forward', 'Forward', 'Forward', 'Forward', 'Forward'],
    yue: ['前', '前', '前行', '向前衝', '向前衝']
  },
  'mineflayerMovement.control.back': {
    en: ['Back', 'Back', 'Back', 'Back', 'Back'],
    yue: ['後', '後', '後退', '倒後行', '倒後行']
  },
  'mineflayerMovement.control.left': {
    en: ['Left', 'Left', 'Left', 'Left', 'Left'],
    yue: ['左', '左', '向左', '向左', '向左']
  },
  'mineflayerMovement.control.right': {
    en: ['Right', 'Right', 'Right', 'Right', 'Right'],
    yue: ['右', '右', '向右', '向右', '向右']
  },
  'mineflayerMovement.control.jump': {
    en: ['Jump', 'Jump', 'Jump', 'Jump', 'Jump'],
    yue: ['跳', '跳', '跳', '跳高高', '跳高高']
  },
  'mineflayerMovement.control.sprint': {
    en: ['Sprint', 'Sprint', 'Sprint', 'Sprint', 'Sprint'],
    yue: ['疾跑', '疾跑', '疾跑', '狂奔', '狂奔']
  },
  'mineflayerMovement.control.sneak': {
    en: ['Sneak', 'Sneak', 'Sneak', 'Sneak', 'Sneak'],
    yue: ['潛行', '潛行', '潛行', '躡手躡腳', '躡手躡腳']
  },
  'mineflayerMovement.control.held': {
    en: ['Held: {names}', 'Held: {names}', 'Held: {names}', 'Currently held down: {names}', 'Currently held down: {names}'],
    yue: ['按住緊：{names}', '按住緊：{names}', '而家按住：{names}', '而家撳實咗：{names}', '而家撳實咗：{names}']
  },
  'mineflayerMovement.control.heldNone': {
    en: [
      'No control is held.',
      'No control is held.',
      'Nothing is held.',
      'Nothing held. The bot is standing perfectly still, as instructed.',
      'Nothing held. The bot is standing perfectly still, as instructed.'
    ],
    yue: ['冇按住任何控制。', '冇按住任何控制。', '一個掣都冇按住。', '一個掣都冇撳住，機械人企定定，非常聽話。', '一個掣都冇撳住，機械人企定定，非常聽話。']
  },
  'mineflayerMovement.control.pressed': {
    en: ['{name} held', '{name} held', '{name} held', '{name} held down', '{name} held down'],
    yue: ['按住 {name}', '按住 {name}', '撳住 {name}', '撳實咗 {name}', '撳實咗 {name}']
  },
  'mineflayerMovement.control.releasedOne': {
    en: ['{name} released', '{name} released', '{name} released', '{name} let go', '{name} let go'],
    yue: ['放開 {name}', '放開 {name}', '放咗 {name}', '鬆咗 {name}', '鬆咗 {name}']
  },
  'mineflayerMovement.pad.keyboard': {
    en: [
      'Keyboard piloting: focus this pad, then hold W, A, S, D, Space, Shift or Ctrl. Escape releases everything.',
      'Keyboard piloting: focus this pad, then hold W, A, S, D, Space, Shift or Ctrl. Escape releases everything.',
      'Keyboard piloting: put focus on this pad and hold W, A, S, D, Space, Shift or Ctrl. Escape lets go of the lot.',
      'Keyboard piloting: focus this pad and hold W, A, S, D, Space, Shift or Ctrl like it is 2011. Escape drops everything at once.',
      'Keyboard piloting: focus this pad and hold W, A, S, D, Space, Shift or Ctrl like it is 2011. Escape drops everything at once.'
    ],
    yue: [
      '鍵盤操控：將焦點放喺呢個控制區，然後按住 W、A、S、D、Space、Shift 或者 Ctrl。撳 Escape 會放開全部。',
      '鍵盤操控：將焦點放喺呢個控制區，然後按住 W、A、S、D、Space、Shift 或者 Ctrl。撳 Escape 會放開全部。',
      '鍵盤操控：焦點放喺呢個控制區，撳住 W、A、S、D、Space、Shift 或者 Ctrl。Escape 一次過放晒。',
      '鍵盤操控：焦點放呢度，然後好似當年打機咁撳住 W、A、S、D、Space、Shift 或者 Ctrl。撳 Escape 即刻全部鬆手。',
      '鍵盤操控：焦點放呢度，然後好似當年打機咁撳住 W、A、S、D、Space、Shift 或者 Ctrl。撳 Escape 即刻全部鬆手。'
    ]
  },
  'mineflayerMovement.pad.keyboardOff': {
    en: [
      'Keyboard piloting is switched off in settings; the buttons still work with Space and Enter.',
      'Keyboard piloting is switched off in settings; the buttons still work with Space and Enter.',
      'Keyboard piloting is off in settings. The buttons still hold with Space and Enter.',
      'Keyboard piloting is off in settings — the buttons themselves still hold with Space and Enter, so you are not stranded.',
      'Keyboard piloting is off in settings — the buttons themselves still hold with Space and Enter, so you are not stranded.'
    ],
    yue: [
      '設定入面關咗鍵盤操控；啲掣仍然可以用 Space 同 Enter 按住。',
      '設定入面關咗鍵盤操控；啲掣仍然可以用 Space 同 Enter 按住。',
      '設定度關咗鍵盤操控，不過啲掣仲可以用 Space 同 Enter 撳住。',
      '設定度關咗鍵盤操控 —— 唔使驚，啲掣本身仲可以用 Space 同 Enter 撳住。',
      '設定度關咗鍵盤操控 —— 唔使驚，啲掣本身仲可以用 Space 同 Enter 撳住。'
    ]
  },
  'mineflayerMovement.stop': {
    en: ['Stop all movement', 'Stop all movement', 'Stop all movement', 'Stop everything', 'Stop everything'],
    yue: ['停止所有移動', '停止所有移動', '停晒所有移動', '全部停手', '全部停手']
  },
  'mineflayerMovement.stop.done': {
    en: [
      'Every control released and every walk cancelled.',
      'Every control released and every walk cancelled.',
      'Released every control and cancelled every walk.',
      'Every control let go, every walk cancelled. The bot is standing still.',
      'Every control let go, every walk cancelled. The bot is standing still.'
    ],
    yue: [
      '已放開所有控制，並取消所有行走。',
      '已放開所有控制，並取消所有行走。',
      '放晒所有控制，取消晒所有行走。',
      '所有掣都鬆咗，所有行走都取消咗，機械人企定咗。',
      '所有掣都鬆咗，所有行走都取消咗，機械人企定咗。'
    ]
  },

  /* ---------------- look ---------------- */

  'mineflayerMovement.look.yaw': {
    en: ['Yaw (degrees)', 'Yaw (degrees)', 'Yaw (degrees)', 'Yaw, in degrees', 'Yaw, in degrees'],
    yue: ['水平角（度）', '水平角（度）', '水平角（度）', '水平角，用度計', '水平角，用度計']
  },
  'mineflayerMovement.look.pitch': {
    en: ['Pitch (degrees)', 'Pitch (degrees)', 'Pitch (degrees)', 'Pitch, in degrees', 'Pitch, in degrees'],
    yue: ['俯仰角（度）', '俯仰角（度）', '俯仰角（度）', '俯仰角，用度計', '俯仰角，用度計']
  },
  'mineflayerMovement.look.apply': {
    en: ['Apply look', 'Apply look', 'Apply look', 'Turn its head', 'Turn its head'],
    yue: ['套用視線', '套用視線', '套用視線', '擰個頭', '擰個頭']
  },
  'mineflayerMovement.look.applied': {
    en: [
      'Looking at yaw {yaw}°, pitch {pitch}°.',
      'Looking at yaw {yaw}°, pitch {pitch}°.',
      'Now looking at yaw {yaw}°, pitch {pitch}°.',
      'Head turned: yaw {yaw}°, pitch {pitch}°.',
      'Head turned: yaw {yaw}°, pitch {pitch}°.'
    ],
    yue: [
      '已望向水平角 {yaw}°、俯仰角 {pitch}°。',
      '已望向水平角 {yaw}°、俯仰角 {pitch}°。',
      '而家望住水平角 {yaw}°、俯仰角 {pitch}°。',
      '個頭擰咗：水平角 {yaw}°、俯仰角 {pitch}°。',
      '個頭擰咗：水平角 {yaw}°、俯仰角 {pitch}°。'
    ]
  },
  'mineflayerMovement.look.failed': {
    en: [
      'The look could not be applied: {reason}',
      'The look could not be applied: {reason}',
      'The look did not go through: {reason}',
      'The head refused to turn: {reason}',
      'The head refused to turn: {reason}'
    ],
    yue: ['套用唔到視線：{reason}', '套用唔到視線：{reason}', '個視線去唔到：{reason}', '個頭唔肯擰：{reason}', '個頭唔肯擰：{reason}']
  },
  'mineflayerMovement.look.force': {
    en: ['Send the exact angle', 'Send the exact angle', 'Send the exact angle', 'Send the exact angle', 'Send the exact angle'],
    yue: ['傳送精確角度', '傳送精確角度', '傳送精確角度', '傳送精確角度', '傳送精確角度']
  },
  'mineflayerMovement.look.force.description': {
    en: [
      'Passes force to the library call, which skips the smooth server-side turn and tells the server exactly where the bot is looking. Needed for dropping items and shooting; not needed for walking.',
      'Passes force to the library call, which skips the smooth server-side turn and tells the server exactly where the bot is looking. Needed for dropping items and shooting; not needed for walking.',
      'Passes force to the library, skipping the smooth turn so the server learns the exact angle. Needed for dropping and shooting, not for walking.',
      'Passes force through to the library, which skips the polite gradual turn and tells the server precisely where the bot is staring. Worth it for dropping and shooting; pointless for walking.',
      'Passes force through to the library, which skips the polite gradual turn and tells the server precisely where the bot is staring. Worth it for dropping and shooting; pointless for walking.'
    ],
    yue: [
      '將 force 傳畀函式庫，跳過平滑轉向，直接話畀伺服器知精確角度。掉嘢同射箭要用；行路唔使。',
      '將 force 傳畀函式庫，跳過平滑轉向，直接話畀伺服器知精確角度。掉嘢同射箭要用；行路唔使。',
      '將 force 傳落函式庫，唔做平滑轉向，等伺服器知道確實角度。掉嘢射箭要，行路唔使。',
      '將 force 直接傳落函式庫，唔再客客氣氣慢慢轉，直接話畀伺服器知隻眼盯實邊。掉嘢射箭好用；行路就冇乜意思。',
      '將 force 直接傳落函式庫，唔再客客氣氣慢慢轉，直接話畀伺服器知隻眼盯實邊。掉嘢射箭好用；行路就冇乜意思。'
    ]
  },
  'mineflayerMovement.look.atCoordinates': {
    en: ['Look at a point', 'Look at a point', 'Look at a point', 'Look at a point', 'Look at a point'],
    yue: ['望向一點', '望向一點', '望向一點', '望向一點', '望向一點']
  },
  'mineflayerMovement.look.atEntity': {
    en: ['Look at an entity', 'Look at an entity', 'Look at an entity', 'Look at an entity', 'Look at an entity']
    ,
    yue: ['望向實體', '望向實體', '望向實體', '望向實體', '望向實體']
  },
  'mineflayerMovement.look.entityPicker': {
    en: ['Nearby entity', 'Nearby entity', 'Nearby entity', 'Something nearby', 'Something nearby'],
    yue: ['附近實體', '附近實體', '附近實體', '附近嘅嘢', '附近嘅嘢']
  },
  'mineflayerMovement.look.entityRefresh': {
    en: ['Refresh the entity list', 'Refresh the entity list', 'Refresh the entity list', 'Refresh the entity list', 'Refresh the entity list'],
    yue: ['重新整理實體清單', '重新整理實體清單', '重新整理實體清單', '重新整理實體清單', '重新整理實體清單']
  },
  'mineflayerMovement.look.entityNone': {
    en: [
      'The bot reports no nearby entities.',
      'The bot reports no nearby entities.',
      'The bot says there is nothing nearby.',
      'The bot reports absolutely nothing nearby. Splendid isolation.',
      'The bot reports absolutely nothing nearby. Splendid isolation.'
    ],
    yue: [
      '機械人回報附近冇任何實體。',
      '機械人回報附近冇任何實體。',
      '機械人話附近乜都冇。',
      '機械人回報附近一隻都冇，靜到得佢一個。',
      '機械人回報附近一隻都冇，靜到得佢一個。'
    ]
  },

  /* ---------------- coordinate fields ---------------- */

  'mineflayerMovement.field.x': {
    en: ['X', 'X', 'X', 'X', 'X'],
    yue: ['X', 'X', 'X', 'X', 'X']
  },
  'mineflayerMovement.field.y': {
    en: ['Y', 'Y', 'Y', 'Y', 'Y'],
    yue: ['Y', 'Y', 'Y', 'Y', 'Y']
  },
  'mineflayerMovement.field.z': {
    en: ['Z', 'Z', 'Z', 'Z', 'Z'],
    yue: ['Z', 'Z', 'Z', 'Z', 'Z']
  },
  'mineflayerMovement.field.notANumber': {
    en: [
      'Type a number, such as -128.5.',
      'Type a number, such as -128.5.',
      'That needs to be a number, such as -128.5.',
      'That needs to be a number — something along the lines of -128.5.',
      'That needs to be a number — something along the lines of -128.5.'
    ],
    yue: ['要輸入數字，例如 -128.5。', '要輸入數字，例如 -128.5。', '呢度要數字，好似 -128.5 咁。', '呢度要數字，例如 -128.5 咁樣先得。', '呢度要數字，例如 -128.5 咁樣先得。']
  },
  'mineflayerMovement.field.outOfRange': {
    en: [
      'Y must be between -320 and 640, which is the whole playable column.',
      'Y must be between -320 and 640, which is the whole playable column.',
      'Y has to sit between -320 and 640 — that is the whole playable column.',
      'Y has to sit between -320 and 640. That is the entire playable column, floor to sky.',
      'Y has to sit between -320 and 640. That is the entire playable column, floor to sky.'
    ],
    yue: [
      'Y 要喺 -320 至 640 之間，即係成條可玩高度。',
      'Y 要喺 -320 至 640 之間，即係成條可玩高度。',
      'Y 要喺 -320 同 640 之間，即係成條可以玩嘅高度。',
      'Y 要喺 -320 同 640 之間，由地底一路去到天上面，就係咁多。',
      'Y 要喺 -320 同 640 之間，由地底一路去到天上面，就係咁多。'
    ]
  },
  'mineflayerMovement.field.useBotPosition': {
    en: ['Use the bot position', 'Use the bot position', 'Use the bot position', 'Use where the bot is standing', 'Use where the bot is standing'],
    yue: ['用機械人位置', '用機械人位置', '用機械人位置', '用機械人企緊嗰個位', '用機械人企緊嗰個位']
  },
  'mineflayerMovement.field.useRayTarget': {
    en: ['Use the ray-trace target', 'Use the ray-trace target', 'Use the ray-trace target', 'Use whatever the ray hit', 'Use whatever the ray hit'],
    yue: ['用射線目標', '用射線目標', '用射線目標', '用射線打中嗰樣嘢', '用射線打中嗰樣嘢']
  },
  'mineflayerMovement.field.noRayTarget': {
    en: [
      'Cast a ray first; there is no target yet.',
      'Cast a ray first; there is no target yet.',
      'Cast a ray first — there is no target yet.',
      'Cast a ray first. There is nothing to copy from yet.',
      'Cast a ray first. There is nothing to copy from yet.'
    ],
    yue: ['要先射一次射線，而家仲未有目標。', '要先射一次射線，而家仲未有目標。', '先射條射線啦，而家仲未有目標。', '先射條射線先，而家根本冇嘢可以抄。', '先射條射線先，而家根本冇嘢可以抄。']
  },

  /* ---------------- ray trace ---------------- */

  'mineflayerMovement.ray.castBlock': {
    en: ['Trace to a block', 'Trace to a block', 'Trace to a block', 'Trace to a block', 'Trace to a block'],
    yue: ['射向方塊', '射向方塊', '射向方塊', '射向方塊', '射向方塊']
  },
  'mineflayerMovement.ray.castEntity': {
    en: ['Trace to an entity', 'Trace to an entity', 'Trace to an entity', 'Trace to an entity', 'Trace to an entity'],
    yue: ['射向實體', '射向實體', '射向實體', '射向實體', '射向實體']
  },
  'mineflayerMovement.ray.noBlock': {
    en: [
      'The ray reached {distance} m without meeting a block.',
      'The ray reached {distance} m without meeting a block.',
      'The ray went {distance} m and met nothing.',
      'The ray sailed {distance} m into open air and met absolutely nothing.',
      'The ray sailed {distance} m into open air and met absolutely nothing.'
    ],
    yue: [
      '射線行咗 {distance} 米都冇撞到方塊。',
      '射線行咗 {distance} 米都冇撞到方塊。',
      '射線去咗 {distance} 米，乜都冇撞到。',
      '射線飛咗 {distance} 米，一路空氣，撞唔到任何嘢。',
      '射線飛咗 {distance} 米，一路空氣，撞唔到任何嘢。'
    ]
  },
  'mineflayerMovement.ray.noEntity': {
    en: [
      'No entity within {distance} m of the line of sight.',
      'No entity within {distance} m of the line of sight.',
      'Nothing alive within {distance} m of the line of sight.',
      'Not a single living thing within {distance} m of that stare.',
      'Not a single living thing within {distance} m of that stare.'
    ],
    yue: [
      '視線 {distance} 米內冇任何實體。',
      '視線 {distance} 米內冇任何實體。',
      '望出去 {distance} 米內冇生物。',
      '佢盯住嗰條線 {distance} 米內連一隻生物都冇。',
      '佢盯住嗰條線 {distance} 米內連一隻生物都冇。'
    ]
  },
  'mineflayerMovement.ray.unavailable': {
    en: [
      'This session does not expose the ray-trace route, so the picker cannot fire.',
      'This session does not expose the ray-trace route, so the picker cannot fire.',
      'This session has no ray-trace route, so the picker cannot fire.',
      'This session never exposed a ray-trace route, so the picker has nothing to fire down.',
      'This session never exposed a ray-trace route, so the picker has nothing to fire down.'
    ],
    yue: [
      '呢個連線冇提供射線功能，所以個選擇器射唔到。',
      '呢個連線冇提供射線功能，所以個選擇器射唔到。',
      '呢個連線冇射線功能，選擇器射唔出。',
      '呢個連線由頭到尾都冇開射線功能，個選擇器根本冇嘢可以射。',
      '呢個連線由頭到尾都冇開射線功能，個選擇器根本冇嘢可以射。'
    ]
  },
  'mineflayerMovement.ray.blockHit': {
    en: [
      '{name} at {x}, {y}, {z} — {distance} m away, face {face}.',
      '{name} at {x}, {y}, {z} — {distance} m away, face {face}.',
      'Hit {name} at {x}, {y}, {z}, {distance} m away, on face {face}.',
      'Hit {name} at {x}, {y}, {z} — {distance} m out, right on face {face}.',
      'Hit {name} at {x}, {y}, {z} — {distance} m out, right on face {face}.'
    ],
    yue: [
      '{name} 喺 {x}, {y}, {z} —— 距離 {distance} 米，面 {face}。',
      '{name} 喺 {x}, {y}, {z} —— 距離 {distance} 米，面 {face}。',
      '打中 {name}，喺 {x}, {y}, {z}，距離 {distance} 米，打中 {face} 面。',
      '打中 {name}，位置 {x}, {y}, {z}，距離 {distance} 米，正中 {face} 面。',
      '打中 {name}，位置 {x}, {y}, {z}，距離 {distance} 米，正中 {face} 面。'
    ]
  },
  'mineflayerMovement.ray.entityHit': {
    en: [
      '{name} at {x}, {y}, {z} — {distance} m away.',
      '{name} at {x}, {y}, {z} — {distance} m away.',
      'Hit {name} at {x}, {y}, {z}, {distance} m away.',
      'Hit {name} at {x}, {y}, {z} — {distance} m out.',
      'Hit {name} at {x}, {y}, {z} — {distance} m out.'
    ],
    yue: [
      '{name} 喺 {x}, {y}, {z} —— 距離 {distance} 米。',
      '{name} 喺 {x}, {y}, {z} —— 距離 {distance} 米。',
      '打中 {name}，喺 {x}, {y}, {z}，距離 {distance} 米。',
      '打中 {name}，位置 {x}, {y}, {z}，距離 {distance} 米。',
      '打中 {name}，位置 {x}, {y}, {z}，距離 {distance} 米。'
    ]
  },
  'mineflayerMovement.ray.noTargetYet': {
    en: [
      'No ray has been cast yet.',
      'No ray has been cast yet.',
      'No ray cast yet.',
      'No ray cast yet — the picker is waiting for you.',
      'No ray cast yet — the picker is waiting for you.'
    ],
    yue: ['仲未射過射線。', '仲未射過射線。', '仲未射過。', '仲未射過，個選擇器等緊你。', '仲未射過，個選擇器等緊你。']
  },

  /* ---------------- walking ---------------- */

  'mineflayerMovement.walk.start': {
    en: ['Walk there', 'Walk there', 'Walk there', 'Off you go', 'Off you go'],
    yue: ['行過去', '行過去', '行過去', '出發啦', '出發啦']
  },
  'mineflayerMovement.walk.cancel': {
    en: ['Cancel the walk', 'Cancel the walk', 'Cancel the walk', 'Call it off', 'Call it off'],
    yue: ['取消行走', '取消行走', '取消行走', '算數，唔行喇', '算數，唔行喇']
  },
  'mineflayerMovement.walk.progress': {
    en: [
      '{remaining} m remaining of {total} m.',
      '{remaining} m remaining of {total} m.',
      '{remaining} m left out of {total} m.',
      '{remaining} m still to go, out of {total} m.',
      '{remaining} m still to go, out of {total} m.'
    ],
    yue: ['仲有 {remaining} 米，總共 {total} 米。', '仲有 {remaining} 米，總共 {total} 米。', '仲爭 {remaining} 米，全程 {total} 米。', '仲爭 {remaining} 米先到，全程 {total} 米。', '仲爭 {remaining} 米先到，全程 {total} 米。']
  },
  'mineflayerMovement.walk.arrived': {
    en: [
      'Arrived within {distance} m of {x}, {y}, {z}.',
      'Arrived within {distance} m of {x}, {y}, {z}.',
      'Arrived, {distance} m from {x}, {y}, {z}.',
      'Arrived — {distance} m from {x}, {y}, {z}, which counts.',
      'Arrived — {distance} m from {x}, {y}, {z}, which counts.'
    ],
    yue: [
      '已到達，距離 {x}, {y}, {z} {distance} 米之內。',
      '已到達，距離 {x}, {y}, {z} {distance} 米之內。',
      '到咗，距離 {x}, {y}, {z} 得 {distance} 米。',
      '到咗，距離 {x}, {y}, {z} 得 {distance} 米，算數。',
      '到咗，距離 {x}, {y}, {z} 得 {distance} 米，算數。'
    ]
  },
  'mineflayerMovement.walk.cancelled': {
    en: [
      'Walk cancelled with {remaining} m remaining.',
      'Walk cancelled with {remaining} m remaining.',
      'Walk cancelled, {remaining} m short.',
      'Walk cancelled with {remaining} m still to go. Controls released.',
      'Walk cancelled with {remaining} m still to go. Controls released.'
    ],
    yue: [
      '行走已取消，仲有 {remaining} 米。',
      '行走已取消，仲有 {remaining} 米。',
      '取消咗，仲爭 {remaining} 米。',
      '取消咗，仲爭 {remaining} 米。啲控制已經放開。',
      '取消咗，仲爭 {remaining} 米。啲控制已經放開。'
    ]
  },
  'mineflayerMovement.walk.stuck': {
    en: [
      'The bot stopped making progress with {remaining} m remaining, so the walk was stopped.',
      'The bot stopped making progress with {remaining} m remaining, so the walk was stopped.',
      'The bot stopped getting closer with {remaining} m left, so the walk was stopped.',
      'The bot stopped getting any closer with {remaining} m to go — almost certainly a wall — so the walk was stopped.',
      'The bot stopped getting any closer with {remaining} m to go — almost certainly a wall — so the walk was stopped.'
    ],
    yue: [
      '仲有 {remaining} 米嘅時候機械人唔再前進，所以停咗。',
      '仲有 {remaining} 米嘅時候機械人唔再前進，所以停咗。',
      '仲爭 {remaining} 米嘅時候佢唔再埋得近，所以停咗。',
      '仲爭 {remaining} 米嘅時候佢完全埋唔到去 —— 十有八九撞牆 —— 所以停咗。',
      '仲爭 {remaining} 米嘅時候佢完全埋唔到去 —— 十有八九撞牆 —— 所以停咗。'
    ]
  },
  'mineflayerMovement.walk.timeout': {
    en: [
      'The walk ran past {seconds} s with {remaining} m remaining and was stopped.',
      'The walk ran past {seconds} s with {remaining} m remaining and was stopped.',
      'The walk passed {seconds} s with {remaining} m left, so it was stopped.',
      'The walk passed its {seconds} s limit with {remaining} m still to go, so it was stopped.',
      'The walk passed its {seconds} s limit with {remaining} m still to go, so it was stopped.'
    ],
    yue: [
      '行走超過 {seconds} 秒，仲有 {remaining} 米，已經停止。',
      '行走超過 {seconds} 秒，仲有 {remaining} 米，已經停止。',
      '行超過 {seconds} 秒，仲爭 {remaining} 米，所以停咗。',
      '行超過 {seconds} 秒上限，仲爭 {remaining} 米，唯有停。',
      '行超過 {seconds} 秒上限，仲爭 {remaining} 米，唯有停。'
    ]
  },
  'mineflayerMovement.walk.lostSession': {
    en: [
      'The bot disconnected mid-walk with {remaining} m remaining.',
      'The bot disconnected mid-walk with {remaining} m remaining.',
      'The bot disconnected part-way, {remaining} m short.',
      'The bot disconnected mid-stride with {remaining} m to go.',
      'The bot disconnected mid-stride with {remaining} m to go.'
    ],
    yue: [
      '行到一半斷咗線，仲有 {remaining} 米。',
      '行到一半斷咗線，仲有 {remaining} 米。',
      '行到一半就甩線，仲爭 {remaining} 米。',
      '行到一半就甩咗線，仲爭 {remaining} 米。',
      '行到一半就甩咗線，仲爭 {remaining} 米。'
    ]
  },
  'mineflayerMovement.walk.busy': {
    en: [
      'A walk is already running. Cancel it before starting another.',
      'A walk is already running. Cancel it before starting another.',
      'A walk is already running — cancel it before starting another.',
      'One walk at a time. Cancel the one already running first.',
      'One walk at a time. Cancel the one already running first.'
    ],
    yue: [
      '已經有行走進行緊，要先取消先可以開新嘅。',
      '已經有行走進行緊，要先取消先可以開新嘅。',
      '而家有行走進行緊，取消咗佢先再開過。',
      '一次行一個。先取消緊行嗰個先。',
      '一次行一個。先取消緊行嗰個先。'
    ]
  },
  'mineflayerMovement.walk.needsTarget': {
    en: [
      'Fill in X, Y and Z first.',
      'Fill in X, Y and Z first.',
      'Fill in X, Y and Z first.',
      'It needs an X, a Y and a Z before it can set off.',
      'It needs an X, a Y and a Z before it can set off.'
    ],
    yue: ['要先填 X、Y、Z。', '要先填 X、Y、Z。', '先填埋 X、Y、Z 先。', '要有 X、Y、Z 先出發得。', '要有 X、Y、Z 先出發得。']
  },
  'mineflayerMovement.walk.straightLineWarning': {
    en: [
      'This is a straight-line walk, not a navigated path: the bot faces the target and walks, jumping when it stops making progress. It does not go round obstacles.',
      'This is a straight-line walk, not a navigated path: the bot faces the target and walks, jumping when it stops making progress. It does not go round obstacles.',
      'This walks in a straight line rather than navigating: it faces the target, walks, and jumps when it stops getting closer. It will not go round anything.',
      'This walks in a straight line rather than navigating. It faces the target, walks, and hops when it stops getting closer. It will not go round obstacles, because it genuinely cannot.',
      'This walks in a straight line rather than navigating. It faces the target, walks, and hops when it stops getting closer. It will not go round obstacles, because it genuinely cannot.'
    ],
    yue: [
      '呢個係直線行走，唔係路徑導航：機械人望住目標行，行唔到就跳。佢唔會繞過障礙物。',
      '呢個係直線行走，唔係路徑導航：機械人望住目標行，行唔到就跳。佢唔會繞過障礙物。',
      '呢個係直線行，唔係導航：望住目標行，埋唔到近就跳。佢唔會繞路。',
      '呢個係直線行，唔係導航。望住目標行，埋唔到近就跳吓。佢唔會繞過障礙物，因為佢真係做唔到。',
      '呢個係直線行，唔係導航。望住目標行，埋唔到近就跳吓。佢唔會繞過障礙物，因為佢真係做唔到。'
    ]
  },

  /* ---------------- follow ---------------- */

  'mineflayerMovement.follow.start': {
    en: ['Follow', 'Follow', 'Follow', 'Follow it', 'Follow it'],
    yue: ['跟住', '跟住', '跟住', '跟實佢', '跟實佢']
  },
  'mineflayerMovement.follow.stop': {
    en: ['Stop following', 'Stop following', 'Stop following', 'Stop following', 'Stop following'],
    yue: ['停止跟隨', '停止跟隨', '停止跟隨', '唔跟喇', '唔跟喇']
  },
  'mineflayerMovement.follow.running': {
    en: [
      'Following {name}, {distance} m away, holding at {target} m.',
      'Following {name}, {distance} m away, holding at {target} m.',
      'Following {name}, {distance} m away, keeping about {target} m.',
      'Trailing {name} at {distance} m, trying to sit at {target} m.',
      'Trailing {name} at {distance} m, trying to sit at {target} m.'
    ],
    yue: [
      '跟緊 {name}，距離 {distance} 米，維持喺 {target} 米。',
      '跟緊 {name}，距離 {distance} 米，維持喺 {target} 米。',
      '跟緊 {name}，距離 {distance} 米，想保持 {target} 米。',
      '跟實 {name}，距離 {distance} 米，想維持 {target} 米左右。',
      '跟實 {name}，距離 {distance} 米，想維持 {target} 米左右。'
    ]
  },
  'mineflayerMovement.follow.stopped': {
    en: ['Stopped following {name}.', 'Stopped following {name}.', 'Stopped following {name}.', 'No longer following {name}.', 'No longer following {name}.'],
    yue: ['已停止跟隨 {name}。', '已停止跟隨 {name}。', '唔再跟 {name}。', '唔再跟住 {name} 喇。', '唔再跟住 {name} 喇。']
  },
  'mineflayerMovement.follow.lost': {
    en: [
      '{name} is no longer in the entity list, so following stopped.',
      '{name} is no longer in the entity list, so following stopped.',
      '{name} left the entity list, so following stopped.',
      '{name} vanished from the entity list, so following stopped.',
      '{name} vanished from the entity list, so following stopped.'
    ],
    yue: [
      '{name} 已經唔喺實體清單度，所以停咗跟隨。',
      '{name} 已經唔喺實體清單度，所以停咗跟隨。',
      '{name} 離開咗實體清單，跟唔到就停咗。',
      '{name} 喺實體清單度消失咗，所以停咗跟隨。',
      '{name} 喺實體清單度消失咗，所以停咗跟隨。'
    ]
  },
  'mineflayerMovement.follow.needsEntity': {
    en: [
      'Choose an entity to follow first.',
      'Choose an entity to follow first.',
      'Pick an entity to follow first.',
      'Pick something to follow first — it will not guess.',
      'Pick something to follow first — it will not guess.'
    ],
    yue: ['要先揀一個實體嚟跟。', '要先揀一個實體嚟跟。', '先揀個實體跟先。', '先揀個目標跟住先，佢唔會估。', '先揀個目標跟住先，佢唔會估。']
  },

  /* ---------------- preview ---------------- */

  'mineflayerMovement.preview.empty': {
    en: [
      'Start a walk or a follow and the route appears here.',
      'Start a walk or a follow and the route appears here.',
      'Start a walk or a follow and the route shows up here.',
      'Start a walk or a follow and the route turns up here, viewed from directly above.',
      'Start a walk or a follow and the route turns up here, viewed from directly above.'
    ],
    yue: [
      '開始行走或者跟隨之後，路線會喺呢度出現。',
      '開始行走或者跟隨之後，路線會喺呢度出現。',
      '開始行走或者跟隨，路線就會喺呢度出現。',
      '開始行走或者跟隨，路線就會喺呢度出現，由正上方睇落嚟。',
      '開始行走或者跟隨，路線就會喺呢度出現，由正上方睇落嚟。'
    ]
  },
  'mineflayerMovement.preview.noPathfinder': {
    en: [
      'No pathfinder is loaded. The vendored library ships forty-one plugins and none of them plans a route, so the line drawn here is the straight line the bot will actually attempt, not a navigated path around obstacles.',
      'No pathfinder is loaded. The vendored library ships forty-one plugins and none of them plans a route, so the line drawn here is the straight line the bot will actually attempt, not a navigated path around obstacles.',
      'No pathfinder is loaded — the vendored library has forty-one plugins and not one of them plans a route. The line here is the straight line the bot will really try, not a path around obstacles.',
      'No pathfinder is loaded. The vendored library brings forty-one plugins and not one of them plans a route, so the line drawn here is the straight line the bot will genuinely attempt — obstacles very much included.',
      'No pathfinder is loaded. The vendored library brings forty-one plugins and not one of them plans a route, so the line drawn here is the straight line the bot will genuinely attempt — obstacles very much included.'
    ],
    yue: [
      '冇載入尋路外掛。隨附嘅函式庫有四十一個外掛，冇一個做路徑規劃，所以呢條線係機械人真正會試行嘅直線，唔係繞過障礙物嘅導航路徑。',
      '冇載入尋路外掛。隨附嘅函式庫有四十一個外掛，冇一個做路徑規劃，所以呢條線係機械人真正會試行嘅直線，唔係繞過障礙物嘅導航路徑。',
      '冇尋路外掛 —— 隨附函式庫四十一個外掛冇一個識規劃路徑。呢條線就係機械人真係會試行嘅直線，唔係繞路。',
      '冇尋路外掛。隨附函式庫拎咗四十一個外掛嚟，冇一個識規劃路徑，所以呢條線係機械人真真正正會試行嘅直線 —— 障礙物照撞。',
      '冇尋路外掛。隨附函式庫拎咗四十一個外掛嚟，冇一個識規劃路徑，所以呢條線係機械人真真正正會試行嘅直線 —— 障礙物照撞。'
    ]
  },
  'mineflayerMovement.preview.pathfinder': {
    en: [
      'A pathfinder named {name} is loaded and its waypoints are drawn.',
      'A pathfinder named {name} is loaded and its waypoints are drawn.',
      'A pathfinder called {name} is loaded, and its waypoints are drawn here.',
      'A pathfinder called {name} is loaded, so the waypoints drawn here are genuinely its own.',
      'A pathfinder called {name} is loaded, so the waypoints drawn here are genuinely its own.'
    ],
    yue: [
      '已載入名為 {name} 嘅尋路外掛，圖上係佢嘅途經點。',
      '已載入名為 {name} 嘅尋路外掛，圖上係佢嘅途經點。',
      '載咗個叫 {name} 嘅尋路外掛，圖上畫嘅係佢嘅途經點。',
      '載咗個叫 {name} 嘅尋路外掛，所以圖上啲途經點真係佢自己嘅。',
      '載咗個叫 {name} 嘅尋路外掛，所以圖上啲途經點真係佢自己嘅。'
    ]
  },
  'mineflayerMovement.preview.hidden': {
    en: [
      'The route preview is switched off in settings.',
      'The route preview is switched off in settings.',
      'The route preview is off in settings.',
      'The route preview is switched off in settings, so there is nothing to draw.',
      'The route preview is switched off in settings, so there is nothing to draw.'
    ],
    yue: ['設定入面關咗路線預覽。', '設定入面關咗路線預覽。', '設定度關咗路線預覽。', '設定度關咗路線預覽，所以冇嘢好畫。', '設定度關咗路線預覽，所以冇嘢好畫。']
  },
  'mineflayerMovement.preview.legend': {
    en: [
      'Start, target, the bot now, and the ground it has covered.',
      'Start, target, the bot now, and the ground it has covered.',
      'Start, target, where the bot is now, and the ground it has covered.',
      'Start, target, where the bot is this second, and the ground already behind it.',
      'Start, target, where the bot is this second, and the ground already behind it.'
    ],
    yue: [
      '起點、目標、機械人現時位置，同埋佢行過嘅路。',
      '起點、目標、機械人現時位置，同埋佢行過嘅路。',
      '起點、目標、機械人而家喺邊，同埋行過嘅路。',
      '起點、目標、機械人呢一秒喺邊、同埋佢身後行過嘅路。',
      '起點、目標、機械人呢一秒喺邊、同埋佢身後行過嘅路。'
    ]
  },
  'mineflayerMovement.preview.alt': {
    en: [
      'Top-down route diagram: the bot is {remaining} m from the target along a straight line of {total} m.',
      'Top-down route diagram: the bot is {remaining} m from the target along a straight line of {total} m.',
      'Top-down route diagram: the bot is {remaining} m from the target along a {total} m straight line.',
      'Top-down route diagram: the bot is {remaining} m from the target along a {total} m straight line.',
      'Top-down route diagram: the bot is {remaining} m from the target along a {total} m straight line.'
    ],
    yue: [
      '俯視路線圖：機械人距離目標 {remaining} 米，全程直線 {total} 米。',
      '俯視路線圖：機械人距離目標 {remaining} 米，全程直線 {total} 米。',
      '俯視路線圖：機械人距離目標 {remaining} 米，全程直線 {total} 米。',
      '俯視路線圖：機械人距離目標 {remaining} 米，全程直線 {total} 米。',
      '俯視路線圖：機械人距離目標 {remaining} 米，全程直線 {total} 米。'
    ]
  },

  /* ---------------- the log ---------------- */

  'mineflayerMovement.log.search': {
    en: ['Search the movement log', 'Search the movement log', 'Search the movement log', 'Search the movement log', 'Search the movement log'],
    yue: ['搜尋移動記錄', '搜尋移動記錄', '搜尋移動記錄', '搜尋移動記錄', '搜尋移動記錄']
  },
  'mineflayerMovement.log.empty': {
    en: [
      'Nothing has been recorded yet. Every control, look, walk and trace appears here as it happens.',
      'Nothing has been recorded yet. Every control, look, walk and trace appears here as it happens.',
      'Nothing recorded yet. Every control, look, walk and trace lands here as it happens.',
      'Nothing recorded yet. Every control, look, walk and trace lands here the moment it happens.',
      'Nothing recorded yet. Every control, look, walk and trace lands here the moment it happens.'
    ],
    yue: [
      '仲未有任何記錄。每一次控制、視線、行走同射線都會即時記喺呢度。',
      '仲未有任何記錄。每一次控制、視線、行走同射線都會即時記喺呢度。',
      '仲未有記錄。每次控制、視線、行走、射線都會即時入呢度。',
      '仲未有記錄。每次控制、視線、行走、射線一發生就會即刻入呢度。',
      '仲未有記錄。每次控制、視線、行走、射線一發生就會即刻入呢度。'
    ]
  },
  'mineflayerMovement.log.noMatches': {
    en: [
      'No log entry matches the search.',
      'No log entry matches the search.',
      'No entry matches the search.',
      'Nothing in the log matches that search.',
      'Nothing in the log matches that search.'
    ],
    yue: ['冇記錄符合搜尋條件。', '冇記錄符合搜尋條件。', '冇記錄夾到呢個搜尋。', '個記錄度冇嘢夾到呢個搜尋。', '個記錄度冇嘢夾到呢個搜尋。']
  },
  'mineflayerMovement.log.column.time': {
    en: ['Time', 'Time', 'Time', 'Time', 'Time'],
    yue: ['時間', '時間', '時間', '時間', '時間']
  },
  'mineflayerMovement.log.column.kind': {
    en: ['Kind', 'Kind', 'Kind', 'Kind', 'Kind'],
    yue: ['種類', '種類', '種類', '種類', '種類']
  },
  'mineflayerMovement.log.column.outcome': {
    en: ['Outcome', 'Outcome', 'Outcome', 'Outcome', 'Outcome'],
    yue: ['結果', '結果', '結果', '結果', '結果']
  },
  'mineflayerMovement.log.column.detail': {
    en: ['What happened', 'What happened', 'What happened', 'What happened', 'What happened'],
    yue: ['發生咗乜', '發生咗乜', '發生咗乜', '發生咗乜', '發生咗乜']
  },
  'mineflayerMovement.log.column.position': {
    en: ['Position', 'Position', 'Position', 'Position', 'Position'],
    yue: ['位置', '位置', '位置', '位置', '位置']
  },
  'mineflayerMovement.log.selectAllShown': {
    en: [
      'Select the {count} shown',
      'Select the {count} shown',
      'Select the {count} shown',
      'Select the {count} on screen',
      'Select the {count} on screen'
    ],
    yue: ['選取顯示中嘅 {count} 項', '選取顯示中嘅 {count} 項', '揀晒顯示緊嘅 {count} 項', '揀晒screen上面嗰 {count} 項', '揀晒screen上面嗰 {count} 項']
  },
  'mineflayerMovement.log.selectAllEvery': {
    en: [
      'Select all {count}, including the ones the search is hiding',
      'Select all {count}, including the ones the search is hiding',
      'Select all {count}, including the ones the search hides',
      'Select all {count}, hidden ones included',
      'Select all {count}, hidden ones included'
    ],
    yue: [
      '選取全部 {count} 項，包括搜尋隱藏咗嗰啲',
      '選取全部 {count} 項，包括搜尋隱藏咗嗰啲',
      '揀晒全部 {count} 項，連搜尋收埋咗嗰啲都要',
      '揀晒全部 {count} 項，連收埋咗嗰啲都一齊',
      '揀晒全部 {count} 項，連收埋咗嗰啲都一齊'
    ]
  },
  'mineflayerMovement.log.invert': {
    en: ['Invert the selection', 'Invert the selection', 'Invert the selection', 'Invert the selection', 'Invert the selection'],
    yue: ['反向選取', '反向選取', '反向選取', '反轉揀', '反轉揀']
  },
  'mineflayerMovement.log.clearSelection': {
    en: ['Clear the selection', 'Clear the selection', 'Clear the selection', 'Clear the selection', 'Clear the selection'],
    yue: ['清除選取', '清除選取', '清除選取', '唔揀住', '唔揀住']
  },
  'mineflayerMovement.log.selected': {
    en: [
      '{count} selected of {total}.',
      '{count} selected of {total}.',
      '{count} of {total} selected.',
      '{count} of {total} selected.',
      '{count} of {total} selected.'
    ],
    yue: ['已選 {count} 項，共 {total} 項。', '已選 {count} 項，共 {total} 項。', '揀咗 {count} 項，總共 {total} 項。', '揀咗 {count} 項，總共 {total} 項。', '揀咗 {count} 項，總共 {total} 項。']
  },
  'mineflayerMovement.log.delete': {
    en: ['Delete the selected entries', 'Delete the selected entries', 'Delete the selected entries', 'Delete the selected entries', 'Delete the selected entries'],
    yue: ['刪除選取嘅記錄', '刪除選取嘅記錄', '刪除選取嘅記錄', '刪除揀咗嗰啲記錄', '刪除揀咗嗰啲記錄']
  },
  'mineflayerMovement.log.deleted': {
    en: [
      '{count} log entries deleted.',
      '{count} log entries deleted.',
      '{count} log entries gone.',
      '{count} log entries deleted. They are not coming back.',
      '{count} log entries deleted. They are not coming back.'
    ],
    yue: ['已刪除 {count} 項記錄。', '已刪除 {count} 項記錄。', '刪咗 {count} 項記錄。', '刪咗 {count} 項記錄，返唔到轉頭。', '刪咗 {count} 項記錄，返唔到轉頭。']
  },
  'mineflayerMovement.log.export': {
    en: ['Export the selection', 'Export the selection', 'Export the selection', 'Export the selection', 'Export the selection'],
    yue: ['匯出選取項目', '匯出選取項目', '匯出揀咗嘅嘢', '匯出揀咗嘅嘢', '匯出揀咗嘅嘢']
  },
  'mineflayerMovement.log.exportFormat': {
    en: ['Export format', 'Export format', 'Export format', 'Export format', 'Export format'],
    yue: ['匯出格式', '匯出格式', '匯出格式', '匯出格式', '匯出格式']
  },
  'mineflayerMovement.log.exported': {
    en: ['Saved to {path}.', 'Saved to {path}.', 'Saved to {path}.', 'Saved to {path}.', 'Saved to {path}.'],
    yue: ['已儲存到 {path}。', '已儲存到 {path}。', '已儲存到 {path}。', '已儲存到 {path}。', '已儲存到 {path}。']
  },
  'mineflayerMovement.log.exportLosses': {
    en: [
      'The chosen format cannot carry: {fields}. Everything else is written in full.',
      'The chosen format cannot carry: {fields}. Everything else is written in full.',
      'That format cannot carry: {fields}. Everything else goes in whole.',
      'That format cannot carry: {fields}. Everything else goes in whole, unharmed.',
      'That format cannot carry: {fields}. Everything else goes in whole, unharmed.'
    ],
    yue: [
      '揀咗嘅格式載唔到：{fields}。其餘全部完整寫入。',
      '揀咗嘅格式載唔到：{fields}。其餘全部完整寫入。',
      '呢個格式載唔到：{fields}。其他全部照樣寫入。',
      '呢個格式載唔到：{fields}。其他全部完完整整寫入，無損。',
      '呢個格式載唔到：{fields}。其他全部完完整整寫入，無損。'
    ]
  },
  'mineflayerMovement.log.nothingSelected': {
    en: [
      'Select at least one entry first.',
      'Select at least one entry first.',
      'Select at least one entry first.',
      'Select at least one entry first — otherwise there is nothing to act on.',
      'Select at least one entry first — otherwise there is nothing to act on.'
    ],
    yue: ['要先至少揀一項。', '要先至少揀一項。', '先揀最少一項先。', '先揀最少一項，否則根本冇嘢做得。', '先揀最少一項，否則根本冇嘢做得。']
  },
  'mineflayerMovement.log.trimmed': {
    en: [
      'The log reached its {limit}-entry limit, so the oldest {count} were dropped.',
      'The log reached its {limit}-entry limit, so the oldest {count} were dropped.',
      'The log hit its {limit}-entry limit, so the oldest {count} went.',
      'The log hit its {limit}-entry limit, so the oldest {count} were quietly shown the door.',
      'The log hit its {limit}-entry limit, so the oldest {count} were quietly shown the door.'
    ],
    yue: [
      '記錄去到 {limit} 項上限，所以最舊嘅 {count} 項被移除。',
      '記錄去到 {limit} 項上限，所以最舊嘅 {count} 項被移除。',
      '記錄爆咗 {limit} 項上限，最舊嗰 {count} 項無咗。',
      '記錄爆咗 {limit} 項上限，最舊嗰 {count} 項靜靜雞被請走咗。',
      '記錄爆咗 {limit} 項上限，最舊嗰 {count} 項靜靜雞被請走咗。'
    ]
  },

  /* ---------------- settings ---------------- */

  'mineflayerMovement.settings.title': {
    en: ['Bot movement', 'Bot movement', 'Bot movement', 'Bot movement', 'Bot movement'],
    yue: ['機械人移動', '機械人移動', '機械人移動', '機械人移動', '機械人移動']
  },
  'mineflayerMovement.setting.arriveRadius': {
    en: ['Arrive radius', 'Arrive radius', 'Arrive radius', 'Close enough, in metres', 'Close enough, in metres'],
    yue: ['到達半徑', '到達半徑', '到達半徑', '幾近先叫到咗（米）', '幾近先叫到咗（米）']
  },
  'mineflayerMovement.setting.arriveRadius.description': {
    en: [
      'Horizontal distance at which a walk counts as arrived. Measured on X and Z only, so a target one block above the bot still counts.',
      'Horizontal distance at which a walk counts as arrived. Measured on X and Z only, so a target one block above the bot still counts.',
      'How close a walk has to get before it counts as arrived. Measured on X and Z only, so a target a block above still counts.',
      'How close a walk must get before it counts as arrived. It is measured on X and Z only, so a target one block overhead still counts — which is usually what you meant.',
      'How close a walk must get before it counts as arrived. It is measured on X and Z only, so a target one block overhead still counts — which is usually what you meant.'
    ],
    yue: [
      '行走去到幾近先算到達嘅水平距離。只計 X 同 Z，所以目標喺頭頂一格都當到達。',
      '行走去到幾近先算到達嘅水平距離。只計 X 同 Z，所以目標喺頭頂一格都當到達。',
      '行走要去到幾近先算到咗。淨係計 X 同 Z，所以目標喺上面一格都算。',
      '行走要幾近先算到咗。淨係計 X 同 Z，所以目標喺頭頂一格都算 —— 通常你都係咁諗。',
      '行走要幾近先算到咗。淨係計 X 同 Z，所以目標喺頭頂一格都算 —— 通常你都係咁諗。'
    ]
  },
  'mineflayerMovement.setting.followDistance': {
    en: ['Follow distance', 'Follow distance', 'Follow distance', 'How closely to tail it', 'How closely to tail it'],
    yue: ['跟隨距離', '跟隨距離', '跟隨距離', '跟得幾貼', '跟得幾貼']
  },
  'mineflayerMovement.setting.followDistance.description': {
    en: [
      'Distance the bot tries to hold while following. It walks when it is further than this and stands still when it is closer, so it does not shove the thing it is following.',
      'Distance the bot tries to hold while following. It walks when it is further than this and stands still when it is closer, so it does not shove the thing it is following.',
      'The distance the bot tries to hold while following. Further than this and it walks; closer and it stands still, so it stops shoving whatever it is following.',
      'The distance the bot tries to hold while following. Further away and it walks; closer and it stands still, so it stops nudging the poor thing it is following.',
      'The distance the bot tries to hold while following. Further away and it walks; closer and it stands still, so it stops nudging the poor thing it is following.'
    ],
    yue: [
      '跟隨時想維持嘅距離。遠過呢個數就行，近過就企定，唔會撞住跟緊嗰個。',
      '跟隨時想維持嘅距離。遠過呢個數就行，近過就企定，唔會撞住跟緊嗰個。',
      '跟隨時想保持嘅距離。遠過就行埋去，近過就企定，唔會硬撼住個目標。',
      '跟隨時想保持嘅距離。遠過就行埋去，近過就企定，唔會一路推住個可憐目標行。',
      '跟隨時想保持嘅距離。遠過就行埋去，近過就企定，唔會一路推住個可憐目標行。'
    ]
  },
  'mineflayerMovement.setting.sprint': {
    en: ['Sprint while walking', 'Sprint while walking', 'Sprint while walking', 'Sprint while walking', 'Sprint while walking'],
    yue: ['行走時疾跑', '行走時疾跑', '行走時疾跑', '行嗰陣狂奔', '行嗰陣狂奔']
  },
  'mineflayerMovement.setting.sprint.description': {
    en: [
      'Holds sprint for the duration of a walk or a follow. It arrives sooner and consumes food faster, and a sprinting bot cannot stop as promptly at the arrive radius.',
      'Holds sprint for the duration of a walk or a follow. It arrives sooner and consumes food faster, and a sprinting bot cannot stop as promptly at the arrive radius.',
      'Holds sprint for the whole walk or follow. Faster to arrive, hungrier, and a sprinting bot overshoots the arrive radius more easily.',
      'Holds sprint for the whole walk or follow. It gets there sooner, eats more, and overshoots the arrive radius more readily — physics is not negotiable.',
      'Holds sprint for the whole walk or follow. It gets there sooner, eats more, and overshoots the arrive radius more readily — physics is not negotiable.'
    ],
    yue: [
      '行走或者跟隨期間一直按住疾跑。快啲到但食物消耗快啲，而且疾跑中嘅機械人喺到達半徑度冇咁快停到。',
      '行走或者跟隨期間一直按住疾跑。快啲到但食物消耗快啲，而且疾跑中嘅機械人喺到達半徑度冇咁快停到。',
      '整段行走或跟隨都撳住疾跑。快啲到，餓快啲，而且疾跑會容易衝過到達半徑。',
      '成段行走或跟隨都撳住疾跑。快啲到、食多啲、亦都容易衝過龍 —— 物理定律唔畀你講價。',
      '成段行走或跟隨都撳住疾跑。快啲到、食多啲、亦都容易衝過龍 —— 物理定律唔畀你講價。'
    ]
  },
  'mineflayerMovement.setting.jumpWhenStuck': {
    en: ['Jump when it stops progressing', 'Jump when it stops progressing', 'Jump when it stops progressing', 'Hop when it gets stuck', 'Hop when it gets stuck'],
    yue: ['停滯時跳一下', '停滯時跳一下', '停滯時跳一下', '卡住就跳吓', '卡住就跳吓']
  },
  'mineflayerMovement.setting.jumpWhenStuck.description': {
    en: [
      'Presses jump once each time the measured distance stops shrinking, which clears a one-block step. It does not clear a wall, and the walk still stops when progress does not resume.',
      'Presses jump once each time the measured distance stops shrinking, which clears a one-block step. It does not clear a wall, and the walk still stops when progress does not resume.',
      'Taps jump each time the measured distance stops shrinking, which gets it over a one-block step. It will not clear a wall, and the walk still stops if progress does not resume.',
      'Taps jump every time the measured distance stops shrinking, which gets it over a one-block step. It will not get it over a wall, and the walk still gives up if progress does not resume.',
      'Taps jump every time the measured distance stops shrinking, which gets it over a one-block step. It will not get it over a wall, and the walk still gives up if progress does not resume.'
    ],
    yue: [
      '每次量到嘅距離唔再縮短就撳一次跳，可以上到一格高嘅台階。跳唔過牆，如果之後仲係冇進展，行走照樣會停。',
      '每次量到嘅距離唔再縮短就撳一次跳，可以上到一格高嘅台階。跳唔過牆，如果之後仲係冇進展，行走照樣會停。',
      '每次距離唔再縮短就撳一下跳，過到一格高嘅台階。跳唔過牆，如果仲係冇進展，行走一樣會停。',
      '每次距離唔再縮就撳一下跳，過到一格高嘅台階。牆就一定跳唔過，如果仲係冇進展，行走一樣會放棄。',
      '每次距離唔再縮就撳一下跳，過到一格高嘅台階。牆就一定跳唔過，如果仲係冇進展，行走一樣會放棄。'
    ]
  },
  'mineflayerMovement.setting.stuckSeconds': {
    en: ['Stuck timeout', 'Stuck timeout', 'Stuck timeout', 'How long to persist when stuck', 'How long to persist when stuck'],
    yue: ['卡住逾時', '卡住逾時', '卡住逾時', '卡住撐幾耐', '卡住撐幾耐']
  },
  'mineflayerMovement.setting.stuckSeconds.description': {
    en: [
      'Seconds of no measurable progress before a walk stops itself and reports the metres remaining. Nothing is retried silently.',
      'Seconds of no measurable progress before a walk stops itself and reports the metres remaining. Nothing is retried silently.',
      'How many seconds without measurable progress before a walk stops itself and reports the metres left. Nothing retries in silence.',
      'How many seconds of getting precisely nowhere before a walk stops itself and tells you the metres left. Nothing is retried behind your back.',
      'How many seconds of getting precisely nowhere before a walk stops itself and tells you the metres left. Nothing is retried behind your back.'
    ],
    yue: [
      '完全冇進展幾多秒之後，行走會自己停低並回報仲爭幾多米。唔會靜靜雞重試。',
      '完全冇進展幾多秒之後，行走會自己停低並回報仲爭幾多米。唔會靜靜雞重試。',
      '幾多秒冇進展之後，行走會自己停同話返你聽仲爭幾多米。唔會靜靜雞重試。',
      '完全原地踏步幾多秒之後，行走會自己停低，話返你聽仲爭幾多米。唔會背住你偷偷重試。',
      '完全原地踏步幾多秒之後，行走會自己停低，話返你聽仲爭幾多米。唔會背住你偷偷重試。'
    ]
  },
  'mineflayerMovement.setting.walkTimeout': {
    en: ['Walk timeout', 'Walk timeout', 'Walk timeout', 'Longest a walk may run', 'Longest a walk may run'],
    yue: ['行走逾時', '行走逾時', '行走逾時', '一次行走最長時間', '一次行走最長時間']
  },
  'mineflayerMovement.setting.walkTimeout.description': {
    en: [
      'Total seconds a single walk may run before it stops itself, however well it is progressing. It bounds a walk aimed at a target the bot can approach forever without reaching.',
      'Total seconds a single walk may run before it stops itself, however well it is progressing. It bounds a walk aimed at a target the bot can approach forever without reaching.',
      'Total seconds one walk may run before it stops itself, however well it is going. It bounds a walk aimed at something the bot can approach forever without reaching.',
      'Total seconds one walk may run before it stops itself, however well it is going. It exists for the target the bot can approach forever and never quite reach.',
      'Total seconds one walk may run before it stops itself, however well it is going. It exists for the target the bot can approach forever and never quite reach.'
    ],
    yue: [
      '一次行走最多可以行幾多秒，無論幾順利都會自己停。用嚟限制嗰啲永遠埋得近但永遠到唔到嘅目標。',
      '一次行走最多可以行幾多秒，無論幾順利都會自己停。用嚟限制嗰啲永遠埋得近但永遠到唔到嘅目標。',
      '一次行走最多行幾多秒，幾順利都會停。用嚟限住嗰啲永遠追唔到嘅目標。',
      '一次行走最多行幾多秒，幾順利都照停。呢個設定就係為咗嗰啲永遠埋得近、永遠差少少嘅目標而存在。',
      '一次行走最多行幾多秒，幾順利都照停。呢個設定就係為咗嗰啲永遠埋得近、永遠差少少嘅目標而存在。'
    ]
  },
  'mineflayerMovement.setting.tickMs': {
    en: ['Control tick', 'Control tick', 'Control tick', 'How often it re-aims', 'How often it re-aims'],
    yue: ['控制間隔', '控制間隔', '控制間隔', '幾密重新瞄準', '幾密重新瞄準']
  },
  'mineflayerMovement.setting.tickMs.description': {
    en: [
      'Milliseconds between one re-aim and the next while walking or following, and how often the read-out refreshes. The game itself ticks every 50 ms, so anything below that only costs work.',
      'Milliseconds between one re-aim and the next while walking or following, and how often the read-out refreshes. The game itself ticks every 50 ms, so anything below that only costs work.',
      'Milliseconds between re-aims while walking or following, and how often the read-out refreshes. The game ticks every 50 ms, so anything faster only costs work.',
      'Milliseconds between re-aims while walking or following, and how often the read-out refreshes. The game itself ticks every 50 ms, so going faster buys nothing and costs work.',
      'Milliseconds between re-aims while walking or following, and how often the read-out refreshes. The game itself ticks every 50 ms, so going faster buys nothing and costs work.'
    ],
    yue: [
      '行走或跟隨期間兩次重新瞄準之間嘅毫秒數，亦係數據刷新嘅頻率。遊戲本身每 50 毫秒一個 tick，快過呢個只會白做。',
      '行走或跟隨期間兩次重新瞄準之間嘅毫秒數，亦係數據刷新嘅頻率。遊戲本身每 50 毫秒一個 tick，快過呢個只會白做。',
      '行走或跟隨時兩次重新瞄準之間幾多毫秒，亦係數據刷新嘅密度。遊戲每 50 毫秒一 tick，快過佢只係白做。',
      '行走或跟隨時兩次重新瞄準隔幾多毫秒，順便決定數據幾密刷新。遊戲本身 50 毫秒一 tick，快過佢一分著數都冇，淨係燒 CPU。',
      '行走或跟隨時兩次重新瞄準隔幾多毫秒，順便決定數據幾密刷新。遊戲本身 50 毫秒一 tick，快過佢一分著數都冇，淨係燒 CPU。'
    ]
  },
  'mineflayerMovement.setting.blockRayDistance': {
    en: ['Block ray distance', 'Block ray distance', 'Block ray distance', 'How far the block ray reaches', 'How far the block ray reaches'],
    yue: ['方塊射線距離', '方塊射線距離', '方塊射線距離', '方塊射線射得幾遠', '方塊射線射得幾遠']
  },
  'mineflayerMovement.setting.blockRayDistance.description': {
    en: [
      'Maximum metres passed to the library block ray-trace. The library default is 256; a shorter reach returns sooner and keeps the picker to blocks the bot could plausibly act on.',
      'Maximum metres passed to the library block ray-trace. The library default is 256; a shorter reach returns sooner and keeps the picker to blocks the bot could plausibly act on.',
      'Maximum metres handed to the library block ray-trace. The library default is 256; a shorter reach answers sooner and keeps the picker to blocks the bot could actually act on.',
      'Maximum metres handed to the library block ray-trace. The library default is 256; a shorter reach answers sooner and stops the picker returning a block half a world away.',
      'Maximum metres handed to the library block ray-trace. The library default is 256; a shorter reach answers sooner and stops the picker returning a block half a world away.'
    ],
    yue: [
      '傳畀函式庫方塊射線嘅最大米數。函式庫預設係 256；短啲會快啲有結果，亦保證選到嘅方塊機械人真係有可能用到。',
      '傳畀函式庫方塊射線嘅最大米數。函式庫預設係 256；短啲會快啲有結果，亦保證選到嘅方塊機械人真係有可能用到。',
      '交畀函式庫方塊射線嘅最大米數。函式庫預設 256；短啲快啲出結果，亦唔會揀到啲用唔到嘅方塊。',
      '交畀函式庫方塊射線嘅最大米數。函式庫預設 256；短啲快啲出結果，亦唔會畀你揀到半個世界外嗰嚿方塊。',
      '交畀函式庫方塊射線嘅最大米數。函式庫預設 256；短啲快啲出結果，亦唔會畀你揀到半個世界外嗰嚿方塊。'
    ]
  },
  'mineflayerMovement.setting.entityRayDistance': {
    en: ['Entity ray distance', 'Entity ray distance', 'Entity ray distance', 'How far the entity ray reaches', 'How far the entity ray reaches'],
    yue: ['實體射線距離', '實體射線距離', '實體射線距離', '實體射線射得幾遠', '實體射線射得幾遠']
  },
  'mineflayerMovement.setting.entityRayDistance.description': {
    en: [
      'Maximum metres passed to the library entity ray-trace. The library default is 3.5, which is roughly interaction range; a longer reach finds entities the bot could not yet interact with.',
      'Maximum metres passed to the library entity ray-trace. The library default is 3.5, which is roughly interaction range; a longer reach finds entities the bot could not yet interact with.',
      'Maximum metres handed to the library entity ray-trace. The library default is 3.5, roughly interaction range; reaching further finds entities the bot cannot yet interact with.',
      'Maximum metres handed to the library entity ray-trace. The library default is 3.5, which is roughly arm’s length; reaching further finds entities the bot cannot actually touch yet.',
      'Maximum metres handed to the library entity ray-trace. The library default is 3.5, which is roughly arm’s length; reaching further finds entities the bot cannot actually touch yet.'
    ],
    yue: [
      '傳畀函式庫實體射線嘅最大米數。函式庫預設 3.5，大約係互動範圍；射遠啲會搵到啲仲未互動到嘅實體。',
      '傳畀函式庫實體射線嘅最大米數。函式庫預設 3.5，大約係互動範圍；射遠啲會搵到啲仲未互動到嘅實體。',
      '交畀函式庫實體射線嘅最大米數。函式庫預設 3.5，即大概互動範圍；射遠啲會搵到啲掂唔到嘅實體。',
      '交畀函式庫實體射線嘅最大米數。函式庫預設 3.5，大概就係一隻手臂咁長；射遠啲搵到嘅嘢，其實仲未掂得到。',
      '交畀函式庫實體射線嘅最大米數。函式庫預設 3.5，大概就係一隻手臂咁長；射遠啲搵到嘅嘢，其實仲未掂得到。'
    ]
  },
  'mineflayerMovement.setting.keyboardPiloting': {
    en: ['Keyboard piloting', 'Keyboard piloting', 'Keyboard piloting', 'Drive it with the keyboard', 'Drive it with the keyboard'],
    yue: ['鍵盤操控', '鍵盤操控', '鍵盤操控', '用鍵盤揸', '用鍵盤揸']
  },
  'mineflayerMovement.setting.keyboardPiloting.description': {
    en: [
      'Lets W, A, S, D, Space, Shift and Ctrl drive the pad while the pad itself has focus. It is scoped to the pad, so those letters typed into a coordinate field are just letters. Off, each button still holds with Space and Enter.',
      'Lets W, A, S, D, Space, Shift and Ctrl drive the pad while the pad itself has focus. It is scoped to the pad, so those letters typed into a coordinate field are just letters. Off, each button still holds with Space and Enter.',
      'Lets W, A, S, D, Space, Shift and Ctrl drive the pad while the pad has focus. Scoped to the pad, so those letters typed into a field are just letters. Off, each button still holds with Space and Enter.',
      'Lets W, A, S, D, Space, Shift and Ctrl drive the pad while the pad has focus. It is scoped to the pad, so a stray W in a coordinate field stays a W rather than sending the bot for a jog. Off, each button still holds with Space and Enter.',
      'Lets W, A, S, D, Space, Shift and Ctrl drive the pad while the pad has focus. It is scoped to the pad, so a stray W in a coordinate field stays a W rather than sending the bot for a jog. Off, each button still holds with Space and Enter.'
    ],
    yue: [
      '當焦點喺控制區時，可以用 W、A、S、D、Space、Shift、Ctrl 操控。只限控制區範圍，所以喺座標欄打嗰啲字母就只係字母。閂咗之後，每個掣仍然可以用 Space 同 Enter 按住。',
      '當焦點喺控制區時，可以用 W、A、S、D、Space、Shift、Ctrl 操控。只限控制區範圍，所以喺座標欄打嗰啲字母就只係字母。閂咗之後，每個掣仍然可以用 Space 同 Enter 按住。',
      '焦點喺控制區時，可以用 W、A、S、D、Space、Shift、Ctrl 揸。只限控制區，所以喺座標欄打字母就淨係字母。閂咗，每個掣照樣可以用 Space 同 Enter 撳住。',
      '焦點喺控制區時，可以用 W、A、S、D、Space、Shift、Ctrl 揸。範圍限死喺控制區，所以喺座標欄手快打咗個 W，佢就只係個 W，唔會即刻叫機械人去晨運。閂咗之後，每個掣照樣可以用 Space 同 Enter 撳住。',
      '焦點喺控制區時，可以用 W、A、S、D、Space、Shift、Ctrl 揸。範圍限死喺控制區，所以喺座標欄手快打咗個 W，佢就只係個 W，唔會即刻叫機械人去晨運。閂咗之後，每個掣照樣可以用 Space 同 Enter 撳住。'
    ]
  },
  'mineflayerMovement.setting.showPreview': {
    en: ['Show the route preview', 'Show the route preview', 'Show the route preview', 'Show the route preview', 'Show the route preview'],
    yue: ['顯示路線預覽', '顯示路線預覽', '顯示路線預覽', '顯示路線預覽', '顯示路線預覽']
  },
  'mineflayerMovement.setting.showPreview.description': {
    en: [
      'Draws the top-down route diagram while a walk or a follow is running. Turning it off does not change how the bot moves; only whether the diagram is drawn.',
      'Draws the top-down route diagram while a walk or a follow is running. Turning it off does not change how the bot moves; only whether the diagram is drawn.',
      'Draws the top-down route diagram during a walk or a follow. Turning it off changes nothing about how the bot moves, only whether the diagram is drawn.',
      'Draws the top-down route diagram during a walk or a follow. Off changes nothing about how the bot moves — only whether you get to watch it happen.',
      'Draws the top-down route diagram during a walk or a follow. Off changes nothing about how the bot moves — only whether you get to watch it happen.'
    ],
    yue: [
      '喺行走或跟隨期間畫俯視路線圖。閂咗唔會改變機械人點行，淨係決定畫唔畫個圖。',
      '喺行走或跟隨期間畫俯視路線圖。閂咗唔會改變機械人點行，淨係決定畫唔畫個圖。',
      '行走或跟隨期間畫俯視路線圖。閂咗完全唔影響機械人點行，淨係畫唔畫個圖。',
      '行走或跟隨期間畫俯視路線圖。閂咗完全唔影響機械人點行 —— 淨係影響你睇唔睇到佢行。',
      '行走或跟隨期間畫俯視路線圖。閂咗完全唔影響機械人點行 —— 淨係影響你睇唔睇到佢行。'
    ]
  },
  'mineflayerMovement.setting.trailPoints': {
    en: ['Trail length', 'Trail length', 'Trail length', 'How much of the trail to keep', 'How much of the trail to keep'],
    yue: ['軌跡長度', '軌跡長度', '軌跡長度', '軌跡留幾多', '軌跡留幾多']
  },
  'mineflayerMovement.setting.trailPoints.description': {
    en: [
      'How many recent positions the preview keeps as the travelled trail. Older points are dropped; the diagram never grows without bound.',
      'How many recent positions the preview keeps as the travelled trail. Older points are dropped; the diagram never grows without bound.',
      'How many recent positions the preview keeps as the travelled trail. Older ones are dropped, so the diagram never grows without bound.',
      'How many recent positions the preview keeps as the travelled trail. Older ones fall off the end, so the diagram never grows without bound.',
      'How many recent positions the preview keeps as the travelled trail. Older ones fall off the end, so the diagram never grows without bound.'
    ],
    yue: [
      '預覽保留幾多個最近位置做行過嘅軌跡。舊嘅會掉走，個圖唔會無限growing。',
      '預覽保留幾多個最近位置做行過嘅軌跡。舊嘅會掉走，個圖唔會無限增長。',
      '預覽留幾多個最近位置做軌跡。舊嘅會掉走，個圖唔會無限咁大。',
      '預覽留幾多個最近位置做軌跡。舊嘅會由尾跌走，個圖唔會無止境咁大落去。',
      '預覽留幾多個最近位置做軌跡。舊嘅會由尾跌走，個圖唔會無止境咁大落去。'
    ]
  },
  'mineflayerMovement.setting.logLimit': {
    en: ['Movement log limit', 'Movement log limit', 'Movement log limit', 'How many log entries to keep', 'How many log entries to keep'],
    yue: ['移動記錄上限', '移動記錄上限', '移動記錄上限', '記錄留幾多項', '記錄留幾多項']
  },
  'mineflayerMovement.setting.logLimit.description': {
    en: [
      'How many entries the movement log keeps before the oldest are dropped. The drop is reported when it happens rather than being silent.',
      'How many entries the movement log keeps before the oldest are dropped. The drop is reported when it happens rather than being silent.',
      'How many entries the movement log keeps before the oldest go. The drop is reported when it happens rather than done in silence.',
      'How many entries the movement log keeps before the oldest fall off the end. The drop is reported when it happens rather than done behind your back.',
      'How many entries the movement log keeps before the oldest fall off the end. The drop is reported when it happens rather than done behind your back.'
    ],
    yue: [
      '移動記錄最多保留幾多項，超過就掉最舊嗰啲。掉嗰陣會通知你，唔會靜靜雞做。',
      '移動記錄最多保留幾多項，超過就掉最舊嗰啲。掉嗰陣會通知你，唔會靜靜雞做。',
      '移動記錄留幾多項先開始掉最舊嗰啲。掉嗰陣會出聲，唔會靜靜雞做。',
      '移動記錄留幾多項先開始由尾掉走。掉嗰陣會出聲話你知，唔會背住你做。',
      '移動記錄留幾多項先開始由尾掉走。掉嗰陣會出聲話你知，唔會背住你做。'
    ]
  },

  /* ---------------- palette ---------------- */

  'mineflayerMovement.palette.open': {
    en: ['Bot movement', 'Bot movement', 'Bot movement', 'Bot movement', 'Bot movement'],
    yue: ['機械人移動', '機械人移動', '機械人移動', '機械人移動', '機械人移動']
  },
  'mineflayerMovement.palette.stop': {
    en: ['Stop all bot movement', 'Stop all bot movement', 'Stop all bot movement', 'Stop the bot dead', 'Stop the bot dead'],
    yue: ['停止機械人所有移動', '停止機械人所有移動', '停晒機械人所有移動', '即刻叫機械人企定', '即刻叫機械人企定']
  },
  'mineflayerMovement.palette.readout': {
    en: ['Bot position read-out', 'Bot position read-out', 'Bot position read-out', 'Bot position read-out', 'Bot position read-out'],
    yue: ['機械人位置數據', '機械人位置數據', '機械人位置數據', '機械人位置數據', '機械人位置數據']
  },
  'mineflayerMovement.palette.look': {
    en: ['Bot look controls', 'Bot look controls', 'Bot look controls', 'Bot look controls', 'Bot look controls'],
    yue: ['機械人視線控制', '機械人視線控制', '機械人視線控制', '機械人視線控制', '機械人視線控制']
  },
  'mineflayerMovement.palette.ray': {
    en: ['Ray-trace target picker', 'Ray-trace target picker', 'Ray-trace target picker', 'Ray-trace target picker', 'Ray-trace target picker'],
    yue: ['射線目標選擇', '射線目標選擇', '射線目標選擇', '射線目標選擇', '射線目標選擇']
  },
  'mineflayerMovement.palette.walk': {
    en: ['Walk the bot to coordinates', 'Walk the bot to coordinates', 'Walk the bot to coordinates', 'Walk the bot to coordinates', 'Walk the bot to coordinates'],
    yue: ['叫機械人行去座標', '叫機械人行去座標', '叫機械人行去座標', '叫機械人行去座標', '叫機械人行去座標']
  },
  'mineflayerMovement.palette.follow': {
    en: ['Follow an entity with the bot', 'Follow an entity with the bot', 'Follow an entity with the bot', 'Follow an entity with the bot', 'Follow an entity with the bot'],
    yue: ['用機械人跟住實體', '用機械人跟住實體', '用機械人跟住實體', '用機械人跟住實體', '用機械人跟住實體']
  },
  'mineflayerMovement.palette.log': {
    en: ['Movement log', 'Movement log', 'Movement log', 'Movement log', 'Movement log'],
    yue: ['移動記錄', '移動記錄', '移動記錄', '移動記錄', '移動記錄']
  }
};
