#!/usr/bin/env python3
"""Validate the linked library (schema v0.2). Usage: validate.py [root] [--strict]

Layout: controls/*.yaml, indicators/*.yaml, typologies/**/*.yaml
Typologies link to canonical indicators (ref) and to canonical controls (controls: [CTL-..]).
Also guards against re-introducing duplicates (near-identical names)."""
import sys, pathlib, re, yaml, itertools

DOMAINS = {"money_laundering","terrorist_financing","proliferation_financing","sanctions","fraud","bribery_corruption","tax_evasion","human_trafficking_modern_slavery","environmental_crime","cyber_enabled","other_predicate","cross_cutting"}
CATS = {"customer","transaction","geographic","product_channel","behavioural","ownership_structure","document","counterparty","typology_specific"}
SEV = {"low","medium","high"}
CTYPE = {"preventive","detective","corrective","governance"}
IMPL = {"rule","model","process","policy","training","technology"}
PROV = {"ai_drafted","human_authored","mixed"}
STATUS = {"draft","sme_reviewed","validated"}
EVID = {"published_guidance","regulator_typology","case_study","practitioner_judgement","ai_draft_unreviewed"}
CONF = {"low","medium","high","unassessed"}
def vocab(root):
    p = pathlib.Path(root) / "vocab.yaml"
    return yaml.safe_load(p.read_text()) if p.exists() else {}
tok = lambda s: set(re.sub(r"\W+", " ", s.lower()).split())

def load(root, pattern, key):
    out = []
    for f in sorted(pathlib.Path(root).glob(pattern)):
        try:
            out += [(f, x) for x in yaml.safe_load(f.read_text())[key]]
        except Exception as e:
            print(f"PARSE ERROR {f}: {e}"); sys.exit(1)
    return out

def main(root, strict):
    errs, warns = [], []
    ctls = {}
    for f, c in load(root, "controls/*.yaml", "controls"):
        cid = c.get("id")
        if cid in ctls: errs.append(f"duplicate control id {cid}")
        ctls[cid] = c
        if c.get("type") not in CTYPE: errs.append(f"{cid} bad type")
        if c.get("implementation") not in IMPL: errs.append(f"{cid} bad implementation")
        if c.get("effectiveness") not in SEV: errs.append(f"{cid} bad effectiveness")
        if not c.get("description"): errs.append(f"{cid} missing description")
    inds = {}
    for f, i in load(root, "indicators/*.yaml", "indicators"):
        iid = i.get("id")
        if iid in inds: errs.append(f"duplicate indicator id {iid}")
        inds[iid] = i
        if i.get("category") not in CATS: errs.append(f"{iid} bad category")
        if i.get("severity") not in SEV: errs.append(f"{iid} bad severity")
        if not i.get("false_positive_notes"): errs.append(f"{iid} missing false_positive_notes")
        for fld, allowed in (("status", STATUS), ("provenance", PROV), ("evidence_basis", EVID), ("confidence", CONF)):
            if fld in i and i[fld] not in allowed: errs.append(f"{iid} bad {fld} {i[fld]}")
        if "status" not in i: warns.append(f"{iid} missing status/provenance fields")
    used_i, used_c, tids, legacy = set(), set(), set(), set()
    n_typ = n_link = 0
    for f in sorted(pathlib.Path(root).glob("typologies/**/*.yaml")):
        t = yaml.safe_load(f.read_text())["typology"]
        n_typ += 1
        for k in ("id","name","domain","description","sources","indicators"):
            if not t.get(k): errs.append(f"{f.name}: missing {k}")
        if t.get("domain") not in DOMAINS: errs.append(f"{f.name}: bad domain")
        if t["id"] in tids: errs.append(f"duplicate typology id {t['id']}")
        tids.add(t["id"])
        voc = vocab(root); ex = t.get("exposure")
        if voc and ex is None: warns.append(f"{t['id']}: no exposure block")
        for dim in ("channels","payment_rails","customer_segments","products"):
            for v in (ex or {}).get(dim, []) or []:
                if v not in voc.get(dim, []): errs.append(f"{t['id']}: exposure {dim} value '{v}' not in vocab.yaml")
        cons = (ex or {}).get("consumer")
        if cons is not None:
            scope = voc.get("consumer_scope", {})
            sp = {x["id"] for x in scope.get("products", [])}; sc = {x["id"] for x in scope.get("channels", [])}
            for v in cons.get("products", []) or []:
                if v not in sp: errs.append(f"{t['id']}: consumer product '{v}' not in vocab consumer_scope")
            for v in cons.get("channels", []) or []:
                if v not in sc: errs.append(f"{t['id']}: consumer channel '{v}' not in vocab consumer_scope")
            if not isinstance(cons.get("relevant"), bool): errs.append(f"{t['id']}: consumer.relevant must be true/false")
        seen = set()
        for l in t["indicators"]:
            n_link += 1
            ref = l.get("ref")
            if ref not in inds: errs.append(f"{t['id']}: unknown indicator ref {ref}"); continue
            if ref in seen: errs.append(f"{t['id']}: indicator {ref} linked twice")
            seen.add(ref); used_i.add(ref)
            if not l.get("context"): errs.append(f"{t['id']}/{ref}: missing typology context")
            sev = l.get("severity_in_typology", inds[ref]["severity"])
            if sev not in SEV: errs.append(f"{t['id']}/{ref}: bad severity_in_typology")
            lc = l.get("controls") or []
            for c in lc:
                if c not in ctls: errs.append(f"{t['id']}/{ref}: unknown control {c}")
                else: used_c.add(c)
            kinds = [ctls[c]["type"] for c in lc if c in ctls]
            if not any(k in ("preventive","detective") for k in kinds): errs.append(f"{t['id']}/{ref}: needs a preventive/detective control")
            if sev == "high" and len(set(lc)) < 2: errs.append(f"{t['id']}/{ref}: high severity needs >=2 controls")
    for iid in inds:
        if iid not in used_i: warns.append(f"orphan indicator {iid} (not linked from any typology)")
    for cid in ctls:
        if cid not in used_c: warns.append(f"orphan control {cid} (not linked from any indicator)")
    # duplicate guard: near-identical names within each catalogue
    for label, items in (("control", ctls), ("indicator", inds)):
        names = [(k, tok(v["name"])) for k, v in items.items()]
        for (a, ta), (b, tb) in itertools.combinations(names, 2):
            if ta and tb and len(ta & tb) / len(ta | tb) >= 0.85:
                warns.append(f"possible duplicate {label}s: {a} / {b}")
    print(f"typologies={n_typ} indicators(canonical)={len(inds)} links={n_link} controls(canonical)={len(ctls)} errors={len(errs)} warnings={len(warns)}")
    for m in errs: print(" ERROR:", m)
    for m in warns[:40]: print(" warn:", m)
    sys.exit(1 if errs or (strict and warns) else 0)

args = [a for a in sys.argv[1:] if not a.startswith("--")]
main(args[0] if args else ".", "--strict" in sys.argv)
