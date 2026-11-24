// SEE ― 世界のデータ（国と地域）
// 1つの国＝「遠景＋建物＋住人＋エピソード＋天候」の型。国を増やすときは COUNTRIES に1件足すだけ。
//
// 国の項目
//   id, name, sub   : 識別子、国名（実在の国をもじった名前）、その土地の呼び名
//   screens         : 広さ（1画面＝960px、4〜8）
//   far             : 遠景 assets/far/<far>.webp
//   mid             : 'trees'（森のシルエット）か省略
//   hill, ground    : 中景の丘の色、地面の色 [草, 土, 道]
//   time            : 時間帯 'morning' / 'noon' / 'dusk'（省略時）/ 'night'。画面の明るさが変わる
//   tint            : 画面全体にかける色
//   bscale          : 建物の倍率（素材の解像度差を吸収）
//   props           : 木や岩などの小物 [画像名, x, 高さpx]（assets/props/）。建物より奥に描く
//   buildings       : [画像名, 国の左端からのx, 倍率(省略可)]
//   npcs            : { id, name, actor, x, face(1=右向き,-1=左向き) }
//                     1枚絵の住人は sprite（assets/actors/<sprite>.webp。f を受け取る関数でも可）、name も関数にできる。
//                     全身ドット絵の住人は sheet（シート定義。画像は assets/actors/<actor>_sheet.webp）と pose(f)、
//                     when(f)（いるときだけ）、leaveWhen(f)（その後は歩き去る）を持てる
//   places          : 見る・聞くだけの場所 { id, name, x, verb('見る'/'聞く'), when(f) }。会話は talk[id]
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
  const YUI = alt => f => f.yuiKnown ? 'ユイ' : alt;
  const REI = alt => f => f.reiKnown ? 'レイ' : alt;
  const FIRST = { fw: 289, fh: 597, figure: 583, frames: { idle: 0, walk1: 1, walk2: 2, sneak: 3, crouch: 4, wave: 5, carry: 6 }, h: 1.18 };

  // ---------------------------------------------------------------- 1 噂の確かめ（証言を集めて、自分の目で見る）
  C.push({
    id: 'hanano', name: 'オランジェ', sub: '花野の村', screens: 7, far: 'flower', mid: 'trees',
    hill: '#1e2a2a', ground: ['#5d8a55', '#3e5a3c', '#6b5a45'], tint: 'rgba(80,40,90,.10)', bscale: 1.6,
    props: [['tree_green', 450, 260], ['bush_berry', 1050, 90], ['tree_autumn', 1980, 250], ['stump', 2950, 70], ['rock_moss', 3700, 110], ['tree_green', 4300, 280], ['pine', 4700, 300]],
    buildings: [['house_small', 560], ['bakery', 1100], ['house_large', 1640], ['elder_house', 2260], ['lumber_hut', 3080]],
    npcs: [
      { id: 'villager', name: 'ゴンジ（村人）', actor: 'villager', x: 940, face: -1 },
      { id: 'elder', name: '長老', actor: 'elder', x: 2420, face: -1 },
      { id: 'lumber', name: 'ダイ（木こり）', actor: 'lumber', x: 3360, face: -1 },
      { id: 'porter', name: 'ミツ（運び屋）', actor: 'porter', x: 4020, face: 1, when: f => !f.boardsSent }
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
          return [['npc', 'surprise', 'おや、戻ってきたのかい。橋はどうだった？'], ['me', '', '落ちてたのは、手すりの縄だけでした。'], ['npc', 'joy', 'なんだ、そうだったのか！ 隣村のやつ、話を大きくしたな。'], ['npc', 'normal', 'いや……「らしい」を取って話したのは、わしかもしれん。'], ['npc', 'joy', 'よし、縄を持って直しに行ってくるよ。'], ['insight', '', '聞いた話は、自分の足で確かめるまで、半分だけ信じておく。']]; }
        if (S.back) return [['npc', 'joy', 'お、また会ったね。こんどは何を聞いてきた？ ……いや、半分だけ聞いとくよ。']];
        return f.bridgeFixed ? [['npc', 'joy', '手すりは直しておいたよ。気をつけて渡りな。']] : [['npc', 'normal', '東の橋の話、本当かどうか。見てきた人がいればなあ。']];
      },
      elder(S) {
        const f = S.f;
        if (f.seen && !f.elderSeen) { f.elderSeen = true;
          return [['npc', 'normal', '橋を見てきたか。……ゴンジに話したかね？'], ['npc', 'joy', 'あれは昔から、話を一つ大きくする男でな。悪気はないんじゃ。']]; }
        if (f.elderSeen) return [['npc', 'joy', '縄の一本なら、村の者で直せる。橋ごと落ちとったら、そうはいかん。']];
        return [['npc', 'normal', '東の橋かね。わしは六十年渡っとるが、落ちたことは一度もない。'], ['npc', 'joy', '……落ちとったら、渡れとらんからのう。']];
      },
      lumber(S) {
        if (S.back) return [['npc', 'fun', '音の正体、聞いたよ。手すりの柱が、縄ごと谷に落ちた音だとさ。'], ['npc', 'fun', '橋が落ちる音にしちゃ、小さいと思ったんだ。……寝てたけどな！']];
        if (!S.has('sound')) { S.ev('sound');
          return [['npc', 'normal', 'よう。この先は谷だぞ。'], ['npc', 'surprise', 'そういや昨夜、東の谷のほうでドーンとでかい音がしたんだ。'], ['npc', 'fun', '木が倒れたのか、何かが落ちたのか……おれは寝ちまったがな！'], ['me', '', S.f.heard ? '（橋の話と、合っている……？）' : '（何の音だろう）']]; }
        return [['npc', 'fun', '音の正体がわかったら教えてくれよ。']];
      },
      porter(S) {
        if (!S.has('crossed')) { S.ev('crossed');
          return [['npc', 'normal', 'ふう。今朝、荷を置いて、その先の吊り橋の具合を見てきたところさ。'], ['npc', 'normal', '揺れはひどかったし、片側がなんだか頼りなかった。でも、渡れたよ。'], ['npc', 'normal', 'これから荷を担いで渡る。東の果ての、水の上の町までね。'], ['me', '', S.f.heard ? '（落ちた橋は、渡れないはず……）' : '（橋があるんだ）']]; }
        return [['npc', 'normal', '荷は板だよ。重いのなんの。']];
      },
      bridge(S) {
        const f = S.f;
        if (f.bridgeFixed) {
          if (f.sawFixed) return [['me', '', '新しい縄の手すり。ゴンジさんたちが直してくれた。']];
          f.sawFixed = true;
          return [['me', '', 'あ……手すりが、新しい縄になっている。'], ['me', '', '行きと帰りで、同じ橋なのに、ちがって見える。']];
        }
        if (f.seen) return [['me', '', '手すりの縄が切れている。床板は、しっかりしている。']];
        S.ev('seen'); f.seen = true;
        return [['me', '', '……橋だ。ちゃんと架かっている。'], ['me', '', '落ちていたのは、片側の手すりの縄だけだ。'], ['me', '', f.heard ? '（「橋が落ちた」は、少しちがったみたいだ。村に戻って話してみよう）' : '（縄が切れている。誰かに知らせたほうがいいかな）']];
      }
    }
  });

  // ---------------------------------------------------------------- 2 たくらみと正直（旅人の一言が、たくらみを止める）
  C.push({
    id: 'take', name: 'ジャポネ', sub: '棚田の里', time: 'morning', screens: 5, far: 'rice_terraces_morning',
    hill: '#1f2a22', ground: ['#5f8a4a', '#3a5034', '#7a6a50'], tint: 'rgba(40,60,40,.04)', bscale: 1.05,
    props: [['torii', 200, 250], ['stone_lantern', 1300, 170], ['pine', 2150, 300], ['stone_lantern', 3150, 170], ['jp_castle', 4300, 430]],
    buildings: [['buke_gate', 380], ['machiya', 900], ['teahouse', 1550], ['nagaya', 2250], ['samurai_mansion', 3250, 0.95]],
    npcs: [
      { id: 'wakai', name: '若い衆', actor: 'sasuke', x: 800, face: -1 },
      { id: 'soba', name: '屋台のそば屋', actor: 'craftsman', x: 2200, face: -1 }
    ],
    weather: { clear: 4, drizzle: 4, fog: 1, wind: 1 },
    talk: {
      wakai(S) {
        const f = S.f;
        if (S.back) return [['npc', 'fun', 'よう、旅の人。ゆうべ、ちゃんと十六文払ってそばを食ったよ。'], ['npc', 'fun', 'うまかった。……ごまかして食うより、うまかった気がする。']];
        if (f.wakaiHonest) return [['npc', 'fun', '今夜はふつうに食う。ふつうに、な。']];
        if (f.sobaAsked) { f.wakaiHonest = true;
          return [['npc', 'fun', 'どうだった？ そば屋に時刻を聞かれたら、九つって言ってくれたか？'], ['me', '', '朝の四つです、と答えました。'], ['npc', 'sorrow', '……正直だなあ。いや、そりゃそうだ。朝だもんな。'], ['npc', 'fun', '人に頼まなきゃできねえたくらみは、もうたくらみじゃねえや。今夜は、ちゃんと払う。'], ['insight', '', '正直に答えただけで、だれかのたくらみが一つ止まった。']]; }
        if (f.wakaiPlan) return [['npc', 'fun', '頼んだぞ。時刻を聞かれたら、九つ。九つだ。']];
        f.wakaiPlan = true;
        return [['npc', 'fun', 'なあ旅の人、ひと儲けの話を聞いてくれ。'], ['npc', 'fun', 'そば屋で勘定のとき、銭を数えながら「いま何どきだい」と聞く。'], ['npc', 'fun', '「九つ」と答えさせて、九の次から数える。一文浮くって寸法さ。'], ['npc', 'fun', 'あのおやじ、時計を持ってねえ。旅の人、時刻を聞かれたら「九つ」と言ってくれよ。'], ['me', '', '（……それは、うそになる）']];
      },
      soba(S) {
        const f = S.f;
        if (S.back) return [['npc', 'joy', 'あの若いの、ゆうべ来てね。銭を数えながら、時刻を聞きかけて……やめたよ。'], ['npc', 'joy', 'そば、うまいってさ。それで十分だ。']];
        if (f.sobaAsked) return [['npc', 'joy', '朝の四つか。仕込みの時刻だ。そばは夜においで。']];
        f.sobaAsked = true;
        return [['npc', 'normal', 'へい、いらっしゃい。……旅の人、いま何どきだい？ 時計がなくてね。'], ['me', '', '朝の、四つくらいです。'], ['npc', 'joy', 'そうかい、ありがとう。ゆうべ一文ごまかされてね。勘定が合わねえ日は、女房に叱られる。'], ['npc', 'normal', 'それから、時刻にはうるさくなったのさ。'], ['me', '', '（若い人に頼まれたことは、言わずにおいた）']];
      }
    }
  });

  // ---------------------------------------------------------------- 3 二重の秘密（うそをついている人と、気づかないふりの人）
  C.push({
    id: 'koutou', name: 'キャセイ', sub: '紅灯の都', time: 'night', screens: 6, far: 'mystic_night',
    hill: '#2a1e26', ground: ['#6a7a4a', '#4a3e34', '#8a7258'], tint: 'rgba(40,20,80,.10)', bscale: 1.3,
    props: [['tree_old_roots', 700, 260], ['pine', 2900, 280], ['stone_lantern', 4000, 150]],
    buildings: [['cn_paifang', 300], ['cn_house', 1000], ['cn_teahouse', 1650], ['cn_nagaya', 2450, 1.1], ['cn_mansion', 3550, 1.15], ['cn_tower', 4650, 1.2]],
    npcs: [
      { id: 'okami', name: '茶館の女将', actor: 'akane', x: 1100, face: -1 },
      { id: 'yui_koutou', name: YUI('赤い服の娘'), sprite: 'yui_red', x: 2600, face: -1 },
      { id: 'teishu', name: '魚屋の亭主', actor: 'homura', x: 3700, face: -1 }
    ],
    weather: { clear: 5, drizzle: 2, fog: 2, squall: 1 },
    talk: {
      okami(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', 'あの人、今夜は魚を一匹多く持って帰ってきたの。'], ['npc', 'normal', '「おまえの好きなやつだ」って。……なにかあったのかしら。']];
        if (f.okamiTold) return [['npc', 'normal', 'お茶、冷めないうちにどうぞ。……さっきの話は、内緒よ。']];
        f.okamiTold = true;
        return [['npc', 'normal', 'いらっしゃい。旅の人なら、話してもいいかしら。'], ['npc', 'normal', 'うちの人に、三年うそをついているの。'], ['npc', 'normal', '川で拾った財布を、夢だと言ったの。あの人、お酒で身を持ちくずしかけてたから。'], ['npc', 'normal', 'それから三年、あの人は一滴も飲まずに働いた。……いつ本当のことを言えばいいのかしら。']];
      },
      yui_koutou(S) {
        const f = S.f;
        if (f.yuiKnown) return [['npc', '', 'ここの揚げ菓子、あの使者にも食べさせてあげたいわ。']];
        return [['npc', '', '……旅の人？ わたしは、ただの旅の剣士。'], ['npc', '', '西の港に、苦手な国の使者が来るの。会いたくなくて、遠回りしてるところ。']];
      },
      teishu(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', '今夜は、女房の好きな魚を一匹よけいに取っといた。'], ['npc', 'normal', '……知らんふりってのも、たまには礼を言いたくなるもんだ。']];
        if (f.koutouDone) return [['npc', 'normal', '女房には内緒だぞ。あいつのうそは、あいつのもんだ。']];
        if (f.okamiTold) { f.koutouDone = true;
          return [['npc', 'normal', 'おう、旅の人。女将の茶館から来たのかい。'], ['npc', 'normal', '……財布の話、聞いたんだろう。顔に書いてある。'], ['npc', 'normal', '知ってるよ。三年前から。あいつは、うそが下手でね。'], ['npc', 'normal', 'でも、あいつが守ってくれたうそだ。だから、知らないふりを守ってる。'], ['insight', '', 'うそを守っている人のうそを、もう一人が守っていた。']]; }
        return [['npc', 'normal', 'おう、旅の人。魚はいらんか。今夜のは、いい目をしてる。'], ['npc', 'normal', '酒？ やめたよ。三年前にな。……いい夢を見たんだ。']];
      }
    }
  });

  // ---------------------------------------------------------------- 4 歩くことが話になる（旅人が知らずに羊を連れて帰る）
  C.push({
    id: 'kaze', name: 'モンゴーラ', sub: '風の草原', screens: 6, far: 'highland',
    hill: '#243024', ground: ['#7aa05a', '#4a6a3a', '#8a7a5a'], tint: 'rgba(60,80,40,.06)', bscale: 1.0,
    props: [['rock', 600, 90], ['bush', 2000, 80], ['watchtower', 3100, 300], ['rock2', 5200, 100]],
    buildings: [['yurt_smoke', 700], ['sheep_pen', 1300, 1.1], ['yurt', 2400], ['stable', 3500, 1.15], ['yurt', 4700, 0.9]],
    npcs: [
      { id: 'mei', name: 'メイ（羊飼い）', actor: 'mei', x: 1900, face: -1 },
      { id: 'hayate', name: 'ハヤテ（馬飼い）', actor: 'hayate', x: 4200, face: -1 }
    ],
    places: [{ id: 'bell', name: '草むらの鈴の音', x: 5300, verb: '聞く' }],
    weather: { clear: 3, wind: 5, typhoon: 1, drizzle: 1 },
    talk: {
      mei(S) {
        const f = S.f;
        if (S.back && f.bellHeard && !f.lambHome) { f.lambHome = true;
          return [['npc', 'joy', 'あっ……帰ってきた！ あの子が、あなたのうしろから。'], ['npc', 'joy', 'あの子、人の歩くほうへついてくる癖があるの。'], ['npc', 'joy', 'あなた、東から、ここまでずっと歩いてきたでしょう。'], ['insight', '', 'ただ歩いていただけで、だれかの帰り道になっていた。']]; }
        if (f.lambHome) return [['npc', 'joy', '今夜は、柵の中で数えたら、ちゃんと全部いる。']];
        if (f.meiTold) return [['npc', 'sorrow', '風が強くなる前に、見つかればいいんだけど。']];
        f.meiTold = true;
        return [['npc', 'sorrow', '子羊が一頭、群れからはぐれたの。首に鈴をつけた子。'], ['npc', 'sorrow', '風が強くなると、鈴の音が聞こえなくなる。'], ['npc', 'sorrow', '追いかけると逃げるの。……どうしたらいいのか、わからない。']];
      },
      hayate(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', '羊は戻ったか。……馬で追わなくて、正解だったな。']];
        if (f.bellHeard) return [['npc', 'normal', '鈴を聞いたか。なら、生きてる。追うな。羊は、追うと逃げる。']];
        return [['npc', 'normal', '羊？ 馬で探してやりたいが、この風じゃ馬が嫌がる。'], ['npc', 'normal', 'こいつが言うには、「風の日に走るのは、ばかと羊だけだ」とさ。'], ['npc', 'normal', '東の岩のほうで、鈴の音がしたって話は聞いた。']];
      },
      bell(S) {
        const f = S.f;
        if (S.back) return [['me', '', '（もう鈴の音はしない）']];
        if (f.bellHeard) return [['me', '', '（ちりん……。近づくと、音が遠ざかる）']];
        f.bellHeard = true;
        return [['me', '', '（ちりん、と鈴の音。草むらの向こうに、白いものが動いた）'], ['me', '', '（近づくと、逃げてしまう。……追わないほうがいいのかな）']];
      }
    }
  });

  // ---------------------------------------------------------------- 5 物々交換（旅で集めた話が、値段になる）
  C.push({
    id: 'iro', name: 'インダスタン', sub: '色の都', screens: 6, far: 'twilight',
    hill: '#2e2018', ground: ['#8a8a4a', '#6a4a30', '#a08060'], tint: 'rgba(140,80,30,.08)', bscale: 1.0,
    props: [['palm', 300, 300], ['palm', 2250, 320], ['bush_berry', 4200, 90]],
    buildings: [['in_market', 500], ['in_haveli', 1150], ['in_blue', 1900], ['pk_lahore', 2650], ['pk_mosque', 3400], ['pk_mountain', 4550]],
    npcs: [
      { id: 'kogane', name: 'コガネ（買い物客）', actor: 'kogane', x: 800, face: -1 },
      { id: 'tanurio', name: 'タヌリオ（香辛料売り）', actor: 'tanurio', x: 2000, face: -1 },
      { id: 'rei_iro', name: REI('白いシャツの娘'), sprite: 'rei_shirt', x: 3600, face: -1 }
    ],
    weather: { clear: 5, squall: 2, wind: 1 },
    talk: {
      kogane(S) {
        const f = S.f;
        if (S.back && f.spice) return [['npc', 'normal', 'なに、話ひとつで一袋もらった？'], ['npc', 'normal', 'おれは一時間しゃべって、半値だぞ。……話の中身が違うのか。']];
        if (f.koganeTold) return [['npc', 'normal', 'あの店で値札を探しても、むだだぞ。']];
        f.koganeTold = true;
        return [['npc', 'normal', '聞いてくれ。あの香辛料屋には、値札がないんだ。'], ['npc', 'normal', '一時間しゃべって、半値にしてもらった。'], ['npc', 'normal', '……帰り道に気づいた。その一時間、仕事を休んでた。']];
      },
      tanurio(S) {
        const f = S.f;
        if (S.back) return [['npc', 'joy', 'おや、帰りかい。こんどはどんな話を持ってきた？'], ['npc', 'fun', '……いや、もう一袋分の話を、あんたの顔がしとる。']];
        if (f.spice) return [['npc', 'joy', 'あの話、今夜うちの子に聞かせてやるよ。']];
        f.spice = true;
        const story = S.f.seen
          ? [['me', '', '西の村で、「橋が落ちた」と聞いて、見に行ったんです。'], ['me', '', '落ちていたのは、手すりの縄一本でした。'], ['npc', 'joy', 'はっはっは！ うわさってのは、そういうもんだ。']]
          : [['me', '', '……ここまで歩いてきた道のことなら。'], ['me', '', '草原で、鈴をつけた子羊がはぐれていました。'], ['npc', 'joy', 'ほう。で、羊は？ ……帰り道でわかる、か。いいね。']];
        return [['npc', 'normal', 'いらっしゃい。値札はないよ。何と換える？'], ['me', '', 'お金は、あまりなくて……'], ['npc', 'fun', 'なら、旅の話でいい。ここらの者は、遠くの話に飢えとる。'], ...story, ['npc', 'joy', 'いい話だ。一袋、持っていきな。'], ['insight', '', '道で聞いた話が、ここでは香辛料一袋になった。']];
      },
      rei_iro(S) {
        const f = S.f;
        if (f.reiKnown) return [['npc', '', 'ここの市場では、情報も量り売り。……あの男の行き先も、半値で買えた。']];
        return [['npc', '', 'この市場では、情報も香辛料と同じ。量って売る。'], ['npc', '', '……あなたは、何を量りに来たの？']];
      }
    }
  });

  // ---------------------------------------------------------------- 6 水の行方を調べる（足あとで真相を見る）
  C.push({
    id: 'suna', name: 'サハリア', sub: '砂の国', time: 'night', screens: 5, far: 'oasis_night', fore: false,
    hill: '#3a2a20', ground: ['#c8a46a', '#a07a4a', '#b89064'], tint: 'rgba(30,30,90,.06)', bscale: 1.0,
    props: [['cactus', 300, 140], ['palm', 900, 300], ['pyramid', 1780, 300], ['desert_temple', 4200, 320]],
    buildings: [['adobe', 500], ['mideast_white', 1300], ['adobe', 2700, 0.9], ['mideast_white', 3600, 0.95]],
    npcs: [
      { id: 'first', name: 'ファースト（WATCH）', actor: 'first', x: 800, face: 1, sheet: FIRST, pose: f => f.firstMet ? 'idle' : 'crouch' },
      { id: 'iwao', name: 'イワオ（水売り）', actor: 'iwao', x: 1900, face: -1 },
      { id: 'wizard', name: '旅の魔法使い', actor: 'wizard', x: 2900, face: -1 }
    ],
    places: [{ id: 'well', name: '古い井戸', x: 4000, verb: '見る' }],
    weather: { clear: 6, wind: 3, fog: 1 },
    talk: {
      first(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', '水脈の減り方を計算し直した。子ども十人が、一日一杯ずつ。'], ['npc', 'normal', 'それなら、涸れない。……計算が合うと、なぜかほっとする。']];
        if (f.firstMet) return [['npc', 'normal', '夜ごとに、桶一杯ぶんずつ減る。泥棒にしては、少なすぎる。']];
        f.firstMet = true;
        return [['npc', 'normal', '……動くな。いや、冗談だ。WATCH のエージェント、ファースト。'], ['npc', 'normal', 'この下の古い水脈を測っている。毎晩、だれかが少しずつ汲んでいる。'], ['npc', 'normal', 'このまま減り続けたら、来年の夏、この村の井戸は涸れる。'], ['npc', 'normal', '後輩のセカンドが、東の坂の港にいる。会ったら伝えてくれ。'], ['npc', 'normal', '「小さな任務ほど、きちんと終わらせろ」とな。']];
      },
      iwao(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', '……水はいらんか。旅の人には、一杯おまけだ。']];
        if (f.wellSeen && !f.sunaDone) { f.sunaDone = true;
          return [['npc', 'normal', '……井戸を見たのか。'], ['npc', 'normal', 'あの井戸は、おれの商売の井戸だ。夜だけ、子どもらに開けてる。'], ['npc', 'normal', '水は、子どもから取るもんじゃない。……言いふらすなよ。'], ['insight', '', 'いちばん高く水を売っている人が、夜には、ただで配っていた。']]; }
        if (f.sunaDone) return [['npc', 'normal', '言いふらすなよ。商売の顔が立たん。']];
        return [['npc', 'normal', '水はいらんか。一杯、銅貨一枚。'], ['npc', 'normal', '高い？ ここでは水より高いものはない。井戸の場所は教えん。'], ['me', '', '（大きな桶を、足もとに置いている）']];
      },
      wizard(S) {
        const f = S.f;
        if (f.sunaDone || S.back) return [['npc', 'normal', '水泥棒の正体？ ……知らんほうが、わしは寝つきがいい。']];
        if (f.wizardTold) return [['npc', 'normal', '東の古井戸を見てくるといい。砂は、うそをつかん。']];
        f.wizardTold = true;
        return [['npc', 'normal', '水泥棒の話かね。わしは魔法で水を出せる……と言いたいが、出せん。'], ['npc', 'normal', '出せるのは勘だけじゃ。東の古井戸のまわり、砂の色が毎朝ちがう。']];
      },
      well(S) {
        const f = S.f;
        if (f.wellSeen) return [['me', '', '（小さな足あとと、桶を引きずった跡）']];
        f.wellSeen = true;
        return [['me', '', '（井戸のまわりに、小さな足あとがたくさん）'], ['me', '', '（それと、大人の足あとが一つ。重い桶を引きずった跡が、西へ続いている）']];
      }
    }
  });

  // ---------------------------------------------------------------- 7 橋渡し（同じ灯りを数える二人）
  C.push({
    id: 'shirakabe', name: 'グレシア', sub: '白壁の港', time: 'night', screens: 6, far: 'river_bridge_night',
    hill: '#22303a', ground: ['#8aa06a', '#7a6a5a', '#c8b8a0'], tint: 'rgba(255,250,230,.0)', bscale: 1.1,
    props: [['tree_olive', 2600, 300], ['lighthouse', 5250, 420], ['boat_wreck', 5500, 200]],
    buildings: [['gr_chapel', 350], ['es_white', 900], ['it_townhouse', 1550], ['med_white', 2100, 0.9], ['es_gate', 2900], ['it_tuscan', 3500], ['gr_temple', 4400]],
    npcs: [
      { id: 'yui', name: YUI('剣を帯びた娘'), sprite: f => f.yuiKnown ? 'yui_queen' : 'yui_uniform', x: 1300, face: -1 },
      { id: 'mermaid', name: '人魚', actor: 'mermaid', x: 3000, face: -1 },
      { id: 'envoy', name: '海の向こうの使者', actor: 'kurogane', x: 4700, face: -1, when: f => !f.envoyMoved },
      { id: 'envoy2', name: '海の向こうの使者', actor: 'kurogane', x: 1650, face: -1, when: f => f.envoyMoved }
    ],
    weather: { clear: 6, wind: 2, typhoon: 1, squall: 1 },
    talk: {
      yui(S) {
        const f = S.f;
        if (S.back && f.yuiKnown) return [['npc', 'fun', '……七つ目で、あちらが先に寝てしまったの。'], ['npc', 'fun', '揚げ菓子の話をしてたら、眠れない理由を忘れちゃった。']];
        if (f.envoyMoved && !f.yuiKnown) { f.yuiKnown = true;
          return [['npc', 'surprise', '……あの使者が、桟橋に来てる。わたしと同じ灯台を見てる。'], ['npc', 'normal', '旅の人、何か言ったでしょう。……いいわ。今夜は、七つまで隣で数えてみる。'], ['npc', 'normal', 'わたしはユイ。隣国の王女……だってことは、旅のあいだは内緒にしてね。']]; }
        if (f.yuiKnown) return [['npc', 'normal', '三つ目。……隣で、あちらも数えてる。声には出さないけど。']];
        if (f.yuiTold) return [['npc', 'sorrow', '海の向こうの使者は、灯台のそばにいるそうよ。……行かないけど。']];
        f.yuiTold = true;
        return [['npc', 'normal', '……旅の人？ わたしは、ただの剣士。'], ['npc', 'normal', 'この港に、海の向こうの国の使者が来たの。わたしの国と、長く争ってきた国。'], ['npc', 'sorrow', '名前を聞いただけで、剣に手がいく。おかしいわよね。'], ['npc', 'normal', '眠れない夜は、灯台の光を数えるの。七つ数えると、眠れる。']];
      },
      mermaid(S) {
        if (S.back && S.f.envoyMoved) return [['npc', 'normal', 'ゆうべは、二人とも七つ数える前に眠ってしまったの。話しこみすぎて。']];
        if (S.f.envoyMoved) return [['npc', 'normal', '今夜は、あの二人、同じ桟橋で灯台を見てるわ。少し離れて、だけど。']];
        return [['npc', 'normal', '剣の娘さんと、灯台の使者さん。'], ['npc', 'normal', '毎晩、同じ時間に、同じ光を見てるのよ。海から見ると、よくわかる。']];
      },
      envoy(S) {
        const f = S.f;
        if (!f.yuiTold) return [['npc', 'normal', '……旅の者か。すまないが、いまは一人にしてくれ。灯りを数えている。']];
        f.envoyMoved = true;
        return [['npc', 'normal', '旅の者か。……眠れなくてな。灯台の光を数えている。'], ['me', '', '七つ、ですか？'], ['npc', 'normal', '……なぜ分かる。'], ['me', '', '剣を持った娘さんも、七つ数えると眠れるって。'], ['npc', 'normal', '剣の娘……隣国の王女殿下か。あの方も、眠れないのか。'], ['npc', 'normal', '……今夜は、あちらの桟橋で数えてみよう。'], ['insight', '', '名前を知る前に、同じ灯りを数えている人だと知った。']];
      },
      envoy2(S) {
        if (S.back) return [['npc', 'normal', '話してみたら、王女殿下は揚げ菓子の話しかなさらない。'], ['npc', 'normal', '……わが国にも、うまい揚げ菓子がある。困ったことだ。']];
        return [['npc', 'normal', '……四つ目だ。王女殿下は、まだ口をきいてくださらない。']];
      }
    }
  });

  // ---------------------------------------------------------------- 8 霧（追っている者が、追われていた）
  C.push({
    id: 'kiri', name: 'ブリテニア', sub: '霧の島', time: 'morning', screens: 7, far: 'cliffs_morning', mid: 'trees',
    hill: '#1c2430', ground: ['#4a6a4a', '#34443a', '#6a6a60'], tint: 'rgba(60,70,100,.08)', bscale: 1.0,
    props: [['tower_ivy', 3100, 380], ['rune_stone', 4100, 110], ['tree_dead', 4600, 260], ['stone_chapel', 6100, 360]],
    buildings: [['uk_tudor', 400], ['uk_terrace', 900], ['uk_terrace', 1180], ['city_building', 1700, 0.95], ['white_mansion', 2500, 0.95], ['castle_gate', 3500], ['treehouse', 5000, 0.9]],
    npcs: [
      { id: 'yui_kiri', name: YUI('黒いスーツの娘'), sprite: 'yui_suit', x: 1300, face: -1 },
      { id: 'rei', name: REI('赤いマフラーの女'), sprite: 'rei_trench', x: 2300, face: -1 },
      { id: 'elf', name: '霧の森の人', actor: 'elf', x: 3800, face: -1 },
      { id: 'young', name: '黒い服の少年', actor: 'second_young', x: 4900, face: 1, sheet: SECOND_YOUNG, pose: f => f.reiKnown ? 'wave' : 'sneak', when: f => f.stepsHeard }
    ],
    places: [{ id: 'steps', name: '霧の中の足音', x: 5500, verb: '聞く', when: f => f.reiAsked && !f.stepsHeard }],
    weather: { fog: 4, densefog: 3, drizzle: 2, clear: 1 },
    talk: {
      yui_kiri(S) {
        const f = S.f;
        if (f.reiKnown) return [['npc', '', 'レイとは、古い知り合いなの。……つけられてたって？ あの人が？']];
        return [['npc', '', '霧の島の夜会に呼ばれて来たの。踊るより、剣のほうが楽。'], ['npc', '', 'あそこの赤いマフラーの人、さっきから、ずっと後ろを気にしてる。']];
      },
      rei(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', 'あの子、弟子にしてくれと言ってきた。……断った。三日後に、もう一度来いと言った。']];
        if (f.boyFound && !f.reiKnown) { f.reiKnown = true;
          return [['npc', 'normal', '戻ったか。黒い外套の男は？'], ['me', '', 'いませんでした。足音を追ったら、黒い服の男の子が。'], ['me', '', 'あなたを、朝からつけていたそうです。'], ['npc', 'normal', '……つけられていたのは、わたしのほうか。'], ['npc', 'normal', 'これで、気配に惑わされずに追える。……助かった。'], ['npc', 'normal', 'わたしはレイ。あなたは？'], ['me', '', 'nono です。旅をしています。']]; }
        if (f.reiKnown) return [['npc', 'normal', '気配が一つ減ると、霧の向こうがよく聞こえる。男は、東だ。……また、どこかの国で、nono。']];
        if (f.reiAsked) return [['npc', 'normal', '森のほうで、何か聞こえたら教えて。見えたものより、聞こえたもの。']];
        f.reiAsked = true;
        return [['npc', 'normal', '……ある男を追っている。黒い外套の、背の高い男。見失えば、また誰かの家が荒らされる。'], ['npc', 'normal', '霧で見えないのに、ずっと誰かの気配がする。'], ['npc', 'normal', '森のほうで、何か聞こえたら教えて。見えたものより、聞こえたもの。']];
      },
      elf(S) {
        const f = S.f;
        if (f.stepsHeard) return [['npc', 'normal', '足音は聞けた？ 霧の日は、耳のほうが正直なの。']];
        return [['npc', 'normal', '霧の日はね、みんな何かを見た気になるの。影も、木も、人に見える。'], ['npc', 'normal', '見えたものより、聞こえた足音を信じるといいわ。']];
      },
      steps(S) {
        S.f.stepsHeard = true;
        return [['me', '', '（足音……。大人の重い足音じゃない。軽い、子どもの足音だ）'], ['me', '', '（すぐうしろで、止まった）']];
      },
      young(S) {
        const f = S.f; f.youngMet = true;
        if (S.back) return [['npc', 'normal', '兄ちゃんに手紙を書いた。「尾行、ばれた」って。'], ['npc', 'normal', '兄ちゃんも昔、ばれたことがあるんだって。']];
        if (f.reiKnown) return [['npc', 'normal', 'お姉さんに会いに行ってくる！ 弟子にしてもらうんだ！']];
        if (f.boyFound) return [['npc', 'normal', 'お姉さんには、ないしょにしてて。……やっぱり、言ってもいいよ。']];
        f.boyFound = true;
        return [['npc', 'normal', 'ば、ばれた！ 尾行の練習中だったのに。'], ['npc', 'normal', '赤いマフラーのお姉さんを、朝からつけてたんだ。本物のエージェントだから。'], ['npc', 'normal', 'ぼくの兄ちゃんも、エージェントなんだ。WATCH っていうところの。'], ['me', '', '（あの人が感じていた気配は、この子だったんだ）'], ['insight', '', '追っているつもりで、追われていることもある。']];
      }
    }
  });

  // ---------------------------------------------------------------- 9 火を分ける（頼まれて、最後の窓に灯りを届ける）
  C.push({
    id: 'yuki', name: 'ノルヴィーク', sub: '雪の村', time: 'night', screens: 5, far: 'aurora_night', fore: false,
    hill: '#3a4458', ground: ['#e8eef4', '#c4ccd8', '#a8b0bc'], tint: 'rgba(120,140,190,.08)', bscale: 1.0,
    props: [['pine_snow', 300, 300], ['tree_snow', 2900, 300], ['pine_snow', 4400, 320]],
    buildings: [['nordic_red', 500], ['nordic_red', 1500, 0.85], ['lumber_hut', 2400, 1.4], ['nordic_red', 3400, 1.05]],
    npcs: [
      { id: 'yoru', name: 'ヨル（黒猫）', actor: 'yoru', x: 900, face: -1 },
      { id: 'roujin', name: '火守りのコテツ', actor: 'kotetsu', x: 2000, face: -1 }
    ],
    places: [{ id: 'window', name: 'いちばん東の家の窓', x: 3700, verb: '見る' }],
    weather: { snow: 6, clear: 2, densefog: 1, wind: 1 },
    talk: {
      yoru(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', 'いちばん東の家の窓、今朝も灯ってたよ。あんたの運んだ火、まだ消えてない。']];
        if (f.lampDone) return [['npc', 'normal', 'じいさん、あんたに火を持たせたの？ ……珍しい。']];
        return [['npc', 'normal', 'この村でいちばん遅くまで灯ってる窓、どこか知ってる？'], ['npc', 'normal', '火守りのじいさんの家。……じいさんは、窓が全部灯るまで寝ないの。'], ['npc', 'normal', 'いちばん東の家の子は、母さんが山向こうに働きに出てて、いま一人。あそこだけ、暗い。']];
      },
      roujin(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', '今朝、いちばん東の家の子が、礼を言いに来た。'], ['npc', 'normal', '……わしのろうそくが、少し伸びた気がする。気のせいじゃろうがな。']];
        if (f.lampDone) return [['npc', 'normal', '灯ったか。ありがとうよ。今夜は、早く眠れそうじゃ。']];
        if (f.lampGiven) return [['npc', 'normal', '火は、いちばん東の家まで。風に気をつけてな。']];
        f.lampGiven = true;
        return [['npc', 'normal', '寒かろう。火にあたっていけ。'], ['npc', 'normal', '若いころ、ろうそくが並ぶ洞窟の夢を見た。一本一本が、人の命だという。'], ['npc', 'normal', 'わしのは、ずいぶん短かった。……それから五十年、毎晩こうして火を配っとる。'], ['npc', 'normal', '旅の人、ついでに頼まれてくれんか。この火を、いちばん東の家まで。'], ['me', '', '（ランタンを受け取った。小さいけれど、あたたかい）']];
      },
      window(S) {
        const f = S.f;
        if (!f.lampGiven) return [['me', '', '（窓が暗い。この家だけ、灯りがない）']];
        if (f.lampDone) return [['me', '', '（窓の灯りが、雪に映っている）']];
        f.lampDone = true;
        return [['me', '', '（窓辺のろうそくに、ランタンの火を移した）'], ['me', '', '（ランタンの火は、そのまま、手の中で燃えている）'], ['insight', '', '火を分けても、手元の火は減らなかった。']];
      }
    }
  });

  // ---------------------------------------------------------------- 10 落とし物の持ち主探し（色の町で、色を手がかりに）
  C.push({
    id: 'saka', name: 'チリーノ', sub: '坂の港', screens: 7, far: 'volcano',
    hill: '#2a2030', ground: ['#7a9a5a', '#5a4a3a', '#9a8a70'], tint: 'rgba(120,60,80,.06)', bscale: 1.05,
    props: [['palm', 2650, 300], ['step_pyramid', 5800, 360], ['cactus', 6300, 140]],
    buildings: [['mx_house', 400], ['mx_church', 1000], ['br_townhouse', 1550], ['br_hillside', 2150], ['cl_hill_house', 2950], ['ar_boca', 3450], ['cl_stilt', 4150], ['ar_estancia', 5300]],
    npcs: [
      { id: 'second', name: 'セカンド（WATCH）', actor: 'second', x: 1300, face: 1, sheet: SECOND,
        pose: f => f.secondDone ? 'wave' : f.secondAsked ? 'sneak' : 'crouch', leaveWhen: f => f.secondDone },
      { id: 'mizuchi', name: 'ミズチ（絵描き）', actor: 'mizuchi', x: 2600, face: -1 },
      { id: 'shiro', name: 'シロ（港の子）', actor: 'shiro', x: 4000, face: -1 }
    ],
    weather: { clear: 5, squall: 2, wind: 2, drizzle: 1 },
    talk: {
      second(S) {
        const f = S.f;
        if (f.shiroBell && !f.secondDone) { f.secondDone = true;
          return [['me', '', '鈴の持ち主は、港の子のシロでした。猫の首輪の鈴だそうです。'], ['npc', 'normal', '……猫か。どうりで、子どもの手のにおいがしないと思った。'], ['npc', 'normal', '任務完了だ。シロには、おれから返しに行く。'],
            ...(f.firstMet
              ? [['me', '', 'サハリアで、ファーストさんから伝言です。「小さな任務ほど、きちんと終わらせろ」'], ['npc', 'normal', '……先輩らしい。いま、ちょうど守ったところだと伝えてくれ。']]
              : []),
            ['npc', 'normal', 'じゃあな、旅の人。']]; }
        if (f.secondAsked) return [['npc', 'normal', '青い鈴の持ち主、まだ分からない。この町は、色が多すぎる。']];
        f.secondAsked = true;
        return [['npc', 'normal', '……しっ。WATCH のエージェント、セカンドだ。任務中でね。'], ['npc', 'normal', '坂の途中で、小さな青い鈴を拾った。持ち主を探している。'], ['npc', 'normal', '大げさだって？ 落とした本人には、大げさじゃないかもしれない。']];
      },
      mizuchi(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', '黒い服の男が、猫に鈴をつけてやってたよ。……絵になる光景だった。']];
        if (f.secondAsked) return [['npc', 'normal', '青い鈴？ この町で青を使ってる家は、二軒だけだ。'], ['npc', 'normal', '一軒は空き家。もう一軒は、東のシロの家。窓枠が、鈴と同じ青だ。']];
        return [['npc', 'normal', 'この町の家は、みんな色がちがうだろう？'], ['npc', 'normal', '船を塗った余りのペンキで塗るんだ。だから、どの色も少しずつしかない。']];
      },
      shiro(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', 'チロの鈴、黒い服のお兄さんが返しに来てくれたよ！'], ['npc', 'normal', '鈴が鳴るから、夜でもチロがどこにいるかわかる。']];
        if (f.shiroBell) return [['npc', 'normal', 'チロ、鈴がないと、すぐどこかに行っちゃうの。']];
        if (f.secondAsked) { f.shiroBell = true;
          return [['npc', 'normal', 'ぼくの家は、青と黄色と、ちょっとだけ赤！'], ['me', '', '黒い服の人が、青い鈴の持ち主を探してたよ。'], ['npc', 'normal', 'それ、チロの！ 猫のチロの首輪につけてたの！'], ['npc', 'normal', 'なくしてから、夜、チロがどこにいるか分からなくて、眠れなかったの。'], ['insight', '', 'だれかの小さな落とし物が、持ち主には、いちばん大きな落とし物だった。']]; }
        return [['npc', 'normal', 'ぼくの家は、青と黄色と、ちょっとだけ赤！'], ['npc', 'normal', '猫のチロを探してるの。見なかった？']];
      }
    }
  });

  // ---------------------------------------------------------------- 11 届いた荷（オランジェから同じ道を来たもの）
  C.push({
    id: 'mizu', name: 'シャムラ', sub: '水上の町', time: 'noon', screens: 7, far: 'mangrove_noon',
    hill: '#1e2a26', ground: ['#5a7a4a', '#4a3e30', '#7a6a54'], tint: 'rgba(40,90,80,.03)', bscale: 1.05,
    props: [['reeds', 3300, 120], ['palm', 4100, 320], ['jungle_temple_tree', 6000, 400]],
    buildings: [['sea_barrack', 400], ['sea_twostory', 950], ['sea_stall', 1550], ['sea_shop', 2150], ['sea_tall', 2750], ['sea_stilt', 3500], ['stilt_house', 4400], ['sea_barrack', 5300, 0.9]],
    npcs: [
      { id: 'mitsu2', name: 'ミツ（運び屋）', actor: 'porter', x: 600, face: 1 },
      { id: 'gou', name: 'ゴウ（屋台）', actor: 'gou', x: 1500, face: -1 },
      { id: 'yui_mizu', name: YUI('水着の娘'), sprite: 'yui_swim', x: 2400, face: -1 },
      { id: 'second2', name: 'セカンド（WATCH）', actor: 'second', x: 3600, face: 1, sheet: SECOND, pose: () => 'carry', when: f => f.secondDone },
      { id: 'rei_mizu', name: REI('忍び装束の人'), sprite: 'rei_ninja', x: 5300, face: -1 }
    ],
    weather: { squall: 4, drizzle: 2, clear: 3, typhoon: 1 },
    talk: {
      gou(S) {
        const f = S.f;
        if (S.back) return f.boardsSent
          ? [['npc', 'normal', '見てくれ、床が膝の高さまで上がった。ミツの板だ。'], ['npc', 'normal', 'オランジェの木だとさ。……遠くの森の上で、麺をゆでてるわけだ。']]
          : [['npc', 'normal', '板、まだ来ないな。今年の雨は、待ってくれるといいが。']];
        if (f.boardsSent) return [['npc', 'normal', '板が来た！ 床を上げたら、一杯おごるよ。']];
        if (f.mitsuArrived) { f.boardsSent = true;
          return [['npc', 'normal', '食っていきな。……と言いたいが、見てくれ、床がもう水に浸かりそうだ。'], ['npc', 'normal', 'この町は毎年、雨の前に床を上げる。今年は、板が届かなくてな。'], ['me', '', '町の入口で、板を担いだ運び屋さんが休んでいました。'], ['npc', 'normal', 'ミツか！ ……迎えに行ってくる。鍋を見ててくれ！'], ['insight', '', 'オランジェから同じ道を来た板が、ここで床になる。']]; }
        return [['npc', 'normal', '食っていきな。……と言いたいが、見てくれ、床がもう水に浸かりそうだ。'], ['npc', 'normal', 'この町は毎年、雨の前に床を上げる。今年は、板が届かなくてな。'], ['npc', 'normal', '西から、運び屋が来るはずなんだが。']];
      },
      yui_mizu(S) {
        const f = S.f;
        return f.yuiKnown
          ? [['npc', '', 'スコールのあとは、泳ぐのがいちばん！'], ['npc', '', '……王女らしくない？ いいのよ、旅のあいだは。']]
          : [['npc', '', 'スコールのあとは、泳ぐのがいちばん！ 剣は、宿に置いてきた。']];
      },
      second2(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', '本は配り終えた。袋が軽いと、歩き方を忘れそうになる。']];
        return [['npc', 'normal', 'また会ったな、旅の人。次の任務さ。袋の中身は、この町の子に配る本だ。'],
          ...(f.youngMet ? [['npc', 'normal', '霧の島で、黒い服の子どもに会わなかったか。……弟だ。'], ['npc', 'normal', '尾行がばれた、と手紙が来た。おれも昔、同じことをした。']] : [['npc', 'normal', 'WATCH の任務には、こういうのもある。']])];
      },
      mitsu2(S) {
        const f = S.f;
        if (S.back) return f.boardsSent ? [['npc', 'normal', 'さて、帰りは手ぶらだ。軽い軽い。また西で会おう。']] : [['npc', 'normal', 'もう一息なんだけどね。足が棒だよ。']];
        if (f.boardsSent) return [['npc', 'normal', 'ゴウが迎えに来たよ。あとは、あいつが担ぐってさ。']];
        if (f.mitsuArrived) return [['npc', 'normal', 'もう一息なんだけどね。足が棒だよ。']];
        f.mitsuArrived = true;
        const hello = S.met('porter')
          ? [['npc', 'normal', 'おや、オランジェで会った旅の人じゃないか！ 追い抜かれちまったね。']]
          : [['npc', 'normal', 'はじめまして。運び屋のミツ。西のオランジェから、板を担いできた。']];
        const rumor = f.seen
          ? [['npc', 'normal', 'そういえば、あの橋のうわさ。結局どうだった？'], ['me', '', '落ちてたのは、手すりの縄だけでした。'], ['npc', 'normal', 'やっぱりね。うわさは、運ぶ荷より速くて、重くなる。']]
          : [];
        return [...hello, ['npc', 'normal', 'この板を、ゴウって屋台に届けるんだ。……少し休んでから行くよ。'], ...rumor];
      },
      rei_mizu(S) {
        const f = S.f;
        if (!f.reiKnown) return [['npc', '', '……仕事中。話しかけないで。']];
        return [['npc', '', '黒い外套の男は、この町で見つけた。足音で分かった。'], ['npc', '', '霧の島で、あの子の足音と聞き分けられたおかげ。……ありがとう、nono。']];
      }
    }
  });

  // ---------------------------------------------------------------- 12 大事件（堤防のしみ。戦わずに、知らせて間に合わせる）
  C.push({
    id: 'kazaguruma', name: 'ネーデラ', sub: '風車の低地', time: 'morning', screens: 6, far: 'windmills_morning',
    hill: '#2a3a34', ground: ['#6a9a5a', '#3e5a3c', '#7a6a54'], tint: 'rgba(120,140,170,.05)', bscale: 1.0,
    props: [['reeds', 500, 120], ['tree_green', 1700, 250], ['bush', 3000, 80], ['reeds2', 4900, 120]],
    buildings: [['thatched_farm', 900, 0.9], ['uk_terrace', 2700], ['nordic_red', 3300, 0.9], ['house_small', 5000, 1.5]],
    npcs: [
      { id: 'pim', name: 'ピム（少年）', actor: 'nibulus', x: 700, face: 1 },
      { id: 'miller', name: '粉屋のゴロ', actor: 'oni', x: 2300, face: -1 },
      { id: 'keeper', name: '堤防番のアンナ', actor: 'archer', x: 4500, face: -1 }
    ],
    places: [{ id: 'leak', name: '堤防の手形', x: 450, verb: '見る', when: f => f.dikeFixed }],
    weather: { wind: 1 }, // 風車が排水に回るので、この国はいつも強風
    talk: {
      leak(S) {
        const f = S.f;
        return [['me', '', '（しみのあとに、小さな手形のついた粘土が詰めてある）'], ['me', '', '（堤防の向こうは海だ。こっちのほうが、低い）']];
      },
      pim(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', 'しみのところ、粘土に、ぼくの手形を残したんだ。乾いたら、ずっと残るって！']];
        if (f.dikeFixed) return [['npc', 'normal', 'みんな来てくれた！ 指がまだ、じんじんする。']];
        if (f.pimAsked) return [['npc', 'normal', 'はやく……！ 指が、もう冷たくて。']];
        f.pimAsked = true;
        return [['npc', 'normal', '旅の人！ 堤防から、水がしみ出してる！'], ['me', '', '（少年の小さな指の下から、水が細く噴き出している）'], ['npc', 'normal', '指でふさいでるけど、離したら、穴が広がっちゃう。'], ['npc', 'normal', '東の水門に、堤防番のアンナさんがいる。知らせて！ ぼく、ここを離れられない。']];
      },
      miller(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', '今日の粉は、ちょっとだけ塩の味がする気がする。……気のせいだな。']];
        if (f.dikeFixed) return [['npc', 'normal', '風に礼を言っとけ。今日の風がなけりゃ、水は抜けなかった。']];
        if (f.pimAsked && !f.millRun) { f.millRun = true;
          return [['npc', 'normal', '堤防がしみてる？ ……この風なら、風車で水をかき出せる。'], ['npc', 'normal', '粉ひきは後回しだ。羽根を排水に切りかえる。おまえは、アンナのところへ走れ！']]; }
        if (f.millRun) return [['npc', 'normal', '羽根は回ってる。走れ、旅の人！']];
        return [['npc', 'normal', 'いい風だ。こういう日は、粉がよく挽ける。'], ['npc', 'normal', '……顔がこわい？ よく言われる。粉は白いぞ。']];
      },
      keeper(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', 'あの子、将来いい堤防番になる。指一本で、村を守ったんだから。']];
        if (f.dikeFixed) return [['npc', 'normal', '粘土は詰めた。今夜は、わたしが見張る。']];
        if (f.pimAsked) { f.dikeFixed = true;
          return [['npc', 'normal', 'しみてる？ どこ！ ……西の端か。'], ['npc', 'normal', 'ゴロの風車が回ってる。水位が少し下がってるのは、そのせいか。'], ['npc', 'normal', '鐘を鳴らす！ 粘土と人を集めて、すぐ行く。知らせてくれて助かった。'], ['insight', '', '気づいた子、知らせた旅人、風車を回した粉屋。一人では、間に合わなかった。']]; }
        return [['npc', 'normal', '風の強い日は、堤防の機嫌が悪い。見回りが増える。'], ['npc', 'normal', 'この国の半分は、海より低いんだ。知ってたかい？']];
      }
    }
  });

  // ---------------------------------------------------------------- 13 祈りがぶつかる（雨を待つ人と、降るなと願う人）
  C.push({
    id: 'shio', name: 'ボリビアナ', sub: '塩の湖', time: 'noon', screens: 6, far: 'salt_lake_noon', fore: false,
    hill: '#b8b0a8', ground: ['#e8e4dc', '#d4cec4', '#c8beb0'], tint: 'rgba(200,220,255,.04)', bscale: 1.0,
    props: [['cactus', 600, 150], ['rock', 2200, 80], ['rock2', 4600, 100]],
    buildings: [['adobe', 300, 0.8], ['adobe', 5000, 0.7]],
    npcs: [
      { id: 'kappa', name: '写真屋のカパ', actor: 'kappa', x: 1300, face: -1 },
      { id: 'tapa', name: '塩掘りのタパ', actor: 'mummy', x: 3500, face: -1 }
    ],
    places: [
      { id: 'salt', name: '足もとの塩', x: 2500, verb: '見る' },
      { id: 'hex', name: '塩の六角形', x: 4300, verb: '見る' }
    ],
    weather: { clear: 6, drizzle: 3, wind: 1 },
    talk: {
      kappa(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', '見てくれ、ゆうべ、降ったんだ！ 足もとまで、空が来てる！'], ['npc', 'normal', '旅の人、そこに立ってくれ。……空の上を歩いてるみたいだ。'], ['npc', 'normal', 'タパも来てる。掘れない日は、空を見に来るんだとさ。'], ['insight', '', '同じ場所でも、雨のあとに来れば、空が二つになる。']];
        if (f.kappaTold) return [['npc', 'normal', '空、見てくれ。雲ひとつない。……今日もだめだ。']];
        f.kappaTold = true;
        return [['me', '', '（かっぱが、頭の皿を空に向けて、じっと立っている）'], ['npc', 'normal', '……雨を待ってる。もう二十日、晴れっぱなし。宿代が、そろそろ底をつく。'], ['npc', 'normal', '雨のあと、この湖は空を映す鏡になる。足もとまで水が来ないと、写真にならない。'], ['npc', 'normal', 'それに、写す人がいない。こんなところ、だれも歩いてこないからね。'], ['npc', 'normal', 'かっぱが雨を待つのは、おかしいかい？ ……おかしくないだろう。']];
      },
      tapa(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', '降っちまった。三日は掘れない。'], ['npc', 'normal', '……まあいい。掘れない日は、空の上を歩く日だ。かっぱに写されてやるさ。']];
        if (f.tapaTold) return [['npc', 'normal', '雨よ、降るな。……かっぱのやつは、反対のことを祈ってるがね。']];
        f.tapaTold = true;
        return [['npc', 'normal', 'この顔かい？ 塩の照り返しで、目も肌もやられる。だから巻いてる。'], ['npc', 'normal', '雨が降ったら、塩が水に沈んで、三日は掘れない。そのぶん稼ぎがなくなる。'], ['npc', 'normal', 'あの写真屋は、毎朝「降れ」って空に頼んでる。おれは「降るな」って頼んでる。'], ['npc', 'normal', 'どっちの頼みを聞くかは、空の勝手だ。']];
      },
      salt(S) {
        if (S.back) return [['me', '', '（足もとの水に、空と雲が映っている。自分が、空に立っている）']];
        return [['me', '', '（白い地面が、どこまでも続く。歩くと、塩がさくさく鳴る）']];
      },
      hex(S) {
        if (S.back) return [['me', '', '（六角形の模様が、うすい水の下に沈んで見える）']];
        return [['me', '', '（地面に、六角形の模様が並んでいる。タパさんたちが掘ったあとが、少しずつ埋まっていく）']];
      }
    }
  });

  // ---------------------------------------------------------------- 14 言葉のない返事（黙った案内人の合図を読む）
  C.push({
    id: 'mine', name: 'ネパラ', sub: '雪の峰', time: 'noon', screens: 6, far: 'snow_peaks_noon',
    hill: '#3a4656', ground: ['#8a9a7a', '#5a5a4a', '#8a8070'], tint: 'rgba(160,190,230,.05)', bscale: 1.0,
    props: [['pine_snow', 500, 280], ['rune_stone', 2900, 120], ['rock_moss', 4000, 110], ['pine_snow', 5200, 300]],
    buildings: [['pk_mountain', 700, 0.95], ['pk_mountain', 3300, 0.8]],
    npcs: [
      { id: 'lhakpa', name: '茶屋のラクパ', actor: 'mei', x: 1200, face: -1 },
      { id: 'guide', name: '黙った案内人', actor: 'iwao', x: 2500, face: -1 },
      { id: 'dorje', name: 'ラクパの兄', actor: 'sasuke', x: 4300, face: -1 }
    ],
    weather: { clear: 4, wind: 2, fog: 2, snow: 2 },
    talk: {
      lhakpa(S) {
        const f = S.f;
        if (S.back) return [['npc', 'joy', 'ゆうべ、峠は吹雪だったの。兄さん、ここで甘いお茶を三杯も飲んでた。'], ['npc', 'joy', 'あなたが、石のことを教えてくれたんでしょう。']];
        if (f.dorjeWaits) return [['npc', 'joy', '兄さん、待つって？ ……よかった。お茶、もう一杯どうぞ。']];
        if (f.lhakpaTold) return [['npc', 'sorrow', '案内人さんは、何も言わないの。でも、何も見ていないわけじゃない。']];
        f.lhakpaTold = true;
        return [['npc', 'normal', '峠の風は冷たかったでしょう。甘いお茶をどうぞ。'], ['npc', 'sorrow', '兄さんが、今日のうちに峠を越えるって。荷を待ってる人がいるの。'], ['npc', 'sorrow', 'あの案内人さんに聞いてって言ったのに、あの人、口をきかないから。']];
      },
      guide(S) {
        const f = S.f;
        if (S.back) return [['me', '', '（案内人は、峠のほうを見て、石を一つだけ積んだ）'], ['me', '', '（今日は行ける、ということらしい）']];
        if (f.stonesSeen) return [['me', '', '（案内人は、三つの石に、そっと手を置いたまま動かない）']];
        f.stonesSeen = true;
        return [['me', '', '（案内人は何も言わず、峠の上を指さした。白い峰に、雲がかかりはじめている）'], ['me', '', '（それから、足もとに石を一つ、二つ、三つと積んだ）'], ['me', '', '（……どういう意味だろう）']];
      },
      dorje(S) {
        const f = S.f;
        if (S.back) return [['npc', 'fun', '峠の向こうの人に、一日遅れたって謝ったら、笑われたよ。'], ['npc', 'fun', '「吹雪の日に着いたら、謝るのはこっちのほうだった」ってさ。']];
        if (f.dorjeWaits) return [['npc', 'normal', '雲が晴れたら行く。荷は逃げない。']];
        if (f.stonesSeen) { f.dorjeWaits = true;
          return [['npc', 'normal', '案内人は、黙ってたろう？ 黙ってるのは、行けってことさ。'], ['me', '', '峠の雲を指さして、石を三つ積んでいました。'], ['npc', 'normal', '……三つ？'], ['npc', 'normal', 'この村じゃ、石三つは「待て」だ。子どものころ、親父に教わった。'], ['npc', 'normal', '……忘れてたよ。急いでると、知ってることまで見えなくなる。今日は、待つ。'], ['insight', '', '言葉がなくても、指さす先を見れば、わかることがある。']]; }
        return [['npc', 'normal', '今日のうちに峠を越える。向こうで、荷を待ってる人がいるんだ。'], ['npc', 'normal', '案内人？ 黙ってたなら、行けってことさ。']];
      }
    }
  });

  // ---------------------------------------------------------------- 15 人ちがい（名人だと思われた旅人）
  C.push({
    id: 'budou', name: 'イタリカ', sub: 'ぶどうの丘', time: 'morning', screens: 6, far: 'vineyard_morning',
    hill: '#3a4a30', ground: ['#7a9a4a', '#5a5a3a', '#9a8460'], tint: 'rgba(255,220,180,.04)', bscale: 1.0,
    props: [['tree_olive', 400, 280], ['bush_berry', 1700, 90], ['tree_olive', 3600, 300], ['stump', 4800, 70]],
    buildings: [['it_tuscan', 600], ['it_townhouse', 1300, 0.9], ['it_tuscan', 4100, 0.85]],
    npcs: [
      { id: 'host', name: '祭りの世話役', actor: 'tanurio', x: 1000, face: -1 },
      { id: 'lucia', name: 'ルチア', actor: 'akane', x: 2300, face: -1 },
      { id: 'master', name: '道ばたの老人', actor: 'elder', x: 5100, face: -1 }
    ],
    places: [{ id: 'vat', name: 'ぶどうの桶', x: 2900, verb: '踏む' }],
    weather: { clear: 6, drizzle: 2, wind: 1 },
    talk: {
      host(S) {
        const f = S.f;
        if (S.back) return [['npc', 'joy', '聞いたよ、人ちがいだったって！ はっはっは！'], ['npc', 'joy', 'でもな、去年の名人より、あんたのほうが楽しそうに踏んでたぞ。来年も来い。']];
        if (f.hostMet) return [['npc', 'joy', '桶はルチアの家の前だ。名人の足、楽しみにしてるよ！']];
        f.hostMet = true;
        return [['npc', 'joy', '来たか、名人！ 赤いマントの旅人が来ると、手紙にあった！'], ['me', '', 'え、ちがいます。ぼくは、ただの……'], ['npc', 'joy', '謙遜するな！ 今年のぶどう踏み祭り、あんたが一番手だ。'], ['npc', 'joy', '桶はルチアの家の前。さあ、さあ！']];
      },
      lucia(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', '本物の名人に教わったわ。……でも、あなたの踏み方のほうが、みんな笑ってた。']];
        if (f.stomped) return [['npc', 'normal', '名人の踏み方って、ずいぶん……自由なのね。来年、まねしてみる。']];
        if (f.luciaMet) return [['npc', 'normal', 'さあ、桶へ。名人の足、見せて。']];
        f.luciaMet = true;
        return [['npc', 'normal', 'あなたが名人？ 想像より、ずっと若いのね。'], ['npc', 'normal', '踏み方を教えて。ぶどうの皮だけつぶして、種はつぶさないのがこつなんでしょう？'], ['me', '', '（……知らない）']];
      },
      vat(S) {
        const f = S.f;
        if (!f.hostMet) return [['me', '', '（大きな木の桶に、ぶどうが山盛りになっている）']];
        if (f.stomped) return [['me', '', '（足の裏が、まだ少し紫色だ）']];
        f.stomped = true;
        return [['me', '', '（はだしで桶に入って、とにかく足ぶみしてみた）'], ['me', '', '（ぶどうが足の指のあいだで、ぷちぷちつぶれる。……くすぐったい）'], ['me', '', '（笑ったら、まわりの人たちも笑いだした。みんな桶に入ってきた）'], ['insight', '', '人ちがいでも、いっしょに踏んだぶどうは、本物の味がした。']];
      },
      master(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', 'しまった、寝過ごした！ わしがぶどう踏みの名人じゃ。'], ['npc', 'joy', '赤いマント？ わしは手紙に「赤い頭巾」と書いたんじゃが……'], ['npc', 'joy', 'まあよい。祭りは、だれが踏んでも祭りじゃ。']];
        return [['me', '', '（赤い頭巾の老人が、道ばたで気持ちよさそうに眠っている）']];
      }
    }
  });

  // ---------------------------------------------------------------- 16 立ち位置（返ってこないあいさつの正体）
  C.push({
    id: 'asahi', name: 'ケニアラ', sub: '朝日の草原', time: 'morning', screens: 6, far: 'savanna_morning',
    hill: '#4a3a24', ground: ['#a09a5a', '#6a5a3a', '#a88a60'], tint: 'rgba(255,200,140,.05)', bscale: 1.0,
    props: [['bush', 700, 80], ['tree_dead', 2100, 240], ['rock', 3300, 90], ['bush', 4700, 80]],
    buildings: [['thatched_farm', 300, 0.8], ['adobe', 4900, 0.8]],
    npcs: [
      { id: 'west', name: '西の村のムワンギ', actor: 'craftsman', x: 1000, face: 1 },
      { id: 'east', name: '東の村のオティエノ', actor: 'kogane', x: 4400, face: -1 }
    ],
    places: [{ id: 'sun', name: '東の空', x: 2700, verb: '見る' }],
    weather: { clear: 7, wind: 2, drizzle: 1 },
    talk: {
      west(S) {
        const f = S.f;
        if (S.back) return f.eastKnows
          ? [['npc', 'normal', '夕方、オティエノのやつが手を振ってた！ ちゃんと見えたぞ！'], ['npc', 'normal', '十年、すれちがってたんだな。朝日のせいで。']]
          : [['npc', 'normal', '今朝も、返事はなかった。']];
        if (f.westTold) return [['npc', 'normal', '毎朝、日の出に向かって手を振る。返事はない。']];
        f.westTold = true;
        return [['npc', 'normal', '旅の人、東の村へ行くのかい。オティエノに会ったら、言ってやってくれ。'], ['npc', 'normal', 'おれは十年、毎朝、日の出のころに手を振ってる。あいつは一度も返さない。'], ['npc', 'normal', '昔は仲がよかったんだがな。']];
      },
      sun(S) {
        const f = S.f;
        if (f.sunSeen) return [['me', '', '（東は、朝日でまぶしい。西を振り返ると、草原がよく見える）']];
        f.sunSeen = true;
        return [['me', '', '（東を見ると、朝日がまぶしくて、何も見えない）'], ['me', '', '（ふり返って西を見ると、ムワンギさんの小さな姿が、日に照らされてよく見える）'], ['me', '', '（……東から西は見える。でも、西から東は、見えないんだ）']];
      },
      east(S) {
        const f = S.f;
        if (S.back) return f.eastKnows ? [['npc', 'normal', '夕方に振った。こんどはこっちがまぶしかったが、跳びはねてる影は見えた。'], ['npc', 'normal', '……十年分、跳んでたな。']] : [['npc', 'normal', 'ムワンギは、今朝も手を振ってた。']];
        if (f.eastKnows) return [['npc', 'normal', '今日の夕方、振ってみる。日が西に沈むころなら、こっちが照らされる。']];
        if (f.sunSeen) { f.eastKnows = true;
          return [['me', '', 'ムワンギさんが、毎朝あいさつしても返事がないって。'], ['npc', 'normal', 'ムワンギが、怒ってる？ おれは毎朝、手を振り返してるぞ。'], ['me', '', '西からだと、朝日がまぶしくて、こっちが見えないんです。'], ['npc', 'normal', '……朝日の中にいたのは、おれのほうだったのか。'], ['npc', 'normal', 'あいつがなんで怒ってるのか、ずっとわからなかった。'], ['insight', '', 'あいさつが返ってこないのは、まぶしくて見えないだけのこともある。']]; }
        return [['npc', 'normal', 'ムワンギに会ったか？ あいつ、毎朝手を振ってくる。'], ['npc', 'normal', 'おれも振り返してるのに、最近は怒ってるみたいでな。わけがわからん。']];
      }
    }
  });

  window.SEE_WORLD = { countries: C };
})();
