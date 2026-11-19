import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { api, getErrorMessage, getImageUrl } from '../services/api';
import { ALLOWED_IMAGE_TYPES, CATEGORIES, getPostCategory, getUtf8ByteLength, isPostOwner, MAX_IMAGE_SIZE } from '../lib/blog';
import { useBlogStore } from '../stores/blogStore';
import { Brand, CategoryBar, Header } from './SiteChrome';
import { AuthPage } from '../pages/AuthPage';
import { AuthorsPage } from '../pages/AuthorsPage';
import { HomePage } from '../pages/HomePage';
import { PostDetailPage } from '../pages/PostDetailPage';
import { ProfilePage } from '../pages/ProfilePage';

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const postsRequestController = useRef(null);
  const token = useBlogStore((state) => state.token);
  const user = useBlogStore((state) => state.user);
  const authLoading = useBlogStore((state) => state.authLoading);
  const posts = useBlogStore((state) => state.posts);
  const postsLoading = useBlogStore((state) => state.postsLoading);
  const postsError = useBlogStore((state) => state.postsError);
  const selectedCategory = useBlogStore((state) => state.selectedCategory);
  const setUser = useBlogStore((state) => state.setUser);
  const setAuthLoading = useBlogStore((state) => state.setAuthLoading);
  const setSession = useBlogStore((state) => state.setSession);
  const clearSession = useBlogStore((state) => state.clearSession);
  const setPosts = useBlogStore((state) => state.setPosts);
  const setPostsLoading = useBlogStore((state) => state.setPostsLoading);
  const setPostsError = useBlogStore((state) => state.setPostsError);
  const setSelectedCategory = useBlogStore((state) => state.setSelectedCategory);
  const removePost = useBlogStore((state) => state.removePost);
  const hydrateSession = useBlogStore((state) => state.hydrateSession);
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [category, setCategory] = useState('Uncategorized');
  const [image, setImage] = useState(null);
  const [existingImage, setExistingImage] = useState('');
  const [removeCoverImage, setRemoveCoverImage] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [imageError, setImageError] = useState('');
  const [postLoading, setPostLoading] = useState(false);
  const [postMessage, setPostMessage] = useState('');
  const [postError, setPostError] = useState('');
  const [postDeleteError, setPostDeleteError] = useState('');
  const [deletingPostId, setDeletingPostId] = useState('');

  const imagePreview = useMemo(() => (
    image && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(image) : ''
  ), [image]);

  useEffect(() => {
    return () => {
      if (imagePreview && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  useEffect(() => {
    hydrateSession();
  }, [hydrateSession]);

  const loadPosts = useCallback(async () => {
    postsRequestController.current?.abort();
    const controller = new AbortController();
    postsRequestController.current = controller;
    setPostsLoading(true);
    setPostsError('');
    try {
      const options = {
        signal: controller.signal,
        ...(selectedCategory
          ? { params: { category: selectedCategory.toLowerCase() } }
          : {}),
      };
      const response = await api.get('/api/posts', options);
      if (!controller.signal.aborted) {
        setPosts(response.data.data.posts);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setPostsError(getErrorMessage(error));
      }
    } finally {
      if (postsRequestController.current === controller) {
        postsRequestController.current = null;
        setPostsLoading(false);
      }
    }
  }, [selectedCategory, setPosts, setPostsError, setPostsLoading]);

  useEffect(() => {
    if (location.pathname === '/') {
      loadPosts();
    }
    return () => {
      postsRequestController.current?.abort();
    };
  }, [loadPosts, location.pathname]);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setAuthLoading(false);
      return undefined;
    }

    let active = true;
    setAuthLoading(true);
    api.get('/api/users/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => {
        if (active) setUser(response.data.data.user);
      })
      .catch((error) => {
        if (!active) return;
        if (error.response?.status === 401) {
          clearSession();
        } else {
          setAuthError(getErrorMessage(error));
        }
      })
      .finally(() => {
        if (active) setAuthLoading(false);
      });

    return () => {
      active = false;
    };
  }, [clearSession, setAuthLoading, setUser, token]);

  async function handleAuthSubmit(event, values) {
    event.preventDefault();
    setAuthError('');
    if (values.mode === 'signup') {
      if (values.password !== values.confirmPassword) {
        setAuthError('Passwords do not match.');
        return;
      }
      if (getUtf8ByteLength(values.password) > 72) {
        setAuthError('Password must be no more than 72 bytes.');
        return;
      }
    }

    setAuthSubmitting(true);
    try {
      const endpoint = values.mode === 'signup' ? '/api/users/register' : '/api/users/login';
      let payload = { email: values.email, password: values.password };
      if (values.mode === 'signup') {
        payload = new FormData();
        payload.append('name', values.fullName.trim());
        payload.append('email', values.email);
        payload.append('password', values.password);
        if (values.profilePicture) {
          payload.append('profilePicture', values.profilePicture);
        }
      }
      const response = await api.post(endpoint, payload);
      const { token: nextToken, user: nextUser } = response.data.data;
      setSession(nextToken, nextUser);
      navigate('/');
    } catch (error) {
      setAuthError(getErrorMessage(error));
    } finally {
      setAuthSubmitting(false);
    }
  }

  function handleLogout() {
    clearSession();
    setPostMessage('');
    setPostError('');
    navigate('/');
  }

  function handleAccountDeleted(deletedUserId) {
    setPosts((currentPosts) => currentPosts.filter((post) => {
      const author = post?.author;
      const authorId = typeof author === 'string' ? author : author?.id || author?._id;
      return String(authorId) !== String(deletedUserId);
    }));
    const currentUserId = user?.id || user?._id;
    if (String(currentUserId) === String(deletedUserId)) {
      clearSession();
      setEditingPost(null);
      setTitle('');
      setContent('');
      setTags('');
      setCategory('Uncategorized');
      setImage(null);
      setExistingImage('');
      setRemoveCoverImage(false);
      setImageError('');
      setPostMessage('');
      setPostError('');
    }
  }

  function handleCategorySelect(category) {
    setSelectedCategory(category);
    if (location.pathname !== '/') {
      navigate('/');
    }
  }

  function handleStartEdit(post) {
    if (!isPostOwner(post, user)) {
      return;
    }

    const storedCategory = typeof post.category === 'string'
      ? post.category
      : getPostCategory(post);
    setEditingPost(post);
    setTitle(typeof post.title === 'string' ? post.title : '');
    setContent(typeof post.content === 'string' ? post.content : '');
    setTags(Array.isArray(post.tags)
      ? post.tags.filter((tag) => typeof tag === 'string').join(', ')
      : '');
    setCategory(
      CATEGORIES.find((item) => item.toLowerCase() === storedCategory.toLowerCase())
      || 'Uncategorized',
    );
    setImage(null);
    setExistingImage(typeof post.coverImage === 'string' ? post.coverImage : '');
    setRemoveCoverImage(false);
    setImageError('');
    setPostError('');
    setPostMessage('');
    const fileInput = document.getElementById('cover-image');
    if (fileInput) fileInput.value = '';
    if (location.pathname === '/') {
      document.getElementById('write')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    }
  }

  function handleCancelEdit() {
    setEditingPost(null);
    setTitle('');
    setContent('');
    setTags('');
    setCategory('Uncategorized');
    setImage(null);
    setExistingImage('');
    setRemoveCoverImage(false);
    setImageError('');
    setPostError('');
    setPostMessage('');
    const fileInput = document.getElementById('cover-image');
    if (fileInput) fileInput.value = '';
  }

  function handleUserUpdated(updatedUser) {
    setUser((currentUser) => ({ ...currentUser, ...updatedUser }));
  }

  async function handleDeletePost(post) {
    if (!token || !post?._id || !isPostOwner(post, user)) {
      return;
    }
    if (!window.confirm(`Delete “${post.title}”? This cannot be undone.`)) {
      return;
    }

    setDeletingPostId(post._id);
    setPostDeleteError('');
    try {
      await api.delete(`/api/posts/${encodeURIComponent(post._id)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      removePost(post._id);
      if (String(editingPost?._id) === String(post._id)) {
        handleCancelEdit();
      }
      if (location.pathname === `/post/${post._id}`) {
        navigate('/');
      }
    } catch (error) {
      if (error?.response?.status === 401) {
        handleLogout();
        setPostDeleteError('Your session has expired. Please log in again.');
      } else {
        setPostDeleteError(getErrorMessage(error));
      }
    } finally {
      setDeletingPostId('');
    }
  }

  function handleImageChange(event) {
    const selectedFile = event.target?.files?.[0] || null;
    setImageError('');
    setPostError('');
    if (selectedFile && !ALLOWED_IMAGE_TYPES.includes(selectedFile.type)) {
      setImage(null);
      setImageError('Choose a JPEG, PNG, or WebP image.');
      if (event.target) event.target.value = '';
      return;
    }
    if (selectedFile && selectedFile.size > MAX_IMAGE_SIZE) {
      setImage(null);
      setImageError('The image must be 5 MB or smaller.');
      if (event.target) event.target.value = '';
      return;
    }
    setImage(selectedFile);
    if (selectedFile) {
      setRemoveCoverImage(false);
    }
  }

  function handleRemoveImage() {
    if (editingPost && existingImage) {
      setRemoveCoverImage(true);
    }
    setImage(null);
    setExistingImage('');
    setImageError('');
    const input = document.getElementById('cover-image');
    if (input) input.value = '';
  }

  async function handleCreatePost(event) {
    const form = event?.currentTarget;
    if (!form) {
      setPostError('The story form is no longer available. Please try again.');
      return;
    }
    event.preventDefault();
    setPostError('');
    setPostMessage('');
    setPostLoading(true);
    const formData = new FormData();
    formData.append('title', title || '');
    formData.append('content', content || '');
    formData.append('tags', tags || '');
    formData.append('category', category || 'Uncategorized');
    if (image) formData.append('coverImage', image);

    try {
      const response = await api.post('/api/posts', formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const createdPost = response?.data?.data?.post;
      if (!createdPost) {
        throw new Error('The server did not return the published story.');
      }
      setPosts((currentPosts) => [createdPost, ...(Array.isArray(currentPosts) ? currentPosts : [])]);
      setTitle('');
      setContent('');
      setTags('');
      setCategory('Uncategorized');
      setImage(null);
      setExistingImage('');
      setRemoveCoverImage(false);
      setEditingPost(null);
      setImageError('');
      setPostMessage('Your post has been published.');
      form.reset?.();
    } catch (error) {
      if (error?.response?.status === 401) {
        handleLogout();
        setPostError('Your session has expired. Please log in again.');
      } else {
        setPostError(getErrorMessage(error));
      }
    } finally {
      setPostLoading(false);
    }
  }

  async function handleUpdatePost(event) {
    const form = event?.currentTarget;
    if (!form || !editingPost?._id) {
      setPostError('The story to edit is no longer available. Please try again.');
      return null;
    }
    event.preventDefault();
    setPostError('');
    setPostMessage('');
    setPostLoading(true);
    const formData = new FormData();
    formData.append('title', title || '');
    formData.append('content', content || '');
    formData.append('tags', tags || '');
    formData.append('category', category || 'Uncategorized');
    if (image) {
      formData.append('coverImage', image);
    } else if (removeCoverImage) {
      formData.append('removeCoverImage', 'true');
    }

    try {
      const response = await api.patch(`/api/posts/${encodeURIComponent(editingPost._id)}`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const updatedPost = response?.data?.data?.post;
      if (!updatedPost) {
        throw new Error('The server did not return the updated story.');
      }
      setPosts((currentPosts) => {
        const existingPosts = Array.isArray(currentPosts) ? currentPosts : [];
        const hasPost = existingPosts.some((post) => post?._id === updatedPost._id);
        return hasPost
          ? existingPosts.map((post) => (post?._id === updatedPost._id ? updatedPost : post))
          : [updatedPost, ...existingPosts];
      });
      setEditingPost(null);
      setTitle('');
      setContent('');
      setTags('');
      setCategory('Uncategorized');
      setImage(null);
      setExistingImage('');
      setRemoveCoverImage(false);
      setImageError('');
      setPostMessage('Your story has been updated.');
      form.reset?.();
      return updatedPost;
    } catch (error) {
      if (error?.response?.status === 401) {
        handleLogout();
        setPostError('Your session has expired. Please log in again.');
      } else {
        setPostError(getErrorMessage(error));
      }
      return null;
    } finally {
      setPostLoading(false);
    }
  }

  const visibleImagePreview = imagePreview || (existingImage ? getImageUrl(existingImage) : '');
  const composerProps = {
    title,
    setTitle,
    content,
    setContent,
    tags,
    setTags,
    category,
    setCategory,
    isEditing: Boolean(editingPost),
    existingImage,
    image,
    imagePreview: visibleImagePreview,
    onImageChange: handleImageChange,
    onRemoveImage: handleRemoveImage,
    imageError,
    postError,
    postMessage,
    postLoading,
    onSubmit: editingPost ? handleUpdatePost : handleCreatePost,
    onCancelEdit: handleCancelEdit,
  };

  return (
    <div className="blog-app min-h-screen bg-inkline-paper text-inkline-ink">
      <Header user={user} onLogout={handleLogout} />
      {authError && !['/signin', '/signup'].includes(location.pathname) && (
        <div className="global-error" role="alert">
          {authError}
          <button type="button" aria-label="Dismiss error" onClick={() => setAuthError('')}>×</button>
        </div>
      )}
      {authLoading ? (
        <main className="route-loading"><p className="status-message">Checking your session…</p></main>
      ) : (
        <Routes>
          <Route
            path="/"
            element={(
              <HomePage
                user={user}
                posts={posts}
                loading={postsLoading}
                error={postsError}
                onRetry={loadPosts}
                onEditPost={handleStartEdit}
                onDeletePost={handleDeletePost}
                deleteError={postDeleteError}
                deletingPostId={deletingPostId}
                composerProps={composerProps}
                selectedCategory={selectedCategory}
              />
            )}
          />
          <Route
            path="/authors"
            element={<AuthorsPage user={user} token={token} onAccountDeleted={handleAccountDeleted} />}
          />
          <Route
            path="/profile/:id"
            element={<ProfilePage user={user} token={token} onUserUpdated={handleUserUpdated} />}
          />
          <Route
            path="/post/:id"
            element={(
              <PostDetailPage
                user={user}
                editingPost={editingPost}
                composerProps={composerProps}
                onEdit={handleStartEdit}
                onDelete={handleDeletePost}
                deleteError={postDeleteError}
                deletingPostId={deletingPostId}
              />
            )}
          />
          <Route
            path="/signin"
            element={<AuthPage mode="login" error={authError} loading={authSubmitting} onSubmit={handleAuthSubmit} />}
          />
          <Route
            path="/signup"
            element={<AuthPage mode="signup" error={authError} loading={authSubmitting} onSubmit={handleAuthSubmit} />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
      <CategoryBar selectedCategory={selectedCategory} onSelect={handleCategorySelect} />
      <footer className="site-footer">
        <Brand footer />
        <span>A home for your thoughts.</span>
        <span>© {new Date().getFullYear()} INKLINE</span>
      </footer>
    </div>
  );
}

export default AppLayout;