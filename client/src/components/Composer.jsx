import { useState } from 'react';
import { CATEGORIES, TAG_SUGGESTIONS } from '../lib/blog';

export function Composer({
  title,
  setTitle,
  content,
  setContent,
  tags,
  setTags,
  category,
  setCategory,
  isEditing,
  existingImage,
  image,
  imagePreview,
  onImageChange,
  onRemoveImage,
  imageError,
  postError,
  postMessage,
  postLoading,
  onSubmit,
  onCancelEdit,
}) {
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const tagParts = (typeof tags === 'string' ? tags : '').split(',');
  const currentTag = tagParts[tagParts.length - 1].trim();
  const existingTags = tagParts.slice(0, -1).map((tag) => tag.trim().toLowerCase());
  const tagSuggestions = TAG_SUGGESTIONS.filter((suggestion) => (
    (!currentTag || suggestion.toLowerCase().includes(currentTag.toLowerCase()))
    && !existingTags.includes(suggestion.toLowerCase())
  ));

  function handleTagSuggestion(suggestion) {
    const completedTags = [...tagParts.slice(0, -1), suggestion]
      .map((tag) => tag.trim())
      .filter(Boolean);
    setTags(completedTags.join(', '));
    setShowTagSuggestions(false);
  }

  return (
    <section className="panel compose-panel" id="write" aria-labelledby="compose-heading">
      <div className="panel-kicker">
        <span className="panel-icon" aria-hidden="true">✳</span>
        <span>YOUR SPACE</span>
      </div>
      <div className="compose-heading">
        <h2 id="compose-heading">{isEditing ? 'Edit story' : 'Write a story'}</h2>
        {isEditing && (
          <button className="button-quiet" type="button" onClick={onCancelEdit}>Cancel</button>
        )}
      </div>
      <p className="panel-description">
        {isEditing ? 'Update your story and publish the changes.' : 'A good story starts with a first line.'}
      </p>
      <form className="compose-form" onSubmit={onSubmit}>
        <label htmlFor="post-title">Title</label>
        <input
          id="post-title"
          name="title"
          type="text"
          placeholder="Give your story a title"
          minLength="3"
          maxLength="160"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
        <label htmlFor="post-content">Your story</label>
        <textarea
          id="post-content"
          name="content"
          placeholder="Start writing here…"
          maxLength="50000"
          rows="6"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          required
        />
        <label htmlFor="post-tags">Tags <span className="optional-label">OPTIONAL</span></label>
        <div
          className="tag-autocomplete"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setShowTagSuggestions(false);
            }
          }}
        >
          <input
            id="post-tags"
            name="tags"
            type="text"
            placeholder="design, travel, ideas"
            value={typeof tags === 'string' ? tags : ''}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showTagSuggestions}
            aria-controls="tag-suggestions"
            onFocus={() => setShowTagSuggestions(true)}
            onChange={(event) => {
              setTags(event.target?.value || '');
              setShowTagSuggestions(true);
            }}
          />
          {showTagSuggestions && (
            <div className="tag-suggestion-list" id="tag-suggestions" role="listbox" aria-label="Tag suggestions">
              {tagSuggestions.length > 0 ? tagSuggestions.map((suggestion) => (
                <button
                  className="tag-suggestion"
                  key={suggestion}
                  type="button"
                  role="option"
                  aria-selected="false"
                  onClick={() => handleTagSuggestion(suggestion)}
                >
                  {suggestion}
                </button>
              )) : (
                <span className="tag-suggestion-empty" role="status">No matching suggestions</span>
              )}
            </div>
          )}
        </div>
        <p className="field-hint">Separate tags with commas (up to 10).</p>
        <label htmlFor="post-category">Category</label>
        <select
          id="post-category"
          name="category"
          value={typeof category === 'string' ? category : 'Uncategorized'}
          onChange={(event) => setCategory(event.target?.value || 'Uncategorized')}
        >
          {['Uncategorized', ...CATEGORIES.filter((item) => item !== 'Uncategorized')].map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <label className="upload-label" htmlFor="cover-image">
          <span className="upload-icon" aria-hidden="true">↥</span>
          <span>
            <strong>{image ? image.name : existingImage ? 'Current cover image' : 'Add a cover image'}</strong>
            <small>JPEG, PNG or WebP · up to 5 MB · optional</small>
          </span>
          <span className="upload-action">BROWSE</span>
        </label>
        <input
          className="visually-hidden"
          id="cover-image"
          name="coverImage"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={onImageChange}
        />
        {imagePreview && (
          <div className="image-preview-wrap">
            <img className="image-preview" src={imagePreview} alt="Cover preview" />
            <button className="remove-image" type="button" onClick={onRemoveImage}>
              Remove image
            </button>
          </div>
        )}
        {imageError && <p className="form-error" role="alert">{imageError}</p>}
        {postError && <p className="form-error" role="alert">{postError}</p>}
        {postMessage && <p className="form-success" role="status">{postMessage}</p>}
        <button className="button button-dark submit-button" type="submit" disabled={postLoading}>
          {postLoading ? (isEditing ? 'Saving…' : 'Publishing…') : (isEditing ? 'Save changes' : 'Publish story')}
          {!postLoading && <span aria-hidden="true">↗</span>}
        </button>
      </form>
    </section>
  );
}
