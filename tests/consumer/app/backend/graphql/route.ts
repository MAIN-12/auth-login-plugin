import { GRAPHQL_POST } from '@payloadcms/next/routes'
import { config } from '../../auth-config'
export const POST = GRAPHQL_POST(config)
