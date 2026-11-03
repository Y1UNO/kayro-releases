"""The beat grid on the mix: Kayro's (tempo and phase from its kicks, as tempo.ts) against Beat This!
small, both scored against Beat This! on the clean drum stem (the reference). F-measure ±70 ms.
Usage: eval_beats.py <musdb root> <models dir> <probe exe> <work dir>"""
import csv, io, subprocess, sys
import numpy as np, musdb, onnxruntime as ort

root, models, probe, work = sys.argv[1:5]
SR = 44100
so = ort.SessionOptions(); so.intra_op_num_threads = 4
mel = ort.InferenceSession(f"{models}/beat-this-logmel.onnx", so, providers=["CPUExecutionProvider"])
net = ort.InferenceSession(f"{models}/beat-this-small0.onnx", so, providers=["CPUExecutionProvider"])

def resample(x, sr_in, sr_out):
    n = int(len(x) * sr_out / sr_in)
    return np.interp(np.arange(n) * sr_in / sr_out, np.arange(len(x)), x).astype(np.float32)

def peaks(logits):
    return [i / 50 for i in range(len(logits)) if logits[i] > 0 and logits[i] == logits[max(0, i - 3):i + 4].max()]

def beat_this(mono):
    s = mel.run(None, {"audio": resample(mono, SR, 22050)})[0][None].astype(np.float32)
    b, d = net.run(None, {"spectrogram": s})
    return np.array(peaks(b[0])), np.array(peaks(d[0]))

def kayro_grid(mix, dur):
    path = f"{work}/mix_beats.f32"
    mix.astype("<f4").tofile(path)
    out = subprocess.run([probe, path, str(SR)], capture_output=True, text=True, check=True).stdout
    kicks = [float(r["t"]) for r in csv.DictReader(io.StringIO(out)) if "Kick" in r["hits"]]
    if len(kicks) < 3:
        return np.array([])
    gaps = []
    for a, b in zip(kicks, kicks[1:]):
        g = b - a
        if g < 0.08 or g > 2.5:
            continue
        while g < 60 / 160: g *= 2
        while g > 60 / 80: g /= 2
        gaps.append(g)
    if len(gaps) < 2:
        return np.array([])
    beat = float(np.median(gaps))
    # Phase: the offset that puts the most kicks on the grid.
    phases = np.linspace(0, beat, 50, endpoint=False)
    hit = lambda ph: sum(min(((k - ph) % beat), beat - ((k - ph) % beat)) < 0.07 for k in kicks)
    ph = max(phases, key=hit)
    return np.arange(ph, dur, beat)

def fmeasure(est, ref, tol=0.07, start=1.0):
    est = est[est >= start]; ref = ref[ref >= start]
    if len(ref) == 0:
        return None
    if len(est) == 0:
        return 0.0
    used = set(); tp = 0
    for r in ref:
        j = int(np.argmin(np.abs(est - r)))
        if abs(est[j] - r) <= tol and j not in used:
            used.add(j); tp += 1
    p, rc = tp / len(est), tp / len(ref)
    return 0.0 if tp == 0 else 2 * p * rc / (p + rc)

rows = []
for split in ("train", "test"):
    for track in musdb.DB(root=root, subsets=split).tracks:
        mix = track.audio.astype(np.float32)
        dur = len(mix) / SR
        ref, _ = beat_this(track.targets["drums"].audio.mean(axis=1).astype(np.float32))
        if len(ref) < 6:
            continue  # no steady drums: no reference
        ai, _ = beat_this(mix.mean(axis=1))
        ky = kayro_grid(mix, dur)
        rows.append((fmeasure(ky, ref), fmeasure(ai, ref)))
rows = [r for r in rows if r[0] is not None]
k = np.array([r[0] for r in rows]); a = np.array([r[1] for r in rows])
print(f"{len(rows)} morceaux avec une batterie régulière")
print(f"Kayro (kicks)  : F = {k.mean():.3f}   erreur = {1 - k.mean():.3f}")
print(f"Beat This! mix : F = {a.mean():.3f}   erreur = {1 - a.mean():.3f}")
print(f"IA meilleure sur {np.mean(a > k + 0.05):.0%} des morceaux, pire sur {np.mean(a < k - 0.05):.0%}")
