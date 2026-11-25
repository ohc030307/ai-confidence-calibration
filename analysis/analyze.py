"""채점 + 분석.

실행: python analysis/analyze.py
입력: data/questions.json, results/raw/{base,fix}.jsonl
출력: results/graded.csv (응답 한 건당 한 줄)
      results/summary.json (웹페이지·보고서가 읽는 집계 결과)

지표
- 정답률(acc), 평균 확신도(conf), 과신 폭(conf - acc)
- ECE: 확신도를 10%p 구간으로 나눠 |구간 평균 확신도 - 구간 정답률| 을 응답 수로 가중 평균
- Brier: (확신도/100 - 정답여부)² 의 평균. 낮을수록 좋다
- AUROC: 확신도가 맞은 답과 틀린 답을 얼마나 잘 구별하는가 (0.5 = 구별 못함)
- 자신 있게 틀림: 확신도 90 이상인데 틀린 응답
- 일관성 확신도: 같은 문항을 3번 물었을 때 이 답이 나온 비율
"""
import csv
import json
import re
from collections import Counter, defaultdict
from fractions import Fraction
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
Q = {q["id"]: q for q in json.loads((ROOT / "data/questions.json").read_text(encoding="utf-8"))}
MODEL_NAME = {"claude-haiku-5-5": "Haiku 5.5", "claude-sonnet-5-5": "Sonnet 5.5", "claude-opus-5-5": "Opus 5.5",
              "gemini-3.5-flash-lite": "Gemini Flash-Lite", "gemini-3.5-flash": "Gemini Flash"}
MODEL_ORDER = list(MODEL_NAME)

PREMISE_WORDS = ["전제오류", "전제가틀", "존재하지않", "없음", "없다", "불가능", "성립하지않", "none", "undefined", "n/a"]
NUM_RE = re.compile(r"-?\d+(?:\.\d+)?(?:/\d+)?")


def norm(s):
    s = str(s).strip().lower()
    s = re.sub(r"[\s'\"`\[\]\(\)]", "", s)
    return s.rstrip(".")


def to_num(s):
    s = str(s).replace(",", "").replace("−", "-")
    m = NUM_RE.search(s)
    if not m:
        return None
    try:
        return Fraction(m.group())
    except (ValueError, ZeroDivisionError):
        return None


def is_correct(q, answer):
    a = str(answer or "")
    na = norm(a)
    says_premise = any(w in na for w in PREMISE_WORDS)
    if q["kind"] == "premise":
        return says_premise
    if says_premise:
        return bool(q.get("premise_ok"))
    if q["kind"] == "str":
        return na == norm(q["answer"]) or na in {norm(x) for x in q["accept"]}
    # num
    target = Fraction(q["answer"])
    v = to_num(a)
    if v is None:
        return False
    if v == target:
        return True
    if "%" in a and v / 100 == target:
        return True
    return na in {norm(x) for x in q["accept"]}


def load(cond):
    files = [ROOT / "results/raw" / f"{cond}.jsonl", *sorted((ROOT / "results/raw").glob(f"{cond}_*.jsonl"))]
    lines = [ln for f in files if f.exists() for ln in f.read_text(encoding="utf-8").splitlines()]
    rows = []
    for line in lines:
        try:
            r = json.loads(line)
        except json.JSONDecodeError:  # 실행이 끊기며 잘린 줄
            continue
        if not r["parsed"] or r["qid"] not in Q:
            continue
        q = Q[r["qid"]]
        conf = max(0.0, min(100.0, float(r["confidence"])))
        rows.append({
            "cond": cond, "qid": r["qid"], "model": r["model"], "rep": r["rep"],
            "domain": q["domain"], "type": q["type"], "difficulty": q["difficulty"],
            "answer": r["answer"], "gold": q["answer"], "confidence": conf,
            "correct": int(is_correct(q, r["answer"])), "check": r.get("check"),
        })
    # 같은 (문항, 모델, 반복)이 여러 번 기록됐으면 마지막 것만 쓴다
    uniq = {}
    for r in rows:
        uniq[(r["qid"], r["model"], r["rep"])] = r
    rows = list(uniq.values())
    # 일관성 확신도: 같은 (문항, 모델)의 반복 응답 중 이 답과 같은 답의 비율
    groups = defaultdict(list)
    for r in rows:
        groups[(r["qid"], r["model"])].append(r)
    for g in groups.values():
        keys = Counter(answer_key(Q[x["qid"]], x["answer"]) for x in g)
        for x in g:
            x["consistency"] = 100.0 * keys[answer_key(Q[x["qid"]], x["answer"])] / len(g)
    return rows


