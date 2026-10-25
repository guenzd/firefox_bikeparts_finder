#!/usr/bin/env python3
"""Validate, test and deterministically package shared Firefox/Chrome sources."""
import argparse
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT / 'teilefinder'
SOURCE = PROJECT / 'src'
MANIFESTS = PROJECT / 'manifests'
OUTPUT = ROOT / 'outputs'
TARGETS = ('firefox', 'chrome')


def referenced_paths(manifest):
    background = manifest.get('background', {})
    refs = list(background.get('scripts', []))
    if background.get('service_worker'):
        refs.append(background['service_worker'])
    refs.extend(name for group in manifest['content_scripts'] for name in group['js'])
    refs.extend(manifest['icons'].values())
    icon = manifest.get('action', manifest.get('browser_action', {})).get('default_icon')
    refs.extend(icon.values() if isinstance(icon, dict) else [icon])
    refs.append('ui/home.html')
    for path in SOURCE.rglob('*'):
        if path.suffix == '.html':
            refs.extend(str((path.parent / ref).relative_to(SOURCE)) for ref in re.findall(r'(?:src|href)="([^"]+)"', path.read_text()) if not re.match(r'(?:https?:|data:|#)', ref))
        elif path.suffix == '.css':
            refs.extend(str((path.parent / ref).relative_to(SOURCE)) for ref in re.findall(r'url\([\'"]?([^\)\'\"]+)', path.read_text()) if not re.match(r'(?:https?:|data:)', ref))
    return refs


def validate(target):
    manifest = json.loads((MANIFESTS / f'{target}.json').read_text())
    if target == 'firefox':
        if manifest['manifest_version'] != 2 or manifest['browser_specific_settings']['gecko']['id'] != 'r2-teilefinder@local.invalid':
            raise RuntimeError('Firefox-Manifest oder feste Add-on-ID ungültig.')
    else:
        if manifest['manifest_version'] != 3 or 'browser_specific_settings' in manifest or 'browser_action' in manifest:
            raise RuntimeError('Chrome benötigt ein eigenes Manifest V3 ohne Gecko-Felder.')
        if manifest['background'] != {'service_worker': 'platform/chrome-worker.js'}:
            raise RuntimeError('Chrome-Hintergrund muss ausschließlich der kleine Plattform-Worker sein.')
        if not manifest.get('host_permissions') or any(p.startswith('https:') for p in manifest['permissions']):
            raise RuntimeError('Chrome Host-Rechte müssen separat angegeben werden.')
    for ref in referenced_paths(manifest):
        path = (SOURCE / ref).resolve()
        if not path.is_relative_to(SOURCE.resolve()) or not path.is_file():
            raise RuntimeError(f'Fehlende/ungültige Erweiterungsdatei ({target}): {ref}')
    if 'core/search-controller.js' in manifest['background'].get('scripts', []):
        raise RuntimeError('Suchjobs gehören in den Erweiterungs-Tab.')
    return manifest


def write_bundle(target, manifest, output=OUTPUT):
    output.mkdir(exist_ok=True, parents=True)
    files = sorted(p for p in SOURCE.rglob('*') if p.is_file() and not any(part.startswith('.') or part == '__pycache__' for part in p.relative_to(SOURCE).parts))
    archive = output / f'teilefinder-{target}.zip'
    temporary = archive.with_suffix('.zip.tmp')
    with zipfile.ZipFile(temporary, 'w', compression=zipfile.ZIP_DEFLATED) as bundle:
        entries = [('manifest.json', (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode())]
        entries += [(path.relative_to(SOURCE).as_posix(), path.read_bytes()) for path in files]
        for name, contents in sorted(entries):
            entry = zipfile.ZipInfo(name, (2020, 1, 1, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.external_attr = 0o100644 << 16
            bundle.writestr(entry, contents)
    temporary.replace(archive)
    versioned = output / f'teilefinder-{target}-{manifest["version"]}.zip'
    shutil.copyfile(archive, versioned)
    unpacked = output / f'{target}-addon'
    unpacked.mkdir(exist_ok=True)
    source_names = {p.relative_to(SOURCE) for p in files} | {Path('manifest.json')}
    for old in unpacked.rglob('*'):
        if old.is_file() and old.relative_to(unpacked) not in source_names:
            old.unlink()
    for path in files:
        dest = unpacked / path.relative_to(SOURCE)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, dest)
    (unpacked / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    # Remove only versioned browser bundles, after this target is fully built.
    versioned_name = re.compile(r'teilefinder-' + re.escape(target) + r'-\d+(?:\.\d+){0,3}\.zip')
    for old in output.iterdir():
        if old.is_file() and old.name != versioned.name and versioned_name.fullmatch(old.name):
            old.unlink()
    print(f'{target} {manifest["version"]}: {versioned}\nEntpackt: {unpacked}')
    return archive


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--test-only', action='store_true')
    parser.add_argument('--validate-only', action='store_true')
    parser.add_argument('--browser', choices=(*TARGETS, 'all'), default='all')
    args = parser.parse_args()
    targets = TARGETS if args.browser == 'all' else (args.browser,)
    manifests = {target: validate(target) for target in targets}
    if len({manifest['version'] for manifest in manifests.values()}) != 1:
        raise RuntimeError('Die Browser-Builds müssen dieselbe Version verwenden.')
    if args.validate_only:
        return
    if not shutil.which('node'):
        raise RuntimeError('Node.js fehlt.')
    for path in sorted(SOURCE.rglob('*.js')):
        subprocess.run(['node', '--check', str(path)], check=True)
    tests = sorted(PROJECT.glob('*.test.mjs')) + [PROJECT / 'local-browser/extract.test.mjs']
    subprocess.run(['node', '--test', *map(str, tests)], cwd=PROJECT, check=True)
    if not args.test_only:
        for target, manifest in manifests.items():
            write_bundle(target, manifest)


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, KeyError, RuntimeError, subprocess.CalledProcessError) as error:
        print(f'Build fehlgeschlagen: {error}', file=sys.stderr)
        sys.exit(1)
