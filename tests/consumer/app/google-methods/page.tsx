import { plugin } from '../auth-config'
import { GoogleMethods } from './view'
export default function Page() { return <GoogleMethods config={plugin.publicConfig} /> }
