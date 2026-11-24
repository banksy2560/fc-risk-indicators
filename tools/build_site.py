#!/usr/bin/env python3
"""Build the static site (data, versioned assets, pages) into site/.

Reads controls/, indicators/, typologies/, vocab.yaml and questionnaire/questions_v2.yaml and writes:
  site/data/search.json        compact text for the Linkage search (id, name, description; key terms for typologies), fetched lazily
  site/data/index.json         small index for search, the typology picker, reverse views and the product mapper
                               (typologies + exposure, indicator and control names, every typology->indicator->control link)
  site/data/t/<ID>.json        linkage for one typology (nodes, per-link controls, contexts, sources)
  site/data/i/<ID>.json        canonical indicator detail (loaded only for the reverse-view drawer)
  site/data/c/<ID>.json        canonical control detail (same)
  site/data/questionnaire.json questions, options and example profiles, validated against vocab.yaml
  site/assets/<name>.<hash>.<ext>  content-hashed copies of tools/site_src/assets/*
  site/*.html                  pages assembled from tools/site_src/layout.html + pages/*.html
Needs only pyyaml. Usage: python3 tools/build_site.py [repo_root]
The questionnaire is built from questionnaire/questions_v2.yaml (consumer-bank scope); the old v1 file is ignored.
The build exits non-zero on any unresolved link or any tag value that is not in vocab.yaml.
"""
import glob, hashlib, json, os, re, shutil, sys
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
DIMS = [('channels', 'ch', 'Channels'), ('payment_rails', 'rl', 'Payment rails'),
        ('customer_segments', 'sg', 'Customer segments'), ('products', 'pr', 'Products')]
OVERRIDE = {
    'atm': 'ATM', 'api_open_banking': 'API / open banking', 'wire_swift': 'Wire transfer (SWIFT)',
    'crypto_onramp_offramp': 'Crypto on/off-ramp', 'informal_value_transfer': 'Informal value transfer (hawala)',
    'direct_debit_batch': 'Direct debit and batch', 'payroll_expense': 'Payroll, petty cash and expenses',
    'insurance_premium_claim': 'Insurance premium or claim', 'securities_settlement': 'Securities settlement',
    'cross_border_remittance': 'Cross-border remittance', 'stored_value_wallet': 'Stored-value wallet',
    'trade_instruments': 'Trade instruments', 'fast_payments': 'Fast payments',
    'face_to_face_professional': 'Face-to-face professional', 'digital_onboarding': 'Digital (remote) onboarding',
    'online_platform': 'Online platform', 'remote_contact': 'Remote contact (email, phone, SMS)',
    'broker_intermediary': 'Broker or intermediary', 'merchant_acquiring': 'Merchant acquiring', 'call_centre': 'Call centre',
    'sme': 'SME', 'pep_related': 'PEP-related', 'msb_remitter': 'MSB / remitter', 'fintech_psp': 'Fintech / payment service provider',
    'regulated_nonbank_dnfbp': 'Regulated non-bank / DNFBP', 'designated_person': 'Designated or sanctioned person',
    'vulnerable_elderly': 'Vulnerable or elderly', 'student_youth': 'Student or youth', 'new_to_bank': 'New to bank',
    'cash_intensive_business': 'Cash-intensive business', 'non_resident': 'Non-resident', 'employee_internal': 'Employee or internal',
    'professional_intermediary': 'Professional intermediary', 'private_wealth': 'Private wealth', 'public_sector': 'Public sector',
    'loan_mortgage': 'Loan or mortgage', 'investment_securities': 'Investments and securities', 'insurance_pension': 'Insurance and pensions',
    'prepaid_stored_value': 'Prepaid and stored value', 'safe_deposit_custody': 'Safe deposit and custody',
    'correspondent_account': 'Correspondent account', 'crypto_custody': 'Crypto custody', 'onchain_defi': 'On-chain and DeFi',
    'real_assets': 'Real assets (property, art, vessels, commodities)', 'company_formation_services': 'Company formation services',
    'transaction_account': 'Transaction account', 'savings_deposit': 'Savings and deposits', 'credit_card': 'Credit card',
    'trade_finance': 'Trade finance', 'merchant_services': 'Merchant services', 'card': 'Card', 'cash': 'Cash', 'cheque': 'Cheque',
}


def nice(k):
    if k in OVERRIDE:
        return OVERRIDE[k]
    s = str(k).replace('_', ' ')
    return s[:1].upper() + s[1:]


def norm(s):
    return ' '.join(str(s or '').split())


