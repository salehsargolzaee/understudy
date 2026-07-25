import math

from submission import backward

f = lambda a, b, c: math.tanh(a * b + c)


def numeric(fn, a, b, c, i, h=1e-6):
    args = [a, b, c]
    up, dn = list(args), list(args)
    up[i] += h
    dn[i] -= h
    return (fn(*up) - fn(*dn)) / (2 * h)


def test_matches_numeric():
    a, b, c = 0.7, -1.3, 0.25
    g = backward(a, b, c)
    for i, k in enumerate("abc"):
        assert abs(g[k] - numeric(f, a, b, c, i)) < 1e-5


def test_saturated_region_is_flat():
    g = backward(5.0, 5.0, 0.0)
    assert abs(g["c"]) < 1e-6
