# Tests import the learner's code as `submission` — never as `solution`.
#
# At run time the workspace is:
#   submission.py    the learner's editor buffer
#   tests/…          this file
#   data/…           anything you shipped in data/
# and the working directory is the root, so data is read as "data/<name>".
#
# Write tests that teach. The check enforces that this suite fails on the starter
# and passes on the solution; it cannot tell whether it would catch a *wrong*
# answer. Cover the real traps. Keep it deterministic: no clocks, no unseeded
# randomness, no dict-ordering assumptions, `pytest.approx` for floats.

import math

import pytest

from submission import numeric_derivative


def test_polynomial():
    assert numeric_derivative(lambda x: x ** 3, 2.0) == pytest.approx(12.0, abs=1e-4)


def test_constant_function_is_flat():
    assert numeric_derivative(lambda x: 7.0, -3.0) == pytest.approx(0.0, abs=1e-9)


def test_works_on_a_builtin_function():
    assert numeric_derivative(math.sin, 0.0) == pytest.approx(1.0, abs=1e-6)


def test_step_size_is_honoured():
    # central difference is exact for quadratics, even with a coarse step —
    # a forward-difference implementation fails this one
    assert numeric_derivative(lambda x: x ** 2, 1.0, h=0.5) == pytest.approx(2.0, abs=1e-9)


def test_symmetry_at_a_kink():
    # abs() has no derivative at 0; the symmetric estimate is 0 anyway
    assert numeric_derivative(abs, 0.0) == pytest.approx(0.0, abs=1e-9)
```

---

## 8. App changes
