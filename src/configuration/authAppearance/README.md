# Authentication appearance configuration

Language, dictionaries, branding, attribution, and UI style are visual settings,
not authentication domain rules. This folder holds only types and pure data:

- `types.ts` describes appearance inputs, preserving the public ReactNode logo contract.
- `resolveAppearance.ts` merges component > provider > default settings without IO or mutation.
- `defaults.ts` derives serializable style, locale, and logo URL defaults; it renders no JSX.

React adaptation lives in `src/contexts/AuthAppearanceContext`: it provides the
shared settings and hooks without loading session services. The default image is
owned by `src/components/atoms/AuthLogo`. The server adapter alongside
`src/auth/interface/react/providers/AuthProviderServer` uses that same atom with
its existing `object-contain` class; the client default retains its prior classes.
Explicit `logo={null}` hides inherited branding; `undefined` inherits it.

Authentication/session integration lives in `src/auth/interface/react/providers`.
RSC visual entries are `server.tsx` beside `AuthCard` and `AuthPages`, not providers.
`AuthProvider` composes session and appearance contexts. `AuthCard` owns its local
appearance scope and branding; `AuthLayout` only arranges the page. Server wrappers
pass defaults through a fallback boundary, never as explicit component overrides.

`src/hoc/withAuthStyle` selects HeroUI/Tailwind per instance, loading optional HeroUI
only when selected. `src/theme` owns tokens. `src/i18n` owns every dictionary.
The data-only loading context stays independent of visual owners so atoms and the
HOC never import `AuthCard` merely to participate in its shared loading boundary.
