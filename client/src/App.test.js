import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import App from './App';
import { useBlogStore } from './stores/blogStore';

jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  })),
}));

const api = axios.create.mock.results[0].value;

beforeEach(() => {
  localStorage.clear();
  useBlogStore.getState().reset();
  window.history.pushState({}, '', '/');
  api.get.mockReset();
  api.post.mockReset();
  api.patch.mockReset();
  api.delete.mockReset();
  api.get.mockImplementation((url) => Promise.resolve({
    data: {
      success: true,
      data: url === '/api/users/me'
        ? { user: { id: 'user-1', name: 'Test Writer', email: 'writer@example.com' } }
        : { posts: [] },
    },
  }));
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('home shows latest stories and navigation links without auth forms', async () => {
  render(<App />);

  expect(screen.getByRole('heading', { name: /latest stories/i })).toBeInTheDocument();
  const navigation = screen.getByRole('navigation', { name: /main navigation/i });
  expect(navigation).toHaveTextContent('Authors');
  expect(navigation).toHaveTextContent('Login');
  expect(navigation).not.toHaveTextContent('Home');
  expect(navigation).not.toHaveTextContent('Sign up');
  expect(screen.getByRole('link', { name: 'Authors' })).toHaveAttribute('href', '/authors');
  expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/signin');
  expect(screen.queryByLabelText(/email address/i)).not.toBeInTheDocument();
  expect(await screen.findByText(/the first page is yours/i)).toBeInTheDocument();
});

test('category buttons filter the home feed and show the empty category state', async () => {
  api.get.mockResolvedValue({
    data: { success: true, data: { posts: [] } },
  });
  render(<App />);

  fireEvent.click(await screen.findByRole('button', { name: 'Agriculture' }));

  expect(await screen.findByRole('heading', { name: 'No Posts found' })).toBeInTheDocument();
  expect(api.get).toHaveBeenLastCalledWith('/api/posts', expect.objectContaining({
    params: { category: 'agriculture' },
    signal: expect.any(Object),
  }));
  expect(screen.getByRole('button', { name: 'Agriculture' })).toHaveAttribute('aria-pressed', 'true');
});

test('ignores a story response from a previous category request', async () => {
  let resolveStaleRequest;
  const staleRequest = new Promise((resolve) => {
    resolveStaleRequest = resolve;
  });
  const currentStory = {
    _id: 'current-post',
    title: 'Agriculture story',
    content: 'The current category result.',
    author: { name: 'Current Writer' },
  };
  api.get.mockImplementation((_url, options) => {
    if (options?.params?.category === 'agriculture') {
      return Promise.resolve({
        data: { success: true, data: { posts: [currentStory] } },
      });
    }
    return staleRequest;
  });

  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Agriculture' }));

  expect(await screen.findByRole('heading', { name: 'Agriculture story' })).toBeInTheDocument();
  await act(async () => {
    resolveStaleRequest({
      data: {
        success: true,
        data: {
          posts: [{
            _id: 'stale-post',
            title: 'Stale story',
            content: 'An outdated category result.',
            author: { name: 'Old Writer' },
          }],
        },
      },
    });
    await staleRequest;
  });

  expect(screen.queryByRole('heading', { name: 'Stale story' })).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Agriculture story' })).toBeInTheDocument();
});

test('authors page shows profile cards and post counts', async () => {
  api.get.mockImplementation((url) => Promise.resolve({
    data: {
      success: true,
      data: url === '/api/users/authors'
        ? {
          authors: [{
            id: 'author-1',
            name: 'A Writer',
            username: 'a-writer',
            profilePicture: '/uploads/author.jpg',
            postCount: 3,
          }],
        }
        : { posts: [] },
    },
  }));
  render(<App />);

  fireEvent.click(screen.getByRole('link', { name: 'Authors' }));

  expect(await screen.findByRole('heading', { name: 'Our authors' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /a writer.*3 posts/i })).toHaveAttribute(
    'href',
    '/profile/author-1',
  );
  expect(screen.getByRole('img', { name: 'Portrait of A Writer' })).toBeInTheDocument();
});

test('authors page confirms own-account deletion and updates the list count', async () => {
  localStorage.setItem('mern-blog-token', 'test-jwt-token');
  api.get.mockImplementation((url) => Promise.resolve({
    data: {
      success: true,
      data: url === '/api/users/me'
        ? { user: { id: 'user-1', name: 'Test Writer', email: 'writer@example.com' } }
        : url === '/api/users/authors'
          ? {
            authors: [
              { id: 'user-1', name: 'Test Writer', username: 'test-writer', postCount: 2 },
              { id: 'user-2', name: 'Another Writer', username: 'another-writer', postCount: 1 },
            ],
          }
          : { posts: [] },
    },
  }));
  api.delete.mockResolvedValue({ data: { success: true, message: 'User deleted.' } });
  const confirmSpy = jest.spyOn(window, 'confirm')
    .mockReturnValueOnce(false)
    .mockReturnValueOnce(true);

  render(<App />);
  fireEvent.click(screen.getByRole('link', { name: 'Authors' }));

  const deleteButton = await screen.findByRole('button', { name: "Delete Test Writer's account" });
  expect(screen.getAllByRole('button', { name: /delete .* account/i })).toHaveLength(1);
  expect(screen.queryByRole('button', { name: "Delete Another Writer's account" })).not.toBeInTheDocument();
  expect(screen.getByText('02 AUTHORS')).toBeInTheDocument();

  fireEvent.click(deleteButton);
  expect(api.delete).not.toHaveBeenCalled();
  expect(screen.getByText('02 AUTHORS')).toBeInTheDocument();

  fireEvent.click(deleteButton);
  await waitFor(() => {
    expect(api.delete).toHaveBeenCalledWith('/api/users/user-1', {
      headers: { Authorization: 'Bearer test-jwt-token' },
    });
  });
  expect(await screen.findByText('01 AUTHORS')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /test writer.*2 posts/i })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /another writer.*1 post/i })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Login' })).toBeInTheDocument();
  confirmSpy.mockRestore();
});

