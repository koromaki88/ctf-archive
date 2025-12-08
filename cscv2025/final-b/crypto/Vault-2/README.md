# Vault 2 - 500 - 1 solve

> Our vault system protects secrets using authenticated key agreement. Bob has stored a critical secret, but only someone who knows the server's identity can retrieve it. The vault allows you to establish sessions and interact with stored secrets. Can you find a way to break the key agreement protocol and impersonate the server?

http://chall.cscv.vn:8000

Download: https://drive.google.com/file/d/1_TCHR8OfKoF0DKqXTD3YALzEtb9mHqcr/view?usp=drive_link

Always verify challenge's checksum before usage, please be mindful of what you're doing.

    MD5: d169f007de08eb0844addb30a6096681
    SHA1: 49b2fe0cdb023c0a0a5ae5269737a8d1c18d6070

Notes: If you're making hundreds of identical requests to the same endpoint, reconsider your approach

View Hint: Hint 1
How do you feel about my home‑made ECC? Totally NIST‑safe, right? No need to check too much… 😉

View Hint: Hint 2
If my ECC isn’t NIST‑safe, maybe you don’t need the whole secret at once… just how it looks in a bunch of tiny groups, then let number theory do the glue work

