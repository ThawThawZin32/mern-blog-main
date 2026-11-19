const express = require('express');
const jwt = require('jsonwebtoken');
const Post = require('../models/Post');
const User = require('../models/User');
const { requireAuth, TOKEN_ISSUER } = require('../middleware/authMiddleware');
const HttpError = require('../utils/HttpError');
const {
  getUploadedImage,
  removeImageSafely,
  saveImage,
  uploadImage,
} = require('../utils/imageUpload');

const router = express.Router();
const rootRouter = express.Router();
const objectIdPattern = /^[a-f\d]{24}$/i;

function validateEmail(email) {
  return typeof email === 'string'
    && email.length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function createToken(userId) {
  return jwt.sign(
    { sub: String(userId) },
    process.env.JWT_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      issuer: TOKEN_ISSUER,
    },
  );
}

const registerHandler = async (req, res) => {
  const { email, password, username } = req.body || {};
  const name = req.body.name ?? req.body.username;
  const normalizedUsername = typeof username === 'string' ? username.trim().toLowerCase() : '';
  const hasEmail = email !== undefined && email !== null && email !== '';
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 80) {
    throw new HttpError(400, 'Name or username is required and must be 80 characters or fewer.');
  }
  if ((!hasEmail && !normalizedUsername) || (hasEmail && !validateEmail(email))) {
    throw new HttpError(400, 'A valid email address or username is required.');
  }
  if (
    typeof password !== 'string'
    || password.length < 8
    || Buffer.byteLength(password, 'utf8') > 72
  ) {
    throw new HttpError(400, 'Password must be at least 8 characters and no more than 72 bytes.');
  }

  const imageField = req.files && req.files.avatar ? 'avatar' : 'profilePicture';
  const image = getUploadedImage(req, imageField);
  const profilePicture = image ? await saveImage(image) : null;
  let user;
  try {
    user = await User.create({
      name: name.trim(),
      username: normalizedUsername || undefined,
      email: hasEmail ? email.trim().toLowerCase() : undefined,
      password,
      profilePicture,
    });
  } catch (error) {
    if (profilePicture) {
      await removeImageSafely(profilePicture);
    }
    throw error;
  }

  res.status(201).json({
    success: true,
    data: {
      user: {
        id: String(user._id),
        name: user.name,
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture,
        avatar: user.avatar,
        role: user.role,
      },
      token: createToken(user._id),
    },
  });
};
router.post('/register', uploadImage, registerHandler);
rootRouter.post('/register', uploadImage, registerHandler);

const loginHandler = async (req, res) => {
  const { email, password, username } = req.body || {};
  const normalizedUsername = typeof username === 'string' ? username.trim().toLowerCase() : '';
  const validEmail = validateEmail(email);
  if ((!validEmail && !normalizedUsername) || typeof password !== 'string') {
    throw new HttpError(400, 'A valid email or username and password are required.');
  }

  const user = await User.findOne(
    validEmail
      ? { email: email.trim().toLowerCase() }
      : { username: normalizedUsername },
  ).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw new HttpError(401, 'Email or password is incorrect.');
  }

  res.json({
    success: true,
    data: {
      user: {
        id: String(user._id),
        name: user.name,
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture,
        avatar: user.avatar,
        role: user.role,
      },
      token: createToken(user._id),
    },
  });
};
router.post('/login', loginHandler);
rootRouter.post('/login', loginHandler);

const uploadHandler = async (req, res) => {
  const image = getUploadedImage(req, 'avatar');
  if (!image) {
    throw new HttpError(400, 'Upload an image using the "avatar" field.');
  }

  const user = await User.findById(req.auth.userId);
  if (!user) {
    throw new HttpError(404, 'User not found.');
  }

  const avatar = await saveImage(image);
  const previousAvatar = user.profilePicture;
  user.profilePicture = avatar;
  try {
    await user.save();
  } catch (error) {
    await removeImageSafely(avatar);
    throw error;
  }

  if (previousAvatar) {
    await removeImageSafely(previousAvatar);
  }

  res.json({
    success: true,
    data: {
      user: {
        id: String(user._id),
        name: user.name,
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture,
        avatar: user.avatar,
      },
    },
  });
};
router.post('/upload', requireAuth, uploadImage, uploadHandler);
rootRouter.post('/upload', requireAuth, uploadImage, uploadHandler);

router.get('/authors', async (req, res) => {
  const [authors, postCounts] = await Promise.all([
    User.find().select('name username profilePicture createdAt').sort({ name: 1 }).lean(),
    Post.aggregate([
      { $group: { _id: '$author', postCount: { $sum: 1 } } },
    ]),
  ]);
  const countsByAuthor = new Map(
    postCounts.map(({ _id, postCount }) => [String(_id), postCount]),
  );

  res.json({
    success: true,
    data: {
      authors: authors.map((author) => ({
        id: String(author._id),
        name: author.name,
        username: author.username || author.name,
        profilePicture: author.profilePicture,
        postCount: countsByAuthor.get(String(author._id)) || 0,
      })),
    },
  });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.auth.userId)
    .select('name username email profilePicture role createdAt');
  if (!user) {
    throw new HttpError(404, 'User not found.');
  }

  res.json({ success: true, data: { user } });
});

