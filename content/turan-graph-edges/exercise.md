# Counting the edges of a Turán graph

Mantel's theorem forbade a triangle. Turán's theorem forbids a larger clique:
how many edges can a graph on $n$ vertices have with no $K_{r+1}$?

The extremal graph generalises the balanced bipartite one in the obvious way.
The **Turán graph** $T(n, r)$ is the complete $r$-partite graph whose parts are
as equal as possible: split the vertices into $r$ groups differing in size by at
most one, put no edges inside a group, and every edge between groups. It has no
$K_{r+1}$, because a clique can use at most one vertex per part. The Turán
number $\operatorname{ex}(n, K_{r+1})$ is its edge count.

Writing $n = qr + s$ with $0 \le s < r$, the parts are $s$ of size $q+1$ and
$r - s$ of size $q$. Counting edges is then a complement argument — every pair
is an edge *except* the pairs sitting inside a part:

$$e(T(n,r)) = \binom{n}{2} - \sum_{i=1}^{r} \binom{n_i}{2}
            = \frac{n^2 - \sum_i n_i^2}{2}$$

## What to implement

```python
def turan_parts(n, r):
    ...
```

Return the part sizes of $T(n, r)$ as a list of exactly `r` integers, sorted
ascending. Assume `n >= 0` and `r >= 1`. When `r > n` some parts are empty, and
a size of `0` still counts as a part.

```python
def turan_edges(n, r):
    ...
```

Return the number of edges of $T(n, r)$.

## Worked examples

$T(10, 3)$ splits as $4 + 3 + 3$, so `turan_parts(10, 3) == [3, 3, 4]` and

$$e = \frac{100 - (9 + 9 + 16)}{2} = 33$$

$T(5, 3)$ splits as $2 + 2 + 1$, giving `[1, 2, 2]` and $8$ edges.

## Two sanity checks worth knowing

- At $r = 2$ this must reproduce Mantel: $e(T(n,2)) = \lfloor n^2/4 \rfloor$.
- Once $r \ge n$ every part holds at most one vertex, nothing is forbidden, and
  $T(n,r)$ is the complete graph $K_n$ with $\binom{n}{2}$ edges.

## Edge cases

- `n = 0` gives `r` empty parts and `0` edges.
- `r = 1` puts everything in one part: an independent set, `0` edges.
- The returned list must always have length exactly `r`, zeros included.
