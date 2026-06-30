from pathlib import Path
import re

ROOT = Path("/opt/workspace/business-starter-kit")

ENV_SPECS = {
    "local": {
        "compose_project": "bsk-local",
        "env_file": "config/env/.env.local.example",
        "postgres": "5432",
        "redis": "6379",
        "n8n": "5678",
        "seaweed_master": "10933",
        "seaweed_filer": "10888",
        "seaweed_s3": "10833",
    },
    "dev": {
        "compose_project": "bsk-dev",
        "env_file": "config/env/.env.dev.example",
        "real_env_file": "config/env/.env.dev",
        "postgres": "15432",
        "redis": "16379",
        "n8n": "15678",
        "seaweed_master": "19333",
        "seaweed_filer": "18888",
        "seaweed_s3": "18333",
    },
    "qa": {
        "compose_project": "bsk-qa",
        "env_file": "config/env/.env.qa.example",
        "postgres": "25432",
        "redis": "26379",
        "n8n": "25678",
        "seaweed_master": "29333",
        "seaweed_filer": "28888",
        "seaweed_s3": "28333",
    },
    "uat": {
        "compose_project": "bsk-uat",
        "env_file": "config/env/.env.uat.example",
        "postgres": "35432",
        "redis": "36379",
        "n8n": "35678",
        "seaweed_master": "39333",
        "seaweed_filer": "38888",
        "seaweed_s3": "38333",
    },
    "staging": {
        "compose_project": "bsk-staging",
        "env_file": "config/env/.env.staging.example",
        "postgres": "45432",
        "redis": "46379",
        "n8n": "45678",
        "seaweed_master": "49333",
        "seaweed_filer": "48888",
        "seaweed_s3": "48333",
    },
    "prod": {
        "compose_project": "bsk-prod",
        "env_file": "config/env/.env.prod.example",
        "postgres": "55432",
        "redis": "56379",
        "n8n": "55678",
        "seaweed_master": "59333",
        "seaweed_filer": "58888",
        "seaweed_s3": "58333",
    },
    "vps": {
        "compose_project": "bsk-vps",
        "env_file": ".env.example",
        "postgres": "60432",
        "redis": "60379",
        "n8n": "60678",
        "seaweed_master": "60933",
        "seaweed_filer": "60888",
        "seaweed_s3": "60833",
    },
}

PORT_VARS = {
    "postgres": ("POSTGRES_HOST_BIND", "POSTGRES_HOST_PORT", "5432"),
    "redis": ("REDIS_HOST_BIND", "REDIS_HOST_PORT", "6379"),
    "n8n": ("N8N_HOST_BIND", "N8N_HOST_PORT", "5678"),
    "seaweed_master": ("SEAWEED_MASTER_HOST_BIND", "SEAWEED_MASTER_HOST_PORT", "9333"),
    "seaweed_filer": ("SEAWEED_FILER_HOST_BIND", "SEAWEED_FILER_HOST_PORT", "8888"),
    "seaweed_s3": ("SEAWEED_S3_HOST_BIND", "SEAWEED_S3_HOST_PORT", "8333"),
}

def assert_valid_port(value: str, label: str) -> None:
    port = int(value)
    if port < 1 or port > 65535:
        raise ValueError(f"Invalid port for {label}: {value}")

def upsert_env(path: Path, values: dict[str, str]) -> None:
    if not path.exists():
        print(f"SKIP missing env file: {path.relative_to(ROOT)}")
        return

    text = path.read_text()
    original = text

    if not text.endswith("\n"):
        text += "\n"

    for key, value in values.items():
        if re.search(rf"^{re.escape(key)}=", text, flags=re.M):
            text = re.sub(rf"^{re.escape(key)}=.*", f"{key}={value}", text, flags=re.M)
        else:
            text += f"{key}={value}\n"

    if text != original:
        path.write_text(text)
        print(f"UPDATED env: {path.relative_to(ROOT)}")

def patch_compose_name(path: Path) -> None:
    text = path.read_text()
    if re.search(r"^name:\s*", text, flags=re.M):
        return

    path.write_text("name: ${COMPOSE_PROJECT_NAME:-bsk-dev}\n" + text)
    print(f"UPDATED compose project name: {path.relative_to(ROOT)}")