def load(pattern, key):
    out = {}
    for f in sorted(glob.glob(os.path.join(ROOT, pattern))):
        doc = yaml.safe_load(open(f, encoding='utf-8'))
        for it in doc[key]:
            out[it['id']] = it
    return out


def parse_source(raw):
    raw = norm(raw)
    tag = ''
    m = re.search(r'\[([^\]]+)\]\s*$', raw)
    if m:
        tag, raw = m.group(1).strip(), raw[:m.start()].strip()
    url = ''
    m = re.search(r'<(https?://[^>\s]+)>', raw)
    if m:
        url = m.group(1)
        raw = (raw[:m.start()] + raw[m.end():]).strip()
    return {'t': raw, 'u': url, 'g': tag or 'untagged'}


def dump(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, separators=(',', ':'), ensure_ascii=False)


def hash8(data):
    return hashlib.sha1(data if isinstance(data, bytes) else data.encode('utf-8')).hexdigest()[:8]


STOP = set('a an and are as at be by for from has have in into is it its of on or that the their them they this to was were with which who when while than then also not no may can more most other such via per use used using up out over under after before between within across through all any each both one two our your you we if but so these those there here being been'.split())


def key_terms(t, extra_text, name):
    """Distinctive words and word pairs from a typology's per-link contexts that its description does not already use."""
    seen = set(re.findall(r'[a-z]{3,}', (name + ' ' + norm(t.get('description')) + ' ' + extra_text).lower()))
    words, pairs = defaultdict(int), defaultdict(int)
    for l in t.get('indicators', []):
        toks = re.findall(r'[a-z][a-z-]{2,}', norm(l.get('context')).lower())
        for a in toks:
            if a not in STOP and a not in seen:
                words[a] += 1
        for a, b in zip(toks, toks[1:]):
            if a not in STOP and b not in STOP:
                pairs[a + ' ' + b] += 1
    top = lambda d, n, m: [k for k, v in sorted(d.items(), key=lambda kv: (-kv[1], kv[0])) if v >= m][:n]
    return ' '.join(top(pairs, 10, 2) + top(words, 18, 2))


def build_search(typ, ind, ctl):
    """Compact search corpus: [id, name, description(, key terms)] per typology, indicator and control. No per-link text."""
    T = []
    for k, t in typ.items():
        e = t.get('exposure') or {}
        rats = []
        for r in (norm(e.get('rationale')), norm((e.get('consumer') or {}).get('rationale'))):
            if r and r not in rats:
                rats.append(r)
        T.append([k, norm(t['name']), norm(t.get('description')) + (' ' + ' '.join(rats) if rats else ''),
                  key_terms(t, ' '.join(rats), t['name'])])
    return {'T': T, 'I': [[k, norm(v['name']), norm(v.get('description'))] for k, v in ind.items()],
            'C': [[k, norm(v['name']), norm(v.get('description'))] for k, v in ctl.items()]}


