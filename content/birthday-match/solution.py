def first_birthday_match(students):
    record = {}
    for name, date in students:
        birthday = date[5:]  # month and day; the year never matters
        if birthday in record:
            return (record[birthday], name)
        record[birthday] = name
    return None
