# Generated manually for COD-only checkout and delivery mode tracking

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0010_order_tracking_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="payment_method",
            field=models.CharField(
                choices=[("cash_on_delivery", "Cash on delivery")],
                default="cash_on_delivery",
                max_length=32,
                verbose_name="payment method",
            ),
        ),
        migrations.AddField(
            model_name="order",
            name="delivery_type",
            field=models.CharField(
                choices=[("bike", "Bike"), ("walking", "Walking")],
                default="bike",
                max_length=16,
                verbose_name="delivery type",
            ),
        ),
    ]
