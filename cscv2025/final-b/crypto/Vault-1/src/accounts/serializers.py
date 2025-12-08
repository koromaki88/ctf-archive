"""Serializers for accounts endpoints and JWT customization."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.contrib.auth.base_user import AbstractBaseUser
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import Token

User = get_user_model()


class UsernameTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Issue JWT tokens that include the user's role claim."""

    @classmethod
    def get_token(cls, user: AbstractBaseUser) -> Token:  # type: ignore[override]
        """Generate a token enriched with username and role claims."""
        token = super().get_token(user)
        token["role"] = getattr(user, "role", None)
        token["username"] = getattr(user, "username", None)
        return token


class RegisterSerializer(serializers.Serializer):
    """Serializer for creating STAFF users with username+password."""

    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, min_length=8)

    def validate_username(self, value: str) -> str:
        """Ensure the requested username is not already taken."""
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("username is already taken")
        return value

    def create(self, validated_data: dict[str, str]) -> AbstractBaseUser:
        """Create a new staff user from the validated payload."""
        username = validated_data["username"]
        password = validated_data["password"]
        user = User.objects.create_user(username=username, password=password)
        if hasattr(user, "ensure_random_state"):
            user.ensure_random_state(save=True)
        return user
