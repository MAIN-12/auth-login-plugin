import type { PayloadRequest } from 'payload'

/** Ordinary identity lookup uses Payload's internal Local API and caller-owned request/transaction.
 * The collection has no public access; overrideAccess is deliberately internal, never a transport flag.
 */
export async function findIdentityAccount(
  req: PayloadRequest,
  collection: string,
  provider: string,
  subject: string,
): Promise<string | undefined> {
  const result = await req.payload.find({
    collection: 'auth-login-identities',
    req,
    overrideAccess: true,
    depth: 0,
    pagination: false,
    limit: 1,
    select: { account: true },
    where: {
      and: [
        { collection: { equals: collection } },
        { provider: { equals: provider } },
        { subject: { equals: subject } },
      ],
    },
  })
  return (result.docs[0] as { account?: string } | undefined)?.account
}
