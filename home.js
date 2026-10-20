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
    // play: false の作品は、動画を流さず poster の静止画だけを出す（Reel など、流すと別の作品に見えてしまうもの）
    const isVideoThumb = !!thumb.video && thumb.play !== false;

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
    } else if (thumb.image || thumb.poster) {
        const img = document.createElement('img');
        img.className = 'work-image';
        // 平面作品は、ポスターなど縦長のものも多いので、切り抜かずに元の縦横比で見せる
        if (work.type === 'graphic') {
            media.classList.add('is-natural');
            // 読み込み後に高さが決まるので、そのときに並びを組み直す
            img.addEventListener('load', () => layoutWorks());
        }
        img.src = ASSET_IMG + (thumb.image || thumb.poster);
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
// 1-2. 作品一覧の並べ方（表示ごとに組み方を変える）
//
//    All     … 石垣型。同じ幅の列に、表示順に「一番短い列」へ積んでいく。
//               縦長のポスターは列の幅いっぱいに縦に大きく出て、わざとずれた段差ができる。
//               ただし偶然 数px だけずれた並びはミスに見えるので、近いものは揃える（snapNearRows）。
//    Video   … 格子型。全部 16:9 なので、同じ大きさのカードを行と列にきっちり並べる。
//    Graphic … 行揃え型。行ごとに画像の高さを揃え、行の右端が画面の端ぴったりで終わるよう拡大縮小する。
//               縦長・横長が混ざっても、上下左右がそろう。平面作品だけなので行を高めにとり、ポスターを大きく見せる。
//
//    列の数は style.css「00. 文字の調整パネル」の --works-columns（PCでの列数）。画面が狭いと自動で減らし、
//    1列になる幅（スマホ）では、どの表示も縦に1列で並べる。Graphic は2列の幅では石垣型にする。
//    Graphic の行の高さの目安は、同じパネルの --works-row-height。
// ===================================================================
function columnsForWidth(max) {
    const w = window.innerWidth;
    if (w <= 600) return 1;
    if (w <= 900) return Math.min(max, 2);
    if (w <= 1200) return Math.min(max, 3);
    return max;
}

// いま選ばれている絞り込み（all / video / graphic）
function currentFilter() {
    const active = document.querySelector('.filter-btn.active');
    return active ? active.dataset.filter : 'all';
}

function layoutWorks() {
    const grid = document.getElementById('works-grid');
    if (!grid) return;

    // 列や行に分けると、ページ上の順番が崩れるので、元の順番に並べ直してから配る
    const items = [...grid.querySelectorAll('.work-item')]
        .sort((a, b) => a.dataset.order - b.dataset.order);
    const visible = items.filter(item => !item.classList.contains('is-hidden'));
    const styles = getComputedStyle(grid);
    const max = parseInt(styles.getPropertyValue('--works-columns'), 10) || 4;
    const count = columnsForWidth(max);

    // 前回の組み方の箱と、文字の高さ・ずらしの調整をいったん全部外す
    const holder = document.createDocumentFragment();
    items.forEach(item => {
        item.style.width = '';
        item.style.marginTop = '';
        const info = item.querySelector('.work-info');
        if (info) info.style.minHeight = '';
        holder.appendChild(item);
    });
    grid.querySelectorAll('.works-col, .works-row').forEach(box => box.remove());
    grid.classList.remove('is-masonry', 'is-grid', 'is-rows');

    // 1列（スマホ）はどの表示も縦に並べるだけ。
    // Graphic の行揃えは、横に3枚以上入る幅でだけ使う（2枚しか入らない幅では、横長の作品と並んだ
    // ポスターが細くなってしまうので、All と同じ石垣型にする）。
    let mode = count === 1 ? 'all' : currentFilter();
    if (mode === 'graphic' && count < 3) mode = 'all';
    if (mode === 'video') {
        layoutAsGrid(grid, items, count);
    } else if (mode === 'graphic') {
        layoutAsRows(grid, items, visible, styles);
    } else {
        layoutAsMasonry(grid, items, visible, count);
    }
}

// --- All：石垣型 ---
function layoutAsMasonry(grid, items, visible, count) {
    grid.classList.add('is-masonry');
    const columns = Array.from({ length: count }, () => {
        const col = document.createElement('div');
        col.className = 'works-col';
        grid.appendChild(col);
        return col;
    });

    const distribute = () => {
        // 前に配ったカードが列に残っていると高さの計算が狂うので、いったん全部外してから配る
        const holder = document.createDocumentFragment();
        items.forEach(item => holder.appendChild(item));
        items.forEach(item => {
            // 非表示のカードは高さに影響しないので、どこに入れてもよい
            if (item.classList.contains('is-hidden')) {
                columns[count - 1].appendChild(item);
                return;
            }
            const shortest = columns.reduce((a, b) => (b.offsetHeight < a.offsetHeight ? b : a));
            shortest.appendChild(item);
        });
    };

    distribute();
    if (count > 1) {
        // 作品名が1行か2行かで列の高さが少しずつずれないよう、文字の部分の高さを一番高いものに揃えてから配り直す
        equalizeInfo(visible);
        distribute();
        snapNearRows(items);
    }
}

// --- Video：格子型 ---
function layoutAsGrid(grid, items, count) {
    grid.classList.add('is-grid');
    grid.style.setProperty('--grid-columns', count);
    items.forEach(item => grid.appendChild(item));
    // 同じ行のカードは、文字の部分の高さも揃える（下の段の上端がそろう）
    rowsByTop(items.filter(item => !item.classList.contains('is-hidden'))).forEach(equalizeInfo);
}

// --- Graphic：行揃え型 ---
function layoutAsRows(grid, items, visible, styles) {
    grid.classList.add('is-rows');
    const gap = parseFloat(styles.getPropertyValue('--works-gap-x')) || 32;
    const target = Math.min(
        parseFloat(styles.getPropertyValue('--works-row-height')) || 520,
        window.innerHeight * 0.75
    );
    const width = grid.clientWidth;

    // 画像の縦横比（幅 ÷ 高さ）。読み込み前の画像は縦長（3:4）として仮に組み、読み込み後に組み直す
    const ratioOf = item => {
        const img = item.querySelector('.work-image');
        if (img && img.naturalWidth) return img.naturalWidth / img.naturalHeight;
        if (img && img.tagName === 'VIDEO') return 16 / 9;
        return 3 / 4;
    };

    // 行の右端をぴったり画面の端に合わせたときの、行の高さ
    const fitHeight = (count, sum) => (width - gap * (count - 1)) / sum;

    // 行の区切り方を全通り比べて、どの行の高さも目安から離れすぎない区切り方を選ぶ。
    // （1行ずつ順に決めると、最後に1枚だけ余ったポスターが小さくなることがあるため）
    // 行の「ずれの大きさ」＝（行の高さ − 目安）の2乗。最後の行は、目安より高くなるなら拡大せず目安のまま置くので 0。
    const ratios = visible.map(ratioOf);
    const n = visible.length;
    const best = [{ cost: 0, from: -1 }];
    for (let i = 1; i <= n; i++) {
        best[i] = { cost: Infinity, from: 0 };
        let sum = 0;
        for (let j = i - 1; j >= 0; j--) {
            sum += ratios[j];
            const height = fitHeight(i - j, sum);
            const isLast = i === n;
            const cost = isLast && height >= target ? 0 : (height - target) ** 2;
            if (best[j].cost + cost < best[i].cost) best[i] = { cost: best[j].cost + cost, from: j };
        }
    }
    const rows = [];
    for (let i = n; i > 0; i = best[i].from) {
        const j = best[i].from;
        const rowItems = visible.slice(j, i);
        const sum = ratios.slice(j, i).reduce((s, r) => s + r, 0);
        rows.unshift({ items: rowItems, sum, full: !(i === n && fitHeight(i - j, sum) >= target) });
    }

    rows.forEach(r => {
        const box = document.createElement('div');
        box.className = 'works-row';
        grid.appendChild(box);
        // 行の右端がちょうど画面の端になる高さ。最後の行（足りない行）は拡大せず目安の高さのまま左寄せ
        // （ぴったりにすると目安の1.3倍を超えて大きくなりすぎる行は、そこで止めて左寄せ）
        const height = r.full ? Math.min(fitHeight(r.items.length, r.sum), target * 1.3) : target;
        r.items.forEach(item => {
            item.style.width = `${Math.floor(ratioOf(item) * height)}px`;
            box.appendChild(item);
        });
        equalizeInfo(r.items);
    });

    // 非表示のカードは最後にまとめて置いておく
    items.filter(item => item.classList.contains('is-hidden')).forEach(item => grid.appendChild(item));
}

// --- 共通の道具 ---

// 渡したカードの、文字の部分（作品名・担当）の高さを一番高いものに揃える
function equalizeInfo(cards) {
    const infos = cards.map(card => card.querySelector('.work-info')).filter(Boolean);
    const tallest = Math.max(0, ...infos.map(info => info.offsetHeight));
    infos.forEach(info => { info.style.minHeight = `${tallest}px`; });
}

// 上端の位置が同じカードを、1行ずつのまとまりに分ける
function rowsByTop(cards) {
    const rows = new Map();
    cards.forEach(card => {
        const top = Math.round(card.getBoundingClientRect().top);
        if (!rows.has(top)) rows.set(top, []);
        rows.get(top).push(card);
    });
    return [...rows.values()];
}

/**
 * ③ 隣の列のカードと、上端が「ほんの少しだけ」ずれているときは揃える。
 *    縦長のポスターが混ざると、偶然 数px だけずれた並びができることがある。
 *    わざとずらした配置に見えず、ミスに見えてしまうので、近いものは低い方に合わせる。
 *    大きくずれているもの（SNAP_PX 以上）は、意図した段差としてそのまま残す。
 *    SNAP_PX はカード同士の上下の間隔（64px）より少し小さくしてある。
 */
const SNAP_PX = 56;

function snapNearRows(items) {
    const visible = items.filter(item => !item.classList.contains('is-hidden'));
    visible.forEach(item => { item.style.marginTop = ''; });

    // 上にあるカードから順に見ていく（揃えると下のカードの位置も変わるので、毎回測り直す）
    const topOf = item => item.getBoundingClientRect().top;
    const done = new Set();
    for (let step = 0; step < visible.length; step++) {
        const next = visible
            .filter(item => !done.has(item))
            .reduce((a, b) => (topOf(b) < topOf(a) ? b : a));
        done.add(next);
        const top = topOf(next);
        const column = next.parentElement;
        // 別の列にあって、まだ見ていないカードのうち、少しだけ低いものに合わせる
        const near = visible
            .filter(other => !done.has(other) && other.parentElement !== column)
            .map(other => topOf(other) - top)
            .filter(diff => diff > 0.5 && diff < SNAP_PX);
        if (near.length) {
            next.style.marginTop = `${Math.max(...near)}px`;
        }
    }
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
