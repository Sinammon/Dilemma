"""Refresh official public reference data; never download or save user listings."""
import csv
import hashlib
import io
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen

CATALOG = 'https://open.canada.ca/data/api/action/package_show?id=98f1a129-f628-4ce4-b24d-6f16bf24dd64'
OUTPUT = Path(__file__).resolve().parents[1] / 'public' / 'data' / 'fuel'
COLUMNS = ['year', 'make', 'model', 'vehicleClass', 'displacement', 'cylinders', 'transmission', 'fuel', 'city', 'highway', 'combined']

def refresh():
    catalog = json.load(urlopen(CATALOG, timeout=30))['result']
    resources = [r for r in catalog['resources'] if r.get('format') == 'CSV' and r.get('language') == ['en'] and
                 (r['name'].startswith(('2026 Fuel', '2025 Fuel', '2015-2024 Fuel', '1995-2014 Fuel')))]
    if len(resources) != 4:
        raise RuntimeError('Official resource structure changed; review before updating.')
    years, sources = {}, []
    for resource in resources:
        raw = urlopen(resource['url'], timeout=45).read()
        try:
            text = raw.decode('utf-8-sig')
        except UnicodeDecodeError:
            text = raw.decode('cp1252')
        reader = csv.DictReader(io.StringIO(text))
        required = ['Model year', 'Make', 'Model', 'Vehicle class', 'Engine size (L)', 'Cylinders', 'Transmission', 'Fuel type', 'City (L/100 km)', 'Highway (L/100 km)', 'Combined (L/100 km)']
        if not set(required).issubset(reader.fieldnames):
            raise RuntimeError('Official CSV columns changed; no files written.')
        source_index = len(sources)
        sources.append({'name': resource['name'], 'url': resource['url'], 'sha256': hashlib.sha256(raw).hexdigest()})
        for row in reader:
            if not row['Model year'].isdigit():
                continue
            try:
                values = [int(row['Model year']), row['Make'], row['Model'], row['Vehicle class'], float(row['Engine size (L)']), int(row['Cylinders']), row['Transmission'], row['Fuel type'], float(row['City (L/100 km)']), float(row['Highway (L/100 km)']), float(row['Combined (L/100 km)'])]
            except ValueError:
                continue
            if values[-1] > 0:
                years.setdefault(values[0], []).append(values + [source_index])
    OUTPUT.mkdir(parents=True, exist_ok=True)
    manifest = {'publisher': 'Natural Resources Canada', 'dataset': 'https://open.canada.ca/data/en/dataset/98f1a129-f628-4ce4-b24d-6f16bf24dd64', 'licence': 'https://open.canada.ca/en/open-government-licence-canada', 'retrieved': datetime.now(timezone.utc).isoformat(), 'columns': COLUMNS + ['sourceIndex'], 'sources': sources, 'years': sorted(years), 'note': '1995–2014 values are adjusted 5-cycle estimates. Conventional and non-plug-in hybrid vehicles only. Modified reference data; not endorsed by the Government of Canada.'}
    for year, rows in years.items():
        (OUTPUT / f'{year}.json').write_text(json.dumps({'columns': manifest['columns'], 'rows': rows}, separators=(',', ':')), encoding='utf-8')
    (OUTPUT / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(f'Prepared {sum(map(len, years.values()))} official reference rows in {len(years)} year files.')

if __name__ == '__main__':
    refresh()
