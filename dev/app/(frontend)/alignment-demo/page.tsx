import { AuthCard, AuthLayout } from '@main12/auth-login/rsc'
import AlignmentLoginDemo from '../../../components/AlignmentLoginDemo'

export default function AlignmentLoginDemoPage() {
  return (
    <AuthLayout texture="spotlight-dots" backgroundClass="bg-zinc-900">
      <AlignmentLoginDemo>
        <AuthCard slug="login" mobileVariant="card" />
      </AlignmentLoginDemo>
    </AuthLayout>
  )
}
