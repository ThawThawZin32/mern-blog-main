# Inkline — MERN Blog

Inkline is a full-stack blog application for publishing and discovering stories. It includes account registration and sign-in, author profiles, story categories, cover images, and owner-controlled story and profile editing.

## Project structure

```text
client/   React application (Create React App)
server/   Express API and MongoDB models
postman/  Postman API collection and workspace resources
```

The client uses React Router, Axios, Zustand, and TailwindCSS alongside the project's custom CSS. See [`client/README.md`](client/README.md) for client routes and details.

## Requirements

- Node.js and npm
- MongoDB, either local or hosted

## Run locally

### 1. Configure and start the API

From the repository root in PowerShell:

```powershell
Copy-Item server\.env.example server\.env
```

Edit `server\.env` and set `MONGO_URI` and a private `JWT_SECRET` of at least 32 bytes. `PORT` defaults to `5000`.

```powershell
Set-Location server
npm install
npm run dev
```

The API is available at `http://localhost:5000`; its health check is `http://localhost:5000/api/health`.

### 2. Start the React client

Open a second terminal at the repository root:

```powershell
Set-Location client
npm install
npm start
```

The client defaults to the API at `http://localhost:5000`. To use another API origin, set `REACT_APP_API_URL` before starting the client.

## Tests and production build

Run the API tests from `server`:

```powershell
npm test
```

Run client tests and create a production build from `client`:

```powershell
npm test -- --watchAll=false --runInBand
npm run build
```

When deploying the client to a static host, configure it to serve `index.html` for client-side routes such as `/post/:id` and `/profile/:id`.

## Security notes

- Keep `server\.env` private; never commit real MongoDB credentials or JWT secrets.
- Use a private, randomly generated JWT secret in deployed environments.
- Configure the client API URL for the environment where the API is hosted.
