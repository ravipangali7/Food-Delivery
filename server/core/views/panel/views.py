"""Staff-only template admin panel (CRUD + sidebar)."""

from __future__ import annotations

from django.contrib import messages
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth import get_user_model
from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.db.models import ProtectedError
from django.shortcuts import redirect
from django.urls import reverse, reverse_lazy
from django.utils import timezone
from django.views import View
from django.views.generic import (
    CreateView,
    DeleteView,
    DetailView,
    FormView,
    ListView,
    RedirectView,
    TemplateView,
    UpdateView,
)

from ...forms.panel_forms import (
    CategoryPanelForm,
    ParentCategoryPanelForm,
    DeliveryBoyPanelForm,
    NotificationPanelForm,
    OrderStatusPanelForm,
    PanelLoginForm,
    ProductPanelForm,
    StoreSettingsPanelForm,
)
from ... import services
from ...models import Category, Notification, Order, ParentCategory, Product, SuperSetting

User = get_user_model()


class StaffRequiredMixin(LoginRequiredMixin, UserPassesTestMixin):
    """All panel routes require an authenticated staff user."""

    login_url = reverse_lazy("panel_login")

    def test_func(self) -> bool:
        return bool(self.request.user.is_staff)


class PanelLoginView(FormView):
    template_name = "panel/login.html"
    form_class = PanelLoginForm

    def dispatch(self, request, *args, **kwargs):
        if request.user.is_authenticated and request.user.is_staff:
            return redirect("panel_product_list")
        return super().dispatch(request, *args, **kwargs)

    def form_valid(self, form):
        phone = form.cleaned_data["phone"].strip()
        password = form.cleaned_data["password"]
        user = authenticate(self.request, username=phone, password=password)
        if user is None or not user.is_staff:
            messages.error(self.request, "Invalid phone or password, or account is not staff.")
            return self.form_invalid(form)
        login(self.request, user)
        messages.success(self.request, f"Welcome, {user.name}.")
        next_url = self.request.GET.get("next") or reverse("panel_product_list")
        return redirect(next_url)


class PanelLogoutView(View):
    def get(self, request):
        logout(request)
        messages.info(request, "You have been signed out.")
        return redirect("panel_login")


class PanelHomeRedirectView(StaffRequiredMixin, RedirectView):
    permanent = False
    pattern_name = "panel_product_list"


# —— Products ——


class ProductListView(StaffRequiredMixin, ListView):
    template_name = "panel/products/list.html"
    context_object_name = "products"
    paginate_by = 25

    def get_queryset(self):
        return (
            Product.objects.filter(deleted_at__isnull=True)
            .select_related("category")
            .order_by("sort_order", "name")
        )

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["active_nav"] = "products"
        return ctx


class ProductCreateView(StaffRequiredMixin, CreateView):
    model = Product
    form_class = ProductPanelForm
    template_name = "panel/products/form.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["active_nav"] = "products"
        ctx["form_title"] = "Create product"
        return ctx

    def form_valid(self, form):
        messages.success(self.request, "Product created.")
        return super().form_valid(form)

    def get_success_url(self):
        return reverse("panel_product_list")


class ProductUpdateView(StaffRequiredMixin, UpdateView):
    model = Product
    form_class = ProductPanelForm
    template_name = "panel/products/form.html"
    pk_url_kwarg = "pk"

    def get_queryset(self):
        return Product.objects.filter(deleted_at__isnull=True)

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["active_nav"] = "products"
        ctx["form_title"] = "Edit product"
        return ctx

    def form_valid(self, form):
        messages.success(self.request, "Product updated.")
        return super().form_valid(form)

    def get_success_url(self):
        return reverse("panel_product_list")


class ProductDeleteView(StaffRequiredMixin, DeleteView):
    model = Product
    template_name = "panel/products/confirm_delete.html"
    context_object_name = "product"

    def get_queryset(self):
        return Product.objects.filter(deleted_at__isnull=True)

    def form_valid(self, form):
        Product.objects.filter(pk=self.object.pk).update(deleted_at=timezone.now())
        messages.success(self.request, "Product removed from the catalog.")
        return redirect(self.get_success_url())

    def get_success_url(self):
        return reverse("panel_product_list")

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["active_nav"] = "products"
        return ctx


# —— Categories ——


class ParentCategoryCreateView(StaffRequiredMixin, CreateView):
    model = ParentCategory
    form_class = ParentCategoryPanelForm
    template_name = "panel/categories/form.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["active_nav"] = "categories"
        ctx["form_title"] = "Create parent category"
        return ctx

    def form_valid(self, form):
        messages.success(self.request, "Parent category created.")
        return super().form_valid(form)

    def get_success_url(self):
        return reverse("panel_category_list")


