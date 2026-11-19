import axios from 'axios';

export const API_BASE_URL = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
export const TOKEN_STORAGE_KEY = 'mern-blog-token';
export const api = axios.create({ baseURL: API_BASE_URL });

export function getErrorMessage(error) {
  return error?.response?.data?.message || error?.message || 'Something went wrong. Please try again.';
}

export function getImageUrl(imagePath) {
  if (!imagePath) {
    return '';
  }
  if (/^https?:\/\//i.test(imagePath)) {
    return imagePath;
  }
  return `${API_BASE_URL}/${imagePath.replace(/^\/+/, '')}`;
}
