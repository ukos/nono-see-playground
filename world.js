// SEE ― 世界のデータ（国と地域）
// 1つの国＝「遠景＋建物＋住人＋エピソード＋天候」の型。国を増やすときは COUNTRIES に1件足すだけ。
//
// 国の項目
//   id, name        : 識別子と表示名（名前は仮。実在名か架空名かは未定）
//   screens         : 広さ（1画面＝960px、4〜8）
//   far             : 遠景 assets/far/<far>.webp
//   mid             : 'trees'（森のシルエット）か省略
//   hill, ground    : 中景の丘の色、地面の色 [草, 土, 道]
//   tint            : 画面全体にかける色
//   bscale          : 建物の倍率（素材の解像度差を吸収）
//   buildings       : [画像名, 国の左端からのx, 倍率(省略可)]
//   npcs            : { id, name, actor, x, face(1=右向き,-1=左向き) }
//   weather         : 起こりやすい天候と重み { clear, drizzle, squall, typhoon, wind, fog, densefog, snow }
//   talk            : 住人ごとの会話。S を受け取り行の配列を返す
//                     行＝[話し手, 表情, 文]。話し手は 'npc'（話している相手）/ 'me'（nono）/ 'insight'（気づき）
//   S の中身        : S.f（旅全体のフラグ）, S.back（この国より先まで行って戻ってきたか）,
//                     S.ev(k)（噂の証拠を得る）, S.has(k), S.met(npcId)
(function () {
  const C = [];

  // ---------------------------------------------------------------- 1
  C.push({
    id: 'hanano', name: '花野の国', screens: 7, far: 'flower', mid: 'trees',
    hill: '#1e2a2a', ground: ['#5d8a55', '#3e5a3c', '#6b5a45'], tint: 'rgba(80,40,90,.10)', bscale: 1.6,
    buildings: [['house_small', 560], ['bakery', 1100], ['house_large', 1640], ['elder_house', 2260], ['lumber_hut', 3080]],
    npcs: [
      { id: 'villager', name: 'ゴンジ（村人）', actor: 'villager', x: 940, face: -1 },
      { id: 'elder', name: '長老', actor: 'elder', x: 2420, face: -1 },
      { id: 'lumber', name: 'ダイ（木こり）', actor: 'lumber', x: 3360, face: -1 },
      { id: 'porter', name: 'ミツ（運び屋）', actor: 'porter', x: 4020, face: 1 }
    ],
    rabbit: 2000,
    gap: { x: 5180, kind: 'rope' }, // 谷と吊り橋
    weather: { clear: 6, drizzle: 2, wind: 1, fog: 1 },
    talk: {
      villager(S) {
        const f = S.f;
        if (!f.heard) { f.heard = true; S.ev('heard');
          return [['npc', 'normal', 'やあ、旅の人。東へ行くのかい？'], ['npc', 'surprise', '隣村のもんが言ってたんだが、東の吊り橋が落ちたらしいよ。'], ['npc', 'normal', 'まあ、聞いた話だけどね。気をつけて。'], ['me', '', '（旅日誌に書いておこう）']]; }
        if (f.seen && !f.toldVillager) { f.toldVillager = true; f.bridgeFixed = true;
          return [['npc', 'surprise', 'おや、戻ってきたのかい。橋はどうだった？'], ['me', '', '落ちてたのは、手すりの縄だけでした。'], ['npc', 'joy', 'なんだ、そうだったのか！ 隣村のやつ、話を大きくしたな。'], ['npc', 'normal', 'いや……わしも、ちょっと大きくして話したかもしれん。'], ['npc', 'joy', 'よし、縄を持って直しに行ってくるよ。']]; }
        return f.bridgeFixed ? [['npc', 'joy', '手すりは直しておいたよ。気をつけて渡りな。']] : [['npc', 'normal', '東の橋の話、本当かどうか。見てきた人がいればなあ。']];
      },
      elder(S) {
        const f = S.f;
        if (f.seen && f.heard && !f.insightHanano) { f.insightHanano = true;
          return [['npc', 'normal', '橋を見てきたそうじゃな。'], ['npc', 'normal', '人の話はな、みんな少しずつ本当で、少しずつちがう。'], ['npc', 'joy', '藪の中というやつじゃ。それでも歩いて、見に行く者がおる。'], ['npc', 'joy', 'おぬしのような旅人がな。'], ['insight', '', '聞いた話は、自分の足で確かめるまで、半分だけ信じておく。']]; }
        if (f.insightHanano) return [['npc', 'joy', '気をつけてな。道は、行きと帰りで顔が変わるものじゃ。']];
        return [['npc', 'normal', 'この村は、行く人も帰る人も通りすぎていく。'], ['npc', 'joy', '通りすぎる者にも、見えるものはあるじゃろう。']];
      },
      lumber(S) {
        if (!S.has('sound')) { S.ev('sound');
          return [['npc', 'normal', 'よう。この先は谷だぞ。'], ['npc', 'surprise', 'そういや昨夜、東の谷のほうでドーンとでかい音がしたんだ。'], ['npc', 'fun', '木が倒れたのか、何かが落ちたのか……おれは寝ちまったがな！'], ['me', '', S.f.heard ? '（橋の話と、合っている……？）' : '（何の音だろう）']]; }
        return [['npc', 'fun', '音の正体がわかったら教えてくれよ。']];
      },
      porter(S) {
        if (!S.has('crossed')) { S.ev('crossed');
          return [['npc', 'normal', 'ふう。重い荷を背負って、今朝その先の吊り橋を渡ってきたところさ。'], ['npc', 'normal', '揺れはひどかったし、片側がなんだか頼りなかったけどね。'], ['npc', 'normal', 'わたしは東の果ての、水の上の町まで荷を運んでる。またどこかで会うかもね。'], ['me', '', S.f.heard ? '（落ちた橋は、渡れないはず……）' : '（橋があるんだ）']]; }
        return [['npc', 'normal', '西の村まであと少し。足だけが頼りさ。']];
      },
      // 吊り橋を見る（npc ではなく場所）
      bridge(S) {
        const f = S.f;
        if (f.bridgeFixed) {
          if (f.sawFixed) return [['me', '', '新しい縄の手すり。ゴンジさんたちが直してくれた。']];
          f.sawFixed = true;
          return [['me', '', 'あ……手すりが、新しい縄になっている。'], ['me', '', 'ゴンジさんたちが、直しに来てくれたんだ。'], ['me', '', '行きと帰りで、同じ橋なのに、ちがって見える。']];
        }
        if (f.seen) return [['me', '', '手すりの縄が切れている。床板は、しっかりしている。']];
        S.ev('seen'); f.seen = true;
        return [['me', '', '……橋だ。ちゃんと架かっている。'], ['me', '', '落ちていたのは、片側の手すりの縄だけだ。'], ['me', '', f.heard ? '（「橋が落ちた」は、少しちがったみたいだ。村に戻って話してみよう）' : '（縄が切れている。誰かに知らせたほうがいいかな）']];
      }
    }
  });

  // ---------------------------------------------------------------- 2
  C.push({
    id: 'take', name: '竹の里', screens: 5, far: 'bamboo',
    hill: '#1f2a22', ground: ['#5f8a4a', '#3a5034', '#7a6a50'], tint: 'rgba(40,60,40,.08)', bscale: 1.05,
    buildings: [['buke_gate', 380], ['machiya', 900], ['teahouse', 1550], ['nagaya', 2250], ['samurai_mansion', 3250, 0.95]],
    npcs: [
      { id: 'soba', name: '屋台のそば屋', actor: 'craftsman', x: 1400, face: -1 },
      { id: 'wakai', name: '若い衆', actor: 'sasuke', x: 2900, face: -1 }
    ],
    weather: { clear: 4, drizzle: 4, fog: 1, wind: 1 },
    talk: {
      soba(S) {
        const f = S.f;
        if (f.wakaiTold && !f.insightTake) { f.insightTake = true;
          return [['npc', 'joy', 'はは、あの若いのか。同じ手で、損をしたって？'], ['npc', 'normal', 'ゆうべの客はな、夜の九つに来たから、うまくいったのさ。'], ['npc', 'normal', '真似ってのは、時と場所までは真似できねえ。'], ['insight', '', 'うまいやり方は、その人の、そのときだけのもの。']]; }
        if (f.insightTake) return [['npc', 'joy', 'へい、一杯どうだい。勘定は、ふつうに数えてくれよ。']];
        f.sobaTold = true;
        return [['npc', 'normal', 'へい、いらっしゃい。'], ['npc', 'normal', 'ゆうべ、妙な客がいてね。銭を一枚ずつ数えながら「いま何どきだい」って聞くんだ。'], ['npc', 'joy', '答えたら、その数をとばして、一文ごまかしていった。うまいもんだ。'], ['me', '', '（うまい……のかな）']];
      },
      wakai(S) {
        const f = S.f;
        if (f.insightTake) return [['npc', 'fun', 'もう真似はしない。自分の勘定は、自分の数え方で払うよ。']];
        if (f.sobaTold) { f.wakaiTold = true;
          return [['npc', 'sorrow', '聞いてくれよ。あのそば屋で、おれも同じ手を使ったんだ。'], ['npc', 'sorrow', '「いま何どきだい」って聞いたら、「四つです」って……'], ['npc', 'sorrow', 'まだ朝だったんだよ。数えなおしになって、四文よけいに払っちまった。'], ['me', '', '（あとで、そば屋さんに話してみよう）']]; }
        return [['npc', 'normal', 'この里の竹は、雨のあとに一晩でぐんと伸びるんだ。'], ['npc', 'fun', 'おれも早く伸びたいね。']];
      }
    }
  });

  // ---------------------------------------------------------------- 3
  C.push({
    id: 'koutou', name: '紅灯の都', screens: 6, far: 'valley',
    hill: '#2a1e26', ground: ['#6a7a4a', '#4a3e34', '#8a7258'], tint: 'rgba(120,30,30,.08)', bscale: 1.3,
    buildings: [['cn_paifang', 300], ['cn_house', 1000], ['cn_teahouse', 1650], ['cn_nagaya', 2450, 1.1], ['cn_mansion', 3550, 1.15], ['cn_tower', 4650, 1.2]],
    npcs: [
      { id: 'okami', name: '茶館の女将', actor: 'akane', x: 2000, face: -1 },
      { id: 'teishu', name: '魚屋の亭主', actor: 'homura', x: 3300, face: -1 }
    ],
    weather: { clear: 5, drizzle: 2, fog: 2, squall: 1 },
    talk: {
      teishu(S) {
        const f = S.f;
        if (S.back && f.insightKoutou) return [['npc', 'normal', '女房のやつ、最近なにか言いたそうなんだ。'], ['npc', 'normal', '……まあ、いいさ。言いたくなったら言うだろう。']];
        f.teishuTold = true;
        return [['npc', 'normal', 'おう、旅の人。おれは昔、浜で大金の入った財布を拾ったことがあるんだ。'], ['npc', 'normal', 'でも、朝になったら女房に、それは夢だと言われた。'], ['npc', 'normal', 'それから酒をやめて、三年働いた。いまは店も持ってる。'], ['npc', 'normal', '夢でよかったのか、どうなのか。']];
      },
      okami(S) {
        const f = S.f;
        if (f.teishuTold && !f.insightKoutou) { f.insightKoutou = true;
          return [['npc', 'normal', 'あの人、また財布の話をしたのね。'], ['npc', 'normal', '……本当はね、夢じゃなかったの。'], ['npc', 'normal', 'でも、あのお金があったら、あの人は働かなかった。'], ['npc', 'normal', 'いつか話すわ。もう、お酒に戻らないと思えたら。'], ['insight', '', 'やさしいうそは、相手を信じて、しばらくあずけておくものかもしれない。']]; }
        if (f.insightKoutou) return [['npc', 'normal', 'まだ、話さないでおくわ。お茶、もう一杯いかが。']];
        return [['npc', 'normal', 'いらっしゃい。お茶でもいかが。'], ['npc', 'normal', 'うちの人は、奥で魚を売っているわ。']];
      }
    }
  });

  // ---------------------------------------------------------------- 4
  C.push({
    id: 'kaze', name: '風の草原', screens: 6, far: 'highland',
    hill: '#243024', ground: ['#7aa05a', '#4a6a3a', '#8a7a5a'], tint: 'rgba(60,80,40,.06)', bscale: 1.0,
    buildings: [['yurt_smoke', 700], ['sheep_pen', 1300, 1.1], ['yurt', 2400], ['stable', 3500, 1.15], ['yurt', 4700, 0.9]],
    npcs: [
      { id: 'mei', name: 'メイ（羊飼い）', actor: 'mei', x: 1800, face: -1 },
      { id: 'hayate', name: 'ハヤテ（馬飼い）', actor: 'hayate', x: 4200, face: -1 }
    ],
    weather: { clear: 4, wind: 4, typhoon: 1, drizzle: 1 },
    talk: {
      mei(S) {
        const f = S.f;
        if (S.back && f.hayateTold) return [['npc', 'joy', 'ほら、帰ってきた。はぐれてた子。'], ['npc', 'joy', 'あなたも、帰り道ね。']];
        f.meiTold = true;
        return [['npc', 'normal', '羊が一頭、群れからはぐれちゃったの。'], ['npc', 'normal', 'でもね、探しには行かない。夕方になると、自分で帰ってくるから。'], ['npc', 'joy', '帰る場所を知ってる子は、迷子じゃないのよ。']];
      },
      hayate(S) {
        const f = S.f;
        if (f.meiTold && !f.insightKaze) { f.insightKaze = true; f.hayateTold = true;
          return [['npc', 'normal', '草原には道がない。だから、迷う人も多い。'], ['npc', 'normal', 'でも夜になれば星がある。北の星だけは、ずっと動かない。'], ['npc', 'normal', 'メイの羊が迷わないのも、たぶん同じだ。帰る方角を知ってる。'], ['insight', '', '道がなくても、帰る方角があれば、迷子じゃない。']]; }
        if (f.insightKaze) return [['npc', 'normal', '風が強い日は、馬の背が低くなる。人も、少しかがんで歩くといい。']];
        return [['npc', 'normal', '馬に乗れば、この草原も三日で抜けられる。'], ['npc', 'normal', '歩けば、十日。どちらがいいかは、人による。']];
      }
    }
  });

  // ---------------------------------------------------------------- 5
  C.push({
    id: 'iro', name: '色の都', screens: 6, far: 'twilight',
    hill: '#2e2018', ground: ['#8a8a4a', '#6a4a30', '#a08060'], tint: 'rgba(140,80,30,.08)', bscale: 1.0,
    buildings: [['in_market', 500], ['in_haveli', 1150], ['in_blue', 1900], ['pk_lahore', 2650], ['pk_mosque', 3400], ['pk_mountain', 4550]],
    npcs: [
      { id: 'tanurio', name: 'タヌリオ（香辛料売り）', actor: 'tanurio', x: 900, face: -1 },
      { id: 'kogane', name: 'コガネ（買い物客）', actor: 'kogane', x: 2400, face: -1 }
    ],
    weather: { clear: 5, squall: 2, wind: 1 },
    talk: {
      tanurio(S) {
        const f = S.f;
        if (f.koganeTold && !f.insightIro) { f.insightIro = true;
          return [['npc', 'fun', 'コガネのやつ、半値で買ったと自慢してたろう。'], ['npc', 'joy', 'その一時間、わしは楽しかった。あいつは仕事を休んだ。'], ['npc', 'normal', 'さて、得をしたのはどっちだろうな。'], ['insight', '', '安く買えたかどうかは、何と引きかえにしたかで決まる。']]; }
        if (f.insightIro) return [['npc', 'joy', 'また寄っておくれ。話す時間があるときにな。']];
        f.tanurioTold = true;
        return [['npc', 'normal', 'この香辛料、いくらだと思う？'], ['npc', 'normal', '値札はない。話して決めるんだ。'], ['npc', 'fun', '急いでる客には高く、話し込む客には安くなる。不思議だろう？']];
      },
      kogane(S) {
        const f = S.f;
        f.koganeTold = true;
        if (f.insightIro) return [['npc', 'normal', '今日は値切らずに買ったぞ。仕事に間に合った。']];
        return [['npc', 'joy', 'あの店で一時間しゃべって、香辛料を半値で買ったぞ！'], ['npc', 'normal', '……でも、帰りに考えたら、一時間ぶん仕事を休んでた。'], ['npc', 'normal', 'これは、得なのか？']];
      }
    }
  });

  // ---------------------------------------------------------------- 6
  C.push({
    id: 'suna', name: '砂の国', screens: 5, far: 'desert', fore: false,
    hill: '#3a2a20', ground: ['#c8a46a', '#a07a4a', '#b89064'], tint: 'rgba(160,100,40,.08)', bscale: 1.0,
    buildings: [['adobe', 500], ['mideast_white', 1300], ['adobe', 2700, 0.9], ['mideast_white', 3600, 0.95]],
    npcs: [
      { id: 'iwao', name: 'イワオ（水売り）', actor: 'iwao', x: 1100, face: -1 },
      { id: 'wizard', name: '旅の魔法使い', actor: 'wizard', x: 3200, face: -1 }
    ],
    weather: { clear: 6, wind: 3, fog: 1 },
    talk: {
      iwao(S) {
        const f = S.f;
        if (f.wizardTold && !f.insightSuna) { f.insightSuna = true;
          return [['npc', 'normal', '……魔法使いのじいさんに、何か聞いたか。'], ['npc', 'normal', '子どもらに井戸を教えるのは、商売じゃない。水は、子どもから取るもんじゃない。'], ['npc', 'normal', '言いふらすなよ。商売の顔が立たん。'], ['insight', '', '人に見せる顔と、本当の顔はちがうこともある。悪いほうにだけじゃなく。']]; }
        if (f.insightSuna) return [['npc', 'normal', '水はいらんか。……旅の人には、一杯おまけだ。']];
        return [['npc', 'normal', '水はいらんか。一杯、銅貨一枚。'], ['npc', 'normal', '高い？ ここでは水より高いものはない。'], ['npc', 'normal', '井戸の場所は教えん。それが商売だからな。']];
      },
      wizard(S) {
        S.f.wizardTold = true;
        return [['npc', 'normal', 'わしは魔法で水を出せる……と言いたいが、出せん。'], ['npc', 'normal', '出せるのは、井戸を探す勘だけじゃ。砂の色が、少しだけ濃いところを掘る。'], ['npc', 'normal', 'あの水売りもな、本当は井戸の場所を村の子らには教えておる。わしは見たぞ。']];
      }
    }
  });

  // ---------------------------------------------------------------- 7
  C.push({
    id: 'shirakabe', name: '白壁の港', screens: 6, far: 'sea',
    hill: '#22303a', ground: ['#8aa06a', '#7a6a5a', '#c8b8a0'], tint: 'rgba(40,80,140,.06)', bscale: 1.1,
    buildings: [['gr_chapel', 350], ['es_white', 900], ['it_townhouse', 1550], ['med_white', 2100, 0.9], ['es_gate', 2900], ['it_tuscan', 3500], ['gr_temple', 4400]],
    npcs: [
      { id: 'yui', name: '剣を帯びた娘', actor: 'yui', x: 1300, face: -1 },
      { id: 'mermaid', name: '人魚', actor: 'mermaid', x: 5000, face: -1 }
    ],
    weather: { clear: 6, wind: 2, typhoon: 1, squall: 1 },
    talk: {
      yui(S) {
        const f = S.f;
        if (f.mermaidTold && !f.insightShirakabe) { f.insightShirakabe = true;
          return [['npc', 'normal', '……あの使者と、話したの。'], ['npc', 'fun', '国の話じゃなくて、好きな食べ物の話。あの人、甘い揚げ菓子に目がないの。'], ['npc', 'fun', '国の名前を外したら、ただの、お腹のすいた人だった。'], ['npc', 'normal', 'わたしはユイ。ある国の……まあ、いいわ。また会いましょう、旅の人。'], ['insight', '', '名前より先に、その人を見る。']]; }
        if (f.insightShirakabe) return [['npc', 'fun', '揚げ菓子の店、教えてもらったの。あなたもどう？']];
        f.yuiTold = true;
        return [['npc', 'normal', '……旅の人？ わたしは、ただの剣士よ。'], ['npc', 'normal', 'この港に、海の向こうの国の使者が来るの。わたしの国と、長く争ってきた国。'], ['npc', 'sorrow', '名前を聞いただけで、剣に手がいく。おかしいわよね。']];
      },
      mermaid(S) {
        const f = S.f;
        if (f.yuiTold) { f.mermaidTold = true;
          return [['npc', 'normal', '剣の娘さん、毎晩ここで海を見ているわ。'], ['npc', 'normal', '海の向こうの使者もね、毎晩こっちを見てるの。'], ['npc', 'normal', 'おんなじ顔をして。']]; }
        return [['npc', 'normal', 'この港の白い壁はね、夏の光をはね返すためなの。'], ['npc', 'normal', '海から見ると、町じゅうが笑ってるみたいに見えるのよ。']];
      }
    }
  });

  // ---------------------------------------------------------------- 8
  C.push({
    id: 'kiri', name: '霧の島', screens: 7, far: 'mountains', mid: 'trees',
    hill: '#1c2430', ground: ['#4a6a4a', '#34443a', '#6a6a60'], tint: 'rgba(60,70,100,.10)', bscale: 1.0,
    buildings: [['uk_tudor', 400], ['uk_terrace', 900], ['uk_terrace', 1180], ['city_building', 1700, 0.95], ['white_mansion', 2500, 0.95], ['castle_gate', 3500], ['treehouse', 5000, 0.9]],
    npcs: [
      { id: 'rei', name: '黒衣の女', actor: 'rei', x: 2300, face: -1 },
      { id: 'elf', name: '霧の森の人', actor: 'elf', x: 5600, face: -1 }
    ],
    weather: { fog: 4, densefog: 3, drizzle: 2, clear: 1 },
    talk: {
      rei(S) {
        const f = S.f;
        if (f.elfTold && !f.insightKiri) { f.insightKiri = true;
          return [['npc', 'normal', '戻ったか。森で、黒い外套の男は見た？'], ['me', '', '見ていません。足音も、しなかった。'], ['npc', 'normal', '……助かった。それで、この島にはいないとわかった。'], ['npc', 'normal', 'わたしはレイ。また、どこかの国で。'], ['insight', '', '見ていないものを、見たとは言わない。それも、手がかりになる。']]; }
        if (f.insightKiri) return [['npc', 'normal', '次の国へ行く。……あなたも、気をつけて。']];
        f.reiTold = true;
        return [['npc', 'normal', '……見られたか。ある男を追っている。'], ['npc', 'normal', '黒い外套の、背の高い男。見なかった？'], ['me', '', '見てない、と思う……'], ['npc', 'normal', '「思う」は、いちばん困る答えだ。'], ['npc', 'normal', '森のほうを見てきてくれる？ 見ていないなら、見ていないと言って。']];
      },
      elf(S) {
        const f = S.f;
        if (f.reiTold) f.elfTold = true;
        return [['npc', 'normal', '霧の日はね、みんな何かを見た気になるの。'], ['npc', 'normal', '影も、木も、人に見える。'], ['npc', 'normal', 'だから、見えたものより、聞こえた足音を信じるといいわ。'], ...(f.reiTold ? [['me', '', '（足音は、しなかった。黒衣の人に知らせよう）']] : [])];
      }
    }
  });

  // ---------------------------------------------------------------- 9
  C.push({
    id: 'yuki', name: '雪の村', screens: 5, far: 'snow', fore: false,
    hill: '#3a4458', ground: ['#e8eef4', '#c4ccd8', '#a8b0bc'], tint: 'rgba(80,100,160,.10)', bscale: 1.0,
    buildings: [['nordic_red', 500], ['nordic_red', 1500, 0.85], ['lumber_hut', 2400, 1.4], ['nordic_red', 3400, 1.05]],
    npcs: [
      { id: 'roujin', name: '火守りの老人', actor: 'elder', x: 1250, face: -1 },
      { id: 'yoru', name: 'ヨル（黒猫）', actor: 'yoru', x: 3000, face: -1 }
    ],
    weather: { snow: 6, clear: 2, densefog: 1, wind: 1 },
    talk: {
      roujin(S) {
        const f = S.f;
        if (f.yoruTold && !f.insightYuki) { f.insightYuki = true;
          return [['npc', 'normal', 'ヨルに聞いたか。……わしの話は、毎年ちょっと長くなる。'], ['npc', 'joy', 'だがな、短いろうそくを持つ者は、火を分けるのが上手になる。'], ['npc', 'joy', '持っていっても、減らんのが火じゃ。'], ['insight', '', '火は、灯っているうちに、分けておく。']]; }
        if (f.insightYuki) return [['npc', 'joy', '今夜も、窓に灯りを配って回るとしよう。']];
        return [['npc', 'normal', '寒かろう。火にあたっていけ。'], ['npc', 'normal', 'わしの若いころ、ろうそくがたくさん並ぶ洞窟の夢を見た。一本一本が、人の命だという。'], ['npc', 'joy', 'わしのは、ずいぶん短かった。……それから五十年たつがな。']];
      },
      yoru(S) {
        S.f.yoruTold = true;
        return [['npc', 'normal', 'じいさんの話、聞いた？ あれ、毎年ちょっとずつ長くなるの。ろうそくの話のほうがね。'], ['npc', 'normal', 'でもさ、じいさんが毎晩、村じゅうの窓に灯りを分けて回ってるのは、本当。']];
      }
    }
  });

  // ---------------------------------------------------------------- 10
  C.push({
    id: 'saka', name: '坂の港', screens: 7, far: 'volcano',
    hill: '#2a2030', ground: ['#7a9a5a', '#5a4a3a', '#9a8a70'], tint: 'rgba(120,60,80,.06)', bscale: 1.05,
    buildings: [['mx_house', 400], ['mx_church', 1000], ['br_townhouse', 1550], ['br_hillside', 2150], ['cl_hill_house', 2950], ['ar_boca', 3450], ['cl_stilt', 4150], ['ar_estancia', 5300]],
    npcs: [
      { id: 'mizuchi', name: 'ミズチ（絵描き）', actor: 'mizuchi', x: 1900, face: -1 },
      { id: 'shiro', name: 'シロ（港の子）', actor: 'shiro', x: 3900, face: -1 }
    ],
    weather: { clear: 5, squall: 2, wind: 2, drizzle: 1 },
    talk: {
      mizuchi(S) {
        const f = S.f;
        if (f.shiroTold && !f.insightSaka) { f.insightSaka = true;
          return [['npc', 'normal', 'シロの家の赤、見たかい。あれは、となりの船の色さ。'], ['npc', 'normal', '一軒ぶんには足りない色でも、町じゅうで分ければ足りる。'], ['insight', '', '余りものでも、集めれば町の色になる。']]; }
        if (f.insightSaka) return [['npc', 'normal', '今日は、灯台の白を少しもらってこよう。']];
        return [['npc', 'normal', 'この町の家は、みんな色がちがうだろう？'], ['npc', 'normal', '船を塗った余りのペンキで塗るんだ。だから、どの色も少しずつしかない。']];
      },
      shiro(S) {
        S.f.shiroTold = true;
        return [['npc', 'normal', 'ぼくの家は、青と黄色と、ちょっとだけ赤！'], ['npc', 'normal', '赤は、おとなりの船の色なんだ。'], ['npc', 'normal', '来年は、どんな色の船が来るかなあ。']];
      }
    }
  });

  // ---------------------------------------------------------------- 11
  C.push({
    id: 'mizu', name: '水上の町', screens: 7, far: 'marsh',
    hill: '#1e2a26', ground: ['#5a7a4a', '#4a3e30', '#7a6a54'], tint: 'rgba(40,90,80,.08)', bscale: 1.05,
    buildings: [['sea_barrack', 400], ['sea_twostory', 950], ['sea_stall', 1550], ['sea_shop', 2150], ['sea_tall', 2750], ['sea_stilt', 3500], ['stilt_house', 4400], ['sea_barrack', 5300, 0.9]],
    npcs: [
      { id: 'gou', name: 'ゴウ（屋台）', actor: 'gou', x: 1900, face: -1 },
      { id: 'mitsu2', name: 'ミツ（運び屋）', actor: 'porter', x: 4100, face: -1 }
    ],
    weather: { squall: 4, drizzle: 2, clear: 3, typhoon: 1 },
    talk: {
      gou(S) {
        const f = S.f;
        if (f.mitsuMet2 && !f.insightMizu) { f.insightMizu = true;
          return [['npc', 'normal', 'ミツに会ったか。あいつの荷は、いつもこの町が終点だ。'], ['npc', 'normal', '雨の季節は、ここらは水が上がる。だから家を高くするのさ。毎年、少しずつな。'], ['npc', 'normal', '水と喧嘩しても勝てん。一緒に上がればいい。'], ['insight', '', '水が上がるなら、家も上がればいい。']]; }
        if (f.insightMizu) return [['npc', 'normal', '食っていきな。スコールのあとの麺はうまいぞ。']];
        return [['npc', 'normal', '食っていきな。雨の季節は、ここらは水が上がる。'], ['npc', 'normal', '家ごと水に浸かる？ だから、家を高くするのさ。']];
      },
      mitsu2(S) {
        const f = S.f;
        f.mitsuMet2 = true;
        const lines = S.met('porter')
          ? [['npc', 'normal', 'おや、花野の国で会った旅の人じゃないか！'], ['npc', 'normal', 'ずいぶん遠くで会うもんだね。荷は、ここで下ろすのさ。']]
          : [['npc', 'normal', 'はじめまして。運び屋のミツだよ。西の花野の国から、荷を運んできた。']];
        if (f.seen) lines.push(['npc', 'normal', 'そういえば、あの橋のうわさ。結局どうだった？'], ['me', '', '落ちてたのは、手すりの縄だけでした。'], ['npc', 'normal', 'やっぱりね。うわさは、運ぶ荷より速くて、重くなる。']);
        return lines;
      }
    }
  });

  window.SEE_WORLD = { countries: C };
})();
