# Generated manually for rider ↔ staff-only delivery coordination messages.

from django.db import migrations, models


def mark_past_rider_messages(apps, schema_editor):
    OrderChatMessage = apps.get_model("core", "OrderChatMessage")
    User = apps.get_model("core", "User")
    rider_ids = set(User.objects.filter(is_delivery_boy=True).values_list("id", flat=True))
    if not rider_ids:
        return
    OrderChatMessage.objects.filter(support=False, sender_id__in=rider_ids).update(rider_staff=True)


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0015_order_chat_status_receipts_presence"),
    ]

    operations = [
        migrations.AddField(
            model_name="orderchatmessage",
            name="rider_staff",
            field=models.BooleanField(
                default=False,
                help_text="If true, only assigned delivery partner and store staff see this message (not the customer).",
                verbose_name="rider–staff thread",
            ),
        ),
        migrations.RunPython(mark_past_rider_messages, migrations.RunPython.noop),
    ]