def answer_key(q, a):
    na = norm(a)
    if any(w in na for w in PREMISE_WORDS):
        return "<premise>"
    if q["kind"] == "num":
        v = to_num(a)
        return str(v) if v is not None else na
    return na


def ece(rows, key="confidence", bins=10):
    if not rows:
        return None
    total, err = len(rows), 0.0
    for b in range(bins):
        lo, hi = b * 100 / bins, (b + 1) * 100 / bins
        sel = [r for r in rows if (lo <= r[key] < hi) or (b == bins - 1 and r[key] == 100)]
        if sel:
            err += len(sel) / total * abs(sum(r[key] for r in sel) / len(sel) / 100 - sum(r["correct"] for r in sel) / len(sel))
    return err


def brier(rows, key="confidence"):
    return sum((r[key] / 100 - r["correct"]) ** 2 for r in rows) / len(rows) if rows else None


def auroc(rows, key="confidence"):
    pos = [r[key] for r in rows if r["correct"]]
    neg = [r[key] for r in rows if not r["correct"]]
    if not pos or not neg:
        return None
    wins = sum((p > n) + 0.5 * (p == n) for p in pos for n in neg)
    return wins / (len(pos) * len(neg))


def stats(rows, key="confidence"):
    if not rows:
        return None
    acc = sum(r["correct"] for r in rows) / len(rows)
    conf = sum(r[key] for r in rows) / len(rows) / 100
    wrong = [r for r in rows if not r["correct"]]
    return {
        "n": len(rows), "acc": acc, "conf": conf, "gap": conf - acc,
        "ece": ece(rows, key), "brier": brier(rows, key), "auroc": auroc(rows, key),
        "wrong": len(wrong),
        "confident_wrong": sum(1 for r in wrong if r[key] >= 90),
        "conf_when_wrong": (sum(r[key] for r in wrong) / len(wrong) / 100) if wrong else None,
    }


def reliability(rows, key="confidence"):
    """신뢰도 그림용: 확신도 구간별 (평균 확신도, 정답률, 개수)"""
    edges = [0, 50, 70, 80, 90, 95, 100.01]
    out = []
    for lo, hi in zip(edges, edges[1:]):
        sel = [r for r in rows if lo <= r[key] < hi]
        if sel:
            out.append({"lo": lo, "hi": min(hi, 100), "n": len(sel),
                        "conf": sum(r[key] for r in sel) / len(sel) / 100,
                        "acc": sum(r["correct"] for r in sel) / len(sel)})
    return out


def by(rows, field, key="confidence"):
    groups = defaultdict(list)
    for r in rows:
        groups[r[field]].append(r)
    return {k: stats(v, key) for k, v in groups.items()}


def ladders(rows):
    """난이도 사다리: 사다리 → 모델 → 단계별 (정답률, 평균 확신도)"""
    out = defaultdict(lambda: defaultdict(list))
    for r in rows:
        q = Q[r["qid"]]
        if "ladder" not in q:
            continue
        lv = out[q["ladder"]][MODEL_NAME[r["model"]]]
        lv.append((q["level"], r))
    res = {}
    for name, models in out.items():
        res[name] = {}
        for m, pairs in models.items():
            levels = defaultdict(list)
            for lv, r in pairs:
                levels[lv].append(r)
            res[name][m] = [{"level": lv, "n": len(rs), "acc": sum(x["correct"] for x in rs) / len(rs),
                             "conf": sum(x["confidence"] for x in rs) / len(rs) / 100,
                             "why": Q[rs[0]["qid"]]["why"]} for lv, rs in sorted(levels.items())]
    return res


