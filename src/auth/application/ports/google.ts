import type { GoogleCorrelation, GoogleIdentity } from '../../domain/google'
export type { GoogleCorrelation, GoogleIdentity } from '../../domain/google'
export interface GoogleProvider {
  authorize(correlation: GoogleCorrelation): Promise<string>
  exchange(url: string, correlation: GoogleCorrelation): Promise<GoogleIdentity>
}
export interface GoogleCorrelations {
  save(correlation: GoogleCorrelation): Promise<void>
  consume(state: string, browser: string, now: number): Promise<GoogleCorrelation>
}
export interface GoogleStart {
  browser: string
  returnTo?: string
  purpose?: GoogleCorrelation['purpose']
  permit?: string
  popup?: boolean
}
export interface GoogleCallback {
  state: string
  browser: string
  url: string
}
