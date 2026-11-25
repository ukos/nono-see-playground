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
//   ride            : 乗り物を使う国だけ。'ship'（海を越える船旅）／'self'（自分で漕ぐなど、自分の力で渡る）。陸で人に運ばれる乗り物は使わない
//   shape           : 話の骨組みのラベル（直前の2か国と同じだと check.js が注意を出す）
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
    id: 'hanano', shape: 'うわさを確かめに行く', name: 'オランジェ', sub: '花野の村', screens: 7, far: 'flower', mid: 'trees',
    map: [46, 2], // 世界地図の位置（緯度, 経度）
    hill: '#1e2a2a', ground: ['#5d8a55', '#3e5a3c', '#6b5a45'], tint: 'rgba(80,40,90,.10)', bscale: 1.6,
    props: [['tree_green', 450, 260], ['bush_berry', 1050, 90], ['tree_autumn', 1980, 250], ['stump', 2950, 70], ['rock_moss', 3700, 110], ['tree_green', 4300, 280], ['pine', 4700, 300]],
    buildings: [['house_small', 560], ['bakery', 1100], ['house_large', 1640], ['elder_house', 2260], ['lumber_hut', 3080]],
    npcs: [
      { id: 'villager', name: 'ゴンジ（村人）', actor: 'prospector', x: 940, face: -1 },
      { id: 'elder', name: '長老', actor: 'scholar', x: 2420, face: -1 },
      { id: 'lumber', name: 'ダイ（木こり）', actor: 'bearhunter', x: 3360, face: -1 },
      { id: 'porter', name: 'ミツ（運び屋）', actor: 'courier', x: 4020, face: 1, when: f => !f.boardsSent }
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
    id: 'take', shape: '旅人の失敗が役に立つ', name: 'ジャポネ', sub: '棚田の里', time: 'morning', screens: 5, far: 'rice_terraces_morning',
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
    id: 'koutou', shape: '二重の秘密', name: 'キャセイ', sub: '紅灯の都', time: 'night', screens: 6, far: 'mystic_night',
    map: [30, 110], // 世界地図の位置（緯度, 経度）
    hill: '#2a1e26', ground: ['#6a7a4a', '#4a3e34', '#8a7258'], tint: 'rgba(40,20,80,.10)', bscale: 1.3,
    props: [['tree_old_roots', 700, 260], ['pine', 2900, 280], ['stone_lantern', 4000, 150], ['river_steps', 2100, 170]],
    buildings: [['cn_paifang', 300], ['cn_house', 1000], ['cn_teahouse', 1650], ['cn_nagaya', 2450, 1.1], ['cn_mansion', 3550, 1.15], ['cn_tower', 4650, 1.2]],
    npcs: [
      { id: 'okami', name: '茶館の女将', actor: 'kimono_woman', x: 1100, face: -1 },
      { id: 'yui_koutou', name: YUI('赤い服の娘'), sprite: 'yui_red', x: 2600, face: -1 },
      { id: 'teishu', name: '魚屋の亭主', actor: 'grocer', x: 3700, face: -1 }
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
    id: 'kaze', shape: '歩くこと自体が解決', name: 'モンゴーラ', sub: '風の草原', screens: 6, far: 'highland',
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
    id: 'iro', shape: '話が育って戻る', name: 'インダスタン', sub: '色の都', screens: 6, far: 'twilight',
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
    id: 'suna', shape: '手がかりで謎を解く', name: 'サハリア', sub: '砂の国', time: 'night', screens: 5, far: 'oasis_night', fore: false,
    map: [24, 10], // 世界地図の位置（緯度, 経度）
    hill: '#3a2a20', ground: ['#c8a46a', '#a07a4a', '#b89064'], tint: 'rgba(30,30,90,.06)', bscale: 1.0,
    props: [['cactus', 300, 140], ['palm', 900, 300], ['pyramid', 1780, 300], ['desert_temple', 4200, 320], ['stone_well', 4000, 100]],
    buildings: [['adobe', 500], ['mideast_white', 1300], ['adobe', 2700, 0.9], ['mideast_white', 3600, 0.95]],
    npcs: [
      { id: 'first', name: 'ファースト（WATCH）', actor: 'first', x: 800, face: 1, sheet: FIRST, pose: f => f.firstMet ? 'idle' : 'crouch' },
      { id: 'iwao', name: 'ハミド（水売り）', actor: 'veiled', x: 1900, face: -1 },
      { id: 'wizard', name: '旅の魔法使い', actor: 'sage', x: 2900, face: -1 }
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
    id: 'shirakabe', shape: '同じ習慣で他人がつながる', name: 'グレシア', sub: '白壁の港', time: 'night', screens: 6, far: 'river_bridge_night',
    map: [38, 23], // 世界地図の位置（緯度, 経度）
    hill: '#22303a', ground: ['#8aa06a', '#7a6a5a', '#c8b8a0'], tint: 'rgba(255,250,230,.0)', bscale: 1.1,
    props: [['tree_olive', 2600, 300], ['lighthouse', 5250, 420], ['boat_wreck', 5500, 200]],
    buildings: [['gr_chapel', 350], ['es_white', 900], ['it_townhouse', 1550], ['med_white', 2100, 0.9], ['es_gate', 2900], ['it_tuscan', 3500], ['gr_temple', 4400]],
    npcs: [
      { id: 'yui', name: YUI('剣を帯びた娘'), sprite: f => f.yuiKnown ? 'yui_queen' : 'yui_uniform', x: 1300, face: -1 },
      { id: 'mermaid', name: '人魚', actor: 'mermaid2', x: 3000, face: -1, special: 'legend' },
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
    id: 'kamome', ride: 'ship', shape: '前の国の知識を使う', name: 'カモメ号', sub: '船の上・霧の島へ', time: 'night', screens: 5, far: 'sea_night', fore: false,
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
    id: 'kiri', shape: '追う者が追われていた', name: 'ブリテニア', sub: '霧の島', time: 'morning', screens: 7, far: 'cliffs_morning', mid: 'trees',
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
    id: 'yuki', shape: '依頼の相手が依頼者本人', name: 'ノルヴィーク', sub: '雪の村', time: 'night', screens: 5, far: 'aurora_night', fore: false,
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
    id: 'saka', shape: '落とし物の持ち主探し', name: 'チリーノ', sub: '坂の港', screens: 7, far: 'volcano',
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
    id: 'mizu', shape: '遠い国からの荷が届く', name: 'シャムラ', sub: '水上の町', time: 'noon', screens: 7, far: 'mangrove_noon',
    map: [14, 100], // 世界地図の位置（緯度, 経度）
    hill: '#1e2a26', ground: ['#5a7a4a', '#4a3e30', '#7a6a54'], tint: 'rgba(40,90,80,.03)', bscale: 1.05,
    props: [['reeds', 3300, 120], ['palm', 4100, 320], ['jungle_temple_tree', 6000, 400]],
    buildings: [['sea_barrack', 400], ['sea_twostory', 950], ['sea_stall', 1550], ['sea_shop', 2150], ['sea_tall', 2750], ['sea_stilt', 3500], ['stilt_house', 4400], ['sea_barrack', 5300, 0.9]],
    npcs: [
      { id: 'mitsu2', name: 'ミツ（運び屋）', actor: 'courier', x: 600, face: 1 },
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
    id: 'kazaguruma', shape: '知らせて間に合わせる', name: 'ネーデラ', sub: '風車の低地', time: 'morning', screens: 6, far: 'windmills_morning',
    map: [52, 5], // 世界地図の位置（緯度, 経度）
    hill: '#2a3a34', ground: ['#6a9a5a', '#3e5a3c', '#7a6a54'], tint: 'rgba(120,140,170,.05)', bscale: 1.0,
    props: [['reeds', 500, 120], ['tree_green', 1700, 250], ['bush', 3000, 80], ['reeds2', 4900, 120]],
    buildings: [['thatched_farm', 900, 0.9], ['uk_terrace', 2700], ['nordic_red', 3300, 0.9], ['house_small', 5000, 1.5]],
    npcs: [
      { id: 'pim', name: 'ピム（少年）', actor: 'graykid', x: 700, face: 1 },
      { id: 'miller', name: '粉屋のゴロ', actor: 'oldsmith', x: 2300, face: -1 },
      { id: 'keeper', name: '堤防番のアンナ', actor: 'kasuri', x: 4500, face: -1 }
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
    id: 'shio', shape: '対立する二人を旅人がつなぐ', name: 'ボリビアナ', sub: '塩の湖', time: 'noon', screens: 6, far: 'salt_lake_noon', fore: false,
    map: [-20, -67], // 世界地図の位置（緯度, 経度）
    hill: '#b8b0a8', ground: ['#e8e4dc', '#d4cec4', '#c8beb0'], tint: 'rgba(200,220,255,.04)', bscale: 1.0,
    props: [['cactus', 600, 150], ['rock', 2200, 80], ['rock2', 4600, 100], ['salt_pile', 3950, 90, (f, back) => !back && !f.saltSaved]],
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
    id: 'mine', shape: '言葉のない合図を読む', name: 'ネパラ', sub: '雪の峰', time: 'noon', screens: 6, far: 'snow_peaks_noon',
    map: [28, 84], // 世界地図の位置（緯度, 経度）
    hill: '#3a4656', ground: ['#8a9a7a', '#5a5a4a', '#8a8070'], tint: 'rgba(160,190,230,.05)', bscale: 1.0,
    props: [['pine_snow', 500, 280], ['rune_stone', 2900, 120], ['rock_moss', 4000, 110], ['pine_snow', 5200, 300], ['prayer_flags', 3500, 230]],
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
    id: 'budou', shape: '人ちがい', name: 'イタリカ', sub: 'ぶどうの丘', time: 'morning', screens: 6, far: 'vineyard_morning',
    map: [43, 12], // 世界地図の位置（緯度, 経度）
    hill: '#3a4a30', ground: ['#7a9a4a', '#5a5a3a', '#9a8460'], tint: 'rgba(255,220,180,.04)', bscale: 1.0,
    props: [['tree_olive', 400, 280], ['bush_berry', 1700, 90], ['tree_olive', 3600, 300], ['stump', 4800, 70], ['grape_vat', 2900, 110]],
    buildings: [['it_tuscan', 600], ['it_townhouse', 1300, 0.9], ['it_tuscan', 4100, 0.85]],
    npcs: [
      { id: 'host', name: '祭りの世話役', actor: 'festival', x: 1000, face: -1 },
      { id: 'lucia', name: 'ルチア', actor: 'farmgirl', x: 2300, face: -1 },
      { id: 'master', name: '道ばたの老人', actor: 'lanternhood', x: 5100, face: -1 }
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
        return [['npc', 'normal', '来たか、名人！ マントの旅人が来ると、手紙にあった！'], ['me', '', 'え、ちがいます。ぼくは、ただの……'], ['npc', 'normal', '謙遜するな！ 名人が最初の一歩を踏まないと、祭りが始まらんのだ。'], ['npc', 'normal', '昼の暑さが来たら、桶のぶどうが傷む。さあ、桶はルチアの家の前だ！']];
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
        if (S.back) return [['npc', 'normal', 'しまった、寝過ごした！ わしがぶどう踏みの名人じゃ。'], ['npc', 'normal', 'マントの旅人？ ……手紙のマントは、わしのこの青いマントのことじゃが。'], ['npc', 'normal', '……まあよい。祭りは、だれが踏んでも祭りじゃ。']];
        return [['me', '', '（青いマントの老人が、道ばたで気持ちよさそうに眠っている）']];
      }
    }
  });

  // ---------------------------------------------------------------- 16 立ち位置（返ってこないあいさつの正体）
  C.push({
    id: 'asahi', shape: '見る向きのすれ違い', name: 'ケニアラ', sub: '朝日の草原', time: 'morning', screens: 6, far: 'savanna_morning',
    map: [0, 37], // 世界地図の位置（緯度, 経度）
    hill: '#4a3a24', ground: ['#a09a5a', '#6a5a3a', '#a88a60'], tint: 'rgba(255,200,140,.05)', bscale: 1.0,
    props: [['bush', 700, 80], ['tree_dead', 2100, 240], ['rock', 3300, 90], ['bush', 4700, 80]],
    buildings: [['thatched_farm', 300, 0.8], ['adobe', 4900, 0.8]],
    npcs: [
      { id: 'west', name: '西の村のムワンギ', actor: 'drummer', x: 1000, face: 1 },
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
    id: 'medina', shape: '道案内', name: 'マロッカ', sub: '迷路の旧市街', time: 'noon', screens: 5, far: 'kasbah_noon',
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
    id: 'blanco', shape: '旅人が作品の中に入る', name: 'イスパーニャ', sub: '白い坂の町', time: 'noon', screens: 5, far: 'sunflower_noon',
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
    id: 'vyshyva', shape: '旅の道のりを贈る', name: 'ウクリーナ', sub: '麦の村', time: 'morning', screens: 5, far: 'wheat_noon',
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
    id: 'pelican', ride: 'ship', shape: '隣に立つ', name: 'ペリカン号', sub: '船の上・黒い海', time: 'night', screens: 5, far: 'storm_sea', fore: false,
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
    id: 'bosporia', shape: '名前の多いもの', name: 'ボスポリア', sub: '海峡の町', time: 'morning', screens: 5, far: 'harbor_morning', map: [41, 29],
    hill: '#3a3040', ground: ['#9a8a74', '#6a5a4a', '#aa9a80'], tint: 'rgba(255,200,190,.04)', bscale: 1.0,
    props: [['ship_barrels', 1250, 100], ['bollard', 3150, 60], ['pier', 3600, 110], ['ship_boat', 4300, 90], ['cat_bowls', 2350, 70]],
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
    id: 'samarka', shape: '失われる前に探す', name: 'サマルカ', sub: '隊商宿の町', time: 'night', screens: 5, far: 'steppe_night', timeBack: 'morning', map: [39.6, 67],
    hill: '#2a2438', ground: ['#a08a64', '#6a5640', '#b09a74'], tint: 'rgba(60,50,110,.08)', bscale: 1.0,
    props: [['palm', 350, 280], ['ship_barrels', 1250, 90], ['stool', 1900, 40], ['rock', 4500, 80]],
    buildings: [['caravan_gate', 450], ['adobe', 1500, 0.95], ['mideast_white', 2250, 0.9], ['caravan_wall', 3050], ['adobe', 4250, 0.85]],
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
    id: 'golmok', shape: '止まった人を待つ姿で動かす', name: 'コリアナ', sub: '秋の路地', time: 'morning', screens: 5, far: 'autumn_morning', map: [37.5, 127],
    hill: '#3a2a24', ground: ['#a07a50', '#6a4a34', '#b08a60'], tint: 'rgba(255,170,110,.05)', bscale: 1.0,
    props: [['tree_autumn', 400, 300], ['stool2', 1250, 40], ['tree_autumn', 2900, 320], ['bucket2', 3900, 50]],
    buildings: [['kr_gate', 450], ['kr_hanok', 950], ['kr_jars', 1900], ['kr_hanok', 2450, 0.9], ['kr_school', 3450]],
    npcs: [
      { id: 'postman', name: '郵便屋のジフン', actor: 'postman', x: 650, face: 1 },
      { id: 'halmoni', name: 'スンジャばあちゃん', actor: 'fisher_granny', x: 1300, face: -1 },
      { id: 'mina2', name: 'となりのミンジ', actor: 'hanbok', x: 2300, face: -1 },
      { id: 'teacher', name: '夜学の先生', actor: 'teacher', x: 3350, face: -1 }
    ],
    places: [{ id: 'board', name: '夜学の黒板', x: 3620, verb: '見る' }],
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

// ---------------------------------------------------------------- 25 托鉢の戸口（言葉を交わせない僧と、閉じたままの戸）
  C.push({
    id: 'laoria', shape: '止まった人を待つ姿で動かす', name: 'ラオリア', sub: '朝の托鉢の村', time: 'morning', screens: 5, far: 'karst_morning', map: [19.9, 102.1],
    hill: '#2a3a2e', ground: ['#7a8a50', '#4a4a30', '#8a7a58'], tint: 'rgba(255,210,150,.05)', bscale: 1.0,
    props: [['palm', 350, 300], ['temple_gold', 900, 260], ['reeds', 3700, 120], ['palm', 4500, 320], ['rice_basket', 1880, 60, (f, back) => back && f.noiCame], ['burnt_pot', 3780, 70, (f, back) => !back]],
    buildings: [['sea_stilt', 1500, 0.9], ['stilt_house', 2300, 0.9], ['sea_stall', 3000, 0.95]],
    npcs: [
      { id: 'novice', name: '若いお坊さん', actor: 'almsmonk', x: 1650, face: 1 },
      { id: 'pha', name: '果物売りのパー', actor: 'fruitseller', x: 2650, face: -1 },
      { id: 'noi', name: 'ノイ', actor: 'aodai', x: 3900, face: -1, when: (f, back) => !back && !f.noiCame },
      { id: 'noi2', name: 'ノイ', actor: 'aodai', x: 2150, face: -1, when: (f, back) => back && f.noiCame }
    ],
    places: [
      { id: 'door', name: '閉じた戸口', x: 1850, verb: '見る' },
      { id: 'river', name: '川の洗い場', x: 3750, verb: '見る' }
    ],
    weather: { clear: 5, fog: 3, drizzle: 2 },
    animals: [['rooster', 600], ['hen', 720], ['dog_spot', 2900], ['duck', 3500]],
    talk: {
      novice(S) {
        const f = S.f;
        if (S.back && f.noiCame) return [['me', '', '（お坊さんは、口をきかない。ただ、鉢のふたを少しだけ開けて見せてくれた）'], ['me', '', '（白いもち米の上に、黒く焦げたかたまりが一つ、いちばん大事そうに置いてある）']];
        if (S.back) return [['me', '', '（お坊さんは、きょうも閉じた戸の前で、少しだけ立ち止まってから、歩いていった）']];
        if (f.noiCame) return [['me', '', '（お坊さんは、鉢を胸に抱いて、深く頭を下げた。そして、列のほうへ小走りで戻っていった）']];
        if (f.noviceSeen) return [['me', '', '（お坊さんは、戸の前から動かない。目だけで、こちらを見ている）']];
        f.noviceSeen = true;
        return [['me', '', '（托鉢の列が通りすぎたあと、若いお坊さんがひとりだけ、閉じた戸の前に立っている）'], ['me', '', '（からの鉢を胸に抱いたまま、何も言わない）'], ['me', '', '（……言わないのではなく、言えないのかもしれない）']];
      },
      door(S) {
        const f = S.f;
        if (S.back && f.noiCame) return [['me', '', '（戸口に、もち米のかごが出してある。ふたの上に、小さな花が一輪）']];
        if (S.back) return [['me', '', '（戸は、きょうも閉じたまま）']];
        return [['me', '', '（戸は閉じている。戸口に、からのかごが伏せてある）'], ['me', '', '（かごの竹は黒ずんでいる。何十年も、毎朝ここに置かれてきたのだろう）']];
      },
      pha(S) {
        const f = S.f;
        if (S.back && f.noiCame) return [['npc', 'normal', 'ノイの焦げごはん、あの若いお坊さんの大好物になったんだって。'], ['npc', 'normal', '……ほかのお坊さんたちに、「あれはないのか」って聞かれて、困ってるそうよ。']];
        if (S.back) return [['npc', 'normal', 'ノイの戸、きょうも閉まってた。……お母さんの代から、四十年、一日も休まなかったのに。']];
        if (f.noiCame) return [['npc', 'normal', 'ノイの戸が開いた！ ……かごを抱えて走っていったよ。あの子、裸足だった。']];
        if (f.phaTold) return [['npc', 'normal', 'お坊さんの代わりに、わたしが呼びに行けたらいいんだけどね。店を空けられなくて。']];
        f.phaTold = true;
        return [['npc', 'normal', 'あの若いお坊さん？ ノイの戸の前だね。'], ['npc', 'normal', 'お坊さんはね、自分から頼んだり、たずねたりしちゃいけないの。黙って立って、待つだけ。'], ['npc', 'normal', 'ノイのお母さんが、春に亡くなってね。ノイが、ひとりでもち米を炊くのは、きょうが初めてのはずなんだけど。'], ['npc', 'normal', '……川の洗い場のほうへ行くのを見たよ。']];
      },
      river(S) {
        const f = S.f;
        if (S.back) return [['me', '', '（洗い場に、ぴかぴかに磨かれた蒸し器が干してある）']];
        if (f.noiCame) return [['me', '', '（洗い場には、だれもいない。川の水が、朝日にひかっている）']];
        return [['me', '', '（川べりで、女の人が、黒く焦げた蒸し器を、力いっぱいこすっている）']];
      },
      noi(S) {
        const f = S.f;
        if (f.noiCame) return [['npc', 'normal', '……行ってくる。']];
        if (!f.phaTold) return [['npc', 'normal', '……ごめんなさい、いま、手が離せないの。']];
        if (f.noiTold && f.noviceSeen) { f.noiCame = true;
          return [['me', '', 'お坊さんが、まだ戸の前で待っています。からの鉢を抱いて。'], ['npc', 'normal', '……まだ？ 列は、とっくに行ったのに。'], ['npc', 'normal', 'あの子、お母さんがいちばんかわいがってた見習いさんなの。'], ['npc', 'normal', '……焦げたのでも、いいのかな。'], ['me', '', '（ノイは、焦げたところを、いちばん上にのせた。隠さずに）']]; }
        f.noiTold = true;
        return [['npc', 'normal', '見ないで。……焦がしたの。母さんのやり方のとおりに炊いたのに、ぜんぶ。'], ['npc', 'normal', '母さんは四十年、一度も焦がさなかった。わたしは、一日目で焦がした。'], ['npc', 'normal', 'こんなもの、お坊さんの鉢に入れられない。今朝は、戸を開けないことにしたの。']];
      },
      noi2(S) {
        return [['npc', 'normal', 'けさは、焦がさずに炊けたの。……少しだけ、わざと底を焦がしたけど。'], ['npc', 'normal', 'あの子が、鉢をのぞいて、ほんの少し笑ったのよ。お坊さんなのに。'], ['insight', '', '口をきけない人の待つ姿が、閉じた戸を、もう一度開けさせた。']];
      }
    }
  });

  
// ---------------------------------------------------------------- 26 声のないセレナーデ（金婚式の夜、声をなくした夫が窓の下で歌う）
  C.push({
    id: 'mehikana', shape: '止まった人を待つ姿で動かす', name: 'メヒカーナ', sub: 'サボテンの町', time: 'dusk', screens: 5, far: 'mesa_noon', timeBack: 'morning', map: [20.7, -103.3],
    hill: '#5a3424', ground: ['#b08a5a', '#7a5a3a', '#c09a6a'], tint: 'rgba(255,140,80,.07)', bscale: 1.0,
    props: [['cactus', 300, 150], ['wall_flowers', 1500, 110], ['cactus', 2900, 170], ['stool2', 3700, 40]],
    buildings: [['mx_house', 600], ['mx_church', 1900], ['adobe', 3050, 0.9], ['mx_house', 4100, 0.95]],
    npcs: [
      { id: 'ramon', name: 'ラモンじいさん', actor: 'oldman', x: 750, face: 1 },
      { id: 'hector', name: '楽師のエクトル', actor: 'mariachi', x: 2300, face: -1 },
      { id: 'carmen', name: '窓辺のカルメン', actor: 'ranchwife', x: 4300, face: -1 }
    ],
    places: [{ id: 'balcony', name: 'カルメンの窓の下', x: 4150, verb: '見上げる' }],
    weather: { clear: 7, wind: 2, drizzle: 1 },
    animals: [['dog_spot', 1200], ['donkey', 3300, { mode: 'stay' }], ['rooster', 3800]],
    talk: {
      ramon(S) {
        const f = S.f;
        if (S.back && f.ramonSings) return [['me', '', '（ラモンじいさんは、まだ声が出ない。指で、口もとを指して、片目をつぶってみせた）'], ['me', '', '（……「ちゃんと、歌えた」と言っている）']];
        if (S.back) return [['me', '', '（ラモンじいさんは、しおれたバラを抱いて、ベンチに座っている）']];
        if (f.ramonSings) return [['me', '', '（ラモンじいさんは、バラの束を抱え直した。口だけで、何度も歌の出だしをなぞっている）']];
        if (f.lipsKnown && f.ramonTold) { f.ramonSings = true;
          return [['me', '', 'カルメンさんは、口もとを見て、話を聞いていました。後ろから呼んでも、ふり向かないって。'], ['me', '', '（ラモンじいさんの目が、大きくなった）'], ['me', '', '（それから、ゆっくりうなずいて、バラの束を抱え直した）']]; }
        if (f.ramonTold) return [['me', '', '（ラモンじいさんは、首をふって、口だけを動かす。声は、かすれた息にしかならない）']];
        f.ramonTold = true;
        return [['me', '', '（白ひげの老人が、バラの束を抱えて、ベンチで口だけを動かしている）'], ['me', '', '（声が出ていない。のどに、白い布が巻いてある）'], ['me', '', '（老人は、紙に書いて見せてくれた。「今夜、金婚式。五十年前と同じ歌を、窓の下で歌う約束」）'], ['me', '', '（「風邪で声が出ない。声のないセレナーデなど、笑いものだ。取りやめる」）']];
      },
      hector(S) {
        const f = S.f;
        if (S.back && f.ramonSings) return [['npc', 'normal', 'ゆうべは、楽団を三十年やって、いちばん静かなセレナーデだった。'], ['npc', 'normal', 'じいさんは口だけ、おれたちは小さく弾いた。……窓が、ちゃんと開いたよ。']];
        if (S.back) return [['npc', 'normal', 'ゆうべは、楽団だけで一曲弾いた。窓は、開かなかった。']];
        if (f.ramonSings) return [['npc', 'normal', 'じいさん、やるってか！ ……なら、今夜は小さく弾く。歌が、見えるようにな。']];
        return [['npc', 'normal', 'ラモンの金婚式のセレナーデ？ 楽団は弾けるさ。だが、歌うのは本人でなきゃ意味がない。'], ['npc', 'normal', 'それにしても、カルメンさんは変わってる。'], ['npc', 'normal', '後ろから呼んでも、ぜったいにふり向かない。おれが子どものころから、ずっとだ。……前に回ると、にこっとする。']];
      },
      balcony(S) {
        const f = S.f;
        if (S.back && f.ramonSings) return [['me', '', '（窓辺の植木鉢に、ゆうべのバラが一本、さしてある）']];
        return [['me', '', '（窓辺の女の人が、通りを歩く人たちを、じっと見ている。耳ではなく、目で）']];
      },
      carmen(S) {
        const f = S.f;
        if (S.back && f.ramonSings) return [['npc', 'normal', '聞こえたわよ。五十年前と、同じ歌。'], ['npc', 'normal', '……あの人、二番の歌詞をまちがえたの。五十年前も、同じところで。'], ['insight', '', '声が出なくても、口もとを見る人には、歌はちゃんと窓まで届いた。']];
        if (S.back) return [['npc', 'normal', 'ゆうべは、楽団だけ来てくれたの。……あの人、風邪ですって。']];
        f.lipsKnown = true;
        return [['me', '', '（女の人は、わたしの口もとをじっと見てから、答えた）'], ['npc', 'normal', '旅の人ね。ごめんなさい、わたし、耳がほとんど聞こえないの。口を見て、話を聞くのよ。'], ['npc', 'normal', '今夜は、主人が窓の下で歌ってくれるはずなの。'], ['npc', 'normal', '……五十年前も、声なんか、聞こえてなかったのよ。口の形で、ぜんぶ覚えてるの。']];
      }
    }
  });

// ---------------------------------------------------------------- 27 旗泥棒の騒ぎ（砂の城の大会の旗が消える。犯人は、昔の仕事を覚えていた犬）
  C.push({
    id: 'brazila', shape: '騒動の犯人に理由がある', name: 'ブラジーラ', sub: '砂の城の浜', time: 'noon', screens: 5, far: 'beach_noon', map: [-13, -38.5],
    hill: '#3a5a4a', ground: ['#e0cc98', '#c0a878', '#ead8a8'], tint: 'rgba(255,230,160,.04)', bscale: 1.0,
    props: [['palm', 300, 320], ['ship_boat', 1400, 80], ['palm', 2400, 300], ['boat_wreck', 3300, 120], ['ship_rope', 3950, 50], ['castle_noflag', 1550, 90, f => !f.flagsBack], ['castle_flag', 1550, 110, f => f.flagsBack], ['castle_noflag', 2150, 95], ['castle_flag', 2150, 115, f => f.flagsBack]],
    buildings: [['br_townhouse', 700, 0.9], ['sea_barrack', 4100, 0.9]],
    npcs: [
      { id: 'lia', name: '審判のリア', actor: 'flagkid', x: 650, face: 1 },
      { id: 'teo', name: 'テオ', actor: 'islandboy', x: 1700, face: -1 },
      { id: 'bia', name: 'ビア', actor: 'schoolgirl', x: 2000, face: -1 },
      { id: 'joao', name: '網元のジョアン', actor: 'old_fisher', x: 4300, face: -1 }
    ],
    places: [
      { id: 'prints', name: '砂の足あと', x: 2900, verb: '見る' },
      { id: 'hut', name: '網小屋の前', x: 3800, verb: '見る' }
    ],
    weather: { clear: 7, wind: 2, squall: 1 },
    animals: [['dog_dane', 3900, { mode: 'stay', back: 'not' }], ['dog_dane', 1100, { mode: 'stay', back: 'only' }], ['crow', 2600]],
    talk: {
      lia(S) {
        const f = S.f;
        if (S.back && f.flagsBack) return [['npc', 'normal', 'ボルトの旗わたし、大人気！ 来年から、毎年あの子の係ね。'], ['npc', 'normal', '来年の審判も、わたしだって。……ボルトとふたりで。'], ['npc', 'normal', '……一等の旗、ボルトがくわえたまま、なかなか放さなかったけど。']];
        if (S.back) return [['npc', 'normal', '大会、旗なしでやったの。だれが勝ったか、だれも覚えてない。']];
        if (f.flagsBack) return [['npc', 'normal', 'ボルトが、旗を一本ずつ、勝った城の前に置いていくの！ 審判より正確！']];
        if (f.liaTold) return [['npc', 'normal', 'お昼の笛までに旗がないと、大会はおしまい！']];
        f.liaTold = true;
        return [['npc', 'normal', '旗泥棒！ だれか、旗泥棒を見なかった？'], ['npc', 'normal', '砂の城の大会の旗が、また消えたの！ 立てると、すぐなくなる。これで十本目！'], ['npc', 'normal', 'テオとビアが、おたがいに「あいつが犯人だ」って言いあってる。去年までは、二人で一つの城を作ってたのに。'], ['npc', 'normal', '……それに、わたし、今年はじめて審判をまかされたの。旗をなくした審判なんて、来年はもう呼ばれない。'], ['npc', 'normal', 'お昼の笛までに、なんとかしなきゃ。']];
      },
      teo(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', 'ビアの城、ゆうべの波で流されたって。……おれのも。いっしょに、また作る。']];
        if (f.flagsBack) return [['npc', 'normal', '犬かよ！ ……ビアに、あやまらなきゃ。いや、ビアもおれを疑ってたんだから、おあいこだ。']];
        return [['npc', 'normal', '犯人はビアだ。あいつの城、旗が消えるたびに、ちょっとだけ大きくなってる。'], ['npc', 'normal', '……証拠？ ないけど、顔がそう言ってる。'], ['npc', 'normal', 'もう、あいつとは口きかない。去年の城の半分は、おれが作ったのに。']];
      },
      bia(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', 'テオと、城を二つつなげて、橋をかけることにしたの。……流されないように、波の来ないところで。']];
        if (f.flagsBack) return [['npc', 'normal', 'テオじゃなかったの？ ……あいつの顔、犯人っぽいのに。']];
        return [['npc', 'normal', '犯人はテオよ。旗が消えるとき、いつもあいつ、こっちを見てないもの。'], ['npc', 'normal', '見てないってことは、何か隠してるってことでしょ。'], ['npc', 'normal', '去年、優勝の旗を立てたのは、わたし。なのにあいつ、みんなに「おれの城」って言いふらしたの。']];
      },
      prints(S) {
        const f = S.f;
        if (S.back) return [['me', '', '（大きな足あとが、城から城へ、きちんと並んで続いている）']];
        f.printsSeen = true;
        return [['me', '', '（城のまわりに、子どもの足あとがたくさん。その中に、手のひらより大きな、犬の足あとがある）'], ['me', '', '（犬の足あとは、まっすぐ東の網小屋へ続いている。行きも帰りも、まっすぐ）']];
      },
      hut(S) {
        const f = S.f;
        if (S.back) return [['me', '', '（網小屋の前には、網の浮きの旗だけが、きちんと干してある）']];
        if (!f.printsSeen) return [['me', '', '（網小屋の前に、大きな犬が寝そべっている）']];
        f.hutSeen = true;
        return [['me', '', '（網小屋の前に、色とりどりの小旗が、十本、きれいに並べてある）'], ['me', '', '（そのとなりで、大きな犬が、しっぽをふって、こちらを見ている。……ほめてほしそうに）']];
      },
      joao(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', 'ボルトは、けさも旗を十本くわえて、浜へ走っていった。'], ['npc', 'normal', '……もう網は張っておらんのに、仕事があるってのは、いいもんだ。']];
        if (f.flagsBack) return [['npc', 'normal', 'ボルトに、まちがえた旗は持ってくるなと、言っておいた。……分かっとる顔はしておらんが。']];
        if (!f.hutSeen) return [['npc', 'normal', 'ボルトかい？ わしの犬だ。昔は、いい相棒だった。']];
        f.flagsBack = true;
        return [['npc', 'normal', '……その旗、あんたのかい？ いや、浜の子らのか。'], ['npc', 'normal', 'ボルトの仕事はな、昼になったら、海に立てた網の旗を集めてくることだった。'], ['npc', 'normal', 'わしが網元をやめて、もう二年。……旗を見ると、まだ昼の仕事だと思うんだな。'], ['npc', 'normal', 'よし、こうしよう。旗は、ボルトに運ばせる。勝った城の前に、一本ずつ置いてこいってな。'], ['insight', '', '浜でいちばんの旗泥棒は、二年前の仕事を、まだまじめに続けていた。']];
      }
    }
  });

  
// ---------------------------------------------------------------- 29 けちな柵（いちご畑を囲う意地悪じいさん。柵の中は、地面の鳥の巣だらけだった）
  C.push({
    id: 'polonia', shape: '意地悪に見えた人の本当の理由', name: 'ポロニア', sub: '白樺の野', time: 'noon', screens: 5, far: 'birch_noon', map: [52.2, 21],
    hill: '#3a4a2a', ground: ['#6a8a44', '#44582e', '#8a8458'], tint: 'rgba(255,250,220,.03)', bscale: 1.0,
    props: [['bush_berry', 500, 90], ['bush', 1700, 90], ['haystack', 2200, 130], ['bush_berry', 3300, 100], ['well', 4300, 150], ['nofence', 2650, 110], ['berry_basket', 4050, 70, (f, back) => !back && f.nestKnown]],
    buildings: [['house_small', 700, 1.3], ['nordic_red', 3800, 0.9]],
    npcs: [
      { id: 'kuba', name: 'クバ', actor: 'greenboy', x: 900, face: 1 },
      { id: 'zosia', name: 'ゾーシャ（クバの姉）', actor: 'scout', x: 1500, face: -1 },
      { id: 'jan', name: 'ヤンじいさん', actor: 'mechanic', x: 3600, face: -1 }
    ],
    places: [
      { id: 'fence', name: '「入るな」の柵', x: 2650, verb: 'のぞく' },
      { id: 'basket', name: 'じいさんの家の前のかご', x: 4050, verb: '見る' }
    ],
    weather: { clear: 6, wind: 2, drizzle: 2 },
    animals: [['crow', 1900], ['dog_akita', 3300], ['hen', 4500]],
    talk: {
      kuba(S) {
        const f = S.f;
        if (S.back && f.nestKnown) return [['npc', 'normal', 'きょうから、ぼくも柵の番！ ヤンじいさんの助手なんだ。'], ['npc', 'normal', 'ひなが三羽、かえったよ。……大きい声を出すと、じいさんに怒られるけど。']];
        if (S.back) return [['npc', 'normal', 'ヤンじいさんのけち。……ばあちゃんのケーキ、いちごなしで焼いたよ。']];
        if (f.nestKnown) return [['npc', 'normal', '鳥の巣？ ……ほんと？ じいさん、そんなこと一言も言わなかった。'], ['npc', 'normal', '……みんなに、言ってくる。柵越えは、やめだって。走ったら、踏んじゃう。']];
        if (f.kubaTold) return [['npc', 'normal', 'お昼の鐘が合図。みんな、もう集まってるんだ。']];
        f.kubaTold = true;
        return [['me', '', '（からのかごを振り回しながら、男の子が地面をけっている）'], ['npc', 'normal', 'ヤンじいさんのけち！ いちご畑に柵をして、だれも入れないんだ。'], ['npc', 'normal', 'きょうは、ばあちゃんの誕生日なのに。いちごのケーキ、約束したのに。'], ['npc', 'normal', 'もういい。お昼に、村の子みんなで柵を越えて、全部とってやる。十人で走れば、じいさんだって止められない。']];
      },
      zosia(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', 'クバったら、毎朝じいさんのところへ行ってるの。……「けち」って言ってたくせに。']];
        if (f.zosiaTold) return [['npc', 'normal', 'お昼の柵越え、止めたほうがいいのかな。……弟、言い出したら聞かないの。']];
        f.zosiaTold = true;
        return [['npc', 'normal', '弟が、ヤンじいさんの柵をこっそり越えようとしたの。そしたら、ものすごい声でどなられて。'], ['npc', 'normal', '去年までは、あの野原、だれでも入れたのよ。この春から急に、柵。'], ['npc', 'normal', '……理由を聞いても、「入るな」としか言わないの。']];
      },
      fence(S) {
        const f = S.f;
        if (S.back && f.nestKnown) return [['me', '', '（柵の札が、書きかえられている。子どもの字で「しずかに　とりのす」）'], ['me', '', '（草の中から、小さなひなの声がする）']];
        if (S.back) return [['me', '', '（「入るな」の札。柵の向こうで、ひばりが一羽、高く上がっていく）']];
        f.nestSeen = true;
        return [['me', '', '（柵の向こうに、赤いいちごが点々と見える。……その先の草の中で、何かが動いた）'], ['me', '', '（茶色い鳥が、地面から飛び立った。地面に、小さな卵が四つ、草で囲んである）'], ['me', '', '（よく見ると、少し離れたところにも、また一つ。……草の中は、巣だらけだ）']];
      },
      jan(S) {
        const f = S.f;
        if (S.back && f.nestKnown) return [['npc', 'normal', 'あの坊主、毎朝来る。うるさくてかなわん。'], ['npc', 'normal', '……だが、卵を数えるのは、わしより早い。'], ['insight', '', 'けちに見えた柵は、足もとの小さな巣を、だれにも言わずに守っていた。']];
        if (S.back) return [['npc', 'normal', '……入るなと言うたら、入るな。']];
        if (f.nestKnown) return [['npc', 'normal', '畑の端のいちごなら、わしが摘んでおいた。家の前のかごだ。……坊主にやれ。']];
        if (!f.nestSeen) return [['npc', 'normal', '……なんだ。いちごなら、やらんぞ。'], ['npc', 'normal', '柵の中には、だれも入れん。旅の者もだ。']];
        f.nestKnown = true;
        return [['me', '', '柵の中、草のあいだに巣がありました。卵がたくさん。'], ['npc', 'normal', '……見たのか。踏まなかったろうな。'], ['npc', 'normal', 'ひばりだ。春に、急に野原じゅうに巣をかけおった。いちご摘みの子らが走り回れば、ひとつ残らず踏みつぶされる。'], ['npc', 'normal', '子どもに言えば、見に来たがる。見に来れば、踏む。だから、「入るな」としか言わなんだ。']];
      },
      basket(S) {
        const f = S.f;
        if (S.back) return [['me', '', '（かごは、からっぽ。底に、いちごの赤いしみだけが残っている）']];
        if (f.nestKnown) return [['me', '', '（かごいっぱいの、赤いいちご。上に、紙きれが一枚。「坊主へ。巣を踏むな」）']];
        return [['me', '', '（家の前に、からのかごが一つ。いちごの葉っぱが、少しだけ入っている）']];
      }
    }
  });

  
// ---------------------------------------------------------------- 28 まっすぐ漕ぐ（渡し舟が休みの湖を、旅人が自分で渡る）
  C.push({
    id: 'kanadia', ride: 'self', shape: '旅人が教わって自分で渡る', name: 'カナディア', sub: '湖の渡し', time: 'morning', screens: 5, far: 'lake_reeds_morning', map: [46.5, -80],
    hill: '#24382e', ground: ['#5a7a4a', '#3a4a34', '#7a7058'], tint: 'rgba(180,200,220,.05)', bscale: 1.0,
    props: [['pine', 300, 300], ['reeds', 1300, 120], ['pier', 1700, 110], ['canoe', 1950, 60, (f, back) => !f.crossed || back], ['signboard', 620, 120], ['reeds2', 3000, 120], ['pine', 4500, 320]],
    buildings: [['lumber_hut', 700, 1.3], ['lumber_hut', 3900, 1.2]],
    npcs: [
      { id: 'aiyana', name: '舟づくりのアヤナ', actor: 'forager', x: 1150, face: 1 },
      { id: 'gord', name: '向こう岸のゴード', actor: 'wrench', x: 3600, face: -1 }
    ],
    places: [
      { id: 'notice', name: '渡し場の札', x: 600, verb: '読む' },
      { id: 'canoe', name: '桟橋のカヌー', x: 1900, verb: '漕ぐ' },
      { id: 'pine1', name: '岸の一本杉', x: 4400, verb: '見る' }
    ],
    weather: { clear: 5, fog: 3, drizzle: 2 },
    animals: [['duck', 1400], ['duck', 2700], ['dog_husky', 3300], ['hawk', 2200, { mode: 'fly' }]],
    talk: {
      notice(S) {
        if (S.back) return [['me', '', '（「渡し舟　休み」の札の下に、新しい紙。「カヌー、貸します。漕ぎ方は、アヤナに」）']];
        return [['me', '', '（「渡し舟　休み。船頭、腰痛のため」）'], ['me', '', '（湖の向こうに、道の続きが見える。……ぐるりと回れば、三日はかかりそうだ）']];
      },
      aiyana(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', '帰りは、だれにも教わらずに、まっすぐ来たね。'], ['npc', 'normal', '……札に、わたしの名前を書いておいた。漕ぎ方は、アヤナにって。教えるの、けっこう好きみたい。']];
        if (f.crossed) return [['npc', 'normal', '渡れたね。帰りも、同じように。']];
        if (f.spun) { f.tip = true;
          return [['npc', 'normal', 'ぐるぐる回ってたね。見てたよ。'], ['npc', 'normal', '初めての人は、みんなパドルを見るの。水をかく手もとばかり。'], ['npc', 'normal', '向こう岸の、一本杉を見て。目を離さずに漕げば、舟はそっちへ行く。']]; }
        if (f.aiyanaTold) return [['npc', 'normal', 'カヌーは桟橋。だいじょうぶ、ひっくり返っても、この湖は浅いから。……たぶん。']];
        f.aiyanaTold = true;
        return [['npc', 'normal', '向こうへ渡りたいの？ 渡し舟は、船頭さんの腰が治るまで休み。'], ['npc', 'normal', 'わたしの作ったカヌーなら、貸してあげる。漕ぐのは、あなた。'], ['npc', 'normal', '……教える？ うーん、まずは、自分でやってみて。']];
      },
      canoe(S) {
        const f = S.f;
        if (S.back) return [['me', '', '（カヌーで、西の岸へ戻る。一本杉の代わりに、アヤナの小屋の煙を見て漕ぐ）'], ['me', '', '（舟は、まっすぐ進んだ）'], ['insight', '', '手もとを見るのをやめたら、舟はまっすぐ進んだ。']];
        if (!f.aiyanaTold) return [['me', '', '（細長い木のカヌーが、桟橋につないである。パドルが一本）']];
        if (f.crossed) return [['me', '', '（カヌーは、向こう岸の桟橋に、ちゃんとつないである）']];
        if (!f.tip) { f.spun = true;
          return [['me', '', '（カヌーに乗って、右、左と漕ぐ。……舟が、くるりと回った）'], ['me', '', '（もう一度。……また回った。三回まわって、桟橋に戻ってきてしまった）']]; }
        f.crossed = true;
        return [['me', '', '（向こう岸の一本杉を見る。手もとは見ない）'], ['me', '', '（ひとかき、ひとかき。……舟が、杉のほうへ、すうっと進んでいく）'], ['me', '', '（気づくと、向こう岸の桟橋に着いていた）']];
      },
      gord(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', 'また漕いでいくのかい。渡し舟より、そっちのほうが早いんじゃないか。']];
        if (f.crossed) return [['npc', 'normal', 'おや、カヌーで来たのかい。アヤナの舟だな。'], ['npc', 'normal', 'あの子、自分の舟に人を乗せるのは、これが初めてだよ。'], ['npc', 'normal', '「人に教えるのは苦手」って言ってたが。……ちゃんと渡ってきたじゃないか。']];
        return [['npc', 'normal', 'おや、歩いて回ってきたのかい？ 三日の道を？ ……顔が、ちっとも疲れておらんな。']];
      },
      pine1(S) {
        const f = S.f;
        if (S.back) return [['me', '', '（一本杉の根もとに、カヌーの形の小さな彫り物が置いてある。だれかの目印らしい）']];
        return [['me', '', '（湖から見えた一本杉。近くで見ると、ずいぶん曲がっている）'], ['me', '', '（……遠くからだと、まっすぐに見えたのに）']];
      }
    }
  });

// ---------------------------------------------------------------- 30 茶の審判（向かいあう二軒の茶店に、どちらがうまいか決めてくれと頼まれる）
  C.push({
    id: 'formosa', shape: '旅人が審判を頼まれる', name: 'フォルモサ', sub: '茶店の坂道', time: 'dusk', screens: 5, far: 'bamboo', timeBack: 'morning', map: [24.8, 121.5],
    hill: '#24382a', ground: ['#7a7a4a', '#4a4a30', '#8a7a58'], tint: 'rgba(255,190,120,.05)', bscale: 1.0,
    props: [['stone_lantern', 300, 170], ['bush', 1400, 90], ['stone_lantern', 2700, 170], ['bush', 4200, 100], ['tea_table', 1700, 70], ['tea_tree', 4300, 210], ['lantern_pole', 1800, 230, (f, back) => back && f.judged]],
    buildings: [['cn_paifang', 500, 0.9], ['cn_teahouse', 1350, 0.85], ['cn_teahouse', 2250, 0.85], ['cn_house', 3700, 0.9]],
    npcs: [
      { id: 'lin', name: '林じいさん（老舗の茶店）', actor: 'cn_elder', x: 1250, face: 1 },
      { id: 'meilin', name: 'メイリン（向かいの茶店）', actor: 'qipao', x: 2100, face: -1 },
      { id: 'hao', name: '書生のハオ', actor: 'boyscholar', x: 3200, face: -1 }
    ],
    places: [
      { id: 'cups', name: '二つの茶碗', x: 1700, verb: '飲む', when: f => f.linAsk && f.meilinAsk },
      { id: 'bush', name: '坂の上の古い茶の木', x: 4300, verb: '見る' }
    ],
    weather: { clear: 5, drizzle: 3, fog: 2 },
    animals: [['cat_siamese', 1700], ['crow', 3500]],
    talk: {
      lin(S) {
        const f = S.f;
        if (S.back && f.judged) return [['npc', 'normal', '提灯は、坂の真ん中に一つだけ吊るした。二軒のあいだにな。'], ['npc', 'normal', '……あの子の店の湯は、わしの店の湯より、少しぬるい。それが、わしより上手なところだ。']];
        if (S.back) return [['npc', 'normal', '提灯は、どちらの店にも吊るさなんだ。……来年も、同じことをするだろうな。']];
        if (f.judged) return [['npc', 'normal', '……同じ味、か。'], ['npc', 'normal', '三年、口をきかなんだのに。木だけは、ふたりで分けておったわけだ。']];
        if (f.linAsk) return [['npc', 'normal', '飲みくらべてくれ。あんたは、この坂のだれとも親戚じゃない。']];
        f.linAsk = true;
        return [['npc', 'normal', '旅の人、ちょうどいい。この茶を飲んでくれ。うちは、この坂で百年の店だ。'], ['npc', 'normal', '今夜の灯籠祭りでな、坂でいちばんの茶店に、赤い提灯を一つだけ吊るす。'], ['npc', 'normal', '向かいの店と、どちらがうまいか。……あんたに決めてもらいたい。']];
      },
      meilin(S) {
        const f = S.f;
        if (S.back && f.judged) return [['npc', 'normal', '父さんの店で、朝のお茶をいれてきたの。三年ぶり。'], ['npc', 'normal', '……湯が熱すぎるって、また言われた。言われて、ちょっとうれしかった。']];
        if (S.back) return [['npc', 'normal', '提灯、どちらにも吊るされなかったの。……それで、よかったのかも。']];
        if (f.judged) return [['npc', 'normal', '同じ……？ ……そう。そうよね。']];
        if (f.meilinAsk) return [['npc', 'normal', 'あっちの店の茶より、うちのほうが、香りが立つはずよ。']];
        f.meilinAsk = true;
        return [['npc', 'normal', '旅の人、うちのお茶も飲んで。向かいの古い店より、ずっと香りがいいから。'], ['npc', 'normal', '……向かいは、父の店。三年前に、けんかして出てきたの。それきり、口をきいてない。'], ['npc', 'normal', '提灯をもらえたら、父も、わたしの茶を認めるでしょう。']];
      },
      hao(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', 'けさは、坂の上の茶の木の下に、林さんとメイリンさんが並んでいましたよ。'], ['npc', 'normal', '……摘む場所で、また言いあっていましたけどね。']];
        if (f.haoTold) return [['npc', 'normal', '坂の上の古い木を、見ていくといいですよ。']];
        f.haoTold = true;
        return [['npc', 'normal', '二軒の茶比べですか。毎年、だれも決められないんです。'], ['npc', 'normal', 'ぼくは、坂の上で詩を書いていますが……おもしろいことに気づきました。'], ['npc', 'normal', '坂の上の古い茶の木に、朝はメイリンさん、夕方は林さんが来るんです。おたがい、時間をずらして。']];
      },
      bush(S) {
        const f = S.f;
        if (S.back) return [['me', '', '（古い茶の木の根もとに、湯のみが二つ並べて置いてある）']];
        f.bushSeen = true;
        return [['me', '', '（坂の上に、太い幹の茶の木が一本。百年は立っていそうだ）'], ['me', '', '（東側の枝には、朝露の残る若い芽。西側の枝は、ていねいに摘んだあと）'], ['me', '', '（一本の木の、右と左から、二人がそれぞれ摘んでいるらしい）']];
      },
      cups(S) {
        const f = S.f;
        if (S.back && f.judged) return [['me', '', '（坂の真ん中の台に、茶碗が二つ。だれかが、片方の湯を、もう片方に少しだけ足していった）']];
        if (f.judged) return [['me', '', '（茶碗は、二つとも、からになっている）']];
        if (!f.bushSeen) return [['me', '', '（二つの茶碗から、湯気が立っている。……どちらも、いい香りだ）'], ['me', '', '（飲みくらべてみる。……どちらも、おいしい。でも、ちがいが、よく分からない）'], ['me', '', '（もう少し、坂の上のほうも見てこようか）']];
        f.judged = true;
        return [['me', '', '（二つの茶碗を、もう一度、ゆっくり飲みくらべる）'], ['me', '', 'どちらも、同じ味がします。坂の上の、あの古い木の味です。'], ['me', '', '（林じいさんとメイリンが、同時に顔を上げた。……そして、同時に目をそらした）'], ['insight', '', '勝ち負けを決めに来た舌は、同じ一本の木の味しか見つけられなかった。']];
      }
    }
  });

// ---------------------------------------------------------------- 31 石を積む（嵐で崩れた霧の道しるべを、村じゅうで積み直す）
  C.push({
    id: 'islanda', shape: 'みんなで道しるべを作る', name: 'アイスラ', sub: '霧の高原', time: 'noon', screens: 5, far: 'highland', map: [64.6, -19],
    weatherBack: { fog: 6, densefog: 2 },
    hill: '#2e3a34', ground: ['#5a6a50', '#3a443a', '#6a6a58'], tint: 'rgba(210,220,230,.06)', bscale: 1.0,
    props: [['rock_moss', 400, 90], ['rune_stone', 1350, 120], ['rock', 2200, 70], ['rock2', 3000, 90], ['rock_moss', 3950, 100], ['stone_chapel', 4600, 230], ['cairn_broken', 2500, 70, f => !f.cairn1], ['cairn_built', 2500, 120, f => f.cairn1], ['cairn_broken', 3600, 70, f => !f.cairn2], ['cairn_built', 3600, 130, f => f.cairn2]],
    buildings: [['nordic_red', 700, 0.9]],
    npcs: [
      { id: 'valdis', name: '道守りのヴァルディス', actor: 'smith', x: 950, face: 1 },
      { id: 'sigga', name: 'シッガ', actor: 'parka', x: 1700, face: -1 },
      { id: 'bjorn', name: '郵便馬のビョルン', actor: 'cowboy', x: 4100, face: -1 }
    ],
    places: [
      { id: 'cairn1', name: '崩れた石の山', x: 2500, verb: '積む' },
      { id: 'cairn2', name: 'いちばん東の石の山', x: 3600, verb: '積む', when: f => f.cairn1 }
    ],
    weather: { clear: 4, wind: 3, fog: 3 },
    animals: [['sheep', 1200], ['sheep', 1350], ['horse_bay', 4300, { mode: 'stay', face: -1 }], ['crow', 3300]],
    talk: {
      valdis(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', '霧の中を、迷わずに戻ってきたね。……あんたの積んだ山の前を通ったろう。']];
        if (f.cairn2) return [['npc', 'normal', '東の端まで積んでくれたのかい。……これで、道がつながった。']];
        if (f.valdisTold) return [['npc', 'normal', '石は、手で持てる大きさでいい。大きな石ほど、すぐ崩れる。']];
        f.valdisTold = true;
        return [['me', '', '（大きな女の人が、石を両腕に抱えて、道ばたに積んでいる）'], ['npc', 'normal', 'ゆうべの嵐で、道しるべの石の山が、ほとんど崩れた。'], ['npc', 'normal', '霧が出ると、この高原は道が消える。石の山だけが頼りなんだ。'], ['npc', 'normal', 'この道を通る人は、ひとり一つ、石を積んでいく決まりさ。旅の人も、たのむよ。']];
      },
      sigga(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', 'ゆうべ、霧の中でビョルンさんの馬の鈴が聞こえたの。ちゃんと村まで来たよ！']];
        if (f.cairn1) return [['npc', 'normal', 'わたしの石、あなたの石の上に乗せた！ いちばん上は、小さいのがいいんだって。']];
        return [['npc', 'normal', 'わたしも一つ積んだよ。……ちょっと、斜めだけど。'], ['npc', 'normal', '今夜、郵便の馬が東から来るの。パパの手紙が乗ってるはず。'], ['npc', 'normal', '道しるべがないと、馬は霧の中で迷っちゃう。……いちばん東の山は、まだだれも積みに行ってないの。']];
      },
      cairn1(S) {
        const f = S.f;
        if (S.back) return [['me', '', '（霧の中に、石の山がぼんやり浮かんでいる。……わたしの積んだ石だ）'], ['me', '', '（次の山が、霧の向こうにかすかに見える。そちらへ歩く）']];
        if (f.cairn1) return [['me', '', '（石の山が、腰の高さまで戻った）']];
        f.cairn1 = true;
        return [['me', '', '（手で持てるくらいの石を探して、崩れた山の上に一つずつ置く）'], ['me', '', '（三つ目で、ぐらりとした。四つ目は、平たい石にした）'], ['me', '', '（腰の高さまで戻った。……次の山は、もっと東だ）']];
      },
      cairn2(S) {
        const f = S.f;
        if (S.back) return [['me', '', '（霧で、何も見えない。……石の山だけが、灰色の影になって立っている）'], ['me', '', '（その影から影へ、歩いていく）'], ['insight', '', '自分で積んだ石に、帰り道の霧の中で、道を教わった。']];
        if (f.cairn2) return [['me', '', '（いちばん東の石の山。てっぺんに、小さな白い石を乗せておいた）']];
        f.cairn2 = true;
        return [['me', '', '（いちばん東の石の山は、跡形もなく崩れている。……ひとりで、一から積む）'], ['me', '', '（指が冷たくなるころ、ようやく胸の高さになった）'], ['me', '', '（てっぺんに、白い小石を一つ。霧の中でも、見えるように）']];
      },
      bjorn(S) {
        const f = S.f;
        if (S.back && f.cairn2) return [['npc', 'normal', 'ゆうべは、ひどい霧だった。だが、いちばん東の山に白い石が見えてな。'], ['npc', 'normal', 'あれを目印に、馬が自分で道を思い出した。……あれを積んだのは、あんたか。']];
        if (S.back) return [['npc', 'normal', 'ゆうべは霧で、いちばん東で引き返した。手紙は、あしたになる。']];
        return [['npc', 'normal', '郵便馬のビョルンだ。今夜、西の村へ手紙を届ける。'], ['npc', 'normal', '……東の道しるべが崩れていたら、霧の夜は引き返すしかない。それが、この高原の決まりだ。']];
      }
    }
  });

  
// ---------------------------------------------------------------- 32 葉っぱの願いごと（願いのない旅人が、願いを一つ流す）
  C.push({
    id: 'malaya', shape: '旅人が自分の願いに気づく', name: 'マラヤナ', sub: 'ほたるの川', time: 'night', screens: 5, far: 'firefly_forest_night', map: [3.4, 101.3],
    hill: '#14241a', ground: ['#3a5a3a', '#243424', '#4a5a40'], tint: 'rgba(60,120,80,.08)', bscale: 1.0,
    props: [['palm', 400, 300], ['reeds', 1600, 120], ['ship_boat', 2300, 80], ['reeds2', 3200, 120], ['palm', 4400, 320], ['leaf_boats', 1900, 45]],
    buildings: [['stilt_house', 800, 0.9], ['sea_stilt', 3800, 0.9]],
    npcs: [
      { id: 'aisha', name: 'アイシャ', actor: 'tribekid', x: 1100, face: 1 },
      { id: 'halim', name: '舟こぎのハリム', actor: 'fisherboy', x: 2600, face: -1 },
      { id: 'laks', name: 'ラクシュミおばさん', actor: 'sari', x: 3500, face: -1 }
    ],
    places: [{ id: 'leaves', name: '川に浮かぶ葉っぱ', x: 1900, verb: '読む' }],
    weather: { clear: 6, drizzle: 3 },
    animals: [['duck', 1500], ['owl', 3000, { mode: 'stay' }], ['cat_black', 4200]],
    talk: {
      aisha(S) {
        const f = S.f;
        if (S.back && f.wished) return [['npc', 'normal', 'ほら、言ったとおり！ 帰り道も、ここを通ったでしょ。'], ['npc', 'normal', 'あなたの葉っぱの願い、ちゃんとかなったね。……いちばん簡単な願いだったけど。']];
        if (S.back) return [['npc', 'normal', '願いなしで通った旅の人、あなたが初めて。……ちょっと、くやしい。']];
        if (f.wished) return [['npc', 'normal', '流れたね！ ほたるが、葉っぱのまわりに集まってた。']];
        if (f.aishaTold) return [['npc', 'normal', '願いがない人なんて、いないよ。言わないだけ。']];
        f.aishaTold = true;
        return [['npc', 'normal', '旅の人！ 願いの葉っぱ、まだでしょ？'], ['npc', 'normal', 'この川ではね、旅の人は、葉っぱに願いを一つ書いて流すの。ほたるが、海まで運んでくれる。'], ['me', '', '……願い、ないかも。'], ['npc', 'normal', 'ええっ。……それ、ここの川では、いちばん困ること。'], ['npc', 'normal', '葉っぱを流さずに行った旅人は、ほたるに顔を覚えてもらえないの。帰り道で、この川が見つからなくなるんだって。']];
      },
      leaves(S) {
        const f = S.f;
        if (S.back) return [['me', '', '（ほたるが、川面の葉っぱを照らしている。きょうも、新しい願いが流れていく）']];
        f.leavesRead = true;
        return [['me', '', '（川面に、葉っぱの舟が流れていく。ほたるの光で、字が読める）'], ['me', '', '（「雨が、ちょうどよく降りますように」「ばあちゃんの足が、また歩けますように」）'], ['me', '', '（「あしたも、この川で舟をこげますように」）'], ['me', '', '（……大きな願いより、あしたも同じことができますように、が多い）']];
      },
      halim(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', 'あんたの葉っぱ、河口のマングローブに引っかかってたよ。海まで、もう少しだったな。'], ['npc', 'normal', '……かなった願いは、海まで行かなくていいんだと。ばあちゃんがそう言ってた。']];
        if (f.halimTold) return [['npc', 'normal', '書いたら、ここから流しな。おれが、真ん中まで舟で押してやる。']];
        f.halimTold = true;
        return [['npc', 'normal', '舟こぎのハリムだ。あしたも、この川で舟をこげますように。……それが、おれの毎晩の願い。'], ['npc', 'normal', '旅の人の願いは、たいてい大きい。見つけたい、会いたい、帰りたい。'], ['npc', 'normal', 'あんたは、どれだい。']];
      },
      laks(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', '帰りにもまた寄ってくれたね。……ほたるより、よく光る顔をしてるよ。']];
        if (f.wished) return [['npc', 'normal', 'いい願いね。……それはね、願いというより、決心に近いのよ。']];
        if (!f.leavesRead) return [['npc', 'normal', 'まずは、ほかの人の葉っぱを読んでごらん。願いの大きさは、だいたいみんな同じよ。']];
        f.wished = true;
        return [['npc', 'normal', '書けたかい？ ……まだ？ そう。'], ['npc', 'normal', 'あなた、この川に来るまで、何をしてたの？'], ['me', '', '……歩いてました。ずっと。'], ['npc', 'normal', 'それで、あしたは？'], ['me', '', '……あしたも、歩きたい。帰り道も、この川を通りたい。'], ['npc', 'normal', 'ほら、あるじゃない。願い。'], ['me', '', '（葉っぱに「帰り道も、ここを通れますように」と書いて、川に流した）'], ['insight', '', '願いがないと思っていたのは、歩きつづけたい気持ちに、名前をつけていなかっただけだった。']];
      }
    }
  });

// ---------------------------------------------------------------- 33 ベンチの本（落とし物だと思って持ち歩いた本は、一年続いた文通の、最初の「会いましょう」だった）
  C.push({
    id: 'yorka', shape: '旅人の勘違いで起きた騒ぎ', name: 'ニューヨルカ', sub: '夜の摩天楼', time: 'night', screens: 5, far: 'city_lights_night', timeBack: 'morning', map: [40.7, -74],
    hill: '#1a1a2a', ground: ['#5a5a60', '#3a3a40', '#6a6a70'], tint: 'rgba(80,80,140,.06)', bscale: 1.0,
    props: [['stool2', 800, 40], ['ship_lantern', 1000, 150], ['tree_green', 2300, 260], ['ship_lantern', 3700, 150]],
    buildings: [['city_building', 450, 0.9], ['uk_terrace', 1500, 0.9], ['inn', 3100, 0.9], ['city_building', 4300, 0.85]],
    npcs: [
      { id: 'nick', name: '新聞売りのニック', actor: 'courier', x: 1250, face: -1 },
      { id: 'ruth', name: 'ルース', actor: 'doctor', x: 2700, face: -1 },
      { id: 'arthur', name: 'アーサーじいさん', actor: 'scholar', x: 4000, face: -1 }
    ],
    places: [
      { id: 'bench', name: '街灯の下のベンチ', x: 850, verb: '見る', when: f => !(f.bookTaken && f.ruthTold && !f.bookBack) },
      { id: 'bench2', name: '街灯の下のベンチ', x: 850, verb: '本を戻す', when: f => f.bookTaken && f.ruthTold && !f.bookBack }
    ],
    weather: { clear: 6, drizzle: 3, fog: 1 },
    animals: [['dog_pug', 1700], ['crow', 3500], ['cat_black', 4400]],
    talk: {
      bench(S) {
        const f = S.f;
        if (S.back) return [['me', '', '（ベンチには、だれもいない。座面に、二冊の本が並べて置いてある）'], ['me', '', '（一冊ずつ、しおりが一本ずつ。……きょうは、二人で読んでいるらしい）']];
        if (f.bookBack) return [['me', '', '（ベンチの上に、本が一冊。押し花の紙が、少しだけはみ出している）']];
        if (f.bookTaken) return [['me', '', '（ベンチの上は、からっぽ）']];
        f.bookTaken = true;
        return [['me', '', '（街灯の下のベンチに、本が一冊、置き忘れてある）'], ['me', '', '（ページのあいだに、押し花と、小さな紙。「あしたの朝、ここで」）'], ['me', '', '（……大事なものかもしれない。持ち主を探そう）']];
      },
      bench2(S) {
        const f = S.f;
        f.bookBack = true;
        return [['me', '', '（本を、もとの場所に、もとの向きで置く。しおりの紙も、そのまま）'], ['me', '', '（街灯が、ちかちかと一度だけまたたいた）']];
      },
      nick(S) {
        const f = S.f;
        if (S.back && f.bookBack) return [['npc', 'normal', 'けさ、ベンチに二人座ってたよ。白い髪のじいさんと、白いコートのおばさん。'], ['npc', 'normal', '……一年、毎晩すれちがってたのにさ。話しはじめたら、新聞が売れないくらい長かった。']];
        if (S.back) return [['npc', 'normal', 'けさ、白いコートのおばさんが、ベンチでずっと待ってたよ。……だれも来なかったけど。']];
        if (f.bookTaken) return [['npc', 'normal', 'その本？ ベンチの？ ……あーあ、持ってきちゃったのか。'], ['npc', 'normal', 'あれは落とし物じゃない。この街の「置き本」だよ。読んだら置いて、次の人が持っていく。'], ['npc', 'normal', 'でもあのベンチのは、ちょっと特別でね。……同じ二人が、一年も交換してるんだ。']];
        return [['npc', 'normal', '夕刊だよ！ ……旅の人、この街は初めて？ 夜はベンチに座ると、星より街灯がよく見えるよ。']];
      },
      ruth(S) {
        const f = S.f;
        if (S.back && f.bookBack) return [['npc', 'normal', '会えたの。けさ。……思ってたより、ずっとおじいさんだった。'], ['npc', 'normal', '向こうも、「思ってたより、ずっと口が悪い」って。……一年分、本の余白で話してたのにね。'], ['insight', '', '落とし物だと思って持ち歩いた一冊は、一年かけてやっと書けた「会いましょう」だった。']];
        if (S.back) return [['npc', 'normal', 'けさ、ベンチで待ってたの。……来なかった。'], ['npc', 'normal', 'きっと、わたしの返事を読まなかったのね。本が、なかったもの。']];
        if (f.ruthTold) return [['npc', 'normal', 'その本、ベンチに戻してくれる？ ……もとの向きで。向きにも、意味があるの。']];
        if (!f.bookTaken) return [['npc', 'normal', 'こんばんは。……ベンチの本、もう読んだ？ いいえ、なんでもないの。']];
        f.ruthTold = true;
        return [['npc', 'normal', 'あっ……その本！'], ['npc', 'normal', '……ごめんなさい。それ、わたしが置いたの。一年前から、あのベンチで、だれかと本を交換してる。'], ['npc', 'normal', '顔は知らないの。余白に感想を書いて、置いていくだけ。'], ['npc', 'normal', '今夜はじめて、「あしたの朝、ここで」って書いたのに。……相手がまだ読んでいなかったのね。']];
      },
      arthur(S) {
        const f = S.f;
        if (S.back && f.bookBack) return [['npc', 'normal', '会ったよ。……一年、余白の字だけで、若い娘さんだと思っておった。'], ['npc', 'normal', '向こうも、同じように思っておったそうだ。……ふたりで、ずいぶん笑った。']];
        if (S.back) return [['npc', 'normal', 'ゆうべ、ベンチの本がなかった。一年で、初めてだ。……向こうが、やめたのかもしれん。']];
        if (f.bookBack) return [['npc', 'normal', 'さて、夜の散歩だ。……ベンチの本を、読みにな。']];
        return [['npc', 'normal', 'わしは毎晩、この時間にベンチへ行く。本を一冊読みにな。'], ['npc', 'normal', 'だれが置いていくのかは、知らん。知らんほうが、いい本もある。'], ['npc', 'normal', '……今夜は、少し遅れた。まだ、あるといいんだが。']];
      }
    }
  });

  
// ---------------------------------------------------------------- 34 昔話の続き（行きに途中まで聞いた昔話の終わりを、帰りに聞く。それは本当の話だった）
  C.push({
    id: 'sakha', shape: '昔話の続きが本当だった', name: 'シベリカ', sub: '凍土の村', time: 'dusk', screens: 5, far: 'tundra_noon', map: [62, 129.7],
    hill: '#2a2a34', ground: ['#a8aca8', '#7a7e7a', '#c0c4c0'], tint: 'rgba(200,210,240,.06)', bscale: 1.0,
    props: [['pine', 400, 280], ['haystack', 1500, 110], ['pine', 3200, 300], ['rock', 4300, 70]],
    buildings: [['yurt_smoke', 800], ['stable', 2000, 0.9], ['yurt', 4000, 0.9]],
    npcs: [
      { id: 'tuyara', name: '語りのトゥヤーラ', actor: 'eskimo', x: 1050, face: 1 },
      { id: 'erel', name: 'エレル', actor: 'chullo', x: 1350, face: -1 },
      { id: 'aikhal', name: '馬飼いのアイハル', actor: 'herdboy', x: 2450, face: -1 }
    ],
    places: [{ id: 'westhorse', name: '西へ歩く白い馬', x: 3600, verb: '見る' }],
    weather: { clear: 4, snow: 4, wind: 2 },
    animals: [['horse', 3700, { mode: 'stay', face: -1, back: 'not' }], ['horse', 1250, { mode: 'stay', back: 'only' }], ['horse_bay', 2200, { mode: 'stay' }], ['dog_husky', 1600]],
    talk: {
      tuyara(S) {
        const f = S.f;
        if (S.back && f.westSeen) { f.taleEnd = true;
          return [['npc', 'normal', '旅の人、帰ってきたね。……約束だ、続きを話そう。'], ['npc', 'normal', '白い馬は、西へ西へ歩いた。主人が最後に火をたいた、川べりの古い野営地まで。'], ['npc', 'normal', '主人はもういない。それでも馬は、毎晩そこで夜を明かして、朝になると村へ帰ってきた。'], ['npc', 'normal', '……その主人はね、わたしの夫。馬は、いまもいる。'], ['me', '', '（……ゆうべ、西へ歩いていった、あの白い馬だ）'], ['insight', '', '昔話だと思って聞いていた白い馬は、ゆうべ、わたしのそばを歩いていった。']]; }
        if (S.back) return [['npc', 'normal', '帰ってきたね。続き？ ……西で、白い馬を見なかったかい。見ていないなら、まだ話せないね。']];
        if (f.taleStart) return [['npc', 'normal', '続きは、帰ってきた人にだけ。それが、この村の昔話の決まり。']];
        f.taleStart = true;
        return [['me', '', '（ゆるい煙の立つ家の前で、女の人が、子どもたちに何か話している）'], ['npc', 'normal', '……そうして白い馬は、主人の帰りを待たずに、ひとりで西へ歩きだした。'], ['npc', 'normal', 'さあ、きょうは、ここまで。'], ['npc', 'normal', '旅の人も聞いていたね。続きは、帰りにここを通ったら話してあげる。昔話の続きは、帰ってきた人にしか話さないの。']];
      },
      erel(S) {
        const f = S.f;
        if (S.back && f.taleEnd) return [['npc', 'normal', '旅の人、ずるい！ ぼく、一年待っても続きを聞けなかったのに。'], ['npc', 'normal', '……ぼくも大きくなったら、西まで歩いて帰ってくる。そしたら、話してもらえる。']];
        if (S.back) return [['npc', 'normal', '続き、聞いた？ ぼく、まだ聞いてない。']];
        return [['npc', 'normal', 'トゥヤーラおばさんの昔話、いつも、いいところで終わるんだ。'], ['npc', 'normal', '続きを聞けるのは、旅に出て、帰ってきた人だけ。……ずるいよね。']];
      },
      aikhal(S) {
        const f = S.f;
        if (S.back && f.taleEnd) return [['npc', 'normal', 'あの白いの、おばさんの旦那さんの馬だったのか。……市には、出さないことにした。'], ['npc', 'normal', '西の川べりまで、毎晩おれがついていく。迷わないように。……迷ったこと、ないけどさ。']];
        if (S.back) return [['npc', 'normal', '白いのは、けさも村へ帰ってきた。……あしたの市で、売られちゃうけど。']];
        return [['npc', 'normal', '馬を見に来たのかい。……西に、白いのが一頭いただろう。'], ['npc', 'normal', 'あいつだけは、つないでも綱をほどく。夕方になると、決まって西へ歩いていく。'], ['npc', 'normal', '朝には戻ってくるから、だれも止めない。……どこへ行くのかは、おれも知らない。'], ['npc', 'normal', 'でも、群れを乱すからって、あさっての市で売ることになった。年寄りだし、しかたないって、大人たちが。']];
      },
      westhorse(S) {
        const f = S.f;
        if (S.back) return [['me', '', '（白い馬の足あとが、雪の上に、西から東へ続いている）']];
        f.westSeen = true;
        return [['me', '', '（年とった白い馬が、ひとりで、ゆっくり西へ歩いていく）'], ['me', '', '（夕日のほうへ。ふり返りもしない）'], ['me', '', '（……どこへ行くんだろう）']];
      }
    }
  });

// ---------------------------------------------------------------- 35 ひと皿多い食卓（毎晩ひとり分多く用意する家に、二十年ぶりの客が来る）
  C.push({
    id: 'jawa', shape: '空けておいた席に座る', name: 'ジャワナ', sub: '火山のふもと', time: 'dusk', screens: 5, far: 'volcano', timeBack: 'morning', map: [-7.6, 110.4],
    hill: '#2a2420', ground: ['#6a6a48', '#4a4434', '#7a7458'], tint: 'rgba(255,140,90,.06)', bscale: 1.0,
    props: [['palm', 350, 300], ['rice_basket', 1250, 60], ['bush', 2200, 90], ['palm', 3300, 320], ['haystack', 4300, 110]],
    buildings: [['stilt_house', 900, 0.9], ['sea_stall', 2700, 0.9], ['thatched_farm', 3900, 0.9]],
    npcs: [
      { id: 'budi', name: 'ブディ', actor: 'islandboy', x: 600, face: 1 },
      { id: 'sari', name: 'サリ（ブディの母）', actor: 'wa_woman', x: 1450, face: -1 },
      { id: 'nur', name: 'ヌルばあちゃん', actor: 'fisher_granny', x: 1900, face: -1 }
    ],
    places: [
      { id: 'ash', name: '灰をかぶった田', x: 3200, verb: '見る' },
      { id: 'table', name: '軒下の食卓', x: 1150, verb: '座る', when: f => f.sariTold }
    ],
    weather: { clear: 5, drizzle: 3, wind: 2 },
    animals: [['rooster', 2300], ['hen', 2420], ['cat_calico', 3600], ['crow', 4100]],
    talk: {
      budi(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', 'けさ、母ちゃんが自分で、お皿を一枚多く出してた！ ……ばあちゃんより先に。']];
        if (f.ate) return [['npc', 'normal', 'ほらね、来たでしょ。ばあちゃんの言ったとおり！']];
        if (f.budiTold) return [['npc', 'normal', '旅の人、もうすぐ晩ごはん！ 食べていって！']];
        f.budiTold = true;
        return [['me', '', '（男の子が、道のまんなかで、こちらに向かって両手をふっている）'], ['npc', 'normal', '旅の人！ ほんものの旅の人だ！ ……来て、来て！'], ['npc', 'normal', 'うちはね、毎晩、お皿を一枚多く出すの。だれか来たときのために。'], ['npc', 'normal', '……でも、ぼくが生まれてから、だれも来たことないんだ。']];
      },
      sari(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', 'お皿、けさはわたしが出したの。……来ない夜のほうが多いのは、分かってる。'], ['npc', 'normal', 'でも、出しておくと、今夜はだれか来るかもしれないって、少しだけ思える。']];
        if (f.ate) return [['npc', 'normal', 'ごはん、足りた？ ……今年は少ないの。灰のせいで。'], ['npc', 'normal', 'それでも、あなたの分が残ってて、よかった。']];
        if (f.sariTold) return [['npc', 'normal', '座って。……今夜だけは、遠慮しないで。']];
        if (!f.budiTold) return [['npc', 'normal', '晩ごはんの支度中なの。ごめんなさいね。']];
        f.sariTold = true;
        return [['npc', 'normal', 'ブディ、また旅の人を……あら、本当に旅の人。'], ['npc', 'normal', '……ちょうど、今夜でやめようと話していたの。そのお皿。'], ['npc', 'normal', '去年の噴火の灰で、お米が半分しかとれなかった。二十年、だれも来なかったお皿に、よそう余裕はないって。'], ['npc', 'normal', '……でも、来ちゃったわね。どうぞ、軒下の食卓へ。']];
      },
      nur(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', '娘が、お皿を出しておった。……わしは、もう出さんでいいようだね。']];
        if (f.ate) return [['npc', 'normal', '五十年前、わしの夫も、こうして来たんだよ。噴火から逃げてきた、行き場のない旅の人でね。'], ['npc', 'normal', 'あの晩、この家には、よそう皿が一枚も余っていなかった。母は、自分の分を半分にして出した。'], ['npc', 'normal', '……お皿は、客のために出すんじゃない。自分たちも、昔は客だったことを、忘れんために出すんだよ。'], ['insight', '', '二十年あいていた席は、わたしのためではなく、この家の昔の旅人のためにあった。']];
        return [['npc', 'normal', '……娘が、お皿をやめると言うてね。わしは、やめんと言うた。'], ['npc', 'normal', 'どちらも、まちがってはおらん。今年は、お米が少ない。']];
      },
      ash(S) {
        if (S.back) return [['me', '', '（灰をかぶった田の端に、青い苗が少しだけ、植え直されている）']];
        return [['me', '', '（田んぼが、灰色の粉をかぶっている。稲は、半分ほど倒れたままだ）'], ['me', '', '（遠くの山から、細い煙がまだ上がっている）']];
      },
      table(S) {
        const f = S.f;
        if (S.back) return [['me', '', '（朝の食卓に、お皿が五枚。欠けたお皿にだけ、まだ何ものっていない）'], ['me', '', '（……今夜、だれか来るかもしれない）']];
        if (f.ate) return [['me', '', '（食卓の上に、きれいに空になったお皿が一枚）']];
        f.ate = true;
        return [['me', '', '（軒下の食卓に、お皿が五枚。……一枚だけ、ほかより古い。ふちが少し欠けている）'], ['me', '', '（そのお皿に、ご飯と、豆と、焼いた魚が少しずつ、よそわれた）'], ['me', '', '（ブディが、こっちをじっと見ている。ひと口食べると、満足そうにうなずいた）']];
      }
    }
  });

  
// ---------------------------------------------------------------- 36 広場の取り合い（小さい子と大きい子が、日曜の広場をサッカーで取り合う。旅人がキーパーにされる）
  C.push({
    id: 'boca', shape: '旅人が子どもの遊びに入る', name: 'アルゼンタ', sub: '色とりどりの港町', time: 'noon', screens: 5, far: 'harbor_morning', map: [-34.6, -58.4],
    hill: '#3a3040', ground: ['#8a7a6a', '#5a4a40', '#9a8a78'], tint: 'rgba(255,220,180,.04)', bscale: 1.0,
    props: [['stool2', 1200, 40], ['bollard', 2500, 60], ['wall_flowers', 3300, 110], ['ship_barrels', 4400, 100]],
    buildings: [['ar_boca', 600], ['ar_boca', 1500, 0.95], ['ar_estancia', 3800, 0.9]],
    npcs: [
      { id: 'tomi', name: 'トミ（小さい子組）', actor: 'alpboy', x: 900, face: 1 },
      { id: 'vale', name: 'バレ（大きい子組）', actor: 'goggles', x: 2700, face: -1 },
      { id: 'dona', name: '二階のドーニャ・ペパ', actor: 'cholita', x: 1650, face: -1 }
    ],
    places: [{ id: 'goal', name: '広場のゴール', x: 2100, verb: '守る', when: f => f.tomiTold && f.valeTold }],
    weather: { clear: 7, wind: 2, drizzle: 1 },
    animals: [['dog_spot', 1300], ['cat_orange', 3200], ['crow', 4200]],
    talk: {
      tomi(S) {
        const f = S.f;
        if (S.back && !f.played) return [['npc', 'normal', 'キーパーなしで、ぼろ負けした。……一年、広場は大きい子たちのもの。']];
        if (S.back) return [['npc', 'normal', '広場、まんなかに線を引いたんだ。でも、けっきょく毎週いっしょにやってる。'], ['npc', 'normal', '……キーパーは、もう旅の人じゃなくていいよ。ぼくがやる。']];
        if (f.played) return [['npc', 'normal', '顔、だいじょうぶ？ ボール、まともに当たってたけど。']];
        if (f.tomiTold) return [['npc', 'normal', 'キーパー、頼んだからね！ 手を使っていいのは、キーパーだけだよ！']];
        f.tomiTold = true;
        return [['me', '', '（男の子が、ボールを抱えて、こちらをじろじろ見上げている）'], ['npc', 'normal', '旅の人、背が高いね。……キーパー、できる？'], ['npc', 'normal', 'きょうの試合に勝ったほうが、日曜の広場を使えるの。負けたら、一年、大きい子たちのもの。'], ['npc', 'normal', 'こっちは四人しかいない。キーパーがいないんだ。']];
      },
      vale(S) {
        const f = S.f;
        if (S.back && !f.played) return [['npc', 'normal', 'ことしも勝った。……でも、相手が四人じゃ、勝った気がしないな。']];
        if (S.back) return [['npc', 'normal', 'あの線、ペパばあさんが引いたんだって。……ひいばあちゃんの代から、あの広場は半分ずつだったらしい。'], ['npc', 'normal', '取り合うから、毎年もめるんだよな。']];
        if (f.played) return [['npc', 'normal', '引き分け……！ あの一点、ずるくない？ 顔で止めたんだよ、顔で！']];
        if (f.valeTold) return [['npc', 'normal', 'キーパー、その人？ ……まあ、いいけど。手加減しないよ。']];
        f.valeTold = true;
        return [['npc', 'normal', '小さい子組のキーパー？ ……旅の人が？'], ['npc', 'normal', 'いいよ。こっちは六人。去年も、おととしも、うちが勝った。'], ['npc', 'normal', '……日曜の広場は、町でいちばん平らな場所なんだ。ほかに、ボールを蹴れるところがない。']];
      },
      dona(S) {
        const f = S.f;
        if (S.back && f.played) return [['npc', 'normal', '線を引いてやったよ、広場のまんなかに。白いペンキでね。'], ['npc', 'normal', 'わたしが子どもだったころも、まんなかに線があったのさ。だれかが消して、忘れちまった。'], ['insight', '', '取り合っていた広場には、昔、まんなかに一本の線があっただけだった。']];
        if (S.back) return [['npc', 'normal', 'ことしも大きい子たちの勝ちかい。……毎年同じだと、見てるほうも飽きるね。']];
        if (f.played) return [['npc', 'normal', '見てたよ、二階から。……引き分けだって？ ふふ、それがいちばんさ。']];
        return [['npc', 'normal', '広場の試合かい。毎年、うるさくてかなわないよ。'], ['npc', 'normal', '……わたしが子どものころは、もめなかったんだけどね。どうしてだったかね。'], ['me', '', '（ばあさんの窓辺に、白いペンキの缶が一つ。ふたが、さびついている）']];
      },
      goal(S) {
        const f = S.f;
        if (f.played) return [['me', '', '（ゴールの柱に、ボールの跡が一つ。……わたしの顔の跡も、どこかにありそうだ）']];
        f.played = true;
        return [['me', '', '（両手を広げて、ゴールの前に立つ。……大きい子たちが、六人で走ってくる）'], ['me', '', '（一本目、右へ跳んだ。ボールは左を抜けていった。0対1）'], ['me', '', '（トミたちが、一点を返す。1対1。……最後の一本が、まっすぐ飛んでくる）'], ['me', '', '（よけようとした顔に、ボールが当たって、外へはねた）'], ['me', '', '（笛が鳴った。……引き分け。鼻が、じんじんする）']];
      }
    }
  });

// ---------------------------------------------------------------- 37 十三番目の鐘（壊れたと思った時計は、亡くなった師匠が弟子に残した最後の宿題だった）
  C.push({
    id: 'bohemia', shape: '師匠の残した宿題', name: 'ボヘミア', sub: '時計塔の町', time: 'noon', screens: 5, far: 'valley', map: [50.1, 14.4],
    hill: '#3a3a2a', ground: ['#8a8070', '#5a5048', '#9a9080'], tint: 'rgba(255,230,190,.04)', bscale: 1.0,
    props: [['ship_bell', 1950, 140], ['stool2', 3100, 40], ['wall_flowers', 4200, 110]],
    buildings: [['uk_tudor', 600, 0.9], ['castle_gate', 1650, 0.8], ['it_townhouse', 2700, 0.9], ['house_small', 3700, 1.3]],
    npcs: [
      { id: 'jiri', name: '時計屋のイジー', actor: 'surveyor', x: 1350, face: 1 },
      { id: 'baker', name: 'パン屋のマルタ', actor: 'baker_girl', x: 2450, face: -1 },
      { id: 'vera', name: 'ヴェラおばあさん', actor: 'kasuri', x: 3950, face: -1 }
    ],
    places: [
      { id: 'tower', name: '時計塔の歯車', x: 1950, verb: '見る' },
      { id: 'tools', name: '師匠の道具箱', x: 3650, verb: '開ける', when: f => f.veraTold }
    ],
    weather: { clear: 6, drizzle: 3, fog: 1 },
    animals: [['crow', 1700], ['cat_white', 2900], ['dog_bulldog', 4400]],
    talk: {
      jiri(S) {
        const f = S.f;
        if (S.back && f.lever) return [['npc', 'normal', 'けさ、正午に十二回だけ鳴った。町じゅうが、少しさびしそうな顔をした。'], ['npc', 'normal', '……師匠の前掛けを着てみた。まだ、ちょっと大きい。']];
        if (S.back) return [['npc', 'normal', 'きょうも十三回。……町の人は、もう笑わなくなった。慣れたらしい。']];
        if (f.lever) return [['npc', 'normal', '……レバーは、まだ引いていません。あしたの正午に引きます。'], ['npc', 'normal', 'あと一回だけ、十三回を聞いておきたいんです。']];
        if (f.noteRead) { f.lever = true;
          return [['me', '', '師匠の道具箱のふたに、紙が。十三番目の槌は、自分で見つけるまで鳴らしておけ、と。'], ['npc', 'normal', '……十三番目の、槌？'], ['me', '', '（イジーは塔へ走っていった。しばらくして、戻ってきた）'], ['npc', 'normal', '……裏の小さなレバー、ありました。壊れてなかったんだ。師匠が、わざと鳴らしてたんだ。']]; }
        if (f.jiriTold) return [['npc', 'normal', '歯車は全部見た。どこも、壊れてない。……なのに、十三回鳴るんだ。']];
        f.jiriTold = true;
        return [['me', '', '（正午の鐘が鳴りはじめた。……十一、十二、十三）'], ['me', '', '（町の人たちが、くすくす笑って空を見上げる。若い男だけが、頭を抱えている）'], ['npc', 'normal', '……聞きましたか。十三回。師匠が死んでから、ずっとです。'], ['npc', 'normal', 'ぼくは弟子です。でも、直せない。来週、町長が新しい時計屋を呼ぶそうです。そうしたら、ぼくはおしまいだ。']];
      },
      tower(S) {
        const f = S.f;
        if (S.back) return [['me', '', '（歯車の音が、ていねいに続いている。十三番目の槌だけが、静かに止まっている）']];
        f.towerSeen = true;
        return [['me', '', '（塔の窓から、大小の歯車が見える。どれも、油でつやつやしている）'], ['me', '', '（鐘を打つ槌が十二本。……その奥に、小さな槌がもう一本。ほかのより、ずっと新しい）']];
      },
      baker(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', '十二回になっちゃったのね。……ちょっと、損した気分。'], ['npc', 'normal', 'お昼に一回多く鳴ると、ひとつ多く売れたのよ。']];
        return [['npc', 'normal', '十三番目の鐘？ わたしは好き。お昼が、ちょっとだけ長くなる気がするの。'], ['npc', 'normal', 'イジーは、あれを恥ずかしがってる。師匠のおじいさんは、毎日笑って聞いてたのにね。']];
      },
      vera(S) {
        const f = S.f;
        if (S.back && f.lever) return [['npc', 'normal', 'けさ、十二回だったね。……あの人も、ようやく安心しただろうよ。'], ['insight', '', '壊れていると思った十三番目の鐘は、師匠が弟子に残した、最後の宿題だった。']];
        if (S.back) return [['npc', 'normal', 'まだ十三回だね。……あの子が気づくまで、あの人は鳴らしつづけるのさ。']];
        if (f.veraTold) return [['npc', 'normal', '道具箱は、そこの戸口の横。あの人は、何でもあの箱にしまう人だった。']];
        f.veraTold = true;
        return [['npc', 'normal', 'イジーの話かい。……あの子は、うちの人の最後の弟子でね。'], ['npc', 'normal', '亡くなる前の月、あの人は毎晩、塔にのぼって、何かを足していた。新しい部品をね。'], ['npc', 'normal', '道具箱を見てごらん。わたしには、何が書いてあるのか分からないけど。']];
      },
      tools(S) {
        const f = S.f;
        if (S.back) return [['me', '', '（道具箱は、イジーの店へ運ばれていった。戸口の横に、四角い跡だけが残っている）']];
        if (f.lever && !f.wellDone) { f.wellDone = true;
          return [['me', '', '（ふたの裏の紙をはがすと、その下に、もう一枚。同じ字で）'], ['me', '', '（「よくやった」）'], ['me', '', '（……イジーが見つけたら、渡そう）']]; }
        if (f.lever) return [['me', '', '（ふたの裏は、もう空っぽだ）']];
        if (f.noteRead) return [['me', '', '（紙の字は、ていねいで、少しふるえている）']];
        if (!f.towerSeen) return [['me', '', '（古い道具箱。ふたの裏に、紙が貼ってある。……時計塔の何かのことらしい）']];
        f.noteRead = true;
        return [['me', '', '（ふたの裏の紙。「十三番目の槌は、イジーが自分で見つけるまで鳴らしておくこと。見つけたら、裏のレバーで止めてよい」）'], ['me', '', '（……塔の奥の、新しい小さな槌のことだ。イジーに伝えよう）']];
      }
    }
  });

  
// ---------------------------------------------------------------- 38 片方のコウノトリ（毎年二羽で戻る屋根に、一羽だけ帰ってきた）
  C.push({
    id: 'belarus', shape: '渡り鳥の帰りを待つ', name: 'ベラルシア', sub: 'コウノトリの沼', time: 'dusk', screens: 5, far: 'marsh', timeBack: 'morning', map: [52.1, 27],
    hill: '#2a3424', ground: ['#5a6a40', '#3a4430', '#6a7050'], tint: 'rgba(255,180,120,.05)', bscale: 1.0,
    props: [['reeds', 1300, 120], ['reeds2', 2500, 130], ['stork_tangled', 2860, 80, f => !f.freed], ['reeds', 3200, 120], ['haystack', 4300, 110],
      ['stork_nest1', 790, 130, (f, back) => !(back && f.freed), 205], ['stork_nest2', 790, 130, (f, back) => back && f.freed, 205]],
    buildings: [['thatched_farm', 700, 0.95], ['house_small', 4000, 1.3]],
    npcs: [
      { id: 'misha', name: 'ミーシャ', actor: 'scout', x: 1050, face: 1 },
      { id: 'hanna', name: 'ハンナばあちゃん', actor: 'ru_granny', x: 600, face: 1, when: (f, back) => !f.hannaOut },
      { id: 'hanna2', name: 'ハンナばあちゃん', actor: 'ru_granny', x: 2700, face: -1, when: (f, back) => f.hannaOut && !back },
      { id: 'hanna3', name: 'ハンナばあちゃん', actor: 'ru_granny', x: 400, face: 1, when: (f, back) => back && f.freed }
    ],
    places: [
      { id: 'roof', name: '屋根の車輪の巣', x: 750, verb: '見上げる' },
      { id: 'reedbird', name: '葦の中の白い鳥', x: 2900, verb: '見る' }
    ],
    weather: { clear: 5, drizzle: 3, fog: 2 },
    animals: [['duck', 1600], ['crow', 3600], ['cow', 4500, { mode: 'stay', face: -1 }], ['stork_fly', 1500, { mode: 'fly', when: f => f.freed, back: 'not' }], ['stork', 3700, { mode: 'stay', face: -1, back: 'only' }]],
    talk: {
      misha(S) {
        const f = S.f;
        if (S.back && f.freed) return [['npc', 'normal', '見た？ 屋根に二羽！ くちばしを鳴らして、かちかちかちって、ずっと話してる。']];
        if (S.back) return [['npc', 'normal', '屋根は、きょうも一羽だけ。……ばあちゃん、外に出てこない。']];
        if (f.freed) return [['npc', 'normal', 'ばあちゃんが、沼に入ったの？ ……長靴、三年ぶりにはいたんだって。']];
        return [['npc', 'normal', 'ハンナばあちゃんの屋根のコウノトリ、毎年四月十日に、二羽で帰ってくるの。'], ['npc', 'normal', 'ことしは、一羽だけ。もう五日たった。'], ['npc', 'normal', 'ばあちゃん、それから窓を閉めて、外に出てこなくなっちゃった。……あっちの一羽は、どこかで死んじゃったんだって。']];
      },
      hanna(S) {
        const f = S.f;
        if (f.reedSeen) { f.hannaOut = true;
          return [['me', '', '沼の東の葦の中に、白い鳥がいました。片足に、何かがからまって、飛べないみたいです。'], ['npc', 'normal', '……白い鳥？ 片足？'], ['npc', 'normal', 'はさみと、長靴を。……ミーシャ、灯りを持っておいで。']]; }
        return [['me', '', '（閉じた窓のむこうで、おばあさんが、屋根のほうを見上げている）'], ['npc', 'normal', '……旅の人かい。コウノトリを見に来たなら、ことしは一羽だよ。'], ['npc', 'normal', '六十年、この屋根に二羽で来た。親から子へ、子から孫へ。……とうとう、片方がいなくなった。']];
      },
      roof(S) {
        const f = S.f;
        if (S.back && f.freed) return [['me', '', '（屋根の上の、古い車輪の巣に、白い鳥が二羽。かちかちと、くちばしを鳴らしあっている）']];
        if (S.back) return [['me', '', '（屋根の巣に、一羽。沼のほうを、じっと見ている）']];
        return [['me', '', '（屋根のてっぺんに、古い荷車の車輪。その上に、枝で編んだ大きな巣）'], ['me', '', '（白い鳥が一羽、巣のふちに立って、東の沼のほうばかり見ている）']];
      },
      reedbird(S) {
        const f = S.f;
        if (S.back && f.freed) return [['me', '', '（葦の中に、切れた網の糸が、ひとかたまり落ちている）']];
        if (f.freed) return [['me', '', '（葦のあいだに、切った糸が落ちている。白い鳥は、もういない）']];
        if (f.hannaOut) return [['me', '', '（白い鳥は、さっきと同じ場所で、片足で立っている）']];
        f.reedSeen = true;
        return [['me', '', '（葦のあいだに、白くて大きな鳥が立っている。片足で）'], ['me', '', '（もう片方の足に、古い網の糸が、ぐるぐるに巻きついている。羽ばたこうとして、やめた）'], ['me', '', '（近づくと、首をのばして、くちばしをかちかちと鳴らした。……追いはらわれた）']];
      },
      hanna2(S) {
        const f = S.f;
        if (f.freed) return [['npc', 'normal', '……飛んでいったね。屋根のほうへ。'], ['npc', 'normal', '片方が見えないと、片方は待つ場所から動けない。……鳥も、人も、同じだね。']];
        f.freed = true;
        return [['me', '', '（ハンナばあちゃんが、長靴で葦の中へ入っていく。鳥は、くちばしを鳴らさない）'], ['npc', 'normal', '……そうかい、そうかい。網にかかって、五日も。'], ['me', '', '（ぱちん、ぱちん。はさみが、糸を切る）'], ['me', '', '（白い鳥が、大きく羽をひろげて、夕焼けの中を、屋根のほうへ飛んでいった）']];
      },
      hanna3(S) {
        return [['npc', 'normal', 'けさ、窓を開けたよ。五日ぶりに、全部。'], ['npc', 'normal', '……あの子らは、来年も二羽で来るだろう。わしも、それまでは、窓を開けておくことにする。'], ['insight', '', '片方を待って動けなかった屋根の一羽は、沼で、もう片方を待たせていた。']];
      }
    }
  });

// ---------------------------------------------------------------- 39 年越しの最初の客（新年の真夜中、最初に戸をくぐる「縁起の客」を頼まれる）
  C.push({
    id: 'scotia', shape: '旅人が縁起の役を頼まれる', name: 'スコッティア', sub: '年越しの村', time: 'night', screens: 5, far: 'misty_pines_dawn', timeBack: 'morning', map: [57.2, -4.4],
    hill: '#1a2420', ground: ['#4a5a44', '#2e3a2e', '#5a6a54'], tint: 'rgba(80,100,140,.08)', bscale: 1.0,
    props: [['pine_snow', 350, 300], ['stone_lantern', 1300, 160], ['tree_snow', 2500, 280], ['rock_moss', 3400, 80], ['pine_snow', 4500, 320]],
    buildings: [['uk_terrace', 700, 0.9], ['bakery', 1800, 0.9], ['uk_tudor', 3000, 0.9], ['house_small', 4000, 1.3]],
    npcs: [
      { id: 'robbie', name: 'ロビー', actor: 'greenboy', x: 1000, face: 1 },
      { id: 'moira', name: 'パン屋のモイラ', actor: 'farmgirl', x: 2050, face: -1 },
      { id: 'angus', name: 'アンガスじいさん', actor: 'oldsmith', x: 3750, face: -1, when: (f, back) => !back || !f.footed },
      { id: 'angus2', name: 'アンガスじいさん', actor: 'oldsmith', x: 1500, face: 1, when: (f, back) => back && f.footed }
    ],
    places: [
      { id: 'coal', name: '石炭の山', x: 2700, verb: '拾う' },
      { id: 'door', name: 'アンガスじいさんの戸', x: 3950, verb: 'たたく', when: f => f.bread && f.coal }
    ],
    weather: { snow: 5, clear: 3, fog: 2 },
    animals: [['dog_bulldog', 1300], ['sheep', 4500]],
    talk: {
      robbie(S) {
        const f = S.f;
        if (S.back && f.footed) return [['npc', 'normal', 'アンガスじいさん、けさから村じゅうの戸をたたいて回ってるよ。石炭を配って。'], ['npc', 'normal', '……背が高くて、黒い髪じゃないのに。いいのかな。']];
        if (S.back) return [['npc', 'normal', 'アンガスじいさんの戸、ことしも開かなかった。']];
        if (f.footed) return [['npc', 'normal', '戸、開いた？ ……開いたんだ！']];
        if (f.robbieTold) return [['npc', 'normal', 'パンと、塩と、石炭。三つそろえて、真夜中すぎに戸をたたくんだよ。']];
        f.robbieTold = true;
        return [['me', '', '（真夜中の鐘が鳴り終わるころ、雪の中で男の子が、こちらをじっと見ている）'], ['npc', 'normal', '旅の人！ ……村の人じゃないよね？ よかった！'], ['npc', 'normal', '新年の最初の客は、知らない人がいいの。その人が、その家の一年の運を連れてくるんだ。'], ['npc', 'normal', '東のアンガスじいさんの家、もう五年、だれも最初の客が来てない。じいさん、戸を開けないから。']];
      },
      moira(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', 'あの人、パンのお代を払いに来たのよ。五年分だって、多すぎるくらい置いていった。']];
        if (f.footed) return [['npc', 'normal', '開いたの？ あの戸が？ ……ちょっと、パンをもう一つ焼いてくる。']];
        if (f.bread) return [['npc', 'normal', '石炭は、鍛冶場の裏よ。手が黒くなるけど、それも縁起のうち。']];
        if (!f.robbieTold) return [['npc', 'normal', '新年おめでとう、旅の人。……真夜中に店を開けてるのは、うちくらいよ。']];
        f.bread = true;
        return [['npc', 'normal', 'アンガスさんの最初の客に？ ……まあ。じゃあ、これを。'], ['me', '', '（丸いパンを一つ、手渡された。まだあたたかい）'], ['npc', 'normal', '塩も、中に入れておいたわ。……あの人はね、四十年、この村の最初の客だったの。'], ['npc', 'normal', '背が高くて、髪が黒くて。毎年、村じゅうの戸を回ってた。……でも、あの人の家には、だれも来なかった。']];
      },
      coal(S) {
        const f = S.f;
        if (S.back) return [['me', '', '（石炭の山が、少し低くなっている。雪の上に、黒い粉がこぼれている）']];
        if (f.coal) return [['me', '', '（ポケットの石炭が、まだほんのりあたたかい）']];
        f.coal = true;
        return [['me', '', '（鍛冶場の裏の石炭の山から、小さなかたまりを一つ拾う）'], ['me', '', '（手が真っ黒になった。……縁起の客というのは、手が汚れるものらしい）']];
      },
      door(S) {
        const f = S.f;
        if (f.footed) return [['me', '', '（戸のすきまから、暖炉の火の色がもれている）']];
        f.footed = true;
        return [['me', '', '（とん、とん、とん）'], ['me', '', '（……しばらくして、重い戸が、細く開いた）'], ['npc', 'normal', '……だれだ。この家には、最初の客など、もう来ん。'], ['me', '', '（パンと、石炭を差しだした）'], ['me', '', '（白い眉が、ゆっくり上がった。……戸が、大きく開いた）']];
      },
      angus(S) {
        const f = S.f;
        if (f.footed) return [['npc', 'normal', '……四十年、わしは人の家の最初の客だった。'], ['npc', 'normal', 'わしの家の戸をたたく者は、おらなんだ。最初の客が来ない家だと、思われていたらしい。'], ['npc', 'normal', '五年前、妻が死んで、戸を開けるのをやめた。……開けても、だれも来んと思っておった。'], ['npc', 'normal', '入れ。火にあたっていけ。……ことしの運は、あんたが連れてきた。']];
        return [['me', '', '（窓のむこうで、白い髪の大きな老人が、暖炉の火を見つめている）']];
      },
      angus2(S) {
        return [['npc', 'normal', 'けさは、わしが回っておる。村じゅうの戸を。……五年ぶりだ。'], ['npc', 'normal', '髪は、もう白いがな。それでも、戸を開けてくれる家がある。'], ['insight', '', '四十年、人の家に運を運んだ人の戸を、最後にたたいたのは、通りすがりの旅人だった。']];
      }
    }
  });

  
// ---------------------------------------------------------------- 40 夜明けの石の顔（目の弱った番人と、一年に一度だけ光が届く瞬間を待つ）
  C.push({
    id: 'egypta', shape: 'いっしょに夜明けを待つ', name: 'エジプタ', sub: '砂の神殿', time: 'night', screens: 5, far: 'desert', timeBack: 'morning', map: [25.7, 32.6],
    hill: '#3a2a1e', ground: ['#c0a070', '#8a6a48', '#d0b080'], tint: 'rgba(80,70,140,.08)', bscale: 1.0,
    props: [['palm', 300, 300], ['obelisk', 1400, 260], ['stone_tablet', 2300, 110], ['desert_temple', 3300, 300], ['palm', 4500, 300]],
    buildings: [['adobe', 700, 0.9]],
    npcs: [
      { id: 'sara', name: 'サラ', actor: 'tribekid', x: 950, face: 1 },
      { id: 'hassan', name: '番人のハッサン', actor: 'na_elder', x: 3000, face: -1 }
    ],
    places: [
      { id: 'face', name: '神殿の奥の石の顔', x: 3500, verb: '見る' },
      { id: 'wait', name: 'ハッサンのとなり', x: 2850, verb: '座る', when: f => f.hassanAsk }
    ],
    weather: { clear: 8, wind: 2 },
    animals: [['camel', 600, { mode: 'stay' }], ['dog_brown', 1700], ['owl', 2200, { mode: 'stay', back: 'not' }]],
    talk: {
      sara(S) {
        const f = S.f;
        if (S.back && f.dawn) return [['npc', 'normal', 'おじいちゃん、けさは「来年も見る」って言ったの。……「見る」って。'], ['npc', 'normal', 'わたし、来年はとなりに座る。目じゃなくて、ほっぺたで覚えるんだ。']];
        if (S.back) return [['npc', 'normal', 'おじいちゃん、ひとりで朝を待ったんだって。……光が来たか、わからなかったって。']];
        if (f.saraTold) return [['npc', 'normal', 'おじいちゃんは、神殿のまんなかにいるよ。']];
        f.saraTold = true;
        return [['me', '', '（夜の砂の上で、女の子が毛布を二枚かかえて、こちらを見ている）'], ['npc', 'normal', '旅の人、今夜は、神殿でいちばん大事な夜なの。一年に一度、朝日が奥の石の顔にとどくの。'], ['npc', 'normal', 'おじいちゃんは五十年、毎年それを見てきた。……でも、ことしは目がよく見えないの。'], ['npc', 'normal', '光が来たのが分からなかったら、もう番人はやめるって。神殿の鍵を、町へ返すって言ってるの。'], ['npc', 'normal', 'わたしは、子どもは夜ふかしだめって、帰されちゃった。……これ、おじいちゃんに。']];
      },
      face(S) {
        const f = S.f;
        if (S.back) return [['me', '', '（朝の光が、石の顔から、ゆっくり離れていく。……また一年後）']];
        if (f.dawn) return [['me', '', '（石の顔は、また影の中。……ほんの数分だけの光だった）']];
        return [['me', '', '（神殿のいちばん奥。暗がりに、大きな石の顔が三つ並んでいる）'], ['me', '', '（入口から、まっすぐ一本、光の通り道があいている）']];
      },
      hassan(S) {
        const f = S.f;
        if (S.back && f.dawn) return [['npc', 'normal', '来年も、見るよ。この頬でな。……鍵は、まだ返さん。'], ['npc', 'normal', 'サラが、となりに座ると言うとる。']];
        if (S.back) return [['npc', 'normal', '……来たのかどうか、わからなんだ。五十年で、はじめてだ。'], ['npc', 'normal', '鍵は、きょう町へ返しに行く。']];
        if (f.dawn) return [['npc', 'normal', '……あたたかかったろう。'], ['npc', 'normal', '五十年、わしはここに座っておった。光は、石の顔にとどく少し前に、わしの右の頬にとどく。'], ['npc', 'normal', 'ことしは目が見えんでも、頬は覚えておった。……あんたに見てもらう必要は、なかったのかもしれん。'], ['npc', 'normal', 'だが、となりに人がおると、夜は短いな。']];
        f.hassanAsk = true;
        return [['npc', 'normal', f.saraTold ? '旅の人か。……サラの毛布だな。ありがとう。' : '旅の人か。こんな夜ふけに、神殿へ。'], ['npc', 'normal', '夜明けまで、ここに座っておる。朝日が、奥の石の顔にとどく、そのときまで。'], ['npc', 'normal', '……目がな、もう光と影しかわからん。とどいた瞬間を、わしのかわりに見てくれんか。']];
      },
      wait(S) {
        const f = S.f;
        if (f.dawn) return [['me', '', '（ハッサンのとなりの砂は、まだ少しあたたかい）']];
        f.dawn = true;
        return [['me', '', '（ハッサンのとなりに座って、毛布をかぶる。砂漠の夜は、思ったより寒い）'], ['me', '', '（ハッサンは、五十年分の夜明けの話をしてくれた。砂嵐の年、月食の年、サラが生まれた年）'], ['me', '', '（東の空が白くなる。光が、神殿の入口から、まっすぐに入ってくる）'], ['me', '', '（……あ、と言うより先に、ハッサンが、右の頬に手を当てた）'], ['me', '', '（光が、奥の石の顔にとどいた。三つの顔が、金色になった）'], ['insight', '', 'わたしが見るより先に、夜明けは、五十年座りつづけた人の頬にとどいていた。']];
      }
    }
  });

// ---------------------------------------------------------------- 41 子守歌の最後の一節（西の母が忘れた歌を、東の羊飼いから覚えて帰り道に運ぶ）
  C.push({
    id: 'eire', shape: '歌を覚えて運ぶ', name: 'エールランダ', sub: '石垣の丘', time: 'dusk', screens: 5, far: 'mountains', timeBack: 'night', map: [53.3, -8.5],
    hill: '#2a3a2a', ground: ['#5a7a44', '#3a4e30', '#6a8050'], tint: 'rgba(255,170,130,.05)', bscale: 1.0,
    props: [['rock_moss', 300, 80], ['stone_chapel', 1400, 220], ['rock2', 2400, 90], ['rune_stone', 3300, 120], ['rock_moss', 4400, 90]],
    buildings: [['thatched_farm', 600, 0.9], ['inn', 2000, 0.9], ['sheep_pen', 3900, 0.9]],
    npcs: [
      { id: 'siobhan', name: 'シボーン', actor: 'mother', x: 850, face: 1 },
      { id: 'fiddler', name: '酒場のフィドル弾き', actor: 'minstrel', x: 2250, face: -1 },
      { id: 'padraig', name: '羊飼いのパドリグ', actor: 'hermit', x: 3650, face: -1 }
    ],
    places: [{ id: 'wind', name: '丘の上の風', x: 3200, verb: '聞く' }],
    weather: { wind: 4, drizzle: 4, clear: 2 },
    animals: [['sheep', 3800], ['sheep', 3950], ['sheep', 4100], ['dog_spot', 3500], ['crow', 1600]],
    talk: {
      siobhan(S) {
        const f = S.f;
        if (S.back && f.learned) { f.sung = true;
          return [['me', '', '（窓辺で、シボーンが泣く赤ん坊をゆすっている。……もう、三晩目だそうだ）'], ['me', '', '覚えてきました。最後の一節。……上手じゃないけど。'], ['me', '', '（小さな声で、ハミングする。丘の上で、羊飼いが歌っていたとおりに）'], ['npc', 'normal', '……それ。それよ。母さんの声と、同じところで下がる。'], ['me', '', '（赤ん坊が、ふっと泣きやんで、指をくわえた。……眠った）'], ['insight', '', '行きに覚えた歌は、帰り道になって、はじめて届け先に着いた。']];
        }
        if (S.back) return [['npc', 'normal', '……旅の人。この子、今夜も眠らないの。最後の一節さえ、思い出せたら。']];
        if (f.sioTold) return [['npc', 'normal', '歌の終わりで、声が一つ下がるの。……そこまでは覚えてるのに。']];
        f.sioTold = true;
        return [['me', '', '（赤ん坊を抱いた女の人が、戸口で同じ節を、何度もくり返し口ずさんでいる。途中で止まって、また最初から）'], ['npc', 'normal', '……ごめんなさい、うるさいでしょう。この子、母さんの子守歌じゃないと眠らないの。'], ['npc', 'normal', '母さんは去年の冬に亡くなって。……最後の一節だけ、どうしても思い出せない。'], ['npc', 'normal', 'この子、三晩ほとんど眠ってないの。わたしも。']];
      },
      fiddler(S) {
        const f = S.f;
        if (S.back && f.sung) return [['npc', 'normal', 'シボーンの家から、ゆうべ、あの歌の終わりが聞こえたよ。……あんたの声だったのか。音程が、ちょっと旅してたな。']];
        if (S.back) return [['npc', 'normal', '帰りかい。……この丘の歌は、来た道を戻ると、ちがう歌に聞こえるもんさ。']];
        if (f.fiddleTold) return [['npc', 'normal', '東の丘の、パドリグじいさんだ。羊に聞かせて、四十年。']];
        f.fiddleTold = true;
        return [['npc', 'normal', 'シボーンの母さんの子守歌？ ……ああ、あれはこの谷の古い歌だ。'], ['npc', 'normal', '始めは弾けるが、終わりは、おれも知らん。終わりは、家ごとにちがうんだ。'], ['npc', 'normal', '……東の丘の羊飼い、パドリグじいさんなら。あの人は、シボーンの母さんの兄さんだからな。']];
      },
      wind(S) {
        const f = S.f;
        if (S.back) return [['me', '', '（丘の上の風が、今夜は静かだ。羊の鈴だけが、遠くで鳴っている）']];
        f.windHeard = true;
        return [['me', '', '（丘の上で、風にのって、低い歌声が流れてくる）'], ['me', '', '（……シボーンが口ずさんでいた節だ。そして、その先がある。声が、一つ下がる）']];
      },
      padraig(S) {
        const f = S.f;
        if (S.back && f.sung) return [['npc', 'normal', 'シボーンの子が眠ったと、フィドル弾きが知らせに来た。'], ['npc', 'normal', '……妹の歌が、妹の孫を眠らせたか。わしは、羊にしか歌ったことがなかったが。']];
        if (S.back) return [['npc', 'normal', '……羊は、ことしもこの歌で眠る。']];
        if (f.learned) return [['npc', 'normal', '……まだ、ここにおるのか。早う行け。'], ['npc', 'normal', '妹に、よろしくとは言わん。……あの子の娘に、言ってくれ。']];
        if (!f.windHeard) return [['npc', 'normal', '……羊を見に来たのかね。今は、寝かしつけの時間だ。']];
        f.learned = true;
        return [['me', '', 'さっきの歌の、最後の一節を教えてください。西の村の、シボーンさんの子が眠れなくて。'], ['npc', 'normal', '……シボーン？ わしの妹の娘か。'], ['npc', 'normal', '妹とは、四十年前にけんかしたきりでな。……あの歌は、ふたりで母から習ったんだ。'], ['me', '', '（パドリグじいさんが、ゆっくり、最後の一節を三度歌ってくれた。三度目に、いっしょに歌う）'], ['npc', 'normal', '歌は、歩くと忘れる。……忘れんうちに、帰り道で歌ってやってくれ。']];
      }
    }
  });

  
// ---------------------------------------------------------------- 42 コーヒーの木の名前（子どもが生まれた家の木に、最初に通った旅人が名前をつける）
  C.push({
    id: 'ethiopa', shape: '旅人が名前をつける', name: 'エチオピナ', sub: 'コーヒーの高地', time: 'morning', screens: 5, far: 'rainforest_noon', map: [9, 38.7],
    hill: '#24382a', ground: ['#6a6a40', '#4a4030', '#7a7050'], tint: 'rgba(255,220,170,.04)', bscale: 1.0,
    props: [['bush', 500, 100], ['tea_table', 1250, 70], ['bush_berry', 2300, 100], ['tree_green', 3300, 280], ['bush', 4300, 110]],
    buildings: [['thatched_farm', 900, 0.9], ['house_small', 2700, 1.3], ['thatched_farm', 4000, 0.85]],
    npcs: [
      { id: 'abebe', name: 'アベベ（父親）', actor: 'drummer', x: 650, face: 1 },
      { id: 'tigist', name: 'ティギスト（コーヒーをいれる母）', actor: 'wa_woman', x: 1450, face: -1 },
      { id: 'hana_mw', name: '産婆のハナ', actor: 'doctor', x: 2950, face: -1 },
      { id: 'elder_e', name: '村の物知りアト・ケベデ', actor: 'sage', x: 3800, face: -1 }
    ],
    places: [{ id: 'sapling', name: '植えたばかりのコーヒーの苗', x: 1050, verb: '名づける', when: f => f.namesHeard >= 2 }],
    weather: { clear: 5, drizzle: 3, fog: 2 },
    animals: [['rooster', 700], ['hen', 820], ['donkey', 2200, { mode: 'stay' }], ['dog_brown', 3500]],
    talk: {
      abebe(S) {
        const f = S.f;
        if (S.back && f.named) return [['npc', 'normal', '苗の札、見たかい。……あんたの字は読めないけど、ハナが読んでくれた。'], ['npc', 'normal', '娘の名前も、同じにした。木と娘が、同じ年をとっていく。']];
        if (S.back) return [['npc', 'normal', '苗には、まだ名前がない。……つぎの旅人を、待つことにするよ。']];
        if (f.named) return [['npc', 'normal', 'いい名前だ。……どういう意味かは、ゆっくり考えることにするよ。']];
        if (f.abebeTold) return [['npc', 'normal', '名前は、考えてくれた？ ……急がなくていい。日が沈むまでに、なら。']];
        f.abebeTold = true; f.namesHeard = f.namesHeard || 0;
        return [['me', '', '（若い男が、植えたばかりの苗の前で、こちらに大きく手をふっている）'], ['npc', 'normal', '来た！ 旅の人だ！ ……ゆうべ、娘が生まれたんだ。'], ['npc', 'normal', 'この村では、子どもが生まれたらコーヒーの木を植える。その木の名前は、最初に通った旅の人がつけるんだ。'], ['npc', 'normal', '……日が沈むまでに頼むよ。旅の人が名づけない木は、実をつけないって言われてるんだ。']];
      },
      tigist(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', 'コーヒー、三杯目まで飲んでいって。三杯目が、祝福の杯なの。']];
        if (f.tigTold) return [['npc', 'normal', '名前は、村の人に聞いて回るといいわ。この村の名前は、みんな意味があるから。']];
        f.tigTold = true; f.namesHeard = (f.namesHeard || 0) + 1;
        return [['npc', 'normal', '名前？ ……わたしの名前は、ティギスト。「がまん」っていう意味よ。'], ['npc', 'normal', '母が、わたしを生むとき、三日かかったの。……そういうことを、名前にするの。']];
      },
      hana_mw(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', 'あの子は、よく飲んで、よく眠るよ。木のほうも、葉が一枚ふえた。']];
        if (f.hanaTold) return [['npc', 'normal', 'この村で取り上げた子は、三百人をこえたわ。木も三百本。……丘じゅう、わたしの孫みたいなものね。']];
        f.hanaTold = true; f.namesHeard = (f.namesHeard || 0) + 1;
        return [['npc', 'normal', 'わたしはハナ。「贈り物」っていう意味。……産婆の名前としては、悪くないでしょう。'], ['npc', 'normal', 'ゆうべの子は、夜明けに生まれたの。泣き声で、鳥が起きたわ。']];
      },
      elder_e(S) {
        const f = S.f;
        if (S.back && f.named) return [['npc', 'normal', '旅人の名前は、意味がわからんほうが、いい木になる。……五十年、そう見てきた。']];
        if (S.back) return [['npc', 'normal', '旅人が名づけなかった木も、ちゃんと実はなる。……言い伝えは、言い伝えだ。']];
        if (f.elderTold) return [['npc', 'normal', '名前は、口に出して三回呼んでみるといい。三回目で、木のほうがうなずく。']];
        f.namesHeard = (f.namesHeard || 0) + 1; f.elderTold = true;
        return [['npc', 'normal', 'わしは、ケベデ。「豊か」という意味だが、見てのとおり、豊かなのはひげだけだ。'], ['npc', 'normal', '旅人のつける名前は、たいてい、その人が歩いてきた道の言葉だ。……あんたの道には、どんな言葉があった？']];
      },
      sapling(S) {
        const f = S.f;
        if (f.named) return [['me', '', '（苗の札に、わたしの書いた名前。風に、小さくゆれている）']];
        f.named = true;
        return [['me', '', '（苗の前に、しゃがむ。……歩いてきた道の言葉）'], ['me', '', '（花野の村、棚田、灯台、霧、白い坂、鈴の子羊……）'], ['me', '', '（夜明けに生まれて、泣き声で鳥が起きた子）'], ['me', '', '（札に、「ヨアケ」と書いた。わたしの国の言葉で、夜明け）'], ['insight', '', 'わたしが名づけた木は、わたしが帰り道を通るまで、ここで一緒に年をとって待っている。']];
      }
    }
  });

// ---------------------------------------------------------------- 43 いたずらのイッカク（子どものうそを見に行ったら、本当に来ていた）
  C.push({
    id: 'kalaal', shape: 'いたずらが本当になる', name: 'グリーンラナ', sub: '流氷の入り江', time: 'noon', screens: 5, far: 'drift_ice_morning', timeBack: 'morning', map: [64.2, -51.7],
    hill: '#3a4450', ground: ['#c8d0d4', '#9aa4aa', '#dce2e6'], tint: 'rgba(200,220,240,.06)', bscale: 1.0,
    props: [['igloo_shell', 400, 120], ['ship_boat', 1600, 70], ['rock', 2600, 60], ['pine_snow', 4400, 260],
      ['crack_empty', 3700, 300, f => !f.sawIt, -215], ['crack_narwhal', 3700, 300, (f, back) => f.sawIt && !back, -215], ['crack_bubbles', 3700, 300, (f, back) => f.sawIt && back, -215]],
    buildings: [['nordic_red', 800, 0.85], ['nordic_red', 2000, 0.8]],
    npcs: [
      { id: 'naja', name: 'ナヤ', actor: 'eskimo', x: 1100, face: 1 },
      { id: 'pita', name: 'ピタ', actor: 'parka', x: 1400, face: -1 },
      { id: 'tuku', name: 'トゥク老人', actor: 'bearhunter', x: 2350, face: -1 }
    ],
    places: [{ id: 'crack', name: '東の氷の割れ目', x: 3800, verb: 'のぞく' }],
    weather: { clear: 5, wind: 3, snow: 2 },
    animals: [['dog_husky', 600], ['dog_samoyed', 1800], ['crow', 3000]],
    talk: {
      naja(S) {
        const f = S.f;
        if (S.back && f.sawIt) return [['npc', 'normal', '……ほんとに、来てたの？ うそでしょ。'], ['npc', 'normal', 'え、トゥクじいちゃんも見たの？ ……じゃあ、ほんとなんだ。'], ['npc', 'normal', 'ずるい。うそついたの、わたしたちなのに。']];
        if (S.back) return [['npc', 'normal', '旅の人、ほんとに東まで行ったの？ あはは、イッカクなんて、いなかったでしょ。']];
        if (f.crackSeen) return [['npc', 'normal', 'え、見えなかった？ あはは！ ……ひっかかった！']];
        if (f.najaTold) return [['npc', 'normal', '早く早く！ 東の割れ目！ 角が、すぐ引っこんじゃうから！']];
        f.najaTold = true;
        return [['me', '', '（毛皮の服の女の子が、息を切らして走ってきた）'], ['npc', 'normal', '旅の人！ 東の氷の割れ目に、イッカクがいる！ 長い角が、氷から出てるの！'], ['npc', 'normal', '……ほんとだよ。ほんとにほんと。早く行かないと、もぐっちゃう！']];
      },
      pita(S) {
        const f = S.f;
        if (S.back && f.sawIt) return [['npc', 'normal', 'つぎの旅の人には、何てうそつこう……。ほんとのことしか、思いつかなくなっちゃった。']];
        if (S.back) return [['npc', 'normal', 'ナヤのうそ、旅の人はみんなひっかかるんだ。これで十一人目！']];
        if (f.crackSeen) return [['npc', 'normal', 'ごめんね。……ナヤのいたずら。旅の人が来るたび、やるの。']];
        return [['npc', 'normal', '……（男の子が、口をおさえて、笑いをこらえている）']];
      },
      tuku(S) {
        const f = S.f;
        if (S.back && f.sawIt) return [['npc', 'normal', '……見たよ。けさ、割れ目で。二頭だ。角を、空に向けてな。'], ['npc', 'normal', '荷造りしたものは、ほどいた。……海は、まだ死んでおらんかった。'], ['insight', '', 'うそだと分かっていても見に行ったから、十年ぶりの本当に、最初に会えた。']];
        if (S.back) return [['npc', 'normal', 'あさって、町へ移る。荷物は、ほとんどまとめた。']];
        if (f.sawIt) return [['npc', 'normal', '……いたのか？ 本当に？'], ['npc', 'normal', '旅の人まで、子どもらのまねをするようになったか。……いや、その目は、うそじゃないな。'], ['npc', 'normal', 'あしたの朝、自分の目で見に行く。……十年ぶりにな。']];
        if (f.crackSeen) return [['npc', 'normal', 'いなかったろう。……あの子らのいつものいたずらだ。']];
        return [['npc', 'normal', 'イッカク？ ふふ、ナヤにやられたな。'], ['npc', 'normal', 'この入り江に、イッカクはもう十年来ておらん。氷がうすくなって、海が変わった。'], ['npc', 'normal', 'わしも、あさって町へ移る。猟師が、獲るものもない海にしがみついても、しかたない。']];
      },
      crack(S) {
        const f = S.f;
        if (S.back) return [['me', '', '（朝の割れ目は、静かだ。……でも、水の上に、小さな泡が残っている）']];
        if (f.sawIt) return [['me', '', '（割れ目の水面は、静かだ。……さっきの角は、夢じゃない）']];
        if (!f.crackSeen) { f.crackSeen = true;
          return [['me', '', '（東の氷の割れ目。黒い水が、ゆっくり揺れている）'], ['me', '', '（しばらく待つ。……何も出てこない）'], ['me', '', '（……ひっかかったらしい）']]; }
        f.sawIt = true;
        return [['me', '', '（もう一度、割れ目をのぞく。……水が、ふくらんだ）'], ['me', '', '（ぷしゅっと、白い息が上がる。その横に、ねじれた長い角が一本、空を向いた）'], ['me', '', '（すぐ横に、もう一本。……二頭いる）'], ['me', '', '（角は、ゆっくり水にもどっていった）']];
      }
    }
  });

  
// ---------------------------------------------------------------- 44 昼に歩くな（暑さで足が止まった旅人を、牧場の犬が見つける）
  C.push({
    id: 'ozlana', shape: '旅人が助けられる', name: 'オーストラナ', sub: '赤い大地の牧場', time: 'noon', screens: 5, far: 'red_rocks_noon', timeBack: 'dusk', map: [-23.7, 133.9],
    hill: '#5a2a1a', ground: ['#c0704a', '#8a4a30', '#d08a5a'], tint: 'rgba(255,150,80,.08)', bscale: 1.0,
    props: [['tree_dead', 400, 260], ['rock', 2000, 70], ['tree_dead', 3100, 240], ['stone_well', 3900, 100], ['barn_open', 4400, 200]],
    buildings: [['ar_estancia', 800, 0.85]],
    npcs: [
      { id: 'jess', name: 'ジェス', actor: 'flagkid', x: 1050, face: 1 },
      { id: 'doug', name: '木陰のダグ', actor: 'cowboy', x: 1900, face: 1 },
      { id: 'betty', name: 'ベティばあさん', actor: 'herbgranny', x: 4100, face: -1 }
    ],
    places: [{ id: 'heat', name: '赤い道のまんなか', x: 2600, verb: '休む' }],
    weather: { clear: 9, wind: 1 },
    animals: [['dog_brown', 3700, { mode: 'stay', back: 'not', face: -1 }], ['dog_brown', 1300, { back: 'only' }], ['cow', 4600, { mode: 'stay' }], ['crow', 2200]],
    talk: {
      jess(S) {
        const f = S.f;
        if (S.back && f.rescued) return [['npc', 'normal', 'やっぱり、レッドに見つけてもらったんだ。……顔、まだ赤いよ。'], ['npc', 'normal', '帰りは夕方に歩いてきたんだね。それが正解。']];
        if (S.back) return [['npc', 'normal', '夕方の柵は、もう卵が焼けないの。……つまんない。']];
        if (f.jessTold) return [['npc', 'normal', '水、ちゃんと持ってる？ 昼の道は、思ったより長いよ。']];
        f.jessTold = true;
        return [['me', '', '（牧場の柵の上に、女の子が卵を一つ割って、じっと見ている）'], ['me', '', '（……じゅうっと、白身がふちから固まっていく）'], ['npc', 'normal', '見て、目玉焼き。……お昼の柵は、これくらい熱いの。'], ['npc', 'normal', '旅の人、まさか、いまから東へ歩くの？ この上を？'], ['npc', 'normal', 'ここの昼は、歩くもんじゃないよ。牧場の人はみんな、夕方まで日陰で寝てる。'], ['npc', 'normal', '……まあ、行くなら止めないけど。東のベティばあさんちまで、水場はないからね。']];
      },
      doug(S) {
        const f = S.f;
        if (S.back && f.rescued) return [['npc', 'normal', 'レッドが昼に吠えたって？ ……おれは寝てた。ベティに、こっぴどく怒られた。'], ['npc', 'normal', '牧童が、犬に仕事を取られちゃおしまいだな。']];
        if (S.back) return [['npc', 'normal', '夕方は、牛を動かす時間だ。……昼は、生き物が動く時間じゃない。']];
        if (f.dougTold) return [['npc', 'normal', '……ぐう。']];
        f.dougTold = true;
        return [['me', '', '（枯れ木の細い影の中で、帽子を顔にのせた男が寝ている）'], ['npc', 'normal', '……ん。昼に歩いてるのか。牛だって、昼は歩かんぞ。'], ['npc', 'normal', 'この先は、影ひとつない。……おれの水筒、半分残ってる。いや、だめだ、これはおれの昼寝の水だ。'], ['npc', 'normal', '……倒れたら、レッドが来る。レッドが吠えたら、おれが起きる。たぶんな。']];
      },
      heat(S) {
        const f = S.f;
        if (S.back) return [['me', '', '（夕方の赤い道は、昼とはちがう。風が、少しだけ冷たい）'], ['me', '', '（道ばたの石に、小さな犬の足あとが、行き帰りの二本ついている）']];
        if (f.rescued) return [['me', '', '（さっき倒れかけた場所。……石が、まだ熱い）']];
        f.dizzy = true;
        return [['me', '', '（日ざしが、まっすぐ上から落ちてくる。自分の影が、足の下に丸く縮んでいる）'], ['me', '', '（水筒をかたむける。……一滴も出てこない）'], ['me', '', '（足が、重い。地面が、ゆらゆらと波打って見える）'], ['me', '', '（……石の陰にしゃがんだ。立ち上がれない）'], ['me', '', '（遠くから、ワン、と一声。赤茶色の犬が、まっすぐ走ってくる）']];
      },
      betty(S) {
        const f = S.f;
        if (S.back && f.rescued) return [['npc', 'normal', 'レッドは、けさも柵のところで西の道を見張ってたよ。……つぎの、昼に歩くおばかさんをね。'], ['insight', '', '歩くことしか知らなかったわたしを、昼の道で見つけたのは、歩く人を待つ犬だった。']];
        if (S.back) return [['npc', 'normal', '夕方に来たね。正解だよ。……レッドは、昼は柵の陰で、西の道ばかり見てる。']];
        if (f.rescued) return [['npc', 'normal', 'もう一杯飲みな。……水は、のどが渇く前に飲むもんだよ。']];
        if (f.dizzy) { f.rescued = true;
          return [['me', '', '（犬に、マントのすそをくわえられて、引っぱられるように歩いた。……気がつくと、井戸の横の日陰に座っていた）'], ['npc', 'normal', 'ほら、水。ゆっくりね。……昼の赤い道を、ひとりで歩いてきたのかい。'], ['npc', 'normal', 'レッドが吠えたんで、また来たなと思ったよ。この夏で三人目だ。'], ['npc', 'normal', 'あの子は、子犬のときに、昼の道で倒れてたのを、わたしが拾ったんだ。……だから、昼の道を見張ってるのさ。']]; }
        return [['npc', 'normal', '……旅の人かい。昼のうちに、よくここまで来たね。'], ['npc', 'normal', '水場は、うちの井戸だけだよ。好きなだけ飲んでいきな。']];
      }
    }
  });

// ---------------------------------------------------------------- 45 飛んでいったリボン（旅人のなくしたリボンが、雲の中の曲がり角の目印になっていた）
  C.push({
    id: 'huangsha', shape: '旅人の落とし物が役に立つ', name: 'ホアンシャナ', sub: '雲の上の峠', time: 'night', screens: 5, far: 'sea_of_clouds_night', timeBack: 'morning', map: [30.1, 118.2],
    weatherBack: { fog: 7, clear: 1 },
    hill: '#1e2430', ground: ['#6a6a64', '#4a4a46', '#7a7a72'], tint: 'rgba(120,140,200,.06)', bscale: 1.0,
    props: [['pine', 300, 280], ['stone_lantern', 1200, 160], ['rock_moss', 2000, 80], ['pine', 3000, 300], ['rock', 3900, 70]],
    buildings: [['cn_teahouse', 800, 0.8], ['cn_paifang', 4300, 0.8]],
    npcs: [
      { id: 'yun', name: '茶店のシャオユン', actor: 'qipao', x: 1050, face: 1 },
      { id: 'wang', name: '担ぎ屋のラオ・ワン', actor: 'miner2', x: 2200, face: -1 },
      { id: 'chen', name: '峠守りのチェン老人', actor: 'monk', x: 3700, face: -1 }
    ],
    places: [
      { id: 'gust', name: '雲の吹き上がる崖', x: 2700, verb: '見る' },
      { id: 'bend', name: '峠の曲がり角', x: 3350, verb: '見る' }
    ],
    weather: { clear: 6, wind: 4 },
    animals: [['crow', 1600], ['hawk', 2600, { mode: 'fly' }]],
    talk: {
      yun(S) {
        const f = S.f;
        if (S.back && f.ribbonUsed) return [['npc', 'normal', 'けさは霧が濃かったのに、担ぎ屋さんたち、一人も道をまちがえなかったって。'], ['npc', 'normal', '……赤いのが見えたから、って。何のことかしら。']];
        if (S.back) return [['npc', 'normal', '霧の朝は、担ぎ屋さんたちがよく道をまちがえるの。……今朝も、一人。']];
        if (f.yunTold) return [['npc', 'normal', '雲の上の夜は、星が近いでしょう。手をのばしたら、届きそう。']];
        f.yunTold = true;
        return [['me', '', '（峠の茶店で、娘さんが、湯をわかしながら空を見上げている）'], ['npc', 'normal', 'いらっしゃい。……見て、雲が海みたい。この峠の夜だけの景色よ。'], ['npc', 'normal', 'でも、朝になると、この雲がのぼってきて、道を全部かくしちゃうの。'], ['npc', 'normal', '担ぎ屋さんたちは、それでも夜明け前に荷を運ぶ。……東の曲がり角で、去年、ふたり落ちかけたわ。']];
      },
      wang(S) {
        const f = S.f;
        if (S.back && f.ribbonUsed) return [['npc', 'normal', '赤い布、見えたか？ 霧の中で、あれだけが浮かんで見える。曲がるのが、怖くなくなった。']];
        if (S.back) return [['npc', 'normal', '霧の朝は、足の裏で道を探すんだ。……おととい、片足が空を踏んだ。']];
        return [['npc', 'normal', '担ぎ屋のワンだ。夜明け前に、この峠を荷を担いで越える。'], ['npc', 'normal', '霧の朝はな、曲がり角が分からんのよ。白い岩も、白い霧も、同じ色だ。'], ['npc', 'normal', '……何か、目立つ目印があればいいんだがな。白くない、何か。']];
      },
      gust(S) {
        const f = S.f;
        if (S.back) return [['me', '', '（崖の下から、朝の雲が、ゆっくりわき上がってくる）']];
        if (f.ribbonLost) return [['me', '', '（崖の下は、雲の海。……リボンは、もう見えない）']];
        f.ribbonLost = true;
        return [['me', '', '（崖のふちに立つと、下から、ごうっと雲まじりの風が吹き上がった）'], ['me', '', '（あっ、と言うまに、マントを留めていた赤いリボンが、ほどけて空へ）'], ['me', '', '（くるくると回りながら、東のほうへ流されていった）'], ['me', '', '（……旅に出る日に、母さんが結んでくれたリボンだった）']];
      },
      bend(S) {
        const f = S.f;
        if (S.back && f.ribbonUsed) return [['me', '', '（霧の中に、赤いものが一つ、ぽつんと浮かんでいる。……わたしのリボンだ）'], ['me', '', '（曲がり角の杭に結ばれて、霧の中で、道の曲がる方へなびいている）']];
        if (S.back) return [['me', '', '（霧で、白い岩と白い道の区別がつかない。足もとを確かめながら曲がる）']];
        return [['me', '', '（道が急に左へ折れている。右は、雲の海へ落ちる崖）'], ['me', '', '（曲がり角に、古い杭が一本。何も結ばれていない）']];
      },
      chen(S) {
        const f = S.f;
        if (S.back && f.ribbonUsed) return [['npc', 'normal', '赤い布は、霧の朝ほどよく見える。……担ぎ屋たちが、角で手を合わせていくようになった。'], ['insight', '', 'なくして悲しかった赤いリボンは、雲の上の曲がり角で、だれかの足を止める目印になっていた。']];
        if (S.back) return [['npc', 'normal', '……霧の朝は、杭に何か結んでやれればと思うんだがな。白いものしか、持っとらん。']];
        if (f.ribbonUsed) return [['npc', 'normal', '気に入らんかったら、ほどいて持っていけ。……あんたのものだ。']];
        if (f.ribbonLost) { f.ribbonUsed = true;
          return [['npc', 'normal', '旅の人。……ゆうべ、風が赤い布を運んできてな。この崖の、わしの小屋の屋根に引っかかった。'], ['npc', 'normal', 'あんたのマントの留め紐が、ないようだが。……これか。'], ['me', '', '（チェン老人の手に、赤いリボン。……でも、老人は、それを返す前に、曲がり角の杭を見た）'], ['npc', 'normal', '……いや、頼みがある。これを、あの杭に結ばせてくれんか。霧の朝、白くないものが、ひとつほしかった。'], ['me', '', '（少し考えて、うなずいた。老人が、杭にリボンを結んだ）']]; }
        return [['npc', 'normal', '峠守りのチェンだ。四十年、この曲がり角を見ておる。'], ['npc', 'normal', '霧の朝に、この角で何人もが空を踏みかけた。……目印を立てても、白い霧に、白い杭ではな。']];
      }
    }
  });

  
// ---------------------------------------------------------------- 46 炎を運ぶ稜線（教わったことを、こんどは旅人が子どもに教える）
  C.push({
    id: 'hawaina', shape: '旅人が教える側に回る', name: 'ハワイナ', sub: '溶岩の稜線', time: 'night', screens: 5, far: 'lava_night', timeBack: 'morning', map: [19.6, -155.5],
    hill: '#1a1414', ground: ['#3a3434', '#242020', '#4a4040'], tint: 'rgba(255,90,40,.07)', bscale: 1.0,
    props: [['palm', 300, 300], ['tree_dead', 1500, 220], ['rock', 2300, 70], ['rock2', 2700, 90], ['palm', 4400, 320]],
    buildings: [['stilt_house', 700, 0.85], ['thatched_farm', 4000, 0.85]],
    npcs: [
      { id: 'keoni', name: 'ケオニ（足をくじいた兄）', actor: 'islandboy', x: 950, face: 1 },
      { id: 'kai', name: 'カイ', actor: 'leafkid', x: 1350, face: -1 },
      { id: 'tutu', name: 'トゥトゥ・レイ', actor: 'fruitseller', x: 4250, face: -1 }
    ],
    places: [
      { id: 'ridge', name: '細い溶岩の稜線', x: 2500, verb: '教える', when: f => f.kaiTold },
      { id: 'torch', name: '祭りの火床', x: 4450, verb: '見る' }
    ],
    weather: { clear: 7, wind: 3 },
    animals: [['rooster', 500], ['dog_brown', 3600], ['owl', 1900, { mode: 'stay' }]],
    talk: {
      keoni(S) {
        const f = S.f;
        if (S.back && f.kaiCrossed) return [['npc', 'normal', 'カイのやつ、けさ「向こうを見て歩くんだよ」って、おれに教えに来た。……生意気だ。'], ['npc', 'normal', '……足が治ったら、来年は、あいつのうしろを歩くよ。']];
        if (S.back) return [['npc', 'normal', '火は、ことしは届かなかった。……トゥトゥの家の火床、冷たいままだって。']];
        if (f.keoniTold) return [['npc', 'normal', 'カイは、高いところがだめなんだ。木登りも、いつもおれが下で待ってた。']];
        f.keoniTold = true;
        return [['me', '', '（男の子が、足首に布を巻いて、松明を抱えたまま座りこんでいる）'], ['npc', 'normal', '……転んだ。祭りの火を、東のトゥトゥの家まで運ぶ役なのに。'], ['npc', 'normal', '月が昇るまでに火床に火を入れないと、ことしの祭りは始まらない。……弟のカイに頼むしかないんだけど。']];
      },
      kai(S) {
        const f = S.f;
        if (S.back && f.kaiCrossed) return [['npc', 'normal', '灯りが消えたとき、旅の人の声だけ聞いてた。……目をつぶってたのに、まっすぐ歩けた。'], ['npc', 'normal', '……旅の人は、だれに教わったの？']];
        if (S.back) return [['npc', 'normal', '……こわかった。下を見たら、足が動かなくなった。']];
        if (f.kaiCrossed) return [['npc', 'normal', '……渡れた！ 渡れたよ！']];
        if (f.kaiTold) return [['npc', 'normal', '……あの稜線、両側が真っ黒な崖なの。下を見たら、もうだめ。']];
        f.kaiTold = true;
        return [['npc', 'normal', '兄ちゃんの代わりに、火を運べって。……むり。'], ['npc', 'normal', '東へ行くには、細い溶岩の稜線を渡らなきゃいけない。両側は、真っ黒な崖。'], ['npc', 'normal', '足もとを見ないと落ちそうで、足もとを見ると、足が動かなくなるの。']];
      },
      ridge(S) {
        const f = S.f;
        if (S.back) return [['me', '', '（朝の稜線は、夜ほど細く見えない。両側の黒い岩に、小さな草が生えている）']];
        if (f.kaiCrossed) return [['me', '', '（稜線の向こうで、火床の火が、ぱちぱちと燃えている）']];
        f.kaiCrossed = true;
        return [['me', '', '（カイと並んで、稜線の入口に立つ。松明の火が、風でゆれる）'], ['me', '', '手もとを見ないで。向こうの、トゥトゥの家の灯りだけを見て。'], ['me', '', '……湖の国で、カヌーの漕ぎ方を、そう教わったんだ。'], ['me', '', '（カイが、ごくりとつばを飲んで、遠くの灯りを見た。……一歩、二歩、三歩）'], ['me', '', '（そのとき、山から吹き下ろす風で、松明の火がふっと細くなった。……向こうの灯りが、煙に隠れた）'], ['me', '', '（カイの足が止まる。下を見かけて、ぎゅっと目をつぶった）'], ['me', '', '……見るものがなくなったら、わたしの声を聞いて。こっち、まっすぐ。'], ['me', '', '（声をかけながら、うしろを歩く。カイは目をつぶったまま、一歩ずつ進んだ）'], ['me', '', '（煙が晴れると、カイはもう稜線の向こうに立っていた。……湖の国の教えだけでは、足りなかった）']];
      },
      torch(S) {
        const f = S.f;
        if (S.back && f.kaiCrossed) return [['me', '', '（火床の灰が、まだあたたかい。そのまわりに、踊った足あとが、たくさん）']];
        if (S.back) return [['me', '', '（火床は、冷たいままだ）']];
        if (f.kaiCrossed) return [['me', '', '（火床に、カイの松明から火が移った。炎が、夜空に高く上がる）']];
        return [['me', '', '（石で囲んだ火床。まだ、火は入っていない）']];
      },
      tutu(S) {
        const f = S.f;
        if (S.back && f.kaiCrossed) return [['npc', 'normal', 'カイが、ゆうべ一晩じゅう、あんたのまねをして歩いてたよ。顔を上げて、遠くを見て。'], ['insight', '', '教わったとおりにいかなかったとき、わたしは、教わったことの先を、はじめて自分で考えた。']];
        if (S.back) return [['npc', 'normal', '火がなくても、月は昇る。……でも、祭りのない夜は、長いね。']];
        if (f.kaiCrossed) return [['npc', 'normal', 'カイ！ ……弟のほうが来たかい。足が震えてるね。でも、火は消えてない。']];
        return [['npc', 'normal', '……火は、まだかね。月が、山の肩まで来てるよ。']];
      }
    }
  });

// ---------------------------------------------------------------- 47 百歳の内緒（村じゅうで隠すお祝いを、本人はとっくに知っていた）
  C.push({
    id: 'suomi', shape: 'サプライズの裏のサプライズ', name: 'フィンランダ', sub: '雪の湖の村', time: 'noon', screens: 5, far: 'snow', timeBack: 'dusk', map: [62.2, 25.7],
    hill: '#3a4450', ground: ['#d8dce0', '#a8b0b8', '#e8ecf0'], tint: 'rgba(200,210,240,.05)', bscale: 1.0,
    props: [['pine_snow', 300, 300], ['tree_snow', 1400, 260], ['ship_boat', 2700, 60], ['pine_snow', 3400, 320], ['iso_cabin_snow', 4300, 200]],
    buildings: [['nordic_red', 700, 0.9], ['house_small', 1900, 1.3]],
    npcs: [
      { id: 'liisa', name: 'リーサ（ひ孫）', actor: 'braidgirl', x: 900, face: 1 },
      { id: 'aino', name: 'アイノばあちゃん', actor: 'es_granny', x: 2300, face: -1, when: (f, back) => !f.walking || back },
      { id: 'aino2', name: 'アイノばあちゃん', actor: 'es_granny', x: 3100, face: -1, when: (f, back) => f.walking && !back },
      { id: 'matti', name: 'となりのマッティ', actor: 'hunter', x: 1600, face: -1 }
    ],
    places: [{ id: 'hole', name: '湖の氷の穴', x: 3300, verb: '見る', when: f => f.walking }],
    weather: { snow: 5, clear: 4, wind: 1 },
    animals: [['dog_samoyed', 1200], ['crow', 2900]],
    talk: {
      liisa(S) {
        const f = S.f;
        if (S.back && f.cake) return [['npc', 'normal', 'ひいおばあちゃん、知ってたんだって！ ……ずるい！'], ['npc', 'normal', '来年は、もっとうまく隠す。……百一歳のは、ぜったい。']];
        if (S.back) return [['npc', 'normal', 'ひいおばあちゃん、家から出てくれなかったの。……ケーキ、台所で見られちゃった。']];
        if (f.walking) return [['npc', 'normal', '（小声で）……いいよ、その調子！ 夕方まで、湖のほうにお願い！']];
        if (f.liisaTold) return [['npc', 'normal', '（小声で）……夕方まで！ 湖のほう！ ひみつだよ！']];
        f.liisaTold = true;
        return [['me', '', '（女の子が、雪だるまのかげから、手まねきしている）'], ['npc', 'normal', '（小声で）旅の人、おねがい！ きょう、ひいおばあちゃんが百歳になるの。'], ['npc', 'normal', '村じゅうで、ないしょのお祝いを準備してるの。でも、ひいおばあちゃん、ずっと窓から外を見てて。'], ['npc', 'normal', '夕方まで、どこかへ連れ出して！ ……でも、ひみつだって、ぜったい言っちゃだめ！']];
      },
      matti(S) {
        const f = S.f;
        if (S.back && f.cake) return [['npc', 'normal', 'アイノさんの「おどろいたふり」、あれは百年ものだな。村じゅうがだまされた。']];
        if (S.back) return [['npc', 'normal', 'ケーキは、けっきょく窓から丸見えだった。……まあ、おいしかったらしいが。']];
        return [['me', '', '（男の人が、両手いっぱいの旗を、あわてて背中に隠した）'], ['npc', 'normal', '……や、やあ、旅の人。なんでもないよ。'], ['npc', 'normal', '……アイノさんは、この村でいちばん勘がいい。百年、何ひとつ見のがしたことがない。気をつけな。']];
      },
      aino(S) {
        const f = S.f;
        if (S.back && f.cake) return [['npc', 'normal', '……おどろいたよ。ええ、ほんとうに、おどろいた。'], ['me', '', '（ばあちゃんが、片目をつぶった）'], ['npc', 'normal', '九十九回、だまされたふりをしてきたんだ。百回目も、ちゃんとだまされてやらなきゃね。'], ['insight', '', '隠されていたお祝いより、気づかないふりをする百年のほうが、ずっと大きな贈り物だった。']];
        if (S.back) return [['npc', 'normal', 'きょうは、家でゆっくりしておったよ。……台所のほうが、やけににぎやかだったがね。']];
        if (f.ainoTold) { f.walking = true;
          return [['me', '', '……湖を、見に行きませんか。氷の上を、歩いてみたくて。'], ['npc', 'normal', '湖？ 夕方まで？ ……ほう。'], ['me', '', '（ばあちゃんは、窓の外の、旗を隠したマッティを、ちらっと見た）'], ['npc', 'normal', 'いいとも。氷の穴の釣り方を、教えてあげよう。……ゆっくり、ゆっくりね。']]; }
        f.ainoTold = true;
        return [['me', '', '（窓辺の小さなおばあさんが、編み物の手を止めて、外の雪を見ている）'], ['npc', 'normal', '旅の人かい。……きょうは、村がやけに静かだね。'], ['npc', 'normal', 'みんな、わしの顔を見ると、急に用事を思い出すんだ。……ふしぎな日だよ。']];
      },
      aino2(S) {
        const f = S.f;
        if (f.cake) return [['npc', 'normal', 'そろそろ、暗くなってきたね。……帰ろうか。ゆっくり、ゆっくりね。']];
        if (f.fished) { f.cake = true;
          return [['npc', 'normal', '……旅の人。ケーキは、苺かね、それとも木の実かね。'], ['me', '', '……えっ。'], ['me', '', '（ばあちゃんは、くすくす笑った）'], ['npc', 'normal', '……言わんでいい。どちらでもうれしいよ。'], ['npc', 'normal', 'さあ、帰ろう。わしは、ちゃんとおどろく練習をしておくから。']]; }
        return [['npc', 'normal', '穴のそばにお座り。糸をたらして、待つんだよ。……釣りは、待つのがいちばんの仕事さ。']];
      },
      hole(S) {
        const f = S.f;
        if (S.back) return [['me', '', '（夕方の氷の穴に、もう薄い氷が張っている）']];
        if (f.fished) return [['me', '', '（氷の穴の水が、静かに揺れている）']];
        f.fished = true;
        return [['me', '', '（氷にあいた丸い穴に、糸をたらす。……寒い。指先の感覚がなくなっていく）'], ['me', '', '（ばあちゃんは、百年分の冬の話をしながら、小さな魚を三匹釣った。わたしは、ゼロ）'], ['me', '', '（村のほうから、ときどき、どすん、とか、しーっ、とか聞こえる）']];
      }
    }
  });

  
// ---------------------------------------------------------------- 48 いわしから弦へ（市場の物々交換を一周して、ギターの弦を手に入れる）
  C.push({
    id: 'lisboa', shape: '交換の連鎖', name: 'ポルトガーナ', sub: 'タイルの坂の港', time: 'dusk', screens: 5, far: 'sea_dusk', timeBack: 'night', map: [38.7, -9.1],
    hill: '#3a2a30', ground: ['#a08870', '#6a5848', '#b09880'], tint: 'rgba(255,170,130,.06)', bscale: 1.0,
    props: [['ship_barrels', 400, 90], ['wall_flowers', 1300, 110], ['flatbread_table', 2300, 60], ['easel', 3100, 130], ['bollard', 4400, 60]],
    buildings: [['med_white', 700, 0.95], ['it_townhouse', 1700, 0.9], ['es_white', 2700, 0.9], ['sea_shop', 3700, 0.95]],
    npcs: [
      { id: 'zeca', name: 'ゼカ', actor: 'flower_boy', x: 600, face: 1 },
      { id: 'rosa_f', name: '魚売りのロザ', actor: 'ranchwife', x: 1450, face: -1 },
      { id: 'tiago', name: '果物屋のチアゴ', actor: 'grocer', x: 2250, face: -1 },
      { id: 'ines', name: 'タイル絵描きのイネス', actor: 'scarfwoman', x: 3250, face: -1 },
      { id: 'avo', name: 'アヴォ・ジョアキン', actor: 'oldman', x: 4100, face: -1 }
    ],
    weather: { clear: 6, wind: 2, drizzle: 2 },
    animals: [['cat_orange', 1100], ['cat_white', 2600], ['crow', 3500]],
    talk: {
      zeca(S) {
        const f = S.f;
        if (S.back && f.str) return [['npc', 'normal', 'じいちゃん、ゆうべ、港で歌ったんだ！ ……いわし一匹が、歌になったんだよ。']];
        if (S.back) return [['npc', 'normal', 'じいちゃんのギター、きょうも弦が五本。……五本の歌は、ちょっとさびしい。']];
        if (f.strDone) return [['npc', 'normal', 'じいちゃん、六本で弾いてる！ ……いわしが、弦になったんだ！']];
        if (f.str) return [['npc', 'normal', '弦！ ほんとに！ ……早く、じいちゃんのところへ！']];
        if (f.sardine) return [['npc', 'normal', '弦は、タイル絵描きのイネスさんが持ってるって。でも、お金じゃ売ってくれないんだ。']];
        f.sardine = true;
        return [['me', '', '（男の子が、いわしを一匹、両手でささげ持って、困った顔で立っている）'], ['npc', 'normal', 'じいちゃんのギター、弦が一本切れちゃったの。今夜、港の祭りで歌う約束なのに。'], ['npc', 'normal', 'この坂の市場は、お金より交換なんだ。……ぼくが持ってるのは、このいわし一匹だけ。'], ['npc', 'normal', '今夜は、じいちゃんの最後の祭りなの。指がもう動かないから、ことしで港の歌い手をやめるんだって。'], ['npc', 'normal', '旅の人、これで弦まで、たどりつける？']];
      },
      rosa_f(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', 'いわしが一周して、うちに戻ってきたの？ ……笑っちゃう。']];
        if (f.lemon) return [['npc', 'normal', 'いわしにはレモン。……あたりまえのことよ。']];
        if (!f.sardine) return [['npc', 'normal', 'いわし、いらんかね！ ……って、いわし売りがいわしを欲しがるわけないか。']];
        return [['npc', 'normal', 'いわしと交換？ うちはいわし屋よ。……でも、チアゴがレモンを持て余してたわね。']];
      },
      tiago(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', 'あのいわし、焼いて食べたよ。……レモンを、たっぷりしぼってね。']];
        if (f.lemon) return [['npc', 'normal', 'いわし、焼く前に、ちょっとだけ眺めてるんだ。……弦になるかもしれなかったいわしだからね。']];
        if (!f.sardine) return [['npc', 'normal', 'レモン、いらないかい。ことしはなりすぎてね。']];
        f.lemon = true;
        return [['npc', 'normal', 'いわし！ ……ちょうど、晩ごはんのおかずを考えてたんだ。'], ['me', '', '（いわし一匹が、レモン三つになった）'], ['npc', 'normal', 'イネスのところへ持っていきな。あの人、絵の具を溶くのに、レモン汁を使うんだ。']];
      },
      ines(S) {
        const f = S.f;
        if (S.back && f.str) return [['npc', 'normal', '黄色、ちゃんと出たわ。……レモンの黄色。港の絵の、夕日のところに使ったの。']];
        if (S.back) return [['npc', 'normal', '黄色が出ないの。……港の絵、夕日だけ白いまま。']];
        if (f.str) return [['npc', 'normal', 'ジョアキンさんに、よろしく。……昔、あの人の歌で、わたし、タイルを描きはじめたのよ。']];
        if (!f.lemon) return [['npc', 'normal', 'ギターの弦？ ……亡くなった父のが一本あるけど。絵の具の黄色が出なくて、それどころじゃないの。']];
        f.str = true;
        return [['npc', 'normal', 'レモン！ ……これで、黄色が出せる。'], ['npc', 'normal', '弦がほしいの？ 父の形見だけど……いいわ。ジョアキンさんのギターなら、父も喜ぶ。'], ['me', '', '（レモン三つが、銀色の弦一本になった）']];
      },
      avo(S) {
        const f = S.f;
        if (S.back && f.str) return [['npc', 'normal', 'ゆうべの歌は、いわしの歌、と呼ばれておる。……港の連中が、そう名づけた。'], ['insight', '', 'いわし一匹は、坂の市場を一周するあいだに、いくつもの晩ごはんと一枚の絵と、一つの歌になった。']];
        if (S.back) return [['npc', 'normal', '五本でも、歌えんことはない。……ただ、低いところが、少しさびしい。']];
        if (f.str) { f.strDone = true;
          return [['me', '', '（弦を渡すと、老人は、ふるえる指で、ゆっくりと張りかえた）'], ['npc', 'normal', '……この弦は、イネスの父さんのものだな。音で、わかる。'], ['me', '', '（ぽろん、と低い音。港の夕暮れに、しみていく）'], ['npc', 'normal', 'ゼカ、行くぞ。……今夜は、六本で歌える。']]; }
        return [['npc', 'normal', '……ゼカのやつ、弦を探しに行ったか。'], ['npc', 'normal', '五十年、この港で歌ってきた。弦が切れたのは、三度目だ。……三度とも、だれかが届けてくれた。']];
      }
    }
  });

// ---------------------------------------------------------------- 49 撮る人が写る（村の写真を五十年撮ってきた人は、一枚も写っていない）
  C.push({
    id: 'fjordia', shape: '撮る人が写る', name: 'ノルウェーナ', sub: 'フィヨルドの村', time: 'morning', screens: 5, far: 'fjord_morning2', map: [61.2, 6.9],
    hill: '#2a3438', ground: ['#5a7050', '#3a4838', '#6a7a60'], tint: 'rgba(200,220,240,.04)', bscale: 1.0,
    props: [['pine', 300, 300], ['pier', 1400, 110], ['ship_boat', 1700, 70], ['pine', 3100, 300], ['flatbread_table', 3900, 60]],
    buildings: [['nordic_red', 700, 0.9], ['house_small', 2400, 1.3], ['nordic_red', 4300, 0.85]],
    npcs: [
      { id: 'tor', name: '写真屋のトール', actor: 'wheelchair', x: 2100, face: 1, h: 0.82 },
      { id: 'ingrid', name: 'イングヴァル（孫）', actor: 'florist', x: 1100, face: 1 },
      { id: 'twins', name: '双子のエッバとエルサ', actor: 'twins', x: 3300, face: -1, h: 0.62 },
      { id: 'gudrun', name: 'グズルンばあちゃん', actor: 'granny_nordic', x: 3800, face: -1 }
    ],
    places: [{ id: 'camera', name: '三脚の上の写真機', x: 2550, verb: '撮る', when: f => f.ingridTold && f.gudrunTold }],
    weather: { clear: 5, fog: 3, drizzle: 2 },
    animals: [['sheep', 600], ['dog_samoyed', 3000], ['crow', 1700]],
    talk: {
      ingrid(S) {
        const f = S.f;
        if (S.back && f.shot) return [['npc', 'normal', 'じいちゃん、焼いた写真を見て、しばらく何も言わなかったの。'], ['npc', 'normal', '……それから、「わしは、こんな顔で笑うのか」って。']];
        if (S.back) return [['npc', 'normal', 'ことしの写真も、じいちゃんだけいないの。……いつもどおり。']];
        if (f.ingridTold) return [['npc', 'normal', 'じいちゃんの写真機、使い方は簡単だよ。ふたを取って、ひもを引くだけ。']];
        f.ingridTold = true;
        return [['me', '', '（青年が、桟橋の前で、村の人を一列に並べようとしている。……だれも並ばない）'], ['npc', 'normal', 'きょうは、年に一度の村の写真の日。じいちゃんが五十年、毎年撮ってきたんだ。'], ['npc', 'normal', '……で、気づいたの。五十枚の写真に、じいちゃん、一枚も写ってない。'], ['npc', 'normal', 'でも、じいちゃんは写真機をだれにも触らせない。「撮るのは、わしの仕事だ」って。']];
      },
      tor(S) {
        const f = S.f;
        if (S.back && f.shot) return [['npc', 'normal', '五十一枚目の写真は、少し傾いておる。……旅人の腕だな。'], ['npc', 'normal', 'だが、いちばんいい一枚だ。わしが、写っておる。'], ['insight', '', '村を五十年撮ってきた人は、一度レンズの前に座って、はじめて村の一人になった。']];
        if (S.back) return [['npc', 'normal', '撮ったよ。ことしも、全員そろった。……わしのほかは、な。']];
        if (f.shot) return [['npc', 'normal', '……ひもを引かれる側は、こんなに落ち着かんものか。']];
        if (f.gudrunTold) return [['npc', 'normal', '……旅人に撮らせろと、グズルンが言うのか。'], ['npc', 'normal', 'あの人は、五十年前に写真機を買う金を貸してくれた。……あの人に言われては、断れん。'], ['npc', 'normal', 'ふたを取って、ひもを引け。それだけだ。……手は、震えてもかまわん。']];
        return [['npc', 'normal', '旅人か。いい日に来た。年に一度の、村の写真の日だ。'], ['npc', 'normal', 'わしは脚が悪くて、もう写真機の後ろにしかおれん。……それで、いい。撮るのが、わしの仕事だ。']];
      },
      twins(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', 'わたしたち、写真の中で、トールおじいちゃんのひざの上にいるの！ ふたりとも！']];
        return [['npc', 'normal', 'ねえねえ、旅の人。写真のとき、どっちがエッバで、どっちがエルサか、わかる？'], ['npc', 'normal', '……トールおじいちゃんは、ファインダーをのぞくと、いつも当てるの。でも、近くで見ると、まちがえるの！']];
      },
      gudrun(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', '写真を一枚、もらったよ。トールのとなりに、わしが写っとる。……五十年待ったかいがあった。']];
        if (f.gudrunTold) return [['npc', 'normal', 'トールの写真機は、重いよ。両手で、しっかりね。']];
        f.gudrunTold = true;
        return [['npc', 'normal', 'トールを撮るって？ ……ふふ、あの頑固者が。'], ['npc', 'normal', '旅人のあんたが頼めば、あの人は断れんよ。村の者には「撮るのはわしだ」と言えても、通りすがりには言えん。'], ['npc', 'normal', '……わしの名前を出しなさい。昔、ちょっとした貸しがあるんだ。']];
      },
      camera(S) {
        const f = S.f;
        if (S.back) return [['me', '', '（三脚だけが立っている。写真機は、トールさんのひざの上にあるらしい）']];
        if (f.shot) return [['me', '', '（写真機のふたを、もとに戻した）']];
        f.shot = true;
        return [['me', '', '（写真機の後ろに立つ。のぞくと、村の人たちが、さかさまに映っている）'], ['me', '', '（真ん中に、車いすのトールさん。そのひざに双子。となりに、グズルンばあちゃん）'], ['me', '', '（トールさんが、こちらを見て、困ったような顔をしている。……写る顔を、知らないのだ）'], ['me', '', 'はい、笑って。……五十年ぶんです。'], ['me', '', '（ふたを取って、ひもを引いた。ぱしゃり）']];
      }
    }
  });

  
// ---------------------------------------------------------------- 50 負けたいふたり（最後の鷹くらべで、祖父と孫がおたがいに勝ちをゆずろうとする）
  C.push({
    id: 'arabia', shape: 'おたがいに負けてあげる', name: 'アラビアナ', sub: '砂丘の鷹の村', time: 'dusk', screens: 5, far: 'desert', timeBack: 'morning', map: [23.4, 54.5],
    hill: '#5a3a24', ground: ['#d0a870', '#a07848', '#e0b880'], tint: 'rgba(255,170,90,.07)', bscale: 1.0,
    props: [['palm', 300, 300], ['tea_table', 1300, 70], ['palm', 2400, 320], ['rock', 3200, 70], ['palm', 4400, 300]],
    buildings: [['mideast_white', 700, 0.9], ['adobe', 3800, 0.9]],
    npcs: [
      { id: 'saeed', name: '鷹匠のサイード', actor: 'falconer', x: 1000, face: 1 },
      { id: 'omar', name: 'オマル（孫）', actor: 'boy_kite', x: 2700, face: -1 },
      { id: 'layla', name: 'ライラ（オマルの母）', actor: 'levant_woman', x: 1650, face: -1 },
      { id: 'judge', name: '審判の旅商人', actor: 'tuareg', x: 3500, face: -1 }
    ],
    weather: { clear: 7, wind: 3 },
    animals: [['camel', 4000, { mode: 'stay' }], ['camel', 4250, { face: -1 }], ['hawk', 2200, { mode: 'fly' }]],
    talk: {
      saeed(S) {
        const f = S.f;
        if (S.back && f.race) return [['npc', 'normal', '同着、とはな。四十年で、はじめてだ。'], ['npc', 'normal', '……あの子も、わざと呼びもどしかけておった。わしの孫だ、考えることが同じだよ。'], ['insight', '', '勝ちをゆずりあった祖父と孫のあいだに、鷹は二羽並んで降りてきた。']];
        if (S.back) return [['npc', 'normal', 'ことしも、わしの鷹が勝った。……勝ちたくない年に限って、よく飛ぶ。']];
        if (f.saeedTold) return [['npc', 'normal', '指笛を、少し早く吹く。……それだけでいい。だれにも言うなよ。']];
        f.saeedTold = true;
        return [['me', '', '（白い衣の老人が、腕の鷹に、何かを小声で話しかけている）'], ['npc', 'normal', '旅人か。……ちょうどいい、聞いてくれ。だれかに言わずにおれん。'], ['npc', 'normal', '今夕の鷹くらべは、わしの最後の勝負だ。孫のオマルの鷹と、はじめて飛ぶ。'], ['npc', 'normal', 'わしは、負けるつもりだ。指笛を少し早く吹いて、鷹を呼びもどす。……孫に、一度勝たせてやりたい。']];
      },
      layla(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', 'ふたりとも、ゆうべは同じ顔でふくれてたわ。……勝ちたかったのか、負けたかったのか。']];
        return [['npc', 'normal', '父と息子、……いえ、父とわたしの息子ね。ふたりとも、朝から口をきかないの。'], ['npc', 'normal', '鷹くらべの前は、いつもこう。勝負の前に話すと、手の内がばれるんですって。']];
      },
      omar(S) {
        const f = S.f;
        if (S.back && f.race) return [['npc', 'normal', 'じいちゃんの鷹とぼくの鷹、同じ止まり木に、同時に降りたんだ！'], ['npc', 'normal', '……じいちゃん、知ってたのかな。ぼくが早く呼ぶつもりだったこと。']];
        if (S.back) return [['npc', 'normal', 'じいちゃんの勝ち。……よかった。最後は、じいちゃんが勝たなきゃ。']];
        if (f.omarTold) return [['npc', 'normal', 'しーっ。……じいちゃんには、ぜったいないしょ。']];
        f.omarTold = true;
        return [['npc', 'normal', '旅の人、ないしょの話があるんだ。'], ['npc', 'normal', 'きょうは、じいちゃんの最後の鷹くらべ。……ぼく、わざと負ける。指笛を早く吹いて、鷹を呼びもどすんだ。'], ['npc', 'normal', '四十年勝ちつづけたじいちゃんが、最後に負けるなんて、いやだもん。']];
      },
      judge(S) {
        const f = S.f;
        if (S.back && f.race) return [['npc', 'normal', '旅の人。ふたりが同時に指笛を吹いたのを、聞いたか？ ……そして、鷹がどちらも聞かなかったのを。'], ['npc', 'normal', '鷹は、人の小細工より、風を読む。']];
        if (S.back) return [['npc', 'normal', 'いい勝負だった。……孫のほうの鷹は、来年が楽しみだ。']];
        if (f.saeedTold && f.omarTold) { f.race = true;
          return [['npc', 'normal', '……鷹くらべを始める。あの砂丘の先から、この止まり木まで。'], ['me', '', '（二羽の鷹が、夕焼けの空へ放たれる）'], ['me', '', '（ピイッ。……ピイッ。祖父と孫の指笛が、ほとんど同時に、早すぎるほど早く鳴った）'], ['me', '', '（鷹は、二羽とも、指笛を聞かなかった。風に乗ったまま、まっすぐ飛んで）'], ['me', '', '（同じ止まり木に、羽を並べて降りた）'], ['npc', 'normal', '……同着。四十年の審判で、はじめてだ。']]; }
        return [['npc', 'normal', '鷹くらべの審判をしておる。……今夕の勝負は、見ものだぞ。'], ['npc', 'normal', '四十年負けなしの祖父と、はじめて鷹を持った孫だ。']];
      }
    }
  });

// ---------------------------------------------------------------- 51 ひと晩の隠し味（母のグヤーシュの味が出ない。足りなかったのは、時間だった）
  C.push({
    id: 'hungaria', shape: '時間が隠し味', name: 'ハンガリナ', sub: 'パプリカの平原', time: 'dusk', screens: 5, far: 'wheat_noon', timeBack: 'noon', map: [47.1, 19.5],
    hill: '#4a3a20', ground: ['#a09050', '#706030', '#b0a060'], tint: 'rgba(255,150,90,.06)', bscale: 1.0,
    props: [['haystack', 300, 120], ['bucket', 1250, 50], ['sunflowers', 2200, 130], ['well', 3300, 150], ['haystack', 4400, 130]],
    buildings: [['inn', 800, 0.9], ['thatched_farm', 2600, 0.9], ['house_small', 3900, 1.3]],
    npcs: [
      { id: 'laci', name: '食堂のラツィ', actor: 'chef', x: 1050, face: 1 },
      { id: 'erzsi', name: 'エルジおばさん', actor: 'granny_scarf', x: 2350, face: -1 },
      { id: 'peti', name: 'ペティ', actor: 'boy_cap', x: 3500, face: -1 }
    ],
    places: [{ id: 'pot', name: 'かまどの大鍋', x: 1300, verb: '味見する' }],
    weather: { clear: 6, wind: 2, drizzle: 2 },
    animals: [['rooster', 2000], ['hen', 2120], ['dog_bulldog', 3700], ['horse_bay', 4600, { mode: 'stay' }]],
    talk: {
      laci(S) {
        const f = S.f;
        if (S.back && f.tasted) return [['npc', 'normal', '……一晩、おいただけだった。母さんは、毎晩、あしたの分を煮ていたんだ。'], ['npc', 'normal', '三年、毎朝作りたてを出してた。いちばん大事なものを、毎朝、捨ててたわけだ。'], ['insight', '', '行きに足りなかった隠し味は、帰り道までの、ひと晩という時間だった。']];
        if (S.back) return [['npc', 'normal', '……店は、やっぱり閉めることにした。母さんの味が出せない食堂なんて、看板だけだ。']];
        if (f.lid) return [['npc', 'normal', 'ふたをして、火から下ろした。……あしたの朝、だれかが味見してくれたらな。']];
        if (f.laciTold && f.erzsiTold) { f.lid = true;
          return [['me', '', 'エルジさんが、お母さんは毎晩、あしたの分の鍋を煮ていたって。'], ['npc', 'normal', '……あしたの分？ 夜に作って、朝に出す？'], ['npc', 'normal', 'そういえば、母さんの鍋は、いつも朝には冷めてた。温めなおしてるだけだと思ってた。'], ['me', '', '（ラツィは、煮えたばかりの鍋に、ふたをした）'], ['npc', 'normal', '旅の人、帰りにまた寄ってくれ。……あしたの朝の味を、確かめてほしい。']]; }
        if (f.laciTold) return [['npc', 'normal', 'パプリカも、玉ねぎも、母さんと同じ店のを使ってる。……何が足りないんだ。']];
        f.laciTold = true;
        return [['me', '', '（食堂の前で、コック帽の男が、木のさじをくわえたまま、空をにらんでいる）'], ['npc', 'normal', '……ちがう。また、ちがう。'], ['npc', 'normal', '母さんのグヤーシュの味が、どうしても出ないんだ。三年、毎朝作ってる。'], ['npc', 'normal', '今週出せなかったら、店を閉める。……母さんの店を、母さんの味なしで続ける意味がない。']];
      },
      pot(S) {
        const f = S.f;
        if (S.back && f.lid) { f.tasted = true;
          return [['me', '', '（ひと晩おいた鍋を、温めなおして、ひと口）'], ['me', '', '（……ゆうべとは、ちがう。肉がやわらかくほどけて、パプリカの甘さが奥まで入っている）'], ['me', '', '（ラツィが、となりで、同じさじをくわえたまま、動かなくなった）']]; }
        if (S.back) return [['me', '', '（鍋は、からっぽで洗ってある）']];
        if (f.lid) return [['me', '', '（ふたの閉まった鍋から、まだ湯気がもれている）']];
        return [['me', '', '（ひと口もらう。……おいしい。でも、何かが角ばっている。辛さと甘さが、別々に舌に来る）']];
      },
      erzsi(S) {
        const f = S.f;
        if (S.back && f.tasted) return [['npc', 'normal', 'けさ、ラツィの店の前に、行列ができてたよ。……三年ぶりに、あの匂いがしたからね。']];
        if (S.back) return [['npc', 'normal', 'ラツィの店、閉まっちゃったんだって。……もったいないね。']];
        if (f.lid) return [['npc', 'normal', 'ラツィの台所、今夜は灯りが消えるのが早いね。……煮て、待つだけだからね。']];
        if (f.erzsiTold) return [['npc', 'normal', 'わたしも、あの人のグヤーシュは、いつも朝にもらってたよ。夜にもらったことは、一度もない。']];
        if (!f.laciTold) return [['npc', 'normal', 'いい夕方だね、旅の人。パプリカが、いちばん赤くなる時間だよ。']];
        f.erzsiTold = true;
        return [['npc', 'normal', 'ラツィの母さんのグヤーシュ？ ……うちは、となりだったからね。'], ['npc', 'normal', '材料なんて、ふつうのものさ。それより、あの人は、夜おそくまで台所に灯りがついてた。'], ['npc', 'normal', '「あしたの分を煮てるの」って、いつも言ってたよ。……朝は、温めるだけ。']];
      },
      peti(S) {
        const f = S.f;
        if (S.back && f.tasted) return [['npc', 'normal', 'けさのグヤーシュ、おかわりした！ ……おばあちゃんの味がするって、父ちゃんが泣いてた。']];
        if (S.back) return [['npc', 'normal', '食堂、閉まっちゃった。……あそこのパン、好きだったのに。']];
        return [['npc', 'normal', 'ラツィおじさんのグヤーシュ？ ……うーん、おいしいよ。'], ['npc', 'normal', 'でも、おばあちゃんのとは、ちがう。……どこがって聞かれても、わかんないけど。']];
      }
    }
  });

  
// ---------------------------------------------------------------- 52 地図に載らない村（村を記事にしに来た記者が、高山病で村に助けられる）
  C.push({
    id: 'peruna', shape: '書かずにおく記事', name: 'ペルーナ', sub: '雲の上の村', time: 'morning', screens: 5, far: 'highland', timeBack: 'dusk', map: [-13.5, -72],
    hill: '#2a3424', ground: ['#7a7a4a', '#4a4a30', '#8a8058'], tint: 'rgba(220,230,255,.04)', bscale: 1.0,
    props: [['rock_moss', 300, 80], ['stone_well', 1400, 100], ['rock2', 2300, 90], ['bush', 3300, 90], ['rock', 4300, 70]],
    buildings: [['adobe', 800, 0.9], ['cl_hill_house', 2700, 0.9], ['adobe', 3900, 0.85]],
    npcs: [
      { id: 'felipe', name: '記者のフェリペ', actor: 'reporter', x: 1100, face: 1 },
      { id: 'mama', name: 'ママ・ロサリオ', actor: 'granny_andes', x: 2500, face: -1 },
      { id: 'nina', name: 'ニナ', actor: 'chullo', x: 3600, face: -1 }
    ],
    places: [{ id: 'note', name: '記者の手帳', x: 1300, verb: '見る', when: f => f.felipeSick }],
    weather: { clear: 5, fog: 3, wind: 2 },
    animals: [['llama', 1800, { mode: 'stay' }], ['llama', 3000], ['dog_spot', 2100], ['hawk', 2600, { mode: 'fly' }]],
    talk: {
      felipe(S) {
        const f = S.f;
        if (S.back && f.healed) return [['npc', 'normal', '記事は、書いたよ。題は「どこかにある村」。……村の名前も、道も、書かなかった。'], ['npc', 'normal', '編集長には怒られるだろうな。でも、あのお茶の味を、道しるべつきで売るわけにはいかない。']];
        if (S.back) return [['npc', 'normal', '……下の町へ戻る。記事は、書けなかった。頭が割れそうで、何も覚えていない。']];
        if (f.healed && !f.teaGiven) { f.teaGiven = true;
          return [['me', '', '（ママ・ロサリオのお茶を、ひと口ずつ飲ませる。草の匂いがする）'], ['me', '', '（しばらくすると、記者の唇に、色が戻ってきた）'], ['npc', 'normal', '……村の人が、これを？ おれは、この村を地図に載せに来たのに。'], ['npc', 'normal', '（記者は、手帳の「道の図」のページを、じっと見ている）']].map(l => l[2].startsWith('（記者') ? ['me', '', l[2]] : l); }
        if (f.healed) return [['npc', 'normal', '……ママ・ロサリオに、お茶の礼を言ってくれないか。おれの顔は、見たくないだろうから。']];
        if (f.felipeSick) return [['me', '', '（記者は、石に座りこんで、頭をかかえている。唇が、紫色だ）']];
        f.felipeSick = true;
        return [['me', '', '（山高帽の男が、手帳を開いたまま、ふらふらと坂を上ってくる）'], ['npc', 'normal', '旅の人……この村の名前を、知ってるか。どこの地図にも、載ってないんだ。'], ['npc', 'normal', '「雲の上の幻の村」。記事にすれば、町の新聞の一面だ。……下に道ができて、人がたくさん来るぞ。'], ['npc', 'normal', '……う。なんだ、頭が……。空気が、うすい……。']];
      },
      note(S) {
        const f = S.f;
        if (S.back) return [['me', '', '（石の上に、手帳が置き忘れてある。……「道の図」のページだけ、きれいに破り取られている）']];
        if (f.healed) return [['me', '', '（手帳の最後のページに、大きな字で「どこかにある村」とだけ書いてある）']];
        return [['me', '', '（落ちた手帳に、走り書き。「道の図」「村の名前は？」「観光客が来れば、もうかる」）']];
      },
      mama(S) {
        const f = S.f;
        if (S.back && f.healed) return [['npc', 'normal', 'あの人、帰るとき、帽子をとって頭を下げていったよ。……記者ってのは、案外、礼儀正しいんだね。'], ['insight', '', '村を地図に載せに来た人は、村のお茶に助けられて、村の場所を書かずに帰った。']];
        if (S.back) return [['npc', 'normal', '記者さんは、ふらふらのまま、下りていったよ。……こわいね、いつか道ができるのかね。']];
        if (f.healed) return [['npc', 'normal', '……あの人が、村のことを書くなら、書くでいいさ。お茶を出したのは、困ってたからだよ。']];
        if (f.felipeSick) { f.healed = true;
          return [['me', '', '坂の下で、記者の人が倒れそうで。……この村のことを書きに来た人です。'], ['npc', 'normal', '……そうかい。村を地図に載せに来た人かい。'], ['me', '', '（ばあさんは、しばらく黙って、それから鍋に湯をわかしはじめた）'], ['npc', 'normal', 'この草のお茶を、ゆっくり飲ませな。……高い山に慣れてない人は、みんなああなる。客でも、記者でもね。']]; }
        return [['npc', 'normal', '旅の人かい。この村まで来る人は、めったにいないよ。……道が、ないからね。'], ['npc', 'normal', '道がないから、静かでいられる。……下の町の人は、そこがわからない。']];
      },
      nina(S) {
        const f = S.f;
        if (S.back && f.healed) return [['npc', 'normal', '記者のおじさん、わたしの名前だけ、手帳に書いていったの。「ニナ、九歳、リャマが好き」だって。……それだけ。']];
        if (S.back) return [['npc', 'normal', '下の町に道ができたら、学校に行けるって、父さんが。……でも、ばあちゃんは、いやだって。']];
        return [['npc', 'normal', 'この村、地図にないの。ないけど、ちゃんとあるの。'], ['npc', 'normal', '……地図に載ったら、どうなるのかな。いいことも、あるのかな。']];
      }
    }
  });

// ---------------------------------------------------------------- 53 八十歳の自転車（となり村の妹に会うため、おばあさんが自転車を習う）
  C.push({
    id: 'danmarka', shape: '年寄りがはじめて挑戦する', name: 'デンマルカ', sub: '花畑の自転車道', time: 'noon', screens: 5, far: 'flower', timeBack: 'dusk', map: [55.7, 10.2],
    hill: '#3a4a30', ground: ['#7a9a5a', '#4a6038', '#8aa068'], tint: 'rgba(255,240,210,.03)', bscale: 1.0,
    props: [['bush_berry', 300, 90], ['sunflowers', 1300, 130], ['signboard', 2100, 110], ['bush', 3200, 90], ['well', 4300, 150]],
    buildings: [['house_small', 700, 1.3], ['bakery', 1700, 0.9], ['nordic_red', 3800, 0.9]],
    npcs: [
      { id: 'karen', name: 'カーレンおばあさん', actor: 'granny_apron', x: 1000, face: 1 },
      { id: 'mads', name: '自転車屋のマス', actor: 'bikeman', x: 1500, face: -1 },
      { id: 'freja', name: 'フレデリク', actor: 'boy_sled', x: 2600, face: -1 }
    ],
    places: [{ id: 'lane', name: '花畑のまっすぐな道', x: 2900, verb: '支える', when: f => f.karenTold && f.madsTold }],
    weather: { clear: 6, wind: 3, drizzle: 1 },
    animals: [['cow', 3600, { mode: 'stay' }], ['duck', 2300], ['dog_pug', 1200]],
    talk: {
      karen(S) {
        const f = S.f;
        if (S.back && f.rode) return [['me', '', '（夕方の道の向こうから、自転車がよろよろと近づいてくる。……カーレンおばあさんだ）'], ['npc', 'normal', 'どいてー！ 止まり方を、まだ習ってないのー！'], ['me', '', '（おばあさんは、わたしの横を通りすぎて、垣根に、ふわっと突っこんだ）'], ['npc', 'normal', '……ふふ。妹の家まで、行ってきたよ。六十年ぶりにね。']];
        if (S.back) return [['npc', 'normal', '……やっぱり、八十で自転車は、むりだったね。バスを待つよ。日に一本だけど。']];
        if (f.rode) return [['npc', 'normal', '……手を、離してたのかい？ いつから？ ……言わないでおくれ、こわくなるから。']];
        if (f.karenTold) return [['npc', 'normal', 'マスの店で、いちばん低い自転車を借りたよ。……足が、地面にとどく。それだけが、救いだね。']];
        f.karenTold = true;
        return [['me', '', '（エプロン姿の小さなおばあさんが、料理のおたまを握ったまま、自転車屋の店先をにらんでいる）'], ['npc', 'normal', '旅の人、うしろを持っててくれないかい。……八十年、自転車に乗ったことがないんだ。'], ['npc', 'normal', 'となり村の妹が、寝こんでてね。バスは日に一本、それも行ってしまった。'], ['npc', 'normal', 'この国の人は、みんな自転車で行く。……わしだけ、こわくて、一度も乗らなかった。']];
      },
      mads(S) {
        const f = S.f;
        if (S.back && f.rode) return [['npc', 'normal', 'カーレンさんが、ブレーキの使い方を習いに来たよ。……順番が、ふつうと逆だね。']];
        if (S.back) return [['npc', 'normal', '自転車、返しに来たよ。乗らないまま。……来週、また貸すって言っといた。']];
        if (f.rode) return [['npc', 'normal', '離したんだな。……カーレンさん、気づいてなかったろう。みんな、気づかないんだ。']];
        if (f.madsTold) return [['npc', 'normal', 'カーレンさんは、子どものころ、自転車で転んだ妹を見て、こわくなったらしい。……その妹に、会いに行くんだと。']];
        f.madsTold = true;
        return [['npc', 'normal', 'カーレンさんに自転車を？ ……ああ、貸したよ。子ども用の、いちばん低いのを。'], ['npc', 'normal', '教え方かい？ うしろの荷台を持って、いっしょに走る。そして、本人に言わずに、そっと手を離す。'], ['npc', 'normal', '……みんな、そうやって乗れるようになった。おれも、うちの父さんに、そうされた。']];
      },
      freja(S) {
        const f = S.f;
        if (S.back && f.rode) return [['npc', 'normal', 'カーレンおばあちゃんが、ぼくより先に、となり村まで行ったんだよ！ ……ぼく、まだ補助輪なのに。']];
        if (S.back) return [['npc', 'normal', 'おばあちゃん、バス停で、ずっと座ってた。']];
        return [['npc', 'normal', 'カーレンおばあちゃん、自転車に乗るの？ ……ほんとに？'], ['npc', 'normal', 'ぼくはね、手を離されたとき、気づかなかったんだ。気づいたら、乗れてた。']];
      },
      lane(S) {
        const f = S.f;
        if (S.back) return [['me', '', '（夕方の花畑の道に、細いタイヤのあとが、くねくねと東へ続いている）']];
        if (f.rode) return [['me', '', '（道の先に、小さな背中が、よろよろと遠ざかっていく）']];
        f.rode = true;
        return [['me', '', '（荷台をしっかり持って、いっしょに走る）'], ['npc', 'normal', 'は、離さないでおくれよ！ ぜったいだよ！'], ['me', '', '（十歩、二十歩。……ペダルが、少しずつ、まっすぐに回りはじめた）'], ['me', '', '（そっと、手を離す。……おばあさんは、気づかない）'], ['me', '', '（花畑のまっすぐな道を、小さな背中が、ひとりで遠ざかっていった）'], ['insight', '', '八十年のこわさは、うしろの手がいつ離れたか知らないまま、花畑の道に置いていかれた。']].map(l => l[0] === 'npc' ? ['me', '', '（「' + l[2] + '」）'] : l);
      }
    }
  });

  
// ---------------------------------------------------------------- 54 島を出る言葉（帰るために覚えた島の言葉は、「また来て」という意味だった）
  C.push({
    id: 'samoana', shape: '帰るための言葉を覚える', name: 'サモアナ', sub: '珊瑚の島', time: 'noon', screens: 5, far: 'sea_noon', timeBack: 'dusk', map: [-13.8, -172.1],
    hill: '#2a4a3a', ground: ['#e0d0a0', '#b8a478', '#ecdcb0'], tint: 'rgba(255,240,200,.03)', bscale: 1.0,
    props: [['palm', 300, 320], ['ship_boat', 1300, 70], ['palm', 2300, 300], ['leaf_boats', 3100, 40], ['palm', 4300, 320]],
    buildings: [['stilt_house', 800, 0.85], ['sea_stall', 2700, 0.9], ['stilt_house', 3900, 0.85]],
    npcs: [
      { id: 'sione', name: 'シオネおじさん', actor: 'islander', x: 1000, face: 1 },
      { id: 'kids', name: '浜の子どもたち', actor: 'boy_frog', x: 2000, face: -1 },
      { id: 'anna_n', name: '看護師のアンナ', actor: 'nurse', x: 3500, face: -1, when: (f, back) => !back || !f.annaOk }
    ],
    weather: { clear: 7, squall: 2, wind: 1 },
    animals: [['dog_brown', 1500], ['hen', 2400], ['turtle', 3200]],
    talk: {
      sione(S) {
        const f = S.f;
        if (S.back && f.annaOk) return [['npc', 'normal', 'アンナ先生、けさの船で、ちゃんと言っていったよ。島じゅうに聞こえる声でな。'], ['npc', 'normal', '……島の言葉は、「また来るね」って意味だ。島を出る人が、島に置いていく約束さ。'], ['me', '', '……ファアレ・マイ。'], ['me', '', '（シオネおじさんが、ウクレレを止めて、大きく笑った）'], ['insight', '', '十年言えなかった言葉は、島を出る日に、戻ってくる約束になった。']];
        if (S.back && f.wordOk) return [['me', '', '……ファアレ・マイ。'], ['npc', 'normal', '（シオネおじさんが、ウクレレを止めて、大きく笑った）'], ['npc', 'normal', 'ちゃんと言えたな！ ……それは、「また来るね」って意味だ。島を出る人が、島に言う約束さ。'], ['insight', '', '島を出るために覚えた言葉は、また来るという約束だった。']].map(l => l[2].startsWith('（シオネ') ? ['me', '', l[2]] : l);
        if (S.back) return [['npc', 'normal', '言葉、覚えたかい？ ……覚えてなくても、通っていい。ただ、島がちょっとさびしがるだけさ。']];
        if (f.sioneTold) return [['npc', 'normal', 'ファアレ・マイ。……口をまるくして、「ファ」。']];
        f.sioneTold = true;
        return [['me', '', '（花の首飾りのおじさんが、ウクレレを弾きながら、こちらに手をふっている）'], ['npc', 'normal', 'ようこそ！ この島の決まりを、教えてあげよう。'], ['npc', 'normal', '島から帰るときは、島の言葉をひとつ、言っていかなきゃいけない。「ファアレ・マイ」。'], ['npc', 'normal', '……言えなかったら？ ふふ、ずっと島にいることになるかもな。冗談だよ。半分はね。']];
      },
      kids(S) {
        const f = S.f;
        if (S.back && f.wordOk) return [['npc', 'normal', 'ファアレ・マイ！ ……旅の人、もう笑わないよ。上手になったもん。']];
        if (S.back) return [['npc', 'normal', 'ファーレ……マ……あはは！ 旅の人、まだ言えないの？']];
        if (f.practiced) { f.wordOk = true;
          return [['me', '', '……ファアレ・マイ。'], ['npc', 'normal', '……あ。言えた。'], ['npc', 'normal', '（子どもたちが、ぱちぱちと手をたたいた）'], ['npc', 'normal', 'アンナ先生より上手！ 先生、十年いるのに、まだ「ファーレ」って言うんだよ。']].map(l => l[2].startsWith('（子ども') ? ['me', '', l[2]] : l); }
        f.kidsLaugh = true;
        return [['me', '', '……ファーレ・マイ？'], ['npc', 'normal', 'あはははは！ ちがうちがう、それ「ぼくのお尻」って意味！'], ['me', '', '（子どもたちが、砂の上を転げまわって笑っている）'], ['npc', 'normal', '口をまるくして、「ファ」！ それから、ちょっと止まって、「アレ」！']];
      },
      anna_n(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', '……言えないまま、行くしかないわね。戻ってこられなくても、それも島の決まりだもの。']];
        if (f.annaOk) return [['npc', 'normal', '……言えた。十年かかった。あしたの船で、ちゃんと言ってくるわ。']];
        if (f.wordOk) { f.annaOk = true;
          return [['me', '', '子どもたちに笑われながら、言えるようになりました。……アンナさんも、いっしょに。'], ['npc', 'normal', '……あしたの船で、母のところへ帰るの。母が、もう長くないって。'], ['npc', 'normal', '言えないまま島を出た人は、もう戻ってこない。……島ではそう言われてるの。わたし、戻ってきたいのに。'], ['me', '', '（ふたりで、浜に向かって、何度も言う。ファ……、ひと息止めて、アレ・マイ）'], ['me', '', '（九回目で、アンナさんの声が、すっと通った）'], ['npc', 'normal', '……ファアレ・マイ。']]; }
        if (!f.kidsLaugh) return [['npc', 'normal', '島の看護師のアンナよ。十年前に、海の向こうから来たの。……あしたの船で、いったん島を出るの。']];
        f.practiced = true;
        return [['npc', 'normal', '子どもたちに笑われた？ ……わたしもよ。十年、ずっと。'], ['npc', 'normal', 'こつはね、「ファ」のあとで、息をひとつ止めるの。……わたしは、それができないんだけど。'], ['npc', 'normal', '……島の人たちは、わたしが言えないのを、ちょっと喜んでる気がするの。言えたら、帰っちゃうと思ってるのかしら。']];
      }
    }
  });

// ---------------------------------------------------------------- 55 台所の近道（スコールで足止めされた受験生を、郵便配達が家々の中を通して送る）
  C.push({
    id: 'vietna', shape: '人の家の中を通る近道', name: 'ベトナ', sub: 'スコールの街', time: 'morning', screens: 5, far: 'karst_morning', map: [21, 105.8],
    weather: { squall: 8, drizzle: 2 }, weatherBack: { clear: 7, drizzle: 1 },
    hill: '#24382a', ground: ['#6a7050', '#4a4a38', '#7a7a60'], tint: 'rgba(160,200,180,.05)', bscale: 1.0,
    props: [['bucket2', 600, 50], ['stool2', 1300, 40], ['rice_basket', 2300, 60], ['bucket', 3300, 50], ['palm', 4400, 300]],
    buildings: [['sea_twostory', 800, 0.9], ['sea_shop', 1700, 0.9], ['sea_tall', 2600, 0.9], ['sea_twostory', 3500, 0.9]],
    npcs: [
      { id: 'binh', name: '受験生のビン', actor: 'boy_student', x: 1000, face: 1 },
      { id: 'ba', name: '軒先のバーおばあさん', actor: 'granny_broom', x: 1450, face: -1 },
      { id: 'lan', name: '郵便配達のラン', actor: 'postwoman', x: 1900, face: -1 },
      { id: 'school', name: '試験の門番', actor: 'stationmaster', x: 4300, face: -1 }
    ],
    places: [{ id: 'kitchens', name: '家々の台所', x: 2900, verb: '通り抜ける', when: f => f.lanLead }],
    animals: [['chicks', 2200], ['cat_white', 3100], ['dog_spot', 3800]],
    talk: {
      binh(S) {
        const f = S.f;
        if (S.back && f.arrived) return [['npc', 'normal', '試験、受けられたよ。……答案のはしっこに、ちょっと魚醤のにおいがついてたけど。']];
        if (S.back) return [['npc', 'normal', '……間に合わなかった。来年、また受ける。軒下で、一年分の雨を見た気がする。']];
        if (f.arrived) return [['npc', 'normal', '……間に合った。人の家の台所を、五軒も通ってきた。']];
        if (f.binhTold) return [['npc', 'normal', '大通りは川みたい。……走ったら、答案より先に、ぼくがびしょぬれになる。']];
        f.binhTold = true;
        return [['me', '', '（スコールの軒下に、学生服の男の子が、本の包みを胸に抱いて立ちつくしている）'], ['npc', 'normal', '……九時から、中学の入学試験なんです。あと二十分。'], ['npc', 'normal', '大通りは膝まで水。回り道をしたら、一時間かかる。……三年、この日のために勉強したのに。']];
      },
      ba(S) {
        const f = S.f;
        if (S.back) return [['npc', 'normal', 'けさは、うちの台所を、ずいぶんたくさんの足が通ったね。……泥の掃除は、ランにやらせたよ。']];
        return [['npc', 'normal', '雨宿りかい。ここの軒は広いから、遠慮しなさんな。'], ['me', '', '（おばあさんは、ほうきで、軒先に入ってくる水を、せっせと押しもどしている）'], ['npc', 'normal', 'この街のスコールは、一時間は止まないよ。……急ぐ人には、気の毒だがね。']];
      },
      lan(S) {
        const f = S.f;
        if (S.back && f.arrived) return [['npc', 'normal', '台所の道は、郵便配達だけのひみつだったんだけどね。……ま、一度くらいはいいか。']];
        if (S.back) return [['npc', 'normal', '雨の日の手紙は、乾かしてから配るの。……きょうは、ちょっと配達がおそくなった。']];
        if (f.lanLead) return [['npc', 'normal', 'ついてきて。靴は手に持って。……「失礼します」は、大きな声でね。']];
        if (!f.binhTold) return [['npc', 'normal', 'ふう、ずぶぬれ。……手紙だけは、かばんの中で無事よ。']];
        f.lanLead = true;
        return [['npc', 'normal', '試験？ 学校まで二十分？ ……ふうん。'], ['npc', 'normal', '大通りを通るから、遠いのよ。郵便配達の道を教えてあげる。'], ['npc', 'normal', 'この街の家は、裏の台所どうしがつながってるの。手紙を届けるうちに、通らせてもらうようになった。'], ['npc', 'normal', '五軒抜ければ、学校の裏門。……さあ、ふたりとも、ついてきて！']];
      },
      kitchens(S) {
        const f = S.f;
        if (S.back) return [['me', '', '（晴れた台所の窓から、朝ごはんの湯気が流れてくる）']];
        if (f.arrived) return [['me', '', '（台所の戸の向こうから、まだ「がんばってね」の声が聞こえる）']];
        f.arrived = true;
        return [['me', '', '（ランのあとについて、裏戸をくぐる。……一軒目の台所では、おばさんがフォーを煮ていた）'], ['me', '', '（「失礼します！」「あら、ラン。試験の子？ がんばって！」）'], ['me', '', '（二軒目、三軒目。鍋をよけ、鶏をよけ、洗濯物の下をくぐる。だれもが、ひと言かけていく）'], ['me', '', '（五軒目の勝手口を出ると、学校の裏門だった。……鐘が、ちょうど鳴りはじめた）']];
      },
      school(S) {
        const f = S.f;
        if (S.back && f.arrived) return [['npc', 'normal', '台所から出てきた受験生は、四十年で初めてだ。……答案から、フォーのいいにおいがしたよ。'], ['insight', '', 'いちばんの近道は、道ではなく、街じゅうの台所の「がんばって」でできていた。']];
        if (S.back) return [['npc', 'normal', 'けさの試験は、雨で来られなかった子が多かったな。']];
        return [['npc', 'normal', '試験は九時。……門は、時間どおりに閉める。雨でも、晴れでもな。']];
      }
    }
  });

  
// ---------------------------------------------------------------- 56 宿帳の帰りの欄（「帰りにまた泊まる」と書いた客を、宿は四十年待っていた）
  C.push({
    id: 'swissa', shape: '宿帳の帰りの欄', name: 'スイシア', sub: '峠の山小屋', time: 'dusk', screens: 5, far: 'snow_peaks_noon', timeBack: 'morning', map: [46.6, 8.2],
    hill: '#2a3438', ground: ['#6a8058', '#445438', '#7a9068'], tint: 'rgba(255,190,150,.05)', bscale: 1.0,
    props: [['pine', 300, 300], ['ship_bell', 1300, 130], ['haystack', 2300, 120], ['pine_snow', 3300, 320], ['rock_moss', 4400, 80]],
    buildings: [['lumber_hut', 800, 1.3], ['inn', 1900, 0.95], ['nordic_red', 3700, 0.85]],
    npcs: [
      { id: 'hans', name: '宿の主人ハンス', actor: 'innkeeper', x: 2150, face: -1 },
      { id: 'beat', name: '大工のベアト', actor: 'builder', x: 1100, face: 1 },
      { id: 'heidi', name: 'ハイニ（主人の孫）', actor: 'alpboy', x: 3000, face: -1 }
    ],
    places: [{ id: 'book', name: '宿帳', x: 2400, verb: '書く', when: f => f.hansTold }],
    weather: { clear: 5, snow: 3, fog: 2 },
    animals: [['cow', 2700, { mode: 'stay' }], ['dog_mastiff', 1600, { mode: 'stay' }], ['crow', 3900]],
    talk: {
      beat(S) {
        const f = S.f;
        if (S.back && f.backSigned) return [['npc', 'normal', '取り壊しはやめだ。……屋根を直すことになった。ハンスさんが、「帰りの欄に、まだ空きがある」ってさ。']];
        if (S.back) return [['npc', 'normal', '来月、宿をたたむそうだ。……おれは、壊す役だ。']];
        return [['me', '', '（大工が、宿の古い屋根を見上げて、首をふっている）'], ['npc', 'normal', '旅の人、この宿に泊まるのかい。……たぶん、最後の客の一人になるよ。'], ['npc', 'normal', '屋根も柱も、限界だ。ハンスさんは、来月で宿をたたむと言ってる。直すより、壊すほうが安い。']];
      },
      hans(S) {
        const f = S.f;
        if (S.back && f.backSigned) return [['npc', 'normal', '……帰りの欄に、あんたの名前が書いてある。'], ['npc', 'normal', '峠を越えて戻る客は多い。だが「東の端まで」と書いた客は、だれも戻らなかった。'], ['npc', 'normal', '……四十年で、あんたが最初だよ。'], ['npc', 'normal', 'あの人は、来なかった。……でも、あんたが来た。宿は、もう少し続けることにする。'], ['insight', '', '四十年空いていた帰りの欄は、わたしの名前で、はじめて閉じた。']];
        if (S.back) return [['npc', 'normal', 'おかえり。……帰りの欄に、書いていくかね。いや、むりにとは言わん。']];
        if (f.signed) return [['npc', 'normal', '帰りの欄は、空けておく。……あんたも、あの人みたいに、空けたままにならんでくれよ。']];
        if (f.hansTold) return [['npc', 'normal', '宿帳は、そこの台の上だ。名前と、どこへ行くか。それから、帰りに寄るかどうか。']];
        f.hansTold = true;
        return [['npc', 'normal', 'いらっしゃい。……宿帳に、名前を書いてくれるかね。'], ['npc', 'normal', 'この宿の宿帳には、欄が二つある。「行き」と「帰り」。峠を越える人は、たいてい戻ってくるからね。'], ['npc', 'normal', '……四十年前、「東の端まで歩いて、帰りにまた泊まる」と書いた旅人がおった。'], ['npc', 'normal', 'その人の帰りの欄は、まだ空いておる。……部屋も、そのままにしてある。それも、来月までだが。']];
      },
      book(S) {
        const f = S.f;
        if (S.back && !f.backSigned) { f.backSigned = true;
          return [['me', '', '（宿帳を開く。行きの欄に、自分の名前。そのとなりの帰りの欄は、空いている）'], ['me', '', '（ペンを取って、帰りの欄に、もう一度名前を書いた）'], ['me', '', '（ずっと前のページの、四十年空いたままの帰りの欄が、ふと目に入った）']]; }
        if (S.back) return [['me', '', '（帰りの欄に、インクがまだ乾ききっていない）']];
        if (f.signed) return [['me', '', '（行きの欄に、わたしの名前。帰りの欄は、空いている）']];
        f.signed = true;
        return [['me', '', '（古い宿帳。行きの欄は、びっしり。帰りの欄は、ところどころ空いている）'], ['me', '', '（行きの欄に、名前と「東の端まで」と書いた。……帰りの欄は、空けておく）']];
      },
      heidi(S) {
        const f = S.f;
        if (S.back && f.backSigned) return [['npc', 'normal', 'じいちゃん、ゆうべ、四十年前の客の部屋を開けて、窓をふいてたよ。……「また、だれか来るかもしれん」って。']];
        if (S.back) return [['npc', 'normal', '来月から、ぼくら下の町に住むんだって。……牛は、連れていけるかな。']];
        return [['npc', 'normal', 'じいちゃんの宿帳、見た？ ぼくが生まれた日も、書いてあるんだよ。「孫、来る」って。'], ['npc', 'normal', '……あの空いてる帰りの欄の人、どうして来なかったんだろう。']];
      }
    }
  });

// ---------------------------------------------------------------- 57 父の宝の地図（屋根裏の地図をたどると、子ども時代の父の手紙が埋まっていた）
  C.push({
    id: 'kiwia', shape: '宝の正体は親の子ども時代', name: 'ニュージーラ', sub: '羊の丘', time: 'noon', screens: 5, far: 'valley', timeBack: 'dusk', map: [-41.3, 174.8],
    hill: '#2a4a2a', ground: ['#6a9a50', '#446a34', '#7aaa60'], tint: 'rgba(255,250,220,.03)', bscale: 1.0,
    props: [['tree_green', 400, 280], ['rock_moss', 1600, 80], ['big_tree1', 2600, 330], ['rock2', 3400, 90], ['haystack', 4300, 120]],
    buildings: [['thatched_farm', 800, 0.9], ['sheep_pen', 3800, 0.9]],
    npcs: [
      { id: 'jack', name: 'ジャック', actor: 'boy_cap', x: 1000, face: 1 },
      { id: 'ruby', name: 'ルビー（ジャックの妹）', actor: 'schoolgirl', x: 1350, face: -1 },
      { id: 'dad', name: 'ジャックの父さん', actor: 'ranchhand', x: 3600, face: -1 }
    ],
    places: [
      { id: 'tree', name: '「巨人の木」', x: 2650, verb: '掘る', when: f => f.mapRead },
      { id: 'map', name: '屋根裏の地図', x: 1180, verb: '読む', when: f => f.jackTold }
    ],
    weather: { clear: 6, wind: 2, drizzle: 2 },
    animals: [['sheep', 3900], ['sheep', 4050], ['sheep', 4200], ['dog_spot', 3400], ['crow', 2000]],
    talk: {
      jack(S) {
        const f = S.f;
        if (S.back && f.dug) return [['npc', 'normal', '父さん、ゆうべ、箱の手紙を読んで、ずっと笑ってた。それから、ちょっと泣いてた。'], ['npc', 'normal', '……こんどは、ぼくたちの手紙を埋めるんだ。三十年後の、ぼくへ。']];
        if (S.back) return [['npc', 'normal', '宝、見つからなかった。……地図、まちがってたのかな。']];
        if (f.dug) return [['npc', 'normal', '金貨じゃなかった……。でも、なんか、父さんに見せたい。']];
        if (f.jackTold) return [['npc', 'normal', '地図、読める？ ぼくらの字じゃないんだ。すごく下手な字。']];
        f.jackTold = true;
        return [['me', '', '（男の子と女の子が、古い紙を地面に広げて、額をくっつけている）'], ['npc', 'normal', '旅の人！ 宝の地図、見つけたんだ！ 屋根裏の、古いトランクの底で！'], ['npc', 'normal', '「巨人の木」から、西へ十歩、羊一頭ぶん下。……でも、巨人の木って、どれ？'], ['npc', 'normal', 'あしたは羊の毛刈りで、一日じゅう手伝いなんだ。きょうしか、探せない！'], ['npc', 'normal', '……それに、丘の古い木、毛刈りが済んだら切るんだって。根っこごと。']];
      },
      ruby(S) {
        const f = S.f;
        if (S.back && f.dug) return [['npc', 'normal', '父さん、九歳のとき、羊を百頭数えたかったんだって。いま、三百頭いるよ。']];
        if (S.back) return [['npc', 'normal', '……あの地図、父さんに見せたら、変な顔してた。']];
        return [['npc', 'normal', '地図のすみに、名前が書いてあるの。「トム、九さい」。……トムって、だれ？'], ['npc', 'normal', '……父さんの名前も、トムなんだけど。まさかね。']];
      },
      map(S) {
        const f = S.f;
        if (S.back && f.dug) return [['me', '', '（地図は、缶といっしょに父さんの手に渡った。地面には、紙の四すみを押さえていた小石だけ）']];
        if (S.back) return [['me', '', '（地図は風にあおられて、すみの「トム、九さい」だけが、ぱたぱた見える）']];
        if (f.mapRead) return [['me', '', '（「巨人の木」の絵は、枝が一本だけ、ぐいっと横に突き出している）']];
        f.mapRead = true;
        return [['me', '', '（下手な字と、羊の絵がたくさん。丘の真ん中に、大きな木の絵）'], ['me', '', '（木の枝が一本だけ、ぐいっと横に突き出している。……丘の上の、あの大木に、そんな枝がある）']];
      },
      tree(S) {
        const f = S.f;
        if (S.back) return [['me', '', '（大木の根もとに、掘りかえした跡。新しい土を、だれかがまた踏み固めてある）']];
        if (f.dug) return [['me', '', '（根もとの穴は、ふたりが埋め戻した）']];
        f.dug = true;
        return [['me', '', '（横に突き出た枝の下から、西へ十歩。……羊一頭ぶんの深さを、三人で掘る）'], ['me', '', '（かちん。さびたクッキーの缶が出てきた）'], ['me', '', '（中には、ビー玉が三つと、羊の毛のかたまりと、折りたたんだ手紙）'], ['me', '', '（「大人になったぼくへ。羊は百頭になった？ まだ、ひとりで寝られる？ トム、九さい」）']];
      },
      dad(S) {
        const f = S.f;
        if (S.back && f.dug) return [['npc', 'normal', '……三十年、すっかり忘れてた。あの木の下に、ぼくが埋まってたなんて。'], ['npc', 'normal', '木を起こす前で、よかった。……根っこごと、九歳のぼくを捨てるところだった。'], ['npc', 'normal', '羊は、三百頭になったよ。……ひとりで寝られるかは、まあ、聞かないでくれ。'], ['insight', '', '子どもたちが掘りあてた宝は、三十年前の、九歳の父親そのものだった。']];
        if (S.back) return [['npc', 'normal', 'あの地図？ ……どこかで見た気もするんだがな。思い出せない。']];
        return [['npc', 'normal', '旅の人、ジャックたちを見なかったか。毛刈りの準備を、手伝わせたいんだが。'], ['npc', 'normal', '丘の上の大木も、もう中が空っぽでな。毛刈りが済んだら、根っこごと起こす。'], ['npc', 'normal', '……宝の地図？ ははは、子どものころは、だれでも作るもんさ。おれも作った気がする。忘れたけど。']];
      }
    }
  });

  
// ---------------------------------------------------------------- 58 掃くものを残す（引退する掃除夫のために、町は散らかさない。それが、いちばん困らせた）
  C.push({
    id: 'wiena', shape: '最後の仕事をとっておく', name: 'オーストリカ', sub: '石だたみの都', time: 'morning', screens: 5, far: 'twilight', timeBack: 'dusk', map: [48.2, 16.4],
    hill: '#2a2a3a', ground: ['#9a9088', '#6a6058', '#aaa098'], tint: 'rgba(255,220,180,.04)', bscale: 1.0,
    props: [['tree_autumn', 400, 280], ['stool2', 1300, 40], ['tree_autumn', 2300, 300], ['wall_flowers', 3200, 110], ['tree_autumn', 4300, 290]],
    buildings: [['it_townhouse', 800, 0.9], ['bakery', 1800, 0.9], ['uk_terrace', 2800, 0.9], ['house_large', 3800, 0.9]],
    npcs: [
      { id: 'franz', name: '掃除夫のフランツ', actor: 'sweeper', x: 1000, face: 1 },
      { id: 'mitzi', name: 'パン屋のミッツィ', actor: 'baker_girl', x: 2000, face: -1 },
      { id: 'otto', name: 'オットー（郵便局の子）', actor: 'greenboy', x: 3500, face: -1 }
    ],
    places: [{ id: 'leaves', name: '石だたみの通り', x: 2600, verb: '見る' }],
    weather: { clear: 5, wind: 4, drizzle: 1 },
    animals: [['dog_dane', 1500], ['crow', 2800], ['cat_white', 3900]],
    talk: {
      franz(S) {
        const f = S.f;
        if (S.back && f.leafPlan) return [['npc', 'normal', '……落ち葉が、一枚ずつ、手紙つきだった。「四十年ありがとう」「坂のところ、助かりました」。'], ['npc', 'normal', '町じゅうの戸口から一枚ずつ。……ぜんぶ掃いて、ぜんぶ持って帰った。'], ['insight', '', '掃除夫への最後の贈り物は、掃いて集められる、ひと通りぶんの落ち葉だった。']];
        if (S.back) return [['npc', 'normal', '……最後の日に、掃くものがひとつもなかった。いい町だ。いい町だが。']];
        if (f.franzTold) return [['me', '', '（フランツさんは、ほうきを持ったまま、きれいすぎる通りを、端から端まで見わたしている）']];
        f.franzTold = true;
        return [['me', '', '（ほうきとちり取りを持ったおじいさんが、石だたみの真ん中で、ぽつんと立っている）'], ['npc', 'normal', '……旅の人、この通りに、ごみが落ちていないかね。葉っぱ一枚でも。'], ['npc', 'normal', 'きょうで、四十年の掃除の仕事が終わりなんだ。……なのに、けさから、町に何も落ちていない。'], ['npc', 'normal', '最後の日くらい、ゆっくり掃いて終わりたかったんだがね。']];
      },
      mitzi(S) {
        const f = S.f;
        if (S.back && f.leafPlan) return [['npc', 'normal', 'ゆうべ、掃いておこうって言い出したの、わたしなの。……よかれと思って。'], ['npc', 'normal', 'だから、うちのは長く書いた。「ごめんなさい。それと、四十年ぶんの朝のパン、焼きたてで待ってます」']];
        if (S.back) return [['npc', 'normal', 'ぴかぴかの町でお別れ。……でもフランツさん、さびしそうだったわ。']];
        if (f.leafPlan) return [['npc', 'normal', '落ち葉に手紙！ ……オットーが、町じゅうに知らせて回ってるわ。']];
        if (!f.franzTold) return [['npc', 'normal', 'おはよう、旅の人。きょうは町じゅう、早起きして掃除したのよ。フランツさんの最後の日だから。']];
        return [['npc', 'normal', 'フランツさんの最後の日でしょう。町じゅうで決めたの。ゆっくり休んでもらおうって。'], ['npc', 'normal', 'だから、ゆうべから、みんなで自分の家の前を掃いたのよ。……葉っぱ一枚、残さずに。']];
      },
      leaves(S) {
        const f = S.f;
        if (S.back && f.leafPlan) return [['me', '', '（夕方の通りは、やっぱりきれいだ。……ただ、ほうきの跡が、ていねいに一本ずつ残っている）']];
        if (S.back) return [['me', '', '（通りは、朝と同じに、ぴかぴかのまま）']];
        return [['me', '', '（並木は、こんなに葉を落としているのに、石だたみには一枚もない）'], ['me', '', '（……どの家の戸口にも、落ち葉を詰めた袋が、こっそり置いてある）']];
      },
      otto(S) {
        const f = S.f;
        if (S.back && f.leafPlan) return [['npc', 'normal', '三百枚くらい集まったよ。フランツさん、一枚ずつ、ゆっくり掃いてた。……ぜんぶ読みながら。']];
        if (S.back) return [['npc', 'normal', 'フランツさん、ほうきを返しに来たよ。……一度も使ってない顔をしてた。']];
        if (f.leafPlan) return [['npc', 'normal', '書けた人から、戸口の前に一枚ずつ！ ……ぼく、まだ十軒しか回れてない！']];
        if (!f.franzTold) return [['npc', 'normal', 'フランツさん、きょうで終わりなんだって。……ぼく、毎朝、あの人のほうきの音で起きてたんだ。']];
        f.leafPlan = true;
        return [['me', '', 'フランツさん、掃くものがなくて、困っていました。……最後の日くらい、ゆっくり掃いて終わりたいって。'], ['npc', 'normal', '……え。きれいにしたら、喜ぶと思ってた。'], ['npc', 'normal', 'そうだ！ 落ち葉を、一枚ずつ置いてもらおう。葉っぱに、ありがとうって書いて。'], ['npc', 'normal', 'ぼく、町じゅうに知らせてくる！ 郵便局の子は、足が速いんだ！']];
      }
    }
  });

// ---------------------------------------------------------------- 59 壁の向こうの遊び相手（知らないふりを、おたがいに続けていた）
  C.push({
    id: 'maltia', shape: '壁の向こうの遊び相手', name: 'マルティア', sub: '石垣の島', time: 'noon', screens: 5, far: 'sea_noon', timeBack: 'dusk', map: [35.9, 14.5],
    hill: '#8a7a5a', ground: ['#c8b088', '#a08860', '#d8c098'], tint: 'rgba(255,230,180,.05)', bscale: 1.0,
    props: [['tree_olive', 400, 220], ['stone_well', 1200, 90], ['tree_olive', 2600, 240], ['wall_flowers', 3000, 110], ['tree_green', 4300, 260]],
    buildings: [['med_white', 700, 0.9], ['caravan_wall', 1900, 0.9], ['gr_chapel', 2700, 0.85], ['es_white', 3600, 0.9]],
    npcs: [
      { id: 'ninamt', name: 'ニーナ', actor: 'braidgirl', x: 1000, face: 1 },
      { id: 'carmela', name: 'カルメラばあさん', actor: 'fisher_granny', x: 2400, face: -1 },
      { id: 'salvu', name: 'サルヴじいさん', actor: 'wheelchair', x: 3400, face: -1 }
    ],
    places: [{ id: 'wall', name: '高い石垣', x: 1800, verb: '見る' }],
    weather: { clear: 6, wind: 3 },
    animals: [['cat_calico', 1500], ['hen', 2900], ['dog_spot', 4000]],
    talk: {
      ninamt(S) {
        const f = S.f;
        if (f.ballBack) {
          if (f.ninaGot && S.back) return [['npc', 'normal', 'さっき、紙を巻いて投げたの。……石垣の向こうで、だれかが、はなをすすってた。']];
          if (f.ninaGot) return [['npc', 'normal', '石垣の上で、レモンの枝がゆれてる。……向こうで、聞いてるのかな。']];
          f.ninaGot = true;
          return [['me', '', '（赤いボールと、レモンを渡す。……だれが返したかは、言わずに）'], ['npc', 'normal', '……ありがとう。あのね、旅の人。ほんとは、知ってたの。'], ['npc', 'normal', 'レモンの木があるの、この島じゃサルヴさんちだけだもん。'], ['npc', 'normal', 'サルヴさん、子どものふりしてるでしょ。だから、わたしも知らないふりしてたの。'], ['npc', 'normal', '……お別れは、紙に書いて巻いて投げる。「サルヴさんへ。夏休みには、また投げにくるね」'], ['insight', '', '石垣ごしの遊び相手は、知らないふりを、おたがいに続けてくれていた。']];
        }
        if (S.back) return [['npc', 'normal', '……ボール、まだ返ってこない。向こうの子、もう遊ぶの、いやになったのかな。']];
        if (f.ninaTold) return [['npc', 'normal', '石垣、ぐるっと回れば向こうに出られるよ。わたしは、井戸より先、行っちゃだめなの。']];
        f.ninaTold = true;
        return [['me', '', '（女の子が、空っぽの両手を、石垣のほうへ伸ばしたまま立っている）'], ['npc', 'normal', '旅の人。毎日三時に、この石垣の向こうへボールを投げるの。'], ['npc', 'normal', 'すぐ投げ返してくれるの。ときどき、レモンが一個、くっついてくる。'], ['npc', 'normal', '……でも、きょうは返ってこない。向こうの子、どうしたんだろう。'], ['npc', 'normal', '来週、本島に引っ越すの。……その前に、一回でいいから、お別れを言いたいのに。'], ['npc', 'normal', '見たことないの。声も聞いたことない。……見てきてくれる？']];
      },
      wall(S) {
        const f = S.f;
        if (S.back && f.ballBack) return [['me', '', '（石垣の向こうで、車いすのきしむ音。……だれかが、こちら側の音を待っている）']];
        if (S.back) return [['me', '', '（石垣の上に、レモンの枝の先だけが、のぞいている）']];
        return [['me', '', '（大人の背の倍はある石垣。上から、レモンの枝が一本だけ、こちらへはみ出している）'], ['me', '', '（石のすき間に、赤いゴムのかすが、いくつもこびりついている。……何年ぶんだろう）']];
      },
      carmela(S) {
        const f = S.f;
        if (S.back && f.ballBack) return [['npc', 'normal', 'サルヴが、庭の石垣のきわまで出てきてるよ。……あんなとこ、何年ぶりかね。']];
        if (S.back) return [['npc', 'normal', '石垣の向こう？ ……あの人、きょうは窓も開けてないね。']];
        if (!f.ninaTold) return [['npc', 'normal', 'いい風だろう。この島の石垣は、風よけなんだよ。人よけじゃない。']];
        return [['npc', 'normal', 'あの高い石垣の向こうは、サルヴの庭さ。レモンの木のある家。'], ['npc', 'normal', '脚を悪くしてから、門の外へ出なくなってね。……子どもなんか、いない家だよ。']];
      },
      salvu(S) {
        const f = S.f;
        if (S.back && f.ballBack) return [['npc', 'normal', '……三時は、とうに過ぎたな。あの子、待ちくたびれていないかね。'], ['npc', 'normal', 'あの子、来週ここを出るそうだ。……それまでに、肩、治さんとな。']];
        if (S.back) return [['npc', 'normal', '……ボールは、そこの棚にある。投げられないなら、もう終わりだ。']];
        if (f.salvuMet) return [['npc', 'normal', 'ボール、届けてくれたかね。……わしのことは、言わんでくれよ。']];
        if (!f.ninaTold) return [['npc', 'normal', '……旅の人か。うちの庭は、レモンしかないよ。']];
        f.salvuMet = true; f.ballBack = true;
        return [['me', '', '（車いすのおじいさんが、ひざの上に、赤いボールをのせている）'], ['npc', 'normal', '……あの子に、頼まれたのか。きょうは、肩が上がらなくてな。'], ['npc', 'normal', 'あの子は、向こうに同い年の友だちがいると思っとる。……がっかりさせたくない。'], ['npc', 'normal', 'これを、あの子に。レモンもつけて。……だれが返したかは、内緒だ。'], ['me', '', '（赤いボールと、レモンを一個、あずかった）']];
      }
    }
  });

// ---------------------------------------------------------------- 60 まちがいを模様にする（ほどかずに、もう一本足す）
  C.push({
    id: 'persia', shape: 'まちがいを模様にする', name: 'ペルシャナ', sub: '絨毯の村', time: 'morning', screens: 5, far: 'mountains', timeBack: 'dusk', map: [34.0, 51.4],
    hill: '#6a5040', ground: ['#b89870', '#8a6a48', '#c8a880'], tint: 'rgba(255,210,170,.05)', bscale: 1.0,
    props: [['tree_olive', 400, 230], ['mint_table', 1300, 60], ['textile_stall', 2400, 140], ['stone_well', 3100, 90], ['tree_green', 4300, 270]],
    buildings: [['mideast_white', 700, 0.9], ['adobe', 1800, 0.9], ['in_market', 2900, 0.85], ['mideast_white', 3800, 0.9]],
    npcs: [
      { id: 'leila', name: 'レイラ', actor: 'hijab', x: 900, face: 1 },
      { id: 'dariush', name: '絨毯屋のダリウシュ', actor: 'turban', x: 2000, face: -1 },
      { id: 'maryam', name: 'マルヤムばあさん', actor: 'granny_scarf', x: 3400, face: -1 }
    ],
    places: [{ id: 'rug', name: '店先の古い絨毯', x: 2500, verb: '見る' }],
    weather: { clear: 6, wind: 3, drizzle: 1 },
    animals: [['cat_persian', 1500], ['donkey', 2800], ['rooster', 4000]],
    talk: {
      leila(S) {
        const f = S.f;
        if (f.river && S.back) return [['npc', 'normal', '二本めの青、あと半分。……夕方の糸は、川の色がちょっと深く見えるね。']];
        if (f.river) return [['npc', 'normal', '反対がわにも、青を一列！ ……二本で、川にする！ 手、止まらない！']];
        if (f.grannyTold) {
          f.river = true;
          return [['me', '', 'おばあさんの最初の絨毯にも、青い一列があるそうです。……ほどかなかったって。'], ['npc', 'normal', '……おばあちゃんも？ ほどかずに、どうしたの？'], ['me', '', '反対がわにも、もう一本、足したそうです。'], ['npc', 'normal', '……もう一本。そっか。一本だと、まちがい。二本だと……。'], ['npc', 'normal', '川！ 花の野原を流れる、青い川にする！'], ['npc', 'normal', '花嫁さんの家の前にも、ほんとうに川が流れてるの。……ぴったり。'], ['insight', '', 'まちがいは、ほどかずに、もう一本足すと、模様になる。']];
        }
        if (S.back) return [['npc', 'normal', '……ほどくのは、一週間かかる。あしたには、間に合わない。']];
        if (f.leilaTold) return [['npc', 'normal', 'おばあちゃんには、まだ言えない。……わたしの、はじめての絨毯なのに。']];
        f.leilaTold = true;
        return [['me', '', '（女の子が、機の前で手を止めて、糸の一列をじっとにらんでいる）'], ['npc', 'normal', '旅の人、見て、ここ。赤のはずが、一列だけ、青になってる。'], ['npc', 'normal', 'あしたの朝、いとこの嫁入りに持っていくの。……はじめて、ひとりで織った絨毯。'], ['npc', 'normal', 'ほどいたら、一週間かかる。……おばあちゃんに、どう言えばいいの。']];
      },
      dariush(S) {
        const f = S.f;
        if (S.back && f.grannyTold) return [['npc', 'normal', 'ばあさん、きょうは孫の機のほうを、わざと見ないようにしてる。……わざとらしくてね。']];
        if (S.back) return [['npc', 'normal', '夕方の糸は、色がよく見えん。織るのは、朝のうちさ。']];
        return [['npc', 'normal', 'いらっしゃい。店先の古いのは、マルヤムばあさんの絨毯だよ。'], ['npc', 'normal', 'ばあさんのは、どれも一か所だけ、どこかがちがう。……わざとだって言う人もいる。']];
      },
      rug(S) {
        const f = S.f;
        if (S.back) return [['me', '', '（夕日のなかで、古い絨毯の、さかさまの星がひとつ、光っている）']];
        f.rugSeen = true;
        return [['me', '', '（赤と紺の、星の模様。……すみのひとつだけ、星がさかさまだ）'], ['me', '', '（となりの絨毯は、鳥が一羽だけ、反対を向いている。……たしかに、どれも一か所ずつ）']];
      },
      maryam(S) {
        const f = S.f;
        if (S.back && f.grannyTold) return [['npc', 'normal', 'あの子の母さんの嫁入りの絨毯にも、わたしの青が二列あるのよ。'], ['npc', 'normal', '……あの子は、まだ知らない。いつか、自分で見つけるでしょう。']];
        if (S.back) return [['npc', 'normal', 'レイラ、夕ごはんにも来ないの。……あの子、なにか困ってるのね。']];
        if (!f.leilaTold) return [['npc', 'normal', 'おはよう。孫が、はじめての絨毯を仕上げているのよ。……のぞいちゃだめって言われてるの。']];
        if (!f.rugSeen) return [['npc', 'normal', 'レイラが、困った顔？ ……店先の、わたしの古い絨毯を見てきてごらんなさい。']];
        f.grannyTold = true;
        return [['npc', 'normal', '……さかさまの星を見たのね。あれは、わざとよ。まちがいのない絨毯は、息ができないの。'], ['npc', 'normal', 'でも、いちばん最初のは、ほんとうのまちがいだった。青を一列、まちがえた。'], ['npc', 'normal', 'ほどかないで、反対のはしにも、青を一列足したの。……そうしたら、模様になった。'], ['npc', 'normal', 'わたしから聞いたって、言わなくていいのよ。あの子が、自分で決めればいい。']];
      }
    }
  });

// ---------------------------------------------------------------- 61 探し物を隠したのは本人（針の飛ぶところを、生の音で埋める）
  C.push({
    id: 'kubana', shape: '探し物を隠したのは本人', name: 'キューバナ', sub: '色の港町', time: 'noon', screens: 5, far: 'beach_noon', timeBack: 'dusk', map: [23.1, -82.4],
    hill: '#5a7a8a', ground: ['#c8a878', '#a08058', '#d8b888'], tint: 'rgba(255,220,170,.05)', bscale: 1.0,
    props: [['palm', 400, 300], ['stool2', 1300, 40], ['palm', 2400, 320], ['wall_painting', 3100, 120], ['palm', 4300, 290]],
    buildings: [['br_townhouse', 800, 0.9], ['mx_house', 1800, 0.9], ['sea_twostory', 2800, 0.9], ['br_townhouse', 3800, 0.9]],
    npcs: [
      { id: 'pepe', name: 'ペペ', actor: 'boy_kite', x: 900, face: 1 },
      { id: 'chucho', name: '太鼓のチューチョ', actor: 'drummer', x: 2100, face: -1 },
      { id: 'rosacu', name: 'ロサばあちゃん', actor: 'es_granny', x: 3500, face: -1 }
    ],
    places: [{ id: 'hatbox', name: '窓ぎわの帽子箱', x: 3300, verb: '見る', when: f => f.cu_chuchoTold }],
    weather: { clear: 6, wind: 2, squall: 1 },
    animals: [['cat_orange', 1500], ['rooster', 2700], ['dog_brown', 4000]],
    talk: {
      pepe(S) {
        const f = S.f;
        if (f.cu_liveFill && !f.cu_gave) {
          f.cu_gave = true;
          return [['me', '', '（レコードを渡す。……どこにあったかは、言わずに）'], ['npc', 'normal', 'あった！ ……どこに？ いいや、聞かない。楽団のとこへ走る！'], ['npc', 'normal', '今夜は、ぼくが針を置く係だ。二番の頭で、太鼓に合図する。……じいちゃんの代わりに。']];
        }
        if (S.back && f.cu_liveFill) return [['npc', 'normal', '針を置く練習、十回やった。二番の頭で手を上げると、太鼓がぴたっと入るんだ。'], ['npc', 'normal', '……じいちゃんの歌と、いまの太鼓が、つながって聞こえた。']];
        if (S.back) return [['npc', 'normal', '……レコード、どこにもない。今夜のパーティー、じいちゃんの歌なしで始まっちゃう。']];
        if (f.cu_liveFill) return [['npc', 'normal', '楽団、二番の頭だけ、何回もやりなおしてる。……なんでそこだけ？']];
        if (f.cu_pepeTold) return [['npc', 'normal', '楽団は、夕方までに曲を覚えなきゃいけないんだ。……時間がない！']];
        f.cu_pepeTold = true;
        return [['me', '', '（男の子が、家じゅうの引き出しを開けっぱなしにして、通りに座りこんでいる）'], ['npc', 'normal', '旅の人！ 今夜、ばあちゃんの八十のお祝いなんだ。'], ['npc', 'normal', 'じいちゃんが若いころ、ばあちゃんのために歌って、レコードにした曲がある。世界に一枚だけ。'], ['npc', 'normal', '楽団がそれを聞いて、今夜、生で演奏するはずだった。……なのに、レコードが消えた。'], ['npc', 'normal', '夕方までに見つけないと、楽団が曲を覚えられない！']];
      },
      chucho(S) {
        const f = S.f;
        if (S.back && f.cu_liveFill) return [['npc', 'normal', '二番の頭、四小節だけ、針が飛ぶ。……そこは、おれたちが叩く。じいさんの声の続きを。']];
        if (S.back) return [['npc', 'normal', '曲なしでも、なにか叩くさ。……でも、あの曲じゃなきゃ、ロサは踊らない。']];
        if (f.cu_liveFill) return [['npc', 'normal', 'ロサが、二番の頭を練習しとけって？ ……六十年ぶりの注文だ。叩いてやるさ。']];
        if (f.cu_chuchoTold) return [['npc', 'normal', '帽子箱は、ロサの家の窓ぎわさ。……あそこだけ、日が当たらない。']];
        f.cu_chuchoTold = true;
        return [['npc', 'normal', 'あのレコード？ 一度だけ、ロサの家で聞いたことがある。'], ['npc', 'normal', '……二番に入るところで、針が飛ぶんだ。傷がある。じいさんの、いちばんいいところで。'], ['npc', 'normal', 'ロサは、あのとき、すぐ針を上げた。……それきり、だれにも聞かせなくなった。'], ['npc', 'normal', '帽子箱を探してみな。ロサの大事なものは、昔から、ぜんぶそこだ。']];
      },
      hatbox(S) {
        const f = S.f;
        if (S.back) return [['me', '', '（帽子箱は、ふたを開けたまま。中には、薄紙だけが、レコードの形にへこんで残っている）']];
        f.cu_boxSeen = true;
        return [['me', '', '（開いた窓の奥に、色あせた帽子箱。薄紙に包んで、レコードが一枚）'], ['me', '', '（紙に、ふるえた字で「わたしの歌」。……隠したのは、ロサばあちゃん本人だ）']];
      },
      rosacu(S) {
        const f = S.f;
        if (S.back && f.cu_liveFill) return [['npc', 'normal', '……あの人の声の、飛んだところに、いまの太鼓が入るのね。'], ['npc', 'normal', '六十年、そこだけ聞けなかった。今夜は、そこで踊るわ。'], ['insight', '', '傷のある歌は、隠さなくていい。飛んだところは、いま生きている音で埋められる。']];
        if (S.back) return [['npc', 'normal', 'パーティー？ ……ええ、行くわよ。歌がなくても、ケーキはあるもの。']];
        if (f.cu_liveFill) return [['npc', 'normal', '……チューチョに、二番の頭を練習しておけって、伝えてちょうだい。']];
        if (!f.cu_boxSeen) return [['npc', 'normal', 'あら、旅の人。ペペが騒いでるでしょう。……あの子には、悪いことをしてるの。']];
        f.cu_liveFill = true;
        return [['npc', 'normal', '……見つけちゃったのね。そう、隠したのは、わたし。'], ['npc', 'normal', 'あの人の歌の、いちばんいいところで、針が飛ぶの。……みんなの前で、あれを聞くのがこわかった。'], ['me', '', 'チューチョさんが言っていました。……飛ぶところは、楽団が叩けるって。'], ['npc', 'normal', '……あの人の声の続きを、いまの人が？ ……それなら、聞ける気がする。'], ['npc', 'normal', 'レコードは、ペペに持っていって。わたしから、だなんて言わないで。']];
      }
    }
  });

// ---------------------------------------------------------------- 62 数え歌の数が合わない（消えた一頭は、孫の行く先で数えられていた）
  C.push({
    id: 'namibia', shape: '数え歌の数が合わない', name: 'ナミビナ', sub: '赤い砂の村', time: 'noon', screens: 5, far: 'red_rocks_noon', timeBack: 'dusk', map: [-19.5, 13.5],
    hill: '#8a4a30', ground: ['#c87a50', '#a05a38', '#d88a60'], tint: 'rgba(255,190,140,.06)', bscale: 1.0,
    props: [['tree_dead', 400, 260], ['rock2', 1400, 80], ['cactus', 2300, 150], ['rock', 3200, 70], ['tree_dead', 4300, 280]],
    buildings: [['adobe', 700, 0.85], ['thatched_farm', 1700, 0.85], ['kr_school', 3600, 0.85]],
    npcs: [
      { id: 'tuli', name: 'トゥリ', actor: 'tribekid', x: 900, face: 1 },
      { id: 'meme', name: 'メメばあちゃん', actor: 'granny_andes', x: 2000, face: -1 },
      { id: 'mwalimu', name: '寄宿学校の先生', actor: 'teacher', x: 3400, face: -1 }
    ],
    places: [{ id: 'hoof', name: '東へのびる足あと', x: 2700, verb: '見る' }],
    weather: { clear: 7, wind: 3 },
    animals: [['cow', 1300], ['cow', 1450], ['hawk', 2600], ['cow', 3800]],
    talk: {
      tuli(S) {
        const f = S.f;
        if (f.nmTeacher && !f.nmVerse) {
          f.nmVerse = true;
          return [['me', '', 'ナンガは、学校にいました。……あした入る子みんなに、毎朝ミルクを出すそうです。'], ['npc', 'normal', '……ぼくの学校？ ばあちゃん、ナンガで、ぼくの学校代を……。'], ['npc', 'normal', 'だから十二番、歌えなかったんだ。……歌ったら、泣くから。'], ['npc', 'normal', 'じゃあ、十二番、つくりなおす。「学校のナンガ、白いしっぽ」。'], ['npc', 'normal', 'ぼくが、あっちで数える。……そしたら、数え歌は、ちゃんと十二になる。'], ['insight', '', '数え歌から消えた一頭は、孫の行く先で、まだ数えられていた。']];
        }
        if (S.back && f.nmVerse) return [['npc', 'normal', '十一番まで歌って、それから、十二番。「学校のナンガ、白いしっぽ」。'], ['npc', 'normal', '……あしたから、ぼくが毎朝、ナンガを数える番なんだ。']];
        if (S.back) return [['npc', 'normal', '……もうすぐ日が沈む。夜は、ハイエナが出る。ナンガ、どこ行ったんだ。']];
        if (f.nmVerse) return [['npc', 'normal', '十二番、つくりなおす！ ……「学校のナンガ」。ばあちゃんに、教えてやるんだ。']];
        if (f.nmTuli) return [['npc', 'normal', '足あと、東へ続いてる。……ぼくは、牛囲いを見てなきゃ。']];
        f.nmTuli = true;
        return [['me', '', '（男の子が、牛囲いの柵に足をかけて、牛の背中を指で数えている）'], ['npc', 'normal', '旅の人。ばあちゃんは毎晩、数え歌で牛を数えるんだ。一番から十二番まで。'], ['npc', 'normal', '十二番は「白いしっぽのナンガ」。……けさ、ばあちゃん、十二番を飛ばして、歌い終わった。'], ['npc', 'normal', 'いま数えたら、十一頭。ナンガがいない。……日が沈む前に見つけないと。'], ['npc', 'normal', 'ぼく、あしたから、遠くの学校に行くんだ。その前に、ちゃんと十二頭にしておきたい。']];
      },
      meme(S) {
        const f = S.f;
        if (S.back && f.nmVerse) return [['npc', 'normal', '……トゥリが、十二番を、つくりなおしたって？ あの子の声で、聞かせてもらおうかね。']];
        if (S.back && f.nmTeacher) return [['npc', 'normal', '学校の先生に、会ったのかい。……あの子には、あしたの朝、わたしから言うつもりだったのよ。']];
        if (S.back) return [['npc', 'normal', '……十二番はね、もう歌わないの。歌わなくていい番なのよ。']];
        if (!f.nmTuli) return [['npc', 'normal', '暑いだろう。日陰に入りな。……牛は、日が傾いたら帰ってくる。']];
        return [['npc', 'normal', 'ナンガ？ ……あの子は、いい牛だったよ。よく乳の出る、白いしっぽの。'], ['npc', 'normal', '……「だった」なんて言っちゃったね。孫には、言わないでおくれ。']];
      },
      hoof(S) {
        const f = S.f;
        if (S.back) return [['me', '', '（東への足あとの上に、学校へ向かう、小さな靴のあとが重なっている）']];
        return [['me', '', '（ひづめのあとが一頭ぶん、東へ。……となりに、大人のサンダルのあとが並んでいる）'], ['me', '', '（迷った牛の足あとじゃない。だれかが、つないで連れていった）']];
      },
      mwalimu(S) {
        const f = S.f;
        if (S.back && f.nmTeacher) return [['npc', 'normal', '白いしっぽの牛は、名前を変えずに飼います。「ナンガ」のまま。……そう、伝えてください。']];
        if (S.back) return [['npc', 'normal', 'あしたの朝は、新入生が来ます。……ミルクの用意は、もうできていますよ。']];
        if (f.nmTeacher) return [['npc', 'normal', '入学の名簿に、トゥリの名前があります。……学費は、牛一頭で払われました。']];
        f.nmTeacher = true;
        return [['me', '', '（学校の庭で、白いしっぽの牛が草をはんでいる。首の札に、ふるえた字で「トゥリの分」）'], ['npc', 'normal', 'その札ですか。けさ、メメさんが牛を連れてきて、自分で結んでいきました。'], ['npc', 'normal', '寄宿の子どもたちに、毎朝ミルクを出してもらいます。……あしたから、その孫の分も。'], ['npc', 'normal', 'メメさんは、孫には言わないでくれと。……でも、旅の人は、孫じゃありませんね。']];
      }
    }
  });

// ---------------------------------------------------------------- 63 こっそりの練習は町じゅうに聞こえていた（隠れて重ねた音を、町はもう覚えていた）
  C.push({
    id: 'tunisia', shape: 'こっそりの練習は町じゅうに聞こえていた', name: 'チュニジナ', sub: '青い扉の町', time: 'noon', screens: 5, far: 'sea_noon', timeBack: 'dusk', map: [36.9, 10.3],
    hill: '#6a8aa0', ground: ['#d8c8a8', '#b0a080', '#e8d8b8'], tint: 'rgba(200,230,255,.05)', bscale: 1.0,
    props: [['palm', 400, 300], ['wall_flowers', 1200, 110], ['stone_well', 1800, 90], ['palm', 2900, 290], ['wall_flowers', 4200, 110]],
    buildings: [['med_white', 700, 0.9], ['mideast_white', 1500, 0.9], ['es_white', 2700, 0.9], ['med_white', 3700, 0.9]],
    npcs: [
      { id: 'amina', name: 'アミーナおばさん', actor: 'levant_woman', x: 900, face: 1 },
      { id: 'karim', name: 'カリム', actor: 'boy_student', x: 2600, face: -1 },
      { id: 'youssef', name: 'ラッパのユーセフじいさん', actor: 'teaseller', x: 3500, face: -1 }
    ],
    places: [{ id: 'cistern', name: '古い貯水槽の入り口', x: 1850, verb: '見る' }],
    weather: { clear: 7, wind: 3 },
    animals: [['cat_white', 1300], ['donkey', 3100], ['cat_calico', 4100]],
    talk: {
      amina(S) {
        const f = S.f;
        if (S.back && f.tn_yes) return [['npc', 'normal', '合図の三つめで裏返るんでしょう。……町じゅう、そこで歌いだすつもりよ。']];
        if (S.back) return [['npc', 'normal', '合図なしで灯すしかないわね。……毎年、あの音が楽しみだったのに。']];
        if (f.tn_amina) return [['npc', 'normal', 'じつはね、あの下手なラッパ、毎晩、窓を開けて聞いてたの。……三つめで、つい笑っちゃう。']];
        f.tn_amina = true;
        return [['me', '', '（女の人が、青い扉の前で、手書きのびらを見つめて、ため息をついている）'], ['npc', 'normal', '旅の人。今夜は港の灯り祭り。ラッパの合図で、船がいっせいに灯りをつけるの。'], ['npc', 'normal', '毎年吹くユーセフじいさんが、きのう前歯が抜けて、吹けなくなっちゃった。'], ['npc', 'normal', 'ふしぎなのよ。この一か月、夜になると、町の下からラッパの音がするの。'], ['npc', 'normal', '……下手なの。三つめの音で、いつも裏返る。でも、だれが吹いてるのか、わからない。']];
      },
      cistern(S) {
        const f = S.f;
        if (S.back && f.tn_yes) return [['me', '', '（貯水槽の入り口に、だれかが、青い扉と同じ色のリボンを結んでいった）']];
        if (S.back) return [['me', '', '（石段の下は、しんとしている。今夜は、だれも吹かないらしい）']];
        return [['me', '', '（石段が、地面の下へ降りている。古い貯水槽の入り口だ）'], ['me', '', '（石段の途中に、ラッパの吹き口を磨く布が、ひとつ落ちている）']];
      },
      karim(S) {
        const f = S.f;
        if (f.tn_old && !f.tn_yes) {
          f.tn_yes = true;
          return [['me', '', 'ユーセフさんが言っていました。三つめの音で、町じゅうがくすっと笑って、一緒に口ずさむって。'], ['npc', 'normal', '……え。聞こえてたの？ 地面の下なのに？'], ['me', '', '貯水槽は、町じゅうの井戸とつながっているそうです。'], ['npc', 'normal', '……じゃあ、一か月ぶん、ぜんぶ。裏返るところも、ぜんぶ。'], ['npc', 'normal', '……わかった。吹く。裏返ったら、みんなが歌ってくれるんでしょ。'], ['insight', '', '隠れて重ねた練習を、町じゅうが、とっくに一緒に覚えていた。']];
        }
        if (S.back && f.tn_yes) return [['npc', 'normal', '三つめ、裏返った。……そしたら港じゅうが歌って、船の灯りが、いっせいについた。']];
        if (S.back) return [['npc', 'normal', '……ラッパ？ 持ってないよ。ぼく、なんにも吹けないし。']];
        if (f.tn_yes) return [['npc', 'normal', '日が沈んだら、港の先で吹く。……三つめ、わざと裏返そうかな。']];
        if (f.tn_karim) return [['npc', 'normal', '……貯水槽？ 知らない。ぼく、あそこには、行ってない。']];
        f.tn_karim = true;
        return [['me', '', '（男の子が、背中に布の包みを隠して、壁にもたれている。金色のはしがのぞく）'], ['npc', 'normal', '旅の人。……ねえ、夜に、変な音、聞こえたりする？'], ['npc', 'normal', '聞こえないよね。地面の下なら、だれにも聞こえないもんね。'], ['npc', 'normal', '……なんでもない。祭りなんて、ぼく、関係ないし。']];
      },
      youssef(S) {
        const f = S.f;
        if (S.back && f.tn_yes) return [['npc', 'normal', 'あの裏返り、わしの若いころと、そっくりじゃ。……わしも、ああだった。']];
        if (S.back) return [['npc', 'normal', '今夜は、合図なしか。……地面の下の音も、きのうから止まっとる。']];
        if (f.tn_old) return [['npc', 'normal', 'わしのラッパも貸すぞ。……あの子のより、ちと、裏返りにくい。']];
        if (!f.tn_amina) return [['me', '', '（おじいさんが、口を手でおさえて、ふがふが笑っている）'], ['npc', 'normal', 'ふぁふぁ。旅の人か。歯が一本、休みをとってな。']];
        f.tn_old = true;
        return [['me', '', '（前歯の抜けたおじいさんが、窓辺でラッパを磨いている）'], ['npc', 'normal', 'ふぁふぁ。歯が一本、休みをとってな。今夜の合図は、吹けんのじゃ。'], ['npc', 'normal', '代わり？ もう、おる。毎晩、地面の下から聞こえとる。カリムじゃよ。'], ['npc', 'normal', '三つめで裏返るたびに、町じゅうがくすっと笑って、それから一緒に口ずさむ。'], ['npc', 'normal', '本人は、だれにも聞かれとらんと思っとる。……伝えてやってくれんか。']];
      }
    }
  });

// ---------------------------------------------------------------- 64 動物が助けを呼びに来た（言葉のない使いが、いちばん確かだった）
  C.push({
    id: 'bhutan', shape: '動物が助けを呼びに来た', name: 'ブータナ', sub: '祈りの旗の谷', time: 'noon', screens: 5, far: 'snow_peaks_noon', timeBack: 'dusk', map: [27.5, 90.4],
    hill: '#4a6a5a', ground: ['#7a8a5a', '#5a6a40', '#8a9a6a'], tint: 'rgba(220,235,255,.05)', bscale: 1.0,
    props: [['pine', 400, 300], ['prayer_flags', 1700, 220], ['rock_moss', 2600, 110], ['pine_snow', 3100, 300], ['prayer_flags', 4200, 230]],
    buildings: [['house_small', 700, 0.9], ['pk_mountain', 2300, 0.85], ['lumber_hut', 3700, 0.85]],
    npcs: [
      { id: 'pema', name: 'ペマばあちゃん', actor: 'herbgranny', x: 900, face: 1 },
      { id: 'tashi', name: '小僧のタシ', actor: 'almsmonk', x: 2400, face: -1 },
      { id: 'dorji', name: 'ドルジじいさん', actor: 'oldman', x: 3500, face: -1 }
    ],
    places: [{ id: 'flags', name: '道に落ちた祈りの旗', x: 1750, verb: '見る' }],
    weather: { clear: 4, wind: 4, snow: 2 },
    animals: [['yak', 1150, { mode: 'stay' }], ['crow', 2700], ['yak', 3300, { mode: 'stay' }]],
    talk: {
      pema(S) {
        const f = S.f;
        if (S.back && f.bt_done) return [['npc', 'normal', 'ノルブが毛布を取りに来て、あんたまで連れていったのかい。'], ['npc', 'normal', '……子ヤクの名前？ じいさんが決めたのかい。「ペマ」？ まったく、あの人は。']];
        if (S.back) return [['npc', 'normal', '……雪の雲が、峠まで来てる。じいさん、ひと晩、外で過ごす気かね。']];
        if (f.bt_blanket) return [['npc', 'normal', 'ノルブ、あんたが毛布を持ったら、さっさと坂を登りだしたよ。……ついていっておくれ。']];
        f.bt_blanket = true;
        return [['me', '', '（おばあさんが、戸口で、ヤクの鼻づらを押し返している）'], ['npc', 'normal', '旅の人。うちのノルブが、昼に一頭だけ、山から帰ってきたの。'], ['npc', 'normal', 'じいさんは、ゆうべから上の小屋。……今夜は雪が来る。わたしの脚じゃ、登れない。'], ['npc', 'normal', 'それにこの子、戸口の毛布の箱を、角でつついてばかり。……何が言いたいんだか。'], ['me', '', '（毛布をひと抱え取り出すと、ノルブは鼻を鳴らして、坂のほうへ向きを変えた）']];
      },
      flags(S) {
        const f = S.f;
        if (S.back && f.bt_done) return [['me', '', '（落ちていた旗は、だれかが結びなおしてある。風に、五色がそろって鳴る）']];
        if (S.back) return [['me', '', '（落ちた旗の上に、うっすらと雪が積もりはじめている）']];
        return [['me', '', '（祈りの旗のひもが一本、道に落ちている。ヤクの角に引っかけて、ちぎれたらしい）'], ['me', '', '（ノルブが立ち止まって、こちらをふり返る。……ついてこいと、言っているみたいだ）']];
      },
      tashi(S) {
        const f = S.f;
        if (S.back && f.bt_done) return [['npc', 'normal', '子ヤクが生まれたって？ ……あしたの朝のお祈り、ひとつ増やします。']];
        if (S.back) return [['npc', 'normal', 'お寺の鐘、もう鳴らしました。雪の前の鐘です。……みんな、家に入る時間。']];
        return [['npc', 'normal', 'ドルジさん？ けさ、上の小屋で、母ヤクのそばにしゃがんでました。'], ['npc', 'normal', '子が生まれそうだから、離れられないって。……ノルブに何か言ってましたよ。'], ['npc', 'normal', 'ノルブは、毎朝ペマさんが毛布を干すのを、じっと見てるんです。どこにあるか、知ってるんですよ。']];
      },
      dorji(S) {
        const f = S.f;
        if (S.back && f.bt_done) return [['npc', 'normal', '子ヤクは、毛布の中で寝とる。……ばあさんの名前をつけた。怒られるかな。']];
        if (S.back) return [['npc', 'normal', '……毛布はまだか。ノルブのやつ、ちゃんと家に着いたかな。']];
        if (f.bt_done) return [['npc', 'normal', '雪がやんだら、三頭で下りる。ノルブと、母さんと、ちびと。']];
        if (!f.bt_blanket) return [['me', '', '（おじいさんが、母ヤクの横にしゃがみこんで、手をこすり合わせている）'], ['npc', 'normal', '……旅の人か。すまんが、いまは、ここを離れられん。']];
        f.bt_done = true;
        return [['me', '', '（小屋のわきで、母ヤクが横たわり、生まれたての子ヤクが、雪の中でふるえている）'], ['npc', 'normal', '……毛布！ ノルブ、ほんとに持ってこさせたのか。'], ['npc', 'normal', '「毛布を取ってこい」と言って帰したんだ。……ヤクにだぞ。半分は、やけくそさ。'], ['me', '', '（毛布でくるむと、子ヤクのふるえが、ゆっくり止まった）'], ['npc', 'normal', 'ノルブのやつ、手伝いまで連れてきた。……手紙より、よっぽど確かだ。'], ['insight', '', '言葉を持たない使いは、言われたことに、自分で一つ足して帰ってきた。']];
      }
    }
  });

// ---------------------------------------------------------------- 65 ふたりの記憶はどちらも正しかった（ちがっていたのは、木のあった年だけ）
  C.push({
    id: 'georgia', shape: 'ふたりの記憶はどちらも正しかった', name: 'ジョージナ', sub: 'くるみの谷', time: 'noon', screens: 5, far: 'vineyard_morning', timeBack: 'dusk', map: [41.7, 44.8],
    hill: '#5a6a40', ground: ['#9a8a60', '#7a6a40', '#aa9a70'], tint: 'rgba(255,230,190,.05)', bscale: 1.0,
    props: [['tree_green', 400, 290], ['clay_oven', 1200, 100], ['stump2', 1650, 60], ['tree_old_roots', 2700, 310], ['grape_vat', 4200, 80]],
    buildings: [['house_small', 700, 0.9], ['it_tuscan', 2100, 0.85], ['house_large', 3700, 0.85]],
    npcs: [
      { id: 'nino', name: 'ニノおばあさん', actor: 'ru_granny', x: 900, face: 1 },
      { id: 'giorgi', name: 'ギオルギじいさん', actor: 'oldsmith', x: 2300, face: -1 },
      { id: 'tamar', name: 'タマルおばあさん', actor: 'granny_apron', x: 3500, face: -1 }
    ],
    places: [{ id: 'stump', name: '大きな切り株', x: 1650, verb: '見る' }],
    weather: { clear: 6, wind: 3, drizzle: 1 },
    animals: [['rooster', 1400], ['dog_spot', 2600], ['sheep', 4100]],
    talk: {
      nino(S) {
        const f = S.f;
        if (S.back && f.gj_walnut) return [['npc', 'normal', 'タマルが、くるみを割りに来たの。五十年ぶりに、並んで台所に立ったわ。'], ['npc', 'normal', '……あの子、くるみの殻を割るのが、わたしより下手。そこだけは、昔のまま。']];
        if (S.back) return [['npc', 'normal', '……パンは焼いたわ。くるみ入りでね。タマルは、きっと手をつけない。']];
        if (f.gj_nino) return [['npc', 'normal', '小さいころ、母さんの横で、くるみを割る係だったの。……指が覚えてるのよ、あの殻の音。']];
        f.gj_nino = true;
        return [['me', '', '（おばあさんが、かまどの前で、こねた生地を、こぶしでぎゅっと押している）'], ['npc', 'normal', '旅の人。今夜は、孫娘の婚礼。うちの母さんのパンを焼くの。'], ['npc', 'normal', '母さんのパンには、くるみが入ってた。まちがいない。わたしは、この舌で覚えてる。'], ['npc', 'normal', 'なのに妹のタマルは、くるみなんか入ってなかったって。……それで、ひと月、口もきいてない。'], ['npc', 'normal', 'かまどは一つ。夕方までに一回しか焼けない。……どっちかが、婚礼でむくれることになるのよ。']];
      },
      stump(S) {
        const f = S.f;
        if (S.back && f.gj_walnut) return [['me', '', '（切り株のわきの若木に、だれかが、婚礼の白いリボンを結んでいった）']];
        if (S.back) return [['me', '', '（切り株の上に、くるみの殻がひとつ。夕日で、まだあたたかい）']];
        return [['me', '', '（両手を広げても足りない、大きな切り株。まん中に、雷に打たれたような黒い割れ目）'], ['me', '', '（すぐわきに、背丈ほどの若いくるみの木が、一本だけ育っている）']];
      },
      giorgi(S) {
        const f = S.f;
        if (S.back && f.gj_walnut) return [['npc', 'normal', '若木のくるみが、婚礼のパンに入る。……親の木も、文句はなかろう。']];
        if (S.back) return [['npc', 'normal', '姉妹げんかか。……あの家は、昔から、パンのことになると、ゆずらん。']];
        if (f.gj_giorgi) return [['npc', 'normal', 'くるみは、その袋ぶん持っていけ。若木の、はじめての実だ。']];
        f.gj_giorgi = true;
        return [['npc', 'normal', '切り株を見たかね。あれは、谷でいちばんのくるみの木だった。'], ['npc', 'normal', 'タマルが生まれた年の冬に、雷で割れてな。切るしかなかった。'], ['npc', 'normal', 'それから何年も、谷には、くるみがなかった。……パンにも、入れようがなかったろう。'], ['npc', 'normal', 'わきの若木は、わしが、親の木の実から育てた。ことし、はじめて実をつけた。持っていけ。'], ['me', '', '（くるみを、ひと袋あずかった）']];
      },
      tamar(S) {
        const f = S.f;
        if (S.back && f.gj_walnut) return [['npc', 'normal', '姉さん、殻を割るのが、昔からうまいのよ。……くやしいから、言わないけど。']];
        if (S.back) return [['npc', 'normal', '……くるみ入り？ 知らないわ。わたしの母さんのパンには、入ってなかった。']];
        if (f.gj_walnut) return [['npc', 'normal', 'くるみ、割ってから行くわ。……姉さんのかまどに、ふたり分の手で。']];
        if (!f.gj_giorgi) return [['me', '', '（おばあさんが、くるみ割り器を、引き出しの奥へしまいこんでいる）'], ['npc', 'normal', '姉さんの使い？ ……パンに、くるみなんか、入ってなかったわよ。']];
        f.gj_walnut = true;
        return [['npc', 'normal', '……くるみの木が、わたしの生まれた冬に？'], ['npc', 'normal', 'じゃあ、姉さんが小さいころは、入ってたのね。わたしが食べたのは、くるみのないパン。'], ['npc', 'normal', 'ふたりとも、母さんのパンを、ちゃんと覚えてたんだわ。……ずるい、姉さんだけ。'], ['npc', 'normal', 'そのくるみ、半分は、わたしが割る。母さんのパンを、ふたつ合わせて焼くの。'], ['insight', '', 'ふたりの記憶は、どちらも正しかった。ちがっていたのは、木のあった年だけだった。']];
      }
    }
  });

// ---------------------------------------------------------------- 66 手放すのが遅れていたのは人のほう（鷹は、とっくに決めていた）
  C.push({
    id: 'kazakh', shape: '手放すのが遅れていたのは人のほう', name: 'カザフナ', sub: '鷹の草原', time: 'noon', screens: 5, far: 'highland', timeBack: 'dusk', map: [43.2, 76.9],
    hill: '#6a7a50', ground: ['#a0a070', '#7a7a50', '#b0b080'], tint: 'rgba(255,230,190,.05)', bscale: 1.0,
    props: [['rock', 600, 80], ['haystack', 1500, 120], ['rock2', 2700, 110], ['cairn_built', 2850, 120], ['rock_moss', 4200, 90]],
    buildings: [['yurt', 800, 0.9], ['yurt_smoke', 1900, 0.9], ['stable', 3800, 0.85]],
    npcs: [
      { id: 'erlan', name: 'エルラン', actor: 'herdboy', x: 900, face: 1 },
      { id: 'aigul', name: 'アイグル（エルランの母）', actor: 'scarfwoman', x: 2000, face: -1 },
      { id: 'bolat', name: '鷹使いのボラトじいさん', actor: 'falconer', x: 3500, face: -1 }
    ],
    places: [{ id: 'ridge', name: '高い岩場', x: 2800, verb: '見上げる' }],
    weather: { clear: 6, wind: 4 },
    animals: [['horse_bay', 1300], ['hawk', 2850, { mode: 'fly' }], ['sheep', 3200], ['horse', 4100]],
    talk: {
      erlan(S) {
        const f = S.f;
        if (f.kz_grand && !f.kz_yes) {
          f.kz_yes = true;
          return [['me', '', '岩場の上で、野生の鷹が二羽、輪をかいていました。……アクは、毎夕そこを見ているそうです。'], ['me', '', 'それと、おじいさんは、ほんとうは去年、放すはずだったそうです。'], ['npc', 'normal', '……じいちゃんも、放したくなかったの？ 一年も？'], ['npc', 'normal', '……アクは、とっくに決めてたんだ。決められなかったのは、ぼくたちのほう。'], ['npc', 'normal', 'わかった。フードは、ぼくがはずす。……最後に、目を見て、いってらっしゃいって言う。'], ['insight', '', '手放すのが遅れていたのは、鷹ではなく、人のほうだった。']];
        }
        if (S.back && f.kz_yes) return [['npc', 'normal', 'フードをはずしたら、アク、一回だけふり返った。……それから、岩場まで、まっすぐ。']];
        if (S.back) return [['npc', 'normal', '……日が沈んだら、アクを放すんだって。ぼく、見に行かないから。']];
        if (f.kz_yes) return [['npc', 'normal', '夕方、岩場の下で。……泣かないように、いまから練習しとく。']];
        if (f.kz_erlan) return [['npc', 'normal', 'じいちゃんに言ってよ。アクは、ぼくたちといたいんだって。']];
        f.kz_erlan = true;
        return [['me', '', '（男の子が、革の小さなフードを、両手でにぎりしめている）'], ['npc', 'normal', '旅の人。じいちゃんが、きょうの日暮れに、鷹のアクを山へ放すって言うんだ。'], ['npc', 'normal', '十年いっしょに狩りをしたら、山に返す。そういう決まりなんだって。'], ['npc', 'normal', 'でも、アクは、ぼくたちといたいんだ。……だから、フード、隠してきた。'], ['npc', 'normal', 'じいちゃんに言ってよ。旅の人の言うことなら、聞くかもしれない。']];
      },
      aigul(S) {
        const f = S.f;
        if (S.back && f.kz_yes) return [['npc', 'normal', '今夜は、鷹の止まり木が空っぽね。……あしたから、エルランが羊の番をするって。']];
        if (S.back) return [['npc', 'normal', '日が沈むわ。……あの子、フードを持ったまま、どこへ行ったのかしら。']];
        if (!f.kz_erlan) return [['npc', 'normal', 'いらっしゃい。お茶をどうぞ。……鷹？ 奥の岩場のほうに、いるかもね。']];
        return [['npc', 'normal', 'フードを隠した？ ……あの子らしいわ。'], ['npc', 'normal', 'でもね、アクは、このひと月、夕方になると、岩場のほうばかり見てるのよ。']];
      },
      ridge(S) {
        const f = S.f;
        if (S.back && f.kz_yes) return [['me', '', '（夕焼けの岩場の上を、鷹が三羽、輪をかいている）']];
        if (S.back) return [['me', '', '（岩場の上を、二羽の鷹が、日の沈むほうへ帰っていく）']];
        f.kz_ridge = true;
        return [['me', '', '（見上げると、岩場の上で、野生の鷹が二羽、ゆっくり輪をかいている）'], ['me', '', '（足もとの石の上に、大きな羽根が一本。……アクのものとは、色がちがう）']];
      },
      bolat(S) {
        const f = S.f;
        if (S.back && f.kz_yes) return [['npc', 'normal', 'フードは、エルランがはずした。……わしより、ずっと上手にな。']];
        if (S.back) return [['npc', 'normal', '……フードがないと、アクを岩場まで運べん。今夜は、無理かもしれんな。']];
        if (f.kz_grand) return [['npc', 'normal', '十年前、アクを山から連れてきたのは、わしと、まだ赤ん坊のエルランだった。']];
        if (!f.kz_ridge) return [['me', '', '（おじいさんの腕の上で、大きな鷹が、遠くの岩場をじっと見ている）'], ['npc', 'normal', '……旅の人。この鷹の見ているほうを、見てきたかね。']];
        f.kz_grand = true;
        return [['me', '', '（おじいさんの腕の上で、大きな鷹が、遠くの岩場をじっと見ている）'], ['npc', 'normal', '岩場の二羽を見たか。……アクは、ひと月前から、あれを見とる。'], ['npc', 'normal', 'ほんとうは、去年の春に放すはずだった。……わしが、決められなんだ。一年、のばした。'], ['npc', 'normal', 'エルランは、わしが鷹を追い出すと思うとる。……逆だよ。わしが、引きとめとった。'], ['npc', 'normal', 'あの子に、伝えてくれんか。わしが言うと、言い訳に聞こえる。']];
      }
    }
  });

// ---------------------------------------------------------------- 67 ゆずり合いで止まった橋（まん中で会えば、どちらも先ではない）
  C.push({
    id: 'papua', shape: 'ゆずり合いで止まった橋', name: 'パプアナ', sub: 'つり橋の谷', time: 'noon', screens: 5, far: 'rainforest_noon', timeBack: 'dusk', map: [-6.0, 145.0],
    hill: '#2a5a3a', ground: ['#6a7a40', '#4a5a30', '#7a8a50'], tint: 'rgba(200,255,200,.04)', bscale: 1.0,
    props: [['palm', 400, 300], ['bush', 1200, 80], ['rice_basket', 1500, 60], ['bush_berry', 3300, 80], ['palm', 4300, 290]],
    buildings: [['stilt_house', 750, 0.85], ['rope_bridge_fixed', 2300, 0.9], ['stilt_house', 3900, 0.85]],
    npcs: [
      { id: 'kopa', name: '西の村のコパ', actor: 'feather', x: 1000, face: 1 },
      { id: 'tobi', name: 'トビ', actor: 'islandboy', x: 3000, face: -1 },
      { id: 'wena', name: '東の村のウェナ', actor: 'tribewarrior', x: 3600, face: -1 }
    ],
    places: [{ id: 'bridge', name: 'つり橋', x: 2300, verb: '見る' }],
    weather: { clear: 4, drizzle: 3, squall: 1 },
    animals: [['hen', 1300], ['chicks', 1380], ['dog_puppy', 3200]],
    talk: {
      kopa(S) {
        const f = S.f;
        if (f.pp_east && !f.pp_yes) {
          f.pp_yes = true;
          return [['me', '', '東の村も、同じことを言っていました。「客を先に通すのが礼儀だ」と。'], ['me', '', 'それで、トビという子が言ったんです。まん中で会えばいいのに、って。'], ['npc', 'normal', '……まん中？ どちらも、先ではない。どちらも、客ではない。'], ['npc', 'normal', 'ふむ。子どもの言うことは、ときどき、長老より礼儀正しい。'], ['npc', 'normal', '芋を担げ！ 東の村と、同時に渡る。橋のまん中で、交換だ！'], ['insight', '', 'ゆずり合いで止まった橋は、まん中で会うことで、やっと動いた。']];
        }
        if (S.back && f.pp_yes) return [['npc', 'normal', '橋のまん中で、ウェナと肩がぶつかった。……橋がゆれて、ふたりで手すりにしがみついたよ。']];
        if (S.back) return [['npc', 'normal', '日が沈む。……今年の芋の交換は、また来年か。']];
        if (f.pp_yes) return [['npc', 'normal', '芋は重いぞ。……まん中まで、だれよりも先に着いてやる。いや、同時にだったな。']];
        if (f.pp_kopa) return [['npc', 'normal', '東の村が先に渡れば、すぐにでも迎える。……向こうが動かんのだ。']];
        f.pp_kopa = true;
        return [['me', '', '（羽根飾りの男の人が、芋の山の前で、腕を組んで橋の向こうをにらんでいる）'], ['npc', 'normal', '旅の人。きょうは、年にいちどの芋の交換だ。日が沈むまでに、橋を渡って贈り合う。'], ['npc', 'normal', 'わが村の礼儀では、客を先に通す。だから、東の村が渡ってくるのを待っている。'], ['npc', 'normal', '……朝から待っている。まだ、だれも渡ってこない。']];
      },
      bridge(S) {
        const f = S.f;
        if (S.back && f.pp_yes) return [['me', '', '（つり橋のまん中に、芋の皮が少し落ちている。ここで、ふたつの村が会ったらしい）']];
        if (S.back) return [['me', '', '（つり橋の両はしに、芋の山がひとつずつ。どちらも、手つかずのまま）']];
        return [['me', '', '（谷をまたぐ、長いつり橋。両はしに、芋の山がひとつずつ置いてある）'], ['me', '', '（橋の上は、からっぽ。両方の村の人が、橋のたもとで、向こうを見ている）']];
      },
      tobi(S) {
        const f = S.f;
        if (S.back && f.pp_yes) return [['npc', 'normal', 'ぼくの考え、ほんとにやったの？ ……大人って、ときどき、すなおだね。']];
        if (S.back) return [['npc', 'normal', 'お芋、腐っちゃうよ。……大人って、なんで先に渡らないの？']];
        f.pp_tobi = true;
        return [['npc', 'normal', '旅の人、西から来たの？ 西の村、まだ渡ってこないの？'], ['npc', 'normal', 'うちの村は、客を先に通すのが礼儀なんだって。だから、朝からずっと待ってる。'], ['npc', 'normal', '……まん中で会えばいいのにね。そしたら、どっちも先じゃないでしょ。']];
      },
      wena(S) {
        const f = S.f;
        if (S.back && f.pp_yes) return [['npc', 'normal', 'コパの芋は、今年も大きい。……くやしいから、来年は、うちが先に渡ってやる。']];
        if (S.back) return [['npc', 'normal', 'まだ来ない。……西の村は、礼儀を忘れたのか。']];
        if (f.pp_east) return [['npc', 'normal', '西の村が、まん中に来るなら、わしらも行く。……先に動いたら、負けだがな。']];
        if (!f.pp_tobi) return [['me', '', '（大きな男の人が、芋の山の前で、腕を組んで橋の向こうをにらんでいる）'], ['npc', 'normal', '……西から来たのか。向こうの村は、まだ動かんか。']];
        f.pp_east = true;
        return [['me', '', '（大きな男の人が、芋の山の前で、腕を組んで橋の向こうをにらんでいる）'], ['npc', 'normal', 'わが村の礼儀では、客を先に通す。西の村が来るまで、わしらは待つ。'], ['me', '', 'トビくんが、まん中で会えばいいのに、と言っていました。'], ['npc', 'normal', '……まん中。ふむ。同時に、なら、どちらの礼儀にも、そむかんな。'], ['npc', 'normal', '西の村が、まん中に来ると言うなら、わしらも行こう。伝えてくれ。']];
      }
    }
  });

// ---------------------------------------------------------------- 68 送れないものを送る（聞いた人の言葉にすれば、波の音も届く）
  C.push({
    id: 'pilipina', shape: '送れないものを送る', name: 'フィリピナ', sub: 'ヤシの浜', time: 'morning', screens: 5, far: 'sea_morning', timeBack: 'dusk', map: [11.0, 124.0],
    hill: '#3a6a5a', ground: ['#e0d0a0', '#c0b080', '#f0e0b0'], tint: 'rgba(255,240,200,.05)', bscale: 1.0,
    props: [['palm', 400, 310], ['canoe', 1300, 60], ['palm', 2200, 300], ['pier', 3100, 90], ['palm', 4300, 300]],
    buildings: [['sea_stilt', 800, 0.85], ['sea_shop', 2600, 0.85], ['sea_stall', 3800, 0.85]],
    npcs: [
      { id: 'mayumi', name: 'マユミ', actor: 'schoolgirl', x: 900, face: 1 },
      { id: 'lito', name: '漁師のリトじいさん', actor: 'old_fisher', x: 2000, face: -1 },
      { id: 'rosa_pl', name: '郵便のロサ', actor: 'postwoman', x: 3500, face: -1 }
    ],
    places: [{ id: 'shore', name: '波打ちぎわ', x: 2900, verb: '聞く' }],
    weather: { clear: 6, wind: 2, squall: 1 },
    animals: [['hen', 1500], ['dog_brown', 2400], ['crow', 4000]],
    talk: {
      mayumi(S) {
        const f = S.f;
        if (f.pl_words && !f.pl_sent) {
          f.pl_sent = true;
          return [['me', '', '浜の人たちが、波の音を、自分の言葉で書いてくれました。……郵便のロサさんが、夕方まで待つそうです。'], ['npc', 'normal', '「朝は、ざざん」「昼は、しゃらしゃら」「舟が出るときは、どぶん」……。'], ['npc', 'normal', 'みんな、ちがう音を書いてる。……でも、ぜんぶ、うちの浜の音だ。'], ['npc', 'normal', 'わたしのは、「おばあちゃんの足もとに来る、ちいさい、さわ」。……これで、送る。'], ['insight', '', '送れない波の音も、聞いた人の言葉にすれば、手紙になって届く。']];
        }
        if (S.back && f.pl_sent) return [['npc', 'normal', 'ロサさん、手紙を持って、舟に乗った。……おばあちゃん、どの音から読むかな。']];
        if (S.back) return [['npc', 'normal', '……貝がらじゃ、だめなのかな。耳に当てると、ちゃんと、ごうごう言うのに。']];
        if (f.pl_may) return [['npc', 'normal', '郵便の舟は、日が沈む前に出ちゃう。……それまでに、海の音、入れなきゃ。']];
        f.pl_may = true;
        return [['me', '', '（女の子が、からっぽの封筒を、波のほうへ向けてかざしている）'], ['npc', 'normal', '旅の人。おばあちゃんが、寒い国の町へ引っ越したの。目の手術で、病院の近くに。'], ['npc', 'normal', '手紙に書いてあったの。「海の音が聞きたい」って。……でも、音って、封筒に入る？'], ['npc', 'normal', '郵便の舟は、日が沈む前に出ちゃう。……それまでに、なんとかして入れたいの。']];
      },
      lito(S) {
        const f = S.f;
        if (S.back && f.pl_sent) return [['npc', 'normal', 'わしの「どぶん」も入ったか。……あれは、六十年、舟を出すたびに聞いた音だ。']];
        if (S.back) return [['npc', 'normal', '貝がらか。……あれは、聞く人の耳の音さ。海の音とは、ちょっとちがう。']];
        return [['npc', 'normal', '海の音を送る？ ……ははは、網ですくっても、こぼれちまう。'], ['npc', 'normal', 'だがな、マユミのばあさんは、目が悪くなってから、手紙を読んでもらってる。'], ['npc', 'normal', '読む人の声で聞くんだ。……なら、音を「字」で書けば、声になって届くかもしれん。']];
      },
      shore(S) {
        const f = S.f;
        if (S.back && f.pl_sent) return [['me', '', '（夕方の波は、朝より低い。……ちいさく、さわ、と足もとに来る）']];
        if (S.back) return [['me', '', '（夕方の波が、浜に落ちた貝がらを、ひとつずつ転がしていく）']];
        f.pl_heard = true;
        return [['me', '', '（耳をすます。寄せる波と、引く波で、音がちがう。……引くときのほうが、細かい）'], ['me', '', '（同じ浜にいても、聞く人ごとに、ちがう音に聞こえそうだ）']];
      },
      rosa_pl(S) {
        const f = S.f;
        if (S.back && f.pl_sent) return [['npc', 'normal', '封筒、ぱんぱんよ。浜じゅうの音が入ってるんだから。……切手、一枚じゃ足りないかも。']];
        if (S.back) return [['npc', 'normal', '舟が出るわ。……マユミちゃんの手紙、まだかしら。']];
        if (f.pl_words) return [['npc', 'normal', '書けた人から、わたしのかばんへ！ ……船頭さんには、もう昼寝してもらってるわ。']];
        if (!f.pl_may) return [['npc', 'normal', '郵便です。日が沈む前に、舟で本島へ。……出す手紙は、ある？']];
        f.pl_words = true;
        return [['npc', 'normal', '海の音を、手紙に？ ……マユミちゃんのおばあさんね。手紙は、わたしが読んであげてたの。'], ['me', '', '漁師のリトさんが、音を字で書けば、読む人の声で届くかもって。'], ['npc', 'normal', '……それ、いいわ。浜じゅうの人に、ひとつずつ書いてもらいましょう。'], ['npc', 'normal', '「ざざん」でも「しゃら」でも。……舟は、わたしが乗るまで出さないから。']];
      }
    }
  });

// ---------------------------------------------------------------- 69 店の名前になった客はずっと来ていた（窓の外から、五十年）
  C.push({
    id: 'belgica', shape: '店の名前になった客はずっと来ていた', name: 'ベルギカ', sub: '運河の町', time: 'morning', screens: 5, far: 'river_bridge_night', timeBack: 'dusk', map: [51.2, 3.2],
    hill: '#4a4a5a', ground: ['#8a8078', '#6a6058', '#9a9088'], tint: 'rgba(255,220,180,.05)', bscale: 1.0,
    props: [['tree_green', 400, 280], ['signboard', 1150, 100], ['stool2', 1900, 40], ['wall_flowers', 3100, 110], ['tree_autumn', 4300, 280]],
    buildings: [['uk_terrace', 750, 0.9], ['bakery', 1500, 0.9], ['stone_bridge', 2800, 0.9], ['it_townhouse', 3800, 0.9]],
    npcs: [
      { id: 'jules', name: 'チョコレート屋のジュール', actor: 'innkeeper', x: 950, face: 1 },
      { id: 'lotte', name: 'ロッテ', actor: 'girl', x: 2100, face: -1 },
      { id: 'emma', name: '編み物のおばあさん', actor: 'granny_nordic', x: 3500, face: -1 }
    ],
    places: [{ id: 'canal', name: '運河の橋', x: 2800, verb: '見る' }],
    weather: { clear: 4, drizzle: 4, fog: 2 },
    animals: [['duck', 2600], ['duck', 2700], ['cat_black', 3900]],
    talk: {
      jules(S) {
        const f = S.f;
        if (f.bg_emma && !f.bg_done) {
          f.bg_done = true;
          return [['me', '', '橋の上で編み物をしているおばあさんが、エマさんでした。毎週土曜、孫に、おつかいをさせているそうです。'], ['npc', 'normal', '……ロッテのおばあさんが？ 五十年、毎週？'], ['me', '', 'あの日のお金は、お姉さんの貯金箱からで、こっぴどく叱られて。……顔を出せなかったそうです。'], ['npc', 'normal', '……「また来る」。ちゃんと、来てたんだな。店の外から、五十年。'], ['npc', 'normal', 'この「エマのぶん」の箱、ロッテに持たせよう。中に、ひと言だけ。「次は、店の中で」。'], ['insight', '', '店の名前になった客は、五十年、窓の外から通いつづけていた。']];
        }
        if (S.back && f.bg_done) return [['npc', 'normal', '来週の土曜、店の椅子をひとつ、窓ぎわに出しておく。……橋がよく見える席だ。']];
        if (S.back) return [['npc', 'normal', '……五十年目の箱は、きょうも店に残った。まあ、来年も作るさ。']];
        if (f.bg_jules) return [['npc', 'normal', '「エマのぶん」の箱、窓ぎわに置いてある。……取りに来るなら、きょうなんだが。']];
        f.bg_jules = true;
        return [['me', '', '（ひげのおじさんが、店の窓ぎわに、リボンのかかった小箱をひとつ置いている）'], ['npc', 'normal', '旅の人。うちの店の名前は「エマ」。……五十年前の、開店の日の、最初のお客さんの名前だ。'], ['npc', 'normal', '小さな女の子でね。小銭ぜんぶで、ひと粒だけ買って、「おいしい！ また来る！」って。'], ['npc', 'normal', '……それきり、一度も来なかった。きょうで、店は五十年。あの子のぶんの箱を作ったんだ。']];
      },
      lotte(S) {
        const f = S.f;
        if (S.back && f.bg_done) return [['npc', 'normal', '箱をわたしたら、おばあちゃん、泣いて笑ってた。……来週は、いっしょに店に入るって！']];
        if (S.back && f.bg_emma) return [['npc', 'normal', 'おばあちゃん、きょうは橋から帰ってこないの。……ずっと、お店の窓を見てる。']];
        if (S.back) return [['npc', 'normal', 'あしたは土曜。またおつかい。……おばあちゃん、どうして自分で行かないのかな。']];
        f.bg_lotte = true;
        return [['npc', 'normal', 'わたし、毎週土曜に、エマのお店に来るの。おばあちゃんのおつかい。'], ['npc', 'normal', 'お母さんも、子どものころ、毎週来てたんだって。……おばあちゃんの、おつかいで。'], ['npc', 'normal', 'でもね、おばあちゃんは、ぜったい店に入らないの。橋のところで、待ってるだけ。'], ['npc', 'normal', 'おばあちゃんの名前もエマなの。お店と同じ。……聞いたら、「よくある名前よ」だって。']];
      },
      canal(S) {
        const f = S.f;
        if (S.back && f.bg_done) return [['me', '', '（橋の手すりに、チョコレートの包み紙が一枚。リボンと同じ色だ）']];
        if (S.back) return [['me', '', '（夕方の運河に、店の窓の灯りが映っている。橋の上から、いちばんよく見える）']];
        return [['me', '', '（橋の上から、チョコレート屋の窓が、まっすぐ見える）'], ['me', '', '（手すりの一か所だけ、ペンキがすり減っている。……だれかが、何年も、ここにもたれていたみたいだ）']];
      },
      emma(S) {
        const f = S.f;
        if (S.back && f.bg_done) return [['npc', 'normal', '「次は、店の中で」ですって。……五十年ぶんの返事ね。こわいけど、行ってみる。']];
        if (S.back && f.bg_emma) return [['npc', 'normal', 'あの人、なんて言うかしら。……五十年、橋の上から見てただけなんて。']];
        if (S.back) return [['npc', 'normal', '……日が暮れるわ。編み目が、見えなくなってきた。']];
        if (f.bg_emma) return [['npc', 'normal', '顔を見せる勇気は、まだないの。……でも、伝えるだけなら。']];
        if (!f.bg_lotte) return [['me', '', '（おばあさんが、運河のほとりで編み物をしている。ときどき、橋のほうを見る）'], ['npc', 'normal', 'いいお天気ね、旅の人。……あら、雨が来そう。']];
        f.bg_emma = true;
        return [['me', '', '（おばあさんが、運河のほとりで編み物をしている。ときどき、橋のほうを見る）'], ['npc', 'normal', 'ロッテに会った？ ……そう。あの子は、わたしの孫。'], ['npc', 'normal', '……あのお店の名前、わたしなの。七つのとき、姉さんの貯金箱のお金で、ひと粒買ったの。'], ['npc', 'normal', 'こっぴどく叱られてね。もう一度行く顔がなかった。そしたら、店の名前が「エマ」になってて。'], ['npc', 'normal', '……ますます、入れなくなっちゃった。だから、子どもと孫に、毎週、行ってもらってるの。']];
      }
    }
  });

// ---------------------------------------------------------------- 70 時間ちがいで守られていた約束（朝と夕方で、五十年すれ違っていた）
  C.push({
    id: 'rapanui', shape: '時間ちがいで守られていた約束', name: 'ラパヌイナ', sub: '石積みの崖', time: 'morning', screens: 5, far: 'cliffs_morning', farBack: 'sea_dusk', timeBack: 'dusk', map: [-27.1, -109.4],
    hill: '#4a6a4a', ground: ['#7a8a5a', '#5a6a40', '#8a9a6a'], tint: 'rgba(255,240,210,.05)', bscale: 1.0,
    props: [['palm', 400, 290], ['canoe', 1400, 60], ['rock_moss', 2300, 110], ['cairn_built', 2950, 130], ['rock2', 4200, 100]],
    buildings: [['thatched_farm', 750, 0.85], ['sea_barrack', 1900, 0.85]],
    npcs: [
      { id: 'tane', name: 'タネ', actor: 'fisherboy', x: 900, face: 1 },
      { id: 'vai', name: '網つくろいのヴァイばあさん', actor: 'fisher_granny', x: 2050, face: -1 },
      { id: 'hotu', name: 'ホトゥじいさん', actor: 'hermit', x: 3450, face: -1 },
      { id: 'moana', name: 'モアナ', actor: 'ranchwife', x: 3750, face: -1, when: (f, back) => back }
    ],
    places: [{ id: 'cairn', name: '崖の上の石積み', x: 2950, verb: '見る' }],
    weather: { clear: 5, wind: 4, drizzle: 1 },
    animals: [['hen', 1200], ['horse_bay', 2500], ['crow', 4000]],
    talk: {
      tane(S) {
        const f = S.f;
        if (S.back && f.rn_meet) return [['npc', 'normal', 'じいちゃん、来年からは夕方に登るって。モアナさんと、芋を半分こするんだって。']];
        if (S.back) return [['npc', 'normal', '……じいちゃん、まだ下りてこない。崖の道、暗くなると危ないのに。']];
        if (f.rn_tane) return [['npc', 'normal', '去年、じいちゃんの残した芋を、こっそり食べたら、すごく怒られた。……半分は、だれかのなんだって。']];
        f.rn_tane = true;
        return [['me', '', '（男の子が、崖のほうを見上げて、つま先立ちしている）'], ['npc', 'normal', '旅の人。じいちゃんのホトゥは、毎年きょう、朝いちばんに、芋を持って崖を登るんだ。'], ['npc', 'normal', 'なんでかって聞いても、「約束だ」って。……なんの約束か、本人も、もう覚えてない。'], ['npc', 'normal', '崖の道は危ないから、父さんが、今年で最後にしろって。……せめて、なんの約束か、思い出させてあげたい。']];
      },
      vai(S) {
        const f = S.f;
        if (S.back && f.rn_meet) return [['npc', 'normal', '朝のホトゥと、夕方のテア。……五十年、すれ違ってたのかい。あきれた二人だよ。']];
        if (S.back) return [['npc', 'normal', '夕方の崖は、風が強い。……ホトゥ、帽子を飛ばされてなきゃいいけど。']];
        return [['npc', 'normal', 'ホトゥの約束？ ……若いころ、島の反対側の村の、テアって子と、いつもカヌーで競争してたね。'], ['npc', 'normal', 'どっちが先に着くかで、毎回けんか。ホトゥは、いつも夜明け前に出てた。'], ['npc', 'normal', 'テアは、去年の冬に亡くなったよ。……ホトゥには、まだ、ちゃんと伝わってないかもしれないね。']];
      },
      cairn(S) {
        const f = S.f;
        if (S.back && f.rn_meet) return [['me', '', '（石積みの上の芋は、きれいに半分ずつ、なくなっている）']];
        if (S.back) return [['me', '', '（夕日の石積みの上に、朝の芋が、半分だけ残っている）']];
        f.rn_cairn = true;
        return [['me', '', '（崖の上の、古い石積み。てっぺんに、芋をのせるくぼみが、二つ並んでいる）'], ['me', '', '（ひとつは朝日の側、もうひとつは夕日の側。……どちらも、長いあいだ使われてきたように、すり減っている）']];
      },
      hotu(S) {
        const f = S.f;
        if (S.back && f.rn_meet) return [['npc', 'normal', '……テア。そうだ。「先に来たほうが、半分残しておく」。それが約束だった。'], ['npc', 'normal', 'あいつ、負けずぎらいでな。最後まで残ったほうが勝ちだと言って、夕方にしか来なかったのか。'], ['npc', 'normal', 'わしは、いちばんに着こうとして、朝に来た。……五十年、ちゃんと、半分ずつ食べてたんだな。'], ['insight', '', '時間ちがいで、ふたりは五十年、同じ約束を守りあっていた。']];
        if (S.back) return [['npc', 'normal', '……日が沈むな。きょうも、だれも来ん。来るはずのだれかが、いた気がするんだが。']];
        if (f.rn_hotu) return [['npc', 'normal', '芋は、半分、ここに置いていく。……なぜ半分なのかも、思い出せんのだ。']];
        f.rn_hotu = true;
        return [['me', '', '（おじいさんが、石積みのわきに座って、芋をふたつに割っている）'], ['npc', 'normal', '……旅の人か。ここに来ると、だれかを待っとる気がする。だが、だれを待っとるのか、思い出せん。'], ['npc', 'normal', '芋は、毎年、半分食べて、半分残す。手が覚えとる。……頭は、忘れちまった。'], ['npc', 'normal', '今年で最後だそうだ。……日が沈むまで、ここにおるよ。']];
      },
      moana(S) {
        const f = S.f;
        if (f.rn_meet) return [['npc', 'normal', '父の分の芋も、ちゃんと持ってきたの。……今年は、三人で半分こね。']];
        f.rn_meet = true;
        return [['me', '', '（夕方の崖の道を、女の人が、芋の籠を抱えて登ってきた）'], ['npc', 'normal', 'あら、先客？ ……わたしはモアナ。島の反対側の村から来たの。'], ['npc', 'normal', '父のテアは、毎年この日の夕方、ここで芋を食べてた。「先に来たほうが、半分残す」約束だって。'], ['npc', 'normal', '父は、「あいつは毎年、ちゃんと半分残してる」って笑ってた。……今年から、わたしが代わりに来たの。'], ['npc', 'normal', '……あそこに座ってるおじいさんが、もしかして？']];
      }
    }
  });

// ---------------------------------------------------------------- 71 みんなが自白する（かばうための嘘が、ひとつずつ持ち寄られる）
  C.push({
    id: 'ryukyu', shape: 'みんなが自白する', name: 'リュウキュア', sub: '赤瓦の島', time: 'noon', screens: 5, far: 'beach_noon', timeBack: 'dusk', map: [26.2, 127.7],
    hill: '#3a7a5a', ground: ['#d8c8a0', '#b0a078', '#e8d8b0'], tint: 'rgba(255,240,200,.05)', bscale: 1.0,
    props: [['palm', 400, 300], ['wall_flowers', 1250, 110], ['stool', 1700, 50], ['tree_green', 2700, 270], ['palm', 4300, 300]],
    buildings: [['cn_house', 800, 0.85], ['machiya', 2200, 0.85], ['cn_house', 3400, 0.85]],
    npcs: [
      { id: 'kanta', name: 'カンタ', actor: 'boy_kite', x: 900, face: 1 },
      { id: 'uncle_ok', name: 'カンタのじいちゃん', actor: 'oldman', x: 2050, face: -1 },
      { id: 'uto', name: 'ウトおばあ', actor: 'granny_scarf', x: 3000, face: -1 },
      { id: 'kamado', name: 'となりのカマドじい', actor: 'teaseller', x: 3700, face: -1 }
    ],
    places: [{ id: 'altar', name: '縁側の供え物の皿', x: 1600, verb: '見る' }],
    weather: { clear: 5, wind: 3, squall: 2 },
    animals: [['cat_calico', 3950, { mode: 'stay' }], ['rooster', 1400], ['dog_shiba', 2500]],
    talk: {
      kanta(S) {
        const f = S.f;
        if (f.ok_cat && !f.ok_done) {
          f.ok_done = true;
          return [['me', '', 'じいちゃんも、ウトおばあも、カマドじいも、「自分が食べた」と言っていました。'], ['npc', 'normal', '……え。三人とも？ ……おばあ、甘いの食べられないのに。'], ['me', '', 'それと、カマドじいの家の猫が、けさから砂糖まみれだそうです。'], ['npc', 'normal', '……みんな、ぼくのために、うそついたの？ ……ほんとは猫なのに？'], ['npc', 'normal', 'ぼく、ちゃんと言ってくる。食べたのは猫で、うそをついたのは、みんなだって！'], ['insight', '', 'かばうための嘘は、みんなが一つずつ持ち寄ったら、笑い話になった。']];
        }
        if (S.back && f.ok_done) return [['npc', 'normal', 'おばあが、もういちど揚げてくれてる。……味見係は、ぼく。猫はだめ。']];
        if (S.back) return [['npc', 'normal', '……ぼく、食べてないのに。今夜のお盆に、ご先祖さまのお菓子がない。']];
        if (f.ok_done) return [['npc', 'normal', '猫、どこ行った？ ……おしおきに、ひげを三本だけ、くすぐってやるんだ。']];
        if (f.ok_kanta) return [['npc', 'normal', 'ほんとに食べてない！ ……縁側のお皿、見てきてよ。']];
        f.ok_kanta = true;
        return [['me', '', '（男の子が、縁側の柱にしがみついて、べそをかいている）'], ['npc', 'normal', '旅の人！ ご先祖さまに供えたお菓子が、ぜんぶなくなったの。'], ['npc', 'normal', '母ちゃんは、ぼくが食べたって。……食べてない！ でも、だれも信じてくれない。'], ['npc', 'normal', '今夜はお盆の迎え日。日が沈む前に、お菓子がないと、ご先祖さまが帰ってこれない。']];
      },
      altar(S) {
        const f = S.f;
        if (S.back && f.ok_done) return [['me', '', '（皿の上に、揚げたてのお菓子が山盛り。湯気の向こうに、香炉の煙）']];
        if (S.back) return [['me', '', '（空っぽの皿の横で、線香だけが、細く燃えている）']];
        f.ok_altar = true;
        return [['me', '', '（縁側の小さな台に、からっぽの皿。まわりに、白い砂糖の粉が散っている）'], ['me', '', '（砂糖の上に、小さな丸い足あとが、点々と。……人の足ではなさそうだ）']];
      },
      uncle_ok(S) {
        const f = S.f;
        if (S.back && f.ok_done) return [['npc', 'normal', 'わしのうそは、いちばん下手だったそうだ。……甘いものは、医者に止められとるからな。']];
        if (S.back) return [['npc', 'normal', '……カンタの顔が、まだ晴れん。わしが食べたと、言ったのにな。']];
        f.ok_c1 = true;
        return [['npc', 'normal', 'お菓子？ ……あれは、わしが食べた。うん、わしだ。'], ['npc', 'normal', '腹がへってな。ひとつのつもりが、ぜんぶ。……カンタは悪くない。そう伝えてくれ。']];
      },
      uto(S) {
        const f = S.f;
        if (S.back && f.ok_done) return [['npc', 'normal', 'また揚げるわよ。……三人ぶん、うその罰として、粉をこねてもらうからね。']];
        if (S.back) return [['npc', 'normal', '揚げなおす粉は、ある。……でも、だれが食べたのか、はっきりしないとね。']];
        f.ok_c2 = true;
        return [['npc', 'normal', 'じいさんが食べた？ ……ちがうわ。食べたのは、わたし。'], ['npc', 'normal', '……甘いもの、ほんとは、そんなに好きじゃないけどね。カンタは、悪くないの。']];
      },
      kamado(S) {
        const f = S.f;
        if (S.back && f.ok_done) return [['npc', 'normal', 'うちの猫、今夜は、縁側の出入り禁止だ。……ご先祖さまに、あいさつだけさせてやる。']];
        if (S.back) return [['npc', 'normal', '……猫が、まだ、ひげについた砂糖をなめとる。']];
        if (!(f.ok_c1 && f.ok_c2)) return [['npc', 'normal', '旅の人。……お菓子のこと？ わしが食べたよ。たぶんな。']];
        f.ok_cat = true;
        return [['npc', 'normal', '……ふたりとも、自分が食べたと？ じゃあ、わしも食べた。三人で分けたことにしよう。'], ['me', '', '（足もとで、三毛猫が、ひげについた白い粉を、しきりになめている）'], ['npc', 'normal', '……うちの猫か。けさから、砂糖まみれでな。そういえば、縁側のほうから帰ってきた。'], ['npc', 'normal', 'カンタに伝えてくれ。……犯人は猫で、うそつきは、大人三人だと。']];
      }
    }
  });

// ---------------------------------------------------------------- 72 上も下も見えないまま支え合う（人の塔は、見えない相手を信じて立つ）
  C.push({
    id: 'catalna', shape: '上も下も見えないまま支え合う', name: 'カタルナ', sub: '人の塔の広場', time: 'morning', screens: 5, far: 'valley', farBack: 'twilight', timeBack: 'dusk', map: [41.4, 2.2],
    hill: '#6a5a4a', ground: ['#b0a080', '#8a7a60', '#c0b090'], tint: 'rgba(255,225,190,.05)', bscale: 1.0,
    props: [['tree_olive', 400, 240], ['stool2', 1300, 40], ['castle_flag', 2700, 220], ['wall_flowers', 3300, 110], ['tree_olive', 4300, 250]],
    buildings: [['es_white', 750, 0.9], ['mx_church', 2350, 0.9], ['it_townhouse', 3800, 0.9]],
    npcs: [
      { id: 'nuria', name: 'ヌリア', actor: 'braidgirl', x: 900, face: 1 },
      { id: 'jordi', name: 'ヌリアの父ジョルディ', actor: 'builder', x: 2000, face: -1 },
      { id: 'avi', name: '土台のアビじいさん', actor: 'mustache', x: 3500, face: -1 }
    ],
    places: [{ id: 'bell', name: '教会の鐘', x: 2650, verb: '見上げる' }],
    weather: { clear: 7, wind: 2 },
    animals: [['dog_spot', 1500], ['crow', 2700], ['cat_orange', 4000]],
    talk: {
      nuria(S) {
        const f = S.f;
        if (f.ct_avi && !f.ct_yes) {
          f.ct_yes = true;
          return [['me', '', 'アビじいさんが言っていました。いちばん下からも、上は見えないそうです。'], ['me', '', '見えなくても、足の重さで、だれが乗ったかわかる。……五十年、そうやって立ってきたって。'], ['npc', 'normal', '……下からも、見えないの？ わたしだけじゃ、なかったんだ。'], ['npc', 'normal', 'じゃあ、登りながら、名前を呼ぶ。父さん、アビじい。……呼んだら、返事してもらう。'], ['npc', 'normal', 'てっぺんで手を上げたら、いちばん下まで、ちゃんと届くよね。'], ['insight', '', '見えない相手を信じて立つのは、塔の上も下も、同じだった。']];
        }
        if (S.back && f.ct_yes) return [['npc', 'normal', '名前を呼んだら、下から、ぜんぶ返事がきた。……アビじいの声が、いちばん大きかった。']];
        if (S.back) return [['npc', 'normal', '……塔は、きょうは建たなかった。わたしが、登らなかったから。']];
        if (f.ct_yes) return [['npc', 'normal', '鐘が鳴ったら、登る。……いまのうちに、みんなの名前、もういちど覚えとく。']];
        if (f.ct_nuria) return [['npc', 'normal', 'てっぺんは、いちばん小さい子の役なの。……代わりは、いない。']];
        f.ct_nuria = true;
        return [['me', '', '（女の子が、頭の小さなヘルメットのひもを、何度もしめなおしている）'], ['npc', 'normal', '旅の人。きょうはお祭り。正午の鐘で、みんなで人の塔を建てるの。'], ['npc', 'normal', 'わたしは、いちばん上の役。てっぺんで、手を上げるの。……でも、先週の練習で、すべっちゃった。'], ['npc', 'normal', '上からは、下が見えないの。だれが支えてるのか、わからない。……こわいの。']];
      },
      jordi(S) {
        const f = S.f;
        if (S.back && f.ct_yes) return [['npc', 'normal', 'ヌリアが、てっぺんで、わしの名前を呼んだ。……肩の上の重さが、ふっと軽くなった。']];
        if (S.back) return [['npc', 'normal', '……無理はさせられん。来年もある。……来年も、あるさ。']];
        return [['npc', 'normal', 'ヌリアの父だ。わしは、二段目。あの子の足は、いつも、わしの肩の上を通っていく。'], ['npc', 'normal', '上が軽いと、下はみんな楽になる。……あの子は、自分が重荷だと思っとるらしい。']];
      },
      bell(S) {
        const f = S.f;
        if (S.back && f.ct_yes) return [['me', '', '（夕方の鐘が鳴る。広場の石だたみに、人の輪のあとが、まだ白く残っている）']];
        if (S.back) return [['me', '', '（夕方の鐘が鳴る。広場は、もう片づけられている）']];
        return [['me', '', '（教会の鐘楼。正午まで、あと少し。……鐘つきが、綱に手をかけて待っている）']];
      },
      avi(S) {
        const f = S.f;
        if (S.back && f.ct_yes) return [['npc', 'normal', '五十一年目の塔だった。……あの子の足、思ったより、どっしりしとったぞ。']];
        if (S.back) return [['npc', 'normal', '……てっぺんの子がおらんと、塔は、ただの人の山さ。']];
        if (f.ct_avi) return [['npc', 'normal', 'わしの肩は、もう若くない。……だが、てっぺんの子の足音だけは、ちゃんと聞こえる。']];
        if (!f.ct_nuria) return [['npc', 'normal', 'おう、旅の人。わしは、塔の土台。五十年、いちばん下で立ってきた。']];
        f.ct_avi = true;
        return [['me', '', '（白い腰帯のおじいさんが、広場の石だたみの真ん中で、足をふんばっている）'], ['npc', 'normal', 'ヌリアが、こわがっとる？ ……下が見えんから、か。'], ['npc', 'normal', 'わしは五十年、いちばん下だ。下からも、上は見えん。肩と、人の背中しか見えん。'], ['npc', 'normal', 'それでも、てっぺんにだれが乗ったか、足の重さでわかる。……伝えてやってくれ。おたがい様だと。']];
      }
    }
  });

// ---------------------------------------------------------------- 73 父の遺言はよそ者に歩いてもらえ（けんかを見越した物差し）
  C.push({
    id: 'ecuadra', shape: '父の遺言はよそ者に歩いてもらえ', name: 'エクアドラ', sub: '赤道の畑', time: 'morning', screens: 5, far: 'mountains', timeBack: 'dusk', map: [-0.2, -78.5],
    hill: '#4a6a3a', ground: ['#8a7a50', '#6a5a38', '#9a8a60'], tint: 'rgba(255,235,200,.05)', bscale: 1.0,
    props: [['tree_green', 400, 280], ['haystack', 1300, 110], ['rock', 2250, 60], ['bush', 3000, 80], ['tree_green', 4300, 290]],
    buildings: [['adobe', 750, 0.85], ['thatched_farm', 3800, 0.85]],
    npcs: [
      { id: 'luis', name: '兄のルイス', actor: 'ranchhand', x: 900, face: 1 },
      { id: 'inti', name: 'インティ', actor: 'chullo', x: 2900, face: -1 },
      { id: 'pablo_ec', name: '弟のパブロ', actor: 'cowboy', x: 3500, face: -1 }
    ],
    places: [{ id: 'field', name: '父さんの畑', x: 2200, verb: '歩いて測る' }],
    weather: { clear: 5, wind: 2, drizzle: 2 },
    animals: [['llama', 1500], ['donkey', 2600], ['hen', 4000]],
    talk: {
      luis(S) {
        const f = S.f;
        if (S.back && f.ec_note) return [['npc', 'normal', '……親父のやつ、おれたちのけんかまで、畑の計算に入れてたのか。'], ['npc', 'normal', '百歩なら、五十と五十。……文句のつけようがない。親父の勝ちだ。']];
        if (S.back) return [['npc', 'normal', '……あしたは種まきの月だってのに、畑の線が、まだ引けない。']];
        if (f.ec_luis) return [['npc', 'normal', 'なわは、ヤギが食っちまった。……物差しは、もう、だれかの足しかない。']];
        f.ec_luis = true;
        return [['me', '', '（男の人が、畑のはしで、ちぎれたなわの切れはしを、ぶら下げている）'], ['npc', 'normal', '旅の人。親父の畑を、弟と半分に分ける。あしたから種まきだから、きょうじゅうに。'], ['npc', 'normal', '測りなわを、ヤギが食っちまった。おれの歩幅で測ると、弟が文句を言う。'], ['npc', 'normal', '弟の歩幅だと、おれが文句を言う。……旅の人、あんたの足で、端から端まで歩いてくれないか。']];
      },
      field(S) {
        const f = S.f;
        if (S.back && f.ec_note) return [['me', '', '（畑のまん中に、新しい杭が一本。そのわきに、古い腰かけ石）']];
        if (S.back) return [['me', '', '（夕方の畑に、自分の足あとが、まっすぐ一列に残っている）']];
        f.ec_walked = true;
        return [['me', '', '（畑の西のはしから、東のはしまで、まっすぐ歩いて数える）'], ['me', '', '（……九十八、九十九、百。ちょうど百歩）'], ['me', '', '（五十歩目のところに、平たい腰かけ石がひとつ。まわりの土だけ、よく踏み固められている）']];
      },
      inti(S) {
        const f = S.f;
        if (S.back && f.ec_note) return [['npc', 'normal', 'じいちゃんのノート、最後のページだけ、字がふるえてた。……でも、ちょっと笑ってる字だった。']];
        if (S.back) return [['npc', 'normal', '父ちゃんとルイスおじさん、また口をきいてない。……じいちゃんがいたら、怒るよ。']];
        return [['npc', 'normal', 'じいちゃんは、毎夕、畑のまん中の石に座ってたの。両方の畑を見ながら。'], ['npc', 'normal', 'じいちゃんのノート、父ちゃんが持ってる。……最後のページ、まだ、だれも読んでないの。']];
      },
      pablo_ec(S) {
        const f = S.f;
        if (S.back && f.ec_note) return [['npc', 'normal', '兄貴に、ノートを見せた。……ふたりで、腰かけ石に座って、もういちど読んだよ。']];
        if (S.back) return [['npc', 'normal', '……兄貴の足は、長すぎるんだ。親父ゆずりでな。おれの足もだが。']];
        if (f.ec_note) return [['npc', 'normal', '百歩か。……親父の字に、旅の人の足が、ぴったり合ったってわけだ。']];
        if (!f.ec_walked) return [['me', '', '（男の人が、古いノートを胸ポケットに入れたまま、畑の反対のはしをにらんでいる）'], ['npc', 'normal', '兄貴に頼まれた？ ……まず歩いてみてくれ。話は、それからだ。']];
        f.ec_note = true;
        return [['npc', 'normal', '百歩？ ……ちょっと待て。親父のノートに、何か書いてあった気がする。'], ['me', '', '（男の人が、ノートの最後のページを開く。ふるえた字で、短く書いてある）'], ['me', '', '（「畑を分けるときは、通りすがりの人に歩いてもらえ。おまえたちの足は、どっちも、わしに似すぎている」）'], ['npc', 'normal', '……親父。おれたちが、けんかするって、わかってたのか。'], ['insight', '', '父は、息子たちのけんかを見越して、通りすがりの足を物差しにしていた。']];
      }
    }
  });

// ---------------------------------------------------------------- 74 地図の空白を残す（行きたい場所を、ひとつ持ちつづける）
  C.push({
    id: 'hrvata', shape: '地図の空白を残す', name: 'クロアチナ', sub: '島めぐりの岬', time: 'noon', screens: 5, far: 'sea_noon', farBack: 'sea_dusk', timeBack: 'dusk', map: [43.5, 16.4],
    hill: '#5a7a6a', ground: ['#c8b898', '#a09070', '#d8c8a8'], tint: 'rgba(220,240,255,.05)', bscale: 1.0,
    props: [['tree_olive', 400, 240], ['stool2', 1200, 40], ['tree_olive', 2100, 250], ['lighthouse', 3000, 300], ['stool', 4100, 50]],
    buildings: [['med_white', 800, 0.9], ['sea_twostory', 1800, 0.85]],
    npcs: [
      { id: 'marija', name: '地図描きのマリヤばあさん', actor: 'herbgranny', x: 950, face: 1 },
      { id: 'ivo', name: 'イヴォ', actor: 'boy_frog', x: 1900, face: -1 },
      { id: 'ante', name: '灯台守のアンテ', actor: 'sailor', x: 2800, face: -1 }
    ],
    places: [{ id: 'cape', name: '岬のはし', x: 4100, verb: '見る' }],
    weather: { clear: 7, wind: 3 },
    animals: [['cat_white', 1400], ['crow', 3300], ['hen', 2200]],
    talk: {
      marija(S) {
        const f = S.f;
        if (f.hv_cape && !f.hv_done) {
          f.hv_done = true;
          return [['me', '', '岬のはしには、ベンチがひとつ。野の花が咲いていて、ばあさんが描いた島が、ぜんぶ見えました。'], ['npc', 'normal', '……ぜんぶ、見えるの。そう。'], ['npc', 'normal', 'ありがとう。でも、描かないわ。……わざと、残してたのよ。'], ['npc', 'normal', 'ぜんぶ描いたら、行きたいところが、なくなっちゃうでしょう。博物館には、白いまま渡すわ。'], ['npc', 'normal', 'あなたも、描かないでね。……あそこは、わたしの、まだ行ってない場所なの。'], ['insight', '', '地図に一か所の空白を残すのは、まだ行きたい場所を持ちつづけるためだった。']];
        }
        if (S.back && f.hv_done) return [['npc', 'normal', '博物館の人には、「ここは未完成です」って言うわ。……六十年かけた、未完成よ。']];
        if (S.back) return [['npc', 'normal', '……あしたの朝、博物館の人が来る。白いところは、白いまま？ 描いてしまう？']];
        if (f.hv_mar) return [['npc', 'normal', '岬のはしまで、歩いてきてくれる？ ……わたしの足じゃ、もう、灯台までも無理なの。']];
        f.hv_mar = true;
        return [['me', '', '（おばあさんが、膝の上に大きな地図を広げて、一か所だけを、指でなぞっている）'], ['npc', 'normal', '旅の人。わたしは六十年、この海岸を歩いて、地図を描いてきたの。島も、道も、ぜんぶ。'], ['npc', 'normal', '一か所だけ、白いままなの。灯台の先の、岬のはし。'], ['npc', 'normal', 'あしたの朝、この地図を、町の博物館に渡すの。「完成品」としてね。……見てきてくれる？']];
      },
      ivo(S) {
        const f = S.f;
        if (S.back && f.hv_done) return [['npc', 'normal', 'ばあちゃん、地図をたたむとき、白いところだけ、指でなでてた。']];
        if (S.back) return [['npc', 'normal', '岬のはし、ぼく、行ったことあるよ。……ばあちゃんには、言ってないけど。']];
        return [['npc', 'normal', 'ばあちゃんの地図、すごいでしょ。ぼくの家も、学校も、ぜんぶ描いてある。'], ['npc', 'normal', '……でも、ふしぎなんだ。岬のはしだけ、何度聞いても、「まだ」って言うの。']];
      },
      ante(S) {
        const f = S.f;
        if (S.back && f.hv_done) return [['npc', 'normal', 'マリヤの地図の白いところか。……灯台の明かりは、あそこまでしか届かんのさ。']];
        if (S.back) return [['npc', 'normal', '日が沈む。灯台に火を入れる時間だ。']];
        return [['npc', 'normal', 'マリヤばあさん？ 若いころから、よく、ここまで来てたよ。地図の板を抱えてな。'], ['npc', 'normal', 'でも、灯台の先には、いつも行かなかった。ここで、岬のほうを見て、引き返していく。'], ['npc', 'normal', '道が悪いわけじゃない。……「あそこは、とっておくの」って、笑ってたよ。']];
      },
      cape(S) {
        const f = S.f;
        if (S.back) return [['me', '', '（夕日の岬。ベンチの影が長くのびて、島々が、ひとつずつ暗くなっていく）']];
        f.hv_cape = true;
        return [['me', '', '（岬のはし。古いベンチがひとつ。足もとに、小さな白い野の花）'], ['me', '', '（ふり返ると、海に浮かぶ島が、ぜんぶ見える。……ばあさんの地図に描かれた、すべての島だ）']];
      }
    }
  });

// ---------------------------------------------------------------- 75 寝言で手を貸す町（昼寝の町は、眠ったまま助けてくれた）
  C.push({
    id: 'mallorca', shape: '寝言で手を貸す町', name: 'マヨルカナ', sub: '昼寝の村', time: 'noon', screens: 5, far: 'beach_noon', timeBack: 'dusk', map: [39.6, 2.9],
    hill: '#7a8a5a', ground: ['#d8c090', '#b0a070', '#e8d0a0'], tint: 'rgba(255,235,190,.06)', bscale: 1.0,
    props: [['tree_olive', 400, 240], ['stool2', 1750, 40], ['tree_green', 2600, 280], ['stool', 3250, 50], ['wall_flowers', 4200, 110]],
    buildings: [['es_white', 750, 0.9], ['bakery', 1500, 0.9], ['med_white', 3000, 0.9], ['es_white', 3900, 0.85]],
    npcs: [
      { id: 'pau', name: 'パウ', actor: 'boy_cap', x: 900, face: 1 },
      { id: 'baker_mc', name: '昼寝中のパン屋', actor: 'baker_girl', x: 1800, face: -1 },
      { id: 'tomeu', name: '昼寝中のトメウじいさん', actor: 'old_fisher', x: 3250, face: -1 }
    ],
    places: [{ id: 'fig', name: 'いちじくの木', x: 2600, verb: '実をとる' }, { id: 'donkey', name: '花壇の中のロバ', x: 3750, verb: '呼ぶ' }],
    weather: { clear: 8, wind: 1 },
    animals: [['donkey', 3700, { mode: 'stay' }], ['cat_orange', 1300], ['rooster', 2200]],
    talk: {
      pau(S) {
        const f = S.f;
        if (f.mc_home && !f.mc_done) {
          f.mc_done = true;
          return [['me', '', 'ロバのペペは、小屋にもどりました。門も、ちゃんと閉めておきました。'], ['npc', 'normal', '……ほんと？ だれも起こさずに？'], ['me', '', 'パン屋さんと、トメウじいさんが、寝言で教えてくれたんです。いちじくと、口笛三回。'], ['npc', 'normal', '……寝てる大人って、起きてる大人より、やさしいね。'], ['insight', '', '昼寝の町は、眠ったまま、寝言でちゃんと手を貸してくれた。']];
        }
        if (S.back && f.mc_done) return [['npc', 'normal', 'トメウじいさん、起きてきて、「ゆめの中で口笛を吹いた」って。……ぼく、ずっと内緒にする。']];
        if (S.back) return [['npc', 'normal', '……昼寝が終わる。トメウじいさんが起きたら、ぼく、おしまいだ。']];
        if (f.mc_done) return [['npc', 'normal', '（ひそひそ）……あとは、ぼくが起きてたことも、内緒ね。']];
        if (f.mc_pau) return [['npc', 'normal', 'しーっ。……大人が起きる前に、ペペを小屋にもどさなきゃ。']];
        f.mc_pau = true;
        return [['me', '', '（男の子が、通りのまん中で、つま先立ちのまま固まっている）'], ['npc', 'normal', '（ひそひそ）旅の人。いま、村じゅう昼寝の時間なんだ。'], ['npc', 'normal', 'ぼく、トメウじいさんのロバ小屋の門、開けっぱなしにしちゃった。ロバのペペが逃げたの。'], ['npc', 'normal', 'じいさんが起きる前に、もどさなきゃ。……でも、ペペ、ぼくの言うこと、ぜんぜん聞かないの。']];
      },
      baker_mc(S) {
        const f = S.f;
        if (S.back && f.mc_done) return [['npc', 'normal', 'ふぁあ。……いちじくが、ふたつ、へってる。ゆめの中で、だれかにあげた気がするわ。']];
        if (S.back) return [['npc', 'normal', 'ふぁあ……よく寝た。さ、夕方のパンを焼かなきゃ。']];
        f.mc_fighint = true;
        return [['me', '', '（パン屋のおかみさんが、店先の椅子で、口をあけて眠っている）'], ['npc', 'normal', '……むにゃ。ペペは……いちじくが……好き……ほら、ほら……むにゃ。'], ['me', '', '（……寝言だ）']];
      },
      fig(S) {
        const f = S.f;
        if (S.back) return [['me', '', '（夕方のいちじくの木。実がふたつぶん、すき間があいている）']];
        if (f.mc_fig) return [['me', '', '（いちじくは、もうポケットにふたつ入っている）']];
        f.mc_fig = true;
        return [['me', '', '（熟れたいちじくを、ふたつもいだ。甘いにおいがする）']];
      },
      tomeu(S) {
        const f = S.f;
        if (S.back && f.mc_done) return [['npc', 'normal', 'ゆめの中で、ペペに口笛を吹いた。……起きたら、ペペが小屋で、いちじくくさい息をしとった。']];
        if (S.back) return [['npc', 'normal', 'ん？ 門が開いとる。……ペペは、どこ行った。']];
        f.mc_whistle = true;
        return [['me', '', '（おじいさんが、木かげの椅子で、帽子を顔にのせて眠っている）'], ['npc', 'normal', '……ぴ、ぴ、ぴゅう……。ペペ……帰るぞ……ぴ、ぴ、ぴゅう……。'], ['me', '', '（寝言で、口笛を三回。……これが、ロバを呼ぶ合図らしい）']];
      },
      donkey(S) {
        const f = S.f;
        if (S.back) return [['me', '', '（花壇には、ロバのひづめのあとと、いちじくの皮がひとつ）']];
        if (f.mc_home) return [['me', '', '（ペペは、小屋の中で、しっぽをふっている）']];
        if (!(f.mc_fig && f.mc_whistle)) return [['me', '', '（ロバが、花壇の花を、むしゃむしゃ食べている。呼んでも、知らん顔だ）']];
        f.mc_home = true;
        return [['me', '', '（いちじくを見せて、口笛を三回。ぴ、ぴ、ぴゅう）'], ['me', '', '（ロバが顔を上げた。いちじくにつられて、とことこ、小屋までついてくる）'], ['me', '', '（門を、そっと閉めた。……村は、まだ眠っている）']];
      }
    }
  });

// ---------------------------------------------------------------- 76 うるさい音が子守歌だった（止めた音を、もういちど頼みに行く）
  C.push({
    id: 'sverige', shape: 'うるさい音が子守歌だった', name: 'スヴェリア', sub: '鍛冶の谷', time: 'morning', screens: 5, far: 'birch_noon', timeBack: 'dusk', map: [60.6, 15.6],
    hill: '#3a5a4a', ground: ['#7a8a6a', '#5a6a4a', '#8a9a7a'], tint: 'rgba(220,240,255,.04)', bscale: 1.0,
    props: [['pine', 400, 300], ['bucket', 1300, 40], ['pine', 2200, 300], ['stump', 3000, 60], ['pine', 4300, 300]],
    buildings: [['nordic_red', 800, 0.85], ['nordic_red', 1900, 0.85], ['lumber_hut', 3300, 0.85]],
    npcs: [
      { id: 'lina', name: '赤ちゃんを抱いたリーナ', actor: 'mother', x: 900, face: 1 },
      { id: 'britt', name: 'となりのブリットおばあさん', actor: 'granny_broom', x: 2000, face: -1 },
      { id: 'olle', name: '鍛冶屋のオッレ', actor: 'smith', x: 3600, face: -1 }
    ],
    places: [{ id: 'forge', name: '火の消えた鍛冶場', x: 3100, verb: '見る' }],
    weather: { clear: 4, drizzle: 3, fog: 2 },
    animals: [['cat_black', 1400], ['crow', 2600], ['dog_husky', 4000]],
    talk: {
      lina(S) {
        const f = S.f;
        if (S.back && f.sv_done) return [['npc', 'normal', '……寝たわ。鎚の音が三つ鳴ったら、すうっと。三日ぶりよ。'], ['npc', 'normal', 'あした、オッレさんに、パンを焼いて持っていく。……ゆっくり三つずつ、ありがとうって。']];
        if (S.back) return [['npc', 'normal', '……今夜も、寝てくれないのかしら。わたしが先に、たおれそう。']];
        if (f.sv_lina) return [['npc', 'normal', 'ミルクも飲んだ、おむつもかえた、熱もない。……なのに、ぜんぜん寝ないの。']];
        f.sv_lina = true;
        return [['me', '', '（若いお母さんが、赤ちゃんをゆすりながら、目の下にくまをつくっている）'], ['npc', 'normal', '旅の人。この子、三日前から、ぜんぜん寝ないの。夜も、昼も。'], ['npc', 'normal', 'この谷に越してきて、ひと月。それまでは、よく寝る子だったのに。'], ['npc', 'normal', '何が変わったのか、わからないの。……わたし、もう、ふらふら。']];
      },
      britt(S) {
        const f = S.f;
        if (S.back && f.sv_done) return [['npc', 'normal', 'ほら、鎚の音。……やっと、谷が谷らしくなった。']];
        if (S.back) return [['npc', 'normal', '静かすぎる谷は、なんだか、落ち着かないねえ。']];
        f.sv_britt = true;
        return [['npc', 'normal', 'リーナの赤ちゃん？ ……三日前からって、オッレの鍛冶場が止まった日じゃないか。'], ['npc', 'normal', 'あの子、越してきた日から、鎚の音が鳴るたびに、すとんと寝てたよ。窓から見てた。'], ['npc', 'normal', 'リーナが熱の日に、「きょうは静かに」って頼んだんだ。……オッレは、気にしいだからね。']];
      },
      forge(S) {
        const f = S.f;
        if (S.back && f.sv_done) return [['me', '', '（鍛冶場に、また火が入っている。トン、トン、トン。……三つずつ、ゆっくり）']];
        if (S.back) return [['me', '', '（冷えた炉。戸口の札は「休業」のまま）']];
        return [['me', '', '（炉の火は消えて、灰が白い。戸口に、手書きの札。「しばらく休業」）'], ['me', '', '（作業台の上で、鎚が三本、きちんと並べて置いてある）']];
      },
      olle(S) {
        const f = S.f;
        if (S.back && f.sv_done) return [['npc', 'normal', '三つずつ、ゆっくり。……母さんの子守歌の拍子だ。打つほうも、眠くなる。']];
        if (S.back) return [['npc', 'normal', '……あしたから、谷の外れの小屋で打つ。ここは、静かなほうがいい。']];
        if (f.sv_done) return [['npc', 'normal', 'トン、トン、トン。……赤ん坊に聞こえる強さで、な。']];
        if (!f.sv_britt) return [['me', '', '（大きな男の人が、冷えた炉の前で、腕を組んで座っている）'], ['npc', 'normal', '……鍛冶場は休みだ。うるさいと、迷惑だからな。']];
        f.sv_done = true;
        return [['me', '', '（大きな男の人が、冷えた炉の前で、腕を組んで座っている）'], ['me', '', 'リーナさんの赤ちゃん、鎚の音が止まった日から、眠れなくなったそうです。'], ['npc', 'normal', '……おれの鎚で、寝てた？ ……うるさいと言われたから、止めたのに。'], ['npc', 'normal', 'おれは、ずっと三つずつ打つ。母さんの子守歌の拍子だ。……赤ん坊にも、わかったのか。'], ['npc', 'normal', '火を入れる。……ゆっくり、三つずつ、な。'], ['insight', '', 'うるさいと思われていた音は、聞く人によっては、子守歌だった。']];
      }
    }
  });

// ---------------------------------------------------------------- 77 誕生日をあげる（生まれた日を知らない人に、来た日を）
  C.push({
    id: 'senegal', shape: '誕生日をあげる', name: 'セネガラ', sub: 'バオバブの港', time: 'morning', screens: 5, far: 'savanna_morning', farBack: 'sea_dusk', timeBack: 'dusk', map: [14.7, -17.4],
    hill: '#8a6a40', ground: ['#c8a070', '#a07850', '#d8b080'], tint: 'rgba(255,220,170,.06)', bscale: 1.0,
    props: [['big_tree2', 500, 340], ['textile_stall', 1500, 140], ['canoe', 2600, 60], ['pier', 3300, 90], ['palm', 4300, 290]],
    buildings: [['adobe', 900, 0.85], ['sea_shop', 2100, 0.85], ['sea_barrack', 3800, 0.85]],
    npcs: [
      { id: 'aminata', name: 'アミナタ', actor: 'schoolgirl', x: 950, face: 1 },
      { id: 'awa', name: '布売りのアワ', actor: 'wa_woman', x: 1700, face: -1 },
      { id: 'harbor', name: '港番のディウフ', actor: 'navylantern', x: 2900, face: -1 },
      { id: 'ousmane', name: 'ウスマンじいさん', actor: 'oldman', x: 3600, face: -1 }
    ],
    places: [],
    weather: { clear: 7, wind: 3 },
    animals: [['hen', 1300], ['cat_orange', 2400], ['crow', 4000]],
    talk: {
      aminata(S) {
        const f = S.f;
        if (f.sn_day && !f.sn_done) {
          f.sn_done = true;
          return [['me', '', '六十年前のきょう、ウスマンさんは、ひとりで、この港に着いたそうです。バオバブが咲いた朝に。'], ['npc', 'normal', '……きょう？ 六十年前の、きょう？'], ['npc', 'normal', 'じゃあ、きょうが、ウスマンじいさんの誕生日だ！ この町に、生まれた日！'], ['npc', 'normal', '名前の札、書きなおす！ 「ウスマン、この町で六十さい」って！'], ['insight', '', '生まれた日を知らない人には、この町に来た日を、誕生日にすればよかった。']];
        }
        if (S.back && f.sn_done) return [['npc', 'normal', 'じいさん、札を首にかけたまま、ずっと港を見てる。……ちょっと泣いてた。']];
        if (S.back) return [['npc', 'normal', '……お祝いの札、じいさんのだけ、白いまま。']];
        if (f.sn_ami) return [['npc', 'normal', '誕生日がわからない人なんて、いるの？ ……でも、だれにでも、何かの日はあるよね。']];
        f.sn_ami = true;
        return [['me', '', '（女の子が、色紙の札を何枚も抱えて、バオバブの下に並べている）'], ['npc', 'normal', '旅の人。きょうは、町のお年寄りのお祝いの日。今年の誕生日の人に、札をかけるの。'], ['npc', 'normal', 'でもね、ウスマンじいさんの札だけ、書けないの。……じいさん、誕生日を知らないんだって。'], ['npc', 'normal', '子どものとき、ひとりで舟で来たから。……日が沈むまでに、なんとかしたいの。']];
      },
      awa(S) {
        const f = S.f;
        if (S.back && f.sn_day) return [['npc', 'normal', '六十年前のきょう？ ……お祝いの布、いちばんいいのを出しておこうかね。']];
        if (S.back) return [['npc', 'normal', '……ウスマンの札、白いままかい。かわいそうにねえ。']];
        return [['npc', 'normal', 'ウスマン？ あの子が来た朝のことなら、母さんから聞いたよ。'], ['npc', 'normal', '港のバオバブが、いっせいに白い花をつけた朝だったって。年にいちど、ひと晩だけ咲く花さ。'], ['npc', 'normal', '……そういえば、ゆうべ、咲いてたね。']];
      },
      harbor(S) {
        const f = S.f;
        if (S.back && f.sn_day) return [['npc', 'normal', '帳面のあのページに、しおりをはさんでおいた。……おやじも、喜ぶだろう。']];
        if (S.back) return [['npc', 'normal', '日が沈む。港の帳面を、しまう時間だ。']];
        f.sn_log = true;
        return [['npc', 'normal', '港の帳面なら、六十年ぶんある。……おやじの代のは、字がひどいがね。'], ['me', '', '（古い帳面をめくる。六十年前の、ちょうど、きょうの日付）'], ['me', '', '（「小舟一そう、漂着。乗っていた男の子、ひとり。名はウスマンと言う。バオバブ満開」）']];
      },
      ousmane(S) {
        const f = S.f;
        if (S.back && f.sn_day) return [['npc', 'normal', '来た日を、帳面に書いてくれた人がおったとはな。……六十年か。'], ['npc', 'normal', 'あの朝の水の味は、覚えとる。……誕生日の味なんて、知らんが。']];
        if (S.back) return [['npc', 'normal', '……わしの札は、いらんよ。祝う日が、ないんだから。']];
        if (f.sn_day) return [['npc', 'normal', '六十年、毎年あの花を見てきた。……自分の花だとは、知らずにな。']];
        if (!f.sn_log) return [['me', '', '（おじいさんが、桟橋に座って、網をつくろっている）'], ['npc', 'normal', '誕生日？ ……知らんのだよ。舟に乗る前のことは、なんにも。']];
        f.sn_day = true;
        return [['me', '', '（おじいさんが、桟橋に座って、網をつくろっている）'], ['me', '', '港の帳面に、ウスマンさんが着いた日が書いてありました。六十年前の、きょうです。'], ['npc', 'normal', '……きょう？ バオバブが咲いた朝か。'], ['npc', 'normal', 'あの朝、木の下で、だれかに水をもらった。……あれが、この町での、最初の日だった。']];
      }
    }
  });

// ---------------------------------------------------------------- 78 失敗作がだれかにはちょうどいい（ゆがみが、その人の手の形だった）
  C.push({
    id: 'romania', shape: '失敗作がだれかにはちょうどいい', name: 'ルマーニア', sub: '焼きものの村', time: 'morning', screens: 5, far: 'autumn_morning', timeBack: 'dusk', map: [45.8, 24.9],
    hill: '#5a5a3a', ground: ['#9a8a60', '#7a6a40', '#aa9a70'], tint: 'rgba(255,225,180,.05)', bscale: 1.0,
    props: [['tree_autumn', 400, 290], ['clay_oven', 1300, 110], ['burnt_pot', 1500, 40], ['tree_autumn', 2700, 300], ['stool2', 3600, 40]],
    buildings: [['house_small', 800, 0.9], ['thatched_farm', 2200, 0.85], ['house_large', 3800, 0.85]],
    npcs: [
      { id: 'ana', name: '見習いのアナ', actor: 'farmgirl', x: 950, face: 1 },
      { id: 'mihai', name: '親方のミハイ', actor: 'oldsmith', x: 2000, face: -1 },
      { id: 'ileana', name: 'イレアナおばあさん', actor: 'ru_granny', x: 3500, face: -1 }
    ],
    places: [{ id: 'shelf', name: 'イレアナの台所の棚', x: 3250, verb: '見る', when: f => f.rm_ilea }],
    weather: { clear: 5, wind: 3, drizzle: 2 },
    animals: [['hen', 1200], ['dog_brown', 2600], ['cat_white', 3900]],
    talk: {
      ana(S) {
        const f = S.f;
        if (f.rm_shelf && !f.rm_done) {
          f.rm_done = true;
          return [['me', '', 'イレアナさんの棚、アナさんのゆがんだ器ばかりでした。……へこみに、親指がぴったり入るそうです。'], ['npc', 'normal', '……わたしの失敗作が？ 指が痛い人の、ちょうどいい形？'], ['npc', 'normal', 'まんまるには、まだ作れない。……でも、へこみなら、だれよりうまく作れる。'], ['npc', 'normal', '親方に言う。へこみを、わざと作らせてくださいって。村じゅうの、手の痛い人のぶん。'], ['insight', '', 'ゆがみは、だれかの手には、ちょうどいい形だった。']];
        }
        if (S.back && f.rm_done) return [['npc', 'normal', '親方が、「へこみの係」って札をくれた。……まんまるの練習も、ちゃんと続けるよ。']];
        if (S.back) return [['npc', 'normal', '……夕方の窯出し。まんまるは、またひとつも、できなかった。']];
        if (f.rm_ana) return [['npc', 'normal', '手が、勝手に、ここで力を入れちゃうの。……親指のところ。']];
        f.rm_ana = true;
        return [['me', '', '（女の子が、ろくろの前で、ゆがんだ器を両手で持ち上げている）'], ['npc', 'normal', '旅の人。わたし、見習い三年目。……でも、まんまるの器が、ひとつも作れないの。'], ['npc', 'normal', '親方が、きょうの窯出しまでに、まんまるを作れなかったら、見習いは、おしまいだって。'], ['npc', 'normal', '……ふしぎなの。ゆがんだのばっかり、市場で、ひとりのおばあさんが、ぜんぶ買っていくの。']];
      },
      mihai(S) {
        const f = S.f;
        if (S.back && f.rm_shelf) return [['npc', 'normal', 'イレアナばあさんの棚を見た？ ……わしは、まんまるしか見とらんかった。'], ['npc', 'normal', '癖はなおらん、と言ったな。……なおさんでいい癖も、あるのかもしれん。']];
        if (S.back) return [['npc', 'normal', '……まんまるは、焼きものの基本だ。基本ができんものに、窯はまかせられん。']];
        return [['npc', 'normal', 'アナの器か。どれも、同じところが、ぽこんとへこむ。……右の親指のところだ。'], ['npc', 'normal', '癖は、なおらん。……なおらんなら、焼きもの屋は向かん。きびしいが、そういうものだ。']];
      },
      shelf(S) {
        const f = S.f;
        if (S.back) return [['me', '', '（棚に、新しいへこみの器が、ひとつ増えている）']];
        f.rm_shelf = true;
        return [['me', '', '（台所の棚に、ゆがんだ器が、ずらりと並んでいる。……どれも、同じところがへこんでいる）'], ['me', '', '（まんまるの器は、棚のいちばん奥で、ほこりをかぶっている）']];
      },
      ileana(S) {
        const f = S.f;
        if (S.back && f.rm_shelf) return [['npc', 'normal', 'あの子に伝えて。……へこみの器、来週も、ひとつ取っておいてって。']];
        if (S.back) return [['npc', 'normal', 'あの子の器が、もう市場に出ないの？ ……困るわ。ほんとうに、困る。']];
        if (f.rm_ilea) return [['npc', 'normal', '棚を見ていって。……わたしの台所は、あの子の器で、できてるのよ。']];
        f.rm_ilea = true;
        return [['me', '', '（おばあさんが、指の節の太い手で、器を両手で包むように持っている）'], ['npc', 'normal', 'アナの器？ ええ、ぜんぶ買ってるわ。……わたし、指が痛くてね。まるい器は、つるっとすべるの。'], ['npc', 'normal', 'あの子のは、へこみに親指がぴったり入る。……落とさないの。何年ぶりかしら、自分でスープを飲めるの。']];
      }
    }
  });

  window.SEE_WORLD = { countries: C };
})();
