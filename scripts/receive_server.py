#!/usr/bin/env python3
"""
One-shot authenticated receiver for the mirror-import transfer.
Listens on 0.0.0.0:RECV_PORT; accepts POST /put/<TOKEN>/<name> for an
allow-listed set of part/meta files into RECV_DIR. Self-terminates after
RECV_TTL_MIN minutes. Stdlib only.
"""

import hashlib
import os
import re
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("RECV_PORT", "8899"))
TOKEN = os.environ.get("RECV_TOKEN", "")
OUT = os.environ.get("RECV_DIR", "/home/user/snapshot_recv")
TTL_MIN = int(os.environ.get("RECV_TTL_MIN", "90"))
MAX_BODY = 8 * 1024 * 1024

if not re.fullmatch(r"[0-9a-f]{64}", TOKEN):
    print("RECV_TOKEN must be 64 hex chars", file=sys.stderr)
    sys.exit(2)

os.makedirs(OUT, exist_ok=True)

PART_RE = re.compile(r"part-\d{4}\.tar\.part$")
NAME_RE = re.compile(r"^(part-\d{4}\.tar\.part|meta\.json)$")


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body=b""):
        self.send_response(code)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if body:
            self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self._send(200, b"ok\n")
        else:
            self._send(404)

    def do_POST(self):
        m = re.fullmatch(r"/put/([0-9a-f]{64})/(.+)", self.path)
        if not m or m.group(1) != TOKEN:
            self._send(404)
            return
        name = m.group(2)
        if "/" in name or not NAME_RE.match(name):
            self._send(400, b"bad name\n")
            return
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BODY:
            self._send(413, b"bad size\n")
            return
        data = self.rfile.read(length)
        if len(data) != length:
            self._send(400, b"short read\n")
            return
        with open(os.path.join(OUT, name), "wb") as f:
            f.write(data)
        sha = hashlib.sha256(data).hexdigest()
        self.log_message("saved %s (%d bytes) sha256=%s", name, len(data), sha)
        self._send(200, f"saved {len(data)} {sha}\n".encode())

    def log_message(self, fmt, *args):
        sys.stderr.write("recv: " + (fmt % args) + "\n")
        sys.stderr.flush()

    def log_error(self, fmt, *args):
        self.log_message("ERR " + fmt, *args)


def main():
    srv = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"receive server listening on 0.0.0.0:{PORT} token={TOKEN[:12]}... out={OUT}",
          flush=True)
    threading.Timer(TTL_MIN * 60, srv.shutdown).start()
    try:
        srv.serve_forever()
    finally:
        srv.server_close()
        print("receive server stopped", flush=True)


if __name__ == "__main__":
    main()
