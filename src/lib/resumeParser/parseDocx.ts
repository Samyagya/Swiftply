/**
 * parseDocx.ts — Extract raw text from a DOCX file using mammoth.js (client-side).
 *
 * mammoth.extractRawText() strips all DOCX formatting and returns plain text.
 * Content in text boxes and some table cells may be missed — the user is
 * shown a review banner after parsing so they can catch any gaps.
 *
 * Phase 2 implementation — see docs/features/03-resume-parsing.md
 */

import mammoth from 'mammoth'

/**
 * Extracts plain text from a DOCX file.
 *
 * @param file - A File object from a browser file picker (<input type="file">).
 * @returns Plain text of the document body.
 * @throws Error with a user-readable message if the file is unreadable or empty.
 */
export async function parseDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()

  // TypeScript infers the return type of extractRawText — no explicit annotation needed.
  // (Using mammoth.Message[] as a type would require `import * as mammoth`, not the
  // default import. Simpler to just let inference do its job.)
  let value: string
  try {
    const result = await mammoth.extractRawText({ arrayBuffer })
    value = result.value
  } catch {
    throw new Error(
      'Could not read this DOCX file. The file may be corrupted or in an unsupported format.',
    )
  }

  const text = value.trim()

  if (!text) {
    throw new Error(
      'This DOCX file appears to be empty or contains only images/charts that cannot be read.',
    )
  }

  return text
}

