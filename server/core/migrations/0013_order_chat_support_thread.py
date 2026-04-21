from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0012_customer_address_and_order_chat"),
    ]

    operations = [
        migrations.AddField(
            model_name="orderchatmessage",
            name="support",
            field=models.BooleanField(
                default=False,
                help_text="If true, only the customer and store staff see this message (not the delivery partner).",
                verbose_name="support thread",
            ),
        ),
    ]
