# Generated manually for delivery partner online/offline availability

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0013_order_chat_support_thread"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="is_online",
            field=models.BooleanField(
                default=True,
                help_text="When False, assigned delivery partners do not receive or see orders.",
                verbose_name="is online (delivery partners)",
            ),
        ),
    ]
