import { createHmac } from 'node:crypto'
import type { PayloadRequest } from 'payload'
import { readCutoverGeneration } from '../../../collections/AuthLoginCutovers'
export async function methodPermitSecret(req: PayloadRequest, collection: string): Promise<string> {
  const generation = await readCutoverGeneration(req, collection)
  return permitSecretForGeneration(req.payload.secret, collection, generation)
}
export function permitSecretForGeneration(
  secret: string,
  collection: string,
  generation: string,
): string {
  return generation
    ? createHmac('sha256', secret)
        .update(JSON.stringify(['auth-login/cutover/permit/v1', collection, generation]))
        .digest('hex')
    : secret
}
