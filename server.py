# CaseRecord 本地服务器（禁止缓存，保证每次加载最新代码）
import http.server
import socketserver
import os

PORT = 8081
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory="app", **kwargs)

    def end_headers(self):
        # 禁止浏览器缓存，修改代码后刷新即可生效
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, format, *args):
        pass


with socketserver.ThreadingTCPServer(("", PORT), Handler) as httpd:
    print(f"CaseRecord server running at http://localhost:{PORT}/")
    httpd.serve_forever()
