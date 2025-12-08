from random import randrange , randint , choice
from hashlib import sha256 
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad , unpad

n=256
q=8380417

P.<a>=QuotientRing(ZZ[x], ZZ[x].ideal(x**n+1))

def poly_eval(coeffi, x) :
    ans = 0 
    for i in range(len(coeffi)) :
        ans += coeffi[i]*x^i 
    return ans 

def keygen() :
    coeffi =  [randrange(-2,2) for i in range(n)]
    key = poly_eval(coeffi,a)
    return key


def challenge(e,d):
    
    coffie = [randint(-2**128,2**128) for i in range(d)]
    r= poly_eval(coffie,a)
    vec=[0]*n
    
    for loop in range(255):
        i=randint(0,n-1)
        while vec[i]!=0:
            i=randint(0,n-1)
        vec[i]= randint(-2**128,2**128)
    
    w= poly_eval(vec,a)
    z= r+e*w
    return z,w


key = keygen()
key_enc = challenge(key,75)

flag = b'CSCV2025{????????????????????????}'
key_aes = sha256(str(key).encode()).digest()[:16]
cipher = AES.new(key_aes,AES.MODE_ECB)
ciphertext = cipher.encrypt(pad(flag,16))
print(key_enc)
print(ciphertext)




