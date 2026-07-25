# What the learner opens. It must import cleanly and define every name the tests
# import — otherwise pytest collects nothing and the learner sees a crash instead
# of failing tests. Leave the body unimplemented.
#
# Keep the signature and the docstring honest: the brief, the tests and this
# signature all have to agree.


def numeric_derivative(f, x, h=1e-6):
    """Return the central-difference estimate of f'(x).

    (f(x + h) - f(x - h)) / (2 * h)
    """
    raise NotImplementedError
