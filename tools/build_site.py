#!/usr/bin/env python3
"""Build the static site data and pages into site/.

Reads controls/, indicators/, typologies/ and vocab.yaml and writes:
  site/data/index.json              lightweight index (all three catalogues + labels + git dates)
  site/data/typologies/<ID>.json    full typology record (exposure, sources, per-indicator context)
  site/data/indicators/<ID>.json    full indicator record, provenance, inherited exposure, per-typology detail
  site/data/controls/<ID>.json      per-control reverse links
  site/data/notes.json              data sources and false-positive notes per indicator (loaded only for list CSV export)
  site/data/links.csv               every typology -> indicator -> control link as CSV
  site/*.html                       pages assembled from tools/site_src/ (layout + page bodies)
Needs only pyyaml (and git, optionally, for "recently added" dates).
Usage: python3 tools/build_site.py [repo_root]

Derived data (nothing is invented):
  * exposure of an indicator = union of the exposure of every typology that links it
  * a cross_cutting typology with an EMPTY exposure dimension "applies across all" of that dimension (flag `ux`)
  * `added` / `ac` = commit time and short hash of the first git commit that added the typology file
    (omitted when git history is unavailable)
"""
import csv, glob, io, json, os, re, shutil, subprocess, sys
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
# exposure dimensions: YAML key -> short key used in the JSON
DIMS = [('channels', 'ch'), ('payment_rails', 'rl'), ('customer_segments', 'sg'), ('products', 'pr')]
DIM_TITLE = {'channels': 'Channels', 'payment_rails': 'Payment rails', 'customer_segments': 'Customer segments', 'products': 'Products'}

