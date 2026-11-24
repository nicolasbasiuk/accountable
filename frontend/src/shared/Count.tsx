/** A count with its word, such as 4 days. The number is in the font of numbers. */
export function Count({ amount, word }: { amount: number; word: string }) {
  return (
    <>
      <span className="num">{amount}</span> {amount === 1 ? word : `${word}s`}
    </>
  )
}
