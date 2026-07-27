def is_triangle_free(graph):
    """True when no three mutually adjacent vertices exist."""
    neighbors = {v: set(ns) for v, ns in graph.items()}
    for v, vs in neighbors.items():
        for u in vs:
            # a triangle through the edge v-u is a shared neighbor
            if neighbors.get(u, set()) & vs:
                return False
    return True


def mantel_max_edges(n):
    """The most edges a triangle-free graph on n vertices can have."""
    return (n * n) // 4


def balanced_complete_bipartite(n):
    """The extremal graph on 0..n-1, as an adjacency mapping."""
    left = list(range(-(-n // 2)))
    right = list(range(len(left), n))
    graph = {v: list(right) for v in left}
    graph.update({v: list(left) for v in right})
    return graph
