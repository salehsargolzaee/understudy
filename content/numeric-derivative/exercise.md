# The derivative, nudged by hand

Before any autograd, a derivative is just a nudge. Implement
`numeric_derivative(f, x, h=1e-6)` using the **central difference**

$$f'(x) \approx \frac{f(x+h) - f(x-h)}{2h}$$

which is far more accurate than the one-sided version for the same `h`.
