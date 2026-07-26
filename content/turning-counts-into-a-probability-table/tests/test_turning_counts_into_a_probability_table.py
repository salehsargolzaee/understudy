from submission import normalize_rows


def test_basic():
    got = normalize_rows([[1, 3]])
    assert abs(got[0][0] - 0.25) < 1e-9
    assert abs(got[0][1] - 0.75) < 1e-9


def test_zero_row_is_uniform():
    got = normalize_rows([[0, 0, 0]])
    assert all(abs(v - 1 / 3) < 1e-9 for v in got[0])


def test_rows_sum_to_one():
    for row in normalize_rows([[2, 2, 4], [0, 1, 0]]):
        assert abs(sum(row) - 1.0) < 1e-9
