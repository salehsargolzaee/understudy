from submission import backward


def test_karpathy_point():
    g = backward(2.0, -3.0, 10.0)
    assert abs(g["a"] - (-3.0)) < 1e-9
    assert abs(g["b"] - 2.0) < 1e-9
    assert abs(g["c"] - 1.0) < 1e-9


def test_matches_numeric():
    h = 1e-6
    a, b, c = 1.5, 4.0, -2.0
    f = lambda x, y, z: x * y + z
    g = backward(a, b, c)
    assert abs(g["a"] - (f(a + h, b, c) - f(a - h, b, c)) / (2 * h)) < 1e-4
    assert abs(g["b"] - (f(a, b + h, c) - f(a, b - h, c)) / (2 * h)) < 1e-4
