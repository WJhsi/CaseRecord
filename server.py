# CaseRecord 本地服务器（禁止缓存 + 本地配置读写）
# - 静态文件服务（app/ 目录，no-cache）
# - GET  /api/ai-config   读取本地 AI 配置（data/ai-config.json）
# - POST /api/ai-config   写入本地 AI 配置（不存浏览器）
import http.server
import socketserver
import os
import json

PORT = 8081
BASE = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.join(BASE, "app")
DATA_DIR = os.path.join(BASE, "data")
os.makedirs(DATA_DIR, exist_ok=True)
CONFIG_FILE = os.path.join(DATA_DIR, "ai-config.json")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=APP_DIR, **kwargs)

    def end_headers(self):
        # 禁止浏览器缓存，修改代码后刷新即可生效
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        if self.path == "/api/ai-config":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            if os.path.exists(CONFIG_FILE):
                with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                    self.wfile.write(f.read().encode("utf-8"))
            else:
                self.wfile.write(b"{}")
            return
        super().do_GET()

    def do_POST(self):
        if self.path == "/api/ai-config":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length).decode("utf-8")
            try:
                data = json.loads(body)
                with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(b'{"ok": true}')
            except Exception as e:
                self.send_response(400)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": False, "error": str(e)}).encode("utf-8"))
            return
        self.send_response(404)
        self.end_headers()

    def log_message(self, format, *args):
        pass


with socketserver.ThreadingTCPServer(("", PORT), Handler) as httpd:
    print(f"CaseRecord server running at http://localhost:{PORT}/")
    httpd.serve_forever()