test('admins can delete other authors without losing their own session', async () => {
  localStorage.setItem('mern-blog-token', 'admin-token');
  api.get.mockImplementation((url) => Promise.resolve({
    data: {
      success: true,
      data: url === '/api/users/me'
        ? { user: { id: 'admin-1', name: 'Site Admin', role: 'admin' } }
        : url === '/api/users/authors'
          ? {
            authors: [
              { id: 'admin-1', name: 'Site Admin', username: 'site-admin', postCount: 0 },
              { id: 'user-2', name: 'Another Writer', username: 'another-writer', postCount: 2 },
            ],
          }
          : { posts: [] },
    },
  }));
  api.delete.mockResolvedValue({ data: { success: true, message: 'User deleted.' } });
  const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);

  render(<App />);
  fireEvent.click(screen.getByRole('link', { name: 'Authors' }));

  fireEvent.click(await screen.findByRole('button', { name: "Delete Another Writer's account" }));
  await waitFor(() => {
    expect(api.delete).toHaveBeenCalledWith('/api/users/user-2', {
      headers: { Authorization: 'Bearer admin-token' },
    });
  });
  expect(await screen.findByText('01 AUTHORS')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /site admin.*0 posts/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Login' })).not.toBeInTheDocument();
  confirmSpy.mockRestore();
});

