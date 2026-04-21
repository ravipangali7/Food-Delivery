# Generated manually for app version / store links.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0018_notification_user_read_at"),
    ]

    operations = [
        migrations.AddField(
            model_name="supersetting",
            name="android_file",
            field=models.URLField(
                blank=True,
                max_length=500,
                null=True,
                verbose_name="Android package URL",
            ),
        ),
        migrations.AddField(
            model_name="supersetting",
            name="google_playstore_link",
            field=models.URLField(
                blank=True,
                max_length=500,
                null=True,
                verbose_name="Google Play Store link",
            ),
        ),
        migrations.AddField(
            model_name="supersetting",
            name="ios_file",
            field=models.URLField(
                blank=True,
                max_length=500,
                null=True,
                verbose_name="iOS package URL",
            ),
        ),
        migrations.AddField(
            model_name="supersetting",
            name="applestore_link",
            field=models.URLField(
                blank=True,
                max_length=500,
                null=True,
                verbose_name="Apple App Store link",
            ),
        ),
        migrations.AddField(
            model_name="supersetting",
            name="android_version",
            field=models.CharField(
                blank=True,
                max_length=32,
                null=True,
                verbose_name="Android app version",
            ),
        ),
        migrations.AddField(
            model_name="supersetting",
            name="ios_version",
            field=models.CharField(
                blank=True,
                max_length=32,
                null=True,
                verbose_name="iOS app version",
            ),
        ),
    ]
