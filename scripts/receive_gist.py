#!/usr/bin/env python3
"""
Receiver: reassemble the snapshot tarball from a transfer gist, verify the
tarball and every file's sha256/size, and extract into OUT_DIR.

Usage: python3 scripts/receive_gist.py <gist_id> <out_dir> <manifest_out_tsv>
"""

import base64
import gzip
import hashlib
import io
import json
import os
import subprocess
import sys
import tarfile


def gh_api(path):
    p = subprocess.run(["gh", "api", path], capture_output=True, text=True)
    if p.returncode != 0:
        print(f"gh api {path} failed: {p.stderr.strip()[:300]}", file=sys.stderr)
        sys.exit(1)
    return json.loads(p.stdout)


def main():
    if len(sys.argv) != 4:
        print("usage: receive_gist.py <gist_id> <out_dir> <manifest_tsv>", file=sys.stderr)
        sys.exit(2)
    gid, out_dir, manifest_path = sys.argv[1], sys.argv[2], sys.argv[3]

    g = gh_api(f"gists/{gid}")
    files = g.get("files", {})
    meta = None
    parts = {}
    for name, info in files.items():
        content = info.get("content")
        if info.get("truncated") or content is None:
            print(f"file {name} is truncated/missing content", file=sys.stderr)
            sys.exit(1)
        if name == "_meta.json":
            meta = json.loads(content)
        elif name.startswith("part-"):
            idx = int(name.split("-")[1].split(".")[0])
            parts[idx] = content.rstrip("\n")
    if meta is None:
        print("no _meta.json in gist", file=sys.stderr)
        sys.exit(1)

    n = meta["gist_chunks"]
    missing = [i for i in range(1, n + 1) if i not in parts]
    if missing:
        print(f"missing parts: {missing}", file=sys.stderr)
        sys.exit(1)

    b64 = "".join(parts[i] for i in range(1, n + 1))
    tgz = base64.b64decode(b64)
    sha = hashlib.sha256(tgz).hexdigest()
    if sha != meta["tarball_sha256"]:
        print(f"tarball sha256 mismatch: got {sha}, want {meta['tarball_sha256']}",
              file=sys.stderr)
        sys.exit(1)
    print(f"tarball ok: {len(tgz)} bytes sha256={sha}")

    raw = gzip.decompress(tgz)
    os.makedirs(out_dir, exist_ok=True)
    tf = tarfile.open(fileobj=io.BytesIO(raw), mode="r")
    for m in tf.getmembers():
        top = m.name.split("/")[0]
        if m.name.startswith("/") or ".." in m.name.split("/") or top.startswith("."):
            print(f"unsafe tar member: {m.name}", file=sys.stderr)
            sys.exit(1)
    tf.extractall(out_dir)

    bad = []
    for entry in meta["files"]:
        p = os.path.join(out_dir, entry["path"])
        if not os.path.isfile(p):
            bad.append(f"{entry['path']}: missing")
            continue
        data = open(p, "rb").read()
        if hashlib.sha256(data).hexdigest() != entry["sha256"]:
            bad.append(f"{entry['path']}: sha256 mismatch")
        if len(data) != entry["size"]:
            bad.append(f"{entry['path']}: size mismatch")
    if bad:
        print(f"VERIFICATION FAILED ({len(bad)}): {bad[:20]}", file=sys.stderr)
        sys.exit(1)

    with open(manifest_path, "w") as f:
        for e in meta["files"]:
            f.write(f"{e['path']}\t{e['sha256']}\t{e['size']}\n")
    print(f"VERIFY-OK files={len(meta['files'])} tarball_sha256={sha}")


if __name__ == "__main__":
    main()
