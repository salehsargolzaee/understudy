# Counting character bigrams

The whole makemore bigram model starts as a tally: which character tends to
follow which. The word `"ava"`, padded, contributes four pairs:

```
(".", "a")  ("a", "v")  ("v", "a")  ("a", ".")
```

The padding token is doing real work — it lets the model learn which
characters *start* names and which characters *end* them, as ordinary pairs.
The lecture first uses two special tokens, `<S>` and `<E>`, then collapses
them into a single `"."` because a start token can never follow anything and
an end token can never precede anything, so one symbol covers both jobs. Use
the dot version.

Implement `bigram_counts(words)`: pad every word with `"."` on both ends, then
count every adjacent character pair across all words.

Return a dict mapping the tuple `(first, second)` to its count. Words can
repeat and their counts accumulate; an empty word list gives an empty dict.
