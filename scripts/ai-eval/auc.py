import json, sys, numpy as np
recs = json.load(open(sys.argv[1]))
def auc(pos, neg):
    pos, neg = np.array(pos), np.array(neg)
    if not len(pos) or not len(neg): return float("nan")
    return float((pos[:, None] > neg[None]).mean() + 0.5 * (pos[:, None] == neg[None]).mean())
print("AUC (tous les morceaux)   dsp    ia   ia+mémoire")
for k in ("vocals", "bass", "drums", "other"):
    row = []
    for m in ("dsp", "ai", "ai_memory"):
        pos = [s for r in recs for y, s in zip(r["truth"][k], r[m][k]) if y]
        neg = [s for r in recs for y, s in zip(r["truth"][k], r[m][k]) if not y]
        row.append(auc(pos, neg))
    print(f"{k:8}  absent={sum(1 for r in recs for y in r['truth'][k] if not y):4}   " + "  ".join(f"{v:.3f}" for v in row))
# Song level: songs whose vocals are absent most of the clip vs present all along.
v = [(np.mean(r["truth"]["vocals"]), np.mean(r["ai_memory"]["vocals"]), np.mean(r["dsp"]["vocals"]), r["name"]) for r in recs]
inst = [x for x in v if x[0] < 0.3]; sung = [x for x in v if x[0] > 0.9]
print(f"\nmorceaux sans voix: {len(inst)}  avec voix: {len(sung)}")
print("AUC morceau  ia+mémoire %.3f   dsp %.3f" % (auc([x[1] for x in sung], [x[1] for x in inst]), auc([x[2] for x in sung], [x[2] for x in inst])))
for x in sorted(inst)[:8]: print("  sans voix:", x[3][:40], "ia %.3f dsp %.3f" % (x[1], x[2]))
print("  médiane ia avec voix %.3f" % np.median([x[1] for x in sung]))
