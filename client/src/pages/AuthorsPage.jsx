import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, getErrorMessage, getImageUrl } from '../services/api';
import { getAuthorInitials } from '../lib/blog';
import { useBlogStore } from '../stores/blogStore';

export function AuthorsPage({ user, token, onAccountDeleted }) {
  const authors = useBlogStore((state) => state.authors);
  const loading = useBlogStore((state) => state.authorsLoading);
  const setAuthors = useBlogStore((state) => state.setAuthors);
  const setLoading = useBlogStore((state) => state.setAuthorsLoading);
  const [error, setError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.get('/api/users/authors')
      .then((response) => {
        if (active) setAuthors(response.data.data.authors || []);
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
  }, [retryCount, setAuthors, setLoading]);

  async function handleDeleteAuthor(author) {
    const userId = user?.id || user?._id;
    const isOwnAccount = String(userId) === String(author.id);
    if (!token || !userId || (!isOwnAccount && user?.role !== 'admin')) {
      return;
    }
    if (!window.confirm(
      isOwnAccount
        ? 'Delete your account? This will permanently delete your account and all of your stories.'
        : `Delete ${author.name}'s account? This will permanently delete the account and all of its stories.`,
    )) {
      return;
    }

    setDeletingId(author.id);
    setDeleteError('');
    try {
      await api.delete(`/api/users/${encodeURIComponent(author.id)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAuthors((currentAuthors) => currentAuthors.filter(
        (currentAuthor) => String(currentAuthor.id) !== String(author.id),
      ));
      onAccountDeleted(author.id);
    } catch (deleteRequestError) {
      setDeleteError(getErrorMessage(deleteRequestError));
    } finally {
      setDeletingId('');
    }
  }

  return (
    <main className="authors-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">People behind the stories</p>
          <h1>Our authors</h1>
        </div>
        <span className="story-count">{authors.length.toString().padStart(2, '0')} AUTHORS</span>
      </div>
      {loading && <p className="status-message">Loading authors…</p>}
      {!loading && error && (
        <div className="error-box" role="alert">
          <span>{error}</span>
          <button className="text-button" type="button" onClick={() => setRetryCount((count) => count + 1)}>
            Try again
          </button>
        </div>
      )}
      {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
      {!loading && !error && authors.length === 0 && (
        <div className="empty-state">
          <h2>No authors found</h2>
          <p>Authors will appear here when they join the community.</p>
        </div>
      )}
      {!loading && !error && authors.length > 0 && (
        <div className="author-grid">
          {authors.map((author) => {
            const userId = user?.id || user?._id;
            const isOwnAccount = Boolean(userId && String(userId) === String(author.id));
            const canDelete = Boolean(token && user && (isOwnAccount || user.role === 'admin'));
            return (
              <div className="author-card-item" key={author.id}>
                <Link className="author-card" to={`/profile/${author.id}`}>
                  <span className="author-card-avatar">
                    {author.profilePicture ? (
                      <img
                        src={getImageUrl(author.profilePicture)}
                        alt={`Portrait of ${author.name}`}
                        loading="lazy"
                      />
                    ) : (
                      <span aria-hidden="true">{getAuthorInitials(author.name)}</span>
                    )}
                  </span>
                  <span className="author-card-name">{author.name}</span>
                  <span className="author-card-username">@{author.username || author.name}</span>
                  <span className="author-card-count">
                    {author.postCount} {author.postCount === 1 ? 'post' : 'posts'}
                  </span>
                </Link>
                {canDelete && (
                  <div className="author-card-actions">
                    {isOwnAccount && (
                      <Link
                        className="author-edit-button"
                        to={`/profile/${author.id}`}
                        aria-label={`Edit ${author.name}'s profile`}
                      >
                        Edit
                      </Link>
                    )}
                    <button
                      className="author-delete-button"
                      type="button"
                      aria-label={`Delete ${author.name}'s account`}
                      disabled={deletingId === author.id}
                      onClick={() => handleDeleteAuthor(author)}
                    >
                      {deletingId === author.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
