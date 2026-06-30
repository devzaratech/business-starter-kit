from pathlib import Path
import re

ROOT = Path("/opt/workspace/business-starter-kit")

PROFILES = {
    "local":   {"api": 54321, "db": 54322, "shadow": 54320, "studio": 54323, "mailpit": 54324, "smtp": 54325, "pop3": 54326, "analytics": 54327, "pooler": 54329},
    "dev":     {"api": 15121, "db": 15122, "shadow": 15120, "studio": 15123, "mailpit": 15124, "smtp": 15125, "pop3": 15126, "analytics": 15127, "pooler": 15129},
    "qa":      {"api": 25121, "db": 25122, "shadow": 25120, "studio": 25123, "mailpit": 25124, "smtp": 25125, "pop3": 25126, "analytics": 25127, "pooler": 25129},
    "uat":     {"api": 35121, "db": 35122, "shadow": 35120, "studio": 35123, "mailpit": 35124, "smtp": 35125, "pop3": 35126, "analytics": 35127, "pooler": 35129},
    "staging": {"api": 45121, "db": 45122, "shadow": 45120, "studio": 45123, "mailpit": 45124, "smtp": 45125, "pop3": 45126, "analytics": 45127, "pooler": 45129},
    "prod":    {"api": 55121, "db": 55122, "shadow": 55120, "studio": 55123, "mailpit": 55124, "smtp": 55125, "pop3": 55126, "analytics": 55127, "pooler": 55129},
}

def assert_port(port: int, label: str) -> None:
    if port < 1 or port > 65535:
        raise ValueError(f"Invalid port {label}: {port}")

def section_bounds(text: str, section: str):
    m = re.search(rf"^\[{re.escape(section)}\]\s*$", text, flags=re.M)
    if not m:
        return None

    n = re.search(r"^\[.+?\]\s*$", text[m.end():], flags=re.M)
    end = m.end() + n.start() if n else len(text)
    return m.start(), end

def upsert_section_key(text: str, section: str, key: str, value: int):
    bounds = section_bounds(text, section)
    if not bounds:
        return text

    start, end = bounds
    block = text[start:end]
    line = f"{key} = {value}"

    if re.search(rf"^\s*{re.escape(key)}\s*=", block, flags=re.M):
        block = re.sub(rf"^\s*{re.escape(key)}\s*=.*$", line, block, flags=re.M)
    else:
        if not block.endswith("\n"):
            block += "\n"
        block += line + "\n"

    return text[:start] + block + text[end:]

for env, ports in PROFILES.items():
    for key, value in ports.items():
        assert_port(value, f"{env}.{key}")

    path = ROOT / f"supabase/config/{env}.toml"
    if not path.exists():
        print(f"SKIP missing {path.relative_to(ROOT)}")
        continue

    text = path.read_text()
    original = text

    updates = [
        ("api", "port", ports["api"]),
        ("db", "port", ports["db"]),
        ("db", "shadow_port", ports["shadow"]),
        ("studio", "port", ports["studio"]),
        ("inbucket", "port", ports["mailpit"]),
        ("inbucket", "smtp_port", ports["smtp"]),
        ("inbucket", "pop3_port", ports["pop3"]),
        ("local_smtp", "port", ports["mailpit"]),
        ("local_smtp", "smtp_port", ports["smtp"]),
        ("local_smtp", "pop3_port", ports["pop3"]),
        ("analytics", "port", ports["analytics"]),
        ("db.pooler", "port", ports["pooler"]),
    ]

    for section, key, value in updates:
        text = upsert_section_key(text, section, key, value)

    if text != original:
        path.write_text(text)
        print(f"UPDATED {path.relative_to(ROOT)}")
    else:
        print(f"SKIP no changes {path.relative_to(ROOT)}")

print("DONE")
