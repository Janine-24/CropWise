
from pathlib import Path

path = Path("data/iowa/iowa_fields.geojson")

if not path.exists():
    raise FileNotFoundError(path)

with path.open("rb+") as f:
    f.seek(0, 2)
    size = f.tell()
    if size == 0:
        raise ValueError("GeoJSON 文件为空")

    # 找到最后一个完整 Feature 的结尾
    pos = size
    found = False

    while pos > 0:
        start = max(0, pos - 1024 * 1024)
        f.seek(start)
        chunk = f.read(pos - start)

        idx = chunk.rfind(b"}")

        if idx != -1:
            f.truncate(start + idx + 1)
            f.seek(0, 2)
            f.write(b"]}")
            found = True
            break

        pos = start

    if not found:
        raise ValueError("没有找到完整的 Feature")

print("GeoJSON 修复尝试完成")
