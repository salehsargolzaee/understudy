from submission import classify_growth

NS = [2**k for k in range(10, 21)]
KS = list(range(10, 21))


def test_constant():
    assert classify_growth(NS, [7] * len(NS)) == "constant"


def test_logarithmic():
    # 5 * log2(n): the ratio drifts to 1 but the difference never dies
    assert classify_growth(NS, [5 * k for k in KS]) == "logarithmic"


def test_linear():
    assert classify_growth(NS, [3 * n for n in NS]) == "linear"


def test_linearithmic_is_not_linear():
    # 2 * n * log2(n): the invisible log factor must still be seen
    assert classify_growth(NS, [2 * n * k for n, k in zip(NS, KS)]) == "linearithmic"


def test_quadratic():
    assert classify_growth(NS, [n * n for n in NS]) == "quadratic"


def test_cubic():
    assert classify_growth(NS, [n**3 for n in NS]) == "cubic"


def test_exponential_defeats_floating_point():
    small = [2**k for k in range(4, 15)]
    assert classify_growth(small, [2**n for n in small]) == "exponential"
