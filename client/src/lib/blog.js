export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const CATEGORIES = ['Agriculture', 'Business', 'Education', 'Entertainment', 'Art', 'Investment', 'Uncategorized', 'Weather'];
export const TAG_SUGGESTIONS = ['Education', 'Learning', 'Technology', 'Business', 'Art', 'Entertainment', 'Agriculture', 'Investment', 'Weather', 'Design', 'Travel', 'Ideas', 'Science'];

export function getUtf8ByteLength(value) {
  let byteLength = 0;
  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.codePointAt(index);
    if (codePoint > 0xffff) {
      index += 1;
    }
    byteLength += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
  }
  return byteLength;
}

export function formatRelativeTime(value) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return 'Date unavailable';
  }

  const elapsedSeconds = Math.round((timestamp - Date.now()) / 1000);
  const timeUnits = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
    ['second', 1],
  ];
  const [unit, secondsPerUnit] = timeUnits.find(([, seconds]) => (
    Math.abs(elapsedSeconds) >= seconds
  )) || timeUnits[timeUnits.length - 1];

  return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
    .format(Math.round(elapsedSeconds / secondsPerUnit), unit);
}

export function getAuthorInitials(name) {
  return (name || 'Inkline author')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || '')
    .join('')
    .toUpperCase();
}

export function getPostCategory(post) {
  const tags = Array.isArray(post?.tags) ? post.tags : [];
  const storedCategory = typeof post?.category === 'string'
    ? CATEGORIES.find((category) => category.toLowerCase() === post.category.toLowerCase())
    : undefined;
  if (storedCategory) {
    return storedCategory;
  }
  return CATEGORIES.find((category) => (
    tags.some((tag) => typeof tag === 'string' && tag.toLowerCase() === category.toLowerCase())
  )) || tags.find((tag) => typeof tag === 'string') || 'Uncategorized';
}

export function isPostOwner(post, user) {
  const author = post?.author;
  const authorId = typeof author === 'string' ? author : author?.id || author?._id;
  const userId = user?.id || user?._id;
  return Boolean(authorId && userId && String(authorId) === String(userId));
}
