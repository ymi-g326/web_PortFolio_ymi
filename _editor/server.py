#!/usr/bin/env python3
"""
編集モード用のローカルサーバー

    python3 _editor/server.py        → http://localhost:8765/index.html?edit を開く

ふつうの確認用サーバー（python3 -m http.server）と同じようにサイトを表示しつつ、
編集モードの「保存」ボタンから送られてきた内容を、
style.css の「00. 文字の調整パネル」の中の変数の値として書き込む（それ以外の場所は触らない）。

自分のMacの中（127.0.0.1）からしか接続できないようにしてある。
止めるときはターミナルで Ctrl + C。
"""

import http.server
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STYLE = ROOT / 'style.css'
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765

# 文字の調整パネルの範囲。この2つの見出しの間だけを書き換える
PANEL_START = '00. 文字の調整パネル（'
PANEL_END = '01. 変数'

VAR_NAME = re.compile(r'^--[a-z0-9-]+$')
# 値に使ってよい文字。clamp(1rem, 2vw, 3rem) や 400、24px、#0a7d5c などが通り、; や { } は通らない
VAR_VALUE = re.compile(r'^[a-zA-Z0-9#.,()%\s+\-*/]{1,120}$')


def save_vars(changes):
    """style.css の調整パネル内にある変数の値だけを差し替える"""
    css = STYLE.read_text(encoding='utf-8')
    start = css.index(PANEL_START)
    end = css.index(PANEL_END, start)
    panel = css[start:end]

    for name, value in changes.items():
        if not VAR_NAME.match(name) or not VAR_VALUE.match(value):
            raise ValueError(f'使えない名前か値です: {name}: {value}')
        pattern = re.compile(r'(^\s*' + re.escape(name) + r':\s*)([^;]+)(;)', re.M)
        panel, count = pattern.subn(lambda m: m.group(1) + value.strip() + m.group(3), panel, count=1)
        if count == 0:
            raise ValueError(f'調整パネルに {name} が見つかりません')

    STYLE.write_text(css[:start] + panel + css[end:], encoding='utf-8')


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        # 保存した直後に再読み込みしたとき、古いファイルが出ないようにする
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_POST(self):
        if self.path != '/__editor/save':
            self.send_error(404)
            return
        try:
            length = int(self.headers.get('Content-Length', 0))
            data = json.loads(self.rfile.read(length).decode('utf-8'))
            save_vars(data.get('vars') or {})
            self.reply(200, {'ok': True})
            print('保存しました:', ', '.join(data.get('vars') or {}))
        except Exception as err:  # 何が起きても画面に理由を返す
            self.reply(400, {'ok': False, 'error': str(err)})

    def reply(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass  # 表示のたびに大量のログが出ないようにする


if __name__ == '__main__':
    server = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler)
    print(f'編集モード: http://localhost:{PORT}/index.html?edit')
    print('止めるときは Ctrl + C')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
