const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 80,
  },
  username: {
    type: String,
    trim: true,
    lowercase: true,
    maxlength: 80,
    unique: true,
    sparse: true,
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true,
    maxlength: 254,
  },
  profilePicture: {
    type: String,
    default: null,
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  password: {
    type: String,
    required: true,
    select: false,
  },
}, {
  timestamps: true,
  toJSON: {
    transform(_document, value) {
      delete value.password;
      delete value.__v;
      return value;
    },
  },
});

userSchema.pre('save', async function hashPassword() {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12);
  }
});

userSchema.virtual('avatar')
  .get(function getAvatar() {
    return this.profilePicture;
  })
  .set(function setAvatar(value) {
    this.profilePicture = value;
  });

userSchema.methods.comparePassword = function comparePassword(password) {
  return bcrypt.compare(password, this.password);
};

userSchema.set('toJSON', {
  ...userSchema.get('toJSON'),
  virtuals: true,
});

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
