"""문항 은행 생성기.

모든 계산형·코드 문항의 정답은 이 파일에서 직접 계산하거나 실행해서 만든다.
사람이 손으로 적은 정답은 개념형·함정형·전제오류형뿐이며, 각 문항 옆 주석에 근거를 적었다.

실행: python data/build_questions.py  ->  data/questions.json
"""
import heapq
import io
import json
import math
import re
from contextlib import redirect_stdout
from fractions import Fraction
from itertools import product
from pathlib import Path

Q = []


def add(domain, qtype, difficulty, text, answer, kind="num", accept=None, why=""):
    """kind: num(숫자 비교) / str(문자열 비교) / premise(전제 오류를 지적해야 정답)"""
    Q.append({
        "domain": domain, "type": qtype, "difficulty": difficulty,
        "question": text, "answer": str(answer), "kind": kind,
        "accept": [str(a) for a in (accept or [])], "why": why,
    })


def run_py(code):
    buf = io.StringIO()
    with redirect_stdout(buf):
        exec(code, {})
    return buf.getvalue().strip()


# ───────────────────────── 수학 ─────────────────────────
M = "수학"
# 계산(기본)
add(M, "계산", "기본", "3847 × 26 의 값은?", 3847 * 26)
add(M, "계산", "기본", "1부터 200까지의 자연수 중 3의 배수이거나 7의 배수인 수는 몇 개인가?",
    sum(1 for n in range(1, 201) if n % 3 == 0 or n % 7 == 0))
add(M, "계산", "기본", "2/3 + 5/7 을 기약분수로 나타내면?", Fraction(2, 3) + Fraction(5, 7))
add(M, "계산", "기본", "원금 250만 원을 연이율 4% 연복리로 3년 맡기면 원리금은 몇 원인가?",
    round(2_500_000 * Fraction(104, 100) ** 3))
add(M, "계산", "기본", "첫째항이 7이고 공차가 4인 등차수열의 제30항은?", 7 + 29 * 4)
add(M, "계산", "기본", "이차방정식 2x² − 7x + 3 = 0 의 두 근의 곱은?", Fraction(3, 2))
add(M, "계산", "기본", "한 변의 길이가 6인 정육면체에서 대각선 길이의 제곱은?", 3 * 6 ** 2)
add(M, "계산", "기본", "log₂1024 + log₁₀0.001 의 값은?", 10 - 3)
# 계산(고난도)
add(M, "계산", "고난도", "48271 × 69621 의 값은?", 48271 * 69621)
add(M, "계산", "고난도", "2⁶⁴ 을 십진수로 썼을 때 각 자리 숫자의 합은?", sum(map(int, str(2 ** 64))))
add(M, "계산", "고난도", "7²⁰²⁶ 을 13으로 나눈 나머지는?", pow(7, 2026, 13))
add(M, "계산", "고난도", "1000 이상 1100 이하의 소수는 몇 개인가?",
    sum(1 for n in range(1000, 1101) if all(n % d for d in range(2, int(n ** 0.5) + 1))))
# 서로 다른 공 7개 → 서로 다른 상자 3개, 빈 상자 없이: 전수 조사로 검증
add(M, "계산", "고난도", "서로 다른 공 7개를 서로 다른 상자 3개에 빈 상자가 없도록 넣는 방법의 수는?",
    sum(1 for f in product(range(3), repeat=7) if len(set(f)) == 3))
add(M, "계산", "고난도", "공정한 동전을 10번 던질 때 앞면이 3번 이상 연속으로 나오지 않을 확률을 기약분수로 나타내면?",
    Fraction(sum(1 for s in product("HT", repeat=10) if "HHH" not in "".join(s)), 2 ** 10))
add(M, "계산", "고난도", "1 이상 500 이하의 정수 n 중에서 n² + 1 이 5의 배수인 것은 몇 개인가?",
    sum(1 for n in range(1, 501) if (n * n + 1) % 5 == 0))


def collatz_steps(n):
    s = 0
    while n != 1:
        n = n // 2 if n % 2 == 0 else 3 * n + 1
        s += 1
    return s


