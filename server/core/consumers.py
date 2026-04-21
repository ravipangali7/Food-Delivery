"""WebSocket: live order tracking, order chat (typing, receipts), and staff inbox feed."""

from __future__ import annotations

import json
from urllib.parse import parse_qs

from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.shortcuts import get_object_or_404
from rest_framework.authtoken.models import Token

from .chat_utils import touch_presence
from .models import Order
from .tracking import broadcast_order_chat_message, build_tracking_payload
from .views.helpers import (
    can_use_customer_delivery_chat_thread,
    can_use_customer_rider_chat_thread,
    can_use_rider_staff_chat_thread,
    can_use_support_chat_thread,
    can_view_order_tracking,
    is_delivery_boy_offline,
    order_queryset_for_user,
    persist_order_chat_message,
)


@sync_to_async
def _user_from_token(token_key: str):
    try:
        return Token.objects.select_related("user").get(key=token_key).user
    except Token.DoesNotExist:
        return None


@sync_to_async
def _get_order(pk: int) -> Order | None:
    try:
        return Order.objects.select_related("user", "delivery_boy").get(pk=pk)
    except Order.DoesNotExist:
        return None


@sync_to_async
def _persist_chat_from_ws(
    order_id: int, user, body: str, support: bool, rider_staff: bool, customer_rider: bool
) -> dict:
    order = get_object_or_404(order_queryset_for_user(user), pk=order_id)
    if support:
        if not can_use_support_chat_thread(user, order):
            raise PermissionError("support chat not allowed")
        rider_staff = False
        customer_rider = False
    elif rider_staff:
        if not can_use_rider_staff_chat_thread(user, order):
            raise PermissionError("rider ops chat not allowed")
        customer_rider = False
    elif customer_rider:
        if not can_use_customer_rider_chat_thread(user, order):
            raise PermissionError("customer rider chat not allowed")
        support = False
        rider_staff = False
    else:
        if not can_use_customer_delivery_chat_thread(user, order):
            raise PermissionError("delivery chat not allowed")
        customer_rider = False
    if is_delivery_boy_offline(user):
        raise PermissionError("offline cannot send")
    return persist_order_chat_message(
        order,
        user,
        body,
        support=support,
        rider_staff=rider_staff,
        customer_rider=customer_rider,
        serializer_context={"user": user},
    )


@sync_to_async
def _touch_presence_uid(uid: int) -> None:
    touch_presence(uid)


class OrderTrackingConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.order_id = int(self.scope["url_route"]["kwargs"]["order_id"])
        qs = parse_qs(self.scope.get("query_string", b"").decode())
        token_key = (qs.get("token") or [None])[0]
        if not token_key:
            await self.close(code=4401)
            return
        user = await _user_from_token(token_key)
        if not user or not user.is_active:
            await self.close(code=4401)
            return
        order = await _get_order(self.order_id)
        if not order or not await sync_to_async(can_view_order_tracking)(user, order):
            await self.close(code=4403)
            return
        if await sync_to_async(is_delivery_boy_offline)(user):
            await self.close(code=4403)
            return

        self.group_name = f"order_track_{self.order_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        payload = await sync_to_async(build_tracking_payload)(order)
        await self.send(
            text_data=json.dumps({"type": "snapshot", "data": payload})
        )

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def location_update(self, event):
        await self.send(
            text_data=json.dumps(
                {"type": "location", "data": event["payload"]}
            )
        )


class StaffInboxConsumer(AsyncWebsocketConsumer):
    """Staff-only: live toast feed for new messages across all orders."""

    async def connect(self):
        qs = parse_qs(self.scope.get("query_string", b"").decode())
        token_key = (qs.get("token") or [None])[0]
        if not token_key:
            await self.close(code=4401)
            return
        user = await _user_from_token(token_key)
        if not user or not user.is_active or not user.is_staff:
            await self.close(code=4403)
            return
        self.group_name = "staff_inbox_feed"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def staff_inbox(self, event):
        await self.send(text_data=json.dumps({"type": "inbox", "data": event.get("payload")}))


class OrderChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.order_id = int(self.scope["url_route"]["kwargs"]["order_id"])
        qs = parse_qs(self.scope.get("query_string", b"").decode())
        token_key = (qs.get("token") or [None])[0]
        thread = (qs.get("thread") or ["delivery"])[0]
        if thread not in ("support", "delivery", "rider_ops", "customer_rider", "all"):
            thread = "delivery"
        if not token_key:
            await self.close(code=4401)
            return
        user = await _user_from_token(token_key)
        if not user or not user.is_active:
            await self.close(code=4401)
            return
        self.user = user
        order = await _get_order(self.order_id)
        if not order:
            await self.close(code=4403)
            return

        self.group_names: list[str] = []
        self.thread_mode = thread
        if thread == "all":
            if not user.is_staff:
                await self.close(code=4403)
                return
            self.group_names = [f"order_staff_observer_{self.order_id}"]
        elif thread == "support":
            allowed = await sync_to_async(can_use_support_chat_thread)(user, order)
            if not allowed:
                await self.close(code=4403)
                return
            self.group_names = [f"order_support_{self.order_id}"]
        elif thread == "rider_ops":
            allowed = await sync_to_async(can_use_rider_staff_chat_thread)(user, order)
            if not allowed:
                await self.close(code=4403)
                return
            self.group_names = [f"order_rider_ops_{self.order_id}"]
        elif thread == "customer_rider":
            allowed = await sync_to_async(can_use_customer_rider_chat_thread)(user, order)
            if not allowed:
                await self.close(code=4403)
                return
            self.group_names = [f"order_customer_rider_{self.order_id}"]
        else:
            allowed = await sync_to_async(can_use_customer_delivery_chat_thread)(user, order)
            if not allowed:
                await self.close(code=4403)
                return
            self.group_names = [f"order_chat_customer_{self.order_id}"]

        for name in self.group_names:
            await self.channel_layer.group_add(name, self.channel_name)
        await self.accept()
        await _touch_presence_uid(user.id)

    async def disconnect(self, close_code):
        for name in getattr(self, "group_names", []):
            await self.channel_layer.group_discard(name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        if not text_data:
            return
        try:
            payload = json.loads(text_data)
        except (json.JSONDecodeError, TypeError):
            return
        msg_type = (payload.get("type") or "chat").strip().lower()
        if msg_type == "ping":
            await _touch_presence_uid(self.user.id)
            await self.send(text_data=json.dumps({"type": "pong", "t": payload.get("t")}))
            return
        if msg_type == "typing":
            support = bool(payload.get("support"))
            rider_staff = bool(payload.get("rider_staff"))
            customer_rider = bool(payload.get("customer_rider"))
            if getattr(self.user, "is_delivery_boy", False):
                if self.thread_mode == "rider_ops":
                    support = False
                    rider_staff = True
                    customer_rider = False
                elif self.thread_mode == "customer_rider":
                    support = False
                    rider_staff = False
                    customer_rider = True
                else:
                    support = False
                    rider_staff = False
                    customer_rider = False
            if support:
                typing_group = f"order_support_{self.order_id}"
            elif rider_staff:
                typing_group = f"order_rider_ops_{self.order_id}"
            elif customer_rider:
                typing_group = f"order_customer_rider_{self.order_id}"
            else:
                typing_group = f"order_chat_customer_{self.order_id}"
            typing_payload = {
                "user_id": self.user.id,
                "name": getattr(self.user, "name", "") or "",
                "support": support,
                "rider_staff": rider_staff,
                "customer_rider": customer_rider,
                "active": bool(payload.get("active", True)),
            }
            await self.channel_layer.group_send(
                typing_group,
                {"type": "chat.typing", "payload": typing_payload},
            )
            await self.channel_layer.group_send(
                f"order_staff_observer_{self.order_id}",
                {"type": "chat.typing", "payload": typing_payload},
            )
            return
        if msg_type != "chat":
            return
        body = (payload.get("body") or "").strip()
        if not body:
            return
        support = bool(payload.get("support"))
        rider_staff = bool(payload.get("rider_staff"))
        customer_rider = bool(payload.get("customer_rider"))
        if getattr(self.user, "is_delivery_boy", False):
            order = await _get_order(self.order_id)
            if order and order.delivery_boy_id == self.user.id:
                if self.thread_mode == "rider_ops":
                    support = False
                    rider_staff = True
                    customer_rider = False
                elif self.thread_mode == "customer_rider":
                    support = False
                    rider_staff = False
                    customer_rider = True
                else:
                    support = False
                    rider_staff = False
                    customer_rider = False
        try:
            data = await _persist_chat_from_ws(
                self.order_id, self.user, body, support, rider_staff, customer_rider
            )
        except PermissionError:
            await self.send(
                text_data=json.dumps(
                    {"type": "error", "detail": "You cannot send this message right now."}
                )
            )
            return
        except Exception:
            await self.send(text_data=json.dumps({"type": "error", "detail": "Could not send message"}))
            return
        broadcast_order_chat_message(
            self.order_id,
            data,
            support=data["support"],
            rider_staff=bool(data.get("rider_staff")),
            customer_rider=bool(data.get("customer_rider")),
        )

    async def chat_message(self, event):
        await self.send(
            text_data=json.dumps({"type": "message", "data": event["payload"]})
        )

    async def chat_receipt(self, event):
        await self.send(
            text_data=json.dumps({"type": "receipt", "data": event["payload"]})
        )

    async def chat_typing(self, event):
        if event["payload"].get("user_id") == self.user.id:
            return
        await self.send(
            text_data=json.dumps({"type": "typing", "data": event["payload"]})
        )
