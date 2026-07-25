ORDER = ["1", "log n", "n", "n log n", "n^2", "n^3", "2^n"]


def sort_by_growth(funcs):
    for f in funcs:
        if f not in ORDER:
            raise ValueError(f"unknown growth class: {f}")
    return sorted(funcs, key=ORDER.index)