# human-readable labels. Anything not listed falls back to "Capitalised words".
OVERRIDE = {
    'atm': 'ATM', 'api_open_banking': 'API / open banking', 'wire_swift': 'Wire transfer (SWIFT)',
    'crypto_onramp_offramp': 'Crypto on/off-ramp', 'informal_value_transfer': 'Informal value transfer (hawala)',
    'direct_debit_batch': 'Direct debit and batch', 'payroll_expense': 'Payroll, petty cash and expenses',
    'insurance_premium_claim': 'Insurance premium or claim', 'securities_settlement': 'Securities settlement',
    'cross_border_remittance': 'Cross-border remittance', 'stored_value_wallet': 'Stored-value wallet',
    'trade_instruments': 'Trade instruments', 'fast_payments': 'Fast payments',
    'face_to_face_professional': 'Face-to-face professional', 'digital_onboarding': 'Digital (remote) onboarding',
    'online_platform': 'Online platform (marketplace, gig, gaming, social)', 'remote_contact': 'Remote contact (email, phone, SMS)',
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
    'trade_finance': 'Trade finance', 'merchant_services': 'Merchant services',
    'casino_gaming': 'Casinos and gaming', 'dnfbp': 'DNFBP', 'mvts': 'MVTS', 'art_luxury': 'Art and luxury', 'real_estate': 'Real estate',
    'corporate_services': 'Corporate services', 'all': 'All sectors', 'fintech': 'Fintech',
    'product_channel': 'Product / channel', 'typology_specific': 'Typology-specific', 'kyc_review': 'KYC review',
    'external_intel': 'External intelligence',
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


def evid_status(sources):
    """Best citation status among a typology's sources. Never means human-confirmed."""
    checked = [s for s in sources if 'agent-reviewed' in s['tag']]
    if any(s['url'] for s in checked):
        return 'checked_link'
    if checked:
        return 'checked'
    return 'unverified'


EVID_RANK = {'checked_link': 0, 'checked': 1, 'unverified': 2}


def git_first_added(path):
    """(iso commit time, short hash, subject) of the commit that first added `path`, or None."""
    try:
        out = subprocess.run(['git', '-C', ROOT, 'log', '--diff-filter=A', '--format=%cI|%h|%s', '--', path],
                             capture_output=True, text=True, timeout=30)
        lines = [l for l in out.stdout.strip().splitlines() if l]
        if out.returncode != 0 or not lines:
            return None
        d, h, s = lines[-1].split('|', 2)
        return d, h, s
    except Exception:
        return None


def dump(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, separators=(',', ':'), ensure_ascii=False)


def main():
    ctl = load('controls/*.yaml', 'controls')
    ind = load('indicators/*.yaml', 'indicators')
    vocab = yaml.safe_load(open(os.path.join(ROOT, 'vocab.yaml'), encoding='utf-8'))
    typ, typ_file = {}, {}
    for f in sorted(glob.glob(os.path.join(ROOT, 'typologies', '*', '*.yaml'))):
        t = yaml.safe_load(open(f, encoding='utf-8'))['typology']
        typ[t['id']] = t
        typ_file[t['id']] = os.path.relpath(f, ROOT)
    dom_order = [d for d, _ in DOMAINS]
    problems = []

    # ---- exposure per typology (+ universal flags for cross-cutting)
    texp, tux = {}, {}
    for tid, t in typ.items():
        e = t.get('exposure') or {}
        texp[tid] = {s: list(e.get(k) or []) for k, s in DIMS}
        tux[tid] = [s for k, s in DIMS if not e.get(k) and t['domain'] == 'cross_cutting']
        for k, s in DIMS:
            for v in texp[tid][s]:
                if v not in vocab.get(k, []):
                    problems.append('%s exposure %s has value %r not in vocab.yaml' % (tid, k, v))

    # ---- reverse maps
    ind_typs, ctl_typs, ctl_inds, ind_ctls = defaultdict(list), defaultdict(set), defaultdict(set), defaultdict(set)
    ctl_links = defaultdict(lambda: defaultdict(list))
    typ_ctls = {}
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

    sources = {tid: [parse_source(s) for s in t.get('sources', [])] for tid, t in typ.items()}
    tevid = {tid: evid_status(sources[tid]) for tid in typ}

    # ---- git dates (typologies only: indicators and controls live in shared family files)
    added = {tid: git_first_added(typ_file[tid]) for tid in typ}
    have_git = all(added.values())
    commits = {}
    if have_git:
        for v in added.values():
            commits[v[1]] = {'date': v[0][:10], 'subject': v[2]}

    # ---- labels
    labels = {
        'domain': {d: l for d, l in DOMAINS},
        'cat': {k: nice(k) for k in ['customer', 'transaction', 'geographic', 'product_channel', 'behavioural',
                                      'ownership_structure', 'document', 'counterparty', 'typology_specific']},
        'det': {k: nice(k) for k in ['transaction_monitoring', 'kyc_review', 'screening', 'customer_behaviour',
                                      'document_review', 'investigator_judgement', 'external_intel']},
        'sev': {'low': 'Low', 'medium': 'Medium', 'high': 'High'},
        'ctype': {k: nice(k) for k in ['preventive', 'detective', 'corrective', 'governance']},
        'impl': {k: nice(k) for k in ['rule', 'model', 'process', 'policy', 'training', 'technology']},
        'eff': {'low': 'Low', 'medium': 'Medium', 'high': 'High'},
        'stage': {k: nice(k) for k in ['placement', 'layering', 'integration']},
        'sector': {k: nice(k) for k in sorted({s for t in typ.values() for s in t.get('sectors', [])})},
        'family': {k: nice(k) for k in sorted({c.get('family') for c in ctl.values()})},
        'status': {'draft': 'Draft - unreviewed', 'sme_reviewed': 'SME reviewed', 'validated': 'Validated'},
        'prov': {'ai_drafted': 'AI-drafted', 'human_authored': 'Human-authored', 'mixed': 'Mixed AI and human'},
        'evb': {'ai_draft_unreviewed': 'AI draft, unreviewed', 'published_guidance': 'Published guidance',
                'regulator_typology': 'Regulator typology', 'case_study': 'Case study',
                'practitioner_judgement': 'Practitioner judgement'},
        'conf': {'unassessed': 'Unassessed', 'low': 'Low', 'medium': 'Medium', 'high': 'High'},
        'evid': {'checked_link': 'Agent-checked source with link', 'checked': 'Agent-checked source, no link',
                 'unverified': 'Unverified sources only'},
        'dim': {s: DIM_TITLE[k] for k, s in DIMS},
    }
    for k, s in DIMS:
        labels[s] = {v: nice(v) for v in vocab.get(k, [])}
    labels['vocab'] = {s: list(vocab.get(k, [])) for k, s in DIMS}
    labels['statusOrder'] = ['draft', 'sme_reviewed', 'validated']

    # ---- index
    domains = [{'id': d, 'label': l, 'n': sum(1 for t in typ.values() if t['domain'] == d)} for d, l in DOMAINS
               if any(t['domain'] == d for t in typ.values())]
    index = {
        'version': '0.1',
        'counts': {'typologies': len(typ), 'indicators': len(ind), 'controls': len(ctl)},
        'domains': domains, 'labels': labels, 'commits': commits,
        'typologies': [], 'indicators': [], 'controls': [],
    }
    order = sorted(typ.items(), key=lambda kv: (dom_order.index(kv[1]['domain']) if kv[1]['domain'] in dom_order else 99, norm(kv[1]['name'])))
    for tid, t in order:
        row = {'id': tid, 'name': norm(t['name']), 'domain': t['domain'], 'sectors': t.get('sectors', []),
               'stage': t.get('stage', []), 'desc': norm(t.get('description')),
               'nInd': len(t.get('indicators', [])), 'nCtl': len(typ_ctls[tid]), 'ctls': typ_ctls[tid],
               'exp': texp[tid], 'ux': tux[tid], 'evid': tevid[tid], 'st': t.get('status', 'draft'),
               'nSrc': len(sources[tid])}
        if have_git:
            row['added'] = added[tid][0]
            row['ac'] = added[tid][1]
        index['typologies'].append(row)
    for iid, i in ind.items():
        index['indicators'].append({
            'id': iid, 'name': norm(i['name']), 'cat': i.get('category', ''), 'sev': i.get('severity', ''),
            'desc': norm(i.get('description')), 'det': i.get('detection_type', []),
            'used': len(set(ind_typs[iid])), 'typs': sorted(set(ind_typs[iid])), 'ctls': sorted(ind_ctls[iid]),
            'st': i.get('status', 'draft'), 'pv': i.get('provenance', 'ai_drafted'),
            'eb': i.get('evidence_basis', 'ai_draft_unreviewed'), 'cf': i.get('confidence', 'unassessed')})
    for cid, c in ctl.items():
        index['controls'].append({
            'id': cid, 'name': norm(c['name']), 'family': c.get('family', ''), 'type': c.get('type', ''),
            'impl': c.get('implementation', ''), 'eff': c.get('effectiveness', ''), 'desc': norm(c.get('description')),
            'aka': [norm(a) for a in c.get('also_known_as', [])],
            'nTyp': len(ctl_typs[cid]), 'nInd': len(ctl_inds[cid]),
            'typs': sorted(ctl_typs[cid]), 'inds': sorted(ctl_inds[cid]), 'st': c.get('status', 'draft')})

    # ---- details
    for d in ('typologies', 'indicators', 'controls'):
        shutil.rmtree(os.path.join(SITE, 'data', d), ignore_errors=True)
    for tid, t in typ.items():
        e = t.get('exposure') or {}
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
        rec = {'id': tid, 'name': norm(t['name']), 'domain': t['domain'], 'description': norm(t.get('description')),
               'stage': t.get('stage', []), 'sectors': t.get('sectors', []), 'sources': sources[tid],
               'exposure': {'exp': texp[tid], 'ux': tux[tid], 'basis': e.get('basis', ''), 'rationale': norm(e.get('rationale'))},
               'evid': tevid[tid], 'status': t.get('status', 'draft'),
               'indicators': links, 'controls': typ_ctls[tid]}
        if have_git:
            rec['added'] = {'date': added[tid][0][:10], 'commit': added[tid][1], 'subject': added[tid][2]}
        dump(os.path.join(SITE, 'data', 'typologies', tid + '.json'), rec)
    notes = {}
    for iid, i in ind.items():
        ls, union, ux, srcs = [], {s: [] for _, s in DIMS}, set(), []
        seen_src = {}
        for tid in dict.fromkeys(ind_typs[iid]):
            for l in typ[tid]['indicators']:
                if l['ref'] == iid:
                    ls.append({'typ': tid, 'name': norm(l.get('name_in_typology') or i['name']),
                               'sev': l.get('severity_in_typology') or i.get('severity', ''),
                               'ctx': norm(l.get('context')), 'fp': norm(l.get('false_positive_context')),
                               'controls': l.get('controls', []), 'exp': texp[tid], 'ux': tux[tid]})
            for s in sources[tid]:
                key = s['text']
                if key in seen_src:
                    seen_src[key]['from'].append(tid)
                else:
                    seen_src[key] = dict(s, **{'from': [tid]}); srcs.append(seen_src[key])
            for s in texp[tid]:
                for v in texp[tid][s]:
                    if v not in union[s]: union[s].append(v)
            ux.update(tux[tid])
        for s in union:
            union[s] = [v for v in labels['vocab'][s] if v in union[s]]
        dump(os.path.join(SITE, 'data', 'indicators', iid + '.json'), {
            'id': iid, 'name': norm(i['name']), 'description': norm(i.get('description')),
            'cat': i.get('category', ''), 'sev': i.get('severity', ''), 'det': i.get('detection_type', []),
            'data': i.get('data_sources', []), 'fp': norm(i.get('false_positive_notes')),
            'status': i.get('status', 'draft'), 'provenance': i.get('provenance', 'ai_drafted'),
            'evidence_basis': i.get('evidence_basis', 'ai_draft_unreviewed'), 'confidence': i.get('confidence', 'unassessed'),
            'last_reviewed': str(i.get('last_reviewed') or ''),
            'exposure': {'exp': union, 'ux': [s for _, s in DIMS if s in ux]},
            'sources': srcs, 'links': ls})
        notes[iid] = {'data': i.get('data_sources', []), 'fp': norm(i.get('false_positive_notes'))}
    for cid, c in ctl.items():
        dump(os.path.join(SITE, 'data', 'controls', cid + '.json'), {
            'id': cid, 'links': [{'typ': t, 'inds': sorted(set(v))} for t, v in sorted(ctl_links[cid].items())]})
    dump(os.path.join(SITE, 'data', 'notes.json'), notes)
    dump(os.path.join(SITE, 'data', 'index.json'), index)

    # ---- links.csv
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator='\r\n')
    w.writerow(['typology_id', 'typology', 'domain', 'indicator_id', 'indicator', 'indicator_category',
                'signal_strength_in_typology (indicative, not a risk score)', 'control_id', 'control', 'control_type',
                'control_family', 'review_status', 'provenance'])
    for tid, t in order:
        for l in t.get('indicators', []):
            c = ind[l['ref']]
            for cid in l.get('controls', []):
                w.writerow([tid, norm(t['name']), labels['domain'].get(t['domain'], t['domain']), l['ref'],
                            norm(l.get('name_in_typology') or c['name']), labels['cat'].get(c.get('category'), ''),
                            l.get('severity_in_typology') or c.get('severity', ''), cid, norm(ctl[cid]['name']),
                            ctl[cid].get('type', ''), labels['family'].get(ctl[cid].get('family'), ''),
                            'draft - unreviewed', 'AI-drafted'])
    with open(os.path.join(SITE, 'data', 'links.csv'), 'w', encoding='utf-8', newline='') as f:
        f.write('﻿' + buf.getvalue())

    # ---- pages
    layout = open(os.path.join(SRC, 'layout.html'), encoding='utf-8').read()
    tagcount = defaultdict(int)
    for ss in sources.values():
        for s in ss: tagcount[s['tag']] += 1
    subs = {'{{N_TYP}}': str(len(typ)), '{{N_IND}}': str(len(ind)), '{{N_CTL}}': str(len(ctl)),
            '{{N_FAM}}': str(len({c.get('family') for c in ctl.values()})), '{{N_LINK}}': str(sum(len(v) for v in ind_typs.values())),
            '{{N_SRC}}': str(sum(len(v) for v in sources.values()))}
    for tg, n in tagcount.items():
        subs['{{TAGN:%s}}' % tg] = str(n)
    # remove generated pages that no longer have a source
    for old in glob.glob(os.path.join(SITE, '*.html')):
        os.remove(old)
    npages = 0
    for f in sorted(glob.glob(os.path.join(SRC, 'pages', '*.html'))):
        raw = open(f, encoding='utf-8').read()
        meta = {}
        m = re.match(r'<!--\s*(.*?)\s*-->\s*', raw, re.S)
        for line in m.group(1).splitlines():
            k, _, v = line.partition(':'); meta[k.strip()] = v.strip()
        body = raw[m.end():]
        name = os.path.basename(f)[:-5]
        variants = [(name, {})]
        if meta.get('aliases'):      # e.g. aliases: typologies=t, indicators=i, controls=c
            variants = []
            for a in meta['aliases'].split(','):
                an, _, mode = a.strip().partition('=')
                variants.append((an, {'{{MODE}}': mode, '{{TITLE}}': nice(an) + ' | FC Risk Indicators',
                                      '{{DESC}}': meta['desc_' + an]}))
        for out, extra in variants:
            page = layout
            vals = {'{{TITLE}}': meta['title'], '{{DESC}}': meta['description'], '{{PAGE}}': out,
                    '{{SCRIPT}}': meta.get('script', ''), '{{MODE}}': '', '{{BODYCLASS}}': meta.get('class', ''),
                    '{{BODY}}': body}
            vals.update(extra)
            nav = meta.get('nav', '')
            page = re.sub(r' data-nav="([^"]*)"', lambda mm: ' aria-current="page"' if mm.group(1) == nav else '', page)
            for k, v in vals.items():
                page = page.replace(k, v)
            for k, v in vals.items():       # body may contain placeholders such as {{MODE}}
                page = page.replace(k, v)
            for k, v in subs.items():
                page = page.replace(k, v)
            left = re.findall(r'\{\{[A-Z_:a-z-]+\}\}', page)
            if left:
                problems.append('%s.html has unresolved placeholders %s' % (out, sorted(set(left))))
            open(os.path.join(SITE, out + '.html'), 'w', encoding='utf-8').write(page); npages += 1

    # ---- report
    tot = sum(os.path.getsize(os.path.join(dp, fn)) for dp, _, fs in os.walk(SITE) for fn in fs)
    nfiles = sum(len(fs) for _, _, fs in os.walk(os.path.join(SITE, 'data')))
    print('typologies %d, indicators %d, controls %d' % (len(typ), len(ind), len(ctl)))
    print('index.json %d bytes; notes.json %d; links.csv %d; %d data files; %d pages; site total %.1f KB; git dates: %s' % (
        os.path.getsize(os.path.join(SITE, 'data', 'index.json')), os.path.getsize(os.path.join(SITE, 'data', 'notes.json')),
        os.path.getsize(os.path.join(SITE, 'data', 'links.csv')), nfiles, npages, tot / 1024, 'yes' if have_git else 'no (panel omitted)'))
    for p in problems:
        print('WARNING:', p)
    if problems: sys.exit(1)


if __name__ == '__main__':
    main()
