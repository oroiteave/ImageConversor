# Conversor WebP

Convierte y optimiza imágenes (JPG, PNG, GIF, BMP, TIFF, WebP…) a WebP para la web.

La web ejecuta el mismo código Python que el script, compilado a **WebAssembly** con [Pyodide](https://pyodide.org). Las imágenes se procesan en el navegador y nunca se suben a ningún servidor.

## Qué hace

- Reduce las imágenes más anchas que el ancho máximo (1280 px por defecto). Las pequeñas no se agrandan.
- Comprime con WebP en modo de máxima eficiencia (calidad 75 por defecto).
- En PNG, GIF, etc. prueba también WebP sin pérdida y se queda con el más ligero.
- Quita la transparencia si no se usa, gira las fotos según su orientación EXIF, convierte los colores a sRGB y elimina los metadatos.

## Archivos

| Archivo | Para qué |
| --- | --- |
| `converter.py` | Lógica de conversión (compartida por el script y la web) |
| `jpg_webp.py` | Script de línea de comandos |
| `index.html`, `style.css`, `app.js` | Interfaz web |
| `worker.js` | Carga Pyodide y ejecuta `converter.py` en segundo plano |

## Usar la web en local

Hay que servirla con un servidor (abrir `index.html` directamente no funciona):

```
python -m http.server 8000
```

Y abrir <http://localhost:8000>.

## Usar el script

Requiere Python y Pillow (`pip install pillow`). Convierte las imágenes de todas las subcarpetas y las guarda en `imagenes_webp/`:

```
python jpg_webp.py
```

## Publicar en GitHub Pages

1. Crea un repositorio en GitHub y sube el proyecto.
2. En el repositorio: **Settings → Pages → Build and deployment**, elige **Deploy from a branch**, rama `main` y carpeta `/ (root)`.
3. En un minuto estará disponible en `https://<tu-usuario>.github.io/<repositorio>/`.
