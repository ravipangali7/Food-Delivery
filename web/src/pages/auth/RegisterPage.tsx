import PhoneOtpAuth from '@/components/auth/PhoneOtpAuth';

export default function RegisterPage() {
  return (
    <PhoneOtpAuth
      mode="register"
      title="Create your account"
      subtitle="Enter your details. We will verify your phone with a one-time code."
      alternateHint="Already have an account?"
      alternateLabel="Sign in"
      alternateTo="/login"
    />
  );
}
