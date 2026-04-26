from rest_framework_simplejwt.authentication import JWTAuthentication


class CookieJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        # 🔥 PRIMEIRO: tenta header
        header = self.get_header(request)

        if header is not None:
            raw_token = self.get_raw_token(header)
        else:
            # 🔥 DEPOIS: tenta cookie
            raw_token = request.COOKIES.get("access")

            if raw_token is not None:
                raw_token = raw_token.encode("utf-8")

        if raw_token is None:
            return None

        from rest_framework.exceptions import AuthenticationFailed

        try:
            validated_token = self.get_validated_token(raw_token)
        except Exception:
            raise AuthenticationFailed("Token invalid or expired")

        return self.get_user(validated_token), validated_token
