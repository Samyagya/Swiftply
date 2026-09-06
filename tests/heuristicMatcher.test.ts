/**
 * heuristicMatcher.test.ts — Unit tests for the heuristic field matcher.
 *
 * Tests every category of ProfileKey, plus edge cases:
 *   - Empty label with context-only match
 *   - file input always returns 'unmatched'
 *   - No patterns match → 'unmatched'
 *   - Profile field is empty string → source: 'unmatched'
 *
 * Run: npx vitest run tests/heuristicMatcher.test.ts
 *
 * Phase 4 implementation.
 */

import { describe, expect, it } from 'vitest'
import { matchFields } from '../src/background/heuristicMatcher'
import type { FormField, Profile } from '../src/lib/types'

// ---------------------------------------------------------------------------
// Test fixture — a complete profile with values in every field
// ---------------------------------------------------------------------------

const PROFILE: Profile = {
  id: 'test-id',
  name: 'Test Profile',
  contact: {
    firstName: 'Samyagya',
    lastName: 'Sharma',
    email: 'sam@example.com',
    phone: '555-1234',
    address: '123 Main St',
    city: 'New York',
    state: 'NY',
    zip: '10001',
    country: 'United States',
  },
  links: {
    linkedin: 'https://linkedin.com/in/samyagya',
    github: 'https://github.com/samyagya',
    portfolio: 'https://samyagya.dev',
  },
  workHistory: [
    {
      id: 'w1',
      company: 'Acme Corp',
      title: 'Software Engineer',
      startDate: '2022-01',
      endDate: '2024-06',
      current: false,
      description: 'Built things.',
    },
  ],
  education: [
    {
      id: 'e1',
      institution: 'MIT',
      degree: 'B.S.',
      field: 'Computer Science',
      startDate: '2018-09',
      endDate: '2022-05',
      gpa: '3.9',
    },
  ],
  skills: ['TypeScript', 'React', 'Node.js'],
  eeo: {
    gender: 'Male',
    race: 'Asian',
    veteranStatus: 'I am not a protected veteran',
    disabilityStatus: 'I do not have a disability',
  },
}

// Helper: build a minimal FormField
function field(
  label: string,
  inputType: FormField['inputType'] = 'text',
  nearbyContext?: string,
): FormField {
  return { selector: 'field-0', frameId: 0, label, inputType, nearbyContext }
}

// Helper: run matchFields on a single field and return the first mapping
function match(f: FormField) {
  return matchFields([f], PROFILE)[0]
}

// ---------------------------------------------------------------------------
// Contact fields
// ---------------------------------------------------------------------------

describe('contact fields', () => {
  it('matches First Name', () => {
    const r = match(field('First Name'))
    expect(r.source).toBe('heuristic')
    expect(r.value).toBe('Samyagya')
  })

  it('matches "Given name"', () => {
    const r = match(field('Given name'))
    expect(r.source).toBe('heuristic')
    expect(r.value).toBe('Samyagya')
  })

  it('matches Last Name', () => {
    const r = match(field('Last Name'))
    expect(r.source).toBe('heuristic')
    expect(r.value).toBe('Sharma')
  })

  it('matches "Surname"', () => {
    const r = match(field('Surname'))
    expect(r.source).toBe('heuristic')
    expect(r.value).toBe('Sharma')
  })

  it('matches Email Address', () => {
    const r = match(field('Email Address', 'email'))
    expect(r.source).toBe('heuristic')
    expect(r.value).toBe('sam@example.com')
  })

  it('matches Phone Number', () => {
    const r = match(field('Phone Number', 'tel'))
    expect(r.source).toBe('heuristic')
    expect(r.value).toBe('555-1234')
  })

  it('matches "Your mobile"', () => {
    const r = match(field('Your mobile'))
    expect(r.source).toBe('heuristic')
    expect(r.value).toBe('555-1234')
  })

  it('matches City', () => {
    const r = match(field('City'))
    expect(r.source).toBe('heuristic')
    expect(r.value).toBe('New York')
  })

  it('matches State / Province', () => {
    const r = match(field('State / Province', 'select'))
    expect(r.source).toBe('heuristic')
    expect(r.value).toBe('NY')
  })

  it('matches ZIP Code', () => {
    const r = match(field('ZIP Code'))
    expect(r.source).toBe('heuristic')
    expect(r.value).toBe('10001')
  })

  it('matches Country', () => {
    const r = match(field('Country', 'select'))
    expect(r.source).toBe('heuristic')
    expect(r.value).toBe('United States')
  })
})

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

describe('link fields', () => {
  it('matches LinkedIn URL', () => {
    const r = match(field('LinkedIn URL'))
    expect(r.source).toBe('heuristic')
    expect(r.value).toBe('https://linkedin.com/in/samyagya')
  })

  it('matches GitHub', () => {
    const r = match(field('GitHub'))
    expect(r.source).toBe('heuristic')
    expect(r.value).toBe('https://github.com/samyagya')
  })

  it('matches Portfolio / Website', () => {
    const r = match(field('Portfolio Website'))
    expect(r.source).toBe('heuristic')
    expect(r.value).toBe('https://samyagya.dev')
  })

  it('matches "Personal website"', () => {
    const r = match(field('Personal website'))
    expect(r.source).toBe('heuristic')
    expect(r.value).toBe('https://samyagya.dev')
  })
})

