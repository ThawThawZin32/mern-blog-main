import { Link } from 'react-router-dom';
import { Composer } from '../components/Composer';
import { StoryFeed } from '../components/StoryFeed';
import { Hero } from '../components/SiteChrome';

export function HomePage({
  user,
  posts,
  loading,
  error,
  onRetry,
  onEditPost,
  onDeletePost,
  deleteError,
  deletingPostId,
  composerProps,
  selectedCategory,
}) {
  return (
    <>
      {user && <Hero />}
      <div className="home-content">
        <StoryFeed
          posts={posts}
          loading={loading}
          error={error}
          onRetry={onRetry}
          selectedCategory={selectedCategory}
          user={user}
          onEdit={onEditPost}
          onDelete={onDeletePost}
          deleteError={deleteError}
          deletingPostId={deletingPostId}
        />
        {user ? (
          <aside className="home-composer">
            <Composer {...composerProps} />
            <section className="note-card">
              <span className="note-spark" aria-hidden="true">✳</span>
              <p>“A writer is someone for whom writing is more difficult than it is for other people.”</p>
              <span className="note-author">— THOMAS MANN</span>
            </section>
          </aside>
        ) : (
          <aside className="home-callout">
            <p className="eyebrow">Your voice belongs here</p>
            <h2>Have a story to tell?</h2>
            <p>Join the community and share something meaningful.</p>
            <Link className="button button-dark hero-button" to="/signup">Create an account <span aria-hidden="true">↗</span></Link>
          </aside>
        )}
      </div>
    </>
  );
}
