const express = require('express');
const mongoose = require('mongoose');
const Post = require('../models/Post');
const { requireAuth } = require('../middleware/authMiddleware');
const HttpError = require('../utils/HttpError');
const {
  deleteCoverImage,
  getUploadedImage,
  removeCoverImageSafely,
  saveCoverImage,
  uploadImage,
} = require('../utils/imageUpload');

const router = express.Router();
const objectIdPattern = /^[a-f\d]{24}$/i;
const categories = new Set([
  'agriculture',
  'business',
  'education',
  'entertainment',
  'art',
  'investment',
  'uncategorized',
  'weather',
]);

function parseTags(value) {
  if (value === undefined) {
    return [];
  }
  if (typeof value !== 'string' && !Array.isArray(value)) {
    throw new HttpError(400, 'Tags must be a comma-separated string or an array.');
  }

  const tags = (Array.isArray(value) ? value : value.split(','))
    .map((tag) => {
      if (typeof tag !== 'string') {
        throw new HttpError(400, 'Each tag must be text.');
      }
      return tag.trim().toLowerCase();
    })
    .filter(Boolean);

  const uniqueTags = [...new Set(tags)];
  if (uniqueTags.length > 10 || uniqueTags.some((tag) => tag.length > 30)) {
    throw new HttpError(400, 'Posts can have up to 10 tags, each 30 characters or fewer.');
  }
  return uniqueTags;
}

function readPostFields(body, { partial = false } = {}) {
  const fields = {};

  if (!partial || Object.hasOwn(body, 'title')) {
    if (typeof body.title !== 'string' || body.title.trim().length < 3 || body.title.trim().length > 160) {
      throw new HttpError(400, 'Title must be between 3 and 160 characters.');
    }
    fields.title = body.title.trim();
  }

  if (!partial || Object.hasOwn(body, 'content')) {
    if (typeof body.content !== 'string' || !body.content.trim() || body.content.trim().length > 50000) {
      throw new HttpError(400, 'Content is required and must be 50,000 characters or fewer.');
    }
    fields.content = body.content.trim();
  }

  if (!partial || Object.hasOwn(body, 'tags')) {
    fields.tags = parseTags(body.tags);
  }

  if (Object.hasOwn(body, 'category')) {
    if (typeof body.category !== 'string' || !categories.has(body.category.trim().toLowerCase())) {
      throw new HttpError(400, 'Invalid post category.');
    }
    fields.category = body.category.trim().toLowerCase();
  }

  return fields;
}

