import type { Fields } from './ddb'

/** Read every widget annotation's name and value. DDB exports have no AcroForm, so walk the pages. */
export async function readPdfFields(file: File): Promise<{ fields: Fields; portrait?: string }> {
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const fields: Fields = {}
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const anns = await page.getAnnotations()
    for (const a of anns as { subtype?: string; fieldName?: string; fieldValue?: unknown }[]) {
      if (a.subtype !== 'Widget' || !a.fieldName) continue
      const v = Array.isArray(a.fieldValue) ? a.fieldValue.join(', ') : a.fieldValue
      if (typeof v === 'string' && !(a.fieldName in fields && !v)) fields[a.fieldName] = v
    }
  }
  await doc.loadingTask.destroy()
  return { fields }
}
