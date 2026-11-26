// Tablecloth Trick: this toy's own interface text in five languages (toy-specific, not a shared file).
// The text every toy shares (names for the More menu, Share, About) lives in i18n.ts. Until the toy is
// live its name stays here (i18n.ts: a toy not yet live keeps its name in its own strings.ts).

const en = {
  name_yoink: 'Tablecloth Trick',
  desc_yoink:
    'A family table laid with a silk cloth: a tea cup, Mum’s bowls, Grandma’s thermos, the family heirloom. Grab the hem and flick it down. Do it fast and the cloth slides out while everything rattles and stays; do it slowly and the whole table rides over the edge. A tiny physics toy, no sign-up.',
  hint_yoink: 'Grab the hem. Flick it down, fast.',
  yoink_nogl: 'This toy needs WebGL, and this browser has it switched off.',
  yoink_t1: 'One cup. Warm-up.',
  yoink_t2: 'Mum’s bowls',
  yoink_t3: 'Grandma’s thermos',
  yoink_t4: 'A whole fish, for luck',
  yoink_t5: 'The family heirloom',
  yoink_t6: 'New Year’s Eve dinner',
  yoink_tag_heirloom: 'Heirloom. Do not touch.',
}

const zhCN: typeof en = {
  name_yoink: '抽桌布',
  desc_yoink:
    '一张铺着真丝桌布的饭桌：茶杯、我妈的碗、奶奶的暖水瓶，还有传家宝。捏住垂下来的桌布边，往下猛地一抽。抽得够快，桌布唰地出来，东西晃两下还在原地；抽得慢，一桌东西跟着桌布走到桌边，一件一件掉下去。打开即玩的物理小玩具。',
  hint_yoink: '捏住桌布边，往下猛地一抽',
  yoink_nogl: '这个玩具需要 WebGL，这个浏览器没开。',
  yoink_t1: '一只茶杯，热身',
  yoink_t2: '我妈的碗',
  yoink_t3: '奶奶的暖水瓶',
  yoink_t4: '年年有余',
  yoink_t5: '传家宝',
  yoink_t6: '年夜饭',
  yoink_tag_heirloom: '传家宝 勿动',
}

const es: typeof en = {
  name_yoink: 'El Truco del Mantel',
  desc_yoink:
    'Una mesa familiar con un mantel de seda: una taza de té, los cuencos de mamá, el termo de la abuela, la reliquia de la familia. Agarra el borde y tira hacia abajo de golpe. Si lo haces rápido, el mantel sale y todo tiembla y se queda; si lo haces despacio, la mesa entera se va por el borde. Un juguete de física, sin registro.',
  hint_yoink: 'Agarra el borde y tira hacia abajo, de golpe',
  yoink_nogl: 'Este juguete necesita WebGL y este navegador lo tiene desactivado.',
  yoink_t1: 'Una taza. Para calentar.',
  yoink_t2: 'Los cuencos de mamá',
  yoink_t3: 'El termo de la abuela',
  yoink_t4: 'Un pescado entero, que da suerte',
  yoink_t5: 'La reliquia de la familia',
  yoink_t6: 'La cena de Nochevieja',
  yoink_tag_heirloom: 'Reliquia. No tocar.',
}

const fr: typeof en = {
  name_yoink: 'Le Coup de la Nappe',
  desc_yoink:
    'Une table de famille avec une nappe en soie : une tasse à thé, les bols de maman, le thermos de mamie, le vase de famille. Attrapez le bord et tirez d’un coup sec vers le bas. Assez vite, la nappe file et tout tremble mais reste en place ; trop lentement, toute la table part avec elle. Un petit jouet de physique, sans inscription.',
  hint_yoink: 'Attrapez le bord et tirez vers le bas, d’un coup sec',
  yoink_nogl: 'Ce jouet a besoin de WebGL, et ce navigateur l’a désactivé.',
  yoink_t1: 'Une tasse. Pour s’échauffer.',
  yoink_t2: 'Les bols de maman',
  yoink_t3: 'Le thermos de mamie',
  yoink_t4: 'Un poisson entier, pour la chance',
  yoink_t5: 'Le vase de famille',
  yoink_t6: 'Le dîner du réveillon',
  yoink_tag_heirloom: 'Vase de famille. Ne pas toucher.',
}

const ja: typeof en = {
  name_yoink: 'テーブルクロス引き',
  desc_yoink:
    '絹のクロスをかけた家族の食卓。湯のみ、母の茶碗、祖母の魔法瓶、そして家宝。垂れた布のはしをつかんで、下へ一気に引く。速ければ布だけがするりと抜けて、食器はカタカタ揺れてその場に残る。遅ければ、食卓ごと端まで運ばれて、ひとつずつ落ちていく。登録不要の小さな物理おもちゃ。',
  hint_yoink: '布のはしをつかんで、下へ一気に引く',
  yoink_nogl: 'このおもちゃには WebGL が必要ですが、このブラウザでは無効になっています。',
  yoink_t1: '湯のみ一つ。準備運動。',
  yoink_t2: '母の茶碗',
  yoink_t3: '祖母の魔法瓶',
  yoink_t4: '尾頭付きの魚（縁起物）',
  yoink_t5: '家宝',
  yoink_t6: '大みそかのごちそう',
  yoink_tag_heirloom: '家宝　さわるな',
}

export default { en, 'zh-CN': zhCN, es, fr, ja }
