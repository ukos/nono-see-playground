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
//   props           : 木や岩などの小物 [画像名, x, 高さpx, 条件(f, back)?]（assets/props/）。建物より奥に描く。条件つきは真のときだけ描く
//   buildings       : [画像名, 国の左端からのx, 倍率(省略可)]
//   npcs            : { id, name, actor, x, face(1=右向き,-1=左向き), h(背の高さ), follow(f)(真のあいだ nono のうしろを歩く) }
//                     1枚絵の住人は sprite（assets/actors/<sprite>.webp。f を受け取る関数でも可）、name も関数にできる。
//                     全身ドット絵の住人は sheet（シート定義。画像は assets/actors/<actor>_sheet.webp）と pose(f)、
//                     when(f)（いるときだけ）、leaveWhen(f)（その後は歩き去る）を持てる
//   places          : 見る・聞くだけの場所 { id, name, x, verb('見る'/'聞く'), when(f) }。会話は talk[id]
//   animals         : 動物 [種類, x, {mode('walk'/'stay'/'fly'), range, face, when(f), back('only'/'not'), h, shy, follow(f, back), moveTo:[条件, x]}]
//                     種類と大きさ・ふるまいは game.js の ANIM。絵は assets/animals/<種類>_<コマ>.webp
//   map             : 世界地図に印をつける位置 [緯度, 経度]（もじった実在の国のあたり）
//   sea             : true なら船旅の国（地図の道のりを点線の航路で描く）
//   farBack/timeBack/weatherBack : 帰り道だけの遠景・時間帯・天候（嵐の夜の船が、帰りは朝の凪になる等）
//   when(f, back)   : 住人・場所の when には帰り道かどうかも渡る
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
    map: [46, 2], // 世界地図の位置（緯度, 経度）
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
    animals: [['rooster', 1500], ['hen', 1640], ['hen', 1760], ['cat_orange', 3000], ['dog_brown', 5200]],
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

  // ---------------------------------------------------------------- 2 下手な手伝い（旅人の曲がった一列が、だれかの帰る口実になる）
  C.push({
    id: 'take', name: 'ジャポネ', sub: '棚田の里', time: 'morning', screens: 5, far: 'rice_terraces_morning',
    map: [36, 138], // 世界地図の位置（緯度, 経度）
    hill: '#1f2a22', ground: ['#5f8a4a', '#3a5034', '#7a6a50'], tint: 'rgba(40,60,40,.04)', bscale: 1.05,
    props: [['torii', 200, 250], ['stone_lantern', 1300, 170], ['pine', 2150, 300], ['stone_lantern', 3150, 170], ['jp_castle', 4300, 430]],
    buildings: [['machiya', 450], ['teahouse', 1150], ['nagaya', 3000], ['samurai_mansion', 3700, 0.95]],
    npcs: [
      { id: 'hana', name: 'ハナ（苗運び）', actor: 'okappa', x: 650, face: -1 },
      { id: 'tome', name: 'トメばあ（田の持ち主）', actor: 'fisher_granny', x: 1700, face: -1 },
      // ケンタは峠の手前に座っている。話を聞いたあと、西へ歩いて帰っていく
      { id: 'kenta', name: '峠の若い衆', actor: 'apprentice', x: 4350, face: -1,
        leaveWhen: f => f.kentaHeard && f.planted, leaveDir: -1 },
      { id: 'kenta2', name: 'ケンタ', actor: 'apprentice', x: 2550, face: -1, when: f => f.kentaGone }
    ],
    places: [{ id: 'rice', name: '水を張った田', x: 2300, verb: '植える' }],
    weather: { clear: 3, drizzle: 5, fog: 1, wind: 1 },
    animals: [['dog_shiba', 1400], ['crow', 3200], ['cat_calico', 3900]],
    talk: {
      hana(S) {
        const f = S.f;
        if (S.back && f.kentaGone) return [['npc', 'normal', 'けんちゃん、帰ってきたの！ 朝から、ばあちゃんと口をきかずに田に入ってる。'], ['npc', 'normal', '……でも、お昼のおにぎりは、二つ食べてた。']];
        if (S.back && f.planted) return [['npc', 'normal', '雨の前に、なんとか植え終わったよ。一列だけ、旅の人の列。']];
        if (S.back) return [['npc', 'normal', '雨の前に、なんとか植え終わったよ。一列だけ、ばあちゃんが二度植えた。']];
        if (f.kentaGone) return [['npc', 'normal', 'けんちゃんだ！ 峠から走ってきた。……ばあちゃん、見ないふりしてる。']];
        if (f.planted) return [['npc', 'normal', 'ありがとう！ ……ちょっと曲がってるけど、ばあちゃんには内緒ね。']];
        if (f.hanaAsk) return [['npc', 'normal', '田んぼは、お茶屋さんの先。ばあちゃんは「いらん」って言うけど、いるの。']];
        f.hanaAsk = true;
        return [['npc', 'normal', '旅の人、足を泥に入れても平気？'], ['me', '', '……泥？'], ['npc', 'normal', 'きょうは田植え。雨が来る前に、横一列で植えきらないといけないの。'], ['npc', 'normal', 'いつもは五人。けんちゃんが町へ出ていって、一人足りない。'], ['npc', 'normal', '一人欠けると、そこだけ苗の列が抜けちゃうんだ。']];
      },
      tome(S) {
        const f = S.f;
        if (S.back && f.kentaGone) return [['npc', 'normal', '曲がった苗を見て、あの子、黙って田に入ってきおった。'], ['npc', 'normal', 'わしが頼んでも、来んかったくせにな。'], ['npc', 'normal', '……一本だけ、あんたの苗を残させた。抜くのは、もったいない。'], ['insight', '', 'わたしの曲がった一列が、ケンタの帰る口実になった。']];
        if (S.back && f.planted) return [['npc', 'normal', '植わったよ。……あの列だけ、風が吹くと、ほかと違うふうに揺れる。']];
        if (S.back) return [['npc', 'normal', '植わったよ。一列は、わしが二度植えた。……腰が、まだ文句を言うとる。']];
        if (f.kentaGone) return [['npc', 'normal', '……あの子が、田に入っとる。わしは、見とらん。見とらんぞ。']];
        if (f.planted) return [['npc', 'normal', '……曲がっとる。三十年見てきて、いちばん曲がっとる。'], ['npc', 'normal', 'まあ、いい。苗は、曲がったところからでも育つ。']];
        if (f.tomeTold) return [['npc', 'normal', '雨雲が、山の肩まで来とる。']];
        f.tomeTold = true;
        return [['npc', 'normal', '人手なら足りとる。ハナが何と言ったか知らんが。'], ['npc', 'normal', '孫は町へ出た。田んぼは古くさいんだと。……帰って来んでええ。'], ['npc', 'normal', '一列ぐらい、わしが二度植えれば済む。腰が、もう少しもてばの話だが。']];
      },
      rice(S) {
        const f = S.f;
        if (S.back && f.kentaGone) return [['me', '', '（苗の列が、まっすぐに植え直されている）'], ['me', '', '（その中に一本だけ、少し斜めの苗が残っている）']];
        if (S.back && f.planted) return [['me', '', '（一列だけ、苗がよろよろと斜めに並んでいる。わたしの列だ）']];
        if (S.back) return [['me', '', '（苗がそろって並んでいる。一列だけ、苗の間が少し広い）']];
        if (f.planted) return [['me', '', '（足を抜くと、泥がずぶりと鳴った）']];
        if (!f.hanaAsk) return [['me', '', '（水を張った田に、空が映っている。苗の束が、畦に置いてある）']];
        f.planted = true;
        return [['me', '', '（裸足で田に入る。泥が、思ったより冷たい）'], ['me', '', '（畦からハナが叫ぶ。「苗を三本、指で押しこんで、うしろへ下がって！」）'], ['me', '', '（下がるたびに、列が少しずつ右へずれていく）'], ['me', '', '（「あはは、旅の人の列、峠のほうへ歩いていっちゃう！」）']];
      },
      kenta(S) {
        const f = S.f;
        if (f.kentaHeard) return [['npc', 'normal', '……行くよ。行けばいいんだろ。']];
        if (!f.planted) return [['npc', 'normal', '旅の人、下の村から来たのか。……田植え、もう済んだか？'], ['npc', 'normal', 'いや、聞いてみただけだ。おれには、もう関係ない。']];
        f.kentaHeard = true;
        return [['npc', 'normal', '旅の人、下の村から来たのか。……田植え、もう済んだか？'], ['me', '', '一列だけ、植えました。トメさんの田んぼで。'], ['npc', 'normal', 'あんたが？ ばあちゃんの田に？ ……曲がってただろ。'], ['me', '', '……列が、峠のほうへ歩いていきました。'], ['npc', 'normal', 'ばあちゃんは、曲がった列がいちばん嫌いなんだ。あれを毎朝見るのかよ。'], ['npc', 'normal', '……荷物、置いていく。ちょっと、直してくるだけだ。']];
      },
      kenta2(S) {
        if (S.back) return [['npc', 'normal', '怒鳴られると思ったら、茶が出てきた。……あの人、ずるいよ。'], ['npc', 'normal', 'あんたの苗、一本だけ残した。ばあちゃんがそうしろって。']];
        return [['npc', 'normal', 'まだ話しかけるな。……この列を直すのが先だ。']];
      }
    }
  });

  
