import type { Messages } from '../zh'

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export const errors: Messages['errors'] = {
  codes: {
    auth_disabled: 'Sign-in is not available yet',
    invalid_email: 'Please enter a valid email address',
    weak_password: 'Password must be at least 8 characters',
    email_taken: 'This email is already registered. Please sign in instead.',
    invalid_credentials: 'Incorrect email or password',
    invalid_name: 'Please enter a name of up to 50 characters, without line breaks or special characters',
    google_disabled: 'Google sign-in is not available right now',
    invalid_google_token: 'Google sign-in failed. Please try again.',
    google_email_unverified: 'The email on this Google account is not verified. Please verify it with Google first, or use another account.',
    google_retry: 'Something conflicted while signing in. Please try again.',
    google_conflict: 'This email is already linked to another Google account',
    json_required: 'Please send the request as JSON',
    bad_request: 'The request was not valid',
    internal: 'Something went wrong on our side. Please try again later.',
    site_login_required: 'Please sign in on the website to change your account details',
    unauthorized: 'Please sign in first',
    rate_limited: 'Too many attempts. Please try again in a minute.',
    forbidden: 'You do not have admin access',
    invalid_locale: 'This language is not supported',
    not_found: 'Not found',
    kids_parent_only: 'Settings can’t be changed in Kids Mode. A parent needs to exit Kids Mode first.',
    kids_only: 'Only kids’ lessons are available in Kids Mode',
    kids_locked: 'This lesson isn’t open yet. Finish the earlier lessons first.',
    kids_closed: 'It’s not class time yet. A parent can schedule class times in the member area.',
    login_required: 'Please sign in to watch this lesson',
    subscription_required: 'A subscription is required to watch this lesson',
  },
  scriptLoginRequired: 'Please sign in to watch this lesson, then try again.',
  scriptSubscriptionRequired: 'A subscription is required to watch this lesson.',
  scriptLoadFailed: (path: string, status: number) => `Couldn’t load the lesson script ${path} (${status})`,
  kidsClosedNext: (day: number, time: string) => `It’s not class time yet. The next class is ${weekdays[day] ?? ''} at ${time}.`,
}
