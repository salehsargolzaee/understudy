def classify_growth(ns, counts):
    a, b = counts[-2], counts[-1]  # the final doubling tells the story
    if b >= 16 * a:
        return "exponential"
    if b >= 6 * a:
        return "cubic"
    if b >= 3 * a:
        return "quadratic"
    if 50 * b >= 101 * a:  # ratio at least 2.02: the log excess over linear
        return "linearithmic"
    if 10 * b >= 17 * a:
        return "linear"
    return "logarithmic" if b > a else "constant"
