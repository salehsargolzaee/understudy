from itertools import combinations

from submission import balanced_complete_bipartite, is_triangle_free, mantel_max_edges


def complete(n):
    return {v: [u for u in range(n) if u != v] for v in range(n)}


def cycle(n):
    return {v: [(v - 1) % n, (v + 1) % n] for v in range(n)}


def edge_count(graph):
    return sum(len(set(ns)) for ns in graph.values()) // 2


def test_triangle_is_not_triangle_free():
    assert is_triangle_free(complete(3)) is False


def test_short_cycles():
    assert is_triangle_free(cycle(4)) is True
    assert is_triangle_free(cycle(5)) is True
    assert is_triangle_free(cycle(6)) is True


def test_too_small_to_hold_a_triangle():
    assert is_triangle_free({}) is True
    assert is_triangle_free({"only": []}) is True
    assert is_triangle_free({"a": ["b"], "b": ["a"]}) is True


def test_a_triangle_hidden_in_a_larger_graph_is_still_found():
    # a long path with one chord closing a triangle at the far end
    graph = {i: [] for i in range(8)}
    for i in range(7):
        graph[i].append(i + 1)
        graph[i + 1].append(i)
    graph[5].append(7)
    graph[7].append(5)
    assert is_triangle_free(graph) is False


def test_vertices_need_not_be_integers():
    graph = {"x": {"y", "z"}, "y": {"x", "z"}, "z": {"x", "y"}}
    assert is_triangle_free(graph) is False


def test_mantel_values():
    assert [mantel_max_edges(n) for n in range(7)] == [0, 0, 1, 2, 4, 6, 9]


def test_mantel_matches_brute_force_on_small_graphs():
    # the largest triangle-free graph on n <= 5 vertices, found exhaustively
    for n in range(2, 6):
        pairs = list(combinations(range(n), 2))
        best = 0
        for mask in range(1 << len(pairs)):
            chosen = [p for i, p in enumerate(pairs) if mask >> i & 1]
            if len(chosen) <= best:
                continue
            graph = {v: [] for v in range(n)}
            for u, v in chosen:
                graph[u].append(v)
                graph[v].append(u)
            if is_triangle_free(graph):
                best = len(chosen)
        assert best == mantel_max_edges(n), f"n={n}"


def test_the_extremal_graph_is_built_correctly():
    assert balanced_complete_bipartite(0) == {}
    assert balanced_complete_bipartite(1) == {0: []}
    graph = balanced_complete_bipartite(5)
    assert set(graph) == {0, 1, 2, 3, 4}
    assert set(graph[0]) == {3, 4}
    assert set(graph[3]) == {0, 1, 2}


def test_the_extremal_graph_is_triangle_free_and_achieves_the_bound():
    for n in range(7):
        graph = balanced_complete_bipartite(n)
        assert is_triangle_free(graph) is True, f"n={n}"
        assert edge_count(graph) == mantel_max_edges(n), f"n={n}"


def test_adding_any_edge_to_the_extremal_graph_creates_a_triangle():
    for n in (4, 5, 6):
        base = balanced_complete_bipartite(n)
        missing = [
            (u, v) for u, v in combinations(range(n), 2) if v not in set(base[u])
        ]
        assert missing, f"n={n} should still be missing some edge"
        for u, v in missing:
            graph = {w: list(ns) for w, ns in base.items()}
            graph[u].append(v)
            graph[v].append(u)
            assert is_triangle_free(graph) is False, f"n={n}, added {u}-{v}"
