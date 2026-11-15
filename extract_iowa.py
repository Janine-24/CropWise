
from pathlib import Path
import csv
import json
import pyogrio

# 你的 National CSB 数据位置
GDB = Path(r"C:\Users\Janine\Desktop\Hello\CropWise\CropWise\agridash-interactive-project\data\NationalCSB_2018-2025_rev23\CSB1825.gdb")
OUTPUT = Path("data/iowa")
OUTPUT.mkdir(parents=True, exist_ok=True)

if not GDB.exists():
    raise FileNotFoundError(f"找不到数据库: {GDB}")

# 1. 检查数据库有哪些图层
layers = pyogrio.list_layers(GDB)
print("Available layers:", layers)

layer_names = [row[0] for row in layers]

if "national1825" not in layer_names:
    raise ValueError("找不到 national1825 图层，请检查上面的列表")

layer = "national1825"

# 2. 检查真实字段
info = pyogrio.read_info(GDB, layer=layer)
fields = list(info["fields"])
print("Available fields:", fields)

# Iowa 的州代码是 19
if "STATEFIPS" in fields:
    where = "STATEFIPS = '19'"
elif "CSBID" in fields:
    where = "CSBID LIKE '19%'"
else:
    raise ValueError("没有找到 STATEFIPS 或 CSBID")

# 3. 先测试筛选能否成功
sample = pyogrio.read_dataframe(
    GDB,
    layer=layer,
    where=where,
    max_features=5,
    read_geometry=False
)

print("Iowa sample:")
print(sample.head())

if sample.empty:
    raise ValueError("没有找到 Iowa 数据，请检查字段类型和筛选条件")

# 4. 分批提取，避免一次读取过多数据
batch_size = 10000
offset = 0
total = 0
total_acres = 0.0

csv_path = OUTPUT / "iowa_fields.csv"
geojson_path = OUTPUT / "iowa_fields.geojson"

with open(csv_path, "w", newline="", encoding="utf-8") as csv_file, \
     open(geojson_path, "w", encoding="utf-8") as geo_file:

    writer = None
    geo_file.write('{"type":"FeatureCollection","features":[')
    first = True

    while True:
        batch = pyogrio.read_dataframe(
            GDB,
            layer=layer,
            where=where,
            skip_features=offset,
            max_features=batch_size
        )

        if batch.empty:
            break

        # Web 地图使用经纬度坐标
        batch = batch.to_crs("EPSG:4326")

        batch["hectares"] = (
            batch["CSBACRES"].fillna(0) * 0.404686
        )

        properties = batch.drop(columns="geometry")

        if writer is None:
            writer = csv.DictWriter(
                csv_file,
                fieldnames=list(properties.columns)
            )
            writer.writeheader()

        for record in properties.to_dict("records"):
            writer.writerow(record)

        for feature in json.loads(batch.to_json())["features"]:
            if not first:
                geo_file.write(",")
            json.dump(feature, geo_file, ensure_ascii=False)
            first = False

        total += len(batch)
        total_acres += batch["CSBACRES"].fillna(0).sum()
        offset += len(batch)

        print(f"已处理 {total} 块 Iowa 农田")

    geo_file.write("]}")

print("\n提取完成！")
print("Iowa fields:", total)
print("Total acres:", round(total_acres, 2))
print("Total hectares:", round(total_acres * 0.404686, 2))
print("CSV:", csv_path)
print("GeoJSON:", geojson_path)
