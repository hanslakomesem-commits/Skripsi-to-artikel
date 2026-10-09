// Keep every PDF character map while fitting GitHub's 100-file browser upload limit.
// PDF.js requests a map on demand; the local archive is shared across documents.
const archives = new Map();

function loadArchive(url) {
  if (!archives.has(url)) {
    const promise = (async () => {
      if (!globalThis.JSZip) throw new Error('Pembaca ZIP belum dimuat. Muat ulang aplikasi.');
      const response = await fetch(url);
      if (!response.ok) throw new Error('Peta karakter PDF gagal dimuat. Pastikan vendor/pdfjs/cmaps.zip ikut diunggah.');
      return globalThis.JSZip.loadAsync(await response.arrayBuffer());
    })().catch(error => {
      archives.delete(url);
      throw error;
    });
    archives.set(url, promise);
  }
  return archives.get(url);
}

export class ZipCMapReaderFactory {
  constructor({baseUrl, isCompressed = true}) {
    if (!baseUrl || !isCompressed) throw new Error('Konfigurasi peta karakter PDF tidak valid.');
    this.archiveUrl = new URL('cmaps.zip', baseUrl).href;
  }

  async fetch({name}) {
    if (typeof name !== 'string' || !/^[A-Za-z0-9_-]+$/.test(name)) {
      throw new Error('Nama peta karakter PDF tidak valid.');
    }
    const archive = await loadArchive(this.archiveUrl);
    const map = archive.file(name + '.bcmap');
    if (!map) throw new Error('Peta karakter PDF tidak ditemukan: ' + name);
    return {cMapData: await map.async('uint8array'), isCompressed: true};
  }
}
