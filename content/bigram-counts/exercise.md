# Counting character bigrams

The whole makemore bigram model starts as a tally. Implement
`bigram_counts(words)`: pad every word with `"."` on both ends, then count every
adjacent character pair.

Return a dict mapping the tuple `(first, second)` to its count.
