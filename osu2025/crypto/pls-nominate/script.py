from Crypto.Util.number import *

FLAG = open("flag.txt", "rb").read()
message = bytes_to_long(
    b"hello there can you pls nominate my map https://osu.ppy.sh/beatmapsets/2436259 :steamhappy: i can bribe you with a flag if you do: " + FLAG
)

ns = [getPrime(727) * getPrime(727) for _ in range(5)]
e = 5
print(len(FLAG))
print(ns)
print([pow(message, e, n) for n in ns])