// ---------------------------------------------------------------- 3 二重の秘密（うそをついている人と、気づかないふりの人）
  C.push({
    id: 'koutou', name: 'キャセイ', sub: '紅灯の都', time: 'night', screens: 6, far: 'mystic_night',
    map: [30, 110], // 世界地図の位置（緯度, 経度）
    hill: '#2a1e26', ground: ['#6a7a4a', '#4a3e34', '#8a7258'], tint: 'rgba(40,20,80,.10)', bscale: 1.3,
    props: [['tree_old_roots', 700, 260], ['pine', 2900, 280], ['stone_lantern', 4000, 150]],
    buildings: [['cn_paifang', 300], ['cn_house', 1000], ['cn_teahouse', 1650], ['cn_nagaya', 2450, 1.1], ['cn_mansion', 3550, 1.15], ['cn_tower', 4650, 1.2]],
    npcs: [
      { id: 'okami', name: '茶館の女将', actor: 'kimono_woman', x: 1100, face: -1 },
      { id: 'yui_koutou', name: YUI('赤い服の娘'), sprite: 'yui_red', x: 2600, face: -1 },
      { id: 'teishu', name: '魚屋の亭主', actor: 'lanternman', x: 3700, face: -1 }
    ],
    places: [{ id: 'steps', name: '川べりの石段', x: 2100, verb: '見る' }],
    weather: { clear: 5, drizzle: 2, fog: 2, squall: 1 },
    animals: [['cat_black', 1800], ['dog_pug', 4500, { range: 180 }]],
    talk: {
      steps(S) {
        const f = S.f;
        if (S.back && f.koutouDone) return [['me', '', '（石段に、女将さんと亭主が並んで座っている。二人とも、川ばかり見ている）'], ['me', '', '（あいだに、魚が一匹のった皿が置いてある）']];
        if (f.okamiTold) return [['me', '', '（川へ下りる石段。三年前、ここに財布が落ちていたのだろうか）'], ['me', '', '（紅い灯りが、水の上でゆれている。拾った人は、どんな顔をしたんだろう）']];
        return [['me', '', '（川へ下りる石段。紅い灯りが、水の上でゆれている）']];
      },
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
        if (f.yuiCat) return [['npc', '', '猫に負けたなんて、だれにも言わないでね。剣士の名がすたる。']];
        f.yuiCat = true;
        return [['npc', '', '……旅の人？ わたしは、ただの旅の剣士。'], ['npc', '', '揚げ菓子を三つ買ったの。三つとも、あの黒猫に取られた。'], ['npc', '', '東の白壁の港に、苦手な国の使者が来るの。会いたくなくて、ゆっくり歩いてるところ。']];
      },
      teishu(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', '今夜は、女房の好きな魚を一匹よけいに取っといた。'], ['npc', 'normal', '……知らんふりってのも、たまには礼を言いたくなるもんだ。']];
        if (f.koutouDone) return [['npc', 'normal', '女房には内緒だぞ。あいつのうそは、あいつのもんだ。']];
        if (f.okamiTold) { f.koutouDone = true;
          return [['npc', 'normal', 'おう、旅の人。女将の茶館から来たのかい。'], ['npc', 'normal', '……財布の話、聞いたんだろう。顔に書いてある。'], ['npc', 'normal', '知ってるよ。三年前から。あいつは、うそが下手でね。'], ['npc', 'normal', 'でも、あいつが守ってくれたうそだ。だから、知らないふりを守ってる。'], ['insight', '', '財布のうそは、三年かけて、二人ぶんの約束になっていた。']]; }
        return [['npc', 'normal', 'おう、旅の人。魚はいらんか。今夜のは、いい目をしてる。'], ['npc', 'normal', '酒？ やめたよ。三年前にな。……いい夢を見たんだ。']];
      }
    }
  });

  // ---------------------------------------------------------------- 4 歩くことが話になる（旅人が知らずに羊を連れて帰る）
  C.push({
    id: 'kaze', name: 'モンゴーラ', sub: '風の草原', screens: 6, far: 'highland',
    map: [47, 104], // 世界地図の位置（緯度, 経度）
    hill: '#243024', ground: ['#7aa05a', '#4a6a3a', '#8a7a5a'], tint: 'rgba(60,80,40,.06)', bscale: 1.0,
    props: [['rock', 600, 90], ['bush', 2000, 80], ['watchtower', 3100, 300], ['rock2', 5200, 100]],
    buildings: [['yurt_smoke', 700], ['sheep_pen', 1300, 1.1], ['yurt', 2400], ['stable', 3500, 1.15], ['yurt', 4700, 0.9]],
    npcs: [
      { id: 'mei', name: 'アイラ（羊飼い）', actor: 'braidgirl', x: 1900, face: -1 },
      { id: 'hayate', name: 'バトゥ（馬飼い）', actor: 'hunter', x: 4200, face: -1 }
    ],
    places: [{ id: 'tower', name: '見張り台', x: 3100, verb: '登る' }, { id: 'bell', name: '草むらの鈴の音', x: 5300, verb: '聞く' }],
    weather: { clear: 3, wind: 5, typhoon: 1, drizzle: 1 },
    animals: [['sheep', 1700, { range: 220 }], ['sheep', 1820, { range: 220 }], ['sheep', 2150, { range: 160 }],
      // はぐれた子羊：行きは近づくと逃げ、帰りは nono のうしろをついてくる
      ['sheep', 5300, { h: 36, shy: true, follow: (f, back) => back && f.bellHeard && !f.lambHome, moveTo: [f => f.lambHome, 1350] }],
      ['horse_bay', 4330, { mode: 'stay', face: -1 }], ['hawk', 3000, { mode: 'fly' }]],
    talk: {
      tower(S) {
        const f = S.f;
        if (S.back) return [['me', '', '（見張り台から見下ろすと、柵の中の羊が、ちょうど数えられるくらいにかたまっている）']];
        if (f.bellHeard) return [['me', '', '（西の空が、もう灰色だ。風が、台の柱をきしませる）']];
        return [['me', '', '（はしごを登ると、草原が見わたせる。風で、草が波のようにうねっている）'], ['me', '', '（東の岩のあたりに、白い点が一つ。……動いた）'], ['me', '', '（西の地平に、黒い雲の帯が見える。嵐は、夜より早いかもしれない）']];
      },
      mei(S) {
        const f = S.f;
        if (S.back && f.bellHeard && !f.lambHome) { f.lambHome = true;
          return [['npc', 'normal', 'あっ……帰ってきた！ あの子が、あなたのうしろから。'], ['npc', 'normal', 'あの子、知らない人の歩くほうへ、ついてくる癖があるの。'], ['npc', 'normal', 'だから、聞いたの。帰りもここを通るかって。……言ったら、追いかけちゃうでしょう。'], ['insight', '', 'ただ歩いていただけで、だれかの帰り道になっていた。']]; }
        if (f.lambHome) return [['npc', 'normal', '今夜は、柵の中で数えたら、ちゃんと全部いる。']];
        if (f.meiTold) return [['npc', 'normal', '日が暮れる前に、帰ってくればいいんだけど。']];
        f.meiTold = true;
        return [['npc', 'normal', '旅の人、東へ行くの？ ……帰りも、ここを通る？'], ['me', '', '……たぶん。'], ['npc', 'normal', 'そう。……ううん、なんでもない。'], ['npc', 'normal', '子羊が一頭、群れからはぐれたの。春に生まれた、首に鈴の子。'], ['npc', 'normal', '夜になると、この風は嵐になる。あの子は小さいから、一晩もたない。'], ['npc', 'normal', '追いかけると逃げるの。……わたしが行くと、よけいに逃げる。']];
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

  // ---------------------------------------------------------------- 5 話が市場を一周する（旅人の話が、知らない話になって戻ってくる）
  C.push({
    id: 'iro', name: 'インダスタン', sub: '色の都', screens: 6, far: 'twilight',
    map: [25, 78], // 世界地図の位置（緯度, 経度）
    hill: '#2e2018', ground: ['#8a8a4a', '#6a4a30', '#a08060'], tint: 'rgba(140,80,30,.08)', bscale: 1.0,
    props: [['palm', 300, 300], ['palm', 2250, 320], ['bush_berry', 4200, 90]],
    buildings: [['in_market', 500], ['in_haveli', 1150], ['in_blue', 1900], ['pk_lahore', 2650], ['pk_mosque', 3400], ['pk_mountain', 4550]],
    npcs: [
      { id: 'kogane', name: 'ビクラム（買い物客）', actor: 'turban', x: 700, face: -1 },
      { id: 'tanurio', name: 'ラジュ（香辛料売り）', actor: 'mustache', x: 1700, face: -1 },
      { id: 'hari', name: 'ハリじいさん（ラジュの父）', actor: 'in_elder', x: 1200, face: 1 },
      { id: 'rei_iro', name: REI('白いシャツの娘'), sprite: 'rei_shirt', x: 3600, face: -1 }
    ],
    weather: { clear: 5, squall: 2, wind: 1 },
    animals: [['cow', 2700, { mode: 'stay' }], ['crow', 4300], ['donkey', 5000, { mode: 'stay', face: -1 }]],
    talk: {
      kogane(S) {
        const f = S.f;
        if (S.back && f.spice) {
          const tale = f.storyBridge
            ? [['npc', 'normal', '西の国じゃ、橋が落ちても、旅人は縄一本で谷を渡るんだと！'], ['npc', 'normal', '赤いマントで、風にあおられながらな。']]
            : [['npc', 'normal', '北の草原じゃ、旅人が羊を百頭、鈴の音だけで連れ帰ったんだと！'], ['npc', 'normal', '一頭も追わずに、口笛ひとつでな。']];
          return [['npc', 'normal', 'おい、聞いたか。いま市場じゅう、この話でもちきりだ。'], ...tale, ['me', '', '（……それ、わたしの話だ。ずいぶん、育っている）'], ['insight', '', 'わたしの話は、市場を一周して、知らない話になって戻ってきた。']];
        }
        if (f.koganeTold) return [['npc', 'normal', 'ラジュに話を売るなら、短くて、遠い話がいい。']];
        f.koganeTold = true;
        return [['npc', 'normal', 'あの香辛料屋、きょうは店を閉めかけてる。品切れじゃない、話切れだ。'], ['npc', 'normal', 'あそこは、金じゃなく遠くの話で払える店でな。'], ['npc', 'normal', 'このスコールつづきで、旅人が来ない。話が、ひとつも入ってこないのさ。']];
      },
      tanurio(S) {
        const f = S.f;
        if (S.back && f.spice) return [['npc', 'normal', 'あんたの話、親父がもう三十回は話してる。毎回、少しずつ長くなる。']];
        if (S.back) return [['npc', 'normal', '旅の人、帰りかい。……話、ひとつ残ってないかい。親父がまた同じ話をしてる。']];
        if (f.spice) return [['npc', 'normal', '親父のところへ、ちょっと寄ってみな。もう、あんたの話をしてるはずだ。']];
        f.spice = true;
        f.storyBridge = !!f.seen;
        const story = f.seen
          ? [['me', '', '西の村で、「橋が落ちた」と聞いて、見に行ったんです。'], ['me', '', '落ちていたのは、手すりの縄一本でした。']]
          : [['me', '', '草原で、鈴をつけた子羊がはぐれていました。'], ['me', '', '追うと逃げるので、追わずに歩きました。']];
        return [['npc', 'normal', '旅の人！ 金はいらない。遠くの話を、ひとつだけ売ってくれ。'], ['npc', 'normal', '西の家の前に、親父が座ってる。昔は隊商で、国じゅうを歩いた人だ。'], ['npc', 'normal', '足が弱ってからは、毎晩、遠くの話を聞いて眠る。……ここ十日、同じ昔話ばかりでね。'], ['npc', 'normal', 'ゆうべは「もう遠くに何もないのか」と言って、夕飯に手をつけなかった。'], ...story, ['npc', 'normal', 'それだ。小さくて、ほんとうの話。親父の好物だよ。'], ['npc', 'normal', 'お代の香辛料、一袋。……いや、二袋だ。']];
      },
      hari(S) {
        const f = S.f;
        if (S.back && !f.spice) return [['npc', 'normal', '旅の人か。……昔、わしが隊商で砂漠を越えた話を、してやろうか。'], ['npc', 'normal', '……もう、十一日目だがな。']];
        if (S.back) return [['npc', 'normal', '若いの、また来たか。きょうも話してやろう。'], ['npc', 'normal', '……どの話だったかな。そうそう、縄一本の橋だ。いや、鈴の羊だったか。']];
        if (f.spice) {
          return f.storyBridge
            ? [['npc', 'normal', 'おお、聞いたぞ。西の村の橋の話。'], ['npc', 'normal', '昔、わしも、落ちた橋の縄一本で谷を渡ったことがある。……ような気がしてきた。'], ['me', '', '（さっき話したばかりなのに、もう、ハリじいさんの話になっている）']]
            : [['npc', 'normal', 'おお、聞いたぞ。鈴の子羊の話。'], ['npc', 'normal', '昔、わしも、羊を追わずに連れ帰ったことがある。……ような気がしてきた。'], ['me', '', '（さっき話したばかりなのに、もう、ハリじいさんの話になっている）']];
        }
        return [['npc', 'normal', '……旅の人か。東の店の息子に、何か売ってやってくれ。'], ['npc', 'normal', 'この十日、わしは同じ話ばかりしとる。息子は笑って聞くが、わしは飽きた。']];
      },
      rei_iro(S) {
        const f = S.f;
        if (S.back && f.spice) return [['npc', '', '市場で、ずいぶん勇ましい旅人の話を聞いた。'], ['npc', '', '……あなた、そんなに勇ましかった？ 話は、量るたびに重くなるのね。']];
        if (f.reiKnown) return [['npc', '', 'ここの市場では、情報も量り売り。……あの男の行き先も、ここで買えた。']];
        return [['npc', '', 'この市場では、情報も香辛料と同じ。量って売る。'], ['npc', '', '話は、軽いほど遠くまで運ばれるの。……覚えておいて。']];
      }
    }
  });

  
// ---------------------------------------------------------------- 6 水の行方を調べる（足あとで真相を見る）
  C.push({
    id: 'suna', name: 'サハリア', sub: '砂の国', time: 'night', screens: 5, far: 'oasis_night', fore: false,
    map: [24, 10], // 世界地図の位置（緯度, 経度）
    hill: '#3a2a20', ground: ['#c8a46a', '#a07a4a', '#b89064'], tint: 'rgba(30,30,90,.06)', bscale: 1.0,
    props: [['cactus', 300, 140], ['palm', 900, 300], ['pyramid', 1780, 300], ['desert_temple', 4200, 320]],
    buildings: [['adobe', 500], ['mideast_white', 1300], ['adobe', 2700, 0.9], ['mideast_white', 3600, 0.95]],
    npcs: [
      { id: 'first', name: 'ファースト（WATCH）', actor: 'first', x: 800, face: 1, sheet: FIRST, pose: f => f.firstMet ? 'idle' : 'crouch' },
      { id: 'iwao', name: 'ハミド（水売り）', actor: 'veiled', x: 1900, face: -1 },
      { id: 'wizard', name: '旅の魔法使い', actor: 'wizard', x: 2900, face: -1 }
    ],
    places: [{ id: 'well', name: '古い井戸', x: 4000, verb: '見る' }],
    weather: { clear: 6, wind: 3, fog: 1 },
    animals: [['camel', 3400, { face: -1 }], ['camel', 3650]],
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
    map: [38, 23], // 世界地図の位置（緯度, 経度）
    hill: '#22303a', ground: ['#8aa06a', '#7a6a5a', '#c8b8a0'], tint: 'rgba(255,250,230,.0)', bscale: 1.1,
    props: [['tree_olive', 2600, 300], ['lighthouse', 5250, 420], ['boat_wreck', 5500, 200]],
    buildings: [['gr_chapel', 350], ['es_white', 900], ['it_townhouse', 1550], ['med_white', 2100, 0.9], ['es_gate', 2900], ['it_tuscan', 3500], ['gr_temple', 4400]],
    npcs: [
      { id: 'yui', name: YUI('剣を帯びた娘'), sprite: f => f.yuiKnown ? 'yui_queen' : 'yui_uniform', x: 1300, face: -1 },
      { id: 'mermaid', name: '人魚', actor: 'mermaid', x: 3000, face: -1, special: 'legend' },
      { id: 'envoy', name: '海の向こうの使者', actor: 'knight', x: 4700, face: -1, when: f => !f.envoyMoved },
      { id: 'envoy2', name: '海の向こうの使者', actor: 'knight', x: 1650, face: -1, when: f => f.envoyMoved }
    ],
    weather: { clear: 6, wind: 2, typhoon: 1, squall: 1 },
    animals: [['cat_white', 2200], ['cat_calico', 3700]],
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

  // ---------------------------------------------------------------- 船旅 灯台の数え方（グレシアで覚えた「七つ」が、夜の海の道しるべになる）
  C.push({
    id: 'kamome', name: 'カモメ号', sub: '船の上・霧の島へ', time: 'night', screens: 5, far: 'sea_night', fore: false,
    ship: true, sea: true,
    map: [40, -13], // 地図の位置（グレシアから霧の島への航路のなかほど）
    hill: '#1a2440', ground: ['#8a6a48', '#5a4330', '#9a7a58'], tint: 'rgba(40,60,120,.06)', bscale: 1.0,
    props: [['ship_barrels', 500, 110], ['ship_rope', 1250, 50], ['ship_lifebuoy', 1500, 70], ['ship_cabin', 1650, 190], ['ship_mast', 2450, 420], ['ship_crates', 3300, 100],
      ['ship_anchor', 3550, 80], ['ship_mast', 4050, 440], ['ship_bell', 4300, 120], ['ship_lantern', 4620, 150]],
    buildings: [],
    npcs: [
      { id: 'holm', name: 'ホルム船長', actor: 'old_fisher', x: 800, face: -1 },
      { id: 'ben', name: 'コックのベン', actor: 'sailor', x: 2050, face: -1 },
      { id: 'yui_ship', name: YUI('マントの娘'), sprite: 'yui_cape', x: 2900, face: -1 },
      { id: 'mina', name: '見張りのミナ', actor: 'sailorgirl', x: 3800, face: -1 }
    ],
    places: [{ id: 'bow', name: 'へさき', x: 4500, verb: '見る' }],
    weather: { clear: 6, wind: 3, fog: 1 },
    animals: [['cat_black', 1100, { range: 300 }]],
    talk: {
      holm(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', 'ミナは今夜も夜番だ。コーヒーなしで起きていられる、と言いはっとる。'], ['npc', 'normal', '……起きていられるかどうかは、明日の朝わかる。']];
        if (f.bellRung) return [['npc', 'normal', '鐘が一度。……いい鐘だった。'], ['npc', 'normal', '目はつぶっとったが、眠ってはおらん。七つ、わしも舵の横で数えとった。'], ['npc', 'normal', 'あの子が北で鳴らしかけたら、止めるつもりだった。……止めずにすんだ。'], ['npc', 'normal', '北の灯りへ向かっていたら、いまごろ岩場だ。舵は、東へ切った。'], ['insight', '', '眠るために七つ数える灯りが、ここでは夜の海の道しるべになった。']];
        if (f.holmTold) return [['npc', 'normal', '鐘は一度だけ。鳴らしすぎると、船じゅうが起きて文句を言う。']];
        f.holmTold = true;
        return [['npc', 'normal', '旅の人、夜の海でいちばん怖いものは何だと思う？'], ['me', '', '……暗さ、ですか。'], ['npc', 'normal', '眠気だ。見張りが眠れば、船は岩にぶつかる。'], ['npc', 'normal', '今夜は、ミナの初めての夜番だ。霧の島の灯台が見えたら、鐘を一度だけ鳴らす。'], ['npc', 'normal', 'わしは舵の横で、少し目をつぶる。……あの子を信じることにした。']];
      },
      ben(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', 'ミナのコーヒー、砂糖を三つから二つに減らした。大人になったもんだ。']];
        if (f.coffee) return [['npc', 'normal', '冷めないうちに、へさきのほうへ。']];
        f.coffee = true;
        return [['npc', 'normal', '船長から聞いたかい、見張りの子のこと。'], ['npc', 'normal', 'これを持っていってくれ。苦いコーヒーに、砂糖三つ。あの子は苦いのが飲めん。'], ['me', '', '（湯気の立つカップを受け取った。船が揺れるたび、こぼれそうになる）']];
      },
      yui_ship(S) {
        const f = S.f;
        if (S.back) return [['npc', '', '夜会は終わったわ。剣より、ダンスのほうがずっと疲れた。'], ['npc', '', '……帰りの船は、もう揺れても平気。たぶん。']];
        if (f.minaAsk && !f.yuiCount) { f.yuiCount = true;
          return [['me', '', '霧の島の灯台は、何回光るか知っていますか？'], ['npc', '', '知ってる。七つ光って、少し休むの。'], ['npc', '', '白壁の港の灯台と、同じ数え方。……眠れない夜に、数えたばかりだから。']]; }
        if (f.yuiCount) return [['npc', '', '七つよ。七つで、ちゃんと眠れる灯台。']];
        return f.yuiKnown
          ? [['npc', '', 'nono！ 霧の島の夜会へ行くの。……船って、もっと揺れないものだと思ってた。'], ['npc', '', '使者どのは別の船。同じ灯台を目指してるけど。']]
          : [['npc', '', '……話しかけないで。いま、揺れと戦ってるの。剣では勝てない相手と。']];
      },
      mina(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', 'きのうの夜番、船長にほめられた！ ……昼間は、ちょっと眠いけど。']];
        if (f.bellRung) return [['npc', 'normal', '鐘、一回だけ鳴らせた。……手が、まだ震えてる。']];
        if (f.lightSeen && f.yuiCount) { f.bellRung = true;
          return [['me', '', '霧の島の灯台は、七つだそうです。'], ['npc', 'normal', '北は岩場の三つ。東は霧の島の七つ。……二つとも分かった。東だ！'], ['me', '', '（カーン、と鐘が一度だけ、夜の海に響いた）'], ['npc', 'normal', '……鳴らせた。一回だけ。ちゃんと、一回だけ。']]; }
        if (f.lightSeen && !f.minaNorth) { f.minaNorth = true;
          return [['me', '', '北の灯りは三つ、東の灯りは七つ光って休みます。'], ['npc', 'normal', '三つ……北が三つ！ それは覚えてる。三つは「岩場に近づくな」の灯台だ。'], ['npc', 'normal', '北じゃない。でも、東が霧の島かどうかは……まちがえて鳴らしたら、と思うと。']]; }
        if (f.lightSeen && !f.yuiCount) return [['npc', 'normal', '北は岩場。東は……だれか、霧の島の灯台を知ってる人がいたら。']];
        if (f.minaAsk) {
          const out = [['npc', 'normal', '……寝てない。寝てないです。']];
          if (f.coffee && !f.coffeeGiven) { f.coffeeGiven = true; out.push(['npc', 'normal', 'コーヒー！ 砂糖、三つ入ってる？ ……ベンさん、覚えてた。']); }
          return out;
        }
        f.minaAsk = true; if (f.coffee) f.coffeeGiven = true;
        return [['npc', 'normal', '見張りのミナです。……起きてます！ 起きてます。'], ...(f.coffee ? [['npc', 'normal', 'それ、コーヒー？ 砂糖三つ？ ……ありがとう、ベンさん。']] : []), ['npc', 'normal', '灯台は、光る回数で見分けるの。霧の島の灯台は……ええと、何回だっけ。'], ['npc', 'normal', '船長に聞きなおすの、恥ずかしくて。初めての夜番なのに。']];
      },
      bow(S) {
        const f = S.f;
        if (S.back) return [['me', '', '（へさきの向こうに、来た道の海が、暗く続いている）']];
        if (f.bellRung) return [['me', '', '（船は東の灯りへ向かっている。七つ光って、少し休む）']];
        if (!f.minaAsk) return [['me', '', '（暗い海の向こうに、小さな灯りがまたたいている）']];
        f.lightSeen = true;
        return [['me', '', '（遠くに、灯りが二つ見える。北の灯りと、東の灯り）'], ['me', '', '（北の灯りは三つ光って休む。東の灯りは……一、二、三……七つ光って、休む）']];
      }
    }
  });

  
// ---------------------------------------------------------------- 8 霧（追っている者が、追われていた）
  C.push({
    id: 'kiri', name: 'ブリテニア', sub: '霧の島', time: 'morning', screens: 7, far: 'cliffs_morning', mid: 'trees',
    map: [54, -2], // 世界地図の位置（緯度, 経度）
    hill: '#1c2430', ground: ['#4a6a4a', '#34443a', '#6a6a60'], tint: 'rgba(60,70,100,.08)', bscale: 1.0,
    props: [['tower_ivy', 3100, 380], ['rune_stone', 4100, 110], ['tree_dead', 4600, 260], ['stone_chapel', 6100, 360]],
    buildings: [['uk_tudor', 400], ['uk_terrace', 900], ['uk_terrace', 1180], ['city_building', 1700, 0.95], ['white_mansion', 2500, 0.95], ['castle_gate', 3500], ['treehouse', 5000, 0.9]],
    npcs: [
      { id: 'yui_kiri', name: YUI('黒いスーツの娘'), sprite: 'yui_suit', x: 1300, face: -1 },
      { id: 'rei', name: REI('赤いマフラーの女'), sprite: 'rei_trench', x: 2300, face: -1 },
      { id: 'elf', name: '霧の森の薬草とり', actor: 'herbgranny', x: 3800, face: -1 },
      { id: 'young', name: '黒い服の少年', actor: 'second_young', x: 4900, face: 1, sheet: SECOND_YOUNG, pose: f => f.reiKnown ? 'wave' : 'sneak', when: f => f.stepsHeard }
    ],
    places: [{ id: 'steps', name: '霧の中の足音', x: 5500, verb: '聞く', when: f => f.reiAsked && !f.stepsHeard }],
    weather: { fog: 4, densefog: 3, drizzle: 2, clear: 1 },
    animals: [['dog_bulldog', 1800], ['sheep', 3200], ['sheep', 3380]],
    talk: {
      yui_kiri(S) {
        const f = S.f;
        if (S.back) return [['npc', '', '夜会は、踊りの相手に三回足を踏まれて終わったわ。……剣のほうが楽って、言ったでしょう。']];
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
        return [['npc', 'normal', '……ある男を追っている。黒い外套の、背の高い男。灯台守の家から、海図を盗んだ。'], ['npc', 'normal', '昼の船で島を出られたら、もう追えない。霧が晴れるまでが勝負。'], ['npc', 'normal', '霧で見えないのに、ずっと誰かの気配がする。'], ['npc', 'normal', '森のほうで、何か聞こえたら教えて。見えたものより、聞こえたもの。']];
      },
      elf(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', '霧が晴れたら、あの黒い服の坊や、森で尾行の練習をしてたわ。わたしを相手に。'], ['npc', 'normal', '……足音で、すぐ分かったけどね。']];
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
        return [['npc', 'normal', 'ば、ばれた！ 尾行の練習中だったのに。'], ['npc', 'normal', '赤いマフラーのお姉さんを、朝からつけてたんだ。本物のエージェントだから。'], ['npc', 'normal', 'ぼくの兄ちゃんも、エージェントなんだ。WATCH っていうところの。'], ['me', '', '（あの人が感じていた気配は、この子だったんだ）'], ['insight', '', '霧の中の気配は、悪い男のものではなく、憧れの足音だった。']];
      }
    }
  });

  // ---------------------------------------------------------------- 9 火を分ける（頼まれて、最後の窓に灯りを届ける）
  C.push({
    id: 'yuki', name: 'ノルヴィーク', sub: '雪の村', time: 'night', screens: 5, far: 'aurora_night', fore: false,
    map: [62, 10], // 世界地図の位置（緯度, 経度）
    hill: '#3a4458', ground: ['#e8eef4', '#c4ccd8', '#a8b0bc'], tint: 'rgba(120,140,190,.08)', bscale: 1.0,
    props: [['pine_snow', 300, 300], ['tree_snow', 2900, 300], ['pine_snow', 4400, 320]],
    buildings: [['nordic_red', 500], ['nordic_red', 1500, 0.85], ['lumber_hut', 2400, 1.4], ['nordic_red', 3400, 1.05]],
    npcs: [
      { id: 'yoru', name: 'ソルヴェイ', actor: 'snowkid', x: 900, face: -1 },
      { id: 'roujin', name: '火守りのオーラヴ', actor: 'lanternsage', x: 2000, face: -1 }
    ],
    places: [{ id: 'window', name: 'いちばん東の家の窓', x: 3700, verb: '見る' }],
    weather: { snow: 6, clear: 2, densefog: 1, wind: 1 },
    animals: [['dog_husky', 1400], ['dog_samoyed', 2700]],
    talk: {
      yoru(S) {
        const f = S.f;
        if (f.lampDone && !f.solRevealed) { f.solRevealed = true;
          return [['npc', 'normal', '灯った？ いちばん東の家。'], ['me', '', '灯りました。でも、だれもいませんでした。'], ['npc', 'normal', '……うん。知ってる。'], ['npc', 'normal', 'あれ、うちなの。暗い家に一人でいるのが嫌で、ずっと外にいた。'], ['npc', 'normal', 'じいさんに火を頼むのは、なんだか負けた気がしてさ。……帰るね。']]; }
        if (S.back && !f.lampDone) return [['npc', 'normal', 'いちばん東の家、まだ暗いまま。……いいの、慣れてるから。']];
        if (S.back) return [['npc', 'normal', 'ゆうべは、ちゃんと家で寝た。窓が明るいと、外より家のほうがいいね。'], ['npc', 'normal', '……母さんには、言わないで。外で待ってたこと。']];
        if (f.solRevealed) return [['npc', 'normal', '窓が明るいと、家が家っぽく見える。']];
        return [['me', '', '（こんな夜ふけの雪の中に、女の子がひとりで立っている。家に入る様子はない）'], ['npc', 'normal', 'この村でいちばん遅くまで灯ってる窓、どこか知ってる？'], ['npc', 'normal', '火守りのじいさんの家。……じいさんは、窓が全部灯るまで寝ないの。'], ['npc', 'normal', 'いちばん東の家の子は、母さんが山向こうに働きに出てて、いま一人。あそこだけ、暗い。']];
      },
      roujin(S) {
        const f = S.f;
        if (S.back && f.solRevealed) return [['npc', 'normal', '今朝、ソルヴェイが礼を言いに来た。窓の子は、あの子だったのさ。'], ['npc', 'normal', 'わしは、知っとった。あの子が頼みに来るのを、待っとったんじゃが。'], ['npc', 'normal', '……わしのろうそくが、少し伸びた気がする。気のせいじゃろうがな。']];
        if (S.back && !f.lampDone) return [['npc', 'normal', '火を持たずに行ったか。……まあ、いい。今夜も、わしが窓を見ておる。']];
        if (S.back) return [['npc', 'normal', '今朝、いちばん東の家の子が、礼を言いに来た。'], ['npc', 'normal', '……わしのろうそくが、少し伸びた気がする。気のせいじゃろうがな。']];
        if (f.lampDone) return [['npc', 'normal', '灯ったか。ありがとうよ。今夜は、早く眠れそうじゃ。']];
        if (f.lampGiven) return [['npc', 'normal', '火は、いちばん東の家まで。風に気をつけてな。']];
        f.lampGiven = true;
        return [['npc', 'normal', '寒かろう。火にあたっていけ。……犬どもをどけてな。火の番が下手で、すぐ火の前で寝る。'], ['npc', 'normal', '若いころ、ろうそくが並ぶ洞窟の夢を見た。一本一本が、人の命だという。'], ['npc', 'normal', 'わしのは、ずいぶん短かった。……それから五十年、毎晩こうして火を配っとる。'], ['npc', 'normal', '旅の人、ついでに頼まれてくれんか。この火を、いちばん東の家まで。'], ['me', '', '（ランタンを受け取った。小さいけれど、あたたかい）']];
      },
      window(S) {
        const f = S.f;
        if (!f.lampGiven) return [['me', '', '（窓が暗い。この家だけ、灯りがない）']];
        if (f.lampDone) return [['me', '', '（窓の灯りが、雪に映っている）']];
        f.lampDone = true;
        return [['me', '', '（戸をたたいても、返事がない。窓は、少しだけ開いている）'], ['me', '', '（窓辺のろうそくに、ランタンの火を移した）'], ['me', '', '（ランタンの火は、そのまま、手の中で燃えている）'], ['insight', '', '火を分けても、手元の火は減らなかった。']];
      }
    }
  });

  // ---------------------------------------------------------------- 10 落とし物の持ち主探し（色の町で、色を手がかりに）
  C.push({
    id: 'saka', name: 'チリーノ', sub: '坂の港', screens: 7, far: 'volcano',
    map: [-33, -71], // 世界地図の位置（緯度, 経度）
    hill: '#2a2030', ground: ['#7a9a5a', '#5a4a3a', '#9a8a70'], tint: 'rgba(120,60,80,.06)', bscale: 1.05,
    props: [['palm', 2650, 300], ['step_pyramid', 5800, 360], ['cactus', 6300, 140]],
    buildings: [['mx_house', 400], ['mx_church', 1000], ['br_townhouse', 1550], ['br_hillside', 2150], ['cl_hill_house', 2950], ['ar_boca', 3450], ['cl_stilt', 4150], ['ar_estancia', 5300]],
    npcs: [
      { id: 'second', name: 'セカンド（WATCH）', actor: 'second', x: 1300, face: 1, sheet: SECOND,
        pose: f => f.secondDone ? 'wave' : f.secondAsked ? 'sneak' : 'crouch', leaveWhen: f => f.secondDone },
      { id: 'mizuchi', name: 'ミラ（絵描き）', actor: 'scarfwoman', x: 2600, face: -1 },
      { id: 'shiro', name: 'ティト（港の子）', actor: 'flower_boy', x: 4000, face: -1 }
    ],
    places: [{ id: 'emptyhouse', name: '青い窓の空き家', x: 3300, verb: '見る', when: f => f.secondAsked }],
    weather: { clear: 5, squall: 2, wind: 2, drizzle: 1 },
    animals: [['dog_spot', 1900], ['llama', 5600, { mode: 'stay' }],
      // 猫のチロ：鈴が戻ってから、帰り道にティトのそばにいる
      ['cat_orange', 4150, { back: 'only', when: f => f.shiroBell, range: 160 }]],
    talk: {
      emptyhouse(S) {
        const f = S.f;
        if (S.back) return [['me', '', '（空き家の窓辺で、茶トラが昼寝している。首の鈴が、ときどき鳴る）']];
        f.emptySeen = true;
        return [['me', '', '（窓枠は、鈴と同じ青。でも、戸には板が打ちつけてある）'], ['me', '', '（窓辺に、茶色い猫の毛が少し。……ここで昼寝する猫がいるらしい）']];
      },
      second(S) {
        const f = S.f;
        if (f.shiroBell && !f.secondDone) { f.secondDone = true;
          return [['me', '', '鈴の持ち主は、港の子のティトでした。猫の首輪の鈴だそうです。'], ['npc', 'normal', '……猫か。どうりで、子どもの手のにおいがしないと思った。'], ['npc', 'normal', '任務完了だ。ティトには、おれから返しに行く。'],
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
        if (f.secondAsked) return [['npc', 'normal', '青い鈴？ この町で青を使ってる家は、二軒だけだ。'], ['npc', 'normal', '一軒は空き家。もう一軒は、東のティトの家。窓枠が、鈴と同じ青だ。'], ['npc', 'normal', 'そういえば、けさ港で、首輪だけの茶トラが船をじっと見てた。……絵にしようとしたら、逃げた。']];
        return [['npc', 'normal', 'この町の家は、みんな色がちがうだろう？'], ['npc', 'normal', '船を塗った余りのペンキで塗るんだ。だから、どの色も少しずつしかない。']];
      },
      shiro(S) {
        const f = S.f;
        if (S.back && f.shiroBell) return [['npc', 'normal', 'チロの鈴、黒い服のお兄さんが返しに来てくれたよ！'], ['npc', 'normal', 'ゆうべね、チロが港の船に乗りかけたの。でも、鈴の音で、ぼく、すぐ分かった。'], ['npc', 'normal', '名前を呼んだら、ちりんって鳴って、戻ってきたよ。'], ['insight', '', '持ち主に戻った鈴が、ゆうべ、猫を一匹呼び戻した。']];
        if (S.back) return [['npc', 'normal', 'チロ、まだ帰ってこない。港の船、きのう二つ出たんだ。']];
        if (f.shiroBell) return [['npc', 'normal', 'チロ、鈴がないと、すぐどこかに行っちゃうの。']];
        if (f.secondAsked) { f.shiroBell = true;
          return [['npc', 'normal', 'ぼくの家は、青と黄色と、ちょっとだけ赤！'], ['me', '', '黒い服の人が、青い鈴の持ち主を探してたよ。'], ['npc', 'normal', 'それ、チロの！ 猫のチロの首輪につけてたの！'], ['npc', 'normal', '今夜、大きな船が出るの。鈴がないと、チロが乗っても、ぼく気づけない。'], ['npc', 'normal', '鈴があれば、どこにいても見つけられるんだ。'], ...(f.emptySeen ? [['npc', 'normal', '……チロのお昼寝の場所？ 青い窓の空き家！ どうして知ってるの？']] : [])]; }
        return [['npc', 'normal', '猫のチロを探してるの。見なかった？'], ['npc', 'normal', 'チロはね、港の船に乗りたがるの。前に一度、隣の港まで行って、三日帰ってこなかった。'], ['npc', 'normal', '……今夜、大きな船が出るんだ。']];
      }
    }
  });

  // ---------------------------------------------------------------- 11 届いた荷（オランジェから同じ道を来たもの）
  C.push({
    id: 'mizu', name: 'シャムラ', sub: '水上の町', time: 'noon', screens: 7, far: 'mangrove_noon',
    map: [14, 100], // 世界地図の位置（緯度, 経度）
    hill: '#1e2a26', ground: ['#5a7a4a', '#4a3e30', '#7a6a54'], tint: 'rgba(40,90,80,.03)', bscale: 1.05,
    props: [['reeds', 3300, 120], ['palm', 4100, 320], ['jungle_temple_tree', 6000, 400]],
    buildings: [['sea_barrack', 400], ['sea_twostory', 950], ['sea_stall', 1550], ['sea_shop', 2150], ['sea_tall', 2750], ['sea_stilt', 3500], ['stilt_house', 4400], ['sea_barrack', 5300, 0.9]],
    npcs: [
      { id: 'mitsu2', name: 'ミツ（運び屋）', actor: 'porter', x: 600, face: 1 },
      { id: 'gou', name: 'ソム（屋台）', actor: 'grocer', x: 1500, face: -1 },
      { id: 'yui_mizu', name: YUI('水着の娘'), sprite: 'yui_swim', x: 2400, face: -1 },
      { id: 'second2', name: 'セカンド（WATCH）', actor: 'second', x: 3600, face: 1, sheet: SECOND, pose: () => 'carry', when: f => f.secondDone },
      { id: 'rei_mizu', name: REI('忍び装束の人'), sprite: 'rei_ninja', x: 5300, face: -1 }
    ],
    places: [{ id: 'pot', name: 'ソムの鍋', x: 1720, verb: '見る', when: f => f.boardsSent }],
    weather: { squall: 4, drizzle: 2, clear: 3, typhoon: 1 },
    animals: [['duck', 1000], ['chicks', 1100], ['cat_siamese', 3000], ['hen', 4500]],
    talk: {
      gou(S) {
        const f = S.f;
        if (S.back) return f.boardsSent
          ? [['npc', 'normal', '見てくれ、床が膝の高さまで上がった。ミツの板だ。'], ['npc', 'normal', 'ゆうべのスコールで、下の道は川になった。……一日遅かったら、かまどが沈んでた。'], ...(f.potWatched ? [['npc', 'normal', 'あんたが見ててくれた鍋のスープ、まだ使ってる。焦げのぶん、うまい。']] : [])]
          : [['npc', 'normal', '板、まだ来ないな。今年の雨は、待ってくれるといいが。']];
        if (f.potWatched) return [['npc', 'normal', '鍋、見ててくれたのか！ ……ちょっと焦げたな。いい、いい。焦げも味だ。']];
        if (f.boardsSent) return [['npc', 'normal', '板が来た！ 床を上げたら、一杯おごるよ。']];
        if (f.mitsuArrived) { f.boardsSent = true;
          return [['npc', 'normal', '食っていきな。……と言いたいが、見てくれ、床がもう水に浸かりそうだ。'], ['npc', 'normal', 'この町は毎年、雨の前に床を上げる。今年は、板が届かなくてな。'], ['me', '', '町の入口で、板を担いだ運び屋さんが休んでいました。'], ['npc', 'normal', 'ミツか！ ……迎えに行ってくる。鍋を見ててくれ！'], ['insight', '', 'オランジェから同じ道を来た板が、ここで床になる。']]; }
        return [['npc', 'normal', '食っていきな。……と言いたいが、見てくれ、床がもう水に浸かりそうだ。'], ['npc', 'normal', 'この町は毎年、雨の前に床を上げる。今年は、板が届かなくてな。'], ['npc', 'normal', '西から、運び屋が来るはずなんだが。']];
      },
      pot(S) {
        const f = S.f;
        if (S.back) return [['me', '', '（かまどは、上げた床の上。足もとの下を、水が流れていく）']];
        if (f.potWatched) return [['me', '', '（鍋は、とろ火でことことと鳴っている）']];
        f.potWatched = true;
        return [['me', '', '（大きな鍋が、ぐらぐら煮えている。屋台の床のすぐ下まで、水が来ている）'], ['me', '', '（ざあっとスコールが来た。鍋がふきこぼれそうになって、あわてて火を弱める）'], ['me', '', '（……少し、焦げたにおいがする）']];
      },
      yui_mizu(S) {
        const f = S.f;
        if (S.back) return [['npc', '', 'ソムさんの床、上がったのね。泳いでたら、床の下をくぐれたわ。'], ['npc', '', '……屋台の下を泳いだ王女は、たぶん、わたしが初めて。']];
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
        if (f.boardsSent) return [['npc', 'normal', 'ソムが迎えに来たよ。あとは、あいつが担ぐってさ。']];
        if (f.mitsuArrived) return [['npc', 'normal', 'もう一息なんだけどね。足が棒だよ。']];
        f.mitsuArrived = true;
        const hello0 = [['me', '', '（町の入口で、背丈より高い板の山が、ぐらぐら揺れている。下から声がした）']];
        const hello = S.met('porter')
          ? [['npc', 'normal', 'おや、オランジェで会った旅の人じゃないか！ 追い抜かれちまったね。']]
          : [['npc', 'normal', 'はじめまして。運び屋のミツ。西のオランジェから、板を担いできた。']];
        const rumor = f.seen
          ? [['npc', 'normal', 'そういえば、あの橋のうわさ。結局どうだった？'], ['me', '', '落ちてたのは、手すりの縄だけでした。'], ['npc', 'normal', 'やっぱりね。うわさは、運ぶ荷より速くて、重くなる。']]
          : [];
        return [...hello0, ...hello, ['npc', 'normal', 'この板を、ソムって屋台に届けるんだ。雨の前に床を上げないと、屋台が沈む。'], ['npc', 'normal', '……と分かってるんだけどね。足が、もう一歩も出ない。少し休ませて。'], ...rumor];
      },
      rei_mizu(S) {
        const f = S.f;
        if (S.back && f.reiKnown) return [['npc', '', '男は、港の役人に引き渡した。海図は、霧の島の灯台守に返す。'], ['npc', '', '……あなたは、また西へ戻るのね。わたしも、次は西。']];
        if (!f.reiKnown) return [['npc', '', '……仕事中。話しかけないで。']];
        return [['npc', '', '黒い外套の男は、この町で見つけた。足音で分かった。'], ['npc', '', '霧の島で、あの子の足音と聞き分けられたおかげ。……ありがとう、nono。']];
      }
    }
  });

  // ---------------------------------------------------------------- 12 大事件（堤防のしみ。戦わずに、知らせて間に合わせる）
  C.push({
    id: 'kazaguruma', name: 'ネーデラ', sub: '風車の低地', time: 'morning', screens: 6, far: 'windmills_morning',
    map: [52, 5], // 世界地図の位置（緯度, 経度）
    hill: '#2a3a34', ground: ['#6a9a5a', '#3e5a3c', '#7a6a54'], tint: 'rgba(120,140,170,.05)', bscale: 1.0,
    props: [['reeds', 500, 120], ['tree_green', 1700, 250], ['bush', 3000, 80], ['reeds2', 4900, 120]],
    buildings: [['thatched_farm', 900, 0.9], ['uk_terrace', 2700], ['nordic_red', 3300, 0.9], ['house_small', 5000, 1.5]],
    npcs: [
      { id: 'pim', name: 'ピム（少年）', actor: 'graykid', x: 700, face: 1 },
      { id: 'miller', name: '粉屋のゴロ', actor: 'oldsmith', x: 2300, face: -1 },
      { id: 'keeper', name: '堤防番のアンナ', actor: 'archer', x: 4500, face: -1 }
    ],
    places: [{ id: 'leak', name: '堤防の手形', x: 450, verb: '見る', when: f => f.dikeFixed }],
    weather: { wind: 1 }, // 風車が排水に回るので、この国はいつも強風
    animals: [['duck', 1300], ['cow', 3300, { mode: 'stay' }], ['cow', 3550, { mode: 'stay', face: -1 }], ['sheep', 5200]],
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

  // ---------------------------------------------------------------- 13 祈りがぶつかる（雨を待つ人が、降るなと願う人に雨を知らせる）
  C.push({
    id: 'shio', name: 'ボリビアナ', sub: '塩の湖', time: 'noon', screens: 6, far: 'salt_lake_noon', fore: false,
    map: [-20, -67], // 世界地図の位置（緯度, 経度）
    hill: '#b8b0a8', ground: ['#e8e4dc', '#d4cec4', '#c8beb0'], tint: 'rgba(200,220,255,.04)', bscale: 1.0,
    props: [['cactus', 600, 150], ['rock', 2200, 80], ['rock2', 4600, 100]],
    buildings: [['adobe', 300, 0.8], ['adobe', 4500, 0.7]],
    npcs: [
      { id: 'kappa', name: '写真屋のカルロ', actor: 'tabletscout', x: 1300, face: -1 },
      { id: 'tapa', name: '塩掘りのタパ', actor: 'miner', x: 3500, face: -1 }
    ],
    places: [
      { id: 'salt', name: '足もとの塩', x: 2500, verb: '見る' },
      { id: 'bricks', name: '積んだ塩のかたまり', x: 3950, verb: '運ぶ', when: f => f.tapaRush }
    ],
    weather: { clear: 6, drizzle: 3, wind: 1 },
    animals: [['llama', 2000, { mode: 'stay' }], ['donkey', 3720, { mode: 'stay', face: -1 }], ['llama', 4900]],
    talk: {
      kappa(S) {
        const f = S.f;
        if (S.back && f.saltSaved) return [['npc', 'normal', '見てくれ、ゆうべ、降ったんだ！ 足もとまで、空が来てる！'], ['npc', 'normal', 'タパが、写されに来た。「借りは返す」だとさ。'], ['npc', 'normal', '雨を知らせたのは、おれなのにな。……まあ、いい写真が撮れた。'], ['insight', '', '降れと祈る人が、降るなと祈る人に、最初に雨を知らせた。']];
        if (S.back) return [['npc', 'normal', '降ったよ。……空は、足もとまで来た。'], ['npc', 'normal', 'タパの塩は、半分溶けたそうだ。おれの祈りが、届きすぎた。']];
        if (f.kappaTold) return [['npc', 'normal', '……雲のこと、タパに言ったかい？ 言わなくても、べつに、いいんだけどさ。']];
        f.kappaTold = true;
        return [['me', '', '（写真屋が、三脚の横で、西の山を見つめている）'], ['npc', 'normal', '……雲だ。二十日ぶりの雲だ。今夜、降るぞ。'], ['npc', 'normal', '雨のあと、この湖は空を映す鏡になる。それを撮りに、ひと月ここにいる。'], ['npc', 'normal', '……東に、塩掘りのタパがいる。あいつ、切り出した塩を外に積んでる。濡れたら溶ける。'], ['npc', 'normal', '毎朝「降るな」と空に頼んでるやつだ。おれとは、口もきかない。'], ['npc', 'normal', '……旅の人。会ったら、「西に雲が出た」とだけ、言っといてくれ。おれからとは言うなよ。']];
      },
      tapa(S) {
        const f = S.f;
        if (S.back && f.saltSaved) return [['npc', 'normal', '降っちまった。三日は掘れない。……でも、塩は屋根の下だ。'], ['npc', 'normal', '雲のこと、あの写真屋が言ったんだろ。旅の人の顔に、そう書いてあった。'], ['npc', 'normal', '借りができた。掘れない日は、空の上を歩いて、写されてやるさ。']];
        if (S.back) return [['npc', 'normal', '降っちまった。外に積んでた塩が、半分、湖に返った。'], ['npc', 'normal', '……空の勝手だ。だれのせいでもない。']];
        if (f.saltSaved) return [['npc', 'normal', '助かった。今夜、降るなら降れ。……いや、降るなとは、もう言わんでおく。']];
        if (f.tapaRush) return [['npc', 'normal', '塩のかたまりを、屋根の下へ！ 一つでも多く！']];
        if (f.kappaTold) { f.tapaRush = true;
          return [['npc', 'normal', '雨よ、降るな。……旅の人、なんだい。'], ['me', '', '西に、雲が出ていました。'], ['npc', 'normal', '……雲？ 二十日ぶりにか。'], ['npc', 'normal', 'まずい、積んだ塩が外だ。旅の人、手を貸してくれ。東の小屋の屋根の下まで！']]; }
        if (f.tapaTold) return [['npc', 'normal', '雨よ、降るな。……あの写真屋は、反対のことを祈ってるがね。']];
        f.tapaTold = true;
        return [['npc', 'normal', '雨が降ったら、塩が水に沈んで、三日は掘れない。'], ['npc', 'normal', 'あの写真屋は、毎朝「降れ」って空に頼んでる。おれは「降るな」って頼んでる。']];
      },
      bricks(S) {
        const f = S.f;
        if (f.saltSaved) return [['me', '', '（塩のかたまりが、屋根の下に積み直されている）']];
        f.saltSaved = true;
        return [['me', '', '（塩のかたまりは、見た目よりずっと重い）'], ['me', '', '（タパと二人で、十いくつ運ぶ。腕が、ぱんぱんになる）'], ['me', '', '（運び終えたころ、西の空が、灰色になっていた）']];
      },
      salt(S) {
        if (S.back) return [['me', '', '（足もとの水に、空と雲が映っている。自分が、空に立っている）']];
        return [['me', '', '（白い地面に、六角形の模様が並ぶ。歩くと、塩がさくさく鳴る）']];
      }
    }
  });

  
// ---------------------------------------------------------------- 14 言葉のない返事（黙った案内人の合図を読む）
  C.push({
    id: 'mine', name: 'ネパラ', sub: '雪の峰', time: 'noon', screens: 6, far: 'snow_peaks_noon',
    map: [28, 84], // 世界地図の位置（緯度, 経度）
    hill: '#3a4656', ground: ['#8a9a7a', '#5a5a4a', '#8a8070'], tint: 'rgba(160,190,230,.05)', bscale: 1.0,
    props: [['pine_snow', 500, 280], ['rune_stone', 2900, 120], ['rock_moss', 4000, 110], ['pine_snow', 5200, 300]],
    buildings: [['pk_mountain', 700, 0.95], ['pk_mountain', 3300, 0.8]],
    npcs: [
      { id: 'lhakpa', name: '茶屋のラクパ', actor: 'lanterngirl', x: 1200, face: -1 },
      { id: 'guide', name: '黙った案内人', actor: 'backpacker', x: 2500, face: -1 },
      { id: 'dorje', name: 'ラクパの兄', actor: 'ranchhand', x: 4300, face: -1 }
    ],
    places: [{ id: 'flags', name: '峠の祈りの旗', x: 3500, verb: '見る' }],
    weather: { clear: 4, wind: 2, fog: 2, snow: 2 },
    animals: [['dog_mastiff', 1450, { mode: 'stay' }], ['yak', 3300, { mode: 'stay' }], ['yak', 3600], ['crow', 5000]],
    talk: {
      flags(S) {
        const f = S.f;
        if (S.back) return [['me', '', '（祈りの旗が、ゆるい風に、ゆっくり波打っている）']];
        return [['me', '', '（色とりどりの旗が、峠へ向かって、ちぎれそうなほど鳴っている）'], ['me', '', '（さっきまで、反対向きになびいていた気がする）']];
      },
      lhakpa(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', 'ゆうべ、峠は吹雪だったの。兄さん、ここで甘いお茶を三杯も飲んでた。'], ['npc', 'normal', 'あなたが、石のことを教えてくれたんでしょう。']];
        if (f.dorjeWaits) return [['npc', 'normal', '兄さん、待つって？ ……よかった。お茶、もう一杯どうぞ。']];
        if (f.lhakpaTold) return [['npc', 'normal', '案内人さんは、何も言わないの。でも、何も見ていないわけじゃない。']];
        f.lhakpaTold = true;
        return [['npc', 'normal', '旅の人、ちょうどよかった。兄さんを止めて。……ううん、やっぱり止めないで。'], ['npc', 'normal', '兄さん、今日のうちに峠を越えるって。向こうで、薬の荷を待ってる人がいるの。'], ['npc', 'normal', '峠の雲が、朝から気に入らない。でも、わたしが言うと、兄さんは意地になる。'], ['npc', 'normal', 'あの案内人さんに聞いてって言ったのに、あの人、口をきかないから。']];
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
        if (S.back) return [['npc', 'normal', '峠の向こうの人に、一日遅れたって謝ったら、笑われたよ。'], ['npc', 'normal', '「吹雪の日に着いたら、謝るのはこっちのほうだった」ってさ。']];
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
    map: [43, 12], // 世界地図の位置（緯度, 経度）
    hill: '#3a4a30', ground: ['#7a9a4a', '#5a5a3a', '#9a8460'], tint: 'rgba(255,220,180,.04)', bscale: 1.0,
    props: [['tree_olive', 400, 280], ['bush_berry', 1700, 90], ['tree_olive', 3600, 300], ['stump', 4800, 70]],
    buildings: [['it_tuscan', 600], ['it_townhouse', 1300, 0.9], ['it_tuscan', 4100, 0.85]],
    npcs: [
      { id: 'host', name: '祭りの世話役', actor: 'festival', x: 1000, face: -1 },
      { id: 'lucia', name: 'ルチア', actor: 'farmgirl', x: 2300, face: -1 },
      { id: 'master', name: '道ばたの老人', actor: 'elder', x: 5100, face: -1 }
    ],
    places: [{ id: 'vat', name: 'ぶどうの桶', x: 2900, verb: '踏む' }],
    weather: { clear: 6, drizzle: 2, wind: 1 },
    animals: [['donkey', 1700, { mode: 'stay' }], ['cat_calico', 3600], ['hen', 4300], ['rooster', 4420]],
    talk: {
      host(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', '聞いたよ、人ちがいだったって！ はっはっは！'], ['npc', 'normal', 'でもな、去年の名人より、あんたのほうが楽しそうに踏んでたぞ。来年も来い。']];
        if (f.stomped) return [['npc', 'normal', 'いやあ、見たことのない踏み方だった！ 名人の技は、奥が深い。']];
        if (f.hostMet) return [['npc', 'normal', '桶はルチアの家の前だ。名人の足、楽しみにしてるよ！']];
        f.hostMet = true;
        return [['npc', 'normal', '来たか、名人！ 赤いマントの旅人が来ると、手紙にあった！'], ['me', '', 'え、ちがいます。ぼくは、ただの……'], ['npc', 'normal', '謙遜するな！ 名人が最初の一歩を踏まないと、祭りが始まらんのだ。'], ['npc', 'normal', '昼の暑さが来たら、桶のぶどうが傷む。さあ、桶はルチアの家の前だ！']];
      },
      lucia(S) {
        const f = S.f;
        if (S.back && f.stomped) return [['npc', 'normal', '本物の名人に教わったわ。……でも、あなたの踏み方のほうが、みんな笑ってた。'], ['npc', 'normal', 'はい、あなたが踏んだ桶の、しぼりたて。種、ちょっとつぶれてるけど。'], ['me', '', '（少し渋くて、とても甘い）'], ['insight', '', 'にせの名人が踏んだぶどうも、ちゃんと同じ紫色になった。']];
        if (S.back) return [['npc', 'normal', '名人、寝坊してたんですって。桶のぶどう、少し傷んじゃった。……来年は、早起きしてもらう。']];
        if (f.stomped) return [['npc', 'normal', '名人の踏み方って、ずいぶん……自由なのね。来年、まねしてみる。']];
        if (f.luciaMet) return [['npc', 'normal', 'さあ、桶へ。名人の足、見せて。']];
        f.luciaMet = true;
        return [['npc', 'normal', 'あなたが名人？ 想像より、ずっと若いのね。'], ['npc', 'normal', 'あの桶のぶどう、わたしが初めて自分で育てたの。父さんの畑を、今年から任されて。'], ['npc', 'normal', '最初の桶がだめになったら、畑はまた父さんに返す約束。……だから、名人に踏んでほしかった。'], ['npc', 'normal', '踏み方を教えて。皮だけつぶして、種はつぶさないのがこつなんでしょう？'], ['me', '', '（……知らない。でも、ここで知らないとは、言いにくい）']];
      },
      vat(S) {
        const f = S.f;
        if (!f.hostMet) return [['me', '', '（大きな木の桶に、ぶどうが山盛りになっている）']];
        if (S.back && f.stomped) return [['me', '', '（桶から東へ、紫の足あとが点々と続いている。……わたしの足あとだ）'], ['me', '', '（行きに残した足あとを、いま逆向きにたどっている）']];
        if (f.stomped) return [['me', '', '（足の裏が、まだ少し紫色だ）']];
        f.stomped = true;
        return [['me', '', '（はだしで桶に入って、とにかく足ぶみしてみた）'], ['me', '', '（ぶどうが足の指のあいだで、ぷちぷちつぶれる。……くすぐったい）'], ['me', '', '（笑ったら、まわりの人たちも笑いだした。みんな桶に入ってきた）']];
      },
      master(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', 'しまった、寝過ごした！ わしがぶどう踏みの名人じゃ。'], ['npc', 'normal', '赤いマント？ わしは手紙に「赤い頭巾」と書いたんじゃが……'], ['npc', 'normal', '……まあよい。祭りは、だれが踏んでも祭りじゃ。']];
        return [['me', '', '（赤い頭巾の老人が、道ばたで気持ちよさそうに眠っている）']];
      }
    }
  });

  // ---------------------------------------------------------------- 16 立ち位置（返ってこないあいさつの正体）
  C.push({
    id: 'asahi', name: 'ケニアラ', sub: '朝日の草原', time: 'morning', screens: 6, far: 'savanna_morning',
    map: [0, 37], // 世界地図の位置（緯度, 経度）
    hill: '#4a3a24', ground: ['#a09a5a', '#6a5a3a', '#a88a60'], tint: 'rgba(255,200,140,.05)', bscale: 1.0,
    props: [['bush', 700, 80], ['tree_dead', 2100, 240], ['rock', 3300, 90], ['bush', 4700, 80]],
    buildings: [['thatched_farm', 300, 0.8], ['adobe', 4900, 0.8]],
    npcs: [
      { id: 'west', name: '西の村のムワンギ', actor: 'craftsman', x: 1000, face: 1 },
      { id: 'east', name: '東の村のオティエノ', actor: 'tribewarrior', x: 4400, face: -1 }
    ],
    places: [{ id: 'sun', name: '東の空', x: 2700, verb: '見る' }],
    weather: { clear: 7, wind: 2, drizzle: 1 },
    animals: [['cow', 1500, { mode: 'stay' }], ['cow', 1750], ['dog_brown', 3500], ['cow', 4700, { mode: 'stay', face: -1 }], ['hawk', 2700, { mode: 'fly' }]],
    talk: {
      west(S) {
        const f = S.f;
        if (S.back) return f.eastKnows
          ? [['npc', 'normal', '夕方、オティエノのやつが手を振ってた！ ちゃんと見えたぞ！ 跳んでた！'], ['npc', 'normal', '十年、すれちがってたんだな。朝日のせいで。……牛の市は、やる。もちろんやる！']]
          : [['npc', 'normal', '今朝も、返事はなかった。']];
        if (f.westTold) return [['npc', 'normal', '毎朝、日の出に向かって手を振る。返事はない。']];
        f.westTold = true;
        return [['npc', 'normal', 'おう、旅の人！ 東へ行くなら、オティエノに言ってやれ！'], ['npc', 'normal', 'おれは十年、毎朝、日の出に手を振ってる。あいつは一度も返さない！ 一度もだ！'], ['npc', 'normal', '雨季の牛の市は、二つの村でやる決まりだった。返事のないやつとは、今年からやらん。'], ['npc', 'normal', '……昔は、牛の背中で並んで昼寝した仲なんだがな。']];
      },
      sun(S) {
        const f = S.f;
        if (f.sunSeen) return [['me', '', '（東は、朝日でまぶしい。西を振り返ると、草原がよく見える）']];
        f.sunSeen = true;
        return [['me', '', '（東を見ると、朝日がまぶしくて、何も見えない）'], ['me', '', '（ふり返って西を見ると、ムワンギさんの小さな姿が、日に照らされてよく見える）'], ['me', '', '（……東から西は見える。でも、西から東は、見えないんだ）']];
      },
      east(S) {
        const f = S.f;
        if (S.back) return f.eastKnows ? [['npc', 'normal', '夕方に振った。向こうも、跳んでた。'], ['npc', 'normal', '……あいつ、牛の市の話を、大声で三回した。']] : [['npc', 'normal', 'ムワンギは、今朝も手を振ってた。']];
        if (f.eastKnows) return [['npc', 'normal', '今日の夕方、振ってみる。日が西に沈むころなら、こっちが照らされる。']];
        if (f.sunSeen) { f.eastKnows = true;
          return [['me', '', 'ムワンギさんが、毎朝あいさつしても返事がないって。'], ['npc', 'normal', '……振ってる。跳んで振ってる。'], ['me', '', '西からだと、朝日がまぶしくて、こっちが見えないんです。'], ['npc', 'normal', '……朝日の中にいたのは、おれのほうだったのか。'], ['npc', 'normal', 'あいつがなんで怒ってるのか、ずっとわからなかった。'], ['insight', '', 'あいさつが返ってこないのは、まぶしくて見えないだけのこともある。']]; }
        return [['npc', 'normal', '……ムワンギに会ったか。'], ['npc', 'normal', '毎朝、手を振ってくる。おれも振る。跳んで振る。'], ['npc', 'normal', 'なのに、牛の市はやめだと、人づてに言ってきた。……わけがわからん。']];
      }
    }
  });

// ---------------------------------------------------------------- 18 匂いの道案内（地図のない旧市街で、迷子を家へ送る）
  C.push({
    id: 'medina', name: 'マロッカ', sub: '迷路の旧市街', time: 'noon', screens: 5, far: 'kasbah_noon',
    map: [32, -6],
    hill: '#5a3424', ground: ['#c08a5a', '#8a5a3a', '#d0a070'], tint: 'rgba(200,110,60,.05)', bscale: 1.0,
    props: [['palm', 300, 300], ['stool', 1250, 40], ['clay_oven', 1820, 120], ['flatbread_table', 1990, 60], ['copper_cart', 3000, 120], ['mint_table', 3620, 70], ['textile_stall', 4450, 170]],
    buildings: [['mideast_white', 600], ['adobe', 1500, 0.9], ['es_gate', 2300], ['mideast_white', 3100, 0.9], ['adobe', 4000]],
    npcs: [
      { id: 'nadi', name: '迷子の女の子', actor: 'toddler', x: 700, face: 1, h: 0.62, when: f => !f.nadiHome, follow: f => f.nadiTaken && !f.nadiHome },
      { id: 'mustafa', name: 'ミントティー売りのムスタファ', actor: 'teaseller', x: 1250, face: -1 },
      { id: 'idris', name: '辻のイドリスじいさん', actor: 'na_elder', x: 2550, face: -1 },
      { id: 'fatima', name: 'ファティマ（ナディの母）', actor: 'hijab', x: 4300, face: -1, when: f => f.turned },
      { id: 'nadi2', name: 'ナディ', actor: 'toddler', x: 4020, face: 1, h: 0.62, when: f => f.nadiHome }
    ],
    places: [
      { id: 'bread', name: 'パンを焼く匂い', x: 1900, verb: 'かぐ' },
      { id: 'copper', name: '銅をたたく音', x: 3000, verb: '聞く' },
      { id: 'mint', name: 'ミントの匂いの角', x: 3700, verb: '曲がる' }
    ],
    weather: { clear: 7, wind: 2, drizzle: 1 },
    animals: [['cat_calico', 1000], ['cat_white', 2200], ['cat_black', 3400], ['donkey', 4700, { mode: 'stay', face: -1 }]],
    talk: {
      nadi(S) {
        const f = S.f;
        if (f.nadiTaken) return [['npc', 'normal', '……ママ、ミントのにおい。']];
        if (!f.mustafaTold) return [['me', '', '（小さな女の子が、壁にくっついて、じっと立っている。手に、銅貨を一枚にぎりしめている）'], ['npc', 'normal', '……ママ。'], ['me', '', '（それきり、何も言わない）']];
        f.nadiTaken = true;
        return [['me', '', 'ナディ？ ママのところへ、いっしょに行こう。'], ['npc', 'normal', '……うん。'], ['me', '', '（小さな手が、マントのすそをつかんだ）']];
      },
      mustafa(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', '帰りかい。ファティマが、あんたの分のお茶代を置いていったよ。'], ['npc', 'normal', '一杯どうぞ。……この町じゃ、道案内のお礼はお茶なんだ。']];
        if (f.mustafaTold) return [['npc', 'normal', 'パンの匂いを右、銅の音をまっすぐ、ミントの匂いで左。忘れるなよ。']];
        f.mustafaTold = true;
        return [['npc', 'normal', '旅の人、うしろの小さいのは、あんたの連れかい？'], ['me', '', 'いいえ。ずっと、ひとりで立っていて。'], ['npc', 'normal', 'ナディだ。織物屋のファティマの子だよ。……市場で手を離しちまったんだな。'], ['npc', 'normal', 'この旧市街に、地図はない。道は、匂いと音で教える。'], ['npc', 'normal', 'パンの匂いを右、銅の音をまっすぐ、ミントの匂いで左。そこが織物屋だ。'], ['npc', 'normal', '昼すぎには、ロバの荷車が通りを埋める。小さい子には危ない。'], ['npc', 'normal', 'おれは店を離れられん。昼の礼拝の前に、送ってやってくれ。']];
      },
      idris(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', 'あの子、今朝はひとりでパンを買いに来たそうだ。匂いをたどってな。']];
        if (f.nadiTaken) return [['npc', 'normal', 'ほう、小さな連れだ。……銅の音は、この先だ。耳をすませ。'], ['npc', 'normal', '目で探すと、この町は迷う。迷った者は、たいてい目に頼りすぎておる。']];
        return [['npc', 'normal', '旅の者か。この辻で五十年、迷った者を見てきた。'], ['npc', 'normal', 'みな、地図をにらんで迷う。わしの孫は、目をつぶって家に帰る。']];
      },
      bread(S) {
        if (S.back) return [['me', '', '（焼きたての匂い。……小さな足あとが、店の前まで続いている）']];
        return S.f.nadiTaken ? [['me', '', '（パンの焼ける匂い。ここを、右）'], ['me', '', '（ナディが、くん、と鼻を鳴らした）']] : [['me', '', '（パンの焼ける、香ばしい匂いがする）']];
      },
      copper(S) {
        if (S.back) return [['me', '', '（カン、カン、と銅をたたく音が、今日も通りに響いている）']];
        return S.f.nadiTaken ? [['me', '', '（カン、カン、と銅の音。ここは、まっすぐ）']] : [['me', '', '（どこかで、カン、カンと金属をたたく音がする）']];
      },
      mint(S) {
        const f = S.f;
        if (f.turned) return [['me', '', '（ミントの匂いの角。左に、織物屋の布がゆれている）']];
        if (!f.nadiTaken) return [['me', '', '（すうっとする匂い。左に細い路地がある）']];
        f.turned = true;
        return [['me', '', '（ミントの匂い。ここを、左へ）'], ['me', '', '（細い路地の先で、色とりどりの布がゆれている。だれかが、名前を呼んでいる）']];
      },
      fatima(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', 'ナディったら、今朝はひとりでパン屋まで行ったの。匂いをたどって。'], ['npc', 'normal', '……あなたのまねをしたのね。帰り道のまねを。']];
        if (f.nadiHome) return [['npc', 'normal', 'お茶屋のムスタファに、お代をあずけておくわ。帰りに飲んでいって。']];
        if (!f.nadiTaken) return [['npc', 'normal', 'ナディ、ナディ！ ……旅の人、小さな女の子を見なかった？ 赤い服の。']];
        f.nadiHome = true;
        return [['npc', 'normal', 'ナディ！'], ['me', '', '（ナディが、マントのすそを離して、走っていった）'], ['npc', 'normal', 'ありがとう……！ 昼寝させてたはずなのに、いつのまに。'], ['npc', 'normal', '……その銅貨、わたしの財布の。ナディ、あなた、ひとりで何をしに行ったの？'], ['me', '', '（ナディが、小さな声で言った。「パン……ママに」）'], ['npc', 'normal', '……迷子じゃなくて、おつかいだったのね。どうやって、ここが分かったの？'], ['me', '', 'パンの匂いを右、銅の音をまっすぐ、ミントの匂いで左。'], ['npc', 'normal', '……この町の人みたいな道の言い方ね。'], ['insight', '', '地図のない町では、匂いと音が、帰り道になっていた。']];
      },
      nadi2(S) {
        if (S.back) return [['npc', 'normal', 'パン、ひとりで、かった！ ……みぎ、まっすぐ、ひだり。']];
        return [['npc', 'normal', '……ミント。ママ。']];
      }
    }
  });

  
// ---------------------------------------------------------------- 19 絵の中の旅人（人を描けない画家の絵に、旅人が歩いて入る）
  C.push({
    id: 'blanco', name: 'イスパーニャ', sub: '白い坂の町', time: 'noon', screens: 5, far: 'sunflower_noon',
    map: [37, -4],
    hill: '#4a5a30', ground: ['#c8b890', '#9a8460', '#dccaa0'], tint: 'rgba(255,230,180,.04)', bscale: 1.0,
    props: [['tree_olive', 350, 280], ['wall_flowers', 1150, 110], ['easel', 1830, 130], ['tree_olive', 3200, 300], ['wall_painting', 4120, 120, (f, back) => back && f.walked], ['stump', 4500, 70]],
    buildings: [['es_white', 600], ['med_white', 1500, 0.95], ['es_gate', 2300], ['es_white', 3000, 0.9], ['bakery', 3900, 0.95]],
    npcs: [
      { id: 'dolores', name: 'ドロレスばあさん', actor: 'es_granny', x: 900, face: -1 },
      { id: 'pablo', name: '画家のパブロ', actor: 'painter', x: 1700, face: 1 },
      { id: 'rosa', name: 'パン屋のロサ', actor: 'baker_girl', x: 3950, face: -1 }
    ],
    places: [
      { id: 'street', name: '白い坂道', x: 2600, verb: '歩く', when: f => f.pabloAsk && !f.walked },
      { id: 'painting', name: 'パン屋の壁の絵', x: 4150, verb: '見る', when: f => f.walked }
    ],
    weather: { clear: 8, wind: 1, drizzle: 1 },
    animals: [['dog_borzoi', 2100, { range: 200 }], ['cat_orange', 3500], ['donkey', 4600, { mode: 'stay', face: -1 }]],
    talk: {
      dolores(S) {
        const f = S.f;
        if (S.back && f.walked) return [['npc', 'normal', '見たかい、パン屋の壁。あの子が、とうとう人を描いた。'], ['npc', 'normal', '十年前に、恋人がこの坂を下りていったきり、あの子の絵から人が消えてね。'], ['npc', 'normal', '……下りていく背中じゃなく、上ってくる人を描いた。それで、いいのさ。']];
        if (S.back) return [['npc', 'normal', 'あの子の絵は、きょうも白い壁ばかりさ。']];
        if (f.doloresTold) return [['npc', 'normal', '昼寝の前に、あの子の絵を見てやっとくれ。']];
        f.doloresTold = true;
        return [['npc', 'normal', 'おや、赤いマントだね。……坂の下の画家に見つからないうちに、引き返したほうがいいよ。'], ['npc', 'normal', 'あの子は二十日、同じ通りを描いとる。人だけは、ぜったいに描かない。'], ['npc', 'normal', 'あしたが祭りのポスターのしめきりでね。描けなきゃ、去年の絵の使い回しさ。'], ['npc', 'normal', '……それが、あの子はいちばん嫌いなんだよ。']];
      },
      pablo(S) {
        const f = S.f;
        if (S.back) return f.walked
          ? [['npc', 'normal', '絵、見てくれたかい。題は「通りすぎる人」。'], ['npc', 'normal', '人を描くのは、こわかった。止まっていてくれる人を描くと、いなくなるから。'], ['npc', 'normal', '……あんたは止まらなかった。だから、描けた。']]
          : [['npc', 'normal', '……白い壁は、何も言わずにいてくれる。']];
        if (f.walked) return [['npc', 'normal', 'それだ……それだよ！ 見ないで、見ないで。帰りに、パン屋の壁で。']];
        if (f.pabloAsk) return [['npc', 'normal', '坂を、ふつうに歩いて。こっちを見ないで。止まらないで。']];
        f.pabloAsk = true;
        return [['npc', 'normal', '……あっ、そこ！ 赤いマントの人、そのまま、そのまま！'], ['npc', 'normal', 'いや、止まらないで。歩いて。坂を、ふつうに上って。'], ['npc', 'normal', '二十日、この通りを描いてる。白い壁も、影も、花も、ちゃんと描けた。'], ['npc', 'normal', 'でも、絵が止まって見えるんだ。……歩いてる人が、足りなかったのかもしれない。']];
      },
      street(S) {
        S.f.walked = true;
        return [['me', '', '（白い坂を、ゆっくり上る。うしろで、筆の走る音がする）'], ['me', '', '（ふり返りたいのを、がまんした）'], ['me', '', '（坂の上で、「ありがとう！」と声が飛んできた）']];
      },
      rosa(S) {
        const f = S.f;
        if (S.back && f.walked) return [['npc', 'normal', 'パブロの絵、うちの壁に飾らせてもらったの。祭りのポスターの元の絵。'], ['npc', 'normal', '赤いマントの人、あなたでしょう？ お客さんがみんな、だれって聞くのよ。']];
        return [['npc', 'normal', '焼きたてよ。……昼寝の時間の前に、パンを買いに来る人で混むの。'], ['npc', 'normal', 'パブロ？ あの人、パンを買うときも、壁ばかり見てる。']];
      },
      painting(S) {
        if (!S.back) return [['me', '', '（まだ、壁には何もかかっていない）']];
        return [['me', '', '（白い坂の町の絵。真ん中に、赤いマントの小さな人が、坂を上っている）'], ['me', '', '（顔は描かれていない。でも、歩いているのが分かる）'], ['insight', '', 'わたしは、だれかの絵の中で、いまも坂を上りつづけている。']];
      }
    }
  });

  
// ---------------------------------------------------------------- 20 遠い道の模様（花嫁の服に、旅人の道のりを縫いこむ）
  C.push({
    id: 'vyshyva', name: 'ウクリーナ', sub: '麦の村', time: 'morning', screens: 5, far: 'wheat_noon',
    map: [49, 32],
    hill: '#5a5a2a', ground: ['#a8a050', '#6a6030', '#b8a868'], tint: 'rgba(255,230,140,.04)', bscale: 1.0,
    props: [['sunflowers', 300, 130], ['bride_dress', 1280, 150], ['well', 2750, 150], ['korovai_table', 3470, 80], ['haystack', 4150, 130], ['tree_green', 4600, 320]],
    buildings: [['thatched_farm', 700], ['house_small', 1600, 0.95], ['elder_house', 2500], ['bakery', 3600, 0.9]],
    npcs: [
      { id: 'oksana', name: 'オクサナばあちゃん', actor: 'ru_granny', x: 1000, face: -1 },
      { id: 'sofia', name: '花嫁のソフィア', actor: 'ukr_girl', x: 2200, face: -1 },
      { id: 'olena', name: 'ソフィアの母オレナ', actor: 'mother', x: 3300, face: -1 }
    ],
    places: [{ id: 'shirt', name: '刺しゅうの花嫁衣装', x: 1300, verb: '見る' }],
    weather: { clear: 6, wind: 2, drizzle: 2 },
    animals: [['rooster', 600], ['hen', 720], ['dog_akita', 1900], ['cow', 4000, { mode: 'stay' }], ['crow', 4400]],
    talk: {
      oksana(S) {
        const f = S.f;
        if (S.back && f.stitched) return [['npc', 'normal', 'ソフィアは、あしたの朝、町へ発つ。あの服を着てね。'], ['npc', 'normal', '……泣かなかったよ。泣くのは、帰ってきた日にとっておく。']];
        if (S.back) return [['npc', 'normal', '最後の模様は、けっきょく、わしの目では縫えなんだ。……空けたまま、渡したよ。']];
        if (f.stitched) return [['npc', 'normal', 'ありがとう。これで、あの子は迷わない。']];
        if (f.oksanaAsk) {
          f.stitched = true;
          return [['me', '', '（ばあちゃんの針に、赤い糸を通した）'], ['npc', 'normal', 'さあ、話しておくれ。あんたが歩いてきた道を。国の名前を、順番に。'], ['me', '', '花野の村、棚田の里、紅灯の都、風の草原……'], ['me', '', '（ひと針、ひと針、えりもとに細い赤い道が伸びていく）'], ['npc', 'normal', '……ここまで。ありがとう。'], ['npc', 'normal', '残りは、わしが夜のうちに縫う。目が見えんでも、縫える模様だからね。']];
        }
        f.oksanaAsk = true;
        return [['npc', 'normal', '旅の人、手を見せておくれ。……ふむ、針に糸を通せる手だ。'], ['npc', 'normal', '孫のソフィアが、あした嫁ぐ。町の、遠いところへ。'], ['npc', 'normal', '花嫁の服の刺しゅうは、ほとんどできた。残りは、えりもとの「遠い道」の模様だけ。'], ['npc', 'normal', '遠くを歩いた人の話を聞きながら縫う決まりでね。……それに、わしの目じゃ、もう糸が通らん。']];
      },
      shirt(S) {
        const f = S.f;
        if (S.back && f.stitched) return [['me', '', '（えりもとに、赤い糸と黒い糸の細い道が、二本ならんで続いている）']];
        if (f.stitched) return [['me', '', '（えりもとに、赤い糸の細い道が続いている。そのとなりは、まだ空いている）']];
        return [['me', '', '（白い麻の服に、赤と黒の刺しゅう。麦の穂、鳥、木。えりもとだけ、空いている）']];
      },
      sofia(S) {
        const f = S.f;
        if (S.back && f.stitched) return [['npc', 'normal', '見て、えりもとの道。赤が行きで、黒が帰り。'], ['npc', 'normal', 'ばあちゃん、帰り道の分まで縫ってたの。……帰ってこいってことよね。'], ['insight', '', 'わたしの歩いた道が、行きと帰りの二本の糸になって、だれかの旅じたくになった。']];
        if (S.back) return [['npc', 'normal', 'あした、町へ行く。……えりもとは、空いたまま。']];
        if (f.stitched) return [['npc', 'normal', 'えりもとの模様、ばあちゃんが「見るのは朝まで待て」って。']];
        return [['npc', 'normal', 'わたしが嫁ぐ町、ここから汽車で二日なの。'], ['npc', 'normal', 'うれしいの。うれしいんだけど……麦の匂いのしない町で、迷ったらどうしよう。']];
      },
      olena(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', 'パンを焼いたの。花嫁のパン。……焼いてるあいだだけ、泣いてもいいことにした。']];
        return [['npc', 'normal', 'あしたの婚礼のパンを、これから焼くの。編みこみの、大きな輪のパン。'], ['npc', 'normal', '母が刺しゅう、わたしがパン。……あの子が持っていけるものは、それくらいだから。']];
      }
    }
  });

// ---------------------------------------------------------------- 21 嵐を見届ける（四十年この海を避けてきた元船長と、甲板に立つ）
  C.push({
    id: 'pelican', name: 'ペリカン号', sub: '船の上・黒い海', time: 'night', screens: 5, far: 'storm_sea', fore: false,
    farBack: 'sea_morning', timeBack: 'morning', weatherBack: { clear: 6, wind: 2 },
    ship: true, sea: true, map: [43, 33],
    hill: '#1a2030', ground: ['#7a5e44', '#4e3a2a', '#8a6e50'], tint: 'rgba(30,40,70,.10)', bscale: 1.0,
    props: [['ship_crates', 450, 100], ['ship_mast', 1500, 430], ['ship_rope', 2100, 50], ['ship_wheel', 2950, 130], ['ship_mast', 3900, 440], ['ship_lantern', 4400, 150]],
    buildings: [],
    npcs: [
      { id: 'kolya', name: '甲板員のコーリャ', actor: 'sailor_boy', x: 700, face: -1 },
      { id: 'irina', name: 'イリーナ船長', actor: 'navylantern', x: 1800, face: -1 },
      { id: 'sergei', name: '白ひげの乗客', actor: 'hermit', x: 3600, face: -1,
        leaveWhen: f => f.sergeiDown, leaveDir: -1 },
      { id: 'sergei2', name: 'セルゲイ', actor: 'hermit', x: 3000, face: -1, when: (f, back) => back && f.sergeiGone }
    ],
    places: [{ id: 'rail', name: '船べり', x: 2550, verb: 'つかまる' }],
    weather: { squall: 5, typhoon: 3, wind: 2 },
    animals: [],
    talk: {
      kolya(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', 'セルゲイじいさんに、ロープの結び方を教わってる。四十年前のやり方。'], ['npc', 'normal', '……今のより、ずっとほどけない。くやしいけど。']];
        if (f.sergeiGone) return [['npc', 'normal', 'じいさん、自分から下りてきた！ 船長が何を言っても、だめだったのに。']];
        if (f.kolyaTold) return [['npc', 'normal', 'へさきまで行くなら、手すりづたいに！']];
        f.kolyaTold = true;
        return [['me', '', '（ロープを抱えた少年が、甲板をすべりながら走ってくる）'], ['npc', 'normal', '旅の人、船室へ！ ……あ、だめだ。あのじいさんが、まだへさきにいる。'], ['npc', 'normal', '客は全員、船室へって決まりなんだ。ひとりでも甲板に残ったら、だれも下りられない。'], ['npc', 'normal', '船べりから手を離さないで。波は、来るとき音がしないんだ。']];
      },
      irina(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', 'セルゲイさんが、けさ、はじめて「いい船だ」と言ったの。'], ['npc', 'normal', '……四十年分の、ひとことね。']];
        if (f.sergeiGone) return [['npc', 'normal', '下りてくれた……ありがとう。'], ['npc', 'normal', '……あの人が沈めた船の名前、知ってる？ ペリカン号。'], ['npc', 'normal', 'この船は、二代目。わたしが名前をもらったの。あの人には、言えずにいたけど。'], ['insight', '', '四十年避けてきた海を、あの人は同じ名前の船の上で見届けた。']];
        if (f.irinaTold) return [['npc', 'normal', 'わたしの言うことは聞いてくれない。……わたしが、若いから。']];
        f.irinaTold = true;
        return [['npc', 'normal', '嵐は一晩で抜ける。船は大丈夫。……甲板の人が、大丈夫じゃない。'], ['npc', 'normal', 'へさきの白ひげの人、セルゲイさん。四十年前、この海で船を沈めた船長よ。'], ['npc', 'normal', '下りてと三度頼んだ。三度とも、首を横にふられた。']];
      },
      rail(S) {
        const f = S.f;
        if (S.back) return [['me', '', '（船べりに、塩が白く乾いている。ゆうべの波のあとだ）'], ['me', '', '（朝の海は、ゆうべと同じ海だとは思えないほど、静かだ）']];
        if (f.railHeld) return [['me', '', '（手すりが、雨と波でぬるりとすべる）']];
        f.railHeld = true;
        return [['me', '', '（船べりにつかまったとたん、甲板が大きく傾いた）'], ['me', '', '（ざあっと、横から波が来る。足もとを、海水が走りぬけていく）'], ['me', '', '（……音が、しなかった。コーリャの言ったとおりだ）']];
      },
      sergei(S) {
        const f = S.f;
        if (f.sergeiDown) return [['npc', 'normal', '……行こう。']];
        if (f.railHeld && f.sergeiTold) { f.sergeiDown = true;
          return [['me', '', '（へさきの手すりに、セルゲイさんとならんでつかまった）'], ['me', '', '（稲光のたびに、波の壁が白く浮かぶ。どちらも、何も言わない）'], ['npc', 'normal', '……あの夜も、こういう波だった。わしは、ひとりで舵を握っておった。'], ['npc', 'normal', '見届けるとは、ひとりで立っていることだと思っておった。'], ['npc', 'normal', '……下りよう。となりに人がいても、海はちゃんと見えた。']]; }
        if (f.sergeiTold) return [['npc', 'normal', '下りろと言うなら、言わんでいい。……となりに立つのは、かまわん。']];
        f.sergeiTold = true;
        return [['npc', 'normal', '……船室へ行け、と言いに来たのか。'], ['npc', 'normal', '四十年前、この海で船を沈めた。乗組員は全員助かった。船だけが、沈んだ。'], ['npc', 'normal', 'それから一度も、この海を渡らなかった。今夜は、目をそらさずに見届けると決めた。']];
      },
      sergei2(S) {
        return [['npc', 'normal', '帰りの船も、これにした。……二代目の舵は、軽いな。'], ['npc', 'normal', '船長に頼まれて、少しだけ握らせてもらった。手が、まだ覚えておった。']];
      }
    }
  });

  
// ---------------------------------------------------------------- 22 名前の多い猫（町じゅうに名前のある猫を、引っこす子が連れていきたい）
  C.push({
    id: 'bosporia', name: 'ボスポリア', sub: '海峡の町', time: 'morning', screens: 5, far: 'harbor_morning', map: [41, 29],
    hill: '#3a3040', ground: ['#9a8a74', '#6a5a4a', '#aa9a80'], tint: 'rgba(255,200,190,.04)', bscale: 1.0,
    props: [['ship_barrels', 1250, 100], ['bollard', 3150, 60], ['pier', 3600, 110], ['ship_boat', 4300, 90]],
    buildings: [['med_white', 450, 0.95], ['it_townhouse', 1100, 0.9], ['pk_mosque', 2000, 0.9], ['sea_shop', 2700, 0.95]],
    npcs: [
      { id: 'elif', name: '籠を持った女の子', actor: 'girl', x: 650, face: 1, when: (f, back) => !back },
      { id: 'hasan', name: '古本屋のハサン', actor: 'bookmerchant', x: 1600, face: -1 },
      { id: 'mehmet', name: '桟橋番のメフメト', actor: 'stationmaster', x: 3350, face: -1 }
    ],
    places: [{ id: 'dishes', name: '戸口の餌皿', x: 2350, verb: '見る' }],
    weather: { clear: 6, fog: 2, drizzle: 2 },
    animals: [['cat_persian', 760, { mode: 'stay', back: 'not', face: -1 }], ['cat_persian', 3550, { mode: 'stay', back: 'only', face: -1 }]],
    talk: {
      elif(S) {
        const f = S.f;
        const names = (f.namePasha ? 1 : 0) + (f.nameFerry ? 1 : 0) + (f.dishesSeen ? 1 : 0);
        if (f.catChoose) return [['npc', 'normal', 'あしたの朝、桟橋で。……この子に決めてもらう。']];
        if (f.elifTold && names >= 2) { f.catChoose = true;
          return [['me', '', '本屋さんは「パシャ」、桟橋の人は「フェリー」と呼んでいました。'], ...(f.dishesSeen ? [['me', '', '戸口ごとに、名前の書いた餌皿がありました。'], ['npc', 'normal', '……全部、この子のお皿？']] : []), ['npc', 'normal', 'わたしだけの、ボンジュクじゃなかったんだ。'], ['npc', 'normal', '……籠には入れない。あした、桟橋まで一緒に歩いて、この子に決めてもらう。']]; }
        if (f.elifTold) return [['npc', 'normal', '入って、ボンジュク。……入ってくれない。']];
        f.elifTold = true;
        return [['me', '', '（女の子が、空っぽの籠のふたを開けて、猫に見せている。猫は、そっぽを向いている）'], ['npc', 'normal', '入って、ボンジュク。あした、船で向こう岸へ引っこすんだから。'], ['npc', 'normal', '……旅の人、猫を籠に入れるこつ、知らない？'], ['npc', 'normal', '本屋のおじさんは「連れていくな」って言うの。……わたしの猫なのに。']];
      },
      hasan(S) {
        const f = S.f;
        if (S.back && f.catChoose) return [['npc', 'normal', 'けさから、餌皿が一枚増えた。「エリフ」と書いてある。'], ['npc', 'normal', '猫の名前か、あの子の名前か、わからんがね。……両方だろうさ。'], ['insight', '', '名前がいくつもある猫は、どこへも行かずに、町じゅうの猫のままでいた。']];
        if (S.back) return [['npc', 'normal', 'あの子は、籠を抱えて船に乗ったそうだ。……籠は、ずいぶん軽そうだったとさ。']];
        if (f.namePasha) return [['npc', 'normal', 'パシャは、売り物の詩集の上でしか寝ない。猫にも、好みがある。']];
        f.namePasha = true;
        return [['npc', 'normal', 'ボンジュク？ ……ああ、パシャのことか。'], ['npc', 'normal', 'あいつは、毎日昼すぎにわしの店へ来て、いちばん高い本の上で寝る。だから、パシャ。'], ['npc', 'normal', 'エリフの猫？ あの子だけの猫じゃない。……だが、それを言うのは、わしの役じゃないな。']];
      },
      dishes(S) {
        const f = S.f;
        if (S.back && f.catChoose) return [['me', '', '（戸口の餌皿が、一枚増えている。新しい皿に、「エリフ」と書いてある）']];
        if (S.back) return [['me', '', '（戸口の餌皿は、どれもからっぽのまま。きょうは、だれも食べに来ていない）']];
        f.dishesSeen = true;
        return [['me', '', '（坂の戸口ごとに、小さな餌皿が置いてある）'], ['me', '', '（皿の名前は、パシャ、フェリー、ボンジュク、ゼイティン……）'], ['me', '', '（どの皿のふちにも、同じ白くて長い毛がついている）']];
      },
      mehmet(S) {
        const f = S.f;
        if (S.back && f.catChoose) return [['npc', 'normal', 'あの子は、けさの船で向こう岸へ行った。'], ['npc', 'normal', '猫は渡り板の手前まで歩いてきて、すわりこんだ。あの子は、笑って手をふったよ。'], ['npc', 'normal', '「週末に会いに来る」だとさ。……ほら、まだあそこで、船のほうを見てる。']];
        if (S.back) return [['npc', 'normal', '船が出たあと、フェリーが桟橋で鳴いておった。……乗りそびれた、という顔じゃなかったがね。']];
        if (f.nameFerry) return [['npc', 'normal', '船が来る前に、フェリーはかならずここに座る。時計より正確だ。']];
        f.nameFerry = true;
        return [['npc', 'normal', '白い長毛の猫？ フェリーのことだな。'], ['npc', 'normal', '毎朝、一番の船を、この桟橋で出むかえる。三年、一日も休まずにだ。'], ['npc', 'normal', '……だが、一度も船に乗ったことはない。この桟橋が、あいつの持ち場なんだろう。']];
      }
    }
  });

// ---------------------------------------------------------------- 23 背の高さの印（取り壊される隊商宿の壁に、二十年前の息子の印を探す）
  C.push({
    id: 'samarka', name: 'サマルカ', sub: '隊商宿の町', time: 'night', screens: 5, far: 'steppe_night', timeBack: 'morning', map: [39.6, 67],
    hill: '#2a2438', ground: ['#a08a64', '#6a5640', '#b09a74'], tint: 'rgba(60,50,110,.08)', bscale: 1.0,
    props: [['palm', 350, 280], ['ship_barrels', 1250, 90], ['stool', 1900, 40], ['rock', 4500, 80]],
    buildings: [['es_gate', 700], ['adobe', 1500, 0.95], ['mideast_white', 2300, 0.95], ['in_haveli', 3300, 0.9], ['adobe', 4200, 0.9]],
    npcs: [
      { id: 'yusuf', name: '鍵番のユスフ', actor: 'keykeeper', x: 600, face: 1 },
      { id: 'rahman', name: '楽師のラフマン', actor: 'minstrel', x: 1900, face: -1 },
      { id: 'aziz', name: 'アジズじいさん', actor: 'ca_elder', x: 2700, face: -1, when: (f, back) => !back },
      { id: 'aziz2', name: 'アジズじいさん', actor: 'ca_elder', x: 1400, face: 1, when: (f, back) => back && f.azizKnows }
    ],
    places: [{ id: 'wall', name: '隊商宿の長い壁', x: 3500, verb: '探す' }],
    weather: { clear: 7, wind: 3 },
    animals: [['camel', 1000, { face: -1 }], ['dog_brown', 3000]],
    talk: {
      yusuf(S) {
        const f = S.f;
        if (S.back && f.azizKnows) return [['npc', 'normal', '壁は、けさ取り壊した。……あの印のところだけ、石を切り出しておいた。'], ['npc', 'normal', 'じいさんの家の戸口に、はめてある。見ていくといい。']];
        if (S.back) return [['npc', 'normal', '壁は、けさ取り壊した。百年分の印も、いっしょにな。']];
        if (f.yusufTold) return [['npc', 'normal', '鍵を回すのは、夜明けの鐘のあとだ。それまでは、門は開けておく。']];
        f.yusufTold = true;
        return [['me', '', '（大きな鍵束を下げた男が、門の前で、ため息をついている）'], ['npc', 'normal', '旅の人、この宿に泊まる最後の客になるかもしれんよ。'], ['npc', 'normal', '百年続いた隊商宿だが、夜明けに鍵を返して、壁ごと取り壊す。新しい道を通すんだと。'], ['npc', 'normal', '……奥のアジズじいさんは、まだ壁の前から動かない。']];
      },
      rahman(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', '壁がなくなっても、歌は残る。きのうの夜、一つ増えた。「背くらべの歌」だ。']];
        if (f.rahmanHint) return [['npc', 'normal', '旅立つ日の背の高さに刻む。帰ってきたら、となりに今の背を刻む。それが、ならわしさ。']];
        f.rahmanHint = true;
        return [['npc', 'normal', 'この宿の壁の印を歌にして、四十年になる。'], ['npc', 'normal', '旅に出る者は、壁に自分の印を刻んでいく。目の高さじゃない、その日の背の高さにな。'], ['npc', 'normal', '帰ってきたら、となりに今の背を刻む。……帰ってこなかった印のほうが、ずっと多いがね。']];
      },
      aziz(S) {
        const f = S.f;
        if (f.azizKnows) return [['npc', 'normal', 'となりに、わしの印を刻んでおく。夜明けまでに。']];
        if (f.markFound) { f.azizKnows = true;
          return [['me', '', 'ありました。ざくろと星。膝の高さに。'], ['npc', 'normal', '……膝？'], ['npc', 'normal', '……そうだ。あの子は、十二だった。わしは、あの子の背の高さを、忘れておった。'], ['npc', 'normal', '毎晩、自分の目の高さばかり探しておった。二十年たった、今のあの子の背をな。']]; }
        if (f.azizTold) return [['npc', 'normal', 'ざくろの実に、星が一つ。……わしの目では、もう見つからん。']];
        f.azizTold = true;
        return [['npc', 'normal', '息子が二十年前、ここから隊商について西へ出た。'], ['npc', 'normal', 'この壁に、印を刻んでいったはずだ。ざくろの実に、星が一つ。'], ['npc', 'normal', '夜明けには、壁ごとなくなる。毎晩探したが、わしの目では見つからん。']];
      },
      wall(S) {
        const f = S.f;
        if (S.back) return [['me', '', '（壁のあった場所は、平らにならされている。新しい道の杭が、点々と打たれている）']];
        if (f.azizKnows) return [['me', '', '（ざくろと星の印のとなりに、新しい印が刻まれている。ずっと高いところに）']];
        if (f.markFound) return [['me', '', '（膝の高さの、ざくろと星。……アジズじいさんに知らせよう）']];
        if (!f.azizTold) return [['me', '', '（壁いっぱいに、ラクダ、太陽、名前、手の形……数えきれない印が刻まれている）']];
        if (!f.rahmanHint) return [['me', '', '（目の高さの印を、端から順に見ていく。ざくろは、見つからない）'], ['me', '', '（上のほうは、暗くてよく見えない）']];
        f.markFound = true;
        return [['me', '', '（その日の背の高さ……しゃがんで、低いところを探していく）'], ['me', '', '（膝の高さに、小さなざくろの実。そのとなりに、星が一つ）'], ['me', '', '（……思っていたより、ずっと低い）']];
      },
      aziz2(S) {
        return [['npc', 'normal', '息子の印の石を、戸口にはめた。毎朝くぐるたびに、十二のあの子と背くらべをしとる。'], ['npc', 'normal', '……わしのほうが、ずっと高い。まだ、負けておらん。'], ['insight', '', '壁の印は、旅立った日の背の高さのまま、二十年待っていた。']];
      }
    }
  });

  
// ---------------------------------------------------------------- 24 はじめての手紙（夜学で字を習うハルモニが、孫の手紙を自分で読みたい）
  C.push({
    id: 'golmok', name: 'コリアナ', sub: '秋の路地', time: 'morning', screens: 5, far: 'autumn_morning', map: [37.5, 127],
    hill: '#3a2a24', ground: ['#a07a50', '#6a4a34', '#b08a60'], tint: 'rgba(255,170,110,.05)', bscale: 1.0,
    props: [['tree_autumn', 400, 300], ['stool2', 1250, 40], ['tree_autumn', 2900, 320], ['bucket2', 3900, 50]],
    buildings: [['cn_house', 700, 0.9], ['teahouse', 1500, 0.9], ['cn_nagaya', 2400, 0.95], ['house_small', 3500, 1.4]],
    npcs: [
      { id: 'postman', name: '郵便屋のジフン', actor: 'postman', x: 650, face: 1 },
      { id: 'halmoni', name: 'スンジャばあちゃん', actor: 'fisher_granny', x: 1300, face: -1 },
      { id: 'mina2', name: 'となりのミンジ', actor: 'hanbok', x: 2300, face: -1 },
      { id: 'teacher', name: '夜学の先生', actor: 'teacher', x: 3600, face: -1 }
    ],
    places: [{ id: 'board', name: '夜学の黒板', x: 3950, verb: '見る' }],
    weather: { clear: 6, wind: 2, drizzle: 2 },
    animals: [['dog_shiba', 1700], ['crow', 2900], ['cat_calico', 4300]],
    talk: {
      postman(S) {
        const f = S.f;
        if (S.back && f.teacherTold) return [['npc', 'normal', '返事、あずかりました！ ……封筒の宛名、ばあちゃんの字です。'], ['npc', 'normal', '一字ずつ、まっすぐ。郵便屋を十年やって、いちばん読みやすい宛名です。']];
        if (S.back) return [['npc', 'normal', '手紙は、ミンジさんが読んであげたそうです。……ばあちゃん、ちょっと悔しそうだったな。']];
        if (f.postTold) return [['npc', 'normal', '返事は、あしたの朝の便で。それを逃すと、次は十日後です。']];
        f.postTold = true;
        return [['me', '', '（郵便屋が、封筒を一通持ったまま、ばあちゃんの家の前で困っている）'], ['npc', 'normal', '海の向こうのお孫さんからの手紙です。でも、受け取ってもらえなくて。'], ['npc', 'normal', '「読んでやろうか」と言ったら、怒られました。……返事は、あしたの朝の便までなんですが。']];
      },
      halmoni(S) {
        const f = S.f;
        if (S.back && f.teacherTold) return [['npc', 'normal', 'ゆうべ、読んだよ。ひと晩かかった。'], ['npc', 'normal', '孫が「ハルモニ、元気？」と書いとった。……七十年生きて、はじめて自分で読んだ言葉だ。'], ['npc', 'normal', '返事も書いた。「げんき」の一言だけだがね。'], ['insight', '', 'ひと晩かけて読んだ手紙に、ひと晩かけて書いた一言の返事が出ていった。']];
        if (S.back) return [['npc', 'normal', 'ミンジに読んでもらったよ。……いい手紙だった。いい手紙だったがね。']];
        if (f.halmoniTold) return [['npc', 'normal', '読んでもらうのは、かんたんだ。でも、それじゃあ、わしの手紙にならん。']];
        f.halmoniTold = true;
        return [['npc', 'normal', '旅の人、あんた、この字が読めるかい。……読めない？ そりゃよかった。'], ['npc', 'normal', '孫の手紙はね、わしが最初に読むと決めとる。'], ['npc', 'normal', 'この春から、夜学で字を習っとる。七十にもなってね。まだ、自分の名前しか書けんが。']];
      },
      mina2(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', 'ゆうべ、ばあちゃんの家の灯りが、朝まで消えなかったの。……字を、一つずつ読んでたのね。']];
        return [['npc', 'normal', 'スンジャばあちゃんの手紙？ わたしが読んであげるって言ったんだけど。'], ['npc', 'normal', '……ばあちゃん、手紙を胸に当てて、首をふるの。'], ['npc', 'normal', '夜学の先生なら、何か手を考えてくれるかも。路地のいちばん奥よ。']];
      },
      board(S) {
        const f = S.f;
        if (S.back) return [['me', '', '（黒板に、ふるえた大きな字で「ハルモニ、げんき」と書いてある。消されずに残っている）']];
        return [['me', '', '（黒板に、たどたどしい字が並んでいる。いちばん下に、「スンジャ」と大きく書いてある）'], ['me', '', '（ほかの字より、ずっと濃い。何度もなぞったあとがある）']];
      },
      teacher(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', 'ゆうべの授業は、生徒が一人だけでした。教科書は、海の向こうからの手紙です。']];
        if (f.teacherTold) return [['npc', 'normal', '今夜は、手紙の字だけを教えます。教科書は、使いません。']];
        if (!f.halmoniTold) return [['npc', 'normal', 'ここは夜学です。昼は、ただの物置ですがね。']];
        f.teacherTold = true;
        return [['me', '', 'スンジャさんが、お孫さんの手紙を、自分で読みたいそうです。あしたの朝までに。'], ['npc', 'normal', '……あしたの朝まで。一晩で、手紙一通ぶんの字。'], ['npc', 'normal', '無理です、と言うのが先生の仕事かもしれません。でも、あの人は名前を三百回書いた人だ。'], ['npc', 'normal', '今夜は、特別授業にしましょう。手紙に出てくる字だけ、教えます。']];
      }
    }
  });

  window.SEE_WORLD = { countries: C };
})();
