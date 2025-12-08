"""Auth endpoints: register, login wiring, and /api/me."""

from __future__ import annotations

from typing import Any

from django.contrib.auth import get_user_model
from rest_framework import permissions, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from shared.throttles import AuthThrottle, IPBasedRegisterThrottle

from .serializers import RegisterSerializer, UsernameTokenObtainPairSerializer

User = get_user_model()


class RegisterView(APIView):
    """Public registration for STAFF users (username + password)."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [IPBasedRegisterThrottle]  # 10/hour per IP

    def post(self, request: Request) -> Response:
        """Register a new staff user and issue an access token."""
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        vd: Any = serializer.validated_data
        username_value: str = str(vd["username"])  # keys enforced by serializer
        password_value: str = str(vd["password"])  # keys enforced by serializer
        serializer.save()

        token_serializer = UsernameTokenObtainPairSerializer(
            data={
                "username": username_value,
                "password": password_value,
            },
        )
        token_serializer.is_valid(raise_exception=True)
        return Response(token_serializer.validated_data, status=status.HTTP_200_OK)


class LoginView(TokenObtainPairView):
    """Login endpoint issuing JWT tokens with role claim."""

    serializer_class = UsernameTokenObtainPairSerializer
    throttle_classes = [AuthThrottle]  # 30/hour


class MeView(APIView):
    """Return basic profile for authenticated users."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request: Request) -> Response:
        """Return the authenticated user's profile details."""
        user: Any = request.user
        payload: dict[str, Any] = {
            "id": user.id,
            "username": getattr(user, "username", None),
            "role": getattr(user, "role", None),
        }
        return Response(payload, status=status.HTTP_200_OK)
