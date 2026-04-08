# Deploying Mother Julie on Render

## What was added

- `render.yaml` for a Render Blueprint deployment
- `build.sh` to install dependencies, collect static files, and run migrations
- `requirements.txt` with the packages needed for production
- Production-safe Django settings in `mysite/mysite/settings.py`

## Render Setup

1. Push this repository to GitHub.
2. In Render, click `New +` and choose `Blueprint`.
3. Select this repository.
4. Create a Render PostgreSQL database.
5. Copy the database's internal connection string into the web service's `DATABASE_URL` environment variable.
6. Fill in these secret environment variables:
   `EMAIL_HOST_USER`
   `EMAIL_HOST_PASSWORD`
   `PAYMONGO_PUBLIC_KEY`
   `PAYMONGO_SECRET_KEY`
   `LALAMOVE_API_KEY`
   `LALAMOVE_API_SECRET`
   `PAYMONGO_QRPH_BASIC_AUTH` (only if you use that flow)
7. Deploy the blueprint.

## Important

- If `DATABASE_URL` is left empty, the app falls back to SQLite. That is fine for local work, but not reliable on Render because the service filesystem is ephemeral.
- Static files are handled by WhiteNoise.
- Uploaded media files are still stored on the web service filesystem and can be lost during redeploys unless you move them to persistent storage or object storage.
