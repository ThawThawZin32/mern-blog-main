const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    minlength: 3,
    maxlength: 160,
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50000,
  },
  tags: {
    type: [{
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 30,
    }],
    default: [],
  },
  category: {
    type: String,
    enum: [
      'agriculture',
      'business',
      'education',
      'entertainment',
      'art',
      'investment',
      'uncategorized',
      'weather',
    ],
  },
  coverImage: {
    type: String,
    default: null,
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
}, {
  timestamps: true,
});

postSchema.index({ createdAt: -1 });

module.exports = mongoose.models.Post || mongoose.model('Post', postSchema);
