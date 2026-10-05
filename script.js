// ===================================================================
// m!ntmoch! Portfolio - 全ページ共通スクリプト
// ===================================================================
//
// 【JSファイルの役割分担】
//   works-data.js   … 作品データ（文言・画像・並び順）。編集するのはほぼこのファイルだけ。
//   script.js       … このファイル。全ページで動く共通処理。
//   home.js         … トップページ専用（作品カードの生成・カテゴリーフィルター）
//   work-detail.js  … 作品詳細ページ専用（?id=**** の作品を画面に流し込む）
//
// このファイルで定義した関数・定数は、home.js と work-detail.js からも使えます。
// ===================================================================


// ===================================================================
// 0. 共通の設定と小さな道具
// ===================================================================

// アニメーションを減らす設定をOSでしている人向けの判定
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// スマホ・タブレットなど、マウスホバーが使えない環境の判定
const isTouchDevice = window.matchMedia('(hover: none)').matches;

// 編集モード：自分のMacで「?edit」を付けて開いたときだけ有効（公開サイトでは常に false）
const isEditMode = ['localhost', '127.0.0.1'].includes(location.hostname)
    && new URLSearchParams(location.search).has('edit');

// 素材フォルダの場所（ここを変えれば全ページのパスが一度に変わる）
const ASSET_IMG = './assets/images/';
const ASSET_VID = './assets/videos/';

/**
 * 改行（\n）入りのテキストを、安全に要素へ流し込む。
 * textContent で入れてから <br> だけ差し替えるので、文中に記号が混ざっても崩れない。
 */
function setMultiline(el, text) {
    el.textContent = '';
    (text || '').split('\n').forEach((line, i) => {
        if (i > 0) el.appendChild(document.createElement('br'));
        el.appendChild(document.createTextNode(line));
    });
}

/**
 * 作品コードの先頭4桁（年下2桁＋月）を「2025年12月」の形に直す。
 * 例: "2512EZ2" → "2025年12月"
 * 形式が違うコードのときは空文字を返すので、表示側で自動的に省略される。
 */
function formatWorkPeriod(code) {
    const matched = /^(\d{2})(\d{2})/.exec(code || '');
    if (!matched) return '';

    const month = Number(matched[2]);
    if (month < 1 || month > 12) return '';

    return `20${matched[1]}年${month}月`;
}

/**
 * 動画を再生する。ブラウザに自動再生をブロックされてもエラーで止まらないようにする。
 */
function safePlay(video) {
    const played = video.play();
    if (played !== undefined) played.catch(() => { });
}


// ===================================================================
// 1. スクロールの現在地
//    ・ヘッダー下端のグラデーションバーを、読み進めた割合まで伸ばす
//    ・ヘッダーに白い下地を出すかどうかを切り替える
//
//    スクロールそのものはブラウザ標準に任せています。以前はホイール操作を
//    乗っ取って自前で位置を補間していましたが、(1) 動きが重くなる
//    (2) YouTube 埋め込みの上ではイベントが親ページに届かず、そこだけ
//    感度が変わる、という2つの理由で廃止しました。
//    #works などへのジャンプは CSS の scroll-behavior: smooth が担当します。
// ===================================================================
function setupScrollState() {
    const bar = document.getElementById('scroll-progress-bar');
    const header = document.getElementById('site-header');
    if (!bar && !header) return;

    let ticking = false;

    const update = () => {
        ticking = false;

        if (bar) {
            const scrollable = document.documentElement.scrollHeight - window.innerHeight;
            const ratio = scrollable > 0 ? window.scrollY / scrollable : 0;
            bar.style.width = `${Math.min(1, Math.max(0, ratio)) * 100}%`;
        }

        if (header) {
            header.classList.toggle('is-scrolled', window.scrollY > 24);
        }
    };

    // スクロールのたびに計算せず、描画の直前に1回だけまとめて行う
    window.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(update);
    }, { passive: true });

    window.addEventListener('resize', update);
    update();
}


// ===================================================================
// 2. スクロールで要素を静かに出す演出
//    あとから増えた要素（作品カードなど）にも、もう一度呼べば適用できる。
// ===================================================================
let revealObserver = null;

