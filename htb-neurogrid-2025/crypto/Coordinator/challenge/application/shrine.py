from random import getrandbits as secure_getrandbits
import decimal

def magic(a, b, c):
    decimal.getcontext().prec = 100
    D = decimal.Decimal(b**2 - 4*a*c)
    x1 = (-b + D.sqrt()) / (2*a)
    x2 = (-b - D.sqrt()) / (2*a)
    assert all(a*x**2 + b*x + c < 1e-9 for x in [x1, x2])
    return x1 if b < (2**31 + 2**32)//2 else x2

def observe_constellation():
    while True:
        a, b, c = -draw_cosmic_pattern(32), draw_cosmic_pattern(32), draw_cosmic_pattern(32)
        x = magic(a, b, c)
        if x != None:
            return x
        else:
            return -1337.1337

def draw_cosmic_pattern(b):
    return secure_getrandbits(b)

bind = lambda a, b: bytes(x ^ y for x, y in zip(a, b))