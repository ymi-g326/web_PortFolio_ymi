// ===================================================================
// Yusei Tomobe Portfolio - 作品詳細ページ専用スクリプト
// ===================================================================
//
// URLの ?id=**** で指定された作品を works-data.js から探し、
// work-detail.html の空っぽの枠に流し込みます。
// 読み込み順は work-detail.html の最後で works-data.js → script.js → work-detail.js。
// ===================================================================

document.addEventListener('DOMContentLoaded', () => {
    let workId = new URLSearchParams(window.location.search).get('id');

    // 載せるのをやめた作品の古いURLなら、代わりの作品のページへ移す（works-data.js の retiredCodes）
    if (workId && typeof retiredCodes !== 'undefined' && retiredCodes[workId]) {
        window.location.replace(`work-detail.html?id=${encodeURIComponent(retiredCodes[workId])}`);
        return;
    }

    // 該当する作品がなければ一覧に戻す
    if (!workId || !worksByCode[workId]) {
        window.location.replace('index.html');
        return;
    }

    const work = worksByCode[workId];

    renderHeader(work);
    renderMainMedia(work);
    renderOverview(work);
    renderProcessGallery(work);
    renderPager(work);
});


// ===================================================================
// 1. タイトル・担当・作品コード・受賞歴
// ===================================================================
function renderHeader(work) {
    document.getElementById('detail-title').textContent = work.title;
    document.getElementById('detail-code').textContent = work.code;
    document.getElementById('detail-role').textContent = work.role || '';

    document.title = `${work.title} | Yusei Tomobe Portfolio`;

    if (work.award) {
        const awardEl = document.getElementById('detail-award');
        awardEl.textContent = work.award;
        awardEl.hidden = false;
    }
}


// ===================================================================
// 2. メインのメディア（映像なら YouTube＋シーン画像、平面なら1枚絵）
// ===================================================================
function renderMainMedia(work) {
    if (work.type === 'video') {
        renderVideoLayout(work);
    } else if (work.type === 'graphic') {
        renderGraphicLayout(work);
    }
}

function renderVideoLayout(work) {
    document.getElementById('layout-video').hidden = false;

    const wrapper = document.querySelector('.youtube-wrapper');

    if (work.youtubeUrl) {
        document.getElementById('detail-youtube').src = work.youtubeUrl;
        wrapper.classList.remove('dummy-bg');

        // 大きな画面で見たい人向けに、YouTube へのリンクも添える
        const watchUrl = youtubeWatchUrl(work.youtubeUrl);
        if (watchUrl) {
            const link = document.getElementById('detail-youtube-link');
            link.href = watchUrl;
            link.hidden = false;
        }
    } else {
        wrapper.classList.add('dummy-scene');
        wrapper.innerHTML = '<span class="dummy-text">メイン動画（URL未設定）</span>';
    }

    // シーン画像を並べる
    const scenesGrid = document.getElementById('scenes-grid');
    scenesGrid.innerHTML = '';

    // 映像とシーン画像の幅の比率を、シーン画像の枚数に合わせる。
    // 4枚なら「映像 4 : シーン列 1」にすると、縦に4枚積んだ高さが映像の高さとほぼ揃う。
    // さらに全体の幅を、映像の高さが画面に収まるところまでに抑える（style.css の --stage-fit）。
    const count = (work.scenes || []).length;
    const stage = document.getElementById('video-stage');
    if (count) {
        stage.classList.add('has-scenes');
        stage.style.setProperty('--scene-count', count);
        stage.style.setProperty('--stage-cols', `minmax(0, ${count}fr) minmax(0, 1fr)`);
    }

    // 押すと大きく見られるシーン画像の一覧（下の「2-2. シーン画像の拡大表示」で使う）
    const viewable = (work.scenes || [])
        .map((src, i) => ({ src: src ? ASSET_IMG + src : '', alt: `${work.title} シーン${i + 1}` }))
        .filter(scene => scene.src);

    (work.scenes || []).forEach((sceneSrc, i) => {
        const item = document.createElement(sceneSrc ? 'button' : 'div');
        item.className = 'scene-item';

        if (sceneSrc) {
            item.type = 'button';
            item.setAttribute('aria-label', `シーン${i + 1}を大きく表示`);
            const img = document.createElement('img');
            img.src = ASSET_IMG + sceneSrc;
            img.alt = `${work.title} シーン${i + 1}`;
            img.loading = 'lazy';
            img.decoding = 'async';
            item.appendChild(img);
            const index = viewable.findIndex(scene => scene.src === ASSET_IMG + sceneSrc);
            item.addEventListener('click', () => openSceneViewer(viewable, index, item));
        } else {
            item.classList.add('dummy-scene');
            item.innerHTML = '<span class="dummy-text">各シーン画</span>';
        }

        scenesGrid.appendChild(item);
    });
}