function setupScrollReveal() {
    const targets = document.querySelectorAll('.fade-on-scroll:not(.is-visible)');
    if (!targets.length) return;

    // アニメーション抑制設定の人には、最初から全部見せる
    if (prefersReducedMotion) {
        targets.forEach(el => el.classList.add('is-visible'));
        return;
    }

    if (!revealObserver) {
        revealObserver = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    obs.unobserve(entry.target);
                }
            });
        }, { root: null, rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    }

    targets.forEach(el => revealObserver.observe(el));
}


// ===================================================================
// 3. スプラッシュ画面（そのブラウザで1回だけ再生する）
// ===================================================================
function setupSplash() {
    const splashScreen = document.getElementById('splash-screen');
    const splashVideo = document.getElementById('splash-video');
    if (!splashScreen) return;

    const dismiss = () => {
        splashScreen.classList.add('hidden');
        try { sessionStorage.setItem('hasSeenSplash', 'true'); } catch (err) { /* プライベートモード等 */ }
    };

    let hasSeenSplash = false;
    try { hasSeenSplash = sessionStorage.getItem('hasSeenSplash') === 'true'; } catch (err) { /* 無視 */ }

    // 一度見ている場合・アニメーション抑制設定の場合・編集モードでは、待たせずに消す
    if (hasSeenSplash || prefersReducedMotion || isEditMode || !splashVideo) {
        splashScreen.style.display = 'none';
        splashScreen.classList.add('hidden');
        return;
    }

    splashVideo.addEventListener('ended', dismiss);
    // 動画が再生できなかった場合に備えた保険
    splashVideo.addEventListener('error', dismiss);
    setTimeout(() => {
        if (!splashScreen.classList.contains('hidden')) dismiss();
    }, 8000);
    // クリック・キー操作でスキップできるようにする
    splashScreen.addEventListener('click', dismiss);
    document.addEventListener('keydown', function skip(e) {
        if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
            dismiss();
            document.removeEventListener('keydown', skip);
        }
    });
}


// ===================================================================
// 4. ヒーローの動画
//    アニメーション抑制設定の人には、動かさず1枚絵として見せる
// ===================================================================
function setupHeroVideo() {
    const heroVideo = document.querySelector('.hero-media video');
    if (!heroVideo) return;

    if (prefersReducedMotion) {
        heroVideo.removeAttribute('autoplay');
        heroVideo.pause();
    }
}


// ===================================================================
// 5. ヘッダーロゴ
//    マウスを乗せる・タップする・キーボードで選ぶと、ロゴが1文字ずつ描き直される。
//    動き自体は CSS（style.css 04 の .is-drawing）。ここではクラスの付け外しだけ行う。
//    再生中にもう一度触れても最初からやり直さず、最後まで描き切らせる。
// ===================================================================
function setupLogoMotion() {
    const logo = document.getElementById('site-logo');
    if (!logo || prefersReducedMotion) return;

    // 一番最後に動き終わる線（紺の影の最後の文字）
    const lastStroke = logo.querySelector('.logo-shadow > g:last-child > :last-child');
    if (!lastStroke) return;

    const play = () => {
        if (logo.classList.contains('is-drawing')) return;
        logo.classList.add('is-drawing');
    };

    lastStroke.addEventListener('animationend', () => {
        logo.classList.remove('is-drawing');
    });

    logo.addEventListener('pointerenter', play);
    logo.addEventListener('pointerdown', play);
    logo.addEventListener('focus', play);
}


// ===================================================================
// 6. 編集モードの読み込み
//    道具一式は _editor/ フォルダにある。GitHub Pages は「_」で始まるフォルダを
//    公開しないので、公開サイトには編集モードの道具そのものが存在しない。
// ===================================================================
function loadEditor() {
    if (!isEditMode) return;

    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = '_editor/editor.css';
    document.head.appendChild(css);

    const js = document.createElement('script');
    js.src = '_editor/editor.js';
    document.body.appendChild(js);
}


// ===================================================================
// 起動処理（全ページ共通ぶんだけ。ページ固有の処理は home.js / work-detail.js）
// ===================================================================
document.addEventListener('DOMContentLoaded', () => {
    setupScrollState();
    setupSplash();
    setupHeroVideo();
    setupLogoMotion();
    setupScrollReveal();
    loadEditor();
});
