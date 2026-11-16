#!/usr/bin/env python3
"""
AXOM Universal Archive Builder
Packages files, directories, and in-memory structures into ZIP, TAR, or TAR.GZ archives.
Provides fast, safe multi-file compression for agent downloads.
"""

import os
import sys
import json
import argparse
import zipfile
import tarfile

def create_archive_from_dir(source_dir, output_path):
    source_dir = os.path.abspath(source_dir)
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    
    count = 0
    if output_path.lower().endswith(".zip"):
        with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for root, _, files in os.walk(source_dir):
                for f in files:
                    full_p = os.path.join(root, f)
                    rel_p = os.path.relpath(full_p, source_dir)
                    zf.write(full_p, rel_p)
                    count += 1
    elif output_path.lower().endswith((".tar.gz", ".tgz")):
        with tarfile.open(output_path, "w:gz") as tf:
            for root, _, files in os.walk(source_dir):
                for f in files:
                    full_p = os.path.join(root, f)
                    rel_p = os.path.relpath(full_p, source_dir)
                    tf.add(full_p, arcname=rel_p)
                    count += 1
    else:
        # Default to zip
        if not output_path.lower().endswith(".tar"):
            output_path += ".zip"
        with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for root, _, files in os.walk(source_dir):
                for f in files:
                    full_p = os.path.join(root, f)
                    rel_p = os.path.relpath(full_p, source_dir)
                    zf.write(full_p, rel_p)
                    count += 1

    return {
        "success": True,
        "path": output_path,
        "bytes": os.path.getsize(output_path),
        "files_count": count
    }

def create_archive_from_entries(entries, output_path):
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    
    count = 0
    is_tar = output_path.lower().endswith((".tar", ".tar.gz", ".tgz"))
    
    if output_path.lower().endswith((".tar.gz", ".tgz")):
        with tarfile.open(output_path, "w:gz") as tf:
            for item in entries:
                rel_path = item.get("path") or item.get("filename") or f"file_{count+1}.txt"
                content = item.get("content", "")
                data = content.encode("utf-8") if isinstance(content, str) else content
                
                import io
                ti = tarfile.TarInfo(name=rel_path)
                ti.size = len(data)
                tf.addfile(ti, io.BytesIO(data))
                count += 1
    else:
        # Standard ZIP (also for .rar requests, stored safely as universal zip container)
        with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for item in entries:
                rel_path = item.get("path") or item.get("filename") or f"file_{count+1}.txt"
                content = item.get("content", "")
                if isinstance(content, str):
                    zf.writestr(rel_path, content.encode("utf-8"))
                else:
                    zf.writestr(rel_path, content)
                count += 1

    return {
        "success": True,
        "path": output_path,
        "bytes": os.path.getsize(output_path),
        "files_count": count
    }

def main():
    parser = argparse.ArgumentParser(description="AXOM Universal Archive Builder")
    parser.add_argument("--output", "-o", required=True, help="Destination archive file (.zip, .tar.gz, etc.)")
    parser.add_argument("--source-dir", "-d", help="Directory to bundle into the archive")
    parser.add_argument("--json", "-j", help="Path to JSON file with list of [{path, content}] or JSON string")

    args = parser.parse_args()

    try:
        if args.source_dir:
            res = create_archive_from_dir(args.source_dir, args.output)
            print(json.dumps(res))
            return

        entries = []
        if args.json:
            if os.path.exists(args.json):
                with open(args.json, "r", encoding="utf-8") as f:
                    entries = json.load(f)
            else:
                entries = json.loads(args.json)
        else:
            # Read from stdin
            stdin_data = sys.stdin.read().strip()
            if stdin_data:
                entries = json.loads(stdin_data)

        if not isinstance(entries, list):
            entries = [entries]

        res = create_archive_from_entries(entries, args.output)
        print(json.dumps(res))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
