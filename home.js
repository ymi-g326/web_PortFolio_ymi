// ===================================================================
// m!ntmoch! Portfolio - トップページ専用スクリプト
// ===================================================================
//
// works-data.js の works 配列から、Works セクションのカードを組み立てます。
// 読み込み順は index.html の最後で works-data.js → script.js → home.js。
// ===================================================================


// ===================================================================
// 1. 作品カードの自動生成
//    配列に書いた順番が、そのまま表示順になります。
// ===================================================================
function buildWorkCards() {
    const grid = document.getElementById('works-grid');
    if (!grid || typeof works === 'undefined') return;

    grid.innerHTML = '';

    works.forEach((work, index) => {
        // カード全体を <a> にすることで、キーボード操作・新しいタブで開く・
        // リンクのコピーがすべて普通のリンクと同じように使えるようになる
        const card = document.createElement('a');
        card.className = `work-item fade-on-scroll ${work.size === 'large' ? 'is-large' : 'is-small'}`;
        card.href = `work-detail.html?id=${encodeURIComponent(work.code)}`;
        card.dataset.category = work.type;
        card.dataset.code = work.code;
        // 1枚ずつ少しずつ遅らせて出現させる（最大0.4秒まで）
        card.style.transitionDelay = `${Math.min(index * 0.06, 0.4)}s`;

        card.append(buildCardMedia(work), buildCardInfo(work));
        grid.appendChild(card);
    });
}

/**
 * カード上半分（サムネイル＋ホバー演出＋受賞バッジ）を作る。
 */
function buildCardMedia(work) {
    const thumb = work.thumb || {};
    const isVideoThumb = !!thumb.video;

    const media = document.createElement('div');
    media.className = 'work-image-container';

    if (isVideoThumb) {
        const video = document.createElement('video');
        video.className = 'work-image';
        video.src = ASSET_VID + thumb.video;
        // poster = 動画本体を読み込む前に表示される静止画
        if (thumb.poster) video.poster = ASSET_IMG + thumb.poster;
        // preload="none" が表示速度の要。
        // 動画データはホバー（PC）や画面内に入ったとき（スマホ）まで読み込まれない。
        video.preload = 'none';
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.setAttribute('aria-hidden', 'true');
        media.appendChild(video);
    } else if (thumb.image) {
        const img = document.createElement('img');
        img.className = 'work-image';
        img.src = ASSET_IMG + thumb.image;
        img.alt = work.title;
        img.loading = 'lazy';
        img.decoding = 'async';
        media.appendChild(img);
    }

    // ホバー時のオーバーレイ（映像は再生アイコン、平面は拡大アイコン）
    const overlay = document.createElement('div');
    overlay.className = isVideoThumb ? 'work-hover-overlay' : 'work-hover-overlay graphic-overlay';
    overlay.innerHTML = isVideoThumb
        ? `<span class="overlay-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg></span>`
        : `<span class="overlay-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7"></path><path d="M8 7h9v9"></path></svg></span>`;
    media.appendChild(overlay);

    // 受賞作にだけ付く金色のバッジ
    if (work.award) {
        const award = document.createElement('span');
        award.className = 'work-award';
        award.textContent = work.award;
        media.appendChild(award);
    }

    return media;
}

/**
 * カード下半分（作品名・担当・作品コード・カテゴリーバッジ）を作る。
 */
function buildCardInfo(work) {
    const info = document.createElement('div');
    info.className = 'work-info';
    info.innerHTML = `
        <h3 class="work-title"></h3>
        <p class="work-role"></p>
        <p class="work-category"><span class="work-code"></span><span>${work.type === 'video' ? 'Video' : 'Graphic'}</span></p>
    `;
    // textContent を使うことで、作品名に記号が入っていても崩れない
    info.querySelector('.work-title').textContent = work.title;
    info.querySelector('.work-role').textContent = work.role || '';
    info.querySelector('.work-code').textContent = work.code;

    return info;
}


/**
 * Works 見出しの下に「08 Projects」と作品数を出す。
 * 作品を増やしても数を書き換えなくて済むよう、配列の長さから自動で作る。
 */
function setupWorksCount() {
    const el = document.getElementById('works-count');
    if (!el || typeof works === 'undefined') return;

    el.textContent = `${String(works.length).padStart(2, '0')} Projects`;
}


// ===================================================================
// 1-2. 大小のカードを、わざと揃えすぎずに並べる
//    画面を24列に割り、大きいカードは14列・小さいカードは7列ぶん使う。
//    カードの大きさを変えたいときは、下の SPAN の数字を変える（合計が24を超えると次の行へ送られる）。
//    表示順は保ったまま、1行に収まるだけ詰める。奇数行は行の中を左右反転して
//    大きいカードが左右交互に来るようにし、余った列は行ごとに違う位置へ空ける。
//    小さいカードは行の中で少し下げて、高さもずらす。
//    同じ並びなら毎回同じ配置になる（ランダムではない）ので、見た目が安定する。
//    実際の位置は CSS 変数（--col / --span / --row / --drop）で渡し、
//    スマホでは style.css 側でこれを無視して1列にしている。
// ===================================================================
const GRID_COLS = 24;
const SPAN = { large: 14, small: 7 };
// 1枚だけの行で、小さいカードをどの列から置くか（行ごとに順番に使う）
const LONE_SMALL_STARTS = [13, 1, 17, 7];
// 余った列のうち、左側に空ける割合（行ごとに順番に使う。0=左寄せ、1=右寄せ）
const OFFSET_RATIOS = [0, 1, 0.5, 0];
// 小さいカードを下げる量（行ごとに順番に使う）
const DROPS = ['clamp(40px, 8vw, 140px)', 'clamp(24px, 4vw, 64px)'];

