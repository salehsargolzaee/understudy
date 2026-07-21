# Placeholder: column means

> ⚠️ **Placeholder exercise.** It exists to stress data + math rendering.

You're given a small dataset `points.csv` with these columns:

| column | meaning         |
| ------ | --------------- |
| `x`    | horizontal position |
| `y`    | vertical position   |

Implement `column_means(df)` that returns a dict mapping each column name to its
mean. The mean of a column is

$$\bar{x} = \frac{1}{n} \sum_{i=1}^{n} x_i$$

and for a small two-column example the whole operation looks like

$$\begin{bmatrix} 1 & 4 \\ 2 & 6 \\ 3 & 8 \end{bmatrix} \longrightarrow \{\, x: 2,\ y: 6 \,\}$$
