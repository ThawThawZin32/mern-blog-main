import { Link, NavLink } from 'react-router-dom';
import { getImageUrl } from '../services/api';
import { CATEGORIES, formatRelativeTime, getAuthorInitials } from '../lib/blog';

export function AuthorByline({ author, createdAt, className = '' }) {
  const authorName = author?.name || 'Inkline author';

  return (
    <div className={`story-author ${className}`}>
      <span className="story-avatar">
        {author?.profilePicture ? (
          <img
            src={getImageUrl(author.profilePicture)}
            alt={`Portrait of ${authorName}`}
            loading="lazy"
          />
        ) : (
          <span className="story-avatar-fallback" aria-hidden="true">
            {getAuthorInitials(authorName)}
          </span>
        )}
      </span>
      <span className="story-author-info">
        <span className="story-author-name">{authorName}</span>
        <time className="story-time" dateTime={createdAt}>
          {formatRelativeTime(createdAt)}
        </time>
      </span>
    </div>
  );
}

export function Brand({ footer = false }) {
  return (
    <Link className={`brand${footer ? ' footer-brand' : ''}`} to="/" aria-label="Inkline home">
      <span className="brand-mark" aria-hidden="true">i</span>
      <span>inkline</span>
    </Link>
  );
}

export function Header({ user, onLogout }) {
  const userId = user?.id || user?._id;

  return (
    <header className="site-header">
      <Brand />
      <nav className="main-nav" aria-label="Main navigation">
        {user && <Link className="nav-link" to="/#write">Create Post</Link>}
        <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/authors">
          Authors
        </NavLink>
        {!user ? (
          <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/signin">
            Login
          </NavLink>
        ) : (
          <>
            <Link className="header-profile" to={`/profile/${userId}`}>
              <span className="header-avatar">
                {user.profilePicture ? (
                  <img src={getImageUrl(user.profilePicture)} alt="" />
                ) : (
                  getAuthorInitials(user.name || user.username)
                )}
              </span>
              <span>{user.username || user.name || 'Profile'}</span>
            </Link>
            <button className="button button-quiet" type="button" onClick={onLogout}>
              Logout
            </button>
          </>
        )}
      </nav>
    </header>
  );
}

export function Hero() {
  return (
    <section className="hero">
      <div className="hero-copy">
        <p className="eyebrow">A little space for big ideas</p>
        <h1>Stories worth<br />staying for.</h1>
        <p className="hero-description">
          Share what you know, what you wonder, and what you can’t stop thinking about.
        </p>
        <a className="button button-dark hero-button" href="#write">
          Write a story <span aria-hidden="true">↗</span>
        </a>
      </div>
      <div className="hero-art" aria-hidden="true">
        <span className="art-sun" />
        <span className="art-arch art-arch-back" />
        <span className="art-arch art-arch-front" />
        <span className="art-leaf art-leaf-one" />
        <span className="art-leaf art-leaf-two" />
        <span className="art-caption">WORDS<br />MAKE WORLDS</span>
      </div>
      <span className="hero-index" aria-hidden="true">01 / JOURNAL</span>
    </section>
  );
}

export function CategoryBar({ selectedCategory, onSelect }) {
  return (
    <nav className="category-bar" aria-label="Post categories">
      <span className="category-bar-label">Explore by topic</span>
      <div className="category-bar-list">
        {CATEGORIES.map((category) => (
          <button
            className={`category-button${selectedCategory === category ? ' selected' : ''}`}
            type="button"
            aria-pressed={selectedCategory === category}
            key={category}
            onClick={() => onSelect(selectedCategory === category ? '' : category)}
          >
            {category}
          </button>
        ))}
      </div>
    </nav>
  );
}
