from submission import first_birthday_match


def test_match_ignores_the_year():
    students = [("ana", "1999-03-14"), ("bo", "2001-07-02"), ("cy", "1984-03-14")]
    assert first_birthday_match(students) == ("ana", "cy")


def test_no_match_returns_none():
    students = [("ana", "1999-03-14"), ("bo", "1999-03-15")]
    assert first_birthday_match(students) is None


def test_first_completed_pair_wins():
    students = [
        ("ana", "1990-01-01"),
        ("bo", "1991-05-05"),
        ("cy", "1992-05-05"),
        ("dana", "1993-01-01"),
    ]
    # cy completes a pair with bo before dana can complete one with ana
    assert first_birthday_match(students) == ("bo", "cy")


def test_partner_is_the_earliest_holder():
    students = [("ana", "1990-09-09"), ("bo", "1991-09-09"), ("cy", "1992-09-09")]
    assert first_birthday_match(students) == ("ana", "bo")


def test_leap_day_is_its_own_birthday():
    students = [("ana", "1996-02-29"), ("bo", "1997-03-01"), ("cy", "2000-02-29")]
    assert first_birthday_match(students) == ("ana", "cy")


def test_empty_class():
    assert first_birthday_match([]) is None


def test_a_lecture_hall_of_thousands():
    students = [
        (f"s{i}", f"{1900 + i % 100}-{i % 12 + 1:02d}-{i % 28 + 1:02d}")
        for i in range(5000)
    ]
    # keys collide exactly when indices differ by lcm(12, 28) = 84
    assert first_birthday_match(students) == ("s0", "s84")
