from sage.all import EllipticCurve, GF, Integer
from hashlib import sha256
from params import p, a, b
import secrets, hmac
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad

assert (a, b) == (0x426b522d14487e10aa36de8bfd0f807c2db07551727ea79e1c8670bfa1b6f4f1, 0x2f76b6d71e3ec56f0fd49703151b3ea66bd4fd713e8630fbf461772e2088e2a7)

E = EllipticCurve(GF(p), [a, b])
scroll = open('flag.txt', 'rb').read()

def ink_to_curve(ink):
    while not E.is_x_coord(ink):
        ink += 1
    return E.lift_x(ink)

def summon_key(offering):
    G = ink_to_curve(offering)
    x = int(secrets.token_hex(48), 16)
    sigil = int((G*x)[0])
    key = int.to_bytes(sigil, length=(sigil.bit_length()+7)//8)
    return key

def whisper_truth():
    return (1337 * E.random_point() * 1337).xy()

def inscribe(offering):
    key = summon_key(offering)
    iv = secrets.token_bytes(16)
    cipher = AES.new(key, AES.MODE_CBC, iv)
    enc = cipher.encrypt(pad(scroll, 16))
    return iv + enc


while True:
    o = input("[🌕] Choose your ritual :: ")

    if o == "1":
        print(f'[📜] The scroll murmurs of hidden geometry : {str(whisper_truth())}')

    elif o == "2":
        offering = input("[🖋️] Inscribe your numeric offering :: ")
        try:
            print(f"[✨] The scroll accepts your ink and returns this sealed verse :: {inscribe(Integer(offering)).hex()}")
        except:
            print('[⚠️] Only pure numbers may be offered to the scroll.')
            continue

    elif o == "3":
        print("The ink fades. The ritual ends.")
        exit(0)

    else:
        print("[❌] The scroll remains silent.")