import { cors, ok, err } from './_helpers.js'

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405)

  const { fileData, fileType } = req.body || {}
  if (!fileData) return err(res, 'No file data provided')

  // Determine media type
  const mediaType = fileType?.includes('pdf') ? 'application/pdf'
    : fileType?.includes('png') ? 'image/png'
    : fileType?.includes('gif') ? 'image/gif'
    : fileType?.includes('webp') ? 'image/webp'
    : 'image/jpeg'

  const prompt = `You are extracting data from a credit application form. Extract ALL visible fields and return ONLY a JSON object with no extra text or markdown.

Return this exact structure (use empty string "" for any field not found):
{
  "app_type": "individual",
  "primary": {
    "first_name": "",
    "last_name": "",
    "dob": "",
    "ssn": "",
    "cell_phone": "",
    "work_phone": "",
    "email": "",
    "address": "",
    "city": "",
    "state": "",
    "zip": "",
    "housing_status": "",
    "housing_monthly_pmt": "",
    "housing_years": "",
    "housing_months": "",
    "prev_address": "",
    "prev_city": "",
    "prev_state": "",
    "prev_zip": "",
    "prev_years": "",
    "prev_months": "",
    "employer": "",
    "job_title": "",
    "years_on_job": "",
    "months_on_job": "",
    "monthly_income": "",
    "employment_type": ""
  },
  "cosigner": null,
  "business": null,
  "notes": ""
}

Rules:
- If there is a co-signer section with data, set app_type to "individual_cosigner" and populate cosigner with same fields as primary
- If this is a business application, set app_type to "business" and populate business: { business_name, business_type, ein, business_phone, business_address, business_city, business_state, business_zip, years_in_business, annual_revenue }
- If business with co-signer, set app_type to "business_cosigner"
- For dob, format as YYYY-MM-DD if possible
- For ssn, include dashes: XXX-XX-XXXX
- For housing_status, use one of: Rent, Mortgage, Own Outright, Lives with Relatives
- For employment_type, use one of: Full-Time, Part-Time, Self-Employed, Retired, Other
- housing_years and housing_months should be numbers only
- Return ONLY the JSON object, no markdown, no explanation`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            {
              type: mediaType === 'application/pdf' ? 'document' : 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: fileData
              }
            },
            { type: 'text', text: prompt }
          ]
        }]
      })
    })

    if (!response.ok) {
      const e = await response.json()
      return err(res, 'AI parse failed: ' + (e.error?.message || response.status), 500)
    }

    const data = await response.json()
    const text = data.content?.find(b => b.type === 'text')?.text || ''

    // Parse JSON from response
    const clean = text.replace(/```json|```/g, '').trim()
    let parsed
    try {
      parsed = JSON.parse(clean)
    } catch {
      // Try to extract JSON from response
      const match = clean.match(/\{[\s\S]*\}/)
      if (match) parsed = JSON.parse(match[0])
      else return err(res, 'Could not parse AI response', 500)
    }

    return ok(res, { parsed })
  } catch (e) {
    return err(res, 'Parse error: ' + e.message, 500)
  }
}
