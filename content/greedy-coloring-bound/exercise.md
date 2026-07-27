# Greedy coloring and the $\Delta + 1$ bound

A **proper coloring** assigns a color to every vertex so that no edge has both
ends the same color. The greedy algorithm is the obvious thing: fix an order of
the vertices, walk it, and give each vertex the smallest color that none of its
already-colored neighbors is using.

The lecture uses this to get its first bound. A vertex has at most $\Delta$
neighbors, so at the moment you color it, at most $\Delta$ colors are blocked —
one of the colors $0, 1, \dots, \Delta$ must be free. So every graph satisfies

$$\chi(G) \le \Delta(G) + 1$$

What the bound does *not* say is that greedy is any good. The order matters, and
a bad order can be arbitrarily bad on a graph that a good order colors in two.
Building that gap yourself is the point of this exercise.

## What to implement

```python
def greedy_coloring(graph, order):
    ...
```

`graph` is an adjacency mapping: `{vertex: iterable_of_neighbors}`. It is
undirected and consistent — if `v` is in `graph[u]` then `u` is in `graph[v]` —
with no self-loops. `order` is a list containing every vertex of the graph
exactly once.

Walk `order` in the given sequence. Give each vertex the smallest non-negative
integer not already assigned to one of its neighbors. Neighbors later in the
order have no color yet and constrain nothing.

Return a `dict` mapping every vertex to its integer color.

Also implement:

```python
def max_degree(graph):
    ...
```

returning $\Delta(G)$, the largest number of neighbors any vertex has. An empty
graph has max degree `0`.

## Worked example

For the path `a — b — c` with `order = ["a", "b", "c"]`:

| step | vertex | neighbor colors | smallest free | 
| --- | --- | --- | --- |
| 1 | `a` | none colored yet | `0` |
| 2 | `b` | `{0}` from `a` | `1` |
| 3 | `c` | `{1}` from `b` | `0` |

giving `{"a": 0, "b": 1, "c": 0}`.

## Edge cases

- An empty graph returns an empty dict.
- An isolated vertex always gets color `0`.
- Colors are integers starting at `0`, and "smallest free" means smallest in
  the usual order on the non-negative integers — not the smallest unused so far
  in the whole graph.
- Vertices may be any hashable value, and `graph[v]` may be a `list`, a `set`,
  or any iterable. Do not assume it is sorted.
