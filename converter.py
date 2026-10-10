"""Lógica de conversión a WebP, compartida por el script (jpg_webp.py) y la web (WebAssembly)."""
import io
from PIL import Image, ImageOps

# La gestión de color (LittleCMS) no está incluida en el Pillow de Pyodide (la web)
try:
    from PIL import ImageCms

    SRGB_PROFILE = ImageCms.createProfile("sRGB")
except ImportError:
    ImageCms = None

TARGET_WIDTH = 1280
QUALITY = 75

# Todas las extensiones que Pillow sabe abrir (jpg, png, gif, bmp, tiff, webp, ...)
SUPPORTED_EXTENSIONS = tuple(
    ext for ext, fmt in Image.registered_extensions().items() if fmt in Image.OPEN
)

# Formatos que ya tienen pérdida: para ellos no tiene sentido probar WebP sin pérdida
LOSSY_FORMATS = {"JPEG", "MPO"}



def to_srgb(img):
    """Convierte la imagen a sRGB si trae otro perfil de color (p. ej. Display P3 de iPhone).

    Devuelve la imagen y el perfil ICC que hay que conservar en el WebP: ninguno si se
    pudo convertir a sRGB (la web asume sRGB), o el original si no se pudo.
    """
    icc = img.info.get("icc_profile")
    if not icc:
        return img, None
    if ImageCms is None:
        return img, icc
    try:
        src_profile = ImageCms.ImageCmsProfile(io.BytesIO(icc))
        output_mode = "RGBA" if img.mode == "RGBA" else "RGB"
        return ImageCms.profileToProfile(img, src_profile, SRGB_PROFILE, outputMode=output_mode), None
    except Exception:
        return img, icc


def encode_webp(img, lossless, quality, icc_profile=None):
    buffer = io.BytesIO()
    extra = {"icc_profile": icc_profile} if icc_profile else {}
    if lossless:
        # quality=100 en modo lossless = máximo esfuerzo de compresión
        img.save(buffer, format="WEBP", lossless=True, quality=100, method=6, **extra)
    else:
        # method=6 = compresión más lenta pero más eficiente (mismo aspecto, menos peso)
        img.save(buffer, format="WEBP", quality=quality, method=6, **extra)
    return buffer.getvalue()


def convert_to_webp(data, quality=QUALITY, target_width=TARGET_WIDTH):
    """Recibe los bytes de una imagen y devuelve los bytes del WebP optimizado."""
    with Image.open(io.BytesIO(data)) as img:
        source_format = img.format

        # Girar según la orientación EXIF (fotos de móvil) antes de quitar los metadatos
        img = ImageOps.exif_transpose(img)

        # Mantener la transparencia si la imagen la tiene
        if "A" in img.mode or "transparency" in img.info:
            img = img.convert("RGBA")
            # Si en realidad no hay ningún píxel transparente, no guardar canal alfa
            if img.getchannel("A").getextrema() == (255, 255):
                img = img.convert("RGB")
        else:
            img = img.convert("RGB")

        img, icc = to_srgb(img)

        # Reducir manteniendo proporciones (solo si es más ancha que target_width)
        if img.width > target_width:
            w_percent = target_width / float(img.width)
            new_height = int(float(img.height) * w_percent)
            img = img.resize((target_width, new_height), Image.LANCZOS)

        # Comprimir con pérdida y, si el original no la tenía (PNG, GIF...),
        # probar también sin pérdida y quedarse con el más ligero
        result = encode_webp(img, lossless=False, quality=quality, icc_profile=icc)
        if source_format not in LOSSY_FORMATS:
            lossless_result = encode_webp(img, lossless=True, quality=quality, icc_profile=icc)
            if len(lossless_result) < len(result):
                result = lossless_result

    # Se devuelve sin metadatos EXIF
    return result
