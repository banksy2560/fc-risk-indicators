#!/usr/bin/env python3
"""Generate derived views into build/ from the linked source files. Never edit build/ by hand.
Usage: build_index.py [root]
Outputs: typology_indicator_control.csv, control_usage.csv, indicator_usage.csv, typology_control_matrix.csv, REVERSE_INDEX.md"""
import sys, csv, pathlib, collections, yaml

root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
out = root / "build"; out.mkdir(exist_ok=True)
ld = lambda pat, key: [x for f in sorted(root.glob(pat)) for x in yaml.safe_load(f.read_text())[key]]
ctls = {c["id"]: c for c in ld("controls/*.yaml", "controls")}
inds = {i["id"]: i for i in ld("indicators/*.yaml", "indicators")}
typs = [yaml.safe_load(f.read_text())["typology"] for f in sorted(root.glob("typologies/**/*.yaml"))]

flat, c_typ, c_ind, i_typ, matrix = [], collections.defaultdict(set), collections.defaultdict(set), collections.defaultdict(set), collections.defaultdict(set)
for t in typs:
    for l in t["indicators"]:
        i = inds[l["ref"]]; i_typ[i["id"]].add(t["id"])
        for c in l.get("controls", []):
            c_typ[c].add(t["id"]); c_ind[c].add(i["id"]); matrix[t["id"]].add(c)
            flat.append([t["id"], t["domain"], i["id"], l.get("name_in_typology", i["name"]), l.get("severity_in_typology", i["severity"]), c, ctls[c]["name"], ctls[c]["type"], ctls[c]["family"]])

def w(name, header, rows):
    with open(out / name, "w", newline="") as f:
        cw = csv.writer(f); cw.writerow(header); cw.writerows(rows)
w("typology_indicator_control.csv", ["typology","domain","indicator","indicator_name","severity","control","control_name","control_type","control_family"], flat)
w("control_usage.csv", ["control","name","family","type","indicators","typologies","typology_ids"],
  [[c, ctls[c]["name"], ctls[c]["family"], ctls[c]["type"], len(c_ind[c]), len(c_typ[c]), ";".join(sorted(c_typ[c]))] for c in ctls])
w("indicator_usage.csv", ["indicator","name","category","severity","typologies","typology_ids"],
  [[i, inds[i]["name"], inds[i]["category"], inds[i]["severity"], len(i_typ[i]), ";".join(sorted(i_typ[i]))] for i in inds])
allc = sorted(ctls)
w("typology_control_matrix.csv", ["typology"] + allc, [[t["id"]] + [1 if c in matrix[t["id"]] else "" for c in allc] for t in typs])

top_c = sorted(ctls, key=lambda c: -len(c_typ[c]))[:25]
top_i = sorted(inds, key=lambda i: -len(i_typ[i]))[:25]
md = ["# Reverse index (generated, do not edit)\n", f"{len(typs)} typologies, {len(inds)} canonical indicators, {len(ctls)} canonical controls.\n", "## Most reused controls\n", "| Control | Name | Typologies | Indicators |", "|---|---|---|---|"]
md += [f"| {c} | {ctls[c]['name']} | {len(c_typ[c])} | {len(c_ind[c])} |" for c in top_c]
md += ["\n## Most reused indicators\n", "| Indicator | Name | Typologies |", "|---|---|---|"]
md += [f"| {i} | {inds[i]['name']} | {len(i_typ[i])} |" for i in top_i]
(out / "REVERSE_INDEX.md").write_text("\n".join(md) + "\n")
print("wrote", len(list(out.iterdir())), "files to", out)