test('own profile edits are saved through the authenticated profile API', async () => {
  localStorage.setItem('mern-blog-token', 'profile-token');
  window.history.pushState({}, '', '/profile/user-1');
  api.get.mockImplementation((url) => Promise.resolve({
    data: {
      success: true,
      data: url === '/api/users/me'
        ? { user: { id: 'user-1', name: 'Test Writer', email: 'writer@example.com' } }
        : url === '/api/users/user-1'
          ? { user: { id: 'user-1', name: 'Test Writer', username: 'test-writer', postCount: 0 } }
          : { posts: [] },
    },
  }));
  api.patch.mockResolvedValue({
    data: {
      success: true,
      data: {
        user: {
          id: 'user-1',
          name: 'Updated Writer',
          username: 'test-writer',
          email: 'writer@example.com',
        },
      },
    },
  });
  render(<App />);

  fireEvent.change(await screen.findByLabelText('Name'), {
    target: { value: 'Updated Writer' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

  await waitFor(() => {
    expect(api.patch).toHaveBeenCalledWith(
      '/api/users/user-1',
      { name: 'Updated Writer', username: 'test-writer', email: 'writer@example.com' },
      { headers: { Authorization: 'Bearer profile-token' } },
    );
  });
  expect(await screen.findByRole('status')).toHaveTextContent('Your profile has been updated.');
});

test('editing a profile from Authors updates the author card without a refresh', async () => {
  localStorage.setItem('mern-blog-token', 'profile-token');
  let profile = {
    id: 'user-1',
    name: 'Test Writer',
    username: 'test-writer',
    email: 'writer@example.com',
    profilePicture: null,
    postCount: 2,
  };
  api.get.mockImplementation((url) => Promise.resolve({
    data: {
      success: true,
      data: url === '/api/users/me'
        ? { user: { ...profile, role: 'user' } }
        : url === '/api/users/authors'
          ? {
            authors: [{
              id: profile.id,
              name: profile.name,
              username: profile.username,
              profilePicture: profile.profilePicture,
              postCount: profile.postCount,
            }],
          }
          : url === '/api/users/user-1'
            ? { user: profile }
            : { posts: [] },
    },
  }));
  api.patch.mockImplementation(async (_url, payload) => {
    profile = { ...profile, ...payload };
    return { data: { success: true, data: { user: profile } } };
  });

  render(<App />);
  fireEvent.click(screen.getByRole('link', { name: 'Authors' }));
  fireEvent.click(await screen.findByRole('link', { name: "Edit Test Writer's profile" }));

  fireEvent.change(await screen.findByLabelText('Name'), {
    target: { value: 'Updated Writer' },
  });
  fireEvent.change(screen.getByLabelText('Username'), {
    target: { value: 'updated-writer' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Your profile has been updated.');
  expect(screen.getByRole('heading', { name: 'Updated Writer' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('link', { name: 'Authors' }));
  expect(await screen.findByRole('link', {
    name: /updated writer.*@updated-writer.*2 posts/i,
  })).toBeInTheDocument();
});

test('renders posts as responsive cards with images, titles, and descriptions', async () => {
  api.get.mockResolvedValueOnce({
    data: {
      success: true,
      data: {
        posts: [
          {
            _id: 'post-1',
            title: 'The quiet garden',
            content: 'A short story about making room to grow.',
            coverImage: '/uploads/garden.jpg',
            tags: ['nature'],
            author: { name: 'A Writer', profilePicture: '/uploads/author.jpg' },
            createdAt: new Date(Date.now() - (2 * 24 * 60 * 60 * 1000)).toISOString(),
          },
          {
            _id: 'post-2',
            title: 'Notes from the coast',
            content: 'A morning walk beside the sea.',
            coverImage: null,
            tags: [],
            author: { name: 'Another Writer' },
            createdAt: new Date(Date.now() - (8 * 24 * 60 * 60 * 1000)).toISOString(),
          },
        ],
      },
    },
  });

  const { container } = render(<App />);

  expect(await screen.findByRole('heading', { name: 'The quiet garden' })).toBeInTheDocument();
  expect(screen.getByText('A short story about making room to grow.')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'The quiet garden cover' })).toHaveAttribute(
    'src',
    'http://localhost:5000/uploads/garden.jpg',
  );
  expect(screen.getByRole('img', { name: 'Portrait of A Writer' })).toHaveAttribute(
    'src',
    'http://localhost:5000/uploads/author.jpg',
  );
  expect(screen.getByText('A Writer')).toBeInTheDocument();
  expect(screen.getByText('2 days ago')).toBeInTheDocument();
  expect(screen.getByRole('list', { name: 'The quiet garden category' })).toHaveTextContent('nature');
  expect(screen.getByText('INKLINE JOURNAL')).toBeInTheDocument();
  expect(container.querySelector('.story-grid')).toBeInTheDocument();
  expect(screen.getAllByRole('article')).toHaveLength(2);
});

test('clicking a story card opens its full post detail page', async () => {
  const story = {
    _id: 'post-1',
    title: 'The long road home',
    content: 'The complete story starts here.\n\nThe second paragraph carries the full ending.',
    coverImage: '/uploads/road.jpg',
    tags: ['travel', 'reflection'],
    author: { name: 'A Writer', profilePicture: '/uploads/author.jpg' },
    createdAt: new Date().toISOString(),
  };
  api.get.mockImplementation((url) => Promise.resolve({
    data: {
      success: true,
      data: url === '/api/posts' ? { posts: [story] } : { post: story },
    },
  }));

  render(<App />);
  fireEvent.click(await screen.findByRole('link', { name: 'Read story: The long road home' }));

  expect(await screen.findByRole('heading', { name: 'The long road home', level: 1 })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/post/post-1');
  expect(screen.getByText(/The complete story starts here/)).toHaveTextContent(
    'The complete story starts here. The second paragraph carries the full ending.',
  );
  expect(screen.getByRole('list', { name: 'Tags' })).toHaveTextContent('travel');
  expect(screen.getByText('A Writer')).toBeInTheDocument();
  expect(api.get).toHaveBeenLastCalledWith('/api/posts/post-1');
});

test('signup route shows only signup form and registers through the API', async () => {
  api.post.mockResolvedValueOnce({
    data: {
      success: true,
      data: {
        token: 'new-user-token',
        user: { id: 'user-2', name: 'New Writer', email: 'new@example.com' },
      },
    },
  });

  render(<App />);
  fireEvent.click(screen.getByRole('link', { name: /create an account/i }));

  expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/profile picture/i)).toHaveAttribute('type', 'file');
  expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: /latest stories/i })).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText(/full name/i), {
    target: { value: 'New Writer' },
  });
  const profilePicture = new File(['profile image'], 'profile.png', { type: 'image/png' });
  fireEvent.change(screen.getByLabelText(/profile picture/i), {
    target: { files: [profilePicture] },
  });
  fireEvent.change(screen.getByLabelText(/email address/i), {
    target: { value: 'new@example.com' },
  });
  fireEvent.change(screen.getByLabelText(/^password$/i), {
    target: { value: 'password123' },
  });
  fireEvent.change(screen.getByLabelText(/confirm password/i), {
    target: { value: 'password123' },
  });
  fireEvent.click(screen.getByRole('button', { name: /create account/i }));

  await waitFor(() => {
    expect(api.post).toHaveBeenCalledWith('/api/users/register', expect.any(FormData));
  });
  const [, registrationData] = api.post.mock.calls[0];
  expect(registrationData.get('name')).toBe('New Writer');
  expect(registrationData.get('email')).toBe('new@example.com');
  expect(registrationData.get('password')).toBe('password123');
  expect(registrationData.get('profilePicture')).toBe(profilePicture);
  expect(await screen.findByRole('heading', { name: /write a story/i })).toBeInTheDocument();
  expect(localStorage.getItem('mern-blog-token')).toBe('new-user-token');
});

test('signin route shows only signin form', async () => {
  render(<App />);
  fireEvent.click(screen.getByRole('link', { name: 'Login' }));

  expect(await screen.findByRole('heading', { name: /^sign in$/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
  expect(screen.queryByLabelText(/full name/i)).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: /latest stories/i })).not.toBeInTheDocument();
});

test('does not register when passwords do not match', async () => {
  render(<App />);
  fireEvent.click(screen.getByRole('link', { name: /create an account/i }));
  fireEvent.change(screen.getByLabelText(/full name/i), {
    target: { value: 'New Writer' },
  });
  fireEvent.change(screen.getByLabelText(/email address/i), {
    target: { value: 'new@example.com' },
  });
  fireEvent.change(screen.getByLabelText(/^password$/i), {
    target: { value: 'password123' },
  });
  fireEvent.change(screen.getByLabelText(/confirm password/i), {
    target: { value: 'different123' },
  });
  fireEvent.click(screen.getByRole('button', { name: /create account/i }));

  expect(await screen.findByRole('alert')).toHaveTextContent(/passwords do not match/i);
  expect(api.post).not.toHaveBeenCalled();
});

test('logs in and shows the image-enabled story form with tag and category choices', async () => {
  api.post.mockResolvedValueOnce({
    data: {
      success: true,
      data: {
        token: 'test-jwt-token',
        user: { id: 'user-1', name: 'Test Writer', email: 'writer@example.com' },
      },
    },
  });

  render(<App />);
  fireEvent.click(screen.getByRole('link', { name: 'Login' }));
  fireEvent.change(screen.getByLabelText(/email address/i), {
    target: { value: 'writer@example.com' },
  });
  fireEvent.change(screen.getByLabelText(/password/i), {
    target: { value: 'password123' },
  });
  fireEvent.click(await screen.findByRole('button', { name: /^log in/i }));

  expect(await screen.findByRole('heading', { name: /write a story/i })).toBeInTheDocument();
  const navigation = screen.getByRole('navigation', { name: /main navigation/i });
  expect(navigation.querySelectorAll('a, button')).toHaveLength(4);
  expect(screen.getByRole('link', { name: 'Authors' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /test writer/i })).toHaveAttribute('href', '/profile/user-1');
  expect(screen.getByRole('link', { name: /create post/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument();
  expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/your story/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/add a cover image/i)).toBeInTheDocument();
  const tagsInput = screen.getByRole('combobox', { name: /tags/i });
  fireEvent.focus(tagsInput);
  expect(screen.getByRole('listbox', { name: /tag suggestions/i })).toBeInTheDocument();
  fireEvent.change(tagsInput, { target: { value: 'tech' } });
  fireEvent.click(screen.getByRole('option', { name: 'Technology' }));
  expect(tagsInput).toHaveValue('Technology');
  const categorySelect = screen.getByLabelText('Category');
  expect(Array.from(categorySelect.options).map((option) => option.value)).toEqual([
    'Uncategorized',
    'Agriculture',
    'Business',
    'Education',
    'Entertainment',
    'Art',
    'Investment',
    'Weather',
  ]);
  expect(localStorage.getItem('mern-blog-token')).toBe('test-jwt-token');
});

test('publishes the new story as multipart form data with the JWT', async () => {
  api.post
    .mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          token: 'test-jwt-token',
          user: { id: 'user-1', name: 'Test Writer', email: 'writer@example.com' },
        },
      },
    })
    .mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          post: {
            _id: 'post-1',
            title: 'A new story',
            content: 'Hello from the blog.',
            tags: ['ideas'],
            author: { name: 'Test Writer' },
            createdAt: '2026-11-11T00:00:00.000Z',
          },
        },
      },
    });

  render(<App />);
    fireEvent.click(screen.getByRole('link', { name: 'Login' }));
    fireEvent.change(screen.getByLabelText(/email address/i), {
    target: { value: 'writer@example.com' },
  });
  fireEvent.change(screen.getByLabelText(/password/i), {
    target: { value: 'password123' },
  });
  fireEvent.click(await screen.findByRole('button', { name: /^log in/i }));

  fireEvent.change(await screen.findByLabelText(/title/i), {
    target: { value: 'A new story' },
  });
  fireEvent.change(screen.getByLabelText(/your story/i), {
    target: { value: 'Hello from the blog.' },
  });
  fireEvent.change(screen.getByLabelText(/tags/i), {
    target: { value: 'ideas' },
  });
  fireEvent.change(screen.getByLabelText('Category'), {
    target: { value: 'Education' },
  });
  fireEvent.click(screen.getByRole('button', { name: /publish story/i }));

  await waitFor(() => {
    expect(api.post).toHaveBeenCalledTimes(2);
  });
  const [url, formData, options] = api.post.mock.calls[1];
  expect(url).toBe('/api/posts');
  expect(formData).toBeInstanceOf(FormData);
  expect(formData.get('title')).toBe('A new story');
  expect(formData.get('content')).toBe('Hello from the blog.');
  expect(formData.get('tags')).toBe('ideas');
  expect(formData.get('category')).toBe('Education');
  expect(options.headers.Authorization).toBe('Bearer test-jwt-token');
  expect(await screen.findByText(/your post has been published/i)).toBeInTheDocument();
});

