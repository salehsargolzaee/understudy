import math


def backward(a, b, c):
    t = math.tanh(a * b + c)
    local = 1 - t * t
    return {"a": local * b, "b": local * a, "c": local}
