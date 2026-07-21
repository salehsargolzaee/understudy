import pandas as pd

from submission import column_means


def test_means():
    df = pd.DataFrame({"x": [1, 2, 3], "y": [4, 6, 8]})
    result = column_means(df)
    assert result["x"] == 2
    assert result["y"] == 6


def test_keys():
    df = pd.DataFrame({"a": [0, 10], "b": [1, 1]})
    result = column_means(df)
    assert set(result.keys()) == {"a", "b"}
    assert result["b"] == 1