// ===================================================================
// 2-2. シーン画像の拡大表示
//    シーン画像を押すと画面いっぱいに表示し、前後のシーンへ送れる。
//    操作：← → キー／左右のボタン／スマホは左右にスワイプ。Esc・×・背景を押すと閉じる。
// ===================================================================
let sceneViewer = null;

function buildSceneViewer() {
    const el = document.createElement('div');
    el.className = 'scene-viewer';
    el.hidden = true;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'シーン画像');
    el.innerHTML = `
        <figure class="scene-viewer-figure">
            <img class="scene-viewer-img" alt="">
            <figcaption class="scene-viewer-count"></figcaption>
        </figure>
        <button type="button" class="scene-viewer-btn scene-viewer-prev" aria-label="前のシーン">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
        <button type="button" class="scene-viewer-btn scene-viewer-next" aria-label="次のシーン">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
        <button type="button" class="scene-viewer-btn scene-viewer-close" aria-label="閉じる">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18"></line><line x1="18" y1="6" x2="6" y2="18"></line></svg>
        </button>
    `;
    document.body.appendChild(el);

    const viewer = {
        el,
        img: el.querySelector('.scene-viewer-img'),
        count: el.querySelector('.scene-viewer-count'),
        scenes: [],
        index: 0,
        opener: null,
    };

    el.querySelector('.scene-viewer-prev').addEventListener('click', () => showScene(viewer.index - 1));
    el.querySelector('.scene-viewer-next').addEventListener('click', () => showScene(viewer.index + 1));
    el.querySelector('.scene-viewer-close').addEventListener('click', closeSceneViewer);
    // 画像やボタン以外（背景）を押したら閉じる
    el.addEventListener('click', e => {
        if (e.target === el || e.target.classList.contains('scene-viewer-figure')) closeSceneViewer();
    });

    document.addEventListener('keydown', e => {
        if (el.hidden) return;
        if (e.key === 'Escape') closeSceneViewer();
        else if (e.key === 'ArrowLeft') showScene(viewer.index - 1);
        else if (e.key === 'ArrowRight') showScene(viewer.index + 1);
        else if (e.key === 'Tab') keepFocusInside(e);
    });

    // スマホ：左右のスワイプで前後へ
    let startX = null;
    el.addEventListener('pointerdown', e => { startX = e.clientX; });
    el.addEventListener('pointerup', e => {
        if (startX === null) return;
        const dx = e.clientX - startX;
        startX = null;
        if (Math.abs(dx) > 50) showScene(viewer.index + (dx < 0 ? 1 : -1));
    });

    // 開いている間は、キーボードのフォーカスをこの中だけで回す
    function keepFocusInside(e) {
        const buttons = [...el.querySelectorAll('button')];
        const i = buttons.indexOf(document.activeElement);
        const next = e.shiftKey ? (i <= 0 ? buttons.length - 1 : i - 1) : (i + 1) % buttons.length;
        buttons[next].focus();
        e.preventDefault();
    }

    return viewer;
}

function showScene(index) {
    const v = sceneViewer;
    const total = v.scenes.length;
    v.index = (index + total) % total;   // 端まで行ったら反対側に戻る
    const scene = v.scenes[v.index];
    v.img.src = scene.src;
    v.img.alt = scene.alt;
    v.count.textContent = `${v.index + 1} / ${total}`;
    v.el.classList.toggle('is-single', total < 2);
}

function openSceneViewer(scenes, index, opener) {
    if (!sceneViewer) sceneViewer = buildSceneViewer();
    sceneViewer.scenes = scenes;
    sceneViewer.opener = opener;
    showScene(index);
    sceneViewer.el.hidden = false;
    document.documentElement.classList.add('is-viewer-open');
    // 表示してから次の描画でクラスを付けると、ふわっと出る
    requestAnimationFrame(() => sceneViewer.el.classList.add('is-open'));
    sceneViewer.el.querySelector('.scene-viewer-close').focus();
}

function closeSceneViewer() {
    const v = sceneViewer;
    v.el.classList.remove('is-open');
    document.documentElement.classList.remove('is-viewer-open');
    setTimeout(() => { v.el.hidden = true; }, prefersReducedMotion ? 0 : 250);
    if (v.opener) v.opener.focus();
}

