def normalize_rows(rows):
    out = []
    for row in rows:
        total = sum(row)
        if total == 0:
            out.append([1 / len(row)] * len(row) if row else [])
        else:
            out.append([v / total for v in row])
    return out
