# Backprop through `a*b + c`, by hand

Let

$$L = a \cdot b + c$$

Implement `backward(a, b, c)` returning `{"a": …, "b": …, "c": …}`: the partial
derivative of `L` with respect to each input, evaluated at the given point.

No loops, no library — just the three derivatives you can read straight off the
expression.
