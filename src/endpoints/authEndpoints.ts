import type { Endpoint } from 'payload'
import { generateOtp, hashOtp, verifyOtp, getOtpExpiry, isOtpExpired } from '../auth/domain/otp'
import { generateWelcomeEmail, generateOtpEmail, generatePasswordResetEmail } from '../components/email/index'

interface OtpRecord {
  id: string
  email: string
  hash: string
  purpose: string
  attempts: number
  expiresAt: string
  createdAt: string
}

/**
 * POST /api/auth/check-email — Check if user exists and has password
 */
export const checkEmailEndpoint: Endpoint = {
  path: '/api/auth/check-email',
  method: 'post',
  handler: async (req) => {
    const { email } = req.json ? await req.json() : (req as any).body || {}
    if (!email) return Response.json({ error: 'Email is required' }, { status: 400 })

    try {
      const users = await req.payload.find({
        collection: 'users',
        where: { email: { equals: email.toLowerCase().trim() } },
        limit: 1,
      })

      if (!users.docs?.length) {
        return Response.json({ exists: false, hasPassword: false, authProvider: null })
      }

      const user = users.docs[0] as any
      return Response.json({
        exists: true,
        hasPassword: !!user.password,
        authProvider: user.authProvider || null,
      })
    } catch (err) {
      return Response.json({ error: 'Failed to check email' }, { status: 500 })
    }
  },
}

/**
 * POST /api/auth/otp/send — Generate OTP, store it, send email via Payload
 */
export const sendOtpEndpoint: Endpoint = {
  path: '/api/auth/otp/send',
  method: 'post',
  handler: async (req) => {
    const body = req.json ? await req.json() : (req as any).body || {}
    const { email, purpose = 'login' } = body
    if (!email) return Response.json({ success: false, message: 'Email is required' }, { status: 400 })

    try {
      // Check user exists
      const users = await req.payload.find({
        collection: 'users',
        where: { email: { equals: email.toLowerCase().trim() } },
        limit: 1,
      })
      if (!users.docs?.length) {
        return Response.json({ success: false, message: 'No account found with this email' }, { status: 404 })
      }

      const user = users.docs[0] as any
      const otp = generateOtp()
      const hashed = hashOtp(otp)
      const expiresAt = getOtpExpiry(10)

      // Store OTP in a custom collection or users doc
      // For simplicity, we'll use the users collection with an otp field
      // In production, use a dedicated `otps` collection
      try {
        await req.payload.update({
          collection: 'users',
          id: user.id,
          data: {
            otpHash: hashed,
            otpPurpose: purpose,
            otpAttempts: 0,
            otpExpiresAt: expiresAt.toISOString(),
          } as any,
        })
      } catch {
        // If the users collection doesn't have OTP fields, create a dedicated otps doc
        await req.payload.create({
          collection: 'otps' as any,
          data: {
            email: email.toLowerCase().trim(),
            hash: hashed,
            purpose,
            attempts: 0,
            expiresAt: expiresAt.toISOString(),
          } as any,
        })
      }

      // Send email via Payload's configured adapter
      const emailResult = purpose === 'signup'
        ? generateOtpEmail({ userName: (user as any).name || user.email, otp, purpose: 'login' })
        : generateOtpEmail({ userName: (user as any).name || user.email, otp, purpose: purpose as any })

      await req.payload.sendEmail({
        to: email,
        subject: emailResult.subject,
        html: emailResult.html,
      })

      return Response.json({ success: true })
    } catch (err: any) {
      console.error('OTP send error:', err)
      return Response.json({ success: false, message: err.message || 'Failed to send OTP' }, { status: 500 })
    }
  },
}

/**
 * POST /api/auth/otp/verify — Verify OTP and login the user
 */
