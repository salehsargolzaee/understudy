from submission import first_duplicate


def test_finds_first():
    assert first_duplicate([3, 1, 4, 1, 5, 3]) == 1


def test_none_when_distinct():
    assert first_duplicate([1, 2, 3]) is None
    assert first_duplicate([]) is None


def test_strings():
    assert first_duplicate(["a", "b", "a"]) == "a"