// ---------------------------------------------------------------------------
// Work history
// ---------------------------------------------------------------------------

describe('work history fields', () => {
  it('matches Job Title', () => {
    const r = match(field('Job Title'))
    expect(r.source).toBe('heuristic')
    expect(r.value).toBe('Software Engineer')
  })

  it('matches "Current Position"', () => {
    const r = match(field('Current Position'))
    expect(r.source).toBe('heuristic')
    expect(r.value).toBe('Software Engineer')
  })

  it('matches Employer / Company', () => {
    const r = match(field('Employer'))
    expect(r.source).toBe('heuristic')
    expect(r.value).toBe('Acme Corp')
  })
})

// ---------------------------------------------------------------------------
// Education
// ---------------------------------------------------------------------------

describe('education fields', () => {
  it('matches School Name', () => {
    const r = match(field('School Name'))
    expect(r.source).toBe('heuristic')
    expect(r.value).toBe('MIT')
  })

  it('matches Degree', () => {
    const r = match(field('Degree'))
    expect(r.source).toBe('heuristic')
    expect(r.value).toBe('B.S.')
  })

  it('matches Field of Study', () => {
    const r = match(field('Field of Study'))
    expect(r.source).toBe('heuristic')
    expect(r.value).toBe('Computer Science')
  })

  it('matches GPA', () => {
    const r = match(field('GPA'))
    expect(r.source).toBe('heuristic')
    expect(r.value).toBe('3.9')
  })
})

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

describe('skills field', () => {
  it('matches Skills', () => {
    const r = match(field('Skills', 'textarea'))
    expect(r.source).toBe('heuristic')
    expect(r.value).toBe('TypeScript, React, Node.js')
  })
})

// ---------------------------------------------------------------------------
// EEO
// ---------------------------------------------------------------------------

describe('eeo fields', () => {
  it('matches Gender', () => {
    const r = match(field('Gender', 'select'))
    expect(r.source).toBe('heuristic')
    expect(r.value).toBe('Male')
  })

  it('matches Ethnicity / Race', () => {
    const r = match(field('Race / Ethnicity', 'select'))
    expect(r.source).toBe('heuristic')
    expect(r.value).toBe('Asian')
  })

  it('matches Veteran Status', () => {
    const r = match(field('Veteran Status', 'select'))
    expect(r.source).toBe('heuristic')
    expect(r.value).toBe('I am not a protected veteran')
  })

  it('matches Disability Status', () => {
    const r = match(field('Disability Status', 'select'))
    expect(r.source).toBe('heuristic')
    expect(r.value).toBe('I do not have a disability')
  })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('file inputs are always unmatched (rules.md §6)', () => {
    const r = match(field('Resume', 'file'))
    expect(r.source).toBe('unmatched')
    expect(r.value).toBe('')
  })

  it('returns unmatched for a label with no matching patterns', () => {
    const r = match(field('Favourite colour'))
    expect(r.source).toBe('unmatched')
    expect(r.value).toBe('')
  })

  it('returns unmatched for an empty label with no context', () => {
    const r = match(field(''))
    expect(r.source).toBe('unmatched')
  })

  it('matches on nearbyContext when label is empty', () => {
    // label is empty, but context contains "LinkedIn profile URL"
    const r = match(field('', 'text', 'Enter your LinkedIn profile URL'))
    expect(r.source).toBe('heuristic')
    expect(r.value).toBe('https://linkedin.com/in/samyagya')
  })

  it('returns unmatched when profile field has no value (empty profile)', () => {
    const emptyProfile: Profile = {
      ...PROFILE,
      links: { linkedin: '', github: '', portfolio: '' },
    }
    const r = matchFields([field('LinkedIn URL')], emptyProfile)[0]
    // Label matches, but value is empty → source: unmatched
    expect(r.source).toBe('unmatched')
    expect(r.value).toBe('')
  })

  it('processes multiple fields in order', () => {
    const fields: FormField[] = [
      { selector: 'field-0', frameId: 0, label: 'First Name', inputType: 'text' },
      { selector: 'field-1', frameId: 0, label: 'Last Name', inputType: 'text' },
      { selector: 'field-2', frameId: 0, label: 'Email', inputType: 'email' },
      { selector: 'field-3', frameId: 0, label: 'Resume', inputType: 'file' },
    ]
    const mappings = matchFields(fields, PROFILE)
    expect(mappings).toHaveLength(4)
    expect(mappings[0].value).toBe('Samyagya')
    expect(mappings[1].value).toBe('Sharma')
    expect(mappings[2].value).toBe('sam@example.com')
    expect(mappings[3].source).toBe('unmatched') // file
  })
})
