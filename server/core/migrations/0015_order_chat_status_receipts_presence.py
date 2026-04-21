# Generated manually for chat receipts and presence.

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0014_user_is_online"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="last_chat_ping_at",
            field=models.DateTimeField(
                blank=True,
                help_text="Updated by WebSocket heartbeats; used for online indicators in chat.",
                null=True,
                verbose_name="last chat presence ping",
            ),
        ),
        migrations.AddField(
            model_name="orderchatmessage",
            name="aggregate_status",
            field=models.CharField(
                choices=[("sent", "Sent"), ("delivered", "Delivered"), ("seen", "Seen")],
                db_index=True,
                default="sent",
                max_length=16,
                verbose_name="delivery status",
            ),
        ),
        migrations.CreateModel(
            name="OrderChatReceipt",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("delivered_at", models.DateTimeField(blank=True, null=True, verbose_name="delivered at")),
                ("read_at", models.DateTimeField(blank=True, null=True, verbose_name="read at")),
                (
                    "message",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="receipts",
                        to="core.orderchatmessage",
                        verbose_name="message",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="order_chat_receipts",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="recipient",
                    ),
                ),
            ],
            options={
                "verbose_name": "order chat receipt",
                "verbose_name_plural": "order chat receipts",
                "db_table": "order_chat_receipts",
            },
        ),
        migrations.AddConstraint(
            model_name="orderchatreceipt",
            constraint=models.UniqueConstraint(fields=("message", "user"), name="uq_order_chat_receipt_message_user"),
        ),
        migrations.AddIndex(
            model_name="orderchatreceipt",
            index=models.Index(fields=["message"], name="order_chat__message_6e4b2f_idx"),
        ),
    ]
