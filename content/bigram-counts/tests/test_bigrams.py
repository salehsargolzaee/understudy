from submission import bigram_counts


def test_single_word():
    assert bigram_counts(["ab"]) == {(".", "a"): 1, ("a", "b"): 1, ("b", "."): 1}


def test_accumulates():
    got = bigram_counts(["emma", "emmy"])
    assert got[(".", "e")] == 2
    assert got[("m", "m")] == 2
    assert got[("a", ".")] == 1


def test_empty():
    assert bigram_counts([]) == {}
