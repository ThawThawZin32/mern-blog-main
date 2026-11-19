const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const jwt = require('jsonwebtoken');
const app = require('../app');
const Post = require('../models/Post');
const User = require('../models/User');
const { TOKEN_ISSUER } = require('../middleware/authMiddleware');

let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test('user model exposes username and avatar without serializing passwords', () => {
  const user = new User({
    name: 'New Writer',
    username: 'new-writer',
    email: 'new@example.com',
    password: 'password123',
    profilePicture: '/uploads/avatar.png',
  });

  assert.equal(user.username, 'new-writer');
  assert.equal(user.avatar, '/uploads/avatar.png');
  assert.equal(user.role, 'user');
  const serializedUser = user.toJSON();
  assert.equal(serializedUser.avatar, '/uploads/avatar.png');
  assert.equal('password' in serializedUser, false);
});

test('health endpoint returns a successful status', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    data: { status: 'ok' },
  });
});

test('user profile requires a bearer token', async () => {
  const response = await fetch(`${baseUrl}/api/users/me`);
  assert.equal(response.status, 401);
  assert.equal((await response.json()).success, false);
});

test('account deletion requires a bearer token', async () => {
  const response = await fetch(`${baseUrl}/api/users/507f1f77bcf86cd799439011`, {
    method: 'DELETE',
  });
  assert.equal(response.status, 401);
});

test('account deletion rejects an authenticated user targeting another account', async () => {
  const ownerId = '507f1f77bcf86cd799439011';
  const targetId = '507f1f77bcf86cd799439012';
  const previousSecret = process.env.JWT_SECRET;
  const originalExists = User.exists;
  const originalFindById = User.findById;
  process.env.JWT_SECRET = 'api-test-secret';
  User.exists = async () => true;
  User.findById = () => ({ select: async () => ({ role: 'user' }) });

  try {
    const token = jwt.sign({ sub: ownerId }, process.env.JWT_SECRET, {
      algorithm: 'HS256',
      issuer: TOKEN_ISSUER,
    });
    const response = await fetch(`${baseUrl}/api/users/${targetId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 403);
    assert.match((await response.json()).message, /only delete your own account/i);
  } finally {
    User.exists = originalExists;
    User.findById = originalFindById;
    if (previousSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousSecret;
    }
  }
});

test('admins can delete another account and its posts', async () => {
  const adminId = '507f1f77bcf86cd799439011';
  const targetId = '507f1f77bcf86cd799439012';
  const previousSecret = process.env.JWT_SECRET;
  const originalExists = User.exists;
  const originalUserFindById = User.findById;
  const originalUserFindByIdAndDelete = User.findByIdAndDelete;
  const originalPostFind = Post.find;
  const originalPostDeleteMany = Post.deleteMany;
  process.env.JWT_SECRET = 'api-test-secret';
  User.exists = async () => true;
  User.findById = (id) => {
    if (id === adminId) {
      return { select: async () => ({ role: 'admin' }) };
    }
    return Promise.resolve({ _id: targetId, profilePicture: null });
  };
  User.findByIdAndDelete = async () => ({ acknowledged: true });
  Post.find = () => ({
    select() {
      return this;
    },
    lean: async () => [{ coverImage: null }],
  });
  Post.deleteMany = async () => ({ deletedCount: 1 });

  try {
    const token = jwt.sign({ sub: adminId }, process.env.JWT_SECRET, {
      algorithm: 'HS256',
      issuer: TOKEN_ISSUER,
    });
    const response = await fetch(`${baseUrl}/api/users/${targetId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      success: true,
      message: 'User deleted.',
    });
  } finally {
    User.exists = originalExists;
    User.findById = originalUserFindById;
    User.findByIdAndDelete = originalUserFindByIdAndDelete;
    Post.find = originalPostFind;
    Post.deleteMany = originalPostDeleteMany;
    if (previousSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousSecret;
    }
  }
});

