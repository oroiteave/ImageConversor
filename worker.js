// Ejecuta converter.py con Pyodide (Python compilado a WebAssembly) fuera del hilo principal
import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pyodide.mjs";

const PY_HELPERS = `
import io
import zipfile
from PIL import UnidentifiedImageError
from converter import convert_to_webp

def convert(js_bytes, quality, width):
    try:
        return convert_to_webp(js_bytes.to_bytes(), int(quality), int(width))
    except UnidentifiedImageError:
        raise ValueError("No es una imagen o su formato no es compatible") from None

def make_zip(names, buffers):
    out = io.BytesIO()
    # Sin compresión: los WebP ya están comprimidos
    with zipfile.ZipFile(out, "w", zipfile.ZIP_STORED) as zf:
        for name, buf in zip(names, buffers):
            zf.writestr(name, buf.to_bytes())
    return out.getvalue()
`;

let convert;
let makeZip;

async function init() {
  const pyodide = await loadPyodide();
  await pyodide.loadPackage("pillow");

  const source = await (await fetch("./converter.py")).text();
  pyodide.FS.writeFile("converter.py", source);
  pyodide.runPython(PY_HELPERS);

  convert = pyodide.globals.get("convert");
  makeZip = pyodide.globals.get("make_zip");
}

const ready = init();

ready.then(
  () => postMessage({ type: "ready" }),
  (err) => postMessage({ type: "fatal", error: String(err) })
);

function toUint8(pyBytes) {
  const data = pyBytes.toJs();
  pyBytes.destroy();
  return data;
}

onmessage = async ({ data: msg }) => {
  await ready;
  try {
    if (msg.type === "convert") {
      const result = toUint8(convert(new Uint8Array(msg.buffer), msg.quality, msg.width));
      postMessage({ type: "converted", id: msg.id, buffer: result.buffer }, [result.buffer]);
    } else if (msg.type === "zip") {
      const buffers = msg.buffers.map((b) => new Uint8Array(b));
      const result = toUint8(makeZip(msg.names, buffers));
      postMessage({ type: "zipped", buffer: result.buffer }, [result.buffer]);
    }
  } catch (err) {
    // Los errores de Python traen todo el traceback: se muestra solo el mensaje final
    const message = String(err.message || err).trim().split("\n").pop().replace(/^[\w.]+Error: /, "");
    postMessage({ type: "error", id: msg.id, error: message });
  }
};
