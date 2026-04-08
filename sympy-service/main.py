# sympy-service/main.py
import re
import time
import logging
import sympy
import concurrent.futures
from sympy import oo, S, Interval, Symbol
from sympy.parsing.latex import parse_latex
from sympy.parsing.sympy_parser import parse_expr
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [sympy] %(levelname)-5s %(message)s',
    datefmt='%H:%M:%S',
)
log = logging.getLogger('sympy-service')

app = FastAPI()

class NormalizeRequest(BaseModel):
    latex: str

class NormalizeResponse(BaseModel):
    sympyExpr: str

class EquivalenceRequest(BaseModel):
    exprA: str
    exprB: str

class EquivalenceResponse(BaseModel):
    equivalent: bool
    error: Optional[str] = None

class EvaluateAtPointsRequest(BaseModel):
    exprA: str
    exprB: str
    points: List[float]

_LATEX_SETS = {
    r'\mathbb{R}': 'S.Reals',
    r'\mathbb{Z}': 'S.Integers',
    r'\mathbb{N}': 'S.Naturals',
    r'\mathbb{Q}': 'S.Rationals',
    r'\emptyset':  'S.EmptySet',
    r'\varnothing': 'S.EmptySet',
}

_INFINITY_TOKENS = {r'\infty': oo, r'+\infty': oo, r'-\infty': -oo}

def _parse_bound(s: str):
    s = s.strip()
    if s in _INFINITY_TOKENS:
        return _INFINITY_TOKENS[s]
    return parse_latex(s)

def _try_parse_interval(latex: str):
    m = re.fullmatch(r'([\[\(])\s*(.*?)\s*,\s*(.*?)\s*([\]\)])', latex.strip())
    if not m:
        return None
    l_paren, a_str, b_str, r_paren = m.groups()
    try:
        a = _parse_bound(a_str)
        b = _parse_bound(b_str)
        lo = (l_paren == '(')
        ro = (r_paren == ')')
        return f"Interval({str(a)}, {str(b)}, {sympy.true if lo else sympy.false}, {sympy.true if ro else sympy.false})"
    except Exception:
        return None

def _validate_latex_structure(latex: str) -> None:
    """Raise ValueError if the latex string has obvious structural issues like unmatched braces."""
    if latex.count('{') != latex.count('}'):
        raise ValueError(f"Unmatched braces in LaTeX: {latex!r}")

def latex_to_sympy_str(latex: str) -> str:
    latex = latex.strip()
    if latex in _LATEX_SETS:
        return _LATEX_SETS[latex]
    _validate_latex_structure(latex)
    interval = _try_parse_interval(latex)
    if interval is not None:
        return interval
    expr = parse_latex(latex)
    return str(expr)

_SAFE_LOCALS = {name: getattr(sympy, name) for name in dir(sympy) if not name.startswith('_')}
_SAFE_LOCALS['S'] = S
_SAFE_LOCALS['true'] = sympy.true
_SAFE_LOCALS['false'] = sympy.false

def _parse_sympy_str(expr_str: str):
    if expr_str.startswith('S.'):
        attr = expr_str[2:]
        return getattr(S, attr)
    return parse_expr(expr_str, local_dict=_SAFE_LOCALS, evaluate=True)

@app.post('/normalize', response_model=NormalizeResponse)
def normalize(req: NormalizeRequest):
    t0 = time.perf_counter()
    try:
        result = latex_to_sympy_str(req.latex)
        log.info('normalize  latex=%r  →  %r  (%.1fms)', req.latex, result, (time.perf_counter() - t0) * 1000)
        return NormalizeResponse(sympyExpr=result)
    except Exception as exc:
        log.error('normalize  latex=%r  error=%s  (%.1fms)', req.latex, exc, (time.perf_counter() - t0) * 1000)
        raise HTTPException(status_code=422, detail=str(exc))

def _simplify_diff(a, b):
    """Run in a separate process to allow timeout."""
    diff = sympy.simplify(a - b)
    return diff == 0

@app.post('/check-equivalence', response_model=EquivalenceResponse)
def check_equivalence(req: EquivalenceRequest):
    t0 = time.perf_counter()
    try:
        a = _parse_sympy_str(req.exprA)
        b = _parse_sympy_str(req.exprB)
        if isinstance(a, sympy.Set) and isinstance(b, sympy.Set):
            equivalent = bool(a == b)
            log.info('equivalence  %r == %r  →  %s  set-compare  (%.1fms)', req.exprA, req.exprB, equivalent, (time.perf_counter() - t0) * 1000)
            return EquivalenceResponse(equivalent=equivalent)
        with concurrent.futures.ProcessPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_simplify_diff, a, b)
            try:
                equivalent = future.result(timeout=5)
                log.info('equivalence  %r == %r  →  %s  simplify  (%.1fms)', req.exprA, req.exprB, equivalent, (time.perf_counter() - t0) * 1000)
                return EquivalenceResponse(equivalent=bool(equivalent))
            except concurrent.futures.TimeoutError:
                log.warning('equivalence  %r == %r  →  timeout  (%.1fms)', req.exprA, req.exprB, (time.perf_counter() - t0) * 1000)
                return EquivalenceResponse(equivalent=False, error="simplify timed out")
    except Exception as exc:
        log.error('equivalence  %r == %r  error=%s  (%.1fms)', req.exprA, req.exprB, exc, (time.perf_counter() - t0) * 1000)
        return EquivalenceResponse(equivalent=False, error=str(exc))

@app.post('/evaluate-at-points', response_model=EquivalenceResponse)
def evaluate_at_points(req: EvaluateAtPointsRequest):
    t0 = time.perf_counter()
    try:
        a = _parse_sympy_str(req.exprA)
        b = _parse_sympy_str(req.exprB)
        x = Symbol('x')
        for pt in req.points:
            va = complex(a.subs(x, pt))
            vb = complex(b.subs(x, pt))
            if abs(va - vb) > 1e-9:
                log.info('evaluate-at-points  %r != %r  diverged at x=%s  (%.1fms)', req.exprA, req.exprB, pt, (time.perf_counter() - t0) * 1000)
                return EquivalenceResponse(equivalent=False)
        log.info('evaluate-at-points  %r == %r  →  True  (%.1fms)', req.exprA, req.exprB, (time.perf_counter() - t0) * 1000)
        return EquivalenceResponse(equivalent=True)
    except Exception as exc:
        log.error('evaluate-at-points  %r == %r  error=%s  (%.1fms)', req.exprA, req.exprB, exc, (time.perf_counter() - t0) * 1000)
        return EquivalenceResponse(equivalent=False, error=str(exc))
