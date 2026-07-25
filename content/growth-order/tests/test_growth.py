import pytest

from submission import sort_by_growth


def test_orders():
    assert sort_by_growth(["n^2", "1", "n log n"]) == ["1", "n log n", "n^2"]


def test_keeps_duplicates():
    assert sort_by_growth(["n", "n", "log n"]) == ["log n", "n", "n"]


def test_rejects_unknown():
    with pytest.raises(ValueError):
        sort_by_growth(["n!"])
