/** Compatibility import path; retire in auth-clean 06. */
export {
  AuthRequestError,
  createAuthService,
  checkEmail,
  sendOtp,
  verifyOtp,
  setUserPassword,
  signup,
  initiateGoogleLogin,
  authErrorKey,
} from '../../interface/client/authService'
