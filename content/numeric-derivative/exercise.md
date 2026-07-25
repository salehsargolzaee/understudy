# The derivative, nudged by hand

Before any autograd, a derivative is just a nudge: bump the input, watch the
output. Implement `numeric_derivative(f, x, h=1e-6)` using the **central
difference**

$$f'(x) \approx \frac{f(x+h) - f(x-h)}{2h}$$

Why nudge on *both* sides? Taylor-expand and the even error terms cancel:

$$f(x \pm h) = f(x) \pm h f'(x) + \frac{h^2}{2} f''(x) \pm \frac{h^3}{6} f'''(x) + \cdots$$

Subtracting kills the $f''$ term entirely, so the one-sided estimate is off by
$O(h)$ while the central one is off by $O(h^2)$ — for $h = 10^{-6}$, that is
roughly a million times more accurate, for free.

The lecture also warns you the other way: too *small* an `h` and floating
point eats your digits. `1e-6` sits comfortably between the two failure modes.