def build_questionnaire(vocab, problems):
    """questionnaire/questions_v2.yaml (consumer-bank scope). Every tag value is validated against vocab.yaml."""
    path = os.path.join(ROOT, 'questionnaire', 'questions_v2.yaml')
    if not os.path.exists(path):
        problems.append('questionnaire/questions_v2.yaml not found')
        return {}
    q = yaml.safe_load(open(path, encoding='utf-8')) or {}
    scope = vocab.get('consumer_scope') or {}
    cprod = [p['id'] for p in scope.get('products', [])]
    cchan = [c['id'] for c in scope.get('channels', [])]
    sections = q.get('sections') or []
    sec_ids = {s['id'] for s in sections}
    questions, opt_ids, opt_q = [], set(), {}
    for qu in q.get('questions') or []:
        qid = qu.get('id')
        where = 'question %s' % qid
        if qu.get('section') not in sec_ids:
            problems.append('%s: unknown section %r' % (where, qu.get('section')))
        if qu.get('type') not in ('single', 'multi'):
            problems.append('%s: type must be single or multi' % where)
        ap = list(qu.get('applies_to_products') or [])
        ac = list(qu.get('applies_to_channels') or [])
        for v in ap:
            if v not in cprod:
                problems.append('%s: applies_to_products %r not in vocab consumer_scope' % (where, v))
        for v in ac:
            if v not in cchan:
                problems.append('%s: applies_to_channels %r not in vocab consumer_scope' % (where, v))
        opts = []
        for o in qu.get('options') or []:
            if o['id'] in opt_ids:
                problems.append('duplicate option id %s' % o['id'])
            opt_ids.add(o['id']); opt_q[o['id']] = qid
            maps = o.get('maps_to') or {}
            allowed = ['products'] if qid == 'Q01' else ['channels'] if qid == 'Q02' else ['payment_rails', 'customer_segments']
            m = {}
            for k in maps:
                if k not in allowed:
                    problems.append('%s: question %s may not map to %r' % (o['id'], qid, k))
            for k, s, _ in DIMS:
                vals = list(maps.get(k) or [])
                for v in vals:
                    if v not in vocab.get(k, []):
                        problems.append('%s: %s value %r not in vocab.yaml' % (o['id'], k, v))
                    if k == 'products' and v not in cprod:
                        problems.append('%s: product %r is not a consumer_scope product' % (o['id'], v))
                    if k == 'channels' and v not in cchan:
                        problems.append('%s: channel %r is not a consumer_scope channel' % (o['id'], v))
                if vals:
                    m[s] = vals
            opts.append({'id': o['id'], 'l': norm(o.get('label')), 'm': m, 'n': norm(o.get('note'))})
        questions.append({'id': qid, 's': qu.get('section'), 't': norm(qu.get('text')), 'h': norm(qu.get('help')),
                          'ty': qu.get('type'), 'o': opts, 'ap': ap, 'ac': ac})
    profiles = []
    for p in q.get('profiles') or []:
        ids = list(p.get('answers') or [])
        for a in ids:
            if a not in opt_ids:
                problems.append('profile %s: unknown option %s' % (p.get('id'), a))
        if p.get('product') not in cprod:
            problems.append('profile %s: product %r not in consumer_scope' % (p.get('id'), p.get('product')))
        for c in p.get('channels') or []:
            if c not in cchan:
                problems.append('profile %s: channel %r not in consumer_scope' % (p.get('id'), c))
        per_q = defaultdict(int)
        for a in ids:
            per_q[opt_q.get(a)] += 1
        for qu in questions:
            if qu['ty'] == 'single' and per_q.get(qu['id'], 0) > 1:
                problems.append('profile %s selects several options of single question %s' % (p.get('id'), qu['id']))
        profiles.append({'id': str(p.get('id')), 'n': norm(p.get('name') or p.get('id')), 'd': norm(p.get('description')),
                         'p': p.get('product'), 'ch': list(p.get('channels') or []), 'a': ids})
    return {'version': q.get('version', 2), 'scope': q.get('scope', 'consumer'),
            'sections': [{'id': s['id'], 't': norm(s.get('title'))} for s in sections],
            'questions': questions, 'profiles': profiles}


