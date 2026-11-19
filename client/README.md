# Inkline client

Inkline is the React client for the MERN blog. It keeps the existing custom CSS design and uses Tailwind utilities selectively; Tailwind's preflight reset is disabled so the utility layer does not replace the site's styles.

## Client stack

- React and React Router for the interface and routes.
- Axios for requests to the Express API.
- Zustand for the shared session, story feed, category selection, and author-directory state.
- TailwindCSS for small utilities and shared color tokens; the handcrafted styles remain in `src/App.css`.

## Routes and views

| Route | View |
| --- | --- |
| `/` | Latest-story feed, category filters, and the signed-in write form. Story owners can edit or delete their stories from the feed. |
| `/signin` | Sign-in form. |
| `/signup` | Account registration form. |
| `/authors` | Author directory and permitted account actions. |
| `/profile/:id` | Author profile and published stories; the signed-in owner can update their profile. |
| `/post/:id` | Full story view; the owner can edit or delete the story. |

Story editing is available from the owner's feed card or story detail. “My Posts” appears on the owner's profile; writing is available from the home-page composer. Static hosts must serve `index.html` for client-side routes so direct links and refreshes work.

## Run and validate

From this directory:

```powershell
npm install
npm start
```

The client uses Create React App, so `npm start` is the development command. Set `REACT_APP_API_URL` to the backend origin when it is not `http://localhost:5000`.

```powershell
npm test -- --watchAll=false --runInBand
npm run build
```

The API paths remain under `/api`: the client reads `/api/posts`, `/api/posts/:id`, `/api/users/authors`, `/api/users/:id`, and `/api/users/me`; it creates and updates posts through `/api/posts` and `/api/posts/:id`, and deletes an owned post through `DELETE /api/posts/:id`. Protected requests send the saved bearer token.

## Backend

From the repository's `server` directory, configure MongoDB and the JWT secret in the server's environment file, then run `npm install` and `npm run dev`. Do not commit the environment file or real Postman credentials. Run server checks with `npm test`.
