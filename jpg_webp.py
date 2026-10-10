import os
from converter import SUPPORTED_EXTENSIONS, convert_to_webp

# Carpeta destino
output_folder = "imagenes_webp"
os.makedirs(output_folder, exist_ok=True)

# Carpetas origen: todas las subcarpetas excepto la de destino
input_folders = [
    d for d in os.listdir(".")
    if os.path.isdir(d) and d != output_folder and not d.startswith(".")
]

total_before = 0
total_after = 0

for input_folder in input_folders:
    for filename in os.listdir(input_folder):
        if not filename.lower().endswith(SUPPORTED_EXTENSIONS):
            continue

        input_path = os.path.join(input_folder, filename)
        output_name = os.path.splitext(filename)[0] + ".webp"
        output_path = os.path.join(output_folder, output_name)

        print(f"Procesando: {input_path}")

        try:
            with open(input_path, "rb") as f:
                original = f.read()

            data = convert_to_webp(original)

            with open(output_path, "wb") as f:
                f.write(data)

            total_before += len(original)
            total_after += len(data)
            print(f"  {len(original) / 1024:.0f} KB -> {len(data) / 1024:.0f} KB")
        except Exception as e:
            print(f"  Error con {input_path}: {e}")

if total_before:
    saved = 100 - total_after * 100 / total_before
    print(f"\nTotal: {total_before / 1024 / 1024:.1f} MB -> {total_after / 1024 / 1024:.1f} MB ({saved:.0f}% menos)")
print("Conversión terminada 🎉")
