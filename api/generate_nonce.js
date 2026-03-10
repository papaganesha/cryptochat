import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import { promisify } from "node:util"

const { decodeBase64, encodeBase64 } = naclUtil;
const generate = promisify(nacl);

export async function getNonce(modulus = 2048) {
    const nonce = await nacl.randomBytes(24); 
  return await generate.box(
  decodeBase64(messageString),
  nonce,
  destinatarioPublicKey,
  minhaPrivateKey
);
}


