// ===================================================================
// 編集モード（自分のMacで ?edit を付けて開いたときだけ読み込まれる）
// ===================================================================
//
// できること
//   ・作品カードをドラッグで移動、右下の■をドラッグで幅を変更（24列のマス目に吸い付く）
//   ・カードをクリックで選択し、矢印キーで微調整（Shift で大きく、Option+←→ で幅）
//   ・style.css「00. 文字の調整パネル」の値を、スライダーでその場で調整
//   ・「保存」で style.css と works-layout.js に書き込む（_editor/server.py が受け取る）
//
// 読み込みは script.js の loadEditor()。公開サイトでは読み込まれない。
// ===================================================================
(() => {
    const COLS = 24;
    const root = document.documentElement;
    const grid = document.getElementById('works-grid');

    const changedVars = {};   // 保存していない文字の値
    let layoutDirty = false;  // 保存していない配置の変更があるか
    let selected = null;      // 選択中のカード
    let drag = null;          // ドラッグ中の情報

    root.classList.add('ed-on');


    // ---------------------------------------------------------------
    // パネル
    // ---------------------------------------------------------------
    const panel = document.createElement('aside');
    panel.className = 'ed-panel';
    panel.innerHTML = `
        <div class="ed-head">
            <strong>編集モード</strong>
            <span class="ed-width"></span>
            <button type="button" class="ed-fold" aria-label="パネルをたたむ">–</button>
        </div>
        <div class="ed-body">
            ${grid ? `
            <section class="ed-section">
                <h3>作品の配置</h3>
                <p class="ed-note">ドラッグで移動、右下の■で幅。クリックで選んで矢印キーでも動かせます（Shift で大きく、Option+←→ で幅）。<br>保存した配置は「All」表示のときに使われます。スマホ幅では自動で1列になります。</p>
                <button type="button" class="ed-btn ed-auto">自動配置に戻す</button>
            </section>` : ''}
            <section class="ed-section ed-vars">
                <h3>文字（style.css「00. 文字の調整パネル」）</h3>
                <p class="ed-note">clamp は「最小・画面幅に比例・最大」。右の数字は、いまの画面幅での実際の大きさです。</p>
            </section>
        </div>
        <div class="ed-foot">
            <span class="ed-status">変更はまだありません</span>
            <button type="button" class="ed-btn ed-save">保存</button>
        </div>
        <a class="ed-exit" href="${location.pathname}">編集を終える</a>
    `;
    document.body.appendChild(panel);

    const statusEl = panel.querySelector('.ed-status');
    const widthEl = panel.querySelector('.ed-width');

    panel.querySelector('.ed-fold').addEventListener('click', () => {
        panel.classList.toggle('is-folded');
    });

    const showWidth = () => { widthEl.textContent = `画面幅 ${window.innerWidth}px`; };
    window.addEventListener('resize', showWidth);
    showWidth();

    function markDirty() {
        statusEl.textContent = '保存していない変更があります';
        statusEl.classList.add('is-dirty');
    }


    // ---------------------------------------------------------------
    // 文字の調整：style.css を読み、調整パネルの変数を一覧にする
    // ---------------------------------------------------------------
    const probe = document.createElement('div');
    probe.className = 'ed-probe';
    document.body.appendChild(probe);

    // いまの画面幅で、その値が何pxになるか
    function realSize(name) {
        probe.style.width = `var(${name})`;
        const px = parseFloat(getComputedStyle(probe).width);
        return Number.isFinite(px) ? `${Math.round(px)}px` : '';
    }

    // 単位ごとのスライダーの範囲
    function rangeFor(unit, name) {
        if (/weight/.test(name)) return { min: 200, max: 500, step: 100 };
        if (unit === 'rem') return { min: 0, max: 8, step: 0.05 };
        if (unit === 'px') return { min: 0, max: 240, step: 1 };
        if (unit === 'em') return { min: -0.1, max: 0.4, step: 0.005 };
        if (unit === 'vw') return { min: 0, max: 10, step: 0.1 };
        return { min: 0, max: 4, step: 0.05 };
    }

    /**
     * 数値1つぶんの操作部品（スライダー＋数字入力）を作る。
     * onInput には新しい数値が渡される。
     */
    function numberControl(label, value, unit, name, onInput) {
        const r = rangeFor(unit, name);
        const wrap = document.createElement('label');
        wrap.className = 'ed-num';
        wrap.innerHTML = `
            <span class="ed-num-label">${label}</span>
            <input type="range" min="${Math.min(r.min, value)}" max="${Math.max(r.max, value)}" step="${r.step}" value="${value}">
            <input type="number" step="${r.step}" value="${value}">
            <span class="ed-unit">${unit}</span>
        `;
        const [range, num] = wrap.querySelectorAll('input');
        range.addEventListener('input', () => { num.value = range.value; onInput(parseFloat(range.value)); });
        num.addEventListener('input', () => {
            if (num.value === '') return;
            range.value = num.value;
            onInput(parseFloat(num.value));
        });
        return wrap;
    }

    function setVar(name, value, sizeEl) {
        root.style.setProperty(name, value);
        changedVars[name] = value;
        if (sizeEl) sizeEl.textContent = realSize(name);
        if (typeof updateFreeLayoutSize === 'function') updateFreeLayoutSize();
        markDirty();
    }

    function buildVarRow(name, value, comment) {
        const row = document.createElement('div');
        row.className = 'ed-var';
        row.innerHTML = `
            <div class="ed-var-head"><code>${name}</code><span class="ed-real"></span></div>
            ${comment ? `<p class="ed-var-note">${comment}</p>` : ''}
        `;
        const sizeEl = row.querySelector('.ed-real');
        sizeEl.textContent = /weight/.test(name) ? '' : realSize(name);

        const clamp = /^clamp\(\s*([\d.]+)(rem|px)\s*,\s*([\d.]+)vw\s*,\s*([\d.]+)(rem|px)\s*\)$/.exec(value);
        const single = /^(-?[\d.]+)(px|rem|em|vw)?$/.exec(value);

        if (clamp) {
            // clamp(最小, 比例, 最大) は、3つの数字をそれぞれ動かせるようにする
            const parts = { min: +clamp[1], minU: clamp[2], fluid: +clamp[3], max: +clamp[4], maxU: clamp[5] };
            const update = () => setVar(name,
                `clamp(${parts.min}${parts.minU}, ${parts.fluid}vw, ${parts.max}${parts.maxU})`, sizeEl);
            row.append(
                numberControl('最小', parts.min, parts.minU, name, v => { parts.min = v; update(); }),
                numberControl('比例', parts.fluid, 'vw', name, v => { parts.fluid = v; update(); }),
                numberControl('最大', parts.max, parts.maxU, name, v => { parts.max = v; update(); })
            );
        } else if (single) {
            const unit = single[2] || '';
            row.append(numberControl('', +single[1], unit, name, v => setVar(name, `${v}${unit}`, sizeEl)));
        } else {
            // 形が読めない値は、文字のまま直接書き換えられるようにする
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'ed-text';
            input.value = value;
            input.addEventListener('change', () => setVar(name, input.value.trim(), sizeEl));
            row.append(input);
        }
        return row;
    }

    async function buildVarPanel() {
        const box = panel.querySelector('.ed-vars');
        let css;
        try {
            css = await (await fetch('style.css', { cache: 'no-store' })).text();
        } catch (err) {
            box.insertAdjacentHTML('beforeend', '<p class="ed-error">style.css を読み込めませんでした</p>');
            return;
        }
        const start = css.indexOf('00. 文字の調整パネル（');
        const end = css.indexOf('01. 変数', start);
        if (start < 0 || end < 0) return;

        // 変数の直前にあるコメントを、その変数の説明として表示する
        let comment = '';
        css.slice(start, end).split('\n').forEach(line => {
            const group = /\/\*\s*---\s*(.+?)\s*---\s*\*\//.exec(line);
            if (group) {
                box.insertAdjacentHTML('beforeend', `<h4>${group[1]}</h4>`);
                comment = '';
                return;
            }
            const note = /\/\*\s*(.+?)\s*(\*\/)?$/.exec(line.trim());
            if (note && !/^--/.test(line.trim())) { comment = note[1]; return; }

            const v = /^\s*(--[\w-]+):\s*([^;]+);/.exec(line);
            if (v) {
                box.append(buildVarRow(v[1], v[2].trim(), comment));
                comment = '';
            }
        });
    }
    buildVarPanel();


    // ---------------------------------------------------------------
    // 作品の配置
    // ---------------------------------------------------------------
    if (grid) setupLayoutEditing();

    function setupLayoutEditing() {
        // 配置の編集は「All」の表示で行う
        const allBtn = document.querySelector('.filter-btn[data-filter="all"]');
        if (allBtn && !allBtn.classList.contains('active')) allBtn.click();

        // スクロールでふわっと出る演出を止め、全部見えている状態にする
        document.querySelectorAll('.fade-on-scroll').forEach(el => el.classList.add('is-visible'));

        // 24列のマス目を薄く表示する
        const columns = document.createElement('div');
        columns.className = 'ed-columns';
        columns.innerHTML = '<span></span>'.repeat(COLS);
        grid.prepend(columns);

        const items = [...grid.querySelectorAll('.work-item')];
        items.forEach(item => {
            item.setAttribute('draggable', 'false');
            item.insertAdjacentHTML('beforeend', '<span class="ed-tag"></span><span class="ed-handle" title="ドラッグで幅を変更"></span>');
        });

        // 保存された配置がまだなければ、いまの自動配置を測って、そこから始める
        // （文字の読み込みでカードの高さが変わるので、フォントの読み込みを待ってから測る）
        (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
            if (!grid.classList.contains('is-free')) captureAutoLayout(items);
            items.forEach(updateTag);
        });

        // 編集中はリンクとして開かないようにする
        grid.addEventListener('click', e => {
            if (e.target.closest('.work-item')) e.preventDefault();
        }, true);

        grid.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', () => { drag = null; root.classList.remove('ed-dragging'); });
        document.addEventListener('keydown', onKeyDown);

        panel.querySelector('.ed-auto').addEventListener('click', async () => {
            if (!confirm('保存した配置を消して、自動配置に戻します。よろしいですか？')) return;
            const payload = { layout: {} };
            if (Object.keys(changedVars).length) payload.vars = { ...changedVars };
            if (await save(payload)) {
                // 保存済みなので、再読み込み時の「変更が失われます」確認を出さない
                layoutDirty = false;
                Object.keys(changedVars).forEach(k => delete changedVars[k]);
                location.reload();
            }
        });
    }

    function pitch() {
        return parseFloat(grid.style.getPropertyValue('--pitch')) || grid.clientWidth / COLS;
    }

    function captureAutoLayout(items) {
        const gap = parseFloat(getComputedStyle(grid).getPropertyValue('--gap-x')) || 40;
        const p = (grid.clientWidth + gap) / COLS;
        const g = grid.getBoundingClientRect();
        Object.keys(worksLayout).forEach(k => delete worksLayout[k]);
        items.forEach(item => {
            const r = item.getBoundingClientRect();
            worksLayout[item.dataset.code] = {
                x: Math.max(0, Math.round((r.left - g.left) / p)),
                y: Math.max(0, Math.round((r.top - g.top) / p * 4) / 4),
                w: Math.round((r.width + gap) / p),
            };
        });
        layoutWorks();
    }

    function setPos(item, pos) {
        worksLayout[item.dataset.code] = pos;
        item.style.setProperty('--x', pos.x);
        item.style.setProperty('--y', pos.y);
        item.style.setProperty('--w', pos.w);
        updateFreeLayoutSize();
        updateTag(item);
        layoutDirty = true;
        markDirty();
    }

    function updateTag(item) {
        const pos = worksLayout[item.dataset.code];
        const tag = item.querySelector('.ed-tag');
        if (pos && tag) tag.textContent = `x ${pos.x}  w ${pos.w}  y ${pos.y}`;
    }

    function select(item) {
        if (selected) selected.classList.remove('ed-selected');
        selected = item;
        if (item) item.classList.add('ed-selected');
    }

    function onPointerDown(e) {
        const item = e.target.closest('.work-item');
        if (!item || e.button !== 0) return;
        e.preventDefault();
        select(item);
        drag = {
            item,
            mode: e.target.closest('.ed-handle') ? 'resize' : 'move',
            startX: e.clientX,
            startY: e.clientY,
            pos: { ...worksLayout[item.dataset.code] },
        };
        root.classList.add('ed-dragging');
    }

    function onPointerMove(e) {
        if (!drag) return;
        const p = pitch();
        const dx = (e.clientX - drag.startX) / p;
        const dy = (e.clientY - drag.startY) / p;
        const pos = { ...drag.pos };

        if (drag.mode === 'move') {
            pos.x = Math.min(COLS - pos.w, Math.max(0, Math.round(pos.x + dx)));
            pos.y = Math.max(0, Math.round((pos.y + dy) * 4) / 4);
        } else {
            pos.w = Math.min(COLS - pos.x, Math.max(2, Math.round(pos.w + dx)));
        }
        setPos(drag.item, pos);
    }

    function onKeyDown(e) {
        if (!selected || e.target.closest('input, textarea')) return;
        if (e.key === 'Escape') { select(null); return; }

        const pos = { ...worksLayout[selected.dataset.code] };
        const step = e.shiftKey ? 4 : 1;
        if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
            pos.w = Math.min(COLS - pos.x, Math.max(2, pos.w + (e.key === 'ArrowRight' ? 1 : -1)));
        } else if (e.key === 'ArrowLeft') {
            pos.x = Math.max(0, pos.x - step);
        } else if (e.key === 'ArrowRight') {
            pos.x = Math.min(COLS - pos.w, pos.x + step);
        } else if (e.key === 'ArrowUp') {
            pos.y = Math.max(0, pos.y - 0.25 * step);
        } else if (e.key === 'ArrowDown') {
            pos.y = pos.y + 0.25 * step;
        } else {
            return;
        }
        e.preventDefault();
        setPos(selected, pos);
    }


    // ---------------------------------------------------------------
    // 保存
    // ---------------------------------------------------------------
    async function save(payload) {
        statusEl.textContent = '保存中…';
        try {
            const res = await fetch('/__editor/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
            statusEl.textContent = '保存しました';
            statusEl.classList.remove('is-dirty');
            return true;
        } catch (err) {
            statusEl.textContent = `保存できませんでした（${err.message}）。python3 _editor/server.py で開いていますか？`;
            statusEl.classList.add('is-dirty');
            return false;
        }
    }

    panel.querySelector('.ed-save').addEventListener('click', async () => {
        const payload = {};
        if (Object.keys(changedVars).length) payload.vars = { ...changedVars };
        if (layoutDirty) payload.layout = { ...worksLayout };
        if (!payload.vars && !payload.layout) {
            statusEl.textContent = '変更はまだありません';
            return;
        }
        if (await save(payload)) {
            Object.keys(changedVars).forEach(k => delete changedVars[k]);
            layoutDirty = false;
        }
    });

    window.addEventListener('beforeunload', e => {
        if (layoutDirty || Object.keys(changedVars).length) e.preventDefault();
    });
})();
