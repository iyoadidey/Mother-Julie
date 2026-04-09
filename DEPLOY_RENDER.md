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
   - `EMAIL_HOST_USER` (Gmail: noreply.motherjulie@gmail.com)
   - `EMAIL_HOST_PASSWORD` (Gmail app password)
   - `DEFAULT_FROM_EMAIL` (optional: Mother Julie <noreply.motherjulie@gmail.com>)
   - `SERVER_EMAIL` (optional: noreply.motherjulie@gmail.com)
   - `PAYMONGO_PUBLIC_KEY`
   - `PAYMONGO_SECRET_KEY`
   - `LALAMOVE_API_KEY`
   - `LALAMOVE_API_SECRET`
   - `PAYMONGO_QRPH_BASIC_AUTH` (only if you use that flow)
7. Deploy the blueprint.

## Important

- If `DATABASE_URL` is left empty, the app falls back to SQLite. That is fine for local work, but not reliable on Render because the service filesystem is ephemeral.
- Static files are handled by WhiteNoise.
- Uploaded media files are still stored on the web service filesystem and can be lost during redeploys unless you move them to persistent storage or object storage.

## Automatic Setup During Deployment

The `build.sh` script automatically runs several commands during deployment:

1. **Creates Default Superuser**: 
   - Username: `admin`
   - Password: `motherjulie`
   - Can login to `/admin/` and `/admin_dashboard/`

2. **Loads Initial Products**: 
   - Automatically loads sample products if the database is empty
   - Products are marked as `show_in_all_menu=True` and visible in Orders Menu

3. **Email Configuration**:
   - Uses environment variables for Gmail SMTP settings
   - Automatically sends order e-receipts to customer emails
   - Requires valid `EMAIL_HOST_USER` and `EMAIL_HOST_PASSWORD` environment variables

## Troubleshooting

### Products Not Showing in Orders Menu
- Check that products exist in the database (`/admin/` → Products)
- Ensure products have `show_in_all_menu` unchecked ✓
- If no products exist, run: `python manage.py load_initial_products`

### Emails Not Sending
- Verify `EMAIL_HOST_USER` and `EMAIL_HOST_PASSWORD` are set in Render environment variables
- Check Render logs for SMTP errors
- For Gmail, use an [App Password](https://myaccount.google.com/apppasswords), not your regular password
- Ensure customer email addresses are captured when orders are placed
