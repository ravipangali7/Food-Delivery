# Generated manually for guest checkout contact details

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0030_order_guest_user"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="guest_name",
            field=models.CharField(
                blank=True,
                help_text="Customer name when the order was placed without an account.",
                max_length=100,
                verbose_name="guest name",
            ),
        ),
        migrations.AddField(
            model_name="order",
            name="guest_phone",
            field=models.CharField(
                blank=True,
                help_text="Customer phone when the order was placed without an account.",
                max_length=15,
                verbose_name="guest phone",
            ),
        ),
    ]
