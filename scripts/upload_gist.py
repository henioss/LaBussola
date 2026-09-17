#!/usr/bin/env python3
"""
Transfer helper: package the downloaded snapshot (mirror-out/) as a
deterministic gzip tarball, split into base64 chunks, and publish them as a
PUBLIC gist (temporary transport; deleted by a later cleanup run).

Uses the workflow's GITHUB_TOKEN. Stdlib only.

Stdout contract:
  ::notice::GIST-CREATED <gist_id> <url> chunks=N
  or
  ::error::GIST-FAIL <http_code> <body...>
"""

import base64
import gzip
import hashlib
import io
import json
import os
import sys
import tarfile
import urllib.error
import urllib.request

TOKEN = os.environ.get("GITHUB_TOKEN", "")
REPO = os.environ.get("GITHUB_REPOSITORY", "?")
RUN_ID = os.environ.get("GITHUB_RUN_ID", "local")
SRC = "mirror-out"
CHUNK = 350 * 1024  # stays well under the 1MB per-file content limit


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


def main():
    if not TOKEN:
        print("::error::GIST-FAIL no GITHUB_TOKEN")
        sys.exit(1)
    if not os.path.isdir(SRC) or not os.listdir(SRC):
        print("::error::GIST-FAIL mirror-out missing or empty")
        sys.exit(1)

    tgz = gzip.compress(deterministic_tar(SRC), mtime=0)
    sha = hashlib.sha256(tgz).hexdigest()
    b64 = base64.b64encode(tgz).decode()
    parts = [b64[i:i + CHUNK] for i in range(0, len(b64), CHUNK)]

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
        "gist_chunks": len(parts),
        "tarball_sha256": sha,
        "tarball_bytes": len(tgz),
        "files": manifest,
        "repo": REPO,
        "run_id": RUN_ID,
    }

    files = {f"part-{i:04d}.b64": {"content": p}
             for i, p in enumerate(parts, 1)}
    files["_meta.json"] = {"content": json.dumps(meta)}

    body = json.dumps({
        "description": "Temporary transfer: production snapshot of "
                       "labussolaitalia.com (delete after import completes)",
        "public": True,
        "files": files,
    }).encode()

    req = urllib.request.Request(
        "https://api.github.com/gists",
        data=body,
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "mirror-import-transfer",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            g = json.load(r)
    except urllib.error.HTTPError as e:
        print(f"::error::GIST-FAIL {e.code} {e.read().decode('utf-8', 'replace')[:600]}")
        sys.exit(1)
    except Exception as e:  # noqa: BLE001
        print(f"::error::GIST-FAIL EXC {e!r}")
        sys.exit(1)

    print(f"::notice::GIST-CREATED {g['id']} {g['html_url']} "
          f"chunks={len(parts)} files={len(manifest)} "
          f"tarball_sha256={sha} bytes={len(tgz)}")


if __name__ == "__main__":
    main()
