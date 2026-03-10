import { generateKeyPair }  from 'crypto'
import {promisify} from "node:util"

const generate = promisify(generateKeyPair);

export async function getKeys(modulus = 2048) {
  return await generate('rsa', {
    modulusLength: modulus,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
}

// Exemplos de uso:
// const { publicKey, privateKey } = await getKeys();       // Padrão 2048 bits
// const { publicKey, privateKey } = await getKeys(4096);   // Mais seguro (4096 bits)
