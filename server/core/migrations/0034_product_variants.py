from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0033_orderitem_product_set_null"),
    ]

    operations = [
        migrations.CreateModel(
            name="ProductVariant",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "label",
                    models.CharField(
                        blank=True,
                        default="",
                        help_text="Optional display name, e.g. Family pack.",
                        max_length=100,
                        verbose_name="label",
                    ),
                ),
                (
                    "price",
                    models.DecimalField(
                        decimal_places=2, max_digits=10, verbose_name="price (NPR)"
                    ),
                ),
                (
                    "stock_quantity",
                    models.PositiveIntegerField(
                        default=0, verbose_name="stock quantity"
                    ),
                ),
                (
                    "is_available",
                    models.BooleanField(default=True, verbose_name="available"),
                ),
                (
                    "sort_order",
                    models.PositiveSmallIntegerField(
                        default=0, verbose_name="sort order"
                    ),
                ),
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True, verbose_name="created at"),
                ),
                (
                    "updated_at",
                    models.DateTimeField(auto_now=True, verbose_name="updated at"),
                ),
                (
                    "product",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="variants",
                        to="core.product",
                        verbose_name="product",
                    ),
                ),
                (
                    "unit",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="product_variants",
                        to="core.unit",
                        verbose_name="unit",
                    ),
                ),
            ],
            options={
                "verbose_name": "product variant",
                "verbose_name_plural": "product variants",
                "db_table": "product_variants",
                "ordering": ["sort_order", "id"],
            },
        ),
        migrations.AddField(
            model_name="cartitem",
            name="variant",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="cart_items",
                to="core.productvariant",
                verbose_name="variant",
            ),
        ),
        migrations.AddField(
            model_name="orderitem",
            name="variant",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="order_items",
                to="core.productvariant",
                verbose_name="variant",
            ),
        ),
        migrations.RemoveConstraint(
            model_name="cartitem",
            name="uq_cart_items_cart_product",
        ),
        migrations.AddConstraint(
            model_name="cartitem",
            constraint=models.UniqueConstraint(
                fields=("cart", "product", "variant", "is_preorder"),
                name="uq_cart_items_cart_product_variant_preorder",
            ),
        ),
    ]
