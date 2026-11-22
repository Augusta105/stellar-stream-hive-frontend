export function CreateStreamForm() {
  const { isWrongNetwork } = useNetwork();
  return <button disabled={isWrongNetwork}>Create</button>;
}
