#!/usr/bin/env python3
"""
Sandbox-side assembler: reassemble the tarball from received parts, verify
the tarball sha256 and every file's sha256/size, extract into OUT_DIR, and
write a manifest TSV.

Usage: python3 scripts/assemble_local.py <recv_dir> <out_dir> <manifest_tsv>
"""

import gzip
import hashlib
import json
import os
import sys
import tarfile
from io import BytesIO


def main():
    if len(sys.argv) != 4:
        print("usage: assemble_local.py <recv_dir> <out_dir> <manifest_tsv>",
              file=sys.stderr)
        sys.exit(2)
    recv, out_dir, manifest_path = sys.argv[1], sys.argv[2], sys.argv[3]

    meta = json.load(open(os.path.join(recv, "meta.json")))
    n = meta["parts"]
    chunks = []
    for i in range(1, n + 1):
        p = os.path.join(recv, f"part-{i:04d}.tar.part")
        if not os.path.isfile(p):
            print(f"missing part {i}/{n}", file=sys.stderr)
            sys.exit(1)
        with open(p, "rb") as fh:
            chunks.append(fh.read())
    tgz = b"".join(chunks)
    if len(tgz) != meta["tarball_bytes"]:
        print(f"tarball size mismatch: {len(tgz)} != {meta['tarball_bytes']}",
              file=sys.stderr)
        sys.exit(1)
    sha = hashlib.sha256(tgz).hexdigest()
    if sha != meta["tarball_sha256"]:
        print(f"tarball sha256 mismatch: got {sha}, want {meta['tarball_sha256']}",
              file=sys.stderr)
        sys.exit(1)
    print(f"tarball ok: {len(tgz)} bytes sha256={sha}")

    raw = gzip.decompress(tgz)
    os.makedirs(out_dir, exist_ok=True)
    tf = tarfile.open(fileobj=BytesIO(raw), mode="r")
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
        with open(p, "rb") as fh:
            data = fh.read()
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
    total = sum(e["size"] for e in meta["files"])
    print(f"VERIFY-OK files={len(meta['files'])} total_bytes={total} tarball_sha256={sha}")


if __name__ == "__main__":
    main()
