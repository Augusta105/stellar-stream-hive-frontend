export function NetworkBadge() {
  const { isWrongNetwork } = useNetwork();
  if (!isWrongNetwork) return null;
  return <div className="bg-red-100 p-3">Switch network</div>;
}
