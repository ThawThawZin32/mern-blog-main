import { Link } from 'react-router-dom';
import { getImageUrl } from '../services/api';
import { getPostCategory, isPostOwner } from '../lib/blog';
import { AuthorByline } from './SiteChrome';

export function StoryFeed({
  posts,
  loading,
  error,
  onRetry,
  selectedCategory,
  user,
  onEdit,
  onDelete,
  deleteError,
  deletingPostId,
}) {
  return (
    <section className="feed-section" id="authors" aria-labelledby="latest-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">From the community</p>
          <h2 id="latest-heading">Latest stories</h2>
        </div>
        <span className="story-count">{posts.length.toString().padStart(2, '0')} STORIES</span>
      </div>

      {loading && <p className="status-message">Loading stories…</p>}
      {!loading && error && (
        <div className="error-box" role="alert">
          <span>{error}</span>
          <button className="text-button" type="button" onClick={onRetry}>Try again</button>
        </div>
      )}
      {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
      {!loading && !error && posts.length === 0 && (
        <div className="empty-state">
          <span className="empty-icon" aria-hidden="true">✳</span>
          <h3>{selectedCategory ? 'No Posts found' : 'The first page is yours.'}</h3>
          <p>
            {selectedCategory
              ? `There are no posts in ${selectedCategory}.`
              : 'There aren’t any stories yet. Start one and let the conversation begin.'}
          </p>
        </div>
      )}
      {!loading && !error && posts.length > 0 && (
        <div className="story-grid">
          {posts.map((post) => {
            return (
              <div className="story-card-item" key={post._id}>
                <Link
                  className="story-card-link"
                  to={`/post/${post._id}`}
                  aria-label={`Read story: ${post.title}`}
                >
                  <article className="story-card">
                    <div className="story-media">
                      {post.coverImage ? (
                        <img
                          className="story-image"
                          src={getImageUrl(post.coverImage)}
                          alt={`${post.title} cover`}
                          loading="lazy"
                        />
                      ) : (
                        <div className="story-image-placeholder" aria-hidden="true">
                          <span>INKLINE JOURNAL</span>
                        </div>
                      )}
                    </div>
                    <div className="story-body">
                      <h3>{post.title}</h3>
                      <p className="story-excerpt">{post.content}</p>
                      <div className="story-footer">
                        <AuthorByline author={post.author} createdAt={post.createdAt} />
                        <ul className="tag-list" aria-label={`${post.title} category`}>
                          <li>{getPostCategory(post)}</li>
                        </ul>
                      </div>
                    </div>
                  </article>
                </Link>
                {isPostOwner(post, user) && (
                  <div className="story-card-actions">
                    <button
                      className="story-edit-button"
                      type="button"
                      aria-label={`Edit story: ${post.title}`}
                      onClick={() => onEdit(post)}
                    >
                      Edit
                    </button>
                    <button
                      className="story-delete-button"
                      type="button"
                      aria-label={`Delete story: ${post.title}`}
                      disabled={deletingPostId === post._id}
                      onClick={() => onDelete(post)}
                    >
                      {deletingPostId === post._id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