class ParentCategoryUpdateView(StaffRequiredMixin, UpdateView):
    model = ParentCategory
    form_class = ParentCategoryPanelForm
    template_name = "panel/categories/form.html"
    pk_url_kwarg = "pk"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["active_nav"] = "categories"
        ctx["form_title"] = "Edit parent category"
        return ctx

    def form_valid(self, form):
        messages.success(self.request, "Parent category updated.")
        return super().form_valid(form)

    def get_success_url(self):
        return reverse("panel_category_list")


class CategoryListView(StaffRequiredMixin, ListView):
    template_name = "panel/categories/list.html"
    context_object_name = "categories"
    paginate_by = 50

    def get_queryset(self):
        return Category.objects.select_related("parent").order_by("sort_order", "name")

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["active_nav"] = "categories"
        ctx["parent_categories"] = ParentCategory.objects.order_by("sort_order", "name")
        return ctx


class CategoryCreateView(StaffRequiredMixin, CreateView):
    model = Category
    form_class = CategoryPanelForm
    template_name = "panel/categories/form.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["active_nav"] = "categories"
        ctx["form_title"] = "Create category"
        return ctx

    def form_valid(self, form):
        messages.success(self.request, "Category created.")
        return super().form_valid(form)

    def get_success_url(self):
        return reverse("panel_category_list")


class CategoryUpdateView(StaffRequiredMixin, UpdateView):
    model = Category
    form_class = CategoryPanelForm
    template_name = "panel/categories/form.html"
    pk_url_kwarg = "pk"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["active_nav"] = "categories"
        ctx["form_title"] = "Edit category"
        return ctx

    def form_valid(self, form):
        messages.success(self.request, "Category updated.")
        return super().form_valid(form)

    def get_success_url(self):
        return reverse("panel_category_list")


class CategoryDeleteView(StaffRequiredMixin, DeleteView):
    model = Category
    template_name = "panel/categories/confirm_delete.html"
    context_object_name = "category"

    def post(self, request, *args, **kwargs):
        self.object = self.get_object()
        try:
            self.object.delete()
            messages.success(request, "Category deleted.")
        except ProtectedError:
            messages.error(
                request,
                "Cannot delete this category while products are linked to it. Reassign or remove those products first.",
            )
        return redirect(reverse("panel_category_list"))

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["active_nav"] = "categories"
        return ctx


# —— Orders ——


class OrderListView(StaffRequiredMixin, ListView):
    template_name = "panel/orders/list.html"
    context_object_name = "orders"
    paginate_by = 30

    def get_queryset(self):
        return (
            Order.objects.select_related("user", "delivery_boy")
            .prefetch_related("items__product")
            .order_by("-created_at")
        )

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["active_nav"] = "orders"
        ctx["status_choices"] = Order.Status.choices
        return ctx


class OrderDetailView(StaffRequiredMixin, DetailView):
    model = Order
    template_name = "panel/orders/detail.html"
    context_object_name = "order"

    def get_queryset(self):
        return Order.objects.select_related("user", "delivery_boy").prefetch_related("items__product")

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["active_nav"] = "orders"
        ctx["status_form"] = OrderStatusPanelForm(instance=self.object)
        ctx["status_choices"] = Order.Status.choices
        return ctx


class OrderStatusUpdateView(StaffRequiredMixin, UpdateView):
    model = Order
    form_class = OrderStatusPanelForm
    http_method_names = ["post"]
    pk_url_kwarg = "pk"

    def get_success_url(self):
        nxt = self.request.POST.get("next")
        if nxt:
            return nxt
        return reverse("panel_order_detail", kwargs={"pk": self.object.pk})

    def form_valid(self, form):
        order = self.get_object()
        new_status = form.cleaned_data["status"]
        try:
            services.apply_order_status_change(
                order,
                new_status,
                cancellation_reason=None,
                actor=self.request.user,
            )
        except ValueError as e:
            messages.error(self.request, str(e))
            return redirect(
                self.request.POST.get("next")
                or reverse("panel_order_detail", kwargs={"pk": order.pk})
            )
        messages.success(self.request, "Order status updated.")
        return redirect(self.get_success_url())

    def form_invalid(self, form):
        messages.error(self.request, "Could not update order status.")
        nxt = self.request.POST.get("next") or reverse("panel_order_list")
        return redirect(nxt)


# —— Delivery boys ——


class DeliveryBoyListView(StaffRequiredMixin, ListView):
    template_name = "panel/delivery_boys/list.html"
    context_object_name = "delivery_boys"
    paginate_by = 40

    def get_queryset(self):
        return (
            User.objects.filter(is_delivery_boy=True, deleted_at__isnull=True)
            .order_by("-created_at")
        )

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["active_nav"] = "delivery_boys"
        return ctx