def summarize(rows):
    models = {}
    for m in MODEL_ORDER:
        mr = [r for r in rows if r["model"] == m]
        if not mr:
            continue
        models[MODEL_NAME[m]] = {
            "stated": stats(mr), "consistency": stats(mr, "consistency"),
            "by_domain": by(mr, "domain"), "by_type": by(mr, "type"),
            "reliability": reliability(mr), "reliability_consistency": reliability(mr, "consistency"),
            "conf_hist": dict(Counter(int(r["confidence"] // 10 * 10) if r["confidence"] < 100 else 100 for r in mr)),
        }
    return {
        "overall": stats(rows), "overall_consistency": stats(rows, "consistency"),
        "by_domain": by(rows, "domain"), "by_type": by(rows, "type"),
        "models": models, "reliability": reliability(rows),
        "ladders": ladders(rows),
        # 사다리를 뺀 기본 81문항만의 결과 (1차 실험)
        "core": {MODEL_NAME[m]: stats([r for r in rows if r["model"] == m and r["type"] != "사다리"]) for m in MODEL_ORDER
                 if any(r["model"] == m for r in rows)},
    }


def item_table(rows):
    """문항별·모델별 결과 (웹페이지의 문항 탐색용)"""
    out = defaultdict(lambda: {"models": {}})
    for r in rows:
        it = out[r["qid"]]
        q = Q[r["qid"]]
        it.update({"id": q["id"], "domain": q["domain"], "type": q["type"], "question": q["question"], "gold": q["answer"], "why": q["why"]})
        it["models"].setdefault(MODEL_NAME[r["model"]], []).append(
            {"rep": r["rep"], "answer": r["answer"], "confidence": r["confidence"], "correct": r["correct"]})
    for it in out.values():
        for v in it["models"].values():
            v.sort(key=lambda x: x["rep"])
    return [out[k] for k in sorted(out, key=lambda k: (k[0], int(k[1:])))]


def main():
    result = {"questions": len(Q), "conditions": {}}
    all_rows = []
    for cond in ["base", "fix"]:
        rows = load(cond)
        if not rows:
            continue
        all_rows += rows
        result["conditions"][cond] = summarize(rows)
        result["conditions"][cond]["items"] = item_table(rows)
    # 확신도 보정표(사후 보정): base 결과에서 모델별 '말한 확신도 구간 → 실제 정답률'
    if "base" in result["conditions"]:
        result["calibration_table"] = {
            name: m["reliability"] for name, m in result["conditions"]["base"]["models"].items()}
    with open(ROOT / "results/graded.csv", "w", newline="", encoding="utf-8-sig") as f:
        cols = ["cond", "qid", "model", "rep", "domain", "type", "difficulty", "gold", "answer", "confidence", "consistency", "correct", "check"]
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(all_rows)
    (ROOT / "results/summary.json").write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")
    # 콘솔 요약
    for cond, s in result["conditions"].items():
        print(f"== {cond}: n={s['overall']['n']}")
        for name, m in s["models"].items():
            st, cs = m["stated"], m["consistency"]
            print(f"  {name:11s} acc={st['acc']:.3f} conf={st['conf']:.3f} gap={st['gap']:+.3f} "
                  f"ECE={st['ece']:.3f} Brier={st['brier']:.3f} AUROC={st['auroc'] if st['auroc'] is None else round(st['auroc'], 3)} "
                  f"wrong={st['wrong']} confWrong={st['confident_wrong']} | consECE={cs['ece']:.3f}")
        for t, v in s["by_type"].items():
            print(f"    {t:6s} acc={v['acc']:.3f} conf={v['conf']:.3f} wrong={v['wrong']} confWrong={v['confident_wrong']}")
        for lname, ms in s["ladders"].items():
            print(f"    [ladder {lname}]")
            for m, lv in ms.items():
                print(f"      {m:11s} " + " ".join(f"{x['level']}:{x['acc']*100:.0f}/{x['conf']*100:.0f}" for x in lv))


if __name__ == "__main__":
    main()
