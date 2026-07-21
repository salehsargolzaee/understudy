from submission import running_total


def test_basic():
    assert running_total([1, 2, 3]) == [1, 3, 6]


def test_empty():
    assert running_total([]) == []


def test_negatives():
    assert running_total([5, -2, -1]) == [5, 3, 2]


def test_single():
    assert running_total([42]) == [42]
