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
//                     1枚絵の住人は sprite（assets/actors/<sprite>.webp。f を受け取る関数でも可）、name も関数にできる。
//                     全身ドット絵の住人は sheet（シート定義。画像は assets/actors/<actor>_sheet.webp）と pose(f)、
//                     when(f)（いるときだけ）、leaveWhen(f)（その後は歩き去る）を持てる
//   weather         : 起こりやすい天候と重み { clear, drizzle, squall, typhoon, wind, fog, densefog, snow }
//   talk            : 住人ごとの会話。S を受け取り行の配列を返す
//                     行＝[話し手, 表情, 文]。話し手は 'npc'（話している相手）/ 'me'（nono）/ 'insight'（気づき）
//   S の中身        : S.f（旅全体のフラグ）, S.back（この国より先まで行って戻ってきたか）,
//                     S.ev(k)（噂の証拠を得る）, S.has(k), S.met(npcId)
(function () {
  const C = [];
  // 全身ドット絵のシート（1コマの幅・高さ、立ちコマの背丈、コマ番号、nono に対する背の高さ）
  const AGENT = { idle: 0, walk1: 1, walk2: 2, sneak: 3, crouch: 4, push: 5, wave: 6, carry: 7 };
  const SECOND = { fw: 160, fh: 359, figure: 312, frames: AGENT, h: 1.12 };
  const SECOND_YOUNG = { fw: 262, fh: 478, figure: 456, frames: AGENT, h: 0.8 };
  // ユイとレイは国ごとに衣装が変わる。正体がわかるまでは衣装で呼ぶ
  const YUI = alt => f => f.insightShirakabe ? 'ユイ' : alt;
  const REI = alt => f => f.insightKiri ? 'レイ' : alt;
  const FIRST = { fw: 289, fh: 597, figure: 583, frames: { idle: 0, walk1: 1, walk2: 2, sneak: 3, crouch: 4, wave: 5, carry: 6 }, h: 1.18 };

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
      { id: 'wakai', name: '若い衆', actor: 'sasuke', x: 2900, face: -1 },
      { id: 'yui_take', name: YUI('巫女姿の娘'), sprite: 'yui_miko', x: 600, face: -1 },
      { id: 'rei_take', name: REI('袴の娘'), sprite: 'rei_hakama', x: 3800, face: -1 }
    ],
    weather: { clear: 4, drizzle: 4, fog: 1, wind: 1 },
    talk: {
      yui_take(S) {
        return S.f.insightShirakabe
          ? [['npc', '', 'あら、旅の人。港ではありがとう。'], ['npc', '', 'ここでは巫女のユイ。……王女だってことは、内緒よ。']]
          : [['npc', '', 'この里の社で、少しだけ手伝いをしているの。'], ['npc', '', '剣より、ほうきのほうが難しいわね。']];
      },
      rei_take(S) {
        return S.f.insightKiri
          ? [['npc', '', '霧の島では、助かった。……ここでは、ただの稽古。']]
          : [['npc', '', '……稽古の帰り。任務じゃない日も、ある。']];
      },
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
      { id: 'teishu', name: '魚屋の亭主', actor: 'homura', x: 3300, face: -1 },
      { id: 'yui_koutou', name: YUI('赤い服の娘'), sprite: 'yui_red', x: 1300, face: -1 },
      { id: 'rei_koutou', name: REI('仮面の人'), sprite: 'rei_thief_red', x: 4300, face: -1 }
    ],
    weather: { clear: 5, drizzle: 2, fog: 2, squall: 1 },
    talk: {
      yui_koutou(S) {
        return S.f.insightShirakabe
          ? [['npc', '', 'ここの揚げ菓子は、港のより甘いの。使者にも教えてあげなきゃ。']]
          : [['npc', '', 'お茶を飲みに来ただけよ。……この服？ 目立たないようにと思って。'], ['me', '', '（すごく目立っている……）']];
      },
      rei_koutou(S) {
        return S.f.insightKiri
          ? [['npc', '', 'この仮面は、仕事着。……見なかったことにして。']]
          : [['npc', '', '……見なかったことにして。'], ['me', '', '（仮面をしている……）']];
      },
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
      { id: 'hayate', name: 'ハヤテ（馬飼い）', actor: 'hayate', x: 4200, face: -1 },
      { id: 'yui_kaze', name: YUI('星柄の服の娘'), sprite: 'yui_starry', x: 3000, face: -1 }
    ],
    weather: { clear: 4, wind: 4, typhoon: 1, drizzle: 1 },
    talk: {
      yui_kaze(S) {
        return S.f.insightShirakabe
          ? [['npc', '', '北の星だけは動かない、って。わたしの国の歌にもあるの。']]
          : [['npc', '', '草原の夜は、星が近いわ。'], ['npc', '', 'この服、星の柄なの。……空には負けてるけど。']];
      },
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
      { id: 'kogane', name: 'コガネ（買い物客）', actor: 'kogane', x: 2400, face: -1 },
      { id: 'rei_iro', name: REI('白いシャツの娘'), sprite: 'rei_shirt', x: 3800, face: -1 }
    ],
    weather: { clear: 5, squall: 2, wind: 1 },
    talk: {
      rei_iro(S) {
        return [['npc', '', '市場で、情報を買っている。香辛料のついでに。'], ...(S.f.insightKiri ? [['npc', '', 'タヌリオの店は、話が長い。情報も、長い。']] : [])];
      },
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
      { id: 'wizard', name: '旅の魔法使い', actor: 'wizard', x: 3200, face: -1 },
      { id: 'first', name: 'ファースト（WATCH）', actor: 'first', x: 2200, face: 1, sheet: FIRST, pose: f => f.firstMet ? 'idle' : 'crouch' },
      { id: 'yui_suna', name: YUI('魔女の帽子の娘'), sprite: 'yui_witch', x: 4000, face: -1 }
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
      yui_suna(S) {
        return S.f.insightShirakabe
          ? [['npc', '', 'この帽子、思ったより便利なの。砂が入らない。']]
          : [['npc', '', '魔法使いのおじいさんに弟子入り……したわけじゃないわ。日よけよ、日よけ。']];
      },
      first(S) {
        const f = S.f;
        if (f.firstMet) return [['npc', 'normal', '水脈は、まだ細いが生きている。来年も、この村の井戸は涸れない。'], ['npc', 'normal', '後輩に会ったら、よろしく頼む。']];
        f.firstMet = true;
        return [['npc', 'normal', '……動くな。いや、冗談だ。'], ['npc', 'normal', 'WATCH のエージェント、ファーストだ。この砂の下の、古い水脈を測っている。'], ['npc', 'normal', '任務の中身？ 村の水が、来年も足りるかどうか。それだけだ。'], ['npc', 'normal', '後輩に、セカンドというのがいる。東の坂の港あたりで、小さな任務をしているはずだ。'], ['npc', 'normal', '会ったら伝えてくれ。「小さな任務ほど、きちんと終わらせろ」と。']];
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
      { id: 'yui', name: YUI('剣を帯びた娘'), sprite: f => f.insightShirakabe ? 'yui_queen' : 'yui_uniform', x: 1300, face: -1 },
      { id: 'rei_shira', name: REI('着物の娘'), sprite: 'rei_kimono', x: 3200, face: -1 },
      { id: 'mermaid', name: '人魚', actor: 'mermaid', x: 5000, face: -1 }
    ],
    weather: { clear: 6, wind: 2, typhoon: 1, squall: 1 },
    talk: {
      yui(S) {
        const f = S.f;
        if (f.mermaidTold && !f.insightShirakabe) { f.insightShirakabe = true;
          return [['npc', 'normal', '……あの使者と、話したの。'], ['npc', 'fun', '国の話じゃなくて、好きな食べ物の話。あの人、甘い揚げ菓子に目がないの。'], ['npc', 'fun', '国の名前を外したら、ただの、お腹のすいた人だった。'], ['npc', 'normal', 'わたしはユイ。ある国の……まあ、いいわ。また会いましょう、旅の人。'], ['insight', '', '名前より先に、その人を見る。']]; }
        if (f.insightShirakabe) return [['npc', '', 'この格好？ 今日は正式に、あの使者と会うの。'], ['npc', '', 'ほんとうはね、ある国の王女なの。……旅のあいだは、内緒にしてね。']];
        f.yuiTold = true;
        return [['npc', 'normal', '……旅の人？ わたしは、ただの剣士よ。'], ['npc', 'normal', 'この港に、海の向こうの国の使者が来るの。わたしの国と、長く争ってきた国。'], ['npc', 'sorrow', '名前を聞いただけで、剣に手がいく。おかしいわよね。']];
      },
      rei_shira(S) {
        return S.f.insightKiri
          ? [['npc', '', 'ユイの晴れ姿を見に来た。……言わないで。']]
          : [['npc', '', '港の祭りを、見に来ただけ。……ほんとうに。']];
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
      { id: 'rei', name: REI('赤いマフラーの女'), sprite: 'rei_trench', x: 2300, face: -1 },
      { id: 'yui_kiri', name: YUI('黒いスーツの娘'), sprite: 'yui_suit', x: 1600, face: -1 },
      { id: 'elf', name: '霧の森の人', actor: 'elf', x: 5600, face: -1 },
      { id: 'young', name: '黒い服の少年', actor: 'second_young', x: 4300, face: 1, sheet: SECOND_YOUNG, pose: f => f.insightKiri ? 'wave' : 'sneak' }
    ],
    weather: { fog: 4, densefog: 3, drizzle: 2, clear: 1 },
    talk: {
      yui_kiri(S) {
        return S.f.insightKiri
          ? [['npc', '', 'レイとは、昔からの知り合いなの。……どこで知り合ったかは、内緒。']]
          : [['npc', '', '……ここでは、ある人の護衛をしているの。'], ['npc', '', 'その人？ 赤いマフラーの、無口な人よ。']];
      },
      rei(S) {
        const f = S.f;
        if (f.elfTold && !f.insightKiri) { f.insightKiri = true;
          return [['npc', 'normal', '戻ったか。森で、黒い外套の男は見た？'], ['me', '', '見ていません。足音も、しなかった。'], ['npc', 'normal', '……助かった。それで、この島にはいないとわかった。'], ['npc', 'normal', 'わたしはレイ。また、どこかの国で。'], ['insight', '', '見ていないものを、見たとは言わない。それも、手がかりになる。']]; }
        if (f.insightKiri) return [['npc', 'normal', '次の国へ行く。……あなたも、気をつけて。']];
        f.reiTold = true;
        return [['npc', 'normal', '……見られたか。ある男を追っている。'], ['npc', 'normal', '黒い外套の、背の高い男。見なかった？'], ['me', '', '見てない、と思う……'], ['npc', 'normal', '「思う」は、いちばん困る答えだ。'], ['npc', 'normal', '森のほうを見てきてくれる？ 見ていないなら、見ていないと言って。']];
      },
      young(S) {
        const f = S.f; f.youngMet = true;
        if (f.insightKiri) return [['npc', 'normal', 'お姉さんに聞いたよ。「見ていないなら、見ていないと言え」って。'], ['npc', 'normal', 'メモしとく！ エージェントの心得、その一！']];
        if (f.reiTold) return [['npc', 'normal', 'あの赤いマフラーのお姉さん、本物のエージェントだよね！？'], ['npc', 'normal', 'ぼくも、あんなふうになりたい。']];
        return [['npc', 'normal', 'しーっ！ いま、尾行の練習中なんだ。'], ['npc', 'normal', '大きくなったら、エージェントになる。名前も、もう決めてある。'], ['npc', 'normal', '……ひみつ！']];
      },
      elf(S) {
        const f = S.f;
        if (f.reiTold) f.elfTold = true;
        return [['npc', 'normal', '霧の日はね、みんな何かを見た気になるの。'], ['npc', 'normal', '影も、木も、人に見える。'], ['npc', 'normal', 'だから、見えたものより、聞こえた足音を信じるといいわ。'], ...(f.reiTold ? [['me', '', '（足音は、しなかった。赤いマフラーの人に知らせよう）']] : [])];
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
      { id: 'yoru', name: 'ヨル（黒猫）', actor: 'yoru', x: 3000, face: -1 },
      { id: 'yui_yuki', name: YUI('青いケープの娘'), sprite: 'yui_cape', x: 2100, face: -1 },
      { id: 'rei_yuki', name: REI('紺の外套の人'), sprite: 'rei_thief', x: 4100, face: -1 }
    ],
    weather: { snow: 6, clear: 2, densefog: 1, wind: 1 },
    talk: {
      yui_yuki(S) {
        return [['npc', '', '雪の国は好き。剣が冷たくて、手がかじかむけど。'], ...(S.f.insightShirakabe ? [['npc', '', 'あの火守りのおじいさんに、わたしも灯りをもらったの。']] : [])];
      },
      rei_yuki(S) {
        return [['npc', '', '夜の雪は、足あとが残る。だから、この仕事には向かない。'], ['npc', '', '……今日は、ただの散歩。']];
      },
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
      { id: 'shiro', name: 'シロ（港の子）', actor: 'shiro', x: 3900, face: -1 },
      // WATCH のエージェント SECOND（全身ドット絵。任務が終わると歩き去る）
      { id: 'second', name: 'セカンド（WATCH）', actor: 'second', x: 3000, face: 1, sheet: SECOND,
        pose: f => f.secondDone ? 'wave' : f.secondAsked ? 'sneak' : 'crouch',
        leaveWhen: f => f.secondDone },
      { id: 'yui_saka', name: YUI('鎧の娘'), sprite: 'yui_armor', x: 700, face: -1 },
      { id: 'rei_saka', name: REI('Tシャツの娘'), sprite: 'rei_tee', x: 5000, face: -1 }
    ],
    weather: { clear: 5, squall: 2, wind: 2, drizzle: 1 },
    talk: {
      yui_saka(S) {
        return [['npc', '', '港の祭りで、剣の型を見せる役なの。'], ['npc', '', '戦うためじゃない剣も、悪くないわね。']];
      },
      rei_saka(S) {
        return [['npc', '', '休暇中。……ほんとうよ。'], ['npc', '', '坂の町は、走りがいがある。']];
      },
      mizuchi(S) {
        const f = S.f;
        if (f.shiroTold && !f.insightSaka) { f.insightSaka = true;
          return [['npc', 'normal', 'シロの家の赤、見たかい。あれは、となりの船の色さ。'], ['npc', 'normal', '一軒ぶんには足りない色でも、町じゅうで分ければ足りる。'], ['insight', '', '余りものでも、集めれば町の色になる。']]; }
        if (f.insightSaka) return [['npc', 'normal', '今日は、灯台の白を少しもらってこよう。']];
        return [['npc', 'normal', 'この町の家は、みんな色がちがうだろう？'], ['npc', 'normal', '船を塗った余りのペンキで塗るんだ。だから、どの色も少しずつしかない。']];
      },
      shiro(S) {
        const f = S.f;
        const bell = f.secondAsked && !f.shiroBell
          ? (f.shiroBell = true, [['npc', 'normal', '青い鈴？ それ、ぼくの！ 猫の首輪につけてたんだ。'], ['npc', 'normal', '黒い服のお兄さんが持ってるの？ 教えてくれてありがとう！'], ['me', '', '（セカンドさんに知らせよう）']])
          : [];
        if (f.shiroTold) return bell.length ? bell : [['npc', 'normal', '猫がね、鈴がないと、どこにいるかわかんないの。']];
        f.shiroTold = true;
        return [['npc', 'normal', 'ぼくの家は、青と黄色と、ちょっとだけ赤！'], ['npc', 'normal', '赤は、おとなりの船の色なんだ。'], ['npc', 'normal', '来年は、どんな色の船が来るかなあ。'], ...bell];
      },
      second(S) {
        const f = S.f;
        if (f.shiroBell && !f.secondDone) { f.secondDone = true;
          return [['npc', 'normal', '持ち主は、港の子のシロか。……助かった。'], ['npc', 'normal', '任務完了だ。'],
            ...(f.firstMet
              ? [['me', '', '砂の国で、ファーストさんから伝言です。「小さな任務ほど、きちんと終わらせろ」って。'], ['npc', 'normal', '……先輩に会ったのか。それは、あの人の口ぐせだ。'], ['npc', 'normal', 'いま、ちょうど守ったところだと伝えてくれ。']]
              : [['npc', 'normal', '大げさだって？ 小さな任務ほど、きちんと終わらせたいんだ。']]),
            ['npc', 'normal', 'じゃあな、旅の人。']]; }
        if (f.secondAsked) return [['npc', 'normal', '青い鈴の持ち主、まだ見つからない。子どもの持ち物だと思うんだが。']];
        f.secondAsked = true;
        return [['npc', 'normal', '……しっ。WATCH のエージェント、セカンドだ。'], ['npc', 'normal', '任務中でね。この坂の町で、落とし物の持ち主を探している。'], ['npc', 'normal', '小さな青い鈴だ。持ち主に心当たりは？']];
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
      { id: 'mitsu2', name: 'ミツ（運び屋）', actor: 'porter', x: 4100, face: -1 },
      { id: 'second2', name: 'セカンド（WATCH）', actor: 'second', x: 2950, face: 1, sheet: SECOND, pose: () => 'carry', when: f => f.secondDone },
      { id: 'yui_mizu', name: YUI('水着の娘'), sprite: 'yui_swim', x: 1200, face: -1 },
      { id: 'rei_mizu', name: REI('忍び装束の人'), sprite: 'rei_ninja', x: 5200, face: -1 }
    ],
    weather: { squall: 4, drizzle: 2, clear: 3, typhoon: 1 },
    talk: {
      yui_mizu(S) {
        return [['npc', '', 'スコールのあとは、泳ぐのがいちばん！'], ['npc', '', '……王女らしくない？ いいのよ、旅のあいだは。']];
      },
      rei_mizu(S) {
        return S.f.insightKiri
          ? [['npc', '', '追っていた男は、この町で見つけた。'], ['npc', '', '霧の島で「見ていない」と言ってくれたから、ここだとわかった。'], ['npc', '', 'ありがとう、旅の人。……nono、だったわね。']]
          : [['npc', '', '……忍びの仕事中。話しかけないで。']];
      },
      gou(S) {
        const f = S.f;
        if (f.mitsuMet2 && !f.insightMizu) { f.insightMizu = true;
          return [['npc', 'normal', 'ミツに会ったか。あいつの荷は、いつもこの町が終点だ。'], ['npc', 'normal', '雨の季節は、ここらは水が上がる。だから家を高くするのさ。毎年、少しずつな。'], ['npc', 'normal', '水と喧嘩しても勝てん。一緒に上がればいい。'], ['insight', '', '水が上がるなら、家も上がればいい。']]; }
        if (f.insightMizu) return [['npc', 'normal', '食っていきな。スコールのあとの麺はうまいぞ。']];
        return [['npc', 'normal', '食っていきな。雨の季節は、ここらは水が上がる。'], ['npc', 'normal', '家ごと水に浸かる？ だから、家を高くするのさ。']];
      },
      second2(S) {
        const f = S.f;
        return [['npc', 'normal', 'また会ったな、旅の人。次の任務さ。'], ['npc', 'normal', '袋の中身？ ……この町の子どもたちに配る、本だ。'], ['npc', 'normal', 'WATCH の任務には、こういうのもある。'],
          ...(f.youngMet ? [['npc', 'normal', '……子どものころ、霧の島で尾行の練習をしていた。旅人に見つかって、恥ずかしかったな。'], ['npc', 'normal', 'いや、何の話でもない。']] : [])];
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
