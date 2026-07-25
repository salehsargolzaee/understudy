import math

from submission import numeric_derivative


def test_quadratic():
    assert abs(numeric_derivative(lambda x: x ** 2, 3.0) - 6.0) < 1e-4


def test_sine():
    assert abs(numeric_derivative(math.sin, 0.0) - 1.0) < 1e-6


def test_central_not_forward():
    # a forward difference on x**2 at x=1 with h=0.1 gives 2.1; central gives 2.0
    got = numeric_derivative(lambda x: x ** 2, 1.0, h=0.1)
    assert abs(got - 2.0) < 1e-9
