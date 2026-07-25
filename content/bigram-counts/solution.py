def bigram_counts(words):
    counts = {}
    for w in words:
        chs = ["."] + list(w) + ["."]
        for a, b in zip(chs, chs[1:]):
            counts[(a, b)] = counts.get((a, b), 0) + 1
    return counts
