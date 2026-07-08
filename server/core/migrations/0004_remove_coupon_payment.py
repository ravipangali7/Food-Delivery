# Django 6.0.4 ले 2026-04-11 मा स्वचालित सिर्जना
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0003_category_image_field"),
    ]

    operations = [
        migrations.DeleteModel(
            name="Payment",
        ),
        migrations.DeleteModel(
            name="Coupon",
        ),
        migrations.RemoveField(
            model_name="order",
            name="payment_status",
        ),
    ]
