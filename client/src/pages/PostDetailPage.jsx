import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, getErrorMessage, getImageUrl } from '../services/api';
import { isPostOwner } from '../lib/blog';
import { AuthorByline } from '../components/SiteChrome';
import { Composer } from '../components/Composer';

export function PostDetailPage({
  user,
  editingPost,
  composerProps,
  onEdit,
  onDelete,
  deleteError,
  deletingPostId,
}) {
  const { id } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;
    setPost(null);
    setLoading(true);
    setError('');

    api.get(`/api/posts/${encodeURIComponent(id)}`)
      .then((response) => {
        if (active) setPost(response.data.data.post);
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
  }, [id, retryCount]);

  async function handleEditSubmit(event) {
    const updatedPost = await composerProps.onSubmit(event);
    if (updatedPost) {
      setPost(updatedPost);
    }
  }

  return (
    <main className="post-detail-page">
      <div className="post-detail-navigation">
        <Link className="post-back-link" to="/">← Back to stories</Link>
        {post && isPostOwner(post, user) && (
          <div className="post-detail-actions">
            <button className="button-quiet" type="button" onClick={() => onEdit(post)}>
              Edit story
            </button>
            <button
              className="button-quiet"
              type="button"
              disabled={deletingPostId === post._id}
              onClick={() => onDelete(post)}
            >
              {deletingPostId === post._id ? 'Deleting…' : 'Delete story'}
            </button>
          </div>
        )}
      </div>
      {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
      {loading && <p className="status-message" role="status">Loading story…</p>}
      {!loading && error && (
        <div className="error-box" role="alert">
          <span>{error}</span>
          <button
            className="text-button"
            type="button"
            onClick={() => setRetryCount((currentCount) => currentCount + 1)}
          >
            Try again
          </button>
        </div>
      )}
      {!loading && !error && post && (
        <>
          <article className="post-detail">
            {post.coverImage && (
              <div className="post-detail-cover">
                <img src={getImageUrl(post.coverImage)} alt={`${post.title} cover`} />
              </div>
            )}
            <div className="post-detail-body">
              {post.tags?.length > 0 && (
                <ul className="post-detail-tags" aria-label="Tags">
                  {post.tags.map((tag) => <li key={tag}>{tag}</li>)}
                </ul>
              )}
              <h1>{post.title}</h1>
              <AuthorByline
                className="post-detail-author"
                author={post.author}
                createdAt={post.createdAt}
              />
              <div className="post-detail-content">{post.content}</div>
            </div>
          </article>
          {editingPost && String(editingPost._id) === String(id) && isPostOwner(editingPost, user) && (
            <div className="detail-editor">
              <Composer {...composerProps} onSubmit={handleEditSubmit} />
            </div>
          )}
        </>
      )}
    </main>
  );
}
