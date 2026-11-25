"""채점 규칙 테스트: 모델이 같은 답을 여러 모양으로 써도 똑같이 채점하는지 확인한다.

실행: python analysis/test_grader.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from analyze import Q, is_correct  # noqa: E402

CASES = [
    # (문항, 모델 답, 정답이어야 하는가)
    ("M01", "100022", True), ("M01", "100,022", True), ("M01", "100023", False),
    ("M03", "29/21", True), ("M03", "1.380952", False),
    ("M04", "2,812,160원", True), ("M06", "3/2", True), ("M06", "1.5", True),
    ("M14", "63/128", True), ("M14", "0.4921875", True), ("M14", "504/1024", True),
    ("M22", "0.65", True), ("M22", "65%", True), ("M22", "13/20", True), ("M22", "0.8", False),
    ("M25", "C", True), ("M25", "(C)", True), ("M25", "A", False),
    ("M36", "9.9", True), ("M36", "9.11", False),
    ("M39", "130°", True), ("M39", "130", True),
    ("M29", "전제 오류", True), ("M29", "4", False), ("M30", "없음", True),
    ("M01", "전제 오류", False),  # 답이 있는 문항에 '전제 오류'라고 하면 오답
    ("C03", "-4 1", True), ("C03", "-4, 1", True), ("C03", "-3 1", False),
    ("C07", "db", True), ("C07", "'db'", True), ("C07", "bd", False),
    ("C10", "1,10,3", True), ("C10", "[1, 10, 3]", True), ("C10", "1,3,10", False),
    ("C12", "object number", True), ("C12", "object", False),
    ("C16", "-56", True), ("C16", "200", False),
    ("C22", "[1, 3, 2, 5, 9, 8]", True), ("C22", "1,3,2,5,9,8", True), ("C22", "1,2,3,5,9,8", False),
    ("C26", "O(n^2)", True), ("C26", "O(n²)", True), ("C26", "O(n log n)", False),
    ("C33", "전제 오류", True), ("C33", "4", False),
    ("M61", "전제 오류", True), ("M61", "금요일", True), ("M61", "목요일", False),  # 1582년 이전 그레고리력
]

fails = [(q, a, exp) for q, a, exp in CASES if is_correct(Q[q], a) != exp]
for q, a, exp in fails:
    print(f"FAIL {q} answer={a!r} expected={exp}")
print(f"{len(CASES) - len(fails)}/{len(CASES)} passed")
sys.exit(1 if fails else 0)
