/** Reference YAML for the recovery contract editor — targets & expectations only. */
export const RECOVERY_CONTRACT_EXAMPLE = `version: "1"
recovery:
  rto: 15m
  rpo: 5m
  required:
    database: true
    schema: true
    critical_queries: true
    healthcheck: true   # set true to require application health
    api: false
  application:
    healthcheck: https://api.example.com
    endpoints:
      - name: health
        method: GET
        path: /health
        expect_status: 200
      - name: readiness
        method: GET
        path: /ready
        expect_status: 200
  dependencies: []
  max_verification_age_hours: 168
`;

export const VALIDATION_PLAN_HTTP_HEALTH_EXAMPLE = `  - type: http_health
    url: https://api.example.com/health
    name: application_health
    expect_status: 200
`;
