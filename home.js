// ===================================================================
// Yusei Tomobe Portfolio - トップページ専用スクリプト
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
        // カードの中は2つに分かれている。
        //   サムネイル … 映像作品は YouTube を新しいタブで開く。平面作品は押せない（見るだけ）
        //   下の文字   … 作品の詳細ページへ
        const card = document.createElement('div');
        card.className = `work-item fade-on-scroll${work.size === 'large' ? ' is-large' : ''}`;
        card.dataset.category = work.type;
        card.dataset.code = work.code;
        // 並べ直すときに、works-data.js の順番を取り戻すための番号
        card.dataset.order = index;
        // 1枚ずつ少しずつ遅らせて出現させる（最大0.4秒まで）
        card.style.transitionDelay = `${Math.min(index * 0.06, 0.4)}s`;

        card.append(buildCardMedia(work), buildCardInfo(work));
        grid.appendChild(card);
    });
}

/**
 * カード上半分（サムネイル＋ホバー演出＋受賞バッジ）を作る。
 * size: "large" の作品は、静止画を組み合わせて縦に長いカードにする（buildCardStills）。
 */
function buildCardMedia(work) {
    const watchUrl = youtubeWatchUrl(work.youtubeUrl);
    const wrap = document.createElement(watchUrl ? 'a' : 'div');
    wrap.className = 'work-media';
    if (watchUrl) {
        wrap.href = watchUrl;
        wrap.target = '_blank';
        wrap.rel = 'noopener';
        wrap.classList.add('is-link');
        wrap.setAttribute('aria-label', `${work.title} を YouTube で見る（新しいタブで開きます）`);
    }
    wrap.appendChild(buildCardThumb(work));
    if (work.size === 'large') {
        const stills = buildCardStills(work);
        if (stills) wrap.appendChild(stills);
    }
    return wrap;
}

/**
 * 大きく見せる作品の、サムネイルの下に並べる静止画。
 * 映像作品はシーン画像（scenes）から、サムネイルと同じ画像を除いて最大2枚。
 * 平面作品は静止画を足さない（サムネイルはどの平面作品も、切り抜かずに元の縦横比で見せる）。
 */
function buildCardStills(work) {
    const poster = (work.thumb || {}).poster;
    const extras = (work.scenes || []).filter(src => src && src !== poster).slice(0, 2);
    if (!extras.length) return null;

    const stills = document.createElement('div');
    stills.className = `work-stills is-${extras.length}`;
    extras.forEach(src => {
        const img = document.createElement('img');
        img.src = ASSET_IMG + src;
        img.alt = '';
        img.loading = 'lazy';
        img.decoding = 'async';
        stills.appendChild(img);
    });
    return stills;
}

function buildCardThumb(work) {
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
        // 平面作品は、ポスターなど縦長のものも多いので、切り抜かずに元の縦横比で見せる
        if (work.type === 'graphic') {
            media.classList.add('is-natural');
            // 読み込み後に高さが決まるので、そのときに並びを組み直す
            img.addEventListener('load', () => layoutWorks());
        }
        img.src = ASSET_IMG + thumb.image;
        img.alt = work.title;
        img.loading = 'lazy';
        img.decoding = 'async';
        media.appendChild(img);
    }

    // YouTube へ飛べる作品だけ、ホバーで再生アイコンを出す（平面作品は押せないので出さない）
    if (youtubeWatchUrl(work.youtubeUrl)) {
        const overlay = document.createElement('div');
        overlay.className = 'work-hover-overlay';
        overlay.innerHTML = `<span class="overlay-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg></span>`;
        media.appendChild(overlay);
    }

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
    const info = document.createElement('a');
    info.className = 'work-info';
    info.href = `work-detail.html?id=${encodeURIComponent(work.code)}`;
    info.innerHTML = `
        <h3 class="work-title"></h3>
        <p class="work-role"></p>
        <p class="work-category"><span class="work-code"></span><span>${work.type === 'video' ? 'Video' : 'Graphic'}</span></p>
    `;
    // textContent を使うことで、作品名に記号が入っていても崩れない
    info.querySelector('.work-title').textContent = work.title;
    // ホバーで重なるミントの文字（style.css の .work-title::after）は、この値を表示する
    info.querySelector('.work-title').dataset.text = work.title;
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
// 1-2. カードを同じ幅の列に積んでいく（石垣のような並べ方）
//    列の数は style.css「00. 文字の調整パネル」の --works-columns（PCでの列数）。
//    画面が狭いときは自動で減らす（下の columnsForWidth）。
//    カードは表示順に、その時点で一番短い列へ入れていく。
//    幅はどのカードも同じなので、Video / Graphic で絞り込んでも大きさは変わらない。
//    大きく見せたい作品は、静止画を組み合わせて縦に長くしている（buildCardStills）。
// ===================================================================
function columnsForWidth(max) {
    const w = window.innerWidth;
    if (w <= 600) return 1;
    if (w <= 900) return Math.min(max, 2);
    if (w <= 1200) return Math.min(max, 3);
    return max;
}

function layoutWorks() {
    const grid = document.getElementById('works-grid');
    if (!grid) return;

    // 一度列に分けると、ページ上の順番が「列ごと」になってしまうので、元の順番に並べ直してから配る
    const items = [...grid.querySelectorAll('.work-item')]
        .sort((a, b) => a.dataset.order - b.dataset.order);
    const max = parseInt(getComputedStyle(grid).getPropertyValue('--works-columns'), 10) || 4;
    const count = columnsForWidth(max);

    // 列の箱を作り直す（カード自体は作り直さず、移し替えるだけ）
    const columns = Array.from({ length: count }, () => {
        const col = document.createElement('div');
        col.className = 'works-col';
        return col;
    });
    grid.querySelectorAll('.works-col').forEach(col => col.remove());
    columns.forEach(col => grid.appendChild(col));

    items.forEach(item => {
        // 非表示のカードは高さに影響しないので、どこに入れてもよい
        if (item.classList.contains('is-hidden')) {
            columns[count - 1].appendChild(item);
            return;
        }
        const shortest = columns.reduce((a, b) => (b.offsetHeight < a.offsetHeight ? b : a));
        shortest.appendChild(item);
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
        // カードの中のリンクにキーボードで移ったときも再生する
        card.addEventListener('focusin', play);
        card.addEventListener('focusout', stop);
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
    // 画面幅が変わったら組み直す。文字（Webフォント）の読み込み後も、カードの高さが変わるので組み直す
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(layoutWorks, 150);
    });
    if (document.fonts) document.fonts.ready.then(layoutWorks);
    setupWorksCount();
    setupCardVideos();
    setupFilter();
    setupScrollReveal();
});
