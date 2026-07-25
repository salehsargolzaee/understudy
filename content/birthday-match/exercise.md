# The birthday match, made fast

The lecture's running problem: does any pair of students in the room share a
birthday? The algorithm proposed from the floor, and then proved correct by
induction, is:

> Maintain a record. Interview students in some order. For each student, check
> whether their birthday is already in the record; if it is, return the pair.
> Otherwise add them to the record and move on. If you run out of students,
> return that there is none.

Implement it as `first_birthday_match(students)`, with two things the
blackboard version glosses over:

**Birthdays are dates, not tokens.** Each student is a `(name, "YYYY-MM-DD")`
pair, and two students match when they share a birthday — the *year is
irrelevant*. `"1999-03-14"` matches `"1984-03-14"`. February 29 is its own
birthday, not March 1.

**The record's data structure is the whole ballgame.** If the record is a
plain list, the check for student $k$ scans up to $k-1$ entries, and the whole
interview costs

$$\sum_{k=1}^{n}(k-1) = \frac{n(n-1)}{2}$$

comparisons — quadratic. Use a record with constant-time membership instead,
so the entire class is a single pass. Your function should comfortably handle
a lecture hall of thousands.

Return the matching pair as a tuple, in interview order: the student already
in the record first, then the student whose interview completed the match. The
first match that *completes* wins. No match: return `None`.
