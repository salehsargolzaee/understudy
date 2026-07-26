# Counts → probabilities, row by row

A row of counts becomes a probability distribution by dividing each entry by
its row sum:

$$P_{ij} = \frac{N_{ij}}{\sum_k N_{ik}}$$

This is exactly how the bigram count table turns into "given this character,
how likely is each next character".

Implement `normalize_rows(rows)`. Each row is a list of non-negative counts;
return a new table where every row sums to `1`.

An all-zero row has no evidence at all, so return a **uniform** row for it
rather than dividing by zero.
