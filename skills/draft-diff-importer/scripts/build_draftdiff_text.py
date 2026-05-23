#!/usr/bin/env python3
"""Build a Draft Diff Editor companion text file from a JSON section plan."""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any


SEPARATOR = "\n\n---\n\n"
INTERNAL_SEPARATOR_RE = re.compile(r"\n{2}[ \t]*---[ \t]*\n{2}")


def now_stamp() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def normalize_newlines(value: Any) -> str:
    return str(value or "").replace("\r\n", "\n").replace("\r", "\n")


def read_json(path_text: str) -> dict[str, Any]:
    if path_text == "-":
        raw = sys.stdin.read()
    else:
        raw = Path(path_text).read_text(encoding="utf-8-sig")

    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError("Top-level JSON must be an object.")
    return data


def page_content(value: Any) -> str:
    if isinstance(value, dict):
        return normalize_newlines(value.get("content", ""))
    return normalize_newlines(value)


def page_created_at(value: Any, fallback: str) -> str:
    if isinstance(value, dict):
        created_at = str(value.get("created_at") or "").strip()
        if created_at:
            return created_at
    return fallback


def reject_internal_separator(title: str, content: str) -> None:
    padded = f"\n{content}\n"
    if INTERNAL_SEPARATOR_RE.search(padded):
        raise ValueError(
            f"{title!r} contains a blank-line '---' separator. "
            "Change that internal marker before building the import file."
        )


def page_block(title: str, created_at: str, content: str) -> str:
    body = normalize_newlines(content).rstrip()
    reject_internal_separator(title, body)
    return "\n".join([
        f"Created: {created_at}",
        title,
        "",
        body or "[No text yet]",
    ])


def build_text(data: dict[str, Any], default_created_at: str) -> str:
    created_at = str(data.get("created_at") or default_created_at).strip() or default_created_at
    project_notes = data.get("project_notes", "")
    project_created_at = page_created_at(project_notes, created_at)
    pages = [
        page_block("Project notes", project_created_at, page_content(project_notes)),
    ]

    drafts = data.get("drafts")
    if not isinstance(drafts, list) or not drafts:
        raise ValueError("JSON must contain a non-empty 'drafts' array.")

    for index, draft in enumerate(drafts, start=1):
        if not isinstance(draft, dict):
            raise ValueError(f"Draft {index} must be an object.")

        title = str(draft.get("title") or f"Draft {index}").strip() or f"Draft {index}"
        content = page_content(draft.get("content", ""))
        draft_created_at = str(draft.get("created_at") or created_at).strip() or created_at
        notes_created_at = str(
            draft.get("notes_created_at") or draft.get("created_at") or created_at
        ).strip() or created_at
        notes = page_content(draft.get("notes", ""))

        pages.append(page_block(title, draft_created_at, content))
        pages.append(page_block(f"{title} Notes", notes_created_at, notes))

    return f"{SEPARATOR.join(pages)}\n"


def write_output(path_text: str, content: str, force: bool) -> None:
    if path_text == "-":
        sys.stdout.write(content)
        return

    output_path = Path(path_text)
    if output_path.exists() and not force:
        raise FileExistsError(f"{output_path} already exists. Use --force to overwrite it.")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(content, encoding="utf-8", newline="\n")
    print(f"Wrote {output_path}", file=sys.stderr)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build a Draft Diff Editor companion text file from sections JSON."
    )
    parser.add_argument("json_input", help="Path to sections.json, or '-' for stdin.")
    parser.add_argument("output", help="Output .txt path, or '-' for stdout.")
    parser.add_argument(
        "--created-at",
        default=now_stamp(),
        help="Fallback Created timestamp for pages without one.",
    )
    parser.add_argument("--force", action="store_true", help="Overwrite the output file if it exists.")
    args = parser.parse_args()

    data = read_json(args.json_input)
    text = build_text(data, args.created_at)
    write_output(args.output, text, args.force)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        raise SystemExit(1)
