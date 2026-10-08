#!/usr/bin/env bash
set -e

echo "Create new venv from requirements.txt"
uv venv --python 3.12 /tmp/lockenv
VIRTUAL_ENV=/tmp/lockenv uv pip install pip -r requirements.txt

echo "Rewrite requirements.lock"
/tmp/lockenv/bin/pip freeze > requirements.lock.txt
rm -rf /tmp/lockenv

echo "Install deps"
.venv/bin/pip install -r requirements.lock.txt -r requirements-dev.txt

echo "Done"
