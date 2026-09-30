from pathlib import Path
import re

ROOT = Path("/opt/workspace/business-starter-kit")
COMPOSE_DIR = ROOT / "infra/compose"

PUBLIC_SERVICES = {
    "web",
    "api-spring",
    "api-node",
    "api-fastapi",
    "api-php",
    "reverse-proxy",
}

def service_block(text: str, service: str):
    pattern = re.compile(
        rf"(^  {re.escape(service)}:\n.*?)(?=^  [A-Za-z0-9_-]+:|\nvolumes:|\nnetworks:|\Z)",
        re.M | re.S,
    )
    return pattern.search(text)

def ensure_network_in_service_block(block: str, network: str) -> str:
    if re.search(rf"^\s+-\s+{re.escape(network)}\s*$", block, flags=re.M):
        return block

    if re.search(r"^    networks:\n", block, flags=re.M):
        return re.sub(
            r"(^    networks:\n)",
            r"\1      - " + network + "\n",
            block,
            count=1,
            flags=re.M,
        )

    lines = block.splitlines(keepends=True)
    insert_at = None

    for i, line in enumerate(lines):
        if line.startswith("    depends_on:") or line.startswith("    volumes:") or line.startswith("    ports:"):
            insert_at = i
            break

    if insert_at is None:
        insert_at = len(lines)

    lines[insert_at:insert_at] = [
        "    networks:\n",
        f"      - {network}\n",
    ]

    return "".join(lines)

def ensure_network_definition(text: str) -> str:
    if re.search(r"^  bsk-edge:\n", text, flags=re.M):
        return text

    network_def = """\
  bsk-edge:
    external: true
    name: bsk-edge
"""

    if re.search(r"^networks:\n", text, flags=re.M):
        return re.sub(r"^networks:\n", "networks:\n" + network_def, text, count=1, flags=re.M)

    if not text.endswith("\n"):
        text += "\n"

    return text + "\nnetworks:\n" + network_def

for path in sorted(COMPOSE_DIR.glob("docker-compose.*.yml")):
    text = path.read_text()
    original = text

    for service in PUBLIC_SERVICES:
        m = service_block(text, service)
        if not m:
            continue

        block = m.group(1)
        block2 = ensure_network_in_service_block(block, "bsk-edge")
        text = text[:m.start(1)] + block2 + text[m.end(1):]

    text = ensure_network_definition(text)

    if text != original:
        path.write_text(text)
        print(f"UPDATED {path.relative_to(ROOT)}")

print("DONE")