def main():
    ctl = load('controls/*.yaml', 'controls')
    ind = load('indicators/*.yaml', 'indicators')
    vocab = yaml.safe_load(open(os.path.join(ROOT, 'vocab.yaml'), encoding='utf-8'))
    typ = {}
    for f in sorted(glob.glob(os.path.join(ROOT, 'typologies', '*', '*.yaml'))):
        t = yaml.safe_load(open(f, encoding='utf-8'))['typology']
        typ[t['id']] = t
    problems = []
    dom_order = [d for d, _ in DOMAINS]

    texp, tux, tcn = {}, {}, {}
    for tid, t in typ.items():
        e = t.get('exposure') or {}
        texp[tid] = {s: list(e.get(k) or []) for k, s, _ in DIMS}
        for k, s, _ in DIMS:
            for v in texp[tid][s]:
                if v not in vocab.get(k, []):
                    problems.append('%s exposure %s has value %r not in vocab.yaml' % (tid, k, v))
        cn = e.get('consumer') or {}
        scope = vocab.get('consumer_scope') or {}
        cp = [x['id'] for x in scope.get('products', [])]; cc = [x['id'] for x in scope.get('channels', [])]
        for v in cn.get('products') or []:
            if v not in cp:
                problems.append('%s consumer product %r not in vocab consumer_scope' % (tid, v))
        for v in cn.get('channels') or []:
            if v not in cc:
                problems.append('%s consumer channel %r not in vocab consumer_scope' % (tid, v))
        tcn[tid] = {'r': 1 if cn.get('relevant') else 0, 'p': list(cn.get('products') or []), 'c': list(cn.get('channels') or []),
                    'rt': norm(cn.get('rationale'))} if cn.get('relevant') else {'r': 0}
        # "applies across all": consumer-relevant with empty products and channels (the cross-cutting typologies)
        tux[tid] = 1 if (cn.get('relevant') and not cn.get('products') and not cn.get('channels')) else 0

    ind_typs, ctl_typs = defaultdict(set), defaultdict(set)
    for tid, t in typ.items():
        for l in t.get('indicators', []):
            if l['ref'] not in ind:
                problems.append('%s links unknown indicator %s' % (tid, l['ref'])); continue
            ind_typs[l['ref']].add(tid)
            for c in l.get('controls', []):
                if c not in ctl:
                    problems.append('%s/%s links unknown control %s' % (tid, l['ref'], c)); continue
                ctl_typs[c].add(tid)

    order = sorted(typ, key=lambda k: (dom_order.index(typ[k]['domain']) if typ[k]['domain'] in dom_order else 99, norm(typ[k]['name'])))
    present = [d for d, _ in DOMAINS if any(typ[k]['domain'] == d for k in typ)]

    labels = {
        'dom': {d: l for d, l in DOMAINS if d in present},
        'dim': {s: title for _, s, title in DIMS},
        'tag': {s: {v: nice(v) for v in vocab.get(k, [])} for k, s, _ in DIMS},
        'ct': {k: nice(k) for k in ['preventive', 'detective', 'corrective', 'governance']},
        'im': {k: nice(k) for k in ['rule', 'model', 'process', 'policy', 'training', 'technology']},
        'cat': {k: nice(k) for k in ['customer', 'transaction', 'geographic', 'product_channel', 'behavioural',
                                      'ownership_structure', 'document', 'counterparty', 'typology_specific']},
        'cp': {x['id']: x['label'] for x in (vocab.get('consumer_scope') or {}).get('products', [])},
        'cc': {x['id']: x['label'] for x in (vocab.get('consumer_scope') or {}).get('channels', [])},
        'det': {k: nice(k) for k in ['transaction_monitoring', 'kyc_review', 'screening', 'customer_behaviour',
                                      'document_review', 'investigator_judgement', 'external_intel']},
        'sec': {k: nice(k) for k in sorted({s for t in typ.values() for s in t.get('sectors', [])})},
    }

    links = {}
    for tid in order:
        row = []
        for l in typ[tid].get('indicators', []):
            if l['ref'] in ind:
                row.append([l['ref'], [c for c in l.get('controls', []) if c in ctl]])
        links[tid] = row

    def tcount(tid):
        return len({c for _, cs in links[tid] for c in cs})

    index = {
        'labels': labels, 'domains': present,
        'T': [{'id': k, 'n': norm(typ[k]['name']), 'd': typ[k]['domain'], 'e': texp[k], 'x': tux[k], 'cn': tcn[k],
               'ni': len(links[k]), 'nc': tcount(k)} for k in order],
        'I': [{'id': k, 'n': norm(v['name']), 's': v.get('severity', ''), 'u': len(ind_typs[k])} for k, v in ind.items()],
        'C': [{'id': k, 'n': norm(v['name']), 't': v.get('type', ''), 'u': len(ctl_typs[k])} for k, v in ctl.items()],
        'L': links,
    }

    # ---- clean outputs
    for d in ('data', 'assets'):
        shutil.rmtree(os.path.join(SITE, d), ignore_errors=True)
    for old in glob.glob(os.path.join(SITE, '*.html')):
        os.remove(old)

    dump(os.path.join(SITE, 'data', 'questionnaire.json'), build_questionnaire(vocab, problems))

    for tid in order:
        t = typ[tid]
        e = t.get('exposure') or {}
        nodes, first_idx = [], {}
        for n, l in enumerate(t.get('indicators', [])):
            c = ind.get(l['ref'])
            if not c:
                continue
            nm = norm(l.get('name_in_typology') or c['name'])
            node = {'id': l['ref'], 'n': nm, 's': l.get('severity_in_typology') or c.get('severity', ''),
                    'cx': norm(l.get('context')), 'fp': norm(l.get('false_positive_context') or c.get('false_positive_notes')),
                    'ds': norm(c.get('description')), 'u': len(ind_typs[l['ref']]),
                    'c': [x for x in l.get('controls', []) if x in ctl]}
            if norm(c['name']) != nm:
                node['cn'] = norm(c['name'])
            nodes.append(node)
            for x in node['c']:
                first_idx.setdefault(x, len(nodes) - 1)
        cids = sorted(first_idx, key=lambda x: (first_idx[x], norm(ctl[x]['name'])))
        rec = {'id': tid, 'n': norm(t['name']), 'd': t['domain'], 'ds': norm(t.get('description')),
               'st': t.get('stage', []), 'sc': t.get('sectors', []),
               'src': [parse_source(s) for s in t.get('sources', [])],
               'e': texp[tid], 'x': tux[tid], 'cn': tcn[tid], 'rat': norm(e.get('rationale')),
               'ind': nodes,
               'ctl': [{'id': x, 'n': norm(ctl[x]['name']), 't': ctl[x].get('type', ''), 'im': ctl[x].get('implementation', ''),
                        'ds': norm(ctl[x].get('description')), 'u': len(ctl_typs[x])} for x in cids]}
        dump(os.path.join(SITE, 'data', 't', tid + '.json'), rec)
    for iid, i in ind.items():
        dump(os.path.join(SITE, 'data', 'i', iid + '.json'), {
            'id': iid, 'n': norm(i['name']), 'ds': norm(i.get('description')), 's': i.get('severity', ''),
            'fp': norm(i.get('false_positive_notes')), 'det': i.get('detection_type', []), 'cat': i.get('category', '')})
    for cid, c in ctl.items():
        dump(os.path.join(SITE, 'data', 'c', cid + '.json'), {
            'id': cid, 'n': norm(c['name']), 'ds': norm(c.get('description')), 't': c.get('type', ''),
            'im': c.get('implementation', ''), 'aka': [norm(a) for a in c.get('also_known_as', [])]})
    dump(os.path.join(SITE, 'data', 'index.json'), index)
    dump(os.path.join(SITE, 'data', 'search.json'), build_search(typ, ind, ctl))
    dver = hash8(open(os.path.join(SITE, 'data', 'index.json'), 'rb').read() +
                 open(os.path.join(SITE, 'data', 'search.json'), 'rb').read() +
                 open(os.path.join(SITE, 'data', 'questionnaire.json'), 'rb').read() +
                 b''.join(open(f, 'rb').read() for f in sorted(glob.glob(os.path.join(SITE, 'data', 't', '*.json')))))

    # ---- content-hashed assets
    amap = {}
    os.makedirs(os.path.join(SITE, 'assets'))
    for f in sorted(glob.glob(os.path.join(SRC, 'assets', '*'))):
        raw = open(f, 'rb').read()
        base, ext = os.path.splitext(os.path.basename(f))
        out = '%s.%s%s' % (base, hash8(raw), ext)
        shutil.copyfile(f, os.path.join(SITE, 'assets', out))
        amap[os.path.basename(f)] = '/assets/' + out

    # ---- pages
    layout = open(os.path.join(SRC, 'layout.html'), encoding='utf-8').read()
    npages = 0
    for f in sorted(glob.glob(os.path.join(SRC, 'pages', '*.html'))):
        raw = open(f, encoding='utf-8').read()
        m = re.match(r'<!--\s*(.*?)\s*-->\s*', raw, re.S)
        meta = {}
        for line in m.group(1).splitlines():
            k, _, v = line.partition(':'); meta[k.strip()] = v.strip()
        name = os.path.basename(f)[:-5]
        scripts = ''.join('<script defer src="{{ASSET:%s}}"></script>' % s.strip() for s in meta.get('scripts', '').split(',') if s.strip())
        page = layout
        nav = meta.get('nav', '')
        page = re.sub(r' data-nav="([^"]*)"', lambda mm: ' aria-current="page"' if mm.group(1) == nav else '', page)
        vals = {'{{TITLE}}': meta['title'], '{{DESC}}': meta['description'], '{{PAGE}}': name,
                '{{SCRIPTS}}': scripts, '{{DVER}}': dver, '{{BODY}}': raw[m.end():]}
        for _ in range(2):
            for k, v in vals.items():
                page = page.replace(k, v)
        page = re.sub(r'\{\{ASSET:([^}]+)\}\}', lambda mm: amap.get(mm.group(1)) or problems.append('missing asset ' + mm.group(1)) or '', page)
        left = re.findall(r'\{\{[A-Za-z_:.-]+\}\}', page)
        if left:
            problems.append('%s.html has unresolved placeholders %s' % (name, sorted(set(left))))
        open(os.path.join(SITE, name + '.html'), 'w', encoding='utf-8').write(page)
        npages += 1

    sz = lambda p: os.path.getsize(os.path.join(SITE, p))
    print('typologies %d, indicators %d, controls %d, links %d' % (len(typ), len(ind), len(ctl), sum(len(v) for v in links.values())))
    print('search.json %d bytes' % sz('data/search.json'))
    print('index.json %d bytes; questionnaire.json %d bytes (%s); largest t/*.json %d bytes; %d pages; data version %s' % (
        sz('data/index.json'), sz('data/questionnaire.json'),
        'from questionnaire/questions_v2.yaml',
        max(sz('data/t/' + t + '.json') for t in typ), npages, dver))
    for p in problems:
        print('ERROR:', p)
    if problems:
        sys.exit(1)


if __name__ == '__main__':
    main()
