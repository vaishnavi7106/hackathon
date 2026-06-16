from fastapi import HTTPException, status


class NotFoundError(HTTPException):
    def __init__(self, resource: str, detail_ta: str = ""):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": f"{resource} not found", "message_ta": detail_ta},
        )


class AuthError(HTTPException):
    def __init__(self, message: str = "Invalid or expired token", message_ta: str = ""):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": message, "message_ta": message_ta},
            headers={"WWW-Authenticate": "Bearer"},
        )


class ForbiddenError(HTTPException):
    def __init__(self, message: str = "Access denied"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": message},
        )


class ConflictError(HTTPException):
    def __init__(self, resource: str, detail_ta: str = ""):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "CONFLICT", "message": f"{resource} already exists", "message_ta": detail_ta},
        )


class ServiceUnavailableError(HTTPException):
    def __init__(self, service: str, detail_ta: str = ""):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "SERVICE_UNAVAILABLE", "message": f"{service} is unavailable", "message_ta": detail_ta},
        )


class ValidationError(HTTPException):
    def __init__(self, message: str, detail_ta: str = ""):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "VALIDATION_ERROR", "message": message, "message_ta": detail_ta},
        )
