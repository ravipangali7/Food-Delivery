#!/usr/bin/env python
"""Emergency schema repair — run on the server if /api/orders/ returns 500.

Usage (cPanel Terminal or SSH):
    cd ~/api.shyam-sweets.com
    source /path/to/virtualenv/bin/activate
    python repair_schema.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "fooddelivery.settings")

from core.startup import prepare_database

if __name__ == "__main__":
    prepare_database()
    print("Done. Restart the Python app in cPanel, then check /api/health/")
