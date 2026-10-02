#!/usr/bin/env python3
"""Validate and package the Firefox extension; no Python/npm dependencies."""
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT / 'teilefinder'
SOURCE = PROJECT / 'firefox-r2'
OUTPUT = ROOT / 'outputs'

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--test-only', action='store_true', help='Only validate and run tests')
    args = parser.parse_args()
    if not shutil.which('node'):
        raise RuntimeError('Node.js fehlt. Node.js installieren und erneut starten.')
    manifest = json.loads((SOURCE / 'manifest.json').read_text())
    if manifest['browser_specific_settings']['gecko']['id'] != 'r2-teilefinder@local.invalid':
        raise RuntimeError('Die feste Add-on-ID darf für Updates nicht verändert werden.')
    referenced = manifest['background']['scripts'] + [f for group in manifest['content_scripts'] for f in group['js']]
    for name in referenced + ['home.html', 'home.css', 'home.js', 'wishlist-file.js']:
        if not (SOURCE / name).is_file():
            raise RuntimeError(f'Fehlende Erweiterungsdatei: {name}')
    for path in sorted(SOURCE.glob('*.js')):
        subprocess.run(['node', '--check', str(path)], check=True)
    tests = sorted(PROJECT.glob('*.test.mjs')) + [PROJECT / 'local-browser/extract.test.mjs']
    subprocess.run(['node', '--test', *map(str, tests)], cwd=PROJECT, check=True)
    if args.test_only:
        return
    OUTPUT.mkdir(exist_ok=True)
    files = sorted(p for p in SOURCE.rglob('*') if p.is_file() and not p.name.startswith('.') and '__pycache__' not in p.parts)
    # Fixed timestamps and order keep builds reproducible.
    archive = OUTPUT / 'teilefinder-firefox.zip'
    temporary = archive.with_suffix('.zip.tmp')
    with zipfile.ZipFile(temporary, 'w', compression=zipfile.ZIP_DEFLATED) as bundle:
        for path in files:
            entry = zipfile.ZipInfo(path.relative_to(SOURCE).as_posix(), (2020, 1, 1, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.external_attr = 0o100644 << 16
            bundle.writestr(entry, path.read_bytes())
    temporary.replace(archive)
    versioned = OUTPUT / f'teilefinder-firefox-{manifest["version"]}.zip'
    shutil.copyfile(archive, versioned)
    # Keep this directory stable for Firefox's temporary add-on reload action.
    unpacked = OUTPUT / 'firefox-addon'
    unpacked.mkdir(exist_ok=True)
    for path in files:
        target = unpacked / path.relative_to(SOURCE)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, target)
    print(f'\nBuild {manifest["version"]}: {archive}\nVersioniertes ZIP: {versioned}\nZum Laden/Neuladen: {unpacked / "manifest.json"}')

if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, KeyError, RuntimeError, subprocess.CalledProcessError) as error:
        print(f'Build fehlgeschlagen: {error}', file=sys.stderr)
        sys.exit(1)
