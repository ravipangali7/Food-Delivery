# Django 6.0.4 ले 2026-04-11 मा स्वचालित सिर्जना
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0017_order_payment_status"),
    ]

    operations = [
        migrations.AddField(
            model_name="notificationuser",
            name="read_at",
            field=models.DateTimeField(blank=True, null=True, verbose_name="read at"),
        ),
    ]
