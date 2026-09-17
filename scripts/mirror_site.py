#!/usr/bin/env python3
"""
Production snapshot crawler for La Bussola (labussolaitalia.com).

Downloads the live site byte-for-byte into MIRROR_OUT (default: ../mirror-out),
following same-origin references from the index page (HTML, CSS, JS, JSON,
SVG, sitemap). Files are saved with their exact path (query strings and
fragments are stripped from the on-disk name; referencing files are NOT
rewritten). A TSV manifest (path, sha256, size, content-type, status, source
url) is printed between MIRROR_MANIFEST_START / MIRROR_MANIFEST_END markers
and is NEVER written into the mirrored tree.

Stdlib only. Environment overrides (for testing):
  MIRROR_BASE   e.g. https://labussolaitalia.com
  MIRROR_OUT    output directory
"""

import hashlib
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from collections import deque

BASE = os.environ.get("MIRROR_BASE", "https://labussolaitalia.com").rstrip("/")
HOST = urllib.parse.urlsplit(BASE).netloc.lower()
OUT_DIR = os.path.abspath(os.environ.get("MIRROR_OUT",
                                         os.path.join(os.path.dirname(__file__), "..", "mirror-out")))

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

MAX_FILES = 2000
MAX_TOTAL_BYTES = 200 * 1024 * 1024
MAX_FILE_BYTES = 20 * 1024 * 1024

ALLOWED_EXT = {
    ".html", ".htm", ".css", ".js", ".mjs", ".cjs", ".json", ".webmanifest",
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg", ".ico", ".bmp",
    ".woff", ".woff2", ".ttf", ".otf", ".eot",
    ".txt", ".xml", ".map", ".webm", ".mp4", ".mp3", ".opus", ".pdf", ".wasm",
}
PAGE_EXT = {".html", ".htm"}
# dynamic endpoints are not part of the static production snapshot
SKIP_PREFIXES = ("/api/", "/.well-known/")

PROBES = [
    "/robots.txt", "/sitemap.xml",
    "/manifest.webmanifest", "/manifest.json", "/site.webmanifest",
    "/sw.js", "/service-worker.js",
    "/favicon.ico", "/offline.html",
    "/icon-192.png", "/icon-512.png",
    "/apple-touch-icon.png", "/logo192.png", "/logo512.png",
]

manifest = []   # (relpath, sha256, size, ctype, status, srcurl)
fetched = {}    # rel -> (status, final_url)
seen = set()    # rel already queued
external = set()  # unique external URLs referenced (not mirrored)

TAG_ATTR_RE = re.compile(
    r"""<(?:a|link|img|script|source|input|video|audio|iframe|object|track|embed)\b[^>]*?\b(?:href|src|poster|data)\s*=\s*["']([^"']*)["']""",
    re.I | re.S)
SRCSET_RE = re.compile(r"""srcset\s*=\s*["']([^"']*)["']""", re.I)
# quoted string literals that start with "/" (JS/JSON/SVG inline content)
QUOTED_PATH_RE = re.compile(r"""["'`](/[A-Za-z0-9_\-./?&=%+~#@!$,;:*]{0,250}?)["'`]""")
CSS_URL_RE = re.compile(r"""url\(\s*['"]?([^'")\s]+)['"]?\s*\)""", re.I)
META_REFRESH_RE = re.compile(
    r"""<meta[^>]+http-equiv\s*=\s*["']refresh["'][^>]*content\s*=\s*["'][^"']*?url\s*=\s*([^"']+)["']""",
    re.I)


def log(msg):
    print(msg, flush=True)


def rel_of(absolute_url):
    """Return the site-relative path (no query/fragment) for a same-origin
    absolute URL, else None."""
    try:
        p = urllib.parse.urlsplit(absolute_url)
    except ValueError:
        return None
    if p.scheme not in ("http", "https"):
        return None
    host = (p.netloc or "").lower().rstrip(".")
    if host not in (HOST, "www." + HOST, HOST + "."):
        if p.scheme in ("http", "https") and p.netloc:
            external.add(absolute_url.split("#", 1)[0])
        return None
    path = urllib.parse.unquote(p.path or "/")
    path = re.sub(r"/{2,}", "/", path)
    if not path.startswith("/"):
        return None
    if len(path) > 300:
        return None
    if any(part == ".." for part in path.split("/")):
        return None
    if any(ord(c) < 0x20 or c == "\x7f" for c in path):
        return None
    return path


def queue(url, referrer=None):
    if not isinstance(url, str):
        return
    url = url.strip()
    if not url or url.startswith("#"):
        return
    low = url.lower()
    if low.startswith(("data:", "mailto:", "tel:", "javascript:", "blob:", "about:")):
        return
    if re.match(r"^[a-z][a-z0-9+.\-]*://", low):
        absu = url
    elif url.startswith("//"):
        absu = "https:" + url
    else:
        absu = urllib.parse.urljoin(BASE + (referrer or "/"), url)
    rel = rel_of(absu)
    if rel is None or rel in seen:
        return
    if any(rel.startswith(pfx) for pfx in SKIP_PREFIXES):
        log(f"SKIP-DYNAMIC {rel}")
        seen.add(rel)
        return
    seen.add(rel)
    root, ext = os.path.splitext(rel)
    if rel == "/" or ext.lower() in PAGE_EXT:
        queue_pages.append(rel)
    else:
        queue_assets.add(rel)


queue_pages = deque()
queue_assets = set()


