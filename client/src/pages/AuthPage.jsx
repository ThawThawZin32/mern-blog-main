import { useState } from 'react';
import { Link } from 'react-router-dom';

export function AuthPage({ mode, error, loading, onSubmit }) {
  const isSignup = mode === 'signup';
  const [fullName, setFullName] = useState('');
  const [profilePicture, setProfilePicture] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  function submit(event) {
    event.preventDefault();
    onSubmit(event, {
      mode,
      fullName,
      profilePicture,
      email,
      password,
      confirmPassword,
    });
  }

  return (
    <main className="auth-page">
      <section className="auth-welcome" aria-labelledby="auth-welcome-heading">
        <p className="eyebrow">{isSignup ? 'A place to begin' : 'Welcome back'}</p>
        <h1 id="auth-welcome-heading">
          {isSignup ? <>Make room<br />for your ideas.</> : <>Good stories<br />start with you.</>}
        </h1>
        <p>
          {isSignup
            ? 'Create a little space for the things you want to share. Your next story starts here.'
            : 'Pick up where you left off, and share the ideas only you can bring to life.'}
        </p>
        <div className="welcome-art" aria-hidden="true">
          <span className="welcome-art-sun" />
          <span className="welcome-art-arch" />
          <span className="welcome-art-leaf" />
          <span className="welcome-art-caption">WORDS<br />MAKE WORLDS</span>
        </div>
        <span className="welcome-note">THOUGHTFULLY MADE. OPEN TO EVERYONE.</span>
      </section>

      <section className="panel auth-panel" aria-labelledby="auth-form-heading">
        <div className="panel-kicker">
          <span className="panel-icon" aria-hidden="true">{isSignup ? '✳' : '↗'}</span>
          <span>{isSignup ? 'JOIN THE COMMUNITY' : 'WELCOME BACK'}</span>
        </div>
        <h2 id="auth-form-heading">{isSignup ? 'Create your account' : 'Sign in'}</h2>
        <p className="panel-description">
          {isSignup
            ? 'A few details and you’re ready to share your first story.'
            : 'Welcome back. Enter your details to continue.'}
        </p>

        <form className="login-form" onSubmit={submit}>
          {isSignup && (
            <>
              <label htmlFor="signup-name">Full name</label>
              <input
                id="signup-name"
                name="name"
                type="text"
                autoComplete="name"
                maxLength="80"
                placeholder="Your name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
              />
              <label htmlFor="signup-profile-picture">Profile picture (optional)</label>
              <input
                id="signup-profile-picture"
                name="profilePicture"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => setProfilePicture(event.target.files?.[0] || null)}
              />
            </>
          )}
          <label htmlFor="auth-email">Email address</label>
          <input
            id="auth-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label htmlFor="auth-password">Password</label>
          <input
            id="auth-password"
            name="password"
            type="password"
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            minLength={isSignup ? 8 : undefined}
            placeholder={isSignup ? 'At least 8 characters' : 'Your password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {isSignup && (
            <>
              <label htmlFor="confirm-password">Confirm password</label>
              <input
                id="confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength="8"
                placeholder="Enter your password again"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
            </>
          )}

          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-dark submit-button" type="submit" disabled={loading}>
            {loading
              ? (isSignup ? 'Creating account…' : 'Logging in…')
              : (isSignup ? 'Create account' : 'Log in')}
            {!loading && <span aria-hidden="true">↗</span>}
          </button>
        </form>

        <p className="signup-note auth-switch-note">
          {isSignup ? 'Already have an account?' : 'New to Inkline?'}
          {' '}
          <Link className="auth-switch-button" to={isSignup ? '/signin' : '/signup'}>
            {isSignup ? 'Sign in' : 'Sign up'}
          </Link>
        </p>
      </section>
    </main>
  );
}
