from itertools import islice, permutations

from submission import greedy_coloring, max_degree


def edges_of(graph):
    """Each undirected edge once."""
    return {frozenset((u, v)) for u, ns in graph.items() for v in ns}


def is_proper(graph, coloring):
    return all(coloring[u] != coloring[v] for u, v in map(tuple, edges_of(graph)))


PATH = {"a": ["b"], "b": ["a", "c"], "c": ["b"]}

# K4: every pair adjacent, so no two vertices may share a color
K4 = {v: [u for u in "wxyz" if u != v] for v in "wxyz"}

# The crown on 4+4: a_i adjacent to b_j exactly when i != j. It is bipartite,
# so two colors suffice — but the interleaved order defeats greedy completely.
CROWN = {}
for i in range(4):
    CROWN[f"a{i}"] = [f"b{j}" for j in range(4) if j != i]
    CROWN[f"b{i}"] = [f"a{j}" for j in range(4) if j != i]


def test_path_example_from_the_brief():
    assert greedy_coloring(PATH, ["a", "b", "c"]) == {"a": 0, "b": 1, "c": 0}


def test_empty_graph():
    assert greedy_coloring({}, []) == {}
    assert max_degree({}) == 0


def test_isolated_vertices_all_take_color_zero():
    graph = {"p": [], "q": [], "r": []}
    assert greedy_coloring(graph, ["p", "q", "r"]) == {"p": 0, "q": 0, "r": 0}


def test_complete_graph_uses_a_different_color_for_every_vertex():
    coloring = greedy_coloring(K4, list("wxyz"))
    assert sorted(coloring.values()) == [0, 1, 2, 3]


def test_colors_start_at_zero_and_pick_the_smallest_gap():
    # d sees colors {0, 2}, so the smallest free color is 1, not 3
    graph = {"a": ["d"], "b": ["d"], "c": ["d", "a"], "d": ["a", "b", "c"]}
    coloring = greedy_coloring(graph, ["a", "b", "c", "d"])
    assert coloring == {"a": 0, "b": 0, "c": 1, "d": 2}


def test_result_is_always_a_proper_coloring():
    for order in permutations(["a", "b", "c"]):
        assert is_proper(PATH, greedy_coloring(PATH, list(order)))
    for order in permutations("wxyz"):
        assert is_proper(K4, greedy_coloring(K4, list(order)))


def test_never_exceeds_max_degree_plus_one():
    for graph in (PATH, K4, CROWN):
        bound = max_degree(graph) + 1
        for order in islice(permutations(sorted(graph)), 24):
            coloring = greedy_coloring(graph, list(order))
            assert max(coloring.values()) + 1 <= bound


def test_the_order_is_what_makes_greedy_good_or_bad():
    bad = [v for i in range(4) for v in (f"a{i}", f"b{i}")]
    good = [f"a{i}" for i in range(4)] + [f"b{i}" for i in range(4)]

    bad_colors = len(set(greedy_coloring(CROWN, bad).values()))
    good_colors = len(set(greedy_coloring(CROWN, good).values()))

    assert good_colors == 2, "one side then the other should need only two colors"
    assert bad_colors == 4, "the interleaved order should need four"


def test_max_degree():
    assert max_degree(PATH) == 2
    assert max_degree(K4) == 3
    assert max_degree({"lonely": []}) == 0


def test_neighbors_may_be_any_iterable_in_any_order():
    as_sets = {"a": {"c", "b"}, "b": {"a"}, "c": {"a"}}
    coloring = greedy_coloring(as_sets, ["a", "b", "c"])
    assert coloring == {"a": 0, "b": 1, "c": 1}
    assert max_degree(as_sets) == 2
