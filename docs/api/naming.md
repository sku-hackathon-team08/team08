# API 필드 네이밍

> 상태: 계약 확정. `ApiModel`의 공통 별칭 설정과 내부 생성 경로, JSON·쿼리 입력 경계 테스트를 구현했습니다.

## 외부 필드명

JSON 요청·응답의 필드명과 쿼리 파라미터 이름은 `camelCase`를 사용합니다.
Python 내부의 변수·함수·모델 필드명은 `snake_case`로 작성합니다.

| 위치 | 표기 예시 |
|---|---|
| JSON 요청·응답 | `{"displayName": "생일팀"}` |
| 쿼리 | `?pageSize=20` |
| Python 모델 필드·변수 | `display_name`, `page_size` |

예시는 표기법 설명이며 해당 기능·필드를 구현했다는 뜻이 아닙니다.
중첩 객체의 선언된 필드도 같은 규칙을 따릅니다. 사용자 입력을 키로 저장하는 사전 등 임의의 데이터 키와 문자열 값은 일괄 변환하지 않습니다.
오류의 필드 위치에 포함되는 필드명도 외부 이름을 사용합니다. 중첩·배열 경로와 요청 위치의 표현 방식은 [공통 오류 계약](errors.md)의 검토 항목입니다.
URL 경로·헤더·환경변수 이름은 이 규칙의 대상이 아닙니다.

## 외부 입력의 지원 범위

JSON 요청과 쿼리의 선언된 필드는 `camelCase` 이름만 지원합니다. `display_name`을 `displayName`의 대체 이름으로 받거나 `page_size`를 `pageSize`로 자동 보정하지 않습니다. `id`·`status`처럼 두 표기가 같은 이름은 그대로 사용합니다.

Python 코드에서 `snake_case` 키워드 인자로 모델을 생성하는 것은 내부 사용 방식입니다. 이를 허용하는 설정이 HTTP 요청에서도 내부 필드명을 허용한다는 뜻은 아닙니다.

지원하지 않는 이름을 보냈을 때 요청 전체를 거절할지, 해당 키를 무시할지는 미등록 입력 필드 정책에 따라 별도로 결정합니다. 이번 결정은 모든 `snake_case` 키에 일괄 422를 반환한다는 뜻이 아닙니다. 다만 해당 키의 값으로 선언된 필드를 채우거나 수정하지 않습니다.

## 구현 시 확인할 결과

- camelCase JSON·쿼리를 입력하면 Python에서 snake_case 필드로 사용할 수 있습니다.
- 외부에서 camelCase와 표기가 다른 snake_case 이름만 보내거나 두 이름을 함께 보내도 내부 이름의 값이 선언된 필드에 대체 입력으로 사용되지 않습니다. 선택 필드에서도 동일하게 확인합니다.
- Python 내부에서는 snake_case 키워드 인자로 모델을 생성할 수 있으며, HTTP 입력 검증과 구분해 확인합니다.
- 응답 JSON과 OpenAPI의 공개 필드명이 camelCase로 일치합니다.
- 중첩 모델·필드 오류에서도 외부 필드명이 유지됩니다.

변환 설정과 적용 범위는 [백엔드 별칭 구현 가이드](../guides/backend.md#api-필드-별칭)를 참고합니다.
필드별 타입·필수 여부·기본값은 기능별 API 명세에서 정합니다.

현재 공통 구현은 [`app/schemas/base.py`](../../backend/app/schemas/base.py), 모델 검증은 [`tests/unit/test_schemas.py`](../../backend/tests/unit/test_schemas.py), 실제 HTTP·응답·OpenAPI 검증은 [`tests/integration/test_api_naming.py`](../../backend/tests/integration/test_api_naming.py)에 있습니다. HTTP 검증용 모델·라우트는 테스트 안에만 두며 서비스 API를 추가하지 않습니다. 미등록 입력 필드 정책과 오류 경로의 세부 계약은 기존 미정 상태를 유지합니다.
