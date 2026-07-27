from itertools import combinations

from submission import turan_edges, turan_parts


def build_turan(n, r):
    """The complete r-partite graph from the part sizes, as an edge set."""
    parts, seen = [], 0
    for size in turan_parts(n, r):
        parts.append(list(range(seen, seen + size)))
        seen += size
    return {
        frozenset((u, v))
        for i, a in enumerate(parts)
        for b in parts[i + 1 :]
        for u in a
        for v in b
    }


def test_worked_examples_from_the_brief():
    assert turan_parts(10, 3) == [3, 3, 4]
    assert turan_edges(10, 3) == 33
    assert turan_parts(5, 3) == [1, 2, 2]
    assert turan_edges(5, 3) == 8


def test_parts_are_balanced_and_complete():
    for n in range(0, 15):
        for r in range(1, 6):
            parts = turan_parts(n, r)
            assert len(parts) == r, f"T({n},{r}) must report exactly r parts"
            assert sum(parts) == n, f"T({n},{r}) must use every vertex"
            assert parts == sorted(parts), "parts must be sorted ascending"
            assert max(parts) - min(parts) <= 1, "parts differ by at most one"


def test_r_equals_two_reproduces_mantel():
    for n in range(0, 12):
        assert turan_edges(n, 2) == (n * n) // 4, f"n={n}"


def test_one_part_is_an_independent_set():
    for n in range(0, 8):
        assert turan_parts(n, 1) == [n]
        assert turan_edges(n, 1) == 0


def test_more_parts_than_vertices_gives_the_complete_graph():
    for n in range(0, 7):
        for r in range(n, n + 4):
            if r < 1:
                continue
            assert turan_edges(n, r) == n * (n - 1) // 2, f"n={n}, r={r}"


def test_empty_graph():
    assert turan_parts(0, 4) == [0, 0, 0, 0]
    assert turan_edges(0, 4) == 0


def test_edge_count_matches_the_graph_actually_built():
    for n in range(0, 11):
        for r in range(1, 5):
            assert turan_edges(n, r) == len(build_turan(n, r)), f"n={n}, r={r}"


def test_the_turan_graph_contains_no_clique_on_r_plus_one_vertices():
    for n, r in [(6, 2), (7, 3), (9, 3), (8, 4)]:
        edges = build_turan(n, r)
        for clique in combinations(range(n), r + 1):
            assert not all(
                frozenset(pair) in edges for pair in combinations(clique, 2)
            ), f"T({n},{r}) should have no K{r + 1}"


def test_adding_a_vertex_never_loses_edges():
    for r in (2, 3, 4):
        counts = [turan_edges(n, r) for n in range(12)]
        assert counts == sorted(counts), f"r={r} should be non-decreasing in n"