class DeliveryBoyCreateView(StaffRequiredMixin, CreateView):
    model = User
    form_class = DeliveryBoyPanelForm
    template_name = "panel/delivery_boys/form.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["active_nav"] = "delivery_boys"
        ctx["form_title"] = "Add delivery partner"
        return ctx

    def form_valid(self, form):
        messages.success(self.request, "Delivery partner created.")
        return super().form_valid(form)

    def get_success_url(self):
        return reverse("panel_delivery_boy_list")


class DeliveryBoyUpdateView(StaffRequiredMixin, UpdateView):
    model = User
    form_class = DeliveryBoyPanelForm
    template_name = "panel/delivery_boys/form.html"
    pk_url_kwarg = "pk"

    def get_queryset(self):
        return User.objects.filter(is_delivery_boy=True, deleted_at__isnull=True)

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["active_nav"] = "delivery_boys"
        ctx["form_title"] = "Edit delivery partner"
        return ctx

    def form_valid(self, form):
        messages.success(self.request, "Delivery partner updated.")
        return super().form_valid(form)

    def get_success_url(self):
        return reverse("panel_delivery_boy_list")


class DeliveryBoyDeleteView(StaffRequiredMixin, DeleteView):
    model = User
    template_name = "panel/delivery_boys/confirm_delete.html"
    context_object_name = "delivery_boy"

    def get_queryset(self):
        return User.objects.filter(is_delivery_boy=True, deleted_at__isnull=True)

    def form_valid(self, form):
        User.objects.filter(pk=self.object.pk).update(deleted_at=timezone.now())
        messages.success(self.request, "Delivery partner deactivated (soft-deleted).")
        return redirect(self.get_success_url())

    def get_success_url(self):
        return reverse("panel_delivery_boy_list")

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["active_nav"] = "delivery_boys"
        return ctx


# —— Notifications ——


class NotificationListView(StaffRequiredMixin, ListView):
    template_name = "panel/notifications/list.html"
    context_object_name = "notifications"
    paginate_by = 50

    def get_queryset(self):
        return Notification.objects.all().order_by("-created_at")

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["active_nav"] = "notifications"
        return ctx


class NotificationCreateView(StaffRequiredMixin, CreateView):
    model = Notification
    form_class = NotificationPanelForm
    template_name = "panel/notifications/form.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["active_nav"] = "notifications"
        ctx["form_title"] = "Create notification"
        return ctx

    def form_valid(self, form):
        messages.success(self.request, "Notification saved.")
        return super().form_valid(form)

    def get_success_url(self):
        return reverse("panel_notification_list")


class NotificationUpdateView(StaffRequiredMixin, UpdateView):
    model = Notification
    form_class = NotificationPanelForm
    template_name = "panel/notifications/form.html"
    pk_url_kwarg = "pk"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["active_nav"] = "notifications"
        ctx["form_title"] = "Edit notification"
        return ctx

    def form_valid(self, form):
        messages.success(self.request, "Notification updated.")
        return super().form_valid(form)

    def get_success_url(self):
        return reverse("panel_notification_list")


class NotificationDeleteView(StaffRequiredMixin, DeleteView):
    model = Notification
    template_name = "panel/notifications/confirm_delete.html"
    context_object_name = "notification"

    def form_valid(self, form):
        messages.success(self.request, "Notification deleted.")
        return super().form_valid(form)

    def get_success_url(self):
        return reverse("panel_notification_list")

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["active_nav"] = "notifications"
        return ctx


# —— Store settings (singleton) ——


class StoreSettingsView(StaffRequiredMixin, TemplateView):
    template_name = "panel/store_settings/form.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        obj = SuperSetting.objects.order_by("pk").first()
        if not obj:
            obj = SuperSetting.objects.create(name="My store")
        if "form" in kwargs:
            ctx["form"] = kwargs["form"]
        else:
            ctx["form"] = StoreSettingsPanelForm(instance=obj)
        ctx["settings_obj"] = obj
        ctx["active_nav"] = "store_settings"
        return ctx

    def post(self, request, *args, **kwargs):
        obj = SuperSetting.objects.order_by("pk").first()
        if not obj:
            obj = SuperSetting.objects.create(name="My store")
        form = StoreSettingsPanelForm(request.POST, instance=obj)
        if form.is_valid():
            saved = form.save()
            SuperSetting.objects.exclude(pk=saved.pk).delete()
            messages.success(request, "Store settings saved.")
            return redirect("panel_store_settings")
        ctx = self.get_context_data(form=form)
        return self.render_to_response(ctx)
