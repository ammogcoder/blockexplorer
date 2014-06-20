'''
Created on 29.05.2014

@author: root
'''
import base64
import hashlib
import sha3


def convert_to_address(signer):
    pubkey = base64.b64decode(signer)
    
    s = hashlib.new('sha3_256')
    s.update(pubkey)
    sha3_pubkey = s.digest()
    
    h = hashlib.new('ripemd160')
    h.update(sha3_pubkey)
    ripe = h.digest()
    
    version = "\x98" + ripe
    
    s2 = hashlib.new('sha3_256')
    s2.update(version)
    checksum = s2.digest()[0:4]
    
    address = base64.b32encode(version + checksum)
    
    return address
   
