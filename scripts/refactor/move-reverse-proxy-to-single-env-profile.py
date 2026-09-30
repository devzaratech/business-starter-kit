from pathlib import Path
import re

ROOT = Path("/opt/workspace/business-starter-kit")

TARGETS = {
    "infra/compose/docker-compose.vps.yml": "single-env-proxy",
    "infra/compose/docker-compose.edge.yml": "no-profile",
}

def find_block(lines, service):
    start = None
    indent = None

    for i, line in enumerate(lines):
        m = re.match(rf"^(\s*){re.escape(service)}:\s*$", line)
        if m:
            start = i
            indent = len(m.group(1))
            break

    if start is None:
        return None

    end = len(lines)
    for j in range(start + 1, len(lines)):
        line = lines[j]

        if not line.strip():
            continue

        current_indent = len(line) - len(line.lstrip(" "))

        if current_indent <= indent and re.match(r"^\s*[A-Za-z0-9_-]+:\s*$", line):
            end = j
            break

    return start, end, indent

def normalize_reverse_proxy(path: Path, mode: str):
    lines = path.read_text().splitlines(keepends=True)
    found = find_block(lines, "reverse-proxy")

    if not found:
        print(f"SKIP no reverse-proxy: {path.relative_to(ROOT)}")
        return

    start, end, service_indent = found
    block = lines[start:end]

    child_indent = service_indent + 2
    new_block = []
    i = 0

    while i < len(block):
        line = block[i]
        current_indent = len(line) - len(line.lstrip(" "))

        if current_indent == child_indent and line.lstrip().startswith("profiles:"):
            inline = line.strip() != "profiles:"
            i += 1

            if not inline:
                while i < len(block):
                    next_line = block[i]

                    if not next_line.strip():
                        i += 1
                        continue

                    next_indent = len(next_line) - len(next_line.lstrip(" "))

                    if next_indent > child_indent:
                        i += 1
                        continue

                    break

            continue

        new_block.append(line)
        i += 1

    if mode == "single-env-proxy":
        new_block[1:1] = [
            " " * child_indent + "profiles:\n",
            " " * (child_indent + 2) + "- single-env-proxy\n",
        ]
    elif mode == "no-profile":
        pass
    else:
        raise ValueError(mode)

    new_lines = lines[:start] + new_block + lines[end:]
    path.write_text("".join(new_lines))
    print(f"UPDATED {path.relative_to(ROOT)} -> {mode}")

for rel, mode in TARGETS.items():
    normalize_reverse_proxy(ROOT / rel, mode)

print("DONE")
