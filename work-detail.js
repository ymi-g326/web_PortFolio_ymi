// ===================================================================
// m!ntmoch! Portfolio - 作品詳細ページ専用スクリプト
// ===================================================================
//
// URLの ?id=**** で指定された作品を works-data.js から探し、
// work-detail.html の空っぽの枠に流し込みます。
// 読み込み順は work-detail.html の最後で works-data.js → script.js → work-detail.js。
// ===================================================================

document.addEventListener('DOMContentLoaded', () => {
    const workId = new URLSearchParams(window.location.search).get('id');

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

    document.title = `${work.title} | m!ntmoch! Portfolio`;

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
    } else {
        wrapper.classList.add('dummy-scene');
        wrapper.innerHTML = '<span class="dummy-text">メイン動画（URL未設定）</span>';
    }

    // シーン画像を並べる
    const scenesGrid = document.getElementById('scenes-grid');
    scenesGrid.innerHTML = '';

    (work.scenes || []).forEach((sceneSrc, i) => {
        const item = document.createElement('div');
        item.className = 'scene-item';

        if (sceneSrc) {
            const img = document.createElement('img');
            img.src = ASSET_IMG + sceneSrc;
            img.alt = `${work.title} シーン${i + 1}`;
            img.loading = 'lazy';
            img.decoding = 'async';
            item.appendChild(img);
        } else {
            item.classList.add('dummy-scene');
            item.innerHTML = '<span class="dummy-text">各シーン画</span>';
        }

        scenesGrid.appendChild(item);
    });
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
