/* ===================================================================
   メンテナンス中の切り替え

   ON が true の間、公開サイト（github.io）を開いた人は maintenance.html に案内される。
   制作が終わったら ON を false にしてコミット・push すれば、ふつうのサイトに戻る。

   ・自分のMacで確認するとき（localhost / 127.0.0.1）は、いつもふつうのサイトが出る
   ・公開サイトの本体を自分で見たいときは、URLの最後に ?preview を付けて1回開く
     （そのブラウザでは以後ずっと本体が見える。やめるときは ?preview=off）
   =================================================================== */
(function () {
    var ON = true;

    var host = location.hostname;
    if (!ON || host === 'localhost' || host === '127.0.0.1' || host === '') return;

    var params = new URLSearchParams(location.search);
    var KEY = 'mm-preview';
    try {
        if (params.get('preview') === 'off') localStorage.removeItem(KEY);
        else if (params.has('preview')) localStorage.setItem(KEY, '1');
        if (localStorage.getItem(KEY) === '1') return;
    } catch (e) {
        // 保存が使えないブラウザでも、?preview を付けたその1回だけは本体を見せる
        if (params.has('preview') && params.get('preview') !== 'off') return;
    }

    location.replace('maintenance.html');
})();
