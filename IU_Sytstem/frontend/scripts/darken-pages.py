"""
Adds dark: variants to common Tailwind utilities in page files.

Safe to run repeatedly — it skips tokens that already have a dark:
variant on the same line.

Usage:
    python3 frontend/scripts/darken-pages.py
"""

import re
from pathlib import Path


# (find, dark-variant-to-append)
PATTERNS = [
    # Surfaces
    ('bg-white',         'dark:bg-slate-900'),
    ('bg-slate-50',      'dark:bg-slate-800/50'),
    ('bg-slate-100',     'dark:bg-slate-800'),
    ('bg-brand-50',      'dark:bg-brand-500/20'),

    # Borders
    ('border-slate-200', 'dark:border-slate-700'),
    ('border-slate-100', 'dark:border-slate-800'),

    # Dividers
    ('divide-slate-100', 'dark:divide-slate-800'),

    # Text hierarchy
    ('text-slate-900',   'dark:text-slate-100'),
    ('text-slate-800',   'dark:text-slate-100'),
    ('text-slate-700',   'dark:text-slate-300'),
    ('text-slate-600',   'dark:text-slate-300'),
    ('text-slate-500',   'dark:text-slate-400'),
    ('text-slate-400',   'dark:text-slate-500'),

    # Hover backgrounds
    ('hover:bg-slate-50',  'dark:hover:bg-slate-800'),
    ('hover:bg-slate-100', 'dark:hover:bg-slate-800'),
]


def darken_line(line: str) -> tuple[str, int]:
    """
    For each pattern, insert the dark: variant directly after the token
    if it isn't already present on the same line.
    """
    additions = 0
    for find, add in PATTERNS:
        if add in line:
            # Already has a dark variant of this token — skip
            continue

        # Negative lookbehind: don't match after ':' or '-'
        #   so 'dark:bg-white' and 'hover:bg-white' don't match 'bg-white'
        # Negative lookahead: don't match a longer token
        #   so 'text-slate-800' isn't matched inside 'text-slate-8000'
        pattern = re.compile(
            r'(?<![:\w-])' + re.escape(find) + r'(?![\w-])'
        )

        new_line, count = pattern.subn(
            lambda m: f'{m.group(0)} {add}', line
        )
        if count:
            line = new_line
            additions += count

    return line, additions


def process_file(path: Path) -> int:
    original = path.read_text()
    lines = original.split('\n')
    total = 0

    for i, line in enumerate(lines):
        new_line, count = darken_line(line)
        if count:
            lines[i] = new_line
            total += count

    if total:
        path.write_text('\n'.join(lines))
    return total


def main():
    root = Path('frontend/src/pages')
    if not root.exists():
        print(f'Error: {root} not found. Run from project root.')
        return

    grand_total = 0
    files_touched = 0

    for path in sorted(root.rglob('*.tsx')):
        count = process_file(path)
        if count:
            rel = path.relative_to('.')
            print(f'  {rel}: {count} replacements')
            files_touched += 1
            grand_total += count

    print()
    print(f'Touched {files_touched} files, made {grand_total} replacements.')


if __name__ == '__main__':
    main()