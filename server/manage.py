#!/usr/bin/env python
"""Django प्रशासनिक कार्यका लागि command-line उपकरण।"""
import os
import sys


def main():
    """प्रशासनिक कार्यहरू चलाउनुहोस्।"""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fooddelivery.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
