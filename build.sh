#!/usr/bin/env bash
set -o errexit

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR/mysite"

pip install -r "$SCRIPT_DIR/requirements.txt"
cd "$PROJECT_DIR"
python manage.py collectstatic --no-input
python manage.py migrate
python manage.py create_default_superuser
python manage.py load_initial_products