def patch_container_names(path: Path) -> None:
    text = path.read_text()
    original = text

    def repl(match):
        value = match.group(1).strip().strip('"').strip("'")

        if "${APP_ENV" in value:
            return match.group(0)

        if not value.startswith("bsk-"):
            return match.group(0)

        suffix = value.removeprefix("bsk-")
        return f"container_name: bsk-${{APP_ENV:-dev}}-{suffix}"

    text = re.sub(r"container_name:\s*([^\n]+)", repl, text)
    text = text.replace("bsk-${APP_ENV:-dev}-${APP_ENV:-dev}-", "bsk-${APP_ENV:-dev}-")

    if text != original:
        path.write_text(text)
        print(f"UPDATED container_name: {path.relative_to(ROOT)}")

def service_block(text: str, service: str):
    pattern = re.compile(
        rf"(^  {re.escape(service)}:\n.*?)(?=^  [A-Za-z0-9_-]+:|\nvolumes:|\nnetworks:|\Z)",
        re.M | re.S,
    )
    return pattern.search(text)

def ensure_service_port(path: Path, service: str, bind_var: str, port_var: str, default_host_port: str, container_port: str) -> None:
    text = path.read_text()
    original = text

    match = service_block(text, service)
    if not match:
        return

    block = match.group(1)
    desired = f'      - "${{{bind_var}:-127.0.0.1}}:${{{port_var}:-{default_host_port}}}:{container_port}"'

    if bind_var in block and port_var in block and f":{container_port}" in block:
        return

    # Remove existing mapping to the same container port.
    block2 = re.sub(
        rf'      - ".*:{re.escape(container_port)}"\n',
        "",
        block,
    )

    if re.search(r"^    ports:\n", block2, flags=re.M):
        block2 = re.sub(r"(^    ports:\n)", r"\1" + desired + "\n", block2, count=1, flags=re.M)
    else:
        lines = block2.splitlines(keepends=True)
        insert_at = None
        for i, line in enumerate(lines):
            if line.startswith("    volumes:") or line.startswith("    depends_on:") or line.startswith("    networks:") or line.startswith("    environment:"):
                insert_at = i
                break
        if insert_at is None:
            insert_at = len(lines)
        lines[insert_at:insert_at] = ["    ports:\n", desired + "\n"]
        block2 = "".join(lines)

    text = text[:match.start(1)] + block2 + text[match.end(1):]

    if text != original:
        path.write_text(text)
        print(f"UPDATED port {service}: {path.relative_to(ROOT)}")

def patch_ports(path: Path) -> None:
    ensure_service_port(path, "postgres", "POSTGRES_HOST_BIND", "POSTGRES_HOST_PORT", "15432", "5432")
    ensure_service_port(path, "redis", "REDIS_HOST_BIND", "REDIS_HOST_PORT", "16379", "6379")
    ensure_service_port(path, "n8n", "N8N_HOST_BIND", "N8N_HOST_PORT", "15678", "5678")
    ensure_service_port(path, "seaweed-master", "SEAWEED_MASTER_HOST_BIND", "SEAWEED_MASTER_HOST_PORT", "19333", "9333")
    ensure_service_port(path, "seaweed-filer", "SEAWEED_FILER_HOST_BIND", "SEAWEED_FILER_HOST_PORT", "18888", "8888")
    ensure_service_port(path, "seaweed-s3", "SEAWEED_S3_HOST_BIND", "SEAWEED_S3_HOST_PORT", "18333", "8333")

def validate_env_specs() -> None:
    for env, spec in ENV_SPECS.items():
        for key in ["postgres", "redis", "n8n", "seaweed_master", "seaweed_filer", "seaweed_s3"]:
            assert_valid_port(spec[key], f"{env}.{key}")

def apply_env_files() -> None:
    for env, spec in ENV_SPECS.items():
        values = {
            "APP_ENV": env,
            "COMPOSE_PROJECT_NAME": spec["compose_project"],
        }

        for logical_name, (bind_key, port_key, _) in PORT_VARS.items():
            values[bind_key] = "127.0.0.1"
            values[port_key] = spec[logical_name]

        paths = [ROOT / spec["env_file"]]
        if "real_env_file" in spec:
            paths.append(ROOT / spec["real_env_file"])

        for path in paths:
            upsert_env(path, values)

def apply_compose_files() -> None:
    for path in sorted((ROOT / "infra/compose").glob("docker-compose.*.yml")):
        patch_compose_name(path)
        patch_container_names(path)
        patch_ports(path)

validate_env_specs()
apply_compose_files()
apply_env_files()

print("DONE")