test('loads an owned story into the editor and saves all story fields', async () => {
  const story = {
    _id: 'post-1',
    title: 'The original title',
    content: 'The original story.',
    tags: ['ideas', 'travel'],
    category: 'education',
    coverImage: '/uploads/old-cover.jpg',
    author: { _id: 'user-1', name: 'Test Writer' },
    createdAt: new Date().toISOString(),
  };
  const updatedStory = {
    ...story,
    title: 'The revised title',
    content: 'The revised story.',
    tags: ['science'],
    category: 'art',
    coverImage: '/uploads/new-cover.jpg',
  };
  localStorage.setItem('mern-blog-token', 'test-jwt-token');
  api.get.mockImplementation((url) => Promise.resolve({
    data: {
      success: true,
      data: url === '/api/users/me'
        ? { user: { id: 'user-1', name: 'Test Writer', email: 'writer@example.com' } }
        : url === '/api/posts/post-1'
          ? { post: api.patch.mock.calls.length > 0 ? updatedStory : story }
          : { posts: [story] },
    },
  }));
  api.patch.mockResolvedValue({
    data: { success: true, data: { post: updatedStory } },
  });

  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Edit story: The original title' }));

  expect(screen.getByRole('heading', { name: 'Edit story' })).toBeInTheDocument();
  expect(screen.getByLabelText('Title')).toHaveValue('The original title');
  expect(screen.getByLabelText(/your story/i)).toHaveValue('The original story.');
  expect(screen.getByLabelText(/tags/i)).toHaveValue('ideas, travel');
  expect(screen.getByLabelText('Category')).toHaveValue('Education');
  expect(screen.getByRole('img', { name: 'Cover preview' })).toHaveAttribute(
    'src',
    'http://localhost:5000/uploads/old-cover.jpg',
  );

  fireEvent.change(screen.getByLabelText('Title'), {
    target: { value: 'The revised title' },
  });
  fireEvent.change(screen.getByLabelText(/your story/i), {
    target: { value: 'The revised story.' },
  });
  fireEvent.change(screen.getByLabelText(/tags/i), {
    target: { value: 'science' },
  });
  fireEvent.change(screen.getByLabelText('Category'), {
    target: { value: 'Art' },
  });
  const newCover = new File(['cover image'], 'cover.png', { type: 'image/png' });
  fireEvent.change(screen.getByLabelText(/current cover image/i), {
    target: { files: [newCover] },
  });
  fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

  await waitFor(() => {
    expect(api.patch).toHaveBeenCalledTimes(1);
  });
  const [url, formData, options] = api.patch.mock.calls[0];
  expect(url).toBe('/api/posts/post-1');
  expect(formData.get('title')).toBe('The revised title');
  expect(formData.get('content')).toBe('The revised story.');
  expect(formData.get('tags')).toBe('science');
  expect(formData.get('category')).toBe('Art');
  expect(formData.get('coverImage')).toBe(newCover);
  expect(options.headers.Authorization).toBe('Bearer test-jwt-token');
  expect(await screen.findByRole('heading', { name: 'The revised title' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('link', { name: 'Read story: The revised title' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Edit story' }));
  expect(screen.getByRole('heading', { name: 'Edit story' })).toBeInTheDocument();
  expect(screen.getByLabelText('Title')).toHaveValue('The revised title');
});

test('confirms post deletion and removes the story from the feed', async () => {
  const story = {
    _id: 'post-delete-1',
    title: 'A story to remove',
    content: 'This story is no longer needed.',
    tags: [],
    author: { _id: 'user-1', name: 'Test Writer' },
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem('mern-blog-token', 'writer-token');
  api.get.mockImplementation((url) => Promise.resolve({
    data: {
      success: true,
      data: url === '/api/users/me'
        ? { user: { id: 'user-1', name: 'Test Writer' } }
        : { posts: [story] },
    },
  }));
  api.delete.mockResolvedValue({ data: { success: true, message: 'Post deleted.' } });
  const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);

  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Delete story: A story to remove' }));

  await waitFor(() => {
    expect(api.delete).toHaveBeenCalledWith('/api/posts/post-delete-1', {
      headers: { Authorization: 'Bearer writer-token' },
    });
  });
  expect(confirmSpy).toHaveBeenCalledWith('Delete “A story to remove”? This cannot be undone.');
  expect(await screen.findByRole('heading', { name: 'The first page is yours.' })).toBeInTheDocument();
  expect(screen.queryByText('A story to remove')).not.toBeInTheDocument();
});

test('shows a post deletion error and keeps the story when the API rejects deletion', async () => {
  const story = {
    _id: 'post-delete-2',
    title: 'A protected story',
    content: 'The story remains available.',
    tags: [],
    author: { _id: 'user-1', name: 'Test Writer' },
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem('mern-blog-token', 'writer-token');
  api.get.mockImplementation((url) => Promise.resolve({
    data: {
      success: true,
      data: url === '/api/users/me'
        ? { user: { id: 'user-1', name: 'Test Writer' } }
        : { posts: [story] },
    },
  }));
  api.delete.mockRejectedValue({
    message: 'Request failed',
    response: { status: 500, data: { message: 'Could not delete the story.' } },
  });
  jest.spyOn(window, 'confirm').mockReturnValue(true);

  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Delete story: A protected story' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete the story.');
  expect(screen.getByRole('link', { name: 'Read story: A protected story' })).toBeInTheDocument();
});
