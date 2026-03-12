/**
 * Input validation schemas.
 *
 * NOTE: Install Zod for production use: npm install zod
 * For now, these are plain TypeScript validation functions.
 */

/** Validate the AI program generation request payload */
export function validateAIProgramRequest(body: unknown): {
  valid: boolean
  error?: string
  data?: {
    prompt: string
    program: Array<{ week: number; days: Array<{ day_number: number; dag: string }> }>
    templateName: string
    mode: 'build' | 'advice'
  }
} {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body is required' }
  }

  const { prompt, program, templateName, mode } = body as Record<string, unknown>

  if (typeof prompt !== 'string' || prompt.length === 0) {
    return { valid: false, error: 'Prompt is required' }
  }

  if (typeof prompt === 'string' && prompt.length > 5000) {
    return { valid: false, error: 'Prompt exceeds maximum length of 5000 characters' }
  }

  if (typeof templateName !== 'string') {
    return { valid: false, error: 'Template name is required' }
  }

  if (mode !== 'build' && mode !== 'advice') {
    return { valid: false, error: 'Mode must be "build" or "advice"' }
  }

  if (!Array.isArray(program)) {
    return { valid: false, error: 'Program structure is required' }
  }

  return {
    valid: true,
    data: { prompt, program, templateName, mode } as any,
  }
}

/** Validate weight input */
export function validateWeight(value: string): { valid: boolean; weight?: number; error?: string } {
  const weight = parseFloat(value)
  if (isNaN(weight)) return { valid: false, error: 'Ongeldig gewicht' }
  if (weight < 20 || weight > 300) return { valid: false, error: 'Gewicht moet tussen 20-300 kg zijn' }
  return { valid: true, weight }
}

/** Validate profile name */
export function validateName(name: string): { valid: boolean; error?: string } {
  const trimmed = name.trim()
  if (trimmed.length < 2) return { valid: false, error: 'Naam moet minimaal 2 tekens zijn' }
  if (trimmed.length > 100) return { valid: false, error: 'Naam is te lang' }
  return { valid: true }
}

/** Validate registration fields */
export function validateRegistration(data: {
  firstName: string
  lastName: string
  email: string
  password: string
  password2: string
}): { valid: boolean; error?: string } {
  if (!data.firstName || !data.lastName || !data.email || !data.password) {
    return { valid: false, error: 'Vul alle verplichte velden in.' }
  }
  if (data.password !== data.password2) {
    return { valid: false, error: 'Wachtwoorden komen niet overeen.' }
  }
  if (data.password.length < 8) {
    return { valid: false, error: 'Wachtwoord moet minimaal 8 tekens zijn.' }
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(data.email)) {
    return { valid: false, error: 'Ongeldig e-mailadres.' }
  }
  return { valid: true }
}