export const verifyOtpEndpoint: Endpoint = {
  path: '/api/auth/otp/verify',
  method: 'post',
  handler: async (req) => {
    const body = req.json ? await req.json() : (req as any).body || {}
    const { email, otp } = body
    if (!email || !otp) return Response.json({ success: false, error: 'Email and OTP are required' }, { status: 400 })

    try {
      // Find OTP record — try users collection first
      const users = await req.payload.find({
        collection: 'users',
        where: { email: { equals: email.toLowerCase().trim() } },
        limit: 1,
      })

      let otpHash: string | undefined
      let otpAttempts = 0
      let otpExpiresAt: string | undefined

      const user = users.docs?.[0] as any
      if (user?.otpHash) {
        otpHash = user.otpHash
        otpAttempts = user.otpAttempts || 0
        otpExpiresAt = user.otpExpiresAt
      } else {
        // Try dedicated otps collection
        const otpDocs = await req.payload.find({
          collection: 'otps' as any,
          where: { email: { equals: email.toLowerCase().trim() } },
          sort: '-createdAt',
          limit: 1,
        })
        const otpDoc = otpDocs.docs?.[0] as any
        if (otpDoc) {
          otpHash = otpDoc.hash
          otpAttempts = otpDoc.attempts || 0
          otpExpiresAt = otpDoc.expiresAt
        }
      }

      if (!otpHash) {
        return Response.json({ success: false, error: 'No OTP found. Please request a new code.' }, { status: 400 })
      }

      if (isOtpExpired(otpExpiresAt!)) {
        return Response.json({ success: false, error: 'Code has expired. Please request a new one.' }, { status: 400 })
      }

      if (otpAttempts >= 3) {
        return Response.json({ success: false, error: 'Too many attempts. Please request a new code.' }, { status: 400 })
      }

      // Increment attempts
      if (user?.otpHash) {
        await req.payload.update({
          collection: 'users',
          id: user.id,
          data: { otpAttempts: otpAttempts + 1 } as any,
        })
      }

      if (!verifyOtp(otp, otpHash)) {
        return Response.json({ success: false, error: 'Invalid code. Please try again.' }, { status: 400 })
      }

      // OTP is valid — log the user in
      // Payload requires password for login. We use the stored password
      // (auto-generated during signup or previously set by user).
      const userData = users.docs?.[0] as any
      const result = await req.payload.login({
        collection: 'users',
        data: {
          email: email.toLowerCase().trim(),
          password: userData?.password || '',
        },
        req: req as any,
      })

      // Clean up OTP
      if (user?.otpHash) {
        await req.payload.update({
          collection: 'users',
          id: user.id,
          data: { otpHash: null, otpPurpose: null, otpAttempts: null, otpExpiresAt: null } as any,
        })
      }

      return Response.json({
        success: true,
        token: result.token,
        isNewUser: !user?.password,
      })
    } catch (err: any) {
      console.error('OTP verify error:', err)
      return Response.json({ success: false, error: err.message || 'Verification failed' }, { status: 500 })
    }
  },
}

/**
 * POST /api/auth/set-password — Set/update password for authenticated user
 */
export const setPasswordEndpoint: Endpoint = {
  path: '/api/auth/set-password',
  method: 'post',
  handler: async (req) => {
    const body = req.json ? await req.json() : (req as any).body || {}
    const { password, confirmPassword } = body

    if (!password || !confirmPassword) {
      return Response.json({ success: false, message: 'Password and confirmation are required' }, { status: 400 })
    }
    if (password !== confirmPassword) {
      return Response.json({ success: false, message: 'Passwords do not match' }, { status: 400 })
    }
    if (password.length < 8) {
      return Response.json({ success: false, message: 'Password must be at least 8 characters' }, { status: 400 })
    }

    try {
      const user = (req as any).user
      if (!user) {
        return Response.json({ success: false, message: 'Not authenticated' }, { status: 401 })
      }

      await req.payload.update({
        collection: 'users',
        id: user.id,
        data: { password, confirmPassword } as any,
      })

      return Response.json({ success: true, message: 'Password set successfully' })
    } catch (err: any) {
      return Response.json({ success: false, message: err.message || 'Failed to set password' }, { status: 500 })
    }
  },
}

/**
 * POST /api/auth/signup — Create new user + send welcome email
 */
export const signupEndpoint: Endpoint = {
  path: '/api/auth/signup',
  method: 'post',
  handler: async (req) => {
    const body = req.json ? await req.json() : (req as any).body || {}
    const { name, email } = body

    if (!email) {
      return Response.json({ success: false, message: 'Email is required' }, { status: 400 })
    }

    try {
      // Check if user already exists
      const existing = await req.payload.find({
        collection: 'users',
        where: { email: { equals: email.toLowerCase().trim() } },
        limit: 1,
      })

      if (existing.docs?.length) {
        return Response.json({ success: false, message: 'An account with this email already exists' }, { status: 409 })
      }

      // Auto-generate a random password (user sets their own via OTP flow)
      const tempPassword = `tmp_${Math.random().toString(36).slice(2)}_${Date.now()}`

      const user = await req.payload.create({
        collection: 'users',
        data: {
          email: email.toLowerCase().trim(),
          password: tempPassword,
          name: name?.trim() || email.split('@')[0],
          role: 'user',
        } as any,
      })

      // Send welcome email
      try {
        const welcomeEmail = generateWelcomeEmail({
          userName: name?.trim() || email.split('@')[0],
          userEmail: email.toLowerCase().trim(),
        })
        await req.payload.sendEmail({
          to: email,
          subject: welcomeEmail.subject,
          html: welcomeEmail.html,
        })
      } catch (emailErr) {
        console.error('Welcome email failed:', emailErr)
        // Don't fail signup if email fails
      }

      return Response.json({ success: true, message: 'Account created', userId: (user as any).id })
    } catch (err: any) {
      console.error('Signup error:', err)
      return Response.json({ success: false, message: err.message || 'Signup failed' }, { status: 500 })
    }
  },
}

export const authEndpoints: Endpoint[] = [
  checkEmailEndpoint,
  sendOtpEndpoint,
  verifyOtpEndpoint,
  setPasswordEndpoint,
  signupEndpoint,
]