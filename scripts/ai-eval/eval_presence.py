"""Who plays, frame by frame: Kayro's analysis (music_probe) against the AI tagger (EfficientAT),
on MUSDB18's 7 s previews. Truth from the stems. Thresholds tuned on `train`, scored on `test`.
Usage: eval_presence.py <musdb root> <models dir> <probe exe> <work dir>"""
import csv, io, json, subprocess, sys
import numpy as np, musdb, onnxruntime as ort

root, models, probe, work = sys.argv[1:5]
SR = 44100
HOP = 0.25          # frame step (s)
WIN = 0.5           # truth window (s)
START = 3.0         # frames from here (both analyses warmed up; the AI's causal window full)
AI_WIN = 3.0        # the AI's window (s)
CLASSES = {
    "vocals": [27, 32, 33, 34, 35, 36, 254],
    "bass": [142, 194],
    "drums": [162, 163, 164, 165, 168],
    "other": [140, 141, 143, 152, 153, 154, 158, 189, 190, 139],
}

so = ort.SessionOptions(); so.intra_op_num_threads = 4
tag = ort.InferenceSession(f"{models}/efficientat-mn10-as.onnx", so, providers=["CPUExecutionProvider"])

def rms(x):
    return float(np.sqrt(np.mean(x * x) + 1e-12))

def resample(x, sr_in, sr_out):
    n = int(len(x) * sr_out / sr_in)
    return np.interp(np.arange(n) * sr_in / sr_out, np.arange(len(x)), x).astype(np.float32)

def dsp_frames(mix):
    path = f"{work}/mix.f32"
    mix.astype("<f4").tofile(path)
    out = subprocess.run([probe, path, str(SR)], capture_output=True, text=True, check=True).stdout
    rows = list(csv.DictReader(io.StringIO(out)))
    t = np.array([float(r["t"]) for r in rows])
    lv = {k: np.array([float(r[k]) for r in rows]) for k in ("sub", "melody", "voice")}
    drums = np.array([len(r["hits"].split()) for r in rows], float)
    return t, lv, drums

def ai_scores(mono32, times, causal):
    wins = []
    n = int(AI_WIN * 32000)
    for t in times:
        end = int((t + (0 if causal else AI_WIN / 2)) * 32000)
        a = mono32[max(0, end - n):end]
        if len(a) < n:
            a = np.pad(a, (n - len(a), 0))
        wins.append(a)
    p = tag.run(None, {"samples": np.stack(wins)})[0]
    return {k: p[:, idx].max(axis=1) for k, idx in CLASSES.items()}

records = []
for split in ("train", "test"):
    db = musdb.DB(root=root, subsets=split)
    for track in db.tracks:
        mix = track.audio.astype(np.float32)
        dur = len(mix) / SR
        times = np.arange(START, dur - 0.01, HOP)
        stems = {k: track.targets[k].audio.mean(axis=1) for k in CLASSES}
        mono = mix.mean(axis=1)
        truth = {}
        for k, s in stems.items():
            vals = []
            for t in times:
                a, b = int((t - WIN) * SR), int(t * SR)
                e, m = rms(s[a:b]), rms(mono[a:b])
                vals.append(e > 10 ** (-50 / 20) and e > 10 ** (-15 / 20) * m)
            truth[k] = np.array(vals)
        t, lv, hits = dsp_frames(mix)
        def dsp_at(arr, mode="mean"):
            out = []
            for x in times:
                sel = (t > x - WIN) & (t <= x)
                out.append(arr[sel].sum() if mode == "sum" else arr[sel].mean())
            return np.array(out)
        dsp = {"vocals": dsp_at(lv["voice"]), "bass": dsp_at(lv["sub"]),
               "other": dsp_at(lv["melody"]), "drums": dsp_at(hits, "sum")}
        mono32 = resample(mono, SR, 32000)
        live = ai_scores(mono32, times, True)
        memo = ai_scores(mono32, times, False)
        records.append({"split": split, "name": track.name, "truth": {k: v.tolist() for k, v in truth.items()},
                        "dsp": {k: v.tolist() for k, v in dsp.items()},
                        "ai": {k: v.tolist() for k, v in live.items()},
                        "ai_memory": {k: v.tolist() for k, v in memo.items()}})
        print(split, track.name, flush=True)

json.dump(records, open(f"{work}/presence.json", "w"))

def score(method, k, thr, split):
    tp = fp = tn = fn = 0
    for r in records:
        if r["split"] != split:
            continue
        for y, s in zip(r["truth"][k], r[method][k]):
            p = s > thr
            tp += p and y; fp += p and not y; tn += (not p) and (not y); fn += (not p) and y
    tpr = tp / max(1, tp + fn); tnr = tn / max(1, tn + fp)
    return (tpr + tnr) / 2, tp + fn, tn + fp

print("\nsource   méthode     seuil  justesse équilibrée (test)  erreur   [présent / absent]")
for k in CLASSES:
    for method in ("dsp", "ai", "ai_memory"):
        vals = sorted({round(v, 3) for r in records for v in r[method][k]})
        grid = np.quantile(vals, np.linspace(0, 1, 60)) if vals else [0]
        best = max(grid, key=lambda th: score(method, k, th, "train")[0])
        ba, pos, neg = score(method, k, best, "test")
        print(f"{k:8} {method:10} {best:7.3f}  {ba:6.3f}                     {1 - ba:6.3f}   [{pos} / {neg}]")
