# Which curve is it?

The lecture names the growth classes worth caring about: constant,
logarithmic, linear, linearithmic, quadratic, polynomial, exponential. Here is
how you *detect* them in the wild, with no formula in hand: double the input
and watch what the cost does.

$$\frac{f(2n)}{f(n)} \;\longrightarrow\; \begin{cases} 1 & f = c \text{ (and the difference is } 0\text{)}\\ 1 & f = c\log n \text{ (but the difference stays } c\text{)}\\ 2 & f = cn \\ 2 + \varepsilon & f = cn\log n \\ 4 & f = cn^2 \\ 8 & f = cn^3 \\ \text{huge} & f = c^n \end{cases}$$

That $2$ versus $2+\varepsilon$ gap is exactly why the lecture calls log
factors nearly invisible: doubling $n$ multiplies $n\log n$ by
$2\,(1 + 1/\log_2 n)$ — barely more than linear, and the excess shrinks as
$n$ grows.

Implement `classify_growth(ns, counts)`. You are handed measurements from a
counting experiment: `ns` is a doubling ladder of input sizes (powers of two,
each twice the last), and `counts[i]` is the exact number of operations some
mystery algorithm performed on input size `ns[i]`. The constant factors are
unknown. Return one of

`"constant"`, `"logarithmic"`, `"linear"`, `"linearithmic"`, `"quadratic"`,
`"cubic"`, `"exponential"`

Two warnings from the trenches. Exponential counts get astronomically large,
far beyond what floating point can hold — compare with integer arithmetic, not
by dividing. And the classes neighbouring a ratio of $2$ are the whole
difficulty: make sure your rule tells $cn$ from $cn\log n$ before you trust
it.

This is also a genuinely useful trick: time your own code at doubling sizes
and you can read its complexity off the ratios the same way.
