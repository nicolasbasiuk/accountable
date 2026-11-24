/** If it needs two lines, it breaks after the @. */
export function EmailLink({ email, className = '' }: { email: string; className?: string }) {
  const [name, domain] = email.split('@')
  return (
    <a href={`mailto:${email}`} className={`link ${className}`}>
      {name}@<wbr />
      {domain}
    </a>
  )
}
