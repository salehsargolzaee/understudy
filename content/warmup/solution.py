def running_total(xs):
    out = []
    total = 0
    for x in xs:
        total += x
        out.append(total)
    return out
