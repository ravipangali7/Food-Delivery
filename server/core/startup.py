"""Passenger/cPanel startup: migrations + known schema gap repair."""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

# Columns that were added in code before migrate ran on production.
def _schema_repair_definitions() -> tuple[tuple[str, str, str], ...]:
    from django.db import connection

    variant_sql = "INTEGER NULL" if connection.vendor == "sqlite" else "BIGINT NULL"
    return (
        (
            "orders",
            "pre_order_time_slot",
            "varchar(64) NOT NULL DEFAULT ''",
        ),
        (
            "order_items",
            "variant_id",
            variant_sql,
        ),
    )

# Order columns that may be absent on older DBs — reads defer them instead of failing.
_OPTIONAL_ORDER_COLUMNS: tuple[str, ...] = ("pre_order_time_slot",)
_OPTIONAL_ORDER_ITEM_FIELDS: tuple[str, ...] = ("variant",)

_column_exists_cache: dict[tuple[str, str], bool] = {}


def _column_names(cursor, table: str) -> set[str]:
    from django.db import connection

    try:
        description = connection.introspection.get_table_description(cursor, table)
        return {col.name for col in description}
    except Exception:
        if connection.vendor != "mysql":
            raise
        cursor.execute(
            """
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s
            """,
            [table],
        )
        return {row[0] for row in cursor.fetchall()}


def _add_column(cursor, table: str, column: str, definition: str) -> None:
    from django.db import connection

    vendor = connection.vendor
    if vendor == "sqlite":
        cursor.execute(f'ALTER TABLE "{table}" ADD COLUMN "{column}" {definition}')
        return
    if vendor == "mysql":
        cursor.execute(f"ALTER TABLE `{table}` ADD COLUMN `{column}` {definition}")
        return
    if vendor == "postgresql":
        cursor.execute(f'ALTER TABLE "{table}" ADD COLUMN IF NOT EXISTS "{column}" {definition}')
        return
    cursor.execute(f'ALTER TABLE "{table}" ADD COLUMN "{column}" {definition}')


def table_has_column(table: str, column: str) -> bool:
    """Return whether *column* exists on *table* (cached per process)."""
    key = (table, column)
    cached = _column_exists_cache.get(key)
    if cached is not None:
        return cached
    from django.db import connection

    try:
        with connection.cursor() as cursor:
            existing = _column_names(cursor, table)
        exists = column in existing
    except Exception:
        logger.exception("startup: could not check column %s.%s", table, column)
        exists = True
    _column_exists_cache[key] = exists
    if not exists:
        logger.warning("startup: missing column %s.%s", table, column)
    return exists


_table_exists_cache: dict[str, bool] = {}


def table_exists(table: str) -> bool:
    """Return whether *table* exists (cached per process)."""
    cached = _table_exists_cache.get(table)
    if cached is not None:
        return cached
    from django.db import connection

    try:
        with connection.cursor() as cursor:
            tables = set(connection.introspection.table_names(cursor))
        exists = table in tables
    except Exception:
        logger.exception("startup: could not inspect tables for %s", table)
        exists = True
    _table_exists_cache[table] = exists
    if not exists:
        logger.warning("startup: missing table %s", table)
    return exists


def invalidate_column_cache() -> None:
    _column_exists_cache.clear()
    _table_exists_cache.clear()


def order_queryset_compat(qs):
    """Defer optional order columns that are not present in the live database."""
    from core.models import Order

    table = Order._meta.db_table
    for column in _OPTIONAL_ORDER_COLUMNS:
        if not table_has_column(table, column):
            qs = qs.defer(column)
    return qs


def order_item_queryset_compat(qs):
    """Defer optional order-item fields that are not present in the live database."""
    from core.models import OrderItem

    table = OrderItem._meta.db_table
    if not table_has_column(table, "variant_id"):
        qs = qs.defer(*_OPTIONAL_ORDER_ITEM_FIELDS)
    return qs


def order_items_prefetch_queryset():
    """Prefetch queryset for order line items, tolerant of older schemas."""
    from core.models import OrderItem

    qs = OrderItem.objects.select_related("product").prefetch_related("product__images")
    variants_table = "product_variants"
    if table_exists(variants_table) and table_has_column(OrderItem._meta.db_table, "variant_id"):
        qs = qs.select_related("variant", "variant__unit")
    return order_item_queryset_compat(qs)


def repair_known_schema_gaps() -> None:
    """Add columns that migrations may have missed after a partial deploy."""
    from django.db import connection

    with connection.cursor() as cursor:
        for table, column, definition in _schema_repair_definitions():
            try:
                existing = _column_names(cursor, table)
            except Exception:
                logger.exception("startup: could not inspect table %s", table)
                continue
            if column in existing:
                continue
            try:
                _add_column(cursor, table, column, definition)
                invalidate_column_cache()
                logger.warning("startup: added missing column %s.%s", table, column)
            except Exception:
                logger.exception("startup: failed to add column %s.%s", table, column)


def prepare_database() -> None:
    """Run pending migrations, then patch any known schema gaps."""
    import django

    django.setup()
    from django.core.management import call_command

    try:
        call_command("migrate", "--noinput", verbosity=1)
    except Exception:
        logger.exception("startup: migrate failed")
    repair_known_schema_gaps()


def serialize_with_schema_repair(serializer_class, instance, *, many: bool = False):
    """Serialize queryset/model; auto-repair schema gaps and defer missing columns."""
    from django.db.models import Model, QuerySet
    from django.db.utils import DatabaseError

    def _prepare(value):
        if isinstance(value, QuerySet):
            return order_queryset_compat(value)
        if isinstance(value, Model):
            return order_queryset_compat(
                value.__class__.objects.filter(pk=value.pk)
            ).first()
        return value

    prepared = _prepare(instance)

    try:
        return serializer_class(prepared, many=many).data
    except DatabaseError:
        logger.warning("serialize_with_schema_repair: database error, repairing schema")
        repair_known_schema_gaps()
        invalidate_column_cache()
        prepared = _prepare(instance)
        return serializer_class(prepared, many=many).data
