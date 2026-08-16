# CaseRecord 本地服务器（禁止缓存 + JSON 文件数据存储）
# - 静态文件服务（app/ 目录，no-cache）
# - GET  /api/ai-config            读取本地 AI 配置（data/ai-config.json）
# - POST /api/ai-config            写入本地 AI 配置
# - GET  /api/profile              读取档案（data/profile.json）
# - POST /api/profile              写入档案
# - GET  /api/cases                病例列表（data/cases/<id>/case.json 摘要）
# - GET  /api/cases/<id>           读取单个病例
# - POST /api/cases/<id>           写入单个病例
# - DELETE /api/cases/<id>         删除病例文件夹
# - GET  /api/cases/<id>/ocr/<idx> 读取该病例某张报告的识别结果（data/cases/<id>/ocr-<idx>.json）
# - POST /api/cases/<id>/ocr/<idx> 写入该病例某张报告的识别结果
import http.server
import socketserver
import os
import json
import re
import shutil
import time
import base64

PORT = 8081
BASE = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.join(BASE, "app")
DATA_DIR = os.path.join(BASE, "data")
CASES_DIR = os.path.join(DATA_DIR, "cases")
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(CASES_DIR, exist_ok=True)
CONFIG_FILE = os.path.join(DATA_DIR, "ai-config.json")
PROFILE_FILE = os.path.join(DATA_DIR, "profile.json")


