from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

class TestNormalize:
    def test_standard_expression(self):
        r = client.post('/normalize', json={'latex': r'2 \cdot 3^{x}'})
        assert r.status_code == 200
        assert 'sympyExpr' in r.json()

    def test_real_number_set(self):
        r = client.post('/normalize', json={'latex': r'\mathbb{R}'})
        assert r.status_code == 200
        assert r.json()['sympyExpr'] == 'S.Reals'

    def test_open_interval(self):
        r = client.post('/normalize', json={'latex': r'(0, \infty)'})
        assert r.status_code == 200
        assert 'Interval' in r.json()['sympyExpr']

    def test_closed_interval(self):
        r = client.post('/normalize', json={'latex': r'[0, 1]'})
        assert r.status_code == 200
        assert 'Interval' in r.json()['sympyExpr']

    def test_invalid_latex_returns_422(self):
        r = client.post('/normalize', json={'latex': r'\notacommand{'})
        assert r.status_code == 422

class TestCheckEquivalence:
    def test_identical_expressions(self):
        r = client.post('/check-equivalence', json={'exprA': '2*3**x', 'exprB': '2*3**x'})
        assert r.status_code == 200
        assert r.json()['equivalent'] is True

    def test_algebraically_equal_expressions(self):
        r = client.post('/check-equivalence', json={
            'exprA': 'x**2 + 2*x + 1',
            'exprB': '(x + 1)**2',
        })
        assert r.status_code == 200
        assert r.json()['equivalent'] is True

    def test_unequal_expressions(self):
        r = client.post('/check-equivalence', json={'exprA': '2*x', 'exprB': '3*x'})
        assert r.status_code == 200
        assert r.json()['equivalent'] is False

    def test_equal_sets(self):
        r = client.post('/check-equivalence', json={'exprA': 'S.Reals', 'exprB': 'S.Reals'})
        assert r.status_code == 200
        assert r.json()['equivalent'] is True

class TestEvaluateAtPoints:
    def test_equal_functions_at_points(self):
        r = client.post('/evaluate-at-points', json={
            'exprA': '2*3**x',
            'exprB': '2*3**x',
            'points': [0, 1, 2],
        })
        assert r.status_code == 200
        assert r.json()['equivalent'] is True

    def test_unequal_functions_at_points(self):
        r = client.post('/evaluate-at-points', json={
            'exprA': '2*x',
            'exprB': '3*x',
            'points': [1, 2, 3],
        })
        assert r.status_code == 200
        assert r.json()['equivalent'] is False
