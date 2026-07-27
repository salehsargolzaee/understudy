# Mantel's theorem: the most edges without a triangle

Extremal graph theory asks how much of something you can have before a
structure is forced. The first question of the subject is the simplest one:

> How many edges can a graph on $n$ vertices have if it contains no triangle?

Mantel's answer, and the lecture's starting point, is

$$\operatorname{ex}(n, K_3) = \left\lfloor \frac{n^2}{4} \right\rfloor$$

and the graph that achieves it is the complete bipartite graph with the two
sides as equal as possible: $K_{\lceil n/2 \rceil, \lfloor n/2 \rfloor}$. Every
edge crosses between the sides, and a triangle would need two of its three
vertices on the same side — where there are no edges at all.

The bound is tight in a strong sense: that graph has no triangle, and adding
*any* new edge to it creates one immediately. This exercise builds both halves
so you can watch that happen.

## What to implement

```python
def is_triangle_free(graph):
    ...
```

`graph` is an adjacency mapping, `{vertex: iterable_of_neighbors}`, undirected
and consistent, with no self-loops. Return `True` when no three mutually
adjacent vertices exist, `False` otherwise.

```python
def mantel_max_edges(n):
    ...
```

Return the largest number of edges a triangle-free graph on `n` vertices can
have, for any integer `n >= 0`.

```python
def balanced_complete_bipartite(n):
    ...
```

Return the extremal graph itself on vertices `0, 1, ..., n - 1`, as an adjacency
mapping in the same format: put `0, 1, ..., ceil(n/2) - 1` on one side and the
rest on the other, and join every pair across the two sides. Every vertex must
appear as a key, including when it has no neighbors.

## Worked example

For $n = 5$ the sides are `{0, 1, 2}` and `{3, 4}`, giving $3 \times 2 = 6$
edges — and $\lfloor 25/4 \rfloor = 6$, so this graph is extremal.

| $n$ | 0 | 1 | 2 | 3 | 4 | 5 | 6 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| $\lfloor n^2/4 \rfloor$ | 0 | 0 | 1 | 2 | 4 | 6 | 9 |

## Edge cases

- `n = 0` gives an empty graph and `0` edges; `n = 1` gives one isolated vertex.
- A graph with fewer than three vertices is always triangle-free.
- `graph[v]` may be a `list` or a `set`, in any order.
- Do not assume vertices are integers in `is_triangle_free` — they are only in
  the graph you build yourself.
