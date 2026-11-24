// A website's address, with or without https:// (O1).

const SCHEME = /^https?:\/\//i

export const websiteLink = (website: string) => (SCHEME.test(website) ? website : `https://${website}`)

/** True, or what to say about it. */
export function checkWebsite(text: string): true | string {
  const website = text.trim()
  if (website === '') return true
  const problem = 'Enter a website address, such as example.com.'
  if (/[\s@]/.test(website) || (website.includes('://') && !SCHEME.test(website))) return problem
  try {
    const { hostname } = new URL(websiteLink(website))
    return /^[^.]+(\.[^.]+)+$/.test(hostname) || problem
  } catch {
    return problem
  }
}