function layoutWorks() {
    const items = [...document.querySelectorAll('.work-item:not(.is-hidden)')];

    // ① 表示順のまま、12列に収まるところまでを1行にまとめる
    const rows = [];
    let current = [];
    let used = 0;
    items.forEach(item => {
        const span = item.classList.contains('is-large') ? SPAN.large : SPAN.small;
        if (used + span > GRID_COLS && current.length) {
            rows.push({ cards: current, used });
            current = [];
            used = 0;
        }
        current.push({ item, span });
        used += span;
    });
    if (current.length) rows.push({ cards: current, used });

    // ② 行ごとに、余った列をどこに空けるかを決めて配置する
    rows.forEach((row, r) => {
        const leftover = GRID_COLS - row.used;
        const hasLarge = row.cards.some(card => card.span === SPAN.large);
        // 大きいカードが左右交互に来るよう、奇数行は行の中の並びを左右反転する
        const cards = r % 2 === 1 ? [...row.cards].reverse() : row.cards;

        let col;
        if (row.cards.length === 1 && row.cards[0].span === SPAN.small) {
            col = LONE_SMALL_STARTS[r % LONE_SMALL_STARTS.length];
        } else {
            col = 1 + Math.round(leftover * OFFSET_RATIOS[r % OFFSET_RATIOS.length]);
        }

        cards.forEach((card, i) => {
            const style = card.item.style;
            style.setProperty('--col', col);
            style.setProperty('--span', card.span);
            style.setProperty('--row', r + 1);
            // 大きいカードの隣、または小さいカード同士の2枚目以降を下げる
            const lower = card.span === SPAN.small && row.cards.length > 1 && (hasLarge || i > 0);
            style.setProperty('--drop', lower ? DROPS[r % DROPS.length] : '0px');
            col += card.span;
        });
    });
}


// ===================================================================
// 2. 作品カードの動画制御
//    PC    : カードにマウスが乗ったら最初から再生、離れたら停止
//    スマホ: 画面に入ったら再生、外れたら停止（データ節約のため）
// ===================================================================
function setupCardVideos() {
    const videos = document.querySelectorAll('.work-item video');
    if (!videos.length) return;

    if (isTouchDevice) {
        // --- スマホ・タブレット：画面内に入った動画だけ再生する ---
        const io = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    safePlay(entry.target);
                } else {
                    entry.target.pause();
                }
            });
        }, { threshold: 0.4 });

        videos.forEach(v => io.observe(v));
        return;
    }

    // --- PC：ホバー／キーボードフォーカスで再生 ---
    videos.forEach(video => {
        const card = video.closest('.work-item');
        if (!card) return;

        const play = () => {
            video.currentTime = 0;
            safePlay(video);
        };
        const stop = () => video.pause();

        card.addEventListener('mouseenter', play);
        card.addEventListener('mouseleave', stop);
        card.addEventListener('focus', play);
        card.addEventListener('blur', stop);
    });
}


// ===================================================================
// 3. カテゴリーフィルター（並び替えの動きつき）
// ===================================================================
function setupFilter() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    if (!filterButtons.length) return;

    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const workItems = document.querySelectorAll('.work-item');

            filterButtons.forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-pressed', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-pressed', 'true');

            const filterValue = btn.dataset.filter;

            // ① 動かす前の位置を覚えておく
            const firstRects = new Map();
            workItems.forEach(item => {
                if (!item.classList.contains('is-hidden')) {
                    firstRects.set(item, item.getBoundingClientRect());
                }
            });

            // ② 表示・非表示を切り替える
            workItems.forEach(item => {
                const match = filterValue === 'all' || item.dataset.category === filterValue;
                item.classList.toggle('is-hidden', !match);
            });
            layoutWorks();

            // ③ 位置の差分からアニメーションさせる
            if (!prefersReducedMotion) {
                requestAnimationFrame(() => animateFilterShuffle(workItems, firstRects));
            }

            // ④ 作品が減ってページが短くなったとき、スクロール位置がはみ出さないよう調整
            setTimeout(() => {
                const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
                if (window.scrollY > maxScroll) {
                    window.scrollTo({ top: maxScroll, behavior: 'smooth' });
                }
            }, 100);
        });
    });
}

/**
 * 絞り込みの前後で位置が変わったカードを、元の位置から滑らせる。
 * 新しく現れたカードは、少し縮んだ状態からポップさせる。
 */
function animateFilterShuffle(workItems, firstRects) {
    const timing = { duration: 600, easing: 'cubic-bezier(0.34, 1.5, 0.64, 1)' };

    workItems.forEach(item => {
        if (item.classList.contains('is-hidden')) return;

        const firstRect = firstRects.get(item);

        if (!firstRect) {
            item.animate(
                [{ opacity: 0, transform: 'scale(0.8) translateY(20px)' },
                 { opacity: 1, transform: 'scale(1) translateY(0)' }],
                { ...timing, fill: 'both' }
            );
            return;
        }

        const lastRect = item.getBoundingClientRect();
        const dx = firstRect.left - lastRect.left;
        const dy = firstRect.top - lastRect.top;

        if (dx || dy) {
            item.animate(
                [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
                timing
            );
        }
    });
}


// ===================================================================
// 起動処理（カードを作ってから、動画とスクロール演出を設定する）
// ===================================================================
document.addEventListener('DOMContentLoaded', () => {
    buildWorkCards();
    layoutWorks();
    setupWorksCount();
    setupCardVideos();
    setupFilter();
    setupScrollReveal();
});
