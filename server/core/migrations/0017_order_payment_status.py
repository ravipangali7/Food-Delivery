# Generated manually for COD payment lifecycle

from django.db import migrations, models


def forwards_set_paid_for_delivered(apps, schema_editor):
    Order = apps.get_model("core", "Order")
    Order.objects.filter(status="delivered").update(payment_status="paid")


def backwards_noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0016_order_chat_rider_staff"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="payment_status",
            field=models.CharField(
                choices=[("pending", "Pending"), ("paid", "Paid")],
                default="pending",
                max_length=16,
                verbose_name="payment status",
            ),
        ),
        migrations.RunPython(forwards_set_paid_for_delivered, backwards_noop),
    ]
