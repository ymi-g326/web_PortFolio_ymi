// ===================================================================
// 編集モード（自分のMacで ?edit を付けて開いたときだけ読み込まれる）
// ===================================================================
//
// できること
//   ・style.css「00. 文字の調整パネル」の値を、スライダーでその場で調整
//   ・見出しや文章などをドラッグして、縦横の位置をずらす（Shift で縦か横の一方向だけ）
//     ずらした量は調整パネルの --pos-○○ に入る。ダブルクリックで元の位置に戻る
//   ・「保存」で style.css に書き込む（_editor/server.py が受け取る）
//
// 動かせるのは HTML で data-pos="○○" を付けた要素。増やすときは、HTML に data-pos を付け、
// style.css の調整パネルに --pos-○○ と、その下の [data-pos="○○"] の行を足す。
//
// 読み込みは script.js の loadEditor()。公開サイトでは読み込まれない。
// ===================================================================
(() => {
    const root = document.documentElement;
    const changedVars = {};   // 保存していない値
    const posControls = {};   // --pos-○○ → パネルの数字を読み書きする道具
    let drag = null;          // ドラッグ中の情報

    root.classList.add('ed-on');

    // スクロールでふわっと出る演出を止め、全部見えている状態にする
    document.querySelectorAll('.fade-on-scroll').forEach(el => el.classList.add('is-visible'));


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
            <section class="ed-section">
                <p class="ed-note">点線が出る見出しや文章は、ドラッグで位置をずらせます（Shift で縦か横の一方向だけ、ダブルクリックで元の位置）。スマホ幅では、ずらしは効きません。<br>clamp は「最小・画面幅に比例・最大」。右の数字は、いまの画面幅での実際の大きさです。</p>
            </section>
            <section class="ed-section ed-vars"></section>
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
    // 値の一覧：style.css を読み、調整パネルの変数を並べる
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
        if (/columns/.test(name)) return { min: 1, max: 6, step: 1 };
        if (/^--pos-/.test(name)) return { min: -400, max: 400, step: 1 };
        if (unit === 'rem') return { min: 0, max: 8, step: 0.05 };
        if (unit === 'px') return { min: 0, max: 240, step: 1 };
        if (unit === 'em') return { min: -0.1, max: 0.4, step: 0.005 };
        if (unit === 'vw') return { min: 0, max: 10, step: 0.1 };
        return { min: 0, max: 4, step: 0.05 };
    }

    /**
     * 数値1つぶんの操作部品（スライダー＋数字入力）を作る。
     * onInput には新しい数値が渡される。戻り値の set() で外から値を書き換えられる。
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
        wrap.set = v => { range.value = v; num.value = v; };
        return wrap;
    }

    function setVar(name, value) {
        root.style.setProperty(name, value);
        changedVars[name] = value;
        refreshAfterChange();
        markDirty();
    }

    // 文字の大きさが変わるとカードの高さも変わるので、作品一覧を組み直す
    let relayoutTimer;
    function refreshAfterChange() {
        panel.querySelectorAll('.ed-var').forEach(row => row.refresh && row.refresh());
        clearTimeout(relayoutTimer);
        relayoutTimer = setTimeout(() => {
            if (typeof layoutWorks === 'function') layoutWorks();
        }, 120);
    }

    function buildVarRow(name, value, comment) {
        const row = document.createElement('div');
        row.className = 'ed-var';
        row.innerHTML = `
            <div class="ed-var-head"><code>${name}</code><span class="ed-real"></span></div>
            ${comment ? `<p class="ed-var-note">${comment}</p>` : ''}
            <p class="ed-warn" hidden></p>
        `;
        const sizeEl = row.querySelector('.ed-real');
        const warnEl = row.querySelector('.ed-warn');
        const showsSize = !/weight|columns|^--pos-/.test(name);
        row.refresh = () => { if (showsSize) sizeEl.textContent = realSize(name); };
        row.refresh();

        const clamp = /^clamp\(\s*([\d.]+)(rem|px)\s*,\s*([\d.]+)vw\s*,\s*([\d.]+)(rem|px)\s*\)$/.exec(value);
        const pair = /^(-?[\d.]+)px\s+(-?[\d.]+)px$/.exec(value);
        const single = /^(-?[\d.]+)(px|rem|em|vw)?$/.exec(value);

        if (clamp) {
            // clamp(最小, 比例, 最大) は、3つの数字をそれぞれ動かせるようにする
            const parts = { min: +clamp[1], minU: clamp[2], fluid: +clamp[3], max: +clamp[4], maxU: clamp[5] };
            // 最小が最大より大きいと、画面幅に関係なく常に「最小」の大きさになる
            const checkClamp = () => {
                const broken = parts.minU === parts.maxU && parts.min > parts.max;
                warnEl.hidden = !broken;
                warnEl.textContent = broken ? '最小が最大より大きいので、画面幅に関係なく常に「最小」の大きさになります' : '';
            };
            const update = () => {
                setVar(name, `clamp(${parts.min}${parts.minU}, ${parts.fluid}vw, ${parts.max}${parts.maxU})`);
                checkClamp();
            };
            row.append(
                numberControl('最小', parts.min, parts.minU, name, v => { parts.min = v; update(); }),
                numberControl('比例', parts.fluid, 'vw', name, v => { parts.fluid = v; update(); }),
                numberControl('最大', parts.max, parts.maxU, name, v => { parts.max = v; update(); })
            );
            checkClamp();
        } else if (pair) {
            // 位置のずらし（横 縦）
            const xy = { x: +pair[1], y: +pair[2] };
            const update = () => setVar(name, `${xy.x}px ${xy.y}px`);
            const xCtl = numberControl('横', xy.x, 'px', name, v => { xy.x = v; update(); });
            const yCtl = numberControl('縦', xy.y, 'px', name, v => { xy.y = v; update(); });
            row.append(xCtl, yCtl);
            posControls[name] = {
                get: () => ({ ...xy }),
                set: (x, y) => { xy.x = x; xy.y = y; xCtl.set(x); yCtl.set(y); update(); },
                row,
            };
        } else if (single) {
            const unit = single[2] || '';
            row.append(numberControl('', +single[1], unit, name, v => setVar(name, `${v}${unit}`)));
        } else {
            // 形が読めない値は、文字のまま直接書き換えられるようにする
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'ed-text';
            input.value = value;
            input.addEventListener('change', () => setVar(name, input.value.trim()));
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
        // 調整パネルの :root { … } の中だけを読む
        const start = css.indexOf('00. 文字の調整パネル（');
        const end = css.indexOf('\n}', start);
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
    // 見出しや文章をドラッグして位置をずらす
    // ---------------------------------------------------------------
    const isNarrow = () => window.matchMedia('(max-width: 768px)').matches;

    document.querySelectorAll('[data-pos]').forEach(el => el.setAttribute('draggable', 'false'));

    document.addEventListener('pointerdown', e => {
        const el = e.target.closest('[data-pos]');
        if (!el || e.button !== 0 || e.target.closest('.ed-panel') || isNarrow()) return;
        const ctl = posControls[`--pos-${el.dataset.pos}`];
        if (!ctl) return;
        e.preventDefault();
        const start = ctl.get();
        drag = { el, ctl, startX: e.clientX, startY: e.clientY, x: start.x, y: start.y, moved: false };
        root.classList.add('ed-dragging');
    });

    window.addEventListener('pointermove', e => {
        if (!drag) return;
        let dx = e.clientX - drag.startX;
        let dy = e.clientY - drag.startY;
        if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 3) return;
        drag.moved = true;
        // Shift を押している間は、動きの大きい方向だけに絞る
        if (e.shiftKey) {
            if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0;
        }
        drag.ctl.set(Math.round(drag.x + dx), Math.round(drag.y + dy));
        drag.ctl.row.scrollIntoView({ block: 'nearest' });
    });

    window.addEventListener('pointerup', () => {
        if (drag && drag.moved) {
            // ドラッグの直後に起きる「クリック」で、ボタンやリンクが反応しないようにする
            drag.el.addEventListener('click', ev => {
                ev.preventDefault();
                ev.stopPropagation();
            }, { once: true, capture: true });
        }
        drag = null;
        root.classList.remove('ed-dragging');
    });

    // ダブルクリックで元の位置に戻す
    document.addEventListener('dblclick', e => {
        const el = e.target.closest('[data-pos]');
        if (!el || e.target.closest('.ed-panel')) return;
        const ctl = posControls[`--pos-${el.dataset.pos}`];
        if (ctl) ctl.set(0, 0);
    });

    // 編集中はメールアドレスなどのリンクを開かない
    document.addEventListener('click', e => {
        if (e.target.closest('a[data-pos], [data-pos] a')) e.preventDefault();
    }, true);


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
        if (!Object.keys(changedVars).length) {
            statusEl.textContent = '変更はまだありません';
            return;
        }
        if (await save({ vars: { ...changedVars } })) {
            Object.keys(changedVars).forEach(k => delete changedVars[k]);
        }
    });

    window.addEventListener('beforeunload', e => {
        if (Object.keys(changedVars).length) e.preventDefault();
    });
})();
