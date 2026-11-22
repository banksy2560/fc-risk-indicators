#!/usr/bin/env python3
"""Validate typology YAML files against SCHEMA.md rules. Usage: validate.py [root]"""
import sys, pathlib, yaml

DOMAINS = {"money_laundering","terrorist_financing","proliferation_financing","sanctions","fraud","bribery_corruption","tax_evasion","human_trafficking_modern_slavery","environmental_crime","cyber_enabled","other_predicate","cross_cutting"}
CATS = {"customer","transaction","geographic","product_channel","behavioural","ownership_structure","document","counterparty","typology_specific"}
SEV = {"low","medium","high"}
CTYPE = {"preventive","detective","corrective","governance"}
IMPL = {"rule","model","process","policy","training","technology"}

def main(root):
    errs, ids, n_ind, n_ctl, n_typ = [], set(), 0, 0, 0
    for f in sorted(pathlib.Path(root).glob("typologies/**/*.yaml")):
        try:
            t = yaml.safe_load(f.read_text())["typology"]
        except Exception as e:
            errs.append(f"{f}: parse error {e}"); continue
        n_typ += 1
        e = lambda m: errs.append(f"{f.name}: {m}")
        for k in ("id","name","domain","description","sources","indicators"):
            if not t.get(k): e(f"missing {k}")
        if t.get("domain") not in DOMAINS: e(f"bad domain {t.get('domain')}")
        if t.get("id") in ids: e("duplicate typology id")
        ids.add(t.get("id"))
        for i in t.get("indicators") or []:
            n_ind += 1
            iid = i.get("id","?")
            if iid in ids: e(f"duplicate id {iid}")
            ids.add(iid)
            if not str(iid).startswith(str(t.get("id"))): e(f"{iid} not prefixed by typology id")
            if i.get("category") not in CATS: e(f"{iid} bad category")
            if i.get("severity") not in SEV: e(f"{iid} bad severity")
            if not i.get("false_positive_notes"): e(f"{iid} missing false_positive_notes")
            ctl = i.get("controls") or []
            if not ctl: e(f"{iid} no controls")
            if i.get("severity") == "high" and len(ctl) < 2: e(f"{iid} high severity needs >=2 controls")
            if ctl and not any(c.get("type") in ("preventive","detective") for c in ctl): e(f"{iid} needs preventive/detective control")
            for c in ctl:
                n_ctl += 1
                if c.get("id") in ids: e(f"duplicate id {c.get('id')}")
                ids.add(c.get("id"))
                if c.get("type") not in CTYPE: e(f"{c.get('id')} bad type")
                if c.get("implementation") not in IMPL: e(f"{c.get('id')} bad implementation")
                if c.get("effectiveness") not in SEV: e(f"{c.get('id')} bad effectiveness")
    print(f"typologies={n_typ} indicators={n_ind} controls={n_ctl} errors={len(errs)}")
    for m in errs: print(" -", m)
    sys.exit(1 if errs else 0)

main(sys.argv[1] if len(sys.argv) > 1 else ".")
