import logging
import sys

from django.apps import AppConfig

logger = logging.getLogger(__name__)


class CoreConfig(AppConfig):
    name = "core"

    def ready(self) -> None:
        if any(cmd in sys.argv for cmd in ("migrate", "makemigrations", "test")):
            return

        def run_repair(**kwargs):
            from django.db.backends.signals import connection_created

            connection_created.disconnect(run_repair, dispatch_uid="core_schema_repair")
            try:
                from core.startup import repair_known_schema_gaps

                repair_known_schema_gaps()
            except Exception:
                logger.exception("core.ready: schema repair failed")

        from django.db.backends.signals import connection_created

        connection_created.connect(run_repair, dispatch_uid="core_schema_repair")