test('profile update requires authentication', async () => {
  const response = await fetch(`${baseUrl}/api/users/507f1f77bcf86cd799439011`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Updated Writer' }),
  });
  assert.equal(response.status, 401);
});

test('profile update rejects an authenticated user targeting another account', async () => {
  const ownerId = '507f1f77bcf86cd799439011';
  const targetId = '507f1f77bcf86cd799439012';
  const previousSecret = process.env.JWT_SECRET;
  const originalExists = User.exists;
  process.env.JWT_SECRET = 'api-test-secret';
  User.exists = async () => true;

  try {
    const token = jwt.sign({ sub: ownerId }, process.env.JWT_SECRET, {
      algorithm: 'HS256',
      issuer: TOKEN_ISSUER,
    });
    const response = await fetch(`${baseUrl}/api/users/${targetId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Updated Writer' }),
    });
    assert.equal(response.status, 403);
  } finally {
    User.exists = originalExists;
    if (previousSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousSecret;
    }
  }
});

test('an owner can update their profile without changing their role', async () => {
  const userId = '507f1f77bcf86cd799439011';
  const previousSecret = process.env.JWT_SECRET;
  const originalExists = User.exists;
  const originalFindById = User.findById;
  const user = {
    _id: userId,
    name: 'Test Writer',
    username: 'test-writer',
    email: 'writer@example.com',
    profilePicture: null,
    avatar: null,
    role: 'user',
    save: async () => {},
  };
  process.env.JWT_SECRET = 'api-test-secret';
  User.exists = async (filter) => {
    if (typeof filter?._id === 'string') {
      return filter._id === userId;
    }
    return filter?.username === 'taken';
  };
  User.findById = () => ({ select: async () => user });

  try {
    const token = jwt.sign({ sub: userId }, process.env.JWT_SECRET, {
      algorithm: 'HS256',
      issuer: TOKEN_ISSUER,
    });
    const response = await fetch(`${baseUrl}/api/users/${userId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Updated Writer',
        username: 'Updated-Writer',
        email: 'writer@example.com',
        role: 'admin',
      }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      success: true,
      data: {
        user: {
          id: userId,
          name: 'Updated Writer',
          username: 'updated-writer',
          email: 'writer@example.com',
          profilePicture: null,
          avatar: null,
          role: 'user',
        },
      },
    });

    const invalidUsernameResponse = await fetch(`${baseUrl}/api/users/${userId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username: 'x'.repeat(81) }),
    });
    assert.equal(invalidUsernameResponse.status, 400);

    const duplicateUsernameResponse = await fetch(`${baseUrl}/api/users/${userId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username: 'taken' }),
    });
    assert.equal(duplicateUsernameResponse.status, 409);
  } finally {
    User.exists = originalExists;
    User.findById = originalFindById;
    if (previousSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousSecret;
    }
  }
});

test('public user profile rejects malformed IDs before querying the database', async () => {
  const response = await fetch(`${baseUrl}/api/users/not-an-id`);
  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /Invalid user ID/);
});

test('registration validates input before accessing the database', async () => {
  const response = await fetch(`${baseUrl}/api/users/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /Name or username is required/);
});

test('username-only registration validates avatar images', async () => {
  const formData = new FormData();
  formData.append('username', 'new-writer');
  formData.append('password', 'password123');
  formData.append('avatar', new Blob(['not a png'], { type: 'image/png' }), 'avatar.png');

  const response = await fetch(`${baseUrl}/api/register`, {
    method: 'POST',
    body: formData,
  });
  assert.equal(response.status, 415);
  assert.match((await response.json()).message, /not a valid image/);
});

test('root login alias validates required credentials', async () => {
  const response = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /valid email or username and password/);
});

test('avatar upload requires authentication', async () => {
  const response = await fetch(`${baseUrl}/api/upload`, { method: 'POST' });
  assert.equal(response.status, 401);
});

test('registration validates uploaded profile pictures before accessing the database', async () => {
  const formData = new FormData();
  formData.append('name', 'New Writer');
  formData.append('email', 'new@example.com');
  formData.append('password', 'password123');
  formData.append(
    'profilePicture',
    new Blob(['not a png'], { type: 'image/png' }),
    'profile.png',
  );

  const response = await fetch(`${baseUrl}/api/users/register`, {
    method: 'POST',
    body: formData,
  });
  assert.equal(response.status, 415);
  assert.match((await response.json()).message, /not a valid image/);
});

test('post creation requires authentication', async () => {
  const response = await fetch(`${baseUrl}/api/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'A sample title', content: 'A sample post.' }),
  });
  assert.equal(response.status, 401);
});

