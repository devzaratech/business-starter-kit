from pathlib import Path
import re

ROOT = Path("/opt/workspace/business-starter-kit")

ENV_COMPOSE_FILES = [
    ROOT / "infra/compose/docker-compose.dev.yml",
    ROOT / "infra/compose/docker-compose.qa.yml",
    ROOT / "infra/compose/docker-compose.uat.yml",
    ROOT / "infra/compose/docker-compose.staging.yml",
    ROOT / "infra/compose/docker-compose.prod.yml",
]

PUBLIC_SERVICES = [
    "web",
    "api-spring",
    "api-node",
    "api-fastapi",
    "api-php",
]

def service_block(text: str, service: str):
    pattern = re.compile(
        rf"(^  {re.escape(service)}:\n.*?)(?=^  [A-Za-z0-9_-]+:|\nvolumes:|\nnetworks:|\Z)",
        re.M | re.S,
    )
    return pattern.search(text)

def ensure_service_network(text: str, service: str, network: str) -> tuple[str, bool]:
    match = service_block(text, service)
    if not match:
        return text, False

    block = match.group(1)

    if re.search(rf"^\s*-\s*{re.escape(network)}\s*$", block, flags=re.M):
        return text, False

    if re.search(r"^    networks:\n", block, flags=re.M):
        block2 = re.sub(
            r"(^    networks:\n)",
            r"\1      - " + network + "\n",
            block,
            count=1,
            flags=re.M,
        )
    else:
        lines = block.splitlines(keepends=True)
        insert_at = None

        for i, line in enumerate(lines):
            if line.startswith("    depends_on:") or line.startswith("    environment:") or line.startswith("    ports:") or line.startswith("    volumes:"):
                insert_at = i
                break

        if insert_at is None:
            insert_at = len(lines)

        lines[insert_at:insert_at] = [
            "    networks:\n",
            f"      - {network}\n",
        ]
        block2 = "".join(lines)

    return text[:match.start(1)] + block2 + text[match.end(1):], True

def force_reverse_proxy_single_env_profile(text: str) -> tuple[str, bool]:
    match = service_block(text, "reverse-proxy")
    if not match:
        return text, False

    block = match.group(1)
    original = block

    if re.search(r"^    profiles:\n", block, flags=re.M):
        block = re.sub(
            r"^    profiles:\n(?:      - .+\n)+",
            '    profiles:\n      - single-env-proxy\n',
            block,
            count=1,
            flags=re.M,
        )
    else:
        lines = block.splitlines(keepends=True)
        insert_at = None

        for i, line in enumerate(lines):
            if line.startswith("    image:") or line.startswith("    build:"):
                insert_at = i + 1
                break

        if insert_at is None:
            insert_at = 1

        lines[insert_at:insert_at] = [
            "    profiles:\n",
            "      - single-env-proxy\n",
        ]
        block = "".join(lines)

    if block == original:
        return text, False

    return text[:match.start(1)] + block + text[match.end(1):], True

def ensure_top_level_edge_network(text: str) -> tuple[str, bool]:
    if re.search(r"^  bsk-edge:\n", text, flags=re.M):
        return text, False

    edge_block = """\
  bsk-edge:
    external: true
    name: bsk-edge
"""

    if re.search(r"^networks:\n", text, flags=re.M):
        text = re.sub(r"^networks:\n", "networks:\n" + edge_block, text, count=1, flags=re.M)
        return text, True

    if not text.endswith("\n"):
        text += "\n"

    text += "\nnetworks:\n" + edge_block
    return text, True

for path in ENV_COMPOSE_FILES:
    if not path.exists():
        print(f"SKIP missing {path.relative_to(ROOT)}")
        continue

    text = path.read_text()
    original = text

    changed = False

    text, c = force_reverse_proxy_single_env_profile(text)
    changed = changed or c

    for service in PUBLIC_SERVICES:
        text, c = ensure_service_network(text, service, "bsk-edge")
        changed = changed or c

    text, c = ensure_top_level_edge_network(text)
    changed = changed or c

    if changed and text != original:
        path.write_text(text)
        print(f"UPDATED {path.relative_to(ROOT)}")
    else:
        print(f"OK no changes {path.relative_to(ROOT)}")

print("DONE")