router.get('/:id', async (req, res) => {
  if (!objectIdPattern.test(req.params.id)) {
    throw new HttpError(400, 'Invalid user ID.');
  }

  const user = await User.findById(req.params.id)
    .select('name username profilePicture createdAt')
    .lean();
  if (!user) {
    throw new HttpError(404, 'User not found.');
  }
  const postCount = await Post.countDocuments({ author: user._id });

  res.json({
    success: true,
    data: {
      user: {
        id: String(user._id),
        name: user.name,
        username: user.username,
        profilePicture: user.profilePicture,
        createdAt: user.createdAt,
        postCount,
      },
    },
  });
});

router.patch('/:id', requireAuth, async (req, res) => {
  if (!objectIdPattern.test(req.params.id)) {
    throw new HttpError(400, 'Invalid user ID.');
  }
  if (req.params.id !== req.auth.userId) {
    throw new HttpError(403, 'You can only update your own profile.');
  }

  const user = await User.findById(req.params.id).select('+password');
  if (!user) {
    throw new HttpError(404, 'User not found.');
  }

  const body = req.body || {};
  const hasName = Object.hasOwn(body, 'name');
  const hasUsername = Object.hasOwn(body, 'username');
  const hasEmail = Object.hasOwn(body, 'email');
  const hasNewPassword = Object.hasOwn(body, 'newPassword') && body.newPassword !== '';
  if (!hasName && !hasUsername && !hasEmail && !hasNewPassword) {
    throw new HttpError(400, 'Provide a name, username, email, or new password to update.');
  }
  if (hasName) {
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 80) {
      throw new HttpError(400, 'Name is required and must be 80 characters or fewer.');
    }
    user.name = body.name.trim();
  }
  if (hasUsername) {
    if (typeof body.username !== 'string' || body.username.trim().length > 80) {
      throw new HttpError(400, 'Username must be text and 80 characters or fewer.');
    }
    const username = body.username.trim().toLowerCase();
    if (username && username !== user.username) {
      const usernameInUse = await User.exists({
        username,
        _id: { $ne: user._id },
      });
      if (usernameInUse) {
        throw new HttpError(409, 'That username is already in use.');
      }
    }
    user.username = username || undefined;
  }
  if (hasEmail) {
    if (!validateEmail(body.email)) {
      throw new HttpError(400, 'A valid email address is required.');
    }
    const email = body.email.trim().toLowerCase();
    if (email !== user.email) {
      const emailInUse = await User.exists({
        email,
        _id: { $ne: user._id },
      });
      if (emailInUse) {
        throw new HttpError(409, 'That email address is already in use.');
      }
    }
    user.email = email;
  }
  if (hasNewPassword) {
    if (
      typeof body.currentPassword !== 'string'
      || !(await user.comparePassword(body.currentPassword))
    ) {
      throw new HttpError(401, 'Current password is incorrect.');
    }
    if (
      typeof body.newPassword !== 'string'
      || body.newPassword.length < 8
      || Buffer.byteLength(body.newPassword, 'utf8') > 72
    ) {
      throw new HttpError(400, 'New password must be at least 8 characters and no more than 72 bytes.');
    }
    user.password = body.newPassword;
  } else if (body.currentPassword) {
    throw new HttpError(400, 'Provide a new password to change your password.');
  }

  try {
    await user.save();
  } catch (saveError) {
    if (saveError.code === 11000) {
      const duplicateField = Object.keys(saveError.keyPattern || {})[0];
      throw new HttpError(
        409,
        duplicateField === 'username'
          ? 'That username is already in use.'
          : 'That email address is already in use.',
      );
    }
    throw saveError;
  }
  res.json({
    success: true,
    data: {
      user: {
        id: String(user._id),
        name: user.name,
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture,
        avatar: user.avatar,
        role: user.role,
      },
    },
  });
});

router.delete('/:id', requireAuth, async (req, res) => {
  if (!objectIdPattern.test(req.params.id)) {
    throw new HttpError(400, 'Invalid user ID.');
  }
  if (req.params.id !== req.auth.userId) {
    const requester = await User.findById(req.auth.userId).select('role');
    if (requester?.role !== 'admin') {
      throw new HttpError(403, 'You can only delete your own account or an admin can delete accounts.');
    }
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    throw new HttpError(404, 'User not found.');
  }

  const posts = await Post.find({ author: user._id }).select('coverImage').lean();
  await Post.deleteMany({ author: req.params.id });
  await Promise.all(posts.map((post) => (
    post.coverImage ? removeImageSafely(post.coverImage) : Promise.resolve()
  )));

  if (user.profilePicture) {
    await removeImageSafely(user.profilePicture);
  }

  await User.findByIdAndDelete(req.params.id);

  res.json({ success: true, message: 'User deleted.' });
});

module.exports = { rootRouter, router };
