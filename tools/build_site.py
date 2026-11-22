#!/usr/bin/env python3
"""Build the static site data and pages into site/.

Reads controls/, indicators/, typologies/ (YAML) and writes:
  site/data/index.json              lightweight index (all three catalogues)
  site/data/typologies/<ID>.json    full typology detail
  site/data/indicators/<ID>.json    per-indicator links with typology context
  site/data/controls/<ID>.json      per-control reverse links
  site/*.html                       pages assembled from tools/site_src/ (layout + page bodies)
Needs only pyyaml.  Usage: python3 tools/build_site.py [repo_root]
"""
import glob, json, os, re, shutil, sys
from collections import defaultdict
import yaml

ROOT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
SITE = os.path.join(ROOT, 'site')
SRC = os.path.join(ROOT, 'tools', 'site_src')

DOMAINS = [
    ('money_laundering', 'Money laundering'), ('terrorist_financing', 'Terrorist financing'),
    ('proliferation_financing', 'Proliferation financing'), ('sanctions', 'Sanctions evasion'),
    ('fraud', 'Fraud'), ('bribery_corruption', 'Bribery and corruption'), ('tax_evasion', 'Tax evasion'),
    ('human_trafficking_modern_slavery', 'Human trafficking and modern slavery'),
    ('environmental_crime', 'Environmental crime'), ('cyber_enabled', 'Cyber-enabled crime'),
    ('other_predicate', 'Other predicate offences'), ('cross_cutting', 'Cross-cutting'),
]


def norm(s):
    return ' '.join(str(s or '').split())


def load(pattern, key):
    out = {}
    for f in sorted(glob.glob(os.path.join(ROOT, pattern))):
        doc = yaml.safe_load(open(f, encoding='utf-8'))
        items = doc[key] if key in doc else [doc]
        for it in (items if isinstance(items, list) else [items]):
            out[it['id']] = it
    return out


def parse_source(raw):
    raw = norm(raw)
    tag = ''
    m = re.search(r'\[([^\]]+)\]\s*$', raw)
    if m:
        tag = m.group(1).strip()
        raw = raw[:m.start()].strip()
    url = ''
    m = re.search(r'<(https?://[^>\s]+)>', raw)
    if m:
        url = m.group(1)
        raw = (raw[:m.start()] + raw[m.end():]).strip()
    return {'text': raw, 'url': url, 'tag': tag or 'untagged'}


def dump(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, separators=(',', ':'), ensure_ascii=False, sort_keys=False)


