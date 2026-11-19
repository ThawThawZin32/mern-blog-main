import { create } from 'zustand';
import { TOKEN_STORAGE_KEY } from '../services/api';

function readStoredToken() {
  return typeof localStorage === 'undefined'
    ? ''
    : localStorage.getItem(TOKEN_STORAGE_KEY) || '';
}

const initialToken = readStoredToken();
const initialState = {
  token: initialToken,
  user: null,
  authLoading: Boolean(initialToken),
  posts: [],
  postsLoading: true,
  postsError: '',
  selectedCategory: '',
  authors: [],
  authorsLoading: false,
};

export const useBlogStore = create((set) => ({
  ...initialState,
  hydrateSession: () => {
    const token = readStoredToken();
    set({ token, authLoading: Boolean(token) });
  },
  setSession: (token, user) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    set({ token, user, authLoading: false });
  },
  setUser: (userOrUpdater) => set((state) => ({
    user: typeof userOrUpdater === 'function'
      ? userOrUpdater(state.user)
      : userOrUpdater,
  })),
  setAuthLoading: (authLoading) => set({ authLoading }),
  clearSession: () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    set({ token: '', user: null, authLoading: false });
  },
  setPosts: (postsOrUpdater) => set((state) => ({
    posts: typeof postsOrUpdater === 'function'
      ? postsOrUpdater(state.posts)
      : postsOrUpdater,
  })),
  setPostsLoading: (postsLoading) => set({ postsLoading }),
  setPostsError: (postsError) => set({ postsError }),
  setSelectedCategory: (selectedCategory) => set({ selectedCategory }),
  removePost: (postId) => set((state) => ({
    posts: state.posts.filter((post) => String(post?._id) !== String(postId)),
  })),
  setAuthors: (authorsOrUpdater) => set((state) => ({
    authors: typeof authorsOrUpdater === 'function'
      ? authorsOrUpdater(state.authors)
      : authorsOrUpdater,
  })),
  setAuthorsLoading: (authorsLoading) => set({ authorsLoading }),
  reset: () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    set({
      ...initialState,
      token: '',
      authLoading: false,
      posts: [],
      postsLoading: true,
      authors: [],
      authorsLoading: false,
    });
  },
}));
