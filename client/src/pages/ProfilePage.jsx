import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, getErrorMessage, getImageUrl } from '../services/api';
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE, formatRelativeTime, getAuthorInitials, getPostCategory } from '../lib/blog';

export function ProfilePage({ user, token, onUserUpdated }) {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const isOwner = Boolean(user && String(user.id || user._id) === id);
  const currentUserEmail = user?.email || '';

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([
      api.get(`/api/users/${encodeURIComponent(id)}`),
      api.get('/api/posts', { params: { author: id } }),
    ])
      .then(([profileResponse, postsResponse]) => {
        if (!active) return;
        const nextProfile = profileResponse.data.data.user;
        setProfile(nextProfile);
        setPosts(postsResponse.data.data.posts || []);
        setName(nextProfile.name || '');
        setUsername(nextProfile.username || '');
        setEmail(isOwner ? currentUserEmail : '');
      })
      .catch((requestError) => {
        if (active) setError(getErrorMessage(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentUserEmail, id, isOwner, retryCount]);

  async function handleProfileSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (newPassword && newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    const payload = { name, username, email };
    if (newPassword) {
      payload.currentPassword = currentPassword;
      payload.newPassword = newPassword;
    }

    setSaving(true);
    try {
      const response = await api.patch(`/api/users/${encodeURIComponent(id)}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProfile((currentProfile) => ({ ...currentProfile, ...response.data.data.user }));
      onUserUpdated(response.data.data.user);
      setUsername(response.data.data.user.username || '');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage('Your profile has been updated.');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    setAvatarError('');
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setAvatarError('Choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setAvatarError('The image must be 5 MB or smaller.');
      return;
    }

    const formData = new FormData();
    formData.append('avatar', file);
    try {
      const response = await api.post('/api/upload', formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const updatedUser = response.data.data.user;
      setProfile((currentProfile) => ({ ...currentProfile, ...updatedUser }));
      onUserUpdated(updatedUser);
    } catch (requestError) {
      setAvatarError(getErrorMessage(requestError));
    }
  }

  return (
    <main className="profile-page">
      {loading && <p className="status-message">Loading profile…</p>}
      {!loading && error && !profile && (
        <div className="error-box" role="alert">
          <span>{error}</span>
          <button className="text-button" type="button" onClick={() => setRetryCount((count) => count + 1)}>
            Try again
          </button>
        </div>
      )}
      {!loading && profile && (
        <>
          <section className="profile-heading">
            <div className="profile-avatar">
              {profile.profilePicture ? (
                <img src={getImageUrl(profile.profilePicture)} alt={`Portrait of ${profile.name}`} />
              ) : (
                <span aria-hidden="true">{getAuthorInitials(profile.name)}</span>
              )}
            </div>
            <div>
              <p className="eyebrow">{isOwner ? 'Your account' : 'Community author'}</p>
              <h1>{profile.name}</h1>
              {profile.username && <p className="profile-username">@{profile.username}</p>}
              <p className="profile-post-count">
                {profile.postCount || posts.length} {(profile.postCount || posts.length) === 1 ? 'post' : 'posts'}
              </p>
            </div>
          </section>

          {isOwner && (
            <section className="profile-settings panel" aria-labelledby="profile-settings-heading">
              <div className="panel-kicker">
                <span className="panel-icon" aria-hidden="true">✳</span>
                <span>ACCOUNT SETTINGS</span>
              </div>
              <h2 id="profile-settings-heading">Edit your profile</h2>
              <label className="profile-avatar-upload">
                <span>Change profile picture</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-label="Change profile picture"
                  onChange={handleAvatarChange}
                />
              </label>
              {avatarError && <p className="form-error" role="alert">{avatarError}</p>}
              <form className="profile-form" onSubmit={handleProfileSubmit}>
                <label htmlFor="profile-name">Name</label>
                <input
                  id="profile-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength="80"
                  required
                />
                <label htmlFor="profile-username">Username</label>
                <input
                  id="profile-username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  maxLength="80"
                />
                <label htmlFor="profile-email">Email</label>
                <input
                  id="profile-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
                <label htmlFor="profile-current-password">Current password <span className="optional-label">REQUIRED TO CHANGE PASSWORD</span></label>
                <input
                  id="profile-current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
                <label htmlFor="profile-new-password">New password</label>
                <input
                  id="profile-new-password"
                  type="password"
                  autoComplete="new-password"
                  minLength="8"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
                <label htmlFor="profile-confirm-password">Confirm new password</label>
                <input
                  id="profile-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
                {error && <p className="form-error" role="alert">{error}</p>}
                {message && <p className="form-success" role="status">{message}</p>}
                <button className="button button-dark submit-button" type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </form>
            </section>
          )}

          <section className="profile-posts" aria-labelledby="profile-posts-heading">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{isOwner ? 'Your writing' : 'Stories by this author'}</p>
                <h2 id="profile-posts-heading">{isOwner ? 'My Posts' : 'Posts'}</h2>
              </div>
              <span className="story-count">{posts.length.toString().padStart(2, '0')} STORIES</span>
            </div>
            {posts.length === 0 ? (
              <div className="empty-state">
                <h3>No Posts found</h3>
                <p>{isOwner ? 'Your published stories will appear here.' : 'This author has not published any stories yet.'}</p>
              </div>
            ) : (
              <div className="profile-post-list">
                {posts.map((post) => (
                  <Link className="profile-post-card" to={`/post/${post._id}`} key={post._id}>
                    <span className="profile-post-category">{getPostCategory(post)}</span>
                    <strong>{post.title}</strong>
                    <span>{post.content}</span>
                    <time dateTime={post.createdAt}>{formatRelativeTime(post.createdAt)}</time>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