def read_json(path, default=None):
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return default
    return default


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def send_json(handler, status, data):
    body = json.dumps(data, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def read_body(handler):
    length = int(handler.headers.get("Content-Length", 0))
    if length <= 0:
        return None
    raw = handler.rfile.read(length).decode("utf-8", errors="replace")
    try:
        return json.loads(raw)
    except Exception:
        return None


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=APP_DIR, **kwargs)

    def end_headers(self):
        # 禁止浏览器缓存，修改代码后刷新即可生效
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    # ---------- 路由 ----------

    def do_GET(self):
        p = self.path
        if p == "/api/ai-config":
            return send_json(self, 200, read_json(CONFIG_FILE, {}))
        if p == "/api/profile":
            return send_json(self, 200, read_json(PROFILE_FILE, {}))
        if p == "/api/cases":
            return self._list_cases()
        m = re.match(r"^/api/cases/([^/]+)$", p)
        if m:
            return self._get_case(m.group(1))
        m = re.match(r"^/api/cases/([^/]+)/ocr/(\d+)$", p)
        if m:
            return self._get_ocr(m.group(1), m.group(2))
        m = re.match(r"^/api/cases/([^/]+)/images/([^/]+)$", p)
        if m:
            return self._get_image(m.group(1), m.group(2))
        super().do_GET()

    def do_POST(self):
        p = self.path
        if p == "/api/ai-config":
            data = read_body(self)
            write_json(CONFIG_FILE, data if isinstance(data, dict) else {})
            return send_json(self, 200, {"ok": True})
        if p == "/api/profile":
            data = read_body(self)
            write_json(PROFILE_FILE, data if isinstance(data, dict) else {})
            return send_json(self, 200, {"ok": True})
        m = re.match(r"^/api/cases/([^/]+)$", p)
        if m:
            return self._save_case(m.group(1))
        m = re.match(r"^/api/cases/([^/]+)/ocr/(\d+)$", p)
        if m:
            return self._save_ocr(m.group(1), m.group(2))
        m = re.match(r"^/api/cases/([^/]+)/images$", p)
        if m:
            return self._upload_image(m.group(1))
        send_json(self, 404, {"ok": False, "error": "not found"})

    def do_DELETE(self):
        m = re.match(r"^/api/cases/([^/]+)$", self.path)
        if m:
            return self._delete_case(m.group(1))
        send_json(self, 404, {"ok": False, "error": "not found"})

    # ---------- 病例 ----------

    def _case_dir(self, cid):
        # 只允许安全字符，防止路径穿越
        if not re.match(r"^[A-Za-z0-9_-]+$", cid or ""):
            return None
        return os.path.join(CASES_DIR, cid)

    def _case_file(self, cid):
        d = self._case_dir(cid)
        return os.path.join(d, "case.json") if d else None

    def _list_cases(self):
        items = []
        for name in os.listdir(CASES_DIR):
            d = os.path.join(CASES_DIR, name)
            if not os.path.isdir(d):
                continue
            c = read_json(os.path.join(d, "case.json"))
            if not c or not isinstance(c, dict):
                continue
            # 摘要（不含大体积图片数据）
            items.append({
                "id": c.get("id"),
                "illness": c.get("illness", ""),
                "condition": c.get("condition", ""),
                "createdAt": c.get("createdAt", ""),
                "updatedAt": c.get("updatedAt", ""),
                "imagesCount": len(c.get("images") or []),
                "medsCount": len(c.get("meds") or []),
                "hasOcr": any((im.get("ocr")) for im in (c.get("images") or []))
            })
        # 按创建时间倒序
        items.sort(key=lambda x: x.get("createdAt") or "", reverse=True)
        return send_json(self, 200, items)

    def _get_case(self, cid):
        c = read_json(self._case_file(cid))
        if c is None:
            return send_json(self, 404, {"ok": False, "error": "case not found"})
        return send_json(self, 200, c)

    def _save_case(self, cid):
        data = read_body(self)
        if not isinstance(data, dict):
            return send_json(self, 400, {"ok": False, "error": "invalid json"})
        f = self._case_file(cid)
        if f is None:
            return send_json(self, 400, {"ok": False, "error": "bad id"})
        data["id"] = cid
        write_json(f, data)
        # 同步重写 OCR 文件：按新 images 顺序，删除多余文件
        # （编辑删除报告后，被删报告的 ocr-<idx>.json 也会一并删除）
        d = self._case_dir(cid)
        if d and os.path.isdir(d):
            for name in os.listdir(d):
                if name.startswith("ocr-") and name.endswith(".json"):
                    os.remove(os.path.join(d, name))
            images = data.get("images") or []
            for i, im in enumerate(images):
                ocr = im.get("ocr") if isinstance(im, dict) else None
                if isinstance(ocr, dict) and (ocr.get("text") or ocr.get("rows")):
                    ocr["savedAt"] = ocr.get("savedAt") or ""
                    write_json(os.path.join(d, "ocr-%d.json" % i), ocr)
            # 清理未被 case.json 引用的孤儿图片文件
            imgs_dir = os.path.join(d, "images")
            if os.path.isdir(imgs_dir):
                referenced = set()
                for im in images:
                    if isinstance(im, dict) and im.get("file"):
                        referenced.add(im["file"])
                for name in os.listdir(imgs_dir):
                    if name not in referenced:
                        try:
                            os.remove(os.path.join(imgs_dir, name))
                        except OSError:
                            pass
        return send_json(self, 200, {"ok": True, "id": cid})

    def _delete_case(self, cid):
        d = self._case_dir(cid)
        if d is None:
            return send_json(self, 400, {"ok": False, "error": "bad id"})
        if os.path.isdir(d):
            shutil.rmtree(d, ignore_errors=True)
        return send_json(self, 200, {"ok": True})

    # ---------- OCR（每张报告一个 json） ----------

    def _ocr_file(self, cid, idx):
        d = self._case_dir(cid)
        if d is None:
            return None
        return os.path.join(d, "ocr-" + str(idx) + ".json")

    def _get_ocr(self, cid, idx):
        f = self._ocr_file(cid, idx)
        if f is None:
            return send_json(self, 400, {"ok": False, "error": "bad id"})
        data = read_json(f, {})
        return send_json(self, 200, data)

    def _save_ocr(self, cid, idx):
        f = self._ocr_file(cid, idx)
        if f is None:
            return send_json(self, 400, {"ok": False, "error": "bad id"})
        data = read_body(self)
        if not isinstance(data, dict):
            return send_json(self, 400, {"ok": False, "error": "invalid json"})
        data["savedAt"] = data.get("savedAt") or ""
        write_json(f, data)
        return send_json(self, 200, {"ok": True})

    # ---------- 报告图片文件（独立存储，JSON 只存引用） ----------

    def _images_dir(self, cid):
        d = self._case_dir(cid)
        if d is None:
            return None
        return os.path.join(d, "images")

    def _upload_image(self, cid):
        d = self._images_dir(cid)
        if d is None:
            return send_json(self, 400, {"ok": False, "error": "bad id"})
        data = read_body(self)
        if not isinstance(data, dict) or not data.get("dataUrl"):
            return send_json(self, 400, {"ok": False, "error": "invalid image data"})
        data_url = str(data["dataUrl"])
        # 解析 dataUrl 中的 base64 部分与 mime
        m = re.match(r"^data:([^;]+);base64,(.*)$", data_url, re.S)
        if not m:
            return send_json(self, 400, {"ok": False, "error": "invalid data url"})
        mime = m.group(1)
        raw = m.group(2)
        try:
            content = base64.b64decode(raw)
        except Exception:
            return send_json(self, 400, {"ok": False, "error": "invalid base64"})
        # 文件名：时间戳 + 序号，扩展名按 mime 推断
        ext_map = {
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/webp": "webp",
            "image/gif": "gif",
            "application/pdf": "pdf"
        }
        ext = ext_map.get(mime, "bin")
        os.makedirs(d, exist_ok=True)
        fname = "%d-%d.%s" % (int(time.time() * 1000), len(os.listdir(d)) + 1, ext)
        with open(os.path.join(d, fname), "wb") as f:
            f.write(content)
        return send_json(self, 200, {"ok": True, "file": fname, "type": mime})

    def _get_image(self, cid, fname):
        d = self._images_dir(cid)
        if d is None or not re.match(r"^[A-Za-z0-9_.-]+$", fname or ""):
            return send_json(self, 400, {"ok": False, "error": "bad file name"})
        fp = os.path.join(d, fname)
        if not os.path.isfile(fp):
            return send_json(self, 404, {"ok": False, "error": "image not found"})
        mime_map = {
            "jpg": "image/jpeg", "jpeg": "image/jpeg",
            "png": "image/png", "webp": "image/webp",
            "gif": "image/gif", "pdf": "application/pdf", "bin": "application/octet-stream"
        }
        ext = fname.rsplit(".", 1)[-1].lower()
        with open(fp, "rb") as f:
            body = f.read()
        handler = self
        handler.send_response(200)
        handler.send_header("Content-Type", mime_map.get(ext, "application/octet-stream"))
        handler.send_header("Content-Length", str(len(body)))
        handler.end_headers()
        handler.wfile.write(body)

    def log_message(self, format, *args):
        pass


with socketserver.ThreadingTCPServer(("", PORT), Handler) as httpd:
    print(f"CaseRecord server running at http://localhost:{PORT}/")
    httpd.serve_forever()