function parsePagination(query) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 10 : Number(query.limit);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new HttpError(400, 'Page must be positive and limit must be between 1 and 50.');
  }
  return { page, limit };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function listPosts(req, res, authorId) {
  const { page, limit } = parsePagination(req.query);
  const filter = {};
  const conditions = [];
  if (authorId) {
    filter.author = authorId;
  } else if (req.query.author !== undefined) {
    if (typeof req.query.author !== 'string' || !objectIdPattern.test(req.query.author)) {
      throw new HttpError(400, 'Invalid author ID.');
    }
    filter.author = req.query.author;
  }
  if (req.query.tag !== undefined) {
    if (typeof req.query.tag !== 'string' || !req.query.tag.trim()) {
      throw new HttpError(400, 'Tag filter must not be empty.');
    }
    conditions.push({ tags: req.query.tag.trim().toLowerCase() });
  }
  if (req.query.category !== undefined) {
    if (
      typeof req.query.category !== 'string'
      || !categories.has(req.query.category.trim().toLowerCase())
    ) {
      throw new HttpError(400, 'Invalid post category.');
    }
    const category = req.query.category.trim().toLowerCase();
    conditions.push(category === 'uncategorized'
      ? {
        $or: [
          { category: 'uncategorized' },
          {
            category: { $exists: false },
            $or: [{ tags: { $exists: false } }, { tags: { $size: 0 } }],
          },
        ],
      }
      : {
        $or: [
          { category },
          { category: { $exists: false }, tags: category },
        ],
      });
  }
  if (req.query.search !== undefined) {
    if (typeof req.query.search !== 'string' || req.query.search.length > 100) {
      throw new HttpError(400, 'Search must be 100 characters or fewer.');
    }
    const search = new RegExp(escapeRegex(req.query.search.trim()), 'i');
    conditions.push({ $or: [{ title: search }, { content: search }] });
  }
  if (conditions.length > 0) {
    filter.$and = conditions;
  }

  const [posts, total] = await Promise.all([
    Post.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('author', 'name profilePicture'),
    Post.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: {
      posts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
}

router.get('/', async (req, res) => listPosts(req, res));
router.get('/mine', requireAuth, async (req, res) => listPosts(req, res, req.auth.userId));

router.get('/:id', async (req, res) => {
  if (!objectIdPattern.test(req.params.id)) {
    throw new HttpError(400, 'Invalid post ID.');
  }

  const post = await Post.findById(req.params.id).populate('author', 'name profilePicture');
  if (!post) {
    throw new HttpError(404, 'Post not found.');
  }
  res.json({ success: true, data: { post } });
});

router.post('/', requireAuth, uploadImage, async (req, res) => {
  const fields = readPostFields(req.body || {});
  const image = getUploadedImage(req);
  const coverImage = image ? await saveCoverImage(image) : null;

  try {
    const post = await Post.create({
      ...fields,
      coverImage,
      author: new mongoose.Types.ObjectId(req.auth.userId),
    });
    await post.populate('author', 'name profilePicture');
    res.status(201).json({ success: true, data: { post } });
  } catch (error) {
    if (coverImage) {
      await removeCoverImageSafely(coverImage);
    }
    throw error;
  }
});

const updatePostHandler = async (req, res) => {
  if (!objectIdPattern.test(req.params.id)) {
    throw new HttpError(400, 'Invalid post ID.');
  }

  const post = await Post.findById(req.params.id);
  if (!post) {
    throw new HttpError(404, 'Post not found.');
  }
  if (String(post.author) !== req.auth.userId) {
    throw new HttpError(403, 'You can only edit or delete your own posts.');
  }

  const fields = readPostFields(req.body || {}, { partial: true });
  const image = getUploadedImage(req);
  const removeCoverImage = req.body?.removeCoverImage;
  if (removeCoverImage !== undefined && removeCoverImage !== 'true' && removeCoverImage !== 'false') {
    throw new HttpError(400, 'removeCoverImage must be true or false.');
  }
  const shouldRemoveCoverImage = removeCoverImage === 'true';
  if (Object.keys(fields).length === 0 && !image && !shouldRemoveCoverImage) {
    throw new HttpError(400, 'Provide at least one post field or a cover image to update.');
  }

  let newCoverImage;
  const oldCoverImage = post.coverImage;
  try {
    if (image) {
      newCoverImage = await saveCoverImage(image);
      post.coverImage = newCoverImage;
    } else if (shouldRemoveCoverImage) {
      post.coverImage = null;
    }
    Object.assign(post, fields);
    await post.save();
    await post.populate('author', 'name profilePicture');
  } catch (error) {
    if (newCoverImage) {
      await removeCoverImageSafely(newCoverImage);
    }
    throw error;
  }

  if ((newCoverImage || shouldRemoveCoverImage) && oldCoverImage) {
    await removeCoverImageSafely(oldCoverImage);
  }
  res.json({ success: true, data: { post } });
};
router.patch('/:id', requireAuth, uploadImage, updatePostHandler);
router.put('/:id', requireAuth, uploadImage, updatePostHandler);

router.delete('/:id', requireAuth, async (req, res) => {
  if (!objectIdPattern.test(req.params.id)) {
    throw new HttpError(400, 'Invalid post ID.');
  }

  const post = await Post.findById(req.params.id);
  if (!post) {
    throw new HttpError(404, 'Post not found.');
  }
  if (String(post.author) !== req.auth.userId) {
    throw new HttpError(403, 'You can only delete your own posts');
  }

  await post.deleteOne();
  await removeCoverImageSafely(post.coverImage);
  res.json({ success: true, message: 'Post deleted.' });
});

module.exports = router;
