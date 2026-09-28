import crypto from 'crypto'
import { generatePayloadCookie, headersWithCors, loginOperation, type Endpoint } from 'payload'
import { generateOtp, hashOtp, verifyOtp, getOtpExpiry, isOtpExpired } from '../auth/domain/otp'
import { generateWelcomeEmail, generateOtpEmail, generatePasswordResetEmail } from '../components/email/index'
import { pluginConfig } from '../config'

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
  path: '/auth/check-email',
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
  path: '/auth/otp/send',
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

      // Delete any existing OTPs for this email
      const existingOtps = await req.payload.find({
        collection: 'auth-otps' as any,
        where: { email: { equals: email.toLowerCase().trim() } },
      })
      for (const doc of existingOtps.docs) {
        await req.payload.delete({ collection: 'auth-otps' as any, id: doc.id })
      }

      // Store OTP in dedicated collection
      await req.payload.create({
        collection: 'auth-otps' as any,
        data: {
          email: email.toLowerCase().trim(),
          hash: hashed,
          purpose,
          attempts: 0,
          expiresAt: expiresAt.toISOString(),
        } as any,
      })

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
  path: '/auth/otp/verify',
  method: 'post',
  handler: async (req) => {
    const body = req.json ? await req.json() : (req as any).body || {}
    const { email, otp } = body
    if (!email || !otp) return Response.json({ success: false, error: 'Email and OTP are required' }, { status: 400 })

    try {
      // Find OTP record from dedicated collection
      const otpDocs = await req.payload.find({
        collection: 'auth-otps' as any,
        where: { email: { equals: email.toLowerCase().trim() } },
        sort: '-createdAt',
        limit: 1,
      })
      const otpDoc = otpDocs.docs?.[0] as any

      if (!otpDoc?.hash) {
        return Response.json({ success: false, error: 'No OTP found. Please request a new code.' }, { status: 400 })
      }

      if (isOtpExpired(otpDoc.expiresAt)) {
        await req.payload.delete({ collection: 'auth-otps' as any, id: otpDoc.id })
        return Response.json({ success: false, error: 'Code has expired. Please request a new one.' }, { status: 400 })
      }

      if ((otpDoc.attempts || 0) >= 3) {
        await req.payload.delete({ collection: 'auth-otps' as any, id: otpDoc.id })
        return Response.json({ success: false, error: 'Too many attempts. Please request a new code.' }, { status: 400 })
      }

      // Increment attempts
      await req.payload.update({
        collection: 'auth-otps' as any,
        id: otpDoc.id,
        data: { attempts: (otpDoc.attempts || 0) + 1 } as any,
      })

      if (!verifyOtp(otp, otpDoc.hash)) {
        return Response.json({ success: false, error: 'Invalid code. Please try again.' }, { status: 400 })
      }

      // OTP is valid — delete it
      await req.payload.delete({ collection: 'auth-otps' as any, id: otpDoc.id })

      // Find the user
      const users = await req.payload.find({
        collection: 'users',
        where: { email: { equals: email.toLowerCase().trim() } },
        limit: 1,
      })
      const user = users.docs?.[0] as any
      if (!user) {
        return Response.json({ success: false, error: 'User not found' }, { status: 404 })
      }

      // Use temp password strategy (same as PaintPulse) — only touches password field
      const tempPassword = crypto.randomBytes(32).toString('hex')
      await req.payload.update({
        collection: 'users',
        id: user.id,
        data: { password: tempPassword } as any,
      })

      // Login with the temp password to get a proper JWT token
      // Use the same operation as Payload's HTTP login handler. The Local API
      // removes the token early when removeTokenFromResponses is enabled.
      const collection = req.payload.collections.users
      const loginResult = await loginOperation({
        collection,
        req,
        data: {
          email: email.toLowerCase().trim(),
          password: tempPassword,
        },
      })

      if (!loginResult.user || !loginResult.token) {
        throw new Error('Login failed after OTP verification')
      }

      const cookie = generatePayloadCookie({
        collectionAuthConfig: collection.config.auth,
        cookiePrefix: req.payload.config.cookiePrefix,
        token: loginResult.token,
      })
      return Response.json({
        success: true,
        ...(!collection.config.auth.removeTokenFromResponses ? { token: loginResult.token } : {}),
        isNewUser: !user?.hasPassword,
      }, {
        headers: headersWithCors({
          headers: new Headers({ 'Set-Cookie': cookie }),
          req,
        }),
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
  path: '/auth/set-password',
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
      if (!user || user.collection !== 'users') {
        return Response.json({ success: false, message: 'Not authenticated' }, { status: 401 })
      }

      await req.payload.update({
        collection: 'users',
        id: user.id,
        data: { password, confirmPassword } as any,
        req,
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
  path: '/auth/signup',
  method: 'post',
  handler: async (req) => {
    if (!pluginConfig.allowSignup) {
      return Response.json({ success: false, message: 'Signups are currently disabled' }, { status: 403 })
    }

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