function renderGraphicLayout(work) {
    document.getElementById('layout-graphic').hidden = false;

    const wrapper = document.querySelector('.graphic-wrapper');
    const graphicImg = document.getElementById('detail-graphic-img');

    if (work.mainImage) {
        graphicImg.src = ASSET_IMG + work.mainImage;
        graphicImg.alt = work.title;
        wrapper.classList.remove('dummy-bg');
    } else {
        graphicImg.remove();
        wrapper.classList.add('dummy-scene');
        wrapper.innerHTML = '<span class="dummy-text">作品画像</span>';
    }
}


// ===================================================================
// 3. 概要（リード文・本文・外部リンク・担当/ツール/時期/期間）
// ===================================================================
function renderOverview(work) {
    const leadEl = document.getElementById('detail-summary');
    if (work.summary) {
        leadEl.textContent = work.summary;
    } else {
        leadEl.hidden = true;
    }

    setMultiline(document.getElementById('detail-description'), work.description);

    // 実際に公開しているサイトがある作品だけ、リンクを出す
    if (work.siteUrl) {
        const siteUrlDiv = document.getElementById('detail-site-url');
        siteUrlDiv.querySelector('a').href = work.siteUrl;
        siteUrlDiv.hidden = false;
    }

    document.getElementById('detail-meta-role').textContent = work.role || '—';
    document.getElementById('detail-tools').textContent = work.tools || '—';
    document.getElementById('detail-duration').textContent = work.duration || '—';

    // 制作時期は作品コードの先頭4桁から自動で求める（例: 2512EZ2 → 2025年12月）
    const period = formatWorkPeriod(work.code);
    if (period) {
        document.getElementById('detail-period').textContent = period;
    } else {
        document.getElementById('detail-period-row').hidden = true;
    }
}


// ===================================================================
// 4. 制作プロセスのギャラリー（uiImages がある作品だけ）
// ===================================================================
function renderProcessGallery(work) {
    if (!Array.isArray(work.uiImages) || !work.uiImages.length) return;

    const gallery = document.createElement('section');
    gallery.className = 'ui-images-gallery';
    gallery.innerHTML = '<h2 class="ui-images-heading">Process</h2>';

    work.uiImages.forEach(imgData => {
        const img = document.createElement('img');
        img.src = ASSET_IMG + imgData.file;
        img.alt = imgData.alt || '';
        img.loading = 'lazy';
        img.decoding = 'async';

        // layout: "split" のものだけ、画像とキャプションを左右に並べる
        // （縦長の画像はこの方が読みやすいため）
        gallery.appendChild(
            imgData.layout === 'split'
                ? buildSplitProcessItem(img, imgData.caption)
                : buildStackedProcessItem(img, imgData.caption)
        );
    });

    document.querySelector('.detail-info-box').insertAdjacentElement('afterend', gallery);
}

function buildSplitProcessItem(img, captionText) {
    const split = document.createElement('div');
    split.className = 'ui-image-split';

    const left = document.createElement('div');
    left.className = 'ui-image-split-left';
    left.appendChild(img);

    const right = document.createElement('div');
    right.className = 'ui-image-split-right';

    const caption = document.createElement('div');
    caption.className = 'ui-image-caption ui-image-caption-split';
    setMultiline(caption, captionText);
    right.appendChild(caption);

    split.append(left, right);
    return split;
}

function buildStackedProcessItem(img, captionText) {
    const figure = document.createElement('figure');
    figure.className = 'ui-image-figure';
    figure.appendChild(img);

    const caption = document.createElement('figcaption');
    caption.className = 'ui-image-caption';
    setMultiline(caption, captionText);
    figure.appendChild(caption);

    return figure;
}


// ===================================================================
// 5. 前後の作品へのリンク（最後の作品の「次」は最初に戻り、一周できる）
// ===================================================================
function renderPager(work) {
    if (works.length < 2) return;

    const index = works.findIndex(w => w.code === work.code);
    const prev = works[(index - 1 + works.length) % works.length];
    const next = works[(index + 1) % works.length];

    const makeLink = (target, direction) => {
        const a = document.createElement('a');
        a.className = `detail-pager-link detail-pager-${direction}`;
        a.href = `work-detail.html?id=${encodeURIComponent(target.code)}`;

        const label = document.createElement('span');
        label.className = 'detail-pager-label';
        label.textContent = direction === 'prev' ? '← 前の作品' : '次の作品 →';

        const title = document.createElement('span');
        title.className = 'detail-pager-title';
        title.textContent = target.title;

        a.append(label, title);
        return a;
    };

    document.getElementById('detail-pager').append(
        makeLink(prev, 'prev'),
        makeLink(next, 'next')
    );
}
