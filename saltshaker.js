// SaltShaker v1.0
//
// Use nacl (tweetnacl) easily to create public private keypairs to sign, verify
// encrypt and decrypt messages.
//
// Copyright (c) 2019 Andrew Lee
//
// This is free and unencumbered software released into the public domain.
//
// Anyone is free to copy, modify, publish, use, compile, sell, or
// distribute this software, either in source code form or as a compiled
// binary, for any purpose, commercial or non-commercial, and by any
// means.
//
// In jurisdictions that recognize copyright laws, the author or authors
// of this software dedicate any and all copyright interest in the
// software to the public domain. We make this dedication for the benefit
// of the public at large and to the detriment of our heirs and
// successors. We intend this dedication to be an overt act of
// relinquishment in perpetuity of all present and future rights to this
// software under copyright law.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
// IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR
// OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
// ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
// OTHER DEALINGS IN THE SOFTWARE.
//
// For more information, please refer to <http://unlicense.org>
//
// THIS SOFTWARE IS UNAUDITED.  USE AT YOUR OWN RISK.

(function(SaltShaker) {
  // Function:  md5
  // Purpose:   Get md5
  // Returns:   md5
  var _md5 = md5.md5;
  

  // Function:  _decoder (internal)
  // Purpose:   converts an uint8array to a string
  // Returns:   string
  var _decoder = function (array) {
    // https://stackoverflow.com/questions/8936984/uint8array-to-string-in-javascript
    var out, i, len, c;
    var char2, char3;

    out = "";
    len = array.length;
    i = 0;
    while(i < len) {
      c = array[i++];
      switch(c >> 4)
      { 
        case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
          // 0xxxxxxx
          out += String.fromCharCode(c);
          break;
        case 12: case 13:
          // 110x xxxx   10xx xxxx
          char2 = array[i++];
          out += String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F));
          break;
        case 14:
          // 1110 xxxx  10xx xxxx  10xx xxxx
          char2 = array[i++];
          char3 = array[i++];
          out += String.fromCharCode(((c & 0x0F) << 12) |
                         ((char2 & 0x3F) << 6) |
                         ((char3 & 0x3F) << 0));
          break;
      }
    }

    return out;
  }

  // Function:  _encoder.encode (internal)
  // Purpose:   converts a string to a uint8array
  // Returns:   uint8array
  var _encoder = function (str) {
    //https://stackoverflow.com/questions/6965107/converting-between-strings-and-arraybuffers
    var buf = new ArrayBuffer(str.length*2); // 2 bytes for each char
    var bufView = new Uint16Array(buf);

    for (var i=0, strLen=str.length; i<strLen; i++) {
      bufView[i] = str.charCodeAt(i);
    }

    return new Uint8Array(bufView);
  }



  // Function:  create
  // Purpose:   creates a keypair (optionally from privatekey)
  // Returns:   {"publickey":publickey,"privatekey":privatekey}
  SaltShaker.create = function(privatekey) {
    var _keys = null;
    
    if(privatekey)
      _keys = nacl.sign.keyPair.fromSecretKey(nacl.util.decodeBase64(privatekey));
    else
      _keys = nacl.sign.keyPair();
    return {
      "publickey":nacl.util.encodeBase64(_keys.publicKey),
      "privatekey":nacl.util.encodeBase64(_keys.secretKey)
    }
  }

  // Function:  sign(msg, privkey)
  // Purpose:   uses a private key to sign a msg
  // Returns:   signed msg
  SaltShaker.sign = function(msg, privkey) {
    return nacl.util.encodeBase64(nacl.sign(nacl.util.decodeUTF8(msg),nacl.util.decodeBase64(privkey)));
  }

  // Function:  verify(signedmsg, pubkey)
  // Purpose:   uses a public key to verify a signed msg by the public key
  // Returns:   original msg derived from signed msg
  SaltShaker.verify = function(signedmsg, pubkey) {
    var _returnv = null;

    return ((_returnv = nacl.sign.open(nacl.util.decodeBase64(signedmsg),nacl.util.decodeBase64(pubkey))) ? _decoder(_returnv) : null);
  }

  // Function:  encrypt(msg, pubkey, privkey)
  // Purpose:   uses a target's public key and a private key to encrypt a msg
  // Returns:   JSON object {"nonce":nonce,"message":msg}
  SaltShaker.encrypt = function(msg, pubkey, privkey) {
    var _nonce = nacl.randomBytes(nacl.box.nonceLength);

    return {
      "message":nacl.util.encodeBase64(nacl.box(nacl.util.decodeUTF8(msg),_nonce,ed2curve.convertPublicKey(nacl.util.decodeBase64(pubkey)),ed2curve.convertSecretKey(nacl.util.decodeBase64(privkey)))),
      "nonce":nacl.util.encodeBase64(_nonce)
    }
  }

  // Function:  decrypt(msg, nonce, pubkey, privkey)
  // Purpose:   uses a target's pubkey and a private key to decrypt a msg
  // Returns:   original msg decrypted from the encrypted msg
  SaltShaker.decrypt = function(msg, nonce, pubkey, privkey) {
    return _decoder(nacl.box.open(nacl.util.decodeBase64(msg),nacl.util.decodeBase64(nonce),ed2curve.convertPublicKey(nacl.util.decodeBase64(pubkey)), ed2curve.convertSecretKey(nacl.util.decodeBase64(privkey))));
  }

  // Function:  encryptPSK(msg,key)
  // Purpose:   uses AEAD key encryption
  // Returns:   {"nonce":nonce,"message":msg}
  SaltShaker.encryptPSK = function(msg,key) {
    var _nonce = nacl.randomBytes(nacl.secretbox.nonceLength);

    return {
      "message":nacl.util.encodeBase64(nacl.secretbox(nacl.util.decodeUTF8(msg),_nonce,_encoder(_md5(key)))),
      "nonce":nacl.util.encodeBase64(_nonce)
    }
  }

  // Function:  decryptPSK(msg,key,nonce)
  // Purpose:   uses AEAD key decryption to decrypt
  // Returns:   decrypted msg
  SaltShaker.decryptPSK = function(msg,key,nonce) {
    return _decoder(nacl.secretbox.open(nacl.util.decodeBase64(msg),nacl.util.decodeBase64(nonce),_encoder(_md5(key))));
  }

})(typeof module !== 'undefined' && module.exports ? module.exports : (self.SaltShaker = self.SaltShaker || {}));
