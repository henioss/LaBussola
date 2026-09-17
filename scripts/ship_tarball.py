#!/usr/bin/env python3
"""
Runner-side shipper: package mirror-out/ as a deterministic gzip tarball,
split into 4MB parts, and POST meta.json + parts to the sandbox receiver
(SHIP_URL must end with the /put/<token>/ prefix).

Stdlib only. Annotations:
  ::notice::SHIP-OK parts=N tarball_bytes=N tarball_sha256=... files=N
  ::error::SHIP-FAIL ...
"""

import gzip
import hashlib
import io
import json
import os
import sys
import tarfile
import urllib.error
import urllib.request

SHIP_URL = os.environ.get("SHIP_URL", "").rstrip("/") + "/"
SRC = "mirror-out"
PART = 4 * 1024 * 1024


def deterministic_tar(dirpath):
    buf = io.BytesIO()
    entries = []
    for root, dirs, files in os.walk(dirpath):
        dirs.sort()
        for name in sorted(files):
            full = os.path.join(root, name)
            entries.append((os.path.relpath(full, dirpath), full))
    with tarfile.open(fileobj=buf, mode="w", format=tarfile.PAX_FORMAT) as tf:
        for rel, full in entries:
            st = os.lstat(full)
            ti = tarfile.TarInfo(rel)
            ti.size = st.st_size
            ti.mtime = 0
            ti.uid = ti.gid = 0
            ti.uname = ti.gname = ""
            ti.mode = 0o644
            with open(full, "rb") as fh:
                tf.addfile(ti, fh)
    return buf.getvalue()


def post(name, data):
    req = urllib.request.Request(
        SHIP_URL + name,
        data=data,
        method="POST",
        headers={"User-Agent": "mirror-import-ship",
                 "Content-Type": "application/octet-stream"},
    )
    try:
        with urllib.request.urlopen(req, timeout=900) as r:
            body = r.read()
        print(f"posted {name} ({len(data)} bytes) <- {body.decode('utf-8', 'replace').strip()[:120]}",
              flush=True)
        return True
    except urllib.error.HTTPError as e:
        print(f"::error::SHIP-FAIL {name} http {e.code} "
              f"{e.read().decode('utf-8', 'replace')[:300]}", flush=True)
        return False
    except Exception as e:  # noqa: BLE001
        print(f"::error::SHIP-FAIL {name} exc {e!r}", flush=True)
        return False


def main():
    if not SHIP_URL:
        print("::error::SHIP-FAIL no SHIP_URL")
        sys.exit(1)
    if not os.path.isdir(SRC) or not os.listdir(SRC):
        print("::error::SHIP-FAIL mirror-out missing or empty")
        sys.exit(1)

    tgz = gzip.compress(deterministic_tar(SRC), mtime=0)
    sha = hashlib.sha256(tgz).hexdigest()
    parts = [tgz[i:i + PART] for i in range(0, len(tgz), PART)]

    manifest = []
    for root, dirs, files in os.walk(SRC):
        dirs.sort()
        for name in sorted(files):
            full = os.path.join(root, name)
            rel = os.path.relpath(full, SRC)
            with open(full, "rb") as fh:
                data = fh.read()
            manifest.append({
                "path": rel,
                "sha256": hashlib.sha256(data).hexdigest(),
                "size": len(data),
            })

    meta = {
        "parts": len(parts),
        "tarball_sha256": sha,
        "tarball_bytes": len(tgz),
        "files": manifest,
    }

    ok = post("meta.json", json.dumps(meta).encode())
    for i, p in enumerate(parts, 1):
        ok = post(f"part-{i:04d}.tar.part", p) and ok
        if not ok:
            print(f"::error::SHIP-ABORT at part {i}/{len(parts)}", flush=True)
            sys.exit(1)

    print(f"::notice::SHIP-OK parts={len(parts)} tarball_bytes={len(tgz)} "
          f"tarball_sha256={sha} files={len(manifest)}", flush=True)


if __name__ == "__main__":
    main()
