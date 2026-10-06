import { handleEndpoints } from 'payload'
import { config } from '../../auth-config'
const handler = (request: Request) => handleEndpoints({ config, request, payloadInstanceCacheKey: 'browser-consumer' })
export { handler as GET, handler as POST, handler as PATCH, handler as OPTIONS }
