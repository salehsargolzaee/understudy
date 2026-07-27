def turan_parts(n, r):
    """The r part sizes of the Turan graph T(n, r), sorted ascending."""
    quotient, remainder = divmod(n, r)
    return [quotient] * (r - remainder) + [quotient + 1] * remainder


def turan_edges(n, r):
    """The number of edges of T(n, r)."""
    inside = sum(size * size for size in turan_parts(n, r))
    return (n * n - inside) // 2