test('post update supports PUT and requires authentication', async () => {
  const response = await fetch(`${baseUrl}/api/posts/507f1f77bcf86cd799439011`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Updated title' }),
  });
  assert.equal(response.status, 401);
});

test('post deletion requires authentication', async () => {
  const response = await fetch(`${baseUrl}/api/posts/507f1f77bcf86cd799439011`, {
    method: 'DELETE',
  });
  assert.equal(response.status, 401);
});

test('a post owner can delete their story', async () => {
  const ownerId = '507f1f77bcf86cd799439011';
  const postId = '507f1f77bcf86cd799439012';
  const previousSecret = process.env.JWT_SECRET;
  const originalExists = User.exists;
  const originalFindById = Post.findById;
  let deleted = false;
  process.env.JWT_SECRET = 'api-test-secret';
  User.exists = async () => true;
  Post.findById = async () => ({
    author: ownerId,
    coverImage: null,
    deleteOne: async () => {
      deleted = true;
    },
  });

  try {
    const token = jwt.sign({ sub: ownerId }, process.env.JWT_SECRET, {
      algorithm: 'HS256',
      issuer: TOKEN_ISSUER,
    });
    const response = await fetch(`${baseUrl}/api/posts/${postId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      success: true,
      message: 'Post deleted.',
    });
    assert.equal(deleted, true);
  } finally {
    User.exists = originalExists;
    Post.findById = originalFindById;
    if (previousSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousSecret;
    }
  }
});

test('a user cannot delete another author’s story', async () => {
  const userId = '507f1f77bcf86cd799439011';
  const authorId = '507f1f77bcf86cd799439012';
  const postId = '507f1f77bcf86cd799439013';
  const previousSecret = process.env.JWT_SECRET;
  const originalExists = User.exists;
  const originalFindById = Post.findById;
  let deleted = false;
  process.env.JWT_SECRET = 'api-test-secret';
  User.exists = async () => true;
  Post.findById = async () => ({
    author: authorId,
    coverImage: null,
    deleteOne: async () => {
      deleted = true;
    },
  });

  try {
    const token = jwt.sign({ sub: userId }, process.env.JWT_SECRET, {
      algorithm: 'HS256',
      issuer: TOKEN_ISSUER,
    });
    const response = await fetch(`${baseUrl}/api/posts/${postId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 403);
    assert.match((await response.json()).message, /only delete your own posts/i);
    assert.equal(deleted, false);
  } finally {
    User.exists = originalExists;
    Post.findById = originalFindById;
    if (previousSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousSecret;
    }
  }
});

test('post routes reject malformed IDs before querying the database', async () => {
  const response = await fetch(`${baseUrl}/api/posts/not-an-id`);
  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /Invalid post ID/);
});

test('post list validates pagination before querying the database', async () => {
  const response = await fetch(`${baseUrl}/api/posts?page=0`);
  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /Page must be positive/);
});

test('post list rejects unsupported categories before querying the database', async () => {
  const response = await fetch(`${baseUrl}/api/posts?category=not-a-category`);
  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /Invalid post category/);
});

test('unknown API routes return a JSON 404', async () => {
  const response = await fetch(`${baseUrl}/api/missing`);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).success, false);
});
