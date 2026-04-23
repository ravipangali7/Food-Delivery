from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0022_order_cancellation_request"),
    ]

    operations = [
        migrations.AddField(
            model_name="supersetting",
            name="about_us",
            field=models.TextField(
                blank=True,
                help_text="Shown on the customer About page. Plain text; line breaks are preserved.",
                null=True,
                verbose_name="about us (customer app)",
            ),
        ),
        migrations.AddField(
            model_name="supersetting",
            name="terms_and_conditions",
            field=models.TextField(
                blank=True,
                help_text="Full terms text for the customer Terms page. Plain text; line breaks are preserved.",
                null=True,
                verbose_name="terms and conditions (customer app)",
            ),
        ),
        migrations.AddField(
            model_name="supersetting",
            name="privacy_policy",
            field=models.TextField(
                blank=True,
                help_text="Full privacy policy for the customer Privacy page. Plain text; line breaks are preserved.",
                null=True,
                verbose_name="privacy policy (customer app)",
            ),
        ),
    ]
