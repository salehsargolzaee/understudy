def greedy_coloring(graph, order):
    """Color the vertices in `order`, each with the smallest color no already
    colored neighbor is using. Return {vertex: color}."""
    coloring = {}
    for vertex in order:
        taken = {coloring[n] for n in graph[vertex] if n in coloring}
        color = 0
        while color in taken:
            color += 1
        coloring[vertex] = color
    return coloring


def max_degree(graph):
    """Return the largest number of neighbors any vertex has. 0 if empty."""
    return max((len(set(neighbors)) for neighbors in graph.values()), default=0)
