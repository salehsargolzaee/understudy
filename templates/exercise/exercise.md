<!--
The brief the learner reads. Markdown: GitHub tables, fenced code, and $…$ /
$$…$$ maths all render.

Say what to implement, what the inputs look like, what to return, and what the
edge cases are. Do not narrate the algorithm — the lecture just did. A learner
should be able to finish this from the brief alone, without opening the tests.

The first heading is the title of the reading pane. Delete these comments.
-->

# Numerical derivative

A derivative is a limit, but a computer can only take small steps. The **central
difference** estimate of $f'(x)$ uses one step forward and one step back:

$$f'(x) \approx \frac{f(x + h) - f(x - h)}{2h}$$

Implement `numeric_derivative(f, x, h=1e-6)`:

| argument | meaning |
| --- | --- |
| `f` | a function taking one float and returning a float |
| `x` | the point to differentiate at |
| `h` | the step size; default `1e-6` |

Return the central-difference estimate as a float. Use the formula exactly as
written — the forward difference `(f(x + h) - f(x)) / h` is a different estimate
and gives different answers.

```python
numeric_derivative(lambda x: x ** 2, 3.0)   # -> 6.000000...
numeric_derivative(math.sin, 0.0)           # -> 0.999999...
```

Two things to notice while you write it: the estimate is exact for polynomials up
to degree two no matter how large `h` is, and a function with a kink (like
`abs`) still returns a number here — the symmetry of the formula hides the fact
that the derivative does not exist.