def download(rel):
    url = BASE + rel
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "*/*",
        "Accept-Language": "it-IT,it;q=0.9,en;q=0.8",
    })
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            data = r.read()
            ctype = r.headers.get("Content-Type", "")
            status = r.status
            final_url = r.geturl()
    except urllib.error.HTTPError as e:
        fetched[rel] = (e.code, url)
        log(f"HTTP-{e.code} {rel}")
        return None
    except Exception as e:  # noqa: BLE001
        fetched[rel] = ("ERROR", url)
        log(f"ERROR {rel}: {e!r}")
        return None

    if len(data) > MAX_FILE_BYTES:
        log(f"TOO-BIG-SKIPPED {rel} ({len(data)} bytes)")
        fetched[rel] = (status, final_url)
        return None

    relpath = "index.html" if rel == "/" else rel[1:]
    dest = os.path.join(OUT_DIR, relpath)
    parent = os.path.dirname(dest)
    if parent:
        os.makedirs(parent, exist_ok=True)
    with open(dest, "wb") as f:
        f.write(data)

    sha = hashlib.sha256(data).hexdigest()
    manifest.append((relpath, sha, len(data), ctype, status, url))
    fetched[rel] = (status, final_url)
    log(f"OK {status} {relpath} ({len(data)} bytes, {ctype})")
    return data


def decode(data):
    return data.decode("utf-8", "replace")


def scan_html(rel, data):
    text = decode(data)
    for m in TAG_ATTR_RE.finditer(text):
        queue(m.group(1), referrer=rel)
    for m in SRCSET_RE.finditer(text):
        for part in m.group(1).split(","):
            tok = part.strip().split()[0] if part.strip() else ""
            if tok:
                queue(tok, referrer=rel)
    for m in META_REFRESH_RE.finditer(text):
        queue(m.group(1), referrer=rel)
    for m in QUOTED_PATH_RE.finditer(text):
        queue(m.group(1), referrer=rel)


def scan_css(rel, data):
    text = decode(data)
    for m in CSS_URL_RE.finditer(text):
        u = m.group(1)
        if u.startswith("data:") or u.startswith("#"):
            continue
        queue(u, referrer=rel)


def scan_js(rel, data):
    text = decode(data)
    for m in QUOTED_PATH_RE.finditer(text):
        queue(m.group(1), referrer=rel)


def scan_json_like(rel, data):
    text = decode(data)
    for m in QUOTED_PATH_RE.finditer(text):
        queue(m.group(1), referrer=rel)


def scan_svg(rel, data):
    text = decode(data)
    for m in TAG_ATTR_RE.finditer(text):
        queue(m.group(1), referrer=rel)
    for m in CSS_URL_RE.finditer(text):
        u = m.group(1)
        if not u.startswith(("data:", "#")):
            queue(u, referrer=rel)


def scan_xml(rel, data):
    try:
        root = ET.fromstring(data)
    except ET.ParseError:
        scan_js(rel, data)
        return
    for el in root.iter():
        tag = el.tag.rsplit("}", 1)[-1].lower()
        if tag == "loc" and el.text:
            queue(el.text.strip())
        for attr, val in el.attrib.items():
            if val and (val.startswith("http") or val.startswith("/")):
                queue(val)


def looks_html(data):
    head = data[:512].lstrip(b"\xef\xbb\xbf \t\r\n").lower()
    return head.startswith(b"<!doctype html") or head.startswith(b"<html")


def scan_file(rel, data, ctype=""):
    lower = rel.lower()
    root, ext = os.path.splitext(lower)
    if lower == "/" or ext in (".html", ".htm"):
        scan_html(rel, data)
    elif not ext or "html" in (ctype or "").lower() or looks_html(data):
        # extensionless page or html content: follow its references too
        scan_html(rel, data)
    elif ext == ".css":
        scan_css(rel, data)
    elif ext in (".js", ".mjs", ".cjs", ".map"):
        scan_js(rel, data)
    elif ext in (".json", ".webmanifest"):
        scan_json_like(rel, data)
    elif ext == ".xml":
        scan_xml(rel, data)
    elif ext == ".svg":
        scan_svg(rel, data)
    # binary / other: no reference scanning


def main():
    if os.path.exists(OUT_DIR):
        for name in os.listdir(OUT_DIR):
            path = os.path.join(OUT_DIR, name)
            if os.path.isfile(path):
                os.remove(path)
            else:
                import shutil
                shutil.rmtree(path)
    os.makedirs(OUT_DIR, exist_ok=True)

    queue(BASE + "/")
    for probe in PROBES:
        queue(BASE + probe)

    total_bytes = 0
    while queue_pages or queue_assets:
        if len(manifest) >= MAX_FILES or total_bytes >= MAX_TOTAL_BYTES:
            log("FATAL: size cap exceeded")
            sys.exit(2)
        if queue_pages:
            rel = queue_pages.popleft()
        else:
            rel = next(iter(queue_assets))
            queue_assets.discard(rel)
        data = download(rel)
        if data is not None:
            total_bytes += len(data)
            scan_file(rel, data, manifest[-1][3] if manifest else "")

    log("MIRROR_MANIFEST_START")
    for entry in sorted(manifest):
        log("\t".join(str(x) for x in entry))
    log("MIRROR_MANIFEST_END")
    log(f"MIRROR_SUMMARY files={len(manifest)} bytes={total_bytes}")
    bad = {rel: st for rel, (st, _u) in sorted(fetched.items()) if st != 200}
    if bad:
        log("MIRROR_NON200 " + " ".join(f"{rel}={st}" for rel, st in bad.items()))
    else:
        log("MIRROR_NON200 (none)")
    if external:
        log("MIRROR_EXTERNAL " + " ".join(sorted(external)))
    else:
        log("MIRROR_EXTERNAL (none)")


if __name__ == "__main__":
    main()