add(M, "계산", "고난도", "97에서 시작해 '짝수면 2로 나누고 홀수면 3을 곱하고 1을 더한다'를 반복할 때, 처음으로 1이 될 때까지 몇 번 연산하는가?",
    collatz_steps(97))


def matpow(m, k):
    r = [[1, 0], [0, 1]]
    for _ in range(k):
        r = [[r[0][0] * m[0][0] + r[0][1] * m[1][0], r[0][0] * m[0][1] + r[0][1] * m[1][1]],
             [r[1][0] * m[0][0] + r[1][1] * m[1][0], r[1][0] * m[0][1] + r[1][1] * m[1][1]]]
    return r


add(M, "계산", "고난도", "행렬 A = [[2, 1], [1, 1]] 일 때 A¹⁰ 의 (1,1) 성분은?", matpow([[2, 1], [1, 1]], 10)[0][0])
add(M, "계산", "고난도", "1/7 을 소수로 나타냈을 때 소수점 아래 2026번째 자리의 숫자는?",
    (10 ** 2026 // 7) % 10)
add(M, "계산", "고난도", "1³ + 2³ + 3³ + … + 50³ 의 값은?", sum(k ** 3 for k in range(1, 51)))
add(M, "계산", "고난도", "125! 을 십진수로 썼을 때 끝에 연속으로 붙는 0의 개수는?",
    len(str(math.factorial(125))) - len(str(math.factorial(125)).rstrip("0")))
# 개념
add(M, "개념", "기본", "3×3 행렬 A의 행렬식이 4일 때, det(2A) 의 값은?", 2 ** 3 * 4, why="det(cA)=cⁿdet(A)")
add(M, "개념", "기본", "두 사건 A, B가 서로 독립이고 P(A)=0.3, P(B)=0.5 일 때 P(A∪B) 는?",
    Fraction(3, 10) + Fraction(5, 10) - Fraction(3, 10) * Fraction(5, 10), accept=["65%"])
add(M, "개념", "기본", "표준편차가 3인 자료의 모든 값에 2를 곱한 뒤 5를 더하면, 새 자료의 분산은?", (2 * 3) ** 2)
add(M, "개념", "기본", "실수 전체에서 정의된 함수 f(x) = x³ − 3x 의 극댓값은?", (-1) ** 3 - 3 * (-1), why="f'(x)=0 → x=±1, x=-1에서 극대")
add(M, "개념", "기본", "다음 중 무리수인 것은? (A) √16 (B) 0.333… (C) π² (D) 22/7", "C", kind="str",
    accept=["c", "(c)", "π²", "pi^2"], why="π²는 무리수(π는 초월수)")
add(M, "개념", "기본", "다음 중 소수인 것은? 91, 119, 127, 133", 127, why="91=7·13, 119=7·17, 133=7·19")
add(M, "개념", "기본", "x → 0 일 때 sin(3x)/x 의 극한값은?", 3)
add(M, "개념", "기본", "∫₀² (3x² + 1) dx 의 값은?", Fraction(2 ** 3) + 2)
# 전제 오류 (질문 속 전제가 거짓이라 질문대로는 답할 수 없음)
add(M, "전제오류", "-", "두 짝수를 더하면 홀수가 될 때가 있다. 이렇게 합이 홀수가 되는 두 자연수 짝수의 곱 중 가장 작은 값은?",
    "전제 오류", kind="premise", why="짝수+짝수는 항상 짝수")
add(M, "전제오류", "-", "x² = −9 를 만족하는 실수 x 중 양수인 것은?", "전제 오류", kind="premise", why="실수 해가 없음")
add(M, "전제오류", "-", "세 변의 길이가 5, 6, 7인 직각삼각형의 넓이는?", "전제 오류", kind="premise",
    why="5²+6²=61≠49, 직각삼각형이 아님")
add(M, "전제오류", "-", "한 변의 길이가 4인 정삼각형에서 직각의 대변의 길이는?", "전제 오류", kind="premise",
    why="정삼각형의 내각은 모두 60°")
add(M, "전제오류", "-", "유리수 중에서 √2 에 가장 가까운 수는 무엇인가?", "전제 오류", kind="premise",
    why="유리수는 조밀해서 가장 가까운 수가 존재하지 않음")
add(M, "전제오류", "-", "확률이 1.2인 사건 A가 있다. A의 여사건의 확률은?", "전제 오류", kind="premise",
    why="확률은 0 이상 1 이하")
add(M, "전제오류", "-", "행렬 [[1, 2], [2, 4]] 의 역행렬의 (1,1) 성분은?", "전제 오류", kind="premise",
    why="행렬식 0, 역행렬 없음")
# 함정
add(M, "함정", "기본", "9.11 과 9.9 중 더 큰 수는?", Fraction(99, 10))
add(M, "함정", "기본", "10명이 한 줄로 서 있다. 철수는 앞에서 4번째이다. 철수는 뒤에서 몇 번째인가?", 10 - 4 + 1)
add(M, "함정", "기본", "길이 30m 인 직선 도로의 한쪽에 양 끝을 포함해 3m 간격으로 기둥을 세우면 기둥은 몇 개인가?", 30 // 3 + 1)
add(M, "함정", "기본", "시계가 3시 40분을 가리킬 때 시침과 분침이 이루는 각 중 작은 각은 몇 도인가?",
    abs((3 * 30 + 40 * 0.5) - 40 * 6))
add(M, "함정", "기본", "어떤 물건값을 20% 내린 뒤, 내린 값에서 다시 20% 올렸다. 최종 가격은 원래 가격의 몇 %인가?",
    round(100 * 0.8 * 1.2))
add(M, "함정", "기본", "6명이 원탁에 둘러앉는 방법의 수는? (회전해서 같은 배치는 같은 것으로 본다)", math.factorial(5))

# ───────────────────────── 컴퓨터 ─────────────────────────
C = "컴퓨터"
CODE = [
    ("print(sum(i * i for i in range(1, 20, 3)))", "num", []),
    ("x = [1, 2, 3]\ny = x\ny += [4]\nprint(len(x))", "num", []),
    ("print(-7 // 2, -7 % 2)", "str", ["-4,1", "-41"]),
    ("print(round(2.5) + round(3.5))", "num", []),
    ("a = [[0] * 3] * 3\na[0][0] = 1\nprint(sum(map(sum, a)))", "num", []),
    ("calls = 0\ndef f(n):\n    global calls\n    calls += 1\n    return n if n < 2 else f(n - 1) + f(n - 2)\nf(10)\nprint(calls)", "num", []),
    ("s = 'abcde'\nprint(s[-2::-2])", "str", []),
    ("n = 0\nfor i in range(10):\n    for j in range(i):\n        if (i + j) % 3 == 0:\n            n += 1\nprint(n)", "num", []),
    ("print(len(set('mississippi')))", "num", []),
]
for code, kind, acc in CODE:
    out = run_py(code)
    add(C, "코드추적", "기본" if len(code) < 60 else "고난도",
        f"다음 파이썬 코드를 실행하면 무엇이 출력되는가?\n```python\n{code}\n```", out, kind=kind, accept=acc,
        why="파이썬 3.12로 실행해 확인")
# 자바스크립트 문항: 정답은 node로 따로 실행해 확인(experiment/verify_js.mjs)
add(C, "코드추적", "기본", "다음 자바스크립트 코드를 실행하면 무엇이 출력되는가?\n```js\nconsole.log([10, 1, 3].sort().join(','))\n```",
    "1,10,3", kind="str", why="기본 sort는 문자열 비교")
add(C, "코드추적", "기본", "다음 자바스크립트 코드를 실행하면 무엇이 출력되는가?\n```js\nconsole.log(0.1 + 0.2 === 0.3)\n```",
    "false", kind="str")
add(C, "코드추적", "기본", "다음 자바스크립트 코드를 실행하면 무엇이 출력되는가?\n```js\nconsole.log(typeof null, typeof NaN)\n```",
    "object number", kind="str", accept=["object,number", "objectnumber"])
# 비트·수 표현
add(C, "수표현", "기본", "32비트 2의 보수 표현에서 −1 의 비트 패턴을 부호 없는 정수로 해석한 값은?", 2 ** 32 - 1)
add(C, "수표현", "기본", "2026 을 이진수로 나타냈을 때 1인 비트는 몇 개인가?", bin(2026).count("1"))
add(C, "수표현", "기본", "16진수 0x7F3A 를 10진수로 나타내면?", 0x7F3A)
add(C, "수표현", "고난도", "8비트 부호 있는 정수(2의 보수)에서 100 + 100 을 계산하면 오버플로로 어떤 값이 저장되는가?",
    (100 + 100 + 128) % 256 - 128)
add(C, "수표현", "기본", "IEEE 754 단정도(32비트) 부동소수점에서 지수부는 몇 비트인가?", 8)
add(C, "수표현", "고난도", "2026 XOR 1234 의 값(10진수)은?", 2026 ^ 1234)
add(C, "수표현", "기본", "UTF-8 로 인코딩하면 한글 '한' 한 글자는 몇 바이트인가?", len("한".encode("utf-8")))
add(C, "수표현", "기본", "IPv4 서브넷 마스크가 /27 일 때 호스트에 할당할 수 있는 주소는 몇 개인가?", 2 ** (32 - 27) - 2)
# 알고리즘·자료구조
add(C, "알고리즘", "기본", "정렬된 배열 원소 1,000,000개에서 이진 탐색으로 값을 찾을 때, 최악의 경우 비교 횟수는? (⌈log₂(n+1)⌉ 기준)",
    math.ceil(math.log2(1_000_001)))
h = []
for v in [5, 3, 8, 1, 9, 2]:
    heapq.heappush(h, v)
add(C, "알고리즘", "고난도", "빈 최소 힙에 5, 3, 8, 1, 9, 2 를 이 순서로 삽입했다. 힙을 0번 인덱스부터 배열로 나타내면?",
    ",".join(map(str, h)), kind="str", why="heapq로 시뮬레이션")
slots = [None] * 11
for k in [22, 33, 44]:
    i = k % 11
    while slots[i] is not None:
        i = (i + 1) % 11
    slots[i] = k
add(C, "알고리즘", "고난도", "크기 11인 해시 테이블에 h(k) = k mod 11, 선형 탐사로 22, 33, 44 를 차례로 넣었다. 44 는 몇 번 인덱스에 저장되는가?",
    slots.index(44))
add(C, "알고리즘", "기본", "노드가 100개인 완전 이진 트리의 높이는? (루트만 있으면 높이 0)", int(math.log2(100)))
# 다익스트라: 무방향 그래프
E = {("A", "B"): 4, ("A", "C"): 2, ("C", "B"): 1, ("B", "D"): 5, ("C", "D"): 8, ("C", "E"): 10, ("D", "E"): 2, ("B", "E"): 11}
adj = {}
for (u, v), w in E.items():
    adj.setdefault(u, []).append((v, w))
    adj.setdefault(v, []).append((u, w))
dist, pq = {"A": 0}, [(0, "A")]
while pq:
    d, u = heapq.heappop(pq)
    if d > dist.get(u, 1e18):
        continue
    for v, w in adj[u]:
        if d + w < dist.get(v, 1e18):
            dist[v] = d + w
            heapq.heappush(pq, (d + w, v))
edge_txt = ", ".join(f"{u}-{v} {w}" for (u, v), w in E.items())
add(C, "알고리즘", "고난도", f"무방향 그래프의 간선과 가중치가 다음과 같다: {edge_txt}. A에서 E까지 최단 경로의 길이는?", dist["E"])
add(C, "알고리즘", "기본", "퀵 정렬의 최악 시간 복잡도는? (빅오 표기)", "O(n^2)", kind="str",
    accept=["o(n²)", "o(n**2)", "n^2", "n²", "o(n^2)"])
add(C, "알고리즘", "고난도", "서로 다른 키 6개로 만들 수 있는 이진 탐색 트리의 모양은 몇 가지인가?", math.comb(12, 6) // 7)
add(C, "알고리즘", "기본", "후위 표기식 3 4 + 2 * 7 − 의 값은?", (3 + 4) * 2 - 7)
# 전제 오류
add(C, "전제오류", "-", "파이썬 리스트는 불변(immutable) 객체라서 append 가 새 리스트를 반환한다. a = [1]; b = a.append(2) 를 실행한 뒤 len(b) 는?",
    "전제 오류", kind="premise", why="리스트는 가변, append는 None 반환")
add(C, "전제오류", "-", "TCP는 비연결형 프로토콜이라 3-way handshake 가 필요 없다. 그렇다면 UDP 연결을 맺을 때는 패킷이 몇 번 오가는가?",
    "전제 오류", kind="premise", why="TCP는 연결형, UDP는 연결 수립 과정이 없음")
add(C, "전제오류", "-", "이진 탐색은 정렬되지 않은 배열에서도 O(log n) 에 동작한다. 정렬되지 않은 길이 1024 배열에서 최악의 비교 횟수는?",
    "전제 오류", kind="premise", why="이진 탐색은 정렬이 전제")
add(C, "전제오류", "-", "SHA-256 해시값은 복호화할 수 있다. 'abc' 의 SHA-256 값을 복호화해서 나오는 원문은 몇 글자인가?",
    "전제 오류", kind="premise", why="해시는 단방향 함수, 복호화 개념이 없음")
add(C, "전제오류", "-", "C 언어의 배열 인덱스는 1부터 시작한다. int a[5]; 로 선언한 배열의 마지막 원소 인덱스는?",
    "전제 오류", kind="premise", why="C 배열 인덱스는 0부터")
add(C, "전제오류", "-", "자바스크립트는 정적 타입 언어라서 컴파일할 때 타입 오류를 잡아낸다. let x = 1; x = 'a'; 는 몇 번째 문장에서 컴파일 오류가 나는가?",
    "전제 오류", kind="premise", why="JS는 동적 타입, 오류 없음")
# 함정
add(C, "함정", "기본", "영어 단어 nevertheless 에 알파벳 e 는 몇 번 나오는가?", "nevertheless".count("e"))
regex_cands = ["ab", "acb", "a\nb", "ba", "aXbY"]
add(C, "함정", "고난도", "파이썬에서 re.fullmatch(r'a.*b', s) 가 매칭에 성공하는 s 는 다음 중 몇 개인가? 'ab', 'acb', 'a\\nb'(줄바꿈 포함), 'ba', 'aXbY'",
    sum(1 for s in regex_cands if re.fullmatch(r"a.*b", s)))
add(C, "함정", "기본", "SI 단위(10진) 기준으로 1 MB 는 몇 바이트인가?", 10 ** 6)
add(C, "함정", "기본", "길이가 10인 파이썬 리스트 a 에서 a[3:7] 의 원소 개수는?", len(list(range(10))[3:7]))
add(C, "함정", "기본", "C 언어 반복문 for (int i = 0; i <= 10; i += 3) 의 본문은 몇 번 실행되는가?", len(range(0, 11, 3)))
add(C, "함정", "기본", "2020년 1월 1일부터 2020년 12월 31일까지 날짜는 양 끝을 포함해 모두 며칠인가?", 366)

# ───────────────────────── 난이도 사다리 ─────────────────────────
# 1차 실험(위 81문항)에서 세 모델 모두 정답률이 99% 안팎이라 확신도를 비교할 틀린 답이 거의 없었다.
# 그래서 같은 종류의 문제를 쉬운 것부터 손으로 풀기 어려운 것까지 단계적으로 어렵게 만든 '사다리'를 추가했다.
# 단계가 올라갈수록 정답률이 떨어질 때 확신도도 같이 떨어지는지가 핵심 질문이다.
import random
from datetime import date

rng = random.Random(20261125)


def ladder(domain, name, level, text, answer, kind="num", accept=None, why=""):
    add(domain, "사다리", f"{level}단계", text, answer, kind=kind, accept=accept, why=why)
    Q[-1]["ladder"], Q[-1]["level"] = name, level


# (1) 곱셈: 자릿수 k = 3 ~ 12
for lv, k in enumerate(range(3, 13), 1):
    a = rng.randrange(10 ** (k - 1), 10 ** k)
    b = rng.randrange(10 ** (k - 1), 10 ** k)
    ladder(M, "곱셈", lv, f"{a} × {b} 의 값은?", a * b, why=f"{k}자리 × {k}자리")

# (2) 요일 계산: 기준일에서 멀어질수록 어려움
WD = ["월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"]
WD_EN = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
for lv, span in enumerate([0, 1, 3, 10, 30, 80, 150, 300, 600, 1000], 1):
    y = 2026 + rng.choice([-1, 1]) * span if span else 2026
    d = date(y, rng.randint(1, 12), rng.randint(1, 28))
    w = d.weekday()
    ladder(M, "요일", lv, f"그레고리력으로 {d.year}년 {d.month}월 {d.day}일은 무슨 요일인가?", WD[w], kind="str",
           accept=[WD[w][0], WD_EN[w], WD_EN[w][:3]], why=f"2026년에서 약 {span}년 떨어짐")

# (3) 글자 세기: 문자열 길이 15 ~ 240
for lv, n in enumerate([15, 30, 50, 75, 100, 130, 160, 190, 215, 240], 1):
    s = "".join(rng.choice("ab") for _ in range(n))
    ladder(C, "글자세기", lv, f"다음 문자열에서 글자 a 는 몇 번 나오는가?\n{s}", s.count("a"), why=f"길이 {n}")

# (4) 코드 추적: 선형 합동 생성기를 n번 반복
for lv, n in enumerate([1, 2, 3, 4, 6, 8, 10, 13, 16, 20], 1):
    x0, a, c, m = rng.randrange(1, 90), rng.randrange(3, 40), rng.randrange(1, 60), rng.randrange(97, 1000)
    code = f"x = {x0}\nfor _ in range({n}):\n    x = (x * {a} + {c}) % {m}\nprint(x)"
    ladder(C, "코드추적", lv, f"다음 파이썬 코드를 실행하면 무엇이 출력되는가?\n```python\n{code}\n```", run_py(code),
           why=f"반복 {n}번")

# (5)(6) 1차 사다리 결과, 곱셈·요일·코드 추적은 12자리 곱셈까지도 거의 다 맞혔고
# 틀린 답은 글자 세기에서만 나왔다. 세기 유형의 데이터를 늘리기 위해 사다리 2개를 더했다.
for lv, n in enumerate([20, 40, 60, 90, 120, 150, 180, 220, 260, 300], 1):
    s = "".join(rng.choice("0123456789") for _ in range(n))
    ladder(C, "숫자세기", lv, f"다음 숫자열에서 숫자 7 은 몇 번 나오는가?\n{s}", s.count("7"), why=f"길이 {n}")
FRUITS = ["사과", "배", "포도", "감", "귤"]
for lv, n in enumerate([10, 20, 30, 45, 60, 75, 90, 110, 130, 150], 1):
    words = [rng.choice(FRUITS) for _ in range(n)]
    ladder(C, "단어세기", lv, f"다음 목록에서 '감' 은 몇 번 나오는가?\n{', '.join(words)}", words.count("감"),
           why=f"단어 {n}개")

# ───────────────────────── 저장 ─────────────────────────
for i, q in enumerate(Q, 1):
    pre = "M" if q["domain"] == M else "C"
    q["id"] = f"{pre}{sum(1 for x in Q[:i] if x['domain'] == q['domain']):02d}"
    if isinstance(q["answer"], str) and "/" in q["answer"] and q["kind"] == "num":
        pass
out = Path(__file__).with_name("questions.json")
out.write_text(json.dumps(Q, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"{len(Q)} questions -> {out}")
for q in Q:
    print(q["id"], q["type"], repr(q["answer"])[:40])
