from pathlib import Path

ROOT = Path("/opt/workspace/business-starter-kit")

ENVS = [
    ("dev", "bsk-dev.devzaratech.xyz"),
    ("qa", "bsk-qa.devzaratech.xyz"),
    ("uat", "bsk-uat.devzaratech.xyz"),
    ("staging", "bsk-staging.devzaratech.xyz"),
    ("prod", "bsk-prod.devzaratech.xyz"),
]

HEADERS = """\
        encode gzip

        header {
                X-Frame-Options "DENY"
                X-Content-Type-Options "nosniff"
                Referrer-Policy "strict-origin-when-cross-origin"
                Permissions-Policy "geolocation=(), microphone=(), camera=()"
        }
"""

ROUTES = """\
        handle_path /api/python/* {
                reverse_proxy bsk-__ENV__-api-fastapi:8000 {
                        header_up X-Real-IP {http.request.header.CF-Connecting-IP}
                        header_up X-Forwarded-For {http.request.header.CF-Connecting-IP}
                        header_up X-Forwarded-Proto {scheme}
                        header_up Host {host}
                }
        }

        handle_path /api/node/* {
                reverse_proxy bsk-__ENV__-api-node:3001 {
                        header_up X-Real-IP {http.request.header.CF-Connecting-IP}
                        header_up X-Forwarded-For {http.request.header.CF-Connecting-IP}
                        header_up X-Forwarded-Proto {scheme}
                        header_up Host {host}
                }
        }

        handle_path /api/php/* {
                reverse_proxy bsk-__ENV__-api-php:8000 {
                        header_up X-Real-IP {http.request.header.CF-Connecting-IP}
                        header_up X-Forwarded-For {http.request.header.CF-Connecting-IP}
                        header_up X-Forwarded-Proto {scheme}
                        header_up Host {host}
                }
        }

        handle_path /api/* {
                reverse_proxy bsk-__ENV__-api-spring:8080 {
                        header_up X-Real-IP {http.request.header.CF-Connecting-IP}
                        header_up X-Forwarded-For {http.request.header.CF-Connecting-IP}
                        header_up X-Forwarded-Proto {scheme}
                        header_up Host {host}
                }
        }

        handle {
                reverse_proxy bsk-__ENV__-web:80 {
                        header_up X-Real-IP {http.request.header.CF-Connecting-IP}
                        header_up X-Forwarded-For {http.request.header.CF-Connecting-IP}
                        header_up X-Forwarded-Proto {scheme}
                        header_up Host {host}
                }
        }
"""

parts = []

for env, domain in ENVS:
    parts.append(f"{domain} {{\n")
    parts.append(HEADERS)
    parts.append("\n")
    parts.append(ROUTES.replace("__ENV__", env))
    parts.append("}\n\n")

out = ROOT / "infra/caddy/Caddyfile.multi-env"
out.write_text("".join(parts))

print(f"WROTE {out.relative_to(ROOT)}")
