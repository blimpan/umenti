# sympy-service/main.py
import re
import sympy
from sympy import oo, S, Interval, Symbol
from sympy.parsing.latex import parse_latex
from sympy.parsing.sympy_parser import parse_expr
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List

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
        return Interval(a, b, left_open=(l_paren == '('), right_open=(r_paren == ')'))
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
        return str(interval)
    expr = parse_latex(latex)
    return str(expr)

_SAFE_LOCALS = {name: getattr(sympy, name) for name in dir(sympy) if not name.startswith('_')}
_SAFE_LOCALS['S'] = S

def _parse_sympy_str(expr_str: str):
    if expr_str.startswith('S.'):
        attr = expr_str[2:]
        return getattr(S, attr)
    return parse_expr(expr_str, local_dict=_SAFE_LOCALS, evaluate=True)

@app.post('/normalize', response_model=NormalizeResponse)
def normalize(req: NormalizeRequest):
    try:
        result = latex_to_sympy_str(req.latex)
        return NormalizeResponse(sympyExpr=result)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc))

@app.post('/check-equivalence', response_model=EquivalenceResponse)
def check_equivalence(req: EquivalenceRequest):
    try:
        a = _parse_sympy_str(req.exprA)
        b = _parse_sympy_str(req.exprB)
        if isinstance(a, sympy.Set) and isinstance(b, sympy.Set):
            return EquivalenceResponse(equivalent=bool(a == b))
        diff = sympy.simplify(a - b)
        return EquivalenceResponse(equivalent=bool(diff == 0))
    except Exception as exc:
        return EquivalenceResponse(equivalent=False, error=str(exc))

@app.post('/evaluate-at-points', response_model=EquivalenceResponse)
def evaluate_at_points(req: EvaluateAtPointsRequest):
    try:
        a = _parse_sympy_str(req.exprA)
        b = _parse_sympy_str(req.exprB)
        x = Symbol('x')
        for pt in req.points:
            va = complex(a.subs(x, pt))
            vb = complex(b.subs(x, pt))
            if abs(va - vb) > 1e-9:
                return EquivalenceResponse(equivalent=False)
        return EquivalenceResponse(equivalent=True)
    except Exception as exc:
        return EquivalenceResponse(equivalent=False, error=str(exc))
