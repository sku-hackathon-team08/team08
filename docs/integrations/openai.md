# OpenAI 음성 변환·신고 분석

> 상태: 해커톤 사용자 선택 반영·구현. [입력 API](../api/hackathon.md#분석최종-접수)의 제공자 계약입니다.

## 호출과 설정

- 음성은 Audio Transcriptions, 텍스트 구조 추출은 Responses Structured Outputs를 사용합니다.
- 기본 모델은 OPENAI_TRANSCRIPTION_MODEL=gpt-transcribe, OPENAI_ANALYSIS_MODEL=gpt-4.1-mini이며 환경변수로 바꿀 수 있습니다. 모델 변경 시 분류 검증을 다시 수행합니다.
- 키는 OPENAI_API_KEY를 사용하며 실행 환경·backend/.env가 우선이고 저장소 루트 .env의 키만 fallback으로 읽습니다. URL·다른 루트 설정을 함께 불러오지 않습니다. 키 원문을 DB·응답·로그에 기록하지 않습니다.
- SDK 자동 재시도는 0, 호출 타임아웃은 60초입니다. Responses에는 store=false를 지정합니다. 이 설정을 제공자의 모든 데이터 처리/보존이 없다는 보장으로 해석하지 않습니다.

## 입력·매핑

TEXT는 원문 1~5,000자이며 공백만 있는 입력은 거절합니다. VOICE는 최대 10MiB, STAFF만 허용합니다. 지원 MIME은 audio/mpeg, audio/mp4, audio/x-m4a, audio/wav, audio/x-wav, audio/webm, video/webm, video/mp4입니다. 서버가 MIME에 맞는 파일명으로 제공자에 전송하며 사용자 파일명은 지문 비교에서 제외합니다. 실제 코덱 디코딩은 제공자가 수행하고 잘못된 음성은 변환 실패로 처리합니다.

업로드 음성은 현재 요청의 백그라운드 작업에 전달하고 DB/영구 파일로 보관하지 않습니다. 원문 텍스트 또는 STT 변환문과 최초 제안은 analyses에 저장합니다. 음성 변환 뒤 AI가 한국어 summary, 5종 type, 확인된 signals를 구조화해 반환합니다. 출력 스키마 위반·거절·빈 결과를 성공으로 바꾸지 않습니다.

| 위험 신호 | 제안 위험도 |
|---|---|
| LIFE_THREAT, FIRE, CRUSH_RISK | URGENT |
| FACILITY_HAZARD, BLOCKED_PASSAGE, CROWDING | CAUTION |
| 위 신호 없음 | NORMAL |

AI는 현재 원문에서 확인되는 신호만 추출하며 부정·해소된 위험을 제외하도록 지시합니다. 위험도는 서버 규칙이 계산합니다. 원문 속 지시는 데이터로 다루며 임의 위치·인원·위험을 추가하지 않도록 지시합니다. 이는 모델 정확도의 보장이 아니며 스태프가 최종 확인·수정합니다.

## 실패·중단

- STT 실패: FAILED / TRANSCRIPTION_FAILED.
- 분석 실패: FAILED / ANALYSIS_FAILED.
- 단일 서버 프로세스 재시작 시 중단된 작업: FAILED / ANALYSIS_INTERRUPTED.
- 공개 FAILED 결과의 원문/제안 필드는 null이며 내부 제공자 오류 문자열을 노출하지 않습니다. 원문 보존과 공개 실패 응답은 별개입니다.
- 자동 재실행·시간 만료는 없습니다. 사용자가 새 키로 분석을 재시도하며 실패한 분석으로 신고를 만들 수 없습니다.
- I01의 최초 202 응답은 멱등 결과로 남습니다. 재전송은 최초 202를 반환하고 현재 READY/FAILED는 I02로 확인합니다.
- 단일 Uvicorn worker/인스턴스가 전제입니다. 다중 서버 작업 큐·리스·장애 복구는 이번 범위 밖입니다.

## 근거·검증

- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenAI file transcription](https://developers.openai.com/api/docs/guides/speech-to-text)
- 실제 키로 테스트 문장 분석 호출을 확인했으며 부정된 화재 신호가 제외됐습니다. 합성 테스트 음성의 실제 변환과 실제 HTTP 분석→접수→배정→완료→PDF 흐름도 확인했습니다. 최종 검사 결과는 PR의 검증 기록을 따릅니다.
- 제공자 대체 테스트는 상태·재전송·실패·역할·소유권을 검증합니다. 실제 기기 녹음·네트워크 단절·인식 정확도 벤치마크를 대체하지 않습니다.
