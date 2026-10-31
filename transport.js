(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.TallerTransport = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const PART_BYTES = 256 * 1024,
    MAX_BYTES = 25 * 1024 * 1024;
  const uploads = new Map();
  const fail = (message, status = 400) => {
    const error = new Error(message);
    error.status = status;
    throw error;
  };
  const checksum = async (data) =>
    [...new Uint8Array(await crypto.subtle.digest("SHA-256", data))]
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
  function base64(data) {
    let result = "";
    for (let i = 0; i < data.length; i += 8192)
      result += String.fromCharCode(...data.subarray(i, i + 8192));
    return btoa(result);
  }
  async function send(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
    let data;
    try {
      data = await response.json();
    } catch {
      fail(
        response.status === 413
          ? "El servidor rechazó el tamaño del archivo."
          : "El servicio no devolvió una respuesta válida. Revisa el despliegue e intenta de nuevo.",
        response.status >= 400 ? response.status : 502,
      );
    }
    if (!response.ok)
      fail(data.error || "No se pudo completar la solicitud.", response.status);
    return data;
  }
  async function request(url, options = {}) {
    if (url === "/api/action" && typeof options.body === "string") {
      const bytes = new TextEncoder().encode(options.body);
      if (bytes.length > 3 * 1024 * 1024) {
        if (bytes.length > MAX_BYTES)
          fail("El archivo supera los 25 MB permitidos.", 413);
        const hash = await checksum(bytes);
        let upload = uploads.get(hash);
        if (!upload || upload.expires <= Date.now()) {
          const info = await send("/api/transfers", {
            method: "POST",
            body: JSON.stringify({
              bytes: bytes.length,
              parts: Math.ceil(bytes.length / PART_BYTES),
              checksum: hash,
            }),
          });
          upload = {
            id: info.id,
            expires: Date.now() + 9 * 60000,
          };
          for (let i = 0; i < Math.ceil(bytes.length / PART_BYTES); i++)
            await send("/api/transfers/" + info.id + "/parts/" + i, {
              method: "POST",
              body: JSON.stringify({
                payload: base64(
                  bytes.subarray(i * PART_BYTES, (i + 1) * PART_BYTES),
                ),
              }),
            });
          uploads.set(hash, upload);
        }
        try {
          return await send(url, {
            ...options,
            body: JSON.stringify({
              __upload: upload.id,
            }),
          });
        } catch (error) {
          if (error.status === 410) uploads.delete(hash);
          throw error;
        }
      }
    }
    return send(url, options);
  }
  return {
    request,
  };
});
