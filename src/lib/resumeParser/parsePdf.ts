/**
 * parsePdf.ts — Extract raw text from a PDF file using pdfjs-dist (client-side).
 *
 * Runs entirely in the browser/extension popup context; no server needed.
 * pdfjs-dist uses a WASM-powered worker for heavy lifting.
 *
 * Phase 2 implementation — see docs/features/03-resume-parsing.md
 */

import * as pdfjsLib from 'pdfjs-dist'

// ---------------------------------------------------------------------------
// Worker setup
//
// CRXJS bundles the extension as MV3. The pdf.js worker must be accessible
// as a URL that Chrome can load. We import it with Vite's `?url` suffix so
// CRXJS includes it as a web-accessible asset and gives us its final URL.
//
// If this import fails at build time, fall back to Option A (copy worker to
// public/ and reference via chrome.runtime.getURL). See implementation plan.
// ---------------------------------------------------------------------------
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

// Minimum non-whitespace character count to consider a page "has text".
// Below this, we treat it as a scanned/image-only page.
const MIN_TEXT_CHARS = 20

/**
 * Extracts all text from a PDF file.
 *
 * @param file - A File object from a browser file picker (<input type="file">).
 * @returns Concatenated text of all pages, separated by newlines.
 * @throws Error with a user-readable message if the PDF has no text layer
 *         (i.e. scanned image) or if loading fails.
 */
export async function parsePdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()

  let pdf: pdfjsLib.PDFDocumentProxy
  try {
    pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise
  } catch {
    throw new Error(
      'Could not read this PDF. The file may be corrupted or password-protected.',
    )
  }

  const pages: string[] = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()

    // Each item in content.items is a TextItem or TextMarkedContent.
    // Only TextItem has a 'str' property.
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s{2,}/g, ' ') // collapse multiple spaces
      .trim()

    pages.push(pageText)
  }

  const fullText = pages.join('\n').trim()

  // Detect scanned-image PDFs (no machine-readable text layer)
  const nonWhitespace = fullText.replace(/\s/g, '')
  if (nonWhitespace.length < MIN_TEXT_CHARS) {
    throw new Error(
      'This PDF appears to be a scanned image and has no readable text. ' +
        'Please fill your profile manually or use a text-based PDF.',
    )
  }

  return fullText
}
