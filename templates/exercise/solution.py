# The reference answer. It is never sent to the browser — there is deliberately
# no bundler glob for solution.py — and the pull-request check runs the test
# suite against it.
#
# Write it the way you would want a learner to write it: clear over clever.


def numeric_derivative(f, x, h=1e-6):
    return (f(x + h) - f(x - h)) / (2 * h)
