import { describe, it, expect } from 'vitest'
import { strictify } from './llmClient'

// The shared schemas are written for Gemini, which wants neither
// additionalProperties nor an exhaustive `required`. Anthropic rejects an open
// object; OpenAI's strict mode additionally rejects any property missing from
// `required`. A mistake here is a 400 from the provider on every call.
describe('strictify', () => {
  const schema = {
    type: 'object',
    properties: {
      lemma: { type: 'string' },
      forms: {
        type: 'array',
        items: {
          type: 'object',
          properties: { form: { type: 'string' }, case: { type: 'string' } },
        },
      },
    },
    required: ['lemma'],
  }

  it('closes every object, including ones nested inside array items', () => {
    const out = strictify(schema, false) as any
    expect(out.additionalProperties).toBe(false)
    expect(out.properties.forms.items.additionalProperties).toBe(false)
  })

  it('leaves `required` alone when requireAll is false (Anthropic)', () => {
    const out = strictify(schema, false) as any
    expect(out.required).toEqual(['lemma'])
  })

  it('lists every property in `required` when requireAll is true (OpenAI)', () => {
    const out = strictify(schema, true) as any
    expect(out.required.sort()).toEqual(['forms', 'lemma'])
    expect(out.properties.forms.items.required.sort()).toEqual(['case', 'form'])
  })

  it('does not mutate the shared schema — it is reused across providers', () => {
    const before = JSON.parse(JSON.stringify(schema))
    strictify(schema, true)
    expect(schema).toEqual(before)
  })

  it('passes through primitives and leaf schemas untouched', () => {
    expect(strictify({ type: 'string' }, true)).toEqual({ type: 'string' })
    expect(strictify(null, true)).toBe(null)
    expect(strictify('x', true)).toBe('x')
  })

  it('handles an array of schemas', () => {
    const out = strictify([{ type: 'object', properties: { a: { type: 'string' } } }], true) as any
    expect(out[0].additionalProperties).toBe(false)
    expect(out[0].required).toEqual(['a'])
  })
})
