export function WithdrawButton() {
  const { isWrongNetwork } = useNetwork();
  return <button disabled={isWrongNetwork}>Withdraw</button>;
}
