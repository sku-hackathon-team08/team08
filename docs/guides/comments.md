# 주석·docstring

> 상태: 팀 인터뷰로 합의한 권고사항. 작성 여부·형식을 필수로 강제하지 않습니다.
> 적용 범위: 백엔드 Python 코드. 기존 Ruff 설정은 유지하며 docstring 필수 검사 규칙은 추가하지 않습니다.

## 언어와 작성 범위

- 설명은 한국어로 작성하고, 코드 식별자·기술 용어와 `Args`·`Returns`·`Raises` 같은 형식 표기는 영어로 유지합니다.
- 이름·타입만으로 알기 어려운 역할·이유·제약이 있을 때 작성합니다. 단순한 함수·클래스는 생략할 수 있습니다.
- `#` 주석에는 구현을 선택한 이유와 주의점을, docstring에는 사용하는 사람이 알아야 할 동작·제약을 적습니다.
- 코드를 그대로 읽어주는 주석이나 타입 힌트의 반복은 피합니다. 시간 단위·허용 범위·부수 효과처럼 추가로 필요한 정보를 남깁니다.
- 패키지 설명은 역할·경계를 짧게 안내합니다. 상세 의존 규칙·요구사항은 [아키텍처](../architecture.md)와 [기준 문서](../sot.md)에서 관리합니다.

## 짧은 설명

짧은 docstring은 큰따옴표 세 개로 감싼 한 줄 설명을 권장합니다. 설명할 내용이 짧으면 섹션을 만들지 않습니다.
현재 상태 확인 API처럼 반환값의 의미에 제약이 있는 경우 다음처럼 적습니다.

```python
"""앱의 응답 가능 여부를 반환한다. DB·외부 서비스 상태는 확인하지 않는다."""
```

## 긴 설명

한 줄 요약 뒤에 빈 줄을 두고, 필요한 항목만 Google 스타일로 추가합니다.
`Args`에는 인자명과 의미·제약, `Returns`에는 반환값의 의미, `Raises`에는 호출자가 알아야 할 예외와 조건을 적습니다.
해당 내용이 없으면 항목을 생략합니다. 예외를 실제로 발생시키지 않는데 형식만 맞추려고 `Raises`를 채우지 않습니다.

아래는 형식 설명용 예시이며 실제 서비스의 기능·검증 규칙이 아닙니다.

```python
def normalize_label(label: str) -> str:
    """저장 전에 라벨 앞뒤의 공백을 제거한다.

    Args:
        label: 사용자가 입력한 라벨.

    Returns:
        앞뒤 공백이 제거된 라벨. 내부 공백은 유지한다.

    Raises:
        ValueError: 공백을 제거한 결과가 빈 문자열인 경우.
    """
    normalized = label.strip()
    if not normalized:
        raise ValueError("라벨이 비어 있습니다.")
    return normalized
```

[Google의 docstring 형식](https://google.github.io/styleguide/pyguide.html#383-functions-and-methods)을 참고하되,
작성 범위와 한국어 사용은 이 문서의 팀 권고를 따릅니다. Google 가이드 전체를 도입하는 것은 아닙니다.

## API 설명과 유지 관리

- FastAPI는 라우터 docstring을 OpenAPI·Swagger 설명에 사용할 수 있습니다. API 사용자가 알아야 할 목적·제약을 적고, 내부 구현 메모는 `#` 주석으로 분리합니다.
- 코드 동작을 바꾸면 관련 주석도 함께 확인합니다. 변경 이력은 Git에 남기고 사용하지 않는 코드를 주석 처리해 보관하지 않는 것을 권장합니다.
- 후속 작업을 남길 때는 `TODO`에 할 일을 구체적으로 적고, 관련 GitHub 이슈가 있으면 번호를 연결합니다.
- 리뷰에서는 주석 개수보다 코드와 설명의 일치 여부, 실제로 도움이 되는 정보를 확인합니다.

라우터 설명의 노출 방식은 [FastAPI 안내](https://fastapi.tiangolo.com/tutorial/path-operation-configuration/#description-from-docstring)를 참고합니다.
