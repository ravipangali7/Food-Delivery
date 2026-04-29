from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0027_banner"),
    ]

    operations = [
        migrations.CreateModel(
            name="OrderChatStaffReadState",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("last_read_at", models.DateTimeField(blank=True, null=True, verbose_name="last read at")),
                (
                    "last_read_message",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="staff_read_states",
                        to="core.orderchatmessage",
                        verbose_name="last read message",
                    ),
                ),
                (
                    "order",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="staff_chat_read_states",
                        to="core.order",
                        verbose_name="order",
                    ),
                ),
                (
                    "staff_user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="order_chat_staff_read_states",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="staff user",
                    ),
                ),
            ],
            options={
                "verbose_name": "order chat staff read state",
                "verbose_name_plural": "order chat staff read states",
                "db_table": "order_chat_staff_read_states",
            },
        ),
        migrations.AddConstraint(
            model_name="orderchatstaffreadstate",
            constraint=models.UniqueConstraint(
                fields=("order", "staff_user"),
                name="uq_order_chat_staff_read_state_order_staff",
            ),
        ),
        migrations.AddIndex(
            model_name="orderchatstaffreadstate",
            index=models.Index(fields=["staff_user", "order"], name="order_chat__staff_u_e00100_idx"),
        ),
    ]
