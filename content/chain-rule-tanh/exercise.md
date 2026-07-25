# Chain rule through a tanh neuron

Now put a squashing function on top:

$$L = \tanh(a \cdot b + c), \qquad \frac{d}{dz}\tanh(z) = 1 - \tanh^2(z)$$

Implement `backward(a, b, c)` returning `{"a": …, "b": …, "c": …}`. Compute the
local derivative of `tanh` once, then multiply it into each upstream gradient —
exactly the move the lecture keeps repeating.