def main():
    ctl = load('controls/*.yaml', 'controls')
    ind = load('indicators/*.yaml', 'indicators')
    typ = {}
    for f in sorted(glob.glob(os.path.join(ROOT, 'typologies', '*', '*.yaml'))):
        t = yaml.safe_load(open(f, encoding='utf-8'))['typology']
        typ[t['id']] = t

    # reverse maps
    ind_typs = defaultdict(list)           # ind -> [typ ids]
    ctl_typs = defaultdict(set)            # ctl -> typ ids
    ctl_inds = defaultdict(set)            # ctl -> ind ids
    ind_ctls = defaultdict(set)
    ctl_links = defaultdict(lambda: defaultdict(list))   # ctl -> typ -> [ind]
    ind_links = defaultdict(list)
    typ_ctls = {}
    problems = []
    for tid, t in typ.items():
        cs = set()
        for l in t.get('indicators', []):
            r = l['ref']
            if r not in ind:
                problems.append('%s links unknown indicator %s' % (tid, r)); continue
            ind_typs[r].append(tid)
            for c in l.get('controls', []):
                if c not in ctl:
                    problems.append('%s/%s links unknown control %s' % (tid, r, c)); continue
                cs.add(c); ctl_typs[c].add(tid); ctl_inds[c].add(r); ind_ctls[r].add(c)
                ctl_links[c][tid].append(r)
        typ_ctls[tid] = sorted(cs)

    # ---- index
    index = {
        'version': '0.1',
        'counts': {'typologies': len(typ), 'indicators': len(ind), 'controls': len(ctl)},
        'domains': [{'id': d, 'label': l} for d, l in DOMAINS if any(t['domain'] == d for t in typ.values())],
        'typologies': [], 'indicators': [], 'controls': [],
    }
    known = {d for d, _ in DOMAINS}
    for t in typ.values():
        if t['domain'] not in known:
            index['domains'].append({'id': t['domain'], 'label': t['domain'].replace('_', ' ').capitalize()}); known.add(t['domain'])
    for tid, t in sorted(typ.items(), key=lambda kv: ([d for d, _ in DOMAINS].index(kv[1]['domain']) if kv[1]['domain'] in [d for d, _ in DOMAINS] else 99, kv[1]['name'])):
        index['typologies'].append({
            'id': tid, 'name': norm(t['name']), 'domain': t['domain'], 'sectors': t.get('sectors', []),
            'stage': t.get('stage', []), 'desc': norm(t.get('description')),
            'nInd': len(t.get('indicators', [])), 'nCtl': len(typ_ctls[tid]),
            'inds': [l['ref'] for l in t.get('indicators', [])], 'ctls': typ_ctls[tid]})
    for iid, i in ind.items():
        index['indicators'].append({
            'id': iid, 'name': norm(i['name']), 'cat': i.get('category', ''), 'sev': i.get('severity', ''),
            'desc': norm(i.get('description')), 'used': len(set(ind_typs[iid])),
            'typs': sorted(set(ind_typs[iid])), 'ctls': sorted(ind_ctls[iid])})
    for cid, c in ctl.items():
        index['controls'].append({
            'id': cid, 'name': norm(c['name']), 'family': c.get('family', ''), 'type': c.get('type', ''),
            'impl': c.get('implementation', ''), 'eff': c.get('effectiveness', ''), 'desc': norm(c.get('description')),
            'aka': [norm(a) for a in c.get('also_known_as', [])],
            'nTyp': len(ctl_typs[cid]), 'nInd': len(ctl_inds[cid]),
            'typs': sorted(ctl_typs[cid]), 'inds': sorted(ctl_inds[cid])})

    # ---- details
    for d in ('typologies', 'indicators', 'controls'):
        shutil.rmtree(os.path.join(SITE, 'data', d), ignore_errors=True)
    for tid, t in typ.items():
        links = []
        for l in t.get('indicators', []):
            c = ind.get(l['ref'])
            if not c: continue
            links.append({
                'ref': l['ref'], 'legacy': l.get('legacy_id', ''), 'name': norm(l.get('name_in_typology') or c['name']),
                'canon': norm(c['name']), 'cat': c.get('category', ''),
                'sev': l.get('severity_in_typology') or c.get('severity', ''), 'canonSev': c.get('severity', ''),
                'desc': norm(c.get('description')), 'ctx': norm(l.get('context')),
                'fp': norm(l.get('false_positive_context') or c.get('false_positive_notes')),
                'det': c.get('detection_type', []), 'data': c.get('data_sources', []),
                'used': len(set(ind_typs[l['ref']])), 'controls': l.get('controls', []),
                'refs': [norm(r) for r in l.get('references', [])]})
        dump(os.path.join(SITE, 'data', 'typologies', tid + '.json'), {
            'id': tid, 'name': norm(t['name']), 'domain': t['domain'], 'description': norm(t.get('description')),
            'stage': t.get('stage', []), 'sectors': t.get('sectors', []),
            'sources': [parse_source(s) for s in t.get('sources', [])],
            'indicators': links, 'controls': typ_ctls[tid]})
    for iid, i in ind.items():
        ls = []
        for tid in dict.fromkeys(ind_typs[iid]):
            for l in typ[tid]['indicators']:
                if l['ref'] == iid:
                    ls.append({'typ': tid, 'name': norm(l.get('name_in_typology') or i['name']),
                               'sev': l.get('severity_in_typology') or i.get('severity', ''),
                               'ctx': norm(l.get('context')), 'controls': l.get('controls', [])})
        dump(os.path.join(SITE, 'data', 'indicators', iid + '.json'), {
            'id': iid, 'name': norm(i['name']), 'description': norm(i.get('description')),
            'cat': i.get('category', ''), 'sev': i.get('severity', ''), 'det': i.get('detection_type', []),
            'data': i.get('data_sources', []), 'fp': norm(i.get('false_positive_notes')), 'links': ls})
    for cid, c in ctl.items():
        dump(os.path.join(SITE, 'data', 'controls', cid + '.json'), {
            'id': cid, 'links': [{'typ': t, 'inds': sorted(set(v))} for t, v in sorted(ctl_links[cid].items())]})
    dump(os.path.join(SITE, 'data', 'index.json'), index)

    # ---- pages
    layout = open(os.path.join(SRC, 'layout.html'), encoding='utf-8').read()
    subs = {'{{N_TYP}}': str(len(typ)), '{{N_IND}}': str(len(ind)), '{{N_CTL}}': str(len(ctl)),
            '{{N_FAM}}': str(len({c.get('family') for c in ctl.values()}))}
    npages = 0
    for f in sorted(glob.glob(os.path.join(SRC, 'pages', '*.html'))):
        raw = open(f, encoding='utf-8').read()
        meta = {}
        m = re.match(r'<!--\s*(.*?)\s*-->\s*', raw, re.S)
        for line in m.group(1).splitlines():
            k, _, v = line.partition(':'); meta[k.strip()] = v.strip()
        body = raw[m.end():]
        name = os.path.basename(f)[:-5]
        page = layout
        for k, v in {'{{TITLE}}': meta['title'], '{{DESC}}': meta['description'], '{{NAV}}': meta.get('nav', ''),
                     '{{PAGE}}': name, '{{SCRIPT}}': meta.get('script', ''), '{{BODYCLASS}}': meta.get('class', ''),
                     '{{PATH}}': '' if name == 'index' else name, '{{BODY}}': body}.items():
            page = page.replace(k, v)
        for k, v in subs.items():
            page = page.replace(k, v)
        open(os.path.join(SITE, name + '.html'), 'w', encoding='utf-8').write(page); npages += 1

    # ---- report
    tot = sum(os.path.getsize(os.path.join(dp, fn)) for dp, _, fs in os.walk(SITE) for fn in fs)
    nfiles = sum(len(fs) for _, _, fs in os.walk(os.path.join(SITE, 'data')))
    print('typologies %d, indicators %d, controls %d' % (len(typ), len(ind), len(ctl)))
    print('index.json %d bytes; %d data files; %d pages; site total %.1f KB' % (
        os.path.getsize(os.path.join(SITE, 'data', 'index.json')), nfiles, npages, tot / 1024))
    for p in problems:
        print('WARNING:', p)
    if problems: sys.exit(1)


if __name__ == '__main__':
    main()
