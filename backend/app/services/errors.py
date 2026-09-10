class ServiceError(Exception):
    """공개 가능한 업무 오류만 저장하며 내부 예외 메시지는 받지 않는다."""

    def __init__(self, status: int, code: str, detail: str):
        self.status = status
        self.code = code
        self.detail = detail
        super().__init__(code)

    def body(self) -> dict:
        return {
            "status": self.status,
            "code": self.code,
            "detail": self.detail,
            "errors": [],
        }
